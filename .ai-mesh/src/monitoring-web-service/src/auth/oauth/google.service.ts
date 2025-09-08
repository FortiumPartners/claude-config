/**
 * Google Workspace OAuth 2.0 Service
 * Handles Google OAuth 2.0 authentication with OIDC support
 */

import { Issuer, Client, generators, TokenSet } from 'openid-client';
import * as winston from 'winston';
import { DatabaseConnection } from '../../database/connection';
import { BaseOAuthProvider, OAuthConfig, OAuthTokens, OAuthUserProfile } from './oauth.factory';

export interface GoogleOAuthConfig extends OAuthConfig {
  hosted_domain?: string; // For Google Workspace domain restriction
  include_granted_scopes?: boolean;
  access_type?: 'offline' | 'online';
}

export interface GoogleUserProfile {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  locale: string;
  hd?: string; // Hosted domain for G Suite users
}

export class GoogleOAuthService extends BaseOAuthProvider {
  private client: Client | null = null;
  private issuer: Issuer | null = null;

  constructor(db: DatabaseConnection, logger: winston.Logger) {
    super(db, logger, 'google');
  }

  /**
   * Initialize Google OAuth client
   */
  async initialize(config: GoogleOAuthConfig): Promise<void> {
    try {
      // Discover Google's OIDC configuration
      this.issuer = await Issuer.discover('https://accounts.google.com');
      
      this.client = new this.issuer.Client({
        client_id: config.client_id,
        client_secret: config.client_secret,
        redirect_uris: [config.redirect_uri],
        response_types: ['code'],
      });

      this.logger.info('Google OAuth client initialized', {
        provider: this.providerName,
        client_id: config.client_id.substring(0, 8) + '...',
      });
    } catch (error) {
      this.logger.error('Failed to initialize Google OAuth client', {
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: this.providerName,
      });
      throw new Error('Google OAuth initialization failed');
    }
  }

