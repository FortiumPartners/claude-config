/**
 * Colored Output System
 * Semantic colored console output using chalk for enhanced CLI experience
 *
 * Features:
 * - Semantic color coding (success=green, error=red, warning=yellow, info=blue)
 * - Styled messages (bold, dim, italic, underline)
 * - Formatted sections and boxes
 * - Consistent branding colors
 * - Terminal capability detection
 */

const chalk = require('chalk');

/**
 * Color themes for semantic output
 */
const themes = {
  // Status colors (as per TRD specification)
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.blue,
  progress: chalk.cyan,
  debug: chalk.magenta,

  // Emphasis colors
  highlight: chalk.yellowBright,
  muted: chalk.gray,
  accent: chalk.cyan,

  // Component colors
  header: chalk.bold.blue,
  subheader: chalk.cyan,
  label: chalk.white,
  value: chalk.yellow,

  // Branding
  brand: chalk.hex('#00D9FF'), // Fortium brand color
};

/**
 * Symbols for different message types
 */
const symbols = {
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
  progress: '⏳',
  debug: '🔍',
  bullet: '•',
  arrow: '→',
  check: '✓',
  cross: '✗',
  star: '★',
  circle: '○',
};

/**
 * ColoredOutput - Enhanced console output with semantic colors
 */
class ColoredOutput {
  constructor(options = {}) {
    this.enabled = options.color !== false && chalk.supportsColor;
    this.debugMode = options.debug || process.env.DEBUG === 'true';

    // Allow color to be disabled for testing
    if (!this.enabled) {
      chalk.level = 0;
    }
  }

  /**
   * Print success message
   * @param {string} message - Message to display
   * @param {Object} options - Additional options
   */
  success(message, options = {}) {
    const symbol = options.noSymbol ? '' : `${symbols.success} `;
    console.log(themes.success(`${symbol}${message}`));
  }

  /**
   * Print error message
   * @param {string} message - Message to display
   * @param {Object} options - Additional options
   */
  error(message, options = {}) {
    const symbol = options.noSymbol ? '' : `${symbols.error} `;
    console.error(themes.error(`${symbol}${message}`));
  }

  /**
   * Print warning message
   * @param {string} message - Message to display
   * @param {Object} options - Additional options
   */
  warning(message, options = {}) {
    const symbol = options.noSymbol ? '' : `${symbols.warning} `;
    console.log(themes.warning(`${symbol}${message}`));
  }

  /**
   * Print info message
   * @param {string} message - Message to display
   * @param {Object} options - Additional options
   */
  info(message, options = {}) {
    const symbol = options.noSymbol ? '' : `${symbols.info} `;
    console.log(themes.info(`${symbol}${message}`));
  }

  /**
   * Print progress message
   * @param {string} message - Message to display
   * @param {Object} options - Additional options
   */
  progress(message, options = {}) {
    const symbol = options.noSymbol ? '' : `${symbols.progress} `;
    console.log(themes.progress(`${symbol}${message}`));
  }

  /**
   * Print debug message (only if debug mode enabled)
   * @param {string} message - Message to display
   * @param {Object} options - Additional options
   */
  debug(message, options = {}) {
    if (!this.debugMode) return;

    const symbol = options.noSymbol ? '' : `${symbols.debug} `;
    console.log(themes.debug(`${symbol}${message}`));
  }

  /**
   * Print bold text
   * @param {string} text - Text to make bold
   */
  bold(text) {
    return chalk.bold(text);
  }

  /**
   * Print dim/muted text
   * @param {string} text - Text to dim
   */
  dim(text) {
    return chalk.dim(text);
  }

  /**
   * Print header with separator
   * @param {string} title - Header title
   * @param {Object} options - Options (width, char)
   */
  header(title, options = {}) {
    const width = options.width || 60;
    const char = options.char || '═';

    console.log('');
    console.log(themes.header(char.repeat(width)));
    console.log(themes.header(`  ${title}`));
    console.log(themes.header(char.repeat(width)));
    console.log('');
  }

  /**
   * Print subheader
   * @param {string} title - Subheader title
   */
  subheader(title) {
    console.log('');
    console.log(themes.subheader(`▸ ${title}`));
    console.log(themes.muted('─'.repeat(40)));
  }

