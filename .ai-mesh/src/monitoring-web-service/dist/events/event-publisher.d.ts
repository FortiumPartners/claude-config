import { RedisManager } from '../config/redis.config';
import { DatabaseConnection } from '../database/connection';
import * as winston from 'winston';
import EventEmitter from 'events';
export interface PublishedEvent {
    id: string;
    type: EventType;
    source: string;
    organizationId: string;
    userId?: string;
    data: any;
    metadata: {
        version: string;
        timestamp: Date;
        correlationId?: string;
        priority: EventPriority;
        ttl?: number;
        retryCount?: number;
        tags?: string[];
    };
    routing: {
        rooms: string[];
        userIds?: string[];
        roles?: string[];
        permissions?: string[];
        excludeUsers?: string[];
    };
}
export type EventType = 'metrics_updated' | 'dashboard_changed' | 'user_activity' | 'system_alert' | 'collaboration_event' | 'notification' | 'presence_update' | 'real_time_data' | 'configuration_change' | 'security_event';
export type EventPriority = 'low' | 'medium' | 'high' | 'critical';
export interface EventPublishResult {
    success: boolean;
    eventId: string;
    published: boolean;
    queued: boolean;
    recipientCount?: number;
    error?: string;
    processingTime: number;
}
export interface BatchPublishResult {
    totalEvents: number;
    successfulEvents: number;
    failedEvents: number;
    queuedEvents: number;
    processingTime: number;
    errors: Array<{
        eventId: string;
        error: string;
    }>;
}
export interface EventMetrics {
    totalPublished: number;
    publishedByType: Record<EventType, number>;
    publishedByPriority: Record<EventPriority, number>;
    averageProcessingTime: number;
    successRate: number;
    queueSize: number;
    deadLetterQueueSize: number;
}
export declare class EventPublisher extends EventEmitter {
    private redisManager;
    private db;
    private logger;
    private config;
    private publishQueue;
    private deadLetterQueue;
    private eventHistory;
    private deduplicationCache;
    private metrics;
    private batchTimer;
    private isProcessing;
    constructor(redisManager: RedisManager, db: DatabaseConnection, logger: winston.Logger, config: {
        batchSize: number;
        batchInterval: number;
        maxRetries: number;
        deduplicationWindow: number;
        historyRetention: number;
        deadLetterRetention: number;
        enableAnalytics: boolean;
    });
    publishEvent(eventData: {
        type: EventType;
        source: string;
        organizationId: string;
        userId?: string;
        data: any;
        routing: PublishedEvent['routing'];
        priority?: EventPriority;
        correlationId?: string;
        ttl?: number;
        tags?: string[];
    }): Promise<EventPublishResult>;
    publishBatch(events: Parameters<typeof this.publishEvent>[0][]): Promise<BatchPublishResult>;
    publishDashboardUpdate(organizationId: string, dashboardId: string, updateData: any, userId?: string, priority?: EventPriority): Promise<EventPublishResult>;
    publishMetricsUpdate(organizationId: string, metricType: string, metricsData: any, priority?: EventPriority): Promise<EventPublishResult>;
    publishUserActivity(organizationId: string, userId: string, activityType: string, activityData: any, priority?: EventPriority): Promise<EventPublishResult>;
    publishSystemAlert(organizationId: string, alertType: string, alertData: any, priority?: EventPriority): Promise<EventPublishResult>;
    publishCollaborativeEvent(organizationId: string, dashboardId: string, userId: string, collaborativeData: any, priority?: EventPriority): Promise<EventPublishResult>;
    private publishEventImmediately;
    private startBatchProcessor;
    private processBatch;
    private storeEventAnalytics;
    private generateEventId;
    private generateDeduplicationKey;
    private initializeMetrics;
    private updateMetrics;
    private startCleanupService;
    getMetrics(): EventMetrics;
    getQueueStatus(): {
        publishQueue: number;
        deadLetterQueue: number;
        isProcessing: boolean;
    };
    getEventHistory(organizationId: string, limit?: number): PublishedEvent[];
    shutdown(): Promise<void>;
}
//# sourceMappingURL=event-publisher.d.ts.map