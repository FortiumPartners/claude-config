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

export default router;