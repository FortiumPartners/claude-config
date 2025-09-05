"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAuthRoutes = createAuthRoutes;
const express_1 = __importDefault(require("express"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const joi_1 = __importDefault(require("joi"));
const jwt_service_1 = require("../services/jwt.service");
const sso_service_1 = require("../services/sso.service");
const loginSchema = joi_1.default.object({
    email: joi_1.default.string().email().required().max(255),
    password: joi_1.default.string().min(8).max(128).required(),
    organization_slug: joi_1.default.string().alphanum().min(2).max(100).required(),
});
const registerSchema = joi_1.default.object({
    email: joi_1.default.string().email().required().max(255),
    password: joi_1.default.string().min(8).max(128).required()
        .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]'))
        .message('Password must contain at least one lowercase letter, one uppercase letter, one digit, and one special character'),
    name: joi_1.default.string().min(2).max(255).required(),
    organization_name: joi_1.default.string().min(2).max(255).required(),
    organization_slug: joi_1.default.string().alphanum().min(2).max(100).required(),
});
const refreshTokenSchema = joi_1.default.object({
    refresh_token: joi_1.default.string().required(),
});
const changePasswordSchema = joi_1.default.object({
    current_password: joi_1.default.string().required(),
    new_password: joi_1.default.string().min(8).max(128).required()
        .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]'))
        .message('Password must contain at least one lowercase letter, one uppercase letter, one digit, and one special character'),
});
const ssoInitiateSchema = joi_1.default.object({
    provider: joi_1.default.string().valid('google', 'azure', 'okta').required(),
    organization_slug: joi_1.default.string().alphanum().min(2).max(100).required(),
    redirect_uri: joi_1.default.string().uri().optional(),
});
const ssoCallbackSchema = joi_1.default.object({
    code: joi_1.default.string().required(),
    state: joi_1.default.string().required(),
    provider: joi_1.default.string().valid('google', 'azure', 'okta').required(),
});
function createAuthRoutes(db, logger) {
    const router = express_1.default.Router();
    const jwtService = new jwt_service_1.JWTService(db, logger);
    const ssoService = new sso_service_1.SSOService(db, jwtService, logger);
    const authLimiter = (0, express_rate_limit_1.default)({
        windowMs: 15 * 60 * 1000,
        max: 5,
        message: {
            error: 'Too many authentication attempts, please try again later.',
        },
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => {
            const email = req.body?.email || 'unknown';
            return `${req.ip}:${email}`;
        },
    });
    const refreshLimiter = (0, express_rate_limit_1.default)({
        windowMs: 15 * 60 * 1000,
        max: 10,
        message: { error: 'Too many refresh attempts' },
    });
    const authenticateJWT = async (req, res, next) => {
        try {
            const authHeader = req.headers.authorization;
            const token = authHeader && authHeader.split(' ')[1];
            if (!token) {
                return res.status(401).json({
                    error: 'Access token required',
                    timestamp: new Date().toISOString(),
                });
            }
            const payload = await jwtService.verifyAccessToken(token);
            await db.setOrganizationContext(payload.organization_id);
            req.user = {
                id: payload.user_id,
                organization_id: payload.organization_id,
                email: payload.email,
                role: payload.role,
            };
            next();
        }
        catch (error) {
            logger.warn('JWT authentication failed', {
                error: error instanceof Error ? error.message : 'Unknown error',
                ip: req.ip,
                user_agent: req.get('User-Agent'),
            });
            return res.status(401).json({
                error: 'Invalid or expired access token',
                timestamp: new Date().toISOString(),
            });
        }
    };
    router.post('/login', authLimiter, async (req, res) => {
        try {
            const { error, value } = loginSchema.validate(req.body);
            if (error) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: error.details.map(d => d.message),
                    timestamp: new Date().toISOString(),
                });
            }
            const { email, password, organization_slug } = value;
            const orgResult = await db.query('SELECT id, name FROM organizations WHERE slug = $1', [organization_slug]);
            if (orgResult.rows.length === 0) {
                return res.status(401).json({
                    error: 'Invalid credentials',
                    timestamp: new Date().toISOString(),
                });
            }
            const organization = orgResult.rows[0];
            await db.setOrganizationContext(organization.id);
            const userResult = await db.query(`
        SELECT u.*, 
               COALESCE(
                 json_agg(
                   json_build_object(
                     'team_id', tm.team_id,
                     'team_role', tm.role
                   )
                 ) FILTER (WHERE tm.team_id IS NOT NULL),
                 '[]'::json
               ) as team_memberships
        FROM users u
        LEFT JOIN team_memberships tm ON u.id = tm.user_id
        WHERE u.organization_id = $1 AND u.email = $2 AND u.is_active = true
        GROUP BY u.id, u.organization_id, u.email, u.name, u.password_hash, u.role, u.external_id, u.external_provider
      `, [organization.id, email]);
            if (userResult.rows.length === 0) {
                await logAuthEvent(db, {
                    organization_id: organization.id,
                    event_type: 'login_failed',
                    event_details: { email, reason: 'user_not_found' },
                    ip_address: req.ip || '',
                    user_agent: req.get('User-Agent'),
                    success: false,
                });
                return res.status(401).json({
                    error: 'Invalid credentials',
                    timestamp: new Date().toISOString(),
                });
            }
            const user = userResult.rows[0];
            if (user.external_provider && !user.password_hash) {
                return res.status(400).json({
                    error: 'SSO authentication required',
                    sso_provider: user.external_provider,
                    timestamp: new Date().toISOString(),
                });
            }
            if (!user.password_hash || !(await bcrypt_1.default.compare(password, user.password_hash))) {
                await logAuthEvent(db, {
                    organization_id: organization.id,
                    user_id: user.id,
                    event_type: 'login_failed',
                    event_details: { email, reason: 'invalid_password' },
                    ip_address: req.ip || '',
                    user_agent: req.get('User-Agent'),
                    success: false,
                });
                return res.status(401).json({
                    error: 'Invalid credentials',
                    timestamp: new Date().toISOString(),
                });
            }
            const tokens = await jwtService.generateTokenPair({
                user_id: user.id,
                organization_id: user.organization_id,
                email: user.email,
                role: user.role,
                team_memberships: user.team_memberships,
            });
            await db.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);
            await logAuthEvent(db, {
                organization_id: organization.id,
                user_id: user.id,
                event_type: 'login_success',
                event_details: { email, login_method: 'password' },
                ip_address: req.ip || '',
                user_agent: req.get('User-Agent'),
                success: true,
            });
            logger.info('User login successful', {
                user_id: user.id,
                organization_id: organization.id,
                email: user.email,
                ip: req.ip,
            });
            res.json({
                ...tokens,
                user: {
                    id: user.id,
                    organization_id: user.organization_id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    team_memberships: user.team_memberships,
                },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger.error('Login error', { error, ip: req.ip });
            res.status(500).json({
                error: 'Authentication failed',
                timestamp: new Date().toISOString(),
            });
        }
        finally {
            await db.clearOrganizationContext();
        }
    });
    router.post('/refresh', refreshLimiter, async (req, res) => {
        try {
            const { error, value } = refreshTokenSchema.validate(req.body);
            if (error) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: error.details.map(d => d.message),
                    timestamp: new Date().toISOString(),
                });
            }
            const { refresh_token } = value;
            const tokens = await jwtService.refreshAccessToken(refresh_token);
            res.json({
                ...tokens,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger.warn('Token refresh failed', { error: error instanceof Error ? error.message : 'Unknown error', ip: req.ip });
            res.status(401).json({
                error: 'Invalid or expired refresh token',
                timestamp: new Date().toISOString(),
            });
        }
    });
    router.post('/logout', authenticateJWT, async (req, res) => {
        try {
            const authHeader = req.headers.authorization;
            const token = authHeader && authHeader.split(' ')[1];
            if (token) {
                const payload = await jwtService.verifyAccessToken(token);
                if (payload.jti) {
                    await jwtService.revokeAccessToken(payload.jti);
                }
            }
            await logAuthEvent(db, {
                organization_id: req.user.organization_id,
                user_id: req.user.id,
                event_type: 'logout',
                event_details: { logout_method: 'manual' },
                ip_address: req.ip || '',
                user_agent: req.get('User-Agent'),
                success: true,
            });
            logger.info('User logout successful', {
                user_id: req.user.id,
                organization_id: req.user.organization_id,
                ip: req.ip,
            });
            res.json({
                message: 'Logged out successfully',
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger.error('Logout error', { error, user_id: req.user?.id });
            res.status(500).json({
                error: 'Logout failed',
                timestamp: new Date().toISOString(),
            });
        }
    });
    router.get('/profile', authenticateJWT, async (req, res) => {
        try {
            const userResult = await db.query(`
        SELECT u.id, u.organization_id, u.email, u.name, u.role, u.settings,
               u.last_login_at, u.created_at,
               o.name as organization_name, o.slug as organization_slug,
               COALESCE(
                 json_agg(
                   json_build_object(
                     'team_id', t.id,
                     'team_name', t.name,
                     'team_role', tm.role
                   )
                 ) FILTER (WHERE t.id IS NOT NULL),
                 '[]'::json
               ) as teams
        FROM users u
        JOIN organizations o ON u.organization_id = o.id
        LEFT JOIN team_memberships tm ON u.id = tm.user_id
        LEFT JOIN teams t ON tm.team_id = t.id
        WHERE u.id = $1
        GROUP BY u.id, u.organization_id, u.email, u.name, u.role, u.settings, 
                 u.last_login_at, u.created_at, o.name, o.slug
      `, [req.user.id]);
            if (userResult.rows.length === 0) {
                return res.status(404).json({
                    error: 'User not found',
                    timestamp: new Date().toISOString(),
                });
            }
            const user = userResult.rows[0];
            res.json({
                user: {
                    id: user.id,
                    organization_id: user.organization_id,
                    organization_name: user.organization_name,
                    organization_slug: user.organization_slug,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    settings: user.settings,
                    teams: user.teams,
                    last_login_at: user.last_login_at,
                    created_at: user.created_at,
                },
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger.error('Get profile error', { error, user_id: req.user?.id });
            res.status(500).json({
                error: 'Failed to get profile',
                timestamp: new Date().toISOString(),
            });
        }
    });
    router.put('/profile', authenticateJWT, async (req, res) => {
        try {
            const updateSchema = joi_1.default.object({
                name: joi_1.default.string().min(2).max(255).optional(),
                settings: joi_1.default.object().optional(),
            });
            const { error, value } = updateSchema.validate(req.body);
            if (error) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: error.details.map(d => d.message),
                    timestamp: new Date().toISOString(),
                });
            }
            const updates = [];
            const params = [];
            let paramIndex = 1;
            if (value.name) {
                updates.push(`name = $${paramIndex++}`);
                params.push(value.name);
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
            params.push(req.user.id);
            const query = `
        UPDATE users 
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING id, name, settings, updated_at
      `;
            const result = await db.query(query, params);
            const updatedUser = result.rows[0];
            logger.info('User profile updated', {
                user_id: req.user.id,
                updates: Object.keys(value),
                ip: req.ip,
            });
            res.json({
                user: updatedUser,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger.error('Update profile error', { error, user_id: req.user?.id });
            res.status(500).json({
                error: 'Failed to update profile',
                timestamp: new Date().toISOString(),
            });
        }
    });
    router.post('/change-password', authenticateJWT, async (req, res) => {
        try {
            const { error, value } = changePasswordSchema.validate(req.body);
            if (error) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: error.details.map(d => d.message),
                    timestamp: new Date().toISOString(),
                });
            }
            const { current_password, new_password } = value;
            const userResult = await db.query('SELECT password_hash, external_provider FROM users WHERE id = $1', [req.user.id]);
            if (userResult.rows.length === 0) {
                return res.status(404).json({
                    error: 'User not found',
                    timestamp: new Date().toISOString(),
                });
            }
            const user = userResult.rows[0];
            if (user.external_provider && !user.password_hash) {
                return res.status(400).json({
                    error: 'Cannot change password for SSO user',
                    sso_provider: user.external_provider,
                    timestamp: new Date().toISOString(),
                });
            }
            if (!user.password_hash || !(await bcrypt_1.default.compare(current_password, user.password_hash))) {
                return res.status(401).json({
                    error: 'Current password is incorrect',
                    timestamp: new Date().toISOString(),
                });
            }
            const saltRounds = 12;
            const newPasswordHash = await bcrypt_1.default.hash(new_password, saltRounds);
            await db.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [newPasswordHash, req.user.id]);
            await jwtService.revokeAllUserTokens(req.user.id);
            await logAuthEvent(db, {
                organization_id: req.user.organization_id,
                user_id: req.user.id,
                event_type: 'password_change',
                event_details: {},
                ip_address: req.ip || '',
                user_agent: req.get('User-Agent'),
                success: true,
            });
            logger.info('Password changed successfully', {
                user_id: req.user.id,
                organization_id: req.user.organization_id,
                ip: req.ip,
            });
            res.json({
                message: 'Password changed successfully. Please log in again.',
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger.error('Change password error', { error, user_id: req.user?.id });
            res.status(500).json({
                error: 'Failed to change password',
                timestamp: new Date().toISOString(),
            });
        }
    });
    router.post('/sso/initiate', authLimiter, async (req, res) => {
        try {
            const { error, value } = ssoInitiateSchema.validate(req.body);
            if (error) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: error.details.map(d => d.message),
                    timestamp: new Date().toISOString(),
                });
            }
            const { provider, organization_slug, redirect_uri } = value;
            const orgResult = await db.query('SELECT id FROM organizations WHERE slug = $1', [organization_slug]);
            if (orgResult.rows.length === 0) {
                return res.status(404).json({
                    error: 'Organization not found',
                    timestamp: new Date().toISOString(),
                });
            }
            const organizationId = orgResult.rows[0].id;
            const authResponse = await ssoService.initiateSSOAuth({
                provider_name: provider,
                organization_id: organizationId,
                redirect_uri,
            });
            logger.info('SSO authentication initiated', {
                organization_id: organizationId,
                provider,
                ip: req.ip,
            });
            res.json({
                ...authResponse,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger.error('SSO initiation error', { error, ip: req.ip });
            res.status(500).json({
                error: error instanceof Error ? error.message : 'SSO initiation failed',
                timestamp: new Date().toISOString(),
            });
        }
    });
    router.post('/sso/callback', authLimiter, async (req, res) => {
        try {
            const { error, value } = ssoCallbackSchema.validate(req.body);
            if (error) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: error.details.map(d => d.message),
                    timestamp: new Date().toISOString(),
                });
            }
            const { code, state, provider } = value;
            const authResult = await ssoService.handleSSOCallback({
                code,
                state,
                provider_name: provider,
            });
            logger.info('SSO authentication successful', {
                user_id: authResult.user.id,
                organization_id: authResult.user.organization_id,
                provider,
                is_new_user: authResult.user.is_new_user,
                ip: req.ip,
            });
            res.json({
                ...authResult.tokens,
                user: authResult.user,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger.error('SSO callback error', { error, ip: req.ip });
            res.status(401).json({
                error: error instanceof Error ? error.message : 'SSO authentication failed',
                timestamp: new Date().toISOString(),
            });
        }
    });
    router.get('/sso/providers/:organizationSlug', async (req, res) => {
        try {
            const { organizationSlug } = req.params;
            const orgResult = await db.query('SELECT id FROM organizations WHERE slug = $1', [organizationSlug]);
            if (orgResult.rows.length === 0) {
                return res.status(404).json({
                    error: 'Organization not found',
                    timestamp: new Date().toISOString(),
                });
            }
            const organizationId = orgResult.rows[0].id;
            const providers = await ssoService.listSSOProviders(organizationId);
            res.json({
                providers: providers.map(p => ({
                    provider_name: p.provider_name,
                    provider_type: p.provider_type,
                    is_active: p.is_active,
                })),
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            logger.error('List SSO providers error', { error });
            res.status(500).json({
                error: 'Failed to list SSO providers',
                timestamp: new Date().toISOString(),
            });
        }
    });
    return {
        router,
        jwtService,
        ssoService,
        authenticateJWT,
    };
}
async function logAuthEvent(db, event) {
    try {
        const query = `
      INSERT INTO auth_audit_log (
        organization_id, user_id, event_type, event_details, 
        ip_address, user_agent, success, error_message, timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    `;
        await db.query(query, [
            event.organization_id || null,
            event.user_id || null,
            event.event_type,
            JSON.stringify(event.event_details),
            event.ip_address || null,
            event.user_agent || null,
            event.success,
            event.error_message || null,
        ]);
    }
    catch (error) {
        console.error('Failed to log auth event:', error);
    }
}
//# sourceMappingURL=auth.routes.js.map