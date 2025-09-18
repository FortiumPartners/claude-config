/**
 * Multi-Environment Configuration Management System
 * Week 6 - Task 3.5: Advanced Deployment Patterns
 * 
 * Provides comprehensive environment hierarchy management with:
 * - Environment-specific configuration inheritance
 * - Automated promotion workflows with validation
 * - Configuration drift detection and remediation
 * - Secret management with environment-specific injection
 * 
 * Performance Targets:
 * - Environment promotion: <2 minutes
 * - Configuration validation: <30 seconds
 * - Drift detection: <60 seconds
 * 
 * Integration: Works with deployment-engine.js and validator systems
 */

const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');

class MultiEnvironmentManager {
  constructor() {
    this.environments = ['development', 'staging', 'production'];
    this.configPath = process.env.CONFIG_PATH || './config';
    this.secretsPath = process.env.SECRETS_PATH || './secrets';
    this.validationRules = new Map();
    this.promotionWorkflows = new Map();
    
    this.initializeEnvironmentHierarchy();
  }

  /**
   * Initialize environment hierarchy with inheritance chain
   * development -> staging -> production
   */
  async initializeEnvironmentHierarchy() {
    const hierarchy = {
      development: {
        parent: null,
        promotesTo: 'staging',
        validationLevel: 'basic',
        autoPromotion: false,
        approvalRequired: false
      },
      staging: {
        parent: 'development',
        promotesTo: 'production',
        validationLevel: 'comprehensive',
        autoPromotion: false,
        approvalRequired: true
      },
      production: {
        parent: 'staging',
        promotesTo: null,
        validationLevel: 'strict',
        autoPromotion: false,
        approvalRequired: true
      }
    };

    this.environmentHierarchy = hierarchy;
    return hierarchy;
  }

  /**
   * Generate environment-specific configuration with inheritance
   * @param {string} environment - Target environment
   * @param {Object} baseConfig - Base configuration object
   * @param {Object} overrides - Environment-specific overrides
   * @returns {Object} Merged configuration
   */
  async generateEnvironmentConfig(environment, baseConfig = {}, overrides = {}) {
    const startTime = Date.now();
    
    try {
      // Load base configuration
      const envConfig = await this.loadEnvironmentConfig(environment);
      
      // Apply inheritance chain
      const inheritedConfig = await this.applyConfigInheritance(environment, envConfig);
      
      // Merge configurations with precedence: overrides > env-specific > inherited > base
      const finalConfig = this.mergeConfigurations([
        baseConfig,
        inheritedConfig,
        envConfig,
        overrides
      ]);

      // Validate configuration
      await this.validateEnvironmentConfig(environment, finalConfig);

      // Inject environment-specific secrets
      const configWithSecrets = await this.injectEnvironmentSecrets(environment, finalConfig);

      const duration = Date.now() - startTime;
      
      return {
        success: true,
        environment,
        config: configWithSecrets,
        metadata: {
          generatedAt: new Date().toISOString(),
          duration: `${duration}ms`,
          inheritance: await this.getInheritanceChain(environment),
          validation: 'passed'
        }
      };

    } catch (error) {
      return {
        success: false,
        environment,
        error: error.message,
        duration: `${Date.now() - startTime}ms`
      };
    }
  }

  /**
   * Load environment-specific configuration from files
   * @param {string} environment - Environment name
   * @returns {Object} Environment configuration
   */
  async loadEnvironmentConfig(environment) {
    const configPaths = [
      path.join(this.configPath, `${environment}.yaml`),
      path.join(this.configPath, `${environment}.yml`),
      path.join(this.configPath, `${environment}.json`)
    ];

    for (const configPath of configPaths) {
      try {
        const content = await fs.readFile(configPath, 'utf8');
        
        if (configPath.endsWith('.json')) {
          return JSON.parse(content);
        } else {
          return yaml.load(content);
        }
      } catch (error) {
        // Continue to next path if file not found
        continue;
      }
    }

    // Return default config if no file found
    return this.getDefaultEnvironmentConfig(environment);
  }

