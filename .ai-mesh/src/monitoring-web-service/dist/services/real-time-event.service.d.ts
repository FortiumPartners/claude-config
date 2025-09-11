import { RedisManager } from '../config/redis.config';
import { DatabaseConnection } from '../database/connection';
import * as winston from 'winston';
import EventEmitter from 'events';
export interface RealtimeEvent {
    id: string;
    type: 'metrics_update' | 'dashboard_change' | 'user_activity' | 'system_alert' | 'collaborative_action';
    subtype?: string;
    organizationId: string;
    userId?: string;
    data: any;
    metadata: {
        timestamp: Date;
        priority: 'low' | 'medium' | 'high' | 'critical';
        ttl?: number;
        replay?: boolean;
        batchable?: boolean;
        requiresAck?: boolean;
    };
    permissions?: {
        roles?: string[];
        users?: string[];
        minRole?: 'viewer' | 'developer' | 'manager' | 'admin';
    };
}
export interface EventFilter {
    organizationId?: string;
    userId?: string;
    eventTypes?: string[];
    eventSubtypes?: string[];
    priority?: ('low' | 'medium' | 'high' | 'critical')[];
    timeRange?: {
        start: Date;
        end: Date;
    };
}
export interface EventSubscription {
    id: string;
    connectionId: string;
    organizationId: string;
    userId: string;
    userRole: string;
    filters: EventFilter;
    channels: string[];
    subscribedAt: Date;
    lastActivity: Date;
    acknowledged: Set<string>;
}
export interface EventQueue {
    name: string;
    organizationId: string;
    events: RealtimeEvent[];
    maxSize: number;
    retentionTime: number;
    processingOrder: 'fifo' | 'priority';
}
export interface EventMetrics {
    eventsPublished: number;
    eventsDelivered: number;
    eventsFailed: number;
    averageDeliveryTime: number;
    queueBacklog: number;
    activeSubscriptions: number;
    replayRequests: number;
}
export declare class RealtimeEventService extends EventEmitter {
    private redisManager;
    private db;
    private logger;
    private config;
    private subscriptions;
    private eventQueues;
    private eventHistory;
    private metrics;
    private processingInterval;
    private cleanupInterval;
    private batchProcessor;
    constructor(redisManager: RedisManager, db: DatabaseConnection, logger: winston.Logger, config?: {
        maxEventHistory?: number;
        batchInterval?: number;
        cleanupInterval?: number;
        defaultTTL?: number;
        maxQueueSize?: number;
    });
    private initializeRedisChannels;
    publishEvent(event: Omit<RealtimeEvent, 'id' | 'metadata'> & {
        metadata?: Partial<RealtimeEvent['metadata']>;
    }): Promise<string>;
    subscribe(subscription: Omit<EventSubscription, 'id' | 'subscribedAt' | 'lastActivity' | 'acknowledged'>): Promise<string>;
    unsubscribe(subscriptionId: string): Promise<void>;
    acknowledgeEvent(subscriptionId: string, eventId: string): Promise<void>;
    getEventHistory(organizationId: string, filter: EventFilter, limit?: number): Promise<RealtimeEvent[]>;
    publishEventBatch(events: (Omit<RealtimeEvent, 'id' | 'metadata'> & {
        metadata?: Partial<RealtimeEvent['metadata']>;
    })[]): Promise<string[]>;
    private handleIncomingEvent;
    private processEvent;
    private addToBatch;
    private processBatch;
    private deliverEventToSubscriptions;
    private findMatchingSubscriptions;
    private eventMatchesFilter;
    private checkEventPermissions;
    private storeEventInHistory;
    private replayEventsForSubscription;
    private startBackgroundProcessing;
    private processQueuedEvents;
    private cleanup;
    private generateEventId;
    private generateSubscriptionId;
    private getChannelForEvent;
    private getChannelsForSubscription;
    private validateSubscription;
    private queueEventForProcessing;
    private applyEventFilter;
    getMetrics(): EventMetrics;
    getSubscriptionStats(): any;
    shutdown(): Promise<void>;
}
//# sourceMappingURL=real-time-event.service.d.ts.map