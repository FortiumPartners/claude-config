/**
 * Fix Task Preparer
 *
 * Prepares comprehensive task context for specialist agent delegation.
 * Includes bug description, failing test, root cause, fix strategy,
 * TDD phase instructions, and constraints.
 *
 * @module lib/deep-debugger/strategy/fix-task-preparer
 */

class FixTaskPreparer {
  /**
   * Create a fix task preparer
   *
   * @param {Object} [options] - Configuration options
   * @param {number} [options.timeout] - Default timeout in ms (default: 30 minutes)
   * @param {number} [options.maxRetries] - Max retry attempts (default: 1)
   */
  constructor(options = {}) {
    this.timeout = options.timeout || 1800000; // 30 minutes
    this.maxRetries = options.maxRetries || 1;

    // Default constraints
    this.defaultConstraints = {
      maintainCoverage: true,
      minimizeChanges: true,
      preserveBackwardCompatibility: true,
      followCodingStandards: true
    };
  }

  /**
   * Prepare fix task for specialist delegation
   *
   * @param {Object} context - Fix preparation context
   * @param {Object} context.bugReport - Bug report details
   * @param {string} context.testCode - Failing test code
   * @param {string} context.testFile - Path to test file
   * @param {Object} context.rootCause - Root cause analysis
   * @param {Object} context.fixRecommendation - Fix recommendation to implement
   * @param {string} context.specialistAgent - Target specialist agent
   * @param {Object} [context.tddState] - TDD phase tracking state
   * @param {Object} [context.constraints] - Additional constraints
   * @returns {Object} Prepared fix task
   */
  prepareFixTask(context) {
    // Validate required context
    this.validateContext(context);

    const {
      bugReport,
      testCode,
      testFile,
      rootCause,
      fixRecommendation,
      specialistAgent,
      tddState,
      constraints = {}
    } = context;

    // Build task description
    const taskDescription = this.buildTaskDescription(
      bugReport,
      rootCause,
      fixRecommendation
    );

    // Build code context
    const codeContext = this.buildCodeContext(
      testCode,
      testFile,
      rootCause,
      fixRecommendation
    );

    // Build TDD instructions
    const tddInstructions = this.buildTDDInstructions(tddState);

    // Merge constraints
    const mergedConstraints = {
      ...this.defaultConstraints,
      ...constraints
    };

    // Build success criteria
    const successCriteria = this.buildSuccessCriteria(
      testFile,
      fixRecommendation,
      mergedConstraints
    );

    return {
      agent: specialistAgent,
      task: {
        type: 'fix-implementation',
        description: taskDescription,
        bugId: bugReport.issueId || 'manual',
        severity: bugReport.severity,

        codeContext,
        tddPhase: tddState?.currentPhase || 'green',
        tddInstructions,

        fixStrategy: {
          description: fixRecommendation.description,
          priority: fixRecommendation.priority,
          estimatedTime: fixRecommendation.estimatedTime,
          complexity: fixRecommendation.complexity,
          affectedFiles: fixRecommendation.affectedFiles || []
        },

        constraints: mergedConstraints,
        successCriteria,

        timeout: this.timeout,
        retryAttempts: this.maxRetries
      }
    };
  }

  /**
   * Validate fix preparation context
   *
   * @param {Object} context - Context to validate
   * @throws {Error} If context is invalid
   * @private
   */
  validateContext(context) {
    if (!context) {
      throw new Error('Context is required');
    }

    const required = [
      'bugReport',
      'testCode',
      'testFile',
      'rootCause',
      'fixRecommendation',
      'specialistAgent'
    ];

    for (const field of required) {
      if (!context[field]) {
        throw new Error(`Context missing required field: ${field}`);
      }
    }

    // Validate bugReport structure
    if (!context.bugReport.title || !context.bugReport.description) {
      throw new Error('Bug report must include title and description');
    }

    // Validate rootCause structure
    if (!context.rootCause.description) {
      throw new Error('Root cause must include description');
    }

    // Validate fixRecommendation structure
    if (!context.fixRecommendation.description) {
      throw new Error('Fix recommendation must include description');
    }
  }

