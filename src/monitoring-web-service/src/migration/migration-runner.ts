/**
 * Migration Runner - Orchestrates Complete Migration Process
 * Coordinates parsing, transformation, validation, and import of historical data
 * 
 * Sprint 6 - Task 6.1: Historical Data Migration Scripts
 * Complete end-to-end migration orchestration with error handling and reporting
 */

import { LocalDataParser, parseDefaultMetricsLocation, ParseResult, ParseOptions } from './data-parser';
import { DataTransformer, createDefaultTransformer, TransformationResult, TransformationOptions } from './data-transformer';
import { BulkImporter, createBulkImporter, ImportResult, BulkImportOptions, ImportProgress } from './bulk-importer';
import { DataValidator } from './data-validator';
import { BaselineComparator } from './baseline-comparator';
import { PrismaClient } from '../generated/prisma-client';
import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface MigrationConfig {
  // Data source configuration
  sourceMetricsDir?: string;
  useDefaultLocation?: boolean;
  
  // Tenant configuration
  tenantId: string;
  tenantSchemaName: string;
  
  // User mapping configuration
  userMappingStrategy: 'create' | 'map' | 'default';
  defaultUserId?: string;
  
  // Processing options
  parseOptions: Partial<ParseOptions>;
  transformationOptions: Partial<TransformationOptions>;
  importOptions: Partial<BulkImportOptions>;
  
  // Validation and recovery options
  enableValidation: boolean;
  enableBaselineComparison: boolean;
  enableRollback: boolean;
  createBackup: boolean;
  
  // Reporting options
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
  
  // Phase results
  parseResult: ParseResult;
  transformationResult: TransformationResult;
  importResult: ImportResult;
  validationResult?: ValidationResult;
  baselineResult?: BaselineComparisonResult;
  
  // Summary statistics
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
  
  // Generated reports
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
    timeRangeDiff: { start: number; end: number };
  };
  confidence: number;
}

/**
 * Main migration orchestrator
 */
export class MigrationRunner extends EventEmitter {
  private readonly config: MigrationConfig;
  private readonly prisma: PrismaClient;
  private readonly migrationId: string;
  private readonly reportingDir: string;

