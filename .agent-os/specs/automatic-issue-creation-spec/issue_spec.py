#!/usr/bin/env python3
"""
IssueSpec data model with hierarchy support for automatic issue creation.

This module defines the data structures for representing issues extracted from
specifications, including hierarchical relationships between epics, stories, and tasks.
"""

from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field
from enum import Enum
import uuid


class IssueType(Enum):
    """Enumeration of supported issue types."""
    EPIC = "epic"
    FEATURE = "feature"
    BUG = "bug"
    TASK = "task"
    IMPROVEMENT = "improvement"
    MAINTENANCE = "maintenance"


class Priority(Enum):
    """Issue priority levels."""
    URGENT = "urgent"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    NONE = "none"


@dataclass
class AcceptanceCriteria:
    """Represents acceptance criteria for an issue."""
    criteria: List[str] = field(default_factory=list)
    
    def add_criterion(self, criterion: str) -> None:
        """Add a single acceptance criterion."""
        if criterion.strip():
            self.criteria.append(criterion.strip())
    
    def add_criteria(self, criteria: List[str]) -> None:
        """Add multiple acceptance criteria."""
        for criterion in criteria:
            self.add_criterion(criterion)
    
    def is_empty(self) -> bool:
        """Check if there are no acceptance criteria."""
        return len(self.criteria) == 0
    
    def format_for_ticketing_system(self, system: str = "linear") -> str:
        """Format acceptance criteria for specific ticketing system."""
        if self.is_empty():
            return ""
        
        if system.lower() == "linear":
            formatted = "## Acceptance Criteria\n\n"
            for i, criterion in enumerate(self.criteria, 1):
                formatted += f"{i}. {criterion}\n"
            return formatted
        
        elif system.lower() == "github":
            formatted = "## Acceptance Criteria\n\n"
            for criterion in self.criteria:
                formatted += f"- [ ] {criterion}\n"
            return formatted
        
        # Default markdown format
        formatted = "**Acceptance Criteria:**\n"
        for criterion in self.criteria:
            formatted += f"- {criterion}\n"
        return formatted


