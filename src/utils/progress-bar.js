/**
 * Progress Bar Component
 * Provides visual progress feedback using cli-progress library
 *
 * Features:
 * - Real-time migration status tracking
 * - Customizable progress bar formats
 * - File count tracking
 * - Error handling integration
 * - Completion statistics
 */

const cliProgress = require('cli-progress');
const chalk = require('chalk');

class ProgressBar {
  constructor(options = {}) {
    this.bar = null;
    this.total = 0;
    this.current = 0;
    this.errors = 0;
    this.warnings = 0;

    // Default format with semantic colors
    this.format = options.format || this._getDefaultFormat();

    // Progress bar options
    this.options = {
      format: this.format,
      barCompleteChar: '█',
      barIncompleteChar: '░',
      hideCursor: true,
      clearOnComplete: false,
      stopOnComplete: true,
      ...options
    };
  }

  /**
   * Get default progress bar format with colored sections
   * @private
   */
  _getDefaultFormat() {
    return `${chalk.cyan('{bar}')} | ${chalk.yellow('{percentage}%')} | ${chalk.green('{value}/{total}')} files | ${chalk.white('{status}')}`;
  }

  /**
   * Initialize and start the progress bar
   * @param {number} total - Total number of items to process
   * @param {string} initialStatus - Initial status message
   */
  start(total, initialStatus = 'Starting...') {
    this.total = total;
    this.current = 0;
    this.errors = 0;
    this.warnings = 0;

    this.bar = new cliProgress.SingleBar(this.options, cliProgress.Presets.shades_classic);
    this.bar.start(total, 0, { status: initialStatus });
  }

  /**
   * Update progress bar with current status
   * @param {string} status - Current operation status
   * @param {Object} metadata - Additional metadata (errors, warnings, etc.)
   */
  update(status, metadata = {}) {
    if (!this.bar) {
      console.warn(chalk.yellow('⚠️  Progress bar not initialized. Call start() first.'));
      return;
    }

    this.current++;

    if (metadata.error) {
      this.errors++;
    }

    if (metadata.warning) {
      this.warnings++;
    }

    const payload = {
      status,
      errors: this.errors,
      warnings: this.warnings,
      ...metadata
    };

    this.bar.update(this.current, payload);
  }

  /**
   * Increment progress by one step
   * @param {string} status - Status message for this step
   */
  increment(status) {
    if (!this.bar) {
      console.warn(chalk.yellow('⚠️  Progress bar not initialized. Call start() first.'));
      return;
    }

    this.current++;
    this.bar.increment(1, { status });
  }

  /**
   * Stop the progress bar and display completion
   * @param {string} finalStatus - Final status message
   */
  stop(finalStatus = 'Complete') {
    if (!this.bar) {
      return;
    }

    this.bar.update(this.total, { status: finalStatus });
    this.bar.stop();
  }

  /**
   * Get current statistics
   * @returns {Object} - Current progress statistics
   */
  getStats() {
    return {
      total: this.total,
      current: this.current,
      remaining: Math.max(0, this.total - this.current),
      errors: this.errors,
      warnings: this.warnings,
      percentage: this.total > 0 ? Math.round((this.current / this.total) * 100) : 0
    };
  }

  /**
   * Display summary report after completion
   * @param {Object} summary - Summary data
   */
  displaySummary(summary = {}) {
    const stats = this.getStats();

    console.log('');
    console.log(chalk.bold.cyan('═'.repeat(60)));
    console.log(chalk.bold.white('  Migration Summary'));
    console.log(chalk.bold.cyan('═'.repeat(60)));
    console.log('');

    console.log(`  ${chalk.green('✓')} ${chalk.white('Total files processed:')} ${chalk.yellow(stats.total)}`);
    console.log(`  ${chalk.green('✓')} ${chalk.white('Successfully migrated:')} ${chalk.green(summary.success || (stats.current - stats.errors))}`);

    if (stats.errors > 0) {
      console.log(`  ${chalk.red('✗')} ${chalk.white('Failed migrations:')} ${chalk.red(stats.errors)}`);
    }

    if (stats.warnings > 0) {
      console.log(`  ${chalk.yellow('⚠')} ${chalk.white('Warnings:')} ${chalk.yellow(stats.warnings)}`);
    }

    if (summary.yamlUpdated) {
      console.log(`  ${chalk.green('✓')} ${chalk.white('YAML sources updated:')} ${chalk.yellow(summary.yamlUpdated)} files`);
    }

    if (summary.backupPath) {
      console.log(`  ${chalk.blue('ℹ')} ${chalk.white('Backup location:')} ${chalk.cyan(summary.backupPath)}`);
    }

    console.log('');
    console.log(chalk.bold.cyan('═'.repeat(60)));

    if (stats.errors === 0) {
      console.log(chalk.bold.green('  ✅ Migration completed successfully!'));
    } else {
      console.log(chalk.bold.yellow('  ⚠️  Migration completed with errors. Review logs for details.'));
    }

    console.log(chalk.bold.cyan('═'.repeat(60)));
    console.log('');
  }
}

/**
 * Multi-bar progress tracker for parallel operations
 */
class MultiProgressBar {
  constructor() {
    this.container = new cliProgress.MultiBar({
      clearOnComplete: false,
      hideCursor: true,
      format: '{task} | {bar} | {percentage}% | {value}/{total}'
    }, cliProgress.Presets.shades_grey);

    this.bars = new Map();
  }

  /**
   * Add a new progress bar for a specific task
   * @param {string} taskName - Name of the task
   * @param {number} total - Total items for this task
   */
  addTask(taskName, total) {
    const bar = this.container.create(total, 0, { task: chalk.cyan(taskName) });
    this.bars.set(taskName, { bar, total, current: 0 });
    return bar;
  }

  /**
   * Update a specific task's progress
   * @param {string} taskName - Name of the task to update
   * @param {number} value - Current progress value
   */
  updateTask(taskName, value) {
    const task = this.bars.get(taskName);
    if (task) {
      task.current = value;
      task.bar.update(value);
    }
  }

  /**
   * Increment a specific task's progress
   * @param {string} taskName - Name of the task to increment
   */
  incrementTask(taskName) {
    const task = this.bars.get(taskName);
    if (task) {
      task.current++;
      task.bar.increment();
    }
  }

  /**
   * Stop all progress bars
   */
  stop() {
    this.container.stop();
  }
}

module.exports = { ProgressBar, MultiProgressBar };
