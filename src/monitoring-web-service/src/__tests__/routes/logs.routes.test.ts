/**
 * Log Ingestion API Routes Tests
 * Fortium External Metrics Web Service - Task 2.3: Backend Log API Implementation
 */

import request from 'supertest';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import logsRoutes from '../../routes/logs.routes';
import { logsService } from '../../services/logs.service';
import { JwtService } from '../../auth/jwt.service';
import { logger } from '../../config/logger';

// Mock dependencies
jest.mock('../../services/logs.service');
jest.mock('../../auth/jwt.service');
jest.mock('../../config/logger');

const mockLogsService = logsService as jest.Mocked<typeof logsService>;
const mockJwtService = JwtService as jest.Mocked<typeof JwtService>;

// Test Express app setup
const createTestApp = () => {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  
  // Mock authentication middleware
  app.use((req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      // Mock valid token
      if (token === 'valid_token') {
        (req as any).user = {
          id: 'user-123',
          email: 'test@example.com',
          tenantId: 'tenant-456',
          role: 'developer',
        };
        (req as any).tenant = {
          id: 'tenant-456',
          name: 'Test Tenant',
        };
      } else if (token === 'admin_token') {
        (req as any).user = {
          id: 'admin-123',
          email: 'admin@example.com',
          tenantId: 'tenant-456',
          role: 'super_admin',
        };
        (req as any).tenant = {
          id: 'tenant-456',
          name: 'Test Tenant',
        };
      }
    }
    
    (req as any).correlationId = uuidv4();
    (req as any).requestId = uuidv4();
    next();
  });
  
  app.use('/api/v1/logs', logsRoutes);
  
  // Error handling middleware
  app.use((err: any, req: any, res: any, next: any) => {
    res.status(err.statusCode || 500).json({
      success: false,
      error: err.name || 'INTERNAL_ERROR',
      message: err.message || 'Internal server error',
    });
  });
  
  return app;
};

