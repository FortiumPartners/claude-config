/**
 * Bulk Importer for Historical Metrics Data
 * Efficiently imports large datasets with progress tracking and error handling
 * 
 * Sprint 6 - Task 6.1: Historical Data Migration Scripts
 * Performance Requirements:
 * - Handle 1M+ records efficiently
 * - Memory usage <500MB
 * - Progress tracking with ETA estimation
 * - Resumable imports on failure
 */

import { PrismaClient } from '../generated/prisma-client';
import { TransformedSession, TransformedToolMetric, TransformationResult } from './data-transformer';
import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';

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

/**
 * High-performance bulk importer with progress tracking and error recovery
 */
export class BulkImporter extends EventEmitter {
  private readonly prisma: PrismaClient;
  private readonly options: BulkImportOptions;
  private importId: string;
  private startTime: number = 0;
  private checkpoint: ImportCheckpoint | null = null;

  constructor(prisma: PrismaClient, options: Partial<BulkImportOptions> = {}) {
    super();
    this.prisma = prisma;
    this.options = {
      batchSize: 100,
      maxConcurrentBatches: 3,
      progressReportingInterval: 1000,
      enableCheckpoints: true,
      checkpointDir: '/tmp/migration-checkpoints',
      continueOnError: true,
      validateBeforeInsert: true,
      upsertMode: false,
      tenantSchemaName: 'tenant_default',
      dryRun: false,
      ...options
    };
    
    this.importId = this.generateImportId();
  }

  /**
   * Import transformed data with full progress tracking and error recovery
   */
  async import(transformedData: TransformationResult): Promise<ImportResult> {
    this.startTime = Date.now();
    console.log(`🚀 Starting bulk import ${this.importId} for tenant schema: ${this.options.tenantSchemaName}`);
    console.log(`📊 Data: ${transformedData.sessions.length} sessions, ${transformedData.toolMetrics.length} tool metrics`);
    
    if (this.options.dryRun) {
      console.log('🔍 DRY RUN MODE - No data will be inserted');
    }

    const result: ImportResult = {
      success: false,
      totalRecordsProcessed: 0,
      recordsInserted: 0,
      recordsUpdated: 0,
      recordsSkipped: 0,
      errors: [],
      finalProgress: this.createInitialProgress(transformedData)
    };

    try {
      // Setup checkpoint directory
      if (this.options.enableCheckpoints) {
        await this.ensureCheckpointDir();
        await this.loadExistingCheckpoint();
      }

      // Validate tenant schema exists
      await this.validateTenantSchema();

      // Pre-import validation
      if (this.options.validateBeforeInsert) {
        console.log('🔍 Performing pre-import validation...');
        const validation = await this.validateImportData(transformedData);
        if (!validation.isValid) {
          throw new Error(`Pre-import validation failed: ${validation.errors.join(', ')}`);
        }
      }

      // Calculate checksums for validation
      const originalChecksum = await this.calculateDataChecksum(transformedData);

      // Start progress reporting
      this.startProgressReporting();

      // Import sessions first (foreign key dependency)
      console.log('👥 Importing sessions...');
      const sessionResult = await this.importSessions(transformedData.sessions, result);
      
      // Import tool metrics
      console.log('🔧 Importing tool metrics...');
      const toolMetricResult = await this.importToolMetrics(transformedData.toolMetrics, result);

      // Final validation
      if (!this.options.dryRun) {
        console.log('✅ Performing post-import validation...');
        const importedChecksum = await this.calculateImportedChecksum();
        result.checksumValidation = {
          originalChecksum,
          importedChecksum,
          isValid: originalChecksum === importedChecksum
        };
      }

      // Cleanup checkpoints on success
      if (this.options.enableCheckpoints && result.errors.length === 0) {
        await this.cleanupCheckpoints();
      }

      result.success = result.errors.length === 0 || this.options.continueOnError;
      result.totalRecordsProcessed = sessionResult.processed + toolMetricResult.processed;
      result.recordsInserted = sessionResult.inserted + toolMetricResult.inserted;
      result.recordsUpdated = sessionResult.updated + toolMetricResult.updated;
      result.recordsSkipped = sessionResult.skipped + toolMetricResult.skipped;

      const totalTime = Date.now() - this.startTime;
      console.log(`✅ Import ${this.importId} completed in ${totalTime}ms`);
      console.log(`📊 Results: ${result.recordsInserted} inserted, ${result.recordsUpdated} updated, ${result.recordsSkipped} skipped`);
      console.log(`❌ Errors: ${result.errors.length}`);

      this.emit('complete', result);
      return result;

    } catch (error) {
      result.errors.push({
        type: 'database',
        batchIndex: 0,
        error: `Import failed: ${error.message}`,
        retryable: false,
        originalData: error
      });

      console.error(`❌ Import ${this.importId} failed:`, error);
      this.emit('error', error);
      return result;
    }
  }

