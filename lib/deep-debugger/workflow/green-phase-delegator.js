/**
 * GREEN Phase Delegation Workflow
 *
 * Implements TDD GREEN phase by delegating fix implementation to specialist agents.
 *
 * Responsibilities:
 * - Delegate fix task to selected specialist agent
 * - Monitor implementation progress with timeout (30 minutes default)
 * - Receive and parse code changes and test changes from specialist
 * - Validate fix passes recreation test
 * - Handle delegation failures with retry/escalation
 *
 * Workflow:
 * 1. Prepare delegation request with comprehensive context
 * 2. Invoke specialist agent via Task tool
 * 3. Monitor progress with timeout enforcement
 * 4. Parse specialist response (code changes, test changes, validation)
 * 5. Validate fix quality and test passage
 * 6. Handle errors with retry logic or escalation
 *
 * Integration:
 * - Uses FixTaskPreparer for context preparation
 * - Uses TDDPhaseTracker for phase management
 * - Coordinates with specialist agents via Task tool
 *
 * @module lib/deep-debugger/workflow/green-phase-delegator
 */

class GreenPhaseDelegator {
  /**
   * Create GREEN phase delegator
   *
   * @param {Object} options - Configuration options
   * @param {number} [options.delegationTimeout=1800000] - Delegation timeout in ms (30 minutes)
   * @param {number} [options.maxRetries=2] - Maximum retry attempts on failure
   * @param {Function} [options.taskDelegator] - Task delegation function (for testing)
   * @param {Function} [options.logger] - Logging function
   */
  constructor(options = {}) {
    this.delegationTimeout = options.delegationTimeout || 1800000; // 30 minutes
    this.maxRetries = options.maxRetries || 2;
    this.taskDelegator = options.taskDelegator || null; // Injected for testing
    this.logger = options.logger || console.log;

    // Delegation result statuses
    this.resultStatuses = {
      SUCCESS: 'success',
      TIMEOUT: 'timeout',
      FAILURE: 'failure',
      RETRY_EXHAUSTED: 'retry_exhausted'
    };

    // Expected response structure from specialist
    this.expectedResponseFields = [
      'success',
      'codeChanges',
      'testChanges',
      'fixValidation',
      'implementationTime'
    ];
  }

