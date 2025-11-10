/**
 * Specialist Agent Selector
 *
 * Advanced specialist agent selection logic that considers framework,
 * complexity, multi-component fixes, and agent availability.
 *
 * Enhances the basic selection from fix-strategy-interpreter.js with
 * more sophisticated routing logic.
 *
 * @module lib/deep-debugger/strategy/specialist-selector
 */

class SpecialistSelector {
  /**
   * Create a specialist selector
   */
  constructor() {
    // Framework-based specialist mapping
    this.frameworkSpecialists = {
      // Backend frameworks
      'jest': 'nestjs-backend-expert',
      'rails': 'rails-backend-expert',
      'rspec': 'rails-backend-expert',
      'dotnet': 'dotnet-backend-expert',
      'xunit': 'dotnet-backend-expert',
      'pytest': 'backend-developer',
      'elixir': 'elixir-phoenix-expert',
      'exunit': 'elixir-phoenix-expert',

      // Frontend frameworks
      'react': 'react-component-architect',
      'blazor': 'dotnet-blazor-expert',
      'vue': 'frontend-developer',
      'angular': 'frontend-developer',
      'svelte': 'frontend-developer',

      // Generic fallback
      'generic': 'backend-developer'
    };

    // Complexity-based specialist routing
    this.complexityRouting = {
      'simple': 'backend-developer',      // Simple fixes can use generic
      'medium': null,                     // Use framework specialist
      'complex': null,                    // Use framework specialist
      'architectural': 'tech-lead-orchestrator' // Architectural needs tech-lead
    };

    // Available agents (from claude-config ecosystem)
    this.availableAgents = [
      // Backend specialists
      'nestjs-backend-expert',
      'rails-backend-expert',
      'dotnet-backend-expert',
      'elixir-phoenix-expert',
      'backend-developer',

      // Frontend specialists
      'react-component-architect',
      'dotnet-blazor-expert',
      'frontend-developer',

      // Orchestrators
      'tech-lead-orchestrator',
      'ai-mesh-orchestrator'
    ];
  }

  /**
   * Select appropriate specialist agent(s) for fix recommendation
   *
   * @param {Object} recommendation - Fix recommendation
   * @param {string} [recommendation.framework] - Framework (jest, react, rails, etc.)
   * @param {string} [recommendation.complexity] - Complexity (simple, medium, complex, architectural)
   * @param {string[]} [recommendation.affectedFiles] - Affected files
   * @param {string[]} [recommendation.affectedComponents] - Affected components (backend, frontend, database)
   * @returns {Object} Selection result
   * @returns {string} return.primaryAgent - Primary specialist agent
   * @returns {string[]} return.additionalAgents - Additional agents for multi-component fixes
   * @returns {string} return.reason - Selection reasoning
   * @returns {boolean} return.requiresOrchestration - Whether multi-agent orchestration needed
   */
  selectSpecialist(recommendation) {
    if (!recommendation) {
      throw new Error('Recommendation is required');
    }

    const framework = recommendation.framework || 'generic';
    const complexity = recommendation.complexity || 'medium';
    const affectedFiles = recommendation.affectedFiles || [];
    const affectedComponents = recommendation.affectedComponents || [];

    // Check for multi-component fix
    if (affectedComponents.length > 1) {
      return this.selectMultiComponentSpecialists(recommendation);
    }

    // Check for architectural complexity
    if (complexity === 'architectural') {
      return {
        primaryAgent: 'tech-lead-orchestrator',
        additionalAgents: [],
        reason: 'Architectural complexity requires tech-lead oversight',
        requiresOrchestration: false
      };
    }

    // Select based on framework and complexity
    let primaryAgent;

    // Simple fixes can use generic backend-developer
    if (complexity === 'simple') {
      primaryAgent = this.complexityRouting['simple'];
    } else {
      // Medium/Complex use framework specialist
      primaryAgent = this.frameworkSpecialists[framework] || this.frameworkSpecialists['generic'];
    }

    // Validate agent availability
    if (!this.isAgentAvailable(primaryAgent)) {
      // Fallback to generic backend-developer
      primaryAgent = 'backend-developer';
    }

    return {
      primaryAgent,
      additionalAgents: [],
      reason: this.buildSelectionReason(framework, complexity, primaryAgent),
      requiresOrchestration: false
    };
  }