  /**
   * Apply configuration inheritance based on environment hierarchy
   * @param {string} environment - Target environment
   * @param {Object} currentConfig - Current environment config
   * @returns {Object} Configuration with inheritance applied
   */
  async applyConfigInheritance(environment, currentConfig) {
    const hierarchy = this.environmentHierarchy[environment];
    
    if (!hierarchy || !hierarchy.parent) {
      return {}; // No inheritance for root environment
    }

    // Recursively load parent configurations
    const parentConfig = await this.loadEnvironmentConfig(hierarchy.parent);
    const inheritedParentConfig = await this.applyConfigInheritance(hierarchy.parent, parentConfig);
    
    // Merge parent configurations
    return this.mergeConfigurations([inheritedParentConfig, parentConfig]);
  }

  /**
   * Get inheritance chain for an environment
   * @param {string} environment - Environment name
   * @returns {Array} Chain of inherited environments
   */
  async getInheritanceChain(environment) {
    const chain = [environment];
    let current = environment;

    while (this.environmentHierarchy[current]?.parent) {
      const parent = this.environmentHierarchy[current].parent;
      chain.unshift(parent);
      current = parent;
    }

    return chain;
  }

  /**
   * Merge multiple configuration objects with proper precedence
   * @param {Array} configs - Array of configuration objects (highest precedence last)
   * @returns {Object} Merged configuration
   */
  mergeConfigurations(configs) {
    return configs.reduce((merged, config) => {
      return this.deepMerge(merged, config || {});
    }, {});
  }

