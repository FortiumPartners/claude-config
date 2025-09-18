/**
 * Business Metrics Middleware
 * Task 4.1: Business Metrics Integration (Sprint 4)
 * 
 * Express middleware for automatic collection of business metrics:
 * - API endpoint metrics with tenant isolation
 * - Request/response tracking
 * - Performance monitoring
 * - Error tracking
 */

import { Request, Response, NextFunction } from 'express';
import { getBusinessMetricsService, categorizeEndpoint, ApiEndpointMetric } from '../services/business-metrics.service';
import { logger } from '../config/logger';
import * as api from '@opentelemetry/api';

// Extended Request interface for metrics tracking
interface MetricsRequest extends Request {
  startTime?: number;
  metricsData?: {
    route: string;
    method: string;
    tenantId?: string;
    userId?: string;
    requestSize?: number;
  };
}

/**
 * Business Metrics Collection Middleware
 * Automatically collects API endpoint metrics for all requests
 */
export function businessMetricsMiddleware() {
  const metricsService = getBusinessMetricsService();

  return (req: MetricsRequest, res: Response, next: NextFunction) => {
    // Record start time
    req.startTime = Date.now();

    // Extract basic request information
    const route = getCleanRoute(req.route?.path || req.path);
    const method = req.method;
    const requestSize = getRequestSize(req);

    // Store metrics data for response processing
    req.metricsData = {
      route,
      method,
      requestSize,
    };

    // Extract tenant and user context if available
    if (req.tenant?.id) {
      req.metricsData.tenantId = req.tenant.id;
    }
    if (req.user?.id) {
      req.metricsData.userId = req.user.id;
    }

    // Hook into response finish event
    const originalSend = res.send;
    res.send = function(body: any) {
      // Calculate response time
      const duration = Date.now() - (req.startTime || Date.now());
      const statusCode = res.statusCode;
      const responseSize = getResponseSize(body);

      // Create endpoint metric
      const endpointMetric: ApiEndpointMetric = {
        route: req.metricsData?.route || route,
        method: req.metricsData?.method || method,
        statusCode,
        duration,
        requestSize: req.metricsData?.requestSize,
        responseSize,
        tenantId: req.metricsData?.tenantId,
        userId: req.metricsData?.userId,
        category: categorizeEndpoint(route, method),
        timestamp: new Date(),
      };

      // Record metrics asynchronously to avoid blocking response
      setImmediate(() => {
        try {
          metricsService.recordApiEndpointMetric(endpointMetric);
          
          // Add business context to current OTEL span if available
          const currentSpan = api.trace.getActiveSpan();
          if (currentSpan) {
            currentSpan.setAttributes({
              'business.api.category': endpointMetric.category,
              'business.api.tenant_id': endpointMetric.tenantId || 'unknown',
              'business.api.response_time_ms': duration,
              'business.api.request_size_bytes': requestSize || 0,
              'business.api.response_size_bytes': responseSize || 0,
            });
          }
        } catch (error) {
          logger.error('Failed to record business metrics', {
            event: 'business_metrics.middleware.error',
            error: error.message,
            route,
            method,
            statusCode,
          });
        }
      });

      // Call original send method
      return originalSend.call(this, body);
    };

    next();
  };
}

/**
 * Database Metrics Middleware
 * Records database performance metrics from request context
 */
export function databaseMetricsMiddleware() {
  const metricsService = getBusinessMetricsService();

  return (req: Request, res: Response, next: NextFunction) => {
    // Add database metrics recording function to request context
    (req as any).recordDbMetric = (queryType: string, duration: number, options: {
      table?: string;
      success?: boolean;
      rowsAffected?: number;
    } = {}) => {
      try {
        metricsService.recordDatabaseMetric({
          queryType,
          duration,
          table: options.table,
          success: options.success !== false, // Default to true
          rowsAffected: options.rowsAffected,
          tenantId: (req as any).tenant?.id,
          timestamp: new Date(),
        });
      } catch (error) {
        logger.error('Failed to record database metric', {
          event: 'business_metrics.database.error',
          error: error.message,
          queryType,
          duration,
        });
      }
    };

    next();
  };
}

/**
 * Tenant Resource Tracking Middleware
 * Tracks tenant-specific resource usage patterns
 */
