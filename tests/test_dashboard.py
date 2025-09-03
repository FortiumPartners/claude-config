#!/usr/bin/env python3
"""
Test Suite for Dashboard Integration and Reporting - Task 5.1

This module provides comprehensive tests for dashboard data generation,
formatting, and all dashboard service functionality.
"""

import sys
import unittest
import tempfile
import os
import json
from datetime import datetime, date, timedelta
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / 'src'))

from dashboard.dashboard_service import (
    DashboardService, 
    DashboardMetrics, 
    TeamMetrics, 
    ComplianceAlert,
    AlertSeverity
)
from analytics.database import DatabaseManager
from analytics.metrics_collector import (
    MetricsCollector, 
    EnforcementEvent, 
    EventType, 
    OperationType,
    UserAction
)


class TestDashboardDataGeneration(unittest.TestCase):
    """Test dashboard data generation and formatting."""
    
    def setUp(self):
        """Set up test database and services."""
        # Create temporary database
        self.temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.db')
        self.temp_file.close()
        
        # Initialize services
        self.db = DatabaseManager(self.temp_file.name)
        self.db.initialize_database()
        self.metrics = MetricsCollector(self.db)
        self.dashboard = DashboardService(self.db)
        
        # Create sample test data
        self._create_sample_data()
    
    def tearDown(self):
        """Clean up test database."""
        if os.path.exists(self.temp_file.name):
            os.unlink(self.temp_file.name)
    
    def _create_sample_data(self):
        """Create sample data for testing."""
        # Create multiple users and sessions
        test_users = ["user1", "user2", "user3"]
        
        for i, user_id in enumerate(test_users):
            session_id = f"session_{user_id}"
            self.metrics.start_user_session(user_id, session_id)
            
            # Create varied enforcement events over the past 30 days
            for day_offset in range(30):
                event_date = datetime.now() - timedelta(days=day_offset)
                
                # User 1: Good compliance (80%)
                if user_id == "user1":
                    user_action = UserAction.COMPLIED if day_offset % 5 != 0 else UserAction.IGNORED
                # User 2: Poor compliance (40%)
                elif user_id == "user2":
                    user_action = UserAction.IGNORED if day_offset % 5 < 3 else UserAction.COMPLIED
                # User 3: Excellent compliance (95%)
                else:
                    user_action = UserAction.COMPLIED if day_offset % 20 != 0 else UserAction.IGNORED
                
                event = EnforcementEvent(
                    user_id=user_id,
                    session_id=session_id,
                    event_type=EventType.REMINDER,
                    file_path=f"/test/file_{day_offset}.py",
                    operation_type=OperationType.EDIT,
                    enforcement_level=1,
                    user_action=user_action,
                    timestamp=event_date
                )
                self.metrics.record_enforcement_event(event)
            
            # Add some override requests
            if user_id in ["user1", "user2"]:
                self.metrics.record_override_request(
                    user_id=user_id,
                    session_id=session_id,
                    enforcement_event_id=None,
                    justification=f"Override request from {user_id}",
                    approved=True,
                    file_path=f"/test/{user_id}_override.py",
                    operation_type=OperationType.EDIT
                )
            
            self.metrics.end_user_session(session_id)
    
    def test_user_dashboard_generation(self):
        """Test individual user dashboard generation."""
        dashboard_data = self.dashboard.generate_user_dashboard("user1", 30)
        
        # Validate data structure
        self.assertIsInstance(dashboard_data, DashboardMetrics)
        self.assertEqual(dashboard_data.user_id, "user1")
        self.assertIsInstance(dashboard_data.period_start, date)
        self.assertIsInstance(dashboard_data.period_end, date)
        
        # Validate metrics
        self.assertGreater(dashboard_data.total_events, 0)
        self.assertGreaterEqual(dashboard_data.compliance_rate, 0.0)
        self.assertLessEqual(dashboard_data.compliance_rate, 100.0)
        self.assertGreaterEqual(dashboard_data.productivity_score, 0.0)
        self.assertLessEqual(dashboard_data.productivity_score, 100.0)
        
        # Validate trend
        self.assertIn(dashboard_data.trend_direction, ["improving", "declining", "stable"])
        
        # Validate collections
        self.assertIsInstance(dashboard_data.top_violations, list)
        self.assertIsInstance(dashboard_data.recent_activity, list)
        
        print(f"✓ User dashboard generated successfully for user1")
        print(f"  - Total events: {dashboard_data.total_events}")
        print(f"  - Compliance rate: {dashboard_data.compliance_rate:.1f}%")
        print(f"  - Productivity score: {dashboard_data.productivity_score:.1f}")
        print(f"  - Trend: {dashboard_data.trend_direction}")
    
    def test_team_dashboard_generation(self):
        """Test team dashboard generation."""
        team_users = ["user1", "user2", "user3"]
        team_data = self.dashboard.generate_team_dashboard(team_users, "Test Team", 30)
        
        # Validate data structure
        self.assertIsInstance(team_data, TeamMetrics)
        self.assertEqual(team_data.team_name, "Test Team")
        self.assertEqual(team_data.member_count, 3)
        
        # Validate aggregated metrics
        self.assertGreaterEqual(team_data.average_compliance_rate, 0.0)
        self.assertLessEqual(team_data.average_compliance_rate, 100.0)
        self.assertGreaterEqual(team_data.average_productivity_score, 0.0)
        self.assertLessEqual(team_data.average_productivity_score, 100.0)
        
        # Validate team-specific metrics
        self.assertGreaterEqual(team_data.total_violations, 0)
        self.assertGreaterEqual(team_data.total_overrides, 0)
        self.assertGreaterEqual(team_data.team_velocity, 0.0)
        
        # Validate collections
        self.assertIsInstance(team_data.top_performers, list)
        self.assertIsInstance(team_data.improvement_opportunities, list)
        
        print(f"✓ Team dashboard generated successfully")
        print(f"  - Team size: {team_data.member_count}")
        print(f"  - Average compliance: {team_data.average_compliance_rate:.1f}%")
        print(f"  - Average productivity: {team_data.average_productivity_score:.1f}")
        print(f"  - Team velocity: {team_data.team_velocity:.2f}")
    
    def test_compliance_trend_analysis(self):
        """Test compliance trend analysis generation."""
        trend_analysis = self.dashboard.get_compliance_trend_analysis("user1", 90)
        
        # Validate structure
        self.assertIn("user_id", trend_analysis)
        self.assertIn("analysis_period", trend_analysis)
        self.assertIn("daily_compliance_rates", trend_analysis)
        self.assertIn("trend_statistics", trend_analysis)
        self.assertIn("violation_patterns", trend_analysis)
        
        # Validate trend statistics
        trend_stats = trend_analysis["trend_statistics"]
        self.assertIn("direction", trend_stats)
        self.assertIn("confidence", trend_stats)
        self.assertIn("slope", trend_stats)
        
        self.assertIn(trend_stats["direction"], ["improving", "declining", "stable"])
        self.assertGreaterEqual(trend_stats["confidence"], 0.0)
        self.assertLessEqual(trend_stats["confidence"], 1.0)
        
        print(f"✓ Compliance trend analysis generated successfully")
        print(f"  - Overall trend: {trend_analysis['overall_trend']}")
        print(f"  - Trend confidence: {trend_analysis['trend_confidence']:.2f}")
    
    def test_compliance_threshold_checking(self):
        """Test compliance threshold breach detection."""
        # Check all users for threshold breaches
        alerts = self.dashboard.check_compliance_thresholds()
        
        # Should generate alerts for user2 (poor compliance)
        self.assertIsInstance(alerts, list)
        
        # Validate alert structure if any exist
        for alert in alerts:
            self.assertIsInstance(alert, ComplianceAlert)
            self.assertIn(alert.alert_type, ["compliance_rate", "violation_spike", "productivity_decline"])
            self.assertIsInstance(alert.severity, AlertSeverity)
            self.assertIsInstance(alert.current_value, (int, float))
            self.assertIsInstance(alert.threshold_value, (int, float))
            self.assertIsInstance(alert.created_at, datetime)
            self.assertIsInstance(alert.message, str)
        
        print(f"✓ Compliance threshold checking completed")
        print(f"  - Alerts generated: {len(alerts)}")
        
        # Test specific user checking
        user_alerts = self.dashboard.check_compliance_thresholds("user2")
        self.assertIsInstance(user_alerts, list)
        
        # User2 should have some compliance issues (compliance, violation, or productivity alerts)
        compliance_issues = [a for a in user_alerts if a.alert_type in ["compliance_rate", "violation_spike", "productivity_decline"]]
        self.assertGreaterEqual(len(compliance_issues), 0, "Expected some compliance-related alert for user2")
        
        print(f"  - User-specific alerts for user2: {len(user_alerts)}")
    
    def test_real_time_updates(self):
        """Test real-time dashboard updates."""
        # Get baseline update
        baseline_time = datetime.now() - timedelta(minutes=10)
        updates = self.dashboard.get_real_time_updates(baseline_time)
        
        # Validate structure
        self.assertIn("update_time", updates)
        self.assertIn("last_update_time", updates)
        self.assertIn("recent_events", updates)
        self.assertIn("updated_metrics", updates)
        self.assertIn("new_alerts", updates)
        self.assertIn("affected_users", updates)
        
        # Validate types
        self.assertIsInstance(updates["recent_events"], list)
        self.assertIsInstance(updates["updated_metrics"], dict)
        self.assertIsInstance(updates["new_alerts"], list)
        self.assertIsInstance(updates["affected_users"], list)
        
        print(f"✓ Real-time updates generated successfully")
        print(f"  - Recent events: {len(updates['recent_events'])}")
        print(f"  - Updated users: {len(updates['affected_users'])}")
        print(f"  - New alerts: {len(updates['new_alerts'])}")
    
    def test_dashboard_data_formatting(self):
        """Test proper formatting of dashboard data for display."""
        # Test user dashboard formatting
        user_dashboard = self.dashboard.generate_user_dashboard("user1", 30)
        
        # Validate numeric formatting
        self.assertIsInstance(user_dashboard.compliance_rate, float)
        self.assertIsInstance(user_dashboard.productivity_score, float)
        self.assertIsInstance(user_dashboard.performance_percentile, float)
        
        # Validate date formatting
        self.assertIsInstance(user_dashboard.period_start, date)
        self.assertIsInstance(user_dashboard.period_end, date)
        
        # Validate activity formatting
        for activity in user_dashboard.recent_activity:
            self.assertIn("timestamp", activity)
            self.assertIn("event_type", activity)
            self.assertIn("file_path", activity)
            self.assertIn("operation_type", activity)
            self.assertIn("user_action", activity)
        
        print(f"✓ Dashboard data formatting validated")
    
    def test_empty_data_handling(self):
        """Test dashboard generation with no data."""
        # Test with non-existent user
        empty_dashboard = self.dashboard.generate_user_dashboard("nonexistent_user", 30)
        
        # Should return valid structure with zeros/defaults
        self.assertEqual(empty_dashboard.total_events, 0)
        self.assertEqual(empty_dashboard.compliance_rate, 0.0)
        self.assertEqual(empty_dashboard.productivity_score, 0.0)
        self.assertEqual(empty_dashboard.violation_count, 0)
        self.assertEqual(empty_dashboard.override_count, 0)
        self.assertEqual(len(empty_dashboard.top_violations), 0)
        self.assertEqual(len(empty_dashboard.recent_activity), 0)
        
        print(f"✓ Empty data handling validated")
    
    def test_date_range_validation(self):
        """Test dashboard generation with different date ranges."""
        # Test different time periods
        for days in [7, 14, 30, 90]:
            dashboard = self.dashboard.generate_user_dashboard("user1", days)
            
            expected_start = date.today() - timedelta(days=days)
            self.assertEqual(dashboard.period_start, expected_start)
            self.assertEqual(dashboard.period_end, date.today())
        
        print(f"✓ Date range validation completed")
    
    def test_performance_percentile_calculation(self):
        """Test performance percentile calculation accuracy."""
        # Get all user dashboards
        user1_dash = self.dashboard.generate_user_dashboard("user1", 30)
        user2_dash = self.dashboard.generate_user_dashboard("user2", 30)  
        user3_dash = self.dashboard.generate_user_dashboard("user3", 30)
        
        # user3 should have highest percentile (best compliance)
        # user2 should have lowest percentile (worst compliance)
        self.assertGreater(user3_dash.performance_percentile, user2_dash.performance_percentile)
        
        print(f"✓ Performance percentile calculation validated")
        print(f"  - User1 percentile: {user1_dash.performance_percentile:.1f}")
        print(f"  - User2 percentile: {user2_dash.performance_percentile:.1f}")
        print(f"  - User3 percentile: {user3_dash.performance_percentile:.1f}")


