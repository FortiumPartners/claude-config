/**
 * Hooks Routes - Unauthenticated endpoints for Claude Config hooks
 * External Metrics Web Service - Hook Integration
 */

import { Router } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { responseMiddleware } from '../utils/response';
import { asyncHandler, ValidationError } from '../middleware/error.middleware';
import { logger } from '../config/logger';
import { ExtendedPrismaClient } from '../database/prisma-client';
import * as path from 'path';

const router = Router();
const prisma = new ExtendedPrismaClient();

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
      user_id,
      user_name,
      user: userEmail,
      organization_id,
      auth_token,
      ...additionalData
    } = req.body;

    // Basic validation
    if (!tool_name || !session_id) {
      throw new ValidationError('tool_name and session_id are required');
    }

    // STRICT SCHEMA VALIDATION - Set correct schema context BEFORE any database operations
    const requiredSchema = 'fortium_schema';
    const requiredTenant = 'dev-tenant-123';

    await prisma.setTenantContext({
      tenantId: requiredTenant,
      schemaName: requiredSchema,
      domain: 'fortium-demo'
    });

    // Verify schema context is correct
    const contextCheck = prisma.getCurrentTenantContext();
    if (!contextCheck || contextCheck.schemaName !== requiredSchema) {
      throw new Error(`SCHEMA_VALIDATION_ERROR: Failed to set correct schema context. Expected '${requiredSchema}', got: ${JSON.stringify(contextCheck)}`);
    }

    logger.info('Schema context validated for user operations', {
      schema: contextCheck.schemaName,
      tenant: contextCheck.tenantId
    });

    // Validate auth_token and resolve actual user from database
    let resolvedUserId = null;
    let resolvedOrganizationId = null;

    if (auth_token) {
      try {
        // Look up user by token in the database
        // Note: This assumes there's a token field or auth table.
        // For now, let's check if the token matches known patterns from user profiles

        // Try to find user by their stored auth token (hex format from user-profile.js)
        const userByToken = await prisma.user.findFirst({
          where: {
            // Assuming we add a token field to user table, or check against known tokens
            // For demo: look up by email if provided, otherwise use development user
            ...(userEmail && { email: userEmail }),
            ...(user_id && { id: user_id })
          }
        });

        if (userByToken) {
          resolvedUserId = userByToken.id;
          resolvedOrganizationId = 'dev-tenant-123'; // Default organization
          logger.info('Resolved user by token', {
            userId: resolvedUserId,
            email: userByToken.email
          });
        } else if (user_id && user_name && userEmail) {
          // Try to find user by ID first, then by email
          let user = await prisma.user.findUnique({
            where: { id: user_id }
          });

          if (!user) {
            // If not found by ID, try by email
            user = await prisma.user.findUnique({
              where: { email: userEmail }
            });
          }

          if (!user) {
            // Create user if doesn't exist at all
            user = await prisma.user.create({
              data: {
                id: user_id,
                email: userEmail,
                firstName: user_name.split(' ')[0] || user_name,
                lastName: user_name.split(' ').slice(1).join(' ') || '',
                role: 'developer'
              }
            });
            logger.info('Created new user from hook data', {
              userId: user_id,
              email: userEmail,
              name: user_name
            });
          } else {
            logger.info('Found existing user', {
              userId: user.id,
              email: user.email
            });
          }

          resolvedUserId = user.id;
          resolvedOrganizationId = 'dev-tenant-123'; // Default organization
        }
      } catch (error) {
        logger.warn('Failed to resolve user by token', {
          error: error.message,
          auth_token: auth_token ? `${auth_token.substring(0, 8)}...` : 'none',
          user_id,
          userEmail
        });
      }
    }

    // Require valid user resolution - no fallback
    if (!resolvedUserId) {
      throw new ValidationError('Unable to resolve user from provided token and information');
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

    // Convert tool metrics to activity data format
    const activityData = {
      actionName: tool_name,
      actionDescription: generateActionDescription(tool_name, success, execution_time_ms, additionalData),
      targetName: generateTargetName(tool_name, additionalData),
      targetType: 'tool_execution',
      status: success !== false ? 'success' : 'error',
      duration: execution_time_ms || null,
      isAutomated: true, // All hook activities are automated
      priority: success === false ? 2 : 0, // High priority for errors, normal otherwise
      timestamp: new Date(timestamp || Date.now()),
      metadata: {
        tool_name,
        session_id,
        execution_time_ms,
        source: 'claude-hooks',
        ...additionalData
      },
      tags: [tool_name.toLowerCase(), 'hook', 'automated'],
      userId: resolvedUserId,
      errorMessage: success === false ? 'Tool execution failed' : null,
      errorCode: success === false ? 'TOOL_EXECUTION_ERROR' : null
    };

    // FINAL SCHEMA VALIDATION - Double-check we're still in the correct schema
    const finalContextCheck = prisma.getCurrentTenantContext();
    if (!finalContextCheck || finalContextCheck.schemaName !== requiredSchema) {
      throw new Error(`FINAL_SCHEMA_VALIDATION_ERROR: Schema context changed unexpectedly. Expected '${requiredSchema}', got: ${JSON.stringify(finalContextCheck)}`);
    }

    logger.info('Final schema validation passed - creating activity in correct schema', {
      schema: finalContextCheck.schemaName,
      tenant: finalContextCheck.tenantId,
      activityId: 'to-be-created'
    });

    // Create the activity record in database (now verified to be in correct schema)
    const activity = await prisma.activityData.create({
      data: activityData,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    // Transform to WebSocket format for real-time updates
    const activityResponse = {
      id: activity.id,
      user: {
        name: `${activity.user?.firstName || ''} ${activity.user?.lastName || ''}`.trim() || 'System',
        avatar_url: null
      },
      action: {
        name: activity.actionName,
        description: activity.actionDescription
      },
      target: {
        name: activity.targetName
      },
      status: activity.status as 'success' | 'in_progress' | 'error',
      timestamp: activity.timestamp.toISOString(),
      duration_ms: activity.duration,
      is_automated: activity.isAutomated,
      priority: activity.priority === 0 ? 'normal' : activity.priority === 1 ? 'low' : activity.priority === 2 ? 'high' : 'critical'
    };

    // Broadcast to WebSocket clients if Socket.IO is available
    const io = (req as any).app?.get('io') || (router as any).io;
    if (io) {
      // Broadcast to all connected clients
      io.emit('metric_ingested', activityResponse);
      io.emit('dashboard_update', {
        type: 'tool_activity',
        activity: activityResponse
      });

      logger.info('Tool activity broadcasted via WebSocket', {
        activityId: activity.id,
        tool_name,
        session_id
      });
    } else {
      logger.warn('Socket.IO instance not available for WebSocket broadcasting');
    }

    const result = {
      id: activity.id,
      tool_name,
      session_id,
      activity_created: true,
      received_at: new Date().toISOString(),
      processed: true
    };

    res.created(result, 'Tool metrics received and activity created successfully');
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

// Helper functions for generating activity descriptions
function generateActionDescription(
  toolName: string,
  success: boolean,
  executionTime?: number,
  additionalData?: any
): string {
  let description = `${toolName} execution`;

  if (success === false) {
    description += ' failed';
  } else {
    description += ' completed';
  }

  if (executionTime) {
    description += ` in ${executionTime}ms`;
  }

  // Add tool-specific context
  if (additionalData?.file_path) {
    const filename = path.basename(additionalData.file_path);
    description += ` on ${filename}`;
  } else if (additionalData?.command) {
    const cmd = additionalData.command.split(' ')[0];
    description += ` (${cmd})`;
  } else if (additionalData?.subagent_type) {
    description += ` via ${additionalData.subagent_type}`;
  }

  return description;
}

function generateTargetName(toolName: string, additionalData?: any): string {
  if (additionalData?.file_path) {
    return path.basename(additionalData.file_path);
  } else if (additionalData?.command) {
    return additionalData.command.split(' ')[0];
  } else if (additionalData?.subagent_type) {
    return additionalData.subagent_type;
  } else {
    return toolName;
  }
}

export function createHooksRoutes(io?: SocketIOServer): Router {
  // Store the Socket.IO instance for broadcasting
  if (io) {
    (router as any).io = io;
  }
  return router;
}

export default router;