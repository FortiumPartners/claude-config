"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MigrationService = void 0;
const metrics_collection_service_1 = require("./metrics-collection.service");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const yaml = __importStar(require("js-yaml"));
class MigrationService {
    db;
    logger;
    metricsCollectionService;
    constructor(db, logger) {
        this.db = db;
        this.logger = logger;
        this.metricsCollectionService = new metrics_collection_service_1.MetricsCollectionService(db, logger);
    }
    async migrateLocalMetrics(organizationId, userId, options = {}) {
        const result = {
            success: false,
            metrics_migrated: 0,
            config_migrated: false,
            errors: [],
            warnings: []
        };
        try {
            if (options.legacy_format) {
                return await this.migrateLegacyFormat(organizationId, userId, options.legacy_format, result);
            }
            if (options.local_config_path) {
                return await this.migrateFromLocalFiles(organizationId, userId, options, result);
            }
            return await this.autoDiscoverAndMigrate(organizationId, userId, options, result);
        }
        catch (error) {
            this.logger.error('Migration error:', error);
            result.errors.push(error instanceof Error ? error.message : 'Unknown migration error');
            return result;
        }
    }
    async migrateLegacyFormat(organizationId, userId, legacyData, result) {
        try {
            const convertedMetric = this.convertLegacyMetric(legacyData);
            const collectionResult = await this.metricsCollectionService.collectCommandExecution(organizationId, convertedMetric);
            if (collectionResult.success) {
                result.metrics_migrated = 1;
                result.success = true;
            }
            else {
                result.errors.push(`Failed to store migrated metric: ${collectionResult.message}`);
            }
        }
        catch (error) {
            result.errors.push(`Legacy format conversion error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        return result;
    }
    async migrateFromLocalFiles(organizationId, userId, options, result) {
        const configPath = options.local_config_path;
        try {
            if (!fs.existsSync(configPath)) {
                result.errors.push(`Configuration path does not exist: ${configPath}`);
                return result;
            }
            if (options.preserve_local) {
                result.backup_location = await this.createBackup(configPath);
            }
            const dashboardSettingsPath = path.join(path.dirname(configPath), 'dashboard-settings.yml');
            if (fs.existsSync(dashboardSettingsPath)) {
                const configMigrated = await this.migrateDashboardConfig(organizationId, dashboardSettingsPath, options.dry_run || false);
                result.config_migrated = configMigrated;
            }
            const metricsFiles = await this.discoverMetricsFiles(path.dirname(configPath));
            result.metrics_migrated = await this.migrateMetricsFiles(organizationId, metricsFiles, options);
            result.success = result.metrics_migrated > 0 || result.config_migrated;
            if (result.metrics_migrated === 0 && !result.config_migrated) {
                result.warnings.push('No metrics or configuration found to migrate');
            }
        }
        catch (error) {
            result.errors.push(`File migration error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        return result;
    }
    async autoDiscoverAndMigrate(organizationId, userId, options, result) {
        const commonPaths = [
            path.join(process.env.HOME || '~', '.agent-os'),
            path.join(process.env.HOME || '~', '.claude'),
            path.join(process.cwd(), '.agent-os'),
            path.join(process.cwd(), '.claude')
        ];
        for (const basePath of commonPaths) {
            if (fs.existsSync(basePath)) {
                this.logger.info(`Checking for metrics in: ${basePath}`);
                const pathResult = await this.migrateFromLocalFiles(organizationId, userId, { ...options, local_config_path: basePath }, { ...result });
                result.metrics_migrated += pathResult.metrics_migrated;
                result.config_migrated = result.config_migrated || pathResult.config_migrated;
                result.errors.push(...pathResult.errors);
                result.warnings.push(...pathResult.warnings);
                if (pathResult.backup_location) {
                    result.backup_location = pathResult.backup_location;
                }
            }
        }
        result.success = result.metrics_migrated > 0 || result.config_migrated;
        return result;
    }
    convertLegacyMetric(legacy) {
        if (legacy.timestamp && legacy.command && legacy.duration) {
            return {
                command_name: legacy.command,
                execution_time_ms: legacy.duration,
                success: legacy.success !== false,
                context: {
                    migrated_from: 'legacy_format',
                    original_timestamp: legacy.timestamp,
                    agent_used: legacy.agent || 'unknown'
                }
            };
        }
        if (legacy.name && legacy.time) {
            return {
                command_name: legacy.name,
                execution_time_ms: legacy.time,
                success: legacy.status !== 'failed',
                context: {
                    migrated_from: 'legacy_format_alt',
                    original_data: legacy
                }
            };
        }
        return {
            command_name: legacy.command_name || legacy.name || 'unknown_command',
            execution_time_ms: legacy.execution_time_ms || legacy.duration || legacy.time || 0,
            success: legacy.success !== false && legacy.status !== 'failed',
            context: {
                migrated_from: 'legacy_format_generic',
                original_data: legacy
            }
        };
    }
    async createBackup(sourcePath) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupDir = path.join(path.dirname(sourcePath), `backup-${timestamp}`);
        fs.mkdirSync(backupDir, { recursive: true });
        if (fs.statSync(sourcePath).isDirectory()) {
            await this.copyDirectory(sourcePath, backupDir);
        }
        else {
            fs.copyFileSync(sourcePath, path.join(backupDir, path.basename(sourcePath)));
        }
        this.logger.info(`Created backup at: ${backupDir}`);
        return backupDir;
    }
    async copyDirectory(source, destination) {
        if (!fs.existsSync(destination)) {
            fs.mkdirSync(destination, { recursive: true });
        }
        const files = fs.readdirSync(source);
        for (const file of files) {
            const sourcePath = path.join(source, file);
            const destPath = path.join(destination, file);
            if (fs.statSync(sourcePath).isDirectory()) {
                await this.copyDirectory(sourcePath, destPath);
            }
            else {
                fs.copyFileSync(sourcePath, destPath);
            }
        }
    }
    async migrateDashboardConfig(organizationId, configPath, dryRun) {
        try {
            const configContent = fs.readFileSync(configPath, 'utf8');
            const config = yaml.load(configContent);
            if (dryRun) {
                this.logger.info('Dry run: Would migrate dashboard configuration', config);
                return true;
            }
            const query = `
        INSERT INTO organization_settings (organization_id, settings_data, settings_type, created_at, updated_at)
        VALUES ($1, $2, 'dashboard_migration', NOW(), NOW())
        ON CONFLICT (organization_id, settings_type) 
        DO UPDATE SET settings_data = $2, updated_at = NOW()
      `;
            await this.db.query(query, [organizationId, JSON.stringify(config)]);
            this.logger.info('Successfully migrated dashboard configuration');
            return true;
        }
        catch (error) {
            this.logger.error('Failed to migrate dashboard config:', error);
            return false;
        }
    }
    async discoverMetricsFiles(basePath) {
        const metricsFiles = [];
        if (!fs.existsSync(basePath)) {
            return metricsFiles;
        }
        const commonMetricsPatterns = [
            'metrics*.json',
            'dashboard*.json',
            'command-history*.json',
            'agent-usage*.json',
            'productivity*.json'
        ];
        const files = fs.readdirSync(basePath, { withFileTypes: true });
        for (const file of files) {
            if (file.isFile()) {
                const fileName = file.name.toLowerCase();
                for (const pattern of commonMetricsPatterns) {
                    const regex = new RegExp(pattern.replace('*', '.*'));
                    if (regex.test(fileName)) {
                        metricsFiles.push(path.join(basePath, file.name));
                    }
                }
            }
            else if (file.isDirectory() && file.name !== 'backup' && !file.name.startsWith('.')) {
                const subFiles = await this.discoverMetricsFiles(path.join(basePath, file.name));
                metricsFiles.push(...subFiles);
            }
        }
        return metricsFiles;
    }
    async migrateMetricsFiles(organizationId, metricsFiles, options) {
        let totalMigrated = 0;
        const batchSize = options.batch_size || 100;
        for (const filePath of metricsFiles) {
            try {
                this.logger.info(`Processing metrics file: ${filePath}`);
                const content = fs.readFileSync(filePath, 'utf8');
                const data = JSON.parse(content);
                let metrics = [];
                if (Array.isArray(data)) {
                    metrics = data;
                }
                else if (data.metrics && Array.isArray(data.metrics)) {
                    metrics = data.metrics;
                }
                else if (data.commands && Array.isArray(data.commands)) {
                    metrics = data.commands;
                }
                else {
                    metrics = [data];
                }
                for (let i = 0; i < metrics.length; i += batchSize) {
                    const batch = metrics.slice(i, i + batchSize);
                    const batchMigrated = await this.migrateBatch(organizationId, batch, options.dry_run || false);
                    totalMigrated += batchMigrated;
                }
            }
            catch (error) {
                this.logger.error(`Error processing file ${filePath}:`, error);
            }
        }
        return totalMigrated;
    }
    async migrateBatch(organizationId, metrics, dryRun) {
        if (dryRun) {
            this.logger.info(`Dry run: Would migrate ${metrics.length} metrics`);
            return metrics.length;
        }
        let migrated = 0;
        for (const metric of metrics) {
            try {
                const convertedMetric = this.convertLegacyMetric(metric);
                const result = await this.metricsCollectionService.collectCommandExecution(organizationId, convertedMetric);
                if (result.success) {
                    migrated++;
                }
            }
            catch (error) {
                this.logger.warn('Failed to migrate individual metric:', error);
            }
        }
        return migrated;
    }
    async validateMigrationPrerequisites(organizationId) {
        const issues = [];
        const suggestions = [];
        try {
            const orgQuery = 'SELECT * FROM organizations WHERE id = $1';
            const orgResult = await this.db.query(orgQuery, [organizationId]);
            if (orgResult.rows.length === 0) {
                issues.push('Organization not found');
            }
            const tablesQuery = `
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('command_executions', 'agent_metrics', 'organization_settings')
      `;
            const tablesResult = await this.db.query(tablesQuery);
            if (tablesResult.rows.length < 3) {
                issues.push('Required database tables missing');
                suggestions.push('Run database migrations before attempting migration');
            }
            const existingMetricsQuery = `
        SELECT COUNT(*) as count FROM command_executions 
        WHERE organization_id = $1 
        AND created_at > NOW() - INTERVAL '24 hours'
      `;
            const existingMetricsResult = await this.db.query(existingMetricsQuery, [organizationId]);
            const existingCount = parseInt(existingMetricsResult.rows[0].count);
            if (existingCount > 0) {
                suggestions.push(`${existingCount} recent metrics found. Migration will add to existing data.`);
            }
        }
        catch (error) {
            issues.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        return {
            valid: issues.length === 0,
            issues,
            suggestions
        };
    }
}
exports.MigrationService = MigrationService;
//# sourceMappingURL=migration.service.js.map