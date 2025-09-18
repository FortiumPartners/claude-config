/**
 * Log Ingestion Service
 * Fortium External Metrics Web Service - Task 2.3: Backend Log API Implementation
 * 
 * Integrates with existing Sprint 1 Winston/Seq infrastructure for log processing
 */

import { 
  LogEntry, 
  LogIngestionResponse, 
  LogProperties,
  sanitizeLogProperties,
  LOG_LIMITS 
} from '../validation/logs.validation';
import { logger, logWithContext, getSeqHealth, getSeqMetrics, LogContext } from '../config/logger';
import { config } from '../config/environment';

export class LogsService {
  private static instance: LogsService;
  private readonly metrics = {
    entriesProcessed: 0,
    entriesFailed: 0,
    totalProcessingTime: 0,
    lastProcessedAt: null as Date | null,
    startedAt: new Date(),
  };

  private constructor() {
    // Initialize service metrics
    logger.info('LogsService initialized', {
      component: 'LogsService',
      event: 'service.initialized',
      maxEntriesPerBatch: LOG_LIMITS.MAX_ENTRIES_PER_BATCH,
      maxBatchSizeMB: LOG_LIMITS.MAX_BATCH_SIZE_MB,
    });
  }

  public static getInstance(): LogsService {
    if (!LogsService.instance) {
      LogsService.instance = new LogsService();
    }
    return LogsService.instance;
  }

  /**
   * Process batch of log entries from frontend
   */
  public async processBatch(
    entries: LogEntry[], 
    context: {
      correlationId: string;
      requestId?: string;
      clientIp?: string;
      userAgent?: string;
      userId?: string;
      tenantId?: string;
    }
  ): Promise<LogIngestionResponse> {
    const startTime = Date.now();
    const response: LogIngestionResponse = {
      success: true,
      processed: 0,
      failed: 0,
      errors: [],
      correlationId: context.correlationId,
    };

    try {
      // Validate batch size
      const batchSizeKB = this.calculateBatchSize(entries);
      if (batchSizeKB > LOG_LIMITS.MAX_BATCH_SIZE_MB * 1024) {
        throw new Error(`Batch size ${batchSizeKB}KB exceeds limit of ${LOG_LIMITS.MAX_BATCH_SIZE_MB * 1024}KB`);
      }

      // Process each log entry
      for (let i = 0; i < entries.length; i++) {
        try {
          await this.processLogEntry(entries[i], context, i);
          response.processed++;
        } catch (error) {
          response.failed++;
          const errorMsg = `Entry ${i}: ${error instanceof Error ? error.message : String(error)}`;
          response.errors.push(errorMsg);
          
          // Log processing error
          logger.error('Failed to process log entry', {
            component: 'LogsService',
            operation: 'processBatch',
            entryIndex: i,
            error: errorMsg,
            correlationId: context.correlationId,
            entry: {
              level: entries[i]?.level,
              message: entries[i]?.message?.substring(0, 100),
              timestamp: entries[i]?.timestamp,
            },
          });
        }
      }

      // Update metrics
      const processingTime = Date.now() - startTime;
      this.updateMetrics(response.processed, response.failed, processingTime);

      // Log batch processing summary
      logger.info('Log batch processed', {
        component: 'LogsService',
        operation: 'processBatch',
        processed: response.processed,
        failed: response.failed,
        totalEntries: entries.length,
        processingTimeMs: processingTime,
        correlationId: context.correlationId,
        batchSizeKB,
      });

      // Set success based on processing results
      response.success = response.failed === 0 || (response.processed > 0 && response.failed < entries.length / 2);

    } catch (error) {
      response.success = false;
      response.failed = entries.length;
      response.errors.push(error instanceof Error ? error.message : String(error));

      logger.error('Log batch processing failed', {
        component: 'LogsService',
        operation: 'processBatch',
        error: error instanceof Error ? error.message : String(error),
        correlationId: context.correlationId,
        entriesCount: entries.length,
      });
    }

    return response;
  }

  /**
   * Process individual log entry and forward to Winston/Seq
   */
  private async processLogEntry(
    entry: LogEntry,
    context: {
      correlationId: string;
      requestId?: string;
      clientIp?: string;
      userAgent?: string;
      userId?: string;
      tenantId?: string;
    },
    entryIndex: number
  ): Promise<void> {
    // Sanitize and enrich properties
    const sanitizedProperties = sanitizeLogProperties(entry.properties || {});
    
    // Create enriched log context
    const logContext: LogContext = {
      correlationId: context.correlationId,
      requestId: context.requestId,
      userId: context.userId || sanitizedProperties.userId,
      tenantId: context.tenantId || sanitizedProperties.tenantId,
      sessionId: sanitizedProperties.sessionId,
      traceId: sanitizedProperties.traceId,
      spanId: sanitizedProperties.spanId,
      operationName: sanitizedProperties.operation,
    };

    // Prepare properties for Winston/Seq
    const winstonProperties = {
      ...sanitizedProperties,
      // Add backend enrichment
      source: 'frontend-client',
      entryIndex,
      clientIp: context.clientIp,
      userAgent: context.userAgent,
      backendProcessedAt: new Date().toISOString(),
      environment: config.nodeEnv,
      service: 'fortium-metrics-web-service',
      // Original entry metadata
      originalTimestamp: entry.timestamp,
      messageTemplate: entry.messageTemplate,
    };

    // Add exception details if present
    if (entry.exception) {
      (winstonProperties as any).exception = {
        type: entry.exception.type,
        message: entry.exception.message,
        stackTrace: entry.exception.stackTrace,
        source: entry.exception.source,
        innerException: entry.exception.innerException,
      };
    }

    // Map frontend log levels to Winston levels
    const winstonLevel = this.mapLogLevel(entry.level);

    // Forward to Winston logger (which will send to Seq via SeqTransport)
    logWithContext(
      winstonLevel,
      entry.message,
      logContext,
      winstonProperties
    );
  }

