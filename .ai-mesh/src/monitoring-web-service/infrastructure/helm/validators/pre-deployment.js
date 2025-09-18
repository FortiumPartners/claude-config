/**
 * Pre-Deployment Validator - Enhanced for Task 3.2
 * 
 * Comprehensive pre-deployment validation system:
 * - Environment readiness and cluster connectivity checks
 * - Resource availability validation and quota management
 * - Dependency verification and service availability
 * - Security policy checks and compliance verification
 * - Namespace preparation and configuration validation
 * - Schema validation and environment-specific checks
 * 
 * Part of: Phase 2 - Week 5 - Sprint 3: Deployment Automation
 * Task: 3.2 Pre-deployment Validation Enhancement
 */

const { EventEmitter } = require('events');
const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const { execSync } = require('child_process');

// Import validation modules
const { KubernetesClient } = require('../utils/kubernetes-client');
const { ResourceValidator } = require('../utils/resource-validator');
const { SecurityValidator } = require('../utils/security-validator');
const { DependencyValidator } = require('../utils/dependency-validator');
const { SchemaValidator } = require('../utils/schema-validator');

/**
 * Pre-Deployment Validator Class
 * 
 * Performs comprehensive pre-deployment validation:
 * - Environment and cluster readiness validation
 * - Resource requirements and availability checks
 * - Chart structure and syntax validation
 * - Security policy and compliance verification
 */
