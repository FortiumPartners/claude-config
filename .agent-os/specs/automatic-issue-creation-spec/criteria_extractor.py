#!/usr/bin/env python3
"""
Acceptance criteria extraction from specification documents.

This module provides advanced extraction of acceptance criteria from various
formats and structures commonly found in product specifications.
"""

import re
from typing import List, Dict, Optional, Tuple, Set
from dataclasses import dataclass
from enum import Enum
from issue_spec import AcceptanceCriteria


class CriteriaFormat(Enum):
    """Different formats for acceptance criteria."""
    GIVEN_WHEN_THEN = "given_when_then"
    BULLET_POINTS = "bullet_points"
    NUMBERED_LIST = "numbered_list"
    CHECKBOX_LIST = "checkbox_list"
    SCENARIO_OUTLINE = "scenario_outline"
    USER_STORY_FORMAT = "user_story_format"


@dataclass
class ExtractedCriteria:
    """Container for extracted acceptance criteria with metadata."""
    criteria: List[str]
    format_type: CriteriaFormat
    confidence: float
    source_section: str
    line_numbers: List[int]


class AcceptanceCriteriaExtractor:
    """
    Advanced extractor for acceptance criteria from markdown specifications.
    
    Handles multiple formats including:
    - Given/When/Then scenarios
    - Bullet point lists
    - Numbered lists
    - Checkbox lists
    - User story acceptance criteria
    - Scenario outlines
    """
    
    def __init__(self):
        self.criteria_section_patterns = [
            r'acceptance\s*criteria\s*:?',
            r'success\s*criteria\s*:?',
            r'definition\s*of\s*done\s*:?',
            r'requirements\s*:?',
            r'conditions\s*:?',
            r'criteria\s*:?',
            r'specifications\s*:?',
            r'expectations\s*:?'
        ]
        
        self.scenario_patterns = [
            r'given\s+.*when\s+.*then\s+',
            r'scenario\s*:?',
            r'example\s*:?',
            r'test\s*case\s*:?'
        ]
        
        self.user_story_patterns = [
            r'as\s+a\s+.*i\s+want\s+.*so\s+that\s+',
            r'as\s+a\s+.*i\s+need\s+.*so\s+that\s+',
            r'as\s+a\s+.*i\s+can\s+.*so\s+that\s+'
        ]
    
    def extract_from_content(self, content: str, section_title: str = "") -> List[ExtractedCriteria]:
        """Extract all acceptance criteria from content."""
        extracted_criteria = []
        
        # Extract from explicit acceptance criteria sections
        explicit_criteria = self._extract_explicit_criteria_sections(content, section_title)
        extracted_criteria.extend(explicit_criteria)
        
        # Extract from scenario formats
        scenario_criteria = self._extract_scenario_formats(content, section_title)
        extracted_criteria.extend(scenario_criteria)
        
        # Extract from user story formats
        user_story_criteria = self._extract_user_story_formats(content, section_title)
        extracted_criteria.extend(user_story_criteria)
        
        # Extract from task lists
        task_list_criteria = self._extract_task_lists(content, section_title)
        extracted_criteria.extend(task_list_criteria)
        
        # Extract from implicit criteria patterns
        implicit_criteria = self._extract_implicit_criteria(content, section_title)
        extracted_criteria.extend(implicit_criteria)
        
        return extracted_criteria
    
    def _extract_explicit_criteria_sections(self, content: str, section_title: str) -> List[ExtractedCriteria]:
        """Extract from explicit acceptance criteria sections."""
        extracted = []
        
        for pattern in self.criteria_section_patterns:
            # Look for criteria sections
            regex = rf'(?:^|\n)\s*#{0,6}\s*{pattern}\s*\n(.*?)(?=\n\s*#{1,6}\s+\w+|\Z)'
            matches = re.finditer(regex, content, re.IGNORECASE | re.DOTALL | re.MULTILINE)
            
            for match in matches:
                criteria_content = match.group(1).strip()
                if criteria_content:
                    criteria_list, format_type = self._parse_criteria_content(criteria_content)
                    
                    if criteria_list:
                        extracted.append(ExtractedCriteria(
                            criteria=criteria_list,
                            format_type=format_type,
                            confidence=0.9,
                            source_section=section_title,
                            line_numbers=self._get_line_numbers(content, match.start(), match.end())
                        ))
        
        return extracted
    
    def _extract_scenario_formats(self, content: str, section_title: str) -> List[ExtractedCriteria]:
        """Extract Given/When/Then and other scenario formats."""
        extracted = []
        
        # Given/When/Then scenarios
        gwt_pattern = r'(?:^|\n)\s*(?:scenario\s*:?\s*)?(.+?)\s*\n\s*given\s+(.+?)\s*\n\s*when\s+(.+?)\s*\n\s*then\s+(.+?)(?=\n\n|\n\s*(?:given|scenario|$))'
        matches = re.finditer(gwt_pattern, content, re.IGNORECASE | re.DOTALL | re.MULTILINE)
        
        for match in matches:
            scenario_name = match.group(1).strip() if match.group(1).strip() else "Scenario"
            given = match.group(2).strip()
            when = match.group(3).strip()
            then = match.group(4).strip()
            
            criterion = f"{scenario_name}: Given {given}, when {when}, then {then}"
            
            extracted.append(ExtractedCriteria(
                criteria=[criterion],
                format_type=CriteriaFormat.GIVEN_WHEN_THEN,
                confidence=0.95,
                source_section=section_title,
                line_numbers=self._get_line_numbers(content, match.start(), match.end())
            ))
        
        # Scenario outlines
        outline_pattern = r'(?:^|\n)\s*scenario\s*outline\s*:?\s*(.+?)\n(.*?)(?=\n\s*(?:scenario|$)|\Z)'
        matches = re.finditer(outline_pattern, content, re.IGNORECASE | re.DOTALL | re.MULTILINE)
        
        for match in matches:
            scenario_name = match.group(1).strip()
            scenario_content = match.group(2).strip()
            
            # Extract steps from scenario
            steps = re.findall(r'(?:given|when|then|and|but)\s+(.+)', scenario_content, re.IGNORECASE)
            
            if steps:
                criterion = f"Scenario Outline - {scenario_name}: " + " → ".join(steps)
                
                extracted.append(ExtractedCriteria(
                    criteria=[criterion],
                    format_type=CriteriaFormat.SCENARIO_OUTLINE,
                    confidence=0.85,
                    source_section=section_title,
                    line_numbers=self._get_line_numbers(content, match.start(), match.end())
                ))
        
        return extracted
    
    def _extract_user_story_formats(self, content: str, section_title: str) -> List[ExtractedCriteria]:
        """Extract acceptance criteria from user story formats."""
        extracted = []
        
        for pattern in self.user_story_patterns:
            matches = re.finditer(pattern, content, re.IGNORECASE | re.DOTALL)
            
            for match in matches:
                story_text = match.group(0)
                
                # Look for acceptance criteria following the user story
                remaining_content = content[match.end():]
                criteria_match = re.search(
                    r'\n\s*(?:acceptance\s*criteria|success\s*criteria|requirements)\s*:?\s*\n(.*?)(?=\n\n|\n\s*#{1,6}|\Z)',
                    remaining_content,
                    re.IGNORECASE | re.DOTALL
                )
                
                if criteria_match:
                    criteria_content = criteria_match.group(1).strip()
                    criteria_list, format_type = self._parse_criteria_content(criteria_content)
                    
                    if criteria_list:
                        extracted.append(ExtractedCriteria(
                            criteria=criteria_list,
                            format_type=CriteriaFormat.USER_STORY_FORMAT,
                            confidence=0.8,
                            source_section=section_title,
                            line_numbers=self._get_line_numbers(content, match.start(), match.end())
                        ))
        
        return extracted
    
    def _extract_task_lists(self, content: str, section_title: str) -> List[ExtractedCriteria]:
        """Extract acceptance criteria from task/checklist formats."""
        extracted = []
        
        # Checkbox lists
        checkbox_items = re.findall(r'^\s*-\s*\[\s*\]\s*(.+)$', content, re.MULTILINE)
        if checkbox_items and len(checkbox_items) >= 2:
            # Filter out obvious non-criteria items
            criteria_items = [item for item in checkbox_items if self._is_criteria_like(item)]
            
            if criteria_items:
                extracted.append(ExtractedCriteria(
                    criteria=criteria_items,
                    format_type=CriteriaFormat.CHECKBOX_LIST,
                    confidence=0.7,
                    source_section=section_title,
                    line_numbers=[]  # Could be improved to track specific lines
                ))
        
        # Numbered task lists
        numbered_items = re.findall(r'^\s*\d+\.\s*(.+)$', content, re.MULTILINE)
        if numbered_items and len(numbered_items) >= 2:
            criteria_items = [item for item in numbered_items if self._is_criteria_like(item)]
            
            if criteria_items:
                extracted.append(ExtractedCriteria(
                    criteria=criteria_items,
                    format_type=CriteriaFormat.NUMBERED_LIST,
                    confidence=0.6,
                    source_section=section_title,
                    line_numbers=[]
                ))
        
        # Bullet point lists
        bullet_items = re.findall(r'^\s*[-*+]\s*(.+)$', content, re.MULTILINE)
        if bullet_items and len(bullet_items) >= 2:
            criteria_items = [item for item in bullet_items if self._is_criteria_like(item)]
            
            if len(criteria_items) >= 2:  # Need at least 2 criteria-like items
                extracted.append(ExtractedCriteria(
                    criteria=criteria_items,
                    format_type=CriteriaFormat.BULLET_POINTS,
                    confidence=0.5,
                    source_section=section_title,
                    line_numbers=[]
                ))
        
        return extracted
    
    def _extract_implicit_criteria(self, content: str, section_title: str) -> List[ExtractedCriteria]:
        """Extract implicit acceptance criteria from requirements and specifications."""
        extracted = []
        
        # Look for "must", "should", "shall" statements
        requirement_patterns = [
            r'(?:the\s+system|application|feature|component)\s+(?:must|shall|should)\s+(.+?)(?:[.!]|\n)',
            r'(?:it|this)\s+(?:must|shall|should)\s+(.+?)(?:[.!]|\n)',
            r'(?:users?|actors?|system)\s+(?:must|shall|should)\s+be\s+able\s+to\s+(.+?)(?:[.!]|\n)'
        ]
        
        implicit_criteria = []
        for pattern in requirement_patterns:
            matches = re.findall(pattern, content, re.IGNORECASE | re.MULTILINE)
            for match in matches:
                criterion = match.strip()
                if len(criterion) > 10:  # Filter out very short matches
                    implicit_criteria.append(f"Must {criterion}")
        
        if implicit_criteria:
            extracted.append(ExtractedCriteria(
                criteria=implicit_criteria,
                format_type=CriteriaFormat.BULLET_POINTS,
                confidence=0.4,
                source_section=section_title,
                line_numbers=[]
            ))
        
        return extracted
    
    def _parse_criteria_content(self, content: str) -> Tuple[List[str], CriteriaFormat]:
        """Parse criteria content and determine format."""
        content = content.strip()
        
        # Check for Given/When/Then format
        if re.search(r'given\s+.*when\s+.*then\s+', content, re.IGNORECASE | re.DOTALL):
            return self._parse_gwt_content(content), CriteriaFormat.GIVEN_WHEN_THEN
        
        # Check for checkbox format
        checkbox_items = re.findall(r'^\s*-\s*\[\s*\]\s*(.+)$', content, re.MULTILINE)
        if checkbox_items:
            return [item.strip() for item in checkbox_items], CriteriaFormat.CHECKBOX_LIST
        
        # Check for numbered list
        numbered_items = re.findall(r'^\s*\d+\.\s*(.+)$', content, re.MULTILINE)
        if numbered_items:
            return [item.strip() for item in numbered_items], CriteriaFormat.NUMBERED_LIST
        
        # Check for bullet points
        bullet_items = re.findall(r'^\s*[-*+]\s*(.+)$', content, re.MULTILINE)
        if bullet_items:
            return [item.strip() for item in bullet_items], CriteriaFormat.BULLET_POINTS
        
        # Default: split by lines and clean up
        lines = [line.strip() for line in content.split('\n') if line.strip()]
        return lines, CriteriaFormat.BULLET_POINTS
    
    def _parse_gwt_content(self, content: str) -> List[str]:
        """Parse Given/When/Then content into criteria list."""
        criteria = []
        
        # Find all Given/When/Then blocks
        gwt_blocks = re.findall(
            r'given\s+(.+?)\s*when\s+(.+?)\s*then\s+(.+?)(?=given|$)',
            content,
            re.IGNORECASE | re.DOTALL
        )
        
        for given, when, then in gwt_blocks:
            criterion = f"Given {given.strip()}, when {when.strip()}, then {then.strip()}"
            criteria.append(criterion)
        
        return criteria
    
    def _is_criteria_like(self, text: str) -> bool:
        """Determine if text looks like acceptance criteria."""
        text = text.lower().strip()
        
        # Too short or too long
        if len(text) < 10 or len(text) > 200:
            return False
        
        # Contains criteria-like words
        criteria_words = [
            'should', 'must', 'can', 'able', 'verify', 'ensure', 'display',
            'show', 'allow', 'enable', 'prevent', 'validate', 'confirm',
            'user', 'system', 'application', 'when', 'if', 'then'
        ]
        
        word_count = sum(1 for word in criteria_words if word in text)
        if word_count < 1:
            return False
        
        # Avoid obvious non-criteria
        skip_patterns = [
            r'^\d+\s*hours?',
            r'^task\s*\d',
            r'^subtask',
            r'^note:',
            r'^warning:',
            r'^todo:',
            r'^fixme:',
            r'^hack:'
        ]
        
        for pattern in skip_patterns:
            if re.search(pattern, text):
                return False
        
        return True
    
    def _get_line_numbers(self, content: str, start_pos: int, end_pos: int) -> List[int]:
        """Get line numbers for a content range."""
        lines_before = content[:start_pos].count('\n')
        lines_in_match = content[start_pos:end_pos].count('\n')
        
        return list(range(lines_before + 1, lines_before + lines_in_match + 2))
    
    def merge_criteria(self, extracted_list: List[ExtractedCriteria]) -> AcceptanceCriteria:
        """Merge multiple extracted criteria into a single AcceptanceCriteria object."""
        merged = AcceptanceCriteria()
        seen_criteria = set()
        
        # Sort by confidence (highest first)
        sorted_extracted = sorted(extracted_list, key=lambda x: x.confidence, reverse=True)
        
        for extracted in sorted_extracted:
            for criterion in extracted.criteria:
                # Normalize criterion to avoid duplicates
                normalized = self._normalize_criterion(criterion)
                
                if normalized not in seen_criteria:
                    merged.add_criterion(criterion)
                    seen_criteria.add(normalized)
        
        return merged
    
    def _normalize_criterion(self, criterion: str) -> str:
        """Normalize a criterion for duplicate detection."""
        # Convert to lowercase and remove extra whitespace
        normalized = ' '.join(criterion.lower().split())
        
        # Remove common prefixes that might differ
        prefixes_to_remove = [
            r'^must\s+',
            r'^should\s+',
            r'^the\s+system\s+',
            r'^users?\s+',
            r'^it\s+'
        ]
        
        for prefix in prefixes_to_remove:
            normalized = re.sub(prefix, '', normalized)
        
        return normalized.strip()


# Convenience function
def extract_acceptance_criteria(content: str, section_title: str = "") -> AcceptanceCriteria:
    """Extract acceptance criteria from content and return merged result."""
    extractor = AcceptanceCriteriaExtractor()
    extracted_list = extractor.extract_from_content(content, section_title)
    return extractor.merge_criteria(extracted_list)