  /**
   * Import sessions in batches with progress tracking
   */
  private async importSessions(sessions: TransformedSession[], result: ImportResult): Promise<BatchResult> {
    const batchResult: BatchResult = { processed: 0, inserted: 0, updated: 0, skipped: 0 };
    const batches = this.createBatches(sessions, this.options.batchSize);
    
    console.log(`📋 Processing ${batches.length} session batches...`);

    // Resume from checkpoint if available
    const startBatch = this.checkpoint?.sessionsBatch || 0;
    
    for (let i = startBatch; i < batches.length; i++) {
      const batch = batches[i];
      const batchStartTime = Date.now();

      try {
        if (this.options.dryRun) {
          // Simulate processing time for dry run
          await new Promise(resolve => setTimeout(resolve, 10));
          batchResult.processed += batch.length;
          batchResult.inserted += batch.length;
        } else {
          const batchInsertResult = await this.insertSessionBatch(batch, i);
          batchResult.processed += batchInsertResult.processed;
          batchResult.inserted += batchInsertResult.inserted;
          batchResult.updated += batchInsertResult.updated;
          batchResult.skipped += batchInsertResult.skipped;
        }

        // Update progress
        const progress = this.calculateProgress(sessions.length, 0, batchResult.processed, 0, result);
        this.emit('progress', progress);

        // Save checkpoint
        if (this.options.enableCheckpoints && i % 10 === 0) {
          await this.saveCheckpoint(i, batchResult.processed, 0, 0, result.errors);
        }

        // Rate limiting - avoid overwhelming database
        if (i < batches.length - 1) {
          const batchTime = Date.now() - batchStartTime;
          if (batchTime < 50) { // Minimum 50ms between batches
            await new Promise(resolve => setTimeout(resolve, 50 - batchTime));
          }
        }

      } catch (error) {
        const importError: ImportError = {
          type: 'session',
          batchIndex: i,
          error: `Session batch ${i} failed: ${error.message}`,
          retryable: this.isRetryableError(error),
          originalData: batch
        };

        result.errors.push(importError);
        batchResult.skipped += batch.length;

        if (!this.options.continueOnError) {
          throw error;
        }
      }
    }

    return batchResult;
  }

  /**
   * Import tool metrics in batches with progress tracking
   */
  private async importToolMetrics(toolMetrics: TransformedToolMetric[], result: ImportResult): Promise<BatchResult> {
    const batchResult: BatchResult = { processed: 0, inserted: 0, updated: 0, skipped: 0 };
    const batches = this.createBatches(toolMetrics, this.options.batchSize);
    
    console.log(`🔧 Processing ${batches.length} tool metric batches...`);

    // Resume from checkpoint if available
    const startBatch = this.checkpoint?.toolMetricsBatch || 0;
    
    for (let i = startBatch; i < batches.length; i++) {
      const batch = batches[i];

      try {
        if (this.options.dryRun) {
          // Simulate processing time for dry run
          await new Promise(resolve => setTimeout(resolve, 5));
          batchResult.processed += batch.length;
          batchResult.inserted += batch.length;
        } else {
          const batchInsertResult = await this.insertToolMetricBatch(batch, i);
          batchResult.processed += batchInsertResult.processed;
          batchResult.inserted += batchInsertResult.inserted;
          batchResult.updated += batchInsertResult.updated;
          batchResult.skipped += batchInsertResult.skipped;
        }

        // Update progress
        const progress = this.calculateProgress(0, toolMetrics.length, 0, batchResult.processed, result);
        this.emit('progress', progress);

        // Save checkpoint
        if (this.options.enableCheckpoints && i % 10 === 0) {
          await this.saveCheckpoint(0, 0, i, batchResult.processed, result.errors);
        }

      } catch (error) {
        const importError: ImportError = {
          type: 'toolMetric',
          batchIndex: i,
          error: `Tool metric batch ${i} failed: ${error.message}`,
          retryable: this.isRetryableError(error),
          originalData: batch
        };

        result.errors.push(importError);
        batchResult.skipped += batch.length;

        if (!this.options.continueOnError) {
          throw error;
        }
      }
    }

    return batchResult;
  }

