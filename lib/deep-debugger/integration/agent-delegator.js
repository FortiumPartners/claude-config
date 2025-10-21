/**
 * Agent Delegation Module
 *
 * Handles real specialist agent delegation using Claude Code Task tool.
 * Provides timeout handling, error classification, and response parsing.
 *
 * Integration with Sprint 5 Modules:
 * - Used by GreenPhaseDelegator for fix implementation
 * - Used by RefactorPhaseCoordinator for code quality improvements
 * - Provides structured response format for validators
 *
 * @module lib/deep-debugger/integration/agent-delegator
 */

class AgentDelegator {
  /**
   * Create agent delegator
   *
   * @param {Object} options - Configuration options
   * @param {Function} [options.taskTool] - Task tool function (injected for testing)
   * @param {number} [options.defaultTimeout=1800000] - Default timeout in ms (30 min)
   * @param {Function} [options.logger] - Logging function
   */
  constructor(options = {}) {
    this.taskTool = options.taskTool || null;
    this.defaultTimeout = options.defaultTimeout || 1800000; // 30 minutes
    this.logger = options.logger || console.log;

    // Specialist agent mapping (from deep-debugger.yaml)
    this.specialistAgents = {
      'rails-backend-expert': 'Rails backend specialist for ActiveRecord, controllers, and jobs',
      'nestjs-backend-expert': 'NestJS backend specialist for TypeScript services and modules',
      'dotnet-backend-expert': '.NET Core specialist for ASP.NET and Wolverine',
      'react-component-architect': 'React specialist for hooks and state management',
      'dotnet-blazor-expert': 'Blazor specialist for Server and WebAssembly',
      'elixir-phoenix-expert': 'Elixir/Phoenix specialist for LiveView and OTP',
      'frontend-developer': 'Framework-agnostic frontend specialist',
      'backend-developer': 'Framework-agnostic backend specialist',
      'tech-lead-orchestrator': 'Architecture analysis and fix strategy specialist',
      'code-reviewer': 'Security and quality validation specialist'
    };

    // Error classification patterns
    this.retryableErrorPatterns = [
      /timeout/i,
      /temporary/i,
      /transient/i,
      /network/i,
      /connection/i,
      /rate limit/i,
      /throttle/i,
      /busy/i,
      /unavailable/i
    ];

    this.nonRetryableErrorPatterns = [
      /not found/i,
      /unauthorized/i,
      /forbidden/i,
      /invalid/i,
      /malformed/i,
      /syntax error/i,
      /parse error/i
    ];
  }

  /**
   * Delegate task to specialist agent
   *
   * @param {Object} options - Delegation options
   * @param {string} options.agent - Agent name (e.g., 'backend-developer')
   * @param {string} options.description - Task description (3-5 words)
   * @param {string} options.prompt - Detailed task prompt
   * @param {number} [options.timeout] - Timeout in ms (defaults to defaultTimeout)
   * @returns {Promise<Object>} Agent response
   */
  async delegate(options) {
    const { agent, description, prompt, timeout } = options;

    this.validateDelegationOptions(options);

    const effectiveTimeout = timeout || this.defaultTimeout;
    const startTime = Date.now();

    this.logger(`\n[Agent Delegation] Starting delegation...`);
    this.logger(`  Agent: ${agent}`);
    this.logger(`  Task: ${description}`);
    this.logger(`  Timeout: ${effectiveTimeout}ms`);

    try {
      // Use Task tool (injected for testing, real implementation uses Claude Code Task tool)
      if (this.taskTool) {
        this.logger(`[Agent Delegation] Using injected task tool (test mode)`);
        return await this.taskTool({ agent, description, prompt, timeout: effectiveTimeout });
      }

      // In production, this would invoke the Task tool through Claude Code
      // For now, provide clear error message
      throw new Error(
        `Production Task tool delegation not yet implemented. ` +
        `Agent: ${agent}, Task: ${description}. ` +
        `Use taskTool injection for testing or implement Claude Code Task tool integration.`
      );

    } catch (error) {
      const duration = Date.now() - startTime;

      this.logger(`[Agent Delegation] ❌ Failed after ${duration}ms`);
      this.logger(`  Error: ${error.message}`);

      // Classify error for retry decision
      const errorType = this.classifyError(error);

      throw {
        type: errorType,
        message: error.message,
        agent,
        description,
        duration,
        originalError: error,
        retryable: errorType === 'retryable'
      };
    }
  }

