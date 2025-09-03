#!/usr/bin/env python3
"""
Dashboard Service - Task 5: Dashboard Integration and Reporting

This module provides comprehensive dashboard functionality for the Task Execution 
Enforcement Engine, including team productivity metrics, individual developer 
performance tracking, compliance trend analysis, and real-time data updates.
"""

import sqlite3
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, date, timedelta
from dataclasses import dataclass
from enum import Enum
import json
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class AlertSeverity(Enum):
    """Alert severity levels for compliance threshold breaches."""
    INFO = "info"
    WARNING = "warning" 
    CRITICAL = "critical"
    EMERGENCY = "emergency"


@dataclass
class DashboardMetrics:
    """Data structure for dashboard metrics display."""
    user_id: str
    period_start: date
    period_end: date
    total_events: int
    compliance_rate: float
    productivity_score: float
    trend_direction: str
    violation_count: int
    override_count: int
    top_violations: List[str]
    recent_activity: List[Dict[str, Any]]
    performance_percentile: float


@dataclass
class TeamMetrics:
    """Data structure for team-level dashboard metrics."""
    team_name: str
    period_start: date
    period_end: date
    member_count: int
    average_compliance_rate: float
    average_productivity_score: float
    total_violations: int
    total_overrides: int
    trend_direction: str
    top_performers: List[str]
    improvement_opportunities: List[str]
    team_velocity: float


@dataclass
class ComplianceAlert:
    """Data structure for compliance threshold alerts."""
    alert_id: str
    user_id: str
    alert_type: str
    severity: AlertSeverity
    threshold_breached: str
    current_value: float
    threshold_value: float
    created_at: datetime
    message: str
    acknowledged: bool = False
    resolved: bool = False