  /**
   * Deep merge two objects with array concatenation
   * @param {Object} target - Target object
   * @param {Object} source - Source object
   * @returns {Object} Merged object
   */
  deepMerge(target, source) {
    const result = { ...target };

    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (Array.isArray(source[key])) {
          result[key] = Array.isArray(result[key]) 
            ? [...result[key], ...source[key]]
            : [...source[key]];
        } else if (typeof source[key] === 'object' && source[key] !== null) {
          result[key] = this.deepMerge(result[key] || {}, source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }

    return result;
  }

  /**
   * Validate environment configuration against rules
   * @param {string} environment - Environment name
   * @param {Object} config - Configuration to validate
   * @returns {Promise<boolean>} Validation result
   */
  async validateEnvironmentConfig(environment, config) {
    const validationLevel = this.environmentHierarchy[environment]?.validationLevel || 'basic';
    const rules = this.getValidationRules(validationLevel);

    for (const rule of rules) {
      const result = await this.executeValidationRule(rule, config, environment);
      if (!result.valid) {
        throw new Error(`Configuration validation failed: ${result.message}`);
      }
    }

    return true;
  }

  /**
   * Get validation rules for a specific validation level
   * @param {string} level - Validation level
   * @returns {Array} Array of validation rules
   */
  getValidationRules(level) {
    const rules = {
      basic: [
        { name: 'required-fields', required: ['name', 'version'] },
        { name: 'type-validation', types: { port: 'number', replicas: 'number' } }
      ],
      comprehensive: [
        { name: 'required-fields', required: ['name', 'version', 'resources', 'security'] },
        { name: 'type-validation', types: { port: 'number', replicas: 'number' } },
        { name: 'resource-limits', limits: { cpu: '2000m', memory: '4Gi' } },
        { name: 'security-validation', required: ['rbac', 'networkPolicies'] }
      ],
      strict: [
        { name: 'required-fields', required: ['name', 'version', 'resources', 'security', 'monitoring'] },
        { name: 'type-validation', types: { port: 'number', replicas: 'number' } },
        { name: 'resource-limits', limits: { cpu: '2000m', memory: '4Gi' } },
        { name: 'security-validation', required: ['rbac', 'networkPolicies', 'podSecurityPolicy'] },
        { name: 'production-readiness', required: ['healthChecks', 'monitoring', 'logging'] }
      ]
    };

    return rules[level] || rules.basic;
  }

  /**
   * Execute a validation rule against configuration
   * @param {Object} rule - Validation rule
   * @param {Object} config - Configuration to validate
   * @param {string} environment - Environment name
   * @returns {Object} Validation result
   */
  async executeValidationRule(rule, config, environment) {
    switch (rule.name) {
      case 'required-fields':
        return this.validateRequiredFields(rule.required, config);
      
      case 'type-validation':
        return this.validateTypes(rule.types, config);
      
      case 'resource-limits':
        return this.validateResourceLimits(rule.limits, config);
      
      case 'security-validation':
        return this.validateSecurity(rule.required, config);
      
      case 'production-readiness':
        return this.validateProductionReadiness(rule.required, config);
      
      default:
        return { valid: true, message: 'Unknown validation rule' };
    }
  }

  /**
   * Validate required fields exist in configuration
   * @param {Array} required - Required field names
   * @param {Object} config - Configuration object
   * @returns {Object} Validation result
   */
  validateRequiredFields(required, config) {
    for (const field of required) {
      if (!this.hasNestedProperty(config, field)) {
        return {
          valid: false,
          message: `Required field '${field}' is missing`
        };
      }
    }
    return { valid: true, message: 'All required fields present' };
  }

  /**
   * Validate field types in configuration
   * @param {Object} types - Field type mappings
   * @param {Object} config - Configuration object
   * @returns {Object} Validation result
   */
  validateTypes(types, config) {
    for (const [field, expectedType] of Object.entries(types)) {
      const value = this.getNestedProperty(config, field);
      if (value !== undefined && typeof value !== expectedType) {
        return {
          valid: false,
          message: `Field '${field}' must be of type '${expectedType}', got '${typeof value}'`
        };
      }
    }
    return { valid: true, message: 'All type validations passed' };
  }

  /**
   * Inject environment-specific secrets into configuration
   * @param {string} environment - Environment name
   * @param {Object} config - Configuration object
   * @returns {Object} Configuration with secrets injected
   */
  async injectEnvironmentSecrets(environment, config) {
    try {
      const secretsFile = path.join(this.secretsPath, `${environment}.secrets.yaml`);
      const secretsContent = await fs.readFile(secretsFile, 'utf8');
      const secrets = yaml.load(secretsContent);

      // Replace secret references in config
      return this.replaceSecretReferences(config, secrets);
      
    } catch (error) {
      // No secrets file found, return config as-is
      return config;
    }
  }

  /**
   * Replace secret references in configuration with actual values
   * @param {Object} config - Configuration object
   * @param {Object} secrets - Secrets object
   * @returns {Object} Configuration with secrets replaced
   */
  replaceSecretReferences(config, secrets) {
    return JSON.parse(JSON.stringify(config, (key, value) => {
      if (typeof value === 'string' && value.startsWith('${SECRET:')) {
        const secretName = value.slice(9, -1); // Remove ${SECRET: and }
        return secrets[secretName] || value;
      }
      return value;
    }));
  }

  /**
   * Promote configuration from one environment to another
   * @param {string} fromEnv - Source environment
   * @param {string} toEnv - Target environment
   * @param {Object} options - Promotion options
   * @returns {Object} Promotion result
   */
  async promoteConfiguration(fromEnv, toEnv, options = {}) {
    const startTime = Date.now();
    
    try {
      // Validate promotion path
      const fromHierarchy = this.environmentHierarchy[fromEnv];
      if (!fromHierarchy || fromHierarchy.promotesTo !== toEnv) {
        throw new Error(`Invalid promotion path: ${fromEnv} -> ${toEnv}`);
      }

      // Check approval requirements
      const toHierarchy = this.environmentHierarchy[toEnv];
      if (toHierarchy.approvalRequired && !options.approved) {
        throw new Error(`Promotion to ${toEnv} requires approval`);
      }

      // Load source configuration
      const sourceConfig = await this.generateEnvironmentConfig(fromEnv);
      if (!sourceConfig.success) {
        throw new Error(`Failed to load source config: ${sourceConfig.error}`);
      }

      // Apply target environment transformations
      const transformedConfig = await this.applyEnvironmentTransformations(
        sourceConfig.config,
        fromEnv,
        toEnv
      );

      // Validate target configuration
      await this.validateEnvironmentConfig(toEnv, transformedConfig);

      // Execute promotion workflow
      const promotionResult = await this.executePromotionWorkflow(
        fromEnv,
        toEnv,
        transformedConfig,
        options
      );

      const duration = Date.now() - startTime;

      return {
        success: true,
        fromEnvironment: fromEnv,
        toEnvironment: toEnv,
        config: transformedConfig,
        promotionResult,
        metadata: {
          promotedAt: new Date().toISOString(),
          duration: `${duration}ms`,
          approvedBy: options.approvedBy,
          rollbackPlan: await this.generateRollbackPlan(fromEnv, toEnv)
        }
      };

    } catch (error) {
      return {
        success: false,
        fromEnvironment: fromEnv,
        toEnvironment: toEnv,
        error: error.message,
        duration: `${Date.now() - startTime}ms`
      };
    }
  }

  /**
   * Apply environment-specific transformations during promotion
   * @param {Object} config - Source configuration
   * @param {string} fromEnv - Source environment
   * @param {string} toEnv - Target environment
   * @returns {Object} Transformed configuration
   */
  async applyEnvironmentTransformations(config, fromEnv, toEnv) {
    const transformations = {
      'development->staging': {
        replicas: Math.max(config.replicas || 1, 2),
        resources: {
          ...config.resources,
          limits: {
            cpu: '1000m',
            memory: '2Gi'
          }
        }
      },
      'staging->production': {
        replicas: Math.max(config.replicas || 2, 3),
        resources: {
          ...config.resources,
          limits: {
            cpu: '2000m',
            memory: '4Gi'
          }
        },
        monitoring: {
          ...config.monitoring,
          enabled: true,
          alerting: true
        }
      }
    };

    const transformationKey = `${fromEnv}->${toEnv}`;
    const transformation = transformations[transformationKey] || {};

    return this.deepMerge(config, transformation);
  }

  /**
   * Execute promotion workflow with proper validation and rollback planning
   * @param {string} fromEnv - Source environment
   * @param {string} toEnv - Target environment
   * @param {Object} config - Configuration to promote
   * @param {Object} options - Promotion options
   * @returns {Object} Workflow execution result
   */
  async executePromotionWorkflow(fromEnv, toEnv, config, options) {
    const workflow = {
      steps: [
        'backup-current-config',
        'validate-target-config',
        'apply-configuration',
        'verify-deployment',
        'update-monitoring'
      ],
      results: {}
    };

    for (const step of workflow.steps) {
      try {
        workflow.results[step] = await this.executePromotionStep(
          step,
          fromEnv,
          toEnv,
          config,
          options
        );
      } catch (error) {
        workflow.results[step] = { success: false, error: error.message };
        
        // Execute rollback on failure
        await this.executeRollback(fromEnv, toEnv, workflow.results);
        throw error;
      }
    }

    return workflow;
  }

  /**
   * Get default configuration for an environment
   * @param {string} environment - Environment name
   * @returns {Object} Default configuration
   */
  getDefaultEnvironmentConfig(environment) {
    const defaults = {
      development: {
        replicas: 1,
        resources: {
          requests: { cpu: '100m', memory: '128Mi' },
          limits: { cpu: '500m', memory: '512Mi' }
        },
        monitoring: { enabled: false },
        logging: { level: 'debug' }
      },
      staging: {
        replicas: 2,
        resources: {
          requests: { cpu: '200m', memory: '256Mi' },
          limits: { cpu: '1000m', memory: '1Gi' }
        },
        monitoring: { enabled: true },
        logging: { level: 'info' }
      },
      production: {
        replicas: 3,
        resources: {
          requests: { cpu: '500m', memory: '512Mi' },
          limits: { cpu: '2000m', memory: '2Gi' }
        },
        monitoring: { enabled: true, alerting: true },
        logging: { level: 'warn' }
      }
    };

    return defaults[environment] || defaults.development;
  }

  /**
   * Detect configuration drift between environments
   * @param {string} sourceEnv - Source environment
   * @param {string} targetEnv - Target environment
   * @returns {Object} Drift detection results
   */
  async detectConfigurationDrift(sourceEnv, targetEnv) {
    const startTime = Date.now();

    try {
      const sourceConfig = await this.generateEnvironmentConfig(sourceEnv);
      const targetConfig = await this.generateEnvironmentConfig(targetEnv);

      if (!sourceConfig.success || !targetConfig.success) {
        throw new Error('Failed to load configurations for drift detection');
      }

      const driftResults = this.compareDriftConfigurations(
        sourceConfig.config,
        targetConfig.config
      );

      return {
        success: true,
        sourceEnvironment: sourceEnv,
        targetEnvironment: targetEnv,
        driftDetected: driftResults.length > 0,
        drifts: driftResults,
        metadata: {
          analyzedAt: new Date().toISOString(),
          duration: `${Date.now() - startTime}ms`,
          totalDrifts: driftResults.length
        }
      };

    } catch (error) {
      return {
        success: false,
        sourceEnvironment: sourceEnv,
        targetEnvironment: targetEnv,
        error: error.message,
        duration: `${Date.now() - startTime}ms`
      };
    }
  }

  /**
   * Helper method to check if nested property exists
   * @param {Object} obj - Object to check
   * @param {string} path - Property path (dot notation)
   * @returns {boolean} Property existence
   */
  hasNestedProperty(obj, path) {
    return path.split('.').reduce((current, prop) => {
      return current && current.hasOwnProperty(prop) ? current[prop] : undefined;
    }, obj) !== undefined;
  }

  /**
   * Helper method to get nested property value
   * @param {Object} obj - Object to get from
   * @param {string} path - Property path (dot notation)
   * @returns {*} Property value
   */
  getNestedProperty(obj, path) {
    return path.split('.').reduce((current, prop) => {
      return current && current.hasOwnProperty(prop) ? current[prop] : undefined;
    }, obj);
  }

  /**
   * Compare configurations and identify drifts
   * @param {Object} sourceConfig - Source configuration
   * @param {Object} targetConfig - Target configuration
   * @returns {Array} Array of drift objects
   */
  compareDriftConfigurations(sourceConfig, targetConfig) {
    const drifts = [];
    
    const compare = (source, target, path = '') => {
      for (const key in source) {
        const currentPath = path ? `${path}.${key}` : key;
        
        if (!(key in target)) {
          drifts.push({
            type: 'missing',
            path: currentPath,
            sourceValue: source[key],
            targetValue: undefined
          });
        } else if (typeof source[key] === 'object' && source[key] !== null) {
          if (typeof target[key] !== 'object') {
            drifts.push({
              type: 'type-mismatch',
              path: currentPath,
              sourceValue: source[key],
              targetValue: target[key]
            });
          } else {
            compare(source[key], target[key], currentPath);
          }
        } else if (source[key] !== target[key]) {
          drifts.push({
            type: 'value-mismatch',
            path: currentPath,
            sourceValue: source[key],
            targetValue: target[key]
          });
        }
      }
    };

    compare(sourceConfig, targetConfig);
    return drifts;
  }
}

module.exports = MultiEnvironmentManager;