/**
 * Performance Monitoring Middleware
 * Task 4.2: Application Performance Monitoring Setup
 * 
 * Features:
 * - Comprehensive request performance tracking
 * - Real-time performance categorization
 * - Error correlation analysis
 * - Resource utilization monitoring
 * - Automated regression detection
 * - Integration with OTEL and SignOz
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';
import { 
  getApplicationPerformanceService,
  ApplicationPerformanceService,
  PerformanceCategory 
} from '../services/application-performance.service';
import * as api from '@opentelemetry/api';

interface PerformanceMiddlewareConfig {
  enabled: boolean;
  trackAllRoutes: boolean;
  excludePaths: string[];
  slowRequestThreshold: number;
  enableDetailedLogging: boolean;
}

interface RequestPerformanceData {
  startTime: number;
  startCpuUsage: NodeJS.CpuUsage;
  startMemory: NodeJS.MemoryUsage;
  routePath?: string;
  tenantId?: string;
  userId?: string;
  correlationId?: string;
}

/**
 * Enhanced Performance Monitoring Middleware
 * Integrates with ApplicationPerformanceService for comprehensive monitoring
 */
export class PerformanceMonitoringMiddleware {
  private performanceService: ApplicationPerformanceService;
  private config: PerformanceMiddlewareConfig;
  private activeRequests = new Map<string, RequestPerformanceData>();

  constructor(config?: Partial<PerformanceMiddlewareConfig>) {
    this.config = {
      enabled: true,
      trackAllRoutes: true,
      excludePaths: ['/health', '/metrics', '/favicon.ico', '/_internal/'],
      slowRequestThreshold: 1000, // 1 second
      enableDetailedLogging: false,
      ...config,
    };

    this.performanceService = getApplicationPerformanceService();
  }

