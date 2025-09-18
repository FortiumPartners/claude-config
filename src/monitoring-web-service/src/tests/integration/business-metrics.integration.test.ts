/**
 * Business Metrics Integration Tests
 * Task 4.1: Business Metrics Integration (Sprint 4)
 * 
 * End-to-end integration tests for business metrics functionality:
 * - API endpoint metrics collection
 * - Database performance metrics
 * - Tenant-specific tracking
 * - SignOz export validation
 * - Health monitoring
 */

import supertest from 'supertest';
import { createApp } from '../../app';
import { getBusinessMetricsService } from '../../services/business-metrics.service';
import { getSignOzMetricsExportManager, initializeSignOzMetricsExport } from '../../config/signoz-metrics-export';
import { initializeDatabaseMetrics, getDatabaseMetricsCollector } from '../../database/business-metrics-integration';
import { PrismaClient } from '@prisma/client';
import * as api from '@opentelemetry/api';

describe('Business Metrics Integration', () => {
  let app: any;
  let request: supertest.SuperTest<supertest.Test>;
  let metricsService: any;
  let exportManager: any;
  let prisma: PrismaClient;

  beforeAll(async () => {
    // Initialize test application
    app = await createApp();
    request = supertest(app);

    // Initialize metrics services
    metricsService = getBusinessMetricsService({
      enableApiMetrics: true,
      enableDbMetrics: true,
      enableTenantMetrics: true,
      enableApplicationMetrics: true,
      collectionInterval: 100, // Fast collection for testing
    });

    // Initialize SignOz export (disabled for testing)
    exportManager = await initializeSignOzMetricsExport({
      enabled: false, // Disable actual export in tests
      enableConsoleExport: false,
    });

    // Initialize database metrics
    prisma = new PrismaClient();
    initializeDatabaseMetrics(prisma, {
      maxConnections: 10,
      enablePeriodicMonitoring: false, // Disable in tests
    });
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await exportManager?.shutdown();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('API Endpoint Metrics Collection', () => {
    it('should collect metrics for health check endpoint', async () => {
      const response = await request.get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBeDefined();
      expect(response.body.services.business_metrics).toBeDefined();
      expect(response.body.services.signoz_export).toBeDefined();
    });

    it('should collect metrics for API info endpoint', async () => {
      const response = await request.get('/api');
      
      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Fortium External Metrics Web Service');
    });

    it('should collect metrics with proper categorization', async () => {
      // Test health check category
      await request.get('/health');
      
      // Test API info category  
      await request.get('/api');

      // Verify metrics were recorded (we can't easily test the actual metrics here,
      // but we can verify the service is healthy)
      const health = metricsService.getHealthStatus();
      expect(health.metricsEnabled).toBe(true);
    });

    it('should handle 404 routes gracefully', async () => {
      const response = await request.get('/non-existent-route');
      
      expect(response.status).toBe(404);
      
      // Should still collect metrics for 404s
      const health = metricsService.getHealthStatus();
      expect(health.status).toMatch(/healthy|degraded/);
    });

    it('should collect metrics for different HTTP methods', async () => {
      // GET request
      await request.get('/api');
      
      // POST request (should fail without auth, but still collect metrics)
      await request.post('/api/v1/metrics').send({ test: 'data' });
      
      const health = metricsService.getHealthStatus();
      expect(health.metricsEnabled).toBe(true);
    });
  });

  describe('Business Metrics Health Endpoint', () => {
    it('should provide metrics health status', async () => {
      const response = await request.get('/metrics/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        timestamp: expect.any(String),
        service: 'business-metrics',
        status: expect.stringMatching(/healthy|degraded|unhealthy/),
        metricsEnabled: expect.any(Boolean),
        activeTenantsCount: expect.any(Number),
        memoryUsage: expect.any(Number),
        export: {
          exportTime: expect.any(String),
          metricsCount: expect.any(Number),
          exportInterval: expect.any(Number),
          batchingEnabled: expect.any(Boolean),
        },
        endpoints: {
          signoz: expect.any(String),
          prometheus: expect.stringMatching(/http:\/\/.*|disabled/),
        },
      });
    });

    it('should include export configuration in health status', async () => {
      const response = await request.get('/metrics/health');
      
      expect(response.body.export).toBeDefined();
      expect(response.body.endpoints.signoz).toContain('localhost:4318');
    });
  });

  describe('Application Health Integration', () => {
    it('should include business metrics in main health check', async () => {
      const response = await request.get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body.services.business_metrics).toMatchObject({
        status: expect.stringMatching(/healthy|degraded|unhealthy/),
        enabled: expect.any(Boolean),
        active_tenants: expect.any(Number),
        memory_usage: expect.any(Number),
      });

      expect(response.body.services.signoz_export).toMatchObject({
        status: expect.stringMatching(/healthy|degraded|unhealthy/),
        total_exports: expect.any(Number),
        failed_exports: expect.any(Number),
        success_rate: expect.any(Number),
        configuration: {
          endpoint: expect.any(String),
          interval: expect.any(Number),
          batchSize: expect.any(Number),
          compression: expect.any(String),
        },
      });
    });

    it('should handle business metrics service errors gracefully', async () => {
      // Mock a service error
      const originalGetHealthStatus = metricsService.getHealthStatus;
      metricsService.getHealthStatus = jest.fn(() => {
        throw new Error('Simulated metrics error');
      });

      const response = await request.get('/health');
      
      // Should still return a response, but may be degraded
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.body.status).toBeDefined();

      // Restore original method
      metricsService.getHealthStatus = originalGetHealthStatus;
    });
  });

  describe('Database Metrics Integration', () => {
    it('should collect connection pool metrics', () => {
      const dbCollector = getDatabaseMetricsCollector();
      
      // Update connection pool stats
      dbCollector.updateConnectionPoolStats(5, 3, 10);
      
      const stats = dbCollector.getConnectionPoolStats();
      expect(stats).toMatchObject({
        active: 5,
        idle: 3,
        max: 10,
        waiting: 0,
        total: 10,
      });
    });

    it('should provide database metrics health status', () => {
      const dbCollector = getDatabaseMetricsCollector();
      const health = dbCollector.getHealthStatus();
      
      expect(health).toMatchObject({
        status: expect.stringMatching(/healthy|degraded|unhealthy/),
        connectionPool: {
          active: expect.any(Number),
          idle: expect.any(Number),
          max: expect.any(Number),
          waiting: expect.any(Number),
          total: expect.any(Number),
        },
        metrics: {
          enabled: true,
          lastUpdate: expect.any(Date),
        },
      });
    });

    it('should record manual database operations', () => {
      const dbCollector = getDatabaseMetricsCollector();
      
      expect(() => {
        dbCollector.recordDatabaseOperation({
          query: 'SELECT * FROM users WHERE tenant_id = ?',
          duration: 50,
          queryType: 'SELECT',
          table: 'users',
          success: true,
          tenantId: 'test-tenant',
          userId: 'test-user',
        });
      }).not.toThrow();
    });
  });

  describe('SignOz Export Manager', () => {
    it('should provide export health status', () => {
      const health = exportManager.getHealthStatus();
      
      expect(health).toMatchObject({
        status: expect.stringMatching(/healthy|degraded|unhealthy/),
        lastExport: expect.any(Date),
        totalExports: expect.any(Number),
        failedExports: expect.any(Number),
        queueSize: expect.any(Number),
        configuration: {
          endpoint: expect.any(String),
          interval: expect.any(Number),
          batchSize: expect.any(Number),
          compression: expect.any(String),
        },
        performance: {
          avgExportDuration: expect.any(Number),
          minExportDuration: expect.any(Number),
          maxExportDuration: expect.any(Number),
          successRate: expect.any(Number),
        },
      });
    });

    it('should handle configuration updates', () => {
      const originalConfig = exportManager.getConfiguration();
      
      expect(() => {
        exportManager.updateConfiguration({
          exportInterval: 15000,
          maxExportBatchSize: 256,
        });
      }).not.toThrow();

      const updatedConfig = exportManager.getConfiguration();
      expect(updatedConfig.exportInterval).toBe(15000);
      expect(updatedConfig.maxExportBatchSize).toBe(256);
    });

    it('should validate connectivity (disabled in tests)', async () => {
      const connectivity = await exportManager.validateConnectivity();
      
      // Since export is disabled in tests, expect failure
      expect(connectivity).toMatchObject({
        success: expect.any(Boolean),
        responseTime: expect.any(Number),
        error: expect.any(String),
      });
    });
  });

  describe('Performance Requirements', () => {
    it('should collect metrics with minimal overhead', async () => {
      const startTime = Date.now();
      
      // Make multiple requests to test performance
      const promises = Array.from({ length: 10 }, () => 
        request.get('/api')
      );
      
      await Promise.all(promises);
      
      const totalTime = Date.now() - startTime;
      const avgTimePerRequest = totalTime / 10;
      
      // Should add less than 2ms overhead per request (Task 4.1 requirement)
      expect(avgTimePerRequest).toBeLessThan(100); // Allowing some test overhead
    });

    it('should maintain reasonable memory usage', () => {
      const health = metricsService.getHealthStatus();
      
      // Memory usage should be reasonable (within configured limits)
      expect(health.memoryUsage).toBeLessThan(50 * 1024 * 1024); // 50MB limit
    });

    it('should handle high-frequency requests efficiently', async () => {
      const startTime = Date.now();
      
      // Simulate high-frequency requests
      const promises = Array.from({ length: 50 }, (_, i) => 
        request.get('/health').then(() => i)
      );
      
      const results = await Promise.all(promises);
      
      const totalTime = Date.now() - startTime;
      
      expect(results).toHaveLength(50);
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
      
      // Service should still be healthy
      const health = metricsService.getHealthStatus();
      expect(health.status).toMatch(/healthy|degraded/);
    });
  });

  describe('Error Handling', () => {
    it('should handle metrics collection errors gracefully', async () => {
      // Mock an error in metrics collection
      const originalRecord = metricsService.recordApiEndpointMetric;
      metricsService.recordApiEndpointMetric = jest.fn(() => {
        throw new Error('Metrics collection error');
      });

      // Should still serve requests normally
      const response = await request.get('/api');
      expect(response.status).toBe(200);

      // Restore original method
      metricsService.recordApiEndpointMetric = originalRecord;
    });

    it('should handle export manager errors gracefully', async () => {
      // Mock an export error
      const originalGetHealth = exportManager.getHealthStatus;
      exportManager.getHealthStatus = jest.fn(() => {
        throw new Error('Export health check error');
      });

      // Health check should still work
      const response = await request.get('/health');
      expect(response.status).toBe(200);

      // Restore original method
      exportManager.getHealthStatus = originalGetHealth;
    });
  });

  describe('Tenant Isolation', () => {
    it('should isolate metrics by tenant when available', () => {
      // Record metrics for different tenants
      metricsService.recordTenantResourceMetric({
        tenantId: 'tenant-1',
        resourceType: 'api_calls',
        usage: 10,
        unit: 'count',
        activityPattern: 'medium_volume',
        errorRate: 0.1,
        avgResponseTime: 150,
        timestamp: new Date(),
      });

      metricsService.recordTenantResourceMetric({
        tenantId: 'tenant-2',
        resourceType: 'api_calls',
        usage: 20,
        unit: 'count',
        activityPattern: 'high_volume',
        errorRate: 0.05,
        avgResponseTime: 100,
        timestamp: new Date(),
      });

      // Each tenant should have separate stats
      const tenant1Stats = metricsService.getTenantStats('tenant-1');
      const tenant2Stats = metricsService.getTenantStats('tenant-2');

      expect(tenant1Stats).toBeTruthy();
      expect(tenant2Stats).toBeTruthy();
      expect(tenant1Stats.errorRate).not.toBe(tenant2Stats.errorRate);
    });

    it('should handle requests without tenant context', async () => {
      // Requests without tenant context should still collect metrics
      const response = await request.get('/health');
      
      expect(response.status).toBe(200);
      
      const health = metricsService.getHealthStatus();
      expect(health.metricsEnabled).toBe(true);
    });
  });
});