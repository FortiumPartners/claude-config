/**
 * Instrumented JWT Service - Token generation, validation, and management
 * Task 2.3.1: Authentication & Authorization Tracing (3h)
 * 
 * Comprehensive OpenTelemetry instrumentation for JWT operations including:
 * - Token validation and refresh operations
 * - User authentication flows
 * - Authorization decisions and role-based access control
 * - Multi-tenant context propagation in traces
 */

import * as jwt from 'jsonwebtoken';
import crypto from 'crypto';
import * as winston from 'winston';
import { DatabaseConnection } from '../database/connection';
import { 
  BusinessInstrumentation, 
  BusinessContext, 
  BusinessAttributes,
  OperationType,
  InstrumentMethod,
  getBusinessInstrumentation 
} from '../tracing/business-instrumentation';
import * as api from '@opentelemetry/api';

// Re-export types from original service
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

/**
 * Instrumented JWT Service with comprehensive OpenTelemetry tracing
 */
export class InstrumentedJWTService {
  private accessTokenSecret: string;
  private refreshTokenSecret: string;
  private accessTokenExpiry: string;
  private refreshTokenExpiry: string;
  private issuer: string;
  private db: DatabaseConnection;
  private logger: winston.Logger;
  private instrumentation: BusinessInstrumentation;

  constructor(db: DatabaseConnection, logger: winston.Logger) {
    // JWT secrets - in production these should be strong, randomly generated secrets
    this.accessTokenSecret = process.env.JWT_ACCESS_SECRET || this.generateSecret();
    this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET || this.generateSecret();
    this.accessTokenExpiry = process.env.JWT_ACCESS_EXPIRY || '15m';
    this.refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRY || '7d';
    this.issuer = process.env.JWT_ISSUER || 'fortium-metrics-service';
    
    this.db = db;
    this.logger = logger;
    this.instrumentation = getBusinessInstrumentation();

    // Warn if using default secrets
    if (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET) {
      this.logger.warn('Using default JWT secrets - this is not secure for production');
    }
  }

