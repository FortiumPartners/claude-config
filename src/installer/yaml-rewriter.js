/**
 * YAML Rewriter
 * Rewrites YAML command definitions to use hierarchical subdirectory paths
 *
 * Part of Command Directory Reorganization project (Sprint 2, Group 2)
 * TRD Tasks: TRD-024 through TRD-027
 */

const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');

/**
 * YamlRewriter Class
 * Handles YAML parsing, path rewriting, validation, and error handling
 */
class YamlRewriter {
  /**
   * Initialize YamlRewriter
   * @param {string} commandsDir - Base commands directory
   * @param {Object} logger - Logger instance
   */
  constructor(commandsDir, logger) {
    this.commandsDir = commandsDir;
    this.logger = logger;
    this.yamlDir = path.join(commandsDir, 'commands', 'yaml');
    this.errors = [];
    this.warnings = [];
  }

  /**
   * TRD-024: Parse YAML file
   * @param {string} filePath - Path to YAML file
   * @returns {Promise<Object>} Parsed YAML data
   */
  async parseYaml(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const data = yaml.load(content);

      if (!data) {
        throw new Error('Empty or invalid YAML file');
      }

      return data;
    } catch (error) {
      this.logger.error(`Failed to parse YAML file: ${filePath}`);
      throw error;
    }
  }

  /**
   * TRD-024: Extract output_path from YAML data
   * @param {Object} yamlData - Parsed YAML data
   * @returns {string|undefined} Output path value
   */
  extractOutputPath(yamlData) {
    if (!yamlData || !yamlData.metadata) {
      return undefined;
    }
    return yamlData.metadata.output_path;
  }

  /**
   * TRD-024: Get YAML structure for debugging
   * @param {Object} yamlData - Parsed YAML data
   * @returns {Object} Structure analysis
   */
  getYamlStructure(yamlData) {
    return {
      hasMetadata: !!yamlData?.metadata,
      hasOutputPath: !!yamlData?.metadata?.output_path,
      hasMission: !!yamlData?.mission,
      hasWorkflow: !!yamlData?.workflow,
      keys: yamlData ? Object.keys(yamlData) : []
    };
  }

  /**
   * TRD-025: Rewrite output_path to include subdirectory
   * @param {Object} yamlData - Parsed YAML data
   * @param {string} targetDir - Target subdirectory (default: 'ai-mesh')
   * @returns {Object} Modified YAML data
   */
  rewriteOutputPath(yamlData, targetDir = 'ai-mesh') {
    // Deep clone to avoid mutating original (optimized for performance)
    const cloned = this._deepClone(yamlData);

    if (!cloned.metadata || !cloned.metadata.output_path) {
      return cloned;
    }

    const currentPath = cloned.metadata.output_path;

    // Check if already migrated (idempotent)
    if (currentPath.startsWith(`${targetDir}/`)) {
      return cloned;
    }

    // Rewrite path
    cloned.metadata.output_path = `${targetDir}/${currentPath}`;

    return cloned;
  }

  /**
   * Deep clone helper - optimized for YAML data structures
   * @private
   */
  _deepClone(obj) {
    // Fast path for simple objects
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    // Handle arrays
    if (Array.isArray(obj)) {
      return obj.map(item => this._deepClone(item));
    }

    // Handle objects
    const cloned = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = this._deepClone(obj[key]);
      }
    }
    return cloned;
  }

  /**
   * TRD-026: Validate YAML structure
   * @param {Object} yamlData - Parsed YAML data
   * @returns {Object} Validation report {valid: boolean, errors: [], warnings: []}
   */
  validateYaml(yamlData) {
    const errors = [];
    const warnings = [];

    // Check for metadata section
    if (!yamlData || !yamlData.metadata) {
      errors.push('Missing required section: metadata');
      return { valid: false, errors, warnings };
    }

    const metadata = yamlData.metadata;

    // Required fields validation
    if (!metadata.name || typeof metadata.name !== 'string') {
      errors.push('Missing required field: metadata.name');
    }

    if (!metadata.description || typeof metadata.description !== 'string') {
      errors.push('Missing required field: metadata.description');
    }

    if (!metadata.output_path) {
      errors.push('Missing required field: metadata.output_path');
    } else {
      // Validate output_path format
      const outputPath = metadata.output_path;

      // Check file extension
      if (!outputPath.endsWith('.md') && !outputPath.endsWith('.txt')) {
        const ext = path.extname(outputPath);
        warnings.push(`output_path should end with .md or .txt (found: ${ext || 'no extension'})`);
      }

      // Check if path starts with ai-mesh/ (for migrated files)
      if (!outputPath.startsWith('ai-mesh/')) {
        warnings.push('output_path does not start with ai-mesh/ (not yet migrated)');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * TRD-027: Handle malformed YAML files
   * @param {string} filePath - Path to problematic YAML file
   * @param {Error} error - Error object (optional)
   * @returns {Promise<Object>} Error handling result
   */
  async handleMalformedYaml(filePath, error = null) {
    const { category, errorMessage } = this._categorizeError(error, filePath);

    const result = {
      skip: true,
      category,
      error: errorMessage,
      file: filePath
    };

    // Log based on category
    if (category === 'fatal') {
      this.logger.error(`Fatal error in ${path.basename(filePath)}: ${errorMessage}`);
    } else {
      this.logger.warning(`Skipping ${path.basename(filePath)}: ${errorMessage}`);
    }

    this.errors.push(result);
    return result;
  }

  /**
   * Categorize errors for better handling
   * @private
   */
  _categorizeError(error, filePath) {
    let category = 'warning';
    let errorMessage = 'Unknown error';

    if (error) {
      errorMessage = error.message;

      // Fatal errors - stop processing this file
      const fatalCodes = ['ENOENT', 'EACCES', 'EISDIR', 'ENOTDIR'];
      if (fatalCodes.includes(error.code)) {
        category = 'fatal';
        const errorNames = {
          'ENOENT': 'File not found',
          'EACCES': 'Permission denied',
          'EISDIR': 'Path is a directory',
          'ENOTDIR': 'Path component is not a directory'
        };
        errorMessage = errorNames[error.code] || 'File system error';
      }
      // Warning errors - skip file, continue with others
      else if (error.message.includes('YAMLException') ||
               error.message.includes('Validation failed') ||
               error.message.includes('Empty or invalid')) {
        category = 'warning';
      }
    } else {
      // No error provided, check file accessibility
      category = 'fatal';
      errorMessage = 'File not accessible';
    }

    return { category, errorMessage };
  }

  /**
   * Rewrite a single YAML file
   * @param {string} yamlFilePath - Path to YAML file
   * @returns {Promise<Object>} Rewrite result
   */
  async rewriteYamlFile(yamlFilePath) {
    const startTime = Date.now();

    try {
      // 1. Parse YAML
      const yamlData = await this.parseYaml(yamlFilePath);

      // 2. Validate original
      const validation = this.validateYaml(yamlData);
      if (!validation.valid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      const originalPath = this.extractOutputPath(yamlData);

      // 3. Rewrite paths
      const rewritten = this.rewriteOutputPath(yamlData);

      // 4. Validate rewritten
      const rewrittenValidation = this.validateYaml(rewritten);
      if (!rewrittenValidation.valid) {
        throw new Error(`Rewritten YAML validation failed: ${rewrittenValidation.errors.join(', ')}`);
      }

      // 5. Write back to disk
      const yamlContent = yaml.dump(rewritten, {
        indent: 2,
        lineWidth: 120,
        noRefs: true
      });
      await fs.writeFile(yamlFilePath, yamlContent, 'utf8');

      const duration = Date.now() - startTime;

      // 6. Return status report
      return {
        success: true,
        file: path.basename(yamlFilePath),
        originalPath,
        rewrittenPath: this.extractOutputPath(rewritten),
        duration
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      await this.handleMalformedYaml(yamlFilePath, error);

      return {
        success: false,
        file: path.basename(yamlFilePath),
        error: error.message,
        duration
      };
    }
  }

  /**
   * Rewrite all YAML files in directory
   * @param {Object} options - Processing options
   * @param {boolean} options.parallel - Process files in parallel (default: false)
   * @returns {Promise<Object>} Migration report
   */
  async rewriteAllYamls(options = {}) {
    const { parallel = false } = options;
    const startTime = Date.now();
    const succeeded = [];
    const failed = [];

    try {
      // Scan yaml directory
      const files = await fs.readdir(this.yamlDir);
      const yamlFiles = this._filterYamlFiles(files);

      if (yamlFiles.length === 0) {
        this.logger.warning('No YAML files found to process');
        return this._generateReport(succeeded, failed, startTime);
      }

      this.logger.info(`Found ${yamlFiles.length} YAML files to process`);

      // Process files (sequential or parallel)
      if (parallel && yamlFiles.length > 5) {
        // Use parallel processing for large batches
        await this._processParallel(yamlFiles, succeeded, failed);
      } else {
        // Sequential processing for small batches or when order matters
        await this._processSequential(yamlFiles, succeeded, failed);
      }

      return this._generateReport(succeeded, failed, startTime);

    } catch (error) {
      this.logger.error(`Failed to scan YAML directory: ${error.message}`);
      throw error;
    }
  }

  /**
   * Filter YAML files from directory listing
   * @private
   */
  _filterYamlFiles(files) {
    return files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
  }

  /**
   * Process files sequentially
   * @private
   */
  async _processSequential(yamlFiles, succeeded, failed) {
    for (const file of yamlFiles) {
      const filePath = path.join(this.yamlDir, file);
      const result = await this.rewriteYamlFile(filePath);
      this._collectResult(result, succeeded, failed);
    }
  }

  /**
   * Process files in parallel (for large batches)
   * @private
   */
  async _processParallel(yamlFiles, succeeded, failed) {
    const promises = yamlFiles.map(file => {
      const filePath = path.join(this.yamlDir, file);
      return this.rewriteYamlFile(filePath);
    });

    const results = await Promise.all(promises);
    results.forEach(result => this._collectResult(result, succeeded, failed));
  }

  /**
   * Collect processing result
   * @private
   */
  _collectResult(result, succeeded, failed) {
    if (result.success) {
      succeeded.push(result);
      this.logger.success(`✓ ${result.file}: ${result.originalPath} → ${result.rewrittenPath}`);
    } else {
      failed.push(result);
      this.logger.error(`✗ ${result.file}: ${result.error}`);
    }
  }

  /**
   * Generate migration report
   * @private
   */
  _generateReport(succeeded, failed, startTime) {
    const totalDuration = Date.now() - startTime;
    const totalProcessed = succeeded.length + failed.length;

    const summary = {
      totalProcessed,
      succeeded: succeeded.length,
      failed: failed.length,
      successRate: totalProcessed > 0 ? (succeeded.length / totalProcessed * 100).toFixed(1) : '0.0',
      totalErrors: failed.length,
      duration: totalDuration,
      averageDuration: totalProcessed > 0 ? (totalDuration / totalProcessed).toFixed(2) : '0.00'
    };

    this.logger.info(`Migration complete: ${summary.succeeded}/${summary.totalProcessed} succeeded (${summary.successRate}%)`);

    return {
      succeeded,
      failed,
      summary
    };
  }
}

module.exports = { YamlRewriter };
