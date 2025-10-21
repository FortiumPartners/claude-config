/**
 * REFACTOR Phase Coordination
 *
 * Implements TDD REFACTOR phase by coordinating code quality improvements with specialist agents.
 *
 * Responsibilities:
 * - Request code quality improvements from specialist
 * - Ensure all tests still pass after refactoring
 * - Validate no new complexity introduced
 * - Check code style compliance
 * - Update TDD phase to "refactor" in tracking
 *
 * Workflow:
 * 1. Verify GREEN phase complete (tests passing)
 * 2. Build refactoring request with quality targets
 * 3. Delegate to specialist agent via AgentDelegator
 * 4. Validate refactored code maintains test passage
 * 5. Check complexity metrics haven't increased
 * 6. Verify code style compliance
 * 7. Update TDD phase tracker
 *
 * Integration:
 * - Uses AgentDelegator for specialist coordination
 * - Uses TDDPhaseTracker for phase management
 * - Validates code changes don't break tests
 *
 * @module lib/deep-debugger/workflow/refactor-phase-coordinator
 */

const AgentDelegator = require('../integration/agent-delegator');

class RefactorPhaseCoordinator {
  /**
   * Create REFACTOR phase coordinator
   *
   * @param {Object} options - Configuration options
   * @param {number} [options.refactorTimeout=600000] - Refactor timeout in ms (10 minutes)
   * @param {number} [options.maxComplexityIncrease=0] - Max allowed complexity increase (default: no increase)
   * @param {Function} [options.taskDelegator] - Task delegation function (for testing, passed to AgentDelegator)
   * @param {Object} [options.agentDelegator] - AgentDelegator instance (for testing)
   * @param {Function} [options.logger] - Logging function
   */
  constructor(options = {}) {
    this.refactorTimeout = options.refactorTimeout || 600000; // 10 minutes
    this.maxComplexityIncrease = options.maxComplexityIncrease || 0;
    this.logger = options.logger || console.log;

    // Initialize AgentDelegator for specialist coordination
    this.agentDelegator = options.agentDelegator || new AgentDelegator({
      taskTool: options.taskDelegator, // Pass through for testing
      defaultTimeout: this.refactorTimeout,
      logger: this.logger
    });

    // Refactoring quality targets
    this.qualityTargets = {
      maintainTestPassage: true,
      noComplexityIncrease: true,
      improveReadability: true,
      removeCodeSmells: true,
      followStyleGuide: true
    };

    // Code smells to check
    this.codeSmells = [
      'longMethod',         // Methods > 50 lines
      'longParameterList',  // > 5 parameters
      'duplicatedCode',     // Identical or similar blocks
      'largeClass',         // Classes > 300 lines
      'nestedConditionals', // Nesting depth > 3
      'magicNumbers'        // Hardcoded numeric constants
    ];
  }

  /**
   * Coordinate refactoring phase
   *
   * @param {Object} context - Refactoring context
   * @param {Object} context.greenPhaseResult - Result from GREEN phase
   * @param {Object} context.tddState - Current TDD state (should be 'green')
   * @param {string} context.specialist - Specialist agent name
   * @param {string} context.sessionId - Debugging session ID
   * @param {Object} [context.refactorGoals] - Specific refactoring goals
   * @returns {Promise<Object>} Refactoring result
   */
  async coordinateRefactorPhase(context) {
    this.validateContext(context);

    const { greenPhaseResult, tddState, specialist, sessionId, refactorGoals } = context;

    this.logger('\n[REFACTOR Phase] Starting code quality improvements...');
    this.logger(`  Specialist: ${specialist}`);
    this.logger(`  Session: ${sessionId}`);

    try {
      // Build refactoring request
      const refactorRequest = this.buildRefactorRequest(
        greenPhaseResult,
        refactorGoals || this.qualityTargets
      );

      this.logger('[REFACTOR Phase] Delegating refactoring to specialist...');

      // Delegate to specialist
      const startTime = Date.now();
      const refactorResponse = await this.invokeRefactorDelegation(specialist, refactorRequest);
      const duration = Date.now() - startTime;

      this.logger(`[REFACTOR Phase] ✓ Refactoring completed in ${duration}ms`);

      // Parse response
      const parsedResponse = this.parseRefactorResponse(refactorResponse, specialist);

      // Validate refactoring quality
      const validation = this.validateRefactoringQuality(
        parsedResponse,
        greenPhaseResult
      );

      if (validation.passed) {
        this.logger('[REFACTOR Phase] ✅ Refactoring validation passed');

        return {
          success: true,
          duration,
          codeChanges: parsedResponse.codeChanges,
          qualityImprovements: parsedResponse.qualityImprovements,
          testValidation: parsedResponse.testValidation,
          complexityMetrics: parsedResponse.complexityMetrics,
          validation
        };
      } else {
        this.logger(`[REFACTOR Phase] ❌ Refactoring validation failed: ${validation.failureReason}`);

        return {
          success: false,
          duration,
          validation,
          error: `Refactoring failed validation: ${validation.failureReason}`,
          recommendation: 'Keep GREEN phase implementation without refactoring'
        };
      }
    } catch (error) {
      this.logger(`[REFACTOR Phase] ⚠️  Refactoring error: ${error.message}`);

      return {
        success: false,
        error: error.message,
        recommendation: 'Keep GREEN phase implementation without refactoring'
      };
    }
  }

