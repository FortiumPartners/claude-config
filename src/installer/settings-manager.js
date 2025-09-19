/**
 * Settings Manager
 * Handles Claude settings.json configuration
 */

const fs = require('fs').promises;
const path = require('path');

class SettingsManager {
  constructor(installPath, logger) {
    this.installPath = installPath;
    this.logger = logger;
    this.settingsPath = path.join(installPath.claude, 'settings.json');
  }

  async configure() {
    this.logger.info('⚙️  Configuring Claude settings...');

    try {
      // Load existing settings or create new ones
      let settings = await this.loadExistingSettings();

      // Update with hook configuration
      settings = await this.addHookConfiguration(settings);

      // Save updated settings
      await this.saveSettings(settings);

      this.logger.success('✅ Settings configured');
      return { success: true };

    } catch (error) {
      this.logger.error(`Failed to configure settings: ${error.message}`);
      throw error;
    }
  }

  async loadExistingSettings() {
    try {
      const content = await fs.readFile(this.settingsPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      // Settings file doesn't exist, create minimal default
      this.logger.debug('Creating new settings.json');
      return {
        model: 'opusplan'
      };
    }
  }

  async addHookConfiguration(settings) {
    const hookBasePath = this.installPath.claude.startsWith(process.cwd()) ? '.claude' : path.join(require('os').homedir(), '.claude');

    const hooksConfig = {
      PreToolUse: [
        {
          hooks: [
            {
              type: 'command',
              command: `node ${hookBasePath}/hooks/tool-metrics.js pre`,
              timeout: 5
            }
          ]
        }
      ],
      PostToolUse: [
        {
          hooks: [
            {
              type: 'command',
              command: `node ${hookBasePath}/hooks/tool-metrics.js post`,
              timeout: 5
            }
          ]
        }
      ],
      UserPromptSubmit: [
        {
          hooks: [
            {
              type: 'command',
              command: `node ${hookBasePath}/hooks/session-start.js`,
              timeout: 5
            }
          ]
        }
      ]
    };

    // Merge hooks configuration
    settings.hooks = hooksConfig;

    this.logger.debug('  ✓ Added hooks configuration');
    return settings;
  }

  async saveSettings(settings) {
    // Create backup of existing settings
    await this.createBackup();

    // Write updated settings
    const content = JSON.stringify(settings, null, 2);
    await fs.writeFile(this.settingsPath, content, 'utf8');

    this.logger.debug('  ✓ Settings saved');
  }

  async createBackup() {
    try {
      const exists = await this.fileExists(this.settingsPath);
      if (exists) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = `${this.settingsPath}.backup-${timestamp}`;

        const content = await fs.readFile(this.settingsPath, 'utf8');
        await fs.writeFile(backupPath, content, 'utf8');

        this.logger.debug('  ✓ Settings backup created');
      }
    } catch (error) {
      this.logger.debug(`Could not create settings backup: ${error.message}`);
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
    const results = {
      exists: false,
      hooksConfigured: false,
      validJson: false
    };

    try {
      // Check if settings file exists
      results.exists = await this.fileExists(this.settingsPath);

      if (results.exists) {
        // Check if it's valid JSON
        const content = await fs.readFile(this.settingsPath, 'utf8');
        const settings = JSON.parse(content);
        results.validJson = true;

        // Check if hooks are configured
        results.hooksConfigured = !!(settings.hooks &&
          settings.hooks.PreToolUse &&
          settings.hooks.PostToolUse &&
          settings.hooks.UserPromptSubmit);
      }

    } catch (error) {
      this.logger.debug(`Settings validation error: ${error.message}`);
    }

    return results;
  }
}

module.exports = { SettingsManager };