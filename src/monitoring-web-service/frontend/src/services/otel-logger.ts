/**
 * Frontend OTEL-Only Logger Service
 * Sprint 3: OTEL Integration - Frontend OTEL-Only Logging
 *
 * Features:
 * - Direct OTEL collector integration
 * - Structured logging with OTEL semantic conventions
 * - Automatic trace correlation
 * - No console.log or local storage fallbacks
 */

import { v4 as uuidv4 } from 'uuid';

// OTEL Log Levels matching OTEL specification
export enum OTELLogLevel {
  TRACE = 1,
  DEBUG = 5,
  INFO = 9,
  WARN = 13,
  ERROR = 17,
  FATAL = 21,
}

export interface OTELLogRecord {
  timestamp: string;
  severityText: string;
  severityNumber: number;
  body: string;
  attributes: Record<string, any>;
  traceId?: string;
  spanId?: string;
  traceFlags?: number;
}

export interface OTELLoggerConfig {
  endpoint: string;
  serviceName: string;
  serviceVersion: string;
  serviceNamespace: string;
  batchSize: number;
  flushInterval: number;
  maxRetries: number;
  requestTimeout: number;
  enableCompression: boolean;
}

/**
 * OTEL-Only Frontend Logger
 * Sends logs directly to OTEL collector without console fallbacks
 */
export class OTELFrontendLogger {
  private config: OTELLoggerConfig;
  private logBuffer: OTELLogRecord[] = [];
  private flushTimer: number | null = null;
  private correlationId: string;
  private sessionId: string;
  private isOnline: boolean = navigator.onLine;

  private static readonly DEFAULT_CONFIG: OTELLoggerConfig = {
    endpoint: '/api/v1/otel/logs',
    serviceName: 'fortium-metrics-frontend',
    serviceVersion: '1.0.0',
    serviceNamespace: 'fortium-platform',
    batchSize: 50,
    flushInterval: 10000, // 10 seconds
    maxRetries: 3,
    requestTimeout: 5000,
    enableCompression: false,
  };

  constructor(config: Partial<OTELLoggerConfig> = {}) {
    this.config = { ...OTELFrontendLogger.DEFAULT_CONFIG, ...config };
    this.correlationId = uuidv4();
    this.sessionId = this.getOrCreateSessionId();

    this.setupEventListeners();
    this.startFlushTimer();
  }

  /**
   * Get or create session ID from sessionStorage
   */
  private getOrCreateSessionId(): string {
    let sessionId = sessionStorage.getItem('fortium_session_id');
    if (!sessionId) {
      sessionId = uuidv4();
      sessionStorage.setItem('fortium_session_id', sessionId);
    }
    return sessionId;
  }

  /**
   * Core logging method following OTEL standards
   */
  public log(
    level: OTELLogLevel,
    message: string,
    attributes: Record<string, any> = {}
  ): void {
    const record: OTELLogRecord = {
      timestamp: new Date().toISOString(),
      severityText: this.getLevelText(level),
      severityNumber: level,
      body: message,
      attributes: {
        // Service resource attributes (OTEL semantic conventions)
        'service.name': this.config.serviceName,
        'service.version': this.config.serviceVersion,
        'service.namespace': this.config.serviceNamespace,
        'service.instance.id': this.sessionId,

        // Browser/client attributes
        'browser.user_agent': navigator.userAgent,
        'browser.url': window.location.href,
        'browser.language': navigator.language,
        'browser.platform': navigator.platform,

        // Session tracking
        'session.id': this.sessionId,
        'correlation.id': this.correlationId,

        // Custom attributes
        ...attributes,
      },
    };

    // Add trace context if available
    this.addTraceContext(record);

    // Add to buffer
    this.logBuffer.push(record);

    // Flush if buffer is full
    if (this.logBuffer.length >= this.config.batchSize) {
      this.flush();
    }
  }

