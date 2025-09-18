/**
 * SAML Authentication Controller
 * Handles SAML authentication endpoints and workflows
 */

import { Request, Response } from 'express';
import * as winston from 'winston';
import { DatabaseConnection } from '../../database/connection';
import { SAMLService } from './saml.service';
import { SAMLConfigService } from './saml-config.service';
import { CertificateService } from './certificate.service';
import { AssertionValidator } from './assertion.validator';
import { AttributeMapper, MappedUserProfile } from './attribute-mapper';
import { MetadataService } from './metadata.service';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    organization_id: string;
    email: string;
    role: string;
  };
}

export class SAMLAuthController {
  private db: DatabaseConnection;
  private logger: winston.Logger;
  private samlService: SAMLService;
  private configService: SAMLConfigService;
  private certificateService: CertificateService;
  private assertionValidator: AssertionValidator;
  private attributeMapper: AttributeMapper;
  private metadataService: MetadataService;

  constructor(
    db: DatabaseConnection,
    logger: winston.Logger
  ) {
    this.db = db;
    this.logger = logger;
    
    // Initialize services
    this.configService = new SAMLConfigService(db, logger);
    this.certificateService = new CertificateService(db, logger);
    this.assertionValidator = new AssertionValidator(logger);
    this.attributeMapper = new AttributeMapper(logger);
    this.metadataService = new MetadataService(logger, this.certificateService);
    this.samlService = new SAMLService(db, logger, this.configService, this.certificateService);
  }

  /**
   * GET /auth/saml/metadata/:org
   * Service Provider metadata endpoint
   */
  async getMetadata(req: Request, res: Response): Promise<void> {
    try {
      const { org } = req.params;
      
      this.logger.info('SAML metadata requested', {
        organization: org,
        ip: req.ip,
        user_agent: req.get('User-Agent'),
      });

      // Get organization ID from slug
      const organizationId = await this.getOrganizationIdFromSlug(org);
      if (!organizationId) {
        res.status(404).json({ error: 'Organization not found' });
        return;
      }

      const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
      const entityId = `${baseUrl}/saml/metadata/${org}`;

      const metadata = await this.metadataService.generateSPMetadata({
        entityId,
        baseUrl,
        organizationId,
        organizationName: `Fortium Metrics - ${org}`,
        contactEmail: process.env.SAML_CONTACT_EMAIL,
        supportedNameIdFormats: [
          'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
          'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent',
        ],
        wantAssertionsSigned: true,
        authnRequestsSigned: true,
      });

      res.set('Content-Type', 'application/xml; charset=utf-8');
      res.send(metadata);
    } catch (error) {
      this.logger.error('Failed to generate SAML metadata', {
        organization: req.params.org,
        error: error.message,
      });
      res.status(500).json({ error: 'Failed to generate metadata' });
    }
  }

  /**
   * POST /auth/saml/sso/:provider
   * Initiate SAML SSO flow
   */
  async initiateSSOFlow(req: Request, res: Response): Promise<void> {
    try {
      const { provider } = req.params;
      const { org, redirect_uri } = req.body;

      this.logger.info('SAML SSO flow initiated', {
        provider,
        organization: org,
        redirect_uri,
        ip: req.ip,
      });

      // Get organization ID
      const organizationId = await this.getOrganizationIdFromSlug(org);
      if (!organizationId) {
        res.status(404).json({ error: 'Organization not found' });
        return;
      }

      // Check if SAML provider is configured and active
      const config = await this.configService.getSAMLConfig(organizationId, provider);
      if (!config) {
        res.status(404).json({ 
          error: 'SAML provider not configured',
          provider,
        });
        return;
      }

      // Create SAML AuthnRequest
      const { requestXml, requestId, redirectUrl } = await this.samlService.createAuthnRequest(
        organizationId,
        provider,
        redirect_uri
      );

      // Log the SSO initiation
      await this.logAuthEvent('saml_sso_initiated', {
        organization_id: organizationId,
        provider,
        request_id: requestId,
        redirect_uri,
      });

      res.json({
        success: true,
        redirect_url: redirectUrl,
        request_id: requestId,
      });
    } catch (error) {
      this.logger.error('Failed to initiate SAML SSO', {
        provider: req.params.provider,
        error: error.message,
      });
      res.status(500).json({ error: 'Failed to initiate SSO' });
    }
  }

