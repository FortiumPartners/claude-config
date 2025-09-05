/**
 * JWT Service - Token generation, validation, and management
 * Supports multi-tenant claims and role-based access control
 */

import * as jwt from 'jsonwebtoken';
import crypto from 'crypto';
import * as winston from 'winston';
import { DatabaseConnection } from '../database/connection';

export interface JWTPayload {
  user_id: string;
  organization_id: string;
  email: string;
  role: UserRole;
  team_memberships?: Array<{
    team_id: string;
    team_role: TeamRole;
  }>;
  permissions?: Permission[];
  iat?: number;
  exp?: number;
  jti?: string; // JWT ID for token tracking
}

export interface RefreshTokenPayload {
  user_id: string;
  organization_id: string;
  token_family: string; // For token rotation
  jti: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: 'Bearer';
}

export type UserRole = 'owner' | 'admin' | 'manager' | 'developer' | 'viewer';
export type TeamRole = 'lead' | 'member';

export interface Permission {
  resource: string;
  action: string;
  condition?: string;
}

// Role-based permission definitions
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  owner: [
    { resource: '*', action: '*' }, // Full access
  ],
  admin: [
    { resource: 'users', action: '*' },
    { resource: 'teams', action: '*' },
    { resource: 'metrics', action: '*' },
    { resource: 'organizations', action: 'read' },
    { resource: 'organizations', action: 'update' },
  ],
  manager: [
    { resource: 'teams', action: 'read' },
    { resource: 'teams', action: 'update', condition: 'team_lead' },
    { resource: 'metrics', action: 'read' },
    { resource: 'users', action: 'read', condition: 'same_team' },
    { resource: 'users', action: 'invite', condition: 'team_lead' },
  ],
  developer: [
    { resource: 'metrics', action: 'read', condition: 'own_or_team' },
    { resource: 'metrics', action: 'create', condition: 'own' },
    { resource: 'users', action: 'read', condition: 'own' },
    { resource: 'users', action: 'update', condition: 'own' },
  ],
  viewer: [
    { resource: 'metrics', action: 'read', condition: 'assigned_only' },
    { resource: 'users', action: 'read', condition: 'own' },
  ],
};

export class JWTService {
  private accessTokenSecret: string;
  private refreshTokenSecret: string;
  private accessTokenExpiry: string;
  private refreshTokenExpiry: string;
  private issuer: string;
  private db: DatabaseConnection;
  private logger: winston.Logger;

  constructor(db: DatabaseConnection, logger: winston.Logger) {
    // JWT secrets - in production these should be strong, randomly generated secrets
    this.accessTokenSecret = process.env.JWT_ACCESS_SECRET || this.generateSecret();
    this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET || this.generateSecret();
    this.accessTokenExpiry = process.env.JWT_ACCESS_EXPIRY || '15m';
    this.refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRY || '7d';
    this.issuer = process.env.JWT_ISSUER || 'fortium-metrics-service';
    
    this.db = db;
    this.logger = logger;

    // Warn if using default secrets
    if (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET) {
      this.logger.warn('Using default JWT secrets - this is not secure for production');
    }
  }

