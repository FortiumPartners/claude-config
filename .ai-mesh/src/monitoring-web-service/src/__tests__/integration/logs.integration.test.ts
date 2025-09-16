/**
 * Log Ingestion Integration Tests
 * Fortium External Metrics Web Service - Task 2.3: Backend Log API Implementation
 * 
 * Tests the complete pipeline: Routes → Controller → Service → Winston/Seq
 */

import request from 'supertest';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import logsRoutes from '../../routes/logs.routes';
import { logsService } from '../../services/logs.service';
import { logger } from '../../config/logger';
import { LogEntry } from '../../validation/logs.validation';

// Test app setup mimicking actual server configuration
const createIntegrationTestApp = () => {
  const app = express();
  
  // Basic middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  
  // Mock auth middleware for integration testing
  app.use((req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      if (token === 'integration_test_token') {
        (req as any).user = {
          id: 'integration-test-user-123',
          email: 'integration.test@example.com',
          tenantId: 'integration-test-tenant-456',
          role: 'developer',
        };
        (req as any).tenant = {
          id: 'integration-test-tenant-456',
          name: 'Integration Test Tenant',
        };
      } else if (token === 'integration_admin_token') {
        (req as any).user = {
          id: 'integration-admin-123',
          email: 'admin.integration@example.com',
          tenantId: 'integration-test-tenant-456',
          role: 'super_admin',
        };
        (req as any).tenant = {
          id: 'integration-test-tenant-456',
          name: 'Integration Test Tenant',
        };
      }
    }
    
    (req as any).correlationId = uuidv4();
    (req as any).requestId = uuidv4();
    next();
  });
  
  // Mount routes
  app.use('/api/v1/logs', logsRoutes);
  
  // Global error handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error('Integration test error:', err);
    res.status(err.statusCode || 500).json({
      success: false,
      error: err.name || 'INTEGRATION_TEST_ERROR',
      message: err.message || 'Integration test error',
      timestamp: new Date().toISOString(),
    });
  });
  
  return app;
};

