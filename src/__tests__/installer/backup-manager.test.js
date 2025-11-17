/**
 * BackupManager Test Suite
 * Tests for backup and restore functionality
 */

const path = require('path');
const fs = require('fs').promises;
const { BackupManager } = require('../../installer/backup-manager');
const { Logger } = require('../../utils/logger');

describe('BackupManager', () => {
  let testTempDir;
  let commandsDir;
  let backupManager;
  let logger;

  beforeEach(async () => {
    // Create temporary test directory
    testTempDir = path.join(__dirname, '../fixtures/temp-backup-test');
    commandsDir = path.join(testTempDir, 'commands');

    await fs.mkdir(commandsDir, { recursive: true });

    logger = new Logger({ debug: false });
    backupManager = new BackupManager(testTempDir, logger);

    // Create test command files
    await fs.writeFile(path.join(commandsDir, 'test-command.md'), '# Test Command\nContent');
    await fs.writeFile(path.join(commandsDir, 'test-command.txt'), 'Test command text');
  });

  afterEach(async () => {
    // Cleanup temporary test directory
    await fs.rm(testTempDir, { recursive: true, force: true }).catch(() => {});
  });

  describe('createBackup', () => {
    test('should create backup with timestamp', async () => {
      const backupPath = await backupManager.createBackup();

      expect(backupPath).toBeDefined();
      expect(backupPath).toMatch(/commands-backup-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}/);

      const backupExists = await fs.access(backupPath).then(() => true).catch(() => false);
      expect(backupExists).toBe(true);
    });

    test('should copy all command files to backup', async () => {
      const backupPath = await backupManager.createBackup();

      const testMdExists = await fs.access(path.join(backupPath, 'test-command.md')).then(() => true).catch(() => false);
      const testTxtExists = await fs.access(path.join(backupPath, 'test-command.txt')).then(() => true).catch(() => false);

      expect(testMdExists).toBe(true);
      expect(testTxtExists).toBe(true);
    });

    test('should complete backup in <2s for 24 files', async () => {
      // Create 24 test files (12 commands × 2 files each)
      for (let i = 0; i < 12; i++) {
        await fs.writeFile(path.join(commandsDir, `command-${i}.md`), `# Command ${i}\nContent`);
        await fs.writeFile(path.join(commandsDir, `command-${i}.txt`), `Command ${i} text`);
      }

      const startTime = Date.now();
      await backupManager.createBackup();
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(2000);
    });

    test('should handle empty commands directory', async () => {
      // Remove test files
      await fs.unlink(path.join(commandsDir, 'test-command.md'));
      await fs.unlink(path.join(commandsDir, 'test-command.txt'));

      const backupPath = await backupManager.createBackup();

      expect(backupPath).toBeDefined();
      const backupExists = await fs.access(backupPath).then(() => true).catch(() => false);
      expect(backupExists).toBe(true);
    });

    // Skip on Windows - chmod doesn't work the same way
    const testOrSkip = process.platform === 'win32' ? test.skip : test;
    testOrSkip('should handle permission errors gracefully', async () => {
      // Make commands directory read-only (simulate permission error)
      await fs.chmod(commandsDir, 0o444);

      await expect(backupManager.createBackup()).rejects.toThrow();

      // Restore permissions for cleanup
      await fs.chmod(commandsDir, 0o755);
    });
  });

  describe('restore', () => {
    test('should restore files from backup', async () => {
      const backupPath = await backupManager.createBackup();

      // Delete original files
      await fs.unlink(path.join(commandsDir, 'test-command.md'));
      await fs.unlink(path.join(commandsDir, 'test-command.txt'));

      await backupManager.restore(backupPath);

      const testMdExists = await fs.access(path.join(commandsDir, 'test-command.md')).then(() => true).catch(() => false);
      const testTxtExists = await fs.access(path.join(commandsDir, 'test-command.txt')).then(() => true).catch(() => false);

      expect(testMdExists).toBe(true);
      expect(testTxtExists).toBe(true);
    });

    test('should perform atomic restoration', async () => {
      const backupPath = await backupManager.createBackup();

      // Modify original file
      await fs.writeFile(path.join(commandsDir, 'test-command.md'), 'Modified content');

      await backupManager.restore(backupPath);

      const content = await fs.readFile(path.join(commandsDir, 'test-command.md'), 'utf8');
      expect(content).toBe('# Test Command\nContent');
    });

    test('should validate backup before restoration', async () => {
      const invalidBackupPath = path.join(testTempDir, 'invalid-backup');

      await expect(backupManager.restore(invalidBackupPath)).rejects.toThrow();
    });

    // Skip on Windows - chmod doesn't work the same way
    const testOrSkipRestore = process.platform === 'win32' ? test.skip : test;
    testOrSkipRestore('should handle restoration errors gracefully', async () => {
      const backupPath = await backupManager.createBackup();

      // Make commands directory read-only
      await fs.chmod(commandsDir, 0o444);

      await expect(backupManager.restore(backupPath)).rejects.toThrow();

      // Restore permissions
      await fs.chmod(commandsDir, 0o755);
    });
  });

  describe('validateBackupIntegrity', () => {
    test('should validate backup with correct file count', async () => {
      const backupPath = await backupManager.createBackup();

      const isValid = await backupManager.validateBackupIntegrity(backupPath);

      expect(isValid).toBe(true);
    });

    test('should detect missing files in backup', async () => {
      const backupPath = await backupManager.createBackup();

      // Delete a file from backup
      await fs.unlink(path.join(backupPath, 'test-command.md'));

      const isValid = await backupManager.validateBackupIntegrity(backupPath);

      expect(isValid).toBe(false);
    });

    test('should validate backup structure', async () => {
      const backupPath = await backupManager.createBackup();

      const stats = await fs.stat(backupPath);
      expect(stats.isDirectory()).toBe(true);

      const isValid = await backupManager.validateBackupIntegrity(backupPath);
      expect(isValid).toBe(true);
    });

    test('should reject non-existent backup paths', async () => {
      const nonExistentPath = path.join(testTempDir, 'non-existent-backup');

      const isValid = await backupManager.validateBackupIntegrity(nonExistentPath);

      expect(isValid).toBe(false);
    });
  });

  describe('cleanup', () => {
    test('should remove backup after successful migration', async () => {
      const backupPath = await backupManager.createBackup();

      await backupManager.cleanup(backupPath);

      const backupExists = await fs.access(backupPath).then(() => true).catch(() => false);
      expect(backupExists).toBe(false);
    });

    test('should handle cleanup errors gracefully', async () => {
      const nonExistentPath = path.join(testTempDir, 'non-existent-backup');

      // Should not throw error
      await expect(backupManager.cleanup(nonExistentPath)).resolves.not.toThrow();
    });

    test('should preserve commands directory after cleanup', async () => {
      const backupPath = await backupManager.createBackup();

      await backupManager.cleanup(backupPath);

      const commandsExists = await fs.access(commandsDir).then(() => true).catch(() => false);
      expect(commandsExists).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    test('should handle corrupted backup directory', async () => {
      const backupPath = await backupManager.createBackup();

      // Create invalid structure
      await fs.writeFile(path.join(backupPath, 'invalid.file'), 'corrupted');
      await fs.unlink(path.join(backupPath, 'test-command.md'));

      const isValid = await backupManager.validateBackupIntegrity(backupPath);
      expect(isValid).toBe(false);
    });

    test('should handle concurrent backup operations', async () => {
      const backup1 = await backupManager.createBackup();

      // Wait 1ms to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 1));

      const backup2 = await backupManager.createBackup();

      expect(backup1).toBeDefined();
      expect(backup2).toBeDefined();
      expect(backup1).not.toBe(backup2); // Different timestamps
    });

    test('should handle large file counts efficiently', async () => {
      // Remove original test files first
      await fs.unlink(path.join(commandsDir, 'test-command.md'));
      await fs.unlink(path.join(commandsDir, 'test-command.txt'));

      // Create 100 files
      for (let i = 0; i < 50; i++) {
        await fs.writeFile(path.join(commandsDir, `command-${i}.md`), `# Command ${i}`);
        await fs.writeFile(path.join(commandsDir, `command-${i}.txt`), `Command ${i}`);
      }

      const startTime = Date.now();
      const backupPath = await backupManager.createBackup();
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000); // Should be <5s for 100 files

      const files = await fs.readdir(backupPath);
      expect(files.length).toBe(100);
    });
  });
});