@dataclass
class IssueSpec:
    """
    Specification for an issue to be created in a ticketing system.
    
    Supports hierarchical relationships between issues (epic -> story -> task).
    """
    
    # Core issue properties
    title: str
    description: str = ""
    issue_type: IssueType = IssueType.FEATURE
    priority: Priority = Priority.MEDIUM
    
    # Hierarchical relationships
    parent: Optional['IssueSpec'] = None
    children: List['IssueSpec'] = field(default_factory=list)
    
    # Acceptance criteria
    acceptance_criteria: AcceptanceCriteria = field(default_factory=AcceptanceCriteria)
    
    # Metadata
    id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    labels: List[str] = field(default_factory=list)
    assignee: Optional[str] = None
    estimate: Optional[float] = None
    
    # Source tracking
    source_section: Optional[str] = None
    source_line: Optional[int] = None
    spec_file: Optional[str] = None
    
    def __post_init__(self):
        """Post-initialization processing."""
        # Ensure acceptance criteria is AcceptanceCriteria instance
        if not isinstance(self.acceptance_criteria, AcceptanceCriteria):
            if isinstance(self.acceptance_criteria, list):
                criteria = AcceptanceCriteria()
                criteria.add_criteria(self.acceptance_criteria)
                self.acceptance_criteria = criteria
            else:
                self.acceptance_criteria = AcceptanceCriteria()
    
    def add_child(self, child: 'IssueSpec') -> None:
        """Add a child issue and set this as its parent."""
        child.parent = self
        if child not in self.children:
            self.children.append(child)
    
    def remove_child(self, child: 'IssueSpec') -> bool:
        """Remove a child issue."""
        if child in self.children:
            child.parent = None
            self.children.remove(child)
            return True
        return False
    
    def get_root(self) -> 'IssueSpec':
        """Get the root issue in the hierarchy."""
        current = self
        while current.parent:
            current = current.parent
        return current
    
    def get_depth(self) -> int:
        """Get the depth of this issue in the hierarchy (0 = root)."""
        depth = 0
        current = self
        while current.parent:
            depth += 1
            current = current.parent
        return depth
    
    def get_all_descendants(self) -> List['IssueSpec']:
        """Get all descendant issues (children, grandchildren, etc.)."""
        descendants = []
        for child in self.children:
            descendants.append(child)
            descendants.extend(child.get_all_descendants())
        return descendants
    
    def is_epic(self) -> bool:
        """Check if this is an epic issue."""
        return self.issue_type == IssueType.EPIC
    
    def is_story(self) -> bool:
        """Check if this is a story/feature issue."""
        return self.issue_type in (IssueType.FEATURE, IssueType.BUG, IssueType.IMPROVEMENT)
    
    def is_task(self) -> bool:
        """Check if this is a task issue."""
        return self.issue_type == IssueType.TASK
    
    def get_hierarchy_path(self) -> str:
        """Get the full hierarchy path (e.g., 'Epic > Story > Task')."""
        path_parts = []
        current = self
        while current:
            path_parts.insert(0, current.title)
            current = current.parent
        return " > ".join(path_parts)
    
    def add_label(self, label: str) -> None:
        """Add a label if it doesn't already exist."""
        if label and label not in self.labels:
            self.labels.append(label)
    
    def add_labels(self, labels: List[str]) -> None:
        """Add multiple labels."""
        for label in labels:
            self.add_label(label)
    
    def set_estimate(self, hours: float) -> None:
        """Set time estimate in hours."""
        if hours > 0:
            self.estimate = hours
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'issue_type': self.issue_type.value,
            'priority': self.priority.value,
            'parent_id': self.parent.id if self.parent else None,
            'children_ids': [child.id for child in self.children],
            'acceptance_criteria': self.acceptance_criteria.criteria,
            'labels': self.labels,
            'assignee': self.assignee,
            'estimate': self.estimate,
            'source_section': self.source_section,
            'source_line': self.source_line,
            'spec_file': self.spec_file
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'IssueSpec':
        """Create IssueSpec from dictionary."""
        # Create acceptance criteria
        criteria = AcceptanceCriteria()
        if 'acceptance_criteria' in data:
            criteria.add_criteria(data['acceptance_criteria'])
        
        # Create the issue spec
        issue = cls(
            title=data.get('title', ''),
            description=data.get('description', ''),
            issue_type=IssueType(data.get('issue_type', 'feature')),
            priority=Priority(data.get('priority', 'medium')),
            acceptance_criteria=criteria,
            labels=data.get('labels', []),
            assignee=data.get('assignee'),
            estimate=data.get('estimate'),
            source_section=data.get('source_section'),
            source_line=data.get('source_line'),
            spec_file=data.get('spec_file')
        )
        
        # Set ID if provided
        if 'id' in data:
            issue.id = data['id']
            
        return issue
    
    def __str__(self) -> str:
        """String representation of the issue."""
        depth_indent = "  " * self.get_depth()
        return f"{depth_indent}[{self.issue_type.value.upper()}] {self.title}"
    
    def __repr__(self) -> str:
        """Detailed representation for debugging."""
        return (
            f"IssueSpec(id='{self.id}', title='{self.title}', "
            f"type={self.issue_type.value}, priority={self.priority.value}, "
            f"children={len(self.children)})"
        )


