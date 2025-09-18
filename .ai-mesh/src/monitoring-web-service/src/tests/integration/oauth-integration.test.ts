/**
 * OAuth Integration Tests
 * Tests the complete OAuth flow with database interactions
 */

import request from 'supertest';
import express from 'express';
import { DatabaseConnection } from '../../database/connection';
import { createAuthRoutes } from '../../routes/auth.routes';
import * as winston from 'winston';

// Mock external dependencies
jest.mock('openid-client');
jest.mock('node-fetch');

const mockLogger = winston.createLogger({
  level: 'error',
  silent: true,
});

describe('OAuth Integration Tests', () => {
  let app: express.Application;
  let mockDb: jest.Mocked<DatabaseConnection>;
  let authRouter: any;

  beforeEach(() => {
    // Mock database
    mockDb = {
      query: jest.fn(),
      setOrganizationContext: jest.fn(),
      clearOrganizationContext: jest.fn(),
    } as unknown as jest.Mocked<DatabaseConnection>;

    // Create Express app with auth routes
    app = express();
    app.use(express.json());
    
    const authRoutes = createAuthRoutes(mockDb, mockLogger);
    authRouter = authRoutes.router;
    app.use('/api/auth', authRouter);

    jest.clearAllMocks();
  });

  describe('POST /api/auth/oauth/initiate', () => {
    beforeEach(() => {
      // Mock organization lookup
      mockDb.query.mockImplementation((query: string, params: any[]) => {
        if (query.includes('organizations') && query.includes('slug')) {
          return Promise.resolve({
            rows: [{ id: 'org-123' }],
          });
        }
        if (query.includes('sso_providers')) {
          return Promise.resolve({
            rows: [{
              id: 'provider-123',
              organization_id: 'org-123',
              provider_name: 'google',
              provider_type: 'oidc',
              client_id: 'test-client-id',
              client_secret_encrypted: 'encrypted-secret',
              redirect_uri: 'https://app.example.com/auth/callback',
              scopes: '["openid", "email", "profile"]',
              additional_config: '{}',
              is_active: true,
            }],
          });
        }
        if (query.includes('oauth_sessions')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });
    });

    it('should initiate OAuth flow successfully', async () => {
      // Mock openid-client
      const { Issuer } = require('openid-client');
      const mockClient = {
        authorizationUrl: jest.fn().mockReturnValue(
          'https://accounts.google.com/o/oauth2/auth?client_id=test&state=test-state'
        ),
      };
      const mockIssuer = {
        Client: jest.fn().mockImplementation(() => mockClient),
      };
      Issuer.discover = jest.fn().mockResolvedValue(mockIssuer);

      const response = await request(app)
        .post('/api/auth/oauth/initiate')
        .send({
          provider: 'google',
          organization_slug: 'test-org',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('authorization_url');
      expect(response.body).toHaveProperty('state');
      expect(response.body).toHaveProperty('provider', 'google');
      expect(response.body).toHaveProperty('expires_in', 900);
      expect(response.body.authorization_url).toContain('https://accounts.google.com/o/oauth2/auth');
    });

    it('should reject invalid organization', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .post('/api/auth/oauth/initiate')
        .send({
          provider: 'google',
          organization_slug: 'invalid-org',
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Organization not found');
    });

    it('should reject unconfigured provider', async () => {
      mockDb.query.mockImplementation((query: string) => {
        if (query.includes('organizations')) {
          return Promise.resolve({ rows: [{ id: 'org-123' }] });
        }
        if (query.includes('sso_providers')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .post('/api/auth/oauth/initiate')
        .send({
          provider: 'google',
          organization_slug: 'test-org',
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not configured or not active');
    });

    it('should validate request body', async () => {
      const response = await request(app)
        .post('/api/auth/oauth/initiate')
        .send({
          // Missing required fields
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toBeInstanceOf(Array);
    });
  });

  describe('POST /api/auth/oauth/callback', () => {
    beforeEach(() => {
      // Mock session storage and retrieval
      mockDb.query.mockImplementation((query: string, params: any[]) => {
        if (query.includes('oauth_sessions')) {
          return Promise.resolve({
            rows: [{
              state: 'test-state',
              organization_id: 'org-123',
              provider: 'google',
              code_verifier: 'test-verifier',
              redirect_uri: 'https://app.example.com/auth/callback',
              nonce: 'test-nonce',
            }],
          });
        }
        if (query.includes('sso_providers')) {
          return Promise.resolve({
            rows: [{
              id: 'provider-123',
              organization_id: 'org-123',
              provider_name: 'google',
              provider_type: 'oidc',
              client_id: 'test-client-id',
              client_secret_encrypted: 'encrypted-secret',
              redirect_uri: 'https://app.example.com/auth/callback',
              scopes: '["openid", "email", "profile"]',
              additional_config: '{}',
              is_active: true,
            }],
          });
        }
        if (query.includes('user_oauth_identities')) {
          return Promise.resolve({ rows: [] });
        }
        if (query.includes('users') && query.includes('external_id')) {
          return Promise.resolve({ rows: [] });
        }
        if (query.includes('users') && query.includes('email')) {
          return Promise.resolve({ rows: [] });
        }
        if (query.includes('user_mapping_rules')) {
          return Promise.resolve({
            rows: [{
              id: 'rule-123',
              rule_type: 'default',
              condition: '{}',
              target_role: 'developer',
              auto_create_user: true,
              team_assignments: '[]',
              priority: 100,
            }],
          });
        }
        if (query.includes('INSERT INTO users')) {
          return Promise.resolve({
            rows: [{
              id: 'user-123',
              organization_id: 'org-123',
              email: 'user@example.com',
              name: 'Test User',
              role: 'developer',
            }],
          });
        }
        if (query.includes('INSERT INTO oauth_tokens')) {
          return Promise.resolve({ rows: [] });
        }
        if (query.includes('INSERT INTO user_oauth_identities')) {
          return Promise.resolve({ rows: [] });
        }
        if (query.includes('INSERT INTO refresh_tokens')) {
          return Promise.resolve({ rows: [] });
        }
        if (query.includes('INSERT INTO auth_audit_log')) {
          return Promise.resolve({ rows: [] });
        }
        if (query.includes('DELETE FROM oauth_sessions')) {
          return Promise.resolve({ rowCount: 1 });
        }
        return Promise.resolve({ rows: [] });
      });
    });

    it('should complete OAuth callback successfully', async () => {
      // Mock openid-client and fetch
      const { Issuer } = require('openid-client');
      const mockTokenSet = {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        token_type: 'Bearer',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        id_token: 'id-token',
      };
      
      const mockClient = {
        callback: jest.fn().mockResolvedValue(mockTokenSet),
      };
      const mockIssuer = {
        Client: jest.fn().mockImplementation(() => mockClient),
      };
      Issuer.discover = jest.fn().mockResolvedValue(mockIssuer);

      // Mock Google userinfo API
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: '123456789',
          email: 'user@example.com',
          verified_email: true,
          name: 'Test User',
          given_name: 'Test',
          family_name: 'User',
          picture: 'https://example.com/picture.jpg',
        }),
      });

      const response = await request(app)
        .post('/api/auth/oauth/callback')
        .send({
          code: 'auth-code',
          state: 'test-state',
          provider: 'google',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('refresh_token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('email', 'user@example.com');
      expect(response.body.user).toHaveProperty('oauth_provider', 'google');
      expect(response.body.user).toHaveProperty('is_new_user', true);
    });

    it('should reject invalid state', async () => {
      mockDb.query.mockImplementation((query: string) => {
        if (query.includes('oauth_sessions')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .post('/api/auth/oauth/callback')
        .send({
          code: 'auth-code',
          state: 'invalid-state',
          provider: 'google',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid or expired OAuth session');
    });

    it('should handle token exchange failure', async () => {
      const { Issuer } = require('openid-client');
      const mockClient = {
        callback: jest.fn().mockRejectedValue(new Error('Invalid authorization code')),
      };
      const mockIssuer = {
        Client: jest.fn().mockImplementation(() => mockClient),
      };
      Issuer.discover = jest.fn().mockResolvedValue(mockIssuer);

      const response = await request(app)
        .post('/api/auth/oauth/callback')
        .send({
          code: 'invalid-code',
          state: 'test-state',
          provider: 'google',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('OAuth authentication failed');
    });
  });

  describe('GET /api/auth/oauth/providers/:organizationSlug', () => {
    it('should list OAuth providers', async () => {
      mockDb.query.mockImplementation((query: string, params: any[]) => {
        if (query.includes('organizations')) {
          return Promise.resolve({ rows: [{ id: 'org-123' }] });
        }
        if (query.includes('sso_providers')) {
          return Promise.resolve({
            rows: [{
              id: 'provider-123',
              provider_name: 'google',
              provider_type: 'oidc',
              is_active: true,
              scopes: '["openid", "email", "profile"]',
              additional_config: '{}',
            }],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .get('/api/auth/oauth/providers/test-org');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('providers');
      expect(response.body.providers).toHaveLength(1);
      expect(response.body.providers[0]).toHaveProperty('provider_name', 'google');
      expect(response.body.providers[0]).toHaveProperty('is_active', true);
      expect(response.body.providers[0]).toHaveProperty('metadata');
    });

    it('should handle organization not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .get('/api/auth/oauth/providers/invalid-org');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Organization not found');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on OAuth initiate', async () => {
      mockDb.query.mockImplementation((query: string) => {
        if (query.includes('organizations')) {
          return Promise.resolve({ rows: [{ id: 'org-123' }] });
        }
        if (query.includes('sso_providers')) {
          return Promise.resolve({
            rows: [{
              id: 'provider-123',
              provider_name: 'google',
              is_active: true,
              client_id: 'test-client-id',
              client_secret_encrypted: 'encrypted-secret',
              redirect_uri: 'https://app.example.com/auth/callback',
              scopes: '["openid", "email", "profile"]',
              additional_config: '{}',
            }],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      // Mock openid-client
      const { Issuer } = require('openid-client');
      const mockClient = {
        authorizationUrl: jest.fn().mockReturnValue('https://accounts.google.com/auth'),
      };
      const mockIssuer = {
        Client: jest.fn().mockImplementation(() => mockClient),
      };
      Issuer.discover = jest.fn().mockResolvedValue(mockIssuer);

      // Make multiple requests quickly
      const requests = Array(10).fill(null).map(() =>
        request(app)
          .post('/api/auth/oauth/initiate')
          .send({
            provider: 'google',
            organization_slug: 'test-org',
          })
      );

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      mockDb.query.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .post('/api/auth/oauth/initiate')
        .send({
          provider: 'google',
          organization_slug: 'test-org',
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('OAuth initiation failed');
    });

    it('should handle malformed request bodies', async () => {
      const response = await request(app)
        .post('/api/auth/oauth/initiate')
        .send('invalid json')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
    });
  });

  describe('Security', () => {
    it('should validate CSRF state parameter', async () => {
      mockDb.query.mockImplementation((query: string) => {
        if (query.includes('oauth_sessions')) {
          return Promise.resolve({
            rows: [{
              state: 'correct-state',
              organization_id: 'org-123',
              provider: 'google',
              code_verifier: 'test-verifier',
            }],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .post('/api/auth/oauth/callback')
        .send({
          code: 'auth-code',
          state: 'wrong-state',
          provider: 'google',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid or expired OAuth session');
    });

    it('should validate provider parameter', async () => {
      const response = await request(app)
        .post('/api/auth/oauth/initiate')
        .send({
          provider: '<script>alert("xss")</script>',
          organization_slug: 'test-org',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });
  });
});