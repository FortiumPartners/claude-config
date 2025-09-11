"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActivityFeed = void 0;
const events_1 = __importDefault(require("events"));
class ActivityFeed extends events_1.default {
    eventPublisher;
    redisManager;
    db;
    logger;
    config;
    feeds = new Map();
    recentActivities = new Map();
    activityIndex = new Map();
    relevanceCache = new Map();
    constructor(eventPublisher, redisManager, db, logger, config) {
        super();
        this.eventPublisher = eventPublisher;
        this.redisManager = redisManager;
        this.db = db;
        this.logger = logger;
        this.config = config;
        this.startBackgroundProcessing();
    }
    async addActivity(activity) {
        try {
            const activityId = this.generateActivityId();
            const relevanceScore = await this.calculateRelevanceScore(activity);
            const completeActivity = {
                ...activity,
                id: activityId,
                relevanceScore
            };
            await this.storeActivity(completeActivity);
            this.addToRecentActivities(completeActivity);
            this.updateActivityIndex(completeActivity);
            const feedsUpdated = await this.updateFeeds(completeActivity);
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
        }
        catch (error) {
            this.logger.error('Failed to add activity:', error);
            return {
                success: false,
                feedsUpdated: 0,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    async getActivityFeed(organizationId, userId, options = {}) {
        try {
            const feedKey = this.generateFeedKey(organizationId, userId);
            const limit = options.limit || 50;
            const offset = options.offset || 0;
            let feed = this.feeds.get(feedKey);
            if (!feed) {
                feed = await this.createFeed(organizationId, userId, options.filters);
                this.feeds.set(feedKey, feed);
            }
            let filteredActivities = feed.activities;
            if (options.filters) {
                filteredActivities = this.applyFilters(feed.activities, options.filters);
            }
            const paginatedActivities = filteredActivities
                .slice(offset, offset + limit);
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
        }
        catch (error) {
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
    async getActivityInsights(organizationId, period) {
        try {
            const actualPeriod = period || {
                start: new Date(Date.now() - this.config.insightsPeriod),
                end: new Date()
            };
            const activities = await this.getActivitiesInPeriod(organizationId, actualPeriod);
            const insights = {
                organizationId,
                period: actualPeriod,
                totalActivities: activities.length,
                activitiesByType: this.calculateActivitiesByType(activities),
                activitiesByHour: this.calculateActivitiesByHour(activities),
                topUsers: await this.calculateTopUsers(activities),
                popularDashboards: this.calculatePopularDashboards(activities),
                collaborationStats: this.calculateCollaborationStats(activities)
            };
            await this.cacheInsights(organizationId, insights);
            return insights;
        }
        catch (error) {
            this.logger.error('Failed to get activity insights:', error);
            return null;
        }
    }
    async subscribeToActivityUpdates(organizationId, userId, filters) {
        try {
            const rooms = [`org:${organizationId}:activity`];
            if (userId) {
                rooms.push(`user:${userId}:activity`);
            }
            const subscriptionResult = await this.eventPublisher.publishEvent({
                type: 'user_activity',
                source: 'activity-feed',
                organizationId,
                userId,
                data: {
                    action: 'subscribe',
                    filters,
                    rooms
                },
                routing: { rooms },
                priority: 'low',
                tags: ['activity', 'subscription']
            });
            return {
                success: subscriptionResult.success,
                subscriptionId: subscriptionResult.eventId
            };
        }
        catch (error) {
            this.logger.error('Failed to subscribe to activity updates:', error);
            return { success: false };
        }
    }
    async trackDashboardActivity(organizationId, userId, userName, userRole, dashboardId, action, metadata = {}) {
        const activityType = `dashboard_${action}`;
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
    async trackCollaborationActivity(organizationId, userId, userName, userRole, sessionId, action, collaborators, duration) {
        const activityType = action === 'start' || action === 'end'
            ? `collaboration_${action}`
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
    async calculateRelevanceScore(activity) {
        let score = 50;
        const typeScores = {
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
        if (activity.userRole === 'admin')
            score += 20;
        else if (activity.userRole === 'manager')
            score += 10;
        const hoursAgo = (Date.now() - activity.metadata.timestamp.getTime()) / (1000 * 60 * 60);
        if (hoursAgo < 1)
            score += 20;
        else if (hoursAgo < 6)
            score += 10;
        else if (hoursAgo < 24)
            score += 5;
        if (activity.metadata.success === false)
            score += 15;
        const collaboratorCount = activity.metadata.details?.participantCount || 1;
        if (collaboratorCount > 1)
            score += Math.min(collaboratorCount * 5, 25);
        return Math.min(Math.max(score, 0), 100);
    }
    async storeActivity(activity) {
        try {
            const key = `activity:${activity.organizationId}:${activity.id}`;
            await this.redisManager.client.setex(key, 86400 * 7, JSON.stringify(activity));
            const timelineKey = `timeline:${activity.organizationId}`;
            await this.redisManager.client.zadd(timelineKey, activity.metadata.timestamp.getTime(), activity.id);
            await this.redisManager.client.expire(timelineKey, 86400 * 30);
            if (this.config.enableAnalytics) {
                await this.storeActivityInDatabase(activity);
            }
        }
        catch (error) {
            this.logger.warn('Failed to store activity:', error);
        }
    }
    async storeActivityInDatabase(activity) {
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
        }
        catch (error) {
            this.logger.warn('Failed to store activity in database:', error);
        }
    }
    addToRecentActivities(activity) {
        if (!this.recentActivities.has(activity.organizationId)) {
            this.recentActivities.set(activity.organizationId, []);
        }
        const activities = this.recentActivities.get(activity.organizationId);
        activities.unshift(activity);
        const cutoff = Date.now() - this.config.recentActivityWindow;
        const filtered = activities.filter(a => a.metadata.timestamp.getTime() > cutoff);
        this.recentActivities.set(activity.organizationId, filtered.slice(0, 1000));
    }
    updateActivityIndex(activity) {
        if (!this.activityIndex.has(activity.userId)) {
            this.activityIndex.set(activity.userId, new Set());
        }
        this.activityIndex.get(activity.userId).add(activity.id);
    }
    async updateFeeds(activity) {
        let feedsUpdated = 0;
        const orgFeedKey = this.generateFeedKey(activity.organizationId);
        await this.addActivityToFeed(orgFeedKey, activity);
        feedsUpdated++;
        if (this.config.enablePersonalization) {
            const relevantUsers = await this.getRelevantUsers(activity);
            for (const userId of relevantUsers) {
                const userFeedKey = this.generateFeedKey(activity.organizationId, userId);
                await this.addActivityToFeed(userFeedKey, activity);
                feedsUpdated++;
            }
        }
        return feedsUpdated;
    }
    async addActivityToFeed(feedKey, activity) {
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
        if (activity.relevanceScore >= this.config.relevanceThreshold) {
            feed.activities.unshift(activity);
            feed.totalCount++;
            feed.unreadCount++;
            feed.lastUpdated = new Date();
            if (feed.activities.length > this.config.maxFeedSize) {
                feed.activities = feed.activities.slice(0, this.config.maxFeedSize);
            }
        }
    }
    async publishActivityEvent(activity) {
        try {
            await this.eventPublisher.publishUserActivity(activity.organizationId, activity.userId, activity.action, {
                activityId: activity.id,
                type: activity.type,
                description: activity.description,
                targetId: activity.targetId,
                targetType: activity.targetType,
                relevanceScore: activity.relevanceScore,
                visibility: activity.visibility,
                metadata: activity.metadata
            }, 'low');
        }
        catch (error) {
            this.logger.warn('Failed to publish activity event:', error);
        }
    }
    generateFeedKey(organizationId, userId) {
        return userId
            ? `feed:${organizationId}:user:${userId}`
            : `feed:${organizationId}:org`;
    }
    generateActivityId() {
        return `act_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    }
    generateActivityDescription(type, userName, metadata) {
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
    generateCollaborationDescription(action, userName, collaborators) {
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
    applyFilters(activities, filters) {
        return activities.filter(activity => {
            if (filters.types && !filters.types.includes(activity.type)) {
                return false;
            }
            if (filters.users && !filters.users.includes(activity.userId)) {
                return false;
            }
            if (filters.timeRange) {
                const timestamp = activity.metadata.timestamp;
                if (timestamp < filters.timeRange.start || timestamp > filters.timeRange.end) {
                    return false;
                }
            }
            if (filters.tags && filters.tags.length > 0) {
                const activityTags = activity.metadata.tags || [];
                if (!filters.tags.some(tag => activityTags.includes(tag))) {
                    return false;
                }
            }
            if (filters.minimumRelevance && activity.relevanceScore < filters.minimumRelevance) {
                return false;
            }
            if (filters.visibility && !filters.visibility.includes(activity.visibility)) {
                return false;
            }
            return true;
        });
    }
    async createFeed(organizationId, userId, filters) {
        const recentActivities = this.recentActivities.get(organizationId) || [];
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
    async getRelevantUsers(activity) {
        try {
            const query = `
        SELECT id FROM users 
        WHERE organization_id = $1 AND is_active = true AND id != $2
        LIMIT 100
      `;
            const result = await this.db.query(query, [activity.organizationId, activity.userId]);
            return result.rows.map(row => row.id);
        }
        catch (error) {
            this.logger.warn('Failed to get relevant users:', error);
            return [];
        }
    }
    async markActivitiesAsRead(userId, activityIds) {
        try {
            const key = `read_activities:${userId}`;
            await this.redisManager.client.sadd(key, ...activityIds);
            await this.redisManager.client.expire(key, 86400 * 30);
        }
        catch (error) {
            this.logger.warn('Failed to mark activities as read:', error);
        }
    }
    async getActivitiesInPeriod(organizationId, period) {
        try {
            const timelineKey = `timeline:${organizationId}`;
            const activityIds = await this.redisManager.client.zrangebyscore(timelineKey, period.start.getTime(), period.end.getTime());
            const activities = [];
            for (const activityId of activityIds) {
                const activityKey = `activity:${organizationId}:${activityId}`;
                const activityData = await this.redisManager.client.get(activityKey);
                if (activityData) {
                    activities.push(JSON.parse(activityData));
                }
            }
            return activities;
        }
        catch (error) {
            this.logger.error('Failed to get activities in period:', error);
            return [];
        }
    }
    calculateActivitiesByType(activities) {
        const counts = {};
        for (const activity of activities) {
            counts[activity.type] = (counts[activity.type] || 0) + 1;
        }
        return counts;
    }
    calculateActivitiesByHour(activities) {
        const hourCounts = {};
        for (const activity of activities) {
            const hour = activity.metadata.timestamp.getHours().toString().padStart(2, '0');
            hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        }
        return hourCounts;
    }
    async calculateTopUsers(activities) {
        const userStats = new Map();
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
    calculatePopularDashboards(activities) {
        const dashboardStats = new Map();
        for (const activity of activities) {
            if (activity.targetType === 'dashboard' && activity.targetId) {
                const existing = dashboardStats.get(activity.targetId) || { viewCount: 0, editCount: 0 };
                if (activity.type === 'dashboard_view') {
                    existing.viewCount++;
                }
                else if (activity.type === 'dashboard_edit') {
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
    calculateCollaborationStats(activities) {
        const collaborationActivities = activities.filter(a => a.type === 'collaboration_start' || a.type === 'collaboration_end');
        const sessions = new Map();
        for (const activity of collaborationActivities) {
            if (!activity.targetId)
                continue;
            const session = sessions.get(activity.targetId) || { participants: new Set() };
            session.participants.add(activity.userId);
            if (activity.type === 'collaboration_start') {
                session.start = activity.metadata.timestamp;
            }
            else if (activity.type === 'collaboration_end') {
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
    async cacheInsights(organizationId, insights) {
        try {
            const key = `insights:${organizationId}`;
            await this.redisManager.client.setex(key, 3600, JSON.stringify(insights));
        }
        catch (error) {
            this.logger.warn('Failed to cache insights:', error);
        }
    }
    startBackgroundProcessing() {
        setInterval(() => {
            this.cleanupOldActivities();
        }, 3600000);
        if (this.config.enablePersonalization) {
            setInterval(() => {
                this.updateRelevanceScores();
            }, 1800000);
        }
    }
    cleanupOldActivities() {
        const cutoff = Date.now() - this.config.recentActivityWindow;
        for (const [orgId, activities] of this.recentActivities.entries()) {
            const filtered = activities.filter(a => a.metadata.timestamp.getTime() > cutoff);
            this.recentActivities.set(orgId, filtered);
        }
    }
    updateRelevanceScores() {
        this.logger.debug('Updating activity relevance scores');
    }
    async shutdown() {
        this.logger.info('Shutting down Activity Feed...');
        this.feeds.clear();
        this.recentActivities.clear();
        this.activityIndex.clear();
        this.relevanceCache.clear();
        this.logger.info('Activity Feed shutdown complete');
    }
}
exports.ActivityFeed = ActivityFeed;
//# sourceMappingURL=activity-feed.js.map