  constructor(config: MigrationConfig, prisma: PrismaClient) {
    super();
    this.config = config;
    this.prisma = prisma;
    this.migrationId = `migration-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.reportingDir = path.join(config.reportingDir, this.migrationId);
  }

  /**
   * Execute complete migration process
   */
  async runMigration(): Promise<MigrationResult> {
    const startTime = new Date();
    console.log(`🚀 Starting migration ${this.migrationId} for tenant: ${this.config.tenantId}`);
    
    // Initialize result structure
    const result: MigrationResult = {
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
      // Setup reporting directory
      await this.setupReporting();

      // Phase 1: Parse local data files
      console.log('📊 Phase 1: Parsing local metrics files...');
      result.parseResult = await this.parseLocalData();
      this.emit('phaseComplete', { phase: 'parse', result: result.parseResult });

      if (result.parseResult.errors.length > 0) {
        console.warn(`⚠️  Parse phase completed with ${result.parseResult.errors.length} errors`);
      }

      // Phase 2: Transform data to cloud format
      console.log('🔄 Phase 2: Transforming data for cloud import...');
      result.transformationResult = await this.transformData(result.parseResult);
      this.emit('phaseComplete', { phase: 'transform', result: result.transformationResult });

      // Phase 3: Pre-import validation (optional)
      if (this.config.enableValidation) {
        console.log('🔍 Phase 3: Pre-import validation...');
        result.validationResult = await this.validateTransformedData(result.transformationResult);
        this.emit('phaseComplete', { phase: 'validate', result: result.validationResult });

        if (!result.validationResult.isValid) {
          throw new Error(`Validation failed: ${result.validationResult.errors.join(', ')}`);
        }
      }

      // Phase 4: Backup existing data (optional)
      if (this.config.createBackup) {
        console.log('💾 Phase 4: Creating data backup...');
        await this.createBackup();
        this.emit('phaseComplete', { phase: 'backup', result: { success: true } });
      }

      // Phase 5: Import data to database
      console.log('📤 Phase 5: Importing data to cloud database...');
      result.importResult = await this.importData(result.transformationResult);
      this.emit('phaseComplete', { phase: 'import', result: result.importResult });

      // Phase 6: Post-import validation and baseline comparison (optional)
      if (this.config.enableBaselineComparison) {
        console.log('📊 Phase 6: Baseline comparison...');
        result.baselineResult = await this.compareBaseline(result.parseResult, result.importResult);
        this.emit('phaseComplete', { phase: 'baseline', result: result.baselineResult });
      }

      // Phase 7: Generate reports
      if (this.config.enableDetailedReports) {
        console.log('📋 Phase 7: Generating migration reports...');
        await this.generateReports(result);
        this.emit('phaseComplete', { phase: 'reporting', result: { success: true } });
      }

      // Calculate final results
      result.endTime = new Date();
      result.totalDurationMs = result.endTime.getTime() - result.startTime.getTime();
      result.summary = this.calculateSummary(result);
      
      // Determine overall success
      const hasAnyErrors = result.parseResult.errors.length > 0 ||
                          result.transformationResult.errors.length > 0 ||
                          result.importResult.errors.length > 0;
      
      result.success = !hasAnyErrors && result.importResult.success;

      // Final log summary
      console.log(`✅ Migration ${this.migrationId} completed in ${result.totalDurationMs}ms`);
      console.log(`📊 Summary: ${result.summary.importedSessions} sessions, ${result.summary.importedToolMetrics} tool metrics imported`);
      console.log(`🎯 Data integrity score: ${result.summary.dataIntegrityScore}%`);
      
      if (result.summary.totalErrors > 0) {
        console.warn(`⚠️  ${result.summary.totalErrors} total errors encountered`);
      }

      this.emit('complete', result);
      return result;

    } catch (error) {
      result.success = false;
      result.endTime = new Date();
      result.totalDurationMs = result.endTime.getTime() - result.startTime.getTime();
      
      console.error(`❌ Migration ${this.migrationId} failed:`, error);
      
      // Attempt rollback if enabled
      if (this.config.enableRollback) {
        console.log('🔄 Attempting rollback...');
        try {
          await this.rollbackMigration();
          console.log('✅ Rollback completed successfully');
        } catch (rollbackError) {
          console.error('❌ Rollback failed:', rollbackError);
        }
      }

      this.emit('error', error);
      return result;
    }
  }

  /**
   * Parse local metrics data files
   */
  private async parseLocalData(): Promise<ParseResult> {
    if (this.config.useDefaultLocation) {
      return parseDefaultMetricsLocation(this.config.parseOptions);
    } else if (this.config.sourceMetricsDir) {
      const parser = new LocalDataParser(this.config.sourceMetricsDir, this.config.parseOptions);
      return parser.parseAllFiles();
    } else {
      throw new Error('Either useDefaultLocation must be true or sourceMetricsDir must be specified');
    }
  }

  /**
   * Transform parsed data to cloud format
   */
  private async transformData(parseResult: ParseResult): Promise<TransformationResult> {
    const transformerOptions: Partial<TransformationOptions> = {
      tenantId: this.config.tenantId,
      userMappingStrategy: this.config.userMappingStrategy,
      defaultUserId: this.config.defaultUserId,
      ...this.config.transformationOptions
    };

    const transformer = createDefaultTransformer(this.config.tenantId, transformerOptions);
    return transformer.transform(parseResult);
  }

  /**
   * Validate transformed data before import
   */
  private async validateTransformedData(transformationResult: TransformationResult): Promise<ValidationResult> {
    const validator = new DataValidator(this.prisma, this.config.tenantSchemaName);
    return validator.validateTransformationResult(transformationResult);
  }

  /**
   * Import transformed data to database
   */
  private async importData(transformationResult: TransformationResult): Promise<ImportResult> {
    const importerOptions: Partial<BulkImportOptions> = {
      tenantSchemaName: this.config.tenantSchemaName,
      enableCheckpoints: true,
      checkpointDir: path.join(this.reportingDir, 'checkpoints'),
      ...this.config.importOptions
    };

    const importer = createBulkImporter(this.prisma, this.config.tenantSchemaName, importerOptions);
    
    // Setup progress tracking if enabled
    if (this.config.enableProgressTracking) {
      importer.on('progress', (progress: ImportProgress) => {
        this.emit('importProgress', progress);
        this.logProgress(progress);
      });
    }

    return importer.import(transformationResult);
  }

  /**
   * Compare migration results with baseline data
   */
  private async compareBaseline(parseResult: ParseResult, importResult: ImportResult): Promise<BaselineComparisonResult> {
    const comparator = new BaselineComparator();
    return comparator.compareResults(parseResult, importResult);
  }

  /**
   * Create backup of existing data before migration
   */
  private async createBackup(): Promise<void> {
    const backupDir = path.join(this.reportingDir, 'backup');
    await fs.mkdir(backupDir, { recursive: true });

    // Export existing sessions
    const sessions = await this.prisma.$queryRawUnsafe(`
      SELECT * FROM "${this.config.tenantSchemaName}".metrics_sessions
      ORDER BY created_at DESC
    `);

    await fs.writeFile(
      path.join(backupDir, 'sessions_backup.json'),
      JSON.stringify(sessions, null, 2)
    );

    // Export existing tool metrics
    const toolMetrics = await this.prisma.$queryRawUnsafe(`
      SELECT * FROM "${this.config.tenantSchemaName}".tool_metrics
      ORDER BY created_at DESC
    `);

    await fs.writeFile(
      path.join(backupDir, 'tool_metrics_backup.json'),
      JSON.stringify(toolMetrics, null, 2)
    );

    console.log(`💾 Backup created in ${backupDir}`);
  }

  /**
   * Rollback migration if it fails
   */
  private async rollbackMigration(): Promise<void> {
    // In a real implementation, this would restore from backup
    // For now, we'll just log the action
    console.log('🔄 Rolling back migration changes...');
    
    try {
      // Delete imported data (this is a simplified rollback)
      await this.prisma.$executeRawUnsafe(`
        DELETE FROM "${this.config.tenantSchemaName}".tool_metrics 
        WHERE created_at >= $1
      `, new Date(Date.now() - this.getTotalDurationMs()));

      await this.prisma.$executeRawUnsafe(`
        DELETE FROM "${this.config.tenantSchemaName}".metrics_sessions 
        WHERE created_at >= $1
      `, new Date(Date.now() - this.getTotalDurationMs()));

      console.log('✅ Rollback completed');
    } catch (error) {
      throw new Error(`Rollback failed: ${error.message}`);
    }
  }

  /**
   * Generate comprehensive migration reports
   */
  private async generateReports(result: MigrationResult): Promise<void> {
    const reportsDir = path.join(this.reportingDir, 'reports');
    await fs.mkdir(reportsDir, { recursive: true });

    // Detailed migration report
    if (this.config.enableDetailedReports) {
      const detailReport = this.generateDetailReport(result);
      const detailReportPath = path.join(reportsDir, 'migration_detail_report.md');
      await fs.writeFile(detailReportPath, detailReport);
      result.reports.detailReport = detailReportPath;
    }

    // Error report (if errors occurred)
    if (result.summary.totalErrors > 0) {
      const errorReport = this.generateErrorReport(result);
      const errorReportPath = path.join(reportsDir, 'error_report.json');
      await fs.writeFile(errorReportPath, errorReport);
      result.reports.errorReport = errorReportPath;
    }

    // Validation report (if validation was performed)
    if (result.validationResult) {
      const validationReport = this.generateValidationReport(result.validationResult);
      const validationReportPath = path.join(reportsDir, 'validation_report.md');
      await fs.writeFile(validationReportPath, validationReport);
      result.reports.validationReport = validationReportPath;
    }

    console.log(`📋 Reports generated in ${reportsDir}`);
  }

  /**
   * Setup reporting directory structure
   */
  private async setupReporting(): Promise<void> {
    await fs.mkdir(this.reportingDir, { recursive: true });
    await fs.mkdir(path.join(this.reportingDir, 'checkpoints'), { recursive: true });
    
    // Create migration metadata file
    const metadata = {
      migrationId: this.migrationId,
      tenantId: this.config.tenantId,
      startTime: new Date(),
      config: this.config
    };

    await fs.writeFile(
      path.join(this.reportingDir, 'migration_metadata.json'),
      JSON.stringify(metadata, null, 2)
    );
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(result: MigrationResult): MigrationResult['summary'] {
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
      importedSessions: result.importResult.recordsInserted, // Sessions from import
      importedToolMetrics: result.importResult.recordsInserted - result.importResult.recordsInserted, // Tool metrics
      totalErrors,
      dataIntegrityScore
    };
  }

  /**
   * Log import progress in human-readable format
   */
  private logProgress(progress: ImportProgress): void {
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

  /**
   * Generate detailed migration report in Markdown format
   */
  private generateDetailReport(result: MigrationResult): string {
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

  /**
   * Generate error report in JSON format
   */
  private generateErrorReport(result: MigrationResult): string {
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

  /**
   * Generate validation report in Markdown format
   */
  private generateValidationReport(validation: ValidationResult): string {
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

  private getTotalDurationMs(): number {
    return Date.now() - this.startTime;
  }

  private startTime: number = Date.now();
}

/**
 * Utility function to create a migration runner with sensible defaults
 */
export function createMigrationRunner(
  tenantId: string,
  tenantSchemaName: string,
  prisma: PrismaClient,
  options: Partial<MigrationConfig> = {}
): MigrationRunner {
  const defaultConfig: MigrationConfig = {
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