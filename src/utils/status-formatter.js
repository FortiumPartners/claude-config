/**
 * Status Message Formatting Utilities
 * Provides consistent status message formatting for migration operations
 *
 * Features:
 * - Pre-formatted status templates for common operations
 * - File operation status messages
 * - Migration progress indicators
 * - Error and warning formatting
 * - Summary statistics formatting
 */

const { themes, symbols } = require('./colored-output');

/**
 * StatusFormatter - Consistent status message formatting
 */
class StatusFormatter {
  constructor() {
    this.templates = {
      scanning: 'Scanning existing commands...',
      creating: 'Creating ai-mesh directory...',
      migrating: 'Migrating command files...',
      rewriting: 'Updating YAML source files...',
      validating: 'Validating migration...',
      backingUp: 'Creating backup...',
      completing: 'Finalizing migration...',
      done: 'Migration complete!'
    };
  }

  /**
   * Format file operation status message
   * @param {string} operation - Operation type (move, copy, delete, update)
   * @param {string} filename - File being operated on
   * @param {Object} options - Additional options
   * @returns {string} Formatted status message
   */
  fileOperation(operation, filename, options = {}) {
    const operationVerbs = {
      move: 'Moving',
      copy: 'Copying',
      delete: 'Deleting',
      update: 'Updating',
      create: 'Creating',
      scan: 'Scanning',
      validate: 'Validating'
    };

    const verb = operationVerbs[operation] || operation;
    const status = `${verb} ${filename}`;

    if (options.destination) {
      return `${status} → ${options.destination}`;
    }

    return status;
  }

  /**
   * Format migration progress status
   * @param {number} current - Current file index
   * @param {number} total - Total files
   * @param {string} filename - Current filename
   * @returns {string} Formatted progress message
   */
  migrationProgress(current, total, filename) {
    return `[${current}/${total}] Processing: ${filename}`;
  }

  /**
   * Format error message
   * @param {string} message - Error message
   * @param {Object} options - Additional context
   * @returns {string} Formatted error message
   */
  error(message, options = {}) {
    let formatted = `${symbols.error} Error: ${message}`;

    if (options.file) {
      formatted += `\n  File: ${options.file}`;
    }

    if (options.reason) {
      formatted += `\n  Reason: ${options.reason}`;
    }

    if (options.suggestion) {
      formatted += `\n  Suggestion: ${options.suggestion}`;
    }

    return formatted;
  }

  /**
   * Format warning message
   * @param {string} message - Warning message
   * @param {Object} options - Additional context
   * @returns {string} Formatted warning message
   */
  warning(message, options = {}) {
    let formatted = `${symbols.warning} Warning: ${message}`;

    if (options.file) {
      formatted += `\n  File: ${options.file}`;
    }

    if (options.impact) {
      formatted += `\n  Impact: ${options.impact}`;
    }

    return formatted;
  }

  /**
   * Format success message
   * @param {string} message - Success message
   * @param {Object} options - Additional context
   * @returns {string} Formatted success message
   */
  success(message, options = {}) {
    return `${symbols.success} ${message}`;
  }

  /**
   * Format info message
   * @param {string} message - Info message
   * @returns {string} Formatted info message
   */
  info(message) {
    return `${symbols.info} ${message}`;
  }

  /**
   * Format migration summary statistics
   * @param {Object} stats - Migration statistics
   * @returns {Array<string>} Array of formatted summary lines
   */
  migrationSummary(stats) {
    const {
      totalFiles = 0,
      successfulMigrations = 0,
      failedMigrations = 0,
      warnings = 0,
      yamlFilesUpdated = 0,
      backupPath = null,
      duration = null
    } = stats;

    const lines = [];

    // Success/failure counts
    lines.push(`Total files processed: ${themes.value(totalFiles)}`);
    lines.push(`Successfully migrated: ${themes.success(successfulMigrations)}`);

    if (failedMigrations > 0) {
      lines.push(`Failed migrations: ${themes.error(failedMigrations)}`);
    }

    if (warnings > 0) {
      lines.push(`Warnings: ${themes.warning(warnings)}`);
    }

    // YAML updates
    if (yamlFilesUpdated > 0) {
      lines.push(`YAML sources updated: ${themes.value(yamlFilesUpdated)} files`);
    }

    // Backup location
    if (backupPath) {
      lines.push(`Backup location: ${themes.accent(backupPath)}`);
    }

    // Duration
    if (duration) {
      const durationStr = this.formatDuration(duration);
      lines.push(`Duration: ${themes.muted(durationStr)}`);
    }

    return lines;
  }

