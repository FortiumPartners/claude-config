#!/usr/bin/env python3
"""
Template engine for automatic issue creation.

Applies templates to issues with dynamic content substitution and formatting.
"""

import re
import logging
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass, asdict
from datetime import datetime

from issue_spec import IssueSpec, IssueType, Priority
from configuration_schema import IssueTemplate, TeamConfiguration
from default_templates import DefaultTemplateLibrary


@dataclass
class TemplateContext:
    """Context information for template rendering."""
    issue: IssueSpec
    team_config: TeamConfiguration
    project_name: Optional[str] = None
    assignee_mapping: Dict[str, str] = None
    custom_variables: Dict[str, Any] = None
    
    def __post_init__(self):
        """Initialize default values."""
        if self.assignee_mapping is None:
            self.assignee_mapping = {}
        
        if self.custom_variables is None:
            self.custom_variables = {}


class TemplateEngine:
    """
    Template engine that applies issue templates with dynamic content substitution.
    
    Supports:
    - Dynamic variable substitution
    - Conditional content rendering
    - System-specific formatting
    - Assignee and label mapping
    - Custom field population
    """
    
    def __init__(self, team_config: TeamConfiguration):
        """Initialize template engine with team configuration."""
        self.team_config = team_config
        self.logger = logging.getLogger(__name__)
        
        # Load default templates if none configured
        if not team_config.templates:
            self.templates = DefaultTemplateLibrary.get_standard_templates()
        else:
            self.templates = {name: template for name, template in team_config.templates.items()}
    
    def apply_template(self, issue: IssueSpec, context: Optional[TemplateContext] = None) -> IssueSpec:
        """
        Apply template to an issue based on its type.
        
        Args:
            issue: Issue to apply template to
            context: Additional context for template rendering
            
        Returns:
            Issue with template applied
        """
        if not context:
            context = TemplateContext(issue=issue, team_config=self.team_config)
        
        # Create a copy to avoid modifying the original
        templated_issue = IssueSpec(
            id=issue.id,
            title=issue.title,
            description=issue.description,
            issue_type=issue.issue_type,
            priority=issue.priority,
            status=issue.status,
            acceptance_criteria=issue.acceptance_criteria,
            parent_id=issue.parent_id,
            estimated_hours=issue.estimated_hours,
            assigned_to=issue.assigned_to,
            labels=issue.labels.copy() if issue.labels else [],
            custom_fields=issue.custom_fields.copy() if issue.custom_fields else {}
        )
        
        # Get template for issue type
        template = self._get_template_for_issue(issue.issue_type)
        if not template:
            self.logger.warning(f"No template found for issue type {issue.issue_type}")
            return templated_issue
        
        # Apply template components
        templated_issue = self._apply_title_formatting(templated_issue, template, context)
        templated_issue = self._apply_description_template(templated_issue, template, context)
        templated_issue = self._apply_labels(templated_issue, template, context)
        templated_issue = self._apply_assignee(templated_issue, template, context)
        templated_issue = self._apply_priority_mapping(templated_issue, template, context)
        templated_issue = self._apply_custom_fields(templated_issue, template, context)
        
        return templated_issue
    
    def apply_template_batch(
        self, 
        issues: List[IssueSpec], 
        context: Optional[TemplateContext] = None
    ) -> List[IssueSpec]:
        """Apply templates to a batch of issues."""
        templated_issues = []
        
        for issue in issues:
            issue_context = context or TemplateContext(issue=issue, team_config=self.team_config)
            # Update context for each issue
            issue_context.issue = issue
            
            templated_issue = self.apply_template(issue, issue_context)
            templated_issues.append(templated_issue)
        
        return templated_issues
    
    def _get_template_for_issue(self, issue_type: IssueType) -> Optional[IssueTemplate]:
        """Get template for a specific issue type."""
        template_name = issue_type.value.lower()
        
        # Try exact match first
        if template_name in self.templates:
            return self.templates[template_name]
        
        # Try common aliases
        aliases = {
            "user_story": "story",
            "user-story": "story",
            "enhancement": "improvement",
            "defect": "bug"
        }
        
        if template_name in aliases:
            alias_name = aliases[template_name]
            if alias_name in self.templates:
                return self.templates[alias_name]
        
        # Fall back to a generic template if available
        if "default" in self.templates:
            return self.templates["default"]
        
        return None
    
    def _apply_title_formatting(
        self, 
        issue: IssueSpec, 
        template: IssueTemplate, 
        context: TemplateContext
    ) -> IssueSpec:
        """Apply title prefix and suffix formatting."""
        title = issue.title
        
        # Apply prefix
        if template.title_prefix:
            prefix = self._substitute_variables(template.title_prefix, issue, context)
            if not title.startswith(prefix):
                title = f"{prefix} {title}"
        
        # Apply suffix  
        if template.title_suffix:
            suffix = self._substitute_variables(template.title_suffix, issue, context)
            if not title.endswith(suffix):
                title = f"{title} {suffix}"
        
        issue.title = title
        return issue
    
    def _apply_description_template(
        self, 
        issue: IssueSpec, 
        template: IssueTemplate, 
        context: TemplateContext
    ) -> IssueSpec:
        """Apply description template with variable substitution."""
        if not template.description_template:
            return issue
        
        # Prepare template variables
        template_vars = {
            "original_description": issue.description or "",
            "acceptance_criteria": self._format_acceptance_criteria(issue),
            "issue_type": issue.issue_type.value,
            "priority": issue.priority.value if issue.priority else "medium",
            "estimated_hours": issue.estimated_hours or "TBD",
            "user_role": context.custom_variables.get("user_role", "user"),
            "functionality": context.custom_variables.get("functionality", ""),
            "benefit": context.custom_variables.get("benefit", ""),
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        
        # Add custom variables
        template_vars.update(context.custom_variables or {})
        
        # Apply template
        description = template.description_template
        description = self._substitute_template_variables(description, template_vars)
        
        issue.description = description.strip()
        return issue
    
    def _apply_labels(
        self, 
        issue: IssueSpec, 
        template: IssueTemplate, 
        context: TemplateContext
    ) -> IssueSpec:
        """Apply template labels to issue."""
        if not template.labels:
            return issue
        
        # Start with existing labels
        current_labels = set(issue.labels or [])
        
        # Add template labels with variable substitution
        for label in template.labels:
            processed_label = self._substitute_variables(label, issue, context)
            current_labels.add(processed_label)
        
        issue.labels = list(current_labels)
        return issue
    
    def _apply_assignee(
        self, 
        issue: IssueSpec, 
        template: IssueTemplate, 
        context: TemplateContext
    ) -> IssueSpec:
        """Apply default assignee from template."""
        if not template.default_assignee or issue.assigned_to:
            return issue
        
        assignee = template.default_assignee
        
        # Handle assignee mapping (e.g., @role -> actual user)
        if assignee.startswith("@") and context.assignee_mapping:
            role = assignee[1:]  # Remove @ prefix
            if role in context.assignee_mapping:
                assignee = context.assignee_mapping[role]
        
        # Variable substitution
        assignee = self._substitute_variables(assignee, issue, context)
        
        issue.assigned_to = assignee
        return issue
    
    def _apply_priority_mapping(
        self, 
        issue: IssueSpec, 
        template: IssueTemplate, 
        context: TemplateContext
    ) -> IssueSpec:
        """Apply priority mapping from template."""
        if not template.priority_mapping or not issue.priority:
            return issue
        
        # Get priority string representation
        priority_key = f"P{issue.priority.value}"
        
        # Map to system-specific priority if mapping exists
        if priority_key in template.priority_mapping:
            mapped_priority = template.priority_mapping[priority_key]
            
            # Store mapped priority in custom fields for system-specific handling
            if not issue.custom_fields:
                issue.custom_fields = {}
            
            issue.custom_fields["system_priority"] = mapped_priority
        
        return issue
    
    def _apply_custom_fields(
        self, 
        issue: IssueSpec, 
        template: IssueTemplate, 
        context: TemplateContext
    ) -> IssueSpec:
        """Apply custom fields from template."""
        if not template.custom_fields:
            return issue
        
        # Initialize custom fields if not exists
        if not issue.custom_fields:
            issue.custom_fields = {}
        
        # Apply template custom fields (don't override existing values)
        for field_name, field_value in template.custom_fields.items():
            if field_name not in issue.custom_fields:
                if isinstance(field_value, str):
                    processed_value = self._substitute_variables(field_value, issue, context)
                    issue.custom_fields[field_name] = processed_value
                else:
                    issue.custom_fields[field_name] = field_value
        
        return issue
    
    def _format_acceptance_criteria(self, issue: IssueSpec) -> str:
        """Format acceptance criteria for template inclusion."""
        if not issue.acceptance_criteria or not issue.acceptance_criteria.criteria:
            return "- [ ] To be defined"
        
        criteria_lines = []
        for criterion in issue.acceptance_criteria.criteria:
            checkbox = "[x]" if criterion.completed else "[ ]"
            criteria_lines.append(f"- {checkbox} {criterion.description}")
        
        return "\n".join(criteria_lines)
    
    def _substitute_variables(self, text: str, issue: IssueSpec, context: TemplateContext) -> str:
        """Substitute simple variables in text."""
        variables = {
            "{issue_type}": issue.issue_type.value,
            "{priority}": issue.priority.value if issue.priority else "medium",
            "{title}": issue.title,
            "{project_name}": context.project_name or "Project"
        }
        
        result = text
        for var, value in variables.items():
            result = result.replace(var, str(value))
        
        return result
    
    def _substitute_template_variables(self, template: str, variables: Dict[str, Any]) -> str:
        """Substitute template variables using format strings."""
        try:
            return template.format(**variables)
        except KeyError as e:
            self.logger.warning(f"Template variable {e} not found, leaving as-is")
            return template
        except Exception as e:
            self.logger.error(f"Template substitution failed: {e}")
            return template


class DynamicAssigneeManager:
    """Manages dynamic assignee assignment based on rules and mappings."""
    
    def __init__(self, team_config: TeamConfiguration):
        """Initialize with team configuration."""
        self.team_config = team_config
        self.assignee_rules = self._build_assignee_rules()
    
    def _build_assignee_rules(self) -> Dict[str, str]:
        """Build assignee rules from configuration."""
        rules = {}
        
        # Extract assignee mappings from templates
        for template_name, template in self.team_config.templates.items():
            if template.default_assignee:
                rules[template_name] = template.default_assignee
        
        return rules
    
    def get_assignee_for_issue(self, issue: IssueSpec, assignee_mapping: Dict[str, str]) -> Optional[str]:
        """Get appropriate assignee for an issue."""
        issue_type_key = issue.issue_type.value.lower()
        
        # Check if there's a specific rule for this issue type
        if issue_type_key in self.assignee_rules:
            assignee = self.assignee_rules[issue_type_key]
            
            # Resolve role-based assignments
            if assignee.startswith("@"):
                role = assignee[1:]
                return assignee_mapping.get(role, assignee)
            
            return assignee
        
        return None


class LabelManager:
    """Manages dynamic label assignment and formatting."""
    
    def __init__(self, team_config: TeamConfiguration):
        """Initialize with team configuration."""
        self.team_config = team_config
        self.system_type = team_config.automatic_issue_creation.default_ticketing_system
    
    def get_labels_for_issue(self, issue: IssueSpec, template: IssueTemplate) -> List[str]:
        """Get comprehensive label list for an issue."""
        labels = set()
        
        # Add existing issue labels
        if issue.labels:
            labels.update(issue.labels)
        
        # Add template labels
        if template.labels:
            labels.update(template.labels)
        
        # Add system-specific labels
        system_labels = self._get_system_specific_labels(issue)
        labels.update(system_labels)
        
        # Add priority-based labels
        priority_labels = self._get_priority_labels(issue)
        labels.update(priority_labels)
        
        return list(labels)
    
    def _get_system_specific_labels(self, issue: IssueSpec) -> List[str]:
        """Get labels specific to the ticketing system."""
        labels = []
        
        if self.system_type == "github":
            # GitHub-specific labels
            type_mapping = {
                IssueType.BUG: ["bug", "type:bug"],
                IssueType.FEATURE: ["enhancement", "type:feature"],
                IssueType.EPIC: ["epic", "type:epic"],
                IssueType.TASK: ["task", "type:task"]
            }
            labels.extend(type_mapping.get(issue.issue_type, []))
        
        elif self.system_type == "linear":
            # Linear doesn't need specific label formatting
            pass
        
        return labels
    
    def _get_priority_labels(self, issue: IssueSpec) -> List[str]:
        """Get priority-based labels."""
        if not issue.priority:
            return []
        
        priority_mapping = {
            Priority.URGENT: ["urgent", "high-priority"],
            Priority.HIGH: ["high-priority"],
            Priority.MEDIUM: ["medium-priority"],
            Priority.LOW: ["low-priority"]
        }
        
        return priority_mapping.get(issue.priority, [])


# Factory functions for common template engines
def create_template_engine(team_config: TeamConfiguration) -> TemplateEngine:
    """Create template engine with team configuration."""
    return TemplateEngine(team_config)


def create_system_optimized_engine(system_type: str, team_config: TeamConfiguration) -> TemplateEngine:
    """Create template engine optimized for a specific system."""
    # Override templates with system-specific ones
    optimized_config = team_config
    optimized_config.templates = DefaultTemplateLibrary.get_templates_for_system(system_type)
    
    return TemplateEngine(optimized_config)