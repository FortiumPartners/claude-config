/**
 * ValidationSystem - Comprehensive validation for command migration
 *
 * Sprint 2 Group 5 (TRD-036 through TRD-039)
 * Validates file existence, YAML syntax, command resolution, and generates reports
 *
 * @module installer/validation-system
 */

const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');

/**
 * Expected AI Mesh commands (12 commands, 24 files total with .md/.txt)
 */
const EXPECTED_COMMANDS = [
  'create-prd',
  'create-trd',
  'implement-trd',
  'fold-prompt',
  'manager-dashboard',
  'analyze-product',
  'refine-prd',
  'refine-trd',
  'sprint-status',
  'playwright-test',
  'generate-api-docs',
  'web-metrics-dashboard'
];

const EXPECTED_FORMATS = ['.md', '.txt'];

/**
 * ValidationSystem class for comprehensive post-migration validation
 */
class ValidationSystem {
  /**
   * @param {string} installPath - Installation path (e.g., ~/.claude)
   * @param {Object} logger - Logger instance for output
   */
  constructor(installPath, logger) {
    this.installPath = installPath;
    this.logger = logger;
    this.commandsDir = path.join(installPath, 'commands');
    this.aiMeshDir = path.join(this.commandsDir, 'ai-mesh');
    this.yamlDir = path.join(installPath, 'commands', 'yaml');

    this.results = {
      fileValidation: null,
      yamlValidation: null,
      resolutionTests: null,
      summary: null,
      passed: false
    };
  }

  /**
   * TRD-036: Validate all expected command files exist
   * Checks for 24 files (12 commands × 2 formats) in ai-mesh/ subdirectory
   *
   * @returns {Promise<Object>} Validation result with file counts and missing files
   */
  async validateFileExistence() {
    const startTime = Date.now();
    const result = {
      expectedCount: EXPECTED_COMMANDS.length * EXPECTED_FORMATS.length,
      foundCount: 0,
      missingFiles: [],
      unexpectedLocation: [],
      passed: false
    };

    try {
      // Check if ai-mesh directory exists
      try {
        await fs.access(this.aiMeshDir);
      } catch {
        result.error = `AI Mesh directory not found: ${this.aiMeshDir}`;
        result.duration = Date.now() - startTime;
        return result;
      }

      // Check each expected command file
      for (const command of EXPECTED_COMMANDS) {
        for (const format of EXPECTED_FORMATS) {
          const filename = `${command}${format}`;
          const expectedPath = path.join(this.aiMeshDir, filename);
          const rootPath = path.join(this.commandsDir, filename);

          // Check if file exists in ai-mesh/ directory
          try {
            await fs.access(expectedPath);
            result.foundCount++;
          } catch {
            result.missingFiles.push(filename);

            // Check if file exists in root (migration incomplete)
            try {
              await fs.access(rootPath);
              result.unexpectedLocation.push(filename);
            } catch {
              // File truly missing
            }
          }
        }
      }

      result.passed = result.foundCount === result.expectedCount;
      result.duration = Date.now() - startTime;

      return result;
    } catch (error) {
      result.error = error.message;
      result.duration = Date.now() - startTime;
      return result;
    }
  }

  /**
   * TRD-037: Validate YAML syntax and structure
   * Checks all YAML files can be parsed and have required fields
   *
   * @returns {Promise<Object>} Validation result with YAML errors
   */
  async validateYamlSyntax() {
    const startTime = Date.now();
    const result = {
      totalFiles: 0,
      validFiles: 0,
      invalidFiles: [],
      warnings: [],
      passed: false
    };

    try {
      // Check if yaml directory exists
      try {
        await fs.access(this.yamlDir);
      } catch {
        result.error = `YAML directory not found: ${this.yamlDir}`;
        result.duration = Date.now() - startTime;
        return result;
      }

      // Read all YAML files
      const files = await fs.readdir(this.yamlDir);
      const yamlFiles = files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));

      result.totalFiles = yamlFiles.length;

      // Validate each YAML file
      for (const filename of yamlFiles) {
        const filePath = path.join(this.yamlDir, filename);

        try {
          const content = await fs.readFile(filePath, 'utf8');
          const data = yaml.load(content);

          // Check required fields
          const issues = this.checkYamlFields(data, filename);

          if (issues.length > 0) {
            result.invalidFiles.push({ filename, issues });
          } else {
            result.validFiles++;

            // Check for ai-mesh/ prefix in output_path
            if (data.metadata && data.metadata.output_path) {
              if (!data.metadata.output_path.startsWith('ai-mesh/')) {
                result.warnings.push({
                  filename,
                  message: 'output_path should start with "ai-mesh/"'
                });
              }
            }
          }
        } catch (error) {
          result.invalidFiles.push({
            filename,
            issues: [`YAML parse error: ${error.message}`]
          });
        }
      }

