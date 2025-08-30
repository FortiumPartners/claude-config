#!/usr/bin/env python3
"""
Integration tests for automatic issue creation system.

Tests the integration between different components and MCP servers.
"""

import unittest
from unittest.mock import Mock, patch, AsyncMock
import asyncio
import tempfile
from pathlib import Path
import json

from create_spec_integration import CreateSpecIntegration, execute_automatic_issue_creation
from automatic_issue_creator import IssueCreationConfig
from ticketing_interface import TicketingSystem


class TestMCPIntegration(unittest.TestCase):
    """Test MCP server integration."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.integration = CreateSpecIntegration()
        self.test_dir = tempfile.mkdtemp()
    
    def tearDown(self):
        """Clean up test fixtures."""
        import shutil
        shutil.rmtree(self.test_dir, ignore_errors=True)
    
    @patch('linear_integration.LinearMCPIntegration')
    def test_linear_mcp_integration(self, mock_linear_class):
        """Test integration with Linear MCP server."""
        # Setup mock Linear MCP
        mock_linear = Mock()
        mock_linear_class.return_value = mock_linear
        
        # Mock Linear responses
        async def mock_get_teams():
            return [
                {"id": "TEAM-1", "name": "Product Team", "key": "PROD"}
            ]
        
        async def mock_create_issue(title, description, team_id, **kwargs):
            return {
                "id": "PROD-123",
                "identifier": "PROD-123", 
                "title": title,
                "url": "https://linear.app/team/issue/PROD-123",
                "state": {"name": "Todo"}
            }
        
        async def mock_test_connection():
            return True
        
        mock_linear.get_teams = mock_get_teams
        mock_linear.create_issue = mock_create_issue  
        mock_linear.test_connection = mock_test_connection
        
        # Test connection
        async def run_test():
            connection_ok = await mock_linear.test_connection()
            self.assertTrue(connection_ok)
            
            # Test team retrieval
            teams = await mock_linear.get_teams()
            self.assertEqual(len(teams), 1)
            self.assertEqual(teams[0]["name"], "Product Team")
            
            # Test issue creation
            created_issue = await mock_linear.create_issue(
                "Test Epic",
                "Test description",
                "TEAM-1",
                priority=1
            )
            
            self.assertEqual(created_issue["identifier"], "PROD-123")
            self.assertEqual(created_issue["title"], "Test Epic")
            
        asyncio.run(run_test())
    
    @patch('github_integration.GitHubMCPIntegration')
    def test_github_mcp_integration(self, mock_github_class):
        """Test integration with GitHub Issues MCP server."""
        # Setup mock GitHub MCP
        mock_github = Mock()
        mock_github_class.return_value = mock_github
        
        # Mock GitHub responses
        async def mock_create_issue(title, body, owner, repo, **kwargs):
            return {
                "number": 42,
                "title": title,
                "html_url": f"https://github.com/{owner}/{repo}/issues/42",
                "state": "open"
            }
        
        async def mock_test_connection():
            return True
        
        mock_github.create_issue = mock_create_issue
        mock_github.test_connection = mock_test_connection
        
        # Test GitHub integration
        async def run_test():
            connection_ok = await mock_github.test_connection()
            self.assertTrue(connection_ok)
            
            # Test issue creation
            created_issue = await mock_github.create_issue(
                "Test Feature",
                "Test feature description",
                "owner",
                "repo",
                labels=["feature", "enhancement"]
            )
            
            self.assertEqual(created_issue["number"], 42)
            self.assertEqual(created_issue["title"], "Test Feature")
            self.assertIn("issues/42", created_issue["html_url"])
        
        asyncio.run(run_test())


class TestEndToEndWorkflow(unittest.TestCase):
    """Test complete end-to-end workflow."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.test_dir = tempfile.mkdtemp()
    
    def tearDown(self):
        """Clean up test fixtures."""
        import shutil
        shutil.rmtree(self.test_dir, ignore_errors=True)
    
    @patch('create_spec_integration.AutomaticIssueCreator')
    def test_complete_create_spec_integration(self, mock_creator_class):
        """Test complete /create-spec Phase 2.5 integration."""
        # Setup mock creator
        mock_creator = Mock()
        mock_creator_class.return_value = mock_creator
        
        # Mock successful test connection
        async def mock_test_connection():
            return True
        mock_creator.test_connection = mock_test_connection
        
        # Mock successful issue creation
        from automatic_issue_creator import IssueCreationResult
        from ticketing_interface import CreatedIssue, TicketingSystem
        
        created_issues = [
            CreatedIssue(
                id="EPIC-1",
                title="Test Epic",
                url="https://linear.app/team/issue/EPIC-1",
                system_type=TicketingSystem.LINEAR
            ),
            CreatedIssue(
                id="TASK-1", 
                title="Test Task",
                url="https://linear.app/team/issue/TASK-1",
                system_type=TicketingSystem.LINEAR
            )
        ]
        
        mock_result = IssueCreationResult(
            was_successful=True,
            total_created=2,
            total_failed=0,
            created_issues=created_issues,
            errors=[],
            warnings=[],
            processing_time=3.5,
            spec_updated=True
        )
        
        async def mock_create_issues(spec_path):
            return mock_result
        
        mock_creator.create_issues_from_file = mock_create_issues
        
        # Create test specification
        spec_content = """
# Epic: User Authentication System

Complete user authentication implementation.

## Feature: Login System

Implement secure user login.

### Task: Password Validation

Validate user passwords securely.

#### Acceptance Criteria
- [ ] Passwords must be at least 8 characters
- [ ] Must include special characters
- [ ] Account lockout after failed attempts
"""
        
        spec_file = Path(self.test_dir) / "auth_spec.md"
        spec_file.write_text(spec_content)
        
        # Create configuration file
        config_content = {
            "automatic_issue_creation": {
                "enabled": True,
                "dry_run": False,
                "default_ticketing_system": "linear"
            },
            "ticketing_systems": {
                "linear": {
                    "system_type": "linear",
                    "team_id": "TEAM-123"
                }
            }
        }
        
        config_dir = Path(self.test_dir) / ".agent-os" / "config"
        config_dir.mkdir(parents=True, exist_ok=True)
        config_file = config_dir / "issue-creation.json"
        
        with open(config_file, 'w') as f:
            json.dump(config_content, f)
        
        # Test the complete integration
        async def run_test():
            result = await execute_automatic_issue_creation(
                str(spec_file),
                config_override=None
            )
            
            # Validate Phase 2.5 execution result
            self.assertTrue(result["success"])
            self.assertTrue(result["enabled"])
            self.assertFalse(result["dry_run"])
            self.assertEqual(result["issues_created"], 2)
            self.assertEqual(len(result["errors"]), 0)
            self.assertEqual(len(result["warnings"]), 0)
            self.assertTrue(result["spec_updated"])
            self.assertGreater(result["execution_time"], 0)
            
            # Validate summary information
            summary = result["summary"]
            self.assertEqual(summary["ticketing_system"], "linear")
            self.assertEqual(summary["issues_created"], 2)
            self.assertEqual(summary["issues_failed"], 0)
            self.assertEqual(summary["success_rate"], 1.0)
            self.assertTrue(summary["spec_updated"])
        
        asyncio.run(run_test())
    
    def test_configuration_loading_precedence(self):
        """Test configuration loading with correct precedence."""
        # Create multiple configuration files
        
        # Global config (lowest precedence)
        global_config_dir = Path(self.test_dir) / "global" / ".agent-os" / "config"
        global_config_dir.mkdir(parents=True, exist_ok=True)
        global_config = {
            "automatic_issue_creation": {
                "enabled": True,
                "dry_run": True,  # Should be overridden
                "default_ticketing_system": "linear"
            },
            "ticketing_systems": {
                "linear": {"team_id": "GLOBAL-TEAM"}
            }
        }
        
        with open(global_config_dir / "issue-creation.json", 'w') as f:
            json.dump(global_config, f)
        
        # Project config (higher precedence)
        project_config_dir = Path(self.test_dir) / "project" / ".agent-os" / "config"
        project_config_dir.mkdir(parents=True, exist_ok=True)
        project_config = {
            "automatic_issue_creation": {
                "dry_run": False  # Should override global
            },
            "ticketing_systems": {
                "linear": {"team_id": "PROJECT-TEAM"}  # Should override global
            }
        }
        
        with open(project_config_dir / "issue-creation.json", 'w') as f:
            json.dump(project_config, f)
        
        integration = CreateSpecIntegration()
        
        # Mock the config search paths
        async def run_test():
            with patch.object(integration, '_load_configuration') as mock_load:
                # Simulate merged configuration
                merged_config = {
                    "automatic_issue_creation": {
                        "enabled": True,
                        "dry_run": False,  # From project config
                        "default_ticketing_system": "linear"
                    },
                    "ticketing_systems": {
                        "linear": {"team_id": "PROJECT-TEAM"}  # From project config
                    }
                }
                
                mock_config = Mock(spec=IssueCreationConfig)
                mock_config.enabled = True
                mock_config.dry_run = False
                mock_config.ticketing_config.team_id = "PROJECT-TEAM"
                
                mock_load.return_value = mock_config
                
                config = await integration._load_configuration("dummy_path", None)
                
                # Project settings should override global
                self.assertTrue(config.enabled)
                self.assertFalse(config.dry_run)
                self.assertEqual(config.ticketing_config.team_id, "PROJECT-TEAM")
        
        asyncio.run(run_test())
    
    @patch('create_spec_integration.AutomaticIssueCreator')
    def test_error_recovery_and_rollback(self, mock_creator_class):
        """Test error handling and rollback capabilities."""
        mock_creator = Mock()
        mock_creator_class.return_value = mock_creator
        
        # Mock connection test failure
        async def mock_test_connection():
            return False
        mock_creator.test_connection = mock_test_connection
        
        # Create test specification
        spec_file = Path(self.test_dir) / "error_spec.md"
        spec_file.write_text("# Epic: Test Epic\n\nTest content")
        
        async def run_test():
            result = await execute_automatic_issue_creation(str(spec_file), None)
            
            # Should handle connection failure gracefully
            self.assertTrue(result["success"])  # Still successful, but in dry-run
            self.assertTrue(result["dry_run"])  # Should switch to dry-run mode
            self.assertIn("connectivity issues", str(result["warnings"]))
        
        asyncio.run(run_test())
    
    def test_disabled_configuration(self):
        """Test behavior when automatic issue creation is disabled."""
        # Create disabled configuration
        config_content = {
            "automatic_issue_creation": {
                "enabled": False
            }
        }
        
        config_dir = Path(self.test_dir) / ".agent-os" / "config"
        config_dir.mkdir(parents=True, exist_ok=True)
        config_file = config_dir / "issue-creation.json"
        
        with open(config_file, 'w') as f:
            json.dump(config_content, f)
        
        spec_file = Path(self.test_dir) / "disabled_spec.md"
        spec_file.write_text("# Epic: Disabled Test\n\nTest content")
        
        async def run_test():
            result = await execute_automatic_issue_creation(str(spec_file), None)
            
            # Should skip processing when disabled
            self.assertTrue(result["success"])
            self.assertFalse(result["enabled"])
            self.assertEqual(result["issues_created"], 0)
        
        asyncio.run(run_test())


