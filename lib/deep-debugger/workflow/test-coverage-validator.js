/**
 * Test Coverage Validation Module
 *
 * Validates test coverage from specialist agents to ensure quality standards.
 *
 * Responsibilities:
 * - Parse TestDiff and CoverageReport from specialist
 * - Validate coverage maintained or improved (never decreased)
 * - Check unit coverage ≥80%, integration ≥70%
 * - Reject fix if coverage regresses
 * - Document coverage impact in session metrics
 *
 * Coverage Standards:
 * - Unit tests: ≥80% line coverage required
 * - Integration tests: ≥70% line coverage required
 * - No regression allowed (coverage must not decrease)
 * - Branch coverage tracked for quality insights
 * - Function coverage tracked for completeness
 *
 * @module lib/deep-debugger/workflow/test-coverage-validator
 */

class TestCoverageValidator {
  /**
   * Create test coverage validator
   *
   * @param {Object} options - Configuration options
   * @param {number} [options.minUnitCoverage=80] - Minimum unit test coverage %
   * @param {number} [options.minIntegrationCoverage=70] - Minimum integration test coverage %
   * @param {boolean} [options.allowRegression=false] - Allow coverage regression
   * @param {number} [options.minBranchCoverage=70] - Minimum branch coverage %
   * @param {Function} [options.logger] - Logging function
   */
  constructor(options = {}) {
    this.minUnitCoverage = options.minUnitCoverage || 80;
    this.minIntegrationCoverage = options.minIntegrationCoverage || 70;
    this.allowRegression = options.allowRegression || false;
    this.minBranchCoverage = options.minBranchCoverage || 70;
    this.logger = options.logger || console.log;

    // Test frameworks supported
    this.supportedFrameworks = ['jest', 'pytest', 'rspec', 'xunit', 'mocha', 'vitest'];

    // Test types
    this.testTypes = ['unit', 'integration', 'e2e'];
  }

  /**
   * Validate test coverage from specialist
   *
   * @param {Object} context - Validation context
   * @param {Object[]} context.testChanges - Array of TestDiff objects
   * @param {Object} [context.baselineCoverage] - Baseline coverage before fix
   * @param {boolean} [context.requireNewTests=true] - Require new tests for fix
   * @returns {Object} Validation result
   */
  validateTestCoverage(context) {
    this.validateContext(context);

    const { testChanges, baselineCoverage, requireNewTests } = context;

    this.logger('\n[Test Coverage Validation] Starting validation...');
    this.logger(`  Test changes: ${testChanges.length}`);

    const validation = {
      passed: true,
      checks: {},
      warnings: [],
      metrics: {},
      failureReason: null
    };

    // Check 1: Parse all test changes
    validation.checks.allTestsParseable = true;
    const parsedTests = [];

    for (const testChange of testChanges) {
      try {
        const parsed = this.parseTestChange(testChange);
        parsedTests.push(parsed);
      } catch (error) {
        validation.checks.allTestsParseable = false;
        validation.passed = false;
        validation.failureReason = `Failed to parse test change: ${error.message}`;
        return validation;
      }
    }

    // Check 2: New tests added (if required)
    if (requireNewTests !== false) {
      validation.checks.newTestsAdded = parsedTests.length > 0;

      if (!validation.checks.newTestsAdded) {
        validation.warnings.push('No new tests added for fix');
        // Not a failure for simple fixes, but noted
      }
    }

    // Check 3: Valid test frameworks
    validation.checks.validFrameworks = parsedTests.every(
      test => this.supportedFrameworks.includes(test.testFramework)
    );

    if (!validation.checks.validFrameworks) {
      validation.warnings.push('Some tests use unsupported frameworks');
    }

    // Check 4: Calculate test metrics
    const testMetrics = this.calculateTestMetrics(parsedTests);
    validation.metrics.tests = testMetrics;

    // Check 5: Validate coverage standards
    const coverageValidation = this.validateCoverageStandards(parsedTests);

    validation.checks.coverageStandardsMet = coverageValidation.passed;
    validation.metrics.coverage = coverageValidation.metrics;
    validation.warnings.push(...coverageValidation.warnings);

    if (!coverageValidation.passed) {
      validation.passed = false;
      validation.failureReason = coverageValidation.failureReason;
      return validation;
    }

    // Check 6: Validate no coverage regression
    if (baselineCoverage && !this.allowRegression) {
      const regressionCheck = this.checkCoverageRegression(
        coverageValidation.metrics,
        baselineCoverage
      );

      validation.checks.noCoverageRegression = regressionCheck.passed;

      if (!regressionCheck.passed) {
        validation.passed = false;
        validation.failureReason = regressionCheck.failureReason;
        validation.metrics.regression = regressionCheck.regression;
        return validation;
      }
    }

    // Check 7: Calculate coverage impact
    validation.metrics.impact = this.calculateCoverageImpact(
      coverageValidation.metrics,
      baselineCoverage
    );

    this.logger('[Test Coverage Validation] ✅ Validation passed');
    this.logger(`  Total tests: ${testMetrics.totalTests}`);
    this.logger(`  Unit coverage: ${coverageValidation.metrics.unit.lineCoverage}%`);
    this.logger(`  Integration coverage: ${coverageValidation.metrics.integration.lineCoverage}%`);

    return validation;
  }

