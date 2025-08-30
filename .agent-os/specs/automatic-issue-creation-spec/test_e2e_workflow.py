#!/usr/bin/env python3
"""
End-to-end testing of enhanced /create-spec workflow.

Tests the complete workflow integration from specification to issue creation.
"""

import unittest
from unittest.mock import Mock, patch, AsyncMock
import asyncio
import tempfile
from pathlib import Path
import json
import time

from create_spec_integration import CreateSpecIntegration


class TestCreateSpecWorkflow(unittest.TestCase):
    """Test complete /create-spec workflow with Phase 2.5."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.test_dir = tempfile.mkdtemp()
        self.integration = CreateSpecIntegration()
    
    def tearDown(self):
        """Clean up test fixtures."""
        import shutil
        shutil.rmtree(self.test_dir, ignore_errors=True)
    
    def create_test_specification(self, filename="test_spec.md"):
        """Create a comprehensive test specification."""
        spec_content = """
# Epic: E-commerce Platform Enhancement [P1] [40 hours]

Comprehensive enhancement of the e-commerce platform to improve user experience and increase conversion rates.

## Business Goals
- Increase conversion rate by 15%
- Reduce cart abandonment by 20%
- Improve user satisfaction scores to 4.5+

## Feature: Advanced Product Search [P1] [16 hours]

Implement advanced search functionality with filtering and sorting capabilities.

### User Stories
As a customer, I want to search products efficiently so that I can find what I need quickly.

### Task: Search Index Implementation [P1] [4 hours]

Implement Elasticsearch-based search indexing.

#### Technical Requirements
- Index product data in real-time
- Support fuzzy matching and typos
- Include product attributes and categories

#### Acceptance Criteria
- [ ] Products are indexed within 30 seconds of updates
- [ ] Search supports typos with up to 2 character differences
- [ ] Search includes product name, description, and categories
- [ ] Search response time is under 200ms for 95% of queries

### Task: Advanced Filtering System [P1] [6 hours]

Create dynamic filtering interface for search results.

#### Acceptance Criteria
- [ ] Users can filter by price range, brand, category, and ratings
- [ ] Filters update results dynamically without page reload
- [ ] Filter combinations work correctly
- [ ] Filter state persists during session

### Task: Search Analytics [P2] [3 hours]

Track search behavior for optimization.

#### Acceptance Criteria
- [ ] Track search queries and results
- [ ] Monitor search performance metrics
- [ ] Generate search optimization reports

### Task: Search Result Optimization [P2] [3 hours]

Optimize search result ranking and presentation.

## Feature: Shopping Cart Improvements [P1] [12 hours]

Enhance shopping cart functionality to reduce abandonment.

### Task: Persistent Cart [P1] [4 hours]

Implement persistent shopping cart across sessions.

#### Acceptance Criteria
- [ ] Cart contents persist when user closes browser
- [ ] Cart syncs across devices when user is logged in
- [ ] Cart expires after 30 days of inactivity

### Task: Cart Recovery System [P1] [4 hours]

Send automated cart recovery emails.

#### Acceptance Criteria
- [ ] Send reminder email 1 hour after cart abandonment
- [ ] Send second reminder after 24 hours
- [ ] Include personalized product recommendations

### Task: Quick Checkout [P2] [4 hours]

Implement one-click checkout for returning customers.

#### Acceptance Criteria
- [ ] Returning customers can checkout with single click
- [ ] Payment method and shipping address are pre-filled
- [ ] Order confirmation is instant

## Feature: User Account Enhancement [P2] [8 hours]

Improve user account management and personalization.

### Task: Order History Redesign [P2] [3 hours]

Redesign order history interface.

#### Acceptance Criteria
- [ ] Orders are displayed chronologically with clear status
- [ ] Users can filter orders by date range and status
- [ ] Order details are expandable inline

### Task: Wishlist Functionality [P2] [3 hours]

Add product wishlist feature.

#### Acceptance Criteria
- [ ] Users can add/remove products from wishlist
- [ ] Wishlist is accessible from user account
- [ ] Users receive notifications when wishlist items go on sale

### Task: Personalized Recommendations [P2] [2 hours]

Show personalized product recommendations.

#### Acceptance Criteria
- [ ] Recommendations based on purchase history
- [ ] Recommendations update in real-time
- [ ] Users can dismiss irrelevant recommendations

## Feature: Performance Optimization [P2] [4 hours]

Optimize platform performance for better user experience.

### Task: Page Load Optimization [P1] [2 hours]

