/**
 * Authentication Routes
 * Handles JWT authentication, SSO integration, and session management
 */

import express from 'express';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import * as winston from 'winston';
import Joi from 'joi';
import { DatabaseConnection } from '../database/connection';
import { JWTService, UserRole } from '../services/jwt.service';
import { SSOService } from '../services/sso.service';
import { OAuthConfigService } from '../auth/oauth/config.service';
import { OAuthProviderFactory } from '../auth/oauth/oauth.factory';
import { UserMappingService } from '../auth/oauth/user-mapping.service';
import { createOAuthMiddleware } from '../auth/middleware/oauth.middleware';

export interface AuthRequest extends express.Request {
  user?: {
    id: string;
    organization_id: string;
    email: string;
    role: UserRole;
  };
}

// Validation schemas
const loginSchema = Joi.object({
  email: Joi.string().email().required().max(255),
  password: Joi.string().min(8).max(128).required(),
  organization_slug: Joi.string().alphanum().min(2).max(100).required(),
});

const registerSchema = Joi.object({
  email: Joi.string().email().required().max(255),
  password: Joi.string().min(8).max(128).required()
    .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]'))
    .message('Password must contain at least one lowercase letter, one uppercase letter, one digit, and one special character'),
  name: Joi.string().min(2).max(255).required(),
  organization_name: Joi.string().min(2).max(255).required(),
  organization_slug: Joi.string().alphanum().min(2).max(100).required(),
});

const refreshTokenSchema = Joi.object({
  refresh_token: Joi.string().required(),
});

const changePasswordSchema = Joi.object({
  current_password: Joi.string().required(),
  new_password: Joi.string().min(8).max(128).required()
    .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]'))
    .message('Password must contain at least one lowercase letter, one uppercase letter, one digit, and one special character'),
});

const ssoInitiateSchema = Joi.object({
  provider: Joi.string().valid('google', 'azure', 'okta').required(),
  organization_slug: Joi.string().alphanum().min(2).max(100).required(),
  redirect_uri: Joi.string().uri().optional(),
});

const ssoCallbackSchema = Joi.object({
  code: Joi.string().required(),
  state: Joi.string().required(),
  provider: Joi.string().valid('google', 'azure', 'okta').required(),
});

