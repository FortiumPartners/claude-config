#!/usr/bin/env python3
"""
Default template library for automatic issue creation.

Provides comprehensive templates for different issue types and systems.
"""

from typing import Dict, Any, Optional
from configuration_schema import IssueTemplate, IssueTemplateType


class DefaultTemplateLibrary:
    """Library of default issue templates for different contexts."""
    
    @staticmethod
    def get_standard_templates() -> Dict[str, IssueTemplate]:
        """Get standard templates for common issue types."""
        return {
            IssueTemplateType.EPIC.value: IssueTemplate(
                title_prefix="[EPIC]",
                labels=["epic", "planning", "roadmap"],
                priority_mapping={
                    "P1": "urgent", "P2": "high", "P3": "medium", "P4": "low"
                },
                description_template="""## Epic Overview
{original_description}

## Business Value
- Strategic alignment with product goals
- Expected impact on user experience
- Success metrics and KPIs

## Scope and Deliverables
- Key features and capabilities
- Major milestones and phases
- Acceptance criteria for epic completion

## Dependencies and Risks
- External dependencies and blockers  
- Technical risks and mitigation strategies
- Resource requirements and timeline

---
*Auto-generated from specification - please review and update as needed*
""",
                custom_fields={
                    "story_points": None,
                    "target_quarter": None,
                    "business_value": "TBD"
                }
            ),
            
            IssueTemplateType.FEATURE.value: IssueTemplate(
                title_prefix="[FEATURE]",
                labels=["feature", "development", "enhancement"],
                priority_mapping={
                    "P1": "urgent", "P2": "high", "P3": "medium", "P4": "low"
                },
                description_template="""## Feature Description
{original_description}

## User Story
As a [user type], I want [functionality] so that [benefit].

## Acceptance Criteria
{acceptance_criteria}

## Technical Approach
- Implementation strategy
- Architecture considerations
- Technology stack requirements

## Testing Strategy
- Unit test coverage requirements
- Integration test scenarios
- User acceptance testing approach

---
*Auto-generated from specification - please review and update as needed*
""",
                custom_fields={
                    "story_points": None,
                    "dev_estimate": None,
                    "design_required": False
                }
            ),
            
            IssueTemplateType.STORY.value: IssueTemplate(
                title_prefix="[STORY]",
                labels=["story", "user-story", "feature"],
                priority_mapping={
                    "P1": "urgent", "P2": "high", "P3": "medium", "P4": "low"
                },
                description_template="""## User Story
As a {user_role}, I want {functionality} so that {benefit}.

## Description
{original_description}

## Acceptance Criteria
{acceptance_criteria}

## Definition of Done
- [ ] Code implemented and reviewed
- [ ] Unit tests written and passing
- [ ] Integration tests passing
- [ ] Documentation updated
- [ ] Deployed to staging environment
- [ ] User acceptance testing completed

---
*Auto-generated from specification - please review and update as needed*
""",
                custom_fields={
                    "story_points": None,
                    "user_role": "user",
                    "sprint": None
                }
            ),
            
            IssueTemplateType.TASK.value: IssueTemplate(
                title_prefix="[TASK]",
                labels=["task", "implementation", "development"],
                priority_mapping={
                    "P1": "urgent", "P2": "high", "P3": "medium", "P4": "low"
                },
                description_template="""## Task Description
{original_description}

## Implementation Details
{acceptance_criteria}

## Technical Requirements
- Specific implementation requirements
- Technology/framework constraints
- Performance/scalability considerations

## Definition of Done
- [ ] Implementation completed
- [ ] Code reviewed and approved
- [ ] Tests written and passing
- [ ] Documentation updated

---
*Auto-generated from specification - please review and update as needed*
""",
                custom_fields={
                    "effort_hours": None,
                    "complexity": "medium",
                    "component": None
                }
            ),
            
            IssueTemplateType.BUG.value: IssueTemplate(
                title_prefix="[BUG]",
                labels=["bug", "fix", "defect"],
                priority_mapping={
                    "P1": "urgent", "P2": "high", "P3": "medium", "P4": "low"
                },
                description_template="""## Bug Description
{original_description}

## Steps to Reproduce
1. Step 1
2. Step 2
3. Step 3

## Expected Behavior
Description of expected behavior

## Actual Behavior
Description of actual behavior

## Environment
- OS: [Operating System]
- Browser: [Browser and version]
- Version: [Application version]

## Additional Context
Any additional information, screenshots, or logs

---
*Auto-generated from specification - please review and update as needed*
""",
                custom_fields={
                    "severity": "medium",
                    "environment": None,
                    "affected_users": None
                }
            ),
            
            IssueTemplateType.IMPROVEMENT.value: IssueTemplate(
                title_prefix="[IMPROVEMENT]",
                labels=["improvement", "enhancement", "optimization"],
                priority_mapping={
                    "P1": "urgent", "P2": "high", "P3": "medium", "P4": "low"
                },
                description_template="""## Improvement Description
{original_description}

## Current State
Description of current functionality/behavior

## Proposed Enhancement
{acceptance_criteria}

## Benefits
- Performance improvements
- User experience enhancements
- Maintainability improvements

## Implementation Approach
- Technical strategy
- Breaking changes (if any)
- Migration considerations

---
*Auto-generated from specification - please review and update as needed*
""",
                custom_fields={
                    "improvement_type": "performance",
                    "effort_estimate": None,
                    "impact_level": "medium"
                }
            )
        }
    
    @staticmethod
    def get_linear_templates() -> Dict[str, IssueTemplate]:
        """Get templates optimized for Linear workflow."""
        templates = DefaultTemplateLibrary.get_standard_templates()
        
        # Linear-specific customizations
        for template in templates.values():
            # Linear uses specific priority values
            template.priority_mapping = {
                "P1": "1", "P2": "2", "P3": "3", "P4": "4"
            }
            # Add Linear-specific labels
            if "linear" not in template.labels:
                template.labels.append("linear")
        
        return templates
    
    @staticmethod
    def get_github_templates() -> Dict[str, IssueTemplate]:
        """Get templates optimized for GitHub Issues workflow."""
        templates = DefaultTemplateLibrary.get_standard_templates()
        
        # GitHub-specific customizations
        for template_type, template in templates.items():
            # GitHub uses labels for priority
            template.priority_mapping = {
                "P1": "priority:urgent", "P2": "priority:high", 
                "P3": "priority:medium", "P4": "priority:low"
            }
            
            # Add GitHub-specific labels
            if "github" not in template.labels:
                template.labels.append("github")
            
            # Add type-specific labels for GitHub
            if template_type == IssueTemplateType.BUG.value:
                template.labels.extend(["type:bug", "needs-triage"])
            elif template_type == IssueTemplateType.FEATURE.value:
                template.labels.extend(["type:feature", "enhancement"])
            elif template_type == IssueTemplateType.EPIC.value:
                template.labels.extend(["type:epic", "planning"])
        
        return templates
    
    @staticmethod
    def get_jira_templates() -> Dict[str, IssueTemplate]:
        """Get templates optimized for Jira workflow."""
        templates = DefaultTemplateLibrary.get_standard_templates()
        
        # Jira-specific customizations
        for template in templates.values():
            # Jira uses numeric priority values
            template.priority_mapping = {
                "P1": "1", "P2": "2", "P3": "3", "P4": "4"
            }
            
            # Jira uses different field structure
            template.custom_fields.update({
                "components": [],
                "fix_versions": [],
                "affects_versions": []
            })
        
        return templates
    
    @staticmethod
    def get_minimal_templates() -> Dict[str, IssueTemplate]:
        """Get minimal templates for basic usage."""
        return {
            IssueTemplateType.EPIC.value: IssueTemplate(
                title_prefix="[EPIC]",
                labels=["epic"]
            ),
            IssueTemplateType.FEATURE.value: IssueTemplate(
                title_prefix="[FEATURE]",
                labels=["feature"]
            ),
            IssueTemplateType.TASK.value: IssueTemplate(
                title_prefix="[TASK]",
                labels=["task"]
            )
        }
    
    @staticmethod
    def get_agile_templates() -> Dict[str, IssueTemplate]:
        """Get templates optimized for Agile/Scrum workflow."""
        templates = DefaultTemplateLibrary.get_standard_templates()
        
        # Agile-specific customizations
        for template_type, template in templates.items():
            template.labels.extend(["agile", "scrum"])
            
            # Add agile-specific custom fields
            template.custom_fields.update({
                "story_points": None,
                "sprint": None,
                "team": None
            })
            
            # Customize description templates for agile
            if template_type == IssueTemplateType.STORY.value:
                template.description_template = """## User Story
As a {user_role}, I want {functionality} so that {benefit}.

## Description
{original_description}

## Acceptance Criteria
{acceptance_criteria}

## Story Points: TBD
## Sprint: TBD

## Definition of Done
- [ ] Code complete and reviewed
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Acceptance criteria met
- [ ] Ready for demo

---
*Auto-generated from specification*
"""
        
        return templates
    
    @staticmethod
    def get_templates_for_system(system_type: str) -> Dict[str, IssueTemplate]:
        """Get appropriate templates for a ticketing system."""
        system_type = system_type.lower()
        
        if system_type == "linear":
            return DefaultTemplateLibrary.get_linear_templates()
        elif system_type == "github":
            return DefaultTemplateLibrary.get_github_templates()
        elif system_type == "jira":
            return DefaultTemplateLibrary.get_jira_templates()
        else:
            return DefaultTemplateLibrary.get_standard_templates()
    
    @staticmethod
    def create_custom_template(
        issue_type: str,
        title_prefix: Optional[str] = None,
        labels: Optional[list] = None,
        description_template: Optional[str] = None,
        **custom_fields
    ) -> IssueTemplate:
        """Create a custom template with specified parameters."""
        return IssueTemplate(
            title_prefix=title_prefix or f"[{issue_type.upper()}]",
            labels=labels or [issue_type.lower()],
            description_template=description_template,
            custom_fields=custom_fields
        )


