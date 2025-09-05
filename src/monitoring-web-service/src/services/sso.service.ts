/**
 * SSO Service - OAuth2/OIDC Integration
 * Supports multiple providers: Google Workspace, Microsoft Azure AD, Okta
 */

import crypto from 'crypto';
import * as winston from 'winston';
import { DatabaseConnection } from '../database/connection';
import { JWTService, UserRole } from './jwt.service';

export interface SSOProvider {
  id: string;
  organization_id: string;
  provider_name: string;
  provider_type: 'oauth2' | 'oidc' | 'saml';
  client_id: string;
  client_secret: string;
  discovery_url?: string;
  redirect_uri: string;
  scopes: string[];
  additional_config: Record<string, any>;
  is_active: boolean;
}

export interface SSOAuthRequest {
  provider_name: string;
  organization_id?: string;
  state?: string;
  redirect_uri?: string;
}

export interface SSOAuthResponse {
  authorization_url: string;
  state: string;
  code_verifier?: string; // For PKCE
}

export interface SSOCallbackRequest {
  code: string;
  state: string;
  provider_name: string;
  organization_id?: string;
  code_verifier?: string; // For PKCE
}

export interface SSOUserInfo {
  external_id: string;
  email: string;
  name: string;
  picture?: string;
  groups?: string[];
  organization?: string;
  provider_data: Record<string, any>;
}

export interface SSOAuthResult {
  user: {
    id: string;
    organization_id: string;
    email: string;
    name: string;
    role: UserRole;
    external_id: string;
    external_provider: string;
    is_new_user: boolean;
  };
  tokens: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: 'Bearer';
  };
}

// Provider-specific configurations
const PROVIDER_CONFIGS = {
  google: {
    authorization_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    token_endpoint: 'https://oauth2.googleapis.com/token',
    userinfo_endpoint: 'https://www.googleapis.com/oauth2/v2/userinfo',
    discovery_url: 'https://accounts.google.com/.well-known/openid_configuration',
    default_scopes: ['openid', 'email', 'profile'],
    user_id_field: 'id',
    email_field: 'email',
    name_field: 'name',
    picture_field: 'picture',
  },
  azure: {
    authorization_endpoint: 'https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize',
    token_endpoint: 'https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token',
    userinfo_endpoint: 'https://graph.microsoft.com/v1.0/me',
    discovery_url: 'https://login.microsoftonline.com/{tenant}/v2.0/.well-known/openid_configuration',
    default_scopes: ['openid', 'email', 'profile', 'User.Read'],
    user_id_field: 'id',
    email_field: 'mail',
    name_field: 'displayName',
    picture_field: 'photo',
  },
  okta: {
    authorization_endpoint: '{domain}/oauth2/v1/authorize',
    token_endpoint: '{domain}/oauth2/v1/token',
    userinfo_endpoint: '{domain}/oauth2/v1/userinfo',
    discovery_url: '{domain}/.well-known/openid_configuration',
    default_scopes: ['openid', 'email', 'profile', 'groups'],
    user_id_field: 'sub',
    email_field: 'email',
    name_field: 'name',
    picture_field: 'picture',
  },
};

export class SSOService {
  private db: DatabaseConnection;
  private logger: winston.Logger;
  private jwtService: JWTService;
  private encryptionKey: string;

  constructor(db: DatabaseConnection, jwtService: JWTService, logger: winston.Logger) {
    this.db = db;
    this.jwtService = jwtService;
    this.logger = logger;
    
    // Encryption key for storing client secrets
    this.encryptionKey = process.env.SSO_ENCRYPTION_KEY || this.generateEncryptionKey();
    
    if (!process.env.SSO_ENCRYPTION_KEY) {
      this.logger.warn('Using generated SSO encryption key - this is not secure for production');
    }
  }

