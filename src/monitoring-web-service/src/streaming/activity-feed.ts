/**
 * Activity Feed - Sprint 5 Task 5.3
 * Live activity feed updates for real-time user engagement tracking
 * 
 * Features:
 * - Real-time activity streaming
 * - Activity aggregation and filtering
 * - Multi-tenant activity isolation
 * - Activity analytics and insights
 * - Feed personalization and relevance scoring
 * - Activity history and replay
 */

import { EventPublisher, EventType, EventPriority } from '../events/event-publisher';
import { RedisManager } from '../config/redis.config';
import { DatabaseConnection } from '../database/connection';
import * as winston from 'winston';
import EventEmitter from 'events';

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  organizationId: string;
  userId: string;
  userName: string;
  userRole: string;
  targetId?: string;
  targetType?: string;
  action: string;
  description: string;
  metadata: {
    timestamp: Date;
    source: string;
    ipAddress?: string;
    userAgent?: string;
    duration?: number;
    success?: boolean;
    details?: Record<string, any>;
    tags?: string[];
  };
  relevanceScore: number;
  visibility: 'public' | 'organization' | 'team' | 'private';
}

export type ActivityType = 
  | 'dashboard_view'
  | 'dashboard_edit'
  | 'dashboard_create'
  | 'dashboard_delete'
  | 'dashboard_share'
  | 'metric_query'
  | 'metric_alert'
  | 'user_login'
  | 'user_logout'
  | 'collaboration_start'
  | 'collaboration_end'
  | 'data_export'
  | 'config_change'
  | 'system_event'
  | 'custom';

export interface ActivityFeed {
  organizationId: string;
  userId?: string; // If null, it's an organization-wide feed
  activities: ActivityEvent[];
  filters: ActivityFilter;
  lastUpdated: Date;
  totalCount: number;
  unreadCount: number;
}

export interface ActivityFilter {
  types?: ActivityType[];
  users?: string[];
  timeRange?: {
    start: Date;
    end: Date;
  };
  tags?: string[];
  minimumRelevance?: number;
  visibility?: ('public' | 'organization' | 'team' | 'private')[];
}

export interface ActivityInsights {
  organizationId: string;
  period: {
    start: Date;
    end: Date;
  };
  totalActivities: number;
  activitiesByType: Record<ActivityType, number>;
  activitiesByHour: Record<string, number>;
  topUsers: Array<{
    userId: string;
    userName: string;
    activityCount: number;
    lastActivity: Date;
  }>;
  popularDashboards: Array<{
    dashboardId: string;
    dashboardName?: string;
    viewCount: number;
    editCount: number;
  }>;
  collaborationStats: {
    sessionsStarted: number;
    totalDuration: number;
    averageDuration: number;
    participantCount: number;
  };
}

export class ActivityFeed extends EventEmitter {
  private feeds: Map<string, ActivityFeed> = new Map(); // feedKey -> feed
  private recentActivities: Map<string, ActivityEvent[]> = new Map(); // orgId -> recent activities
  private activityIndex: Map<string, Set<string>> = new Map(); // userId -> activity IDs
  private relevanceCache: Map<string, number> = new Map(); // activityId -> relevance score

  constructor(
    private eventPublisher: EventPublisher,
    private redisManager: RedisManager,
    private db: DatabaseConnection,
    private logger: winston.Logger,
    private config: {
      maxFeedSize: number;
      recentActivityWindow: number; // milliseconds
      relevanceThreshold: number;
      insightsPeriod: number; // milliseconds
      enableAnalytics: boolean;
      enablePersonalization: boolean;
    }
  ) {
    super();
    
    this.startBackgroundProcessing();
  }

