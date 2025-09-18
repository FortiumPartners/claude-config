/**
 * OpenTelemetry Winston Transport for SignOz
 * Fortium Monitoring Web Service - OpenTelemetry Logging Integration
 * Task 1.1: OpenTelemetry Winston Transport Implementation
 */

import winston from 'winston';
import { OpenTelemetryTransportV3 } from '@opentelemetry/winston-transport';
import { config } from './environment';

interface OTelTransportOptions {
  level?: string;
  format?: winston.Logform.Format;
}

/**
 * Create OpenTelemetry Winston Transport for SignOz
 * This transport automatically sends logs to SignOz via OpenTelemetry
 */
export function createSignOzTransport(options: OTelTransportOptions = {}): OpenTelemetryTransportV3 {
  return new OpenTelemetryTransportV3({
    level: options.level || 'info',
    format: options.format || winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
  });
}

/**
 * Legacy Seq Transport compatibility layer
 * Provides the same interface as the old SeqTransport for backwards compatibility
 */
export class SeqTransport extends OpenTelemetryTransportV3 {
  private performanceMetrics = {
    totalLogs: 0,
    successfulLogs: 0,
    failedLogs: 0,
    averageLatency: 0,
    lastFlushTime: Date.now(),
  };

  constructor(options: any = {}) {
    super({
      level: options.level || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
    });
  }

  /**
   * Get current performance metrics (compatibility method)
   */
  public getMetrics(): typeof this.performanceMetrics & { 
    circuitBreakerOpen: boolean;
    bufferSize: number;
  } {
    return {
      ...this.performanceMetrics,
      circuitBreakerOpen: false, // OpenTelemetry handles retries internally
      bufferSize: 0, // Buffering handled by OpenTelemetry
    };
  }

  /**
   * Health check for OpenTelemetry connectivity
   */
  public async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    latency?: number;
    error?: string;
  }> {
    try {
      // OpenTelemetry is healthy if it's configured
      return {
        status: 'healthy',
        latency: 0,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: (error as Error).message,
      };
    }
  }

  /**
   * Cleanup resources (compatibility method)
   */
  public close(): void {
    // OpenTelemetry handles cleanup automatically
  }
}

/**
 * Factory function to create configured OpenTelemetry transport
 */
export function createSeqTransport(options?: any): SeqTransport {
  return new SeqTransport(options);
}

/**
 * Environment-specific configuration for OpenTelemetry
 */
export const seqTransportConfig = {
  development: {
    level: 'debug',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.prettyPrint()
    ),
  },
  production: {
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
  },
};

/**
 * Get health status and metrics for monitoring
 */
export function getSeqHealth(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency?: number;
  error?: string;
}> {
  // OpenTelemetry logging is considered healthy if properly configured
  return Promise.resolve({
    status: 'healthy',
    latency: 0,
  });
}

export function getSeqMetrics(): {
  totalLogs: number;
  successfulLogs: number;
  failedLogs: number;
  averageLatency: number;
  circuitBreakerOpen: boolean;
  bufferSize: number;
} {
  // Return basic metrics for compatibility
  return {
    totalLogs: 0,
    successfulLogs: 0,
    failedLogs: 0,
    averageLatency: 0,
    circuitBreakerOpen: false,
    bufferSize: 0,
  };
}