/**
 * SAML Configuration Service
 * Manages SAML provider configurations for multi-tenant organizations
 */

import * as winston from 'winston';
import { DatabaseConnection } from '../../database/connection';

export interface SAMLConfig {
  id?: string;
  organization_id: string;
  provider: string; // 'okta-saml', 'azure-saml', 'generic-saml'
  entity_id: string; // IdP Entity ID
  sso_url: string; // IdP SSO URL  
  slo_url?: string; // IdP Single Logout URL
  certificate: string; // IdP signing certificate (PEM format)
  name_id_format: string;
  attribute_mapping: AttributeMapping;
  is_active: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export interface AttributeMapping {
  email: string;
  firstName: string;
  lastName: string;
  groups: string[];
  department?: string;
  [key: string]: string | string[] | undefined;
}

export interface SAMLProviderMetadata {
  name: string;
  display_name: string;
  icon_url?: string;
  color: string;
  documentation_url: string;
  supported_features: {
    single_logout: boolean;
    encryption: boolean;
    attribute_mapping: boolean;
  };
}

export class SAMLConfigService {
  private db: DatabaseConnection;
  private logger: winston.Logger;

  constructor(db: DatabaseConnection, logger: winston.Logger) {
    this.db = db;
    this.logger = logger;
  }

  /**
   * Get SAML configuration for organization and provider
   */
  async getSAMLConfig(organizationId: string, provider: string): Promise<SAMLConfig | null> {
    const query = `
      SELECT * FROM saml_configs 
      WHERE organization_id = $1 AND provider = $2 AND is_active = true
    `;

    try {
      const result = await this.db.query(query, [organizationId, provider]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        organization_id: row.organization_id,
        provider: row.provider,
        entity_id: row.entity_id,
        sso_url: row.sso_url,
        slo_url: row.slo_url,
        certificate: row.certificate,
        name_id_format: row.name_id_format,
        attribute_mapping: row.attribute_mapping,
        is_active: row.is_active,
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
    } catch (error) {
      this.logger.error('Failed to get SAML config', {
        organization_id: organizationId,
        provider,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Create or update SAML configuration
   */
  async saveSAMLConfig(config: SAMLConfig): Promise<SAMLConfig> {
    const query = `
      INSERT INTO saml_configs (
        organization_id, provider, entity_id, sso_url, slo_url,
        certificate, name_id_format, attribute_mapping, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (organization_id, provider) DO UPDATE SET
        entity_id = EXCLUDED.entity_id,
        sso_url = EXCLUDED.sso_url,
        slo_url = EXCLUDED.slo_url,
        certificate = EXCLUDED.certificate,
        name_id_format = EXCLUDED.name_id_format,
        attribute_mapping = EXCLUDED.attribute_mapping,
        is_active = EXCLUDED.is_active,
        updated_at = NOW()
      RETURNING *
    `;

    try {
      const result = await this.db.query(query, [
        config.organization_id,
        config.provider,
        config.entity_id,
        config.sso_url,
        config.slo_url,
        config.certificate,
        config.name_id_format,
        JSON.stringify(config.attribute_mapping),
        config.is_active,
      ]);

      const row = result.rows[0];
      const savedConfig: SAMLConfig = {
        id: row.id,
        organization_id: row.organization_id,
        provider: row.provider,
        entity_id: row.entity_id,
        sso_url: row.sso_url,
        slo_url: row.slo_url,
        certificate: row.certificate,
        name_id_format: row.name_id_format,
        attribute_mapping: row.attribute_mapping,
        is_active: row.is_active,
        created_at: row.created_at,
        updated_at: row.updated_at,
      };

      this.logger.info('SAML configuration saved', {
        organization_id: config.organization_id,
        provider: config.provider,
        entity_id: config.entity_id,
      });

      return savedConfig;
    } catch (error) {
      this.logger.error('Failed to save SAML config', {
        organization_id: config.organization_id,
        provider: config.provider,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get all SAML configurations for organization
   */
  async getOrganizationSAMLConfigs(organizationId: string): Promise<SAMLConfig[]> {
    const query = `
      SELECT * FROM saml_configs 
      WHERE organization_id = $1
      ORDER BY provider, created_at
    `;

    try {
      const result = await this.db.query(query, [organizationId]);
      
      return result.rows.map(row => ({
        id: row.id,
        organization_id: row.organization_id,
        provider: row.provider,
        entity_id: row.entity_id,
        sso_url: row.sso_url,
        slo_url: row.slo_url,
        certificate: row.certificate,
        name_id_format: row.name_id_format,
        attribute_mapping: row.attribute_mapping,
        is_active: row.is_active,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));
    } catch (error) {
      this.logger.error('Failed to get organization SAML configs', {
        organization_id: organizationId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Delete SAML configuration
   */
  async deleteSAMLConfig(organizationId: string, provider: string): Promise<boolean> {
    const query = `
      DELETE FROM saml_configs 
      WHERE organization_id = $1 AND provider = $2
    `;

    try {
      const result = await this.db.query(query, [organizationId, provider]);
      
      const deleted = result.rowCount > 0;
      
      if (deleted) {
        this.logger.info('SAML configuration deleted', {
          organization_id: organizationId,
          provider,
        });
      }

      return deleted;
    } catch (error) {
      this.logger.error('Failed to delete SAML config', {
        organization_id: organizationId,
        provider,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Validate SAML configuration
   */
  validateSAMLConfig(config: Partial<SAMLConfig>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Required fields validation
    if (!config.organization_id) {
      errors.push('Organization ID is required');
    }

    if (!config.provider) {
      errors.push('Provider is required');
    }

    if (!config.entity_id) {
      errors.push('Entity ID is required');
    }

    if (!config.sso_url) {
      errors.push('SSO URL is required');
    } else if (!this.isValidUrl(config.sso_url)) {
      errors.push('SSO URL must be a valid HTTPS URL');
    }

    if (config.slo_url && !this.isValidUrl(config.slo_url)) {
      errors.push('SLO URL must be a valid HTTPS URL');
    }

    if (!config.certificate) {
      errors.push('Certificate is required');
    } else if (!this.isValidX509Certificate(config.certificate)) {
      errors.push('Certificate must be a valid X.509 certificate in PEM format');
    }

    if (!config.name_id_format) {
      errors.push('NameID format is required');
    }

    if (!config.attribute_mapping) {
      errors.push('Attribute mapping is required');
    } else {
      const mappingErrors = this.validateAttributeMapping(config.attribute_mapping);
      errors.push(...mappingErrors);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get metadata for supported SAML providers
   */
  getSupportedProviders(): SAMLProviderMetadata[] {
    return [
      {
        name: 'okta-saml',
        display_name: 'Okta SAML',
        icon_url: 'https://www.okta.com/sites/default/files/Dev_Logo-02_Large-thumbnail.png',
        color: '#007dc1',
        documentation_url: 'https://developer.okta.com/docs/concepts/saml/',
        supported_features: {
          single_logout: true,
          encryption: true,
          attribute_mapping: true,
        },
      },
      {
        name: 'azure-saml',
        display_name: 'Azure AD SAML',
        icon_url: 'https://docs.microsoft.com/en-us/azure/active-directory/develop/media/howto-add-branding-in-azure-ad-apps/ms-symbollockup_mssymbol_19.png',
        color: '#0078d4',
        documentation_url: 'https://docs.microsoft.com/en-us/azure/active-directory/develop/single-sign-on-saml-protocol',
        supported_features: {
          single_logout: true,
          encryption: true,
          attribute_mapping: true,
        },
      },
      {
        name: 'generic-saml',
        display_name: 'Generic SAML 2.0',
        color: '#333333',
        documentation_url: 'https://docs.oasis-open.org/security/saml/v2.0/',
        supported_features: {
          single_logout: true,
          encryption: false,
          attribute_mapping: true,
        },
      },
    ];
  }

  /**
   * Get default attribute mappings for providers
   */
  getDefaultAttributeMapping(provider: string): AttributeMapping {
    const defaultMappings = {
      'okta-saml': {
        email: 'email',
        firstName: 'firstName',
        lastName: 'lastName',
        groups: ['groups'],
        department: 'department',
      },
      'azure-saml': {
        email: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
        firstName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
        lastName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
        groups: ['http://schemas.microsoft.com/ws/2008/06/identity/claims/groups'],
        department: 'http://schemas.microsoft.com/ws/2008/06/identity/claims/department',
      },
      'generic-saml': {
        email: 'email',
        firstName: 'givenName',
        lastName: 'sn',
        groups: ['memberOf'],
      },
    };

    return defaultMappings[provider] || defaultMappings['generic-saml'];
  }

  /**
   * Validate URL format
   */
  private isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Validate X.509 certificate format
   */
  private isValidX509Certificate(certificate: string): boolean {
    const pemRegex = /^-----BEGIN CERTIFICATE-----[\s\S]*-----END CERTIFICATE-----$/;
    return pemRegex.test(certificate.trim());
  }

  /**
   * Validate attribute mapping
   */
  private validateAttributeMapping(mapping: AttributeMapping): string[] {
    const errors: string[] = [];

    if (!mapping.email) {
      errors.push('Email attribute mapping is required');
    }

    if (!mapping.firstName) {
      errors.push('First name attribute mapping is required');
    }

    if (!mapping.lastName) {
      errors.push('Last name attribute mapping is required');
    }

    if (!mapping.groups || !Array.isArray(mapping.groups)) {
      errors.push('Groups attribute mapping must be an array');
    }

    return errors;
  }
}