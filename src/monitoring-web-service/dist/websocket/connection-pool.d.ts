import { Socket } from 'socket.io';
import { RedisManager } from '../config/redis.config';
import * as winston from 'winston';
import EventEmitter from 'events';
export interface ConnectionPoolConfig {
    maxConnections: number;
    maxConnectionsPerUser: number;
    maxConnectionsPerOrganization: number;
    connectionTimeout: number;
    healthCheckInterval: number;
    performanceMonitorInterval: number;
    memoryThreshold: number;
    cpuThreshold: number;
}
export interface PooledConnection {
    id: string;
    socket: Socket;
    userId: string;
    organizationId: string;
    userRole: string;
    createdAt: Date;
    lastActivity: Date;
    metadata: {
        ipAddress: string;
        userAgent: string;
        connectionCount: number;
        bytesReceived: number;
        bytesSent: number;
        messagesReceived: number;
        messagesSent: number;
        errorCount: number;
    };
    healthStatus: 'healthy' | 'warning' | 'critical' | 'disconnected';
    poolIndex: number;
}
export interface PoolMetrics {
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
    poolUtilization: number;
    averageResponseTime: number;
    throughput: {
        messagesPerSecond: number;
        bytesPerSecond: number;
    };
    healthScore: number;
    memoryUsage: number;
    cpuUsage: number;
    errors: {
        connectionErrors: number;
        timeoutErrors: number;
        memoryErrors: number;
    };
}
export declare class ConnectionPool extends EventEmitter {
    private redisManager;
    private logger;
    private config;
    private connections;
    private connectionsByUser;
    private connectionsByOrganization;
    private pools;
    private currentPoolIndex;
    private healthCheckInterval;
    private performanceInterval;
    private metrics;
    constructor(redisManager: RedisManager, logger: winston.Logger, config: ConnectionPoolConfig);
    addConnection(socket: Socket, userId: string, organizationId: string, userRole: string): Promise<{
        success: boolean;
        error?: string;
        poolIndex?: number;
    }>;
    removeConnection(connectionId: string): Promise<void>;
    getConnection(connectionId: string): PooledConnection | undefined;
    getUserConnections(userId: string): PooledConnection[];
    getOrganizationConnections(organizationId: string): PooledConnection[];
    private selectOptimalPool;
    private setupConnectionMonitoring;
    private performHealthCheck;
    private updatePerformanceMetrics;
    private cacheConnectionInfo;
    private removeCachedConnectionInfo;
    private initializePools;
    private initializeMetrics;
    private startBackgroundServices;
    getMetrics(): PoolMetrics;
    getPoolStats(): {
        pools: Array<{
            index: number;
            connectionCount: number;
            healthyCount: number;
        }>;
        totalConnections: number;
        distribution: Record<number, number>;
    };
    shutdown(): Promise<void>;
}
//# sourceMappingURL=connection-pool.d.ts.map