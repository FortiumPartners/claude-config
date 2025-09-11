/**
 * Log Ingestion API Routes
 * Fortium External Metrics Web Service - Task 2.3: Backend Log API Implementation
 */

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { LogsController } from '../controllers/logs.controller';
import { authenticateToken } from '../auth/auth.middleware';
import { validate } from '../utils/validation';
import { logSchemas } from '../validation/logs.validation';
import { responseMiddleware } from '../utils/response';
import { asyncHandler } from '../middleware/error.middleware';
import { logger } from '../config/logger';
import { config } from '../config/environment';

const router = Router();

// Apply response middleware to all log routes
router.use(responseMiddleware);

// Enhanced rate limiting specifically for log ingestion
const logIngestionRateLimit = rateLimit({
  windowMs: config.logIngestion.rateLimit.windowMs,
  max: config.logIngestion.rateLimit.maxRequests,
  message: {
    error: 'LOG_INGESTION_RATE_LIMIT_EXCEEDED',
    message: 'Too many log ingestion requests, please reduce logging frequency',
    statusCode: 429,
    timestamp: new Date().toISOString(),
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count all requests
  keyGenerator: (req) => {
    // Rate limit by IP + User ID for better granularity
    const userId = (req as any).user?.id;
    const tenantId = (req as any).user?.tenantId;
    
    if (userId && tenantId) {
      return `logs-${req.ip}-${tenantId}-${userId}`;
    }
    
    return `logs-${req.ip}`;
  },
  handler: (req, res) => {
    const userId = (req as any).user?.id;
    const tenantId = (req as any).user?.tenantId;

    logger.warn('Log ingestion rate limit exceeded', {
      component: 'LogsRoutes',
      event: 'rate_limit_exceeded',
      ip: req.ip,
      endpoint: req.originalUrl,
      userId,
      tenantId,
      userAgent: req.headers['user-agent'],
      method: req.method,
    });

    res.status(429).json({
      success: false,
      error: 'LOG_INGESTION_RATE_LIMIT_EXCEEDED',
      message: 'Too many log ingestion requests, please reduce logging frequency',
      statusCode: 429,
      timestamp: new Date().toISOString(),
      retryAfter: Math.round(config.logIngestion.rateLimit.windowMs / 1000),
      limits: {
        current: `${config.logIngestion.rateLimit.maxRequests} requests per ${Math.round(config.logIngestion.rateLimit.windowMs / 1000)} seconds`,
        suggestion: 'Consider batching log entries or reducing log frequency',
      },
    });
  },
});

// Lighter rate limiting for read-only operations
const logReadRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
  message: {
    error: 'LOG_READ_RATE_LIMIT_EXCEEDED',
    message: 'Too many log service requests, please try again later',
    statusCode: 429,
    timestamp: new Date().toISOString(),
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `logs-read-${req.ip}`,
});

/**
 * @route   POST /logs
 * @desc    Ingest log entries from frontend clients
 * @access  Private (JWT required)
 * @rateLimit 1000 requests per minute per user
 * @validation logIngestionRequestSchema
 * @body    { entries: LogEntry[] }
 * @response { success: boolean, data: { processed: number, failed: number, errors: string[], correlationId: string } }
 */
router.post('/',
  logIngestionRateLimit,
  authenticateToken,
  validate(logSchemas.ingestion),
  LogsController.ingestLogs
);

/**
 * @route   GET /logs/health
 * @desc    Get log ingestion service health status
 * @access  Private (JWT required)
 * @rateLimit Standard rate limit (100 req/15min)
 * @response { success: boolean, data: { status: string, checks: object, metrics: object } }
 */
router.get('/health',
  logReadRateLimit,
  authenticateToken,
  LogsController.getHealthStatus
);

/**
 * @route   GET /logs/metrics
 * @desc    Get detailed log service metrics (admin only)
 * @access  Private (JWT required) - Admin roles only
 * @rateLimit Standard rate limit (100 req/15min)
 * @response { success: boolean, data: { service: object, seq: object, health: object } }
 */
