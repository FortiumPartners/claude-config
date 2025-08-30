#!/usr/bin/env python3
"""
Bidirectional linking system for specifications and issues.

This module manages the creation and maintenance of bidirectional links
between specification documents and their corresponding ticketing system issues.
"""

import re
import logging
from typing import List, Dict, Any, Optional, Tuple, Set
from dataclasses import dataclass, field
from pathlib import Path
from datetime import datetime
import json

from issue_spec import IssueSpec, IssueHierarchy
from ticketing_interface import CreatedIssue, TicketingInterface, TicketingSystem


@dataclass
class LinkMapping:
    """Represents a bidirectional link between spec and issue."""
    spec_id: str
    spec_section: str
    spec_file: str
    spec_line: Optional[int]
    issue_id: str
    issue_url: str
    issue_title: str
    system_type: TicketingSystem
    created_at: datetime
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "spec_id": self.spec_id,
            "spec_section": self.spec_section,
            "spec_file": self.spec_file,
            "spec_line": self.spec_line,
            "issue_id": self.issue_id,
            "issue_url": self.issue_url,
            "issue_title": self.issue_title,
            "system_type": self.system_type.value,
            "created_at": self.created_at.isoformat()
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'LinkMapping':
        """Create from dictionary."""
        return cls(
            spec_id=data["spec_id"],
            spec_section=data["spec_section"],
            spec_file=data["spec_file"],
            spec_line=data.get("spec_line"),
            issue_id=data["issue_id"],
            issue_url=data["issue_url"],
            issue_title=data["issue_title"],
            system_type=TicketingSystem(data["system_type"]),
            created_at=datetime.fromisoformat(data["created_at"])
        )


@dataclass
class LinkingConfig:
    """Configuration for bidirectional linking."""
    
    # Specification update options
    update_spec_files: bool = True
    link_format: str = "markdown"  # markdown, comment, metadata
    link_position: str = "after_header"  # after_header, before_content, end_of_section
    
    # Issue update options
    update_issues: bool = True
    add_spec_references: bool = True
    add_hierarchy_comments: bool = True
    
    # Link management
    preserve_existing_links: bool = True
    track_link_history: bool = True
    link_index_file: Optional[str] = None
    
    # Formatting options
    system_name_mapping: Dict[TicketingSystem, str] = field(default_factory=lambda: {
        TicketingSystem.LINEAR: "Linear",
        TicketingSystem.GITHUB: "GitHub Issues"
    })


