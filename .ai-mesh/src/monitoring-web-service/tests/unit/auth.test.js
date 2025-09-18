// Unit tests for authentication and authorization
// Part of Phase 2: Infrastructure & Integration - Testing Pipeline

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const { generateToken, verifyToken } = require('../../src/middleware/auth');

describe('Authentication & Authorization', () => {
  const validUser = {
    id: 1,
    email: 'test@fortium.dev',
    org_id: 'fortium-partners',
    role: 'admin'
  };

  const validToken = generateToken(validUser);

  describe('JWT Token Generation', () => {
    test('should generate valid JWT token', () => {
      const token = generateToken(validUser);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      expect(decoded.id).toBe(validUser.id);
      expect(decoded.email).toBe(validUser.email);
      expect(decoded.org_id).toBe(validUser.org_id);
    });

    test('should include expiration time', () => {
      const token = generateToken(validUser);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp > decoded.iat).toBe(true);
    });

    test('should handle different user roles', () => {
      const roles = ['admin', 'user', 'viewer', 'analyst'];
      
      roles.forEach(role => {
        const user = { ...validUser, role };
        const token = generateToken(user);
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        expect(decoded.role).toBe(role);
      });
    });
  });

  describe('JWT Token Verification', () => {
    test('should verify valid token', () => {
      const result = verifyToken(validToken);
      
      expect(result.valid).toBe(true);
      expect(result.payload.id).toBe(validUser.id);
      expect(result.payload.email).toBe(validUser.email);
    });

    test('should reject invalid token', () => {
      const invalidToken = 'invalid.token.here';
      const result = verifyToken(invalidToken);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should reject expired token', () => {
      const expiredToken = jwt.sign(
        { ...validUser, exp: Math.floor(Date.now() / 1000) - 3600 },
        process.env.JWT_SECRET
      );
      
      const result = verifyToken(expiredToken);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('expired');
    });

    test('should reject token with wrong secret', () => {
      const wrongToken = jwt.sign(validUser, 'wrong-secret');
      const result = verifyToken(wrongToken);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Protected Endpoints', () => {
    test('should reject requests without token', async () => {
      await request(app)
        .get('/api/v1/metrics')
        .expect(401);
    });

    test('should reject requests with invalid token', async () => {
      await request(app)
        .get('/api/v1/metrics')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    test('should accept requests with valid token', async () => {
      const response = await request(app)
        .get('/api/v1/metrics')
        .set('Authorization', `Bearer ${validToken}`);
      
      // Should not be 401 (may be 200, 404, or other depending on implementation)
      expect(response.status).not.toBe(401);
    });

    test('should include user context in authenticated requests', async () => {
      const response = await request(app)
        .get('/api/v1/user/profile')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);
      
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.id).toBe(validUser.id);
      expect(response.body.user.email).toBe(validUser.email);
    });
  });

  describe('Organization-based Access Control', () => {
    test('should allow access to own organization data', async () => {
      const response = await request(app)
        .get(`/api/v1/organizations/${validUser.org_id}/metrics`)
        .set('Authorization', `Bearer ${validToken}`);
      
      expect(response.status).not.toBe(403);
    });

    test('should deny access to other organization data', async () => {
      await request(app)
        .get('/api/v1/organizations/other-org/metrics')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(403);
    });

    test('should validate organization ID in token matches request', async () => {
      const otherOrgUser = { ...validUser, org_id: 'other-org' };
      const otherOrgToken = generateToken(otherOrgUser);
      
      await request(app)
        .get(`/api/v1/organizations/${validUser.org_id}/metrics`)
        .set('Authorization', `Bearer ${otherOrgToken}`)
        .expect(403);
    });
  });

  describe('Role-based Access Control', () => {
    const roles = [
      { role: 'admin', canDelete: true, canWrite: true, canRead: true },
      { role: 'user', canDelete: false, canWrite: true, canRead: true },
      { role: 'viewer', canDelete: false, canWrite: false, canRead: true },
      { role: 'analyst', canDelete: false, canWrite: true, canRead: true }
    ];

    roles.forEach(({ role, canDelete, canWrite, canRead }) => {
      describe(`Role: ${role}`, () => {
        const user = { ...validUser, role };
        const token = generateToken(user);

        test(`should ${canRead ? 'allow' : 'deny'} read operations`, async () => {
          const response = await request(app)
            .get('/api/v1/metrics')
            .set('Authorization', `Bearer ${token}`);
          
          if (canRead) {
            expect(response.status).not.toBe(403);
          } else {
            expect(response.status).toBe(403);
          }
        });

        test(`should ${canWrite ? 'allow' : 'deny'} write operations`, async () => {
          const response = await request(app)
            .post('/api/v1/metrics')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'test-metric', value: 100 });
          
          if (canWrite) {
            expect(response.status).not.toBe(403);
          } else {
            expect(response.status).toBe(403);
          }
        });

        test(`should ${canDelete ? 'allow' : 'deny'} delete operations`, async () => {
          const response = await request(app)
            .delete('/api/v1/metrics/1')
            .set('Authorization', `Bearer ${token}`);
          
          if (canDelete) {
            expect(response.status).not.toBe(403);
          } else {
            expect(response.status).toBe(403);
          }
        });
      });
    });
  });

  describe('SSO Integration', () => {
    test('should return available SSO providers', async () => {
      const response = await request(app)
        .get('/api/v1/auth/sso/providers/fortium-partners')
        .expect(200);
      
      expect(response.body).toHaveProperty('providers');
      expect(Array.isArray(response.body.providers)).toBe(true);
    });

    test('should validate SSO callback with valid token', async () => {
      const ssoToken = jwt.sign({
        sub: 'user123',
        email: 'user@fortium.dev',
        org: 'fortium-partners'
      }, process.env.SSO_SECRET);

      const response = await request(app)
        .post('/api/v1/auth/sso/callback')
        .send({ token: ssoToken, org_id: 'fortium-partners' })
        .expect(200);
      
      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('user');
    });

    test('should reject SSO callback with invalid token', async () => {
      await request(app)
        .post('/api/v1/auth/sso/callback')
        .send({ token: 'invalid-token', org_id: 'fortium-partners' })
        .expect(401);
    });
  });
});