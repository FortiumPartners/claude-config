#!/usr/bin/env python3
"""
Tests for the template system implementation.

Tests configuration framework, template engine, and acceptance criteria templating.
"""

import unittest
import tempfile
import json
from pathlib import Path
from typing import Dict, Any

from configuration_schema import (
    TeamConfiguration, IssueTemplate, IssueTemplateType,
    TicketingSystemConfig, AutomaticIssueCreationConfig,
    ConfigurationValidator
)
from configuration_manager import ConfigurationManager, ProjectConfigurationManager
from template_engine import TemplateEngine, TemplateContext
from acceptance_criteria_templating import (
    AcceptanceCriteriaTemplatingEngine, enhance_criteria_with_templates
)
from default_templates import DefaultTemplateLibrary
from issue_spec import IssueSpec, IssueType, IssuePriority, AcceptanceCriteria, AcceptanceCriterion


class TestConfigurationSchema(unittest.TestCase):
    """Test configuration schema and validation."""
    
    def test_team_configuration_creation(self):
        """Test creating team configuration."""
        config = TeamConfiguration(
            team_name="Test Team",
            automatic_issue_creation=AutomaticIssueCreationConfig(
                enabled=True,
                default_ticketing_system="linear"
            ),
            ticketing_systems={
                "linear": TicketingSystemConfig(
                    system_type="linear",
                    team_id="TEST-123"
                )
            }
        )
        
        self.assertEqual(config.team_name, "Test Team")
        self.assertTrue(config.automatic_issue_creation.enabled)
        self.assertIn("linear", config.ticketing_systems)
        self.assertEqual(config.ticketing_systems["linear"].team_id, "TEST-123")
    
    def test_configuration_serialization(self):
        """Test YAML and JSON serialization."""
        config = TeamConfiguration(team_name="Test Team")
        
        # Test YAML
        yaml_content = config.to_yaml()
        self.assertIn("team_name: Test Team", yaml_content)
        
        # Test JSON
        json_content = config.to_json()
        parsed_json = json.loads(json_content)
        self.assertEqual(parsed_json["team_name"], "Test Team")
        
        # Test round-trip
        config_from_yaml = TeamConfiguration.from_yaml(yaml_content)
        self.assertEqual(config_from_yaml.team_name, "Test Team")
    
    def test_configuration_validation(self):
        """Test configuration validation."""
        validator = ConfigurationValidator()
        
        # Valid configuration
        valid_config = TeamConfiguration(
            team_name="Valid Team",
            automatic_issue_creation=AutomaticIssueCreationConfig(
                default_ticketing_system="linear"
            ),
            ticketing_systems={
                "linear": TicketingSystemConfig(
                    system_type="linear",
                    team_id="VALID-123"
                )
            }
        )
        
        self.assertTrue(validator.validate(valid_config))
        
        # Invalid configuration - missing ticketing system
        invalid_config = TeamConfiguration(
            automatic_issue_creation=AutomaticIssueCreationConfig(
                default_ticketing_system="missing_system"
            ),
            ticketing_systems={}
        )
        
        self.assertFalse(validator.validate(invalid_config))
        self.assertGreater(len(validator.errors), 0)


class TestConfigurationManager(unittest.TestCase):
    """Test configuration manager."""
    
    def setUp(self):
        """Set up test environment."""
        self.test_dir = tempfile.mkdtemp()
        self.manager = ConfigurationManager(self.test_dir)
    
    def tearDown(self):
        """Clean up test environment."""
        import shutil
        shutil.rmtree(self.test_dir, ignore_errors=True)
    
    def test_configuration_loading_precedence(self):
        """Test configuration loading with precedence."""
        # Create configuration file
        config_dir = Path(self.test_dir) / ".agent-os" / "config"
        config_dir.mkdir(parents=True, exist_ok=True)
        
        config_data = {
            "team_name": "Test Team",
            "automatic_issue_creation": {
                "enabled": True,
                "default_ticketing_system": "linear"
            },
            "ticketing_systems": {
                "linear": {
                    "system_type": "linear",
                    "team_id": "TEST-123"
                }
            }
        }
        
        config_file = config_dir / "issue-creation.json"
        with open(config_file, 'w') as f:
            json.dump(config_data, f)
        
        # Load configuration
        loaded_config = self.manager.load_configuration()
        
        self.assertEqual(loaded_config.team_name, "Test Team")
        self.assertTrue(loaded_config.automatic_issue_creation.enabled)
    
    def test_sample_configuration_creation(self):
        """Test creating sample configurations."""
        # Linear configuration
        linear_config = self.manager.create_sample_configuration(
            "linear", "Linear Team", team_id="LINEAR-123"
        )
        
        self.assertEqual(linear_config.team_name, "Linear Team")
        self.assertEqual(linear_config.ticketing_systems["linear"].team_id, "LINEAR-123")
        
        # GitHub configuration
        github_config = self.manager.create_sample_configuration(
            "github", "GitHub Team", owner="test-org", repo="test-repo"
        )
        
        self.assertEqual(github_config.ticketing_systems["github"].repository_owner, "test-org")
        self.assertEqual(github_config.ticketing_systems["github"].repository_name, "test-repo")