  /**
   * Delegate GREEN phase fix implementation
   *
   * @param {Object} context - Delegation context
   * @param {Object} context.fixTask - Fix task details
   * @param {Object} context.tddState - TDD state
   * @param {string} context.sessionId - Session ID
   * @param {Object} [context.retryContext] - Retry context from previous attempt
   * @returns {Promise<Object>} Fix implementation response
   */
  async delegateGreenPhase(context) {
    const { fixTask, tddState, sessionId, retryContext } = context;
    const agent = fixTask.agent;

    // Build GREEN phase prompt
    const prompt = this.buildGreenPhasePrompt(fixTask, tddState, sessionId, retryContext);

    // Delegate to specialist
    const response = await this.delegate({
      agent,
      description: 'Implement bug fix (GREEN phase)',
      prompt,
      timeout: fixTask.timeout || this.defaultTimeout
    });

    // Parse and validate response
    return this.parseGreenPhaseResponse(response, agent);
  }

  /**
   * Delegate REFACTOR phase code quality improvements
   *
   * @param {Object} context - Delegation context
   * @param {Object} context.greenResult - GREEN phase result
   * @param {Object} context.tddState - TDD state
   * @param {string} context.sessionId - Session ID
   * @param {Object} context.qualityTargets - Quality targets
   * @returns {Promise<Object>} Refactor result
   */
  async delegateRefactorPhase(context) {
    const { greenResult, tddState, sessionId, qualityTargets } = context;
    const agent = greenResult.specialist || 'backend-developer';

    // Build REFACTOR phase prompt
    const prompt = this.buildRefactorPhasePrompt(greenResult, tddState, sessionId, qualityTargets);

    // Delegate to specialist
    const response = await this.delegate({
      agent,
      description: 'Improve code quality (REFACTOR)',
      prompt,
      timeout: qualityTargets.timeout || this.defaultTimeout
    });

    // Parse and validate response
    return this.parseRefactorPhaseResponse(response, agent);
  }

  /**
   * Build GREEN phase delegation prompt
   *
   * @param {Object} fixTask - Fix task
   * @param {Object} tddState - TDD state
   * @param {string} sessionId - Session ID
   * @param {Object} retryContext - Retry context
   * @returns {string} Delegation prompt
   * @private
   */
  buildGreenPhasePrompt(fixTask, tddState, sessionId, retryContext) {
    const lines = [];

    lines.push(`# TDD GREEN Phase: Bug Fix Implementation`);
    lines.push(``);
    lines.push(`Session: ${sessionId}`);
    lines.push(`TDD Phase: GREEN (implement minimal fix to make tests pass)`);
    lines.push(``);

    // Bug context
    lines.push(`## Bug Description`);
    lines.push(fixTask.description || fixTask.task?.description || 'No description provided');
    lines.push(``);

    // Failing test
    if (fixTask.failingTest) {
      lines.push(`## Failing Test`);
      lines.push(`Path: ${fixTask.failingTest.path}`);
      lines.push(`Status: Currently failing`);
      lines.push(``);
    }

    // Root cause hypothesis
    if (fixTask.rootCause) {
      lines.push(`## Root Cause`);
      lines.push(fixTask.rootCause);
      lines.push(``);
    }

    // Fix strategy
    if (fixTask.strategy) {
      lines.push(`## Fix Strategy`);
      lines.push(fixTask.strategy);
      lines.push(``);
    }

    // Affected files
    if (fixTask.affectedFiles && fixTask.affectedFiles.length > 0) {
      lines.push(`## Affected Files`);
      fixTask.affectedFiles.forEach(file => lines.push(`- ${file}`));
      lines.push(``);
    }

    // Retry context
    if (retryContext) {
      lines.push(`## Previous Attempt Failed`);
      lines.push(`Attempt: ${retryContext.attemptNumber}`);
      lines.push(`Reason: ${retryContext.previousFailure}`);
      lines.push(``);
      lines.push(`Please address the issues from the previous attempt.`);
      lines.push(``);
    }

    // Requirements
    lines.push(`## Requirements`);
    lines.push(`1. Implement minimal fix to make the failing test pass`);
    lines.push(`2. Maintain or improve test coverage (≥80% unit, ≥70% integration)`);
    lines.push(`3. Follow framework conventions and best practices`);
    lines.push(`4. Add new tests if needed to cover edge cases`);
    lines.push(`5. Ensure no regressions in existing functionality`);
    lines.push(``);

    // Response format
    lines.push(`## Response Format`);
    lines.push(`Please provide your response as a JSON object with:`);
    lines.push(`- success: boolean (true if fix implemented successfully)`);
    lines.push(`- codeChanges: array of code changes (filePath, changeType, linesAdded, linesRemoved, diffContent)`);
    lines.push(`- testChanges: array of test changes (filePath, testFramework, testType, testCount, coverage)`);
    lines.push(`- fixValidation: object with testsPass boolean and testResults`);
    lines.push(`- implementationTime: number in milliseconds`);

    return lines.join('\n');
  }

