/**
 * OAuth Authentication Middleware
 * Handles OAuth token validation and user context setup
 */

import express from 'express';
import * as winston from 'winston';
import { DatabaseConnection } from '../../database/connection';
import { JWTService } from '../../services/jwt.service';
import { OAuthConfigService } from '../oauth/config.service';
import { OAuthProviderFactory } from '../oauth/oauth.factory';

export interface OAuthRequest extends express.Request {
  user?: {
    id: string;
    organization_id: string;
    email: string;
    role: string;
    oauth_provider?: string;
  };
  oauth?: {
    provider: string;
    access_token: string;
    refresh_token?: string;
    expires_at?: Date;
  };
}

export class OAuthMiddleware {
  private db: DatabaseConnection;
  private logger: winston.Logger;
  private jwtService: JWTService;
  private configService: OAuthConfigService;

  constructor(
    db: DatabaseConnection,
    logger: winston.Logger,
    jwtService: JWTService
  ) {
    this.db = db;
    this.logger = logger;
    this.jwtService = jwtService;
    this.configService = new OAuthConfigService(db, logger);
  }

  /**
   * Middleware to authenticate OAuth bearer tokens
   */
  authenticateOAuth = async (
    req: OAuthRequest,
    res: express.Response,
    next: express.NextFunction
  ): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          error: 'OAuth access token required',
          timestamp: new Date().toISOString(),
        });
      }

      const accessToken = authHeader.substring(7); // Remove 'Bearer ' prefix

      // First, try to validate as our application JWT
      try {
        const jwtPayload = await this.jwtService.verifyAccessToken(accessToken);
        
        // Set organization context
        await this.db.setOrganizationContext(jwtPayload.organization_id);
        
        req.user = {
          id: jwtPayload.user_id,
          organization_id: jwtPayload.organization_id,
          email: jwtPayload.email,
          role: jwtPayload.role,
        };

        // Check if user has OAuth tokens stored
        const oauthTokens = await this.getUserOAuthTokens(jwtPayload.user_id);
        if (oauthTokens) {
          req.oauth = oauthTokens;
        }

        return next();
      } catch (jwtError) {
        // JWT validation failed, try OAuth token validation
        this.logger.debug('JWT validation failed, trying OAuth token validation', {
          error: jwtError instanceof Error ? jwtError.message : 'Unknown error',
        });
      }

      // Try to validate as OAuth access token
      const oauthResult = await this.validateOAuthToken(accessToken, req);
      if (oauthResult) {
        req.user = oauthResult.user;
        req.oauth = oauthResult.oauth;
        return next();
      }

      // Both validations failed
      return res.status(401).json({
        error: 'Invalid or expired access token',
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      this.logger.error('OAuth authentication error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ip: req.ip,
        user_agent: req.get('User-Agent'),
      });

      return res.status(500).json({
        error: 'Authentication failed',
        timestamp: new Date().toISOString(),
      });
    }
  };

  /**
   * Middleware to ensure user is authenticated via specific OAuth provider
   */
  requireOAuthProvider = (requiredProvider: string) => {
    return async (
      req: OAuthRequest,
      res: express.Response,
      next: express.NextFunction
    ): Promise<void> => {
      if (!req.oauth || req.oauth.provider !== requiredProvider) {
        return res.status(403).json({
          error: `Authentication via ${requiredProvider} required`,
          current_provider: req.oauth?.provider,
          timestamp: new Date().toISOString(),
        });
      }

      next();
    };
  };

  /**
   * Middleware to refresh OAuth token if needed
   */
  refreshOAuthToken = async (
    req: OAuthRequest,
    res: express.Response,
    next: express.NextFunction
  ): Promise<void> => {
    if (!req.oauth || !req.user) {
      return next();
    }

    try {
      // Check if token is expiring soon (within 5 minutes)
      const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
      
      if (req.oauth.expires_at && req.oauth.expires_at <= fiveMinutesFromNow) {
        if (!req.oauth.refresh_token) {
          this.logger.warn('OAuth token expiring soon but no refresh token available', {
            user_id: req.user.id,
            provider: req.oauth.provider,
            expires_at: req.oauth.expires_at,
          });
          return next();
        }

        const refreshed = await this.refreshUserOAuthTokens(
          req.user.id,
          req.user.organization_id,
          req.oauth.provider,
          req.oauth.refresh_token
        );

        if (refreshed) {
          req.oauth = {
            provider: refreshed.provider,
            access_token: refreshed.access_token,
            refresh_token: refreshed.refresh_token,
            expires_at: refreshed.expires_at,
          };

          this.logger.info('OAuth token refreshed automatically', {
            user_id: req.user.id,
            provider: req.oauth.provider,
            new_expires_at: refreshed.expires_at,
          });
        }
      }

      next();
    } catch (error) {
      this.logger.error('OAuth token refresh error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        user_id: req.user?.id,
        provider: req.oauth?.provider,
      });

      // Don't fail the request, just log the error
      next();
    }
  };

  /**
   * Validate OAuth access token by calling provider's userinfo endpoint
   */
  private async validateOAuthToken(accessToken: string, req: express.Request): Promise<{
    user: OAuthRequest['user'];
    oauth: OAuthRequest['oauth'];
  } | null> {
    // We need to determine which provider this token belongs to
    // This could be done by trying each configured provider or maintaining a token registry

    // For now, we'll need to check the request context or try common providers
    const organizationSlug = req.headers['x-organization'] as string;
    if (!organizationSlug) {
      return null;
    }

    // Get organization ID
    const orgResult = await this.db.query(
      'SELECT id FROM organizations WHERE slug = $1',
      [organizationSlug]
    );

    if (orgResult.rows.length === 0) {
      return null;
    }

    const organizationId = orgResult.rows[0].id;
    
    // Get all active OAuth configurations for this organization
    const configs = await this.configService.listConfigs(organizationId, true);

    for (const config of configs) {
      try {
        const provider = await OAuthProviderFactory.createProvider(
          config.provider_name,
          this.db,
          this.logger
        );

        await provider.initialize(config as any);
        
        // Try to get user profile with this token
        const profile = await provider.getUserProfile(accessToken);
        
        // Find user by OAuth identity
        const user = await this.findUserByOAuthIdentity(
          organizationId,
          config.provider_name,
          profile.provider_user_id
        );

        if (user) {
          await this.db.setOrganizationContext(organizationId);
          
          return {
            user: {
              id: user.id,
              organization_id: user.organization_id,
              email: user.email,
              role: user.role,
              oauth_provider: config.provider_name,
            },
            oauth: {
              provider: config.provider_name,
              access_token: accessToken,
              // We don't have refresh token or expiry from the access token alone
            },
          };
        }
      } catch (error) {
        // Token doesn't work with this provider, try next one
        this.logger.debug('OAuth token validation failed for provider', {
          provider: config.provider_name,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        continue;
      }
    }

    return null;
  }

  /**
   * Get stored OAuth tokens for user
   */
  private async getUserOAuthTokens(userId: string): Promise<OAuthRequest['oauth'] | null> {
    const query = `
      SELECT provider, access_token_encrypted, refresh_token_encrypted, 
             token_type, expires_at
      FROM oauth_tokens
      WHERE user_id = $1
      ORDER BY updated_at DESC
      LIMIT 1
    `;

    const result = await this.db.query(query, [userId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      provider: row.provider,
      access_token: this.decryptToken(row.access_token_encrypted),
      refresh_token: row.refresh_token_encrypted 
        ? this.decryptToken(row.refresh_token_encrypted) 
        : undefined,
      expires_at: row.expires_at,
    };
  }

  /**
   * Refresh user's OAuth tokens
   */
  private async refreshUserOAuthTokens(
    userId: string,
    organizationId: string,
    provider: string,
    refreshToken: string
  ): Promise<{
    provider: string;
    access_token: string;
    refresh_token?: string;
    expires_at?: Date;
  } | null> {
    try {
      const config = await this.configService.getActiveConfig(organizationId, provider);
      if (!config) {
        throw new Error(`No active configuration for provider: ${provider}`);
      }

      const oauthProvider = await OAuthProviderFactory.createProvider(
        provider,
        this.db,
        this.logger
      );

      await oauthProvider.initialize(config as any);
      
      const tokens = await oauthProvider.refreshToken(refreshToken);

      // Store the new tokens
      await oauthProvider.storeOAuthTokens(userId, organizationId, tokens);

      return {
        provider,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: tokens.expires_at,
      };
    } catch (error) {
      this.logger.error('Failed to refresh OAuth tokens', {
        error: error instanceof Error ? error.message : 'Unknown error',
        user_id: userId,
        provider,
      });
      return null;
    }
  }

  /**
   * Find user by OAuth identity
   */
  private async findUserByOAuthIdentity(
    organizationId: string,
    provider: string,
    providerUserId: string
  ): Promise<any> {
    const query = `
      SELECT u.id, u.organization_id, u.email, u.role, u.name
      FROM users u
      JOIN user_oauth_identities uoi ON u.id = uoi.user_id
      WHERE u.organization_id = $1 
        AND uoi.provider = $2 
        AND uoi.provider_user_id = $3
        AND u.is_active = true
    `;

    const result = await this.db.query(query, [organizationId, provider, providerUserId]);
    return result.rows[0] || null;
  }

  /**
   * Basic token decryption (should match encryption in oauth.factory.ts)
   */
  private decryptToken(encryptedToken: string): string {
    return Buffer.from(encryptedToken, 'base64').toString('utf8');
  }

  /**
   * Middleware to validate OAuth scopes
   */
  requireScopes = (requiredScopes: string[]) => {
    return async (
      req: OAuthRequest,
      res: express.Response,
      next: express.NextFunction
    ): Promise<void> => {
      if (!req.oauth) {
        return res.status(401).json({
          error: 'OAuth authentication required',
          timestamp: new Date().toISOString(),
        });
      }

      // In a production system, you would validate scopes against the stored OAuth tokens
      // For now, we'll assume the token has the required scopes
      // This would require storing and validating the actual scope claims

      this.logger.debug('OAuth scope validation requested', {
        user_id: req.user?.id,
        provider: req.oauth.provider,
        required_scopes: requiredScopes,
      });

      next();
    };
  };

  /**
   * Get OAuth authorization URL for re-authentication
   */
  async getReauthUrl(
    organizationId: string,
    provider: string,
    redirectUri?: string
  ): Promise<string> {
    const config = await this.configService.getActiveConfig(organizationId, provider);
    if (!config) {
      throw new Error(`No active configuration for provider: ${provider}`);
    }

    const oauthProvider = await OAuthProviderFactory.createProvider(
      provider,
      this.db,
      this.logger
    );

    await oauthProvider.initialize(config as any);
    
    const state = require('crypto').randomBytes(32).toString('hex');
    const authResult = await oauthProvider.getAuthorizationUrl(config as any, state);

    // Store the OAuth session
    await oauthProvider.storeOAuthSession({
      state,
      organization_id: organizationId,
      provider,
      code_verifier: authResult.codeVerifier,
      code_challenge: require('crypto')
        .createHash('sha256')
        .update(authResult.codeVerifier)
        .digest('base64url'),
      redirect_uri: redirectUri || config.redirect_uri,
      nonce: authResult.nonce,
      scopes: config.scopes.join(' '),
      expires_at: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
    });

    return authResult.url;
  }
}

/**
 * Factory function to create OAuth middleware
 */
export function createOAuthMiddleware(
  db: DatabaseConnection,
  logger: winston.Logger,
  jwtService: JWTService
): OAuthMiddleware {
  return new OAuthMiddleware(db, logger, jwtService);
}