/**
 * Multi-Hypothesis Validator
 *
 * Supports parallel investigation of multiple root cause hypotheses.
 * Delegates multiple analysis requests to tech-lead-orchestrator and
 * compares confidence scores to select the best hypothesis.
 *
 * @module lib/deep-debugger/strategy/multi-hypothesis-validator
 */

class MultiHypothesisValidator {
  /**
   * Create a multi-hypothesis validator
   *
   * @param {Object} delegator - Root cause delegator instance
   * @param {Object} [options] - Configuration options
   * @param {number} [options.confidenceThreshold] - Minimum confidence (default: 0.7)
   * @param {number} [options.maxHypotheses] - Maximum hypotheses to test (default: 3)
   * @param {number} [options.tieThreshold] - Confidence difference for tie (default: 0.1)
   */
  constructor(delegator, options = {}) {
    if (!delegator) {
      throw new Error('Root cause delegator is required');
    }

    this.delegator = delegator;
    this.confidenceThreshold = options.confidenceThreshold || 0.7;
    this.maxHypotheses = options.maxHypotheses || 3;
    this.tieThreshold = options.tieThreshold || 0.1;
  }

  /**
   * Validate multiple root cause hypotheses
   *
   * Delegates multiple analysis requests in parallel and selects
   * the hypothesis with the highest confidence score.
   *
   * @param {Object[]} hypotheses - Array of hypothesis contexts
   * @param {Object} hypotheses[].bugReport - Bug report
   * @param {string} hypotheses[].testCode - Recreation test
   * @param {Object} hypotheses[].stackTrace - Stack trace
   * @param {number} hypotheses[].complexity - Estimated complexity
   * @param {string} hypotheses[].hypothesis - Hypothesis description
   * @returns {Promise<Object>} Validation result
   * @returns {Object} return.selectedHypothesis - Best hypothesis
   * @returns {Object[]} return.alternatives - Alternative hypotheses
   * @returns {string} return.selectionReason - Why this hypothesis was selected
   * @returns {boolean} return.isTied - Whether multiple hypotheses had similar confidence
   */
  async validateHypotheses(hypotheses) {
    // Validate input
    this.validateInput(hypotheses);

    // Limit hypotheses to max
    const limitedHypotheses = hypotheses.slice(0, this.maxHypotheses);

    // Delegate analysis for each hypothesis in parallel
    const results = await Promise.allSettled(
      limitedHypotheses.map((hyp, index) =>
        this.analyzeHypothesis(hyp, index)
      )
    );

    // Extract successful analyses
    const analyses = this.extractSuccessfulAnalyses(results, limitedHypotheses);

    // Check if any analyses succeeded
    if (analyses.length === 0) {
      throw new Error('All hypothesis analyses failed');
    }

    // Select best hypothesis
    return this.selectBestHypothesis(analyses);
  }

  /**
   * Validate input hypotheses
   *
   * @param {Object[]} hypotheses - Hypotheses to validate
   * @throws {Error} If input is invalid
   * @private
   */
  validateInput(hypotheses) {
    if (!hypotheses || !Array.isArray(hypotheses)) {
      throw new Error('Hypotheses must be an array');
    }

    if (hypotheses.length === 0) {
      throw new Error('At least one hypothesis is required');
    }

    // Validate each hypothesis
    for (let i = 0; i < hypotheses.length; i++) {
      const hyp = hypotheses[i];
      if (!hyp.bugReport || !hyp.testCode || !hyp.stackTrace) {
        throw new Error(`Hypothesis ${i} missing required fields`);
      }
      if (!hyp.hypothesis) {
        throw new Error(`Hypothesis ${i} missing hypothesis description`);
      }
    }
  }

  /**
   * Analyze single hypothesis
   *
   * @param {Object} hypothesis - Hypothesis context
   * @param {number} index - Hypothesis index
   * @returns {Promise<Object>} Analysis result
   * @private
   */
  async analyzeHypothesis(hypothesis, index) {
    // Build context for delegator
    const context = {
      bugReport: hypothesis.bugReport,
      testCode: hypothesis.testCode,
      stackTrace: hypothesis.stackTrace,
      complexity: hypothesis.complexity || 4,

      // Include hypothesis description in context
      hypothesis: hypothesis.hypothesis,
      hypothesisIndex: index
    };

    try {
      const analysis = await this.delegator.analyzeRootCause(context);

      return {
        ...analysis,
        hypothesis: hypothesis.hypothesis,
        hypothesisIndex: index
      };
    } catch (error) {
      // Re-throw with hypothesis context
      error.hypothesisIndex = index;
      error.hypothesis = hypothesis.hypothesis;
      throw error;
    }
  }

  /**
   * Extract successful analyses from Promise.allSettled results
   *
   * @param {Object[]} results - Promise.allSettled results
   * @param {Object[]} hypotheses - Original hypotheses
   * @returns {Object[]} Successful analyses
   * @private
   */
  extractSuccessfulAnalyses(results, hypotheses) {
    const analyses = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];

