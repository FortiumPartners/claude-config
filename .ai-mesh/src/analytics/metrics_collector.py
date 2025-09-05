"""
Task 4.3: Metrics collection service for compliance data

This module implements comprehensive metrics collection for workflow enforcement,
providing real-time compliance tracking and productivity analytics.
"""
import logging
import json
import sqlite3
from datetime import datetime, date, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass
from enum import Enum

from .database import DatabaseManager, get_database

logger = logging.getLogger(__name__)


class EventType(Enum):
    """Enforcement event types."""
    REMINDER = "reminder"
    WARNING = "warning"
    BLOCKING = "blocking"
    OVERRIDE = "override"


class OperationType(Enum):
    """File operation types."""
    CREATE = "create"
    EDIT = "edit" 
    DELETE = "delete"


class UserAction(Enum):
    """User response to enforcement."""
    COMPLIED = "complied"
    OVERRODE = "overrode"
    IGNORED = "ignored"


@dataclass
class EnforcementEvent:
    """Represents an enforcement event for metrics collection."""
    user_id: str
    session_id: str
    event_type: EventType
    file_path: str
    operation_type: OperationType
    enforcement_level: int
    suggested_command: Optional[str] = None
    user_action: Optional[UserAction] = None
    metadata: Optional[Dict[str, Any]] = None
    timestamp: Optional[datetime] = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now()


@dataclass 
class ComplianceMetrics:
    """Daily compliance metrics for a user."""
    user_id: str
    date: date
    total_file_operations: int = 0
    compliant_operations: int = 0
    violations_reminder: int = 0
    violations_warning: int = 0
    violations_blocking: int = 0
    override_usage: int = 0
    productivity_score: Optional[float] = None
    
    @property
    def compliance_rate(self) -> float:
        """Calculate compliance rate as percentage."""
        if self.total_file_operations == 0:
            return 100.0
        return (self.compliant_operations / self.total_file_operations) * 100.0
        
    @property
    def violation_rate(self) -> float:
        """Calculate violation rate as percentage."""
        if self.total_file_operations == 0:
            return 0.0
        total_violations = (self.violations_reminder + 
                          self.violations_warning + 
                          self.violations_blocking)
        return (total_violations / self.total_file_operations) * 100.0


