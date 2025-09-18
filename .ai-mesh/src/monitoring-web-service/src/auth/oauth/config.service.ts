/**
 * OAuth Configuration Service
 * Manages per-tenant OAuth configuration and encryption
 */

import crypto from 'crypto';
import * as winston from 'winston';
import { DatabaseConnection } from '../../database/connection';
import { OAuthProviderFactory, AllOAuthConfigs } from './oauth.factory';

export interface OAuthProviderConfig {
  id: string;
  organization_id: string;
  provider_name: string;
  provider_type: 'oauth2' | 'oidc';
  client_id: string;
  client_secret: string; // Decrypted
  discovery_url?: string;
  authorization_endpoint?: string;
  token_endpoint?: string;
  userinfo_endpoint?: string;
  jwks_uri?: string;
  issuer?: string;
  redirect_uri: string;
  scopes: string[];
  additional_config: Record<string, any>;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateOAuthConfigRequest {
  organization_id: string;
  provider_name: string;
  provider_type: 'oauth2' | 'oidc';
  client_id: string;
  client_secret: string;
  discovery_url?: string;
  authorization_endpoint?: string;
  token_endpoint?: string;
  userinfo_endpoint?: string;
  jwks_uri?: string;
  issuer?: string;
  redirect_uri: string;
  scopes: string[];
  additional_config?: Record<string, any>;
  is_active?: boolean;
}

export class OAuthConfigService {
  private db: DatabaseConnection;
  private logger: winston.Logger;
  private encryptionKey: Buffer;

  constructor(db: DatabaseConnection, logger: winston.Logger) {
    this.db = db;
    this.logger = logger;
    
    // Initialize encryption key
    const keyString = process.env.OAUTH_ENCRYPTION_KEY;
    if (!keyString) {
      this.logger.warn('No OAUTH_ENCRYPTION_KEY provided, generating temporary key');
      this.encryptionKey = crypto.randomBytes(32);
    } else {
      this.encryptionKey = Buffer.from(keyString, 'hex');
      if (this.encryptionKey.length !== 32) {
        throw new Error('OAUTH_ENCRYPTION_KEY must be 32 bytes (64 hex characters)');
      }
    }
  }

  /**
   * Create or update OAuth provider configuration
   */
  async createOrUpdateConfig(request: CreateOAuthConfigRequest): Promise<OAuthProviderConfig> {
    await this.db.setOrganizationContext(request.organization_id);

    try {
      // Validate the configuration
      const validation = await this.validateConfiguration(request);
      if (!validation.valid) {
        throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
      }

      // Encrypt the client secret
      const encryptedSecret = this.encryptSecret(request.client_secret);

      const query = `
        INSERT INTO sso_providers (
          organization_id, provider_name, provider_type, client_id,
          client_secret_encrypted, discovery_url, authorization_endpoint,
          token_endpoint, userinfo_endpoint, jwks_uri, issuer,
          redirect_uri, scopes, additional_config, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (organization_id, provider_name)
        DO UPDATE SET
          provider_type = EXCLUDED.provider_type,
          client_id = EXCLUDED.client_id,
          client_secret_encrypted = EXCLUDED.client_secret_encrypted,
          discovery_url = EXCLUDED.discovery_url,
          authorization_endpoint = EXCLUDED.authorization_endpoint,
          token_endpoint = EXCLUDED.token_endpoint,
          userinfo_endpoint = EXCLUDED.userinfo_endpoint,
          jwks_uri = EXCLUDED.jwks_uri,
          issuer = EXCLUDED.issuer,
          redirect_uri = EXCLUDED.redirect_uri,
          scopes = EXCLUDED.scopes,
          additional_config = EXCLUDED.additional_config,
          is_active = EXCLUDED.is_active,
          updated_at = NOW()
        RETURNING *
      `;

      const result = await this.db.query(query, [
        request.organization_id,
        request.provider_name,
        request.provider_type,
        request.client_id,
        encryptedSecret,
        request.discovery_url || null,
        request.authorization_endpoint || null,
        request.token_endpoint || null,
        request.userinfo_endpoint || null,
        request.jwks_uri || null,
        request.issuer || null,
        request.redirect_uri,
        JSON.stringify(request.scopes),
        JSON.stringify(request.additional_config || {}),
        request.is_active !== false, // Default to true
      ]);

      const config = this.mapRowToConfig(result.rows[0]);

      this.logger.info('OAuth configuration created/updated', {
        organization_id: request.organization_id,
        provider_name: request.provider_name,
        provider_type: request.provider_type,
        is_active: config.is_active,
      });

      return config;
    } finally {
      await this.db.clearOrganizationContext();
    }
  }

