import { Server, Socket } from 'socket.io';
import { RedisManager } from '../config/redis.config';
import { DatabaseConnection } from '../database/connection';
import * as winston from 'winston';
import EventEmitter from 'events';
import { EventType, EventPriority } from './event-publisher';
export interface EventSubscription {
    id: string;
    socketId: string;
    userId: string;
    organizationId: string;
    userRole: string;
    eventTypes: EventType[];
    rooms: string[];
    filters: SubscriptionFilter;
    permissions: string[];
    createdAt: Date;
    lastActivity: Date;
    metadata: {
        subscriptionCount: number;
        eventsReceived: number;
        eventsFiltered: number;
        averageLatency: number;
    };
}
export interface SubscriptionFilter {
    priority?: EventPriority[];
    tags?: string[];
    sources?: string[];
    userIds?: string[];
    excludeUsers?: string[];
    timeRange?: {
        start: Date;
        end: Date;
    };
    dataFilters?: Record<string, any>;
}
export interface SubscriptionMetrics {
    totalSubscriptions: number;
    subscriptionsByType: Record<EventType, number>;
    subscriptionsByRoom: Record<string, number>;
    eventsDelivered: number;
    eventsFiltered: number;
    averageDeliveryLatency: number;
    subscriptionHealth: number;
}
export interface EventDelivery {
    subscriptionId: string;
    eventId: string;
    deliveredAt: Date;
    latency: number;
    success: boolean;
    error?: string;
}
export declare class EventSubscriber extends EventEmitter {
    private io;
    private redisManager;
    private db;
    private logger;
    private config;
    private subscriptions;
    private socketSubscriptions;
    private roomSubscriptions;
    private redisSubscriptions;
    private metrics;
    private deliveryHistory;
    constructor(io: Server, redisManager: RedisManager, db: DatabaseConnection, logger: winston.Logger, config: {
        maxSubscriptionsPerUser: number;
        subscriptionTtl: number;
        deliveryTimeout: number;
        historyRetention: number;
        enableReplay: boolean;
        replayBufferSize: number;
    });
    subscribe(socket: Socket, subscriptionRequest: {
        eventTypes: EventType[];
        rooms: string[];
        filters?: SubscriptionFilter;
        replayHistory?: boolean;
        replayCount?: number;
    }): Promise<{
        success: boolean;
        subscriptionId?: string;
        error?: string;
        eventsReplayed?: number;
    }>;
    unsubscribe(socketId: string, subscriptionId?: string): Promise<{
        success: boolean;
        unsubscribedCount: number;
    }>;
    updateSubscriptionFilters(subscriptionId: string, newFilters: SubscriptionFilter): Promise<{
        success: boolean;
        error?: string;
    }>;
    private handleRedisEvent;
    private deliverEventToSubscribers;
    private eventMatchesSubscription;
    private subscribeToRedisChannels;
    private replayEvents;
    private validateEventPermissions;
    private validateRoomAccess;
    private generateSubscriptionId;
    private getNestedProperty;
    private persistSubscription;
    private removeSubscription;
    private recordEventDelivery;
    private initializeMetrics;
    private updateSubscriptionMetrics;
    private startBackgroundServices;
    private performSubscriptionHealthCheck;
    private setupRedisSubscriptionHandling;
    getUserSubscriptions(userId: string): EventSubscription[];
    getSubscriptionMetrics(): SubscriptionMetrics;
    getSubscriptionById(subscriptionId: string): EventSubscription | undefined;
    shutdown(): Promise<void>;
}
//# sourceMappingURL=event-subscriber.d.ts.map