  /**
   * Parse single test change
   *
   * @param {Object} testChange - TestDiff object
   * @returns {Object} Parsed test change
   * @private
   */
  parseTestChange(testChange) {
    if (!testChange.filePath) {
      throw new Error('TestDiff missing filePath');
    }

    if (!testChange.testFramework) {
      throw new Error(`TestDiff for ${testChange.filePath} missing testFramework`);
    }

    if (!testChange.testType) {
      throw new Error(`TestDiff for ${testChange.filePath} missing testType`);
    }

    if (!testChange.coverage) {
      throw new Error(`TestDiff for ${testChange.filePath} missing coverage`);
    }

    return {
      filePath: String(testChange.filePath),
      testFramework: String(testChange.testFramework),
      testType: String(testChange.testType),
      testCount: Number(testChange.testCount) || 0,
      coverage: this.parseCoverageReport(testChange.coverage)
    };
  }

  /**
   * Parse coverage report
   *
   * @param {Object} coverage - CoverageReport object
   * @returns {Object} Parsed coverage
   * @private
   */
  parseCoverageReport(coverage) {
    return {
      lineCoverage: Number(coverage.lineCoverage) || 0,
      branchCoverage: Number(coverage.branchCoverage) || 0,
      functionCoverage: Number(coverage.functionCoverage) || 0,
      statementCoverage: Number(coverage.statementCoverage) || 0
    };
  }

  /**
   * Calculate test metrics
   *
   * @param {Object[]} tests - Parsed test changes
   * @returns {Object} Test metrics
   * @private
   */
  calculateTestMetrics(tests) {
    const metrics = {
      totalTests: 0,
      byType: {
        unit: 0,
        integration: 0,
        e2e: 0
      },
      byFramework: {},
      filesChanged: tests.length
    };

    for (const test of tests) {
      metrics.totalTests += test.testCount;
      metrics.byType[test.testType] = (metrics.byType[test.testType] || 0) + test.testCount;
      metrics.byFramework[test.testFramework] = (metrics.byFramework[test.testFramework] || 0) + 1;
    }

    return metrics;
  }

