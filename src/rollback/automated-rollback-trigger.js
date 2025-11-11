/**
 * Automated Rollback Trigger
 *
 * Multi-signal rollback trigger system for production deployments.
 * Monitors smoke test failures, error rates, and health checks to
 * trigger automated rollback when thresholds are exceeded.
 *
 * @module automated-rollback-trigger
 * @version 1.0.0
 */

const { performance } = require('perf_hooks');

/**
 * Rollback trigger signal types
 */
const SIGNAL_TYPES = {
  SMOKE_TEST_FAILURE: 'smoke_test_failure',
  ERROR_RATE_THRESHOLD: 'error_rate_threshold',
  HEALTH_CHECK_FAILURE: 'health_check_failure',
  RESPONSE_TIME_DEGRADATION: 'response_time_degradation',
  MANUAL_TRIGGER: 'manual_trigger'
};

/**
 * Rollback trigger thresholds
 */
const DEFAULT_THRESHOLDS = {
  errorRate: 0.05,           // 5% max error rate
  errorRateDuration: 120000, // 2 minutes sustained
  responseTimeP95: 500,      // 500ms max p95
  healthCheckFailures: 3,    // 3 consecutive failures
  smokeTestCategories: 1     // Any single category failure triggers rollback
};

/**
 * Automated Rollback Trigger System
 */
class AutomatedRollbackTrigger {
  constructor(config = {}) {
    this.config = {
      thresholds: { ...DEFAULT_THRESHOLDS, ...config.thresholds },
      environment: config.environment || 'production',
      version: config.version,
      ...config
    };

    this.signals = [];
    this.rollbackTriggered = false;
    this.rollbackReason = null;
  }

  /**
   * Evaluate smoke test results for rollback trigger
   *
   * @param {Object} smokeTestResult - Smoke test execution result
   * @returns {Object} Trigger evaluation result
   */
  evaluateSmokeTestFailure(smokeTestResult) {
    if (smokeTestResult.passed) {
      return {
        shouldTriggerRollback: false,
        signal: SIGNAL_TYPES.SMOKE_TEST_FAILURE,
        reason: 'All smoke tests passed'
      };
    }

    // ANY smoke test category failure triggers rollback
    const failedCategories = Object.entries(smokeTestResult.results)
      .filter(([, result]) => !result.passed)
      .map(([category]) => category);

    if (failedCategories.length > 0) {
      const signal = {
        type: SIGNAL_TYPES.SMOKE_TEST_FAILURE,
        timestamp: Date.now(),
        severity: 'critical',
        details: {
          failedCategories,
          failedCategory: smokeTestResult.failedCategory,
          totalCategories: smokeTestResult.categoriesExecuted,
          smokeTestDuration: smokeTestResult.totalDuration
        }
      };

      this.signals.push(signal);

      return {
        shouldTriggerRollback: true,
        signal,
        reason: `Smoke test failure in ${failedCategories.length} categor${failedCategories.length > 1 ? 'ies' : 'y'}: ${failedCategories.join(', ')}`,
        rollbackPriority: 'immediate'
      };
    }

    return {
      shouldTriggerRollback: false,
      signal: SIGNAL_TYPES.SMOKE_TEST_FAILURE,
      reason: 'Smoke tests passed'
    };
  }