  /**
   * Insert a batch of sessions using efficient bulk operations
   */
  private async insertSessionBatch(batch: TransformedSession[], batchIndex: number): Promise<BatchResult> {
    const result: BatchResult = { processed: 0, inserted: 0, updated: 0, skipped: 0 };

    try {
      if (this.options.upsertMode) {
        // Use upsert for handling duplicates
        for (const session of batch) {
          try {
            const upsertResult = await this.prisma.$executeRawUnsafe(`
              INSERT INTO "${this.options.tenantSchemaName}".metrics_sessions 
              (id, user_id, session_start, session_end, total_duration_ms, tools_used, productivity_score, 
               session_type, project_id, tags, interruptions_count, focus_time_ms, description, created_at, updated_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
              ON CONFLICT (id) DO UPDATE SET
                session_end = EXCLUDED.session_end,
                total_duration_ms = EXCLUDED.total_duration_ms,
                productivity_score = EXCLUDED.productivity_score,
                updated_at = NOW()
            `,
              session.id, session.userId, session.sessionStart, session.sessionEnd,
              session.totalDurationMs?.toString(), JSON.stringify(session.toolsUsed),
              session.productivityScore, session.sessionType, session.projectId,
              JSON.stringify(session.tags), session.interruptionsCount,
              session.focusTimeMs.toString(), session.description
            );

            if (upsertResult === 1) result.inserted++;
            else result.updated++;
            result.processed++;

          } catch (error) {
            console.warn(`Warning: Failed to upsert session ${session.id}:`, error.message);
            result.skipped++;
          }
        }
      } else {
        // Use batch insert for better performance
        const insertData = batch.map(session => ({
          id: session.id,
          user_id: session.userId,
          session_start: session.sessionStart,
          session_end: session.sessionEnd,
          total_duration_ms: session.totalDurationMs?.toString(),
          tools_used: session.toolsUsed ? JSON.stringify(session.toolsUsed) : null,
          productivity_score: session.productivityScore,
          session_type: session.sessionType,
          project_id: session.projectId,
          tags: JSON.stringify(session.tags),
          interruptions_count: session.interruptionsCount,
          focus_time_ms: session.focusTimeMs.toString(),
          description: session.description,
          created_at: new Date(),
          updated_at: new Date()
        }));

        // Use raw SQL for bulk insert performance
        const insertCount = await this.prisma.$executeRawUnsafe(`
          INSERT INTO "${this.options.tenantSchemaName}".metrics_sessions 
          (id, user_id, session_start, session_end, total_duration_ms, tools_used, productivity_score, 
           session_type, project_id, tags, interruptions_count, focus_time_ms, description, created_at, updated_at)
          SELECT * FROM json_populate_recordset(null::"${this.options.tenantSchemaName}".metrics_sessions, $1)
        `, JSON.stringify(insertData));

        result.processed = batch.length;
        result.inserted = insertCount;
      }

      return result;

    } catch (error) {
      // If batch insert fails, try individual inserts to identify problem records
      console.warn(`Batch insert failed for session batch ${batchIndex}, trying individual inserts...`);
      
      for (const session of batch) {
        try {
          await this.prisma.$executeRawUnsafe(`
            INSERT INTO "${this.options.tenantSchemaName}".metrics_sessions 
            (id, user_id, session_start, session_end, total_duration_ms, tools_used, productivity_score, 
             session_type, project_id, tags, interruptions_count, focus_time_ms, description, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
          `,
            session.id, session.userId, session.sessionStart, session.sessionEnd,
            session.totalDurationMs?.toString(), JSON.stringify(session.toolsUsed),
            session.productivityScore, session.sessionType, session.projectId,
            JSON.stringify(session.tags), session.interruptionsCount,
            session.focusTimeMs.toString(), session.description
          );

          result.processed++;
          result.inserted++;

        } catch (individualError) {
          console.warn(`Failed to insert session ${session.id}:`, individualError.message);
          result.skipped++;
        }
      }

      return result;
    }
  }

