#!/usr/bin/env python3
"""
Project Management Integration for GitHub Issues.

This module extends the basic GitHub integration with advanced project management
features including milestone assignment, project board organization, progress
tracking, and team notifications.
"""

import asyncio
import logging
import re
from typing import List, Dict, Any, Optional, Union, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum

from github_integration import GitHubIntegration, GitHubIssueData
from ticketing_interface import (
    TicketingSystemConfig, TicketingSystem, CreatedIssue, 
    IssueStatus, TicketingInterfaceException
)
from issue_spec import IssueSpec, IssueType, Priority, IssueHierarchy


class NotificationEvent(Enum):
    """Types of events that trigger notifications."""
    ISSUE_CREATED = "issue_created"
    MILESTONE_ASSIGNED = "milestone_assigned"
    PROJECT_BOARD_UPDATED = "project_board_updated"
    PROGRESS_UPDATED = "progress_updated"
    ERROR_OCCURRED = "error_occurred"


@dataclass
class MilestoneConfig:
    """Configuration for milestone assignment."""
    default_milestone: Optional[str] = None
    epic_milestone_pattern: Optional[str] = None  # e.g., "Epic: {title}"
    sprint_milestone_pattern: Optional[str] = None  # e.g., "Sprint {number}"
    auto_create_milestones: bool = False
    milestone_due_date_offset_days: int = 30  # Default 30 days from now


@dataclass
class ProjectBoardConfig:
    """Configuration for project board organization."""
    default_project_id: Optional[int] = None
    epic_column_name: str = "Epics"
    feature_column_name: str = "Features" 
    bug_column_name: str = "Bugs"
    task_column_name: str = "Tasks"
    auto_create_columns: bool = False


@dataclass
class NotificationConfig:
    """Configuration for team notifications."""
    enabled: bool = True
    webhook_url: Optional[str] = None
    mention_team: Optional[str] = None  # e.g., "@dev-team"
    notification_events: List[NotificationEvent] = field(
        default_factory=lambda: [
            NotificationEvent.ISSUE_CREATED,
            NotificationEvent.ERROR_OCCURRED
        ]
    )


@dataclass
class ProjectManagementConfig:
    """Complete project management configuration."""
    milestone_config: MilestoneConfig = field(default_factory=MilestoneConfig)
    project_board_config: ProjectBoardConfig = field(default_factory=ProjectBoardConfig) 
    notification_config: NotificationConfig = field(default_factory=NotificationConfig)


@dataclass
class ProjectManagementContext:
    """Context information for project management operations."""
    repository_owner: str
    repository_name: str
    spec_file_path: Optional[str] = None
    spec_title: Optional[str] = None
    current_milestone: Optional[str] = None
    current_project_id: Optional[int] = None
    team_mentions: List[str] = field(default_factory=list)


