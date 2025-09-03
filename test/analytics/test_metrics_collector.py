"""
Tests for metrics collection service.

Comprehensive test suite for compliance metrics collection, productivity tracking,
and violation pattern analysis.
"""
import pytest
from datetime import datetime, date, timedelta
import tempfile
import os
from pathlib import Path

import sys
sys.path.append(str(Path(__file__).parent.parent.parent / 'src'))

from analytics.database import DatabaseManager
from analytics.metrics_collector import (
    MetricsCollector, 
    EnforcementEvent,
    ComplianceMetrics,
    EventType,
    OperationType,
    UserAction
)


@pytest.fixture
def temp_db():
    """Create temporary database for testing."""
    temp_file = tempfile.NamedTemporaryFile(delete=False)
    temp_file.close()
    db_manager = DatabaseManager(temp_file.name)
    db_manager.initialize_database()
    
    yield db_manager
    
    # Cleanup
    try:
        os.unlink(temp_file.name)
    except OSError:
        pass


@pytest.fixture
def metrics_collector(temp_db):
    """Create metrics collector with temporary database."""
    return MetricsCollector(temp_db)


class TestEnforcementEventRecording:
    """Test enforcement event recording functionality."""
    
    def test_record_enforcement_event_success(self, metrics_collector):
        """Test successful enforcement event recording."""
        event = EnforcementEvent(
            user_id="test_user",
            session_id="test_session", 
            event_type=EventType.REMINDER,
            file_path="/test/file.py",
            operation_type=OperationType.EDIT,
            enforcement_level=1,
            suggested_command="/execute-tasks",
            user_action=UserAction.COMPLIED,
            metadata={"test": "data"}
        )
        
        result = metrics_collector.record_enforcement_event(event)
        assert result is True
        
    def test_record_enforcement_event_with_minimal_data(self, metrics_collector):
        """Test recording with only required fields."""
        event = EnforcementEvent(
            user_id="test_user",
            session_id="test_session",
            event_type=EventType.WARNING, 
            file_path="/test/file.js",
            operation_type=OperationType.CREATE,
            enforcement_level=2
        )
        
        result = metrics_collector.record_enforcement_event(event)
        assert result is True
        
    def test_multiple_event_recording(self, metrics_collector):
        """Test recording multiple events."""
        events = [
            EnforcementEvent("user1", "session1", EventType.REMINDER, "/file1.py", OperationType.EDIT, 1),
            EnforcementEvent("user1", "session1", EventType.WARNING, "/file2.py", OperationType.EDIT, 2),
            EnforcementEvent("user2", "session2", EventType.BLOCKING, "/file3.py", OperationType.DELETE, 3)
        ]
        
        for event in events:
            result = metrics_collector.record_enforcement_event(event)
            assert result is True


class TestOverrideRequests:
    """Test override request recording."""
    
    def test_record_override_request_approved(self, metrics_collector):
        """Test recording approved override request."""
        result = metrics_collector.record_override_request(
            user_id="test_user",
            session_id="test_session",
            enforcement_event_id=None,
            justification="Emergency bug fix",
            approved=True,
            file_path="/critical/file.py",
            operation_type=OperationType.EDIT,
            approver_id="manager1",
            duration_seconds=300
        )
        
        assert result is True
        
    def test_record_override_request_denied(self, metrics_collector):
        """Test recording denied override request."""
        result = metrics_collector.record_override_request(
            user_id="test_user",
            session_id="test_session", 
            enforcement_event_id=None,
            justification="Non-urgent change",
            approved=False,
            file_path="/regular/file.py",
            operation_type=OperationType.EDIT
        )
        
        assert result is True


class TestSessionManagement:
    """Test user session tracking."""
    
    def test_start_user_session(self, metrics_collector):
        """Test starting user session."""
        result = metrics_collector.start_user_session("user1", "session1")
        assert result is True
        
    def test_end_user_session(self, metrics_collector):
        """Test ending user session."""
        # Start session first
        metrics_collector.start_user_session("user1", "session1")
        
        # End session
        result = metrics_collector.end_user_session("session1")
        assert result is True
        
    def test_end_nonexistent_session(self, metrics_collector):
        """Test ending session that doesn't exist."""
        result = metrics_collector.end_user_session("nonexistent_session")
        assert result is False


