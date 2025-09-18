/**
 * Logging Validation Utilities
 * Task 3.1: OTEL Logging Transport Implementation - Validation Infrastructure
 * 
 * Provides utilities for comparing Seq vs OTEL logging output,
 * validating data consistency, and monitoring migration progress.
 */

import { logger } from '../config/logger';
import { getSeqMetrics, getOTELMetrics, getLoggingMetrics } from '../config/logger';
import { otelLoggingFlags } from '../config/otel-logging-flags';

export interface LogValidationResult {
  timestamp: string;
  comparison: {
    totalLogs: {
      seq: number;
      otel: number;
      difference: number;
      percentageDiff: number;
    };
    performance: {
      seqLatency: number;
      otelLatency: number;
      difference: number;
      percentageDiff: number;
    };
    reliability: {
      seqFailures: number;
      otelFailures: number;
      seqSuccessRate: number;
      otelSuccessRate: number;
    };
    correlation: {
      otelCorrelationRate: number;
      expectedCorrelationRate: number;
      correlationGap: number;
    };
  };
  validation: {
    dataConsistency: 'pass' | 'fail' | 'warning';
    performanceAcceptable: boolean;
    reliabilityAcceptable: boolean;
    correlationAcceptable: boolean;
    overallStatus: 'pass' | 'fail' | 'warning';
  };
  recommendations: string[];
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  metadata?: Record<string, any>;
  correlationId?: string;
  traceId?: string;
  spanId?: string;
  source: 'seq' | 'otel';
}

export interface ValidationThresholds {
  maxLogCountDifference: number; // Maximum % difference in log counts
  maxLatencyDifference: number; // Maximum % difference in latency
  minSuccessRate: number; // Minimum success rate (%)
  minCorrelationRate: number; // Minimum correlation rate (%)
  maxPerformanceImpact: number; // Maximum performance impact (ms)
}

const DEFAULT_THRESHOLDS: ValidationThresholds = {
  maxLogCountDifference: 5.0, // 5% difference allowed
  maxLatencyDifference: 20.0, // 20% latency difference allowed
  minSuccessRate: 95.0, // 95% minimum success rate
  minCorrelationRate: 80.0, // 80% minimum correlation rate
  maxPerformanceImpact: 50.0, // 50ms maximum additional latency
};

/**
 * Validate logging consistency between Seq and OTEL transports
 */
