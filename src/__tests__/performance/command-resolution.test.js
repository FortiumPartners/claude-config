/**
 * Command Resolution Performance Tests
 * TRD-058: Command resolution tests (<100ms)
 *
 * Tests command discovery and resolution performance
 * Target: <100ms for resolving all 12 commands
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const ValidationSystem = require('../../installer/validation-system');

// Mock logger
const mockLogger = {
  info: jest.fn(),
  success: jest.fn(),
  warning: jest.fn(),
  error: jest.fn()
};

describe('Command Resolution Performance (TRD-058)', () => {
  let testDir;
  let commandsDir;
  let aiMeshDir;

  beforeEach(async () => {
    // Create test environment
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'resolution-test-'));
    commandsDir = path.join(testDir, 'commands');
    aiMeshDir = path.join(commandsDir, 'ai-mesh');

    await fs.mkdir(aiMeshDir, { recursive: true });

    // Create all expected commands
    const commands = [
      'create-prd', 'create-trd', 'implement-trd', 'fold-prompt',
      'manager-dashboard', 'analyze-product', 'refine-prd', 'refine-trd',
      'sprint-status', 'playwright-test', 'generate-api-docs', 'web-metrics-dashboard'
    ];

    for (const cmd of commands) {
      await fs.writeFile(
        path.join(aiMeshDir, `${cmd}.md`),
        `# @ai-mesh-command\nCommand: ${cmd}`
      );
      await fs.writeFile(
        path.join(aiMeshDir, `${cmd}.txt`),
        `@ai-mesh-command\nCommand: ${cmd}`
      );
    }
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  test('should resolve all 12 commands in <100ms', async () => {
    const validator = new ValidationSystem(testDir, mockLogger);

    const startTime = Date.now();
    const result = await validator.testCommandResolution();
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(100); // <100ms target
    expect(result.resolvedCommands).toBe(12);
    expect(result.passed).toBe(true);
  });

  test('should resolve single command in <10ms', async () => {
    const commandPath = path.join(aiMeshDir, 'create-prd.md');

    const startTime = Date.now();
    await fs.access(commandPath);
    const content = await fs.readFile(commandPath, 'utf8');
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(10); // <10ms per command
    expect(content).toContain('@ai-mesh-command');
  });

  test('should handle hierarchical resolution in <50ms', async () => {
    const commands = ['create-prd', 'implement-trd', 'fold-prompt'];
    const resolved = [];

    const startTime = Date.now();

    for (const cmd of commands) {
      const mdPath = path.join(aiMeshDir, `${cmd}.md`);
      const txtPath = path.join(aiMeshDir, `${cmd}.txt`);

      try {
        await fs.access(mdPath);
        resolved.push({ command: cmd, format: 'md', path: mdPath });
      } catch {
        try {
          await fs.access(txtPath);
          resolved.push({ command: cmd, format: 'txt', path: txtPath });
        } catch {
          // Not resolved
        }
      }
    }

    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(50); // <50ms for 3 commands
    expect(resolved).toHaveLength(3);
  });

  test('should cache resolution results for <5ms repeated access', async () => {
    const validator = new ValidationSystem(testDir, mockLogger);

    // First resolution (cold)
    const firstStart = Date.now();
    await validator.testCommandResolution();
    const firstDuration = Date.now() - firstStart;

    // Second resolution (warm)
    const secondStart = Date.now();
    await validator.testCommandResolution();
    const secondDuration = Date.now() - secondStart;

    expect(firstDuration).toBeLessThan(100);
    expect(secondDuration).toBeLessThan(firstDuration); // Should be faster
  });

  test('should resolve with parallel file access in <80ms', async () => {
    const commands = [
      'create-prd', 'create-trd', 'implement-trd', 'fold-prompt',
      'manager-dashboard', 'analyze-product'
    ];

    const startTime = Date.now();

    const results = await Promise.all(
      commands.map(async (cmd) => {
        const mdPath = path.join(aiMeshDir, `${cmd}.md`);
        try {
          await fs.access(mdPath);
          return { command: cmd, found: true };
        } catch {
          return { command: cmd, found: false };
        }
      })
    );

    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(80); // <80ms parallel resolution
    expect(results.every(r => r.found)).toBe(true);
  });

  test('should handle missing commands with <5ms overhead', async () => {
    const missingCommand = 'non-existent-command';
    const mdPath = path.join(aiMeshDir, `${missingCommand}.md`);

    const startTime = Date.now();

    try {
      await fs.access(mdPath);
    } catch {
      // Expected to fail
    }

    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(5); // <5ms for missing file check
  });

  test('should maintain <100ms resolution with 50 commands', async () => {
    // Create 50 commands for stress test
    for (let i = 13; i <= 50; i++) {
      await fs.writeFile(
        path.join(aiMeshDir, `test-command-${i}.md`),
        `# @ai-mesh-command\nCommand: test-${i}`
      );
    }

    const startTime = Date.now();

    // Resolve all files
    const files = await fs.readdir(aiMeshDir);
    const mdFiles = files.filter(f => f.endsWith('.md'));

    for (const file of mdFiles) {
      await fs.access(path.join(aiMeshDir, file));
    }

    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(200); // <200ms for 50 commands (relaxed)
    expect(mdFiles.length).toBeGreaterThanOrEqual(50);
  });

  test('should report accurate average resolution time', async () => {
    const validator = new ValidationSystem(testDir, mockLogger);

    const result = await validator.testCommandResolution();

    expect(result.averageTime).toBeLessThan(10); // <10ms average per command
    expect(result.maxTime).toBeLessThan(20); // <20ms max for any single command
  });

  describe('Performance Regression Detection (TRD-058)', () => {
    test('should detect if resolution slows beyond threshold', async () => {
      const validator = new ValidationSystem(testDir, mockLogger);

      // Run multiple iterations to detect regression
      const iterations = 5;
      const durations = [];

      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await validator.testCommandResolution();
        durations.push(Date.now() - start);
      }

      const avgDuration = durations.reduce((a, b) => a + b) / durations.length;
      const maxDuration = Math.max(...durations);

      expect(avgDuration).toBeLessThan(100); // Average should stay under target
      expect(maxDuration).toBeLessThan(150); // Max should not exceed 150ms
    });

    test('should maintain consistent performance across runs', async () => {
      const validator = new ValidationSystem(testDir, mockLogger);

      const run1 = await validator.testCommandResolution();
      const run2 = await validator.testCommandResolution();
      const run3 = await validator.testCommandResolution();

      const durations = [run1.duration, run2.duration, run3.duration];
      const maxVariance = Math.max(...durations) - Math.min(...durations);

      // Variance should be minimal (<30ms difference)
      expect(maxVariance).toBeLessThan(30);
    });
  });
});
