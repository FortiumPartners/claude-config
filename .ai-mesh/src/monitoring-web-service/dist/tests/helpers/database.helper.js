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
exports.testDbConfig = void 0;
exports.createTestDatabase = createTestDatabase;
exports.cleanupTestDatabase = cleanupTestDatabase;
exports.seedTestData = seedTestData;
const connection_1 = require("../../database/connection");
const winston = __importStar(require("winston"));
const createTestLogger = () => {
    return winston.createLogger({
        level: 'error',
        format: winston.format.json(),
        transports: [new winston.transports.Console({ silent: true })]
    });
};
async function createTestDatabase(config) {
    const testConfig = {
        host: config?.host || process.env.DB_HOST || 'localhost',
        port: config?.port || parseInt(process.env.DB_PORT || '5432'),
        database: config?.database || process.env.DB_NAME || 'metrics_test',
        user: config?.user || process.env.DB_USER || 'metrics_user',
        password: config?.password || process.env.DB_PASSWORD || 'test_password',
        max: 5,
        idleTimeoutMillis: 1000,
        connectionTimeoutMillis: 1000,
    };
    const logger = createTestLogger();
    const connection = new connection_1.PostgreSQLConnection(testConfig, logger);
    return connection;
}
async function cleanupTestDatabase(connection) {
    try {
        await connection.query('TRUNCATE TABLE metrics_events CASCADE');
        await connection.query('TRUNCATE TABLE user_sessions CASCADE');
        await connection.query('TRUNCATE TABLE refresh_tokens CASCADE');
        await connection.query('TRUNCATE TABLE token_blacklist CASCADE');
        await connection.query('TRUNCATE TABLE teams CASCADE');
        await connection.query('TRUNCATE TABLE users CASCADE');
        await connection.query('TRUNCATE TABLE organizations CASCADE');
        if ('pool' in connection && connection.pool) {
            await connection.pool.end();
        }
    }
    catch (error) {
        console.warn('Database cleanup warning:', error);
    }
}
async function seedTestData(connection) {
    await connection.query(`INSERT INTO organizations (id, name, slug, settings) 
     VALUES ($1, $2, $3, $4) 
     ON CONFLICT (id) DO NOTHING`, ['org-test-123', 'Test Organization', 'test-org', '{}']);
    await connection.query(`INSERT INTO users (id, organization_id, email, password_hash, role, profile) 
     VALUES ($1, $2, $3, $4, $5, $6) 
     ON CONFLICT (id) DO NOTHING`, [
        'user-test-123',
        'org-test-123',
        'test@example.com',
        '$2b$10$test.hash.value',
        'developer',
        '{"name": "Test User"}'
    ]);
    await connection.query(`INSERT INTO teams (id, organization_id, name, description) 
     VALUES ($1, $2, $3, $4) 
     ON CONFLICT (id) DO NOTHING`, ['team-test-123', 'org-test-123', 'Test Team', 'A test team']);
}
exports.testDbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'metrics_test',
    user: process.env.DB_USER || 'metrics_user',
    password: process.env.DB_PASSWORD || 'test_password',
};
//# sourceMappingURL=database.helper.js.map