class TestTemplateEngine(unittest.TestCase):
    """Test template engine functionality."""
    
    def setUp(self):
        """Set up test environment."""
        self.team_config = TeamConfiguration(
            team_name="Test Team",
            templates=DefaultTemplateLibrary.get_standard_templates()
        )
        self.template_engine = TemplateEngine(self.team_config)
    
    def test_title_formatting(self):
        """Test title prefix and suffix formatting."""
        issue = IssueSpec(
            id="test-1",
            title="User Authentication",
            description="Implement user authentication",
            issue_type=IssueType.FEATURE,
            priority=IssuePriority.HIGH
        )
        
        templated_issue = self.template_engine.apply_template(issue)
        
        # Should have [FEATURE] prefix
        self.assertTrue(templated_issue.title.startswith("[FEATURE]"))
        self.assertIn("User Authentication", templated_issue.title)
    
    def test_description_templating(self):
        """Test description template application."""
        issue = IssueSpec(
            id="test-2",
            title="Bug Fix",
            description="Fix login bug",
            issue_type=IssueType.BUG,
            priority=IssuePriority.URGENT,
            acceptance_criteria=AcceptanceCriteria(criteria=[
                AcceptanceCriterion(description="Login works correctly", completed=False)
            ])
        )
        
        templated_issue = self.template_engine.apply_template(issue)
        
        # Should include original description and acceptance criteria
        self.assertIn("Fix login bug", templated_issue.description)
        self.assertIn("Login works correctly", templated_issue.description)
    
    def test_label_assignment(self):
        """Test label assignment from templates."""
        issue = IssueSpec(
            id="test-3",
            title="Epic Planning",
            description="Plan epic implementation",
            issue_type=IssueType.EPIC,
            priority=IssuePriority.MEDIUM
        )
        
        templated_issue = self.template_engine.apply_template(issue)
        
        # Should have epic and planning labels
        self.assertIn("epic", templated_issue.labels)
        self.assertIn("planning", templated_issue.labels)
    
    def test_priority_mapping(self):
        """Test priority mapping to system-specific values."""
        issue = IssueSpec(
            id="test-4",
            title="High Priority Task",
            description="Important task",
            issue_type=IssueType.TASK,
            priority=IssuePriority.HIGH
        )
        
        templated_issue = self.template_engine.apply_template(issue)
        
        # Should have system-specific priority mapping
        self.assertIn("system_priority", templated_issue.custom_fields)
    
    def test_batch_template_application(self):
        """Test applying templates to multiple issues."""
        issues = [
            IssueSpec(
                id=f"test-{i}",
                title=f"Issue {i}",
                description=f"Description {i}",
                issue_type=IssueType.TASK,
                priority=IssuePriority.MEDIUM
            )
            for i in range(3)
        ]
        
        templated_issues = self.template_engine.apply_template_batch(issues)
        
        self.assertEqual(len(templated_issues), 3)
        for templated_issue in templated_issues:
            self.assertTrue(templated_issue.title.startswith("[TASK]"))
            self.assertIn("task", templated_issue.labels)


class TestAcceptanceCriteriaTemplating(unittest.TestCase):
    """Test acceptance criteria templating."""
    
    def setUp(self):
        """Set up test environment."""
        self.templating_engine = AcceptanceCriteriaTemplatingEngine()
    
    def test_criteria_enhancement(self):
        """Test enhancing existing acceptance criteria."""
        criteria = AcceptanceCriteria(criteria=[
            AcceptanceCriterion(
                description="user can login",
                completed=False
            ),
            AcceptanceCriterion(
                description="system is fast",
                completed=False
            )
        ])
        
        enhanced = self.templating_engine.enhance_acceptance_criteria(
            criteria, IssueType.FEATURE
        )
        
        # Should improve formatting
        enhanced_descriptions = [c.description for c in enhanced.criteria]
        self.assertTrue(any("User can login" in desc for desc in enhanced_descriptions))
        
        # Should add missing essential criteria
        self.assertGreater(len(enhanced.criteria), len(criteria.criteria))
    
    def test_criteria_categorization(self):
        """Test automatic categorization of criteria."""
        criteria = AcceptanceCriteria(criteria=[
            AcceptanceCriterion(
                description="Response time is under 2 seconds",
                completed=False
            ),
            AcceptanceCriterion(
                description="User authentication is secure",
                completed=False
            ),
            AcceptanceCriterion(
                description="Works on mobile devices",
                completed=False
            )
        ])
        
        enhanced = self.templating_engine.enhance_acceptance_criteria(
            criteria, IssueType.FEATURE
        )
        
        # Should categorize correctly
        categories = {c.category for c in enhanced.criteria if c.category}
        self.assertIn("performance", categories)
        self.assertIn("security", categories)
        self.assertIn("compatibility", categories)
    
    def test_missing_criteria_detection(self):
        """Test detection and addition of missing essential criteria."""
        # Feature with only functional criteria
        criteria = AcceptanceCriteria(criteria=[
            AcceptanceCriterion(
                description="Feature works correctly",
                completed=False
            )
        ])
        
        enhanced = self.templating_engine.enhance_acceptance_criteria(
            criteria, IssueType.FEATURE
        )
        
        # Should add missing essential criteria
        categories = {c.category for c in enhanced.criteria if c.category}
        self.assertIn("accessibility", categories)
        self.assertIn("performance", categories)
    
    def test_criteria_standardization(self):
        """Test criteria format standardization."""
        criteria = AcceptanceCriteria(criteria=[
            AcceptanceCriterion(
                description="user should be able to login",
                completed=False
            ),
            AcceptanceCriterion(
                description="system must be fast",
                completed=False
            )
        ])
        
        standardized = self.templating_engine.standardize_format(criteria)
        
        # Should improve formatting
        descriptions = [c.description for c in standardized.criteria]
        self.assertTrue(any("User can login" in desc for desc in descriptions))
        self.assertTrue(any("System is fast" in desc for desc in descriptions))


