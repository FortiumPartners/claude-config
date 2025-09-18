/**
 * Generic OpenID Connect (OIDC) Service
 * Handles generic OIDC providers like Okta, Auth0, Keycloak, etc.
 */

import { Issuer, Client, generators, TokenSet } from 'openid-client';
import * as winston from 'winston';
import { DatabaseConnection } from '../../database/connection';
import { BaseOAuthProvider, OAuthConfig, OAuthTokens, OAuthUserProfile } from './oauth.factory';

export interface OIDCConfig extends OAuthConfig {
  issuer_url: string; // OIDC issuer URL (required for discovery)
  authorization_endpoint?: string; // Override discovery
  token_endpoint?: string; // Override discovery
  userinfo_endpoint?: string; // Override discovery
  jwks_uri?: string; // Override discovery
  end_session_endpoint?: string; // For logout
  custom_claims_mapping?: {
    user_id?: string;
    email?: string;
    name?: string;
    first_name?: string;
    last_name?: string;
    picture?: string;
  };
  additional_auth_params?: Record<string, string>;
}

export class OIDCService extends BaseOAuthProvider {
  private client: Client | null = null;
  private issuer: Issuer | null = null;
  private config: OIDCConfig | null = null;

  constructor(db: DatabaseConnection, logger: winston.Logger, providerName: string = 'oidc') {
    super(db, logger, providerName);
  }

  /**
   * Initialize OIDC client with discovery
   */
  async initialize(config: OIDCConfig): Promise<void> {
    try {
      this.config = config;

      // Discover OIDC configuration
      this.issuer = await Issuer.discover(config.issuer_url);

      // Override discovery endpoints if provided
      const issuerMetadata = { ...this.issuer.metadata };
      if (config.authorization_endpoint) {
        issuerMetadata.authorization_endpoint = config.authorization_endpoint;
      }
      if (config.token_endpoint) {
        issuerMetadata.token_endpoint = config.token_endpoint;
      }
      if (config.userinfo_endpoint) {
        issuerMetadata.userinfo_endpoint = config.userinfo_endpoint;
      }
      if (config.jwks_uri) {
        issuerMetadata.jwks_uri = config.jwks_uri;
      }
      if (config.end_session_endpoint) {
        issuerMetadata.end_session_endpoint = config.end_session_endpoint;
      }

      // Create issuer with potentially overridden metadata
      if (Object.keys(issuerMetadata).length !== Object.keys(this.issuer.metadata).length) {
        this.issuer = new Issuer(issuerMetadata);
      }
      
      this.client = new this.issuer.Client({
        client_id: config.client_id,
        client_secret: config.client_secret,
        redirect_uris: [config.redirect_uri],
        response_types: ['code'],
      });

      this.logger.info('OIDC client initialized', {
        provider: this.providerName,
        issuer: config.issuer_url,
        client_id: config.client_id.substring(0, 8) + '...',
      });
    } catch (error) {
      this.logger.error('Failed to initialize OIDC client', {
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: this.providerName,
        issuer: config.issuer_url,
      });
      throw new Error('OIDC initialization failed');
    }
  }

