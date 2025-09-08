/**
 * SAML Metadata Service
 * Generates and manages SAML Service Provider metadata
 */

import * as winston from 'winston';
import * as xmlbuilder from 'xmlbuilder';
import { CertificateService, SAMLCertificate } from './certificate.service';

export interface SPMetadataOptions {
  entityId: string;
  baseUrl: string;
  organizationId: string;
  organizationName?: string;
  contactEmail?: string;
  supportedNameIdFormats?: string[];
  wantAssertionsSigned?: boolean;
  authnRequestsSigned?: boolean;
}

export interface MetadataEndpoint {
  binding: string;
  location: string;
  index?: number;
  isDefault?: boolean;
}

export class MetadataService {
  private logger: winston.Logger;
  private certificateService: CertificateService;

  constructor(logger: winston.Logger, certificateService: CertificateService) {
    this.logger = logger;
    this.certificateService = certificateService;
  }

  /**
   * Generate complete SP metadata XML
   */
  async generateSPMetadata(options: SPMetadataOptions): Promise<string> {
    try {
      this.logger.info('Generating SP metadata', {
        entity_id: options.entityId,
        organization_id: options.organizationId,
      });

      // Get signing certificate
      const signingCert = await this.certificateService.getActiveCertificate(
        options.organizationId,
        'signing'
      );

      if (!signingCert) {
        throw new Error('No active signing certificate found for organization');
      }

      // Get encryption certificate (optional)
      const encryptionCert = await this.certificateService.getActiveCertificate(
        options.organizationId,
        'encryption'
      );

      const validUntil = new Date();
      validUntil.setFullYear(validUntil.getFullYear() + 1); // Valid for 1 year

      // Create metadata XML
      const metadata = xmlbuilder
        .create('md:EntityDescriptor', { encoding: 'UTF-8' })
        .att('xmlns:md', 'urn:oasis:names:tc:SAML:2.0:metadata')
        .att('xmlns:ds', 'http://www.w3.org/2000/09/xmldsig#')
        .att('entityID', options.entityId)
        .att('validUntil', validUntil.toISOString());

      // Add SP SSO Descriptor
      const spssoDescriptor = metadata
        .ele('md:SPSSODescriptor')
        .att('protocolSupportEnumeration', 'urn:oasis:names:tc:SAML:2.0:protocol')
        .att('AuthnRequestsSigned', options.authnRequestsSigned !== false ? 'true' : 'false')
        .att('WantAssertionsSigned', options.wantAssertionsSigned !== false ? 'true' : 'false');

      // Add key descriptors
      this.addKeyDescriptor(spssoDescriptor, 'signing', signingCert);
      
      if (encryptionCert) {
        this.addKeyDescriptor(spssoDescriptor, 'encryption', encryptionCert);
      }

      // Add NameID formats
      const nameIdFormats = options.supportedNameIdFormats || [
        'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
        'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent',
        'urn:oasis:names:tc:SAML:2.0:nameid-format:transient',
      ];

      for (const format of nameIdFormats) {
        spssoDescriptor.ele('md:NameIDFormat', format);
      }

      // Add Assertion Consumer Service endpoints
      this.addAssertionConsumerServices(spssoDescriptor, options);

      // Add Single Logout Service endpoints
      this.addSingleLogoutServices(spssoDescriptor, options);

      // Add organization information if provided
      if (options.organizationName || options.contactEmail) {
        this.addOrganizationInfo(metadata, options);
      }

      const metadataXml = metadata.end({ pretty: true });

      this.logger.info('SP metadata generated successfully', {
        entity_id: options.entityId,
        organization_id: options.organizationId,
        metadata_length: metadataXml.length,
      });

      return metadataXml;
    } catch (error) {
      this.logger.error('Failed to generate SP metadata', {
        entity_id: options.entityId,
        organization_id: options.organizationId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Parse IdP metadata from XML
   */
  async parseIdPMetadata(metadataXml: string): Promise<{
    entityId: string;
    ssoUrl?: string;
    sloUrl?: string;
    certificates: Array<{ use: string; certificate: string }>;
    nameIdFormats: string[];
  }> {
    try {
      // This is a simplified implementation
      // In production, use a proper XML parser with namespace support
      const xml2js = require('xml2js');
      const parser = new xml2js.Parser();
      const parsed = await parser.parseStringPromise(metadataXml);

      const entityDescriptor = parsed.EntityDescriptor || parsed['md:EntityDescriptor'];
      if (!entityDescriptor) {
        throw new Error('Invalid IdP metadata: EntityDescriptor not found');
      }

      const entityId = entityDescriptor.$?.entityID;
      if (!entityId) {
        throw new Error('Invalid IdP metadata: entityID not found');
      }

      const idpssoDescriptor = entityDescriptor.IDPSSODescriptor || entityDescriptor['md:IDPSSODescriptor'];
      if (!idpssoDescriptor || !Array.isArray(idpssoDescriptor)) {
        throw new Error('Invalid IdP metadata: IDPSSODescriptor not found');
      }

      const descriptor = idpssoDescriptor[0];

      // Extract SSO URL
      let ssoUrl: string | undefined;
      const ssoServices = descriptor.SingleSignOnService || descriptor['md:SingleSignOnService'];
      if (ssoServices && Array.isArray(ssoServices)) {
        const httpPostService = ssoServices.find((service: any) => 
          service.$?.Binding === 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST' ||
          service.$?.Binding === 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect'
        );
        ssoUrl = httpPostService?.$?.Location;
      }

      // Extract SLO URL
      let sloUrl: string | undefined;
      const sloServices = descriptor.SingleLogoutService || descriptor['md:SingleLogoutService'];
      if (sloServices && Array.isArray(sloServices)) {
        const httpRedirectService = sloServices.find((service: any) =>
          service.$?.Binding === 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect'
        );
        sloUrl = httpRedirectService?.$?.Location;
      }

      // Extract certificates
      const certificates: Array<{ use: string; certificate: string }> = [];
      const keyDescriptors = descriptor.KeyDescriptor || descriptor['md:KeyDescriptor'];
      if (keyDescriptors && Array.isArray(keyDescriptors)) {
        for (const keyDesc of keyDescriptors) {
          const use = keyDesc.$?.use || 'signing';
          const keyInfo = keyDesc.KeyInfo || keyDesc['ds:KeyInfo'];
          if (keyInfo && Array.isArray(keyInfo)) {
            const x509Data = keyInfo[0].X509Data || keyInfo[0]['ds:X509Data'];
            if (x509Data && Array.isArray(x509Data)) {
              const x509Cert = x509Data[0].X509Certificate || x509Data[0]['ds:X509Certificate'];
              if (x509Cert && Array.isArray(x509Cert) && x509Cert[0]) {
                certificates.push({
                  use,
                  certificate: this.formatCertificate(x509Cert[0]),
                });
              }
            }
          }
        }
      }

      // Extract NameID formats
      const nameIdFormats: string[] = [];
      const nameIdFormatElements = descriptor.NameIDFormat || descriptor['md:NameIDFormat'];
      if (nameIdFormatElements && Array.isArray(nameIdFormatElements)) {
        for (const format of nameIdFormatElements) {
          if (typeof format === 'string') {
            nameIdFormats.push(format);
          } else if (format._) {
            nameIdFormats.push(format._);
          }
        }
      }

      this.logger.info('IdP metadata parsed successfully', {
        entity_id: entityId,
        has_sso_url: !!ssoUrl,
        has_slo_url: !!sloUrl,
        certificate_count: certificates.length,
        name_id_formats: nameIdFormats.length,
      });

      return {
        entityId,
        ssoUrl,
        sloUrl,
        certificates,
        nameIdFormats,
      };
    } catch (error) {
      this.logger.error('Failed to parse IdP metadata', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Validate metadata XML structure
   */
  validateMetadata(metadataXml: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      // Basic XML validation
      if (!metadataXml || metadataXml.trim().length === 0) {
        errors.push('Metadata XML is empty');
        return { isValid: false, errors };
      }

      // Check for required elements
      if (!metadataXml.includes('EntityDescriptor')) {
        errors.push('EntityDescriptor element not found');
      }

      if (!metadataXml.includes('entityID')) {
        errors.push('entityID attribute not found');
      }

      // Check for either IDPSSODescriptor or SPSSODescriptor
      if (!metadataXml.includes('IDPSSODescriptor') && !metadataXml.includes('SPSSODescriptor')) {
        errors.push('Neither IDPSSODescriptor nor SPSSODescriptor found');
      }

      return {
        isValid: errors.length === 0,
        errors,
      };
    } catch (error) {
      errors.push(`Metadata validation error: ${error.message}`);
      return { isValid: false, errors };
    }
  }

  /**
   * Add key descriptor to metadata
   */
  private addKeyDescriptor(
    parent: any,
    use: 'signing' | 'encryption',
    certificate: SAMLCertificate
  ): void {
    const certData = this.extractCertificateData(certificate.certificate);

    parent
      .ele('md:KeyDescriptor')
      .att('use', use)
      .ele('ds:KeyInfo')
      .ele('ds:X509Data')
      .ele('ds:X509Certificate', certData);
  }

  /**
   * Add Assertion Consumer Service endpoints
   */
  private addAssertionConsumerServices(parent: any, options: SPMetadataOptions): void {
    const acsEndpoints: MetadataEndpoint[] = [
      {
        binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
        location: `${options.baseUrl}/auth/saml/acs`,
        index: 0,
        isDefault: true,
      },
      {
        binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect',
        location: `${options.baseUrl}/auth/saml/acs`,
        index: 1,
        isDefault: false,
      },
    ];

    for (const endpoint of acsEndpoints) {
      const acsElement = parent
        .ele('md:AssertionConsumerService')
        .att('Binding', endpoint.binding)
        .att('Location', endpoint.location)
        .att('index', endpoint.index);

      if (endpoint.isDefault) {
        acsElement.att('isDefault', 'true');
      }
    }
  }

  /**
   * Add Single Logout Service endpoints
   */
  private addSingleLogoutServices(parent: any, options: SPMetadataOptions): void {
    const sloEndpoints: MetadataEndpoint[] = [
      {
        binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect',
        location: `${options.baseUrl}/auth/saml/slo`,
      },
      {
        binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
        location: `${options.baseUrl}/auth/saml/slo`,
      },
    ];

    for (const endpoint of sloEndpoints) {
      parent
        .ele('md:SingleLogoutService')
        .att('Binding', endpoint.binding)
        .att('Location', endpoint.location);
    }
  }

  /**
   * Add organization information
   */
  private addOrganizationInfo(parent: any, options: SPMetadataOptions): void {
    if (options.organizationName) {
      const orgElement = parent.ele('md:Organization');
      orgElement.ele('md:OrganizationName', options.organizationName).att('xml:lang', 'en');
      orgElement.ele('md:OrganizationDisplayName', options.organizationName).att('xml:lang', 'en');
      
      if (options.baseUrl) {
        orgElement.ele('md:OrganizationURL', options.baseUrl).att('xml:lang', 'en');
      }
    }

    if (options.contactEmail) {
      parent
        .ele('md:ContactPerson')
        .att('contactType', 'technical')
        .ele('md:EmailAddress', `mailto:${options.contactEmail}`);
    }
  }

  /**
   * Extract certificate data from PEM format
   */
  private extractCertificateData(certificatePem: string): string {
    return certificatePem
      .replace(/-----BEGIN CERTIFICATE-----/, '')
      .replace(/-----END CERTIFICATE-----/, '')
      .replace(/\s/g, '');
  }

  /**
   * Format certificate data into PEM format
   */
  private formatCertificate(certData: string): string {
    const cleanCert = certData.replace(/\s/g, '');
    return `-----BEGIN CERTIFICATE-----\n${cleanCert.match(/.{1,64}/g)?.join('\n')}\n-----END CERTIFICATE-----`;
  }
}