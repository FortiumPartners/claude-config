/**
 * Log Output Comparison Engine
 * Task 3.3: Parallel Logging Validation Framework - Sub-task 1
 * 
 * Automated comparison system for Seq vs OTEL log outputs with field-by-field validation,
 * correlation ID matching, and detailed discrepancy analysis.
 */

import { EventEmitter } from 'events';
import { logger, LogContext } from '../config/logger';
import * as crypto from 'crypto';

// Types for log comparison
export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  correlationId?: string;
  traceId?: string;
  spanId?: string;
  userId?: string;
  tenantId?: string;
  sessionId?: string;
  requestId?: string;
  operationName?: string;
  metadata: Record<string, any>;
  source: 'seq' | 'otel';
  rawEntry: any;
}

export interface ComparisonResult {
  id: string;
  timestamp: string;
  correlationId: string;
  matched: boolean;
  seqEntry?: LogEntry;
  otelEntry?: LogEntry;
  differences: LogDifference[];
  score: number; // 0-100 similarity score
  analysisDetails: {
    contentMatch: boolean;
    metadataMatch: boolean;
    timingMatch: boolean;
    structureMatch: boolean;
  };
}

export interface LogDifference {
  field: string;
  type: 'missing' | 'different' | 'extra' | 'format';
  seqValue?: any;
  otelValue?: any;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

export interface ComparisonMetrics {
  totalComparisons: number;
  successfulMatches: number;
  partialMatches: number;
  failedMatches: number;
  averageScore: number;
  lastComparison: string;
  criticalDifferences: number;
  performanceMetrics: {
    averageComparisonTimeMs: number;
    slowestComparisonMs: number;
    fastestComparisonMs: number;
  };
}

export interface ComparisonConfig {
  enabled: boolean;
  correlationWindow: number; // milliseconds to wait for matching logs
  tolerances: {
    timestampDeltaMs: number;
    numericPrecision: number;
    stringCaseInsensitive: boolean;
  };
  ignoreFields: string[];
  criticalFields: string[];
  autoAlert: {
    enabled: boolean;
    scoreThreshold: number;
    criticalDifferenceThreshold: number;
  };
}

/**
 * Log Output Comparison Engine
 */
export class LogComparisonService extends EventEmitter {
  private config: ComparisonConfig;
  private metrics: ComparisonMetrics;
  private pendingSeqLogs: Map<string, { entry: LogEntry; timestamp: number }>;
  private pendingOtelLogs: Map<string, { entry: LogEntry; timestamp: number }>;
  private comparisonHistory: ComparisonResult[];
  private cleanupInterval: NodeJS.Timeout;

  constructor(config?: Partial<ComparisonConfig>) {
    super();

    this.config = {
      enabled: true,
      correlationWindow: 5000, // 5 seconds
      tolerances: {
        timestampDeltaMs: 100,
        numericPrecision: 0.001,
        stringCaseInsensitive: false,
      },
      ignoreFields: [
        'timestamp', // Handled separately with tolerance
        'source',
        'rawEntry',
      ],
      criticalFields: [
        'level',
        'message',
        'correlationId',
        'userId',
        'tenantId',
        'operationName',
      ],
      autoAlert: {
        enabled: true,
        scoreThreshold: 80,
        criticalDifferenceThreshold: 5,
      },
      ...config,
    };

    this.metrics = {
      totalComparisons: 0,
      successfulMatches: 0,
      partialMatches: 0,
      failedMatches: 0,
      averageScore: 0,
      lastComparison: new Date().toISOString(),
      criticalDifferences: 0,
      performanceMetrics: {
        averageComparisonTimeMs: 0,
        slowestComparisonMs: 0,
        fastestComparisonMs: Number.MAX_SAFE_INTEGER,
      },
    };

    this.pendingSeqLogs = new Map();
    this.pendingOtelLogs = new Map();
    this.comparisonHistory = [];

    // Cleanup expired pending logs every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredLogs();
    }, 60000);

