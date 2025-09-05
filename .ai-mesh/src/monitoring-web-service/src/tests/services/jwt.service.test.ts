/**
 * Unit Tests for JWT Service
 * Tests JWT token generation, validation, and role-based access control
 */

import { JWTService, UserRole, TeamRole } from '../../services/jwt.service';
import { DatabaseConnection } from '../../database/connection';
import * as winston from 'winston';
import * as jwt from 'jsonwebtoken';

// Mock database connection
const mockDb = {
  query: jest.fn(),
  getClient: jest.fn(),
  pool: {} as any,
  setOrganizationContext: jest.fn(),
  clearOrganizationContext: jest.fn(),
} as unknown as jest.Mocked<DatabaseConnection>;

// Mock logger
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
} as unknown as jest.Mocked<winston.Logger>;

describe('JWTService', () => {
  let jwtService: JWTService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set test environment variables
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-key-for-testing-purposes';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-for-testing-purposes';
    process.env.JWT_ACCESS_EXPIRY = '15m';
    process.env.JWT_REFRESH_EXPIRY = '7d';
    process.env.JWT_ISSUER = 'fortium-test';

    jwtService = new JWTService(mockDb, mockLogger);
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.JWT_ACCESS_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
    delete process.env.JWT_ACCESS_EXPIRY;
    delete process.env.JWT_REFRESH_EXPIRY;
    delete process.env.JWT_ISSUER;
  });

  describe('generateTokenPair', () => {
    it('should generate valid JWT token pair', async () => {
      // Mock database operations for storing refresh token
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 1 });

      const payload = {
        user_id: 'user-123',
        organization_id: 'org-456',
        email: 'test@fortium.dev',
        role: 'developer' as UserRole,
        team_memberships: [
          { team_id: 'team-789', team_role: 'member' as TeamRole }
        ]
      };

      const result = await jwtService.generateTokenPair(payload);

      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
      expect(result).toHaveProperty('expires_in');
      expect(result.token_type).toBe('Bearer');

      // Verify access token structure
      const decoded = jwt.decode(result.access_token) as any;
      expect(decoded).toMatchObject({
        user_id: 'user-123',
        organization_id: 'org-456',
        email: 'test@fortium.dev',
        role: 'developer'
      });

      // Verify refresh token was stored
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO refresh_tokens'),
        expect.arrayContaining([
          expect.any(String), // jti
          'user-123',
          'org-456',
          expect.any(String), // token_family
          expect.any(Date)
        ])
      );
    });

    it('should include correct permissions for developer role', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 1 });

      const payload = {
        user_id: 'user-123',
        organization_id: 'org-456',
        email: 'test@fortium.dev',
        role: 'developer' as UserRole,
      };

      const result = await jwtService.generateTokenPair(payload);
      const decoded = jwt.decode(result.access_token) as any;

      expect(decoded.permissions).toContainEqual({
        resource: 'metrics',
        action: 'read',
        condition: 'own_or_team'
      });
      expect(decoded.permissions).toContainEqual({
        resource: 'metrics',
        action: 'create',
        condition: 'own'
      });
    });

    it('should include team lead permissions for team leads', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 1 });

      const payload = {
        user_id: 'user-123',
        organization_id: 'org-456',
        email: 'test@fortium.dev',
        role: 'manager' as UserRole,
        team_memberships: [
          { team_id: 'team-789', team_role: 'lead' as TeamRole }
        ]
      };

      const result = await jwtService.generateTokenPair(payload);
      const decoded = jwt.decode(result.access_token) as any;

      // Should have base manager permissions plus team lead permissions
      expect(decoded.permissions).toContainEqual({
        resource: 'teams',
        action: 'update',
        condition: 'team_lead'
      });
    });

    it('should handle admin role with full permissions', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 1 });

      const payload = {
        user_id: 'user-123',
        organization_id: 'org-456',
        email: 'admin@fortium.dev',
        role: 'admin' as UserRole,
      };

      const result = await jwtService.generateTokenPair(payload);
      const decoded = jwt.decode(result.access_token) as any;

      expect(decoded.permissions).toContainEqual({
        resource: 'users',
        action: '*'
      });
      expect(decoded.permissions).toContainEqual({
        resource: 'teams',
        action: '*'
      });
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify valid access token', async () => {
      // Mock token not blacklisted
      mockDb.query.mockResolvedValue({ rows: [] });

      const payload = {
        user_id: 'user-123',
        organization_id: 'org-456',
        email: 'test@fortium.dev',
        role: 'developer' as UserRole,
      };

      const tokenPair = await jwtService.generateTokenPair(payload);
      const result = await jwtService.verifyAccessToken(tokenPair.access_token);

      expect(result).toMatchObject({
        user_id: 'user-123',
        organization_id: 'org-456',
        email: 'test@fortium.dev',
        role: 'developer'
      });
    });

    it('should reject blacklisted tokens', async () => {
      // Mock token is blacklisted
      mockDb.query
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }) // Store refresh token
        .mockResolvedValueOnce({ rows: [{ jti: 'some-jti' }] }); // Token blacklisted

      const payload = {
        user_id: 'user-123',
        organization_id: 'org-456',
        email: 'test@fortium.dev',
        role: 'developer' as UserRole,
      };

      const tokenPair = await jwtService.generateTokenPair(payload);

      await expect(
        jwtService.verifyAccessToken(tokenPair.access_token)
      ).rejects.toThrow('Invalid or expired access token');
    });

    it('should reject expired tokens', async () => {
      // Create token with short expiry
      const originalExpiry = process.env.JWT_ACCESS_EXPIRY;
      process.env.JWT_ACCESS_EXPIRY = '1ms'; // Immediate expiry
      
      const shortExpiryService = new JWTService(mockDb, mockLogger);
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 1 });

      const payload = {
        user_id: 'user-123',
        organization_id: 'org-456',
        email: 'test@fortium.dev',
        role: 'developer' as UserRole,
      };

      const tokenPair = await shortExpiryService.generateTokenPair(payload);
      
      // Wait for token to expire
      await new Promise(resolve => setTimeout(resolve, 10));

      await expect(
        shortExpiryService.verifyAccessToken(tokenPair.access_token)
      ).rejects.toThrow('Invalid or expired access token');

      // Restore original expiry
      process.env.JWT_ACCESS_EXPIRY = originalExpiry;
    });

    it('should reject tampered tokens', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 1 });

      const payload = {
        user_id: 'user-123',
        organization_id: 'org-456',
        email: 'test@fortium.dev',
        role: 'developer' as UserRole,
      };

      const tokenPair = await jwtService.generateTokenPair(payload);
      const tamperedToken = tokenPair.access_token.slice(0, -5) + 'xxxxx';

      await expect(
        jwtService.verifyAccessToken(tamperedToken)
      ).rejects.toThrow('Invalid or expired access token');
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh valid refresh token', async () => {
      // Mock storing refresh token
      mockDb.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const payload = {
        user_id: 'user-123',
        organization_id: 'org-456',
        email: 'test@fortium.dev',
        role: 'developer' as UserRole,
      };

      const originalTokenPair = await jwtService.generateTokenPair(payload);

      // Mock refresh token verification
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ jti: 'refresh-jti' }] }) // Refresh token exists
        .mockResolvedValueOnce({ // User query for new token
          rows: [{
            id: 'user-123',
            organization_id: 'org-456',
            email: 'test@fortium.dev',
            role: 'developer',
            team_memberships: []
          }]
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }) // Delete old refresh token
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }); // Store new refresh token

      const newTokenPair = await jwtService.refreshAccessToken(originalTokenPair.refresh_token);

      expect(newTokenPair).toHaveProperty('access_token');
      expect(newTokenPair).toHaveProperty('refresh_token');
      expect(newTokenPair.access_token).not.toBe(originalTokenPair.access_token);
      expect(newTokenPair.refresh_token).not.toBe(originalTokenPair.refresh_token);
    });

    it('should reject invalid refresh token', async () => {
      await expect(
        jwtService.refreshAccessToken('invalid-refresh-token')
      ).rejects.toThrow('Invalid or expired refresh token');
    });

    it('should reject refresh token not in database', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }) // Store refresh token
        .mockResolvedValueOnce({ rows: [] }); // Refresh token not found

      const payload = {
        user_id: 'user-123',
        organization_id: 'org-456',
        email: 'test@fortium.dev',
        role: 'developer' as UserRole,
      };

      const tokenPair = await jwtService.generateTokenPair(payload);

      await expect(
        jwtService.refreshAccessToken(tokenPair.refresh_token)
      ).rejects.toThrow('Invalid or expired refresh token');
    });
  });

  describe('hasPermission', () => {
    const createUserPayload = (role: UserRole, teamMemberships = []): any => ({
      user_id: 'user-123',
      organization_id: 'org-456',
      email: 'test@fortium.dev',
      role,
      team_memberships: teamMemberships,
      permissions: role === 'owner' ? [{ resource: '*', action: '*' }] : 
                   role === 'admin' ? [
                     { resource: 'users', action: '*' },
                     { resource: 'teams', action: '*' },
                     { resource: 'metrics', action: '*' }
                   ] : [
                     { resource: 'metrics', action: 'read', condition: 'own_or_team' },
                     { resource: 'users', action: 'read', condition: 'own' }
                   ]
    });

    it('should allow owner full access', () => {
      const ownerPayload = createUserPayload('owner');

      expect(jwtService.hasPermission(ownerPayload, 'users', 'delete')).toBe(true);
      expect(jwtService.hasPermission(ownerPayload, 'metrics', 'create')).toBe(true);
      expect(jwtService.hasPermission(ownerPayload, 'anything', 'anything')).toBe(true);
    });

    it('should allow admin resource-specific access', () => {
      const adminPayload = createUserPayload('admin');

      expect(jwtService.hasPermission(adminPayload, 'users', 'create')).toBe(true);
      expect(jwtService.hasPermission(adminPayload, 'teams', 'delete')).toBe(true);
      expect(jwtService.hasPermission(adminPayload, 'metrics', 'read')).toBe(true);
    });

    it('should evaluate permission conditions correctly', () => {
      const developerPayload = createUserPayload('developer');

      // Own resource access
      expect(jwtService.hasPermission(
        developerPayload, 
        'users', 
        'read', 
        { user_id: 'user-123' }
      )).toBe(true);

      // Different user access
      expect(jwtService.hasPermission(
        developerPayload, 
        'users', 
        'read', 
        { user_id: 'user-456' }
      )).toBe(false);

      // Team access
      const developerWithTeam = {
        ...developerPayload,
        team_memberships: [{ team_id: 'team-789', team_role: 'member' as TeamRole }]
      };

      expect(jwtService.hasPermission(
        developerWithTeam, 
        'metrics', 
        'read', 
        { team_id: 'team-789' }
      )).toBe(true);

      expect(jwtService.hasPermission(
        developerWithTeam, 
        'metrics', 
        'read', 
        { team_id: 'team-999' }
      )).toBe(false);
    });

    it('should deny access when no matching permission', () => {
      const developerPayload = createUserPayload('developer');

      expect(jwtService.hasPermission(developerPayload, 'users', 'delete')).toBe(false);
      expect(jwtService.hasPermission(developerPayload, 'organizations', 'read')).toBe(false);
    });
  });

  describe('token revocation', () => {
    it('should revoke access token', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 1 });

      await jwtService.revokeAccessToken('test-jti');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO token_blacklist'),
        ['test-jti']
      );
    });

    it('should revoke refresh token', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 1 });

      await jwtService.revokeRefreshToken('test-jti');

      expect(mockDb.query).toHaveBeenCalledWith(
        'DELETE FROM refresh_tokens WHERE jti = $1',
        ['test-jti']
      );
    });

    it('should revoke all user tokens', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 2 });

      await jwtService.revokeAllUserTokens('user-123');

      expect(mockDb.query).toHaveBeenCalledWith(
        'DELETE FROM refresh_tokens WHERE user_id = $1',
        ['user-123']
      );
    });
  });

  describe('token cleanup', () => {
    it('should clean up expired tokens', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [], rowCount: 5 }) // Expired refresh tokens
        .mockResolvedValueOnce({ rows: [], rowCount: 3 }) // Expired blacklist entries
        .mockResolvedValueOnce({ rows: [], rowCount: 2 }); // Expired sessions

      await jwtService.cleanupExpiredTokens();

      expect(mockDb.query).toHaveBeenCalledWith('DELETE FROM refresh_tokens WHERE expires_at <= NOW()');
      expect(mockDb.query).toHaveBeenCalledWith('DELETE FROM token_blacklist WHERE expires_at <= NOW()');
      expect(mockLogger.info).toHaveBeenCalledWith('Token cleanup completed', {
        expired_refresh_tokens: 5,
        expired_blacklist_entries: 3,
      });
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      mockDb.query.mockRejectedValue(new Error('Database connection failed'));

      const payload = {
        user_id: 'user-123',
        organization_id: 'org-456',
        email: 'test@fortium.dev',
        role: 'developer' as UserRole,
      };

      await expect(jwtService.generateTokenPair(payload)).rejects.toThrow('Database connection failed');
    });

    it('should handle malformed tokens', async () => {
      const malformedToken = 'not.a.valid.jwt.token';

      await expect(jwtService.verifyAccessToken(malformedToken)).rejects.toThrow('Invalid or expired access token');
    });
  });
});

