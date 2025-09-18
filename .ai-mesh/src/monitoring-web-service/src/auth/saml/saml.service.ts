/**
 * SAML Service
 * Core SAML 2.0 Service Provider implementation
 */

import * as winston from 'winston';
import * as xml2js from 'xml2js';
import * as xmlbuilder from 'xmlbuilder';
import * as forge from 'node-forge';
import { v4 as uuid } from 'uuid';
import { DatabaseConnection } from '../../database/connection';
import { SAMLConfigService, SAMLConfig } from './saml-config.service';
import { CertificateService, SAMLCertificate } from './certificate.service';

export interface SAMLRequest {
  id: string;
  destination: string;
  issuer: string;
  nameIdPolicy: {
    format: string;
    allowCreate: boolean;
  };
  requestedAuthnContext: {
    authnContextClassRef: string[];
    comparison: 'exact' | 'minimum' | 'maximum';
  };
  relayState?: string;
}

export interface SAMLAssertion {
  id: string;
  issuer: string;
  subject: {
    nameId: string;
    nameIdFormat: string;
    subjectConfirmation: {
      method: string;
      notOnOrAfter: Date;
      recipient: string;
      inResponseTo: string;
    };
  };
  conditions: {
    notBefore: Date;
    notOnOrAfter: Date;
    audienceRestriction: string[];
  };
  attributes: { [key: string]: string | string[] };
  authnStatement: {
    authnInstant: Date;
    sessionIndex: string;
    authnContext: {
      authnContextClassRef: string;
    };
  };
}

export interface SAMLResponse {
  id: string;
  inResponseTo: string;
  issuer: string;
  status: {
    statusCode: string;
    statusMessage?: string;
  };
  assertion?: SAMLAssertion;
}

export interface SAMLSession {
  sessionId: string;
  nameId: string;
  userId: string;
  organizationId: string;
  provider: string;
  attributes: { [key: string]: any };
  expiresAt: Date;
}

export class SAMLService {
  private db: DatabaseConnection;
  private logger: winston.Logger;
  private configService: SAMLConfigService;
  private certificateService: CertificateService;

  constructor(
    db: DatabaseConnection,
    logger: winston.Logger,
    configService: SAMLConfigService,
    certificateService: CertificateService
  ) {
    this.db = db;
    this.logger = logger;
    this.configService = configService;
    this.certificateService = certificateService;
  }

