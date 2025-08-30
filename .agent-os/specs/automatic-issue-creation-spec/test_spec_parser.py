#!/usr/bin/env python3
"""
Unit tests for SpecificationParser.

Tests the parsing logic for extracting issues from markdown specifications.
"""

import unittest
from unittest.mock import Mock, patch
from pathlib import Path
import tempfile
import os

from spec_parser import SpecificationParser, ParseResult
from issue_spec import IssueSpec, IssueType, IssuePriority, IssueStatus


class TestSpecificationParser(unittest.TestCase):
    """Test cases for SpecificationParser."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.parser = SpecificationParser()
        self.test_dir = tempfile.mkdtemp()
        
    def tearDown(self):
        """Clean up test fixtures."""
        import shutil
        shutil.rmtree(self.test_dir, ignore_errors=True)
    
    def test_parse_simple_epic(self):
        """Test parsing a simple epic with basic content."""
        spec_content = """
# Epic: User Authentication System

This epic covers implementing user authentication functionality.

## Acceptance Criteria
- [ ] Users can register with email and password
- [ ] Users can login securely
- [ ] Password reset functionality works
"""
        
        # Create temporary file
        spec_file = Path(self.test_dir) / "test_spec.md"
        spec_file.write_text(spec_content)
        
        # Parse the specification
        result = self.parser.parse_file(str(spec_file))
        
        # Validate result
        self.assertIsInstance(result, ParseResult)
        self.assertTrue(result.success)
        self.assertEqual(len(result.issues), 1)
        
        # Validate parsed epic
        epic = result.issues[0]
        self.assertEqual(epic.title, "User Authentication System")
        self.assertEqual(epic.issue_type, IssueType.EPIC)
        self.assertIn("implementing user authentication functionality", epic.description)
        self.assertEqual(len(epic.acceptance_criteria.criteria), 3)
        
    def test_parse_hierarchical_structure(self):
        """Test parsing a specification with epic > story > task hierarchy."""
        spec_content = """
# Epic: E-commerce Platform

Build a complete e-commerce solution.

## Feature: Product Management

Manage product inventory and catalog.

### Task: Create Product Model

Implement the core product data model.

#### Acceptance Criteria
- [ ] Product has name, price, description
- [ ] Product can have categories
- [ ] Product supports inventory tracking

### Task: Product API Endpoints

Create REST API for product operations.

## Feature: Shopping Cart

Implement shopping cart functionality.

### Task: Cart Storage

Store cart items persistently.
"""
        
        spec_file = Path(self.test_dir) / "ecommerce_spec.md"
        spec_file.write_text(spec_content)
        
        result = self.parser.parse_file(str(spec_file))
        
        # Should have 1 epic, 2 features, 3 tasks
        self.assertTrue(result.success)
        self.assertEqual(len(result.issues), 6)
        
        # Find issues by type
        epics = [i for i in result.issues if i.issue_type == IssueType.EPIC]
        features = [i for i in result.issues if i.issue_type == IssueType.FEATURE]
        tasks = [i for i in result.issues if i.issue_type == IssueType.TASK]
        
        self.assertEqual(len(epics), 1)
        self.assertEqual(len(features), 2) 
        self.assertEqual(len(tasks), 3)
        
        # Validate hierarchy
        epic = epics[0]
        self.assertEqual(epic.title, "E-commerce Platform")
        self.assertIsNone(epic.parent_id)
        
        # Features should have epic as parent
        product_mgmt = next(f for f in features if "Product Management" in f.title)
        shopping_cart = next(f for f in features if "Shopping Cart" in f.title)
        self.assertIsNotNone(product_mgmt.parent_id)
        self.assertIsNotNone(shopping_cart.parent_id)
        
        # Tasks should have feature as parent
        product_model = next(t for t in tasks if "Product Model" in t.title)
        self.assertIsNotNone(product_model.parent_id)
        self.assertEqual(len(product_model.acceptance_criteria.criteria), 3)
    
    def test_parse_with_priorities_and_estimates(self):
        """Test parsing specification with priority and estimation info."""
        spec_content = """
# Epic: Critical Security Update [P1] [8 hours]

High priority security fixes.

## Feature: Authentication Hardening [P1] [4 hours]

Strengthen authentication security.

### Task: Implement 2FA [P1] [2 hours]

Add two-factor authentication.

### Task: Password Policy [P2] [2 hours]

