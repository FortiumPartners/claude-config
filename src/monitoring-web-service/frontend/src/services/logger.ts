/**
 * Frontend Logger Service
 * Seq Integration Sprint 2 - Task 2.1: Frontend Logger Client
 * 
 * Features:
 * - TypeScript logging client with configurable thresholds
 * - Log buffering with offline LocalStorage fallback
 * - Correlation ID generation and session tracking
 * - Integration with backend Seq pipeline via /api/v1/logs
 */

import { v4 as uuidv4 } from 'uuid';
import {
  LogLevel,
  LogEntry,
  LogContext,
  LoggerConfig,
  QueuedLogEntry,
  LoggerMetrics,
  SeqLogLevel,
  LogProperties,
} from '../types/logging.types';
import { LogBuffer } from './LogBuffer';
import { otelLogger, OTELLogLevel } from './otel-logger';


/**
 * Frontend Logger Client with offline buffering and correlation tracking
 */
export class FrontendLogger {
  private config: LoggerConfig;
  private logBuffer: LogBuffer;
  private flushTimer: number | null = null;
  private isOnline: boolean = navigator.onLine;
  private correlationId: string;
  private sessionId: string;
  private context: LogContext = {};
  private rateLimitWindow: number[] = [];
  private lastFlushTime?: number;

