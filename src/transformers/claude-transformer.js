/**
 * Claude Code Transformer
 * Transforms YAML agent/command data to Claude Code markdown format
 */

const { BaseTransformer } = require('./base-transformer');

class ClaudeTransformer extends BaseTransformer {
  constructor(logger) {
    super(logger);
  }

  getToolName() {
    return 'claude';
  }

  getFileExtension() {
    return '.md';
  }

  /**
   * Transform agent data to Claude Code markdown
   * @param {Object} agentData - Parsed YAML agent data
   * @returns {Promise<string>} Markdown formatted agent
   */
  async transformAgent(agentData) {
    const sections = [];

    // 1. YAML Frontmatter
    sections.push(this.formatAgentFrontmatter(agentData.metadata));

    // 2. Mission
    sections.push(this.formatMission(agentData.mission));

    // 3. Responsibilities
    sections.push(this.formatResponsibilities(agentData.responsibilities));

    // 4. Code Examples (if present)
    if (agentData.examples && agentData.examples.length > 0) {
      sections.push(this.formatExamples(agentData.examples));
    }

    // 5. Quality Standards (if present)
    if (agentData.qualityStandards) {
      sections.push(this.formatQualityStandards(agentData.qualityStandards));
    }

    // 6. Integration Protocols (if present)
    if (agentData.integrationProtocols) {
      sections.push(this.formatIntegrationProtocols(agentData.integrationProtocols));
    }

    // 7. Delegation Criteria (if present)
    if (agentData.delegationCriteria) {
      sections.push(this.formatDelegationCriteria(agentData.delegationCriteria));
    }

    return sections.filter(s => s && s.trim()).join('\n\n');
  }

  /**
   * Transform command data to Claude Code markdown
   * @param {Object} commandData - Parsed YAML command data
   * @returns {Promise<string>} Markdown formatted command
   */
  async transformCommand(commandData) {
    const sections = [];

    // 1. Metadata Header (for migration detection)
    sections.push(this.formatMetadataHeader(commandData.metadata));

    // 2. YAML Frontmatter
    sections.push(this.formatCommandFrontmatter(commandData.metadata));

    // 3. Mission
    sections.push(this.formatSection('Mission', commandData.mission.summary));

    // 4. Workflow
    if (commandData.workflow) {
      sections.push(this.formatWorkflow(commandData.workflow));
    }

    // 5. Expected Input
    if (commandData.expectedInput) {
      sections.push(this.formatExpectedInput(commandData.expectedInput));
    }

    // 6. Expected Output
    if (commandData.expectedOutput) {
      sections.push(this.formatExpectedOutput(commandData.expectedOutput));
    }

    return sections.filter(s => s && s.trim()).join('\n\n');
  }

  /**
   * Format agent frontmatter
   */
  formatAgentFrontmatter(metadata) {
    const frontmatter = {
      name: metadata.name,
      description: metadata.description,
      tools: metadata.tools.join(', '),
      version: metadata.version,
      last_updated: metadata.lastUpdated || new Date().toISOString().split('T')[0],
      category: metadata.category
    };

    if (metadata.languages && metadata.languages.length > 0) {
      frontmatter.primary_languages = `[${metadata.languages.join(', ')}]`;
    }

    if (metadata.frameworks && metadata.frameworks.length > 0) {
      frontmatter.primary_frameworks = `[${metadata.frameworks.join(', ')}]`;
    }

    return this.formatYamlFrontmatter(frontmatter);
  }

  /**
   * Format metadata header for command migration detection
   */
  formatMetadataHeader(metadata) {
    const lines = [];

    // Primary marker for AI Mesh command detection
    lines.push('# @ai-mesh-command');

    // Required metadata fields
    lines.push(`# Command: ${metadata.name}`);
    lines.push(`# Version: ${metadata.version}`);
    lines.push(`# Category: ${metadata.category || 'analysis'}`);
    lines.push(`# Source: ${metadata.source || 'fortium'}`);
    lines.push(`# Maintainer: Fortium Software Configuration Team`);
    lines.push(`# Last Updated: ${metadata.lastUpdated || new Date().toISOString().split('T')[0]}`);

    return lines.join('\n');
  }

  /**
   * Format command frontmatter
   */
  formatCommandFrontmatter(metadata) {
    const frontmatter = {
      name: metadata.name,
      description: metadata.description
    };

    if (metadata.version) {
      frontmatter.version = metadata.version;
    }

    if (metadata.category) {
      frontmatter.category = metadata.category;
    }

    return this.formatYamlFrontmatter(frontmatter);
  }

