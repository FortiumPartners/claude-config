#!/usr/bin/env python3
"""
Team notification system for automatic issue creation.

This module provides comprehensive team notification capabilities including
Slack/Discord webhooks, email notifications, and GitHub issue comments.
"""

import asyncio
import logging
import json
import re
from typing import List, Dict, Any, Optional, Union, Set
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from urllib.parse import urljoin

from ticketing_interface import CreatedIssue, IssueStatus
from progress_tracking import ProgressUpdate, ProgressMetrics, ProgressEvent


class NotificationChannel(Enum):
    """Supported notification channels."""
    SLACK = "slack"
    DISCORD = "discord"
    TEAMS = "teams"
    EMAIL = "email"
    GITHUB_COMMENT = "github_comment"
    WEBHOOK = "webhook"


class NotificationPriority(Enum):
    """Notification priority levels."""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


@dataclass
class NotificationTemplate:
    """Template for notification messages."""
    title_template: str
    body_template: str
    channel: NotificationChannel
    priority: NotificationPriority = NotificationPriority.NORMAL
    include_metadata: bool = True
    
    def format_message(self, context: Dict[str, Any]) -> Dict[str, str]:
        """Format the notification message with context data."""
        try:
            title = self.title_template.format(**context)
            body = self.body_template.format(**context)
            return {"title": title, "body": body}
        except KeyError as e:
            raise ValueError(f"Missing template variable: {e}")


@dataclass
class NotificationConfig:
    """Configuration for team notifications."""
    # Channel configurations
    slack_webhook_url: Optional[str] = None
    discord_webhook_url: Optional[str] = None
    teams_webhook_url: Optional[str] = None
    email_config: Optional[Dict[str, Any]] = None
    
    # GitHub configuration for issue comments
    github_owner: Optional[str] = None
    github_repo: Optional[str] = None
    
    # Team configuration
    default_channels: List[NotificationChannel] = field(
        default_factory=lambda: [NotificationChannel.SLACK]
    )
    team_mentions: Dict[NotificationChannel, str] = field(default_factory=dict)
    
    # Event filtering
    enabled_events: Set[ProgressEvent] = field(
        default_factory=lambda: {
            ProgressEvent.ISSUE_CREATED,
            ProgressEvent.PROGRESS_MILESTONE,
            ProgressEvent.HIERARCHY_COMPLETED
        }
    )
    
    # Message templates
    custom_templates: Dict[str, NotificationTemplate] = field(default_factory=dict)


