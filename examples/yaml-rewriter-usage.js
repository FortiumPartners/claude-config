/**
 * YAML Rewriter Usage Examples
 * Demonstrates how to use the YamlRewriter class
 */

const { YamlRewriter } = require('../src/installer/yaml-rewriter');
const { Logger } = require('../src/utils/logger');

// Example 1: Basic Usage
async function basicUsage() {
  console.log('\n=== Example 1: Basic Usage ===\n');

  const logger = new Logger({ debug: true });
  const rewriter = new YamlRewriter('/Users/ldangelo/Development/fortium/claude-config', logger);

  try {
    const result = await rewriter.rewriteAllYamls();

    console.log('\n📊 Migration Summary:');
    console.log(`Total Files: ${result.summary.totalProcessed}`);
    console.log(`Succeeded: ${result.summary.succeeded}`);
    console.log(`Failed: ${result.summary.failed}`);
    console.log(`Success Rate: ${result.summary.successRate}%`);
    console.log(`Duration: ${result.summary.duration}ms`);
    console.log(`Average per file: ${result.summary.averageDuration}ms`);

    // Show successful migrations
    console.log('\n✅ Successful Migrations:');
    result.succeeded.forEach(file => {
      console.log(`  ${file.file}: ${file.originalPath} → ${file.rewrittenPath}`);
    });

    // Show failures (if any)
    if (result.failed.length > 0) {
      console.log('\n❌ Failed Migrations:');
      result.failed.forEach(file => {
        console.log(`  ${file.file}: ${file.error}`);
      });
    }

    return result;
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

// Example 2: Single File Rewriting
async function singleFileUsage() {
  console.log('\n=== Example 2: Single File Rewriting ===\n');

  const logger = new Logger({ debug: false });
  const rewriter = new YamlRewriter('/Users/ldangelo/Development/fortium/claude-config', logger);

  const yamlPath = '/Users/ldangelo/Development/fortium/claude-config/commands/yaml/create-prd.yaml';

  try {
    const result = await rewriter.rewriteYamlFile(yamlPath);

    if (result.success) {
      console.log('✅ File rewritten successfully:');
      console.log(`  Original: ${result.originalPath}`);
      console.log(`  Rewritten: ${result.rewrittenPath}`);
      console.log(`  Duration: ${result.duration}ms`);
    } else {
      console.log('❌ File rewriting failed:');
      console.log(`  Error: ${result.error}`);
    }

    return result;
  } catch (error) {
    console.error('Single file rewrite failed:', error);
    throw error;
  }
}

// Example 3: Validation Only (No Rewriting)
async function validationOnlyUsage() {
  console.log('\n=== Example 3: Validation Only ===\n');

  const logger = new Logger({ debug: false });
  const rewriter = new YamlRewriter('/Users/ldangelo/Development/fortium/claude-config', logger);

  const yamlPath = '/Users/ldangelo/Development/fortium/claude-config/commands/yaml/create-prd.yaml';

  try {
    // Parse YAML
    const yamlData = await rewriter.parseYaml(yamlPath);

    // Validate
    const validation = rewriter.validateYaml(yamlData);

    console.log('📋 Validation Results:');
    console.log(`  Valid: ${validation.valid ? '✅' : '❌'}`);

    if (validation.errors.length > 0) {
      console.log('  Errors:');
      validation.errors.forEach(err => console.log(`    - ${err}`));
    }

    if (validation.warnings.length > 0) {
      console.log('  Warnings:');
      validation.warnings.forEach(warn => console.log(`    - ${warn}`));
    }

    return validation;
  } catch (error) {
    console.error('Validation failed:', error);
    throw error;
  }
}

// Example 4: Integration with CommandMigrator (Conceptual)
async function commandMigratorIntegration() {
  console.log('\n=== Example 4: CommandMigrator Integration ===\n');

  // This is a conceptual example showing how YamlRewriter
  // would be integrated into CommandMigrator

  class CommandMigrator {
    constructor(installPath, logger, options = {}) {
      this.installPath = installPath;
      this.logger = logger;
      this.options = options;

      // Initialize sub-components
      // this.backupManager = new BackupManager(installPath, logger);
      this.yamlRewriter = new YamlRewriter(installPath, logger);

      this.successes = [];
      this.failures = [];
    }

    async migrate() {
      this.logger.info('Starting command directory reorganization...');

      try {
        // Step 1: Create backup
        // this.logger.info('Creating backup...');
        // await this.backupManager.createBackup();

        // Step 2: Migrate command files (existing functionality)
        this.logger.info('Migrating command files...');
        // await this.migrateCommandFiles();

        // Step 3: Rewrite YAML sources (NEW)
        this.logger.info('Rewriting YAML command definitions...');
        const yamlResult = await this.yamlRewriter.rewriteAllYamls();

        // Step 4: Validate migration
        this.logger.info('Validating migration...');
        // await this.validateMigration();

        // Generate final report
        const report = {
          // files: { succeeded: this.successes, failed: this.failures },
          yaml: yamlResult,
          summary: {
            // totalFiles: this.successes.length + this.failures.length,
            totalYamls: yamlResult.summary.totalProcessed,
            overallSuccess: yamlResult.summary.successRate === '100.0'
          }
        };

        this.logger.success('Migration complete!');
        return report;

      } catch (error) {
        this.logger.error(`Migration failed: ${error.message}`);
        throw error;
      }
    }
  }

  // Demonstrate usage
  const logger = new Logger();
  const migrator = new CommandMigrator('/Users/ldangelo/Development/fortium/claude-config', logger);

  const result = await migrator.migrate();

  console.log('\n📊 Migration Results:');
  console.log(`Total YAMLs Processed: ${result.yaml.summary.totalProcessed}`);
  console.log(`Success Rate: ${result.yaml.summary.successRate}%`);
  console.log(`Overall Success: ${result.summary.overallSuccess ? '✅' : '❌'}`);

  return result;
}

// Example 5: Error Handling
async function errorHandlingExample() {
  console.log('\n=== Example 5: Error Handling ===\n');

  const logger = new Logger({ debug: false });
  const rewriter = new YamlRewriter('/Users/ldangelo/Development/fortium/claude-config', logger);

  // Example: Handle malformed YAML
  const badYamlPath = '/path/to/malformed.yaml';

  try {
    await rewriter.parseYaml(badYamlPath);
  } catch (error) {
    console.log('❌ Parsing failed (expected):');
    console.log(`  Error: ${error.message}`);

    // Use error handling method
    const result = await rewriter.handleMalformedYaml(badYamlPath, error);

    console.log('\n📋 Error Handling Result:');
    console.log(`  Skip: ${result.skip}`);
    console.log(`  Category: ${result.category}`);
    console.log(`  Error: ${result.error}`);
  }
}

// Example 6: Performance Measurement
async function performanceMeasurement() {
  console.log('\n=== Example 6: Performance Measurement ===\n');

  const logger = new Logger({ debug: false });
  const rewriter = new YamlRewriter('/Users/ldangelo/Development/fortium/claude-config', logger);

  console.log('Measuring performance for all YAML files...\n');

  const startTime = Date.now();
  const result = await rewriter.rewriteAllYamls();
  const totalDuration = Date.now() - startTime;

  console.log('⚡ Performance Metrics:');
  console.log(`  Total Files: ${result.summary.totalProcessed}`);
  console.log(`  Total Duration: ${totalDuration}ms`);
  console.log(`  Average per File: ${result.summary.averageDuration}ms`);
  console.log(`  Target: <10ms per file`);
  console.log(`  Status: ${parseFloat(result.summary.averageDuration) < 10 ? '✅ PASS' : '❌ FAIL'}`);

  // Individual file performance
  console.log('\n📊 Individual File Performance:');
  result.succeeded.forEach(file => {
    const status = file.duration < 10 ? '✅' : '⚠️';
    console.log(`  ${status} ${file.file}: ${file.duration}ms`);
  });

  return result;
}

// Main execution
async function main() {
  console.log('═══════════════════════════════════════');
  console.log('  YAML Rewriter Usage Examples');
  console.log('═══════════════════════════════════════');

  try {
    // Uncomment the examples you want to run:

    // await basicUsage();
    // await singleFileUsage();
    // await validationOnlyUsage();
    await commandMigratorIntegration();
    // await errorHandlingExample();
    // await performanceMeasurement();

    console.log('\n✅ Examples completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Examples failed:', error.message);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = {
  basicUsage,
  singleFileUsage,
  validationOnlyUsage,
  commandMigratorIntegration,
  errorHandlingExample,
  performanceMeasurement
};
