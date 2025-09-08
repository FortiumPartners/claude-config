import Redis from 'ioredis';
import * as winston from 'winston';
export interface MetricsRedisConfig {
    host: string;
    port: number;
    password?: string;
    db?: number;
    keyPrefix?: string;
    connectionTimeout?: number;
    commandTimeout?: number;
    retryDelayOnFailover?: number;
    enableReadyCheck?: boolean;
    maxRetriesPerRequest?: number;
    lazyConnect?: boolean;
    keepAlive?: number;
    family?: number;
    cluster?: {
        hosts: Array<{
            host: string;
            port: number;
        }>;
    };
}
export declare class RedisManager {
    private redis;
    private pubRedis;
    private subRedis;
    private logger;
    private config;
    readonly keyPrefixes: {
        METRICS_CACHE: string;
        AGGREGATION_CACHE: string;
        REAL_TIME_DATA: string;
        RATE_LIMIT: string;
        SESSION: string;
        ALERT_STATE: string;
        PROCESSING_LOCK: string;
    };
    readonly ttl: {
        METRICS_CACHE: number;
        AGGREGATION_CACHE: number;
        REAL_TIME_DATA: number;
        RATE_LIMIT: number;
        SESSION: number;
        ALERT_STATE: number;
        PROCESSING_LOCK: number;
    };
    constructor(config: MetricsRedisConfig, logger: winston.Logger);
    private buildRedisOptions;
    private setupEventHandlers;
    getRedis(): Redis;
    getPublisher(): Redis;
    getSubscriber(): Redis;
    cacheMetrics(key: string, data: any, ttl?: number): Promise<void>;
    getCachedMetrics(key: string): Promise<any | null>;
    cacheAggregatedMetrics(key: string, data: any, ttl?: number): Promise<void>;
    getCachedAggregatedMetrics(key: string): Promise<any | null>;
    storeRealTimeData(organizationId: string, data: any): Promise<void>;
    subscribeToRealTimeUpdates(organizationId: string, callback: (data: any) => void): Promise<void>;
    acquireProcessingLock(key: string, ttl?: number): Promise<boolean>;
    releaseProcessingLock(key: string): Promise<void>;
    setRateLimit(identifier: string, count: number, windowMs: number): Promise<void>;
    getRateLimit(identifier: string): Promise<number | null>;
    healthCheck(): Promise<{
        status: 'healthy' | 'unhealthy';
        details: any;
    }>;
    private parseRedisInfo;
    close(): Promise<void>;
}
export declare function getDefaultRedisConfig(): MetricsRedisConfig;
//# sourceMappingURL=redis.config.d.ts.map