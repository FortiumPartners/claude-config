#!/usr/bin/env python3
"""
Advanced detection algorithms for identifying epics, stories, and tasks.

This module provides sophisticated pattern matching and ML-based classification
for more accurate detection of work items in specifications.
"""

import re
from typing import List, Dict, Any, Optional, Tuple, Set
from dataclasses import dataclass
from enum import Enum
from issue_spec import IssueType, Priority
from spec_parser import MarkdownSection


class ConfidenceLevel(Enum):
    """Confidence levels for classification results."""
    VERY_HIGH = "very_high"  # 90-100%
    HIGH = "high"           # 75-89%
    MEDIUM = "medium"       # 50-74%
    LOW = "low"            # 25-49%
    VERY_LOW = "very_low"   # 0-24%


@dataclass
class ClassificationResult:
    """Result of issue type classification."""
    issue_type: IssueType
    confidence: float
    confidence_level: ConfidenceLevel
    reasoning: List[str]
    score_breakdown: Dict[IssueType, float]


@dataclass
class DetectionRule:
    """Rule for detecting specific issue patterns."""
    name: str
    pattern: str
    issue_type: IssueType
    weight: float
    context: str = "both"  # "title", "content", or "both"
    flags: int = re.IGNORECASE


class AdvancedIssueDetector:
    """
    Advanced detector for classifying markdown sections as different issue types.
    
    Uses multiple detection strategies including:
    - Pattern-based classification
    - Structural analysis
    - Content analysis
    - Context-aware scoring
    """
    
    def __init__(self):
        self.detection_rules = self._initialize_detection_rules()
        self.structural_weights = self._initialize_structural_weights()
        self.keyword_weights = self._initialize_keyword_weights()
    
    def _initialize_detection_rules(self) -> List[DetectionRule]:
        """Initialize pattern-based detection rules."""
        return [
            # Epic detection rules
            DetectionRule("epic_explicit", r"\bepic\b", IssueType.EPIC, 0.9, "both"),
            DetectionRule("phase_indicator", r"\bphase\s*\d*\b", IssueType.EPIC, 0.8, "title"),
            DetectionRule("milestone_indicator", r"\bmilestone\b", IssueType.EPIC, 0.85, "title"),
            DetectionRule("objective_indicator", r"\bobjective\b", IssueType.EPIC, 0.7, "title"),
            DetectionRule("high_level_goal", r"\b(goal|vision|mission)\b", IssueType.EPIC, 0.6, "both"),
            
            # Feature/Story detection rules
            DetectionRule("user_story", r"\buser\s*story\b", IssueType.FEATURE, 0.95, "both"),
            DetectionRule("feature_explicit", r"\bfeature\b", IssueType.FEATURE, 0.8, "both"),
            DetectionRule("capability", r"\bcapability\b", IssueType.FEATURE, 0.75, "both"),
            DetectionRule("functionality", r"\bfunctionality\b", IssueType.FEATURE, 0.7, "both"),
            DetectionRule("requirement", r"\brequirement\b", IssueType.FEATURE, 0.6, "both"),
            DetectionRule("story_pattern", r"\bstory\b", IssueType.FEATURE, 0.65, "title"),
            
            # Task detection rules
            DetectionRule("task_explicit", r"\btask\b", IssueType.TASK, 0.9, "both"),
            DetectionRule("todo_indicator", r"\btodo\b", IssueType.TASK, 0.85, "both"),
            DetectionRule("implementation", r"\bimplementation\b", IssueType.TASK, 0.75, "both"),
            DetectionRule("subtask", r"\bsubtask\b", IssueType.TASK, 0.9, "both"),
            DetectionRule("action_item", r"\baction\s*item\b", IssueType.TASK, 0.8, "both"),
            DetectionRule("step_indicator", r"\bstep\s*\d+\b", IssueType.TASK, 0.7, "title"),
            
            # Bug detection rules
            DetectionRule("bug_explicit", r"\bbug\b", IssueType.BUG, 0.9, "both"),
            DetectionRule("fix_indicator", r"\bfix\b", IssueType.BUG, 0.8, "both"),
            DetectionRule("error_indicator", r"\berror\b", IssueType.BUG, 0.75, "both"),
            DetectionRule("issue_indicator", r"\bissue\b", IssueType.BUG, 0.6, "both"),
            DetectionRule("defect_indicator", r"\bdefect\b", IssueType.BUG, 0.85, "both"),
            DetectionRule("problem_indicator", r"\bproblem\b", IssueType.BUG, 0.7, "both"),
            
            # Improvement detection rules
            DetectionRule("improvement_explicit", r"\bimprovement\b", IssueType.IMPROVEMENT, 0.9, "both"),
            DetectionRule("enhance_indicator", r"\b(enhance|enhancement)\b", IssueType.IMPROVEMENT, 0.8, "both"),
            DetectionRule("optimize_indicator", r"\b(optimize|optimization)\b", IssueType.IMPROVEMENT, 0.8, "both"),
            DetectionRule("improve_indicator", r"\bimprove\b", IssueType.IMPROVEMENT, 0.75, "both"),
            DetectionRule("upgrade_indicator", r"\bupgrade\b", IssueType.IMPROVEMENT, 0.7, "both"),
            DetectionRule("update_indicator", r"\bupdate\b", IssueType.IMPROVEMENT, 0.65, "both"),
            
            # Maintenance detection rules
            DetectionRule("maintenance_explicit", r"\bmaintenance\b", IssueType.MAINTENANCE, 0.9, "both"),
            DetectionRule("refactor_indicator", r"\brefactor\b", IssueType.MAINTENANCE, 0.85, "both"),
            DetectionRule("cleanup_indicator", r"\bcleanup\b", IssueType.MAINTENANCE, 0.8, "both"),
            DetectionRule("dependencies", r"\b(deps|dependencies)\b", IssueType.MAINTENANCE, 0.75, "both"),
            DetectionRule("tech_debt", r"\b(technical\s*debt|tech\s*debt)\b", IssueType.MAINTENANCE, 0.8, "both"),
        ]
    
    def _initialize_structural_weights(self) -> Dict[int, Dict[IssueType, float]]:
        """Initialize structural weights based on heading level."""
        return {
            1: {  # H1 - Usually document title, rarely trackable
                IssueType.EPIC: 0.2,
                IssueType.FEATURE: 0.1,
                IssueType.TASK: 0.0,
                IssueType.BUG: 0.0,
                IssueType.IMPROVEMENT: 0.1,
                IssueType.MAINTENANCE: 0.0
            },
            2: {  # H2 - Usually epics or major sections
                IssueType.EPIC: 0.8,
                IssueType.FEATURE: 0.3,
                IssueType.TASK: 0.1,
                IssueType.BUG: 0.2,
                IssueType.IMPROVEMENT: 0.3,
                IssueType.MAINTENANCE: 0.2
            },
            3: {  # H3 - Usually features/stories
                IssueType.EPIC: 0.2,
                IssueType.FEATURE: 0.8,
                IssueType.TASK: 0.3,
                IssueType.BUG: 0.6,
                IssueType.IMPROVEMENT: 0.7,
                IssueType.MAINTENANCE: 0.5
            },
            4: {  # H4 - Usually tasks or detailed features
                IssueType.EPIC: 0.0,
                IssueType.FEATURE: 0.4,
                IssueType.TASK: 0.8,
                IssueType.BUG: 0.7,
                IssueType.IMPROVEMENT: 0.6,
                IssueType.MAINTENANCE: 0.7
            },
            5: {  # H5 - Usually tasks or implementation details
                IssueType.EPIC: 0.0,
                IssueType.FEATURE: 0.2,
                IssueType.TASK: 0.9,
                IssueType.BUG: 0.8,
                IssueType.IMPROVEMENT: 0.5,
                IssueType.MAINTENANCE: 0.8
            },
            6: {  # H6 - Usually tasks or very detailed items
                IssueType.EPIC: 0.0,
                IssueType.FEATURE: 0.1,
                IssueType.TASK: 0.9,
                IssueType.BUG: 0.8,
                IssueType.IMPROVEMENT: 0.4,
                IssueType.MAINTENANCE: 0.8
            }
        }
    
    def _initialize_keyword_weights(self) -> Dict[str, Dict[IssueType, float]]:
        """Initialize keyword-based scoring weights."""
        return {
            # Action verbs that indicate type
            "implement": {IssueType.FEATURE: 0.7, IssueType.TASK: 0.8},
            "create": {IssueType.FEATURE: 0.8, IssueType.TASK: 0.6},
            "build": {IssueType.FEATURE: 0.7, IssueType.TASK: 0.7},
            "develop": {IssueType.FEATURE: 0.8, IssueType.EPIC: 0.3},
            "design": {IssueType.FEATURE: 0.6, IssueType.EPIC: 0.4},
            "add": {IssueType.FEATURE: 0.7, IssueType.IMPROVEMENT: 0.3},
            "remove": {IssueType.MAINTENANCE: 0.6, IssueType.BUG: 0.3},
            "delete": {IssueType.MAINTENANCE: 0.7, IssueType.BUG: 0.2},
            "modify": {IssueType.IMPROVEMENT: 0.6, IssueType.BUG: 0.4},
            "change": {IssueType.IMPROVEMENT: 0.5, IssueType.BUG: 0.3},
            "replace": {IssueType.IMPROVEMENT: 0.6, IssueType.MAINTENANCE: 0.4},
            
            # Context indicators
            "framework": {IssueType.EPIC: 0.4, IssueType.FEATURE: 0.3},
            "system": {IssueType.EPIC: 0.5, IssueType.FEATURE: 0.2},
            "architecture": {IssueType.EPIC: 0.6, IssueType.FEATURE: 0.2},
            "integration": {IssueType.FEATURE: 0.6, IssueType.TASK: 0.4},
            "api": {IssueType.FEATURE: 0.5, IssueType.TASK: 0.3},
            "endpoint": {IssueType.FEATURE: 0.6, IssueType.TASK: 0.4},
            "component": {IssueType.FEATURE: 0.6, IssueType.TASK: 0.3},
            "service": {IssueType.FEATURE: 0.5, IssueType.TASK: 0.3},
            "database": {IssueType.FEATURE: 0.4, IssueType.TASK: 0.4},
            "schema": {IssueType.FEATURE: 0.5, IssueType.TASK: 0.3},
            "migration": {IssueType.TASK: 0.7, IssueType.MAINTENANCE: 0.3},
            "test": {IssueType.TASK: 0.6, IssueType.FEATURE: 0.2},
            "documentation": {IssueType.TASK: 0.5, IssueType.MAINTENANCE: 0.3},
            
            # Size/scope indicators
            "complete": {IssueType.EPIC: 0.4, IssueType.FEATURE: 0.3},
            "comprehensive": {IssueType.EPIC: 0.5, IssueType.FEATURE: 0.2},
            "full": {IssueType.EPIC: 0.3, IssueType.FEATURE: 0.3},
            "basic": {IssueType.FEATURE: 0.3, IssueType.TASK: 0.4},
            "simple": {IssueType.TASK: 0.5, IssueType.FEATURE: 0.2},
            "quick": {IssueType.TASK: 0.6, IssueType.BUG: 0.2},
            "minor": {IssueType.TASK: 0.5, IssueType.BUG: 0.3, IssueType.IMPROVEMENT: 0.3},
            "major": {IssueType.EPIC: 0.4, IssueType.FEATURE: 0.4},
        }
    
    def classify_section(self, section: MarkdownSection) -> ClassificationResult:
        """Classify a markdown section and return detailed results."""
        scores = {issue_type: 0.0 for issue_type in IssueType}
        reasoning = []
        
        # Apply pattern-based rules
        pattern_scores, pattern_reasoning = self._apply_pattern_rules(section)
        for issue_type, score in pattern_scores.items():
            scores[issue_type] += score
        reasoning.extend(pattern_reasoning)
        
        # Apply structural analysis
        structural_scores, structural_reasoning = self._apply_structural_analysis(section)
        for issue_type, score in structural_scores.items():
            scores[issue_type] += score
        reasoning.extend(structural_reasoning)
        
        # Apply keyword analysis
        keyword_scores, keyword_reasoning = self._apply_keyword_analysis(section)
        for issue_type, score in keyword_scores.items():
            scores[issue_type] += score
        reasoning.extend(keyword_reasoning)
        
        # Apply content analysis
        content_scores, content_reasoning = self._apply_content_analysis(section)
        for issue_type, score in content_scores.items():
            scores[issue_type] += score
        reasoning.extend(content_reasoning)
        
        # Normalize scores
        max_score = max(scores.values()) if scores.values() else 0
        if max_score > 0:
            scores = {k: v / max_score for k, v in scores.items()}
        
        # Determine best classification
        best_type = max(scores, key=scores.get)
        confidence = scores[best_type]
        
        # Determine confidence level
        if confidence >= 0.9:
            confidence_level = ConfidenceLevel.VERY_HIGH
        elif confidence >= 0.75:
            confidence_level = ConfidenceLevel.HIGH
        elif confidence >= 0.5:
            confidence_level = ConfidenceLevel.MEDIUM
        elif confidence >= 0.25:
            confidence_level = ConfidenceLevel.LOW
        else:
            confidence_level = ConfidenceLevel.VERY_LOW
        
        return ClassificationResult(
            issue_type=best_type,
            confidence=confidence,
            confidence_level=confidence_level,
            reasoning=reasoning,
            score_breakdown=scores
        )
    
    def _apply_pattern_rules(self, section: MarkdownSection) -> Tuple[Dict[IssueType, float], List[str]]:
        """Apply pattern-based detection rules."""
        scores = {issue_type: 0.0 for issue_type in IssueType}
        reasoning = []
        
        title_lower = section.title.lower()
        content_lower = section.content.lower()
        
        for rule in self.detection_rules:
            text_to_search = ""
            if rule.context == "title":
                text_to_search = title_lower
            elif rule.context == "content":
                text_to_search = content_lower
            else:  # "both"
                text_to_search = f"{title_lower} {content_lower}"
            
            if re.search(rule.pattern, text_to_search, rule.flags):
                scores[rule.issue_type] += rule.weight
                reasoning.append(f"Pattern '{rule.name}' matched (weight: {rule.weight})")
        
        return scores, reasoning
    
    def _apply_structural_analysis(self, section: MarkdownSection) -> Tuple[Dict[IssueType, float], List[str]]:
        """Apply structural analysis based on heading level and content structure."""
        scores = {issue_type: 0.0 for issue_type in IssueType}
        reasoning = []
        
        # Header level analysis
        if section.level in self.structural_weights:
            level_weights = self.structural_weights[section.level]
            for issue_type, weight in level_weights.items():
                scores[issue_type] += weight
            reasoning.append(f"Header level {section.level} analysis applied")
        
        # Content structure analysis
        content = section.content
        
        # Check for task lists (indicates tasks or detailed features)
        task_list_count = len(re.findall(r'^\s*-\s*\[\s*\]\s*', content, re.MULTILINE))
        if task_list_count > 0:
            scores[IssueType.TASK] += min(0.3 + (task_list_count * 0.1), 0.8)
            scores[IssueType.FEATURE] += 0.2
            reasoning.append(f"Found {task_list_count} task list items")
        
        # Check for acceptance criteria sections
        if re.search(r'acceptance\s*criteria', content, re.IGNORECASE):
            scores[IssueType.FEATURE] += 0.4
            scores[IssueType.EPIC] += 0.2
            reasoning.append("Acceptance criteria section found")
        
        # Check for code blocks (indicates implementation tasks)
        code_block_count = len(re.findall(r'```', content))
        if code_block_count >= 2:  # At least one complete code block
            scores[IssueType.TASK] += 0.3
            reasoning.append("Code blocks found (implementation focus)")
        
        # Check for numbered steps
        numbered_steps = len(re.findall(r'^\s*\d+\.\s*', content, re.MULTILINE))
        if numbered_steps > 2:
            scores[IssueType.TASK] += 0.2
            scores[IssueType.FEATURE] += 0.1
            reasoning.append(f"Found {numbered_steps} numbered steps")
        
        return scores, reasoning
    
    def _apply_keyword_analysis(self, section: MarkdownSection) -> Tuple[Dict[IssueType, float], List[str]]:
        """Apply keyword-based analysis."""
        scores = {issue_type: 0.0 for issue_type in IssueType}
        reasoning = []
        
        combined_text = f"{section.title} {section.content}".lower()
        
        for keyword, type_weights in self.keyword_weights.items():
            if re.search(rf'\b{keyword}\b', combined_text):
                for issue_type, weight in type_weights.items():
                    scores[issue_type] += weight
                reasoning.append(f"Keyword '{keyword}' found")
        
        return scores, reasoning
    
    def _apply_content_analysis(self, section: MarkdownSection) -> Tuple[Dict[IssueType, float], List[str]]:
        """Apply advanced content analysis."""
        scores = {issue_type: 0.0 for issue_type in IssueType}
        reasoning = []
        
        content = section.content
        title = section.title
        
        # Analyze content length and complexity
        word_count = len(content.split())
        sentence_count = len(re.findall(r'[.!?]+', content))
        
        if word_count > 200:  # Long content suggests epic or complex feature
            scores[IssueType.EPIC] += 0.2
            scores[IssueType.FEATURE] += 0.1
            reasoning.append(f"Long content ({word_count} words) suggests epic/feature")
        elif word_count < 50:  # Short content suggests task
            scores[IssueType.TASK] += 0.2
            reasoning.append(f"Short content ({word_count} words) suggests task")
        
        # Analyze question marks (often in user stories)
        question_count = content.count('?')
        if question_count > 0:
            scores[IssueType.FEATURE] += min(0.1 + (question_count * 0.05), 0.3)
            reasoning.append("Questions found (user story pattern)")
        
        # Analyze "as a" pattern (user story format)
        if re.search(r'\bas\s+a\s+\w+', content, re.IGNORECASE):
            scores[IssueType.FEATURE] += 0.5
            reasoning.append("'As a...' pattern found (user story)")
        
        # Analyze "so that" pattern (user story format)
        if re.search(r'\bso\s+that\b', content, re.IGNORECASE):
            scores[IssueType.FEATURE] += 0.3
            reasoning.append("'So that...' pattern found (user story)")
        
        # Analyze time estimates
        if re.search(r'\d+\s*h(?:ours?|rs?)\b', content, re.IGNORECASE):
            scores[IssueType.TASK] += 0.3
            scores[IssueType.FEATURE] += 0.1
            reasoning.append("Time estimate found (task/feature)")
        
        # Analyze technical terms
        technical_terms = [
            'api', 'endpoint', 'database', 'schema', 'query', 'service',
            'component', 'class', 'method', 'function', 'interface',
            'repository', 'controller', 'model', 'view', 'template'
        ]
        
        tech_term_count = sum(1 for term in technical_terms 
                             if re.search(rf'\b{term}\b', content, re.IGNORECASE))
        
        if tech_term_count > 2:
            scores[IssueType.TASK] += 0.2
            scores[IssueType.FEATURE] += 0.1
            reasoning.append(f"Multiple technical terms found ({tech_term_count})")
        
        return scores, reasoning
    
    def detect_priority(self, section: MarkdownSection) -> Tuple[Priority, float, List[str]]:
        """Detect priority level from section content."""
        scores = {priority: 0.0 for priority in Priority}
        reasoning = []
        
        combined_text = f"{section.title} {section.content}".lower()
        
        # Priority indicators
        priority_indicators = {
            Priority.URGENT: [
                (r'\burgent\b', 1.0),
                (r'\bcritical\b', 0.9),
                (r'\bemergency\b', 0.95),
                (r'\bblocker\b', 0.8),
                (r'\basap\b', 0.7),
                (r'\bimmediate\b', 0.8)
            ],
            Priority.HIGH: [
                (r'\bhigh\s*priority\b', 0.9),
                (r'\bimportant\b', 0.6),
                (r'\bmust\s*have\b', 0.7),
                (r'\brequired\b', 0.5),
                (r'\bcrucial\b', 0.7),
                (r'\bvital\b', 0.6)
            ],
            Priority.MEDIUM: [
                (r'\bmedium\b', 0.8),
                (r'\bnormal\b', 0.7),
                (r'\bshould\s*have\b', 0.6),
                (r'\bdesirable\b', 0.5)
            ],
            Priority.LOW: [
                (r'\blow\s*priority\b', 0.9),
                (r'\bnice\s*to\s*have\b', 0.8),
                (r'\bcould\s*have\b', 0.7),
                (r'\boptional\b', 0.6),
                (r'\bwhen\s*time\s*permits\b', 0.7)
            ]
        }
        
        for priority, indicators in priority_indicators.items():
            for pattern, weight in indicators:
                if re.search(pattern, combined_text):
                    scores[priority] += weight
                    reasoning.append(f"Priority indicator '{pattern}' found")
        
        # Default to medium if no indicators found
        if all(score == 0 for score in scores.values()):
            scores[Priority.MEDIUM] = 0.5
            reasoning.append("No priority indicators found, defaulting to medium")
        
        best_priority = max(scores, key=scores.get)
        confidence = scores[best_priority]
        
        return best_priority, confidence, reasoning


# Convenience functions
def classify_issue_type(section: MarkdownSection) -> ClassificationResult:
    """Classify a section's issue type using advanced detection."""
    detector = AdvancedIssueDetector()
    return detector.classify_section(section)


def detect_issue_priority(section: MarkdownSection) -> Tuple[Priority, float, List[str]]:
    """Detect the priority of a section using advanced analysis."""
    detector = AdvancedIssueDetector()
    return detector.detect_priority(section)