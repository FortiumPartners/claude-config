/**
 * Hooks Routes - Unauthenticated endpoints for Claude Config hooks
 * External Metrics Web Service - Hook Integration
 */

import { Router } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { responseMiddleware } from '../utils/response';
import { asyncHandler, ValidationError } from '../middleware/error.middleware';
import { logger } from '../config/logger';

const router = Router();

// Apply response middleware to all hook routes
router.use(responseMiddleware);

/**
 * Hook Controllers - Simplified controllers for hook data ingestion
 * These endpoints accept data from Claude Config hooks without authentication
 * for local development and testing purposes
 */
const HooksController = {
  /**
   * @route   POST /hooks/tool-metrics
   * @desc    Submit tool usage metrics from hooks
   * @access  Public (unauthenticated)
   */
  submitToolMetrics: asyncHandler(async (req, res) => {
    const {
      tool_name,
      execution_time_ms,
      success,
      session_id,
      timestamp,
      ...additionalData
    } = req.body;

    // Basic validation
    if (!tool_name || !session_id) {
      throw new ValidationError('tool_name and session_id are required');
    }

    // Log the received metrics
    logger.info('Tool metrics received from hook', {
      tool_name,
      session_id,
      execution_time_ms,
      success,
      timestamp,
      source: 'claude-hooks'
    });

    // Broadcast to WebSocket clients if Socket.IO is available
    const io = (req as any).app?.get('io') || (router as any).io;
    if (io) {
      const broadcastData = {
        type: 'tool_metrics',
        tool_name,
        execution_time_ms,
        success,
        session_id,
        timestamp: timestamp || new Date().toISOString(),
        ...additionalData
      };
      
      // Broadcast to all connected clients
      io.emit('metric_ingested', broadcastData);
      io.emit('dashboard_update', {
        type: 'tool_execution',
        data: broadcastData
      });
      
      logger.info('Tool metrics broadcasted via WebSocket', { tool_name, session_id });
    } else {
      logger.warn('Socket.IO instance not available for WebSocket broadcasting');
    }

    // TODO: Store in database
    // For now, just acknowledge receipt
    const result = {
      id: `tool_${Date.now()}`,
      tool_name,
      session_id,
      received_at: new Date().toISOString(),
      processed: true
    };

    res.created(result, 'Tool metrics received successfully');
  }),

  /**
   * @route   POST /hooks/session-start
   * @desc    Submit session start data from hooks
   * @access  Public (unauthenticated)
   */
  submitSessionStart: asyncHandler(async (req, res) => {
    const {
      session_id,
      start_time,
      user_id,
      environment,
      git_branch,
      working_directory,
      ...additionalData
    } = req.body;

    // Basic validation
    if (!session_id || !start_time) {
      throw new ValidationError('session_id and start_time are required');
    }

    // Log the session start
    logger.info('Session start received from hook', {
      session_id,
      start_time,
      user_id,
      git_branch,
      source: 'claude-hooks'
    });

    // TODO: Store in database
    const result = {
      id: `session_${Date.now()}`,
      session_id,
      start_time,
      received_at: new Date().toISOString(),
      processed: true
    };

    res.created(result, 'Session start data received successfully');
  }),

  /**
   * @route   POST /hooks/session-end
   * @desc    Submit session end data from hooks
   * @access  Public (unauthenticated)
   */
  submitSessionEnd: asyncHandler(async (req, res) => {
    const {
      session_id,
      end_time,
      duration_hours,
      productivity_score,
      metrics,
      ...additionalData
    } = req.body;

    // Basic validation
    if (!session_id || !end_time) {
      throw new ValidationError('session_id and end_time are required');
    }

    // Log the session end
    logger.info('Session end received from hook', {
      session_id,
      end_time,
      duration_hours,
      productivity_score,
      metrics: metrics ? Object.keys(metrics) : [],
      source: 'claude-hooks'
    });

    // TODO: Store in database
    const result = {
      id: `session_end_${Date.now()}`,
      session_id,
      end_time,
      productivity_score,
      received_at: new Date().toISOString(),
      processed: true
    };

    res.created(result, 'Session end data received successfully');
  }),

  /**
   * @route   POST /hooks/productivity-data
   * @desc    Submit productivity metrics from hooks
   * @access  Public (unauthenticated)  
   */
  submitProductivityData: asyncHandler(async (req, res) => {
    const {
      session_id,
      productivity_score,
      metrics,
      recommendations,
      timestamp,
      ...additionalData
    } = req.body;

    // Basic validation
    if (!session_id) {
      throw new ValidationError('session_id is required');
    }

    // Log the productivity data
    logger.info('Productivity data received from hook', {
      session_id,
      productivity_score,
      metrics_count: metrics ? Object.keys(metrics).length : 0,
      recommendations_count: recommendations ? recommendations.length : 0,
      source: 'claude-hooks'
    });

    // TODO: Store in database
    const result = {
      id: `productivity_${Date.now()}`,
      session_id,
      productivity_score,
      received_at: new Date().toISOString(),
      processed: true
    };

    res.created(result, 'Productivity data received successfully');
  }),

  /**
   * @route   GET /hooks/health
   * @desc    Health check for hooks integration
   * @access  Public
   */
  healthCheck: asyncHandler(async (req, res) => {
    res.success({
      status: 'healthy',
      service: 'claude-hooks-integration',
      timestamp: new Date().toISOString(),
      endpoints: {
        'POST /hooks/tool-metrics': 'Tool usage metrics',
        'POST /hooks/session-start': 'Session initialization',
        'POST /hooks/session-end': 'Session finalization',
        'POST /hooks/productivity-data': 'Productivity metrics'
      }
    }, 'Hooks integration is healthy');
  })
};

// Hook Routes
router.post('/tool-metrics', HooksController.submitToolMetrics);
router.post('/session-start', HooksController.submitSessionStart);
router.post('/session-end', HooksController.submitSessionEnd);
router.post('/productivity-data', HooksController.submitProductivityData);
router.get('/health', HooksController.healthCheck);

export function createHooksRoutes(io?: SocketIOServer): Router {
  // Store the Socket.IO instance for broadcasting
  if (io) {
    (router as any).io = io;
  }
  return router;
}

export default router;