  /**
   * Format mission section
   */
  formatMission(mission) {
    const lines = ['## Mission', ''];

    // Summary
    lines.push(this.sanitize(mission.summary), '');

    // Boundaries (if present)
    if (mission.boundaries) {
      lines.push('**Key Boundaries**:');
      
      if (mission.boundaries.handles) {
        lines.push(`- ✅ **Handles**: ${this.sanitize(mission.boundaries.handles)}`);
      }
      
      if (mission.boundaries.doesNotHandle) {
        lines.push(`- ❌ **Does Not Handle**: ${this.sanitize(mission.boundaries.doesNotHandle)}`);
      }
      
      if (mission.boundaries.collaboratesOn) {
        lines.push(`- 🤝 **Collaborates On**: ${this.sanitize(mission.boundaries.collaboratesOn)}`);
      }
      
      lines.push('');
    }

    // Expertise (if present)
    if (mission.expertise && mission.expertise.length > 0) {
      lines.push('**Core Expertise**:');
      mission.expertise.forEach(area => {
        lines.push(`- **${area.name}**: ${this.sanitize(area.description)}`);
      });
    }

    return lines.join('\n');
  }

  /**
   * Format responsibilities section
   */
  formatResponsibilities(responsibilities) {
    const lines = ['## Core Responsibilities', ''];

    responsibilities.forEach((resp, index) => {
      const priorityBadge = this.formatPriorityBadge(resp.priority);
      lines.push(
        `${index + 1}. ${priorityBadge} **${resp.title}**: ${this.sanitize(resp.description)}`
      );
    });

    return lines.join('\n');
  }

  /**
   * Format code examples section
   */
  formatExamples(examples) {
    const lines = ['## Code Examples and Best Practices', ''];

    examples.forEach((example, index) => {
      // Example header
      lines.push(`#### Example ${index + 1}: ${example.title}`, '');

      // Category badge
      if (example.category) {
        const categoryEmoji = this.getCategoryEmoji(example.category);
        lines.push(`${categoryEmoji} **Category**: ${example.category}`, '');
      }

      // Anti-pattern
      if (example.antiPattern) {
        lines.push(this.formatCodeBlock(
          `// ❌ ANTI-PATTERN: ${example.antiPattern.issues.join(', ')}\n${example.antiPattern.code}`,
          example.antiPattern.language
        ));
        lines.push('');

        if (example.antiPattern.issues.length > 0) {
          lines.push('**Issues**:');
          example.antiPattern.issues.forEach(issue => {
            lines.push(`- ${issue}`);
          });
          lines.push('');
        }
      }

      // Best practice
      if (example.bestPractice) {
        lines.push(this.formatCodeBlock(
          `// ✅ BEST PRACTICE\n${example.bestPractice.code}`,
          example.bestPractice.language
        ));
        lines.push('');

        if (example.bestPractice.benefits.length > 0) {
          lines.push('**Key Takeaways**:');
          example.bestPractice.benefits.forEach(benefit => {
            lines.push(`- ${benefit}`);
          });
          lines.push('');
        }
      }

      lines.push('---', '');
    });

    return lines.join('\n');
  }