  /**
   * Add trace context to log record if available
   */
  private addTraceContext(record: OTELLogRecord): void {
    // Try to extract trace context from current span
    // Note: This would integrate with actual OTEL tracing when implemented
    try {
      // Placeholder for OTEL trace context extraction
      // In a real implementation, this would use:
      // const span = api.trace.getActiveSpan();
      // if (span) {
      //   const spanContext = span.spanContext();
      //   record.traceId = spanContext.traceId;
      //   record.spanId = spanContext.spanId;
      //   record.traceFlags = spanContext.traceFlags;
      // }
    } catch (error) {
      // Silently handle trace context extraction errors
    }
  }

  /**
   * Get severity text from level number
   */
  private getLevelText(level: OTELLogLevel): string {
    switch (level) {
      case OTELLogLevel.TRACE:
        return 'TRACE';
      case OTELLogLevel.DEBUG:
        return 'DEBUG';
      case OTELLogLevel.INFO:
        return 'INFO';
      case OTELLogLevel.WARN:
        return 'WARN';
      case OTELLogLevel.ERROR:
        return 'ERROR';
      case OTELLogLevel.FATAL:
        return 'FATAL';
      default:
        return 'INFO';
    }
  }

  /**
   * Convenience methods for different log levels
   */
  public trace(message: string, attributes?: Record<string, any>): void {
    this.log(OTELLogLevel.TRACE, message, attributes);
  }

  public debug(message: string, attributes?: Record<string, any>): void {
    this.log(OTELLogLevel.DEBUG, message, attributes);
  }

  public info(message: string, attributes?: Record<string, any>): void {
    this.log(OTELLogLevel.INFO, message, attributes);
  }

  public warn(message: string, attributes?: Record<string, any>): void {
    this.log(OTELLogLevel.WARN, message, attributes);
  }

  public error(message: string, error?: Error, attributes?: Record<string, any>): void {
    const errorAttributes = { ...attributes };

    if (error) {
      errorAttributes['error.type'] = error.constructor.name;
      errorAttributes['error.message'] = error.message;
      errorAttributes['error.stack'] = error.stack || '';
      errorAttributes['exception.type'] = error.constructor.name;
      errorAttributes['exception.message'] = error.message;
      errorAttributes['exception.stacktrace'] = error.stack || '';
    }

    this.log(OTELLogLevel.ERROR, message, errorAttributes);
  }

  public fatal(message: string, error?: Error, attributes?: Record<string, any>): void {
    const errorAttributes = { ...attributes };

    if (error) {
      errorAttributes['error.type'] = error.constructor.name;
      errorAttributes['error.message'] = error.message;
      errorAttributes['error.stack'] = error.stack || '';
      errorAttributes['exception.type'] = error.constructor.name;
      errorAttributes['exception.message'] = error.message;
      errorAttributes['exception.stacktrace'] = error.stack || '';
    }

    this.log(OTELLogLevel.FATAL, message, errorAttributes);
  }

