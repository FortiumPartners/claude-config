/**
 * Logger Utility
 * Provides colored console output for the installer
 */

class Logger {
  constructor(options = {}) {
    this.colors = {
      reset: '\\033[0m',
      bright: '\\033[1m',
      red: '\\033[31m',
      green: '\\033[32m',
      yellow: '\\033[33m',
      blue: '\\033[34m',
      magenta: '\\033[35m',
      cyan: '\\033[36m',
      white: '\\033[37m'
    };

    this.symbols = {
      info: '📋',
      success: '✅',
      warning: '⚠️',
      error: '❌',
      progress: '⏳',
      debug: '🔍'
    };

    this.debugMode = options.debug || process.env.DEBUG === 'true';
  }

  info(message) {
    this.log('info', message, this.colors.blue);
  }

  success(message) {
    this.log('success', message, this.colors.green);
  }

  warning(message) {
    this.log('warning', message, this.colors.yellow);
  }

  error(message) {
    this.log('error', message, this.colors.red);
  }

  progress(message) {
    this.log('progress', message, this.colors.cyan);
  }

  debug(message) {
    if (this.debugMode) {
      this.log('debug', message, this.colors.magenta);
    }
  }

  log(level, message, color = '') {
    const timestamp = new Date().toISOString().substring(11, 19);
    const symbol = this.symbols[level] || '';
    const prefix = `${color}[${timestamp}]${this.colors.reset}`;

    console.log(`${prefix} ${symbol} ${message}`);
  }

  // Special method for progress bars and dynamic updates
  updateLine(message) {
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    process.stdout.write(message);
  }

  newLine() {
    console.log('');
  }

  separator(title = '', length = 50) {
    const line = '='.repeat(length);
    if (title) {
      const padding = Math.max(0, length - title.length - 2);
      const leftPad = Math.floor(padding / 2);
      const rightPad = padding - leftPad;
      console.log(`${this.colors.bright}${this.colors.blue}${'='.repeat(leftPad)} ${title} ${'='.repeat(rightPad)}${this.colors.reset}`);
    } else {
      console.log(`${this.colors.bright}${this.colors.blue}${line}${this.colors.reset}`);
    }
  }
}

module.exports = { Logger };