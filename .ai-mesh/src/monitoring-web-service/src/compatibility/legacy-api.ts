/**
 * Legacy API Endpoints for Backward Compatibility
 * Provides backward compatible API endpoints for existing local hook integrations
 * 
 * Sprint 6 - Task 6.3: Backward Compatibility Layer
 * Maintains 100% compatibility with existing local hook system
 */

import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '../generated/prisma-client';
import { FormatConverter } from './format-converter';
import { HookBridge } from './hook-bridge';
import Joi from 'joi';

// Legacy API request/response types (matching local hook format)
export interface LegacySessionRequest {
  session_id: string;
  start_time: string;
  end_time?: string;
  user: string;
  working_directory: string;
  git_branch: string;
  productivity_metrics?: {
    commands_executed: number;
    tools_invoked: number;
    files_read: number;
    files_modified: number;
    lines_changed: number;
    agents_used: string[];
    focus_blocks: number;
    interruptions: number;
  };
  quality_metrics?: {
    tests_run: number;
    tests_passed: number;
    builds_attempted: number;
    builds_successful: number;
    reviews_requested: number;
  };
  workflow_metrics?: {
    git_commits: number;
    prs_created: number;
    context_switches: number;
  };
}

export interface LegacyToolMetricRequest {
  event: string;
  timestamp: string;
  session_id?: string;
  tool_name?: string;
  execution_time?: number;
  memory_usage?: number;
  success?: boolean;
  error_message?: string;
  parameters?: any;
  output_size?: number;
  command_line?: string;
  working_directory?: string;
}

export interface LegacyResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
  version: string;
}

/**
 * Legacy API router providing backward compatibility
 */
export class LegacyApiController {
  private readonly prisma: PrismaClient;
  private readonly formatConverter: FormatConverter;
  private readonly hookBridge: HookBridge;
  private readonly router: Router;
  private readonly tenantId: string;

  constructor(prisma: PrismaClient, tenantId: string) {
    this.prisma = prisma;
    this.tenantId = tenantId;
    this.formatConverter = new FormatConverter();
    this.hookBridge = new HookBridge(prisma, tenantId);
    this.router = Router();
    this.setupRoutes();
  }

  /**
   * Get configured router with all legacy endpoints
   */
  getRouter(): Router {
    return this.router;
  }

  /**
   * Setup all legacy API routes
   */
  private setupRoutes(): void {
    // Session management endpoints
    this.router.post('/api/v1/sessions', this.validateSession, this.createSession.bind(this));
    this.router.put('/api/v1/sessions/:sessionId', this.validateSession, this.updateSession.bind(this));
    this.router.get('/api/v1/sessions/:sessionId', this.getSession.bind(this));
    this.router.get('/api/v1/sessions', this.getSessions.bind(this));
    this.router.delete('/api/v1/sessions/:sessionId', this.deleteSession.bind(this));

    // Tool metrics endpoints
    this.router.post('/api/v1/tool-metrics', this.validateToolMetric, this.recordToolMetric.bind(this));
    this.router.post('/api/v1/tool-metrics/batch', this.validateToolMetricBatch, this.recordToolMetricsBatch.bind(this));
    this.router.get('/api/v1/tool-metrics/:sessionId', this.getToolMetrics.bind(this));

    // Analytics endpoints (legacy format)
    this.router.get('/api/v1/analytics/productivity', this.getProductivityAnalytics.bind(this));
    this.router.get('/api/v1/analytics/tools', this.getToolAnalytics.bind(this));
    this.router.get('/api/v1/analytics/sessions/:sessionId', this.getSessionAnalytics.bind(this));

    // Dashboard endpoints (legacy format)
    this.router.get('/api/v1/dashboard/metrics', this.getDashboardMetrics.bind(this));
    this.router.get('/api/v1/dashboard/indicators', this.getProductivityIndicators.bind(this));
    this.router.get('/api/v1/dashboard/baseline', this.getBaseline.bind(this));

    // Local hook compatibility endpoints
    this.router.post('/api/v1/hooks/session-start', this.handleSessionStart.bind(this));
    this.router.post('/api/v1/hooks/session-end', this.handleSessionEnd.bind(this));
    this.router.post('/api/v1/hooks/tool-usage', this.handleToolUsage.bind(this));

    // Health check and version info
    this.router.get('/api/v1/health', this.healthCheck.bind(this));
    this.router.get('/api/v1/version', this.getVersion.bind(this));

    // Migration status endpoints
    this.router.get('/api/v1/migration/status', this.getMigrationStatus.bind(this));
    this.router.post('/api/v1/migration/sync', this.syncLocalData.bind(this));
  }