  /**
   * Select specialists for multi-component fixes
   *
   * @param {Object} recommendation - Fix recommendation
   * @returns {Object} Multi-agent selection result
   * @private
   */
  selectMultiComponentSpecialists(recommendation) {
    const components = recommendation.affectedComponents || [];
    const framework = recommendation.framework || 'generic';
    const specialists = [];

    // Map each component to appropriate specialist
    for (const component of components) {
      const specialist = this.selectComponentSpecialist(component, framework);
      if (specialist && !specialists.includes(specialist)) {
        specialists.push(specialist);
      }
    }

    // If no specialists found, use generic
    if (specialists.length === 0) {
      specialists.push('backend-developer');
    }

    return {
      primaryAgent: specialists[0],
      additionalAgents: specialists.slice(1),
      reason: `Multi-component fix spanning: ${components.join(', ')}`,
      requiresOrchestration: specialists.length > 1
    };
  }

  /**
   * Select specialist for specific component type
   *
   * @param {string} component - Component type (backend, frontend, database, etc.)
   * @param {string} framework - Framework name
   * @returns {string} Specialist agent name
   * @private
   */
  selectComponentSpecialist(component, framework) {
    const componentType = component.toLowerCase();

    if (componentType.includes('frontend') || componentType.includes('ui')) {
      // Frontend component
      if (framework === 'react') return 'react-component-architect';
      if (framework === 'blazor') return 'dotnet-blazor-expert';
      return 'frontend-developer';
    }

    if (componentType.includes('backend') || componentType.includes('api')) {
      // Backend component - only use backend framework specialists
      const backendFrameworks = ['jest', 'rails', 'rspec', 'dotnet', 'xunit', 'pytest', 'elixir', 'exunit'];
      if (backendFrameworks.includes(framework)) {
        return this.frameworkSpecialists[framework] || 'backend-developer';
      }
      return 'backend-developer';
    }

    if (componentType.includes('database') || componentType.includes('db')) {
      // Database component
      return 'postgresql-specialist';
    }

    // Default to framework specialist
    return this.frameworkSpecialists[framework] || 'backend-developer';
  }

  /**
   * Check if agent is available in ecosystem
   *
   * @param {string} agentName - Agent name to check
   * @returns {boolean} True if agent is available
   */
  isAgentAvailable(agentName) {
    return this.availableAgents.includes(agentName);
  }

  /**
   * Build human-readable selection reason
   *
   * @param {string} framework - Framework name
   * @param {string} complexity - Complexity level
   * @param {string} agent - Selected agent
   * @returns {string} Selection reason
   * @private
   */
  buildSelectionReason(framework, complexity, agent) {
    if (complexity === 'simple') {
      return `Simple fix can be handled by generic backend-developer`;
    }

    if (complexity === 'architectural') {
      return `Architectural complexity requires tech-lead-orchestrator`;
    }

    if (framework === 'generic') {
      return `Generic fix routed to backend-developer`;
    }

    return `${framework} framework fix routed to ${agent}`;
  }

  /**
   * Validate specialist capabilities for recommendation
   *
   * @param {string} agentName - Agent to validate
   * @param {Object} recommendation - Fix recommendation
   * @returns {Object} Validation result
   * @returns {boolean} return.capable - Whether agent is capable
   * @returns {string[]} return.missingCapabilities - Missing capabilities if any
   */
  validateCapabilities(agentName, recommendation) {
    const framework = recommendation.framework || 'generic';
    const complexity = recommendation.complexity || 'medium';

    const missingCapabilities = [];

    // Check framework compatibility
    const expectedAgent = this.frameworkSpecialists[framework];
    if (expectedAgent && agentName !== expectedAgent && agentName !== 'backend-developer') {
      missingCapabilities.push(`${framework} framework expertise`);
    }

    // Check complexity handling
    if (complexity === 'architectural' && agentName !== 'tech-lead-orchestrator') {
      missingCapabilities.push('architectural analysis capability');
    }

    // Check availability
    if (!this.isAgentAvailable(agentName)) {
      missingCapabilities.push('agent not available in ecosystem');
    }

    return {
      capable: missingCapabilities.length === 0,
      missingCapabilities
    };
  }
}

module.exports = SpecialistSelector;