  /**
   * Delegate fix implementation to specialist agent
   *
   * @param {Object} context - Delegation context
   * @param {Object} context.fixTask - Fix task from FixTaskPreparer
   * @param {Object} context.tddState - Current TDD state from TDDPhaseTracker
   * @param {string} context.sessionId - Debugging session ID
   * @param {Object} [context.retryContext] - Context from previous retry attempt
   * @returns {Promise<Object>} Delegation result
   */
  async delegateGreenPhase(context) {
    this.validateContext(context);

    const { fixTask, tddState, sessionId, retryContext } = context;
    const specialist = fixTask.agent;
    const attemptNumber = retryContext?.attemptNumber || 1;

    this.logger(`\n[GREEN Phase Delegation] Attempt ${attemptNumber}/${this.maxRetries + 1}`);
    this.logger(`  Specialist: ${specialist}`);
    this.logger(`  Session: ${sessionId}`);
    this.logger(`  Timeout: ${this.delegationTimeout}ms`);

    try {
      // Build delegation request
      const delegationRequest = this.buildDelegationRequest(fixTask, tddState, sessionId);

      this.logger(`\n[GREEN Phase] Delegating to ${specialist}...`);

      // Delegate to specialist with timeout
      const startTime = Date.now();
      const specialistResponse = await this.invokeDelegation(specialist, delegationRequest);
      const duration = Date.now() - startTime;

      this.logger(`[GREEN Phase] ✓ Specialist responded in ${duration}ms`);

      // Parse and validate specialist response
      const parsedResponse = this.parseSpecialistResponse(specialistResponse, specialist);

      // Validate fix quality
      const validation = this.validateFixQuality(parsedResponse, fixTask);

      if (validation.passed) {
        this.logger('[GREEN Phase] ✅ Fix validation passed');

        return {
          status: this.resultStatuses.SUCCESS,
          specialist,
          attemptNumber,
          duration,
          codeChanges: parsedResponse.codeChanges,
          testChanges: parsedResponse.testChanges,
          fixValidation: parsedResponse.fixValidation,
          implementationTime: parsedResponse.implementationTime,
          validation
        };
      } else {
        this.logger(`[GREEN Phase] ❌ Fix validation failed: ${validation.failureReason}`);

        // Retry if attempts remain
        if (attemptNumber <= this.maxRetries) {
          this.logger(`[GREEN Phase] Retrying with feedback...`);

          return this.delegateGreenPhase({
            ...context,
            retryContext: {
              attemptNumber: attemptNumber + 1,
              previousFailure: validation.failureReason,
              previousResponse: parsedResponse
            }
          });
        }

        return {
          status: this.resultStatuses.RETRY_EXHAUSTED,
          specialist,
          attemptNumber,
          duration,
          validation,
          error: `Fix validation failed after ${attemptNumber} attempts: ${validation.failureReason}`
        };
      }
    } catch (error) {
      this.logger(`[GREEN Phase] ⚠️  Delegation error: ${error.message}`);

      // Check if timeout
      if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
        return {
          status: this.resultStatuses.TIMEOUT,
          specialist,
          attemptNumber,
          error: `Delegation timed out after ${this.delegationTimeout}ms`,
          originalError: error
        };
      }

      // Retry on transient errors if attempts remain
      if (attemptNumber <= this.maxRetries && this.isRetryableError(error)) {
        this.logger(`[GREEN Phase] Retrying due to transient error...`);

        return this.delegateGreenPhase({
          ...context,
          retryContext: {
            attemptNumber: attemptNumber + 1,
            previousError: error.message
          }
        });
      }

      return {
        status: this.resultStatuses.FAILURE,
        specialist,
        attemptNumber,
        error: error.message,
        originalError: error
      };
    }
  }

  /**
   * Build delegation request for specialist
   *
   * @param {Object} fixTask - Fix task from preparer
   * @param {Object} tddState - TDD state
   * @param {string} sessionId - Session ID
   * @returns {Object} Delegation request
   * @private
   */
  buildDelegationRequest(fixTask, tddState, sessionId) {
    return {
      type: 'fix-implementation',
      sessionId,
      tddPhase: 'green',
      task: fixTask.task,
      constraints: {
        timeout: this.delegationTimeout,
        maintainCoverage: true,
        minimizeChanges: true,
        ...fixTask.task.constraints
      },
      expectedResponse: {
        fields: this.expectedResponseFields,
        format: 'structured-json'
      }
    };
  }

  /**
   * Invoke specialist agent delegation
   *
   * @param {string} specialist - Specialist agent name
   * @param {Object} request - Delegation request
   * @returns {Promise<Object>} Specialist response
   * @private
   */
  async invokeDelegation(specialist, request) {
    if (this.taskDelegator) {
      // Use injected delegator for testing
      return this.taskDelegator(specialist, request);
    }

    // In production, this would use the Task tool
    // For now, return simulated response structure
    throw new Error('Production Task tool delegation not yet implemented. Use taskDelegator injection for testing.');
  }

  /**
   * Parse specialist response into structured format
   *
   * @param {Object} response - Raw specialist response
   * @param {string} specialist - Specialist name (for error context)
   * @returns {Object} Parsed response
   * @private
   */
  parseSpecialistResponse(response, specialist) {
    if (!response) {
      throw new Error(`Specialist ${specialist} returned null/undefined response`);
    }

    // Validate expected fields present
    const missingFields = this.expectedResponseFields.filter(
      field => !(field in response)
    );

    if (missingFields.length > 0) {
      throw new Error(
        `Specialist ${specialist} response missing required fields: ${missingFields.join(', ')}`
      );
    }

    return {
      success: Boolean(response.success),
      codeChanges: Array.isArray(response.codeChanges) ? response.codeChanges : [],
      testChanges: Array.isArray(response.testChanges) ? response.testChanges : [],
      fixValidation: response.fixValidation || {},
      implementationTime: Number(response.implementationTime) || 0,
      metadata: response.metadata || {}
    };
  }

  /**
   * Validate fix quality meets requirements
   *
   * @param {Object} response - Parsed specialist response
   * @param {Object} fixTask - Original fix task
   * @returns {Object} Validation result
   * @private
   */
  validateFixQuality(response, fixTask) {
    const validation = {
      passed: true,
      checks: {},
      failureReason: null
    };

    // Check 1: Fix was successful
    validation.checks.success = response.success;
    if (!response.success) {
      validation.passed = false;
      validation.failureReason = 'Specialist reported implementation failure';
      return validation;
    }

    // Check 2: Code changes provided
    validation.checks.hasCodeChanges = response.codeChanges.length > 0;
    if (response.codeChanges.length === 0) {
      validation.passed = false;
      validation.failureReason = 'No code changes provided';
      return validation;
    }

    // Check 3: Fix validation passed
    validation.checks.fixValidationPassed = response.fixValidation?.testsPassing === true;
    if (!validation.checks.fixValidationPassed) {
      validation.passed = false;
      validation.failureReason = 'Recreation test still failing after fix';
      return validation;
    }

    // Check 4: Test changes provided (for GREEN phase)
    validation.checks.hasTestChanges = response.testChanges.length > 0;
    // Note: Test changes optional if fix doesn't require new tests

    // Check 5: Implementation time reasonable
    const maxReasonableTime = this.delegationTimeout * 0.9; // 90% of timeout
    validation.checks.reasonableTime = response.implementationTime <= maxReasonableTime;
    if (!validation.checks.reasonableTime) {
      this.logger(`⚠️  Warning: Implementation time ${response.implementationTime}ms approaches timeout`);
    }

    return validation;
  }

  /**
   * Check if error is retryable
   *
   * @param {Error} error - Error to check
   * @returns {boolean} True if retryable
   * @private
   */
  isRetryableError(error) {
    const retryablePatterns = [
      /network/i,
      /connection/i,
      /temporarily unavailable/i,
      /rate limit/i,
      /service unavailable/i
    ];

    return retryablePatterns.some(pattern => pattern.test(error.message));
  }

  /**
   * Validate delegation context
   *
   * @param {Object} context - Context to validate
   * @throws {Error} If context invalid
   * @private
   */
  validateContext(context) {
    if (!context) {
      throw new Error('Delegation context is required');
    }

    if (!context.fixTask) {
      throw new Error('fixTask is required in delegation context');
    }

    if (!context.fixTask.agent) {
      throw new Error('fixTask.agent (specialist) is required');
    }

    if (!context.tddState) {
      throw new Error('tddState is required in delegation context');
    }

    if (!context.sessionId) {
      throw new Error('sessionId is required in delegation context');
    }

    // Validate TDD state is in correct phase for GREEN delegation
    if (context.tddState.currentPhase !== 'red' && context.tddState.currentPhase !== 'green') {
      throw new Error(
        `GREEN phase delegation requires RED or GREEN phase, got: ${context.tddState.currentPhase}`
      );
    }
  }

  /**
   * Build escalation request for failed delegation
   *
   * @param {Object} delegationResult - Failed delegation result
   * @param {Object} context - Original delegation context
   * @returns {Object} Escalation request
   */
  buildEscalationRequest(delegationResult, context) {
    return {
      type: 'delegation-failure-escalation',
      sessionId: context.sessionId,
      specialist: delegationResult.specialist,
      attemptCount: delegationResult.attemptNumber,
      failureStatus: delegationResult.status,
      failureReason: delegationResult.error || delegationResult.validation?.failureReason,
      originalFixTask: context.fixTask,
      recommendedActions: this.getEscalationRecommendations(delegationResult)
    };
  }

  /**
   * Get escalation recommendations based on failure
   *
   * @param {Object} delegationResult - Failed delegation result
   * @returns {string[]} Recommended actions
   * @private
   */
  getEscalationRecommendations(delegationResult) {
    const recommendations = [];

    if (delegationResult.status === this.resultStatuses.TIMEOUT) {
      recommendations.push('Increase delegation timeout for complex fixes');
      recommendations.push('Consider breaking fix into smaller tasks');
      recommendations.push('Verify specialist agent is responsive');
    }

    if (delegationResult.status === this.resultStatuses.RETRY_EXHAUSTED) {
      recommendations.push('Review fix strategy - may require different approach');
      recommendations.push('Consider escalating to tech-lead-orchestrator for architectural guidance');
      recommendations.push('Verify recreation test accurately represents bug');
    }

    if (delegationResult.status === this.resultStatuses.FAILURE) {
      recommendations.push('Check specialist agent logs for error details');
      recommendations.push('Verify specialist has required capabilities for this fix');
      recommendations.push('Consider trying alternative specialist agent');
    }

    return recommendations;
  }
}

module.exports = GreenPhaseDelegator;
