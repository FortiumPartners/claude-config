import { DatabaseConnection } from '../database/connection';
import { RateLimitConfig, RateLimitStatus, PerformanceMetrics } from '../types/metrics';
import * as winston from 'winston';
export interface CollectionResult {
    success: boolean;
    message?: string;
    data?: any;
    rate_limit?: RateLimitStatus;
    performance?: Partial<PerformanceMetrics>;
}
export interface BatchCollectionResult extends CollectionResult {
    data?: {
        command_executions: number;
        agent_interactions: number;
        user_sessions: number;
        productivity_metrics: number;
        processing_time_ms: number;
    };
}
export declare class MetricsCollectionService {
    private metricsModel;
    private rateLimitStore;
    private logger;
    private defaultRateLimit;
    private performanceStats;
    constructor(db: DatabaseConnection, logger: winston.Logger);
    collectCommandExecution(organizationId: string, data: any, rateLimitConfig?: RateLimitConfig): Promise<CollectionResult>;
    collectAgentInteraction(organizationId: string, data: any, rateLimitConfig?: RateLimitConfig): Promise<CollectionResult>;
    startUserSession(organizationId: string, data: any, rateLimitConfig?: RateLimitConfig): Promise<CollectionResult>;
    updateUserSession(organizationId: string, sessionId: string, data: any, rateLimitConfig?: RateLimitConfig): Promise<CollectionResult>;
    collectProductivityMetric(organizationId: string, data: any, rateLimitConfig?: RateLimitConfig): Promise<CollectionResult>;
    collectBatchMetrics(organizationId: string, batch: any, rateLimitConfig?: RateLimitConfig): Promise<BatchCollectionResult>;
    private checkRateLimit;
    private cleanupRateLimitCache;
    private updatePerformanceStats;
    private resetPerformanceStats;
    getPerformanceMetrics(): Promise<PerformanceMetrics>;
    getCollectionStats(): {
        success_rate: number;
        rate_limit_cache_size: number;
        total_requests: number;
        successful_requests: number;
        failed_requests: number;
        avg_processing_time_ms: number;
        last_reset: Date;
    };
}
//# sourceMappingURL=metrics-collection.service.d.ts.map