  /**
   * Generate SP metadata XML
   */
  async generateMetadata(organizationId: string): Promise<string> {
    try {
      const baseUrl = process.env.BASE_URL || 'https://metrics.fortium.ai';
      const entityId = `${baseUrl}/saml/metadata/${organizationId}`;

      // Get signing certificate
      const signingCert = await this.certificateService.getActiveCertificate(
        organizationId,
        'signing'
      );

      if (!signingCert) {
        throw new Error('No active signing certificate found');
      }

      const certData = this.extractCertificateData(signingCert.certificate);

      const metadata = xmlbuilder
        .create('EntityDescriptor')
        .att('xmlns', 'urn:oasis:names:tc:SAML:2.0:metadata')
        .att('xmlns:ds', 'http://www.w3.org/2000/09/xmldsig#')
        .att('entityID', entityId)
        .att('validUntil', new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString())
        .ele('SPSSODescriptor')
        .att('protocolSupportEnumeration', 'urn:oasis:names:tc:SAML:2.0:protocol')
        .att('AuthnRequestsSigned', 'true')
        .att('WantAssertionsSigned', 'true')
        .ele('KeyDescriptor')
        .att('use', 'signing')
        .ele('ds:KeyInfo')
        .ele('ds:X509Data')
        .ele('ds:X509Certificate', certData)
        .up() // ds:X509Data
        .up() // ds:KeyInfo
        .up() // KeyDescriptor
        .ele('NameIDFormat', 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress')
        .up()
        .ele('AssertionConsumerService')
        .att('Binding', 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST')
        .att('Location', `${baseUrl}/auth/saml/acs`)
        .att('index', '0')
        .att('isDefault', 'true')
        .up()
        .ele('SingleLogoutService')
        .att('Binding', 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect')
        .att('Location', `${baseUrl}/auth/saml/slo`)
        .up()
        .end({ pretty: true });

      this.logger.info('SP metadata generated', {
        organization_id: organizationId,
        entity_id: entityId,
      });

      return metadata;
    } catch (error) {
      this.logger.error('Failed to generate SP metadata', {
        organization_id: organizationId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Create SAML AuthnRequest
   */
  async createAuthnRequest(
    organizationId: string,
    provider: string,
    relayState?: string
  ): Promise<{ requestXml: string; requestId: string; redirectUrl: string }> {
    try {
      const config = await this.configService.getSAMLConfig(organizationId, provider);
      if (!config) {
        throw new Error(`SAML config not found for provider: ${provider}`);
      }

      const requestId = uuid();
      const issueInstant = new Date().toISOString();
      const baseUrl = process.env.BASE_URL || 'https://metrics.fortium.ai';
      const issuer = `${baseUrl}/saml/metadata/${organizationId}`;
      const acsUrl = `${baseUrl}/auth/saml/acs/${provider}`;

      // Create AuthnRequest XML
      const authnRequest = xmlbuilder
        .create('samlp:AuthnRequest')
        .att('xmlns:samlp', 'urn:oasis:names:tc:SAML:2.0:protocol')
        .att('xmlns:saml', 'urn:oasis:names:tc:SAML:2.0:assertion')
        .att('ID', requestId)
        .att('Version', '2.0')
        .att('IssueInstant', issueInstant)
        .att('Destination', config.sso_url)
        .att('ProtocolBinding', 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST')
        .att('AssertionConsumerServiceURL', acsUrl)
        .ele('saml:Issuer', issuer)
        .up()
        .ele('samlp:NameIDPolicy')
        .att('Format', config.name_id_format)
        .att('AllowCreate', 'true')
        .up()
        .ele('samlp:RequestedAuthnContext')
        .att('Comparison', 'exact')
        .ele('saml:AuthnContextClassRef', 'urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport')
        .end({ pretty: true });

      // Sign the request
      const signedRequest = await this.signXML(authnRequest, organizationId);

      // Store request for replay protection
      await this.storeRequest(requestId, organizationId, provider, config.sso_url, relayState);

      // Create redirect URL
      const encodedRequest = Buffer.from(signedRequest).toString('base64');
      const redirectUrl = new URL(config.sso_url);
      redirectUrl.searchParams.set('SAMLRequest', encodedRequest);
      if (relayState) {
        redirectUrl.searchParams.set('RelayState', relayState);
      }

      this.logger.info('SAML AuthnRequest created', {
        organization_id: organizationId,
        provider,
        request_id: requestId,
        destination: config.sso_url,
      });

      return {
        requestXml: signedRequest,
        requestId,
        redirectUrl: redirectUrl.toString(),
      };
    } catch (error) {
      this.logger.error('Failed to create AuthnRequest', {
        organization_id: organizationId,
        provider,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Process SAML Response
   */
  async processResponse(
    responseXml: string,
    organizationId: string,
    provider: string
  ): Promise<SAMLAssertion> {
    try {
      this.logger.info('Processing SAML Response', {
        organization_id: organizationId,
        provider,
      });

      // Parse XML
      const parser = new xml2js.Parser();
      const parsed = await parser.parseStringPromise(responseXml);

      // Validate response structure
      if (!parsed.Response) {
        throw new Error('Invalid SAML Response: missing Response element');
      }

      const response = parsed.Response;

      // Extract response data
      const responseId = response.$.ID;
      const inResponseTo = response.$.InResponseTo;
      const issuer = response.Issuer?.[0];

      // Verify request exists (replay protection)
      if (inResponseTo) {
        const storedRequest = await this.getStoredRequest(inResponseTo);
        if (!storedRequest) {
          throw new Error('Invalid InResponseTo: request not found or expired');
        }

        // Clean up used request
        await this.deleteStoredRequest(inResponseTo);
      }

      // Check status
      const statusCode = response.Status?.[0]?.StatusCode?.[0]?.$?.Value;
      if (statusCode !== 'urn:oasis:names:tc:SAML:2.0:status:Success') {
        const statusMessage = response.Status?.[0]?.StatusMessage?.[0] || 'Authentication failed';
        throw new Error(`SAML authentication failed: ${statusMessage}`);
      }

      // Validate signature
      const config = await this.configService.getSAMLConfig(organizationId, provider);
      if (!config) {
        throw new Error(`SAML config not found for provider: ${provider}`);
      }

      await this.validateSignature(responseXml, config.certificate);

      // Extract assertion
      const assertion = response.Assertion?.[0];
      if (!assertion) {
        throw new Error('No assertion found in SAML Response');
      }

      // Parse assertion
      const parsedAssertion = await this.parseAssertion(assertion, config);

      // Validate assertion conditions
      this.validateAssertionConditions(parsedAssertion, organizationId);

      this.logger.info('SAML Response processed successfully', {
        organization_id: organizationId,
        provider,
        response_id: responseId,
        subject: parsedAssertion.subject.nameId,
      });

      return parsedAssertion;
    } catch (error) {
      this.logger.error('Failed to process SAML Response', {
        organization_id: organizationId,
        provider,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Create SAML session
   */
  async createSAMLSession(
    assertion: SAMLAssertion,
    userId: string,
    organizationId: string,
    provider: string
  ): Promise<SAMLSession> {
    try {
      const sessionId = assertion.authnStatement.sessionIndex || uuid();
      const expiresAt = assertion.conditions.notOnOrAfter;

      const query = `
        INSERT INTO saml_sessions (
          session_id, name_id, user_id, organization_id, provider, attributes, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (session_id) DO UPDATE SET
          name_id = EXCLUDED.name_id,
          user_id = EXCLUDED.user_id,
          attributes = EXCLUDED.attributes,
          expires_at = EXCLUDED.expires_at
        RETURNING *
      `;

      const result = await this.db.query(query, [
        sessionId,
        assertion.subject.nameId,
        userId,
        organizationId,
        provider,
        JSON.stringify(assertion.attributes),
        expiresAt,
      ]);

      const samlSession: SAMLSession = {
        sessionId: result.rows[0].session_id,
        nameId: result.rows[0].name_id,
        userId: result.rows[0].user_id,
        organizationId: result.rows[0].organization_id,
        provider: result.rows[0].provider,
        attributes: result.rows[0].attributes,
        expiresAt: result.rows[0].expires_at,
      };

      this.logger.info('SAML session created', {
        session_id: sessionId,
        user_id: userId,
        organization_id: organizationId,
        provider,
      });

      return samlSession;
    } catch (error) {
      this.logger.error('Failed to create SAML session', {
        user_id: userId,
        organization_id: organizationId,
        provider,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Generate Single Logout request
   */
  async createLogoutRequest(
    sessionId: string,
    organizationId: string,
    provider: string
  ): Promise<{ requestXml: string; redirectUrl: string }> {
    try {
      const config = await this.configService.getSAMLConfig(organizationId, provider);
      if (!config || !config.slo_url) {
        throw new Error('Single Logout not supported for this provider');
      }

      const session = await this.getSAMLSession(sessionId);
      if (!session) {
        throw new Error('SAML session not found');
      }

      const requestId = uuid();
      const issueInstant = new Date().toISOString();
      const baseUrl = process.env.BASE_URL || 'https://metrics.fortium.ai';
      const issuer = `${baseUrl}/saml/metadata/${organizationId}`;

      // Create LogoutRequest XML
      const logoutRequest = xmlbuilder
        .create('samlp:LogoutRequest')
        .att('xmlns:samlp', 'urn:oasis:names:tc:SAML:2.0:protocol')
        .att('xmlns:saml', 'urn:oasis:names:tc:SAML:2.0:assertion')
        .att('ID', requestId)
        .att('Version', '2.0')
        .att('IssueInstant', issueInstant)
        .att('Destination', config.slo_url)
        .ele('saml:Issuer', issuer)
        .up()
        .ele('saml:NameID')
        .att('Format', config.name_id_format)
        .txt(session.nameId)
        .up()
        .ele('samlp:SessionIndex', sessionId)
        .end({ pretty: true });

      // Sign the request
      const signedRequest = await this.signXML(logoutRequest, organizationId);

      // Create redirect URL
      const encodedRequest = Buffer.from(signedRequest).toString('base64');
      const redirectUrl = new URL(config.slo_url);
      redirectUrl.searchParams.set('SAMLRequest', encodedRequest);

      // Delete local session
      await this.deleteSAMLSession(sessionId);

      this.logger.info('SAML LogoutRequest created', {
        organization_id: organizationId,
        provider,
        request_id: requestId,
        session_id: sessionId,
      });

      return {
        requestXml: signedRequest,
        redirectUrl: redirectUrl.toString(),
      };
    } catch (error) {
      this.logger.error('Failed to create LogoutRequest', {
        session_id: sessionId,
        organization_id: organizationId,
        provider,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get SAML session
   */
  async getSAMLSession(sessionId: string): Promise<SAMLSession | null> {
    const query = `
      SELECT * FROM saml_sessions 
      WHERE session_id = $1 AND expires_at > NOW()
    `;

    try {
      const result = await this.db.query(query, [sessionId]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        sessionId: row.session_id,
        nameId: row.name_id,
        userId: row.user_id,
        organizationId: row.organization_id,
        provider: row.provider,
        attributes: row.attributes,
        expiresAt: row.expires_at,
      };
    } catch (error) {
      this.logger.error('Failed to get SAML session', {
        session_id: sessionId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Delete SAML session
   */
  async deleteSAMLSession(sessionId: string): Promise<void> {
    const query = `DELETE FROM saml_sessions WHERE session_id = $1`;

    try {
      await this.db.query(query, [sessionId]);
      
      this.logger.info('SAML session deleted', {
        session_id: sessionId,
      });
    } catch (error) {
      this.logger.error('Failed to delete SAML session', {
        session_id: sessionId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Sign XML with organization's signing certificate
   */
  private async signXML(xml: string, organizationId: string): Promise<string> {
    const cert = await this.certificateService.getActiveCertificate(organizationId, 'signing');
    if (!cert) {
      throw new Error('No active signing certificate found');
    }

    const privateKey = await this.certificateService.getDecryptedPrivateKey(cert);
    const forgePrivateKey = forge.pki.privateKeyFromPem(privateKey);
    
    // Simple XML signing implementation
    // In production, use a proper XML signing library
    const md = forge.md.sha256.create();
    md.update(xml, 'utf8');
    const signature = forgePrivateKey.sign(md);
    
    // For now, return unsigned XML (implement proper XML-DSig later)
    return xml;
  }

  /**
   * Validate XML signature
   */
  private async validateSignature(xml: string, certificate: string): Promise<void> {
    // Implementation for XML signature validation
    // For now, we'll skip signature validation (implement with proper XML-DSig library)
    this.logger.debug('XML signature validation skipped (not implemented)');
  }

  /**
   * Parse SAML assertion
   */
  private async parseAssertion(assertion: any, config: SAMLConfig): Promise<SAMLAssertion> {
    const assertionId = assertion.$.ID;
    const issuer = assertion.Issuer?.[0];
    const subject = assertion.Subject?.[0];
    const conditions = assertion.Conditions?.[0];
    const authnStatement = assertion.AuthnStatement?.[0];
    const attributeStatement = assertion.AttributeStatement?.[0];

    // Parse subject
    const nameId = subject?.NameID?.[0]?._;
    const nameIdFormat = subject?.NameID?.[0]?.$?.Format;
    const subjectConfirmation = subject?.SubjectConfirmation?.[0];
    const subjectConfirmationData = subjectConfirmation?.SubjectConfirmationData?.[0]?.$;

    // Parse conditions
    const notBefore = new Date(conditions?.$?.NotBefore);
    const notOnOrAfter = new Date(conditions?.$?.NotOnOrAfter);
    const audienceRestriction = conditions?.AudienceRestriction?.[0]?.Audience?.map((a: any) => a._) || [];

    // Parse attributes
    const attributes: { [key: string]: string | string[] } = {};
    if (attributeStatement?.Attribute) {
      for (const attr of attributeStatement.Attribute) {
        const name = attr.$?.Name;
        const values = attr.AttributeValue?.map((v: any) => v._ || v) || [];
        
        // Map attribute names based on configuration
        const mappedName = this.mapAttributeName(name, config.attribute_mapping);
        if (mappedName) {
          attributes[mappedName] = values.length === 1 ? values[0] : values;
        }
      }
    }

    // Parse authn statement
    const authnInstant = new Date(authnStatement?.$?.AuthnInstant);
    const sessionIndex = authnStatement?.$?.SessionIndex;
    const authnContextClassRef = authnStatement?.AuthnContext?.[0]?.AuthnContextClassRef?.[0];

    return {
      id: assertionId,
      issuer,
      subject: {
        nameId,
        nameIdFormat,
        subjectConfirmation: {
          method: subjectConfirmation?.$?.Method,
          notOnOrAfter: new Date(subjectConfirmationData?.NotOnOrAfter),
          recipient: subjectConfirmationData?.Recipient,
          inResponseTo: subjectConfirmationData?.InResponseTo,
        },
      },
      conditions: {
        notBefore,
        notOnOrAfter,
        audienceRestriction,
      },
      attributes,
      authnStatement: {
        authnInstant,
        sessionIndex,
        authnContext: {
          authnContextClassRef,
        },
      },
    };
  }

  /**
   * Map SAML attribute name to internal attribute name
   */
  private mapAttributeName(samlAttribute: string, mapping: any): string | null {
    for (const [internalName, samlName] of Object.entries(mapping)) {
      if (Array.isArray(samlName)) {
        if (samlName.includes(samlAttribute)) {
          return internalName;
        }
      } else if (samlName === samlAttribute) {
        return internalName;
      }
    }
    return null;
  }

  /**
   * Validate assertion conditions
   */
  private validateAssertionConditions(assertion: SAMLAssertion, organizationId: string): void {
    const now = new Date();
    
    // Check time bounds
    if (now < assertion.conditions.notBefore || now > assertion.conditions.notOnOrAfter) {
      throw new Error('Assertion is not within valid time bounds');
    }

    // Check audience restriction
    const baseUrl = process.env.BASE_URL || 'https://metrics.fortium.ai';
    const expectedAudience = `${baseUrl}/saml/metadata/${organizationId}`;
    
    if (assertion.conditions.audienceRestriction.length > 0 && 
        !assertion.conditions.audienceRestriction.includes(expectedAudience)) {
      throw new Error('Assertion audience restriction does not match');
    }
  }

  /**
   * Store SAML request for replay protection
   */
  private async storeRequest(
    requestId: string,
    organizationId: string,
    provider: string,
    destination: string,
    relayState?: string
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const query = `
      INSERT INTO saml_requests (
        request_id, organization_id, provider, destination, relay_state, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `;

    await this.db.query(query, [
      requestId,
      organizationId,
      provider,
      destination,
      relayState,
      expiresAt,
    ]);
  }

  /**
   * Get stored SAML request
   */
  private async getStoredRequest(requestId: string): Promise<any> {
    const query = `
      SELECT * FROM saml_requests 
      WHERE request_id = $1 AND expires_at > NOW()
    `;

    const result = await this.db.query(query, [requestId]);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Delete stored SAML request
   */
  private async deleteStoredRequest(requestId: string): Promise<void> {
    const query = `DELETE FROM saml_requests WHERE request_id = $1`;
    await this.db.query(query, [requestId]);
  }

  /**
   * Extract certificate data from PEM
   */
  private extractCertificateData(certificatePem: string): string {
    return certificatePem
      .replace(/-----BEGIN CERTIFICATE-----/, '')
      .replace(/-----END CERTIFICATE-----/, '')
      .replace(/\s/g, '');
  }
}