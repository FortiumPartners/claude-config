#!/usr/bin/env python3
"""
Vendor-neutral ticketing interface for automatic issue creation.

This module provides abstract interfaces and base classes for integrating
with different ticketing systems (Linear, GitHub Issues, etc.) through MCP.
"""

from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional, Union, Tuple
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime
from issue_spec import IssueSpec, IssueType, Priority, IssueHierarchy


class TicketingSystem(Enum):
    """Supported ticketing systems."""
    LINEAR = "linear"
    GITHUB = "github"
    JIRA = "jira"  # Future support
    AZURE_DEVOPS = "azure_devops"  # Future support


class IssueStatus(Enum):
    """Standard issue status across ticketing systems."""
    BACKLOG = "backlog"
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    IN_REVIEW = "in_review"
    DONE = "done"
    CANCELLED = "cancelled"


@dataclass
class TicketingSystemConfig:
    """Configuration for a ticketing system."""
    system_type: TicketingSystem
    team_id: Optional[str] = None
    project_id: Optional[str] = None
    repository_owner: Optional[str] = None
    repository_name: Optional[str] = None
    default_assignee: Optional[str] = None
    default_labels: List[str] = field(default_factory=list)
    api_endpoint: Optional[str] = None
    authentication: Dict[str, Any] = field(default_factory=dict)
    
    def __post_init__(self):
        """Validate configuration based on system type."""
        if self.system_type == TicketingSystem.LINEAR:
            if not self.team_id:
                raise ValueError("Linear integration requires team_id")
        
        elif self.system_type == TicketingSystem.GITHUB:
            if not self.repository_owner or not self.repository_name:
                raise ValueError("GitHub integration requires repository_owner and repository_name")


@dataclass
class CreatedIssue:
    """Information about a successfully created issue."""
    id: str
    number: Optional[Union[int, str]]
    url: str
    title: str
    system_type: TicketingSystem
    status: IssueStatus
    created_at: datetime
    assignee: Optional[str] = None
    labels: List[str] = field(default_factory=list)
    parent_id: Optional[str] = None
    children_ids: List[str] = field(default_factory=list)
    
    # Original spec reference
    original_spec: Optional[IssueSpec] = None


@dataclass
class IssueUpdateData:
    """Data for updating an existing issue."""
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[IssueStatus] = None
    assignee: Optional[str] = None
    labels: Optional[List[str]] = None
    priority: Optional[Priority] = None


@dataclass
class TicketingError:
    """Error information from ticketing operations."""
    error_code: str
    message: str
    details: Dict[str, Any] = field(default_factory=dict)
    recoverable: bool = True


class TicketingInterfaceException(Exception):
    """Base exception for ticketing interface errors."""
    
    def __init__(self, message: str, error: Optional[TicketingError] = None):
        super().__init__(message)
        self.error = error