Improve page loading times.

#### Acceptance Criteria
- [ ] Product pages load in under 2 seconds
- [ ] Search results load in under 1 second
- [ ] Images are lazy-loaded and optimized

### Task: Database Query Optimization [P2] [2 hours]

Optimize database queries for better performance.

#### Acceptance Criteria
- [ ] Complex queries execute in under 100ms
- [ ] Database connection pooling is implemented
- [ ] Slow query monitoring is in place

## Non-Functional Requirements

### Performance
- Page load time: < 2 seconds for 95% of pages
- Search response time: < 200ms
- Database query time: < 100ms for complex queries

### Security
- All user inputs must be validated and sanitized
- Payment processing must be PCI DSS compliant
- User sessions must expire after 30 minutes of inactivity

### Accessibility
- WCAG 2.1 AA compliance
- Keyboard navigation support
- Screen reader compatibility

### Browser Support
- Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- Mobile responsiveness required

## Success Metrics

- Conversion rate increase: Target 15%
- Cart abandonment reduction: Target 20%
- User satisfaction: Target 4.5+ stars
- Page load time: < 2 seconds for 95% of requests
- Search success rate: > 90% of searches return relevant results

## Risk Assessment

### High Risk
- Search implementation complexity may cause delays
- Third-party payment integration challenges

### Medium Risk
- Database performance under high load
- Cross-browser compatibility issues

