/**
 * Confidence Validator (TRD-016)
 * Validates confidence scores for root cause analysis
 * @module lib/deep-debugger/analysis/confidence-validator
 */

class ConfidenceValidator {
  constructor(options = {}) {
    this.minConfidence = options.minConfidence || 0.7;
    this.escalationThreshold = options.escalationThreshold || 0.7;
  }

  validate(analysis) {
    return {
      isValid: analysis.confidence >= this.minConfidence,
      requiresEscalation: analysis.confidence < this.escalationThreshold,
      confidence: analysis.confidence,
      reasons: []
    };
  }

  // Alias for backward compatibility
  validateAnalysis(analysis) {
    return this.validate(analysis);
  }

  shouldEscalate(analysis) {
    return analysis.confidence < this.escalationThreshold;
  }
}

module.exports = ConfidenceValidator;
