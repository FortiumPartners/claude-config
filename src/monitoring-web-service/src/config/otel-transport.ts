/**
 * OpenTelemetry Logging Transport for Winston
 * Task 3.1: OTEL Logging Transport Implementation (Sprint 3)
 * 
 * Features:
 * - Parallel SeqTransport functionality with OTEL logs API
 * - Batch processing with configurable intervals
 * - Circuit breaker pattern for reliability  
 * - Integration with existing OTEL SDK configuration
 * - Feature flag control for gradual rollout
 * - Performance monitoring and metrics
 * - Correlation with OTEL traces and spans
 */

import winston from 'winston';
import TransportStream from 'winston-transport';
import { otelFeatureFlags } from './otel.config';
import { config } from './environment';

// Simplified OTEL interfaces for compatibility
interface OTELLogger {
  emit(logRecord: any): void;
}

interface OTELLoggerProvider {
  getLogger(name: string, version?: string): OTELLogger;
  shutdown(): Promise<void>;
}

interface OTELTransportOptions extends TransportStream.TransportStreamOptions {
  endpoint?: string;
  headers?: Record<string, string>;
  maxBatchingSize?: number;
  batchingDelay?: number;
  requestTimeout?: number;
  enableCorrelation?: boolean;
  onError?: (error: Error) => void;
  resourceAttributes?: Record<string, string | number | boolean>;
}

interface CircuitBreakerState {
  isOpen: boolean;
  failureCount: number;
  lastFailureTime: number;
  successCount: number;
}

interface LogRecord {
  timestamp: number;
  severityNumber: SeverityNumber;
  severityText: string;
  body: string;
  attributes: Record<string, any>;
  resource: Record<string, any>;
  traceId?: string;
  spanId?: string;
  traceFlags?: number;
}

/**
 * Custom Winston Transport for OpenTelemetry Logs
 * 
 * Features:
 * - Complete parity with SeqTransport functionality
 * - OTEL logs API integration with SignOz backend
 * - Maintains correlation with existing traces and spans
 * - Circuit breaker and batch processing for reliability
 * - Performance monitoring and health checks
 */
