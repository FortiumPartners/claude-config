#!/usr/bin/env node

/**
 * Agent Markdown to YAML Converter
 *
 * Converts agent markdown files to enriched YAML format following tech-lead-orchestrator.yaml
 * as the reference implementation.
 *
 * Usage:
 *   node convert-agent-md-to-yaml.js <agent-name>
 *   node convert-agent-md-to-yaml.js --all-tier3
 *   node convert-agent-md-to-yaml.js --all-tier2
 */

const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');

// Project root directory
const PROJECT_ROOT = path.join(__dirname, '..');

class AgentConverter {
  constructor() {
    this.totalConverted = 0;
    this.totalErrors = 0;
    this.conversionResults = [];
  }

  /**
   * Parse markdown content and extract structured data
   */
  parseMarkdown(mdContent) {
    const sections = {
      frontmatter: {},
      mission: '',
      responsibilities: [],
      technicalCapabilities: '',
      toolPermissions: '',
      integrationProtocols: { handoffFrom: [], handoffTo: [] },
      delegationCriteria: { whenToUse: [], whenToDelegate: [] },
      qualityStandards: {},
      researchMethodologies: '',
      successCriteria: '',
      notes: ''
    };

    // Extract frontmatter
    const frontmatterMatch = mdContent.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];
      frontmatter.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split(':');
        if (key && valueParts.length > 0) {
          const value = valueParts.join(':').trim();
          if (key === 'tools') {
            sections.frontmatter[key] = value.split(',').map(t => t.trim());
          } else {
            sections.frontmatter[key] = value;
          }
        }
      });
    }

    // Extract main mission
    const missionMatch = mdContent.match(/## Mission\n\n([\s\S]*?)(?=\n## |$)/);
    if (missionMatch) {
      sections.mission = missionMatch[1].trim();
    }

    // Extract responsibilities
    const responsibilitiesMatch = mdContent.match(/## Core Responsibilities\n\n([\s\S]*?)(?=\n## |$)/);
    if (responsibilitiesMatch) {
      const respText = responsibilitiesMatch[1];
      const respItems = respText.match(/^\d+\.\s+\*\*(.*?)\*\*:\s+(.*?)(?=\n\d+\.|$)/gm);
      if (respItems) {
        sections.responsibilities = respItems.map((item, index) => {
          const match = item.match(/^\d+\.\s+\*\*(.*?)\*\*:\s+(.*)/);
          if (match) {
            return {
              priority: index < 3 ? 'high' : index < 6 ? 'medium' : 'low',
              title: match[1].trim(),
              description: match[2].trim()
            };
          }
          return null;
        }).filter(Boolean);
      }
    }

    // Extract technical capabilities
    const techCapMatch = mdContent.match(/## Technical Capabilities\n\n([\s\S]*?)(?=\n## |$)/);
    if (techCapMatch) {
      sections.technicalCapabilities = techCapMatch[1].trim();
    }

    // Extract integration protocols
    const handoffFromMatch = mdContent.match(/### Handoff From\n\n([\s\S]*?)(?=\n### |$)/);
    if (handoffFromMatch) {
      const handoffText = handoffFromMatch[1];
      const handoffItems = handoffText.match(/^- \*\*(.*?)\*\*:\s+(.*?)(?=\n- \*\*|$)/gm);
      if (handoffItems) {
        sections.integrationProtocols.handoffFrom = handoffItems.map(item => {
          const match = item.match(/^- \*\*(.*?)\*\*:\s+(.*)/);
          if (match) {
            return {
              agent: match[1].trim(),
              context: match[2].trim(),
              acceptanceCriteria: []
            };
          }
          return null;
        }).filter(Boolean);
      }
    }

    // Extract handoff to
    const handoffToMatch = mdContent.match(/### Handoff To\n\n([\s\S]*?)(?=\n### |$)/);
    if (handoffToMatch) {
      const handoffText = handoffToMatch[1];
      const handoffItems = handoffText.match(/^- \*\*(.*?)\*\*:\s+(.*?)(?=\n- \*\*|$)/gm);
      if (handoffItems) {
        sections.integrationProtocols.handoffTo = handoffItems.map(item => {
          const match = item.match(/^- \*\*(.*?)\*\*:\s+(.*)/);
          if (match) {
            return {
              agent: match[1].trim(),
              deliverables: match[2].trim(),
              qualityGates: []
            };
          }
          return null;
        }).filter(Boolean);
      }
    }

    // Extract delegation criteria - when to use
    const whenToUseMatch = mdContent.match(/### When to Retain Ownership\n\n([\s\S]*?)(?=\n### |$)/);
    if (whenToUseMatch) {
      const criteriaText = whenToUseMatch[1];
      const criteriaItems = criteriaText.match(/^- \*\*(.*?)\*\*:\s+(.*?)(?=\n- \*\*|$)/gm);
      if (criteriaItems) {
        sections.delegationCriteria.whenToUse = criteriaItems.map(item => {
          const match = item.match(/^- \*\*(.*?)\*\*:\s+(.*)/);
          return match ? match[2].trim() : item.replace(/^- /, '').trim();
        });
      }
    }

    // Extract delegation criteria - when to delegate
    const whenToDelegateMatch = mdContent.match(/### When to Delegate\n\n([\s\S]*?)(?=\n## |$)/);
    if (whenToDelegateMatch) {
      const delegateText = whenToDelegateMatch[1];
      const delegateItems = delegateText.match(/^- \*\*(.*?)\*\*:\s+(.*?)(?=\n- \*\*|$)/gm);
      if (delegateItems) {
        sections.delegationCriteria.whenToDelegate = delegateItems.map(item => {
          const match = item.match(/^- \*\*(.*?)\*\*:\s+(.*)/);
          if (match) {
            return {
              agent: match[1].trim(),
              triggers: [match[2].trim()]
            };
          }
          return null;
        }).filter(Boolean);
      }
    }

    // Extract notes
    const notesMatch = mdContent.match(/## Notes\n\n([\s\S]*?)$/);
    if (notesMatch) {
      sections.notes = notesMatch[1].trim();
    }

    return sections;
  }

  /**
   * Convert parsed markdown to YAML structure
   */
  convertToYaml(parsedData, existingYaml = null) {
    const yamlData = {
      metadata: {
        name: parsedData.frontmatter.name || 'unknown',
        description: parsedData.frontmatter.description || 'Agent description',
        version: existingYaml?.metadata?.version || '1.0.0',
        lastUpdated: new Date().toISOString().split('T')[0],
        category: existingYaml?.metadata?.category || 'specialist',
        tools: existingYaml?.metadata?.tools || parsedData.frontmatter.tools || ['Read']
      },
      mission: {
        summary: parsedData.mission || 'Agent mission statement'
      },
      responsibilities: parsedData.responsibilities.length > 0
        ? parsedData.responsibilities
        : [{ priority: 'high', title: 'Primary Responsibility', description: parsedData.mission }]
    };

    // Add boundaries if we have enough information
    if (parsedData.mission) {
      yamlData.mission.boundaries = {
        handles: parsedData.mission.split('\n')[0] || 'Core responsibilities',
        doesNotHandle: 'Delegate specialized work to appropriate agents'
      };
    }

    // Add integration protocols if available
    if (parsedData.integrationProtocols.handoffFrom.length > 0 ||
        parsedData.integrationProtocols.handoffTo.length > 0) {
      yamlData.integrationProtocols = {};

      if (parsedData.integrationProtocols.handoffFrom.length > 0) {
        yamlData.integrationProtocols.handoffFrom = parsedData.integrationProtocols.handoffFrom;
      }

      if (parsedData.integrationProtocols.handoffTo.length > 0) {
        yamlData.integrationProtocols.handoffTo = parsedData.integrationProtocols.handoffTo;
      }
    }

    // Add delegation criteria if available
    if (parsedData.delegationCriteria.whenToUse.length > 0 ||
        parsedData.delegationCriteria.whenToDelegate.length > 0) {
      yamlData.delegationCriteria = {};

      if (parsedData.delegationCriteria.whenToUse.length > 0) {
        yamlData.delegationCriteria.whenToUse = parsedData.delegationCriteria.whenToUse;
      }

      if (parsedData.delegationCriteria.whenToDelegate.length > 0) {
        yamlData.delegationCriteria.whenToDelegate = parsedData.delegationCriteria.whenToDelegate;
      }
    }

    return yamlData;
  }

  /**
   * Increment version number
   */
  incrementVersion(version) {
    const parts = version.split('.').map(Number);
    parts[2] = (parts[2] || 0) + 1;
    return parts.join('.');
  }

  /**
   * Convert a single agent
   */
  async convertAgent(agentName) {
    try {
      console.log(`\n📄 Converting ${agentName}...`);

      // Read markdown file
      const mdPath = path.join(PROJECT_ROOT, 'agents', `${agentName}.md`);
      const mdContent = await fs.readFile(mdPath, 'utf8');
      const mdStats = await fs.stat(mdPath);
      const mdLines = mdContent.split('\n').length;

      // Read existing YAML file if it exists
      const yamlPath = path.join(PROJECT_ROOT, 'agents', 'yaml', `${agentName}.yaml`);
      let existingYaml = null;
      let existingLines = 0;

      try {
        const yamlContent = await fs.readFile(yamlPath, 'utf8');
        existingYaml = yaml.load(yamlContent);
        existingLines = yamlContent.split('\n').length;
      } catch (err) {
        console.log(`   ⚠️  No existing YAML file found, creating new one`);
      }

      // Parse markdown
      const parsedData = this.parseMarkdown(mdContent);

      // Convert to YAML structure
      const yamlData = this.convertToYaml(parsedData, existingYaml);

      // Increment version
      yamlData.metadata.version = this.incrementVersion(yamlData.metadata.version);

      // Write YAML file
      const yamlOutput = yaml.dump(yamlData, {
        indent: 2,
        lineWidth: 120,
        noRefs: true,
        sortKeys: false
      });

      await fs.writeFile(yamlPath, yamlOutput, 'utf8');
      const newLines = yamlOutput.split('\n').length;

      const result = {
        agent: agentName,
        success: true,
        mdSize: mdStats.size,
        mdLines,
        existingLines,
        newLines,
        linesAdded: newLines - existingLines,
        version: yamlData.metadata.version
      };

      console.log(`   ✅ Success! ${existingLines} → ${newLines} lines (+${newLines - existingLines})`);
      console.log(`   📊 Version: ${yamlData.metadata.version}`);

      this.totalConverted++;
      this.conversionResults.push(result);

      return result;
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);

      this.totalErrors++;
      this.conversionResults.push({
        agent: agentName,
        success: false,
        error: error.message
      });

      return { agent: agentName, success: false, error: error.message };
    }
  }

  /**
   * Convert multiple agents
   */
  async convertMultiple(agentNames) {
    console.log(`\n🔄 Converting ${agentNames.length} agents...`);

    for (const agentName of agentNames) {
      await this.convertAgent(agentName);
    }

    this.printSummary();
  }

  /**
   * Print conversion summary
   */
  printSummary() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 CONVERSION SUMMARY');
    console.log('='.repeat(80));
    console.log(`✅ Successfully converted: ${this.totalConverted}`);
    console.log(`❌ Errors: ${this.totalErrors}`);
    console.log(`📈 Total agents processed: ${this.conversionResults.length}`);

    if (this.totalConverted > 0) {
      const totalLinesAdded = this.conversionResults
        .filter(r => r.success)
        .reduce((sum, r) => sum + (r.linesAdded || 0), 0);

      console.log(`📝 Total lines added: ${totalLinesAdded}`);
      console.log(`📊 Average lines per agent: ${Math.round(totalLinesAdded / this.totalConverted)}`);
    }

    // Show detailed results
    console.log('\n📋 Detailed Results:');
    console.log('-'.repeat(80));

    this.conversionResults.forEach(result => {
      if (result.success) {
        console.log(`✅ ${result.agent.padEnd(35)} ${result.existingLines}→${result.newLines} lines (+${result.linesAdded}) v${result.version}`);
      } else {
        console.log(`❌ ${result.agent.padEnd(35)} ERROR: ${result.error}`);
      }
    });

    console.log('='.repeat(80) + '\n');
  }

  /**
   * Validate converted YAML against schema
   */
  async validateAgent(agentName) {
    try {
      const yamlPath = path.join(PROJECT_ROOT, 'agents', 'yaml', `${agentName}.yaml`);
      const { YamlParser } = require('../src/parsers/yaml-parser');
      const { Logger } = require('../src/utils/logger');

      const logger = new Logger('VALIDATOR');
      const parser = new YamlParser(logger);

      await parser.parse(yamlPath);

      console.log(`   ✅ Schema validation passed`);
      return true;
    } catch (error) {
      console.error(`   ❌ Schema validation failed: ${error.message}`);
      return false;
    }
  }
}

// Tier definitions
const TIER_3_AGENTS = [
  'react-component-architect',
  'dotnet-backend-expert',
  'rails-backend-expert',
  'context-fetcher',
  'github-specialist',
  'deployment-orchestrator',
  'infrastructure-subagent',
  'helm-chart-specialist',
  'postgresql-specialist',
  'agent-meta-engineer',
  'manager-dashboard-agent',
  'git-workflow',
  'general-purpose'
];

const TIER_2_AGENTS = [
  'playwright-tester',
  'infrastructure-orchestrator',
  'directory-monitor',
  'backend-developer',
  'build-orchestrator',
  'dotnet-blazor-expert'
];

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const converter = new AgentConverter();

  if (args.length === 0) {
    console.log('Usage: node convert-agent-md-to-yaml.js <agent-name>');
    console.log('       node convert-agent-md-to-yaml.js --all-tier3');
    console.log('       node convert-agent-md-to-yaml.js --all-tier2');
    console.log('       node convert-agent-md-to-yaml.js --validate <agent-name>');
    process.exit(1);
  }

  if (args[0] === '--all-tier3') {
    await converter.convertMultiple(TIER_3_AGENTS);
  } else if (args[0] === '--all-tier2') {
    await converter.convertMultiple(TIER_2_AGENTS);
  } else if (args[0] === '--validate' && args[1]) {
    await converter.validateAgent(args[1]);
  } else {
    await converter.convertAgent(args[0]);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { AgentConverter, TIER_3_AGENTS, TIER_2_AGENTS };