  /**
   * Create new session (POST /api/v1/sessions)
   */
  private async createSession(req: Request, res: Response): Promise<void> {
    try {
      const legacySession: LegacySessionRequest = req.body;
      
      // Convert legacy format to modern format
      const modernSession = this.formatConverter.convertLegacySessionToModern(legacySession);
      
      // Store session using hook bridge
      const result = await this.hookBridge.createSession(modernSession);
      
      // Convert back to legacy response format
      const legacyResponse = this.formatConverter.convertModernSessionToLegacy(result);
      
      this.sendLegacyResponse(res, 201, legacyResponse, 'Session created successfully');
      
    } catch (error) {
      this.sendLegacyError(res, 400, error.message);
    }
  }

  /**
   * Update existing session (PUT /api/v1/sessions/:sessionId)
   */
  private async updateSession(req: Request, res: Response): Promise<void> {
    try {
      const sessionId = req.params.sessionId;
      const legacySession: Partial<LegacySessionRequest> = req.body;
      
      // Convert and update
      const modernSession = this.formatConverter.convertLegacySessionToModern({
        session_id: sessionId,
        ...legacySession
      } as LegacySessionRequest);
      
      const result = await this.hookBridge.updateSession(sessionId, modernSession);
      
      if (!result) {
        this.sendLegacyError(res, 404, 'Session not found');
        return;
      }
      
      const legacyResponse = this.formatConverter.convertModernSessionToLegacy(result);
      this.sendLegacyResponse(res, 200, legacyResponse, 'Session updated successfully');
      
    } catch (error) {
      this.sendLegacyError(res, 400, error.message);
    }
  }

  /**
   * Get session by ID (GET /api/v1/sessions/:sessionId)
   */
  private async getSession(req: Request, res: Response): Promise<void> {
    try {
      const sessionId = req.params.sessionId;
      const session = await this.hookBridge.getSession(sessionId);
      
      if (!session) {
        this.sendLegacyError(res, 404, 'Session not found');
        return;
      }
      
      const legacyResponse = this.formatConverter.convertModernSessionToLegacy(session);
      this.sendLegacyResponse(res, 200, legacyResponse);
      
    } catch (error) {
      this.sendLegacyError(res, 500, error.message);
    }
  }

  /**
   * Get sessions with legacy filtering (GET /api/v1/sessions)
   */
  private async getSessions(req: Request, res: Response): Promise<void> {
    try {
      const { user, limit = '50', offset = '0', start_date, end_date } = req.query;
      
      const sessions = await this.hookBridge.getSessions({
        user: user as string,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        startDate: start_date ? new Date(start_date as string) : undefined,
        endDate: end_date ? new Date(end_date as string) : undefined
      });
      
      const legacySessions = sessions.map(session => 
        this.formatConverter.convertModernSessionToLegacy(session)
      );
      
      this.sendLegacyResponse(res, 200, legacySessions);
      
    } catch (error) {
      this.sendLegacyError(res, 500, error.message);
    }
  }

  /**
   * Delete session (DELETE /api/v1/sessions/:sessionId)
   */
  private async deleteSession(req: Request, res: Response): Promise<void> {
    try {
      const sessionId = req.params.sessionId;
      const deleted = await this.hookBridge.deleteSession(sessionId);
      
      if (!deleted) {
        this.sendLegacyError(res, 404, 'Session not found');
        return;
      }
      
      this.sendLegacyResponse(res, 200, { deleted: true }, 'Session deleted successfully');
      
    } catch (error) {
      this.sendLegacyError(res, 500, error.message);
    }
  }

  /**
   * Record tool metric (POST /api/v1/tool-metrics)
   */
  private async recordToolMetric(req: Request, res: Response): Promise<void> {
    try {
      const legacyMetric: LegacyToolMetricRequest = req.body;
      
      // Convert legacy format to modern
      const modernMetric = this.formatConverter.convertLegacyToolMetricToModern(legacyMetric);
      
      const result = await this.hookBridge.recordToolMetric(modernMetric);
      
      // Convert back to legacy format
      const legacyResponse = this.formatConverter.convertModernToolMetricToLegacy(result);
      
      this.sendLegacyResponse(res, 201, legacyResponse, 'Tool metric recorded successfully');
      
    } catch (error) {
      this.sendLegacyError(res, 400, error.message);
    }
  }

