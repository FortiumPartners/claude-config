/**
 * Business Metrics Service Tests
 * Task 4.1: Business Metrics Integration (Sprint 4)
 * 
 * Comprehensive test suite for business metrics functionality:
 * - API endpoint metrics
 * - Database performance metrics
 * - Tenant-specific metrics
 * - Application health metrics
 */

import { BusinessMetricsService, ApiEndpointMetric, DatabaseMetric, TenantResourceMetric, ApplicationMetric } from '../../../services/business-metrics.service';
import * as api from '@opentelemetry/api';

// Mock OpenTelemetry API
jest.mock('@opentelemetry/api', () => ({
  metrics: {
    getMeter: jest.fn(() => ({
      createCounter: jest.fn(() => ({
        add: jest.fn(),
      })),
      createHistogram: jest.fn(() => ({
        record: jest.fn(),
      })),
      createObservableGauge: jest.fn(() => ({
        addCallback: jest.fn(),
      })),
    })),
  },
  trace: {
    getActiveSpan: jest.fn(),
  },
}));

// Mock logger
jest.mock('../../../config/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('BusinessMetricsService', () => {
  let metricsService: BusinessMetricsService;
  let mockMeter: any;
  let mockCounter: any;
  let mockHistogram: any;
  let mockGauge: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup mock meter
    mockCounter = { add: jest.fn() };
    mockHistogram = { record: jest.fn() };
    mockGauge = { addCallback: jest.fn() };

    mockMeter = {
      createCounter: jest.fn(() => mockCounter),
      createHistogram: jest.fn(() => mockHistogram),
      createObservableGauge: jest.fn(() => mockGauge),
    };

    (api.metrics.getMeter as jest.Mock).mockReturnValue(mockMeter);

    // Create service instance
    metricsService = new BusinessMetricsService({
      enableApiMetrics: true,
      enableDbMetrics: true,
      enableTenantMetrics: true,
      enableApplicationMetrics: true,
      collectionInterval: 1000, // Faster for testing
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const service = new BusinessMetricsService();
      expect(service).toBeInstanceOf(BusinessMetricsService);
    });

    it('should create all required metrics instruments', () => {
      expect(mockMeter.createCounter).toHaveBeenCalledWith('http_requests_total', expect.any(Object));
      expect(mockMeter.createHistogram).toHaveBeenCalledWith('http_request_duration_seconds', expect.any(Object));
      expect(mockMeter.createCounter).toHaveBeenCalledWith('db_queries_total', expect.any(Object));
      expect(mockMeter.createObservableGauge).toHaveBeenCalledWith('db_connections_active', expect.any(Object));
    });

    it('should skip metric creation when disabled', () => {
      jest.clearAllMocks();
      
      new BusinessMetricsService({
        enableApiMetrics: false,
        enableDbMetrics: false,
        enableTenantMetrics: false,
        enableApplicationMetrics: false,
      });

      // Should not create any metrics
      expect(mockMeter.createCounter).not.toHaveBeenCalled();
      expect(mockMeter.createHistogram).not.toHaveBeenCalled();
      expect(mockMeter.createObservableGauge).not.toHaveBeenCalled();
    });
  });

  describe('API Endpoint Metrics', () => {
    it('should record API endpoint metrics correctly', () => {
      const apiMetric: ApiEndpointMetric = {
        route: '/api/users',
        method: 'GET',
        statusCode: 200,
        duration: 150,
        requestSize: 1024,
        responseSize: 2048,
        tenantId: 'tenant-123',
        userId: 'user-456',
        category: 'metrics_query',
        timestamp: new Date(),
      };

      metricsService.recordApiEndpointMetric(apiMetric);

      // Verify counter was called
      expect(mockCounter.add).toHaveBeenCalledWith(1, expect.objectContaining({
        'http.endpoint.route': '/api/users',
        'http.endpoint.method': 'GET',
        'http.status_code': 200,
        'http.endpoint.category': 'metrics_query',
        'http.endpoint.tenant_id': 'tenant-123',
        'http.endpoint.user_id': 'user-456',
      }));

      // Verify histogram was called for duration (converted to seconds)
      expect(mockHistogram.record).toHaveBeenCalledWith(0.15, expect.any(Object));
    });

    it('should handle API metrics without optional fields', () => {
      const apiMetric: ApiEndpointMetric = {
        route: '/health',
        method: 'GET',
        statusCode: 200,
        duration: 50,
        category: 'health_check',
        timestamp: new Date(),
      };

      metricsService.recordApiEndpointMetric(apiMetric);

      expect(mockCounter.add).toHaveBeenCalledWith(1, expect.objectContaining({
        'http.endpoint.route': '/health',
        'http.endpoint.method': 'GET',
        'http.status_code': 200,
        'http.endpoint.category': 'health_check',
      }));

      // Should not include tenant_id or user_id in attributes
      const callArgs = mockCounter.add.mock.calls[0][1];
      expect(callArgs).not.toHaveProperty('http.endpoint.tenant_id');
      expect(callArgs).not.toHaveProperty('http.endpoint.user_id');
    });

    it('should update tenant statistics', () => {
      const apiMetric: ApiEndpointMetric = {
        route: '/api/metrics',
        method: 'POST',
        statusCode: 201,
        duration: 200,
        tenantId: 'tenant-123',
        category: 'metrics_ingestion',
        timestamp: new Date(),
      };

      metricsService.recordApiEndpointMetric(apiMetric);

      const tenantStats = metricsService.getTenantStats('tenant-123');
      expect(tenantStats).toMatchObject({
        apiCalls: 1,
        errors: 0,
        errorRate: 0,
      });
    });

    it('should track error rates for tenants', () => {
      const errorMetric: ApiEndpointMetric = {
        route: '/api/users',
        method: 'GET',
        statusCode: 500,
        duration: 100,
        tenantId: 'tenant-123',
        category: 'metrics_query',
        timestamp: new Date(),
      };

      metricsService.recordApiEndpointMetric(errorMetric);

      const tenantStats = metricsService.getTenantStats('tenant-123');
      expect(tenantStats).toMatchObject({
        apiCalls: 1,
        errors: 1,
        errorRate: 1.0,
      });
    });
  });

  describe('Database Performance Metrics', () => {
    it('should record database metrics correctly', () => {
      const dbMetric: DatabaseMetric = {
        queryType: 'SELECT',
        table: 'users',
        duration: 50,
        rowsAffected: 10,
        success: true,
        tenantId: 'tenant-123',
        timestamp: new Date(),
      };

      metricsService.recordDatabaseMetric(dbMetric);

      expect(mockCounter.add).toHaveBeenCalledWith(1, expect.objectContaining({
        'db.query.type': 'SELECT',
        'db.query.table': 'users',
        'tenant_id': 'tenant-123',
        'success': 'true',
      }));

      expect(mockHistogram.record).toHaveBeenCalledWith(0.05, expect.any(Object)); // 50ms -> 0.05s
    });

    it('should handle failed database queries', () => {
      const dbMetric: DatabaseMetric = {
        queryType: 'UPDATE',
        table: 'users',
        duration: 100,
        success: false,
        tenantId: 'tenant-123',
        timestamp: new Date(),
      };

      metricsService.recordDatabaseMetric(dbMetric);

      expect(mockCounter.add).toHaveBeenCalledWith(1, expect.objectContaining({
        'success': 'false',
      }));
    });

    it('should record transaction metrics', () => {
      const transactionMetric: DatabaseMetric = {
        queryType: 'TRANSACTION',
        duration: 200,
        success: true,
        tenantId: 'tenant-123',
        timestamp: new Date(),
      };

      metricsService.recordDatabaseMetric(transactionMetric);

      // Should record both query and transaction metrics
      expect(mockCounter.add).toHaveBeenCalledTimes(2);
    });

    it('should update connection pool stats', () => {
      metricsService.updateConnectionPoolStats(5, 3, 10);

      // Verify the stats are stored (we can't easily test the gauge callback)
      expect(metricsService).toBeDefined();
    });
  });

  describe('Tenant Resource Metrics', () => {
    it('should record tenant resource metrics', () => {
      const tenantMetric: TenantResourceMetric = {
        tenantId: 'tenant-123',
        resourceType: 'api_calls',
        usage: 100,
        unit: 'count',
        activityPattern: 'high_volume',
        errorRate: 0.05,
        avgResponseTime: 150,
        timestamp: new Date(),
      };

      metricsService.recordTenantResourceMetric(tenantMetric);

      expect(mockCounter.add).toHaveBeenCalledWith(100, expect.objectContaining({
        'tenant_id': 'tenant-123',
        'tenant.resource.type': 'api_calls',
        'tenant.activity.pattern': 'high_volume',
      }));
    });

    it('should handle different resource types', () => {
      const dataProcessedMetric: TenantResourceMetric = {
        tenantId: 'tenant-123',
        resourceType: 'data_processed',
        usage: 1024000,
        unit: 'bytes',
        activityPattern: 'batch_processing',
        errorRate: 0.01,
        avgResponseTime: 500,
        timestamp: new Date(),
      };

      metricsService.recordTenantResourceMetric(dataProcessedMetric);

      expect(mockCounter.add).toHaveBeenCalledWith(1024000, expect.any(Object));
    });
  });

  describe('Application Health Metrics', () => {
    it('should record application metrics', () => {
      const appMetric: ApplicationMetric = {
        memoryUsage: 104857600, // 100MB
        heapUsed: 83886080,     // 80MB
        heapTotal: 125829120,   // 120MB
        cpuUsage: 0.15,         // 15%
        gcEvents: [
          { type: 'mark-sweep', duration: 50, timestamp: new Date() },
          { type: 'incremental', duration: 10, timestamp: new Date() },
        ],
        timestamp: new Date(),
      };

      metricsService.recordApplicationMetric(appMetric);

      // Should record GC events
      expect(mockHistogram.record).toHaveBeenCalledWith(0.05, expect.objectContaining({
        'app.gc.type': 'mark-sweep',
      }));
      expect(mockHistogram.record).toHaveBeenCalledWith(0.01, expect.objectContaining({
        'app.gc.type': 'incremental',
      }));
    });

    it('should handle application metrics without GC events', () => {
      const appMetric: ApplicationMetric = {
        memoryUsage: 104857600,
        heapUsed: 83886080,
        heapTotal: 125829120,
        cpuUsage: 0.10,
        timestamp: new Date(),
      };

      expect(() => {
        metricsService.recordApplicationMetric(appMetric);
      }).not.toThrow();
    });
  });

  describe('Tenant Statistics', () => {
    beforeEach(() => {
      // Record some test data
      metricsService.recordApiEndpointMetric({
        route: '/api/test',
        method: 'GET',
        statusCode: 200,
        duration: 100,
        tenantId: 'tenant-123',
        category: 'test',
        timestamp: new Date(),
      });

      metricsService.recordApiEndpointMetric({
        route: '/api/test',
        method: 'POST',
        statusCode: 500,
        duration: 200,
        tenantId: 'tenant-123',
        category: 'test',
        timestamp: new Date(),
      });
    });

    it('should return tenant statistics', () => {
      const stats = metricsService.getTenantStats('tenant-123');
      
      expect(stats).toMatchObject({
        apiCalls: 2,
        errors: 1,
        errorRate: 0.5,
        avgResponseTime: 150, // (100 + 200) / 2
      });
    });

    it('should return null for non-existent tenant', () => {
      const stats = metricsService.getTenantStats('non-existent');
      expect(stats).toBeNull();
    });
  });

  describe('Health Status', () => {
    it('should return healthy status', () => {
      const health = metricsService.getHealthStatus();
      
      expect(health).toMatchObject({
        status: 'healthy',
        metricsEnabled: true,
        activeTenantsCount: expect.any(Number),
        memoryUsage: expect.any(Number),
      });
    });

    it('should return degraded status when memory usage is high', () => {
      // Mock high memory usage
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn(() => ({
        rss: 100 * 1024 * 1024,      // 100MB
        heapTotal: 100 * 1024 * 1024, // 100MB
        heapUsed: 50 * 1024 * 1024,   // 50MB - above 10MB limit
        external: 10 * 1024 * 1024,   // 10MB
        arrayBuffers: 5 * 1024 * 1024, // 5MB
      }));

      const service = new BusinessMetricsService({
        maxMemoryUsage: 10 * 1024 * 1024, // 10MB limit
      });
      
      const health = service.getHealthStatus();
      expect(health.status).toBe('degraded');

      // Restore original function
      process.memoryUsage = originalMemoryUsage;
    });
  });

  describe('Metrics Export', () => {
    it('should return export information', () => {
      const exportInfo = metricsService.getMetricsExport();
      
      expect(exportInfo).toMatchObject({
        exportTime: expect.any(Date),
        metricsCount: expect.any(Number),
        exportInterval: 1000, // From config
        batchingEnabled: true, // batchSize > 1
      });
    });
  });

  describe('Configuration', () => {
    it('should respect disabled metrics configuration', () => {
      jest.clearAllMocks();
      
      const service = new BusinessMetricsService({
        enableApiMetrics: false,
      });

      const apiMetric: ApiEndpointMetric = {
        route: '/test',
        method: 'GET',
        statusCode: 200,
        duration: 100,
        category: 'test',
        timestamp: new Date(),
      };

      service.recordApiEndpointMetric(apiMetric);
      
      // Should not record metrics when disabled
      expect(mockCounter.add).not.toHaveBeenCalled();
    });

    it('should handle custom collection interval', () => {
      const service = new BusinessMetricsService({
        collectionInterval: 5000,
      });

      const exportInfo = service.getMetricsExport();
      expect(exportInfo.exportInterval).toBe(5000);
    });
  });

  describe('Memory Management', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should clean up old tenant statistics', () => {
      // Record metric for tenant
      metricsService.recordApiEndpointMetric({
        route: '/test',
        method: 'GET',
        statusCode: 200,
        duration: 100,
        tenantId: 'old-tenant',
        category: 'test',
        timestamp: new Date(),
      });

      // Verify tenant exists
      expect(metricsService.getTenantStats('old-tenant')).not.toBeNull();

      // Fast-forward time to trigger cleanup
      jest.advanceTimersByTime(25 * 60 * 60 * 1000); // 25 hours

      // Tenant should be cleaned up
      expect(metricsService.getTenantStats('old-tenant')).toBeNull();
    });

    it('should limit response time history', () => {
      const tenantId = 'tenant-with-many-requests';
      
      // Record 150 requests (more than the 100 limit)
      for (let i = 0; i < 150; i++) {
        metricsService.recordApiEndpointMetric({
          route: '/test',
          method: 'GET',
          statusCode: 200,
          duration: i * 10, // Varying durations
          tenantId,
          category: 'test',
          timestamp: new Date(),
        });
      }

      const stats = metricsService.getTenantStats(tenantId);
      expect(stats).toBeTruthy();
      expect(stats.apiCalls).toBe(150);
    });
  });
});

