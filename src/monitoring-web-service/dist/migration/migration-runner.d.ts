import { ParseResult, ParseOptions } from './data-parser';
import { TransformationResult, TransformationOptions } from './data-transformer';
import { ImportResult, BulkImportOptions } from './bulk-importer';
import { PrismaClient } from '../generated/prisma-client';
import { EventEmitter } from 'events';
export interface MigrationConfig {
    sourceMetricsDir?: string;
    useDefaultLocation?: boolean;
    tenantId: string;
    tenantSchemaName: string;
    userMappingStrategy: 'create' | 'map' | 'default';
    defaultUserId?: string;
    parseOptions: Partial<ParseOptions>;
    transformationOptions: Partial<TransformationOptions>;
    importOptions: Partial<BulkImportOptions>;
    enableValidation: boolean;
    enableBaselineComparison: boolean;
    enableRollback: boolean;
    createBackup: boolean;
    reportingDir: string;
    enableDetailedReports: boolean;
    enableProgressTracking: boolean;
}
export interface MigrationResult {
    success: boolean;
    migrationId: string;
    startTime: Date;
    endTime: Date;
    totalDurationMs: number;
    parseResult: ParseResult;
    transformationResult: TransformationResult;
    importResult: ImportResult;
    validationResult?: ValidationResult;
    baselineResult?: BaselineComparisonResult;
    summary: {
        originalFiles: number;
        originalRecords: number;
        processedSessions: number;
        processedToolMetrics: number;
        importedSessions: number;
        importedToolMetrics: number;
        totalErrors: number;
        dataIntegrityScore: number;
    };
    reports: {
        detailReport?: string;
        errorReport?: string;
        validationReport?: string;
        progressReport?: string;
    };
}
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    integrityChecks: {
        sessionDataIntegrity: boolean;
        toolMetricConsistency: boolean;
        foreignKeyIntegrity: boolean;
        duplicateCheck: boolean;
    };
}
export interface BaselineComparisonResult {
    comparisonValid: boolean;
    differences: {
        sessionCountDiff: number;
        toolMetricCountDiff: number;
        productivityScoreDiff: number;
        timeRangeDiff: {
            start: number;
            end: number;
        };
    };
    confidence: number;
}
export declare class MigrationRunner extends EventEmitter {
    private readonly config;
    private readonly prisma;
    private readonly migrationId;
    private readonly reportingDir;
    constructor(config: MigrationConfig, prisma: PrismaClient);
    runMigration(): Promise<MigrationResult>;
    private parseLocalData;
    private transformData;
    private validateTransformedData;
    private importData;
    private compareBaseline;
    private createBackup;
    private rollbackMigration;
    private generateReports;
    private setupReporting;
    private calculateSummary;
    private logProgress;
    private generateDetailReport;
    private generateErrorReport;
    private generateValidationReport;
    private getTotalDurationMs;
    private startTime;
}
export declare function createMigrationRunner(tenantId: string, tenantSchemaName: string, prisma: PrismaClient, options?: Partial<MigrationConfig>): MigrationRunner;
//# sourceMappingURL=migration-runner.d.ts.map