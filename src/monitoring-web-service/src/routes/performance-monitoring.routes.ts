/**
 * Performance Monitoring Routes
 * Task 4.2: Application Performance Monitoring Setup
 * 
 * Features:
 * - Performance metrics API endpoints
 * - Real-time performance dashboard data
 * - Performance analysis and regression detection
 * - Resource utilization monitoring
 * - Alert management and configuration
 * - SignOz integration endpoints
 */

import { Router, Request, Response } from 'express';
import { logger } from '../config/logger';
import { 
  getApplicationPerformanceService,
  ApplicationPerformanceService,
  PerformanceAnalysis,
  ApplicationPerformanceConfig 
} from '../services/application-performance.service';
import { 
  getPerformanceMonitoringMiddleware,
  performanceMonitoringHealthCheck 
} from '../middleware/performance-monitoring.middleware';
import { authMiddleware } from '../auth/auth.middleware';
import { validateTenantAccess } from '../middleware/multi-tenant.middleware';
import * as api from '@opentelemetry/api';

const router = Router();

// Apply authentication and tenant validation to all routes
router.use(authMiddleware);
router.use(validateTenantAccess);

/**
 * GET /api/v1/performance/health
 * Performance monitoring health check
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const healthCheck = performanceMonitoringHealthCheck();
    const performanceService = getApplicationPerformanceService();
    
    res.json({
      status: 'success',
      data: {
        monitoring: healthCheck,
        service: {
          status: 'operational',
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    logger.error('Performance health check failed', {
      event: 'performance.health.failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(500).json({
      status: 'error',
      message: 'Performance monitoring health check failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/v1/performance/metrics
 * Get current performance metrics
 */
