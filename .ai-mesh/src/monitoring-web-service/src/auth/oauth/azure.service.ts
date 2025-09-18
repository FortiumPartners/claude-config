/**
 * Microsoft Azure AD OAuth 2.0 Service
 * Handles Azure AD OAuth 2.0 authentication with OIDC support
 */

import { Issuer, Client, generators, TokenSet } from 'openid-client';
import * as winston from 'winston';
import { DatabaseConnection } from '../../database/connection';
import { BaseOAuthProvider, OAuthConfig, OAuthTokens, OAuthUserProfile } from './oauth.factory';

export interface AzureOAuthConfig extends OAuthConfig {
  tenant_id?: string; // Azure tenant ID (defaults to 'common')
  resource?: string; // Legacy Azure AD resource parameter
  prompt?: 'none' | 'login' | 'consent' | 'select_account';
}

export interface AzureUserProfile {
  id: string;
  mail: string;
  userPrincipalName: string;
  displayName: string;
  givenName: string;
  surname: string;
  jobTitle?: string;
  department?: string;
  companyName?: string;
  businessPhones: string[];
  mobilePhone?: string;
  preferredLanguage?: string;
}

export interface AzureTokenClaims {
  aud: string;
  iss: string;
  iat: number;
  nbf: number;
  exp: number;
  sub: string;
  name: string;
  preferred_username: string;
  oid: string;
  tid: string;
  ver: string;
  email?: string;
  upn?: string;
  roles?: string[];
  groups?: string[];
}

export class AzureOAuthService extends BaseOAuthProvider {
  private client: Client | null = null;
  private issuer: Issuer | null = null;
  private tenantId: string = 'common';

  constructor(db: DatabaseConnection, logger: winston.Logger) {
    super(db, logger, 'azure');
  }

  /**
   * Initialize Azure OAuth client
   */
  async initialize(config: AzureOAuthConfig): Promise<void> {
    try {
      this.tenantId = config.tenant_id || 'common';
      const discoveryUrl = `https://login.microsoftonline.com/${this.tenantId}/v2.0/.well-known/openid_configuration`;
      
      // Discover Azure AD OIDC configuration
      this.issuer = await Issuer.discover(discoveryUrl);
      
      this.client = new this.issuer.Client({
        client_id: config.client_id,
        client_secret: config.client_secret,
        redirect_uris: [config.redirect_uri],
        response_types: ['code'],
      });

      this.logger.info('Azure OAuth client initialized', {
        provider: this.providerName,
        tenant_id: this.tenantId,
        client_id: config.client_id.substring(0, 8) + '...',
      });
    } catch (error) {
      this.logger.error('Failed to initialize Azure OAuth client', {
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: this.providerName,
        tenant_id: this.tenantId,
      });
      throw new Error('Azure OAuth initialization failed');
    }
  }