### Mitigation Strategies
- Extensive testing in staging environment
- Performance monitoring and alerting
- Rollback procedures for each deployment
"""
        
        spec_file = Path(self.test_dir) / filename
        spec_file.write_text(spec_content)
        return spec_file
    
    def create_test_configuration(self, system_type="linear"):
        """Create test configuration for issue creation."""
        if system_type == "linear":
            config_content = {
                "automatic_issue_creation": {
                    "enabled": True,
                    "dry_run": False,
                    "default_ticketing_system": "linear",
                    "use_advanced_detection": True,
                    "apply_templates": True,
                    "update_spec_with_links": True,
                    "create_summary_report": True,
                    "max_issues_per_spec": 50,
                    "processing_timeout": 300
                },
                "ticketing_systems": {
                    "linear": {
                        "system_type": "linear",
                        "team_id": "ECOM-123",
                        "default_assignee": "@product-owner",
                        "default_labels": ["auto-generated", "enhancement"]
                    }
                },
                "templates": {
                    "epic": {
                        "title_prefix": "[EPIC]",
                        "labels": ["epic", "planning"],
                        "default_assignee": "@product-owner"
                    },
                    "feature": {
                        "title_prefix": "[FEATURE]",
                        "labels": ["feature", "development"],
                        "default_assignee": "@tech-lead"
                    },
                    "task": {
                        "title_prefix": "[TASK]",
                        "labels": ["task", "implementation"],
                        "default_assignee": "@developer"
                    }
                }
            }
        else:  # GitHub
            config_content = {
                "automatic_issue_creation": {
                    "enabled": True,
                    "dry_run": False,
                    "default_ticketing_system": "github"
                },
                "ticketing_systems": {
                    "github": {
                        "system_type": "github",
                        "repository_owner": "example-org",
                        "repository_name": "ecommerce-platform",
                        "default_labels": ["auto-generated", "enhancement"]
                    }
                }
            }
        
        config_dir = Path(self.test_dir) / ".agent-os" / "config"
        config_dir.mkdir(parents=True, exist_ok=True)
        config_file = config_dir / "issue-creation.json"
        
        with open(config_file, 'w') as f:
            json.dump(config_content, f, indent=2)
        
        return config_file
    
    @patch('create_spec_integration.AutomaticIssueCreator')
    def test_complete_workflow_with_linear(self, mock_creator_class):
        """Test complete workflow with Linear integration."""
        # Setup mock creator
        mock_creator = Mock()
        mock_creator_class.return_value = mock_creator
        
        # Mock successful connection
        async def mock_test_connection():
            return True
        mock_creator.test_connection = mock_test_connection
        
        # Mock successful issue creation with realistic data
        from automatic_issue_creator import IssueCreationResult
        from ticketing_interface import CreatedIssue, TicketingSystem
        from issue_spec import IssueHierarchy, IssueSpec, IssueType, IssuePriority
        
        # Create realistic created issues
        created_issues = [
            CreatedIssue("ECOM-1", "[EPIC] E-commerce Platform Enhancement", "https://linear.app/ecom/issue/ECOM-1", TicketingSystem.LINEAR),
            CreatedIssue("ECOM-2", "[FEATURE] Advanced Product Search", "https://linear.app/ecom/issue/ECOM-2", TicketingSystem.LINEAR),
            CreatedIssue("ECOM-3", "[TASK] Search Index Implementation", "https://linear.app/ecom/issue/ECOM-3", TicketingSystem.LINEAR),
            CreatedIssue("ECOM-4", "[TASK] Advanced Filtering System", "https://linear.app/ecom/issue/ECOM-4", TicketingSystem.LINEAR),
            CreatedIssue("ECOM-5", "[TASK] Search Analytics", "https://linear.app/ecom/issue/ECOM-5", TicketingSystem.LINEAR),
            CreatedIssue("ECOM-6", "[TASK] Search Result Optimization", "https://linear.app/ecom/issue/ECOM-6", TicketingSystem.LINEAR),
            CreatedIssue("ECOM-7", "[FEATURE] Shopping Cart Improvements", "https://linear.app/ecom/issue/ECOM-7", TicketingSystem.LINEAR),
            CreatedIssue("ECOM-8", "[TASK] Persistent Cart", "https://linear.app/ecom/issue/ECOM-8", TicketingSystem.LINEAR),
            CreatedIssue("ECOM-9", "[TASK] Cart Recovery System", "https://linear.app/ecom/issue/ECOM-9", TicketingSystem.LINEAR),
            CreatedIssue("ECOM-10", "[TASK] Quick Checkout", "https://linear.app/ecom/issue/ECOM-10", TicketingSystem.LINEAR),
            CreatedIssue("ECOM-11", "[FEATURE] User Account Enhancement", "https://linear.app/ecom/issue/ECOM-11", TicketingSystem.LINEAR),
            CreatedIssue("ECOM-12", "[FEATURE] Performance Optimization", "https://linear.app/ecom/issue/ECOM-12", TicketingSystem.LINEAR)
        ]
        
        # Create mock hierarchy
        hierarchy = IssueHierarchy()
        epic = IssueSpec("epic-1", "E-commerce Platform Enhancement", "Epic description", IssueType.EPIC, IssuePriority.URGENT)
        hierarchy.add_issue(epic)
        
        mock_result = IssueCreationResult(
            was_successful=True,
            total_created=12,
            total_failed=0,
            created_issues=created_issues,
            errors=[],
            warnings=["Rate limit approaching - consider using batch creation"],
            processing_time=15.3,
            spec_updated=True,
            hierarchy=hierarchy
        )
        
        async def mock_create_issues(spec_path):
            # Simulate processing time
            await asyncio.sleep(0.1)
            return mock_result
        
        mock_creator.create_issues_from_file = mock_create_issues
        
        # Create test files
        spec_file = self.create_test_specification("ecommerce_spec.md")
        config_file = self.create_test_configuration("linear")
        
        async def run_test():
            # Execute Phase 2.5
            result = await self.integration.execute_phase_25(str(spec_file))
            
            # Validate execution results
            self.assertTrue(result["success"])
            self.assertTrue(result["enabled"])
            self.assertFalse(result["dry_run"])
            self.assertEqual(result["issues_created"], 12)
            self.assertEqual(len(result["errors"]), 0)
            self.assertEqual(len(result["warnings"]), 1)
            self.assertTrue(result["spec_updated"])
            self.assertGreater(result["execution_time"], 0)
            
            # Validate summary
            summary = result["summary"]
            self.assertEqual(summary["ticketing_system"], "linear")
            self.assertEqual(summary["issues_created"], 12)
            self.assertEqual(summary["issues_failed"], 0)
            self.assertEqual(summary["success_rate"], 1.0)
            self.assertTrue(summary["spec_updated"])
            self.assertIn("first_issue_url", summary)
            self.assertIn("system_base_url", summary)
            
            # Should have issue breakdown
            breakdown = summary["issue_breakdown"]
            self.assertGreaterEqual(breakdown["epics"], 1)
            self.assertGreaterEqual(breakdown["features"], 3)
            self.assertGreaterEqual(breakdown["tasks"], 8)
            self.assertEqual(breakdown["total"], 12)
        
        asyncio.run(run_test())
    
    @patch('create_spec_integration.AutomaticIssueCreator')
    def test_workflow_with_github(self, mock_creator_class):
        """Test complete workflow with GitHub integration."""
        mock_creator = Mock()
        mock_creator_class.return_value = mock_creator
        
        async def mock_test_connection():
            return True
        mock_creator.test_connection = mock_test_connection
        
        # GitHub-specific created issues
        from automatic_issue_creator import IssueCreationResult
        from ticketing_interface import CreatedIssue, TicketingSystem
        
        created_issues = [
            CreatedIssue("1", "E-commerce Platform Enhancement", "https://github.com/example-org/ecommerce-platform/issues/1", TicketingSystem.GITHUB),
            CreatedIssue("2", "Advanced Product Search", "https://github.com/example-org/ecommerce-platform/issues/2", TicketingSystem.GITHUB),
            CreatedIssue("3", "Shopping Cart Improvements", "https://github.com/example-org/ecommerce-platform/issues/3", TicketingSystem.GITHUB)
        ]
        
        mock_result = IssueCreationResult(
            was_successful=True,
            total_created=3,
            total_failed=0,
            created_issues=created_issues,
            errors=[],
            warnings=[],
            processing_time=8.7,
            spec_updated=True
        )
        
        async def mock_create_issues(spec_path):
            return mock_result
        
        mock_creator.create_issues_from_file = mock_create_issues
        
        # Create test files for GitHub
        spec_file = self.create_test_specification("github_spec.md")
        config_file = self.create_test_configuration("github")
        
        async def run_test():
            result = await self.integration.execute_phase_25(str(spec_file))
            
            # Should work with GitHub
            self.assertTrue(result["success"])
            self.assertEqual(result["issues_created"], 3)
            
            summary = result["summary"]
            self.assertEqual(summary["ticketing_system"], "github")
            self.assertIn("github.com", summary["first_issue_url"])
        
        asyncio.run(run_test())
    
    def test_workflow_performance_requirements(self):
        """Test that workflow meets performance requirements."""
        # Create large specification
        large_spec_content = "# Epic: Large System\n\n"
        for i in range(1, 26):  # 25 features
            large_spec_content += f"## Feature {i}: Feature {i}\n\n"
            for j in range(1, 5):  # 4 tasks per feature
                large_spec_content += f"### Task {i}.{j}: Task {i}.{j}\n\n"
                large_spec_content += "#### Acceptance Criteria\n"
                for k in range(1, 4):  # 3 criteria per task
                    large_spec_content += f"- [ ] Criteria {i}.{j}.{k}\n"
                large_spec_content += "\n"
        
        spec_file = Path(self.test_dir) / "large_spec.md"
        spec_file.write_text(large_spec_content)
        
        config_file = self.create_test_configuration()
        
        async def run_test():
            start_time = time.time()
            
            # Mock processing that stays within performance budget
            with patch('create_spec_integration.AutomaticIssueCreator') as mock_creator_class:
                mock_creator = Mock()
                mock_creator_class.return_value = mock_creator
                
                async def mock_test_connection():
                    return True
                mock_creator.test_connection = mock_test_connection
                
                # Simulate processing 125 issues (1 epic + 25 features + 99 tasks)
                from automatic_issue_creator import IssueCreationResult
                
                mock_result = IssueCreationResult(
                    was_successful=True,
                    total_created=125,
                    total_failed=0,
                    created_issues=[],
                    errors=[],
                    warnings=[],
                    processing_time=45.0,  # Should be under performance budget
                    spec_updated=True
                )
                
                async def mock_create_issues(spec_path):
                    # Simulate realistic processing time
                    await asyncio.sleep(0.05)
                    return mock_result
                
                mock_creator.create_issues_from_file = mock_create_issues
                
                result = await self.integration.execute_phase_25(str(spec_file))
                
                execution_time = time.time() - start_time
                
                # Performance requirements from tasks.md
                self.assertLess(result["execution_time"], 300)  # Under processing timeout
                self.assertLess(execution_time, 60)  # Overall execution under 1 minute
                self.assertEqual(result["issues_created"], 125)
        
        asyncio.run(run_test())
    
    @patch('create_spec_integration.AutomaticIssueCreator')
    def test_error_handling_in_workflow(self, mock_creator_class):
        """Test error handling throughout the workflow."""
        mock_creator = Mock()
        mock_creator_class.return_value = mock_creator
        
        # Test various error scenarios
        
        # 1. Connection failure -> should switch to dry run
        async def mock_test_connection_fail():
            return False
        mock_creator.test_connection = mock_test_connection_fail
        
        spec_file = self.create_test_specification("error_spec.md")
        config_file = self.create_test_configuration()
        
        async def test_connection_failure():
            result = await self.integration.execute_phase_25(str(spec_file))
            
            # Should gracefully handle connection failure
            self.assertTrue(result["success"])
            self.assertTrue(result["dry_run"])
            self.assertIn("connectivity issues", str(result["warnings"]))
        
        # 2. Partial failure during issue creation
        async def mock_test_connection_success():
            return True
        mock_creator.test_connection = mock_test_connection_success
        
        from automatic_issue_creator import IssueCreationResult
        from ticketing_interface import CreatedIssue, TicketingSystem
        
        # Some issues created, some failed
        mixed_result = IssueCreationResult(
            was_successful=True,  # Partially successful
            total_created=5,
            total_failed=2,
            created_issues=[
                CreatedIssue("ISSUE-1", "Created Issue 1", "http://example.com/1", TicketingSystem.LINEAR),
                CreatedIssue("ISSUE-2", "Created Issue 2", "http://example.com/2", TicketingSystem.LINEAR)
            ],
            errors=[
                {"issue": "Issue 3", "message": "API rate limit", "error": Exception("Rate limited")},
                {"issue": "Issue 4", "message": "Invalid data", "error": Exception("Validation error")}
            ],
            warnings=["Some issues failed to create"],
            processing_time=12.5,
            spec_updated=True
        )
        
        async def mock_create_issues_mixed(spec_path):
            return mixed_result
        
        mock_creator.create_issues_from_file = mock_create_issues_mixed
        
        async def test_partial_failure():
            result = await self.integration.execute_phase_25(str(spec_file))
            
            # Should handle partial failures gracefully
            self.assertTrue(result["success"])  # Overall success despite some failures
            self.assertEqual(result["issues_created"], 5)
            self.assertGreater(len(result["errors"]), 0)
            self.assertGreater(len(result["warnings"]), 0)
        
        # Run both tests
        asyncio.run(test_connection_failure())
        asyncio.run(test_partial_failure())
    
    def test_specification_validation(self):
        """Test specification file validation."""
        # Test invalid specification files
        
        # 1. Empty file
        empty_file = Path(self.test_dir) / "empty.md"
        empty_file.write_text("")
        
        async def test_empty_file():
            result = await self.integration.execute_phase_25(str(empty_file))
            self.assertFalse(result["success"])
            self.assertIn("validation failed", str(result["errors"]))
        
        # 2. No markdown headers
        no_headers_file = Path(self.test_dir) / "no_headers.md"
        no_headers_file.write_text("Just plain text without any markdown headers.")
        
        async def test_no_headers():
            result = await self.integration.execute_phase_25(str(no_headers_file))
            self.assertFalse(result["success"])
            self.assertIn("validation failed", str(result["errors"]))
        
        # 3. Non-existent file
        async def test_nonexistent_file():
            result = await self.integration.execute_phase_25("nonexistent.md")
            self.assertFalse(result["success"])
            self.assertIn("validation failed", str(result["errors"]))
        
        asyncio.run(test_empty_file())
        asyncio.run(test_no_headers())
        asyncio.run(test_nonexistent_file())
    
    def test_configuration_validation_and_utilities(self):
        """Test configuration validation and utility functions."""
        # Test configuration checking
        config_file = self.create_test_configuration("linear")
        
        async def test_config_check():
            config_status = await self.integration.check_configuration(self.test_dir)
            
            self.assertTrue(config_status["valid"])
            self.assertTrue(config_status["enabled"])
            self.assertEqual(config_status["ticketing_system"], "linear")
            self.assertFalse(config_status["dry_run"])
            self.assertTrue(config_status["advanced_detection"])
            self.assertTrue(config_status["apply_templates"])
            self.assertTrue(config_status["update_spec_files"])
            self.assertEqual(config_status["max_issues"], 50)
            self.assertIsNotNone(config_status["team_id"])
        
        # Test sample configuration creation
        async def test_sample_config():
            sample_path = Path(self.test_dir) / "sample_config.yml"
            success = await self.integration.create_sample_configuration(str(sample_path), "linear")
            
            self.assertTrue(success)
            self.assertTrue(sample_path.exists())
            
            # Should contain valid YAML
            import yaml
            with open(sample_path) as f:
                sample_config = yaml.safe_load(f)
            
            self.assertIn("automatic_issue_creation", sample_config)
            self.assertIn("ticketing_systems", sample_config)
            self.assertIn("templates", sample_config)
        
        asyncio.run(test_config_check())
        asyncio.run(test_sample_config())


if __name__ == '__main__':
    # Run with verbose output for detailed test results
    unittest.main(verbosity=2)