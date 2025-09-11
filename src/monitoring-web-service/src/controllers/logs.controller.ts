/**
 * Log Ingestion API Controller
 * Fortium External Metrics Web Service - Task 2.3: Backend Log API Implementation
 * 
 * Handles log ingestion requests from frontend clients with validation, 
 * rate limiting, and integration with Winston/Seq infrastructure
 */

import { Request, Response } from 'express';
import { logsService } from '../services/logs.service';
import { logger, loggers } from '../config/logger';
import { asyncHandler, AppError, ValidationError } from '../middleware/error.middleware';
import { 
  LogIngestionRequest, 
  LogIngestionResponse,
  validateLogEntry,
  LOG_LIMITS 
} from '../validation/logs.validation';
import { v4 as uuidv4 } from 'uuid';

// Import JWT payload type
import { JwtPayload } from '../auth/jwt.service';

// Extend Express Request for correlation tracking and user context
declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
      user?: JwtPayload;
      tenant?: { id: string; };
    }
  }
}

export class LogsController {
  
  /**
   * @route   POST /api/v1/logs
   * @desc    Ingest log entries from frontend clients
   * @access  Private (JWT required)
   */
  public static ingestLogs = asyncHandler(async (req: Request, res: Response) => {
    const startTime = Date.now();
    const correlationId = req.correlationId || uuidv4();
    const requestId = req.requestId || uuidv4();
    
    try {
      // Extract request data
      const { entries }: LogIngestionRequest = req.body;
      const clientIp = req.ip;
      const userAgent = req.headers['user-agent'];
      const userId = req.user?.userId;
      const tenantId = req.user?.tenantId;

      // Validate entries exist
      if (!entries || !Array.isArray(entries) || entries.length === 0) {
        throw new ValidationError('At least one log entry is required');
      }

      // Validate batch size limits
      if (entries.length > LOG_LIMITS.MAX_ENTRIES_PER_BATCH) {
        throw new ValidationError(
          `Batch size ${entries.length} exceeds maximum of ${LOG_LIMITS.MAX_ENTRIES_PER_BATCH} entries`
        );
      }

      // Pre-validate each entry for early error detection
      const validationErrors: string[] = [];
      for (let i = 0; i < entries.length; i++) {
        const { error } = validateLogEntry(entries[i]);
        if (error) {
          validationErrors.push(`Entry ${i}: ${error}`);
        }
      }

      if (validationErrors.length > 0) {
        throw new ValidationError('Log entry validation failed', validationErrors);
      }

      // Log request initiation
      loggers.api.request('POST', '/api/v1/logs', userId, tenantId, {
        correlationId,
        requestId,
        entriesCount: entries.length,
        clientIp,
        userAgent,
      });

      // Process log batch using logs service
      const result: LogIngestionResponse = await logsService.processBatch(entries, {
        correlationId,
        requestId,
        clientIp,
        userAgent,
        userId,
        tenantId,
      });

      // Calculate processing metrics
      const processingTime = Date.now() - startTime;
      
      // Log successful processing
      logger.info('Log ingestion completed', {
        component: 'LogsController',
        operation: 'ingestLogs',
        processed: result.processed,
        failed: result.failed,
        totalEntries: entries.length,
        processingTimeMs: processingTime,
        correlationId,
        requestId,
        userId,
        tenantId,
        success: result.success,
      });

      // Return success response with processing details
      res.status(result.success ? 200 : 207).json({
        success: result.success,
        data: {
          processed: result.processed,
          failed: result.failed,
          errors: result.errors,
          correlationId: result.correlationId,
          processingTimeMs: processingTime,
        },
        message: result.success 
          ? `Successfully processed ${result.processed} log entries`
          : `Processed ${result.processed} entries with ${result.failed} failures`,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const userId = req.user?.userId;
      const tenantId = req.user?.tenantId;
      
      // Log error details
      loggers.api.error('POST', '/api/v1/logs', error as Error, userId, tenantId, {
        correlationId,
        requestId,
        processingTimeMs: processingTime,
        entriesCount: req.body?.entries?.length || 0,
      });

      // Re-throw to be handled by error middleware
      throw error;
    }
  });

  /**
   * @route   GET /api/v1/logs/health
   * @desc    Get log ingestion service health status
   * @access  Private (JWT required)
   */
  public static getHealthStatus = asyncHandler(async (req: Request, res: Response) => {
    try {
      const healthStatus = await logsService.getHealthStatus();
      const seqMetrics = logsService.getSeqMetrics();
      const serviceMetrics = logsService.getMetrics();

      // Determine HTTP status based on health
      const statusCode = healthStatus.status === 'healthy' ? 200 : 
                        healthStatus.status === 'degraded' ? 200 : 503;

      res.status(statusCode).json({
        success: healthStatus.status !== 'unhealthy',
        data: {
          status: healthStatus.status,
          checks: healthStatus.checks,
          metrics: {
            ...healthStatus.metrics,
            serviceMetrics,
            seqMetrics: seqMetrics || null,
          },
          timestamp: new Date().toISOString(),
        },
        message: `Log ingestion service is ${healthStatus.status}`,
      });

    } catch (error) {
      logger.error('Failed to get log service health', {
        component: 'LogsController',
        operation: 'getHealthStatus',
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.userId,
        tenantId: req.user?.tenantId,
      });

      res.status(503).json({
        success: false,
        error: 'HEALTH_CHECK_FAILED',
        message: 'Unable to determine service health status',
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * @route   GET /api/v1/logs/metrics
   * @desc    Get log ingestion service metrics
   * @access  Private (JWT required) - Admin only
   */
  public static getMetrics = asyncHandler(async (req: Request, res: Response) => {
    try {
      // Check if user has admin permissions
      if (req.user?.role !== 'super_admin' && req.user?.role !== 'tenant_admin') {
        throw new AppError('Insufficient permissions to view log service metrics', 403);
      }

      const serviceMetrics = logsService.getMetrics();
      const seqMetrics = logsService.getSeqMetrics();
      const healthStatus = await logsService.getHealthStatus();

      res.json({
        success: true,
        data: {
          service: serviceMetrics,
          seq: seqMetrics,
          health: healthStatus,
          limits: {
            maxEntriesPerBatch: LOG_LIMITS.MAX_ENTRIES_PER_BATCH,
            maxBatchSizeMB: LOG_LIMITS.MAX_BATCH_SIZE_MB,
            maxEntryKB: LOG_LIMITS.MAX_ENTRY_SIZE_KB,
          },
          timestamp: new Date().toISOString(),
        },
        message: 'Log service metrics retrieved successfully',
      });

    } catch (error) {
      logger.error('Failed to get log service metrics', {
        component: 'LogsController',
        operation: 'getMetrics',
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.userId,
        tenantId: req.user?.tenantId,
      });

      throw error;
    }
  });

  /**
   * @route   POST /api/v1/logs/test
   * @desc    Test log ingestion endpoint (development only)
   * @access  Private (JWT required) - Development only
   */
  public static testIngestion = asyncHandler(async (req: Request, res: Response) => {
    // Only available in development environment
    if (process.env.NODE_ENV === 'production') {
      throw new AppError('Test endpoints not available in production', 404);
    }

    try {
      const correlationId = uuidv4();
      
      // Create sample log entries
      const sampleEntries = [
        {
          timestamp: new Date().toISOString(),
          level: 'Information' as const,
          message: 'Log ingestion test entry',
          messageTemplate: 'Log ingestion test entry from user {UserId}',
          properties: {
            correlationId,
            userId: req.user?.userId,
            tenantId: req.user?.tenantId,
            component: 'LogsController',
            operation: 'testIngestion',
            testEntry: true,
          },
        },
        {
          timestamp: new Date().toISOString(),
          level: 'Warning' as const,
          message: 'Test warning message',
          messageTemplate: 'Test warning message with {TestValue}',
          properties: {
            correlationId,
            testValue: 'sample data',
            userId: req.user?.userId,
            tenantId: req.user?.tenantId,
          },
        }
      ];

      // Process test entries
      const result = await logsService.processBatch(sampleEntries, {
        correlationId,
        requestId: uuidv4(),
        clientIp: req.ip,
        userAgent: req.headers['user-agent'],
        userId: req.user?.userId,
        tenantId: req.user?.tenantId,
      });

      res.json({
        success: true,
        data: {
          testResult: result,
          sampleEntries,
        },
        message: 'Log ingestion test completed successfully',
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Log ingestion test failed', {
        component: 'LogsController',
        operation: 'testIngestion',
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.userId,
        tenantId: req.user?.tenantId,
      });

      throw error;
    }
  });

  /**
   * @route   DELETE /api/v1/logs/metrics
   * @desc    Reset log service metrics (development only)
   * @access  Private (JWT required) - Admin, Development only  
   */
  public static resetMetrics = asyncHandler(async (req: Request, res: Response) => {
    // Only available in development environment
    if (process.env.NODE_ENV === 'production') {
      throw new AppError('Metrics reset not available in production', 404);
    }

    try {
      // Check admin permissions
      if (req.user?.role !== 'super_admin' && req.user?.role !== 'tenant_admin') {
        throw new AppError('Insufficient permissions to reset metrics', 403);
      }

      logsService.resetMetrics();

      logger.info('Log service metrics reset', {
        component: 'LogsController',
        operation: 'resetMetrics',
        userId: req.user.userId,
        tenantId: req.user.tenantId,
      });

      res.json({
        success: true,
        message: 'Log service metrics reset successfully',
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Failed to reset log service metrics', {
        component: 'LogsController',
        operation: 'resetMetrics',
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.userId,
        tenantId: req.user?.tenantId,
      });

      throw error;
    }
  });
}