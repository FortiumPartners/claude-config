import { PrismaClient } from '../generated/prisma-client';
import { TransformationResult } from './data-transformer';
import { ImportResult } from './bulk-importer';
export interface RollbackOptions {
    rollbackStrategy: 'full' | 'partial' | 'selective';
    backupDir: string;
    tenantSchemaName: string;
    preserveExistingData: boolean;
    createRollbackBackup: boolean;
    validateAfterRollback: boolean;
    dryRun: boolean;
}
export interface RollbackResult {
    success: boolean;
    rollbackId: string;
    startTime: Date;
    endTime: Date;
    totalDurationMs: number;
    strategy: string;
    actions: RollbackAction[];
    recovery: {
        sessionsRemoved: number;
        toolMetricsRemoved: number;
        sessionsRestored: number;
        toolMetricsRestored: number;
        dataIntegrityChecks: number;
    };
    errors: string[];
    warnings: string[];
    validationResult?: {
        isValid: boolean;
        issues: string[];
    };
}
export interface RollbackAction {
    type: 'delete' | 'restore' | 'backup' | 'validate';
    target: 'sessions' | 'tool_metrics' | 'all_data' | 'schema';
    details: string;
    timestamp: Date;
    recordsAffected: number;
    success: boolean;
    error?: string;
}
export declare class RollbackManager {
    private readonly prisma;
    private readonly options;
    private readonly rollbackId;
    constructor(prisma: PrismaClient, options: RollbackOptions);
    executeRollback(migrationData?: TransformationResult, importResult?: ImportResult): Promise<RollbackResult>;
    private executeFullRollback;
    private executePartialRollback;
    private executeSelectiveRollback;
    private removeImportedToolMetrics;
    private removeImportedSessions;
    private removeSpecificSessions;
    private removeSpecificToolMetrics;
    private removeRecentSessions;
    private removeRecentToolMetrics;
    private createPreRollbackBackup;
    private restoreFromBackup;
    private cleanupMigrationArtifacts;
    private validatePostRollback;
    private backupExists;
    private fileExists;
    private extractErrorSessionIds;
}
export declare function createRollbackManager(prisma: PrismaClient, tenantSchemaName: string, backupDir: string, options?: Partial<RollbackOptions>): RollbackManager;
//# sourceMappingURL=rollback-manager.d.ts.map