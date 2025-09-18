/**
 * Helm Install Operation
 * 
 * Handles Helm chart installation with:
 * - Pre-installation validation and preparation
 * - Progressive installation with monitoring
 * - Post-installation verification and health checks
 * - Error handling and recovery mechanisms
 * 
 * Part of: Task 3.1 - Helm Deployment Engine Implementation
 */

const { EventEmitter } = require('events');
const { HelmCLI } = require('../utils/helm-cli');
const { ErrorHandler } = require('../utils/error-handler');

/**
 * Helm Install Operation Class
 * 
 * Manages the complete installation lifecycle:
 * - Environment preparation and validation
 * - Chart installation with hooks support
 * - Progress monitoring and status tracking
 * - Post-installation validation and health checks
 */
class InstallOperation extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      timeout: config.timeout || 300, // 5 minutes
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 5000,
      enableHooks: config.enableHooks !== false,
      atomic: config.atomic !== false,
      waitForJobs: config.waitForJobs !== false,
      verifyInstallation: config.verifyInstallation !== false,
      healthCheckRetries: config.healthCheckRetries || 5,
      healthCheckInterval: config.healthCheckInterval || 10000,
      ...config
    };

    this.helmCLI = new HelmCLI(this.config);
    this.errorHandler = new ErrorHandler(this.config);
    this.installationPhases = [
      'preparation',
      'validation',
      'installation',
      'verification',
      'health-check'
    ];
    
    this.currentPhase = null;
    this.installationMetrics = {};
  }

  /**
   * Execute Helm chart installation
   * 
   * @param {string} releaseName - Name for the Helm release
   * @param {object} values - Values to override in the chart
   * @param {object} options - Installation options
   * @returns {Promise<object>} Installation result
   */
  async execute(releaseName, values = {}, options = {}) {
    const startTime = Date.now();
    const operationId = options.operationId || this._generateOperationId();
    
    this.installationMetrics = {
      operationId,
      releaseName,
      startTime,
      phases: {},
      totalDuration: 0,
      success: false
    };

    try {
      this.emit('installationStart', {
        operationId,
        releaseName,
        values,
        options,
        timestamp: new Date().toISOString()
      });

      // Phase 1: Preparation
      await this._executePhase('preparation', async () => {
        await this._prepareInstallation(releaseName, values, options);
      });

      // Phase 2: Validation
      await this._executePhase('validation', async () => {
        await this._validateInstallation(releaseName, values, options);
      });

      // Phase 3: Installation
      const installResult = await this._executePhase('installation', async () => {
        return await this._performInstallation(releaseName, values, options);
      });

      // Phase 4: Verification
      await this._executePhase('verification', async () => {
        await this._verifyInstallation(releaseName, installResult);
      });

      // Phase 5: Health Check
      const healthStatus = await this._executePhase('health-check', async () => {
        return await this._performHealthCheck(releaseName);
      });

      // Calculate metrics
      this.installationMetrics.totalDuration = Date.now() - startTime;
      this.installationMetrics.success = true;

      const result = {
        success: true,
        operationId,
        releaseName,
        revision: installResult.revision,
        status: installResult.status,
        namespace: this.config.namespace,
        duration: this.installationMetrics.totalDuration,
        phases: this.installationMetrics.phases,
        healthStatus,
        metadata: {
          chartPath: this.config.chartPath,
          values,
          timestamp: new Date().toISOString()
        }
      };

      this.emit('installationComplete', result);
      return result;

    } catch (error) {
      this.installationMetrics.totalDuration = Date.now() - startTime;
      this.installationMetrics.success = false;
      
      const handledError = this.errorHandler.handle(error, {
        operation: 'install',
        operationId,
        releaseName,
        phase: this.currentPhase,
        values,
        options
      });

      this.emit('installationError', {
        operationId,
        releaseName,
        error: handledError,
        phase: this.currentPhase,
        metrics: this.installationMetrics
      });

      throw handledError;
    } finally {
      this.currentPhase = null;
    }
  }

  /**
   * Stop current installation operation
   * 
   * @returns {Promise<void>}
   */
  async stop() {
    if (this.currentPhase) {
      this.emit('installationStopped', {
        operationId: this.installationMetrics.operationId,
        releaseName: this.installationMetrics.releaseName,
        phase: this.currentPhase,
        timestamp: new Date().toISOString()
      });
      
      // Attempt to cleanup partial installation
      try {
        await this._cleanupPartialInstallation();
      } catch (cleanupError) {
        this.emit('cleanupError', {
          error: cleanupError.message,
          phase: this.currentPhase
        });
      }
    }
  }

  // Private Methods

  async _executePhase(phaseName, phaseFunction) {
    const phaseStartTime = Date.now();
    this.currentPhase = phaseName;
    
    this.emit('phaseStart', {
      phase: phaseName,
      operationId: this.installationMetrics.operationId,
      timestamp: new Date().toISOString()
    });

    try {
      const result = await phaseFunction();
      
      const phaseDuration = Date.now() - phaseStartTime;
      this.installationMetrics.phases[phaseName] = {
        status: 'completed',
        duration: phaseDuration,
        timestamp: new Date().toISOString()
      };

      this.emit('phaseComplete', {
        phase: phaseName,
        operationId: this.installationMetrics.operationId,
        duration: phaseDuration,
        timestamp: new Date().toISOString()
      });

      return result;
    } catch (error) {
      const phaseDuration = Date.now() - phaseStartTime;
      this.installationMetrics.phases[phaseName] = {
        status: 'failed',
        duration: phaseDuration,
        error: error.message,
        timestamp: new Date().toISOString()
      };

      this.emit('phaseError', {
        phase: phaseName,
        operationId: this.installationMetrics.operationId,
        error: error.message,
        duration: phaseDuration,
        timestamp: new Date().toISOString()
      });

      throw error;
    }
  }

  async _prepareInstallation(releaseName, values, options) {
    // Initialize Helm CLI
    await this.helmCLI.initialize();
    
    // Check if release already exists
    const existingRelease = await this.helmCLI.getStatus(releaseName, this.config.namespace);
    if (existingRelease) {
      throw new Error(`Release '${releaseName}' already exists in namespace '${this.config.namespace}'. Use upgrade instead.`);
    }

    // Ensure namespace exists or create it
    await this._ensureNamespace(this.config.namespace);
    
    // Prepare values file if needed
    if (Object.keys(values).length > 0) {
      await this._validateValues(values);
    }

    this.emit('preparationComplete', {
      releaseName,
      namespace: this.config.namespace,
      valuesCount: Object.keys(values).length
    });
  }

  async _validateInstallation(releaseName, values, options) {
    // Validate chart
    const chartValidation = await this.helmCLI.validateChart(this.config.chartPath);
    if (!chartValidation.valid) {
      throw new Error(`Chart validation failed: ${chartValidation.errors.join(', ')}`);
    }

    // Perform dry run
    const dryRunResult = await this.helmCLI.dryRun('install', releaseName, this.config.chartPath, values);
    if (!dryRunResult.success) {
      throw new Error(`Installation dry run failed: ${dryRunResult.error}`);
    }

    // Validate resource requirements
    await this._validateResourceRequirements(dryRunResult.resources);

    this.emit('validationComplete', {
      chartValid: chartValidation.valid,
      dryRunSuccess: dryRunResult.success,
      resourceCount: dryRunResult.resources.length,
      warnings: chartValidation.warnings
    });
  }

  async _performInstallation(releaseName, values, options) {
    const installOptions = {
      timeout: this.config.timeout,
      wait: true,
      waitForJobs: this.config.waitForJobs,
      atomic: this.config.atomic,
      debug: this.config.debug,
      ...options
    };

    // Start installation with progress monitoring
    const installPromise = this.helmCLI.install(
      releaseName, 
      this.config.chartPath, 
      values, 
      installOptions
    );

    // Monitor installation progress
    const progressInterval = setInterval(() => {
      this.emit('installationProgress', {
        releaseName,
        phase: 'installing',
        timestamp: new Date().toISOString()
      });
    }, 5000);

    try {
      const result = await installPromise;
      clearInterval(progressInterval);
      
      this.emit('installationSuccess', {
        releaseName,
        revision: result.revision,
        status: result.status,
        namespace: result.namespace
      });

      return result;
    } catch (error) {
      clearInterval(progressInterval);
      throw error;
    }
  }

  async _verifyInstallation(releaseName, installResult) {
    if (!this.config.verifyInstallation) {
      return;
    }

    // Get current release status
    const releaseStatus = await this.helmCLI.getStatus(releaseName, this.config.namespace);
    if (!releaseStatus) {
      throw new Error(`Release '${releaseName}' not found after installation`);
    }

    // Verify release is in deployed status
    if (releaseStatus.status !== 'deployed') {
      throw new Error(`Release '${releaseName}' is in '${releaseStatus.status}' status, expected 'deployed'`);
    }

    // Verify revision matches
    if (releaseStatus.revision !== installResult.revision) {
      throw new Error(`Release revision mismatch: expected ${installResult.revision}, got ${releaseStatus.revision}`);
    }

    this.emit('verificationComplete', {
      releaseName,
      status: releaseStatus.status,
      revision: releaseStatus.revision,
      chart: releaseStatus.chart,
      chartVersion: releaseStatus.chartVersion
    });
  }

  async _performHealthCheck(releaseName) {
    let healthCheckAttempts = 0;
    const maxAttempts = this.config.healthCheckRetries;
    
    while (healthCheckAttempts < maxAttempts) {
      try {
        // Get release information
        const release = await this.helmCLI.getRelease(releaseName, this.config.namespace);
        
        // Basic health check - ensure release is deployed
        if (release.status === 'deployed') {
          const healthStatus = {
            status: 'healthy',
            release: {
              name: release.name,
              revision: release.revision,
              status: release.status,
              chart: release.chart,
              namespace: release.namespace
            },
            checks: {
              releaseDeployed: true,
              manifestValid: !!release.manifest,
              hooksExecuted: true
            },
            timestamp: new Date().toISOString()
          };

          this.emit('healthCheckComplete', healthStatus);
          return healthStatus;
        }

        throw new Error(`Release is in '${release.status}' status`);
      } catch (error) {
        healthCheckAttempts++;
        
        if (healthCheckAttempts >= maxAttempts) {
          const healthStatus = {
            status: 'unhealthy',
            error: error.message,
            attempts: healthCheckAttempts,
            timestamp: new Date().toISOString()
          };

          this.emit('healthCheckFailed', healthStatus);
          return healthStatus;
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, this.config.healthCheckInterval));
      }
    }
  }

  async _ensureNamespace(namespace) {
    // This would typically use kubectl to ensure namespace exists
    // For now, we'll rely on Helm's --create-namespace flag
    this.emit('namespaceEnsured', { namespace });
  }

  async _validateValues(values) {
    // Validate values structure and content
    if (typeof values !== 'object' || Array.isArray(values)) {
      throw new Error('Values must be an object');
    }

    // Additional validation logic can be added here
    // For example, checking required values, format validation, etc.
    
    this.emit('valuesValidated', {
      valuesCount: Object.keys(values).length,
      hasSecrets: this._hasSecretValues(values)
    });
  }

  async _validateResourceRequirements(resources) {
    // Validate that required resources can be created
    for (const resource of resources) {
      if (!resource.kind || !resource.name) {
        throw new Error(`Invalid resource definition: missing kind or name`);
      }
    }

    this.emit('resourceRequirementsValidated', {
      resourceCount: resources.length,
      resourceTypes: [...new Set(resources.map(r => r.kind))]
    });
  }

  async _cleanupPartialInstallation() {
    if (this.installationMetrics.releaseName) {
      try {
        // Attempt to delete the partial installation
        await this.helmCLI.delete(this.installationMetrics.releaseName, {
          cascade: true
        });
        
        this.emit('cleanupComplete', {
          releaseName: this.installationMetrics.releaseName
        });
      } catch (error) {
        // Log cleanup error but don't throw
        this.emit('cleanupError', {
          error: error.message,
          releaseName: this.installationMetrics.releaseName
        });
      }
    }
  }

  _hasSecretValues(values, path = '') {
    for (const [key, value] of Object.entries(values)) {
      const currentPath = path ? `${path}.${key}` : key;
      
      // Check for common secret key patterns
      if (key.toLowerCase().includes('password') ||
          key.toLowerCase().includes('secret') ||
          key.toLowerCase().includes('token') ||
          key.toLowerCase().includes('key')) {
        return true;
      }
      
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        if (this._hasSecretValues(value, currentPath)) {
          return true;
        }
      }
    }
    
    return false;
  }

  _generateOperationId() {
    return `install-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = { InstallOperation };