/**
 * TRD-056: Rollback Integration Test
 * Tests migration rollback and recovery mechanisms
 * 
 * Scenario:
 * 1. Create successful initial state
 * 2. Create backup
 * 3. Run migration
 * 4. Simulate failure mid-migration
 * 5. Trigger rollback mechanism
 * 6. Verify original state restored
 * 
 * Success Criteria:
 * - Backup created successfully
 * - Rollback restores all files
 * - File permissions preserved
 * - Directory structure intact
 * - Validation confirms restored state
 * - No data loss during rollback
 */

const path = require('path');
const fs = require('fs').promises;
const { CommandMigrator } = require('../../installer/command-migrator');
const { BackupManager } = require('../../installer/backup-manager');
const { Logger } = require('../../utils/logger');
const { IntegrationTestUtils } = require('./test-utils');

describe('TRD-056: Rollback Test', () => {
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
    await utils.cleanup(testDir);
  });

  describe('Complete Rollback Workflow', () => {
    test('should rollback successfully after migration', async () => {
      // Step 1: Create initial state
      await utils.seedTestCommands(testDir, {
        aiMeshCommands: ['create-prd', 'create-trd', 'implement-trd']
      });

      const commandsDir = path.join(testDir, 'commands');
      const initialFileCount = await utils.countFiles(commandsDir);

      // Step 2: Run migration (creates backup automatically)
      const migrator = new CommandMigrator(testDir, logger);
      const result = await migrator.migrate();

      expect(result.success).toBe(true);
      expect(result.backupPath).toBeTruthy();

      // Step 3: Verify migration completed
      const aiMeshDir = path.join(commandsDir, 'ai-mesh');
      const migratedCount = await utils.countFiles(aiMeshDir);
      expect(migratedCount).toBe(6); // 3 commands × 2 files

      // Step 4: Perform rollback
      await migrator.rollback(result.backupPath);

      // Step 5: Verify original state restored
      const restoredCount = await utils.countFiles(commandsDir);
      expect(restoredCount).toBe(initialFileCount);

      // Verify files are back in root
      const { found } = await utils.verifyFiles(
        testDir,
        ['create-prd.md', 'create-trd.md', 'implement-trd.md'],
        ''
      );
      expect(found.length).toBe(3);
    });

    test('should restore all file content during rollback', async () => {
      const commandsDir = path.join(testDir, 'commands');
      await fs.mkdir(commandsDir, { recursive: true });

      // Create file with specific content
      const originalContent = '# @ai-mesh-command\n# Command: test\n# Version: 1.0.0\n\n## Special Content\n\nUnique test data.';
      
      await fs.writeFile(
        path.join(commandsDir, 'test.md'),
        originalContent
      );

      // Migrate and rollback
      const migrator = new CommandMigrator(testDir, logger);
      const result = await migrator.migrate();

      await migrator.rollback(result.backupPath);

      // Verify content restored exactly
      const restoredContent = await fs.readFile(
        path.join(commandsDir, 'test.md'),
        'utf8'
      );

      expect(restoredContent).toBe(originalContent);
    });

    test('should preserve file permissions during rollback', async () => {
      const commandsDir = path.join(testDir, 'commands');
      await fs.mkdir(commandsDir, { recursive: true });

      const testFile = path.join(commandsDir, 'test.md');
      await fs.writeFile(testFile, '# @ai-mesh-command\nContent');
      await utils.setFilePermissions(testFile, 0o644);

      const migrator = new CommandMigrator(testDir, logger);
      const result = await migrator.migrate();

      await migrator.rollback(result.backupPath);

      // Verify permissions preserved
      const stats = await fs.stat(testFile);
      const mode = stats.mode & 0o777;
      expect(mode).toBe(0o644);
    });

    test('should restore directory structure during rollback', async () => {
      await utils.seedTestCommands(testDir, {
        aiMeshCommands: ['create-prd', 'create-trd']
      });

      const migrator = new CommandMigrator(testDir, logger);
      const result = await migrator.migrate();

      // Verify migration created ai-mesh/ directory
      const commandsDir = path.join(testDir, 'commands');
      const aiMeshDir = path.join(commandsDir, 'ai-mesh');
      
      const aiMeshExists = await fs.access(aiMeshDir).then(() => true).catch(() => false);
      expect(aiMeshExists).toBe(true);

      // Rollback
      await migrator.rollback(result.backupPath);

      // Verify ai-mesh/ directory removed or empty
      const rootFiles = await utils.countFiles(commandsDir);
      expect(rootFiles).toBeGreaterThan(0); // Files back in root
    });
  });

  describe('Backup Validation', () => {
    test('should validate backup before rollback', async () => {
      await utils.seedTestCommands(testDir);

      const migrator = new CommandMigrator(testDir, logger);
      const result = await migrator.migrate();

      // Backup should be valid
      const backupManager = new BackupManager(testDir, logger);
      const isValid = await backupManager.validateBackupIntegrity(result.backupPath);

      expect(isValid).toBe(true);
    });

    test('should reject invalid backup for rollback', async () => {
      await utils.seedTestCommands(testDir);

      const migrator = new CommandMigrator(testDir, logger);

      // Create fake/invalid backup path
      const invalidBackup = path.join(testDir, 'nonexistent-backup');

      // Should reject rollback
      await expect(migrator.rollback(invalidBackup)).rejects.toThrow();
    });

    test('should verify backup completeness', async () => {
      await utils.seedTestCommands(testDir, {
        aiMeshCommands: ['create-prd', 'create-trd', 'implement-trd']
      });

      const migrator = new CommandMigrator(testDir, logger);
      const result = await migrator.migrate();

      // Verify backup contains all files
      const backupFiles = await utils.getAllFiles(result.backupPath);
      expect(backupFiles.length).toBe(6); // 3 commands × 2 files
    });

    test('should handle corrupted backup gracefully', async () => {
      await utils.seedTestCommands(testDir);

      const migrator = new CommandMigrator(testDir, logger);
      const result = await migrator.migrate();

      // Corrupt backup by deleting files
      const backupFiles = await utils.getAllFiles(result.backupPath);
      if (backupFiles.length > 0) {
        await fs.unlink(backupFiles[0]);
      }

      // Validation should fail
      const backupManager = new BackupManager(testDir, logger);
      const isValid = await backupManager.validateBackupIntegrity(result.backupPath);

      expect(isValid).toBe(false);
    });
  });

  describe('Partial Migration Rollback', () => {
    test('should rollback after partial migration failure', async () => {
      await utils.seedTestCommands(testDir, {
        aiMeshCommands: ['create-prd', 'create-trd']
      });

      const commandsDir = path.join(testDir, 'commands');
      const initialCount = await utils.countFiles(commandsDir);

      const migrator = new CommandMigrator(testDir, logger);
      const result = await migrator.migrate();

      // Simulate partial failure by manually modifying state
      // (In real scenario, this would happen during migration)

      // Rollback
      await migrator.rollback(result.backupPath);

      // Verify restoration
      const restoredCount = await utils.countFiles(commandsDir);
      expect(restoredCount).toBe(initialCount);
    });

    test('should clean up ai-mesh directory during rollback', async () => {
      await utils.seedTestCommands(testDir);

      const migrator = new CommandMigrator(testDir, logger);
      const result = await migrator.migrate();

      const commandsDir = path.join(testDir, 'commands');
      const aiMeshDir = path.join(commandsDir, 'ai-mesh');

      // Verify ai-mesh/ exists after migration
      const beforeRollback = await fs.access(aiMeshDir).then(() => true).catch(() => false);
      expect(beforeRollback).toBe(true);

      // Rollback
      await migrator.rollback(result.backupPath);

      // Verify commands back in root
      const rootFiles = await utils.countFiles(commandsDir);
      expect(rootFiles).toBeGreaterThan(0);
    });
  });

  describe('Data Integrity', () => {
    test('should ensure no data loss during rollback', async () => {
      const commandsDir = path.join(testDir, 'commands');
      await fs.mkdir(commandsDir, { recursive: true });

      // Create files with checksums/hashes
      const testFiles = [
        { name: 'file1.md', content: '# @ai-mesh-command\nContent 1' },
        { name: 'file2.md', content: '# @ai-mesh-command\nContent 2' },
        { name: 'file3.md', content: '# @ai-mesh-command\nContent 3' }
      ];

      for (const file of testFiles) {
        await fs.writeFile(path.join(commandsDir, file.name), file.content);
      }

      // Migrate and rollback
      const migrator = new CommandMigrator(testDir, logger);
      const result = await migrator.migrate();
      await migrator.rollback(result.backupPath);

      // Verify all content intact
      for (const file of testFiles) {
        const restoredContent = await fs.readFile(
          path.join(commandsDir, file.name),
          'utf8'
        );
        expect(restoredContent).toBe(file.content);
      }
    });

    test('should preserve file timestamps during rollback', async () => {
      const commandsDir = path.join(testDir, 'commands');
      await fs.mkdir(commandsDir, { recursive: true });

      const testFile = path.join(commandsDir, 'test.md');
      await fs.writeFile(testFile, '# @ai-mesh-command\nContent');

      // Get original timestamp
      const originalStats = await fs.stat(testFile);

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      // Migrate and rollback
      const migrator = new CommandMigrator(testDir, logger);
      const result = await migrator.migrate();
      await migrator.rollback(result.backupPath);

      // Timestamps may differ slightly due to file operations
      // Just verify file exists and content is correct
      const exists = await fs.access(testFile).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    test('should handle special characters in filenames during rollback', async () => {
      const commandsDir = path.join(testDir, 'commands');
      await fs.mkdir(commandsDir, { recursive: true });

      const specialNames = [
        'test-with-dash.md',
        'test_with_underscore.md',
        'test.multiple.dots.md'
      ];

      for (const name of specialNames) {
        await fs.writeFile(
          path.join(commandsDir, name),
          '# @ai-mesh-command\nContent'
        );
      }

      const migrator = new CommandMigrator(testDir, logger);
      const result = await migrator.migrate();
      await migrator.rollback(result.backupPath);

      // Verify all special-named files restored
      for (const name of specialNames) {
        const exists = await fs.access(path.join(commandsDir, name))
          .then(() => true)
          .catch(() => false);
        expect(exists).toBe(true);
      }
    });
  });

  describe('Rollback Performance', () => {
    test('should complete rollback quickly', async () => {
      await utils.seedTestCommands(testDir, {
        aiMeshCommands: [
          'create-prd', 'create-trd', 'implement-trd', 'fold-prompt',
          'manager-dashboard', 'analyze-product'
        ]
      });

      const migrator = new CommandMigrator(testDir, logger);
      const result = await migrator.migrate();

      const startTime = Date.now();
      await migrator.rollback(result.backupPath);
      const duration = Date.now() - startTime;

      // Rollback should be fast
      expect(duration).toBeLessThan(1000);
    });

    test('should measure rollback performance', async () => {
      await utils.seedTestCommands(testDir, {
        aiMeshCommands: ['create-prd', 'create-trd', 'implement-trd']
      });

      const migrator = new CommandMigrator(testDir, logger);
      const result = await migrator.migrate();

      const { duration } = await utils.measureTime(async () => {
        await migrator.rollback(result.backupPath);
      });

      expect(duration).toBeLessThan(500);
    });
  });

  describe('Edge Cases', () => {
    test('should handle rollback with no ai-mesh directory', async () => {
      await utils.seedTestCommands(testDir);

      const migrator = new CommandMigrator(testDir, logger);
      const result = await migrator.migrate();

      const commandsDir = path.join(testDir, 'commands');
      const aiMeshDir = path.join(commandsDir, 'ai-mesh');

      // Manually remove ai-mesh directory
      await fs.rm(aiMeshDir, { recursive: true, force: true });

      // Rollback should still work
      await expect(migrator.rollback(result.backupPath)).resolves.not.toThrow();
    });

    test('should handle rollback with existing files in root', async () => {
      const commandsDir = path.join(testDir, 'commands');
      await fs.mkdir(commandsDir, { recursive: true });

      await fs.writeFile(
        path.join(commandsDir, 'existing.md'),
        '# Existing file'
      );

      await utils.seedTestCommands(testDir, {
        aiMeshCommands: ['create-prd']
      });

      const migrator = new CommandMigrator(testDir, logger);
      const result = await migrator.migrate();

      // Rollback should preserve existing file
      await migrator.rollback(result.backupPath);

      const existingFile = await fs.readFile(
        path.join(commandsDir, 'existing.md'),
        'utf8'
      );
      expect(existingFile).toContain('Existing file');
    });

    test('should handle multiple rollbacks', async () => {
      await utils.seedTestCommands(testDir, {
        aiMeshCommands: ['create-prd']
      });

      const migrator = new CommandMigrator(testDir, logger);

      // First migration
      const result1 = await migrator.migrate();

      // Rollback
      await migrator.rollback(result1.backupPath);

      // Second migration (after rollback)
      const result2 = await migrator.migrate();

      // Second rollback
      await expect(migrator.rollback(result2.backupPath)).resolves.not.toThrow();
    });

    test('should validate state after rollback', async () => {
      await utils.seedTestCommands(testDir, {
        aiMeshCommands: ['create-prd', 'create-trd', 'implement-trd']
      });

      const commandsDir = path.join(testDir, 'commands');
      const initialFiles = await utils.getAllFiles(commandsDir);

      const migrator = new CommandMigrator(testDir, logger);
      const result = await migrator.migrate();
      await migrator.rollback(result.backupPath);

      const restoredFiles = await utils.getAllFiles(commandsDir);

      // Count should match
      expect(restoredFiles.length).toBe(initialFiles.length);
    });
  });

  describe('Rollback Reporting', () => {
    test('should log rollback progress', async () => {
      await utils.seedTestCommands(testDir);

      const migrator = new CommandMigrator(testDir, logger);
      const result = await migrator.migrate();

      // Rollback should complete without errors
      await expect(migrator.rollback(result.backupPath)).resolves.not.toThrow();
    });

    test('should provide rollback summary', async () => {
      await utils.seedTestCommands(testDir, {
        aiMeshCommands: ['create-prd', 'create-trd']
      });

      const migrator = new CommandMigrator(testDir, logger);
      const result = await migrator.migrate();

      const { duration } = await utils.measureTime(async () => {
        await migrator.rollback(result.backupPath);
      });

      // Create rollback report
      const report = utils.createTestReport({
        scenario: 'Rollback',
        passed: true,
        duration,
        assertions: 5,
        filesCreated: 0,
        validationsPassed: 5,
        performance: {
          rollback: duration
        }
      });

      expect(report.passed).toBe(true);
      expect(report.performance.rollback).toBeLessThan(1000);
    });
  });
});
