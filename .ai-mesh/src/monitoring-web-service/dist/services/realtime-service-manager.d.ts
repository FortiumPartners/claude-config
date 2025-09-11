import { Server as HttpServer } from 'http';
import { RedisManager } from '../config/redis.config';
import { DatabaseConnection } from '../database/connection';
import { ConnectionPoolConfig } from '../websocket/connection-pool';
import { AuthConfig } from '../websocket/auth-middleware';
import * as winston from 'winston';
import EventEmitter from 'events';
export interface RealTimeServiceConfig {
    server: {
        cors?: any;
        maxConnections?: number;
        heartbeatInterval?: number;
        performanceMonitoringInterval?: number;
    };
    auth: AuthConfig;
    connectionPool: ConnectionPoolConfig;
    events: {
        batchSize: number;
        batchInterval: number;
        maxRetries: number;
        deduplicationWindow: number;
        historyRetention: number;
        deadLetterRetention: number;
        enableAnalytics: boolean;
    };
    streaming: {
        bufferSize: number;
        flushInterval: number;
        compressionEnabled: boolean;
        maxUpdateFrequency: number;
        aggregationWindow: number;
        retentionPeriod: number;
    };
    presence: {
        idleTimeout: number;
        awayTimeout: number;
        offlineTimeout: number;
        heartbeatInterval: number;
        historyRetention: number;
        enableAnalytics: boolean;
    };
    activity: {
        maxFeedSize: number;
        recentActivityWindow: number;
        relevanceThreshold: number;
        insightsPeriod: number;
        enableAnalytics: boolean;
        enablePersonalization: boolean;
    };
}
export interface ServiceHealth {
    service: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    lastCheck: Date;
    metrics?: any;
    errors?: string[];
}
export interface RealTimeMetrics {
    connections: {
        total: number;
        active: number;
        byOrganization: Record<string, number>;
    };
    events: {
        published: number;
        delivered: number;
        queued: number;
        failed: number;
    };
    streaming: {
        metricsActive: number;
        bufferUtilization: number;
        updateFrequency: number;
    };
    presence: {
        onlineUsers: number;
        totalUsers: number;
        collaborationReadiness: number;
    };
    performance: {
        memoryUsage: number;
        cpuUsage: number;
        responseTime: number;
        errorRate: number;
    };
}
export declare class RealTimeServiceManager extends EventEmitter {
    private httpServer;
    private redisManager;
    private db;
    private logger;
    private config;
    private io;
    private roomManager;
    private connectionPool;
    private authMiddleware;
    private eventPublisher;
    private eventSubscriber;
    private metricsStream;
    private activityFeed;
    private presenceManager;
    private healthCheckInterval;
    private metricsInterval;
    private serviceHealth;
    private isShuttingDown;
    constructor(httpServer: HttpServer, redisManager: RedisManager, db: DatabaseConnection, logger: winston.Logger, config: RealTimeServiceConfig);
    private initializeServices;
    private initializeSocketIO;
    private setupSocketIOHandlers;
    private handleNewConnection;
    private setupSocketEventHandlers;
    private handleDisconnection;
    private startHealthMonitoring;
    private performHealthCheck;
    private collectMetrics;
    getServiceHealth(): Record<string, ServiceHealth>;
    getOrganizationMetrics(organizationId: string): Promise<any>;
    publishSystemAlert(organizationId: string, alertType: string, alertData: any, priority?: 'low' | 'medium' | 'high' | 'critical'): Promise<void>;
    shutdown(): Promise<void>;
}
//# sourceMappingURL=realtime-service-manager.d.ts.map