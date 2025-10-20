/**
 * Tests for GREEN Phase Delegator
 */

const GreenPhaseDelegator = require('../../workflow/green-phase-delegator');

describe('GreenPhaseDelegator', () => {
  let delegator;
  let mockTaskDelegator;

  beforeEach(() => {
    mockTaskDelegator = jest.fn();
    delegator = new GreenPhaseDelegator({
      taskDelegator: mockTaskDelegator,
      logger: jest.fn()
    });
  });

  describe('Constructor', () => {
    it('should initialize with default timeout', () => {
      expect(delegator.delegationTimeout).toBe(1800000); // 30 minutes
    });

    it('should initialize with default max retries', () => {
      expect(delegator.maxRetries).toBe(2);
    });

    it('should initialize with result statuses', () => {
      expect(delegator.resultStatuses).toEqual({
        SUCCESS: 'success',
        TIMEOUT: 'timeout',
        FAILURE: 'failure',
        RETRY_EXHAUSTED: 'retry_exhausted'
      });
    });

    it('should allow custom configuration', () => {
      const custom = new GreenPhaseDelegator({
        delegationTimeout: 600000,
        maxRetries: 3
      });

      expect(custom.delegationTimeout).toBe(600000);
      expect(custom.maxRetries).toBe(3);
    });

    it('should initialize with expected response fields', () => {
      expect(delegator.expectedResponseFields).toContain('success');
      expect(delegator.expectedResponseFields).toContain('codeChanges');
      expect(delegator.expectedResponseFields).toContain('testChanges');
      expect(delegator.expectedResponseFields).toContain('fixValidation');
      expect(delegator.expectedResponseFields).toContain('implementationTime');
    });
  });

  describe('delegateGreenPhase', () => {
    let validContext;
    let successResponse;

    beforeEach(() => {
      validContext = {
        fixTask: {
          agent: 'backend-developer',
          task: {
            type: 'fix-implementation',
            description: 'Add null check',
            constraints: { maintainCoverage: true }
          }
        },
        tddState: {
          currentPhase: 'red',
          sessionId: 'session-123'
        },
        sessionId: 'session-123'
      };

      successResponse = {
        success: true,
        codeChanges: [
          {
            filePath: 'lib/auth/validator.js',
            changeType: 'modified',
            linesAdded: 5,
            linesRemoved: 2,
            diffContent: 'diff content'
          }
        ],
        testChanges: [
          {
            filePath: 'test/auth/validator.test.js',
            testFramework: 'jest',
            testType: 'unit',
            testCount: 3,
            coverage: {
              lineCoverage: 85,
              branchCoverage: 80,
              functionCoverage: 90,
              statementCoverage: 85
            }
          }
        ],
        fixValidation: {
          testsPassing: true
        },
        implementationTime: 5000
      };

      mockTaskDelegator.mockResolvedValue(successResponse);
    });

    it('should throw error if context is null', async () => {
      await expect(delegator.delegateGreenPhase(null)).rejects.toThrow('Delegation context is required');
    });

    it('should throw error if fixTask missing', async () => {
      const invalid = { ...validContext };
      delete invalid.fixTask;

      await expect(delegator.delegateGreenPhase(invalid)).rejects.toThrow('fixTask is required');
    });

    it('should throw error if specialist missing', async () => {
      const invalid = {
        ...validContext,
        fixTask: { task: {} }
      };

      await expect(delegator.delegateGreenPhase(invalid)).rejects.toThrow('fixTask.agent (specialist) is required');
    });

    it('should throw error if tddState missing', async () => {
      const invalid = { ...validContext };
      delete invalid.tddState;

      await expect(delegator.delegateGreenPhase(invalid)).rejects.toThrow('tddState is required');
    });

    it('should throw error if sessionId missing', async () => {
      const invalid = { ...validContext };
      delete invalid.sessionId;

      await expect(delegator.delegateGreenPhase(invalid)).rejects.toThrow('sessionId is required');
    });

    it('should throw error if TDD phase invalid for GREEN delegation', async () => {
      const invalid = {
        ...validContext,
        tddState: { currentPhase: 'complete' }
      };

      await expect(delegator.delegateGreenPhase(invalid)).rejects.toThrow('GREEN phase delegation requires RED or GREEN phase');
    });

    it('should successfully delegate to specialist', async () => {
      const result = await delegator.delegateGreenPhase(validContext);

      expect(result.status).toBe('success');
      expect(result.specialist).toBe('backend-developer');
      expect(result.attemptNumber).toBe(1);
      expect(mockTaskDelegator).toHaveBeenCalledTimes(1);
    });

    it('should include code changes in result', async () => {
      const result = await delegator.delegateGreenPhase(validContext);

      expect(result.codeChanges).toHaveLength(1);
      expect(result.codeChanges[0].filePath).toBe('lib/auth/validator.js');
    });

    it('should include test changes in result', async () => {
      const result = await delegator.delegateGreenPhase(validContext);

      expect(result.testChanges).toHaveLength(1);
      expect(result.testChanges[0].testFramework).toBe('jest');
    });

    it('should include fix validation in result', async () => {
      const result = await delegator.delegateGreenPhase(validContext);

      expect(result.fixValidation.testsPassing).toBe(true);
    });

    it('should include implementation time in result', async () => {
      const result = await delegator.delegateGreenPhase(validContext);

      expect(result.implementationTime).toBe(5000);
    });

    it('should include validation checks in result', async () => {
      const result = await delegator.delegateGreenPhase(validContext);

      expect(result.validation).toBeDefined();
      expect(result.validation.passed).toBe(true);
      expect(result.validation.checks).toBeDefined();
    });

    it('should measure delegation duration', async () => {
      const result = await delegator.delegateGreenPhase(validContext);

      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('buildDelegationRequest', () => {
    it('should build complete delegation request', () => {
      const fixTask = {
        agent: 'backend-developer',
        task: {
          description: 'Fix null pointer',
          constraints: { minimizeChanges: true }
        }
      };
      const tddState = { currentPhase: 'red' };
      const sessionId = 'session-123';

      const request = delegator.buildDelegationRequest(fixTask, tddState, sessionId);

      expect(request.type).toBe('fix-implementation');
      expect(request.sessionId).toBe('session-123');
      expect(request.tddPhase).toBe('green');
      expect(request.task).toBe(fixTask.task);
    });

    it('should include timeout in constraints', () => {
      const request = delegator.buildDelegationRequest(
        { task: { constraints: {} } },
        {},
        'session-1'
      );

      expect(request.constraints.timeout).toBe(delegator.delegationTimeout);
    });

    it('should include coverage and change constraints', () => {
      const request = delegator.buildDelegationRequest(
        { task: { constraints: {} } },
        {},
        'session-1'
      );

      expect(request.constraints.maintainCoverage).toBe(true);
      expect(request.constraints.minimizeChanges).toBe(true);
    });

    it('should merge task constraints', () => {
      const request = delegator.buildDelegationRequest(
        { task: { constraints: { customConstraint: 'value' } } },
        {},
        'session-1'
      );

      expect(request.constraints.customConstraint).toBe('value');
    });

    it('should include expected response fields', () => {
      const request = delegator.buildDelegationRequest(
        { task: {} },
        {},
        'session-1'
      );

      expect(request.expectedResponse.fields).toEqual(delegator.expectedResponseFields);
      expect(request.expectedResponse.format).toBe('structured-json');
    });
  });

  describe('parseSpecialistResponse', () => {
    it('should throw error for null response', () => {
      expect(() => delegator.parseSpecialistResponse(null, 'test-agent')).toThrow('returned null/undefined response');
    });

    it('should throw error for missing required fields', () => {
      const incomplete = {
        success: true,
        codeChanges: []
        // Missing testChanges, fixValidation, implementationTime
      };

      expect(() => delegator.parseSpecialistResponse(incomplete, 'test-agent')).toThrow('missing required fields');
    });

    it('should parse complete response', () => {
      const response = {
        success: true,
        codeChanges: [],
        testChanges: [],
        fixValidation: {},
        implementationTime: 1000
      };

      const parsed = delegator.parseSpecialistResponse(response, 'test-agent');

      expect(parsed.success).toBe(true);
      expect(parsed.codeChanges).toEqual([]);
      expect(parsed.testChanges).toEqual([]);
    });

    it('should ensure arrays for codeChanges and testChanges', () => {
      const response = {
        success: true,
        codeChanges: null,
        testChanges: null,
        fixValidation: {},
        implementationTime: 1000
      };

      const parsed = delegator.parseSpecialistResponse(response, 'test-agent');

      expect(Array.isArray(parsed.codeChanges)).toBe(true);
      expect(Array.isArray(parsed.testChanges)).toBe(true);
    });

    it('should convert success to boolean', () => {
      const response = {
        success: 'true',
        codeChanges: [],
        testChanges: [],
        fixValidation: {},
        implementationTime: 1000
      };

      const parsed = delegator.parseSpecialistResponse(response, 'test-agent');

      expect(parsed.success).toBe(true);
    });

    it('should convert implementationTime to number', () => {
      const response = {
        success: true,
        codeChanges: [],
        testChanges: [],
        fixValidation: {},
        implementationTime: '5000'
      };

      const parsed = delegator.parseSpecialistResponse(response, 'test-agent');

      expect(parsed.implementationTime).toBe(5000);
    });

    it('should include metadata if provided', () => {
      const response = {
        success: true,
        codeChanges: [],
        testChanges: [],
        fixValidation: {},
        implementationTime: 1000,
        metadata: { key: 'value' }
      };

      const parsed = delegator.parseSpecialistResponse(response, 'test-agent');

      expect(parsed.metadata).toEqual({ key: 'value' });
    });
  });

  describe('validateFixQuality', () => {
    let validResponse;
    let fixTask;

    beforeEach(() => {
      validResponse = {
        success: true,
        codeChanges: [{ filePath: 'test.js' }],
        testChanges: [],
        fixValidation: { testsPassing: true },
        implementationTime: 5000
      };

      fixTask = {
        task: { description: 'Fix bug' }
      };
    });

    it('should pass for valid fix', () => {
      const validation = delegator.validateFixQuality(validResponse, fixTask);

      expect(validation.passed).toBe(true);
      expect(validation.failureReason).toBeNull();
    });

    it('should fail if specialist reported failure', () => {
      validResponse.success = false;

      const validation = delegator.validateFixQuality(validResponse, fixTask);

      expect(validation.passed).toBe(false);
      expect(validation.failureReason).toContain('implementation failure');
    });

    it('should fail if no code changes provided', () => {
      validResponse.codeChanges = [];

      const validation = delegator.validateFixQuality(validResponse, fixTask);

      expect(validation.passed).toBe(false);
      expect(validation.failureReason).toContain('No code changes');
    });

    it('should fail if tests not passing', () => {
      validResponse.fixValidation.testsPassing = false;

      const validation = delegator.validateFixQuality(validResponse, fixTask);

      expect(validation.passed).toBe(false);
      expect(validation.failureReason).toContain('Recreation test still failing');
    });

    it('should include all validation checks', () => {
      const validation = delegator.validateFixQuality(validResponse, fixTask);

      expect(validation.checks.success).toBeDefined();
      expect(validation.checks.hasCodeChanges).toBeDefined();
      expect(validation.checks.fixValidationPassed).toBeDefined();
      expect(validation.checks.hasTestChanges).toBeDefined();
      expect(validation.checks.reasonableTime).toBeDefined();
    });

    it('should check implementation time reasonable', () => {
      validResponse.implementationTime = delegator.delegationTimeout * 0.95;

      const validation = delegator.validateFixQuality(validResponse, fixTask);

      expect(validation.checks.reasonableTime).toBe(false);
      expect(validation.passed).toBe(true); // Not a failure, just warning
    });
  });

  describe('Retry Logic', () => {
    let validContext;
    let failureResponse;

    beforeEach(() => {
      validContext = {
        fixTask: {
          agent: 'backend-developer',
          task: { type: 'fix-implementation' }
        },
        tddState: { currentPhase: 'red' },
        sessionId: 'session-123'
      };

      failureResponse = {
        success: true,
        codeChanges: [{ filePath: 'test.js' }],
        testChanges: [],
        fixValidation: { testsPassing: false }, // Failing validation
        implementationTime: 1000
      };
    });

    it('should retry on validation failure', async () => {
      mockTaskDelegator
        .mockResolvedValueOnce(failureResponse)
        .mockResolvedValueOnce({
          ...failureResponse,
          fixValidation: { testsPassing: true }
        });

      const result = await delegator.delegateGreenPhase(validContext);

      expect(mockTaskDelegator).toHaveBeenCalledTimes(2);
      expect(result.attemptNumber).toBe(2);
    });

    it('should exhaust retries after max attempts', async () => {
      mockTaskDelegator.mockResolvedValue(failureResponse);

      const result = await delegator.delegateGreenPhase(validContext);

      expect(mockTaskDelegator).toHaveBeenCalledTimes(3); // Initial + 2 retries
      expect(result.status).toBe('retry_exhausted');
      expect(result.attemptNumber).toBe(3);
    });

    it('should include previous failure in retry context', async () => {
      mockTaskDelegator
        .mockResolvedValueOnce(failureResponse)
        .mockResolvedValueOnce({
          ...failureResponse,
          fixValidation: { testsPassing: true }
        });

      await delegator.delegateGreenPhase(validContext);

      expect(mockTaskDelegator).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling', () => {
    let validContext;

    beforeEach(() => {
      validContext = {
        fixTask: {
          agent: 'backend-developer',
          task: {}
        },
        tddState: { currentPhase: 'red' },
        sessionId: 'session-123'
      };
    });

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('Operation timed out');
      timeoutError.name = 'TimeoutError';
      mockTaskDelegator.mockRejectedValue(timeoutError);

      const result = await delegator.delegateGreenPhase(validContext);

      expect(result.status).toBe('timeout');
      expect(result.error).toContain('timed out');
    });

    it('should retry on retryable errors', async () => {
      mockTaskDelegator
        .mockRejectedValueOnce(new Error('Network connection failed'))
        .mockResolvedValueOnce({
          success: true,
          codeChanges: [{}],
          testChanges: [],
          fixValidation: { testsPassing: true },
          implementationTime: 1000
        });

      const result = await delegator.delegateGreenPhase(validContext);

      expect(mockTaskDelegator).toHaveBeenCalledTimes(2);
      expect(result.status).toBe('success');
    });

    it('should not retry on non-retryable errors', async () => {
      mockTaskDelegator.mockRejectedValue(new Error('Invalid request format'));

      const result = await delegator.delegateGreenPhase(validContext);

      expect(mockTaskDelegator).toHaveBeenCalledTimes(1);
      expect(result.status).toBe('failure');
    });

    it('should identify retryable network errors', () => {
      expect(delegator.isRetryableError(new Error('network error'))).toBe(true);
      expect(delegator.isRetryableError(new Error('connection failed'))).toBe(true);
      expect(delegator.isRetryableError(new Error('temporarily unavailable'))).toBe(true);
    });

    it('should identify non-retryable errors', () => {
      expect(delegator.isRetryableError(new Error('invalid request'))).toBe(false);
      expect(delegator.isRetryableError(new Error('syntax error'))).toBe(false);
    });
  });

  describe('buildEscalationRequest', () => {
    it('should build escalation request for timeout', () => {
      const delegationResult = {
        status: 'timeout',
        specialist: 'backend-developer',
        attemptNumber: 3,
        error: 'Delegation timed out'
      };

      const context = {
        sessionId: 'session-123',
        fixTask: { task: { description: 'Fix bug' } }
      };

      const escalation = delegator.buildEscalationRequest(delegationResult, context);

      expect(escalation.type).toBe('delegation-failure-escalation');
      expect(escalation.failureStatus).toBe('timeout');
      expect(escalation.recommendedActions).toContain('Increase delegation timeout for complex fixes');
    });

    it('should build escalation request for retry exhausted', () => {
      const delegationResult = {
        status: 'retry_exhausted',
        specialist: 'backend-developer',
        attemptNumber: 3,
        validation: { failureReason: 'Tests still failing' }
      };

      const context = {
        sessionId: 'session-123',
        fixTask: { task: {} }
      };

      const escalation = delegator.buildEscalationRequest(delegationResult, context);

      expect(escalation.recommendedActions).toContain('Review fix strategy - may require different approach');
    });

    it('should include original fix task in escalation', () => {
      const delegationResult = {
        status: 'failure',
        specialist: 'backend-developer',
        attemptNumber: 1,
        error: 'Error'
      };

      const context = {
        sessionId: 'session-123',
        fixTask: { task: { description: 'Fix' } }
      };

      const escalation = delegator.buildEscalationRequest(delegationResult, context);

      expect(escalation.originalFixTask).toEqual(context.fixTask);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty code changes array', async () => {
      mockTaskDelegator.mockResolvedValue({
        success: true,
        codeChanges: [],
        testChanges: [],
        fixValidation: { testsPassing: true },
        implementationTime: 1000
      });

      const context = {
        fixTask: { agent: 'test-agent', task: {} },
        tddState: { currentPhase: 'red' },
        sessionId: 'session-1'
      };

      const result = await delegator.delegateGreenPhase(context);

      expect(result.status).toBe('retry_exhausted');
    });

    it('should handle GREEN phase state', async () => {
      mockTaskDelegator.mockResolvedValue({
        success: true,
        codeChanges: [{}],
        testChanges: [],
        fixValidation: { testsPassing: true },
        implementationTime: 1000
      });

      const context = {
        fixTask: { agent: 'test-agent', task: {} },
        tddState: { currentPhase: 'green' }, // GREEN instead of RED
        sessionId: 'session-1'
      };

      const result = await delegator.delegateGreenPhase(context);

      expect(result.status).toBe('success');
    });
  });
});