class BidirectionalLinker:
    """
    Manages bidirectional links between specifications and issues.
    
    Capabilities:
    1. Update specifications with issue links
    2. Update issues with specification references
    3. Maintain link mappings and history
    4. Handle link synchronization and updates
    """
    
    def __init__(self, config: LinkingConfig = None):
        self.config = config or LinkingConfig()
        self.logger = logging.getLogger(__name__)
        
        # Link mappings storage
        self.link_mappings: List[LinkMapping] = []
        self.link_index_path = self._get_link_index_path()
        
        # Load existing links
        self._load_existing_links()
    
    def _get_link_index_path(self) -> Optional[Path]:
        """Get path for link index file."""
        if self.config.link_index_file:
            return Path(self.config.link_index_file)
        return None
    
    def _load_existing_links(self):
        """Load existing link mappings from index file."""
        if not self.link_index_path or not self.link_index_path.exists():
            return
        
        try:
            with open(self.link_index_path, 'r') as f:
                data = json.load(f)
            
            self.link_mappings = [
                LinkMapping.from_dict(link_data)
                for link_data in data.get("links", [])
            ]
            
            self.logger.info(f"Loaded {len(self.link_mappings)} existing link mappings")
            
        except Exception as e:
            self.logger.warning(f"Failed to load existing links: {e}")
    
    def _save_link_mappings(self):
        """Save link mappings to index file."""
        if not self.link_index_path or not self.config.track_link_history:
            return
        
        try:
            # Ensure directory exists
            self.link_index_path.parent.mkdir(parents=True, exist_ok=True)
            
            data = {
                "metadata": {
                    "last_updated": datetime.now().isoformat(),
                    "total_links": len(self.link_mappings)
                },
                "links": [mapping.to_dict() for mapping in self.link_mappings]
            }
            
            with open(self.link_index_path, 'w') as f:
                json.dump(data, f, indent=2)
            
            self.logger.debug(f"Saved {len(self.link_mappings)} link mappings")
            
        except Exception as e:
            self.logger.warning(f"Failed to save link mappings: {e}")
    
    async def create_bidirectional_links(self, spec_file: str, created_issues: List[CreatedIssue],
                                       hierarchy: IssueHierarchy, 
                                       ticketing_interface: Optional[TicketingInterface] = None) -> bool:
        """
        Create bidirectional links between specification and created issues.
        
        Args:
            spec_file: Path to the specification file
            created_issues: List of created issues
            hierarchy: Original issue hierarchy
            ticketing_interface: Optional interface for updating issues
            
        Returns:
            True if linking was successful
        """
        try:
            self.logger.info(f"Creating bidirectional links for {len(created_issues)} issues")
            
            # Create link mappings
            new_mappings = self._create_link_mappings(spec_file, created_issues, hierarchy)
            
            # Update specification file
            if self.config.update_spec_files:
                spec_updated = await self._update_specification_with_links(spec_file, new_mappings)
                if not spec_updated:
                    self.logger.warning("Failed to update specification with issue links")
            
            # Update issues with spec references
            if self.config.update_issues and ticketing_interface:
                issues_updated = await self._update_issues_with_spec_references(
                    new_mappings, ticketing_interface
                )
                self.logger.info(f"Updated {issues_updated} issues with spec references")
            
            # Store mappings
            if self.config.preserve_existing_links:
                self.link_mappings.extend(new_mappings)
                self._save_link_mappings()
            
            self.logger.info(f"Successfully created {len(new_mappings)} bidirectional links")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to create bidirectional links: {e}")
            return False
    
    def _create_link_mappings(self, spec_file: str, created_issues: List[CreatedIssue],
                            hierarchy: IssueHierarchy) -> List[LinkMapping]:
        """Create link mapping objects."""
        mappings = []
        
        for created_issue in created_issues:
            if not created_issue.original_spec:
                continue
            
            original_spec = created_issue.original_spec
            
            mapping = LinkMapping(
                spec_id=original_spec.id,
                spec_section=original_spec.source_section or original_spec.title,
                spec_file=spec_file,
                spec_line=original_spec.source_line,
                issue_id=created_issue.id,
                issue_url=created_issue.url,
                issue_title=created_issue.title,
                system_type=created_issue.system_type,
                created_at=created_issue.created_at
            )
            
            mappings.append(mapping)
        
        return mappings
    
    async def _update_specification_with_links(self, spec_file: str, 
                                             mappings: List[LinkMapping]) -> bool:
        """Update specification file with issue links."""
        try:
            spec_path = Path(spec_file)
            
            # Read current content
            with open(spec_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Insert links based on configuration
            updated_content = self._insert_links_in_content(content, mappings)
            
            # Write updated content if changed
            if updated_content != content:
                # Create backup if not in dry run mode
                backup_path = spec_path.with_suffix(f"{spec_path.suffix}.backup.{int(datetime.now().timestamp())}")
                with open(backup_path, 'w', encoding='utf-8') as f:
                    f.write(content)
                
                # Write updated content
                with open(spec_path, 'w', encoding='utf-8') as f:
                    f.write(updated_content)
                
                self.logger.info(f"Updated specification {spec_path} with issue links (backup: {backup_path})")
                return True
            
            return False
            
        except Exception as e:
            self.logger.error(f"Failed to update specification {spec_file}: {e}")
            return False
    
    def _insert_links_in_content(self, content: str, mappings: List[LinkMapping]) -> str:
        """Insert issue links into specification content."""
        lines = content.split('\n')
        updated_lines = []
        
        # Create mapping from section titles to links
        section_to_links = {}
        for mapping in mappings:
            section = mapping.spec_section
            if section not in section_to_links:
                section_to_links[section] = []
            section_to_links[section].append(mapping)
        
        i = 0
        while i < len(lines):
            line = lines[i]
            updated_lines.append(line)
            
            # Check for headers that match our sections
            header_match = re.match(r'^(#{1,6})\s+(.+)$', line)
            if header_match:
                header_level = len(header_match.group(1))
                header_title = header_match.group(2).strip()
                
                # Check if this header has associated links
                if header_title in section_to_links:
                    links = section_to_links[header_title]
                    
                    # Insert links based on position configuration
                    if self.config.link_position == "after_header":
                        link_lines = self._format_issue_links(links)
                        updated_lines.extend(link_lines)
                    
                    # Mark as processed
                    del section_to_links[header_title]
            
            i += 1
        
        # Handle any remaining unmatched sections
        if section_to_links and self.config.link_position == "end_of_section":
            updated_lines.append("\n## Issue Links\n")
            for section, links in section_to_links.items():
                updated_lines.append(f"### {section}")
                link_lines = self._format_issue_links(links)
                updated_lines.extend(link_lines)
        
        return '\n'.join(updated_lines)
    
    def _format_issue_links(self, mappings: List[LinkMapping]) -> List[str]:
        """Format issue links for insertion into specification."""
        if not mappings:
            return []
        
        lines = []
        
        if self.config.link_format == "markdown":
            lines.append("")  # Empty line before links
            
            for mapping in mappings:
                system_name = self.config.system_name_mapping.get(
                    mapping.system_type, 
                    mapping.system_type.value.title()
                )
                
                if mapping.system_type == TicketingSystem.GITHUB:
                    # GitHub uses issue numbers
                    link_text = f"#{mapping.issue_id}"
                else:
                    # Other systems use IDs
                    link_text = mapping.issue_id
                
                link_line = f"> **{system_name} Issue**: [{link_text}]({mapping.issue_url}) - {mapping.issue_title}"
                lines.append(link_line)
        
        elif self.config.link_format == "comment":
            lines.append("")
            lines.append("<!-- Issue Links -->")
            for mapping in mappings:
                comment = f"<!-- {mapping.system_type.value}: {mapping.issue_id} - {mapping.issue_url} -->"
                lines.append(comment)
        
        elif self.config.link_format == "metadata":
            lines.append("")
            lines.append("**Related Issues:**")
            for mapping in mappings:
                system_name = self.config.system_name_mapping.get(
                    mapping.system_type,
                    mapping.system_type.value.title()
                )
                meta_line = f"- {system_name}: [{mapping.issue_id}]({mapping.issue_url})"
                lines.append(meta_line)
        
        return lines
    
    async def _update_issues_with_spec_references(self, mappings: List[LinkMapping],
                                                ticketing_interface: TicketingInterface) -> int:
        """Update issues with references back to specification."""
        updated_count = 0
        
        for mapping in mappings:
            try:
                # Create spec reference comment
                comment = self._create_spec_reference_comment(mapping)
                
                # Add comment to issue
                success = await ticketing_interface.add_comment(mapping.issue_id, comment)
                
                if success:
                    updated_count += 1
                    self.logger.debug(f"Added spec reference to issue {mapping.issue_id}")
                else:
                    self.logger.warning(f"Failed to add spec reference to issue {mapping.issue_id}")
                
            except Exception as e:
                self.logger.warning(f"Failed to update issue {mapping.issue_id} with spec reference: {e}")
        
        return updated_count
    
    def _create_spec_reference_comment(self, mapping: LinkMapping) -> str:
        """Create a comment with specification reference."""
        comment_parts = [
            "## Specification Reference",
            "",
            f"**Source Document**: `{Path(mapping.spec_file).name}`",
            f"**Section**: {mapping.spec_section}"
        ]
        
        if mapping.spec_line:
            comment_parts.append(f"**Line**: {mapping.spec_line}")
        
        # Add file path if it's a relative or identifiable path
        spec_path = Path(mapping.spec_file)
        if not spec_path.is_absolute() or spec_path.parts[0] in ['.', '..']:
            comment_parts.append(f"**Path**: {mapping.spec_file}")
        
        comment_parts.extend([
            "",
            "*This issue was automatically generated from the specification.*"
        ])
        
        return "\n".join(comment_parts)
    
    async def update_existing_links(self, spec_file: str, ticketing_interface: TicketingInterface) -> Dict[str, Any]:
        """Update existing links and verify they're still valid."""
        results = {
            "updated": 0,
            "verified": 0,
            "broken": 0,
            "errors": []
        }
        
        # Find mappings for this spec file
        relevant_mappings = [
            mapping for mapping in self.link_mappings
            if mapping.spec_file == spec_file
        ]
        
        if not relevant_mappings:
            self.logger.info(f"No existing links found for {spec_file}")
            return results
        
        self.logger.info(f"Updating {len(relevant_mappings)} existing links for {spec_file}")
        
        # Verify each link
        for mapping in relevant_mappings:
            try:
                # Check if issue still exists
                issue = await ticketing_interface.get_issue(mapping.issue_id)
                
                if issue:
                    results["verified"] += 1
                    
                    # Update issue if needed (e.g., if spec changed)
                    if self.config.update_issues:
                        comment = f"Specification updated: {datetime.now().isoformat()}"
                        await ticketing_interface.add_comment(mapping.issue_id, comment)
                        results["updated"] += 1
                else:
                    results["broken"] += 1
                    self.logger.warning(f"Issue {mapping.issue_id} no longer exists")
                
            except Exception as e:
                results["errors"].append({
                    "issue_id": mapping.issue_id,
                    "error": str(e)
                })
                self.logger.error(f"Failed to verify link for issue {mapping.issue_id}: {e}")
        
        return results
    
    def get_links_for_spec(self, spec_file: str) -> List[LinkMapping]:
        """Get all links associated with a specification file."""
        return [
            mapping for mapping in self.link_mappings
            if mapping.spec_file == spec_file
        ]
    
    def get_links_for_issue(self, issue_id: str) -> List[LinkMapping]:
        """Get all links associated with an issue."""
        return [
            mapping for mapping in self.link_mappings
            if mapping.issue_id == issue_id
        ]
    
    def remove_links_for_spec(self, spec_file: str) -> int:
        """Remove all links for a specification file."""
        original_count = len(self.link_mappings)
        self.link_mappings = [
            mapping for mapping in self.link_mappings
            if mapping.spec_file != spec_file
        ]
        removed_count = original_count - len(self.link_mappings)
        
        if removed_count > 0:
            self._save_link_mappings()
            self.logger.info(f"Removed {removed_count} links for {spec_file}")
        
        return removed_count
    
    def get_linking_summary(self) -> Dict[str, Any]:
        """Get a summary of all tracked links."""
        # Group by system type
        by_system = {}
        for mapping in self.link_mappings:
            system = mapping.system_type.value
            if system not in by_system:
                by_system[system] = 0
            by_system[system] += 1
        
        # Group by spec file
        by_spec = {}
        for mapping in self.link_mappings:
            spec = Path(mapping.spec_file).name
            if spec not in by_spec:
                by_spec[spec] = 0
            by_spec[spec] += 1
        
        return {
            "total_links": len(self.link_mappings),
            "by_system": by_system,
            "by_spec_file": by_spec,
            "oldest_link": min((m.created_at for m in self.link_mappings), default=None),
            "newest_link": max((m.created_at for m in self.link_mappings), default=None)
        }


# Utility functions

def create_default_linking_config(system_type: TicketingSystem) -> LinkingConfig:
    """Create a default linking configuration for a ticketing system."""
    config = LinkingConfig()
    
    if system_type == TicketingSystem.LINEAR:
        # Linear supports rich markdown in comments
        config.link_format = "markdown"
        config.add_hierarchy_comments = True
    
    elif system_type == TicketingSystem.GITHUB:
        # GitHub has good markdown support
        config.link_format = "markdown"
        config.link_position = "after_header"
    
    return config


async def create_bidirectional_links_simple(spec_file: str, created_issues: List[CreatedIssue],
                                          hierarchy: IssueHierarchy,
                                          system_type: TicketingSystem,
                                          ticketing_interface: Optional[TicketingInterface] = None) -> bool:
    """Simple function to create bidirectional links with default configuration."""
    config = create_default_linking_config(system_type)
    linker = BidirectionalLinker(config)
    
    return await linker.create_bidirectional_links(
        spec_file, created_issues, hierarchy, ticketing_interface
    )