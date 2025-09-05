#!/usr/bin/env ts-node

/**
 * Metrics Migration CLI Tool
 * Task 4.4: Command-line interface for migrating local metrics to web service
 * 
 * Usage:
 *   npm run migrate-metrics -- --org-id <org-id> --config-path <path>
 *   npm run migrate-metrics -- --org-id <org-id> --auto-discover
 *   npm run migrate-metrics -- --help
 */

import { program } from 'commander';
import { DatabaseConnection } from '../src/database/connection';
import { MigrationService } from '../src/services/migration.service';
import { createLogger } from 'winston';
import * as path from 'path';
import * as fs from 'fs';
import chalk from 'chalk';

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

interface MigrationCliOptions {
  orgId: string;
  configPath?: string;
  autoDiscover?: boolean;
  dryRun?: boolean;
  preserveLocal?: boolean;
  batchSize?: number;
  output?: string;
  quiet?: boolean;
  force?: boolean;
}

class MigrationCli {
  private db: DatabaseConnection;
  private migrationService: MigrationService;

  constructor() {
    this.db = new DatabaseConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'fortium_metrics',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || ''
    });
    
    this.migrationService = new MigrationService(this.db, logger);
  }

  async run(options: MigrationCliOptions): Promise<void> {
    try {
      if (!options.quiet) {
        this.printBanner();
      }

      // Connect to database
      await this.db.connect();
      
      if (!options.quiet) {
        console.log(chalk.green('✓ Connected to database'));
      }

      // Validate prerequisites
      const validation = await this.migrationService.validateMigrationPrerequisites(options.orgId);
      
      if (!validation.valid && !options.force) {
        console.error(chalk.red('❌ Migration prerequisites not met:'));
        validation.issues.forEach(issue => {
          console.error(chalk.red(`  • ${issue}`));
        });
        
        if (validation.suggestions.length > 0) {
          console.log(chalk.yellow('\n💡 Suggestions:'));
          validation.suggestions.forEach(suggestion => {
            console.log(chalk.yellow(`  • ${suggestion}`));
          });
        }
        
        console.log(chalk.gray('\nUse --force to bypass validation'));
        process.exit(1);
      }

      if (validation.suggestions.length > 0 && !options.quiet) {
        console.log(chalk.yellow('⚠️  Notes:'));
        validation.suggestions.forEach(suggestion => {
          console.log(chalk.yellow(`  • ${suggestion}`));
        });
        console.log('');
      }

      // Perform migration
      const migrationOptions = {
        local_config_path: options.configPath,
        preserve_local: options.preserveLocal,
        dry_run: options.dryRun,
        batch_size: options.batchSize || 100
      };

      console.log(chalk.blue('🚀 Starting migration...'));
      
      if (options.dryRun) {
        console.log(chalk.yellow('🔍 DRY RUN MODE - No actual changes will be made'));
      }

      const result = await this.migrationService.migrateLocalMetrics(
        options.orgId,
        'cli-user', // CLI user ID
        migrationOptions
      );

      // Display results
      this.displayResults(result, options);

      // Save detailed report if output specified
      if (options.output) {
        await this.saveReport(result, options.output);
      }

      await this.db.disconnect();

    } catch (error) {
      console.error(chalk.red('❌ Migration failed:'), error);
      process.exit(1);
    }
  }

  private printBanner(): void {
    console.log(chalk.cyan(`
╔══════════════════════════════════════════════════════════════════╗
║                    Fortium Metrics Migration Tool                ║
║                                                                  ║
║  Migrate local Claude Code metrics to Fortium Web Service       ║
╚══════════════════════════════════════════════════════════════════╝
    `));
  }

  private displayResults(result: any, options: MigrationCliOptions): void {
    console.log('');
    
    if (result.success) {
      console.log(chalk.green('✅ Migration completed successfully!'));
    } else {
      console.log(chalk.red('❌ Migration completed with issues'));
    }

    console.log('');
    console.log(chalk.bold('Migration Summary:'));
    console.log(`  📊 Metrics migrated: ${chalk.cyan(result.metrics_migrated)}`);
    console.log(`  ⚙️  Configuration migrated: ${chalk.cyan(result.config_migrated ? 'Yes' : 'No')}`);
    
    if (result.backup_location) {
      console.log(`  💾 Backup created: ${chalk.green(result.backup_location)}`);
    }

    if (result.errors.length > 0) {
      console.log('');
      console.log(chalk.red('❌ Errors:'));
      result.errors.forEach((error: string) => {
        console.log(chalk.red(`  • ${error}`));
      });
    }

    if (result.warnings.length > 0) {
      console.log('');
      console.log(chalk.yellow('⚠️  Warnings:'));
      result.warnings.forEach((warning: string) => {
        console.log(chalk.yellow(`  • ${warning}`));
      });
    }

    console.log('');
    
    if (result.success) {
      if (options.dryRun) {
        console.log(chalk.blue('🔍 Dry run completed. Run without --dry-run to perform actual migration.'));
      } else {
        console.log(chalk.green('✨ Your local metrics have been successfully migrated to the web service!'));
        console.log(chalk.gray('   You can now access real-time dashboards and analytics.'));
      }
    }
  }

  private async saveReport(result: any, outputPath: string): Promise<void> {
    const report = {
      timestamp: new Date().toISOString(),
      migration_result: result,
      environment: {
        node_version: process.version,
        platform: process.platform,
        working_directory: process.cwd()
      }
    };

    try {
      fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
      console.log(chalk.green(`📝 Detailed report saved to: ${outputPath}`));
    } catch (error) {
      console.error(chalk.red(`Failed to save report: ${error}`));
    }
  }
}

