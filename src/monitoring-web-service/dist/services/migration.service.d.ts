import { DatabaseConnection } from '../database/connection';
import * as winston from 'winston';
export interface LocalMetric {
    timestamp: number;
    command: string;
    duration: number;
    success: boolean;
    agent?: string;
    context?: any;
}
export interface LocalConfig {
    teams?: any;
    goals?: any;
    current_sprint?: any;
    alerts?: any;
    integrations?: any;
}
export interface MigrationResult {
    success: boolean;
    metrics_migrated: number;
    config_migrated: boolean;
    errors: string[];
    warnings: string[];
    backup_location?: string;
}
export interface MigrationOptions {
    local_config_path?: string;
    legacy_format?: any;
    preserve_local?: boolean;
    dry_run?: boolean;
    batch_size?: number;
}
export declare class MigrationService {
    private db;
    private logger;
    private metricsCollectionService;
    constructor(db: DatabaseConnection, logger: winston.Logger);
    migrateLocalMetrics(organizationId: string, userId: string, options?: MigrationOptions): Promise<MigrationResult>;
    private migrateLegacyFormat;
    private migrateFromLocalFiles;
    private autoDiscoverAndMigrate;
    private convertLegacyMetric;
    private createBackup;
    private copyDirectory;
    private migrateDashboardConfig;
    private discoverMetricsFiles;
    private migrateMetricsFiles;
    private migrateBatch;
    validateMigrationPrerequisites(organizationId: string): Promise<{
        valid: boolean;
        issues: string[];
        suggestions: string[];
    }>;
}
//# sourceMappingURL=migration.service.d.ts.map