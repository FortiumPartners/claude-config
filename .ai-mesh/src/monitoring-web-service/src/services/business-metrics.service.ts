/**
 * Business Metrics Service
 * Task 4.1: Business Metrics Integration (Sprint 4)
 * 
 * Comprehensive business intelligence metrics implementation for:
 * - Custom API endpoint metrics
 * - Database performance metrics
 * - Tenant-specific metrics
 * - SignOz metrics export configuration
 */

import * as api from '@opentelemetry/api';
import { SemanticAttributes } from '@opentelemetry/semantic-conventions';
import { logger } from '../config/logger';
import { config } from '../config/environment';
import { BusinessContext } from '../tracing/business-instrumentation';

// Business Metrics Attributes
export const BusinessMetricsAttributes = {
  // API Endpoint Metrics
  'http.endpoint.route': 'http.endpoint.route',
  'http.endpoint.method': 'http.endpoint.method',
  'http.endpoint.tenant_id': 'http.endpoint.tenant_id',
  'http.endpoint.user_id': 'http.endpoint.user_id',
  'http.request.size': 'http.request.size',
  'http.response.size': 'http.response.size',
  'http.endpoint.category': 'http.endpoint.category',
  
  // Database Performance Metrics
  'db.connection_pool.active': 'db.connection_pool.active',
  'db.connection_pool.idle': 'db.connection_pool.idle',
  'db.connection_pool.max': 'db.connection_pool.max',
  'db.query.type': 'db.query.type',
  'db.query.table': 'db.query.table',
  'db.transaction.status': 'db.transaction.status',
  'db.query.duration': 'db.query.duration',
  'db.query.rows_affected': 'db.query.rows_affected',
  
  // Tenant-Specific Metrics
  'tenant.resource.type': 'tenant.resource.type',
  'tenant.api_calls.count': 'tenant.api_calls.count',
  'tenant.data.processed_bytes': 'tenant.data.processed_bytes',
  'tenant.error_rate': 'tenant.error_rate',
  'tenant.performance.avg_response_time': 'tenant.performance.avg_response_time',
  'tenant.activity.pattern': 'tenant.activity.pattern',
  
  // Application Metrics
  'app.memory.usage_bytes': 'app.memory.usage_bytes',
  'app.memory.heap_used': 'app.memory.heap_used',
  'app.memory.heap_total': 'app.memory.heap_total',
  'app.gc.type': 'app.gc.type',
  'app.gc.duration': 'app.gc.duration',
  'app.process.cpu_usage': 'app.process.cpu_usage',
} as const;

// Endpoint categories for better organization
export const EndpointCategory = {
  AUTHENTICATION: 'authentication',
  METRICS_INGESTION: 'metrics_ingestion',
  METRICS_QUERY: 'metrics_query',
  DASHBOARD: 'dashboard',
  TENANT_MANAGEMENT: 'tenant_management',
  HEALTH_CHECK: 'health_check',
  ADMIN: 'admin',
} as const;

// Database query types
export const DbQueryType = {
  SELECT: 'SELECT',
  INSERT: 'INSERT',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  UPSERT: 'UPSERT',
  TRANSACTION: 'TRANSACTION',
} as const;

// Tenant activity patterns
export const TenantActivityPattern = {
  HIGH_VOLUME: 'high_volume',     // >1000 requests/hour
  MEDIUM_VOLUME: 'medium_volume', // 100-1000 requests/hour
  LOW_VOLUME: 'low_volume',       // <100 requests/hour
  BATCH_PROCESSING: 'batch_processing',
  REAL_TIME: 'real_time',
  ONBOARDING: 'onboarding',
} as const;

/**
 * Business Metrics Configuration
 */
export interface BusinessMetricsConfig {
  enableApiMetrics: boolean;
  enableDbMetrics: boolean;
  enableTenantMetrics: boolean;
  enableApplicationMetrics: boolean;
  collectionInterval: number;
  batchSize: number;
  maxMemoryUsage: number;
}

/**
 * API Endpoint Metric Data
 */
export interface ApiEndpointMetric {
  route: string;
  method: string;
  statusCode: number;
  duration: number;
  requestSize?: number;
  responseSize?: number;
  tenantId?: string;
  userId?: string;
  category: string;
  timestamp: Date;
}

/**
 * Database Performance Metric Data
 */
export interface DatabaseMetric {
  queryType: string;
  table?: string;
  duration: number;
  rowsAffected?: number;
  tenantId?: string;
  success: boolean;
  timestamp: Date;
}

