/**
 * @fileoverview CLIInterface class for parsing and validating command-line parameters
 * @module changelog/cli-interface
 */

/**
 * Command-line interface for /claude-changelog command
 */
class CLIInterface {
  constructor() {
    // Valid categories for filtering
    this.validCategories = [
      'breaking',
      'new',
      'enhancement',
      'performance',
      'security',
      'deprecation',
      'bugfix'
    ];

    // Valid output formats
    this.validFormats = ['console', 'json', 'markdown'];

    // Parameter definitions
    this.parameterDefs = {
      version: {
        flags: ['--version', '-v'],
        description: 'Specific version to fetch (e.g., 3.5.0, latest)',
        example: '--version 3.5.0'
      },
      since: {
        flags: ['--since', '-s'],
        description: 'Show changes since date or relative time (e.g., 7d, 2025-10-01)',
        example: '--since 7d'
      },
      category: {
        flags: ['--category', '-c'],
        description: 'Filter by category (comma-separated for multiple)',
        example: '--category breaking,new'
      },
      important: {
        flags: ['--important', '-i'],
        description: 'Show only high-impact changes',
        example: '--important'
      },
      format: {
        flags: ['--format', '-f'],
        description: 'Output format (console, json, markdown)',
        example: '--format json'
      },
      refresh: {
        flags: ['--refresh', '-r'],
        description: 'Force refresh, ignore cache',
        example: '--refresh'
      },
      help: {
        flags: ['--help', '-h'],
        description: 'Show help information',
        example: '--help'
      }
    };
  }

  /**
   * Parse command-line parameters
   * @param {string[]} args - Command-line arguments
   * @returns {Object} Parsed parameters
   */
  parseParameters(args) {
    const params = {
      version: null,
      since: null,
      category: null,
      important: false,
      format: 'console',
      refresh: false,
      help: false
    };

    // Handle null/undefined parameters
    if (!args || !Array.isArray(args)) {
      return params;
    }

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      // Skip null/undefined
      if (arg == null) continue;

      // Convert to lowercase for case-insensitive matching
      const argLower = String(arg).toLowerCase();

      // Handle equals sign format (--key=value)
      if (argLower.includes('=')) {
        const [key, value] = argLower.split('=', 2);
        this.parseParameter(params, key, value?.trim());
        continue;
      }

      // Handle flags with values
      if (argLower.startsWith('--') || argLower.startsWith('-')) {
        const nextArg = args[i + 1];
        const hasValue = nextArg && !String(nextArg).startsWith('-');

        if (hasValue) {
          this.parseParameter(params, argLower, String(nextArg).trim());
          i++; // Skip next arg as it's been consumed
        } else {
          this.parseParameter(params, argLower, null);
        }
      }
    }

    // Process category splitting
    if (params.category && typeof params.category === 'string') {
      if (params.category.includes(',')) {
        params.category = params.category
          .split(',')
          .map(c => c.trim())
          .filter(c => c.length > 0);
      }
    }

    return params;
  }

  /**
   * Parse individual parameter
   * @private
   */
  parseParameter(params, flag, value) {
    switch (flag) {
      case '--version':
      case '-v':
        params.version = value;
        break;

      case '--since':
      case '-s':
        params.since = value;
        break;

      case '--category':
      case '-c':
        params.category = value;
        break;

      case '--important':
      case '-i':
        params.important = true;
        break;

      case '--format':
      case '-f':
        params.format = value || 'console';
        break;

      case '--refresh':
      case '-r':
        params.refresh = true;
        break;

      case '--help':
      case '-h':
        params.help = true;
        break;
    }
  }

  /**
   * Validate parsed parameters
   * @param {Object} params - Parsed parameters
   * @returns {Object} Validation result with { valid: boolean, errors: string[] }
   */
  validateParameters(params) {
    const errors = [];

    // Validate version format (semver: X.Y.Z)
    if (params.version) {
      const versionPattern = /^\d+\.\d+(\.\d+)?$/;
      if (!versionPattern.test(params.version) && params.version !== 'latest') {
        errors.push('Invalid version format. Expected format: X.Y.Z');
      }
    }

    // Validate since parameter (date or relative time)
    if (params.since) {
      const datePattern = /^\d{4}-\d{2}-\d{2}$/; // YYYY-MM-DD
      const relativePattern = /^\d+[dwm]$/; // e.g., 7d, 2w, 1m
      if (!datePattern.test(params.since) && !relativePattern.test(params.since)) {
        errors.push('Invalid since format. Expected: YYYY-MM-DD or relative time (e.g., 7d, 2w, 1m)');
      }
    }

    // Validate category
    if (params.category) {
      const categories = Array.isArray(params.category) ? params.category : [params.category];
      for (const cat of categories) {
        if (!this.validCategories.includes(cat)) {
          errors.push(`Invalid category. Valid categories: ${this.validCategories.join(', ')}`);
          break;
        }
      }
    }

    // Validate format
    if (params.format && !this.validFormats.includes(params.format)) {
      errors.push(`Invalid output format. Valid formats: ${this.validFormats.join(', ')}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Format error message
   * @param {string|string[]} error - Error message or array of errors
   * @param {string} [suggestion] - Optional suggestion for fixing the error
   * @returns {string} Formatted error message
   */
  formatError(error, suggestion = null) {
    const lines = [];

    if (Array.isArray(error)) {
      lines.push(`ERROR: ${error.length} errors found:`);
      lines.push('');
      error.forEach((err, index) => {
        lines.push(`  ${index + 1}. ${err}`);
      });
    } else {
      lines.push(`ERROR: ${error}`);
    }

    if (suggestion) {
      lines.push('');
      lines.push(`SUGGESTION: ${suggestion}`);
    }

    lines.push('');
    lines.push('Use --help for more information.');

    return lines.join('\n');
  }

  /**
   * Get comprehensive help text
   * @returns {string} Help text
   */
  getHelpText() {
    const lines = [];

    lines.push('');
    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push('  /claude-changelog - Track Claude Updates');
    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push('');

    lines.push('USAGE:');
    lines.push('  /claude-changelog [OPTIONS]');
    lines.push('');

    lines.push('OPTIONS:');
    Object.entries(this.parameterDefs).forEach(([key, def]) => {
      const flags = def.flags.join(', ');
      lines.push(`  ${flags}`);
      lines.push(`    ${def.description}`);
      lines.push(`    Example: ${def.example}`);
      lines.push('');
    });

    lines.push('CATEGORIES:');
    lines.push(`  ${this.validCategories.join(', ')}`);
    lines.push('');

    lines.push('OUTPUT FORMATS:');
    lines.push(`  ${this.validFormats.join(', ')}`);
    lines.push('');

    lines.push('EXAMPLES:');
    lines.push('  # Get latest changelog');
    lines.push('  /claude-changelog');
    lines.push('');
    lines.push('  # Get specific version');
    lines.push('  /claude-changelog --version 3.5.0');
    lines.push('');
    lines.push('  # Get changes from last 7 days');
    lines.push('  /claude-changelog --since 7d');
    lines.push('');
    lines.push('  # Filter by breaking changes only');
    lines.push('  /claude-changelog --category breaking');
    lines.push('');
    lines.push('  # Get high-impact changes in JSON format');
    lines.push('  /claude-changelog --important --format json');
    lines.push('');
    lines.push('  # Force refresh cache');
    lines.push('  /claude-changelog --refresh');
    lines.push('');

    lines.push('═══════════════════════════════════════════════════════════════');

    return lines.join('\n');
  }
}

module.exports = { CLIInterface };
