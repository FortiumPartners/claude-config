import { KafkaManager } from '../config/kafka.config';
import { RedisManager } from '../config/redis.config';
import { DatabaseConnection } from '../database/connection';
import { MetricsStreamEvent } from '../types/metrics';
import * as winston from 'winston';
export interface ProcessingPipelineConfig {
    batchSize: number;
    batchTimeoutMs: number;
    maxRetries: number;
    parallelism: number;
    aggregationWindowMs: number;
}
export interface ProcessingStats {
    messages_processed: number;
    messages_failed: number;
    processing_rate: number;
    avg_processing_time_ms: number;
    last_processed_at: Date;
    active_consumers: number;
    queue_depth: number;
}
export declare class MetricsProcessingService {
    private kafkaManager;
    private redisManager;
    private metricsModel;
    private producer;
    private consumers;
    private logger;
    private config;
    private isRunning;
    private stats;
    private aggregationBuffer;
    private lastAggregation;
    constructor(kafkaManager: KafkaManager, redisManager: RedisManager, db: DatabaseConnection, logger: winston.Logger, config?: Partial<ProcessingPipelineConfig>);
    start(): Promise<void>;
    stop(): Promise<void>;
    publishMetricsEvent(event: MetricsStreamEvent): Promise<void>;
    private startRawMetricsProcessor;
    private processRawMetricsMessage;
    private processCommandExecution;
    private processAgentInteraction;
    private processUserSession;
    private processProductivityMetric;
    private updateRealTimeCache;
    private updateAggregationBuffer;
    private flushAggregationBuffer;
    private startMetricsAggregator;
    private startAlertProcessor;
    private checkAlertConditions;
    private sendToDeadLetterQueue;
    private validateMetricsEvent;
    private getPartitionForOrganization;
    private getAggregationBucketKey;
    private getTimeBucket;
    private updateAverage;
    private updateErrorRate;
    private categorizeError;
    private categorizePerformance;
    private categorizeInteractionComplexity;
    private calculateProductivityIndex;
    private assessSessionQuality;
    private normalizeMetricValue;
    private calculatePercentileRank;
    private getActiveUserCount;
    private getPerformanceSummary;
    private updateProcessingStats;
    getProcessingStats(): ProcessingStats;
    healthCheck(): Promise<{
        status: 'healthy' | 'unhealthy';
        details: any;
    }>;
}
//# sourceMappingURL=metrics-processing.service.d.ts.map