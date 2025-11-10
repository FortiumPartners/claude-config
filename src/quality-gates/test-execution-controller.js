/**
 * Sequential Test Execution Controller
 *
 * Orchestrates quality gate execution in strict sequential order with early exit on failure.
 * Executes: Security Scan → DoD Validation → Unit Tests → Integration Tests → Smoke Tests → E2E Tests
 *
 * @module test-execution-controller
 * @version 1.0.0
 */

const { performance } = require('perf_hooks');

/**
 * Quality gate execution order and configuration
 */
const QUALITY_GATES = [
  {
    id: 'security-scan',
    name: 'Security Scan',
    agent: 'code-reviewer',
    operation: 'security-scan',
    target: 180000,  // 3 minutes
    timeout: 600000, // 10 minutes
    order: 1
  },
  {
    id: 'dod-validation',
    name: 'DoD Validation',
    agent: 'code-reviewer',
    operation: 'dod-validation',
    target: 120000,  // 2 minutes
    timeout: 600000, // 10 minutes
    order: 2
  },
  {
    id: 'unit-tests',
    name: 'Unit Tests',
    agent: 'test-runner',
    operation: 'unit-tests',
    target: 300000,  // 5 minutes
    timeout: 900000, // 15 minutes
    order: 3
  },
  {
    id: 'integration-tests',
    name: 'Integration Tests',
    agent: 'test-runner',
    operation: 'integration-tests',
    target: 300000,  // 5 minutes
    timeout: 900000, // 15 minutes
    order: 4
  },
  {
    id: 'pre-release-smoke-tests',
    name: 'Pre-Release Smoke Tests',
    skill: 'smoke-test-runner',
    operation: 'pre-release',
    target: 180000,  // 3 minutes
    timeout: 300000, // 5 minutes
    order: 5
  },
  {
    id: 'e2e-tests',
    name: 'E2E Tests',
    agent: 'playwright-tester',
    operation: 'e2e-tests',
    target: 300000,  // 5 minutes
    timeout: 600000, // 10 minutes
    order: 6
  }
];

/**
 * Sequential Test Execution Controller
 */
class TestExecutionController {
  constructor(config = {}) {
    this.config = config;
    this.results = [];
    this.totalDuration = 0;
    this.currentGate = null;
  }

  /**
   * Execute all quality gates in sequential order
   *
   * @param {Object} context - Execution context (branch, version, etc.)
   * @returns {Promise<Object>} Execution results
   */
  async executeAll(context) {
    console.log('🚀 Starting quality gate execution...');
    console.log(`📦 Release: ${context.version}`);
    console.log(`🌿 Branch: ${context.branch}`);
    console.log('');

    const startTime = performance.now();

    for (const gate of QUALITY_GATES) {
      this.currentGate = gate;

      console.log(`[${gate.order}/6] Executing ${gate.name}...`);

      const result = await this.executeGate(gate, context);
      this.results.push(result);

      // Display result
      if (result.passed) {
        console.log(`✅ ${gate.name} passed (${result.duration}ms)`);
      } else {
        console.log(`❌ ${gate.name} failed (${result.duration}ms)`);
        console.log(`   Reason: ${result.reason}`);
      }
      console.log('');

      // Early exit on failure
      if (!result.passed) {
        const totalDuration = performance.now() - startTime;
        return this.buildFailureResult(gate, result, totalDuration);
      }
    }

    const totalDuration = performance.now() - startTime;
    return this.buildSuccessResult(totalDuration);
  }

  /**
   * Execute a single quality gate
   *
   * @param {Object} gate - Gate configuration
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Gate execution result
   */
  async executeGate(gate, context) {
    const startTime = performance.now();

    try {
      let result;

      // Execute via agent or skill
      if (gate.agent) {
        result = await this.executeViaAgent(gate, context);
      } else if (gate.skill) {
        result = await this.executeViaSkill(gate, context);
      } else {
        throw new Error(`Gate ${gate.id} has no agent or skill defined`);
      }

      const duration = performance.now() - startTime;

      // Check if execution exceeded target
      if (duration > gate.target) {
        console.warn(`⚠️  ${gate.name} exceeded target (${duration}ms > ${gate.target}ms)`);
      }

      return {
        gate: gate.id,
        name: gate.name,
        passed: result.passed,
        duration: Math.round(duration),
        target: gate.target,
        details: result.details,
        reason: result.reason,
        metrics: result.metrics
      };

    } catch (error) {
      const duration = performance.now() - startTime;

      return {
        gate: gate.id,
        name: gate.name,
        passed: false,
        duration: Math.round(duration),
        target: gate.target,
        reason: error.message,
        error: error.stack
      };
    }
  }

