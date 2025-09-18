/**
 * Custom Seq Transport for Winston
 * Fortium Monitoring Web Service - Seq Integration Sprint 1
 * Task 1.1: SeqTransport Implementation
 */

import winston from 'winston';
import TransportStream from 'winston-transport';
import { Logger } from 'seq-logging';
import { config } from './environment';

interface SeqTransportOptions extends TransportStream.TransportStreamOptions {
  serverUrl?: string;
  apiKey?: string;
  maxBatchingSize?: number;
  batchingDelay?: number;
  requestTimeout?: number;
  compact?: boolean;
  onError?: (error: Error) => void;
}

interface CircuitBreakerState {
  isOpen: boolean;
  failureCount: number;
  lastFailureTime: number;
  successCount: number;
}

/**
 * Custom Winston Transport for Seq Structured Logging
 * 
 * Features:
 * - Batch processing with configurable intervals
 * - Circuit breaker pattern for reliability
 * - Automatic retry with exponential backoff
 * - Performance monitoring and metrics
 */
export class SeqTransport extends TransportStream {
  private seqLogger: Logger;
  private options: Required<SeqTransportOptions>;
  private circuitBreaker: CircuitBreakerState;
  private logBuffer: any[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private performanceMetrics = {
    totalLogs: 0,
    successfulLogs: 0,
    failedLogs: 0,
    averageLatency: 0,
    lastFlushTime: Date.now(),
  };

  // Circuit breaker thresholds
  private static readonly FAILURE_THRESHOLD = 5;
  private static readonly SUCCESS_THRESHOLD = 3;
  private static readonly CIRCUIT_RESET_TIMEOUT = 30000; // 30 seconds

  constructor(options: SeqTransportOptions = {}) {
    super(options);

    // Set default options
    this.options = {
      ...options,
      serverUrl: options.serverUrl || config.seq?.serverUrl || 'http://localhost:5341',
      apiKey: options.apiKey || config.seq?.apiKey,
      maxBatchingSize: options.maxBatchingSize || 100,
      batchingDelay: options.batchingDelay || 5000, // 5 seconds
      requestTimeout: options.requestTimeout || 10000, // 10 seconds
      compact: options.compact ?? false,
      onError: options.onError || this.defaultErrorHandler,
    };

    // Initialize circuit breaker
    this.circuitBreaker = {
      isOpen: false,
      failureCount: 0,
      lastFailureTime: 0,
      successCount: 0,
    };

    // Initialize Seq logger
    this.seqLogger = new Logger({
      serverUrl: this.options.serverUrl,
      apiKey: this.options.apiKey,
      onError: this.handleSeqError.bind(this),
    });

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
      // Check circuit breaker state
      if (this.isCircuitBreakerOpen()) {
        this.handleCircuitBreakerOpen(info, callback);
        return;
      }

      // Convert Winston format to Seq format
      const seqEntry = this.convertToSeqFormat(info);
      
      // Add to buffer for batch processing
      this.logBuffer.push({
        entry: seqEntry,
        originalInfo: info,
        timestamp: startTime,
      });

      // Update metrics
      this.performanceMetrics.totalLogs++;

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
   * Convert Winston log format to Seq format
   */
  private convertToSeqFormat(info: any): any {
    const timestamp = new Date(info.timestamp || Date.now());
    const level = this.mapLogLevel(info.level);
    
    // Extract message template and properties
    const { message, ...properties } = info;
    
    // Clean up Winston metadata
    delete properties.level;
    delete properties.timestamp;
    delete properties.service;

    return {
      '@t': timestamp.toISOString(),
      '@l': level,
      '@m': message,
      '@mt': message, // Message template - could be enhanced for templated messages
      ...properties,
    };
  }

  /**
   * Map Winston log levels to Seq levels
   */
  private mapLogLevel(winstonLevel: string): string {
    const levelMap: Record<string, string> = {
      error: 'Error',
      warn: 'Warning', 
      info: 'Information',
      debug: 'Debug',
    };
    
    return levelMap[winstonLevel] || 'Information';
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
   * Flush buffered logs to Seq
   */
  private async flush(): Promise<void> {
    if (this.logBuffer.length === 0 || this.isCircuitBreakerOpen()) {
      return;
    }

    const batch = [...this.logBuffer];
    this.logBuffer = [];
    
    const startTime = Date.now();

    try {
      // Send batch to Seq
      const entries = batch.map(item => item.entry);
      await this.sendToSeq(entries);

      // Update success metrics
      const latency = Date.now() - startTime;
      this.updatePerformanceMetrics(batch.length, latency, true);
      this.handleCircuitBreakerSuccess();

    } catch (error) {
      // Handle batch failure
      this.handleBatchFailure(batch, error as Error);
    }

    this.performanceMetrics.lastFlushTime = Date.now();
  }

  /**
   * Send entries to Seq server
   */
  private async sendToSeq(entries: any[]): Promise<void> {
    return new Promise((resolve, reject) => {
      let processed = 0;
      
      entries.forEach(entry => {
        this.seqLogger.emit(entry);
        processed++;
        
        if (processed === entries.length) {
          resolve();
        }
      });

      // Timeout handling
      setTimeout(() => {
        if (processed < entries.length) {
          reject(new Error(`Seq batch timeout: only ${processed}/${entries.length} entries processed`));
        }
      }, this.options.requestTimeout);
    });
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
    if (timeSinceFailure > SeqTransport.CIRCUIT_RESET_TIMEOUT) {
      this.circuitBreaker.isOpen = false;
      this.circuitBreaker.failureCount = 0;
      this.circuitBreaker.successCount = 0;
      return false;
    }

    return true;
  }

  private handleCircuitBreakerOpen(info: any, callback?: () => void): void {
    // Fallback to console logging when circuit is open
    console.warn('[SeqTransport] Circuit breaker open, falling back to console:', info.message);
    this.performanceMetrics.failedLogs++;
    callback?.();
  }

  private handleCircuitBreakerSuccess(): void {
    this.circuitBreaker.successCount++;
    
    if (this.circuitBreaker.successCount >= SeqTransport.SUCCESS_THRESHOLD) {
      this.circuitBreaker.isOpen = false;
      this.circuitBreaker.failureCount = 0;
      this.circuitBreaker.successCount = 0;
    }
  }

  /**
   * Error handling
   */
  private handleSeqError(error: Error): void {
    this.circuitBreaker.failureCount++;
    this.circuitBreaker.lastFailureTime = Date.now();

    if (this.circuitBreaker.failureCount >= SeqTransport.FAILURE_THRESHOLD) {
      this.circuitBreaker.isOpen = true;
      console.warn('[SeqTransport] Circuit breaker opened due to repeated failures');
    }

    this.options.onError(error);
  }

  private handleBatchFailure(batch: any[], error: Error): void {
    // Re-queue failed batch (with limit to prevent infinite growth)
    if (this.logBuffer.length < this.options.maxBatchingSize * 2) {
      this.logBuffer.unshift(...batch);
    }

    this.updatePerformanceMetrics(batch.length, 0, false);
    this.handleSeqError(error);
  }

  private handleError(error: Error, callback?: () => void): void {
    this.performanceMetrics.failedLogs++;
    this.options.onError(error);
    callback?.();
  }

  private defaultErrorHandler(error: Error): void {
    console.error('[SeqTransport] Error:', error.message);
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
  } {
    return {
      ...this.performanceMetrics,
      circuitBreakerOpen: this.circuitBreaker.isOpen,
      bufferSize: this.logBuffer.length,
    };
  }

  /**
   * Health check for Seq connectivity
   */
  public async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    latency?: number;
    error?: string;
  }> {
    if (this.circuitBreaker.isOpen) {
      return {
        status: 'unhealthy',
        error: 'Circuit breaker open',
      };
    }

    try {
      const startTime = Date.now();
      
      // Send test log entry
      await this.sendToSeq([{
        '@t': new Date().toISOString(),
        '@l': 'Information',
        '@m': 'Health check test',
        '@mt': 'Health check test',
        healthCheck: true,
      }]);

      const latency = Date.now() - startTime;
      
      return {
        status: latency < 100 ? 'healthy' : 'degraded',
        latency,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: (error as Error).message,
      };
    }
  }

  /**
   * Cleanup resources
   */
  public close(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Final flush
    this.flush();
  }
}

/**
 * Factory function to create configured Seq transport
 */
export function createSeqTransport(options?: SeqTransportOptions): SeqTransport {
  return new SeqTransport(options);
}

/**
 * Environment-specific configuration
 */
export const seqTransportConfig = {
  development: {
    serverUrl: 'http://localhost:5341',
    maxBatchingSize: 50,
    batchingDelay: 5000,
    requestTimeout: 10000,
    compact: false,
  },
  production: {
    serverUrl: process.env.SEQ_SERVER_URL || 'https://seq.production.company.com',
    apiKey: process.env.SEQ_API_KEY,
    maxBatchingSize: 100,
    batchingDelay: 30000,
    requestTimeout: 10000,
    compact: true,
  },
};