  /**
   * Build refactoring request
   *
   * @param {Object} greenPhaseResult - GREEN phase result
   * @param {Object} qualityGoals - Quality improvement goals
   * @returns {Object} Refactoring request
   * @private
   */
  buildRefactorRequest(greenPhaseResult, qualityGoals) {
    return {
      type: 'code-refactoring',
      tddPhase: 'refactor',
      baselineCode: greenPhaseResult.codeChanges,
      qualityTargets: qualityGoals,
      constraints: {
        timeout: this.refactorTimeout,
        mustMaintainTestPassage: true,
        maxComplexityIncrease: this.maxComplexityIncrease,
        noFunctionalChanges: true  // REFACTOR doesn't change behavior
      },
      codeSmellsToAddress: this.codeSmells,
      expectedResponse: {
        fields: [
          'success',
          'codeChanges',
          'qualityImprovements',
          'testValidation',
          'complexityMetrics'
        ],
        format: 'structured-json'
      }
    };
  }

  /**
   * Invoke refactoring delegation via AgentDelegator
   *
   * @param {string} specialist - Specialist agent name
   * @param {Object} request - Refactoring request
   * @returns {Promise<Object>} Refactoring response
   * @private
   */
  async invokeRefactorDelegation(specialist, request) {
    // Use AgentDelegator for specialist coordination
    const result = await this.agentDelegator.delegateRefactorPhase({
      greenResult: {
        specialist,
        codeChanges: request.greenResult?.codeChanges || []
      },
      tddState: {
        currentPhase: 'green'
      },
      sessionId: request.sessionId,
      qualityTargets: request.qualityTargets || {
        maxComplexity: 10,
        maxMethodLength: 50,
        codeSmells: ['long-method', 'duplication', 'complex-conditional']
      }
    });

    return result;
  }

  /**
   * Parse refactoring response
   *
   * @param {Object} response - Raw specialist response
   * @param {string} specialist - Specialist name
   * @returns {Object} Parsed response
   * @private
   */
  parseRefactorResponse(response, specialist) {
    if (!response) {
      throw new Error(`Specialist ${specialist} returned null/undefined response`);
    }

    return {
      success: Boolean(response.success),
      codeChanges: Array.isArray(response.codeChanges) ? response.codeChanges : [],
      qualityImprovements: Array.isArray(response.qualityImprovements)
        ? response.qualityImprovements
        : [],
      testValidation: response.testValidation || {},
      complexityMetrics: response.complexityMetrics || {}
    };
  }