  /**
   * Execute gate via Task delegation to agent
   *
   * @param {Object} gate - Gate configuration
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Agent execution result
   */
  async executeViaAgent(gate, context) {
    // This would use the Task tool to delegate to the specified agent
    // For now, return a mock structure

    const prompt = this.buildAgentPrompt(gate, context);

    // Mock agent execution (in production, this would use Task tool)
    console.log(`   Delegating to @${gate.agent}...`);

    // Simulate agent execution
    return {
      passed: true, // Would come from agent response
      details: `Executed ${gate.operation} via ${gate.agent}`,
      metrics: {
        // Agent-specific metrics would be returned here
      }
    };
  }

  /**
   * Execute gate via Skill invocation
   *
   * @param {Object} gate - Gate configuration
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Skill execution result
   */
  async executeViaSkill(gate, context) {
    // This would use the Skill tool to invoke the specified skill
    // For now, return a mock structure

    console.log(`   Invoking skill: ${gate.skill}...`);

    // Mock skill execution (in production, this would use Skill tool)
    return {
      passed: true, // Would come from skill response
      details: `Executed ${gate.operation} via ${gate.skill} skill`,
      metrics: {
        // Skill-specific metrics would be returned here
      }
    };
  }

  /**
   * Build agent prompt for Task delegation
   *
   * @param {Object} gate - Gate configuration
   * @param {Object} context - Execution context
   * @returns {string} Agent prompt
   */
  buildAgentPrompt(gate, context) {
    const prompts = {
      'security-scan': `Execute comprehensive security scan for release ${context.version}:
- Scan branch: ${context.branch}
- Target: OWASP Top 10 vulnerabilities
- Fail on: Critical or high-severity issues
- Target completion: ${gate.target}ms

Return scan results with severity breakdown and any blocking issues.`,

      'dod-validation': `Execute Definition of Done validation for release ${context.version}:
- Validate all 8 DoD categories
- Check test coverage targets (unit ≥80%, integration ≥70%)
- Verify documentation updated
- Target completion: ${gate.target}ms

Return validation results with category-by-category status.`,

      'unit-tests': `Execute unit test suite for release ${context.version}:
- Branch: ${context.branch}
- Coverage target: ≥80%
- Fail on: Test failures or coverage below threshold
- Target completion: ${gate.target}ms

Return test results with pass/fail counts and coverage metrics.`,

      'integration-tests': `Execute integration test suite for release ${context.version}:
- Branch: ${context.branch}
- Coverage target: ≥70%
- Fail on: Test failures or coverage below threshold
- Target completion: ${gate.target}ms

Return test results with pass/fail counts and coverage metrics.`,

      'e2e-tests': `Execute E2E test suite for release ${context.version}:
- Environment: staging
- Test critical user journeys
- Capture trace artifacts
- Target completion: ${gate.target}ms

Return journey results with pass/fail status and trace artifacts.`
    };

    return prompts[gate.operation] || `Execute ${gate.operation} for release ${context.version}`;
  }

  /**
   * Build success result
   *
   * @param {number} totalDuration - Total execution time
   * @returns {Object} Success result
   */
  buildSuccessResult(totalDuration) {
    const targetTotal = QUALITY_GATES.reduce((sum, gate) => sum + gate.target, 0);

    return {
      status: 'success',
      passed: true,
      totalDuration: Math.round(totalDuration),
      targetDuration: targetTotal,
      gatesExecuted: this.results.length,
      gatesPassed: this.results.length,
      gatesFailed: 0,
      results: this.results,
      summary: {
        securityScan: this.findResult('security-scan'),
        dodValidation: this.findResult('dod-validation'),
        unitTests: this.findResult('unit-tests'),
        integrationTests: this.findResult('integration-tests'),
        smokeTests: this.findResult('pre-release-smoke-tests'),
        e2eTests: this.findResult('e2e-tests')
      }
    };
  }