/**
 * Tenant Resource Metric Data
 */
export interface TenantResourceMetric {
  tenantId: string;
  resourceType: string;
  usage: number;
  unit: string;
  activityPattern: string;
  errorRate: number;
  avgResponseTime: number;
  timestamp: Date;
}

/**
 * Application Health Metric Data
 */
export interface ApplicationMetric {
  memoryUsage: number;
  heapUsed: number;
  heapTotal: number;
  cpuUsage: number;
  gcEvents?: Array<{ type: string; duration: number; timestamp: Date }>;
  timestamp: Date;
}

/**
 * Main Business Metrics Service
 */
export class BusinessMetricsService {
  private meter: api.Meter;
  private config: BusinessMetricsConfig;
  
  // API Metrics
  private apiRequestCounter: api.Counter;
  private apiRequestDuration: api.Histogram;
  private apiRequestSize: api.Histogram;
  private apiResponseSize: api.Histogram;
  
  // Database Metrics
  private dbConnectionsGauge: api.ObservableGauge;
  private dbQueryDuration: api.Histogram;
  private dbQueryCounter: api.Counter;
  private dbTransactionCounter: api.Counter;
  
  // Tenant Metrics
  private tenantApiCallsCounter: api.Counter;
  private tenantDataProcessedCounter: api.Counter;
  private tenantErrorRateGauge: api.ObservableGauge;
  private tenantResponseTimeGauge: api.ObservableGauge;
  
  // Application Metrics
  private appMemoryGauge: api.ObservableGauge;
  private appGcDuration: api.Histogram;
  private appCpuGauge: api.ObservableGauge;
  
  // State tracking
  private tenantStats = new Map<string, {
    apiCalls: number;
    dataProcessed: number;
    errors: number;
    responseTimes: number[];
    lastActivity: Date;
  }>();
  
  private dbConnectionStats = {
    active: 0,
    idle: 0,
    max: 0,
  };

  constructor(config: Partial<BusinessMetricsConfig> = {}) {
    this.meter = api.metrics.getMeter('fortium-business-metrics', '1.0.0');
    
    this.config = {
      enableApiMetrics: true,
      enableDbMetrics: true,
      enableTenantMetrics: true,
      enableApplicationMetrics: true,
      collectionInterval: 30000, // 30 seconds
      batchSize: 100,
      maxMemoryUsage: 10 * 1024 * 1024, // 10MB
      ...config,
    };

    this.initializeMetrics();
    this.startPeriodicCollection();
    
    logger.info('Business Metrics Service initialized', {
      event: 'business_metrics.service.initialized',
      config: this.config,
    });
  }

  /**
   * Initialize all OpenTelemetry metrics
   */
  private initializeMetrics(): void {
    // API Endpoint Metrics
    if (this.config.enableApiMetrics) {
      this.apiRequestCounter = this.meter.createCounter('http_requests_total', {
        description: 'Total number of HTTP requests by route, method, status code, and tenant'
      });

      this.apiRequestDuration = this.meter.createHistogram('http_request_duration_seconds', {
        description: 'HTTP request duration in seconds with percentile tracking',
        boundaries: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]
      });

      this.apiRequestSize = this.meter.createHistogram('http_request_size_bytes', {
        description: 'HTTP request size in bytes',
        boundaries: [0, 100, 1000, 10000, 100000, 1000000, 10000000]
      });

      this.apiResponseSize = this.meter.createHistogram('http_response_size_bytes', {
        description: 'HTTP response size in bytes',
        boundaries: [0, 100, 1000, 10000, 100000, 1000000, 10000000]
      });
    }

    // Database Performance Metrics
    if (this.config.enableDbMetrics) {
      this.dbConnectionsGauge = this.meter.createObservableGauge('db_connections_active', {
        description: 'Number of active database connections'
      });

      this.dbQueryDuration = this.meter.createHistogram('db_query_duration_seconds', {
        description: 'Database query execution time in seconds',
        boundaries: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.0, 5.0]
      });

      this.dbQueryCounter = this.meter.createCounter('db_queries_total', {
        description: 'Total number of database queries by type and tenant'
      });

      this.dbTransactionCounter = this.meter.createCounter('db_transactions_total', {
        description: 'Total number of database transactions by status and tenant'
      });

