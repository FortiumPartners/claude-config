#!/usr/bin/env python3
"""
Test runner for automatic issue creation system.

Runs comprehensive unit, integration, and end-to-end tests with reporting.
"""

import unittest
import sys
import time
import os
from pathlib import Path
from io import StringIO


def run_test_suite():
    """Run the complete test suite with comprehensive reporting."""
    print("=" * 60)
    print("AUTOMATIC ISSUE CREATION - TEST SUITE")
    print("=" * 60)
    print()
    
    # Add current directory to Python path for imports
    current_dir = Path(__file__).parent
    sys.path.insert(0, str(current_dir))
    
    # Test modules to run
    test_modules = [
        'test_spec_parser',
        'test_issue_creator', 
        'test_integration',
        'test_e2e_workflow'
    ]
    
    # Track results
    total_tests = 0
    total_failures = 0
    total_errors = 0
    suite_start_time = time.time()
    results = {}
    
    for module_name in test_modules:
        print(f"Running {module_name}...")
        print("-" * 40)
        
        # Capture test output
        test_output = StringIO()
        
        # Create test suite for this module
        try:
            module = __import__(module_name)
            loader = unittest.TestLoader()
            suite = loader.loadTestsFromModule(module)
            
            # Run tests with custom result handler
            runner = unittest.TextTestRunner(
                stream=test_output,
                verbosity=2,
                failfast=False
            )
            
            module_start_time = time.time()
            result = runner.run(suite)
            module_end_time = time.time()
            
            # Store results
            results[module_name] = {
                'tests_run': result.testsRun,
                'failures': len(result.failures),
                'errors': len(result.errors),
                'duration': module_end_time - module_start_time,
                'output': test_output.getvalue()
            }
            
            # Update totals
            total_tests += result.testsRun
            total_failures += len(result.failures)
            total_errors += len(result.errors)
            
            # Print summary for this module
            status = "PASS" if (len(result.failures) + len(result.errors)) == 0 else "FAIL"
            print(f"  Tests run: {result.testsRun}")
            print(f"  Failures: {len(result.failures)}")
            print(f"  Errors: {len(result.errors)}")
            print(f"  Duration: {module_end_time - module_start_time:.2f}s")
            print(f"  Status: {status}")
            
            # Show failures and errors if any
            if result.failures:
                print(f"\n  FAILURES ({len(result.failures)}):")
                for test, traceback in result.failures:
                    print(f"    - {test}")
            
            if result.errors:
                print(f"\n  ERRORS ({len(result.errors)}):")
                for test, traceback in result.errors:
                    print(f"    - {test}")
            
        except Exception as e:
            print(f"  ERROR: Failed to run {module_name}: {e}")
            results[module_name] = {
                'tests_run': 0,
                'failures': 0,
                'errors': 1,
                'duration': 0,
                'output': f"Module import/run error: {e}"
            }
            total_errors += 1
        
        print()
    
    suite_end_time = time.time()
    suite_duration = suite_end_time - suite_start_time
    
    # Print final summary
    print("=" * 60)
    print("TEST SUITE SUMMARY")
    print("=" * 60)
    print(f"Total Tests Run: {total_tests}")
    print(f"Total Failures: {total_failures}")
    print(f"Total Errors: {total_errors}")
    print(f"Total Duration: {suite_duration:.2f}s")
    print()
    
    # Print detailed breakdown
    print("DETAILED RESULTS:")
    print("-" * 40)
    for module_name, result in results.items():
        status = "PASS" if (result['failures'] + result['errors']) == 0 else "FAIL"
        print(f"{module_name:20} | {result['tests_run']:3} tests | {status:4} | {result['duration']:6.2f}s")
    
    print()
    
    # Print overall status
    overall_status = "PASS" if (total_failures + total_errors) == 0 else "FAIL"
    print(f"OVERALL STATUS: {overall_status}")
    
    if overall_status == "PASS":
        print("🎉 All tests passed! The automatic issue creation system is ready.")
    else:
        print("❌ Some tests failed. Please review the failures above.")
        
        # Show detailed failure information
        print("\nDETAILED FAILURE INFORMATION:")
        print("=" * 60)
        for module_name, result in results.items():
            if result['failures'] > 0 or result['errors'] > 0:
                print(f"\n{module_name.upper()}:")
                print("-" * 30)
                print(result['output'])
    
    print()
    return overall_status == "PASS"


def run_specific_test(test_pattern):
    """Run specific test(s) matching the pattern."""
    print(f"Running tests matching pattern: {test_pattern}")
    print("=" * 60)
    
    # Add current directory to Python path
    current_dir = Path(__file__).parent
    sys.path.insert(0, str(current_dir))
    
    # Discover and run matching tests
    loader = unittest.TestLoader()
    start_dir = str(current_dir)
    suite = loader.discover(start_dir, pattern=f"*{test_pattern}*.py")
    
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    return result.wasSuccessful()


