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
    const isValid = analysis.confidence >= this.minConfidence;
    const requiresEscalation = analysis.confidence < this.escalationThreshold;

    return {
      valid: isValid, // Match E2E test expectations
      isValid, // Keep for backward compatibility
      requiresEscalation,
      confidence: analysis.confidence,
      reasons: [],
      action: requiresEscalation ? 'escalate' : 'proceed',
      reason: requiresEscalation ? `Low confidence score (${analysis.confidence}) requires escalation` : 'Confidence score meets threshold'
    };
  }

  // Alias for backward compatibility
  validateAnalysis(analysis) {
    return this.validate(analysis);
  }

  shouldEscalate(analysis) {
    return analysis.confidence < this.escalationThreshold;
  }

  requestAdditionalContext(analysis) {
    const missingFields = [];
    const suggestions = [];

    // Check for missing or unclear information
    if (!analysis.rootCause || analysis.rootCause === 'Unclear') {
      missingFields.push('rootCause');
      suggestions.push('Gather more code context around the error location');
    }

    if (!analysis.fixRecommendations || analysis.fixRecommendations.length === 0) {
      missingFields.push('fixRecommendations');
      suggestions.push('Request multiple fix approaches from tech-lead-orchestrator');
    }

    if (analysis.confidence < this.escalationThreshold) {
      suggestions.push('Review recent git changes for affected files');
      suggestions.push('Check for related test failures');
      suggestions.push('Analyze stack trace more deeply');
    }

    return {
      missingFields,
      suggestions,
      recommendedActions: [
        'Gather additional code context',
        'Review recent changes',
        'Analyze dependencies',
        'Check for similar issues'
      ]
    };
  }
}

module.exports = ConfidenceValidator;
