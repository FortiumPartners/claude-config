"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventPublisher = void 0;
const events_1 = __importDefault(require("events"));
const crypto = __importStar(require("crypto"));
class EventPublisher extends events_1.default {
    redisManager;
    db;
    logger;
    config;
    publishQueue = [];
    deadLetterQueue = [];
    eventHistory = new Map();
    deduplicationCache = new Set();
    metrics;
    batchTimer = null;
    isProcessing = false;
    constructor(redisManager, db, logger, config) {
        super();
        this.redisManager = redisManager;
        this.db = db;
        this.logger = logger;
        this.config = config;
        this.initializeMetrics();
        this.startBatchProcessor();
        this.startCleanupService();
    }
    async publishEvent(eventData) {
        const startTime = Date.now();
        try {
            const event = {
                id: this.generateEventId(),
                type: eventData.type,
                source: eventData.source,
                organizationId: eventData.organizationId,
                userId: eventData.userId,
                data: eventData.data,
                metadata: {
                    version: '1.0',
                    timestamp: new Date(),
                    correlationId: eventData.correlationId,
                    priority: eventData.priority || 'medium',
                    ttl: eventData.ttl,
                    retryCount: 0,
                    tags: eventData.tags
                },
                routing: eventData.routing
            };
            const deduplicationKey = this.generateDeduplicationKey(event);
            if (this.deduplicationCache.has(deduplicationKey)) {
                return {
                    success: true,
                    eventId: event.id,
                    published: false,
                    queued: false,
                    processingTime: Date.now() - startTime
                };
            }
            this.deduplicationCache.add(deduplicationKey);
            setTimeout(() => {
                this.deduplicationCache.delete(deduplicationKey);
            }, this.config.deduplicationWindow);
            this.eventHistory.set(event.id, event);
            if (event.metadata.priority === 'critical') {
                const result = await this.publishEventImmediately(event);
                this.updateMetrics(event, result.success);
                return {
                    success: result.success,
                    eventId: event.id,
                    published: result.success,
                    queued: false,
                    recipientCount: result.recipientCount,
                    error: result.error,
                    processingTime: Date.now() - startTime
                };
            }
            else {
                this.publishQueue.push(event);
                if (this.publishQueue.length >= this.config.batchSize) {
                    this.processBatch();
                }
                return {
                    success: true,
                    eventId: event.id,
                    published: false,
                    queued: true,
                    processingTime: Date.now() - startTime
                };
            }
        }
        catch (error) {
            this.logger.error('Failed to publish event:', error);
            return {
                success: false,
                eventId: '',
                published: false,
                queued: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                processingTime: Date.now() - startTime
            };
        }
    }
    async publishBatch(events) {
        const startTime = Date.now();
        try {
            const results = await Promise.allSettled(events.map(eventData => this.publishEvent(eventData)));
            const batchResult = {
                totalEvents: events.length,
                successfulEvents: 0,
                failedEvents: 0,
                queuedEvents: 0,
                processingTime: Date.now() - startTime,
                errors: []
            };
            results.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    if (result.value.success) {
                        if (result.value.published) {
                            batchResult.successfulEvents++;
                        }
                        else if (result.value.queued) {
                            batchResult.queuedEvents++;
                        }
                    }
                    else {
                        batchResult.failedEvents++;
                        if (result.value.error) {
                            batchResult.errors.push({
                                eventId: result.value.eventId || `event_${index}`,
                                error: result.value.error
                            });
                        }
                    }
                }
                else {
                    batchResult.failedEvents++;
                    batchResult.errors.push({
                        eventId: `event_${index}`,
                        error: result.reason?.message || 'Unknown error'
                    });
                }
            });
            return batchResult;
        }
        catch (error) {
            this.logger.error('Failed to publish event batch:', error);
            return {
                totalEvents: events.length,
                successfulEvents: 0,
                failedEvents: events.length,
                queuedEvents: 0,
                processingTime: Date.now() - startTime,
                errors: [{ eventId: 'batch', error: error instanceof Error ? error.message : 'Unknown error' }]
            };
        }
    }
    async publishDashboardUpdate(organizationId, dashboardId, updateData, userId, priority = 'medium') {
        return this.publishEvent({
            type: 'dashboard_changed',
            source: 'dashboard-service',
            organizationId,
            userId,
            data: {
                dashboardId,
                updateType: 'metrics_refresh',
                updates: updateData,
                timestamp: new Date()
            },
            routing: {
                rooms: [`dashboard:${organizationId}:${dashboardId}`],
                userIds: userId ? [userId] : undefined
            },
            priority,
            tags: ['dashboard', 'metrics', 'real-time']
        });
    }
    async publishMetricsUpdate(organizationId, metricType, metricsData, priority = 'high') {
        return this.publishEvent({
            type: 'metrics_updated',
            source: 'metrics-collector',
            organizationId,
            data: {
                metricType,
                metrics: metricsData,
                timestamp: new Date()
            },
            routing: {
                rooms: [`metrics:${organizationId}:${metricType}`]
            },
            priority,
            tags: ['metrics', 'real-time', metricType]
        });
    }
    async publishUserActivity(organizationId, userId, activityType, activityData, priority = 'low') {
        return this.publishEvent({
            type: 'user_activity',
            source: 'activity-tracker',
            organizationId,
            userId,
            data: {
                activityType,
                activity: activityData,
                timestamp: new Date()
            },
            routing: {
                rooms: [`org:${organizationId}`],
                userIds: [userId]
            },
            priority,
            tags: ['activity', 'user', activityType]
        });
    }
    async publishSystemAlert(organizationId, alertType, alertData, priority = 'critical') {
        return this.publishEvent({
            type: 'system_alert',
            source: 'monitoring-system',
            organizationId,
            data: {
                alertType,
                alert: alertData,
                severity: priority,
                timestamp: new Date()
            },
            routing: {
                rooms: [`org:${organizationId}`],
                roles: ['admin', 'manager']
            },
            priority,
            tags: ['alert', 'system', alertType]
        });
    }
    async publishCollaborativeEvent(organizationId, dashboardId, userId, collaborativeData, priority = 'high') {
        return this.publishEvent({
            type: 'collaboration_event',
            source: 'collaboration-service',
            organizationId,
            userId,
            data: {
                dashboardId,
                collaboration: collaborativeData,
                timestamp: new Date()
            },
            routing: {
                rooms: [`dashboard:${organizationId}:${dashboardId}`],
                excludeUsers: [userId]
            },
            priority,
            tags: ['collaboration', 'real-time']
        });
    }
    async publishEventImmediately(event) {
        try {
            let totalRecipients = 0;
            for (const room of event.routing.rooms) {
                const channel = `events:${room}`;
                const message = JSON.stringify({
                    eventId: event.id,
                    type: event.type,
                    data: event.data,
                    metadata: event.metadata,
                    routing: event.routing
                });
                await this.redisManager.client.publish(channel, message);
                const subscribers = await this.redisManager.client.pubsub('NUMSUB', channel);
                if (subscribers && Array.isArray(subscribers) && subscribers.length > 1) {
                    totalRecipients += parseInt(subscribers[1]) || 0;
                }
            }
            if (this.config.enableAnalytics) {
                await this.storeEventAnalytics(event);
            }
            this.logger.debug('Event published immediately', {
                eventId: event.id,
                type: event.type,
                organizationId: event.organizationId,
                recipientCount: totalRecipients,
                rooms: event.routing.rooms
            });
            return { success: true, recipientCount: totalRecipients };
        }
        catch (error) {
            this.logger.error('Failed to publish event immediately:', error);
            event.metadata.retryCount = (event.metadata.retryCount || 0) + 1;
            if (event.metadata.retryCount <= this.config.maxRetries) {
                this.deadLetterQueue.push(event);
            }
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    startBatchProcessor() {
        this.batchTimer = setInterval(() => {
            if (this.publishQueue.length > 0 && !this.isProcessing) {
                this.processBatch();
            }
        }, this.config.batchInterval);
    }
    async processBatch() {
        if (this.isProcessing || this.publishQueue.length === 0)
            return;
        this.isProcessing = true;
        const batch = this.publishQueue.splice(0, this.config.batchSize);
        try {
            const eventsByRoom = new Map();
            for (const event of batch) {
                for (const room of event.routing.rooms) {
                    if (!eventsByRoom.has(room)) {
                        eventsByRoom.set(room, []);
                    }
                    eventsByRoom.get(room).push(event);
                }
            }
            const publishPromises = Array.from(eventsByRoom.entries()).map(async ([room, events]) => {
                const channel = `events:${room}`;
                const batchMessage = JSON.stringify({
                    type: 'batch_events',
                    events: events.map(event => ({
                        eventId: event.id,
                        type: event.type,
                        data: event.data,
                        metadata: event.metadata,
                        routing: event.routing
                    })),
                    timestamp: new Date()
                });
                await this.redisManager.client.publish(channel, batchMessage);
            });
            await Promise.allSettled(publishPromises);
            batch.forEach(event => this.updateMetrics(event, true));
            if (this.config.enableAnalytics) {
                await Promise.all(batch.map(event => this.storeEventAnalytics(event)));
            }
            this.logger.debug('Event batch processed', {
                batchSize: batch.length,
                roomCount: eventsByRoom.size
            });
        }
        catch (error) {
            this.logger.error('Failed to process event batch:', error);
            batch.forEach(event => {
                event.metadata.retryCount = (event.metadata.retryCount || 0) + 1;
                if (event.metadata.retryCount <= this.config.maxRetries) {
                    this.deadLetterQueue.push(event);
                }
            });
        }
        finally {
            this.isProcessing = false;
        }
    }
    async storeEventAnalytics(event) {
        try {
            const analyticsKey = `analytics:events:${event.organizationId}:${event.type}:${new Date().toISOString().slice(0, 10)}`;
            await this.redisManager.client.hincrby(analyticsKey, 'count', 1);
            await this.redisManager.client.hincrby(analyticsKey, `priority_${event.metadata.priority}`, 1);
            await this.redisManager.client.expire(analyticsKey, 86400 * 30);
        }
        catch (error) {
            this.logger.warn('Failed to store event analytics:', error);
        }
    }
    generateEventId() {
        return `evt_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    }
    generateDeduplicationKey(event) {
        const key = JSON.stringify({
            type: event.type,
            source: event.source,
            organizationId: event.organizationId,
            data: event.data,
            correlationId: event.metadata.correlationId
        });
        return crypto.createHash('sha256').update(key).digest('hex');
    }
    initializeMetrics() {
        this.metrics = {
            totalPublished: 0,
            publishedByType: {},
            publishedByPriority: {},
            averageProcessingTime: 0,
            successRate: 0,
            queueSize: 0,
            deadLetterQueueSize: 0
        };
    }
    updateMetrics(event, success) {
        this.metrics.totalPublished++;
        if (!this.metrics.publishedByType[event.type]) {
            this.metrics.publishedByType[event.type] = 0;
        }
        this.metrics.publishedByType[event.type]++;
        if (!this.metrics.publishedByPriority[event.metadata.priority]) {
            this.metrics.publishedByPriority[event.metadata.priority] = 0;
        }
        this.metrics.publishedByPriority[event.metadata.priority]++;
        this.metrics.queueSize = this.publishQueue.length;
        this.metrics.deadLetterQueueSize = this.deadLetterQueue.length;
    }
    startCleanupService() {
        setInterval(() => {
            const cutoffTime = Date.now() - this.config.historyRetention;
            for (const [eventId, event] of this.eventHistory.entries()) {
                if (event.metadata.timestamp.getTime() < cutoffTime) {
                    this.eventHistory.delete(eventId);
                }
            }
            const dlqCutoff = Date.now() - this.config.deadLetterRetention;
            this.deadLetterQueue = this.deadLetterQueue.filter(event => event.metadata.timestamp.getTime() > dlqCutoff);
        }, 300000);
    }
    getMetrics() {
        return { ...this.metrics };
    }
    getQueueStatus() {
        return {
            publishQueue: this.publishQueue.length,
            deadLetterQueue: this.deadLetterQueue.length,
            isProcessing: this.isProcessing
        };
    }
    getEventHistory(organizationId, limit = 100) {
        return Array.from(this.eventHistory.values())
            .filter(event => event.organizationId === organizationId)
            .sort((a, b) => b.metadata.timestamp.getTime() - a.metadata.timestamp.getTime())
            .slice(0, limit);
    }
    async shutdown() {
        this.logger.info('Shutting down Event Publisher...');
        if (this.batchTimer) {
            clearInterval(this.batchTimer);
        }
        if (this.publishQueue.length > 0) {
            await this.processBatch();
        }
        this.publishQueue.length = 0;
        this.deadLetterQueue.length = 0;
        this.eventHistory.clear();
        this.deduplicationCache.clear();
        this.logger.info('Event Publisher shutdown complete');
    }
}
exports.EventPublisher = EventPublisher;
//# sourceMappingURL=event-publisher.js.map