/**
 * OpenCode Transformer
 * Transforms YAML agent/command data to OpenCode plain text format
 */

const { BaseTransformer } = require('./base-transformer');

class OpenCodeTransformer extends BaseTransformer {
  constructor(logger) {
    super(logger);
  }

  getToolName() {
    return 'opencode';
  }

  getFileExtension() {
    return '.txt';
  }

  /**
   * Transform agent data to OpenCode plain text
   * @param {Object} agentData - Parsed YAML agent data
   * @returns {Promise<string>} Plain text formatted agent
   */
  async transformAgent(agentData) {
    const sections = [];

    // Header
    sections.push(`AGENT: ${agentData.metadata.name.toUpperCase()}`);
    sections.push(`DESCRIPTION: ${agentData.metadata.description}`);
    sections.push(`VERSION: ${agentData.metadata.version}`);
    sections.push(`CATEGORY: ${agentData.metadata.category}`);
    sections.push('');

    // Tools
    sections.push('TOOLS:');
    sections.push(agentData.metadata.tools.join(', '));
    sections.push('');

    // Mission
    sections.push('MISSION:');
    sections.push(this.stripMarkdown(agentData.mission.summary));
    sections.push('');

    // Boundaries
    if (agentData.mission.boundaries) {
      sections.push('HANDLES:');
      sections.push(this.stripMarkdown(agentData.mission.boundaries.handles));
      sections.push('');
      
      sections.push('DOES NOT HANDLE:');
      sections.push(this.stripMarkdown(agentData.mission.boundaries.doesNotHandle));
      sections.push('');
      
      if (agentData.mission.boundaries.collaboratesOn) {
        sections.push('COLLABORATES ON:');
        sections.push(this.stripMarkdown(agentData.mission.boundaries.collaboratesOn));
        sections.push('');
      }
    }

    // Expertise
    if (agentData.mission.expertise && agentData.mission.expertise.length > 0) {
      sections.push('EXPERTISE:');
      agentData.mission.expertise.forEach(area => {
        sections.push(`- ${area.name}: ${this.stripMarkdown(area.description)}`);
      });
      sections.push('');
    }

    // Responsibilities
    sections.push('CORE RESPONSIBILITIES:');
    agentData.responsibilities.forEach((resp, index) => {
      sections.push(`${index + 1}. [${resp.priority.toUpperCase()}] ${resp.title}: ${this.stripMarkdown(resp.description)}`);
    });
    sections.push('');

    // Code Examples (simplified)
    if (agentData.examples && agentData.examples.length > 0) {
      sections.push('CODE EXAMPLES:');
      agentData.examples.forEach((example, index) => {
        sections.push(`\nExample ${index + 1}: ${example.title}`);
        
        if (example.antiPattern) {
          sections.push(`\nBAD PATTERN (${example.antiPattern.language}):`);
          sections.push(example.antiPattern.code);
          sections.push(`Issues: ${example.antiPattern.issues.join(', ')}`);
        }
        
        if (example.bestPractice) {
          sections.push(`\nGOOD PATTERN (${example.bestPractice.language}):`);
          sections.push(example.bestPractice.code);
          sections.push(`Benefits: ${example.bestPractice.benefits.join(', ')}`);
        }
        
        sections.push('---');
      });
      sections.push('');
    }

    // Quality Standards (simplified)
    if (agentData.qualityStandards) {
      sections.push('QUALITY STANDARDS:');
      
      if (agentData.qualityStandards.codeQuality) {
        sections.push('\nCode Quality:');
        agentData.qualityStandards.codeQuality.forEach(standard => {
          sections.push(`- ${standard.name} [${standard.enforcement}]: ${this.stripMarkdown(standard.description)}`);
        });
      }
      
      if (agentData.qualityStandards.testing) {
        sections.push('\nTesting:');
        Object.entries(agentData.qualityStandards.testing).forEach(([type, config]) => {
          sections.push(`- ${type} coverage: minimum ${config.minimum}%`);
        });
      }
      
      sections.push('');
    }

    // Integration (simplified)
    if (agentData.integrationProtocols) {
      sections.push('INTEGRATION:');
      
      if (agentData.integrationProtocols.handoffFrom) {
        sections.push('\nReceives work from:');
        agentData.integrationProtocols.handoffFrom.forEach(handoff => {
          sections.push(`- ${handoff.agent}: ${this.stripMarkdown(handoff.context)}`);
        });
      }
      
      if (agentData.integrationProtocols.handoffTo) {
        sections.push('\nHands off to:');
        agentData.integrationProtocols.handoffTo.forEach(handoff => {
          sections.push(`- ${handoff.agent}: ${this.stripMarkdown(handoff.deliverables)}`);
        });
      }
      
      sections.push('');
    }

    // Delegation
    if (agentData.delegationCriteria) {
      sections.push('DELEGATION RULES:');
      
      if (agentData.delegationCriteria.whenToUse) {
        sections.push('\nUse this agent for:');
        agentData.delegationCriteria.whenToUse.forEach(scenario => {
          sections.push(`- ${scenario}`);
        });
      }
      
      if (agentData.delegationCriteria.whenToDelegate) {
        sections.push('\nDelegate to other agents:');
        agentData.delegationCriteria.whenToDelegate.forEach(rule => {
          sections.push(`- ${rule.agent}: ${rule.triggers.join(', ')}`);
        });
      }
      
      sections.push('');
    }

    return sections.join('\n');
  }