describe('Role-based Permission System', () => {
  const jwtService = new JWTService(mockDb, mockLogger);

  describe('permission inheritance', () => {
    it('should inherit team lead permissions for managers', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 1 });

      const payload = {
        user_id: 'user-123',
        organization_id: 'org-456',
        email: 'manager@fortium.dev',
        role: 'manager' as UserRole,
        team_memberships: [
          { team_id: 'team-1', team_role: 'lead' as TeamRole },
          { team_id: 'team-2', team_role: 'member' as TeamRole }
        ]
      };

      const result = await jwtService.generateTokenPair(payload);
      const decoded = jwt.decode(result.access_token) as any;

      // Should have both manager permissions and team lead permissions
      expect(decoded.permissions).toContainEqual({
        resource: 'teams',
        action: 'update',
        condition: 'team_lead'
      });
    });

    it('should not add team lead permissions for regular team members', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 1 });

      const payload = {
        user_id: 'user-123',
        organization_id: 'org-456',
        email: 'developer@fortium.dev',
        role: 'developer' as UserRole,
        team_memberships: [
          { team_id: 'team-1', team_role: 'member' as TeamRole }
        ]
      };

      const result = await jwtService.generateTokenPair(payload);
      const decoded = jwt.decode(result.access_token) as any;

      // Should not have team lead permissions
      expect(decoded.permissions).not.toContainEqual({
        resource: 'teams',
        action: 'update',
        condition: 'team_lead'
      });
    });
  });

  describe('complex permission scenarios', () => {
    it('should handle multiple team memberships correctly', () => {
      const userPayload: any = {
        user_id: 'user-123',
        organization_id: 'org-456',
        email: 'test@fortium.dev',
        role: 'developer' as UserRole,
        team_memberships: [
          { team_id: 'team-1', team_role: 'member' as TeamRole },
          { team_id: 'team-2', team_role: 'lead' as TeamRole }
        ],
        permissions: [
          { resource: 'metrics', action: 'read', condition: 'own_or_team' },
          { resource: 'teams', action: 'update', condition: 'team_lead' }
        ]
      };

      // Should have access to team-1 metrics as member
      expect(jwtService.hasPermission(
        userPayload,
        'metrics',
        'read',
        { team_id: 'team-1' }
      )).toBe(true);

      // Should be able to update team-2 as lead
      expect(jwtService.hasPermission(
        userPayload,
        'teams',
        'update',
        { team_ids: ['team-2'] }
      )).toBe(true);

      // Should not be able to update team-1 as member
      expect(jwtService.hasPermission(
        userPayload,
        'teams',
        'update',
        { team_ids: ['team-1'] }
      )).toBe(false);
    });
  });
});