  private generateSecret(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  /**
   * Generate JWT token pair (access + refresh) with full instrumentation
   */
  async generateTokenPair(payload: Omit<JWTPayload, 'iat' | 'exp' | 'jti'>): Promise<TokenPair> {
    const context: BusinessContext = {
      userId: payload.user_id,
      organizationId: payload.organization_id,
      tenantId: payload.organization_id
    };

    return this.instrumentation.instrumentAuthentication(
      'generate_token_pair',
      async (span: api.Span) => {
        const tokenFamily = crypto.randomUUID();
        const jti = crypto.randomUUID();
        
        // Add detailed authentication context
        span.setAttributes({
          [BusinessAttributes.AUTH_TOKEN_TYPE]: 'jwt_pair',
          [BusinessAttributes.AUTH_ROLE]: payload.role,
          [BusinessAttributes.USER_ID]: payload.user_id,
          [BusinessAttributes.ORGANIZATION_ID]: payload.organization_id,
          'auth.token_family': tokenFamily,
          'auth.jti': jti
        });

        // Calculate permissions based on role
        const permissions = this.calculatePermissions(payload.role, payload.team_memberships);

        // Add permissions to span
        span.setAttributes({
          [BusinessAttributes.AUTH_PERMISSIONS]: permissions.map(p => `${p.resource}:${p.action}`).join(','),
          'auth.permissions_count': permissions.length
        });

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

        // Generate tokens with timing instrumentation
        const tokenGenStart = Date.now();
        
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

        const tokenGenDuration = Date.now() - tokenGenStart;
        span.setAttributes({
          'auth.token_generation_duration_ms': tokenGenDuration
        });

        // Store refresh token in database with instrumentation
        await this.instrumentedStoreRefreshToken({
          jti,
          user_id: payload.user_id,
          organization_id: payload.organization_id,
          token_family: tokenFamily,
          expires_at: new Date(Date.now() + this.parseExpiry(this.refreshTokenExpiry)),
        }, span);

        // Get expiry time in seconds
        const decoded = jwt.decode(access_token) as any;
        const expires_in = decoded.exp - Math.floor(Date.now() / 1000);

        // Log successful token generation
        this.logger.info('Token pair generated', {
          user_id: payload.user_id,
          organization_id: payload.organization_id,
          role: payload.role,
          expires_in,
          jti,
          permissions_count: permissions.length
        });

        // Add final span attributes
        span.setAttributes({
          'auth.access_token_expires_in': expires_in,
          'auth.refresh_token_family': tokenFamily
        });

        return {
          access_token,
          refresh_token,
          expires_in,
          token_type: 'Bearer' as const,
        };
      },
      context
    );
  }

  /**
   * Verify and decode access token with comprehensive instrumentation
   */
  async verifyAccessToken(token: string): Promise<JWTPayload> {
    return this.instrumentation.instrumentAuthentication(
      'verify_access_token',
      async (span: api.Span) => {
        span.setAttributes({
          [BusinessAttributes.AUTH_TOKEN_TYPE]: 'access_token'
        });

        try {
          const verifyStart = Date.now();
          
          const payload = jwt.verify(token, this.accessTokenSecret, {
            issuer: this.issuer,
            audience: 'fortium-metrics-api',
          }) as JWTPayload;

          const verifyDuration = Date.now() - verifyStart;
          
          // Add payload information to span
          span.setAttributes({
            [BusinessAttributes.USER_ID]: payload.user_id,
            [BusinessAttributes.ORGANIZATION_ID]: payload.organization_id,
            [BusinessAttributes.AUTH_ROLE]: payload.role,
            'auth.token_verification_duration_ms': verifyDuration,
            'auth.token_jti': payload.jti || 'unknown',
            'auth.token_issued_at': payload.iat || 0,
            'auth.token_expires_at': payload.exp || 0
          });

          // Check if token is blacklisted
          const blacklistStart = Date.now();
          const isBlacklisted = await this.isTokenBlacklisted(payload.jti!);
          const blacklistDuration = Date.now() - blacklistStart;
          
          span.setAttributes({
            'auth.blacklist_check_duration_ms': blacklistDuration,
            'auth.token_blacklisted': isBlacklisted
          });

          if (isBlacklisted) {
            span.setAttributes({
              [BusinessAttributes.AUTH_RESULT]: 'revoked'
            });
            throw new Error('Token has been revoked');
          }

          // Add permissions information
          if (payload.permissions) {
            span.setAttributes({
              [BusinessAttributes.AUTH_PERMISSIONS]: payload.permissions.map(p => `${p.resource}:${p.action}`).join(','),
              'auth.permissions_count': payload.permissions.length
            });
          }

          span.setAttributes({
            [BusinessAttributes.AUTH_RESULT]: 'valid'
          });

          return payload;
        } catch (error) {
          span.setAttributes({
            [BusinessAttributes.AUTH_RESULT]: 'invalid',
            'auth.error_type': this.categorizeAuthError(error)
          });
          
          this.logger.warn('Access token verification failed', { 
            error: error instanceof Error ? error.message : 'Unknown error',
            error_type: this.categorizeAuthError(error)
          });
          
          throw new Error('Invalid or expired access token');
        }
      }
    );
  }

  /**
   * Verify and decode refresh token with instrumentation
   */
  async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    return this.instrumentation.instrumentAuthentication(
      'verify_refresh_token',
      async (span: api.Span) => {
        span.setAttributes({
          [BusinessAttributes.AUTH_TOKEN_TYPE]: 'refresh_token'
        });

        try {
          const verifyStart = Date.now();
          
          const payload = jwt.verify(token, this.refreshTokenSecret, {
            issuer: this.issuer,
            audience: 'fortium-metrics-refresh',
          }) as RefreshTokenPayload;

          const verifyDuration = Date.now() - verifyStart;

          span.setAttributes({
            [BusinessAttributes.USER_ID]: payload.user_id,
            [BusinessAttributes.ORGANIZATION_ID]: payload.organization_id,
            'auth.token_verification_duration_ms': verifyDuration,
            'auth.token_jti': payload.jti,
            'auth.token_family': payload.token_family
          });

          // Verify refresh token exists in database
          const dbStart = Date.now();
          const tokenRecord = await this.getRefreshToken(payload.jti);
          const dbDuration = Date.now() - dbStart;
          
          span.setAttributes({
            'auth.database_lookup_duration_ms': dbDuration,
            'auth.token_exists_in_db': !!tokenRecord
          });

          if (!tokenRecord) {
            span.setAttributes({
              [BusinessAttributes.AUTH_RESULT]: 'not_found'
            });
            throw new Error('Refresh token not found or expired');
          }

          span.setAttributes({
            [BusinessAttributes.AUTH_RESULT]: 'valid'
          });

          return payload;
        } catch (error) {
          span.setAttributes({
            [BusinessAttributes.AUTH_RESULT]: 'invalid',
            'auth.error_type': this.categorizeAuthError(error)
          });
          
          this.logger.warn('Refresh token verification failed', { 
            error: error instanceof Error ? error.message : 'Unknown error',
            error_type: this.categorizeAuthError(error)
          });
          
          throw new Error('Invalid or expired refresh token');
        }
      }
    );
  }

