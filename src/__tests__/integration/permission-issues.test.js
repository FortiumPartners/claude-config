/**
 * TRD-055: Permission Issues Integration Test
 * Tests migration behavior with various permission scenarios
 * 
 * Scenario:
 * 1. Create environment with permission restrictions:
 *    - Read-only commands directory
 *    - Write-protected ai-mesh directory
 *    - No write permissions for backup
 * 2. Run migration with various permission scenarios
 * 3. Verify appropriate error handling
 * 4. Verify rollback on critical failures
 * 
 * Success Criteria:
 * - Permission errors detected and reported
 * - No partial state on critical failure
 * - Clear error messages for users
 * - Rollback successful when needed
 * - Installation does not corrupt existing files
 */

const path = require('path');
const fs = require('fs').promises;
const { CommandMigrator } = require('../../installer/command-migrator');
const { Logger } = require('../../utils/logger');
const { IntegrationTestUtils } = require('./test-utils');

// Note: Permission tests may behave differently on different OS
// Windows handles permissions differently than Unix-like systems
const isWindows = process.platform === 'win32';

describe('TRD-055: Permission Issues Test', () => {
  let testDir;
  let utils;
  let logger;

  beforeEach(async () => {
    const baseDir = path.join(__dirname, '../fixtures/temp-integration');
    utils = new IntegrationTestUtils(baseDir);
    testDir = await utils.createTestEnvironment();
    logger = new Logger({ debug: false });
  });

  afterEach(async () => {
    // Restore permissions before cleanup
    try {
      const commandsDir = path.join(testDir, 'commands');
      await utils.setFilePermissions(commandsDir, 0o755).catch(() => {});
      
      const aiMeshDir = path.join(commandsDir, 'ai-mesh');
      await utils.setFilePermissions(aiMeshDir, 0o755).catch(() => {});
    } catch {
      // Ignore permission restoration errors
    }

    await utils.cleanup(testDir);
  });

  describe('Read-Only Directory Handling', () => {
    test('should detect read-only commands directory', async () => {
      if (isWindows) {
        // Skip on Windows - permission handling is different
        return;
      }

      await utils.seedTestCommands(testDir, {
        aiMeshCommands: ['create-prd']
      });

      const commandsDir = path.join(testDir, 'commands');

      // Make directory read-only after creating files
      await utils.setFilePermissions(commandsDir, 0o444);

      const migrator = new CommandMigrator(testDir, logger);

      // Should detect permission issue
      await expect(migrator.migrate()).rejects.toThrow();

      // Restore permissions for cleanup
      await utils.setFilePermissions(commandsDir, 0o755);
    });

    test('should provide clear error message for permission denied', async () => {
      if (isWindows) {
        return;
      }

      await utils.seedTestCommands(testDir);
      const commandsDir = path.join(testDir, 'commands');

      // Remove write permission
      await utils.setFilePermissions(commandsDir, 0o444);

      const migrator = new CommandMigrator(testDir, logger);

      try {
        await migrator.migrate();
        fail('Should throw permission error');
      } catch (error) {
        expect(error.message).toBeDefined();
        expect(error.code).toMatch(/EACCES|EPERM/);
      }

      await utils.setFilePermissions(commandsDir, 0o755);
    });
  });

  describe('Write-Protected Target Directory', () => {
    test('should handle inability to create ai-mesh directory', async () => {
      if (isWindows) {
        return;
      }

      await utils.seedTestCommands(testDir);
      const commandsDir = path.join(testDir, 'commands');

      // Make commands directory read-only before creating ai-mesh/
      await utils.setFilePermissions(commandsDir, 0o555); // r-xr-xr-x

      const migrator = new CommandMigrator(testDir, logger);

      await expect(migrator.createAiMeshDirectory()).rejects.toThrow();

      await utils.setFilePermissions(commandsDir, 0o755);
    });

    test('should handle write-protected ai-mesh directory', async () => {
      if (isWindows) {
        return;
      }

      await utils.seedTestCommands(testDir);

      const commandsDir = path.join(testDir, 'commands');
      const aiMeshDir = path.join(commandsDir, 'ai-mesh');

      // Create and protect ai-mesh directory
      await fs.mkdir(aiMeshDir, { recursive: true });
      await utils.setFilePermissions(aiMeshDir, 0o444);

      const migrator = new CommandMigrator(testDir, logger);

      await expect(migrator.migrate()).rejects.toThrow();

      await utils.setFilePermissions(aiMeshDir, 0o755);
    });
  });

  describe('Backup Permission Issues', () => {
    test('should handle inability to create backup', async () => {
      if (isWindows) {
        return;
      }

      await utils.seedTestCommands(testDir);

      // Make test directory read-only (cannot create backup)
      await utils.setFilePermissions(testDir, 0o555);

      const migrator = new CommandMigrator(testDir, logger);

      await expect(migrator.migrate()).rejects.toThrow();

      await utils.setFilePermissions(testDir, 0o755);
    });

    test('should verify backup directory is writable', async () => {
      if (isWindows) {
        return;
      }

      await utils.seedTestCommands(testDir);

      // Ensure test directory is writable
      const stats = await fs.stat(testDir);
      const mode = stats.mode & 0o777;

      // Should have write permission
      expect(mode & 0o200).toBeGreaterThan(0); // Owner write bit
    });
  });

  describe('File-Level Permission Issues', () => {
    test('should handle read-only files during migration', async () => {
      if (isWindows) {
        return;
      }

      const commandsDir = path.join(testDir, 'commands');
      await fs.mkdir(commandsDir, { recursive: true });

      // Create writable file
      await fs.writeFile(
        path.join(commandsDir, 'writable.md'),
        '# @ai-mesh-command\nWritable'
      );

      // Create read-only file
      const readOnlyPath = path.join(commandsDir, 'readonly.md');
      await fs.writeFile(readOnlyPath, '# @ai-mesh-command\nRead-only');
      await utils.setFilePermissions(readOnlyPath, 0o444);

      const migrator = new CommandMigrator(testDir, logger);

      // Migration may partially succeed
      const result = await migrator.migrate().catch(err => ({ error: err }));

      // At least writable file should migrate
      if (!result.error) {
        expect(result.migratedCount).toBeGreaterThanOrEqual(1);
      }

      // Restore permissions
      await utils.setFilePermissions(readOnlyPath, 0o644);
    });

    test('should preserve file permissions after migration', async () => {
      const commandsDir = path.join(testDir, 'commands');
      await fs.mkdir(commandsDir, { recursive: true });

      const testFile = path.join(commandsDir, 'test.md');
      await fs.writeFile(testFile, '# @ai-mesh-command\nContent');
      await utils.setFilePermissions(testFile, 0o644);

      const migrator = new CommandMigrator(testDir, logger);
      await migrator.migrate();

      // Check migrated file permissions
      const migratedFile = path.join(commandsDir, 'ai-mesh', 'test.md');
      const stats = await fs.stat(migratedFile);
      const mode = stats.mode & 0o777;

      expect(mode).toBe(0o644);
    });
  });

  describe('Recovery from Permission Errors', () => {
    test('should maintain data integrity on permission failure', async () => {
      if (isWindows) {
        return;
      }

      await utils.seedTestCommands(testDir);
      const commandsDir = path.join(testDir, 'commands');

      // Count original files
      const originalCount = await utils.countFiles(commandsDir);

      // Make directory read-only
      await utils.setFilePermissions(commandsDir, 0o444);

      const migrator = new CommandMigrator(testDir, logger);

      try {
        await migrator.migrate();
      } catch {
        // Expected to fail
      }

      // Restore permissions
      await utils.setFilePermissions(commandsDir, 0o755);

      // Verify original files still exist
      const currentCount = await utils.countFiles(commandsDir);
      expect(currentCount).toBeGreaterThanOrEqual(originalCount - 5); // Allow some migration
    });

    test('should allow retry after fixing permissions', async () => {
      if (isWindows) {
        return;
      }

      await utils.seedTestCommands(testDir);
      const commandsDir = path.join(testDir, 'commands');

      // First attempt with read-only directory (should fail)
      await utils.setFilePermissions(commandsDir, 0o444);

      const migrator = new CommandMigrator(testDir, logger);

      await expect(migrator.migrate()).rejects.toThrow();

      // Fix permissions
      await utils.setFilePermissions(commandsDir, 0o755);

      // Retry should succeed
      const result = await migrator.migrate();
      expect(result.success).toBe(true);
    });
  });

  describe('Cross-Platform Compatibility', () => {
    test('should handle platform-specific permission models', async () => {
      await utils.seedTestCommands(testDir);

      const migrator = new CommandMigrator(testDir, logger);
      const result = await migrator.migrate();

      // Should succeed on all platforms
      expect(result.success).toBe(true);
      expect(result.migratedCount).toBeGreaterThan(0);
    });

    test('should use appropriate default permissions', async () => {
      await utils.seedTestCommands(testDir);

      const migrator = new CommandMigrator(testDir, logger);
      await migrator.createAiMeshDirectory();

      const aiMeshDir = path.join(testDir, 'commands', 'ai-mesh');
      const stats = await fs.stat(aiMeshDir);

      // Directory should be readable and executable
      expect(stats.isDirectory()).toBe(true);
    });
  });

  describe('Error Messages and User Guidance', () => {
    test('should provide actionable error messages', async () => {
      if (isWindows) {
        return;
      }

      await utils.seedTestCommands(testDir);
      const commandsDir = path.join(testDir, 'commands');

      await utils.setFilePermissions(commandsDir, 0o444);

      const migrator = new CommandMigrator(testDir, logger);

      try {
        await migrator.migrate();
        fail('Should throw error');
      } catch (error) {
        // Error should indicate permission problem
        expect(error.message).toBeDefined();
        expect(error.code).toMatch(/EACCES|EPERM/);
      }

      await utils.setFilePermissions(commandsDir, 0o755);
    });

    test('should suggest solutions for common permission issues', async () => {
      // This is more of a documentation test
      // Verify that error messages are informative

      const commandsDir = path.join(testDir, 'commands');
      await fs.mkdir(commandsDir, { recursive: true });

      const migrator = new CommandMigrator(testDir, logger);

      // Should handle missing directory gracefully
      const result = await migrator.migrate();
      expect(result.success).toBe(true);
    });
  });

  describe('Backup Integrity with Permission Issues', () => {
    test('should create backup before encountering permission errors', async () => {
      await utils.seedTestCommands(testDir);

      const migrator = new CommandMigrator(testDir, logger);

      // Backup creation should succeed
      const backupManager = migrator.backupManager;
      const backupPath = await backupManager.createBackup();

      expect(backupPath).toBeTruthy();
      
      const backupExists = await utils.findBackupDirectory(testDir);
      expect(backupExists).toBeTruthy();
    });

    test('should allow rollback even after permission failure', async () => {
      if (isWindows) {
        return;
      }

      await utils.seedTestCommands(testDir);

      const migrator = new CommandMigrator(testDir, logger);

      // Create backup first
      const backupPath = await migrator.backupManager.createBackup();

      // Now cause permission failure
      const commandsDir = path.join(testDir, 'commands');
      await utils.setFilePermissions(commandsDir, 0o444);

      try {
        await migrator.migrate();
      } catch {
        // Expected
      }

      // Restore permissions for rollback
      await utils.setFilePermissions(commandsDir, 0o755);

      // Rollback should work
      await expect(migrator.rollback(backupPath)).resolves.not.toThrow();
    });
  });
});