      // Register callback for connection pool metrics
      this.dbConnectionsGauge.addCallback((result) => {
        result.observe(this.dbConnectionStats.active, {
          [BusinessMetricsAttributes['db.connection_pool.active']]: 'active'
        });
        result.observe(this.dbConnectionStats.idle, {
          [BusinessMetricsAttributes['db.connection_pool.active']]: 'idle'
        });
      });
    }

    // Tenant-Specific Metrics
    if (this.config.enableTenantMetrics) {
      this.tenantApiCallsCounter = this.meter.createCounter('tenant_api_calls_total', {
        description: 'Total API calls per tenant by endpoint category'
      });

      this.tenantDataProcessedCounter = this.meter.createCounter('tenant_data_processed_bytes', {
        description: 'Total data processed per tenant by data type'
      });

      this.tenantErrorRateGauge = this.meter.createObservableGauge('tenant_error_rate', {
        description: 'Error rate per tenant'
      });

      this.tenantResponseTimeGauge = this.meter.createObservableGauge('tenant_avg_response_time_seconds', {
        description: 'Average response time per tenant'
      });

      // Register callbacks for tenant metrics
      this.tenantErrorRateGauge.addCallback((result) => {
        for (const [tenantId, stats] of this.tenantStats.entries()) {
          const errorRate = stats.errors / Math.max(stats.apiCalls, 1);
          result.observe(errorRate, { tenant_id: tenantId });
        }
      });

      this.tenantResponseTimeGauge.addCallback((result) => {
        for (const [tenantId, stats] of this.tenantStats.entries()) {
          const avgResponseTime = stats.responseTimes.length > 0 
            ? stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length / 1000
            : 0;
          result.observe(avgResponseTime, { tenant_id: tenantId });
        }
      });
    }

    // Application Health Metrics
    if (this.config.enableApplicationMetrics) {
      this.appMemoryGauge = this.meter.createObservableGauge('app_memory_usage_bytes', {
        description: 'Application memory usage by type'
      });

      this.appGcDuration = this.meter.createHistogram('app_gc_duration_seconds', {
        description: 'Garbage collection duration by GC type',
        boundaries: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0]
      });

      this.appCpuGauge = this.meter.createObservableGauge('app_cpu_usage_percent', {
        description: 'Application CPU usage percentage'
      });

      // Register callback for application metrics
      this.appMemoryGauge.addCallback((result) => {
        const memUsage = process.memoryUsage();
        result.observe(memUsage.heapUsed, { process_type: 'heap_used' });
        result.observe(memUsage.heapTotal, { process_type: 'heap_total' });
        result.observe(memUsage.rss, { process_type: 'rss' });
        result.observe(memUsage.external, { process_type: 'external' });
      });

      this.appCpuGauge.addCallback((result) => {
        const cpuUsage = process.cpuUsage();
        const totalUsage = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds
        result.observe(totalUsage, { process_type: 'total' });
      });
    }
  }

  /**
   * Record API endpoint metrics
   */
  recordApiEndpointMetric(metric: ApiEndpointMetric): void {
    if (!this.config.enableApiMetrics) return;

    const attributes = {
      [BusinessMetricsAttributes['http.endpoint.route']]: metric.route,
      [BusinessMetricsAttributes['http.endpoint.method']]: metric.method,
      [SemanticAttributes.HTTP_STATUS_CODE]: metric.statusCode,
      [BusinessMetricsAttributes['http.endpoint.category']]: metric.category,
      ...(metric.tenantId && { [BusinessMetricsAttributes['http.endpoint.tenant_id']]: metric.tenantId }),
      ...(metric.userId && { [BusinessMetricsAttributes['http.endpoint.user_id']]: metric.userId }),
    };

    // Record request count
    this.apiRequestCounter.add(1, attributes);

    // Record request duration (convert ms to seconds)
    this.apiRequestDuration.record(metric.duration / 1000, attributes);

    // Record request/response sizes
    if (metric.requestSize) {
      this.apiRequestSize.record(metric.requestSize, attributes);
    }
    if (metric.responseSize) {
      this.apiResponseSize.record(metric.responseSize, attributes);
    }

    // Update tenant statistics
    if (metric.tenantId) {
      this.updateTenantStats(metric.tenantId, {
        apiCall: true,
        error: metric.statusCode >= 400,
        responseTime: metric.duration,
      });
    }

    logger.debug('API endpoint metric recorded', {
      event: 'business_metrics.api_endpoint.recorded',
      ...attributes,
      duration: metric.duration,
    });
  }

  /**
   * Record database performance metrics
   */
  recordDatabaseMetric(metric: DatabaseMetric): void {
    if (!this.config.enableDbMetrics) return;

    const attributes = {
      [BusinessMetricsAttributes['db.query.type']]: metric.queryType,
      ...(metric.table && { [BusinessMetricsAttributes['db.query.table']]: metric.table }),
      ...(metric.tenantId && { tenant_id: metric.tenantId }),
    };

    // Record query count
    this.dbQueryCounter.add(1, {
      ...attributes,
      success: metric.success ? 'true' : 'false',
    });

    // Record query duration (convert ms to seconds)
    this.dbQueryDuration.record(metric.duration / 1000, attributes);

    // Record transaction if applicable
    if (metric.queryType === DbQueryType.TRANSACTION) {
      this.dbTransactionCounter.add(1, {
        [BusinessMetricsAttributes['db.transaction.status']]: metric.success ? 'committed' : 'rolled_back',
        ...(metric.tenantId && { tenant_id: metric.tenantId }),
      });
    }

    logger.debug('Database metric recorded', {
      event: 'business_metrics.database.recorded',
      ...attributes,
      duration: metric.duration,
      success: metric.success,
    });
  }

  /**
   * Record tenant resource usage metrics
   */
  recordTenantResourceMetric(metric: TenantResourceMetric): void {
    if (!this.config.enableTenantMetrics) return;

    const attributes = {
      tenant_id: metric.tenantId,
      [BusinessMetricsAttributes['tenant.resource.type']]: metric.resourceType,
      [BusinessMetricsAttributes['tenant.activity.pattern']]: metric.activityPattern,
    };

    // Record resource usage based on type
    if (metric.resourceType === 'api_calls') {
      this.tenantApiCallsCounter.add(metric.usage, attributes);
    } else if (metric.resourceType === 'data_processed') {
      this.tenantDataProcessedCounter.add(metric.usage, attributes);
    }

    // Update tenant statistics
    this.updateTenantStats(metric.tenantId, {
      dataProcessed: metric.usage,
      errorRate: metric.errorRate,
      avgResponseTime: metric.avgResponseTime,
    });

    logger.debug('Tenant resource metric recorded', {
      event: 'business_metrics.tenant_resource.recorded',
      tenantId: metric.tenantId,
      resourceType: metric.resourceType,
      usage: metric.usage,
    });
  }

  /**
   * Record application health metrics
   */
  recordApplicationMetric(metric: ApplicationMetric): void {
    if (!this.config.enableApplicationMetrics) return;

    // GC events are recorded via histogram when they occur
    if (metric.gcEvents) {
      for (const gcEvent of metric.gcEvents) {
        this.appGcDuration.record(gcEvent.duration / 1000, {
          [BusinessMetricsAttributes['app.gc.type']]: gcEvent.type,
        });
      }
    }

    logger.debug('Application metric recorded', {
      event: 'business_metrics.application.recorded',
      memoryUsage: metric.memoryUsage,
      cpuUsage: metric.cpuUsage,
    });
  }

  /**
   * Update database connection pool stats
   */
  updateConnectionPoolStats(active: number, idle: number, max: number): void {
    this.dbConnectionStats = { active, idle, max };
  }

  /**
   * Get current tenant statistics
   */
  getTenantStats(tenantId: string): any {
    const stats = this.tenantStats.get(tenantId);
    if (!stats) return null;

    const avgResponseTime = stats.responseTimes.length > 0 
      ? stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length
      : 0;

    const errorRate = stats.errors / Math.max(stats.apiCalls, 1);

    return {
      apiCalls: stats.apiCalls,
      dataProcessed: stats.dataProcessed,
      errors: stats.errors,
      errorRate,
      avgResponseTime,
      lastActivity: stats.lastActivity,
    };
  }

  /**
   * Get metrics export for SignOz
   */
  getMetricsExport(): {
    exportTime: Date;
    metricsCount: number;
    exportInterval: number;
    batchingEnabled: boolean;
  } {
    return {
      exportTime: new Date(),
      metricsCount: this.tenantStats.size,
      exportInterval: this.config.collectionInterval,
      batchingEnabled: this.config.batchSize > 1,
    };
  }

  /**
   * Update tenant statistics tracking
   */
  private updateTenantStats(tenantId: string, update: {
    apiCall?: boolean;
    error?: boolean;
    responseTime?: number;
    dataProcessed?: number;
    errorRate?: number;
    avgResponseTime?: number;
  }): void {
    if (!this.tenantStats.has(tenantId)) {
      this.tenantStats.set(tenantId, {
        apiCalls: 0,
        dataProcessed: 0,
        errors: 0,
        responseTimes: [],
        lastActivity: new Date(),
      });
    }

    const stats = this.tenantStats.get(tenantId)!;

    if (update.apiCall) {
      stats.apiCalls++;
    }

    if (update.error) {
      stats.errors++;
    }

    if (update.responseTime) {
      stats.responseTimes.push(update.responseTime);
      // Keep only last 100 response times to prevent memory leaks
      if (stats.responseTimes.length > 100) {
        stats.responseTimes = stats.responseTimes.slice(-100);
      }
    }

    if (update.dataProcessed) {
      stats.dataProcessed += update.dataProcessed;
    }

    stats.lastActivity = new Date();
  }

  /**
   * Start periodic metrics collection
   */
  private startPeriodicCollection(): void {
    setInterval(() => {
      this.collectApplicationMetrics();
      this.cleanupOldTenantStats();
    }, this.config.collectionInterval);
  }

  /**
   * Collect current application metrics
   */
  private collectApplicationMetrics(): void {
    if (!this.config.enableApplicationMetrics) return;

    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    this.recordApplicationMetric({
      memoryUsage: memUsage.heapUsed,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      cpuUsage: (cpuUsage.user + cpuUsage.system) / 1000000,
      timestamp: new Date(),
    });
  }

  /**
   * Clean up old tenant statistics to prevent memory leaks
   */
  private cleanupOldTenantStats(): void {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    
    for (const [tenantId, stats] of this.tenantStats.entries()) {
      if (stats.lastActivity < cutoffTime) {
        this.tenantStats.delete(tenantId);
      }
    }
  }

  /**
   * Get activity pattern for tenant based on usage
   */
  private getTenantActivityPattern(apiCallsPerHour: number): string {
    if (apiCallsPerHour > 1000) return TenantActivityPattern.HIGH_VOLUME;
    if (apiCallsPerHour > 100) return TenantActivityPattern.MEDIUM_VOLUME;
    if (apiCallsPerHour > 0) return TenantActivityPattern.LOW_VOLUME;
    return TenantActivityPattern.ONBOARDING;
  }

  /**
   * Get health status of metrics service
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    metricsEnabled: boolean;
    activeTenantsCount: number;
    memoryUsage: number;
    config: BusinessMetricsConfig;
  } {
    const memUsage = process.memoryUsage();
    const isMemoryHealthy = memUsage.heapUsed < this.config.maxMemoryUsage;
    
    return {
      status: isMemoryHealthy ? 'healthy' : 'degraded',
      metricsEnabled: this.config.enableApiMetrics || this.config.enableDbMetrics || 
                     this.config.enableTenantMetrics || this.config.enableApplicationMetrics,
      activeTenantsCount: this.tenantStats.size,
      memoryUsage: memUsage.heapUsed,
      config: this.config,
    };
  }
}

// Global service instance
let globalBusinessMetricsService: BusinessMetricsService | null = null;

/**
 * Get or create global business metrics service instance
 */
