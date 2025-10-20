/**
 * Tests for REFACTOR Phase Coordinator
 */

const RefactorPhaseCoordinator = require('../../workflow/refactor-phase-coordinator');

describe('RefactorPhaseCoordinator', () => {
  let coordinator;
  let mockTaskDelegator;

  beforeEach(() => {
    mockTaskDelegator = jest.fn();
    coordinator = new RefactorPhaseCoordinator({
      taskDelegator: mockTaskDelegator,
      logger: jest.fn()
    });
  });

  describe('Constructor', () => {
    it('should initialize with default refactor timeout', () => {
      expect(coordinator.refactorTimeout).toBe(600000); // 10 minutes
    });

    it('should initialize with default max complexity increase', () => {
      expect(coordinator.maxComplexityIncrease).toBe(0);
    });

    it('should initialize with quality targets', () => {
      expect(coordinator.qualityTargets.maintainTestPassage).toBe(true);
      expect(coordinator.qualityTargets.noComplexityIncrease).toBe(true);
      expect(coordinator.qualityTargets.improveReadability).toBe(true);
    });

    it('should initialize with code smells list', () => {
      expect(coordinator.codeSmells).toContain('longMethod');
      expect(coordinator.codeSmells).toContain('duplicatedCode');
      expect(coordinator.codeSmells).toContain('magicNumbers');
    });

    it('should allow custom configuration', () => {
      const custom = new RefactorPhaseCoordinator({
        refactorTimeout: 300000,
        maxComplexityIncrease: 5
      });

      expect(custom.refactorTimeout).toBe(300000);
      expect(custom.maxComplexityIncrease).toBe(5);
    });
  });

  describe('coordinateRefactorPhase', () => {
    let validContext;
    let successResponse;

    beforeEach(() => {
      validContext = {
        greenPhaseResult: {
          codeChanges: [
            {
              filePath: 'lib/auth/validator.js',
              changeType: 'modified',
              linesAdded: 10,
              linesRemoved: 5
            }
          ]
        },
        tddState: {
          currentPhase: 'green',
          sessionId: 'session-123'
        },
        specialist: 'backend-developer',
        sessionId: 'session-123'
      };

      successResponse = {
        success: true,
        codeChanges: [
          {
            filePath: 'lib/auth/validator.js',
            changeType: 'modified',
            linesAdded: 12,
            linesRemoved: 8
          }
        ],
        qualityImprovements: [
          'Extracted method for token validation',
          'Removed magic numbers',
          'Improved variable naming'
        ],
        testValidation: {
          allTestsPassing: true
        },
        complexityMetrics: {
          before: 15,
          after: 12
        }
      };

      mockTaskDelegator.mockResolvedValue(successResponse);
    });

    it('should throw error if context is null', async () => {
      await expect(coordinator.coordinateRefactorPhase(null)).rejects.toThrow('Refactoring context is required');
    });

    it('should throw error if greenPhaseResult missing', async () => {
      const invalid = { ...validContext };
      delete invalid.greenPhaseResult;

      await expect(coordinator.coordinateRefactorPhase(invalid)).rejects.toThrow('greenPhaseResult is required');
    });

    it('should throw error if codeChanges missing', async () => {
      const invalid = {
        ...validContext,
        greenPhaseResult: {}
      };

      await expect(coordinator.coordinateRefactorPhase(invalid)).rejects.toThrow('greenPhaseResult.codeChanges is required');
    });

    it('should throw error if tddState not in GREEN phase', async () => {
      const invalid = {
        ...validContext,
        tddState: { currentPhase: 'red' }
      };

      await expect(coordinator.coordinateRefactorPhase(invalid)).rejects.toThrow('REFACTOR phase requires GREEN phase complete');
    });

    it('should successfully coordinate refactoring', async () => {
      const result = await coordinator.coordinateRefactorPhase(validContext);

      expect(result.success).toBe(true);
      expect(mockTaskDelegator).toHaveBeenCalledTimes(1);
    });

    it('should include code changes in result', async () => {
      const result = await coordinator.coordinateRefactorPhase(validContext);

      expect(result.codeChanges).toHaveLength(1);
      expect(result.codeChanges[0].filePath).toBe('lib/auth/validator.js');
    });

    it('should include quality improvements in result', async () => {
      const result = await coordinator.coordinateRefactorPhase(validContext);

      expect(result.qualityImprovements).toHaveLength(3);
      expect(result.qualityImprovements[0]).toContain('Extracted method');
    });

    it('should include test validation in result', async () => {
      const result = await coordinator.coordinateRefactorPhase(validContext);

      expect(result.testValidation.allTestsPassing).toBe(true);
    });

    it('should include complexity metrics in result', async () => {
      const result = await coordinator.coordinateRefactorPhase(validContext);

      expect(result.complexityMetrics.before).toBe(15);
      expect(result.complexityMetrics.after).toBe(12);
    });

    it('should measure refactoring duration', async () => {
      const result = await coordinator.coordinateRefactorPhase(validContext);

      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should include validation result', async () => {
      const result = await coordinator.coordinateRefactorPhase(validContext);

      expect(result.validation).toBeDefined();
      expect(result.validation.passed).toBe(true);
    });
  });

  describe('buildRefactorRequest', () => {
    it('should build complete refactor request', () => {
      const greenPhaseResult = {
        codeChanges: [{ filePath: 'test.js' }]
      };
      const qualityGoals = {
        improveReadability: true,
        removeCodeSmells: true
      };

      const request = coordinator.buildRefactorRequest(greenPhaseResult, qualityGoals);

      expect(request.type).toBe('code-refactoring');
      expect(request.tddPhase).toBe('refactor');
      expect(request.baselineCode).toEqual(greenPhaseResult.codeChanges);
    });

    it('should include quality targets', () => {
      const request = coordinator.buildRefactorRequest(
        { codeChanges: [] },
        coordinator.qualityTargets
      );

      expect(request.qualityTargets).toEqual(coordinator.qualityTargets);
    });

    it('should include constraints', () => {
      const request = coordinator.buildRefactorRequest(
        { codeChanges: [] },
        {}
      );

      expect(request.constraints.timeout).toBe(coordinator.refactorTimeout);
      expect(request.constraints.mustMaintainTestPassage).toBe(true);
      expect(request.constraints.maxComplexityIncrease).toBe(0);
      expect(request.constraints.noFunctionalChanges).toBe(true);
    });

    it('should include code smells to address', () => {
      const request = coordinator.buildRefactorRequest(
        { codeChanges: [] },
        {}
      );

      expect(request.codeSmellsToAddress).toEqual(coordinator.codeSmells);
    });

    it('should include expected response fields', () => {
      const request = coordinator.buildRefactorRequest(
        { codeChanges: [] },
        {}
      );

      expect(request.expectedResponse.fields).toContain('success');
      expect(request.expectedResponse.fields).toContain('codeChanges');
      expect(request.expectedResponse.fields).toContain('qualityImprovements');
      expect(request.expectedResponse.fields).toContain('testValidation');
      expect(request.expectedResponse.fields).toContain('complexityMetrics');
    });
  });

  describe('parseRefactorResponse', () => {
    it('should throw error for null response', () => {
      expect(() => coordinator.parseRefactorResponse(null, 'test-agent')).toThrow('returned null/undefined response');
    });

    it('should parse complete response', () => {
      const response = {
        success: true,
        codeChanges: [],
        qualityImprovements: [],
        testValidation: {},
        complexityMetrics: {}
      };

      const parsed = coordinator.parseRefactorResponse(response, 'test-agent');

      expect(parsed.success).toBe(true);
      expect(Array.isArray(parsed.codeChanges)).toBe(true);
      expect(Array.isArray(parsed.qualityImprovements)).toBe(true);
    });

    it('should ensure arrays for codeChanges and qualityImprovements', () => {
      const response = {
        success: true,
        codeChanges: null,
        qualityImprovements: null,
        testValidation: {},
        complexityMetrics: {}
      };

      const parsed = coordinator.parseRefactorResponse(response, 'test-agent');

      expect(Array.isArray(parsed.codeChanges)).toBe(true);
      expect(Array.isArray(parsed.qualityImprovements)).toBe(true);
    });

    it('should default empty objects for validation and metrics', () => {
      const response = {
        success: true,
        codeChanges: [],
        qualityImprovements: []
      };

      const parsed = coordinator.parseRefactorResponse(response, 'test-agent');

      expect(parsed.testValidation).toEqual({});
      expect(parsed.complexityMetrics).toEqual({});
    });
  });

  describe('validateRefactoringQuality', () => {
    let validResponse;
    let greenPhaseResult;

    beforeEach(() => {
      validResponse = {
        success: true,
        codeChanges: [{ filePath: 'test.js' }],
        qualityImprovements: ['Improved naming', 'Extracted method'],
        testValidation: { allTestsPassing: true },
        complexityMetrics: { before: 15, after: 12 }
      };

      greenPhaseResult = {
        codeChanges: [{ filePath: 'test.js' }]
      };
    });

    it('should pass for valid refactoring', () => {
      const validation = coordinator.validateRefactoringQuality(validResponse, greenPhaseResult);

      expect(validation.passed).toBe(true);
      expect(validation.failureReason).toBeNull();
    });

    it('should fail if refactoring reported failure', () => {
      validResponse.success = false;

      const validation = coordinator.validateRefactoringQuality(validResponse, greenPhaseResult);

      expect(validation.passed).toBe(false);
      expect(validation.failureReason).toContain('refactoring failure');
    });

    it('should fail if tests not passing', () => {
      validResponse.testValidation.allTestsPassing = false;

      const validation = coordinator.validateRefactoringQuality(validResponse, greenPhaseResult);

      expect(validation.passed).toBe(false);
      expect(validation.failureReason).toContain('Tests failing after refactoring');
    });

    it('should fail if complexity increased', () => {
      validResponse.complexityMetrics = { before: 10, after: 15 };

      const validation = coordinator.validateRefactoringQuality(validResponse, greenPhaseResult);

      expect(validation.passed).toBe(false);
      expect(validation.failureReason).toContain('Complexity increased');
    });

    it('should allow no complexity increase', () => {
      validResponse.complexityMetrics = { before: 10, after: 10 };

      const validation = coordinator.validateRefactoringQuality(validResponse, greenPhaseResult);

      expect(validation.passed).toBe(true);
      expect(validation.checks.noComplexityIncrease).toBe(true);
    });

    it('should allow complexity decrease', () => {
      validResponse.complexityMetrics = { before: 15, after: 10 };

      const validation = coordinator.validateRefactoringQuality(validResponse, greenPhaseResult);

      expect(validation.passed).toBe(true);
      expect(validation.checks.noComplexityIncrease).toBe(true);
    });

    it('should note if no quality improvements', () => {
      validResponse.qualityImprovements = [];

      const validation = coordinator.validateRefactoringQuality(validResponse, greenPhaseResult);

      expect(validation.passed).toBe(true); // Not a failure
      expect(validation.checks.qualityImproved).toBe(false);
    });

    it('should note if too many files changed', () => {
      validResponse.codeChanges = [
        { filePath: 'file1.js' },
        { filePath: 'file2.js' },
        { filePath: 'file3.js' }
      ];

      const validation = coordinator.validateRefactoringQuality(validResponse, greenPhaseResult);

      expect(validation.passed).toBe(true); // Not a failure, just warning
      expect(validation.checks.reasonableChanges).toBe(false);
    });

    it('should include all validation checks', () => {
      const validation = coordinator.validateRefactoringQuality(validResponse, greenPhaseResult);

      expect(validation.checks.success).toBeDefined();
      expect(validation.checks.testsStillPass).toBeDefined();
      expect(validation.checks.noComplexityIncrease).toBeDefined();
      expect(validation.checks.qualityImproved).toBeDefined();
      expect(validation.checks.reasonableChanges).toBeDefined();
    });
  });

  describe('buildQualitySummary', () => {
    it('should build summary for successful refactoring', () => {
      const refactorResult = {
        success: true,
        qualityImprovements: ['Improvement 1', 'Improvement 2'],
        codeChanges: [{ filePath: 'test.js' }],
        testValidation: { allTestsPassing: true },
        complexityMetrics: { before: 15, after: 12 },
        duration: 5000
      };

      const summary = coordinator.buildQualitySummary(refactorResult);

      expect(summary.refactored).toBe(true);
      expect(summary.improvementCount).toBe(2);
      expect(summary.filesChanged).toBe(1);
      expect(summary.testsStillPass).toBe(true);
    });

    it('should build summary for failed refactoring', () => {
      const refactorResult = {
        success: false,
        error: 'Refactoring failed',
        recommendation: 'Keep GREEN phase implementation'
      };

      const summary = coordinator.buildQualitySummary(refactorResult);

      expect(summary.refactored).toBe(false);
      expect(summary.reason).toBe('Refactoring failed');
      expect(summary.recommendation).toBe('Keep GREEN phase implementation');
    });

    it('should calculate complexity change', () => {
      const refactorResult = {
        success: true,
        qualityImprovements: [],
        codeChanges: [],
        testValidation: {},
        complexityMetrics: { before: 15, after: 12 }
      };

      const summary = coordinator.buildQualitySummary(refactorResult);

      expect(summary.complexityChange.available).toBe(true);
      expect(summary.complexityChange.change).toBe(-3);
      expect(summary.complexityChange.improved).toBe(true);
    });
  });

  describe('calculateComplexityChange', () => {
    it('should calculate complexity reduction', () => {
      const metrics = { before: 15, after: 12 };

      const change = coordinator.calculateComplexityChange(metrics);

      expect(change.available).toBe(true);
      expect(change.before).toBe(15);
      expect(change.after).toBe(12);
      expect(change.change).toBe(-3);
      expect(change.percentChange).toBe(-20);
      expect(change.improved).toBe(true);
    });

    it('should calculate complexity increase', () => {
      const metrics = { before: 10, after: 15 };

      const change = coordinator.calculateComplexityChange(metrics);

      expect(change.change).toBe(5);
      expect(change.percentChange).toBe(50);
      expect(change.improved).toBe(false);
    });

    it('should handle no change', () => {
      const metrics = { before: 10, after: 10 };

      const change = coordinator.calculateComplexityChange(metrics);

      expect(change.change).toBe(0);
      expect(change.percentChange).toBe(0);
      expect(change.improved).toBe(false);
    });

    it('should handle missing metrics', () => {
      const change = coordinator.calculateComplexityChange(null);

      expect(change.available).toBe(false);
    });

    it('should handle incomplete metrics', () => {
      const change = coordinator.calculateComplexityChange({ before: 10 });

      expect(change.available).toBe(false);
    });
  });

  describe('Error Handling', () => {
    let validContext;

    beforeEach(() => {
      validContext = {
        greenPhaseResult: {
          codeChanges: [{ filePath: 'test.js' }]
        },
        tddState: { currentPhase: 'green' },
        specialist: 'backend-developer',
        sessionId: 'session-123'
      };
    });

    it('should handle refactoring errors gracefully', async () => {
      mockTaskDelegator.mockRejectedValue(new Error('Refactoring failed'));

      const result = await coordinator.coordinateRefactorPhase(validContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Refactoring failed');
      expect(result.recommendation).toBeDefined();
    });

    it('should recommend keeping GREEN implementation on failure', async () => {
      mockTaskDelegator.mockRejectedValue(new Error('Error'));

      const result = await coordinator.coordinateRefactorPhase(validContext);

      expect(result.recommendation).toContain('Keep GREEN phase implementation');
    });

    it('should return failed result on validation failure', async () => {
      mockTaskDelegator.mockResolvedValue({
        success: true,
        codeChanges: [],
        qualityImprovements: [],
        testValidation: { allTestsPassing: false },
        complexityMetrics: {}
      });

      const result = await coordinator.coordinateRefactorPhase(validContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('validation');
    });
  });

  describe('Custom Refactor Goals', () => {
    let validContext;

    beforeEach(() => {
      validContext = {
        greenPhaseResult: {
          codeChanges: [{ filePath: 'test.js' }]
        },
        tddState: { currentPhase: 'green' },
        specialist: 'backend-developer',
        sessionId: 'session-123',
        refactorGoals: {
          removeCodeSmells: true,
          improvePerformance: true,
          customGoal: 'Optimize database queries'
        }
      };

      mockTaskDelegator.mockResolvedValue({
        success: true,
        codeChanges: [],
        qualityImprovements: ['Performance improved'],
        testValidation: { allTestsPassing: true },
        complexityMetrics: { before: 10, after: 10 }
      });
    });

    it('should use custom refactor goals if provided', async () => {
      await coordinator.coordinateRefactorPhase(validContext);

      expect(mockTaskDelegator).toHaveBeenCalledWith(
        'backend-developer',
        expect.objectContaining({
          qualityTargets: validContext.refactorGoals
        })
      );
    });

    it('should use default quality targets if no custom goals', async () => {
      delete validContext.refactorGoals;

      await coordinator.coordinateRefactorPhase(validContext);

      expect(mockTaskDelegator).toHaveBeenCalledWith(
        'backend-developer',
        expect.objectContaining({
          qualityTargets: coordinator.qualityTargets
        })
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty quality improvements', () => {
      const refactorResult = {
        success: true,
        qualityImprovements: [],
        codeChanges: [{ filePath: 'test.js' }],
        testValidation: { allTestsPassing: true },
        complexityMetrics: {}
      };

      const summary = coordinator.buildQualitySummary(refactorResult);

      expect(summary.improvementCount).toBe(0);
    });

    it('should handle missing test validation', () => {
      const response = {
        success: true,
        codeChanges: [],
        qualityImprovements: [],
        complexityMetrics: {}
      };

      const validation = coordinator.validateRefactoringQuality(
        response,
        { codeChanges: [] }
      );

      expect(validation.checks.testsStillPass).toBe(false);
    });

    it('should handle missing complexity metrics', () => {
      const response = {
        success: true,
        codeChanges: [],
        qualityImprovements: ['Improvement'],
        testValidation: { allTestsPassing: true },
        complexityMetrics: {}
      };

      const validation = coordinator.validateRefactoringQuality(
        response,
        { codeChanges: [] }
      );

      expect(validation.passed).toBe(true);
      // No complexity check performed if metrics missing
    });
  });
});
