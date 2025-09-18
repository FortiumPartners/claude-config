/**
 * API Integration Tests
 * Fortium External Metrics Web Service - Task 1.9: Testing Infrastructure
 */

import request from 'supertest';
import { createApp } from '../app';
import { TEST_CONSTANTS } from './setup';

describe('API Integration Tests', () => {
  let app: any;
  let authTokens: any;

  beforeAll(async () => {
    app = await createApp();
    
    // Get auth tokens for authenticated tests
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@fortium.com',
        password: 'Password123!',
        tenantId: TEST_CONSTANTS.TEST_TENANT_ID,
      });

    authTokens = loginResponse.body.data?.tokens;
  });

  describe('Health and Info Endpoints', () => {
    describe('GET /health', () => {
      it('should return service health status', async () => {
        const response = await request(app)
          .get('/health')
          .expect(200);

        expect(response.body.status).toBe('healthy');
        expect(response.body.timestamp).toBeDefined();
        expect(response.body.uptime).toBeGreaterThan(0);
        expect(response.body.environment).toBe('test');
        expect(response.body.services).toBeDefined();
      });
    });

    describe('GET /api', () => {
      it('should return API information', async () => {
        const response = await request(app)
          .get('/api')
          .expect(200);

        expect(response.body.name).toContain('Fortium');
        expect(response.body.version).toBeDefined();
        expect(response.body.endpoints).toBeDefined();
        expect(response.body.features).toBeDefined();
      });
    });

    describe('GET /api/v1', () => {
      it('should return API v1 information', async () => {
        const response = await request(app)
          .get('/api/v1')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.service).toContain('Fortium');
        expect(response.body.data.endpoints).toBeDefined();
        expect(response.body.data.features).toBeDefined();
      });
    });

    describe('GET /api/v1/health', () => {
      it('should return API health status', async () => {
        const response = await request(app)
          .get('/api/v1/health')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe('healthy');
        expect(response.body.data.features).toBeDefined();
        expect(response.body.data.endpoints).toBeDefined();
      });
    });
  });

  describe('CORS and Security Headers', () => {
    it('should include security headers', async () => {
      const response = await request(app)
        .get('/api/v1')
        .expect(200);

      // Check security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['x-api-version']).toBeDefined();
      expect(response.headers['x-request-id']).toBeDefined();
    });

    it('should handle CORS preflight requests', async () => {
      const response = await request(app)
        .options('/api/v1/auth/login')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type,Authorization')
        .expect(204);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-methods']).toBeDefined();
      expect(response.headers['access-control-allow-headers']).toBeDefined();
    });
  });

  describe('Request Validation', () => {
    it('should validate JSON body parsing', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send('invalid json')
        .set('Content-Type', 'application/json')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should handle large request bodies', async () => {
      const largeData = 'x'.repeat(11 * 1024 * 1024); // 11MB, over the 10MB limit

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ data: largeData })
        .expect(413);
    });

    it('should add request IDs to all responses', async () => {
      const response = await request(app)
        .get('/api/v1')
        .expect(200);

      expect(response.headers['x-request-id']).toBeDefined();
      expect(response.body.requestId).toBeDefined();
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limits', async () => {
      const requests = [];
      
      // Send multiple requests quickly
      for (let i = 0; i < 10; i++) {
        requests.push(
          request(app)
            .get('/api/v1')
        );
      }

      const responses = await Promise.all(requests);
      
      // All should succeed since we're under the limit
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Check rate limit headers
      const lastResponse = responses[responses.length - 1];
      expect(lastResponse.headers['x-ratelimit-limit']).toBeDefined();
      expect(lastResponse.headers['x-ratelimit-remaining']).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 errors gracefully', async () => {
      const response = await request(app)
        .get('/api/v1/nonexistent-endpoint')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.requestId).toBeDefined();
    });

    it('should handle method not allowed', async () => {
      const response = await request(app)
        .patch('/api/v1/auth/login') // Wrong method
        .expect(404); // Will be 404 since route doesn't exist for PATCH
    });

    it('should standardize error responses', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({}) // Missing required fields
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('requestId');
    });
  });

  describe('Authentication Flow', () => {
    it('should require authentication for protected endpoints', async () => {
      const response = await request(app)
        .get('/api/v1/metrics')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should accept valid JWT tokens', async () => {
      if (!authTokens?.accessToken) {
        throw new Error('Failed to get auth tokens for test');
      }

      const response = await request(app)
        .get('/api/v1/metrics')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .set('X-Tenant-ID', TEST_CONSTANTS.TEST_TENANT_ID)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should require tenant header for multi-tenant endpoints', async () => {
      if (!authTokens?.accessToken) {
        throw new Error('Failed to get auth tokens for test');
      }

      const response = await request(app)
        .get('/api/v1/metrics')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        // Missing X-Tenant-ID header
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Metrics API', () => {
    const authHeaders = () => ({
      'Authorization': `Bearer ${authTokens?.accessToken}`,
      'X-Tenant-ID': TEST_CONSTANTS.TEST_TENANT_ID,
    });

    describe('POST /api/v1/metrics', () => {
      const validMetricsData = {
        sessionId: TEST_CONSTANTS.VALID_UUID,
        metrics: [
          {
            name: 'response_time',
            value: 150,
            unit: 'ms',
            tags: { environment: 'test' },
          },
          {
            name: 'memory_usage',
            value: 75.5,
            unit: 'MB',
          },
        ],
      };

      it('should accept valid metrics data', async () => {
        const response = await request(app)
          .post('/api/v1/metrics')
          .set(authHeaders())
          .send(validMetricsData)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.sessionId).toBe(validMetricsData.sessionId);
        expect(response.body.data.metricsCount).toBe(validMetricsData.metrics.length);
      });

      it('should validate metrics data structure', async () => {
        const response = await request(app)
          .post('/api/v1/metrics')
          .set(authHeaders())
          .send({
            sessionId: TEST_CONSTANTS.VALID_UUID,
            metrics: [
              {
                // Missing required fields
                value: 150,
              },
            ],
          })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.errors).toBeDefined();
      });

      it('should validate session ID format', async () => {
        const response = await request(app)
          .post('/api/v1/metrics')
          .set(authHeaders())
          .send({
            ...validMetricsData,
            sessionId: 'invalid-uuid',
          })
          .expect(400);

        expect(response.body.success).toBe(false);
      });
    });

    describe('GET /api/v1/metrics', () => {
      it('should return metrics data with pagination', async () => {
        const response = await request(app)
          .get('/api/v1/metrics')
          .set(authHeaders())
          .query({ page: 1, limit: 10 })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(response.body.meta.pagination).toBeDefined();
        expect(response.body.meta.pagination.page).toBe(1);
        expect(response.body.meta.pagination.limit).toBe(10);
      });

      it('should handle query filters', async () => {
        const response = await request(app)
          .get('/api/v1/metrics')
          .set(authHeaders())
          .query({
            sessionId: TEST_CONSTANTS.VALID_UUID,
            startDate: '2024-01-01T00:00:00Z',
            endDate: '2024-12-31T23:59:59Z',
          })
          .expect(200);

        expect(response.body.success).toBe(true);
      });
    });

    describe('GET /api/v1/metrics/summary', () => {
      it('should return metrics summary', async () => {
        const response = await request(app)
          .get('/api/v1/metrics/summary')
          .set(authHeaders())
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.tenantId).toBe(TEST_CONSTANTS.TEST_TENANT_ID);
        expect(response.body.data.totalSessions).toBeDefined();
        expect(response.body.data.totalMetrics).toBeDefined();
      });
    });
  });

  describe('Dashboard API', () => {
    const authHeaders = () => ({
      'Authorization': `Bearer ${authTokens?.accessToken}`,
      'X-Tenant-ID': TEST_CONSTANTS.TEST_TENANT_ID,
    });

    const validDashboardData = {
      name: 'Test Dashboard',
      description: 'A test dashboard',
      config: {
        widgets: [
          {
            id: 'widget_1',
            type: 'chart',
            title: 'Test Widget',
            config: { metric: 'test_metric' },
            position: { x: 0, y: 0, width: 6, height: 4 },
          },
        ],
        layout: { columns: 12 },
      },
      isPublic: false,
      tags: ['test'],
    };

    describe('POST /api/v1/dashboards', () => {
      it('should create dashboard with valid data', async () => {
        const response = await request(app)
          .post('/api/v1/dashboards')
          .set(authHeaders())
          .send(validDashboardData)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.name).toBe(validDashboardData.name);
        expect(response.body.data.tenantId).toBe(TEST_CONSTANTS.TEST_TENANT_ID);
      });

      it('should validate dashboard structure', async () => {
        const response = await request(app)
          .post('/api/v1/dashboards')
          .set(authHeaders())
          .send({
            name: 'Test',
            config: {
              widgets: [
                {
                  // Missing required fields
                  title: 'Test',
                },
              ],
            },
          })
          .expect(400);

        expect(response.body.success).toBe(false);
      });
    });

    describe('GET /api/v1/dashboards', () => {
      it('should return paginated dashboards', async () => {
        const response = await request(app)
          .get('/api/v1/dashboards')
          .set(authHeaders())
          .query({ page: 1, limit: 20 })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(response.body.meta.pagination).toBeDefined();
      });

      it('should handle search and filters', async () => {
        const response = await request(app)
          .get('/api/v1/dashboards')
          .set(authHeaders())
          .query({
            search: 'performance',
            isPublic: false,
            tags: ['performance'],
          })
          .expect(200);

        expect(response.body.success).toBe(true);
      });
    });
  });

  describe('Response Format Consistency', () => {
    it('should use consistent success response format', async () => {
      const response = await request(app)
        .get('/api/v1')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('requestId');
    });

    it('should use consistent error response format', async () => {
      const response = await request(app)
        .get('/api/v1/nonexistent')
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('requestId');
    });
  });
});