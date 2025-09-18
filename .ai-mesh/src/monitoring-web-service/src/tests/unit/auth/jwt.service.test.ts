/**
 * JWT Service Unit Tests
 * Sprint 9.1: Comprehensive Test Suite Development
 * Coverage Target: >95% for authentication system
 */

import { JwtService } from '../../../services/jwt.service';
import { TEST_CONSTANTS } from '../../setup';
import jwt from 'jsonwebtoken';

// Mock jsonwebtoken
jest.mock('jsonwebtoken');
const mockedJwt = jwt as jest.Mocked<typeof jwt>;

describe('JwtService', () => {
  let jwtService: JwtService;
  
  // Mock environment variables
  const mockEnv = {
    JWT_SECRET: 'test-jwt-secret-32-chars-minimum',
    JWT_REFRESH_SECRET: 'test-jwt-refresh-secret-32-chars-minimum',
    JWT_EXPIRY: '15m',
    JWT_REFRESH_EXPIRY: '7d',
  };

  beforeEach(() => {
    // Set environment variables
    Object.entries(mockEnv).forEach(([key, value]) => {
      process.env[key] = value;
    });
    
    jwtService = new JwtService();
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up environment variables
    Object.keys(mockEnv).forEach(key => {
      delete process.env[key];
    });
  });

  describe('constructor', () => {
    it('should initialize with environment variables', () => {
      expect(jwtService).toBeDefined();
    });

    it('should throw error if JWT_SECRET is missing', () => {
      delete process.env.JWT_SECRET;
      expect(() => new JwtService()).toThrow('JWT_SECRET is required');
    });

    it('should throw error if JWT_SECRET is too short', () => {
      process.env.JWT_SECRET = 'short';
      expect(() => new JwtService()).toThrow('JWT_SECRET must be at least 32 characters');
    });

    it('should use default values for optional environment variables', () => {
      delete process.env.JWT_EXPIRY;
      delete process.env.JWT_REFRESH_EXPIRY;
      
      const service = new JwtService();
      expect(service).toBeDefined();
    });
  });

  describe('generateAccessToken', () => {
    const mockPayload = {
      userId: TEST_CONSTANTS.TEST_USER_ID,
      tenantId: TEST_CONSTANTS.TEST_TENANT_ID,
      email: TEST_CONSTANTS.VALID_EMAIL,
      role: 'developer'
    };

    it('should generate access token with correct payload', async () => {
      const mockToken = 'mocked-access-token';
      mockedJwt.sign.mockReturnValue(mockToken);

      const token = await jwtService.generateAccessToken(mockPayload);

      expect(token).toBe(mockToken);
      expect(mockedJwt.sign).toHaveBeenCalledWith(
        mockPayload,
        mockEnv.JWT_SECRET,
        { expiresIn: mockEnv.JWT_EXPIRY }
      );
    });

    it('should handle token generation errors', async () => {
      const error = new Error('Token generation failed');
      mockedJwt.sign.mockImplementation(() => {
        throw error;
      });

      await expect(jwtService.generateAccessToken(mockPayload))
        .rejects.toThrow('Token generation failed');
    });

    it('should validate payload structure', async () => {
      const invalidPayload = { userId: null };

      await expect(jwtService.generateAccessToken(invalidPayload as any))
        .rejects.toThrow('Invalid token payload');
    });
  });

  describe('generateRefreshToken', () => {
    const mockPayload = {
      userId: TEST_CONSTANTS.TEST_USER_ID,
      tenantId: TEST_CONSTANTS.TEST_TENANT_ID
    };

    it('should generate refresh token with correct payload', async () => {
      const mockToken = 'mocked-refresh-token';
      mockedJwt.sign.mockReturnValue(mockToken);

      const token = await jwtService.generateRefreshToken(mockPayload);

      expect(token).toBe(mockToken);
      expect(mockedJwt.sign).toHaveBeenCalledWith(
        mockPayload,
        mockEnv.JWT_REFRESH_SECRET,
        { expiresIn: mockEnv.JWT_REFRESH_EXPIRY }
      );
    });

    it('should handle refresh token generation errors', async () => {
      const error = new Error('Refresh token generation failed');
      mockedJwt.sign.mockImplementation(() => {
        throw error;
      });

      await expect(jwtService.generateRefreshToken(mockPayload))
        .rejects.toThrow('Refresh token generation failed');
    });
  });

  describe('verifyAccessToken', () => {
    const mockToken = 'valid-access-token';
    const mockPayload = {
      userId: TEST_CONSTANTS.TEST_USER_ID,
      tenantId: TEST_CONSTANTS.TEST_TENANT_ID,
      email: TEST_CONSTANTS.VALID_EMAIL,
      role: 'developer',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 900 // 15 minutes
    };

    it('should verify valid access token', async () => {
      mockedJwt.verify.mockReturnValue(mockPayload);

      const payload = await jwtService.verifyAccessToken(mockToken);

      expect(payload).toEqual(mockPayload);
      expect(mockedJwt.verify).toHaveBeenCalledWith(mockToken, mockEnv.JWT_SECRET);
    });

    it('should reject invalid token', async () => {
      const error = new Error('Invalid token');
      mockedJwt.verify.mockImplementation(() => {
        throw error;
      });

      await expect(jwtService.verifyAccessToken('invalid-token'))
        .rejects.toThrow('Invalid token');
    });

    it('should reject expired token', async () => {
      const expiredError = new Error('Token expired');
      expiredError.name = 'TokenExpiredError';
      mockedJwt.verify.mockImplementation(() => {
        throw expiredError;
      });

      await expect(jwtService.verifyAccessToken(mockToken))
        .rejects.toThrow('Token expired');
    });

    it('should reject malformed token', async () => {
      const malformedError = new Error('Malformed token');
      malformedError.name = 'JsonWebTokenError';
      mockedJwt.verify.mockImplementation(() => {
        throw malformedError;
      });

      await expect(jwtService.verifyAccessToken(mockToken))
        .rejects.toThrow('Malformed token');
    });
  });

  describe('verifyRefreshToken', () => {
    const mockToken = 'valid-refresh-token';
    const mockPayload = {
      userId: TEST_CONSTANTS.TEST_USER_ID,
      tenantId: TEST_CONSTANTS.TEST_TENANT_ID,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 604800 // 7 days
    };

    it('should verify valid refresh token', async () => {
      mockedJwt.verify.mockReturnValue(mockPayload);

      const payload = await jwtService.verifyRefreshToken(mockToken);

      expect(payload).toEqual(mockPayload);
      expect(mockedJwt.verify).toHaveBeenCalledWith(mockToken, mockEnv.JWT_REFRESH_SECRET);
    });

    it('should reject invalid refresh token', async () => {
      const error = new Error('Invalid refresh token');
      mockedJwt.verify.mockImplementation(() => {
        throw error;
      });

      await expect(jwtService.verifyRefreshToken('invalid-token'))
        .rejects.toThrow('Invalid refresh token');
    });
  });

  describe('generateTokenPair', () => {
    const mockPayload = {
      userId: TEST_CONSTANTS.TEST_USER_ID,
      tenantId: TEST_CONSTANTS.TEST_TENANT_ID,
      email: TEST_CONSTANTS.VALID_EMAIL,
      role: 'developer'
    };

    it('should generate both access and refresh tokens', async () => {
      const mockAccessToken = 'mock-access-token';
      const mockRefreshToken = 'mock-refresh-token';

      mockedJwt.sign
        .mockReturnValueOnce(mockAccessToken)
        .mockReturnValueOnce(mockRefreshToken);

      const tokenPair = await jwtService.generateTokenPair(mockPayload);

      expect(tokenPair).toEqual({
        accessToken: mockAccessToken,
        refreshToken: mockRefreshToken,
        expiresIn: 900, // 15 minutes in seconds
        tokenType: 'Bearer'
      });
    });

    it('should handle token pair generation errors', async () => {
      const error = new Error('Token pair generation failed');
      mockedJwt.sign.mockImplementation(() => {
        throw error;
      });

      await expect(jwtService.generateTokenPair(mockPayload))
        .rejects.toThrow('Token pair generation failed');
    });
  });

  describe('extractTokenFromHeader', () => {
    it('should extract token from Bearer header', () => {
      const authHeader = 'Bearer valid-token';
      const token = jwtService.extractTokenFromHeader(authHeader);
      expect(token).toBe('valid-token');
    });

    it('should return null for missing header', () => {
      const token = jwtService.extractTokenFromHeader(undefined);
      expect(token).toBeNull();
    });

    it('should return null for invalid header format', () => {
      const invalidHeaders = [
        'InvalidFormat',
        'Bearer',
        'Bearer ',
        'Basic token123',
      ];

      invalidHeaders.forEach(header => {
        const token = jwtService.extractTokenFromHeader(header);
        expect(token).toBeNull();
      });
    });

    it('should handle header with multiple spaces', () => {
      const authHeader = 'Bearer    token-with-spaces';
      const token = jwtService.extractTokenFromHeader(authHeader);
      expect(token).toBe('token-with-spaces');
    });
  });

  describe('isTokenExpired', () => {
    it('should return false for non-expired token', () => {
      const futureTimestamp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const payload = { exp: futureTimestamp };
      
      const isExpired = jwtService.isTokenExpired(payload);
      expect(isExpired).toBe(false);
    });

    it('should return true for expired token', () => {
      const pastTimestamp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const payload = { exp: pastTimestamp };
      
      const isExpired = jwtService.isTokenExpired(payload);
      expect(isExpired).toBe(true);
    });

    it('should return true for token without exp claim', () => {
      const payload = { userId: 'test' };
      
      const isExpired = jwtService.isTokenExpired(payload);
      expect(isExpired).toBe(true);
    });

    it('should handle edge case of exactly current time', () => {
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const payload = { exp: currentTimestamp };
      
      const isExpired = jwtService.isTokenExpired(payload);
      expect(isExpired).toBe(true); // Should be considered expired at exact time
    });
  });

  describe('decodeTokenWithoutVerification', () => {
    it('should decode valid token structure', () => {
      const mockDecodedToken = {
        userId: TEST_CONSTANTS.TEST_USER_ID,
        email: TEST_CONSTANTS.VALID_EMAIL,
        iat: Math.floor(Date.now() / 1000)
      };
      
      mockedJwt.decode.mockReturnValue(mockDecodedToken);

      const decoded = jwtService.decodeTokenWithoutVerification('valid-token');
      
      expect(decoded).toEqual(mockDecodedToken);
      expect(mockedJwt.decode).toHaveBeenCalledWith('valid-token');
    });

    it('should return null for invalid token', () => {
      mockedJwt.decode.mockReturnValue(null);

      const decoded = jwtService.decodeTokenWithoutVerification('invalid-token');
      
      expect(decoded).toBeNull();
    });

    it('should handle decode errors gracefully', () => {
      mockedJwt.decode.mockImplementation(() => {
        throw new Error('Decode error');
      });

      const decoded = jwtService.decodeTokenWithoutVerification('malformed-token');
      
      expect(decoded).toBeNull();
    });
  });
});