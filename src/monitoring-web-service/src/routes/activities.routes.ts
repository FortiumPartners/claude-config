import { Router, Request, Response } from 'express';
import { ExtendedPrismaClient } from '../database/prisma-client';
import { authenticateToken, developmentAuth } from '../auth/auth.middleware';
import { logger } from '../config/logger';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';

const router = Router();
const prisma = new ExtendedPrismaClient();

// Set the tenant context to fortium_schema for this service
const FORTIUM_TENANT_CONTEXT = {
  tenantId: 'fortium-org',
  schemaName: 'fortium_schema',
  domain: 'fortium.com'
};

// Initialize tenant context on startup
(async () => {
  try {
    await prisma.setTenantContext(FORTIUM_TENANT_CONTEXT);
  } catch (error) {
    console.error('Failed to set tenant context:', error);
  }
})();

// Helper function to validate UUID format
function validateUUID(userId?: string): string {
  if (!userId) {
    throw new Error('User ID is required');
  }

  // Check if it's a valid UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId)) {
    throw new Error(`Invalid UUID format: ${userId}`);
  }

  return userId;
}

// Helper function to ensure user exists or create development user
async function ensureUserExists(userId: string, tenantContext: any): Promise<void> {
  try {
    await prisma.withTenantContext(tenantContext, async (client) => {
      // First check if user exists
      const existingUser = await client.user.findUnique({
        where: { id: userId }
      });

      if (!existingUser) {
        logger.info('User not found, creating development user', { userId });

        // Create development user if it doesn't exist
        await client.user.create({
          data: {
            id: userId,
            email: 'demo@fortium.com',
            firstName: 'Demo',
            lastName: 'User',
            role: 'admin',
            tenantId: tenantContext.tenantId,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });

        logger.info('Development user created successfully', { userId });
      }
    });
  } catch (error) {
    logger.error('Failed to ensure user exists', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    throw new Error(`Failed to ensure user exists: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

interface ActivityQuery {
  limit?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  show_automated?: string;
  page?: string;
}

interface ActivityResponse {
  id: string;
  user: {
    name: string;
    avatar_url: string | null;
  };
  action: {
    name: string;
    description: string;
  };
  target: {
    name: string;
  };
  status: 'success' | 'in_progress' | 'error';
  timestamp: string;
  duration_ms: number | null;
  is_automated: boolean;
  priority: 'critical' | 'high' | 'normal' | 'low';
}

/**
 * GET /api/v1/activities
 * Retrieve activities with filtering and pagination
 */
router.get('/', developmentAuth, async (req: Request, res: Response) => {
  try {
    const {
      limit = '100',
      sort = 'timestamp',
      order = 'desc',
      show_automated = 'true',
      page = '1'
    } = req.query as ActivityQuery;

    const limitNum = Math.min(parseInt(limit) || 100, 1000); // Cap at 1000
    const pageNum = Math.max(parseInt(page) || 1, 1);
    const skip = (pageNum - 1) * limitNum;
    const showAutomated = show_automated === 'true';

    logger.info('Fetching activities', {
      limit: limitNum,
      page: pageNum,
      sort,
      order,
      show_automated: showAutomated,
      user: req.user?.userId
    });

    // Build where clause
    const whereClause: any = {};

    if (!showAutomated) {
      whereClause.isAutomated = false;
    }

    // Build orderBy clause
    const orderByClause: any = {};
    if (sort === 'timestamp') {
      orderByClause.timestamp = order;
    } else if (sort === 'duration') {
      orderByClause.duration_ms = order;
    } else if (sort === 'priority') {
      orderByClause.priority = order;
    } else {
      orderByClause.timestamp = 'desc'; // Default fallback
    }

    // Fetch activities with count using fortium_schema
    const [activities, total] = await prisma.withTenantContext(FORTIUM_TENANT_CONTEXT, async (client) => {
      return await Promise.all([
        client.activityData.findMany({
          where: whereClause,
          orderBy: orderByClause,
          skip,
          take: limitNum,
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        }),
        client.activityData.count({
          where: whereClause
        })
      ]);
    });

    // Transform data to match expected frontend interface
    const transformedActivities: ActivityResponse[] = activities.map(activity => ({
      id: activity.id,
      user: {
        name: `${activity.user?.firstName || ''} ${activity.user?.lastName || ''}`.trim() || 'Unknown User',
        avatar_url: null // No avatar URL in current user model
      },
      action: {
        name: activity.actionName || 'Unknown Action',
        description: activity.actionDescription || 'No description available'
      },
      target: {
        name: activity.targetName || 'Unknown Target'
      },
      status: activity.status as 'success' | 'in_progress' | 'error',
      timestamp: activity.timestamp.toISOString(),
      duration_ms: activity.duration,
      is_automated: activity.isAutomated || false,
      priority: activity.priority === 0 ? 'normal' : activity.priority === 1 ? 'low' : activity.priority === 2 ? 'high' : activity.priority >= 3 ? 'critical' : 'normal'
    }));

    logger.info('Activities fetched successfully', {
      count: transformedActivities.length,
      total,
      page: pageNum,
      user: req.user?.userId
    });

    res.json({
      data: transformedActivities,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: total,
        total_pages: Math.ceil(total / limitNum),
        has_next: (pageNum * limitNum) < total,
        has_prev: pageNum > 1
      }
    });

  } catch (error) {
    logger.error('Error fetching activities:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      user: req.user?.userId,
      query: req.query
    });

    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch activities'
    });
  }
});

/**
 * GET /api/v1/activities/summary
 * Get activity summary statistics
 */
router.get('/summary', developmentAuth, async (req: Request, res: Response) => {
  try {
    const [
      totalActivities,
      automatedActivities,
      errorActivities,
      recentActivities
    ] = await prisma.withTenantContext(FORTIUM_TENANT_CONTEXT, async (client) => {
      return await Promise.all([
        client.activityData.count(),
        client.activityData.count({
          where: { isAutomated: true }
        }),
        client.activityData.count({
          where: { status: 'error' }
        }),
        client.activityData.count({
          where: {
            timestamp: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
            }
          }
        })
      ]);
    });

    res.json({
      total_activities: totalActivities,
      automated_activities: automatedActivities,
      error_activities: errorActivities,
      recent_activities: recentActivities,
      automation_rate: totalActivities > 0 ? (automatedActivities / totalActivities) * 100 : 0,
      error_rate: totalActivities > 0 ? (errorActivities / totalActivities) * 100 : 0
    });

  } catch (error) {
    logger.error('Error fetching activity summary:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      user: req.user?.userId
    });

    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch activity summary'
    });
  }
});

/**
 * POST /api/v1/activities
 * Create a new activity and broadcast it via WebSocket
 */
router.post('/', developmentAuth, async (req: Request, res: Response) => {
  try {
    const {
      actionName,
      actionDescription,
      targetName,
      status = 'success',
      duration,
      isAutomated = false,
      priority = 'normal'
    } = req.body;

    // Validate required fields
    if (!actionName || !targetName) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'actionName and targetName are required'
      });
    }

    // Validate user ID
    let validUserId: string;
    try {
      validUserId = validateUUID(req.user?.userId);
    } catch (error) {
      return res.status(400).json({
        error: 'Bad request',
        message: error instanceof Error ? error.message : 'Invalid user ID'
      });
    }

    // Convert priority string to number
    const priorityMapping: { [key: string]: number } = {
      'low': 1,
      'normal': 0,
      'high': 2,
      'critical': 3
    };

    const priorityNum = priorityMapping[priority] || 0;

    // Ensure user exists before creating activity
    try {
      await ensureUserExists(validUserId, FORTIUM_TENANT_CONTEXT);
    } catch (userError) {
      logger.error('Failed to ensure user exists for activity creation', {
        userId: validUserId,
        error: userError instanceof Error ? userError.message : 'Unknown error'
      });
      return res.status(400).json({
        error: 'Bad request',
        message: 'Invalid user ID or failed to create user'
      });
    }

    // Create the activity using fortium_schema
    const activity = await prisma.withTenantContext(FORTIUM_TENANT_CONTEXT, async (client) => {
      try {
        return await client.activityData.create({
          data: {
            actionName,
            actionDescription: actionDescription || actionName,
            targetName,
            status,
            duration: duration || null,
            isAutomated,
            priority: priorityNum,
            timestamp: new Date(),
            userId: validUserId
          },
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
      } catch (dbError) {
        logger.error('Database error creating activity', {
          userId: validUserId,
          actionName,
          targetName,
          error: dbError instanceof Error ? dbError.message : 'Unknown error',
          stack: dbError instanceof Error ? dbError.stack : undefined
        });

        // Check if it's a foreign key constraint error
        if (dbError instanceof Prisma.PrismaClientKnownRequestError) {
          if (dbError.code === 'P2003') {
            throw new Error('Foreign key constraint failed: User does not exist');
          }
        }

        throw dbError;
      }
    });

    // Transform to response format
    const activityResponse: ActivityResponse = {
      id: activity.id,
      user: {
        name: `${activity.user?.firstName || ''} ${activity.user?.lastName || ''}`.trim() || 'Unknown User',
        avatar_url: null
      },
      action: {
        name: activity.actionName || 'Unknown Action',
        description: activity.actionDescription || 'No description available'
      },
      target: {
        name: activity.targetName || 'Unknown Target'
      },
      status: activity.status as 'success' | 'in_progress' | 'error',
      timestamp: activity.timestamp.toISOString(),
      duration_ms: activity.duration,
      is_automated: activity.isAutomated || false,
      priority: activity.priority === 0 ? 'normal' : activity.priority === 1 ? 'low' : activity.priority === 2 ? 'high' : activity.priority >= 3 ? 'critical' : 'normal'
    };

    // Try to broadcast the new activity via WebSocket
    try {
      // Get WebSocket manager from app context if available
      const wsManager = (req as any).app?.wsManager;
      if (wsManager) {
        await wsManager.broadcastActivityEvent('1', {
          type: 'activity_created',
          activity: activityResponse
        });
        logger.info('Activity broadcasted via WebSocket', {
          activityId: activity.id,
          actionName: activity.actionName
        });
      }
    } catch (wsError) {
      // Don't fail the request if WebSocket broadcast fails
      logger.warn('Failed to broadcast activity via WebSocket', {
        activityId: activity.id,
        error: wsError instanceof Error ? wsError.message : 'Unknown error'
      });
    }

    logger.info('Activity created successfully', {
      activityId: activity.id,
      actionName: activity.actionName,
      user: req.user?.userId
    });

    res.status(201).json({
      data: activityResponse,
      message: 'Activity created successfully'
    });

  } catch (error) {
    logger.error('Error creating activity:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      user: req.user?.userId,
      body: req.body
    });

    // Provide more specific error messages based on the error type
    if (error instanceof Error) {
      if (error.message.includes('Foreign key constraint')) {
        return res.status(400).json({
          error: 'Bad request',
          message: 'Invalid user ID: user does not exist in database'
        });
      }

      if (error.message.includes('Invalid UUID format')) {
        return res.status(400).json({
          error: 'Bad request',
          message: error.message
        });
      }
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create activity'
    });
  }
});

/**
 * POST /api/v1/activities/test
 * Create a test activity for WebSocket testing
 */
router.post('/test', developmentAuth, async (req: Request, res: Response) => {
  try {
    // Validate user ID first
    let validUserId: string;
    try {
      validUserId = validateUUID(req.user?.userId);
    } catch (error) {
      return res.status(400).json({
        error: 'Bad request',
        message: error instanceof Error ? error.message : 'Invalid user ID'
      });
    }
    const testActivity = {
      actionName: 'WebSocket Test',
      actionDescription: 'Testing real-time WebSocket activity feed functionality',
      targetName: 'Real-time Activity Feed',
      status: 'success',
      duration: Math.floor(Math.random() * 1000) + 100, // Random duration 100-1100ms
      isAutomated: true,
      priority: 'normal'
    };

    // Ensure user exists before creating test activity
    try {
      await ensureUserExists(validUserId, FORTIUM_TENANT_CONTEXT);
    } catch (userError) {
      logger.error('Failed to ensure user exists for test activity creation', {
        userId: validUserId,
        error: userError instanceof Error ? userError.message : 'Unknown error'
      });
      return res.status(400).json({
        error: 'Bad request',
        message: 'Invalid user ID or failed to create user'
      });
    }

    // Create the test activity using fortium_schema
    const activity = await prisma.withTenantContext(FORTIUM_TENANT_CONTEXT, async (client) => {
      try {
        return await client.activityData.create({
          data: {
            ...testActivity,
            priority: 0, // normal priority
            timestamp: new Date(),
            userId: validUserId
          },
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
      } catch (dbError) {
        logger.error('Database error creating test activity', {
          userId: validUserId,
          error: dbError instanceof Error ? dbError.message : 'Unknown error',
          stack: dbError instanceof Error ? dbError.stack : undefined
        });

        // Check if it's a foreign key constraint error
        if (dbError instanceof Prisma.PrismaClientKnownRequestError) {
          if (dbError.code === 'P2003') {
            throw new Error('Foreign key constraint failed: User does not exist');
          }
        }

        throw dbError;
      }
    });

    // Transform to response format
    const activityResponse: ActivityResponse = {
      id: activity.id,
      user: {
        name: `${activity.user?.firstName || ''} ${activity.user?.lastName || ''}`.trim() || 'Test User',
        avatar_url: null
      },
      action: {
        name: activity.actionName || 'Test Action',
        description: activity.actionDescription || 'Test Description'
      },
      target: {
        name: activity.targetName || 'Test Target'
      },
      status: activity.status as 'success' | 'in_progress' | 'error',
      timestamp: activity.timestamp.toISOString(),
      duration_ms: activity.duration,
      is_automated: activity.isAutomated || false,
      priority: 'normal'
    };

    // Try to broadcast via WebSocket
    try {
      const wsManager = (req as any).app?.wsManager;
      if (wsManager) {
        await wsManager.broadcastActivityEvent('1', {
          type: 'activity_created',
          activity: activityResponse
        });
        logger.info('Test activity broadcasted via WebSocket', {
          activityId: activity.id
        });
      }
    } catch (wsError) {
      logger.warn('Failed to broadcast test activity via WebSocket', {
        error: wsError instanceof Error ? wsError.message : 'Unknown error'
      });
    }

    logger.info('Test activity created successfully', {
      activityId: activity.id
    });

    res.status(201).json({
      data: activityResponse,
      message: 'Test activity created and broadcasted successfully',
      websocket_broadcast: !!((req as any).app?.wsManager)
    });

  } catch (error) {
    logger.error('Error creating test activity:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      userId: validUserId
    });

    // Provide more specific error messages based on the error type
    if (error instanceof Error) {
      if (error.message.includes('Foreign key constraint')) {
        return res.status(400).json({
          error: 'Bad request',
          message: 'Invalid user ID: user does not exist in database'
        });
      }

      if (error.message.includes('Invalid UUID format')) {
        return res.status(400).json({
          error: 'Bad request',
          message: error.message
        });
      }
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create test activity'
    });
  }
});

export default router;