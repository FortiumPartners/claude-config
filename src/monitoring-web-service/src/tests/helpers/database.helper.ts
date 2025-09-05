/**
 * Database Test Helpers
 * Helper functions for setting up and tearing down test databases
 */

import { DatabaseConnection, PostgreSQLConnection } from '../../database/connection';
import * as winston from 'winston';
import { PoolConfig } from 'pg';

// Create test-specific logger that doesn't output during tests
const createTestLogger = (): winston.Logger => {
  return winston.createLogger({
    level: 'error', // Only show errors during tests
    format: winston.format.json(),
    transports: [new winston.transports.Console({ silent: true })]
  });
};

export interface TestDatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export async function createTestDatabase(config?: Partial<TestDatabaseConfig>): Promise<DatabaseConnection> {
  const testConfig: PoolConfig = {
    host: config?.host || process.env.DB_HOST || 'localhost',
    port: config?.port || parseInt(process.env.DB_PORT || '5432'),
    database: config?.database || process.env.DB_NAME || 'metrics_test',
    user: config?.user || process.env.DB_USER || 'metrics_user',
    password: config?.password || process.env.DB_PASSWORD || 'test_password',
    max: 5, // Small pool for tests
    idleTimeoutMillis: 1000,
    connectionTimeoutMillis: 1000,
  };

  const logger = createTestLogger();
  const connection = new PostgreSQLConnection(testConfig, logger);

  return connection;
}

export async function cleanupTestDatabase(connection: DatabaseConnection): Promise<void> {
  try {
    // Clean up test data
    await connection.query('TRUNCATE TABLE metrics_events CASCADE');
    await connection.query('TRUNCATE TABLE user_sessions CASCADE');
    await connection.query('TRUNCATE TABLE refresh_tokens CASCADE');
    await connection.query('TRUNCATE TABLE token_blacklist CASCADE');
    await connection.query('TRUNCATE TABLE teams CASCADE');
    await connection.query('TRUNCATE TABLE users CASCADE');
    await connection.query('TRUNCATE TABLE organizations CASCADE');

    // Close connection if it has pool
    if ('pool' in connection && connection.pool) {
      await connection.pool.end();
    }
  } catch (error) {
    // Ignore cleanup errors - database might not exist
    console.warn('Database cleanup warning:', error);
  }
}

export async function seedTestData(connection: DatabaseConnection): Promise<void> {
  // Create test organization
  await connection.query(
    `INSERT INTO organizations (id, name, slug, settings) 
     VALUES ($1, $2, $3, $4) 
     ON CONFLICT (id) DO NOTHING`,
    ['org-test-123', 'Test Organization', 'test-org', '{}']
  );

  // Create test user
  await connection.query(
    `INSERT INTO users (id, organization_id, email, password_hash, role, profile) 
     VALUES ($1, $2, $3, $4, $5, $6) 
     ON CONFLICT (id) DO NOTHING`,
    [
      'user-test-123', 
      'org-test-123', 
      'test@example.com', 
      '$2b$10$test.hash.value', 
      'developer', 
      '{"name": "Test User"}'
    ]
  );

  // Create test team
  await connection.query(
    `INSERT INTO teams (id, organization_id, name, description) 
     VALUES ($1, $2, $3, $4) 
     ON CONFLICT (id) DO NOTHING`,
    ['team-test-123', 'org-test-123', 'Test Team', 'A test team']
  );
}

export const testDbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'metrics_test',
  user: process.env.DB_USER || 'metrics_user',
  password: process.env.DB_PASSWORD || 'test_password',
};