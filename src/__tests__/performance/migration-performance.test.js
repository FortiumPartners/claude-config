/**
 * Migration Performance Test Suite
 * Validates that command migration meets <100ms performance requirement
 *
 * Requirements:
 * - 12 standard commands: <100ms total migration time
 * - 100+ commands: <1000ms total migration time
 * - Memory usage: <32MB during migration
 */

const path = require('path');
const fs = require('fs').promises;
const { performance } = require('perf_hooks');

// Mock CommandMigrator (will be replaced with actual implementation in Sprint 2)
class CommandMigrator {
  constructor(baseDir) {
    this.baseDir = baseDir;
  }

  async migrateCommands(dryRun = false) {
    const startTime = performance.now();

    // Simulate migration work
    const files = await this.scanExistingCommands();
    const results = {
      migrated: [],
      skipped: [],
      errors: []
    };

    for (const file of files) {
      if (await this.shouldMigrate(file)) {
        if (!dryRun) {
          await this.migrateFile(file);
        }
        results.migrated.push(file);
      } else {
        results.skipped.push(file);
      }
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    return {
      ...results,
      duration,
      fileCount: files.length
    };
  }

  async scanExistingCommands() {
    try {
      const files = await fs.readdir(this.baseDir);
      return files.filter(f => f.endsWith('.md'));
    } catch (error) {
      return [];
    }
  }

  async shouldMigrate(file) {
    try {
      const content = await fs.readFile(path.join(this.baseDir, file), 'utf-8');
      return content.includes('@ai-mesh-command') && content.includes('Source: fortium');
    } catch (error) {
      return false;
    }
  }

  async migrateFile(file) {
    // Simulate file operations
    await new Promise(resolve => setImmediate(resolve));
  }
}

describe('Migration Performance Tests', () => {
  let testFixturesDir;
  let migrator;

  beforeEach(() => {
    testFixturesDir = path.join(__dirname, '../fixtures/commands');
    migrator = new CommandMigrator(testFixturesDir);
  });

  describe('Standard Load (12 Commands)', () => {
    test('should complete migration in <100ms', async () => {
      const startMemory = process.memoryUsage().heapUsed;
      const startTime = performance.now();

      const result = await migrator.migrateCommands(true); // dry run

      const endTime = performance.now();
      const endMemory = process.memoryUsage().heapUsed;
      const duration = endTime - startTime;
      const memoryUsed = (endMemory - startMemory) / 1024 / 1024; // MB

      console.log(`
Performance Metrics:
-------------------
Duration: ${duration.toFixed(2)}ms
File Count: ${result.fileCount}
Memory Used: ${memoryUsed.toFixed(2)}MB
Migrated: ${result.migrated.length}
Skipped: ${result.skipped.length}
      `);

      // Performance assertions
      expect(duration).toBeLessThan(100);
      expect(memoryUsed).toBeLessThan(32);
    }, 10000); // 10s timeout for safety

    test('should maintain consistent performance across multiple runs', async () => {
      const runs = 5;
      const durations = [];

      for (let i = 0; i < runs; i++) {
        const startTime = performance.now();
        await migrator.migrateCommands(true);
        const duration = performance.now() - startTime;
        durations.push(duration);
      }

      const avgDuration = durations.reduce((a, b) => a + b, 0) / runs;
      const maxDuration = Math.max(...durations);
      const minDuration = Math.min(...durations);
      const variance = maxDuration - minDuration;

      console.log(`
Consistency Metrics (${runs} runs):
-----------------------------------
Average: ${avgDuration.toFixed(2)}ms
Min: ${minDuration.toFixed(2)}ms
Max: ${maxDuration.toFixed(2)}ms
Variance: ${variance.toFixed(2)}ms
      `);

      // Consistency assertions
      expect(avgDuration).toBeLessThan(100);
      expect(variance).toBeLessThan(50); // Low variance indicates consistency
    }, 30000);
  });

  describe('High Load (100+ Commands)', () => {
    test('should handle 100+ commands in <1000ms', async () => {
      // Create temporary directory with 100+ mock files
      const tempDir = path.join(__dirname, '../fixtures/temp-large-scale');
      await fs.mkdir(tempDir, { recursive: true });

      try {
        // Generate 120 mock command files
        const mockCommands = Array.from({ length: 120 }, (_, i) => ({
          name: `test-command-${i}.md`,
          content: `# @ai-mesh-command
# Command: test-command-${i}
# Version: 1.0.0
# Category: testing
# Source: ${i % 10 === 0 ? 'third-party' : 'fortium'}
# Maintainer: Test Team
# Last Updated: 2025-10-29

---
name: test-command-${i}
description: Generated test command ${i}
---

## Mission
Performance testing command ${i}
`
        }));

        // Write all mock files
        await Promise.all(
          mockCommands.map(cmd =>
            fs.writeFile(path.join(tempDir, cmd.name), cmd.content)
          )
        );

        // Test migration performance
        const largeMigrator = new CommandMigrator(tempDir);
        const startTime = performance.now();
        const result = await largeMigrator.migrateCommands(true);
        const duration = performance.now() - startTime;

        console.log(`
High Load Performance:
---------------------
Duration: ${duration.toFixed(2)}ms
File Count: ${result.fileCount}
Migrated: ${result.migrated.length}
Skipped: ${result.skipped.length}
        `);

        // High load assertions
        expect(duration).toBeLessThan(1000);
        expect(result.fileCount).toBeGreaterThanOrEqual(120);
      } finally {
        // Cleanup
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    }, 60000); // 60s timeout for large scale test
  });

  describe('Memory Efficiency', () => {
    test('should not leak memory during migration', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Run migration 10 times
      for (let i = 0; i < 10; i++) {
        await migrator.migrateCommands(true);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = (finalMemory - initialMemory) / 1024 / 1024; // MB

      console.log(`
Memory Analysis:
---------------
Initial: ${(initialMemory / 1024 / 1024).toFixed(2)}MB
Final: ${(finalMemory / 1024 / 1024).toFixed(2)}MB
Growth: ${memoryGrowth.toFixed(2)}MB
      `);

      // Memory leak assertion (allow 10MB growth for normal operations)
      expect(memoryGrowth).toBeLessThan(10);
    }, 30000);
  });

  describe('Concurrency Handling', () => {
    test('should handle concurrent migration attempts safely', async () => {
      const concurrentRuns = 5;
      const startTime = performance.now();

      // Run migrations concurrently
      const results = await Promise.all(
        Array.from({ length: concurrentRuns }, () =>
          migrator.migrateCommands(true)
        )
      );

      const duration = performance.now() - startTime;

      console.log(`
Concurrency Metrics:
-------------------
Concurrent Runs: ${concurrentRuns}
Total Duration: ${duration.toFixed(2)}ms
Average per Run: ${(duration / concurrentRuns).toFixed(2)}ms
      `);

      // Verify all runs completed successfully
      results.forEach(result => {
        expect(result.duration).toBeDefined();
        expect(result.fileCount).toBeGreaterThan(0);
      });

      // Concurrent operations should be fast
      expect(duration).toBeLessThan(500);
    }, 30000);
  });

  describe('Edge Cases', () => {
    test('should handle empty directory quickly', async () => {
      const emptyDir = path.join(__dirname, '../fixtures/temp-empty');
      await fs.mkdir(emptyDir, { recursive: true });

      try {
        const emptyMigrator = new CommandMigrator(emptyDir);
        const startTime = performance.now();
        const result = await emptyMigrator.migrateCommands(true);
        const duration = performance.now() - startTime;

        console.log(`Empty directory migration: ${duration.toFixed(2)}ms`);

        expect(duration).toBeLessThan(10); // Should be very fast
        expect(result.fileCount).toBe(0);
      } finally {
        await fs.rm(emptyDir, { recursive: true, force: true });
      }
    });

    test('should handle non-existent directory gracefully', async () => {
      const nonExistentMigrator = new CommandMigrator('/path/that/does/not/exist');
      const startTime = performance.now();

      let errorOccurred = false;
      try {
        await nonExistentMigrator.migrateCommands(true);
      } catch (error) {
        errorOccurred = true;
      }

      const duration = performance.now() - startTime;

      console.log(`Non-existent directory handling: ${duration.toFixed(2)}ms`);

      expect(duration).toBeLessThan(100);
      // Should either handle gracefully or fail fast
    });
  });
});

// Export for CI/CD reporting
module.exports = {
  CommandMigrator
};
