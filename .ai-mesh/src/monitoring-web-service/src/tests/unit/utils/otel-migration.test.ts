/**
 * OpenTelemetry Migration Utilities Tests
 * Fortium Monitoring Web Service - Sprint 2: OpenTelemetry Migration
 * Task 2.4: Correlation Middleware Replacement with OTEL Context
 */

import { Request, Response, NextFunction } from 'express';
import {
  createMigrationMiddleware,
  createComparisonMiddleware,
  createEnvironmentMigrationMiddleware,
  getMigrationHealth,
  getMigrationStats,
  resetMigrationStats,
  migrationPresets,
  default as migration,
} from '../../../utils/otel-migration';

// Mock the middleware modules
jest.mock('../../../middleware/correlation.middleware', () => ({
  correlationMiddleware: jest.fn(() => (req: Request, res: Response, next: NextFunction) => {
    req.correlationId = 'legacy-correlation-id';
    req.requestId = 'legacy-request-id';
    req.traceId = 'legacy-trace-id';
    req.spanId = 'legacy-span-id';
    req.logContext = { correlationId: 'legacy-correlation-id' };
    req.logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as any;
    next();
  }),
}));

jest.mock('../../../middleware/otel-correlation.middleware', () => ({
  otelCorrelationMiddleware: jest.fn(() => (req: Request, res: Response, next: NextFunction) => {
    req.correlationId = 'otel-correlation-id';
    req.requestId = 'otel-request-id';
    req.traceId = 'otel-trace-id';
    req.spanId = 'otel-span-id';
    req.logContext = { correlationId: 'otel-correlation-id' };
    req.logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as any;
    req.otelSpan = {
      spanContext: () => ({
        traceId: 'otel-trace-id',
        spanId: 'otel-span-id',
      }),
    } as any;
    next();
  }),
}));

// Mock config
jest.mock('../../../config/environment', () => ({
  config: {
    nodeEnv: 'test',
  },
}));

// Mock logger
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

jest.mock('../../../config/logger', () => ({
  logger: mockLogger,
}));