  /**
   * Get OAuth provider configuration
   */
  async getConfig(organizationId: string, providerName: string): Promise<OAuthProviderConfig | null> {
    await this.db.setOrganizationContext(organizationId);

    try {
      const query = `
        SELECT * FROM sso_providers
        WHERE organization_id = $1 AND provider_name = $2
      `;

      const result = await this.db.query(query, [organizationId, providerName]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToConfig(result.rows[0]);
    } finally {
      await this.db.clearOrganizationContext();
    }
  }

  /**
   * Get active OAuth provider configuration
   */
  async getActiveConfig(organizationId: string, providerName: string): Promise<OAuthProviderConfig | null> {
    const config = await this.getConfig(organizationId, providerName);
    return config && config.is_active ? config : null;
  }

  /**
   * List all OAuth provider configurations for an organization
   */
  async listConfigs(organizationId: string, activeOnly = false): Promise<OAuthProviderConfig[]> {
    await this.db.setOrganizationContext(organizationId);

    try {
      let query = `
        SELECT * FROM sso_providers
        WHERE organization_id = $1
      `;
      
      if (activeOnly) {
        query += ' AND is_active = true';
      }
      
      query += ' ORDER BY provider_name';

      const result = await this.db.query(query, [organizationId]);
      
      return result.rows.map(row => this.mapRowToConfig(row));
    } finally {
      await this.db.clearOrganizationContext();
    }
  }

  /**
   * Delete OAuth provider configuration
   */
  async deleteConfig(organizationId: string, providerName: string): Promise<boolean> {
    await this.db.setOrganizationContext(organizationId);

    try {
      const query = `
        DELETE FROM sso_providers
        WHERE organization_id = $1 AND provider_name = $2
      `;

      const result = await this.db.query(query, [organizationId, providerName]);
      
      if (result.rowCount > 0) {
        this.logger.info('OAuth configuration deleted', {
          organization_id: organizationId,
          provider_name: providerName,
        });
        return true;
      }

      return false;
    } finally {
      await this.db.clearOrganizationContext();
    }
  }

  /**
   * Enable/disable OAuth provider
   */
  async toggleConfig(organizationId: string, providerName: string, isActive: boolean): Promise<boolean> {
    await this.db.setOrganizationContext(organizationId);

    try {
      const query = `
        UPDATE sso_providers
        SET is_active = $3, updated_at = NOW()
        WHERE organization_id = $1 AND provider_name = $2
      `;

      const result = await this.db.query(query, [organizationId, providerName, isActive]);
      
      if (result.rowCount > 0) {
        this.logger.info('OAuth configuration toggled', {
          organization_id: organizationId,
          provider_name: providerName,
          is_active: isActive,
        });
        return true;
      }

      return false;
    } finally {
      await this.db.clearOrganizationContext();
    }
  }

  /**
   * Test OAuth provider configuration
   */
  async testConfig(organizationId: string, providerName: string): Promise<{
    success: boolean;
    error?: string;
    metadata?: any;
  }> {
    const config = await this.getConfig(organizationId, providerName);
    if (!config) {
      return { success: false, error: 'Configuration not found' };
    }

    try {
      const provider = await OAuthProviderFactory.createProvider(
        config.provider_name,
        this.db,
        this.logger
      );

      // Initialize with the configuration
      await provider.initialize(this.configToProviderConfig(config));

      return {
        success: true,
        metadata: provider.getProviderMetadata(),
      };
    } catch (error) {
      this.logger.error('OAuth configuration test failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        organization_id: organizationId,
        provider_name: providerName,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Validate OAuth configuration
   */
  private async validateConfiguration(request: CreateOAuthConfigRequest): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    // Basic validation
    if (!request.client_id?.trim()) {
      errors.push('Client ID is required');
    }

    if (!request.client_secret?.trim()) {
      errors.push('Client secret is required');
    }

    if (!request.redirect_uri?.trim()) {
      errors.push('Redirect URI is required');
    } else {
      try {
        new URL(request.redirect_uri);
      } catch {
        errors.push('Invalid redirect URI format');
      }
    }

    if (!request.scopes || request.scopes.length === 0) {
      errors.push('At least one scope is required');
    }

    // Provider-specific validation
    if (request.provider_type === 'oidc') {
      if (!request.discovery_url && !request.issuer) {
        errors.push('Discovery URL or issuer is required for OIDC providers');
      }

      if (request.discovery_url) {
        try {
          new URL(request.discovery_url);
        } catch {
          errors.push('Invalid discovery URL format');
        }
      }

      // Ensure openid scope is present for OIDC
      if (!request.scopes.includes('openid')) {
        errors.push('OIDC providers must include "openid" scope');
      }
    }

    // Check for supported provider
    if (!OAuthProviderFactory.getSupportedProviders().includes(request.provider_name)) {
      errors.push(`Unsupported provider: ${request.provider_name}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Encrypt client secret
   */
  private encryptSecret(secret: string): string {
    const algorithm = 'aes-256-gcm';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(algorithm, this.encryptionKey);
    
    let encrypted = cipher.update(secret, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt client secret
   */
  private decryptSecret(encryptedSecret: string): string {
    const algorithm = 'aes-256-gcm';
    const parts = encryptedSecret.split(':');
    
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted secret format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const decipher = crypto.createDecipher(algorithm, this.encryptionKey);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Map database row to configuration object
   */
  private mapRowToConfig(row: any): OAuthProviderConfig {
    return {
      id: row.id,
      organization_id: row.organization_id,
      provider_name: row.provider_name,
      provider_type: row.provider_type,
      client_id: row.client_id,
      client_secret: this.decryptSecret(row.client_secret_encrypted),
      discovery_url: row.discovery_url,
      authorization_endpoint: row.authorization_endpoint,
      token_endpoint: row.token_endpoint,
      userinfo_endpoint: row.userinfo_endpoint,
      jwks_uri: row.jwks_uri,
      issuer: row.issuer,
      redirect_uri: row.redirect_uri,
      scopes: JSON.parse(row.scopes),
      additional_config: JSON.parse(row.additional_config),
      is_active: row.is_active,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  /**
   * Convert configuration to provider-specific config
   */
  private configToProviderConfig(config: OAuthProviderConfig): AllOAuthConfigs {
    const baseConfig = {
      client_id: config.client_id,
      client_secret: config.client_secret,
      redirect_uri: config.redirect_uri,
      scopes: config.scopes,
      ...config.additional_config,
    };

    // Add provider-specific fields
    switch (config.provider_name.toLowerCase()) {
      case 'google':
        return {
          ...baseConfig,
          hosted_domain: config.additional_config.hosted_domain,
          include_granted_scopes: config.additional_config.include_granted_scopes,
          access_type: config.additional_config.access_type,
        };

      case 'azure':
        return {
          ...baseConfig,
          tenant_id: config.additional_config.tenant_id,
          resource: config.additional_config.resource,
          prompt: config.additional_config.prompt,
        };

      case 'oidc':
      default:
        return {
          ...baseConfig,
          issuer_url: config.discovery_url || config.issuer!,
          authorization_endpoint: config.authorization_endpoint,
          token_endpoint: config.token_endpoint,
          userinfo_endpoint: config.userinfo_endpoint,
          jwks_uri: config.jwks_uri,
          end_session_endpoint: config.additional_config.end_session_endpoint,
          custom_claims_mapping: config.additional_config.custom_claims_mapping,
          additional_auth_params: config.additional_config.additional_auth_params,
        };
    }
  }

  /**
   * Get default configuration templates
   */
  static getProviderTemplates() {
    return {
      google: {
        provider_type: 'oidc',
        discovery_url: 'https://accounts.google.com/.well-known/openid_configuration',
        scopes: ['openid', 'email', 'profile'],
        additional_config: {
          hosted_domain: null,
          include_granted_scopes: true,
          access_type: 'offline',
        },
      },
      azure: {
        provider_type: 'oidc',
        discovery_url: 'https://login.microsoftonline.com/common/v2.0/.well-known/openid_configuration',
        scopes: ['openid', 'email', 'profile', 'User.Read'],
        additional_config: {
          tenant_id: 'common',
          prompt: 'select_account',
        },
      },
      okta: {
        provider_type: 'oidc',
        scopes: ['openid', 'email', 'profile', 'groups'],
        additional_config: {
          custom_claims_mapping: {
            user_id: 'sub',
            email: 'email',
            name: 'name',
            first_name: 'given_name',
            last_name: 'family_name',
          },
        },
      },
    };
  }
}