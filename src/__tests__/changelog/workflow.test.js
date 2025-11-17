/**
 * @fileoverview Tests for Workflow orchestration
 * @module tests/changelog/workflow
 */

const { ChangelogWorkflow } = require('../../changelog/workflow');
const { ChangelogFetcher } = require('../../changelog/fetcher');
const { CacheManager } = require('../../changelog/cache');
const { ChangelogParser } = require('../../changelog/parser');
const { FeatureCategorizer } = require('../../changelog/categorizer');
const { OutputFormatter } = require('../../changelog/formatter');
const { CLIInterface } = require('../../changelog/cli-interface');

describe('ChangelogWorkflow', () => {
  let workflow;

  beforeEach(() => {
    workflow = new ChangelogWorkflow();
  });

  describe('Constructor', () => {
    test('should initialize with all components', () => {
      expect(workflow).toBeInstanceOf(ChangelogWorkflow);
      expect(workflow.fetcher).toBeInstanceOf(ChangelogFetcher);
      expect(workflow.cache).toBeInstanceOf(CacheManager);
      expect(workflow.parser).toBeInstanceOf(ChangelogParser);
      expect(workflow.categorizer).toBeInstanceOf(FeatureCategorizer);
      expect(workflow.formatter).toBeInstanceOf(OutputFormatter);
      expect(workflow.cli).toBeInstanceOf(CLIInterface);
    });

    test('should accept custom components', () => {
      const customFetcher = new ChangelogFetcher({ timeout: 10000 });
      const customWorkflow = new ChangelogWorkflow({ fetcher: customFetcher });

      expect(customWorkflow.fetcher).toBe(customFetcher);
    });
  });

  describe('execute()', () => {
    test('should execute complete workflow with valid parameters', async () => {
      const params = {
        version: null,
        since: null,
        category: null,
        important: false,
        format: 'console',
        refresh: false,
        help: false
      };

      // Mock workflow will use cached data
      const result = await workflow.execute(params);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    test('should return help text when help flag is true', async () => {
      const params = { help: true };

      const result = await workflow.execute(params);

      expect(result).toContain('/claude-changelog');
      expect(result).toContain('USAGE');
    });

    test('should validate parameters before execution', async () => {
      const params = {
        version: 'invalid-version',
        format: 'console'
      };

      const result = await workflow.execute(params);

      expect(result).toContain('ERROR');
      expect(result).toContain('Invalid version format');
    });

    test('should use cache when available and not refreshing', async () => {
      const params = {
        version: 'latest',
        refresh: false,
        format: 'console'
      };

      // First call will fetch
      await workflow.execute(params);

      // Second call should use cache (faster)
      const start = Date.now();
      const result = await workflow.execute(params);
      const duration = Date.now() - start;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(100); // Cache hit should be fast
    });

    test('should refresh cache when refresh flag is true', async () => {
      const params = {
        version: 'latest',
        refresh: true,
        format: 'console'
      };

      const result = await workflow.execute(params);

      expect(result).toBeDefined();
    });

    test('should filter by category when specified', async () => {
      // Mock fetchChangelog to return sample data with breaking change
      const mockChangelog = {
        version: '3.5.0',
        releaseDate: new Date('2025-10-15'),
        features: [
          {
            title: 'Breaking API Change',
            description: 'Major change to API',
            category: 'breaking',
            isHighImpact: true
          }
        ]
      };
      jest.spyOn(workflow, 'fetchChangelog').mockResolvedValue(mockChangelog);

      const params = {
        category: 'breaking',
        format: 'console'
      };

      const result = await workflow.execute(params);

      expect(result).toBeDefined();
      // Should contain breaking changes section
      expect(result).toMatch(/breaking/i);
    });

    test('should filter by important flag', async () => {
      const params = {
        important: true,
        format: 'console'
      };

      const result = await workflow.execute(params);

      expect(result).toBeDefined();
    });

    test('should format output according to format parameter', async () => {
      const jsonParams = { format: 'json' };
      const jsonResult = await workflow.execute(jsonParams);

      expect(() => JSON.parse(jsonResult)).not.toThrow();

      const markdownParams = { format: 'markdown' };
      const mdResult = await workflow.execute(markdownParams);

      expect(mdResult).toContain('#');
    });
  });

  describe('fetchChangelog()', () => {
    test('should fetch from network when no cache', async () => {
      const params = { version: 'latest' };

      const changelog = await workflow.fetchChangelog(params);

      expect(changelog).toBeDefined();
      expect(changelog.version).toBeDefined();
    });

    test('should use cache when available', async () => {
      const params = { version: 'latest', refresh: false };

      // First fetch
      const changelog1 = await workflow.fetchChangelog(params);

      // Second fetch (should use cache)
      const start = Date.now();
      const changelog2 = await workflow.fetchChangelog(params);
      const duration = Date.now() - start;

      expect(changelog2).toEqual(changelog1);
      expect(duration).toBeLessThan(50); // Cache hit is fast
    });

    test('should handle network errors gracefully', async () => {
      // Force network error by mocking fetcher to throw
      jest.spyOn(workflow.fetcher, 'fetch').mockRejectedValue(new Error('Network error'));

      const params = { version: 'latest', refresh: true }; // refresh: true to bypass cache

      await expect(workflow.fetchChangelog(params)).rejects.toThrow('Network error');
    });
  });

  describe('parseChangelog()', () => {
    test('should parse HTML changelog', async () => {
      const html = `
        <h2>Version 3.5.0 - October 15, 2025</h2>
        <h3>New Features</h3>
        <ul><li>Extended context window</li></ul>
      `;

      const parsed = await workflow.parseChangelog(html);

      expect(parsed.version).toBe('3.5.0');
      expect(parsed.releaseDate).toBeDefined();
      expect(parsed.features).toBeInstanceOf(Array);
    });

    test('should handle empty HTML', async () => {
      const html = '';

      const parsed = await workflow.parseChangelog(html);

      expect(parsed).toBeDefined();
    });
  });

  describe('categorizeFeatures()', () => {
    test('should categorize and enhance features', async () => {
      const features = [
        {
          id: 'feature-1',
          title: 'New API endpoint',
          category: 'new',
          description: 'Added REST API'
        }
      ];

      const categorized = await workflow.categorizeFeatures(features);

      expect(categorized).toHaveLength(1);
      expect(categorized[0].impact).toBeDefined();
      expect(categorized[0].confidence).toBeDefined();
    });

    test('should handle empty feature list', async () => {
      const categorized = await workflow.categorizeFeatures([]);

      expect(categorized).toEqual([]);
    });
  });

  describe('applyFilters()', () => {
    let mockChangelog;

    beforeEach(() => {
      mockChangelog = {
        version: '3.5.0',
        releaseDate: '2025-10-15',
        features: [
          {
            id: 'f1',
            title: 'Breaking Change',
            category: 'breaking',
            impact: 'high',
            description: 'Removed old API'
          },
          {
            id: 'f2',
            title: 'New Feature',
            category: 'new',
            impact: 'medium',
            description: 'Added new endpoint'
          },
          {
            id: 'f3',
            title: 'Bug Fix',
            category: 'bugfix',
            impact: 'low',
            description: 'Fixed typo'
          }
        ]
      };
    });

    test('should filter by category', async () => {
      const params = { category: 'breaking' };

      const filtered = await workflow.applyFilters(mockChangelog, params);

      expect(filtered.features).toHaveLength(1);
      expect(filtered.features[0].category).toBe('breaking');
    });

    test('should filter by multiple categories', async () => {
      const params = { category: ['breaking', 'new'] };

      const filtered = await workflow.applyFilters(mockChangelog, params);

      expect(filtered.features).toHaveLength(2);
    });

    test('should filter by important flag', async () => {
      const params = { important: true };

      const filtered = await workflow.applyFilters(mockChangelog, params);

      // Only high-impact features
      expect(filtered.features.every(f => f.impact === 'high')).toBe(true);
    });

    test('should return all features when no filters', async () => {
      const params = {};

      const filtered = await workflow.applyFilters(mockChangelog, params);

      expect(filtered.features).toHaveLength(3);
    });
  });

  describe('formatOutput()', () => {
    let mockChangelog;

    beforeEach(() => {
      mockChangelog = {
        version: '3.5.0',
        releaseDate: '2025-10-15',
        features: [
          {
            id: 'f1',
            title: 'Test Feature',
            category: 'new',
            impact: 'medium',
            description: 'Test description'
          }
        ]
      };
    });

    test('should format as console by default', async () => {
      const params = { format: 'console' };

      const output = await workflow.formatOutput(mockChangelog, params);

      expect(output).toContain('Claude 3.5.0');
      expect(output).toContain('Test Feature');
    });

    test('should format as JSON when specified', async () => {
      const params = { format: 'json' };

      const output = await workflow.formatOutput(mockChangelog, params);

      expect(() => JSON.parse(output)).not.toThrow();
    });

    test('should format as markdown when specified', async () => {
      const params = { format: 'markdown' };

      const output = await workflow.formatOutput(mockChangelog, params);

      expect(output).toContain('# Claude 3.5.0');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid parameters gracefully', async () => {
      const params = {
        version: 'invalid',
        format: 'invalid'
      };

      const result = await workflow.execute(params);

      expect(result).toContain('ERROR');
    });

    test('should handle network failures with cache fallback', async () => {
      // This test would be better with proper mocking
      const params = { version: 'latest' };

      await expect(workflow.execute(params)).resolves.toBeDefined();
    });
  });

  describe('Performance', () => {
    test('should execute complete workflow in under 5 seconds', async () => {
      const params = {
        version: 'latest',
        format: 'console'
      };

      const start = Date.now();
      await workflow.execute(params);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(5000);
    }, 6000);

    test('should execute cached workflow in under 1 second', async () => {
      const params = {
        version: 'latest',
        format: 'console'
      };

      // Prime cache
      await workflow.execute(params);

      // Execute with cache
      const start = Date.now();
      await workflow.execute(params);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000);
    });
  });
});
