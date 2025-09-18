/**
 * Schema Validator - Enhanced for Task 3.2
 * 
 * Comprehensive schema validation for Kubernetes and Helm configurations:
 * - Helm values schema validation
 * - Kubernetes manifest validation
 * - Environment-specific configuration checks
 * - Custom validation rules engine
 * 
 * Part of: Phase 2 - Week 5 - Sprint 3: Deployment Automation
 * Task: 3.2 Pre-deployment Validation Enhancement
 */

const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const yaml = require('js-yaml');

/**
 * Schema Validator Class
 * 
 * Validates configurations against defined schemas and rules
 */
class SchemaValidator {
  constructor(config = {}) {
    this.config = {
      enableStrictValidation: config.enableStrictValidation !== false,
      customSchemas: config.customSchemas || {},
      environmentRules: config.environmentRules || {},
      defaultSchemaVersion: config.defaultSchemaVersion || 'v1',
      ...config
    };

    // Initialize AJV validator
    this.ajv = new Ajv({ allErrors: true, verbose: true });
    addFormats(this.ajv);
    
    // Load built-in schemas
    this._loadBuiltInSchemas();
    
    // Load custom schemas
    this._loadCustomSchemas();
  }

  /**
   * Validate Helm values against schema
   */
  async validateHelmValues(values, schemaName = 'helm-values') {
    const validation = {
      passed: true,
      errors: [],
      warnings: [],
      schemaVersion: this.config.defaultSchemaVersion
    };

    try {
      // Get schema for validation
      const schema = this._getSchema(schemaName);
      
      if (!schema) {
        validation.warnings.push({
          message: `No schema found for '${schemaName}', skipping validation`,
          severity: 'warning'
        });
        return validation;
      }

      // Validate against schema
      const valid = this.ajv.validate(schema, values);
      
      if (!valid) {
        validation.passed = false;
        validation.errors = this.ajv.errors.map(error => ({
          path: error.instancePath || 'root',
          message: error.message,
          value: error.data,
          allowedValues: error.schema,
          severity: 'error'
        }));
      }

      // Environment-specific validation
      if (this.config.environment) {
        const envValidation = await this._validateEnvironmentSpecific(values, this.config.environment);
        if (!envValidation.passed) {
          validation.passed = false;
          validation.errors.push(...envValidation.errors);
        }
        validation.warnings.push(...envValidation.warnings);
      }

      // Custom validation rules
      const customValidation = await this._applyCustomValidationRules(values);
      if (!customValidation.passed) {
        validation.passed = false;
        validation.errors.push(...customValidation.errors);
      }
      validation.warnings.push(...customValidation.warnings);

      return validation;

    } catch (error) {
      return {
        passed: false,
        errors: [{
          message: `Schema validation failed: ${error.message}`,
          severity: 'error'
        }],
        warnings: [],
        schemaVersion: this.config.defaultSchemaVersion
      };
    }
  }

  /**
   * Validate Kubernetes manifests
   */
  async validateKubernetesManifests(manifests) {
    const validation = {
      passed: true,
      errors: [],
      warnings: [],
      manifestResults: []
    };

    for (const manifest of manifests) {
      const manifestValidation = await this._validateSingleManifest(manifest);
      validation.manifestResults.push(manifestValidation);

      if (!manifestValidation.passed) {
        validation.passed = false;
        validation.errors.push(...manifestValidation.errors);
      }
      
      validation.warnings.push(...manifestValidation.warnings);
    }

    return validation;
  }

