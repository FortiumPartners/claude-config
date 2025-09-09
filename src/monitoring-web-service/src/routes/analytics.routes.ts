/**
 * Analytics Routes
 * Fortium External Metrics Web Service - Analytics endpoints
 */

import { Router } from 'express';
import { authenticateToken } from '../auth/auth.middleware';
import { logger } from '../config/logger';

const router = Router();

// Apply authentication to all analytics routes
router.use(authenticateToken);

/**
 * GET /api/v1/analytics/productivity-trends
 * Get productivity trends data
 */
router.get('/productivity-trends', async (req, res) => {
  try {
    const { start_date, end_date, team_id, comparison_period } = req.query;
    const userId = req.user?.userId;
    const tenantId = req.user?.tenantId;

    logger.info('Fetching productivity trends', {
      userId,
      tenantId,
      startDate: start_date,
      endDate: end_date,
      teamId: team_id,
      comparisonPeriod: comparison_period,
    });

    // Generate sample productivity trends data
    const startDate = new Date(start_date as string);
    const endDate = new Date(end_date as string);
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    const trends = [];
    for (let i = 0; i <= daysDiff; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      
      // Generate realistic productivity scores
      const baseScore = 75;
      const variance = Math.random() * 20 - 10;
      const weekendAdjustment = (date.getDay() === 0 || date.getDay() === 6) ? -15 : 0;
      const score = Math.max(0, Math.min(100, baseScore + variance + weekendAdjustment));
      
      trends.push({
        date: date.toISOString(),
        productivity_score: Math.round(score),
        metrics: {
          tasks_completed: Math.floor(Math.random() * 20) + 5,
          commits: Math.floor(Math.random() * 15) + 3,
          reviews: Math.floor(Math.random() * 10) + 1,
          ai_interactions: Math.floor(Math.random() * 30) + 10,
        },
        team_id: team_id || null,
      });
    }

    res.success({
      data: trends,
      meta: {
        start_date,
        end_date,
        total_days: daysDiff + 1,
        average_score: Math.round(trends.reduce((acc, t) => acc + t.productivity_score, 0) / trends.length),
      }
    }, 'Productivity trends retrieved successfully');
  } catch (error) {
    logger.error('Error fetching productivity trends:', error);
    res.error('Failed to fetch productivity trends', 500);
  }
});

/**
 * GET /api/v1/analytics/team-comparison
 * Compare productivity metrics across teams
 */
router.get('/team-comparison', async (req, res) => {
  try {
    const { team_ids, metric_types, date_range } = req.query;
    const userId = req.user?.userId;
    const tenantId = req.user?.tenantId;

    logger.info('Fetching team comparison', {
      userId,
      tenantId,
      teamIds: team_ids,
      metricTypes: metric_types,
      dateRange: date_range,
    });

    // Generate sample team comparison data
    const comparison = (team_ids as string[]).map((teamId) => ({
      team_id: teamId,
      team_name: `Team ${teamId.substring(0, 8)}`,
      metrics: {
        productivity_score: Math.floor(Math.random() * 30) + 70,
        tasks_completed: Math.floor(Math.random() * 100) + 50,
        commits: Math.floor(Math.random() * 200) + 100,
        reviews: Math.floor(Math.random() * 50) + 20,
        ai_interactions: Math.floor(Math.random() * 500) + 200,
      },
      period: date_range,
    }));

    res.success({
      data: comparison,
      meta: {
        team_count: team_ids.length,
        date_range,
        metric_types,
      }
    }, 'Team comparison data retrieved successfully');
  } catch (error) {
    logger.error('Error fetching team comparison:', error);
    res.error('Failed to fetch team comparison', 500);
  }
});

/**
 * GET /api/v1/analytics/agent-usage
 * Get AI agent usage statistics
 */
router.get('/agent-usage', async (req, res) => {
  try {
    const { start_date, end_date, team_id } = req.query;
    const userId = req.user?.userId;
    const tenantId = req.user?.tenantId;

    logger.info('Fetching agent usage', {
      userId,
      tenantId,
      startDate: start_date,
      endDate: end_date,
      teamId: team_id,
    });

    // Generate sample agent usage data
    const agents = [
      'code-reviewer',
      'test-runner',
      'documentation-specialist',
      'git-workflow',
      'playwright-tester',
      'frontend-developer',
      'backend-developer',
    ];

    const usage = agents.map((agent) => ({
      agent_name: agent,
      usage_count: Math.floor(Math.random() * 100) + 20,
      success_rate: Math.floor(Math.random() * 20) + 80,
      average_execution_time: Math.floor(Math.random() * 5000) + 1000,
      error_count: Math.floor(Math.random() * 10),
      team_id: team_id || null,
    }));

    res.success({
      data: usage,
      meta: {
        start_date,
        end_date,
        total_agents: agents.length,
        total_usage: usage.reduce((acc, a) => acc + a.usage_count, 0),
      }
    }, 'Agent usage data retrieved successfully');
  } catch (error) {
    logger.error('Error fetching agent usage:', error);
    res.error('Failed to fetch agent usage', 500);
  }
});

/**
 * GET /api/v1/analytics/performance-metrics
 * Get performance metrics overview
 */
router.get('/performance-metrics', async (req, res) => {
  try {
    const { period, team_id } = req.query;
    const userId = req.user?.userId;
    const tenantId = req.user?.tenantId;

    logger.info('Fetching performance metrics', {
      userId,
      tenantId,
      period,
      teamId: team_id,
    });

    // Generate sample performance metrics
    const metrics = {
      overview: {
        productivity_score: Math.floor(Math.random() * 20) + 75,
        velocity: Math.floor(Math.random() * 30) + 70,
        quality_score: Math.floor(Math.random() * 15) + 80,
        collaboration_index: Math.floor(Math.random() * 20) + 70,
      },
      details: {
        tasks_completed: Math.floor(Math.random() * 100) + 50,
        bugs_fixed: Math.floor(Math.random() * 30) + 10,
        features_delivered: Math.floor(Math.random() * 20) + 5,
        code_reviews: Math.floor(Math.random() * 50) + 20,
        test_coverage: Math.floor(Math.random() * 20) + 70,
      },
      trends: {
        productivity_change: Math.floor(Math.random() * 20) - 10,
        velocity_change: Math.floor(Math.random() * 15) - 7,
        quality_change: Math.floor(Math.random() * 10) - 5,
      },
      period,
      team_id: team_id || null,
    };

    res.success({
      data: metrics
    }, 'Performance metrics retrieved successfully');
  } catch (error) {
    logger.error('Error fetching performance metrics:', error);
    res.error('Failed to fetch performance metrics', 500);
  }
});

export default router;