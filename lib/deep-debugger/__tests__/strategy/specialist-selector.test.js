/**
 * Tests for Specialist Agent Selector
 */

const SpecialistSelector = require('../../strategy/specialist-selector');

describe('SpecialistSelector', () => {
  let selector;

  beforeEach(() => {
    selector = new SpecialistSelector();
  });

  describe('Constructor', () => {
    it('should initialize with framework specialists map', () => {
      expect(selector.frameworkSpecialists).toBeDefined();
      expect(selector.frameworkSpecialists['jest']).toBe('nestjs-backend-expert');
      expect(selector.frameworkSpecialists['react']).toBe('react-component-architect');
    });

    it('should initialize with available agents list', () => {
      expect(selector.availableAgents).toBeDefined();
      expect(selector.availableAgents).toContain('nestjs-backend-expert');
      expect(selector.availableAgents).toContain('backend-developer');
    });
  });

  describe('selectSpecialist', () => {
    it('should throw error if recommendation is null', () => {
      expect(() => selector.selectSpecialist(null)).toThrow('Recommendation is required');
    });

    it('should select framework specialist for medium complexity', () => {
      const recommendation = {
        framework: 'jest',
        complexity: 'medium'
      };

      const result = selector.selectSpecialist(recommendation);

      expect(result.primaryAgent).toBe('nestjs-backend-expert');
      expect(result.additionalAgents).toEqual([]);
      expect(result.requiresOrchestration).toBe(false);
    });

    it('should select generic backend-developer for simple complexity', () => {
      const recommendation = {
        framework: 'jest',
        complexity: 'simple'
      };

      const result = selector.selectSpecialist(recommendation);

      expect(result.primaryAgent).toBe('backend-developer');
      expect(result.reason).toContain('Simple fix');
    });

    it('should select tech-lead-orchestrator for architectural complexity', () => {
      const recommendation = {
        framework: 'jest',
        complexity: 'architectural'
      };

      const result = selector.selectSpecialist(recommendation);

      expect(result.primaryAgent).toBe('tech-lead-orchestrator');
      expect(result.reason).toContain('Architectural complexity');
    });

    it('should select react-component-architect for React framework', () => {
      const recommendation = {
        framework: 'react',
        complexity: 'medium'
      };

      const result = selector.selectSpecialist(recommendation);

      expect(result.primaryAgent).toBe('react-component-architect');
    });

    it('should select rails-backend-expert for Rails framework', () => {
      const recommendation = {
        framework: 'rails',
        complexity: 'complex'
      };

      const result = selector.selectSpecialist(recommendation);

      expect(result.primaryAgent).toBe('rails-backend-expert');
    });

    it('should fallback to backend-developer for unknown framework', () => {
      const recommendation = {
        framework: 'unknown-framework',
        complexity: 'medium'
      };

      const result = selector.selectSpecialist(recommendation);

      expect(result.primaryAgent).toBe('backend-developer');
    });

    it('should default to medium complexity if not provided', () => {
      const recommendation = {
        framework: 'jest'
      };

      const result = selector.selectSpecialist(recommendation);

      expect(result.primaryAgent).toBe('nestjs-backend-expert');
    });

    it('should default to generic framework if not provided', () => {
      const recommendation = {
        complexity: 'medium'
      };

      const result = selector.selectSpecialist(recommendation);

      expect(result.primaryAgent).toBe('backend-developer');
    });
  });

  describe('selectMultiComponentSpecialists', () => {
    it('should select multiple specialists for multi-component fix', () => {
      const recommendation = {
        framework: 'react',
        complexity: 'complex',
        affectedComponents: ['frontend', 'backend']
      };

      const result = selector.selectSpecialist(recommendation);

      expect(result.requiresOrchestration).toBe(true);
      expect(result.additionalAgents.length).toBeGreaterThan(0);
      expect(result.reason).toContain('Multi-component');
    });

    it('should deduplicate specialists for multi-component fix', () => {
      const recommendation = {
        framework: 'jest',
        complexity: 'medium',
        affectedComponents: ['backend', 'backend-api']
      };

      const result = selector.selectSpecialist(recommendation);

      // Should not have duplicate specialists
      const allAgents = [result.primaryAgent, ...result.additionalAgents];
      const uniqueAgents = [...new Set(allAgents)];
      expect(allAgents.length).toBe(uniqueAgents.length);
    });

    it('should fallback to backend-developer if no specialists found', () => {
      const recommendation = {
        framework: 'generic',
        complexity: 'medium',
        affectedComponents: []
      };

      const result = selector.selectSpecialist(recommendation);

      expect(result.primaryAgent).toBe('backend-developer');
    });
  });

  describe('selectComponentSpecialist', () => {
    it('should select frontend specialist for UI component', () => {
      const specialist = selector.selectComponentSpecialist('frontend', 'react');
      expect(specialist).toBe('react-component-architect');
    });

    it('should select frontend-developer for generic frontend', () => {
      const specialist = selector.selectComponentSpecialist('ui', 'generic');
      expect(specialist).toBe('frontend-developer');
    });

    it('should select backend specialist for API component', () => {
      const specialist = selector.selectComponentSpecialist('backend', 'jest');
      expect(specialist).toBe('nestjs-backend-expert');
    });

    it('should select postgresql-specialist for database component', () => {
      const specialist = selector.selectComponentSpecialist('database', 'generic');
      expect(specialist).toBe('postgresql-specialist');
    });

    it('should fallback to framework specialist for unknown component', () => {
      const specialist = selector.selectComponentSpecialist('unknown', 'rails');
      expect(specialist).toBe('rails-backend-expert');
    });
  });

  describe('isAgentAvailable', () => {
    it('should return true for available agents', () => {
      expect(selector.isAgentAvailable('nestjs-backend-expert')).toBe(true);
      expect(selector.isAgentAvailable('backend-developer')).toBe(true);
    });

    it('should return false for unavailable agents', () => {
      expect(selector.isAgentAvailable('non-existent-agent')).toBe(false);
      expect(selector.isAgentAvailable('fake-specialist')).toBe(false);
    });
  });

  describe('validateCapabilities', () => {
    it('should validate capable agent', () => {
      const recommendation = {
        framework: 'jest',
        complexity: 'medium'
      };

      const result = selector.validateCapabilities('nestjs-backend-expert', recommendation);

      expect(result.capable).toBe(true);
      expect(result.missingCapabilities).toEqual([]);
    });

    it('should identify missing framework expertise', () => {
      const recommendation = {
        framework: 'react',
        complexity: 'medium'
      };

      const result = selector.validateCapabilities('rails-backend-expert', recommendation);

      expect(result.capable).toBe(false);
      expect(result.missingCapabilities).toContain('react framework expertise');
    });

    it('should identify missing architectural capability', () => {
      const recommendation = {
        framework: 'jest',
        complexity: 'architectural'
      };

      const result = selector.validateCapabilities('backend-developer', recommendation);

      expect(result.capable).toBe(false);
      expect(result.missingCapabilities).toContain('architectural analysis capability');
    });

    it('should identify unavailable agent', () => {
      const recommendation = {
        framework: 'jest',
        complexity: 'medium'
      };

      const result = selector.validateCapabilities('non-existent-agent', recommendation);

      expect(result.capable).toBe(false);
      expect(result.missingCapabilities).toContain('agent not available in ecosystem');
    });

    it('should allow backend-developer for any framework', () => {
      const recommendation = {
        framework: 'react',
        complexity: 'medium'
      };

      const result = selector.validateCapabilities('backend-developer', recommendation);

      expect(result.capable).toBe(true);
    });
  });

  describe('buildSelectionReason', () => {
    it('should build reason for simple fix', () => {
      const reason = selector.buildSelectionReason('jest', 'simple', 'backend-developer');
      expect(reason).toContain('Simple fix');
      expect(reason).toContain('backend-developer');
    });

    it('should build reason for architectural fix', () => {
      const reason = selector.buildSelectionReason('jest', 'architectural', 'tech-lead-orchestrator');
      expect(reason).toContain('Architectural complexity');
    });

    it('should build reason for framework-specific fix', () => {
      const reason = selector.buildSelectionReason('jest', 'medium', 'nestjs-backend-expert');
      expect(reason).toContain('jest');
      expect(reason).toContain('nestjs-backend-expert');
    });

    it('should build reason for generic fix', () => {
      const reason = selector.buildSelectionReason('generic', 'medium', 'backend-developer');
      expect(reason).toContain('Generic fix');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty affectedComponents array', () => {
      const recommendation = {
        framework: 'jest',
        complexity: 'medium',
        affectedComponents: []
      };

      const result = selector.selectSpecialist(recommendation);

      expect(result.primaryAgent).toBe('nestjs-backend-expert');
      expect(result.requiresOrchestration).toBe(false);
    });

    it('should handle single component in affectedComponents', () => {
      const recommendation = {
        framework: 'jest',
        complexity: 'medium',
        affectedComponents: ['backend']
      };

      const result = selector.selectSpecialist(recommendation);

      expect(result.primaryAgent).toBe('nestjs-backend-expert');
      expect(result.requiresOrchestration).toBe(false);
    });

    it('should handle null affectedComponents', () => {
      const recommendation = {
        framework: 'jest',
        complexity: 'medium',
        affectedComponents: null
      };

      const result = selector.selectSpecialist(recommendation);

      expect(result.primaryAgent).toBe('nestjs-backend-expert');
    });

    it('should handle undefined fields gracefully', () => {
      const recommendation = {};

      const result = selector.selectSpecialist(recommendation);

      expect(result.primaryAgent).toBe('backend-developer');
      expect(result.requiresOrchestration).toBe(false);
    });
  });

  describe('Framework Coverage', () => {
    it('should support all backend frameworks', () => {
      const frameworks = ['jest', 'rails', 'rspec', 'dotnet', 'xunit', 'pytest', 'elixir', 'exunit'];

      frameworks.forEach(framework => {
        const recommendation = { framework, complexity: 'medium' };
        const result = selector.selectSpecialist(recommendation);
        expect(result.primaryAgent).toBeDefined();
        expect(selector.isAgentAvailable(result.primaryAgent)).toBe(true);
      });
    });

    it('should support all frontend frameworks', () => {
      const frameworks = ['react', 'blazor', 'vue', 'angular', 'svelte'];

      frameworks.forEach(framework => {
        const recommendation = { framework, complexity: 'medium' };
        const result = selector.selectSpecialist(recommendation);
        expect(result.primaryAgent).toBeDefined();
        expect(selector.isAgentAvailable(result.primaryAgent)).toBe(true);
      });
    });
  });

  describe('Complexity Routing', () => {
    it('should route all complexity levels correctly', () => {
      const complexities = ['simple', 'medium', 'complex', 'architectural'];

      complexities.forEach(complexity => {
        const recommendation = { framework: 'jest', complexity };
        const result = selector.selectSpecialist(recommendation);
        expect(result.primaryAgent).toBeDefined();
      });
    });

    it('should always route architectural to tech-lead', () => {
      const frameworks = ['jest', 'react', 'rails', 'generic'];

      frameworks.forEach(framework => {
        const recommendation = { framework, complexity: 'architectural' };
        const result = selector.selectSpecialist(recommendation);
        expect(result.primaryAgent).toBe('tech-lead-orchestrator');
      });
    });
  });
});
