/**
 * SAML Integration Tests
 * End-to-end tests for SAML authentication flow
 */

import request from 'supertest';
import express from 'express';
import { DatabaseConnection } from '../../database/connection';
import { createSAMLRouteModule } from '../../routes/saml-auth.routes';
import * as winston from 'winston';

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
} as any as winston.Logger;

// Mock database connection
const mockDb = {
  query: jest.fn(),
} as any as DatabaseConnection;

// Sample SAML Response (base64 encoded)
const sampleSAMLResponse = Buffer.from(`
<?xml version="1.0" encoding="UTF-8"?>
<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
                xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
                ID="response-id"
                Version="2.0"
                IssueInstant="2025-01-01T12:00:00Z"
                InResponseTo="request-id">
  <saml:Issuer>https://dev-12345.okta.com</saml:Issuer>
  <samlp:Status>
    <samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/>
  </samlp:Status>
  <saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
                  ID="assertion-id"
                  Version="2.0"
                  IssueInstant="2025-01-01T12:00:00Z">
    <saml:Issuer>https://dev-12345.okta.com</saml:Issuer>
    <saml:Subject>
      <saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">
        test@example.com
      </saml:NameID>
      <saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer">
        <saml:SubjectConfirmationData NotOnOrAfter="2025-01-01T13:00:00Z"
                                      Recipient="https://metrics.fortium.ai/auth/saml/acs/okta-saml"
                                      InResponseTo="request-id"/>
      </saml:SubjectConfirmation>
    </saml:Subject>
    <saml:Conditions NotBefore="2025-01-01T11:55:00Z" NotOnOrAfter="2025-01-01T13:00:00Z">
      <saml:AudienceRestriction>
        <saml:Audience>https://metrics.fortium.ai/saml/metadata/test-org</saml:Audience>
      </saml:AudienceRestriction>
    </saml:Conditions>
    <saml:AuthnStatement AuthnInstant="2025-01-01T12:00:00Z" SessionIndex="session-123">
      <saml:AuthnContext>
        <saml:AuthnContextClassRef>
          urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport
        </saml:AuthnContextClassRef>
      </saml:AuthnContext>
    </saml:AuthnStatement>
    <saml:AttributeStatement>
      <saml:Attribute Name="email">
        <saml:AttributeValue>test@example.com</saml:AttributeValue>
      </saml:Attribute>
      <saml:Attribute Name="firstName">
        <saml:AttributeValue>John</saml:AttributeValue>
      </saml:Attribute>
      <saml:Attribute Name="lastName">
        <saml:AttributeValue>Doe</saml:AttributeValue>
      </saml:Attribute>
      <saml:Attribute Name="groups">
        <saml:AttributeValue>developers</saml:AttributeValue>
        <saml:AttributeValue>users</saml:AttributeValue>
      </saml:Attribute>
    </saml:AttributeStatement>
  </saml:Assertion>
</samlp:Response>
`).toString('base64');