Enforce strong password requirements.
"""
        
        spec_file = Path(self.test_dir) / "security_spec.md"
        spec_file.write_text(spec_content)
        
        result = self.parser.parse_file(str(spec_file))
        
        self.assertTrue(result.success)
        
        # Find epic
        epic = next(i for i in result.issues if i.issue_type == IssueType.EPIC)
        self.assertEqual(epic.priority, IssuePriority.URGENT)
        self.assertEqual(epic.estimated_hours, 8.0)
        
        # Find tasks with different priorities
        tasks = [i for i in result.issues if i.issue_type == IssueType.TASK]
        p1_task = next(t for t in tasks if "2FA" in t.title)
        p2_task = next(t for t in tasks if "Password Policy" in t.title)
        
        self.assertEqual(p1_task.priority, IssuePriority.URGENT)
        self.assertEqual(p1_task.estimated_hours, 2.0)
        self.assertEqual(p2_task.priority, IssuePriority.HIGH)
        self.assertEqual(p2_task.estimated_hours, 2.0)
    
    def test_parse_error_handling(self):
        """Test error handling for invalid specifications."""
        # Test non-existent file
        result = self.parser.parse_file("nonexistent.md")
        self.assertFalse(result.success)
        self.assertIn("File not found", str(result.errors[0]))
        
        # Test empty file
        empty_file = Path(self.test_dir) / "empty.md"
        empty_file.write_text("")
        
        result = self.parser.parse_file(str(empty_file))
        self.assertFalse(result.success)
        self.assertIn("empty or contains no valid content", str(result.errors[0]))
        
        # Test file with no markdown headers
        no_headers_file = Path(self.test_dir) / "no_headers.md"
        no_headers_file.write_text("Just some plain text without headers.")
        
        result = self.parser.parse_file(str(no_headers_file))
        self.assertFalse(result.success)
        self.assertIn("No issues could be parsed", str(result.errors[0]))
    
    def test_parse_acceptance_criteria_extraction(self):
        """Test extraction of various acceptance criteria formats."""
        spec_content = """
# Feature: User Profile

User profile management.

## Acceptance Criteria
- [ ] User can view their profile
- [x] User can edit basic information
- [ ] Profile photo upload works

## Additional Requirements
* System validates email format
* Password changes require confirmation
* Profile updates are logged

### Functional Requirements
1. All fields are properly validated
2. Changes are persisted to database
3. Audit trail is maintained
"""
        
        spec_file = Path(self.test_dir) / "profile_spec.md"
        spec_file.write_text(spec_content)
        
        result = self.parser.parse_file(str(spec_file))
        
        self.assertTrue(result.success)
        feature = result.issues[0]
        
        # Should extract criteria from multiple sections
        criteria = feature.acceptance_criteria.criteria
        self.assertGreaterEqual(len(criteria), 6)  # At least 6 criteria extracted
        
        # Verify completed criteria are marked
        completed_criteria = [c for c in criteria if c.completed]
        self.assertGreater(len(completed_criteria), 0)
    
    def test_parse_file_statistics(self):
        """Test parsing statistics calculation."""
        spec_content = """
# Epic: Platform Upgrade

Major platform improvements.

## Feature: Database Migration

Migrate to new database system.

### Task: Schema Updates
Update database schema.

### Task: Data Migration  
Migrate existing data.

## Feature: API Modernization

Update API to latest standards.

### Task: Endpoint Refactoring
Refactor existing endpoints.
"""
        
        spec_file = Path(self.test_dir) / "upgrade_spec.md"
        spec_file.write_text(spec_content)
        
        result = self.parser.parse_file(str(spec_file))
        
        self.assertTrue(result.success)
        
        # Validate statistics
        stats = result.statistics
        self.assertEqual(stats.total_issues, 5)
        self.assertEqual(stats.epics_count, 1)
        self.assertEqual(stats.features_count, 2)
        self.assertEqual(stats.tasks_count, 3)
        self.assertEqual(stats.bugs_count, 0)
        
        # Validate hierarchy information
        hierarchy = result.hierarchy
        self.assertEqual(hierarchy.total_count(), 5)
        
        epics = hierarchy.get_epics()
        self.assertEqual(len(epics), 1)
        
        top_level_features = hierarchy.get_children(epics[0].id)
        self.assertEqual(len(top_level_features), 2)
    
    def test_parse_with_custom_configuration(self):
        """Test parsing with custom parser configuration."""
        config = {
            "detect_priorities": True,
            "detect_estimates": True,
            "extract_acceptance_criteria": True,
            "max_description_length": 100,
            "default_priority": "MEDIUM"
        }
        
        parser = SpecificationParser(config)
        
        spec_content = """
# Epic: Large Description Test

This is a very long description that should be truncated because it exceeds the maximum description length configured for the parser. It contains a lot of details about the implementation requirements and various considerations.

## Feature: Test Feature

Short description.
"""
        
        spec_file = Path(self.test_dir) / "config_test.md"
        spec_file.write_text(spec_content)
        
        result = parser.parse_file(str(spec_file))
        
        self.assertTrue(result.success)
        
        epic = result.issues[0]
        # Description should be truncated
        self.assertLessEqual(len(epic.description), 103)  # 100 + "..."
        
        feature = result.issues[1]
        self.assertEqual(feature.priority, IssuePriority.MEDIUM)


if __name__ == '__main__':
    unittest.main()