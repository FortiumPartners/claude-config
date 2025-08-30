#!/usr/bin/env python3
"""
Automatic Issue Creator service - Core orchestration service.

This service coordinates the entire process of creating issues from specifications,
including parsing, classification, template application, and ticketing system integration.
"""

import asyncio
import logging
import re
from typing import List, Dict, Any, Optional, Union, Tuple
from dataclasses import dataclass, field
from pathlib import Path
from datetime import datetime
import json
import yaml

from issue_spec import IssueSpec, IssueHierarchy, IssueType, Priority
from spec_parser import SpecificationParser, parse_specification
from detection_algorithms import AdvancedIssueDetector, classify_issue_type, detect_issue_priority
from criteria_extractor import AcceptanceCriteriaExtractor, extract_acceptance_criteria
from ticketing_interface import (
    TicketingInterface, TicketingSystemConfig, TicketingSystem,
    CreatedIssue, TicketingInterfaceException, TicketingSystemFactory,
    create_config_from_dict, validate_hierarchy_for_system
)
from error_handling import RetryHandler, RetryConfig, create_retry_config, with_retry


@dataclass
class IssueCreationConfig:
    """Configuration for automatic issue creation."""
    
    # Ticketing system configuration
    ticketing_config: TicketingSystemConfig
    
    # Processing options
    enabled: bool = True
    dry_run: bool = False
    
    # Parser configuration
    use_advanced_detection: bool = True
    min_confidence_threshold: float = 0.5
    
    # Template configuration
    apply_templates: bool = True
    template_path: Optional[str] = None
    
    # Output configuration
    update_spec_with_links: bool = True
    create_summary_report: bool = True
    
    # Retry configuration
    retry_config: Optional[RetryConfig] = None
    
    # Processing limits
    max_issues_per_spec: int = 100
    processing_timeout: int = 300  # 5 minutes
    
    def __post_init__(self):
        """Initialize derived configurations."""
        if self.retry_config is None:
            self.retry_config = create_retry_config(self.ticketing_config.system_type.value)


@dataclass
class IssueCreationResult:
    """Result of issue creation process."""
    
    # Success metrics
    created_issues: List[CreatedIssue] = field(default_factory=list)
    total_created: int = 0
    total_failed: int = 0
    
    # Processing details
    spec_file: Optional[str] = None
    hierarchy: Optional[IssueHierarchy] = None
    processing_time: float = 0.0
    
    # Errors and warnings
    errors: List[Dict[str, Any]] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    
    # Links and references
    spec_updated: bool = False
    summary_report_path: Optional[str] = None
    
    @property
    def success_rate(self) -> float:
        """Calculate success rate."""
        total = self.total_created + self.total_failed
        return (self.total_created / total * 100) if total > 0 else 0.0
    
    @property
    def was_successful(self) -> bool:
        """Check if creation was generally successful."""
        return self.total_created > 0 and self.total_failed == 0