  /**
   * Evaluate error rate for rollback trigger
   *
   * @param {Object} errorRateMetrics - Error rate metrics
   * @returns {Object} Trigger evaluation result
   */
  evaluateErrorRateThreshold(errorRateMetrics) {
    const { currentErrorRate, duration } = errorRateMetrics;

    if (currentErrorRate <= this.config.thresholds.errorRate) {
      return {
        shouldTriggerRollback: false,
        signal: SIGNAL_TYPES.ERROR_RATE_THRESHOLD,
        reason: `Error rate within threshold (${(currentErrorRate * 100).toFixed(2)}% ≤ ${(this.config.thresholds.errorRate * 100)}%)`
      };
    }

    // Error rate exceeded threshold
    if (duration >= this.config.thresholds.errorRateDuration) {
      const signal = {
        type: SIGNAL_TYPES.ERROR_RATE_THRESHOLD,
        timestamp: Date.now(),
        severity: 'critical',
        details: {
          currentErrorRate,
          threshold: this.config.thresholds.errorRate,
          duration,
          requiredDuration: this.config.thresholds.errorRateDuration,
          exceededBy: currentErrorRate - this.config.thresholds.errorRate
        }
      };

      this.signals.push(signal);

      return {
        shouldTriggerRollback: true,
        signal,
        reason: `Error rate ${(currentErrorRate * 100).toFixed(2)}% exceeded threshold ${(this.config.thresholds.errorRate * 100)}% for ${(duration / 1000).toFixed(0)}s`,
        rollbackPriority: 'immediate'
      };
    }

    // Error rate exceeded but not sustained long enough
    return {
      shouldTriggerRollback: false,
      signal: SIGNAL_TYPES.ERROR_RATE_THRESHOLD,
      reason: `Error rate spike detected but not sustained (${(duration / 1000).toFixed(0)}s < ${(this.config.thresholds.errorRateDuration / 1000)}s)`,
      warning: true
    };
  }

  /**
   * Evaluate health check failures for rollback trigger
   *
   * @param {Object} healthCheckResult - Health check result
   * @returns {Object} Trigger evaluation result
   */
  evaluateHealthCheckFailure(healthCheckResult) {
    if (healthCheckResult.healthy) {
      return {
        shouldTriggerRollback: false,
        signal: SIGNAL_TYPES.HEALTH_CHECK_FAILURE,
        reason: 'All health checks passing'
      };
    }

    const { consecutiveFailures, failedChecks } = healthCheckResult;

    if (consecutiveFailures >= this.config.thresholds.healthCheckFailures) {
      const signal = {
        type: SIGNAL_TYPES.HEALTH_CHECK_FAILURE,
        timestamp: Date.now(),
        severity: 'critical',
        details: {
          consecutiveFailures,
          threshold: this.config.thresholds.healthCheckFailures,
          failedChecks,
          totalChecks: healthCheckResult.totalChecks
        }
      };

      this.signals.push(signal);

      return {
        shouldTriggerRollback: true,
        signal,
        reason: `${consecutiveFailures} consecutive health check failures (threshold: ${this.config.thresholds.healthCheckFailures}). Failed: ${failedChecks.join(', ')}`,
        rollbackPriority: 'immediate'
      };
    }

    return {
      shouldTriggerRollback: false,
      signal: SIGNAL_TYPES.HEALTH_CHECK_FAILURE,
      reason: `Health checks failing but below threshold (${consecutiveFailures} < ${this.config.thresholds.healthCheckFailures})`,
      warning: true
    };
  }

  /**
   * Evaluate response time degradation for rollback trigger
   *
   * @param {Object} performanceMetrics - Performance metrics
   * @returns {Object} Trigger evaluation result
   */
  evaluateResponseTimeDegradation(performanceMetrics) {
    const { responseTimeP95 } = performanceMetrics;

    if (responseTimeP95 <= this.config.thresholds.responseTimeP95) {
      return {
        shouldTriggerRollback: false,
        signal: SIGNAL_TYPES.RESPONSE_TIME_DEGRADATION,
        reason: `Response time within threshold (p95: ${responseTimeP95}ms ≤ ${this.config.thresholds.responseTimeP95}ms)`
      };
    }

    const signal = {
      type: SIGNAL_TYPES.RESPONSE_TIME_DEGRADATION,
      timestamp: Date.now(),
      severity: 'high',
      details: {
        responseTimeP95,
        threshold: this.config.thresholds.responseTimeP95,
        exceededBy: responseTimeP95 - this.config.thresholds.responseTimeP95
      }
    };

    this.signals.push(signal);

    return {
      shouldTriggerRollback: true,
      signal,
      reason: `Response time p95 ${responseTimeP95}ms exceeded threshold ${this.config.thresholds.responseTimeP95}ms`,
      rollbackPriority: 'high'
    };
  }

