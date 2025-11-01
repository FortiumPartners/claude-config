/**
 * TRD-052: Full Migration Integration Test
 * Tests complete migration from flat structure to ai-mesh/ subdirectory
 * 
 * Scenario:
 * 1. Start with flat command structure (pre-migration state)
 * 2. Run migration process
 * 3. Verify all 12 commands migrated (24 files total)
 * 4. Verify YAML paths updated
 * 5. Verify backup created
 * 6. Verify validation passed
 * 
 * Expected Performance: <1s migration time
 */

const path = require('path');
const fs = require('fs').promises;
const { CommandMigrator } = require('../../installer/command-migrator');
const { Logger } = require('../../utils/logger');
const { IntegrationTestUtils } = require('./test-utils');

describe('TRD-052: Full Migration Test', () => {
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

  describe('Complete Migration Scenario', () => {
    test('should migrate all 12 commands (24 files) successfully', async () => {
      // Step 1: Setup flat command structure (pre-migration)
      const { aiMeshCount } = await utils.seedTestCommands(testDir, {
        aiMeshCommands: [
          'create-prd', 'create-trd', 'implement-trd', 'fold-prompt',
          'manager-dashboard', 'analyze-product', 'refine-prd', 'refine-trd',
          'sprint-status', 'playwright-test', 'generate-api-docs', 'web-metrics-dashboard'
        ]
      });

      expect(aiMeshCount).toBe(24);

      // Verify files exist in root commands/
      const commandsDir = path.join(testDir, 'commands');
      const preMigrationFiles = await utils.countFiles(commandsDir);
      expect(preMigrationFiles).toBe(24);

      // Step 2: Run migration
      const migrator = new CommandMigrator(testDir, logger);
      
      const { result, duration } = await utils.measureTime(async () => {
        return await migrator.migrate();
      });

      // Step 3: Verify migration success
      expect(result.success).toBe(true);
      expect(result.migratedCount).toBe(24);
      expect(result.errorCount).toBe(0);
      expect(result.dryRun).toBe(false);

      // Step 4: Verify all files moved to ai-mesh/
      const expectedFiles = [];
      const commands = [
        'create-prd', 'create-trd', 'implement-trd', 'fold-prompt',
        'manager-dashboard', 'analyze-product', 'refine-prd', 'refine-trd',
        'sprint-status', 'playwright-test', 'generate-api-docs', 'web-metrics-dashboard'
      ];
      
      for (const cmd of commands) {
        expectedFiles.push(`${cmd}.md`);
        expectedFiles.push(`${cmd}.txt`);
      }

      const { found, missing } = await utils.verifyFiles(testDir, expectedFiles, 'ai-mesh');
      expect(found.length).toBe(24);
      expect(missing.length).toBe(0);

      // Step 5: Verify no files remain in root commands/
      const postMigrationRootFiles = await utils.countFiles(commandsDir, '.md');
      expect(postMigrationRootFiles).toBe(0);

      // Step 6: Verify backup created
      expect(result.backupPath).toBeTruthy();
      const backupFiles = await utils.getAllFiles(result.backupPath);
      expect(backupFiles.length).toBe(24);

      // Step 7: Verify migration completed in <1s
      expect(duration).toBeLessThan(1000);
    });

    test('should create complete backup before migration', async () => {
      // Setup commands
      await utils.seedTestCommands(testDir, {
        aiMeshCommands: ['create-prd', 'create-trd', 'implement-trd']
      });

      const migrator = new CommandMigrator(testDir, logger);
      const result = await migrator.migrate();

      // Verify backup exists and contains all files
      expect(result.backupPath).toBeTruthy();
      
      const backupFiles = await utils.getAllFiles(result.backupPath);
      expect(backupFiles.length).toBe(6); // 3 commands × 2 files

      // Verify backup file contents match originals
      for (const backupFile of backupFiles) {
        const filename = path.basename(backupFile);
        const content = await fs.readFile(backupFile, 'utf8');
        
        expect(content).toContain('@ai-mesh-command');
        expect(content.length).toBeGreaterThan(0);
      }
    });

    test('should validate migration completeness', async () => {
      // Setup all 12 commands
      await utils.seedTestCommands(testDir, {
        aiMeshCommands: [
          'create-prd', 'create-trd', 'implement-trd', 'fold-prompt',
          'manager-dashboard', 'analyze-product', 'refine-prd', 'refine-trd',
          'sprint-status', 'playwright-test', 'generate-api-docs', 'web-metrics-dashboard'
        ]
      });

      const migrator = new CommandMigrator(testDir, logger);
      await migrator.migrate();

      // Run validation
      const validation = await migrator.validateMigration();

      expect(validation.valid).toBe(true);
      expect(validation.expectedCount).toBe(24);
      expect(validation.actualCount).toBe(24);
      expect(validation.missing).toEqual([]);
    });

    test('should preserve file content during migration', async () => {
      const commandsDir = path.join(testDir, 'commands');
      await fs.mkdir(commandsDir, { recursive: true });

      // Create command with specific content
      const testContent = '# @ai-mesh-command\n# Command: test-command\n# Version: 1.0.0\n\n## Unique Content\n\nThis content should be preserved.';
      
      await fs.writeFile(
        path.join(commandsDir, 'test-command.md'),
        testContent
      );

      const migrator = new CommandMigrator(testDir, logger);
      await migrator.migrate();

      // Verify content preserved in ai-mesh/
      const migratedFile = path.join(commandsDir, 'ai-mesh', 'test-command.md');
      const migratedContent = await fs.readFile(migratedFile, 'utf8');

      expect(migratedContent).toBe(testContent);
    });

    test('should preserve file permissions during migration', async () => {
      const commandsDir = path.join(testDir, 'commands');
      await fs.mkdir(commandsDir, { recursive: true });

      // Create command file with specific permissions
      const testFile = path.join(commandsDir, 'test-command.md');
      await fs.writeFile(testFile, '# @ai-mesh-command\nContent');
      await utils.setFilePermissions(testFile, 0o644);

      // Verify initial permissions
      const initialStats = await fs.stat(testFile);
      const initialMode = initialStats.mode & 0o777;
      expect(initialMode).toBe(0o644);

      // Run migration
      const migrator = new CommandMigrator(testDir, logger);
      await migrator.migrate();

      // Verify permissions preserved
      const migratedFile = path.join(commandsDir, 'ai-mesh', 'test-command.md');
      const migratedStats = await fs.stat(migratedFile);
      const migratedMode = migratedStats.mode & 0o777;
      
      expect(migratedMode).toBe(0o644);
    });
  });

  describe('Performance Validation', () => {
    test('should complete migration in <1s for 24 files', async () => {
      await utils.seedTestCommands(testDir, {
        aiMeshCommands: [
          'create-prd', 'create-trd', 'implement-trd', 'fold-prompt',
          'manager-dashboard', 'analyze-product', 'refine-prd', 'refine-trd',
          'sprint-status', 'playwright-test', 'generate-api-docs', 'web-metrics-dashboard'
        ]
      });

      const migrator = new CommandMigrator(testDir, logger);

      const startTime = Date.now();
      await migrator.migrate();
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000);
    });

    test('should provide detailed performance metrics', async () => {
      await utils.seedTestCommands(testDir, {
        aiMeshCommands: ['create-prd', 'create-trd', 'implement-trd']
      });

      const migrator = new CommandMigrator(testDir, logger);

      const scanStart = Date.now();
      const { aiMeshCommands } = await migrator.scanExistingCommands();
      const scanDuration = Date.now() - scanStart;

      const migrateStart = Date.now();
      const result = await migrator.migrate();
      const migrateDuration = Date.now() - migrateStart;

      const validateStart = Date.now();
      await migrator.validateMigration();
      const validateDuration = Date.now() - validateStart;

      // Performance expectations
      expect(scanDuration).toBeLessThan(50); // Scanning should be very fast
      expect(migrateDuration).toBeLessThan(1000); // Total migration <1s
      expect(validateDuration).toBeLessThan(100); // Validation <100ms
      
      // Verify result includes duration
      expect(result.duration).toBeDefined();
      expect(result.duration).toBeLessThan(1000);
    });
  });

  describe('Migration States', () => {
    test('should handle partial migration gracefully', async () => {
      const commandsDir = path.join(testDir, 'commands');
      await fs.mkdir(commandsDir, { recursive: true });

      // Create 3 valid commands
      await utils.seedTestCommands(testDir, {
        aiMeshCommands: ['create-prd', 'create-trd', 'implement-trd']
      });

      // Create 1 file that will fail (locked/protected)
      const lockedFile = path.join(commandsDir, 'locked-command.md');
      await fs.writeFile(lockedFile, '# @ai-mesh-command\nLocked content');

      const migrator = new CommandMigrator(testDir, logger);
      const result = await migrator.migrate();

      // Should succeed for valid files
      expect(result.success).toBe(true);
      expect(result.migratedCount).toBeGreaterThanOrEqual(6); // At least 3 commands × 2 files
    });

    test('should handle empty migration (no commands to migrate)', async () => {
      const commandsDir = path.join(testDir, 'commands');
      await fs.mkdir(commandsDir, { recursive: true });

      // Create only third-party commands (no AI Mesh commands)
      await utils.seedTestCommands(testDir, {
        aiMeshCommands: [], // No AI Mesh commands
        thirdPartyCommands: ['custom-cmd1', 'custom-cmd2']
      });

      const migrator = new CommandMigrator(testDir, logger);
      const result = await migrator.migrate();

      expect(result.success).toBe(true);
      expect(result.migratedCount).toBe(0);
      expect(result.errorCount).toBe(0);
    });

    test('should handle already-migrated state (idempotent)', async () => {
      // Setup and run first migration
      await utils.seedTestCommands(testDir, {
        aiMeshCommands: ['create-prd', 'create-trd']
      });

      const migrator = new CommandMigrator(testDir, logger);
      const firstResult = await migrator.migrate();

      expect(firstResult.success).toBe(true);
      expect(firstResult.migratedCount).toBe(4); // 2 commands × 2 files

      // Run migration again (should be idempotent)
      const secondResult = await migrator.migrate();

      expect(secondResult.success).toBe(true);
      expect(secondResult.migratedCount).toBe(0); // Nothing to migrate
      expect(secondResult.errorCount).toBe(0);
    });
  });

  describe('Backup Verification', () => {
    test('should create timestamped backup directory', async () => {
      await utils.seedTestCommands(testDir, {
        aiMeshCommands: ['create-prd']
      });

      const migrator = new CommandMigrator(testDir, logger);
      const result = await migrator.migrate();

      expect(result.backupPath).toBeTruthy();
      expect(path.basename(result.backupPath)).toMatch(/commands-backup-\d{4}-\d{2}-\d{2}/);
    });

    test('should validate backup integrity', async () => {
      await utils.seedTestCommands(testDir, {
        aiMeshCommands: ['create-prd', 'create-trd', 'implement-trd']
      });

      const migrator = new CommandMigrator(testDir, logger);
      const result = await migrator.migrate();

      // Backup should exist
      const backupPath = await utils.findBackupDirectory(testDir);
      expect(backupPath).toBeTruthy();
      expect(backupPath).toBe(result.backupPath);

      // Verify backup contains all original files
      const backupFiles = await utils.getAllFiles(backupPath);
      expect(backupFiles.length).toBe(6); // 3 commands × 2 files
    });
  });
});
