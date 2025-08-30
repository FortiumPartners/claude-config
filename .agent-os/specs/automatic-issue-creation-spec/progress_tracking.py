#!/usr/bin/env python3
"""
Progress tracking and status updates for automatic issue creation.

This module provides comprehensive progress tracking capabilities including
status synchronization, progress reporting, and automated updates.
"""

import asyncio
import logging
from typing import List, Dict, Any, Optional, Union, Tuple, Set
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum

from ticketing_interface import CreatedIssue, IssueStatus, TicketingInterfaceException
from issue_spec import IssueSpec, IssueHierarchy, IssueType


class ProgressEvent(Enum):
    """Types of progress events that can be tracked."""
    ISSUE_CREATED = "issue_created"
    ISSUE_UPDATED = "issue_updated"
    STATUS_CHANGED = "status_changed"
    PROGRESS_MILESTONE = "progress_milestone"
    HIERARCHY_COMPLETED = "hierarchy_completed"


@dataclass
class ProgressMetrics:
    """Metrics for tracking issue hierarchy progress."""
    total_issues: int = 0
    created_issues: int = 0
    in_progress_issues: int = 0
    completed_issues: int = 0
    cancelled_issues: int = 0
    
    # Breakdown by type
    epics_total: int = 0
    epics_completed: int = 0
    features_total: int = 0
    features_completed: int = 0
    tasks_total: int = 0
    tasks_completed: int = 0
    
    # Time tracking
    creation_started_at: Optional[datetime] = None
    creation_completed_at: Optional[datetime] = None
    last_update_at: Optional[datetime] = None
    
    @property
    def completion_percentage(self) -> float:
        """Calculate overall completion percentage."""
        if self.total_issues == 0:
            return 0.0
        return (self.completed_issues / self.total_issues) * 100.0
    
    @property
    def epic_completion_percentage(self) -> float:
        """Calculate epic completion percentage."""
        if self.epics_total == 0:
            return 0.0
        return (self.epics_completed / self.epics_total) * 100.0
    
    @property
    def feature_completion_percentage(self) -> float:
        """Calculate feature completion percentage."""
        if self.features_total == 0:
            return 0.0
        return (self.features_completed / self.features_total) * 100.0
    
    @property
    def creation_duration_minutes(self) -> Optional[float]:
        """Get creation duration in minutes."""
        if not self.creation_started_at or not self.creation_completed_at:
            return None
        delta = self.creation_completed_at - self.creation_started_at
        return delta.total_seconds() / 60.0


@dataclass
class ProgressUpdate:
    """Information about a progress update."""
    event_type: ProgressEvent
    issue_id: str
    issue_number: Optional[Union[int, str]]
    old_status: Optional[IssueStatus]
    new_status: Optional[IssueStatus]
    timestamp: datetime
    message: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


