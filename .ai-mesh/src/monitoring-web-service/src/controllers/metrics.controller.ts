/**
 * Metrics Controller
 * Task 3.5: Metrics Collection APIs with CRUD operations and bulk import
 * 
 * Provides RESTful API endpoints for metrics collection with
 * multi-tenant isolation, input validation, and performance optimization.
 */

import { Request, Response } from 'express';
import { MetricsSessionService } from '../services/metrics-session.service';
import { ToolMetricsService } from '../services/tool-metrics.service';
import { MetricsCollectionService } from '../services/metrics-collection.service';
import { DataSyncService } from '../services/data-sync.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import {
  validateCommandExecution,
  validateAgentInteraction,
  validateUserSessionCreate,
  validateUserSessionUpdate,
  validateProductivityMetric,
  validateMetricsBatch,
  validateMetricsQuery
} from '../validation/metrics.validation';
import { createSuccessResponse, createErrorResponse } from '../utils/response';
import * as winston from 'winston';

export interface MetricsControllerDependencies {
  sessionService: MetricsSessionService;
  toolMetricsService: ToolMetricsService;
  collectionService: MetricsCollectionService;
  syncService: DataSyncService;
  logger: winston.Logger;
}

export class MetricsController {
  private sessionService: MetricsSessionService;
  private toolMetricsService: ToolMetricsService;
  private collectionService: MetricsCollectionService;
  private syncService: DataSyncService;
  private logger: winston.Logger;

  constructor(dependencies: MetricsControllerDependencies) {
    this.sessionService = dependencies.sessionService;
    this.toolMetricsService = dependencies.toolMetricsService;
    this.collectionService = dependencies.collectionService;
    this.syncService = dependencies.syncService;
    this.logger = dependencies.logger;
  }

