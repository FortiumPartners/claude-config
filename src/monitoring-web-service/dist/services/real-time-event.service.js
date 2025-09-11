"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealtimeEventService = void 0;
const events_1 = __importDefault(require("events"));
class RealtimeEventService extends events_1.default {
    redisManager;
    db;
    logger;
    config;
    subscriptions = new Map();
    eventQueues = new Map();
    eventHistory = new Map();
    metrics;
    processingInterval;
    cleanupInterval;
    batchProcessor = new Map();
    constructor(redisManager, db, logger, config = {}) {
        super();
        this.redisManager = redisManager;
        this.db = db;
        this.logger = logger;
        this.config = config;
        this.metrics = {
            eventsPublished: 0,
            eventsDelivered: 0,
            eventsFailed: 0,
            averageDeliveryTime: 0,
            queueBacklog: 0,
            activeSubscriptions: 0,
            replayRequests: 0
        };
        this.initializeRedisChannels();
        this.startBackgroundProcessing();
        this.logger.info('Real-time Event Service initialized', {
            maxEventHistory: this.config.maxEventHistory || 1000,
            batchInterval: this.config.batchInterval || 200,
            cleanupInterval: this.config.cleanupInterval || 300000,
            defaultTTL: this.config.defaultTTL || 3600
        });
    }
    initializeRedisChannels() {
        const subscriber = this.redisManager.getSubscriber();
        subscriber.psubscribe('fortium:events:*', (err, count) => {
            if (err) {
                this.logger.error('Failed to subscribe to event channels:', err);
                return;
            }
            this.logger.info(`Subscribed to ${count} event channels`);
        });
        subscriber.on('pmessage', async (pattern, channel, message) => {
            try {
                const event = JSON.parse(message);
                await this.handleIncomingEvent(event, channel);
            }
            catch (error) {
                this.logger.error('Failed to process incoming event:', error);
                this.metrics.eventsFailed++;
            }
        });
        subscriber.on('error', (error) => {
            this.logger.error('Redis subscriber error:', error);
        });
    }
    async publishEvent(event) {
        try {
            const fullEvent = {
                id: this.generateEventId(),
                ...event,
                metadata: {
                    timestamp: new Date(),
                    priority: 'medium',
                    ttl: this.config.defaultTTL || 3600,
                    replay: true,
                    batchable: true,
                    requiresAck: false,
                    ...event.metadata
                }
            };
            if (fullEvent.metadata.replay) {
                await this.storeEventInHistory(fullEvent);
            }
            const channel = this.getChannelForEvent(fullEvent);
            const publisher = this.redisManager.getPublisher();
            await publisher.publish(channel, JSON.stringify(fullEvent));
            this.metrics.eventsPublished++;
            await this.queueEventForProcessing(fullEvent);
            this.logger.debug('Event published', {
                eventId: fullEvent.id,
                type: fullEvent.type,
                organizationId: fullEvent.organizationId,
                priority: fullEvent.metadata.priority,
                channel
            });
            this.emit('event:published', fullEvent);
            return fullEvent.id;
        }
        catch (error) {
            this.logger.error('Failed to publish event:', error);
            this.metrics.eventsFailed++;
            throw error;
        }
    }
    async subscribe(subscription) {
        try {
            const subscriptionId = this.generateSubscriptionId();
            const fullSubscription = {
                id: subscriptionId,
                subscribedAt: new Date(),
                lastActivity: new Date(),
                acknowledged: new Set(),
                ...subscription
            };
            const isValid = await this.validateSubscription(fullSubscription);
            if (!isValid) {
                throw new Error('Invalid subscription permissions');
            }
            this.subscriptions.set(subscriptionId, fullSubscription);
            this.metrics.activeSubscriptions++;
            const channels = this.getChannelsForSubscription(fullSubscription);
            fullSubscription.channels = channels;
            if (fullSubscription.filters.timeRange || fullSubscription.userId) {
                await this.replayEventsForSubscription(fullSubscription);
            }
            this.logger.info('Event subscription created', {
                subscriptionId,
                organizationId: subscription.organizationId,
                userId: subscription.userId,
                channels: channels.length,
                filters: fullSubscription.filters
            });
            this.emit('subscription:created', fullSubscription);
            return subscriptionId;
        }
        catch (error) {
            this.logger.error('Failed to create subscription:', error);
            throw error;
        }
    }
    async unsubscribe(subscriptionId) {
        try {
            const subscription = this.subscriptions.get(subscriptionId);
            if (!subscription) {
                this.logger.warn('Attempted to unsubscribe from non-existent subscription', { subscriptionId });
                return;
            }
            this.subscriptions.delete(subscriptionId);
            this.metrics.activeSubscriptions--;
            this.logger.info('Event subscription removed', {
                subscriptionId,
                organizationId: subscription.organizationId,
                userId: subscription.userId,
                duration: Date.now() - subscription.subscribedAt.getTime()
            });
            this.emit('subscription:removed', subscription);
        }
        catch (error) {
            this.logger.error('Failed to remove subscription:', error);
            throw error;
        }
    }
    async acknowledgeEvent(subscriptionId, eventId) {
        try {
            const subscription = this.subscriptions.get(subscriptionId);
            if (!subscription) {
                this.logger.warn('Acknowledgment for non-existent subscription', { subscriptionId, eventId });
                return;
            }
            subscription.acknowledged.add(eventId);
            subscription.lastActivity = new Date();
            this.logger.debug('Event acknowledged', { subscriptionId, eventId });
        }
        catch (error) {
            this.logger.error('Failed to acknowledge event:', error);
        }
    }
    async getEventHistory(organizationId, filter, limit = 100) {
        try {
            const cacheKey = `event_history:${organizationId}:${JSON.stringify(filter)}:${limit}`;
            const cached = await this.redisManager.getCachedMetrics(cacheKey);
            if (cached) {
                return cached;
            }
            const orgHistory = this.eventHistory.get(organizationId) || [];
            let filteredEvents = this.applyEventFilter(orgHistory, filter);
            filteredEvents = filteredEvents
                .sort((a, b) => b.metadata.timestamp.getTime() - a.metadata.timestamp.getTime())
                .slice(0, limit);
            await this.redisManager.cacheMetrics(cacheKey, filteredEvents, 300);
            this.metrics.replayRequests++;
            return filteredEvents;
        }
        catch (error) {
            this.logger.error('Failed to get event history:', error);
            return [];
        }
    }
    async publishEventBatch(events) {
        try {
            const eventIds = [];
            const publishPromises = [];
            const channelBatches = new Map();
            for (const eventData of events) {
                const fullEvent = {
                    id: this.generateEventId(),
                    ...eventData,
                    metadata: {
                        timestamp: new Date(),
                        priority: 'medium',
                        ttl: this.config.defaultTTL || 3600,
                        replay: true,
                        batchable: true,
                        requiresAck: false,
                        ...eventData.metadata
                    }
                };
                eventIds.push(fullEvent.id);
                if (fullEvent.metadata.replay) {
                    await this.storeEventInHistory(fullEvent);
                }
                const channel = this.getChannelForEvent(fullEvent);
                if (!channelBatches.has(channel)) {
                    channelBatches.set(channel, []);
                }
                channelBatches.get(channel).push(fullEvent);
            }
            const publisher = this.redisManager.getPublisher();
            for (const [channel, channelEvents] of channelBatches) {
                const batchMessage = {
                    type: 'event_batch',
                    events: channelEvents,
                    batchSize: channelEvents.length,
                    timestamp: new Date()
                };
                publishPromises.push(publisher.publish(channel, JSON.stringify(batchMessage)));
            }
            await Promise.all(publishPromises);
            this.metrics.eventsPublished += events.length;
            this.logger.debug('Event batch published', {
                batchSize: events.length,
                channels: channelBatches.size,
                eventIds
            });
            return eventIds;
        }
        catch (error) {
            this.logger.error('Failed to publish event batch:', error);
            this.metrics.eventsFailed += events.length;
            throw error;
        }
    }
    async handleIncomingEvent(eventOrBatch, channel) {
        try {
            if (eventOrBatch.type === 'event_batch') {
                for (const event of eventOrBatch.events) {
                    await this.processEvent(event);
                }
                this.metrics.eventsDelivered += eventOrBatch.events.length;
            }
            else {
                await this.processEvent(eventOrBatch);
                this.metrics.eventsDelivered++;
            }
        }
        catch (error) {
            this.logger.error('Failed to handle incoming event:', error);
            this.metrics.eventsFailed++;
        }
    }
    async processEvent(event) {
        const startTime = Date.now();
        try {
            const matchingSubscriptions = this.findMatchingSubscriptions(event);
            if (matchingSubscriptions.length === 0) {
                return;
            }
            if (event.metadata.batchable && event.metadata.priority !== 'critical') {
                await this.addToBatch(event, matchingSubscriptions);
            }
            else {
                await this.deliverEventToSubscriptions(event, matchingSubscriptions);
            }
            const deliveryTime = Date.now() - startTime;
            this.metrics.averageDeliveryTime = (this.metrics.averageDeliveryTime + deliveryTime) / 2;
        }
        catch (error) {
            this.logger.error('Failed to process event:', error, { eventId: event.id });
        }
    }
    async addToBatch(event, subscriptions) {
        for (const subscription of subscriptions) {
            const batchKey = subscription.connectionId;
            if (!this.batchProcessor.has(batchKey)) {
                this.batchProcessor.set(batchKey, {
                    events: [],
                    timeout: setTimeout(() => this.processBatch(batchKey), this.config.batchInterval || 200)
                });
            }
            const batch = this.batchProcessor.get(batchKey);
            batch.events.push(event);
            if (batch.events.length >= 10) {
                clearTimeout(batch.timeout);
                await this.processBatch(batchKey);
            }
        }
    }
    async processBatch(batchKey) {
        try {
            const batch = this.batchProcessor.get(batchKey);
            if (!batch || batch.events.length === 0) {
                return;
            }
            const subscription = Array.from(this.subscriptions.values())
                .find(s => s.connectionId === batchKey);
            if (!subscription) {
                this.batchProcessor.delete(batchKey);
                return;
            }
            const batchEvent = {
                id: this.generateEventId(),
                type: 'system_alert',
                subtype: 'event_batch',
                organizationId: subscription.organizationId,
                data: {
                    events: batch.events.map(e => ({
                        id: e.id,
                        type: e.type,
                        subtype: e.subtype,
                        data: e.data,
                        timestamp: e.metadata.timestamp
                    })),
                    batchSize: batch.events.length
                },
                metadata: {
                    timestamp: new Date(),
                    priority: 'medium',
                    batchable: false,
                    requiresAck: true
                }
            };
            await this.deliverEventToSubscriptions(batchEvent, [subscription]);
            this.batchProcessor.delete(batchKey);
        }
        catch (error) {
            this.logger.error('Failed to process batch:', error, { batchKey });
        }
    }
    async deliverEventToSubscriptions(event, subscriptions) {
        const deliveryPromises = subscriptions.map(async (subscription) => {
            try {
                if (!this.checkEventPermissions(event, subscription)) {
                    return;
                }
                subscription.lastActivity = new Date();
                this.emit('event:deliver', {
                    event,
                    subscription,
                    deliveryTime: new Date()
                });
            }
            catch (error) {
                this.logger.error('Failed to deliver event to subscription:', error, {
                    eventId: event.id,
                    subscriptionId: subscription.id
                });
            }
        });
        await Promise.all(deliveryPromises);
    }
    findMatchingSubscriptions(event) {
        const matching = [];
        for (const subscription of this.subscriptions.values()) {
            if (subscription.organizationId !== event.organizationId) {
                continue;
            }
            if (!this.eventMatchesFilter(event, subscription.filters)) {
                continue;
            }
            matching.push(subscription);
        }
        return matching;
    }
    eventMatchesFilter(event, filter) {
        if (filter.eventTypes && !filter.eventTypes.includes(event.type)) {
            return false;
        }
        if (filter.eventSubtypes && event.subtype && !filter.eventSubtypes.includes(event.subtype)) {
            return false;
        }
        if (filter.priority && !filter.priority.includes(event.metadata.priority)) {
            return false;
        }
        if (filter.timeRange) {
            const eventTime = event.metadata.timestamp.getTime();
            if (eventTime < filter.timeRange.start.getTime() || eventTime > filter.timeRange.end.getTime()) {
                return false;
            }
        }
        if (filter.userId && event.userId !== filter.userId) {
            return false;
        }
        return true;
    }
    checkEventPermissions(event, subscription) {
        if (!event.permissions) {
            return true;
        }
        if (event.permissions.minRole) {
            const roleHierarchy = ['viewer', 'developer', 'manager', 'admin'];
            const userRoleIndex = roleHierarchy.indexOf(subscription.userRole);
            const minRoleIndex = roleHierarchy.indexOf(event.permissions.minRole);
            if (userRoleIndex < minRoleIndex) {
                return false;
            }
        }
        if (event.permissions.roles && !event.permissions.roles.includes(subscription.userRole)) {
            return false;
        }
        if (event.permissions.users && !event.permissions.users.includes(subscription.userId)) {
            return false;
        }
        return true;
    }
    async storeEventInHistory(event) {
        try {
            if (!this.eventHistory.has(event.organizationId)) {
                this.eventHistory.set(event.organizationId, []);
            }
            const orgHistory = this.eventHistory.get(event.organizationId);
            orgHistory.push(event);
            const maxHistory = this.config.maxEventHistory || 1000;
            if (orgHistory.length > maxHistory) {
                orgHistory.splice(0, orgHistory.length - maxHistory);
            }
            const historyKey = `event_history:${event.organizationId}:recent`;
            await this.redisManager.cacheMetrics(historyKey, orgHistory.slice(-100), event.metadata.ttl || 3600);
        }
        catch (error) {
            this.logger.error('Failed to store event in history:', error);
        }
    }
    async replayEventsForSubscription(subscription) {
        try {
            let filter = subscription.filters;
            if (!filter.timeRange) {
                filter = {
                    ...filter,
                    timeRange: {
                        start: new Date(Date.now() - 3600000),
                        end: new Date()
                    }
                };
            }
            const events = await this.getEventHistory(subscription.organizationId, filter, 50);
            if (events.length > 0) {
                const replayEvent = {
                    id: this.generateEventId(),
                    type: 'system_alert',
                    subtype: 'event_replay',
                    organizationId: subscription.organizationId,
                    data: {
                        events: events.map(e => ({
                            id: e.id,
                            type: e.type,
                            subtype: e.subtype,
                            data: e.data,
                            timestamp: e.metadata.timestamp
                        })),
                        replaySize: events.length,
                        subscriptionId: subscription.id
                    },
                    metadata: {
                        timestamp: new Date(),
                        priority: 'medium',
                        batchable: false,
                        replay: false
                    }
                };
                await this.deliverEventToSubscriptions(replayEvent, [subscription]);
                this.logger.info('Event replay completed', {
                    subscriptionId: subscription.id,
                    eventsReplayed: events.length
                });
            }
        }
        catch (error) {
            this.logger.error('Failed to replay events for subscription:', error);
        }
    }
    startBackgroundProcessing() {
        this.processingInterval = setInterval(() => {
            this.processQueuedEvents();
        }, 1000);
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, this.config.cleanupInterval || 300000);
    }
    async processQueuedEvents() {
    }
    cleanup() {
        const now = Date.now();
        const maxAge = 24 * 3600 * 1000;
        for (const [orgId, events] of this.eventHistory.entries()) {
            const validEvents = events.filter(event => {
                const age = now - event.metadata.timestamp.getTime();
                const ttl = (event.metadata.ttl || 3600) * 1000;
                return age < Math.min(maxAge, ttl);
            });
            this.eventHistory.set(orgId, validEvents);
        }
        const inactiveThreshold = 30 * 60 * 1000;
        for (const [subscriptionId, subscription] of this.subscriptions.entries()) {
            const inactiveDuration = now - subscription.lastActivity.getTime();
            if (inactiveDuration > inactiveThreshold) {
                this.subscriptions.delete(subscriptionId);
                this.metrics.activeSubscriptions--;
                this.logger.info('Removed inactive subscription', {
                    subscriptionId,
                    inactiveDuration,
                    organizationId: subscription.organizationId
                });
            }
        }
    }
    generateEventId() {
        return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    generateSubscriptionId() {
        return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    getChannelForEvent(event) {
        return `fortium:events:${event.organizationId}:${event.type}`;
    }
    getChannelsForSubscription(subscription) {
        const channels = [];
        channels.push(`fortium:events:${subscription.organizationId}:*`);
        if (subscription.filters.eventTypes) {
            for (const eventType of subscription.filters.eventTypes) {
                channels.push(`fortium:events:${subscription.organizationId}:${eventType}`);
            }
        }
        return channels;
    }
    async validateSubscription(subscription) {
        try {
            const query = `
        SELECT u.id, u.role, t.id as org_id
        FROM users u
        JOIN tenants t ON u.organization_id = t.id
        WHERE u.id = $1 AND t.id = $2 AND u.is_active = true AND t.is_active = true
      `;
            const result = await this.db.query(query, [subscription.userId, subscription.organizationId]);
            return result.rows.length > 0;
        }
        catch {
            return false;
        }
    }
    async queueEventForProcessing(event) {
    }
    applyEventFilter(events, filter) {
        return events.filter(event => this.eventMatchesFilter(event, filter));
    }
    getMetrics() {
        this.metrics.queueBacklog = this.messageQueue?.length || 0;
        this.metrics.activeSubscriptions = this.subscriptions.size;
        return { ...this.metrics };
    }
    getSubscriptionStats() {
        const stats = {
            totalSubscriptions: this.subscriptions.size,
            subscriptionsByOrganization: new Map(),
            subscriptionsByType: new Map()
        };
        for (const subscription of this.subscriptions.values()) {
            const orgCount = stats.subscriptionsByOrganization.get(subscription.organizationId) || 0;
            stats.subscriptionsByOrganization.set(subscription.organizationId, orgCount + 1);
            if (subscription.filters.eventTypes) {
                for (const eventType of subscription.filters.eventTypes) {
                    const typeCount = stats.subscriptionsByType.get(eventType) || 0;
                    stats.subscriptionsByType.set(eventType, typeCount + 1);
                }
            }
        }
        return {
            ...stats,
            subscriptionsByOrganization: Object.fromEntries(stats.subscriptionsByOrganization),
            subscriptionsByType: Object.fromEntries(stats.subscriptionsByType)
        };
    }
    async shutdown() {
        this.logger.info('Shutting down Real-time Event Service...');
        if (this.processingInterval)
            clearInterval(this.processingInterval);
        if (this.cleanupInterval)
            clearInterval(this.cleanupInterval);
        for (const [batchKey] of this.batchProcessor.entries()) {
            await this.processBatch(batchKey);
        }
        this.subscriptions.clear();
        this.eventQueues.clear();
        this.eventHistory.clear();
        this.batchProcessor.clear();
        this.logger.info('Real-time Event Service shutdown complete');
    }
}
exports.RealtimeEventService = RealtimeEventService;
//# sourceMappingURL=real-time-event.service.js.map