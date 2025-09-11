import * as winston from 'winston';
import { EventEmitter } from 'events';
export interface CustomMetric {
    metricName: string;
    namespace: string;
    value: number;
    unit: 'Count' | 'Percent' | 'Seconds' | 'Milliseconds' | 'Bytes';
    dimensions?: Array<{
        Name: string;
        Value: string;
    }>;
    timestamp?: Date;
}
export interface PerformanceDashboard {
    dashboardName: string;
    widgets: DashboardWidget[];
    refreshInterval: number;
    autoRefresh: boolean;
}
export interface DashboardWidget {
    id: string;
    type: 'metric' | 'log' | 'number' | 'alarm';
    title: string;
    metrics: string[];
    period: number;
    stat: 'Average' | 'Sum' | 'Maximum' | 'Minimum' | 'SampleCount';
    region: string;
    yAxis?: {
        left?: {
            min?: number;
            max?: number;
        };
        right?: {
            min?: number;
            max?: number;
        };
    };
}
export interface MetricAlert {
    alertName: string;
    metricName: string;
    namespace: string;
    threshold: number;
    comparisonOperator: 'GreaterThanThreshold' | 'LessThanThreshold' | 'GreaterThanOrEqualToThreshold' | 'LessThanOrEqualToThreshold';
    evaluationPeriods: number;
    period: number;
    treatMissingData: 'breaching' | 'notBreaching' | 'ignore' | 'missing';
    snsTopicArn?: string;
    enabled: boolean;
}
export declare class CloudWatchMonitoringService extends EventEmitter {
    private logger;
    private config;
    private cloudwatch;
    private cloudwatchLogs;
    private metricBuffer;
    private publishInterval;
    private logGroupName;
    private logStreamName;
    constructor(logger: winston.Logger, config: {
        region: string;
        namespace: string;
        logGroupName: string;
        bufferSize: number;
        publishIntervalMs: number;
        enableMetricBuffering: boolean;
        enableDashboards: boolean;
        enableAlerts: boolean;
    });
    publishMetric(metric: CustomMetric): Promise<void>;
    publishPerformanceMetrics(metrics: {
        apiResponseTime: number;
        databaseQueryTime: number;
        cacheHitRate: number;
        activeConnections: number;
        memoryUsage: number;
        cpuUsage: number;
        organizationId?: string;
    }): Promise<void>;
    publishBusinessMetrics(metrics: {
        dailyActiveUsers: number;
        sessionCount: number;
        averageProductivityScore: number;
        toolUsageCount: number;
        organizationId?: string;
    }): Promise<void>;
    createPerformanceDashboard(): Promise<string>;
    createMetricAlerts(): Promise<string[]>;
    logEvent(event: {
        level: 'INFO' | 'WARN' | 'ERROR';
        message: string;
        metadata?: Record<string, any>;
    }): Promise<void>;
    getMetricStatistics(params: {
        metricName: string;
        namespace: string;
        startTime: Date;
        endTime: Date;
        period: number;
        statistics: string[];
        dimensions?: Array<{
            Name: string;
            Value: string;
        }>;
    }): Promise<any>;
    private setupLogStream;
    private startMetricPublishing;
    private flushMetricBuffer;
    private publishSingleMetric;
    private publishMetricBatch;
    private createSingleAlert;
    shutdown(): Promise<void>;
}
//# sourceMappingURL=cloudwatch-monitoring.service.d.ts.map