router.get('/metrics',
  logReadRateLimit,
  authenticateToken,
  LogsController.getMetrics
);

// Development and testing endpoints (not available in production)
if (config.isDevelopment || config.isTest) {
  /**
   * @route   POST /logs/test
   * @desc    Test log ingestion with sample data (development only)
   * @access  Private (JWT required)
   * @env     Development/Test only
   */
  router.post('/test',
    logReadRateLimit,
    authenticateToken,
    LogsController.testIngestion
  );

  /**
   * @route   DELETE /logs/metrics
   * @desc    Reset log service metrics (development only, admin required)
   * @access  Private (JWT required) - Admin roles only
   * @env     Development/Test only
   */
  router.delete('/metrics',
    logReadRateLimit,
    authenticateToken,
    LogsController.resetMetrics
  );
}

// API documentation endpoint
router.get('/docs', (req, res) => {
  res.json({
    success: true,
    data: {
      title: 'Log Ingestion API',
      version: '1.0.0',
      description: 'Frontend to backend log transmission with Winston/Seq integration',
      endpoints: [
        {
          method: 'POST',
          path: '/api/v1/logs',
          description: 'Ingest log entries from frontend clients',
          authentication: 'JWT required',
          rateLimit: '1000 requests per minute per user',
          requestBody: {
            entries: [
              {
                timestamp: 'ISO 8601 datetime string',
                level: 'Information | Warning | Error | Fatal',
                message: 'Log message content',
                messageTemplate: 'Optional structured message template',
                properties: {
                  correlationId: 'UUID (optional)',
                  sessionId: 'UUID (optional)',
                  userId: 'UUID (optional)',
                  // ... additional flexible properties
                },
                exception: {
                  type: 'Exception class name',
                  message: 'Exception message',
                  stackTrace: 'Stack trace (optional)',
                  // ... additional exception details
                }
              }
            ]
          },
          limits: {
            maxEntriesPerBatch: 100,
            maxBatchSizeMB: 5,
            maxEntryKB: 64,
          }
        },
        {
          method: 'GET',
          path: '/api/v1/logs/health',
          description: 'Get log service health status',
          authentication: 'JWT required',
          rateLimit: '100 requests per 15 minutes',
        },
        {
          method: 'GET',
          path: '/api/v1/logs/metrics',
          description: 'Get detailed service metrics (admin only)',
          authentication: 'JWT required (admin roles)',
          rateLimit: '100 requests per 15 minutes',
        }
      ],
      integration: {
        winston: 'Logs forwarded to Winston logger instance',
        seq: 'Winston configured with Seq transport for structured logging',
        correlation: 'Correlation IDs maintained throughout pipeline',
        multiTenant: 'Tenant context preserved in log properties',
      },
      security: {
        authentication: 'JWT token required for all endpoints',
        validation: 'Comprehensive input validation and sanitization',
        rateLimit: 'Configurable rate limiting per user/endpoint',
        sizeLimits: 'Batch and entry size limits to prevent DoS',
      }
    },
    message: 'Log Ingestion API documentation',
    timestamp: new Date().toISOString(),
  });
});

// Route not found handler for log API
router.use('*', (req, res) => {
  logger.warn('Log API route not found', {
    component: 'LogsRoutes',
    method: req.method,
    originalUrl: req.originalUrl,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    userId: (req as any).user?.id,
    tenantId: (req as any).user?.tenantId,
  });

  res.status(404).json({
    success: false,
    error: 'LOG_API_ROUTE_NOT_FOUND',
    message: `Log API route ${req.method} ${req.originalUrl} not found`,
    statusCode: 404,
    timestamp: new Date().toISOString(),
    availableEndpoints: [
      'POST /api/v1/logs',
      'GET /api/v1/logs/health',
      'GET /api/v1/logs/metrics',
      'GET /api/v1/logs/docs',
    ],
  });
});

export function createLogsRoutes(): Router {
  return router;
}

export default router;