export function getBusinessMetricsService(config?: Partial<BusinessMetricsConfig>): BusinessMetricsService {
  if (!globalBusinessMetricsService) {
    globalBusinessMetricsService = new BusinessMetricsService(config);
  }
  return globalBusinessMetricsService;
}

/**
 * Helper function to categorize endpoint by route
 */
export function categorizeEndpoint(route: string, method: string): string {
  if (route.includes('/auth') || route.includes('/login') || route.includes('/logout')) {
    return EndpointCategory.AUTHENTICATION;
  }
  if (route.includes('/metrics') && method === 'POST') {
    return EndpointCategory.METRICS_INGESTION;
  }
  if (route.includes('/metrics') && (method === 'GET' || method === 'POST' && route.includes('aggregate'))) {
    return EndpointCategory.METRICS_QUERY;
  }
  if (route.includes('/dashboard')) {
    return EndpointCategory.DASHBOARD;
  }
  if (route.includes('/tenant')) {
    return EndpointCategory.TENANT_MANAGEMENT;
  }
  if (route.includes('/health') || route.includes('/status')) {
    return EndpointCategory.HEALTH_CHECK;
  }
  if (route.includes('/admin')) {
    return EndpointCategory.ADMIN;
  }
  
  return EndpointCategory.METRICS_QUERY; // Default
}