  /**
   * Build REFACTOR phase delegation prompt
   *
   * @param {Object} greenResult - GREEN phase result
   * @param {Object} tddState - TDD state
   * @param {string} sessionId - Session ID
   * @param {Object} qualityTargets - Quality targets
   * @returns {string} Delegation prompt
   * @private
   */
  buildRefactorPhasePrompt(greenResult, tddState, sessionId, qualityTargets) {
    const lines = [];

    lines.push(`# TDD REFACTOR Phase: Code Quality Improvements`);
    lines.push(``);
    lines.push(`Session: ${sessionId}`);
    lines.push(`TDD Phase: REFACTOR (improve code quality while maintaining fix)`);
    lines.push(``);

    // GREEN phase summary
    lines.push(`## GREEN Phase Summary`);
    lines.push(`Fix implemented successfully with ${greenResult.codeChanges?.length || 0} code changes.`);
    lines.push(`Tests are now passing.`);
    lines.push(``);

    // Quality targets
    lines.push(`## Quality Targets`);
    lines.push(`- Max Cyclomatic Complexity: ${qualityTargets.maxComplexity || 10}`);
    lines.push(`- Max Method Length: ${qualityTargets.maxMethodLength || 50} lines`);
    lines.push(`- Code Smells to Address: ${qualityTargets.codeSmells?.join(', ') || 'any found'}`);
    lines.push(``);

    // Requirements
    lines.push(`## Requirements`);
    lines.push(`1. Improve code quality (extract methods, reduce complexity, remove duplication)`);
    lines.push(`2. Ensure ALL tests still pass after refactoring`);
    lines.push(`3. Do NOT increase cyclomatic complexity`);
    lines.push(`4. Maintain or improve test coverage`);
    lines.push(`5. Follow SOLID principles and design patterns`);
    lines.push(``);

    // Response format
    lines.push(`## Response Format`);
    lines.push(`Please provide your response as a JSON object with:`);
    lines.push(`- success: boolean (true if refactored successfully)`);
    lines.push(`- refactored: boolean (true if changes were made)`);
    lines.push(`- codeChanges: array of code changes`);
    lines.push(`- qualityMetrics: object with cyclomaticComplexity, maxMethodLength, codeSmells array`);
    lines.push(`- testsStillPass: boolean (CRITICAL: must be true)`);
    lines.push(`- testResults: object with total, passed, failed counts`);

    return lines.join('\n');
  }

