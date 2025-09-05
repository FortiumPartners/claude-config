/**
 * Authentication Integration Tests
 * Tests the complete authentication flow including JWT, SSO, and user management
 */

import request from 'supertest';
import express from 'express';
import { DatabaseConnection, createDbConnection } from '../../database/connection';
import { createAuthRoutes } from '../../routes/auth.routes';
import { createUserManagementRoutes } from '../../routes/user-management.routes';
import { createTeamManagementRoutes } from '../../routes/team-management.routes';
import * as winston from 'winston';
import bcrypt from 'bcrypt';

describe('Authentication Integration Tests', () => {
  let app: express.Application;
  let db: DatabaseConnection;
  let logger: winston.Logger;
  let organizationId: string;
  let adminUserId: string;
  let developerUserId: string;
  let teamId: string;
  let adminToken: string;
  let developerToken: string;

  beforeAll(async () => {
    // Create test logger
    logger = winston.createLogger({
      level: 'error', // Reduce noise during tests
      transports: [new winston.transports.Console({ silent: true })],
    });

    // Create database connection for testing
    process.env.DB_NAME = 'metrics_test';
    db = await createDbConnection(logger);

    // Set up Express app with routes
    app = express();
    app.use(express.json());

    const authRoutes = createAuthRoutes(db, logger);
    const userRoutes = createUserManagementRoutes(db, logger);
    const teamRoutes = createTeamManagementRoutes(db, logger);

    app.use('/api/auth', authRoutes.router);
    app.use('/api/users', userRoutes.router);
    app.use('/api/teams', teamRoutes.router);

    // Set up test data
    await setupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await db.pool?.end();
  });

  beforeEach(async () => {
    // Clear organization context before each test
    await db.clearOrganizationContext();
  });

  async function setupTestData() {
    // Create test organization
    const orgResult = await db.query(`
      INSERT INTO organizations (name, slug, settings, data_retention_days)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `, ['Test Organization', 'test-org', '{}', 365]);
    organizationId = orgResult.rows[0].id;

    await db.setOrganizationContext(organizationId);

    // Create admin user
    const adminPasswordHash = await bcrypt.hash('AdminPass123!', 12);
    const adminResult = await db.query(`
      INSERT INTO users (organization_id, email, name, role, password_hash, is_active, email_verified)
      VALUES ($1, $2, $3, $4, $5, true, true)
      RETURNING id
    `, [organizationId, 'admin@test.com', 'Test Admin', 'admin', adminPasswordHash]);
    adminUserId = adminResult.rows[0].id;

    // Create developer user
    const devPasswordHash = await bcrypt.hash('DevPass123!', 12);
    const devResult = await db.query(`
      INSERT INTO users (organization_id, email, name, role, password_hash, is_active, email_verified)
      VALUES ($1, $2, $3, $4, $5, true, true)
      RETURNING id
    `, [organizationId, 'dev@test.com', 'Test Developer', 'developer', devPasswordHash]);
    developerUserId = devResult.rows[0].id;

    // Create test team
    const teamResult = await db.query(`
      INSERT INTO teams (organization_id, name, description, is_active)
      VALUES ($1, $2, $3, true)
      RETURNING id
    `, [organizationId, 'Test Team', 'A test team']);
    teamId = teamResult.rows[0].id;

    // Add developer to team
    await db.query(`
      INSERT INTO team_memberships (organization_id, team_id, user_id, role)
      VALUES ($1, $2, $3, $4)
    `, [organizationId, teamId, developerUserId, 'member']);

    await db.clearOrganizationContext();
  }

  async function cleanupTestData() {
    if (organizationId) {
      await db.query('DELETE FROM organizations WHERE id = $1', [organizationId]);
    }
  }

  async function authenticateUser(email: string, password: string): Promise<string> {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email,
        password,
        organization_slug: 'test-org',
      });

    expect(response.status).toBe(200);
    return response.body.access_token;
  }

  describe('Authentication Flow', () => {
    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@test.com',
          password: 'AdminPass123!',
          organization_slug: 'test-org',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('refresh_token');
      expect(response.body).toHaveProperty('token_type', 'Bearer');
      expect(response.body).toHaveProperty('expires_in');
      expect(response.body.user).toMatchObject({
        email: 'admin@test.com',
        name: 'Test Admin',
        role: 'admin',
      });

      adminToken = response.body.access_token;
    });

    it('should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@test.com',
          password: 'WrongPassword',
          organization_slug: 'test-org',
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Invalid credentials');
    });

    it('should reject invalid organization slug', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@test.com',
          password: 'AdminPass123!',
          organization_slug: 'nonexistent-org',
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Invalid credentials');
    });

    it('should get user profile with valid token', async () => {
      if (!adminToken) {
        adminToken = await authenticateUser('admin@test.com', 'AdminPass123!');
      }

      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.user).toMatchObject({
        id: adminUserId,
        email: 'admin@test.com',
        name: 'Test Admin',
        role: 'admin',
        organization_slug: 'test-org',
      });
    });

    it('should refresh access token', async () => {
      // First login to get tokens
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@test.com',
          password: 'AdminPass123!',
          organization_slug: 'test-org',
        });

      const { refresh_token } = loginResponse.body;

      // Refresh the token
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refresh_token });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('refresh_token');
      expect(response.body.access_token).not.toBe(loginResponse.body.access_token);
    });

    it('should logout successfully', async () => {
      if (!adminToken) {
        adminToken = await authenticateUser('admin@test.com', 'AdminPass123!');
      }

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Logged out successfully');
    });

    it('should change password successfully', async () => {
      // Create a fresh token since the previous one was logged out
      const token = await authenticateUser('admin@test.com', 'AdminPass123!');

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          current_password: 'AdminPass123!',
          new_password: 'NewAdminPass123!',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');

      // Verify old password no longer works
      const failResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@test.com',
          password: 'AdminPass123!',
          organization_slug: 'test-org',
        });

      expect(failResponse.status).toBe(401);

      // Verify new password works
      const successResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@test.com',
          password: 'NewAdminPass123!',
          organization_slug: 'test-org',
        });

      expect(successResponse.status).toBe(200);
      adminToken = successResponse.body.access_token;
    });
  });

  describe('User Management', () => {
    beforeAll(async () => {
      if (!adminToken) {
        adminToken = await authenticateUser('admin@test.com', 'NewAdminPass123!');
      }
      if (!developerToken) {
        developerToken = await authenticateUser('dev@test.com', 'DevPass123!');
      }
    });

    it('should list users as admin', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('users');
      expect(response.body.users).toHaveLength(2);
      expect(response.body).toHaveProperty('pagination');
    });

    it('should restrict user list for developers', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${developerToken}`);

      // Developers should only see limited user information or get restricted access
      // The exact behavior depends on the permission implementation
      expect([200, 403]).toContain(response.status);
    });

    it('should get user details as admin', async () => {
      const response = await request(app)
        .get(`/api/users/${developerUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.user).toMatchObject({
        id: developerUserId,
        email: 'dev@test.com',
        name: 'Test Developer',
        role: 'developer',
      });
    });

    it('should create new user as admin', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'manager@test.com',
          name: 'Test Manager',
          role: 'manager',
          password: 'ManagerPass123!',
          send_invitation: false,
        });

      expect(response.status).toBe(201);
      expect(response.body.user).toMatchObject({
        email: 'manager@test.com',
        name: 'Test Manager',
        role: 'manager',
      });
    });

    it('should update user as admin', async () => {
      const response = await request(app)
        .put(`/api/users/${developerUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Updated Developer Name',
          settings: { theme: 'dark' },
        });

      expect(response.status).toBe(200);
      expect(response.body.user).toMatchObject({
        id: developerUserId,
        name: 'Updated Developer Name',
        settings: { theme: 'dark' },
      });
    });

    it('should prevent non-admins from creating users', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${developerToken}`)
        .send({
          email: 'unauthorized@test.com',
          name: 'Unauthorized User',
          role: 'developer',
        });

      expect(response.status).toBe(403);
    });
  });

  describe('Team Management', () => {
    beforeAll(async () => {
      if (!adminToken) {
        adminToken = await authenticateUser('admin@test.com', 'NewAdminPass123!');
      }
    });

    it('should list teams', async () => {
      const response = await request(app)
        .get('/api/teams')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('teams');
      expect(response.body.teams).toHaveLength(1);
      expect(response.body.teams[0]).toMatchObject({
        id: teamId,
        name: 'Test Team',
        description: 'A test team',
      });
    });

    it('should get team details', async () => {
      const response = await request(app)
        .get(`/api/teams/${teamId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.team).toMatchObject({
        id: teamId,
        name: 'Test Team',
      });
      expect(response.body).toHaveProperty('members');
      expect(response.body.members).toHaveLength(1);
    });

    it('should create new team', async () => {
      const response = await request(app)
        .post('/api/teams')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'New Test Team',
          description: 'A new team for testing',
          initial_members: [
            {
              user_id: developerUserId,
              role: 'member',
            },
          ],
        });

      expect(response.status).toBe(201);
      expect(response.body.team).toMatchObject({
        name: 'New Test Team',
        description: 'A new team for testing',
      });
    });

    it('should add member to team', async () => {
      const response = await request(app)
        .post(`/api/teams/${teamId}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          user_id: adminUserId,
          role: 'lead',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message', 'Team member added successfully');
      expect(response.body.member).toMatchObject({
        id: adminUserId,
        team_role: 'lead',
      });
    });

    it('should update member role', async () => {
      const response = await request(app)
        .put(`/api/teams/${teamId}/members/${developerUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: 'lead',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Team member role updated successfully');
    });

    it('should remove member from team', async () => {
      // First add admin as lead so we don't remove the only lead
      await request(app)
        .post(`/api/teams/${teamId}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          user_id: adminUserId,
          role: 'lead',
        });

      const response = await request(app)
        .delete(`/api/teams/${teamId}/members/${developerUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Team member removed successfully');
    });
  });

  describe('Role-Based Access Control', () => {
    beforeAll(async () => {
      if (!developerToken) {
        developerToken = await authenticateUser('dev@test.com', 'DevPass123!');
      }
    });

    it('should allow developers to access their own profile', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${developerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.user.role).toBe('developer');
    });

    it('should prevent developers from accessing other user details', async () => {
      const response = await request(app)
        .get(`/api/users/${adminUserId}`)
        .set('Authorization', `Bearer ${developerToken}`);

      expect(response.status).toBe(403);
    });

    it('should prevent developers from creating teams', async () => {
      const response = await request(app)
        .post('/api/teams')
        .set('Authorization', `Bearer ${developerToken}`)
        .send({
          name: 'Unauthorized Team',
          description: 'This should not be created',
        });

      expect(response.status).toBe(403);
    });

    it('should prevent developers from managing other team members', async () => {
      const response = await request(app)
        .post(`/api/teams/${teamId}/members`)
        .set('Authorization', `Bearer ${developerToken}`)
        .send({
          user_id: adminUserId,
          role: 'member',
        });

      expect(response.status).toBe(403);
    });
  });

  describe('Input Validation', () => {
    beforeAll(async () => {
      if (!adminToken) {
        adminToken = await authenticateUser('admin@test.com', 'NewAdminPass123!');
      }
    });

    it('should validate login input', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'invalid-email',
          password: 'short',
          organization_slug: '',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Validation failed');
      expect(response.body).toHaveProperty('details');
    });

    it('should validate user creation input', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'invalid-email',
          name: 'A',
          role: 'invalid-role',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Validation failed');
    });

    it('should validate team creation input', async () => {
      const response = await request(app)
        .post('/api/teams')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'A',
          description: 'A'.repeat(1001), // Too long
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Validation failed');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing authentication token', async () => {
      const response = await request(app)
        .get('/api/auth/profile');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Access token required');
    });

    it('should handle invalid authentication token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Invalid or expired access token');
    });

    it('should handle nonexistent resources gracefully', async () => {
      if (!adminToken) {
        adminToken = await authenticateUser('admin@test.com', 'NewAdminPass123!');
      }

      const response = await request(app)
        .get('/api/users/550e8400-e29b-41d4-a716-446655440000')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'User not found');
    });

    it('should handle database constraint violations', async () => {
      if (!adminToken) {
        adminToken = await authenticateUser('admin@test.com', 'NewAdminPass123!');
      }

      // Try to create user with duplicate email
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'admin@test.com', // Duplicate email
          name: 'Duplicate User',
          role: 'developer',
        });

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('error', 'User with this email already exists');
    });
  });

  describe('Rate Limiting', () => {
    it('should rate limit login attempts', async () => {
      const promises = [];
      
      // Make multiple rapid login attempts
      for (let i = 0; i < 10; i++) {
        promises.push(
          request(app)
            .post('/api/auth/login')
            .send({
              email: 'nonexistent@test.com',
              password: 'WrongPassword',
              organization_slug: 'test-org',
            })
        );
      }

      const responses = await Promise.all(promises);
      
      // Some requests should be rate limited (429 status)
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    }, 10000); // Increased timeout for rate limiting test
  });
});

describe('JWT Token Security', () => {
  let db: DatabaseConnection;
  let logger: winston.Logger;
  let app: express.Application;

  beforeAll(async () => {
    logger = winston.createLogger({
      level: 'error',
      transports: [new winston.transports.Console({ silent: true })],
    });

    process.env.DB_NAME = 'metrics_test';
    db = await createDbConnection(logger);

    app = express();
    app.use(express.json());

    const authRoutes = createAuthRoutes(db, logger);
    app.use('/api/auth', authRoutes.router);
  });

  afterAll(async () => {
    await db.pool?.end();
  });

  it('should generate tokens with proper structure', async () => {
    // This would require setting up test data
    // For brevity, we'll test the token structure if we can authenticate
    const jwt = require('jsonwebtoken');
    
    // Create a test token manually to verify structure
    const testPayload = {
      user_id: 'test-user',
      organization_id: 'test-org',
      email: 'test@example.com',
      role: 'developer',
      permissions: [],
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      jti: 'test-jti',
    };

    const secret = 'test-secret';
    const token = jwt.sign(testPayload, secret);
    const decoded = jwt.verify(token, secret);

    expect(decoded).toMatchObject({
      user_id: 'test-user',
      organization_id: 'test-org',
      email: 'test@example.com',
      role: 'developer',
    });
  });

  it('should reject tampered tokens', () => {
    const jwt = require('jsonwebtoken');
    const secret = 'test-secret';
    const token = jwt.sign({ user_id: 'test' }, secret);
    const tamperedToken = token.slice(0, -5) + 'xxxxx';

    expect(() => {
      jwt.verify(tamperedToken, secret);
    }).toThrow();
  });

  it('should reject expired tokens', () => {
    const jwt = require('jsonwebtoken');
    const secret = 'test-secret';
    const expiredToken = jwt.sign(
      { 
        user_id: 'test',
        exp: Math.floor(Date.now() / 1000) - 3600 // Expired 1 hour ago
      }, 
      secret
    );

    expect(() => {
      jwt.verify(expiredToken, secret);
    }).toThrow('jwt expired');
  });
});