/**
 * Validator Utility
 * Handles environment and installation validation
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

class Validator {
  constructor() {
    this.requirements = {
      node: '18.0.0',
      python: '3.8.0'
    };
  }

  async validateEnvironment() {
    const results = {
      node: await this.validateNode(),
      python: await this.validatePython(),
      permissions: await this.validatePermissions()
    };

    const failures = Object.entries(results)
      .filter(([key, result]) => !result.valid)
      .map(([key, result]) => `${key}: ${result.message}`);

    if (failures.length > 0) {
      throw new Error(`Environment validation failed:\\n${failures.join('\\n')}`);
    }

    return results;
  }

  async validateNode() {
    try {
      const version = process.version.substring(1); // Remove 'v' prefix
      const valid = this.compareVersions(version, this.requirements.node) >= 0;

      return {
        valid,
        version,
        message: valid ?
          `Node.js ${version} ✓` :
          `Node.js ${version} < ${this.requirements.node} (upgrade required)`
      };
    } catch (error) {
      return {
        valid: false,
        version: 'unknown',
        message: 'Node.js not found'
      };
    }
  }

  async validatePython() {
    try {
      const output = execSync('python3 --version', { encoding: 'utf8' });
      const match = output.match(/Python (\\d+\\.\\d+\\.\\d+)/);

      if (match) {
        const version = match[1];
        const valid = this.compareVersions(version, this.requirements.python) >= 0;

        return {
          valid,
          version,
          message: valid ?
            `Python ${version} ✓` :
            `Python ${version} < ${this.requirements.python} (upgrade recommended)`
        };
      } else {
        throw new Error('Could not parse Python version');
      }
    } catch (error) {
      return {
        valid: true, // Python is optional for basic installation
        version: 'not found',
        message: 'Python 3.8+ not found (analytics features will be disabled)'
      };
    }
  }

  async validatePermissions() {
    try {
      // Test write permissions to user home directory
      const homeDir = require('os').homedir();
      const testFile = path.join(homeDir, '.claude-installer-test');

      await fs.writeFile(testFile, 'test');
      await fs.unlink(testFile);

      return {
        valid: true,
        message: 'Write permissions ✓'
      };
    } catch (error) {
      return {
        valid: false,
        message: `Insufficient permissions: ${error.message}`
      };
    }
  }

  async validateInstallation(installPath, tool = 'claude') {
    const toolPath = installPath[tool];
    const results = {
      tool: await this.validateClaudeInstallation(toolPath),
      aiMesh: tool === 'claude' ? await this.validateAiMeshInstallation(installPath.mesh) : { valid: true, errors: [] },
      settings: tool === 'claude' ? await this.validateSettings(toolPath) : { valid: true, errors: [] }
    };

    const errors = [];
    const summary = {
      agents: 0,
      commands: 0,
      hooks: 0
    };

    // Check tool installation
    if (!results.tool.valid) {
      errors.push(...results.tool.errors);
    } else {
      summary.agents = results.tool.agents;
      summary.commands = results.tool.commands;
      summary.hooks = results.tool.hooks;
    }

    // Check AI Mesh installation (only for claude)
    if (tool === 'claude' && !results.aiMesh.valid) {
      errors.push(...results.aiMesh.errors);
    }

    // Check settings (only for claude)
    if (tool === 'claude' && !results.settings.valid) {
      errors.push(...results.settings.errors);
    }

    return {
      success: errors.length === 0,
      errors,
      summary,
      details: results
    };
  }

  async validateClaudeInstallation(claudePath) {
    const results = {
      valid: true,
      errors: [],
      agents: 0,
      commands: 0,
      hooks: 0
    };

    try {
      // Check Claude directory
      const exists = await this.fileExists(claudePath);
      if (!exists) {
        results.valid = false;
        results.errors.push('Claude directory not found');
        return results;
      }

      // Check subdirectories (singular form for agent/command)
      const subdirs = ['agent', 'command'];
      for (const subdir of subdirs) {
        const subdirPath = path.join(claudePath, subdir);
        const subdirExists = await this.fileExists(subdirPath);

        if (subdirExists) {
          const files = await fs.readdir(subdirPath);
          const count = files.filter(f => f.endsWith('.md') || f.endsWith('.txt') || f.endsWith('.js')).length;
          const pluralKey = subdir + 's';
          results[pluralKey] = count;
        } else {
          results.valid = false;
          results.errors.push(`${subdir} directory not found`);
        }
      }
      
      // Check hooks directory (optional for opencode)
      const hooksPath = path.join(claudePath, 'hooks');
      if (await this.fileExists(hooksPath)) {
        const files = await fs.readdir(hooksPath);
        results.hooks = files.filter(f => f.endsWith('.js')).length;
      } else {
        results.hooks = 0;
      }

    } catch (error) {
      results.valid = false;
      results.errors.push(`Claude validation error: ${error.message}`);
    }

    return results;
  }

  async validateAiMeshInstallation(aiMeshPath) {
    const results = {
      valid: true,
      errors: []
    };

    try {
      // Check AI Mesh directory
      const exists = await this.fileExists(aiMeshPath);
      if (!exists) {
        results.valid = false;
        results.errors.push('AI Mesh directory not found');
        return results;
      }

      // Check runtime directories
      const requiredDirs = ['config', 'data', 'logs', 'state', 'src'];
      for (const dir of requiredDirs) {
        const dirPath = path.join(aiMeshPath, dir);
        const dirExists = await this.fileExists(dirPath);

        if (!dirExists) {
          results.valid = false;
          results.errors.push(`AI Mesh ${dir} directory not found`);
        }
      }

      // Check monitoring service
      const monitoringService = path.join(aiMeshPath, 'src', 'file-monitoring-service.js');
      const serviceExists = await this.fileExists(monitoringService);
      if (!serviceExists) {
        results.valid = false;
        results.errors.push('Monitoring service not found');
      }

    } catch (error) {
      results.valid = false;
      results.errors.push(`AI Mesh validation error: ${error.message}`);
    }

    return results;
  }

  async validateSettings(claudePath) {
    const results = {
      valid: true,
      errors: []
    };

    try {
      const settingsPath = path.join(claudePath, 'settings.json');
      const exists = await this.fileExists(settingsPath);

      if (!exists) {
        results.valid = false;
        results.errors.push('settings.json not found');
        return results;
      }

      // Validate JSON format
      const content = await fs.readFile(settingsPath, 'utf8');
      const settings = JSON.parse(content);

      // Check hooks configuration
      if (!settings.hooks) {
        results.valid = false;
        results.errors.push('Hooks configuration not found in settings.json');
      }

    } catch (error) {
      results.valid = false;
      results.errors.push(`Settings validation error: ${error.message}`);
    }

    return results;
  }

  compareVersions(version1, version2) {
    const v1parts = version1.split('.').map(Number);
    const v2parts = version2.split('.').map(Number);
    const maxLength = Math.max(v1parts.length, v2parts.length);

    for (let i = 0; i < maxLength; i++) {
      const v1part = v1parts[i] || 0;
      const v2part = v2parts[i] || 0;

      if (v1part > v2part) return 1;
      if (v1part < v2part) return -1;
    }

    return 0;
  }

  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = { Validator };