/**
 * Log Service Unit Tests
 * Fortium External Metrics Web Service - Task 2.3: Backend Log API Implementation
 */

import { LogsService, logsService } from '../../services/logs.service';
import { logger, logWithContext, getSeqHealth, getSeqMetrics } from '../../config/logger';
import { LogEntry, LogIngestionResponse } from '../../validation/logs.validation';

// Mock dependencies
jest.mock('../../config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
  logWithContext: jest.fn(),
  getSeqHealth: jest.fn(),
  getSeqMetrics: jest.fn(),
}));

const mockLogger = logger as jest.Mocked<typeof logger>;
const mockLogWithContext = logWithContext as jest.MockedFunction<typeof logWithContext>;
const mockGetSeqHealth = getSeqHealth as jest.MockedFunction<typeof getSeqHealth>;
const mockGetSeqMetrics = getSeqMetrics as jest.MockedFunction<typeof getSeqMetrics>;

describe('LogsService', () => {
  let service: LogsService;

  beforeEach(() => {
    // Get fresh instance and reset metrics
    service = LogsService.getInstance();
    service.resetMetrics();
    jest.clearAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = LogsService.getInstance();
      const instance2 = LogsService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('processBatch', () => {
    const mockContext = {
      correlationId: 'test-correlation-id',
      requestId: 'test-request-id',
      clientIp: '192.168.1.1',
      userAgent: 'Test User Agent',
      userId: 'user-123',
      tenantId: 'tenant-456',
    };

    it('should process valid log entries successfully', async () => {
      const entries: LogEntry[] = [
        {
          timestamp: '2023-12-01T10:00:00.000Z',
          level: 'Information',
          message: 'User login successful',
          messageTemplate: 'User {UserId} login successful',
          properties: {
            userId: 'user-123',
            correlationId: 'test-correlation-id',
          },
        },
        {
          timestamp: '2023-12-01T10:01:00.000Z',
          level: 'Warning',
          message: 'Slow response detected',
          properties: {
            responseTime: 2500,
            endpoint: '/api/v1/metrics',
          },
        },
      ];

      const result = await service.processBatch(entries, mockContext);

      expect(result).toEqual({
        success: true,
        processed: 2,
        failed: 0,
        errors: [],
        correlationId: mockContext.correlationId,
      });

      expect(mockLogWithContext).toHaveBeenCalledTimes(2);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Log batch processed',
        expect.objectContaining({
          component: 'LogsService',
          operation: 'processBatch',
          processed: 2,
          failed: 0,
          correlationId: mockContext.correlationId,
        })
      );
    });

    it('should handle individual entry processing failures', async () => {
      const entries: LogEntry[] = [
        {
          timestamp: '2023-12-01T10:00:00.000Z',
          level: 'Information',
          message: 'Valid entry',
          properties: {},
        },
        {
          timestamp: '2023-12-01T10:01:00.000Z',
          level: 'Error',
          message: 'Entry with exception',
          properties: {},
          exception: {
            type: 'ValidationError',
            message: 'Test exception',
            stackTrace: 'Error stack trace...',
          },
        },
      ];

      // Mock logWithContext to throw error on second call
      mockLogWithContext
        .mockImplementationOnce(() => {}) // First call succeeds
        .mockImplementationOnce(() => {
          throw new Error('Processing failed');
        }); // Second call fails

      const result = await service.processBatch(entries, mockContext);

      expect(result).toEqual({
        success: false, // Less than half succeeded
        processed: 1,
        failed: 1,
        errors: ['Entry 1: Processing failed'],
        correlationId: mockContext.correlationId,
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to process log entry',
        expect.objectContaining({
          component: 'LogsService',
          operation: 'processBatch',
          entryIndex: 1,
          error: 'Entry 1: Processing failed',
        })
      );
    });

    it('should reject batches exceeding size limits', async () => {
      const largeEntry: LogEntry = {
        timestamp: '2023-12-01T10:00:00.000Z',
        level: 'Information',
        message: 'A'.repeat(2000000), // 2MB message
        properties: {},
      };

      const result = await service.processBatch([largeEntry], mockContext);

      expect(result.success).toBe(false);
      expect(result.processed).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors).toContain(expect.stringMatching(/Batch size.*exceeds limit/));
    });

    it('should map frontend log levels to Winston levels correctly', async () => {
      const entries: LogEntry[] = [
        { timestamp: '2023-12-01T10:00:00.000Z', level: 'Information', message: 'Info message', properties: {} },
        { timestamp: '2023-12-01T10:00:00.000Z', level: 'Warning', message: 'Warning message', properties: {} },
        { timestamp: '2023-12-01T10:00:00.000Z', level: 'Error', message: 'Error message', properties: {} },
        { timestamp: '2023-12-01T10:00:00.000Z', level: 'Fatal', message: 'Fatal message', properties: {} },
      ];

      await service.processBatch(entries, mockContext);

      expect(mockLogWithContext).toHaveBeenCalledWith('info', 'Info message', expect.any(Object), expect.any(Object));
      expect(mockLogWithContext).toHaveBeenCalledWith('warn', 'Warning message', expect.any(Object), expect.any(Object));
      expect(mockLogWithContext).toHaveBeenCalledWith('error', 'Error message', expect.any(Object), expect.any(Object));
      expect(mockLogWithContext).toHaveBeenCalledWith('error', 'Fatal message', expect.any(Object), expect.any(Object));
    });

    it('should enrich log entries with backend metadata', async () => {
      const entry: LogEntry = {
        timestamp: '2023-12-01T10:00:00.000Z',
        level: 'Information',
        message: 'Test message',
        messageTemplate: 'Test message for {UserId}',
        properties: {
          userId: 'user-123',
          component: 'TestComponent',
        },
      };

      await service.processBatch([entry], mockContext);

      expect(mockLogWithContext).toHaveBeenCalledWith(
        'info',
        'Test message',
        expect.objectContaining({
          correlationId: mockContext.correlationId,
          userId: mockContext.userId,
          tenantId: mockContext.tenantId,
        }),
        expect.objectContaining({
          source: 'frontend-client',
          clientIp: mockContext.clientIp,
          userAgent: mockContext.userAgent,
          backendProcessedAt: expect.any(String),
          environment: expect.any(String),
          service: 'fortium-metrics-web-service',
          originalTimestamp: entry.timestamp,
          messageTemplate: entry.messageTemplate,
        })
      );
    });

    it('should handle exception details correctly', async () => {
      const entry: LogEntry = {
        timestamp: '2023-12-01T10:00:00.000Z',
        level: 'Error',
        message: 'Application error occurred',
        properties: {},
        exception: {
          type: 'ApplicationError',
          message: 'Database connection failed',
          stackTrace: 'Error: Database connection failed\n    at Database.connect (database.js:45:10)',
          source: 'DatabaseService',
          innerException: {
            type: 'NetworkError',
            message: 'Connection timeout',
          },
        },
      };

      await service.processBatch([entry], mockContext);

      expect(mockLogWithContext).toHaveBeenCalledWith(
        'error',
        'Application error occurred',
        expect.any(Object),
        expect.objectContaining({
          exception: {
            type: 'ApplicationError',
            message: 'Database connection failed',
            stackTrace: expect.stringContaining('Database.connect'),
            source: 'DatabaseService',
            innerException: {
              type: 'NetworkError',
              message: 'Connection timeout',
            },
          },
        })
      );
    });
  });

  describe('getHealthStatus', () => {
    it('should return healthy status when all systems are operational', async () => {
      mockGetSeqHealth.mockResolvedValue({ status: 'healthy' });

      const health = await service.getHealthStatus();

      expect(health.status).toBe('healthy');
      expect(health.checks.winston).toBe(true);
      expect(health.checks.seq.status).toBe('healthy');
      expect(health.checks.rateLimit.enabled).toBe(true);
      expect(health.metrics).toBeDefined();
    });

    it('should return degraded status when Seq is degraded', async () => {
      mockGetSeqHealth.mockResolvedValue({ 
        status: 'degraded', 
        latency: 500,
      });

      const health = await service.getHealthStatus();

      expect(health.status).toBe('degraded');
      expect(health.checks.seq.status).toBe('degraded');
      expect(health.checks.seq.latency).toBe(500);
    });

    it('should return unhealthy status when Seq is unhealthy', async () => {
      mockGetSeqHealth.mockResolvedValue({ 
        status: 'unhealthy', 
        error: 'Connection failed',
      });

      const health = await service.getHealthStatus();

      expect(health.status).toBe('unhealthy');
      expect(health.checks.seq.status).toBe('unhealthy');
      expect(health.checks.seq.error).toBe('Connection failed');
    });

    it('should handle health check errors', async () => {
      mockGetSeqHealth.mockRejectedValue(new Error('Health check failed'));

      const health = await service.getHealthStatus();

      expect(health.status).toBe('unhealthy');
      expect(health.checks.winston).toBe(false);
      expect(health.checks.seq.status).toBe('unhealthy');
    });
  });

  describe('getSeqMetrics', () => {
    it('should return Seq metrics when available', () => {
      const mockMetrics = {
        connected: true,
        batches: 25,
        events: 1000,
        lastFlush: '2023-12-01T10:00:00.000Z',
      };

      mockGetSeqMetrics.mockReturnValue(mockMetrics);

      const metrics = service.getSeqMetrics();

      expect(metrics).toEqual(mockMetrics);
    });

    it('should return null when Seq metrics are not available', () => {
      mockGetSeqMetrics.mockReturnValue(null);

      const metrics = service.getSeqMetrics();

      expect(metrics).toBeNull();
    });

    it('should handle Seq metrics errors', () => {
      mockGetSeqMetrics.mockImplementation(() => {
        throw new Error('Metrics unavailable');
      });

      const metrics = service.getSeqMetrics();

      expect(metrics).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to get Seq metrics',
        expect.objectContaining({
          component: 'LogsService',
          operation: 'getSeqMetrics',
        })
      );
    });
  });

  describe('getMetrics', () => {
    it('should return service metrics', () => {
      // Process some entries to generate metrics
      const entries: LogEntry[] = [
        { timestamp: '2023-12-01T10:00:00.000Z', level: 'Information', message: 'Test 1', properties: {} },
        { timestamp: '2023-12-01T10:00:00.000Z', level: 'Information', message: 'Test 2', properties: {} },
      ];

      const mockContext = {
        correlationId: 'test-id',
        clientIp: '127.0.0.1',
      };

      // Manually update metrics (simulating batch processing)
      service['updateMetrics'](2, 0, 100);

      const metrics = service.getMetrics();

      expect(metrics).toEqual({
        entriesProcessed: 2,
        entriesFailed: 0,
        averageProcessingTime: 100,
        successRate: 100,
        uptime: expect.any(Number),
        lastProcessedAt: expect.any(Date),
      });
    });

    it('should calculate success rate correctly', () => {
      // Manually update metrics with failures
      service['updateMetrics'](8, 2, 50); // 80% success rate

      const metrics = service.getMetrics();

      expect(metrics.successRate).toBe(80);
      expect(metrics.entriesProcessed).toBe(8);
      expect(metrics.entriesFailed).toBe(2);
    });

    it('should handle zero processed entries', () => {
      const metrics = service.getMetrics();

      expect(metrics.successRate).toBe(100);
      expect(metrics.averageProcessingTime).toBe(0);
      expect(metrics.entriesProcessed).toBe(0);
      expect(metrics.entriesFailed).toBe(0);
    });
  });

  describe('resetMetrics', () => {
    it('should reset all metrics to initial state', () => {
      // Set some metrics first
      service['updateMetrics'](100, 5, 1000);

      const metricsBeforeReset = service.getMetrics();
      expect(metricsBeforeReset.entriesProcessed).toBe(100);
      expect(metricsBeforeReset.entriesFailed).toBe(5);

      // Reset metrics
      service.resetMetrics();

      const metricsAfterReset = service.getMetrics();
      expect(metricsAfterReset.entriesProcessed).toBe(0);
      expect(metricsAfterReset.entriesFailed).toBe(0);
      expect(metricsAfterReset.averageProcessingTime).toBe(0);
      expect(metricsAfterReset.successRate).toBe(100);
      expect(metricsAfterReset.lastProcessedAt).toBeNull();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'LogsService metrics reset',
        expect.objectContaining({
          component: 'LogsService',
          operation: 'resetMetrics',
        })
      );
    });
  });

  describe('calculateBatchSize', () => {
    it('should calculate batch size in KB correctly', () => {
      const entries: LogEntry[] = [
        {
          timestamp: '2023-12-01T10:00:00.000Z',
          level: 'Information',
          message: 'A'.repeat(1000), // ~1KB message
          properties: {},
        },
      ];

      const size = service['calculateBatchSize'](entries);
      expect(size).toBeGreaterThan(0);
      expect(typeof size).toBe('number');
    });

    it('should handle empty entries array', () => {
      const size = service['calculateBatchSize']([]);
      expect(size).toBe(0);
    });
  });

  describe('sanitizeLogProperties', () => {
    it('should be tested through validation module', () => {
      // This method is imported from validation module
      // Tests are in logs.validation.test.ts
      expect(true).toBe(true);
    });
  });
});

describe('LogsService Integration', () => {
  it('should maintain singleton instance across imports', () => {
    expect(logsService).toBe(LogsService.getInstance());
    expect(logsService).toBe(LogsService.getInstance());
  });

  it('should be ready for use after module import', () => {
    expect(logsService).toBeDefined();
    expect(typeof logsService.processBatch).toBe('function');
    expect(typeof logsService.getHealthStatus).toBe('function');
    expect(typeof logsService.getMetrics).toBe('function');
  });
});