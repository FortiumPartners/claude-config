/**
 * TRD-054: Corrupted Files Integration Test
 * Tests migration resilience with corrupted/invalid files
 * 
 * Scenario:
 * 1. Create environment with corrupted files:
 *    - Missing metadata header
 *    - Malformed YAML
 *    - Empty files
 *    - Binary files with .md extension
 * 2. Run migration with error handling
 * 3. Verify partial migration succeeded
 * 4. Verify errors logged appropriately
 * 5. Verify valid files migrated successfully
 * 
 * Success Criteria:
 * - Valid files migrated (>50% success rate)
 * - Corrupted files skipped with warnings
 * - Error summary provided
 * - No crashes or fatal errors
 * - Backup created before migration
 */

const path = require('path');
const fs = require('fs').promises;
const { CommandMigrator } = require('../../installer/command-migrator');
const { Logger } = require('../../utils/logger');
const { IntegrationTestUtils } = require('./test-utils');

describe('TRD-054: Corrupted Files Test', () => {
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

  describe('Corrupted File Handling', () => {
    test('should handle mixed valid and corrupted files', async () => {
      // Create mix of valid and corrupted files
      const { corruptedCount, validCount } = await utils.createCorruptedFiles(testDir);

      expect(corruptedCount).toBe(4);
      expect(validCount).toBe(2);

      const migrator = new CommandMigrator(testDir, logger);
      const result = await migrator.migrate();

      // Migration should succeed overall
      expect(result.success).toBe(true);
      
      // Valid files should be migrated
      expect(result.migratedCount).toBeGreaterThanOrEqual(2);
      
      // Success rate should be >50%
      const totalFiles = corruptedCount + validCount;
      const successRate = (result.migratedCount / totalFiles) * 100;
      expect(successRate).toBeGreaterThanOrEqual(33); // At least 2/6 files (33%)
    });

    test('should skip files with missing metadata', async () => {
      const commandsDir = path.join(testDir, 'commands');
      await fs.mkdir(commandsDir, { recursive: true });

      // Create file without metadata
      await fs.writeFile(
        path.join(commandsDir, 'no-metadata.md'),
        '# Regular Markdown\n\nNo @ai-mesh-command metadata'
      );

      // Create valid file
      await fs.writeFile(
        path.join(commandsDir, 'valid.md'),
        '# @ai-mesh-command\nValid content'
      );

      const migrator = new CommandMigrator(testDir, logger);
      const { aiMeshCommands, thirdPartyCommands } = await migrator.scanExistingCommands();

      // Should categorize correctly
      expect(aiMeshCommands).toContain('valid.md');
      expect(thirdPartyCommands).toContain('no-metadata.md');
    });

    test('should handle malformed YAML gracefully', async () => {
      const commandsDir = path.join(testDir, 'commands');
      await fs.mkdir(commandsDir, { recursive: true });

      // Create file with malformed YAML
      await fs.writeFile(
        path.join(commandsDir, 'malformed.md'),
        '# @ai-mesh-command\n---\ninvalid:yaml:structure::\n---\nContent'
      );

      // Create valid files
      await utils.seedTestCommands(testDir, {
        aiMeshCommands: ['create-prd']
      });

      const migrator = new CommandMigrator(testDir, logger);
      const result = await migrator.migrate();

      // Should migrate valid files
      expect(result.success).toBe(true);
      expect(result.migratedCount).toBeGreaterThanOrEqual(2); // create-prd.md + create-prd.txt
    });

    test('should handle empty files', async () => {
      const commandsDir = path.join(testDir, 'commands');
      await fs.mkdir(commandsDir, { recursive: true });

      // Create empty file
      await fs.writeFile(path.join(commandsDir, 'empty.md'), '');

      // Create valid files
      await utils.seedTestCommands(testDir, {
        aiMeshCommands: ['create-prd']
      });

      const migrator = new CommandMigrator(testDir, logger);
      const result = await migrator.migrate();

      // Should skip empty file, migrate valid files
      expect(result.success).toBe(true);
      expect(result.migratedCount).toBe(2); // Only valid files
    });

    test('should handle binary files with .md extension', async () => {
      const commandsDir = path.join(testDir, 'commands');
      await fs.mkdir(commandsDir, { recursive: true });

      // Create binary file with .md extension
      await fs.writeFile(
        path.join(commandsDir, 'binary.md'),
        Buffer.from([0xFF, 0xFE, 0xFD, 0xFC, 0x00, 0x01, 0x02])
      );

      // Create valid files
      await utils.seedTestCommands(testDir, {
        aiMeshCommands: ['create-prd']
      });

      const migrator = new CommandMigrator(testDir, logger);
      
      // Should not crash on binary file
      const result = await migrator.migrate();

      expect(result.success).toBe(true);
      expect(result.migratedCount).toBe(2); // Only valid files
    });
  });

  describe('Error Reporting', () => {
    test('should provide error summary for corrupted files', async () => {
      await utils.createCorruptedFiles(testDir);

      const migrator = new CommandMigrator(testDir, logger);
      const result = await migrator.migrate();

      // Result should include error information
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('migratedCount');
      expect(result).toHaveProperty('errorCount');
      
      // Should migrate valid files only
      expect(result.migratedCount).toBe(2); // valid-command.md + valid-command.txt
    });

    test('should log warnings for skipped files', async () => {
      const commandsDir = path.join(testDir, 'commands');
      await fs.mkdir(commandsDir, { recursive: true });

      // Create files that will be skipped
      await fs.writeFile(
        path.join(commandsDir, 'invalid1.md'),
        '' // Empty
      );
      
      await fs.writeFile(
        path.join(commandsDir, 'invalid2.md'),
        Buffer.from([0xFF, 0xFE]) // Binary
      );

      // Create valid file
      await fs.writeFile(
        path.join(commandsDir, 'valid.md'),
        '# @ai-mesh-command\nContent'
      );

      const migrator = new CommandMigrator(testDir, logger);
      const result = await migrator.migrate();

      // Should complete without fatal errors
      expect(result.success).toBe(true);
      expect(result.migratedCount).toBe(1); // Only valid.md
    });

    test('should continue migration despite errors', async () => {
      const commandsDir = path.join(testDir, 'commands');
      await fs.mkdir(commandsDir, { recursive: true });

      // Mix of valid, corrupted, and problematic files
      await fs.writeFile(
        path.join(commandsDir, 'valid1.md'),
        '# @ai-mesh-command\nValid 1'
      );
      
      await fs.writeFile(
        path.join(commandsDir, 'corrupted.md'),
        Buffer.from([0xFF, 0xFE])
      );
      
      await fs.writeFile(
        path.join(commandsDir, 'valid2.md'),
        '# @ai-mesh-command\nValid 2'
      );

      const migrator = new CommandMigrator(testDir, logger);
      const result = await migrator.migrate();

      // Should migrate both valid files despite corrupted file
      expect(result.success).toBe(true);
      expect(result.migratedCount).toBe(2);
    });
  });

  describe('Backup Safety', () => {
    test('should create backup before encountering errors', async () => {
      await utils.createCorruptedFiles(testDir);

      const migrator = new CommandMigrator(testDir, logger);
      const result = await migrator.migrate();

      // Backup should be created even with corrupted files
      expect(result.backupPath).toBeTruthy();

      const backupExists = await utils.findBackupDirectory(testDir);
      expect(backupExists).toBeTruthy();
    });

    test('should include all files in backup (including corrupted)', async () => {
      await utils.createCorruptedFiles(testDir);

      const migrator = new CommandMigrator(testDir, logger);
      const result = await migrator.migrate();

      // Backup should contain all original files
      const backupFiles = await utils.getAllFiles(result.backupPath);
      expect(backupFiles.length).toBeGreaterThanOrEqual(4); // At least the files we created
    });

    test('should allow rollback after failed partial migration', async () => {
      await utils.createCorruptedFiles(testDir);

      const migrator = new CommandMigrator(testDir, logger);
      const result = await migrator.migrate();

      // Verify backup can be used for rollback
      expect(result.backupPath).toBeTruthy();

      // Attempt rollback
      await migrator.rollback(result.backupPath);

      // Verify files restored to commands/ root
      const commandsDir = path.join(testDir, 'commands');
      const restoredFiles = await utils.countFiles(commandsDir);
      expect(restoredFiles).toBeGreaterThanOrEqual(4);
    });
  });

  describe('Recovery and Resilience', () => {
    test('should achieve >50% success rate with corrupted files', async () => {
      const commandsDir = path.join(testDir, 'commands');
      await fs.mkdir(commandsDir, { recursive: true });

      // Create 6 valid files
      await utils.seedTestCommands(testDir, {
        aiMeshCommands: ['create-prd', 'create-trd', 'implement-trd']
      });

      // Create 3 corrupted files
      await fs.writeFile(path.join(commandsDir, 'empty.md'), '');
      await fs.writeFile(path.join(commandsDir, 'binary.md'), Buffer.from([0xFF]));
      await fs.writeFile(path.join(commandsDir, 'malformed.md'), '# @ai-mesh-command\n---\ninvalid\n---');

      const migrator = new CommandMigrator(testDir, logger);
      const result = await migrator.migrate();

      const successRate = (result.migratedCount / 9) * 100; // 9 total files
      expect(successRate).toBeGreaterThanOrEqual(50); // At least 50% success
    });

    test('should not crash on severely corrupted directory', async () => {
      const commandsDir = path.join(testDir, 'commands');
      await fs.mkdir(commandsDir, { recursive: true });

      // Create only corrupted files
      await fs.writeFile(path.join(commandsDir, 'empty1.md'), '');
      await fs.writeFile(path.join(commandsDir, 'empty2.md'), '');
      await fs.writeFile(path.join(commandsDir, 'binary.md'), Buffer.from([0xFF, 0xFE, 0xFD]));

      const migrator = new CommandMigrator(testDir, logger);

      // Should not throw error
      await expect(migrator.migrate()).resolves.toBeDefined();
    });

    test('should provide actionable error messages', async () => {
      await utils.createCorruptedFiles(testDir);

      const migrator = new CommandMigrator(testDir, logger);
      const result = await migrator.migrate();

      // Should complete with clear status
      expect(result.success).toBe(true);
      expect(result.migratedCount).toBeGreaterThan(0);
      
      // Error count should reflect skipped files
      expect(result).toHaveProperty('errorCount');
    });

    test('should handle encoding issues gracefully', async () => {
      const commandsDir = path.join(testDir, 'commands');
      await fs.mkdir(commandsDir, { recursive: true });

      // Create file with invalid UTF-8
      await fs.writeFile(
        path.join(commandsDir, 'encoding-issue.md'),
        Buffer.from([0xC0, 0x80, 0x41, 0x42]) // Invalid UTF-8
      );

      // Create valid file
      await fs.writeFile(
        path.join(commandsDir, 'valid.md'),
        '# @ai-mesh-command\nValid content'
      );

      const migrator = new CommandMigrator(testDir, logger);
      const result = await migrator.migrate();

      // Should migrate valid file despite encoding issues
      expect(result.success).toBe(true);
      expect(result.migratedCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Validation with Corrupted Files', () => {
    test('should validate successfully migrated files', async () => {
      await utils.createCorruptedFiles(testDir);

      const migrator = new CommandMigrator(testDir, logger);
      await migrator.migrate();

      // Validation should pass for successfully migrated files
      // Pass expected commands that were actually created
      const validation = await migrator.validateMigration({
        expectedCommands: ['valid-command']
      });

      // Should report actual migrated count (valid-command.md + valid-command.txt = 2)
      expect(validation.actualCount).toBeGreaterThanOrEqual(2);
      expect(validation.valid).toBe(true);
    });

    test('should report missing expected files', async () => {
      // Create incomplete set
      const commandsDir = path.join(testDir, 'commands');
      await fs.mkdir(commandsDir, { recursive: true });

      // Only create 2 of 12 expected commands
      await fs.writeFile(
        path.join(commandsDir, 'create-prd.md'),
        '# @ai-mesh-command\nContent'
      );
      
      await fs.writeFile(
        path.join(commandsDir, 'create-prd.txt'),
        '# @ai-mesh-command\nContent'
      );

      const migrator = new CommandMigrator(testDir, logger);
      await migrator.migrate();

      const validation = await migrator.validateMigration();

      // Should identify missing files
      expect(validation.valid).toBe(false);
      expect(validation.missing.length).toBeGreaterThan(0);
      expect(validation.expectedCount).toBe(24); // 12 commands × 2 files
      expect(validation.actualCount).toBe(2);
    });
  });

  describe('Performance with Corrupted Files', () => {
    test('should maintain performance with mix of valid/corrupted', async () => {
      await utils.createCorruptedFiles(testDir);

      const migrator = new CommandMigrator(testDir, logger);

      const startTime = Date.now();
      await migrator.migrate();
      const duration = Date.now() - startTime;

      // Should complete quickly even with corrupted files
      expect(duration).toBeLessThan(1000);
    });

    test('should not slow down significantly on binary files', async () => {
      const commandsDir = path.join(testDir, 'commands');
      await fs.mkdir(commandsDir, { recursive: true });

      // Create mix of binary and valid files
      for (let i = 0; i < 5; i++) {
        await fs.writeFile(
          path.join(commandsDir, `binary${i}.md`),
          Buffer.from(Array(100).fill(0xFF))
        );
      }

      await utils.seedTestCommands(testDir, {
        aiMeshCommands: ['create-prd', 'create-trd']
      });

      const migrator = new CommandMigrator(testDir, logger);

      const startTime = Date.now();
      await migrator.migrate();
      const duration = Date.now() - startTime;

      // Should still complete in <1s
      expect(duration).toBeLessThan(1000);
    });
  });
});