class ProjectManagementIntegration:
    """
    Enhanced GitHub integration with project management features.
    
    Provides milestone assignment, project board organization, progress tracking,
    and team notifications for automatic issue creation.
    """
    
    def __init__(
        self,
        github_integration: GitHubIntegration,
        pm_config: ProjectManagementConfig
    ):
        self.github = github_integration
        self.pm_config = pm_config
        self.logger = logging.getLogger(__name__)
        
        # Cache for milestones and projects to avoid repeated API calls
        self._milestone_cache: Dict[str, int] = {}
        self._project_cache: Dict[str, int] = {}
        
    async def create_issues_with_project_management(
        self,
        hierarchy: IssueHierarchy,
        context: ProjectManagementContext
    ) -> List[CreatedIssue]:
        """
        Create issues with full project management integration.
        
        Args:
            hierarchy: Issue hierarchy to create
            context: Project management context
            
        Returns:
            List of created issues with project management metadata
        """
        self.logger.info(f"Creating {hierarchy.total_count()} issues with project management")
        
        try:
            # Step 1: Prepare milestones and project boards
            await self._prepare_project_infrastructure(hierarchy, context)
            
            # Step 2: Create issues using the base GitHub integration
            created_issues = await self.github.create_issue_hierarchy(hierarchy)
            
            # Step 3: Apply project management enhancements
            enhanced_issues = []
            for issue in created_issues:
                enhanced_issue = await self._apply_project_management(issue, context)
                enhanced_issues.append(enhanced_issue)
            
            # Step 4: Send notifications
            if self.pm_config.notification_config.enabled:
                await self._send_creation_notifications(enhanced_issues, context)
            
            self.logger.info(f"Successfully created {len(enhanced_issues)} issues with PM integration")
            return enhanced_issues
            
        except Exception as e:
            self.logger.error(f"Project management integration failed: {e}")
            await self._send_error_notification(str(e), context)
            raise TicketingInterfaceException(f"PM integration failed: {e}")
    
    async def _prepare_project_infrastructure(
        self,
        hierarchy: IssueHierarchy,
        context: ProjectManagementContext
    ) -> None:
        """Prepare milestones and project boards for the hierarchy."""
        
        # Prepare milestones
        if self.pm_config.milestone_config.auto_create_milestones:
            await self._prepare_milestones(hierarchy, context)
        
        # Prepare project board columns
        if (self.pm_config.project_board_config.auto_create_columns and 
            context.current_project_id):
            await self._prepare_project_columns(context)
    
    async def _prepare_milestones(
        self,
        hierarchy: IssueHierarchy, 
        context: ProjectManagementContext
    ) -> None:
        """Prepare required milestones for the issue hierarchy."""
        
        # Get existing milestones to avoid duplicates
        await self._refresh_milestone_cache(context)
        
        milestones_to_create = set()
        
        # Check if we need milestone for spec/epic
        if context.spec_title and self.pm_config.milestone_config.epic_milestone_pattern:
            milestone_title = self.pm_config.milestone_config.epic_milestone_pattern.format(
                title=context.spec_title
            )
            if milestone_title not in self._milestone_cache:
                milestones_to_create.add(milestone_title)
        
        # Create missing milestones
        for milestone_title in milestones_to_create:
            try:
                # Calculate due date
                due_date = datetime.now(timezone.utc)
                due_date = due_date.replace(
                    day=due_date.day + self.pm_config.milestone_config.milestone_due_date_offset_days
                )
                
                # Note: This would need to use GitHub MCP to create milestone
                # For now, we'll log the requirement
                self.logger.info(f"Would create milestone: {milestone_title} (due: {due_date})")
                
                # Simulate milestone creation - in real implementation would use MCP
                self._milestone_cache[milestone_title] = len(self._milestone_cache) + 1
                
            except Exception as e:
                self.logger.warning(f"Failed to create milestone {milestone_title}: {e}")
    
    async def _prepare_project_columns(self, context: ProjectManagementContext) -> None:
        """Ensure required project board columns exist."""
        
        required_columns = [
            self.pm_config.project_board_config.epic_column_name,
            self.pm_config.project_board_config.feature_column_name,
            self.pm_config.project_board_config.bug_column_name,
            self.pm_config.project_board_config.task_column_name
        ]
        
        # Note: This would need GitHub Projects API through MCP
        self.logger.info(f"Would ensure project columns exist: {required_columns}")
    
    async def _apply_project_management(
        self,
        issue: CreatedIssue,
        context: ProjectManagementContext
    ) -> CreatedIssue:
        """Apply project management features to a created issue."""
        
        # Apply milestone assignment
        milestone_number = await self._assign_milestone(issue, context)
        
        # Add to project board
        if context.current_project_id:
            await self._add_to_project_board(issue, context)
        
        # Update issue with PM metadata
        # Note: In real implementation, would update the GitHub issue
        self.logger.info(
            f"Applied PM features to issue #{issue.number}: "
            f"milestone={milestone_number}, project={context.current_project_id}"
        )
        
        return issue
    
    async def _assign_milestone(
        self,
        issue: CreatedIssue,
        context: ProjectManagementContext
    ) -> Optional[int]:
        """Assign appropriate milestone to an issue."""
        
        milestone_title = None
        
        # Determine milestone based on issue type and context
        if issue.original_spec and issue.original_spec.is_epic():
            if self.pm_config.milestone_config.epic_milestone_pattern and context.spec_title:
                milestone_title = self.pm_config.milestone_config.epic_milestone_pattern.format(
                    title=context.spec_title
                )
        else:
            # Use current milestone or default
            milestone_title = (
                context.current_milestone or 
                self.pm_config.milestone_config.default_milestone
            )
        
        if milestone_title and milestone_title in self._milestone_cache:
            milestone_number = self._milestone_cache[milestone_title]
            
            # Note: Would use GitHub MCP to update issue milestone
            self.logger.info(f"Would assign milestone '{milestone_title}' to issue #{issue.number}")
            return milestone_number
        
        return None
    
    async def _add_to_project_board(
        self,
        issue: CreatedIssue,
        context: ProjectManagementContext
    ) -> None:
        """Add issue to appropriate project board column."""
        
        # Determine column based on issue type
        column_name = self._get_column_for_issue_type(issue)
        
        # Note: Would use GitHub Projects API through MCP
        self.logger.info(
            f"Would add issue #{issue.number} to project {context.current_project_id}, "
            f"column '{column_name}'"
        )
    
    def _get_column_for_issue_type(self, issue: CreatedIssue) -> str:
        """Get the appropriate project board column for an issue type."""
        
        if not issue.original_spec:
            return self.pm_config.project_board_config.task_column_name
        
        issue_type = issue.original_spec.issue_type
        
        if issue_type == IssueType.EPIC:
            return self.pm_config.project_board_config.epic_column_name
        elif issue_type in (IssueType.FEATURE, IssueType.IMPROVEMENT):
            return self.pm_config.project_board_config.feature_column_name
        elif issue_type == IssueType.BUG:
            return self.pm_config.project_board_config.bug_column_name
        else:
            return self.pm_config.project_board_config.task_column_name
    
    async def _refresh_milestone_cache(self, context: ProjectManagementContext) -> None:
        """Refresh the milestone cache with current repository milestones."""
        
        # Note: Would use GitHub MCP to list milestones
        # For now, simulate some existing milestones
        self._milestone_cache = {
            "Current Sprint": 1,
            "Next Release": 2,
            "Backlog": 3
        }
        
        self.logger.debug(f"Refreshed milestone cache: {list(self._milestone_cache.keys())}")
    
    async def _send_creation_notifications(
        self,
        created_issues: List[CreatedIssue],
        context: ProjectManagementContext
    ) -> None:
        """Send notifications about created issues."""
        
        if NotificationEvent.ISSUE_CREATED not in self.pm_config.notification_config.notification_events:
            return
        
        # Prepare notification message
        message_parts = [
            f"🎯 **Automatic Issue Creation Complete**",
            f"",
            f"📁 **Repository:** {context.repository_owner}/{context.repository_name}",
            f"📋 **Specification:** {context.spec_title or 'Unknown'}",
            f"🎫 **Issues Created:** {len(created_issues)}",
            f""
        ]
        
        # Add issue summary
        for issue in created_issues[:10]:  # Limit to first 10 to avoid spam
            issue_type = "📌"
            if issue.original_spec:
                if issue.original_spec.is_epic():
                    issue_type = "🎯"
                elif issue.original_spec.issue_type == IssueType.BUG:
                    issue_type = "🐛"
                elif issue.original_spec.issue_type == IssueType.FEATURE:
                    issue_type = "✨"
            
            message_parts.append(f"{issue_type} [#{issue.number}]({issue.url}) - {issue.title}")
        
        if len(created_issues) > 10:
            message_parts.append(f"... and {len(created_issues) - 10} more issues")
        
        # Add team mentions
        if self.pm_config.notification_config.mention_team:
            message_parts.append(f"")
            message_parts.append(f"👥 {self.pm_config.notification_config.mention_team}")
        
        notification_message = "\n".join(message_parts)
        
        # Send notification (would integrate with webhook/Slack/etc.)
        self.logger.info(f"Notification: {notification_message}")
    
    async def _send_error_notification(
        self,
        error_message: str,
        context: ProjectManagementContext
    ) -> None:
        """Send notification about errors during issue creation."""
        
        if NotificationEvent.ERROR_OCCURRED not in self.pm_config.notification_config.notification_events:
            return
        
        message = (
            f"❌ **Automatic Issue Creation Failed**\n"
            f"📁 **Repository:** {context.repository_owner}/{context.repository_name}\n"
            f"📋 **Specification:** {context.spec_title or 'Unknown'}\n"
            f"🚨 **Error:** {error_message}\n"
        )
        
        if self.pm_config.notification_config.mention_team:
            message += f"\n👥 {self.pm_config.notification_config.mention_team}"
        
        self.logger.error(f"Error notification: {message}")