  /**
   * Validate coverage meets standards
   *
   * @param {Object[]} tests - Parsed test changes
   * @returns {Object} Coverage validation result
   * @private
   */
  validateCoverageStandards(tests) {
    const result = {
      passed: true,
      metrics: {
        unit: { lineCoverage: 0, branchCoverage: 0, functionCoverage: 0, statementCoverage: 0 },
        integration: { lineCoverage: 0, branchCoverage: 0, functionCoverage: 0, statementCoverage: 0 },
        e2e: { lineCoverage: 0, branchCoverage: 0, functionCoverage: 0, statementCoverage: 0 }
      },
      warnings: [],
      failureReason: null
    };

    // Aggregate coverage by test type
    const typeGroups = { unit: [], integration: [], e2e: [] };

    for (const test of tests) {
      if (typeGroups[test.testType]) {
        typeGroups[test.testType].push(test.coverage);
      }
    }

    // Calculate average coverage for each type
    for (const [type, coverages] of Object.entries(typeGroups)) {
      if (coverages.length > 0) {
        result.metrics[type] = this.averageCoverage(coverages);
      }
    }

    // Validate unit test coverage
    if (result.metrics.unit.lineCoverage > 0) {
      if (result.metrics.unit.lineCoverage < this.minUnitCoverage) {
        result.passed = false;
        result.failureReason = `Unit test coverage ${result.metrics.unit.lineCoverage}% below minimum ${this.minUnitCoverage}%`;
        return result;
      }
    } else {
      result.warnings.push('No unit test coverage data available');
    }

    // Validate integration test coverage
    if (result.metrics.integration.lineCoverage > 0) {
      if (result.metrics.integration.lineCoverage < this.minIntegrationCoverage) {
        result.passed = false;
        result.failureReason = `Integration test coverage ${result.metrics.integration.lineCoverage}% below minimum ${this.minIntegrationCoverage}%`;
        return result;
      }
    }

    // Validate branch coverage (warning if below minimum)
    for (const [type, metrics] of Object.entries(result.metrics)) {
      if (metrics.branchCoverage > 0 && metrics.branchCoverage < this.minBranchCoverage) {
        result.warnings.push(
          `${type} branch coverage ${metrics.branchCoverage}% below recommended ${this.minBranchCoverage}%`
        );
      }
    }

    return result;
  }

  /**
   * Average coverage across multiple reports
   *
   * @param {Object[]} coverages - Coverage reports
   * @returns {Object} Average coverage
   * @private
   */
  averageCoverage(coverages) {
    const sum = {
      lineCoverage: 0,
      branchCoverage: 0,
      functionCoverage: 0,
      statementCoverage: 0
    };

    for (const coverage of coverages) {
      sum.lineCoverage += coverage.lineCoverage;
      sum.branchCoverage += coverage.branchCoverage;
      sum.functionCoverage += coverage.functionCoverage;
      sum.statementCoverage += coverage.statementCoverage;
    }

    const count = coverages.length;

    return {
      lineCoverage: Math.round(sum.lineCoverage / count * 10) / 10,
      branchCoverage: Math.round(sum.branchCoverage / count * 10) / 10,
      functionCoverage: Math.round(sum.functionCoverage / count * 10) / 10,
      statementCoverage: Math.round(sum.statementCoverage / count * 10) / 10
    };
  }

  /**
   * Check for coverage regression
   *
   * @param {Object} currentCoverage - Current coverage metrics
   * @param {Object} baselineCoverage - Baseline coverage metrics
   * @returns {Object} Regression check result
   * @private
   */
  checkCoverageRegression(currentCoverage, baselineCoverage) {
    const result = {
      passed: true,
      regression: {},
      failureReason: null
    };

    for (const type of ['unit', 'integration']) {
      if (baselineCoverage[type]?.lineCoverage > 0) {
        const current = currentCoverage[type].lineCoverage;
        const baseline = baselineCoverage[type].lineCoverage;
        const change = current - baseline;

        result.regression[type] = {
          current,
          baseline,
          change,
          regressed: change < 0
        };

        if (change < 0) {
          result.passed = false;
          result.failureReason = `${type} coverage regressed from ${baseline}% to ${current}% (${change}%)`;
          return result;
        }
      }
    }

    return result;
  }