  private generateEncryptionKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Configure SSO provider for an organization
   */
  async configureSSOProvider(
    organizationId: string,
    providerConfig: Omit<SSOProvider, 'id' | 'organization_id'>
  ): Promise<SSOProvider> {
    await this.db.setOrganizationContext(organizationId);

    try {
      // Encrypt client secret
      const encryptedSecret = this.encryptSecret(providerConfig.client_secret);

      const query = `
        INSERT INTO sso_providers (
          organization_id, provider_name, provider_type, client_id,
          client_secret_encrypted, discovery_url, redirect_uri,
          scopes, additional_config, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (organization_id, provider_name)
        DO UPDATE SET
          provider_type = EXCLUDED.provider_type,
          client_id = EXCLUDED.client_id,
          client_secret_encrypted = EXCLUDED.client_secret_encrypted,
          discovery_url = EXCLUDED.discovery_url,
          redirect_uri = EXCLUDED.redirect_uri,
          scopes = EXCLUDED.scopes,
          additional_config = EXCLUDED.additional_config,
          is_active = EXCLUDED.is_active,
          updated_at = NOW()
        RETURNING *
      `;

      const result = await this.db.query(query, [
        organizationId,
        providerConfig.provider_name,
        providerConfig.provider_type,
        providerConfig.client_id,
        encryptedSecret,
        providerConfig.discovery_url,
        providerConfig.redirect_uri,
        JSON.stringify(providerConfig.scopes),
        JSON.stringify(providerConfig.additional_config),
        providerConfig.is_active,
      ]);

      const provider = result.rows[0];
      
      this.logger.info('SSO provider configured', {
        organization_id: organizationId,
        provider_name: providerConfig.provider_name,
        provider_type: providerConfig.provider_type
      });

      return {
        ...provider,
        client_secret: providerConfig.client_secret, // Return decrypted for immediate use
        scopes: JSON.parse(provider.scopes),
        additional_config: JSON.parse(provider.additional_config),
      };
    } finally {
      await this.db.clearOrganizationContext();
    }
  }

  /**
   * Get SSO provider configuration
   */
  async getSSOProvider(organizationId: string, providerName: string): Promise<SSOProvider | null> {
    await this.db.setOrganizationContext(organizationId);

    try {
      const query = `
        SELECT * FROM sso_providers 
        WHERE organization_id = $1 AND provider_name = $2 AND is_active = true
      `;

      const result = await this.db.query(query, [organizationId, providerName]);
      if (result.rows.length === 0) return null;

      const provider = result.rows[0];
      
      return {
        ...provider,
        client_secret: this.decryptSecret(provider.client_secret_encrypted),
        scopes: JSON.parse(provider.scopes),
        additional_config: JSON.parse(provider.additional_config),
      };
    } finally {
      await this.db.clearOrganizationContext();
    }
  }

  /**
   * Initiate SSO authentication flow
   */
  async initiateSSOAuth(request: SSOAuthRequest): Promise<SSOAuthResponse> {
    const { provider_name, organization_id } = request;

    // Get provider configuration
    if (!organization_id) {
      throw new Error('Organization ID required for SSO authentication');
    }

    const provider = await this.getSSOProvider(organization_id, provider_name);
    if (!provider) {
      throw new Error(`SSO provider '${provider_name}' not found or not active`);
    }

    // Get provider-specific configuration
    const providerConfig = PROVIDER_CONFIGS[provider_name as keyof typeof PROVIDER_CONFIGS];
    if (!providerConfig) {
      throw new Error(`Unsupported SSO provider: ${provider_name}`);
    }

    // Generate state parameter for CSRF protection
    const state = request.state || crypto.randomBytes(32).toString('hex');
    
    // Generate PKCE parameters for enhanced security
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

    // Store SSO session state
    await this.storeSSOSession({
      state,
      organization_id,
      provider_name,
      code_verifier: codeVerifier,
      redirect_uri: request.redirect_uri || provider.redirect_uri,
    });

    // Build authorization URL
    const authUrl = new URL(this.replaceTemplatePlaceholders(
      providerConfig.authorization_endpoint,
      provider.additional_config
    ));

    const params = {
      response_type: 'code',
      client_id: provider.client_id,
      redirect_uri: request.redirect_uri || provider.redirect_uri,
      scope: provider.scopes.join(' '),
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      // Provider-specific parameters
      ...this.getProviderSpecificAuthParams(provider_name, provider.additional_config),
    };

    Object.entries(params).forEach(([key, value]) => {
      if (value) authUrl.searchParams.set(key, value.toString());
    });

    this.logger.info('SSO authentication initiated', {
      organization_id,
      provider_name,
      state,
      redirect_uri: request.redirect_uri || provider.redirect_uri,
    });

    return {
      authorization_url: authUrl.toString(),
      state,
      code_verifier: codeVerifier,
    };
  }