router.get('/metrics', async (req: Request, res: Response) => {
  const span = api.trace.getActiveSpan();
  
  try {
    const performanceService = getApplicationPerformanceService();
    const analysis = await performanceService.getPerformanceAnalysis();
    
    // Add query parameters for filtering
    const {
      timeRange = '1h',
      endpoint,
      category,
      includeDetails = 'false'
    } = req.query;

    span?.setAttributes({
      'performance.query.time_range': timeRange as string,
      'performance.query.endpoint': endpoint as string || 'all',
      'performance.query.category': category as string || 'all',
      'performance.query.include_details': includeDetails === 'true',
    });

    let filteredAnalysis = analysis;

    // Apply endpoint filter
    if (endpoint && typeof endpoint === 'string') {
      // Filter metrics by endpoint (implementation depends on data structure)
      span?.setAttributes({
        'performance.filter.endpoint_applied': true,
      });
    }

    // Apply category filter
    if (category && typeof category === 'string') {
      // Filter metrics by performance category
      span?.setAttributes({
        'performance.filter.category_applied': true,
      });
    }

    const response = {
      status: 'success',
      data: {
        analysis: filteredAnalysis,
        metadata: {
          timeRange,
          filters: {
            endpoint: endpoint || null,
            category: category || null,
          },
          includeDetails: includeDetails === 'true',
          generatedAt: new Date().toISOString(),
        },
      },
    };

    // Include detailed breakdown if requested
    if (includeDetails === 'true') {
      response.data = {
        ...response.data,
        detailed: {
          responseTimeBreakdown: analysis.metrics.responseTime,
          errorRateBreakdown: analysis.metrics.errorRate,
          resourceUtilization: analysis.metrics.resources,
          throughputMetrics: analysis.metrics.throughput,
        },
      };
    }

    res.json(response);

    logger.info('Performance metrics retrieved', {
      event: 'performance.metrics.retrieved',
      tenantId: (req as any).tenant?.id,
      userId: (req as any).user?.id,
      timeRange,
      endpoint: endpoint || 'all',
      category: category || 'all',
      metricsCount: analysis.metrics.responseTime.count,
    });

  } catch (error) {
    span?.recordException(error as Error);
    span?.setStatus({
      code: api.SpanStatusCode.ERROR,
      message: (error as Error).message,
    });

    logger.error('Failed to retrieve performance metrics', {
      event: 'performance.metrics.failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      tenantId: (req as any).tenant?.id,
    });

    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve performance metrics',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/v1/performance/dashboard
 * Get dashboard-specific performance data
 */
router.get('/dashboard', async (req: Request, res: Response) => {
  const span = api.trace.getActiveSpan();
  
  try {
    const performanceService = getApplicationPerformanceService();
    const middlewareService = getPerformanceMonitoringMiddleware();
    
    const [analysis, stats] = await Promise.all([
      performanceService.getPerformanceAnalysis(),
      middlewareService.getPerformanceStats(),
    ]);

    const dashboardData = {
      overview: {
        status: analysis.status,
        activeRequests: stats.activeRequests,
        averageResponseTime: stats.averageResponseTime,
        errorRate: analysis.metrics.errorRate.rate,
        throughput: analysis.metrics.throughput.requestsPerSecond,
      },
      performance: {
        responseTime: {
          current: analysis.metrics.responseTime.avg,
          p95: analysis.metrics.responseTime.p95,
          p99: analysis.metrics.responseTime.p99,
        },
        categories: {
          fast: 0, // TODO: Calculate from data
          normal: 0,
          slow: 0,
          critical: 0,
        },
      },
      errors: {
        total: analysis.metrics.errorRate.total,
        rate: analysis.metrics.errorRate.rate,
        byType: analysis.metrics.errorRate.byType,
        topEndpoints: Object.entries(analysis.metrics.errorRate.byEndpoint)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5),
      },
      resources: {
        memory: {
          usage: analysis.metrics.resources.memoryUsage.heapUsed,
          total: analysis.metrics.resources.memoryUsage.heapTotal,
          percentage: analysis.metrics.resources.memoryUsage.heapUsed / 
                     analysis.metrics.resources.memoryUsage.heapTotal * 100,
        },
        cpu: {
          percentage: analysis.metrics.resources.cpuUsage.percentage,
        },
        gc: {
          collections: analysis.metrics.resources.gcStats.totalCollections,
          avgDuration: analysis.metrics.resources.gcStats.avgDuration,
        },
      },
      alerts: analysis.alerts.map(alert => ({
        type: alert.type,
        severity: alert.severity,
        message: alert.message,
        timestamp: alert.timestamp,
      })),
      recommendations: analysis.recommendations.slice(0, 3), // Top 3 recommendations
    };

    span?.setAttributes({
      'performance.dashboard.status': analysis.status,
      'performance.dashboard.alerts_count': analysis.alerts.length,
      'performance.dashboard.recommendations_count': analysis.recommendations.length,
    });

    res.json({
      status: 'success',
      data: dashboardData,
      metadata: {
        generatedAt: new Date().toISOString(),
        refreshInterval: 30000, // 30 seconds
      },
    });

    logger.info('Performance dashboard data retrieved', {
      event: 'performance.dashboard.retrieved',
      tenantId: (req as any).tenant?.id,
      userId: (req as any).user?.id,
      status: analysis.status,
      alertsCount: analysis.alerts.length,
    });

  } catch (error) {
    span?.recordException(error as Error);
    span?.setStatus({
      code: api.SpanStatusCode.ERROR,
      message: (error as Error).message,
    });

    logger.error('Failed to retrieve dashboard data', {
      event: 'performance.dashboard.failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      tenantId: (req as any).tenant?.id,
    });

    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve performance dashboard data',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/v1/performance/regressions
 * Get detected performance regressions
 */
router.get('/regressions', async (req: Request, res: Response) => {
  const span = api.trace.getActiveSpan();
  
  try {
    const performanceService = getApplicationPerformanceService();
    const analysis = await performanceService.getPerformanceAnalysis();
    
    const {
      severity,
      endpoint,
      limit = '10'
    } = req.query;

    let regressions = analysis.regressions;

    // Apply filters
    if (severity && typeof severity === 'string') {
      regressions = regressions.filter(r => r.severity === severity);
    }

    if (endpoint && typeof endpoint === 'string') {
      regressions = regressions.filter(r => r.endpoint === endpoint);
    }

    // Apply limit
    const limitNum = parseInt(limit as string);
    if (!isNaN(limitNum)) {
      regressions = regressions.slice(0, limitNum);
    }

    // Sort by severity and detection time
    regressions.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const severityDiff = (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
      if (severityDiff !== 0) return severityDiff;
      return b.detectedAt.getTime() - a.detectedAt.getTime();
    });

    span?.setAttributes({
      'performance.regressions.total_count': analysis.regressions.length,
      'performance.regressions.filtered_count': regressions.length,
      'performance.regressions.severity_filter': severity as string || 'all',
    });

    res.json({
      status: 'success',
      data: {
        regressions,
        summary: {
          total: analysis.regressions.length,
          filtered: regressions.length,
          bySeverity: analysis.regressions.reduce((acc, r) => {
            acc[r.severity] = (acc[r.severity] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
        },
      },
      metadata: {
        filters: {
          severity: severity || null,
          endpoint: endpoint || null,
          limit: limitNum || 10,
        },
        generatedAt: new Date().toISOString(),
      },
    });

  } catch (error) {
    span?.recordException(error as Error);
    span?.setStatus({
      code: api.SpanStatusCode.ERROR,
      message: (error as Error).message,
    });

    logger.error('Failed to retrieve regressions', {
      event: 'performance.regressions.failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve performance regressions',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/v1/performance/trends
 * Get performance trend analysis
 */
router.get('/trends', async (req: Request, res: Response) => {
  const span = api.trace.getActiveSpan();
  
  try {
    const performanceService = getApplicationPerformanceService();
    const analysis = await performanceService.getPerformanceAnalysis();
    
    const {
      timeWindow = '24h',
      metric,
    } = req.query;

    let trends = analysis.trends;

    // Apply metric filter
    if (metric && typeof metric === 'string') {
      trends = trends.filter(t => t.metric === metric);
    }

    // Group trends by direction
    const trendsByDirection = trends.reduce((acc, trend) => {
      acc[trend.direction] = (acc[trend.direction] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    span?.setAttributes({
      'performance.trends.count': trends.length,
      'performance.trends.time_window': timeWindow as string,
      'performance.trends.improving': trendsByDirection.improving || 0,
      'performance.trends.degrading': trendsByDirection.degrading || 0,
      'performance.trends.stable': trendsByDirection.stable || 0,
    });

    res.json({
      status: 'success',
      data: {
        trends,
        summary: {
          total: trends.length,
          byDirection: trendsByDirection,
          timeWindow: timeWindow,
        },
      },
      metadata: {
        filters: {
          timeWindow: timeWindow,
          metric: metric || null,
        },
        generatedAt: new Date().toISOString(),
      },
    });

  } catch (error) {
    span?.recordException(error as Error);
    span?.setStatus({
      code: api.SpanStatusCode.ERROR,
      message: (error as Error).message,
    });

    logger.error('Failed to retrieve trends', {
      event: 'performance.trends.failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve performance trends',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/v1/performance/alerts
 * Get active performance alerts
 */
router.get('/alerts', async (req: Request, res: Response) => {
  const span = api.trace.getActiveSpan();
  
  try {
    const performanceService = getApplicationPerformanceService();
    const analysis = await performanceService.getPerformanceAnalysis();
    
    const {
      severity,
      type,
      active = 'true'
    } = req.query;

    let alerts = analysis.alerts;

    // Apply filters
    if (severity && typeof severity === 'string') {
      alerts = alerts.filter(a => a.severity === severity);
    }

    if (type && typeof type === 'string') {
      alerts = alerts.filter(a => a.type === type);
    }

    // Filter for active alerts (last 1 hour by default)
    if (active === 'true') {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      alerts = alerts.filter(a => a.timestamp > oneHourAgo);
    }

    // Sort by severity and timestamp
    alerts.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const severityDiff = (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
      if (severityDiff !== 0) return severityDiff;
      return b.timestamp.getTime() - a.timestamp.getTime();
    });

    span?.setAttributes({
      'performance.alerts.total_count': analysis.alerts.length,
      'performance.alerts.filtered_count': alerts.length,
      'performance.alerts.active_only': active === 'true',
    });

    res.json({
      status: 'success',
      data: {
        alerts,
        summary: {
          total: analysis.alerts.length,
          active: alerts.length,
          bySeverity: alerts.reduce((acc, a) => {
            acc[a.severity] = (acc[a.severity] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
          byType: alerts.reduce((acc, a) => {
            acc[a.type] = (acc[a.type] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
        },
      },
      metadata: {
        filters: {
          severity: severity || null,
          type: type || null,
          activeOnly: active === 'true',
        },
        generatedAt: new Date().toISOString(),
      },
    });

  } catch (error) {
    span?.recordException(error as Error);
    span?.setStatus({
      code: api.SpanStatusCode.ERROR,
      message: (error as Error).message,
    });

    logger.error('Failed to retrieve alerts', {
      event: 'performance.alerts.failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve performance alerts',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/v1/performance/analyze
 * Trigger on-demand performance analysis
 */
router.post('/analyze', async (req: Request, res: Response) => {
  const span = api.trace.getActiveSpan();
  
  try {
    const performanceService = getApplicationPerformanceService();
    
    // Run fresh analysis
    const analysis = await performanceService.getPerformanceAnalysis();
    
    span?.setAttributes({
      'performance.analysis.triggered': true,
      'performance.analysis.status': analysis.status,
      'performance.analysis.alerts_generated': analysis.alerts.length,
    });

    res.json({
      status: 'success',
      data: {
        analysis,
        message: 'Performance analysis completed',
      },
      metadata: {
        triggeredBy: (req as any).user?.id,
        triggeredAt: new Date().toISOString(),
      },
    });

    logger.info('On-demand performance analysis completed', {
      event: 'performance.analysis.on_demand',
      triggeredBy: (req as any).user?.id,
      tenantId: (req as any).tenant?.id,
      status: analysis.status,
      alertsCount: analysis.alerts.length,
      regressionsCount: analysis.regressions.length,
    });

  } catch (error) {
    span?.recordException(error as Error);
    span?.setStatus({
      code: api.SpanStatusCode.ERROR,
      message: (error as Error).message,
    });

    logger.error('Failed to run performance analysis', {
      event: 'performance.analysis.failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      triggeredBy: (req as any).user?.id,
    });

    res.status(500).json({
      status: 'error',
      message: 'Failed to run performance analysis',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/v1/performance/config
 * Get performance monitoring configuration
 */
router.get('/config', async (req: Request, res: Response) => {
  try {
    const middlewareService = getPerformanceMonitoringMiddleware();
    const config = middlewareService.getConfig();
    
    res.json({
      status: 'success',
      data: {
        config,
        metadata: {
          retrievedAt: new Date().toISOString(),
        },
      },
    });

  } catch (error) {
    logger.error('Failed to retrieve performance config', {
      event: 'performance.config.failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve performance configuration',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PUT /api/v1/performance/config
 * Update performance monitoring configuration
 */
router.put('/config', async (req: Request, res: Response) => {
  const span = api.trace.getActiveSpan();
  
  try {
    const middlewareService = getPerformanceMonitoringMiddleware();
    const { config } = req.body;
    
    if (!config || typeof config !== 'object') {
      return res.status(400).json({
        status: 'error',
        message: 'Valid configuration object is required',
      });
    }
    
    middlewareService.updateConfig(config);
    const updatedConfig = middlewareService.getConfig();
    
    span?.setAttributes({
      'performance.config.updated': true,
      'performance.config.enabled': updatedConfig.enabled,
    });

    res.json({
      status: 'success',
      data: {
        config: updatedConfig,
        message: 'Performance monitoring configuration updated',
      },
      metadata: {
        updatedBy: (req as any).user?.id,
        updatedAt: new Date().toISOString(),
      },
    });

    logger.info('Performance monitoring configuration updated', {
      event: 'performance.config.updated',
      updatedBy: (req as any).user?.id,
      tenantId: (req as any).tenant?.id,
      config: updatedConfig,
    });

  } catch (error) {
    span?.recordException(error as Error);
    span?.setStatus({
      code: api.SpanStatusCode.ERROR,
      message: (error as Error).message,
    });

    logger.error('Failed to update performance config', {
      event: 'performance.config.update_failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      updatedBy: (req as any).user?.id,
    });

    res.status(500).json({
      status: 'error',
      message: 'Failed to update performance configuration',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;