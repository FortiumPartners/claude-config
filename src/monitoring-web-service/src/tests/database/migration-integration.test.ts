import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { Client } from 'pg';
import { MigrationManager } from '../../database/migrations';
import { DatabaseConnection } from '../../database/connection';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';

describe('Migration Integration Tests', () => {
  let testContainer: StartedTestContainer;
  let client: Client;
  let dbConnection: DatabaseConnection;
  let migrationManager: MigrationManager;
  let tempMigrationsPath: string;

  beforeAll(async () => {
    // Start TimescaleDB container
    testContainer = await new GenericContainer('timescale/timescaledb:latest-pg16')
      .withExposedPorts(5432)
      .withEnvironment({
        POSTGRES_DB: 'migration_test',
        POSTGRES_USER: 'test_user',
        POSTGRES_PASSWORD: 'test_password',
      })
      .start();

    const host = testContainer.getHost();
    const port = testContainer.getMappedPort(5432);

    // Create client for setup
    client = new Client({
      host,
      port,
      database: 'migration_test',
      user: 'test_user',
      password: 'test_password',
    });

    await client.connect();

    // Enable TimescaleDB
    await client.query('CREATE EXTENSION IF NOT EXISTS timescaledb;');

    // Create test database connection
    const mockDbConnection = {
      query: jest.fn().mockImplementation((sql: string, params?: any[]) => {
        return client.query(sql, params);
      }),
      queryWithRetry: jest.fn().mockImplementation((sql: string, params?: any[]) => {
        return client.query(sql, params);
      }),
      withTransaction: jest.fn().mockImplementation(async (callback: () => Promise<any>) => {
        await client.query('BEGIN');
        try {
          const result = await callback();
          await client.query('COMMIT');
          return result;
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        }
      }),
      setOrganizationContext: jest.fn(),
      clearContext: jest.fn(),
      getPoolStats: jest.fn(),
      healthCheck: jest.fn(),
      close: jest.fn(),
    } as unknown as DatabaseConnection;

    dbConnection = mockDbConnection;

    // Create temporary migrations directory
    tempMigrationsPath = join(__dirname, 'temp_migrations');
    if (existsSync(tempMigrationsPath)) {
      rmSync(tempMigrationsPath, { recursive: true });
    }
    mkdirSync(tempMigrationsPath, { recursive: true });

    migrationManager = new MigrationManager(dbConnection, tempMigrationsPath);
  }, 120000);

  afterAll(async () => {
    await client?.end();
    await testContainer?.stop();
    
    // Clean up temp migrations
    if (existsSync(tempMigrationsPath)) {
      rmSync(tempMigrationsPath, { recursive: true });
    }
  });

  beforeEach(async () => {
    // Clean up any existing migrations table
    await client.query('DROP TABLE IF EXISTS schema_migrations;');
    
    // Clean up temp migration files
    if (existsSync(tempMigrationsPath)) {
      rmSync(tempMigrationsPath, { recursive: true });
      mkdirSync(tempMigrationsPath, { recursive: true });
    }
  });

  describe('Migration Table Initialization', () => {
    test('should initialize migrations table correctly', async () => {
      await migrationManager.initializeMigrationsTable();

      // Check if table exists
      const tableResult = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'schema_migrations'
        );
      `);

      expect(tableResult.rows[0].exists).toBe(true);

      // Check if index exists
      const indexResult = await client.query(`
        SELECT EXISTS (
          SELECT FROM pg_class c 
          JOIN pg_namespace n ON n.oid = c.relnamespace 
          WHERE n.nspname = 'public' 
          AND c.relname = 'idx_schema_migrations_applied_at'
        );
      `);

      expect(indexResult.rows[0].exists).toBe(true);
    });
  });

  describe('Full Migration Workflow', () => {
    test('should create, apply, and rollback migrations', async () => {
      // Create test migration files
      const migration1 = `-- migrate:up
CREATE TABLE test_users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- migrate:down
DROP TABLE IF EXISTS test_users;`;

      const migration2 = `-- migrate:up
ALTER TABLE test_users ADD COLUMN email VARCHAR(255);
CREATE UNIQUE INDEX idx_test_users_email ON test_users (email);

-- migrate:down
DROP INDEX IF EXISTS idx_test_users_email;
ALTER TABLE test_users DROP COLUMN IF EXISTS email;`;

      writeFileSync(join(tempMigrationsPath, '20230101120000_create_users.sql'), migration1);
      writeFileSync(join(tempMigrationsPath, '20230102120000_add_email_to_users.sql'), migration2);

      // Step 1: Check initial status
      let status = await migrationManager.getStatus();
      expect(status.applied.length).toBe(0);
      expect(status.pending.length).toBe(2);

      // Step 2: Apply first migration
      let result = await migrationManager.migrate('20230101120000');
      expect(result.applied.length).toBe(1);
      expect(result.applied[0].version).toBe('20230101120000');
      expect(result.skipped.length).toBe(1);

      // Verify table was created
      let tableExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'test_users'
        );
      `);
      expect(tableExists.rows[0].exists).toBe(true);

      // Step 3: Apply all migrations
      result = await migrationManager.migrate();
      expect(result.applied.length).toBe(1);
      expect(result.applied[0].version).toBe('20230102120000');

      // Verify email column was added
      let columnExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'test_users'
          AND column_name = 'email'
        );
      `);
      expect(columnExists.rows[0].exists).toBe(true);

      // Step 4: Check final status
      status = await migrationManager.getStatus();
      expect(status.applied.length).toBe(2);
      expect(status.pending.length).toBe(0);

      // Step 5: Rollback last migration
      const rollbackResult = await migrationManager.rollback();
      expect(rollbackResult.rolledBack.length).toBe(1);
      expect(rollbackResult.rolledBack[0].version).toBe('20230102120000');

      // Verify email column was removed
      columnExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'test_users'
          AND column_name = 'email'
        );
      `);
      expect(columnExists.rows[0].exists).toBe(false);

      // Step 6: Rollback to beginning
      const fullRollbackResult = await migrationManager.rollback('00000000000000'); // Before all migrations
      expect(fullRollbackResult.rolledBack.length).toBe(1);
      expect(fullRollbackResult.rolledBack[0].version).toBe('20230101120000');

      // Verify table was removed
      tableExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'test_users'
        );
      `);
      expect(tableExists.rows[0].exists).toBe(false);

      // Final status should show all migrations as pending again
      status = await migrationManager.getStatus();
      expect(status.applied.length).toBe(0);
      expect(status.pending.length).toBe(2);
    });

    test('should handle migration failures gracefully', async () => {
      // Create migration with invalid SQL
      const badMigration = `-- migrate:up
CREATE TABLE invalid_syntax (
  id INVALID_TYPE PRIMARY KEY
);

-- migrate:down
DROP TABLE IF EXISTS invalid_syntax;`;

      writeFileSync(join(tempMigrationsPath, '20230101120000_bad_migration.sql'), badMigration);

      // Should fail to apply
      await expect(migrationManager.migrate()).rejects.toThrow();

      // Should not create migration record on failure
      const status = await migrationManager.getStatus();
      expect(status.applied.length).toBe(0);
      expect(status.pending.length).toBe(1);
    });

    test('should validate migration consistency', async () => {
      // Create migration file
      const migration = `-- migrate:up
CREATE TABLE test_validation (id SERIAL PRIMARY KEY);

-- migrate:down
DROP TABLE IF EXISTS test_validation;`;

      writeFileSync(join(tempMigrationsPath, '20230101120000_test_validation.sql'), migration);

      // Apply migration
      await migrationManager.migrate();

      // Validation should pass
      let validation = await migrationManager.validateMigrations();
      expect(validation.isValid).toBe(true);
      expect(validation.issues.length).toBe(0);

      // Remove migration file to simulate missing file
      rmSync(join(tempMigrationsPath, '20230101120000_test_validation.sql'));

      // Validation should now fail
      validation = await migrationManager.validateMigrations();
      expect(validation.isValid).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
      expect(validation.issues[0]).toContain('has no corresponding file');
    });
  });

  describe('Complex Schema Operations', () => {
    test('should handle TimescaleDB hypertable operations', async () => {
      // Create migration with hypertable
      const hypertableMigration = `-- migrate:up
CREATE TABLE metrics (
  time TIMESTAMPTZ NOT NULL,
  device_id UUID NOT NULL,
  value DOUBLE PRECISION NOT NULL
);

SELECT create_hypertable('metrics', 'time');

-- Create index for performance
CREATE INDEX idx_metrics_device_time ON metrics (device_id, time DESC);

-- migrate:down
DROP TABLE IF EXISTS metrics CASCADE;`;

      writeFileSync(join(tempMigrationsPath, '20230101120000_create_metrics_hypertable.sql'), hypertableMigration);

      // Apply migration
      const result = await migrationManager.migrate();
      expect(result.applied.length).toBe(1);

      // Verify hypertable was created
      const hypertableResult = await client.query(`
        SELECT EXISTS (
          SELECT FROM timescaledb_information.hypertables
          WHERE hypertable_name = 'metrics'
        );
      `);
      expect(hypertableResult.rows[0].exists).toBe(true);

      // Rollback should work
      const rollbackResult = await migrationManager.rollback();
      expect(rollbackResult.rolledBack.length).toBe(1);

      // Verify hypertable was removed
      const hypertableRemovedResult = await client.query(`
        SELECT EXISTS (
          SELECT FROM timescaledb_information.hypertables
          WHERE hypertable_name = 'metrics'
        );
      `);
      expect(hypertableRemovedResult.rows[0].exists).toBe(false);
    });
  });
});