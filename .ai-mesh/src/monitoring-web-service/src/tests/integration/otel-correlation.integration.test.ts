/**
 * OpenTelemetry Correlation Integration Tests
 * Fortium Monitoring Web Service - Sprint 2: OpenTelemetry Migration
 * Task 2.4: Correlation Middleware Replacement with OTEL Context
 * 
 * Integration tests to validate complete OTEL correlation functionality
 */

import request from 'supertest';
import express from 'express';
import * as api from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { otelCorrelationMiddleware } from '../../middleware/otel-correlation.middleware';
import { createMigrationMiddleware } from '../../utils/otel-migration';

// Mock OTEL SDK initialization for testing
const mockSdk = {
  start: jest.fn(),
  shutdown: jest.fn(),
};

jest.mock('@opentelemetry/sdk-node', () => ({
  NodeSDK: jest.fn(() => mockSdk),
}));

// Create test traces and spans
const createMockTracer = () => {
  const spans: any[] = [];
  
  const mockSpan = {
    spanContext: () => ({
      traceId: 'test-trace-id-123456789',
      spanId: 'test-span-id-987654321',
      traceFlags: 1,
    }),
    setAttributes: jest.fn(),
    setStatus: jest.fn(),
    addEvent: jest.fn(),
    recordException: jest.fn(),
    end: jest.fn(),
    isRecording: () => true,
  };
  
  const mockTracer = {
    startSpan: jest.fn(() => {
      spans.push(mockSpan);
      return mockSpan;
    }),
    startActiveSpan: jest.fn((name, options, callback) => {
      spans.push(mockSpan);
      return callback(mockSpan);
    }),
  };
  
  return { mockTracer, mockSpan, spans };
};