  /**
   * Build failure result
   *
   * @param {Object} failedGate - Gate that failed
   * @param {Object} failedResult - Failed gate result
   * @param {number} totalDuration - Total execution time
   * @returns {Object} Failure result
   */
  buildFailureResult(failedGate, failedResult, totalDuration) {
    return {
      status: 'failure',
      passed: false,
      failedGate: failedGate.id,
      failedGateName: failedGate.name,
      failureReason: failedResult.reason,
      totalDuration: Math.round(totalDuration),
      gatesExecuted: this.results.length,
      gatesPassed: this.results.length - 1,
      gatesFailed: 1,
      results: this.results,
      summary: {
        securityScan: this.findResult('security-scan'),
        dodValidation: this.findResult('dod-validation'),
        unitTests: this.findResult('unit-tests'),
        integrationTests: this.findResult('integration-tests'),
        smokeTests: this.findResult('pre-release-smoke-tests'),
        e2eTests: this.findResult('e2e-tests')
      },
      nextSteps: this.suggestNextSteps(failedGate, failedResult)
    };
  }

  /**
   * Find result for specific gate
   *
   * @param {string} gateId - Gate ID
   * @returns {Object|null} Gate result or null
   */
  findResult(gateId) {
    return this.results.find(r => r.gate === gateId) || null;
  }

  /**
   * Suggest next steps based on failed gate
   *
   * @param {Object} failedGate - Gate that failed
   * @param {Object} failedResult - Failed gate result
   * @returns {Array<string>} Suggested next steps
   */
  suggestNextSteps(failedGate, failedResult) {
    const suggestions = {
      'security-scan': [
        'Review security scan report for vulnerability details',
        'Apply suggested fixes for critical/high severity issues',
        'Re-run security scan after fixes applied',
        'Consider security consultation for complex vulnerabilities'
      ],
      'dod-validation': [
        'Review DoD validation report for failed categories',
        'Complete missing DoD requirements',
        'Update documentation if required',
        'Re-run DoD validation after fixes applied'
      ],
      'unit-tests': [
        'Review unit test failure report with file locations',
        'Fix failing tests or implementation bugs',
        'Add tests for uncovered modules if coverage below 80%',
        'Re-run unit tests after fixes applied'
      ],
      'integration-tests': [
        'Review integration test failure report',
        'Fix failing tests or service integration issues',
        'Add tests for uncovered workflows if coverage below 70%',
        'Re-run integration tests after fixes applied'
      ],
      'pre-release-smoke-tests': [
        'Review smoke test report for failed category',
        'Fix deployment issues or configuration problems',
        'Verify environment-specific settings',
        'Re-run smoke tests after fixes applied'
      ],
      'e2e-tests': [
        'Review E2E test failure report and trace artifacts',
        'Fix UI bugs or backend issues',
        'Verify staging environment is healthy',
        'Re-run E2E tests after fixes applied'
      ]
    };

    return suggestions[failedGate.id] || [
      'Review failure details and logs',
      'Apply necessary fixes',
      'Re-run failed quality gate'
    ];
  }

  /**
   * Get progress information
   *
   * @returns {Object} Current progress
   */
  getProgress() {
    return {
      currentGate: this.currentGate ? this.currentGate.name : null,
      gatesCompleted: this.results.length,
      gatesTotal: QUALITY_GATES.length,
      percentComplete: Math.round((this.results.length / QUALITY_GATES.length) * 100),
      results: this.results
    };
  }
}

/**
 * Export controller and configuration
 */
module.exports = {
  TestExecutionController,
  QUALITY_GATES
};

/**
 * CLI usage example:
 *
 * const controller = new TestExecutionController();
 * const result = await controller.executeAll({
 *   version: '2.1.0',
 *   branch: 'release/v2.1.0',
 *   environment: 'pre-release'
 * });
 *
 * if (result.passed) {
 *   console.log('✅ All quality gates passed!');
 *   console.log(`Total time: ${result.totalDuration}ms`);
 * } else {
 *   console.error(`❌ Quality gate failed: ${result.failedGateName}`);
 *   console.error(`Reason: ${result.failureReason}`);
 *   console.log('Next steps:', result.nextSteps);
 * }
 */
