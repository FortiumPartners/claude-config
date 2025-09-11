import { Server } from 'socket.io';
import { RedisManager } from '../config/redis.config';
import * as winston from 'winston';
import EventEmitter from 'events';
export interface PerformanceMetrics {
    timestamp: Date;
    connections: {
        total: number;
        active: number;
        idle: number;
        failed: number;
    };
    latency: {
        average: number;
        p50: number;
        p95: number;
        p99: number;
    };
    throughput: {
        messagesPerSecond: number;
        bytesPerSecond: number;
        eventsPerSecond: number;
    };
    memory: {
        heapUsed: number;
        heapTotal: number;
        external: number;
        rss: number;
    };
    cpu: {
        usage: number;
        loadAverage: number[];
    };
    errors: {
        connectionErrors: number;
        timeoutErrors: number;
        authErrors: number;
        totalErrors: number;
    };
    quality: {
        successRate: number;
        availability: number;
        reliability: number;
    };
}
export interface ConnectionPerformance {
    socketId: string;
    userId: string;
    organizationId: string;
    metrics: {
        connectedAt: Date;
        lastActivity: Date;
        messagesReceived: number;
        messagesSent: number;
        bytesReceived: number;
        bytesSent: number;
        averageLatency: number;
        errorCount: number;
        reconnections: number;
    };
    quality: {
        connectionStability: number;
        responseTime: number;
        dataIntegrity: number;
    };
}
export interface PerformanceAlert {
    id: string;
    type: 'latency' | 'throughput' | 'memory' | 'cpu' | 'errors' | 'availability';
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    value: number;
    threshold: number;
    timestamp: Date;
    organizationId?: string;
    metadata?: Record<string, any>;
}
export declare class PerformanceMonitor extends EventEmitter {
    private io;
    private redisManager;
    private logger;
    private config;
    private metrics;
    private connectionPerformance;
    private latencyHistory;
    private throughputHistory;
    private errorHistory;
    private alerts;
    private monitoringInterval;
    private performanceBaseline;
    constructor(io: Server, redisManager: RedisManager, logger: winston.Logger, config: {
        monitoringInterval: number;
        historySize: number;
        alertThresholds: {
            maxLatency: number;
            minThroughput: number;
            maxMemoryUsage: number;
            maxCpuUsage: number;
            maxErrorRate: number;
            minAvailability: number;
        };
        enablePredictiveAnalysis: boolean;
        baselineCalibrationPeriod: number;
    });
    startConnectionTracking(socketId: string, userId: string, organizationId: string): void;
    updateConnectionActivity(socketId: string, activity: {
        messageReceived?: boolean;
        messageSent?: boolean;
        bytesReceived?: number;
        bytesSent?: number;
        latency?: number;
        error?: boolean;
    }): void;
    stopConnectionTracking(socketId: string): ConnectionPerformance | null;
    getCurrentMetrics(): PerformanceMetrics;
    getConnectionPerformance(socketId?: string): ConnectionPerformance[];
    getOrganizationPerformance(organizationId: string): {
        connectionCount: number;
        averageLatency: number;
        totalThroughput: number;
        errorRate: number;
        qualityScore: number;
    };
    getActiveAlerts(): PerformanceAlert[];
    getPerformanceTrends(): {
        latency: {
            timestamps: Date[];
            values: number[];
        };
        throughput: {
            timestamps: Date[];
            values: number[];
        };
        errors: {
            timestamps: Date[];
            values: number[];
        };
    };
    private initializeMetrics;
    private startMonitoring;
    private collectMetrics;
    private updateHistory;
    private analyzePerformance;
    private establishBaseline;
    private performPredictiveAnalysis;
    private checkAlertThresholds;
    private calculatePercentile;
    private calculateTrend;
    shutdown(): Promise<void>;
}
//# sourceMappingURL=performance-monitor.d.ts.map