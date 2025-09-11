import { EventPublisher } from '../events/event-publisher';
import { RedisManager } from '../config/redis.config';
import { DatabaseConnection } from '../database/connection';
import * as winston from 'winston';
import EventEmitter from 'events';
export interface MetricData {
    id: string;
    type: MetricType;
    organizationId: string;
    userId?: string;
    name: string;
    value: number | string | boolean;
    unit?: string;
    tags: Record<string, string>;
    timestamp: Date;
    metadata: {
        source: string;
        collection_method: string;
        aggregation?: string;
        resolution: number;
        quality_score?: number;
    };
}
export type MetricType = 'counter' | 'gauge' | 'histogram' | 'timer' | 'rate' | 'percentage' | 'bytes' | 'custom';
export interface StreamingMetrics {
    name: string;
    organizationId: string;
    type: MetricType;
    currentValue: number | string | boolean;
    previousValue?: number | string | boolean;
    trend?: 'up' | 'down' | 'stable';
    changePercent?: number;
    updateFrequency: number;
    lastUpdated: Date;
    subscribers: number;
}
export interface MetricsBuffer {
    metrics: MetricData[];
    size: number;
    startTime: Date;
    endTime: Date;
    compressionRatio?: number;
}
export interface StreamingConfig {
    bufferSize: number;
    flushInterval: number;
    compressionEnabled: boolean;
    maxUpdateFrequency: number;
    aggregationWindow: number;
    retentionPeriod: number;
}
export declare class MetricsStream extends EventEmitter {
    private eventPublisher;
    private redisManager;
    private db;
    private logger;
    private config;
    private metricsBuffer;
    private activeStreams;
    private flushTimers;
    private metricsCache;
    private updateFrequencyTracking;
    constructor(eventPublisher: EventPublisher, redisManager: RedisManager, db: DatabaseConnection, logger: winston.Logger, config: StreamingConfig);
    streamMetric(metric: MetricData): Promise<{
        success: boolean;
        buffered: boolean;
        streamed: boolean;
        subscribers?: number;
    }>;
    streamMetricsBatch(metrics: MetricData[]): Promise<{
        success: boolean;
        processedCount: number;
        streamedCount: number;
        bufferedCount: number;
    }>;
    getRealTimeMetrics(organizationId: string, metricNames?: string[], timeRange?: {
        start: Date;
        end: Date;
    }): Promise<{
        metrics: StreamingMetrics[];
        chartData: any[];
        updateFrequency: number;
        lastUpdated: Date;
    }>;
    subscribeToMetric(organizationId: string, metricName: string, options?: {
        updateFrequency?: number;
        aggregation?: 'avg' | 'sum' | 'min' | 'max' | 'count';
        resolution?: number;
    }): Promise<{
        success: boolean;
        subscriptionId?: string;
        currentValue?: any;
    }>;
    getMetricStats(): {
        activeStreams: number;
        totalMetricsBuffered: number;
        bufferUtilization: number;
        averageUpdateFrequency: number;
        topMetrics: Array<{
            name: string;
            updateFreq: number;
            subscribers: number;
        }>;
    };
    private streamMetricImmediately;
    private shouldStreamImmediately;
    private addToBuffer;
    private flushBuffer;
    private updateActiveStream;
    private updateFrequencyTracking;
    private generateMetricKey;
    private groupMetricsByOrganization;
    private compressBuffer;
    private updateTimeSeriesCache;
    private getTimeSeriesData;
    private groupMetricsForChart;
    private setupMetricSubscription;
    private startBackgroundProcessing;
    private performCleanup;
    shutdown(): Promise<void>;
}
//# sourceMappingURL=metrics-stream.d.ts.map