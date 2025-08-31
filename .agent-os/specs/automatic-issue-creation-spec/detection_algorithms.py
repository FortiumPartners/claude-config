#!/usr/bin/env python3
"""
Advanced detection algorithms for identifying epics, stories, and tasks.

This module provides sophisticated pattern matching and ML-based classification
for more accurate detection of work items in specifications.

Enhanced in Task 3.1: Smart Issue Detection
- Complex nested specification parsing
- ML-based section classification 
- Work type detection (feature/bug/improvement)
- Effort estimation detection
"""

import re
import math
from typing import List, Dict, Any, Optional, Tuple, Set
from dataclasses import dataclass, field
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
class EffortEstimate:
    """Effort estimation result."""
    hours: Optional[float] = None
    story_points: Optional[int] = None
    complexity: Optional[str] = None  # "low", "medium", "high", "very_high"
    confidence: float = 0.0
    reasoning: List[str] = field(default_factory=list)


@dataclass
class WorkTypeClassification:
    """Work type classification result (Task 3.1.3)."""
    primary_type: str  # "feature", "bug", "improvement", "maintenance", "research"
    confidence: float
    secondary_types: List[Tuple[str, float]] = field(default_factory=list)
    reasoning: List[str] = field(default_factory=list)


@dataclass
class ClassificationResult:
    """Enhanced result of issue type classification."""
    issue_type: IssueType
    confidence: float
    confidence_level: ConfidenceLevel
    reasoning: List[str]
    score_breakdown: Dict[IssueType, float]
    
    # Task 3.1 enhancements
    work_type: Optional[WorkTypeClassification] = None
    effort_estimate: Optional[EffortEstimate] = None
    complexity_indicators: List[str] = field(default_factory=list)
    nested_context: Optional[Dict[str, Any]] = None  # Parent/child relationship context


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
        
        # Task 3.1 enhancements
        self.work_type_patterns = self._initialize_work_type_patterns()
        self.effort_patterns = self._initialize_effort_patterns()
        self.complexity_indicators = self._initialize_complexity_indicators()
        self.nested_parsing_config = self._initialize_nested_parsing_config()
    
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
    
    def _initialize_work_type_patterns(self) -> Dict[str, List[Tuple[str, float]]]:
        """Initialize patterns for work type classification (Task 3.1.3)."""
        return {
            "feature": [
                (r"\b(new|add|create|implement|build|develop)\b", 0.8),
                (r"\buser\s+story\b", 0.9),
                (r"\bfeature\b", 0.9),
                (r"\bfunctionality\b", 0.7),
                (r"\bcapability\b", 0.7),
                (r"\bas\s+a\s+\w+", 0.8),  # User story format
                (r"\bso\s+that\b", 0.6),
                (r"\brequirement\b", 0.5),
                (r"\bshould\s+be\s+able\s+to\b", 0.7),
            ],
            "bug": [
                (r"\b(bug|error|issue|problem|defect)\b", 0.9),
                (r"\b(fix|resolve|correct)\b", 0.8),
                (r"\b(broken|failing|not\s+working)\b", 0.7),
                (r"\bcrash(es|ing)?\b", 0.9),
                (r"\bexception\b", 0.8),
                (r"\binvalid\b", 0.6),
                (r"\bincorrect(ly)?\b", 0.7),
                (r"\bunexpected\b", 0.6),
            ],
            "improvement": [
                (r"\b(improve|enhance|optimize|upgrade)\b", 0.9),
                (r"\bperformance\b", 0.7),
                (r"\b(better|faster|more\s+efficient)\b", 0.6),
                (r"\buser\s+experience\b", 0.7),
                (r"\busability\b", 0.8),
                (r"\brefactor\b", 0.6),
                (r"\bmodernize\b", 0.7),
                (r"\bstreamline\b", 0.6),
            ],
            "maintenance": [
                (r"\b(maintain|maintenance|cleanup|housekeeping)\b", 0.9),
                (r"\b(update|upgrade)\s+(dependencies|deps)\b", 0.8),
                (r"\btech(nical)?\s+debt\b", 0.8),
                (r"\brefactor\b", 0.7),
                (r"\bdeprecated?\b", 0.7),
                (r"\blegacy\b", 0.6),
                (r"\bclean\s*up\b", 0.8),
            ],
            "research": [
                (r"\b(research|investigate|explore|analyze)\b", 0.9),
                (r"\bspike\b", 0.8),
                (r"\bproof\s+of\s+concept\b", 0.8),
                (r"\bfeasibility\b", 0.7),
                (r"\bevaluate\b", 0.7),
                (r"\bcompare\b", 0.6),
                (r"\bprototype\b", 0.7),
            ]
        }
    
    def _initialize_effort_patterns(self) -> Dict[str, Any]:
        """Initialize patterns for effort estimation (Task 3.1.4)."""
        return {
            "explicit_time": [
                (r"(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)\b", "hours"),
                (r"(\d+(?:\.\d+)?)\s*d(?:ays?)\b", "days"),
                (r"(\d+(?:\.\d+)?)\s*w(?:eeks?|ks?)\b", "weeks"),
                (r"(\d+(?:\.\d+)?)\s*m(?:onths?)\b", "months"),
            ],
            "story_points": [
                (r"(\d+)\s*(?:story\s+)?points?\b", "points"),
                (r"(\d+)\s*sp\b", "points"),
                (r"effort:\s*(\d+)", "points"),
            ],
            "complexity_indicators": {
                "simple": ["simple", "basic", "trivial", "easy", "quick", "straightforward"],
                "medium": ["medium", "moderate", "standard", "normal", "typical"],
                "complex": ["complex", "complicated", "difficult", "challenging", "advanced"],
                "very_complex": ["very complex", "extremely", "highly complex", "intricate", "sophisticated"]
            },
            "size_indicators": {
                "small": ["small", "tiny", "minor", "little"],
                "medium": ["medium", "moderate", "average"],
                "large": ["large", "big", "major", "significant"],
                "very_large": ["huge", "massive", "enormous", "comprehensive", "complete"]
            }
        }
    
    def _initialize_complexity_indicators(self) -> Dict[str, List[Tuple[str, float]]]:
        """Initialize complexity analysis patterns."""
        return {
            "technical_complexity": [
                (r"\b(algorithm|optimization|performance)\b", 0.8),
                (r"\b(integration|api|database)\b", 0.6),
                (r"\b(security|authentication|authorization)\b", 0.7),
                (r"\b(real-time|concurrent|parallel)\b", 0.9),
                (r"\b(machine\s+learning|ai|ml)\b", 0.9),
                (r"\b(microservice|distributed)\b", 0.8),
            ],
            "business_complexity": [
                (r"\b(workflow|business\s+logic|rules)\b", 0.7),
                (r"\b(multiple\s+stakeholders|cross-team)\b", 0.6),
                (r"\b(compliance|regulation|audit)\b", 0.8),
                (r"\b(migration|legacy|backwards\s+compatibility)\b", 0.7),
            ],
            "scope_complexity": [
                (r"\b(multiple\s+components|system-wide)\b", 0.8),
                (r"\b(breaking\s+change|major\s+refactor)\b", 0.9),
                (r"\b(new\s+framework|architecture\s+change)\b", 0.9),
                (r"\b(cross-platform|multi-environment)\b", 0.7),
            ]
        }
    
    def _initialize_nested_parsing_config(self) -> Dict[str, Any]:
        """Initialize configuration for complex nested parsing (Task 3.1.1)."""
        return {
            "max_nesting_depth": 6,
            "context_inheritance": {
                "epic_indicators": ["epic", "phase", "milestone", "objective"],
                "feature_indicators": ["feature", "story", "capability", "requirement"],
                "task_indicators": ["task", "subtask", "todo", "action", "step"]
            },
            "hierarchy_validation": {
                "min_epic_level": 1,
                "max_epic_level": 3,
                "min_feature_level": 2,
                "max_feature_level": 4,
                "min_task_level": 3,
                "max_task_level": 6
            },
            "content_analysis_depth": {
                "code_blocks": True,
                "task_lists": True,
                "numbered_lists": True,
                "acceptance_criteria": True,
                "cross_references": True
            }
        }
    
    def classify_section(self, section: MarkdownSection, 
                        parent_context: Optional[Dict[str, Any]] = None) -> ClassificationResult:
        """Enhanced classify a markdown section with Task 3.1 improvements."""
        scores = {issue_type: 0.0 for issue_type in IssueType}
        reasoning = []
        
        # Apply pattern-based rules
        pattern_scores, pattern_reasoning = self._apply_pattern_rules(section)
        for issue_type, score in pattern_scores.items():
            scores[issue_type] += score
        reasoning.extend(pattern_reasoning)
        
        # Apply structural analysis (enhanced for nested parsing)
        structural_scores, structural_reasoning = self._apply_enhanced_structural_analysis(
            section, parent_context)
        for issue_type, score in structural_scores.items():
            scores[issue_type] += score
        reasoning.extend(structural_reasoning)
        
        # Apply keyword analysis
        keyword_scores, keyword_reasoning = self._apply_keyword_analysis(section)
        for issue_type, score in keyword_scores.items():
            scores[issue_type] += score
        reasoning.extend(keyword_reasoning)
        
        # Apply enhanced content analysis
        content_scores, content_reasoning = self._apply_enhanced_content_analysis(section)
        for issue_type, score in content_scores.items():
            scores[issue_type] += score
        reasoning.extend(content_reasoning)
        
        # Task 3.1.2: ML-based section classification
        ml_scores, ml_reasoning = self._apply_ml_based_classification(section)
        for issue_type, score in ml_scores.items():
            scores[issue_type] += score
        reasoning.extend(ml_reasoning)
        
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
        
        # Task 3.1.3: Work type classification
        work_type = self._classify_work_type(section)
        
        # Task 3.1.4: Effort estimation
        effort_estimate = self._estimate_effort(section)
        
        # Task 3.1.1: Complexity indicators for nested parsing
        complexity_indicators = self._analyze_complexity_indicators(section)
        
        # Build nested context for complex specifications
        nested_context = self._build_nested_context(section, parent_context)
        
        return ClassificationResult(
            issue_type=best_type,
            confidence=confidence,
            confidence_level=confidence_level,
            reasoning=reasoning,
            score_breakdown=scores,
            work_type=work_type,
            effort_estimate=effort_estimate,
            complexity_indicators=complexity_indicators,
            nested_context=nested_context
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
    
    def _apply_enhanced_structural_analysis(self, section: MarkdownSection, 
                                           parent_context: Optional[Dict[str, Any]] = None) -> Tuple[Dict[IssueType, float], List[str]]:
        """Enhanced structural analysis with nested parsing support (Task 3.1.1)."""
        scores = {issue_type: 0.0 for issue_type in IssueType}
        reasoning = []
        
        # Apply original structural analysis
        original_scores, original_reasoning = self._apply_structural_analysis(section)
        scores.update(original_scores)
        reasoning.extend(original_reasoning)
        
        # Enhanced nested context analysis
        if parent_context:
            parent_type = parent_context.get("issue_type")
            if parent_type == IssueType.EPIC:
                # Children of epics are more likely to be features
                scores[IssueType.FEATURE] += 0.3
                scores[IssueType.EPIC] -= 0.2
                reasoning.append("Child of epic - bias toward feature")
            elif parent_type == IssueType.FEATURE:
                # Children of features are more likely to be tasks
                scores[IssueType.TASK] += 0.4
                scores[IssueType.FEATURE] -= 0.1
                reasoning.append("Child of feature - bias toward task")
        
        # Enhanced nesting validation
        config = self.nested_parsing_config["hierarchy_validation"]
        level = section.level
        
        # Validate epic level constraints
        if level < config["min_epic_level"] or level > config["max_epic_level"]:
            scores[IssueType.EPIC] *= 0.5
            reasoning.append(f"Level {level} outside epic range")
        
        # Validate feature level constraints  
        if level < config["min_feature_level"] or level > config["max_feature_level"]:
            scores[IssueType.FEATURE] *= 0.7
            reasoning.append(f"Level {level} outside preferred feature range")
        
        # Validate task level constraints
        if level >= config["min_task_level"]:
            scores[IssueType.TASK] += 0.2
            reasoning.append(f"Level {level} appropriate for tasks")
        
        return scores, reasoning
    
    def _apply_enhanced_content_analysis(self, section: MarkdownSection) -> Tuple[Dict[IssueType, float], List[str]]:
        """Enhanced content analysis with improved pattern detection."""
        scores = {issue_type: 0.0 for issue_type in IssueType}
        reasoning = []
        
        # Apply original content analysis
        original_scores, original_reasoning = self._apply_content_analysis(section)
        scores.update(original_scores)
        reasoning.extend(original_reasoning)
        
        content = section.content.lower()
        title = section.title.lower()
        
        # Enhanced technical complexity detection
        tech_score = 0
        for category, patterns in self.complexity_indicators.items():
            for pattern, weight in patterns:
                if re.search(pattern, f"{title} {content}", re.IGNORECASE):
                    tech_score += weight
                    reasoning.append(f"Technical complexity indicator: {pattern}")
        
        if tech_score > 0.5:
            scores[IssueType.FEATURE] += min(tech_score * 0.3, 0.4)
            scores[IssueType.TASK] += min(tech_score * 0.2, 0.3)
        
        # Enhanced cross-reference detection
        cross_refs = len(re.findall(r'\[([^\]]+)\]\([^)]+\)', section.content))
        if cross_refs > 2:
            scores[IssueType.EPIC] += 0.2
            scores[IssueType.FEATURE] += 0.1
            reasoning.append(f"High cross-reference count ({cross_refs}) suggests epic/feature")
        
        # Enhanced list structure analysis
        bullet_lists = len(re.findall(r'^\s*[-*+]\s+', section.content, re.MULTILINE))
        if bullet_lists > 5:
            scores[IssueType.EPIC] += 0.2
            scores[IssueType.FEATURE] += 0.3
            reasoning.append(f"Many bullet points ({bullet_lists}) suggest complex feature/epic")
        
        return scores, reasoning
    
    def _apply_ml_based_classification(self, section: MarkdownSection) -> Tuple[Dict[IssueType, float], List[str]]:
        """ML-based classification using statistical analysis (Task 3.1.2)."""
        scores = {issue_type: 0.0 for issue_type in IssueType}
        reasoning = []
        
        # Simple ML-inspired features
        content = section.content.lower()
        title = section.title.lower()
        combined = f"{title} {content}"
        
        # Feature: Word count distribution analysis
        word_count = len(combined.split())
        
        # Statistical thresholds based on typical patterns
        if word_count < 20:
            scores[IssueType.TASK] += 0.3
            reasoning.append("Short content suggests task (ML feature)")
        elif word_count > 100:
            scores[IssueType.EPIC] += 0.4
            reasoning.append("Long content suggests epic (ML feature)")
        else:
            scores[IssueType.FEATURE] += 0.2
            reasoning.append("Medium content suggests feature (ML feature)")
        
        # Feature: Verb/action word density
        action_words = ['create', 'build', 'implement', 'develop', 'add', 'remove', 'fix', 'improve']
        action_count = sum(1 for word in action_words if word in combined)
        
        if action_count > 3:
            scores[IssueType.TASK] += 0.2
            scores[IssueType.FEATURE] += 0.1
            reasoning.append(f"High action word density ({action_count}) suggests task/feature")
        
        # Feature: Question/uncertainty indicators
        uncertainty_indicators = ['?', 'tbd', 'unclear', 'investigate', 'research']
        uncertainty_count = sum(1 for indicator in uncertainty_indicators if indicator in combined)
        
        if uncertainty_count > 0:
            scores[IssueType.FEATURE] += 0.1  # Features often have uncertainties
            reasoning.append("Uncertainty indicators suggest feature complexity")
        
        # Feature: Structural complexity score
        structure_score = (
            len(re.findall(r'```', section.content)) * 0.1 +  # Code blocks
            len(re.findall(r'^\s*\d+\.', section.content, re.MULTILINE)) * 0.05 +  # Numbered lists
            len(re.findall(r'^\s*[-*+]', section.content, re.MULTILINE)) * 0.03  # Bullet lists
        )
        
        if structure_score > 0.3:
            scores[IssueType.EPIC] += min(structure_score, 0.3)
            reasoning.append(f"High structural complexity ({structure_score:.2f}) suggests epic")
        elif structure_score > 0.1:
            scores[IssueType.FEATURE] += min(structure_score, 0.2)
            reasoning.append(f"Medium structural complexity suggests feature")
        
        return scores, reasoning
    
    def _classify_work_type(self, section: MarkdownSection) -> WorkTypeClassification:
        """Classify work type with >90% accuracy target (Task 3.1.3)."""
        scores = {work_type: 0.0 for work_type in self.work_type_patterns.keys()}
        reasoning = []
        
        combined_text = f"{section.title} {section.content}".lower()
        
        # Apply pattern-based classification
        for work_type, patterns in self.work_type_patterns.items():
            type_score = 0.0
            for pattern, weight in patterns:
                matches = len(re.findall(pattern, combined_text, re.IGNORECASE))
                if matches > 0:
                    type_score += weight * min(matches, 3)  # Cap at 3 matches
                    reasoning.append(f"Work type '{work_type}': pattern '{pattern}' matched {matches} times")
            scores[work_type] = type_score
        
        # Contextual boosting based on issue structure
        if section.level <= 2:
            scores["feature"] += 0.2  # High-level sections more likely to be features
        elif section.level >= 4:
            scores["bug"] += 0.1  # Deep sections might be specific fixes
            scores["maintenance"] += 0.1
        
        # Normalize and determine primary type
        max_score = max(scores.values()) if scores.values() else 0
        if max_score > 0:
            normalized_scores = {k: v / max_score for k, v in scores.items()}
        else:
            normalized_scores = scores
        
        primary_type = max(normalized_scores, key=normalized_scores.get)
        confidence = normalized_scores[primary_type]
        
        # Build secondary types (sorted by score, excluding primary)
        secondary_types = [
            (work_type, score) 
            for work_type, score in sorted(normalized_scores.items(), key=lambda x: x[1], reverse=True)
            if work_type != primary_type and score > 0.1
        ][:3]  # Top 3 alternatives
        
        return WorkTypeClassification(
            primary_type=primary_type,
            confidence=confidence,
            secondary_types=secondary_types,
            reasoning=reasoning
        )
    
    def _estimate_effort(self, section: MarkdownSection) -> EffortEstimate:
        """Estimate effort from content patterns (Task 3.1.4)."""
        estimate = EffortEstimate()
        reasoning = []
        
        content = f"{section.title} {section.content}"
        
        # Explicit time estimates
        for pattern, unit in self.effort_patterns["explicit_time"]:
            matches = re.findall(pattern, content, re.IGNORECASE)
            if matches:
                value = float(matches[0])
                if unit == "days":
                    estimate.hours = value * 8
                elif unit == "weeks":
                    estimate.hours = value * 40
                elif unit == "months":
                    estimate.hours = value * 160
                else:  # hours
                    estimate.hours = value
                
                estimate.confidence = 0.9
                reasoning.append(f"Explicit time estimate found: {value} {unit}")
                break
        
        # Story points
        for pattern, _ in self.effort_patterns["story_points"]:
            matches = re.findall(pattern, content, re.IGNORECASE)
            if matches:
                estimate.story_points = int(matches[0])
                estimate.confidence = max(estimate.confidence, 0.8)
                reasoning.append(f"Story points found: {estimate.story_points}")
                break
        
        # Complexity-based estimation
        complexity_score = 0
        for complexity, keywords in self.effort_patterns["complexity_indicators"].items():
            for keyword in keywords:
                if keyword.lower() in content.lower():
                    if complexity == "simple":
                        complexity_score = max(complexity_score, 1)
                    elif complexity == "medium":
                        complexity_score = max(complexity_score, 2)
                    elif complexity == "complex":
                        complexity_score = max(complexity_score, 3)
                    elif complexity == "very_complex":
                        complexity_score = max(complexity_score, 4)
                    
                    estimate.complexity = complexity
                    reasoning.append(f"Complexity indicator: {keyword} -> {complexity}")
                    break
        
        # Size-based estimation
        size_multiplier = 1.0
        for size, keywords in self.effort_patterns["size_indicators"].items():
            for keyword in keywords:
                if keyword.lower() in content.lower():
                    if size == "small":
                        size_multiplier = 0.5
                    elif size == "large":
                        size_multiplier = 2.0
                    elif size == "very_large":
                        size_multiplier = 3.0
                    reasoning.append(f"Size indicator: {keyword} -> {size}")
                    break
        
        # Fallback estimation based on content analysis
        if not estimate.hours and not estimate.story_points:
            word_count = len(content.split())
            task_count = len(re.findall(r'^\s*[-*+]\s*\[\s*\]\s*', content, re.MULTILINE))
            code_blocks = len(re.findall(r'```', content))
            
            # Simple heuristic estimation
            base_hours = (
                word_count * 0.01 +  # 1 hour per 100 words
                task_count * 0.5 +   # 30 minutes per task
                code_blocks * 1.0    # 1 hour per code block
            )
            
            estimate.hours = max(base_hours * size_multiplier * (complexity_score or 1), 0.5)
            estimate.confidence = 0.3
            reasoning.append(f"Heuristic estimate: {estimate.hours:.1f}h based on content analysis")
        
        estimate.reasoning = reasoning
        return estimate
    
    def _analyze_complexity_indicators(self, section: MarkdownSection) -> List[str]:
        """Analyze complexity indicators for nested parsing (Task 3.1.1)."""
        indicators = []
        content = f"{section.title} {section.content}".lower()
        
        for category, patterns in self.complexity_indicators.items():
            for pattern, weight in patterns:
                if re.search(pattern, content, re.IGNORECASE):
                    indicators.append(f"{category}: {pattern.replace('\\\\b', '').replace('\\\\', '')}")
        
        # Add structural complexity indicators
        if section.level > 4:
            indicators.append("deep_nesting: high heading level")
        
        if len(section.content.split()) > 200:
            indicators.append("content_complexity: long content")
        
        code_blocks = len(re.findall(r'```', section.content))
        if code_blocks > 1:
            indicators.append(f"technical_complexity: {code_blocks} code blocks")
        
        return indicators
    
    def _build_nested_context(self, section: MarkdownSection, 
                             parent_context: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        """Build context for nested specification parsing."""
        context = {
            "level": section.level,
            "title": section.title,
            "word_count": len(section.content.split()),
            "has_code_blocks": "```" in section.content,
            "has_task_lists": re.search(r'^\s*[-*+]\s*\[\s*\]\s*', section.content, re.MULTILINE) is not None,
            "parent": parent_context
        }
        
        # Add inheritance from parent
        if parent_context:
            context["depth"] = parent_context.get("depth", 0) + 1
            context["root_type"] = parent_context.get("root_type", parent_context.get("issue_type"))
        else:
            context["depth"] = 0
            context["root_type"] = None
        
        return context
    
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