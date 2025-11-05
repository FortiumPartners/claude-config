/**
 * @fileoverview Tests for CLIInterface class
 * @module tests/changelog/cli-interface
 */

const { CLIInterface } = require('../../changelog/cli-interface');

describe('CLIInterface', () => {
  let cli;

  beforeEach(() => {
    cli = new CLIInterface();
  });

  describe('Constructor', () => {
    test('should initialize with default options', () => {
      expect(cli).toBeInstanceOf(CLIInterface);
    });
  });

  describe('parseParameters()', () => {
    test('should parse empty parameters', () => {
      const params = cli.parseParameters([]);

      expect(params).toEqual({
        version: null,
        since: null,
        category: null,
        important: false,
        format: 'console',
        refresh: false,
        help: false
      });
    });

    test('should parse version parameter', () => {
      const params = cli.parseParameters(['--version', '3.5.0']);

      expect(params.version).toBe('3.5.0');
    });

    test('should parse version with short flag', () => {
      const params = cli.parseParameters(['-v', '3.5.0']);

      expect(params.version).toBe('3.5.0');
    });

    test('should parse since parameter with date', () => {
      const params = cli.parseParameters(['--since', '2025-10-01']);

      expect(params.since).toBe('2025-10-01');
    });

    test('should parse since parameter with relative time', () => {
      const params = cli.parseParameters(['--since', '7d']);

      expect(params.since).toBe('7d');
    });

    test('should parse category parameter', () => {
      const params = cli.parseParameters(['--category', 'breaking']);

      expect(params.category).toBe('breaking');
    });

    test('should parse multiple categories', () => {
      const params = cli.parseParameters(['--category', 'breaking,new']);

      expect(params.category).toEqual(['breaking', 'new']);
    });

    test('should parse important flag', () => {
      const params = cli.parseParameters(['--important']);

      expect(params.important).toBe(true);
    });

    test('should parse format parameter', () => {
      const params = cli.parseParameters(['--format', 'json']);

      expect(params.format).toBe('json');
    });

    test('should parse refresh flag', () => {
      const params = cli.parseParameters(['--refresh']);

      expect(params.refresh).toBe(true);
    });

    test('should parse help flag', () => {
      const params = cli.parseParameters(['--help']);

      expect(params.help).toBe(true);
    });

    test('should parse help short flag', () => {
      const params = cli.parseParameters(['-h']);

      expect(params.help).toBe(true);
    });

    test('should parse multiple parameters together', () => {
      const params = cli.parseParameters([
        '--version', '3.5.0',
        '--format', 'json',
        '--important',
        '--refresh'
      ]);

      expect(params).toMatchObject({
        version: '3.5.0',
        format: 'json',
        important: true,
        refresh: true
      });
    });

    test('should handle parameters in any order', () => {
      const params = cli.parseParameters([
        '--refresh',
        '--version', '3.5.0',
        '--important',
        '--format', 'markdown'
      ]);

      expect(params).toMatchObject({
        version: '3.5.0',
        format: 'markdown',
        important: true,
        refresh: true
      });
    });

    test('should handle unknown parameters gracefully', () => {
      const params = cli.parseParameters(['--unknown', 'value']);

      expect(params).toBeDefined();
    });
  });

  describe('validateParameters()', () => {
    test('should validate correct parameters', () => {
      const params = {
        version: '3.5.0',
        since: '2025-10-01',
        category: 'breaking',
        important: false,
        format: 'console',
        refresh: false,
        help: false
      };

      const result = cli.validateParameters(params);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject invalid version format', () => {
      const params = {
        version: 'invalid-version',
        format: 'console'
      };

      const result = cli.validateParameters(params);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid version format. Expected format: X.Y.Z');
    });

    test('should reject invalid date format', () => {
      const params = {
        since: 'invalid-date',
        format: 'console'
      };

      const result = cli.validateParameters(params);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should reject invalid category', () => {
      const params = {
        category: 'invalid-category',
        format: 'console'
      };

      const result = cli.validateParameters(params);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid category. Valid categories: breaking, new, enhancement, performance, security, deprecation, bugfix');
    });

    test('should reject invalid format', () => {
      const params = {
        format: 'invalid-format'
      };

      const result = cli.validateParameters(params);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid output format. Valid formats: console, json, markdown');
    });

    test('should allow valid relative time formats', () => {
      const validFormats = ['7d', '14d', '30d', '1w', '2w', '1m'];

      for (const since of validFormats) {
        const params = { since, format: 'console' };
        const result = cli.validateParameters(params);

        expect(result.valid).toBe(true);
      }
    });

    test('should allow valid date formats', () => {
      const validDates = ['2025-10-01', '2025-01-15', '2024-12-31'];

      for (const since of validDates) {
        const params = { since, format: 'console' };
        const result = cli.validateParameters(params);

        expect(result.valid).toBe(true);
      }
    });

    test('should collect multiple validation errors', () => {
      const params = {
        version: 'invalid',
        since: 'invalid',
        category: 'invalid',
        format: 'invalid'
      };

      const result = cli.validateParameters(params);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(2);
    });
  });

  describe('formatError()', () => {
    test('should format basic error message', () => {
      const error = 'Invalid version format';
      const formatted = cli.formatError(error);

      expect(formatted).toContain('ERROR:');
      expect(formatted).toContain('Invalid version format');
    });

    test('should include suggestion when provided', () => {
      const error = 'Invalid version format';
      const suggestion = 'Use format X.Y.Z (e.g., 3.5.0)';
      const formatted = cli.formatError(error, suggestion);

      expect(formatted).toContain('SUGGESTION:');
      expect(formatted).toContain(suggestion);
    });

    test('should format validation errors', () => {
      const errors = [
        'Invalid version format',
        'Invalid date format',
        'Invalid category'
      ];
      const formatted = cli.formatError(errors);

      expect(formatted).toContain('3 errors found');
      expect(formatted).toContain('Invalid version format');
      expect(formatted).toContain('Invalid date format');
      expect(formatted).toContain('Invalid category');
    });
  });

  describe('getHelpText()', () => {
    test('should return comprehensive help text', () => {
      const help = cli.getHelpText();

      expect(help).toContain('/claude-changelog');
      expect(help).toContain('USAGE');
      expect(help).toContain('OPTIONS');
      expect(help).toContain('EXAMPLES');
    });

    test('should include all parameters in help', () => {
      const help = cli.getHelpText();

      expect(help).toContain('--version');
      expect(help).toContain('--since');
      expect(help).toContain('--category');
      expect(help).toContain('--important');
      expect(help).toContain('--format');
      expect(help).toContain('--refresh');
      expect(help).toContain('--help');
    });

    test('should include usage examples', () => {
      const help = cli.getHelpText();

      expect(help).toContain('Get latest changelog');
      expect(help).toContain('Get specific version');
      expect(help).toContain('breaking changes');
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty parameter array', () => {
      expect(() => cli.parseParameters([])).not.toThrow();
    });

    test('should handle null parameters', () => {
      const params = cli.parseParameters([null, undefined]);

      expect(params).toBeDefined();
    });

    test('should handle parameters with equals sign', () => {
      const params = cli.parseParameters(['--version=3.5.0', '--format=json']);

      expect(params.version).toBe('3.5.0');
      expect(params.format).toBe('json');
    });

    test('should handle case-insensitive flags', () => {
      const params = cli.parseParameters(['--VERSION', '3.5.0']);

      expect(params.version).toBe('3.5.0');
    });

    test('should handle whitespace in values', () => {
      const params = cli.parseParameters(['--category', ' breaking ']);

      expect(params.category).toBe('breaking');
    });
  });

  describe('Performance', () => {
    test('should parse parameters in under 10ms', () => {
      const start = Date.now();
      cli.parseParameters([
        '--version', '3.5.0',
        '--since', '7d',
        '--category', 'breaking,new',
        '--format', 'json',
        '--important',
        '--refresh'
      ]);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(10);
    });

    test('should validate parameters in under 10ms', () => {
      const params = {
        version: '3.5.0',
        since: '7d',
        category: ['breaking', 'new'],
        format: 'json',
        important: true,
        refresh: true
      };

      const start = Date.now();
      cli.validateParameters(params);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(10);
    });
  });
});
