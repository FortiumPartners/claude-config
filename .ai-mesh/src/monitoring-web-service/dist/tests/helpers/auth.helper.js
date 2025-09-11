"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTestOrganization = createTestOrganization;
exports.createTestUser = createTestUser;
exports.createTestTeam = createTestTeam;
exports.addUserToTeam = addUserToTeam;
exports.createAuthenticatedUser = createAuthenticatedUser;
exports.createManagerWithTeam = createManagerWithTeam;
exports.cleanupTestAuth = cleanupTestAuth;
const jwt_service_1 = require("../../services/jwt.service");
const winston = __importStar(require("winston"));
const bcrypt = __importStar(require("bcrypt"));
const createTestLogger = () => {
    return winston.createLogger({
        level: 'error',
        format: winston.format.json(),
        transports: [new winston.transports.Console({ silent: true })]
    });
};
async function createTestOrganization(connection, orgData = {}) {
    const organization = {
        id: orgData.id || `org-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        name: orgData.name || 'Test Organization',
        slug: orgData.slug || `test-org-${Date.now()}`,
        settings: orgData.settings || {},
    };
    await connection.query(`INSERT INTO organizations (id, name, slug, settings, created_at, updated_at) 
     VALUES ($1, $2, $3, $4, NOW(), NOW())`, [organization.id, organization.name, organization.slug, JSON.stringify(organization.settings)]);
    return organization;
}
async function createTestUser(connection, userData = {}) {
    const hashedPassword = await bcrypt.hash(userData.password_hash || 'test-password-123', 10);
    const user = {
        id: userData.id || `user-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        organization_id: userData.organization_id || 'org-test-default',
        email: userData.email || `test-${Date.now()}@example.com`,
        password_hash: hashedPassword,
        role: userData.role || 'developer',
        profile: userData.profile || { name: 'Test User' },
    };
    await connection.query(`INSERT INTO users (id, organization_id, email, password_hash, role, profile, created_at, updated_at) 
     VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`, [
        user.id,
        user.organization_id,
        user.email,
        user.password_hash,
        user.role,
        JSON.stringify(user.profile)
    ]);
    return user;
}
async function createTestTeam(connection, teamData = {}) {
    const team = {
        id: teamData.id || `team-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        organization_id: teamData.organization_id || 'org-test-default',
        name: teamData.name || 'Test Team',
        description: teamData.description || 'A test team for unit testing',
    };
    await connection.query(`INSERT INTO teams (id, organization_id, name, description, created_at, updated_at) 
     VALUES ($1, $2, $3, $4, NOW(), NOW())`, [team.id, team.organization_id, team.name, team.description]);
    return team;
}
async function addUserToTeam(connection, userId, teamId, role = 'member') {
    await connection.query(`INSERT INTO team_memberships (user_id, team_id, role, created_at) 
     VALUES ($1, $2, $3, NOW()) 
     ON CONFLICT (user_id, team_id) DO UPDATE SET role = $3`, [userId, teamId, role]);
}
async function createAuthenticatedUser(connection, userData = {}) {
    let orgId = userData.organization_id;
    if (!orgId) {
        const org = await createTestOrganization(connection);
        orgId = org.id;
    }
    const user = await createTestUser(connection, { ...userData, organization_id: orgId });
    const logger = createTestLogger();
    const jwtService = new jwt_service_1.JWTService(connection, logger);
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
async function createManagerWithTeam(connection) {
    const org = await createTestOrganization(connection);
    const team = await createTestTeam(connection, { organization_id: org.id });
    const user = await createTestUser(connection, {
        organization_id: org.id,
        role: 'manager',
        email: 'manager@test.com'
    });
    await addUserToTeam(connection, user.id, team.id, 'lead');
    const logger = createTestLogger();
    const jwtService = new jwt_service_1.JWTService(connection, logger);
    const tokenPayload = {
        user_id: user.id,
        organization_id: user.organization_id,
        email: user.email,
        role: user.role,
        team_memberships: [{ team_id: team.id, team_role: 'lead' }]
    };
    const tokens = await jwtService.generateTokenPair(tokenPayload);
    return { user, team, tokens };
}
async function cleanupTestAuth(connection) {
    try {
        await connection.query('DELETE FROM team_memberships WHERE user_id LIKE $1', ['user-%']);
        await connection.query('DELETE FROM refresh_tokens WHERE user_id LIKE $1', ['user-%']);
        await connection.query('DELETE FROM token_blacklist');
        await connection.query('DELETE FROM teams WHERE id LIKE $1', ['team-%']);
        await connection.query('DELETE FROM users WHERE id LIKE $1', ['user-%']);
        await connection.query('DELETE FROM organizations WHERE id LIKE $1', ['org-%']);
    }
    catch (error) {
        console.warn('Auth cleanup warning:', error);
    }
}
//# sourceMappingURL=auth.helper.js.map