// CLI Program Definition
program
  .name('migrate-metrics')
  .description('Migrate local Claude Code metrics to Fortium Web Service')
  .version('1.0.0');

program
  .command('migrate')
  .description('Migrate metrics from local files to web service')
  .requiredOption('--org-id <orgId>', 'Organization ID for migration target')
  .option('--config-path <path>', 'Path to local configuration directory')
  .option('--auto-discover', 'Automatically discover local metrics in common locations')
  .option('--dry-run', 'Preview migration without making changes')
  .option('--preserve-local', 'Keep local files after migration (creates backup)')
  .option('--batch-size <size>', 'Number of metrics to process in each batch', '100')
  .option('--output <file>', 'Save detailed migration report to file')
  .option('--quiet', 'Suppress non-essential output')
  .option('--force', 'Bypass validation checks')
  .action(async (options) => {
    const cli = new MigrationCli();
    await cli.run(options);
  });

program
  .command('validate')
  .description('Validate migration prerequisites without migrating')
  .requiredOption('--org-id <orgId>', 'Organization ID to validate')
  .option('--quiet', 'Suppress non-essential output')
  .action(async (options) => {
    try {
      const cli = new MigrationCli();
      const db = new DatabaseConnection({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'fortium_metrics',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || ''
      });

      await db.connect();
      const migrationService = new MigrationService(db, logger);
      const validation = await migrationService.validateMigrationPrerequisites(options.orgId);

      if (!options.quiet) {
        console.log(chalk.cyan('🔍 Migration Prerequisites Validation\n'));
      }

      if (validation.valid) {
        console.log(chalk.green('✅ All prerequisites met - migration can proceed'));
      } else {
        console.log(chalk.red('❌ Prerequisites not met:'));
        validation.issues.forEach(issue => {
          console.log(chalk.red(`  • ${issue}`));
        });
      }

      if (validation.suggestions.length > 0) {
        console.log(chalk.yellow('\n💡 Suggestions:'));
        validation.suggestions.forEach(suggestion => {
          console.log(chalk.yellow(`  • ${suggestion}`));
        });
      }

      await db.disconnect();
      process.exit(validation.valid ? 0 : 1);

    } catch (error) {
      console.error(chalk.red('Validation failed:'), error);
      process.exit(1);
    }
  });

program
  .command('discover')
  .description('Discover local metrics files without migrating')
  .option('--base-path <path>', 'Base directory to search', process.cwd())
  .option('--quiet', 'Suppress non-essential output')
  .action(async (options) => {
    const basePaths = options.basePath ? [options.basePath] : [
      path.join(process.env.HOME || '~', '.agent-os'),
      path.join(process.env.HOME || '~', '.claude'),
      path.join(process.cwd(), '.agent-os'),
      path.join(process.cwd(), '.claude')
    ];

    if (!options.quiet) {
      console.log(chalk.cyan('🔍 Discovering Local Metrics Files\n'));
    }

    for (const basePath of basePaths) {
      if (fs.existsSync(basePath)) {
        console.log(chalk.blue(`📁 Searching in: ${basePath}`));
        
        // This is a simplified discovery - in a real implementation,
        // you'd use the same discovery logic from MigrationService
        const files = fs.readdirSync(basePath, { recursive: true })
          .filter(file => {
            const fileName = file.toString().toLowerCase();
            return fileName.includes('metric') || 
                   fileName.includes('dashboard') || 
                   fileName.includes('command');
          });

        if (files.length > 0) {
          files.forEach(file => {
            console.log(chalk.green(`  ✓ ${file}`));
          });
        } else {
          console.log(chalk.gray('  No metrics files found'));
        }
      } else {
        console.log(chalk.gray(`📁 ${basePath} (not found)`));
      }
    }
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