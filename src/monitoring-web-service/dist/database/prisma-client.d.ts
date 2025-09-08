import { PrismaClient as BasePrismaClient } from '../generated/prisma-client';
import * as winston from 'winston';
export interface TenantContext {
    tenantId: string;
    schemaName: string;
    domain: string;
}
export interface PrismaClientConfig {
    logger?: winston.Logger;
    enableQueryLogging?: boolean;
    enablePerformanceMonitoring?: boolean;
    slowQueryThresholdMs?: number;
    connectionPoolSettings?: {
        min: number;
        max: number;
        timeoutMs: number;
    };
}
export declare class ExtendedPrismaClient extends BasePrismaClient {
    private logger;
    private currentTenant;
    private enableQueryLogging;
    private enablePerformanceMonitoring;
    private slowQueryThresholdMs;
    constructor(config?: PrismaClientConfig);
    private createDefaultLogger;
    private setupEventHandlers;
    setTenantContext(context: TenantContext): Promise<void>;
    clearTenantContext(): Promise<void>;
    getCurrentTenantContext(): TenantContext | null;
    withTenantContext<T>(context: TenantContext, operation: (client: ExtendedPrismaClient) => Promise<T>): Promise<T>;
    getTenantByDomain(domain: string): Promise<any | null>;
    healthCheck(): Promise<{
        status: 'healthy' | 'unhealthy';
        details: {
            connection: boolean;
            responseTime: number;
            timestamp: string;
        };
    }>;
    getPerformanceMetrics(): Promise<{
        activeConnections: number;
        totalQueries: number;
        averageQueryTime: number;
        slowQueries: number;
    }>;
    shutdown(): Promise<void>;
}
export declare function createPrismaClient(config?: PrismaClientConfig): ExtendedPrismaClient;
export declare function getPrismaClient(config?: PrismaClientConfig): ExtendedPrismaClient;
export type { TenantContext, PrismaClientConfig };
export { Prisma } from '../generated/prisma-client';
//# sourceMappingURL=prisma-client.d.ts.map