/**
 * End-to-End Integration Test for TDD Workflow (Sprint 5)
 *
 * Tests complete integration of Sprint 5 validation modules:
 * - CodeChangeValidator: Validates code changes from specialists
 * - TestCoverageValidator: Validates test coverage meets standards
 *
 * Focuses on validation pipeline without delegation complexity.
 *
 * @module lib/deep-debugger/__tests__/integration/tdd-workflow-e2e
 */

const CodeChangeValidator = require('../../workflow/code-change-validator');
const TestCoverageValidator = require('../../workflow/test-coverage-validator');

describe('TDD Workflow E2E Integration (Sprint 5 Validators)', () => {
  let codeValidator;
  let coverageValidator;
  let logs;

  beforeEach(() => {
    logs = [];
    const logger = (msg) => logs.push(msg);

    codeValidator = new CodeChangeValidator({
      logger,
      maxLinesPerFile: 500,
      maxTotalLines: 2000,
      strictPathValidation: true
    });

    coverageValidator = new TestCoverageValidator({
      logger,
      minUnitCoverage: 80,
      minIntegrationCoverage: 70,
      allowRegression: false
    });
  });

  describe('Successful Workflow: Code + Coverage Validation', () => {
    test('should validate complete fix with code changes and test coverage', () => {
      // Simulate code changes from specialist
      const codeChanges = [
        {
          filePath: 'lib/services/user-service.js',
          changeType: 'modified',
          linesAdded: 25,
          linesRemoved: 10,
          diffContent: '+ null check added\n- removed unsafe access'
        },
        {
          filePath: 'lib/services/__tests__/user-service.test.js',
          changeType: 'modified',
          linesAdded: 40,
          linesRemoved: 5,
          diffContent: '+ added null case tests'
        }
      ];

      // Validate code changes
      const codeValidation = codeValidator.validateCodeChanges({
        codeChanges,
        affectedFiles: ['lib/services/user-service.js'],
        component: 'lib/services'
      });

      expect(codeValidation.passed).toBe(true);
      expect(codeValidation.checks.allChangesParseable).toBe(true);
      expect(codeValidation.checks.pathsInScope).toBe(true);
      expect(codeValidation.checks.noExcludedFiles).toBe(true);
      expect(codeValidation.checks.reasonableSize).toBe(true);
      expect(codeValidation.metrics.linesAdded).toBe(65);
      expect(codeValidation.metrics.linesRemoved).toBe(15);
      expect(codeValidation.metrics.filesChanged).toBe(2);

      // Simulate test coverage from specialist
      const testChanges = [
        {
          filePath: 'lib/services/__tests__/user-service.test.js',
          testFramework: 'jest',
          testType: 'unit',
          testCount: 8,
          coverage: {
            lineCoverage: 92,
            branchCoverage: 88,
            functionCoverage: 95,
            statementCoverage: 93
          }
        }
      ];

      // Validate test coverage
      const coverageValidation = coverageValidator.validateTestCoverage({
        testChanges,
        requireNewTests: true
      });

      expect(coverageValidation.passed).toBe(true);
      expect(coverageValidation.checks.allTestsParseable).toBe(true);
      expect(coverageValidation.checks.newTestsAdded).toBe(true);
      expect(coverageValidation.checks.coverageStandardsMet).toBe(true);
      expect(coverageValidation.metrics.tests.totalTests).toBe(8);
      expect(coverageValidation.metrics.coverage.unit.lineCoverage).toBe(92);

      // Verify logging occurred
      expect(logs.length).toBeGreaterThan(0);
      expect(logs.some(log => log.includes('Code Change Validation'))).toBe(true);
      expect(logs.some(log => log.includes('Test Coverage Validation'))).toBe(true);
    });

    test('should generate comprehensive validation reports', () => {
      const codeChanges = [
        {
          filePath: 'lib/services/quality.js',
          changeType: 'modified',
          linesAdded: 35,
          linesRemoved: 15,
          diffContent: '+ comprehensive improvements'
        }
      ];

      const codeValidation = codeValidator.validateCodeChanges({
        codeChanges,
        affectedFiles: ['lib/services/quality.js'],
        component: 'lib/services'
      });

      const codeReport = codeValidator.buildValidationReport(codeValidation);

      expect(typeof codeReport).toBe('object');
      expect(codeReport.passed).toBe(true);
      expect(codeReport.metrics.linesAdded).toBe(35);
      expect(codeReport.metrics.linesRemoved).toBe(15);
      expect(codeReport.diffSummary).toContain('Code Change Summary');

      const testChanges = [
        {
          filePath: 'lib/services/__tests__/quality.test.js',
          testFramework: 'jest',
          testType: 'unit',
          testCount: 10,
          coverage: {
            lineCoverage: 95,
            branchCoverage: 92,
            functionCoverage: 98,
            statementCoverage: 96
          }
        }
      ];

      const coverageValidation = coverageValidator.validateTestCoverage({
        testChanges
      });

      const coverageReport = coverageValidator.buildCoverageReport(coverageValidation);

      expect(typeof coverageReport).toBe('string');
      expect(coverageReport).toContain('Test Coverage Report');
      expect(coverageReport).toContain('✅');
      expect(coverageReport).toContain('95%'); // Line coverage
      expect(coverageReport).toContain('UNIT');
    });
  });

  describe('Failure Cases: Code Validation', () => {
    test('should warn for large code changes', () => {
      const codeChanges = [
        {
          filePath: 'lib/services/large-service.js',
          changeType: 'modified',
          linesAdded: 600, // Exceeds 500 line limit
          linesRemoved: 50,
          diffContent: '+ massive change'
        }
      ];

      const codeValidation = codeValidator.validateCodeChanges({
        codeChanges,
        affectedFiles: ['lib/services/large-service.js'],
        component: 'lib/services'
      });

      expect(codeValidation.passed).toBe(true); // Passes but has warnings
      expect(codeValidation.warnings.length).toBeGreaterThan(0);
      expect(codeValidation.warnings.some(w => w.includes('Large change'))).toBe(true);
    });

    test('should fail for excluded file changes', () => {
      const codeChanges = [
        {
          filePath: 'node_modules/some-package/index.js',
          changeType: 'modified',
          linesAdded: 10,
          linesRemoved: 5
        }
      ];

      const codeValidation = codeValidator.validateCodeChanges({
        codeChanges,
        affectedFiles: [],
        component: 'lib/services'
      });

      expect(codeValidation.passed).toBe(false);
      expect(codeValidation.failureReason).toContain('node_modules');
    });

    test('should fail for invalid change types', () => {
      const codeChanges = [
        {
          filePath: 'lib/services/service.js',
          changeType: 'invalid_type', // Not in ['added', 'modified', 'deleted']
          linesAdded: 10,
          linesRemoved: 5
        }
      ];

      const codeValidation = codeValidator.validateCodeChanges({
        codeChanges,
        affectedFiles: ['lib/services/service.js'],
        component: 'lib/services'
      });

      expect(codeValidation.passed).toBe(false);
      expect(codeValidation.failureReason).toContain('Invalid change type');
    });
  });

  describe('Failure Cases: Coverage Validation', () => {
    test('should fail for insufficient unit coverage', () => {
      const testChanges = [
        {
          filePath: 'lib/services/__tests__/poor-coverage.test.js',
          testFramework: 'jest',
          testType: 'unit',
          testCount: 3,
          coverage: {
            lineCoverage: 65, // Below 80% minimum
            branchCoverage: 60,
            functionCoverage: 70,
            statementCoverage: 68
          }
        }
      ];

      const coverageValidation = coverageValidator.validateTestCoverage({
        testChanges
      });

      expect(coverageValidation.passed).toBe(false);
      expect(coverageValidation.failureReason).toContain('Unit test coverage');
      expect(coverageValidation.failureReason).toContain('65%');
      expect(coverageValidation.failureReason).toContain('80%');
    });

    test('should fail for coverage regression', () => {
      const baselineCoverage = {
        unit: { lineCoverage: 90, branchCoverage: 85, functionCoverage: 92, statementCoverage: 91 },
        integration: { lineCoverage: 75, branchCoverage: 70, functionCoverage: 78, statementCoverage: 76 }
      };

      const testChanges = [
        {
          filePath: 'lib/services/__tests__/regress.test.js',
          testFramework: 'jest',
          testType: 'unit',
          testCount: 5,
          coverage: {
            lineCoverage: 85, // Down from 90% baseline
            branchCoverage: 80,
            functionCoverage: 88,
            statementCoverage: 86
          }
        }
      ];

      const coverageValidation = coverageValidator.validateTestCoverage({
        testChanges,
        baselineCoverage
      });

      expect(coverageValidation.passed).toBe(false);
      expect(coverageValidation.failureReason).toContain('regressed');
      expect(coverageValidation.failureReason).toContain('90%');
      expect(coverageValidation.failureReason).toContain('85%');
      expect(coverageValidation.metrics.regression.unit.regressed).toBe(true);
    });

    test('should warn for unsupported test frameworks', () => {
      const testChanges = [
        {
          filePath: 'lib/services/__tests__/custom.test.js',
          testFramework: 'custom-framework', // Not supported
          testType: 'unit',
          testCount: 5,
          coverage: {
            lineCoverage: 90,
            branchCoverage: 85,
            functionCoverage: 92,
            statementCoverage: 91
          }
        }
      ];

      const coverageValidation = coverageValidator.validateTestCoverage({
        testChanges
      });

      expect(coverageValidation.passed).toBe(true);
      expect(coverageValidation.warnings.some(w => w.includes('unsupported frameworks'))).toBe(true);
    });
  });

  describe('Success Cases: Coverage Improvement', () => {
    test('should track coverage improvement over baseline', () => {
      const baselineCoverage = {
        unit: { lineCoverage: 75, branchCoverage: 70, functionCoverage: 78, statementCoverage: 76 },
        integration: { lineCoverage: 65, branchCoverage: 60, functionCoverage: 68, statementCoverage: 66 }
      };

      const testChanges = [
        {
          filePath: 'lib/services/__tests__/improve.test.js',
          testFramework: 'jest',
          testType: 'unit',
          testCount: 12,
          coverage: {
            lineCoverage: 92, // Improved from 75%
            branchCoverage: 88,
            functionCoverage: 95,
            statementCoverage: 93
          }
        },
        {
          filePath: 'lib/services/__tests__/integration-improve.test.js',
          testFramework: 'jest',
          testType: 'integration',
          testCount: 5,
          coverage: {
            lineCoverage: 72, // Improved from 65%
            branchCoverage: 68,
            functionCoverage: 75,
            statementCoverage: 73
          }
        }
      ];

      const coverageValidation = coverageValidator.validateTestCoverage({
        testChanges,
        baselineCoverage
      });

      expect(coverageValidation.passed).toBe(true);
      expect(coverageValidation.metrics.coverage.unit.lineCoverage).toBe(92);
      expect(coverageValidation.metrics.coverage.integration.lineCoverage).toBe(72);
      expect(coverageValidation.metrics.impact.hasBaseline).toBe(true);
      expect(coverageValidation.metrics.impact.byType.unit.improved).toBe(true);
      expect(coverageValidation.metrics.impact.byType.unit.change).toBe(17); // 92 - 75
      expect(coverageValidation.metrics.impact.byType.integration.improved).toBe(true);
      expect(coverageValidation.metrics.impact.byType.integration.change).toBe(7); // 72 - 65
    });
  });

  describe('Edge Cases and Complex Scenarios', () => {
    test('should handle multiple files with different coverage levels', () => {
      const codeChanges = [
        {
          filePath: 'lib/services/service-a.js',
          changeType: 'modified',
          linesAdded: 50,
          linesRemoved: 20
        },
        {
          filePath: 'lib/services/service-b.js',
          changeType: 'modified',
          linesAdded: 30,
          linesRemoved: 10
        },
        {
          filePath: 'lib/services/__tests__/service-a.test.js',
          changeType: 'modified',
          linesAdded: 40,
          linesRemoved: 5
        },
        {
          filePath: 'lib/services/__tests__/service-b.test.js',
          changeType: 'added',
          linesAdded: 35,
          linesRemoved: 0
        }
      ];

      const codeValidation = codeValidator.validateCodeChanges({
        codeChanges,
        affectedFiles: ['lib/services/service-a.js', 'lib/services/service-b.js'],
        component: 'lib/services'
      });

      expect(codeValidation.passed).toBe(true);
      expect(codeValidation.metrics.filesChanged).toBe(4);
      expect(codeValidation.metrics.linesAdded).toBe(155);
      expect(codeValidation.metrics.changeTypes.modified).toBe(3);
      expect(codeValidation.metrics.changeTypes.added).toBe(1);

      const testChanges = [
        {
          filePath: 'lib/services/__tests__/service-a.test.js',
          testFramework: 'jest',
          testType: 'unit',
          testCount: 6,
          coverage: {
            lineCoverage: 88,
            branchCoverage: 85,
            functionCoverage: 90,
            statementCoverage: 89
          }
        },
        {
          filePath: 'lib/services/__tests__/service-b.test.js',
          testFramework: 'jest',
          testType: 'unit',
          testCount: 5,
          coverage: {
            lineCoverage: 92,
            branchCoverage: 90,
            functionCoverage: 95,
            statementCoverage: 93
          }
        }
      ];

      const coverageValidation = coverageValidator.validateTestCoverage({
        testChanges
      });

      expect(coverageValidation.passed).toBe(true);
      expect(coverageValidation.metrics.tests.totalTests).toBe(11);
      expect(coverageValidation.metrics.tests.filesChanged).toBe(2);
      // Average coverage: (88 + 92) / 2 = 90
      expect(coverageValidation.metrics.coverage.unit.lineCoverage).toBe(90);
    });

    test('should handle mixed test types with different standards', () => {
      const testChanges = [
        {
          filePath: 'lib/services/__tests__/unit.test.js',
          testFramework: 'jest',
          testType: 'unit',
          testCount: 10,
          coverage: {
            lineCoverage: 85, // Meets 80% unit standard
            branchCoverage: 82,
            functionCoverage: 88,
            statementCoverage: 86
          }
        },
        {
          filePath: 'lib/services/__tests__/integration.test.js',
          testFramework: 'jest',
          testType: 'integration',
          testCount: 5,
          coverage: {
            lineCoverage: 72, // Meets 70% integration standard
            branchCoverage: 68,
            functionCoverage: 75,
            statementCoverage: 73
          }
        }
      ];

      const coverageValidation = coverageValidator.validateTestCoverage({
        testChanges
      });

      expect(coverageValidation.passed).toBe(true);
      expect(coverageValidation.metrics.coverage.unit.lineCoverage).toBe(85);
      expect(coverageValidation.metrics.coverage.integration.lineCoverage).toBe(72);
      expect(coverageValidation.metrics.tests.byType.unit).toBe(10);
      expect(coverageValidation.metrics.tests.byType.integration).toBe(5);
    });

    test('should handle empty code changes gracefully', () => {
      const codeValidation = codeValidator.validateCodeChanges({
        codeChanges: [],
        affectedFiles: [],
        component: 'lib/services'
      });

      expect(codeValidation.passed).toBe(true);
      expect(codeValidation.metrics.linesAdded).toBe(0);
      expect(codeValidation.metrics.filesChanged).toBe(0);
    });

    test('should calculate complex metrics correctly', () => {
      const codeChanges = [
        {
          filePath: 'lib/services/complex.js',
          changeType: 'modified',
          linesAdded: 100,
          linesRemoved: 150, // Net negative change
          diffContent: '+ refactored code\n- removed legacy code'
        }
      ];

      const codeValidation = codeValidator.validateCodeChanges({
        codeChanges,
        affectedFiles: ['lib/services/complex.js'],
        component: 'lib/services'
      });

      expect(codeValidation.passed).toBe(true);
      expect(codeValidation.metrics.linesAdded).toBe(100);
      expect(codeValidation.metrics.linesRemoved).toBe(150);
      expect(codeValidation.metrics.netChange).toBe(-50); // Code reduced
      expect(codeValidation.metrics.totalLinesChanged).toBe(250);
    });
  });
});
