/**
 * Integration Test Utilities
 * Common utilities for integration testing of command migration
 */

const fs = require('fs').promises;
const path = require('path');

class IntegrationTestUtils {
  constructor(baseDir) {
    this.baseDir = baseDir;
    this.commandsDir = path.join(baseDir, 'commands');
    this.aiMeshDir = path.join(this.commandsDir, 'ai-mesh');
    this.backupPattern = /commands-backup-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}/;
  }

  /**
   * Create temporary test environment
   * @param {Object} options - Configuration options
   * @returns {Promise<string>} Path to test directory
   */
  async createTestEnvironment(options = {}) {
    const timestamp = Date.now();
    const testDir = path.join(this.baseDir, `test-env-${timestamp}`);
    
    await fs.mkdir(testDir, { recursive: true });
    
    if (options.createCommandsDir !== false) {
      await fs.mkdir(path.join(testDir, 'commands'), { recursive: true });
    }
    
    return testDir;
  }

  /**
   * Seed test commands with various options
   * @param {string} testDir - Test directory path
   * @param {Object} options - Configuration options
   */
  async seedTestCommands(testDir, options = {}) {
    const commandsDir = path.join(testDir, 'commands');
    await fs.mkdir(commandsDir, { recursive: true });

    const aiMeshCommands = options.aiMeshCommands || [
      'create-prd', 'create-trd', 'implement-trd', 'fold-prompt',
      'manager-dashboard', 'analyze-product'
    ];

    const thirdPartyCommands = options.thirdPartyCommands || [];

    // Create AI Mesh commands with metadata
    for (const cmd of aiMeshCommands) {
      await fs.writeFile(
        path.join(commandsDir, `${cmd}.md`),
        `# @ai-mesh-command\n# Command: ${cmd}\n# Version: 1.0.0\n\n## Description\n\nTest command content.`
      );
      
      await fs.writeFile(
        path.join(commandsDir, `${cmd}.txt`),
        `# @ai-mesh-command\n# Command: ${cmd}\n\nTest prompt content.`
      );
    }

    // Create third-party commands without metadata
    for (const cmd of thirdPartyCommands) {
      await fs.writeFile(
        path.join(commandsDir, `${cmd}.md`),
        `# ${cmd}\n\nThird-party command without @ai-mesh-command metadata.`
      );
    }

    return {
      aiMeshCount: aiMeshCommands.length * 2,
      thirdPartyCount: thirdPartyCommands.length
    };
  }

  /**
   * Create corrupted test files
   * @param {string} testDir - Test directory path
   */
  async createCorruptedFiles(testDir) {
    const commandsDir = path.join(testDir, 'commands');
    await fs.mkdir(commandsDir, { recursive: true });

    // Missing metadata header (but looks like a command)
    await fs.writeFile(
      path.join(commandsDir, 'missing-metadata.md'),
      '# Command without metadata\n\nNo @ai-mesh-command marker.'
    );

    // Malformed YAML (invalid structure) - NO @ai-mesh-command marker
    // This file looks like it could be a command but lacks the marker
    await fs.writeFile(
      path.join(commandsDir, 'malformed.md'),
      '# Some Command\n---\ninvalid: yaml: structure::\n---\nContent'
    );

    // Empty file
    await fs.writeFile(
      path.join(commandsDir, 'empty.md'),
      ''
    );

    // Binary file with .md extension - make it readable/writable
    const binaryPath = path.join(commandsDir, 'binary.md');
    await fs.writeFile(
      binaryPath,
      Buffer.from([0xFF, 0xFE, 0xFD, 0xFC, 0x00, 0x01])
    );
    // Ensure binary file is writable for cleanup
    await fs.chmod(binaryPath, 0o666);

    // Valid AI Mesh commands (should succeed)
    await fs.writeFile(
      path.join(commandsDir, 'valid-command.md'),
      '# @ai-mesh-command\n# Command: valid-command\n\nValid content.'
    );
    
    await fs.writeFile(
      path.join(commandsDir, 'valid-command.txt'),
      '# @ai-mesh-command\n# Command: valid-command\n\nValid prompt.'
    );

    return {
      corruptedCount: 4,
      validCount: 2
    };
  }

  /**
   * Set file permissions
   * @param {string} filePath - Path to file or directory
   * @param {number} mode - Octal permission mode (e.g., 0o755, 0o444)
   */
  async setFilePermissions(filePath, mode) {
    try {
      await fs.chmod(filePath, mode);
    } catch (error) {
      throw new Error(`Failed to set permissions on ${filePath}: ${error.message}`);
    }
  }

  /**
   * Verify files exist in expected location
   * @param {string} testDir - Test directory path
   * @param {string[]} expectedFiles - Array of expected file names
   * @param {string} subdirectory - Optional subdirectory (e.g., 'ai-mesh')
   * @returns {Promise<{found: string[], missing: string[]}>}
   */
  async verifyFiles(testDir, expectedFiles, subdirectory = '') {
    const targetDir = subdirectory 
      ? path.join(testDir, 'commands', subdirectory)
      : path.join(testDir, 'commands');

    const found = [];
    const missing = [];

    for (const file of expectedFiles) {
      const filePath = path.join(targetDir, file);
      
      try {
        await fs.access(filePath);
        found.push(file);
      } catch {
        missing.push(file);
      }
    }

    return { found, missing };
  }

  /**
   * Verify YAML content contains expected path
   * @param {string} filePath - Path to YAML file
   * @param {string} expectedPath - Expected path in YAML (e.g., 'ai-mesh/')
   * @returns {Promise<boolean>}
   */
  async verifyYamlContent(filePath, expectedPath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return content.includes(expectedPath);
    } catch (error) {
      return false;
    }
  }

  /**
   * Find backup directory matching pattern
   * @param {string} testDir - Test directory path
   * @returns {Promise<string|null>} Path to backup directory or null
   */
  async findBackupDirectory(testDir) {
    try {
      const entries = await fs.readdir(testDir);
      
      for (const entry of entries) {
        if (this.backupPattern.test(entry)) {
          const backupPath = path.join(testDir, entry);
          const stats = await fs.stat(backupPath);
          
          if (stats.isDirectory()) {
            return backupPath;
          }
        }
      }
      
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Count files in directory
   * @param {string} dirPath - Directory path
   * @param {string} extension - Optional file extension filter
   * @returns {Promise<number>}
   */
  async countFiles(dirPath, extension = null) {
    try {
      const files = await fs.readdir(dirPath);
      
      if (!extension) {
        return files.length;
      }
      
      return files.filter(f => f.endsWith(extension)).length;
    } catch {
      return 0;
    }
  }

  /**
   * Get all files recursively
   * @param {string} dirPath - Directory path
   * @returns {Promise<string[]>} Array of file paths
   */
  async getAllFiles(dirPath) {
    const files = [];
    
    try {
      const entries = await fs.readdir(dirPath);
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry);
        const stats = await fs.stat(fullPath);
        
        if (stats.isFile()) {
          files.push(fullPath);
        } else if (stats.isDirectory()) {
          const subFiles = await this.getAllFiles(fullPath);
          files.push(...subFiles);
        }
      }
    } catch {
      // Directory doesn't exist or permission error
    }
    
    return files;
  }

  /**
   * Clean up test environment
   * @param {string} testDir - Test directory path
   */
  async cleanup(testDir) {
    try {
      // First, recursively fix permissions on all files and directories
      await this.fixPermissionsRecursively(testDir);
      
      // Then attempt to remove with retry logic
      await fs.rm(testDir, { 
        recursive: true, 
        force: true,
        maxRetries: 3,
        retryDelay: 100
      });
    } catch (error) {
      // Silently ignore cleanup errors - they're not test failures
      // console.warn(`Cleanup warning: ${error.message}`);
    }
  }
  
  /**
   * Recursively fix permissions on files and directories
   * @param {string} dirPath - Directory path
   * @private
   */
  async fixPermissionsRecursively(dirPath) {
    try {
      const entries = await fs.readdir(dirPath).catch(() => []);
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry);
        
        try {
          const stats = await fs.stat(fullPath);
          
          // Make writable before deletion
          await fs.chmod(fullPath, 0o755).catch(() => {});
          
          if (stats.isDirectory()) {
            await this.fixPermissionsRecursively(fullPath);
          }
        } catch (error) {
          // Ignore permission errors on individual files
        }
      }
      
      // Fix permissions on the directory itself
      await fs.chmod(dirPath, 0o755).catch(() => {});
    } catch (error) {
      // Ignore permission errors
    }
  }

  /**
   * Create test report
   * @param {Object} testResult - Test execution results
   * @returns {Object} Formatted test report
   */
  createTestReport(testResult) {
    return {
      scenario: testResult.scenario,
      passed: testResult.passed,
      duration: testResult.duration,
      assertions: testResult.assertions || 0,
      filesCreated: testResult.filesCreated || 0,
      validationsPassed: testResult.validationsPassed || 0,
      performance: testResult.performance || {},
      errors: testResult.errors || []
    };
  }

  /**
   * Measure execution time
   * @param {Function} fn - Function to measure
   * @returns {Promise<{result: any, duration: number}>}
   */
  async measureTime(fn) {
    const startTime = Date.now();
    const result = await fn();
    const duration = Date.now() - startTime;
    
    return { result, duration };
  }
}

module.exports = { IntegrationTestUtils };