class DashboardService:
    """
    Core dashboard service providing comprehensive analytics and reporting
    functionality for the Task Execution Enforcement Engine.
    """

    def __init__(self, db_manager):
        """Initialize dashboard service with database manager."""
        self.db = db_manager
        self._cache_timeout = 300  # 5 minutes cache
        self._cached_data = {}
        
    def generate_user_dashboard(self, user_id: str, days: int = 30) -> DashboardMetrics:
        """
        Generate comprehensive dashboard metrics for a specific user.
        
        Args:
            user_id: Target user identifier
            days: Number of days to analyze (default: 30)
            
        Returns:
            DashboardMetrics object with complete user analytics
        """
        try:
            period_end = date.today()
            period_start = period_end - timedelta(days=days)
            
            with self.db.get_connection() as conn:
                # Get basic event statistics
                total_events = self._get_user_event_count(conn, user_id, period_start, period_end)
                compliance_rate = self._calculate_user_compliance_rate(conn, user_id, period_start, period_end)
                productivity_score = self._calculate_user_productivity_score(conn, user_id, period_start, period_end)
                
                # Get trend analysis
                trend_direction = self._get_productivity_trend(conn, user_id, days)
                
                # Get violation and override counts
                violation_count = self._get_user_violation_count(conn, user_id, period_start, period_end)
                override_count = self._get_user_override_count(conn, user_id, period_start, period_end)
                
                # Get top violation types
                top_violations = self._get_top_user_violations(conn, user_id, period_start, period_end)
                
                # Get recent activity
                recent_activity = self._get_user_recent_activity(conn, user_id, 10)
                
                # Calculate performance percentile vs peers
                performance_percentile = self._calculate_user_percentile(conn, user_id, period_start, period_end)
                
                return DashboardMetrics(
                    user_id=user_id,
                    period_start=period_start,
                    period_end=period_end,
                    total_events=total_events,
                    compliance_rate=compliance_rate,
                    productivity_score=productivity_score,
                    trend_direction=trend_direction,
                    violation_count=violation_count,
                    override_count=override_count,
                    top_violations=top_violations,
                    recent_activity=recent_activity,
                    performance_percentile=performance_percentile
                )
            
        except Exception as e:
            logger.error(f"Error generating user dashboard for {user_id}: {e}")
            raise
    
    def generate_team_dashboard(self, user_ids: List[str], team_name: str = "Team", days: int = 30) -> TeamMetrics:
        """
        Generate comprehensive team-level dashboard metrics.
        
        Args:
            user_ids: List of team member user IDs
            team_name: Name of the team for reporting
            days: Number of days to analyze (default: 30)
            
        Returns:
            TeamMetrics object with complete team analytics
        """
        try:
            period_end = date.today()
            period_start = period_end - timedelta(days=days)
            
            with self.db.get_connection() as conn:
                # Calculate team aggregates
                member_count = len(user_ids)
                total_violations = sum(self._get_user_violation_count(conn, uid, period_start, period_end) for uid in user_ids)
                total_overrides = sum(self._get_user_override_count(conn, uid, period_start, period_end) for uid in user_ids)
                
                # Calculate averages
                compliance_rates = [self._calculate_user_compliance_rate(conn, uid, period_start, period_end) for uid in user_ids]
                productivity_scores = [self._calculate_user_productivity_score(conn, uid, period_start, period_end) for uid in user_ids]
                
                average_compliance_rate = sum(compliance_rates) / len(compliance_rates) if compliance_rates else 0.0
                average_productivity_score = sum(productivity_scores) / len(productivity_scores) if productivity_scores else 0.0
                
                # Determine team trend
                trend_direction = self._get_team_trend(conn, user_ids, days)
                
                # Identify top performers (top 20% by productivity score)
                user_scores = [(uid, score) for uid, score in zip(user_ids, productivity_scores)]
                user_scores.sort(key=lambda x: x[1], reverse=True)
                top_count = max(1, len(user_scores) // 5)  # Top 20%
                top_performers = [uid for uid, _ in user_scores[:top_count]]
                
                # Calculate team velocity (tasks completed per day)
                team_velocity = self._calculate_team_velocity(conn, user_ids, period_start, period_end)
                
                # Identify improvement opportunities
                improvement_opportunities = self._identify_team_improvements(conn, user_ids, period_start, period_end)
                
                return TeamMetrics(
                    team_name=team_name,
                    period_start=period_start,
                    period_end=period_end,
                    member_count=member_count,
                    average_compliance_rate=average_compliance_rate,
                    average_productivity_score=average_productivity_score,
                    total_violations=total_violations,
                    total_overrides=total_overrides,
                    trend_direction=trend_direction,
                    top_performers=top_performers,
                    improvement_opportunities=improvement_opportunities,
                    team_velocity=team_velocity
                )
            
        except Exception as e:
            logger.error(f"Error generating team dashboard for {team_name}: {e}")
            raise
    
    def get_compliance_trend_analysis(self, user_id: str, days: int = 90) -> Dict[str, Any]:
        """
        Generate detailed compliance trend analysis over time.
        
        Args:
            user_id: Target user identifier
            days: Number of days to analyze (default: 90)
            
        Returns:
            Dictionary containing trend analysis data
        """
        try:
            period_end = date.today()
            period_start = period_end - timedelta(days=days)
            
            with self.db.get_connection() as conn:
                # Get daily compliance rates
                daily_rates = self._get_daily_compliance_rates(conn, user_id, period_start, period_end)
                
                # Calculate trend statistics
                trend_stats = self._calculate_trend_statistics(daily_rates)
                
                # Get violation pattern changes
                violation_patterns = self._analyze_violation_pattern_changes(conn, user_id, period_start, period_end)
                
                # Get improvement milestones
                milestones = self._identify_improvement_milestones(daily_rates)
                
                return {
                    "user_id": user_id,
                    "analysis_period": {"start": period_start.isoformat(), "end": period_end.isoformat()},
                    "daily_compliance_rates": daily_rates,
                    "trend_statistics": trend_stats,
                    "violation_patterns": violation_patterns,
                    "improvement_milestones": milestones,
                    "overall_trend": trend_stats.get("direction", "stable"),
                    "trend_confidence": trend_stats.get("confidence", 0.5)
                }
            
        except Exception as e:
            logger.error(f"Error generating compliance trend analysis for {user_id}: {e}")
            raise
    
    def check_compliance_thresholds(self, user_id: Optional[str] = None) -> List[ComplianceAlert]:
        """
        Check for compliance threshold breaches and generate alerts.
        
        Args:
            user_id: Specific user to check, or None for all users
            
        Returns:
            List of ComplianceAlert objects for threshold breaches
        """
        try:
            alerts = []
            
            with self.db.get_connection() as conn:
                # Get threshold configuration
                thresholds = self._get_compliance_thresholds(conn)
                
                # Determine users to check
                users_to_check = [user_id] if user_id else self._get_all_active_users(conn)
                
                for uid in users_to_check:
                    # Check compliance rate threshold
                    compliance_rate = self._calculate_user_compliance_rate(conn, uid, date.today() - timedelta(days=7), date.today())
                    if compliance_rate < thresholds.get("min_compliance_rate", 0.8):
                        alert = ComplianceAlert(
                            alert_id=f"compliance_{uid}_{datetime.now().timestamp()}",
                            user_id=uid,
                            alert_type="compliance_rate",
                            severity=AlertSeverity.WARNING if compliance_rate > 0.6 else AlertSeverity.CRITICAL,
                            threshold_breached="minimum_compliance_rate",
                            current_value=compliance_rate,
                            threshold_value=thresholds["min_compliance_rate"],
                            created_at=datetime.now(),
                            message=f"User {uid} compliance rate ({compliance_rate:.1%}) below threshold ({thresholds['min_compliance_rate']:.1%})"
                        )
                        alerts.append(alert)
                    
                    # Check violation spike threshold
                    recent_violations = self._get_user_violation_count(conn, uid, date.today() - timedelta(days=1), date.today())
                    if recent_violations > thresholds.get("max_daily_violations", 10):
                        alert = ComplianceAlert(
                            alert_id=f"violations_{uid}_{datetime.now().timestamp()}",
                            user_id=uid,
                            alert_type="violation_spike",
                            severity=AlertSeverity.WARNING,
                            threshold_breached="max_daily_violations", 
                            current_value=recent_violations,
                            threshold_value=thresholds["max_daily_violations"],
                            created_at=datetime.now(),
                            message=f"User {uid} has {recent_violations} violations in last 24 hours (threshold: {thresholds['max_daily_violations']})"
                        )
                        alerts.append(alert)
                    
                    # Check productivity decline threshold
                    productivity_score = self._calculate_user_productivity_score(conn, uid, date.today() - timedelta(days=7), date.today())
                    if productivity_score < thresholds.get("min_productivity_score", 60.0):
                        alert = ComplianceAlert(
                            alert_id=f"productivity_{uid}_{datetime.now().timestamp()}",
                            user_id=uid,
                            alert_type="productivity_decline",
                            severity=AlertSeverity.INFO if productivity_score > 40.0 else AlertSeverity.WARNING,
                            threshold_breached="min_productivity_score",
                            current_value=productivity_score,
                            threshold_value=thresholds["min_productivity_score"],
                            created_at=datetime.now(),
                            message=f"User {uid} productivity score ({productivity_score:.1f}) below threshold ({thresholds['min_productivity_score']:.1f})"
                        )
                        alerts.append(alert)
                
                # Store alerts in database for tracking
                self._store_alerts(conn, alerts)
                
                return alerts
            
        except Exception as e:
            logger.error(f"Error checking compliance thresholds: {e}")
            raise
    
    def get_real_time_updates(self, last_update_time: Optional[datetime] = None) -> Dict[str, Any]:
        """
        Get real-time dashboard data updates since last check.
        
        Args:
            last_update_time: Last time updates were fetched
            
        Returns:
            Dictionary containing updated metrics and events
        """
        try:
            if last_update_time is None:
                last_update_time = datetime.now() - timedelta(minutes=5)
            
            with self.db.get_connection() as conn:
                # Get recent events
                recent_events = self._get_events_since(conn, last_update_time)
                
                # Get updated metrics for affected users
                affected_users = list(set(event['user_id'] for event in recent_events))
                updated_metrics = {}
                
                for user_id in affected_users:
                    updated_metrics[user_id] = {
                        "compliance_rate": self._calculate_user_compliance_rate(conn, user_id, date.today() - timedelta(days=7), date.today()),
                        "productivity_score": self._calculate_user_productivity_score(conn, user_id, date.today() - timedelta(days=7), date.today()),
                        "recent_violations": self._get_user_violation_count(conn, user_id, date.today(), date.today())
                    }
                
                # Check for new alerts
                new_alerts = [alert for alert in self.check_compliance_thresholds() if alert.created_at > last_update_time]
                
                return {
                    "update_time": datetime.now().isoformat(),
                    "last_update_time": last_update_time.isoformat(),
                    "recent_events": recent_events,
                    "updated_metrics": updated_metrics,
                    "new_alerts": [self._alert_to_dict(alert) for alert in new_alerts],
                    "affected_users": affected_users
                }
            
        except Exception as e:
            logger.error(f"Error getting real-time updates: {e}")
            raise
    
    # Private helper methods
    
    def _get_user_event_count(self, conn: sqlite3.Connection, user_id: str, start_date: date, end_date: date) -> int:
        """Get total event count for user in date range."""
        cursor = conn.execute(
            "SELECT COUNT(*) FROM enforcement_events WHERE user_id = ? AND DATE(timestamp) BETWEEN ? AND ?",
            (user_id, start_date.isoformat(), end_date.isoformat())
        )
        return cursor.fetchone()[0]
    
    def _calculate_user_compliance_rate(self, conn: sqlite3.Connection, user_id: str, start_date: date, end_date: date) -> float:
        """Calculate compliance rate (percentage of complied events) for user."""
        cursor = conn.execute("""
            SELECT 
                COUNT(CASE WHEN user_action = 'complied' THEN 1 END) * 100.0 / COUNT(*) as compliance_rate
            FROM enforcement_events 
            WHERE user_id = ? AND DATE(timestamp) BETWEEN ? AND ?
        """, (user_id, start_date.isoformat(), end_date.isoformat()))
        
        result = cursor.fetchone()[0]
        return result if result is not None else 0.0
    
    def _calculate_user_productivity_score(self, conn: sqlite3.Connection, user_id: str, start_date: date, end_date: date) -> float:
        """Calculate productivity score based on compliance and override patterns."""
        # Base score on compliance rate
        compliance_rate = self._calculate_user_compliance_rate(conn, user_id, start_date, end_date)
        base_score = compliance_rate * 0.8  # Compliance worth 80% of score
        
        # Adjust for override usage (reasonable overrides can be positive)
        override_count = self._get_user_override_count(conn, user_id, start_date, end_date)
        total_events = self._get_user_event_count(conn, user_id, start_date, end_date)
        
        if total_events > 0:
            override_rate = override_count / total_events
            # Small number of overrides (< 10%) can be positive (shows good judgment)
            if override_rate < 0.1:
                override_adjustment = override_rate * 20  # Up to 2 points bonus
            else:
                override_adjustment = -(override_rate - 0.1) * 40  # Penalty for excessive overrides
        else:
            override_adjustment = 0
        
        return max(0.0, min(100.0, base_score + override_adjustment))
    
    def _get_productivity_trend(self, conn: sqlite3.Connection, user_id: str, days: int) -> str:
        """Determine productivity trend direction (improving, declining, stable)."""
        period_end = date.today()
        period_mid = period_end - timedelta(days=days//2)
        period_start = period_end - timedelta(days=days)
        
        recent_score = self._calculate_user_productivity_score(conn, user_id, period_mid, period_end)
        older_score = self._calculate_user_productivity_score(conn, user_id, period_start, period_mid)
        
        if recent_score > older_score + 5:
            return "improving"
        elif recent_score < older_score - 5:
            return "declining" 
        else:
            return "stable"
    
    def _get_user_violation_count(self, conn: sqlite3.Connection, user_id: str, start_date: date, end_date: date) -> int:
        """Get count of violations (ignored warnings/reminders) for user."""
        cursor = conn.execute("""
            SELECT COUNT(*) 
            FROM enforcement_events 
            WHERE user_id = ? AND user_action = 'ignored' AND DATE(timestamp) BETWEEN ? AND ?
        """, (user_id, start_date.isoformat(), end_date.isoformat()))
        return cursor.fetchone()[0]
    
    def _get_user_override_count(self, conn: sqlite3.Connection, user_id: str, start_date: date, end_date: date) -> int:
        """Get count of override requests for user."""
        cursor = conn.execute("""
            SELECT COUNT(*) 
            FROM override_requests 
            WHERE user_id = ? AND DATE(timestamp) BETWEEN ? AND ?
        """, (user_id, start_date.isoformat(), end_date.isoformat()))
        return cursor.fetchone()[0]
    
    def _get_top_user_violations(self, conn: sqlite3.Connection, user_id: str, start_date: date, end_date: date, limit: int = 5) -> List[str]:
        """Get most common violation types for user."""
        cursor = conn.execute("""
            SELECT operation_type, COUNT(*) as count
            FROM enforcement_events 
            WHERE user_id = ? AND user_action = 'ignored' AND DATE(timestamp) BETWEEN ? AND ?
            GROUP BY operation_type
            ORDER BY count DESC
            LIMIT ?
        """, (user_id, start_date.isoformat(), end_date.isoformat(), limit))
        
        return [row[0] for row in cursor.fetchall()]
    
    def _get_user_recent_activity(self, conn: sqlite3.Connection, user_id: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Get recent activity events for user."""
        cursor = conn.execute("""
            SELECT timestamp, event_type, file_path, operation_type, user_action
            FROM enforcement_events 
            WHERE user_id = ?
            ORDER BY timestamp DESC
            LIMIT ?
        """, (user_id, limit))
        
        return [
            {
                "timestamp": row[0],
                "event_type": row[1], 
                "file_path": row[2],
                "operation_type": row[3],
                "user_action": row[4]
            }
            for row in cursor.fetchall()
        ]
    
    def _calculate_user_percentile(self, conn: sqlite3.Connection, user_id: str, start_date: date, end_date: date) -> float:
        """Calculate user's performance percentile compared to all users."""
        user_score = self._calculate_user_productivity_score(conn, user_id, start_date, end_date)
        
        # Get all user scores
        cursor = conn.execute("""
            SELECT DISTINCT user_id FROM enforcement_events 
            WHERE DATE(timestamp) BETWEEN ? AND ?
        """, (start_date.isoformat(), end_date.isoformat()))
        
        all_users = [row[0] for row in cursor.fetchall()]
        all_scores = [self._calculate_user_productivity_score(conn, uid, start_date, end_date) for uid in all_users]
        
        if len(all_scores) <= 1:
            return 50.0  # Default percentile if only one user
        
        scores_below = sum(1 for score in all_scores if score < user_score)
        return (scores_below / len(all_scores)) * 100.0
    
    def _get_team_trend(self, conn: sqlite3.Connection, user_ids: List[str], days: int) -> str:
        """Determine overall team trend direction."""
        improving = 0
        declining = 0
        
        for user_id in user_ids:
            trend = self._get_productivity_trend(conn, user_id, days)
            if trend == "improving":
                improving += 1
            elif trend == "declining":
                declining += 1
        
        if improving > declining:
            return "improving"
        elif declining > improving:
            return "declining"
        else:
            return "stable"
    
    def _calculate_team_velocity(self, conn: sqlite3.Connection, user_ids: List[str], start_date: date, end_date: date) -> float:
        """Calculate team velocity as compliance events per day."""
        total_complied = 0
        
        for user_id in user_ids:
            cursor = conn.execute("""
                SELECT COUNT(*) 
                FROM enforcement_events 
                WHERE user_id = ? AND user_action = 'complied' AND DATE(timestamp) BETWEEN ? AND ?
            """, (user_id, start_date.isoformat(), end_date.isoformat()))
            total_complied += cursor.fetchone()[0]
        
        days_diff = (end_date - start_date).days + 1
        return total_complied / days_diff if days_diff > 0 else 0.0
    
    def _identify_team_improvements(self, conn: sqlite3.Connection, user_ids: List[str], start_date: date, end_date: date) -> List[str]:
        """Identify team improvement opportunities based on violation patterns."""
        improvements = []
        
        # Analyze common violation patterns across team
        all_violations = {}
        for user_id in user_ids:
            violations = self._get_top_user_violations(conn, user_id, start_date, end_date)
            for violation in violations:
                all_violations[violation] = all_violations.get(violation, 0) + 1
        
        # Sort by frequency
        sorted_violations = sorted(all_violations.items(), key=lambda x: x[1], reverse=True)
        
        for violation_type, count in sorted_violations[:3]:  # Top 3
            if count >= len(user_ids) * 0.3:  # If 30%+ of team has this violation
                improvements.append(f"Team training needed for {violation_type} best practices")
        
        return improvements
    
    def _get_daily_compliance_rates(self, conn: sqlite3.Connection, user_id: str, start_date: date, end_date: date) -> List[Dict[str, Any]]:
        """Get daily compliance rates for trend analysis."""
        cursor = conn.execute("""
            SELECT 
                DATE(timestamp) as day,
                COUNT(CASE WHEN user_action = 'complied' THEN 1 END) * 100.0 / COUNT(*) as compliance_rate,
                COUNT(*) as total_events
            FROM enforcement_events 
            WHERE user_id = ? AND DATE(timestamp) BETWEEN ? AND ?
            GROUP BY DATE(timestamp)
            ORDER BY day
        """, (user_id, start_date.isoformat(), end_date.isoformat()))
        
        return [
            {
                "date": row[0],
                "compliance_rate": row[1] if row[1] is not None else 0.0,
                "total_events": row[2]
            }
            for row in cursor.fetchall()
        ]
    
    def _calculate_trend_statistics(self, daily_rates: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate statistical trend analysis from daily rates."""
        if len(daily_rates) < 2:
            return {"direction": "stable", "confidence": 0.0, "slope": 0.0}
        
        rates = [day["compliance_rate"] for day in daily_rates]
        
        # Simple linear regression for trend
        n = len(rates)
        x_sum = sum(range(n))
        y_sum = sum(rates)
        xy_sum = sum(i * rate for i, rate in enumerate(rates))
        x2_sum = sum(i * i for i in range(n))
        
        slope = (n * xy_sum - x_sum * y_sum) / (n * x2_sum - x_sum * x_sum)
        
        # Determine direction
        if abs(slope) < 0.5:
            direction = "stable"
        elif slope > 0:
            direction = "improving"
        else:
            direction = "declining"
        
        # Calculate confidence based on consistency
        confidence = min(1.0, abs(slope) / 5.0)  # Normalize to 0-1
        
        return {
            "direction": direction,
            "confidence": confidence,
            "slope": slope,
            "average_rate": sum(rates) / len(rates),
            "rate_variance": sum((rate - sum(rates) / len(rates))**2 for rate in rates) / len(rates)
        }
    
    def _analyze_violation_pattern_changes(self, conn: sqlite3.Connection, user_id: str, start_date: date, end_date: date) -> Dict[str, Any]:
        """Analyze how violation patterns have changed over time."""
        mid_date = start_date + (end_date - start_date) / 2
        
        early_violations = self._get_top_user_violations(conn, user_id, start_date, mid_date)
        recent_violations = self._get_top_user_violations(conn, user_id, mid_date, end_date)
        
        return {
            "early_period_violations": early_violations,
            "recent_period_violations": recent_violations,
            "new_violations": [v for v in recent_violations if v not in early_violations],
            "resolved_violations": [v for v in early_violations if v not in recent_violations]
        }
    
    def _identify_improvement_milestones(self, daily_rates: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Identify significant improvement milestones in compliance data."""
        milestones = []
        
        for i in range(1, len(daily_rates)):
            current_rate = daily_rates[i]["compliance_rate"]
            previous_rate = daily_rates[i-1]["compliance_rate"]
            
            # Significant improvement (>20% increase)
            if current_rate > previous_rate + 20:
                milestones.append({
                    "date": daily_rates[i]["date"],
                    "type": "significant_improvement",
                    "from_rate": previous_rate,
                    "to_rate": current_rate,
                    "improvement": current_rate - previous_rate
                })
            
            # Perfect compliance achieved
            if current_rate == 100.0 and previous_rate < 100.0:
                milestones.append({
                    "date": daily_rates[i]["date"],
                    "type": "perfect_compliance",
                    "rate": current_rate
                })
        
        return milestones
    
    def _get_compliance_thresholds(self, conn: sqlite3.Connection) -> Dict[str, float]:
        """Get compliance threshold configuration."""
        try:
            cursor = conn.execute("SELECT key, value FROM enforcement_config WHERE key LIKE 'threshold_%'")
            thresholds = {row[0].replace('threshold_', ''): float(row[1]) for row in cursor.fetchall()}
        except:
            thresholds = {}
        
        # Default thresholds
        return {
            "min_compliance_rate": thresholds.get("min_compliance_rate", 0.8),
            "max_daily_violations": thresholds.get("max_daily_violations", 10),
            "min_productivity_score": thresholds.get("min_productivity_score", 60.0)
        }
    
    def _get_all_active_users(self, conn: sqlite3.Connection) -> List[str]:
        """Get all users with recent activity."""
        cursor = conn.execute("""
            SELECT DISTINCT user_id 
            FROM enforcement_events 
            WHERE DATE(timestamp) >= DATE('now', '-7 days')
        """)
        return [row[0] for row in cursor.fetchall()]
    
    def _store_alerts(self, conn: sqlite3.Connection, alerts: List[ComplianceAlert]) -> None:
        """Store alerts in database for tracking."""
        for alert in alerts:
            conn.execute("""
                INSERT OR REPLACE INTO enforcement_config (key, value)
                VALUES (?, ?)
            """, (f"alert_{alert.alert_id}", json.dumps(self._alert_to_dict(alert))))
        conn.commit()
    
    def _get_events_since(self, conn: sqlite3.Connection, since_time: datetime) -> List[Dict[str, Any]]:
        """Get all enforcement events since specified time."""
        cursor = conn.execute("""
            SELECT user_id, session_id, event_type, file_path, operation_type, 
                   user_action, timestamp
            FROM enforcement_events 
            WHERE timestamp > ?
            ORDER BY timestamp DESC
            LIMIT 50
        """, (since_time.isoformat(),))
        
        return [
            {
                "user_id": row[0],
                "session_id": row[1],
                "event_type": row[2],
                "file_path": row[3],
                "operation_type": row[4], 
                "user_action": row[5],
                "timestamp": row[6]
            }
            for row in cursor.fetchall()
        ]
    
    def export_management_reports(self, user_ids: List[str], output_format: str = "json", output_path: Optional[str] = None, days: int = 30) -> Tuple[bool, str]:
        """
        Export comprehensive management reports for dashboard data.
        
        Args:
            user_ids: List of user IDs to include in the report
            output_format: Export format ('json', 'csv', 'html')
            output_path: Optional output file path
            days: Number of days to analyze (default: 30)
            
        Returns:
            Tuple of (success, result_path_or_error_message)
        """
        try:
            import tempfile
            import csv
            import os
            
            # Generate comprehensive dashboard data for all users
            report_data = {
                "report_generated": datetime.now().isoformat(),
                "analysis_period_days": days,
                "total_users": len(user_ids),
                "users": [],
                "team_summary": {},
                "alerts": []
            }
            
            # Collect individual user data
            for user_id in user_ids:
                user_dashboard = self.generate_user_dashboard(user_id, days)
                user_data = {
                    "user_id": user_dashboard.user_id,
                    "period_start": user_dashboard.period_start.isoformat(),
                    "period_end": user_dashboard.period_end.isoformat(),
                    "total_events": user_dashboard.total_events,
                    "compliance_rate": round(user_dashboard.compliance_rate, 2),
                    "productivity_score": round(user_dashboard.productivity_score, 2),
                    "trend_direction": user_dashboard.trend_direction,
                    "violation_count": user_dashboard.violation_count,
                    "override_count": user_dashboard.override_count,
                    "top_violations": user_dashboard.top_violations,
                    "performance_percentile": round(user_dashboard.performance_percentile, 1)
                }
                report_data["users"].append(user_data)
            
            # Generate team summary
            team_dashboard = self.generate_team_dashboard(user_ids, "Management Report Team", days)
            report_data["team_summary"] = {
                "member_count": team_dashboard.member_count,
                "average_compliance_rate": round(team_dashboard.average_compliance_rate, 2),
                "average_productivity_score": round(team_dashboard.average_productivity_score, 2),
                "total_violations": team_dashboard.total_violations,
                "total_overrides": team_dashboard.total_overrides,
                "trend_direction": team_dashboard.trend_direction,
                "team_velocity": round(team_dashboard.team_velocity, 2),
                "top_performers": team_dashboard.top_performers,
                "improvement_opportunities": team_dashboard.improvement_opportunities
            }
            
            # Include recent alerts
            alerts = self.check_compliance_thresholds()
            report_data["alerts"] = [self._alert_to_dict(alert) for alert in alerts if alert.user_id in user_ids]
            
            # Determine output file path
            if output_path is None:
                temp_dir = tempfile.mkdtemp()
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = f"management_report_{timestamp}.{output_format}"
                output_path = os.path.join(temp_dir, filename)
            
            # Export based on format
            if output_format.lower() == "json":
                with open(output_path, 'w') as f:
                    json.dump(report_data, f, indent=2)
                    
            elif output_format.lower() == "csv":
                with open(output_path, 'w', newline='') as f:
                    writer = csv.writer(f)
                    
                    # Write team summary
                    writer.writerow(["TEAM SUMMARY"])
                    writer.writerow(["Member Count", report_data["team_summary"]["member_count"]])
                    writer.writerow(["Average Compliance Rate", f"{report_data['team_summary']['average_compliance_rate']}%"])
                    writer.writerow(["Average Productivity Score", report_data["team_summary"]["average_productivity_score"]])
                    writer.writerow(["Total Violations", report_data["team_summary"]["total_violations"]])
                    writer.writerow(["Team Velocity", report_data["team_summary"]["team_velocity"]])
                    writer.writerow([])
                    
                    # Write user details
                    writer.writerow(["INDIVIDUAL USER DETAILS"])
                    writer.writerow(["User ID", "Total Events", "Compliance Rate", "Productivity Score", "Trend", "Violations", "Overrides", "Percentile"])
                    
                    for user in report_data["users"]:
                        writer.writerow([
                            user["user_id"],
                            user["total_events"],
                            f"{user['compliance_rate']}%",
                            user["productivity_score"],
                            user["trend_direction"],
                            user["violation_count"],
                            user["override_count"],
                            f"{user['performance_percentile']}%"
                        ])
                        
            elif output_format.lower() == "html":
                html_content = self._generate_html_management_report(report_data)
                with open(output_path, 'w') as f:
                    f.write(html_content)
            
            else:
                return False, f"Unsupported output format: {output_format}"
            
            return True, output_path
            
        except Exception as e:
            logger.error(f"Error exporting management reports: {e}")
            return False, str(e)
    
    def _generate_html_management_report(self, report_data: Dict[str, Any]) -> str:
        """Generate HTML version of management report."""
        html_template = f"""
<!DOCTYPE html>
<html>
<head>
    <title>Task Execution Enforcement - Management Report</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; }}
        .header {{ background-color: #f4f4f4; padding: 20px; border-radius: 5px; }}
        .section {{ margin: 20px 0; }}
        .team-summary {{ background-color: #e8f4fd; padding: 15px; border-radius: 5px; }}
        .user-table {{ width: 100%; border-collapse: collapse; margin: 10px 0; }}
        .user-table th, .user-table td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
        .user-table th {{ background-color: #f2f2f2; }}
        .alert {{ background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 5px 0; }}
        .metric {{ display: inline-block; margin: 10px 20px 10px 0; }}
        .metric-label {{ font-weight: bold; }}
        .trend-improving {{ color: green; }}
        .trend-declining {{ color: red; }}
        .trend-stable {{ color: orange; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>Task Execution Enforcement - Management Report</h1>
        <p><strong>Generated:</strong> {report_data['report_generated']}</p>
        <p><strong>Analysis Period:</strong> {report_data['analysis_period_days']} days</p>
        <p><strong>Team Size:</strong> {report_data['total_users']} users</p>
    </div>
    
    <div class="section team-summary">
        <h2>Team Performance Summary</h2>
        <div class="metric">
            <span class="metric-label">Average Compliance Rate:</span> {report_data['team_summary']['average_compliance_rate']}%
        </div>
        <div class="metric">
            <span class="metric-label">Average Productivity Score:</span> {report_data['team_summary']['average_productivity_score']}
        </div>
        <div class="metric">
            <span class="metric-label">Team Velocity:</span> {report_data['team_summary']['team_velocity']} tasks/day
        </div>
        <div class="metric">
            <span class="metric-label">Total Violations:</span> {report_data['team_summary']['total_violations']}
        </div>
        <div class="metric">
            <span class="metric-label">Trend:</span> 
            <span class="trend-{report_data['team_summary']['trend_direction']}">{report_data['team_summary']['trend_direction'].title()}</span>
        </div>
        
        <h3>Top Performers</h3>
        <ul>
        """
        
        for performer in report_data['team_summary']['top_performers']:
            html_template += f"<li>{performer}</li>"
        
        html_template += """
        </ul>
        
        <h3>Improvement Opportunities</h3>
        <ul>
        """
        
        for opportunity in report_data['team_summary']['improvement_opportunities']:
            html_template += f"<li>{opportunity}</li>"
        
        html_template += """
        </ul>
    </div>
    
    <div class="section">
        <h2>Individual User Performance</h2>
        <table class="user-table">
            <thead>
                <tr>
                    <th>User ID</th>
                    <th>Total Events</th>
                    <th>Compliance Rate</th>
                    <th>Productivity Score</th>
                    <th>Trend</th>
                    <th>Violations</th>
                    <th>Overrides</th>
                    <th>Performance Percentile</th>
                </tr>
            </thead>
            <tbody>
        """
        
        for user in report_data['users']:
            trend_class = f"trend-{user['trend_direction']}"
            html_template += f"""
                <tr>
                    <td>{user['user_id']}</td>
                    <td>{user['total_events']}</td>
                    <td>{user['compliance_rate']}%</td>
                    <td>{user['productivity_score']}</td>
                    <td class="{trend_class}">{user['trend_direction'].title()}</td>
                    <td>{user['violation_count']}</td>
                    <td>{user['override_count']}</td>
                    <td>{user['performance_percentile']}%</td>
                </tr>
            """
        
        html_template += """
            </tbody>
        </table>
    </div>
        """
        
        if report_data['alerts']:
            html_template += """
    <div class="section">
        <h2>Active Compliance Alerts</h2>
            """
            
            for alert in report_data['alerts']:
                html_template += f"""
        <div class="alert">
            <strong>{alert['severity'].upper()}:</strong> {alert['message']}
            <br><small>User: {alert['user_id']} | Type: {alert['alert_type']} | Created: {alert['created_at']}</small>
        </div>
                """
            
            html_template += "</div>"
        
        html_template += """
</body>
</html>
        """
        
        return html_template
    
    def _alert_to_dict(self, alert: ComplianceAlert) -> Dict[str, Any]:
        """Convert ComplianceAlert to dictionary for serialization."""
        return {
            "alert_id": alert.alert_id,
            "user_id": alert.user_id,
            "alert_type": alert.alert_type,
            "severity": alert.severity.value,
            "threshold_breached": alert.threshold_breached,
            "current_value": alert.current_value,
            "threshold_value": alert.threshold_value,
            "created_at": alert.created_at.isoformat(),
            "message": alert.message,
            "acknowledged": alert.acknowledged,
            "resolved": alert.resolved
        }