  /**
   * Generate authorization URL with PKCE
   */
  async getAuthorizationUrl(config: GoogleOAuthConfig, state: string): Promise<{
    url: string;
    codeVerifier: string;
    nonce: string;
  }> {
    if (!this.client) {
      throw new Error('Google OAuth client not initialized');
    }

    const codeVerifier = generators.codeVerifier();
    const codeChallenge = generators.codeChallenge(codeVerifier);
    const nonce = generators.nonce();

    const authParams: Record<string, string> = {
      scope: config.scopes.join(' '),
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state,
      nonce,
    };

    // Add Google-specific parameters
    if (config.hosted_domain) {
      authParams.hd = config.hosted_domain;
    }

    if (config.include_granted_scopes) {
      authParams.include_granted_scopes = 'true';
    }

    if (config.access_type) {
      authParams.access_type = config.access_type;
    }

    // Force account selection for better UX
    authParams.prompt = 'select_account';

    const authUrl = this.client.authorizationUrl(authParams);

    this.logger.info('Google authorization URL generated', {
      provider: this.providerName,
      state,
      hosted_domain: config.hosted_domain,
      scopes: config.scopes,
    });

    return {
      url: authUrl,
      codeVerifier,
      nonce,
    };
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(
    config: GoogleOAuthConfig,
    code: string,
    codeVerifier: string,
    state: string
  ): Promise<OAuthTokens> {
    if (!this.client) {
      throw new Error('Google OAuth client not initialized');
    }

    try {
      const tokenSet = await this.client.callback(
        config.redirect_uri,
        { code, state },
        { code_verifier: codeVerifier }
      );

      const tokens: OAuthTokens = {
        access_token: tokenSet.access_token!,
        refresh_token: tokenSet.refresh_token,
        token_type: tokenSet.token_type || 'Bearer',
        expires_at: tokenSet.expires_at ? new Date(tokenSet.expires_at * 1000) : undefined,
        scope: tokenSet.scope,
        id_token: tokenSet.id_token,
      };

      this.logger.info('Google tokens exchanged successfully', {
        provider: this.providerName,
        has_refresh_token: !!tokens.refresh_token,
        expires_at: tokens.expires_at,
      });

      return tokens;
    } catch (error) {
      this.logger.error('Google token exchange failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: this.providerName,
      });
      throw new Error('Failed to exchange authorization code for tokens');
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<OAuthTokens> {
    if (!this.client) {
      throw new Error('Google OAuth client not initialized');
    }

    try {
      const tokenSet = await this.client.refresh(refreshToken);

      const tokens: OAuthTokens = {
        access_token: tokenSet.access_token!,
        refresh_token: tokenSet.refresh_token || refreshToken, // Google may not return new refresh token
        token_type: tokenSet.token_type || 'Bearer',
        expires_at: tokenSet.expires_at ? new Date(tokenSet.expires_at * 1000) : undefined,
        scope: tokenSet.scope,
        id_token: tokenSet.id_token,
      };

      this.logger.info('Google token refreshed successfully', {
        provider: this.providerName,
        expires_at: tokens.expires_at,
      });

      return tokens;
    } catch (error) {
      this.logger.error('Google token refresh failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: this.providerName,
      });
      throw new Error('Failed to refresh Google access token');
    }
  }

  /**
   * Get user profile information
   */
  async getUserProfile(accessToken: string): Promise<OAuthUserProfile> {
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Google API error: ${response.status} ${response.statusText}`);
      }

      const profile: GoogleUserProfile = await response.json();

      // Validate required fields
      if (!profile.id || !profile.email) {
        throw new Error('Invalid Google profile: missing required fields');
      }

      // Check email verification
      if (!profile.verified_email) {
        throw new Error('Google email not verified');
      }

      const userProfile: OAuthUserProfile = {
        provider_user_id: profile.id,
        email: profile.email,
        name: profile.name,
        first_name: profile.given_name,
        last_name: profile.family_name,
        picture: profile.picture,
        locale: profile.locale,
        email_verified: profile.verified_email,
        profile_data: {
          hosted_domain: profile.hd,
          locale: profile.locale,
          given_name: profile.given_name,
          family_name: profile.family_name,
        },
      };

      this.logger.info('Google user profile retrieved', {
        provider: this.providerName,
        user_id: profile.id,
        email: profile.email,
        hosted_domain: profile.hd,
        verified: profile.verified_email,
      });

      return userProfile;
    } catch (error) {
      this.logger.error('Failed to get Google user profile', {
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: this.providerName,
      });
      throw error;
    }
  }

  /**
   * Validate ID token (OIDC)
   */
  async validateIdToken(idToken: string, nonce?: string): Promise<any> {
    if (!this.client) {
      throw new Error('Google OAuth client not initialized');
    }

    try {
      const tokenSet = new TokenSet({ id_token: idToken });
      const claims = await this.client.validateIdToken(tokenSet, nonce);

      this.logger.info('Google ID token validated', {
        provider: this.providerName,
        subject: claims.sub,
        audience: claims.aud,
        issuer: claims.iss,
      });

      return claims;
    } catch (error) {
      this.logger.error('Google ID token validation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: this.providerName,
      });
      throw new Error('Invalid Google ID token');
    }
  }

  /**
   * Revoke access token
   */
  async revokeToken(token: string): Promise<void> {
    try {
      const response = await fetch(
        `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Google token revocation failed: ${response.status}`);
      }

      this.logger.info('Google token revoked successfully', {
        provider: this.providerName,
      });
    } catch (error) {
      this.logger.error('Failed to revoke Google token', {
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: this.providerName,
      });
      throw error;
    }
  }

  /**
   * Validate hosted domain restriction
   */
  validateHostedDomain(profile: OAuthUserProfile, allowedDomain?: string): boolean {
    if (!allowedDomain) return true;

    const hostedDomain = profile.profile_data?.hosted_domain;
    if (!hostedDomain) {
      this.logger.warn('Google user not from hosted domain', {
        provider: this.providerName,
        email: profile.email,
        required_domain: allowedDomain,
      });
      return false;
    }

    if (hostedDomain !== allowedDomain) {
      this.logger.warn('Google user from wrong hosted domain', {
        provider: this.providerName,
        email: profile.email,
        user_domain: hostedDomain,
        required_domain: allowedDomain,
      });
      return false;
    }

    return true;
  }

  /**
   * Get provider-specific scopes
   */
  getDefaultScopes(): string[] {
    return ['openid', 'email', 'profile'];
  }

  /**
   * Get provider metadata
   */
  getProviderMetadata() {
    return {
      name: 'Google',
      display_name: 'Google Workspace',
      icon_url: 'https://developers.google.com/identity/images/g-logo.png',
      color: '#4285F4',
      supports_refresh: true,
      supports_revocation: true,
      supports_hosted_domain: true,
    };
  }
}