export function tenantResourceTrackingMiddleware() {
  const metricsService = getBusinessMetricsService();
  const tenantActivityCache = new Map<string, {
    requestCount: number;
    lastReset: number;
    dataProcessed: number;
    errors: number;
  }>();

  // Reset counters every hour
  const RESET_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds

  return (req: Request, res: Response, next: NextFunction) => {
    const tenantId = (req as any).tenant?.id;
    if (!tenantId) {
      return next();
    }

    const now = Date.now();
    
    // Initialize or get tenant activity data
    if (!tenantActivityCache.has(tenantId)) {
      tenantActivityCache.set(tenantId, {
        requestCount: 0,
        lastReset: now,
        dataProcessed: 0,
        errors: 0,
      });
    }

    const tenantActivity = tenantActivityCache.get(tenantId)!;

    // Reset counters if interval has passed
    if (now - tenantActivity.lastReset > RESET_INTERVAL) {
      tenantActivity.requestCount = 0;
      tenantActivity.lastReset = now;
      tenantActivity.dataProcessed = 0;
      tenantActivity.errors = 0;
    }

    // Increment request count
    tenantActivity.requestCount++;

    // Hook into response to track completion
    const originalEnd = res.end;
    res.end = function(chunk?: any, encoding?: any) {
      try {
        const isError = res.statusCode >= 400;
        if (isError) {
          tenantActivity.errors++;
        }

        // Estimate data processed (request + response size)
        const requestSize = getRequestSize(req) || 0;
        const responseSize = getResponseSize(chunk) || 0;
        tenantActivity.dataProcessed += requestSize + responseSize;

        // Calculate activity pattern
        const requestsPerHour = tenantActivity.requestCount;
        const activityPattern = getActivityPattern(requestsPerHour);
        const errorRate = tenantActivity.errors / Math.max(tenantActivity.requestCount, 1);

        // Get current tenant stats for avg response time
        const tenantStats = metricsService.getTenantStats(tenantId);
        const avgResponseTime = tenantStats?.avgResponseTime || 0;

        // Record tenant resource metrics
        metricsService.recordTenantResourceMetric({
          tenantId,
          resourceType: 'api_calls',
          usage: 1,
          unit: 'count',
          activityPattern,
          errorRate,
          avgResponseTime,
          timestamp: new Date(),
        });

        // Record data processed if significant
        if (tenantActivity.dataProcessed > 1024) { // More than 1KB
          metricsService.recordTenantResourceMetric({
            tenantId,
            resourceType: 'data_processed',
            usage: tenantActivity.dataProcessed,
            unit: 'bytes',
            activityPattern,
            errorRate,
            avgResponseTime,
            timestamp: new Date(),
          });
          
          // Reset data processed counter after recording
          tenantActivity.dataProcessed = 0;
        }

      } catch (error) {
        logger.error('Failed to record tenant resource metrics', {
          event: 'business_metrics.tenant.error',
          error: error.message,
          tenantId,
        });
      }

      return originalEnd.call(this, chunk, encoding);
    };

    next();
  };
}

/**
 * Performance Monitoring Middleware
 * Tracks application performance metrics and alerts on anomalies
 */
export function performanceMonitoringMiddleware() {
  const metricsService = getBusinessMetricsService();
  let lastGcCheck = Date.now();
  let gcEvents: Array<{ type: string; duration: number; timestamp: Date }> = [];

  // Monitor GC events if available
  if (process.env.NODE_ENV !== 'test' && global.gc) {
    const { PerformanceObserver } = require('perf_hooks');
    
    try {
      const obs = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        for (const entry of entries) {
          if (entry.entryType === 'gc') {
            gcEvents.push({
              type: entry.kind ? `gc-${entry.kind}` : 'gc-unknown',
              duration: entry.duration,
              timestamp: new Date(),
            });

            // Keep only recent GC events (last 5 minutes)
            const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
            gcEvents = gcEvents.filter(event => 
              event.timestamp.getTime() > fiveMinutesAgo
            );
          }
        }
      });
      
      obs.observe({ entryTypes: ['gc'], buffered: false });
    } catch (error) {
      logger.warn('GC monitoring not available', {
        event: 'business_metrics.gc.unavailable',
        error: error.message,
      });
    }
  }

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    
    // Record application metrics every 30 seconds
    if (now - lastGcCheck > 30000) {
      lastGcCheck = now;
      
      setImmediate(() => {
        try {
          const memUsage = process.memoryUsage();
          const cpuUsage = process.cpuUsage();
          
          metricsService.recordApplicationMetric({
            memoryUsage: memUsage.heapUsed,
            heapUsed: memUsage.heapUsed,
            heapTotal: memUsage.heapTotal,
            cpuUsage: (cpuUsage.user + cpuUsage.system) / 1000000,
            gcEvents: gcEvents.length > 0 ? [...gcEvents] : undefined,
            timestamp: new Date(),
          });

          // Clear recorded GC events
          gcEvents = [];
        } catch (error) {
          logger.error('Failed to record application metrics', {
            event: 'business_metrics.application.error',
            error: error.message,
          });
        }
      });
    }

    next();
  };
}