  /**
   * Format validation result
   * @param {Object} result - Validation result
   * @returns {string} Formatted validation message
   */
  validationResult(result) {
    const { passed, failed, warnings, details } = result;

    let message = '';

    if (passed > 0) {
      message += `${themes.success('✓')} ${passed} checks passed`;
    }

    if (failed > 0) {
      message += message ? ', ' : '';
      message += `${themes.error('✗')} ${failed} checks failed`;
    }

    if (warnings > 0) {
      message += message ? ', ' : '';
      message += `${themes.warning('⚠')} ${warnings} warnings`;
    }

    if (details && details.length > 0) {
      message += '\n  Details:\n';
      details.forEach(detail => {
        message += `    • ${detail}\n`;
      });
    }

    return message.trim();
  }

  /**
   * Format duration in human-readable format
   * @param {number} milliseconds - Duration in milliseconds
   * @returns {string} Formatted duration
   */
  formatDuration(milliseconds) {
    if (milliseconds < 1000) {
      return `${milliseconds}ms`;
    }

    const seconds = Math.floor(milliseconds / 1000);
    if (seconds < 60) {
      return `${seconds}s`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }

  /**
   * Format file size in human-readable format
   * @param {number} bytes - Size in bytes
   * @returns {string} Formatted file size
   */
  formatFileSize(bytes) {
    if (bytes < 1024) {
      return `${bytes} B`;
    }

    const kb = bytes / 1024;
    if (kb < 1024) {
      return `${kb.toFixed(2)} KB`;
    }

    const mb = kb / 1024;
    return `${mb.toFixed(2)} MB`;
  }

  /**
   * Format backup info message
   * @param {string} backupPath - Path to backup
   * @param {number} fileCount - Number of files backed up
   * @returns {string} Formatted backup message
   */
  backupInfo(backupPath, fileCount) {
    return `Backup created: ${fileCount} files saved to ${themes.accent(backupPath)}`;
  }

  /**
   * Format rollback info message
   * @param {string} backupPath - Path to backup being restored
   * @returns {string} Formatted rollback message
   */
  rollbackInfo(backupPath) {
    return `Rolling back from backup: ${themes.accent(backupPath)}`;
  }

  /**
   * Format dry-run mode indicator
   * @param {string} operation - Operation being simulated
   * @returns {string} Formatted dry-run message
   */
  dryRun(operation) {
    return `${themes.warning('[DRY RUN]')} ${operation}`;
  }

  /**
   * Format command resolution test result
   * @param {boolean} passed - Whether test passed
   * @param {string} commandName - Command being tested
   * @returns {string} Formatted test result
   */
  commandResolutionTest(passed, commandName) {
    if (passed) {
      return `${symbols.check} Command /${commandName} resolved successfully`;
    }
    return `${symbols.cross} Command /${commandName} failed to resolve`;
  }

  /**
   * Get template message
   * @param {string} key - Template key
   * @returns {string} Template message
   */
  getTemplate(key) {
    return this.templates[key] || key;
  }

  /**
   * Create a formatted operation log entry
   * @param {string} level - Log level (info, success, warning, error)
   * @param {string} operation - Operation name
   * @param {Object} details - Operation details
   * @returns {Object} Structured log entry
   */
  logEntry(level, operation, details = {}) {
    return {
      timestamp: new Date().toISOString(),
      level,
      operation,
      details,
      formatted: this[level] ? this[level](operation, details) : operation
    };
  }
}

/**
 * Singleton instance for convenience
 */
const statusFormatter = new StatusFormatter();

module.exports = {
  StatusFormatter,
  statusFormatter
};
