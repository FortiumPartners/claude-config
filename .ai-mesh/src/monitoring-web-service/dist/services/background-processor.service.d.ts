import { EventEmitter } from 'events';
import { DatabaseConnection } from '../database/connection';
import { RealTimeProcessorService } from './real-time-processor.service';
import { MetricsQueryService } from './metrics-query.service';
import * as winston from 'winston';
export interface JobConfig {
    enabled: boolean;
    schedule: string;
    timeout_ms: number;
    retry_attempts: number;
    retry_delay_ms: number;
}
export interface HealthThresholds {
    max_memory_usage_mb: number;
    max_cpu_usage_percent: number;
    min_available_connections: number;
    max_query_response_time_ms: number;
    max_error_rate_percent: number;
}
interface JobResult {
    success: boolean;
    duration_ms: number;
    records_processed?: number;
    error?: string;
    details?: Record<string, any>;
}
interface JobExecution {
    job_name: string;
    started_at: Date;
    completed_at?: Date;
    result?: JobResult;
    attempt: number;
}
interface SystemAlert {
    level: 'warning' | 'error' | 'critical';
    component: string;
    message: string;
    timestamp: Date;
    details?: Record<string, any>;
}
export declare class BackgroundProcessorService extends EventEmitter {
    private metricsModel;
    private realTimeProcessor?;
    private queryService?;
    private logger;
    private db;
    private jobConfigs;
    private retentionPolicies;
    private healthThresholds;
    private jobHistory;
    private readonly maxHistorySize;
    private scheduledJobs;
    private activeAlerts;
    constructor(db: DatabaseConnection, logger: winston.Logger, realTimeProcessor?: RealTimeProcessorService, queryService?: MetricsQueryService);
    private initializeJobs;
    private executeJob;
    private runDataRetention;
    private runBatchAggregation;
    private runSystemHealthCheck;
    private runPerformanceAnalysis;
    private runPartitionMaintenance;
    private trimJobHistory;
    private createAlert;
    private clearResolvedAlerts;
    private vacuumTables;
    private getLastAggregationTimestamp;
    private updateLastAggregationTimestamp;
    private createBatchAggregations;
    private analyzePerformanceTrends;
    private generatePerformanceReport;
    private storePerformanceMetrics;
    private createUpcomingPartitions;
    private dropOldPartitions;
    private analyzePartitionStats;
    getJobHistory(jobName?: string): JobExecution[];
    getActiveAlerts(): SystemAlert[];
    getJobStatuses(): Record<string, any>;
    manualJobExecution(jobName: string): Promise<JobResult>;
    updateJobConfig(jobName: string, config: Partial<JobConfig>): void;
    shutdown(): Promise<void>;
}
export {};
//# sourceMappingURL=background-processor.service.d.ts.map