  /**
   * Setup event listeners for automatic flushing
   */
  private setupEventListeners(): void {
    // Network status
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.flush();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });

    // Page unload - final flush
    window.addEventListener('beforeunload', () => {
      if (this.logBuffer.length > 0) {
        this.flushSync(); // Synchronous flush on unload
      }
    });

    // Visibility change - flush when page becomes hidden
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.logBuffer.length > 0) {
        this.flush();
      }
    });
  }

  /**
   * Start automatic buffer flush timer
   */
  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = window.setInterval(() => {
      if (this.logBuffer.length > 0 && this.isOnline) {
        this.flush();
      }
    }, this.config.flushInterval);
  }

  /**
   * Flush logs to OTEL collector (async)
   */
  public async flush(): Promise<void> {
    if (this.logBuffer.length === 0 || !this.isOnline) {
      return;
    }

    const logsToSend = [...this.logBuffer];
    this.logBuffer = [];

    try {
      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Correlation-ID': this.correlationId,
        },
        body: JSON.stringify({
          resourceLogs: [
            {
              resource: {
                attributes: {
                  'service.name': this.config.serviceName,
                  'service.version': this.config.serviceVersion,
                  'service.namespace': this.config.serviceNamespace,
                  'service.instance.id': this.sessionId,
                },
              },
              scopeLogs: [
                {
                  scope: {
                    name: 'fortium-frontend-logger',
                    version: '1.0.0',
                  },
                  logRecords: logsToSend,
                },
              ],
            },
          ],
        }),
        signal: AbortSignal.timeout(this.config.requestTimeout),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

    } catch (error) {
      // In OTEL-only mode, we don't have fallbacks
      // Just silently drop the logs to avoid infinite loops
      // In production, you might want to implement a dead letter queue
    }
  }

  /**
   * Synchronous flush for critical scenarios (e.g., page unload)
   */
  private flushSync(): void {
    if (this.logBuffer.length === 0 || !this.isOnline) {
      return;
    }

    const logsToSend = [...this.logBuffer];
    this.logBuffer = [];

    try {
      // Use sendBeacon for reliable delivery during page unload
      const payload = JSON.stringify({
        resourceLogs: [
          {
            resource: {
              attributes: {
                'service.name': this.config.serviceName,
                'service.version': this.config.serviceVersion,
                'service.namespace': this.config.serviceNamespace,
                'service.instance.id': this.sessionId,
              },
            },
            scopeLogs: [
              {
                scope: {
                  name: 'fortium-frontend-logger',
                  version: '1.0.0',
                },
                logRecords: logsToSend,
              },
            ],
          },
        ],
      });

      navigator.sendBeacon(this.config.endpoint, payload);
    } catch (error) {
      // Silently handle beacon send errors
    }
  }

  /**
   * Set correlation ID for trace correlation
   */
  public setCorrelationId(correlationId: string): void {
    this.correlationId = correlationId;
  }

  /**
   * Update logger configuration
   */
  public updateConfig(config: Partial<OTELLoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current buffer size
   */
  public getBufferSize(): number {
    return this.logBuffer.length;
  }

  /**
   * Check if logger is online
   */
  public isLoggerOnline(): boolean {
    return this.isOnline;
  }

  /**
   * Cleanup resources
   */
  public dispose(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Final flush
    if (this.logBuffer.length > 0) {
      this.flushSync();
    }
  }
}

// Global OTEL logger instance
export const otelLogger = new OTELFrontendLogger();

// Export convenience methods
export const logTrace = otelLogger.trace.bind(otelLogger);
export const logDebug = otelLogger.debug.bind(otelLogger);
export const logInfo = otelLogger.info.bind(otelLogger);
export const logWarn = otelLogger.warn.bind(otelLogger);
export const logError = otelLogger.error.bind(otelLogger);
export const logFatal = otelLogger.fatal.bind(otelLogger);

// Replace console methods to prevent accidental console logging
export const disableConsoleLogging = (): void => {
  // Save original console methods for internal use only
  const originalConsole = { ...console };

  // Override console methods to route to OTEL logger
  console.log = (...args: any[]) => {
    otelLogger.info(args.join(' '));
  };

  console.info = (...args: any[]) => {
    otelLogger.info(args.join(' '));
  };

  console.warn = (...args: any[]) => {
    otelLogger.warn(args.join(' '));
  };

  console.error = (...args: any[]) => {
    otelLogger.error(args.join(' '));
  };

  console.debug = (...args: any[]) => {
    otelLogger.debug(args.join(' '));
  };

  console.trace = (...args: any[]) => {
    otelLogger.trace(args.join(' '));
  };

  // Keep original console available for emergency debugging
  (window as any).__originalConsole = originalConsole;
};

// Auto-disable console logging in production
if (process.env.NODE_ENV === 'production') {
  disableConsoleLogging();
}