class MetricsCollector:
    """
    Service for collecting and aggregating workflow enforcement metrics.
    
    Provides real-time compliance tracking, productivity analytics,
    and historical trend analysis.
    """
    
    def __init__(self, db_manager: Optional[DatabaseManager] = None):
        """
        Initialize metrics collector.
        
        Args:
            db_manager: Optional database manager instance
        """
        self.db = db_manager or get_database()
        
    def record_enforcement_event(self, event: EnforcementEvent) -> bool:
        """
        Record an enforcement event for metrics tracking.
        
        Args:
            event: Enforcement event to record
            
        Returns:
            True if recorded successfully, False otherwise
        """
        try:
            metadata_json = json.dumps(event.metadata) if event.metadata else None
            
            with self.db.get_connection() as conn:
                conn.execute("""
                    INSERT INTO enforcement_events 
                    (user_id, session_id, event_type, file_path, operation_type, 
                     enforcement_level, suggested_command, user_action, timestamp, metadata)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    event.user_id,
                    event.session_id,
                    event.event_type.value,
                    event.file_path,
                    event.operation_type.value,
                    event.enforcement_level,
                    event.suggested_command,
                    event.user_action.value if event.user_action else None,
                    event.timestamp.isoformat(),
                    metadata_json
                ))
                conn.commit()
                
            # Update daily metrics asynchronously
            self._update_daily_metrics(event.user_id, event.timestamp.date())
            
            logger.debug(f"Recorded enforcement event for user {event.user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to record enforcement event: {e}")
            return False
            
    def record_override_request(self, user_id: str, session_id: str, 
                              enforcement_event_id: Optional[int],
                              justification: str, approved: bool,
                              file_path: str, operation_type: OperationType,
                              approver_id: Optional[str] = None,
                              duration_seconds: Optional[int] = None) -> bool:
        """
        Record an override request for audit tracking.
        
        Args:
            user_id: User requesting override
            session_id: Current session ID
            enforcement_event_id: Related enforcement event ID
            justification: Override justification
            approved: Whether override was approved
            file_path: File being modified
            operation_type: Type of file operation
            approver_id: ID of approving user/system
            duration_seconds: How long override was active
            
        Returns:
            True if recorded successfully, False otherwise
        """
        try:
            with self.db.get_connection() as conn:
                conn.execute("""
                    INSERT INTO override_requests
                    (user_id, session_id, enforcement_event_id, justification, 
                     approved, approver_id, file_path, operation_type, duration_seconds)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    user_id, session_id, enforcement_event_id, justification,
                    approved, approver_id, file_path, operation_type.value,
                    duration_seconds
                ))
                conn.commit()
                
            logger.debug(f"Recorded override request for user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to record override request: {e}")
            return False
            
    def start_user_session(self, user_id: str, session_id: str) -> bool:
        """
        Start tracking a new user session.
        
        Args:
            user_id: User identifier
            session_id: Unique session identifier
            
        Returns:
            True if session started successfully, False otherwise
        """
        try:
            with self.db.get_connection() as conn:
                conn.execute("""
                    INSERT INTO user_sessions (user_id, session_id, start_time, active)
                    VALUES (?, ?, ?, 1)
                """, (user_id, session_id, datetime.now().isoformat()))
                conn.commit()
                
            logger.info(f"Started session {session_id} for user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to start user session: {e}")
            return False
            
    def end_user_session(self, session_id: str) -> bool:
        """
        End a user session and update final metrics.
        
        Args:
            session_id: Session to end
            
        Returns:
            True if session ended successfully, False otherwise
        """
        try:
            with self.db.get_connection() as conn:
                # Get session info for final calculations
                cursor = conn.execute("""
                    SELECT user_id, start_time FROM user_sessions 
                    WHERE session_id = ? AND active = 1
                """, (session_id,))
                session = cursor.fetchone()
                
                if not session:
                    logger.warning(f"Session {session_id} not found or already ended")
                    return False
                    
                # Update session end time and status
                conn.execute("""
                    UPDATE user_sessions 
                    SET end_time = ?, active = 0
                    WHERE session_id = ?
                """, (datetime.now().isoformat(), session_id))
                
                # Update session metrics from enforcement events
                self._update_session_metrics(conn, session_id)
                
                conn.commit()
                
            logger.info(f"Ended session {session_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to end user session: {e}")
            return False
            
    def get_daily_metrics(self, user_id: str, target_date: date) -> Optional[ComplianceMetrics]:
        """
        Get compliance metrics for a specific user and date.
        
        Args:
            user_id: User identifier
            target_date: Date for metrics
            
        Returns:
            ComplianceMetrics object or None if not found
        """
        try:
            with self.db.get_connection() as conn:
                cursor = conn.execute("""
                    SELECT * FROM compliance_metrics
                    WHERE user_id = ? AND date = ?
                """, (user_id, target_date.isoformat()))
                
                row = cursor.fetchone()
                if not row:
                    return None
                    
                return ComplianceMetrics(
                    user_id=row['user_id'],
                    date=datetime.fromisoformat(row['date']).date(),
                    total_file_operations=row['total_file_operations'],
                    compliant_operations=row['compliant_operations'],
                    violations_reminder=row['violations_reminder'],
                    violations_warning=row['violations_warning'],
                    violations_blocking=row['violations_blocking'],
                    override_usage=row['override_usage'],
                    productivity_score=row['productivity_score']
                )
                
        except Exception as e:
            logger.error(f"Failed to get daily metrics: {e}")
            return None
            
    def get_user_metrics_range(self, user_id: str, start_date: date, 
                             end_date: date) -> List[ComplianceMetrics]:
        """
        Get compliance metrics for a user over a date range.
        
        Args:
            user_id: User identifier
            start_date: Start of date range
            end_date: End of date range
            
        Returns:
            List of ComplianceMetrics objects
        """
        metrics = []
        
        try:
            with self.db.get_connection() as conn:
                cursor = conn.execute("""
                    SELECT * FROM compliance_metrics
                    WHERE user_id = ? AND date BETWEEN ? AND ?
                    ORDER BY date
                """, (user_id, start_date.isoformat(), end_date.isoformat()))
                
                for row in cursor.fetchall():
                    metrics.append(ComplianceMetrics(
                        user_id=row['user_id'],
                        date=datetime.fromisoformat(row['date']).date(),
                        total_file_operations=row['total_file_operations'],
                        compliant_operations=row['compliant_operations'],
                        violations_reminder=row['violations_reminder'],
                        violations_warning=row['violations_warning'],
                        violations_blocking=row['violations_blocking'],
                        override_usage=row['override_usage'],
                        productivity_score=row['productivity_score']
                    ))
                    
        except Exception as e:
            logger.error(f"Failed to get user metrics range: {e}")
            
        return metrics
        
    def calculate_productivity_score(self, user_id: str, target_date: date) -> float:
        """
        Calculate productivity score based on compliance and efficiency metrics.
        
        Productivity score factors:
        - Compliance rate (40% weight)
        - Workflow efficiency (30% weight) 
        - Override usage (20% weight)
        - Response to enforcement (10% weight)
        
        Args:
            user_id: User identifier
            target_date: Date to calculate score for
            
        Returns:
            Productivity score from 0.0 to 100.0
        """
        try:
            metrics = self.get_daily_metrics(user_id, target_date)
            if not metrics:
                return 0.0
                
            # Base compliance score (40% weight)
            compliance_score = metrics.compliance_rate * 0.4
            
            # Workflow efficiency score (30% weight)
            # Higher efficiency = fewer violations per operation
            if metrics.total_file_operations > 0:
                efficiency_rate = 1.0 - (metrics.violation_rate / 100.0)
                efficiency_score = efficiency_rate * 100.0 * 0.3
            else:
                efficiency_score = 30.0  # Neutral score for no operations
                
            # Override usage score (20% weight)  
            # Lower override usage = better score
            if metrics.total_file_operations > 0:
                override_rate = metrics.override_usage / metrics.total_file_operations
                override_score = max(0.0, (1.0 - override_rate * 2)) * 100.0 * 0.2
            else:
                override_score = 20.0  # Neutral score for no operations
                
            # Response score (10% weight)
            # Based on how user responds to enforcement
            response_score = self._calculate_response_score(user_id, target_date) * 0.1
            
            total_score = compliance_score + efficiency_score + override_score + response_score
            return min(100.0, max(0.0, total_score))  # Clamp to 0-100 range
            
        except Exception as e:
            logger.error(f"Failed to calculate productivity score: {e}")
            return 0.0
            
    def get_violation_patterns(self, user_id: str, days: int = 30) -> Dict[str, Any]:
        """
        Analyze violation patterns for a user over specified days.
        
        Args:
            user_id: User identifier
            days: Number of days to analyze
            
        Returns:
            Dictionary with violation pattern analysis
        """
        end_date = date.today()
        start_date = end_date - timedelta(days=days)
        
        patterns = {
            'analysis_period': f"{start_date} to {end_date}",
            'most_common_violations': [],
            'violation_trends': {},
            'peak_violation_times': [],
            'file_types_most_violated': {},
            'commands_most_suggested': {}
        }
        
        try:
            with self.db.get_connection() as conn:
                # Most common violation types
                cursor = conn.execute("""
                    SELECT event_type, COUNT(*) as count
                    FROM enforcement_events
                    WHERE user_id = ? AND timestamp >= ?
                    AND event_type IN ('reminder', 'warning', 'blocking')
                    GROUP BY event_type
                    ORDER BY count DESC
                """, (user_id, start_date.isoformat()))
                
                patterns['most_common_violations'] = [
                    {'type': row['event_type'], 'count': row['count']}
                    for row in cursor.fetchall()
                ]
                
                # File types most violated
                cursor = conn.execute("""
                    SELECT 
                        CASE 
                            WHEN file_path LIKE '%.py' THEN 'Python'
                            WHEN file_path LIKE '%.js' OR file_path LIKE '%.ts' THEN 'JavaScript/TypeScript'
                            WHEN file_path LIKE '%.md' THEN 'Markdown'
                            WHEN file_path LIKE '%.json' THEN 'JSON'
                            ELSE 'Other'
                        END as file_type,
                        COUNT(*) as violation_count
                    FROM enforcement_events
                    WHERE user_id = ? AND timestamp >= ?
                    AND event_type IN ('reminder', 'warning', 'blocking')
                    GROUP BY file_type
                    ORDER BY violation_count DESC
                """, (user_id, start_date.isoformat()))
                
                patterns['file_types_most_violated'] = {
                    row['file_type']: row['violation_count']
                    for row in cursor.fetchall()
                }
                
                # Most suggested commands
                cursor = conn.execute("""
                    SELECT suggested_command, COUNT(*) as count
                    FROM enforcement_events
                    WHERE user_id = ? AND timestamp >= ?
                    AND suggested_command IS NOT NULL
                    GROUP BY suggested_command
                    ORDER BY count DESC
                    LIMIT 5
                """, (user_id, start_date.isoformat()))
                
                patterns['commands_most_suggested'] = {
                    row['suggested_command']: row['count']
                    for row in cursor.fetchall()
                }
                
        except Exception as e:
            logger.error(f"Failed to analyze violation patterns: {e}")
            patterns['error'] = str(e)
            
        return patterns
        
    def get_team_summary(self, user_ids: List[str], days: int = 30) -> Dict[str, Any]:
        """
        Get team-wide compliance summary.
        
        Args:
            user_ids: List of user IDs to include
            days: Number of days to analyze
            
        Returns:
            Dictionary with team summary metrics
        """
        end_date = date.today()
        start_date = end_date - timedelta(days=days)
        
        summary = {
            'analysis_period': f"{start_date} to {end_date}",
            'team_size': len(user_ids),
            'overall_compliance_rate': 0.0,
            'total_operations': 0,
            'total_violations': 0,
            'user_summaries': {},
            'top_performers': [],
            'improvement_opportunities': []
        }
        
        user_scores = []
        
        for user_id in user_ids:
            user_metrics = self.get_user_metrics_range(user_id, start_date, end_date)
            
            if user_metrics:
                # Aggregate user metrics
                total_ops = sum(m.total_file_operations for m in user_metrics)
                total_compliant = sum(m.compliant_operations for m in user_metrics)
                total_violations = sum(m.violations_reminder + m.violations_warning + m.violations_blocking 
                                     for m in user_metrics)
                
                compliance_rate = (total_compliant / total_ops * 100) if total_ops > 0 else 100.0
                avg_productivity = sum(m.productivity_score or 0 for m in user_metrics) / len(user_metrics)
                
                summary['user_summaries'][user_id] = {
                    'total_operations': total_ops,
                    'compliance_rate': compliance_rate,
                    'total_violations': total_violations,
                    'productivity_score': avg_productivity
                }
                
                user_scores.append((user_id, compliance_rate, avg_productivity))
                summary['total_operations'] += total_ops
                summary['total_violations'] += total_violations
                
        # Calculate overall metrics
        if summary['total_operations'] > 0:
            summary['overall_compliance_rate'] = (
                (summary['total_operations'] - summary['total_violations']) / 
                summary['total_operations'] * 100
            )
            
        # Identify top performers (top 3 by productivity score)
        user_scores.sort(key=lambda x: x[2], reverse=True)
        summary['top_performers'] = [
            {'user_id': user_id, 'compliance_rate': comp_rate, 'productivity_score': prod_score}
            for user_id, comp_rate, prod_score in user_scores[:3]
        ]
        
        # Identify improvement opportunities (bottom 20% by compliance)
        min_compliance = 80.0  # Below 80% compliance needs improvement
        summary['improvement_opportunities'] = [
            {'user_id': user_id, 'compliance_rate': comp_rate}
            for user_id, comp_rate, _ in user_scores
            if comp_rate < min_compliance
        ]
        
        return summary
        
    def _update_daily_metrics(self, user_id: str, target_date: date):
        """Update daily compliance metrics for a user."""
        try:
            with self.db.get_connection() as conn:
                # Calculate daily statistics from events
                cursor = conn.execute("""
                    SELECT 
                        COUNT(*) as total_events,
                        SUM(CASE WHEN user_action = 'complied' THEN 1 ELSE 0 END) as compliant_count,
                        SUM(CASE WHEN event_type = 'reminder' THEN 1 ELSE 0 END) as reminder_count,
                        SUM(CASE WHEN event_type = 'warning' THEN 1 ELSE 0 END) as warning_count,
                        SUM(CASE WHEN event_type = 'blocking' THEN 1 ELSE 0 END) as blocking_count,
                        SUM(CASE WHEN event_type = 'override' THEN 1 ELSE 0 END) as override_count
                    FROM enforcement_events
                    WHERE user_id = ? AND DATE(timestamp) = ?
                """, (user_id, target_date.isoformat()))
                
                stats = cursor.fetchone()
                
                # Calculate productivity score
                productivity_score = self.calculate_productivity_score(user_id, target_date)
                
                # Insert or update daily metrics
                conn.execute("""
                    INSERT OR REPLACE INTO compliance_metrics
                    (user_id, date, total_file_operations, compliant_operations,
                     violations_reminder, violations_warning, violations_blocking,
                     override_usage, productivity_score)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    user_id, target_date.isoformat(),
                    stats['total_events'] or 0,
                    stats['compliant_count'] or 0,
                    stats['reminder_count'] or 0,
                    stats['warning_count'] or 0,
                    stats['blocking_count'] or 0,
                    stats['override_count'] or 0,
                    productivity_score
                ))
                conn.commit()
                
        except Exception as e:
            logger.error(f"Failed to update daily metrics: {e}")
            
    def _update_session_metrics(self, conn: sqlite3.Connection, session_id: str):
        """Update session statistics from enforcement events."""
        try:
            cursor = conn.execute("""
                SELECT 
                    COUNT(*) as total_ops,
                    SUM(CASE WHEN user_action = 'complied' THEN 1 ELSE 0 END) as compliant_ops
                FROM enforcement_events
                WHERE session_id = ?
            """, (session_id,))
            
            stats = cursor.fetchone()
            
            conn.execute("""
                UPDATE user_sessions
                SET total_operations = ?, compliant_operations = ?
                WHERE session_id = ?
            """, (stats['total_ops'] or 0, stats['compliant_ops'] or 0, session_id))
            
        except Exception as e:
            logger.error(f"Failed to update session metrics: {e}")
            
    def _calculate_response_score(self, user_id: str, target_date: date) -> float:
        """Calculate response score based on how user responds to enforcement."""
        try:
            with self.db.get_connection() as conn:
                cursor = conn.execute("""
                    SELECT 
                        COUNT(*) as total_events,
                        SUM(CASE WHEN user_action = 'complied' THEN 1 ELSE 0 END) as complied_count,
                        SUM(CASE WHEN user_action = 'ignored' THEN 1 ELSE 0 END) as ignored_count
                    FROM enforcement_events
                    WHERE user_id = ? AND DATE(timestamp) = ?
                    AND user_action IS NOT NULL
                """, (user_id, target_date.isoformat()))
                
                stats = cursor.fetchone()
                total = stats['total_events'] or 0
                
                if total == 0:
                    return 50.0  # Neutral score for no events
                    
                complied = stats['complied_count'] or 0
                ignored = stats['ignored_count'] or 0
                
                # Higher score for compliance, penalty for ignoring
                response_rate = (complied / total) - (ignored / total * 0.5)
                return max(0.0, min(100.0, response_rate * 100.0))
                
        except Exception as e:
            logger.error(f"Failed to calculate response score: {e}")
            return 0.0


# Convenience function for getting default metrics collector
_default_collector = None

def get_metrics_collector() -> MetricsCollector:
    """Get default metrics collector instance."""
    global _default_collector
    if _default_collector is None:
        _default_collector = MetricsCollector()
    return _default_collector