/**
 * Claude Configuration Installer CLI
 * Main CLI interface for installing Claude configuration
 */

const fs = require('fs').promises;
const path = require('path');
const { AgentInstaller } = require('../installer/agent-installer.js');
const { CommandInstaller } = require('../installer/command-installer.js');
const { HookInstaller } = require('../installer/hook-installer.js');
const { RuntimeSetup } = require('../installer/runtime-setup.js');
const { SettingsManager } = require('../installer/settings-manager.js');
const { Logger } = require('../utils/logger.js');
const { Validator } = require('../utils/validator.js');

class ClaudeInstaller {
  constructor() {
    this.logger = new Logger();
    this.validator = new Validator();
  }

  async run(args) {
    const command = args[0] || 'install';

    switch (command) {
      case 'install':
        return this.install(args.slice(1));
      case 'update':
        return this.update(args.slice(1));
      case 'validate':
        return this.validate(args.slice(1));
      case 'uninstall':
        return this.uninstall(args.slice(1));
      case '--help':
      case '-h':
      case 'help':
        return this.showHelp();
      case '--version':
      case '-v':
        return this.showVersion();
      default:
        this.logger.error(`Unknown command: ${command}`);
        this.showHelp();
        process.exit(1);
    }
  }

  async install(args) {
    this.logger.info('🚀 Starting Claude Configuration Installation...');

    const options = this.parseInstallOptions(args);

    try {
      // Pre-flight checks
      await this.validator.validateEnvironment();

      // Determine installation scope
      const scope = await this.determineScope(options);
      const installPath = this.getInstallPath(scope);

      this.logger.info(`📍 Installation scope: ${scope}`);
      this.logger.info(`📁 Target path: ${installPath}`);

      // Create installation progress tracker
      const steps = [
        'Setting up runtime environment',
        'Installing agents',
        'Installing commands',
        'Installing hooks',
        'Configuring settings',
        'Validating installation'
      ];

      let currentStep = 0;
      const updateProgress = (step) => {
        currentStep++;
        const percentage = Math.round((currentStep / steps.length) * 100);
        this.logger.progress(`[${percentage}%] ${step}`);
      };

      // Step 1: Setup runtime environment
      updateProgress(steps[0]);
      const runtimeSetup = new RuntimeSetup(installPath, this.logger);
      await runtimeSetup.initialize();

      // Step 2: Install agents
      updateProgress(steps[1]);
      const agentInstaller = new AgentInstaller(installPath, this.logger);
      await agentInstaller.install();

      // Step 3: Install commands
      updateProgress(steps[2]);
      const commandInstaller = new CommandInstaller(installPath, this.logger);
      await commandInstaller.install();

      // Step 4: Install hooks
      updateProgress(steps[3]);
      const hookInstaller = new HookInstaller(installPath, this.logger);
      await hookInstaller.install();

      // Step 5: Configure settings
      updateProgress(steps[4]);
      const settingsManager = new SettingsManager(installPath, this.logger);
      await settingsManager.configure();

      // Step 6: Validate installation
      updateProgress(steps[5]);
      const validation = await this.validator.validateInstallation(installPath);

      if (validation.success) {
        this.logger.success('✅ Installation completed successfully!');
        this.showInstallationSummary(validation.summary, installPath);
      } else {
        this.logger.error('❌ Installation validation failed');
        this.logger.error(validation.errors.join('\\n'));
        process.exit(1);
      }

    } catch (error) {
      this.logger.error(`❌ Installation failed: ${error.message}`);
      if (process.env.DEBUG) {
        this.logger.error(error.stack);
      }
      process.exit(1);
    }
  }

  parseInstallOptions(args) {
    const options = {
      scope: null,
      force: false,
      skipValidation: false,
      configFile: null
    };

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      switch (arg) {
        case '--global':
        case '-g':
          options.scope = 'global';
          break;
        case '--local':
        case '-l':
          options.scope = 'local';
          break;
        case '--force':
        case '-f':
          options.force = true;
          break;
        case '--skip-validation':
          options.skipValidation = true;
          break;
        case '--config':
        case '-c':
          options.configFile = args[++i];
          break;
      }
    }