  /**
   * Record multiple tool metrics (POST /api/v1/tool-metrics/batch)
   */
  private async recordToolMetricsBatch(req: Request, res: Response): Promise<void> {
    try {
      const legacyMetrics: LegacyToolMetricRequest[] = req.body.metrics || req.body;
      
      if (!Array.isArray(legacyMetrics)) {
        this.sendLegacyError(res, 400, 'Expected array of tool metrics');
        return;
      }
      
      const results = [];
      for (const legacyMetric of legacyMetrics) {
        try {
          const modernMetric = this.formatConverter.convertLegacyToolMetricToModern(legacyMetric);
          const result = await this.hookBridge.recordToolMetric(modernMetric);
          results.push(this.formatConverter.convertModernToolMetricToLegacy(result));
        } catch (error) {
          results.push({ error: error.message, originalData: legacyMetric });
        }
      }
      
      this.sendLegacyResponse(res, 201, { 
        results,
        processed: legacyMetrics.length,
        successful: results.filter(r => !r.error).length
      }, 'Batch tool metrics processed');
      
    } catch (error) {
      this.sendLegacyError(res, 400, error.message);
    }
  }

  /**
   * Get tool metrics for session (GET /api/v1/tool-metrics/:sessionId)
   */
  private async getToolMetrics(req: Request, res: Response): Promise<void> {
    try {
      const sessionId = req.params.sessionId;
      const toolMetrics = await this.hookBridge.getToolMetrics(sessionId);
      
      const legacyMetrics = toolMetrics.map(metric =>
        this.formatConverter.convertModernToolMetricToLegacy(metric)
      );
      
      this.sendLegacyResponse(res, 200, legacyMetrics);
      
    } catch (error) {
      this.sendLegacyError(res, 500, error.message);
    }
  }

  /**
   * Get productivity analytics in legacy format (GET /api/v1/analytics/productivity)
   */
  private async getProductivityAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const { user, days = '7' } = req.query;
      
      const analytics = await this.hookBridge.getProductivityAnalytics({
        user: user as string,
        days: parseInt(days as string)
      });
      
      // Convert to legacy format expected by local hooks
      const legacyAnalytics = {
        productivity_score: analytics.averageProductivityScore,
        velocity: analytics.averageVelocity,
        focus_time: analytics.totalFocusTime,
        session_efficiency: analytics.sessionEfficiency,
        tool_usage_patterns: analytics.toolUsagePatterns,
        productivity_trends: analytics.trends.map(trend => ({
          date: trend.date,
          score: trend.productivityScore,
          sessions: trend.sessionCount,
          tools_used: trend.toolsUsed
        }))
      };
      
