#!/usr/bin/env python3
"""
Markdown specification parser for extracting issues from specifications.

This module provides functionality to parse markdown specifications and identify
epics, user stories, and tasks that can be converted to trackable issues.
"""

import re
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from pathlib import Path
from issue_spec import IssueSpec, IssueType, Priority, AcceptanceCriteria, IssueHierarchy


@dataclass
class MarkdownSection:
    """Represents a section in a markdown document."""
    level: int
    title: str
    content: str
    line_number: int
    raw_header: str
    children: List['MarkdownSection'] = None
    
    def __post_init__(self):
        if self.children is None:
            self.children = []
    
    def add_child(self, child: 'MarkdownSection') -> None:
        """Add a child section."""
        self.children.append(child)
    
    def get_full_content(self) -> str:
        """Get the complete content including all child sections."""
        content = self.content
        for child in self.children:
            content += f"\n\n{child.raw_header}\n{child.get_full_content()}"
        return content
    
    def __str__(self) -> str:
        indent = "  " * (self.level - 1)
        return f"{indent}{'#' * self.level} {self.title}"


class SpecificationParser:
    """
    Parser for extracting issues from markdown specifications.
    
    Identifies epics, user stories, and tasks based on markdown structure
    and content patterns.
    """
    
    def __init__(self):
        # Patterns for identifying different types of work items
        self.epic_patterns = [
            r'epic\s*:?\s*',
            r'phase\s*\d*:?\s*',
            r'milestone\s*:?\s*',
            r'objective\s*:?\s*'
        ]
        
        self.story_patterns = [
            r'user\s*story\s*:?\s*',
            r'feature\s*:?\s*',
            r'capability\s*:?\s*',
            r'story\s*:?\s*',
            r'requirement\s*:?\s*'
        ]
        
        self.task_patterns = [
            r'task\s*:?\s*',
            r'todo\s*:?\s*',
            r'implementation\s*:?\s*',
            r'subtask\s*:?\s*',
            r'action\s*:?\s*'
        ]
        
        # Priority indicators
        self.priority_patterns = {
            Priority.URGENT: [r'urgent', r'critical', r'blocker', r'emergency'],
            Priority.HIGH: [r'high\s*priority', r'important', r'must\s*have'],
            Priority.MEDIUM: [r'medium', r'normal', r'should\s*have'],
            Priority.LOW: [r'low\s*priority', r'nice\s*to\s*have', r'could\s*have']
        }
        
        # Issue type indicators
        self.type_patterns = {
            IssueType.BUG: [r'bug', r'fix', r'error', r'issue', r'defect', r'problem'],
            IssueType.FEATURE: [r'feature', r'implement', r'add', r'create', r'new'],
            IssueType.IMPROVEMENT: [r'improve', r'enhance', r'optimize', r'update', r'upgrade'],
            IssueType.MAINTENANCE: [r'refactor', r'cleanup', r'maintenance', r'deps', r'dependencies']
        }
    
    def parse_file(self, file_path: str) -> IssueHierarchy:
        """Parse a specification file and return issue hierarchy."""
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"Specification file not found: {file_path}")
        
        with open(path, 'r', encoding='utf-8') as file:
            content = file.read()
        
        return self.parse_content(content, str(path))
    
    def parse_content(self, content: str, source_file: Optional[str] = None) -> IssueHierarchy:
        """Parse markdown content and extract issues."""
        # Parse markdown structure
        sections = self._parse_markdown_sections(content)
        
        # Extract issues from sections
        hierarchy = IssueHierarchy()
        self._extract_issues_from_sections(sections, hierarchy, source_file)
        
        return hierarchy
    
    def _parse_markdown_sections(self, content: str) -> List[MarkdownSection]:
        """Parse markdown content into hierarchical sections."""
        lines = content.split('\n')
        sections = []
        current_sections = {}  # level -> MarkdownSection
        
        i = 0
        while i < len(lines):
            line = lines[i]
            
            # Check for header
            header_match = re.match(r'^(#{1,6})\s+(.+)$', line)
            if header_match:
                level = len(header_match.group(1))
                title = header_match.group(2).strip()
                
                # Collect content until next header of same or higher level
                content_lines = []
                j = i + 1
                
                while j < len(lines):
                    next_line = lines[j]
                    next_header = re.match(r'^(#{1,6})\s+', next_line)
                    
                    if next_header and len(next_header.group(1)) <= level:
                        break
                    
                    content_lines.append(next_line)
                    j += 1
                
                section = MarkdownSection(
                    level=level,
                    title=title,
                    content='\n'.join(content_lines).strip(),
                    line_number=i + 1,
                    raw_header=line
                )
                
                # Build hierarchy
                current_sections[level] = section
                
                # Find parent section
                parent_level = None
                for parent_lvl in range(level - 1, 0, -1):
                    if parent_lvl in current_sections:
                        parent_level = parent_lvl
                        break
                
                if parent_level:
                    current_sections[parent_level].add_child(section)
                else:
                    sections.append(section)
                
                # Clear deeper levels
                levels_to_clear = [lvl for lvl in current_sections.keys() if lvl > level]
                for lvl in levels_to_clear:
                    del current_sections[lvl]
                
                i = j
            else:
                i += 1
        
        return sections
    
    def _extract_issues_from_sections(self, sections: List[MarkdownSection], 
                                    hierarchy: IssueHierarchy, source_file: Optional[str] = None) -> None:
        """Extract issues from markdown sections recursively."""
        for section in sections:
            issue = self._section_to_issue(section, source_file)
            if issue:
                hierarchy.add_issue(issue)
                
                # Process child sections as potential child issues
                self._process_child_sections(section.children, issue, hierarchy, source_file)
    
    def _process_child_sections(self, child_sections: List[MarkdownSection], 
                              parent_issue: IssueSpec, hierarchy: IssueHierarchy,
                              source_file: Optional[str] = None) -> None:
        """Process child sections and link them to parent issue."""
        for child_section in child_sections:
            child_issue = self._section_to_issue(child_section, source_file)
            
            if child_issue:
                parent_issue.add_child(child_issue)
                hierarchy.add_issue(child_issue)
                
                # Recursively process grandchildren
                self._process_child_sections(child_section.children, child_issue, hierarchy, source_file)
    
    def _section_to_issue(self, section: MarkdownSection, source_file: Optional[str] = None) -> Optional[IssueSpec]:
        """Convert a markdown section to an IssueSpec if it represents trackable work."""
        # Check if this section represents trackable work
        if not self._is_trackable_section(section):
            return None
        
        # Determine issue type
        issue_type = self._detect_issue_type(section)
        
        # Determine priority
        priority = self._detect_priority(section)
        
        # Extract title (clean it up)
        title = self._clean_title(section.title)
        
        # Extract description
        description = self._extract_description(section)
        
        # Extract acceptance criteria
        acceptance_criteria = self._extract_acceptance_criteria(section)
        
        # Extract labels
        labels = self._extract_labels(section)
        
        # Extract estimate
        estimate = self._extract_estimate(section)
        
        # Create issue
        issue = IssueSpec(
            title=title,
            description=description,
            issue_type=issue_type,
            priority=priority,
            acceptance_criteria=acceptance_criteria,
            labels=labels,
            estimate=estimate,
            source_section=section.title,
            source_line=section.line_number,
            spec_file=source_file
        )
        
        return issue
    
    def _is_trackable_section(self, section: MarkdownSection) -> bool:
        """Determine if a section represents trackable work."""
        title_lower = section.title.lower()
        content_lower = section.content.lower()
        combined = f"{title_lower} {content_lower}"
        
        # Skip certain sections that are clearly not work items
        skip_patterns = [
            r'table\s*of\s*contents',
            r'overview',
            r'introduction',
            r'background',
            r'references?',
            r'appendix',
            r'glossary',
            r'changelog',
            r'version\s*history'
        ]
        
        for pattern in skip_patterns:
            if re.search(pattern, combined):
                return False
        
        # Check for positive indicators
        positive_indicators = (
            self.epic_patterns + 
            self.story_patterns + 
            self.task_patterns +
            [r'implement', r'create', r'build', r'develop', r'design']
        )
        
        for pattern in positive_indicators:
            if re.search(pattern, combined, re.IGNORECASE):
                return True
        
        # Check for task lists or acceptance criteria
        if self._has_task_list(section.content) or self._has_acceptance_criteria(section.content):
            return True
        
        # For level 2 headers, assume they're epics unless proven otherwise
        if section.level == 2:
            return True
        
        # For level 3 headers, check if they describe features/stories
        if section.level == 3:
            feature_indicators = [r'user\s*story', r'feature', r'capability', r'functionality']
            for pattern in feature_indicators:
                if re.search(pattern, combined, re.IGNORECASE):
                    return True
        
        return False
    
    def _detect_issue_type(self, section: MarkdownSection) -> IssueType:
        """Detect the type of issue based on section content."""
        title_lower = section.title.lower()
        content_lower = section.content.lower()
        combined = f"{title_lower} {content_lower}"
        
        # Check for explicit type indicators
        for issue_type, patterns in self.type_patterns.items():
            for pattern in patterns:
                if re.search(pattern, combined):
                    return issue_type
        
        # Determine by section level and structure
        if section.level == 2:
            # Level 2 headers are typically epics
            return IssueType.EPIC
        elif section.level >= 4 or self._has_task_list(section.content):
            # Level 4+ headers or sections with task lists are typically tasks
            return IssueType.TASK
        else:
            # Default to feature for level 3 headers
            return IssueType.FEATURE
    
    def _detect_priority(self, section: MarkdownSection) -> Priority:
        """Detect priority from section content."""
        combined = f"{section.title} {section.content}".lower()
        
        for priority, patterns in self.priority_patterns.items():
            for pattern in patterns:
                if re.search(pattern, combined):
                    return priority
        
        return Priority.MEDIUM
    
    def _clean_title(self, title: str) -> str:
        """Clean up issue title by removing common prefixes."""
        # Remove common prefixes
        cleaned = re.sub(r'^(epic|phase|milestone|user\s*story|feature|task|todo)\s*:?\s*', 
                        '', title, flags=re.IGNORECASE)
        
        # Remove numbering
        cleaned = re.sub(r'^\d+\.?\s*', '', cleaned)
        
        # Clean up whitespace
        cleaned = ' '.join(cleaned.split())
        
        return cleaned.strip()
    
    def _extract_description(self, section: MarkdownSection) -> str:
        """Extract issue description from section content."""
        content = section.content.strip()
        
        if not content:
            return f"Implement {section.title}"
        
        # Take first paragraph as description
        paragraphs = [p.strip() for p in content.split('\n\n') if p.strip()]
        
        if paragraphs:
            description = paragraphs[0]
            # Remove task lists from description
            description = re.sub(r'^\s*-\s*\[\s*\]\s*.*$', '', description, flags=re.MULTILINE)
            description = '\n'.join(line for line in description.split('\n') if line.strip())
            return description.strip()
        
        return f"Implement {section.title}"
    
    def _extract_acceptance_criteria(self, section: MarkdownSection) -> AcceptanceCriteria:
        """Extract acceptance criteria from section content."""
        criteria = AcceptanceCriteria()
        content = section.content
        
        # Look for explicit acceptance criteria section
        ac_match = re.search(r'(?:acceptance\s*criteria|success\s*criteria)[:\s]*\n(.*?)(?:\n#{1,6}|\n\n|\Z)', 
                           content, re.IGNORECASE | re.DOTALL)
        
        if ac_match:
            ac_content = ac_match.group(1)
            criteria_list = self._parse_criteria_list(ac_content)
            criteria.add_criteria(criteria_list)
        
        # Also look for task lists that might represent criteria
        if criteria.is_empty():
            task_lists = re.findall(r'^\s*-\s*\[\s*\]\s*(.+)$', content, re.MULTILINE)
            if task_lists:
                criteria.add_criteria(task_lists)
        
        return criteria
    
    def _parse_criteria_list(self, content: str) -> List[str]:
        """Parse a list of criteria from content."""
        criteria = []
        
        # Handle bullet points
        bullet_points = re.findall(r'^\s*[-*+]\s*(.+)$', content, re.MULTILINE)
        criteria.extend(bullet_points)
        
        # Handle numbered lists
        numbered_points = re.findall(r'^\s*\d+\.\s*(.+)$', content, re.MULTILINE)
        criteria.extend(numbered_points)
        
        # Handle checkbox lists
        checkbox_points = re.findall(r'^\s*-\s*\[\s*\]\s*(.+)$', content, re.MULTILINE)
        criteria.extend(checkbox_points)
        
        return [criterion.strip() for criterion in criteria if criterion.strip()]
    
    def _extract_labels(self, section: MarkdownSection) -> List[str]:
        """Extract labels from section content."""
        labels = []
        
        # Add type-based label
        if section.level == 2:
            labels.append('epic')
        elif section.level >= 4:
            labels.append('task')
        else:
            labels.append('feature')
        
        # Look for explicit labels
        label_match = re.search(r'labels?\s*:?\s*\[(.*?)\]', section.content, re.IGNORECASE)
        if label_match:
            explicit_labels = [label.strip().strip('"\'') for label in label_match.group(1).split(',')]
            labels.extend(explicit_labels)
        
        return list(set(labels))  # Remove duplicates
    
    def _extract_estimate(self, section: MarkdownSection) -> Optional[float]:
        """Extract time estimate from section content."""
        content = f"{section.title} {section.content}"
        
        # Look for time estimates in various formats
        time_patterns = [
            r'(\d+(?:\.\d+)?)\s*h(?:ours?)?',
            r'(\d+(?:\.\d+)?)\s*hrs?',
            r'estimate[:\s]*(\d+(?:\.\d+)?)\s*h',
            r'effort[:\s]*(\d+(?:\.\d+)?)\s*h'
        ]
        
        for pattern in time_patterns:
            match = re.search(pattern, content, re.IGNORECASE)
            if match:
                try:
                    return float(match.group(1))
                except ValueError:
                    continue
        
        return None
    
    def _has_task_list(self, content: str) -> bool:
        """Check if content contains a task list."""
        return bool(re.search(r'^\s*-\s*\[\s*\]\s*', content, re.MULTILINE))
    
    def _has_acceptance_criteria(self, content: str) -> bool:
        """Check if content has acceptance criteria section."""
        return bool(re.search(r'acceptance\s*criteria', content, re.IGNORECASE))


# Convenience function for quick parsing
def parse_specification(file_path: str) -> IssueHierarchy:
    """Parse a specification file and return issue hierarchy."""
    parser = SpecificationParser()
    return parser.parse_file(file_path)