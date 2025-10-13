/**
 * Tool Detector
 * Detects which AI coding tool is being used (Claude Code, OpenCode, etc.)
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

class ToolDetector {
  constructor(logger) {
    this.logger = logger;
  }

  /**
   * Detect which tool is installed
   * @returns {Promise<string>} Tool name ('claude' or 'opencode')
   */
  async detect() {
    this.logger.debug('Detecting AI coding tool...');

    // Check environment variable override
    if (process.env.CLAUDE_TOOL) {
      this.logger.info(`Using tool from environment: ${process.env.CLAUDE_TOOL}`);
      return process.env.CLAUDE_TOOL.toLowerCase();
    }

    // Check for Claude Code
    if (await this.isClaudeCode()) {
      this.logger.info('Detected: Claude Code');
      return 'claude';
    }

    // Check for OpenCode
    if (await this.isOpenCode()) {
      this.logger.info('Detected: OpenCode');
      return 'opencode';
    }

    // Default to Claude Code
    this.logger.warning('Could not detect tool, defaulting to Claude Code');
    return 'claude';
  }

  /**
   * Check if Claude Code is installed
   * @returns {Promise<boolean>}
   */
  async isClaudeCode() {
    const homeDir = os.homedir();
    const claudeConfigPaths = [
      path.join(homeDir, '.claude'),
      path.join(homeDir, '.config', 'claude'),
      path.join(homeDir, 'Library', 'Application Support', 'Claude'), // macOS
      path.join(homeDir, 'AppData', 'Roaming', 'Claude') // Windows
    ];

    // Check config directories
    for (const configPath of claudeConfigPaths) {
      if (await this.pathExists(configPath)) {
        this.logger.debug(`Found Claude Code config at: ${configPath}`);
        return true;
      }
    }

    // Check if claude is in PATH
    if (this.commandExists('claude')) {
      this.logger.debug('Found claude command in PATH');
      return true;
    }

    return false;
  }

  /**
   * Check if OpenCode is installed
   * @returns {Promise<boolean>}
   */
  async isOpenCode() {
    const homeDir = os.homedir();
    const opencodeConfigPaths = [
      path.join(homeDir, '.opencode'),
      path.join(homeDir, '.config', 'opencode')
    ];

    // Check config directories
    for (const configPath of opencodeConfigPaths) {
      if (await this.pathExists(configPath)) {
        this.logger.debug(`Found OpenCode config at: ${configPath}`);
        return true;
      }
    }

    // Check if opencode is in PATH
    if (this.commandExists('opencode')) {
      this.logger.debug('Found opencode command in PATH');
      return true;
    }

    return false;
  }

  /**
   * Check if a path exists
   * @param {string} filePath
   * @returns {Promise<boolean>}
   */
  async pathExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a command exists in PATH
   * @param {string} command
   * @returns {boolean}
   */
  commandExists(command) {
    try {
      const whichCommand = process.platform === 'win32' ? 'where' : 'which';
      execSync(`${whichCommand} ${command}`, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get detailed tool information
   * @returns {Promise<Object>} Tool information
   */
  async getToolInfo() {
    const toolName = await this.detect();
    const homeDir = os.homedir();
    
    let configPath = null;
    let version = null;

    if (toolName === 'claude') {
      // Try to find Claude config
      const possiblePaths = [
        path.join(homeDir, '.claude'),
        path.join(homeDir, '.config', 'claude'),
        path.join(homeDir, 'Library', 'Application Support', 'Claude')
      ];
      
      for (const p of possiblePaths) {
        if (await this.pathExists(p)) {
          configPath = p;
          break;
        }
      }
      
      // Try to get version
      if (this.commandExists('claude')) {
        try {
          version = execSync('claude --version', { encoding: 'utf8', stdio: 'pipe' }).trim();
        } catch {
          // Version command might not be supported
        }
      }
    } else if (toolName === 'opencode') {
      const possiblePaths = [
        path.join(homeDir, '.opencode'),
        path.join(homeDir, '.config', 'opencode')
      ];
      
      for (const p of possiblePaths) {
        if (await this.pathExists(p)) {
          configPath = p;
          break;
        }
      }
      
      if (this.commandExists('opencode')) {
        try {
          version = execSync('opencode --version', { encoding: 'utf8', stdio: 'pipe' }).trim();
        } catch {
          // Version command might not be supported
        }
      }
    }

    return {
      name: toolName,
      configPath,
      version,
      detected: true
    };
  }
}

module.exports = { ToolDetector };