  /**
   * Refresh access token using refresh token with full instrumentation
   */
  async refreshAccessToken(refreshToken: string): Promise<TokenPair> {
    return this.instrumentation.instrumentAuthentication(
      'refresh_access_token',
      async (span: api.Span) => {
        // Verify refresh token first
        const refreshPayload = await this.verifyRefreshToken(refreshToken);
        
        span.setAttributes({
          [BusinessAttributes.USER_ID]: refreshPayload.user_id,
          [BusinessAttributes.ORGANIZATION_ID]: refreshPayload.organization_id,
          'auth.refresh_token_family': refreshPayload.token_family
        });
        
        // Get user information for new access token
        const userQueryStart = Date.now();
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
        const userQueryDuration = Date.now() - userQueryStart;
        
        span.setAttributes({
          'auth.user_query_duration_ms': userQueryDuration,
          'auth.user_found': result.rows.length > 0
        });

        if (result.rows.length === 0) {
          span.setAttributes({
            [BusinessAttributes.AUTH_RESULT]: 'user_not_found'
          });
          throw new Error('User not found');
        }

        const user = result.rows[0];

        // Revoke old refresh token
        const revokeStart = Date.now();
        await this.revokeRefreshToken(refreshPayload.jti);
        const revokeDuration = Date.now() - revokeStart;
        
        span.setAttributes({
          'auth.token_revocation_duration_ms': revokeDuration
        });

        // Generate new token pair
        const tokenPair = await this.generateTokenPair({
          user_id: user.id,
          organization_id: user.organization_id,
          email: user.email,
          role: user.role,
          team_memberships: user.team_memberships,
        });

        span.setAttributes({
          [BusinessAttributes.AUTH_RESULT]: 'refreshed',
          'auth.new_token_expires_in': tokenPair.expires_in
        });

        return tokenPair;
      }
    );
  }

  /**
   * Revoke access token (add to blacklist) with instrumentation
   */
  @InstrumentMethod(OperationType.AUTHENTICATION, 'revoke_access_token')
  async revokeAccessToken(jti: string): Promise<void> {
    const span = api.trace.getActiveSpan();
    if (span) {
      span.setAttributes({
        'auth.token_jti': jti,
        'auth.revocation_type': 'access_token'
      });
    }

    const expiryQuery = `
      INSERT INTO token_blacklist (jti, blacklisted_at, expires_at)
      VALUES ($1, NOW(), NOW() + INTERVAL '1 day')
      ON CONFLICT (jti) DO NOTHING
    `;
    
    await this.db.query(expiryQuery, [jti]);
    this.logger.info('Access token revoked', { jti });
  }

  /**
   * Revoke refresh token with instrumentation
   */
  @InstrumentMethod(OperationType.AUTHENTICATION, 'revoke_refresh_token')
  async revokeRefreshToken(jti: string): Promise<void> {
    const span = api.trace.getActiveSpan();
    if (span) {
      span.setAttributes({
        'auth.token_jti': jti,
        'auth.revocation_type': 'refresh_token'
      });
    }

    await this.db.query('DELETE FROM refresh_tokens WHERE jti = $1', [jti]);
    this.logger.info('Refresh token revoked', { jti });
  }