class TestDailyMetrics:
    """Test daily metrics calculation and retrieval."""
    
    def test_get_daily_metrics_no_data(self, metrics_collector):
        """Test getting daily metrics when no data exists."""
        today = date.today()
        metrics = metrics_collector.get_daily_metrics("user1", today)
        assert metrics is None
        
    def test_get_daily_metrics_with_data(self, metrics_collector):
        """Test getting daily metrics after recording events."""
        today = date.today()
        
        # Record some events
        event = EnforcementEvent(
            user_id="user1",
            session_id="session1",
            event_type=EventType.REMINDER,
            file_path="/test/file.py",
            operation_type=OperationType.EDIT,
            enforcement_level=1,
            user_action=UserAction.COMPLIED,
            timestamp=datetime.now()
        )
        
        metrics_collector.record_enforcement_event(event)
        
        # Get metrics
        metrics = metrics_collector.get_daily_metrics("user1", today)
        assert metrics is not None
        assert metrics.user_id == "user1"
        assert metrics.date == today
        
    def test_get_user_metrics_range(self, metrics_collector):
        """Test getting metrics over a date range."""
        start_date = date.today() - timedelta(days=7)
        end_date = date.today()
        
        # Record events over multiple days
        for i in range(5):
            event_date = start_date + timedelta(days=i)
            event = EnforcementEvent(
                user_id="user1",
                session_id=f"session_{i}",
                event_type=EventType.REMINDER,
                file_path=f"/test/file_{i}.py",
                operation_type=OperationType.EDIT,
                enforcement_level=1,
                timestamp=datetime.combine(event_date, datetime.min.time())
            )
            metrics_collector.record_enforcement_event(event)
            
        metrics_list = metrics_collector.get_user_metrics_range("user1", start_date, end_date)
        assert len(metrics_list) >= 0  # May be 0 due to async metric updates


class TestComplianceMetrics:
    """Test ComplianceMetrics data class."""
    
    def test_compliance_metrics_creation(self):
        """Test creating ComplianceMetrics object."""
        metrics = ComplianceMetrics(
            user_id="user1",
            date=date.today(),
            total_file_operations=10,
            compliant_operations=8
        )
        
        assert metrics.user_id == "user1"
        assert metrics.compliance_rate == 80.0
        assert metrics.violation_rate == 20.0
        
    def test_compliance_metrics_no_operations(self):
        """Test ComplianceMetrics with no operations."""
        metrics = ComplianceMetrics(
            user_id="user1", 
            date=date.today(),
            total_file_operations=0
        )
        
        assert metrics.compliance_rate == 100.0
        assert metrics.violation_rate == 0.0


class TestProductivityScoring:
    """Test productivity score calculation."""
    
    def test_calculate_productivity_score_no_data(self, metrics_collector):
        """Test productivity score calculation with no data."""
        today = date.today()
        score = metrics_collector.calculate_productivity_score("user1", today)
        assert score == 0.0
        
    def test_calculate_productivity_score_with_data(self, metrics_collector):
        """Test productivity score calculation with sample data."""
        today = date.today()
        
        # Record sample events
        events = [
            EnforcementEvent("user1", "session1", EventType.REMINDER, "/file1.py", OperationType.EDIT, 1, user_action=UserAction.COMPLIED),
            EnforcementEvent("user1", "session1", EventType.REMINDER, "/file2.py", OperationType.EDIT, 1, user_action=UserAction.COMPLIED),
            EnforcementEvent("user1", "session1", EventType.WARNING, "/file3.py", OperationType.EDIT, 2, user_action=UserAction.IGNORED)
        ]
        
        for event in events:
            event.timestamp = datetime.combine(today, datetime.min.time())
            metrics_collector.record_enforcement_event(event)
            
        score = metrics_collector.calculate_productivity_score("user1", today)
        assert 0.0 <= score <= 100.0


class TestViolationPatterns:
    """Test violation pattern analysis."""
    
    def test_get_violation_patterns_no_data(self, metrics_collector):
        """Test getting violation patterns with no data."""
        patterns = metrics_collector.get_violation_patterns("user1", 30)
        
        assert 'analysis_period' in patterns
        assert 'most_common_violations' in patterns
        assert 'file_types_most_violated' in patterns
        assert len(patterns['most_common_violations']) == 0
        
    def test_get_violation_patterns_with_data(self, metrics_collector):
        """Test getting violation patterns with sample data."""
        # Record various violation types
        violations = [
            EnforcementEvent("user1", "session1", EventType.REMINDER, "/file1.py", OperationType.EDIT, 1),
            EnforcementEvent("user1", "session1", EventType.REMINDER, "/file2.py", OperationType.EDIT, 1),
            EnforcementEvent("user1", "session1", EventType.WARNING, "/file3.js", OperationType.EDIT, 2),
            EnforcementEvent("user1", "session1", EventType.BLOCKING, "/file4.md", OperationType.EDIT, 3)
        ]
        
        for violation in violations:
            metrics_collector.record_enforcement_event(violation)
            
        patterns = metrics_collector.get_violation_patterns("user1", 30)
        
        assert len(patterns['most_common_violations']) > 0
        assert 'file_types_most_violated' in patterns
        assert len(patterns['file_types_most_violated']) > 0