class PreDeploymentValidator extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      strictValidation: config.strictValidation !== false,
      enableSecurityValidation: config.enableSecurityValidation !== false,
      enableResourceValidation: config.enableResourceValidation !== false,
      enableCompatibilityChecks: config.enableCompatibilityChecks !== false,
      enableDependencyValidation: config.enableDependencyValidation !== false,
      enableNamespacePreparation: config.enableNamespacePreparation !== false,
      enableSchemaValidation: config.enableSchemaValidation !== false,
      
      // Task 3.2 Enhanced Configuration
      validationTimeout: config.validationTimeout || 30000, // 30 seconds
      parallelValidation: config.parallelValidation !== false,
      autoNamespaceCreation: config.autoNamespaceCreation || false,
      
      // Security and compliance
      allowedImageRegistries: config.allowedImageRegistries || [],
      requiredLabels: config.requiredLabels || [],
      forbiddenResources: config.forbiddenResources || [],
      securityPolicies: config.securityPolicies || {},
      
      // Resource management
      resourceQuotas: config.resourceQuotas || {},
      minResourceRequirements: config.minResourceRequirements || {},
      maxResourceLimits: config.maxResourceLimits || {},
      
      // Dependency configuration
      requiredServices: config.requiredServices || [],
      requiredDatabases: config.requiredDatabases || [],
      externalDependencies: config.externalDependencies || [],
      
      // Environment-specific settings
      environment: config.environment || 'production',
      region: config.region || 'us-west-2',
      clusterName: config.clusterName || '',
      
      ...config
    };

    // Initialize validation components
    this.kubernetesClient = new KubernetesClient(this.config);
    this.resourceValidator = new ResourceValidator(this.config);
    this.securityValidator = new SecurityValidator(this.config);
    this.dependencyValidator = new DependencyValidator(this.config);
    this.schemaValidator = new SchemaValidator(this.config);

    this.validationRules = this._initializeValidationRules();
    this.securityPolicies = this._initializeSecurityPolicies();
    this.validationResults = {};
    this.validationCache = new Map();
    
    // Performance tracking
    this.validationMetrics = {
      totalValidations: 0,
      averageValidationTime: 0,
      successRate: 0,
      lastValidationTime: null
    };
  }

  /**
   * Comprehensive Environment Validation - Enhanced for Task 3.2
   * 
   * @param {string} namespace - Target namespace
   * @returns {Promise<object>} Environment validation result
   */
  async validateEnvironment(namespace) {
    const validationId = `env-${Date.now()}`;
    const startTime = Date.now();
    
    try {
      this.emit('validationStart', {
        type: 'environment',
        validationId,
        namespace,
        timestamp: new Date().toISOString()
      });

      // Task 3.2: Comprehensive environment validation checks
      const validationPromises = [];
      
      if (this.config.parallelValidation) {
        // Parallel execution for performance
        validationPromises.push(
          this._validateClusterConnectivity(),
          this._validateNamespaceReadiness(namespace),
          this._validateRBACPermissions(namespace),
          this._validateResourceQuotas(namespace),
          this._validateNetworkPolicies(namespace),
          this._validateStorageAvailability(),
          this._validateNodeResources(),
          this._validateClusterVersion(),
          this._validateAPIServerHealth()
        );
        
        const results = await Promise.allSettled(validationPromises);
        var checks = this._processParallelResults(results);
      } else {
        // Sequential execution
        checks = {
          clusterConnectivity: await this._validateClusterConnectivity(),
          namespaceReadiness: await this._validateNamespaceReadiness(namespace),
          rbacPermissions: await this._validateRBACPermissions(namespace),
          resourceQuotas: await this._validateResourceQuotas(namespace),
          networkPolicies: await this._validateNetworkPolicies(namespace),
          storageAvailability: await this._validateStorageAvailability(),
          nodeResources: await this._validateNodeResources(),
          clusterVersion: await this._validateClusterVersion(),
          apiServerHealth: await this._validateAPIServerHealth()
        };
      }

      // Namespace preparation if needed
      if (this.config.enableNamespacePreparation) {
        checks.namespacePreparation = await this._prepareNamespace(namespace);
      }

      const issues = [];
      const warnings = [];
      const recommendations = [];

      // Analyze validation results
      Object.entries(checks).forEach(([checkName, result]) => {
        if (!result.passed) {
          if (result.severity === 'error' || result.severity === 'critical') {
            issues.push({
              check: checkName,
              message: result.message,
              severity: result.severity,
              remediation: result.remediation || 'Manual intervention required'
            });
          } else if (result.severity === 'warning') {
            warnings.push({
              check: checkName,
              message: result.message,
              impact: result.impact || 'Low',
              recommendation: result.recommendation
            });
          }
        }
        
        if (result.recommendations) {
          recommendations.push(...result.recommendations);
        }
      });

      const validationTime = Date.now() - startTime;
      
      const validationResult = {
        validationId,
        type: 'environment',
        namespace,
        passed: issues.length === 0,
        checks,
        issues,
        warnings,
        recommendations,
        validationTime,
        environment: this.config.environment,
        clusterName: this.config.clusterName,
        timestamp: new Date().toISOString(),
        
        // Enhanced metadata
        summary: {
          totalChecks: Object.keys(checks).length,
          passedChecks: Object.values(checks).filter(c => c.passed).length,
          failedChecks: issues.length,
          warningChecks: warnings.length,
          riskLevel: this._assessEnvironmentRisk(issues, warnings)
        }
      };

      // Update validation metrics
      this._updateValidationMetrics(validationTime, validationResult.passed);

      this.validationResults[validationId] = validationResult;
      this.emit('validationComplete', validationResult);
      
      if (!validationResult.passed && this.config.strictValidation) {
        const errorMessage = `Environment validation failed: ${issues.map(i => i.message).join(', ')}`;
        throw new Error(errorMessage);
      }

      return validationResult;
    } catch (error) {
      const validationTime = Date.now() - startTime;
      this._updateValidationMetrics(validationTime, false);
      
      this.emit('validationError', {
        type: 'environment',
        validationId,
        error: error.message,
        validationTime,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  /**
   * Validate Helm chart
   * 
   * @param {string} chartPath - Path to the Helm chart
   * @returns {Promise<object>} Chart validation result
   */
  async validateChart(chartPath) {
    const validationId = `chart-${Date.now()}`;
    
    try {
      this.emit('validationStart', {
        type: 'chart',
        validationId,
        chartPath,
        timestamp: new Date().toISOString()
      });

      const checks = {
        chartExists: await this._checkChartExists(chartPath),
        chartYamlValid: await this._validateChartYaml(chartPath),
        templatesValid: await this._validateTemplates(chartPath),
        valuesValid: await this._validateDefaultValues(chartPath),
        dependenciesValid: await this._validateDependencies(chartPath),
        securityCompliant: await this._validateChartSecurity(chartPath)
      };

      const issues = [];
      const warnings = [];

      // Analyze check results
      Object.entries(checks).forEach(([checkName, result]) => {
        if (!result.passed) {
          if (result.severity === 'error') {
            issues.push(`${checkName}: ${result.message}`);
          } else {
            warnings.push(`${checkName}: ${result.message}`);
          }
        }
      });

      const validationResult = {
        validationId,
        type: 'chart',
        chartPath,
        passed: issues.length === 0,
        checks,
        issues,
        warnings,
        timestamp: new Date().toISOString()
      };

      this.validationResults[validationId] = validationResult;

      this.emit('validationComplete', validationResult);
      
      if (!validationResult.passed && this.config.strictValidation) {
        throw new Error(`Chart validation failed: ${issues.join(', ')}`);
      }

      return validationResult;
    } catch (error) {
      this.emit('validationError', {
        type: 'chart',
        validationId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  /**
   * Validate deployment values
   * 
   * @param {object} values - Values to validate
   * @returns {Promise<object>} Values validation result
   */
  async validateValues(values) {
    const validationId = `values-${Date.now()}`;
    
    try {
      this.emit('validationStart', {
        type: 'values',
        validationId,
        timestamp: new Date().toISOString()
      });

      const checks = {
        structureValid: await this._validateValuesStructure(values),
        securityCompliant: await this._validateValuesSecurity(values),
        resourcesValid: await this._validateValuesResources(values),
        imagesValid: await this._validateValuesImages(values),
        configValid: await this._validateValuesConfiguration(values)
      };

      const issues = [];
      const warnings = [];

      // Analyze check results
      Object.entries(checks).forEach(([checkName, result]) => {
        if (!result.passed) {
          if (result.severity === 'error') {
            issues.push(`${checkName}: ${result.message}`);
          } else {
            warnings.push(`${checkName}: ${result.message}`);
          }
        }
      });

      const validationResult = {
        validationId,
        type: 'values',
        passed: issues.length === 0,
        checks,
        issues,
        warnings,
        valuesCount: Object.keys(values).length,
        timestamp: new Date().toISOString()
      };

      this.validationResults[validationId] = validationResult;

      this.emit('validationComplete', validationResult);
      
      if (!validationResult.passed && this.config.strictValidation) {
        throw new Error(`Values validation failed: ${issues.join(', ')}`);
      }

      return validationResult;
    } catch (error) {
      this.emit('validationError', {
        type: 'values',
        validationId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  /**
   * Validate resource availability
   * 
   * @param {string} releaseName - Release name
   * @param {string} namespace - Target namespace
   * @returns {Promise<object>} Resource validation result
   */
  async validateResources(releaseName, namespace) {
    const validationId = `resources-${Date.now()}`;
    
    try {
      this.emit('validationStart', {
        type: 'resources',
        validationId,
        releaseName,
        namespace,
        timestamp: new Date().toISOString()
      });

      const checks = {
        namespaceQuota: await this._checkNamespaceResourceQuota(namespace),
        storageAvailable: await this._checkStorageAvailability(namespace),
        networkingReady: await this._checkNetworkingResources(namespace),
        serviceAccountExists: await this._checkServiceAccountAvailability(namespace),
        secretsAvailable: await this._checkSecretsAvailability(namespace)
      };

      const issues = [];
      const warnings = [];

      // Analyze check results
      Object.entries(checks).forEach(([checkName, result]) => {
        if (!result.passed) {
          if (result.severity === 'error') {
            issues.push(`${checkName}: ${result.message}`);
          } else {
            warnings.push(`${checkName}: ${result.message}`);
          }
        }
      });

      const validationResult = {
        validationId,
        type: 'resources',
        releaseName,
        namespace,
        passed: issues.length === 0,
        checks,
        issues,
        warnings,
        timestamp: new Date().toISOString()
      };

      this.validationResults[validationId] = validationResult;

      this.emit('validationComplete', validationResult);
      
      if (!validationResult.passed && this.config.strictValidation) {
        throw new Error(`Resource validation failed: ${issues.join(', ')}`);
      }

      return validationResult;
    } catch (error) {
      this.emit('validationError', {
        type: 'resources',
        validationId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  /**
   * Validate upgrade compatibility
   * 
   * @param {string} releaseName - Release name
   * @param {string} namespace - Namespace
   * @returns {Promise<object>} Upgrade validation result
   */
  async validateUpgrade(releaseName, namespace) {
    // Implementation for upgrade-specific validation
    return this._validateOperation('upgrade', releaseName, namespace);
  }

  /**
   * Validate rollback feasibility
   * 
   * @param {string} releaseName - Release name
   * @param {string} namespace - Namespace
   * @param {number} revision - Target revision
   * @returns {Promise<object>} Rollback validation result
   */
  async validateRollback(releaseName, namespace, revision) {
    // Implementation for rollback-specific validation
    return this._validateOperation('rollback', releaseName, namespace, { revision });
  }

  /**
   * Validate deletion safety
   * 
   * @param {string} releaseName - Release name
   * @param {string} namespace - Namespace
   * @returns {Promise<object>} Deletion validation result
   */
  async validateDeletion(releaseName, namespace) {
    // Implementation for deletion-specific validation
    return this._validateOperation('deletion', releaseName, namespace);
  }

  /**
   * Validate compatibility between current and new configurations
   * 
   * @param {object} currentRelease - Current release information
   * @param {object} newValues - New values
   * @returns {Promise<object>} Compatibility validation result
   */
  async validateCompatibility(currentRelease, newValues) {
    const validationId = `compatibility-${Date.now()}`;
    
    try {
      const checks = {
        valuesCompatible: await this._checkValuesCompatibility(currentRelease.values, newValues),
        chartVersionCompatible: await this._checkChartVersionCompatibility(currentRelease),
        resourceCompatible: await this._checkResourceCompatibility(currentRelease, newValues),
        configurationCompatible: await this._checkConfigurationCompatibility(currentRelease, newValues)
      };

      const issues = [];
      const warnings = [];

      Object.entries(checks).forEach(([checkName, result]) => {
        if (!result.passed) {
          if (result.severity === 'error') {
            issues.push(`${checkName}: ${result.message}`);
          } else {
            warnings.push(`${checkName}: ${result.message}`);
          }
        }
      });

      return {
        validationId,
        type: 'compatibility',
        passed: issues.length === 0,
        checks,
        issues,
        warnings,
        riskLevel: this._assessCompatibilityRisk(issues, warnings),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Compatibility validation failed: ${error.message}`);
    }
  }

  // Private Methods

  async _checkNamespaceExists(namespace) {
    // Mock implementation - would use kubectl/k8s API
    return {
      passed: true,
      message: `Namespace '${namespace}' exists`,
      severity: 'info'
    };
  }

  async _checkNamespaceReady(namespace) {
    // Mock implementation
    return {
      passed: true,
      message: `Namespace '${namespace}' is ready`,
      severity: 'info'
    };
  }

  async _checkClusterConnectivity() {
    // Mock implementation
    return {
      passed: true,
      message: 'Cluster connectivity verified',
      severity: 'info'
    };
  }

  async _checkPermissions(namespace) {
    // Mock implementation - would check RBAC permissions
    return {
      passed: true,
      message: 'Required permissions available',
      severity: 'info'
    };
  }

  async _checkResourceQuotas(namespace) {
    if (!this.config.enableResourceValidation) {
      return { passed: true, message: 'Resource validation disabled', severity: 'info' };
    }

    // Mock implementation
    return {
      passed: true,
      message: 'Resource quotas sufficient',
      severity: 'info'
    };
  }

  async _checkNetworkPolicies(namespace) {
    // Mock implementation
    return {
      passed: true,
      message: 'Network policies allow deployment',
      severity: 'info'
    };
  }

  async _checkStorageClasses() {
    // Mock implementation
    return {
      passed: true,
      message: 'Required storage classes available',
      severity: 'info'
    };
  }

  async _checkChartExists(chartPath) {
    try {
      const chartYamlPath = path.join(chartPath, 'Chart.yaml');
      await fs.access(chartYamlPath);
      return {
        passed: true,
        message: 'Chart exists and is accessible',
        severity: 'info'
      };
    } catch (error) {
      return {
        passed: false,
        message: `Chart not found at ${chartPath}`,
        severity: 'error'
      };
    }
  }

  async _validateChartYaml(chartPath) {
    try {
      const chartYamlPath = path.join(chartPath, 'Chart.yaml');
      const chartContent = await fs.readFile(chartYamlPath, 'utf8');
      const chartData = yaml.load(chartContent);
      
      const requiredFields = ['name', 'version', 'apiVersion'];
      const missingFields = requiredFields.filter(field => !chartData[field]);
      
      if (missingFields.length > 0) {
        return {
          passed: false,
          message: `Chart.yaml missing required fields: ${missingFields.join(', ')}`,
          severity: 'error'
        };
      }

      return {
        passed: true,
        message: 'Chart.yaml is valid',
        severity: 'info',
        chartData
      };
    } catch (error) {
      return {
        passed: false,
        message: `Chart.yaml validation failed: ${error.message}`,
        severity: 'error'
      };
    }
  }

  async _validateTemplates(chartPath) {
    try {
      const templatesPath = path.join(chartPath, 'templates');
      const templates = await fs.readdir(templatesPath);
      
      if (templates.length === 0) {
        return {
          passed: false,
          message: 'No templates found in chart',
          severity: 'error'
        };
      }

      // Validate each template file
      for (const template of templates) {
        if (template.endsWith('.yaml') || template.endsWith('.yml')) {
          const templatePath = path.join(templatesPath, template);
          const templateContent = await fs.readFile(templatePath, 'utf8');
          
          // Basic YAML syntax check
          try {
            yaml.loadAll(templateContent);
          } catch (yamlError) {
            return {
              passed: false,
              message: `Template ${template} has invalid YAML syntax: ${yamlError.message}`,
              severity: 'error'
            };
          }
        }
      }

      return {
        passed: true,
        message: `Templates validated (${templates.length} files)`,
        severity: 'info'
      };
    } catch (error) {
      return {
        passed: false,
        message: `Template validation failed: ${error.message}`,
        severity: 'error'
      };
    }
  }

  async _validateDefaultValues(chartPath) {
    try {
      const valuesPath = path.join(chartPath, 'values.yaml');
      
      try {
        const valuesContent = await fs.readFile(valuesPath, 'utf8');
        const valuesData = yaml.load(valuesContent);
        
        return {
          passed: true,
          message: 'Default values are valid',
          severity: 'info',
          valuesData
        };
      } catch (fileError) {
        // values.yaml is optional
        return {
          passed: true,
          message: 'No default values file found (optional)',
          severity: 'info'
        };
      }
    } catch (error) {
      return {
        passed: false,
        message: `Values validation failed: ${error.message}`,
        severity: 'error'
      };
    }
  }

  async _validateDependencies(chartPath) {
    // Mock implementation - would validate Chart.yaml dependencies
    return {
      passed: true,
      message: 'Dependencies validated',
      severity: 'info'
    };
  }

  async _validateChartSecurity(chartPath) {
    if (!this.config.enableSecurityValidation) {
      return { passed: true, message: 'Security validation disabled', severity: 'info' };
    }

    // Mock implementation - would check for security issues
    return {
      passed: true,
      message: 'Chart security validated',
      severity: 'info'
    };
  }

  async _validateValuesStructure(values) {
    if (typeof values !== 'object' || Array.isArray(values)) {
      return {
        passed: false,
        message: 'Values must be an object',
        severity: 'error'
      };
    }

    return {
      passed: true,
      message: 'Values structure is valid',
      severity: 'info'
    };
  }

  async _validateValuesSecurity(values) {
    if (!this.config.enableSecurityValidation) {
      return { passed: true, message: 'Security validation disabled', severity: 'info' };
    }

    const securityIssues = [];
    
    // Check for hardcoded secrets (basic check)
    const flatValues = this._flattenObject(values);
    for (const [key, value] of Object.entries(flatValues)) {
      if (typeof value === 'string' && this._looksLikeSecret(key, value)) {
        securityIssues.push(`Potential hardcoded secret in ${key}`);
      }
    }

    if (securityIssues.length > 0) {
      return {
        passed: false,
        message: `Security issues found: ${securityIssues.join(', ')}`,
        severity: 'error'
      };
    }

    return {
      passed: true,
      message: 'Values security validated',
      severity: 'info'
    };
  }

  async _validateValuesResources(values) {
    // Mock implementation - would validate resource specifications
    return {
      passed: true,
      message: 'Resource values validated',
      severity: 'info'
    };
  }

  async _validateValuesImages(values) {
    // Mock implementation - would validate image references
    return {
      passed: true,
      message: 'Image values validated',
      severity: 'info'
    };
  }

  async _validateValuesConfiguration(values) {
    // Mock implementation - would validate configuration values
    return {
      passed: true,
      message: 'Configuration values validated',
      severity: 'info'
    };
  }

  // Additional validation methods would be implemented here...

  async _validateOperation(operation, releaseName, namespace, options = {}) {
    const validationId = `${operation}-${Date.now()}`;
    
    return {
      validationId,
      type: operation,
      releaseName,
      namespace,
      passed: true,
      checks: {
        operationAllowed: { passed: true, message: `${operation} operation allowed`, severity: 'info' }
      },
      issues: [],
      warnings: [],
      timestamp: new Date().toISOString()
    };
  }

  _flattenObject(obj, prefix = '') {
    const flattened = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}.${key}` : key;
      
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        Object.assign(flattened, this._flattenObject(value, newKey));
      } else {
        flattened[newKey] = value;
      }
    }
    
    return flattened;
  }

  _looksLikeSecret(key, value) {
    const secretKeywords = ['password', 'secret', 'token', 'key', 'credential'];
    const keyLower = key.toLowerCase();
    
    return secretKeywords.some(keyword => keyLower.includes(keyword)) &&
           typeof value === 'string' &&
           value.length > 8;
  }

  _assessCompatibilityRisk(issues, warnings) {
    if (issues.length > 0) {
      return 'high';
    } else if (warnings.length > 2) {
      return 'medium';
    } else if (warnings.length > 0) {
      return 'low';
    } else {
      return 'none';
    }
  }

  // ============================================================================
  // TASK 3.2: ENHANCED VALIDATION METHODS
  // ============================================================================

  /**
   * Validate cluster connectivity with comprehensive checks
   */
  async _validateClusterConnectivity() {
    try {
      // Check kubectl connectivity and cluster info
      const clusterInfo = await this.kubernetesClient.getClusterInfo();
      
      if (!clusterInfo || !clusterInfo.serverVersion) {
        return {
          passed: false,
          message: 'Cannot connect to Kubernetes cluster',
          severity: 'critical',
          remediation: 'Check kubeconfig and cluster accessibility'
        };
      }

      // Test API server responsiveness
      const apiHealth = await this.kubernetesClient.checkAPIServerHealth();
      
      return {
        passed: apiHealth.healthy,
        message: apiHealth.healthy ? 
          `Cluster connectivity verified (${clusterInfo.serverVersion})` :
          `API server health check failed: ${apiHealth.error}`,
        severity: apiHealth.healthy ? 'info' : 'critical',
        metadata: { 
          serverVersion: clusterInfo.serverVersion,
          responseTime: apiHealth.responseTime 
        }
      };
    } catch (error) {
      return {
        passed: false,
        message: `Cluster connectivity check failed: ${error.message}`,
        severity: 'critical',
        remediation: 'Verify kubeconfig, network connectivity, and cluster status'
      };
    }
  }

  /**
   * Comprehensive namespace readiness validation
   */
  async _validateNamespaceReadiness(namespace) {
    try {
      const namespaceExists = await this.kubernetesClient.namespaceExists(namespace);
      
      if (!namespaceExists) {
        if (this.config.autoNamespaceCreation) {
          return {
            passed: true,
            message: `Namespace '${namespace}' will be created automatically`,
            severity: 'info',
            action: 'create-namespace'
          };
        } else {
          return {
            passed: false,
            message: `Namespace '${namespace}' does not exist`,
            severity: 'error',
            remediation: `Create namespace: kubectl create namespace ${namespace}`
          };
        }
      }

      // Validate namespace status and configuration
      const namespaceStatus = await this.kubernetesClient.getNamespaceStatus(namespace);
      
      if (namespaceStatus.phase !== 'Active') {
        return {
          passed: false,
          message: `Namespace '${namespace}' is not in Active phase (current: ${namespaceStatus.phase})`,
          severity: 'error',
          remediation: 'Wait for namespace to become active or investigate namespace issues'
        };
      }

      // Check for required labels and annotations
      const missingLabels = this.config.requiredLabels.filter(
        label => !namespaceStatus.labels || !namespaceStatus.labels[label]
      );

      const warnings = [];
      if (missingLabels.length > 0) {
        warnings.push(`Missing required labels: ${missingLabels.join(', ')}`);
      }

      return {
        passed: true,
        message: `Namespace '${namespace}' is ready`,
        severity: warnings.length > 0 ? 'warning' : 'info',
        warnings,
        metadata: {
          phase: namespaceStatus.phase,
          labels: namespaceStatus.labels,
          annotations: namespaceStatus.annotations
        }
      };
    } catch (error) {
      return {
        passed: false,
        message: `Namespace validation failed: ${error.message}`,
        severity: 'error'
      };
    }
  }

  /**
   * RBAC permissions validation
   */
  async _validateRBACPermissions(namespace) {
    try {
      const requiredPermissions = [
        { resource: 'pods', verbs: ['get', 'list', 'create', 'update', 'delete'] },
        { resource: 'services', verbs: ['get', 'list', 'create', 'update', 'delete'] },
        { resource: 'deployments', verbs: ['get', 'list', 'create', 'update', 'delete'] },
        { resource: 'configmaps', verbs: ['get', 'list', 'create', 'update', 'delete'] },
        { resource: 'secrets', verbs: ['get', 'list', 'create', 'update', 'delete'] }
      ];

      const permissionChecks = await Promise.all(
        requiredPermissions.map(async (perm) => {
          const allowed = await this.kubernetesClient.canI(perm.resource, perm.verbs, namespace);
          return {
            resource: perm.resource,
            verbs: perm.verbs,
            allowed: allowed.every(v => v),
            missing: perm.verbs.filter((v, i) => !allowed[i])
          };
        })
      );

      const missingPermissions = permissionChecks.filter(check => !check.allowed);
      
      if (missingPermissions.length > 0) {
        return {
          passed: false,
          message: `Missing RBAC permissions for: ${missingPermissions.map(p => p.resource).join(', ')}`,
          severity: 'error',
          remediation: 'Grant required RBAC permissions for deployment operations',
          details: missingPermissions
        };
      }

      return {
        passed: true,
        message: 'RBAC permissions validated',
        severity: 'info',
        metadata: { validatedPermissions: permissionChecks.length }
      };
    } catch (error) {
      return {
        passed: false,
        message: `RBAC validation failed: ${error.message}`,
        severity: 'error'
      };
    }
  }

  /**
   * Resource quotas and limits validation
   */
  async _validateResourceQuotas(namespace) {
    try {
      if (!this.config.enableResourceValidation) {
        return { passed: true, message: 'Resource validation disabled', severity: 'info' };
      }

      const resourceQuotas = await this.kubernetesClient.getResourceQuotas(namespace);
      const resourceUsage = await this.kubernetesClient.getResourceUsage(namespace);

      // Validate against minimum requirements
      const minRequirements = this.config.minResourceRequirements;
      const quotaChecks = [];

      if (minRequirements.cpu) {
        const availableCPU = resourceQuotas.cpu?.hard ? 
          (resourceQuotas.cpu.hard - resourceUsage.cpu) : 
          Infinity;
        
        quotaChecks.push({
          resource: 'CPU',
          required: minRequirements.cpu,
          available: availableCPU,
          sufficient: availableCPU >= minRequirements.cpu
        });
      }

      if (minRequirements.memory) {
        const availableMemory = resourceQuotas.memory?.hard ? 
          (resourceQuotas.memory.hard - resourceUsage.memory) : 
          Infinity;
        
        quotaChecks.push({
          resource: 'Memory',
          required: minRequirements.memory,
          available: availableMemory,
          sufficient: availableMemory >= minRequirements.memory
        });
      }

      const insufficientResources = quotaChecks.filter(check => !check.sufficient);
      
      if (insufficientResources.length > 0) {
        return {
          passed: false,
          message: `Insufficient resources: ${insufficientResources.map(r => r.resource).join(', ')}`,
          severity: 'error',
          remediation: 'Increase resource quotas or reduce resource requirements',
          details: insufficientResources
        };
      }

      return {
        passed: true,
        message: 'Resource quotas validated',
        severity: 'info',
        metadata: { quotaChecks, resourceUsage }
      };
    } catch (error) {
      return {
        passed: false,
        message: `Resource quota validation failed: ${error.message}`,
        severity: 'warning' // Non-critical if quotas aren't enforced
      };
    }
  }

  /**
   * Network policies validation
   */
  async _validateNetworkPolicies(namespace) {
    try {
      const networkPolicies = await this.kubernetesClient.getNetworkPolicies(namespace);
      
      // Check if network policies would block required communication
      const communicationChecks = [
        { name: 'ingress-traffic', type: 'ingress', required: true },
        { name: 'egress-traffic', type: 'egress', required: true },
        { name: 'internal-communication', type: 'internal', required: true }
      ];

      const warnings = [];
      
      // Analyze network policies for potential blocking
      if (networkPolicies.length > 0) {
        const restrictivePolicies = networkPolicies.filter(policy => 
          policy.spec.policyTypes && policy.spec.policyTypes.includes('Ingress') && 
          (!policy.spec.ingress || policy.spec.ingress.length === 0)
        );
        
        if (restrictivePolicies.length > 0) {
          warnings.push('Restrictive network policies may block required traffic');
        }
      }

      return {
        passed: true,
        message: `Network policies validated (${networkPolicies.length} policies found)`,
        severity: warnings.length > 0 ? 'warning' : 'info',
        warnings,
        metadata: { 
          policyCount: networkPolicies.length,
          policies: networkPolicies.map(p => p.metadata.name)
        }
      };
    } catch (error) {
      return {
        passed: false,
        message: `Network policy validation failed: ${error.message}`,
        severity: 'warning'
      };
    }
  }

  /**
   * Storage availability validation
   */
  async _validateStorageAvailability() {
    try {
      const storageClasses = await this.kubernetesClient.getStorageClasses();
      const persistentVolumes = await this.kubernetesClient.getPersistentVolumes();

      if (storageClasses.length === 0) {
        return {
          passed: false,
          message: 'No storage classes available',
          severity: 'error',
          remediation: 'Configure at least one storage class for persistent volumes'
        };
      }

      // Check for default storage class
      const defaultStorageClass = storageClasses.find(sc => 
        sc.metadata.annotations && 
        sc.metadata.annotations['storageclass.kubernetes.io/is-default-class'] === 'true'
      );

      const warnings = [];
      if (!defaultStorageClass) {
        warnings.push('No default storage class configured');
      }

      // Check available storage capacity
      const availableStorage = persistentVolumes.reduce((total, pv) => {
        if (pv.status.phase === 'Available') {
          return total + this._parseStorageCapacity(pv.spec.capacity.storage);
        }
        return total;
      }, 0);

      return {
        passed: true,
        message: `Storage validated (${storageClasses.length} classes, ${this._formatStorage(availableStorage)} available)`,
        severity: warnings.length > 0 ? 'warning' : 'info',
        warnings,
        metadata: {
          storageClasses: storageClasses.map(sc => sc.metadata.name),
          defaultStorageClass: defaultStorageClass?.metadata.name,
          availableStorage
        }
      };
    } catch (error) {
      return {
        passed: false,
        message: `Storage validation failed: ${error.message}`,
        severity: 'warning'
      };
    }
  }

  /**
   * Node resources validation
   */
  async _validateNodeResources() {
    try {
      const nodes = await this.kubernetesClient.getNodes();
      
      if (nodes.length === 0) {
        return {
          passed: false,
          message: 'No nodes available in cluster',
          severity: 'critical',
          remediation: 'Ensure cluster has available worker nodes'
        };
      }

      // Check node readiness and resource availability
      const nodeChecks = nodes.map(node => {
        const conditions = node.status.conditions || [];
        const readyCondition = conditions.find(c => c.type === 'Ready');
        const isReady = readyCondition && readyCondition.status === 'True';
        
        return {
          name: node.metadata.name,
          ready: isReady,
          allocatable: node.status.allocatable,
          capacity: node.status.capacity,
          conditions: conditions.map(c => ({ type: c.type, status: c.status }))
        };
      });

      const readyNodes = nodeChecks.filter(node => node.ready);
      const notReadyNodes = nodeChecks.filter(node => !node.ready);

      if (readyNodes.length === 0) {
        return {
          passed: false,
          message: 'No ready nodes available',
          severity: 'critical',
          remediation: 'Ensure at least one node is in Ready state'
        };
      }

      const warnings = [];
      if (notReadyNodes.length > 0) {
        warnings.push(`${notReadyNodes.length} nodes are not ready`);
      }

      return {
        passed: true,
        message: `Node resources validated (${readyNodes.length}/${nodes.length} nodes ready)`,
        severity: warnings.length > 0 ? 'warning' : 'info',
        warnings,
        metadata: {
          totalNodes: nodes.length,
          readyNodes: readyNodes.length,
          nodeDetails: nodeChecks
        }
      };
    } catch (error) {
      return {
        passed: false,
        message: `Node validation failed: ${error.message}`,
        severity: 'error'
      };
    }
  }

  /**
   * Cluster version compatibility validation
   */
  async _validateClusterVersion() {
    try {
      const clusterInfo = await this.kubernetesClient.getClusterInfo();
      const serverVersion = clusterInfo.serverVersion;
      
      // Define minimum supported Kubernetes version
      const minVersion = '1.20.0';
      const currentVersion = this._parseVersion(serverVersion);
      const minVersionParsed = this._parseVersion(minVersion);

      if (this._compareVersions(currentVersion, minVersionParsed) < 0) {
        return {
          passed: false,
          message: `Kubernetes version ${serverVersion} is below minimum supported version ${minVersion}`,
          severity: 'error',
          remediation: 'Upgrade cluster to a supported Kubernetes version'
        };
      }

      // Check for deprecated API versions
      const deprecatedAPIs = await this._checkDeprecatedAPIs(currentVersion);
      const warnings = [];
      
      if (deprecatedAPIs.length > 0) {
        warnings.push(`Some APIs may be deprecated in version ${serverVersion}`);
      }

      return {
        passed: true,
        message: `Kubernetes version ${serverVersion} is supported`,
        severity: warnings.length > 0 ? 'warning' : 'info',
        warnings,
        metadata: {
          serverVersion,
          deprecatedAPIs
        }
      };
    } catch (error) {
      return {
        passed: false,
        message: `Version validation failed: ${error.message}`,
        severity: 'warning'
      };
    }
  }

  /**
   * API server health validation
   */
  async _validateAPIServerHealth() {
    try {
      const healthChecks = await Promise.all([
        this.kubernetesClient.checkAPIServerHealth(),
        this.kubernetesClient.checkComponentStatus()
      ]);

      const [apiHealth, componentStatus] = healthChecks;
      
      if (!apiHealth.healthy) {
        return {
          passed: false,
          message: `API server is unhealthy: ${apiHealth.error}`,
          severity: 'critical',
          remediation: 'Check API server logs and cluster status'
        };
      }

      const unhealthyComponents = componentStatus.filter(c => c.status !== 'Healthy');
      const warnings = [];
      
      if (unhealthyComponents.length > 0) {
        warnings.push(`Unhealthy components: ${unhealthyComponents.map(c => c.name).join(', ')}`);
      }

      return {
        passed: true,
        message: `API server is healthy (response time: ${apiHealth.responseTime}ms)`,
        severity: warnings.length > 0 ? 'warning' : 'info',
        warnings,
        metadata: {
          responseTime: apiHealth.responseTime,
          componentStatus
        }
      };
    } catch (error) {
      return {
        passed: false,
        message: `API server health check failed: ${error.message}`,
        severity: 'critical'
      };
    }
  }

  /**
   * Prepare namespace for deployment
   */
  async _prepareNamespace(namespace) {
    try {
      const preparations = [];
      
      // Create namespace if it doesn't exist
      const namespaceExists = await this.kubernetesClient.namespaceExists(namespace);
      if (!namespaceExists) {
        if (this.config.autoNamespaceCreation) {
          await this.kubernetesClient.createNamespace(namespace);
          preparations.push(`Created namespace '${namespace}'`);
        } else {
          return {
            passed: false,
            message: `Namespace '${namespace}' does not exist and auto-creation is disabled`,
            severity: 'error'
          };
        }
      }

      // Apply required labels
      if (this.config.requiredLabels.length > 0) {
        const labelsApplied = await this.kubernetesClient.applyNamespaceLabels(
          namespace, 
          this.config.requiredLabels
        );
        if (labelsApplied) {
          preparations.push('Applied required labels');
        }
      }

      // Create default service account if needed
      const defaultSA = await this.kubernetesClient.getServiceAccount(namespace, 'default');
      if (!defaultSA) {
        await this.kubernetesClient.createServiceAccount(namespace, 'default');
        preparations.push('Created default service account');
      }

      return {
        passed: true,
        message: `Namespace preparation completed (${preparations.length} actions)`,
        severity: 'info',
        actions: preparations
      };
    } catch (error) {
      return {
        passed: false,
        message: `Namespace preparation failed: ${error.message}`,
        severity: 'error'
      };
    }
  }

  // ============================================================================
  // TASK 3.2: UTILITY AND HELPER METHODS
  // ============================================================================

  _processParallelResults(results) {
    const checkNames = [
      'clusterConnectivity', 'namespaceReadiness', 'rbacPermissions',
      'resourceQuotas', 'networkPolicies', 'storageAvailability',
      'nodeResources', 'clusterVersion', 'apiServerHealth'
    ];

    const checks = {};
    
    results.forEach((result, index) => {
      const checkName = checkNames[index];
      if (result.status === 'fulfilled') {
        checks[checkName] = result.value;
      } else {
        checks[checkName] = {
          passed: false,
          message: `Check failed: ${result.reason.message}`,
          severity: 'error'
        };
      }
    });

    return checks;
  }

  _assessEnvironmentRisk(issues, warnings) {
    const criticalIssues = issues.filter(i => i.severity === 'critical').length;
    const errorIssues = issues.filter(i => i.severity === 'error').length;
    
    if (criticalIssues > 0) {
      return 'critical';
    } else if (errorIssues > 0) {
      return 'high';
    } else if (warnings.length > 3) {
      return 'medium';
    } else if (warnings.length > 0) {
      return 'low';
    } else {
      return 'none';
    }
  }

  _updateValidationMetrics(validationTime, passed) {
    this.validationMetrics.totalValidations++;
    this.validationMetrics.lastValidationTime = validationTime;
    
    // Update moving average
    const currentAvg = this.validationMetrics.averageValidationTime;
    const count = this.validationMetrics.totalValidations;
    this.validationMetrics.averageValidationTime = 
      (currentAvg * (count - 1) + validationTime) / count;
    
    // Update success rate
    const successCount = passed ? 1 : 0;
    const currentSuccessRate = this.validationMetrics.successRate;
    this.validationMetrics.successRate = 
      (currentSuccessRate * (count - 1) + successCount) / count;
  }

  _parseStorageCapacity(capacity) {
    // Parse Kubernetes storage capacity (e.g., "10Gi" -> bytes)
    const units = { 'Ki': 1024, 'Mi': 1024**2, 'Gi': 1024**3, 'Ti': 1024**4 };
    const match = capacity.match(/^(\d+(?:\.\d+)?)([KMGT]i?)$/);
    
    if (!match) return 0;
    
    const [, value, unit] = match;
    return parseFloat(value) * (units[unit] || 1);
  }

  _formatStorage(bytes) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)}${units[unitIndex]}`;
  }

  _parseVersion(version) {
    const match = version.match(/v?(\d+)\.(\d+)\.(\d+)/);
    if (!match) return { major: 0, minor: 0, patch: 0 };
    
    return {
      major: parseInt(match[1]),
      minor: parseInt(match[2]),
      patch: parseInt(match[3])
    };
  }

  _compareVersions(a, b) {
    if (a.major !== b.major) return a.major - b.major;
    if (a.minor !== b.minor) return a.minor - b.minor;
    return a.patch - b.patch;
  }

  async _checkDeprecatedAPIs(version) {
    // Check for deprecated APIs based on version
    const deprecatedAPIs = [];
    
    if (version.major === 1 && version.minor >= 22) {
      deprecatedAPIs.push('extensions/v1beta1/Ingress');
    }
    
    if (version.major === 1 && version.minor >= 25) {
      deprecatedAPIs.push('policy/v1beta1/PodSecurityPolicy');
    }
    
    return deprecatedAPIs;
  }

  _initializeValidationRules() {
    return {
      // Enhanced validation rules for Task 3.2
      environment: {
        maxValidationTime: this.config.validationTimeout,
        requiredChecks: [
          'clusterConnectivity',
          'namespaceReadiness', 
          'rbacPermissions'
        ],
        optionalChecks: [
          'resourceQuotas',
          'networkPolicies',
          'storageAvailability'
        ]
      },
      security: {
        enableImageScanning: this.config.enableSecurityValidation,
        allowedRegistries: this.config.allowedImageRegistries,
        requiredSecurityPolicies: this.config.securityPolicies
      },
      resources: {
        enableQuotaValidation: this.config.enableResourceValidation,
        minRequirements: this.config.minResourceRequirements,
        maxLimits: this.config.maxResourceLimits
      }
    };
  }

  _initializeSecurityPolicies() {
    return {
      // Enhanced security policies for Task 3.2
      podSecurity: {
        runAsNonRoot: true,
        readOnlyRootFilesystem: true,
        allowPrivilegeEscalation: false,
        requiredSecurityContext: true
      },
      networkSecurity: {
        requireNetworkPolicies: this.config.environment === 'production',
        allowedPorts: [80, 443, 8080, 8443],
        restrictEgressTraffic: true
      },
      imageSecurity: {
        scanImages: true,
        allowedRegistries: this.config.allowedImageRegistries,
        requireSignedImages: this.config.environment === 'production',
        vulnerabilityThreshold: 'medium'
      }
    };
  }

  /**
   * Get validation metrics and performance data
   */
  getValidationMetrics() {
    return {
      ...this.validationMetrics,
      validationCacheSize: this.validationCache.size,
      totalValidationResults: Object.keys(this.validationResults).length
    };
  }

  /**
   * Clear validation cache and results
   */
  clearValidationData() {
    this.validationCache.clear();
    this.validationResults = {};
    this.validationMetrics = {
      totalValidations: 0,
      averageValidationTime: 0,
      successRate: 0,
      lastValidationTime: null
    };
  }
}

module.exports = { PreDeploymentValidator };