// Unit tests for metrics collection and processing
// Part of Phase 2: Infrastructure & Integration - Testing Pipeline

const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/database/connection');
const { generateToken } = require('../../src/middleware/auth');
const MetricsService = require('../../src/services/MetricsService');

describe('Metrics Management', () => {
  let authToken;
  let testOrgId = 'fortium-partners';

  beforeEach(() => {
    const user = {
      id: 1,
      email: 'test@fortium.dev',
      org_id: testOrgId,
      role: 'admin'
    };
    authToken = generateToken(user);
  });

  afterEach(async () => {
    // Clean up test data
    if (db) {
      await db.query('DELETE FROM metrics WHERE org_id = $1', [testOrgId]);
    }
  });

  describe('Metrics Ingestion', () => {
    test('should accept valid metric data', async () => {
      const metricData = {
        name: 'cpu_usage',
        value: 75.5,
        unit: 'percent',
        tags: { host: 'web-server-01', environment: 'production' },
        timestamp: new Date().toISOString()
      };

      const response = await request(app)
        .post(`/api/v1/organizations/${testOrgId}/metrics`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(metricData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(metricData.name);
      expect(response.body.value).toBe(metricData.value);
    });

    test('should accept batch metric data', async () => {
      const batchData = [
        {
          name: 'cpu_usage',
          value: 75.5,
          unit: 'percent',
          tags: { host: 'web-server-01' },
          timestamp: new Date().toISOString()
        },
        {
          name: 'memory_usage',
          value: 2048,
          unit: 'MB',
          tags: { host: 'web-server-01' },
          timestamp: new Date().toISOString()
        }
      ];

      const response = await request(app)
        .post(`/api/v1/organizations/${testOrgId}/metrics/batch`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ metrics: batchData })
        .expect(201);

      expect(response.body).toHaveProperty('inserted');
      expect(response.body.inserted).toBe(2);
    });

    test('should validate required fields', async () => {
      const invalidMetric = {
        value: 75.5,
        // Missing required 'name' field
        unit: 'percent'
      };

      await request(app)
        .post(`/api/v1/organizations/${testOrgId}/metrics`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidMetric)
        .expect(400);
    });

    test('should validate data types', async () => {
      const invalidMetric = {
        name: 'cpu_usage',
        value: 'invalid-number', // Should be numeric
        unit: 'percent'
      };

      await request(app)
        .post(`/api/v1/organizations/${testOrgId}/metrics`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidMetric)
        .expect(400);
    });

    test('should handle large batch sizes within limits', async () => {
      const largeBatch = Array.from({ length: 1000 }, (_, i) => ({
        name: `metric_${i}`,
        value: Math.random() * 100,
        unit: 'count',
        timestamp: new Date().toISOString()
      }));

      const response = await request(app)
        .post(`/api/v1/organizations/${testOrgId}/metrics/batch`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ metrics: largeBatch })
        .expect(201);

      expect(response.body.inserted).toBe(1000);
    });

    test('should reject batch sizes exceeding limits', async () => {
      const oversizedBatch = Array.from({ length: 10001 }, (_, i) => ({
        name: `metric_${i}`,
        value: Math.random() * 100,
        unit: 'count'
      }));

      await request(app)
        .post(`/api/v1/organizations/${testOrgId}/metrics/batch`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ metrics: oversizedBatch })
        .expect(413); // Payload too large
    });
  });

  describe('Metrics Querying', () => {
    beforeEach(async () => {
      // Insert test data
      const testMetrics = [
        {
          name: 'cpu_usage',
          value: 75.5,
          unit: 'percent',
          tags: { host: 'web-server-01', environment: 'production' },
          timestamp: new Date('2024-01-01T10:00:00Z')
        },
        {
          name: 'cpu_usage',
          value: 80.0,
          unit: 'percent',
          tags: { host: 'web-server-01', environment: 'production' },
          timestamp: new Date('2024-01-01T11:00:00Z')
        },
        {
          name: 'memory_usage',
          value: 2048,
          unit: 'MB',
          tags: { host: 'web-server-01', environment: 'production' },
          timestamp: new Date('2024-01-01T10:00:00Z')
        }
      ];

      for (const metric of testMetrics) {
        await request(app)
          .post(`/api/v1/organizations/${testOrgId}/metrics`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(metric);
      }
    });

    test('should query metrics by name', async () => {
      const response = await request(app)
        .get(`/api/v1/organizations/${testOrgId}/metrics`)
        .query({ name: 'cpu_usage' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBe(2);
      response.body.data.forEach(metric => {
        expect(metric.name).toBe('cpu_usage');
      });
    });

    test('should query metrics by time range', async () => {
      const response = await request(app)
        .get(`/api/v1/organizations/${testOrgId}/metrics`)
        .query({
          start_time: '2024-01-01T09:00:00Z',
          end_time: '2024-01-01T10:30:00Z'
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBe(2); // cpu_usage at 10:00 and memory_usage at 10:00
    });

    test('should query metrics by tags', async () => {
      const response = await request(app)
        .get(`/api/v1/organizations/${testOrgId}/metrics`)
        .query({ 'tags.host': 'web-server-01' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
      response.body.data.forEach(metric => {
        expect(metric.tags.host).toBe('web-server-01');
      });
    });

    test('should support pagination', async () => {
      const response = await request(app)
        .get(`/api/v1/organizations/${testOrgId}/metrics`)
        .query({ limit: 2, offset: 0 })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.length).toBe(2);
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('total');
      expect(response.body.pagination).toHaveProperty('limit', 2);
      expect(response.body.pagination).toHaveProperty('offset', 0);
    });

    test('should support sorting', async () => {
      const response = await request(app)
        .get(`/api/v1/organizations/${testOrgId}/metrics`)
        .query({ sort: 'timestamp', order: 'desc' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
      if (response.body.data.length > 1) {
        const timestamps = response.body.data.map(m => new Date(m.timestamp));
        for (let i = 1; i < timestamps.length; i++) {
          expect(timestamps[i-1].getTime()).toBeGreaterThanOrEqual(timestamps[i].getTime());
        }
      }
    });
  });

  describe('Metrics Aggregation', () => {
    beforeEach(async () => {
      // Insert test data for aggregation
      const baseTime = new Date('2024-01-01T10:00:00Z');
      for (let i = 0; i < 60; i++) {
        const timestamp = new Date(baseTime.getTime() + i * 60000); // Every minute
        await request(app)
          .post(`/api/v1/organizations/${testOrgId}/metrics`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'cpu_usage',
            value: 50 + (Math.random() * 50), // Random between 50-100
            unit: 'percent',
            tags: { host: 'web-server-01' },
            timestamp: timestamp.toISOString()
          });
      }
    });

    test('should aggregate metrics by time interval', async () => {
      const response = await request(app)
        .get(`/api/v1/organizations/${testOrgId}/metrics/aggregate`)
        .query({
          name: 'cpu_usage',
          aggregation: 'avg',
          interval: '5m',
          start_time: '2024-01-01T10:00:00Z',
          end_time: '2024-01-01T11:00:00Z'
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBe(12); // 60 minutes / 5 minute intervals
      
      response.body.data.forEach(point => {
        expect(point).toHaveProperty('timestamp');
        expect(point).toHaveProperty('value');
        expect(typeof point.value).toBe('number');
      });
    });

    test('should support different aggregation functions', async () => {
      const functions = ['avg', 'sum', 'min', 'max', 'count'];
      
      for (const func of functions) {
        const response = await request(app)
          .get(`/api/v1/organizations/${testOrgId}/metrics/aggregate`)
          .query({
            name: 'cpu_usage',
            aggregation: func,
            interval: '10m',
            start_time: '2024-01-01T10:00:00Z',
            end_time: '2024-01-01T11:00:00Z'
          })
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(Array.isArray(response.body.data)).toBe(true);
        response.body.data.forEach(point => {
          expect(point).toHaveProperty('value');
          expect(typeof point.value).toBe('number');
        });
      }
    });

    test('should group by tags', async () => {
      const response = await request(app)
        .get(`/api/v1/organizations/${testOrgId}/metrics/aggregate`)
        .query({
          name: 'cpu_usage',
          aggregation: 'avg',
          interval: '10m',
          group_by: 'host',
          start_time: '2024-01-01T10:00:00Z',
          end_time: '2024-01-01T11:00:00Z'
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('groups');
      expect(typeof response.body.groups).toBe('object');
      expect(response.body.groups).toHaveProperty('web-server-01');
      expect(Array.isArray(response.body.groups['web-server-01'])).toBe(true);
    });
  });

  describe('MetricsService Unit Tests', () => {
    test('should validate metric data structure', () => {
      const validMetric = {
        name: 'cpu_usage',
        value: 75.5,
        unit: 'percent',
        tags: { host: 'server-01' },
        timestamp: new Date().toISOString()
      };

      expect(() => MetricsService.validateMetric(validMetric)).not.toThrow();
    });

    test('should reject invalid metric data', () => {
      const invalidMetrics = [
        { value: 75.5 }, // Missing name
        { name: 'cpu', value: 'invalid' }, // Invalid value type
        { name: 'cpu', value: 75.5, tags: 'invalid' }, // Invalid tags type
      ];

      invalidMetrics.forEach(metric => {
        expect(() => MetricsService.validateMetric(metric)).toThrow();
      });
    });

    test('should generate time series data', () => {
      const startTime = new Date('2024-01-01T10:00:00Z');
      const endTime = new Date('2024-01-01T12:00:00Z');
      const interval = '30m';

      const timeSeries = MetricsService.generateTimeSeries(startTime, endTime, interval);
      
      expect(Array.isArray(timeSeries)).toBe(true);
      expect(timeSeries.length).toBe(4); // 2 hours / 30 minutes
      expect(timeSeries[0]).toEqual(startTime);
      expect(timeSeries[timeSeries.length - 1]).toEqual(new Date('2024-01-01T11:30:00Z'));
    });

    test('should calculate percentiles', () => {
      const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      
      expect(MetricsService.calculatePercentile(values, 50)).toBe(50);
      expect(MetricsService.calculatePercentile(values, 90)).toBe(90);
      expect(MetricsService.calculatePercentile(values, 95)).toBe(95);
    });
  });
});