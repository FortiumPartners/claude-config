/**
 * SAML Configuration Service Tests
 * Unit tests for SAMLConfigService
 */

import { SAMLConfigService, SAMLConfig, AttributeMapping } from '../../../auth/saml/saml-config.service';
import { DatabaseConnection } from '../../../database/connection';
import * as winston from 'winston';

// Mock database connection
const mockDb = {
  query: jest.fn(),
} as any as DatabaseConnection;

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
} as any as winston.Logger;

describe('SAMLConfigService', () => {
  let service: SAMLConfigService;

  beforeEach(() => {
    service = new SAMLConfigService(mockDb, mockLogger);
    jest.clearAllMocks();
  });

  describe('getSAMLConfig', () => {
    it('should return SAML config when found', async () => {
      const mockConfig = {
        id: 'config-id',
        organization_id: 'org-id',
        provider: 'okta-saml',
        entity_id: 'https://dev-12345.okta.com/app/entity-id',
        sso_url: 'https://dev-12345.okta.com/app/sso/saml',
        slo_url: 'https://dev-12345.okta.com/app/slo/saml',
        certificate: '-----BEGIN CERTIFICATE-----\nMIIC...\n-----END CERTIFICATE-----',
        name_id_format: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
        attribute_mapping: {
          email: 'email',
          firstName: 'firstName',
          lastName: 'lastName',
          groups: ['groups'],
        },
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.query.mockResolvedValue({ rows: [mockConfig] });

      const result = await service.getSAMLConfig('org-id', 'okta-saml');

      expect(result).toEqual(mockConfig);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM saml_configs'),
        ['org-id', 'okta-saml']
      );
    });

    it('should return null when config not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await service.getSAMLConfig('org-id', 'nonexistent');

      expect(result).toBeNull();
    });

    it('should throw error on database failure', async () => {
      mockDb.query.mockRejectedValue(new Error('Database error'));

      await expect(service.getSAMLConfig('org-id', 'okta-saml')).rejects.toThrow('Database error');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('saveSAMLConfig', () => {
    it('should save new SAML config successfully', async () => {
      const configData: SAMLConfig = {
        organization_id: 'org-id',
        provider: 'okta-saml',
        entity_id: 'https://dev-12345.okta.com/app/entity-id',
        sso_url: 'https://dev-12345.okta.com/app/sso/saml',
        certificate: '-----BEGIN CERTIFICATE-----\nMIIC...\n-----END CERTIFICATE-----',
        name_id_format: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
        attribute_mapping: {
          email: 'email',
          firstName: 'firstName',
          lastName: 'lastName',
          groups: ['groups'],
        },
        is_active: true,
      };

      const savedConfig = {
        ...configData,
        id: 'generated-id',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.query.mockResolvedValue({ rows: [savedConfig] });

      const result = await service.saveSAMLConfig(configData);

      expect(result).toEqual(savedConfig);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO saml_configs'),
        expect.arrayContaining([
          configData.organization_id,
          configData.provider,
          configData.entity_id,
          configData.sso_url,
          configData.slo_url,
          configData.certificate,
          configData.name_id_format,
          JSON.stringify(configData.attribute_mapping),
          configData.is_active,
        ])
      );
      expect(mockLogger.info).toHaveBeenCalledWith('SAML configuration saved', expect.any(Object));
    });
  });

  describe('validateSAMLConfig', () => {
    it('should validate valid SAML config', () => {
      const validConfig: Partial<SAMLConfig> = {
        organization_id: 'org-id',
        provider: 'okta-saml',
        entity_id: 'https://dev-12345.okta.com/app/entity-id',
        sso_url: 'https://dev-12345.okta.com/app/sso/saml',
        certificate: '-----BEGIN CERTIFICATE-----\nMIIC...\n-----END CERTIFICATE-----',
        name_id_format: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
        attribute_mapping: {
          email: 'email',
          firstName: 'firstName',
          lastName: 'lastName',
          groups: ['groups'],
        },
      };

      const result = service.validateSAMLConfig(validConfig);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject config with missing required fields', () => {
      const invalidConfig: Partial<SAMLConfig> = {
        provider: 'okta-saml',
      };

      const result = service.validateSAMLConfig(invalidConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Organization ID is required');
      expect(result.errors).toContain('Entity ID is required');
      expect(result.errors).toContain('SSO URL is required');
      expect(result.errors).toContain('Certificate is required');
      expect(result.errors).toContain('NameID format is required');
      expect(result.errors).toContain('Attribute mapping is required');
    });

    it('should reject config with invalid URLs', () => {
      const invalidConfig: Partial<SAMLConfig> = {
        organization_id: 'org-id',
        provider: 'okta-saml',
        entity_id: 'invalid-entity-id',
        sso_url: 'http://insecure-url.com', // HTTP instead of HTTPS
        slo_url: 'not-a-url',
        certificate: '-----BEGIN CERTIFICATE-----\nMIIC...\n-----END CERTIFICATE-----',
        name_id_format: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
        attribute_mapping: {
          email: 'email',
          firstName: 'firstName',
          lastName: 'lastName',
          groups: ['groups'],
        },
      };

      const result = service.validateSAMLConfig(invalidConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('SSO URL must be a valid HTTPS URL');
      expect(result.errors).toContain('SLO URL must be a valid HTTPS URL');
    });

    it('should reject config with invalid certificate format', () => {
      const invalidConfig: Partial<SAMLConfig> = {
        organization_id: 'org-id',
        provider: 'okta-saml',
        entity_id: 'https://dev-12345.okta.com/app/entity-id',
        sso_url: 'https://dev-12345.okta.com/app/sso/saml',
        certificate: 'invalid-certificate',
        name_id_format: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
        attribute_mapping: {
          email: 'email',
          firstName: 'firstName',
          lastName: 'lastName',
          groups: ['groups'],
        },
      };

      const result = service.validateSAMLConfig(invalidConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Certificate must be a valid X.509 certificate in PEM format');
    });

    it('should reject config with incomplete attribute mapping', () => {
      const invalidConfig: Partial<SAMLConfig> = {
        organization_id: 'org-id',
        provider: 'okta-saml',
        entity_id: 'https://dev-12345.okta.com/app/entity-id',
        sso_url: 'https://dev-12345.okta.com/app/sso/saml',
        certificate: '-----BEGIN CERTIFICATE-----\nMIIC...\n-----END CERTIFICATE-----',
        name_id_format: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
        attribute_mapping: {
          email: '',
          firstName: '',
          lastName: '',
          groups: 'not-an-array' as any,
        },
      };

      const result = service.validateSAMLConfig(invalidConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Email attribute mapping is required');
      expect(result.errors).toContain('First name attribute mapping is required');
      expect(result.errors).toContain('Last name attribute mapping is required');
      expect(result.errors).toContain('Groups attribute mapping must be an array');
    });
  });

  describe('getSupportedProviders', () => {
    it('should return supported SAML providers', () => {
      const providers = service.getSupportedProviders();

      expect(providers).toHaveLength(3);
      expect(providers.map(p => p.name)).toContain('okta-saml');
      expect(providers.map(p => p.name)).toContain('azure-saml');
      expect(providers.map(p => p.name)).toContain('generic-saml');

      providers.forEach(provider => {
        expect(provider).toHaveProperty('display_name');
        expect(provider).toHaveProperty('color');
        expect(provider).toHaveProperty('documentation_url');
        expect(provider).toHaveProperty('supported_features');
      });
    });
  });

  describe('getDefaultAttributeMapping', () => {
    it('should return correct mapping for Okta SAML', () => {
      const mapping = service.getDefaultAttributeMapping('okta-saml');

      expect(mapping).toEqual({
        email: 'email',
        firstName: 'firstName',
        lastName: 'lastName',
        groups: ['groups'],
        department: 'department',
      });
    });

    it('should return correct mapping for Azure SAML', () => {
      const mapping = service.getDefaultAttributeMapping('azure-saml');

      expect(mapping).toEqual({
        email: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
        firstName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
        lastName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
        groups: ['http://schemas.microsoft.com/ws/2008/06/identity/claims/groups'],
        department: 'http://schemas.microsoft.com/ws/2008/06/identity/claims/department',
      });
    });

    it('should return generic mapping for unknown provider', () => {
      const mapping = service.getDefaultAttributeMapping('unknown-provider');

      expect(mapping).toEqual({
        email: 'email',
        firstName: 'givenName',
        lastName: 'sn',
        groups: ['memberOf'],
      });
    });
  });

  describe('deleteSAMLConfig', () => {
    it('should delete SAML config successfully', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 1 });

      const result = await service.deleteSAMLConfig('org-id', 'okta-saml');

      expect(result).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        'DELETE FROM saml_configs WHERE organization_id = $1 AND provider = $2',
        ['org-id', 'okta-saml']
      );
      expect(mockLogger.info).toHaveBeenCalledWith('SAML configuration deleted', expect.any(Object));
    });

    it('should return false when config not found', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 0 });

      const result = await service.deleteSAMLConfig('org-id', 'nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('getOrganizationSAMLConfigs', () => {
    it('should return all SAML configs for organization', async () => {
      const mockConfigs = [
        {
          id: 'config-1',
          organization_id: 'org-id',
          provider: 'okta-saml',
          entity_id: 'https://dev-12345.okta.com/app/entity-id',
          sso_url: 'https://dev-12345.okta.com/app/sso/saml',
          certificate: '-----BEGIN CERTIFICATE-----\nMIIC...\n-----END CERTIFICATE-----',
          name_id_format: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
          attribute_mapping: { email: 'email', firstName: 'firstName', lastName: 'lastName', groups: ['groups'] },
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 'config-2',
          organization_id: 'org-id',
          provider: 'azure-saml',
          entity_id: 'https://sts.windows.net/tenant-id/',
          sso_url: 'https://login.microsoftonline.com/tenant-id/saml2',
          certificate: '-----BEGIN CERTIFICATE-----\nMIIC...\n-----END CERTIFICATE-----',
          name_id_format: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
          attribute_mapping: { 
            email: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
            firstName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
            lastName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
            groups: ['http://schemas.microsoft.com/ws/2008/06/identity/claims/groups'],
          },
          is_active: false,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockDb.query.mockResolvedValue({ rows: mockConfigs });

      const result = await service.getOrganizationSAMLConfigs('org-id');

      expect(result).toHaveLength(2);
      expect(result[0].provider).toBe('okta-saml');
      expect(result[1].provider).toBe('azure-saml');
    });
  });
});