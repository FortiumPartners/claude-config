"""
Task 4.7: Data export functionality for reporting

This module implements comprehensive data export capabilities for analytics reporting,
dashboard integration, and management review purposes.
"""
import logging
import csv
import json
from datetime import datetime, date, timedelta
from typing import Dict, List, Optional, Any, Tuple, Union
from pathlib import Path
from io import StringIO
import sqlite3

from .database import DatabaseManager, get_database
from .metrics_collector import MetricsCollector, ComplianceMetrics
from .performance_analytics import PerformanceAnalytics, PerformanceReport

logger = logging.getLogger(__name__)


class ExportFormat:
    """Supported export formats."""
    CSV = "csv"
    JSON = "json"
    HTML = "html"
    XLSX = "xlsx"  # Future enhancement


class ExportService:
    """
    Comprehensive data export service for analytics reporting.
    
    Provides multiple export formats for compliance data, productivity metrics,
    and performance analytics suitable for different stakeholders.
    """
    
    def __init__(self, db_manager: Optional[DatabaseManager] = None):
        """
        Initialize export service.
        
        Args:
            db_manager: Optional database manager instance
        """
        self.db = db_manager or get_database()
        self.metrics = MetricsCollector(self.db)
        self.analytics = PerformanceAnalytics(self.db, self.metrics)
        
    def export_user_compliance_report(self, user_id: str, start_date: date, 
                                    end_date: date, format: str = ExportFormat.CSV,
                                    output_path: Optional[str] = None) -> Tuple[bool, str]:
        """
        Export comprehensive compliance report for a user.
        
        Args:
            user_id: User identifier
            start_date: Report start date
            end_date: Report end date
            format: Export format (csv, json, html)
            output_path: Custom output file path
            
        Returns:
            Tuple of (success, output_path_or_error)
        """
        try:
            # Get compliance metrics
            metrics_data = self.metrics.get_user_metrics_range(user_id, start_date, end_date)
            
            # Get performance report
            days = (end_date - start_date).days
            performance_report = self.analytics.generate_performance_report(user_id, days)
            
            # Get violation patterns
            violation_patterns = self.metrics.get_violation_patterns(user_id, days)
            
            report_data = {
                'user_id': user_id,
                'report_period': {
                    'start_date': start_date.isoformat(),
                    'end_date': end_date.isoformat(),
                    'total_days': days
                },
                'summary': {
                    'overall_score': performance_report.overall_score,
                    'total_operations': sum(m.total_file_operations for m in metrics_data),
                    'total_violations': sum(m.violations_reminder + m.violations_warning + m.violations_blocking for m in metrics_data),
                    'average_compliance_rate': sum(m.compliance_rate for m in metrics_data) / len(metrics_data) if metrics_data else 0.0,
                    'override_usage_count': sum(m.override_usage for m in metrics_data)
                },
                'daily_metrics': [
                    {
                        'date': m.date.isoformat(),
                        'total_operations': m.total_file_operations,
                        'compliant_operations': m.compliant_operations,
                        'compliance_rate': m.compliance_rate,
                        'violations_reminder': m.violations_reminder,
                        'violations_warning': m.violations_warning,
                        'violations_blocking': m.violations_blocking,
                        'override_usage': m.override_usage,
                        'productivity_score': m.productivity_score
                    }
                    for m in metrics_data
                ],
                'performance_insights': [
                    {
                        'type': insight.insight_type,
                        'description': insight.description,
                        'impact_level': insight.impact_level,
                        'recommendation': insight.recommendation,
                        'affected_areas': insight.affected_areas
                    }
                    for insight in performance_report.insights
                ],
                'recommendations': performance_report.recommendations,
                'violation_patterns': violation_patterns
            }
            
            # Generate output
            if not output_path:
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                output_dir = Path.cwd() / 'reports'
                output_dir.mkdir(exist_ok=True)
                output_path = str(output_dir / f"compliance_report_{user_id}_{timestamp}.{format}")
                
            success = self._write_report(report_data, output_path, format)
            return success, output_path if success else "Export failed"
            
        except Exception as e:
            logger.error(f"Failed to export user compliance report: {e}")
            return False, str(e)
            
    def export_team_summary_report(self, user_ids: List[str], days: int = 30,
                                 format: str = ExportFormat.CSV,
                                 output_path: Optional[str] = None) -> Tuple[bool, str]:
        """
        Export team-wide summary report for management review.
        
        Args:
            user_ids: List of user IDs to include
            days: Number of days to analyze
            format: Export format
            output_path: Custom output file path
            
        Returns:
            Tuple of (success, output_path_or_error)
        """
        try:
            # Get team summary
            team_summary = self.metrics.get_team_summary(user_ids, days)
            
            # Get individual user performance
            user_reports = []
            for user_id in user_ids:
                performance_report = self.analytics.generate_performance_report(user_id, days)
                user_reports.append({
                    'user_id': user_id,
                    'overall_score': performance_report.overall_score,
                    'productivity_trend': performance_report.trends[0].trend_direction if performance_report.trends else 'stable',
                    'compliance_rate': team_summary['user_summaries'].get(user_id, {}).get('compliance_rate', 0.0),
                    'total_operations': team_summary['user_summaries'].get(user_id, {}).get('total_operations', 0),
                    'recommendations_count': len(performance_report.recommendations)
                })
                
            # Calculate team benchmarks
            benchmarks = self.analytics.calculate_team_performance_benchmark(user_ids, days)
            
            report_data = {
                'report_type': 'team_summary',
                'analysis_period_days': days,
                'team_size': len(user_ids),
                'generated_at': datetime.now().isoformat(),
                'team_metrics': {
                    'overall_compliance_rate': team_summary['overall_compliance_rate'],
                    'total_operations': team_summary['total_operations'],
                    'total_violations': team_summary['total_violations'],
                    'average_productivity_score': benchmarks['metrics']['avg_productivity_score']
                },
                'performance_distribution': {
                    'top_performers': team_summary['top_performers'],
                    'improvement_opportunities': team_summary['improvement_opportunities'],
                    'trends': benchmarks['trends']
                },
                'benchmarks': benchmarks['percentiles'],
                'individual_summaries': user_reports,
                'team_insights': self._generate_team_insights(team_summary, benchmarks)
            }
            
            # Generate output
            if not output_path:
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                output_dir = Path.cwd() / 'reports'
                output_dir.mkdir(exist_ok=True)
                output_path = str(output_dir / f"team_summary_report_{timestamp}.{format}")
                
            success = self._write_report(report_data, output_path, format)
            return success, output_path if success else "Export failed"
            
        except Exception as e:
            logger.error(f"Failed to export team summary report: {e}")
            return False, str(e)
            
    def export_dashboard_data(self, user_ids: Optional[List[str]] = None,
                            format: str = ExportFormat.JSON,
                            output_path: Optional[str] = None) -> Tuple[bool, str]:
        """
        Export real-time dashboard data for management interfaces.
        
        Args:
            user_ids: Optional list of user IDs (if None, exports all users)
            format: Export format (typically JSON for dashboards)
            output_path: Custom output file path
            
        Returns:
            Tuple of (success, output_path_or_error)
        """
        try:
            # Get all users if not specified
            if user_ids is None:
                user_ids = self._get_all_user_ids()
                
            # Collect real-time metrics
            dashboard_data = {
                'last_updated': datetime.now().isoformat(),
                'data_freshness': 'real_time',
                'metrics_summary': {
                    'total_users': len(user_ids),
                    'active_sessions': self._get_active_session_count(),
                    'today_operations': self._get_today_operations_count(),
                    'today_violations': self._get_today_violations_count()
                },
                'compliance_trends': self._get_compliance_trends(user_ids, 7),  # Last 7 days
                'productivity_metrics': self._get_productivity_metrics(user_ids),
                'alert_conditions': self._check_alert_conditions(user_ids),
                'top_violators': self._get_top_violators(user_ids, 7),
                'system_health': {
                    'database_status': 'healthy',
                    'last_cleanup': self._get_last_cleanup_time(),
                    'data_retention_status': 'compliant'
                }
            }
            
            # Generate output
            if not output_path:
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                output_dir = Path.cwd() / 'dashboard_data'
                output_dir.mkdir(exist_ok=True)
                output_path = str(output_dir / f"dashboard_data_{timestamp}.{format}")
                
            success = self._write_report(dashboard_data, output_path, format)
            return success, output_path if success else "Export failed"
            
        except Exception as e:
            logger.error(f"Failed to export dashboard data: {e}")
            return False, str(e)
            
    def export_audit_trail(self, start_date: date, end_date: date,
                         include_user_ids: Optional[List[str]] = None,
                         format: str = ExportFormat.CSV,
                         output_path: Optional[str] = None) -> Tuple[bool, str]:
        """
        Export comprehensive audit trail for compliance reviews.
        
        Args:
            start_date: Audit period start
            end_date: Audit period end
            include_user_ids: Optional filter for specific users
            format: Export format
            output_path: Custom output file path
            
        Returns:
            Tuple of (success, output_path_or_error)
        """
        try:
            audit_data = []
            
            with self.db.get_connection() as conn:
                # Build query with optional user filter
                user_filter = ""
                params = [start_date.isoformat(), end_date.isoformat()]
                
                if include_user_ids:
                    placeholders = ','.join(['?' for _ in include_user_ids])
                    user_filter = f" AND user_id IN ({placeholders})"
                    params.extend(include_user_ids)
                    
                # Get enforcement events
                cursor = conn.execute(f"""
                    SELECT 
                        timestamp,
                        user_id,
                        session_id,
                        event_type,
                        file_path,
                        operation_type,
                        enforcement_level,
                        suggested_command,
                        user_action,
                        metadata
                    FROM enforcement_events
                    WHERE DATE(timestamp) BETWEEN ? AND ? {user_filter}
                    ORDER BY timestamp DESC
                """, params)
                
                for row in cursor.fetchall():
                    audit_data.append({
                        'timestamp': row['timestamp'],
                        'user_id': row['user_id'],
                        'session_id': row['session_id'],
                        'event_type': row['event_type'],
                        'file_path': row['file_path'],
                        'operation_type': row['operation_type'],
                        'enforcement_level': row['enforcement_level'],
                        'suggested_command': row['suggested_command'],
                        'user_action': row['user_action'],
                        'metadata': row['metadata']
                    })
                    
                # Get override requests for the same period
                cursor = conn.execute(f"""
                    SELECT 
                        timestamp,
                        user_id,
                        session_id,
                        justification,
                        approved,
                        approver_id,
                        file_path,
                        operation_type,
                        duration_seconds
                    FROM override_requests
                    WHERE DATE(timestamp) BETWEEN ? AND ? {user_filter}
                    ORDER BY timestamp DESC
                """, params)
                
                override_data = []
                for row in cursor.fetchall():
                    override_data.append({
                        'timestamp': row['timestamp'],
                        'user_id': row['user_id'],
                        'session_id': row['session_id'],
                        'justification': row['justification'],
                        'approved': row['approved'],
                        'approver_id': row['approver_id'],
                        'file_path': row['file_path'],
                        'operation_type': row['operation_type'],
                        'duration_seconds': row['duration_seconds']
                    })
                    
            report_data = {
                'audit_period': {
                    'start_date': start_date.isoformat(),
                    'end_date': end_date.isoformat()
                },
                'user_filter': include_user_ids,
                'generated_at': datetime.now().isoformat(),
                'summary': {
                    'total_enforcement_events': len(audit_data),
                    'total_override_requests': len(override_data),
                    'unique_users': len(set(row['user_id'] for row in audit_data)),
                    'unique_sessions': len(set(row['session_id'] for row in audit_data))
                },
                'enforcement_events': audit_data,
                'override_requests': override_data
            }
            
            # Generate output
            if not output_path:
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                output_dir = Path.cwd() / 'audit_reports'
                output_dir.mkdir(exist_ok=True)
                output_path = str(output_dir / f"audit_trail_{timestamp}.{format}")
                
            success = self._write_report(report_data, output_path, format)
            return success, output_path if success else "Export failed"
            
        except Exception as e:
            logger.error(f"Failed to export audit trail: {e}")
            return False, str(e)
            
    def export_performance_trends(self, user_ids: List[str], days: int = 90,
                                format: str = ExportFormat.CSV,
                                output_path: Optional[str] = None) -> Tuple[bool, str]:
        """
        Export performance trend analysis for long-term review.
        
        Args:
            user_ids: List of user IDs to analyze
            days: Number of days to analyze (default 90 for quarterly review)
            format: Export format
            output_path: Custom output file path
            
        Returns:
            Tuple of (success, output_path_or_error)
        """
        try:
            trend_data = []
            
            for user_id in user_ids:
                # Get user performance trend
                trend = self.analytics.calculate_productivity_trend(user_id, days)
                
                # Get historical metrics
                end_date = date.today()
                start_date = end_date - timedelta(days=days)
                metrics_data = self.metrics.get_user_metrics_range(user_id, start_date, end_date)
                
                # Calculate weekly averages for trend visualization
                weekly_data = self._aggregate_weekly_metrics(metrics_data)
                
                trend_data.append({
                    'user_id': user_id,
                    'trend_analysis': {
                        'baseline_score': trend.baseline_score,
                        'current_score': trend.current_score,
                        'trend_direction': trend.trend_direction,
                        'improvement_rate': trend.improvement_rate,
                        'confidence_level': trend.confidence_level
                    },
                    'weekly_metrics': weekly_data,
                    'summary': {
                        'total_operations': sum(m.total_file_operations for m in metrics_data),
                        'average_compliance': sum(m.compliance_rate for m in metrics_data) / len(metrics_data) if metrics_data else 0.0,
                        'peak_productivity_score': max((m.productivity_score or 0) for m in metrics_data) if metrics_data else 0.0,
                        'lowest_productivity_score': min((m.productivity_score or 0) for m in metrics_data) if metrics_data else 0.0
                    }
                })
                
            report_data = {
                'report_type': 'performance_trends',
                'analysis_period_days': days,
                'users_analyzed': len(user_ids),
                'generated_at': datetime.now().isoformat(),
                'overall_trends': self._analyze_overall_trends(trend_data),
                'user_trends': trend_data
            }
            
            # Generate output
            if not output_path:
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                output_dir = Path.cwd() / 'reports'
                output_dir.mkdir(exist_ok=True)
                output_path = str(output_dir / f"performance_trends_{timestamp}.{format}")
                
            success = self._write_report(report_data, output_path, format)
            return success, output_path if success else "Export failed"
            
        except Exception as e:
            logger.error(f"Failed to export performance trends: {e}")
            return False, str(e)
            
    def _write_report(self, data: Dict[str, Any], output_path: str, format: str) -> bool:
        """Write report data to file in specified format."""
        try:
            Path(output_path).parent.mkdir(parents=True, exist_ok=True)
            
            if format == ExportFormat.JSON:
                with open(output_path, 'w') as f:
                    json.dump(data, f, indent=2, default=str)
                    
            elif format == ExportFormat.CSV:
                self._write_csv_report(data, output_path)
                
            elif format == ExportFormat.HTML:
                self._write_html_report(data, output_path)
                
            else:
                raise ValueError(f"Unsupported export format: {format}")
                
            logger.info(f"Report exported successfully to {output_path}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to write report to {output_path}: {e}")
            return False
            
    def _write_csv_report(self, data: Dict[str, Any], output_path: str):
        """Write report data as CSV file."""
        with open(output_path, 'w', newline='') as f:
            if 'daily_metrics' in data:
                # User compliance report format
                fieldnames = ['date', 'total_operations', 'compliant_operations', 'compliance_rate',
                            'violations_reminder', 'violations_warning', 'violations_blocking',
                            'override_usage', 'productivity_score']
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(data['daily_metrics'])
                
            elif 'individual_summaries' in data:
                # Team summary report format
                fieldnames = ['user_id', 'overall_score', 'productivity_trend', 'compliance_rate',
                            'total_operations', 'recommendations_count']
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(data['individual_summaries'])
                
            elif 'enforcement_events' in data:
                # Audit trail format
                fieldnames = ['timestamp', 'user_id', 'session_id', 'event_type', 'file_path',
                            'operation_type', 'enforcement_level', 'suggested_command', 'user_action']
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(data['enforcement_events'])
                
    def _write_html_report(self, data: Dict[str, Any], output_path: str):
        """Write report data as HTML file."""
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Analytics Report</title>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 20px; }}
                .header {{ background-color: #f0f0f0; padding: 10px; margin-bottom: 20px; }}
                .metric {{ margin: 10px 0; }}
                table {{ border-collapse: collapse; width: 100%; }}
                th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
                th {{ background-color: #f2f2f2; }}
                .insight {{ background-color: #e7f3ff; padding: 10px; margin: 10px 0; border-radius: 5px; }}
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Analytics Report</h1>
                <p>Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
            </div>
            <pre>{json.dumps(data, indent=2, default=str)}</pre>
        </body>
        </html>
        """
        
        with open(output_path, 'w') as f:
            f.write(html_content)
            
    def _get_all_user_ids(self) -> List[str]:
        """Get all unique user IDs from database."""
        with self.db.get_connection() as conn:
            cursor = conn.execute("SELECT DISTINCT user_id FROM enforcement_events")
            return [row['user_id'] for row in cursor.fetchall()]
            
    def _get_active_session_count(self) -> int:
        """Get count of currently active sessions."""
        with self.db.get_connection() as conn:
            cursor = conn.execute("SELECT COUNT(*) as count FROM user_sessions WHERE active = 1")
            return cursor.fetchone()['count']
            
    def _get_today_operations_count(self) -> int:
        """Get count of file operations today."""
        today = date.today().isoformat()
        with self.db.get_connection() as conn:
            cursor = conn.execute("""
                SELECT COUNT(*) as count FROM enforcement_events 
                WHERE DATE(timestamp) = ?
            """, (today,))
            return cursor.fetchone()['count']
            
    def _get_today_violations_count(self) -> int:
        """Get count of violations today."""
        today = date.today().isoformat()
        with self.db.get_connection() as conn:
            cursor = conn.execute("""
                SELECT COUNT(*) as count FROM enforcement_events 
                WHERE DATE(timestamp) = ? AND event_type IN ('reminder', 'warning', 'blocking')
            """, (today,))
            return cursor.fetchone()['count']
            
    def _get_compliance_trends(self, user_ids: List[str], days: int) -> List[Dict[str, Any]]:
        """Get compliance trends for dashboard."""
        trends = []
        end_date = date.today()
        
        for i in range(days):
            check_date = end_date - timedelta(days=i)
            daily_compliance = []
            
            for user_id in user_ids:
                metrics = self.metrics.get_daily_metrics(user_id, check_date)
                if metrics:
                    daily_compliance.append(metrics.compliance_rate)
                    
            avg_compliance = sum(daily_compliance) / len(daily_compliance) if daily_compliance else 100.0
            
            trends.append({
                'date': check_date.isoformat(),
                'average_compliance_rate': avg_compliance,
                'active_users': len(daily_compliance)
            })
            
        return list(reversed(trends))  # Return in chronological order
        
    def _get_productivity_metrics(self, user_ids: List[str]) -> Dict[str, Any]:
        """Get current productivity metrics summary."""
        all_scores = []
        
        for user_id in user_ids:
            trend = self.analytics.calculate_productivity_trend(user_id, 7)
            if trend.current_score > 0:
                all_scores.append(trend.current_score)
                
        return {
            'average_score': sum(all_scores) / len(all_scores) if all_scores else 0.0,
            'total_users_with_data': len(all_scores),
            'highest_score': max(all_scores) if all_scores else 0.0,
            'lowest_score': min(all_scores) if all_scores else 0.0
        }
        
    def _check_alert_conditions(self, user_ids: List[str]) -> List[Dict[str, Any]]:
        """Check for alert conditions that need attention."""
        alerts = []
        
        for user_id in user_ids:
            # Check for declining trends
            trend = self.analytics.calculate_productivity_trend(user_id, 7)
            if trend.trend_direction == 'declining' and trend.improvement_rate < -10:
                alerts.append({
                    'type': 'declining_performance',
                    'user_id': user_id,
                    'severity': 'high' if trend.improvement_rate < -20 else 'medium',
                    'message': f"User {user_id} productivity declined {abs(trend.improvement_rate):.1f}%"
                })
                
            # Check for low compliance
            metrics = self.metrics.get_daily_metrics(user_id, date.today())
            if metrics and metrics.compliance_rate < 70:
                alerts.append({
                    'type': 'low_compliance',
                    'user_id': user_id,
                    'severity': 'high' if metrics.compliance_rate < 50 else 'medium',
                    'message': f"User {user_id} compliance rate is {metrics.compliance_rate:.1f}%"
                })
                
        return alerts
        
    def _get_top_violators(self, user_ids: List[str], days: int) -> List[Dict[str, Any]]:
        """Get users with highest violation counts."""
        violators = []
        
        for user_id in user_ids:
            patterns = self.metrics.get_violation_patterns(user_id, days)
            total_violations = sum(v['count'] for v in patterns.get('most_common_violations', []))
            
            if total_violations > 0:
                violators.append({
                    'user_id': user_id,
                    'total_violations': total_violations,
                    'most_common_type': patterns.get('most_common_violations', [{}])[0].get('type', 'unknown')
                })
                
        return sorted(violators, key=lambda x: x['total_violations'], reverse=True)[:5]
        
    def _get_last_cleanup_time(self) -> Optional[str]:
        """Get timestamp of last data cleanup operation."""
        # This would be tracked in a separate log or config table in production
        return self.db.get_config_value('last_cleanup_time')
        
    def _generate_team_insights(self, team_summary: Dict[str, Any], 
                              benchmarks: Dict[str, Any]) -> List[str]:
        """Generate insights for team summary report."""
        insights = []
        
        if team_summary['overall_compliance_rate'] < 80:
            insights.append("Team compliance rate is below recommended 80% threshold")
            
        if len(team_summary['improvement_opportunities']) > len(team_summary['top_performers']):
            insights.append("More users need improvement than are performing well")
            
        if benchmarks['trends']['declining_users'] > benchmarks['trends']['improving_users']:
            insights.append("More users showing declining trends than improving")
            
        return insights
        
    def _aggregate_weekly_metrics(self, metrics_data: List[ComplianceMetrics]) -> List[Dict[str, Any]]:
        """Aggregate daily metrics into weekly summaries."""
        weekly_data = []
        
        if not metrics_data:
            return weekly_data
            
        # Group by week
        current_week = []
        current_week_start = None
        
        for metric in sorted(metrics_data, key=lambda x: x.date):
            week_start = metric.date - timedelta(days=metric.date.weekday())
            
            if current_week_start != week_start:
                if current_week:
                    weekly_data.append(self._calculate_weekly_summary(current_week, current_week_start))
                current_week = [metric]
                current_week_start = week_start
            else:
                current_week.append(metric)
                
        # Add last week
        if current_week:
            weekly_data.append(self._calculate_weekly_summary(current_week, current_week_start))
            
        return weekly_data
        
    def _calculate_weekly_summary(self, week_metrics: List[ComplianceMetrics], 
                                week_start: date) -> Dict[str, Any]:
        """Calculate summary for a week of metrics."""
        return {
            'week_start': week_start.isoformat(),
            'week_end': (week_start + timedelta(days=6)).isoformat(),
            'average_compliance_rate': sum(m.compliance_rate for m in week_metrics) / len(week_metrics),
            'average_productivity_score': sum(m.productivity_score or 0 for m in week_metrics) / len(week_metrics),
            'total_operations': sum(m.total_file_operations for m in week_metrics),
            'total_violations': sum(m.violations_reminder + m.violations_warning + m.violations_blocking 
                                  for m in week_metrics)
        }
        
    def _analyze_overall_trends(self, trend_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze overall trends across all users."""
        improving_count = sum(1 for t in trend_data 
                            if t['trend_analysis']['trend_direction'] == 'improving')
        declining_count = sum(1 for t in trend_data 
                            if t['trend_analysis']['trend_direction'] == 'declining')
        
        avg_improvement_rate = sum(t['trend_analysis']['improvement_rate'] for t in trend_data) / len(trend_data) if trend_data else 0.0
        
        return {
            'improving_users': improving_count,
            'declining_users': declining_count,
            'stable_users': len(trend_data) - improving_count - declining_count,
            'average_improvement_rate': avg_improvement_rate,
            'overall_trend': 'positive' if avg_improvement_rate > 2 else 'negative' if avg_improvement_rate < -2 else 'stable'
        }


# Convenience function for getting default export service
_default_export_service = None

def get_export_service() -> ExportService:
    """Get default export service instance."""
    global _default_export_service
    if _default_export_service is None:
        _default_export_service = ExportService()
    return _default_export_service