  /**
   * Format quality standards section
   */
  formatQualityStandards(standards) {
    const lines = ['## Quality Standards', ''];

    // Code Quality
    if (standards.codeQuality && standards.codeQuality.length > 0) {
      lines.push('### Code Quality', '');
      standards.codeQuality.forEach(standard => {
        const enforcementBadge = this.getEnforcementBadge(standard.enforcement);
        lines.push(`- [ ] **${standard.name}** ${enforcementBadge}: ${this.sanitize(standard.description)}`);
      });
      lines.push('');
    }

    // Testing Standards
    if (standards.testing && Object.keys(standards.testing).length > 0) {
      lines.push('### Testing Standards', '');
      Object.entries(standards.testing).forEach(([type, config]) => {
        const typeTitle = type.charAt(0).toUpperCase() + type.slice(1);
        const description = config.description ? ` - ${config.description}` : '';
        lines.push(`- [ ] **${typeTitle} Test Coverage**: ≥${config.minimum}%${description}`);
      });
      lines.push('');
    }

    // Performance Benchmarks
    if (standards.performance && standards.performance.length > 0) {
      lines.push('### Performance Benchmarks', '');
      standards.performance.forEach(metric => {
        const description = metric.description ? ` (${metric.description})` : '';
        lines.push(`- [ ] **${metric.name}**: <${metric.target} ${metric.unit}${description}`);
      });
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Format integration protocols section
   */
  formatIntegrationProtocols(protocols) {
    const lines = ['## Integration Protocols', ''];

    // Handoff From
    if (protocols.handoffFrom && protocols.handoffFrom.length > 0) {
      lines.push('### Handoff From', '');
      protocols.handoffFrom.forEach(handoff => {
        lines.push(`**${handoff.agent}**: ${this.sanitize(handoff.context)}`);
        
        if (handoff.acceptanceCriteria && handoff.acceptanceCriteria.length > 0) {
          lines.push('- **Acceptance Criteria**:');
          handoff.acceptanceCriteria.forEach(criterion => {
            lines.push(`  - [ ] ${criterion}`);
          });
        }
        
        lines.push('');
      });
    }

    // Handoff To
    if (protocols.handoffTo && protocols.handoffTo.length > 0) {
      lines.push('### Handoff To', '');
      protocols.handoffTo.forEach(handoff => {
        lines.push(`**${handoff.agent}**: ${this.sanitize(handoff.deliverables)}`);
        
        if (handoff.qualityGates && handoff.qualityGates.length > 0) {
          lines.push('- **Quality Gates**:');
          handoff.qualityGates.forEach(gate => {
            lines.push(`  - [ ] ${gate}`);
          });
        }
        
        lines.push('');
      });
    }

    return lines.join('\n');
  }

  /**
   * Format delegation criteria section
   */
  formatDelegationCriteria(criteria) {
    const lines = ['## Delegation Criteria', ''];

    // When to Use
    if (criteria.whenToUse && criteria.whenToUse.length > 0) {
      lines.push('### When to Use This Agent', '', 'Use this agent when:');
      criteria.whenToUse.forEach(scenario => {
        lines.push(`- ${scenario}`);
      });
      lines.push('');
    }

    // When to Delegate
    if (criteria.whenToDelegate && criteria.whenToDelegate.length > 0) {
      lines.push('### When to Delegate to Specialized Agents', '');
      criteria.whenToDelegate.forEach(rule => {
        lines.push(`**Delegate to ${rule.agent} when**:`);
        rule.triggers.forEach(trigger => {
          lines.push(`- ${trigger}`);
        });
        lines.push('');
      });
    }

    return lines.join('\n');
  }

  /**
   * Format workflow section for commands
   */
  formatWorkflow(workflow) {
    const lines = ['## Workflow', ''];

    // Sort phases by order
    const sortedPhases = [...workflow.phases].sort((a, b) => a.order - b.order);

    sortedPhases.forEach(phase => {
      lines.push(`### Phase ${phase.order}: ${phase.name}`, '');
      
      // Sort steps by order
      const sortedSteps = [...phase.steps].sort((a, b) => a.order - b.order);
      
      sortedSteps.forEach(step => {
        lines.push(`${step.order}. **${step.title}**: ${this.sanitize(step.description)}`);
        
        // Actions (if present)
        if (step.actions && step.actions.length > 0) {
          step.actions.forEach(action => {
            lines.push(`   - ${action}`);
          });
        }
        
        // Delegation (if present)
        if (step.delegation) {
          lines.push(`   - **Delegates to**: ${step.delegation.agent}`);
          if (step.delegation.context) {
            lines.push(`   - **Context**: ${step.delegation.context}`);
          }
        }
      });
      
      lines.push('');
    });

    return lines.join('\n');
  }

  /**
   * Format expected input section
   */
  formatExpectedInput(input) {
    const lines = ['## Expected Input', '', `**Format**: ${input.format}`, ''];

    if (input.sections && input.sections.length > 0) {
      lines.push('**Required Sections**:');
      input.sections.forEach(section => {
        const required = section.required ? '(Required)' : '(Optional)';
        const description = section.description ? ` - ${section.description}` : '';
        lines.push(`- **${section.name}** ${required}${description}`);
      });
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Format expected output section
   */
  formatExpectedOutput(output) {
    const lines = ['## Expected Output', '', `**Format**: ${output.format}`, ''];

    if (output.structure && output.structure.length > 0) {
      lines.push('**Structure**:');
      output.structure.forEach(section => {
        lines.push(`- **${section.name}**: ${this.sanitize(section.description)}`);
      });
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Helper: Get category emoji
   */
  getCategoryEmoji(category) {
    const emojis = {
      accessibility: '♿',
      performance: '⚡',
      security: '🔒',
      testing: '🧪',
      architecture: '🏗️',
      patterns: '🎨'
    };
    return emojis[category] || '📝';
  }

  /**
   * Helper: Get enforcement badge
   */
  getEnforcementBadge(enforcement) {
    const badges = {
      required: '🔴',
      recommended: '🟡',
      optional: '🟢'
    };
    return badges[enforcement] || '';
  }
}

module.exports = { ClaudeTransformer };
