/**
 * OTEL Logging Validation Integration Tests
 * Task 3.1: OTEL Logging Transport Implementation - Integration Testing
 * 
 * Tests the complete logging validation pipeline including:
 * - Seq vs OTEL comparison and validation
 * - Continuous monitoring and trend analysis
 * - Migration readiness assessment
 * - Real-world logging scenarios
 */

import { validateLoggingConsistency, LoggingValidator, LoggingMigrationManager } from '../../utils/logging-validation';
import { logger, getLoggingHealth, getLoggingMetrics } from '../../config/logger';
import { otelLoggingFlags } from '../../config/otel-logging-flags';

// Mock the logger and metrics functions for controlled testing
jest.mock('../../config/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    log: jest.fn(),
  },
  getLoggingHealth: jest.fn(),
  getLoggingMetrics: jest.fn(),
}));

jest.mock('../../config/otel-logging-flags', () => ({
  otelLoggingFlags: {
    enableOTELLogging: true,
    enableParallelLogging: true,
    enableCorrelation: true,
    enableValidationLogging: true,
    enableFallbackToSeq: true,
  },
  getLoggingMode: jest.fn().mockReturnValue('parallel'),
}));

describe('Logging Validation Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateLoggingConsistency', () => {
    it('should validate logging consistency with healthy metrics', () => {
      const mockMetrics = {
        mode: 'parallel',
        seq: {
          totalLogs: 1000,
          successfulLogs: 995,
          failedLogs: 5,
          averageLatency: 25.5,
          batchesSent: 10,
        },
        otel: {
          totalLogs: 998,
          successfulLogs: 995,
          failedLogs: 3,
          averageLatency: 28.2,
          correlationRate: 0.92,
          batchesSent: 10,
        },
        comparison: {
          seqLogs: 1000,
          otelLogs: 998,
          correlationRate: 0.92,
          performanceDiff: 2.7,
        },
      };

      (getLoggingMetrics as jest.Mock).mockReturnValue(mockMetrics);

      const result = validateLoggingConsistency();

      expect(result.validation.overallStatus).toBe('pass');
      expect(result.validation.dataConsistency).toBe('pass');
      expect(result.validation.performanceAcceptable).toBe(true);
      expect(result.validation.reliabilityAcceptable).toBe(true);
      expect(result.validation.correlationAcceptable).toBe(true);
      expect(result.recommendations).toContain('All validation checks passed. Logging systems are performing well.');
    });

    it('should detect data consistency issues', () => {
      const mockMetrics = {
        mode: 'parallel',
        seq: {
          totalLogs: 1000,
          successfulLogs: 995,
          failedLogs: 5,
          averageLatency: 25.5,
        },
        otel: {
          totalLogs: 900, // 10% difference - should trigger warning/fail
          successfulLogs: 895,
          failedLogs: 5,
          averageLatency: 28.2,
          correlationRate: 0.92,
        },
      };

      (getLoggingMetrics as jest.Mock).mockReturnValue(mockMetrics);

      const result = validateLoggingConsistency();

      expect(result.comparison.totalLogs.percentageDiff).toBe(10.0);
      expect(result.validation.dataConsistency).toBe('fail');
      expect(result.validation.overallStatus).toBe('fail');
      expect(result.recommendations.some(r => r.includes('Log count difference'))).toBe(true);
    });

    it('should detect performance degradation', () => {
      const mockMetrics = {
        mode: 'parallel',
        seq: {
          totalLogs: 1000,
          successfulLogs: 995,
          failedLogs: 5,
          averageLatency: 25.0,
        },
        otel: {
          totalLogs: 1000,
          successfulLogs: 995,
          failedLogs: 5,
          averageLatency: 80.0, // 220% increase - should trigger performance warning
          correlationRate: 0.92,
        },
      };

      (getLoggingMetrics as jest.Mock).mockReturnValue(mockMetrics);

      const result = validateLoggingConsistency();

      expect(result.comparison.performance.percentageDiff).toBe(220.0);
      expect(result.validation.performanceAcceptable).toBe(false);
      expect(result.validation.overallStatus).toBe('fail');
      expect(result.recommendations.some(r => r.includes('Latency difference'))).toBe(true);
    });

    it('should detect reliability issues', () => {
      const mockMetrics = {
        mode: 'parallel',
        seq: {
          totalLogs: 1000,
          successfulLogs: 900, // 90% success rate - below 95% threshold
          failedLogs: 100,
          averageLatency: 25.0,
        },
        otel: {
          totalLogs: 1000,
          successfulLogs: 920, // 92% success rate - below 95% threshold
          failedLogs: 80,
          averageLatency: 28.0,
          correlationRate: 0.92,
        },
      };

      (getLoggingMetrics as jest.Mock).mockReturnValue(mockMetrics);

      const result = validateLoggingConsistency();

      expect(result.comparison.reliability.seqSuccessRate).toBe(90.0);
      expect(result.comparison.reliability.otelSuccessRate).toBe(92.0);
      expect(result.validation.reliabilityAcceptable).toBe(false);
      expect(result.validation.overallStatus).toBe('fail');
      expect(result.recommendations.some(r => r.includes('success rate'))).toBe(true);
    });

    it('should detect correlation issues', () => {
      const mockMetrics = {
        mode: 'parallel',
        seq: {
          totalLogs: 1000,
          successfulLogs: 995,
          failedLogs: 5,
          averageLatency: 25.0,
        },
        otel: {
          totalLogs: 1000,
          successfulLogs: 995,
          failedLogs: 5,
          averageLatency: 28.0,
          correlationRate: 0.60, // 60% - below 80% threshold
        },
      };

      (getLoggingMetrics as jest.Mock).mockReturnValue(mockMetrics);

      const result = validateLoggingConsistency();

      expect(result.comparison.correlation.otelCorrelationRate).toBe(60.0);
      expect(result.validation.correlationAcceptable).toBe(false);
      expect(result.validation.overallStatus).toBe('fail');
      expect(result.recommendations.some(r => r.includes('Correlation rate'))).toBe(true);
    });

    it('should handle missing metrics gracefully', () => {
      (getLoggingMetrics as jest.Mock).mockReturnValue({
        mode: 'parallel',
        seq: null,
        otel: null,
      });

      const result = validateLoggingConsistency();

      expect(result.comparison.totalLogs.seq).toBe(0);
      expect(result.comparison.totalLogs.otel).toBe(0);
      expect(result.validation.overallStatus).toBe('pass'); // No issues when no data
    });
  });

  describe('LoggingValidator', () => {
    let validator: LoggingValidator;

    beforeEach(() => {
      validator = new LoggingValidator(500, { // 500ms interval for faster testing
        maxLogCountDifference: 5.0,
        maxLatencyDifference: 20.0,
        minSuccessRate: 95.0,
        minCorrelationRate: 80.0,
        maxPerformanceImpact: 50.0,
      });
    });

    afterEach(() => {
      validator.stopValidation();
    });

    it('should start and stop continuous validation', (done) => {
      const mockMetrics = {
        mode: 'parallel',
        seq: { totalLogs: 100, successfulLogs: 98, failedLogs: 2, averageLatency: 25.0 },
        otel: { totalLogs: 100, successfulLogs: 98, failedLogs: 2, averageLatency: 28.0, correlationRate: 0.85 },
      };

      (getLoggingMetrics as jest.Mock).mockReturnValue(mockMetrics);

      validator.startValidation();

      setTimeout(() => {
        const history = validator.getValidationHistory();
        expect(history.length).toBeGreaterThan(0);

        const latest = validator.getLatestValidation();
        expect(latest).not.toBeNull();
        expect(latest!.validation.overallStatus).toBe('pass');

        validator.stopValidation();
        done();
      }, 600); // Wait for at least one validation cycle
    });

    it('should build validation history over time', (done) => {
      const mockMetrics = {
        mode: 'parallel',
        seq: { totalLogs: 50, successfulLogs: 49, failedLogs: 1, averageLatency: 25.0 },
        otel: { totalLogs: 50, successfulLogs: 49, failedLogs: 1, averageLatency: 30.0, correlationRate: 0.88 },
      };

      (getLoggingMetrics as jest.Mock).mockReturnValue(mockMetrics);

      validator.startValidation();

      setTimeout(() => {
        const history = validator.getValidationHistory();
        expect(history.length).toBeGreaterThanOrEqual(1);

        // Each result should have consistent structure
        history.forEach(result => {
          expect(result).toHaveProperty('timestamp');
          expect(result).toHaveProperty('comparison');
          expect(result).toHaveProperty('validation');
          expect(result).toHaveProperty('recommendations');
        });

        validator.stopValidation();
        done();
      }, 1200); // Wait for multiple validation cycles
    });

    it('should calculate validation trends correctly', (done) => {
      // Simulate degrading performance over time
      let callCount = 0;
      (getLoggingMetrics as jest.Mock).mockImplementation(() => {
        callCount++;
        return {
          mode: 'parallel',
          seq: { 
            totalLogs: 100, 
            successfulLogs: Math.max(90, 100 - callCount), // Decreasing success rate
            failedLogs: Math.min(10, callCount), 
            averageLatency: 25.0 
          },
          otel: { 
            totalLogs: 100, 
            successfulLogs: Math.max(90, 100 - callCount), 
            failedLogs: Math.min(10, callCount), 
            averageLatency: 30.0, 
            correlationRate: Math.max(0.7, 0.9 - (callCount * 0.02)) // Decreasing correlation
          },
        };
      });

      validator.startValidation();

      setTimeout(() => {
        const trends = validator.getValidationTrends();
        
        expect(trends.avgSeqSuccessRate).toBeLessThan(100);
        expect(trends.avgOtelSuccessRate).toBeLessThan(100);
        expect(trends.recentFailures).toBeGreaterThanOrEqual(0);
        expect(trends.trendDirection).toMatch(/improving|degrading|stable/);

        validator.stopValidation();
        done();
      }, 1500);
    });
  });

  describe('LoggingMigrationManager', () => {
    let migrationManager: LoggingMigrationManager;

    beforeEach(() => {
      migrationManager = new LoggingMigrationManager();
    });

    it('should assess high readiness for stable systems', () => {
      // Mock a validator with excellent metrics
      const mockValidator = {
        getValidationTrends: () => ({
          avgOtelSuccessRate: 99.5,
          avgLatencyDiff: 8.0,
          avgLogCountDiff: 1.2,
          recentFailures: 0,
          trendDirection: 'improving' as const,
        }),
        getLatestValidation: () => ({
          validation: { overallStatus: 'pass' as const },
        }),
      };

      // Replace the validator instance
      (migrationManager as any).validator = mockValidator;

      const assessment = migrationManager.assessMigrationReadiness();

      expect(assessment.ready).toBe(true);
      expect(assessment.confidence).toBe('high');
      expect(assessment.requirements.every(r => r.status === 'met')).toBe(true);
      expect(assessment.recommendation).toContain('ready for OTEL-only migration');
    });

    it('should assess medium readiness for acceptable systems', () => {
      const mockValidator = {
        getValidationTrends: () => ({
          avgOtelSuccessRate: 97.0, // Slightly below ideal
          avgLatencyDiff: 18.0, // Close to threshold
          avgLogCountDiff: 3.0, // Acceptable
          recentFailures: 1, // One recent failure
          trendDirection: 'stable' as const,
        }),
        getLatestValidation: () => ({
          validation: { overallStatus: 'pass' as const },
        }),
      };

      (migrationManager as any).validator = mockValidator;

      const assessment = migrationManager.assessMigrationReadiness();

      expect(assessment.ready).toBe(true);
      expect(assessment.confidence).toBe('medium');
      expect(assessment.recommendation).toContain('careful monitoring');
    });

    it('should assess low readiness for problematic systems', () => {
      const mockValidator = {
        getValidationTrends: () => ({
          avgOtelSuccessRate: 92.0, // Below threshold
          avgLatencyDiff: 35.0, // High latency difference
          avgLogCountDiff: 8.0, // High log count difference
          recentFailures: 4, // Many recent failures
          trendDirection: 'degrading' as const,
        }),
        getLatestValidation: () => ({
          validation: { overallStatus: 'fail' as const },
        }),
      };

      (migrationManager as any).validator = mockValidator;

      const assessment = migrationManager.assessMigrationReadiness();

      expect(assessment.ready).toBe(false);
      expect(assessment.confidence).toBe('low');
      expect(assessment.requirements.some(r => r.status === 'not_met')).toBe(true);
      expect(assessment.recommendation).toContain('not ready');
    });

    it('should provide detailed requirement analysis', () => {
      const mockValidator = {
        getValidationTrends: () => ({
          avgOtelSuccessRate: 96.0,
          avgLatencyDiff: 22.0, // Above threshold
          avgLogCountDiff: 2.0,
          recentFailures: 0,
          trendDirection: 'stable' as const,
        }),
        getLatestValidation: () => ({
          validation: { overallStatus: 'warning' as const },
        }),
      };

      (migrationManager as any).validator = mockValidator;

      const assessment = migrationManager.assessMigrationReadiness();

      const performanceReq = assessment.requirements.find(r => 
        r.requirement === 'Performance acceptability');
      
      expect(performanceReq).toBeDefined();
      expect(performanceReq!.status).toBe('not_met');
      expect(performanceReq!.details).toContain('22.0%');
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete parallel logging workflow', async () => {
      // Mock healthy logging health
      (getLoggingHealth as jest.Mock).mockResolvedValue({
        mode: 'parallel',
        seq: { status: 'healthy', latency: 25 },
        otel: { status: 'healthy', latency: 30, otelStatus: 'operational' },
        overall: 'healthy',
        transports: ['SeqTransport', 'OTELTransport'],
      });

      // Mock good metrics
      (getLoggingMetrics as jest.Mock).mockReturnValue({
        mode: 'parallel',
        seq: { totalLogs: 500, successfulLogs: 498, failedLogs: 2, averageLatency: 25.0 },
        otel: { totalLogs: 499, successfulLogs: 497, failedLogs: 2, averageLatency: 30.0, correlationRate: 0.89 },
        comparison: { seqLogs: 500, otelLogs: 499, correlationRate: 0.89, performanceDiff: 5.0 },
      });

      const health = await getLoggingHealth();
      const validation = validateLoggingConsistency();

      expect(health.overall).toBe('healthy');
      expect(validation.validation.overallStatus).toBe('pass');

      // Test migration readiness
      const migrationManager = new LoggingMigrationManager();
      const assessment = migrationManager.assessMigrationReadiness();
      expect(assessment.ready).toBe(true);
    });

    it('should handle degraded logging scenarios', async () => {
      // Mock degraded health
      (getLoggingHealth as jest.Mock).mockResolvedValue({
        mode: 'parallel',
        seq: { status: 'degraded', latency: 120 },
        otel: { status: 'healthy', latency: 35 },
        overall: 'degraded',
        transports: ['SeqTransport', 'OTELTransport'],
      });

      // Mock degraded metrics
      (getLoggingMetrics as jest.Mock).mockReturnValue({
        mode: 'parallel',
        seq: { totalLogs: 1000, successfulLogs: 950, failedLogs: 50, averageLatency: 120.0 },
        otel: { totalLogs: 980, successfulLogs: 970, failedLogs: 10, averageLatency: 35.0, correlationRate: 0.75 },
      });

      const health = await getLoggingHealth();
      const validation = validateLoggingConsistency();

      expect(health.overall).toBe('degraded');
      expect(validation.validation.overallStatus).toBe('warning');
      
      // Should recommend keeping current setup
      const migrationManager = new LoggingMigrationManager();
      const assessment = migrationManager.assessMigrationReadiness();
      expect(assessment.ready).toBe(false);
    });

    it('should handle OTEL-only transition scenario', () => {
      // Mock OTEL-only mode
      (otelLoggingFlags as any).enableParallelLogging = false;
      (getLoggingMetrics as jest.Mock).mockReturnValue({
        mode: 'otel_only',
        seq: null,
        otel: { totalLogs: 1000, successfulLogs: 995, failedLogs: 5, averageLatency: 30.0, correlationRate: 0.92 },
      });

      const validation = validateLoggingConsistency();

      // With only OTEL data, should focus on OTEL performance
      expect(validation.comparison.totalLogs.otel).toBe(1000);
      expect(validation.comparison.totalLogs.seq).toBe(0);
      expect(validation.validation.overallStatus).toBe('pass');

      // Reset
      (otelLoggingFlags as any).enableParallelLogging = true;
    });
  });

  describe('Error Handling', () => {
    it('should handle validation errors gracefully', () => {
      (getLoggingMetrics as jest.Mock).mockImplementation(() => {
        throw new Error('Metrics collection failed');
      });

      expect(() => {
        validateLoggingConsistency();
      }).toThrow('Metrics collection failed');
    });

    it('should handle missing transport gracefully', () => {
      (getLoggingMetrics as jest.Mock).mockReturnValue({
        mode: 'seq_only',
        seq: { totalLogs: 100, successfulLogs: 98, failedLogs: 2, averageLatency: 25.0 },
        otel: null,
      });

      const validation = validateLoggingConsistency();

      expect(validation.comparison.totalLogs.otel).toBe(0);
      expect(validation.validation.overallStatus).toBe('pass'); // Should still validate Seq-only
    });
  });
});