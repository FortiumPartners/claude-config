/**
 * Metrics Query Routes
 * Task 3.4: HTTP endpoints for efficient query and aggregation
 */

import { Router, Request, Response } from 'express';
import { MetricsQueryService } from '../services/metrics-query.service';
import { DatabaseConnection } from '../database/connection';
import { RealTimeProcessorService } from '../services/real-time-processor.service';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.middleware';
import { validationMiddleware } from '../middleware/validation.middleware';
import { validateMetricsQuery, validateDateRange } from '../validation/metrics.validation';
import rateLimit from 'express-rate-limit';
import * as winston from 'winston';

export interface MetricsQueryRoutes {
  router: Router;
}

export function createMetricsQueryRoutes(
  db: DatabaseConnection,
  logger: winston.Logger,
  realTimeProcessor?: RealTimeProcessorService
): MetricsQueryRoutes {
  const router = Router();
  const queryService = new MetricsQueryService(db, logger, realTimeProcessor);

  // Rate limiting for query endpoints
  const queryRateLimit = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 500, // 500 requests per minute per organization
    message: {
      error: 'Too many query requests',
      message: 'Query rate limit exceeded. Please try again later.',
      retry_after: 60
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: AuthenticatedRequest) => {
      return req.user?.organization_id || req.ip;
    }
  });

  const dashboardRateLimit = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 dashboard requests per minute per organization
    message: {
      error: 'Too many dashboard requests',
      message: 'Dashboard rate limit exceeded. Please try again later.',
      retry_after: 60
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: AuthenticatedRequest) => {
      return req.user?.organization_id || req.ip;
    }
  });

  /**
   * GET /api/metrics/aggregated
   * Get aggregated metrics with pagination
   */
  router.get('/aggregated',
    queryRateLimit,
    authMiddleware,
    validationMiddleware,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        if (!req.user?.organization_id) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'Organization context required'
          });
        }

        // Parse query parameters
        const params = {
          user_id: req.query.user_id as string,
          team_id: req.query.team_id as string,
          project_id: req.query.project_id as string,
          start_date: req.query.start_date ? new Date(req.query.start_date as string) : undefined,
          end_date: req.query.end_date ? new Date(req.query.end_date as string) : undefined,
          metric_types: req.query.metric_types ? (req.query.metric_types as string).split(',') : undefined,
          limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
          offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
          aggregation_window: req.query.aggregation_window as '1m' | '5m' | '15m' | '1h' | '1d' | '1w'
        };

        // Query hints from headers
        const hints = {
          use_real_time_cache: req.headers['x-use-real-time-cache'] !== 'false',
          prefer_aggregated_data: req.headers['x-prefer-aggregated-data'] !== 'false',
          max_scan_limit: req.headers['x-max-scan-limit'] ? 
            parseInt(req.headers['x-max-scan-limit'] as string) : undefined,
          timeout_ms: req.headers['x-timeout-ms'] ? 
            parseInt(req.headers['x-timeout-ms'] as string) : undefined
        };

        const result = await queryService.getAggregatedMetrics(
          req.user.organization_id,
          params,
          hints
        );

        // Set performance headers
        res.set({
          'X-Query-Time': result.query_performance.response_time_ms.toString(),
          'X-Cache-Hit': result.query_performance.cache_hit.toString(),
          'X-Records-Scanned': result.query_performance.records_scanned.toString(),
          'X-Records-Returned': result.query_performance.records_returned.toString()
        });

        // Set pagination headers
        res.set({
          'X-Total-Count': result.pagination.total_count.toString(),
          'X-Page': result.pagination.page.toString(),
          'X-Per-Page': result.pagination.per_page.toString(),
          'X-Total-Pages': result.pagination.total_pages.toString()
        });

        if (result.pagination.has_next) {
          const nextOffset = result.pagination.page * result.pagination.per_page;
          const nextUrl = new URL(req.originalUrl, `${req.protocol}://${req.get('host')}`);
          nextUrl.searchParams.set('offset', nextOffset.toString());
          res.set('Link', `<${nextUrl.toString()}>; rel="next"`);
        }

        res.status(200).json({
          success: true,
          data: result.data,
          pagination: result.pagination,
          query_performance: result.query_performance
        });

      } catch (error) {
        logger.error('Aggregated metrics query endpoint error', {
          organization_id: req.user?.organization_id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to get aggregated metrics'
        });
      }
    }
  );

  /**
   * GET /api/metrics/dashboard
   * Get optimized dashboard metrics
   */
  router.get('/dashboard',
    dashboardRateLimit,
    authMiddleware,
    validationMiddleware,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        if (!req.user?.organization_id) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'Organization context required'
          });
        }

        const params = {
          user_id: req.query.user_id as string,
          team_id: req.query.team_id as string,
          project_id: req.query.project_id as string,
          time_range: (req.query.time_range as '1h' | '1d' | '7d' | '30d') || '1d'
        };

        // Validate time_range
        if (!['1h', '1d', '7d', '30d'].includes(params.time_range)) {
          return res.status(400).json({
            error: 'Bad request',
            message: 'Invalid time_range. Must be one of: 1h, 1d, 7d, 30d'
          });
        }

        const startTime = Date.now();
        const result = await queryService.getDashboardMetrics(
          req.user.organization_id,
          params
        );

        const responseTime = Date.now() - startTime;
        res.set('X-Response-Time', responseTime.toString());

        res.status(200).json({
          success: true,
          data: result,
          generated_at: new Date().toISOString(),
          response_time_ms: responseTime
        });

      } catch (error) {
        logger.error('Dashboard metrics endpoint error', {
          organization_id: req.user?.organization_id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to get dashboard metrics'
        });
      }
    }
  );

  /**
   * GET /api/metrics/commands
   * Get command executions with pagination
   */
  router.get('/commands',
    queryRateLimit,
    authMiddleware,
    validationMiddleware,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        if (!req.user?.organization_id) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'Organization context required'
          });
        }

        // Validate required date parameters
        if (!req.query.start_date || !req.query.end_date) {
          return res.status(400).json({
            error: 'Bad request',
            message: 'start_date and end_date are required'
          });
        }

        const params = {
          user_id: req.query.user_id as string,
          team_id: req.query.team_id as string,
          project_id: req.query.project_id as string,
          command_name: req.query.command_name as string,
          status: req.query.status as string,
          start_date: new Date(req.query.start_date as string),
          end_date: new Date(req.query.end_date as string),
          limit: req.query.limit ? parseInt(req.query.limit as string) : 1000,
          offset: req.query.offset ? parseInt(req.query.offset as string) : 0
        };

        // Validate dates
        if (isNaN(params.start_date.getTime()) || isNaN(params.end_date.getTime())) {
          return res.status(400).json({
            error: 'Bad request',
            message: 'Invalid date format. Use ISO 8601 format.'
          });
        }

        const result = await queryService.getCommandExecutions(
          req.user.organization_id,
          params
        );

        // Set performance and pagination headers
        res.set({
          'X-Query-Time': result.query_performance.response_time_ms.toString(),
          'X-Records-Scanned': result.query_performance.records_scanned.toString(),
          'X-Records-Returned': result.query_performance.records_returned.toString(),
          'X-Total-Count': result.pagination.total_count.toString(),
          'X-Page': result.pagination.page.toString(),
          'X-Per-Page': result.pagination.per_page.toString(),
          'X-Total-Pages': result.pagination.total_pages.toString()
        });

        res.status(200).json({
          success: true,
          data: result.data,
          pagination: result.pagination,
          query_performance: result.query_performance
        });

      } catch (error) {
        logger.error('Command executions query endpoint error', {
          organization_id: req.user?.organization_id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to get command executions'
        });
      }
    }
  );

  /**
   * GET /api/metrics/real-time/:window
   * Get real-time metrics from in-memory aggregations
   */
  router.get('/real-time/:window',
    queryRateLimit,
    authMiddleware,
    validationMiddleware,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        if (!req.user?.organization_id) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'Organization context required'
          });
        }

        if (!realTimeProcessor) {
          return res.status(503).json({
            error: 'Service unavailable',
            message: 'Real-time processing not available'
          });
        }

        const window = req.params.window as '1m' | '5m' | '15m' | '1h';
        if (!['1m', '5m', '15m', '1h'].includes(window)) {
          return res.status(400).json({
            error: 'Bad request',
            message: 'Invalid window. Must be one of: 1m, 5m, 15m, 1h'
          });
        }

        const userId = req.query.user_id as string;

        const startTime = Date.now();
        const result = queryService.getRealTimeMetrics(
          req.user.organization_id,
          window,
          userId
        );

        const responseTime = Date.now() - startTime;

        res.set({
          'X-Response-Time': responseTime.toString(),
          'X-Real-Time': 'true',
          'Cache-Control': 'no-cache, must-revalidate',
          'Expires': '0'
        });

        res.status(200).json({
          success: true,
          data: result,
          window,
          generated_at: new Date().toISOString(),
          response_time_ms: responseTime
        });

      } catch (error) {
        logger.error('Real-time metrics endpoint error', {
          organization_id: req.user?.organization_id,
          window: req.params.window,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to get real-time metrics'
        });
      }
    }
  );

  /**
   * GET /api/metrics/performance
   * Get query performance metrics
   */
  router.get('/performance',
    authMiddleware,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        // Only admin users can access performance metrics
        if (req.user?.role !== 'admin') {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'Admin access required'
          });
        }

        const performanceMetrics = await queryService.getQueryPerformanceMetrics();
        const queryStats = queryService.getQueryStats();

        res.status(200).json({
          success: true,
          data: {
            performance_metrics: performanceMetrics,
            query_stats: queryStats,
            timestamp: new Date().toISOString()
          }
        });

      } catch (error) {
        logger.error('Performance metrics endpoint error', {
          organization_id: req.user?.organization_id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to get performance metrics'
        });
      }
    }
  );

  /**
   * POST /api/metrics/query
   * Advanced query endpoint with complex filters
   */
  router.post('/query',
    queryRateLimit,
    authMiddleware,
    validationMiddleware,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        if (!req.user?.organization_id) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'Organization context required'
          });
        }

        const queryParams = {
          ...req.body,
          organization_id: req.user.organization_id
        };

        // Validate query parameters
        const validatedParams = validateMetricsQuery(queryParams);

        // Extract query hints from request
        const hints = {
          use_real_time_cache: req.body.use_real_time_cache !== false,
          prefer_aggregated_data: req.body.prefer_aggregated_data !== false,
          max_scan_limit: req.body.max_scan_limit || 100000,
          timeout_ms: req.body.timeout_ms || 5000
        };

        const result = await queryService.getAggregatedMetrics(
          req.user.organization_id,
          validatedParams,
          hints
        );

        res.set({
          'X-Query-Time': result.query_performance.response_time_ms.toString(),
          'X-Cache-Hit': result.query_performance.cache_hit.toString(),
          'X-Records-Scanned': result.query_performance.records_scanned.toString(),
          'X-Records-Returned': result.query_performance.records_returned.toString()
        });

        res.status(200).json({
          success: true,
          data: result.data,
          pagination: result.pagination,
          query_performance: result.query_performance
        });

      } catch (error) {
        logger.error('Advanced query endpoint error', {
          organization_id: req.user?.organization_id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        const statusCode = error instanceof Error && error.message.includes('validation') ? 400 : 500;
        
        res.status(statusCode).json({
          error: statusCode === 400 ? 'Bad request' : 'Internal server error',
          message: error instanceof Error ? error.message : 'Failed to execute query'
        });
      }
    }
  );

  /**
   * GET /api/metrics/export/:format
   * Export metrics in various formats (CSV, JSON, Excel)
   */
  router.get('/export/:format',
    queryRateLimit,
    authMiddleware,
    validationMiddleware,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        if (!req.user?.organization_id) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'Organization context required'
          });
        }

        const format = req.params.format;
        if (!['csv', 'json', 'xlsx'].includes(format)) {
          return res.status(400).json({
            error: 'Bad request',
            message: 'Invalid format. Supported formats: csv, json, xlsx'
          });
        }

        // Parse export parameters (similar to aggregated endpoint)
        const params = {
          user_id: req.query.user_id as string,
          team_id: req.query.team_id as string,
          project_id: req.query.project_id as string,
          start_date: req.query.start_date ? new Date(req.query.start_date as string) : undefined,
          end_date: req.query.end_date ? new Date(req.query.end_date as string) : undefined,
          aggregation_window: req.query.aggregation_window as '1m' | '5m' | '15m' | '1h' | '1d' | '1w',
          limit: 10000 // Higher limit for exports
        };

        const result = await queryService.getAggregatedMetrics(
          req.user.organization_id,
          params
        );

        // Set appropriate headers based on format
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        let contentType: string;
        let filename: string;

        switch (format) {
          case 'csv':
            contentType = 'text/csv';
            filename = `metrics-export-${timestamp}.csv`;
            break;
          case 'json':
            contentType = 'application/json';
            filename = `metrics-export-${timestamp}.json`;
            break;
          case 'xlsx':
            contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            filename = `metrics-export-${timestamp}.xlsx`;
            break;
          default:
            throw new Error('Unsupported format');
        }

        res.set({
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${filename}"`,
          'X-Export-Count': result.data.length.toString(),
          'X-Export-Format': format
        });

        // For now, return JSON format (CSV and Excel conversion would be implemented separately)
        if (format === 'json') {
          res.status(200).json({
            export_info: {
              format,
              generated_at: new Date().toISOString(),
              total_records: result.data.length,
              query_performance: result.query_performance
            },
            data: result.data
          });
        } else {
          // Placeholder for CSV/Excel export implementation
          res.status(501).json({
            error: 'Not implemented',
            message: `Export format '${format}' is not yet implemented`
          });
        }

      } catch (error) {
        logger.error('Export endpoint error', {
          organization_id: req.user?.organization_id,
          format: req.params.format,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to export metrics'
        });
      }
    }
  );

  return { router };
}