class ProgressTracker:
    """
    Tracks progress of issue creation and management operations.
    
    Provides real-time progress monitoring, status synchronization,
    and progress reporting capabilities.
    """
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self._metrics = ProgressMetrics()
        self._progress_history: List[ProgressUpdate] = []
        self._issue_status_map: Dict[str, IssueStatus] = {}
        self._callbacks: List[callable] = []
    
    def add_progress_callback(self, callback: callable) -> None:
        """Add a callback to be notified of progress updates."""
        self._callbacks.append(callback)
    
    def start_tracking(self, hierarchy: IssueHierarchy) -> None:
        """Initialize tracking for an issue hierarchy."""
        self._metrics = ProgressMetrics()
        self._metrics.total_issues = hierarchy.total_count()
        self._metrics.creation_started_at = datetime.now(timezone.utc)
        
        # Count by type
        for issue in hierarchy.all_issues.values():
            if issue.is_epic():
                self._metrics.epics_total += 1
            elif issue.is_story():
                self._metrics.features_total += 1
            else:
                self._metrics.tasks_total += 1
        
        self.logger.info(
            f"Started progress tracking for {self._metrics.total_issues} issues "
            f"({self._metrics.epics_total} epics, {self._metrics.features_total} features, "
            f"{self._metrics.tasks_total} tasks)"
        )
        
        self._notify_progress(ProgressUpdate(
            event_type=ProgressEvent.PROGRESS_MILESTONE,
            issue_id="tracking",
            issue_number=None,
            old_status=None,
            new_status=None,
            timestamp=self._metrics.creation_started_at,
            message=f"Started tracking {self._metrics.total_issues} issues"
        ))
    
    def record_issue_created(self, created_issue: CreatedIssue) -> None:
        """Record that an issue was successfully created."""
        self._metrics.created_issues += 1
        self._metrics.last_update_at = datetime.now(timezone.utc)
        
        # Update status tracking
        status = created_issue.status or IssueStatus.TODO
        self._issue_status_map[created_issue.id] = status
        self._update_status_counts(status, increment=True)
        
        # Update type-specific counts
        if created_issue.original_spec:
            if created_issue.original_spec.is_epic():
                # Epic is created but not completed yet
                pass
            elif created_issue.original_spec.is_story():
                # Feature is created but not completed yet
                pass
        
        progress_update = ProgressUpdate(
            event_type=ProgressEvent.ISSUE_CREATED,
            issue_id=created_issue.id,
            issue_number=created_issue.number,
            old_status=None,
            new_status=status,
            timestamp=self._metrics.last_update_at,
            message=f"Created issue: {created_issue.title}",
            metadata={
                "issue_type": created_issue.original_spec.issue_type.value if created_issue.original_spec else "unknown",
                "url": created_issue.url
            }
        )
        
        self.logger.info(f"Issue created: #{created_issue.number} - {created_issue.title}")
        self._progress_history.append(progress_update)
        self._notify_progress(progress_update)
        
        # Check for completion milestones
        if self._metrics.created_issues == self._metrics.total_issues:
            self._mark_creation_complete()
    
    def record_status_update(
        self,
        issue_id: str,
        issue_number: Optional[Union[int, str]],
        old_status: IssueStatus,
        new_status: IssueStatus,
        issue_spec: Optional[IssueSpec] = None
    ) -> None:
        """Record a status update for an issue."""
        self._metrics.last_update_at = datetime.now(timezone.utc)
        
        # Update status counts
        self._update_status_counts(old_status, increment=False)
        self._update_status_counts(new_status, increment=True)
        
        # Update type-specific completion counts
        if issue_spec and new_status == IssueStatus.DONE:
            if issue_spec.is_epic():
                self._metrics.epics_completed += 1
            elif issue_spec.is_story():
                self._metrics.features_completed += 1
        
        # Track the status change
        self._issue_status_map[issue_id] = new_status
        
        progress_update = ProgressUpdate(
            event_type=ProgressEvent.STATUS_CHANGED,
            issue_id=issue_id,
            issue_number=issue_number,
            old_status=old_status,
            new_status=new_status,
            timestamp=self._metrics.last_update_at,
            message=f"Status changed: {old_status.value} → {new_status.value}",
            metadata={
                "issue_type": issue_spec.issue_type.value if issue_spec else "unknown"
            }
        )
        
        self.logger.info(f"Status update for issue #{issue_number}: {old_status.value} → {new_status.value}")
        self._progress_history.append(progress_update)
        self._notify_progress(progress_update)
        
        # Check for hierarchy completion
        if new_status == IssueStatus.DONE:
            self._check_hierarchy_completion()
    
    def get_current_metrics(self) -> ProgressMetrics:
        """Get current progress metrics."""
        return self._metrics
    
    def get_progress_summary(self) -> Dict[str, Any]:
        """Get a comprehensive progress summary."""
        return {
            "metrics": {
                "total_issues": self._metrics.total_issues,
                "created_issues": self._metrics.created_issues,
                "completion_percentage": round(self._metrics.completion_percentage, 1),
                "epic_completion_percentage": round(self._metrics.epic_completion_percentage, 1),
                "feature_completion_percentage": round(self._metrics.feature_completion_percentage, 1)
            },
            "status_breakdown": {
                "in_progress": self._metrics.in_progress_issues,
                "completed": self._metrics.completed_issues,
                "cancelled": self._metrics.cancelled_issues
            },
            "timing": {
                "started_at": self._metrics.creation_started_at.isoformat() if self._metrics.creation_started_at else None,
                "completed_at": self._metrics.creation_completed_at.isoformat() if self._metrics.creation_completed_at else None,
                "duration_minutes": self._metrics.creation_duration_minutes,
                "last_update_at": self._metrics.last_update_at.isoformat() if self._metrics.last_update_at else None
            },
            "recent_updates": [
                {
                    "event": update.event_type.value,
                    "issue": update.issue_number,
                    "status": update.new_status.value if update.new_status else None,
                    "timestamp": update.timestamp.isoformat(),
                    "message": update.message
                }
                for update in self._progress_history[-10:]  # Last 10 updates
            ]
        }
    
    def get_progress_report(self) -> str:
        """Generate a formatted progress report."""
        metrics = self._metrics
        
        report_lines = [
            "📊 **Issue Creation Progress Report**",
            "",
            f"**Overall Progress:** {metrics.completion_percentage:.1f}% ({metrics.completed_issues}/{metrics.total_issues})",
            f"**Created Issues:** {metrics.created_issues}/{metrics.total_issues}",
            ""
        ]
        
        # Breakdown by type
        if metrics.epics_total > 0:
            report_lines.append(f"🎯 **Epics:** {metrics.epics_completed}/{metrics.epics_total} ({metrics.epic_completion_percentage:.1f}%)")
        
        if metrics.features_total > 0:
            report_lines.append(f"✨ **Features:** {metrics.features_completed}/{metrics.features_total} ({metrics.feature_completion_percentage:.1f}%)")
        
        if metrics.tasks_total > 0:
            task_completed = metrics.completed_issues - metrics.epics_completed - metrics.features_completed
            task_percentage = (task_completed / metrics.tasks_total) * 100.0 if metrics.tasks_total > 0 else 0
            report_lines.append(f"📋 **Tasks:** {task_completed}/{metrics.tasks_total} ({task_percentage:.1f}%)")
        
        report_lines.append("")
        
        # Status breakdown
        report_lines.extend([
            "**Status Breakdown:**",
            f"• In Progress: {metrics.in_progress_issues}",
            f"• Completed: {metrics.completed_issues}",
            f"• Cancelled: {metrics.cancelled_issues}"
        ])
        
        # Timing information
        if metrics.creation_started_at:
            report_lines.append("")
            report_lines.append(f"⏱️ **Started:** {metrics.creation_started_at.strftime('%Y-%m-%d %H:%M:%S UTC')}")
            
            if metrics.creation_completed_at:
                report_lines.append(f"🏁 **Completed:** {metrics.creation_completed_at.strftime('%Y-%m-%d %H:%M:%S UTC')}")
                if metrics.creation_duration_minutes:
                    report_lines.append(f"⏰ **Duration:** {metrics.creation_duration_minutes:.1f} minutes")
            
            if metrics.last_update_at and not metrics.creation_completed_at:
                report_lines.append(f"🔄 **Last Update:** {metrics.last_update_at.strftime('%Y-%m-%d %H:%M:%S UTC')}")
        
        return "\n".join(report_lines)
    
    def _update_status_counts(self, status: IssueStatus, increment: bool) -> None:
        """Update status-specific counts."""
        delta = 1 if increment else -1
        
        if status == IssueStatus.IN_PROGRESS:
            self._metrics.in_progress_issues += delta
        elif status == IssueStatus.DONE:
            self._metrics.completed_issues += delta
        elif status == IssueStatus.CANCELLED:
            self._metrics.cancelled_issues += delta
    
    def _mark_creation_complete(self) -> None:
        """Mark the creation process as complete."""
        self._metrics.creation_completed_at = datetime.now(timezone.utc)
        
        progress_update = ProgressUpdate(
            event_type=ProgressEvent.PROGRESS_MILESTONE,
            issue_id="creation_complete",
            issue_number=None,
            old_status=None,
            new_status=None,
            timestamp=self._metrics.creation_completed_at,
            message=f"Issue creation completed: {self._metrics.created_issues} issues created",
            metadata={
                "duration_minutes": self._metrics.creation_duration_minutes
            }
        )
        
        self.logger.info(f"Issue creation completed: {self._metrics.created_issues} issues created in {self._metrics.creation_duration_minutes:.1f} minutes")
        self._progress_history.append(progress_update)
        self._notify_progress(progress_update)
    
    def _check_hierarchy_completion(self) -> None:
        """Check if the entire hierarchy is completed."""
        if self._metrics.completed_issues == self._metrics.total_issues:
            progress_update = ProgressUpdate(
                event_type=ProgressEvent.HIERARCHY_COMPLETED,
                issue_id="hierarchy_complete",
                issue_number=None,
                old_status=None,
                new_status=None,
                timestamp=datetime.now(timezone.utc),
                message="All issues in hierarchy completed",
                metadata={
                    "total_issues": self._metrics.total_issues,
                    "completion_percentage": 100.0
                }
            )
            
            self.logger.info("Hierarchy completion: All issues completed!")
            self._progress_history.append(progress_update)
            self._notify_progress(progress_update)
    
    def _notify_progress(self, update: ProgressUpdate) -> None:
        """Notify all registered callbacks of progress update."""
        for callback in self._callbacks:
            try:
                callback(update, self._metrics)
            except Exception as e:
                self.logger.warning(f"Progress callback failed: {e}")