  /**
   * Evaluate manual rollback trigger
   *
   * @param {Object} manualTrigger - Manual trigger request
   * @returns {Object} Trigger evaluation result
   */
  evaluateManualTrigger(manualTrigger) {
    const { reason, requestedBy, priority = 'immediate' } = manualTrigger;

    const signal = {
      type: SIGNAL_TYPES.MANUAL_TRIGGER,
      timestamp: Date.now(),
      severity: 'critical',
      details: {
        reason,
        requestedBy,
        priority
      }
    };

    this.signals.push(signal);

    return {
      shouldTriggerRollback: true,
      signal,
      reason: `Manual rollback requested by ${requestedBy}: ${reason}`,
      rollbackPriority: priority
    };
  }

  /**
   * Evaluate all signals and determine if rollback should be triggered
   *
   * @param {Object} metrics - All metrics for evaluation
   * @returns {Object} Rollback decision
   */
  evaluateAllSignals(metrics) {
    const evaluations = [];

    // Evaluate smoke test results (highest priority)
    if (metrics.smokeTestResult) {
      evaluations.push(this.evaluateSmokeTestFailure(metrics.smokeTestResult));
    }

    // Evaluate error rate
    if (metrics.errorRateMetrics) {
      evaluations.push(this.evaluateErrorRateThreshold(metrics.errorRateMetrics));
    }

    // Evaluate health checks
    if (metrics.healthCheckResult) {
      evaluations.push(this.evaluateHealthCheckFailure(metrics.healthCheckResult));
    }

    // Evaluate response time
    if (metrics.performanceMetrics) {
      evaluations.push(this.evaluateResponseTimeDegradation(metrics.performanceMetrics));
    }

    // Evaluate manual trigger
    if (metrics.manualTrigger) {
      evaluations.push(this.evaluateManualTrigger(metrics.manualTrigger));
    }

    // Determine if any signal triggered rollback
    const triggeredSignals = evaluations.filter(e => e.shouldTriggerRollback);

    if (triggeredSignals.length > 0) {
      this.rollbackTriggered = true;
      this.rollbackReason = triggeredSignals.map(s => s.reason).join('; ');

      return {
        shouldTriggerRollback: true,
        triggeredSignals,
        totalSignals: this.signals.length,
        reason: this.rollbackReason,
        priority: this.determinePriority(triggeredSignals),
        timestamp: Date.now()
      };
    }

    return {
      shouldTriggerRollback: false,
      evaluations,
      totalSignals: this.signals.length,
      reason: 'All metrics within acceptable thresholds'
    };
  }

  /**
   * Determine rollback priority based on triggered signals
   *
   * @param {Array<Object>} triggeredSignals - Signals that triggered rollback
   * @returns {string} Priority level
   */
  determinePriority(triggeredSignals) {
    const priorities = triggeredSignals.map(s => s.rollbackPriority || 'medium');

    if (priorities.includes('immediate')) return 'immediate';
    if (priorities.includes('high')) return 'high';
    return 'medium';
  }

  /**
   * Get rollback decision summary
   *
   * @returns {Object} Rollback decision summary
   */
  getRollbackDecision() {
    return {
      rollbackTriggered: this.rollbackTriggered,
      rollbackReason: this.rollbackReason,
      signals: this.signals,
      totalSignals: this.signals.length,
      environment: this.config.environment,
      version: this.config.version,
      thresholds: this.config.thresholds
    };
  }

  /**
   * Reset trigger state
   */
  reset() {
    this.signals = [];
    this.rollbackTriggered = false;
    this.rollbackReason = null;
  }
}

module.exports = {
  AutomatedRollbackTrigger,
  SIGNAL_TYPES,
  DEFAULT_THRESHOLDS
};

/**
 * CLI usage example:
 *
 * const { AutomatedRollbackTrigger } = require('./automated-rollback-trigger.js');
 *
 * const trigger = new AutomatedRollbackTrigger({
 *   environment: 'production',
 *   version: '2.1.0',
 *   thresholds: {
 *     errorRate: 0.05,
 *     responseTimeP95: 500
 *   }
 * });
 *
 * const decision = trigger.evaluateAllSignals({
 *   smokeTestResult: { passed: false, failedCategory: 'api' },
 *   errorRateMetrics: { currentErrorRate: 0.08, duration: 150000 },
 *   healthCheckResult: { healthy: true }
 * });
 *
 * if (decision.shouldTriggerRollback) {
 *   console.log('🚨 ROLLBACK TRIGGERED:', decision.reason);
 *   // Execute rollback workflow...
 * }
 */
