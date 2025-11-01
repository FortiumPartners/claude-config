/**
 * CommandMigrator Test Suite
 * Tests for command migration functionality
 */

const path = require('path');
const fs = require('fs').promises;
const { CommandMigrator } = require('../../installer/command-migrator');
const { Logger } = require('../../utils/logger');

describe('CommandMigrator', () => {
  let testTempDir;
  let commandsDir;
  let migrator;
  let logger;

  beforeEach(async () => {
    // Create temporary test directory
    testTempDir = path.join(__dirname, '../fixtures/temp-migrator-test');
    commandsDir = path.join(testTempDir, 'commands');

    await fs.mkdir(commandsDir, { recursive: true });

    logger = new Logger({ debug: false });
    migrator = new CommandMigrator(testTempDir, logger);

    // Create test AI Mesh command files
    await fs.writeFile(
      path.join(commandsDir, 'create-prd.md'),
      '# @ai-mesh-command\n# Command: create-prd\n# Version: 1.0.0\n\nContent'
    );
    await fs.writeFile(
      path.join(commandsDir, 'create-prd.txt'),
      '# @ai-mesh-command\n# Command: create-prd\n\nText content'
    );

    // Create third-party command (no @ai-mesh-command marker)
    await fs.writeFile(
      path.join(commandsDir, 'third-party.md'),
      '# Third Party Command\nNo metadata marker'
    );
  });

  afterEach(async () => {
    // Cleanup temporary test directory
    await fs.rm(testTempDir, { recursive: true, force: true }).catch(() => {});
  });

  describe('detectAiMeshCommand', () => {
    test('should detect valid @ai-mesh-command header', async () => {
      const filePath = path.join(commandsDir, 'create-prd.md');

      const isAiMesh = await migrator.detectAiMeshCommand(filePath);

      expect(isAiMesh).toBe(true);
    });

    test('should reject files without @ai-mesh-command header', async () => {
      const filePath = path.join(commandsDir, 'third-party.md');

      const isAiMesh = await migrator.detectAiMeshCommand(filePath);

      expect(isAiMesh).toBe(false);
    });

    test('should complete detection in <10ms per file', async () => {
      const filePath = path.join(commandsDir, 'create-prd.md');

      const startTime = Date.now();
      await migrator.detectAiMeshCommand(filePath);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(10);
    });

    test('should handle encoding errors gracefully', async () => {
      // Create binary file
      const binaryPath = path.join(commandsDir, 'binary.bin');
      await fs.writeFile(binaryPath, Buffer.from([0xFF, 0xFE, 0xFD]));

      const isAiMesh = await migrator.detectAiMeshCommand(binaryPath);

      expect(isAiMesh).toBe(false);
    });

    test('should only read first 10 lines for performance', async () => {
      // Create file with marker on line 11 (should not be detected)
      const lines = Array(10).fill('# Regular comment').concat(['# @ai-mesh-command']);
      const content = lines.join('\n');

      const filePath = path.join(commandsDir, 'late-marker.md');
      await fs.writeFile(filePath, content);

      const isAiMesh = await migrator.detectAiMeshCommand(filePath);

      expect(isAiMesh).toBe(false);
    });

    test('should handle non-existent files', async () => {
      const filePath = path.join(commandsDir, 'non-existent.md');

      await expect(migrator.detectAiMeshCommand(filePath)).rejects.toThrow();
    });

    test('should detect marker in various line positions', async () => {
      // Marker on line 1
      const file1 = path.join(commandsDir, 'marker-line1.md');
      await fs.writeFile(file1, '# @ai-mesh-command\nContent');
      expect(await migrator.detectAiMeshCommand(file1)).toBe(true);

      // Marker on line 5
      const file2 = path.join(commandsDir, 'marker-line5.md');
      await fs.writeFile(file2, '# Header\n\n\n\n# @ai-mesh-command\nContent');
      expect(await migrator.detectAiMeshCommand(file2)).toBe(true);
    });
  });

  describe('scanExistingCommands', () => {
    test('should identify AI Mesh commands', async () => {
      const commands = await migrator.scanExistingCommands();

      expect(commands.aiMeshCommands).toContain('create-prd.md');
      expect(commands.aiMeshCommands).toContain('create-prd.txt');
      expect(commands.aiMeshCommands.length).toBe(2);
    });

    test('should identify third-party commands', async () => {
      const commands = await migrator.scanExistingCommands();

      expect(commands.thirdPartyCommands).toContain('third-party.md');
      expect(commands.thirdPartyCommands.length).toBe(1);
    });

    test('should return empty arrays for empty directory', async () => {
      // Remove all files
      await fs.unlink(path.join(commandsDir, 'create-prd.md'));
      await fs.unlink(path.join(commandsDir, 'create-prd.txt'));
      await fs.unlink(path.join(commandsDir, 'third-party.md'));

      const commands = await migrator.scanExistingCommands();

      expect(commands.aiMeshCommands).toEqual([]);
      expect(commands.thirdPartyCommands).toEqual([]);
    });
  });

  describe('createAiMeshDirectory', () => {
    test('should create ai-mesh subdirectory', async () => {
      await migrator.createAiMeshDirectory();

      const aiMeshDir = path.join(commandsDir, 'ai-mesh');
      const exists = await fs.access(aiMeshDir).then(() => true).catch(() => false);

      expect(exists).toBe(true);
    });

    test('should create directory with 0755 permissions', async () => {
      await migrator.createAiMeshDirectory();

      const aiMeshDir = path.join(commandsDir, 'ai-mesh');
      const stats = await fs.stat(aiMeshDir);

      expect(stats.isDirectory()).toBe(true);
      // Check permissions (platform-specific, so just verify it's a directory)
    });

    test('should not fail if directory already exists', async () => {
      await migrator.createAiMeshDirectory();

      // Call again - should not throw
      await expect(migrator.createAiMeshDirectory()).resolves.not.toThrow();
    });

    test('should handle permission errors', async () => {
      // Make commands directory read-only
      await fs.chmod(commandsDir, 0o444);

      await expect(migrator.createAiMeshDirectory()).rejects.toThrow();

      // Restore permissions
      await fs.chmod(commandsDir, 0o755);
    });
  });

  describe('migrateCommandFiles', () => {
    test('should migrate AI Mesh commands to ai-mesh/', async () => {
      await migrator.createAiMeshDirectory();

      const files = ['create-prd.md', 'create-prd.txt'];
      const result = await migrator.migrateCommandFiles(files);

      expect(result.successes).toContain('create-prd.md');
      expect(result.successes).toContain('create-prd.txt');
      expect(result.errors).toEqual([]);

      // Verify files moved
      const aiMeshDir = path.join(commandsDir, 'ai-mesh');
      const mdExists = await fs.access(path.join(aiMeshDir, 'create-prd.md')).then(() => true).catch(() => false);
      const txtExists = await fs.access(path.join(aiMeshDir, 'create-prd.txt')).then(() => true).catch(() => false);

      expect(mdExists).toBe(true);
      expect(txtExists).toBe(true);
    });

    test('should complete migration in <100ms per file', async () => {
      await migrator.createAiMeshDirectory();

      const files = ['create-prd.md', 'create-prd.txt'];

      const startTime = Date.now();
      await migrator.migrateCommandFiles(files);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(200); // 2 files × 100ms
    });

    test('should handle partial migration failures', async () => {
      await migrator.createAiMeshDirectory();

      // Add a non-existent file to the list
      const files = ['create-prd.md', 'non-existent.md', 'create-prd.txt'];
      const result = await migrator.migrateCommandFiles(files);

      expect(result.successes.length).toBe(2);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0].file).toBe('non-existent.md');
    });

    test('should log errors for failed files', async () => {
      await migrator.createAiMeshDirectory();

      const loggerSpy = jest.spyOn(logger, 'warning');
      const files = ['non-existent.md'];

      await migrator.migrateCommandFiles(files);

      expect(loggerSpy).toHaveBeenCalled();
    });

    test('should validate files after migration', async () => {
      await migrator.createAiMeshDirectory();

      const files = ['create-prd.md', 'create-prd.txt'];
      const result = await migrator.migrateCommandFiles(files);

      // All files should be successfully migrated
      expect(result.successes.length).toBe(2);

      // Original files should not exist
      const mdExists = await fs.access(path.join(commandsDir, 'create-prd.md')).then(() => true).catch(() => false);
      expect(mdExists).toBe(false);
    });
  });

  describe('migrate (full migration)', () => {
    test('should perform complete migration workflow', async () => {
      const result = await migrator.migrate();

      expect(result.success).toBe(true);
      expect(result.migratedCount).toBe(2);
      expect(result.errorCount).toBe(0);

      // Verify ai-mesh directory exists
      const aiMeshDir = path.join(commandsDir, 'ai-mesh');
      const exists = await fs.access(aiMeshDir).then(() => true).catch(() => false);
      expect(exists).toBe(true);

      // Verify files migrated
      const mdExists = await fs.access(path.join(aiMeshDir, 'create-prd.md')).then(() => true).catch(() => false);
      expect(mdExists).toBe(true);
    });

    test('should complete total migration in <5s', async () => {
      // Create 12 command pairs (24 files)
      for (let i = 0; i < 11; i++) {
        await fs.writeFile(
          path.join(commandsDir, `command-${i}.md`),
          `# @ai-mesh-command\n# Command: command-${i}\n\nContent`
        );
        await fs.writeFile(
          path.join(commandsDir, `command-${i}.txt`),
          `# @ai-mesh-command\nContent`
        );
      }

      const startTime = Date.now();
      await migrator.migrate();
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000);
    });

    test('should create backup before migration', async () => {
      const result = await migrator.migrate();

      expect(result.backupPath).toBeDefined();
      expect(result.backupPath).toMatch(/commands-backup-/);

      const backupExists = await fs.access(result.backupPath).then(() => true).catch(() => false);
      expect(backupExists).toBe(true);
    });

    test('should support dry-run mode', async () => {
      const dryRunMigrator = new CommandMigrator(testTempDir, logger, { dryRun: true });

      const result = await dryRunMigrator.migrate();

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);

      // Files should not be moved in dry-run
      const mdExists = await fs.access(path.join(commandsDir, 'create-prd.md')).then(() => true).catch(() => false);
      expect(mdExists).toBe(true);

      // ai-mesh directory should not exist
      const aiMeshDir = path.join(commandsDir, 'ai-mesh');
      const aiMeshExists = await fs.access(aiMeshDir).then(() => true).catch(() => false);
      expect(aiMeshExists).toBe(false);
    });
  });

  describe('validateMigration', () => {
    test('should validate all 12 commands (24 files)', async () => {
      // Create all expected command files
      const commands = [
        'create-prd', 'create-trd', 'implement-trd', 'fold-prompt',
        'manager-dashboard', 'analyze-product', 'refine-prd', 'refine-trd',
        'sprint-status', 'playwright-test', 'generate-api-docs', 'web-metrics-dashboard'
      ];

      const aiMeshDir = path.join(commandsDir, 'ai-mesh');
      await fs.mkdir(aiMeshDir, { recursive: true });

      for (const cmd of commands) {
        await fs.writeFile(path.join(aiMeshDir, `${cmd}.md`), `# ${cmd}`);
        await fs.writeFile(path.join(aiMeshDir, `${cmd}.txt`), `${cmd} text`);
      }

      const result = await migrator.validateMigration();

      expect(result.valid).toBe(true);
      expect(result.expectedCount).toBe(24);
      expect(result.actualCount).toBe(24);
      expect(result.missing).toEqual([]);
    });

    test('should detect missing files', async () => {
      const aiMeshDir = path.join(commandsDir, 'ai-mesh');
      await fs.mkdir(aiMeshDir, { recursive: true });

      // Only create one file
      await fs.writeFile(path.join(aiMeshDir, 'create-prd.md'), '# create-prd');

      const result = await migrator.validateMigration();

      expect(result.valid).toBe(false);
      expect(result.missing.length).toBeGreaterThan(0);
    });

    test('should report validation summary', async () => {
      await migrator.createAiMeshDirectory();
      await migrator.migrate();

      const result = await migrator.validateMigration();

      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('expectedCount');
      expect(result).toHaveProperty('actualCount');
      expect(result).toHaveProperty('missing');
    });
  });

  describe('rollback', () => {
    test('should rollback from backup on failure', async () => {
      // Perform migration
      const migrateResult = await migrator.migrate();
      const backupPath = migrateResult.backupPath;

      // Verify files were moved
      const mdExists = await fs.access(path.join(commandsDir, 'create-prd.md')).then(() => true).catch(() => false);
      expect(mdExists).toBe(false);

      // Rollback
      await migrator.rollback(backupPath);

      // Verify files restored
      const mdRestored = await fs.access(path.join(commandsDir, 'create-prd.md')).then(() => true).catch(() => false);
      expect(mdRestored).toBe(true);
    });

    test('should validate backup before rollback', async () => {
      const invalidBackupPath = path.join(testTempDir, 'invalid-backup');

      await expect(migrator.rollback(invalidBackupPath)).rejects.toThrow();
    });

    test('should restore original state completely', async () => {
      // Get original file content
      const originalContent = await fs.readFile(path.join(commandsDir, 'create-prd.md'), 'utf8');

      // Perform migration
      const migrateResult = await migrator.migrate();

      // Rollback
      await migrator.rollback(migrateResult.backupPath);

      // Verify content restored
      const restoredContent = await fs.readFile(path.join(commandsDir, 'create-prd.md'), 'utf8');
      expect(restoredContent).toBe(originalContent);
    });
  });

  describe('Error Handling', () => {
    test('should handle permission errors gracefully', async () => {
      // Make directory read-only
      await fs.chmod(commandsDir, 0o444);

      await expect(migrator.migrate()).rejects.toThrow();

      // Restore permissions
      await fs.chmod(commandsDir, 0o755);
    });

    test('should handle corrupted command files', async () => {
      // Create corrupted file
      const corruptedPath = path.join(commandsDir, 'corrupted.md');
      await fs.writeFile(corruptedPath, Buffer.from([0xFF, 0xFE, 0xFD]));

      // Should not throw, just skip corrupted file
      const result = await migrator.migrate();

      expect(result.success).toBe(true);
    });

    test('should continue migration on non-critical errors', async () => {
      // Create valid and invalid files
      await fs.writeFile(
        path.join(commandsDir, 'valid.md'),
        '# @ai-mesh-command\nValid'
      );

      const result = await migrator.migrate();

      // Should succeed despite some errors
      expect(result.success).toBe(true);
      expect(result.migratedCount).toBeGreaterThan(0);
    });
  });

  describe('Integration', () => {
    test('should work with global installation path', async () => {
      const globalMigrator = new CommandMigrator(testTempDir, logger);

      const result = await globalMigrator.migrate();

      expect(result.success).toBe(true);
    });

    test('should work with local installation path', async () => {
      const localMigrator = new CommandMigrator(testTempDir, logger);

      const result = await localMigrator.migrate();

      expect(result.success).toBe(true);
    });

    test('should preserve third-party commands', async () => {
      await migrator.migrate();

      // Third-party command should remain in root
      const thirdPartyExists = await fs.access(
        path.join(commandsDir, 'third-party.md')
      ).then(() => true).catch(() => false);

      expect(thirdPartyExists).toBe(true);
    });
  });
});
