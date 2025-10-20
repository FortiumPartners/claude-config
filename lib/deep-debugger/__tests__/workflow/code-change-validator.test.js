/**
 * Tests for Code Change Validator
 */

const CodeChangeValidator = require('../../workflow/code-change-validator');

describe('CodeChangeValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new CodeChangeValidator({
      logger: jest.fn()
    });
  });

  describe('Constructor', () => {
    it('should initialize with default max lines per file', () => {
      expect(validator.maxLinesPerFile).toBe(500);
    });

    it('should initialize with default max total lines', () => {
      expect(validator.maxTotalLines).toBe(2000);
    });

    it('should initialize with strict path validation enabled', () => {
      expect(validator.strictPathValidation).toBe(true);
    });

    it('should initialize with valid change types', () => {
      expect(validator.validChangeTypes).toEqual(['added', 'modified', 'deleted']);
    });

    it('should initialize with excluded patterns', () => {
      expect(validator.excludedPatterns).toBeDefined();
      expect(validator.excludedPatterns.length).toBeGreaterThan(0);
    });

    it('should allow custom configuration', () => {
      const custom = new CodeChangeValidator({
        maxLinesPerFile: 1000,
        maxTotalLines: 5000,
        strictPathValidation: false
      });

      expect(custom.maxLinesPerFile).toBe(1000);
      expect(custom.maxTotalLines).toBe(5000);
      expect(custom.strictPathValidation).toBe(false);
    });
  });

  describe('validateCodeChanges', () => {
    let validContext;

    beforeEach(() => {
      validContext = {
        codeChanges: [
          {
            filePath: 'lib/auth/validator.js',
            changeType: 'modified',
            linesAdded: 10,
            linesRemoved: 5,
            diffContent: 'diff content'
          }
        ],
        affectedFiles: ['lib/auth/validator.js'],
        component: 'auth'
      };
    });

    it('should throw error if context is null', () => {
      expect(() => validator.validateCodeChanges(null)).toThrow('Validation context is required');
    });

    it('should throw error if codeChanges not array', () => {
      const invalid = { ...validContext, codeChanges: 'not-array' };
      expect(() => validator.validateCodeChanges(invalid)).toThrow('codeChanges must be an array');
    });

    it('should throw error if affectedFiles not array', () => {
      const invalid = { ...validContext, affectedFiles: 'not-array' };
      expect(() => validator.validateCodeChanges(invalid)).toThrow('affectedFiles must be an array');
    });

    it('should throw error if component missing', () => {
      const invalid = { ...validContext };
      delete invalid.component;
      expect(() => validator.validateCodeChanges(invalid)).toThrow('component is required');
    });

    it('should validate valid code changes', () => {
      const result = validator.validateCodeChanges(validContext);

      expect(result.passed).toBe(true);
      expect(result.failureReason).toBeNull();
    });

    it('should include validation checks in result', () => {
      const result = validator.validateCodeChanges(validContext);

      expect(result.checks).toBeDefined();
      expect(result.checks.allChangesParseable).toBe(true);
      expect(result.checks.validChangeTypes).toBe(true);
      expect(result.checks.reasonableSize).toBe(true);
    });

    it('should include metrics in result', () => {
      const result = validator.validateCodeChanges(validContext);

      expect(result.metrics).toBeDefined();
      expect(result.metrics.filesChanged).toBe(1);
      expect(result.metrics.linesAdded).toBe(10);
      expect(result.metrics.linesRemoved).toBe(5);
    });

    it('should include diff summary in result', () => {
      const result = validator.validateCodeChanges(validContext);

      expect(result.diffSummary).toBeDefined();
      expect(result.diffSummary).toContain('Code Change Summary');
    });

    it('should include warnings array', () => {
      const result = validator.validateCodeChanges(validContext);

      expect(Array.isArray(result.warnings)).toBe(true);
    });
  });

  describe('parseCodeChange', () => {
    it('should throw error for missing filePath', () => {
      const change = { changeType: 'modified' };
      expect(() => validator.parseCodeChange(change)).toThrow('missing filePath');
    });

    it('should throw error for missing changeType', () => {
      const change = { filePath: 'test.js' };
      expect(() => validator.parseCodeChange(change)).toThrow('missing changeType');
    });

    it('should parse valid code change', () => {
      const change = {
        filePath: 'lib/test.js',
        changeType: 'modified',
        linesAdded: 10,
        linesRemoved: 5,
        diffContent: 'diff'
      };

      const parsed = validator.parseCodeChange(change);

      expect(parsed.filePath).toBe('lib/test.js');
      expect(parsed.changeType).toBe('modified');
      expect(parsed.linesAdded).toBe(10);
      expect(parsed.linesRemoved).toBe(5);
    });

    it('should convert filePath to string', () => {
      const change = {
        filePath: 123,
        changeType: 'modified'
      };

      const parsed = validator.parseCodeChange(change);
      expect(typeof parsed.filePath).toBe('string');
    });

    it('should convert changeType to string', () => {
      const change = {
        filePath: 'test.js',
        changeType: 123
      };

      const parsed = validator.parseCodeChange(change);
      expect(typeof parsed.changeType).toBe('string');
    });

    it('should default linesAdded to 0 if missing', () => {
      const change = {
        filePath: 'test.js',
        changeType: 'modified'
      };

      const parsed = validator.parseCodeChange(change);
      expect(parsed.linesAdded).toBe(0);
    });

    it('should default linesRemoved to 0 if missing', () => {
      const change = {
        filePath: 'test.js',
        changeType: 'modified'
      };

      const parsed = validator.parseCodeChange(change);
      expect(parsed.linesRemoved).toBe(0);
    });

    it('should default diffContent to empty string if missing', () => {
      const change = {
        filePath: 'test.js',
        changeType: 'modified'
      };

      const parsed = validator.parseCodeChange(change);
      expect(parsed.diffContent).toBe('');
    });
  });

  describe('validateFilePaths', () => {
    it('should pass for files in expected list', () => {
      const changes = [
        { filePath: 'lib/auth/validator.js', changeType: 'modified', linesAdded: 5, linesRemoved: 2 }
      ];
      const affectedFiles = ['lib/auth/validator.js'];

      const result = validator.validateFilePaths(changes, affectedFiles, 'auth');

      expect(result.valid).toBe(true);
    });

    it('should pass for files in component directory', () => {
      const changes = [
        { filePath: 'lib/auth/helper.js', changeType: 'modified', linesAdded: 3, linesRemoved: 1 }
      ];
      const affectedFiles = ['lib/auth/validator.js'];

      const result = validator.validateFilePaths(changes, affectedFiles, 'auth');

      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should fail for files outside component', () => {
      const changes = [
        { filePath: 'lib/other/file.js', changeType: 'modified', linesAdded: 5, linesRemoved: 2 }
      ];
      const affectedFiles = ['lib/auth/validator.js'];

      const result = validator.validateFilePaths(changes, affectedFiles, 'auth');

      expect(result.valid).toBe(false);
      expect(result.failureReason).toContain('Unexpected files modified');
    });

    it('should handle partial path matches', () => {
      const changes = [
        { filePath: 'lib/auth/validator.js', changeType: 'modified', linesAdded: 5, linesRemoved: 2 }
      ];
      const affectedFiles = ['auth/validator.js'];

      const result = validator.validateFilePaths(changes, affectedFiles, 'auth');

      expect(result.valid).toBe(true);
    });
  });

  describe('validateNoExcludedFiles', () => {
    it('should pass for non-excluded files', () => {
      const changes = [
        { filePath: 'lib/auth/validator.js', changeType: 'modified', linesAdded: 5, linesRemoved: 2 }
      ];

      const result = validator.validateNoExcludedFiles(changes);

      expect(result.valid).toBe(true);
    });

    it('should fail for node_modules changes', () => {
      const changes = [
        { filePath: 'node_modules/package/index.js', changeType: 'modified', linesAdded: 1, linesRemoved: 0 }
      ];

      const result = validator.validateNoExcludedFiles(changes);

      expect(result.valid).toBe(false);
      expect(result.failureReason).toContain('Excluded files modified');
    });

    it('should fail for .git directory changes', () => {
      const changes = [
        { filePath: '.git/config', changeType: 'modified', linesAdded: 1, linesRemoved: 0 }
      ];

      const result = validator.validateNoExcludedFiles(changes);

      expect(result.valid).toBe(false);
    });

    it('should fail for package-lock.json changes', () => {
      const changes = [
        { filePath: 'package-lock.json', changeType: 'modified', linesAdded: 100, linesRemoved: 50 }
      ];

      const result = validator.validateNoExcludedFiles(changes);

      expect(result.valid).toBe(false);
    });

    it('should fail for lock file changes', () => {
      const lockFiles = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];

      lockFiles.forEach(lockFile => {
        const changes = [
          { filePath: lockFile, changeType: 'modified', linesAdded: 1, linesRemoved: 0 }
        ];

        const result = validator.validateNoExcludedFiles(changes);
        expect(result.valid).toBe(false);
      });
    });
  });

  describe('calculateChangeMetrics', () => {
    it('should calculate total lines added', () => {
      const changes = [
        { filePath: 'file1.js', changeType: 'modified', linesAdded: 10, linesRemoved: 5 },
        { filePath: 'file2.js', changeType: 'modified', linesAdded: 20, linesRemoved: 10 }
      ];

      const metrics = validator.calculateChangeMetrics(changes);

      expect(metrics.linesAdded).toBe(30);
    });

    it('should calculate total lines removed', () => {
      const changes = [
        { filePath: 'file1.js', changeType: 'modified', linesAdded: 10, linesRemoved: 5 },
        { filePath: 'file2.js', changeType: 'modified', linesAdded: 20, linesRemoved: 10 }
      ];

      const metrics = validator.calculateChangeMetrics(changes);

      expect(metrics.linesRemoved).toBe(15);
    });

    it('should calculate total lines changed', () => {
      const changes = [
        { filePath: 'file1.js', changeType: 'modified', linesAdded: 10, linesRemoved: 5 }
      ];

      const metrics = validator.calculateChangeMetrics(changes);

      expect(metrics.totalLinesChanged).toBe(15);
    });

    it('should calculate net change', () => {
      const changes = [
        { filePath: 'file1.js', changeType: 'modified', linesAdded: 20, linesRemoved: 5 }
      ];

      const metrics = validator.calculateChangeMetrics(changes);

      expect(metrics.netChange).toBe(15);
    });

    it('should identify largest file change', () => {
      const changes = [
        { filePath: 'file1.js', changeType: 'modified', linesAdded: 10, linesRemoved: 5 },
        { filePath: 'file2.js', changeType: 'modified', linesAdded: 50, linesRemoved: 30 }
      ];

      const metrics = validator.calculateChangeMetrics(changes);

      expect(metrics.largestFile).toBe('file2.js');
      expect(metrics.maxLinesPerFile).toBe(80);
    });

    it('should count files changed', () => {
      const changes = [
        { filePath: 'file1.js', changeType: 'modified', linesAdded: 10, linesRemoved: 5 },
        { filePath: 'file2.js', changeType: 'modified', linesAdded: 20, linesRemoved: 10 },
        { filePath: 'file3.js', changeType: 'added', linesAdded: 30, linesRemoved: 0 }
      ];

      const metrics = validator.calculateChangeMetrics(changes);

      expect(metrics.filesChanged).toBe(3);
    });

    it('should categorize change types', () => {
      const changes = [
        { filePath: 'file1.js', changeType: 'added', linesAdded: 10, linesRemoved: 0 },
        { filePath: 'file2.js', changeType: 'modified', linesAdded: 20, linesRemoved: 10 },
        { filePath: 'file3.js', changeType: 'deleted', linesAdded: 0, linesRemoved: 30 }
      ];

      const metrics = validator.calculateChangeMetrics(changes);

      expect(metrics.changeTypes.added).toBe(1);
      expect(metrics.changeTypes.modified).toBe(1);
      expect(metrics.changeTypes.deleted).toBe(1);
    });

    it('should provide per-file metrics', () => {
      const changes = [
        { filePath: 'file1.js', changeType: 'modified', linesAdded: 10, linesRemoved: 5 }
      ];

      const metrics = validator.calculateChangeMetrics(changes);

      expect(metrics.fileMetrics['file1.js']).toEqual({
        added: 10,
        removed: 5,
        total: 15,
        changeType: 'modified'
      });
    });
  });

  describe('generateDiffSummary', () => {
    it('should generate markdown summary', () => {
      const changes = [
        { filePath: 'test.js', changeType: 'modified', linesAdded: 10, linesRemoved: 5 }
      ];
      const metrics = validator.calculateChangeMetrics(changes);

      const summary = validator.generateDiffSummary(changes, metrics);

      expect(summary).toContain('## Code Change Summary');
      expect(summary).toContain('**Files Changed**: 1');
      expect(summary).toContain('**Lines Added**: +10');
      expect(summary).toContain('**Lines Removed**: -5');
    });

    it('should include change type breakdown', () => {
      const changes = [
        { filePath: 'file1.js', changeType: 'added', linesAdded: 10, linesRemoved: 0 },
        { filePath: 'file2.js', changeType: 'modified', linesAdded: 5, linesRemoved: 2 }
      ];
      const metrics = validator.calculateChangeMetrics(changes);

      const summary = validator.generateDiffSummary(changes, metrics);

      expect(summary).toContain('Added: 1 files');
      expect(summary).toContain('Modified: 1 files');
    });

    it('should include largest change info', () => {
      const changes = [
        { filePath: 'small.js', changeType: 'modified', linesAdded: 5, linesRemoved: 2 },
        { filePath: 'large.js', changeType: 'modified', linesAdded: 50, linesRemoved: 30 }
      ];
      const metrics = validator.calculateChangeMetrics(changes);

      const summary = validator.generateDiffSummary(changes, metrics);

      expect(summary).toContain('Largest Change');
      expect(summary).toContain('large.js');
      expect(summary).toContain('80');
    });

    it('should list all modified files', () => {
      const changes = [
        { filePath: 'file1.js', changeType: 'modified', linesAdded: 10, linesRemoved: 5 },
        { filePath: 'file2.js', changeType: 'added', linesAdded: 20, linesRemoved: 0 }
      ];
      const metrics = validator.calculateChangeMetrics(changes);

      const summary = validator.generateDiffSummary(changes, metrics);

      expect(summary).toContain('file1.js');
      expect(summary).toContain('file2.js');
      expect(summary).toContain('+10/-5');
      expect(summary).toContain('+20/-0');
    });
  });

  describe('Size Validation', () => {
    let context;

    beforeEach(() => {
      context = {
        codeChanges: [],
        affectedFiles: ['lib/test.js'],
        component: 'test'
      };
    });

    it('should warn for large single file change', () => {
      context.codeChanges = [
        {
          filePath: 'lib/test.js',
          changeType: 'modified',
          linesAdded: 600,
          linesRemoved: 100
        }
      ];

      const result = validator.validateCodeChanges(context);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('Large change in single file');
    });

    it('should warn for large total change', () => {
      context.codeChanges = [
        { filePath: 'lib/test1.js', changeType: 'modified', linesAdded: 800, linesRemoved: 400 },
        { filePath: 'lib/test2.js', changeType: 'modified', linesAdded: 800, linesRemoved: 400 }
      ];

      const result = validator.validateCodeChanges(context);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('Large total change'))).toBe(true);
    });

    it('should fail on strict size enforcement', () => {
      context.codeChanges = [
        {
          filePath: 'lib/test.js',
          changeType: 'modified',
          linesAdded: 600,
          linesRemoved: 100
        }
      ];
      context.constraints = { strictSizeEnforcement: true };

      const result = validator.validateCodeChanges(context);

      expect(result.passed).toBe(false);
      expect(result.failureReason).toContain('too large');
    });
  });

  describe('Invalid Change Types', () => {
    it('should fail for invalid change type', () => {
      const context = {
        codeChanges: [
          {
            filePath: 'lib/test.js',
            changeType: 'invalid',
            linesAdded: 10,
            linesRemoved: 5
          }
        ],
        affectedFiles: ['lib/test.js'],
        component: 'test'
      };

      const result = validator.validateCodeChanges(context);

      expect(result.passed).toBe(false);
      expect(result.failureReason).toContain('Invalid change type');
    });
  });

  describe('buildValidationReport', () => {
    it('should build report for passing validation', () => {
      const validation = {
        passed: true,
        checks: {
          allChangesParseable: true,
          validChangeTypes: true,
          reasonableSize: true
        },
        warnings: [],
        metrics: {
          filesChanged: 2,
          linesAdded: 20,
          linesRemoved: 10
        },
        diffSummary: 'Summary text',
        failureReason: null
      };

      const report = validator.buildValidationReport(validation);

      expect(report.passed).toBe(true);
      expect(report.checksPerformed).toBe(3);
      expect(report.recommendation).toContain('approved');
    });

    it('should build report for failing validation', () => {
      const validation = {
        passed: false,
        checks: {
          allChangesParseable: true,
          validChangeTypes: false
        },
        warnings: ['Warning 1'],
        metrics: {},
        diffSummary: 'Summary',
        failureReason: 'Invalid change type'
      };

      const report = validator.buildValidationReport(validation);

      expect(report.passed).toBe(false);
      expect(report.failureReason).toBe('Invalid change type');
      expect(report.recommendation).toContain('require revision');
    });

    it('should include all validation details', () => {
      const validation = {
        passed: true,
        checks: { check1: true },
        warnings: ['warning1'],
        metrics: { metric1: 'value' },
        diffSummary: 'summary',
        failureReason: null
      };

      const report = validator.buildValidationReport(validation);

      expect(report.checkResults).toEqual(validation.checks);
      expect(report.warnings).toEqual(validation.warnings);
      expect(report.metrics).toEqual(validation.metrics);
      expect(report.diffSummary).toBe(validation.diffSummary);
    });
  });

  describe('Strict Path Validation Off', () => {
    beforeEach(() => {
      validator = new CodeChangeValidator({
        strictPathValidation: false,
        logger: jest.fn()
      });
    });

    it('should skip path validation when disabled', () => {
      const context = {
        codeChanges: [
          {
            filePath: 'lib/other/file.js',
            changeType: 'modified',
            linesAdded: 5,
            linesRemoved: 2
          }
        ],
        affectedFiles: ['lib/auth/validator.js'],
        component: 'auth'
      };

      const result = validator.validateCodeChanges(context);

      expect(result.passed).toBe(true);
      // Path validation not performed when strict mode off
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty codeChanges array', () => {
      const context = {
        codeChanges: [],
        affectedFiles: ['lib/test.js'],
        component: 'test'
      };

      const result = validator.validateCodeChanges(context);

      expect(result.passed).toBe(true);
      expect(result.metrics.filesChanged).toBe(0);
    });

    it('should handle zero lines changed', () => {
      const context = {
        codeChanges: [
          {
            filePath: 'lib/test.js',
            changeType: 'modified',
            linesAdded: 0,
            linesRemoved: 0
          }
        ],
        affectedFiles: ['lib/test.js'],
        component: 'test'
      };

      const result = validator.validateCodeChanges(context);

      expect(result.metrics.totalLinesChanged).toBe(0);
    });

    it('should handle negative net change (more removals than additions)', () => {
      const changes = [
        { filePath: 'test.js', changeType: 'modified', linesAdded: 5, linesRemoved: 20 }
      ];

      const metrics = validator.calculateChangeMetrics(changes);

      expect(metrics.netChange).toBe(-15);
    });
  });
});
