#!/usr/bin/env python3
"""
GitHub Issues MCP integration for automatic issue creation.

This module provides GitHub-specific implementation of the TicketingInterface
using Claude Code's GitHub MCP server.
"""

import asyncio
from typing import List, Dict, Any, Optional, Union, Tuple
from datetime import datetime, timezone
from dataclasses import dataclass, field

from ticketing_interface import (
    TicketingInterface, TicketingSystemConfig, TicketingSystem,
    CreatedIssue, IssueUpdateData, IssueStatus, TicketingInterfaceException,
    TicketingError, TicketingSystemFactory
)
from issue_spec import IssueSpec, IssueType, Priority, IssueHierarchy


@dataclass
class GitHubIssueData:
    """GitHub-specific issue data structure."""
    id: int
    number: int
    title: str
    body: str
    state: str
    assignee: Optional[Dict[str, Any]]
    assignees: List[Dict[str, Any]]
    labels: List[Dict[str, Any]]
    html_url: str
    created_at: str
    updated_at: str
    milestone: Optional[Dict[str, Any]] = None


class GitHubIntegration(TicketingInterface):
    """
    GitHub Issues-specific implementation using MCP server.
    
    Integrates with GitHub Issues through Claude Code's GitHub MCP server to provide
    issue creation and management.
    """
    
    def __init__(self, config: TicketingSystemConfig):
        super().__init__(config)
        
        if config.system_type != TicketingSystem.GITHUB:
            raise ValueError("GitHubIntegration requires GITHUB system type")
        
        # GitHub-specific configuration validation
        if not config.repository_owner or not config.repository_name:
            raise ValueError("GitHub integration requires repository_owner and repository_name")
        
        # Map GitHub states to our standard states
        self.github_state_mapping = {
            "open": IssueStatus.TODO,
            "closed": IssueStatus.DONE
        }
        
        # Reverse mapping for status updates
        self.status_to_github_mapping = {
            IssueStatus.BACKLOG: "open",
            IssueStatus.TODO: "open", 
            IssueStatus.IN_PROGRESS: "open",  # GitHub doesn't distinguish between these
            IssueStatus.IN_REVIEW: "open",
            IssueStatus.DONE: "closed",
            IssueStatus.CANCELLED: "closed"
        }
        
        # GitHub label conventions for issue types and priorities
        self.type_label_mapping = {
            IssueType.EPIC: "epic",
            IssueType.FEATURE: "enhancement", 
            IssueType.BUG: "bug",
            IssueType.TASK: "task",
            IssueType.IMPROVEMENT: "enhancement",
            IssueType.MAINTENANCE: "maintenance"
        }
        
        self.priority_label_mapping = {
            Priority.URGENT: "priority: urgent",
            Priority.HIGH: "priority: high", 
            Priority.MEDIUM: "priority: medium",
            Priority.LOW: "priority: low"
        }
    
    async def test_connection(self) -> bool:
        """Test connection to GitHub API."""
        try:
            # Try to list issues to test connectivity
            result = await self._call_github_mcp("list_issues", {
                "owner": self.config.repository_owner,
                "repo": self.config.repository_name,
                "per_page": 1
            })
            return result is not None
        except Exception as e:
            return False
    
    async def create_issue(self, issue_spec: IssueSpec, parent_issue_id: Optional[str] = None) -> CreatedIssue:
        """Create a single issue in GitHub."""
        try:
            # Prepare issue data for GitHub
            issue_data = {
                "owner": self.config.repository_owner,
                "repo": self.config.repository_name,
                "title": self._format_title_with_hierarchy(issue_spec, parent_issue_id),
                "body": self.format_description(issue_spec, parent_issue_id)
            }
            
            # Add assignee if specified
            if issue_spec.assignee:
                issue_data["assignees"] = [issue_spec.assignee]
            elif self.config.default_assignee:
                issue_data["assignees"] = [self.config.default_assignee]
            
            # Add labels
            labels = self.generate_labels(issue_spec)
            if labels:
                issue_data["labels"] = labels
            
            # Create the issue
            result = await self._call_github_mcp("create_issue", issue_data)
            
            if not result or "id" not in result:
                raise TicketingInterfaceException(
                    f"Failed to create GitHub issue: {issue_spec.title}",
                    TicketingError("creation_failed", "Invalid response from GitHub API")
                )
            
            created_issue = await self._convert_github_to_created_issue(result, issue_spec)
            
            # Add parent-child relationship comment if this is a child issue
            if parent_issue_id:
                await self._add_hierarchy_comments(created_issue.id, parent_issue_id, True)
            
            return created_issue
            
        except Exception as e:
            if isinstance(e, TicketingInterfaceException):
                raise
            raise TicketingInterfaceException(
                f"Error creating GitHub issue: {str(e)}",
                TicketingError("api_error", str(e))
            )
    
    async def create_issue_hierarchy(self, hierarchy: IssueHierarchy) -> List[CreatedIssue]:
        """Create a complete issue hierarchy in GitHub."""
        created_issues = []
        issue_id_mapping = {}  # Map from IssueSpec.id to created issue number
        
        try:
            # Create issues in order: epics first, then stories, then tasks
            for root_issue in hierarchy.root_issues:
                created_root, child_mappings = await self._create_issue_subtree(
                    root_issue, None, issue_id_mapping
                )
                created_issues.append(created_root)
                created_issues.extend(child_mappings.values())
                issue_id_mapping.update({spec_id: issue.number for spec_id, issue in child_mappings.items()})
            
            # Add cross-references between related issues
            await self._add_hierarchy_cross_references(created_issues, hierarchy)
            
            return created_issues
            
        except Exception as e:
            raise TicketingInterfaceException(
                f"Failed to create issue hierarchy: {str(e)}",
                TicketingError("hierarchy_creation_failed", str(e), recoverable=False)
            )
    
    async def _create_issue_subtree(self, issue_spec: IssueSpec, parent_number: Optional[str],
                                  mapping: Dict[str, str]) -> Tuple[CreatedIssue, Dict[str, CreatedIssue]]:
        """Recursively create an issue and its children."""
        # Create the current issue
        created_issue = await self.create_issue(issue_spec, parent_number)
        mapping[issue_spec.id] = str(created_issue.number)
        
        # Create children
        child_issues = {}
        for child_spec in issue_spec.children:
            child_created, grandchild_mappings = await self._create_issue_subtree(
                child_spec, str(created_issue.number), mapping
            )
            child_issues[child_spec.id] = child_created
            child_issues.update(grandchild_mappings)
        
        return created_issue, child_issues
    
    async def update_issue(self, issue_id: str, update_data: IssueUpdateData) -> bool:
        """Update an existing GitHub issue."""
        try:
            github_updates = {
                "owner": self.config.repository_owner,
                "repo": self.config.repository_name,
                "issue_number": int(issue_id)
            }
            
            if update_data.title:
                github_updates["title"] = update_data.title
            
            if update_data.description:
                github_updates["body"] = update_data.description
            
            if update_data.status:
                github_state = self.status_to_github_mapping.get(update_data.status, "open")
                github_updates["state"] = github_state
            
            if update_data.assignee:
                github_updates["assignees"] = [update_data.assignee]
            
            if update_data.labels:
                github_updates["labels"] = update_data.labels
            
            result = await self._call_github_mcp("update_issue", github_updates)
            return result is not None
            
        except Exception as e:
            raise TicketingInterfaceException(
                f"Failed to update GitHub issue {issue_id}: {str(e)}",
                TicketingError("update_failed", str(e))
            )
    
    async def get_issue(self, issue_id: str) -> Optional[CreatedIssue]:
        """Get issue information from GitHub."""
        try:
            result = await self._call_github_mcp("get_issue", {
                "owner": self.config.repository_owner,
                "repo": self.config.repository_name,
                "issue_number": int(issue_id)
            })
            
            if result:
                return await self._convert_github_to_created_issue(result)
            
            return None
            
        except Exception:
            return None
    
    async def search_issues(self, query: str, limit: int = 50) -> List[CreatedIssue]:
        """Search for issues in GitHub."""
        try:
            # GitHub search query format
            search_query = f"{query} repo:{self.config.repository_owner}/{self.config.repository_name}"
            
            result = await self._call_github_mcp("search_issues", {
                "q": search_query,
                "per_page": limit
            })
            
            issues = []
            if result and "items" in result:
                for github_issue in result["items"]:
                    try:
                        created_issue = await self._convert_github_to_created_issue(github_issue)
                        issues.append(created_issue)
                    except Exception:
                        continue  # Skip problematic issues
            
            return issues
            
        except Exception as e:
            raise TicketingInterfaceException(
                f"Failed to search GitHub issues: {str(e)}",
                TicketingError("search_failed", str(e))
            )
    
    async def add_comment(self, issue_id: str, comment: str) -> bool:
        """Add a comment to a GitHub issue."""
        try:
            result = await self._call_github_mcp("add_issue_comment", {
                "owner": self.config.repository_owner,
                "repo": self.config.repository_name,
                "issue_number": int(issue_id),
                "body": comment
            })
            return result is not None
            
        except Exception as e:
            return False
    
    async def link_issues(self, parent_id: str, child_id: str) -> bool:
        """Create parent-child relationship through comments in GitHub."""
        try:
            # Add comments to both issues to establish relationship
            parent_success = await self.add_comment(
                parent_id,
                f"Child issue: #{child_id}"
            )
            
            child_success = await self.add_comment(
                child_id,
                f"Parent issue: #{parent_id}"
            )
            
            return parent_success and child_success
            
        except Exception:
            return False
    
    async def get_available_labels(self) -> List[str]:
        """Get available labels in GitHub repository."""
        try:
            result = await self._call_github_mcp("list_labels", {
                "owner": self.config.repository_owner,
                "repo": self.config.repository_name
            })
            
            if result:
                return [label["name"] for label in result]
            
            return []
            
        except Exception:
            return []
    
    async def get_available_assignees(self) -> List[Dict[str, Any]]:
        """Get available assignees in GitHub repository."""
        try:
            result = await self._call_github_mcp("list_assignees", {
                "owner": self.config.repository_owner,
                "repo": self.config.repository_name
            })
            
            if result:
                return [
                    {"id": user["id"], "login": user["login"], "name": user.get("name", user["login"])}
                    for user in result
                ]
            
            return []
            
        except Exception:
            return []
    
    # GitHub-specific helper methods
    
    async def _call_github_mcp(self, method: str, params: Dict[str, Any]) -> Any:
        """Call GitHub MCP server method."""
        # In a real implementation, this would use Claude Code's MCP client
        # For now, we'll simulate the call structure
        
        # This would be something like:
        # return await claude_code.mcp.call("github", method, params)
        
        # Simulation for development - replace with actual MCP calls
        raise NotImplementedError(
            f"MCP call to GitHub not yet implemented: {method} with {params}. "
            "This needs to be connected to Claude Code's GitHub MCP server."
        )
    
    async def _convert_github_to_created_issue(self, github_data: Dict[str, Any],
                                             original_spec: Optional[IssueSpec] = None) -> CreatedIssue:
        """Convert GitHub API response to CreatedIssue."""
        # Parse GitHub's datetime format
        created_at = datetime.fromisoformat(
            github_data.get("created_at", datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')).replace('Z', '+00:00')
        )
        
        # Extract assignee (GitHub can have multiple assignees)
        assignee = None
        if github_data.get("assignee"):
            assignee = github_data["assignee"]["login"]
        elif github_data.get("assignees") and len(github_data["assignees"]) > 0:
            assignee = github_data["assignees"][0]["login"]
        
        # Extract labels
        labels = []
        if github_data.get("labels"):
            labels = [label["name"] for label in github_data["labels"]]
        
        # Convert state to standard status
        state = github_data.get("state", "open").lower()
        status = self.github_state_mapping.get(state, IssueStatus.TODO)
        
        return CreatedIssue(
            id=str(github_data["number"]),  # Use number as ID for GitHub
            number=github_data["number"],
            url=github_data.get("html_url", ""),
            title=github_data.get("title", ""),
            system_type=TicketingSystem.GITHUB,
            status=status,
            created_at=created_at,
            assignee=assignee,
            labels=labels,
            parent_id=None,  # GitHub doesn't have native parent-child relationships
            children_ids=[],
            original_spec=original_spec
        )
    
    def _format_title_with_hierarchy(self, issue_spec: IssueSpec, parent_number: Optional[str]) -> str:
        """Format issue title with hierarchy indicators for GitHub."""
        title = issue_spec.title
        
        # Add type prefix for clarity
        type_prefix = {
            IssueType.EPIC: "[EPIC]",
            IssueType.FEATURE: "[FEATURE]", 
            IssueType.BUG: "[BUG]",
            IssueType.TASK: "[TASK]",
            IssueType.IMPROVEMENT: "[IMPROVEMENT]",
            IssueType.MAINTENANCE: "[MAINTENANCE]"
        }
        
        prefix = type_prefix.get(issue_spec.issue_type, "")
        if prefix:
            title = f"{prefix} {title}"
        
        # Add parent reference if this is a child issue
        if parent_number:
            title = f"{title} (Child of #{parent_number})"
        
        return title
    
    def format_description(self, issue_spec: IssueSpec, parent_issue_number: Optional[str] = None) -> str:
        """Format issue description for GitHub."""
        description_parts = []
        
        # Main description
        if issue_spec.description:
            description_parts.append(issue_spec.description)
        
        # Add hierarchy information
        if parent_issue_number:
            description_parts.append(f"\n**Parent Issue:** #{parent_issue_number}")
        
        if issue_spec.children:
            description_parts.append("\n**Child Issues:**")
            for child in issue_spec.children:
                description_parts.append(f"- {child.title}")
        
        # Acceptance criteria (GitHub supports markdown)
        if not issue_spec.acceptance_criteria.is_empty():
            description_parts.append("\n## Acceptance Criteria")
            for i, criterion in enumerate(issue_spec.acceptance_criteria.criteria, 1):
                description_parts.append(f"- [ ] {criterion}")
        
        # Add metadata section
        metadata_parts = []
        metadata_parts.append(f"**Type:** {issue_spec.issue_type.value}")
        metadata_parts.append(f"**Priority:** {issue_spec.priority.value}")
        
        if issue_spec.estimate:
            metadata_parts.append(f"**Estimate:** {issue_spec.estimate} hours")
        
        description_parts.append("\n---")
        description_parts.append("**Metadata:**")
        description_parts.extend(metadata_parts)
        
        # Source information
        if issue_spec.spec_file:
            description_parts.append(f"\n**Source:** `{issue_spec.spec_file}`")
            if issue_spec.source_section:
                description_parts.append(f" (Section: {issue_spec.source_section})")
            if issue_spec.source_line:
                description_parts.append(f" (Line: {issue_spec.source_line})")
        
        description_parts.append("\n*Auto-generated from specification*")
        
        return "\n".join(description_parts)
    
    async def _add_hierarchy_comments(self, child_number: str, parent_number: str, is_child: bool):
        """Add hierarchy relationship comments."""
        if is_child:
            comment = f"This issue is a child of #{parent_number}"
            await self.add_comment(child_number, comment)
            
            # Also add to parent
            parent_comment = f"Child issue created: #{child_number}"
            await self.add_comment(parent_number, parent_comment)
    
    async def _add_hierarchy_cross_references(self, created_issues: List[CreatedIssue], hierarchy: IssueHierarchy):
        """Add cross-references between related issues after creation."""
        # Create a mapping from original spec ID to created issue
        spec_to_issue = {}
        for issue in created_issues:
            if issue.original_spec:
                spec_to_issue[issue.original_spec.id] = issue
        
        # Add comments for parent-child relationships
        for original_spec in hierarchy.all_issues.values():
            if original_spec.id in spec_to_issue:
                current_issue = spec_to_issue[original_spec.id]
                
                # Add children references
                if original_spec.children:
                    child_numbers = []
                    for child_spec in original_spec.children:
                        if child_spec.id in spec_to_issue:
                            child_numbers.append(str(spec_to_issue[child_spec.id].number))
                    
                    if child_numbers:
                        comment = "**Child Issues:**\n" + "\n".join([f"- #{num}" for num in child_numbers])
                        await self.add_comment(str(current_issue.number), comment)
    
    def generate_labels(self, issue_spec: IssueSpec) -> List[str]:
        """Generate GitHub-appropriate labels for an issue."""
        labels = list(self.config.default_labels)  # Copy default labels
        
        # Add labels from spec
        labels.extend(issue_spec.labels)
        
        # Add type-based label
        type_label = self.type_label_mapping.get(issue_spec.issue_type)
        if type_label:
            labels.append(type_label)
        
        # Add priority-based label if not default
        if issue_spec.priority != Priority.MEDIUM:
            priority_label = self.priority_label_mapping.get(issue_spec.priority)
            if priority_label:
                labels.append(priority_label)
        
        # Remove duplicates while preserving order
        seen = set()
        unique_labels = []
        for label in labels:
            if label not in seen:
                unique_labels.append(label)
                seen.add(label)
        
        return unique_labels
    
    def convert_issue_type(self, issue_type: IssueType) -> str:
        """Convert IssueSpec IssueType to GitHub label."""
        return self.type_label_mapping.get(issue_type, "enhancement")


# Register GitHub integration with factory
TicketingSystemFactory.register_integration(TicketingSystem.GITHUB, GitHubIntegration)