    logger.info('Log Comparison Engine initialized', {
      event: 'log_comparison.service.initialized',
      config: this.config,
    });
  }

  /**
   * Process incoming log entry from Seq transport
   */
  processSeqLog(rawLog: any): void {
    if (!this.config.enabled) return;

    try {
      const entry = this.parseLogEntry(rawLog, 'seq');
      if (!entry || !entry.correlationId) return;

      const correlationId = entry.correlationId;
      
      // Check if matching OTEL log already exists
      const otelMatch = this.pendingOtelLogs.get(correlationId);
      if (otelMatch) {
        // Found matching pair - compare
        this.pendingOtelLogs.delete(correlationId);
        this.compareLogEntries(entry, otelMatch.entry);
      } else {
        // Store for later matching
        this.pendingSeqLogs.set(correlationId, {
          entry,
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      logger.error('Error processing Seq log for comparison', {
        event: 'log_comparison.seq_processing_error',
        error: (error as Error).message,
        rawLog: JSON.stringify(rawLog).substring(0, 500),
      });
    }
  }

  /**
   * Process incoming log entry from OTEL transport
   */
  processOtelLog(rawLog: any): void {
    if (!this.config.enabled) return;

    try {
      const entry = this.parseLogEntry(rawLog, 'otel');
      if (!entry || !entry.correlationId) return;

      const correlationId = entry.correlationId;
      
      // Check if matching Seq log already exists
      const seqMatch = this.pendingSeqLogs.get(correlationId);
      if (seqMatch) {
        // Found matching pair - compare
        this.pendingSeqLogs.delete(correlationId);
        this.compareLogEntries(seqMatch.entry, entry);
      } else {
        // Store for later matching
        this.pendingOtelLogs.set(correlationId, {
          entry,
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      logger.error('Error processing OTEL log for comparison', {
        event: 'log_comparison.otel_processing_error',
        error: (error as Error).message,
        rawLog: JSON.stringify(rawLog).substring(0, 500),
      });
    }
  }

  /**
   * Parse raw log entry into standard format
   */
  private parseLogEntry(rawLog: any, source: 'seq' | 'otel'): LogEntry | null {
    try {
      // Common parsing logic for both Seq and OTEL logs
      const entry: LogEntry = {
        timestamp: this.extractTimestamp(rawLog),
        level: this.extractLevel(rawLog),
        message: this.extractMessage(rawLog),
        correlationId: this.extractCorrelationId(rawLog),
        traceId: this.extractTraceId(rawLog),
        spanId: this.extractSpanId(rawLog),
        userId: this.extractUserId(rawLog),
        tenantId: this.extractTenantId(rawLog),
        sessionId: this.extractSessionId(rawLog),
        requestId: this.extractRequestId(rawLog),
        operationName: this.extractOperationName(rawLog),
        metadata: this.extractMetadata(rawLog),
        source,
        rawEntry: rawLog,
      };

      return entry;
    } catch (error) {
      logger.warn('Failed to parse log entry', {
        event: 'log_comparison.parse_error',
        source,
        error: (error as Error).message,
        rawLog: JSON.stringify(rawLog).substring(0, 200),
      });
      return null;
    }
  }

  /**
   * Compare two log entries and generate detailed analysis
   */
  private async compareLogEntries(seqEntry: LogEntry, otelEntry: LogEntry): Promise<void> {
    const startTime = process.hrtime.bigint();

    try {
      const correlationId = seqEntry.correlationId || otelEntry.correlationId || 'unknown';
      const comparisonId = crypto.randomUUID();

      // Perform detailed field comparison
      const differences: LogDifference[] = [];
      const analysisDetails = {
        contentMatch: true,
        metadataMatch: true,
        timingMatch: true,
        structureMatch: true,
      };

      // Compare timestamps
      const timestampDiff = this.compareTimestamps(seqEntry.timestamp, otelEntry.timestamp);
      if (timestampDiff.difference > this.config.tolerances.timestampDeltaMs) {
        differences.push(timestampDiff);
        analysisDetails.timingMatch = false;
      }

      // Compare critical fields
      for (const field of this.config.criticalFields) {
        const diff = this.compareFields(field, seqEntry, otelEntry);
        if (diff) {
          differences.push(diff);
          if (field === 'level' || field === 'message') {
            analysisDetails.contentMatch = false;
          }
        }
      }

      // Compare metadata
      const metadataDifferences = this.compareMetadata(seqEntry.metadata, otelEntry.metadata);
      differences.push(...metadataDifferences);
      if (metadataDifferences.length > 0) {
        analysisDetails.metadataMatch = false;
      }

      // Calculate similarity score
      const score = this.calculateSimilarityScore(seqEntry, otelEntry, differences);
      const matched = score >= 95 && differences.filter(d => d.severity === 'critical').length === 0;

      // Create comparison result
      const result: ComparisonResult = {
        id: comparisonId,
        timestamp: new Date().toISOString(),
        correlationId,
        matched,
        seqEntry,
        otelEntry,
        differences,
        score,
        analysisDetails,
      };

      // Update metrics
      this.updateMetrics(result, startTime);

      // Store result
      this.comparisonHistory.push(result);
      if (this.comparisonHistory.length > 1000) {
        this.comparisonHistory.shift(); // Keep last 1000 comparisons
      }

      // Emit events
      this.emit('comparison_complete', result);

      if (!matched) {
        this.emit('comparison_mismatch', result);
        
        logger.warn('Log comparison mismatch detected', {
          event: 'log_comparison.mismatch',
          correlationId,
          score,
          differences: differences.length,
          criticalDifferences: differences.filter(d => d.severity === 'critical').length,
          analysisDetails,
        });
      }

      // Auto-alert if configured
      if (this.shouldAlert(result)) {
        this.emit('comparison_alert', result);
      }

    } catch (error) {
      logger.error('Error comparing log entries', {
        event: 'log_comparison.comparison_error',
        error: (error as Error).message,
        seqLogId: seqEntry.correlationId,
        otelLogId: otelEntry.correlationId,
      });
    }
  }

  /**
   * Compare timestamps with tolerance
   */
  private compareTimestamps(seqTimestamp: string, otelTimestamp: string): LogDifference {
    const seqTime = new Date(seqTimestamp).getTime();
    const otelTime = new Date(otelTimestamp).getTime();
    const difference = Math.abs(seqTime - otelTime);

    return {
      field: 'timestamp',
      type: 'different',
      seqValue: seqTimestamp,
      otelValue: otelTimestamp,
      severity: difference > 1000 ? 'high' : difference > 500 ? 'medium' : 'low',
      description: `Timestamp difference: ${difference}ms`,
    };
  }

  /**
   * Compare individual fields
   */
  private compareFields(field: string, seqEntry: LogEntry, otelEntry: LogEntry): LogDifference | null {
    if (this.config.ignoreFields.includes(field)) {
      return null;
    }

    const seqValue = (seqEntry as any)[field];
    const otelValue = (otelEntry as any)[field];

    if (seqValue === undefined && otelValue === undefined) {
      return null;
    }

    if (seqValue === undefined) {
      return {
        field,
        type: 'missing',
        otelValue,
        severity: this.config.criticalFields.includes(field) ? 'critical' : 'medium',
        description: `Field missing in Seq log`,
      };
    }

    if (otelValue === undefined) {
      return {
        field,
        type: 'missing',
        seqValue,
        severity: this.config.criticalFields.includes(field) ? 'critical' : 'medium',
        description: `Field missing in OTEL log`,
      };
    }

    // Type and value comparison
    if (typeof seqValue !== typeof otelValue) {
      return {
        field,
        type: 'different',
        seqValue,
        otelValue,
        severity: 'high',
        description: `Type mismatch: ${typeof seqValue} vs ${typeof otelValue}`,
      };
    }

    // String comparison with optional case insensitivity
    if (typeof seqValue === 'string' && typeof otelValue === 'string') {
      const seqStr = this.config.tolerances.stringCaseInsensitive ? seqValue.toLowerCase() : seqValue;
      const otelStr = this.config.tolerances.stringCaseInsensitive ? otelValue.toLowerCase() : otelValue;
      
      if (seqStr !== otelStr) {
        return {
          field,
          type: 'different',
          seqValue,
          otelValue,
          severity: this.config.criticalFields.includes(field) ? 'critical' : 'medium',
          description: `String values differ`,
        };
      }
    }

    // Numeric comparison with precision tolerance
    if (typeof seqValue === 'number' && typeof otelValue === 'number') {
      const difference = Math.abs(seqValue - otelValue);
      if (difference > this.config.tolerances.numericPrecision) {
        return {
          field,
          type: 'different',
          seqValue,
          otelValue,
          severity: difference > (Math.abs(seqValue) * 0.1) ? 'high' : 'medium',
          description: `Numeric values differ by ${difference}`,
        };
      }
    }

    // Deep object comparison for complex values
    if (typeof seqValue === 'object' && typeof otelValue === 'object') {
      if (JSON.stringify(seqValue) !== JSON.stringify(otelValue)) {
        return {
          field,
          type: 'different',
          seqValue,
          otelValue,
          severity: 'medium',
          description: `Object values differ`,
        };
      }
    }

    return null;
  }

  /**
   * Compare metadata objects
   */
  private compareMetadata(seqMetadata: Record<string, any>, otelMetadata: Record<string, any>): LogDifference[] {
    const differences: LogDifference[] = [];
    const allKeys = new Set([...Object.keys(seqMetadata), ...Object.keys(otelMetadata)]);

    for (const key of allKeys) {
      if (this.config.ignoreFields.includes(key)) continue;

      const seqValue = seqMetadata[key];
      const otelValue = otelMetadata[key];

      if (seqValue === undefined) {
        differences.push({
          field: `metadata.${key}`,
          type: 'missing',
          otelValue,
          severity: 'low',
          description: `Metadata field missing in Seq log`,
        });
      } else if (otelValue === undefined) {
        differences.push({
          field: `metadata.${key}`,
          type: 'missing',
          seqValue,
          severity: 'low',
          description: `Metadata field missing in OTEL log`,
        });
      } else if (JSON.stringify(seqValue) !== JSON.stringify(otelValue)) {
        differences.push({
          field: `metadata.${key}`,
          type: 'different',
          seqValue,
          otelValue,
          severity: 'low',
          description: `Metadata values differ`,
        });
      }
    }

    return differences;
  }

  /**
   * Calculate similarity score (0-100)
   */
  private calculateSimilarityScore(seqEntry: LogEntry, otelEntry: LogEntry, differences: LogDifference[]): number {
    let score = 100;

    // Deduct points based on differences
    for (const diff of differences) {
      switch (diff.severity) {
        case 'critical':
          score -= 25;
          break;
        case 'high':
          score -= 15;
          break;
        case 'medium':
          score -= 10;
          break;
        case 'low':
          score -= 5;
          break;
      }
    }

    // Bonus points for matching critical fields
    if (seqEntry.level === otelEntry.level) score += 5;
    if (seqEntry.message === otelEntry.message) score += 10;
    if (seqEntry.correlationId === otelEntry.correlationId) score += 5;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Update performance and accuracy metrics
   */
  private updateMetrics(result: ComparisonResult, startTime: bigint): void {
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1000000; // Convert to milliseconds

    this.metrics.totalComparisons++;
    
    if (result.matched) {
      this.metrics.successfulMatches++;
    } else if (result.score >= 50) {
      this.metrics.partialMatches++;
    } else {
      this.metrics.failedMatches++;
    }

    // Update average score
    const totalScore = (this.metrics.averageScore * (this.metrics.totalComparisons - 1)) + result.score;
    this.metrics.averageScore = totalScore / this.metrics.totalComparisons;

    // Update performance metrics
    const perfMetrics = this.metrics.performanceMetrics;
    const totalDuration = (perfMetrics.averageComparisonTimeMs * (this.metrics.totalComparisons - 1)) + durationMs;
    perfMetrics.averageComparisonTimeMs = totalDuration / this.metrics.totalComparisons;
    perfMetrics.slowestComparisonMs = Math.max(perfMetrics.slowestComparisonMs, durationMs);
    perfMetrics.fastestComparisonMs = Math.min(perfMetrics.fastestComparisonMs, durationMs);

    // Count critical differences
    const criticalDiffs = result.differences.filter(d => d.severity === 'critical').length;
    this.metrics.criticalDifferences += criticalDiffs;
    
    this.metrics.lastComparison = result.timestamp;
  }

  /**
   * Determine if alert should be triggered
   */
  private shouldAlert(result: ComparisonResult): boolean {
    if (!this.config.autoAlert.enabled) return false;

    const criticalDiffs = result.differences.filter(d => d.severity === 'critical').length;
    
    return (
      result.score < this.config.autoAlert.scoreThreshold ||
      criticalDiffs >= this.config.autoAlert.criticalDifferenceThreshold
    );
  }

  /**
   * Clean up expired pending logs
   */
  private cleanupExpiredLogs(): void {
    const now = Date.now();
    const expiredThreshold = now - this.config.correlationWindow;

    // Clean up expired Seq logs
    for (const [correlationId, entry] of this.pendingSeqLogs.entries()) {
      if (entry.timestamp < expiredThreshold) {
        this.pendingSeqLogs.delete(correlationId);
        
        this.emit('log_timeout', {
          correlationId,
          source: 'seq',
          entry: entry.entry,
        });
      }
    }

    // Clean up expired OTEL logs
    for (const [correlationId, entry] of this.pendingOtelLogs.entries()) {
      if (entry.timestamp < expiredThreshold) {
        this.pendingOtelLogs.delete(correlationId);
        
        this.emit('log_timeout', {
          correlationId,
          source: 'otel',
          entry: entry.entry,
        });
      }
    }

    // Log cleanup stats if significant
    const cleanedCount = (this.pendingSeqLogs.size + this.pendingOtelLogs.size) > 10;
    if (cleanedCount) {
      logger.debug('Log comparison cleanup completed', {
        event: 'log_comparison.cleanup',
        pendingSeq: this.pendingSeqLogs.size,
        pendingOtel: this.pendingOtelLogs.size,
      });
    }
  }

  // Field extraction methods (implement based on your log formats)
  private extractTimestamp(rawLog: any): string {
    return rawLog.timestamp || rawLog['@timestamp'] || rawLog.time || new Date().toISOString();
  }

  private extractLevel(rawLog: any): string {
    return rawLog.level || rawLog.severity || rawLog.logLevel || 'info';
  }

  private extractMessage(rawLog: any): string {
    return rawLog.message || rawLog.msg || rawLog.body || '';
  }

  private extractCorrelationId(rawLog: any): string | undefined {
    return rawLog.correlationId || rawLog.correlation_id || rawLog.requestId || rawLog.request_id;
  }

  private extractTraceId(rawLog: any): string | undefined {
    return rawLog.traceId || rawLog.trace_id || rawLog['otel.trace_id'];
  }

  private extractSpanId(rawLog: any): string | undefined {
    return rawLog.spanId || rawLog.span_id || rawLog['otel.span_id'];
  }

  private extractUserId(rawLog: any): string | undefined {
    return rawLog.userId || rawLog.user_id || rawLog.user?.id;
  }

  private extractTenantId(rawLog: any): string | undefined {
    return rawLog.tenantId || rawLog.tenant_id || rawLog.tenant?.id;
  }

  private extractSessionId(rawLog: any): string | undefined {
    return rawLog.sessionId || rawLog.session_id;
  }

  private extractRequestId(rawLog: any): string | undefined {
    return rawLog.requestId || rawLog.request_id;
  }

  private extractOperationName(rawLog: any): string | undefined {
    return rawLog.operationName || rawLog.operation_name || rawLog.operation;
  }

  private extractMetadata(rawLog: any): Record<string, any> {
    const metadata = { ...rawLog };
    
    // Remove well-known fields to isolate metadata
    const wellKnownFields = [
      'timestamp', '@timestamp', 'time',
      'level', 'severity', 'logLevel',
      'message', 'msg', 'body',
      'correlationId', 'correlation_id',
      'traceId', 'trace_id', 'otel.trace_id',
      'spanId', 'span_id', 'otel.span_id',
      'userId', 'user_id', 'tenantId', 'tenant_id',
      'sessionId', 'session_id', 'requestId', 'request_id',
      'operationName', 'operation_name', 'operation',
    ];

    for (const field of wellKnownFields) {
      delete metadata[field];
    }

    return metadata;
  }

  /**
   * Get current metrics
   */
  getMetrics(): ComparisonMetrics {
    return { ...this.metrics };
  }

  /**
   * Get comparison history
   */
  getComparisonHistory(limit?: number): ComparisonResult[] {
    const history = [...this.comparisonHistory];
    return limit ? history.slice(-limit) : history;
  }

  /**
   * Get pending log counts
   */
  getPendingCounts(): { seq: number; otel: number } {
    return {
      seq: this.pendingSeqLogs.size,
      otel: this.pendingOtelLogs.size,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ComparisonConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    logger.info('Log comparison configuration updated', {
      event: 'log_comparison.config_updated',
      config: this.config,
    });
  }

  /**
   * Generate detailed comparison report
   */
  generateReport(): {
    summary: ComparisonMetrics;
    recentComparisons: ComparisonResult[];
    topIssues: Array<{ field: string; count: number; severity: string }>;
    recommendations: string[];
  } {
    const recentComparisons = this.getComparisonHistory(100);
    
    // Analyze top issues
    const issueMap = new Map<string, { count: number; severity: string }>();
    
    for (const comparison of recentComparisons) {
      for (const diff of comparison.differences) {
        const key = `${diff.field}:${diff.type}`;
        const existing = issueMap.get(key);
        
        if (existing) {
          existing.count++;
        } else {
          issueMap.set(key, { count: 1, severity: diff.severity });
        }
      }
    }
    
    const topIssues = Array.from(issueMap.entries())
      .map(([field, data]) => ({ field, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Generate recommendations
    const recommendations = this.generateRecommendations(recentComparisons);

    return {
      summary: this.getMetrics(),
      recentComparisons: recentComparisons.slice(-20),
      topIssues,
      recommendations,
    };
  }

  /**
   * Generate recommendations based on comparison history
   */
  private generateRecommendations(comparisons: ComparisonResult[]): string[] {
    const recommendations: string[] = [];
    const metrics = this.getMetrics();

    if (metrics.averageScore < 80) {
      recommendations.push('Overall log similarity is low - review log formatting consistency');
    }

    if (metrics.criticalDifferences > metrics.totalComparisons * 0.1) {
      recommendations.push('High rate of critical differences detected - investigate log field mapping');
    }

    if (metrics.performanceMetrics.averageComparisonTimeMs > 50) {
      recommendations.push('Log comparison performance is slow - consider optimizing comparison logic');
    }

    const pendingCounts = this.getPendingCounts();
    if (pendingCounts.seq > 100 || pendingCounts.otel > 100) {
      recommendations.push('High number of unmatched logs - check correlation ID consistency');
    }

    if (metrics.failedMatches > metrics.successfulMatches) {
      recommendations.push('More failed than successful matches - review log structure compatibility');
    }

    return recommendations;
  }

  /**
   * Cleanup and destroy service
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    this.removeAllListeners();
    this.pendingSeqLogs.clear();
    this.pendingOtelLogs.clear();
    
    logger.info('Log Comparison Service destroyed', {
      event: 'log_comparison.service.destroyed',
    });
  }
}

// Export singleton instance
export const logComparisonService = new LogComparisonService();

export default LogComparisonService;