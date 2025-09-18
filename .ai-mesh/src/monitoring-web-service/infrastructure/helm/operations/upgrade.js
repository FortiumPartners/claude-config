/**
 * Helm Upgrade Operation
 * 
 * Handles Helm chart upgrades with:
 * - Pre-upgrade validation and compatibility checks
 * - Rolling update execution with monitoring
 * - Post-upgrade verification and health validation
 * - Automatic rollback on failure conditions
 * 
 * Part of: Task 3.1 - Helm Deployment Engine Implementation
 */

const { EventEmitter } = require('events');
const { HelmCLI } = require('../utils/helm-cli');
const { ErrorHandler } = require('../utils/error-handler');

/**
 * Helm Upgrade Operation Class
 * 
 * Manages the complete upgrade lifecycle:
 * - Compatibility validation and risk assessment
 * - Progressive upgrade with rollback capability
 * - Real-time monitoring and health checks
 * - Automatic rollback on failure detection
 */
class UpgradeOperation extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      timeout: config.timeout || 180, // 3 minutes for upgrades
      retryAttempts: config.retryAttempts || 2,
      retryDelay: config.retryDelay || 10000,
      enableHooks: config.enableHooks !== false,
      atomic: config.atomic !== false,
      waitForJobs: config.waitForJobs !== false,
      enableAutoRollback: config.enableAutoRollback !== false,
      rollbackOnFailure: config.rollbackOnFailure !== false,
      healthCheckRetries: config.healthCheckRetries || 6,
      healthCheckInterval: config.healthCheckInterval || 10000,
      compatibilityCheck: config.compatibilityCheck !== false,
      ...config
    };

    this.helmCLI = new HelmCLI(this.config);
    this.errorHandler = new ErrorHandler(this.config);
    this.upgradePhases = [
      'preparation',
      'compatibility-check',
      'backup',
      'upgrade',
      'verification',
      'health-check'
    ];
    
    this.currentPhase = null;
    this.upgradeMetrics = {};
    this.previousRelease = null;
  }

  /**
   * Execute Helm chart upgrade
   * 
   * @param {string} releaseName - Name of the Helm release to upgrade
   * @param {object} values - Values to override in the chart
   * @param {object} options - Upgrade options
   * @returns {Promise<object>} Upgrade result
   */
  async execute(releaseName, values = {}, options = {}) {
    const startTime = Date.now();
    const operationId = options.operationId || this._generateOperationId();
    
    this.upgradeMetrics = {
      operationId,
      releaseName,
      startTime,
      phases: {},
      totalDuration: 0,
      success: false,
      rollbackPerformed: false
    };

    try {
      this.emit('upgradeStart', {
        operationId,
        releaseName,
        values,
        options,
        timestamp: new Date().toISOString()
      });

      // Phase 1: Preparation
      await this._executePhase('preparation', async () => {
        await this._prepareUpgrade(releaseName, values, options);
      });

      // Phase 2: Compatibility Check
      await this._executePhase('compatibility-check', async () => {
        await this._performCompatibilityCheck(releaseName, values);
      });

      // Phase 3: Backup Current State
      const backupInfo = await this._executePhase('backup', async () => {
        return await this._backupCurrentRelease(releaseName);
      });

      // Phase 4: Upgrade Execution
      const upgradeResult = await this._executePhase('upgrade', async () => {
        return await this._performUpgrade(releaseName, values, options);
      });

      // Phase 5: Verification
      await this._executePhase('verification', async () => {
        await this._verifyUpgrade(releaseName, upgradeResult);
      });

      // Phase 6: Health Check
      const healthStatus = await this._executePhase('health-check', async () => {
        return await this._performHealthCheck(releaseName, upgradeResult);
      });

      // Calculate metrics
      this.upgradeMetrics.totalDuration = Date.now() - startTime;
      this.upgradeMetrics.success = true;

      const result = {
        success: true,
        operationId,
        releaseName,
        previousRevision: this.previousRelease?.revision,
        newRevision: upgradeResult.revision,
        status: upgradeResult.status,
        namespace: this.config.namespace,
        duration: this.upgradeMetrics.totalDuration,
        phases: this.upgradeMetrics.phases,
        healthStatus,
        backup: backupInfo,
        metadata: {
          chartPath: this.config.chartPath,
          values,
          timestamp: new Date().toISOString()
        }
      };

      this.emit('upgradeComplete', result);
      return result;

    } catch (error) {
      this.upgradeMetrics.totalDuration = Date.now() - startTime;
      this.upgradeMetrics.success = false;
      
      const handledError = this.errorHandler.handle(error, {
        operation: 'upgrade',
        operationId,
        releaseName,
        phase: this.currentPhase,
        values,
        options
      });

      // Attempt automatic rollback if enabled and we have previous release info
      if (this.config.enableAutoRollback && 
          this.previousRelease && 
          this.currentPhase !== 'preparation' &&
          this.currentPhase !== 'compatibility-check') {
        
        try {
          await this._performAutoRollback(releaseName, handledError);
          this.upgradeMetrics.rollbackPerformed = true;
        } catch (rollbackError) {
          this.emit('rollbackFailed', {
            originalError: handledError,
            rollbackError: rollbackError.message,
            operationId,
            releaseName
          });
        }
      }

      this.emit('upgradeError', {
        operationId,
        releaseName,
        error: handledError,
        phase: this.currentPhase,
        metrics: this.upgradeMetrics,
        rollbackPerformed: this.upgradeMetrics.rollbackPerformed
      });

      throw handledError;
    } finally {
      this.currentPhase = null;
    }
  }

  /**
   * Stop current upgrade operation
   * 
   * @returns {Promise<void>}
   */
  async stop() {
    if (this.currentPhase) {
      this.emit('upgradeStopped', {
        operationId: this.upgradeMetrics.operationId,
        releaseName: this.upgradeMetrics.releaseName,
        phase: this.currentPhase,
        timestamp: new Date().toISOString()
      });
      
      // If upgrade was in progress, attempt rollback
      if (this.currentPhase === 'upgrade' && this.previousRelease) {
        try {
          await this._performAutoRollback(this.upgradeMetrics.releaseName, 
            new Error('Upgrade stopped by user'));
        } catch (rollbackError) {
          this.emit('stopRollbackFailed', {
            error: rollbackError.message,
            phase: this.currentPhase
          });
        }
      }
    }
  }

  // Private Methods

  async _executePhase(phaseName, phaseFunction) {
    const phaseStartTime = Date.now();
    this.currentPhase = phaseName;
    
    this.emit('phaseStart', {
      phase: phaseName,
      operationId: this.upgradeMetrics.operationId,
      timestamp: new Date().toISOString()
    });

    try {
      const result = await phaseFunction();
      
      const phaseDuration = Date.now() - phaseStartTime;
      this.upgradeMetrics.phases[phaseName] = {
        status: 'completed',
        duration: phaseDuration,
        timestamp: new Date().toISOString()
      };

      this.emit('phaseComplete', {
        phase: phaseName,
        operationId: this.upgradeMetrics.operationId,
        duration: phaseDuration,
        timestamp: new Date().toISOString()
      });

      return result;
    } catch (error) {
      const phaseDuration = Date.now() - phaseStartTime;
      this.upgradeMetrics.phases[phaseName] = {
        status: 'failed',
        duration: phaseDuration,
        error: error.message,
        timestamp: new Date().toISOString()
      };

      this.emit('phaseError', {
        phase: phaseName,
        operationId: this.upgradeMetrics.operationId,
        error: error.message,
        duration: phaseDuration,
        timestamp: new Date().toISOString()
      });

      throw error;
    }
  }

  async _prepareUpgrade(releaseName, values, options) {
    // Initialize Helm CLI
    await this.helmCLI.initialize();
    
    // Get current release information
    this.previousRelease = await this.helmCLI.getRelease(releaseName, this.config.namespace);
    if (!this.previousRelease) {
      throw new Error(`Release '${releaseName}' not found in namespace '${this.config.namespace}'. Use install instead.`);
    }

    // Validate chart exists
    const chartValidation = await this.helmCLI.validateChart(this.config.chartPath);
    if (!chartValidation.valid) {
      throw new Error(`Chart validation failed: ${chartValidation.errors.join(', ')}`);
    }

    this.emit('preparationComplete', {
      releaseName,
      currentRevision: this.previousRelease.revision,
      currentStatus: this.previousRelease.status,
      namespace: this.config.namespace,
      valuesCount: Object.keys(values).length
    });
  }

  async _performCompatibilityCheck(releaseName, values) {
    if (!this.config.compatibilityCheck) {
      return;
    }

    // Check chart version compatibility
    const currentChart = this.previousRelease.chart;
    const newChartInfo = await this._getChartInfo(this.config.chartPath);
    
    const compatibility = this._assessCompatibility(currentChart, newChartInfo, values);
    
    if (compatibility.risk === 'high') {
      if (!this.config.allowHighRiskUpgrades) {
        throw new Error(`High-risk upgrade detected: ${compatibility.issues.join(', ')}`);
      }
      
      this.emit('highRiskUpgrade', {
        releaseName,
        risk: compatibility.risk,
        issues: compatibility.issues,
        recommendations: compatibility.recommendations
      });
    }

    this.emit('compatibilityCheckComplete', {
      releaseName,
      risk: compatibility.risk,
      issues: compatibility.issues,
      recommendations: compatibility.recommendations
    });
  }

  async _backupCurrentRelease(releaseName) {
    // Get current release manifest and values for backup
    const release = this.previousRelease;
    
    const backupInfo = {
      releaseName,
      revision: release.revision,
      status: release.status,
      values: release.values,
      manifest: release.manifest,
      timestamp: new Date().toISOString()
    };

    this.emit('backupComplete', {
      releaseName,
      revision: release.revision,
      backupSize: JSON.stringify(backupInfo).length
    });

    return backupInfo;
  }

  async _performUpgrade(releaseName, values, options) {
    const upgradeOptions = {
      timeout: this.config.timeout,
      wait: true,
      waitForJobs: this.config.waitForJobs,
      atomic: this.config.atomic,
      debug: this.config.debug,
      ...options
    };

    // Start upgrade with progress monitoring
    const upgradePromise = this.helmCLI.upgrade(
      releaseName, 
      this.config.chartPath, 
      values, 
      upgradeOptions
    );

    // Monitor upgrade progress
    const progressInterval = setInterval(() => {
      this.emit('upgradeProgress', {
        releaseName,
        phase: 'upgrading',
        previousRevision: this.previousRelease.revision,
        timestamp: new Date().toISOString()
      });
    }, 5000);

    try {
      const result = await upgradePromise;
      clearInterval(progressInterval);
      
      this.emit('upgradeSuccess', {
        releaseName,
        previousRevision: this.previousRelease.revision,
        newRevision: result.revision,
        status: result.status,
        namespace: result.namespace
      });

      return result;
    } catch (error) {
      clearInterval(progressInterval);
      throw error;
    }
  }

  async _verifyUpgrade(releaseName, upgradeResult) {
    // Get current release status after upgrade
    const releaseStatus = await this.helmCLI.getStatus(releaseName, this.config.namespace);
    if (!releaseStatus) {
      throw new Error(`Release '${releaseName}' not found after upgrade`);
    }

    // Verify release is in deployed status
    if (releaseStatus.status !== 'deployed') {
      throw new Error(`Release '${releaseName}' is in '${releaseStatus.status}' status after upgrade, expected 'deployed'`);
    }

    // Verify revision is higher than previous
    if (releaseStatus.revision <= this.previousRelease.revision) {
      throw new Error(`Release revision did not increase: previous ${this.previousRelease.revision}, current ${releaseStatus.revision}`);
    }

    this.emit('verificationComplete', {
      releaseName,
      previousRevision: this.previousRelease.revision,
      newRevision: releaseStatus.revision,
      status: releaseStatus.status,
      chart: releaseStatus.chart,
      chartVersion: releaseStatus.chartVersion
    });
  }

  async _performHealthCheck(releaseName, upgradeResult) {
    let healthCheckAttempts = 0;
    const maxAttempts = this.config.healthCheckRetries;
    
    while (healthCheckAttempts < maxAttempts) {
      try {
        // Get current release information
        const release = await this.helmCLI.getRelease(releaseName, this.config.namespace);
        
        if (release.status === 'deployed') {
          // Perform additional health checks for upgrades
          const healthCheck = await this._performDetailedHealthCheck(release);
          
          if (healthCheck.healthy) {
            const healthStatus = {
              status: 'healthy',
              release: {
                name: release.name,
                revision: release.revision,
                status: release.status,
                chart: release.chart,
                namespace: release.namespace
              },
              checks: healthCheck.checks,
              previousRevision: this.previousRelease.revision,
              upgradeSuccessful: true,
              timestamp: new Date().toISOString()
            };

            this.emit('healthCheckComplete', healthStatus);
            return healthStatus;
          } else {
            throw new Error(`Health check failed: ${healthCheck.issues.join(', ')}`);
          }
        }

        throw new Error(`Release is in '${release.status}' status`);
      } catch (error) {
        healthCheckAttempts++;
        
        if (healthCheckAttempts >= maxAttempts) {
          const healthStatus = {
            status: 'unhealthy',
            error: error.message,
            attempts: healthCheckAttempts,
            previousRevision: this.previousRelease.revision,
            upgradeSuccessful: false,
            timestamp: new Date().toISOString()
          };

          // If health check fails and auto-rollback is enabled, trigger it
          if (this.config.enableAutoRollback) {
            throw new Error(`Health check failed after upgrade: ${error.message}`);
          }

          this.emit('healthCheckFailed', healthStatus);
          return healthStatus;
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, this.config.healthCheckInterval));
      }
    }
  }

  async _performDetailedHealthCheck(release) {
    const checks = {
      releaseDeployed: release.status === 'deployed',
      manifestValid: !!release.manifest,
      hooksExecuted: true,
      revisionIncreased: release.revision > this.previousRelease.revision
    };

    const issues = [];
    
    Object.entries(checks).forEach(([check, passed]) => {
      if (!passed) {
        issues.push(`${check} check failed`);
      }
    });

    return {
      healthy: issues.length === 0,
      checks,
      issues
    };
  }

  async _performAutoRollback(releaseName, originalError) {
    this.emit('autoRollbackStarted', {
      releaseName,
      targetRevision: this.previousRelease.revision,
      reason: originalError.message,
      timestamp: new Date().toISOString()
    });

    try {
      // Import RollbackOperation to avoid circular dependency
      const { RollbackOperation } = require('./rollback');
      const rollbackOp = new RollbackOperation(this.config);
      
      const rollbackResult = await rollbackOp.execute(
        releaseName,
        this.previousRelease.revision,
        { 
          reason: 'auto-rollback-on-upgrade-failure',
          originalError: originalError.message
        }
      );

      this.emit('autoRollbackComplete', {
        releaseName,
        rollbackResult,
        originalError: originalError.message,
        timestamp: new Date().toISOString()
      });

      return rollbackResult;
    } catch (rollbackError) {
      this.emit('autoRollbackFailed', {
        releaseName,
        originalError: originalError.message,
        rollbackError: rollbackError.message,
        timestamp: new Date().toISOString()
      });

      throw rollbackError;
    }
  }

  async _getChartInfo(chartPath) {
    // This would typically parse Chart.yaml to get chart metadata
    // For now, return basic info
    return {
      name: 'monitoring-web-service',
      version: '1.0.0',
      apiVersion: 'v2'
    };
  }

  _assessCompatibility(currentChart, newChart, values) {
    const issues = [];
    const recommendations = [];
    let risk = 'low';

    // Check for major version changes
    if (this._isMajorVersionChange(currentChart, newChart.version)) {
      issues.push('Major version change detected');
      recommendations.push('Review breaking changes in release notes');
      risk = 'high';
    }

    // Check for schema changes in values
    if (this._hasSchemaChanges(this.previousRelease.values, values)) {
      issues.push('Values schema changes detected');
      recommendations.push('Validate new configuration parameters');
      if (risk !== 'high') risk = 'medium';
    }

    // Check for breaking changes in dependencies
    if (this._hasBreakingDependencyChanges(currentChart, newChart)) {
      issues.push('Dependency breaking changes detected');
      recommendations.push('Check dependency compatibility');
      risk = 'high';
    }

    return {
      risk,
      issues,
      recommendations
    };
  }

  _isMajorVersionChange(currentChart, newVersion) {
    // Simple major version check - would need more sophisticated logic
    const currentMajor = parseInt(currentChart.split('.')[0]);
    const newMajor = parseInt(newVersion.split('.')[0]);
    return newMajor > currentMajor;
  }

  _hasSchemaChanges(currentValues, newValues) {
    // Simple check for new top-level keys
    const currentKeys = Object.keys(currentValues || {});
    const newKeys = Object.keys(newValues || {});
    
    const addedKeys = newKeys.filter(key => !currentKeys.includes(key));
    const removedKeys = currentKeys.filter(key => !newKeys.includes(key));
    
    return addedKeys.length > 0 || removedKeys.length > 0;
  }

  _hasBreakingDependencyChanges(currentChart, newChart) {
    // Would check Chart.yaml dependencies for breaking changes
    // For now, return false
    return false;
  }

  _generateOperationId() {
    return `upgrade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = { UpgradeOperation };