/**
 * Tests for Fix Task Preparer
 */

const FixTaskPreparer = require('../../strategy/fix-task-preparer');

describe('FixTaskPreparer', () => {
  let preparer;
  let validContext;

  beforeEach(() => {
    preparer = new FixTaskPreparer();

    validContext = {
      bugReport: {
        title: 'Auth fails with null token',
        description: 'Users cannot log in',
        severity: 'high'
      },
      testCode: 'test("auth fails", () => { ... })',
      testFile: 'test/auth.test.js',
      rootCause: {
        description: 'Null pointer exception',
        likelyFile: 'lib/auth.js'
      },
      fixRecommendation: {
        description: 'Add null check',
        priority: 1,
        estimatedTime: 2,
        complexity: 'simple'
      },
      specialistAgent: 'nestjs-backend-expert'
    };
  });

  describe('Constructor', () => {
    it('should initialize with default timeout', () => {
      expect(preparer.timeout).toBe(1800000); // 30 minutes
    });

    it('should initialize with default max retries', () => {
      expect(preparer.maxRetries).toBe(1);
    });

    it('should allow custom configuration', () => {
      const custom = new FixTaskPreparer({ timeout: 60000, maxRetries: 3 });
      expect(custom.timeout).toBe(60000);
      expect(custom.maxRetries).toBe(3);
    });
  });

  describe('prepareFixTask', () => {
    it('should throw error if context missing', () => {
      expect(() => preparer.prepareFixTask(null)).toThrow('Context is required');
    });

    it('should throw error if required fields missing', () => {
      const invalidContext = { bugReport: {} };
      expect(() => preparer.prepareFixTask(invalidContext)).toThrow('missing required field');
    });

    it('should prepare complete fix task', () => {
      const task = preparer.prepareFixTask(validContext);

      expect(task.agent).toBe('nestjs-backend-expert');
      expect(task.task.type).toBe('fix-implementation');
      expect(task.task.description).toContain('Auth fails');
      expect(task.task.tddPhase).toBe('green');
    });

    it('should include code context', () => {
      const task = preparer.prepareFixTask(validContext);

      expect(task.task.codeContext.failingTest.code).toBe(validContext.testCode);
      expect(task.task.codeContext.affectedFiles).toContain('lib/auth.js');
    });

    it('should include fix strategy', () => {
      const task = preparer.prepareFixTask(validContext);

      expect(task.task.fixStrategy.description).toBe('Add null check');
      expect(task.task.fixStrategy.complexity).toBe('simple');
    });

    it('should include default constraints', () => {
      const task = preparer.prepareFixTask(validContext);

      expect(task.task.constraints.maintainCoverage).toBe(true);
      expect(task.task.constraints.minimizeChanges).toBe(true);
    });

    it('should merge custom constraints', () => {
      const contextWithConstraints = {
        ...validContext,
        constraints: { customConstraint: true }
      };

      const task = preparer.prepareFixTask(contextWithConstraints);

      expect(task.task.constraints.customConstraint).toBe(true);
      expect(task.task.constraints.maintainCoverage).toBe(true);
    });

    it('should use TDD state if provided', () => {
      const contextWithTDD = {
        ...validContext,
        tddState: { currentPhase: 'refactor' }
      };

      const task = preparer.prepareFixTask(contextWithTDD);

      expect(task.task.tddPhase).toBe('refactor');
    });

    it('should include timeout configuration', () => {
      const task = preparer.prepareFixTask(validContext);

      expect(task.task.timeout).toBe(1800000);
      expect(task.task.retryAttempts).toBe(1);
    });
  });

  describe('validateContext', () => {
    it('should validate complete context', () => {
      expect(() => preparer.validateContext(validContext)).not.toThrow();
    });

    it('should throw for missing bugReport', () => {
      const invalid = { ...validContext };
      delete invalid.bugReport;
      expect(() => preparer.validateContext(invalid)).toThrow('bugReport');
    });

    it('should throw for invalid bugReport structure', () => {
      const invalid = { ...validContext, bugReport: {} };
      expect(() => preparer.validateContext(invalid)).toThrow('title and description');
    });

    it('should throw for invalid rootCause structure', () => {
      const invalid = { ...validContext, rootCause: {} };
      expect(() => preparer.validateContext(invalid)).toThrow('description');
    });
  });

  describe('prepareMultiComponentFixTask', () => {
    it('should throw error if context missing', () => {
      expect(() => preparer.prepareMultiComponentFixTask(null)).toThrow('Context is required');
    });

    it('should prepare multiple tasks', () => {
      const multiContext = {
        ...validContext,
        fixRecommendations: [
          { description: 'Fix backend', priority: 1 },
          { description: 'Fix frontend', priority: 2 }
        ],
        specialistAgents: ['backend-developer', 'frontend-developer']
      };

      const tasks = preparer.prepareMultiComponentFixTask(multiContext);

      expect(tasks).toHaveLength(2);
      expect(tasks[0].agent).toBe('backend-developer');
      expect(tasks[1].agent).toBe('frontend-developer');
    });

    it('should add dependencies for sequential tasks', () => {
      const multiContext = {
        ...validContext,
        fixRecommendations: [
          { description: 'Fix 1', priority: 1 },
          { description: 'Fix 2', priority: 2 }
        ],
        specialistAgents: ['agent1', 'agent2']
      };

      const tasks = preparer.prepareMultiComponentFixTask(multiContext);

      expect(tasks[1].task.constraints.dependsOn).toBe('agent1');
      expect(tasks[1].task.constraints.waitForCompletion).toBe(true);
    });
  });

  describe('addRetryConfiguration', () => {
    it('should add retry configuration to task', () => {
      const task = preparer.prepareFixTask(validContext);
      const withRetry = preparer.addRetryConfiguration(task, 3, 10000);

      expect(withRetry.task.retryAttempts).toBe(3);
      expect(withRetry.task.retryDelay).toBe(10000);
      expect(withRetry.task.retryStrategy).toBe('exponential-backoff');
    });
  });
});