      result.passed = result.invalidFiles.length === 0;
      result.duration = Date.now() - startTime;

      return result;
    } catch (error) {
      result.error = error.message;
      result.duration = Date.now() - startTime;
      return result;
    }
  }

  /**
   * Check YAML fields for required properties
   * @private
   */
  checkYamlFields(data, filename) {
    const issues = [];

    if (!data.metadata) {
      issues.push('Missing "metadata" field');
      return issues;
    }

    if (!data.metadata.name) {
      issues.push('Missing "metadata.name" field');
    }

    if (!data.metadata.description) {
      issues.push('Missing "metadata.description" field');
    }

    if (!data.metadata.output_path) {
      issues.push('Missing "metadata.output_path" field');
    }

    return issues;
  }

  /**
   * TRD-038: Test command resolution performance
   * Verifies commands can be discovered and loaded quickly (<100ms)
   *
   * @returns {Promise<Object>} Resolution test results with timing
   */
  async testCommandResolution() {
    const startTime = Date.now();
    const result = {
      totalCommands: EXPECTED_COMMANDS.length,
      resolvedCommands: 0,
      unresolvedCommands: [],
      resolutionTimes: [],
      averageTime: 0,
      maxTime: 0,
      passed: false
    };

    try {
      for (const command of EXPECTED_COMMANDS) {
        const resolveStart = Date.now();

        // Try to resolve command in ai-mesh directory
        const mdPath = path.join(this.aiMeshDir, `${command}.md`);
        const txtPath = path.join(this.aiMeshDir, `${command}.txt`);

        let resolved = false;
        try {
          await fs.access(mdPath);
          resolved = true;
        } catch {
          try {
            await fs.access(txtPath);
            resolved = true;
          } catch {
            // Command not resolved
          }
        }

        const resolveTime = Date.now() - resolveStart;
        result.resolutionTimes.push(resolveTime);
        result.maxTime = Math.max(result.maxTime, resolveTime);

        if (resolved) {
          result.resolvedCommands++;
        } else {
          result.unresolvedCommands.push(command);
        }
      }

      // Calculate average resolution time
      if (result.resolutionTimes.length > 0) {
        result.averageTime = result.resolutionTimes.reduce((a, b) => a + b, 0) / result.resolutionTimes.length;
      }

      const totalTime = Date.now() - startTime;
      result.duration = totalTime;

      // Pass if all commands resolved and within performance target (<100ms total)
      result.passed = result.resolvedCommands === result.totalCommands && totalTime < 100;

      if (totalTime >= 100) {
        result.warning = `Resolution time (${totalTime}ms) exceeds target (<100ms)`;
      }

      return result;
    } catch (error) {
      result.error = error.message;
      result.duration = Date.now() - startTime;
      return result;
    }
  }

  /**
   * TRD-039: Generate comprehensive validation report
   * Creates human-readable summary with actionable recommendations
   *
   * @returns {Object} Formatted validation report
   */
  generateValidationReport() {
    const report = {
      timestamp: new Date().toISOString(),
      installPath: this.installPath,
      sections: [],
      overallPassed: false,
      recommendations: []
    };

    // File Validation Section
    if (this.results.fileValidation) {
      const fv = this.results.fileValidation;
      report.sections.push({
        name: 'File Validation',
        passed: fv.passed,
        summary: `${fv.foundCount}/${fv.expectedCount} files present`,
        duration: `${fv.duration}ms`,
        details: {
          found: fv.foundCount,
          expected: fv.expectedCount,
          missing: fv.missingFiles,
          unexpectedLocation: fv.unexpectedLocation
        }
      });

      if (!fv.passed) {
        if (fv.unexpectedLocation.length > 0) {
          report.recommendations.push(
            `Run migration again: ${fv.unexpectedLocation.length} files not migrated to ai-mesh/`
          );
        }
        if (fv.missingFiles.length > fv.unexpectedLocation.length) {
          report.recommendations.push(
            `${fv.missingFiles.length - fv.unexpectedLocation.length} files are missing entirely - check installation`
          );
        }
      }
    }

    // YAML Validation Section
    if (this.results.yamlValidation) {
      const yv = this.results.yamlValidation;
      report.sections.push({
        name: 'YAML Validation',
        passed: yv.passed,
        summary: `${yv.validFiles}/${yv.totalFiles} YAML files valid`,
        duration: `${yv.duration}ms`,
        details: {
          valid: yv.validFiles,
          total: yv.totalFiles,
          invalid: yv.invalidFiles,
          warnings: yv.warnings
        }
      });

      if (!yv.passed) {
        report.recommendations.push(
          `Fix ${yv.invalidFiles.length} invalid YAML files before proceeding`
        );
      }
    }

    // Command Resolution Section
    if (this.results.resolutionTests) {
      const rt = this.results.resolutionTests;
      report.sections.push({
        name: 'Command Resolution',
        passed: rt.passed,
        summary: `${rt.resolvedCommands}/${rt.totalCommands} commands resolved (${rt.duration}ms total, ${rt.averageTime.toFixed(2)}ms avg)`,
        duration: `${rt.duration}ms`,
        details: {
          resolved: rt.resolvedCommands,
          total: rt.totalCommands,
          unresolved: rt.unresolvedCommands,
          averageTime: `${rt.averageTime.toFixed(2)}ms`,
          maxTime: `${rt.maxTime}ms`,
          performanceTarget: '<100ms'
        }
      });

      if (!rt.passed) {
        if (rt.unresolvedCommands.length > 0) {
          report.recommendations.push(
            `Check ${rt.unresolvedCommands.length} unresolved commands: ${rt.unresolvedCommands.join(', ')}`
          );
        }
        if (rt.duration >= 100) {
          report.recommendations.push(
            `Command resolution time (${rt.duration}ms) exceeds target (<100ms) - consider optimization`
          );
        }
      }
    }

    // Overall status
    report.overallPassed = report.sections.every(s => s.passed);

    if (report.overallPassed) {
      report.summary = '✅ All validation checks passed';
    } else {
      const failedCount = report.sections.filter(s => !s.passed).length;
      report.summary = `❌ ${failedCount}/${report.sections.length} validation checks failed`;
    }

    return report;
  }

  /**
   * Run complete validation workflow
   * Executes all validation checks and generates comprehensive report
   *
   * @returns {Promise<Object>} Complete validation results
   */
  async runFullValidation() {
    const overallStart = Date.now();

    this.logger.info('Running validation system...');

    // TRD-036: File existence validation
    this.logger.info('├─ Validating file existence...');
    this.results.fileValidation = await this.validateFileExistence();
    const fvStatus = this.results.fileValidation.passed ? '✅' : '❌';
    this.logger.info(`│  ${fvStatus} ${this.results.fileValidation.foundCount}/${this.results.fileValidation.expectedCount} files (${this.results.fileValidation.duration}ms)`);

    // TRD-037: YAML syntax validation
    this.logger.info('├─ Validating YAML syntax...');
    this.results.yamlValidation = await this.validateYamlSyntax();
    const yvStatus = this.results.yamlValidation.passed ? '✅' : '❌';
    this.logger.info(`│  ${yvStatus} ${this.results.yamlValidation.validFiles}/${this.results.yamlValidation.totalFiles} valid (${this.results.yamlValidation.duration}ms)`);

    // TRD-038: Command resolution tests
    this.logger.info('├─ Testing command resolution...');
    this.results.resolutionTests = await this.testCommandResolution();
    const rtStatus = this.results.resolutionTests.passed ? '✅' : '❌';
    this.logger.info(`│  ${rtStatus} ${this.results.resolutionTests.resolvedCommands}/${this.results.resolutionTests.totalCommands} resolved (${this.results.resolutionTests.duration}ms)`);

    // TRD-039: Generate report
    this.logger.info('└─ Generating validation report...');
    const report = this.generateValidationReport();

    const overallDuration = Date.now() - overallStart;
    this.logger.info(`\nValidation completed in ${overallDuration}ms`);

    this.results.summary = report;
    this.results.passed = report.overallPassed;
    this.results.duration = overallDuration;

    return this.results;
  }

  /**
   * Print human-readable validation report to console
   */
  printReport() {
    const report = this.results.summary;

    if (!report) {
      this.logger.error('No validation report available');
      return;
    }

    console.log('\n' + '='.repeat(60));
    console.log('VALIDATION REPORT');
    console.log('='.repeat(60));
    console.log(`Timestamp: ${report.timestamp}`);
    console.log(`Install Path: ${report.installPath}`);
    console.log(`\n${report.summary}\n`);

    // Print each section
    for (const section of report.sections) {
      const status = section.passed ? '✅' : '❌';
      console.log(`${status} ${section.name}: ${section.summary} (${section.duration})`);

      if (!section.passed && section.details) {
        if (section.details.missing && section.details.missing.length > 0) {
          console.log(`   Missing files: ${section.details.missing.join(', ')}`);
        }
        if (section.details.invalid && section.details.invalid.length > 0) {
          console.log(`   Invalid files: ${section.details.invalid.length}`);
          for (const inv of section.details.invalid) {
            console.log(`     - ${inv.filename}: ${inv.issues.join(', ')}`);
          }
        }
        if (section.details.unresolved && section.details.unresolved.length > 0) {
          console.log(`   Unresolved: ${section.details.unresolved.join(', ')}`);
        }
      }
    }

    // Print recommendations
    if (report.recommendations.length > 0) {
      console.log('\nRECOMMENDATIONS:');
      for (const rec of report.recommendations) {
        console.log(`  • ${rec}`);
      }
    }

    console.log('\n' + '='.repeat(60) + '\n');
  }
}

module.exports = ValidationSystem;
