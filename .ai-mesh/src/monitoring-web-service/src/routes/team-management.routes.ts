/**
 * Team Management Routes
 * Handles CRUD operations for teams with hierarchical permissions
 */

import express from 'express';
import rateLimit from 'express-rate-limit';
import * as winston from 'winston';
import Joi from 'joi';
import { DatabaseConnection } from '../database/connection';
import { AuthRequest } from './auth.routes';

// Validation schemas
const createTeamSchema = Joi.object({
  name: Joi.string().min(2).max(255).required(),
  description: Joi.string().max(1000).optional(),
  settings: Joi.object().optional().default({}),
  initial_members: Joi.array().items(
    Joi.object({
      user_id: Joi.string().uuid().required(),
      role: Joi.string().valid('lead', 'member').default('member'),
    })
  ).optional(),
});

const updateTeamSchema = Joi.object({
  name: Joi.string().min(2).max(255).optional(),
  description: Joi.string().max(1000).optional(),
  settings: Joi.object().optional(),
  is_active: Joi.boolean().optional(),
});

const addMemberSchema = Joi.object({
  user_id: Joi.string().uuid().required(),
  role: Joi.string().valid('lead', 'member').default('member'),
});

const updateMemberSchema = Joi.object({
  role: Joi.string().valid('lead', 'member').required(),
});

