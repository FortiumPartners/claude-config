/**
 * TRD-051: Fresh Installation Integration Test
 * Tests complete installation from empty state
 * 
 * Scenario:
 * 1. Start with empty directory (no existing installation)
 * 2. Run NPM installer with --global flag
 * 3. Verify all components installed correctly
 * 4. Verify migration completed successfully
 * 5. Verify validation passed
 * 6. Verify commands can be loaded
 * 
 * Expected Performance: <5s total installation time
 */

const path = require('path');
const fs = require('fs').promises;
const { CommandMigrator } = require('../../installer/command-migrator');
const { Logger } = require('../../utils/logger');
const { IntegrationTestUtils } = require('./test-utils');

describe('TRD-051: Fresh Installation Test', () => {
  let testDir;
  let utils;
  let logger;

  beforeEach(async () => {
    const baseDir = path.join(__dirname, '../fixtures/temp-integration');
    utils = new IntegrationTestUtils(baseDir);
    testDir = await utils.createTestEnvironment({ createCommandsDir: false });
    logger = new Logger({ debug: false });
  });

  afterEach(async () => {
    await utils.cleanup(testDir);
  });

  describe('Fresh Installation Scenario', () => {
    test('should install all components successfully from empty state', async () => {
      // Step 1: Verify empty state
      const commandsDir = path.join(testDir, 'commands');
      
      try {
        await fs.access(commandsDir);
        fail('Commands directory should not exist initially');
      } catch {
        // Expected - directory doesn't exist
      }

      // Step 2: Seed AI Mesh commands (simulating fresh installation)
      const { aiMeshCount } = await utils.seedTestCommands(testDir, {
        aiMeshCommands: [
          'create-prd', 'create-trd', 'implement-trd', 'fold-prompt',
          'manager-dashboard', 'analyze-product', 'refine-prd', 'refine-trd',
          'sprint-status', 'playwright-test', 'generate-api-docs', 'web-metrics-dashboard'
        ]
      });

      expect(aiMeshCount).toBe(24); // 12 commands × 2 files each

      // Step 3: Run migration
      const migrator = new CommandMigrator(testDir, logger);
      
      const { result, duration: migrationDuration } = await utils.measureTime(async () => {
        return await migrator.migrate();
      });

      expect(result.success).toBe(true);
      expect(result.migratedCount).toBe(24);
      expect(result.errorCount).toBe(0);
      expect(result.backupPath).toBeTruthy();

      // Step 4: Verify all 24 files present in ai-mesh/ directory
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

      // Step 5: Verify backup created
      const backupPath = await utils.findBackupDirectory(testDir);
      expect(backupPath).toBeTruthy();

      const backupFileCount = await utils.countFiles(backupPath);
      expect(backupFileCount).toBe(24);

      // Step 6: Verify validation passed
      const validation = await migrator.validateMigration();
      
      expect(validation.valid).toBe(true);
      expect(validation.expectedCount).toBe(24);
      expect(validation.actualCount).toBe(24);
      expect(validation.missing.length).toBe(0);

      // Step 7: Verify commands are discoverable (no files in root)
      const rootFiles = await utils.countFiles(commandsDir, '.md');
      expect(rootFiles).toBe(0); // All files moved to ai-mesh/

      // Performance validation: <5s total
      const totalDuration = migrationDuration;
      expect(totalDuration).toBeLessThan(5000);
    });

    test('should complete installation in <5s', async () => {
      // Setup: Seed commands
      await utils.seedTestCommands(testDir, {
        aiMeshCommands: [
          'create-prd', 'create-trd', 'implement-trd', 'fold-prompt',
          'manager-dashboard', 'analyze-product', 'refine-prd', 'refine-trd',
          'sprint-status', 'playwright-test', 'generate-api-docs', 'web-metrics-dashboard'
        ]
      });

      const migrator = new CommandMigrator(testDir, logger);

      // Measure complete installation time
      const startTime = Date.now();
      
      const result = await migrator.migrate();
      const validation = await migrator.validateMigration();
      
      const totalDuration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(validation.valid).toBe(true);
      expect(totalDuration).toBeLessThan(5000);
    });

    test('should create proper directory structure', async () => {
      // Seed commands
      await utils.seedTestCommands(testDir);

      const migrator = new CommandMigrator(testDir, logger);
      await migrator.migrate();

      // Verify directory structure
      const commandsDir = path.join(testDir, 'commands');
      const aiMeshDir = path.join(commandsDir, 'ai-mesh');

      const commandsStats = await fs.stat(commandsDir);
      expect(commandsStats.isDirectory()).toBe(true);

      const aiMeshStats = await fs.stat(aiMeshDir);
      expect(aiMeshStats.isDirectory()).toBe(true);

      // Verify permissions (0o755 = rwxr-xr-x)
      const mode = aiMeshStats.mode & 0o777;
      expect(mode).toBe(0o755);
    });

    test('should handle installation with no pre-existing commands', async () => {
      // Create empty commands directory
      const commandsDir = path.join(testDir, 'commands');
      await fs.mkdir(commandsDir, { recursive: true });

      const migrator = new CommandMigrator(testDir, logger);
      
      // Should complete without errors
      const result = await migrator.migrate();
      
      expect(result.success).toBe(true);
      expect(result.migratedCount).toBe(0);
      expect(result.errorCount).toBe(0);

      // Backup should still be created
      expect(result.backupPath).toBeTruthy();
    });

    test('should create comprehensive test report', async () => {
      // Seed commands
      const { aiMeshCount } = await utils.seedTestCommands(testDir, {
        aiMeshCommands: [
          'create-prd', 'create-trd', 'implement-trd', 'fold-prompt',
          'manager-dashboard', 'analyze-product'
        ]
      });

      const migrator = new CommandMigrator(testDir, logger);

      // Measure detailed performance
      const installStart = Date.now();
      const migrationResult = await migrator.migrate();
      const migrationTime = Date.now() - installStart;

      const validationStart = Date.now();
      const validationResult = await migrator.validateMigration({
        expectedCommands: [
          'create-prd', 'create-trd', 'implement-trd', 'fold-prompt',
          'manager-dashboard', 'analyze-product'
        ]
      });
      const validationTime = Date.now() - validationStart;

      // Create test report
      const report = utils.createTestReport({
        scenario: 'Fresh Installation',
        passed: migrationResult.success && validationResult.valid,
        duration: migrationTime + validationTime,
        assertions: 6,
        filesCreated: aiMeshCount,
        validationsPassed: 6,
        performance: {
          installation: migrationTime,
          migration: migrationResult.duration,
          validation: validationTime
        }
      });

      expect(report.passed).toBe(true);
      expect(report.duration).toBeLessThan(5000);
      expect(report.filesCreated).toBe(12); // 6 commands × 2 files
      expect(report.performance.installation).toBeLessThan(1000);
    });
  });

  describe('Edge Cases', () => {
    test('should handle installation with existing ai-mesh directory', async () => {
      // Pre-create ai-mesh directory
      const aiMeshDir = path.join(testDir, 'commands', 'ai-mesh');
      await fs.mkdir(aiMeshDir, { recursive: true });

      // Seed commands in root
      await utils.seedTestCommands(testDir);

      const migrator = new CommandMigrator(testDir, logger);
      const result = await migrator.migrate();

      expect(result.success).toBe(true);
      expect(result.migratedCount).toBeGreaterThan(0);
    });

    test('should handle installation with mixed file extensions', async () => {
      const commandsDir = path.join(testDir, 'commands');
      await fs.mkdir(commandsDir, { recursive: true });

      // Create various file types
      await fs.writeFile(
        path.join(commandsDir, 'test.md'),
        '# @ai-mesh-command\nMarkdown command'
      );
      
      await fs.writeFile(
        path.join(commandsDir, 'test.txt'),
        '# @ai-mesh-command\nText command'
      );
      
      await fs.writeFile(
        path.join(commandsDir, 'readme.md'),
        'Regular readme without metadata'
      );

      const migrator = new CommandMigrator(testDir, logger);
      const result = await migrator.migrate();

      expect(result.success).toBe(true);
      expect(result.migratedCount).toBe(2); // Only .md and .txt with metadata
    });
  });
});