export class OTELTransport extends TransportStream {
  private loggerProvider: LoggerProvider | null = null;
  private otelLogger: api.Logger | null = null;
  private options: Required<OTELTransportOptions>;
  private circuitBreaker: CircuitBreakerState;
  private logBuffer: LogRecord[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private performanceMetrics = {
    totalLogs: 0,
    successfulLogs: 0,
    failedLogs: 0,
    averageLatency: 0,
    lastFlushTime: Date.now(),
    batchesSent: 0,
    correlatedLogs: 0,
  };

  // Circuit breaker thresholds (matching SeqTransport)
  private static readonly FAILURE_THRESHOLD = 5;
  private static readonly SUCCESS_THRESHOLD = 3;
  private static readonly CIRCUIT_RESET_TIMEOUT = 30000; // 30 seconds

  constructor(options: OTELTransportOptions = {}) {
    super(options);

    // Set default options (mirroring SeqTransport patterns)
    this.options = {
      ...options,
      endpoint: options.endpoint || config.otel.exporter.logsEndpoint || 'http://localhost:4318/v1/logs',
      headers: options.headers || { 'Content-Type': 'application/json' },
      maxBatchingSize: options.maxBatchingSize || 100,
      batchingDelay: options.batchingDelay || 5000, // 5 seconds
      requestTimeout: options.requestTimeout || 10000, // 10 seconds
      enableCorrelation: options.enableCorrelation ?? true,
      onError: options.onError || this.defaultErrorHandler,
      resourceAttributes: options.resourceAttributes || {},
    };

    // Initialize circuit breaker
    this.circuitBreaker = {
      isOpen: false,
      failureCount: 0,
      lastFailureTime: 0,
      successCount: 0,
    };

    // Initialize OTEL Logger Provider only if feature flag is enabled
    if (otelFeatureFlags.logs) {
      this.initializeOTELLogger();
    }

    // Start batch processing timer
    this.startBatchTimer();

    // Handle process termination
    process.on('beforeExit', () => {
      this.flush();
    });
  }

  /**
   * Initialize OpenTelemetry Logger Provider and Logger
   */
  private initializeOTELLogger(): void {
    try {
      // Create resource with service attributes and custom attributes
      const resource = otelConfig.resource.merge(new Resource({
        ...this.options.resourceAttributes,
        'service.component': 'logging-transport',
        'telemetry.sdk.name': 'otel-winston-transport',
        'telemetry.sdk.version': '1.0.0',
      }));

      // Create OTLP log exporter
      const logExporter = new OTLPLogExporter({
        url: this.options.endpoint,
        headers: this.options.headers,
        timeoutMillis: this.options.requestTimeout,
        compression: 'gzip',
      });

      // Create logger provider with appropriate processor
      this.loggerProvider = new LoggerProvider({
        resource,
        processors: [
          // Use batch processor for better performance in production
          config.isProduction 
            ? new BatchLogRecordProcessor(logExporter, {
                maxQueueSize: this.options.maxBatchingSize * 2,
                exportTimeoutMillis: this.options.requestTimeout,
                scheduledDelayMillis: this.options.batchingDelay,
              })
            : new SimpleLogRecordProcessor(logExporter) // Immediate in development
        ],
      });

      // Get logger instance
      this.otelLogger = this.loggerProvider.getLogger(
        config.otel.service.name,
        config.otel.service.version
      );

      winstonLogger.debug('OTEL Transport initialized successfully', {
        event: 'otel.transport.init.success',
        endpoint: this.options.endpoint,
        batchSize: this.options.maxBatchingSize,
        batchDelay: this.options.batchingDelay,
      });

    } catch (error) {
      this.handleError(error as Error);
      winstonLogger.error('Failed to initialize OTEL Transport', {
        event: 'otel.transport.init.error',
        error: (error as Error).message,
      });
    }
  }

  /**
   * Winston log method - main entry point for log entries
   */
  log(info: any, callback?: () => void): void {
    const startTime = Date.now();

    try {
      // Early exit if OTEL logging is disabled
      if (!otelFeatureFlags.logs || !this.otelLogger) {
        callback?.();
        return;
      }

      // Check circuit breaker state
      if (this.isCircuitBreakerOpen()) {
        this.handleCircuitBreakerOpen(info, callback);
        return;
      }

      // Convert Winston format to OTEL log record
      const logRecord = this.convertToOTELFormat(info);
      
      // Add to buffer for batch processing
      this.logBuffer.push(logRecord);

      // Update metrics
      this.performanceMetrics.totalLogs++;
      
      // Track correlation if available
      if (logRecord.traceId) {
        this.performanceMetrics.correlatedLogs++;
      }

      // Trigger immediate flush if buffer is full
      if (this.logBuffer.length >= this.options.maxBatchingSize) {
        this.flush();
      }

      callback?.();
    } catch (error) {
      this.handleError(error as Error, callback);
    }
  }

  /**
   * Convert Winston log format to OpenTelemetry log record format
   */
  private convertToOTELFormat(info: any): LogRecord {
    const timestamp = Date.now() * 1000000; // Convert to nanoseconds
    const severityNumber = this.mapLogLevelToSeverity(info.level);
    const severityText = info.level.toUpperCase();
    
    // Extract trace context from active span or log context
    const activeSpan = api.trace.getActiveSpan();
    const spanContext = activeSpan?.spanContext();
    
    // Build attributes with correlation data
    const attributes: Record<string, any> = {
      // Standard log attributes
      'log.source': 'winston',
      'log.transport': 'otel-transport',
      'service.name': config.otel.service.name,
      'service.version': config.otel.service.version,
      'deployment.environment': config.nodeEnv,
      
      // Winston metadata (excluding processed fields)
      ...Object.fromEntries(
        Object.entries(info).filter(([key]) => 
          !['timestamp', 'level', 'message', 'service', 'environment'].includes(key)
        )
      ),
    };

    // Add correlation IDs from request context
    if (info.correlationId) {
      attributes['correlation.id'] = info.correlationId;
    }
    if (info.sessionId) {
      attributes['session.id'] = info.sessionId;
    }
    if (info.userId) {
      attributes['user.id'] = info.userId;
    }
    if (info.tenantId) {
      attributes['tenant.id'] = info.tenantId;
    }
    if (info.requestId) {
      attributes['request.id'] = info.requestId;
    }

    // Add trace context if available
    let traceId: string | undefined;
    let spanId: string | undefined;
    let traceFlags: number | undefined;

    if (this.options.enableCorrelation && spanContext) {
      traceId = spanContext.traceId;
      spanId = spanContext.spanId;
      traceFlags = spanContext.traceFlags;
      
      attributes['trace.id'] = traceId;
      attributes['span.id'] = spanId;
      attributes['trace.flags'] = traceFlags;
    }

    // Add OTEL context from log metadata
    if (info['otel.trace_id']) {
      traceId = info['otel.trace_id'];
      attributes['trace.id'] = traceId;
    }
    if (info['otel.span_id']) {
      spanId = info['otel.span_id'];
      attributes['span.id'] = spanId;
    }

    return {
      timestamp,
      severityNumber,
      severityText,
      body: info.message || '',
      attributes,
      resource: {
        'service.name': config.otel.service.name,
        'service.version': config.otel.service.version,
        'deployment.environment': config.nodeEnv,
      },
      traceId,
      spanId,
      traceFlags,
    };
  }

  /**
   * Map Winston log levels to OpenTelemetry severity numbers
   */
  private mapLogLevelToSeverity(winstonLevel: string): SeverityNumber {
    const levelMap: Record<string, SeverityNumber> = {
      error: SeverityNumber.ERROR,
      warn: SeverityNumber.WARN,
      info: SeverityNumber.INFO,
      debug: SeverityNumber.DEBUG,
    };
    
    return levelMap[winstonLevel] || SeverityNumber.INFO;
  }

  /**
   * Batch processing timer management
   */
  private startBatchTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      if (this.logBuffer.length > 0) {
        this.flush();
      }
    }, this.options.batchingDelay);
  }

  /**
   * Flush buffered logs to OTEL endpoint
   */
  private async flush(): Promise<void> {
    if (this.logBuffer.length === 0 || this.isCircuitBreakerOpen() || !this.otelLogger) {
      return;
    }

    const batch = [...this.logBuffer];
    this.logBuffer = [];
    
    const startTime = Date.now();

    try {
      // Send batch to OTEL
      await this.sendToOTEL(batch);

      // Update success metrics
      const latency = Date.now() - startTime;
      this.updatePerformanceMetrics(batch.length, latency, true);
      this.handleCircuitBreakerSuccess();
      this.performanceMetrics.batchesSent++;

    } catch (error) {
      // Handle batch failure
      this.handleBatchFailure(batch, error as Error);
    }

    this.performanceMetrics.lastFlushTime = Date.now();
  }

  /**
   * Send log records to OpenTelemetry
   */
  private async sendToOTEL(records: LogRecord[]): Promise<void> {
    if (!this.otelLogger) {
      throw new Error('OTEL Logger not initialized');
    }

    return new Promise((resolve, reject) => {
      let processed = 0;
      const total = records.length;

      // Process each log record
      records.forEach(record => {
        try {
          // Emit log using OTEL API
          this.otelLogger!.emit({
            timestamp: record.timestamp,
            severityNumber: record.severityNumber,
            severityText: record.severityText,
            body: record.body,
            attributes: record.attributes,
            resource: record.resource,
            context: record.traceId ? api.trace.setSpanContext(
              api.context.active(),
              api.trace.wrapSpanContext({
                traceId: record.traceId,
                spanId: record.spanId || '0000000000000000',
                traceFlags: record.traceFlags || 0,
              })
            ) : undefined,
          });

          processed++;
          
          if (processed === total) {
            resolve();
          }
        } catch (error) {
          reject(new Error(`Failed to emit log record: ${(error as Error).message}`));
        }
      });

      // Timeout handling
      setTimeout(() => {
        if (processed < total) {
          reject(new Error(`OTEL batch timeout: only ${processed}/${total} records processed`));
        }
      }, this.options.requestTimeout);
    });
  }

  /**
   * Circuit breaker management (matching SeqTransport logic)
   */
  private isCircuitBreakerOpen(): boolean {
    if (!this.circuitBreaker.isOpen) {
      return false;
    }

    // Check if circuit should be reset
    const timeSinceFailure = Date.now() - this.circuitBreaker.lastFailureTime;
    if (timeSinceFailure > OTELTransport.CIRCUIT_RESET_TIMEOUT) {
      this.circuitBreaker.isOpen = false;
      this.circuitBreaker.failureCount = 0;
      this.circuitBreaker.successCount = 0;
      return false;
    }

    return true;
  }

  private handleCircuitBreakerOpen(info: any, callback?: () => void): void {
    // Fallback to console logging when circuit is open
    console.warn('[OTELTransport] Circuit breaker open, falling back to console:', info.message);
    this.performanceMetrics.failedLogs++;
    callback?.();
  }

  private handleCircuitBreakerSuccess(): void {
    this.circuitBreaker.successCount++;
    
    if (this.circuitBreaker.successCount >= OTELTransport.SUCCESS_THRESHOLD) {
      this.circuitBreaker.isOpen = false;
      this.circuitBreaker.failureCount = 0;
      this.circuitBreaker.successCount = 0;
    }
  }

  /**
   * Error handling
   */
  private handleOTELError(error: Error): void {
    this.circuitBreaker.failureCount++;
    this.circuitBreaker.lastFailureTime = Date.now();

    if (this.circuitBreaker.failureCount >= OTELTransport.FAILURE_THRESHOLD) {
      this.circuitBreaker.isOpen = true;
      console.warn('[OTELTransport] Circuit breaker opened due to repeated failures');
    }

    this.options.onError(error);
  }

  private handleBatchFailure(batch: LogRecord[], error: Error): void {
    // Re-queue failed batch (with limit to prevent infinite growth)
    if (this.logBuffer.length < this.options.maxBatchingSize * 2) {
      this.logBuffer.unshift(...batch);
    }

    this.updatePerformanceMetrics(batch.length, 0, false);
    this.handleOTELError(error);
  }

  private handleError(error: Error, callback?: () => void): void {
    this.performanceMetrics.failedLogs++;
    this.options.onError(error);
    callback?.();
  }

  private defaultErrorHandler(error: Error): void {
    console.error('[OTELTransport] Error:', error.message);
  }

  /**
   * Performance metrics management (matching SeqTransport)
   */
  private updatePerformanceMetrics(count: number, latency: number, success: boolean): void {
    if (success) {
      this.performanceMetrics.successfulLogs += count;
      
      // Update rolling average latency
      const currentAvg = this.performanceMetrics.averageLatency;
      this.performanceMetrics.averageLatency = 
        (currentAvg * 0.8) + (latency * 0.2);
    } else {
      this.performanceMetrics.failedLogs += count;
    }
  }

  /**
   * Get current performance metrics
   */
  public getMetrics(): typeof this.performanceMetrics & { 
    circuitBreakerOpen: boolean;
    bufferSize: number;
    otelEnabled: boolean;
    correlationEnabled: boolean;
    correlationRate: number;
  } {
    const correlationRate = this.performanceMetrics.totalLogs > 0 
      ? this.performanceMetrics.correlatedLogs / this.performanceMetrics.totalLogs 
      : 0;

    return {
      ...this.performanceMetrics,
      circuitBreakerOpen: this.circuitBreaker.isOpen,
      bufferSize: this.logBuffer.length,
      otelEnabled: otelFeatureFlags.logs,
      correlationEnabled: this.options.enableCorrelation,
      correlationRate,
    };
  }

  /**
   * Health check for OTEL connectivity
   */
  public async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy' | 'disabled';
    latency?: number;
    error?: string;
    otelStatus?: string;
  }> {
    if (!otelFeatureFlags.logs) {
      return {
        status: 'disabled',
        otelStatus: 'feature_flag_disabled',
      };
    }

    if (!this.otelLogger) {
      return {
        status: 'unhealthy',
        error: 'OTEL Logger not initialized',
        otelStatus: 'not_initialized',
      };
    }

    if (this.circuitBreaker.isOpen) {
      return {
        status: 'unhealthy',
        error: 'Circuit breaker open',
        otelStatus: 'circuit_breaker_open',
      };
    }

    try {
      const startTime = Date.now();
      
      // Send test log entry
      const testRecord: LogRecord = {
        timestamp: Date.now() * 1000000,
        severityNumber: SeverityNumber.INFO,
        severityText: 'INFO',
        body: 'Health check test',
        attributes: {
          'health.check': true,
          'test.type': 'connectivity',
          'service.name': config.otel.service.name,
        },
        resource: {
          'service.name': config.otel.service.name,
          'service.version': config.otel.service.version,
        },
      };

      await this.sendToOTEL([testRecord]);

      const latency = Date.now() - startTime;
      
      return {
        status: latency < 100 ? 'healthy' : 'degraded',
        latency,
        otelStatus: 'operational',
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: (error as Error).message,
        otelStatus: 'error',
      };
    }
  }

  /**
   * Cleanup resources
   */
  public async close(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Final flush
    await this.flush();

    // Shutdown logger provider
    if (this.loggerProvider) {
      await this.loggerProvider.shutdown();
    }
  }
}

/**
 * Factory function to create configured OTEL transport
 */
export function createOTELTransport(options?: OTELTransportOptions): OTELTransport {
  return new OTELTransport(options);
}

/**
 * Environment-specific configuration (mirroring SeqTransport patterns)
 */
export const otelTransportConfig = {
  development: {
    endpoint: config.otel.exporter.logsEndpoint || 'http://localhost:4318/v1/logs',
    maxBatchingSize: 50,
    batchingDelay: 5000,
    requestTimeout: 10000,
    enableCorrelation: true,
  },
  production: {
    endpoint: config.otel.exporter.logsEndpoint || process.env.OTEL_LOGS_ENDPOINT,
    maxBatchingSize: 100,
    batchingDelay: 30000,
    requestTimeout: 10000,
    enableCorrelation: true,
  },
};