  /**
   * Print separator line
   * @param {Object} options - Options (width, char, color)
   */
  separator(options = {}) {
    const width = options.width || 60;
    const char = options.char || '─';
    const color = options.color || 'muted';

    console.log(themes[color](char.repeat(width)));
  }

  /**
   * Print key-value pair
   * @param {string} key - Key/label
   * @param {string} value - Value
   * @param {Object} options - Options
   */
  keyValue(key, value, options = {}) {
    const indent = options.indent || 2;
    const spacing = ' '.repeat(indent);

    console.log(`${spacing}${themes.label(key + ':')} ${themes.value(value)}`);
  }

  /**
   * Print bullet list item
   * @param {string} text - List item text
   * @param {Object} options - Options (indent, symbol)
   */
  bullet(text, options = {}) {
    const indent = options.indent || 2;
    const symbol = options.symbol || symbols.bullet;
    const spacing = ' '.repeat(indent);

    console.log(`${spacing}${themes.accent(symbol)} ${text}`);
  }

  /**
   * Print numbered list item
   * @param {number} number - Item number
   * @param {string} text - List item text
   * @param {Object} options - Options (indent)
   */
  numbered(number, text, options = {}) {
    const indent = options.indent || 2;
    const spacing = ' '.repeat(indent);

    console.log(`${spacing}${themes.value(`${number}.`)} ${text}`);
  }

  /**
   * Print box with content
   * @param {string} content - Box content
   * @param {Object} options - Options (title, width, padding)
   */
  box(content, options = {}) {
    const width = options.width || 60;
    const padding = options.padding || 2;
    const title = options.title || '';

    const topBorder = title
      ? `╔═══ ${title} ${'═'.repeat(Math.max(0, width - title.length - 7))}╗`
      : `╔${'═'.repeat(width - 2)}╗`;
    const bottomBorder = `╚${'═'.repeat(width - 2)}╝`;

    console.log('');
    console.log(themes.accent(topBorder));

    const lines = content.split('\n');
    lines.forEach(line => {
      const paddedLine = ' '.repeat(padding) + line;
      const rightPadding = Math.max(0, width - paddedLine.length - 2);
      console.log(themes.accent('║') + paddedLine + ' '.repeat(rightPadding) + themes.accent('║'));
    });

    console.log(themes.accent(bottomBorder));
    console.log('');
  }

  /**
   * Print table with headers and rows
   * @param {Array} headers - Column headers
   * @param {Array} rows - Table rows (array of arrays)
   * @param {Object} options - Options
   */
  table(headers, rows, options = {}) {
    const columnWidths = headers.map((header, i) => {
      const maxRowWidth = Math.max(...rows.map(row => String(row[i] || '').length));
      return Math.max(header.length, maxRowWidth) + 2;
    });

    // Header
    const headerRow = headers
      .map((header, i) => themes.header(header.padEnd(columnWidths[i])))
      .join('│');

    console.log('');
    console.log(`│${headerRow}│`);
    console.log(`├${ columnWidths.map(w => '─'.repeat(w)).join('┼')}┤`);

    // Rows
    rows.forEach(row => {
      const rowText = row
        .map((cell, i) => String(cell || '').padEnd(columnWidths[i]))
        .join('│');
      console.log(`│${rowText}│`);
    });

    console.log('');
  }

  /**
   * Print step in a process
   * @param {number} current - Current step number
   * @param {number} total - Total steps
   * @param {string} message - Step message
   */
  step(current, total, message) {
    const stepLabel = themes.accent(`[${current}/${total}]`);
    console.log(`${stepLabel} ${message}`);
  }

  /**
   * Clear current line (for dynamic updates)
   */
  clearLine() {
    if (process.stdout.clearLine && process.stdout.cursorTo) {
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
    }
  }

  /**
   * Write to stdout without newline (for dynamic updates)
   * @param {string} text - Text to write
   */
  write(text) {
    process.stdout.write(text);
  }

  /**
   * Print newline
   */
  newLine() {
    console.log('');
  }
}

/**
 * Singleton instance for convenience
 */
const coloredOutput = new ColoredOutput();

module.exports = {
  ColoredOutput,
  coloredOutput,
  themes,
  symbols,
  chalk, // Export chalk for custom usage
};