describe('OTEL Migration Utilities', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      method: 'GET',
      url: '/test',
      path: '/test',
      headers: {},
      ip: '127.0.0.1',
    };
    res = {
      setHeader: jest.fn(),
      end: jest.fn(),
      statusCode: 200,
      getHeader: jest.fn(() => '1024'),
    };
    next = jest.fn();

    // Reset environment variables
    delete process.env.ENABLE_OTEL_CORRELATION;
    delete process.env.OTEL_ROLLOUT_PERCENTAGE;
    delete process.env.ENABLE_OTEL_FEATURE_FLAG;
    delete process.env.ENABLE_OTEL_COMPARISON;
    delete process.env.ENABLE_OTEL_MIGRATION_METRICS;

    // Reset mocks
    jest.clearAllMocks();
    resetMigrationStats();
  });

  describe('createMigrationMiddleware', () => {
    it('should use OTEL middleware when enableOTEL is true', () => {
      const middleware = createMigrationMiddleware({
        enableOTEL: true,
        rolloutPercentage: 100,
      });

      middleware(req as Request, res as Response, next);

      expect(req.correlationId).toBe('otel-correlation-id');
      expect((req as any).migrationMetadata).toHaveProperty('useOTEL', true);
      expect(next).toHaveBeenCalled();
    });

    it('should use legacy middleware when enableOTEL is false', () => {
      const middleware = createMigrationMiddleware({
        enableOTEL: false,
        rolloutPercentage: 0,
      });

      middleware(req as Request, res as Response, next);

      expect(req.correlationId).toBe('legacy-correlation-id');
      expect((req as any).migrationMetadata).toHaveProperty('useOTEL', false);
      expect(next).toHaveBeenCalled();
    });

    it('should respect feature flag header when enabled', () => {
      req.headers = { 'x-enable-otel': 'true' };
      
      const middleware = createMigrationMiddleware({
        enableOTEL: true,
        enableFeatureFlag: true,
        rolloutPercentage: 0, // Would normally use legacy
      });

      middleware(req as Request, res as Response, next);

      expect(req.correlationId).toBe('otel-correlation-id');
      expect((req as any).migrationMetadata).toHaveProperty('useOTEL', true);
    });

    it('should respect feature flag header override to false', () => {
      req.headers = { 'x-enable-otel': 'false' };
      
      const middleware = createMigrationMiddleware({
        enableOTEL: true,
        enableFeatureFlag: true,
        rolloutPercentage: 100, // Would normally use OTEL
      });

      middleware(req as Request, res as Response, next);

      expect(req.correlationId).toBe('legacy-correlation-id');
      expect((req as any).migrationMetadata).toHaveProperty('useOTEL', false);
    });

    it('should use rollout percentage for partial deployment', () => {
      // Mock consistent request ID for testing
      req.ip = '127.0.0.1'; // This should give consistent hash
      
      const middleware50 = createMigrationMiddleware({
        enableOTEL: true,
        rolloutPercentage: 50,
      });

      const middleware0 = createMigrationMiddleware({
        enableOTEL: true,
        rolloutPercentage: 0,
      });

      const middleware100 = createMigrationMiddleware({
        enableOTEL: true,
        rolloutPercentage: 100,
      });

      // Test 0% rollout
      middleware0(req as Request, res as Response, next);
      expect((req as any).migrationMetadata.useOTEL).toBe(false);

      // Reset request
      req = { ...req };

      // Test 100% rollout
      middleware100(req as Request, res as Response, next);
      expect((req as any).migrationMetadata.useOTEL).toBe(true);
    });

    it('should collect metrics when enabled', (done) => {
      const middleware = createMigrationMiddleware({
        enableOTEL: true,
        rolloutPercentage: 100,
        enableMetrics: true,
      });

      middleware(req as Request, res as Response, next);

      // Mock response end
      const originalEnd = res.end as jest.Mock;
      res.end = jest.fn(function(this: Response, chunk?: any, encoding?: any) {
        const result = originalEnd.call(this, chunk, encoding);
        
        // Check that stats were collected
        const stats = getMigrationStats();
        expect(stats.totalRequests).toBeGreaterThan(0);
        expect(stats.otelRequests).toBeGreaterThan(0);
        
        done();
        return result;
      });

      (res.end as jest.Mock)();
    });

    it('should handle middleware errors gracefully', () => {
      // Mock OTEL middleware to throw an error
      const { otelCorrelationMiddleware } = require('../../../middleware/otel-correlation.middleware');
      otelCorrelationMiddleware.mockImplementation(() => () => {
        throw new Error('OTEL middleware error');
      });

      const middleware = createMigrationMiddleware({
        enableOTEL: true,
        rolloutPercentage: 100,
      });

      expect(() => {
        middleware(req as Request, res as Response, next);
      }).not.toThrow();

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Migration middleware error',
        expect.objectContaining({
          event: 'otel.migration.error',
          useOTEL: true,
        })
      );
    });
  });

  describe('createComparisonMiddleware', () => {
    beforeEach(() => {
      // Enable comparison mode
      process.env.ENABLE_OTEL_COMPARISON = 'true';
    });

    it('should run both middleware implementations', () => {
      const middleware = createComparisonMiddleware();

      middleware(req as Request, res as Response, next);

      // Should use OTEL middleware for the real request
      expect(req.correlationId).toBe('otel-correlation-id');
      expect(next).toHaveBeenCalled();
    });

    it('should log comparison mismatches', () => {
      const middleware = createComparisonMiddleware();

      // Force a mismatch by modifying the mock behavior
      const { correlationMiddleware } = require('../../../middleware/correlation.middleware');
      correlationMiddleware.mockImplementation(() => (req: Request, res: Response, next: NextFunction) => {
        // Don't set correlation ID to force mismatch
        next();
      });

      middleware(req as Request, res as Response, next);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'OTEL Migration Comparison Mismatch',
        expect.objectContaining({
          event: 'otel.migration.comparison.mismatch',
        })
      );
    });

    it('should fallback to migration middleware when comparison is disabled', () => {
      process.env.ENABLE_OTEL_COMPARISON = 'false';

      const middleware = createComparisonMiddleware();

      middleware(req as Request, res as Response, next);

      // Should still work, using migration middleware
      expect(req.correlationId).toBeDefined();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Environment-specific Migration', () => {
    it('should use development preset', () => {
      const middleware = createEnvironmentMigrationMiddleware('development');

      expect(middleware).toBeInstanceOf(Function);

      middleware(req as Request, res as Response, next);

      expect((req as any).migrationMetadata).toBeDefined();
    });

    it('should use production preset', () => {
      const middleware = createEnvironmentMigrationMiddleware('production');

      expect(middleware).toBeInstanceOf(Function);

      middleware(req as Request, res as Response, next);

      expect((req as any).migrationMetadata).toBeDefined();
    });

    it('should default to development preset for unknown environment', () => {
      const middleware = createEnvironmentMigrationMiddleware('unknown');

      expect(middleware).toBeInstanceOf(Function);

      middleware(req as Request, res as Response, next);

      expect((req as any).migrationMetadata).toBeDefined();
    });
  });

  describe('Migration Health and Statistics', () => {
    it('should report healthy status with good metrics', () => {
      // Simulate some successful requests
      const middleware = createMigrationMiddleware({
        enableOTEL: true,
        rolloutPercentage: 100,
        enableMetrics: true,
      });

      // Process multiple requests
      for (let i = 0; i < 20; i++) {
        const testReq = { ...req };
        const testRes = { ...res, end: jest.fn() };
        
        middleware(testReq as Request, testRes as Response, next);
        (testRes.end as jest.Mock)();
      }

      const health = getMigrationHealth();

      expect(health.status).toBe('healthy');
      expect(health.details.statistics.totalRequests).toBe(20);
      expect(health.details.statistics.otelRequests).toBe(20);
    });

    it('should report degraded status with high error rates', () => {
      // Simulate requests with errors
      const middleware = createMigrationMiddleware({
        enableOTEL: true,
        rolloutPercentage: 100,
        enableMetrics: true,
      });

      // Process requests with errors
      for (let i = 0; i < 20; i++) {
        const testReq = { ...req };
        const testRes = { ...res, end: jest.fn(), statusCode: 500 };
        
        middleware(testReq as Request, testRes as Response, next);
        (testRes.end as jest.Mock)();
      }

      const health = getMigrationHealth();

      expect(health.status).toBe('degraded');
      expect(health.details.recommendations).toContain(
        'OTEL implementation has lower success rate - investigate issues'
      );
    });

    it('should provide migration statistics', () => {
      const stats = getMigrationStats();

      expect(stats).toHaveProperty('totalRequests');
      expect(stats).toHaveProperty('otelRequests');
      expect(stats).toHaveProperty('legacyRequests');
      expect(stats).toHaveProperty('otelSuccessRate');
      expect(stats).toHaveProperty('legacySuccessRate');
      expect(stats).toHaveProperty('otelAdoptionRate');
    });

    it('should reset migration statistics', () => {
      // Add some data first
      const middleware = createMigrationMiddleware({
        enableOTEL: true,
        rolloutPercentage: 100,
        enableMetrics: true,
      });

      middleware(req as Request, res as Response, next);
      (res.end as jest.Mock)();

      let stats = getMigrationStats();
      expect(stats.totalRequests).toBeGreaterThan(0);

      resetMigrationStats();

      stats = getMigrationStats();
      expect(stats.totalRequests).toBe(0);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Migration statistics reset',
        { event: 'otel.migration.stats.reset' }
      );
    });
  });

  describe('Migration Presets', () => {
    it('should have correct development preset', () => {
      expect(migrationPresets.development).toEqual({
        enableOTEL: true,
        rolloutPercentage: 50,
        enableFeatureFlag: true,
        enableComparison: true,
        enableMetrics: true,
      });
    });

    it('should have correct production preset', () => {
      expect(migrationPresets.production).toEqual({
        enableOTEL: true,
        rolloutPercentage: 10,
        enableFeatureFlag: false,
        enableComparison: false,
        enableMetrics: true,
      });
    });

    it('should have correct testing preset', () => {
      expect(migrationPresets.testing).toEqual({
        enableOTEL: true,
        rolloutPercentage: 100,
        enableFeatureFlag: false,
        enableComparison: false,
        enableMetrics: false,
      });
    });
  });

  describe('Environment Variable Configuration', () => {
    it('should read configuration from environment variables', () => {
      process.env.ENABLE_OTEL_CORRELATION = 'true';
      process.env.OTEL_ROLLOUT_PERCENTAGE = '75';
      process.env.ENABLE_OTEL_FEATURE_FLAG = 'true';
      process.env.ENABLE_OTEL_COMPARISON = 'true';
      process.env.ENABLE_OTEL_MIGRATION_METRICS = 'true';

      // Re-require the module to pick up new env vars
      jest.resetModules();
      const migrationModule = require('../../../utils/otel-migration');

      const middleware = migrationModule.createMigrationMiddleware();

      middleware(req as Request, res as Response, next);

      expect((req as any).migrationMetadata.migrationConfig).toMatchObject({
        enableOTEL: true,
        rolloutPercentage: 75,
        enableFeatureFlag: true,
        enableComparison: true,
        enableMetrics: true,
      });
    });

    it('should use default values when environment variables are not set', () => {
      const middleware = createMigrationMiddleware();

      middleware(req as Request, res as Response, next);

      expect((req as any).migrationMetadata.migrationConfig).toMatchObject({
        enableOTEL: false, // Default when ENABLE_OTEL_CORRELATION is not set
        rolloutPercentage: 0, // Default when OTEL_ROLLOUT_PERCENTAGE is not set
        enableFeatureFlag: false,
        enableComparison: false,
        enableMetrics: false,
      });
    });
  });

  describe('Default Export', () => {
    it('should export all migration utilities', () => {
      expect(migration).toHaveProperty('createMigrationMiddleware');
      expect(migration).toHaveProperty('createComparisonMiddleware');
      expect(migration).toHaveProperty('createEnvironmentMigrationMiddleware');
      expect(migration).toHaveProperty('getMigrationHealth');
      expect(migration).toHaveProperty('getMigrationStats');
      expect(migration).toHaveProperty('resetMigrationStats');
      expect(migration).toHaveProperty('migrationPresets');
    });
  });

  describe('Performance Tracking', () => {
    it('should track performance differences between OTEL and legacy', () => {
      const middleware = createMigrationMiddleware({
        enableOTEL: true,
        rolloutPercentage: 50, // Mix of both
        enableMetrics: true,
      });

      // Simulate multiple requests
      for (let i = 0; i < 10; i++) {
        const testReq = { ...req, ip: `127.0.0.${i}` }; // Different IPs for different hash
        const testRes = { ...res, end: jest.fn() };
        
        middleware(testReq as Request, testRes as Response, next);
        
        // Simulate different response times
        setTimeout(() => {
          (testRes.end as jest.Mock)();
        }, Math.random() * 10);
      }

      const stats = getMigrationStats();
      expect(stats.performanceComparison).toHaveProperty('otelAvgMs');
      expect(stats.performanceComparison).toHaveProperty('legacyAvgMs');
    });
  });

  describe('Error Handling', () => {
    it('should handle errors in health check gracefully', () => {
      // Mock getMigrationStats to throw
      const originalGetStats = getMigrationStats;
      (global as any).getMigrationStats = jest.fn(() => {
        throw new Error('Stats error');
      });

      expect(() => getMigrationHealth()).not.toThrow();

      // Restore
      (global as any).getMigrationStats = originalGetStats;
    });

    it('should handle comparison errors gracefully', () => {
      const middleware = createComparisonMiddleware();

      // Mock one of the middlewares to throw
      const { correlationMiddleware } = require('../../../middleware/correlation.middleware');
      correlationMiddleware.mockImplementation(() => () => {
        throw new Error('Legacy middleware error');
      });

      expect(() => {
        middleware(req as Request, res as Response, next);
      }).not.toThrow();

      // Should still proceed with OTEL middleware
      expect(req.correlationId).toBe('otel-correlation-id');
    });
  });
});