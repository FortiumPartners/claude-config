/**
 * @fileoverview Tests for OutputFormatter class
 * @module tests/changelog/formatter
 */

const { OutputFormatter } = require('../../changelog/formatter');

describe('OutputFormatter', () => {
  let formatter;
  let mockChangelog;

  beforeEach(() => {
    formatter = new OutputFormatter();
    mockChangelog = {
      version: '3.5.0',
      releaseDate: '2025-10-15',
      features: [
        {
          id: 'feature-1',
          title: 'Extended Context Window',
          category: 'new',
          impact: 'high',
          description: 'Support for up to 200K tokens in API requests',
          migrationGuidance: null,
          confidence: 0.95
        },
        {
          id: 'feature-2',
          title: 'Remove Legacy Auth',
          category: 'breaking',
          impact: 'high',
          description: 'Deprecated auth methods removed',
          migrationGuidance: 'Use OAuth 2.0 flow',
          confidence: 0.90
        },
        {
          id: 'feature-3',
          title: 'Faster Response Times',
          category: 'performance',
          impact: 'medium',
          description: '30% reduction in latency',
          migrationGuidance: null,
          confidence: 0.85
        },
        {
          id: 'feature-4',
          title: 'Security Patch',
          category: 'security',
          impact: 'high',
          description: 'Fixed XSS vulnerability in API',
          migrationGuidance: null,
          confidence: 0.92
        },
        {
          id: 'feature-5',
          title: 'Bug Fix',
          category: 'bugfix',
          impact: 'low',
          description: 'Fixed incorrect token count',
          migrationGuidance: null,
          confidence: 0.88
        }
      ],
      metadata: {
        cachedAt: '2025-11-03T10:00:00Z',
        source: 'https://docs.anthropic.com/en/release-notes/',
        parsingConfidence: 0.95
      }
    };
  });

  describe('Constructor', () => {
    test('should initialize with default options', () => {
      expect(formatter).toBeInstanceOf(OutputFormatter);
      expect(formatter.outputFormat).toBe('console');
    });

    test('should accept custom format option', () => {
      const jsonFormatter = new OutputFormatter({ format: 'json' });
      expect(jsonFormatter.outputFormat).toBe('json');
    });

    test('should accept colors option', () => {
      const noColorFormatter = new OutputFormatter({ colors: false });
      expect(noColorFormatter.colors).toBe(false);
    });
  });

  describe('format() - Console Output', () => {
    test('should format changelog with console output', () => {
      const output = formatter.format(mockChangelog);

      expect(output).toContain('Claude 3.5.0');
      expect(output).toContain('October 15, 2025');
      expect(output).toContain('Extended Context Window');
      expect(output).toContain('Remove Legacy Auth');
    });

    test('should include Unicode symbols for categories', () => {
      const output = formatter.format(mockChangelog);

      // Check for category symbols
      expect(output).toMatch(/[🔴✨⚡🔒⚠️🐛]/);
    });

    test('should display summary statistics', () => {
      const output = formatter.format(mockChangelog);

      expect(output).toContain('Summary');
      expect(output).toContain('Total Changes: 5');
      expect(output).toContain('Breaking: 1');
      expect(output).toContain('New Features: 1');
    });

    test('should highlight high-impact features', () => {
      const output = formatter.format(mockChangelog);

      // High impact features should be prominent
      const lines = output.split('\n');
      const highImpactLines = lines.filter(line =>
        line.includes('Extended Context Window') ||
        line.includes('Remove Legacy Auth') ||
        line.includes('Security Patch')
      );

      expect(highImpactLines.length).toBeGreaterThan(0);
    });

    test('should display migration guidance for breaking changes', () => {
      const output = formatter.format(mockChangelog);

      expect(output).toContain('Use OAuth 2.0 flow');
      expect(output).toContain('Migration');
    });

    test('should handle empty feature list', () => {
      const emptyChangelog = {
        version: '3.5.0',
        releaseDate: '2025-10-15',
        features: [],
        metadata: mockChangelog.metadata
      };

      const output = formatter.format(emptyChangelog);

      expect(output).toContain('No features found');
    });

    test('should format output in under 100ms for typical changelog', () => {
      const start = Date.now();
      formatter.format(mockChangelog);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
    });
  });

  describe('format() - JSON Output', () => {
    beforeEach(() => {
      formatter = new OutputFormatter({ format: 'json' });
    });

    test('should format changelog as valid JSON', () => {
      const output = formatter.format(mockChangelog);

      expect(() => JSON.parse(output)).not.toThrow();
    });

    test('should include all changelog data in JSON', () => {
      const output = formatter.format(mockChangelog);
      const parsed = JSON.parse(output);

      expect(parsed.version).toBe('3.5.0');
      expect(parsed.releaseDate).toBe('2025-10-15');
      expect(parsed.features).toHaveLength(5);
      expect(parsed.metadata).toBeDefined();
    });

    test('should pretty-print JSON with 2-space indentation', () => {
      const output = formatter.format(mockChangelog);

      // Check for proper indentation
      expect(output).toContain('  "version"');
      expect(output).toContain('    "id"');
    });
  });

  describe('format() - Markdown Output', () => {
    beforeEach(() => {
      formatter = new OutputFormatter({ format: 'markdown' });
    });

    test('should format changelog as Markdown', () => {
      const output = formatter.format(mockChangelog);

      expect(output).toContain('# Claude 3.5.0');
      expect(output).toContain('**Released:** October 15, 2025');
      expect(output).toContain('## 🔴 Breaking Changes');
      expect(output).toContain('## ✨ New Features');
    });

    test('should create Markdown lists for features', () => {
      const output = formatter.format(mockChangelog);

      expect(output).toMatch(/^- \*\*/m); // List items start with "- **"
    });

    test('should include migration guidance in Markdown', () => {
      const output = formatter.format(mockChangelog);

      expect(output).toContain('> **Migration:**');
      expect(output).toContain('Use OAuth 2.0 flow');
    });
  });

  describe('formatSummary()', () => {
    test('should calculate category counts', () => {
      const summary = formatter.formatSummary(mockChangelog);

      expect(summary).toContain('Total Changes: 5');
      expect(summary).toContain('Breaking: 1');
      expect(summary).toContain('New Features: 1');
      expect(summary).toContain('Performance: 1');
      expect(summary).toContain('Security: 1');
      expect(summary).toContain('Bug Fixes: 1');
    });

    test('should show high-impact count', () => {
      const summary = formatter.formatSummary(mockChangelog);

      expect(summary).toContain('High Impact: 3');
    });

    test('should handle zero counts gracefully', () => {
      const minimalChangelog = {
        ...mockChangelog,
        features: [mockChangelog.features[0]] // Only one feature
      };

      const summary = formatter.formatSummary(minimalChangelog);

      expect(summary).toContain('Total Changes: 1');
      expect(summary).not.toContain('Breaking: 0'); // Don't show zero counts
    });
  });

  describe('getCategorySymbol()', () => {
    test('should return correct symbols for all categories', () => {
      expect(formatter.getCategorySymbol('breaking')).toBe('🔴');
      expect(formatter.getCategorySymbol('new')).toBe('✨');
      expect(formatter.getCategorySymbol('performance')).toBe('⚡');
      expect(formatter.getCategorySymbol('security')).toBe('🔒');
      expect(formatter.getCategorySymbol('deprecation')).toBe('⚠️');
      expect(formatter.getCategorySymbol('bugfix')).toBe('🐛');
      expect(formatter.getCategorySymbol('enhancement')).toBe('🔧');
    });

    test('should return default symbol for unknown category', () => {
      expect(formatter.getCategorySymbol('unknown')).toBe('📝');
    });
  });

  describe('formatDate()', () => {
    test('should format ISO date to human-readable format', () => {
      const formatted = formatter.formatDate('2025-10-15');
      expect(formatted).toBe('October 15, 2025');
    });

    test('should handle various date formats', () => {
      expect(formatter.formatDate('2025-10-15T00:00:00Z')).toContain('October 15, 2025');
      expect(formatter.formatDate('2025-01-01')).toBe('January 1, 2025');
    });

    test('should return original string if parsing fails', () => {
      expect(formatter.formatDate('invalid-date')).toBe('invalid-date');
    });
  });

  describe('Edge Cases', () => {
    test('should handle changelog without metadata', () => {
      const noMetadata = { ...mockChangelog };
      delete noMetadata.metadata;

      const output = formatter.format(noMetadata);
      expect(output).toContain('Claude 3.5.0');
    });

    test('should handle features without descriptions', () => {
      const noDesc = {
        ...mockChangelog,
        features: [{
          id: 'feature-1',
          title: 'Test Feature',
          category: 'new',
          impact: 'medium'
        }]
      };

      const output = formatter.format(noDesc);
      expect(output).toContain('Test Feature');
    });

    test('should handle very long feature titles', () => {
      const longTitle = {
        ...mockChangelog,
        features: [{
          id: 'feature-1',
          title: 'A'.repeat(200),
          category: 'new',
          impact: 'medium',
          description: 'Test'
        }]
      };

      const output = formatter.format(longTitle);
      expect(output.length).toBeGreaterThan(0);
    });
  });
});
