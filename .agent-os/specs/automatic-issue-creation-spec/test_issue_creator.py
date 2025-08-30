#!/usr/bin/env python3
"""
Unit tests for AutomaticIssueCreator service.

Tests the main orchestration service for automatic issue creation.
"""

import unittest
from unittest.mock import Mock, patch, AsyncMock, MagicMock
import asyncio
import tempfile
from pathlib import Path

from automatic_issue_creator import (
    AutomaticIssueCreator, IssueCreationConfig, IssueCreationResult
)
from ticketing_interface import TicketingSystemConfig, TicketingSystem, CreatedIssue
from issue_spec import IssueSpec, IssueType, IssuePriority, IssueHierarchy


class TestAutomaticIssueCreator(unittest.TestCase):
    """Test cases for AutomaticIssueCreator."""
    
    def setUp(self):
        """Set up test fixtures."""
        # Mock ticketing configuration
        self.mock_ticketing_config = Mock(spec=TicketingSystemConfig)
        self.mock_ticketing_config.system_type = TicketingSystem.LINEAR
        
        # Create test configuration
        self.config = IssueCreationConfig(
            ticketing_config=self.mock_ticketing_config,
            enabled=True,
            dry_run=False,
            use_advanced_detection=True,
            apply_templates=True,
            update_spec_with_links=True
        )
        
        self.creator = AutomaticIssueCreator(self.config)
        self.test_dir = tempfile.mkdtemp()
    
    def tearDown(self):
        """Clean up test fixtures."""
        import shutil
        shutil.rmtree(self.test_dir, ignore_errors=True)
    
    @patch('automatic_issue_creator.SpecificationParser')
    @patch('automatic_issue_creator.TicketingInterface')
    def test_create_issues_from_file_success(self, mock_ticketing_interface_class, mock_parser_class):
        """Test successful issue creation from specification file."""
        # Setup mocks
        mock_parser = Mock()
        mock_parser_class.return_value = mock_parser
        
        # Mock parse result
        epic = IssueSpec(
            id="epic-1",
            title="Test Epic",
            description="Test epic description",
            issue_type=IssueType.EPIC,
            priority=IssuePriority.MEDIUM
        )
        task = IssueSpec(
            id="task-1", 
            title="Test Task",
            description="Test task description",
            issue_type=IssueType.TASK,
            priority=IssuePriority.MEDIUM,
            parent_id="epic-1"
        )
        
        hierarchy = IssueHierarchy()
        hierarchy.add_issue(epic)
        hierarchy.add_issue(task)
        
        mock_parse_result = Mock()
        mock_parse_result.success = True
        mock_parse_result.issues = [epic, task]
        mock_parse_result.hierarchy = hierarchy
        mock_parse_result.errors = []
        mock_parse_result.warnings = []
        
        mock_parser.parse_file.return_value = mock_parse_result
        
        # Mock ticketing interface
        mock_ticketing = Mock()
        mock_ticketing_interface_class.return_value = mock_ticketing
        
        created_epic = CreatedIssue(
            id="EPI-1",
            title="Test Epic",
            url="https://linear.app/team/issue/EPI-1",
            system_type=TicketingSystem.LINEAR
        )
        created_task = CreatedIssue(
            id="TSK-1", 
            title="Test Task",
            url="https://linear.app/team/issue/TSK-1",
            system_type=TicketingSystem.LINEAR
        )
        
        # Mock async methods
        async def mock_test_connection():
            return True
            
        async def mock_create_issue(spec):
            if spec.issue_type == IssueType.EPIC:
                return created_epic
            else:
                return created_task
        
        mock_ticketing.test_connection = mock_test_connection
        mock_ticketing.create_issue = mock_create_issue
        
        # Create test specification file
        spec_content = """
# Epic: Test Epic

Test epic description

## Task: Test Task

Test task description
"""
        spec_file = Path(self.test_dir) / "test_spec.md"
        spec_file.write_text(spec_content)
        
        # Run the test
        async def run_test():
            result = await self.creator.create_issues_from_file(str(spec_file))
            
            # Validate result
            self.assertIsInstance(result, IssueCreationResult)
            self.assertTrue(result.was_successful)
            self.assertEqual(result.total_created, 2)
            self.assertEqual(result.total_failed, 0)
            self.assertEqual(len(result.created_issues), 2)
            self.assertGreater(result.processing_time, 0)
            
            # Validate created issues
            created_ids = [issue.id for issue in result.created_issues]
            self.assertIn("EPI-1", created_ids)
            self.assertIn("TSK-1", created_ids)
        
        # Run async test
        asyncio.run(run_test())
    
    @patch('automatic_issue_creator.SpecificationParser')
    def test_create_issues_parsing_failure(self, mock_parser_class):
        """Test handling of parsing failures."""
        # Setup mock parser with failure
        mock_parser = Mock()
        mock_parser_class.return_value = mock_parser
        
        mock_parse_result = Mock()
        mock_parse_result.success = False
        mock_parse_result.issues = []
        mock_parse_result.errors = [Exception("Parse error")]
        mock_parse_result.warnings = []
        
        mock_parser.parse_file.return_value = mock_parse_result
        
        # Create test file
        spec_file = Path(self.test_dir) / "invalid_spec.md"
        spec_file.write_text("Invalid specification content")
        
        async def run_test():
            result = await self.creator.create_issues_from_file(str(spec_file))
            
            # Should handle gracefully
            self.assertFalse(result.was_successful)
            self.assertEqual(result.total_created, 0)
            self.assertGreater(len(result.errors), 0)
        
        asyncio.run(run_test())
    
    @patch('automatic_issue_creator.TicketingInterface')
    @patch('automatic_issue_creator.SpecificationParser')
    def test_create_issues_dry_run(self, mock_parser_class, mock_ticketing_interface_class):
        """Test dry run mode doesn't create actual issues."""
        # Set dry run mode
        config = IssueCreationConfig(
            ticketing_config=self.mock_ticketing_config,
            enabled=True,
            dry_run=True
        )
        creator = AutomaticIssueCreator(config)
        
        # Setup mocks
        mock_parser = Mock()
        mock_parser_class.return_value = mock_parser
        
        epic = IssueSpec(
            id="epic-1",
            title="Dry Run Epic", 
            description="Test epic for dry run",
            issue_type=IssueType.EPIC,
            priority=IssuePriority.MEDIUM
        )
        
        hierarchy = IssueHierarchy()
        hierarchy.add_issue(epic)
        
        mock_parse_result = Mock()
        mock_parse_result.success = True
        mock_parse_result.issues = [epic]
        mock_parse_result.hierarchy = hierarchy
        mock_parse_result.errors = []
        mock_parse_result.warnings = []
        
        mock_parser.parse_file.return_value = mock_parse_result
        
        # Mock ticketing interface (should not be called in dry run)
        mock_ticketing = Mock()
        mock_ticketing_interface_class.return_value = mock_ticketing
        
        # Create test file
        spec_file = Path(self.test_dir) / "dry_run_spec.md"
        spec_file.write_text("# Epic: Dry Run Epic\n\nTest content")
        
        async def run_test():
            result = await creator.create_issues_from_file(str(spec_file))
            
            # Should simulate creation without actual calls
            self.assertTrue(result.was_successful)
            self.assertEqual(result.total_created, 1)
            self.assertEqual(len(result.created_issues), 1)
            
            # Created issue should have dry run markers
            created_issue = result.created_issues[0]
            self.assertIn("DRY-RUN", created_issue.id)
            self.assertIn("dry-run", created_issue.url)
            
            # Ticketing interface should not have been called
            mock_ticketing.create_issue.assert_not_called()
        
        asyncio.run(run_test())
    
    @patch('automatic_issue_creator.TicketingInterface')
    def test_connectivity_check(self, mock_ticketing_interface_class):
        """Test ticketing system connectivity validation."""
        mock_ticketing = Mock()
        mock_ticketing_interface_class.return_value = mock_ticketing
        
        # Test successful connection
        async def mock_success():
            return True
        mock_ticketing.test_connection = mock_success
        
        async def run_test():
            result = await self.creator.test_connection()
            self.assertTrue(result)
        
        asyncio.run(run_test())
        
        # Test failed connection
        async def mock_failure():
            return False
        mock_ticketing.test_connection = mock_failure
        
        async def run_test_failure():
            result = await self.creator.test_connection()
            self.assertFalse(result)
        
        asyncio.run(run_test_failure())
    
    def test_configuration_validation(self):
        """Test configuration validation."""
        # Valid configuration
        valid_config = IssueCreationConfig(
            ticketing_config=self.mock_ticketing_config,
            enabled=True,
            dry_run=False
        )
        self.assertTrue(valid_config.enabled)
        
        # Disabled configuration
        disabled_config = IssueCreationConfig(
            ticketing_config=self.mock_ticketing_config,
            enabled=False,
            dry_run=False
        )
        self.assertFalse(disabled_config.enabled)
    
    @patch('automatic_issue_creator.BidirectionalLinker')
    @patch('automatic_issue_creator.TicketingInterface')
    @patch('automatic_issue_creator.SpecificationParser')
    def test_bidirectional_linking(self, mock_parser_class, mock_ticketing_interface_class, mock_linker_class):
        """Test bidirectional linking between specs and issues."""
        # Setup mocks
        mock_parser = Mock()
        mock_parser_class.return_value = mock_parser
        
        epic = IssueSpec(
            id="epic-1",
            title="Linked Epic",
            description="Epic with linking",
            issue_type=IssueType.EPIC,
            priority=IssuePriority.MEDIUM
        )
        
        hierarchy = IssueHierarchy()
        hierarchy.add_issue(epic)
        
        mock_parse_result = Mock()
        mock_parse_result.success = True
        mock_parse_result.issues = [epic]
        mock_parse_result.hierarchy = hierarchy
        mock_parse_result.errors = []
        mock_parse_result.warnings = []
        
        mock_parser.parse_file.return_value = mock_parse_result
        
        # Mock ticketing interface
        mock_ticketing = Mock()
        mock_ticketing_interface_class.return_value = mock_ticketing
        
        created_epic = CreatedIssue(
            id="EPI-1",
            title="Linked Epic",
            url="https://linear.app/team/issue/EPI-1",
            system_type=TicketingSystem.LINEAR
        )
        
        async def mock_test_connection():
            return True
            
        async def mock_create_issue(spec):
            return created_epic
        
        mock_ticketing.test_connection = mock_test_connection
        mock_ticketing.create_issue = mock_create_issue
        
        # Mock bidirectional linker
        mock_linker = Mock()
        mock_linker_class.return_value = mock_linker
        
        async def mock_update_spec():
            return True
            
        async def mock_link_to_issue():
            return True
        
        mock_linker.update_specification_with_links = mock_update_spec
        mock_linker.add_spec_reference_to_issue = mock_link_to_issue
        
        # Create test file
        spec_file = Path(self.test_dir) / "linked_spec.md" 
        spec_file.write_text("# Epic: Linked Epic\n\nEpic with linking")
        
        async def run_test():
            result = await self.creator.create_issues_from_file(str(spec_file))
            
            # Linking should be enabled by default
            self.assertTrue(result.spec_updated)
            
            # Verify linker was called
            mock_linker.update_specification_with_links.assert_called_once()
            mock_linker.add_spec_reference_to_issue.assert_called_once()
        
        asyncio.run(run_test())
    
    def test_error_handling_and_recovery(self):
        """Test comprehensive error handling."""
        # Test with invalid ticketing configuration
        invalid_config = IssueCreationConfig(
            ticketing_config=None,  # Invalid
            enabled=True,
            dry_run=False
        )
        
        # Should handle gracefully
        with self.assertRaises(Exception):
            AutomaticIssueCreator(invalid_config)
    
    def test_result_statistics(self):
        """Test result statistics calculation."""
        # Create sample result
        created_issues = [
            CreatedIssue("EPI-1", "Epic 1", "http://example.com/EPI-1", TicketingSystem.LINEAR),
            CreatedIssue("TSK-1", "Task 1", "http://example.com/TSK-1", TicketingSystem.LINEAR)
        ]
        
        errors = [
            {"issue": "TSK-2", "message": "Creation failed", "error": Exception("API error")}
        ]
        
        result = IssueCreationResult(
            was_successful=True,
            total_created=2,
            total_failed=1,
            created_issues=created_issues,
            errors=errors,
            warnings=["API rate limit approaching"],
            processing_time=5.2,
            spec_updated=True
        )
        
        # Validate statistics
        self.assertEqual(result.success_rate, 2/3)  # 2 success out of 3 attempts
        self.assertEqual(len(result.created_issues), 2)
        self.assertEqual(len(result.errors), 1)
        self.assertEqual(len(result.warnings), 1)
        self.assertGreater(result.processing_time, 0)


if __name__ == '__main__':
    unittest.main()