  /**
   * Calculate coverage impact
   *
   * @param {Object} currentCoverage - Current coverage metrics
   * @param {Object} baselineCoverage - Baseline coverage metrics
   * @returns {Object} Coverage impact summary
   * @private
   */
  calculateCoverageImpact(currentCoverage, baselineCoverage) {
    if (!baselineCoverage) {
      return {
        hasBaseline: false,
        message: 'No baseline coverage available for comparison'
      };
    }

    const impact = {
      hasBaseline: true,
      byType: {}
    };

    for (const type of ['unit', 'integration']) {
      if (baselineCoverage[type]?.lineCoverage > 0) {
        const current = currentCoverage[type].lineCoverage;
        const baseline = baselineCoverage[type].lineCoverage;
        const change = current - baseline;
        const percentChange = ((change / baseline) * 100).toFixed(1);

        impact.byType[type] = {
          current,
          baseline,
          change: Number(change.toFixed(1)),
          percentChange: Number(percentChange),
          improved: change > 0,
          maintained: change === 0,
          regressed: change < 0
        };
      }
    }

    return impact;
  }

  /**
   * Validate context
   *
   * @param {Object} context - Context to validate
   * @throws {Error} If context invalid
   * @private
   */
  validateContext(context) {
    if (!context) {
      throw new Error('Validation context is required');
    }

    if (!Array.isArray(context.testChanges)) {
      throw new Error('testChanges must be an array');
    }
  }

  /**
   * Build coverage report
   *
   * @param {Object} validation - Validation result
   * @returns {string} Formatted coverage report
   */
  buildCoverageReport(validation) {
    const lines = [];

    lines.push('## Test Coverage Report\n');

    if (validation.passed) {
      lines.push('✅ **Coverage Standards Met**\n');
    } else {
      lines.push(`❌ **Coverage Validation Failed**: ${validation.failureReason}\n`);
    }

    // Test metrics
    const testMetrics = validation.metrics.tests;
    lines.push('### Test Metrics');
    lines.push(`- Total Tests: ${testMetrics.totalTests}`);
    lines.push(`- Unit Tests: ${testMetrics.byType.unit}`);
    lines.push(`- Integration Tests: ${testMetrics.byType.integration}`);
    lines.push(`- E2E Tests: ${testMetrics.byType.e2e}`);
    lines.push('');

    // Coverage by type
    const coverage = validation.metrics.coverage;
    lines.push('### Coverage by Type');

    for (const [type, metrics] of Object.entries(coverage)) {
      if (metrics.lineCoverage > 0) {
        const standard = type === 'unit' ? this.minUnitCoverage : this.minIntegrationCoverage;
        const status = metrics.lineCoverage >= standard ? '✅' : '⚠️';

        lines.push(`\n**${type.toUpperCase()}** ${status}`);
        lines.push(`- Line Coverage: ${metrics.lineCoverage}% (min: ${standard}%)`);
        lines.push(`- Branch Coverage: ${metrics.branchCoverage}%`);
        lines.push(`- Function Coverage: ${metrics.functionCoverage}%`);
        lines.push(`- Statement Coverage: ${metrics.statementCoverage}%`);
      }
    }

    // Coverage impact
    if (validation.metrics.impact?.hasBaseline) {
      lines.push('\n### Coverage Impact');

      for (const [type, impact] of Object.entries(validation.metrics.impact.byType)) {
        const arrow = impact.change > 0 ? '↑' : impact.change < 0 ? '↓' : '→';
        const emoji = impact.improved ? '📈' : impact.maintained ? '➡️' : '📉';

        lines.push(`- **${type}**: ${impact.baseline}% ${arrow} ${impact.current}% (${impact.change >= 0 ? '+' : ''}${impact.change}%) ${emoji}`);
      }
    }

    // Warnings
    if (validation.warnings.length > 0) {
      lines.push('\n### Warnings');
      validation.warnings.forEach(warning => {
        lines.push(`- ⚠️  ${warning}`);
      });
    }

    return lines.join('\n');
  }
}

module.exports = TestCoverageValidator;