def validate_implementation():
    """Validate that all required components are implemented."""
    print("IMPLEMENTATION VALIDATION")
    print("=" * 60)
    
    current_dir = Path(__file__).parent
    required_files = [
        'issue_spec.py',
        'spec_parser.py', 
        'detection_algorithms.py',
        'criteria_extractor.py',
        'ticketing_interface.py',
        'linear_integration.py',
        'github_integration.py',
        'error_handling.py',
        'automatic_issue_creator.py',
        'hierarchy_manager.py',
        'bidirectional_linking.py',
        'create_spec_integration.py'
    ]
    
    missing_files = []
    present_files = []
    
    for filename in required_files:
        filepath = current_dir / filename
        if filepath.exists():
            present_files.append(filename)
            print(f"✓ {filename}")
        else:
            missing_files.append(filename)
            print(f"✗ {filename} - MISSING")
    
    print()
    print(f"Implementation Status: {len(present_files)}/{len(required_files)} files present")
    
    if missing_files:
        print("❌ Implementation incomplete - missing required files")
        return False
    else:
        print("✅ All required implementation files are present")
        return True


def run_smoke_tests():
    """Run basic smoke tests to verify core functionality."""
    print("SMOKE TESTS")
    print("=" * 60)
    
    current_dir = Path(__file__).parent
    sys.path.insert(0, str(current_dir))
    
    smoke_tests_passed = 0
    total_smoke_tests = 0
    
    # Test 1: Import all modules
    modules = [
        'issue_spec', 'spec_parser', 'automatic_issue_creator',
        'create_spec_integration', 'ticketing_interface'
    ]
    
    for module_name in modules:
        total_smoke_tests += 1
        try:
            __import__(module_name)
            print(f"✓ Import {module_name}")
            smoke_tests_passed += 1
        except Exception as e:
            print(f"✗ Import {module_name} - ERROR: {e}")
    
    # Test 2: Basic object creation
    try:
        total_smoke_tests += 1
        from issue_spec import IssueSpec, IssueType, Priority
        issue = IssueSpec(
            id="test-1",
            title="Test Issue",
            description="Test description",
            issue_type=IssueType.TASK,
            priority=Priority.MEDIUM
        )
        assert issue.title == "Test Issue"
        print("✓ IssueSpec creation")
        smoke_tests_passed += 1
    except Exception as e:
        print(f"✗ IssueSpec creation - ERROR: {e}")
    
    # Test 3: Configuration validation
    try:
        total_smoke_tests += 1
        from create_spec_integration import CreateSpecIntegration
        integration = CreateSpecIntegration()
        assert integration is not None
        print("✓ CreateSpecIntegration creation")
        smoke_tests_passed += 1
    except Exception as e:
        print(f"✗ CreateSpecIntegration creation - ERROR: {e}")
    
    print()
    print(f"Smoke Tests: {smoke_tests_passed}/{total_smoke_tests} passed")
    
    if smoke_tests_passed == total_smoke_tests:
        print("✅ All smoke tests passed - basic functionality verified")
        return True
    else:
        print("❌ Some smoke tests failed - basic functionality issues detected")
        return False


if __name__ == "__main__":
    if len(sys.argv) > 1:
        if sys.argv[1] == "validate":
            success = validate_implementation()
            sys.exit(0 if success else 1)
        elif sys.argv[1] == "smoke":
            success = run_smoke_tests()
            sys.exit(0 if success else 1)
        elif sys.argv[1] == "specific":
            if len(sys.argv) > 2:
                success = run_specific_test(sys.argv[2])
                sys.exit(0 if success else 1)
            else:
                print("Usage: python run_tests.py specific <test_pattern>")
                sys.exit(1)
        else:
            print("Usage: python run_tests.py [validate|smoke|specific <pattern>]")
            sys.exit(1)
    else:
        # Run validation first
        print("Step 1: Validating implementation...")
        if not validate_implementation():
            print("\n❌ Implementation validation failed!")
            sys.exit(1)
        
        print("\n" + "=" * 60)
        
        # Run smoke tests
        print("Step 2: Running smoke tests...")
        if not run_smoke_tests():
            print("\n❌ Smoke tests failed!")
            sys.exit(1)
        
        print("\n" + "=" * 60)
        
        # Run full test suite
        print("Step 3: Running comprehensive test suite...")
        success = run_test_suite()
        
        sys.exit(0 if success else 1)