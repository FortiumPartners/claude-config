/**
 * Changelog Categorizer - Enhances parsed features with impact assessment and confidence scoring.
 * Provides additional metadata to help users prioritize changelog items.
 * @module changelog/categorizer
 */

/**
 * Enhances parsed features with impact assessment and confidence scoring.
 * Provides additional metadata to help users prioritize changelog items.
 */
class FeatureCategorizer {
  /**
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    // Impact level keywords
    this.impactKeywords = {
      high: ['breaking', 'major', 'critical', 'significant', 'important', 'required', 'security', 'vulnerability'],
      medium: ['improved', 'enhanced', 'updated', 'moderate', 'performance'],
      low: ['minor', 'small', 'trivial', 'typo', 'cosmetic', 'fixed']
    };
  }

  /**
   * Enhance feature with impact and confidence scores
   * @param {Object} feature - Feature object from parser
   * @returns {Object} Enhanced feature with impact and confidence
   */
  enhance(feature) {
    const impact = this.assessImpact(feature);
    const confidence = this.calculateConfidence(feature);

    return {
      ...feature,
      impact,
      confidence
    };
  }

  /**
   * Assess impact level (high, medium, low)
   * @private
   */
  assessImpact(feature) {
    // Breaking changes and security updates are always high impact
    if (feature.category === 'breaking' || feature.category === 'security') {
      return 'high';
    }

    const text = `${feature.title} ${feature.description}`.toLowerCase();

    // Score each impact level based on keyword matches
    const scores = {};
    for (const [impact, keywords] of Object.entries(this.impactKeywords)) {
      scores[impact] = keywords.filter(kw => text.includes(kw)).length;
    }

    // Return highest scoring impact level
    const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    return entries[0][1] > 0 ? entries[0][0] : 'medium';
  }

  /**
   * Calculate confidence score (0.0 to 1.0)
   * @private
   */
  calculateConfidence(feature) {
    const text = `${feature.title} ${feature.description}`.toLowerCase();
    const category = feature.category;

    // Category-specific keywords
    const keywords = {
      breaking: ['breaking', 'removed', 'deprecated', 'renamed', 'incompatible', 'migration'],
      new: ['new', 'added', 'introduced', 'launch', 'release'],
      enhancement: ['improved', 'enhanced', 'updated', 'better'],
      performance: ['faster', 'performance', 'speed', 'latency', 'optimization'],
      security: ['security', 'vulnerability', 'CVE', 'auth', 'encryption'],
      deprecation: ['deprecated', 'sunset', 'removed', 'legacy'],
      bugfix: ['fixed', 'bug', 'issue', 'resolved', 'corrected', 'patched']
    };

    const categoryKeywords = keywords[category] || [];
    const matches = categoryKeywords.filter(kw => text.includes(kw)).length;

    // Higher confidence with more keyword matches
    if (matches >= 3) return 0.95;
    if (matches >= 2) return 0.85;
    if (matches >= 1) return 0.75;
    return 0.5; // Low confidence if no matches
  }
}

module.exports = { FeatureCategorizer };
