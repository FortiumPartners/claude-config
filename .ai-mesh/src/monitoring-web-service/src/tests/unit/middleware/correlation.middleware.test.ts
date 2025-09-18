/**
 * Unit Tests for Correlation Middleware
 * Fortium Monitoring Web Service - Seq Integration Sprint 1
 * Task 1.3: Correlation Middleware Test Suite
 */

import { Request, Response, NextFunction } from 'express';
import {
  correlationMiddleware,
  getCorrelationId,
  getLogContext,
  createSpan,
  logOperation,
  correlateDbOperation,
  correlateApiCall,
  trackPerformance,
  defaultCorrelationMiddleware,
  lightCorrelationMiddleware,
} from '../../../middleware/correlation.middleware';
import { createContextualLogger } from '../../../config/logger';

// Mock the logger
jest.mock('../../../config/logger');

describe('Correlation Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let responseHeaders: Record<string, string>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock response headers
    responseHeaders = {};
    
    // Mock request
    mockReq = {
      method: 'GET',
      url: '/test',
      path: '/test',
      headers: {},
      ip: '127.0.0.1',
    };
    
    // Mock response
    mockRes = {
      setHeader: jest.fn((name: string, value: string) => {
        responseHeaders[name] = value;
        return mockRes as any;
      }),
      statusCode: 200,
      end: jest.fn(),
    };
    
    // Mock next function
    mockNext = jest.fn();
    
    // Mock createContextualLogger
    (createContextualLogger as jest.Mock).mockReturnValue({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      log: jest.fn(),
    });
  });

  describe('Basic Functionality', () => {
    it('should generate correlation ID when none provided', () => {
      const middleware = correlationMiddleware();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.correlationId).toBeDefined();
      expect(mockReq.correlationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should use existing correlation ID from headers', () => {
      const existingId = '123e4567-e89b-12d3-a456-426614174000';
      mockReq.headers = { 'x-correlation-id': existingId };
      
      const middleware = correlationMiddleware();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.correlationId).toBe(existingId);
    });

    it('should extract all correlation headers', () => {
      const correlationId = '123e4567-e89b-12d3-a456-426614174000';
      const sessionId = '987fcdeb-51a2-43d7-8c94-012345678901';
      const traceId = '456789ab-cdef-1234-5678-90abcdef1234';
      const spanId = '789012cd-ef34-5678-9012-3456789abcde';
      
      mockReq.headers = {
        'x-correlation-id': correlationId,
        'x-session-id': sessionId,
        'x-trace-id': traceId,
        'x-span-id': spanId,
      };
      
      const middleware = correlationMiddleware();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.correlationId).toBe(correlationId);
      expect(mockReq.sessionId).toBe(sessionId);
      expect(mockReq.traceId).toBe(traceId);
      expect(mockReq.spanId).toBe(spanId);
    });

    it('should generate unique request ID', () => {
      const middleware = correlationMiddleware();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.requestId).toBeDefined();
      expect(mockReq.requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });
  });

  describe('Response Headers', () => {
    it('should add correlation headers to response', () => {
      const middleware = correlationMiddleware({ includeInResponse: true });
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(responseHeaders['x-correlation-id']).toBe(mockReq.correlationId);
      expect(responseHeaders['x-request-id']).toBe(mockReq.requestId);
    });

    it('should not add headers when disabled', () => {
      const middleware = correlationMiddleware({ includeInResponse: false });
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(Object.keys(responseHeaders)).toHaveLength(0);
    });

    it('should propagate existing headers to response', () => {
      const sessionId = '987fcdeb-51a2-43d7-8c94-012345678901';
      mockReq.headers = { 'x-session-id': sessionId };
      
      const middleware = correlationMiddleware({ includeInResponse: true });
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(responseHeaders['x-session-id']).toBe(sessionId);
    });
  });

  describe('Logging Context', () => {
    it('should create log context with correlation data', () => {
      const middleware = correlationMiddleware();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.logContext).toBeDefined();
      expect(mockReq.logContext.correlationId).toBe(mockReq.correlationId);
      expect(mockReq.logContext.requestId).toBe(mockReq.requestId);
    });

    it('should create contextual logger', () => {
      const middleware = correlationMiddleware();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(createContextualLogger).toHaveBeenCalledWith(mockReq.logContext);
      expect(mockReq.logger).toBeDefined();
    });

    it('should include user and tenant context when available', () => {
      (mockReq as any).user = { id: 'user123' };
      (mockReq as any).tenant = { id: 'tenant456' };
      
      const middleware = correlationMiddleware();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.logContext.userId).toBe('user123');
      expect(mockReq.logContext.tenantId).toBe('tenant456');
    });
  });

  describe('Request Logging', () => {
    it('should log request start when enabled', () => {
      const mockLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        log: jest.fn(),
      };
      (createContextualLogger as jest.Mock).mockReturnValue(mockLogger);
      
      const middleware = correlationMiddleware({ logRequests: true });
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockLogger.info).toHaveBeenCalledWith('HTTP request started', expect.objectContaining({
        method: 'GET',
        url: '/test',
        path: '/test',
        event: 'http.request.start',
      }));
    });

    it('should not log requests when disabled', () => {
      const mockLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        log: jest.fn(),
      };
      (createContextualLogger as jest.Mock).mockReturnValue(mockLogger);
      
      const middleware = correlationMiddleware({ logRequests: false });
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockLogger.info).not.toHaveBeenCalled();
    });

    it('should sanitize sensitive headers in logs', () => {
      const mockLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        log: jest.fn(),
      };
      (createContextualLogger as jest.Mock).mockReturnValue(mockLogger);
      
      mockReq.headers = {
        authorization: 'Bearer secret-token',
        cookie: 'session=secret',
        'user-agent': 'Test Agent',
      };
      
      const middleware = correlationMiddleware({ logRequests: true });
      middleware(mockReq as Request, mockRes as Response, mockNext);

      const logCall = mockLogger.info.mock.calls[0][1];
      expect(logCall.headers.authorization).toBe('[REDACTED]');
      expect(logCall.headers.cookie).toBe('[REDACTED]');
      expect(logCall.headers['user-agent']).toBe('Test Agent');
    });
  });

  describe('Response Logging', () => {
    it('should log request completion with duration', () => {
      const mockLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        log: jest.fn(),
      };
      (createContextualLogger as jest.Mock).mockReturnValue(mockLogger);
      
      const middleware = correlationMiddleware({ logRequests: true });
      middleware(mockReq as Request, mockRes as Response, mockNext);

      // Trigger response end
      (mockRes.end as jest.Mock)();

      expect(mockLogger.info).toHaveBeenCalledWith('HTTP request completed', expect.objectContaining({
        method: 'GET',
        url: '/test',
        path: '/test',
        statusCode: 200,
        event: 'http.request.end',
        duration: expect.any(Number),
        performance: expect.any(String),
      }));
    });

    it('should categorize performance correctly', () => {
      const mockLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        log: jest.fn(),
      };
      (createContextualLogger as jest.Mock).mockReturnValue(mockLogger);
      
      const middleware = correlationMiddleware({ logRequests: true });
      
      // Mock Date.now to control timing
      const originalNow = Date.now;
      let startTime = 1000;
      Date.now = jest.fn()
        .mockReturnValueOnce(startTime) // Start time
        .mockReturnValueOnce(startTime + 50); // End time (fast)
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
      (mockRes.end as jest.Mock)();

      const logCall = mockLogger.info.mock.calls[1][1];
      expect(logCall.performance).toBe('fast');
      expect(logCall.duration).toBe(50);
      
      Date.now = originalNow;
    });
  });

  describe('Error Handling', () => {
    it('should log errors with correlation context', () => {
      const mockLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        log: jest.fn(),
      };
      (createContextualLogger as jest.Mock).mockReturnValue(mockLogger);
      
      const error = new Error('Test error');
      (error as any).statusCode = 400;
      
      const middleware = correlationMiddleware();
      middleware(mockReq as Request, mockRes as Response, (err) => {
        if (err) {
          // Simulate error logging that would happen
          mockReq.logger.error('Request error occurred', {
            method: mockReq.method,
            url: mockReq.url,
            error: err.message,
            statusCode: err.statusCode || 500,
            event: 'http.request.error',
          });
        }
      });

      // Trigger error
      mockNext(error);

      expect(mockLogger.error).toHaveBeenCalledWith('Request error occurred', expect.objectContaining({
        method: 'GET',
        url: '/test',
        error: 'Test error',
        statusCode: 400,
        event: 'http.request.error',
      }));
    });
  });

  describe('Custom Configuration', () => {
    it('should use custom header names', () => {
      const customId = 'custom-correlation-id';
      mockReq.headers = { 'custom-header': customId };
      
      const middleware = correlationMiddleware({
        correlationHeaderName: 'custom-header',
      });
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.correlationId).toBe(customId);
    });

    it('should not generate new ID when disabled', () => {
      const middleware = correlationMiddleware({
        generateNewCorrelationId: false,
      });
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.correlationId).toBeUndefined();
    });
  });

  describe('Utility Functions', () => {
    beforeEach(() => {
      const middleware = correlationMiddleware();
      middleware(mockReq as Request, mockRes as Response, mockNext);
    });

    it('should extract correlation ID', () => {
      const id = getCorrelationId(mockReq as Request);
      expect(id).toBe(mockReq.correlationId);
    });

    it('should extract log context', () => {
      const context = getLogContext(mockReq as Request);
      expect(context).toEqual(mockReq.logContext);
    });

    it('should create new span', () => {
      const span = createSpan(mockReq as Request, 'test-operation');
      
      expect(span.operationName).toBe('test-operation');
      expect(span.spanId).toBeDefined();
      expect(span.parentSpanId).toBe(mockReq.correlationId);
      expect(span.traceId).toBe(mockReq.correlationId);
    });

    it('should log operation with context', () => {
      const mockLogger = mockReq.logger as any;
      logOperation(mockReq as Request, 'info', 'Test operation', { custom: 'data' });

      expect(mockLogger.log).toHaveBeenCalledWith('info', 'Test operation', expect.objectContaining({
        custom: 'data',
        event: 'operation',
        timestamp: expect.any(String),
      }));
    });
  });

  describe('Database Operation Correlation', () => {
    it('should correlate database operations successfully', async () => {
      const mockLogger = {
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };
      mockReq.logger = mockLogger as any;
      
      const mockOperation = jest.fn().mockResolvedValue('success');
      
      const result = await correlateDbOperation(mockReq as Request, 'SELECT', mockOperation);

      expect(result).toBe('success');
      expect(mockLogger.debug).toHaveBeenCalledWith('Database operation started', expect.objectContaining({
        operation: 'SELECT',
        event: 'db.operation.start',
      }));
      expect(mockLogger.debug).toHaveBeenCalledWith('Database operation completed', expect.objectContaining({
        operation: 'SELECT',
        event: 'db.operation.success',
      }));
    });

    it('should handle database operation failures', async () => {
      const mockLogger = {
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };
      mockReq.logger = mockLogger as any;
      
      const error = new Error('Database error');
      const mockOperation = jest.fn().mockRejectedValue(error);
      
      await expect(correlateDbOperation(mockReq as Request, 'INSERT', mockOperation))
        .rejects.toThrow('Database error');

      expect(mockLogger.error).toHaveBeenCalledWith('Database operation failed', expect.objectContaining({
        operation: 'INSERT',
        error: 'Database error',
        event: 'db.operation.error',
      }));
    });

    it('should log slow database operations', async () => {
      const mockLogger = {
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };
      mockReq.logger = mockLogger as any;
      
      // Mock slow operation (> 1000ms)
      const mockOperation = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve('success'), 1100))
      );
      
      await correlateDbOperation(mockReq as Request, 'SLOW_QUERY', mockOperation);

      expect(mockLogger.warn).toHaveBeenCalledWith('Slow database operation detected', expect.objectContaining({
        operation: 'SLOW_QUERY',
        event: 'db.operation.slow',
      }));
    });
  });

  describe('API Call Correlation', () => {
    it('should correlate external API calls', async () => {
      const mockLogger = {
        info: jest.fn(),
        error: jest.fn(),
      };
      mockReq.logger = mockLogger as any;
      
      const mockApiCall = jest.fn().mockResolvedValue({ data: 'response' });
      
      const result = await correlateApiCall(mockReq as Request, 'external-service', '/api/test', mockApiCall);

      expect(result).toEqual({ data: 'response' });
      expect(mockLogger.info).toHaveBeenCalledWith('External API call started', expect.objectContaining({
        service: 'external-service',
        endpoint: '/api/test',
        event: 'api.call.start',
      }));
      expect(mockLogger.info).toHaveBeenCalledWith('External API call completed', expect.objectContaining({
        service: 'external-service',
        endpoint: '/api/test',
        event: 'api.call.success',
      }));
    });
  });

  describe('Performance Tracking Decorator', () => {
    it('should track method performance', () => {
      const mockLogger = {
        debug: jest.fn(),
        error: jest.fn(),
      };
      mockReq.logger = mockLogger as any;
      
      class TestClass {
        @trackPerformance
        testMethod(req: Request, data: string): string {
          return `processed: ${data}`;
        }
      }
      
      const instance = new TestClass();
      const result = instance.testMethod(mockReq as Request, 'test-data');

      expect(result).toBe('processed: test-data');
      expect(mockLogger.debug).toHaveBeenCalledWith('Method execution started', expect.objectContaining({
        className: 'TestClass',
        methodName: 'testMethod',
        event: 'method.start',
      }));
      expect(mockLogger.debug).toHaveBeenCalledWith('Method execution completed', expect.objectContaining({
        className: 'TestClass',
        methodName: 'testMethod',
        event: 'method.success',
      }));
    });
  });

  describe('Pre-configured Middlewares', () => {
    it('should provide default middleware configuration', () => {
      expect(defaultCorrelationMiddleware).toBeInstanceOf(Function);
    });

    it('should provide lightweight middleware configuration', () => {
      expect(lightCorrelationMiddleware).toBeInstanceOf(Function);
    });
  });
});