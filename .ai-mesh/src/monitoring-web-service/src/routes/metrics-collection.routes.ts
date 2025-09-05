/**
 * Metrics Collection Routes
 * Task 3.2: HTTP endpoints for metric ingestion
 */

import { Router, Request, Response } from 'express';
import { MetricsCollectionService } from '../services/metrics-collection.service';
import { DatabaseConnection } from '../database/connection';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.middleware';
import { validationMiddleware } from '../middleware/validation.middleware';
import { teamAuthMiddleware } from '../middleware/team-auth.middleware';
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
  const metricsService = new MetricsCollectionService(db, logger);

  // Rate limiting middleware for different endpoints
  const standardRateLimit = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 1000, // 1000 requests per minute per IP
    message: {
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      retry_after: 60
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: AuthenticatedRequest) => {
      return req.user?.organization_id || req.ip;
    }
  });

  const batchRateLimit = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 batch requests per minute per organization
    message: {
      error: 'Too many batch requests',
      message: 'Batch rate limit exceeded. Please try again later.',
      retry_after: 60
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: AuthenticatedRequest) => {
      return req.user?.organization_id || req.ip;
    }
  });

  /**
   * POST /api/metrics/commands
   * Collect single command execution metric
   */
  router.post('/commands',
    standardRateLimit,
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

        const result = await metricsService.collectCommandExecution(
          req.user.organization_id,
          req.body
        );

        if (result.rate_limit) {
          res.set({
            'X-RateLimit-Limit': result.rate_limit.limit.toString(),
            'X-RateLimit-Remaining': result.rate_limit.remaining.toString(),
            'X-RateLimit-Reset': result.rate_limit.reset_time.toISOString()
          });

          if (result.rate_limit.retry_after) {
            res.set('Retry-After', result.rate_limit.retry_after.toString());
          }
        }

        if (result.performance) {
          res.set('X-Processing-Time', result.performance.processing_latency_ms?.toString() || '0');
        }

        if (!result.success) {
          return res.status(result.message === 'Rate limit exceeded' ? 429 : 400).json({
            error: 'Collection failed',
            message: result.message
          });
        }

        res.status(201).json({
          success: true,
          data: result.data,
          message: 'Command execution collected successfully'
        });

      } catch (error) {
        logger.error('Command execution collection endpoint error', {
          organization_id: req.user?.organization_id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to collect command execution'
        });
      }
    }
  );

  /**
   * POST /api/metrics/agents
   * Collect single agent interaction metric
   */
  router.post('/agents',
    standardRateLimit,
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

        const result = await metricsService.collectAgentInteraction(
          req.user.organization_id,
          req.body
        );

        if (result.rate_limit) {
          res.set({
            'X-RateLimit-Limit': result.rate_limit.limit.toString(),
            'X-RateLimit-Remaining': result.rate_limit.remaining.toString(),
            'X-RateLimit-Reset': result.rate_limit.reset_time.toISOString()
          });

          if (result.rate_limit.retry_after) {
            res.set('Retry-After', result.rate_limit.retry_after.toString());
          }
        }

        if (result.performance) {
          res.set('X-Processing-Time', result.performance.processing_latency_ms?.toString() || '0');
        }

        if (!result.success) {
          return res.status(result.message === 'Rate limit exceeded' ? 429 : 400).json({
            error: 'Collection failed',
            message: result.message
          });
        }

        res.status(201).json({
          success: true,
          data: result.data,
          message: 'Agent interaction collected successfully'
        });

      } catch (error) {
        logger.error('Agent interaction collection endpoint error', {
          organization_id: req.user?.organization_id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to collect agent interaction'
        });
      }
    }
  );

  /**
   * POST /api/metrics/sessions/start
   * Start user session
   */
  router.post('/sessions/start',
    standardRateLimit,
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

        // Default to current user if not specified
        if (!req.body.user_id) {
          req.body.user_id = req.user.id;
        }

        const result = await metricsService.startUserSession(
          req.user.organization_id,
          req.body
        );

        if (result.rate_limit) {
          res.set({
            'X-RateLimit-Limit': result.rate_limit.limit.toString(),
            'X-RateLimit-Remaining': result.rate_limit.remaining.toString(),
            'X-RateLimit-Reset': result.rate_limit.reset_time.toISOString()
          });

          if (result.rate_limit.retry_after) {
            res.set('Retry-After', result.rate_limit.retry_after.toString());
          }
        }

        if (result.performance) {
          res.set('X-Processing-Time', result.performance.processing_latency_ms?.toString() || '0');
        }

        if (!result.success) {
          return res.status(result.message === 'Rate limit exceeded' ? 429 : 400).json({
            error: 'Session start failed',
            message: result.message
          });
        }

        const statusCode = result.message === 'User already has an active session' ? 200 : 201;
        res.status(statusCode).json({
          success: true,
          data: result.data,
          message: result.message || 'User session started successfully'
        });

      } catch (error) {
        logger.error('Session start endpoint error', {
          organization_id: req.user?.organization_id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to start user session'
        });
      }
    }
  );

  /**
   * PUT /api/metrics/sessions/:sessionId
   * Update user session
   */
  router.put('/sessions/:sessionId',
    standardRateLimit,
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

        const sessionId = req.params.sessionId;
        if (!sessionId) {
          return res.status(400).json({
            error: 'Bad request',
            message: 'Session ID is required'
          });
        }

        const result = await metricsService.updateUserSession(
          req.user.organization_id,
          sessionId,
          req.body
        );

        if (result.rate_limit) {
          res.set({
            'X-RateLimit-Limit': result.rate_limit.limit.toString(),
            'X-RateLimit-Remaining': result.rate_limit.remaining.toString(),
            'X-RateLimit-Reset': result.rate_limit.reset_time.toISOString()
          });

          if (result.rate_limit.retry_after) {
            res.set('Retry-After', result.rate_limit.retry_after.toString());
          }
        }

        if (result.performance) {
          res.set('X-Processing-Time', result.performance.processing_latency_ms?.toString() || '0');
        }

        if (!result.success) {
          const statusCode = result.message === 'Session not found' ? 404 :
                            result.message === 'Rate limit exceeded' ? 429 : 400;
          return res.status(statusCode).json({
            error: 'Session update failed',
            message: result.message
          });
        }

        res.status(200).json({
          success: true,
          data: result.data,
          message: 'User session updated successfully'
        });

      } catch (error) {
        logger.error('Session update endpoint error', {
          organization_id: req.user?.organization_id,
          session_id: req.params.sessionId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to update user session'
        });
      }
    }
  );

  /**
   * POST /api/metrics/productivity
   * Collect productivity metric
   */
  router.post('/productivity',
    standardRateLimit,
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

        const result = await metricsService.collectProductivityMetric(
          req.user.organization_id,
          req.body
        );

        if (result.rate_limit) {
          res.set({
            'X-RateLimit-Limit': result.rate_limit.limit.toString(),
            'X-RateLimit-Remaining': result.rate_limit.remaining.toString(),
            'X-RateLimit-Reset': result.rate_limit.reset_time.toISOString()
          });

          if (result.rate_limit.retry_after) {
            res.set('Retry-After', result.rate_limit.retry_after.toString());
          }
        }

        if (result.performance) {
          res.set('X-Processing-Time', result.performance.processing_latency_ms?.toString() || '0');
        }

        if (!result.success) {
          return res.status(result.message === 'Rate limit exceeded' ? 429 : 400).json({
            error: 'Collection failed',
            message: result.message
          });
        }

        res.status(201).json({
          success: true,
          data: result.data,
          message: 'Productivity metric collected successfully'
        });

      } catch (error) {
        logger.error('Productivity metric collection endpoint error', {
          organization_id: req.user?.organization_id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to collect productivity metric'
        });
      }
    }
  );

  /**
   * POST /api/metrics/batch
   * Batch collection for high-throughput scenarios
   */
  router.post('/batch',
    batchRateLimit,
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

        const result = await metricsService.collectBatchMetrics(
          req.user.organization_id,
          req.body
        );

        if (result.rate_limit) {
          res.set({
            'X-RateLimit-Limit': result.rate_limit.limit.toString(),
            'X-RateLimit-Remaining': result.rate_limit.remaining.toString(),
            'X-RateLimit-Reset': result.rate_limit.reset_time.toISOString()
          });

          if (result.rate_limit.retry_after) {
            res.set('Retry-After', result.rate_limit.retry_after.toString());
          }
        }

        if (result.performance) {
          res.set('X-Processing-Time', result.performance.processing_latency_ms?.toString() || '0');
          res.set('X-Ingestion-Rate', result.performance.ingestion_rate?.toString() || '0');
        }

        if (!result.success) {
          return res.status(result.message === 'Rate limit exceeded for batch operation' ? 429 : 400).json({
            error: 'Batch collection failed',
            message: result.message
          });
        }

        res.status(201).json({
          success: true,
          data: result.data,
          message: 'Batch metrics collected successfully'
        });

      } catch (error) {
        logger.error('Batch collection endpoint error', {
          organization_id: req.user?.organization_id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to collect batch metrics'
        });
      }
    }
  );

  /**
   * GET /api/metrics/health
   * Health check and performance metrics
   */
  router.get('/health',
    authMiddleware,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const performanceMetrics = await metricsService.getPerformanceMetrics();
        const collectionStats = metricsService.getCollectionStats();

        res.status(200).json({
          status: 'healthy',
          performance: performanceMetrics,
          collection_stats: collectionStats,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        logger.error('Health endpoint error', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        res.status(500).json({
          status: 'unhealthy',
          error: 'Failed to get health status',
          timestamp: new Date().toISOString()
        });
      }
    }
  );

  /**
   * GET /api/metrics/stats
   * Collection statistics for monitoring
   */
  router.get('/stats',
    authMiddleware,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        // Only admin users can access system-wide stats
        if (req.user?.role !== 'admin') {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'Admin access required'
          });
        }

        const collectionStats = metricsService.getCollectionStats();
        const performanceMetrics = await metricsService.getPerformanceMetrics();

        res.status(200).json({
          collection_stats: collectionStats,
          performance_metrics: performanceMetrics,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        logger.error('Stats endpoint error', {
          organization_id: req.user?.organization_id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to get collection statistics'
        });
      }
    }
  );

  return { router };
}