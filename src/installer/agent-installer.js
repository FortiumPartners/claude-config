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