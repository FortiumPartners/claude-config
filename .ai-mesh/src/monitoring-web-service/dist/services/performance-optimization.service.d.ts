import { ExtendedPrismaClient } from '../database/prisma-client';
import { RedisManager } from '../config/redis.config';
import { DatabaseConnection } from '../database/connection';
import * as winston from 'winston';
import { EventEmitter } from 'events';
export interface QueryPerformanceMetrics {
    queryId: string;
    queryType: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'AGGREGATE';
    executionTime: number;
    rowsAffected: number;
    planCost: number;
    indexUsage: {
        used: boolean;
        indexName?: string;
        scanType: 'index' | 'sequential' | 'bitmap';
    };
    cacheHit: boolean;
    organizationId?: string;
    timestamp: Date;
}
export interface PerformanceOptimization {
    id: string;
    type: 'index' | 'query' | 'cache' | 'connection_pool';
    priority: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    currentMetric: number;
    targetMetric: number;
    estimatedImpact: string;
    implementationSteps: string[];
    sqlCommands?: string[];
    created: Date;
}
export interface CacheWarmingStrategy {
    cacheKey: string;
    frequency: 'hourly' | 'daily' | 'weekly';
    organizationScoped: boolean;
    priority: number;
    warmingQuery: string;
    ttl: number;
    enabled: boolean;
}
export declare class PerformanceOptimizationService extends EventEmitter {
    private prisma;
    private redisManager;
    private dbConnection;
    private logger;
    private config;
    private queryMetrics;
    private optimizations;
    private cacheWarmingStrategies;
    private performanceBaseline;
    private analysisInterval;
    constructor(prisma: ExtendedPrismaClient, redisManager: RedisManager, dbConnection: DatabaseConnection, logger: winston.Logger, config: {
        enableQueryAnalysis: boolean;
        enableCacheWarming: boolean;
        analysisIntervalMs: number;
        maxQueryHistorySize: number;
        performanceThresholds: {
            slowQueryMs: number;
            cacheHitRateMin: number;
            connectionPoolUtilizationMax: number;
        };
    });
    trackQueryPerformance(queryId: string, queryType: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'AGGREGATE', executionTime: number, rowsAffected: number, organizationId?: string): Promise<void>;
    getDatabaseInsights(organizationId?: string): Promise<{
        averageQueryTime: number;
        slowestQueries: QueryPerformanceMetrics[];
        cacheHitRate: number;
        indexEfficiency: number;
        connectionPoolUtilization: number;
        recommendations: PerformanceOptimization[];
    }>;
    warmCaches(): Promise<void>;
    getOptimizationRecommendations(): Promise<PerformanceOptimization[]>;
    implementOptimization(optimizationId: string): Promise<boolean>;
    private initializeBaseline;
    private setupCacheWarmingStrategies;
    private startPerformanceAnalysis;
    private performanceAnalysis;
    private analyzeOrganizationMetrics;
    private generateQueryOptimization;
    private generateIndexOptimization;
    private generateCacheOptimization;
    private generateSystemOptimizations;
    private executeWarmingStrategy;
    private getQueryPlanCost;
    private analyzeIndexUsage;
    private checkCacheHit;
    private getConnectionPoolUtilization;
    private analyzeQueryPerformance;
    private createRecommendedIndex;
    private optimizeQuery;
    private implementCacheOptimization;
    private optimizeConnectionPool;
    shutdown(): Promise<void>;
}
//# sourceMappingURL=performance-optimization.service.d.ts.map