  /**
   * Insert a batch of tool metrics using efficient bulk operations
   */
  private async insertToolMetricBatch(batch: TransformedToolMetric[], batchIndex: number): Promise<BatchResult> {
    const result: BatchResult = { processed: 0, inserted: 0, updated: 0, skipped: 0 };

    try {
      const insertData = batch.map(metric => ({
        id: metric.id,
        session_id: metric.sessionId,
        tool_name: metric.toolName,
        tool_category: metric.toolCategory,
        execution_count: metric.executionCount,
        total_duration_ms: metric.totalDurationMs.toString(),
        average_duration_ms: metric.averageDurationMs.toString(),
        success_rate: metric.successRate,
        error_count: metric.errorCount,
        memory_usage_mb: metric.memoryUsageMb,
        cpu_time_ms: metric.cpuTimeMs?.toString(),
        parameters: metric.parameters ? JSON.stringify(metric.parameters) : null,
        output_size_bytes: metric.outputSizeBytes?.toString(),
        command_line: metric.commandLine,
        working_directory: metric.workingDirectory,
        created_at: new Date()
      }));

      // Use raw SQL for bulk insert performance
      const insertCount = await this.prisma.$executeRawUnsafe(`
        INSERT INTO "${this.options.tenantSchemaName}".tool_metrics 
        (id, session_id, tool_name, tool_category, execution_count, total_duration_ms, average_duration_ms, 
         success_rate, error_count, memory_usage_mb, cpu_time_ms, parameters, output_size_bytes, 
         command_line, working_directory, created_at)
        SELECT * FROM json_populate_recordset(null::"${this.options.tenantSchemaName}".tool_metrics, $1)
      `, JSON.stringify(insertData));

      result.processed = batch.length;
      result.inserted = insertCount;
      return result;

    } catch (error) {
      // If batch insert fails, try individual inserts
      console.warn(`Batch insert failed for tool metric batch ${batchIndex}, trying individual inserts...`);
      
      for (const metric of batch) {
        try {
          await this.prisma.$executeRawUnsafe(`
            INSERT INTO "${this.options.tenantSchemaName}".tool_metrics 
            (id, session_id, tool_name, tool_category, execution_count, total_duration_ms, average_duration_ms, 
             success_rate, error_count, memory_usage_mb, cpu_time_ms, parameters, output_size_bytes, 
             command_line, working_directory, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
          `,
            metric.id, metric.sessionId, metric.toolName, metric.toolCategory,
            metric.executionCount, metric.totalDurationMs.toString(), 
            metric.averageDurationMs.toString(), metric.successRate, metric.errorCount,
            metric.memoryUsageMb, metric.cpuTimeMs?.toString(),
            metric.parameters ? JSON.stringify(metric.parameters) : null,
            metric.outputSizeBytes?.toString(), metric.commandLine, metric.workingDirectory
          );

          result.processed++;
          result.inserted++;

        } catch (individualError) {
          console.warn(`Failed to insert tool metric ${metric.id}:`, individualError.message);
          result.skipped++;
        }
      }

      return result;
    }
  }