  /**
   * Validate configuration against environment requirements
   */
  async validateEnvironmentConfiguration(config, environment) {
    const validation = {
      passed: true,
      errors: [],
      warnings: [],
      environment
    };

    const envRules = this.config.environmentRules[environment];
    
    if (!envRules) {
      validation.warnings.push({
        message: `No environment rules defined for '${environment}'`,
        severity: 'warning'
      });
      return validation;
    }

    // Validate required fields for environment
    if (envRules.required) {
      for (const requiredField of envRules.required) {
        const fieldValue = this._getNestedValue(config, requiredField);
        if (fieldValue === undefined || fieldValue === null) {
          validation.passed = false;
          validation.errors.push({
            path: requiredField,
            message: `Required field '${requiredField}' is missing for ${environment} environment`,
            severity: 'error'
          });
        }
      }
    }

    // Validate forbidden fields for environment
    if (envRules.forbidden) {
      for (const forbiddenField of envRules.forbidden) {
        const fieldValue = this._getNestedValue(config, forbiddenField);
        if (fieldValue !== undefined && fieldValue !== null) {
          validation.passed = false;
          validation.errors.push({
            path: forbiddenField,
            message: `Field '${forbiddenField}' is not allowed in ${environment} environment`,
            severity: 'error'
          });
        }
      }
    }

    // Validate field constraints for environment
    if (envRules.constraints) {
      for (const [field, constraint] of Object.entries(envRules.constraints)) {
        const fieldValue = this._getNestedValue(config, field);
        const constraintValidation = this._validateFieldConstraint(field, fieldValue, constraint);
        
        if (!constraintValidation.passed) {
          validation.passed = false;
          validation.errors.push(...constraintValidation.errors);
        }
        
        validation.warnings.push(...constraintValidation.warnings);
      }
    }

    return validation;
  }

  /**
   * Add custom validation schema
   */
  addCustomSchema(name, schema) {
    try {
      this.ajv.addSchema(schema, name);
      this.config.customSchemas[name] = schema;
      return true;
    } catch (error) {
      throw new Error(`Failed to add custom schema '${name}': ${error.message}`);
    }
  }

  /**
   * Add custom validation rule
   */
  addCustomValidationRule(name, rule) {
    if (!this.customRules) {
      this.customRules = {};
    }
    
    this.customRules[name] = rule;
  }

  /**
   * Validate configuration completeness
   */
  async validateConfigurationCompleteness(config, requiredSections = []) {
    const validation = {
      passed: true,
      errors: [],
      warnings: [],
      completeness: 0
    };

    const totalSections = requiredSections.length;
    let completedSections = 0;

    for (const section of requiredSections) {
      const sectionValue = this._getNestedValue(config, section);
      
      if (sectionValue !== undefined && sectionValue !== null) {
        completedSections++;
        
        // Check if section is properly configured
        if (this._isSectionComplete(sectionValue)) {
          // Section is complete
        } else {
          validation.warnings.push({
            section,
            message: `Configuration section '${section}' is incomplete`,
            severity: 'warning'
          });
        }
      } else {
        validation.passed = false;
        validation.errors.push({
          section,
          message: `Required configuration section '${section}' is missing`,
          severity: 'error'
        });
      }
    }

    validation.completeness = totalSections > 0 ? (completedSections / totalSections) * 100 : 100;

    return validation;
  }

  // Private helper methods

