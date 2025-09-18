// Unit tests for health check endpoints
// Part of Phase 2: Infrastructure & Integration - Testing Pipeline

const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/database/connection');

describe('Health Check Endpoints', () => {
  describe('GET /api/health', () => {
    test('should return 200 with health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('version');
    });

    test('should include service information', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'healthy',
        service: 'monitoring-web-service',
        environment: expect.any(String),
        version: expect.any(String),
        uptime: expect.any(Number),
        timestamp: expect.any(String)
      });
    });

    test('should return response within performance threshold', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/api/health')
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(100); // Sub-100ms response time
    });
  });

  describe('GET /api/health/detailed', () => {
    test('should return detailed health check', async () => {
      const response = await request(app)
        .get('/api/health/detailed')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('checks');
      expect(response.body.checks).toHaveProperty('database');
      expect(response.body.checks).toHaveProperty('redis');
      expect(response.body.checks).toHaveProperty('external_services');
    });

    test('should validate database connectivity', async () => {
      const response = await request(app)
        .get('/api/health/detailed')
        .expect(200);

      const dbCheck = response.body.checks.database;
      expect(dbCheck).toHaveProperty('status');
      expect(dbCheck).toHaveProperty('response_time');
      expect(dbCheck).toHaveProperty('connection_count');
      
      if (dbCheck.status === 'healthy') {
        expect(dbCheck.response_time).toBeLessThan(50);
      }
    });

    test('should validate Redis connectivity', async () => {
      const response = await request(app)
        .get('/api/health/detailed')
        .expect(200);

      const redisCheck = response.body.checks.redis;
      expect(redisCheck).toHaveProperty('status');
      expect(redisCheck).toHaveProperty('response_time');
      
      if (redisCheck.status === 'healthy') {
        expect(redisCheck.response_time).toBeLessThan(10);
      }
    });
  });

  describe('GET /api/health/readiness', () => {
    test('should return readiness status', async () => {
      const response = await request(app)
        .get('/api/health/readiness')
        .expect(200);

      expect(response.body).toHaveProperty('ready');
      expect(response.body).toHaveProperty('checks');
    });

    test('should validate required services are ready', async () => {
      const response = await request(app)
        .get('/api/health/readiness');

      if (response.status === 200) {
        expect(response.body.ready).toBe(true);
        expect(response.body.checks.database.status).toBe('ready');
        expect(response.body.checks.redis.status).toBe('ready');
      } else {
        expect(response.status).toBe(503);
        expect(response.body.ready).toBe(false);
      }
    });
  });

  describe('GET /api/health/liveness', () => {
    test('should return liveness status', async () => {
      const response = await request(app)
        .get('/api/health/liveness')
        .expect(200);

      expect(response.body).toHaveProperty('alive', true);
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('process_id');
    });

    test('should include process information', async () => {
      const response = await request(app)
        .get('/api/health/liveness')
        .expect(200);

      expect(response.body).toMatchObject({
        alive: true,
        process_id: expect.any(Number),
        memory_usage: expect.any(Object),
        cpu_usage: expect.any(Number),
        timestamp: expect.any(String)
      });
    });
  });
});