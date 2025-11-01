/**
 * Performance Benchmark Suite
 * TRD-057: Create performance benchmark suite
 *
 * Comprehensive performance testing for command migration system
 * Performance targets:
 * - Migration: <5s for 24 files
 * - Command resolution: <100ms for 12 commands
 * - Validation: <300ms total
 * - Installer: <30s total execution
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const CommandMigrator = require('../../installer/command-migrator');
const YamlRewriter = require('../../installer/yaml-rewriter');
const ValidationSystem = require('../../installer/validation-system');
const BackupManager = require('../../installer/backup-manager');

// Mock logger for performance tests
const mockLogger = {
  info: jest.fn(),
  success: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
  progress: jest.fn(),
  updateLine: jest.fn()
};

describe('Performance Benchmark Suite (TRD-057)', () => {
  let testDir;
  let commandsDir;
  let yamlDir;

  beforeEach(async () => {
    // Create temporary test environment
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'perf-test-'));
    commandsDir = path.join(testDir, 'commands');
    yamlDir = path.join(commandsDir, 'yaml');

    await fs.mkdir(commandsDir, { recursive: true });
    await fs.mkdir(yamlDir, { recursive: true });

    // Seed with test commands
    await seedTestCommands(commandsDir, yamlDir);
  });

  afterEach(async () => {
    // Cleanup
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Migration Performance (TRD-057)', () => {
    test('should complete full migration in <5s for 24 files', async () => {
      const migrator = new CommandMigrator(testDir, mockLogger);

      const startTime = Date.now();
      await migrator.migrate();
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000); // <5s target
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    test('should migrate single file in <50ms', async () => {
      const migrator = new CommandMigrator(testDir, mockLogger);
      const testFile = path.join(commandsDir, 'test-command.md');

      await fs.writeFile(testFile, '# @ai-mesh-command\nTest command');

      const startTime = Date.now();
      await migrator.detectAiMeshCommand(testFile);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(50); // <50ms per file
    });

    test('should handle 100 files in <500ms', async () => {
      // Create 100 test files
      const files = [];
      for (let i = 0; i < 100; i++) {
        const filePath = path.join(commandsDir, `test-${i}.md`);
        await fs.writeFile(filePath, '# @ai-mesh-command\nTest');
        files.push(filePath);
      }

      const migrator = new CommandMigrator(testDir, mockLogger);

      const startTime = Date.now();
      for (const file of files) {
        await migrator.detectAiMeshCommand(file);
      }
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(500); // <500ms for 100 files
    });
  });

  describe('YAML Rewriter Performance (TRD-057)', () => {
    test('should rewrite YAML in <10ms per file', async () => {
      const rewriter = new YamlRewriter(testDir, mockLogger);
      const yamlFile = path.join(yamlDir, 'test-command.yaml');

      await fs.writeFile(yamlFile, `
metadata:
  name: test-command
  description: Test
  output_path: test-command.md
`);

      const startTime = Date.now();
      await rewriter.rewriteYamlFile(yamlFile);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(10); // <10ms per file
    });

    test('should rewrite all 12 YAMLs in <120ms', async () => {
      const rewriter = new YamlRewriter(testDir, mockLogger);

      const startTime = Date.now();
      await rewriter.rewriteAllYamls();
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(120); // <120ms for 12 files
    });
  });

  describe('Validation Performance (TRD-057)', () => {
    test('should validate installation in <300ms', async () => {
      // Set up complete installation
      const aiMeshDir = path.join(commandsDir, 'ai-mesh');
      await fs.mkdir(aiMeshDir, { recursive: true });

      // Create all 24 expected files
      const commands = [
        'create-prd', 'create-trd', 'implement-trd', 'fold-prompt',
        'manager-dashboard', 'analyze-product', 'refine-prd', 'refine-trd',
        'sprint-status', 'playwright-test', 'generate-api-docs', 'web-metrics-dashboard'
      ];

      for (const cmd of commands) {
        await fs.writeFile(path.join(aiMeshDir, `${cmd}.md`), '# @ai-mesh-command\nTest');
        await fs.writeFile(path.join(aiMeshDir, `${cmd}.txt`), '@ai-mesh-command\nTest');
      }

      const validator = new ValidationSystem(testDir, mockLogger);

      const startTime = Date.now();
      await validator.runFullValidation();
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(300); // <300ms total validation
    });

    test('should validate file existence in <50ms', async () => {
      const validator = new ValidationSystem(testDir, mockLogger);

      // Create ai-mesh directory
      await fs.mkdir(path.join(commandsDir, 'ai-mesh'), { recursive: true });

      const startTime = Date.now();
      await validator.validateFileExistence();
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(50); // <50ms file validation
    });
  });

  describe('Backup Performance (TRD-057)', () => {
    test('should create backup in <2s for 24 files', async () => {
      const backupManager = new BackupManager(testDir, mockLogger);

      const startTime = Date.now();
      await backupManager.createBackup();
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(2000); // <2s backup creation
    });

    test('should restore from backup in <1s', async () => {
      const backupManager = new BackupManager(testDir, mockLogger);

      // Create backup first
      const backupPath = await backupManager.createBackup();

      const startTime = Date.now();
      await backupManager.restore(backupPath);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000); // <1s restore
    });
  });

  describe('Memory Performance (TRD-057)', () => {
    test('should not exceed 50MB memory during migration', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      const migrator = new CommandMigrator(testDir, mockLogger);
      await migrator.migrate();

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB

      expect(memoryIncrease).toBeLessThan(50); // <50MB increase
    });
  });

  describe('Concurrent Performance (TRD-057)', () => {
    test('should handle 10 concurrent migrations without degradation', async () => {
      const migrations = [];

      for (let i = 0; i < 10; i++) {
        const testDirConcurrent = await fs.mkdtemp(path.join(os.tmpdir(), `perf-concurrent-${i}-`));
        const commandsDirConcurrent = path.join(testDirConcurrent, 'commands');
        const yamlDirConcurrent = path.join(commandsDirConcurrent, 'yaml');

        await fs.mkdir(commandsDirConcurrent, { recursive: true });
        await fs.mkdir(yamlDirConcurrent, { recursive: true });
        await seedTestCommands(commandsDirConcurrent, yamlDirConcurrent);

        const migrator = new CommandMigrator(testDirConcurrent, mockLogger);
        migrations.push(migrator.migrate());
      }

      const startTime = Date.now();
      await Promise.all(migrations);
      const duration = Date.now() - startTime;

      // Should complete all 10 migrations in reasonable time
      expect(duration).toBeLessThan(10000); // <10s for 10 concurrent migrations
    });
  });
});

// Helper function to seed test commands
async function seedTestCommands(commandsDir, yamlDir) {
  const commands = [
    'create-prd', 'create-trd', 'implement-trd', 'fold-prompt',
    'manager-dashboard', 'analyze-product', 'refine-prd', 'refine-trd',
    'sprint-status', 'playwright-test', 'generate-api-docs', 'web-metrics-dashboard'
  ];

  for (const cmd of commands) {
    // Create .md and .txt files
    await fs.writeFile(
      path.join(commandsDir, `${cmd}.md`),
      `# @ai-mesh-command\nCommand: ${cmd}\nVersion: 1.0.0\n\n${cmd} command content`
    );

    await fs.writeFile(
      path.join(commandsDir, `${cmd}.txt`),
      `@ai-mesh-command\nCommand: ${cmd}\nVersion: 1.0.0\n\n${cmd} command content`
    );

    // Create YAML definition
    await fs.writeFile(
      path.join(yamlDir, `${cmd}.yaml`),
      `metadata:
  name: ${cmd}
  description: "${cmd} command"
  output_path: ${cmd}.md
`
    );
  }
}
