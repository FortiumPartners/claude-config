/**
 * Tests for Multi-Hypothesis Validator
 */

const MultiHypothesisValidator = require('../../strategy/multi-hypothesis-validator');

describe('MultiHypothesisValidator', () => {
  let validator;
  let mockDelegator;
  let validHypotheses;

  beforeEach(() => {
    // Mock delegator
    mockDelegator = {
      analyzeRootCause: jest.fn()
    };

    validator = new MultiHypothesisValidator(mockDelegator);

    validHypotheses = [
      {
        bugReport: { title: 'Bug 1' },
        testCode: 'test code 1',
        stackTrace: { raw: 'stack 1' },
        hypothesis: 'Null pointer exception',
        complexity: 4
      },
      {
        bugReport: { title: 'Bug 2' },
        testCode: 'test code 2',
        stackTrace: { raw: 'stack 2' },
        hypothesis: 'Race condition',
        complexity: 6
      }
    ];
  });

  describe('Constructor', () => {
    it('should throw error if delegator missing', () => {
      expect(() => new MultiHypothesisValidator(null)).toThrow('delegator is required');
    });

    it('should initialize with default confidence threshold', () => {
      expect(validator.confidenceThreshold).toBe(0.7);
    });

    it('should initialize with default max hypotheses', () => {
      expect(validator.maxHypotheses).toBe(3);
    });

    it('should initialize with default tie threshold', () => {
      expect(validator.tieThreshold).toBe(0.1);
    });

    it('should allow custom configuration', () => {
      const custom = new MultiHypothesisValidator(mockDelegator, {
        confidenceThreshold: 0.8,
        maxHypotheses: 5,
        tieThreshold: 0.05
      });

      expect(custom.confidenceThreshold).toBe(0.8);
      expect(custom.maxHypotheses).toBe(5);
      expect(custom.tieThreshold).toBe(0.05);
    });
  });

  describe('validateHypotheses', () => {
    it('should throw error for null hypotheses', async () => {
      await expect(validator.validateHypotheses(null)).rejects.toThrow('must be an array');
    });

    it('should throw error for empty array', async () => {
      await expect(validator.validateHypotheses([])).rejects.toThrow('At least one hypothesis');
    });

    it('should throw error for missing required fields', async () => {
      const invalid = [{ bugReport: {}, testCode: 'test' }];
      await expect(validator.validateHypotheses(invalid)).rejects.toThrow('missing required fields');
    });

    it('should throw error for missing hypothesis description', async () => {
      const invalid = [{
        bugReport: { title: 'Bug' },
        testCode: 'test',
        stackTrace: { raw: 'stack' }
      }];
      await expect(validator.validateHypotheses(invalid)).rejects.toThrow('missing hypothesis description');
    });

    it('should validate multiple hypotheses in parallel', async () => {
      mockDelegator.analyzeRootCause
        .mockResolvedValueOnce({
          confidence: 0.85,
          rootCause: { description: 'Null pointer' },
          fixRecommendations: [{ description: 'Add null check' }]
        })
        .mockResolvedValueOnce({
          confidence: 0.75,
          rootCause: { description: 'Race condition' },
          fixRecommendations: [{ description: 'Add synchronization' }]
        });

      const result = await validator.validateHypotheses(validHypotheses);

      expect(mockDelegator.analyzeRootCause).toHaveBeenCalledTimes(2);
      expect(result.selectedHypothesis).toBeDefined();
      expect(result.selectedHypothesis.confidence).toBe(0.85);
    });

    it('should select hypothesis with highest confidence', async () => {
      mockDelegator.analyzeRootCause
        .mockResolvedValueOnce({ confidence: 0.75 })
        .mockResolvedValueOnce({ confidence: 0.90 });

      const result = await validator.validateHypotheses(validHypotheses);

      expect(result.selectedHypothesis.confidence).toBe(0.90);
      expect(result.alternatives).toHaveLength(1);
      expect(result.alternatives[0].confidence).toBe(0.75);
    });

    it('should handle partial failures gracefully', async () => {
      mockDelegator.analyzeRootCause
        .mockRejectedValueOnce(new Error('Analysis failed'))
        .mockResolvedValueOnce({ confidence: 0.80 });

      const result = await validator.validateHypotheses(validHypotheses);

      expect(result.selectedHypothesis.confidence).toBe(0.80);
      expect(result.alternatives).toHaveLength(0);
    });

    it('should throw error if all analyses fail', async () => {
      mockDelegator.analyzeRootCause.mockRejectedValue(new Error('Analysis failed'));

      await expect(validator.validateHypotheses(validHypotheses)).rejects.toThrow('All hypothesis analyses failed');
    });

    it('should limit hypotheses to max', async () => {
      const manyHypotheses = [
        validHypotheses[0],
        validHypotheses[1],
        validHypotheses[0], // 3rd
        validHypotheses[1]  // 4th (should be ignored)
      ];

      mockDelegator.analyzeRootCause.mockResolvedValue({ confidence: 0.80 });

      await validator.validateHypotheses(manyHypotheses);

      expect(mockDelegator.analyzeRootCause).toHaveBeenCalledTimes(3); // Max is 3
    });

    it('should detect tie between top hypotheses', async () => {
      mockDelegator.analyzeRootCause
        .mockResolvedValueOnce({ confidence: 0.80 })
        .mockResolvedValueOnce({ confidence: 0.79 }); // Within 0.1 threshold

      const result = await validator.validateHypotheses(validHypotheses);

      expect(result.isTied).toBe(true);
      expect(result.selectionReason).toContain('Tie detected');
      expect(result.requiresEscalation).toBe(true);
    });

    it('should not detect tie if difference > threshold', async () => {
      mockDelegator.analyzeRootCause
        .mockResolvedValueOnce({ confidence: 0.85 })
        .mockResolvedValueOnce({ confidence: 0.70 }); // >0.1 difference

      const result = await validator.validateHypotheses(validHypotheses);

      expect(result.isTied).toBe(false);
      expect(result.requiresEscalation).toBe(false);
    });

    it('should require escalation for low confidence', async () => {
      mockDelegator.analyzeRootCause.mockResolvedValue({ confidence: 0.65 });

      const result = await validator.validateHypotheses([validHypotheses[0]]);

      expect(result.requiresEscalation).toBe(true);
      expect(result.selectionReason).toContain('below threshold');
    });

    it('should include hypothesis description in results', async () => {
      mockDelegator.analyzeRootCause.mockResolvedValue({
        confidence: 0.85,
        rootCause: { description: 'Root cause' }
      });

      const result = await validator.validateHypotheses([validHypotheses[0]]);

      expect(result.selectedHypothesis.hypothesis).toBe('Null pointer exception');
    });
  });

  describe('compareHypotheses', () => {
    it('should throw error for missing hypotheses', () => {
      expect(() => validator.compareHypotheses(null, {})).toThrow('Both hypotheses are required');
      expect(() => validator.compareHypotheses({}, null)).toThrow('Both hypotheses are required');
    });

    it('should detect tie', () => {
      const hyp1 = { confidence: 0.80 };
      const hyp2 = { confidence: 0.79 };

      const result = validator.compareHypotheses(hyp1, hyp2);

      expect(result.winner).toBe('tie');
      expect(result.reason).toContain('too close');
    });

    it('should pick hyp1 as winner', () => {
      const hyp1 = { confidence: 0.85 };
      const hyp2 = { confidence: 0.70 };

      const result = validator.compareHypotheses(hyp1, hyp2);

      expect(result.winner).toBe('hyp1');
      expect(result.confidenceDelta).toBeCloseTo(0.15, 2);
    });

    it('should pick hyp2 as winner', () => {
      const hyp1 = { confidence: 0.70 };
      const hyp2 = { confidence: 0.85 };

      const result = validator.compareHypotheses(hyp1, hyp2);

      expect(result.winner).toBe('hyp2');
      expect(result.confidenceDelta).toBeCloseTo(0.15, 2);
    });

    it('should calculate confidence delta', () => {
      const hyp1 = { confidence: 0.90 };
      const hyp2 = { confidence: 0.60 };

      const result = validator.compareHypotheses(hyp1, hyp2);

      expect(result.confidenceDelta).toBeCloseTo(0.30, 2);
    });
  });

  describe('documentAlternatives', () => {
    it('should return empty documentation for no alternatives', () => {
      const result = validator.documentAlternatives([]);

      expect(result.summary).toContain('No alternative hypotheses');
      expect(result.hypotheses).toEqual([]);
    });

    it('should return empty documentation for null alternatives', () => {
      const result = validator.documentAlternatives(null);

      expect(result.summary).toContain('No alternative hypotheses');
    });

    it('should document single alternative', () => {
      const alternatives = [{
        hypothesis: 'Race condition',
        confidence: 0.75,
        rootCause: { description: 'Async issue' },
        fixRecommendations: []
      }];

      const result = validator.documentAlternatives(alternatives);

      expect(result.summary).toContain('1 alternative hypothesis');
      expect(result.summary).toContain('Race condition');
      expect(result.summary).toContain('0.75');
    });

    it('should document multiple alternatives', () => {
      const alternatives = [
        { hypothesis: 'Hyp 1', confidence: 0.75 },
        { hypothesis: 'Hyp 2', confidence: 0.70 }
      ];

      const result = validator.documentAlternatives(alternatives);

      expect(result.summary).toContain('2 alternative hypotheses');
      expect(result.hypotheses).toHaveLength(2);
    });

    it('should include rejection reason for low confidence', () => {
      const alternatives = [{
        hypothesis: 'Low confidence hyp',
        confidence: 0.65,
        rootCause: { description: 'Unknown' }
      }];

      const result = validator.documentAlternatives(alternatives);

      expect(result.hypotheses[0].rejectionReason).toContain('Low confidence');
      expect(result.hypotheses[0].rejectionReason).toContain('0.65');
    });

    it('should include all hypothesis data', () => {
      const alternatives = [{
        hypothesis: 'Test hyp',
        confidence: 0.75,
        rootCause: { description: 'Root cause' },
        fixRecommendations: [{ description: 'Fix' }]
      }];

      const result = validator.documentAlternatives(alternatives);

      expect(result.hypotheses[0]).toHaveProperty('description');
      expect(result.hypotheses[0]).toHaveProperty('confidence');
      expect(result.hypotheses[0]).toHaveProperty('rootCause');
      expect(result.hypotheses[0]).toHaveProperty('fixRecommendations');
    });
  });

  describe('createHypothesisFromPattern', () => {
    it('should create hypothesis from null-pointer pattern', () => {
      const baseContext = {
        bugReport: { title: 'Bug' },
        testCode: 'test',
        stackTrace: { raw: 'stack' }
      };

      const hypothesis = validator.createHypothesisFromPattern(baseContext, 'null-pointer');

      expect(hypothesis.hypothesis).toContain('Null pointer');
      expect(hypothesis.pattern).toBe('null-pointer');
      expect(hypothesis.bugReport).toBe(baseContext.bugReport);
    });

    it('should create hypothesis from race-condition pattern', () => {
      const baseContext = {
        bugReport: { title: 'Bug' },
        testCode: 'test',
        stackTrace: { raw: 'stack' }
      };

      const hypothesis = validator.createHypothesisFromPattern(baseContext, 'race-condition');

      expect(hypothesis.hypothesis).toContain('Race condition');
      expect(hypothesis.pattern).toBe('race-condition');
    });

    it('should handle unknown pattern', () => {
      const baseContext = {
        bugReport: { title: 'Bug' },
        testCode: 'test',
        stackTrace: { raw: 'stack' }
      };

      const hypothesis = validator.createHypothesisFromPattern(baseContext, 'unknown-pattern');

      expect(hypothesis.hypothesis).toContain('Unknown pattern');
      expect(hypothesis.pattern).toBe('unknown-pattern');
    });

    it('should support all predefined patterns', () => {
      const patterns = [
        'null-pointer',
        'undefined-variable',
        'type-mismatch',
        'race-condition',
        'boundary-condition',
        'logic-error',
        'resource-leak',
        'configuration'
      ];

      const baseContext = {
        bugReport: { title: 'Bug' },
        testCode: 'test',
        stackTrace: { raw: 'stack' }
      };

      patterns.forEach(pattern => {
        const hypothesis = validator.createHypothesisFromPattern(baseContext, pattern);
        expect(hypothesis.pattern).toBe(pattern);
        expect(hypothesis.hypothesis).toBeDefined();
      });
    });
  });

  describe('analyzeHypothesis', () => {
    it('should call delegator with correct context', async () => {
      mockDelegator.analyzeRootCause.mockResolvedValue({
        confidence: 0.80,
        rootCause: { description: 'Root cause' }
      });

      const hypothesis = validHypotheses[0];
      const result = await validator.analyzeHypothesis(hypothesis, 0);

      expect(mockDelegator.analyzeRootCause).toHaveBeenCalledWith(
        expect.objectContaining({
          bugReport: hypothesis.bugReport,
          testCode: hypothesis.testCode,
          stackTrace: hypothesis.stackTrace,
          complexity: 4,
          hypothesis: hypothesis.hypothesis,
          hypothesisIndex: 0
        })
      );

      expect(result.hypothesis).toBe(hypothesis.hypothesis);
      expect(result.hypothesisIndex).toBe(0);
    });

    it('should use default complexity if not provided', async () => {
      mockDelegator.analyzeRootCause.mockResolvedValue({ confidence: 0.80 });

      const hypothesisNoComplexity = { ...validHypotheses[0] };
      delete hypothesisNoComplexity.complexity;

      await validator.analyzeHypothesis(hypothesisNoComplexity, 0);

      expect(mockDelegator.analyzeRootCause).toHaveBeenCalledWith(
        expect.objectContaining({ complexity: 4 })
      );
    });

    it('should add hypothesis context to error', async () => {
      const error = new Error('Analysis failed');
      mockDelegator.analyzeRootCause.mockRejectedValue(error);

      await expect(validator.analyzeHypothesis(validHypotheses[0], 0)).rejects.toThrow('Analysis failed');

      try {
        await validator.analyzeHypothesis(validHypotheses[0], 0);
      } catch (err) {
        expect(err.hypothesisIndex).toBe(0);
        expect(err.hypothesis).toBe('Null pointer exception');
      }
    });
  });

  describe('selectBestHypothesis', () => {
    it('should select hypothesis with highest confidence', () => {
      const analyses = [
        { confidence: 0.70, hypothesis: 'Hyp 1' },
        { confidence: 0.85, hypothesis: 'Hyp 2' },
        { confidence: 0.75, hypothesis: 'Hyp 3' }
      ];

      const result = validator.selectBestHypothesis(analyses);

      expect(result.selectedHypothesis.confidence).toBe(0.85);
      expect(result.alternatives).toHaveLength(2);
    });

    it('should detect tie when confidence difference ≤ threshold', () => {
      const analyses = [
        { confidence: 0.80, hypothesis: 'Hyp 1' },
        { confidence: 0.79, hypothesis: 'Hyp 2' }
      ];

      const result = validator.selectBestHypothesis(analyses);

      expect(result.isTied).toBe(true);
      expect(result.selectionReason).toContain('Tie detected');
    });

    it('should not detect tie when confidence difference > threshold', () => {
      const analyses = [
        { confidence: 0.85, hypothesis: 'Hyp 1' },
        { confidence: 0.70, hypothesis: 'Hyp 2' }
      ];

      const result = validator.selectBestHypothesis(analyses);

      expect(result.isTied).toBe(false);
    });

    it('should require escalation for tied results', () => {
      const analyses = [
        { confidence: 0.80, hypothesis: 'Hyp 1' },
        { confidence: 0.79, hypothesis: 'Hyp 2' }
      ];

      const result = validator.selectBestHypothesis(analyses);

      expect(result.requiresEscalation).toBe(true);
    });

    it('should require escalation for low confidence', () => {
      const analyses = [{ confidence: 0.65, hypothesis: 'Hyp 1' }];

      const result = validator.selectBestHypothesis(analyses);

      expect(result.requiresEscalation).toBe(true);
      expect(result.selectionReason).toContain('below threshold');
    });

    it('should not require escalation for high confidence', () => {
      const analyses = [{ confidence: 0.85, hypothesis: 'Hyp 1' }];

      const result = validator.selectBestHypothesis(analyses);

      expect(result.requiresEscalation).toBe(false);
    });
  });
});
