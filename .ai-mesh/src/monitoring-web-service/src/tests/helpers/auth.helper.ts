/**
 * Authentication Test Helpers
 * Helper functions for creating test users and authentication scenarios
 */

import { DatabaseConnection } from '../../database/connection';
import { JWTService, UserRole, TeamRole } from '../../services/jwt.service';
import * as winston from 'winston';
import * as bcrypt from 'bcrypt';

export interface TestUser {
  id: string;
  organization_id: string;
  email: string;
  password_hash: string;
  role: UserRole;
  profile?: any;
}

export interface TestOrganization {
  id: string;
  name: string;
  slug: string;
  settings?: any;
}

export interface TestTeam {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
}

// Create test-specific logger that doesn't output during tests
const createTestLogger = (): winston.Logger => {
  return winston.createLogger({
    level: 'error',
    format: winston.format.json(),
    transports: [new winston.transports.Console({ silent: true })]
  });
};

export async function createTestOrganization(
  connection: DatabaseConnection,
  orgData: Partial<TestOrganization> = {}
): Promise<TestOrganization> {
  const organization: TestOrganization = {
    id: orgData.id || `org-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    name: orgData.name || 'Test Organization',
    slug: orgData.slug || `test-org-${Date.now()}`,
    settings: orgData.settings || {},
  };

  await connection.query(
    `INSERT INTO organizations (id, name, slug, settings, created_at, updated_at) 
     VALUES ($1, $2, $3, $4, NOW(), NOW())`,
    [organization.id, organization.name, organization.slug, JSON.stringify(organization.settings)]
  );

  return organization;
}

export async function createTestUser(
  connection: DatabaseConnection,
  userData: Partial<TestUser> = {}
): Promise<TestUser> {
  const hashedPassword = await bcrypt.hash(userData.password_hash || 'test-password-123', 10);
  
  const user: TestUser = {
    id: userData.id || `user-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    organization_id: userData.organization_id || 'org-test-default',
    email: userData.email || `test-${Date.now()}@example.com`,
    password_hash: hashedPassword,
    role: userData.role || 'developer',
    profile: userData.profile || { name: 'Test User' },
  };

  await connection.query(
    `INSERT INTO users (id, organization_id, email, password_hash, role, profile, created_at, updated_at) 
     VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
    [
      user.id,
      user.organization_id,
      user.email,
      user.password_hash,
      user.role,
      JSON.stringify(user.profile)
    ]
  );

  return user;
}

export async function createTestTeam(
  connection: DatabaseConnection,
  teamData: Partial<TestTeam> = {}
): Promise<TestTeam> {
  const team: TestTeam = {
    id: teamData.id || `team-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    organization_id: teamData.organization_id || 'org-test-default',
    name: teamData.name || 'Test Team',
    description: teamData.description || 'A test team for unit testing',
  };

  await connection.query(
    `INSERT INTO teams (id, organization_id, name, description, created_at, updated_at) 
     VALUES ($1, $2, $3, $4, NOW(), NOW())`,
    [team.id, team.organization_id, team.name, team.description]
  );

  return team;
}

export async function addUserToTeam(
  connection: DatabaseConnection,
  userId: string,
  teamId: string,
  role: TeamRole = 'member'
): Promise<void> {
  await connection.query(
    `INSERT INTO team_memberships (user_id, team_id, role, created_at) 
     VALUES ($1, $2, $3, NOW()) 
     ON CONFLICT (user_id, team_id) DO UPDATE SET role = $3`,
    [userId, teamId, role]
  );
}

export async function createAuthenticatedUser(
  connection: DatabaseConnection,
  userData: Partial<TestUser> = {}
): Promise<{ user: TestUser; tokens: any }> {
  // Create organization if needed
  let orgId = userData.organization_id;
  if (!orgId) {
    const org = await createTestOrganization(connection);
    orgId = org.id;
  }

  // Create user
  const user = await createTestUser(connection, { ...userData, organization_id: orgId });

  // Generate JWT tokens
  const logger = createTestLogger();
  const jwtService = new JWTService(connection, logger);
  
  const tokenPayload = {
    user_id: user.id,
    organization_id: user.organization_id,
    email: user.email,
    role: user.role,
    team_memberships: []
  };

  const tokens = await jwtService.generateTokenPair(tokenPayload);

  return { user, tokens };
}

export async function createManagerWithTeam(
  connection: DatabaseConnection
): Promise<{ user: TestUser; team: TestTeam; tokens: any }> {
  // Create organization
  const org = await createTestOrganization(connection);
  
  // Create team
  const team = await createTestTeam(connection, { organization_id: org.id });
  
  // Create manager user
  const user = await createTestUser(connection, {
    organization_id: org.id,
    role: 'manager',
    email: 'manager@test.com'
  });

  // Add user as team lead
  await addUserToTeam(connection, user.id, team.id, 'lead');

  // Generate tokens
  const logger = createTestLogger();
  const jwtService = new JWTService(connection, logger);
  
  const tokenPayload = {
    user_id: user.id,
    organization_id: user.organization_id,
    email: user.email,
    role: user.role,
    team_memberships: [{ team_id: team.id, team_role: 'lead' as TeamRole }]
  };

  const tokens = await jwtService.generateTokenPair(tokenPayload);

  return { user, team, tokens };
}

export async function cleanupTestAuth(connection: DatabaseConnection): Promise<void> {
  try {
    await connection.query('DELETE FROM team_memberships WHERE user_id LIKE $1', ['user-%']);
    await connection.query('DELETE FROM refresh_tokens WHERE user_id LIKE $1', ['user-%']);
    await connection.query('DELETE FROM token_blacklist');
    await connection.query('DELETE FROM teams WHERE id LIKE $1', ['team-%']);
    await connection.query('DELETE FROM users WHERE id LIKE $1', ['user-%']);
    await connection.query('DELETE FROM organizations WHERE id LIKE $1', ['org-%']);
  } catch (error) {
    // Ignore cleanup errors
    console.warn('Auth cleanup warning:', error);
  }
}