  /**
   * Map frontend log levels to Winston log levels
   */
  private mapLogLevel(frontendLevel: string): 'error' | 'warn' | 'info' | 'debug' {
    switch (frontendLevel) {
      case 'Fatal':
      case 'Error':
        return 'error';
      case 'Warning':
        return 'warn';
      case 'Information':
        return 'info';
      default:
        return 'debug';
    }
  }

  /**
   * Calculate batch size in KB for validation
   */
  private calculateBatchSize(entries: LogEntry[]): number {
    const jsonString = JSON.stringify(entries);
    return Math.ceil(Buffer.byteLength(jsonString, 'utf8') / 1024);
  }

  /**
   * Update service metrics
   */
  private updateMetrics(processed: number, failed: number, processingTime: number): void {
    this.metrics.entriesProcessed += processed;
    this.metrics.entriesFailed += failed;
    this.metrics.totalProcessingTime += processingTime;
    this.metrics.lastProcessedAt = new Date();
  }

  /**
   * Get service health status
   */
  public async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: {
      winston: boolean;
      seq: {
        status: 'healthy' | 'degraded' | 'unhealthy' | 'disabled';
        latency?: number;
        error?: string;
      };
      rateLimit: {
        enabled: boolean;
        limit: number;
        window: number;
      };
    };
    metrics: {
      entriesProcessed: number;
      entriesFailed: number;
      averageProcessingTime: number;
      uptime: number;
    };
  }> {
    try {
      // Check Winston logger availability
      const winstonHealthy = !!logger;

      // Check Seq transport health
      const seqHealth = await getSeqHealth();

      // Calculate metrics
      const averageProcessingTime = this.metrics.entriesProcessed > 0 
        ? this.metrics.totalProcessingTime / this.metrics.entriesProcessed 
        : 0;

      const uptime = Date.now() - this.metrics.startedAt.getTime();

      // Determine overall health status
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (!winstonHealthy || seqHealth.status === 'unhealthy') {
        status = 'unhealthy';
      } else if (seqHealth.status === 'degraded' || this.metrics.entriesFailed > this.metrics.entriesProcessed * 0.1) {
        status = 'degraded';
      }

      return {
        status,
        checks: {
          winston: winstonHealthy,
          seq: seqHealth,
          rateLimit: {
            enabled: true,
            limit: config.rateLimit.maxRequests,
            window: config.rateLimit.windowMs,
          },
        },
        metrics: {
          entriesProcessed: this.metrics.entriesProcessed,
          entriesFailed: this.metrics.entriesFailed,
          averageProcessingTime: Math.round(averageProcessingTime),
          uptime: Math.round(uptime / 1000), // Convert to seconds
        },
      };
    } catch (error) {
      logger.error('Failed to get log service health status', {
        component: 'LogsService',
        operation: 'getHealthStatus',
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        status: 'unhealthy',
        checks: {
          winston: false,
          seq: { status: 'unhealthy', error: 'Health check failed' },
          rateLimit: { enabled: false, limit: 0, window: 0 },
        },
        metrics: {
          entriesProcessed: this.metrics.entriesProcessed,
          entriesFailed: this.metrics.entriesFailed,
          averageProcessingTime: 0,
          uptime: 0,
        },
      };
    }
  }

  /**
   * Get Seq transport metrics (if available)
   */
  public getSeqMetrics(): any {
    try {
      return getSeqMetrics();
    } catch (error) {
      logger.warn('Failed to get Seq metrics', {
        component: 'LogsService',
        operation: 'getSeqMetrics',
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Get service metrics for monitoring
   */
  public getMetrics(): {
    entriesProcessed: number;
    entriesFailed: number;
    averageProcessingTime: number;
    successRate: number;
    uptime: number;
    lastProcessedAt: Date | null;
  } {
    const successRate = this.metrics.entriesProcessed > 0 
      ? ((this.metrics.entriesProcessed - this.metrics.entriesFailed) / this.metrics.entriesProcessed) * 100
      : 100;

    const averageProcessingTime = this.metrics.entriesProcessed > 0 
      ? this.metrics.totalProcessingTime / this.metrics.entriesProcessed 
      : 0;

    const uptime = Date.now() - this.metrics.startedAt.getTime();

    return {
      entriesProcessed: this.metrics.entriesProcessed,
      entriesFailed: this.metrics.entriesFailed,
      averageProcessingTime: Math.round(averageProcessingTime),
      successRate: Math.round(successRate * 100) / 100,
      uptime: Math.round(uptime / 1000),
      lastProcessedAt: this.metrics.lastProcessedAt,
    };
  }

  /**
   * Reset service metrics (for testing)
   */
  public resetMetrics(): void {
    this.metrics.entriesProcessed = 0;
    this.metrics.entriesFailed = 0;
    this.metrics.totalProcessingTime = 0;
    this.metrics.lastProcessedAt = null;
    this.metrics.startedAt = new Date();

    logger.info('LogsService metrics reset', {
      component: 'LogsService',
      operation: 'resetMetrics',
    });
  }
}

// Export singleton instance
export const logsService = LogsService.getInstance();