  /**
   * Generate authorization URL with PKCE
   */
  async getAuthorizationUrl(config: OIDCConfig, state: string): Promise<{
    url: string;
    codeVerifier: string;
    nonce: string;
  }> {
    if (!this.client || !this.config) {
      throw new Error('OIDC client not initialized');
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

    // Add any additional authentication parameters
    if (config.additional_auth_params) {
      Object.assign(authParams, config.additional_auth_params);
    }

    // Default prompt for better UX (can be overridden)
    if (!authParams.prompt) {
      authParams.prompt = 'select_account';
    }

    const authUrl = this.client.authorizationUrl(authParams);

    this.logger.info('OIDC authorization URL generated', {
      provider: this.providerName,
      issuer: this.config.issuer_url,
      state,
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
    config: OIDCConfig,
    code: string,
    codeVerifier: string,
    state: string
  ): Promise<OAuthTokens> {
    if (!this.client) {
      throw new Error('OIDC client not initialized');
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

      this.logger.info('OIDC tokens exchanged successfully', {
        provider: this.providerName,
        has_refresh_token: !!tokens.refresh_token,
        expires_at: tokens.expires_at,
      });

      return tokens;
    } catch (error) {
      this.logger.error('OIDC token exchange failed', {
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
      throw new Error('OIDC client not initialized');
    }

    try {
      const tokenSet = await this.client.refresh(refreshToken);

      const tokens: OAuthTokens = {
        access_token: tokenSet.access_token!,
        refresh_token: tokenSet.refresh_token || refreshToken,
        token_type: tokenSet.token_type || 'Bearer',
        expires_at: tokenSet.expires_at ? new Date(tokenSet.expires_at * 1000) : undefined,
        scope: tokenSet.scope,
        id_token: tokenSet.id_token,
      };

      this.logger.info('OIDC token refreshed successfully', {
        provider: this.providerName,
        expires_at: tokens.expires_at,
      });

      return tokens;
    } catch (error) {
      this.logger.error('OIDC token refresh failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: this.providerName,
      });
      throw new Error('Failed to refresh OIDC access token');
    }
  }

  /**
   * Get user profile information
   */
  async getUserProfile(accessToken: string, idToken?: string): Promise<OAuthUserProfile> {
    if (!this.client || !this.config) {
      throw new Error('OIDC client not initialized');
    }

    try {
      let profile: any;

      // Try to get profile from userinfo endpoint first
      if (this.issuer!.metadata.userinfo_endpoint) {
        const response = await fetch(this.issuer!.metadata.userinfo_endpoint, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
          },
        });

        if (response.ok) {
          profile = await response.json();
        } else {
          this.logger.warn('OIDC userinfo endpoint failed, falling back to ID token', {
            status: response.status,
            provider: this.providerName,
          });
        }
      }

      // Fallback to ID token claims if userinfo fails or isn't available
      if (!profile && idToken) {
        const tokenSet = new TokenSet({ id_token: idToken });
        profile = await this.client.validateIdToken(tokenSet);
      }

      if (!profile) {
        throw new Error('No profile information available');
      }

      // Map profile fields using custom mapping or defaults
      const mapping = this.config.custom_claims_mapping || {};
      const userProfile: OAuthUserProfile = {
        provider_user_id: profile[mapping.user_id || 'sub'] || profile.sub,
        email: profile[mapping.email || 'email'] || profile.email,
        name: profile[mapping.name || 'name'] || profile.name,
        first_name: profile[mapping.first_name || 'given_name'] || profile.given_name,
        last_name: profile[mapping.last_name || 'family_name'] || profile.family_name,
        picture: profile[mapping.picture || 'picture'] || profile.picture,
        email_verified: profile.email_verified !== false, // Default to true unless explicitly false
        profile_data: {
          ...profile,
          custom_mapping_used: !!this.config.custom_claims_mapping,
        },
      };

      // Validate required fields
      if (!userProfile.provider_user_id || !userProfile.email) {
        throw new Error('Invalid OIDC profile: missing required fields');
      }

      this.logger.info('OIDC user profile retrieved', {
        provider: this.providerName,
        user_id: userProfile.provider_user_id,
        email: userProfile.email,
        has_custom_mapping: !!this.config.custom_claims_mapping,
      });

      return userProfile;
    } catch (error) {
      this.logger.error('Failed to get OIDC user profile', {
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
      throw new Error('OIDC client not initialized');
    }

    try {
      const tokenSet = new TokenSet({ id_token: idToken });
      const claims = await this.client.validateIdToken(tokenSet, nonce);

      this.logger.info('OIDC ID token validated', {
        provider: this.providerName,
        subject: claims.sub,
        audience: claims.aud,
        issuer: claims.iss,
      });

      return claims;
    } catch (error) {
      this.logger.error('OIDC ID token validation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: this.providerName,
      });
      throw new Error('Invalid OIDC ID token');
    }
  }

  /**
   * Initiate logout (if supported by provider)
   */
  async getLogoutUrl(idToken?: string, postLogoutRedirectUri?: string): Promise<string | null> {
    if (!this.issuer || !this.issuer.metadata.end_session_endpoint) {
      return null;
    }

    const params = new URLSearchParams();
    if (idToken) {
      params.set('id_token_hint', idToken);
    }
    if (postLogoutRedirectUri) {
      params.set('post_logout_redirect_uri', postLogoutRedirectUri);
    }

    const logoutUrl = `${this.issuer.metadata.end_session_endpoint}?${params.toString()}`;

    this.logger.info('OIDC logout URL generated', {
      provider: this.providerName,
      has_id_token_hint: !!idToken,
      has_redirect_uri: !!postLogoutRedirectUri,
    });

    return logoutUrl;
  }

  /**
   * Revoke access token (if supported by provider)
   */
  async revokeToken(token: string): Promise<void> {
    if (!this.issuer || !this.issuer.metadata.revocation_endpoint) {
      this.logger.warn('OIDC provider does not support token revocation', {
        provider: this.providerName,
      });
      return;
    }

    try {
      const response = await fetch(this.issuer.metadata.revocation_endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${this.config!.client_id}:${this.config!.client_secret}`).toString('base64')}`,
        },
        body: new URLSearchParams({
          token,
          token_type_hint: 'access_token',
        }).toString(),
      });

      if (!response.ok) {
        throw new Error(`OIDC token revocation failed: ${response.status}`);
      }

      this.logger.info('OIDC token revoked successfully', {
        provider: this.providerName,
      });
    } catch (error) {
      this.logger.error('Failed to revoke OIDC token', {
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: this.providerName,
      });
      throw error;
    }
  }

  /**
   * Get provider-specific scopes
   */
  getDefaultScopes(): string[] {
    return ['openid', 'email', 'profile'];
  }

  /**
   * Test OIDC discovery endpoint
   */
  async testDiscovery(issuerUrl: string): Promise<any> {
    try {
      const issuer = await Issuer.discover(issuerUrl);
      
      this.logger.info('OIDC discovery successful', {
        issuer: issuerUrl,
        endpoints: {
          authorization: !!issuer.metadata.authorization_endpoint,
          token: !!issuer.metadata.token_endpoint,
          userinfo: !!issuer.metadata.userinfo_endpoint,
          jwks: !!issuer.metadata.jwks_uri,
          end_session: !!issuer.metadata.end_session_endpoint,
          revocation: !!issuer.metadata.revocation_endpoint,
        },
      });

      return {
        success: true,
        metadata: issuer.metadata,
      };
    } catch (error) {
      this.logger.error('OIDC discovery failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        issuer: issuerUrl,
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get provider metadata
   */
  getProviderMetadata() {
    return {
      name: 'Generic OIDC',
      display_name: 'OpenID Connect Provider',
      color: '#000000',
      supports_refresh: true,
      supports_revocation: true,
      supports_logout: true,
      supports_discovery: true,
      supports_custom_claims: true,
    };
  }

  /**
   * Validate OIDC configuration
   */
  validateConfig(config: OIDCConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.issuer_url) {
      errors.push('Issuer URL is required');
    } else {
      try {
        new URL(config.issuer_url);
      } catch {
        errors.push('Invalid issuer URL format');
      }
    }

    if (!config.client_id) {
      errors.push('Client ID is required');
    }

    if (!config.client_secret) {
      errors.push('Client secret is required');
    }

    if (!config.redirect_uri) {
      errors.push('Redirect URI is required');
    } else {
      try {
        new URL(config.redirect_uri);
      } catch {
        errors.push('Invalid redirect URI format');
      }
    }

    if (!config.scopes || config.scopes.length === 0) {
      errors.push('At least one scope is required');
    } else if (!config.scopes.includes('openid')) {
      errors.push('OpenID Connect requires "openid" scope');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}