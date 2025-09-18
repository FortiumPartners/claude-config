/**
 * OAuth Provider Factory
 * Creates and manages OAuth provider instances
 */

import * as winston from 'winston';
import { DatabaseConnection } from '../../database/connection';
import { GoogleOAuthService, GoogleOAuthConfig } from './google.service';
import { AzureOAuthService, AzureOAuthConfig } from './azure.service';
import { OIDCService, OIDCConfig } from './oidc.service';

// Base interfaces for OAuth providers
export interface OAuthConfig {
  client_id: string;
  client_secret: string;
  redirect_uri: string;
  scopes: string[];
}

export interface OAuthTokens {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_at?: Date;
  scope?: string;
  id_token?: string;
}

export interface OAuthUserProfile {
  provider_user_id: string;
  email: string;
  name: string;
  first_name?: string;
  last_name?: string;
  picture?: string;
  locale?: string;
  email_verified: boolean;
  profile_data: Record<string, any>;
}

export interface OAuthSession {
  state: string;
  organization_id: string;
  provider: string;
  code_verifier: string;
  code_challenge: string;
  redirect_uri: string;
  nonce?: string;
  scopes?: string;
  expires_at: Date;
}

/**
 * Base OAuth Provider Class
 */
export abstract class BaseOAuthProvider {
  protected db: DatabaseConnection;
  protected logger: winston.Logger;
  protected providerName: string;

  constructor(db: DatabaseConnection, logger: winston.Logger, providerName: string) {
    this.db = db;
    this.logger = logger;
    this.providerName = providerName;
  }

  // Abstract methods that must be implemented by specific providers
  abstract initialize(config: any): Promise<void>;
  abstract getAuthorizationUrl(config: any, state: string): Promise<{
    url: string;
    codeVerifier: string;
    nonce: string;
  }>;
  abstract exchangeCodeForTokens(
    config: any,
    code: string,
    codeVerifier: string,
    state: string
  ): Promise<OAuthTokens>;
  abstract refreshToken(refreshToken: string): Promise<OAuthTokens>;
  abstract getUserProfile(accessToken: string, idToken?: string): Promise<OAuthUserProfile>;
  abstract getDefaultScopes(): string[];

  // Optional methods with default implementations
  async validateIdToken(idToken: string, nonce?: string): Promise<any> {
    throw new Error('ID token validation not implemented for this provider');
  }

  async revokeToken(token: string): Promise<void> {
    this.logger.warn('Token revocation not implemented for this provider', {
      provider: this.providerName,
    });
  }

  getProviderMetadata() {
    return {
      name: this.providerName,
      display_name: this.providerName,
      supports_refresh: false,
      supports_revocation: false,
    };
  }

  /**
   * Store OAuth session state
   */
  async storeOAuthSession(session: OAuthSession): Promise<void> {
    const query = `
      INSERT INTO oauth_sessions (
        state, organization_id, provider, code_verifier, code_challenge,
        redirect_uri, nonce, scopes, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (state) DO UPDATE SET
        organization_id = EXCLUDED.organization_id,
        provider = EXCLUDED.provider,
        code_verifier = EXCLUDED.code_verifier,
        code_challenge = EXCLUDED.code_challenge,
        redirect_uri = EXCLUDED.redirect_uri,
        nonce = EXCLUDED.nonce,
        scopes = EXCLUDED.scopes,
        expires_at = EXCLUDED.expires_at
    `;

    await this.db.query(query, [
      session.state,
      session.organization_id,
      session.provider,
      session.code_verifier,
      session.code_challenge,
      session.redirect_uri,
      session.nonce,
      session.scopes,
      session.expires_at,
    ]);

    this.logger.debug('OAuth session stored', {
      provider: this.providerName,
      state: session.state,
      expires_at: session.expires_at,
    });
  }