export function createAuthRoutes(db: DatabaseConnection, logger: winston.Logger) {
  const router = express.Router();
  const jwtService = new JWTService(db, logger);
  const ssoService = new SSOService(db, jwtService, logger);
  const oauthConfigService = new OAuthConfigService(db, logger);
  const userMappingService = new UserMappingService(db, logger);
  const oauthMiddleware = createOAuthMiddleware(db, logger, jwtService);

  // Rate limiting for auth endpoints
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: {
      error: 'Too many authentication attempts, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      // Rate limit by IP + email combination for more granular control
      const email = (req.body as any)?.email || 'unknown';
      return `${req.ip}:${email}`;
    },
  });

  const refreshLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10, // Allow more frequent refresh attempts
    message: { error: 'Too many refresh attempts' },
  });

  // JWT Authentication middleware
  const authenticateJWT = async (req: AuthRequest, res: express.Response, next: express.NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

      if (!token) {
        return res.status(401).json({
          error: 'Access token required',
          timestamp: new Date().toISOString(),
        });
      }

      const payload = await jwtService.verifyAccessToken(token);
      
      // Set organization context for database operations
      await db.setOrganizationContext(payload.organization_id);
      
      req.user = {
        id: payload.user_id,
        organization_id: payload.organization_id,
        email: payload.email,
        role: payload.role,
      };

      next();
    } catch (error) {
      logger.warn('JWT authentication failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ip: req.ip,
        user_agent: req.get('User-Agent') || '',
      });

      return res.status(401).json({
        error: 'Invalid or expired access token',
        timestamp: new Date().toISOString(),
      });
    }
  };

  /**
   * POST /api/auth/login
   * Traditional email/password login
   */
  router.post('/login', authLimiter, async (req, res): Promise<void> => {
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

      // Get organization by slug
      const orgResult = await db.query(
        'SELECT id, name FROM organizations WHERE slug = $1',
        [organization_slug]
      );

      if (orgResult.rows.length === 0) {
        return res.status(401).json({
          error: 'Invalid credentials',
          timestamp: new Date().toISOString(),
        });
      }

      const organization = orgResult.rows[0];
      await db.setOrganizationContext(organization.id);

      // Get user with password hash
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
        // Log failed attempt
        await logAuthEvent(db, {
          organization_id: organization.id,
          event_type: 'login_failed',
          event_details: { email, reason: 'user_not_found' },
          ip_address: req.ip || '',
          user_agent: req.get('User-Agent') || '',
          success: false,
        });

        return res.status(401).json({
          error: 'Invalid credentials',
          timestamp: new Date().toISOString(),
        });
      }

      const user = userResult.rows[0];

      // Check if user has SSO-only authentication
      if (user.external_provider && !user.password_hash) {
        return res.status(400).json({
          error: 'SSO authentication required',
          sso_provider: user.external_provider,
          timestamp: new Date().toISOString(),
        });
      }

      // Verify password
      if (!user.password_hash || !(await bcrypt.compare(password, user.password_hash))) {
        // Log failed attempt
        await logAuthEvent(db, {
          organization_id: organization.id,
          user_id: user.id,
          event_type: 'login_failed',
          event_details: { email, reason: 'invalid_password' },
          ip_address: req.ip || '',
          user_agent: req.get('User-Agent') || '',
          success: false,
        });

        return res.status(401).json({
          error: 'Invalid credentials',
          timestamp: new Date().toISOString(),
        });
      }

      // Generate JWT tokens
      const tokens = await jwtService.generateTokenPair({
        user_id: user.id,
        organization_id: user.organization_id,
        email: user.email,
        role: user.role,
        team_memberships: user.team_memberships,
      });

      // Update last login time
      await db.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

      // Log successful login
      await logAuthEvent(db, {
        organization_id: organization.id,
        user_id: user.id,
        event_type: 'login_success',
        event_details: { email, login_method: 'password' },
        ip_address: req.ip || '',
        user_agent: req.get('User-Agent') || '',
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
    } catch (error) {
      logger.error('Login error', { error, ip: req.ip });
      res.status(500).json({
        error: 'Authentication failed',
        timestamp: new Date().toISOString(),
      });
    } finally {
      await db.clearOrganizationContext();
    }
  });

  /**
   * POST /api/auth/refresh
   * Refresh access token using refresh token
   */
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
    } catch (error) {
      logger.warn('Token refresh failed', { error: error instanceof Error ? error.message : 'Unknown error', ip: req.ip });
      res.status(401).json({
        error: 'Invalid or expired refresh token',
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * POST /api/auth/logout
   * Logout and revoke tokens
   */
  router.post('/logout', authenticateJWT, async (req: AuthRequest, res) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.split(' ')[1];
      
      if (token) {
        // Decode token to get JTI for revocation
        const payload = await jwtService.verifyAccessToken(token);
        if (payload.jti) {
          await jwtService.revokeAccessToken(payload.jti);
        }
      }

      // Log logout event
      await logAuthEvent(db, {
        organization_id: req.user!.organization_id,
        user_id: req.user!.id,
        event_type: 'logout',
        event_details: { logout_method: 'manual' },
        ip_address: req.ip || '',
        user_agent: req.get('User-Agent') || '',
        success: true,
      });

      logger.info('User logout successful', {
        user_id: req.user!.id,
        organization_id: req.user!.organization_id,
        ip: req.ip,
      });

      res.json({
        message: 'Logged out successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Logout error', { error, user_id: req.user?.id });
      res.status(500).json({
        error: 'Logout failed',
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /api/auth/profile
   * Get current user profile
   */
  router.get('/profile', authenticateJWT, async (req: AuthRequest, res) => {
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
      `, [req.user!.id]);

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
    } catch (error) {
      logger.error('Get profile error', { error, user_id: req.user?.id });
      res.status(500).json({
        error: 'Failed to get profile',
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * PUT /api/auth/profile
   * Update user profile
   */
  router.put('/profile', authenticateJWT, async (req: AuthRequest, res) => {
    try {
      const updateSchema = Joi.object({
        name: Joi.string().min(2).max(255).optional(),
        settings: Joi.object().optional(),
      });

      const { error, value } = updateSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.details.map(d => d.message),
          timestamp: new Date().toISOString(),
        });
      }

      const updates: string[] = [];
      const params: any[] = [];
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
      params.push(req.user!.id);

      const query = `
        UPDATE users 
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING id, name, settings, updated_at
      `;

      const result = await db.query(query, params);
      const updatedUser = result.rows[0];

      logger.info('User profile updated', {
        user_id: req.user!.id,
        updates: Object.keys(value),
        ip: req.ip,
      });

      res.json({
        user: updatedUser,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Update profile error', { error, user_id: req.user?.id });
      res.status(500).json({
        error: 'Failed to update profile',
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * POST /api/auth/change-password
   * Change user password
   */
  router.post('/change-password', authenticateJWT, async (req: AuthRequest, res) => {
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

      // Get current password hash
      const userResult = await db.query(
        'SELECT password_hash, external_provider FROM users WHERE id = $1',
        [req.user!.id]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          error: 'User not found',
          timestamp: new Date().toISOString(),
        });
      }

      const user = userResult.rows[0];

      // Check if user has SSO authentication
      if (user.external_provider && !user.password_hash) {
        return res.status(400).json({
          error: 'Cannot change password for SSO user',
          sso_provider: user.external_provider,
          timestamp: new Date().toISOString(),
        });
      }

      // Verify current password
      if (!user.password_hash || !(await bcrypt.compare(current_password, user.password_hash))) {
        return res.status(401).json({
          error: 'Current password is incorrect',
          timestamp: new Date().toISOString(),
        });
      }

      // Hash new password
      const saltRounds = 12;
      const newPasswordHash = await bcrypt.hash(new_password, saltRounds);

      // Update password
      await db.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
        [newPasswordHash, req.user!.id]
      );

      // Revoke all existing tokens for security
      await jwtService.revokeAllUserTokens(req.user!.id);

      // Log password change event
      await logAuthEvent(db, {
        organization_id: req.user!.organization_id,
        user_id: req.user!.id,
        event_type: 'password_change',
        event_details: {},
        ip_address: req.ip || '',
        user_agent: req.get('User-Agent') || '',
        success: true,
      });

      logger.info('Password changed successfully', {
        user_id: req.user!.id,
        organization_id: req.user!.organization_id,
        ip: req.ip,
      });

      res.json({
        message: 'Password changed successfully. Please log in again.',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Change password error', { error, user_id: req.user?.id });
      res.status(500).json({
        error: 'Failed to change password',
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * SSO Authentication Routes
   */

  /**
   * POST /api/auth/sso/initiate
   * Initiate SSO authentication flow
   */
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

      // Get organization ID
      const orgResult = await db.query(
        'SELECT id FROM organizations WHERE slug = $1',
        [organization_slug]
      );

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
    } catch (error) {
      logger.error('SSO initiation error', { error, ip: req.ip });
      res.status(500).json({
        error: error instanceof Error ? error.message : 'SSO initiation failed',
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * POST /api/auth/sso/callback
   * Handle SSO callback
   */
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
    } catch (error) {
      logger.error('SSO callback error', { error, ip: req.ip });
      res.status(401).json({
        error: error instanceof Error ? error.message : 'SSO authentication failed',
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /api/auth/sso/providers/:organizationSlug
   * List available SSO providers for organization
   */
  router.get('/sso/providers/:organizationSlug', async (req, res) => {
    try {
      const { organizationSlug } = req.params;

      // Get organization ID
      const orgResult = await db.query(
        'SELECT id FROM organizations WHERE slug = $1',
        [organizationSlug]
      );

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
    } catch (error) {
      logger.error('List SSO providers error', { error });
      res.status(500).json({
        error: 'Failed to list SSO providers',
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * OAuth 2.0 Routes
   * Enhanced OAuth implementation with proper provider support
   */

  // OAuth validation schemas
  const oauthConfigSchema = Joi.object({
    provider_name: Joi.string().valid('google', 'azure', 'oidc').required(),
    provider_type: Joi.string().valid('oauth2', 'oidc').required(),
    client_id: Joi.string().required(),
    client_secret: Joi.string().required(),
    discovery_url: Joi.string().uri().optional(),
    authorization_endpoint: Joi.string().uri().optional(),
    token_endpoint: Joi.string().uri().optional(),
    userinfo_endpoint: Joi.string().uri().optional(),
    jwks_uri: Joi.string().uri().optional(),
    issuer: Joi.string().uri().optional(),
    redirect_uri: Joi.string().uri().required(),
    scopes: Joi.array().items(Joi.string()).min(1).required(),
    additional_config: Joi.object().optional(),
  });

  const oauthInitiateSchema = Joi.object({
    provider: Joi.string().required(),
    organization_slug: Joi.string().alphanum().min(2).max(100).required(),
    redirect_uri: Joi.string().uri().optional(),
  });

  const oauthCallbackSchema = Joi.object({
    code: Joi.string().required(),
    state: Joi.string().required(),
    provider: Joi.string().required(),
  });

  /**
   * POST /api/auth/oauth/initiate
   * Initiate OAuth 2.0 authentication flow
   */
  router.post('/oauth/initiate', authLimiter, async (req, res): Promise<void> => {
    try {
      const { error, value } = oauthInitiateSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.details.map(d => d.message),
          timestamp: new Date().toISOString(),
        });
      }

      const { provider, organization_slug, redirect_uri } = value;

      // Get organization ID
      const orgResult = await db.query(
        'SELECT id FROM organizations WHERE slug = $1',
        [organization_slug]
      );

      if (orgResult.rows.length === 0) {
        return res.status(404).json({
          error: 'Organization not found',
          timestamp: new Date().toISOString(),
        });
      }

      const organizationId = orgResult.rows[0].id;

      // Get OAuth configuration
      const config = await oauthConfigService.getActiveConfig(organizationId, provider);
      if (!config) {
        return res.status(404).json({
          error: `OAuth provider '${provider}' not configured or not active`,
          timestamp: new Date().toISOString(),
        });
      }

      // Create OAuth provider instance
      const oauthProvider = await OAuthProviderFactory.createProvider(
        provider,
        db,
        logger
      );

      await oauthProvider.initialize(config as any);

      // Generate authorization URL
      const state = require('crypto').randomBytes(32).toString('hex');
      const authResult = await oauthProvider.getAuthorizationUrl(config as any, state);

      // Store OAuth session
      await oauthProvider.storeOAuthSession({
        state,
        organization_id: organizationId,
        provider,
        code_verifier: authResult.codeVerifier,
        code_challenge: require('crypto')
          .createHash('sha256')
          .update(authResult.codeVerifier)
          .digest('base64url'),
        redirect_uri: redirect_uri || config.redirect_uri,
        nonce: authResult.nonce,
        scopes: config.scopes.join(' '),
        expires_at: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
      });

      logger.info('OAuth flow initiated', {
        organization_id: organizationId,
        provider,
        state,
        ip: req.ip,
      });

      res.json({
        authorization_url: authResult.url,
        state,
        provider,
        expires_in: 900, // 15 minutes in seconds
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('OAuth initiation error', { error, ip: req.ip });
      res.status(500).json({
        error: error instanceof Error ? error.message : 'OAuth initiation failed',
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * POST /api/auth/oauth/callback
   * Handle OAuth 2.0 callback
   */
  router.post('/oauth/callback', authLimiter, async (req, res): Promise<void> => {
    try {
      const { error, value } = oauthCallbackSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.details.map(d => d.message),
          timestamp: new Date().toISOString(),
        });
      }

      const { code, state, provider } = value;

      // Retrieve OAuth session
      const oauthProvider = await OAuthProviderFactory.createProvider(
        provider,
        db,
        logger
      );

      const session = await oauthProvider.getOAuthSession(state);
      if (!session || session.provider !== provider) {
        return res.status(400).json({
          error: 'Invalid or expired OAuth session',
          timestamp: new Date().toISOString(),
        });
      }

      try {
        // Get OAuth configuration
        const config = await oauthConfigService.getActiveConfig(session.organization_id, provider);
        if (!config) {
          throw new Error(`OAuth provider '${provider}' not found or not active`);
        }

        await oauthProvider.initialize(config as any);

        // Exchange code for tokens
        const tokens = await oauthProvider.exchangeCodeForTokens(
          config as any,
          code,
          session.code_verifier,
          state
        );

        // Get user profile
        const profile = await oauthProvider.getUserProfile(tokens.access_token, tokens.id_token);

        // Find or create user
        const userResult = await userMappingService.findOrCreateUser(
          session.organization_id,
          provider,
          profile
        );

        // Store OAuth tokens
        await oauthProvider.storeOAuthTokens(
          userResult.user.id,
          session.organization_id,
          tokens
        );

        // Store OAuth identity
        await oauthProvider.storeUserOAuthIdentity(
          userResult.user.id,
          session.organization_id,
          profile
        );

        // Generate application JWT tokens
        const jwtTokens = await jwtService.generateTokenPair({
          user_id: userResult.user.id,
          organization_id: userResult.user.organization_id,
          email: userResult.user.email,
          role: userResult.user.role,
          team_memberships: userResult.user.team_memberships || [],
        });

        // Log successful authentication
        await logAuthEvent(db, {
          organization_id: session.organization_id,
          user_id: userResult.user.id,
          event_type: 'oauth_login_success',
          event_details: { provider, is_new_user: userResult.is_new_user },
          ip_address: req.ip || '',
          user_agent: req.get('User-Agent') || '',
          success: true,
        });

        logger.info('OAuth authentication successful', {
          user_id: userResult.user.id,
          organization_id: session.organization_id,
          provider,
          is_new_user: userResult.is_new_user,
          ip: req.ip,
        });

        res.json({
          ...jwtTokens,
          user: {
            id: userResult.user.id,
            organization_id: userResult.user.organization_id,
            email: userResult.user.email,
            name: userResult.user.name,
            role: userResult.user.role,
            oauth_provider: provider,
            is_new_user: userResult.is_new_user,
          },
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        // Log failed authentication
        await logAuthEvent(db, {
          organization_id: session.organization_id,
          event_type: 'oauth_login_failed',
          event_details: { provider, error: error instanceof Error ? error.message : 'Unknown error' },
          ip_address: req.ip || '',
          user_agent: req.get('User-Agent') || '',
          success: false,
          error_message: error instanceof Error ? error.message : 'Unknown error',
        });

        throw error;
      } finally {
        // Clean up OAuth session
        await oauthProvider.deleteOAuthSession(state);
      }
    } catch (error) {
      logger.error('OAuth callback error', { error, ip: req.ip });
      res.status(401).json({
        error: error instanceof Error ? error.message : 'OAuth authentication failed',
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * POST /api/auth/oauth/config
   * Configure OAuth provider (admin only)
   */
  router.post('/oauth/config', authenticateJWT, async (req: AuthRequest, res) => {
    try {
      // Check if user has admin privileges
      if (req.user!.role !== 'admin' && req.user!.role !== 'owner') {
        return res.status(403).json({
          error: 'Admin privileges required',
          timestamp: new Date().toISOString(),
        });
      }

      const { error, value } = oauthConfigSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.details.map(d => d.message),
          timestamp: new Date().toISOString(),
        });
      }

      const config = await oauthConfigService.createOrUpdateConfig({
        organization_id: req.user!.organization_id,
        ...value,
      });

      // Test the configuration
      const testResult = await oauthConfigService.testConfig(
        req.user!.organization_id,
        value.provider_name
      );

      logger.info('OAuth configuration created/updated', {
        organization_id: req.user!.organization_id,
        provider_name: value.provider_name,
        user_id: req.user!.id,
        test_success: testResult.success,
      });

      res.json({
        config: {
          id: config.id,
          provider_name: config.provider_name,
          provider_type: config.provider_type,
          client_id: config.client_id,
          redirect_uri: config.redirect_uri,
          scopes: config.scopes,
          is_active: config.is_active,
          created_at: config.created_at,
          updated_at: config.updated_at,
        },
        test_result: testResult,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('OAuth configuration error', { error, user_id: req.user?.id });
      res.status(500).json({
        error: 'Failed to configure OAuth provider',
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /api/auth/oauth/providers/:organizationSlug
   * List OAuth provider configurations
   */
  router.get('/oauth/providers/:organizationSlug', async (req, res) => {
    try {
      const { organizationSlug } = req.params;

      // Get organization ID
      const orgResult = await db.query(
        'SELECT id FROM organizations WHERE slug = $1',
        [organizationSlug]
      );

      if (orgResult.rows.length === 0) {
        return res.status(404).json({
          error: 'Organization not found',
          timestamp: new Date().toISOString(),
        });
      }

      const organizationId = orgResult.rows[0].id;
      const configs = await oauthConfigService.listConfigs(organizationId, true);

      res.json({
        providers: configs.map(config => ({
          provider_name: config.provider_name,
          provider_type: config.provider_type,
          is_active: config.is_active,
          scopes: config.scopes,
          metadata: OAuthProviderFactory.getProviderMetadata(config.provider_name),
        })),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('List OAuth providers error', { error });
      res.status(500).json({
        error: 'Failed to list OAuth providers',
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * DELETE /api/auth/oauth/config/:provider
   * Delete OAuth provider configuration (admin only)
   */
  router.delete('/oauth/config/:provider', authenticateJWT, async (req: AuthRequest, res) => {
    try {
      // Check if user has admin privileges
      if (req.user!.role !== 'admin' && req.user!.role !== 'owner') {
        return res.status(403).json({
          error: 'Admin privileges required',
          timestamp: new Date().toISOString(),
        });
      }

      const { provider } = req.params;
      const deleted = await oauthConfigService.deleteConfig(
        req.user!.organization_id,
        provider
      );

      if (!deleted) {
        return res.status(404).json({
          error: 'OAuth provider configuration not found',
          timestamp: new Date().toISOString(),
        });
      }

      logger.info('OAuth configuration deleted', {
        organization_id: req.user!.organization_id,
        provider,
        user_id: req.user!.id,
      });

      res.json({
        message: 'OAuth provider configuration deleted successfully',
        provider,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('OAuth configuration deletion error', { error, user_id: req.user?.id });
      res.status(500).json({
        error: 'Failed to delete OAuth provider configuration',
        timestamp: new Date().toISOString(),
      });
    }
  });

  return {
    router,
    jwtService,
    ssoService,
    oauthConfigService,
    userMappingService,
    oauthMiddleware,
    authenticateJWT, // Export for use in other routes
  };
}

// Helper function for logging authentication events
async function logAuthEvent(
  db: DatabaseConnection,
  event: {
    organization_id?: string;
    user_id?: string;
    event_type: string;
    event_details: Record<string, any>;
    ip_address?: string;
    user_agent?: string;
    success: boolean;
    error_message?: string;
  }
): Promise<void> {
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
  } catch (error) {
    // Don't throw - logging should not break the main flow
    console.error('Failed to log auth event:', error);
  }
}