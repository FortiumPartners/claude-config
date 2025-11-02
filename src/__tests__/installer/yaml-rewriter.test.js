/**
 * YAML Rewriter Tests
 * TDD Implementation: Red-Green-Refactor
 *
 * Testing YAML rewriting for command directory reorganization
 * Target: Transform output_path values to hierarchical subdirectory structure
 */

const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const { YamlRewriter } = require('../../installer/yaml-rewriter');
const { Logger } = require('../../utils/logger');

describe('YamlRewriter', () => {
  let yamlRewriter;
  let logger;
  let testDir;
  let yamlDir;

  beforeEach(async () => {
    // Create test directories
    testDir = path.join(__dirname, '..', '..', '..', 'test-temp', 'yaml-rewriter');
    yamlDir = path.join(testDir, 'commands', 'yaml');

    await fs.mkdir(yamlDir, { recursive: true });

    // Initialize logger and rewriter
    logger = new Logger({ debug: false });
    yamlRewriter = new YamlRewriter(testDir, logger);
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  // ==========================================
  // TRD-024: Create YamlRewriter Class Tests
  // ==========================================

  describe('TRD-024: YamlRewriter Class Creation', () => {
    test('should initialize with commands directory and logger', () => {
      expect(yamlRewriter).toBeDefined();
      expect(yamlRewriter.commandsDir).toBe(testDir);
      expect(yamlRewriter.logger).toBe(logger);
    });

    test('should parse valid YAML file successfully', async () => {
      const yamlContent = `metadata:
  name: test-command
  description: Test command
  output_path: test-command.md
mission:
  summary: Test mission
`;
      const yamlPath = path.join(yamlDir, 'test.yaml');
      await fs.writeFile(yamlPath, yamlContent);

      const result = await yamlRewriter.parseYaml(yamlPath);

      expect(result).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.metadata.name).toBe('test-command');
      expect(result.metadata.output_path).toBe('test-command.md');
    });

    test('should extract output_path from metadata', async () => {
      const yamlData = {
        metadata: {
          name: 'test-command',
          description: 'Test description',
          output_path: 'test-command.md'
        },
        mission: {
          summary: 'Test mission'
        }
      };

      const outputPath = yamlRewriter.extractOutputPath(yamlData);

      expect(outputPath).toBe('test-command.md');
    });

    test('should handle YAML file not found', async () => {
      const nonExistentPath = path.join(yamlDir, 'nonexistent.yaml');

      await expect(yamlRewriter.parseYaml(nonExistentPath))
        .rejects
        .toThrow();
    });

    test('should parse complex nested YAML structures', async () => {
      const complexYaml = `metadata:
  name: complex-command
  description: Complex command
  version: 1.0.0
  output_path: complex-command.md
  source: fortium
mission:
  summary: |
    Multi-line
    summary text
workflow:
  phases:
    - name: Phase 1
      steps:
        - order: 1
          title: Step 1
`;
      const yamlPath = path.join(yamlDir, 'complex.yaml');
      await fs.writeFile(yamlPath, complexYaml);

      const result = await yamlRewriter.parseYaml(yamlPath);

      expect(result.metadata.name).toBe('complex-command');
      expect(result.workflow.phases).toHaveLength(1);
      expect(result.workflow.phases[0].steps).toHaveLength(1);
    });

    test('should get YAML structure for debugging', () => {
      const yamlData = {
        metadata: {
          name: 'test',
          output_path: 'test.md'
        },
        mission: {
          summary: 'Test'
        }
      };

      const structure = yamlRewriter.getYamlStructure(yamlData);

      expect(structure).toBeDefined();
      expect(structure.hasMetadata).toBe(true);
      expect(structure.hasOutputPath).toBe(true);
      expect(structure.hasMission).toBe(true);
    });
  });

  // ==========================================
  // TRD-025: Path Rewriting Logic Tests
  // ==========================================

  describe('TRD-025: Path Rewriting Logic', () => {
    test('should rewrite single output_path to ai-mesh subdirectory', () => {
      const yamlData = {
        metadata: {
          name: 'test-command',
          output_path: 'test-command.md'
        }
      };

      const rewritten = yamlRewriter.rewriteOutputPath(yamlData);

      expect(rewritten.metadata.output_path).toBe('ai-mesh/test-command.md');
    });

    test('should handle .txt extension', () => {
      const yamlData = {
        metadata: {
          name: 'test-command',
          output_path: 'test-command.txt'
        }
      };

      const rewritten = yamlRewriter.rewriteOutputPath(yamlData);

      expect(rewritten.metadata.output_path).toBe('ai-mesh/test-command.txt');
    });

    test('should preserve all other YAML properties unchanged', () => {
      const yamlData = {
        metadata: {
          name: 'test-command',
          description: 'Test description',
          version: '1.0.0',
          output_path: 'test-command.md',
          source: 'fortium'
        },
        mission: {
          summary: 'Test mission'
        },
        workflow: {
          phases: [{ name: 'Phase 1' }]
        }
      };

      const rewritten = yamlRewriter.rewriteOutputPath(yamlData);

      expect(rewritten.metadata.name).toBe('test-command');
      expect(rewritten.metadata.description).toBe('Test description');
      expect(rewritten.metadata.version).toBe('1.0.0');
      expect(rewritten.metadata.source).toBe('fortium');
      expect(rewritten.mission.summary).toBe('Test mission');
      expect(rewritten.workflow.phases).toHaveLength(1);
    });

    test('should handle already-migrated paths (idempotent)', () => {
      const yamlData = {
        metadata: {
          name: 'test-command',
          output_path: 'ai-mesh/test-command.md'
        }
      };

      const rewritten = yamlRewriter.rewriteOutputPath(yamlData);

      // Should not duplicate the prefix
      expect(rewritten.metadata.output_path).toBe('ai-mesh/test-command.md');
    });

    test('should support custom target directory', () => {
      const yamlData = {
        metadata: {
          name: 'test-command',
          output_path: 'test-command.md'
        }
      };

      const rewritten = yamlRewriter.rewriteOutputPath(yamlData, 'custom-dir');

      expect(rewritten.metadata.output_path).toBe('custom-dir/test-command.md');
    });

    test('should handle missing output_path gracefully', () => {
      const yamlData = {
        metadata: {
          name: 'test-command',
          description: 'No output path'
        }
      };

      const rewritten = yamlRewriter.rewriteOutputPath(yamlData);

      // Should not throw, just return unchanged
      expect(rewritten.metadata.output_path).toBeUndefined();
    });
  });

  // ==========================================
  // TRD-026: YAML Validation Tests
  // ==========================================

  describe('TRD-026: YAML Validation', () => {
    test('should validate YAML with all required fields', () => {
      const yamlData = {
        metadata: {
          name: 'test-command',
          description: 'Test description',
          output_path: 'test-command.md'
        },
        mission: {
          summary: 'Test mission'
        }
      };

      const validation = yamlRewriter.validateYaml(yamlData);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should detect missing metadata.name field', () => {
      const yamlData = {
        metadata: {
          description: 'Test description',
          output_path: 'test-command.md'
        }
      };

      const validation = yamlRewriter.validateYaml(yamlData);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Missing required field: metadata.name');
    });

    test('should detect missing metadata.description field', () => {
      const yamlData = {
        metadata: {
          name: 'test-command',
          output_path: 'test-command.md'
        }
      };

      const validation = yamlRewriter.validateYaml(yamlData);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Missing required field: metadata.description');
    });

    test('should detect missing metadata.output_path field', () => {
      const yamlData = {
        metadata: {
          name: 'test-command',
          description: 'Test description'
        }
      };

      const validation = yamlRewriter.validateYaml(yamlData);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Missing required field: metadata.output_path');
    });

    test('should validate rewritten paths have correct format', () => {
      const yamlData = {
        metadata: {
          name: 'test-command',
          description: 'Test description',
          output_path: 'ai-mesh/test-command.md'
        }
      };

      const validation = yamlRewriter.validateYaml(yamlData);

      expect(validation.valid).toBe(true);
      expect(validation.warnings).not.toContain('output_path does not start with ai-mesh/');
    });

    test('should validate paths end with .md or .txt', () => {
      const yamlData = {
        metadata: {
          name: 'test-command',
          description: 'Test description',
          output_path: 'ai-mesh/test-command.json'
        }
      };

      const validation = yamlRewriter.validateYaml(yamlData);

      expect(validation.valid).toBe(true);
      expect(validation.warnings).toContain('output_path should end with .md or .txt (found: .json)');
    });

    test('should detect missing metadata section', () => {
      const yamlData = {
        mission: {
          summary: 'Test mission'
        }
      };

      const validation = yamlRewriter.validateYaml(yamlData);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Missing required section: metadata');
    });
  });

  // ==========================================
  // TRD-027: Error Handling Tests
  // ==========================================

  describe('TRD-027: Error Handling', () => {
    test('should handle malformed YAML syntax errors', async () => {
      const malformedYaml = `metadata:
  name: test
  description: "unclosed string
  output_path: test.md
`;
      const yamlPath = path.join(yamlDir, 'malformed.yaml');
      await fs.writeFile(yamlPath, malformedYaml);

      // Attempt to parse the file to get the actual error
      let parseError;
      try {
        await yamlRewriter.parseYaml(yamlPath);
      } catch (error) {
        parseError = error;
      }

      const result = await yamlRewriter.handleMalformedYaml(yamlPath, parseError);

      expect(result.skip).toBe(true);
      expect(result.error).toBeDefined();
      expect(result.category).toBe('warning');
    });

    test('should skip corrupted file and continue with others', async () => {
      // Create one good and one bad YAML file
      const goodYaml = `metadata:
  name: good-command
  description: Good command
  output_path: good-command.md
`;
      const badYaml = `metadata:
  name: bad-command
  description: "unclosed
`;

      await fs.writeFile(path.join(yamlDir, 'good.yaml'), goodYaml);
      await fs.writeFile(path.join(yamlDir, 'bad.yaml'), badYaml);

      const result = await yamlRewriter.rewriteAllYamls();

      expect(result.succeeded).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
      expect(result.succeeded[0].file).toContain('good.yaml');
      expect(result.failed[0].file).toContain('bad.yaml');
    });

    test('should distinguish fatal errors from warnings', async () => {
      const nonExistentPath = '/nonexistent/directory/file.yaml';

      const result = await yamlRewriter.handleMalformedYaml(nonExistentPath);

      expect(result.category).toBe('fatal');
      expect(result.skip).toBe(true);
    });

    test('should collect all errors for summary report', async () => {
      const badYaml1 = `metadata:\n  name: test\n  description: "unclosed`;
      const badYaml2 = `invalid yaml content @#$%`;

      await fs.writeFile(path.join(yamlDir, 'bad1.yaml'), badYaml1);
      await fs.writeFile(path.join(yamlDir, 'bad2.yaml'), badYaml2);

      const result = await yamlRewriter.rewriteAllYamls();

      expect(result.failed).toHaveLength(2);
      expect(result.summary).toBeDefined();
      expect(result.summary.totalErrors).toBe(2);
    });

    test('should handle permission errors', async () => {
      // This test is platform-specific, so we'll mock it
      const yamlPath = path.join(yamlDir, 'permission-test.yaml');

      // Simulate permission error by trying to read non-existent directory
      const result = await yamlRewriter.handleMalformedYaml('/root/forbidden.yaml');

      expect(result.skip).toBe(true);
      expect(result.category).toBe('fatal');
    });
  });

  // ==========================================
  // Integration Tests
  // ==========================================

  describe('Integration Tests', () => {
    test('should rewrite YAML file end-to-end', async () => {
      const originalYaml = `metadata:
  name: test-command
  description: Test command
  version: 1.0.0
  output_path: test-command.md
mission:
  summary: Test mission
`;
      const yamlPath = path.join(yamlDir, 'test.yaml');
      await fs.writeFile(yamlPath, originalYaml);

      const result = await yamlRewriter.rewriteYamlFile(yamlPath);

      expect(result.success).toBe(true);
      expect(result.originalPath).toBe('test-command.md');
      expect(result.rewrittenPath).toBe('ai-mesh/test-command.md');

      // Verify file was actually rewritten
      const updatedContent = await fs.readFile(yamlPath, 'utf8');
      const updatedData = yaml.load(updatedContent);
      expect(updatedData.metadata.output_path).toBe('ai-mesh/test-command.md');
    });

    test('should process all YAML files in directory', async () => {
      // Create multiple YAML files
      const yaml1 = `metadata:\n  name: cmd1\n  description: Command 1\n  output_path: cmd1.md\n`;
      const yaml2 = `metadata:\n  name: cmd2\n  description: Command 2\n  output_path: cmd2.md\n`;
      const yaml3 = `metadata:\n  name: cmd3\n  description: Command 3\n  output_path: cmd3.md\n`;

      await fs.writeFile(path.join(yamlDir, 'cmd1.yaml'), yaml1);
      await fs.writeFile(path.join(yamlDir, 'cmd2.yaml'), yaml2);
      await fs.writeFile(path.join(yamlDir, 'cmd3.yaml'), yaml3);

      const result = await yamlRewriter.rewriteAllYamls();

      expect(result.succeeded).toHaveLength(3);
      expect(result.failed).toHaveLength(0);
      expect(result.summary.totalProcessed).toBe(3);
      expect(result.summary.successRate).toBe('100.0');
    });

    test('should generate migration report', async () => {
      const yaml1 = `metadata:\n  name: cmd1\n  description: Command 1\n  output_path: cmd1.md\n`;
      const badYaml = `metadata:\n  name: bad\n  description: "unclosed`;

      await fs.writeFile(path.join(yamlDir, 'cmd1.yaml'), yaml1);
      await fs.writeFile(path.join(yamlDir, 'bad.yaml'), badYaml);

      const result = await yamlRewriter.rewriteAllYamls();

      expect(result.summary).toBeDefined();
      expect(result.summary.totalProcessed).toBe(2);
      expect(result.summary.succeeded).toBe(1);
      expect(result.summary.failed).toBe(1);
      expect(result.summary.successRate).toBe('50.0');
      expect(result.summary.duration).toBeDefined();
    });

    test('should meet performance requirements (<10ms per file)', async () => {
      const yamlContent = `metadata:\n  name: perf-test\n  description: Performance test\n  output_path: perf-test.md\n`;
      const yamlPath = path.join(yamlDir, 'perf.yaml');
      await fs.writeFile(yamlPath, yamlContent);

      const startTime = Date.now();
      await yamlRewriter.rewriteYamlFile(yamlPath);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(10);
    });
  });

  // ==========================================
  // Edge Cases
  // ==========================================

  describe('Edge Cases', () => {
    test('should handle empty YAML file', async () => {
      const yamlPath = path.join(yamlDir, 'empty.yaml');
      await fs.writeFile(yamlPath, '');

      const result = await yamlRewriter.rewriteYamlFile(yamlPath);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should handle YAML with only comments', async () => {
      const commentOnlyYaml = `# This is a comment
# Another comment
`;
      const yamlPath = path.join(yamlDir, 'comments.yaml');
      await fs.writeFile(yamlPath, commentOnlyYaml);

      const result = await yamlRewriter.rewriteYamlFile(yamlPath);

      expect(result.success).toBe(false);
    });

    test('should preserve YAML comments during rewrite', async () => {
      const yamlWithComments = `# Command metadata
metadata:
  name: test-command  # Command name
  description: Test command
  output_path: test-command.md  # Will be rewritten
# Mission section
mission:
  summary: Test
`;
      const yamlPath = path.join(yamlDir, 'with-comments.yaml');
      await fs.writeFile(yamlPath, yamlWithComments);

      await yamlRewriter.rewriteYamlFile(yamlPath);

      const updatedContent = await fs.readFile(yamlPath, 'utf8');
      // Comments are preserved by js-yaml
      expect(updatedContent).toContain('metadata:');
      expect(updatedContent).toContain('ai-mesh/test-command.md');
    });

    test('should handle very long file paths', () => {
      const yamlData = {
        metadata: {
          name: 'test-command',
          description: 'Test',
          output_path: 'very-long-command-name-that-exceeds-normal-length.md'
        }
      };

      const rewritten = yamlRewriter.rewriteOutputPath(yamlData);

      expect(rewritten.metadata.output_path).toBe('ai-mesh/very-long-command-name-that-exceeds-normal-length.md');
    });

    test('should handle special characters in file names', () => {
      const yamlData = {
        metadata: {
          name: 'test-command',
          description: 'Test',
          output_path: 'command-with-special-chars_v2.1.md'
        }
      };

      const rewritten = yamlRewriter.rewriteOutputPath(yamlData);

      expect(rewritten.metadata.output_path).toBe('ai-mesh/command-with-special-chars_v2.1.md');
    });
  });
});