  /**
   * Revoke all tokens for a user with instrumentation
   */
  @InstrumentMethod(OperationType.AUTHENTICATION, 'revoke_all_user_tokens')
  async revokeAllUserTokens(userId: string): Promise<void> {
    const span = api.trace.getActiveSpan();
    if (span) {
      span.setAttributes({
        [BusinessAttributes.USER_ID]: userId,
        'auth.revocation_scope': 'all_user_tokens'
      });
    }

    const result = await this.db.query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
    
    if (span) {
      span.setAttributes({
        'auth.tokens_revoked_count': result.rowCount || 0
      });
    }
    
    this.logger.info('All user tokens revoked', { 
      user_id: userId,
      tokens_revoked: result.rowCount
    });
  }

  /**
   * Check if user has permission with detailed instrumentation
   */
  hasPermission(userPayload: JWTPayload, resource: string, action: string, context?: any): boolean {
    return this.instrumentation.tracer.startActiveSpan('auth.permission_check', (span: api.Span) => {
      span.setAttributes({
        [BusinessAttributes.USER_ID]: userPayload.user_id,
        [BusinessAttributes.ORGANIZATION_ID]: userPayload.organization_id,
        [BusinessAttributes.AUTH_ROLE]: userPayload.role,
        'auth.resource': resource,
        'auth.action': action,
        'auth.context_provided': !!context
      });

      const permissions = userPayload.permissions || [];
      
      // Check for wildcard permission (owner role)
      if (permissions.some(p => p.resource === '*' && p.action === '*')) {
        span.setAttributes({
          'auth.permission_result': 'granted',
          'auth.permission_reason': 'wildcard'
        });
        return true;
      }

      // Check for specific permissions
      for (const permission of permissions) {
        if (permission.resource === resource && (permission.action === action || permission.action === '*')) {
          // Check condition if present
          if (permission.condition) {
            const conditionResult = this.evaluatePermissionCondition(permission.condition, userPayload, context);
            span.setAttributes({
              'auth.permission_result': conditionResult ? 'granted' : 'denied',
              'auth.permission_reason': 'conditional',
              'auth.permission_condition': permission.condition,
              'auth.condition_result': conditionResult
            });
            return conditionResult;
          }
          
          span.setAttributes({
            'auth.permission_result': 'granted',
            'auth.permission_reason': 'direct_match'
          });
          return true;
        }
      }

      span.setAttributes({
        'auth.permission_result': 'denied',
        'auth.permission_reason': 'no_matching_permission'
      });
      return false;
    });
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
   * Store refresh token in database with instrumentation
   */
  private async instrumentedStoreRefreshToken(tokenData: {
    jti: string;
    user_id: string;
    organization_id: string;
    token_family: string;
    expires_at: Date;
  }, parentSpan: api.Span): Promise<void> {
    const dbStart = Date.now();
    
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

    const dbDuration = Date.now() - dbStart;
    parentSpan.setAttributes({
      'auth.refresh_token_storage_duration_ms': dbDuration
    });
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
   * Categorize authentication errors for better observability
   */
  private categorizeAuthError(error: any): string {
    const message = error?.message?.toLowerCase() || '';
    
    if (message.includes('expired')) return 'token_expired';
    if (message.includes('invalid')) return 'token_invalid';
    if (message.includes('malformed')) return 'token_malformed';
    if (message.includes('revoked')) return 'token_revoked';
    if (message.includes('not found')) return 'token_not_found';
    if (message.includes('signature')) return 'signature_invalid';
    
    return 'unknown';
  }

  /**
   * Clean up expired tokens (should be run periodically) with instrumentation
   */
  @InstrumentMethod(OperationType.AUTHENTICATION, 'cleanup_expired_tokens')
  async cleanupExpiredTokens(): Promise<void> {
    const span = api.trace.getActiveSpan();
    
    const refreshResult = await this.db.query('DELETE FROM refresh_tokens WHERE expires_at <= NOW()');
    const blacklistResult = await this.db.query('DELETE FROM token_blacklist WHERE expires_at <= NOW()');
    
    if (span) {
      span.setAttributes({
        'auth.cleanup.expired_refresh_tokens': refreshResult.rowCount || 0,
        'auth.cleanup.expired_blacklist_entries': blacklistResult.rowCount || 0
      });
    }
    
    this.logger.info('Token cleanup completed', {
      expired_refresh_tokens: refreshResult.rowCount,
      expired_blacklist_entries: blacklistResult.rowCount,
    });
  }
}