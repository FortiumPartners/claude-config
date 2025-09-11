import { ExtendedPrismaClient, Prisma } from './prisma-client';
import * as winston from 'winston';
export interface TransactionOptions {
    maxWait?: number;
    timeout?: number;
    isolationLevel?: Prisma.TransactionIsolationLevel;
}
export interface BatchConfig {
    batchSize?: number;
    maxConcurrency?: number;
    enableProgress?: boolean;
}
export interface PaginationParams {
    page: number;
    limit: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}
export interface PaginatedResult<T> {
    data: T[];
    meta: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}
export interface QueryMetrics {
    queryCount: number;
    totalDuration: number;
    averageDuration: number;
    slowQueries: number;
}
export declare class ORMUtils {
    private logger;
    private queryMetrics;
    constructor(logger?: winston.Logger);
    withTransaction<T>(client: ExtendedPrismaClient, operation: (tx: Prisma.TransactionClient) => Promise<T>, options?: TransactionOptions): Promise<T>;
    batchProcess<T, R>(items: T[], processor: (batch: T[]) => Promise<R[]>, config?: BatchConfig): Promise<R[]>;
    paginate<T>(query: any, params: PaginationParams): Promise<PaginatedResult<T>>;
    upsert<T>(model: any, where: any, create: any, update: any): Promise<T>;
    bulkInsert<T>(model: any, data: any[], options?: {
        skipDuplicates?: boolean;
        updateDuplicates?: boolean;
    }): Promise<number>;
    softDelete(model: any, where: any, deletedByUserId?: string): Promise<any>;
    private updateQueryMetrics;
    getQueryMetrics(): QueryMetrics;
    resetQueryMetrics(): void;
    generateHealthReport(client: ExtendedPrismaClient): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        metrics: QueryMetrics;
        performance: any;
        recommendations: string[];
    }>;
}
export declare const ormUtils: ORMUtils;
export declare function createDateRangeFilter(field: string, startDate?: Date, endDate?: Date): any;
export declare function createSearchFilter(fields: string[], searchTerm: string): any;
export declare function isValidUUID(uuid: string): boolean;
export declare function sanitizeSortParams(sortBy: string, allowedFields: string[]): {
    field: string;
    order: 'asc' | 'desc';
} | null;
//# sourceMappingURL=orm-utils.d.ts.map