  /**
   * POST /api/v1/metrics/sessions
   * Create a new metrics session
   */
  async createSession(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const validatedData = validateUserSessionCreate(req.body);
      
      const result = await this.sessionService.startSession(
        req.user!.organization_id,
        validatedData.user_id || req.user!.id,
        validatedData.context
      );
      
      if (result.success) {
        res.status(201).json(createSuccessResponse({
          session: result.session,
          message: result.message
        }));
        
        this.logger.info('Session created via API', {
          organization_id: req.user!.organization_id,
          user_id: validatedData.user_id || req.user!.id,
          session_id: result.session?.id
        });
      } else {
        res.status(400).json(createErrorResponse(result.message || 'Failed to create session'));
      }
      
    } catch (error) {
      this.logger.error('Failed to create session', {
        organization_id: req.user!.organization_id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      res.status(400).json(createErrorResponse(
        error instanceof Error ? error.message : 'Invalid session data'
      ));
    }
  }

  /**
   * PUT /api/v1/metrics/sessions/:id
   * Update an existing session
   */
  async updateSession(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const sessionId = req.params.id;
      const validatedData = validateUserSessionUpdate(req.body);
      
      const result = await this.sessionService.updateSessionActivity(
        req.user!.organization_id,
        sessionId,
        validatedData
      );
      
      if (result.success) {
        res.json(createSuccessResponse({
          message: result.message
        }));
      } else {
        res.status(404).json(createErrorResponse(result.message || 'Session not found'));
      }
      
    } catch (error) {
      this.logger.error('Failed to update session', {
        organization_id: req.user!.organization_id,
        session_id: req.params.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      res.status(400).json(createErrorResponse(
        error instanceof Error ? error.message : 'Invalid session update data'
      ));
    }
  }

  /**
   * GET /api/v1/metrics/sessions
   * List sessions with pagination
   */
  async listSessions(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.query.user_id as string;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const status = req.query.status as 'active' | 'ended';
      
      let sessions: any[] = [];
      
      if (status === 'active') {
        sessions = this.sessionService.getActiveSessions(req.user!.organization_id);
        
        if (userId) {
          sessions = sessions.filter(session => session.user_id === userId);
        }
        
        sessions = sessions.slice(offset, offset + limit);
      } else {
        // For historical sessions, we'd need to implement this in the session service
        // For now, return active sessions
        sessions = this.sessionService.getActiveSessions(req.user!.organization_id);
      }
      
      res.json(createSuccessResponse({
        sessions,
        pagination: {
          limit,
          offset,
          total: sessions.length,
          has_more: false
        }
      }));
      
    } catch (error) {
      this.logger.error('Failed to list sessions', {
        organization_id: req.user!.organization_id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      res.status(500).json(createErrorResponse('Failed to retrieve sessions'));
    }
  }

  /**
   * GET /api/v1/metrics/sessions/:id
   * Get session details with summary
   */
  async getSession(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const sessionId = req.params.id;
      
      const summary = await this.sessionService.getSessionSummary(
        req.user!.organization_id,
        sessionId
      );
      
      if (summary) {
        res.json(createSuccessResponse(summary));
      } else {
        res.status(404).json(createErrorResponse('Session not found'));
      }
      
    } catch (error) {
      this.logger.error('Failed to get session', {
        organization_id: req.user!.organization_id,
        session_id: req.params.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      res.status(500).json(createErrorResponse('Failed to retrieve session'));
    }
  }

  /**
   * DELETE /api/v1/metrics/sessions/:id
   * End a session
   */
  async endSession(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const sessionId = req.params.id;
      const endMetadata = req.body.end_metadata;
      
      const result = await this.sessionService.endSession(
        req.user!.organization_id,
        sessionId,
        endMetadata
      );
      
      if (result.success) {
        res.json(createSuccessResponse({
          summary: result.summary,
          message: result.message
        }));
      } else {
        res.status(404).json(createErrorResponse(result.message || 'Session not found'));
      }
      
    } catch (error) {
      this.logger.error('Failed to end session', {
        organization_id: req.user!.organization_id,
        session_id: req.params.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      res.status(500).json(createErrorResponse('Failed to end session'));
    }
  }

  /**
   * POST /api/v1/metrics/tools
   * Record tool usage
   */
  async recordToolUsage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const toolData = req.body;
      
      const result = await this.toolMetricsService.recordToolExecution(
        req.user!.organization_id,
        {
          user_id: toolData.user_id || req.user!.id,
          tool_name: toolData.tool_name,
          execution_environment: toolData.execution_environment,
          input_parameters: toolData.input_parameters,
          output_summary: toolData.output_summary
        },
        toolData.execution_time_ms,
        toolData.status,
        toolData.error_message
      );
      
      if (result.success) {
        res.status(201).json(createSuccessResponse({
          alerts: result.alerts,
          message: 'Tool usage recorded successfully'
        }));
      } else {
        res.status(400).json(createErrorResponse(result.message || 'Failed to record tool usage'));
      }
      
    } catch (error) {
      this.logger.error('Failed to record tool usage', {
        organization_id: req.user!.organization_id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      res.status(400).json(createErrorResponse(
        error instanceof Error ? error.message : 'Invalid tool usage data'
      ));
    }
  }

  /**
   * GET /api/v1/metrics/tools
   * Get tool analytics
   */
  async getToolAnalytics(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const toolName = req.query.tool_name as string;
      const days = parseInt(req.query.days as string) || 7;
      const limit = parseInt(req.query.limit as string) || 50;
      
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));
      
      if (toolName) {
        // Get metrics for specific tool
        const metrics = await this.toolMetricsService.getToolMetrics(
          req.user!.organization_id,
          toolName,
          { start: startDate, end: endDate }
        );
        
        if (metrics) {
          res.json(createSuccessResponse({ tool_metrics: metrics }));
        } else {
          res.status(404).json(createErrorResponse('Tool metrics not found'));
        }
      } else {
        // Get metrics for all tools
        const allMetrics = await this.toolMetricsService.getAllToolMetrics(
          req.user!.organization_id,
          { start: startDate, end: endDate },
          limit
        );
        
        res.json(createSuccessResponse({ tools: allMetrics }));
      }
      
    } catch (error) {
      this.logger.error('Failed to get tool analytics', {
        organization_id: req.user!.organization_id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      res.status(500).json(createErrorResponse('Failed to retrieve tool analytics'));
    }
  }

  /**
   * GET /api/v1/metrics/tools/:name/trends
   * Get tool trend analysis
   */
  async getToolTrends(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const toolName = req.params.name;
      const period = req.query.period as 'hourly' | 'daily' | 'weekly' || 'daily';
      const points = parseInt(req.query.points as string) || 24;
      
      const trends = await this.toolMetricsService.getToolTrendAnalysis(
        req.user!.organization_id,
        toolName,
        period,
        points
      );
      
      if (trends) {
        res.json(createSuccessResponse({ trends }));
      } else {
        res.status(404).json(createErrorResponse('Tool trends not found'));
      }
      
    } catch (error) {
      this.logger.error('Failed to get tool trends', {
        organization_id: req.user!.organization_id,
        tool_name: req.params.name,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      res.status(500).json(createErrorResponse('Failed to retrieve tool trends'));
    }
  }

  /**
   * POST /api/v1/metrics/commands
   * Record command execution
   */
  async recordCommandExecution(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const validatedData = validateCommandExecution(req.body);
      
      const result = await this.collectionService.collectCommandExecution(
        req.user!.organization_id,
        {
          ...validatedData,
          user_id: validatedData.user_id || req.user!.id
        }
      );
      
      if (result.success) {
        res.status(201).json(createSuccessResponse({
          data: result.data,
          rate_limit: result.rate_limit,
          performance: result.performance
        }));
      } else {
        if (result.rate_limit) {
          res.status(429).json(createErrorResponse(result.message || 'Rate limit exceeded', {
            rate_limit: result.rate_limit
          }));
        } else {
          res.status(400).json(createErrorResponse(result.message || 'Failed to record command'));
        }
      }
      
    } catch (error) {
      res.status(400).json(createErrorResponse(
        error instanceof Error ? error.message : 'Invalid command execution data'
      ));
    }
  }

  /**
   * POST /api/v1/metrics/interactions
   * Record agent interaction
   */
  async recordAgentInteraction(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const validatedData = validateAgentInteraction(req.body);
      
      const result = await this.collectionService.collectAgentInteraction(
        req.user!.organization_id,
        {
          ...validatedData,
          user_id: validatedData.user_id || req.user!.id
        }
      );
      
      if (result.success) {
        res.status(201).json(createSuccessResponse({
          data: result.data,
          rate_limit: result.rate_limit,
          performance: result.performance
        }));
      } else {
        if (result.rate_limit) {
          res.status(429).json(createErrorResponse(result.message || 'Rate limit exceeded', {
            rate_limit: result.rate_limit
          }));
        } else {
          res.status(400).json(createErrorResponse(result.message || 'Failed to record interaction'));
        }
      }
      
    } catch (error) {
      res.status(400).json(createErrorResponse(
        error instanceof Error ? error.message : 'Invalid agent interaction data'
      ));
    }
  }

  /**
   * POST /api/v1/metrics/productivity
   * Record productivity metric
   */
  async recordProductivityMetric(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const validatedData = validateProductivityMetric(req.body);
      
      const result = await this.collectionService.collectProductivityMetric(
        req.user!.organization_id,
        {
          ...validatedData,
          user_id: validatedData.user_id || req.user!.id
        }
      );
      
      if (result.success) {
        res.status(201).json(createSuccessResponse({
          data: result.data,
          rate_limit: result.rate_limit,
          performance: result.performance
        }));
      } else {
        if (result.rate_limit) {
          res.status(429).json(createErrorResponse(result.message || 'Rate limit exceeded', {
            rate_limit: result.rate_limit
          }));
        } else {
          res.status(400).json(createErrorResponse(result.message || 'Failed to record metric'));
        }
      }
      
    } catch (error) {
      res.status(400).json(createErrorResponse(
        error instanceof Error ? error.message : 'Invalid productivity metric data'
      ));
    }
  }

  /**
   * POST /api/v1/metrics/bulk
   * Bulk import metrics
   */
  async bulkImport(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const validatedBatch = validateMetricsBatch(req.body);
      validatedBatch.organization_id = req.user!.organization_id;
      
      const progressCallback = req.query.progress === 'true' 
        ? (progress: any) => {
            // In a real implementation, this would use WebSockets or Server-Sent Events
            this.logger.debug('Batch progress', { 
              batch_id: progress.batch_id, 
              progress: `${progress.processed_items}/${progress.total_items}` 
            });
          }
        : undefined;
      
      const result = await this.syncService.uploadBatch(validatedBatch, progressCallback);
      
      if (result.success) {
        res.status(201).json(createSuccessResponse({
          batch_id: result.batch_id,
          progress: result.progress
        }));
      } else {
        res.status(400).json(createErrorResponse('Batch upload failed', {
          batch_id: result.batch_id,
          progress: result.progress
        }));
      }
      
    } catch (error) {
      this.logger.error('Failed to process bulk import', {
        organization_id: req.user!.organization_id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      res.status(400).json(createErrorResponse(
        error instanceof Error ? error.message : 'Invalid batch data'
      ));
    }
  }

  /**
   * GET /api/v1/metrics/bulk/:batchId
   * Get batch import progress
   */
  async getBatchProgress(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const batchId = req.params.batchId;
      
      const progress = this.syncService.getBatchProgress(batchId);
      
      if (progress) {
        res.json(createSuccessResponse({ progress }));
      } else {
        res.status(404).json(createErrorResponse('Batch not found'));
      }
      
    } catch (error) {
      res.status(500).json(createErrorResponse('Failed to retrieve batch progress'));
    }
  }

  /**
   * GET /api/v1/metrics/performance
   * Get performance summary
   */
  async getPerformanceSummary(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const days = parseInt(req.query.days as string) || 7;
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));
      
      const [toolSummary, sessionMetrics, collectionStats, syncStatus] = await Promise.all([
        this.toolMetricsService.getToolPerformanceSummary(
          req.user!.organization_id,
          { start: startDate, end: endDate }
        ),
        this.sessionService.getSessionMetrics(),
        this.collectionService.getCollectionStats(),
        this.syncService.getSyncStatus()
      ]);
      
      res.json(createSuccessResponse({
        tool_performance: toolSummary,
        session_metrics: sessionMetrics,
        collection_stats: collectionStats,
        sync_status: syncStatus,
        time_range: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          days
        }
      }));
      
    } catch (error) {
      this.logger.error('Failed to get performance summary', {
        organization_id: req.user!.organization_id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      res.status(500).json(createErrorResponse('Failed to retrieve performance summary'));
    }
  }

  /**
   * GET /api/v1/metrics/alerts
   * Get performance alerts
   */
  async getPerformanceAlerts(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const severity = req.query.severity as 'low' | 'medium' | 'high' | 'critical';
      
      const alerts = await this.toolMetricsService.getPerformanceAlerts(
        req.user!.organization_id,
        severity
      );
      
      res.json(createSuccessResponse({ alerts }));
      
    } catch (error) {
      this.logger.error('Failed to get performance alerts', {
        organization_id: req.user!.organization_id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      res.status(500).json(createErrorResponse('Failed to retrieve performance alerts'));
    }
  }

  /**
   * POST /api/v1/metrics/query
   * Query metrics with filters
   */
  async queryMetrics(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const queryParams = validateMetricsQuery(req.body);
      queryParams.organization_id = req.user!.organization_id;
      
      // This would be implemented based on specific query requirements
      // For now, return a placeholder response
      res.json(createSuccessResponse({
        query: queryParams,
        results: [],
        message: 'Metrics query endpoint - implementation pending'
      }));
      
    } catch (error) {
      res.status(400).json(createErrorResponse(
        error instanceof Error ? error.message : 'Invalid query parameters'
      ));
    }
  }

  /**
   * GET /api/v1/metrics/health
   * Get metrics system health
   */
  async getHealth(req: Request, res: Response): Promise<void> {
    try {
      const [collectionStats, syncStatus] = await Promise.all([
        this.collectionService.getCollectionStats(),
        this.syncService.getSyncStatus()
      ]);
      
      const isHealthy = 
        collectionStats.success_rate > 0.95 &&
        syncStatus.sync_statistics.success_rate > 0.9 &&
        !syncStatus.offline_mode;
      
      const status = isHealthy ? 'healthy' : 'degraded';
      
      res.status(isHealthy ? 200 : 503).json({
        status,
        timestamp: new Date().toISOString(),
        collection: collectionStats,
        sync: syncStatus,
        checks: {
          collection_success_rate: collectionStats.success_rate > 0.95,
          sync_success_rate: syncStatus.sync_statistics.success_rate > 0.9,
          remote_available: syncStatus.remote_available
        }
      });
      
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Health check failed'
      });
    }
  }
}