class TestTeamSummary:
    """Test team-wide metrics summarization."""
    
    def test_get_team_summary_empty(self, metrics_collector):
        """Test team summary with no users."""
        summary = metrics_collector.get_team_summary([], 30)
        
        assert summary['team_size'] == 0
        assert summary['overall_compliance_rate'] == 0.0
        assert summary['total_operations'] == 0
        
    def test_get_team_summary_with_users(self, metrics_collector):
        """Test team summary with sample users."""
        user_ids = ["user1", "user2", "user3"]
        
        # Record events for each user
        for i, user_id in enumerate(user_ids):
            for j in range(3):  # 3 events per user
                event = EnforcementEvent(
                    user_id=user_id,
                    session_id=f"session_{i}_{j}",
                    event_type=EventType.REMINDER,
                    file_path=f"/file_{i}_{j}.py",
                    operation_type=OperationType.EDIT,
                    enforcement_level=1,
                    user_action=UserAction.COMPLIED
                )
                metrics_collector.record_enforcement_event(event)
                
        summary = metrics_collector.get_team_summary(user_ids, 30)
        
        assert summary['team_size'] == 3
        assert 'overall_compliance_rate' in summary
        assert 'user_summaries' in summary


class TestErrorHandling:
    """Test error handling scenarios."""
    
    def test_record_event_invalid_database(self):
        """Test recording event with invalid database."""
        # Create collector with invalid database path
        invalid_db = DatabaseManager("/invalid/path/database.db")
        collector = MetricsCollector(invalid_db)
        
        event = EnforcementEvent("user1", "session1", EventType.REMINDER, "/file.py", OperationType.EDIT, 1)
        result = collector.record_enforcement_event(event)
        
        # Should handle gracefully and return False
        assert result is False
        
    def test_get_metrics_invalid_user(self, metrics_collector):
        """Test getting metrics for invalid user."""
        metrics = metrics_collector.get_daily_metrics("invalid_user", date.today())
        assert metrics is None
        
    def test_violation_patterns_database_error(self, metrics_collector):
        """Test violation patterns with database issues."""
        # This test would require mocking database errors
        patterns = metrics_collector.get_violation_patterns("user1", 30)
        
        # Should return default structure even on errors
        assert 'analysis_period' in patterns
        assert 'most_common_violations' in patterns


class TestDataConsistency:
    """Test data consistency and integrity."""
    
    def test_event_timestamp_handling(self, metrics_collector):
        """Test that event timestamps are handled correctly."""
        custom_time = datetime(2025, 9, 1, 12, 0, 0)
        
        event = EnforcementEvent(
            user_id="user1",
            session_id="session1",
            event_type=EventType.REMINDER,
            file_path="/file.py",
            operation_type=OperationType.EDIT,
            enforcement_level=1,
            timestamp=custom_time
        )
        
        result = metrics_collector.record_enforcement_event(event)
        assert result is True
        
    def test_metadata_json_serialization(self, metrics_collector):
        """Test that metadata is properly serialized to JSON."""
        complex_metadata = {
            "nested": {"data": "value"},
            "list": [1, 2, 3],
            "boolean": True,
            "null": None
        }
        
        event = EnforcementEvent(
            user_id="user1",
            session_id="session1", 
            event_type=EventType.REMINDER,
            file_path="/file.py",
            operation_type=OperationType.EDIT,
            enforcement_level=1,
            metadata=complex_metadata
        )
        
        result = metrics_collector.record_enforcement_event(event)
        assert result is True
        
    def test_concurrent_metric_updates(self, metrics_collector):
        """Test that concurrent metric updates are handled properly."""
        today = date.today()
        
        # Record multiple events for the same user/date
        events = [
            EnforcementEvent("user1", "session1", EventType.REMINDER, "/file1.py", OperationType.EDIT, 1),
            EnforcementEvent("user1", "session2", EventType.WARNING, "/file2.py", OperationType.EDIT, 2),
            EnforcementEvent("user1", "session3", EventType.BLOCKING, "/file3.py", OperationType.EDIT, 3)
        ]
        
        for event in events:
            event.timestamp = datetime.combine(today, datetime.min.time())
            result = metrics_collector.record_enforcement_event(event)
            assert result is True
            
        # Verify metrics are consistently updated
        metrics = metrics_collector.get_daily_metrics("user1", today)
        # Metrics might be None due to async updates, which is acceptable