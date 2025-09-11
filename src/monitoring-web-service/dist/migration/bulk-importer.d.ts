import { PrismaClient } from '../generated/prisma-client';
import { TransformationResult } from './data-transformer';
import { EventEmitter } from 'events';
export interface BulkImportOptions {
    batchSize: number;
    maxConcurrentBatches: number;
    progressReportingInterval: number;
    enableCheckpoints: boolean;
    checkpointDir: string;
    continueOnError: boolean;
    validateBeforeInsert: boolean;
    upsertMode: boolean;
    tenantSchemaName: string;
    dryRun: boolean;
}
export interface ImportProgress {
    totalSessions: number;
    processedSessions: number;
    totalToolMetrics: number;
    processedToolMetrics: number;
    errorsCount: number;
    elapsedTimeMs: number;
    estimatedRemainingTimeMs: number;
    currentBatch: number;
    totalBatches: number;
    throughputRecordsPerSecond: number;
    memoryUsageMB: number;
}
export interface ImportResult {
    success: boolean;
    totalRecordsProcessed: number;
    recordsInserted: number;
    recordsUpdated: number;
    recordsSkipped: number;
    errors: ImportError[];
    finalProgress: ImportProgress;
    checksumValidation?: {
        originalChecksum: string;
        importedChecksum: string;
        isValid: boolean;
    };
}
export interface ImportError {
    type: 'session' | 'toolMetric' | 'database' | 'validation';
    recordId?: string;
    batchIndex: number;
    error: string;
    retryable: boolean;
    originalData?: any;
}
export interface ImportCheckpoint {
    timestamp: Date;
    sessionsBatch: number;
    sessionsProcessed: number;
    toolMetricsBatch: number;
    toolMetricsProcessed: number;
    errors: ImportError[];
    options: BulkImportOptions;
}
export declare class BulkImporter extends EventEmitter {
    private readonly prisma;
    private readonly options;
    private importId;
    private startTime;
    private checkpoint;
    constructor(prisma: PrismaClient, options?: Partial<BulkImportOptions>);
    import(transformedData: TransformationResult): Promise<ImportResult>;
    private importSessions;
    private importToolMetrics;
    private insertSessionBatch;
    private insertToolMetricBatch;
    private createBatches;
    private generateImportId;
    private createInitialProgress;
    private calculateProgress;
    private startProgressReporting;
    private ensureCheckpointDir;
    private saveCheckpoint;
    private loadExistingCheckpoint;
    private cleanupCheckpoints;
    private validateTenantSchema;
    private validateImportData;
    private calculateDataChecksum;
    private calculateImportedChecksum;
    private isRetryableError;
}
export declare function createBulkImporter(prisma: PrismaClient, tenantSchemaName: string, options?: Partial<BulkImportOptions>): BulkImporter;
//# sourceMappingURL=bulk-importer.d.ts.map