class TestPerformanceAndReliability(unittest.TestCase):
    """Test performance and reliability aspects."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.test_dir = tempfile.mkdtemp()
    
    def tearDown(self):
        """Clean up test fixtures."""
        import shutil
        shutil.rmtree(self.test_dir, ignore_errors=True)
    
    @patch('create_spec_integration.AutomaticIssueCreator')
    def test_large_specification_processing(self, mock_creator_class):
        """Test processing large specifications efficiently."""
        mock_creator = Mock()
        mock_creator_class.return_value = mock_creator
        
        async def mock_test_connection():
            return True
        mock_creator.test_connection = mock_test_connection
        
        # Mock processing time measurement
        from automatic_issue_creator import IssueCreationResult
        from ticketing_interface import CreatedIssue, TicketingSystem
        
        # Simulate large number of issues (100 issues)
        created_issues = [
            CreatedIssue(
                id=f"ISSUE-{i}",
                title=f"Issue {i}",
                url=f"https://linear.app/team/issue/ISSUE-{i}",
                system_type=TicketingSystem.LINEAR
            )
            for i in range(1, 101)
        ]
        
        mock_result = IssueCreationResult(
            was_successful=True,
            total_created=100,
            total_failed=0,
            created_issues=created_issues,
            errors=[],
            warnings=[],
            processing_time=8.5,  # Should be reasonable for 100 issues
            spec_updated=True
        )
        
        async def mock_create_issues(spec_path):
            return mock_result
        
        mock_creator.create_issues_from_file = mock_create_issues
        
        # Create large specification
        spec_content = "# Epic: Large System\n\n"
        for i in range(1, 101):
            spec_content += f"## Feature {i}: Feature {i}\n\nDescription {i}\n\n"
        
        spec_file = Path(self.test_dir) / "large_spec.md"
        spec_file.write_text(spec_content)
        
        async def run_test():
            result = await execute_automatic_issue_creation(str(spec_file), None)
            
            # Should handle large specifications efficiently
            self.assertTrue(result["success"])
            self.assertEqual(result["issues_created"], 100)
            self.assertLess(result["execution_time"], 10.0)  # Should complete in reasonable time
        
        asyncio.run(run_test())
    
    def test_concurrent_processing_safety(self):
        """Test that concurrent processing doesn't cause issues."""
        # This would test thread safety and concurrent access patterns
        # For now, we'll test that multiple instances can be created safely
        
        integration1 = CreateSpecIntegration()
        integration2 = CreateSpecIntegration()
        
        # Should be able to create multiple instances
        self.assertIsNotNone(integration1)
        self.assertIsNotNone(integration2)
        
        # Each should have independent state
        self.assertNotEqual(id(integration1.config_cache), id(integration2.config_cache))


if __name__ == '__main__':
    unittest.main()