/**
 * Agent Delegator Unit Tests
 *
 * Tests for the agent delegation module that handles real specialist
 * agent delegation using Claude Code Task tool.
 *
 * Coverage:
 * - Basic delegation workflow
 * - GREEN phase delegation
 * - REFACTOR phase delegation
 * - Timeout handling
 * - Error classification
 * - Response parsing
 * - Validation logic
 */

const AgentDelegator = require('../../integration/agent-delegator');

describe('AgentDelegator', () => {
  let delegator;
  let mockLogger;
  let mockTaskTool;

  beforeEach(() => {
    mockLogger = jest.fn();
    mockTaskTool = jest.fn();

    delegator = new AgentDelegator({
      taskTool: mockTaskTool,
      defaultTimeout: 1800000,
      logger: mockLogger
    });
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const defaultDelegator = new AgentDelegator();

      expect(defaultDelegator.taskTool).toBeNull();
      expect(defaultDelegator.defaultTimeout).toBe(1800000); // 30 minutes
      expect(typeof defaultDelegator.logger).toBe('function');
    });

    it('should initialize with custom options', () => {
      const customLogger = jest.fn();
      const customTaskTool = jest.fn();

      const customDelegator = new AgentDelegator({
        taskTool: customTaskTool,
        defaultTimeout: 900000,
        logger: customLogger
      });

      expect(customDelegator.taskTool).toBe(customTaskTool);
      expect(customDelegator.defaultTimeout).toBe(900000);
      expect(customDelegator.logger).toBe(customLogger);
    });

    it('should have specialist agent mapping', () => {
      expect(delegator.specialistAgents).toHaveProperty('rails-backend-expert');
      expect(delegator.specialistAgents).toHaveProperty('nestjs-backend-expert');
      expect(delegator.specialistAgents).toHaveProperty('dotnet-backend-expert');
      expect(delegator.specialistAgents).toHaveProperty('react-component-architect');
      expect(delegator.specialistAgents).toHaveProperty('frontend-developer');
      expect(delegator.specialistAgents).toHaveProperty('backend-developer');
    });
  });

  describe('validateDelegationOptions', () => {
    it('should accept valid options', () => {
      const options = {
        agent: 'backend-developer',
        description: 'Implement bug fix',
        prompt: 'Fix the authentication bug'
      };

      expect(() => delegator.validateDelegationOptions(options)).not.toThrow();
    });

    it('should reject missing agent', () => {
      const options = {
        description: 'Implement bug fix',
        prompt: 'Fix the authentication bug'
      };

      expect(() => delegator.validateDelegationOptions(options))
        .toThrow('Agent name is required for delegation');
    });

    it('should reject missing description', () => {
      const options = {
        agent: 'backend-developer',
        prompt: 'Fix the authentication bug'
      };

      expect(() => delegator.validateDelegationOptions(options))
        .toThrow('Task description is required for delegation');
    });

    it('should reject missing prompt', () => {
      const options = {
        agent: 'backend-developer',
        description: 'Implement bug fix'
      };

      expect(() => delegator.validateDelegationOptions(options))
        .toThrow('Task prompt is required for delegation');
    });

    it('should reject unknown agent', () => {
      const options = {
        agent: 'unknown-agent',
        description: 'Implement bug fix',
        prompt: 'Fix the authentication bug'
      };

      expect(() => delegator.validateDelegationOptions(options))
        .toThrow(/Unknown agent: unknown-agent/);
    });
  });

  describe('delegate', () => {
    it('should delegate successfully with injected task tool', async () => {
      const mockResponse = {
        success: true,
        codeChanges: [],
        testChanges: [],
        fixValidation: { testsPass: true }
      };

      mockTaskTool.mockResolvedValue(mockResponse);

      const result = await delegator.delegate({
        agent: 'backend-developer',
        description: 'Implement bug fix',
        prompt: 'Fix the authentication bug'
      });

      expect(result).toBe(mockResponse);
      expect(mockTaskTool).toHaveBeenCalledWith({
        agent: 'backend-developer',
        description: 'Implement bug fix',
        prompt: 'Fix the authentication bug',
        timeout: 1800000
      });
    });

    it('should use custom timeout if provided', async () => {
      const mockResponse = { success: true };
      mockTaskTool.mockResolvedValue(mockResponse);

      await delegator.delegate({
        agent: 'backend-developer',
        description: 'Implement bug fix',
        prompt: 'Fix the authentication bug',
        timeout: 900000
      });

      expect(mockTaskTool).toHaveBeenCalledWith({
        agent: 'backend-developer',
        description: 'Implement bug fix',
        prompt: 'Fix the authentication bug',
        timeout: 900000
      });
    });

    it('should throw error if task tool not injected (production mode)', async () => {
      const productionDelegator = new AgentDelegator({ logger: mockLogger });

      await expect(
        productionDelegator.delegate({
          agent: 'backend-developer',
          description: 'Implement bug fix',
          prompt: 'Fix the authentication bug'
        })
      ).rejects.toMatchObject({
        type: 'non-retryable',
        agent: 'backend-developer',
        retryable: false
      });
    });

    it('should classify and throw error on delegation failure', async () => {
      mockTaskTool.mockRejectedValue(new Error('Network timeout'));

      await expect(
        delegator.delegate({
          agent: 'backend-developer',
          description: 'Implement bug fix',
          prompt: 'Fix the authentication bug'
        })
      ).rejects.toMatchObject({
        type: 'timeout',
        agent: 'backend-developer',
        retryable: false  // timeout is its own category, not retryable
      });
    });
  });

  describe('delegateGreenPhase', () => {
    const greenContext = {
      fixTask: {
        agent: 'backend-developer',
        description: 'Fix authentication bug',
        failingTest: {
          path: 'test/auth.test.js'
        },
        rootCause: 'Missing token validation',
        strategy: 'Add JWT validation middleware',
        affectedFiles: ['src/auth.js', 'src/middleware.js']
      },
      tddState: {
        currentPhase: 'red'
      },
      sessionId: 'session-123'
    };

    it('should delegate GREEN phase successfully', async () => {
      const mockResponse = {
        success: true,
        codeChanges: [
          {
            filePath: 'src/auth.js',
            changeType: 'modified',
            linesAdded: 10,
            linesRemoved: 2
          }
        ],
        testChanges: [
          {
            filePath: 'test/auth.test.js',
            testFramework: 'jest',
            testType: 'unit',
            testCount: 3,
            coverage: { lineCoverage: 85 }
          }
        ],
        fixValidation: {
          testsPass: true,
          testResults: { total: 3, passed: 3, failed: 0 }
        },
        implementationTime: 5000
      };

      mockTaskTool.mockResolvedValue(mockResponse);

      const result = await delegator.delegateGreenPhase(greenContext);

      expect(result.success).toBe(true);
      expect(result.fixImplemented).toBe(true);
      expect(result.codeChanges).toHaveLength(1);
      expect(result.testChanges).toHaveLength(1);
      expect(result.testsPass).toBe(true);
      expect(mockTaskTool).toHaveBeenCalled();
    });

    it('should build GREEN phase prompt correctly', async () => {
      mockTaskTool.mockResolvedValue({
        success: true,
        codeChanges: [],
        testChanges: [],
        fixValidation: { testsPass: true }
      });

      await delegator.delegateGreenPhase(greenContext);

      const callArgs = mockTaskTool.mock.calls[0][0];
      expect(callArgs.description).toBe('Implement bug fix (GREEN phase)');
      expect(callArgs.prompt).toContain('TDD GREEN Phase');
      expect(callArgs.prompt).toContain('Fix authentication bug');
      expect(callArgs.prompt).toContain('Missing token validation');
      expect(callArgs.prompt).toContain('Add JWT validation middleware');
      expect(callArgs.prompt).toContain('src/auth.js');
    });

    it('should include retry context in prompt if provided', async () => {
      mockTaskTool.mockResolvedValue({
        success: true,
        codeChanges: [],
        testChanges: [],
        fixValidation: { testsPass: true }
      });

      const contextWithRetry = {
        ...greenContext,
        retryContext: {
          attemptNumber: 2,
          previousFailure: 'Tests failed due to missing edge case'
        }
      };

      await delegator.delegateGreenPhase(contextWithRetry);

      const callArgs = mockTaskTool.mock.calls[0][0];
      expect(callArgs.prompt).toContain('Previous Attempt Failed');
      expect(callArgs.prompt).toContain('Attempt: 2');
      expect(callArgs.prompt).toContain('Tests failed due to missing edge case');
    });

    it('should throw error if required fields missing in response', async () => {
      mockTaskTool.mockResolvedValue({
        success: true,
        codeChanges: []
        // Missing testChanges and fixValidation
      });

      await expect(
        delegator.delegateGreenPhase(greenContext)
      ).rejects.toThrow(/missing required fields/);
    });
  });

  describe('delegateRefactorPhase', () => {
    const refactorContext = {
      greenResult: {
        specialist: 'backend-developer',
        codeChanges: [
          {
            filePath: 'src/auth.js',
            changeType: 'modified',
            linesAdded: 10,
            linesRemoved: 2
          }
        ]
      },
      tddState: {
        currentPhase: 'green'
      },
      sessionId: 'session-123',
      qualityTargets: {
        maxComplexity: 10,
        maxMethodLength: 50,
        codeSmells: ['long-method', 'duplication']
      }
    };

    it('should delegate REFACTOR phase successfully', async () => {
      const mockResponse = {
        success: true,
        refactored: true,
        codeChanges: [
          {
            filePath: 'src/auth.js',
            changeType: 'modified',
            linesAdded: 5,
            linesRemoved: 15
          }
        ],
        qualityMetrics: {
          cyclomaticComplexity: 8,
          maxMethodLength: 45,
          codeSmells: []
        },
        testsStillPass: true,
        testResults: { total: 3, passed: 3, failed: 0 }
      };

      mockTaskTool.mockResolvedValue(mockResponse);

      const result = await delegator.delegateRefactorPhase(refactorContext);

      expect(result.success).toBe(true);
      expect(result.refactored).toBe(true);
      expect(result.testsStillPass).toBe(true);
      expect(result.qualityMetrics.cyclomaticComplexity).toBe(8);
      expect(mockTaskTool).toHaveBeenCalled();
    });

    it('should build REFACTOR phase prompt correctly', async () => {
      mockTaskTool.mockResolvedValue({
        success: true,
        refactored: true,
        codeChanges: [],
        qualityMetrics: {},
        testsStillPass: true,
        testResults: { total: 0, passed: 0, failed: 0 }
      });

      await delegator.delegateRefactorPhase(refactorContext);

      const callArgs = mockTaskTool.mock.calls[0][0];
      expect(callArgs.description).toBe('Improve code quality (REFACTOR)');
      expect(callArgs.prompt).toContain('TDD REFACTOR Phase');
      expect(callArgs.prompt).toContain('Max Cyclomatic Complexity: 10');
      expect(callArgs.prompt).toContain('Max Method Length: 50');
      expect(callArgs.prompt).toContain('long-method, duplication');
    });

    it('should throw error if tests broken after refactoring', async () => {
      mockTaskTool.mockResolvedValue({
        success: true,
        refactored: true,
        codeChanges: [],
        qualityMetrics: {},
        testsStillPass: false,
        testResults: { total: 3, passed: 2, failed: 1 }
      });

      await expect(
        delegator.delegateRefactorPhase(refactorContext)
      ).rejects.toThrow(/Refactoring broke tests/);
    });

    it('should throw error if required fields missing in response', async () => {
      mockTaskTool.mockResolvedValue({
        success: true,
        refactored: true
        // Missing testsStillPass
      });

      await expect(
        delegator.delegateRefactorPhase(refactorContext)
      ).rejects.toThrow(/missing required fields/);
    });
  });

  describe('parseGreenPhaseResponse', () => {
    it('should parse valid response', () => {
      const response = {
        success: true,
        codeChanges: [{ filePath: 'test.js' }],
        testChanges: [{ filePath: 'test.test.js' }],
        fixValidation: { testsPass: true },
        implementationTime: 5000
      };

      const parsed = delegator.parseGreenPhaseResponse(response, 'backend-developer');

      expect(parsed.success).toBe(true);
      expect(parsed.fixImplemented).toBe(true);
      expect(parsed.codeChanges).toHaveLength(1);
      expect(parsed.testChanges).toHaveLength(1);
      expect(parsed.testsPass).toBe(true);
      expect(parsed.implementationTime).toBe(5000);
    });

    it('should throw error for null response', () => {
      expect(() => delegator.parseGreenPhaseResponse(null, 'backend-developer'))
        .toThrow(/returned null\/undefined response/);
    });

    it('should throw error for missing required fields', () => {
      const response = {
        success: true,
        codeChanges: []
        // Missing testChanges and fixValidation
      };

      expect(() => delegator.parseGreenPhaseResponse(response, 'backend-developer'))
        .toThrow(/missing required fields/);
    });

    it('should handle optional metadata', () => {
      const response = {
        success: true,
        codeChanges: [],
        testChanges: [],
        fixValidation: { testsPass: true },
        metadata: { agentVersion: '1.0', executionId: '123' }
      };

      const parsed = delegator.parseGreenPhaseResponse(response, 'backend-developer');

      expect(parsed.metadata).toEqual({ agentVersion: '1.0', executionId: '123' });
    });
  });

  describe('parseRefactorPhaseResponse', () => {
    it('should parse valid response', () => {
      const response = {
        success: true,
        refactored: true,
        codeChanges: [{ filePath: 'test.js' }],
        qualityMetrics: { cyclomaticComplexity: 8 },
        testsStillPass: true,
        testResults: { total: 3, passed: 3, failed: 0 }
      };

      const parsed = delegator.parseRefactorPhaseResponse(response, 'backend-developer');

      expect(parsed.success).toBe(true);
      expect(parsed.refactored).toBe(true);
      expect(parsed.codeChanges).toHaveLength(1);
      expect(parsed.testsStillPass).toBe(true);
      expect(parsed.qualityMetrics.cyclomaticComplexity).toBe(8);
    });

    it('should throw error for null response', () => {
      expect(() => delegator.parseRefactorPhaseResponse(null, 'backend-developer'))
        .toThrow(/returned null\/undefined response/);
    });

    it('should throw error for missing required fields', () => {
      const response = {
        success: true,
        refactored: true
        // Missing testsStillPass
      };

      expect(() => delegator.parseRefactorPhaseResponse(response, 'backend-developer'))
        .toThrow(/missing required fields/);
    });

    it('should throw error if tests broken', () => {
      const response = {
        success: true,
        refactored: true,
        testsStillPass: false,
        testResults: { total: 3, passed: 2, failed: 1 }
      };

      expect(() => delegator.parseRefactorPhaseResponse(response, 'backend-developer'))
        .toThrow(/Refactoring broke tests/);
    });
  });

  describe('classifyError', () => {
    it('should classify timeout errors', () => {
      const timeoutError = new Error('Request timed out');
      expect(delegator.classifyError(timeoutError)).toBe('timeout');

      const timeoutError2 = new Error('Operation timeout');
      expect(delegator.classifyError(timeoutError2)).toBe('timeout');
    });

    it('should classify retryable errors', () => {
      const networkError = new Error('Network connection failed');
      expect(delegator.classifyError(networkError)).toBe('retryable');

      const rateLimit = new Error('Rate limit exceeded');
      expect(delegator.classifyError(rateLimit)).toBe('retryable');

      const busyError = new Error('Server is busy');
      expect(delegator.classifyError(busyError)).toBe('retryable');
    });

    it('should classify non-retryable errors', () => {
      const notFoundError = new Error('Resource not found');
      expect(delegator.classifyError(notFoundError)).toBe('non-retryable');

      const authError = new Error('Unauthorized access');
      expect(delegator.classifyError(authError)).toBe('non-retryable');

      const syntaxError = new Error('Syntax error in request');
      expect(delegator.classifyError(syntaxError)).toBe('non-retryable');
    });

    it('should default to non-retryable for unknown errors', () => {
      const unknownError = new Error('Something unexpected happened');
      expect(delegator.classifyError(unknownError)).toBe('non-retryable');
    });
  });

  describe('getAvailableAgents', () => {
    it('should return list of available agents', () => {
      const agents = delegator.getAvailableAgents();

      expect(Array.isArray(agents)).toBe(true);
      expect(agents).toContain('backend-developer');
      expect(agents).toContain('frontend-developer');
      expect(agents).toContain('rails-backend-expert');
      expect(agents).toContain('nestjs-backend-expert');
    });
  });

  describe('getAgentDescription', () => {
    it('should return agent description for known agents', () => {
      const description = delegator.getAgentDescription('backend-developer');
      expect(description).toContain('backend');
    });

    it('should return unknown for unknown agents', () => {
      const description = delegator.getAgentDescription('unknown-agent');
      expect(description).toBe('Unknown agent');
    });
  });

  describe('buildGreenPhasePrompt', () => {
    it('should build comprehensive GREEN phase prompt', () => {
      const fixTask = {
        description: 'Fix authentication bug',
        failingTest: { path: 'test/auth.test.js' },
        rootCause: 'Missing token validation',
        strategy: 'Add JWT validation',
        affectedFiles: ['src/auth.js']
      };

      const prompt = delegator.buildGreenPhasePrompt(
        fixTask,
        { currentPhase: 'red' },
        'session-123',
        null
      );

      expect(prompt).toContain('TDD GREEN Phase');
      expect(prompt).toContain('session-123');
      expect(prompt).toContain('Fix authentication bug');
      expect(prompt).toContain('test/auth.test.js');
      expect(prompt).toContain('Missing token validation');
      expect(prompt).toContain('Add JWT validation');
      expect(prompt).toContain('src/auth.js');
      expect(prompt).toContain('Response Format');
    });

    it('should include retry context when provided', () => {
      const fixTask = { description: 'Fix bug' };
      const retryContext = {
        attemptNumber: 2,
        previousFailure: 'Tests failed'
      };

      const prompt = delegator.buildGreenPhasePrompt(
        fixTask,
        {},
        'session-123',
        retryContext
      );

      expect(prompt).toContain('Previous Attempt Failed');
      expect(prompt).toContain('Attempt: 2');
      expect(prompt).toContain('Tests failed');
    });
  });

  describe('buildRefactorPhasePrompt', () => {
    it('should build comprehensive REFACTOR phase prompt', () => {
      const greenResult = {
        codeChanges: [{ filePath: 'src/auth.js' }]
      };
      const qualityTargets = {
        maxComplexity: 10,
        maxMethodLength: 50,
        codeSmells: ['long-method']
      };

      const prompt = delegator.buildRefactorPhasePrompt(
        greenResult,
        { currentPhase: 'green' },
        'session-123',
        qualityTargets
      );

      expect(prompt).toContain('TDD REFACTOR Phase');
      expect(prompt).toContain('session-123');
      expect(prompt).toContain('Max Cyclomatic Complexity: 10');
      expect(prompt).toContain('Max Method Length: 50');
      expect(prompt).toContain('long-method');
      expect(prompt).toContain('Response Format');
    });
  });
});
