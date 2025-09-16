/**
 * OTEL Structured Logging Integration Tests
 * Sprint 3: Task 3.2 - Integration Testing
 * 
 * Tests integration of OTEL structured logging with existing middleware,
 * correlation system, and SignOz export functionality.
 */

import express from 'express';
import request from 'supertest';
import * as api from '@opentelemetry/api';
import { logger, loggers, createContextualLogger } from '../../config/logger';
import { otelCorrelationMiddleware } from '../../middleware/otel-correlation.middleware';

// Mock OTEL API for controlled testing
jest.mock('@opentelemetry/api');
const mockApi = api as jest.Mocked<typeof api>;

describe('OTEL Structured Logging Integration', () => {
  let app: express.Application;
  let mockSpan: jest.Mocked<api.Span>;
  let mockSpanContext: api.SpanContext;
  let capturedLogs: any[] = [];

  beforeEach(() => {
    // Setup mock span context
    mockSpanContext = {
      traceId: 'integration-trace-id-123456789',
      spanId: 'integration-span-id-abcdef',
      traceFlags: 1,
      isRemote: false,
    };

    // Setup mock span
    mockSpan = {
      spanContext: jest.fn(() => mockSpanContext),
      isRecording: jest.fn(() => true),
      addEvent: jest.fn(),
      setAttributes: jest.fn(),
      recordException: jest.fn(),
      setStatus: jest.fn(),
      end: jest.fn(),
    } as any;

    // Mock API functions
    mockApi.trace = {
      getActiveSpan: jest.fn(() => mockSpan),
      getTracer: jest.fn(() => ({
        startSpan: jest.fn(() => mockSpan),
      })),
    } as any;

    mockApi.context = {
      active: jest.fn(() => ({} as api.Context)),
      with: jest.fn().mockImplementation((ctx, fn) => fn()),
    } as any;

    mockApi.propagation = {
      getBaggage: jest.fn(() => null),
      setBaggage: jest.fn(),
      createBaggage: jest.fn(),
    } as any;

    // Capture log calls
    capturedLogs = [];
    jest.spyOn(logger, 'info').mockImplementation((infoOrMessage: any, meta?: any) => {
      if (typeof infoOrMessage === 'string') {
        capturedLogs.push({ level: 'info', message: infoOrMessage, meta });
      } else {
        capturedLogs.push({ level: 'info', message: infoOrMessage.message || '', meta: infoOrMessage });
      }
      return logger as any;
    });
    jest.spyOn(logger, 'warn').mockImplementation((infoOrMessage: any, meta?: any) => {
      if (typeof infoOrMessage === 'string') {
        capturedLogs.push({ level: 'warn', message: infoOrMessage, meta });
      } else {
        capturedLogs.push({ level: 'warn', message: infoOrMessage.message || '', meta: infoOrMessage });
      }
      return logger as any;
    });
    jest.spyOn(logger, 'error').mockImplementation((infoOrMessage: any, meta?: any) => {
      if (typeof infoOrMessage === 'string') {
        capturedLogs.push({ level: 'error', message: infoOrMessage, meta });
      } else {
        capturedLogs.push({ level: 'error', message: infoOrMessage.message || '', meta: infoOrMessage });
      }
      return logger as any;
    });

    // Setup Express app with OTEL correlation middleware
    app = express();
    app.use(express.json());
    app.use(otelCorrelationMiddleware({
      enableOTEL: true,
      logRequests: true,
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
    capturedLogs = [];
  });

  describe('Request-Response Cycle Integration', () => {
    it('should correlate logs across the entire request lifecycle', async () => {
      // Setup test endpoint
      app.get('/test-endpoint', (req, res) => {
        // Use enhanced logging in endpoint
        loggers.api.request('GET', '/test-endpoint', 'user123', 'tenant456', {
          correlationId: req.correlationId,
          userAgent: req.headers['user-agent'],
        });

        // Simulate business logic with contextual logger
        const contextualLogger = createContextualLogger({
          userId: 'user123',
          tenantId: 'tenant456',
          correlationId: req.correlationId,
          operationName: 'test-operation',
        });
        
        contextualLogger.info('Processing business logic', {
          step: 'validation',
          processingTime: 50,
        });

        res.json({ success: true, traceId: req.traceId });
      });

      // Make request
      const response = await request(app)
        .get('/test-endpoint')
        .set('User-Agent', 'Test-Agent/1.0')
        .set('x-correlation-id', 'custom-correlation-123')
        .expect(200);

      // Verify response includes trace information
      expect(response.body.traceId).toBe('integration-trace-id-123456789');

      // Analyze captured logs
      expect(capturedLogs.length).toBeGreaterThan(0);

      // Find the API request log
      const apiLog = capturedLogs.find(log => 
        log.message === 'API request' && log.meta.event === 'api.request'
      );
      expect(apiLog).toBeDefined();
      expect(apiLog.meta).toMatchObject({
        // Legacy fields preserved
        method: 'GET',
        path: '/test-endpoint',
        userId: 'user123',
        tenantId: 'tenant456',
        
        // OTEL semantic conventions
        'http.method': 'GET',
        'http.route': '/test-endpoint',
        'http.user_agent': 'Test-Agent/1.0',
        'event.domain': 'http',
        'event.name': 'request',
        'enduser.id': 'user123',
        'fortium.tenant.id': 'tenant456',
        
        // OTEL trace correlation
        'trace.trace_id': 'integration-trace-id-123456789',
        'trace.span_id': 'integration-span-id-abcdef',
      });

      // Find the business logic log
      const businessLog = capturedLogs.find(log => 
        log.message === 'Processing business logic'
      );
      expect(businessLog).toBeDefined();
      expect(businessLog.meta).toMatchObject({
        // Business context
        step: 'validation',
        processingTime: 50,
        
        // OTEL correlation should be present
        'trace.trace_id': 'integration-trace-id-123456789',
        'trace.span_id': 'integration-span-id-abcdef',
        
        // Service attributes
        'service.name': expect.any(String),
        'service.version': expect.any(String),
      });
    });

    it('should handle authentication flows with OTEL correlation', async () => {
      // Setup auth endpoint
      app.post('/auth/login', (req, res) => {
        const { email, password } = req.body;
        
        if (email === 'user@example.com' && password === 'correct') {
          loggers.auth.login('user123', 'tenant456', {
            correlationId: req.correlationId,
            authMethod: 'password',
            clientIp: req.ip,
            userAgent: req.headers['user-agent'],
          });
          res.json({ success: true, userId: 'user123' });
        } else {
          loggers.auth.loginFailed(email, 'Invalid credentials', {
            correlationId: req.correlationId,
            attempts: 1,
            clientIp: req.ip,
          });
          res.status(401).json({ error: 'Invalid credentials' });
        }
      });

      // Test successful login
      await request(app)
        .post('/auth/login')
        .send({ email: 'user@example.com', password: 'correct' })
        .expect(200);

      // Verify auth success log
      const loginLog = capturedLogs.find(log => 
        log.message === 'User login successful'
      );
      expect(loginLog).toBeDefined();
      expect(loginLog.meta).toMatchObject({
        'event.domain': 'authentication',
        'event.name': 'login',
        'event.outcome': 'success',
        'enduser.id': 'user123',
        'auth.method': 'password',
        'trace.trace_id': 'integration-trace-id-123456789',
      });

      // Test failed login
      capturedLogs.length = 0; // Clear logs
      await request(app)
        .post('/auth/login')
        .send({ email: 'user@example.com', password: 'wrong' })
        .expect(401);

      // Verify auth failure log
      const failureLog = capturedLogs.find(log => 
        log.message === 'User login failed'
      );
      expect(failureLog).toBeDefined();
      expect(failureLog.meta).toMatchObject({
        'event.domain': 'authentication',
        'event.name': 'login',
        'event.outcome': 'failure',
        'error.type': 'AuthenticationError',
        'error.message': 'Invalid credentials',
        'trace.trace_id': 'integration-trace-id-123456789',
      });
    });

    it('should correlate database operations with HTTP requests', async () => {
      // Setup endpoint that simulates database operations
      app.get('/users/:id', async (req, res) => {
        const { id } = req.params;
        
        try {
          // Simulate database query
          const query = 'SELECT * FROM users WHERE id = $1';
          const startTime = Date.now();
          
          // Simulate query execution time
          await new Promise(resolve => setTimeout(resolve, 100));
          const duration = Date.now() - startTime;
          
          loggers.database.query(query, duration, {
            correlationId: req.correlationId,
            operation: 'SELECT',
            rowsReturned: 1,
            dbSystem: 'postgresql',
          });

          res.json({ id, name: 'Test User' });
        } catch (error) {
          loggers.database.error(error as Error, 'SELECT * FROM users WHERE id = $1', {
            correlationId: req.correlationId,
          });
          res.status(500).json({ error: 'Database error' });
        }
      });

      // Make request
      await request(app)
        .get('/users/123')
        .expect(200);

      // Verify database log correlation
      const dbLog = capturedLogs.find(log => 
        log.message === 'Database query' && log.meta.event === 'database.query'
      );
      expect(dbLog).toBeDefined();
      expect(dbLog.meta).toMatchObject({
        // Database operation details
        'db.system': 'postgresql',
        'db.statement': 'SELECT * FROM users WHERE id = $1',
        'db.operation': 'SELECT',
        'performance.duration_ms': expect.any(Number),
        'performance.category': expect.any(String),
        
        // OTEL correlation
        'trace.trace_id': 'integration-trace-id-123456789',
        'trace.span_id': 'integration-span-id-abcdef',
        
        // Event classification
        'event.domain': 'database',
        'event.name': 'query',
        'event.outcome': 'success',
      });
    });

    it('should handle error scenarios with proper OTEL correlation', async () => {
      // Setup endpoint that throws an error
      app.get('/error-test', (req, res) => {
        const error = new Error('Simulated error');
        
        loggers.api.error('GET', '/error-test', error, 'user123', 'tenant456', {
          correlationId: req.correlationId,
          statusCode: 500,
          duration: 50,
        });

        res.status(500).json({ error: 'Internal server error' });
      });

      // Make request
      await request(app)
        .get('/error-test')
        .expect(500);

      // Verify error log correlation
      const errorLog = capturedLogs.find(log => 
        log.message === 'API error' && log.meta.event === 'api.error'
      );
      expect(errorLog).toBeDefined();
      expect(errorLog.meta).toMatchObject({
        // Error details
        'error.type': 'Error',
        'error.message': 'Simulated error',
        'exception.type': 'Error',
        'exception.message': 'Simulated error',
        
        // HTTP context
        'http.method': 'GET',
        'http.route': '/error-test',
        'http.status_code': 500,
        
        // OTEL correlation
        'trace.trace_id': 'integration-trace-id-123456789',
        'trace.span_id': 'integration-span-id-abcdef',
        
        // Event classification
        'event.domain': 'http',
        'event.name': 'error',
        'event.outcome': 'failure',
      });
    });
  });

  describe('Performance Impact Validation', () => {
    it('should maintain acceptable performance with OTEL logging', async () => {
      // Setup performance test endpoint
      app.get('/perf-test', (req, res) => {
        // Multiple logging operations
        loggers.api.request('GET', '/perf-test', 'user123', 'tenant456');
        
        for (let i = 0; i < 10; i++) {
          const contextualLogger = createContextualLogger({
            userId: 'user123',
            operationName: `step-${i}`,
          });
          contextualLogger.info(`Processing step ${i}`);
        }
        
        loggers.performance.slowRequest('GET', '/perf-test', 1500);
        
        res.json({ success: true });
      });

      // Measure performance
      const iterations = 50;
      const startTime = Date.now();
      
      for (let i = 0; i < iterations; i++) {
        await request(app)
          .get('/perf-test')
          .expect(200);
      }
      
      const totalDuration = Date.now() - startTime;
      const avgDuration = totalDuration / iterations;

      // Should maintain reasonable performance
      expect(avgDuration).toBeLessThan(100); // Less than 100ms per request on average
      expect(capturedLogs.length).toBeGreaterThan(iterations * 10); // Multiple logs per request
    });

    it('should handle high-frequency logging without degradation', async () => {
      // Setup high-frequency logging endpoint
      app.get('/high-freq', (req, res) => {
        const startTime = Date.now();
        
        // Generate many log entries
        for (let i = 0; i < 100; i++) {
          loggers.database.query(`SELECT ${i}`, Math.random() * 10, {
            correlationId: req.correlationId,
            operation: 'SELECT',
          });
        }
        
        const duration = Date.now() - startTime;
        res.json({ logsGenerated: 100, duration });
      });

      // Test high-frequency logging
      const response = await request(app)
        .get('/high-freq')
        .expect(200);

      // Verify performance is acceptable
      expect(response.body.duration).toBeLessThan(500); // Less than 500ms for 100 logs
      
      // Verify all logs have proper OTEL correlation
      const dbLogs = capturedLogs.filter(log => 
        log.message === 'Database query' && log.meta['trace.trace_id']
      );
      expect(dbLogs.length).toBe(100);
      
      // All logs should have the same trace ID
      dbLogs.forEach(log => {
        expect(log.meta['trace.trace_id']).toBe('integration-trace-id-123456789');
      });
    });
  });

  describe('Backward Compatibility Validation', () => {
    it('should work with existing middleware stack', async () => {
      // Setup endpoint using traditional logging
      app.get('/legacy-endpoint', (req, res) => {
        // Traditional logging should still work
        logger.info('Legacy log message', {
          correlationId: req.correlationId,
          userId: 'user123',
        });

        // Traditional helper usage
        loggers.auth.login('user123', 'tenant456');
        
        res.json({ message: 'Legacy endpoint works' });
      });

      // Make request
      await request(app)
        .get('/legacy-endpoint')
        .expect(200);

      // Verify both traditional and enhanced logs work
      const legacyLog = capturedLogs.find(log => 
        log.message === 'Legacy log message'
      );
      expect(legacyLog).toBeDefined();
      expect(legacyLog.meta.correlationId).toBeDefined();
      
      const authLog = capturedLogs.find(log => 
        log.message === 'User login successful'
      );
      expect(authLog).toBeDefined();
      expect(authLog.meta['trace.trace_id']).toBe('integration-trace-id-123456789');
    });
  });
});