class TestDefaultTemplateLibrary(unittest.TestCase):
    """Test default template library."""
    
    def test_standard_templates(self):
        """Test standard template creation."""
        templates = DefaultTemplateLibrary.get_standard_templates()
        
        # Should have all standard types
        expected_types = [t.value for t in IssueTemplateType]
        for issue_type in expected_types:
            self.assertIn(issue_type, templates)
        
        # Each template should have basic properties
        for template in templates.values():
            self.assertIsNotNone(template.title_prefix)
            self.assertIsInstance(template.labels, list)
            self.assertGreater(len(template.labels), 0)
    
    def test_system_specific_templates(self):
        """Test system-specific template customization."""
        linear_templates = DefaultTemplateLibrary.get_linear_templates()
        github_templates = DefaultTemplateLibrary.get_github_templates()
        
        # Linear templates should have Linear-specific priority mapping
        linear_epic = linear_templates["epic"]
        self.assertEqual(linear_epic.priority_mapping["P1"], "1")
        
        # GitHub templates should have GitHub-specific labels
        github_bug = github_templates["bug"]
        self.assertIn("github", github_bug.labels)
        self.assertIn("type:bug", github_bug.labels)
    
    def test_custom_template_creation(self):
        """Test creating custom templates."""
        custom_template = DefaultTemplateLibrary.create_custom_template(
            issue_type="custom",
            title_prefix="[CUSTOM]",
            labels=["custom", "test"],
            description_template="Custom template: {original_description}",
            priority="high"
        )
        
        self.assertEqual(custom_template.title_prefix, "[CUSTOM]")
        self.assertIn("custom", custom_template.labels)
        self.assertEqual(custom_template.custom_fields["priority"], "high")


class TestIntegrationScenarios(unittest.TestCase):
    """Test integration scenarios combining all components."""
    
    def setUp(self):
        """Set up integration test environment."""
        self.test_dir = tempfile.mkdtemp()
        self.manager = ConfigurationManager(self.test_dir)
    
    def tearDown(self):
        """Clean up test environment."""
        import shutil
        shutil.rmtree(self.test_dir, ignore_errors=True)
    
    def test_full_template_workflow(self):
        """Test complete template application workflow."""
        # Create configuration
        config = self.manager.create_sample_configuration(
            "linear", "Integration Test Team", team_id="INT-123"
        )
        
        # Create template engine
        template_engine = TemplateEngine(config)
        criteria_engine = AcceptanceCriteriaTemplatingEngine()
        
        # Create test issue
        issue = IssueSpec(
            id="integration-1",
            title="User Registration",
            description="Implement user registration functionality",
            issue_type=IssueType.FEATURE,
            priority=IssuePriority.HIGH,
            acceptance_criteria=AcceptanceCriteria(criteria=[
                AcceptanceCriterion(
                    description="users can register with email",
                    completed=False
                )
            ])
        )
        
        # Enhance acceptance criteria
        enhanced_criteria = criteria_engine.enhance_acceptance_criteria(
            issue.acceptance_criteria, issue.issue_type
        )
        issue.acceptance_criteria = enhanced_criteria
        
        # Apply template
        context = TemplateContext(
            issue=issue,
            team_config=config,
            project_name="Integration Test"
        )
        templated_issue = template_engine.apply_template(issue, context)
        
        # Validate results
        self.assertTrue(templated_issue.title.startswith("[FEATURE]"))
        self.assertIn("feature", templated_issue.labels)
        self.assertIn("Users can register", templated_issue.description)
        self.assertGreater(len(templated_issue.acceptance_criteria.criteria), 1)
        
        # Should have system-specific priority
        self.assertIn("system_priority", templated_issue.custom_fields)


if __name__ == '__main__':
    unittest.main(verbosity=2)