import { EventPublisher } from '../events/event-publisher';
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
export type ActivityType = 'dashboard_view' | 'dashboard_edit' | 'dashboard_create' | 'dashboard_delete' | 'dashboard_share' | 'metric_query' | 'metric_alert' | 'user_login' | 'user_logout' | 'collaboration_start' | 'collaboration_end' | 'data_export' | 'config_change' | 'system_event' | 'custom';
export interface ActivityFeed {
    organizationId: string;
    userId?: string;
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
export declare class ActivityFeed extends EventEmitter {
    private eventPublisher;
    private redisManager;
    private db;
    private logger;
    private config;
    private feeds;
    private recentActivities;
    private activityIndex;
    private relevanceCache;
    constructor(eventPublisher: EventPublisher, redisManager: RedisManager, db: DatabaseConnection, logger: winston.Logger, config: {
        maxFeedSize: number;
        recentActivityWindow: number;
        relevanceThreshold: number;
        insightsPeriod: number;
        enableAnalytics: boolean;
        enablePersonalization: boolean;
    });
    addActivity(activity: Omit<ActivityEvent, 'id' | 'relevanceScore'>): Promise<{
        success: boolean;
        activityId?: string;
        feedsUpdated: number;
        error?: string;
    }>;
    getActivityFeed(organizationId: string, userId?: string, options?: {
        limit?: number;
        offset?: number;
        filters?: ActivityFilter;
        includeRead?: boolean;
    }): Promise<{
        feed: ActivityEvent[];
        totalCount: number;
        unreadCount: number;
        hasMore: boolean;
        lastUpdated: Date;
    }>;
    getActivityInsights(organizationId: string, period?: {
        start: Date;
        end: Date;
    }): Promise<ActivityInsights | null>;
    subscribeToActivityUpdates(organizationId: string, userId?: string, filters?: ActivityFilter): Promise<{
        success: boolean;
        subscriptionId?: string;
    }>;
    trackDashboardActivity(organizationId: string, userId: string, userName: string, userRole: string, dashboardId: string, action: 'view' | 'edit' | 'create' | 'delete' | 'share', metadata?: Record<string, any>): Promise<void>;
    trackCollaborationActivity(organizationId: string, userId: string, userName: string, userRole: string, sessionId: string, action: 'start' | 'end' | 'join' | 'leave', collaborators?: string[], duration?: number): Promise<void>;
    private calculateRelevanceScore;
    private storeActivity;
    private storeActivityInDatabase;
    private addToRecentActivities;
    private updateActivityIndex;
    private updateFeeds;
    private addActivityToFeed;
    private publishActivityEvent;
    private generateFeedKey;
    private generateActivityId;
    private generateActivityDescription;
    private generateCollaborationDescription;
    private applyFilters;
    private createFeed;
    private getRelevantUsers;
    private markActivitiesAsRead;
    private getActivitiesInPeriod;
    private calculateActivitiesByType;
    private calculateActivitiesByHour;
    private calculateTopUsers;
    private calculatePopularDashboards;
    private calculateCollaborationStats;
    private cacheInsights;
    private startBackgroundProcessing;
    private cleanupOldActivities;
    private updateRelevanceScores;
    shutdown(): Promise<void>;
}
//# sourceMappingURL=activity-feed.d.ts.map