import { MigrationManager, Migration, MigrationRecord } from '../../database/migrations';
import { DatabaseConnection } from '../../database/connection';

describe('MigrationManager Unit Tests', () => {
  let migrationManager: MigrationManager;
  let mockDb: jest.Mocked<DatabaseConnection>;

  beforeEach(() => {
    mockDb = {
      query: jest.fn(),
      queryWithRetry: jest.fn(),
      withTransaction: jest.fn(),
      setOrganizationContext: jest.fn(),
      clearContext: jest.fn(),
      getPoolStats: jest.fn(),
      healthCheck: jest.fn(),
      close: jest.fn(),
    } as any;

    // Mock withTransaction to execute the callback immediately
    mockDb.withTransaction.mockImplementation(async (callback) => {
      return await callback({} as any); // Mock PoolClient
    });

    migrationManager = new MigrationManager(mockDb, '/mock/migrations/path');
  });

  describe('initializeMigrationsTable', () => {
    test('should create migrations table and index', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await migrationManager.initializeMigrationsTable();

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS schema_migrations'),
      );
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied_at'),
      );
    });
  });

  describe('getAppliedMigrations', () => {
    test('should return applied migrations in correct format', async () => {
      const mockRows = [
        {
          version: '20230101120000',
          name: 'initial_schema',
          applied_at: '2023-01-01T12:00:00.000Z',
          rollback_sql: 'DROP TABLE test;',
        },
      ];

      mockDb.query.mockResolvedValueOnce({ rows: mockRows } as any);

      const result = await migrationManager.getAppliedMigrations();

      expect(result).toEqual([
        {
          version: '20230101120000',
          name: 'initial_schema',
          applied_at: new Date('2023-01-01T12:00:00.000Z'),
          rollback_sql: 'DROP TABLE test;',
        },
      ]);
    });

    test('should handle null rollback_sql', async () => {
      const mockRows = [
        {
          version: '20230101120000',
          name: 'initial_schema',
          applied_at: '2023-01-01T12:00:00.000Z',
          rollback_sql: null,
        },
      ];

      mockDb.query.mockResolvedValueOnce({ rows: mockRows } as any);

      const result = await migrationManager.getAppliedMigrations();

      expect(result[0].rollback_sql).toBeUndefined();
    });
  });

  describe('parseMigrationContent', () => {
    test('should parse migration content with up and down sections', () => {
      const content = `
-- migrate:up
CREATE TABLE test (id SERIAL PRIMARY KEY);

-- migrate:down
DROP TABLE test;
      `;

      const migrationManager = new MigrationManager(mockDb);
      const result = (migrationManager as any).parseMigrationContent(content);

      expect(result.up.trim()).toBe('CREATE TABLE test (id SERIAL PRIMARY KEY);');
      expect(result.down.trim()).toBe('DROP TABLE test;');
    });

    test('should handle content without sections', () => {
      const content = 'CREATE TABLE test (id SERIAL PRIMARY KEY);';

      const migrationManager = new MigrationManager(mockDb);
      const result = (migrationManager as any).parseMigrationContent(content);

      expect(result.up).toBe('CREATE TABLE test (id SERIAL PRIMARY KEY);');
      expect(result.down).toBe('-- No rollback SQL provided');
    });

    test('should handle only up section', () => {
      const content = `
-- migrate:up
CREATE TABLE test (id SERIAL PRIMARY KEY);
      `;

      const migrationManager = new MigrationManager(mockDb);
      const result = (migrationManager as any).parseMigrationContent(content);

      expect(result.up.trim()).toBe('CREATE TABLE test (id SERIAL PRIMARY KEY);');
      expect(result.down).toBe('');
    });
  });

  describe('parseTimestamp', () => {
    test('should parse timestamp correctly', () => {
      const migrationManager = new MigrationManager(mockDb);
      const result = (migrationManager as any).parseTimestamp('20230115143052');

      expect(result).toEqual(new Date(2023, 0, 15, 14, 30, 52)); // Month is 0-based
    });
  });

  describe('migrate', () => {
    test('should apply pending migrations', async () => {
      const mockMigrations: Migration[] = [
        {
          version: '20230101120000',
          name: 'initial_schema',
          up: 'CREATE TABLE test (id SERIAL PRIMARY KEY);',
          down: 'DROP TABLE test;',
          timestamp: new Date('2023-01-01T12:00:00.000Z'),
        },
      ];

      jest.spyOn(migrationManager, 'initializeMigrationsTable').mockResolvedValueOnce();
      jest.spyOn(migrationManager, 'getPendingMigrations').mockResolvedValueOnce(mockMigrations);

      mockDb.query.mockResolvedValue({ rows: [] } as any);

      const result = await migrationManager.migrate();

      expect(result.applied).toHaveLength(1);
      expect(result.applied[0].version).toBe('20230101120000');
      expect(result.skipped).toHaveLength(0);

      // Should execute the migration SQL and record it
      expect(mockDb.query).toHaveBeenCalledWith('CREATE TABLE test (id SERIAL PRIMARY KEY);');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO schema_migrations'),
        ['20230101120000', 'initial_schema', 'DROP TABLE test;'],
      );
    });

    test('should handle migration failures', async () => {
      const mockMigrations: Migration[] = [
        {
          version: '20230101120000',
          name: 'failing_migration',
          up: 'INVALID SQL;',
          down: 'DROP TABLE test;',
          timestamp: new Date('2023-01-01T12:00:00.000Z'),
        },
      ];

      jest.spyOn(migrationManager, 'initializeMigrationsTable').mockResolvedValueOnce();
      jest.spyOn(migrationManager, 'getPendingMigrations').mockResolvedValueOnce(mockMigrations);

      mockDb.query.mockRejectedValueOnce(new Error('SQL syntax error'));

      await expect(migrationManager.migrate()).rejects.toThrow('SQL syntax error');
    });

    test('should apply migrations up to target version', async () => {
      const mockMigrations: Migration[] = [
        {
          version: '20230101120000',
          name: 'migration_1',
          up: 'CREATE TABLE test1 (id SERIAL PRIMARY KEY);',
          down: 'DROP TABLE test1;',
          timestamp: new Date('2023-01-01T12:00:00.000Z'),
        },
        {
          version: '20230102120000',
          name: 'migration_2',
          up: 'CREATE TABLE test2 (id SERIAL PRIMARY KEY);',
          down: 'DROP TABLE test2;',
          timestamp: new Date('2023-01-02T12:00:00.000Z'),
        },
      ];

      jest.spyOn(migrationManager, 'initializeMigrationsTable').mockResolvedValueOnce();
      jest.spyOn(migrationManager, 'getPendingMigrations').mockResolvedValueOnce(mockMigrations);

      mockDb.query.mockResolvedValue({ rows: [] } as any);

      const result = await migrationManager.migrate('20230101120000');

      expect(result.applied).toHaveLength(1);
      expect(result.applied[0].version).toBe('20230101120000');
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0].version).toBe('20230102120000');
    });
  });

  describe('rollback', () => {
    test('should rollback last migration', async () => {
      const mockApplied: MigrationRecord[] = [
        {
          version: '20230101120000',
          name: 'initial_schema',
          applied_at: new Date('2023-01-01T12:00:00.000Z'),
          rollback_sql: 'DROP TABLE test;',
        },
      ];

      jest.spyOn(migrationManager, 'getAppliedMigrations').mockResolvedValueOnce(mockApplied);
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      const result = await migrationManager.rollback();

      expect(result.rolledBack).toHaveLength(1);
      expect(result.rolledBack[0].version).toBe('20230101120000');
      expect(result.skipped).toHaveLength(0);

      // Should execute rollback SQL and remove migration record
      expect(mockDb.query).toHaveBeenCalledWith('DROP TABLE test;');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM schema_migrations'),
        ['20230101120000'],
      );
    });

    test('should skip migrations without rollback SQL', async () => {
      const mockApplied: MigrationRecord[] = [
        {
          version: '20230101120000',
          name: 'initial_schema',
          applied_at: new Date('2023-01-01T12:00:00.000Z'),
          rollback_sql: '-- No rollback SQL provided',
        },
      ];

      jest.spyOn(migrationManager, 'getAppliedMigrations').mockResolvedValueOnce(mockApplied);

      const result = await migrationManager.rollback();

      expect(result.rolledBack).toHaveLength(0);
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0].version).toBe('20230101120000');
    });

    test('should rollback to target version', async () => {
      const mockApplied: MigrationRecord[] = [
        {
          version: '20230101120000',
          name: 'migration_1',
          applied_at: new Date('2023-01-01T12:00:00.000Z'),
          rollback_sql: 'DROP TABLE test1;',
        },
        {
          version: '20230102120000',
          name: 'migration_2',
          applied_at: new Date('2023-01-02T12:00:00.000Z'),
          rollback_sql: 'DROP TABLE test2;',
        },
      ];

      jest.spyOn(migrationManager, 'getAppliedMigrations').mockResolvedValueOnce(mockApplied);
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      const result = await migrationManager.rollback('20230101120000');

      expect(result.rolledBack).toHaveLength(1);
      expect(result.rolledBack[0].version).toBe('20230102120000');
      expect(result.skipped).toHaveLength(0);
    });
  });

  describe('validateMigrations', () => {
    test('should return valid when no issues', async () => {
      const mockAvailable: Migration[] = [
        {
          version: '20230101120000',
          name: 'migration_1',
          up: 'CREATE TABLE test1;',
          down: 'DROP TABLE test1;',
          timestamp: new Date('2023-01-01T12:00:00.000Z'),
        },
      ];

      const mockApplied: MigrationRecord[] = [
        {
          version: '20230101120000',
          name: 'migration_1',
          applied_at: new Date('2023-01-01T12:00:00.000Z'),
          rollback_sql: 'DROP TABLE test1;',
        },
      ];

      jest.spyOn(migrationManager, 'getAvailableMigrations').mockResolvedValueOnce(mockAvailable);
      jest.spyOn(migrationManager, 'getAppliedMigrations').mockResolvedValueOnce(mockApplied);

      const result = await migrationManager.validateMigrations();

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    test('should detect missing migration files', async () => {
      const mockAvailable: Migration[] = [];
      const mockApplied: MigrationRecord[] = [
        {
          version: '20230101120000',
          name: 'missing_migration',
          applied_at: new Date('2023-01-01T12:00:00.000Z'),
        },
      ];

      jest.spyOn(migrationManager, 'getAvailableMigrations').mockResolvedValueOnce(mockAvailable);
      jest.spyOn(migrationManager, 'getAppliedMigrations').mockResolvedValueOnce(mockApplied);

      const result = await migrationManager.validateMigrations();

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain(
        'Applied migration 20230101120000 has no corresponding file',
      );
    });

    test('should detect duplicate versions', async () => {
      const mockAvailable: Migration[] = [
        {
          version: '20230101120000',
          name: 'migration_1',
          up: 'CREATE TABLE test1;',
          down: 'DROP TABLE test1;',
          timestamp: new Date('2023-01-01T12:00:00.000Z'),
        },
        {
          version: '20230101120000', // Duplicate version
          name: 'migration_2',
          up: 'CREATE TABLE test2;',
          down: 'DROP TABLE test2;',
          timestamp: new Date('2023-01-01T12:00:00.000Z'),
        },
      ];

      jest.spyOn(migrationManager, 'getAvailableMigrations').mockResolvedValueOnce(mockAvailable);
      jest.spyOn(migrationManager, 'getAppliedMigrations').mockResolvedValueOnce([]);

      const result = await migrationManager.validateMigrations();

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Duplicate migration versions found: 20230101120000');
    });
  });
});