describe('SAML Integration Tests', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    const { authRoutes } = createSAMLRouteModule(mockDb, mockLogger);
    app.use('/auth/saml', authRoutes);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /auth/saml/metadata/:org', () => {
    it('should return SP metadata XML', async () => {
      // Mock database queries
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 'org-id' }] }) // Organization lookup
        .mockResolvedValueOnce({ rows: [{ // Certificate lookup
          id: 'cert-id',
          certificate: '-----BEGIN CERTIFICATE-----\nMIIC...\n-----END CERTIFICATE-----',
          thumbprint: 'ABC123',
          is_active: true,
          expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        }] });

      const response = await request(app)
        .get('/auth/saml/metadata/test-org')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/application\/xml/);
      expect(response.text).toContain('EntityDescriptor');
      expect(response.text).toContain('SPSSODescriptor');
      expect(response.text).toContain('AssertionConsumerService');
    });

    it('should return 404 for non-existent organization', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      await request(app)
        .get('/auth/saml/metadata/nonexistent')
        .expect(404)
        .expect((res) => {
          expect(res.body.error).toBe('Organization not found');
        });
    });
  });

  describe('POST /auth/saml/sso/:provider', () => {
    it('should initiate SSO flow and return redirect URL', async () => {
      // Mock database queries
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 'org-id' }] }) // Organization lookup
        .mockResolvedValueOnce({ rows: [{ // SAML config lookup
          id: 'config-id',
          organization_id: 'org-id',
          provider: 'okta-saml',
          entity_id: 'https://dev-12345.okta.com',
          sso_url: 'https://dev-12345.okta.com/app/sso/saml',
          name_id_format: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
          is_active: true,
        }] })
        .mockResolvedValueOnce({ rows: [{ // Certificate lookup
          certificate: '-----BEGIN CERTIFICATE-----\nMIIC...\n-----END CERTIFICATE-----',
        }] })
        .mockResolvedValueOnce({ rows: [] }); // Request storage

      const response = await request(app)
        .post('/auth/saml/sso/okta-saml')
        .send({
          org: 'test-org',
          redirect_uri: 'https://example.com/dashboard',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.redirect_url).toContain('https://dev-12345.okta.com/app/sso/saml');
      expect(response.body.redirect_url).toContain('SAMLRequest=');
      expect(response.body.request_id).toBeDefined();
    });

    it('should return 404 for unconfigured provider', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 'org-id' }] }) // Organization lookup
        .mockResolvedValueOnce({ rows: [] }); // No SAML config

      await request(app)
        .post('/auth/saml/sso/okta-saml')
        .send({
          org: 'test-org',
        })
        .expect(404)
        .expect((res) => {
          expect(res.body.error).toBe('SAML provider not configured');
        });
    });

    it('should validate request parameters', async () => {
      await request(app)
        .post('/auth/saml/sso/invalid-provider')
        .send({
          org: 'test-org',
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.error).toBe('Validation failed');
        });
    });
  });

  describe('POST /auth/saml/acs/:provider', () => {
    it('should process SAML response and authenticate user', async () => {
      // Mock database queries for ACS processing
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ organization_id: 'org-id' }] }) // Provider lookup
        .mockResolvedValueOnce({ rows: [{ // SAML config
          id: 'config-id',
          organization_id: 'org-id',
          provider: 'okta-saml',
          entity_id: 'https://dev-12345.okta.com',
          certificate: '-----BEGIN CERTIFICATE-----\nMIIC...\n-----END CERTIFICATE-----',
          name_id_format: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
          attribute_mapping: {
            email: 'email',
            firstName: 'firstName',
            lastName: 'lastName',
            groups: ['groups'],
          },
          is_active: true,
        }] })
        .mockResolvedValueOnce({ rows: [{ // Stored request
          request_id: 'request-id',
          organization_id: 'org-id',
          provider: 'okta-saml',
        }] })
        .mockResolvedValueOnce({ rows: [] }) // Delete request
        .mockResolvedValueOnce({ rows: [{ // Find user
          id: 'user-id',
          email: 'test@example.com',
          name: 'John Doe',
          role: 'developer',
        }] })
        .mockResolvedValueOnce({ rows: [{ // Update user
          id: 'user-id',
          email: 'test@example.com',
          name: 'John Doe',
          role: 'developer',
        }] })
        .mockResolvedValueOnce({ rows: [] }) // Update SAML identity
        .mockResolvedValueOnce({ rows: [{ // Create SAML session
          session_id: 'saml-session-id',
          name_id: 'test@example.com',
          user_id: 'user-id',
          organization_id: 'org-id',
          provider: 'okta-saml',
          attributes: {},
          expires_at: new Date(Date.now() + 3600000),
        }] })
        .mockResolvedValueOnce({ rows: [] }); // Log auth event

      const response = await request(app)
        .post('/auth/saml/acs/okta-saml')
        .send({
          SAMLResponse: sampleSAMLResponse,
          RelayState: 'https://example.com/dashboard',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe('test@example.com');
      expect(response.body.token).toBeDefined();
      expect(response.body.session_id).toBeDefined();
    });

    it('should return 400 for missing SAMLResponse', async () => {
      await request(app)
        .post('/auth/saml/acs/okta-saml')
        .send({
          RelayState: 'https://example.com/dashboard',
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.error).toBe('Validation failed');
        });
    });

    it('should handle invalid SAML response', async () => {
      const invalidResponse = Buffer.from('invalid xml').toString('base64');

      await request(app)
        .post('/auth/saml/acs/okta-saml')
        .send({
          SAMLResponse: invalidResponse,
        })
        .expect(500);
    });
  });

  describe('GET /auth/saml/slo/:provider', () => {
    it('should handle single logout request', async () => {
      const response = await request(app)
        .get('/auth/saml/slo/okta-saml')
        .query({
          RelayState: 'https://example.com/login',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Logout completed');
      expect(response.body.redirect_url).toBe('https://example.com/login');
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      mockDb.query.mockRejectedValue(new Error('Database connection failed'));

      await request(app)
        .get('/auth/saml/metadata/test-org')
        .expect(500)
        .expect((res) => {
          expect(res.body.error).toBe('Failed to generate metadata');
        });

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle malformed request data', async () => {
      await request(app)
        .post('/auth/saml/sso/okta-saml')
        .send({
          org: '', // Empty organization
        })
        .expect(400);
    });
  });

  describe('Security Validations', () => {
    it('should reject requests with invalid provider names', async () => {
      await request(app)
        .post('/auth/saml/sso/malicious-provider')
        .send({
          org: 'test-org',
        })
        .expect(400);
    });

    it('should validate redirect URIs', async () => {
      await request(app)
        .post('/auth/saml/sso/okta-saml')
        .send({
          org: 'test-org',
          redirect_uri: 'javascript:alert(1)', // Invalid protocol
        })
        .expect(400);
    });
  });
});