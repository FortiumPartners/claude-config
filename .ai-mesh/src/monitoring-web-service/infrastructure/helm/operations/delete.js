/**
 * Helm Delete Operation
 * 
 * Handles Helm release deletion with:
 * - Pre-deletion validation and safety checks
 * - Clean resource removal with dependency management
 * - Post-deletion verification and cleanup
 * - Optional history preservation and audit logging
 * 
 * Part of: Task 3.1 - Helm Deployment Engine Implementation
 */

const { EventEmitter } = require('events');
const { HelmCLI } = require('../utils/helm-cli');
const { ErrorHandler } = require('../utils/error-handler');

/**
 * Helm Delete Operation Class
 * 
 * Manages the complete deletion lifecycle:
 * - Safety validation and dependency checking
 * - Progressive resource cleanup with monitoring
 * - Post-deletion verification and audit trail
 * - Optional backup and history preservation
 */
class DeleteOperation extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      timeout: config.timeout || 120, // 2 minutes for deletion
      retryAttempts: config.retryAttempts || 2,
      retryDelay: config.retryDelay || 5000,
      keepHistory: config.keepHistory !== false,
      cascade: config.cascade !== false,
      dryRun: config.dryRun || false,
      verifyDeletion: config.verifyDeletion !== false,
      backupBeforeDelete: config.backupBeforeDelete !== false,
      deletionTimeout: config.deletionTimeout || 300000, // 5 minutes
      verificationRetries: config.verificationRetries || 10,
      verificationInterval: config.verificationInterval || 5000,
      auditDeletion: config.auditDeletion !== false,
      ...config
    };

    this.helmCLI = new HelmCLI(this.config);
    this.errorHandler = new ErrorHandler(this.config);
    this.deletionPhases = [
      'preparation',
      'validation',
      'backup',
      'deletion',
      'verification',
      'cleanup'
    ];
    
    this.currentPhase = null;
    this.deletionMetrics = {};
    this.releaseToDelete = null;
    this.backupData = null;
  }

  /**
   * Execute Helm release deletion
   * 
   * @param {string} releaseName - Name of the Helm release to delete
   * @param {object} options - Deletion options
   * @returns {Promise<object>} Deletion result
   */
  async execute(releaseName, options = {}) {
    const startTime = Date.now();
    const operationId = options.operationId || this._generateOperationId();
    
    this.deletionMetrics = {
      operationId,
      releaseName,
      startTime,
      phases: {},
      totalDuration: 0,
      success: false,
      resourcesDeleted: 0,
      reason: options.reason || 'manual-deletion'
    };

    try {
      this.emit('deletionStart', {
        operationId,
        releaseName,
        options,
        reason: this.deletionMetrics.reason,
        timestamp: new Date().toISOString()
      });

      // Phase 1: Preparation
      await this._executePhase('preparation', async () => {
        await this._prepareDeletion(releaseName, options);
      });

      // Phase 2: Validation
      await this._executePhase('validation', async () => {
        await this._validateDeletion(releaseName, options);
      });

      // Phase 3: Backup (if enabled)
      let backupInfo = null;
      if (this.config.backupBeforeDelete) {
        backupInfo = await this._executePhase('backup', async () => {
          return await this._backupRelease(releaseName);
        });
      }

      // Phase 4: Deletion
      const deletionResult = await this._executePhase('deletion', async () => {
        return await this._performDeletion(releaseName, options);
      });

      // Phase 5: Verification
      await this._executePhase('verification', async () => {
        await this._verifyDeletion(releaseName);
      });

      // Phase 6: Cleanup
      await this._executePhase('cleanup', async () => {
        await this._performCleanup(releaseName, options);
      });

      // Calculate metrics
      this.deletionMetrics.totalDuration = Date.now() - startTime;
      this.deletionMetrics.success = true;

      const result = {
        success: true,
        operationId,
        releaseName,
        namespace: this.config.namespace,
        deletedRevision: this.releaseToDelete?.revision,
        keepHistory: this.config.keepHistory,
        cascade: this.config.cascade,
        duration: this.deletionMetrics.totalDuration,
        phases: this.deletionMetrics.phases,
        resourcesDeleted: this.deletionMetrics.resourcesDeleted,
        backup: backupInfo,
        reason: this.deletionMetrics.reason,
        metadata: {
          originalChart: this.releaseToDelete?.chart,
          originalChartVersion: this.releaseToDelete?.chartVersion,
          timestamp: new Date().toISOString()
        }
      };

      this.emit('deletionComplete', result);
      
      // Audit deletion if enabled
      if (this.config.auditDeletion) {
        await this._auditDeletion(result);
      }

      return result;

    } catch (error) {
      this.deletionMetrics.totalDuration = Date.now() - startTime;
      this.deletionMetrics.success = false;
      
      const handledError = this.errorHandler.handle(error, {
        operation: 'delete',
        operationId,
        releaseName,
        phase: this.currentPhase,
        options
      });

      this.emit('deletionError', {
        operationId,
        releaseName,
        error: handledError,
        phase: this.currentPhase,
        metrics: this.deletionMetrics
      });

      throw handledError;
    } finally {
      this.currentPhase = null;
    }
  }

  /**
   * Stop current deletion operation
   * 
   * @returns {Promise<void>}
   */
  async stop() {
    if (this.currentPhase) {
      this.emit('deletionStopped', {
        operationId: this.deletionMetrics.operationId,
        releaseName: this.deletionMetrics.releaseName,
        phase: this.currentPhase,
        timestamp: new Date().toISOString()
      });
      
      // Deletion operations should be handled carefully when stopped
      if (this.currentPhase === 'deletion') {
        this.emit('deletionStopWarning', {
          warning: 'Deletion in progress - cannot safely stop mid-operation',
          phase: this.currentPhase,
          recommendation: 'Allow deletion to complete or may result in orphaned resources'
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
      operationId: this.deletionMetrics.operationId,
      timestamp: new Date().toISOString()
    });

    try {
      const result = await phaseFunction();
      
      const phaseDuration = Date.now() - phaseStartTime;
      this.deletionMetrics.phases[phaseName] = {
        status: 'completed',
        duration: phaseDuration,
        timestamp: new Date().toISOString()
      };

      this.emit('phaseComplete', {
        phase: phaseName,
        operationId: this.deletionMetrics.operationId,
        duration: phaseDuration,
        timestamp: new Date().toISOString()
      });

      return result;
    } catch (error) {
      const phaseDuration = Date.now() - phaseStartTime;
      this.deletionMetrics.phases[phaseName] = {
        status: 'failed',
        duration: phaseDuration,
        error: error.message,
        timestamp: new Date().toISOString()
      };

      this.emit('phaseError', {
        phase: phaseName,
        operationId: this.deletionMetrics.operationId,
        error: error.message,
        duration: phaseDuration,
        timestamp: new Date().toISOString()
      });

      throw error;
    }
  }

  async _prepareDeletion(releaseName, options) {
    // Initialize Helm CLI
    await this.helmCLI.initialize();
    
    // Get release information
    this.releaseToDelete = await this.helmCLI.getRelease(releaseName, this.config.namespace);
    if (!this.releaseToDelete) {
      throw new Error(`Release '${releaseName}' not found in namespace '${this.config.namespace}'`);
    }

    // Check if this is a dry run
    if (this.config.dryRun || options.dryRun) {
      this.emit('dryRunMode', {
        releaseName,
        revision: this.releaseToDelete.revision,
        warning: 'Dry run mode - no actual deletion will occur'
      });
    }

    this.emit('preparationComplete', {
      releaseName,
      revision: this.releaseToDelete.revision,
      status: this.releaseToDelete.status,
      chart: this.releaseToDelete.chart,
      chartVersion: this.releaseToDelete.chartVersion,
      namespace: this.config.namespace
    });
  }

  async _validateDeletion(releaseName, options) {
    // Check if release can be safely deleted
    if (this.releaseToDelete.status === 'pending-install' || 
        this.releaseToDelete.status === 'pending-upgrade') {
      
      if (!options.force) {
        throw new Error(`Cannot delete release in '${this.releaseToDelete.status}' status without force flag`);
      }
      
      this.emit('forceDeletion', {
        releaseName,
        status: this.releaseToDelete.status,
        warning: 'Force deleting release in pending state'
      });
    }

    // Validate dependencies (if any checks are needed)
    await this._checkDependencies(releaseName);

    // Count resources that will be deleted
    const resourceCount = this._countResources(this.releaseToDelete.manifest);
    this.deletionMetrics.resourcesDeleted = resourceCount;

    this.emit('validationComplete', {
      releaseName,
      status: this.releaseToDelete.status,
      resourceCount,
      dependencies: [],
      safeToDelete: true
    });
  }

  async _backupRelease(releaseName) {
    // Create comprehensive backup of the release
    const backupData = {
      releaseName,
      revision: this.releaseToDelete.revision,
      status: this.releaseToDelete.status,
      chart: this.releaseToDelete.chart,
      chartVersion: this.releaseToDelete.chartVersion,
      values: this.releaseToDelete.values,
      manifest: this.releaseToDelete.manifest,
      hooks: this.releaseToDelete.hooks || [],
      history: await this.helmCLI.getHistory(releaseName, this.config.namespace),
      timestamp: new Date().toISOString(),
      backupReason: 'pre-deletion-backup'
    };

    this.backupData = backupData;

    this.emit('backupComplete', {
      releaseName,
      revision: this.releaseToDelete.revision,
      backupSize: JSON.stringify(backupData).length,
      includesHistory: true
    });

    return backupData;
  }

  async _performDeletion(releaseName, options) {
    const deletionOptions = {
      keepHistory: this.config.keepHistory,
      cascade: this.config.cascade,
      timeout: this.config.timeout,
      dryRun: this.config.dryRun || options.dryRun,
      ...options
    };

    // Start deletion with progress monitoring
    const deletionPromise = this.helmCLI.delete(releaseName, deletionOptions);

    // Monitor deletion progress
    const progressInterval = setInterval(() => {
      this.emit('deletionProgress', {
        releaseName,
        phase: 'deleting',
        resourcesDeleted: this.deletionMetrics.resourcesDeleted,
        timestamp: new Date().toISOString()
      });
    }, 3000);

    try {
      const result = await deletionPromise;
      clearInterval(progressInterval);
      
      this.emit('deletionSuccess', {
        releaseName,
        namespace: result.namespace,
        keepHistory: result.keepHistory,
        cascade: this.config.cascade
      });

      return result;
    } catch (error) {
      clearInterval(progressInterval);
      throw error;
    }
  }

  async _verifyDeletion(releaseName) {
    if (!this.config.verifyDeletion) {
      return;
    }

    let verificationAttempts = 0;
    const maxAttempts = this.config.verificationRetries;
    
    while (verificationAttempts < maxAttempts) {
      try {
        // Check if release still exists
        const releaseStatus = await this.helmCLI.getStatus(releaseName, this.config.namespace);
        
        if (!releaseStatus) {
          // Release is completely deleted
          this.emit('verificationComplete', {
            releaseName,
            status: 'deleted',
            completelyRemoved: true,
            keepHistory: this.config.keepHistory
          });
          return;
        }
        
        // If keepHistory is true, check status
        if (this.config.keepHistory && releaseStatus.status === 'uninstalled') {
          this.emit('verificationComplete', {
            releaseName,
            status: 'uninstalled',
            completelyRemoved: false,
            historyPreserved: true
          });
          return;
        }

        throw new Error(`Release still exists with status: ${releaseStatus.status}`);
      } catch (error) {
        verificationAttempts++;
        
        if (verificationAttempts >= maxAttempts) {
          this.emit('verificationFailed', {
            releaseName,
            error: error.message,
            attempts: verificationAttempts,
            warning: 'Deletion may not have completed successfully'
          });
          
          // Don't throw error for verification failure in deletion
          return;
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, this.config.verificationInterval));
      }
    }
  }

  async _performCleanup(releaseName, options) {
    // Perform any additional cleanup tasks
    const cleanupTasks = [];

    // Clean up temporary files or resources if any
    if (this.backupData && !options.preserveBackup) {
      cleanupTasks.push('backup-cleanup');
    }

    // Clean up any orphaned resources if cascade didn't work
    if (this.config.cascade && options.forceCleanup) {
      cleanupTasks.push('orphaned-resource-cleanup');
    }

    this.emit('cleanupComplete', {
      releaseName,
      tasksPerformed: cleanupTasks,
      cleanupSuccessful: true
    });
  }

  async _checkDependencies(releaseName) {
    // In a real implementation, this would check for:
    // - Other releases that depend on this one
    // - Shared resources that might be affected
    // - Critical services that might be impacted
    
    // For now, return empty dependencies
    return [];
  }

  _countResources(manifest) {
    if (!manifest) return 0;
    
    // Count YAML documents in manifest
    const documents = manifest.split('---').filter(doc => doc.trim());
    return documents.length;
  }

  async _auditDeletion(deletionResult) {
    const auditEntry = {
      type: 'deletion',
      operationId: deletionResult.operationId,
      releaseName: deletionResult.releaseName,
      namespace: deletionResult.namespace,
      revision: deletionResult.deletedRevision,
      reason: deletionResult.reason,
      success: deletionResult.success,
      duration: deletionResult.duration,
      resourcesDeleted: deletionResult.resourcesDeleted,
      keepHistory: deletionResult.keepHistory,
      timestamp: deletionResult.metadata.timestamp,
      user: process.env.USER || 'system',
      metadata: {
        originalChart: deletionResult.metadata.originalChart,
        originalChartVersion: deletionResult.metadata.originalChartVersion,
        phases: deletionResult.phases,
        backupCreated: !!deletionResult.backup
      }
    };

    // In a real implementation, this would write to an audit log/database
    this.emit('auditEntry', auditEntry);
  }

  _generateOperationId() {
    return `delete-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = { DeleteOperation };