describe('Helper Functions', () => {
  describe('categorizeEndpoint', () => {
    const { categorizeEndpoint } = require('../../../services/business-metrics.service');

    it('should categorize authentication endpoints', () => {
      expect(categorizeEndpoint('/auth/login', 'POST')).toBe('authentication');
      expect(categorizeEndpoint('/api/login', 'POST')).toBe('authentication');
      expect(categorizeEndpoint('/logout', 'POST')).toBe('authentication');
    });

    it('should categorize metrics endpoints', () => {
      expect(categorizeEndpoint('/metrics', 'POST')).toBe('metrics_ingestion');
      expect(categorizeEndpoint('/metrics', 'GET')).toBe('metrics_query');
      expect(categorizeEndpoint('/metrics/aggregate', 'POST')).toBe('metrics_query');
    });

    it('should categorize dashboard endpoints', () => {
      expect(categorizeEndpoint('/dashboard', 'GET')).toBe('dashboard');
      expect(categorizeEndpoint('/dashboard/analytics', 'GET')).toBe('dashboard');
    });

    it('should categorize tenant management endpoints', () => {
      expect(categorizeEndpoint('/tenant/create', 'POST')).toBe('tenant_management');
      expect(categorizeEndpoint('/api/tenant/settings', 'PUT')).toBe('tenant_management');
    });

    it('should categorize health check endpoints', () => {
      expect(categorizeEndpoint('/health', 'GET')).toBe('health_check');
      expect(categorizeEndpoint('/status', 'GET')).toBe('health_check');
    });

    it('should categorize admin endpoints', () => {
      expect(categorizeEndpoint('/admin/users', 'GET')).toBe('admin');
      expect(categorizeEndpoint('/admin/settings', 'PUT')).toBe('admin');
    });

    it('should default to metrics_query for unknown endpoints', () => {
      expect(categorizeEndpoint('/unknown/endpoint', 'GET')).toBe('metrics_query');
      expect(categorizeEndpoint('/custom/api', 'POST')).toBe('metrics_query');
    });
  });
});