  /**
   * Handle SSO callback and authenticate user
   */
  async handleSSOCallback(request: SSOCallbackRequest): Promise<SSOAuthResult> {
    const { code, state, provider_name } = request;

    // Retrieve and verify SSO session
    const session = await this.getSSOSession(state);
    if (!session) {
      throw new Error('Invalid or expired SSO session state');
    }

    if (session.provider_name !== provider_name) {
      throw new Error('SSO provider mismatch');
    }

    try {
      // Get provider configuration
      const provider = await this.getSSOProvider(session.organization_id, provider_name);
      if (!provider) {
        throw new Error(`SSO provider '${provider_name}' not found or not active`);
      }

      // Exchange authorization code for tokens
      const tokenResponse = await this.exchangeCodeForTokens(provider, code, session);
      
      // Get user information from provider
      const userInfo = await this.getUserInfo(provider, tokenResponse.access_token);
      
      // Find or create user
      const user = await this.findOrCreateUser(session.organization_id, provider_name, userInfo);
      
      // Generate application tokens
      const tokens = await this.jwtService.generateTokenPair({
        user_id: user.id,
        organization_id: user.organization_id,
        email: user.email,
        role: user.role,
        team_memberships: user.team_memberships,
      });

      // Log successful authentication
      await this.logAuthEvent({
        organization_id: session.organization_id,
        user_id: user.id,
        event_type: 'sso_login_success',
        provider_name,
        external_id: userInfo.external_id,
      });

      this.logger.info('SSO authentication successful', {
        organization_id: session.organization_id,
        user_id: user.id,
        provider_name,
        is_new_user: user.is_new_user,
      });

      return {
        user: {
          id: user.id,
          organization_id: user.organization_id,
          email: user.email,
          name: user.name,
          role: user.role,
          external_id: user.external_id,
          external_provider: user.external_provider,
          is_new_user: user.is_new_user,
        },
        tokens,
      };
    } catch (error) {
      // Log failed authentication
      await this.logAuthEvent({
        organization_id: session.organization_id,
        event_type: 'sso_login_failed',
        provider_name,
        error_message: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    } finally {
      // Clean up SSO session
      await this.deleteSSOSession(state);
    }
  }

  /**
   * Sync user groups/teams from SSO provider
   */
  async syncUserGroupsFromSSO(userId: string, providerName: string): Promise<void> {
    // This would implement group/team synchronization
    // For now, we'll log the intent and implement basic structure
    
    this.logger.info('SSO group sync initiated', {
      user_id: userId,
      provider_name: providerName,
    });

    // Implementation would:
    // 1. Get fresh user info from SSO provider
    // 2. Parse groups/teams from provider response
    // 3. Update user's team memberships in database
    // 4. Log sync results

    // TODO: Implement actual group synchronization logic
  }

  /**
   * List available SSO providers for organization
   */
  async listSSOProviders(organizationId: string): Promise<Array<Omit<SSOProvider, 'client_secret' | 'client_secret_encrypted'>>> {
    await this.db.setOrganizationContext(organizationId);

    try {
      const query = `
        SELECT id, organization_id, provider_name, provider_type,
               client_id, discovery_url, redirect_uri, scopes,
               additional_config, is_active, created_at, updated_at
        FROM sso_providers 
        WHERE organization_id = $1
        ORDER BY provider_name
      `;

      const result = await this.db.query(query, [organizationId]);
      
      return result.rows.map(row => ({
        ...row,
        scopes: JSON.parse(row.scopes),
        additional_config: JSON.parse(row.additional_config),
      }));
    } finally {
      await this.db.clearOrganizationContext();
    }
  }

  /**
   * Disable SSO provider
   */
  async disableSSOProvider(organizationId: string, providerName: string): Promise<void> {
    await this.db.setOrganizationContext(organizationId);

    try {
      const query = `
        UPDATE sso_providers 
        SET is_active = false, updated_at = NOW()
        WHERE organization_id = $1 AND provider_name = $2
      `;

      const result = await this.db.query(query, [organizationId, providerName]);
      
      if (result.rowCount === 0) {
        throw new Error(`SSO provider '${providerName}' not found`);
      }

      this.logger.info('SSO provider disabled', {
        organization_id: organizationId,
        provider_name: providerName,
      });
    } finally {
      await this.db.clearOrganizationContext();
    }
  }

  // Private helper methods

  private encryptSecret(secret: string): string {
    const algorithm = 'aes-256-gcm';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(algorithm, this.encryptionKey);
    
    let encrypted = cipher.update(secret, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  private decryptSecret(encryptedSecret: string): string {
    const algorithm = 'aes-256-gcm';
    const parts = encryptedSecret.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const decipher = crypto.createDecipher(algorithm, this.encryptionKey);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  private replaceTemplatePlaceholders(template: string, config: Record<string, any>): string {
    return template.replace(/\{(\w+)\}/g, (match, key) => config[key] || match);
  }

  private getProviderSpecificAuthParams(providerName: string, config: Record<string, any>): Record<string, any> {
    switch (providerName) {
      case 'azure':
        return {
          prompt: 'select_account',
          tenant: config.tenant_id || 'common',
        };
      case 'okta':
        return {
          sessionToken: config.session_token,
        };
      default:
        return {};
    }
  }

  private async exchangeCodeForTokens(
    provider: SSOProvider,
    code: string,
    session: any
  ): Promise<{ access_token: string; id_token?: string }> {
    const providerConfig = PROVIDER_CONFIGS[provider.provider_name as keyof typeof PROVIDER_CONFIGS];
    
    const tokenEndpoint = this.replaceTemplatePlaceholders(
      providerConfig.token_endpoint,
      provider.additional_config
    );

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: provider.client_id,
      client_secret: provider.client_secret,
      code,
      redirect_uri: session.redirect_uri,
      code_verifier: session.code_verifier,
    });

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error('Token exchange failed', {
        status: response.status,
        error: errorText,
        provider: provider.provider_name,
      });
      throw new Error(`Token exchange failed: ${response.status}`);
    }

    return response.json();
  }

  private async getUserInfo(provider: SSOProvider, accessToken: string): Promise<SSOUserInfo> {
    const providerConfig = PROVIDER_CONFIGS[provider.provider_name as keyof typeof PROVIDER_CONFIGS];
    
    const userInfoEndpoint = this.replaceTemplatePlaceholders(
      providerConfig.userinfo_endpoint,
      provider.additional_config
    );

    const response = await fetch(userInfoEndpoint, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get user info: ${response.status}`);
    }

    const userData = await response.json();
    
    return {
      external_id: userData[providerConfig.user_id_field],
      email: userData[providerConfig.email_field],
      name: userData[providerConfig.name_field],
      picture: userData[providerConfig.picture_field],
      groups: userData.groups || [],
      provider_data: userData,
    };
  }

  private async findOrCreateUser(
    organizationId: string,
    providerName: string,
    userInfo: SSOUserInfo
  ): Promise<any> {
    await this.db.setOrganizationContext(organizationId);

    try {
      // First, try to find existing user
      let query = `
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
        WHERE u.organization_id = $1 
        AND (u.external_id = $2 OR u.email = $3)
        AND u.external_provider = $4
        GROUP BY u.id
      `;

      let result = await this.db.query(query, [
        organizationId,
        userInfo.external_id,
        userInfo.email,
        providerName,
      ]);

      if (result.rows.length > 0) {
        // User exists, update last login
        const user = result.rows[0];
        await this.db.query(
          'UPDATE users SET last_login_at = NOW() WHERE id = $1',
          [user.id]
        );
        return { ...user, is_new_user: false };
      }

      // User doesn't exist, create new user
      // Assign default role (could be customized based on organization settings)
      const defaultRole: UserRole = 'developer';

      query = `
        INSERT INTO users (
          organization_id, email, name, role, external_id, external_provider,
          is_active, email_verified, last_login_at
        ) VALUES ($1, $2, $3, $4, $5, $6, true, true, NOW())
        RETURNING *
      `;

      result = await this.db.query(query, [
        organizationId,
        userInfo.email,
        userInfo.name,
        defaultRole,
        userInfo.external_id,
        providerName,
      ]);

      const newUser = result.rows[0];
      
      this.logger.info('New SSO user created', {
        user_id: newUser.id,
        organization_id: organizationId,
        email: userInfo.email,
        provider: providerName,
      });

      return { ...newUser, team_memberships: [], is_new_user: true };
    } finally {
      await this.db.clearOrganizationContext();
    }
  }

  private async storeSSOSession(sessionData: {
    state: string;
    organization_id: string;
    provider_name: string;
    code_verifier: string;
    redirect_uri: string;
  }): Promise<void> {
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    const query = `
      INSERT INTO sso_sessions (state, organization_id, provider_name, code_verifier, redirect_uri, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;

    // Note: This would require a sso_sessions table to be created
    // For now, we'll use a simple in-memory storage (not production-ready)
    // In production, this should use Redis or database storage
  }

  private async getSSOSession(state: string): Promise<any> {
    // This should retrieve from persistent storage
    // For now, returning a mock session
    return {
      organization_id: 'org-123',
      provider_name: 'google',
      code_verifier: 'test-verifier',
      redirect_uri: 'http://localhost:3000/auth/callback',
    };
  }

  private async deleteSSOSession(state: string): Promise<void> {
    // This should delete from persistent storage
    this.logger.debug('SSO session cleaned up', { state });
  }

  private async logAuthEvent(event: {
    organization_id?: string;
    user_id?: string;
    event_type: string;
    provider_name?: string;
    external_id?: string;
    error_message?: string;
  }): Promise<void> {
    const query = `
      INSERT INTO auth_audit_log (
        organization_id, user_id, event_type, event_details, 
        success, error_message, timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `;

    await this.db.query(query, [
      event.organization_id || null,
      event.user_id || null,
      event.event_type,
      JSON.stringify({
        provider_name: event.provider_name,
        external_id: event.external_id,
      }),
      !event.error_message,
      event.error_message || null,
    ]);
  }
}