/**
 * Command Installer
 * Handles installation of Claude command files
 */

const fs = require('fs').promises;
const path = require('path');

class CommandInstaller {
  constructor(installPath, logger) {
    this.installPath = installPath;
    this.logger = logger;
    this.sourceDir = path.join(__dirname, '../../commands');
    this.targetDir = path.join(installPath.claude, 'commands');
  }

  async install() {
    this.logger.info('⚡ Installing commands...');

    try {
      // Ensure target directory exists
      await fs.mkdir(this.targetDir, { recursive: true });

      // Get list of command files
      const commandFiles = await this.getCommandFiles();

      if (commandFiles.length === 0) {
        this.logger.warning('No command files found to install');
        return { installed: 0, skipped: 0 };
      }

      let installed = 0;
      let skipped = 0;

      // Install each command file
      for (const commandFile of commandFiles) {
        const sourcePath = path.join(this.sourceDir, commandFile);
        const targetPath = path.join(this.targetDir, commandFile);

        try {
          // Read source file
          const content = await fs.readFile(sourcePath, 'utf8');

          // Check if target exists
          const exists = await this.fileExists(targetPath);
          if (exists) {
            this.logger.debug(`Overwriting existing command: ${commandFile}`);
          }

          // Write to target
          await fs.writeFile(targetPath, content, 'utf8');
          this.logger.debug(`  ✓ Installed: ${commandFile}`);
          installed++;

        } catch (error) {
          this.logger.warning(`  ⚠ Failed to install ${commandFile}: ${error.message}`);
          skipped++;
        }
      }

      this.logger.success(`✅ Commands: ${installed} installed, ${skipped} skipped`);
      return { installed, skipped };

    } catch (error) {
      this.logger.error(`Failed to install commands: ${error.message}`);
      throw error;
    }
  }

  async getCommandFiles() {
    try {
      const files = await fs.readdir(this.sourceDir);
      return files.filter(file =>
        file.endsWith('.md') &&
        !file.includes('-test')
      );
    } catch (error) {
      this.logger.warning(`Could not read commands directory: ${error.message}`);
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
    const commandFiles = await this.getCommandFiles();
    const results = {
      total: commandFiles.length,
      installed: 0,
      missing: []
    };

    for (const commandFile of commandFiles) {
      const targetPath = path.join(this.targetDir, commandFile);
      const exists = await this.fileExists(targetPath);

      if (exists) {
        results.installed++;
      } else {
        results.missing.push(commandFile);
      }
    }

    return results;
  }
}

module.exports = { CommandInstaller };