class ProgressReporter:
    """
    Generates formatted progress reports for different audiences.
    """
    
    @staticmethod
    def create_slack_message(tracker: ProgressTracker) -> str:
        """Create a Slack-formatted progress message."""
        metrics = tracker.get_current_metrics()
        
        # Status emoji
        if metrics.completion_percentage >= 100:
            status_emoji = "🎉"
        elif metrics.completion_percentage >= 75:
            status_emoji = "🚀"
        elif metrics.completion_percentage >= 50:
            status_emoji = "⚡"
        else:
            status_emoji = "🔧"
        
        message_parts = [
            f"{status_emoji} **Issue Creation Progress**",
            f"Progress: {metrics.completion_percentage:.1f}% ({metrics.completed_issues}/{metrics.total_issues})"
        ]
        
        if metrics.epics_total > 0:
            message_parts.append(f"Epics: {metrics.epic_completion_percentage:.1f}%")
        
        if metrics.features_total > 0:
            message_parts.append(f"Features: {metrics.feature_completion_percentage:.1f}%")
        
        if metrics.creation_duration_minutes:
            message_parts.append(f"Duration: {metrics.creation_duration_minutes:.1f}min")
        
        return " • ".join(message_parts)
    
    @staticmethod
    def create_dashboard_data(tracker: ProgressTracker) -> Dict[str, Any]:
        """Create structured data for dashboard display."""
        return {
            "summary": tracker.get_progress_summary(),
            "chart_data": {
                "completion_by_type": [
                    {"type": "Epics", "completed": tracker._metrics.epics_completed, "total": tracker._metrics.epics_total},
                    {"type": "Features", "completed": tracker._metrics.features_completed, "total": tracker._metrics.features_total},
                    {"type": "Tasks", "completed": tracker._metrics.completed_issues - tracker._metrics.epics_completed - tracker._metrics.features_completed, "total": tracker._metrics.tasks_total}
                ],
                "status_distribution": [
                    {"status": "In Progress", "count": tracker._metrics.in_progress_issues},
                    {"status": "Completed", "count": tracker._metrics.completed_issues},
                    {"status": "Cancelled", "count": tracker._metrics.cancelled_issues}
                ]
            }
        }


# Utility function
def create_progress_tracker() -> ProgressTracker:
    """Create a new progress tracker instance."""
    return ProgressTracker()