  /**
   * Build task description for specialist
   *
   * @param {Object} bugReport - Bug report
   * @param {Object} rootCause - Root cause analysis
   * @param {Object} fixRecommendation - Fix recommendation
   * @returns {string} Task description
   * @private
   */
  buildTaskDescription(bugReport, rootCause, fixRecommendation) {
    return `
## Bug Fix Task

**Bug**: ${bugReport.title}
**Severity**: ${bugReport.severity}

### Problem Description
${bugReport.description}

### Root Cause
${rootCause.description}

${rootCause.likelyFile ? `**Likely File**: \`${rootCause.likelyFile}\`` : ''}
${rootCause.likelyFunction ? `**Likely Function**: \`${rootCause.likelyFunction}\`` : ''}

### Fix Strategy
${fixRecommendation.description}

**Priority**: ${fixRecommendation.priority}
**Estimated Time**: ${fixRecommendation.estimatedTime}h
**Complexity**: ${fixRecommendation.complexity}
    `.trim();
  }

  /**
   * Build code context for specialist
   *
   * @param {string} testCode - Test code
   * @param {string} testFile - Test file path
   * @param {Object} rootCause - Root cause
   * @param {Object} fixRecommendation - Fix recommendation
   * @returns {Object} Code context
   * @private
   */
  buildCodeContext(testCode, testFile, rootCause, fixRecommendation) {
    return {
      failingTest: {
        code: testCode,
        file: testFile,
        description: 'Recreation test that reproduces the bug'
      },

      affectedFiles: [
        ...(rootCause.likelyFile ? [rootCause.likelyFile] : []),
        ...(fixRecommendation.affectedFiles || [])
      ].filter((file, index, self) => self.indexOf(file) === index), // Deduplicate

      errorContext: rootCause.errorContext || null,
      stackTrace: rootCause.stackTrace || null
    };
  }

  /**
   * Build TDD phase instructions
   *
   * @param {Object} tddState - TDD tracking state
   * @returns {Object} TDD instructions
   * @private
   */
  buildTDDInstructions(tddState) {
    const currentPhase = tddState?.currentPhase || 'green';

    const instructions = {
      green: {
        goal: 'Implement the minimal fix to make the failing test pass',
        steps: [
          '1. Review the failing test and understand what it expects',
          '2. Implement the simplest solution that makes the test pass',
          '3. Avoid over-engineering or adding unnecessary complexity',
          '4. Ensure the test passes after your changes',
          '5. Maintain or improve test coverage'
        ],
        constraints: [
          'Focus on making the test pass, not on perfect code',
          'Minimize changes to existing code',
          'Do not refactor yet - that comes in the REFACTOR phase'
        ]
      },

      refactor: {
        goal: 'Improve code quality while keeping all tests passing',
        steps: [
          '1. Ensure all tests pass before refactoring',
          '2. Improve code readability and maintainability',
          '3. Remove duplication and simplify logic',
          '4. Add comments and documentation as needed',
          '5. Run tests after each refactoring step'
        ],
        constraints: [
          'All tests must continue to pass',
          'Do not change behavior or add new features',
          'Focus on code quality, not functionality'
        ]
      }
    };

    return instructions[currentPhase] || instructions.green;
  }

  /**
   * Build success criteria
   *
   * @param {string} testFile - Test file path
   * @param {Object} fixRecommendation - Fix recommendation
   * @param {Object} constraints - Constraints
   * @returns {Object} Success criteria
   * @private
   */
  buildSuccessCriteria(testFile, fixRecommendation, constraints) {
    const criteria = {
      testsPassing: {
        required: true,
        description: `Recreation test in ${testFile} must pass`,
        validation: 'Run test suite and verify no failures'
      },

      coverageMaintained: {
        required: constraints.maintainCoverage,
        description: 'Test coverage must not decrease',
        validation: 'Compare coverage before and after fix'
      },

      minimalChanges: {
        required: constraints.minimizeChanges,
        description: 'Changes limited to affected files only',
        validation: `Only modify files: ${(fixRecommendation.affectedFiles || []).join(', ')}`
      },

      backwardCompatibility: {
        required: constraints.preserveBackwardCompatibility,
        description: 'Maintain backward compatibility',
        validation: 'Existing tests must continue to pass'
      },

      codingStandards: {
        required: constraints.followCodingStandards,
        description: 'Follow project coding standards',
        validation: 'Code passes linting and style checks'
      }
    };

    return criteria;
  }

  /**
   * Prepare multi-component fix task
   *
   * For fixes spanning multiple components (e.g., backend + frontend)
   *
   * @param {Object} context - Multi-component context
   * @param {Object[]} context.fixRecommendations - Multiple fix recommendations
   * @param {string[]} context.specialistAgents - Multiple specialist agents
   * @returns {Object[]} Array of prepared fix tasks
   */
  prepareMultiComponentFixTask(context) {
    if (!context) {
      throw new Error('Context is required');
    }
    if (!context.fixRecommendations || context.fixRecommendations.length === 0) {
      throw new Error('Fix recommendations are required');
    }
    if (!context.specialistAgents || context.specialistAgents.length === 0) {
      throw new Error('Specialist agents are required');
    }

    const tasks = [];

    for (let i = 0; i < context.fixRecommendations.length; i++) {
      const recommendation = context.fixRecommendations[i];
      const agent = context.specialistAgents[i] || context.specialistAgents[0];

      // Build individual task context
      const taskContext = {
        ...context,
        fixRecommendation: recommendation,
        specialistAgent: agent
      };

      // Add dependency information
      if (i > 0) {
        taskContext.constraints = {
          ...taskContext.constraints,
          dependsOn: tasks[i - 1].agent,
          waitForCompletion: true
        };
      }

      tasks.push(this.prepareFixTask(taskContext));
    }

    return tasks;
  }

  /**
   * Add retry configuration to task
   *
   * @param {Object} task - Prepared task
   * @param {number} maxRetries - Maximum retry attempts
   * @param {number} retryDelay - Delay between retries (ms)
   * @returns {Object} Task with retry configuration
   */
  addRetryConfiguration(task, maxRetries, retryDelay = 5000) {
    return {
      ...task,
      task: {
        ...task.task,
        retryAttempts: maxRetries,
        retryDelay,
        retryStrategy: 'exponential-backoff'
      }
    };
  }
}

module.exports = FixTaskPreparer;