const bulkMemberActionSchema = Joi.object({
  user_ids: Joi.array().items(Joi.string().uuid()).min(1).max(50).required(),
  action: Joi.string().valid('add', 'remove', 'promote', 'demote').required(),
  role: Joi.string().valid('lead', 'member').when('action', {
    is: Joi.string().valid('add', 'promote'),
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
});

export function createTeamManagementRoutes(db: DatabaseConnection, logger: winston.Logger, authenticateJWT?: (req: AuthRequest, res: express.Response, next: express.NextFunction) => Promise<void>) {
  const router = express.Router();

  // Use provided authentication middleware or create a default one
  const authMiddleware = authenticateJWT || (async (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
    logger.warn('No authentication middleware provided - using placeholder');
    next();
  });

  // Permission check middleware
  const requireTeamPermission = (action: string) => {
    return async (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
      try {
        const userRole = req.user?.role;
        const teamId = req.params.teamId;
        
        if (!userRole) {
          return res.status(401).json({
            error: 'Authentication required',
            timestamp: new Date().toISOString(),
          });
        }

        // Owner and admin have full team management access
        if (['owner', 'admin'].includes(userRole)) {
          return next();
        }

        // For team-specific actions, check team leadership
        if (teamId) {
          const memberResult = await db.query(
            'SELECT role FROM team_memberships WHERE team_id = $1 AND user_id = $2',
            [teamId, req.user!.id]
          );

          const membership = memberResult.rows[0];
          
          // Team leads can manage their team
          if (membership && membership.role === 'lead') {
            return next();
          }

          // Managers can view teams they're members of
          if (userRole === 'manager' && action === 'read' && membership) {
            return next();
          }
        }

        // Managers can create teams and view all teams
        if (userRole === 'manager' && ['create', 'read'].includes(action)) {
          return next();
        }

        return res.status(403).json({
          error: 'Insufficient permissions',
          required_permission: `teams:${action}`,
          user_role: userRole,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error('Team permission check error', { error, user_id: req.user?.id });
        res.status(500).json({
          error: 'Permission check failed',
          timestamp: new Date().toISOString(),
        });
      }
    };
  };

  // Rate limiting
  const teamManagementLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: { error: 'Too many team management requests' },
  });

  /**
   * GET /api/teams
   * List teams with member information
   */
  router.get('/', authMiddleware, requireTeamPermission('read'), async (req: AuthRequest, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const offset = (page - 1) * limit;
      const search = req.query.search as string;
      const is_active = req.query.is_active as string;
      const my_teams_only = req.query.my_teams_only === 'true';

      // Build query conditions
      const conditions: string[] = ['t.organization_id = $1'];
      const params: any[] = [req.user!.organization_id];
      let paramIndex = 2;

      if (search) {
        conditions.push(`(t.name ILIKE $${paramIndex} OR t.description ILIKE $${paramIndex})`);
        params.push(`%${search}%`);
        paramIndex++;
      }

      if (is_active !== undefined) {
        conditions.push(`t.is_active = $${paramIndex}`);
        params.push(is_active === 'true');
        paramIndex++;
      }

      // Filter to only teams the user is a member of
      if (my_teams_only || req.user!.role === 'developer') {
        conditions.push(`EXISTS (
          SELECT 1 FROM team_memberships tm 
          WHERE tm.team_id = t.id AND tm.user_id = $${paramIndex}
        )`);
        params.push(req.user!.id);
        paramIndex++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const query = `
        SELECT t.id, t.name, t.description, t.settings, t.is_active, t.created_at,
               COUNT(*) OVER() as total_count,
               -- Member count and roles
               (
                 SELECT COUNT(*) 
                 FROM team_memberships tm 
                 WHERE tm.team_id = t.id
               ) as member_count,
               (
                 SELECT COUNT(*) 
                 FROM team_memberships tm 
                 WHERE tm.team_id = t.id AND tm.role = 'lead'
               ) as lead_count,
               -- Current user's role in this team
               (
                 SELECT tm.role 
                 FROM team_memberships tm 
                 WHERE tm.team_id = t.id AND tm.user_id = $${paramIndex}
               ) as user_role,
               -- Recent activity
               (
                 SELECT COUNT(*) 
                 FROM productivity_metrics pm 
                 WHERE pm.team_id = t.id 
                 AND pm.timestamp >= NOW() - INTERVAL '7 days'
               ) as recent_activity_count
        FROM teams t
        ${whereClause}
        ORDER BY t.name ASC
        LIMIT $${paramIndex + 1} OFFSET $${paramIndex + 2}
      `;

      params.push(req.user!.id, limit, offset);
      const result = await db.query(query, params);

      const teams = result.rows;
      const totalCount = teams.length > 0 ? parseInt(teams[0].total_count) : 0;
      const totalPages = Math.ceil(totalCount / limit);

      res.json({
        teams: teams.map(t => ({
          id: t.id,
          name: t.name,
          description: t.description,
          settings: t.settings,
          is_active: t.is_active,
          member_count: parseInt(t.member_count),
          lead_count: parseInt(t.lead_count),
          user_role: t.user_role,
          recent_activity_count: parseInt(t.recent_activity_count),
          created_at: t.created_at,
        })),
        pagination: {
          page,
          limit,
          total_count: totalCount,
          total_pages: totalPages,
          has_next: page < totalPages,
          has_prev: page > 1,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('List teams error', { error, user_id: req.user?.id });
      res.status(500).json({
        error: 'Failed to list teams',
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /api/teams/:teamId
   * Get detailed team information with members
   */
  router.get('/:teamId', authMiddleware, requireTeamPermission('read'), async (req: AuthRequest, res) => {
    try {
      const { teamId } = req.params;
      const include_metrics = req.query.include_metrics === 'true';

      // Get team details
      const teamQuery = `
        SELECT t.id, t.name, t.description, t.settings, t.is_active, 
               t.created_at, t.updated_at,
               -- Project count
               (
                 SELECT COUNT(*) 
                 FROM projects p 
                 WHERE p.team_id = t.id AND p.status = 'active'
               ) as active_project_count,
               -- Current user's role in this team
               (
                 SELECT tm.role 
                 FROM team_memberships tm 
                 WHERE tm.team_id = t.id AND tm.user_id = $2
               ) as user_role
        FROM teams t
        WHERE t.id = $1 AND t.organization_id = $3
      `;

      const teamResult = await db.query(teamQuery, [teamId, req.user!.id, req.user!.organization_id]);

      if (teamResult.rows.length === 0) {
        return res.status(404).json({
          error: 'Team not found',
          timestamp: new Date().toISOString(),
        });
      }

      const team = teamResult.rows[0];

      // Get team members
      const membersQuery = `
        SELECT u.id, u.email, u.name, u.role as user_role, u.is_active,
               tm.role as team_role, tm.joined_at,
               u.last_login_at
        FROM team_memberships tm
        JOIN users u ON tm.user_id = u.id
        WHERE tm.team_id = $1
        ORDER BY tm.role DESC, u.name ASC
      `;

      const membersResult = await db.query(membersQuery, [teamId]);

      let metricsData = null;
      if (include_metrics) {
        // Get team productivity metrics for the last 30 days
        const metricsQuery = `
          SELECT 
            DATE_TRUNC('day', pm.timestamp) as date,
            COUNT(*) as total_activities,
            AVG(CASE WHEN pm.metric_name = 'execution_time_ms' THEN pm.metric_value END) as avg_execution_time,
            COUNT(DISTINCT pm.user_id) as active_users
          FROM productivity_metrics pm
          WHERE pm.team_id = $1 
          AND pm.timestamp >= NOW() - INTERVAL '30 days'
          GROUP BY DATE_TRUNC('day', pm.timestamp)
          ORDER BY date DESC
          LIMIT 30
        `;

        const metricsResult = await db.query(metricsQuery, [teamId]);
        metricsData = metricsResult.rows.map(row => ({
          date: row.date,
          total_activities: parseInt(row.total_activities),
          avg_execution_time: row.avg_execution_time ? parseFloat(row.avg_execution_time) : null,
          active_users: parseInt(row.active_users),
        }));
      }

      res.json({
        team: {
          id: team.id,
          name: team.name,
          description: team.description,
          settings: team.settings,
          is_active: team.is_active,
          active_project_count: parseInt(team.active_project_count),
          user_role: team.user_role,
          created_at: team.created_at,
          updated_at: team.updated_at,
        },
        members: membersResult.rows.map(m => ({
          id: m.id,
          email: m.email,
          name: m.name,
          user_role: m.user_role,
          team_role: m.team_role,
          is_active: m.is_active,
          joined_at: m.joined_at,
          last_login_at: m.last_login_at,
        })),
        metrics: metricsData,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Get team error', { error, user_id: req.user?.id });
      res.status(500).json({
        error: 'Failed to get team',
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * POST /api/teams
   * Create new team
   */
  router.post('/', authMiddleware, requireTeamPermission('create'), async (req: AuthRequest, res) => {
    try {
      const { error, value } = createTeamSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.details.map(d => d.message),
          timestamp: new Date().toISOString(),
        });
      }

      const { name, description, settings, initial_members } = value;

      // Check if team with same name exists
      const existingTeam = await db.query(
        'SELECT id FROM teams WHERE organization_id = $1 AND name = $2',
        [req.user!.organization_id, name]
      );

      if (existingTeam.rows.length > 0) {
        return res.status(409).json({
          error: 'Team with this name already exists',
          timestamp: new Date().toISOString(),
        });
      }

      // Begin transaction
      const client = await db.getClient();
      await client.query('BEGIN');

      try {
        // Create team
        const teamQuery = `
          INSERT INTO teams (organization_id, name, description, settings, is_active)
          VALUES ($1, $2, $3, $4, true)
          RETURNING id, name, description, settings, is_active, created_at
        `;

        const teamResult = await client.query(teamQuery, [
          req.user!.organization_id,
          name,
          description,
          JSON.stringify(settings),
        ]);

        const newTeam = teamResult.rows[0];

        // Add creator as team lead unless they're just admin creating the team
        if (req.user!.role !== 'admin') {
          await client.query(
            'INSERT INTO team_memberships (organization_id, team_id, user_id, role) VALUES ($1, $2, $3, $4)',
            [req.user!.organization_id, newTeam.id, req.user!.id, 'lead']
          );
        }

        // Add initial members if provided
        if (initial_members && initial_members.length > 0) {
          for (const member of initial_members) {
            // Verify user exists and is in the same organization
            const userExists = await client.query(
              'SELECT id FROM users WHERE id = $1 AND organization_id = $2 AND is_active = true',
              [member.user_id, req.user!.organization_id]
            );

            if (userExists.rows.length > 0) {
              await client.query(
                'INSERT INTO team_memberships (organization_id, team_id, user_id, role) VALUES ($1, $2, $3, $4) ON CONFLICT (team_id, user_id) DO NOTHING',
                [req.user!.organization_id, newTeam.id, member.user_id, member.role]
              );
            }
          }
        }

        await client.query('COMMIT');

        logger.info('Team created successfully', {
          team_id: newTeam.id,
          team_name: newTeam.name,
          created_by: req.user!.id,
          organization_id: req.user!.organization_id,
          initial_member_count: initial_members?.length || 0,
        });

        res.status(201).json({
          team: {
            id: newTeam.id,
            name: newTeam.name,
            description: newTeam.description,
            settings: newTeam.settings,
            is_active: newTeam.is_active,
            created_at: newTeam.created_at,
          },
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Create team error', { error, user_id: req.user?.id });
      res.status(500).json({
        error: 'Failed to create team',
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * PUT /api/teams/:teamId
   * Update team information
   */
  router.put('/:teamId', authMiddleware, requireTeamPermission('update'), async (req: AuthRequest, res) => {
    try {
      const { teamId } = req.params;
      const { error, value } = updateTeamSchema.validate(req.body);
      
      if (error) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.details.map(d => d.message),
          timestamp: new Date().toISOString(),
        });
      }

      // Check if team exists
      const existingTeam = await db.query(
        'SELECT id, name FROM teams WHERE id = $1 AND organization_id = $2',
        [teamId, req.user!.organization_id]
      );

      if (existingTeam.rows.length === 0) {
        return res.status(404).json({
          error: 'Team not found',
          timestamp: new Date().toISOString(),
        });
      }

      // Check for name conflicts if name is being updated
      if (value.name && value.name !== existingTeam.rows[0].name) {
        const nameConflict = await db.query(
          'SELECT id FROM teams WHERE organization_id = $1 AND name = $2 AND id != $3',
          [req.user!.organization_id, value.name, teamId]
        );

        if (nameConflict.rows.length > 0) {
          return res.status(409).json({
            error: 'Team with this name already exists',
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Build update query
      const updates: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (value.name) {
        updates.push(`name = $${paramIndex++}`);
        params.push(value.name);
      }

      if (value.description !== undefined) {
        updates.push(`description = $${paramIndex++}`);
        params.push(value.description);
      }

      if (value.settings) {
        updates.push(`settings = $${paramIndex++}`);
        params.push(JSON.stringify(value.settings));
      }

      if (value.is_active !== undefined) {
        updates.push(`is_active = $${paramIndex++}`);
        params.push(value.is_active);
      }

      if (updates.length === 0) {
        return res.status(400).json({
          error: 'No valid updates provided',
          timestamp: new Date().toISOString(),
        });
      }

      updates.push(`updated_at = NOW()`);
      params.push(teamId, req.user!.organization_id);

      const query = `
        UPDATE teams 
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex++} AND organization_id = $${paramIndex++}
        RETURNING id, name, description, settings, is_active, updated_at
      `;

      const result = await db.query(query, params);
      const updatedTeam = result.rows[0];

      logger.info('Team updated successfully', {
        team_id: updatedTeam.id,
        updated_by: req.user!.id,
        updates: Object.keys(value),
        organization_id: req.user!.organization_id,
      });

      res.json({
        team: updatedTeam,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Update team error', { error, user_id: req.user?.id });
      res.status(500).json({
        error: 'Failed to update team',
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * DELETE /api/teams/:teamId
   * Delete team (soft delete)
   */
  router.delete('/:teamId', authMiddleware, requireTeamPermission('delete'), async (req: AuthRequest, res) => {
    try {
      const { teamId } = req.params;

      // Check if team exists
      const teamResult = await db.query(
        'SELECT id, name FROM teams WHERE id = $1 AND organization_id = $2',
        [teamId, req.user!.organization_id]
      );

      if (teamResult.rows.length === 0) {
        return res.status(404).json({
          error: 'Team not found',
          timestamp: new Date().toISOString(),
        });
      }

      const team = teamResult.rows[0];

      // Check if team has active projects
      const projectsResult = await db.query(
        'SELECT COUNT(*) as count FROM projects WHERE team_id = $1 AND status = $2',
        [teamId, 'active']
      );

      const activeProjectsCount = parseInt(projectsResult.rows[0].count);
      if (activeProjectsCount > 0) {
        return res.status(400).json({
          error: 'Cannot delete team with active projects',
          active_projects_count: activeProjectsCount,
          message: 'Please archive or reassign active projects before deleting the team',
          timestamp: new Date().toISOString(),
        });
      }

      // Begin transaction
      const client = await db.getClient();
      await client.query('BEGIN');

      try {
        // Soft delete team (mark as inactive)
        await client.query(
          'UPDATE teams SET is_active = false, updated_at = NOW() WHERE id = $1',
          [teamId]
        );

        // Remove all team memberships
        await client.query('DELETE FROM team_memberships WHERE team_id = $1', [teamId]);

        // Archive related projects
        await client.query(
          'UPDATE projects SET status = $1, updated_at = NOW() WHERE team_id = $2',
          ['archived', teamId]
        );

        await client.query('COMMIT');

        logger.info('Team deleted successfully', {
          team_id: teamId,
          team_name: team.name,
          deleted_by: req.user!.id,
          organization_id: req.user!.organization_id,
        });

        res.json({
          message: 'Team deleted successfully',
          team: {
            id: team.id,
            name: team.name,
          },
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Delete team error', { error, user_id: req.user?.id });
      res.status(500).json({
        error: 'Failed to delete team',
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * Team Member Management Routes
   */

  /**
   * POST /api/teams/:teamId/members
   * Add member to team
   */
  router.post('/:teamId/members', authMiddleware, requireTeamPermission('update'), async (req: AuthRequest, res) => {
    try {
      const { teamId } = req.params;
      const { error, value } = addMemberSchema.validate(req.body);
      
      if (error) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.details.map(d => d.message),
          timestamp: new Date().toISOString(),
        });
      }

      const { user_id, role } = value;

      // Verify team exists
      const teamExists = await db.query(
        'SELECT id, name FROM teams WHERE id = $1 AND organization_id = $2 AND is_active = true',
        [teamId, req.user!.organization_id]
      );

      if (teamExists.rows.length === 0) {
        return res.status(404).json({
          error: 'Team not found',
          timestamp: new Date().toISOString(),
        });
      }

      // Verify user exists and is in the same organization
      const userResult = await db.query(
        'SELECT id, email, name FROM users WHERE id = $1 AND organization_id = $2 AND is_active = true',
        [user_id, req.user!.organization_id]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          error: 'User not found',
          timestamp: new Date().toISOString(),
        });
      }

      const user = userResult.rows[0];

      // Check if user is already a member
      const existingMembership = await db.query(
        'SELECT role FROM team_memberships WHERE team_id = $1 AND user_id = $2',
        [teamId, user_id]
      );

      if (existingMembership.rows.length > 0) {
        return res.status(409).json({
          error: 'User is already a member of this team',
          current_role: existingMembership.rows[0].role,
          timestamp: new Date().toISOString(),
        });
      }

      // Add team membership
      await db.query(
        'INSERT INTO team_memberships (organization_id, team_id, user_id, role) VALUES ($1, $2, $3, $4)',
        [req.user!.organization_id, teamId, user_id, role]
      );

      logger.info('Team member added successfully', {
        team_id: teamId,
        user_id: user_id,
        role: role,
        added_by: req.user!.id,
        organization_id: req.user!.organization_id,
      });

      res.status(201).json({
        message: 'Team member added successfully',
        member: {
          id: user.id,
          email: user.email,
          name: user.name,
          team_role: role,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Add team member error', { error, user_id: req.user?.id });
      res.status(500).json({
        error: 'Failed to add team member',
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * PUT /api/teams/:teamId/members/:userId
   * Update member role in team
   */
  router.put('/:teamId/members/:userId', authMiddleware, requireTeamPermission('update'), async (req: AuthRequest, res) => {
    try {
      const { teamId, userId } = req.params;
      const { error, value } = updateMemberSchema.validate(req.body);
      
      if (error) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.details.map(d => d.message),
          timestamp: new Date().toISOString(),
        });
      }

      const { role } = value;

      // Check if membership exists
      const membershipResult = await db.query(
        'SELECT tm.role, u.email, u.name FROM team_memberships tm JOIN users u ON tm.user_id = u.id WHERE tm.team_id = $1 AND tm.user_id = $2',
        [teamId, userId]
      );

      if (membershipResult.rows.length === 0) {
        return res.status(404).json({
          error: 'Team membership not found',
          timestamp: new Date().toISOString(),
        });
      }

      const membership = membershipResult.rows[0];

      if (membership.role === role) {
        return res.status(400).json({
          error: 'User already has this role',
          current_role: membership.role,
          timestamp: new Date().toISOString(),
        });
      }

      // Update member role
      await db.query(
        'UPDATE team_memberships SET role = $1 WHERE team_id = $2 AND user_id = $3',
        [role, teamId, userId]
      );

      logger.info('Team member role updated', {
        team_id: teamId,
        user_id: userId,
        old_role: membership.role,
        new_role: role,
        updated_by: req.user!.id,
        organization_id: req.user!.organization_id,
      });

      res.json({
        message: 'Team member role updated successfully',
        member: {
          id: userId,
          email: membership.email,
          name: membership.name,
          old_role: membership.role,
          new_role: role,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Update team member error', { error, user_id: req.user?.id });
      res.status(500).json({
        error: 'Failed to update team member',
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * DELETE /api/teams/:teamId/members/:userId
   * Remove member from team
   */
  router.delete('/:teamId/members/:userId', authMiddleware, requireTeamPermission('update'), async (req: AuthRequest, res) => {
    try {
      const { teamId, userId } = req.params;

      // Check if membership exists
      const membershipResult = await db.query(
        'SELECT tm.role, u.email, u.name FROM team_memberships tm JOIN users u ON tm.user_id = u.id WHERE tm.team_id = $1 AND tm.user_id = $2',
        [teamId, userId]
      );

      if (membershipResult.rows.length === 0) {
        return res.status(404).json({
          error: 'Team membership not found',
          timestamp: new Date().toISOString(),
        });
      }

      const membership = membershipResult.rows[0];

      // Check if this is the last team lead
      if (membership.role === 'lead') {
        const leadCount = await db.query(
          'SELECT COUNT(*) as count FROM team_memberships WHERE team_id = $1 AND role = $2',
          [teamId, 'lead']
        );

        if (parseInt(leadCount.rows[0].count) <= 1) {
          return res.status(400).json({
            error: 'Cannot remove the only team lead',
            message: 'Please assign another team lead before removing this member',
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Remove team membership
      await db.query(
        'DELETE FROM team_memberships WHERE team_id = $1 AND user_id = $2',
        [teamId, userId]
      );

      logger.info('Team member removed successfully', {
        team_id: teamId,
        user_id: userId,
        removed_role: membership.role,
        removed_by: req.user!.id,
        organization_id: req.user!.organization_id,
      });

      res.json({
        message: 'Team member removed successfully',
        member: {
          id: userId,
          email: membership.email,
          name: membership.name,
          role: membership.role,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Remove team member error', { error, user_id: req.user?.id });
      res.status(500).json({
        error: 'Failed to remove team member',
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * POST /api/teams/:teamId/members/bulk
   * Bulk member operations
   */
  router.post('/:teamId/members/bulk', authMiddleware, requireTeamPermission('update'), async (req: AuthRequest, res) => {
    try {
      const { teamId } = req.params;
      const { error, value } = bulkMemberActionSchema.validate(req.body);
      
      if (error) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.details.map(d => d.message),
          timestamp: new Date().toISOString(),
        });
      }

      const { user_ids, action, role } = value;

      // Verify team exists
      const teamExists = await db.query(
        'SELECT id, name FROM teams WHERE id = $1 AND organization_id = $2 AND is_active = true',
        [teamId, req.user!.organization_id]
      );

      if (teamExists.rows.length === 0) {
        return res.status(404).json({
          error: 'Team not found',
          timestamp: new Date().toISOString(),
        });
      }

      const results = {
        successful: [] as any[],
        failed: [] as any[],
      };

      // Process each user
      for (const userId of user_ids) {
        try {
          // Verify user exists
          const userResult = await db.query(
            'SELECT id, email, name FROM users WHERE id = $1 AND organization_id = $2 AND is_active = true',
            [userId, req.user!.organization_id]
          );

          if (userResult.rows.length === 0) {
            results.failed.push({
              user_id: userId,
              error: 'User not found',
            });
            continue;
          }

          const user = userResult.rows[0];

          switch (action) {
            case 'add':
              // Check if already a member
              const existing = await db.query(
                'SELECT role FROM team_memberships WHERE team_id = $1 AND user_id = $2',
                [teamId, userId]
              );

              if (existing.rows.length === 0) {
                await db.query(
                  'INSERT INTO team_memberships (organization_id, team_id, user_id, role) VALUES ($1, $2, $3, $4)',
                  [req.user!.organization_id, teamId, userId, role]
                );
                results.successful.push({
                  user_id: userId,
                  user_name: user.name,
                  action: 'added',
                  role: role,
                });
              } else {
                results.failed.push({
                  user_id: userId,
                  error: 'User already a member',
                });
              }
              break;

            case 'remove':
              await db.query(
                'DELETE FROM team_memberships WHERE team_id = $1 AND user_id = $2',
                [teamId, userId]
              );
              results.successful.push({
                user_id: userId,
                user_name: user.name,
                action: 'removed',
              });
              break;

            case 'promote':
              await db.query(
                'UPDATE team_memberships SET role = $1 WHERE team_id = $2 AND user_id = $3',
                ['lead', teamId, userId]
              );
              results.successful.push({
                user_id: userId,
                user_name: user.name,
                action: 'promoted',
                new_role: 'lead',
              });
              break;

            case 'demote':
              await db.query(
                'UPDATE team_memberships SET role = $1 WHERE team_id = $2 AND user_id = $3',
                ['member', teamId, userId]
              );
              results.successful.push({
                user_id: userId,
                user_name: user.name,
                action: 'demoted',
                new_role: 'member',
              });
              break;
          }
        } catch (error) {
          results.failed.push({
            user_id: userId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      logger.info('Bulk team member action completed', {
        team_id: teamId,
        action,
        successful_count: results.successful.length,
        failed_count: results.failed.length,
        performed_by: req.user!.id,
        organization_id: req.user!.organization_id,
      });

      res.json({
        message: `Bulk ${action} operation completed`,
        results,
        summary: {
          total_requested: user_ids.length,
          successful: results.successful.length,
          failed: results.failed.length,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Bulk team member action error', { error, user_id: req.user?.id });
      res.status(500).json({
        error: 'Failed to perform bulk action',
        timestamp: new Date().toISOString(),
      });
    }
  });

  return { router };
}

// Helper function to calculate role hierarchy
function getRoleHierarchy(role: string): number {
  const hierarchy = {
    'owner': 4,
    'admin': 3,
    'manager': 2,
    'developer': 1,
    'viewer': 0,
  };
  return hierarchy[role as keyof typeof hierarchy] || 0;
}