  _loadBuiltInSchemas() {
    // Load Helm values schema
    const helmValuesSchema = {
      type: 'object',
      properties: {
        replicaCount: { type: 'integer', minimum: 1 },
        image: {
          type: 'object',
          properties: {
            repository: { type: 'string', pattern: '^[a-z0-9]+(?:[._-][a-z0-9]+)*(?:/[a-z0-9]+(?:[._-][a-z0-9]+)*)*$' },
            tag: { type: 'string' },
            pullPolicy: { type: 'string', enum: ['Always', 'IfNotPresent', 'Never'] }
          },
          required: ['repository', 'tag'],
          additionalProperties: false
        },
        service: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['ClusterIP', 'NodePort', 'LoadBalancer', 'ExternalName'] },
            port: { type: 'integer', minimum: 1, maximum: 65535 },
            targetPort: { type: 'integer', minimum: 1, maximum: 65535 }
          },
          required: ['type', 'port'],
          additionalProperties: false
        },
        ingress: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean' },
            className: { type: 'string' },
            annotations: { type: 'object' },
            hosts: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  host: { type: 'string', format: 'hostname' },
                  paths: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        path: { type: 'string' },
                        pathType: { type: 'string', enum: ['Exact', 'Prefix', 'ImplementationSpecific'] }
                      },
                      required: ['path', 'pathType']
                    }
                  }
                },
                required: ['host', 'paths']
              }
            },
            tls: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  secretName: { type: 'string' },
                  hosts: {
                    type: 'array',
                    items: { type: 'string', format: 'hostname' }
                  }
                },
                required: ['secretName']
              }
            }
          },
          additionalProperties: false
        },
        resources: {
          type: 'object',
          properties: {
            limits: {
              type: 'object',
              properties: {
                cpu: { type: 'string', pattern: '^[0-9]+(m|[0-9]*\\.?[0-9]+)$' },
                memory: { type: 'string', pattern: '^[0-9]+(Ei|Pi|Ti|Gi|Mi|Ki|E|P|T|G|M|K)?$' }
              }
            },
            requests: {
              type: 'object',
              properties: {
                cpu: { type: 'string', pattern: '^[0-9]+(m|[0-9]*\\.?[0-9]+)$' },
                memory: { type: 'string', pattern: '^[0-9]+(Ei|Pi|Ti|Gi|Mi|Ki|E|P|T|G|M|K)?$' }
              }
            }
          },
          additionalProperties: false
        }
      },
      additionalProperties: true
    };

    this.ajv.addSchema(helmValuesSchema, 'helm-values');

    // Load Kubernetes manifest schemas
    this._loadKubernetesSchemas();
  }

  _loadKubernetesSchemas() {
    // Basic Kubernetes object schema
    const kubernetesObjectSchema = {
      type: 'object',
      properties: {
        apiVersion: { type: 'string' },
        kind: { type: 'string' },
        metadata: {
          type: 'object',
          properties: {
            name: { type: 'string', pattern: '^[a-z0-9]([-a-z0-9]*[a-z0-9])?$' },
            namespace: { type: 'string', pattern: '^[a-z0-9]([-a-z0-9]*[a-z0-9])?$' },
            labels: { type: 'object' },
            annotations: { type: 'object' }
          },
          required: ['name']
        }
      },
      required: ['apiVersion', 'kind', 'metadata'],
      additionalProperties: true
    };

    this.ajv.addSchema(kubernetesObjectSchema, 'kubernetes-object');

    // Pod schema
    const podSchema = {
      allOf: [{ $ref: 'kubernetes-object' }],
      properties: {
        spec: {
          type: 'object',
          properties: {
            containers: {
              type: 'array',
              minItems: 1,
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', pattern: '^[a-z0-9]([-a-z0-9]*[a-z0-9])?$' },
                  image: { type: 'string' },
                  ports: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        containerPort: { type: 'integer', minimum: 1, maximum: 65535 },
                        protocol: { type: 'string', enum: ['TCP', 'UDP', 'SCTP'] }
                      },
                      required: ['containerPort']
                    }
                  }
                },
                required: ['name', 'image']
              }
            }
          },
          required: ['containers']
        }
      }
    };

    this.ajv.addSchema(podSchema, 'pod');
  }

  _loadCustomSchemas() {
    for (const [name, schema] of Object.entries(this.config.customSchemas)) {
      try {
        this.ajv.addSchema(schema, name);
      } catch (error) {
        console.warn(`Failed to load custom schema '${name}': ${error.message}`);
      }
    }
  }

  _getSchema(schemaName) {
    try {
      return this.ajv.getSchema(schemaName);
    } catch (error) {
      return null;
    }
  }

  async _validateEnvironmentSpecific(values, environment) {
    const validation = {
      passed: true,
      errors: [],
      warnings: []
    };

    // Environment-specific validation rules
    switch (environment) {
      case 'production':
        return this._validateProductionEnvironment(values);
      case 'staging':
        return this._validateStagingEnvironment(values);
      case 'development':
        return this._validateDevelopmentEnvironment(values);
      default:
        validation.warnings.push({
          message: `No specific validation rules for environment '${environment}'`,
          severity: 'warning'
        });
    }

    return validation;
  }

  _validateProductionEnvironment(values) {
    const validation = {
      passed: true,
      errors: [],
      warnings: []
    };

    // Production-specific validations
    if (values.replicaCount < 2) {
      validation.warnings.push({
        path: 'replicaCount',
        message: 'Production environments should have at least 2 replicas for high availability',
        severity: 'warning'
      });
    }

    if (values.image && values.image.tag === 'latest') {
      validation.passed = false;
      validation.errors.push({
        path: 'image.tag',
        message: 'Production environments should not use "latest" image tag',
        severity: 'error'
      });
    }

    if (values.resources && !values.resources.limits) {
      validation.warnings.push({
        path: 'resources.limits',
        message: 'Production environments should define resource limits',
        severity: 'warning'
      });
    }

    return validation;
  }

  _validateStagingEnvironment(values) {
    const validation = {
      passed: true,
      errors: [],
      warnings: []
    };

    // Staging-specific validations
    if (values.replicaCount > 3) {
      validation.warnings.push({
        path: 'replicaCount',
        message: 'Staging environments typically do not need more than 3 replicas',
        severity: 'warning'
      });
    }

    return validation;
  }

  _validateDevelopmentEnvironment(values) {
    const validation = {
      passed: true,
      errors: [],
      warnings: []
    };

    // Development-specific validations
    if (values.replicaCount > 1) {
      validation.warnings.push({
        path: 'replicaCount',
        message: 'Development environments typically use 1 replica',
        severity: 'info'
      });
    }

    return validation;
  }

  async _applyCustomValidationRules(values) {
    const validation = {
      passed: true,
      errors: [],
      warnings: []
    };

    if (!this.customRules) {
      return validation;
    }

    for (const [ruleName, rule] of Object.entries(this.customRules)) {
      try {
        const ruleResult = await rule(values);
        
        if (!ruleResult.passed) {
          validation.passed = false;
          validation.errors.push({
            rule: ruleName,
            message: ruleResult.message || `Custom rule '${ruleName}' failed`,
            severity: 'error'
          });
        }

        if (ruleResult.warnings) {
          validation.warnings.push(...ruleResult.warnings.map(w => ({
            rule: ruleName,
            ...w
          })));
        }
      } catch (error) {
        validation.warnings.push({
          rule: ruleName,
          message: `Custom rule '${ruleName}' execution failed: ${error.message}`,
          severity: 'warning'
        });
      }
    }

    return validation;
  }

  async _validateSingleManifest(manifest) {
    const validation = {
      passed: true,
      errors: [],
      warnings: [],
      kind: manifest.kind,
      name: manifest.metadata?.name
    };

    // Basic Kubernetes object validation
    const basicValidation = this.ajv.validate('kubernetes-object', manifest);
    
    if (!basicValidation) {
      validation.passed = false;
      validation.errors.push(...this.ajv.errors.map(error => ({
        path: error.instancePath || 'root',
        message: error.message,
        severity: 'error'
      })));
    }

    // Kind-specific validation
    const kindSchema = this._getKindSchema(manifest.kind);
    if (kindSchema) {
      const kindValidation = this.ajv.validate(kindSchema, manifest);
      if (!kindValidation) {
        validation.passed = false;
        validation.errors.push(...this.ajv.errors.map(error => ({
          path: error.instancePath || 'root',
          message: error.message,
          severity: 'error'
        })));
      }
    }

    return validation;
  }

  _getKindSchema(kind) {
    const schemaMap = {
      'Pod': 'pod',
      'Deployment': 'deployment',
      'Service': 'service',
      'ConfigMap': 'configmap',
      'Secret': 'secret'
    };

    const schemaName = schemaMap[kind];
    return schemaName ? this._getSchema(schemaName) : null;
  }

  _validateFieldConstraint(field, value, constraint) {
    const validation = {
      passed: true,
      errors: [],
      warnings: []
    };

    if (constraint.min !== undefined && value < constraint.min) {
      validation.passed = false;
      validation.errors.push({
        path: field,
        message: `Field '${field}' value ${value} is below minimum ${constraint.min}`,
        severity: 'error'
      });
    }

    if (constraint.max !== undefined && value > constraint.max) {
      validation.passed = false;
      validation.errors.push({
        path: field,
        message: `Field '${field}' value ${value} exceeds maximum ${constraint.max}`,
        severity: 'error'
      });
    }

    if (constraint.enum && !constraint.enum.includes(value)) {
      validation.passed = false;
      validation.errors.push({
        path: field,
        message: `Field '${field}' value '${value}' is not in allowed values: ${constraint.enum.join(', ')}`,
        severity: 'error'
      });
    }

    if (constraint.pattern && !new RegExp(constraint.pattern).test(value)) {
      validation.passed = false;
      validation.errors.push({
        path: field,
        message: `Field '${field}' value '${value}' does not match required pattern`,
        severity: 'error'
      });
    }

    return validation;
  }

  _getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  _isSectionComplete(sectionValue) {
    if (typeof sectionValue === 'object' && sectionValue !== null) {
      // Check if object has meaningful content
      const keys = Object.keys(sectionValue);
      return keys.length > 0 && keys.some(key => 
        sectionValue[key] !== undefined && 
        sectionValue[key] !== null && 
        sectionValue[key] !== ''
      );
    }
    
    return sectionValue !== undefined && sectionValue !== null && sectionValue !== '';
  }
}

module.exports = { SchemaValidator };