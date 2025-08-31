#!/usr/bin/env python3
"""
Simple validation script for template system without external dependencies.
"""

def test_core_functionality():
    """Test core functionality that doesn't require YAML."""
    print("🧪 Testing Template System Core Functionality")
    print("=" * 50)
    
    success_count = 0
    total_tests = 0
    
    # Test 1: Issue Spec Creation
    total_tests += 1
    try:
        from issue_spec import IssueSpec, IssueType, Priority, AcceptanceCriteria
        
        issue = IssueSpec(
            id="test-1",
            title="Test Feature",
            description="Test feature description",
            issue_type=IssueType.FEATURE,
            priority=Priority.HIGH,
            acceptance_criteria=AcceptanceCriteria(criteria=[
                "Feature works correctly"
            ])
        )
        
        assert issue.title == "Test Feature"
        assert issue.issue_type == IssueType.FEATURE
        assert len(issue.acceptance_criteria.criteria) == 1
        print("✅ Issue Spec creation and data model")
        success_count += 1
    except Exception as e:
        print(f"❌ Issue Spec creation failed: {e}")
    
    # Test 2: Default Templates (without YAML config)
    total_tests += 1
    try:
        from default_templates import DefaultTemplateLibrary, IssueTemplateType
        
        templates = DefaultTemplateLibrary.get_standard_templates()
        
        assert len(templates) > 0
        assert IssueTemplateType.FEATURE.value in templates
        assert IssueTemplateType.EPIC.value in templates
        
        # Test system-specific templates
        linear_templates = DefaultTemplateLibrary.get_linear_templates()
        github_templates = DefaultTemplateLibrary.get_github_templates()
        
        assert len(linear_templates) > 0
        assert len(github_templates) > 0
        
        print("✅ Default template library")
        success_count += 1
    except Exception as e:
        print(f"❌ Default template library failed: {e}")
    
    # Test 3: Acceptance Criteria Templating
    total_tests += 1
    try:
        from acceptance_criteria_templating import AcceptanceCriteriaTemplatingEngine
        
        engine = AcceptanceCriteriaTemplatingEngine()
        
        # Test criteria enhancement
        criteria = AcceptanceCriteria(criteria=[
            AcceptanceCriterion(description="user can login", completed=False)
        ])
        
        enhanced = engine.enhance_acceptance_criteria(criteria, IssueType.FEATURE)
        
        assert len(enhanced.criteria) >= len(criteria.criteria)
        print("✅ Acceptance criteria templating")
        success_count += 1
    except Exception as e:
        print(f"❌ Acceptance criteria templating failed: {e}")
    
    # Test 4: Template Engine (minimal config)
    total_tests += 1
    try:
        # Create minimal config without YAML
        from default_templates import DefaultTemplateLibrary
        from template_engine import TemplateEngine
        
        # Create a minimal team config mock
        class MinimalTeamConfig:
            def __init__(self):
                self.templates = DefaultTemplateLibrary.get_standard_templates()
                self.automatic_issue_creation = type('obj', (object,), {
                    'default_ticketing_system': 'linear'
                })()
        
        config = MinimalTeamConfig()
        engine = TemplateEngine(config)
        
        # Test template application
        issue = IssueSpec(
            id="test-template",
            title="Template Test",
            description="Testing template application",
            issue_type=IssueType.TASK,
            priority=Priority.MEDIUM
        )
        
        templated = engine.apply_template(issue)
        
        # Should have task prefix
        assert "[TASK]" in templated.title
        assert "task" in templated.labels
        
        print("✅ Template engine with minimal config")
        success_count += 1
    except Exception as e:
        print(f"❌ Template engine failed: {e}")
    
    # Test 5: Integration Test
    total_tests += 1
    try:
        # Test complete workflow without external dependencies
        from default_templates import DefaultTemplateLibrary
        from acceptance_criteria_templating import AcceptanceCriteriaTemplatingEngine
        
        # Create issue
        issue = IssueSpec(
            id="integration-test",
            title="Integration Test Feature",
            description="Testing complete integration",
            issue_type=IssueType.FEATURE,
            priority=Priority.HIGH,
            acceptance_criteria=AcceptanceCriteria(criteria=[
                AcceptanceCriterion(description="feature works", completed=False),
                AcceptanceCriterion(description="system is fast", completed=False)
            ])
        )
        
        # Enhance criteria
        criteria_engine = AcceptanceCriteriaTemplatingEngine()
        enhanced_criteria = criteria_engine.enhance_acceptance_criteria(
            issue.acceptance_criteria, issue.issue_type
        )
        issue.acceptance_criteria = enhanced_criteria
        
        # Apply template using minimal config
        class MinimalTeamConfig:
            def __init__(self):
                self.templates = DefaultTemplateLibrary.get_standard_templates()
        
        config = MinimalTeamConfig()
        engine = TemplateEngine(config)
        templated_issue = engine.apply_template(issue)
        
        # Validate results
        assert "[FEATURE]" in templated_issue.title
        assert "feature" in templated_issue.labels
        assert len(templated_issue.acceptance_criteria.criteria) > 2  # Should have added criteria
        
        print("✅ Complete integration workflow")
        success_count += 1
    except Exception as e:
        print(f"❌ Integration test failed: {e}")
    
    # Summary
    print()
    print("=" * 50)
    print(f"Template System Validation Results: {success_count}/{total_tests} passed")
    
    if success_count == total_tests:
        print("🎉 All core functionality tests passed!")
        print("✨ Template system is ready for use")
        return True
    else:
        print(f"⚠️ {total_tests - success_count} tests failed")
        print("🔧 Some functionality may be limited")
        return False


if __name__ == "__main__":
    success = test_core_functionality()
    exit(0 if success else 1)