describe('Log Ingestion Integration Tests', () => {
  let app: express.Application;

  beforeAll(() => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    
    // Reset logs service metrics
    logsService.resetMetrics();
  });

  beforeEach(() => {
    app = createIntegrationTestApp();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete Log Ingestion Pipeline', () => {
    it('should process log entries through the complete pipeline', async () => {
      // Create realistic log entries
      const logEntries: LogEntry[] = [
        {
          timestamp: new Date().toISOString(),
          level: 'Information',
          message: 'Integration test: User session started',
          messageTemplate: 'Integration test: User {UserId} session started from {IpAddress}',
          properties: {
            correlationId: uuidv4(),
            sessionId: uuidv4(),
            userId: 'integration-test-user-123',
            tenantId: 'integration-test-tenant-456',
            component: 'AuthenticationService',
            operation: 'startSession',
            version: '1.0.0',
            environment: 'test',
            ipAddress: '127.0.0.1',
            userAgent: 'Integration Test Suite',
            responseTime: 45,
          },
        },
        {
          timestamp: new Date().toISOString(),
          level: 'Warning',
          message: 'Integration test: Performance warning',
          messageTemplate: 'Integration test: {Operation} took {Duration}ms',
          properties: {
            correlationId: uuidv4(),
            operation: 'dataProcessing',
            duration: 1500,
            threshold: 1000,
            component: 'DataProcessor',
          },
        },
        {
          timestamp: new Date().toISOString(),
          level: 'Error',
          message: 'Integration test: Simulated error',
          properties: {
            correlationId: uuidv4(),
            errorCode: 'INTEGRATION_TEST_ERROR',
            errorCategory: 'validation',
            component: 'TestRunner',
          },
          exception: {
            type: 'IntegrationTestError',
            message: 'This is a simulated error for testing',
            stackTrace: 'IntegrationTestError: This is a simulated error for testing\n    at TestRunner.run (test.js:123:45)',
            source: 'IntegrationTestSuite',
          },
        },
      ];

      const response = await request(app)
        .post('/api/v1/logs')
        .set('Authorization', 'Bearer integration_test_token')
        .set('Content-Type', 'application/json')
        .send({ entries: logEntries })
        .expect(200);

      // Verify response structure
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        processed: 3,
        failed: 0,
        errors: [],
        correlationId: expect.any(String),
        processingTimeMs: expect.any(Number),
      });
      expect(response.body.message).toContain('Successfully processed 3 log entries');
      expect(response.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

      // Verify processing time is reasonable (< 1 second for 3 entries)
      expect(response.body.data.processingTimeMs).toBeLessThan(1000);
    });

    it('should handle large batch processing efficiently', async () => {
      // Create a batch of 50 log entries
      const logEntries: LogEntry[] = Array.from({ length: 50 }, (_, index) => ({
        timestamp: new Date(Date.now() + index * 1000).toISOString(),
        level: ['Information', 'Warning', 'Error'][index % 3] as any,
        message: `Integration test batch entry ${index + 1}`,
        messageTemplate: 'Integration test batch entry {EntryNumber} of {TotalEntries}',
        properties: {
          correlationId: uuidv4(),
          entryNumber: index + 1,
          totalEntries: 50,
          batchId: 'integration-test-batch-001',
          component: 'BatchProcessor',
          testRun: true,
        },
      }));

      const startTime = Date.now();
      const response = await request(app)
        .post('/api/v1/logs')
        .set('Authorization', 'Bearer integration_test_token')
        .send({ entries: logEntries })
        .expect(200);

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      expect(response.body.success).toBe(true);
      expect(response.body.data.processed).toBe(50);
      expect(response.body.data.failed).toBe(0);
      
      // Performance assertion - should process 50 entries in under 500ms
      expect(totalTime).toBeLessThan(500);
      expect(response.body.data.processingTimeMs).toBeLessThan(200);
    });

    it('should handle partial batch failures gracefully', async () => {
      // Mix valid and potentially problematic entries
      const logEntries: LogEntry[] = [
        {
          timestamp: new Date().toISOString(),
          level: 'Information',
          message: 'Valid log entry',
          properties: { correlationId: uuidv4() },
        },
        {
          timestamp: new Date().toISOString(),
          level: 'Information',
          message: 'Another valid entry',
          properties: { correlationId: uuidv4() },
        },
        {
          timestamp: new Date().toISOString(),
          level: 'Error',
          message: 'Entry with complex exception',
          properties: { correlationId: uuidv4() },
          exception: {
            type: 'ComplexError',
            message: 'A'.repeat(1500), // Large message
            stackTrace: 'Stack trace with special characters: <>&"\'',
            source: 'TestRunner',
            innerException: {
              type: 'InnerError',
              message: 'Inner exception message',
            },
          },
        },
      ];

      const response = await request(app)
        .post('/api/v1/logs')
        .set('Authorization', 'Bearer integration_test_token')
        .send({ entries: logEntries })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.processed).toBe(3);
      expect(response.body.data.failed).toBe(0);
    });
  });

  describe('Health Check Integration', () => {
    it('should return comprehensive health status', async () => {
      const response = await request(app)
        .get('/api/v1/logs/health')
        .set('Authorization', 'Bearer integration_test_token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        status: expect.stringMatching(/^(healthy|degraded|unhealthy)$/),
        checks: {
          winston: expect.any(Boolean),
          seq: {
            status: expect.stringMatching(/^(healthy|degraded|unhealthy|disabled)$/),
          },
          rateLimit: {
            enabled: expect.any(Boolean),
            limit: expect.any(Number),
            window: expect.any(Number),
          },
        },
        metrics: {
          entriesProcessed: expect.any(Number),
          entriesFailed: expect.any(Number),
          averageProcessingTime: expect.any(Number),
          uptime: expect.any(Number),
        },
      });
    });
  });

  describe('Metrics Integration', () => {
    it('should return detailed metrics for admin users', async () => {
      // Process some logs first to generate metrics
      const logEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: 'Information',
        message: 'Metrics test entry',
        properties: { testMetrics: true },
      };

      await request(app)
        .post('/api/v1/logs')
        .set('Authorization', 'Bearer integration_admin_token')
        .send({ entries: [logEntry] })
        .expect(200);

      // Then check metrics
      const response = await request(app)
        .get('/api/v1/logs/metrics')
        .set('Authorization', 'Bearer integration_admin_token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        service: {
          entriesProcessed: expect.any(Number),
          entriesFailed: expect.any(Number),
          averageProcessingTime: expect.any(Number),
          successRate: expect.any(Number),
          uptime: expect.any(Number),
        },
        health: expect.any(Object),
        limits: {
          maxEntriesPerBatch: 100,
          maxBatchSizeMB: 5,
          maxEntryKB: 64,
        },
      });

      expect(response.body.data.service.entriesProcessed).toBeGreaterThan(0);
    });

    it('should reject metrics access for non-admin users', async () => {
      const response = await request(app)
        .get('/api/v1/logs/metrics')
        .set('Authorization', 'Bearer integration_test_token')
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Insufficient permissions');
    });
  });

  describe('Validation Integration', () => {
    it('should reject malformed requests', async () => {
      const invalidRequest = {
        entries: [
          {
            // Missing required timestamp
            level: 'Information',
            message: 'Invalid entry',
            properties: {},
          },
        ],
      };

      const response = await request(app)
        .post('/api/v1/logs')
        .set('Authorization', 'Bearer integration_test_token')
        .send(invalidRequest)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should handle oversized requests', async () => {
      const oversizedEntries = Array.from({ length: 101 }, (_, i) => ({
        timestamp: new Date().toISOString(),
        level: 'Information',
        message: `Oversized batch entry ${i}`,
        properties: {},
      }));

      const response = await request(app)
        .post('/api/v1/logs')
        .set('Authorization', 'Bearer integration_test_token')
        .send({ entries: oversizedEntries })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message || response.body.error).toContain('100');
    });
  });

  describe('Authentication Integration', () => {
    it('should reject unauthenticated requests', async () => {
      const logEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: 'Information',
        message: 'Unauthenticated test',
        properties: {},
      };

      const response = await request(app)
        .post('/api/v1/logs')
        .send({ entries: [logEntry] })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject invalid tokens', async () => {
      const logEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: 'Information',
        message: 'Invalid token test',
        properties: {},
      };

      const response = await request(app)
        .post('/api/v1/logs')
        .set('Authorization', 'Bearer invalid_token')
        .send({ entries: [logEntry] })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Development Endpoints Integration', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    afterEach(() => {
      process.env.NODE_ENV = 'test';
    });

    it('should allow test ingestion in development mode', async () => {
      const response = await request(app)
        .post('/api/v1/logs/test')
        .set('Authorization', 'Bearer integration_test_token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.testResult).toBeDefined();
      expect(response.body.data.sampleEntries).toBeDefined();
      expect(Array.isArray(response.body.data.sampleEntries)).toBe(true);
    });

    it('should allow metrics reset for admin users in development', async () => {
      // First, generate some metrics
      await request(app)
        .post('/api/v1/logs')
        .set('Authorization', 'Bearer integration_admin_token')
        .send({
          entries: [{
            timestamp: new Date().toISOString(),
            level: 'Information',
            message: 'Pre-reset entry',
            properties: {},
          }]
        })
        .expect(200);

      // Then reset metrics
      const response = await request(app)
        .delete('/api/v1/logs/metrics')
        .set('Authorization', 'Bearer integration_admin_token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('reset successfully');

      // Verify metrics are reset
      const metricsResponse = await request(app)
        .get('/api/v1/logs/metrics')
        .set('Authorization', 'Bearer integration_admin_token')
        .expect(200);

      expect(metricsResponse.body.data.service.entriesProcessed).toBe(0);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle service errors gracefully', async () => {
      // This test would require mocking the service to throw an error
      // In a real scenario, you might temporarily disable Seq or cause a validation error
      
      // For now, we'll test with a request that would cause validation to fail
      const problematicRequest = {
        entries: [{
          timestamp: 'not-a-valid-timestamp',
          level: 'InvalidLevel',
          message: '', // Empty message might cause issues
          properties: null, // Null properties
        }],
      };

      const response = await request(app)
        .post('/api/v1/logs')
        .set('Authorization', 'Bearer integration_test_token')
        .send(problematicRequest)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('Performance Integration Tests', () => {
    it('should meet performance requirements', async () => {
      const batchSize = 25;
      const logEntries: LogEntry[] = Array.from({ length: batchSize }, (_, index) => ({
        timestamp: new Date().toISOString(),
        level: 'Information',
        message: `Performance test entry ${index}`,
        messageTemplate: 'Performance test entry {Index} with {Timestamp}',
        properties: {
          correlationId: uuidv4(),
          index,
          performanceTest: true,
          timestamp: new Date().toISOString(),
        },
      }));

      const startTime = Date.now();
      const response = await request(app)
        .post('/api/v1/logs')
        .set('Authorization', 'Bearer integration_test_token')
        .send({ entries: logEntries })
        .expect(200);

      const endTime = Date.now();
      const requestTime = endTime - startTime;

      // Performance assertions based on Task 2.3 requirements
      expect(response.body.data.processingTimeMs).toBeLessThan(100); // P95 < 100ms requirement
      expect(requestTime).toBeLessThan(200); // Total request time should be reasonable
      expect(response.body.data.processed).toBe(batchSize);
      expect(response.body.data.failed).toBe(0);
    });
  });
});

describe('API Documentation Integration', () => {
  let app: express.Application;

  beforeEach(() => {
    app = createIntegrationTestApp();
  });

  it('should serve comprehensive API documentation', async () => {
    const response = await request(app)
      .get('/api/v1/logs/docs')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      title: 'Log Ingestion API',
      version: expect.any(String),
      description: expect.any(String),
      endpoints: expect.any(Array),
      integration: expect.any(Object),
      security: expect.any(Object),
    });

    expect(response.body.data.endpoints.length).toBeGreaterThan(0);
    expect(response.body.data.endpoints[0]).toMatchObject({
      method: expect.any(String),
      path: expect.any(String),
      description: expect.any(String),
    });
  });
});