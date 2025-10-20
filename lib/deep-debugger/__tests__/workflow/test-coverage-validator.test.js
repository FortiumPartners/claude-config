/**
 * Tests for Test Coverage Validator
 */

const TestCoverageValidator = require('../../workflow/test-coverage-validator');

describe('TestCoverageValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new TestCoverageValidator({
      logger: jest.fn()
    });
  });

  describe('Constructor', () => {
    it('should initialize with default min unit coverage', () => {
      expect(validator.minUnitCoverage).toBe(80);
    });

    it('should initialize with default min integration coverage', () => {
      expect(validator.minIntegrationCoverage).toBe(70);
    });

    it('should initialize with default min branch coverage', () => {
      expect(validator.minBranchCoverage).toBe(70);
    });

    it('should not allow regression by default', () => {
      expect(validator.allowRegression).toBe(false);
    });

    it('should initialize with supported frameworks', () => {
      expect(validator.supportedFrameworks).toContain('jest');
      expect(validator.supportedFrameworks).toContain('pytest');
      expect(validator.supportedFrameworks).toContain('rspec');
      expect(validator.supportedFrameworks).toContain('xunit');
    });

    it('should initialize with test types', () => {
      expect(validator.testTypes).toEqual(['unit', 'integration', 'e2e']);
    });

    it('should allow custom configuration', () => {
      const custom = new TestCoverageValidator({
        minUnitCoverage: 90,
        minIntegrationCoverage: 80,
        allowRegression: true
      });

      expect(custom.minUnitCoverage).toBe(90);
      expect(custom.minIntegrationCoverage).toBe(80);
      expect(custom.allowRegression).toBe(true);
    });
  });

  describe('validateTestCoverage', () => {
    let validContext;

    beforeEach(() => {
      validContext = {
        testChanges: [
          {
            filePath: 'test/unit/validator.test.js',
            testFramework: 'jest',
            testType: 'unit',
            testCount: 10,
            coverage: {
              lineCoverage: 85,
              branchCoverage: 80,
              functionCoverage: 90,
              statementCoverage: 85
            }
          }
        ]
      };
    });

    it('should throw error if context is null', () => {
      expect(() => validator.validateTestCoverage(null)).toThrow('Validation context is required');
    });

    it('should throw error if testChanges not array', () => {
      const invalid = { testChanges: 'not-array' };
      expect(() => validator.validateTestCoverage(invalid)).toThrow('testChanges must be an array');
    });

    it('should validate valid test coverage', () => {
      const result = validator.validateTestCoverage(validContext);

      expect(result.passed).toBe(true);
      expect(result.failureReason).toBeNull();
    });

    it('should include validation checks in result', () => {
      const result = validator.validateTestCoverage(validContext);

      expect(result.checks).toBeDefined();
      expect(result.checks.allTestsParseable).toBe(true);
      expect(result.checks.coverageStandardsMet).toBe(true);
    });

    it('should include test metrics in result', () => {
      const result = validator.validateTestCoverage(validContext);

      expect(result.metrics.tests).toBeDefined();
      expect(result.metrics.tests.totalTests).toBe(10);
      expect(result.metrics.tests.byType.unit).toBe(10);
    });

    it('should include coverage metrics in result', () => {
      const result = validator.validateTestCoverage(validContext);

      expect(result.metrics.coverage).toBeDefined();
      expect(result.metrics.coverage.unit.lineCoverage).toBe(85);
    });

    it('should include warnings array', () => {
      const result = validator.validateTestCoverage(validContext);

      expect(Array.isArray(result.warnings)).toBe(true);
    });
  });

  describe('parseTestChange', () => {
    it('should throw error for missing filePath', () => {
      const testChange = {
        testFramework: 'jest',
        testType: 'unit',
        coverage: {}
      };

      expect(() => validator.parseTestChange(testChange)).toThrow('missing filePath');
    });

    it('should throw error for missing testFramework', () => {
      const testChange = {
        filePath: 'test.js',
        testType: 'unit',
        coverage: {}
      };

      expect(() => validator.parseTestChange(testChange)).toThrow('missing testFramework');
    });

    it('should throw error for missing testType', () => {
      const testChange = {
        filePath: 'test.js',
        testFramework: 'jest',
        coverage: {}
      };

      expect(() => validator.parseTestChange(testChange)).toThrow('missing testType');
    });

    it('should throw error for missing coverage', () => {
      const testChange = {
        filePath: 'test.js',
        testFramework: 'jest',
        testType: 'unit'
      };

      expect(() => validator.parseTestChange(testChange)).toThrow('missing coverage');
    });

    it('should parse valid test change', () => {
      const testChange = {
        filePath: 'test/unit/test.js',
        testFramework: 'jest',
        testType: 'unit',
        testCount: 5,
        coverage: {
          lineCoverage: 80,
          branchCoverage: 75,
          functionCoverage: 85,
          statementCoverage: 80
        }
      };

      const parsed = validator.parseTestChange(testChange);

      expect(parsed.filePath).toBe('test/unit/test.js');
      expect(parsed.testFramework).toBe('jest');
      expect(parsed.testType).toBe('unit');
      expect(parsed.testCount).toBe(5);
    });

    it('should default testCount to 0 if missing', () => {
      const testChange = {
        filePath: 'test.js',
        testFramework: 'jest',
        testType: 'unit',
        coverage: { lineCoverage: 80 }
      };

      const parsed = validator.parseTestChange(testChange);
      expect(parsed.testCount).toBe(0);
    });

    it('should parse coverage report', () => {
      const testChange = {
        filePath: 'test.js',
        testFramework: 'jest',
        testType: 'unit',
        coverage: {
          lineCoverage: 85,
          branchCoverage: 80,
          functionCoverage: 90,
          statementCoverage: 85
        }
      };

      const parsed = validator.parseTestChange(testChange);

      expect(parsed.coverage.lineCoverage).toBe(85);
      expect(parsed.coverage.branchCoverage).toBe(80);
      expect(parsed.coverage.functionCoverage).toBe(90);
      expect(parsed.coverage.statementCoverage).toBe(85);
    });
  });

  describe('parseCoverageReport', () => {
    it('should parse complete coverage report', () => {
      const coverage = {
        lineCoverage: 85,
        branchCoverage: 80,
        functionCoverage: 90,
        statementCoverage: 85
      };

      const parsed = validator.parseCoverageReport(coverage);

      expect(parsed.lineCoverage).toBe(85);
      expect(parsed.branchCoverage).toBe(80);
      expect(parsed.functionCoverage).toBe(90);
      expect(parsed.statementCoverage).toBe(85);
    });

    it('should default missing coverage values to 0', () => {
      const coverage = {
        lineCoverage: 85
      };

      const parsed = validator.parseCoverageReport(coverage);

      expect(parsed.lineCoverage).toBe(85);
      expect(parsed.branchCoverage).toBe(0);
      expect(parsed.functionCoverage).toBe(0);
      expect(parsed.statementCoverage).toBe(0);
    });

    it('should convert string coverage values to numbers', () => {
      const coverage = {
        lineCoverage: '85',
        branchCoverage: '80'
      };

      const parsed = validator.parseCoverageReport(coverage);

      expect(parsed.lineCoverage).toBe(85);
      expect(parsed.branchCoverage).toBe(80);
    });
  });

  describe('calculateTestMetrics', () => {
    it('should count total tests', () => {
      const tests = [
        { testCount: 10, testType: 'unit', testFramework: 'jest', coverage: {} },
        { testCount: 5, testType: 'integration', testFramework: 'jest', coverage: {} }
      ];

      const metrics = validator.calculateTestMetrics(tests);

      expect(metrics.totalTests).toBe(15);
    });

    it('should categorize tests by type', () => {
      const tests = [
        { testCount: 10, testType: 'unit', testFramework: 'jest', coverage: {} },
        { testCount: 5, testType: 'integration', testFramework: 'jest', coverage: {} },
        { testCount: 3, testType: 'e2e', testFramework: 'jest', coverage: {} }
      ];

      const metrics = validator.calculateTestMetrics(tests);

      expect(metrics.byType.unit).toBe(10);
      expect(metrics.byType.integration).toBe(5);
      expect(metrics.byType.e2e).toBe(3);
    });

    it('should categorize by framework', () => {
      const tests = [
        { testCount: 10, testType: 'unit', testFramework: 'jest', coverage: {} },
        { testCount: 5, testType: 'unit', testFramework: 'pytest', coverage: {} }
      ];

      const metrics = validator.calculateTestMetrics(tests);

      expect(metrics.byFramework.jest).toBe(1);
      expect(metrics.byFramework.pytest).toBe(1);
    });

    it('should count files changed', () => {
      const tests = [
        { testCount: 10, testType: 'unit', testFramework: 'jest', coverage: {} },
        { testCount: 5, testType: 'unit', testFramework: 'jest', coverage: {} }
      ];

      const metrics = validator.calculateTestMetrics(tests);

      expect(metrics.filesChanged).toBe(2);
    });
  });

  describe('validateCoverageStandards', () => {
    it('should pass for coverage meeting standards', () => {
      const tests = [
        {
          testType: 'unit',
          testFramework: 'jest',
          testCount: 10,
          coverage: {
            lineCoverage: 85,
            branchCoverage: 80,
            functionCoverage: 90,
            statementCoverage: 85
          }
        }
      ];

      const result = validator.validateCoverageStandards(tests);

      expect(result.passed).toBe(true);
      expect(result.failureReason).toBeNull();
    });

    it('should fail for unit coverage below minimum', () => {
      const tests = [
        {
          testType: 'unit',
          testFramework: 'jest',
          testCount: 10,
          coverage: { lineCoverage: 75, branchCoverage: 70, functionCoverage: 80, statementCoverage: 75 }
        }
      ];

      const result = validator.validateCoverageStandards(tests);

      expect(result.passed).toBe(false);
      expect(result.failureReason).toContain('Unit test coverage');
      expect(result.failureReason).toContain('75%');
      expect(result.failureReason).toContain('80%');
    });

    it('should fail for integration coverage below minimum', () => {
      const tests = [
        {
          testType: 'integration',
          testFramework: 'jest',
          testCount: 5,
          coverage: { lineCoverage: 65, branchCoverage: 60, functionCoverage: 70, statementCoverage: 65 }
        }
      ];

      const result = validator.validateCoverageStandards(tests);

      expect(result.passed).toBe(false);
      expect(result.failureReason).toContain('Integration test coverage');
      expect(result.failureReason).toContain('65%');
      expect(result.failureReason).toContain('70%');
    });

    it('should warn for low branch coverage', () => {
      const tests = [
        {
          testType: 'unit',
          testFramework: 'jest',
          testCount: 10,
          coverage: { lineCoverage: 85, branchCoverage: 60, functionCoverage: 85, statementCoverage: 85 }
        }
      ];

      const result = validator.validateCoverageStandards(tests);

      expect(result.passed).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('branch coverage');
    });

    it('should warn if no unit coverage data', () => {
      const tests = [];

      const result = validator.validateCoverageStandards(tests);

      expect(result.warnings.some(w => w.includes('No unit test coverage'))).toBe(true);
    });

    it('should average coverage across multiple test files', () => {
      const tests = [
        {
          testType: 'unit',
          testFramework: 'jest',
          testCount: 10,
          coverage: { lineCoverage: 80, branchCoverage: 75, functionCoverage: 85, statementCoverage: 80 }
        },
        {
          testType: 'unit',
          testFramework: 'jest',
          testCount: 10,
          coverage: { lineCoverage: 90, branchCoverage: 85, functionCoverage: 95, statementCoverage: 90 }
        }
      ];

      const result = validator.validateCoverageStandards(tests);

      expect(result.passed).toBe(true);
      expect(result.metrics.unit.lineCoverage).toBe(85); // Average of 80 and 90
    });
  });

  describe('averageCoverage', () => {
    it('should calculate average coverage', () => {
      const coverages = [
        { lineCoverage: 80, branchCoverage: 75, functionCoverage: 85, statementCoverage: 80 },
        { lineCoverage: 90, branchCoverage: 85, functionCoverage: 95, statementCoverage: 90 }
      ];

      const average = validator.averageCoverage(coverages);

      expect(average.lineCoverage).toBe(85);
      expect(average.branchCoverage).toBe(80);
      expect(average.functionCoverage).toBe(90);
      expect(average.statementCoverage).toBe(85);
    });

    it('should round to one decimal place', () => {
      const coverages = [
        { lineCoverage: 80.3, branchCoverage: 75.6, functionCoverage: 85.2, statementCoverage: 80.8 },
        { lineCoverage: 90.7, branchCoverage: 85.4, functionCoverage: 95.8, statementCoverage: 90.2 }
      ];

      const average = validator.averageCoverage(coverages);

      expect(average.lineCoverage).toBe(85.5);
      expect(average.branchCoverage).toBe(80.5);
    });
  });

  describe('checkCoverageRegression', () => {
    it('should pass when coverage maintained', () => {
      const currentCoverage = {
        unit: { lineCoverage: 85 },
        integration: { lineCoverage: 75 }
      };
      const baselineCoverage = {
        unit: { lineCoverage: 85 },
        integration: { lineCoverage: 75 }
      };

      const result = validator.checkCoverageRegression(currentCoverage, baselineCoverage);

      expect(result.passed).toBe(true);
    });

    it('should pass when coverage improved', () => {
      const currentCoverage = {
        unit: { lineCoverage: 90 },
        integration: { lineCoverage: 80 }
      };
      const baselineCoverage = {
        unit: { lineCoverage: 85 },
        integration: { lineCoverage: 75 }
      };

      const result = validator.checkCoverageRegression(currentCoverage, baselineCoverage);

      expect(result.passed).toBe(true);
      expect(result.regression.unit.change).toBe(5);
      expect(result.regression.unit.regressed).toBe(false);
    });

    it('should fail when unit coverage regressed', () => {
      const currentCoverage = {
        unit: { lineCoverage: 75 },
        integration: { lineCoverage: 75 }
      };
      const baselineCoverage = {
        unit: { lineCoverage: 85 },
        integration: { lineCoverage: 75 }
      };

      const result = validator.checkCoverageRegression(currentCoverage, baselineCoverage);

      expect(result.passed).toBe(false);
      expect(result.failureReason).toContain('regressed');
      expect(result.failureReason).toContain('85%');
      expect(result.failureReason).toContain('75%');
    });

    it('should fail when integration coverage regressed', () => {
      const currentCoverage = {
        unit: { lineCoverage: 85 },
        integration: { lineCoverage: 65 }
      };
      const baselineCoverage = {
        unit: { lineCoverage: 85 },
        integration: { lineCoverage: 75 }
      };

      const result = validator.checkCoverageRegression(currentCoverage, baselineCoverage);

      expect(result.passed).toBe(false);
      expect(result.failureReason).toContain('integration');
    });

    it('should include regression details', () => {
      const currentCoverage = {
        unit: { lineCoverage: 75 },
        integration: { lineCoverage: 70 }
      };
      const baselineCoverage = {
        unit: { lineCoverage: 85 },
        integration: { lineCoverage: 75 }
      };

      const result = validator.checkCoverageRegression(currentCoverage, baselineCoverage);

      expect(result.regression.unit.current).toBe(75);
      expect(result.regression.unit.baseline).toBe(85);
      expect(result.regression.unit.change).toBe(-10);
      expect(result.regression.unit.regressed).toBe(true);
    });
  });

  describe('calculateCoverageImpact', () => {
    it('should indicate no baseline if not provided', () => {
      const currentCoverage = {
        unit: { lineCoverage: 85 }
      };

      const impact = validator.calculateCoverageImpact(currentCoverage, null);

      expect(impact.hasBaseline).toBe(false);
      expect(impact.message).toContain('No baseline');
    });

    it('should calculate coverage improvement', () => {
      const currentCoverage = {
        unit: { lineCoverage: 90 },
        integration: { lineCoverage: 80 }
      };
      const baselineCoverage = {
        unit: { lineCoverage: 85 },
        integration: { lineCoverage: 75 }
      };

      const impact = validator.calculateCoverageImpact(currentCoverage, baselineCoverage);

      expect(impact.byType.unit.improved).toBe(true);
      expect(impact.byType.unit.change).toBe(5);
      expect(impact.byType.integration.improved).toBe(true);
      expect(impact.byType.integration.change).toBe(5);
    });

    it('should calculate coverage regression', () => {
      const currentCoverage = {
        unit: { lineCoverage: 75 }
      };
      const baselineCoverage = {
        unit: { lineCoverage: 85 }
      };

      const impact = validator.calculateCoverageImpact(currentCoverage, baselineCoverage);

      expect(impact.byType.unit.regressed).toBe(true);
      expect(impact.byType.unit.change).toBe(-10);
    });

    it('should indicate maintained coverage', () => {
      const currentCoverage = {
        unit: { lineCoverage: 85 }
      };
      const baselineCoverage = {
        unit: { lineCoverage: 85 }
      };

      const impact = validator.calculateCoverageImpact(currentCoverage, baselineCoverage);

      expect(impact.byType.unit.maintained).toBe(true);
      expect(impact.byType.unit.change).toBe(0);
    });

    it('should calculate percent change', () => {
      const currentCoverage = {
        unit: { lineCoverage: 90 }
      };
      const baselineCoverage = {
        unit: { lineCoverage: 80 }
      };

      const impact = validator.calculateCoverageImpact(currentCoverage, baselineCoverage);

      expect(impact.byType.unit.percentChange).toBe(12.5); // (10/80)*100
    });
  });

  describe('buildCoverageReport', () => {
    it('should build report for passing validation', () => {
      const validation = {
        passed: true,
        checks: {},
        warnings: [],
        metrics: {
          tests: {
            totalTests: 15,
            byType: { unit: 10, integration: 5, e2e: 0 }
          },
          coverage: {
            unit: { lineCoverage: 85, branchCoverage: 80, functionCoverage: 90, statementCoverage: 85 },
            integration: { lineCoverage: 75, branchCoverage: 70, functionCoverage: 80, statementCoverage: 75 },
            e2e: { lineCoverage: 0, branchCoverage: 0, functionCoverage: 0, statementCoverage: 0 }
          }
        }
      };

      const report = validator.buildCoverageReport(validation);

      expect(report).toContain('✅ **Coverage Standards Met**');
      expect(report).toContain('Total Tests: 15');
      expect(report).toContain('Unit Tests: 10');
      expect(report).toContain('UNIT');
      expect(report).toContain('Line Coverage: 85%');
    });

    it('should build report for failing validation', () => {
      const validation = {
        passed: false,
        failureReason: 'Unit test coverage 75% below minimum 80%',
        checks: {},
        warnings: [],
        metrics: {
          tests: { totalTests: 10, byType: { unit: 10, integration: 0, e2e: 0 } },
          coverage: {
            unit: { lineCoverage: 75, branchCoverage: 70, functionCoverage: 80, statementCoverage: 75 },
            integration: { lineCoverage: 0, branchCoverage: 0, functionCoverage: 0, statementCoverage: 0 },
            e2e: { lineCoverage: 0, branchCoverage: 0, functionCoverage: 0, statementCoverage: 0 }
          }
        }
      };

      const report = validator.buildCoverageReport(validation);

      expect(report).toContain('❌ **Coverage Validation Failed**');
      expect(report).toContain('Unit test coverage 75% below minimum 80%');
    });

    it('should include coverage impact if baseline provided', () => {
      const validation = {
        passed: true,
        checks: {},
        warnings: [],
        metrics: {
          tests: { totalTests: 10, byType: { unit: 10, integration: 0, e2e: 0 } },
          coverage: {
            unit: { lineCoverage: 90, branchCoverage: 85, functionCoverage: 95, statementCoverage: 90 },
            integration: { lineCoverage: 0, branchCoverage: 0, functionCoverage: 0, statementCoverage: 0 },
            e2e: { lineCoverage: 0, branchCoverage: 0, functionCoverage: 0, statementCoverage: 0 }
          },
          impact: {
            hasBaseline: true,
            byType: {
              unit: {
                baseline: 85,
                current: 90,
                change: 5,
                percentChange: 5.9,
                improved: true
              }
            }
          }
        }
      };

      const report = validator.buildCoverageReport(validation);

      expect(report).toContain('Coverage Impact');
      expect(report).toContain('85%');
      expect(report).toContain('90%');
      expect(report).toContain('+5%');
      expect(report).toContain('📈');
    });

    it('should include warnings if present', () => {
      const validation = {
        passed: true,
        checks: {},
        warnings: ['Branch coverage below recommended 70%'],
        metrics: {
          tests: { totalTests: 10, byType: { unit: 10, integration: 0, e2e: 0 } },
          coverage: {
            unit: { lineCoverage: 85, branchCoverage: 65, functionCoverage: 90, statementCoverage: 85 },
            integration: { lineCoverage: 0, branchCoverage: 0, functionCoverage: 0, statementCoverage: 0 },
            e2e: { lineCoverage: 0, branchCoverage: 0, functionCoverage: 0, statementCoverage: 0 }
          }
        }
      };

      const report = validator.buildCoverageReport(validation);

      expect(report).toContain('Warnings');
      expect(report).toContain('Branch coverage below recommended');
    });
  });

  describe('Require New Tests', () => {
    it('should not require new tests if flag is false', () => {
      const context = {
        testChanges: [],
        requireNewTests: false
      };

      const result = validator.validateTestCoverage(context);

      expect(result.passed).toBe(true);
    });

    it('should note if no new tests added', () => {
      const context = {
        testChanges: [],
        requireNewTests: true
      };

      const result = validator.validateTestCoverage(context);

      expect(result.warnings.some(w => w.includes('No new tests'))).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty testChanges array', () => {
      const context = {
        testChanges: []
      };

      const result = validator.validateTestCoverage(context);

      expect(result.metrics.tests.totalTests).toBe(0);
    });

    it('should handle unsupported test frameworks', () => {
      const context = {
        testChanges: [
          {
            filePath: 'test.js',
            testFramework: 'unknown',
            testType: 'unit',
            testCount: 5,
            coverage: { lineCoverage: 80, branchCoverage: 75, functionCoverage: 85, statementCoverage: 80 }
          }
        ]
      };

      const result = validator.validateTestCoverage(context);

      expect(result.warnings.some(w => w.includes('unsupported frameworks'))).toBe(true);
    });

    it('should allow regression if configured', () => {
      validator = new TestCoverageValidator({
        allowRegression: true,
        logger: jest.fn()
      });

      const context = {
        testChanges: [
          {
            filePath: 'test.js',
            testFramework: 'jest',
            testType: 'unit',
            testCount: 10,
            coverage: { lineCoverage: 75, branchCoverage: 70, functionCoverage: 80, statementCoverage: 75 }
          }
        ],
        baselineCoverage: {
          unit: { lineCoverage: 85 },
          integration: { lineCoverage: 75 }
        }
      };

      const result = validator.validateTestCoverage(context);

      // Regression check not performed when allowRegression is true
      expect(result.checks.noCoverageRegression).toBeUndefined();
    });
  });
});