describe('OTEL Correlation Integration Tests', () => {
  let app: express.Application;
  let { mockTracer, mockSpan, spans } = createMockTracer();

  beforeEach(() => {
    app = express();
    
    // Reset mocks
    jest.clearAllMocks();
    ({ mockTracer, mockSpan, spans } = createMockTracer());
    
    // Mock OTEL API
    (api.trace.getActiveSpan as jest.Mock) = jest.fn(() => mockSpan);
    (api.trace.getTracer as jest.Mock) = jest.fn(() => mockTracer);
    (api.context.active as jest.Mock) = jest.fn(() => ({}));
    (api.context.with as jest.Mock) = jest.fn((ctx, callback) => callback());
  });

  describe('OTEL Correlation Middleware Integration', () => {
    beforeEach(() => {
      app.use(otelCorrelationMiddleware({
        enableOTEL: true,
        logRequests: true,
        includeInResponse: true,
      }));
      
      app.get('/test', (req, res) => {
        res.json({
          correlationId: req.correlationId,
          traceId: req.traceId,
          spanId: req.spanId,
          requestId: req.requestId,
          hasOtelSpan: !!req.otelSpan,
          hasLogger: !!req.logger,
        });
      });
      
      app.post('/api/data', (req, res) => {
        req.logger.info('Processing data request', { body: req.body });
        res.json({ success: true, correlationId: req.correlationId });
      });
      
      app.get('/error', (req, res, next) => {
        const error = new Error('Test error');
        next(error);
      });
      
      app.use((error: any, req: any, res: any, next: any) => {
        res.status(500).json({ error: error.message, correlationId: req.correlationId });
      });
    });

    it('should set correlation context with OTEL trace IDs', async () => {
      const response = await request(app)
        .get('/test')
        .expect(200);

      expect(response.body).toMatchObject({
        correlationId: 'test-trace-id-123456789',
        traceId: 'test-trace-id-123456789',
        spanId: 'test-span-id-987654321',
        hasOtelSpan: true,
        hasLogger: true,
      });
      
      expect(response.body.requestId).toMatch(/^req_\d+_/);
    });

    it('should include correlation headers in response', async () => {
      const response = await request(app)
        .get('/test')
        .expect(200);

      expect(response.headers['x-correlation-id']).toBe('test-trace-id-123456789');
      expect(response.headers['x-trace-id']).toBe('test-trace-id-123456789');
      expect(response.headers['x-span-id']).toBe('test-span-id-987654321');
      expect(response.headers['x-otel-trace-id']).toBe('test-trace-id-123456789');
      expect(response.headers['x-otel-span-id']).toBe('test-span-id-987654321');
      expect(response.headers['x-request-id']).toMatch(/^req_\d+_/);
    });

    it('should extract existing correlation headers', async () => {
      const response = await request(app)
        .get('/test')
        .set('x-session-id', 'session-12345')
        .set('x-correlation-id', 'existing-correlation-id')
        .expect(200);

      expect(response.headers['x-session-id']).toBe('session-12345');
      // Should use OTEL trace ID over existing correlation ID when OTEL is enabled
      expect(response.body.correlationId).toBe('test-trace-id-123456789');
    });

    it('should set OTEL span attributes for HTTP requests', async () => {
      await request(app)
        .post('/api/data')
        .send({ test: 'data' })
        .set('User-Agent', 'test-agent')
        .expect(200);

      expect(mockSpan.setAttributes).toHaveBeenCalledWith(
        expect.objectContaining({
          'http.method': 'POST',
          'http.url': '/api/data',
          'http.user_agent': 'test-agent',
          'fortium.service.name': 'monitoring-web-service',
        })
      );
    });

    it('should add OTEL span events for request lifecycle', async () => {
      await request(app)
        .get('/test')
        .expect(200);

      expect(mockSpan.addEvent).toHaveBeenCalledWith(
        'http.request.start',
        expect.objectContaining({
          'http.method': 'GET',
          'http.url': '/test',
        })
      );
      
      expect(mockSpan.addEvent).toHaveBeenCalledWith(
        'http.request.end',
        expect.objectContaining({
          'http.status_code': 200,
          'http.response.duration_ms': expect.any(Number),
        })
      );
    });

    it('should set span status on successful requests', async () => {
      await request(app)
        .get('/test')
        .expect(200);

      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: api.SpanStatusCode.OK,
      });
      
      expect(mockSpan.end).toHaveBeenCalled();
    });

    it('should handle errors with OTEL span recording', async () => {
      await request(app)
        .get('/error')
        .expect(500);

      expect(mockSpan.recordException).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Test error',
        })
      );
      
      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: api.SpanStatusCode.ERROR,
        message: 'Test error',
      });
    });

    it('should handle 4xx errors appropriately', async () => {
      app.get('/not-found', (req, res) => {
        res.status(404).json({ error: 'Not found' });
      });

      await request(app)
        .get('/not-found')
        .expect(404);

      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: api.SpanStatusCode.ERROR,
        message: 'HTTP 404',
      });
    });
  });

  describe('Migration Middleware Integration', () => {
    it('should work with migration middleware in OTEL mode', async () => {
      app.use(createMigrationMiddleware({
        enableOTEL: true,
        rolloutPercentage: 100,
        enableMetrics: true,
      }));
      
      app.get('/migration-test', (req, res) => {
        res.json({
          correlationId: req.correlationId,
          migrationMetadata: (req as any).migrationMetadata,
        });
      });

      const response = await request(app)
        .get('/migration-test')
        .expect(200);

      expect(response.body.correlationId).toBe('test-trace-id-123456789');
      expect(response.body.migrationMetadata).toMatchObject({
        useOTEL: true,
      });
    });

    it('should work with migration middleware in legacy mode', async () => {
      // Disable OTEL for this test
      (api.trace.getActiveSpan as jest.Mock).mockReturnValue(null);
      
      app.use(createMigrationMiddleware({
        enableOTEL: false,
        rolloutPercentage: 0,
        enableMetrics: true,
      }));
      
      app.get('/legacy-test', (req, res) => {
        res.json({
          correlationId: req.correlationId,
          migrationMetadata: (req as any).migrationMetadata,
        });
      });

      const response = await request(app)
        .get('/legacy-test')
        .expect(200);

      expect(response.body.correlationId).toMatch(/^corr_\d+_/);
      expect(response.body.migrationMetadata).toMatchObject({
        useOTEL: false,
      });
    });

    it('should respect feature flag headers', async () => {
      app.use(createMigrationMiddleware({
        enableOTEL: true,
        rolloutPercentage: 0, // Would normally use legacy
        enableFeatureFlag: true,
      }));
      
      app.get('/feature-flag-test', (req, res) => {
        res.json({
          correlationId: req.correlationId,
          migrationMetadata: (req as any).migrationMetadata,
        });
      });

      const response = await request(app)
        .get('/feature-flag-test')
        .set('x-enable-otel', 'true')
        .expect(200);

      expect(response.body.correlationId).toBe('test-trace-id-123456789');
      expect(response.body.migrationMetadata).toMatchObject({
        useOTEL: true,
      });
    });
  });

  describe('Backward Compatibility', () => {
    beforeEach(() => {
      app.use(otelCorrelationMiddleware({
        enableOTEL: true,
        backwardCompatible: true,
      }));
    });

    it('should maintain existing correlation API compatibility', async () => {
      app.get('/compat-test', (req, res) => {
        // Test legacy API functions
        const { 
          getCorrelationId, 
          getLogContext, 
          createSpan, 
          logOperation 
        } = require('../../middleware/otel-correlation.middleware');
        
        const correlationId = getCorrelationId(req);
        const logContext = getLogContext(req);
        const spanContext = createSpan(req, 'test-operation');
        
        logOperation(req, 'info', 'Test operation', { test: true });
        
        res.json({
          correlationId,
          logContext,
          spanContext,
        });
      });

      const response = await request(app)
        .get('/compat-test')
        .expect(200);

      expect(response.body.correlationId).toBe('test-trace-id-123456789');
      expect(response.body.logContext).toHaveProperty('correlationId');
      expect(response.body.spanContext).toHaveProperty('operationName', 'test-operation');
    });
  });

  describe('Performance and Resource Usage', () => {
    it('should handle high request volume efficiently', async () => {
      app.use(otelCorrelationMiddleware({
        enableOTEL: true,
        logRequests: false, // Disable logging for performance test
      }));
      
      app.get('/perf-test', (req, res) => {
        res.json({ ok: true, correlationId: req.correlationId });
      });

      const startTime = Date.now();
      const promises = [];
      
      // Send 100 concurrent requests
      for (let i = 0; i < 100; i++) {
        promises.push(
          request(app)
            .get('/perf-test')
            .expect(200)
        );
      }
      
      const responses = await Promise.all(promises);
      const duration = Date.now() - startTime;
      
      // Verify all requests succeeded
      expect(responses).toHaveLength(100);
      responses.forEach(response => {
        expect(response.body.correlationId).toBe('test-trace-id-123456789');
      });
      
      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(5000); // 5 seconds for 100 requests
      
      console.log(`Processed 100 requests in ${duration}ms (${duration / 100}ms per request)`);
    });

    it('should not leak memory with OTEL integration', async () => {
      app.use(otelCorrelationMiddleware({ enableOTEL: true }));
      
      app.get('/memory-test', (req, res) => {
        // Create some spans and contexts
        const { createOTELSpan } = require('../../middleware/otel-correlation.middleware');
        
        for (let i = 0; i < 10; i++) {
          const span = createOTELSpan(req, `operation-${i}`);
          span.end();
        }
        
        res.json({ ok: true });
      });

      const initialMemory = process.memoryUsage();
      
      // Send multiple requests
      for (let i = 0; i < 50; i++) {
        await request(app)
          .get('/memory-test')
          .expect(200);
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable (less than 10MB for 50 requests)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
      
      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    });
  });

  describe('Error Resilience', () => {
    it('should handle OTEL SDK initialization failures gracefully', async () => {
      // Mock OTEL API to throw errors
      (api.trace.getActiveSpan as jest.Mock).mockImplementation(() => {
        throw new Error('OTEL SDK error');
      });
      
      app.use(otelCorrelationMiddleware({
        enableOTEL: true,
        backwardCompatible: true,
      }));
      
      app.get('/error-resilience', (req, res) => {
        res.json({ correlationId: req.correlationId });
      });

      const response = await request(app)
        .get('/error-resilience')
        .expect(200);

      // Should fallback to custom correlation ID
      expect(response.body.correlationId).toMatch(/^corr_\d+_/);
    });

    it('should handle span operation errors gracefully', async () => {
      // Mock span methods to throw errors
      mockSpan.setAttributes.mockImplementation(() => {
        throw new Error('Span attribute error');
      });
      
      app.use(otelCorrelationMiddleware({ enableOTEL: true }));
      
      app.get('/span-error-test', (req, res) => {
        res.json({ ok: true });
      });

      // Should not throw and request should still succeed
      await request(app)
        .get('/span-error-test')
        .expect(200);
    });
  });

  describe('Context Propagation', () => {
    it('should propagate OTEL context across async operations', async () => {
      app.use(otelCorrelationMiddleware({ enableOTEL: true }));
      
      app.get('/async-test', async (req, res) => {
        const { withOTELContext } = require('../../middleware/otel-correlation.middleware');
        
        const result = await withOTELContext(req, async () => {
          // Simulate async operation
          await new Promise(resolve => setTimeout(resolve, 10));
          return {
            traceId: req.traceId,
            correlationId: req.correlationId,
          };
        });
        
        res.json(result);
      });

      const response = await request(app)
        .get('/async-test')
        .expect(200);

      expect(response.body).toMatchObject({
        traceId: 'test-trace-id-123456789',
        correlationId: 'test-trace-id-123456789',
      });
    });

    it('should maintain context in database operations', async () => {
      app.use(otelCorrelationMiddleware({ enableOTEL: true }));
      
      app.get('/db-test', async (req, res) => {
        const { correlateDbOperationWithOTEL } = require('../../middleware/otel-correlation.middleware');
        
        const result = await correlateDbOperationWithOTEL(
          req,
          'select',
          async () => {
            // Simulate database operation
            await new Promise(resolve => setTimeout(resolve, 5));
            return { id: 1, name: 'test' };
          }
        );
        
        res.json({ data: result, correlationId: req.correlationId });
      });

      const response = await request(app)
        .get('/db-test')
        .expect(200);

      expect(response.body.data).toEqual({ id: 1, name: 'test' });
      expect(response.body.correlationId).toBe('test-trace-id-123456789');
      
      // Verify span was created for database operation
      expect(mockTracer.startSpan).toHaveBeenCalledWith(
        'db.select',
        expect.objectContaining({
          attributes: expect.objectContaining({
            'db.operation': 'select',
            'db.system': 'postgresql',
          }),
        })
      );
    });
  });
});