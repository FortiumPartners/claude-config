/**
 * Claude Installer API
 * Programmatic interface for automation and CI/CD
 */

const { AgentInstaller } = require('../installer/agent-installer.js');
const { CommandInstaller } = require('../installer/command-installer.js');
const { HookInstaller } = require('../installer/hook-installer.js');
const { RuntimeSetup } = require('../installer/runtime-setup.js');
const { SettingsManager } = require('../installer/settings-manager.js');
const { Logger } = require('../utils/logger.js');
const { Validator } = require('../utils/validator.js');
const path = require('path');

/**
 * Main Claude Installer API class
 */
class ClaudeInstallerAPI {
  constructor(options = {}) {
    this.options = {
      scope: options.scope || 'global',
      force: options.force || false,
      skipValidation: options.skipValidation || false,
      silent: options.silent || false,
      debug: options.debug || false,
      ...options
    };

    this.logger = new Logger({
      debug: this.options.debug,
      silent: this.options.silent
    });

    this.validator = new Validator();
  }

  /**
   * Install Claude configuration
   * @param {Object} options - Installation options
   * @returns {Promise<Object>} Installation result
   */
  async install(options = {}) {
    const config = { ...this.options, ...options };
    const installPath = this.getInstallPath(config.scope);

    try {
      // Environment validation
      if (!config.skipValidation) {
        await this.validator.validateEnvironment();
      }

      // Initialize components
      const runtimeSetup = new RuntimeSetup(installPath, this.logger);
      const agentInstaller = new AgentInstaller(installPath, this.logger);
      const commandInstaller = new CommandInstaller(installPath, this.logger);
      const hookInstaller = new HookInstaller(installPath, this.logger);
      const settingsManager = new SettingsManager(installPath, this.logger);

      // Execute installation steps
      const results = {
        runtime: await runtimeSetup.initialize(),
        agents: await agentInstaller.install(),
        commands: await commandInstaller.install(),
        hooks: await hookInstaller.install(),
        settings: await settingsManager.configure()
      };

      // Validate installation
      const validation = await this.validator.validateInstallation(installPath);

      return {
        success: validation.success,
        installPath,
        results,
        validation: validation.summary,
        errors: validation.errors
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        installPath
      };
    }
  }

  /**
   * Update existing installation
   * @param {Object} options - Update options
   * @returns {Promise<Object>} Update result
   */
  async update(options = {}) {
    // TODO: Implement update logic
    return {
      success: false,
      error: 'Update functionality not yet implemented'
    };
  }

  /**
   * Validate existing installation
   * @param {Object} options - Validation options
   * @returns {Promise<Object>} Validation result
   */
  async validate(options = {}) {
    const config = { ...this.options, ...options };
    const installPath = this.getInstallPath(config.scope);

    try {
      const validation = await this.validator.validateInstallation(installPath);

      return {
        success: validation.success,
        installPath,
        summary: validation.summary,
        errors: validation.errors,
        details: validation.details
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        installPath
      };
    }
  }

  /**
   * Uninstall Claude configuration
   * @param {Object} options - Uninstall options
   * @returns {Promise<Object>} Uninstall result
   */
  async uninstall(options = {}) {
    // TODO: Implement uninstall logic
    return {
      success: false,
      error: 'Uninstall functionality not yet implemented'
    };
  }

  /**
   * Get installation path based on scope
   * @param {string} scope - Installation scope (global|local)
   * @returns {Object} Installation paths
   */
  getInstallPath(scope) {
    if (scope === 'global') {
      return {
        claude: path.join(require('os').homedir(), '.claude'),
        aiMesh: path.join(require('os').homedir(), '.ai-mesh')
      };
    } else {
      return {
        claude: path.join(process.cwd(), '.claude'),
        aiMesh: path.join(process.cwd(), '.ai-mesh')
      };
    }
  }

  /**
   * Get installer version
   * @returns {string} Version string
   */
  getVersion() {
    try {
      const packageJson = require('../../package.json');
      return packageJson.version;
    } catch {
      return 'unknown';
    }
  }

  /**
   * Check if installation exists
   * @param {string} scope - Installation scope
   * @returns {Promise<boolean>} True if installation exists
   */
  async isInstalled(scope = 'global') {
    const installPath = this.getInstallPath(scope);
    const validation = await this.validator.validateInstallation(installPath);
    return validation.success;
  }
}

/**
 * Convenience factory function
 * @param {Object} options - Installer options
 * @returns {ClaudeInstallerAPI} API instance
 */
function createInstaller(options = {}) {
  return new ClaudeInstallerAPI(options);
}

/**
 * Quick install function for simple use cases
 * @param {Object} options - Installation options
 * @returns {Promise<Object>} Installation result
 */
async function quickInstall(options = {}) {
  const installer = createInstaller(options);
  return installer.install();
}

/**
 * Quick validation function
 * @param {Object} options - Validation options
 * @returns {Promise<Object>} Validation result
 */
async function quickValidate(options = {}) {
  const installer = createInstaller(options);
  return installer.validate();
}

module.exports = {
  ClaudeInstallerAPI,
  createInstaller,
  quickInstall,
  quickValidate
};