/**
 * Health Check Middleware for Business Metrics
 * Provides endpoint for monitoring metrics collection health
 */
export function metricsHealthMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/metrics/health' && req.method === 'GET') {
      try {
        const metricsService = getBusinessMetricsService();
        const health = metricsService.getHealthStatus();
        const exportInfo = metricsService.getMetricsExport();

        const response = {
          timestamp: new Date().toISOString(),
          service: 'business-metrics',
          ...health,
          export: exportInfo,
          endpoints: {
            signoz: process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT || 'http://localhost:4318/v1/metrics',
            prometheus: process.env.ENABLE_PROMETHEUS === 'true' 
              ? `http://localhost:${process.env.PROMETHEUS_METRICS_PORT || 9464}/metrics`
              : 'disabled',
          },
        };

        res.json(response);
        return;
      } catch (error) {
        logger.error('Failed to get metrics health status', {
          event: 'business_metrics.health.error',
          error: error.message,
        });
        
        res.status(500).json({
          timestamp: new Date().toISOString(),
          service: 'business-metrics',
          status: 'unhealthy',
          error: 'Failed to get health status',
        });
        return;
      }
    }

    next();
  };
}

/**
 * Helper function to extract clean route pattern from request
 */
function getCleanRoute(routePath: string): string {
  if (!routePath) return '/unknown';
  
  // Replace parameter patterns with placeholders
  return routePath
    .replace(/:([^/]+)/g, '{$1}')           // :id -> {id}
    .replace(/\([^)]*\)/g, '')              // Remove regex patterns
    .replace(/\*+/g, '*')                   // Normalize wildcards
    .replace(/\/+/g, '/')                   // Remove duplicate slashes
    .replace(/\/$/, '') || '/';             // Remove trailing slash
}

/**
 * Helper function to estimate request size
 */
function getRequestSize(req: Request): number | undefined {
  try {
    const contentLength = req.get('content-length');
    if (contentLength) {
      return parseInt(contentLength, 10);
    }

    // Estimate based on body size if available
    if (req.body) {
      const bodyString = typeof req.body === 'string' 
        ? req.body 
        : JSON.stringify(req.body);
      return Buffer.byteLength(bodyString, 'utf8');
    }

    return undefined;
  } catch (error) {
    return undefined;
  }
}

/**
 * Helper function to estimate response size
 */
function getResponseSize(body: any): number | undefined {
  if (!body) return undefined;

  try {
    if (typeof body === 'string') {
      return Buffer.byteLength(body, 'utf8');
    }
    
    if (Buffer.isBuffer(body)) {
      return body.length;
    }

    if (typeof body === 'object') {
      return Buffer.byteLength(JSON.stringify(body), 'utf8');
    }

    return Buffer.byteLength(String(body), 'utf8');
  } catch (error) {
    return undefined;
  }
}

/**
 * Helper function to determine activity pattern based on requests per hour
 */
function getActivityPattern(requestsPerHour: number): string {
  if (requestsPerHour > 1000) return 'high_volume';
  if (requestsPerHour > 100) return 'medium_volume';
  if (requestsPerHour > 10) return 'low_volume';
  if (requestsPerHour > 0) return 'onboarding';
  return 'inactive';
}

/**
 * Combined middleware setup function
 * Sets up all business metrics middleware in correct order
 */
export function setupBusinessMetrics() {
  return [
    metricsHealthMiddleware(),
    businessMetricsMiddleware(),
    databaseMetricsMiddleware(), 
    tenantResourceTrackingMiddleware(),
    performanceMonitoringMiddleware(),
  ];
}