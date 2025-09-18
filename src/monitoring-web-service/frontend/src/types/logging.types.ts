/**
 * Logging Types - TypeScript interfaces for frontend structured logging
 * Task 2.1: Frontend Logger Client Implementation
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type SeqLogLevel = 'Information' | 'Warning' | 'Error' | 'Fatal';

export interface LogEntry {
  timestamp: string;
  level: SeqLogLevel;
  message: string;
  messageTemplate: string;
  properties: LogProperties;
  exception?: LogException;
}

export interface LogProperties {
  correlationId: string;
  sessionId: string;
  userId?: string;
  tenantId?: string;
  userAgent: string;
  url: string;
  component?: string;
  action?: string;
  // Additional performance/context properties
  performanceTimestamp?: number;
  memoryUsage?: number;
  renderCount?: number;
  errorBoundary?: string;
  reactFiberNode?: string;
}

export interface LogException {
  type: string;
  message: string;
  stackTrace: string;
  componentStack?: string;
  errorBoundary?: string;
  errorInfo?: {
    componentStack: string;
    errorBoundary: string | null;
  };
}

export interface LogContext {
  correlationId?: string;
  sessionId?: string;
  userId?: string;
  tenantId?: string;
  component?: string;
  action?: string;
  userAgent?: string;
  url?: string;
}

export interface LoggerConfig {
  endpoint: string;
  bufferSize: number;
  flushInterval: number;
  maxRetries: number;
  retryDelay: number;
  offlineStorage: boolean;
  enableDebugLogs: boolean;
  batchSize: number;
  requestTimeout: number;
  rateLimitPerMinute: number;
  maxStorageSize: number;
}

export interface QueuedLogEntry {
  entry: LogEntry;
  retries: number;
  timestamp: number;
  priority: 'low' | 'normal' | 'high' | 'critical';
}

export interface LoggerMetrics {
  bufferSize: number;
  isOnline: boolean;
  correlationId: string;
  sessionId: string;
  totalEntries: number;
  failedEntries: number;
  rateLimitHits: number;
  storageUsage: number;
  avgFlushTime: number;
  lastFlushTime?: number;
}

export interface LogBufferConfig {
  maxSize: number;
  flushThreshold: number;
  timeThreshold: number;
  storageKey: string;
  maxStorageSize: number;
  enableCompression: boolean;
}

export interface LogBufferStats {
  size: number;
  oldestEntry?: number;
  newestEntry?: number;
  storageSize: number;
  compressionRatio?: number;
}

export interface ReactErrorInfo {
  componentStack: string;
  errorBoundary: string | null;
  errorBoundaryStack?: string;
}

export interface ComponentLogContext {
  componentName: string;
  componentProps?: Record<string, any>;
  componentState?: Record<string, any>;
  renderCount?: number;
  mountTime?: number;
  lastRenderTime?: number;
}

export interface PerformanceLogEntry extends LogEntry {
  properties: LogProperties & {
    duration: number;
    startTime: number;
    endTime: number;
    operation: string;
    resourceTiming?: PerformanceResourceTiming;
    navigationTiming?: PerformanceNavigationTiming;
  };
}

// Rate limiting types
export interface RateLimitState {
  requests: number[];
  windowStart: number;
  isLimited: boolean;
}

// Storage management types
export interface StorageQuota {
  used: number;
  available: number;
  percentage: number;
  nearLimit: boolean;
}

// Configuration presets
export const LoggerPresets = {
  development: {
    enableDebugLogs: true,
    bufferSize: 20,
    flushInterval: 10000, // 10 seconds
    rateLimitPerMinute: 1000,
  },
  production: {
    enableDebugLogs: false,
    bufferSize: 100,
    flushInterval: 30000, // 30 seconds
    rateLimitPerMinute: 500,
  },
  testing: {
    enableDebugLogs: true,
    bufferSize: 10,
    flushInterval: 5000, // 5 seconds
    rateLimitPerMinute: 2000,
  },
} as const;

export type LoggerPreset = keyof typeof LoggerPresets;