#!/usr/bin/env python3
"""
Integration with /create-spec command for automatic issue creation.

This module provides the Phase 2.5 integration that seamlessly adds automatic
issue creation to the existing /create-spec workflow.
"""

import asyncio
import logging
import json
from typing import Dict, Any, Optional, List
from pathlib import Path
from datetime import datetime

from automatic_issue_creator import AutomaticIssueCreator, IssueCreationConfig, IssueCreationResult
from ticketing_interface import TicketingSystemConfig, TicketingSystem, create_config_from_dict
from bidirectional_linking import BidirectionalLinker, LinkingConfig, create_default_linking_config


class CreateSpecIntegration:
    """
    Integration handler for /create-spec command Phase 2.5.
    
    Provides seamless integration with the existing 16-step create-spec workflow
    by adding automatic issue creation between specification writing and task planning.
    """
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.config_cache = {}  # Cache for loaded configurations
    
    async def execute_phase_25(self, spec_file_path: str, config_override: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Execute Phase 2.5: Automatic Issue Creation
        
        This is called from the /create-spec workflow between:
        - Step 11: Write comprehensive specification
        - Step 12: Create detailed task breakdown
        
        Args:
            spec_file_path: Path to the newly created specification
            config_override: Optional configuration overrides
            
        Returns:
            Dict with execution results and metadata
        """
        result = {
            "success": False,
            "enabled": False,
            "dry_run": False,
            "issues_created": 0,
            "errors": [],
            "warnings": [],
            "execution_time": 0.0,
            "spec_updated": False,
            "summary": {}
        }
        
        start_time = datetime.now()
        
        try:
            self.logger.info("=== Phase 2.5: Automatic Issue Creation ===")
            
            # Load configuration
            config = await self._load_configuration(spec_file_path, config_override)
            
            result["enabled"] = config.enabled
            result["dry_run"] = config.dry_run
            
            if not config.enabled:
                self.logger.info("Automatic issue creation is disabled - skipping Phase 2.5")
                result["success"] = True
                return result
            
            # Validate specification file
            if not await self._validate_specification_file(spec_file_path):
                result["errors"].append("Specification file validation failed")
                return result
            
            # Check ticketing system connectivity
            creator = AutomaticIssueCreator(config)
            if not config.dry_run:
                connectivity_ok = await creator.test_connection()
                if not connectivity_ok:
                    result["warnings"].append("Ticketing system connectivity issues - proceeding in dry-run mode")
                    config.dry_run = True
                    result["dry_run"] = True
            
            # Execute issue creation
            self.logger.info(f"Processing specification: {spec_file_path}")
            creation_result = await creator.create_issues_from_file(spec_file_path)
            
            # Process results
            result["success"] = creation_result.was_successful or creation_result.total_created > 0
            result["issues_created"] = creation_result.total_created
            result["spec_updated"] = creation_result.spec_updated
            result["warnings"].extend(creation_result.warnings)
            
            # Add errors if any
            for error in creation_result.errors:
                result["errors"].append(error["message"])
            
            # Create summary
            result["summary"] = self._create_execution_summary(creation_result, config)
            
            # Log results
            if config.dry_run:
                self.logger.info(f"DRY RUN: Would have created {creation_result.total_created} issues")
            else:
                self.logger.info(f"Created {creation_result.total_created} issues successfully")
            
            if creation_result.warnings:
                for warning in creation_result.warnings:
                    self.logger.warning(f"Phase 2.5 warning: {warning}")
            
        except Exception as e:
            self.logger.error(f"Phase 2.5 execution failed: {e}")
            result["errors"].append(str(e))
            result["success"] = False
        
        finally:
            result["execution_time"] = (datetime.now() - start_time).total_seconds()
        
        # Log completion
        status = "completed successfully" if result["success"] else "failed"
        self.logger.info(f"=== Phase 2.5 {status} in {result['execution_time']:.2f}s ===")
        
        return result
    
    async def _load_configuration(self, spec_file_path: str, config_override: Optional[Dict[str, Any]]) -> IssueCreationConfig:
        """Load configuration for automatic issue creation."""
        # Look for configuration files in order of precedence
        config_paths = [
            # 1. Project-specific config
            Path(spec_file_path).parent / ".agent-os" / "config" / "issue-creation.yml",
            Path(spec_file_path).parent / ".agent-os" / "config" / "issue-creation.json",
            
            # 2. Global Agent OS config
            Path.home() / ".agent-os" / "config" / "issue-creation.yml",
            Path.home() / ".agent-os" / "config" / "issue-creation.json",
            
            # 3. Claude config directory
            Path.home() / ".claude" / "config" / "issue-creation.yml",
            Path.home() / ".claude" / "config" / "issue-creation.json",
        ]
        
        # Load base configuration
        base_config = {}
        for config_path in config_paths:
            if config_path.exists():
                try:
                    with open(config_path, 'r') as f:
                        if config_path.suffix.lower() in ['.yml', '.yaml']:
                            import yaml
                            file_config = yaml.safe_load(f)
                        else:
                            file_config = json.load(f)
                    
                    # Merge with base config
                    base_config.update(file_config)
                    self.logger.info(f"Loaded configuration from {config_path}")
                    break
                    
                except Exception as e:
                    self.logger.warning(f"Failed to load config from {config_path}: {e}")
        
        # Apply overrides
        if config_override:
            base_config.update(config_override)
        
        # Create configuration object
        return self._create_issue_creation_config(base_config)
    
    def _create_issue_creation_config(self, config_data: Dict[str, Any]) -> IssueCreationConfig:
        """Create IssueCreationConfig from loaded data."""
        # Default configuration
        default_config = {
            "automatic_issue_creation": {
                "enabled": True,
                "dry_run": False,
                "default_ticketing_system": "linear"
            },
            "ticketing_systems": {
                "linear": {
                    "system_type": "linear",
                    "team_id": None
                },
                "github": {
                    "system_type": "github",
                    "repository_owner": None,
                    "repository_name": None
                }
            }
        }
        
        # Merge with loaded config
        merged_config = {**default_config, **config_data}
        
        # Extract main settings
        auto_settings = merged_config.get("automatic_issue_creation", {})
        enabled = auto_settings.get("enabled", True)
        dry_run = auto_settings.get("dry_run", False)
        
        # Get ticketing system configuration
        default_system = auto_settings.get("default_ticketing_system", "linear")
        ticketing_systems = merged_config.get("ticketing_systems", {})
        
        if default_system not in ticketing_systems:
            raise ValueError(f"Default ticketing system '{default_system}' not found in configuration")
        
        ticketing_config_data = ticketing_systems[default_system]
        ticketing_config = create_config_from_dict(ticketing_config_data)
        
        # Create issue creation configuration
        return IssueCreationConfig(
            ticketing_config=ticketing_config,
            enabled=enabled,
            dry_run=dry_run,
            use_advanced_detection=auto_settings.get("use_advanced_detection", True),
            apply_templates=auto_settings.get("apply_templates", True),
            update_spec_with_links=auto_settings.get("update_spec_with_links", True),
            create_summary_report=auto_settings.get("create_summary_report", True),
            max_issues_per_spec=auto_settings.get("max_issues_per_spec", 100),
            processing_timeout=auto_settings.get("processing_timeout", 300)
        )
    
    async def _validate_specification_file(self, spec_file_path: str) -> bool:
        """Validate that the specification file is ready for processing."""
        try:
            spec_path = Path(spec_file_path)
            
            # Check if file exists
            if not spec_path.exists():
                self.logger.error(f"Specification file not found: {spec_file_path}")
                return False
            
            # Check if file is readable
            with open(spec_path, 'r') as f:
                content = f.read()
            
            # Basic content validation
            if len(content.strip()) < 100:
                self.logger.warning(f"Specification file seems very short: {len(content)} characters")
                return False
            
            # Check for basic markdown structure
            if not any(line.startswith('#') for line in content.split('\n')):
                self.logger.warning("Specification file doesn't appear to have markdown headers")
                return False
            
            return True
            
        except Exception as e:
            self.logger.error(f"Specification file validation failed: {e}")
            return False
    
    def _create_execution_summary(self, creation_result: IssueCreationResult, config: IssueCreationConfig) -> Dict[str, Any]:
        """Create execution summary for reporting."""
        summary = {
            "ticketing_system": config.ticketing_config.system_type.value,
            "processing_time": creation_result.processing_time,
            "issues_created": creation_result.total_created,
            "issues_failed": creation_result.total_failed,
            "success_rate": creation_result.success_rate,
            "warnings_count": len(creation_result.warnings),
            "spec_updated": creation_result.spec_updated
        }
        
        # Add issue breakdown if hierarchy exists
        if creation_result.hierarchy:
            hierarchy = creation_result.hierarchy
            summary["issue_breakdown"] = {
                "epics": len(hierarchy.get_epics()),
                "features": len(hierarchy.get_stories()),
                "tasks": len(hierarchy.get_tasks()),
                "total": hierarchy.total_count()
            }
        
        # Add system-specific information
        if creation_result.created_issues:
            first_issue = creation_result.created_issues[0]
            summary["first_issue_url"] = first_issue.url
            summary["system_base_url"] = self._extract_base_url(first_issue.url)
        
        return summary
    
    def _extract_base_url(self, issue_url: str) -> str:
        """Extract base URL from issue URL."""
        try:
            from urllib.parse import urlparse
            parsed = urlparse(issue_url)
            return f"{parsed.scheme}://{parsed.netloc}"
        except:
            return issue_url
    
    async def check_configuration(self, spec_file_path: Optional[str] = None) -> Dict[str, Any]:
        """Check the current configuration for automatic issue creation."""
        try:
            config = await self._load_configuration(spec_file_path or ".", {})
            
            return {
                "valid": True,
                "enabled": config.enabled,
                "ticketing_system": config.ticketing_config.system_type.value,
                "dry_run": config.dry_run,
                "advanced_detection": config.use_advanced_detection,
                "apply_templates": config.apply_templates,
                "update_spec_files": config.update_spec_with_links,
                "max_issues": config.max_issues_per_spec,
                "team_id": getattr(config.ticketing_config, 'team_id', None),
                "repository": f"{getattr(config.ticketing_config, 'repository_owner', '')}/{getattr(config.ticketing_config, 'repository_name', '')}" if hasattr(config.ticketing_config, 'repository_owner') else None
            }
            
        except Exception as e:
            return {
                "valid": False,
                "error": str(e),
                "enabled": False
            }
    
    async def create_sample_configuration(self, output_path: str, system_type: str = "linear") -> bool:
        """Create a sample configuration file."""
        try:
            if system_type == "linear":
                sample_config = {
                    "automatic_issue_creation": {
                        "enabled": True,
                        "dry_run": False,
                        "default_ticketing_system": "linear",
                        "use_advanced_detection": True,
                        "apply_templates": True,
                        "update_spec_with_links": True,
                        "create_summary_report": True
                    },
                    "ticketing_systems": {
                        "linear": {
                            "system_type": "linear",
                            "team_id": "TEAM-123",
                            "default_assignee": "@product-owner",
                            "default_labels": ["auto-generated", "specification"]
                        }
                    },
                    "templates": {
                        "epic": {
                            "title_prefix": "[EPIC]",
                            "labels": ["epic", "planning"],
                            "default_assignee": "@product-owner"
                        },
                        "feature": {
                            "title_prefix": "[FEATURE]", 
                            "labels": ["feature", "development"],
                            "default_assignee": "@tech-lead"
                        }
                    }
                }
            
            elif system_type == "github":
                sample_config = {
                    "automatic_issue_creation": {
                        "enabled": True,
                        "dry_run": False,
                        "default_ticketing_system": "github"
                    },
                    "ticketing_systems": {
                        "github": {
                            "system_type": "github",
                            "repository_owner": "your-org",
                            "repository_name": "your-repo",
                            "default_labels": ["auto-generated", "specification"]
                        }
                    }
                }
            
            # Write configuration file
            output_path = Path(output_path)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            
            with open(output_path, 'w') as f:
                if output_path.suffix.lower() in ['.yml', '.yaml']:
                    import yaml
                    yaml.safe_dump(sample_config, f, indent=2)
                else:
                    json.dump(sample_config, f, indent=2)
            
            self.logger.info(f"Created sample configuration: {output_path}")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to create sample configuration: {e}")
            return False


# Integration function for /create-spec command

async def execute_automatic_issue_creation(spec_file_path: str, config_override: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Main entry point for automatic issue creation in /create-spec workflow.
    
    This function is called from the /create-spec command during Phase 2.5.
    
    Args:
        spec_file_path: Path to the specification file
        config_override: Optional configuration overrides
        
    Returns:
        Execution results dictionary
    """
    integration = CreateSpecIntegration()
    return await integration.execute_phase_25(spec_file_path, config_override)


# Configuration utilities

async def check_issue_creation_config(spec_dir: Optional[str] = None) -> Dict[str, Any]:
    """Check the configuration for automatic issue creation."""
    integration = CreateSpecIntegration()
    return await integration.check_configuration(spec_dir)


async def setup_issue_creation_config(output_dir: str, system_type: str = "linear") -> bool:
    """Set up automatic issue creation configuration."""
    integration = CreateSpecIntegration()
    
    config_file = Path(output_dir) / ".agent-os" / "config" / "issue-creation.yml"
    return await integration.create_sample_configuration(str(config_file), system_type)


# Dry run functionality

async def preview_issue_creation(spec_file_path: str) -> Dict[str, Any]:
    """Preview what issues would be created without actually creating them."""
    config_override = {"automatic_issue_creation": {"dry_run": True}}
    
    integration = CreateSpecIntegration()
    return await integration.execute_phase_25(spec_file_path, config_override)