@dataclass
class IssueHierarchy:
    """
    Container for managing a complete issue hierarchy.
    
    Provides methods for organizing and querying issues by their relationships.
    """
    
    root_issues: List[IssueSpec] = field(default_factory=list)
    all_issues: Dict[str, IssueSpec] = field(default_factory=dict)
    
    def add_issue(self, issue: IssueSpec) -> None:
        """Add an issue to the hierarchy."""
        self.all_issues[issue.id] = issue
        
        # If this is a root issue (no parent), add to root_issues
        if issue.parent is None and issue not in self.root_issues:
            self.root_issues.append(issue)
    
    def remove_issue(self, issue_id: str) -> bool:
        """Remove an issue and all its descendants."""
        if issue_id not in self.all_issues:
            return False
        
        issue = self.all_issues[issue_id]
        
        # Remove all descendants first
        for child in issue.children[:]:  # Copy list to avoid modification during iteration
            self.remove_issue(child.id)
        
        # Remove from parent's children
        if issue.parent:
            issue.parent.remove_child(issue)
        
        # Remove from root issues if applicable
        if issue in self.root_issues:
            self.root_issues.remove(issue)
        
        # Remove from all_issues
        del self.all_issues[issue_id]
        
        return True
    
    def get_issue(self, issue_id: str) -> Optional[IssueSpec]:
        """Get an issue by ID."""
        return self.all_issues.get(issue_id)
    
    def get_epics(self) -> List[IssueSpec]:
        """Get all epic issues."""
        return [issue for issue in self.all_issues.values() if issue.is_epic()]
    
    def get_stories(self) -> List[IssueSpec]:
        """Get all story issues."""
        return [issue for issue in self.all_issues.values() if issue.is_story()]
    
    def get_tasks(self) -> List[IssueSpec]:
        """Get all task issues."""
        return [issue for issue in self.all_issues.values() if issue.is_task()]
    
    def get_issues_by_type(self, issue_type: IssueType) -> List[IssueSpec]:
        """Get all issues of a specific type."""
        return [issue for issue in self.all_issues.values() if issue.issue_type == issue_type]
    
    def get_issues_by_priority(self, priority: Priority) -> List[IssueSpec]:
        """Get all issues of a specific priority."""
        return [issue for issue in self.all_issues.values() if issue.priority == priority]
    
    def total_count(self) -> int:
        """Get total number of issues."""
        return len(self.all_issues)
    
    def print_hierarchy(self) -> str:
        """Get a string representation of the complete hierarchy."""
        def _print_issue_tree(issue: IssueSpec, level: int = 0) -> List[str]:
            lines = []
            indent = "  " * level
            lines.append(f"{indent}• [{issue.issue_type.value.upper()}] {issue.title}")
            
            for child in issue.children:
                lines.extend(_print_issue_tree(child, level + 1))
            
            return lines
        
        all_lines = []
        for root_issue in self.root_issues:
            all_lines.extend(_print_issue_tree(root_issue))
            all_lines.append("")  # Empty line between root issues
        
        return "\n".join(all_lines).rstrip()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert hierarchy to dictionary for serialization."""
        return {
            'root_issue_ids': [issue.id for issue in self.root_issues],
            'all_issues': {issue_id: issue.to_dict() for issue_id, issue in self.all_issues.items()}
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'IssueHierarchy':
        """Create hierarchy from dictionary."""
        hierarchy = cls()
        
        # First create all issues without relationships
        issues_dict = {}
        for issue_id, issue_data in data.get('all_issues', {}).items():
            issue = IssueSpec.from_dict(issue_data)
            issue.id = issue_id  # Ensure ID matches
            issues_dict[issue_id] = issue
            hierarchy.all_issues[issue_id] = issue
        
        # Then establish parent-child relationships
        for issue_id, issue_data in data.get('all_issues', {}).items():
            issue = issues_dict[issue_id]
            parent_id = issue_data.get('parent_id')
            
            if parent_id and parent_id in issues_dict:
                parent_issue = issues_dict[parent_id]
                parent_issue.add_child(issue)
        
        # Set root issues
        root_issue_ids = data.get('root_issue_ids', [])
        hierarchy.root_issues = [issues_dict[issue_id] for issue_id in root_issue_ids if issue_id in issues_dict]
        
        return hierarchy
    
    def __str__(self) -> str:
        """String representation of the hierarchy."""
        return f"IssueHierarchy({self.total_count()} issues, {len(self.root_issues)} root issues)"
    
    def __repr__(self) -> str:
        """Detailed representation for debugging."""
        return (
            f"IssueHierarchy(total={self.total_count()}, "
            f"epics={len(self.get_epics())}, "
            f"stories={len(self.get_stories())}, "
            f"tasks={len(self.get_tasks())})"
        )


# Type aliases for convenience
Epic = IssueSpec
Story = IssueSpec
Task = IssueSpec