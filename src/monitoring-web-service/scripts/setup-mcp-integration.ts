#!/usr/bin/env ts-node

/**
 * MCP Integration Setup CLI Tool
 * Task 4.6: Command-line interface for setting up MCP integration
 * 
 * Usage:
 *   npm run setup-mcp -- --detect
 *   npm run setup-mcp -- --configure --server-url http://localhost:3000
 *   npm run setup-mcp -- --help
 */

import { program } from 'commander';
import { McpConfigurationDetector } from '../src/utils/mcp-config-detector';
import { createLogger } from 'winston';
import chalk from 'chalk';
import inquirer from 'inquirer';

// Configure logger for CLI
const logger = createLogger({
  level: 'info',
  format: require('winston').format.combine(
    require('winston').format.timestamp(),
    require('winston').format.colorize(),
    require('winston').format.simple()
  ),
  transports: [
    new (require('winston').transports.Console)()
  ]
});

interface SetupOptions {
  detect?: boolean;
  configure?: boolean;
  serverUrl?: string;
  apiKey?: string;
  organizationId?: string;
  autoConnect?: boolean;
  fallbackLocal?: boolean;
  interactive?: boolean;
  quiet?: boolean;
  output?: string;
}

class McpSetupCli {
  private detector: McpConfigurationDetector;

  constructor() {
    this.detector = new McpConfigurationDetector(logger);
  }

  async run(options: SetupOptions): Promise<void> {
    try {
      if (!options.quiet) {
        this.printBanner();
      }

      if (options.detect || (!options.configure && !options.interactive)) {
        await this.runDetection(options);
      }

      if (options.configure) {
        await this.runConfiguration(options);
      }

      if (options.interactive) {
        await this.runInteractiveSetup(options);
      }

    } catch (error) {
      console.error(chalk.red('❌ Setup failed:'), error);
      process.exit(1);
    }
  }

  private printBanner(): void {
    console.log(chalk.cyan(`
╔══════════════════════════════════════════════════════════════════╗
║              Fortium MCP Integration Setup Tool                  ║
║                                                                  ║
║  Configure Claude Code to connect to Fortium Metrics Server     ║
╚══════════════════════════════════════════════════════════════════╝
    `));
  }

  private async runDetection(options: SetupOptions): Promise<void> {
    console.log(chalk.blue('🔍 Detecting Claude Code configurations...\n'));

    const detection = await this.detector.detectConfiguration();

    // Display Claude installations
    console.log(chalk.bold('Claude Installations:'));
    if (detection.claude_installations.length === 0) {
      console.log(chalk.red('  ❌ No Claude installations found'));
    } else {
      detection.claude_installations.forEach(install => {
        const status = install.configured ? '✅ Configured' : '⚙️  Not configured';
        console.log(`  ${status} ${install.type}${install.version ? ` (${install.version})` : ''}`);
        console.log(`     Path: ${install.path}`);
      });
    }

    console.log('');

    // Display configuration locations
    console.log(chalk.bold('Configuration Locations:'));
    detection.config_locations.forEach(location => {
      const existsIcon = location.exists ? '📁' : '📂';
      const permissions = [];
      if (location.readable) permissions.push('R');
      if (location.writable) permissions.push('W');
      
      console.log(`  ${existsIcon} ${location.type}: ${location.path}`);
      console.log(`     Config: ${location.configFile}`);
      console.log(`     Permissions: ${permissions.join('') || 'None'}`);
    });

    console.log('');

    // Display existing MCP servers
    console.log(chalk.bold('Existing MCP Servers:'));
    if (detection.existing_mcp_servers.length === 0) {
      console.log(chalk.gray('  No MCP servers configured'));
    } else {
      detection.existing_mcp_servers.forEach(server => {
        console.log(`  🔌 ${server.name}: ${server.command}`);
        if (server.args?.length) {
          console.log(`     Args: ${server.args.join(' ')}`);
        }
      });
    }

    console.log('');

    // Display Fortium agents
    console.log(chalk.bold('Fortium Agents:'));
    if (detection.fortium_agents.length === 0) {
      console.log(chalk.gray('  No Fortium agents found'));
    } else {
      const validAgents = detection.fortium_agents.filter(a => a.valid);
      const invalidAgents = detection.fortium_agents.filter(a => !a.valid);
      
      console.log(`  ✅ Valid agents: ${validAgents.length}`);
      console.log(`  ❌ Invalid agents: ${invalidAgents.length}`);
      
      if (validAgents.length > 0) {
        validAgents.slice(0, 5).forEach(agent => {
          console.log(`     • ${agent.name} (${agent.type})`);
        });
        
        if (validAgents.length > 5) {
          console.log(`     ... and ${validAgents.length - 5} more`);
        }
      }
    }

    console.log('');

    // Display recommendations
    console.log(chalk.bold('Recommendations:'));
    if (detection.recommendations.length === 0) {
      console.log(chalk.green('  ✅ No issues detected - configuration looks good!'));
    } else {
      detection.recommendations.forEach(rec => {
        const icon = rec.type === 'error' ? '❌' : rec.type === 'warning' ? '⚠️' : '💡';
        const color = rec.type === 'error' ? chalk.red : rec.type === 'warning' ? chalk.yellow : chalk.blue;
        
        console.log(color(`  ${icon} ${rec.message}`));
        if (rec.action) {
          console.log(color(`     Action: ${rec.action}`));
        }
      });
    }

    // Save detailed report if requested
    if (options.output) {
      const report = {
        timestamp: new Date().toISOString(),
        detection_result: detection,
        environment: {
          platform: process.platform,
          node_version: process.version,
          working_directory: process.cwd()
        }
      };

      const fs = require('fs');
      fs.writeFileSync(options.output, JSON.stringify(report, null, 2));
      console.log(chalk.green(`\n📄 Detailed report saved to: ${options.output}`));
    }
  }

