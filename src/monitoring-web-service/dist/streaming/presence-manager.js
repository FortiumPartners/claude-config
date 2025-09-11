"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PresenceManager = void 0;
const events_1 = __importDefault(require("events"));
class PresenceManager extends events_1.default {
    eventPublisher;
    redisManager;
    db;
    logger;
    config;
    userPresences = new Map();
    connectionMapping = new Map();
    organizationPresence = new Map();
    presenceHistory = new Map();
    idleTimers = new Map();
    constructor(eventPublisher, redisManager, db, logger, config) {
        super();
        this.eventPublisher = eventPublisher;
        this.redisManager = redisManager;
        this.db = db;
        this.logger = logger;
        this.config = config;
        this.startBackgroundServices();
        this.loadPresenceFromCache();
    }
    async setUserOnline(userId, userName, organizationId, connectionInfo) {
        try {
            let presence = this.userPresences.get(userId);
            const now = new Date();
            if (!presence) {
                presence = {
                    userId,
                    userName,
                    organizationId,
                    status: 'online',
                    lastSeen: now,
                    lastActivity: now,
                    connections: [],
                    metadata: {},
                    capabilities: {
                        collaborative: true,
                        realTimeUpdates: true,
                        notifications: true
                    }
                };
            }
            else {
                presence.status = 'online';
                presence.lastSeen = now;
                presence.lastActivity = now;
            }
            const connection = {
                id: this.generateConnectionId(),
                socketId: connectionInfo.socketId,
                device: {
                    type: this.detectDeviceType(connectionInfo.userAgent),
                    os: this.detectOS(connectionInfo.userAgent),
                    browser: this.detectBrowser(connectionInfo.userAgent),
                    ...connectionInfo.device
                },
                ipAddress: connectionInfo.ipAddress,
                userAgent: connectionInfo.userAgent,
                connectedAt: now,
                lastActivity: now,
                isActive: true
            };
            presence.connections.push(connection);
            this.userPresences.set(userId, presence);
            this.connectionMapping.set(connectionInfo.socketId, userId);
            if (!this.organizationPresence.has(organizationId)) {
                this.organizationPresence.set(organizationId, new Set());
            }
            this.organizationPresence.get(organizationId).add(userId);
            this.clearIdleTimer(userId);
            await this.cachePresence(presence);
            await this.recordPresenceUpdate({
                userId,
                organizationId,
                status: 'online',
                timestamp: now,
                source: 'automatic',
                metadata: { connectionId: connection.id, device: connection.device }
            });
            await this.publishPresenceUpdate(presence, 'online');
            this.logger.debug('User set online', {
                userId,
                organizationId,
                connectionCount: presence.connections.length,
                deviceType: connection.device.type
            });
            this.emit('presence:online', presence);
            return { success: true, presence };
        }
        catch (error) {
            this.logger.error('Failed to set user online:', error);
            return { success: false };
        }
    }
    async updateUserActivity(socketId) {
        try {
            const userId = this.connectionMapping.get(socketId);
            if (!userId)
                return;
            const presence = this.userPresences.get(userId);
            if (!presence)
                return;
            const now = new Date();
            presence.lastActivity = now;
            const connection = presence.connections.find(c => c.socketId === socketId);
            if (connection) {
                connection.lastActivity = now;
                connection.isActive = true;
            }
            if (presence.status === 'idle' || presence.status === 'away') {
                presence.status = 'online';
                await this.publishPresenceUpdate(presence, 'online');
            }
            this.setIdleTimer(userId);
            await this.cachePresence(presence);
        }
        catch (error) {
            this.logger.error('Failed to update user activity:', error);
        }
    }
    async setUserOffline(socketId, reason) {
        try {
            const userId = this.connectionMapping.get(socketId);
            if (!userId)
                return;
            const presence = this.userPresences.get(userId);
            if (!presence)
                return;
            presence.connections = presence.connections.filter(c => c.socketId !== socketId);
            this.connectionMapping.delete(socketId);
            const now = new Date();
            presence.lastSeen = now;
            if (presence.connections.length === 0) {
                presence.status = 'offline';
                this.clearIdleTimer(userId);
                await this.recordPresenceUpdate({
                    userId,
                    organizationId: presence.organizationId,
                    status: 'offline',
                    timestamp: now,
                    source: 'automatic',
                    metadata: { reason, disconnectionType: 'normal' }
                });
                await this.publishPresenceUpdate(presence, 'offline');
                this.emit('presence:offline', presence);
            }
            else {
                await this.cachePresence(presence);
            }
            this.logger.debug('User connection removed', {
                userId,
                remainingConnections: presence.connections.length,
                reason
            });
        }
        catch (error) {
            this.logger.error('Failed to set user offline:', error);
        }
    }
    async setUserStatus(userId, status, customMessage) {
        try {
            const presence = this.userPresences.get(userId);
            if (!presence) {
                return { success: false };
            }
            const previousStatus = presence.status;
            presence.status = status;
            presence.lastActivity = new Date();
            if (customMessage) {
                presence.metadata.customStatus = customMessage;
            }
            if (status === 'do_not_disturb') {
                presence.capabilities.notifications = false;
            }
            else {
                presence.capabilities.notifications = true;
            }
            if (status === 'in_meeting') {
                presence.capabilities.collaborative = false;
            }
            else {
                presence.capabilities.collaborative = true;
            }
            await this.cachePresence(presence);
            await this.recordPresenceUpdate({
                userId,
                organizationId: presence.organizationId,
                status,
                timestamp: new Date(),
                source: 'manual',
                metadata: { previousStatus, customMessage }
            });
            await this.publishPresenceUpdate(presence, status);
            this.logger.info('User status updated', {
                userId,
                previousStatus,
                newStatus: status,
                customMessage
            });
            this.emit('presence:status_changed', presence, previousStatus);
            return { success: true, presence };
        }
        catch (error) {
            this.logger.error('Failed to set user status:', error);
            return { success: false };
        }
    }
    getUserPresence(userId) {
        return this.userPresences.get(userId) || null;
    }
    getTeamPresence(organizationId, teamId) {
        const userIds = this.organizationPresence.get(organizationId) || new Set();
        const users = [];
        let onlineUsers = 0;
        let awayUsers = 0;
        let idleUsers = 0;
        let offlineUsers = 0;
        for (const userId of userIds) {
            const presence = this.userPresences.get(userId);
            if (presence) {
                if (teamId) {
                }
                users.push(presence);
                switch (presence.status) {
                    case 'online':
                        onlineUsers++;
                        break;
                    case 'away':
                        awayUsers++;
                        break;
                    case 'idle':
                        idleUsers++;
                        break;
                    default:
                        offlineUsers++;
                }
            }
        }
        return {
            organizationId,
            teamId,
            totalUsers: users.length,
            onlineUsers,
            awayUsers,
            idleUsers,
            offlineUsers,
            users: users.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime()),
            lastUpdated: new Date()
        };
    }
    getAvailableUsers(organizationId) {
        const teamPresence = this.getTeamPresence(organizationId);
        return teamPresence.users.filter(user => user.status === 'online' &&
            user.capabilities.collaborative &&
            user.status !== 'do_not_disturb' &&
            user.status !== 'in_meeting');
    }
    async getPresenceAnalytics(organizationId, period) {
        try {
            if (!this.config.enableAnalytics) {
                return null;
            }
            const actualPeriod = period || {
                start: new Date(Date.now() - 86400000 * 7),
                end: new Date()
            };
            const analytics = await this.calculateAnalytics(organizationId, actualPeriod);
            return analytics;
        }
        catch (error) {
            this.logger.error('Failed to get presence analytics:', error);
            return null;
        }
    }
    setIdleTimer(userId) {
        this.clearIdleTimer(userId);
        const idleTimer = setTimeout(() => {
            this.handleUserIdle(userId);
        }, this.config.idleTimeout);
        this.idleTimers.set(userId, idleTimer);
    }
    clearIdleTimer(userId) {
        const timer = this.idleTimers.get(userId);
        if (timer) {
            clearTimeout(timer);
            this.idleTimers.delete(userId);
        }
    }
    async handleUserIdle(userId) {
        const presence = this.userPresences.get(userId);
        if (!presence || presence.status === 'offline')
            return;
        presence.status = 'idle';
        await this.cachePresence(presence);
        await this.publishPresenceUpdate(presence, 'idle');
        setTimeout(() => {
            this.handleUserAway(userId);
        }, this.config.awayTimeout - this.config.idleTimeout);
        this.logger.debug('User set to idle', { userId });
        this.emit('presence:idle', presence);
    }
    async handleUserAway(userId) {
        const presence = this.userPresences.get(userId);
        if (!presence || presence.status !== 'idle')
            return;
        presence.status = 'away';
        await this.cachePresence(presence);
        await this.publishPresenceUpdate(presence, 'away');
        setTimeout(() => {
            this.handleUserAutoOffline(userId);
        }, this.config.offlineTimeout - this.config.awayTimeout);
        this.logger.debug('User set to away', { userId });
        this.emit('presence:away', presence);
    }
    async handleUserAutoOffline(userId) {
        const presence = this.userPresences.get(userId);
        if (!presence || presence.status !== 'away')
            return;
        const hasActiveConnections = presence.connections.some(c => c.isActive);
        if (!hasActiveConnections) {
            presence.status = 'offline';
            await this.cachePresence(presence);
            await this.publishPresenceUpdate(presence, 'offline');
            this.logger.debug('User auto-set to offline', { userId });
            this.emit('presence:offline', presence);
        }
    }
    async publishPresenceUpdate(presence, status) {
        try {
            await this.eventPublisher.publishEvent({
                type: 'presence_update',
                source: 'presence-manager',
                organizationId: presence.organizationId,
                userId: presence.userId,
                data: {
                    userId: presence.userId,
                    userName: presence.userName,
                    status,
                    lastSeen: presence.lastSeen,
                    lastActivity: presence.lastActivity,
                    connectionCount: presence.connections.length,
                    capabilities: presence.capabilities,
                    customStatus: presence.metadata.customStatus
                },
                routing: {
                    rooms: [`org:${presence.organizationId}`, `presence:${presence.organizationId}`]
                },
                priority: 'medium',
                tags: ['presence', status]
            });
        }
        catch (error) {
            this.logger.warn('Failed to publish presence update:', error);
        }
    }
    async recordPresenceUpdate(update) {
        try {
            if (!this.presenceHistory.has(update.userId)) {
                this.presenceHistory.set(update.userId, []);
            }
            const history = this.presenceHistory.get(update.userId);
            history.unshift(update);
            const cutoff = Date.now() - this.config.historyRetention;
            const filtered = history.filter(h => h.timestamp.getTime() > cutoff);
            this.presenceHistory.set(update.userId, filtered.slice(0, 1000));
            if (this.config.enableAnalytics) {
                const key = `presence_history:${update.organizationId}:${update.userId}`;
                await this.redisManager.client.lpush(key, JSON.stringify(update));
                await this.redisManager.client.ltrim(key, 0, 999);
                await this.redisManager.client.expire(key, this.config.historyRetention / 1000);
            }
        }
        catch (error) {
            this.logger.warn('Failed to record presence update:', error);
        }
    }
    async cachePresence(presence) {
        try {
            const key = `presence:${presence.userId}`;
            await this.redisManager.client.setex(key, 3600, JSON.stringify(presence));
        }
        catch (error) {
            this.logger.warn('Failed to cache presence:', error);
        }
    }
    async loadPresenceFromCache() {
        try {
            this.logger.info('Loading presence data from cache...');
        }
        catch (error) {
            this.logger.warn('Failed to load presence from cache:', error);
        }
    }
    detectDeviceType(userAgent) {
        const ua = userAgent.toLowerCase();
        if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
            return 'mobile';
        }
        else if (ua.includes('tablet') || ua.includes('ipad')) {
            return 'tablet';
        }
        else if (ua.includes('desktop') || ua.includes('windows') || ua.includes('mac')) {
            return 'desktop';
        }
        return 'unknown';
    }
    detectOS(userAgent) {
        const ua = userAgent.toLowerCase();
        if (ua.includes('windows'))
            return 'Windows';
        if (ua.includes('mac'))
            return 'macOS';
        if (ua.includes('linux'))
            return 'Linux';
        if (ua.includes('android'))
            return 'Android';
        if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad'))
            return 'iOS';
        return 'Unknown';
    }
    detectBrowser(userAgent) {
        const ua = userAgent.toLowerCase();
        if (ua.includes('chrome'))
            return 'Chrome';
        if (ua.includes('firefox'))
            return 'Firefox';
        if (ua.includes('safari') && !ua.includes('chrome'))
            return 'Safari';
        if (ua.includes('edge'))
            return 'Edge';
        return 'Unknown';
    }
    generateConnectionId() {
        return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    }
    async calculateAnalytics(organizationId, period) {
        const teamPresence = this.getTeamPresence(organizationId);
        const totalUsers = teamPresence.totalUsers;
        return {
            organizationId,
            period,
            averageOnlineTime: 0,
            peakOnlineHours: {},
            deviceBreakdown: this.calculateDeviceBreakdown(teamPresence.users),
            statusDistribution: {
                online: teamPresence.onlineUsers,
                away: teamPresence.awayUsers,
                idle: teamPresence.idleUsers,
                offline: teamPresence.offlineUsers,
                do_not_disturb: 0,
                in_meeting: 0
            },
            collaborationReadiness: totalUsers > 0
                ? (this.getAvailableUsers(organizationId).length / totalUsers) * 100
                : 0
        };
    }
    calculateDeviceBreakdown(users) {
        const breakdown = {
            desktop: 0,
            mobile: 0,
            tablet: 0,
            unknown: 0
        };
        for (const user of users) {
            for (const connection of user.connections) {
                breakdown[connection.device.type]++;
            }
        }
        return breakdown;
    }
    startBackgroundServices() {
        setInterval(() => {
            this.cleanupStaleConnections();
        }, this.config.heartbeatInterval);
        setInterval(() => {
            this.syncPresenceCache();
        }, 60000);
    }
    cleanupStaleConnections() {
        const now = Date.now();
        const staleThreshold = this.config.offlineTimeout;
        for (const [userId, presence] of this.userPresences.entries()) {
            const activeConnections = presence.connections.filter(connection => {
                const lastActivity = connection.lastActivity.getTime();
                const isStale = now - lastActivity > staleThreshold;
                if (isStale) {
                    this.connectionMapping.delete(connection.socketId);
                }
                return !isStale;
            });
            if (activeConnections.length !== presence.connections.length) {
                presence.connections = activeConnections;
                if (activeConnections.length === 0 && presence.status !== 'offline') {
                    presence.status = 'offline';
                    presence.lastSeen = new Date();
                    this.publishPresenceUpdate(presence, 'offline');
                }
            }
        }
    }
    async syncPresenceCache() {
        try {
            const syncPromises = Array.from(this.userPresences.values()).map(presence => this.cachePresence(presence));
            await Promise.allSettled(syncPromises);
        }
        catch (error) {
            this.logger.warn('Failed to sync presence cache:', error);
        }
    }
    async shutdown() {
        this.logger.info('Shutting down Presence Manager...');
        for (const timer of this.idleTimers.values()) {
            clearTimeout(timer);
        }
        for (const presence of this.userPresences.values()) {
            if (presence.status !== 'offline') {
                presence.status = 'offline';
                presence.lastSeen = new Date();
                await this.publishPresenceUpdate(presence, 'offline');
            }
        }
        this.userPresences.clear();
        this.connectionMapping.clear();
        this.organizationPresence.clear();
        this.presenceHistory.clear();
        this.idleTimers.clear();
        this.logger.info('Presence Manager shutdown complete');
    }
}
exports.PresenceManager = PresenceManager;
//# sourceMappingURL=presence-manager.js.map