/**
 * Agent Installer
 * Handles installation of Claude agent files
 */

const fs = require('fs').promises;
const path = require('path');
const { YamlParser } = require('../parsers/yaml-parser');
const { TransformerFactory } = require('../transformers/transformer-factory');

class AgentInstaller {
  constructor(installPath, logger, options) {
    this.installPath = installPath;
    this.logger = logger;
    this.options = options || {};
    this.sourceDir = path.join(__dirname, '../../agents');
  }

  async install(tool) {
    this.logger.info('📁 Installing agents...');
    
    const yamlDir = path.join(__dirname, '../../agents/yaml');
    const targetDir = path.join(this.installPath[tool], 'agents');
    
    await fs.mkdir(targetDir, { recursive: true });
    
    const yamlFiles = await fs.readdir(yamlDir);
    let installed = 0;
    let skipped = 0;
    
    const parser = new YamlParser(this.logger);
    const factory = new TransformerFactory(this.logger);
    const transformer = factory.getTransformer(tool);
    
    for (const yamlFile of yamlFiles) {
      if (yamlFile.endsWith('.yaml')) {
        const yamlPath = path.join(yamlDir, yamlFile);
        const targetFile = yamlFile.replace('.yaml', transformer.getFileExtension());
        const targetPath = path.join(targetDir, targetFile);
        
        if (this.options.force || !(await this.fileExists(targetPath))) {
          const data = await parser.parse(yamlPath);
          const transformed = await transformer.transformAgent(data);
          await fs.writeFile(targetPath, transformed);
          installed++;
        } else {
          skipped++;
        }
      }
    }
    
    this.logger.success(`✅ Agents: ${installed} installed, ${skipped} skipped for ${tool}`);
    return { installed, skipped };
  }

  async getAgentFiles() {
    try {
      const files = await fs.readdir(this.sourceDir);
      return files.filter(file =>
        file.endsWith('.md') &&
        file !== 'README.md' &&
        !file.includes('-test')
      );
    } catch (error) {
      this.logger.warning(`Could not read agents directory: ${error.message}`);
      return [];
    }
  }

  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async updateClaudeMdReference() {
    try {
      const claudeMdPath = path.join(this.installPath.claude, 'CLAUDE.md');
      const claudeMdExists = await this.fileExists(claudeMdPath);

      if (!claudeMdExists) {
        this.logger.debug('  ℹ CLAUDE.md not found, skipping reference update');
        return;
      }

      let content = await fs.readFile(claudeMdPath, 'utf8');

      // Add reference to MESH_AGENTS.md if not already present
      const reference = '\n\n**📚 Agent Mesh Documentation**: Complete agent ecosystem with delegation patterns available in `@.claude/MESH_AGENTS.md`\n';
      const marker = '## Agent Ecosystem Reference';

      if (content.includes(marker) && !content.includes('MESH_AGENTS.md')) {
        // Insert reference after the marker
        content = content.replace(
          marker,
          marker + reference
        );

        await fs.writeFile(claudeMdPath, content, 'utf8');
        this.logger.debug('  ✓ Updated CLAUDE.md with MESH_AGENTS.md reference');
      }
    } catch (error) {
      this.logger.debug(`  ℹ Could not update CLAUDE.md reference: ${error.message}`);
    }
  }

  async validate() {
    const agentFiles = await this.getAgentFiles();
    const results = {
      total: agentFiles.length,
      installed: 0,
      missing: []
    };

    for (const agentFile of agentFiles) {
      const targetPath = path.join(this.targetDir, agentFile);
      const exists = await this.fileExists(targetPath);

      if (exists) {
        results.installed++;
      } else {
        results.missing.push(agentFile);
      }
    }

    return results;
  }
}

module.exports = { AgentInstaller };