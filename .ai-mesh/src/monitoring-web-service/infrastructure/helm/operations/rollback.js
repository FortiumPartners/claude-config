/**
 * Helm Rollback Operation
 * 
 * Handles Helm release rollbacks with:
 * - Target revision validation and safety checks
 * - Fast rollback execution with minimal downtime
 * - Post-rollback verification and health validation
 * - State preservation and audit logging
 * 
 * Part of: Task 3.1 - Helm Deployment Engine Implementation
 */

const { EventEmitter } = require('events');
const { HelmCLI } = require('../utils/helm-cli');
const { ErrorHandler } = require('../utils/error-handler');

/**
 * Helm Rollback Operation Class
 * 
 * Manages the complete rollback lifecycle:
 * - Target revision validation and history analysis
 * - Fast rollback execution with monitoring
 * - Post-rollback verification and state validation
 * - Comprehensive audit trail and reporting
 */
class RollbackOperation extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      timeout: config.timeout || 60, // 1 minute for rollbacks (fast)
      retryAttempts: config.retryAttempts || 2,
      retryDelay: config.retryDelay || 3000,
      enableHooks: config.enableHooks !== false,
      waitForJobs: config.waitForJobs !== false,
      verifyRollback: config.verifyRollback !== false,
      healthCheckRetries: config.healthCheckRetries || 5,
      healthCheckInterval: config.healthCheckInterval || 5000,
      preserveState: config.preserveState !== false,
      auditRollback: config.auditRollback !== false,
      ...config
    };

    this.helmCLI = new HelmCLI(this.config);
    this.errorHandler = new ErrorHandler(this.config);
    this.rollbackPhases = [
      'preparation',
      'validation',
      'state-backup',
      'rollback',
      'verification',
      'health-check'
    ];
    
    this.currentPhase = null;
    this.rollbackMetrics = {};
    this.currentRelease = null;
    this.targetRevision = null;
  }

  /**
   * Execute Helm release rollback
   * 
   * @param {string} releaseName - Name of the Helm release to rollback
   * @param {number} revision - Target revision (optional, defaults to previous)
   * @param {object} options - Rollback options
   * @returns {Promise<object>} Rollback result
   */
  async execute(releaseName, revision = null, options = {}) {
    const startTime = Date.now();
    const operationId = options.operationId || this._generateOperationId();
    
    this.rollbackMetrics = {
      operationId,
      releaseName,
      targetRevision: revision,
      startTime,
      phases: {},
      totalDuration: 0,
      success: false,
      reason: options.reason || 'manual-rollback'
    };

    try {
      this.emit('rollbackStart', {
        operationId,
        releaseName,
        targetRevision: revision,
        reason: this.rollbackMetrics.reason,
        options,
        timestamp: new Date().toISOString()
      });

      // Phase 1: Preparation
      await this._executePhase('preparation', async () => {
        await this._prepareRollback(releaseName, revision, options);
      });

      // Phase 2: Validation
      await this._executePhase('validation', async () => {
        await this._validateRollback(releaseName, this.targetRevision);
      });

      // Phase 3: State Backup
      const stateBackup = await this._executePhase('state-backup', async () => {
        return await this._backupCurrentState(releaseName);
      });

      // Phase 4: Rollback Execution
      const rollbackResult = await this._executePhase('rollback', async () => {
        return await this._performRollback(releaseName, this.targetRevision, options);
      });

      // Phase 5: Verification
      await this._executePhase('verification', async () => {
        await this._verifyRollback(releaseName, rollbackResult);
      });

      // Phase 6: Health Check
      const healthStatus = await this._executePhase('health-check', async () => {
        return await this._performHealthCheck(releaseName);
      });

      // Calculate metrics
      this.rollbackMetrics.totalDuration = Date.now() - startTime;
      this.rollbackMetrics.success = true;

      const result = {
        success: true,
        operationId,
        releaseName,
        fromRevision: this.currentRelease.revision,
        toRevision: this.targetRevision,
        currentRevision: rollbackResult.currentRevision,
        status: rollbackResult.status || 'deployed',
        namespace: this.config.namespace,
        duration: this.rollbackMetrics.totalDuration,
        phases: this.rollbackMetrics.phases,
        healthStatus,
        stateBackup,
        reason: this.rollbackMetrics.reason,
        metadata: {
          timestamp: new Date().toISOString(),
          rollbackType: revision ? 'targeted' : 'previous'
        }
      };

      this.emit('rollbackComplete', result);
      
      // Audit rollback if enabled
      if (this.config.auditRollback) {
        await this._auditRollback(result);
      }

      return result;

    } catch (error) {
      this.rollbackMetrics.totalDuration = Date.now() - startTime;
      this.rollbackMetrics.success = false;
      
      const handledError = this.errorHandler.handle(error, {
        operation: 'rollback',
        operationId,
        releaseName,
        targetRevision: this.targetRevision,
        phase: this.currentPhase,
        options
      });

      this.emit('rollbackError', {
        operationId,
        releaseName,
        error: handledError,
        phase: this.currentPhase,
        metrics: this.rollbackMetrics
      });

      throw handledError;
    } finally {
      this.currentPhase = null;
    }
  }

  /**
   * Stop current rollback operation
   * 
   * @returns {Promise<void>}
   */
  async stop() {
    if (this.currentPhase) {
      this.emit('rollbackStopped', {
        operationId: this.rollbackMetrics.operationId,
        releaseName: this.rollbackMetrics.releaseName,
        phase: this.currentPhase,
        timestamp: new Date().toISOString()
      });
      
      // Rollback operations should not be stopped mid-execution for safety
      if (this.currentPhase === 'rollback') {
        this.emit('rollbackStopDenied', {
          reason: 'Cannot stop rollback mid-execution for safety',
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
      operationId: this.rollbackMetrics.operationId,
      timestamp: new Date().toISOString()
    });

    try {
      const result = await phaseFunction();
      
      const phaseDuration = Date.now() - phaseStartTime;
      this.rollbackMetrics.phases[phaseName] = {
        status: 'completed',
        duration: phaseDuration,
        timestamp: new Date().toISOString()
      };

      this.emit('phaseComplete', {
        phase: phaseName,
        operationId: this.rollbackMetrics.operationId,
        duration: phaseDuration,
        timestamp: new Date().toISOString()
      });

      return result;
    } catch (error) {
      const phaseDuration = Date.now() - phaseStartTime;
      this.rollbackMetrics.phases[phaseName] = {
        status: 'failed',
        duration: phaseDuration,
        error: error.message,
        timestamp: new Date().toISOString()
      };

      this.emit('phaseError', {
        phase: phaseName,
        operationId: this.rollbackMetrics.operationId,
        error: error.message,
        duration: phaseDuration,
        timestamp: new Date().toISOString()
      });

      throw error;
    }
  }

  async _prepareRollback(releaseName, revision, options) {
    // Initialize Helm CLI
    await this.helmCLI.initialize();
    
    // Get current release information
    this.currentRelease = await this.helmCLI.getRelease(releaseName, this.config.namespace);
    if (!this.currentRelease) {
      throw new Error(`Release '${releaseName}' not found in namespace '${this.config.namespace}'`);
    }

    // Get release history to determine target revision
    const history = await this.helmCLI.getHistory(releaseName, this.config.namespace);
    if (!history || history.length === 0) {
      throw new Error(`No history found for release '${releaseName}'`);
    }

    // Determine target revision
    if (revision) {
      // Validate specified revision exists
      const targetRevisionInfo = history.find(h => h.revision === revision);
      if (!targetRevisionInfo) {
        throw new Error(`Revision ${revision} not found in release history`);
      }
      this.targetRevision = revision;
    } else {
      // Find previous successful revision
      const sortedHistory = history
        .filter(h => h.status === 'deployed' && h.revision < this.currentRelease.revision)
        .sort((a, b) => b.revision - a.revision);
      
      if (sortedHistory.length === 0) {
        throw new Error(`No previous successful revision found for rollback`);
      }
      
      this.targetRevision = sortedHistory[0].revision;
    }

    this.emit('preparationComplete', {
      releaseName,
      currentRevision: this.currentRelease.revision,
      targetRevision: this.targetRevision,
      historyLength: history.length,
      namespace: this.config.namespace
    });
  }

  async _validateRollback(releaseName, targetRevision) {
    // Validate current release is not already at target revision
    if (this.currentRelease.revision === targetRevision) {
      throw new Error(`Release is already at revision ${targetRevision}`);
    }

    // Validate target revision is older than current
    if (targetRevision > this.currentRelease.revision) {
      throw new Error(`Cannot rollback to a newer revision (${targetRevision} > ${this.currentRelease.revision})`);
    }

    // Get target revision details
    const history = await this.helmCLI.getHistory(releaseName, this.config.namespace);
    const targetRevisionInfo = history.find(h => h.revision === targetRevision);
    
    if (!targetRevisionInfo) {
      throw new Error(`Target revision ${targetRevision} not found in history`);
    }

    // Validate target revision was successful
    if (targetRevisionInfo.status !== 'deployed') {
      const proceed = this.config.allowRollbackToFailed || false;
      if (!proceed) {
        throw new Error(`Target revision ${targetRevision} was not successful (status: ${targetRevisionInfo.status})`);
      }
      
      this.emit('rollbackToFailedRevision', {
        releaseName,
        targetRevision,
        targetStatus: targetRevisionInfo.status,
        warning: 'Rolling back to a revision that was not successfully deployed'
      });
    }

    this.emit('validationComplete', {
      releaseName,
      currentRevision: this.currentRelease.revision,
      targetRevision,
      targetStatus: targetRevisionInfo.status,
      targetChart: targetRevisionInfo.chart,
      revisionAge: this.currentRelease.revision - targetRevision
    });
  }

  async _backupCurrentState(releaseName) {
    if (!this.config.preserveState) {
      return null;
    }

    // Create backup of current state before rollback
    const stateBackup = {
      releaseName,
      revision: this.currentRelease.revision,
      status: this.currentRelease.status,
      values: this.currentRelease.values,
      manifest: this.currentRelease.manifest,
      timestamp: new Date().toISOString(),
      reason: 'pre-rollback-backup'
    };

    this.emit('stateBackupComplete', {
      releaseName,
      revision: this.currentRelease.revision,
      backupSize: JSON.stringify(stateBackup).length
    });

    return stateBackup;
  }

  async _performRollback(releaseName, targetRevision, options) {
    const rollbackOptions = {
      timeout: this.config.timeout,
      wait: true,
      waitForJobs: this.config.waitForJobs,
      debug: this.config.debug,
      ...options
    };

    // Start rollback with progress monitoring
    const rollbackPromise = this.helmCLI.rollback(
      releaseName,
      targetRevision,
      rollbackOptions
    );

    // Monitor rollback progress (faster than installs/upgrades)
    const progressInterval = setInterval(() => {
      this.emit('rollbackProgress', {
        releaseName,
        phase: 'rolling-back',
        fromRevision: this.currentRelease.revision,
        toRevision: targetRevision,
        timestamp: new Date().toISOString()
      });
    }, 2000); // More frequent updates for rollbacks

    try {
      const result = await rollbackPromise;
      clearInterval(progressInterval);
      
      this.emit('rollbackSuccess', {
        releaseName,
        fromRevision: this.currentRelease.revision,
        toRevision: targetRevision,
        currentRevision: result.currentRevision,
        namespace: result.namespace
      });

      return result;
    } catch (error) {
      clearInterval(progressInterval);
      throw error;
    }
  }

  async _verifyRollback(releaseName, rollbackResult) {
    if (!this.config.verifyRollback) {
      return;
    }

    // Get current release status after rollback
    const releaseStatus = await this.helmCLI.getStatus(releaseName, this.config.namespace);
    if (!releaseStatus) {
      throw new Error(`Release '${releaseName}' not found after rollback`);
    }

    // Verify release is in deployed status
    if (releaseStatus.status !== 'deployed') {
      throw new Error(`Release '${releaseName}' is in '${releaseStatus.status}' status after rollback, expected 'deployed'`);
    }

    // Verify we're at the target revision
    if (releaseStatus.revision !== this.targetRevision) {
      throw new Error(`Rollback verification failed: expected revision ${this.targetRevision}, got ${releaseStatus.revision}`);
    }

    this.emit('verificationComplete', {
      releaseName,
      expectedRevision: this.targetRevision,
      actualRevision: releaseStatus.revision,
      status: releaseStatus.status,
      chart: releaseStatus.chart,
      chartVersion: releaseStatus.chartVersion
    });
  }

  async _performHealthCheck(releaseName) {
    let healthCheckAttempts = 0;
    const maxAttempts = this.config.healthCheckRetries;
    
    while (healthCheckAttempts < maxAttempts) {
      try {
        // Get current release information
        const release = await this.helmCLI.getRelease(releaseName, this.config.namespace);
        
        if (release.status === 'deployed' && release.revision === this.targetRevision) {
          const healthStatus = {
            status: 'healthy',
            release: {
              name: release.name,
              revision: release.revision,
              status: release.status,
              chart: release.chart,
              namespace: release.namespace
            },
            rollback: {
              fromRevision: this.currentRelease.revision,
              toRevision: this.targetRevision,
              successful: true
            },
            checks: {
              releaseDeployed: true,
              correctRevision: release.revision === this.targetRevision,
              manifestValid: !!release.manifest,
              rollbackComplete: true
            },
            timestamp: new Date().toISOString()
          };

          this.emit('healthCheckComplete', healthStatus);
          return healthStatus;
        }

        throw new Error(`Release health check failed: status=${release.status}, revision=${release.revision}, expected=${this.targetRevision}`);
      } catch (error) {
        healthCheckAttempts++;
        
        if (healthCheckAttempts >= maxAttempts) {
          const healthStatus = {
            status: 'unhealthy',
            error: error.message,
            attempts: healthCheckAttempts,
            rollback: {
              fromRevision: this.currentRelease.revision,
              toRevision: this.targetRevision,
              successful: false
            },
            timestamp: new Date().toISOString()
          };

          this.emit('healthCheckFailed', healthStatus);
          return healthStatus;
        }

        // Wait before retry (shorter for rollbacks)
        await new Promise(resolve => setTimeout(resolve, this.config.healthCheckInterval));
      }
    }
  }

  async _auditRollback(rollbackResult) {
    const auditEntry = {
      type: 'rollback',
      operationId: rollbackResult.operationId,
      releaseName: rollbackResult.releaseName,
      namespace: rollbackResult.namespace,
      fromRevision: rollbackResult.fromRevision,
      toRevision: rollbackResult.toRevision,
      reason: rollbackResult.reason,
      success: rollbackResult.success,
      duration: rollbackResult.duration,
      timestamp: rollbackResult.metadata.timestamp,
      user: process.env.USER || 'system',
      metadata: {
        phases: rollbackResult.phases,
        healthStatus: rollbackResult.healthStatus
      }
    };

    // In a real implementation, this would write to an audit log/database
    this.emit('auditEntry', auditEntry);
  }

  _generateOperationId() {
    return `rollback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = { RollbackOperation };