  /**
   * Add activity to feed
   */
  async addActivity(activity: Omit<ActivityEvent, 'id' | 'relevanceScore'>): Promise<{
    success: boolean;
    activityId?: string;
    feedsUpdated: number;
    error?: string;
  }> {
    try {
      // Generate activity ID
      const activityId = this.generateActivityId();
      
      // Calculate relevance score
      const relevanceScore = await this.calculateRelevanceScore(activity);
      
      // Create complete activity event
      const completeActivity: ActivityEvent = {
        ...activity,
        id: activityId,
        relevanceScore
      };

      // Store activity
      await this.storeActivity(completeActivity);

      // Add to recent activities cache
      this.addToRecentActivities(completeActivity);

      // Update user activity index
      this.updateActivityIndex(completeActivity);

      // Update relevant feeds
      const feedsUpdated = await this.updateFeeds(completeActivity);

      // Publish activity event
      await this.publishActivityEvent(completeActivity);

      this.logger.debug('Activity added to feed', {
        activityId,
        type: activity.type,
        userId: activity.userId,
        organizationId: activity.organizationId,
        relevanceScore,
        feedsUpdated
      });

      return {
        success: true,
        activityId,
        feedsUpdated
      };

    } catch (error) {
      this.logger.error('Failed to add activity:', error);
      return {
        success: false,
        feedsUpdated: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get activity feed for user or organization
   */
  async getActivityFeed(
    organizationId: string,
    userId?: string,
    options: {
      limit?: number;
      offset?: number;
      filters?: ActivityFilter;
      includeRead?: boolean;
    } = {}
  ): Promise<{
    feed: ActivityEvent[];
    totalCount: number;
    unreadCount: number;
    hasMore: boolean;
    lastUpdated: Date;
  }> {
    try {
      const feedKey = this.generateFeedKey(organizationId, userId);
      const limit = options.limit || 50;
      const offset = options.offset || 0;

      // Get or create feed
      let feed = this.feeds.get(feedKey);
      if (!feed) {
        feed = await this.createFeed(organizationId, userId, options.filters);
        this.feeds.set(feedKey, feed);
      }

      // Apply additional filters if provided
      let filteredActivities = feed.activities;
      if (options.filters) {
        filteredActivities = this.applyFilters(feed.activities, options.filters);
      }

      // Apply pagination
      const paginatedActivities = filteredActivities
        .slice(offset, offset + limit);

      // Mark activities as read if requested
      if (!options.includeRead && userId) {
        await this.markActivitiesAsRead(userId, paginatedActivities.map(a => a.id));
      }

      return {
        feed: paginatedActivities,
        totalCount: filteredActivities.length,
        unreadCount: feed.unreadCount,
        hasMore: offset + limit < filteredActivities.length,
        lastUpdated: feed.lastUpdated
      };

    } catch (error) {
      this.logger.error('Failed to get activity feed:', error);
      return {
        feed: [],
        totalCount: 0,
        unreadCount: 0,
        hasMore: false,
        lastUpdated: new Date()
      };
    }
  }

  /**
   * Get activity insights for organization
   */
  async getActivityInsights(
    organizationId: string,
    period?: { start: Date; end: Date }
  ): Promise<ActivityInsights | null> {
    try {
      const actualPeriod = period || {
        start: new Date(Date.now() - this.config.insightsPeriod),
        end: new Date()
      };

      // Get activities from cache or database
      const activities = await this.getActivitiesInPeriod(organizationId, actualPeriod);

      // Calculate insights
      const insights: ActivityInsights = {
        organizationId,
        period: actualPeriod,
        totalActivities: activities.length,
        activitiesByType: this.calculateActivitiesByType(activities),
        activitiesByHour: this.calculateActivitiesByHour(activities),
        topUsers: await this.calculateTopUsers(activities),
        popularDashboards: this.calculatePopularDashboards(activities),
        collaborationStats: this.calculateCollaborationStats(activities)
      };

      // Cache insights
      await this.cacheInsights(organizationId, insights);

      return insights;

    } catch (error) {
      this.logger.error('Failed to get activity insights:', error);
      return null;
    }
  }

  /**
   * Subscribe to live activity updates
   */
  async subscribeToActivityUpdates(
    organizationId: string,
    userId?: string,
    filters?: ActivityFilter
  ): Promise<{
    success: boolean;
    subscriptionId?: string;
  }> {
    try {
      // Set up real-time subscription through event publisher
      const rooms = [`org:${organizationId}:activity`];
      if (userId) {
        rooms.push(`user:${userId}:activity`);
      }

      const subscriptionResult = await this.eventPublisher.publishEvent({
        type: 'user_activity' as EventType,
        source: 'activity-feed',
        organizationId,
        userId,
        data: {
          action: 'subscribe',
          filters,
          rooms
        },
        routing: { rooms },
        priority: 'low' as EventPriority,
        tags: ['activity', 'subscription']
      });

      return {
        success: subscriptionResult.success,
        subscriptionId: subscriptionResult.eventId
      };

    } catch (error) {
      this.logger.error('Failed to subscribe to activity updates:', error);
      return { success: false };
    }
  }

  /**
   * Track dashboard activity
   */
  async trackDashboardActivity(
    organizationId: string,
    userId: string,
    userName: string,
    userRole: string,
    dashboardId: string,
    action: 'view' | 'edit' | 'create' | 'delete' | 'share',
    metadata: Record<string, any> = {}
  ): Promise<void> {
    const activityType: ActivityType = `dashboard_${action}` as ActivityType;
    
    await this.addActivity({
      type: activityType,
      organizationId,
      userId,
      userName,
      userRole,
      targetId: dashboardId,
      targetType: 'dashboard',
      action,
      description: this.generateActivityDescription(activityType, userName, metadata),
      metadata: {
        timestamp: new Date(),
        source: 'dashboard-service',
        details: metadata,
        tags: ['dashboard', action]
      },
      visibility: 'organization'
    });
  }

  /**
   * Track collaboration activity
   */
  async trackCollaborationActivity(
    organizationId: string,
    userId: string,
    userName: string,
    userRole: string,
    sessionId: string,
    action: 'start' | 'end' | 'join' | 'leave',
    collaborators?: string[],
    duration?: number
  ): Promise<void> {
    const activityType: ActivityType = action === 'start' || action === 'end' 
      ? `collaboration_${action}` as ActivityType 
      : 'collaboration_start';

    await this.addActivity({
      type: activityType,
      organizationId,
      userId,
      userName,
      userRole,
      targetId: sessionId,
      targetType: 'collaboration_session',
      action,
      description: this.generateCollaborationDescription(action, userName, collaborators),
      metadata: {
        timestamp: new Date(),
        source: 'collaboration-service',
        duration,
        details: {
          sessionId,
          collaborators: collaborators || [],
          participantCount: (collaborators?.length || 0) + 1
        },
        tags: ['collaboration', action]
      },
      visibility: 'organization'
    });
  }

  /**
   * Private helper methods
   */
  private async calculateRelevanceScore(activity: Omit<ActivityEvent, 'id' | 'relevanceScore'>): Promise<number> {
    let score = 50; // Base score

    // Activity type scoring
    const typeScores: Record<ActivityType, number> = {
      dashboard_create: 90,
      dashboard_delete: 85,
      collaboration_start: 80,
      dashboard_edit: 70,
      dashboard_share: 60,
      config_change: 75,
      metric_alert: 95,
      dashboard_view: 30,
      metric_query: 25,
      user_login: 20,
      user_logout: 15,
      collaboration_end: 40,
      data_export: 50,
      system_event: 60,
      custom: 50
    };

    score = typeScores[activity.type] || 50;

    // User role boost
    if (activity.userRole === 'admin') score += 20;
    else if (activity.userRole === 'manager') score += 10;

    // Recency boost (more recent activities score higher)
    const hoursAgo = (Date.now() - activity.metadata.timestamp.getTime()) / (1000 * 60 * 60);
    if (hoursAgo < 1) score += 20;
    else if (hoursAgo < 6) score += 10;
    else if (hoursAgo < 24) score += 5;

    // Success/failure impact
    if (activity.metadata.success === false) score += 15; // Failed actions are more noteworthy
    
    // Collaboration boost (activities involving multiple users are more relevant)
    const collaboratorCount = activity.metadata.details?.participantCount || 1;
    if (collaboratorCount > 1) score += Math.min(collaboratorCount * 5, 25);

    return Math.min(Math.max(score, 0), 100);
  }

  private async storeActivity(activity: ActivityEvent): Promise<void> {
    try {
      // Store in Redis for quick access
      const key = `activity:${activity.organizationId}:${activity.id}`;
      await this.redisManager.client.setex(
        key, 
        86400 * 7, // 7 days TTL
        JSON.stringify(activity)
      );

      // Add to sorted set for time-based queries
      const timelineKey = `timeline:${activity.organizationId}`;
      await this.redisManager.client.zadd(
        timelineKey,
        activity.metadata.timestamp.getTime(),
        activity.id
      );

      // Set expiration on timeline
      await this.redisManager.client.expire(timelineKey, 86400 * 30); // 30 days

      // Store in database for long-term retention
      if (this.config.enableAnalytics) {
        await this.storeActivityInDatabase(activity);
      }

    } catch (error) {
      this.logger.warn('Failed to store activity:', error);
    }
  }

  private async storeActivityInDatabase(activity: ActivityEvent): Promise<void> {
    try {
      const query = `
        INSERT INTO activity_log (
          id, type, organization_id, user_id, user_name, user_role,
          target_id, target_type, action, description, metadata,
          relevance_score, visibility, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `;

      await this.db.query(query, [
        activity.id,
        activity.type,
        activity.organizationId,
        activity.userId,
        activity.userName,
        activity.userRole,
        activity.targetId,
        activity.targetType,
        activity.action,
        activity.description,
        JSON.stringify(activity.metadata),
        activity.relevanceScore,
        activity.visibility,
        activity.metadata.timestamp
      ]);

    } catch (error) {
      this.logger.warn('Failed to store activity in database:', error);
    }
  }

  private addToRecentActivities(activity: ActivityEvent): void {
    if (!this.recentActivities.has(activity.organizationId)) {
      this.recentActivities.set(activity.organizationId, []);
    }

    const activities = this.recentActivities.get(activity.organizationId)!;
    activities.unshift(activity);

    // Keep only recent activities
    const cutoff = Date.now() - this.config.recentActivityWindow;
    const filtered = activities.filter(a => a.metadata.timestamp.getTime() > cutoff);
    
    this.recentActivities.set(activity.organizationId, filtered.slice(0, 1000)); // Max 1000 recent
  }

  private updateActivityIndex(activity: ActivityEvent): void {
    if (!this.activityIndex.has(activity.userId)) {
      this.activityIndex.set(activity.userId, new Set());
    }
    
    this.activityIndex.get(activity.userId)!.add(activity.id);
  }

  private async updateFeeds(activity: ActivityEvent): Promise<number> {
    let feedsUpdated = 0;

    // Update organization feed
    const orgFeedKey = this.generateFeedKey(activity.organizationId);
    await this.addActivityToFeed(orgFeedKey, activity);
    feedsUpdated++;

    // Update user-specific feeds if personalization is enabled
    if (this.config.enablePersonalization) {
      // Get relevant users for this activity
      const relevantUsers = await this.getRelevantUsers(activity);
      
      for (const userId of relevantUsers) {
        const userFeedKey = this.generateFeedKey(activity.organizationId, userId);
        await this.addActivityToFeed(userFeedKey, activity);
        feedsUpdated++;
      }
    }

    return feedsUpdated;
  }

  private async addActivityToFeed(feedKey: string, activity: ActivityEvent): Promise<void> {
    let feed = this.feeds.get(feedKey);
    if (!feed) {
      feed = {
        organizationId: activity.organizationId,
        userId: feedKey.includes(':user:') ? feedKey.split(':user:')[1] : undefined,
        activities: [],
        filters: {},
        lastUpdated: new Date(),
        totalCount: 0,
        unreadCount: 0
      };
      this.feeds.set(feedKey, feed);
    }

    // Add activity if it meets relevance threshold
    if (activity.relevanceScore >= this.config.relevanceThreshold) {
      feed.activities.unshift(activity);
      feed.totalCount++;
      feed.unreadCount++;
      feed.lastUpdated = new Date();

      // Trim feed to max size
      if (feed.activities.length > this.config.maxFeedSize) {
        feed.activities = feed.activities.slice(0, this.config.maxFeedSize);
      }
    }
  }

  private async publishActivityEvent(activity: ActivityEvent): Promise<void> {
    try {
      await this.eventPublisher.publishUserActivity(
        activity.organizationId,
        activity.userId,
        activity.action,
        {
          activityId: activity.id,
          type: activity.type,
          description: activity.description,
          targetId: activity.targetId,
          targetType: activity.targetType,
          relevanceScore: activity.relevanceScore,
          visibility: activity.visibility,
          metadata: activity.metadata
        },
        'low'
      );
    } catch (error) {
      this.logger.warn('Failed to publish activity event:', error);
    }
  }

  private generateFeedKey(organizationId: string, userId?: string): string {
    return userId 
      ? `feed:${organizationId}:user:${userId}`
      : `feed:${organizationId}:org`;
  }

  private generateActivityId(): string {
    return `act_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }

  private generateActivityDescription(type: ActivityType, userName: string, metadata: any): string {
    switch (type) {
      case 'dashboard_view':
        return `${userName} viewed dashboard`;
      case 'dashboard_edit':
        return `${userName} edited dashboard`;
      case 'dashboard_create':
        return `${userName} created new dashboard`;
      case 'dashboard_delete':
        return `${userName} deleted dashboard`;
      case 'dashboard_share':
        return `${userName} shared dashboard`;
      case 'collaboration_start':
        return `${userName} started collaboration session`;
      case 'collaboration_end':
        return `${userName} ended collaboration session`;
      default:
        return `${userName} performed ${type.replace('_', ' ')}`;
    }
  }

  private generateCollaborationDescription(
    action: string,
    userName: string,
    collaborators?: string[]
  ): string {
    const participantCount = (collaborators?.length || 0) + 1;
    const participantText = participantCount > 1 
      ? `with ${participantCount - 1} other${participantCount > 2 ? 's' : ''}`
      : '';

    switch (action) {
      case 'start':
        return `${userName} started collaboration session ${participantText}`;
      case 'end':
        return `${userName} ended collaboration session`;
      case 'join':
        return `${userName} joined collaboration session`;
      case 'leave':
        return `${userName} left collaboration session`;
      default:
        return `${userName} ${action} collaboration session`;
    }
  }

  private applyFilters(activities: ActivityEvent[], filters: ActivityFilter): ActivityEvent[] {
    return activities.filter(activity => {
      // Type filter
      if (filters.types && !filters.types.includes(activity.type)) {
        return false;
      }

      // User filter
      if (filters.users && !filters.users.includes(activity.userId)) {
        return false;
      }

      // Time range filter
      if (filters.timeRange) {
        const timestamp = activity.metadata.timestamp;
        if (timestamp < filters.timeRange.start || timestamp > filters.timeRange.end) {
          return false;
        }
      }

      // Tags filter
      if (filters.tags && filters.tags.length > 0) {
        const activityTags = activity.metadata.tags || [];
        if (!filters.tags.some(tag => activityTags.includes(tag))) {
          return false;
        }
      }

      // Relevance filter
      if (filters.minimumRelevance && activity.relevanceScore < filters.minimumRelevance) {
        return false;
      }

      // Visibility filter
      if (filters.visibility && !filters.visibility.includes(activity.visibility)) {
        return false;
      }

      return true;
    });
  }

  private async createFeed(
    organizationId: string,
    userId?: string,
    filters?: ActivityFilter
  ): Promise<ActivityFeed> {
    // Get recent activities from cache
    const recentActivities = this.recentActivities.get(organizationId) || [];
    
    // Apply filters if provided
    const filteredActivities = filters 
      ? this.applyFilters(recentActivities, filters)
      : recentActivities;

    return {
      organizationId,
      userId,
      activities: filteredActivities.slice(0, this.config.maxFeedSize),
      filters: filters || {},
      lastUpdated: new Date(),
      totalCount: filteredActivities.length,
      unreadCount: filteredActivities.length
    };
  }

  private async getRelevantUsers(activity: ActivityEvent): Promise<string[]> {
    // For now, return all users in the organization
    // In a real implementation, this would use ML/AI to determine relevance
    try {
      const query = `
        SELECT id FROM users 
        WHERE organization_id = $1 AND is_active = true AND id != $2
        LIMIT 100
      `;
      
      const result = await this.db.query(query, [activity.organizationId, activity.userId]);
      return result.rows.map(row => row.id);
      
    } catch (error) {
      this.logger.warn('Failed to get relevant users:', error);
      return [];
    }
  }

  private async markActivitiesAsRead(userId: string, activityIds: string[]): Promise<void> {
    try {
      // Update read status in cache/database
      const key = `read_activities:${userId}`;
      await this.redisManager.client.sadd(key, ...activityIds);
      await this.redisManager.client.expire(key, 86400 * 30); // 30 days
      
    } catch (error) {
      this.logger.warn('Failed to mark activities as read:', error);
    }
  }

  private async getActivitiesInPeriod(
    organizationId: string,
    period: { start: Date; end: Date }
  ): Promise<ActivityEvent[]> {
    try {
      const timelineKey = `timeline:${organizationId}`;
      const activityIds = await this.redisManager.client.zrangebyscore(
        timelineKey,
        period.start.getTime(),
        period.end.getTime()
      );

      const activities: ActivityEvent[] = [];
      for (const activityId of activityIds) {
        const activityKey = `activity:${organizationId}:${activityId}`;
        const activityData = await this.redisManager.client.get(activityKey);
        if (activityData) {
          activities.push(JSON.parse(activityData));
        }
      }

      return activities;
      
    } catch (error) {
      this.logger.error('Failed to get activities in period:', error);
      return [];
    }
  }

  private calculateActivitiesByType(activities: ActivityEvent[]): Record<ActivityType, number> {
    const counts: Record<ActivityType, number> = {} as Record<ActivityType, number>;
    
    for (const activity of activities) {
      counts[activity.type] = (counts[activity.type] || 0) + 1;
    }
    
    return counts;
  }

  private calculateActivitiesByHour(activities: ActivityEvent[]): Record<string, number> {
    const hourCounts: Record<string, number> = {};
    
    for (const activity of activities) {
      const hour = activity.metadata.timestamp.getHours().toString().padStart(2, '0');
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    }
    
    return hourCounts;
  }

  private async calculateTopUsers(activities: ActivityEvent[]): Promise<ActivityInsights['topUsers']> {
    const userStats = new Map<string, { count: number; lastActivity: Date; userName: string }>();
    
    for (const activity of activities) {
      const existing = userStats.get(activity.userId) || { 
        count: 0, 
        lastActivity: new Date(0),
        userName: activity.userName 
      };
      
      userStats.set(activity.userId, {
        count: existing.count + 1,
        lastActivity: activity.metadata.timestamp > existing.lastActivity 
          ? activity.metadata.timestamp 
          : existing.lastActivity,
        userName: activity.userName
      });
    }
    
    return Array.from(userStats.entries())
      .map(([userId, stats]) => ({
        userId,
        userName: stats.userName,
        activityCount: stats.count,
        lastActivity: stats.lastActivity
      }))
      .sort((a, b) => b.activityCount - a.activityCount)
      .slice(0, 10);
  }

  private calculatePopularDashboards(activities: ActivityEvent[]): ActivityInsights['popularDashboards'] {
    const dashboardStats = new Map<string, { viewCount: number; editCount: number }>();
    
    for (const activity of activities) {
      if (activity.targetType === 'dashboard' && activity.targetId) {
        const existing = dashboardStats.get(activity.targetId) || { viewCount: 0, editCount: 0 };
        
        if (activity.type === 'dashboard_view') {
          existing.viewCount++;
        } else if (activity.type === 'dashboard_edit') {
          existing.editCount++;
        }
        
        dashboardStats.set(activity.targetId, existing);
      }
    }
    
    return Array.from(dashboardStats.entries())
      .map(([dashboardId, stats]) => ({
        dashboardId,
        viewCount: stats.viewCount,
        editCount: stats.editCount
      }))
      .sort((a, b) => (b.viewCount + b.editCount) - (a.viewCount + a.editCount))
      .slice(0, 10);
  }

  private calculateCollaborationStats(activities: ActivityEvent[]): ActivityInsights['collaborationStats'] {
    const collaborationActivities = activities.filter(a => 
      a.type === 'collaboration_start' || a.type === 'collaboration_end'
    );
    
    const sessions = new Map<string, { start?: Date; end?: Date; participants: Set<string> }>();
    
    for (const activity of collaborationActivities) {
      if (!activity.targetId) continue;
      
      const session = sessions.get(activity.targetId) || { participants: new Set() };
      session.participants.add(activity.userId);
      
      if (activity.type === 'collaboration_start') {
        session.start = activity.metadata.timestamp;
      } else if (activity.type === 'collaboration_end') {
        session.end = activity.metadata.timestamp;
      }
      
      sessions.set(activity.targetId, session);
    }
    
    let totalDuration = 0;
    let completedSessions = 0;
    let totalParticipants = 0;
    
    for (const session of sessions.values()) {
      if (session.start && session.end) {
        totalDuration += session.end.getTime() - session.start.getTime();
        completedSessions++;
      }
      totalParticipants += session.participants.size;
    }
    
    return {
      sessionsStarted: sessions.size,
      totalDuration,
      averageDuration: completedSessions > 0 ? totalDuration / completedSessions : 0,
      participantCount: totalParticipants
    };
  }

  private async cacheInsights(organizationId: string, insights: ActivityInsights): Promise<void> {
    try {
      const key = `insights:${organizationId}`;
      await this.redisManager.client.setex(key, 3600, JSON.stringify(insights)); // 1 hour cache
    } catch (error) {
      this.logger.warn('Failed to cache insights:', error);
    }
  }

  private startBackgroundProcessing(): void {
    // Clean up old activities periodically
    setInterval(() => {
      this.cleanupOldActivities();
    }, 3600000); // 1 hour

    // Update feed relevance scores
    if (this.config.enablePersonalization) {
      setInterval(() => {
        this.updateRelevanceScores();
      }, 1800000); // 30 minutes
    }
  }

  private cleanupOldActivities(): void {
    const cutoff = Date.now() - this.config.recentActivityWindow;
    
    for (const [orgId, activities] of this.recentActivities.entries()) {
      const filtered = activities.filter(a => a.metadata.timestamp.getTime() > cutoff);
      this.recentActivities.set(orgId, filtered);
    }
  }

  private updateRelevanceScores(): void {
    // Recalculate relevance scores based on user engagement
    // This is a placeholder for ML/AI-based relevance scoring
    this.logger.debug('Updating activity relevance scores');
  }

  /**
   * Public API for shutdown
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Activity Feed...');

    // Clear data structures
    this.feeds.clear();
    this.recentActivities.clear();
    this.activityIndex.clear();
    this.relevanceCache.clear();

    this.logger.info('Activity Feed shutdown complete');
  }
}