  private static readonly STORAGE_KEY = 'fortium_log_buffer';
  private static readonly DEFAULT_CONFIG: LoggerConfig = {
    endpoint: '/api/v1/logs',
    bufferSize: 100,
    flushInterval: 30000, // 30 seconds
    maxRetries: 3,
    retryDelay: 1000,
    offlineStorage: true,
    enableDebugLogs: process.env.NODE_ENV === 'development',
    batchSize: 50,
    requestTimeout: 10000,
    rateLimitPerMinute: 500,
    maxStorageSize: 1024 * 1024, // 1MB
    enableOTELOnly: process.env.VITE_OTEL_LOGGING_ONLY === 'true' || process.env.NODE_ENV === 'production',
  };

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...FrontendLogger.DEFAULT_CONFIG, ...config };
    this.correlationId = uuidv4();
    this.sessionId = this.getOrCreateSessionId();
    
    // Initialize LogBuffer with config
    this.logBuffer = new LogBuffer({
      maxSize: this.config.bufferSize,
      flushThreshold: Math.floor(this.config.bufferSize * 0.8),
      timeThreshold: this.config.flushInterval,
      storageKey: FrontendLogger.STORAGE_KEY,
      maxStorageSize: this.config.maxStorageSize,
      enableCompression: false, // Keep disabled for now
    });
    
    this.initializeContext();
    this.setupEventListeners();
    this.startFlushTimer();
  }

  /**
   * Initialize base logging context
   */
  private initializeContext(): void {
    this.context = {
      correlationId: this.correlationId,
      sessionId: this.sessionId,
      userAgent: navigator.userAgent,
      url: window.location.href,
    };
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
   * Update context with user/tenant information
   */
  public setContext(context: Partial<LogContext>): void {
    this.context = { ...this.context, ...context };
  }

  /**
   * Update correlation ID for new user session
   */
  public setCorrelationId(correlationId: string): void {
    this.correlationId = correlationId;
    this.context.correlationId = correlationId;
  }

  /**
   * Core logging method
   */
  public log(
    level: LogLevel,
    message: string,
    properties: Record<string, any> = {},
    error?: Error
  ): void {
    // Skip debug logs in production unless explicitly enabled
    if (level === 'debug' && !this.config.enableDebugLogs) {
      return;
    }

    // Route to OTEL logger if in OTEL-only mode
    if (this.config.enableOTELOnly) {
      const otelLevel = this.mapToOTELLevel(level);
      const attributes = {
        ...this.context,
        ...properties,
      };

      if (error) {
        otelLogger.error(message, error, attributes);
      } else {
        otelLogger.log(otelLevel, message, attributes);
      }
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: this.mapLogLevel(level),
      message,
      messageTemplate: message, // Could be enhanced for templated messages
      properties: {
        ...this.context,
        ...properties,
      } as LogProperties,
    };

    // Add exception details if error provided
    if (error) {
      entry.exception = {
        type: error.constructor.name,
        message: error.message,
        stackTrace: error.stack || '',
      };
    }

    this.addToBuffer(entry);
  }

  /**
   * Convenience methods for different log levels
   */
  public debug(message: string, properties?: Record<string, any>): void {
    this.log('debug', message, properties);
  }

  public info(message: string, properties?: Record<string, any>): void {
    this.log('info', message, properties);
  }

  public warn(message: string, properties?: Record<string, any>, error?: Error): void {
    this.log('warn', message, properties, error);
  }

  public error(message: string, properties?: Record<string, any>, error?: Error): void {
    this.log('error', message, properties, error);
  }

  /**
   * Map frontend log levels to Seq levels
   */
  private mapLogLevel(level: LogLevel): SeqLogLevel {
    const levelMap: Record<LogLevel, SeqLogLevel> = {
      debug: 'Information',
      info: 'Information',
      warn: 'Warning',
      error: 'Error',
    };
    return levelMap[level];
  }

  /**
   * Map frontend log levels to OTEL levels
   */
  private mapToOTELLevel(level: LogLevel): OTELLogLevel {
    const levelMap: Record<LogLevel, OTELLogLevel> = {
      debug: OTELLogLevel.DEBUG,
      info: OTELLogLevel.INFO,
      warn: OTELLogLevel.WARN,
      error: OTELLogLevel.ERROR,
    };
    return levelMap[level];
  }

  /**
   * Add log entry to buffer with rate limiting
   */
  private addToBuffer(entry: LogEntry): void {
    // Check rate limiting
    if (!this.checkRateLimit()) {
      console.warn('[FrontendLogger] Rate limit exceeded, dropping log entry');
      return;
    }

    // Determine priority based on log level
    const priority = this.determinePriority(entry.level);
    
    // Add to buffer
    this.logBuffer.add(entry, priority);

    // Trigger immediate flush if buffer should be flushed
    if (this.logBuffer.shouldFlush()) {
      this.flush();
    }
  }

  /**
   * Check rate limiting
   */
  private checkRateLimit(): boolean {
    const now = Date.now();
    const windowStart = now - 60000; // 1 minute window

    // Remove old entries
    this.rateLimitWindow = this.rateLimitWindow.filter(timestamp => timestamp > windowStart);

    // Check if we're under the limit
    if (this.rateLimitWindow.length >= this.config.rateLimitPerMinute) {
      return false;
    }

    // Add current timestamp
    this.rateLimitWindow.push(now);
    return true;
  }

  /**
   * Determine log priority based on level
   */
  private determinePriority(level: SeqLogLevel): 'low' | 'normal' | 'high' | 'critical' {
    switch (level) {
      case 'Fatal':
        return 'critical';
      case 'Error':
        return 'high';
      case 'Warning':
        return 'normal';
      case 'Information':
      default:
        return 'low';
    }
  }

  /**
   * Setup network and page event listeners
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

    // URL changes
    window.addEventListener('popstate', () => {
      this.context.url = window.location.href;
    });

    // Page unload - final flush
    window.addEventListener('beforeunload', () => {
      this.flush(true); // Synchronous flush
    });

    // Visibility change - flush when page becomes hidden
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && !this.logBuffer.isEmpty()) {
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
      if (!this.logBuffer.isEmpty() && this.isOnline) {
        this.flush();
      }
    }, this.config.flushInterval);
  }

  /**
   * Flush buffer to backend API
   */
  public async flush(synchronous: boolean = false): Promise<void> {
    if (this.logBuffer.isEmpty() || !this.isOnline) {
      return;
    }

    const startTime = performance.now();
    const batch = this.logBuffer.getFlushableEntries(this.config.batchSize);
    const entries = batch.map(item => item.entry);

    try {
      const requestOptions: RequestInit = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Correlation-ID': this.correlationId,
        },
        body: JSON.stringify({ entries }),
      };

      // Add timeout for non-synchronous requests
      if (!synchronous) {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), this.config.requestTimeout);
        requestOptions.signal = controller.signal;
      }

      const response = await fetch(this.config.endpoint, requestOptions);

      if (response.ok) {
        // Remove successfully sent entries
        this.logBuffer.removeEntries(batch);
        
        // Update metrics
        const duration = performance.now() - startTime;
        this.lastFlushTime = Date.now();
        
        console.debug(`[FrontendLogger] Flushed ${entries.length} entries in ${duration.toFixed(2)}ms`);
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      this.handleFlushError(batch, error as Error);
    }
  }

  /**
   * Handle flush errors with retry logic
   */
  private handleFlushError(batch: QueuedLogEntry[], error: Error): void {
    console.warn('[FrontendLogger] Flush failed:', error.message);

    // Increment retry count for failed entries
    this.logBuffer.incrementRetries(batch);

    // Remove entries that exceeded max retries
    const failedEntries = this.logBuffer.removeFailedEntries(this.config.maxRetries);
    
    if (failedEntries.length > 0) {
      console.warn(`[FrontendLogger] Dropped ${failedEntries.length} entries after max retries`);
    }

    // Schedule retry for remaining entries
    if (!this.logBuffer.isEmpty()) {
      const retryDelay = this.config.retryDelay * Math.pow(2, batch[0]?.retries || 0);
      setTimeout(() => {
        if (this.isOnline) {
          this.flush();
        }
      }, retryDelay);
    }
  }


  /**
   * Get current buffer status and metrics
   */
  public getMetrics(): LoggerMetrics {
    const bufferStats = this.logBuffer.getStats();
    
    return {
      bufferSize: bufferStats.size,
      isOnline: this.isOnline,
      correlationId: this.correlationId,
      sessionId: this.sessionId,
      totalEntries: bufferStats.size,
      failedEntries: 0, // This would need to be tracked differently with the new buffer
      rateLimitHits: this.rateLimitWindow.length,
      storageUsage: bufferStats.storageSize,
      avgFlushTime: 0, // Would need to implement averaging
      lastFlushTime: this.lastFlushTime,
    };
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
    if (!this.logBuffer.isEmpty()) {
      this.flush(true);
    }

    // Cleanup global error handlers if they exist
    if ((this as any)._globalErrorCleanup) {
      (this as any)._globalErrorCleanup();
    }
  }
}

// Global logger instance
export const logger = new FrontendLogger();

// Re-export logger methods for convenience
export const logDebug = logger.debug.bind(logger);
export const logInfo = logger.info.bind(logger);
export const logWarn = logger.warn.bind(logger);
export const logError = logger.error.bind(logger);