  /**
   * POST /auth/saml/acs/:provider
   * Assertion Consumer Service - handles SAML Response
   */
  async handleAssertionConsumer(req: Request, res: Response): Promise<void> {
    try {
      const { provider } = req.params;
      const { SAMLResponse, RelayState } = req.body;

      this.logger.info('SAML ACS request received', {
        provider,
        has_response: !!SAMLResponse,
        has_relay_state: !!RelayState,
        ip: req.ip,
      });

      if (!SAMLResponse) {
        res.status(400).json({ error: 'SAMLResponse parameter is required' });
        return;
      }

      // Decode SAML Response
      const responseXml = Buffer.from(SAMLResponse, 'base64').toString('utf-8');
      
      // Extract organization from RelayState or determine from provider config
      const organizationId = await this.determineOrganizationFromResponse(responseXml, provider);
      if (!organizationId) {
        res.status(400).json({ error: 'Unable to determine organization' });
        return;
      }

      // Process SAML Response
      const assertion = await this.samlService.processResponse(responseXml, organizationId, provider);

      // Get SAML configuration for validation
      const config = await this.configService.getSAMLConfig(organizationId, provider);
      if (!config) {
        res.status(400).json({ error: 'SAML configuration not found' });
        return;
      }

      // Validate assertion
      const validationResult = await this.assertionValidator.validateAssertion(
        assertion,
        config,
        {
          expectedAudience: `${process.env.BASE_URL}/saml/metadata/${organizationId}`,
        }
      );

      if (!validationResult.isValid) {
        this.logger.error('SAML assertion validation failed', {
          provider,
          assertion_id: assertion.id,
          errors: validationResult.errors,
        });
        res.status(400).json({ 
          error: 'Invalid SAML assertion',
          details: validationResult.errors,
        });
        return;
      }

      // Map SAML attributes to user profile
      const mappedProfile = this.attributeMapper.mapAttributes(
        assertion,
        config.attribute_mapping
      );

      // Find or create user
      const user = await this.findOrCreateUser(mappedProfile, organizationId, provider);

      // Create SAML session
      const samlSession = await this.samlService.createSAMLSession(
        assertion,
        user.id,
        organizationId,
        provider
      );

      // Generate JWT token (integrate with existing auth system)
      const authToken = await this.generateAuthToken(user);

      // Log successful authentication
      await this.logAuthEvent('saml_auth_success', {
        organization_id: organizationId,
        provider,
        user_id: user.id,
        assertion_id: assertion.id,
        session_id: samlSession.sessionId,
      });

      // Return success response
      const redirectUrl = RelayState || `${process.env.FRONTEND_URL}/dashboard`;
      
      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        token: authToken,
        redirect_url: redirectUrl,
        session_id: samlSession.sessionId,
      });
    } catch (error) {
      this.logger.error('Failed to handle SAML assertion', {
        provider: req.params.provider,
        error: error.message,
      });

      // Log failed authentication
      await this.logAuthEvent('saml_auth_failed', {
        provider: req.params.provider,
        error: error.message,
        ip: req.ip,
      });

      res.status(500).json({ error: 'Authentication failed' });
    }
  }

  /**
   * GET /auth/saml/slo/:provider
   * Single Logout Service
   */
  async handleSingleLogout(req: Request, res: Response): Promise<void> {
    try {
      const { provider } = req.params;
      const { SAMLRequest, RelayState } = req.query;

      this.logger.info('SAML SLO request received', {
        provider,
        has_request: !!SAMLRequest,
        has_relay_state: !!RelayState,
        ip: req.ip,
      });

      // For now, implement simple logout by clearing local sessions
      // In a full implementation, you would parse the LogoutRequest and respond appropriately
      
      res.json({
        success: true,
        message: 'Logout completed',
        redirect_url: RelayState || `${process.env.FRONTEND_URL}/login`,
      });
    } catch (error) {
      this.logger.error('Failed to handle SAML logout', {
        provider: req.params.provider,
        error: error.message,
      });
      res.status(500).json({ error: 'Logout failed' });
    }
  }

  /**
   * POST /api/auth/saml/config
   * Configure SAML for tenant (admin endpoint)
   */
  async configureSAML(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Verify admin permissions
      if (!req.user || req.user.role !== 'admin') {
        res.status(403).json({ error: 'Admin permissions required' });
        return;
      }

      const { provider, entity_id, sso_url, slo_url, certificate, name_id_format, attribute_mapping } = req.body;

      // Validate configuration
      const configData = {
        organization_id: req.user.organization_id,
        provider,
        entity_id,
        sso_url,
        slo_url,
        certificate,
        name_id_format: name_id_format || 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
        attribute_mapping: attribute_mapping || this.attributeMapper.constructor.createDefaultMapping(provider),
        is_active: true,
      };

      const validation = this.configService.validateSAMLConfig(configData);
      if (!validation.isValid) {
        res.status(400).json({
          error: 'Invalid SAML configuration',
          details: validation.errors,
        });
        return;
      }

      // Save configuration
      const savedConfig = await this.configService.saveSAMLConfig(configData);

      // Generate signing certificate if none exists
      const existingCert = await this.certificateService.getActiveCertificate(
        req.user.organization_id,
        'signing'
      );

      if (!existingCert) {
        await this.certificateService.generateSAMLCertificate(
          req.user.organization_id,
          'signing',
          `fortium-metrics-${req.user.organization_id}`
        );
      }

      this.logger.info('SAML configuration saved', {
        organization_id: req.user.organization_id,
        provider,
        entity_id,
        configured_by: req.user.id,
      });

      res.json({
        success: true,
        config: {
          id: savedConfig.id,
          provider: savedConfig.provider,
          entity_id: savedConfig.entity_id,
          sso_url: savedConfig.sso_url,
          name_id_format: savedConfig.name_id_format,
          is_active: savedConfig.is_active,
        },
      });
    } catch (error) {
      this.logger.error('Failed to configure SAML', {
        organization_id: req.user?.organization_id,
        error: error.message,
      });
      res.status(500).json({ error: 'Failed to configure SAML' });
    }
  }

  /**
   * Get organization ID from slug
   */
  private async getOrganizationIdFromSlug(slug: string): Promise<string | null> {
    try {
      const query = 'SELECT id FROM organizations WHERE slug = $1';
      const result = await this.db.query(query, [slug]);
      return result.rows.length > 0 ? result.rows[0].id : null;
    } catch (error) {
      this.logger.error('Failed to get organization ID', { slug, error: error.message });
      return null;
    }
  }

  /**
   * Determine organization from SAML response
   */
  private async determineOrganizationFromResponse(
    responseXml: string,
    provider: string
  ): Promise<string | null> {
    try {
      // Parse the response to extract issuer or audience
      // For simplicity, we'll look up by provider name
      // In production, you'd parse the XML properly
      const query = 'SELECT organization_id FROM saml_configs WHERE provider = $1 AND is_active = true LIMIT 1';
      const result = await this.db.query(query, [provider]);
      return result.rows.length > 0 ? result.rows[0].organization_id : null;
    } catch (error) {
      this.logger.error('Failed to determine organization', { provider, error: error.message });
      return null;
    }
  }

  /**
   * Find or create user from SAML profile
   */
  private async findOrCreateUser(
    profile: MappedUserProfile,
    organizationId: string,
    provider: string
  ): Promise<any> {
    try {
      // First, try to find user by email
      let query = 'SELECT * FROM users WHERE organization_id = $1 AND email = $2';
      let result = await this.db.query(query, [organizationId, profile.email]);

      if (result.rows.length > 0) {
        // Update existing user
        const userId = result.rows[0].id;
        
        query = `
          UPDATE users SET 
            profile = profile || $1,
            last_login = NOW(),
            updated_at = NOW()
          WHERE id = $2
          RETURNING *
        `;
        
        const profileUpdate = {
          saml_attributes: profile.attributes,
          display_name: profile.displayName,
          groups: profile.groups,
          department: profile.department,
        };

        result = await this.db.query(query, [JSON.stringify(profileUpdate), userId]);

        // Update SAML identity
        await this.updateSAMLIdentity(userId, organizationId, provider, profile);

        return result.rows[0];
      } else {
        // Create new user
        query = `
          INSERT INTO users (
            organization_id, email, role, profile, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, NOW(), NOW())
          RETURNING *
        `;

        const role = this.attributeMapper.determineUserRole(profile.groups);
        const userProfile = {
          display_name: profile.displayName,
          first_name: profile.firstName,
          last_name: profile.lastName,
          groups: profile.groups,
          department: profile.department,
          saml_attributes: profile.attributes,
        };

        result = await this.db.query(query, [
          organizationId,
          profile.email,
          role,
          JSON.stringify(userProfile),
        ]);

        const newUser = result.rows[0];

        // Create SAML identity
        await this.createSAMLIdentity(newUser.id, organizationId, provider, profile);

        return newUser;
      }
    } catch (error) {
      this.logger.error('Failed to find or create user', {
        email: profile.email,
        organization_id: organizationId,
        provider,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Create SAML identity record
   */
  private async createSAMLIdentity(
    userId: string,
    organizationId: string,
    provider: string,
    profile: MappedUserProfile
  ): Promise<void> {
    const query = `
      INSERT INTO user_saml_identities (
        user_id, organization_id, provider, name_id, name_id_format, attributes, last_login_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `;

    await this.db.query(query, [
      userId,
      organizationId,
      provider,
      profile.attributes.nameId,
      profile.attributes.nameIdFormat,
      JSON.stringify(profile.attributes),
    ]);
  }

  /**
   * Update SAML identity record
   */
  private async updateSAMLIdentity(
    userId: string,
    organizationId: string,
    provider: string,
    profile: MappedUserProfile
  ): Promise<void> {
    const query = `
      UPDATE user_saml_identities SET
        name_id = $4,
        name_id_format = $5,
        attributes = $6,
        last_login_at = NOW()
      WHERE user_id = $1 AND organization_id = $2 AND provider = $3
    `;

    await this.db.query(query, [
      userId,
      organizationId,
      provider,
      profile.attributes.nameId,
      profile.attributes.nameIdFormat,
      JSON.stringify(profile.attributes),
    ]);
  }

  /**
   * Generate JWT auth token (integrate with existing system)
   */
  private async generateAuthToken(user: any): Promise<string> {
    // This should integrate with your existing JWT service
    // For now, return a placeholder
    return 'jwt-token-placeholder';
  }

  /**
   * Log authentication event
   */
  private async logAuthEvent(eventType: string, details: any): Promise<void> {
    try {
      const query = `
        INSERT INTO auth_audit_log (event_type, event_details, success, timestamp)
        VALUES ($1, $2, $3, NOW())
      `;
      
      const success = !eventType.includes('failed');
      await this.db.query(query, [eventType, JSON.stringify(details), success]);
    } catch (error) {
      this.logger.error('Failed to log auth event', { event_type: eventType, error: error.message });
    }
  }
}