#!/usr/bin/env python3
"""
Acceptance criteria templating system.

Provides intelligent formatting and enhancement of acceptance criteria.
"""

import re
from typing import List, Dict, Optional, Any, Tuple
from dataclasses import dataclass
from enum import Enum

from issue_spec import AcceptanceCriterion, AcceptanceCriteria, IssueType, Priority


class CriteriaType(Enum):
    """Types of acceptance criteria."""
    FUNCTIONAL = "functional"
    PERFORMANCE = "performance"
    SECURITY = "security"
    ACCESSIBILITY = "accessibility"
    USABILITY = "usability"
    COMPATIBILITY = "compatibility"
    BUSINESS = "business"


@dataclass
class CriteriaTemplate:
    """Template for generating acceptance criteria."""
    category: CriteriaType
    template: str
    variables: List[str]
    priority: int = 1  # Higher number = higher priority
    
    def apply(self, variables: Dict[str, Any]) -> str:
        """Apply template with provided variables."""
        try:
            return self.template.format(**variables)
        except KeyError as e:
            return self.template  # Return as-is if variables missing


class AcceptanceCriteriaTemplatingEngine:
    """
    Engine for templating and enhancing acceptance criteria.
    
    Features:
    - Automatic criteria categorization
    - Template-based criteria enhancement
    - Missing criteria detection
    - Format standardization
    - Quality validation
    """
    
    def __init__(self):
        """Initialize templating engine with standard templates."""
        self.templates = self._build_default_templates()
        self.format_patterns = self._build_format_patterns()
    
    def enhance_acceptance_criteria(
        self,
        criteria: AcceptanceCriteria,
        issue_type: IssueType,
        context: Optional[Dict[str, Any]] = None
    ) -> AcceptanceCriteria:
        """
        Enhance acceptance criteria with templates and standardization.
        
        Args:
            criteria: Original acceptance criteria
            issue_type: Type of issue for context-aware enhancement
            context: Additional context for templating
            
        Returns:
            Enhanced acceptance criteria
        """
        context = context or {}
        
        # Start with existing criteria
        enhanced_criteria = []
        for criterion in criteria.criteria:
            enhanced_criterion = self._enhance_single_criterion(criterion, issue_type, context)
            enhanced_criteria.append(enhanced_criterion)
        
        # Add missing essential criteria
        missing_criteria = self._detect_missing_criteria(enhanced_criteria, issue_type, context)
        enhanced_criteria.extend(missing_criteria)
        
        # Sort by priority and category
        enhanced_criteria = self._sort_criteria(enhanced_criteria)
        
        return AcceptanceCriteria(
            criteria=enhanced_criteria,
            completed_count=len([c for c in enhanced_criteria if c.completed])
        )
    
    def generate_criteria_from_template(
        self,
        issue_type: IssueType,
        context: Dict[str, Any]
    ) -> AcceptanceCriteria:
        """Generate acceptance criteria from templates."""
        generated_criteria = []
        
        # Get templates for issue type
        relevant_templates = self._get_templates_for_issue_type(issue_type)
        
        for template in relevant_templates:
            criterion_text = template.apply(context)
            if criterion_text and criterion_text != template.template:
                criterion = AcceptanceCriterion(
                    description=criterion_text,
                    completed=False,
                    category=template.category.value,
                    priority=template.priority
                )
                generated_criteria.append(criterion)
        
        return AcceptanceCriteria(criteria=generated_criteria)
    
    def standardize_format(self, criteria: AcceptanceCriteria) -> AcceptanceCriteria:
        """Standardize criteria format and structure."""
        standardized_criteria = []
        
        for criterion in criteria.criteria:
            standardized = self._standardize_single_criterion(criterion)
            standardized_criteria.append(standardized)
        
        return AcceptanceCriteria(
            criteria=standardized_criteria,
            completed_count=len([c for c in standardized_criteria if c.completed])
        )
    
    def _enhance_single_criterion(
        self,
        criterion: AcceptanceCriterion,
        issue_type: IssueType,
        context: Dict[str, Any]
    ) -> AcceptanceCriterion:
        """Enhance a single acceptance criterion."""
        enhanced_description = criterion.description
        
        # Detect and set category if not already set
        if not criterion.category:
            category = self._detect_criterion_category(enhanced_description)
            criterion.category = category.value if category else None
        
        # Apply formatting improvements
        enhanced_description = self._improve_criterion_format(enhanced_description)
        
        # Add context-specific enhancements
        enhanced_description = self._add_contextual_details(
            enhanced_description, issue_type, context
        )
        
        return AcceptanceCriterion(
            description=enhanced_description,
            completed=criterion.completed,
            category=criterion.category,
            priority=criterion.priority
        )
    
    def _detect_missing_criteria(
        self,
        existing_criteria: List[AcceptanceCriterion],
        issue_type: IssueType,
        context: Dict[str, Any]
    ) -> List[AcceptanceCriterion]:
        """Detect and generate missing essential criteria."""
        existing_categories = {c.category for c in existing_criteria if c.category}
        missing_criteria = []
        
        # Essential criteria by issue type
        essential_criteria = self._get_essential_criteria_for_type(issue_type)
        
        for category, template in essential_criteria.items():
            if category.value not in existing_categories:
                criterion_text = template.apply(context)
                if criterion_text:
                    missing_criteria.append(AcceptanceCriterion(
                        description=criterion_text,
                        completed=False,
                        category=category.value,
                        priority=template.priority
                    ))
        
        return missing_criteria
    
    def _get_templates_for_issue_type(self, issue_type: IssueType) -> List[CriteriaTemplate]:
        """Get relevant templates for an issue type."""
        # All types get basic functional criteria
        relevant_templates = [
            template for template in self.templates 
            if template.category == CriteriaType.FUNCTIONAL
        ]
        
        # Add type-specific templates
        if issue_type in [IssueType.FEATURE, IssueType.EPIC]:
            relevant_templates.extend([
                template for template in self.templates
                if template.category in [CriteriaType.PERFORMANCE, CriteriaType.USABILITY]
            ])
        
        if issue_type == IssueType.BUG:
            relevant_templates.extend([
                template for template in self.templates
                if template.category == CriteriaType.FUNCTIONAL
            ])
        
        return relevant_templates
    
    def _get_essential_criteria_for_type(self, issue_type: IssueType) -> Dict[CriteriaType, CriteriaTemplate]:
        """Get essential criteria that should be present for an issue type."""
        essential = {}
        
        if issue_type in [IssueType.FEATURE, IssueType.EPIC, IssueType.STORY]:
            essential[CriteriaType.FUNCTIONAL] = CriteriaTemplate(
                category=CriteriaType.FUNCTIONAL,
                template="Core functionality works as specified",
                variables=[],
                priority=1
            )
            
            essential[CriteriaType.ACCESSIBILITY] = CriteriaTemplate(
                category=CriteriaType.ACCESSIBILITY,
                template="Feature is accessible to users with disabilities (WCAG 2.1 AA compliance)",
                variables=[],
                priority=2
            )
            
            essential[CriteriaType.PERFORMANCE] = CriteriaTemplate(
                category=CriteriaType.PERFORMANCE,
                template="Feature meets performance requirements (response time < 2s)",
                variables=[],
                priority=2
            )
        
        if issue_type == IssueType.BUG:
            essential[CriteriaType.FUNCTIONAL] = CriteriaTemplate(
                category=CriteriaType.FUNCTIONAL,
                template="Bug is fixed and no longer reproducible",
                variables=[],
                priority=1
            )
        
        return essential
    
    def _detect_criterion_category(self, description: str) -> Optional[CriteriaType]:
        """Detect category of a criterion based on its description."""
        description_lower = description.lower()
        
        # Performance indicators
        if any(word in description_lower for word in [
            "performance", "speed", "load time", "response time", "latency",
            "throughput", "scalability", "memory", "cpu"
        ]):
            return CriteriaType.PERFORMANCE
        
        # Security indicators
        if any(word in description_lower for word in [
            "security", "authentication", "authorization", "permission",
            "secure", "encrypt", "privacy", "vulnerability"
        ]):
            return CriteriaType.SECURITY
        
        # Accessibility indicators
        if any(word in description_lower for word in [
            "accessibility", "wcag", "screen reader", "keyboard navigation",
            "accessible", "aria", "contrast", "focus"
        ]):
            return CriteriaType.ACCESSIBILITY
        
        # Compatibility indicators
        if any(word in description_lower for word in [
            "browser", "mobile", "desktop", "compatibility", "responsive",
            "cross-platform", "device", "safari", "chrome", "firefox"
        ]):
            return CriteriaType.COMPATIBILITY
        
        # Usability indicators
        if any(word in description_lower for word in [
            "usability", "user experience", "intuitive", "easy to use",
            "user-friendly", "navigation", "workflow"
        ]):
            return CriteriaType.USABILITY
        
        # Default to functional
        return CriteriaType.FUNCTIONAL
    
    def _improve_criterion_format(self, description: str) -> str:
        """Improve formatting and clarity of criterion description."""
        # Ensure proper sentence structure
        description = description.strip()
        
        # Capitalize first letter
        if description and not description[0].isupper():
            description = description[0].upper() + description[1:]
        
        # Ensure proper ending punctuation
        if description and not description.endswith(('.', '!', '?')):
            description += '.'
        
        # Remove redundant words
        description = re.sub(r'\b(the|a|an)\s+\1\b', r'\1', description, flags=re.IGNORECASE)
        
        # Improve clarity patterns
        improvements = {
            r'\bworks?\b': 'functions correctly',
            r'\bis ok\b': 'meets requirements',
            r'\bshould be\b': 'is',
            r'\bmust be\b': 'is'
        }
        
        for pattern, replacement in improvements.items():
            description = re.sub(pattern, replacement, description, flags=re.IGNORECASE)
        
        return description
    
    def _add_contextual_details(
        self,
        description: str,
        issue_type: IssueType,
        context: Dict[str, Any]
    ) -> str:
        """Add contextual details to make criteria more specific."""
        # Add specific metrics if missing and context provides them
        if "performance" in description.lower() and "time" not in description.lower():
            if "response_time_requirement" in context:
                description = f"{description} (target: {context['response_time_requirement']})"
        
        # Add user role context for user stories
        if issue_type == IssueType.STORY and "user" in description.lower():
            user_role = context.get("user_role", "user")
            if user_role != "user" and user_role not in description:
                description = description.replace("user", f"{user_role}")
        
        return description
    
    def _standardize_single_criterion(self, criterion: AcceptanceCriterion) -> AcceptanceCriterion:
        """Standardize format of a single criterion."""
        description = criterion.description
        
        # Apply standard format patterns
        for pattern, replacement in self.format_patterns.items():
            description = re.sub(pattern, replacement, description, flags=re.IGNORECASE)
        
        return AcceptanceCriterion(
            description=description,
            completed=criterion.completed,
            category=criterion.category,
            priority=criterion.priority
        )
    
    def _sort_criteria(self, criteria: List[AcceptanceCriterion]) -> List[AcceptanceCriterion]:
        """Sort criteria by priority and category."""
        # Define category priority order
        category_priority = {
            CriteriaType.FUNCTIONAL.value: 1,
            CriteriaType.BUSINESS.value: 2,
            CriteriaType.PERFORMANCE.value: 3,
            CriteriaType.SECURITY.value: 4,
            CriteriaType.ACCESSIBILITY.value: 5,
            CriteriaType.USABILITY.value: 6,
            CriteriaType.COMPATIBILITY.value: 7
        }
        
        def sort_key(criterion: AcceptanceCriterion) -> Tuple[int, int]:
            cat_priority = category_priority.get(criterion.category or "", 99)
            crit_priority = criterion.priority or 99
            return (cat_priority, crit_priority)
        
        return sorted(criteria, key=sort_key)
    
    def _build_default_templates(self) -> List[CriteriaTemplate]:
        """Build default criteria templates."""
        return [
            # Functional templates
            CriteriaTemplate(
                category=CriteriaType.FUNCTIONAL,
                template="All core functionality works as specified",
                variables=[],
                priority=1
            ),
            CriteriaTemplate(
                category=CriteriaType.FUNCTIONAL,
                template="User can {action} successfully",
                variables=["action"],
                priority=1
            ),
            CriteriaTemplate(
                category=CriteriaType.FUNCTIONAL,
                template="System handles {scenario} correctly",
                variables=["scenario"],
                priority=2
            ),
            
            # Performance templates
            CriteriaTemplate(
                category=CriteriaType.PERFORMANCE,
                template="Response time is under {time_limit}",
                variables=["time_limit"],
                priority=2
            ),
            CriteriaTemplate(
                category=CriteriaType.PERFORMANCE,
                template="System supports {concurrent_users} concurrent users",
                variables=["concurrent_users"],
                priority=3
            ),
            
            # Security templates
            CriteriaTemplate(
                category=CriteriaType.SECURITY,
                template="User authentication is required and secure",
                variables=[],
                priority=2
            ),
            CriteriaTemplate(
                category=CriteriaType.SECURITY,
                template="User authorization prevents unauthorized access",
                variables=[],
                priority=2
            ),
            
            # Accessibility templates
            CriteriaTemplate(
                category=CriteriaType.ACCESSIBILITY,
                template="Feature is accessible via keyboard navigation",
                variables=[],
                priority=3
            ),
            CriteriaTemplate(
                category=CriteriaType.ACCESSIBILITY,
                template="Screen readers can access all functionality",
                variables=[],
                priority=3
            ),
            
            # Compatibility templates
            CriteriaTemplate(
                category=CriteriaType.COMPATIBILITY,
                template="Works on {browsers} browsers",
                variables=["browsers"],
                priority=4
            ),
            CriteriaTemplate(
                category=CriteriaType.COMPATIBILITY,
                template="Responsive design works on mobile and desktop",
                variables=[],
                priority=4
            )
        ]
    
    def _build_format_patterns(self) -> Dict[str, str]:
        """Build regex patterns for format standardization."""
        return {
            r'\bshould\s+be\s+able\s+to\b': 'can',
            r'\bmust\s+be\s+able\s+to\b': 'can',
            r'\bneeds\s+to\s+be\b': 'is',
            r'\bhas\s+to\s+be\b': 'is',
            r'\bought\s+to\s+be\b': 'is',
            r'\bwill\s+be\b': 'is',
            r'\bis\s+going\s+to\s+be\b': 'is'
        }


# Utility functions
def enhance_criteria_with_templates(
    criteria: AcceptanceCriteria,
    issue_type: IssueType,
    context: Optional[Dict[str, Any]] = None
) -> AcceptanceCriteria:
    """Utility function to enhance criteria using templates."""
    engine = AcceptanceCriteriaTemplatingEngine()
    return engine.enhance_acceptance_criteria(criteria, issue_type, context)


def generate_default_criteria(
    issue_type: IssueType,
    context: Dict[str, Any]
) -> AcceptanceCriteria:
    """Generate default acceptance criteria for an issue type."""
    engine = AcceptanceCriteriaTemplatingEngine()
    return engine.generate_criteria_from_template(issue_type, context)