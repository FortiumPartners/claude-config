/**
 * YAML Parser with JSON Schema Validation
 * Parses and validates YAML agent and command files
 */

const yaml = require('js-yaml');
const fs = require('fs').promises;
const path = require('path');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

class YamlParser {
  constructor(logger) {
    this.logger = logger;
    this.ajv = new Ajv({ 
      allErrors: true, 
      strict: false,
      verbose: true
    });
    addFormats(this.ajv);
    
    this.schemas = new Map();
  }

  /**
   * Parse and validate a YAML file
   * @param {string} yamlPath - Path to YAML file
   * @returns {Object} Parsed and validated data
   */
  async parse(yamlPath) {
    try {
      // Read YAML file
      const yamlContent = await fs.readFile(yamlPath, 'utf8');
      
      // Parse YAML
      const parsed = yaml.load(yamlContent, {
        filename: yamlPath,
        onWarning: (warning) => {
          this.logger.warning(`YAML warning in ${yamlPath}: ${warning.message}`);
        }
      });

      if (!parsed || typeof parsed !== 'object') {
        throw new Error(`Invalid YAML in ${yamlPath}: must be an object`);
      }

      // Determine type (agent or command) and validate
      const type = this.detectType(yamlPath);
      await this.validate(parsed, type, yamlPath);

      this.logger.debug(`Successfully parsed and validated: ${path.basename(yamlPath)}`);
      
      return parsed;
    } catch (error) {
      if (error instanceof yaml.YAMLException) {
        throw new Error(`YAML parsing error in ${yamlPath}: ${error.message}`);
      }
      // Re-throw with filename if not already included
      if (error.message && !error.message.includes(yamlPath)) {
        throw new Error(`Error in ${yamlPath}: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Detect whether file is agent or command based on path
   * @param {string} filePath - Path to YAML file
   * @returns {string} 'agent' or 'command'
   */
  detectType(filePath) {
    // Convert to absolute path for reliable detection
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(filePath);
    const normalized = absolutePath.toLowerCase();
    
    // Check for commands directory (including yaml subdirectory)
    if (normalized.includes('/commands/') || normalized.includes('\\commands\\')) {
      this.logger.debug(`Detected type: command (path: ${filePath})`);
      return 'command';
    }
    
    // Check for agents directory (including yaml subdirectory)
    if (normalized.includes('/agents/') || normalized.includes('\\agents\\')) {
      this.logger.debug(`Detected type: agent (path: ${filePath})`);
      return 'agent';
    }
    
    // Default to agent if unclear
    this.logger.warning(`Could not detect type from path: ${filePath}, defaulting to 'agent'`);
    return 'agent';
  }

  /**
   * Validate parsed data against JSON Schema
   * @param {Object} data - Parsed YAML data
   * @param {string} type - 'agent' or 'command'
   * @param {string} filePath - Optional file path for error messages
   */
  async validate(data, type, filePath = null) {
    // Load schema if not cached
    if (!this.schemas.has(type)) {
      await this.loadSchema(type);
    }

    const schema = this.schemas.get(type);
    const validate = this.ajv.compile(schema);
    const valid = validate(data);

    if (!valid) {
      const errors = this.formatValidationErrors(validate.errors);
      const fileInfo = filePath ? ` in ${filePath}` : '';
      throw new Error(`${type} validation failed${fileInfo}:\n${errors}`);
    }
  }

  /**
   * Load JSON Schema from file
   * @param {string} type - 'agent' or 'command'
   */
  async loadSchema(type) {
    const schemaPath = path.join(
      __dirname,
      '../../schemas',
      `${type}-schema.json`
    );

    try {
      const schemaContent = await fs.readFile(schemaPath, 'utf8');
      const schema = JSON.parse(schemaContent);
      this.schemas.set(type, schema);
      this.logger.debug(`Loaded ${type} schema from ${schemaPath}`);
    } catch (error) {
      throw new Error(`Failed to load ${type} schema: ${error.message}`);
    }
  }

  /**
   * Format validation errors for readability
   * @param {Array} errors - AJV validation errors
   * @returns {string} Formatted error message
   */
  formatValidationErrors(errors) {
    return errors
      .map(err => {
        const path = err.instancePath || 'root';
        const message = err.message;
        const params = err.params ? JSON.stringify(err.params) : '';
        
        let formatted = `  • ${path}: ${message}`;
        
        if (params && params !== '{}') {
          formatted += ` (${params})`;
        }
        
        if (err.keyword === 'enum') {
          formatted += `\n    Allowed values: ${err.params.allowedValues.join(', ')}`;
        }
        
        return formatted;
      })
      .join('\n');
  }

  /**
   * Parse multiple YAML files
   * @param {Array<string>} filePaths - Array of YAML file paths
   * @returns {Array<Object>} Array of parsed data objects
   */
  async parseMany(filePaths) {
    const results = [];
    const errors = [];

    for (const filePath of filePaths) {
      try {
        const parsed = await this.parse(filePath);
        results.push({ filePath, data: parsed, success: true });
      } catch (error) {
        errors.push({ filePath, error: error.message, success: false });
        this.logger.error(`Failed to parse ${filePath}: ${error.message}`);
      }
    }

    return { results, errors, successCount: results.length, errorCount: errors.length };
  }

  /**
   * Validate YAML content without parsing from file
   * @param {string} yamlContent - YAML content string
   * @param {string} type - 'agent' or 'command'
   * @param {string} filePath - Optional file path for error messages
   * @returns {Object} Parsed and validated data
   */
  async validateContent(yamlContent, type, filePath = null) {
    const parsed = yaml.load(yamlContent);
    await this.validate(parsed, type, filePath);
    return parsed;
  }
}

module.exports = { YamlParser };