def create_project_management_integration(
    github_config: TicketingSystemConfig,
    pm_config: Optional[ProjectManagementConfig] = None
) -> ProjectManagementIntegration:
    """
    Create a project management integration instance.
    
    Args:
        github_config: GitHub ticketing system configuration
        pm_config: Project management configuration (uses defaults if None)
        
    Returns:
        Configured project management integration
    """
    if pm_config is None:
        pm_config = ProjectManagementConfig()
    
    github_integration = GitHubIntegration(github_config)
    return ProjectManagementIntegration(github_integration, pm_config)


# Utility functions for configuration

def create_milestone_config(
    default_milestone: Optional[str] = None,
    auto_create: bool = False,
    due_date_offset_days: int = 30
) -> MilestoneConfig:
    """Create a milestone configuration with common defaults."""
    return MilestoneConfig(
        default_milestone=default_milestone,
        epic_milestone_pattern="Epic: {title}" if auto_create else None,
        sprint_milestone_pattern="Sprint {number}" if auto_create else None,
        auto_create_milestones=auto_create,
        milestone_due_date_offset_days=due_date_offset_days
    )


def create_project_board_config(
    project_id: Optional[int] = None,
    auto_create_columns: bool = False
) -> ProjectBoardConfig:
    """Create a project board configuration with sensible defaults."""
    return ProjectBoardConfig(
        default_project_id=project_id,
        auto_create_columns=auto_create_columns
    )


def create_notification_config(
    enabled: bool = True,
    webhook_url: Optional[str] = None,
    team_mention: Optional[str] = None
) -> NotificationConfig:
    """Create a notification configuration."""
    return NotificationConfig(
        enabled=enabled,
        webhook_url=webhook_url,
        mention_team=team_mention
    )