/**
 * Authentication Tests
 * Fortium External Metrics Web Service - Task 1.9: Testing Infrastructure
 */

import request from 'supertest';
import { createApp } from '../app';
import { JwtService } from '../auth/jwt.service';
import { PasswordService } from '../auth/password.service';
import { AuthController } from '../auth/auth.controller';
import { TEST_CONSTANTS, TestUtils } from './setup';

describe('Authentication System', () => {
  let app: any;

  beforeAll(async () => {
    app = await createApp();
  });

  describe('JWT Service', () => {
    const testPayload = {
      userId: TEST_CONSTANTS.TEST_USER_ID,
      tenantId: TEST_CONSTANTS.TEST_TENANT_ID,
      email: TEST_CONSTANTS.VALID_EMAIL,
      role: 'user',
    };

    describe('generateAccessToken', () => {
      it('should generate a valid JWT access token', () => {
        const token = JwtService.generateAccessToken(testPayload);
        
        expect(token).toBeDefined();
        expect(typeof token).toBe('string');
        expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
      });

      it('should include all required payload fields', () => {
        const token = JwtService.generateAccessToken(testPayload);
        const decoded = JwtService.verifyAccessToken(token);
        
        expect(decoded.userId).toBe(testPayload.userId);
        expect(decoded.tenantId).toBe(testPayload.tenantId);
        expect(decoded.email).toBe(testPayload.email);
        expect(decoded.role).toBe(testPayload.role);
      });
    });

    describe('generateRefreshToken', () => {
      it('should generate a valid JWT refresh token', () => {
        const refreshPayload = {
          userId: TEST_CONSTANTS.TEST_USER_ID,
          tenantId: TEST_CONSTANTS.TEST_TENANT_ID,
          tokenId: 'test-token-id',
        };

        const token = JwtService.generateRefreshToken(refreshPayload);
        
        expect(token).toBeDefined();
        expect(typeof token).toBe('string');
        expect(token.split('.')).toHaveLength(3);
      });
    });

    describe('verifyAccessToken', () => {
      it('should verify valid tokens', () => {
        const token = JwtService.generateAccessToken(testPayload);
        const decoded = JwtService.verifyAccessToken(token);
        
        expect(decoded.userId).toBe(testPayload.userId);
        expect(decoded.exp).toBeDefined();
        expect(decoded.iat).toBeDefined();
      });

      it('should throw error for invalid tokens', () => {
        expect(() => {
          JwtService.verifyAccessToken('invalid-token');
        }).toThrow();
      });

      it('should throw error for malformed tokens', () => {
        expect(() => {
          JwtService.verifyAccessToken('not.a.jwt');
        }).toThrow();
      });
    });

    describe('generateTokenPair', () => {
      it('should generate both access and refresh tokens', () => {
        const tokenPair = JwtService.generateTokenPair(
          testPayload.userId,
          testPayload.tenantId,
          testPayload.email,
          testPayload.role
        );

        expect(tokenPair.accessToken).toBeDefined();
        expect(tokenPair.refreshToken).toBeDefined();
        expect(tokenPair.expiresIn).toBeGreaterThan(0);
        expect(tokenPair.refreshExpiresIn).toBeGreaterThan(0);
      });
    });

    describe('extractTokenFromHeader', () => {
      it('should extract token from Bearer header', () => {
        const token = JwtService.extractTokenFromHeader('Bearer test-token');
        expect(token).toBe('test-token');
      });

      it('should return null for invalid header format', () => {
        expect(JwtService.extractTokenFromHeader('Invalid header')).toBeNull();
        expect(JwtService.extractTokenFromHeader('Bearer')).toBeNull();
        expect(JwtService.extractTokenFromHeader('')).toBeNull();
        expect(JwtService.extractTokenFromHeader(undefined)).toBeNull();
      });
    });
  });

  describe('Password Service', () => {
    describe('validatePassword', () => {
      it('should accept strong passwords', () => {
        const validation = PasswordService.validatePassword(TEST_CONSTANTS.VALID_PASSWORD);
        
        expect(validation.isValid).toBe(true);
        expect(validation.errors).toHaveLength(0);
        expect(validation.score).toBeGreaterThan(60);
      });

      it('should reject weak passwords', () => {
        const validation = PasswordService.validatePassword(TEST_CONSTANTS.INVALID_PASSWORD);
        
        expect(validation.isValid).toBe(false);
        expect(validation.errors.length).toBeGreaterThan(0);
        expect(validation.score).toBeLessThan(40);
      });

      it('should require minimum length', () => {
        const validation = PasswordService.validatePassword('Abc1!');
        
        expect(validation.isValid).toBe(false);
        expect(validation.errors.some(error => 
          error.includes('at least 8 characters')
        )).toBe(true);
      });

      it('should require uppercase letters', () => {
        const validation = PasswordService.validatePassword('password123!');
        
        expect(validation.isValid).toBe(false);
        expect(validation.errors.some(error => 
          error.includes('uppercase letter')
        )).toBe(true);
      });

      it('should require lowercase letters', () => {
        const validation = PasswordService.validatePassword('PASSWORD123!');
        
        expect(validation.isValid).toBe(false);
        expect(validation.errors.some(error => 
          error.includes('lowercase letter')
        )).toBe(true);
      });

      it('should require numbers', () => {
        const validation = PasswordService.validatePassword('Password!');
        
        expect(validation.isValid).toBe(false);
        expect(validation.errors.some(error => 
          error.includes('number')
        )).toBe(true);
      });

      it('should require special characters', () => {
        const validation = PasswordService.validatePassword('Password123');
        
        expect(validation.isValid).toBe(false);
        expect(validation.errors.some(error => 
          error.includes('special character')
        )).toBe(true);
      });
    });

    describe('hashPassword', () => {
      it('should hash valid passwords', async () => {
        const hashedPassword = await PasswordService.hashPassword(TEST_CONSTANTS.VALID_PASSWORD);
        
        expect(hashedPassword).toBeDefined();
        expect(hashedPassword).not.toBe(TEST_CONSTANTS.VALID_PASSWORD);
        expect(hashedPassword.startsWith('$2b$')).toBe(true);
      });

      it('should reject invalid passwords', async () => {
        await expect(
          PasswordService.hashPassword(TEST_CONSTANTS.INVALID_PASSWORD)
        ).rejects.toThrow();
      });
    });

    describe('verifyPassword', () => {
      it('should verify correct passwords', async () => {
        const hashedPassword = await PasswordService.hashPassword(TEST_CONSTANTS.VALID_PASSWORD);
        const isValid = await PasswordService.verifyPassword(TEST_CONSTANTS.VALID_PASSWORD, hashedPassword);
        
        expect(isValid).toBe(true);
      });

      it('should reject incorrect passwords', async () => {
        const hashedPassword = await PasswordService.hashPassword(TEST_CONSTANTS.VALID_PASSWORD);
        const isValid = await PasswordService.verifyPassword('wrong-password', hashedPassword);
        
        expect(isValid).toBe(false);
      });
    });

    describe('generateSecurePassword', () => {
      it('should generate valid passwords', () => {
        const password = PasswordService.generateSecurePassword();
        const validation = PasswordService.validatePassword(password);
        
        expect(validation.isValid).toBe(true);
        expect(password.length).toBeGreaterThanOrEqual(16);
      });

      it('should generate passwords of specified length', () => {
        const password = PasswordService.generateSecurePassword(20);
        expect(password.length).toBe(20);
      });

      it('should generate unique passwords', () => {
        const password1 = PasswordService.generateSecurePassword();
        const password2 = PasswordService.generateSecurePassword();
        
        expect(password1).not.toBe(password2);
      });
    });
  });

  describe('Authentication API Endpoints', () => {
    const validLoginData = {
      email: TEST_CONSTANTS.VALID_EMAIL,
      password: 'Password123!', // This matches the mock user's password
      tenantId: TEST_CONSTANTS.TEST_TENANT_ID,
    };

    describe('POST /api/v1/auth/login', () => {
      it('should login with valid credentials', async () => {
        const response = await request(app)
          .post('/api/v1/auth/login')
          .send(validLoginData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.tokens.accessToken).toBeDefined();
        expect(response.body.data.tokens.refreshToken).toBeDefined();
        expect(response.body.data.user.email).toBe(validLoginData.email);
      });

      it('should reject invalid credentials', async () => {
        const response = await request(app)
          .post('/api/v1/auth/login')
          .send({
            ...validLoginData,
            password: 'wrong-password',
          })
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBeDefined();
      });

      it('should validate required fields', async () => {
        const response = await request(app)
          .post('/api/v1/auth/login')
          .send({
            email: validLoginData.email,
            // Missing password and tenantId
          })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBeDefined();
      });

      it('should validate email format', async () => {
        const response = await request(app)
          .post('/api/v1/auth/login')
          .send({
            ...validLoginData,
            email: 'invalid-email',
          })
          .expect(400);

        expect(response.body.success).toBe(false);
      });

      it('should validate tenant ID format', async () => {
        const response = await request(app)
          .post('/api/v1/auth/login')
          .send({
            ...validLoginData,
            tenantId: 'invalid-uuid',
          })
          .expect(400);

        expect(response.body.success).toBe(false);
      });
    });

    describe('POST /api/v1/auth/refresh', () => {
      let refreshToken: string;

      beforeEach(async () => {
        const loginResponse = await request(app)
          .post('/api/v1/auth/login')
          .send(validLoginData);
        
        refreshToken = loginResponse.body.data.tokens.refreshToken;
      });

      it('should refresh tokens with valid refresh token', async () => {
        const response = await request(app)
          .post('/api/v1/auth/refresh')
          .send({ refreshToken })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.tokens.accessToken).toBeDefined();
        expect(response.body.data.tokens.refreshToken).toBeDefined();
      });

      it('should reject invalid refresh tokens', async () => {
        const response = await request(app)
          .post('/api/v1/auth/refresh')
          .send({ refreshToken: 'invalid-token' })
          .expect(401);

        expect(response.body.success).toBe(false);
      });

      it('should require refresh token', async () => {
        const response = await request(app)
          .post('/api/v1/auth/refresh')
          .send({})
          .expect(400);

        expect(response.body.success).toBe(false);
      });
    });

    describe('POST /api/v1/auth/logout', () => {
      it('should logout successfully', async () => {
        const response = await request(app)
          .post('/api/v1/auth/logout')
          .send({})
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('Logout successful');
      });
    });

    describe('GET /api/v1/auth/profile', () => {
      let accessToken: string;

      beforeEach(async () => {
        const loginResponse = await request(app)
          .post('/api/v1/auth/login')
          .send(validLoginData);
        
        accessToken = loginResponse.body.data.tokens.accessToken;
      });

      it('should get profile with valid token', async () => {
        const response = await request(app)
          .get('/api/v1/auth/profile')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.email).toBe(validLoginData.email);
        expect(response.body.data.tenantId).toBe(validLoginData.tenantId);
      });

      it('should reject requests without token', async () => {
        const response = await request(app)
          .get('/api/v1/auth/profile')
          .expect(401);

        expect(response.body.success).toBe(false);
      });

      it('should reject requests with invalid token', async () => {
        const response = await request(app)
          .get('/api/v1/auth/profile')
          .set('Authorization', 'Bearer invalid-token')
          .expect(401);

        expect(response.body.success).toBe(false);
      });
    });

    describe('POST /api/v1/auth/validate-password', () => {
      it('should validate strong passwords', async () => {
        const response = await request(app)
          .post('/api/v1/auth/validate-password')
          .send({ password: TEST_CONSTANTS.VALID_PASSWORD })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.isValid).toBe(true);
        expect(response.body.data.score).toBeGreaterThan(60);
      });

      it('should reject weak passwords', async () => {
        const response = await request(app)
          .post('/api/v1/auth/validate-password')
          .send({ password: TEST_CONSTANTS.INVALID_PASSWORD })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.isValid).toBe(false);
        expect(response.body.data.errors.length).toBeGreaterThan(0);
      });
    });

    describe('GET /api/v1/auth/health', () => {
      it('should return auth service health', async () => {
        const response = await request(app)
          .get('/api/v1/auth/health')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.service).toContain('Authentication');
        expect(response.body.features).toBeDefined();
      });
    });
  });
});