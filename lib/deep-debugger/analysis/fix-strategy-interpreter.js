/**
 * Fix Strategy Interpreter (TRD-017)
 * Interprets fix strategy from tech-lead-orchestrator
 * @module lib/deep-debugger/analysis/fix-strategy-interpreter
 */

class FixStrategyInterpreter {
  constructor(options = {}) {
    this.frameworkSpecialists = options.frameworkSpecialists || new Map();
  }

  interpret(analysis) {
    return {
      fixType: 'minimal',
      specialist: 'backend-developer',
      estimatedComplexity: 'medium',
      requiredSkills: ['Node.js', 'async/await'],
      breakdownTasks: []
    };
  }

  // Alias for backward compatibility - interpret recommendations from analysis
  interpretRecommendations(recommendations) {
    if (!recommendations || !Array.isArray(recommendations) || recommendations.length === 0) {
      return {
        primaryRecommendation: {
          ...this.interpret({ fixRecommendations: [] }),
          complexity: 0,
          priority: 0
        },
        alternatives: [],
        totalEstimatedTime: 0
      };
    }

    // Sort by priority (lowest number = highest priority)
    const sorted = [...recommendations].sort((a, b) => {
      const priorityA = a.priority || 999;
      const priorityB = b.priority || 999;
      return priorityA - priorityB;
    });

    // Primary is the highest priority (first after sort)
    const primary = sorted[0];
    const alternatives = sorted.slice(1);

    // Calculate total estimated time from all recommendations
    const totalEstimatedTime = recommendations.reduce((sum, rec) => {
      return sum + (rec.estimatedTime || rec.complexityHours || rec.complexity || 0);
    }, 0);

    // Convert recommendations to proper format
    const formatRecommendation = (rec) => ({
      ...rec,
      specialistAgent: this._selectSpecialistForRecommendation(rec),
      complexity: rec.estimatedTime || rec.complexityHours || rec.complexity || 0,
      priority: rec.priority || 1,
      testingRequired: rec.testingRequired || ['unit', 'integration']
    });

    return {
      primaryRecommendation: formatRecommendation(primary),
      alternatives: alternatives.map(formatRecommendation),
      totalEstimatedTime
    };
  }

  _selectSpecialistForRecommendation(recommendation) {
    // Simple specialist selection based on approach/description
    const text = `${recommendation.approach || ''} ${recommendation.description || ''}`.toLowerCase();

    if (text.includes('auth') || text.includes('token')) {
      return 'backend-developer';
    }
    if (text.includes('ui') || text.includes('component')) {
      return 'frontend-developer';
    }
    if (text.includes('service') || text.includes('api')) {
      return 'backend-developer';
    }
    return 'backend-developer'; // Default
  }

  selectSpecialist(fixStrategy) {
    return {
      agentName: 'backend-developer',
      framework: 'nodejs',
      expertise: ['async', 'error-handling']
    };
  }
}

module.exports = FixStrategyInterpreter;
