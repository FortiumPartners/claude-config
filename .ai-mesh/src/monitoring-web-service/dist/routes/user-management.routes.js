"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUserManagementRoutes = createUserManagementRoutes;
const express_1 = __importDefault(require("express"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const joi_1 = __importDefault(require("joi"));
const createUserSchema = joi_1.default.object({
    email: joi_1.default.string().email().required().max(255),
    name: joi_1.default.string().min(2).max(255).required(),
    role: joi_1.default.string().valid('owner', 'admin', 'manager', 'developer', 'viewer').required(),
    password: joi_1.default.string().min(8).max(128).optional()
        .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]'))
        .message('Password must contain at least one lowercase letter, one uppercase letter, one digit, and one special character'),
    send_invitation: joi_1.default.boolean().default(true),
    team_assignments: joi_1.default.array().items(joi_1.default.object({
        team_id: joi_1.default.string().uuid().required(),
        role: joi_1.default.string().valid('lead', 'member').default('member'),
    })).optional(),
});
const updateUserSchema = joi_1.default.object({
    name: joi_1.default.string().min(2).max(255).optional(),
    role: joi_1.default.string().valid('owner', 'admin', 'manager', 'developer', 'viewer').optional(),
    is_active: joi_1.default.boolean().optional(),
    settings: joi_1.default.object().optional(),
});
const inviteUserSchema = joi_1.default.object({
    email: joi_1.default.string().email().required().max(255),
    name: joi_1.default.string().min(2).max(255).required(),
    role: joi_1.default.string().valid('admin', 'manager', 'developer', 'viewer').required(),
    team_assignments: joi_1.default.array().items(joi_1.default.object({
        team_id: joi_1.default.string().uuid().required(),
        role: joi_1.default.string().valid('lead', 'member').default('member'),
    })).optional(),
    expires_in_hours: joi_1.default.number().integer().min(1).max(168).default(72),
});
const bulkUserActionSchema = joi_1.default.object({
    user_ids: joi_1.default.array().items(joi_1.default.string().uuid()).min(1).max(100).required(),
    action: joi_1.default.string().valid('activate', 'deactivate', 'delete').required(),
    confirmation: joi_1.default.boolean().when('action', {
        is: 'delete',
        then: joi_1.default.boolean().valid(true).required(),
        otherwise: joi_1.default.boolean().optional(),
    }),
});
function createUserManagementRoutes(db, logger, authenticateJWT) {
    const router = express_1.default.Router();
    const authMiddleware = authenticateJWT || (async (req, res, next) => {
        logger.warn('No authentication middleware provided - using placeholder');
        next();
    });
    const requirePermission = (resource, action) => {
        return async (req, res, next) => {
            try {
                const userRole = req.user?.role;
                if (!userRole) {
                    return res.status(401).json({
                        error: 'Authentication required',
                        timestamp: new Date().toISOString(),
                    });
                }
                if (['owner', 'admin'].includes(userRole)) {
                    return next();
                }
                if (userRole === 'manager' && ['read', 'invite'].includes(action)) {
                    return next();
                }
                if (resource === 'users' && action === 'read' && req.params.userId === req.user?.id) {
                    return next();
                }
                return res.status(403).json({
                    error: 'Insufficient permissions',
                    required_permission: `${resource}:${action}`,
                    user_role: userRole,
                    timestamp: new Date().toISOString(),
                });
            }
            catch (error) {
                logger.error('Permission check error', { error, user_id: req.user?.id });
                res.status(500).json({
                    error: 'Permission check failed',
                    timestamp: new Date().toISOString(),
                });
            }
        };
    };
    const userManagementLimiter = (0, express_rate_limit_1.default)({
        windowMs: 15 * 60 * 1000,
        max: 100,
        message: { error: 'Too many user management requests' },
    });
    const invitationLimiter = (0, express_rate_limit_1.default)({
        windowMs: 60 * 60 * 1000,
        max: 20,
        message: { error: 'Too many invitation requests' },
    });
    router.get('/', authMiddleware, requirePermission('users', 'read'), async (req, res) => {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = Math.min(parseInt(req.query.limit) || 50, 100);
            const offset = (page - 1) * limit;
            const search = req.query.search;
            const role = req.query.role;
            const is_active = req.query.is_active;
            const team_id = req.query.team_id;
            const conditions = ['u.organization_id = $1'];
            const params = [req.user.organization_id];
            let paramIndex = 2;
            if (search) {
                conditions.push(`(u.name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`);
                params.push(`%${search}%`);
                paramIndex++;
            }
            if (role) {
                conditions.push(`u.role = $${paramIndex}`);
                params.push(role);
                paramIndex++;
            }
            if (is_active !== undefined) {
                conditions.push(`u.is_active = $${paramIndex}`);
                params.push(is_active === 'true');
                paramIndex++;
            }
            if (team_id) {
                conditions.push(`tm.team_id = $${paramIndex}`);
                params.push(team_id);
                paramIndex++;
            }
            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
            const query = `
        SELECT DISTINCT u.id, u.email, u.name, u.role, u.is_active, u.email_verified,
               u.external_id, u.external_provider, u.last_login_at, u.created_at,
               COUNT(*) OVER() as total_count,
               COALESCE(
                 json_agg(
                   DISTINCT jsonb_build_object(
                     'team_id', t.id,
                     'team_name', t.name,
                     'team_role', tm.role
                   )
                 ) FILTER (WHERE t.id IS NOT NULL),
                 '[]'::json
               ) as teams
        FROM users u
        LEFT JOIN team_memberships tm ON u.id = tm.user_id
        LEFT JOIN teams t ON tm.team_id = t.id AND t.is_active = true
        ${whereClause}
        GROUP BY u.id, u.email, u.name, u.role, u.is_active, u.email_verified,
                 u.external_id, u.external_provider, u.last_login_at, u.created_at
        ORDER BY u.name ASC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
            params.push(limit, offset);
            const result = await db.query(query, params);
            const users = result.rows;
            const totalCount = users.length > 0 ? parseInt(users[0].total_count) : 0;
            const totalPages = Math.ceil(totalCount / limit);
            res.json({
                users: users.map(u => ({
                    id: u.id,
                    email: u.email,
                    name: u.name,
                    role: u.role,
                    is_active: u.is_active,
                    email_verified: u.email_verified,
                    external_provider: u.external_provider,
                    teams: u.teams,
                    last_login_at: u.last_login_at,
                    created_at: u.created_at,
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
        }
        catch (error) {
            logger.error('List users error', { error, user_id: req.user?.id });
            res.status(500).json({
                error: 'Failed to list users',
                timestamp: new Date().toISOString(),
            });
        }
    });
    router.get('/:userId', authMiddleware, requirePermission('users', 'read'), async (req, res) => {
        try {
            const { userId } = req.params;
            const query = `
        SELECT u.id, u.email, u.name, u.role, u.is_active, u.email_verified,
               u.external_id, u.external_provider, u.settings, u.last_login_at, 
               u.created_at, u.updated_at,
               COALESCE(
                 json_agg(
                   DISTINCT jsonb_build_object(
                     'team_id', t.id,
                     'team_name', t.name,
                     'team_description', t.description,
                     'team_role', tm.role,
                     'joined_at', tm.joined_at
                   )
                 ) FILTER (WHERE t.id IS NOT NULL),
                 '[]'::json
               ) as teams,
               -- Recent activity summary
               (
                 SELECT COUNT(*) 
                 FROM auth_audit_log aal 
                 WHERE aal.user_id = u.id 
                 AND aal.timestamp >= NOW() - INTERVAL '30 days'
               ) as recent_activity_count
        FROM users u
        LEFT JOIN team_memberships tm ON u.id = tm.user_id
        LEFT JOIN teams t ON tm.team_id = t.id AND t.is_active = true
        WHERE u.id = $1 AND u.organization_id = $2
        GROUP BY u.id, u.email, u.name, u.role, u.is_active, u.email_verified,
                 u.external_id, u.external_provider, u.settings, u.last_login_at, 
                 u.created_at, u.updated_at
      `;
            const result = await db.query(query, [userId, req.user.organization_id]);
            if (result.rows.length === 0) {
                return res.status(404).json({
                    error: 'User not found',
                    timestamp: new Date().toISOString(),
                });
            }
            const user = result.rows[0];
            res.json({
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    is_active: user.is_active,
                    email_verified: user.email_verified,
                    external_provider: user.external_provider,
                    settings: user.settings,
                    teams: user.teams,
                    last_login_at: user.last_login_at,
                    recent_activity_count: parseInt(user.recent_activity_count),
                    created_at: user.created_at,
                    updated_at: user.updated_at,
                },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger.error('Get user error', { error, user_id: req.user?.id });
            res.status(500).json({
                error: 'Failed to get user',
                timestamp: new Date().toISOString(),
            });
        }
    });
    router.post('/', authMiddleware, requirePermission('users', 'create'), async (req, res) => {
        try {
            const { error, value } = createUserSchema.validate(req.body);
            if (error) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: error.details.map(d => d.message),
                    timestamp: new Date().toISOString(),
                });
            }
            const { email, name, role, password, send_invitation, team_assignments } = value;
            const existingUser = await db.query('SELECT id FROM users WHERE organization_id = $1 AND email = $2', [req.user.organization_id, email]);
            if (existingUser.rows.length > 0) {
                return res.status(409).json({
                    error: 'User with this email already exists',
                    timestamp: new Date().toISOString(),
                });
            }
            const client = await db.getClient();
            await client.query('BEGIN');
            try {
                let passwordHash = null;
                if (password) {
                    const saltRounds = 12;
                    passwordHash = await bcrypt_1.default.hash(password, saltRounds);
                }
                const userQuery = `
          INSERT INTO users (
            organization_id, email, name, role, password_hash, 
            is_active, email_verified
          ) VALUES ($1, $2, $3, $4, $5, true, $6)
          RETURNING id, email, name, role, is_active, created_at
        `;
                const userResult = await client.query(userQuery, [
                    req.user.organization_id,
                    email,
                    name,
                    role,
                    passwordHash,
                    !!password,
                ]);
                const newUser = userResult.rows[0];
                if (team_assignments && team_assignments.length > 0) {
                    for (const assignment of team_assignments) {
                        await client.query('INSERT INTO team_memberships (organization_id, team_id, user_id, role) VALUES ($1, $2, $3, $4)', [req.user.organization_id, assignment.team_id, newUser.id, assignment.role]);
                    }
                }
                if (send_invitation && !password) {
                    logger.info('User invitation email should be sent', {
                        user_id: newUser.id,
                        email: newUser.email,
                    });
                }
                await client.query('COMMIT');
                logger.info('User created successfully', {
                    user_id: newUser.id,
                    created_by: req.user.id,
                    organization_id: req.user.organization_id,
                    role: newUser.role,
                });
                res.status(201).json({
                    user: {
                        id: newUser.id,
                        email: newUser.email,
                        name: newUser.name,
                        role: newUser.role,
                        is_active: newUser.is_active,
                        created_at: newUser.created_at,
                    },
                    invitation_sent: send_invitation && !password,
                    timestamp: new Date().toISOString(),
                });
            }
            catch (error) {
                await client.query('ROLLBACK');
                throw error;
            }
            finally {
                client.release();
            }
        }
        catch (error) {
            logger.error('Create user error', { error, user_id: req.user?.id });
            res.status(500).json({
                error: 'Failed to create user',
                timestamp: new Date().toISOString(),
            });
        }
    });
    router.put('/:userId', authMiddleware, requirePermission('users', 'update'), async (req, res) => {
        try {
            const { userId } = req.params;
            const { error, value } = updateUserSchema.validate(req.body);
            if (error) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: error.details.map(d => d.message),
                    timestamp: new Date().toISOString(),
                });
            }
            const existingUser = await db.query('SELECT id, role FROM users WHERE id = $1 AND organization_id = $2', [userId, req.user.organization_id]);
            if (existingUser.rows.length === 0) {
                return res.status(404).json({
                    error: 'User not found',
                    timestamp: new Date().toISOString(),
                });
            }
            const user = existingUser.rows[0];
            if (value.role && user.role === 'owner' && value.role !== 'owner') {
                const ownerCount = await db.query('SELECT COUNT(*) as count FROM users WHERE organization_id = $1 AND role = $2 AND is_active = true', [req.user.organization_id, 'owner']);
                if (parseInt(ownerCount.rows[0].count) <= 1) {
                    return res.status(400).json({
                        error: 'Cannot change role of the only active owner',
                        timestamp: new Date().toISOString(),
                    });
                }
            }
            const updates = [];
            const params = [];
            let paramIndex = 1;
            if (value.name) {
                updates.push(`name = $${paramIndex++}`);
                params.push(value.name);
            }
            if (value.role) {
                updates.push(`role = $${paramIndex++}`);
                params.push(value.role);
            }
            if (value.is_active !== undefined) {
                updates.push(`is_active = $${paramIndex++}`);
                params.push(value.is_active);
            }
            if (value.settings) {
                updates.push(`settings = $${paramIndex++}`);
                params.push(JSON.stringify(value.settings));
            }
            if (updates.length === 0) {
                return res.status(400).json({
                    error: 'No valid updates provided',
                    timestamp: new Date().toISOString(),
                });
            }
            updates.push(`updated_at = NOW()`);
            params.push(userId, req.user.organization_id);
            const query = `
        UPDATE users 
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex++} AND organization_id = $${paramIndex++}
        RETURNING id, email, name, role, is_active, settings, updated_at
      `;
            const result = await db.query(query, params);
            const updatedUser = result.rows[0];
            logger.info('User updated successfully', {
                user_id: updatedUser.id,
                updated_by: req.user.id,
                updates: Object.keys(value),
                organization_id: req.user.organization_id,
            });
            res.json({
                user: updatedUser,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger.error('Update user error', { error, user_id: req.user?.id });
            res.status(500).json({
                error: 'Failed to update user',
                timestamp: new Date().toISOString(),
            });
        }
    });
    router.delete('/:userId', authMiddleware, requirePermission('users', 'delete'), async (req, res) => {
        try {
            const { userId } = req.params;
            const userResult = await db.query('SELECT id, role, email FROM users WHERE id = $1 AND organization_id = $2', [userId, req.user.organization_id]);
            if (userResult.rows.length === 0) {
                return res.status(404).json({
                    error: 'User not found',
                    timestamp: new Date().toISOString(),
                });
            }
            const user = userResult.rows[0];
            if (user.role === 'owner') {
                const ownerCount = await db.query('SELECT COUNT(*) as count FROM users WHERE organization_id = $1 AND role = $2 AND is_active = true', [req.user.organization_id, 'owner']);
                if (parseInt(ownerCount.rows[0].count) <= 1) {
                    return res.status(400).json({
                        error: 'Cannot delete the only active owner',
                        timestamp: new Date().toISOString(),
                    });
                }
            }
            if (userId === req.user.id) {
                return res.status(400).json({
                    error: 'Cannot delete your own account',
                    timestamp: new Date().toISOString(),
                });
            }
            await db.query('UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1', [userId]);
            await db.query('DELETE FROM team_memberships WHERE user_id = $1', [userId]);
            logger.info('User deleted successfully', {
                user_id: userId,
                deleted_by: req.user.id,
                organization_id: req.user.organization_id,
                user_email: user.email,
            });
            res.json({
                message: 'User deleted successfully',
                user: {
                    id: user.id,
                    email: user.email,
                },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger.error('Delete user error', { error, user_id: req.user?.id });
            res.status(500).json({
                error: 'Failed to delete user',
                timestamp: new Date().toISOString(),
            });
        }
    });
    router.post('/invite', invitationLimiter, authMiddleware, requirePermission('users', 'invite'), async (req, res) => {
        try {
            const { error, value } = inviteUserSchema.validate(req.body);
            if (error) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: error.details.map(d => d.message),
                    timestamp: new Date().toISOString(),
                });
            }
            const { email, name, role, team_assignments, expires_in_hours } = value;
            const existingUser = await db.query('SELECT id FROM users WHERE organization_id = $1 AND email = $2', [req.user.organization_id, email]);
            if (existingUser.rows.length > 0) {
                return res.status(409).json({
                    error: 'User with this email already exists',
                    timestamp: new Date().toISOString(),
                });
            }
            const invitationToken = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + expires_in_hours * 60 * 60 * 1000);
            const invitationQuery = `
        INSERT INTO user_invitations (
          organization_id, email, name, role, team_assignments,
          invitation_token, expires_at, invited_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, invitation_token, expires_at
      `;
            const invitationResult = await db.query(invitationQuery, [
                req.user.organization_id,
                email,
                name,
                role,
                JSON.stringify(team_assignments || []),
                invitationToken,
                expiresAt,
                req.user.id,
            ]);
            const invitation = invitationResult.rows[0];
            logger.info('User invitation created', {
                invitation_id: invitation.id,
                email,
                invited_by: req.user.id,
                organization_id: req.user.organization_id,
                expires_at: expiresAt,
            });
            res.status(201).json({
                invitation: {
                    id: invitation.id,
                    email,
                    name,
                    role,
                    expires_at: expiresAt,
                    invitation_url: `${process.env.FRONTEND_URL}/accept-invitation?token=${invitation.invitation_token}`,
                },
                message: 'Invitation sent successfully',
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger.error('Invite user error', { error, user_id: req.user?.id });
            res.status(500).json({
                error: 'Failed to send invitation',
                timestamp: new Date().toISOString(),
            });
        }
    });
    router.post('/bulk-action', authMiddleware, requirePermission('users', 'update'), async (req, res) => {
        try {
            const { error, value } = bulkUserActionSchema.validate(req.body);
            if (error) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: error.details.map(d => d.message),
                    timestamp: new Date().toISOString(),
                });
            }
            const { user_ids, action, confirmation } = value;
            const usersResult = await db.query('SELECT id, email, role FROM users WHERE id = ANY($1) AND organization_id = $2', [user_ids, req.user.organization_id]);
            const foundUsers = usersResult.rows;
            if (foundUsers.length !== user_ids.length) {
                const foundUserIds = foundUsers.map(u => u.id);
                const notFoundIds = user_ids.filter(id => !foundUserIds.includes(id));
                return res.status(404).json({
                    error: 'Some users not found',
                    not_found_user_ids: notFoundIds,
                    timestamp: new Date().toISOString(),
                });
            }
            if (user_ids.includes(req.user.id)) {
                return res.status(400).json({
                    error: 'Cannot perform bulk action on your own account',
                    timestamp: new Date().toISOString(),
                });
            }
            const ownerUsers = foundUsers.filter(u => u.role === 'owner');
            if (ownerUsers.length > 0 && ['deactivate', 'delete'].includes(action)) {
                return res.status(400).json({
                    error: 'Cannot perform this action on owner accounts',
                    owner_user_ids: ownerUsers.map(u => u.id),
                    timestamp: new Date().toISOString(),
                });
            }
            let query;
            let successMessage;
            switch (action) {
                case 'activate':
                    query = 'UPDATE users SET is_active = true, updated_at = NOW() WHERE id = ANY($1)';
                    successMessage = 'Users activated successfully';
                    break;
                case 'deactivate':
                    query = 'UPDATE users SET is_active = false, updated_at = NOW() WHERE id = ANY($1)';
                    successMessage = 'Users deactivated successfully';
                    break;
                case 'delete':
                    if (!confirmation) {
                        return res.status(400).json({
                            error: 'Confirmation required for delete action',
                            timestamp: new Date().toISOString(),
                        });
                    }
                    query = 'UPDATE users SET is_active = false, updated_at = NOW() WHERE id = ANY($1)';
                    await db.query('DELETE FROM team_memberships WHERE user_id = ANY($1)', [user_ids]);
                    successMessage = 'Users deleted successfully';
                    break;
                default:
                    return res.status(400).json({
                        error: 'Invalid action',
                        timestamp: new Date().toISOString(),
                    });
            }
            const result = await db.query(query, [user_ids]);
            logger.info('Bulk user action performed', {
                action,
                user_ids,
                performed_by: req.user.id,
                organization_id: req.user.organization_id,
                affected_count: result.rowCount,
            });
            res.json({
                message: successMessage,
                action,
                affected_users: foundUsers.map(u => ({ id: u.id, email: u.email })),
                affected_count: result.rowCount,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger.error('Bulk user action error', { error, user_id: req.user?.id });
            res.status(500).json({
                error: 'Failed to perform bulk action',
                timestamp: new Date().toISOString(),
            });
        }
    });
    router.get('/audit/:userId', authMiddleware, requirePermission('users', 'audit'), async (req, res) => {
        try {
            const { userId } = req.params;
            const page = parseInt(req.query.page) || 1;
            const limit = Math.min(parseInt(req.query.limit) || 50, 100);
            const offset = (page - 1) * limit;
            const query = `
        SELECT event_type, event_details, ip_address, user_agent,
               success, error_message, timestamp,
               COUNT(*) OVER() as total_count
        FROM auth_audit_log
        WHERE user_id = $1 AND organization_id = $2
        ORDER BY timestamp DESC
        LIMIT $3 OFFSET $4
      `;
            const result = await db.query(query, [userId, req.user.organization_id, limit, offset]);
            const auditLogs = result.rows;
            const totalCount = auditLogs.length > 0 ? parseInt(auditLogs[0].total_count) : 0;
            const totalPages = Math.ceil(totalCount / limit);
            res.json({
                audit_logs: auditLogs.map(log => ({
                    event_type: log.event_type,
                    event_details: log.event_details,
                    ip_address: log.ip_address,
                    user_agent: log.user_agent,
                    success: log.success,
                    error_message: log.error_message,
                    timestamp: log.timestamp,
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
        }
        catch (error) {
            logger.error('Get user audit log error', { error, user_id: req.user?.id });
            res.status(500).json({
                error: 'Failed to get audit log',
                timestamp: new Date().toISOString(),
            });
        }
    });
    return { router };
}
//# sourceMappingURL=user-management.routes.js.map