      if (result.status === 'fulfilled') {
        analyses.push(result.value);
      } else {
        // Log failure but continue
        console.warn(
          `Hypothesis ${i} analysis failed:`,
          result.reason.message
        );
      }
    }

    return analyses;
  }

  /**
   * Select best hypothesis based on confidence scores
   *
   * @param {Object[]} analyses - Successful analyses
   * @returns {Object} Selection result
   * @private
   */
  selectBestHypothesis(analyses) {
    // Sort by confidence (descending)
    const sorted = [...analyses].sort((a, b) => b.confidence - a.confidence);

    const best = sorted[0];
    const secondBest = sorted[1];

    // Check for tie
    const isTied =
      secondBest &&
      Math.abs(best.confidence - secondBest.confidence) <= this.tieThreshold;

    let selectionReason;

    if (isTied) {
      selectionReason = `Tie detected: Top hypotheses have similar confidence (${best.confidence.toFixed(2)} vs ${secondBest.confidence.toFixed(2)}). Manual review recommended.`;
    } else if (best.confidence >= this.confidenceThreshold) {
      selectionReason = `High confidence (${best.confidence.toFixed(2)}) exceeds threshold (${this.confidenceThreshold})`;
    } else {
      selectionReason = `Best available hypothesis with confidence ${best.confidence.toFixed(2)}, but below threshold (${this.confidenceThreshold})`;
    }

    return {
      selectedHypothesis: best,
      alternatives: sorted.slice(1),
      selectionReason,
      isTied,
      requiresEscalation: isTied || best.confidence < this.confidenceThreshold
    };
  }

  /**
   * Compare two hypotheses
   *
   * @param {Object} hyp1 - First hypothesis analysis
   * @param {Object} hyp2 - Second hypothesis analysis
   * @returns {Object} Comparison result
   * @returns {number} return.confidenceDelta - Confidence difference
   * @returns {string} return.winner - Which hypothesis won ('hyp1', 'hyp2', or 'tie')
   * @returns {string} return.reason - Comparison reason
   */
  compareHypotheses(hyp1, hyp2) {
    if (!hyp1 || !hyp2) {
      throw new Error('Both hypotheses are required for comparison');
    }

    const confidenceDelta = hyp1.confidence - hyp2.confidence;

    let winner;
    let reason;

    if (Math.abs(confidenceDelta) <= this.tieThreshold) {
      winner = 'tie';
      reason = `Confidence scores are too close (${hyp1.confidence.toFixed(2)} vs ${hyp2.confidence.toFixed(2)})`;
    } else if (confidenceDelta > 0) {
      winner = 'hyp1';
      reason = `Hypothesis 1 has higher confidence (${hyp1.confidence.toFixed(2)} vs ${hyp2.confidence.toFixed(2)})`;
    } else {
      winner = 'hyp2';
      reason = `Hypothesis 2 has higher confidence (${hyp2.confidence.toFixed(2)} vs ${hyp1.confidence.toFixed(2)})`;
    }

    return {
      confidenceDelta: Math.abs(confidenceDelta),
      winner,
      reason
    };
  }

  /**
   * Document alternative hypotheses for future reference
   *
   * @param {Object[]} alternatives - Alternative analyses
   * @returns {Object} Documentation object
   * @returns {string} return.summary - Summary of alternatives
   * @returns {Object[]} return.hypotheses - Detailed alternative data
   */
  documentAlternatives(alternatives) {
    if (!alternatives || alternatives.length === 0) {
      return {
        summary: 'No alternative hypotheses available',
        hypotheses: []
      };
    }

    const summary = `${alternatives.length} alternative ${alternatives.length === 1 ? 'hypothesis' : 'hypotheses'} considered:\n` +
      alternatives
        .map((alt, i) => `${i + 1}. ${alt.hypothesis} (confidence: ${alt.confidence.toFixed(2)})`)
        .join('\n');

    const hypotheses = alternatives.map(alt => ({
      description: alt.hypothesis,
      confidence: alt.confidence,
      rootCause: alt.rootCause,
      fixRecommendations: alt.fixRecommendations,
      rejectionReason: this.getrejectionReason(alt)
    }));

    return {
      summary,
      hypotheses
    };
  }

  /**
   * Get rejection reason for alternative hypothesis
   *
   * @param {Object} hypothesis - Hypothesis analysis
   * @returns {string} Rejection reason
   * @private
   */
  getrejectionReason(hypothesis) {
    if (hypothesis.confidence < this.confidenceThreshold) {
      return `Low confidence (${hypothesis.confidence.toFixed(2)} < ${this.confidenceThreshold})`;
    }

    return 'Lower confidence than selected hypothesis';
  }

  /**
   * Create hypothesis from error pattern
   *
   * Helper method to generate hypothesis contexts from common error patterns
   *
   * @param {Object} baseContext - Base context (bugReport, testCode, stackTrace)
   * @param {string} pattern - Error pattern name
   * @returns {Object} Hypothesis context
   */
  createHypothesisFromPattern(baseContext, pattern) {
    const hypothesisDescriptions = {
      'null-pointer': 'Null pointer exception due to missing null check',
      'undefined-variable': 'Variable accessed before initialization',
      'type-mismatch': 'Type mismatch or incorrect type conversion',
      'race-condition': 'Race condition in async code',
      'boundary-condition': 'Off-by-one or boundary condition error',
      'logic-error': 'Logical error in conditional statement',
      'resource-leak': 'Resource not properly released',
      'configuration': 'Configuration or environment issue'
    };

    const hypothesis = hypothesisDescriptions[pattern] ||
      `Unknown pattern: ${pattern}`;

    return {
      ...baseContext,
      hypothesis,
      pattern
    };
  }
}

module.exports = MultiHypothesisValidator;