  /**
   * Main middleware function for Express
   */
  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!this.config.enabled || this.shouldExcludePath(req.path)) {
        return next();
      }

      const requestId = this.generateRequestId(req);
      const startTime = Date.now();
      const startCpuUsage = process.cpuUsage();
      const startMemory = process.memoryUsage();
      
      // Store request data
      this.activeRequests.set(requestId, {
        startTime,
        startCpuUsage,
        startMemory,
        routePath: req.route?.path || req.path,
        tenantId: (req as any).tenant?.id,
        userId: (req as any).user?.id,
        correlationId: (req as any).correlationId,
      });

      // Track active request
      this.performanceService.incrementActiveRequests();

      // Add performance context to OTEL span
      this.addPerformanceContextToSpan(req, startTime);

      // Override response methods to capture completion metrics
      this.instrumentResponse(req, res, requestId);

      next();
    };
  }

  /**
   * Check if path should be excluded from monitoring
   */
  private shouldExcludePath(path: string): boolean {
    return this.config.excludePaths.some(excludePath => 
      path.includes(excludePath)
    );
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(req: Request): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Add performance context to current OTEL span
   */
  private addPerformanceContextToSpan(req: Request, startTime: number): void {
    const span = api.trace.getActiveSpan();
    if (!span) return;

    span.setAttributes({
      'performance.monitoring.enabled': true,
      'performance.monitoring.start_time': startTime,
      'performance.request.method': req.method,
      'performance.request.path': req.path,
      'performance.request.user_agent': req.get('User-Agent') || '',
      'performance.request.content_length': parseInt(req.get('Content-Length') || '0'),
    });

    // Add tenant context if available
    if ((req as any).tenant?.id) {
      span.setAttributes({
        'performance.tenant.id': (req as any).tenant.id,
      });
    }

    // Add user context if available
    if ((req as any).user?.id) {
      span.setAttributes({
        'performance.user.id': (req as any).user.id,
      });
    }
  }

  /**
   * Instrument response to capture completion metrics
   */
  private instrumentResponse(req: Request, res: Response, requestId: string): void {
    const originalEnd = res.end;
    const originalJson = res.json;
    const originalSend = res.send;

    // Override res.end
    res.end = (chunk?: any, encoding?: any) => {
      this.handleRequestCompletion(req, res, requestId, chunk);
      return originalEnd.call(res, chunk, encoding);
    };

    // Override res.json
    res.json = (obj: any) => {
      this.handleRequestCompletion(req, res, requestId, JSON.stringify(obj));
      return originalJson.call(res, obj);
    };

    // Override res.send
    res.send = (body: any) => {
      this.handleRequestCompletion(req, res, requestId, body);
      return originalSend.call(res, body);
    };
  }

  /**
   * Handle request completion and collect metrics
   */
  private async handleRequestCompletion(
    req: Request,
    res: Response,
    requestId: string,
    responseBody?: any
  ): Promise<void> {
    const requestData = this.activeRequests.get(requestId);
    if (!requestData) return;

    try {
      const endTime = Date.now();
      const duration = endTime - requestData.startTime;
      const endCpuUsage = process.cpuUsage(requestData.startCpuUsage);
      const endMemory = process.memoryUsage();

      const performanceMetrics = {
        duration,
        cpuUsage: {
          user: endCpuUsage.user / 1000000, // Convert to milliseconds
          system: endCpuUsage.system / 1000000,
        },
        memoryDelta: {
          rss: endMemory.rss - requestData.startMemory.rss,
          heapUsed: endMemory.heapUsed - requestData.startMemory.heapUsed,
          external: endMemory.external - requestData.startMemory.external,
        },
        responseSize: this.calculateResponseSize(responseBody),
      };

      // Track performance with service
      await this.performanceService.trackRequestPerformance(
        requestData.routePath || req.path,
        req.method,
        duration,
        res.statusCode,
        requestData.tenantId
      );

      // Add detailed metrics to OTEL span
      this.addCompletionMetricsToSpan(performanceMetrics, res.statusCode);

      // Log slow requests
      if (duration > this.config.slowRequestThreshold) {
        this.logSlowRequest(req, res, requestData, performanceMetrics);
      }

      // Detailed logging if enabled
      if (this.config.enableDetailedLogging) {
        this.logDetailedMetrics(req, res, requestData, performanceMetrics);
      }

    } catch (error) {
      logger.error('Failed to collect performance metrics', {
        event: 'performance.monitoring.error',
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      // Cleanup
      this.activeRequests.delete(requestId);
      this.performanceService.decrementActiveRequests();
    }
  }

  /**
   * Calculate response size in bytes
   */
  private calculateResponseSize(responseBody?: any): number {
    if (!responseBody) return 0;
    
    if (typeof responseBody === 'string') {
      return Buffer.byteLength(responseBody, 'utf8');
    }
    
    if (Buffer.isBuffer(responseBody)) {
      return responseBody.length;
    }
    
    // Estimate JSON size
    try {
      return Buffer.byteLength(JSON.stringify(responseBody), 'utf8');
    } catch {
      return 0;
    }
  }

  /**
   * Add completion metrics to OTEL span
   */
  private addCompletionMetricsToSpan(
    metrics: any,
    statusCode: number
  ): void {
    const span = api.trace.getActiveSpan();
    if (!span) return;

    span.setAttributes({
      'performance.response.duration_ms': metrics.duration,
      'performance.response.status_code': statusCode,
      'performance.response.size_bytes': metrics.responseSize,
      'performance.cpu.user_ms': metrics.cpuUsage.user,
      'performance.cpu.system_ms': metrics.cpuUsage.system,
      'performance.memory.rss_delta_bytes': metrics.memoryDelta.rss,
      'performance.memory.heap_delta_bytes': metrics.memoryDelta.heapUsed,
      'performance.category': this.categorizePerformance(metrics.duration),
    });

    // Set span status based on performance and response code
    if (statusCode >= 500) {
      span.setStatus({
        code: api.SpanStatusCode.ERROR,
        message: `Server error: ${statusCode}`,
      });
    } else if (metrics.duration > this.config.slowRequestThreshold) {
      span.setStatus({
        code: api.SpanStatusCode.OK,
        message: `Slow request: ${metrics.duration}ms`,
      });
    } else {
      span.setStatus({ code: api.SpanStatusCode.OK });
    }
  }

  /**
   * Categorize performance
   */
  private categorizePerformance(duration: number): string {
    if (duration < 100) return PerformanceCategory.FAST;
    if (duration < 500) return PerformanceCategory.NORMAL;
    if (duration < 2000) return PerformanceCategory.SLOW;
    return PerformanceCategory.CRITICAL;
  }

  /**
   * Log slow request details
   */
  private logSlowRequest(
    req: Request,
    res: Response,
    requestData: RequestPerformanceData,
    metrics: any
  ): void {
    logger.warn('Slow request detected', {
      event: 'performance.slow_request',
      request: {
        method: req.method,
        path: req.path,
        userAgent: req.get('User-Agent'),
        tenantId: requestData.tenantId,
        userId: requestData.userId,
        correlationId: requestData.correlationId,
      },
      response: {
        statusCode: res.statusCode,
        size: metrics.responseSize,
      },
      performance: {
        duration: metrics.duration,
        threshold: this.config.slowRequestThreshold,
        category: this.categorizePerformance(metrics.duration),
        cpuUsage: metrics.cpuUsage,
        memoryDelta: metrics.memoryDelta,
      },
    });
  }

  /**
   * Log detailed performance metrics
   */
  private logDetailedMetrics(
    req: Request,
    res: Response,
    requestData: RequestPerformanceData,
    metrics: any
  ): void {
    logger.info('Request performance metrics', {
      event: 'performance.detailed_metrics',
      request: {
        method: req.method,
        path: req.path,
        contentLength: req.get('Content-Length'),
        tenantId: requestData.tenantId,
        userId: requestData.userId,
      },
      response: {
        statusCode: res.statusCode,
        size: metrics.responseSize,
      },
      performance: {
        duration: metrics.duration,
        category: this.categorizePerformance(metrics.duration),
        cpuUsage: metrics.cpuUsage,
        memoryDelta: metrics.memoryDelta,
      },
      timing: {
        startTime: requestData.startTime,
        endTime: Date.now(),
      },
    });
  }

  /**
   * Get current performance statistics
   */
  async getPerformanceStats(): Promise<{
    activeRequests: number;
    averageResponseTime: number;
    requestsInLast5Minutes: number;
    slowRequestsInLast5Minutes: number;
  }> {
    const activeRequests = this.activeRequests.size;
    
    // Get performance analysis from service
    const analysis = await this.performanceService.getPerformanceAnalysis();
    
    return {
      activeRequests,
      averageResponseTime: analysis.metrics.responseTime.avg,
      requestsInLast5Minutes: analysis.metrics.responseTime.count,
      slowRequestsInLast5Minutes: 0, // TODO: Calculate from stored data
    };
  }

  /**
   * Reset performance tracking state
   */
  reset(): void {
    this.activeRequests.clear();
    logger.info('Performance monitoring middleware reset', {
      event: 'performance.monitoring.reset',
    });
  }

  /**
   * Get middleware configuration
   */
  getConfig(): PerformanceMiddlewareConfig {
    return { ...this.config };
  }

  /**
   * Update middleware configuration
   */
  updateConfig(newConfig: Partial<PerformanceMiddlewareConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('Performance monitoring configuration updated', {
      event: 'performance.monitoring.config_updated',
      config: this.config,
    });
  }
}

// Global middleware instance
let globalPerformanceMiddleware: PerformanceMonitoringMiddleware | null = null;

/**
 * Get global performance monitoring middleware instance
 */
export function getPerformanceMonitoringMiddleware(
  config?: Partial<PerformanceMiddlewareConfig>
): PerformanceMonitoringMiddleware {
  if (!globalPerformanceMiddleware) {
    globalPerformanceMiddleware = new PerformanceMonitoringMiddleware(config);
  }
  return globalPerformanceMiddleware;
}

/**
 * Express middleware factory function
 */
export function createPerformanceMonitoringMiddleware(
  config?: Partial<PerformanceMiddlewareConfig>
) {
  const middleware = getPerformanceMonitoringMiddleware(config);
  return middleware.middleware();
}

/**
 * Health check for performance monitoring
 */
export function performanceMonitoringHealthCheck(): {
  status: 'healthy' | 'degraded' | 'unhealthy';
  details: Record<string, any>;
} {
  try {
    const middleware = getPerformanceMonitoringMiddleware();
    const config = middleware.getConfig();
    
    return {
      status: config.enabled ? 'healthy' : 'degraded',
      details: {
        enabled: config.enabled,
        trackAllRoutes: config.trackAllRoutes,
        excludePathsCount: config.excludePaths.length,
        slowRequestThreshold: config.slowRequestThreshold,
        detailedLogging: config.enableDetailedLogging,
      },
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}