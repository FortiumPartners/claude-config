import { Router, Request, Response } from 'express';
import { ExtendedPrismaClient } from '../database/prisma-client';
import { authenticateToken } from '../auth/auth.middleware';
import { logger } from '../config/logger';

const router = Router();
const prisma = new ExtendedPrismaClient();

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
router.get('/', authenticateToken, async (req: Request, res: Response) => {
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

    // Fetch activities with count
    const [activities, total] = await Promise.all([
      prisma.activityData.findMany({
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
      prisma.activityData.count({
        where: whereClause
      })
    ]);

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
router.get('/summary', authenticateToken, async (req: Request, res: Response) => {
  try {
    const [
      totalActivities,
      automatedActivities,
      errorActivities,
      recentActivities
    ] = await Promise.all([
      prisma.activityData.count(),
      prisma.activityData.count({
        where: { isAutomated: true }
      }),
      prisma.activityData.count({
        where: { status: 'error' }
      }),
      prisma.activityData.count({
        where: {
          timestamp: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      })
    ]);

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
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const {
      actionName,
      actionDescription,
      targetName,
      status = 'success',
      duration_ms,
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

    // Convert priority string to number
    const priorityMapping: { [key: string]: number } = {
      'low': 1,
      'normal': 0,
      'high': 2,
      'critical': 3
    };

    const priorityNum = priorityMapping[priority] || 0;

    // Create the activity
    const activity = await prisma.activityData.create({
      data: {
        actionName,
        actionDescription: actionDescription || actionName,
        targetName,
        status,
        duration: duration_ms || null,
        isAutomated,
        priority: priorityNum,
        timestamp: new Date(),
        userId: req.user?.userId || '1', // Default to user 1 if no user
        organizationId: req.user?.organizationId || '1' // Default to org 1
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
        await wsManager.broadcastActivityEvent(req.user?.organizationId || '1', {
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
router.post('/test', async (req: Request, res: Response) => {
  try {
    const testActivity = {
      actionName: 'WebSocket Test',
      actionDescription: 'Testing real-time WebSocket activity feed functionality',
      targetName: 'Real-time Activity Feed',
      status: 'success',
      duration_ms: Math.floor(Math.random() * 1000) + 100, // Random duration 100-1100ms
      isAutomated: true,
      priority: 'normal'
    };

    // Create the test activity
    const activity = await prisma.activityData.create({
      data: {
        ...testActivity,
        priority: 0, // normal priority
        timestamp: new Date(),
        userId: '1', // Default test user
        organizationId: '1' // Default test org
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
      stack: error instanceof Error ? error.stack : undefined
    });

    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create test activity'
    });
  }
});

export default router;