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
exports.MigrationRunner = void 0;
exports.createMigrationRunner = createMigrationRunner;
const data_parser_1 = require("./data-parser");
const data_transformer_1 = require("./data-transformer");
const bulk_importer_1 = require("./bulk-importer");
const data_validator_1 = require("./data-validator");
const baseline_comparator_1 = require("./baseline-comparator");
const events_1 = require("events");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
class MigrationRunner extends events_1.EventEmitter {
    config;
    prisma;
    migrationId;
    reportingDir;
    constructor(config, prisma) {
        super();
        this.config = config;
        this.prisma = prisma;
        this.migrationId = `migration-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.reportingDir = path.join(config.reportingDir, this.migrationId);
    }
    async runMigration() {
        const startTime = new Date();
        console.log(`🚀 Starting migration ${this.migrationId} for tenant: ${this.config.tenantId}`);
        const result = {
            success: false,
            migrationId: this.migrationId,
            startTime,
            endTime: new Date(),
            totalDurationMs: 0,
            parseResult: {
                sessions: [],
                toolMetrics: [],
                errors: [],
                statistics: {
                    totalFiles: 0,
                    processedRecords: 0,
                    sessionCount: 0,
                    toolMetricCount: 0,
                    timeRange: { earliest: new Date(), latest: new Date() },
                    memoryUsageKB: 0
                }
            },
            transformationResult: {
                sessions: [],
                toolMetrics: [],
                userMappings: [],
                errors: [],
                statistics: {
                    originalSessions: 0,
                    transformedSessions: 0,
                    originalToolMetrics: 0,
                    transformedToolMetrics: 0,
                    duplicatesRemoved: 0,
                    invalidRecordsSkipped: 0,
                    usersIdentified: 0
                }
            },
            importResult: {
                success: false,
                totalRecordsProcessed: 0,
                recordsInserted: 0,
                recordsUpdated: 0,
                recordsSkipped: 0,
                errors: [],
                finalProgress: {
                    totalSessions: 0,
                    processedSessions: 0,
                    totalToolMetrics: 0,
                    processedToolMetrics: 0,
                    errorsCount: 0,
                    elapsedTimeMs: 0,
                    estimatedRemainingTimeMs: 0,
                    currentBatch: 0,
                    totalBatches: 0,
                    throughputRecordsPerSecond: 0,
                    memoryUsageMB: 0
                }
            },
            summary: {
                originalFiles: 0,
                originalRecords: 0,
                processedSessions: 0,
                processedToolMetrics: 0,
                importedSessions: 0,
                importedToolMetrics: 0,
                totalErrors: 0,
                dataIntegrityScore: 0
            },
            reports: {}
        };
        try {
            await this.setupReporting();
            console.log('📊 Phase 1: Parsing local metrics files...');
            result.parseResult = await this.parseLocalData();
            this.emit('phaseComplete', { phase: 'parse', result: result.parseResult });
            if (result.parseResult.errors.length > 0) {
                console.warn(`⚠️  Parse phase completed with ${result.parseResult.errors.length} errors`);
            }
            console.log('🔄 Phase 2: Transforming data for cloud import...');
            result.transformationResult = await this.transformData(result.parseResult);
            this.emit('phaseComplete', { phase: 'transform', result: result.transformationResult });
            if (this.config.enableValidation) {
                console.log('🔍 Phase 3: Pre-import validation...');
                result.validationResult = await this.validateTransformedData(result.transformationResult);
                this.emit('phaseComplete', { phase: 'validate', result: result.validationResult });
                if (!result.validationResult.isValid) {
                    throw new Error(`Validation failed: ${result.validationResult.errors.join(', ')}`);
                }
            }
            if (this.config.createBackup) {
                console.log('💾 Phase 4: Creating data backup...');
                await this.createBackup();
                this.emit('phaseComplete', { phase: 'backup', result: { success: true } });
            }
            console.log('📤 Phase 5: Importing data to cloud database...');
            result.importResult = await this.importData(result.transformationResult);
            this.emit('phaseComplete', { phase: 'import', result: result.importResult });
            if (this.config.enableBaselineComparison) {
                console.log('📊 Phase 6: Baseline comparison...');
                result.baselineResult = await this.compareBaseline(result.parseResult, result.importResult);
                this.emit('phaseComplete', { phase: 'baseline', result: result.baselineResult });
            }
            if (this.config.enableDetailedReports) {
                console.log('📋 Phase 7: Generating migration reports...');
                await this.generateReports(result);
                this.emit('phaseComplete', { phase: 'reporting', result: { success: true } });
            }
            result.endTime = new Date();
            result.totalDurationMs = result.endTime.getTime() - result.startTime.getTime();
            result.summary = this.calculateSummary(result);
            const hasAnyErrors = result.parseResult.errors.length > 0 ||
                result.transformationResult.errors.length > 0 ||
                result.importResult.errors.length > 0;
            result.success = !hasAnyErrors && result.importResult.success;
            console.log(`✅ Migration ${this.migrationId} completed in ${result.totalDurationMs}ms`);
            console.log(`📊 Summary: ${result.summary.importedSessions} sessions, ${result.summary.importedToolMetrics} tool metrics imported`);
            console.log(`🎯 Data integrity score: ${result.summary.dataIntegrityScore}%`);
            if (result.summary.totalErrors > 0) {
                console.warn(`⚠️  ${result.summary.totalErrors} total errors encountered`);
            }
            this.emit('complete', result);
            return result;
        }
        catch (error) {
            result.success = false;
            result.endTime = new Date();
            result.totalDurationMs = result.endTime.getTime() - result.startTime.getTime();
            console.error(`❌ Migration ${this.migrationId} failed:`, error);
            if (this.config.enableRollback) {
                console.log('🔄 Attempting rollback...');
                try {
                    await this.rollbackMigration();
                    console.log('✅ Rollback completed successfully');
                }
                catch (rollbackError) {
                    console.error('❌ Rollback failed:', rollbackError);
                }
            }
            this.emit('error', error);
            return result;
        }
    }
    async parseLocalData() {
        if (this.config.useDefaultLocation) {
            return (0, data_parser_1.parseDefaultMetricsLocation)(this.config.parseOptions);
        }
        else if (this.config.sourceMetricsDir) {
            const parser = new data_parser_1.LocalDataParser(this.config.sourceMetricsDir, this.config.parseOptions);
            return parser.parseAllFiles();
        }
        else {
            throw new Error('Either useDefaultLocation must be true or sourceMetricsDir must be specified');
        }
    }
    async transformData(parseResult) {
        const transformerOptions = {
            tenantId: this.config.tenantId,
            userMappingStrategy: this.config.userMappingStrategy,
            defaultUserId: this.config.defaultUserId,
            ...this.config.transformationOptions
        };
        const transformer = (0, data_transformer_1.createDefaultTransformer)(this.config.tenantId, transformerOptions);
        return transformer.transform(parseResult);
    }
    async validateTransformedData(transformationResult) {
        const validator = new data_validator_1.DataValidator(this.prisma, this.config.tenantSchemaName);
        return validator.validateTransformationResult(transformationResult);
    }
    async importData(transformationResult) {
        const importerOptions = {
            tenantSchemaName: this.config.tenantSchemaName,
            enableCheckpoints: true,
            checkpointDir: path.join(this.reportingDir, 'checkpoints'),
            ...this.config.importOptions
        };
        const importer = (0, bulk_importer_1.createBulkImporter)(this.prisma, this.config.tenantSchemaName, importerOptions);
        if (this.config.enableProgressTracking) {
            importer.on('progress', (progress) => {
                this.emit('importProgress', progress);
                this.logProgress(progress);
            });
        }
        return importer.import(transformationResult);
    }
    async compareBaseline(parseResult, importResult) {
        const comparator = new baseline_comparator_1.BaselineComparator();
        return comparator.compareResults(parseResult, importResult);
    }
    async createBackup() {
        const backupDir = path.join(this.reportingDir, 'backup');
        await fs.mkdir(backupDir, { recursive: true });
        const sessions = await this.prisma.$queryRawUnsafe(`
      SELECT * FROM "${this.config.tenantSchemaName}".metrics_sessions
      ORDER BY created_at DESC
    `);
        await fs.writeFile(path.join(backupDir, 'sessions_backup.json'), JSON.stringify(sessions, null, 2));
        const toolMetrics = await this.prisma.$queryRawUnsafe(`
      SELECT * FROM "${this.config.tenantSchemaName}".tool_metrics
      ORDER BY created_at DESC
    `);
        await fs.writeFile(path.join(backupDir, 'tool_metrics_backup.json'), JSON.stringify(toolMetrics, null, 2));
        console.log(`💾 Backup created in ${backupDir}`);
    }
    async rollbackMigration() {
        console.log('🔄 Rolling back migration changes...');
        try {
            await this.prisma.$executeRawUnsafe(`
        DELETE FROM "${this.config.tenantSchemaName}".tool_metrics 
        WHERE created_at >= $1
      `, new Date(Date.now() - this.getTotalDurationMs()));
            await this.prisma.$executeRawUnsafe(`
        DELETE FROM "${this.config.tenantSchemaName}".metrics_sessions 
        WHERE created_at >= $1
      `, new Date(Date.now() - this.getTotalDurationMs()));
            console.log('✅ Rollback completed');
        }
        catch (error) {
            throw new Error(`Rollback failed: ${error.message}`);
        }
    }
    async generateReports(result) {
        const reportsDir = path.join(this.reportingDir, 'reports');
        await fs.mkdir(reportsDir, { recursive: true });
        if (this.config.enableDetailedReports) {
            const detailReport = this.generateDetailReport(result);
            const detailReportPath = path.join(reportsDir, 'migration_detail_report.md');
            await fs.writeFile(detailReportPath, detailReport);
            result.reports.detailReport = detailReportPath;
        }
        if (result.summary.totalErrors > 0) {
            const errorReport = this.generateErrorReport(result);
            const errorReportPath = path.join(reportsDir, 'error_report.json');
            await fs.writeFile(errorReportPath, errorReport);
            result.reports.errorReport = errorReportPath;
        }
        if (result.validationResult) {
            const validationReport = this.generateValidationReport(result.validationResult);
            const validationReportPath = path.join(reportsDir, 'validation_report.md');
            await fs.writeFile(validationReportPath, validationReport);
            result.reports.validationReport = validationReportPath;
        }
        console.log(`📋 Reports generated in ${reportsDir}`);
    }
    async setupReporting() {
        await fs.mkdir(this.reportingDir, { recursive: true });
        await fs.mkdir(path.join(this.reportingDir, 'checkpoints'), { recursive: true });
        const metadata = {
            migrationId: this.migrationId,
            tenantId: this.config.tenantId,
            startTime: new Date(),
            config: this.config
        };
        await fs.writeFile(path.join(this.reportingDir, 'migration_metadata.json'), JSON.stringify(metadata, null, 2));
    }
    calculateSummary(result) {
        const totalErrors = result.parseResult.errors.length +
            result.transformationResult.errors.length +
            result.importResult.errors.length;
        const originalRecords = result.parseResult.statistics.sessionCount +
            result.parseResult.statistics.toolMetricCount;
        const processedRecords = result.transformationResult.statistics.transformedSessions +
            result.transformationResult.statistics.transformedToolMetrics;
        const dataIntegrityScore = originalRecords > 0 ?
            Math.round((processedRecords - totalErrors) / originalRecords * 100) : 100;
        return {
            originalFiles: result.parseResult.statistics.totalFiles,
            originalRecords,
            processedSessions: result.transformationResult.statistics.transformedSessions,
            processedToolMetrics: result.transformationResult.statistics.transformedToolMetrics,
            importedSessions: result.importResult.recordsInserted,
            importedToolMetrics: result.importResult.recordsInserted - result.importResult.recordsInserted,
            totalErrors,
            dataIntegrityScore
        };
    }
    logProgress(progress) {
        const totalRecords = progress.totalSessions + progress.totalToolMetrics;
        const processedRecords = progress.processedSessions + progress.processedToolMetrics;
        const progressPercent = totalRecords > 0 ? Math.round((processedRecords / totalRecords) * 100) : 0;
        const eta = progress.estimatedRemainingTimeMs > 0 ?
            `ETA: ${Math.round(progress.estimatedRemainingTimeMs / 1000)}s` : '';
        console.log(`📈 Progress: ${progressPercent}% (${processedRecords}/${totalRecords}) - ${progress.throughputRecordsPerSecond} rec/s ${eta}`);
        if (progress.errorsCount > 0) {
            console.warn(`⚠️  ${progress.errorsCount} errors encountered`);
        }
    }
    generateDetailReport(result) {
        return `# Migration Report: ${this.migrationId}

## Summary
- **Migration ID**: ${this.migrationId}
- **Tenant**: ${this.config.tenantId}
- **Start Time**: ${result.startTime.toISOString()}
- **End Time**: ${result.endTime.toISOString()}
- **Total Duration**: ${result.totalDurationMs}ms
- **Success**: ${result.success ? '✅' : '❌'}

## Statistics
- **Original Files**: ${result.summary.originalFiles}
- **Original Records**: ${result.summary.originalRecords}
- **Imported Sessions**: ${result.summary.importedSessions}
- **Imported Tool Metrics**: ${result.summary.importedToolMetrics}
- **Total Errors**: ${result.summary.totalErrors}
- **Data Integrity Score**: ${result.summary.dataIntegrityScore}%

## Phase Results

### Parse Phase
- **Sessions Found**: ${result.parseResult.statistics.sessionCount}
- **Tool Metrics Found**: ${result.parseResult.statistics.toolMetricCount}
- **Parse Errors**: ${result.parseResult.errors.length}

### Transformation Phase  
- **Sessions Transformed**: ${result.transformationResult.statistics.transformedSessions}
- **Tool Metrics Transformed**: ${result.transformationResult.statistics.transformedToolMetrics}
- **Users Identified**: ${result.transformationResult.statistics.usersIdentified}
- **Duplicates Removed**: ${result.transformationResult.statistics.duplicatesRemoved}

### Import Phase
- **Records Inserted**: ${result.importResult.recordsInserted}
- **Records Updated**: ${result.importResult.recordsUpdated}
- **Records Skipped**: ${result.importResult.recordsSkipped}
- **Import Throughput**: ${result.importResult.finalProgress.throughputRecordsPerSecond} records/sec

${result.summary.totalErrors > 0 ? `## Errors\nSee error_report.json for detailed error information.` : ''}

## Configuration Used
\`\`\`json
${JSON.stringify(this.config, null, 2)}
\`\`\`
`;
    }
    generateErrorReport(result) {
        const allErrors = {
            parseErrors: result.parseResult.errors,
            transformationErrors: result.transformationResult.errors,
            importErrors: result.importResult.errors,
            summary: {
                totalErrors: result.summary.totalErrors,
                byType: {
                    parse: result.parseResult.errors.length,
                    transformation: result.transformationResult.errors.length,
                    import: result.importResult.errors.length
                }
            }
        };
        return JSON.stringify(allErrors, null, 2);
    }
    generateValidationReport(validation) {
        return `# Validation Report

## Overall Result: ${validation.isValid ? '✅ PASSED' : '❌ FAILED'}

## Integrity Checks
- **Session Data Integrity**: ${validation.integrityChecks.sessionDataIntegrity ? '✅' : '❌'}
- **Tool Metric Consistency**: ${validation.integrityChecks.toolMetricConsistency ? '✅' : '❌'}
- **Foreign Key Integrity**: ${validation.integrityChecks.foreignKeyIntegrity ? '✅' : '❌'}
- **Duplicate Check**: ${validation.integrityChecks.duplicateCheck ? '✅' : '❌'}

${validation.errors.length > 0 ? `## Errors
${validation.errors.map(error => `- ${error}`).join('\n')}` : ''}

${validation.warnings.length > 0 ? `## Warnings
${validation.warnings.map(warning => `- ${warning}`).join('\n')}` : ''}
`;
    }
    getTotalDurationMs() {
        return Date.now() - this.startTime;
    }
    startTime = Date.now();
}
exports.MigrationRunner = MigrationRunner;
function createMigrationRunner(tenantId, tenantSchemaName, prisma, options = {}) {
    const defaultConfig = {
        tenantId,
        tenantSchemaName,
        useDefaultLocation: true,
        userMappingStrategy: 'create',
        parseOptions: {
            batchSize: 1000,
            validateData: true,
            includeErrorLogs: true
        },
        transformationOptions: {
            deduplicationStrategy: 'strict',
            validateConstraints: true,
            maxSessionDurationHours: 24,
            minSessionDurationMs: 1000
        },
        importOptions: {
            batchSize: 100,
            continueOnError: true,
            enableCheckpoints: true,
            validateBeforeInsert: true
        },
        enableValidation: true,
        enableBaselineComparison: true,
        enableRollback: false,
        createBackup: true,
        reportingDir: '/tmp/migrations',
        enableDetailedReports: true,
        enableProgressTracking: true,
        ...options
    };
    return new MigrationRunner(defaultConfig, prisma);
}
//# sourceMappingURL=migration-runner.js.map