export function validateLoggingConsistency(thresholds: ValidationThresholds = DEFAULT_THRESHOLDS): LogValidationResult {
  const metrics = getLoggingMetrics();
  const timestamp = new Date().toISOString();
  
  // Calculate comparison metrics
  const seqLogs = metrics.seq?.totalLogs || 0;
  const otelLogs = metrics.otel?.totalLogs || 0;
  const logDifference = Math.abs(seqLogs - otelLogs);
  const logPercentageDiff = seqLogs > 0 ? (logDifference / seqLogs) * 100 : 0;
  
  const seqLatency = metrics.seq?.averageLatency || 0;
  const otelLatency = metrics.otel?.averageLatency || 0;
  const latencyDifference = otelLatency - seqLatency;
  const latencyPercentageDiff = seqLatency > 0 ? (Math.abs(latencyDifference) / seqLatency) * 100 : 0;
  
  const seqFailures = metrics.seq?.failedLogs || 0;
  const otelFailures = metrics.otel?.failedLogs || 0;
  const seqSuccessRate = seqLogs > 0 ? ((seqLogs - seqFailures) / seqLogs) * 100 : 100;
  const otelSuccessRate = otelLogs > 0 ? ((otelLogs - otelFailures) / otelLogs) * 100 : 100;
  
  const correlationRate = (metrics.otel?.correlationRate || 0) * 100;
  const expectedCorrelationRate = otelLoggingFlags.enableCorrelation ? 90.0 : 0.0;
  const correlationGap = Math.abs(correlationRate - expectedCorrelationRate);
  
  // Validation checks
  const dataConsistency = logPercentageDiff <= thresholds.maxLogCountDifference ? 'pass' :
                         logPercentageDiff <= thresholds.maxLogCountDifference * 2 ? 'warning' : 'fail';
  
  const performanceAcceptable = latencyPercentageDiff <= thresholds.maxLatencyDifference && 
                               latencyDifference <= thresholds.maxPerformanceImpact;
  
  const reliabilityAcceptable = seqSuccessRate >= thresholds.minSuccessRate && 
                               otelSuccessRate >= thresholds.minSuccessRate;
  
  const correlationAcceptable = correlationRate >= thresholds.minCorrelationRate || 
                               !otelLoggingFlags.enableCorrelation;
  
  const overallStatus = (dataConsistency === 'pass' && performanceAcceptable && 
                        reliabilityAcceptable && correlationAcceptable) ? 'pass' :
                       (dataConsistency === 'fail' || !reliabilityAcceptable) ? 'fail' : 'warning';
  
  // Generate recommendations
  const recommendations: string[] = [];
  
  if (dataConsistency === 'fail') {
    recommendations.push(`Log count difference (${logPercentageDiff.toFixed(1)}%) exceeds threshold (${thresholds.maxLogCountDifference}%). Check for dropped logs.`);
  } else if (dataConsistency === 'warning') {
    recommendations.push(`Log count difference (${logPercentageDiff.toFixed(1)}%) is elevated. Monitor for trends.`);
  }
  
  if (!performanceAcceptable) {
    if (latencyDifference > thresholds.maxPerformanceImpact) {
      recommendations.push(`OTEL transport adds ${latencyDifference.toFixed(1)}ms latency, exceeding ${thresholds.maxPerformanceImpact}ms threshold. Consider optimization.`);
    }
    if (latencyPercentageDiff > thresholds.maxLatencyDifference) {
      recommendations.push(`Latency difference (${latencyPercentageDiff.toFixed(1)}%) exceeds threshold (${thresholds.maxLatencyDifference}%). Review batch sizes.`);
    }
  }
  
  if (!reliabilityAcceptable) {
    if (seqSuccessRate < thresholds.minSuccessRate) {
      recommendations.push(`Seq success rate (${seqSuccessRate.toFixed(1)}%) below threshold (${thresholds.minSuccessRate}%). Check Seq connectivity.`);
    }
    if (otelSuccessRate < thresholds.minSuccessRate) {
      recommendations.push(`OTEL success rate (${otelSuccessRate.toFixed(1)}%) below threshold (${thresholds.minSuccessRate}%). Check OTEL configuration.`);
    }
  }
  
  if (!correlationAcceptable && otelLoggingFlags.enableCorrelation) {
    recommendations.push(`Correlation rate (${correlationRate.toFixed(1)}%) below threshold (${thresholds.minCorrelationRate}%). Check trace context propagation.`);
  }
  
  if (recommendations.length === 0) {
    recommendations.push('All validation checks passed. Logging systems are performing well.');
  }
  
  return {
    timestamp,
    comparison: {
      totalLogs: {
        seq: seqLogs,
        otel: otelLogs,
        difference: logDifference,
        percentageDiff: logPercentageDiff,
      },
      performance: {
        seqLatency,
        otelLatency,
        difference: latencyDifference,
        percentageDiff: latencyPercentageDiff,
      },
      reliability: {
        seqFailures,
        otelFailures,
        seqSuccessRate,
        otelSuccessRate,
      },
      correlation: {
        otelCorrelationRate: correlationRate,
        expectedCorrelationRate,
        correlationGap,
      },
    },
    validation: {
      dataConsistency,
      performanceAcceptable,
      reliabilityAcceptable,
      correlationAcceptable,
      overallStatus,
    },
    recommendations,
  };
}

/**
 * Continuous validation monitoring
 */
export class LoggingValidator {
  private validationInterval: NodeJS.Timeout | null = null;
  private validationHistory: LogValidationResult[] = [];
  private readonly maxHistorySize = 100;
  
  constructor(
    private intervalMs: number = 60000, // 1 minute default
    private thresholds: ValidationThresholds = DEFAULT_THRESHOLDS
  ) {}
  
  /**
   * Start continuous validation monitoring
   */
  public startValidation(): void {
    if (this.validationInterval) {
      this.stopValidation();
    }
    
    logger.info('Starting continuous logging validation', {
      event: 'logging.validation.start',
      intervalMs: this.intervalMs,
      thresholds: this.thresholds,
    });
    
    // Initial validation
    this.performValidation();
    
    // Schedule periodic validation
    this.validationInterval = setInterval(() => {
      this.performValidation();
    }, this.intervalMs);
  }
  