  /**
   * Parse GREEN phase agent response
   *
   * @param {Object} response - Raw agent response
   * @param {string} agent - Agent name
   * @returns {Object} Parsed response
   * @private
   */
  parseGreenPhaseResponse(response, agent) {
    if (!response) {
      throw new Error(`Agent ${agent} returned null/undefined response`);
    }

    // Validate required fields
    const requiredFields = ['success', 'codeChanges', 'testChanges', 'fixValidation'];
    const missingFields = requiredFields.filter(field => !(field in response));

    if (missingFields.length > 0) {
      throw new Error(
        `Agent ${agent} response missing required fields: ${missingFields.join(', ')}`
      );
    }

    return {
      success: Boolean(response.success),
      fixImplemented: Boolean(response.success),
      codeChanges: Array.isArray(response.codeChanges) ? response.codeChanges : [],
      testChanges: Array.isArray(response.testChanges) ? response.testChanges : [],
      fixValidation: response.fixValidation || {},
      testsPass: Boolean(response.fixValidation?.testsPass),
      implementationTime: Number(response.implementationTime) || 0,
      metadata: response.metadata || {}
    };
  }

  /**
   * Parse REFACTOR phase agent response
   *
   * @param {Object} response - Raw agent response
   * @param {string} agent - Agent name
   * @returns {Object} Parsed response
   * @private
   */
  parseRefactorPhaseResponse(response, agent) {
    if (!response) {
      throw new Error(`Agent ${agent} returned null/undefined response`);
    }

    // Validate required fields
    const requiredFields = ['success', 'refactored', 'testsStillPass'];
    const missingFields = requiredFields.filter(field => !(field in response));

    if (missingFields.length > 0) {
      throw new Error(
        `Agent ${agent} response missing required fields: ${missingFields.join(', ')}`
      );
    }

    // CRITICAL: Tests must still pass
    if (!response.testsStillPass) {
      throw new Error(
        `Refactoring broke tests! Agent ${agent} must ensure tests pass after refactoring.`
      );
    }

    return {
      success: Boolean(response.success),
      refactored: Boolean(response.refactored),
      codeChanges: Array.isArray(response.codeChanges) ? response.codeChanges : [],
      qualityMetrics: response.qualityMetrics || {},
      testsStillPass: Boolean(response.testsStillPass),
      testResults: response.testResults || { total: 0, passed: 0, failed: 0 },
      metadata: response.metadata || {}
    };
  }

  /**
   * Classify error for retry decision
   *
   * @param {Error} error - Error object
   * @returns {string} Error type: 'retryable', 'non-retryable', 'timeout'
   * @private
   */
  classifyError(error) {
    const message = error.message || String(error);

    // Check for timeout
    if (error.name === 'TimeoutError' || message.includes('timeout') || message.includes('timed out')) {
      return 'timeout';
    }

    // Check for retryable patterns
    for (const pattern of this.retryableErrorPatterns) {
      if (pattern.test(message)) {
        return 'retryable';
      }
    }

    // Check for non-retryable patterns
    for (const pattern of this.nonRetryableErrorPatterns) {
      if (pattern.test(message)) {
        return 'non-retryable';
      }
    }

    // Default to non-retryable for safety
    return 'non-retryable';
  }

  /**
   * Validate delegation options
   *
   * @param {Object} options - Delegation options
   * @throws {Error} If options invalid
   * @private
   */
  validateDelegationOptions(options) {
    if (!options.agent) {
      throw new Error('Agent name is required for delegation');
    }

    if (!options.description) {
      throw new Error('Task description is required for delegation');
    }

    if (!options.prompt) {
      throw new Error('Task prompt is required for delegation');
    }

    // Validate agent exists
    if (!this.specialistAgents[options.agent]) {
      throw new Error(
        `Unknown agent: ${options.agent}. ` +
        `Available agents: ${Object.keys(this.specialistAgents).join(', ')}`
      );
    }
  }

  /**
   * Get list of available specialist agents
   *
   * @returns {string[]} Agent names
   */
  getAvailableAgents() {
    return Object.keys(this.specialistAgents);
  }

  /**
   * Get agent description
   *
   * @param {string} agent - Agent name
   * @returns {string} Agent description
   */
  getAgentDescription(agent) {
    return this.specialistAgents[agent] || 'Unknown agent';
  }
}

module.exports = AgentDelegator;
