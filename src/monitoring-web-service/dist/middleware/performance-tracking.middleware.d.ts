import { Request, Response, NextFunction } from 'express';
import { PerformanceOptimizationService } from '../services/performance-optimization.service';
import { CloudWatchMonitoringService } from '../services/cloudwatch-monitoring.service';
import { RedisManager } from '../config/redis.config';
import * as winston from 'winston';
export interface PerformanceMetrics {
    requestId: string;
    method: string;
    path: string;
    statusCode: number;
    responseTime: number;
    databaseQueryTime: number;
    cacheHitRate: number;
    memoryUsage: number;
    cpuUsage: number;
    organizationId?: string;
    userId?: string;
    timestamp: Date;
}
export interface RequestPerformanceContext {
    startTime: number;
    startCpuUsage: NodeJS.CpuUsage;
    startMemory: NodeJS.MemoryUsage;
    databaseQueries: Array<{
        duration: number;
        query: string;
    }>;
    cacheOperations: Array<{
        hit: boolean;
        key: string;
        operation: 'get' | 'set';
    }>;
}
export declare function createPerformanceTrackingMiddleware(optimizationService: PerformanceOptimizationService, cloudwatchService: CloudWatchMonitoringService, redisManager: RedisManager, logger: winston.Logger, config: {
    enableCloudWatchMetrics: boolean;
    enableQueryTracking: boolean;
    sampleRate: number;
    slowRequestThresholdMs: number;
    excludePaths: string[];
}): (req: Request & {
    performance?: RequestPerformanceContext;
}, res: Response, next: NextFunction) => void;
export declare function createPerformanceSummaryMiddleware(optimizationService: PerformanceOptimizationService, logger: winston.Logger): (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare function createOptimizationEndpointMiddleware(optimizationService: PerformanceOptimizationService, logger: winston.Logger): (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=performance-tracking.middleware.d.ts.map