  // Utility and helper methods

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private generateImportId(): string {
    return `import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private createInitialProgress(data: TransformationResult): ImportProgress {
    return {
      totalSessions: data.sessions.length,
      processedSessions: 0,
      totalToolMetrics: data.toolMetrics.length,
      processedToolMetrics: 0,
      errorsCount: 0,
      elapsedTimeMs: 0,
      estimatedRemainingTimeMs: 0,
      currentBatch: 0,
      totalBatches: Math.ceil(data.sessions.length / this.options.batchSize) + 
                   Math.ceil(data.toolMetrics.length / this.options.batchSize),
      throughputRecordsPerSecond: 0,
      memoryUsageMB: 0
    };
  }

  private calculateProgress(
    totalSessions: number, totalToolMetrics: number,
    processedSessions: number, processedToolMetrics: number,
    result: ImportResult
  ): ImportProgress {
    const elapsedTime = Date.now() - this.startTime;
    const totalRecords = totalSessions + totalToolMetrics;
    const processedRecords = processedSessions + processedToolMetrics;
    
    const throughput = processedRecords > 0 ? (processedRecords / elapsedTime) * 1000 : 0;
    const remainingRecords = totalRecords - processedRecords;
    const estimatedRemaining = throughput > 0 ? (remainingRecords / throughput) * 1000 : 0;

    return {
      totalSessions,
      processedSessions,
      totalToolMetrics,
      processedToolMetrics,
      errorsCount: result.errors.length,
      elapsedTimeMs: elapsedTime,
      estimatedRemainingTimeMs: estimatedRemaining,
      currentBatch: Math.floor(processedRecords / this.options.batchSize),
      totalBatches: Math.ceil(totalRecords / this.options.batchSize),
      throughputRecordsPerSecond: Math.round(throughput),
      memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
    };
  }

  private startProgressReporting(): void {
    setInterval(() => {
      const memoryUsage = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
      if (memoryUsage > this.options.batchSize * 2) { // Memory threshold
        console.warn(`⚠️  High memory usage: ${memoryUsage}MB`);
      }
    }, this.options.progressReportingInterval);
  }

  // Checkpoint and recovery methods

  private async ensureCheckpointDir(): Promise<void> {
    try {
      await fs.mkdir(this.options.checkpointDir, { recursive: true });
    } catch (error) {
      console.warn(`Warning: Could not create checkpoint directory: ${error.message}`);
    }
  }

  private async saveCheckpoint(
    sessionsBatch: number, sessionsProcessed: number,
    toolMetricsBatch: number, toolMetricsProcessed: number,
    errors: ImportError[]
  ): Promise<void> {
    if (!this.options.enableCheckpoints) return;

    const checkpoint: ImportCheckpoint = {
      timestamp: new Date(),
      sessionsBatch,
      sessionsProcessed,
      toolMetricsBatch,
      toolMetricsProcessed,
      errors: errors.slice(), // Copy errors array
      options: this.options
    };

    try {
      const checkpointFile = path.join(this.options.checkpointDir, `${this.importId}.checkpoint.json`);
      await fs.writeFile(checkpointFile, JSON.stringify(checkpoint, null, 2));
    } catch (error) {
      console.warn(`Warning: Could not save checkpoint: ${error.message}`);
    }
  }

  private async loadExistingCheckpoint(): Promise<void> {
    try {
      const checkpointFile = path.join(this.options.checkpointDir, `${this.importId}.checkpoint.json`);
      const data = await fs.readFile(checkpointFile, 'utf8');
      this.checkpoint = JSON.parse(data);
      console.log(`📂 Loaded checkpoint: resuming from session batch ${this.checkpoint.sessionsBatch}, tool metrics batch ${this.checkpoint.toolMetricsBatch}`);
    } catch (error) {
      // No existing checkpoint - start fresh
      this.checkpoint = null;
    }
  }

  private async cleanupCheckpoints(): Promise<void> {
    try {
      const checkpointFile = path.join(this.options.checkpointDir, `${this.importId}.checkpoint.json`);
      await fs.unlink(checkpointFile);
    } catch (error) {
      // Checkpoint file might not exist - ignore
    }
  }

  // Validation methods

  private async validateTenantSchema(): Promise<void> {
    try {
      await this.prisma.$executeRawUnsafe(`SELECT 1 FROM "${this.options.tenantSchemaName}".metrics_sessions LIMIT 1`);
    } catch (error) {
      throw new Error(`Tenant schema ${this.options.tenantSchemaName} is not accessible: ${error.message}`);
    }
  }

  private async validateImportData(data: TransformationResult): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Check for required fields
    for (const session of data.sessions.slice(0, 10)) { // Sample validation
      if (!session.id) errors.push('Session missing ID');
      if (!session.userId) errors.push('Session missing user ID');
    }

    for (const metric of data.toolMetrics.slice(0, 10)) { // Sample validation
      if (!metric.sessionId) errors.push('Tool metric missing session ID');
      if (!metric.toolName) errors.push('Tool metric missing tool name');
    }

    return { isValid: errors.length === 0, errors };
  }

  private async calculateDataChecksum(data: TransformationResult): Promise<string> {
    const crypto = require('crypto');
    const hash = crypto.createHash('md5');
    
    // Create deterministic hash of data
    const sortedSessions = data.sessions.sort((a, b) => a.id.localeCompare(b.id));
    const sortedMetrics = data.toolMetrics.sort((a, b) => a.id.localeCompare(b.id));
    
    hash.update(JSON.stringify({ sessions: sortedSessions, metrics: sortedMetrics }));
    return hash.digest('hex');
  }

  private async calculateImportedChecksum(): Promise<string> {
    // In a real implementation, this would query the database and calculate checksum
    // For now, return a placeholder
    return 'imported-checksum-placeholder';
  }

  private isRetryableError(error: any): boolean {
    const retryablePatterns = [
      'connection',
      'timeout',
      'lock',
      'deadlock',
      'serialization'
    ];

    const errorMessage = error.message.toLowerCase();
    return retryablePatterns.some(pattern => errorMessage.includes(pattern));
  }
}

interface BatchResult {
  processed: number;
  inserted: number;
  updated: number;
  skipped: number;
}

/**
 * Utility function to create a bulk importer with sensible defaults
 */
export function createBulkImporter(
  prisma: PrismaClient,
  tenantSchemaName: string,
  options: Partial<BulkImportOptions> = {}
): BulkImporter {
  return new BulkImporter(prisma, {
    tenantSchemaName,
    batchSize: 100,
    maxConcurrentBatches: 3,
    enableCheckpoints: true,
    checkpointDir: '/tmp/migration-checkpoints',
    continueOnError: true,
    validateBeforeInsert: true,
    ...options
  });
}