  private async runConfiguration(options: SetupOptions): Promise<void> {
    console.log(chalk.blue('⚙️  Configuring MCP integration...\n'));

    if (!options.serverUrl) {
      console.error(chalk.red('❌ Server URL is required for configuration'));
      process.exit(1);
    }

    const integrationConfig = {
      server_url: options.serverUrl,
      api_key: options.apiKey,
      organization_id: options.organizationId,
      auto_connect: options.autoConnect !== false,
      fallback_local: options.fallbackLocal !== false
    };

    const result = await this.detector.autoConfigureMcp(integrationConfig);

    if (result.success) {
      console.log(chalk.green('✅ MCP integration configured successfully!'));
      console.log(`📁 Configuration file: ${result.configPath}`);
      
      if (result.backup_path) {
        console.log(`💾 Backup created: ${result.backup_path}`);
      }
      
      console.log('\n' + chalk.bold('Next steps:'));
      console.log('1. Restart Claude Code to load the new configuration');
      console.log('2. Test the connection with: claude mcp list');
      console.log('3. Verify metrics collection is working');

    } else {
      console.error(chalk.red('❌ Configuration failed:'), result.message);
      process.exit(1);
    }
  }

  private async runInteractiveSetup(options: SetupOptions): Promise<void> {
    console.log(chalk.blue('🤖 Starting interactive setup...\n'));

    // First, run detection to show current state
    await this.runDetection({ ...options, quiet: true });

    console.log('\n' + chalk.bold('Interactive Configuration Setup'));
    console.log('Answer the following questions to configure MCP integration:\n');

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'serverUrl',
        message: 'Enter Fortium Metrics Server URL:',
        default: 'http://localhost:3000',
        validate: (input: string) => {
          try {
            new URL(input);
            return true;
          } catch {
            return 'Please enter a valid URL';
          }
        }
      },
      {
        type: 'input',
        name: 'apiKey',
        message: 'Enter API Key (optional):',
        default: ''
      },
      {
        type: 'input',
        name: 'organizationId',
        message: 'Enter Organization ID (optional):',
        default: ''
      },
      {
        type: 'confirm',
        name: 'autoConnect',
        message: 'Enable automatic connection on startup?',
        default: true
      },
      {
        type: 'confirm',
        name: 'fallbackLocal',
        message: 'Enable local fallback if server is unavailable?',
        default: true
      },
      {
        type: 'confirm',
        name: 'proceed',
        message: 'Proceed with configuration?',
        default: true
      }
    ]);

    if (!answers.proceed) {
      console.log(chalk.yellow('Setup cancelled by user'));
      return;
    }

    // Run configuration with interactive answers
    await this.runConfiguration({
      ...options,
      configure: true,
      serverUrl: answers.serverUrl,
      apiKey: answers.apiKey || undefined,
      organizationId: answers.organizationId || undefined,
      autoConnect: answers.autoConnect,
      fallbackLocal: answers.fallbackLocal
    });
  }
}

// CLI Program Definition
program
  .name('setup-mcp')
  .description('Setup MCP integration between Claude Code and Fortium Metrics Server')
  .version('1.0.0');

program
  .command('detect')
  .description('Detect existing Claude Code configurations')
  .option('--output <file>', 'Save detailed report to file')
  .option('--quiet', 'Suppress non-essential output')
  .action(async (options) => {
    const cli = new McpSetupCli();
    await cli.run({ ...options, detect: true });
  });

program
  .command('configure')
  .description('Configure MCP integration with Fortium Metrics Server')
  .requiredOption('--server-url <url>', 'Fortium Metrics Server URL')
  .option('--api-key <key>', 'API key for authentication')
  .option('--organization-id <id>', 'Organization ID')
  .option('--no-auto-connect', 'Disable automatic connection')
  .option('--no-fallback-local', 'Disable local fallback')
  .option('--quiet', 'Suppress non-essential output')
  .action(async (options) => {
    const cli = new McpSetupCli();
    await cli.run({ ...options, configure: true });
  });

program
  .command('interactive')
  .description('Interactive setup with guided configuration')
  .option('--quiet', 'Suppress detection output')
  .action(async (options) => {
    const cli = new McpSetupCli();
    await cli.run({ ...options, interactive: true });
  });

program
  .command('status')
  .description('Show current MCP integration status')
  .option('--output <file>', 'Save status report to file')
  .action(async (options) => {
    const cli = new McpSetupCli();
    await cli.run({ ...options, detect: true });
  });

// Handle unknown commands
program.on('command:*', () => {
  console.error(chalk.red('Invalid command. See --help for available commands.'));
  process.exit(1);
});

// Parse command line arguments
if (process.argv.length < 3) {
  program.help();
}

program.parse();