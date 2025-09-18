/**
 * Google OAuth Service Unit Tests
 */

import { GoogleOAuthService } from '../../../auth/oauth/google.service';
import { DatabaseConnection } from '../../../database/connection';
import * as winston from 'winston';

// Mock dependencies
jest.mock('openid-client');
jest.mock('node-fetch');

const mockDb = {
  query: jest.fn(),
  setOrganizationContext: jest.fn(),
  clearOrganizationContext: jest.fn(),
} as unknown as DatabaseConnection;

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
} as unknown as winston.Logger;

describe('GoogleOAuthService', () => {
  let googleService: GoogleOAuthService;
  
  beforeEach(() => {
    googleService = new GoogleOAuthService(mockDb, mockLogger);
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should initialize with valid configuration', async () => {
      const config = {
        client_id: 'test-client-id.apps.googleusercontent.com',
        client_secret: 'test-client-secret',
        redirect_uri: 'https://app.example.com/auth/callback',
        scopes: ['openid', 'email', 'profile'],
      };

      // Mock the Issuer.discover and Client constructor
      const { Issuer } = require('openid-client');
      const mockIssuer = {
        Client: jest.fn().mockImplementation(() => ({})),
      };
      Issuer.discover = jest.fn().mockResolvedValue(mockIssuer);

      await googleService.initialize(config);

      expect(Issuer.discover).toHaveBeenCalledWith('https://accounts.google.com');
      expect(mockIssuer.Client).toHaveBeenCalledWith({
        client_id: config.client_id,
        client_secret: config.client_secret,
        redirect_uris: [config.redirect_uri],
        response_types: ['code'],
      });
    });

    it('should handle initialization failure', async () => {
      const config = {
        client_id: 'invalid-client-id',
        client_secret: 'test-client-secret',
        redirect_uri: 'https://app.example.com/auth/callback',
        scopes: ['openid', 'email', 'profile'],
      };

      const { Issuer } = require('openid-client');
      Issuer.discover = jest.fn().mockRejectedValue(new Error('Discovery failed'));

      await expect(googleService.initialize(config)).rejects.toThrow('Google OAuth initialization failed');
    });
  });

  describe('getAuthorizationUrl', () => {
    beforeEach(async () => {
      // Initialize the service first
      const { Issuer } = require('openid-client');
      const mockClient = {
        authorizationUrl: jest.fn().mockReturnValue('https://accounts.google.com/o/oauth2/auth?client_id=test'),
      };
      const mockIssuer = {
        Client: jest.fn().mockImplementation(() => mockClient),
      };
      Issuer.discover = jest.fn().mockResolvedValue(mockIssuer);

      await googleService.initialize({
        client_id: 'test-client-id',
        client_secret: 'test-secret',
        redirect_uri: 'https://app.example.com/auth/callback',
        scopes: ['openid', 'email', 'profile'],
      });

      // Replace the client with our mock
      (googleService as any).client = mockClient;
    });

    it('should generate authorization URL with PKCE', async () => {
      const config = {
        client_id: 'test-client-id',
        client_secret: 'test-secret',
        redirect_uri: 'https://app.example.com/auth/callback',
        scopes: ['openid', 'email', 'profile'],
      };
      const state = 'test-state';

      const result = await googleService.getAuthorizationUrl(config, state);

      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('codeVerifier');
      expect(result).toHaveProperty('nonce');
      expect(result.url).toContain('https://accounts.google.com/o/oauth2/auth');
    });

    it('should include hosted domain when specified', async () => {
      const config = {
        client_id: 'test-client-id',
        client_secret: 'test-secret',
        redirect_uri: 'https://app.example.com/auth/callback',
        scopes: ['openid', 'email', 'profile'],
        hosted_domain: 'company.com',
      };
      const state = 'test-state';

      await googleService.getAuthorizationUrl(config, state);

      const mockClient = (googleService as any).client;
      expect(mockClient.authorizationUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          hd: 'company.com',
        })
      );
    });

    it('should throw error if client not initialized', async () => {
      const uninitializedService = new GoogleOAuthService(mockDb, mockLogger);
      
      await expect(
        uninitializedService.getAuthorizationUrl({
          client_id: 'test',
          client_secret: 'test',
          redirect_uri: 'https://example.com',
          scopes: ['openid'],
        }, 'state')
      ).rejects.toThrow('Google OAuth client not initialized');
    });
  });

  describe('exchangeCodeForTokens', () => {
    beforeEach(async () => {
      // Initialize the service
      const { Issuer } = require('openid-client');
      const mockClient = {
        callback: jest.fn(),
      };
      const mockIssuer = {
        Client: jest.fn().mockImplementation(() => mockClient),
      };
      Issuer.discover = jest.fn().mockResolvedValue(mockIssuer);

      await googleService.initialize({
        client_id: 'test-client-id',
        client_secret: 'test-secret',
        redirect_uri: 'https://app.example.com/auth/callback',
        scopes: ['openid', 'email', 'profile'],
      });

      (googleService as any).client = mockClient;
    });

    it('should exchange authorization code for tokens', async () => {
      const config = {
        client_id: 'test-client-id',
        client_secret: 'test-secret',
        redirect_uri: 'https://app.example.com/auth/callback',
        scopes: ['openid', 'email', 'profile'],
      };

      const mockTokenSet = {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        token_type: 'Bearer',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        scope: 'openid email profile',
        id_token: 'id-token',
      };

      const mockClient = (googleService as any).client;
      mockClient.callback.mockResolvedValue(mockTokenSet);

      const result = await googleService.exchangeCodeForTokens(
        config,
        'auth-code',
        'code-verifier',
        'state'
      );

      expect(result).toEqual({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        token_type: 'Bearer',
        expires_at: new Date(mockTokenSet.expires_at * 1000),
        scope: 'openid email profile',
        id_token: 'id-token',
      });

      expect(mockClient.callback).toHaveBeenCalledWith(
        config.redirect_uri,
        { code: 'auth-code', state: 'state' },
        { code_verifier: 'code-verifier' }
      );
    });

    it('should handle token exchange failure', async () => {
      const config = {
        client_id: 'test-client-id',
        client_secret: 'test-secret',
        redirect_uri: 'https://app.example.com/auth/callback',
        scopes: ['openid', 'email', 'profile'],
      };

      const mockClient = (googleService as any).client;
      mockClient.callback.mockRejectedValue(new Error('Invalid authorization code'));

      await expect(
        googleService.exchangeCodeForTokens(config, 'invalid-code', 'verifier', 'state')
      ).rejects.toThrow('Failed to exchange authorization code for tokens');
    });
  });

  describe('getUserProfile', () => {
    it('should get user profile successfully', async () => {
      const mockProfile = {
        id: '123456789',
        email: 'user@company.com',
        verified_email: true,
        name: 'Test User',
        given_name: 'Test',
        family_name: 'User',
        picture: 'https://example.com/picture.jpg',
        locale: 'en',
        hd: 'company.com',
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockProfile),
      });

      const result = await googleService.getUserProfile('access-token');

      expect(result).toEqual({
        provider_user_id: '123456789',
        email: 'user@company.com',
        name: 'Test User',
        first_name: 'Test',
        last_name: 'User',
        picture: 'https://example.com/picture.jpg',
        locale: 'en',
        email_verified: true,
        profile_data: {
          hosted_domain: 'company.com',
          locale: 'en',
          given_name: 'Test',
          family_name: 'User',
        },
      });

      expect(fetch).toHaveBeenCalledWith(
        'https://www.googleapis.com/oauth2/v2/userinfo',
        {
          headers: {
            'Authorization': 'Bearer access-token',
            'Accept': 'application/json',
          },
        }
      );
    });

    it('should handle unverified email', async () => {
      const mockProfile = {
        id: '123456789',
        email: 'user@company.com',
        verified_email: false,
        name: 'Test User',
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockProfile),
      });

      await expect(
        googleService.getUserProfile('access-token')
      ).rejects.toThrow('Google email not verified');
    });

    it('should handle API error', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      await expect(
        googleService.getUserProfile('invalid-token')
      ).rejects.toThrow('Google API error: 401 Unauthorized');
    });
  });

  describe('refreshToken', () => {
    beforeEach(async () => {
      const { Issuer } = require('openid-client');
      const mockClient = {
        refresh: jest.fn(),
      };
      const mockIssuer = {
        Client: jest.fn().mockImplementation(() => mockClient),
      };
      Issuer.discover = jest.fn().mockResolvedValue(mockIssuer);

      await googleService.initialize({
        client_id: 'test-client-id',
        client_secret: 'test-secret',
        redirect_uri: 'https://app.example.com/auth/callback',
        scopes: ['openid', 'email', 'profile'],
      });

      (googleService as any).client = mockClient;
    });

    it('should refresh access token successfully', async () => {
      const mockTokenSet = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        token_type: 'Bearer',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      };

      const mockClient = (googleService as any).client;
      mockClient.refresh.mockResolvedValue(mockTokenSet);

      const result = await googleService.refreshToken('refresh-token');

      expect(result).toEqual({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        token_type: 'Bearer',
        expires_at: new Date(mockTokenSet.expires_at * 1000),
      });

      expect(mockClient.refresh).toHaveBeenCalledWith('refresh-token');
    });

    it('should handle refresh failure', async () => {
      const mockClient = (googleService as any).client;
      mockClient.refresh.mockRejectedValue(new Error('Invalid refresh token'));

      await expect(
        googleService.refreshToken('invalid-refresh-token')
      ).rejects.toThrow('Failed to refresh Google access token');
    });
  });

  describe('revokeToken', () => {
    it('should revoke token successfully', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
      });

      await googleService.revokeToken('access-token');

      expect(fetch).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/revoke?token=access-token',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );
    });

    it('should handle revocation failure', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
      });

      await expect(
        googleService.revokeToken('invalid-token')
      ).rejects.toThrow('Google token revocation failed: 400');
    });
  });

  describe('validateHostedDomain', () => {
    it('should validate hosted domain successfully', () => {
      const profile = {
        provider_user_id: '123',
        email: 'user@company.com',
        name: 'Test User',
        email_verified: true,
        profile_data: {
          hosted_domain: 'company.com',
        },
      };

      const result = googleService.validateHostedDomain(profile, 'company.com');
      expect(result).toBe(true);
    });

    it('should reject wrong hosted domain', () => {
      const profile = {
        provider_user_id: '123',
        email: 'user@company.com',
        name: 'Test User',
        email_verified: true,
        profile_data: {
          hosted_domain: 'other.com',
        },
      };

      const result = googleService.validateHostedDomain(profile, 'company.com');
      expect(result).toBe(false);
    });

    it('should allow no domain restriction', () => {
      const profile = {
        provider_user_id: '123',
        email: 'user@gmail.com',
        name: 'Test User',
        email_verified: true,
        profile_data: {},
      };

      const result = googleService.validateHostedDomain(profile);
      expect(result).toBe(true);
    });
  });

  describe('getDefaultScopes', () => {
    it('should return default scopes', () => {
      const scopes = googleService.getDefaultScopes();
      expect(scopes).toEqual(['openid', 'email', 'profile']);
    });
  });

  describe('getProviderMetadata', () => {
    it('should return provider metadata', () => {
      const metadata = googleService.getProviderMetadata();
      expect(metadata).toEqual({
        name: 'Google',
        display_name: 'Google Workspace',
        icon_url: 'https://developers.google.com/identity/images/g-logo.png',
        color: '#4285F4',
        supports_refresh: true,
        supports_revocation: true,
        supports_hosted_domain: true,
      });
    });
  });
});