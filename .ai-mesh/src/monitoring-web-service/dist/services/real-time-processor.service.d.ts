import { EventEmitter } from 'events';
import { DatabaseConnection } from '../database/connection';
import { MetricsStreamEvent, AggregatedMetrics } from '../types/metrics';
import * as winston from 'winston';
export interface StreamProcessorConfig {
    aggregationWindows: Array<'1m' | '5m' | '15m' | '1h' | '1d'>;
    maxMemoryUsageMB: number;
    batchSize: number;
    flushIntervalMs: number;
    deadLetterQueueSize: number;
    retryAttempts: number;
    retryDelayMs: number;
}
interface ProcessingStats {
    events_processed: number;
    events_failed: number;
    aggregations_created: number;
    memory_usage_mb: number;
    avg_processing_time_ms: number;
    last_flush: Date;
    uptime_seconds: number;
}
export declare class RealTimeProcessorService extends EventEmitter {
    private metricsModel;
    private logger;
    private config;
    private aggregationBuckets;
    private deadLetterQueue;
    private stats;
    private startTime;
    private flushInterval;
    private memoryMonitorInterval;
    constructor(db: DatabaseConnection, logger: winston.Logger, config?: Partial<StreamProcessorConfig>);
    private startProcessing;
    processStreamEvent(event: MetricsStreamEvent): Promise<void>;
    processBatchEvents(events: MetricsStreamEvent[]): Promise<{
        processed: number;
        failed: number;
        processing_time_ms: number;
    }>;
    private processCommandExecution;
    private processAgentInteraction;
    private processUserSession;
    private processProductivityMetric;
    getCurrentAggregations(organizationId: string, window?: '1m' | '5m' | '15m' | '1h' | '1d', userId?: string): AggregatedMetrics[];
    private flushAggregations;
    private validateStreamEvent;
    private generateBucketKey;
    private getOrCreateBucket;
    private getWindowStart;
    private getWindowEnd;
    private getWindowEndThreshold;
    private persistAggregations;
    private calculateRate;
    private getWindowMinutes;
    private addToDeadLetterQueue;
    private processDeadLetterQueue;
    private updateProcessingStats;
    private monitorMemoryUsage;
    getProcessingStats(): ProcessingStats;
    getDeadLetterQueueStatus(): {
        size: number;
        max_size: number;
        oldest_entry: Date;
    };
    getBucketStats(): Record<string, number>;
    shutdown(): Promise<void>;
}
export {};
//# sourceMappingURL=real-time-processor.service.d.ts.map