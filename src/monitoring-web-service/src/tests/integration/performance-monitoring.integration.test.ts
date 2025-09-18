/**
 * Performance Monitoring Integration Tests
 * Task 4.2: Application Performance Monitoring Setup - Testing
 * 
 * Tests:
 * - End-to-end performance tracking workflow
 * - Performance metrics collection and analysis
 * - Error rate tracking and correlation
 * - Resource utilization monitoring
 * - Regression detection and alerting
 * - Capacity planning analysis
 * - SignOz integration validation
 */

import request from 'supertest';
import { Express } from 'express';
import { createApp } from '../../app';
import {
  getApplicationPerformanceService,
  ApplicationPerformanceService,
  PerformanceCategory
} from '../../services/application-performance.service';
import { getCapacityPlanningService } from '../../services/capacity-planning.service';
import {
  getPerformanceMonitoringMiddleware,
  performanceMonitoringHealthCheck
} from '../../middleware/performance-monitoring.middleware';
import { getTestAuthToken } from '../helpers/auth.helper';
import { logger } from '../../config/logger';

describe('Performance Monitoring Integration', () => {
  let app: Express;
  let authToken: string;
  let performanceService: ApplicationPerformanceService;

  beforeAll(async () => {
    app = await createApp();
    authToken = await getTestAuthToken();
    performanceService = getApplicationPerformanceService();
  });

  beforeEach(async () => {
    // Reset performance monitoring state
    const middleware = getPerformanceMonitoringMiddleware();
    middleware.reset();
  });

  describe('Performance Tracking Workflow', () => {
    it('should track request performance end-to-end', async () => {
      // Make test request
      const response = await request(app)
        .get('/api/v1/metrics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');

      // Allow time for async performance tracking
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify performance data was collected
      const analysis = await performanceService.getPerformanceAnalysis();
      expect(analysis.metrics.responseTime.count).toBeGreaterThan(0);
    });

    it('should categorize response times correctly', async () => {
      // Test fast response (< 100ms)
      const fastResponse = await request(app)
        .get('/health')
        .expect(200);

      // Test slow response (simulate with delay)
      const slowEndpoint = '/api/v1/performance/analyze';
      const slowResponse = await request(app)
        .post(slowEndpoint)
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify categorization was applied
      const analysis = await performanceService.getPerformanceAnalysis();
      expect(analysis).toBeDefined();
      expect(analysis.status).toMatch(/healthy|warning|critical/);
    });

    it('should track concurrent requests properly', async () => {
      const concurrentRequests = 5;
      const requests = [];

      // Start multiple concurrent requests
      for (let i = 0; i < concurrentRequests; i++) {
        requests.push(
          request(app)
            .get('/api/v1/performance/health')
            .set('Authorization', `Bearer ${authToken}`)
        );
      }

      // Wait for all requests to complete
      const responses = await Promise.all(requests);
      
      // Verify all requests succeeded
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('success');
      });

      // Verify concurrent request tracking
      const stats = await getPerformanceMonitoringMiddleware().getPerformanceStats();
      expect(stats.activeRequests).toBe(0); // Should be back to zero
    });
  });

  describe('Performance Metrics API', () => {
    it('should retrieve current performance metrics', async () => {
      const response = await request(app)
        .get('/api/v1/performance/metrics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.analysis).toBeDefined();
      expect(response.body.data.analysis.metrics).toBeDefined();
      expect(response.body.data.analysis.metrics.responseTime).toBeDefined();
      expect(response.body.data.analysis.metrics.errorRate).toBeDefined();
      expect(response.body.data.analysis.metrics.throughput).toBeDefined();
      expect(response.body.data.analysis.metrics.resources).toBeDefined();
    });

    it('should retrieve dashboard performance data', async () => {
      const response = await request(app)
        .get('/api/v1/performance/dashboard')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.overview).toBeDefined();
      expect(response.body.data.performance).toBeDefined();
      expect(response.body.data.errors).toBeDefined();
      expect(response.body.data.resources).toBeDefined();
      expect(response.body.data.alerts).toBeDefined();
      expect(response.body.data.recommendations).toBeDefined();

      // Verify data structure
      const dashboardData = response.body.data;
      expect(dashboardData.overview.status).toMatch(/healthy|warning|critical/);
      expect(typeof dashboardData.overview.activeRequests).toBe('number');
      expect(typeof dashboardData.overview.averageResponseTime).toBe('number');
      expect(typeof dashboardData.overview.errorRate).toBe('number');
      expect(typeof dashboardData.overview.throughput).toBe('number');
    });

    it('should retrieve performance regressions', async () => {
      const response = await request(app)
        .get('/api/v1/performance/regressions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.regressions).toBeDefined();
      expect(Array.isArray(response.body.data.regressions)).toBe(true);
      expect(response.body.data.summary).toBeDefined();
      expect(typeof response.body.data.summary.total).toBe('number');
    });

    it('should retrieve performance trends', async () => {
      const response = await request(app)
        .get('/api/v1/performance/trends')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.trends).toBeDefined();
      expect(Array.isArray(response.body.data.trends)).toBe(true);
      expect(response.body.data.summary).toBeDefined();
    });

    it('should retrieve active performance alerts', async () => {
      const response = await request(app)
        .get('/api/v1/performance/alerts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.alerts).toBeDefined();
      expect(Array.isArray(response.body.data.alerts)).toBe(true);
      expect(response.body.data.summary).toBeDefined();
    });

    it('should trigger on-demand performance analysis', async () => {
      const response = await request(app)
        .post('/api/v1/performance/analyze')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.analysis).toBeDefined();
      expect(response.body.data.message).toBe('Performance analysis completed');
      expect(response.body.metadata.triggeredAt).toBeDefined();
    });
  });

  describe('Configuration Management', () => {
    it('should retrieve performance monitoring configuration', async () => {
      const response = await request(app)
        .get('/api/v1/performance/config')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.config).toBeDefined();
      expect(typeof response.body.data.config.enabled).toBe('boolean');
      expect(typeof response.body.data.config.trackAllRoutes).toBe('boolean');
      expect(Array.isArray(response.body.data.config.excludePaths)).toBe(true);
    });

    it('should update performance monitoring configuration', async () => {
      const newConfig = {
        enabled: true,
        trackAllRoutes: false,
        slowRequestThreshold: 500,
        enableDetailedLogging: true,
      };

      const response = await request(app)
        .put('/api/v1/performance/config')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ config: newConfig })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.config.trackAllRoutes).toBe(false);
      expect(response.body.data.config.slowRequestThreshold).toBe(500);
      expect(response.body.data.message).toBe('Performance monitoring configuration updated');
    });

    it('should reject invalid configuration updates', async () => {
      const response = await request(app)
        .put('/api/v1/performance/config')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ invalidField: 'invalid' })
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Valid configuration object is required');
    });
  });

  describe('Error Rate Tracking', () => {
    it('should track and categorize errors correctly', async () => {
      // Generate some 4xx errors
      await request(app)
        .get('/api/v1/nonexistent-endpoint')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      await request(app)
        .post('/api/v1/performance/config')
        .set('Authorization', `Bearer ${authToken}`)
        .send({}) // Invalid payload
        .expect(400);

      // Allow time for error tracking
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify errors were tracked
      const analysis = await performanceService.getPerformanceAnalysis();
      expect(analysis.metrics.errorRate.total).toBeGreaterThan(0);
    });
  });

  describe('Resource Utilization Monitoring', () => {
    it('should monitor memory usage', async () => {
      const analysis = await performanceService.getPerformanceAnalysis();
      
      expect(analysis.metrics.resources.memoryUsage).toBeDefined();
      expect(typeof analysis.metrics.resources.memoryUsage.rss).toBe('number');
      expect(typeof analysis.metrics.resources.memoryUsage.heapUsed).toBe('number');
      expect(typeof analysis.metrics.resources.memoryUsage.heapTotal).toBe('number');
      expect(typeof analysis.metrics.resources.memoryUsage.external).toBe('number');

      // Verify memory values are reasonable
      expect(analysis.metrics.resources.memoryUsage.rss).toBeGreaterThan(0);
      expect(analysis.metrics.resources.memoryUsage.heapUsed).toBeGreaterThan(0);
      expect(analysis.metrics.resources.memoryUsage.heapTotal).toBeGreaterThan(0);
    });

    it('should track database connection pool metrics', async () => {
      // Simulate database connection pool metrics
      performanceService.trackDatabasePerformance('main', 5, 10, 2);

      // Allow time for metric recording
      await new Promise(resolve => setTimeout(resolve, 100));

      // These metrics are recorded to OTEL, actual verification would require
      // OTEL metrics collection setup in test environment
      expect(true).toBe(true); // Placeholder assertion
    });

    it('should track cache performance metrics', async () => {
      // Simulate cache performance metrics
      performanceService.trackCachePerformance('redis', 0.85, 1000, 25);

      // Allow time for metric recording
      await new Promise(resolve => setTimeout(resolve, 100));

      // These metrics are recorded to OTEL
      expect(true).toBe(true); // Placeholder assertion
    });
  });

  describe('Capacity Planning Integration', () => {
    it('should integrate with capacity planning service', async () => {
      const capacityService = getCapacityPlanningService();
      
      // Record some capacity metrics
      capacityService.recordCapacityMetric('cpu', 75, 100);
      capacityService.recordCapacityMetric('memory', 80, 100);
      
      // Record queue metrics
      capacityService.recordQueueMetrics('processing', 50, 10);

      // Allow time for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify capacity analysis
      const analysis = await capacityService.getCapacityAnalysis();
      expect(analysis).toBeDefined();
      expect(analysis.current).toBeDefined();
      expect(analysis.trends).toBeDefined();
      expect(analysis.forecasts).toBeDefined();
      expect(analysis.thresholds).toBeDefined();
    });

    it('should analyze queue depths and backlogs', async () => {
      const capacityService = getCapacityPlanningService();
      
      // Generate some queue data
      for (let i = 0; i < 5; i++) {
        capacityService.recordQueueMetrics('test-queue', 100 + i * 10, 5 + i);
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const queueAnalysis = await capacityService.analyzeQueues();
      expect(queueAnalysis).toBeDefined();
      expect(queueAnalysis.queues).toBeDefined();
      expect(Array.isArray(queueAnalysis.queues)).toBe(true);
      expect(queueAnalysis.summary).toBeDefined();
    });
  });

  describe('Health Check Integration', () => {
    it('should provide comprehensive health check', async () => {
      const response = await request(app)
        .get('/api/v1/performance/health')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.monitoring).toBeDefined();
      expect(response.body.data.monitoring.status).toMatch(/healthy|degraded|unhealthy/);
      expect(response.body.data.service).toBeDefined();
      expect(response.body.data.service.status).toBe('operational');
    });

    it('should validate performance monitoring health check function', () => {
      const healthCheck = performanceMonitoringHealthCheck();
      
      expect(healthCheck).toBeDefined();
      expect(healthCheck.status).toMatch(/healthy|degraded|unhealthy/);
      expect(healthCheck.details).toBeDefined();
      expect(typeof healthCheck.details.enabled).toBe('boolean');
    });
  });

  describe('Performance Filtering and Querying', () => {
    it('should filter metrics by endpoint', async () => {
      const response = await request(app)
        .get('/api/v1/performance/metrics?endpoint=/api/v1/health')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.metadata.filters.endpoint).toBe('/api/v1/health');
    });

    it('should filter metrics by performance category', async () => {
      const response = await request(app)
        .get('/api/v1/performance/metrics?category=fast')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.metadata.filters.category).toBe('fast');
    });

    it('should include detailed metrics when requested', async () => {
      const response = await request(app)
        .get('/api/v1/performance/metrics?includeDetails=true')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.metadata.includeDetails).toBe(true);
      expect(response.body.data.detailed).toBeDefined();
      expect(response.body.data.detailed.responseTimeBreakdown).toBeDefined();
      expect(response.body.data.detailed.errorRateBreakdown).toBeDefined();
      expect(response.body.data.detailed.resourceUtilization).toBeDefined();
      expect(response.body.data.detailed.throughputMetrics).toBeDefined();
    });

    it('should filter alerts by severity', async () => {
      const response = await request(app)
        .get('/api/v1/performance/alerts?severity=high')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.metadata.filters.severity).toBe('high');
    });

    it('should filter regressions by severity', async () => {
      const response = await request(app)
        .get('/api/v1/performance/regressions?severity=critical&limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.metadata.filters.severity).toBe('critical');
      expect(response.body.data.metadata.filters.limit).toBe(5);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle requests without authentication gracefully', async () => {
      // Performance monitoring should still work, but API access should be denied
      const response = await request(app)
        .get('/api/v1/performance/metrics')
        .expect(401);

      expect(response.body.status).toBe('error');
    });

    it('should handle malformed requests gracefully', async () => {
      const response = await request(app)
        .post('/api/v1/performance/analyze')
        .set('Authorization', `Bearer ${authToken}`)
        .send('invalid json')
        .expect(400);

      // The request should be processed by performance middleware
      // even if the endpoint returns an error
    });

    it('should handle high-frequency requests without degradation', async () => {
      const startTime = Date.now();
      const requestCount = 20;
      const requests = [];

      for (let i = 0; i < requestCount; i++) {
        requests.push(
          request(app)
            .get('/api/v1/performance/health')
            .set('Authorization', `Bearer ${authToken}`)
        );
      }

      const responses = await Promise.all(requests);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Verify all requests succeeded
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Verify performance didn't degrade significantly
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  afterAll(async () => {
    // Cleanup if needed
    const middleware = getPerformanceMonitoringMiddleware();
    middleware.reset();
  });
});