  private generateSecret(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  /**
   * Generate JWT token pair (access + refresh)
   */
  async generateTokenPair(payload: Omit<JWTPayload, 'iat' | 'exp' | 'jti'>): Promise<TokenPair> {
    const tokenFamily = crypto.randomUUID();
    const jti = crypto.randomUUID();
    
    // Calculate permissions based on role
    const permissions = this.calculatePermissions(payload.role, payload.team_memberships);

    const accessPayload: JWTPayload = {
      ...payload,
      permissions,
      jti,
    };

    const refreshPayload: RefreshTokenPayload = {
      user_id: payload.user_id,
      organization_id: payload.organization_id,
      token_family: tokenFamily,
      jti,
    };

    // Generate tokens
    const access_token = jwt.sign(accessPayload, this.accessTokenSecret, {
      expiresIn: this.accessTokenExpiry,
      issuer: this.issuer,
      audience: 'fortium-metrics-api',
    } as jwt.SignOptions);

    const refresh_token = jwt.sign(refreshPayload, this.refreshTokenSecret, {
      expiresIn: this.refreshTokenExpiry,
      issuer: this.issuer,
      audience: 'fortium-metrics-refresh',
    } as jwt.SignOptions);

    // Store refresh token in database for tracking and revocation
    await this.storeRefreshToken({
      jti,
      user_id: payload.user_id,
      organization_id: payload.organization_id,
      token_family: tokenFamily,
      expires_at: new Date(Date.now() + this.parseExpiry(this.refreshTokenExpiry)),
    });

    // Get expiry time in seconds
    const decoded = jwt.decode(access_token) as any;
    const expires_in = decoded.exp - Math.floor(Date.now() / 1000);

    this.logger.info('Token pair generated', {
      user_id: payload.user_id,
      organization_id: payload.organization_id,
      role: payload.role,
      expires_in,
      jti
    });

    return {
      access_token,
      refresh_token,
      expires_in,
      token_type: 'Bearer',
    };
  }

  /**
   * Verify and decode access token
   */
  async verifyAccessToken(token: string): Promise<JWTPayload> {
    try {
      const payload = jwt.verify(token, this.accessTokenSecret, {
        issuer: this.issuer,
        audience: 'fortium-metrics-api',
      }) as JWTPayload;

      // Check if token is blacklisted
      const isBlacklisted = await this.isTokenBlacklisted(payload.jti!);
      if (isBlacklisted) {
        throw new Error('Token has been revoked');
      }

      return payload;
    } catch (error) {
      this.logger.warn('Access token verification failed', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw new Error('Invalid or expired access token');
    }
  }

  /**
   * Verify and decode refresh token
   */
  async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    try {
      const payload = jwt.verify(token, this.refreshTokenSecret, {
        issuer: this.issuer,
        audience: 'fortium-metrics-refresh',
      }) as RefreshTokenPayload;

      // Verify refresh token exists in database
      const tokenRecord = await this.getRefreshToken(payload.jti);
      if (!tokenRecord) {
        throw new Error('Refresh token not found or expired');
      }

      return payload;
    } catch (error) {
      this.logger.warn('Refresh token verification failed', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw new Error('Invalid or expired refresh token');
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<TokenPair> {
    const refreshPayload = await this.verifyRefreshToken(refreshToken);
    
    // Get user information for new access token
    const userQuery = `
      SELECT u.id, u.organization_id, u.email, u.role,
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
      WHERE u.id = $1 AND u.organization_id = $2
      GROUP BY u.id, u.organization_id, u.email, u.role
    `;

    const result = await this.db.query(userQuery, [refreshPayload.user_id, refreshPayload.organization_id]);
    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    const user = result.rows[0];

    // Revoke old refresh token
    await this.revokeRefreshToken(refreshPayload.jti);

    // Generate new token pair
    return this.generateTokenPair({
      user_id: user.id,
      organization_id: user.organization_id,
      email: user.email,
      role: user.role,
      team_memberships: user.team_memberships,
    });
  }

  /**
   * Revoke access token (add to blacklist)
   */
  async revokeAccessToken(jti: string): Promise<void> {
    const expiryQuery = `
      INSERT INTO token_blacklist (jti, blacklisted_at, expires_at)
      VALUES ($1, NOW(), NOW() + INTERVAL '1 day')
      ON CONFLICT (jti) DO NOTHING
    `;
    
    await this.db.query(expiryQuery, [jti]);
    this.logger.info('Access token revoked', { jti });
  }

  /**
   * Revoke refresh token
   */
  async revokeRefreshToken(jti: string): Promise<void> {
    await this.db.query('DELETE FROM refresh_tokens WHERE jti = $1', [jti]);
    this.logger.info('Refresh token revoked', { jti });
  }

  /**
   * Revoke all tokens for a user
   */
  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.db.query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
    
    // Add current access tokens to blacklist (would need to track active tokens)
    // For now, we'll rely on short access token expiry
    
    this.logger.info('All user tokens revoked', { user_id: userId });
  }

  /**
   * Check if user has permission
   */
  hasPermission(userPayload: JWTPayload, resource: string, action: string, context?: any): boolean {
    const permissions = userPayload.permissions || [];
    
    // Check for wildcard permission (owner role)
    if (permissions.some(p => p.resource === '*' && p.action === '*')) {
      return true;
    }

    // Check for specific permissions
    for (const permission of permissions) {
      if (permission.resource === resource && (permission.action === action || permission.action === '*')) {
        // Check condition if present
        if (permission.condition) {
          return this.evaluatePermissionCondition(permission.condition, userPayload, context);
        }
        return true;
      }
    }

    return false;
  }

  /**
   * Calculate permissions based on role and team memberships
   */
  private calculatePermissions(role: UserRole, teamMemberships?: Array<{ team_id: string; team_role: TeamRole }>): Permission[] {
    const basePermissions = ROLE_PERMISSIONS[role] || [];
    
    // Add team-specific permissions for team leads
    const teamLeadPermissions: Permission[] = [];
    if (teamMemberships) {
      const teamLeadships = teamMemberships.filter(tm => tm.team_role === 'lead');
      if (teamLeadships.length > 0) {
        teamLeadPermissions.push(
          { resource: 'teams', action: 'update', condition: 'team_lead' },
          { resource: 'users', action: 'invite', condition: 'team_lead' },
        );
      }
    }

    return [...basePermissions, ...teamLeadPermissions];
  }

  /**
   * Evaluate permission condition
   */
  private evaluatePermissionCondition(condition: string, userPayload: JWTPayload, context?: any): boolean {
    switch (condition) {
      case 'own':
        return context?.user_id === userPayload.user_id;
      case 'own_or_team':
        return context?.user_id === userPayload.user_id || 
               (userPayload.team_memberships || []).some(tm => tm.team_id === context?.team_id);
      case 'same_team':
        return (userPayload.team_memberships || []).some(tm => 
          context?.team_ids?.includes(tm.team_id));
      case 'team_lead':
        return (userPayload.team_memberships || []).some(tm => 
          tm.team_role === 'lead' && context?.team_ids?.includes(tm.team_id));
      case 'assigned_only':
        return context?.assigned_user_ids?.includes(userPayload.user_id);
      default:
        this.logger.warn('Unknown permission condition', { condition });
        return false;
    }
  }

  /**
   * Store refresh token in database
   */
  private async storeRefreshToken(tokenData: {
    jti: string;
    user_id: string;
    organization_id: string;
    token_family: string;
    expires_at: Date;
  }): Promise<void> {
    const query = `
      INSERT INTO refresh_tokens (jti, user_id, organization_id, token_family, expires_at, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
    `;
    
    await this.db.query(query, [
      tokenData.jti,
      tokenData.user_id,
      tokenData.organization_id,
      tokenData.token_family,
      tokenData.expires_at,
    ]);
  }

  /**
   * Get refresh token from database
   */
  private async getRefreshToken(jti: string): Promise<any> {
    const result = await this.db.query(
      'SELECT * FROM refresh_tokens WHERE jti = $1 AND expires_at > NOW()',
      [jti]
    );
    return result.rows[0] || null;
  }

  /**
   * Check if access token is blacklisted
   */
  private async isTokenBlacklisted(jti: string): Promise<boolean> {
    const result = await this.db.query(
      'SELECT 1 FROM token_blacklist WHERE jti = $1 AND expires_at > NOW()',
      [jti]
    );
    return result.rows.length > 0;
  }

  /**
   * Parse JWT expiry string to milliseconds
   */
  private parseExpiry(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error(`Invalid expiry format: ${expiry}`);
    }

    const value = parseInt(match[1] || '15');
    const unit = match[2] || 'm';

    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: throw new Error(`Invalid expiry unit: ${unit}`);
    }
  }

  /**
   * Clean up expired tokens (should be run periodically)
   */
  async cleanupExpiredTokens(): Promise<void> {
    const refreshResult = await this.db.query('DELETE FROM refresh_tokens WHERE expires_at <= NOW()');
    const blacklistResult = await this.db.query('DELETE FROM token_blacklist WHERE expires_at <= NOW()');
    
    this.logger.info('Token cleanup completed', {
      expired_refresh_tokens: refreshResult.rowCount,
      expired_blacklist_entries: blacklistResult.rowCount,
    });
  }
}