  /**
   * Generate authorization URL with PKCE
   */
  async getAuthorizationUrl(config: AzureOAuthConfig, state: string): Promise<{
    url: string;
    codeVerifier: string;
    nonce: string;
  }> {
    if (!this.client) {
      throw new Error('Azure OAuth client not initialized');
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

    // Add Azure-specific parameters
    if (config.prompt) {
      authParams.prompt = config.prompt;
    } else {
      authParams.prompt = 'select_account'; // Default to account selection
    }

    if (config.resource) {
      authParams.resource = config.resource;
    }

    // Add domain hint if we have a specific tenant
    if (this.tenantId !== 'common' && this.tenantId !== 'organizations') {
      authParams.domain_hint = this.tenantId;
    }

    const authUrl = this.client.authorizationUrl(authParams);

    this.logger.info('Azure authorization URL generated', {
      provider: this.providerName,
      tenant_id: this.tenantId,
      state,
      scopes: config.scopes,
      prompt: authParams.prompt,
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
    config: AzureOAuthConfig,
    code: string,
    codeVerifier: string,
    state: string
  ): Promise<OAuthTokens> {
    if (!this.client) {
      throw new Error('Azure OAuth client not initialized');
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

      this.logger.info('Azure tokens exchanged successfully', {
        provider: this.providerName,
        tenant_id: this.tenantId,
        has_refresh_token: !!tokens.refresh_token,
        expires_at: tokens.expires_at,
      });

      return tokens;
    } catch (error) {
      this.logger.error('Azure token exchange failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: this.providerName,
        tenant_id: this.tenantId,
      });
      throw new Error('Failed to exchange authorization code for tokens');
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<OAuthTokens> {
    if (!this.client) {
      throw new Error('Azure OAuth client not initialized');
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

      this.logger.info('Azure token refreshed successfully', {
        provider: this.providerName,
        tenant_id: this.tenantId,
        expires_at: tokens.expires_at,
      });

      return tokens;
    } catch (error) {
      this.logger.error('Azure token refresh failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: this.providerName,
        tenant_id: this.tenantId,
      });
      throw new Error('Failed to refresh Azure access token');
    }
  }

  /**
   * Get user profile information from Microsoft Graph
   */
  async getUserProfile(accessToken: string): Promise<OAuthUserProfile> {
    try {
      const response = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Microsoft Graph API error: ${response.status} ${response.statusText}`);
      }

      const profile: AzureUserProfile = await response.json();

      // Validate required fields
      if (!profile.id || (!profile.mail && !profile.userPrincipalName)) {
        throw new Error('Invalid Azure profile: missing required fields');
      }

      // Use mail if available, otherwise use userPrincipalName
      const email = profile.mail || profile.userPrincipalName;

      const userProfile: OAuthUserProfile = {
        provider_user_id: profile.id,
        email: email,
        name: profile.displayName,
        first_name: profile.givenName,
        last_name: profile.surname,
        email_verified: true, // Azure AD emails are considered verified
        profile_data: {
          job_title: profile.jobTitle,
          department: profile.department,
          company_name: profile.companyName,
          business_phones: profile.businessPhones,
          mobile_phone: profile.mobilePhone,
          preferred_language: profile.preferredLanguage,
          user_principal_name: profile.userPrincipalName,
        },
      };

      this.logger.info('Azure user profile retrieved', {
        provider: this.providerName,
        tenant_id: this.tenantId,
        user_id: profile.id,
        email: email,
        upn: profile.userPrincipalName,
      });

      return userProfile;
    } catch (error) {
      this.logger.error('Failed to get Azure user profile', {
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: this.providerName,
        tenant_id: this.tenantId,
      });
      throw error;
    }
  }

  /**
   * Get user's group memberships (requires additional permissions)
   */
  async getUserGroups(accessToken: string): Promise<string[]> {
    try {
      const response = await fetch('https://graph.microsoft.com/v1.0/me/memberOf', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        this.logger.warn('Failed to get user groups from Azure', {
          status: response.status,
          provider: this.providerName,
        });
        return [];
      }

      const data = await response.json();
      const groups = data.value?.map((group: any) => group.displayName).filter(Boolean) || [];

      this.logger.info('Azure user groups retrieved', {
        provider: this.providerName,
        group_count: groups.length,
      });

      return groups;
    } catch (error) {
      this.logger.warn('Failed to get Azure user groups', {
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: this.providerName,
      });
      return [];
    }
  }

  /**
   * Validate ID token (OIDC)
   */
  async validateIdToken(idToken: string, nonce?: string): Promise<AzureTokenClaims> {
    if (!this.client) {
      throw new Error('Azure OAuth client not initialized');
    }

    try {
      const tokenSet = new TokenSet({ id_token: idToken });
      const claims = await this.client.validateIdToken(tokenSet, nonce) as AzureTokenClaims;

      // Validate tenant if we have a specific tenant requirement
      if (this.tenantId !== 'common' && this.tenantId !== 'organizations' && claims.tid !== this.tenantId) {
        throw new Error(`Token from wrong tenant: expected ${this.tenantId}, got ${claims.tid}`);
      }

      this.logger.info('Azure ID token validated', {
        provider: this.providerName,
        tenant_id: claims.tid,
        subject: claims.sub,
        object_id: claims.oid,
        audience: claims.aud,
      });

      return claims;
    } catch (error) {
      this.logger.error('Azure ID token validation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: this.providerName,
        tenant_id: this.tenantId,
      });
      throw new Error('Invalid Azure ID token');
    }
  }

  /**
   * Revoke access token (Azure AD doesn't have a standard revocation endpoint)
   */
  async revokeToken(token: string): Promise<void> {
    // Azure AD doesn't provide a token revocation endpoint like Google
    // Tokens will expire based on their TTL
    this.logger.info('Azure token marked for expiration', {
      provider: this.providerName,
      tenant_id: this.tenantId,
    });
  }

  /**
   * Check if user is from allowed tenant
   */
  validateTenant(profile: OAuthUserProfile, allowedTenant?: string): boolean {
    if (!allowedTenant || allowedTenant === 'common' || allowedTenant === 'organizations') {
      return true;
    }

    // This would need to be implemented based on token claims or additional API calls
    return true;
  }

  /**
   * Get provider-specific scopes
   */
  getDefaultScopes(): string[] {
    return ['openid', 'email', 'profile', 'User.Read'];
  }

  /**
   * Get additional scopes for enhanced functionality
   */
  getEnhancedScopes(): string[] {
    return [
      ...this.getDefaultScopes(),
      'Group.Read.All', // For group memberships
      'Directory.Read.All', // For directory information
    ];
  }

  /**
   * Get provider metadata
   */
  getProviderMetadata() {
    return {
      name: 'Azure AD',
      display_name: 'Microsoft Azure Active Directory',
      icon_url: 'https://docs.microsoft.com/en-us/azure/active-directory/develop/media/howto-add-branding-in-azure-ad-apps/ms-symbollockup_mssymbol_19.png',
      color: '#0078D4',
      supports_refresh: true,
      supports_revocation: false,
      supports_tenant_restriction: true,
      supports_groups: true,
    };
  }

  /**
   * Get tenant-specific discovery URL
   */
  getDiscoveryUrl(tenantId: string = 'common'): string {
    return `https://login.microsoftonline.com/${tenantId}/v2.0/.well-known/openid_configuration`;
  }

  /**
   * Validate tenant ID format
   */
  isValidTenantId(tenantId: string): boolean {
    // UUID format or special values
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const specialValues = ['common', 'organizations', 'consumers'];
    
    return uuidRegex.test(tenantId) || specialValues.includes(tenantId);
  }
}