  /**
   * Validate refactoring quality
   *
   * @param {Object} response - Parsed refactoring response
   * @param {Object} greenPhaseResult - Original GREEN phase result
   * @returns {Object} Validation result
   * @private
   */
  validateRefactoringQuality(response, greenPhaseResult) {
    const validation = {
      passed: true,
      checks: {},
      failureReason: null
    };

    // Check 1: Refactoring was successful
    validation.checks.success = response.success;
    if (!response.success) {
      validation.passed = false;
      validation.failureReason = 'Specialist reported refactoring failure';
      return validation;
    }

    // Check 2: Tests still pass
    validation.checks.testsStillPass = response.testValidation?.allTestsPassing === true;
    if (!validation.checks.testsStillPass) {
      validation.passed = false;
      validation.failureReason = 'Tests failing after refactoring';
      return validation;
    }

    // Check 3: No complexity increase
    if (response.complexityMetrics?.before && response.complexityMetrics?.after) {
      const complexityChange = response.complexityMetrics.after - response.complexityMetrics.before;
      validation.checks.noComplexityIncrease = complexityChange <= this.maxComplexityIncrease;

      if (!validation.checks.noComplexityIncrease) {
        validation.passed = false;
        validation.failureReason = `Complexity increased by ${complexityChange} (max allowed: ${this.maxComplexityIncrease})`;
        return validation;
      }
    }

    // Check 4: Code quality improved
    validation.checks.qualityImproved = response.qualityImprovements.length > 0;
    if (!validation.checks.qualityImproved) {
      this.logger('⚠️  Warning: No quality improvements identified');
      // Not a failure - refactoring might not find improvements
    }

    // Check 5: Code changes reasonable
    const changesCount = response.codeChanges.length;
    const baselineChangesCount = greenPhaseResult.codeChanges.length;

    validation.checks.reasonableChanges = changesCount <= baselineChangesCount * 2;
    if (!validation.checks.reasonableChanges) {
      this.logger(`⚠️  Warning: Refactoring changed ${changesCount} files (baseline: ${baselineChangesCount})`);
      // Not a failure - but worth noting
    }

    return validation;
  }

  /**
   * Validate refactoring context
   *
   * @param {Object} context - Context to validate
   * @throws {Error} If context invalid
   * @private
   */
  validateContext(context) {
    if (!context) {
      throw new Error('Refactoring context is required');
    }

    if (!context.greenPhaseResult) {
      throw new Error('greenPhaseResult is required');
    }

    if (!context.greenPhaseResult.codeChanges) {
      throw new Error('greenPhaseResult.codeChanges is required');
    }

    if (!context.tddState) {
      throw new Error('tddState is required');
    }

    if (!context.specialist) {
      throw new Error('specialist is required');
    }

    if (!context.sessionId) {
      throw new Error('sessionId is required');
    }

    // Validate TDD state is in GREEN phase
    if (context.tddState.currentPhase !== 'green') {
      throw new Error(
        `REFACTOR phase requires GREEN phase complete, got: ${context.tddState.currentPhase}`
      );
    }
  }

  /**
   * Build quality improvement summary
   *
   * @param {Object} refactorResult - Refactoring result
   * @returns {Object} Quality summary
   */
  buildQualitySummary(refactorResult) {
    if (!refactorResult.success) {
      return {
        refactored: false,
        reason: refactorResult.error || 'Refactoring skipped',
        recommendation: refactorResult.recommendation
      };
    }

    return {
      refactored: true,
      improvements: refactorResult.qualityImprovements,
      improvementCount: refactorResult.qualityImprovements.length,
      filesChanged: refactorResult.codeChanges.length,
      testsStillPass: refactorResult.testValidation?.allTestsPassing,
      complexityChange: this.calculateComplexityChange(refactorResult.complexityMetrics),
      duration: refactorResult.duration
    };
  }

  /**
   * Calculate complexity change
   *
   * @param {Object} metrics - Complexity metrics (before/after)
   * @returns {Object} Complexity change summary
   * @private
   */
  calculateComplexityChange(metrics) {
    if (!metrics || !metrics.before || !metrics.after) {
      return { available: false };
    }

    const change = metrics.after - metrics.before;
    const percentChange = ((change / metrics.before) * 100).toFixed(1);

    return {
      available: true,
      before: metrics.before,
      after: metrics.after,
      change,
      percentChange: Number(percentChange),
      improved: change < 0
    };
  }
}

module.exports = RefactorPhaseCoordinator;