  /**
   * Stop continuous validation monitoring
   */
  public stopValidation(): void {
    if (this.validationInterval) {
      clearInterval(this.validationInterval);
      this.validationInterval = null;
      
      logger.info('Stopped continuous logging validation', {
        event: 'logging.validation.stop',
        validationCount: this.validationHistory.length,
      });
    }
  }
  
  /**
   * Perform validation and store results
   */
  private performValidation(): void {
    try {
      const result = validateLoggingConsistency(this.thresholds);
      
      // Add to history
      this.validationHistory.push(result);
      
      // Trim history if needed
      if (this.validationHistory.length > this.maxHistorySize) {
        this.validationHistory.shift();
      }
      
      // Log validation results
      const logLevel = result.validation.overallStatus === 'pass' ? 'info' :
                      result.validation.overallStatus === 'warning' ? 'warn' : 'error';
      
      logger.log(logLevel, 'Logging validation completed', {
        event: 'logging.validation.result',
        status: result.validation.overallStatus,
        logCountDiff: result.comparison.totalLogs.percentageDiff,
        latencyDiff: result.comparison.performance.percentageDiff,
        seqSuccessRate: result.comparison.reliability.seqSuccessRate,
        otelSuccessRate: result.comparison.reliability.otelSuccessRate,
        correlationRate: result.comparison.correlation.otelCorrelationRate,
        recommendations: result.recommendations,
      });
      
      // Alert on failures
      if (result.validation.overallStatus === 'fail') {
        logger.error('Logging validation failed', {
          event: 'logging.validation.failure',
          result: result.validation,
          recommendations: result.recommendations,
        });
      }
      
    } catch (error) {
      logger.error('Logging validation error', {
        event: 'logging.validation.error',
        error: (error as Error).message,
      });
    }
  }
  
  /**
   * Get validation history
   */
  public getValidationHistory(): LogValidationResult[] {
    return [...this.validationHistory];
  }
  
  /**
   * Get latest validation result
   */
  public getLatestValidation(): LogValidationResult | null {
    return this.validationHistory.length > 0 ? 
           this.validationHistory[this.validationHistory.length - 1] : null;
  }
  
  /**
   * Get validation trends
   */
  public getValidationTrends(): {
    avgLogCountDiff: number;
    avgLatencyDiff: number;
    avgSeqSuccessRate: number;
    avgOtelSuccessRate: number;
    trendDirection: 'improving' | 'degrading' | 'stable';
    recentFailures: number;
  } {
    if (this.validationHistory.length === 0) {
      return {
        avgLogCountDiff: 0,
        avgLatencyDiff: 0,
        avgSeqSuccessRate: 100,
        avgOtelSuccessRate: 100,
        trendDirection: 'stable',
        recentFailures: 0,
      };
    }
    
    const recent = this.validationHistory.slice(-10); // Last 10 results
    
    const avgLogCountDiff = recent.reduce((sum, r) => 
      sum + r.comparison.totalLogs.percentageDiff, 0) / recent.length;
    
    const avgLatencyDiff = recent.reduce((sum, r) => 
      sum + r.comparison.performance.percentageDiff, 0) / recent.length;
    
    const avgSeqSuccessRate = recent.reduce((sum, r) => 
      sum + r.comparison.reliability.seqSuccessRate, 0) / recent.length;
    
    const avgOtelSuccessRate = recent.reduce((sum, r) => 
      sum + r.comparison.reliability.otelSuccessRate, 0) / recent.length;
    
    const recentFailures = recent.filter(r => r.validation.overallStatus === 'fail').length;
    
    // Simple trend analysis
    let trendDirection: 'improving' | 'degrading' | 'stable' = 'stable';
    if (recent.length >= 5) {
      const firstHalf = recent.slice(0, Math.floor(recent.length / 2));
      const secondHalf = recent.slice(Math.floor(recent.length / 2));
      
      const firstHalfFailures = firstHalf.filter(r => r.validation.overallStatus !== 'pass').length;
      const secondHalfFailures = secondHalf.filter(r => r.validation.overallStatus !== 'pass').length;
      
      if (secondHalfFailures < firstHalfFailures) {
        trendDirection = 'improving';
      } else if (secondHalfFailures > firstHalfFailures) {
        trendDirection = 'degrading';
      }
    }
    
    return {
      avgLogCountDiff,
      avgLatencyDiff,
      avgSeqSuccessRate,
      avgOtelSuccessRate,
      trendDirection,
      recentFailures,
    };
  }
}