  /**
   * Retrieve OAuth session state
   */
  async getOAuthSession(state: string): Promise<OAuthSession | null> {
    const query = `
      SELECT * FROM oauth_sessions 
      WHERE state = $1 AND expires_at > NOW()
    `;

    const result = await this.db.query(query, [state]);
    
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      state: row.state,
      organization_id: row.organization_id,
      provider: row.provider,
      code_verifier: row.code_verifier,
      code_challenge: row.code_challenge,
      redirect_uri: row.redirect_uri,
      nonce: row.nonce,
      scopes: row.scopes,
      expires_at: row.expires_at,
    };
  }

  /**
   * Delete OAuth session state
   */
  async deleteOAuthSession(state: string): Promise<void> {
    await this.db.query('DELETE FROM oauth_sessions WHERE state = $1', [state]);
    
    this.logger.debug('OAuth session deleted', {
      provider: this.providerName,
      state,
    });
  }

  /**
   * Store OAuth tokens for user
   */
  async storeOAuthTokens(
    userId: string,
    organizationId: string,
    tokens: OAuthTokens
  ): Promise<void> {
    const encryptedAccessToken = this.encryptToken(tokens.access_token);
    const encryptedRefreshToken = tokens.refresh_token 
      ? this.encryptToken(tokens.refresh_token)
      : null;

    const query = `
      INSERT INTO oauth_tokens (
        user_id, organization_id, provider, access_token_encrypted,
        refresh_token_encrypted, token_type, scope, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (user_id, provider) DO UPDATE SET
        access_token_encrypted = EXCLUDED.access_token_encrypted,
        refresh_token_encrypted = EXCLUDED.refresh_token_encrypted,
        token_type = EXCLUDED.token_type,
        scope = EXCLUDED.scope,
        expires_at = EXCLUDED.expires_at,
        updated_at = NOW()
    `;

    await this.db.query(query, [
      userId,
      organizationId,
      this.providerName,
      encryptedAccessToken,
      encryptedRefreshToken,
      tokens.token_type,
      tokens.scope,
      tokens.expires_at,
    ]);

    this.logger.info('OAuth tokens stored', {
      provider: this.providerName,
      user_id: userId,
      has_refresh_token: !!tokens.refresh_token,
      expires_at: tokens.expires_at,
    });
  }

  /**
   * Get OAuth tokens for user
   */
  async getOAuthTokens(userId: string): Promise<OAuthTokens | null> {
    const query = `
      SELECT * FROM oauth_tokens 
      WHERE user_id = $1 AND provider = $2
    `;

    const result = await this.db.query(query, [userId, this.providerName]);
    
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      access_token: this.decryptToken(row.access_token_encrypted),
      refresh_token: row.refresh_token_encrypted 
        ? this.decryptToken(row.refresh_token_encrypted)
        : undefined,
      token_type: row.token_type,
      scope: row.scope,
      expires_at: row.expires_at,
    };
  }

  /**
   * Store or update user OAuth identity
   */
  async storeUserOAuthIdentity(
    userId: string,
    organizationId: string,
    profile: OAuthUserProfile
  ): Promise<void> {
    const query = `
      INSERT INTO user_oauth_identities (
        user_id, organization_id, provider, provider_user_id,
        email, name, picture_url, profile_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (user_id, provider) DO UPDATE SET
        provider_user_id = EXCLUDED.provider_user_id,
        email = EXCLUDED.email,
        name = EXCLUDED.name,
        picture_url = EXCLUDED.picture_url,
        profile_data = EXCLUDED.profile_data,
        last_sync_at = NOW()
    `;

    await this.db.query(query, [
      userId,
      organizationId,
      this.providerName,
      profile.provider_user_id,
      profile.email,
      profile.name,
      profile.picture,
      JSON.stringify(profile.profile_data),
    ]);

    this.logger.info('OAuth identity stored', {
      provider: this.providerName,
      user_id: userId,
      provider_user_id: profile.provider_user_id,
      email: profile.email,
    });
  }

  /**
   * Basic token encryption (should use proper encryption in production)
   */
  private encryptToken(token: string): string {
    // In production, use proper encryption with a secure key
    // This is a simple base64 encoding for demonstration
    return Buffer.from(token, 'utf8').toString('base64');
  }

  /**
   * Basic token decryption
   */
  private decryptToken(encryptedToken: string): string {
    // In production, use proper decryption
    return Buffer.from(encryptedToken, 'base64').toString('utf8');
  }
}

/**
 * OAuth Provider Factory
 */
export class OAuthProviderFactory {
  private static instances = new Map<string, BaseOAuthProvider>();

  static async createProvider(
    providerType: string,
    db: DatabaseConnection,
    logger: winston.Logger
  ): Promise<BaseOAuthProvider> {
    const key = `${providerType}:${db.constructor.name}`;
    
    if (this.instances.has(key)) {
      return this.instances.get(key)!;
    }

    let provider: BaseOAuthProvider;

    switch (providerType.toLowerCase()) {
      case 'google':
        provider = new GoogleOAuthService(db, logger);
        break;
      
      case 'azure':
      case 'microsoft':
        provider = new AzureOAuthService(db, logger);
        break;
      
      case 'oidc':
      case 'openid':
      default:
        provider = new OIDCService(db, logger, providerType);
        break;
    }

    this.instances.set(key, provider);
    return provider;
  }

  static getSupportedProviders(): string[] {
    return ['google', 'azure', 'oidc'];
  }

  static getProviderMetadata(providerType: string) {
    const metadataMap = {
      google: {
        name: 'Google',
        display_name: 'Google Workspace',
        icon_url: 'https://developers.google.com/identity/images/g-logo.png',
        color: '#4285F4',
        documentation_url: 'https://developers.google.com/identity/protocols/oauth2',
      },
      azure: {
        name: 'Azure AD',
        display_name: 'Microsoft Azure Active Directory',
        icon_url: 'https://docs.microsoft.com/en-us/azure/active-directory/develop/media/howto-add-branding-in-azure-ad-apps/ms-symbollockup_mssymbol_19.png',
        color: '#0078D4',
        documentation_url: 'https://docs.microsoft.com/en-us/azure/active-directory/develop/',
      },
      oidc: {
        name: 'Generic OIDC',
        display_name: 'OpenID Connect Provider',
        color: '#000000',
        documentation_url: 'https://openid.net/connect/',
      },
    };

    return metadataMap[providerType.toLowerCase()] || metadataMap.oidc;
  }

  static clearInstances(): void {
    this.instances.clear();
  }
}

// Export type combinations for convenience
export type AllOAuthConfigs = GoogleOAuthConfig | AzureOAuthConfig | OIDCConfig;
export type AllOAuthServices = GoogleOAuthService | AzureOAuthService | OIDCService;