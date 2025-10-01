/**
 * Agent Installer
 * Handles installation of Claude agent files
 */

const fs = require('fs').promises;
const path = require('path');

class AgentInstaller {
  constructor(installPath, logger) {
    this.installPath = installPath;
    this.logger = logger;
    this.sourceDir = path.join(__dirname, '../../agents');
    this.targetDir = path.join(installPath.claude, 'agents');
  }

  async install() {
    this.logger.info('📁 Installing agents...');

    try {
      // Ensure target directory exists
      await fs.mkdir(this.targetDir, { recursive: true });

      // Get list of agent files
      const agentFiles = await this.getAgentFiles();

      if (agentFiles.length === 0) {
        this.logger.warning('No agent files found to install');
        return { installed: 0, skipped: 0 };
      }

      let installed = 0;
      let skipped = 0;

      // Install each agent file
      for (const agentFile of agentFiles) {
        const sourcePath = path.join(this.sourceDir, agentFile);
        const targetPath = path.join(this.targetDir, agentFile);

        try {
          // Read source file
          const content = await fs.readFile(sourcePath, 'utf8');

          // Check if target exists
          const exists = await this.fileExists(targetPath);
          if (exists) {
            // TODO: Add force/merge logic
            this.logger.debug(`Overwriting existing agent: ${agentFile}`);
          }

          // Write to target
          await fs.writeFile(targetPath, content, 'utf8');
          this.logger.debug(`  ✓ Installed: ${agentFile}`);
          installed++;

        } catch (error) {
          this.logger.warning(`  ⚠ Failed to install ${agentFile}: ${error.message}`);
          skipped++;
        }
      }

      // Copy agents/README.md as MESH_AGENTS.md to .claude directory
      try {
        const readmePath = path.join(this.sourceDir, 'README.md');
        const meshAgentsPath = path.join(this.installPath.claude, 'MESH_AGENTS.md');

        const readmeExists = await this.fileExists(readmePath);
        if (readmeExists) {
          const content = await fs.readFile(readmePath, 'utf8');
          await fs.writeFile(meshAgentsPath, content, 'utf8');
          this.logger.debug(`  ✓ Installed: MESH_AGENTS.md (agent ecosystem documentation)`);
          installed++;

          // Update CLAUDE.md to reference MESH_AGENTS.md
          await this.updateClaudeMdReference();
        } else {
          this.logger.warning('  ⚠ agents/README.md not found, skipping MESH_AGENTS.md');
        }
      } catch (error) {
        this.logger.warning(`  ⚠ Failed to install MESH_AGENTS.md: ${error.message}`);
        skipped++;
      }

      this.logger.success(`✅ Agents: ${installed} installed, ${skipped} skipped`);
      return { installed, skipped };

    } catch (error) {
      this.logger.error(`Failed to install agents: ${error.message}`);
      throw error;
    }
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