/**
 * Migration utilities for gradual Seq-to-OTEL transition
 */
export class LoggingMigrationManager {
  private validator: LoggingValidator;
  
  constructor() {
    this.validator = new LoggingValidator();
  }
  
  /**
   * Assess readiness for OTEL-only migration
   */
  public assessMigrationReadiness(): {
    ready: boolean;
    confidence: 'high' | 'medium' | 'low';
    requirements: Array<{
      requirement: string;
      status: 'met' | 'not_met' | 'warning';
      details: string;
    }>;
    recommendation: string;
  } {
    const trends = this.validator.getValidationTrends();
    const latest = this.validator.getLatestValidation();
    
    const requirements = [
      {
        requirement: 'OTEL transport stability',
        status: (trends.avgOtelSuccessRate >= 98.0 ? 'met' : 
                trends.avgOtelSuccessRate >= 95.0 ? 'warning' : 'not_met') as 'met' | 'not_met' | 'warning',
        details: `OTEL success rate: ${trends.avgOtelSuccessRate.toFixed(1)}%`,
      },
      {
        requirement: 'Performance acceptability',
        status: (trends.avgLatencyDiff <= 15.0 ? 'met' : 
                trends.avgLatencyDiff <= 25.0 ? 'warning' : 'not_met') as 'met' | 'not_met' | 'warning',
        details: `Average latency difference: ${trends.avgLatencyDiff.toFixed(1)}%`,
      },
      {
        requirement: 'Data consistency',
        status: (trends.avgLogCountDiff <= 2.0 ? 'met' : 
                trends.avgLogCountDiff <= 5.0 ? 'warning' : 'not_met') as 'met' | 'not_met' | 'warning',
        details: `Average log count difference: ${trends.avgLogCountDiff.toFixed(1)}%`,
      },
      {
        requirement: 'Recent stability',
        status: (trends.recentFailures === 0 ? 'met' : 
                trends.recentFailures <= 2 ? 'warning' : 'not_met') as 'met' | 'not_met' | 'warning',
        details: `Recent failures: ${trends.recentFailures}/10 validations`,
      },
      {
        requirement: 'Trending improvement',
        status: (trends.trendDirection === 'improving' ? 'met' : 
                trends.trendDirection === 'stable' ? 'warning' : 'not_met') as 'met' | 'not_met' | 'warning',
        details: `Trend direction: ${trends.trendDirection}`,
      },
    ];
    
    const metRequirements = requirements.filter(r => r.status === 'met').length;
    const warningRequirements = requirements.filter(r => r.status === 'warning').length;
    const notMetRequirements = requirements.filter(r => r.status === 'not_met').length;
    
    const ready = notMetRequirements === 0 && warningRequirements <= 1;
    const confidence = metRequirements === 5 ? 'high' : 
                      metRequirements >= 4 && warningRequirements <= 1 ? 'medium' : 'low';
    
    let recommendation: string;
    if (ready && confidence === 'high') {
      recommendation = 'System is ready for OTEL-only migration. All requirements met with high confidence.';
    } else if (ready && confidence === 'medium') {
      recommendation = 'System is ready for OTEL-only migration with careful monitoring. Some metrics show warnings.';
    } else if (notMetRequirements <= 1 && confidence === 'medium') {
      recommendation = 'System is nearly ready. Address remaining issues and monitor for stability.';
    } else {
      recommendation = 'System is not ready for OTEL-only migration. Address critical issues first.';
    }
    
    return {
      ready,
      confidence,
      requirements,
      recommendation,
    };
  }
}

// Create global validator instance
export const loggingValidator = new LoggingValidator();

// Auto-start validation if in parallel mode
if (otelLoggingFlags.enableParallelLogging && otelLoggingFlags.enableValidationLogging) {
  setTimeout(() => {
    loggingValidator.startValidation();
  }, 5000); // Start after 5 seconds to allow system initialization
}