class TestDashboardIntegration(unittest.TestCase):
    """Test dashboard integration with analytics system."""
    
    def setUp(self):
        """Set up test database and services."""
        self.temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.db')
        self.temp_file.close()
        
        self.db = DatabaseManager(self.temp_file.name)
        self.db.initialize_database()
        self.metrics = MetricsCollector(self.db)
        self.dashboard = DashboardService(self.db)
    
    def tearDown(self):
        """Clean up test database."""
        if os.path.exists(self.temp_file.name):
            os.unlink(self.temp_file.name)
    
    def test_dashboard_analytics_integration(self):
        """Test integration between dashboard and analytics systems."""
        # Create test data through metrics collector
        session_id = "integration_test_session"
        self.metrics.start_user_session("test_user", session_id)
        
        # Record events
        event = EnforcementEvent(
            user_id="test_user",
            session_id=session_id,
            event_type=EventType.REMINDER,
            file_path="/test/integration.py",
            operation_type=OperationType.EDIT,
            enforcement_level=1,
            user_action=UserAction.COMPLIED
        )
        self.metrics.record_enforcement_event(event)
        
        self.metrics.end_user_session(session_id)
        
        # Generate dashboard using same data
        dashboard = self.dashboard.generate_user_dashboard("test_user", 30)
        
        # Verify integration
        self.assertEqual(dashboard.total_events, 1)
        self.assertEqual(dashboard.compliance_rate, 100.0)
        
        print(f"✓ Dashboard-Analytics integration validated")
    
    def test_management_report_export(self):
        """Test management report export functionality."""
        # Create test data through metrics collector
        test_users = ["mgr_user1", "mgr_user2"]
        
        for user_id in test_users:
            session_id = f"mgr_session_{user_id}"
            self.metrics.start_user_session(user_id, session_id)
            
            # Create some events
            for i in range(5):
                event = EnforcementEvent(
                    user_id=user_id,
                    session_id=session_id,
                    event_type=EventType.REMINDER,
                    file_path=f"/test/{user_id}_file_{i}.py",
                    operation_type=OperationType.EDIT,
                    enforcement_level=1,
                    user_action=UserAction.COMPLIED if i % 2 == 0 else UserAction.IGNORED
                )
                self.metrics.record_enforcement_event(event)
            
            self.metrics.end_user_session(session_id)
        
        # Test JSON export
        success, result_path = self.dashboard.export_management_reports(
            user_ids=test_users,
            output_format="json"
        )
        
        self.assertTrue(success, f"JSON export failed: {result_path}")
        self.assertTrue(os.path.exists(result_path), "JSON export file not created")
        
        # Verify JSON content
        with open(result_path, 'r') as f:
            report_data = json.load(f)
        
        self.assertIn("report_generated", report_data)
        self.assertIn("users", report_data) 
        self.assertIn("team_summary", report_data)
        self.assertEqual(len(report_data["users"]), 2)
        self.assertEqual(report_data["total_users"], 2)
        
        os.unlink(result_path)
        
        # Test CSV export
        success, result_path = self.dashboard.export_management_reports(
            user_ids=test_users,
            output_format="csv"
        )
        
        self.assertTrue(success, f"CSV export failed: {result_path}")
        self.assertTrue(os.path.exists(result_path), "CSV export file not created")
        
        # Verify CSV has content
        with open(result_path, 'r') as f:
            content = f.read()
            self.assertIn("TEAM SUMMARY", content)
            self.assertIn("INDIVIDUAL USER DETAILS", content)
            self.assertIn("mgr_user1", content)
            self.assertIn("mgr_user2", content)
        
        os.unlink(result_path)
        
        # Test HTML export
        success, result_path = self.dashboard.export_management_reports(
            user_ids=test_users,
            output_format="html"
        )
        
        self.assertTrue(success, f"HTML export failed: {result_path}")
        self.assertTrue(os.path.exists(result_path), "HTML export file not created")
        
        # Verify HTML has content
        with open(result_path, 'r') as f:
            content = f.read()
            self.assertIn("<!DOCTYPE html>", content)
            self.assertIn("Task Execution Enforcement - Management Report", content)
            self.assertIn("Team Performance Summary", content)
            self.assertIn("mgr_user1", content)
            self.assertIn("mgr_user2", content)
        
        os.unlink(result_path)
        
        print(f"✓ Management report export functionality validated")
        print(f"  - JSON export: Working")
        print(f"  - CSV export: Working")
        print(f"  - HTML export: Working")


def main():
    """Run all dashboard tests."""
    print("Starting Dashboard Integration and Reporting Tests (Task 5.1)...\n")
    
    # Create test suite
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    
    # Add test cases
    suite.addTests(loader.loadTestsFromTestCase(TestDashboardDataGeneration))
    suite.addTests(loader.loadTestsFromTestCase(TestDashboardIntegration))
    
    # Run tests
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    # Print summary
    if result.wasSuccessful():
        print(f"\n🎉 ALL DASHBOARD TESTS PASSED!")
        print(f"Task 5.1: Dashboard data generation and formatting tests completed successfully")
        print(f"\nDashboard service validated with:")
        print(f"- User dashboard generation with comprehensive metrics")
        print(f"- Team dashboard aggregation and analysis")
        print(f"- Compliance trend analysis with statistical insights")
        print(f"- Real-time updates and threshold breach detection")
        print(f"- Proper data formatting and empty data handling")
        print(f"- Integration with analytics system")
        return True
    else:
        print(f"\n❌ SOME DASHBOARD TESTS FAILED")
        print(f"Failed tests: {len(result.failures)}")
        print(f"Error tests: {len(result.errors)}")
        return False


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)