# Template validation utilities
class TemplateValidator:
    """Validates issue templates for completeness and correctness."""
    
    @staticmethod
    def validate_template(template: IssueTemplate) -> Dict[str, Any]:
        """Validate a single template."""
        issues = []
        warnings = []
        
        # Check basic fields
        if not template.labels:
            warnings.append("Template has no labels - consider adding for organization")
        
        if template.description_template and "{original_description}" not in template.description_template:
            warnings.append("Template doesn't include {original_description} placeholder")
        
        if template.description_template and "{acceptance_criteria}" not in template.description_template:
            warnings.append("Template doesn't include {acceptance_criteria} placeholder")
        
        # Validate priority mapping
        if template.priority_mapping:
            valid_priorities = ["P1", "P2", "P3", "P4"]
            missing_priorities = [p for p in valid_priorities if p not in template.priority_mapping]
            if missing_priorities:
                warnings.append(f"Missing priority mappings: {missing_priorities}")
        
        return {
            "valid": len(issues) == 0,
            "errors": issues,
            "warnings": warnings
        }
    
    @staticmethod
    def validate_template_set(templates: Dict[str, IssueTemplate]) -> Dict[str, Any]:
        """Validate a complete set of templates."""
        all_errors = []
        all_warnings = []
        
        for name, template in templates.items():
            validation = TemplateValidator.validate_template(template)
            
            if validation["errors"]:
                all_errors.extend([f"Template '{name}': {error}" for error in validation["errors"]])
            
            if validation["warnings"]:
                all_warnings.extend([f"Template '{name}': {warning}" for warning in validation["warnings"]])
        
        return {
            "valid": len(all_errors) == 0,
            "errors": all_errors,
            "warnings": all_warnings
        }