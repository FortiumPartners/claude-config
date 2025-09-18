/**
 * Authentication Middleware Unit Tests
 * Sprint 9.1: Comprehensive Test Suite Development
 * Coverage Target: >85% for middleware
 */

import { authMiddleware, optionalAuthMiddleware } from '../../../auth/auth.middleware';
import { JwtService } from '../../../services/jwt.service';
import { TEST_CONSTANTS, TestUtils } from '../../setup';

// Mock dependencies
jest.mock('../../../services/jwt.service');

const MockedJwtService = JwtService as jest.MockedClass<typeof JwtService>;

describe('Auth Middleware', () => {
  let mockJwtService: jest.Mocked<JwtService>;
  let mockRequest: any;
  let mockResponse: any;
  let mockNext: jest.Mock;

  beforeEach(() => {
    // Create mock JWT service
    mockJwtService = {
      verifyAccessToken: jest.fn(),
      extractTokenFromHeader: jest.fn(),
      decodeTokenWithoutVerification: jest.fn(),
      generateAccessToken: jest.fn(),
      generateRefreshToken: jest.fn(),
      verifyRefreshToken: jest.fn(),
      generateTokenPair: jest.fn(),
      isTokenExpired: jest.fn()
    } as any;

    MockedJwtService.mockImplementation(() => mockJwtService);

    mockRequest = TestUtils.createMockRequest();
    mockResponse = TestUtils.createMockResponse();
    mockNext = TestUtils.createMockNext();

    jest.clearAllMocks();
  });

  describe('authMiddleware', () => {
    const validToken = 'valid-jwt-token';
    const mockTokenPayload = {
      userId: TEST_CONSTANTS.TEST_USER_ID,
      tenantId: TEST_CONSTANTS.TEST_TENANT_ID,
      email: TEST_CONSTANTS.VALID_EMAIL,
      role: 'developer',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 900
    };

    it('should authenticate valid token successfully', async () => {
      mockRequest.headers.authorization = `Bearer ${validToken}`;
      mockJwtService.extractTokenFromHeader.mockReturnValue(validToken);
      mockJwtService.verifyAccessToken.mockResolvedValue(mockTokenPayload);

      await authMiddleware(mockRequest, mockResponse, mockNext);

      expect(mockRequest.user).toEqual({
        userId: mockTokenPayload.userId,
        tenantId: mockTokenPayload.tenantId,
        email: mockTokenPayload.email,
        role: mockTokenPayload.role
      });
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should reject request without authorization header', async () => {
      delete mockRequest.headers.authorization;

      await authMiddleware(mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authorization header required',
        code: 'MISSING_AUTH_HEADER'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject request with invalid authorization format', async () => {
      mockRequest.headers.authorization = 'InvalidFormat token123';
      mockJwtService.extractTokenFromHeader.mockReturnValue(null);

      await authMiddleware(mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid authorization header format',
        code: 'INVALID_AUTH_FORMAT'
      });
    });

    it('should reject request with expired token', async () => {
      mockRequest.headers.authorization = `Bearer ${validToken}`;
      mockJwtService.extractTokenFromHeader.mockReturnValue(validToken);
      
      const expiredError = new Error('Token expired');
      expiredError.name = 'TokenExpiredError';
      mockJwtService.verifyAccessToken.mockRejectedValue(expiredError);

      await authMiddleware(mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    });

    it('should reject request with invalid token', async () => {
      mockRequest.headers.authorization = `Bearer invalid-token`;
      mockJwtService.extractTokenFromHeader.mockReturnValue('invalid-token');
      
      const invalidError = new Error('Invalid token');
      invalidError.name = 'JsonWebTokenError';
      mockJwtService.verifyAccessToken.mockRejectedValue(invalidError);

      await authMiddleware(mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    });

    it('should handle JWT service errors gracefully', async () => {
      mockRequest.headers.authorization = `Bearer ${validToken}`;
      mockJwtService.extractTokenFromHeader.mockReturnValue(validToken);
      
      const serviceError = new Error('JWT service unavailable');
      mockJwtService.verifyAccessToken.mockRejectedValue(serviceError);

      await authMiddleware(mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication service error',
        code: 'AUTH_SERVICE_ERROR'
      });
    });

    it('should handle missing token payload fields', async () => {
      mockRequest.headers.authorization = `Bearer ${validToken}`;
      mockJwtService.extractTokenFromHeader.mockReturnValue(validToken);
      
      const incompletePayload = {
        userId: TEST_CONSTANTS.TEST_USER_ID,
        // Missing tenantId, email, role
      };
      mockJwtService.verifyAccessToken.mockResolvedValue(incompletePayload as any);

      await authMiddleware(mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid token payload',
        code: 'INVALID_TOKEN_PAYLOAD'
      });
    });

    it('should handle empty token', async () => {
      mockRequest.headers.authorization = 'Bearer ';
      mockJwtService.extractTokenFromHeader.mockReturnValue(null);

      await authMiddleware(mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid authorization header format',
        code: 'INVALID_AUTH_FORMAT'
      });
    });

    it('should validate tenant ID format from token', async () => {
      mockRequest.headers.authorization = `Bearer ${validToken}`;
      mockJwtService.extractTokenFromHeader.mockReturnValue(validToken);
      
      const invalidTenantPayload = {
        ...mockTokenPayload,
        tenantId: 'invalid-uuid-format'
      };
      mockJwtService.verifyAccessToken.mockResolvedValue(invalidTenantPayload);

      await authMiddleware(mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid tenant ID in token',
        code: 'INVALID_TENANT_ID'
      });
    });
  });

  describe('optionalAuthMiddleware', () => {
    const validToken = 'valid-jwt-token';
    const mockTokenPayload = {
      userId: TEST_CONSTANTS.TEST_USER_ID,
      tenantId: TEST_CONSTANTS.TEST_TENANT_ID,
      email: TEST_CONSTANTS.VALID_EMAIL,
      role: 'developer'
    };

    it('should authenticate user when valid token provided', async () => {
      mockRequest.headers.authorization = `Bearer ${validToken}`;
      mockJwtService.extractTokenFromHeader.mockReturnValue(validToken);
      mockJwtService.verifyAccessToken.mockResolvedValue(mockTokenPayload);

      await optionalAuthMiddleware(mockRequest, mockResponse, mockNext);

      expect(mockRequest.user).toEqual({
        userId: mockTokenPayload.userId,
        tenantId: mockTokenPayload.tenantId,
        email: mockTokenPayload.email,
        role: mockTokenPayload.role
      });
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should continue without authentication when no token provided', async () => {
      delete mockRequest.headers.authorization;

      await optionalAuthMiddleware(mockRequest, mockResponse, mockNext);

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should continue without authentication when invalid token provided', async () => {
      mockRequest.headers.authorization = 'Bearer invalid-token';
      mockJwtService.extractTokenFromHeader.mockReturnValue('invalid-token');
      
      const invalidError = new Error('Invalid token');
      mockJwtService.verifyAccessToken.mockRejectedValue(invalidError);

      await optionalAuthMiddleware(mockRequest, mockResponse, mockNext);

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should continue without authentication when expired token provided', async () => {
      mockRequest.headers.authorization = 'Bearer expired-token';
      mockJwtService.extractTokenFromHeader.mockReturnValue('expired-token');
      
      const expiredError = new Error('Token expired');
      expiredError.name = 'TokenExpiredError';
      mockJwtService.verifyAccessToken.mockRejectedValue(expiredError);

      await optionalAuthMiddleware(mockRequest, mockResponse, mockNext);

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should handle JWT service errors gracefully', async () => {
      mockRequest.headers.authorization = `Bearer ${validToken}`;
      mockJwtService.extractTokenFromHeader.mockReturnValue(validToken);
      
      const serviceError = new Error('JWT service unavailable');
      mockJwtService.verifyAccessToken.mockRejectedValue(serviceError);

      await optionalAuthMiddleware(mockRequest, mockResponse, mockNext);

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('role-based authorization', () => {
    const createRoleMiddleware = (requiredRoles: string[]) => {
      return (req: any, res: any, next: any) => {
        if (!req.user) {
          return res.status(401).json({ error: 'Authentication required' });
        }
        
        if (!requiredRoles.includes(req.user.role)) {
          return res.status(403).json({ error: 'Insufficient permissions' });
        }
        
        next();
      };
    };

    it('should allow access for authorized role', async () => {
      const adminMiddleware = createRoleMiddleware(['admin', 'super_admin']);
      mockRequest.user = { ...mockTokenPayload, role: 'admin' };

      adminMiddleware(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should deny access for unauthorized role', async () => {
      const adminMiddleware = createRoleMiddleware(['admin']);
      mockRequest.user = { ...mockTokenPayload, role: 'developer' };

      adminMiddleware(mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Insufficient permissions' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should deny access for unauthenticated user', async () => {
      const adminMiddleware = createRoleMiddleware(['admin']);
      delete mockRequest.user;

      adminMiddleware(mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    });
  });

  describe('middleware integration', () => {
    it('should set correct user context for downstream middleware', async () => {
      const validToken = 'valid-jwt-token';
      const mockTokenPayload = {
        userId: TEST_CONSTANTS.TEST_USER_ID,
        tenantId: TEST_CONSTANTS.TEST_TENANT_ID,
        email: TEST_CONSTANTS.VALID_EMAIL,
        role: 'developer',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 900
      };

      mockRequest.headers.authorization = `Bearer ${validToken}`;
      mockJwtService.extractTokenFromHeader.mockReturnValue(validToken);
      mockJwtService.verifyAccessToken.mockResolvedValue(mockTokenPayload);

      await authMiddleware(mockRequest, mockResponse, mockNext);

      // Verify user object structure
      expect(mockRequest.user).toMatchObject({
        userId: expect.any(String),
        tenantId: expect.any(String),
        email: expect.stringMatching(/^[^@]+@[^@]+\.[^@]+$/),
        role: expect.any(String)
      });

      // Verify no sensitive information is exposed
      expect(mockRequest.user.iat).toBeUndefined();
      expect(mockRequest.user.exp).toBeUndefined();
    });

    it('should handle concurrent authentication requests', async () => {
      const validToken = 'valid-jwt-token';
      const mockTokenPayload = {
        userId: TEST_CONSTANTS.TEST_USER_ID,
        tenantId: TEST_CONSTANTS.TEST_TENANT_ID,
        email: TEST_CONSTANTS.VALID_EMAIL,
        role: 'developer',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 900
      };

      // Simulate multiple concurrent requests
      const requests = Array.from({ length: 5 }, (_, i) => ({
        ...TestUtils.createMockRequest(),
        headers: { authorization: `Bearer ${validToken}` },
        requestId: `req-${i}`
      }));

      const responses = requests.map(() => TestUtils.createMockResponse());
      const nexts = requests.map(() => TestUtils.createMockNext());

      mockJwtService.extractTokenFromHeader.mockReturnValue(validToken);
      mockJwtService.verifyAccessToken.mockResolvedValue(mockTokenPayload);

      // Process all requests concurrently
      await Promise.all(
        requests.map((req, i) => authMiddleware(req, responses[i], nexts[i]))
      );

      // Verify all requests were processed successfully
      nexts.forEach(next => expect(next).toHaveBeenCalledWith());
      responses.forEach(res => expect(res.status).not.toHaveBeenCalled());
    });
  });
});