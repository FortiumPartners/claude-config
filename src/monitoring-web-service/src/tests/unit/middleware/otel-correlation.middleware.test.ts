/**
 * OpenTelemetry Correlation Middleware Tests
 * Fortium Monitoring Web Service - Sprint 2: OpenTelemetry Migration
 * Task 2.4: Correlation Middleware Replacement with OTEL Context
 */

import { Request, Response, NextFunction } from 'express';
import * as api from '@opentelemetry/api';
import {
  otelCorrelationMiddleware,
  defaultOTELCorrelationMiddleware,
  lightOTELCorrelationMiddleware,
  createOTELSpan,
  withOTELContext,
  correlateDbOperationWithOTEL,
  correlateApiCallWithOTEL,
  trackPerformanceWithOTEL,
  createMigrationMiddleware,
  getCorrelationId,
  getLogContext,
  createSpan,
  logOperation,
} from '../../../middleware/otel-correlation.middleware';

// Mock OpenTelemetry
const mockSpan = {
  spanContext: jest.fn(() => ({
    traceId: 'mock-trace-id-123',
    spanId: 'mock-span-id-456',
    traceFlags: 1,
  })),
  setAttributes: jest.fn(),
  setStatus: jest.fn(),
  addEvent: jest.fn(),
  recordException: jest.fn(),
  end: jest.fn(),
  isRecording: jest.fn(() => true),
};

const mockTracer = {
  startSpan: jest.fn(() => mockSpan),
  startActiveSpan: jest.fn((name, options, callback) => {
    return callback(mockSpan);
  }),
};

const mockContext = {
  active: jest.fn(() => ({})),
  with: jest.fn((ctx, callback) => callback()),
};

const mockPropagation = {
  getBaggage: jest.fn(() => ({})),
  createBaggage: jest.fn(() => ({})),
  setBaggage: jest.fn(),
};

jest.mock('@opentelemetry/api', () => ({
  trace: {
    getActiveSpan: jest.fn(() => mockSpan),
    getTracer: jest.fn(() => mockTracer),
  },
  context: mockContext,
  propagation: mockPropagation,
  SpanStatusCode: {
    OK: 1,
    ERROR: 2,
  },
}));

// Mock logger
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  log: jest.fn(),
  child: jest.fn(() => mockLogger),
};

jest.mock('../../../config/logger', () => ({
  createContextualLogger: jest.fn(() => mockLogger),
}));

