/**
 * Simplified OpenTelemetry Logging Transport for Winston
 * Task 3.1: OTEL Logging Transport Implementation (Sprint 3)
 * 
 * Simplified implementation to demonstrate the parallel logging concept
 * without complex OTEL SDK dependencies. In production, this would be
 * replaced with the full OTEL implementation once dependencies are resolved.
 */

import winston from 'winston';
import TransportStream from 'winston-transport';
import { otelLoggingFlags } from './otel-logging-flags';
import { config } from './environment';

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
  level: string;
  message: string;
  attributes: Record<string, any>;
  traceId?: string;
  spanId?: string;
}

/**
 * Simplified OTEL Transport for demonstration
 * Note: This is a placeholder implementation that logs to console
 * In production, this would use full OTEL SDK integration
 */
export class OTELTransport extends TransportStream {
  private options: OTELTransportOptions & {
    endpoint: string;
    headers: Record<string, string>;
    maxBatchingSize: number;
    batchingDelay: number;
    requestTimeout: number;
    enableCorrelation: boolean;
    onError: (error: Error) => void;
    resourceAttributes: Record<string, string | number | boolean>;
  };
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

    // Set default options
    this.options = {
      ...options,
      endpoint: options.endpoint || config.otel?.exporter?.logsEndpoint || 'http://localhost:4318/v1/logs',
      headers: options.headers || { 'Content-Type': 'application/json' },
      maxBatchingSize: options.maxBatchingSize || 100,
      batchingDelay: options.batchingDelay || 5000,
      requestTimeout: options.requestTimeout || 10000,
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

    // Start batch processing timer
    this.startBatchTimer();

    // Handle process termination
    process.on('beforeExit', () => {
      this.flush();
    });
  }

  /**
   * Winston log method - main entry point for log entries
   */
  log(info: any, callback?: () => void): void {
    const startTime = Date.now();

    try {
      // Early exit if OTEL logging is disabled
      if (!otelLoggingFlags.enableOTELLogging) {
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
   * Convert Winston log format to OTEL log record format
   */
  private convertToOTELFormat(info: any): LogRecord {
    const timestamp = Date.now();
    
    // Build attributes with correlation data
    const attributes: Record<string, any> = {
      'log.source': 'winston',
      'log.transport': 'otel-transport-simple',
      'service.name': config.otel?.service?.name || 'monitoring-web-service',
      'deployment.environment': config.nodeEnv,
      
      // Winston metadata (excluding processed fields)
      ...Object.fromEntries(
        Object.entries(info).filter(([key]) => 
          !['timestamp', 'level', 'message'].includes(key)
        )
      ),
    };

    // Add correlation IDs from request context
    if (info.correlationId) {
      attributes['correlation.id'] = info.correlationId;
    }

    return {
      timestamp,
      level: info.level || 'info',
      message: info.message || '',
      attributes,
      traceId: info.traceId || info['otel.trace_id'],
      spanId: info.spanId || info['otel.span_id'],
    };
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
   * Flush buffered logs (simplified implementation)
   */
  private async flush(): Promise<void> {
    if (this.logBuffer.length === 0 || this.isCircuitBreakerOpen()) {
      return;
    }

    const batch = [...this.logBuffer];
    this.logBuffer = [];
    
    const startTime = Date.now();

    try {
      // Simplified: Log to console (in production, would send to OTEL endpoint)
      console.log(`[OTEL Transport] Flushing ${batch.length} logs to ${this.options.endpoint}`);
      
      // Simulate network call
      await new Promise(resolve => setTimeout(resolve, 10));

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
   * Circuit breaker management
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
    console.warn('[OTELTransport] Circuit breaker open, skipping log');
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
    // Re-queue failed batch (with limit)
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
   * Performance metrics management
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
      otelEnabled: otelLoggingFlags.enableOTELLogging,
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
    if (!otelLoggingFlags.enableOTELLogging) {
      return {
        status: 'disabled',
        otelStatus: 'feature_flag_disabled',
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
      
      // Simulate health check
      await new Promise(resolve => setTimeout(resolve, 5));
      
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
  }
}

/**
 * Factory function to create configured OTEL transport
 */
export function createOTELTransport(options?: OTELTransportOptions): OTELTransport {
  return new OTELTransport(options);
}

/**
 * Environment-specific configuration
 */
export const otelTransportConfig = {
  development: {
    endpoint: 'http://localhost:4318/v1/logs',
    maxBatchingSize: 50,
    batchingDelay: 5000,
    requestTimeout: 10000,
    enableCorrelation: true,
  },
  production: {
    endpoint: process.env.OTEL_LOGS_ENDPOINT || 'http://localhost:4318/v1/logs',
    maxBatchingSize: 100,
    batchingDelay: 30000,
    requestTimeout: 10000,
    enableCorrelation: true,
  },
};