/**
 * Claude Configuration Installer CLI
 * Main CLI interface for installing Claude configuration
 */

const fs = require('fs').promises;
const path = require('path');
const { AgentInstaller } = require('../installer/agent-installer.js');
const { CommandInstaller } = require('../installer/command-installer.js');
const { SkillInstaller } = require('../installer/skill-installer.js');
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

      // Determine tool (if not specified)
      if (!options.tool) {
        options.tool = await this.determineTool();
      }

      // Determine installation scope
      const scope = await this.determineScope(options);
      const installPath = this.getInstallPath(scope, options.tool);

      const installationExists = await this.validator.checkInstallationExists(installPath, options.tool);

      if (installationExists && !options.force) {
        this.logger.warning('⚠️  Existing installation detected!');
        this.logger.info(`📁 Found installation at: ${installPath[options.tool]}`);
        this.logger.info('');
        this.logger.info('💡 To update your installation, use:');
        this.logger.info(`   ai-mesh update --tool ${options.tool} ${scope === 'global' ? '--global' : '--local'}`);
        this.logger.info('');
        this.logger.info('💡 To force reinstall (overwrites existing files), use:');
        this.logger.info(`   ai-mesh install --tool ${options.tool} ${scope === 'global' ? '--global' : '--local'} --force`);
        this.logger.info('');

        const shouldUpdate = await this.promptYesNo('Would you like to run update instead?');
        
        if (shouldUpdate) {
          this.logger.info('🔄 Switching to update command...');
          return this.update(args);
        } else {
          this.logger.warning('❌ Installation cancelled. Use --force to override.');
          process.exit(0);
        }
      }

      this.logger.info(`📍 Tool: ${options.tool}`);
      this.logger.info(`📍 Installation scope: ${scope}`);
      this.logger.info(`📁 Target path: ${installPath[options.tool]}`);

      // Create installation progress tracker
      const steps = [
        'Setting up runtime environment',
        'Installing agents',
        'Installing commands',
        'Installing skills',
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
if (options.tool === 'opencode') {
  this.logger.info('Skipping runtime setup for opencode');
} else {
  const runtimeSetup = new RuntimeSetup(installPath, this.logger, options.tool);
  await runtimeSetup.initialize();
}

// Step 2: Install agents
updateProgress(steps[1]);
const agentInstaller = new AgentInstaller(installPath, this.logger, options);
await agentInstaller.install(options.tool);

// Step 3: Install commands
updateProgress(steps[2]);
const commandInstaller = new CommandInstaller(installPath, this.logger, options);
await commandInstaller.install(options.tool);

// Step 4: Install skills
updateProgress(steps[3]);
const skillInstaller = new SkillInstaller(installPath, this.logger, options);
await skillInstaller.install(options.tool);

      // Step 5: Configure settings
      updateProgress(steps[4]);
      if (options.tool === 'claude') {
        const settingsManager = new SettingsManager(installPath, this.logger);
        await settingsManager.configure();
      } else {
        this.logger.info(`Skipping settings configuration for ${options.tool}`);
      }

      // Step 6: Validate installation
      updateProgress(steps[5]);
      const validation = await this.validator.validateInstallation(installPath, options.tool);

      if (validation.success) {
        this.logger.success('✅ Installation completed successfully!');
        this.showInstallationSummary(validation.summary, installPath, options.tool);
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
      configFile: null,
      tool: null // Will prompt if not specified
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
case '--tool':
case '-t':
  options.tool = args[++i].toLowerCase();
  break;
      }
    }

    return options;
  }

  async determineTool() {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      console.log('\\n🤖 Choose AI tool:');
      console.log('  1) Claude (Anthropic Claude Code)');
      console.log('  2) OpenCode (OpenAI Assistant)');
      console.log('');

      rl.question('Enter your choice (1 for claude, 2 for opencode): ', (answer) => {
        rl.close();
        const tool = answer.trim() === '1' ? 'claude' : 'opencode';
        resolve(tool);
      });
    });
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

  getInstallPath(scope, tool) {
    const baseDir = tool === 'claude' ? '.claude' : '.opencode';
    const meshDir = tool === 'claude' ? '.ai-mesh' : '.opencode-mesh'; // Adjust if needed

    if (scope === 'global') {
      return {
        [tool]: path.join(require('os').homedir(), baseDir),
        mesh: path.join(require('os').homedir(), meshDir)
      };
    } else {
      return {
        [tool]: path.join(process.cwd(), baseDir),
        mesh: path.join(process.cwd(), meshDir)
      };
    }
  }

  showInstallationSummary(summary, installPath, tool) {
    console.log('\n' + '='.repeat(60));
    console.log('🎉 INSTALLATION COMPLETE!');
    console.log('='.repeat(60));
    console.log(`📁 Config: ${installPath[tool]}`);
    console.log(`📁 Runtime: ${installPath.mesh}`);
    console.log('');
    console.log(`✅ Agents installed: ${summary.agents}`);
    console.log(`✅ Commands installed: ${summary.commands}`);
    console.log('');
    console.log('🚀 Next steps:');
    console.log('  1. Restart Claude Code to load the new configuration');
    console.log('  2. Test with: ai-mesh validate');
    console.log('  3. Run: /agents command in Claude Code');
    console.log('='.repeat(60));
  }

  showUpdateSummary(agentResults, commandResults, installPath, tool) {
    console.log('\n' + '='.repeat(60));
    console.log('🎉 UPDATE COMPLETE!');
    console.log('='.repeat(60));
    console.log(`📁 Config: ${installPath[tool]}`);
    console.log(`📁 Runtime: ${installPath.mesh}`);
    console.log('');
    console.log(`✅ Agents: ${agentResults.installed} updated, ${agentResults.skipped} unchanged`);
    console.log(`✅ Commands: ${commandResults.installed} updated, ${commandResults.skipped} unchanged`);
    console.log('');
    console.log('🚀 Next steps:');
    console.log('  1. Restart Claude Code to load the updated configuration');
    console.log('  2. Test with: ai-mesh validate');
    console.log('='.repeat(60));
  }

  async promptYesNo(question) {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question(`${question} (y/n): `, (answer) => {
        rl.close();
        resolve(answer.trim().toLowerCase() === 'y');
      });
    });
  }

  async update(args) {
    this.logger.info('🔄 Updating Claude Configuration...');

    const options = this.parseInstallOptions(args);
    options.force = true;

    try {
      if (!options.tool) {
        options.tool = await this.determineTool();
      }

      let scope = options.scope;
      
      if (!scope) {
        const localPath = this.getInstallPath('local', options.tool);
        const globalPath = this.getInstallPath('global', options.tool);
        
        const localExists = await this.validator.checkInstallationExists(localPath, options.tool);
        const globalExists = await this.validator.checkInstallationExists(globalPath, options.tool);
        
        if (localExists && globalExists) {
          this.logger.warning('⚠️  Found both local and global installations');
          scope = await this.determineScope(options);
        } else if (localExists) {
          scope = 'local';
          this.logger.info('📍 Detected local installation');
        } else if (globalExists) {
          scope = 'global';
          this.logger.info('📍 Detected global installation');
        } else {
          scope = await this.determineScope(options);
        }
      }

      const installPath = this.getInstallPath(scope, options.tool);
      const installationExists = await this.validator.checkInstallationExists(installPath, options.tool);

      if (!installationExists) {
        this.logger.error('❌ No existing installation found');
        this.logger.info('💡 Use "install" command to perform a fresh installation');
        process.exit(1);
      }

      this.logger.info(`📍 Tool: ${options.tool}`);
      this.logger.info(`📍 Installation scope: ${scope}`);
      this.logger.info(`📁 Target path: ${installPath[options.tool]}`);
      this.logger.info('🔄 Updating existing installation (will overwrite files)...');

      const steps = [
        'Setting up runtime environment',
        'Updating agents',
        'Updating commands',
        'Configuring settings',
        'Validating installation'
      ];

      let currentStep = 0;
      const updateProgress = (step) => {
        currentStep++;
        const percentage = Math.round((currentStep / steps.length) * 100);
        this.logger.progress(`[${percentage}%] ${step}`);
      };

      updateProgress(steps[0]);
      if (options.tool === 'opencode') {
        this.logger.info('Skipping runtime setup for opencode');
      } else {
        const runtimeSetup = new RuntimeSetup(installPath, this.logger, options.tool);
        await runtimeSetup.initialize();
      }

      updateProgress(steps[1]);
      const agentInstaller = new AgentInstaller(installPath, this.logger, options);
      const agentResults = await agentInstaller.install(options.tool);

      updateProgress(steps[2]);
      const commandInstaller = new CommandInstaller(installPath, this.logger, options);
      const commandResults = await commandInstaller.install(options.tool);

      updateProgress(steps[3]);
      if (options.tool === 'claude') {
        const settingsManager = new SettingsManager(installPath, this.logger);
        await settingsManager.configure();
      } else {
        this.logger.info(`Skipping settings configuration for ${options.tool}`);
      }

      updateProgress(steps[4]);
      const validation = await this.validator.validateInstallation(installPath, options.tool);

      if (validation.success) {
        this.logger.success('✅ Update completed successfully!');
        this.showUpdateSummary(agentResults, commandResults, installPath, options.tool);
      } else {
        this.logger.error('❌ Update validation failed');
        this.logger.error(validation.errors.join('\n'));
        process.exit(1);
      }

    } catch (error) {
      this.logger.error(`❌ Update failed: ${error.message}`);
      if (process.env.DEBUG) {
        this.logger.error(error.stack);
      }
      process.exit(1);
    }
  }

  async validate(args) {
    this.logger.info('🔍 Validating Claude Configuration...');

    const options = this.parseInstallOptions(args);
    
    // Determine tool if not specified
    const tool = options.tool || 'claude';

    // Try to detect which installation exists, or use specified scope
    let installPath;
    if (options.scope) {
      installPath = this.getInstallPath(options.scope, tool);
    } else {
      // Check local first, then global
      const localPath = this.getInstallPath('local', tool);
      const globalPath = this.getInstallPath('global', tool);

      const localValidation = await this.validator.validateInstallation(localPath, tool);
      const globalValidation = await this.validator.validateInstallation(globalPath, tool);

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

    const validation = await this.validator.validateInstallation(installPath, tool);

    if (validation.success) {
      this.logger.success('✅ Installation is valid and working correctly!');
      this.logger.info(`📁 Installation path: ${installPath[tool]}`);
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
  --tool, -t TOOL     Target tool: 'claude' or 'opencode' (will prompt if not specified)
  --global, -g        Install globally (available across all projects)
  --local, -l         Install locally (project-specific)
  --force, -f         Force installation, overwrite existing files
  --skip-validation   Skip environment validation
  --config, -c FILE   Use custom configuration file

EXAMPLES:
  claude-installer install
  claude-installer install --tool opencode --global
  claude-installer install --tool claude --local --force
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