      this.sendLegacyResponse(res, 200, legacyAnalytics);
      
    } catch (error) {
      this.sendLegacyError(res, 500, error.message);
    }
  }

  /**
   * Get tool analytics (GET /api/v1/analytics/tools)
   */
  private async getToolAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const { user, days = '7' } = req.query;
      
      const toolAnalytics = await this.hookBridge.getToolAnalytics({
        user: user as string,
        days: parseInt(days as string)
      });
      
      // Convert to legacy format
      const legacyToolAnalytics = {
        top_tools: toolAnalytics.topTools,
        tool_efficiency: toolAnalytics.toolEfficiency,
        usage_patterns: toolAnalytics.usagePatterns,
        error_rates: toolAnalytics.errorRates
      };
      
      this.sendLegacyResponse(res, 200, legacyToolAnalytics);
      
    } catch (error) {
      this.sendLegacyError(res, 500, error.message);
    }
  }

  /**
   * Get session analytics (GET /api/v1/analytics/sessions/:sessionId)
   */
  private async getSessionAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const sessionId = req.params.sessionId;
      const sessionAnalytics = await this.hookBridge.getSessionAnalytics(sessionId);
      
      if (!sessionAnalytics) {
        this.sendLegacyError(res, 404, 'Session not found');
        return;
      }
      
      // Convert to legacy format expected by local dashboard
      const legacySessionAnalytics = {
        session_id: sessionAnalytics.sessionId,
        productivity_score: sessionAnalytics.productivityScore,
        duration_minutes: sessionAnalytics.durationMinutes,
        tools_used: sessionAnalytics.toolsUsed,
        efficiency_rating: sessionAnalytics.efficiencyRating,
        focus_periods: sessionAnalytics.focusPeriods,
        interruptions: sessionAnalytics.interruptions
      };
      
      this.sendLegacyResponse(res, 200, legacySessionAnalytics);
      
    } catch (error) {
      this.sendLegacyError(res, 500, error.message);
    }
  }

  /**
   * Get dashboard metrics in legacy format (GET /api/v1/dashboard/metrics)
   */
  private async getDashboardMetrics(req: Request, res: Response): Promise<void> {
    try {
      const { user } = req.query;
      
      const dashboardMetrics = await this.hookBridge.getDashboardMetrics(user as string);
      
      // Convert to legacy dashboard format
      const legacyMetrics = {
        current_session: dashboardMetrics.currentSession,
        today_stats: {
          sessions: dashboardMetrics.todayStats.sessions,
          productivity_score: dashboardMetrics.todayStats.productivityScore,
          tools_used: dashboardMetrics.todayStats.toolsUsed,
          focus_time_minutes: dashboardMetrics.todayStats.focusTimeMinutes
        },
        weekly_trends: dashboardMetrics.weeklyTrends,
        top_tools: dashboardMetrics.topTools,
        productivity_trend: dashboardMetrics.productivityTrend
      };
      
      this.sendLegacyResponse(res, 200, legacyMetrics);
      
    } catch (error) {
      this.sendLegacyError(res, 500, error.message);
    }
  }

  /**
   * Get productivity indicators (GET /api/v1/dashboard/indicators)
   */
  private async getProductivityIndicators(req: Request, res: Response): Promise<void> {
    try {
      const { user } = req.query;
      
      const indicators = await this.hookBridge.getProductivityIndicators(user as string);
      
      // Match the exact format expected by local hooks
      const legacyIndicators = {
        session_id: indicators.sessionId,
        start_time: indicators.startTime,
        baseline: indicators.baseline,
        current_metrics: indicators.currentMetrics,
        last_update: indicators.lastUpdate,
        productivity_score: indicators.productivityScore,
        trend: indicators.trend
      };
      
      this.sendLegacyResponse(res, 200, legacyIndicators);
      
    } catch (error) {
      this.sendLegacyError(res, 500, error.message);
    }
  }

  /**
   * Get baseline data (GET /api/v1/dashboard/baseline)
   */
  private async getBaseline(req: Request, res: Response): Promise<void> {
    try {
      const { user } = req.query;
      
      const baseline = await this.hookBridge.getBaseline(user as string);
      
      // Match historical baseline format
      const legacyBaseline = {
        average_commands_per_hour: baseline.averageCommandsPerHour,
        average_lines_per_hour: baseline.averageLinesPerHour,
        average_success_rate: baseline.averageSuccessRate,
        average_focus_time_minutes: baseline.averageFocusTimeMinutes,
        average_context_switches: baseline.averageContextSwitches
      };
      
      this.sendLegacyResponse(res, 200, legacyBaseline);
      
    } catch (error) {
      this.sendLegacyError(res, 500, error.message);
    }
  }

  /**
   * Handle session start hook (POST /api/v1/hooks/session-start)
   */
  private async handleSessionStart(req: Request, res: Response): Promise<void> {
    try {
      const sessionData = req.body;
      
      // This endpoint mimics the local session-start.js hook behavior
      const result = await this.hookBridge.handleSessionStart(sessionData);
      
      // Return in the exact format expected by local hooks
      const legacyResponse = {
        success: true,
        executionTime: result.executionTime || 0,
        memoryUsage: result.memoryUsage || 0,
        metrics: {
          sessionId: result.sessionId,
          gitBranch: result.gitBranch,
          user: result.user
        }
      };
      
      this.sendLegacyResponse(res, 200, legacyResponse);
      
    } catch (error) {
      this.sendLegacyError(res, 500, error.message);
    }
  }

  /**
   * Handle session end hook (POST /api/v1/hooks/session-end)
   */
  private async handleSessionEnd(req: Request, res: Response): Promise<void> {
    try {
      const sessionData = req.body;
      
      const result = await this.hookBridge.handleSessionEnd(sessionData);
      
      const legacyResponse = {
        success: true,
        executionTime: result.executionTime || 0,
        memoryUsage: result.memoryUsage || 0,
        metrics: {
          sessionId: result.sessionId,
          productivityScore: result.productivityScore,
          duration: result.duration
        }
      };
      
      this.sendLegacyResponse(res, 200, legacyResponse);
      
    } catch (error) {
      this.sendLegacyError(res, 500, error.message);
    }
  }

  /**
   * Handle tool usage hook (POST /api/v1/hooks/tool-usage)
   */
  private async handleToolUsage(req: Request, res: Response): Promise<void> {
    try {
      const toolData = req.body;
      
      const result = await this.hookBridge.handleToolUsage(toolData);
      
      const legacyResponse = {
        success: true,
        executionTime: result.executionTime || 0,
        memoryUsage: result.memoryUsage || 0,
        metrics: {
          toolName: result.toolName,
          sessionId: result.sessionId,
          recorded: true
        }
      };
      
      this.sendLegacyResponse(res, 200, legacyResponse);
      
    } catch (error) {
      this.sendLegacyError(res, 500, error.message);
    }
  }

  /**
   * Health check endpoint (GET /api/v1/health)
   */
  private async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      // Verify database connectivity
      await this.prisma.$queryRaw`SELECT 1`;
      
      const healthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        compatibility_mode: 'legacy',
        database_status: 'connected',
        hooks_bridge_status: 'active'
      };
      
      this.sendLegacyResponse(res, 200, healthStatus);
      
    } catch (error) {
      this.sendLegacyError(res, 503, `Health check failed: ${error.message}`);
    }
  }

  /**
   * Get version info (GET /api/v1/version)
   */
  private async getVersion(req: Request, res: Response): Promise<void> {
    const versionInfo = {
      api_version: '1.0.0',
      compatibility_version: '1.0.0',
      service: 'External Metrics Web Service',
      mode: 'hybrid',
      local_hooks_compatible: true,
      migration_support: true
    };
    
    this.sendLegacyResponse(res, 200, versionInfo);
  }

  /**
   * Get migration status (GET /api/v1/migration/status)
   */
  private async getMigrationStatus(req: Request, res: Response): Promise<void> {
    try {
      const migrationStatus = await this.hookBridge.getMigrationStatus();
      
      this.sendLegacyResponse(res, 200, migrationStatus);
      
    } catch (error) {
      this.sendLegacyError(res, 500, error.message);
    }
  }

  /**
   * Sync local data to cloud (POST /api/v1/migration/sync)
   */
  private async syncLocalData(req: Request, res: Response): Promise<void> {
    try {
      const syncData = req.body;
      
      const result = await this.hookBridge.syncLocalData(syncData);
      
      this.sendLegacyResponse(res, 200, result, 'Local data synced successfully');
      
    } catch (error) {
      this.sendLegacyError(res, 500, error.message);
    }
  }

  // Validation middleware

  private validateSession(req: Request, res: Response, next: NextFunction): void {
    const schema = Joi.object({
      session_id: Joi.string().required(),
      start_time: Joi.string().isoDate().required(),
      end_time: Joi.string().isoDate().optional(),
      user: Joi.string().required(),
      working_directory: Joi.string().optional(),
      git_branch: Joi.string().optional(),
      productivity_metrics: Joi.object().optional(),
      quality_metrics: Joi.object().optional(),
      workflow_metrics: Joi.object().optional()
    });

    const { error } = schema.validate(req.body);
    if (error) {
      this.sendLegacyError(res, 400, `Validation error: ${error.details[0].message}`);
      return;
    }

    next();
  }

  private validateToolMetric(req: Request, res: Response, next: NextFunction): void {
    const schema = Joi.object({
      event: Joi.string().required(),
      timestamp: Joi.string().isoDate().required(),
      session_id: Joi.string().optional(),
      tool_name: Joi.string().optional(),
      execution_time: Joi.number().optional(),
      memory_usage: Joi.number().optional(),
      success: Joi.boolean().optional(),
      error_message: Joi.string().optional(),
      parameters: Joi.any().optional(),
      output_size: Joi.number().optional()
    });

    const { error } = schema.validate(req.body);
    if (error) {
      this.sendLegacyError(res, 400, `Validation error: ${error.details[0].message}`);
      return;
    }

    next();
  }

  private validateToolMetricBatch(req: Request, res: Response, next: NextFunction): void {
    const data = req.body.metrics || req.body;
    
    if (!Array.isArray(data)) {
      this.sendLegacyError(res, 400, 'Expected array of tool metrics');
      return;
    }

    if (data.length > 100) {
      this.sendLegacyError(res, 400, 'Batch size cannot exceed 100 metrics');
      return;
    }

    next();
  }

  // Response helpers

  private sendLegacyResponse<T>(
    res: Response, 
    statusCode: number, 
    data?: T, 
    message?: string
  ): void {
    const response: LegacyResponse<T> = {
      success: statusCode < 400,
      data,
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    };

    if (message) {
      response.data = { ...response.data as any, message };
    }

    res.status(statusCode).json(response);
  }

  private sendLegacyError(res: Response, statusCode: number, error: string): void {
    const response: LegacyResponse = {
      success: false,
      error,
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    };

    res.status(statusCode).json(response);
  }
}

/**
 * Create and configure legacy API controller
 */
export function createLegacyApiController(prisma: PrismaClient, tenantId: string): Router {
  const controller = new LegacyApiController(prisma, tenantId);
  return controller.getRouter();
}