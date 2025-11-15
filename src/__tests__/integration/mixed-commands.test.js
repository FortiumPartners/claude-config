/**
 * TRD-053: Mixed Commands Integration Test
 * Tests migration with both AI Mesh and third-party commands
 * 
 * Scenario:
 * 1. Start with mix of AI Mesh and third-party commands
 * 2. Create test third-party commands (no @ai-mesh-command metadata)
 * 3. Run migration process
 * 4. Verify AI Mesh commands migrated to ai-mesh/
 * 5. Verify third-party commands remain in root
 * 6. Verify validation passed
 * 
 * Success Criteria:
 * - AI Mesh commands in ai-mesh/ subdirectory
 * - Third-party commands remain in commands/ root
 * - No false positives (third-party not migrated)
 * - No false negatives (AI Mesh commands migrated)
 */

const path = require('path');
const fs = require('fs').promises;
const { CommandMigrator } = require('../../installer/command-migrator');
const { Logger } = require('../../utils/logger');
const { IntegrationTestUtils } = require('./test-utils');

describe('TRD-053: Mixed Commands Test', () => {
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

  describe('Mixed Command Migration', () => {
    test('should migrate only AI Mesh commands', async () => {
      // Setup mixed commands
      await utils.seedTestCommands(testDir, {
        aiMeshCommands: ['create-prd', 'create-trd', 'implement-trd'],
        thirdPartyCommands: ['custom-cmd1', 'custom-cmd2', 'external-tool']
      });

      const migrator = new CommandMigrator(testDir, logger);
      const result = await migrator.migrate();

      // Verify only AI Mesh commands migrated
      expect(result.success).toBe(true);
      expect(result.migratedCount).toBe(6); // 3 AI Mesh commands × 2 files

      // Verify AI Mesh commands in ai-mesh/
      const { found: aiMeshFound } = await utils.verifyFiles(
        testDir,
        ['create-prd.md', 'create-prd.txt', 'create-trd.md', 'create-trd.txt', 'implement-trd.md', 'implement-trd.txt'],
        'ai-mesh'
      );
      expect(aiMeshFound.length).toBe(6);

      // Verify third-party commands remain in root
      const { found: thirdPartyFound } = await utils.verifyFiles(
        testDir,
        ['custom-cmd1.md', 'custom-cmd2.md', 'external-tool.md'],
        ''
      );
      expect(thirdPartyFound.length).toBe(3);
    });

    test('should detect metadata correctly', async () => {
      const commandsDir = path.join(testDir, 'commands');
      await fs.mkdir(commandsDir, { recursive: true });

      // AI Mesh command with metadata
      await fs.writeFile(
        path.join(commandsDir, 'ai-mesh-cmd.md'),
        '# @ai-mesh-command\n# Command: ai-mesh-cmd\n\nAI Mesh command content.'
      );

      // Third-party command without metadata
      await fs.writeFile(
        path.join(commandsDir, 'third-party-cmd.md'),
        '# Third Party Command\n\nNo @ai-mesh-command metadata here.'
      );

      // Misleading content (has similar text but not in metadata)
      await fs.writeFile(
        path.join(commandsDir, 'misleading-cmd.md'),
        '# Custom Command\n\nThis mentions @ai-mesh-command in content but not in header.'
      );

      const migrator = new CommandMigrator(testDir, logger);
      
      // Scan commands
      const { aiMeshCommands, thirdPartyCommands } = await migrator.scanExistingCommands();

      expect(aiMeshCommands).toContain('ai-mesh-cmd.md');
      expect(aiMeshCommands.length).toBe(1);

      expect(thirdPartyCommands).toContain('third-party-cmd.md');
      expect(thirdPartyCommands).toContain('misleading-cmd.md');
      expect(thirdPartyCommands.length).toBe(2);
    });

    test('should preserve third-party commands in root', async () => {
      await utils.seedTestCommands(testDir, {
        aiMeshCommands: ['create-prd', 'create-trd'],
        thirdPartyCommands: ['legacy-tool', 'custom-script']
      });

      const commandsDir = path.join(testDir, 'commands');

      // Verify third-party files exist before migration
      const preMigrationThirdParty = await utils.countFiles(commandsDir, '.md');
      expect(preMigrationThirdParty).toBe(4); // 2 AI Mesh .md + 2 third-party .md

      // Run migration
      const migrator = new CommandMigrator(testDir, logger);
      await migrator.migrate();

      // Verify third-party commands still in root
      const { found } = await utils.verifyFiles(
        testDir,
        ['legacy-tool.md', 'custom-script.md'],
        ''
      );
      expect(found.length).toBe(2);

      // Verify third-party content unchanged (should not have marker in header)
      const legacyContent = await fs.readFile(
        path.join(commandsDir, 'legacy-tool.md'),
        'utf8'
      );
      // Check that it doesn't start with the marker (not in a header/comment)
      const lines = legacyContent.split('\n').slice(0, 10);
      const hasMarker = lines.some(line => line.trim().match(/^#+\s*@ai-mesh-command/));
      expect(hasMarker).toBe(false);
    });

    test('should handle no third-party commands gracefully', async () => {
      // Only AI Mesh commands
      await utils.seedTestCommands(testDir, {
        aiMeshCommands: ['create-prd', 'create-trd'],
        thirdPartyCommands: []
      });

      const migrator = new CommandMigrator(testDir, logger);
      const result = await migrator.migrate();

      expect(result.success).toBe(true);
      expect(result.migratedCount).toBe(4); // 2 commands × 2 files

      // No third-party commands in root
      const commandsDir = path.join(testDir, 'commands');
      const rootFiles = await utils.countFiles(commandsDir, '.md');
      expect(rootFiles).toBe(0);
    });

    test('should handle only third-party commands', async () => {
      // No AI Mesh commands
      await utils.seedTestCommands(testDir, {
        aiMeshCommands: [],
        thirdPartyCommands: ['custom1', 'custom2', 'custom3']
      });

      const migrator = new CommandMigrator(testDir, logger);
      const result = await migrator.migrate();

      expect(result.success).toBe(true);
      expect(result.migratedCount).toBe(0); // No AI Mesh commands to migrate

      // Verify third-party commands still in root
      const { found } = await utils.verifyFiles(
        testDir,
        ['custom1.md', 'custom2.md', 'custom3.md'],
        ''
      );
      expect(found.length).toBe(3);
    });
  });

  describe('Metadata Detection Accuracy', () => {
    test('should avoid false positives (not migrate third-party)', async () => {
      const commandsDir = path.join(testDir, 'commands');
      await fs.mkdir(commandsDir, { recursive: true });

      // Various third-party formats (should NOT be migrated)
      const thirdPartyFormats = [
        { name: 'no-header.md', content: 'Content without any header' },
        { name: 'comment-only.md', content: '<!-- @ai-mesh-command in comment -->\nContent' },
        { name: 'body-mention.md', content: '# Title\n\nMentions @ai-mesh-command in body' },
        { name: 'wrong-format.md', content: '@ai-mesh-command (not in comment)\nContent' }
      ];

      for (const format of thirdPartyFormats) {
        await fs.writeFile(path.join(commandsDir, format.name), format.content);
      }

      const migrator = new CommandMigrator(testDir, logger);
      const { aiMeshCommands } = await migrator.scanExistingCommands();

      // None should be detected as AI Mesh commands
      expect(aiMeshCommands.length).toBe(0);
    });

    test('should avoid false negatives (migrate all AI Mesh commands)', async () => {
      const commandsDir = path.join(testDir, 'commands');
      await fs.mkdir(commandsDir, { recursive: true });

      // Various valid AI Mesh formats (should ALL be migrated)
      const validFormats = [
        { name: 'format1.md', content: '# @ai-mesh-command\nContent' },
        { name: 'format2.md', content: '## @ai-mesh-command\nContent' },
        { name: 'format3.md', content: '<!-- @ai-mesh-command -->\nContent' },
        { name: 'format4.md', content: '# @ai-mesh-command: create-prd\nContent' }
      ];

      for (const format of validFormats) {
        await fs.writeFile(path.join(commandsDir, format.name), format.content);
      }

      const migrator = new CommandMigrator(testDir, logger);
      const { aiMeshCommands } = await migrator.scanExistingCommands();

      // All should be detected
      expect(aiMeshCommands.length).toBe(4);
    });

    test('should handle edge cases in detection', async () => {
      const commandsDir = path.join(testDir, 'commands');
      await fs.mkdir(commandsDir, { recursive: true });

      // Edge cases
      await fs.writeFile(
        path.join(commandsDir, 'whitespace.md'),
        '   # @ai-mesh-command   \nContent' // Extra whitespace
      );

      await fs.writeFile(
        path.join(commandsDir, 'case-sensitive.md'),
        '# @AI-MESH-COMMAND\nContent' // Different case
      );

      await fs.writeFile(
        path.join(commandsDir, 'multiline.md'),
        '\n\n# @ai-mesh-command\nContent' // Blank lines before
      );

      const migrator = new CommandMigrator(testDir, logger);
      const { aiMeshCommands } = await migrator.scanExistingCommands();

      // Whitespace and multiline should be detected
      expect(aiMeshCommands).toContain('whitespace.md');
      expect(aiMeshCommands).toContain('multiline.md');
      
      // Case-sensitive should NOT be detected (uppercase)
      expect(aiMeshCommands).not.toContain('case-sensitive.md');
    });
  });

  describe('Complex Mixed Scenarios', () => {
    test('should handle large mixed installation', async () => {
      // Large set of mixed commands
      await utils.seedTestCommands(testDir, {
        aiMeshCommands: [
          'create-prd', 'create-trd', 'implement-trd', 'fold-prompt',
          'manager-dashboard', 'analyze-product', 'refine-prd', 'refine-trd'
        ],
        thirdPartyCommands: [
          'custom1', 'custom2', 'custom3', 'custom4', 'custom5',
          'legacy1', 'legacy2', 'external1', 'external2', 'external3'
        ]
      });

      const migrator = new CommandMigrator(testDir, logger);
      const result = await migrator.migrate();

      // Verify correct counts
      expect(result.success).toBe(true);
      expect(result.migratedCount).toBe(16); // 8 AI Mesh × 2 files

      // Verify AI Mesh commands in ai-mesh/
      const aiMeshDir = path.join(testDir, 'commands', 'ai-mesh');
      const aiMeshCount = await utils.countFiles(aiMeshDir);
      expect(aiMeshCount).toBe(16);

      // Verify third-party commands in root
      const commandsDir = path.join(testDir, 'commands');
      const rootFiles = await fs.readdir(commandsDir);
      const thirdPartyFiles = rootFiles.filter(f => f.endsWith('.md') && f !== 'ai-mesh');
      expect(thirdPartyFiles.length).toBe(10);
    });

    test('should preserve directory structure for third-party', async () => {
      const commandsDir = path.join(testDir, 'commands');
      await fs.mkdir(commandsDir, { recursive: true });

      // Create third-party subdirectory structure
      const customDir = path.join(commandsDir, 'custom');
      await fs.mkdir(customDir, { recursive: true });

      await fs.writeFile(
        path.join(customDir, 'tool.md'),
        'Third-party tool in subdirectory'
      );

      // Create AI Mesh commands in root
      await utils.seedTestCommands(testDir, {
        aiMeshCommands: ['create-prd']
      });

      const migrator = new CommandMigrator(testDir, logger);
      await migrator.migrate();

      // Verify third-party subdirectory preserved
      const customToolPath = path.join(customDir, 'tool.md');
      try {
        await fs.access(customToolPath);
        // File should still exist
        expect(true).toBe(true);
      } catch {
        fail('Third-party subdirectory should be preserved');
      }
    });

    test('should generate comprehensive migration report', async () => {
      await utils.seedTestCommands(testDir, {
        aiMeshCommands: ['create-prd', 'create-trd', 'implement-trd'],
        thirdPartyCommands: ['custom1', 'custom2']
      });

      const migrator = new CommandMigrator(testDir, logger);
      
      // Get detailed scan results
      const { aiMeshCommands, thirdPartyCommands } = await migrator.scanExistingCommands();

      // Run migration
      const result = await migrator.migrate();

      // Verify comprehensive reporting
      expect(aiMeshCommands.length).toBe(6); // 3 commands × 2 files
      expect(thirdPartyCommands.length).toBe(2); // 2 third-party
      expect(result.migratedCount).toBe(6);
      expect(result.errorCount).toBe(0);

      // Create test report
      const report = utils.createTestReport({
        scenario: 'Mixed Commands',
        passed: result.success,
        duration: result.duration,
        assertions: 5,
        filesCreated: aiMeshCommands.length + thirdPartyCommands.length,
        validationsPassed: 5,
        performance: {
          migration: result.duration
        }
      });

      expect(report.passed).toBe(true);
      expect(report.filesCreated).toBe(8);
    });
  });

  describe('Migration Safety', () => {
    test('should never modify third-party command content', async () => {
      const commandsDir = path.join(testDir, 'commands');
      await fs.mkdir(commandsDir, { recursive: true });

      const thirdPartyContent = '# Custom Tool\n\nVery important third-party content\nDo not modify!';
      
      await fs.writeFile(
        path.join(commandsDir, 'custom.md'),
        thirdPartyContent
      );

      await utils.seedTestCommands(testDir, {
        aiMeshCommands: ['create-prd']
      });

      const migrator = new CommandMigrator(testDir, logger);
      await migrator.migrate();

      // Verify third-party content unchanged
      const postContent = await fs.readFile(
        path.join(commandsDir, 'custom.md'),
        'utf8'
      );

      expect(postContent).toBe(thirdPartyContent);
    });

    test('should backup third-party commands', async () => {
      await utils.seedTestCommands(testDir, {
        aiMeshCommands: ['create-prd'],
        thirdPartyCommands: ['custom1', 'custom2']
      });

      const migrator = new CommandMigrator(testDir, logger);
      const result = await migrator.migrate();

      // Verify backup includes third-party files
      const backupFiles = await utils.getAllFiles(result.backupPath);
      const backupNames = backupFiles.map(f => path.basename(f));

      expect(backupNames).toContain('custom1.md');
      expect(backupNames).toContain('custom2.md');
    });
  });
});