  /**
   * Transform command data to OpenCode plain text
   * @param {Object} commandData - Parsed YAML command data
   * @returns {Promise<string>} Plain text formatted command
   */
  async transformCommand(commandData) {
    const sections = [];

    sections.push(`COMMAND: /${commandData.metadata.name}`);
    sections.push(`DESCRIPTION: ${commandData.metadata.description}`);
    if (commandData.metadata.version) {
      sections.push(`VERSION: ${commandData.metadata.version}`);
    }
    sections.push('');

    sections.push('PURPOSE:');
    sections.push(this.stripMarkdown(commandData.mission.summary));
    sections.push('');

    if (commandData.workflow) {
      sections.push('WORKFLOW:');
      const sortedPhases = [...commandData.workflow.phases].sort((a, b) => a.order - b.order);
      
      sortedPhases.forEach(phase => {
        sections.push(`\nPhase ${phase.order}: ${phase.name}`);
        const sortedSteps = [...phase.steps].sort((a, b) => a.order - b.order);
        
        sortedSteps.forEach(step => {
          sections.push(`  ${step.order}. ${step.title}: ${this.stripMarkdown(step.description)}`);
          if (step.delegation) {
            sections.push(`     Delegates to: ${step.delegation.agent}`);
          }
        });
      });
      sections.push('');
    }

    if (commandData.expectedInput) {
      sections.push('EXPECTED INPUT:');
      sections.push(`Format: ${commandData.expectedInput.format}`);
      if (commandData.expectedInput.sections) {
        sections.push('Required sections:');
        commandData.expectedInput.sections.forEach(section => {
          const required = section.required ? '[REQUIRED]' : '[OPTIONAL]';
          sections.push(`- ${section.name} ${required}`);
        });
      }
      sections.push('');
    }

    if (commandData.expectedOutput) {
      sections.push('EXPECTED OUTPUT:');
      sections.push(`Format: ${commandData.expectedOutput.format}`);
      if (commandData.expectedOutput.structure) {
        sections.push('Structure:');
        commandData.expectedOutput.structure.forEach(section => {
          sections.push(`- ${section.name}: ${this.stripMarkdown(section.description)}`);
        });
      }
      sections.push('');
    }

    return sections.join('\n');
  }

  /**
   * Strip markdown formatting from text
   */
  stripMarkdown(text) {
    if (!text) return '';
    
    return text
      .replace(/\*\*(.*?)\*\*/g, '$1')  // Remove bold
      .replace(/\*(.*?)\*/g, '$1')      // Remove italic
      .replace(/`(.*?)`/g, '$1')        // Remove inline code
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // Remove links
      .replace(/^#{1,6}\s+/gm, '')      // Remove headers
      .replace(/^>\s+/gm, '')           // Remove blockquotes
      .replace(/✅|❌|🤝|🔴|🟡|🟢/g, '') // Remove emojis
      .trim();
  }
}

module.exports = { OpenCodeTransformer };