describe('OTEL Correlation Middleware', () => {
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
      getHeader: jest.fn(),
    };
    next = jest.fn();

    // Reset mocks
    jest.clearAllMocks();
    mockSpan.isRecording.mockReturnValue(true);
  });

  describe('Basic Functionality', () => {
    it('should generate correlation ID using OTEL trace ID when OTEL is enabled', () => {
      const middleware = otelCorrelationMiddleware({ enableOTEL: true });
      
      middleware(req as Request, res as Response, next);
      
      expect(req.correlationId).toBe('mock-trace-id-123');
      expect(req.traceId).toBe('mock-trace-id-123');
      expect(req.spanId).toBe('mock-span-id-456');
      expect(req.requestId).toBeDefined();
      expect(req.logger).toBeDefined();
      expect(req.logContext).toBeDefined();
      expect(req.otelSpan).toBe(mockSpan);
      expect(next).toHaveBeenCalled();
    });

    it('should fallback to custom correlation ID when OTEL is disabled', () => {
      const middleware = otelCorrelationMiddleware({ enableOTEL: false });
      
      middleware(req as Request, res as Response, next);
      
      expect(req.correlationId).toMatch(/^corr_\d+_/);
      expect(req.traceId).toBe(req.correlationId);
      expect(req.spanId).toMatch(/^span_/);
      expect(req.requestId).toMatch(/^req_/);
      expect(next).toHaveBeenCalled();
    });

    it('should extract correlation ID from headers when provided', () => {
      req.headers = {
        'x-correlation-id': 'existing-correlation-id',
        'x-session-id': 'session-123',
      };
      
      const middleware = otelCorrelationMiddleware({ enableOTEL: false });
      
      middleware(req as Request, res as Response, next);
      
      expect(req.correlationId).toBe('existing-correlation-id');
      expect(req.sessionId).toBe('session-123');
    });
  });

  describe('Response Headers', () => {
    it('should set correlation headers in response when enabled', () => {
      const middleware = otelCorrelationMiddleware({ 
        includeInResponse: true,
        enableOTEL: true,
      });
      
      middleware(req as Request, res as Response, next);
      
      expect(res.setHeader).toHaveBeenCalledWith('x-correlation-id', 'mock-trace-id-123');
      expect(res.setHeader).toHaveBeenCalledWith('x-trace-id', 'mock-trace-id-123');
      expect(res.setHeader).toHaveBeenCalledWith('x-span-id', 'mock-span-id-456');
      expect(res.setHeader).toHaveBeenCalledWith('x-otel-trace-id', 'mock-trace-id-123');
      expect(res.setHeader).toHaveBeenCalledWith('x-otel-span-id', 'mock-span-id-456');
      expect(res.setHeader).toHaveBeenCalledWith('x-request-id', expect.any(String));
    });

    it('should not set correlation headers when disabled', () => {
      const middleware = otelCorrelationMiddleware({ includeInResponse: false });
      
      middleware(req as Request, res as Response, next);
      
      expect(res.setHeader).not.toHaveBeenCalled();
    });
  });

  describe('Request Logging', () => {
    it('should log request start and end when enabled', () => {
      const middleware = otelCorrelationMiddleware({ 
        logRequests: true,
        enableOTEL: true,
      });
      
      middleware(req as Request, res as Response, next);
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'HTTP request started',
        expect.objectContaining({
          method: 'GET',
          url: '/test',
          event: 'http.request.start',
          'otel.enabled': true,
          'otel.span.active': true,
        })
      );
      
      // Simulate response end
      const endFunction = res.end as jest.Mock;
      endFunction.call(res);
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'HTTP request completed',
        expect.objectContaining({
          method: 'GET',
          url: '/test',
          event: 'http.request.end',
          statusCode: 200,
          duration: expect.any(Number),
          performance: expect.any(String),
        })
      );
    });

    it('should not log requests when disabled', () => {
      const middleware = otelCorrelationMiddleware({ logRequests: false });
      
      middleware(req as Request, res as Response, next);
      
      expect(mockLogger.info).not.toHaveBeenCalled();
    });
  });

  describe('OTEL Integration', () => {
    it('should set OTEL span attributes', () => {
      const middleware = otelCorrelationMiddleware({ enableOTEL: true });
      
      middleware(req as Request, res as Response, next);
      
      expect(mockSpan.setAttributes).toHaveBeenCalledWith(
        expect.objectContaining({
          'http.method': 'GET',
          'http.url': '/test',
          'http.client_ip': '127.0.0.1',
          'fortium.service.name': 'monitoring-web-service',
        })
      );
    });

    it('should add OTEL span events', () => {
      const middleware = otelCorrelationMiddleware({ 
        enableOTEL: true,
        logRequests: true,
      });
      
      middleware(req as Request, res as Response, next);
      
      expect(mockSpan.addEvent).toHaveBeenCalledWith(
        'http.request.start',
        expect.objectContaining({
          'http.method': 'GET',
          'http.url': '/test',
        })
      );
    });

    it('should set span status on response end', () => {
      const middleware = otelCorrelationMiddleware({ enableOTEL: true });
      
      middleware(req as Request, res as Response, next);
      
      // Simulate response end
      res.statusCode = 200;
      const endFunction = res.end as jest.Mock;
      endFunction.call(res);
      
      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: api.SpanStatusCode.OK,
      });
      expect(mockSpan.end).toHaveBeenCalled();
    });

    it('should record error in span on request error', () => {
      const middleware = otelCorrelationMiddleware({ enableOTEL: true });
      const error = new Error('Test error');
      
      middleware(req as Request, res as Response, next);
      
      // Simulate error
      next(error);
      
      expect(mockSpan.recordException).toHaveBeenCalledWith(error);
      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: api.SpanStatusCode.ERROR,
        message: 'Test error',
      });
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain existing correlation functions', () => {
      const middleware = otelCorrelationMiddleware();
      
      middleware(req as Request, res as Response, next);
      
      // Test backward compatibility functions
      expect(getCorrelationId(req as Request)).toBe(req.correlationId);
      expect(getLogContext(req as Request)).toBe(req.logContext);
      
      const spanContext = createSpan(req as Request, 'test-operation');
      expect(spanContext).toHaveProperty('operationName', 'test-operation');
      expect(spanContext).toHaveProperty('spanId');
      expect(spanContext).toHaveProperty('traceId');
    });

    it('should support legacy log operation function', () => {
      const middleware = otelCorrelationMiddleware();
      
      middleware(req as Request, res as Response, next);
      
      logOperation(req as Request, 'info', 'Test message', { test: true });
      
      expect(mockLogger.log).toHaveBeenCalledWith(
        'info',
        'Test message',
        expect.objectContaining({
          test: true,
          event: 'operation',
          timestamp: expect.any(String),
        })
      );
    });
  });

  describe('OTEL Utilities', () => {
    beforeEach(() => {
      const middleware = otelCorrelationMiddleware({ enableOTEL: true });
      middleware(req as Request, res as Response, next);
    });

    it('should create OTEL span with attributes', () => {
      const span = createOTELSpan(req as Request, 'test-operation', { custom: 'attribute' });
      
      expect(mockTracer.startSpan).toHaveBeenCalledWith(
        'test-operation',
        expect.objectContaining({
          attributes: expect.objectContaining({
            'operation.name': 'test-operation',
            'service.name': 'fortium-monitoring-service',
            custom: 'attribute',
          }),
        })
      );
    });

    it('should execute operation with OTEL context', async () => {
      const operation = jest.fn().mockResolvedValue('result');
      
      const result = await withOTELContext(req as Request, operation);
      
      expect(mockContext.with).toHaveBeenCalled();
      expect(operation).toHaveBeenCalled();
      expect(result).toBe('result');
    });

    it('should correlate database operations with OTEL', async () => {
      const dbOperation = jest.fn().mockResolvedValue('db-result');
      
      const result = await correlateDbOperationWithOTEL(
        req as Request,
        'select',
        dbOperation
      );
      
      expect(mockTracer.startSpan).toHaveBeenCalledWith(
        'db.select',
        expect.objectContaining({
          attributes: expect.objectContaining({
            'db.operation': 'select',
            'db.system': 'postgresql',
          }),
        })
      );
      expect(dbOperation).toHaveBeenCalled();
      expect(result).toBe('db-result');
    });

    it('should correlate API calls with OTEL', async () => {
      const apiCall = jest.fn().mockResolvedValue('api-result');
      
      const result = await correlateApiCallWithOTEL(
        req as Request,
        'external-service',
        '/api/endpoint',
        apiCall
      );
      
      expect(mockTracer.startSpan).toHaveBeenCalledWith(
        'api.external-service',
        expect.objectContaining({
          attributes: expect.objectContaining({
            'http.client.service': 'external-service',
            'http.client.endpoint': '/api/endpoint',
          }),
        })
      );
      expect(apiCall).toHaveBeenCalled();
      expect(result).toBe('api-result');
    });
  });

  describe('Performance Tracking Decorator', () => {
    it('should track synchronous method performance', () => {
      class TestClass {
        @trackPerformanceWithOTEL
        syncMethod(req: Request): string {
          return 'sync-result';
        }
      }
      
      const middleware = otelCorrelationMiddleware({ enableOTEL: true });
      middleware(req as Request, res as Response, next);
      
      const instance = new TestClass();
      const result = instance.syncMethod(req as Request);
      
      expect(result).toBe('sync-result');
      expect(mockTracer.startSpan).toHaveBeenCalledWith(
        'TestClass.syncMethod',
        expect.objectContaining({
          attributes: expect.objectContaining({
            'code.function': 'syncMethod',
            'code.namespace': 'TestClass',
          }),
        })
      );
    });

    it('should track asynchronous method performance', async () => {
      class TestClass {
        @trackPerformanceWithOTEL
        async asyncMethod(req: Request): Promise<string> {
          return 'async-result';
        }
      }
      
      const middleware = otelCorrelationMiddleware({ enableOTEL: true });
      middleware(req as Request, res as Response, next);
      
      const instance = new TestClass();
      const result = await instance.asyncMethod(req as Request);
      
      expect(result).toBe('async-result');
      expect(mockTracer.startSpan).toHaveBeenCalled();
    });
  });

  describe('Migration Support', () => {
    it('should create migration middleware with feature flag', () => {
      const migrationMiddleware = createMigrationMiddleware(false);
      
      expect(migrationMiddleware).toBeInstanceOf(Function);
      
      migrationMiddleware(req as Request, res as Response, next);
      
      // Should use legacy correlation ID format when OTEL is disabled
      expect(req.correlationId).toMatch(/^corr_\d+_/);
    });

    it('should create migration middleware with OTEL enabled', () => {
      const migrationMiddleware = createMigrationMiddleware(true);
      
      migrationMiddleware(req as Request, res as Response, next);
      
      // Should use OTEL trace ID as correlation ID
      expect(req.correlationId).toBe('mock-trace-id-123');
    });
  });

  describe('Predefined Middleware Configurations', () => {
    it('should provide default OTEL correlation middleware', () => {
      expect(defaultOTELCorrelationMiddleware).toBeInstanceOf(Function);
      
      defaultOTELCorrelationMiddleware(req as Request, res as Response, next);
      
      expect(req.correlationId).toBe('mock-trace-id-123');
      expect(next).toHaveBeenCalled();
    });

    it('should provide light OTEL correlation middleware', () => {
      expect(lightOTELCorrelationMiddleware).toBeInstanceOf(Function);
      
      lightOTELCorrelationMiddleware(req as Request, res as Response, next);
      
      expect(req.correlationId).toBe('mock-trace-id-123');
      expect(mockLogger.info).not.toHaveBeenCalled(); // Should not log requests
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle OTEL span creation errors gracefully', () => {
      // Mock OTEL to return null span
      (api.trace.getActiveSpan as jest.Mock).mockReturnValue(null);
      
      const middleware = otelCorrelationMiddleware({ enableOTEL: true });
      
      expect(() => {
        middleware(req as Request, res as Response, next);
      }).not.toThrow();
      
      expect(req.correlationId).toMatch(/^corr_\d+_/); // Should fallback to custom ID
      expect(next).toHaveBeenCalled();
    });

    it('should handle response end errors gracefully', () => {
      const middleware = otelCorrelationMiddleware({ enableOTEL: true });
      
      middleware(req as Request, res as Response, next);
      
      // Mock span.end to throw
      mockSpan.end.mockImplementation(() => {
        throw new Error('Span end error');
      });
      
      expect(() => {
        const endFunction = res.end as jest.Mock;
        endFunction.call(res);
      }).not.toThrow();
    });
  });

  describe('Custom Headers Propagation', () => {
    it('should propagate custom headers as OTEL baggage when enabled', () => {
      req.headers = {
        'x-session-id': 'session-123',
        'x-tenant-id': 'tenant-456',
      };
      
      const middleware = otelCorrelationMiddleware({
        enableOTEL: true,
        propagateCustomHeaders: true,
      });
      
      middleware(req as Request, res as Response, next);
      
      expect(mockPropagation.setBaggage).toHaveBeenCalled();
    });

    it('should not propagate custom headers when disabled', () => {
      req.headers = {
        'x-session-id': 'session-123',
      };
      
      const middleware = otelCorrelationMiddleware({
        enableOTEL: true,
        propagateCustomHeaders: false,
      });
      
      middleware(req as Request, res as Response, next);
      
      expect(mockPropagation.setBaggage).not.toHaveBeenCalled();
    });
  });
});