@dataclass
class NotificationContext:
    """Context information for notification formatting."""
    # Repository info
    repository_owner: str
    repository_name: str
    repository_url: str
    
    # Specification info
    spec_title: Optional[str] = None
    spec_file: Optional[str] = None
    
    # Progress info
    total_issues: int = 0
    created_issues: int = 0
    completion_percentage: float = 0.0
    
    # Recent issues
    recent_issues: List[CreatedIssue] = field(default_factory=list)
    
    # Timing info
    started_at: Optional[datetime] = None
    duration_minutes: Optional[float] = None
    
    # Custom variables
    custom_variables: Dict[str, Any] = field(default_factory=dict)
    
    def to_template_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for template formatting."""
        return {
            "repository_owner": self.repository_owner,
            "repository_name": self.repository_name,
            "repository_url": self.repository_url,
            "spec_title": self.spec_title or "Unknown Specification",
            "spec_file": self.spec_file or "Unknown File",
            "total_issues": self.total_issues,
            "created_issues": self.created_issues,
            "completion_percentage": self.completion_percentage,
            "started_at": self.started_at.strftime("%Y-%m-%d %H:%M:%S UTC") if self.started_at else "Unknown",
            "duration_minutes": f"{self.duration_minutes:.1f}" if self.duration_minutes else "Unknown",
            **self.custom_variables
        }


class TeamNotificationSystem:
    """
    Comprehensive team notification system.
    
    Handles notifications across multiple channels with templating,
    filtering, and formatting capabilities.
    """
    
    def __init__(self, config: NotificationConfig):
        self.config = config
        self.logger = logging.getLogger(__name__)
        
        # Built-in message templates
        self.default_templates = self._create_default_templates()
        
        # Notification queue for batching
        self._notification_queue: List[Dict[str, Any]] = []
        self._batch_timeout = 30  # seconds
        
    def _create_default_templates(self) -> Dict[str, NotificationTemplate]:
        """Create default notification templates for different events."""
        return {
            "issue_creation_started": NotificationTemplate(
                title_template="🚀 Issue Creation Started",
                body_template=(
                    "**Repository:** {repository_owner}/{repository_name}\n"
                    "**Specification:** {spec_title}\n"
                    "**Total Issues:** {total_issues}\n"
                    "**Started:** {started_at}"
                ),
                channel=NotificationChannel.SLACK,
                priority=NotificationPriority.NORMAL
            ),
            
            "issue_creation_completed": NotificationTemplate(
                title_template="✅ Issue Creation Completed",
                body_template=(
                    "**Repository:** {repository_owner}/{repository_name}\n"
                    "**Specification:** {spec_title}\n"
                    "**Issues Created:** {created_issues}/{total_issues}\n"
                    "**Duration:** {duration_minutes} minutes\n"
                    "**Success Rate:** {completion_percentage:.1f}%"
                ),
                channel=NotificationChannel.SLACK,
                priority=NotificationPriority.HIGH
            ),
            
            "progress_update": NotificationTemplate(
                title_template="📊 Progress Update",
                body_template=(
                    "**Repository:** {repository_owner}/{repository_name}\n"
                    "**Progress:** {completion_percentage:.1f}% ({created_issues}/{total_issues})\n"
                    "**Specification:** {spec_title}"
                ),
                channel=NotificationChannel.SLACK,
                priority=NotificationPriority.LOW
            ),
            
            "error_notification": NotificationTemplate(
                title_template="❌ Issue Creation Failed",
                body_template=(
                    "**Repository:** {repository_owner}/{repository_name}\n"
                    "**Specification:** {spec_title}\n"
                    "**Error:** {error_message}\n"
                    "**Time:** {started_at}"
                ),
                channel=NotificationChannel.SLACK,
                priority=NotificationPriority.URGENT
            ),
            
            "milestone_reached": NotificationTemplate(
                title_template="🎯 Milestone Reached",
                body_template=(
                    "**Milestone:** {milestone_name}\n"
                    "**Repository:** {repository_owner}/{repository_name}\n" 
                    "**Progress:** {completion_percentage:.1f}%\n"
                    "**Issues Completed:** {created_issues}/{total_issues}"
                ),
                channel=NotificationChannel.SLACK,
                priority=NotificationPriority.NORMAL
            )
        }
    
    async def notify_issue_creation_started(self, context: NotificationContext) -> None:
        """Send notification when issue creation starts."""
        if ProgressEvent.PROGRESS_MILESTONE not in self.config.enabled_events:
            return
        
        template = self._get_template("issue_creation_started")
        await self._send_notification(template, context)
    
    async def notify_issue_creation_completed(self, context: NotificationContext) -> None:
        """Send notification when issue creation completes."""
        if ProgressEvent.HIERARCHY_COMPLETED not in self.config.enabled_events:
            return
        
        template = self._get_template("issue_creation_completed")
        await self._send_notification(template, context)
    
    async def notify_progress_update(
        self, 
        context: NotificationContext,
        update: ProgressUpdate
    ) -> None:
        """Send progress update notification."""
        if update.event_type not in self.config.enabled_events:
            return
        
        # Add update-specific context
        update_context = context.to_template_dict()
        update_context.update({
            "update_message": update.message,
            "update_timestamp": update.timestamp.strftime("%Y-%m-%d %H:%M:%S UTC"),
            "issue_number": update.issue_number,
        })
        
        template = self._get_template("progress_update")
        formatted_context = NotificationContext(**{
            k: v for k, v in update_context.items() 
            if k in NotificationContext.__dataclass_fields__
        })
        formatted_context.custom_variables = update_context
        
        await self._send_notification(template, formatted_context)
    
    async def notify_error(
        self,
        context: NotificationContext, 
        error_message: str
    ) -> None:
        """Send error notification."""
        error_context = context.to_template_dict()
        error_context["error_message"] = error_message
        
        formatted_context = NotificationContext(**{
            k: v for k, v in error_context.items()
            if k in NotificationContext.__dataclass_fields__
        })
        formatted_context.custom_variables = error_context
        
        template = self._get_template("error_notification")
        await self._send_notification(template, formatted_context)
    
    async def notify_milestone_reached(
        self,
        context: NotificationContext,
        milestone_name: str
    ) -> None:
        """Send milestone notification."""
        milestone_context = context.to_template_dict()
        milestone_context["milestone_name"] = milestone_name
        
        formatted_context = NotificationContext(**{
            k: v for k, v in milestone_context.items()
            if k in NotificationContext.__dataclass_fields__
        })
        formatted_context.custom_variables = milestone_context
        
        template = self._get_template("milestone_reached")
        await self._send_notification(template, formatted_context)
    
    async def notify_issues_created_batch(
        self,
        context: NotificationContext,
        created_issues: List[CreatedIssue]
    ) -> None:
        """Send batch notification for multiple created issues."""
        if ProgressEvent.ISSUE_CREATED not in self.config.enabled_events:
            return
        
        # Create issue summary
        issue_summary = []
        for issue in created_issues[:10]:  # Limit to first 10
            issue_emoji = self._get_issue_emoji(issue)
            issue_summary.append(f"{issue_emoji} [#{issue.number}]({issue.url}) - {issue.title}")
        
        if len(created_issues) > 10:
            issue_summary.append(f"... and {len(created_issues) - 10} more issues")
        
        # Create custom template for batch
        batch_template = NotificationTemplate(
            title_template=f"🎫 {len(created_issues)} Issues Created",
            body_template=(
                "**Repository:** {repository_owner}/{repository_name}\n"
                "**Specification:** {spec_title}\n"
                "**Issues Created:** {created_issues}\n"
                "\n**Issues:**\n{issue_list}"
            ),
            channel=NotificationChannel.SLACK,
            priority=NotificationPriority.HIGH
        )
        
        # Add issue list to context
        batch_context = context.to_template_dict()
        batch_context["created_issues"] = len(created_issues)
        batch_context["issue_list"] = "\n".join(issue_summary)
        
        formatted_context = NotificationContext(**{
            k: v for k, v in batch_context.items()
            if k in NotificationContext.__dataclass_fields__
        })
        formatted_context.custom_variables = batch_context
        
        await self._send_notification(batch_template, formatted_context)
    
    def _get_issue_emoji(self, issue: CreatedIssue) -> str:
        """Get appropriate emoji for issue type."""
        if not issue.original_spec:
            return "📌"
        
        issue_type = issue.original_spec.issue_type
        if issue.original_spec.is_epic():
            return "🎯"
        elif issue_type.value == "bug":
            return "🐛"
        elif issue_type.value == "feature":
            return "✨"
        elif issue_type.value == "improvement":
            return "⚡"
        else:
            return "📋"
    
    def _get_template(self, template_name: str) -> NotificationTemplate:
        """Get notification template by name."""
        # Check custom templates first
        if template_name in self.config.custom_templates:
            return self.config.custom_templates[template_name]
        
        # Fall back to default templates
        if template_name in self.default_templates:
            return self.default_templates[template_name]
        
        # Create basic template if not found
        return NotificationTemplate(
            title_template="Notification",
            body_template="Event: {event_type}",
            channel=NotificationChannel.SLACK
        )
    
    async def _send_notification(
        self,
        template: NotificationTemplate,
        context: NotificationContext
    ) -> None:
        """Send notification using specified template and context."""
        try:
            # Format the message
            template_dict = context.to_template_dict()
            message_data = template.format_message(template_dict)
            
            # Send to configured channels
            for channel in self.config.default_channels:
                if channel == template.channel or channel in [NotificationChannel.SLACK, NotificationChannel.WEBHOOK]:
                    await self._send_to_channel(channel, message_data, template.priority)
        
        except Exception as e:
            self.logger.error(f"Failed to send notification: {e}")
    
    async def _send_to_channel(
        self,
        channel: NotificationChannel,
        message_data: Dict[str, str],
        priority: NotificationPriority
    ) -> None:
        """Send message to specific notification channel."""
        
        if channel == NotificationChannel.SLACK and self.config.slack_webhook_url:
            await self._send_slack_message(message_data, priority)
        
        elif channel == NotificationChannel.DISCORD and self.config.discord_webhook_url:
            await self._send_discord_message(message_data, priority)
        
        elif channel == NotificationChannel.TEAMS and self.config.teams_webhook_url:
            await self._send_teams_message(message_data, priority)
        
        elif channel == NotificationChannel.GITHUB_COMMENT:
            await self._send_github_comment(message_data)
        
        else:
            # Log for channels that aren't configured
            self.logger.info(
                f"Would send {channel.value} notification: {message_data['title']} - {message_data['body']}"
            )
    
    async def _send_slack_message(
        self,
        message_data: Dict[str, str],
        priority: NotificationPriority
    ) -> None:
        """Send message to Slack webhook."""
        # Format Slack message
        slack_payload = {
            "text": message_data["title"],
            "attachments": [
                {
                    "color": self._get_color_for_priority(priority),
                    "text": message_data["body"],
                    "mrkdwn_in": ["text"]
                }
            ]
        }
        
        # Add team mention if configured
        if NotificationChannel.SLACK in self.config.team_mentions:
            mention = self.config.team_mentions[NotificationChannel.SLACK]
            slack_payload["text"] += f" {mention}"
        
        # In real implementation, would send HTTP POST to webhook
        self.logger.info(f"Slack notification: {slack_payload['text']}")
    
    async def _send_discord_message(
        self,
        message_data: Dict[str, str],
        priority: NotificationPriority
    ) -> None:
        """Send message to Discord webhook."""
        discord_payload = {
            "embeds": [
                {
                    "title": message_data["title"],
                    "description": message_data["body"],
                    "color": self._get_discord_color_for_priority(priority)
                }
            ]
        }
        
        # Add team mention if configured
        if NotificationChannel.DISCORD in self.config.team_mentions:
            mention = self.config.team_mentions[NotificationChannel.DISCORD]
            discord_payload["content"] = mention
        
        self.logger.info(f"Discord notification: {message_data['title']}")
    
    async def _send_teams_message(
        self,
        message_data: Dict[str, str], 
        priority: NotificationPriority
    ) -> None:
        """Send message to Microsoft Teams webhook."""
        teams_payload = {
            "@type": "MessageCard",
            "@context": "http://schema.org/extensions",
            "themeColor": self._get_color_for_priority(priority),
            "summary": message_data["title"],
            "sections": [
                {
                    "activityTitle": message_data["title"],
                    "activityText": message_data["body"],
                    "markdown": True
                }
            ]
        }
        
        self.logger.info(f"Teams notification: {message_data['title']}")
    
    async def _send_github_comment(self, message_data: Dict[str, str]) -> None:
        """Send notification as GitHub issue comment."""
        if not self.config.github_owner or not self.config.github_repo:
            return
        
        # Would use GitHub MCP to add comment to issue
        comment_body = f"## {message_data['title']}\n\n{message_data['body']}"
        
        self.logger.info(f"GitHub comment notification: {message_data['title']}")
    
    def _get_color_for_priority(self, priority: NotificationPriority) -> str:
        """Get color hex code for priority level."""
        color_map = {
            NotificationPriority.LOW: "#36a64f",      # Green
            NotificationPriority.NORMAL: "#2196F3",  # Blue  
            NotificationPriority.HIGH: "#ff9800",    # Orange
            NotificationPriority.URGENT: "#f44336"   # Red
        }
        return color_map.get(priority, "#2196F3")
    
    def _get_discord_color_for_priority(self, priority: NotificationPriority) -> int:
        """Get Discord color integer for priority level."""
        color_map = {
            NotificationPriority.LOW: 0x36a64f,      # Green
            NotificationPriority.NORMAL: 0x2196F3,  # Blue
            NotificationPriority.HIGH: 0xff9800,    # Orange  
            NotificationPriority.URGENT: 0xf44336   # Red
        }
        return color_map.get(priority, 0x2196F3)


# Factory functions

def create_slack_notification_config(
    webhook_url: str,
    team_mention: Optional[str] = None
) -> NotificationConfig:
    """Create notification config for Slack."""
    config = NotificationConfig(
        slack_webhook_url=webhook_url,
        default_channels=[NotificationChannel.SLACK]
    )
    
    if team_mention:
        config.team_mentions[NotificationChannel.SLACK] = team_mention
    
    return config


def create_discord_notification_config(
    webhook_url: str,
    team_mention: Optional[str] = None
) -> NotificationConfig:
    """Create notification config for Discord."""
    config = NotificationConfig(
        discord_webhook_url=webhook_url,
        default_channels=[NotificationChannel.DISCORD]
    )
    
    if team_mention:
        config.team_mentions[NotificationChannel.DISCORD] = team_mention
    
    return config


def create_github_notification_config(
    owner: str,
    repo: str
) -> NotificationConfig:
    """Create notification config for GitHub comments."""
    return NotificationConfig(
        github_owner=owner,
        github_repo=repo,
        default_channels=[NotificationChannel.GITHUB_COMMENT]
    )


def create_multi_channel_config(
    slack_webhook: Optional[str] = None,
    discord_webhook: Optional[str] = None,
    github_owner: Optional[str] = None,
    github_repo: Optional[str] = None
) -> NotificationConfig:
    """Create notification config for multiple channels."""
    channels = []
    config = NotificationConfig()
    
    if slack_webhook:
        config.slack_webhook_url = slack_webhook
        channels.append(NotificationChannel.SLACK)
    
    if discord_webhook:
        config.discord_webhook_url = discord_webhook
        channels.append(NotificationChannel.DISCORD)
    
    if github_owner and github_repo:
        config.github_owner = github_owner
        config.github_repo = github_repo
        channels.append(NotificationChannel.GITHUB_COMMENT)
    
    config.default_channels = channels
    return config