class TicketingInterface(ABC):
    """
    Abstract interface for ticketing system integrations.
    
    Provides vendor-neutral methods for creating, updating, and managing
    issues across different ticketing systems.
    """
    
    def __init__(self, config: TicketingSystemConfig):
        self.config = config
        self.system_type = config.system_type
    
    @abstractmethod
    async def test_connection(self) -> bool:
        """Test connection to the ticketing system."""
        pass
    
    @abstractmethod
    async def create_issue(self, issue_spec: IssueSpec, parent_issue_id: Optional[str] = None) -> CreatedIssue:
        """
        Create a single issue from an IssueSpec.
        
        Args:
            issue_spec: The issue specification to create
            parent_issue_id: ID of parent issue for hierarchical relationships
            
        Returns:
            CreatedIssue with system-specific information
            
        Raises:
            TicketingInterfaceException: If issue creation fails
        """
        pass
    
    @abstractmethod
    async def create_issue_hierarchy(self, hierarchy: IssueHierarchy) -> List[CreatedIssue]:
        """
        Create a complete issue hierarchy, maintaining parent-child relationships.
        
        Args:
            hierarchy: The issue hierarchy to create
            
        Returns:
            List of created issues with proper relationships
            
        Raises:
            TicketingInterfaceException: If hierarchy creation fails
        """
        pass
    
    @abstractmethod
    async def update_issue(self, issue_id: str, update_data: IssueUpdateData) -> bool:
        """
        Update an existing issue.
        
        Args:
            issue_id: System-specific issue ID
            update_data: Data to update
            
        Returns:
            True if update successful
            
        Raises:
            TicketingInterfaceException: If update fails
        """
        pass
    
    @abstractmethod
    async def get_issue(self, issue_id: str) -> Optional[CreatedIssue]:
        """
        Get issue information by ID.
        
        Args:
            issue_id: System-specific issue ID
            
        Returns:
            CreatedIssue if found, None otherwise
        """
        pass
    
    @abstractmethod
    async def search_issues(self, query: str, limit: int = 50) -> List[CreatedIssue]:
        """
        Search for issues matching query.
        
        Args:
            query: Search query
            limit: Maximum number of results
            
        Returns:
            List of matching issues
        """
        pass
    
    @abstractmethod
    async def add_comment(self, issue_id: str, comment: str) -> bool:
        """
        Add a comment to an issue.
        
        Args:
            issue_id: System-specific issue ID
            comment: Comment text
            
        Returns:
            True if comment added successfully
        """
        pass
    
    @abstractmethod
    async def link_issues(self, parent_id: str, child_id: str) -> bool:
        """
        Create a parent-child relationship between issues.
        
        Args:
            parent_id: Parent issue ID
            child_id: Child issue ID
            
        Returns:
            True if link created successfully
        """
        pass
    
    @abstractmethod
    async def get_available_labels(self) -> List[str]:
        """Get list of available labels in the system."""
        pass
    
    @abstractmethod
    async def get_available_assignees(self) -> List[Dict[str, Any]]:
        """Get list of available assignees in the system."""
        pass
    
    # Helper methods that can be overridden
    
    def convert_issue_type(self, issue_type: IssueType) -> str:
        """Convert IssueSpec IssueType to system-specific type."""
        type_mapping = {
            IssueType.EPIC: "epic",
            IssueType.FEATURE: "feature",
            IssueType.BUG: "bug",
            IssueType.TASK: "task",
            IssueType.IMPROVEMENT: "improvement",
            IssueType.MAINTENANCE: "maintenance"
        }
        return type_mapping.get(issue_type, "feature")
    
    def convert_priority(self, priority: Priority) -> str:
        """Convert IssueSpec Priority to system-specific priority."""
        priority_mapping = {
            Priority.URGENT: "urgent",
            Priority.HIGH: "high",
            Priority.MEDIUM: "medium",
            Priority.LOW: "low",
            Priority.NONE: "none"
        }
        return priority_mapping.get(priority, "medium")
    
    def convert_status_from_system(self, system_status: str) -> IssueStatus:
        """Convert system-specific status to standard IssueStatus."""
        # Default implementation - should be overridden by specific integrations
        status_mapping = {
            "backlog": IssueStatus.BACKLOG,
            "todo": IssueStatus.TODO,
            "in progress": IssueStatus.IN_PROGRESS,
            "in review": IssueStatus.IN_REVIEW,
            "done": IssueStatus.DONE,
            "cancelled": IssueStatus.CANCELLED
        }
        return status_mapping.get(system_status.lower(), IssueStatus.TODO)
    
    def format_description(self, issue_spec: IssueSpec) -> str:
        """Format issue description for the ticketing system."""
        description_parts = []
        
        # Main description
        if issue_spec.description:
            description_parts.append(issue_spec.description)
        
        # Acceptance criteria
        if not issue_spec.acceptance_criteria.is_empty():
            description_parts.append("\n")
            description_parts.append(
                issue_spec.acceptance_criteria.format_for_ticketing_system(
                    self.system_type.value
                )
            )
        
        # Source information
        if issue_spec.spec_file:
            description_parts.append(f"\n---\n**Source:** {issue_spec.spec_file}")
            if issue_spec.source_section:
                description_parts.append(f" (Section: {issue_spec.source_section})")
        
        return "\n".join(description_parts)
    
    def generate_labels(self, issue_spec: IssueSpec) -> List[str]:
        """Generate appropriate labels for an issue."""
        labels = list(self.config.default_labels)  # Copy default labels
        
        # Add labels from spec
        labels.extend(issue_spec.labels)
        
        # Add type-based label
        labels.append(self.convert_issue_type(issue_spec.issue_type))
        
        # Add priority-based label if not default
        if issue_spec.priority != Priority.MEDIUM:
            labels.append(f"priority-{self.convert_priority(issue_spec.priority)}")
        
        # Remove duplicates while preserving order
        seen = set()
        unique_labels = []
        for label in labels:
            if label not in seen:
                unique_labels.append(label)
                seen.add(label)
        
        return unique_labels


class TicketingSystemFactory:
    """Factory for creating ticketing system integrations."""
    
    _integrations: Dict[TicketingSystem, type] = {}
    
    @classmethod
    def register_integration(cls, system_type: TicketingSystem, integration_class: type):
        """Register a ticketing system integration."""
        cls._integrations[system_type] = integration_class
    
    @classmethod
    def create_integration(cls, config: TicketingSystemConfig) -> TicketingInterface:
        """Create a ticketing system integration from config."""
        integration_class = cls._integrations.get(config.system_type)
        
        if not integration_class:
            raise ValueError(f"No integration registered for {config.system_type}")
        
        return integration_class(config)
    
    @classmethod
    def get_supported_systems(cls) -> List[TicketingSystem]:
        """Get list of supported ticketing systems."""
        return list(cls._integrations.keys())


# Utility functions for common operations

def create_config_from_dict(data: Dict[str, Any]) -> TicketingSystemConfig:
    """Create TicketingSystemConfig from dictionary."""
    system_type = TicketingSystem(data["system_type"])
    
    return TicketingSystemConfig(
        system_type=system_type,
        team_id=data.get("team_id"),
        project_id=data.get("project_id"),
        repository_owner=data.get("repository_owner"),
        repository_name=data.get("repository_name"),
        default_assignee=data.get("default_assignee"),
        default_labels=data.get("default_labels", []),
        api_endpoint=data.get("api_endpoint"),
        authentication=data.get("authentication", {})
    )


def validate_hierarchy_for_system(hierarchy: IssueHierarchy, system_type: TicketingSystem) -> List[str]:
    """Validate issue hierarchy for specific ticketing system limitations."""
    warnings = []
    
    if system_type == TicketingSystem.GITHUB:
        # GitHub Issues has limited hierarchy support
        max_depth = max(issue.get_depth() for issue in hierarchy.all_issues.values())
        if max_depth > 1:
            warnings.append("GitHub Issues has limited hierarchy support - consider flattening deep hierarchies")
    
    elif system_type == TicketingSystem.LINEAR:
        # Linear supports parent-child relationships well
        epics = hierarchy.get_epics()
        if len(epics) > 10:
            warnings.append("Consider breaking down large number of epics for better project management")
    
    return warnings