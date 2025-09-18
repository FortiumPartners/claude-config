/**
 * Sprint 3 Metrics Collection Routes
 * Task 3.5: RESTful metrics API routes with authentication and rate limiting
 * 
 * Provides comprehensive RESTful API for metrics collection with multi-tenant
 * isolation, performance optimization, and bulk import capabilities.
 */

import { Router } from 'express';
import { DatabaseConnection } from '../database/connection';
import { authMiddleware } from '../middleware/auth.middleware';
import { MetricsController } from '../controllers/metrics.controller';
import { MetricsSessionService } from '../services/metrics-session.service';
import { ToolMetricsService } from '../services/tool-metrics.service';
import { MetricsCollectionService } from '../services/metrics-collection.service';
import { DataSyncService } from '../services/data-sync.service';
import { MetricsProcessor } from '../processors/metrics.processor';
import rateLimit from 'express-rate-limit';
import * as winston from 'winston';

export interface MetricsCollectionRoutes {
  router: Router;
}

export function createMetricsCollectionRoutes(
  db: DatabaseConnection,
  logger: winston.Logger
): MetricsCollectionRoutes {
  const router = Router();

  // Initialize services
  const sessionService = new MetricsSessionService(db, logger);
  const toolMetricsService = new ToolMetricsService(db, logger);
  const collectionService = new MetricsCollectionService(db, logger);
  const metricsProcessor = new MetricsProcessor(logger);
  
  // Configure sync service with environment variables
  const syncService = new DataSyncService(
    db,
    logger,
    {
      url: process.env.REMOTE_METRICS_ENDPOINT || 'http://localhost:3000',
      api_key: process.env.REMOTE_METRICS_API_KEY || 'default-key',
      timeout_ms: parseInt(process.env.SYNC_TIMEOUT_MS || '5000'),
      retry_attempts: parseInt(process.env.SYNC_RETRY_ATTEMPTS || '3'),
      health_check_interval_ms: parseInt(process.env.HEALTH_CHECK_INTERVAL_MS || '60000')
    }
  );

  // Initialize controller
  const controller = new MetricsController({
    sessionService,
    toolMetricsService,
    collectionService,
    syncService,
    logger
  });

  // Rate limiting configurations
  const standardRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // 1000 requests per window per organization
    message: {
      error: 'Rate limit exceeded for standard operations',
      retry_after: 15 * 60,
      limit_type: 'standard'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: any) => req.user?.organization_id || req.ip,
    handler: (req, res) => {
      logger.warn('Rate limit exceeded', {
        organization_id: req.user?.organization_id,
        ip: req.ip,
        endpoint: req.path
      });
      res.status(429).json({
        success: false,
        error: 'Rate limit exceeded for standard operations',
        retry_after: 15 * 60,
        limit_type: 'standard'
      });
    }
  });

  const bulkRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 bulk requests per window per organization
    message: {
      error: 'Bulk import rate limit exceeded',
      retry_after: 15 * 60,
      limit_type: 'bulk'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: any) => req.user?.organization_id || req.ip,
    handler: (req, res) => {
      logger.warn('Bulk rate limit exceeded', {
        organization_id: req.user?.organization_id,
        ip: req.ip
      });
      res.status(429).json({
        success: false,
        error: 'Bulk import rate limit exceeded',
        retry_after: 15 * 60,
        limit_type: 'bulk'
      });
    }
  });

  const queryRateLimit = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 50, // 50 queries per minute per organization
    message: {
      error: 'Query rate limit exceeded',
      retry_after: 60,
      limit_type: 'query'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: any) => req.user?.organization_id || req.ip
  });

  const criticalRateLimit = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 2000, // 2000 critical requests per 5 minutes
    message: {
      error: 'Critical endpoint rate limit exceeded',
      retry_after: 5 * 60,
      limit_type: 'critical'
    },
    keyGenerator: (req: any) => req.user?.organization_id || req.ip
  });

  // Health check (no auth required)
  router.get('/health', controller.getHealth.bind(controller));

  // Apply authentication to all other routes
  router.use(authMiddleware);

  // Session Management Routes
  /**
   * @route   POST /api/v1/metrics/sessions
   * @desc    Create a new metrics session
   * @access  Private (authenticated)
   * @rateLimit Standard (1000/15min)
   */
  router.post('/sessions', 
    standardRateLimit,
    controller.createSession.bind(controller)
  );

  /**
   * @route   PUT /api/v1/metrics/sessions/:id
   * @desc    Update an existing session with activity data
   * @access  Private (authenticated)
   * @rateLimit Critical (2000/5min) - for high-frequency updates
   */
  router.put('/sessions/:id', 
    criticalRateLimit,
    controller.updateSession.bind(controller)
  );

  /**
   * @route   GET /api/v1/metrics/sessions
   * @desc    List sessions with pagination and filtering
   * @access  Private (authenticated)
   * @rateLimit Standard (1000/15min)
   */
  router.get('/sessions', 
    standardRateLimit,
    controller.listSessions.bind(controller)
  );

  /**
   * @route   GET /api/v1/metrics/sessions/:id
   * @desc    Get session details with analytics summary
   * @access  Private (authenticated)
   * @rateLimit Standard (1000/15min)
   */
  router.get('/sessions/:id', 
    standardRateLimit,
    controller.getSession.bind(controller)
  );

  /**
   * @route   DELETE /api/v1/metrics/sessions/:id
   * @desc    End a session and generate summary
   * @access  Private (authenticated)
   * @rateLimit Standard (1000/15min)
   */
  router.delete('/sessions/:id', 
    standardRateLimit,
    controller.endSession.bind(controller)
  );

  // Tool Usage Metrics Routes
  /**
   * @route   POST /api/v1/metrics/tools
   * @desc    Record tool usage with performance metrics
   * @access  Private (authenticated)
   * @rateLimit Critical (2000/5min) - for real-time tool tracking
   */
  router.post('/tools', 
    criticalRateLimit,
    controller.recordToolUsage.bind(controller)
  );

  /**
   * @route   GET /api/v1/metrics/tools
   * @desc    Get tool analytics and performance data
   * @access  Private (authenticated)
   * @rateLimit Standard (1000/15min)
   */
  router.get('/tools', 
    standardRateLimit,
    controller.getToolAnalytics.bind(controller)
  );

  /**
   * @route   GET /api/v1/metrics/tools/:name/trends
   * @desc    Get tool trend analysis with anomaly detection
   * @access  Private (authenticated)
   * @rateLimit Query (50/1min) - for analytical queries
   */
  router.get('/tools/:name/trends', 
    queryRateLimit,
    controller.getToolTrends.bind(controller)
  );

  // Command and Interaction Recording Routes
  /**
   * @route   POST /api/v1/metrics/commands
   * @desc    Record command execution with context
   * @access  Private (authenticated)
   * @rateLimit Critical (2000/5min) - for real-time command tracking
   */
  router.post('/commands', 
    criticalRateLimit,
    controller.recordCommandExecution.bind(controller)
  );

  /**
   * @route   POST /api/v1/metrics/interactions
   * @desc    Record agent interaction with token usage
   * @access  Private (authenticated)
   * @rateLimit Critical (2000/5min) - for real-time interaction tracking
   */
  router.post('/interactions', 
    criticalRateLimit,
    controller.recordAgentInteraction.bind(controller)
  );

  /**
   * @route   POST /api/v1/metrics/productivity
   * @desc    Record productivity metrics and KPIs
   * @access  Private (authenticated)
   * @rateLimit Standard (1000/15min)
   */
  router.post('/productivity', 
    standardRateLimit,
    controller.recordProductivityMetric.bind(controller)
  );

  // Bulk Import Routes
  /**
   * @route   POST /api/v1/metrics/bulk
   * @desc    Bulk import metrics with progress tracking
   * @access  Private (authenticated)
   * @rateLimit Bulk (10/15min) - for large data imports
   */
  router.post('/bulk', 
    bulkRateLimit,
    controller.bulkImport.bind(controller)
  );

  /**
   * @route   GET /api/v1/metrics/bulk/:batchId
   * @desc    Get bulk import progress and status
   * @access  Private (authenticated)
   * @rateLimit Standard (1000/15min)
   */
  router.get('/bulk/:batchId', 
    standardRateLimit,
    controller.getBatchProgress.bind(controller)
  );

  // Analytics and Performance Routes
  /**
   * @route   GET /api/v1/metrics/performance
   * @desc    Get comprehensive performance summary
   * @access  Private (authenticated)
   * @rateLimit Query (50/1min) - for dashboard queries
   */
  router.get('/performance', 
    queryRateLimit,
    controller.getPerformanceSummary.bind(controller)
  );

  /**
   * @route   GET /api/v1/metrics/alerts
   * @desc    Get performance alerts and anomalies
   * @access  Private (authenticated)
   * @rateLimit Standard (1000/15min)
   */
  router.get('/alerts', 
    standardRateLimit,
    controller.getPerformanceAlerts.bind(controller)
  );

  // Advanced Query Routes
  /**
   * @route   POST /api/v1/metrics/query
   * @desc    Advanced metrics query with aggregation
   * @access  Private (authenticated)
   * @rateLimit Query (50/1min) - for complex analytical queries
   */
  router.post('/query', 
    queryRateLimit,
    controller.queryMetrics.bind(controller)
  );

  // Data Processing Status Routes
  /**
   * @route   GET /api/v1/metrics/processing/stats
   * @desc    Get metrics processing statistics
   * @access  Private (authenticated)
   * @rateLimit Standard (1000/15min)
   */
  router.get('/processing/stats', 
    standardRateLimit,
    async (req, res) => {
      try {
        const stats = metricsProcessor.getProcessingStatistics();
        res.json({
          success: true,
          data: stats,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error('Failed to get processing stats', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        res.status(500).json({
          success: false,
          error: 'Failed to retrieve processing statistics'
        });
      }
    }
  );

  /**
   * @route   POST /api/v1/metrics/processing/reset
   * @desc    Reset processing statistics (admin only)
   * @access  Private (authenticated)
   * @rateLimit Standard (1000/15min)
   */
  router.post('/processing/reset', 
    standardRateLimit,
    async (req, res) => {
      try {
        // In a real implementation, this would check admin permissions
        metricsProcessor.resetStatistics();
        res.json({
          success: true,
          message: 'Processing statistics reset successfully',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error('Failed to reset processing stats', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        res.status(500).json({
          success: false,
          error: 'Failed to reset processing statistics'
        });
      }
    }
  );

  // Sync Status Routes
  /**
   * @route   GET /api/v1/metrics/sync/status
   * @desc    Get data synchronization status
   * @access  Private (authenticated)
   * @rateLimit Standard (1000/15min)
   */
  router.get('/sync/status', 
    standardRateLimit,
    async (req, res) => {
      try {
        const syncStatus = syncService.getSyncStatus();
        res.json({
          success: true,
          data: syncStatus,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error('Failed to get sync status', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        res.status(500).json({
          success: false,
          error: 'Failed to retrieve sync status'
        });
      }
    }
  );

  /**
   * @route   POST /api/v1/metrics/sync/trigger
   * @desc    Manually trigger sync process
   * @access  Private (authenticated)
   * @rateLimit Standard (1000/15min)
   */
  router.post('/sync/trigger', 
    standardRateLimit,
    async (req, res) => {
      try {
        const result = await syncService.processSync();
        res.json({
          success: true,
          data: result,
          message: 'Sync process triggered successfully'
        });
      } catch (error) {
        logger.error('Failed to trigger sync', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        res.status(500).json({
          success: false,
          error: 'Failed to trigger sync process'
        });
      }
    }
  );

  // Error handling middleware specific to metrics routes
  router.use((error: any, req: any, res: any, next: any) => {
    logger.error('Metrics API error', {
      error: error.message,
      stack: error.stack,
      endpoint: req.path,
      method: req.method,
      organization_id: req.user?.organization_id,
      user_id: req.user?.id
    });

    // Determine error type and response
    if (error.name === 'ValidationError') {
      res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.message
      });
    } else if (error.name === 'UnauthorizedError') {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    } else if (error.name === 'ForbiddenError') {
      res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  return { router };
}

export default createMetricsCollectionRoutes;