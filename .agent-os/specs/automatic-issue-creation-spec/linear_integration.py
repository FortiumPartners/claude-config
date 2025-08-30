#!/usr/bin/env python3
"""
Linear MCP integration for automatic issue creation.

This module provides Linear-specific implementation of the TicketingInterface
using Claude Code's Linear MCP server.
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
class LinearIssueData:
    """Linear-specific issue data structure."""
    id: str
    number: int
    title: str
    description: str
    state: Dict[str, Any]
    assignee: Optional[Dict[str, Any]]
    labels: List[Dict[str, Any]]
    team: Dict[str, Any]
    url: str
    created_at: str
    updated_at: str
    parent: Optional[Dict[str, Any]] = None
    children: List[Dict[str, Any]] = field(default_factory=list)


class LinearIntegration(TicketingInterface):
    """
    Linear-specific implementation using MCP server.
    
    Integrates with Linear through Claude Code's Linear MCP server to provide
    seamless issue creation and management.
    """
    
    def __init__(self, config: TicketingSystemConfig):
        super().__init__(config)
        
        if config.system_type != TicketingSystem.LINEAR:
            raise ValueError("LinearIntegration requires LINEAR system type")
        
        # Linear-specific configuration validation
        if not config.team_id:
            raise ValueError("Linear integration requires team_id")
        
        # Map Linear states to our standard states
        self.linear_state_mapping = {
            "backlog": IssueStatus.BACKLOG,
            "unstarted": IssueStatus.TODO,
            "started": IssueStatus.IN_PROGRESS,
            "completed": IssueStatus.DONE,
            "canceled": IssueStatus.CANCELLED
        }
        
        # Reverse mapping for status updates
        self.status_to_linear_mapping = {
            IssueStatus.BACKLOG: "backlog",
            IssueStatus.TODO: "unstarted",
            IssueStatus.IN_PROGRESS: "started",
            IssueStatus.DONE: "completed",
            IssueStatus.CANCELLED: "canceled"
        }
        
        # Linear priority mapping
        self.priority_to_linear_mapping = {
            Priority.URGENT: 1,
            Priority.HIGH: 2,
            Priority.MEDIUM: 3,
            Priority.LOW: 4,
            Priority.NONE: 0
        }
    
    async def test_connection(self) -> bool:
        """Test connection to Linear API."""
        try:
            # Try to search for a single issue to test connectivity
            result = await self._call_linear_mcp("linear_search_issues", {
                "teamId": self.config.team_id,
                "limit": 1
            })
            return result is not None
        except Exception as e:
            return False
    
    async def create_issue(self, issue_spec: IssueSpec, parent_issue_id: Optional[str] = None) -> CreatedIssue:
        """Create a single issue in Linear."""
        try:
            # Prepare issue data for Linear
            issue_data = {
                "teamId": self.config.team_id,
                "title": issue_spec.title,
                "description": self.format_description(issue_spec),
                "priority": self.priority_to_linear_mapping.get(issue_spec.priority, 3)
            }
            
            # Add assignee if specified
            if issue_spec.assignee or self.config.default_assignee:
                assignee = issue_spec.assignee or self.config.default_assignee
                issue_data["assigneeId"] = await self._resolve_assignee(assignee)
            
            # Add parent relationship if specified
            if parent_issue_id:
                issue_data["parentId"] = parent_issue_id
            
            # Create the issue
            result = await self._call_linear_mcp("linear_create_issue", issue_data)
            
            if not result or "id" not in result:
                raise TicketingInterfaceException(
                    f"Failed to create Linear issue: {issue_spec.title}",
                    TicketingError("creation_failed", "Invalid response from Linear API")
                )
            
            created_issue = await self._convert_linear_to_created_issue(result, issue_spec)
            
            # Add labels if specified
            if issue_spec.labels or self.config.default_labels:
                labels = self.generate_labels(issue_spec)
                await self._add_labels_to_issue(created_issue.id, labels)
            
            # Add comment with acceptance criteria if not in description
            if not issue_spec.acceptance_criteria.is_empty():
                criteria_comment = self._format_acceptance_criteria_comment(issue_spec)
                await self.add_comment(created_issue.id, criteria_comment)
            
            return created_issue
            
        except Exception as e:
            if isinstance(e, TicketingInterfaceException):
                raise
            raise TicketingInterfaceException(
                f"Error creating Linear issue: {str(e)}",
                TicketingError("api_error", str(e))
            )
    
    async def create_issue_hierarchy(self, hierarchy: IssueHierarchy) -> List[CreatedIssue]:
        """Create a complete issue hierarchy in Linear."""
        created_issues = []
        issue_id_mapping = {}  # Map from IssueSpec.id to created issue ID
        
        try:
            # Create issues in order: epics first, then stories, then tasks
            for root_issue in hierarchy.root_issues:
                created_root, child_mappings = await self._create_issue_subtree(
                    root_issue, None, issue_id_mapping
                )
                created_issues.append(created_root)
                created_issues.extend(child_mappings.values())
                issue_id_mapping.update(child_mappings)
            
            return created_issues
            
        except Exception as e:
            # If hierarchy creation fails, we might have partial state
            # In a production system, we'd want to implement cleanup/rollback
            raise TicketingInterfaceException(
                f"Failed to create issue hierarchy: {str(e)}",
                TicketingError("hierarchy_creation_failed", str(e), recoverable=False)
            )
    
    async def _create_issue_subtree(self, issue_spec: IssueSpec, parent_id: Optional[str], 
                                  mapping: Dict[str, str]) -> Tuple[CreatedIssue, Dict[str, CreatedIssue]]:
        """Recursively create an issue and its children."""
        # Create the current issue
        created_issue = await self.create_issue(issue_spec, parent_id)
        mapping[issue_spec.id] = created_issue.id
        
        # Create children
        child_issues = {}
        for child_spec in issue_spec.children:
            child_created, grandchild_mappings = await self._create_issue_subtree(
                child_spec, created_issue.id, mapping
            )
            child_issues[child_spec.id] = child_created
            child_issues.update(grandchild_mappings)
        
        # Update parent issue with child IDs
        created_issue.children_ids = [mapping[child.id] for child in issue_spec.children]
        
        return created_issue, child_issues
    
    async def update_issue(self, issue_id: str, update_data: IssueUpdateData) -> bool:
        """Update an existing Linear issue."""
        try:
            linear_updates = {}
            
            if update_data.title:
                linear_updates["title"] = update_data.title
            
            if update_data.description:
                linear_updates["description"] = update_data.description
            
            if update_data.status:
                linear_state = self.status_to_linear_mapping.get(update_data.status)
                if linear_state:
                    # In Linear, we need to get the state ID for the team
                    state_id = await self._get_state_id_for_name(linear_state)
                    if state_id:
                        linear_updates["stateId"] = state_id
            
            if update_data.assignee:
                assignee_id = await self._resolve_assignee(update_data.assignee)
                if assignee_id:
                    linear_updates["assigneeId"] = assignee_id
            
            if update_data.priority:
                linear_updates["priority"] = self.priority_to_linear_mapping.get(update_data.priority, 3)
            
            if linear_updates:
                result = await self._call_linear_mcp("linear_update_issue", {
                    "id": issue_id,
                    **linear_updates
                })
                return result is not None
            
            return True
            
        except Exception as e:
            raise TicketingInterfaceException(
                f"Failed to update Linear issue {issue_id}: {str(e)}",
                TicketingError("update_failed", str(e))
            )
    
    async def get_issue(self, issue_id: str) -> Optional[CreatedIssue]:
        """Get issue information from Linear."""
        try:
            # Linear MCP might not have a direct get_issue method
            # We'll use search to find the specific issue
            result = await self._call_linear_mcp("linear_search_issues", {
                "query": f"id:{issue_id}",
                "limit": 1
            })
            
            if result and len(result) > 0:
                linear_issue = result[0]
                return await self._convert_linear_to_created_issue(linear_issue)
            
            return None
            
        except Exception:
            return None
    
    async def search_issues(self, query: str, limit: int = 50) -> List[CreatedIssue]:
        """Search for issues in Linear."""
        try:
            result = await self._call_linear_mcp("linear_search_issues", {
                "teamId": self.config.team_id,
                "query": query,
                "limit": limit
            })
            
            issues = []
            if result:
                for linear_issue in result:
                    try:
                        created_issue = await self._convert_linear_to_created_issue(linear_issue)
                        issues.append(created_issue)
                    except Exception:
                        continue  # Skip problematic issues
            
            return issues
            
        except Exception as e:
            raise TicketingInterfaceException(
                f"Failed to search Linear issues: {str(e)}",
                TicketingError("search_failed", str(e))
            )
    
    async def add_comment(self, issue_id: str, comment: str) -> bool:
        """Add a comment to a Linear issue."""
        try:
            result = await self._call_linear_mcp("linear_add_comment", {
                "issueId": issue_id,
                "body": comment
            })
            return result is not None
            
        except Exception as e:
            # Comment failure shouldn't break the whole process
            return False
    
    async def link_issues(self, parent_id: str, child_id: str) -> bool:
        """Create parent-child relationship in Linear."""
        try:
            # In Linear, we update the child issue to have a parent
            result = await self._call_linear_mcp("linear_update_issue", {
                "id": child_id,
                "parentId": parent_id
            })
            return result is not None
            
        except Exception:
            return False
    
    async def get_available_labels(self) -> List[str]:
        """Get available labels in Linear team."""
        try:
            # Linear uses labels associated with teams
            # This would need to be implemented based on Linear's API
            # For now, return common labels
            return [
                "bug", "feature", "improvement", "task", "epic",
                "priority-high", "priority-medium", "priority-low",
                "frontend", "backend", "documentation", "testing"
            ]
        except Exception:
            return []
    
    async def get_available_assignees(self) -> List[Dict[str, Any]]:
        """Get available assignees in Linear team."""
        try:
            # This would require a Linear API call to get team members
            # For now, return empty list - assignees should be specified by email/username
            return []
        except Exception:
            return []
    
    # Linear-specific helper methods
    
    async def _call_linear_mcp(self, method: str, params: Dict[str, Any]) -> Any:
        """Call Linear MCP server method."""
        # In a real implementation, this would use Claude Code's MCP client
        # For now, we'll simulate the call structure
        
        # This would be something like:
        # return await claude_code.mcp.call("linear", method, params)
        
        # Simulation for development - replace with actual MCP calls
        raise NotImplementedError(
            f"MCP call to Linear not yet implemented: {method} with {params}. "
            "This needs to be connected to Claude Code's Linear MCP server."
        )
    
    async def _convert_linear_to_created_issue(self, linear_data: Dict[str, Any], 
                                             original_spec: Optional[IssueSpec] = None) -> CreatedIssue:
        """Convert Linear API response to CreatedIssue."""
        # Parse Linear's datetime format
        created_at = datetime.fromisoformat(
            linear_data.get("createdAt", datetime.now(timezone.utc).isoformat())
        )
        
        # Extract assignee
        assignee = None
        if linear_data.get("assignee"):
            assignee = linear_data["assignee"].get("email") or linear_data["assignee"].get("name")
        
        # Extract labels
        labels = []
        if linear_data.get("labels"):
            labels = [label.get("name", "") for label in linear_data["labels"]]
        
        # Convert state to standard status
        state_name = linear_data.get("state", {}).get("name", "").lower()
        status = self.linear_state_mapping.get(state_name, IssueStatus.TODO)
        
        # Extract parent and children IDs
        parent_id = None
        if linear_data.get("parent"):
            parent_id = linear_data["parent"].get("id")
        
        children_ids = []
        if linear_data.get("children"):
            children_ids = [child.get("id", "") for child in linear_data["children"]]
        
        return CreatedIssue(
            id=linear_data["id"],
            number=linear_data.get("number"),
            url=linear_data.get("url", ""),
            title=linear_data.get("title", ""),
            system_type=TicketingSystem.LINEAR,
            status=status,
            created_at=created_at,
            assignee=assignee,
            labels=labels,
            parent_id=parent_id,
            children_ids=children_ids,
            original_spec=original_spec
        )
    
    async def _resolve_assignee(self, assignee: str) -> Optional[str]:
        """Resolve assignee email/username to Linear user ID."""
        # In a real implementation, this would query Linear's users API
        # For now, assume the assignee string is already a valid Linear user ID
        return assignee
    
    async def _get_state_id_for_name(self, state_name: str) -> Optional[str]:
        """Get Linear state ID for a state name."""
        # This would query Linear's workflow states for the team
        # For now, return a placeholder
        state_mapping = {
            "backlog": "backlog-state-id",
            "unstarted": "unstarted-state-id", 
            "started": "started-state-id",
            "completed": "completed-state-id",
            "canceled": "canceled-state-id"
        }
        return state_mapping.get(state_name)
    
    async def _add_labels_to_issue(self, issue_id: str, labels: List[str]) -> bool:
        """Add labels to a Linear issue."""
        try:
            # In Linear, labels are usually added during issue creation or via update
            # This might require getting label IDs first, then updating the issue
            # For now, this is a placeholder
            return True
        except Exception:
            return False
    
    def _format_acceptance_criteria_comment(self, issue_spec: IssueSpec) -> str:
        """Format acceptance criteria as a Linear comment."""
        if issue_spec.acceptance_criteria.is_empty():
            return ""
        
        comment = "## Acceptance Criteria\n\n"
        for i, criterion in enumerate(issue_spec.acceptance_criteria.criteria, 1):
            comment += f"{i}. {criterion}\n"
        
        comment += f"\n---\n*Auto-generated from specification*"
        
        return comment
    
    def convert_issue_type(self, issue_type: IssueType) -> str:
        """Convert IssueSpec IssueType to Linear-specific type."""
        # Linear doesn't have strict issue types like GitHub, but we can use labels
        type_mapping = {
            IssueType.EPIC: "Epic",
            IssueType.FEATURE: "Feature",
            IssueType.BUG: "Bug", 
            IssueType.TASK: "Task",
            IssueType.IMPROVEMENT: "Improvement",
            IssueType.MAINTENANCE: "Maintenance"
        }
        return type_mapping.get(issue_type, "Feature")
    
    def format_description(self, issue_spec: IssueSpec) -> str:
        """Format issue description for Linear."""
        description_parts = []
        
        # Main description
        if issue_spec.description:
            description_parts.append(issue_spec.description)
        
        # Add type information
        description_parts.append(f"\n**Type:** {self.convert_issue_type(issue_spec.issue_type)}")
        
        # Add hierarchy information
        if issue_spec.parent:
            description_parts.append(f"**Parent:** {issue_spec.parent.title}")
        
        if issue_spec.children:
            child_titles = [child.title for child in issue_spec.children]
            description_parts.append(f"**Children:** {', '.join(child_titles)}")
        
        # Acceptance criteria (Linear supports markdown)
        if not issue_spec.acceptance_criteria.is_empty():
            description_parts.append("\n## Acceptance Criteria")
            for i, criterion in enumerate(issue_spec.acceptance_criteria.criteria, 1):
                description_parts.append(f"{i}. {criterion}")
        
        # Source information
        if issue_spec.spec_file:
            description_parts.append(f"\n---\n**Source:** {issue_spec.spec_file}")
            if issue_spec.source_section:
                description_parts.append(f" (Section: {issue_spec.source_section})")
            if issue_spec.source_line:
                description_parts.append(f" (Line: {issue_spec.source_line})")
        
        return "\n".join(description_parts)


# Register Linear integration with factory
TicketingSystemFactory.register_integration(TicketingSystem.LINEAR, LinearIntegration)