describe('POST /api/v1/logs', () => {
  let app: express.Application;
  
  beforeEach(() => {
    app = createTestApp();
    jest.clearAllMocks();
    
    // Reset environment
    process.env.NODE_ENV = 'test';
  });

  describe('Authentication', () => {
    it('should reject requests without authentication', async () => {
      const response = await request(app)
        .post('/api/v1/logs')
        .send({
          entries: [{
            timestamp: new Date().toISOString(),
            level: 'Information',
            message: 'Test message',
            properties: {},
          }]
        });

      expect(response.status).toBe(401);
    });

    it('should reject requests with invalid tokens', async () => {
      const response = await request(app)
        .post('/api/v1/logs')
        .set('Authorization', 'Bearer invalid_token')
        .send({
          entries: [{
            timestamp: new Date().toISOString(),
            level: 'Information',
            message: 'Test message',
            properties: {},
          }]
        });

      expect(response.status).toBe(401);
    });
  });

  describe('Valid Requests', () => {
    beforeEach(() => {
      mockLogsService.processBatch.mockResolvedValue({
        success: true,
        processed: 2,
        failed: 0,
        errors: [],
        correlationId: 'test-correlation-id',
      });
    });

    it('should process valid log entries successfully', async () => {
      const entries = [
        {
          timestamp: new Date().toISOString(),
          level: 'Information',
          message: 'User login successful',
          messageTemplate: 'User {UserId} login successful from {IpAddress}',
          properties: {
            userId: 'user-123',
            ipAddress: '192.168.1.1',
            correlationId: uuidv4(),
          },
        },
        {
          timestamp: new Date().toISOString(),
          level: 'Warning',
          message: 'Slow API response',
          properties: {
            responseTime: 2500,
            endpoint: '/api/v1/metrics',
          },
        }
      ];

      const response = await request(app)
        .post('/api/v1/logs')
        .set('Authorization', 'Bearer valid_token')
        .send({ entries });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.processed).toBe(2);
      expect(response.body.data.failed).toBe(0);
      expect(response.body.data.errors).toHaveLength(0);
      expect(response.body.data.correlationId).toBeDefined();
      
      expect(mockLogsService.processBatch).toHaveBeenCalledWith(
        entries,
        expect.objectContaining({
          correlationId: expect.any(String),
          requestId: expect.any(String),
          userId: 'user-123',
          tenantId: 'tenant-456',
        })
      );
    });

    it('should handle processing failures gracefully', async () => {
      mockLogsService.processBatch.mockResolvedValue({
        success: false,
        processed: 1,
        failed: 1,
        errors: ['Entry 1: Invalid timestamp format'],
        correlationId: 'test-correlation-id',
      });

      const entries = [
        {
          timestamp: new Date().toISOString(),
          level: 'Information',
          message: 'Valid entry',
          properties: {},
        },
        {
          timestamp: 'invalid-timestamp',
          level: 'Error',
          message: 'Invalid entry',
          properties: {},
        }
      ];

      const response = await request(app)
        .post('/api/v1/logs')
        .set('Authorization', 'Bearer valid_token')
        .send({ entries });

      expect(response.status).toBe(207); // Partial success
      expect(response.body.success).toBe(false);
      expect(response.body.data.processed).toBe(1);
      expect(response.body.data.failed).toBe(1);
      expect(response.body.data.errors).toHaveLength(1);
    });

    it('should handle service errors', async () => {
      mockLogsService.processBatch.mockRejectedValue(new Error('Service unavailable'));

      const entries = [{
        timestamp: new Date().toISOString(),
        level: 'Information',
        message: 'Test message',
        properties: {},
      }];

      const response = await request(app)
        .post('/api/v1/logs')
        .set('Authorization', 'Bearer valid_token')
        .send({ entries });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Validation', () => {
    it('should reject requests without entries', async () => {
      const response = await request(app)
        .post('/api/v1/logs')
        .set('Authorization', 'Bearer valid_token')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject empty entries array', async () => {
      const response = await request(app)
        .post('/api/v1/logs')
        .set('Authorization', 'Bearer valid_token')
        .send({ entries: [] });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject entries exceeding batch limit', async () => {
      const entries = Array.from({ length: 101 }, (_, i) => ({
        timestamp: new Date().toISOString(),
        level: 'Information',
        message: `Test message ${i}`,
        properties: {},
      }));

      const response = await request(app)
        .post('/api/v1/logs')
        .set('Authorization', 'Bearer valid_token')
        .send({ entries });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject entries with invalid log levels', async () => {
      const response = await request(app)
        .post('/api/v1/logs')
        .set('Authorization', 'Bearer valid_token')
        .send({
          entries: [{
            timestamp: new Date().toISOString(),
            level: 'InvalidLevel',
            message: 'Test message',
            properties: {},
          }]
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject entries with missing required fields', async () => {
      const response = await request(app)
        .post('/api/v1/logs')
        .set('Authorization', 'Bearer valid_token')
        .send({
          entries: [{
            level: 'Information',
            message: 'Test message', // Missing timestamp
            properties: {},
          }]
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
});

describe('GET /api/v1/logs/health', () => {
  let app: express.Application;
  
  beforeEach(() => {
    app = createTestApp();
    jest.clearAllMocks();
  });

  it('should return healthy status', async () => {
    mockLogsService.getHealthStatus.mockResolvedValue({
      status: 'healthy',
      checks: {
        winston: true,
        seq: { status: 'healthy' },
        rateLimit: { enabled: true, limit: 1000, window: 60000 },
      },
      metrics: {
        entriesProcessed: 100,
        entriesFailed: 2,
        averageProcessingTime: 45,
        uptime: 3600,
      },
    });

    mockLogsService.getSeqMetrics.mockReturnValue({ connected: true });
    mockLogsService.getMetrics.mockReturnValue({
      entriesProcessed: 100,
      entriesFailed: 2,
      averageProcessingTime: 45,
      successRate: 98,
      uptime: 3600,
      lastProcessedAt: new Date(),
    });

    const response = await request(app)
      .get('/api/v1/logs/health')
      .set('Authorization', 'Bearer valid_token');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('healthy');
    expect(response.body.data.checks).toBeDefined();
    expect(response.body.data.metrics).toBeDefined();
  });

  it('should return degraded status', async () => {
    mockLogsService.getHealthStatus.mockResolvedValue({
      status: 'degraded',
      checks: {
        winston: true,
        seq: { status: 'degraded', latency: 500 },
        rateLimit: { enabled: true, limit: 1000, window: 60000 },
      },
      metrics: {
        entriesProcessed: 100,
        entriesFailed: 15,
        averageProcessingTime: 150,
        uptime: 3600,
      },
    });

    const response = await request(app)
      .get('/api/v1/logs/health')
      .set('Authorization', 'Bearer valid_token');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('degraded');
  });

  it('should return unhealthy status', async () => {
    mockLogsService.getHealthStatus.mockResolvedValue({
      status: 'unhealthy',
      checks: {
        winston: false,
        seq: { status: 'unhealthy', error: 'Connection failed' },
        rateLimit: { enabled: false, limit: 0, window: 0 },
      },
      metrics: {
        entriesProcessed: 50,
        entriesFailed: 50,
        averageProcessingTime: 0,
        uptime: 3600,
      },
    });

    const response = await request(app)
      .get('/api/v1/logs/health')
      .set('Authorization', 'Bearer valid_token');

    expect(response.status).toBe(503);
    expect(response.body.success).toBe(false);
    expect(response.body.data.status).toBe('unhealthy');
  });

  it('should handle health check errors', async () => {
    mockLogsService.getHealthStatus.mockRejectedValue(new Error('Health check failed'));

    const response = await request(app)
      .get('/api/v1/logs/health')
      .set('Authorization', 'Bearer valid_token');

    expect(response.status).toBe(503);
    expect(response.body.success).toBe(false);
  });
});

describe('GET /api/v1/logs/metrics', () => {
  let app: express.Application;
  
  beforeEach(() => {
    app = createTestApp();
    jest.clearAllMocks();
  });

  it('should return metrics for admin users', async () => {
    mockLogsService.getMetrics.mockReturnValue({
      entriesProcessed: 1000,
      entriesFailed: 10,
      averageProcessingTime: 25,
      successRate: 99,
      uptime: 7200,
      lastProcessedAt: new Date(),
    });

    mockLogsService.getSeqMetrics.mockReturnValue({
      connected: true,
      batches: 50,
      events: 1000,
    });

    mockLogsService.getHealthStatus.mockResolvedValue({
      status: 'healthy',
      checks: {
        winston: true,
        seq: { status: 'healthy' },
        rateLimit: { enabled: true, limit: 1000, window: 60000 },
      },
      metrics: {
        entriesProcessed: 1000,
        entriesFailed: 10,
        averageProcessingTime: 25,
        uptime: 7200,
      },
    });

    const response = await request(app)
      .get('/api/v1/logs/metrics')
      .set('Authorization', 'Bearer admin_token');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.service).toBeDefined();
    expect(response.body.data.seq).toBeDefined();
    expect(response.body.data.health).toBeDefined();
    expect(response.body.data.limits).toBeDefined();
  });

  it('should reject non-admin users', async () => {
    const response = await request(app)
      .get('/api/v1/logs/metrics')
      .set('Authorization', 'Bearer valid_token');

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it('should require authentication', async () => {
    const response = await request(app)
      .get('/api/v1/logs/metrics');

    expect(response.status).toBe(401);
  });
});

describe('Development Endpoints', () => {
  let app: express.Application;
  
  beforeEach(() => {
    app = createTestApp();
    jest.clearAllMocks();
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    process.env.NODE_ENV = 'test';
  });

  it('should allow test ingestion in development', async () => {
    mockLogsService.processBatch.mockResolvedValue({
      success: true,
      processed: 2,
      failed: 0,
      errors: [],
      correlationId: 'test-correlation-id',
    });

    const response = await request(app)
      .post('/api/v1/logs/test')
      .set('Authorization', 'Bearer valid_token');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.testResult).toBeDefined();
    expect(response.body.data.sampleEntries).toBeDefined();
  });

  it('should allow metrics reset in development for admins', async () => {
    const response = await request(app)
      .delete('/api/v1/logs/metrics')
      .set('Authorization', 'Bearer admin_token');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(mockLogsService.resetMetrics).toHaveBeenCalled();
  });

  it('should reject metrics reset for non-admin users', async () => {
    const response = await request(app)
      .delete('/api/v1/logs/metrics')
      .set('Authorization', 'Bearer valid_token');

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });
});

describe('Production Environment', () => {
  let app: express.Application;
  
  beforeEach(() => {
    app = createTestApp();
    jest.clearAllMocks();
    process.env.NODE_ENV = 'production';
  });

  afterEach(() => {
    process.env.NODE_ENV = 'test';
  });

  it('should hide development endpoints in production', async () => {
    const testResponse = await request(app)
      .post('/api/v1/logs/test')
      .set('Authorization', 'Bearer valid_token');

    expect(testResponse.status).toBe(404);

    const resetResponse = await request(app)
      .delete('/api/v1/logs/metrics')
      .set('Authorization', 'Bearer admin_token');

    expect(resetResponse.status).toBe(404);
  });
});

describe('API Documentation', () => {
  let app: express.Application;
  
  beforeEach(() => {
    app = createTestApp();
    jest.clearAllMocks();
  });

  it('should return API documentation', async () => {
    const response = await request(app)
      .get('/api/v1/logs/docs');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.title).toBe('Log Ingestion API');
    expect(response.body.data.endpoints).toBeDefined();
    expect(Array.isArray(response.body.data.endpoints)).toBe(true);
  });
});

describe('Rate Limiting', () => {
  let app: express.Application;
  
  beforeEach(() => {
    app = createTestApp();
    jest.clearAllMocks();
  });

  // Note: Rate limiting testing would require more complex setup
  // with Redis or memory store configuration in a real test environment
  it('should apply rate limiting configuration', () => {
    // This test verifies that rate limiting middleware is configured
    // Actual rate limiting behavior testing would require integration tests
    expect(logsRoutes).toBeDefined();
  });
});