    return options;
  }

  async determineScope(options) {
    if (options.scope) {
      return options.scope;
    }

    // Interactive prompt for scope selection
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      console.log('\\n🔧 Choose installation scope:');
      console.log('  1) Global installation (available across all projects)');
      console.log('  2) Local installation (project-specific configuration)');
      console.log('');

      rl.question('Enter your choice (1 for global, 2 for local): ', (answer) => {
        rl.close();
        const scope = answer.trim() === '1' ? 'global' : 'local';
        resolve(scope);
      });
    });
  }

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

  showInstallationSummary(summary, installPath) {
    console.log('\\n' + '='.repeat(60));
    console.log('🎉 INSTALLATION COMPLETE!');
    console.log('='.repeat(60));
    console.log(`📁 Claude Config: ${installPath.claude}`);
    console.log(`📁 AI Mesh Runtime: ${installPath.aiMesh}`);
    console.log('');
    console.log(`✅ Agents installed: ${summary.agents}`);
    console.log(`✅ Commands installed: ${summary.commands}`);
    console.log(`✅ Hooks installed: ${summary.hooks}`);
    console.log('');
    console.log('🚀 Next steps:');
    console.log('  1. Restart Claude Code to load the new configuration');
    console.log('  2. Test with: claude-installer validate');
    console.log('  3. Run: /agents command in Claude Code');
    console.log('='.repeat(60));
  }

  async update(args) {
    this.logger.info('🔄 Updating Claude Configuration...');
    // TODO: Implement update logic
    this.logger.warning('Update functionality coming soon!');
  }

  async validate(args) {
    this.logger.info('🔍 Validating Claude Configuration...');

    const options = this.parseInstallOptions(args);

    // Try to detect which installation exists, or use specified scope
    let installPath;
    if (options.scope) {
      installPath = this.getInstallPath(options.scope);
    } else {
      // Check local first, then global
      const localPath = this.getInstallPath('local');
      const globalPath = this.getInstallPath('global');

      const localValidation = await this.validator.validateInstallation(localPath);
      const globalValidation = await this.validator.validateInstallation(globalPath);

      if (localValidation.success) {
        installPath = localPath;
        this.logger.info('📍 Found local installation');
      } else if (globalValidation.success) {
        installPath = globalPath;
        this.logger.info('📍 Found global installation');
      } else {
        // If neither works, default to global for error reporting
        installPath = globalPath;
      }
    }

    const validation = await this.validator.validateInstallation(installPath);

    if (validation.success) {
      this.logger.success('✅ Installation is valid and working correctly!');
      this.logger.info(`📁 Installation path: ${installPath.claude}`);
    } else {
      this.logger.error('❌ Validation failed:');
      validation.errors.forEach(error => this.logger.error(`  • ${error}`));
      process.exit(1);
    }
  }

  async uninstall(args) {
    this.logger.info('🗑️  Uninstalling Claude Configuration...');
    // TODO: Implement uninstall logic
    this.logger.warning('Uninstall functionality coming soon!');
  }

  showHelp() {
    console.log(`
Claude Configuration Installer

USAGE:
  claude-installer [COMMAND] [OPTIONS]

COMMANDS:
  install     Install Claude configuration (default)
  update      Update existing installation
  validate    Validate current installation
  uninstall   Remove Claude configuration
  help        Show this help message

INSTALL OPTIONS:
  --global, -g        Install globally (available across all projects)
  --local, -l         Install locally (project-specific)
  --force, -f         Force installation, overwrite existing files
  --skip-validation   Skip environment validation
  --config, -c FILE   Use custom configuration file

EXAMPLES:
  claude-installer install --global
  claude-installer install --local --force
  claude-installer validate
  claude-installer update

For more information, visit: https://github.com/FortiumPartners/claude-config
`);
  }

  showVersion() {
    const packageJson = require('../../package.json');
    console.log(`claude-installer v${packageJson.version}`);
  }
}

module.exports = { ClaudeInstaller };