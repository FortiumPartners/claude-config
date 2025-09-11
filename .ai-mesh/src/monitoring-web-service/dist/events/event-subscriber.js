"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventSubscriber = void 0;
const events_1 = __importDefault(require("events"));
class EventSubscriber extends events_1.default {
    io;
    redisManager;
    db;
    logger;
    config;
    subscriptions = new Map();
    socketSubscriptions = new Map();
    roomSubscriptions = new Map();
    redisSubscriptions = new Map();
    metrics;
    deliveryHistory = [];
    constructor(io, redisManager, db, logger, config) {
        super();
        this.io = io;
        this.redisManager = redisManager;
        this.db = db;
        this.logger = logger;
        this.config = config;
        this.initializeMetrics();
        this.setupRedisSubscriptionHandling();
        this.startBackgroundServices();
    }
    async subscribe(socket, subscriptionRequest) {
        try {
            const { user } = socket.data;
            if (!user) {
                return { success: false, error: 'User not authenticated' };
            }
            const existingSubscriptions = this.getUserSubscriptions(user.id);
            if (existingSubscriptions.length >= this.config.maxSubscriptionsPerUser) {
                return { success: false, error: 'Subscription limit exceeded' };
            }
            const permissionValidation = await this.validateEventPermissions(user.role, user.permissions, subscriptionRequest.eventTypes);
            if (!permissionValidation.valid) {
                return { success: false, error: permissionValidation.error };
            }
            const roomValidation = await this.validateRoomAccess(user.organizationId, user.role, subscriptionRequest.rooms);
            if (!roomValidation.valid) {
                return { success: false, error: roomValidation.error };
            }
            const subscription = {
                id: this.generateSubscriptionId(),
                socketId: socket.id,
                userId: user.id,
                organizationId: user.organizationId,
                userRole: user.role,
                eventTypes: subscriptionRequest.eventTypes,
                rooms: subscriptionRequest.rooms,
                filters: subscriptionRequest.filters || {},
                permissions: user.permissions,
                createdAt: new Date(),
                lastActivity: new Date(),
                metadata: {
                    subscriptionCount: 1,
                    eventsReceived: 0,
                    eventsFiltered: 0,
                    averageLatency: 0
                }
            };
            this.subscriptions.set(subscription.id, subscription);
            if (!this.socketSubscriptions.has(socket.id)) {
                this.socketSubscriptions.set(socket.id, new Set());
            }
            this.socketSubscriptions.get(socket.id).add(subscription.id);
            for (const room of subscription.rooms) {
                if (!this.roomSubscriptions.has(room)) {
                    this.roomSubscriptions.set(room, new Set());
                }
                this.roomSubscriptions.get(room).add(subscription.id);
            }
            await this.subscribeToRedisChannels(subscription);
            await this.persistSubscription(subscription);
            let eventsReplayed = 0;
            if (subscriptionRequest.replayHistory && this.config.enableReplay) {
                eventsReplayed = await this.replayEvents(subscription, subscriptionRequest.replayCount || this.config.replayBufferSize);
            }
            this.updateSubscriptionMetrics(subscription, true);
            socket.emit('subscription_confirmed', {
                subscriptionId: subscription.id,
                eventTypes: subscription.eventTypes,
                rooms: subscription.rooms,
                filters: subscription.filters,
                eventsReplayed,
                timestamp: new Date()
            });
            this.logger.info('Event subscription created', {
                subscriptionId: subscription.id,
                userId: user.id,
                organizationId: user.organizationId,
                eventTypes: subscription.eventTypes,
                rooms: subscription.rooms,
                eventsReplayed
            });
            this.emit('subscription:created', subscription);
            return {
                success: true,
                subscriptionId: subscription.id,
                eventsReplayed
            };
        }
        catch (error) {
            this.logger.error('Failed to create subscription:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    async unsubscribe(socketId, subscriptionId) {
        try {
            let unsubscribedCount = 0;
            if (subscriptionId) {
                const success = await this.removeSubscription(subscriptionId);
                unsubscribedCount = success ? 1 : 0;
            }
            else {
                const subscriptionIds = this.socketSubscriptions.get(socketId) || new Set();
                for (const subId of subscriptionIds) {
                    const success = await this.removeSubscription(subId);
                    if (success)
                        unsubscribedCount++;
                }
            }
            return { success: true, unsubscribedCount };
        }
        catch (error) {
            this.logger.error('Failed to unsubscribe:', error);
            return { success: false, unsubscribedCount: 0 };
        }
    }
    async updateSubscriptionFilters(subscriptionId, newFilters) {
        try {
            const subscription = this.subscriptions.get(subscriptionId);
            if (!subscription) {
                return { success: false, error: 'Subscription not found' };
            }
            subscription.filters = { ...subscription.filters, ...newFilters };
            subscription.lastActivity = new Date();
            await this.persistSubscription(subscription);
            this.logger.debug('Subscription filters updated', {
                subscriptionId,
                newFilters
            });
            return { success: true };
        }
        catch (error) {
            this.logger.error('Failed to update subscription filters:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    async handleRedisEvent(channel, message) {
        try {
            const eventData = JSON.parse(message);
            if (eventData.type === 'batch_events') {
                for (const event of eventData.events) {
                    await this.deliverEventToSubscribers(channel, event);
                }
            }
            else {
                await this.deliverEventToSubscribers(channel, eventData);
            }
        }
        catch (error) {
            this.logger.error('Failed to handle Redis event:', error);
        }
    }
    async deliverEventToSubscribers(channel, event) {
        const startTime = Date.now();
        const room = channel.replace('events:', '');
        const subscriptionIds = this.roomSubscriptions.get(room) || new Set();
        let deliveredCount = 0;
        let filteredCount = 0;
        for (const subscriptionId of subscriptionIds) {
            const subscription = this.subscriptions.get(subscriptionId);
            if (!subscription)
                continue;
            try {
                if (!this.eventMatchesSubscription(event, subscription)) {
                    filteredCount++;
                    continue;
                }
                const socket = this.io.sockets.sockets.get(subscription.socketId);
                if (!socket) {
                    await this.removeSubscription(subscriptionId);
                    continue;
                }
                const deliveryPromise = new Promise((resolve, reject) => {
                    socket.emit('event', event, (ack) => {
                        if (ack?.error) {
                            reject(new Error(ack.error));
                        }
                        else {
                            resolve();
                        }
                    });
                    setTimeout(() => {
                        reject(new Error('Delivery timeout'));
                    }, this.config.deliveryTimeout);
                });
                await deliveryPromise;
                subscription.metadata.eventsReceived++;
                subscription.lastActivity = new Date();
                const latency = Date.now() - startTime;
                subscription.metadata.averageLatency =
                    (subscription.metadata.averageLatency + latency) / 2;
                this.recordEventDelivery({
                    subscriptionId,
                    eventId: event.eventId,
                    deliveredAt: new Date(),
                    latency,
                    success: true
                });
                deliveredCount++;
            }
            catch (error) {
                this.recordEventDelivery({
                    subscriptionId,
                    eventId: event.eventId,
                    deliveredAt: new Date(),
                    latency: Date.now() - startTime,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
                this.logger.warn('Event delivery failed', {
                    subscriptionId,
                    eventId: event.eventId,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
        this.metrics.eventsDelivered += deliveredCount;
        this.metrics.eventsFiltered += filteredCount;
        this.logger.debug('Event delivered to subscribers', {
            eventId: event.eventId,
            room,
            delivered: deliveredCount,
            filtered: filteredCount,
            totalSubscribers: subscriptionIds.size
        });
    }
    eventMatchesSubscription(event, subscription) {
        if (!subscription.eventTypes.includes(event.type)) {
            return false;
        }
        const filters = subscription.filters;
        if (filters.priority && !filters.priority.includes(event.metadata?.priority)) {
            return false;
        }
        if (filters.tags && filters.tags.length > 0) {
            const eventTags = event.metadata?.tags || [];
            if (!filters.tags.some(tag => eventTags.includes(tag))) {
                return false;
            }
        }
        if (filters.sources && !filters.sources.includes(event.source)) {
            return false;
        }
        if (filters.userIds && event.userId && !filters.userIds.includes(event.userId)) {
            return false;
        }
        if (filters.excludeUsers && event.userId && filters.excludeUsers.includes(event.userId)) {
            return false;
        }
        if (filters.timeRange) {
            const eventTime = new Date(event.metadata?.timestamp);
            if (eventTime < filters.timeRange.start || eventTime > filters.timeRange.end) {
                return false;
            }
        }
        if (event.organizationId && event.organizationId !== subscription.organizationId) {
            return false;
        }
        if (filters.dataFilters) {
            for (const [field, expectedValue] of Object.entries(filters.dataFilters)) {
                const eventValue = this.getNestedProperty(event.data, field);
                if (eventValue !== expectedValue) {
                    return false;
                }
            }
        }
        return true;
    }
    async subscribeToRedisChannels(subscription) {
        for (const room of subscription.rooms) {
            const channel = `events:${room}`;
            if (!this.redisSubscriptions.has(channel)) {
                const subscriber = this.redisManager.createSubscriber();
                subscriber.on('message', (receivedChannel, message) => {
                    if (receivedChannel === channel) {
                        this.handleRedisEvent(channel, message);
                    }
                });
                await subscriber.subscribe(channel);
                this.redisSubscriptions.set(channel, subscriber);
                this.logger.debug('Subscribed to Redis channel', { channel });
            }
        }
    }
    async replayEvents(subscription, count) {
        try {
            let totalReplayed = 0;
            for (const room of subscription.rooms) {
                const historyKey = `event_history:${room}`;
                const recentEvents = await this.redisManager.client.lrange(historyKey, 0, count - 1);
                for (const eventJson of recentEvents) {
                    try {
                        const event = JSON.parse(eventJson);
                        if (this.eventMatchesSubscription(event, subscription)) {
                            const socket = this.io.sockets.sockets.get(subscription.socketId);
                            if (socket) {
                                socket.emit('event_replay', event);
                                totalReplayed++;
                            }
                        }
                    }
                    catch (parseError) {
                        this.logger.warn('Failed to parse replay event:', parseError);
                    }
                }
            }
            return totalReplayed;
        }
        catch (error) {
            this.logger.error('Failed to replay events:', error);
            return 0;
        }
    }
    async validateEventPermissions(userRole, userPermissions, eventTypes) {
        if (userRole === 'admin' || userPermissions.includes('admin')) {
            return { valid: true };
        }
        for (const eventType of eventTypes) {
            switch (eventType) {
                case 'system_alert':
                case 'configuration_change':
                case 'security_event':
                    if (!['admin', 'manager'].includes(userRole)) {
                        return { valid: false, error: `Insufficient permissions for ${eventType} events` };
                    }
                    break;
                case 'metrics_updated':
                case 'dashboard_changed':
                case 'user_activity':
                case 'collaboration_event':
                case 'notification':
                case 'presence_update':
                case 'real_time_data':
                    break;
                default:
                    return { valid: false, error: `Unknown event type: ${eventType}` };
            }
        }
        return { valid: true };
    }
    async validateRoomAccess(organizationId, userRole, rooms) {
        for (const room of rooms) {
            if (room.startsWith('org:')) {
                const roomOrgId = room.split(':')[1];
                if (roomOrgId !== organizationId) {
                    return { valid: false, error: 'Access denied to organization room' };
                }
            }
            else if (room.startsWith('dashboard:')) {
                const [, roomOrgId, dashboardId] = room.split(':');
                if (roomOrgId !== organizationId) {
                    return { valid: false, error: 'Access denied to dashboard room' };
                }
            }
            else if (room.startsWith('metrics:')) {
                const [, roomOrgId, metricType] = room.split(':');
                if (roomOrgId !== organizationId) {
                    return { valid: false, error: 'Access denied to metrics room' };
                }
            }
            else if (room.startsWith('collab:')) {
                if (!['admin', 'manager'].includes(userRole)) {
                    return { valid: false, error: 'Insufficient permissions for collaborative rooms' };
                }
            }
        }
        return { valid: true };
    }
    generateSubscriptionId() {
        return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    getNestedProperty(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }
    async persistSubscription(subscription) {
        try {
            const key = `subscription:${subscription.id}`;
            await this.redisManager.client.setex(key, this.config.subscriptionTtl, JSON.stringify(subscription));
        }
        catch (error) {
            this.logger.warn('Failed to persist subscription:', error);
        }
    }
    async removeSubscription(subscriptionId) {
        try {
            const subscription = this.subscriptions.get(subscriptionId);
            if (!subscription)
                return false;
            this.subscriptions.delete(subscriptionId);
            this.socketSubscriptions.get(subscription.socketId)?.delete(subscriptionId);
            for (const room of subscription.rooms) {
                this.roomSubscriptions.get(room)?.delete(subscriptionId);
                if (this.roomSubscriptions.get(room)?.size === 0) {
                    this.roomSubscriptions.delete(room);
                    const channel = `events:${room}`;
                    const redisSubscription = this.redisSubscriptions.get(channel);
                    if (redisSubscription) {
                        await redisSubscription.unsubscribe(channel);
                        this.redisSubscriptions.delete(channel);
                    }
                }
            }
            await this.redisManager.client.del(`subscription:${subscriptionId}`);
            this.updateSubscriptionMetrics(subscription, false);
            this.logger.debug('Subscription removed', { subscriptionId });
            this.emit('subscription:removed', subscription);
            return true;
        }
        catch (error) {
            this.logger.error('Failed to remove subscription:', error);
            return false;
        }
    }
    recordEventDelivery(delivery) {
        this.deliveryHistory.push(delivery);
        if (this.deliveryHistory.length > 10000) {
            this.deliveryHistory.shift();
        }
        if (delivery.success) {
            this.metrics.averageDeliveryLatency =
                (this.metrics.averageDeliveryLatency + delivery.latency) / 2;
        }
    }
    initializeMetrics() {
        this.metrics = {
            totalSubscriptions: 0,
            subscriptionsByType: {},
            subscriptionsByRoom: {},
            eventsDelivered: 0,
            eventsFiltered: 0,
            averageDeliveryLatency: 0,
            subscriptionHealth: 100
        };
    }
    updateSubscriptionMetrics(subscription, isAdd) {
        const delta = isAdd ? 1 : -1;
        this.metrics.totalSubscriptions += delta;
        for (const eventType of subscription.eventTypes) {
            this.metrics.subscriptionsByType[eventType] =
                (this.metrics.subscriptionsByType[eventType] || 0) + delta;
        }
        for (const room of subscription.rooms) {
            this.metrics.subscriptionsByRoom[room] =
                (this.metrics.subscriptionsByRoom[room] || 0) + delta;
        }
    }
    startBackgroundServices() {
        setInterval(() => {
            const cutoff = Date.now() - this.config.historyRetention;
            this.deliveryHistory = this.deliveryHistory.filter(delivery => delivery.deliveredAt.getTime() > cutoff);
        }, 300000);
        setInterval(() => {
            this.performSubscriptionHealthCheck();
        }, 60000);
    }
    performSubscriptionHealthCheck() {
        let healthyCount = 0;
        for (const subscription of this.subscriptions.values()) {
            const socket = this.io.sockets.sockets.get(subscription.socketId);
            if (socket && socket.connected) {
                healthyCount++;
            }
            else {
                this.removeSubscription(subscription.id);
            }
        }
        this.metrics.subscriptionHealth = this.subscriptions.size > 0
            ? (healthyCount / this.subscriptions.size) * 100
            : 100;
    }
    setupRedisSubscriptionHandling() {
        this.redisManager.getSubscriber().on('error', (error) => {
            this.logger.error('Redis subscriber error:', error);
        });
        this.redisManager.getSubscriber().on('connect', () => {
            this.logger.info('Redis subscriber connected');
        });
    }
    getUserSubscriptions(userId) {
        return Array.from(this.subscriptions.values()).filter(subscription => subscription.userId === userId);
    }
    getSubscriptionMetrics() {
        return { ...this.metrics };
    }
    getSubscriptionById(subscriptionId) {
        return this.subscriptions.get(subscriptionId);
    }
    async shutdown() {
        this.logger.info('Shutting down Event Subscriber...');
        for (const [channel, subscriber] of this.redisSubscriptions.entries()) {
            try {
                await subscriber.unsubscribe(channel);
                await subscriber.quit();
            }
            catch (error) {
                this.logger.error(`Error unsubscribing from channel ${channel}:`, error);
            }
        }
        this.subscriptions.clear();
        this.socketSubscriptions.clear();
        this.roomSubscriptions.clear();
        this.redisSubscriptions.clear();
        this.deliveryHistory.length = 0;
        this.logger.info('Event Subscriber shutdown complete');
    }
}
exports.EventSubscriber = EventSubscriber;
//# sourceMappingURL=event-subscriber.js.map