class AutomaticIssueCreator:
    """
    Core service for automatic issue creation from specifications.
    
    Orchestrates the complete workflow:
    1. Parse specifications into issue hierarchy
    2. Apply advanced detection and classification
    3. Apply templates and team configurations
    4. Create issues in ticketing system with retry logic
    5. Update specifications with issue links
    6. Generate summary reports
    """
    
    def __init__(self, config: IssueCreationConfig):
        self.config = config
        self.logger = logging.getLogger(__name__)
        
        # Initialize components
        self.parser = SpecificationParser()
        self.detector = AdvancedIssueDetector() if config.use_advanced_detection else None
        self.criteria_extractor = AcceptanceCriteriaExtractor()
        self.retry_handler = RetryHandler(config.retry_config)
        
        # Initialize ticketing interface
        self.ticketing: Optional[TicketingInterface] = None
        self._initialize_ticketing_interface()
        
        # Template system
        self.templates: Dict[str, Any] = {}
        self._load_templates()
    
    def _initialize_ticketing_interface(self):
        """Initialize the ticketing system interface."""
        try:
            self.ticketing = TicketingSystemFactory.create_integration(self.config.ticketing_config)
            self.logger.info(f"Initialized {self.config.ticketing_config.system_type.value} ticketing interface")
        except Exception as e:
            self.logger.error(f"Failed to initialize ticketing interface: {e}")
            if not self.config.dry_run:
                raise
    
    def _load_templates(self):
        """Load issue templates from configuration."""
        if not self.config.apply_templates or not self.config.template_path:
            return
        
        try:
            template_path = Path(self.config.template_path)
            if template_path.exists():
                with open(template_path, 'r') as f:
                    if template_path.suffix.lower() in ['.yml', '.yaml']:
                        self.templates = yaml.safe_load(f)
                    else:
                        self.templates = json.load(f)
                
                self.logger.info(f"Loaded templates from {template_path}")
        except Exception as e:
            self.logger.warning(f"Failed to load templates: {e}")
    
    async def create_issues_from_file(self, spec_file_path: str) -> IssueCreationResult:
        """Create issues from a specification file."""
        start_time = datetime.now()
        result = IssueCreationResult(spec_file=spec_file_path)
        
        try:
            # Validate input
            spec_path = Path(spec_file_path)
            if not spec_path.exists():
                raise ValueError(f"Specification file not found: {spec_file_path}")
            
            self.logger.info(f"Processing specification file: {spec_file_path}")
            
            # Parse specification
            hierarchy = await self._parse_specification_with_retry(str(spec_path))
            result.hierarchy = hierarchy
            
            if hierarchy.total_count() == 0:
                result.warnings.append("No trackable issues found in specification")
                return result
            
            if hierarchy.total_count() > self.config.max_issues_per_spec:
                raise ValueError(
                    f"Specification contains {hierarchy.total_count()} issues, "
                    f"exceeding limit of {self.config.max_issues_per_spec}"
                )
            
            self.logger.info(f"Parsed {hierarchy.total_count()} issues from specification")
            
            # Validate hierarchy for target system
            warnings = validate_hierarchy_for_system(hierarchy, self.config.ticketing_config.system_type)
            result.warnings.extend(warnings)
            
            # Enhanced classification if enabled
            if self.config.use_advanced_detection:
                await self._enhance_classification(hierarchy)
            
            # Apply templates
            if self.config.apply_templates:
                self._apply_templates_to_hierarchy(hierarchy)
            
            # Create issues in ticketing system
            if not self.config.dry_run:
                created_issues = await self._create_issues_with_retry(hierarchy)
                result.created_issues = created_issues
                result.total_created = len(created_issues)
                
                # Update specification with issue links
                if self.config.update_spec_with_links and created_issues:
                    updated = await self._update_specification_with_links(spec_path, created_issues)
                    result.spec_updated = updated
            else:
                # Dry run - simulate creation
                self.logger.info("DRY RUN: Would create the following issues:")
                for issue in hierarchy.all_issues.values():
                    self.logger.info(f"  - [{issue.issue_type.value}] {issue.title}")
                result.total_created = hierarchy.total_count()
            
            # Generate summary report
            if self.config.create_summary_report:
                report_path = await self._generate_summary_report(result)
                result.summary_report_path = report_path
            
        except Exception as e:
            self.logger.error(f"Failed to process specification {spec_file_path}: {e}")
            result.errors.append({
                "type": type(e).__name__,
                "message": str(e),
                "timestamp": datetime.now().isoformat()
            })
            result.total_failed = 1
        
        finally:
            result.processing_time = (datetime.now() - start_time).total_seconds()
            
        self.logger.info(
            f"Completed processing {spec_file_path}: "
            f"{result.total_created} created, {result.total_failed} failed, "
            f"{result.processing_time:.2f}s"
        )
        
        return result
    
    async def create_issues_from_content(self, content: str, source_name: str = "content") -> IssueCreationResult:
        """Create issues from specification content."""
        start_time = datetime.now()
        result = IssueCreationResult(spec_file=source_name)
        
        try:
            self.logger.info(f"Processing specification content: {source_name}")
            
            # Parse specification content
            hierarchy = await self._parse_content_with_retry(content, source_name)
            result.hierarchy = hierarchy
            
            if hierarchy.total_count() == 0:
                result.warnings.append("No trackable issues found in content")
                return result
            
            self.logger.info(f"Parsed {hierarchy.total_count()} issues from content")
            
            # Process similarly to file-based creation
            if self.config.use_advanced_detection:
                await self._enhance_classification(hierarchy)
            
            if self.config.apply_templates:
                self._apply_templates_to_hierarchy(hierarchy)
            
            if not self.config.dry_run:
                created_issues = await self._create_issues_with_retry(hierarchy)
                result.created_issues = created_issues
                result.total_created = len(created_issues)
            else:
                self.logger.info("DRY RUN: Would create the following issues:")
                for issue in hierarchy.all_issues.values():
                    self.logger.info(f"  - [{issue.issue_type.value}] {issue.title}")
                result.total_created = hierarchy.total_count()
            
            if self.config.create_summary_report:
                report_path = await self._generate_summary_report(result)
                result.summary_report_path = report_path
            
        except Exception as e:
            self.logger.error(f"Failed to process content {source_name}: {e}")
            result.errors.append({
                "type": type(e).__name__,
                "message": str(e),
                "timestamp": datetime.now().isoformat()
            })
            result.total_failed = 1
        
        finally:
            result.processing_time = (datetime.now() - start_time).total_seconds()
        
        return result
    
    async def _parse_specification_with_retry(self, file_path: str) -> IssueHierarchy:
        """Parse specification with retry logic."""
        return await self.retry_handler.execute_with_retry(
            self.parser.parse_file,
            "parse_specification",
            file_path
        )
    
    async def _parse_content_with_retry(self, content: str, source_name: str) -> IssueHierarchy:
        """Parse content with retry logic."""
        return await self.retry_handler.execute_with_retry(
            self.parser.parse_content,
            "parse_content", 
            content,
            source_name
        )
    
    async def _enhance_classification(self, hierarchy: IssueHierarchy):
        """Apply advanced classification to improve issue detection."""
        self.logger.info("Applying advanced classification...")
        
        enhanced_count = 0
        
        for issue in hierarchy.all_issues.values():
            try:
                # Skip if already well-classified with high confidence
                if self._is_well_classified(issue):
                    continue
                
                # Get enhanced classification (would need section content)
                # This is a placeholder - in real implementation we'd pass the original section
                
                # For now, just apply priority detection logic
                if issue.priority == Priority.MEDIUM:  # Default priority
                    # Try to infer priority from title and description
                    content = f"{issue.title} {issue.description}"
                    if any(word in content.lower() for word in ['urgent', 'critical', 'blocker']):
                        issue.priority = Priority.URGENT
                        enhanced_count += 1
                    elif any(word in content.lower() for word in ['important', 'high']):
                        issue.priority = Priority.HIGH
                        enhanced_count += 1
                
            except Exception as e:
                self.logger.warning(f"Failed to enhance classification for issue {issue.id}: {e}")
        
        if enhanced_count > 0:
            self.logger.info(f"Enhanced classification for {enhanced_count} issues")
    
    def _is_well_classified(self, issue: IssueSpec) -> bool:
        """Check if an issue is already well-classified."""
        # Consider an issue well-classified if it has:
        # - Appropriate type for its hierarchy level
        # - Non-default priority when it has priority keywords
        # - Acceptance criteria when it's a feature/story
        
        hierarchy_depth = issue.get_depth()
        
        # Epics should be at root level
        if issue.issue_type == IssueType.EPIC and hierarchy_depth > 0:
            return False
        
        # Tasks should be at deeper levels
        if issue.issue_type == IssueType.TASK and hierarchy_depth == 0:
            return False
        
        return True
    
    def _apply_templates_to_hierarchy(self, hierarchy: IssueHierarchy):
        """Apply templates to all issues in hierarchy."""
        if not self.templates:
            return
        
        self.logger.info("Applying templates to issues...")
        
        applied_count = 0
        
        for issue in hierarchy.all_issues.values():
            try:
                if self._apply_template_to_issue(issue):
                    applied_count += 1
            except Exception as e:
                self.logger.warning(f"Failed to apply template to issue {issue.id}: {e}")
        
        if applied_count > 0:
            self.logger.info(f"Applied templates to {applied_count} issues")
    
    def _apply_template_to_issue(self, issue: IssueSpec) -> bool:
        """Apply appropriate template to a single issue."""
        issue_type_key = issue.issue_type.value
        template = self.templates.get('templates', {}).get(issue_type_key)
        
        if not template:
            return False
        
        # Apply title prefix
        if 'title_prefix' in template and not issue.title.startswith(template['title_prefix']):
            issue.title = f"{template['title_prefix']} {issue.title}"
        
        # Apply default assignee
        if 'default_assignee' in template and not issue.assignee:
            issue.assignee = template['default_assignee']
        
        # Apply labels
        if 'labels' in template:
            issue.add_labels(template['labels'])
        
        # Apply priority if not set
        if 'default_priority' in template and issue.priority == Priority.MEDIUM:
            try:
                priority_str = template['default_priority']
                issue.priority = Priority(priority_str)
            except ValueError:
                pass  # Invalid priority in template
        
        return True
    
    async def _create_issues_with_retry(self, hierarchy: IssueHierarchy) -> List[CreatedIssue]:
        """Create issues with comprehensive retry logic."""
        if not self.ticketing:
            raise RuntimeError("Ticketing interface not initialized")
        
        return await self.retry_handler.execute_with_retry(
            self.ticketing.create_issue_hierarchy,
            "create_issue_hierarchy",
            hierarchy
        )
    
    async def _update_specification_with_links(self, spec_path: Path, created_issues: List[CreatedIssue]) -> bool:
        """Update specification file with links to created issues."""
        try:
            self.logger.info(f"Updating specification {spec_path} with issue links")
            
            # Read current content
            with open(spec_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Create mapping from spec issues to created issues
            issue_links = {}
            for created_issue in created_issues:
                if created_issue.original_spec:
                    issue_links[created_issue.original_spec.id] = created_issue
            
            # Add links to specification
            updated_content = self._insert_issue_links(content, issue_links)
            
            # Write updated content
            if updated_content != content:
                with open(spec_path, 'w', encoding='utf-8') as f:
                    f.write(updated_content)
                
                self.logger.info(f"Updated specification with {len(issue_links)} issue links")
                return True
            
            return False
            
        except Exception as e:
            self.logger.error(f"Failed to update specification with links: {e}")
            return False
    
    def _insert_issue_links(self, content: str, issue_links: Dict[str, CreatedIssue]) -> str:
        """Insert issue links into specification content."""
        lines = content.split('\n')
        updated_lines = []
        
        for line in lines:
            updated_lines.append(line)
            
            # Look for headers that might correspond to issues
            header_match = re.match(r'^(#{1,6})\s+(.+)$', line)
            if header_match:
                level = len(header_match.group(1))
                title = header_match.group(2).strip()
                
                # Find matching created issue
                for spec_id, created_issue in issue_links.items():
                    if created_issue.original_spec and created_issue.original_spec.source_section == title:
                        # Add issue link after the header
                        system_name = created_issue.system_type.value.title()
                        link_line = f"\n> **{system_name} Issue**: [{created_issue.id}]({created_issue.url})"
                        updated_lines.append(link_line)
                        break
        
        return '\n'.join(updated_lines)
    
    async def _generate_summary_report(self, result: IssueCreationResult) -> Optional[str]:
        """Generate a summary report of the creation process."""
        try:
            # Create report content
            report = {
                "summary": {
                    "spec_file": result.spec_file,
                    "timestamp": datetime.now().isoformat(),
                    "processing_time": result.processing_time,
                    "total_created": result.total_created,
                    "total_failed": result.total_failed,
                    "success_rate": result.success_rate
                },
                "created_issues": [
                    {
                        "id": issue.id,
                        "number": issue.number,
                        "title": issue.title,
                        "url": issue.url,
                        "system": issue.system_type.value,
                        "status": issue.status.value,
                        "created_at": issue.created_at.isoformat()
                    }
                    for issue in result.created_issues
                ],
                "warnings": result.warnings,
                "errors": result.errors
            }
            
            # Write report file
            if result.spec_file:
                spec_path = Path(result.spec_file)
                report_path = spec_path.parent / f"{spec_path.stem}_creation_report.json"
            else:
                report_path = Path("issue_creation_report.json")
            
            with open(report_path, 'w') as f:
                json.dump(report, f, indent=2)
            
            self.logger.info(f"Generated summary report: {report_path}")
            return str(report_path)
            
        except Exception as e:
            self.logger.error(f"Failed to generate summary report: {e}")
            return None
    
    async def test_connection(self) -> bool:
        """Test connection to the configured ticketing system."""
        if not self.ticketing:
            return False
        
        try:
            return await self.ticketing.test_connection()
        except Exception as e:
            self.logger.error(f"Connection test failed: {e}")
            return False
    
    def get_configuration_summary(self) -> Dict[str, Any]:
        """Get a summary of the current configuration."""
        return {
            "ticketing_system": self.config.ticketing_config.system_type.value,
            "enabled": self.config.enabled,
            "dry_run": self.config.dry_run,
            "advanced_detection": self.config.use_advanced_detection,
            "templates_enabled": self.config.apply_templates,
            "templates_loaded": len(self.templates),
            "retry_config": {
                "max_attempts": self.config.retry_config.max_attempts,
                "strategy": self.config.retry_config.strategy.value
            },
            "limits": {
                "max_issues_per_spec": self.config.max_issues_per_spec,
                "processing_timeout": self.config.processing_timeout
            }
        }


# Convenience functions

async def create_issues_from_spec(spec_file: str, ticketing_config: Dict[str, Any], 
                                dry_run: bool = False) -> IssueCreationResult:
    """Convenience function to create issues from a specification file."""
    config = IssueCreationConfig(
        ticketing_config=create_config_from_dict(ticketing_config),
        dry_run=dry_run
    )
    
    creator = AutomaticIssueCreator(config)
    return await creator.create_issues_from_file(spec_file)


async def create_issues_from_content_string(content: str, ticketing_config: Dict[str, Any],
                                          dry_run: bool = False) -> IssueCreationResult:
    """Convenience function to create issues from specification content."""
    config = IssueCreationConfig(
        ticketing_config=create_config_from_dict(ticketing_config),
        dry_run=dry_run
    )
    
    creator = AutomaticIssueCreator(config)
    return await creator.create_issues_from_content(content)