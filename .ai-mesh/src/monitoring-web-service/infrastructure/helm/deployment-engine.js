/**
 * Helm Deployment Engine
 * 
 * Main orchestration engine for Helm deployment operations.
 * Implements comprehensive deployment automation with safety mechanisms,
 * monitoring, and rollback capabilities.
 * 
 * Part of: Phase 2 - Week 5 - Sprint 3: Deployment Automation
 * Task: 3.1 Helm Deployment Engine Implementation
 */

const { EventEmitter } = require('events');
const path = require('path');
const fs = require('fs').promises;
const { InstallOperation } = require('./operations/install');
const { UpgradeOperation } = require('./operations/upgrade');
const { RollbackOperation } = require('./operations/rollback');
const { DeleteOperation } = require('./operations/delete');
const { StatusTracker } = require('./status-tracker');
const { PreDeploymentValidator } = require('./validators/pre-deployment');
const { PostDeploymentValidator } = require('./validators/post-deployment');
const { HelmCLI } = require('./utils/helm-cli');
const { ErrorHandler } = require('./utils/error-handler');

// Task 3.2-3.4: Enhanced components
const { DeploymentMonitor } = require('./monitoring/deployment-monitor');
const { RollbackAutomation } = require('./rollback/rollback-automation');

/**
 * Main Helm Deployment Engine
 * 
 * Orchestrates all Helm operations with comprehensive safety mechanisms:
 * - Pre-deployment validation and environment checks
 * - Real-time operation monitoring and progress tracking
 * - Automatic rollback on failure conditions
 * - Post-deployment validation and health checks
 * - Comprehensive error handling and recovery
 */
class HelmDeploymentEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.config = {
      chartPath: options.chartPath || '../../helm-chart',
      namespace: options.namespace || 'monitoring-system',
      timeout: options.timeout || 300, // 5 minutes default
      dryRun: options.dryRun || false,
      debug: options.debug || false,
      enableAutoRollback: options.enableAutoRollback !== false,
      rollbackThreshold: options.rollbackThreshold || 0.05, // 5% error rate
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 5000, // 5 seconds
      ...options
    };

    this.operations = {
      install: new InstallOperation(this.config),
      upgrade: new UpgradeOperation(this.config),
      rollback: new RollbackOperation(this.config),
      delete: new DeleteOperation(this.config)
    };

    this.statusTracker = new StatusTracker(this.config);
    this.preValidator = new PreDeploymentValidator(this.config);
    this.postValidator = new PostDeploymentValidator(this.config);
    this.helmCLI = new HelmCLI(this.config);
    this.errorHandler = new ErrorHandler(this.config);

    // Task 3.2-3.4: Enhanced automation components
    this.deploymentMonitor = new DeploymentMonitor(this.config);
    this.rollbackAutomation = new RollbackAutomation(this.config);

    this.currentOperation = null;
    this.deploymentHistory = [];
    
    this._setupEventHandlers();
  }

  /**
   * Install a new Helm release
   * 
   * @param {string} releaseName - Name of the Helm release
   * @param {object} values - Helm values to override
   * @param {object} options - Additional installation options
   * @returns {Promise<object>} Installation result with status and metadata
   */
  async install(releaseName, values = {}, options = {}) {
    const operationId = this._generateOperationId('install');
    
    try {
      this._setCurrentOperation('install', operationId, { releaseName, values, options });
      
      this.emit('operationStart', {
        type: 'install',
        operationId,
        releaseName,
        timestamp: new Date().toISOString()
      });

      // Phase 1: Pre-deployment validation (Enhanced with Task 3.2)
      await this._executePhase('pre-validation', async () => {
        // Comprehensive environment validation
        const envValidation = await this.preValidator.validateEnvironment(this.config.namespace);
        if (!envValidation.passed) {
          throw new Error(`Environment validation failed: ${envValidation.issues.map(i => i.message).join(', ')}`);
        }

        // Chart validation
        await this.preValidator.validateChart(this.config.chartPath);
        
        // Values validation with schema checking
        await this.preValidator.validateValues(values);
        
        // Resource availability validation
        await this.preValidator.validateResources(releaseName, this.config.namespace);
        
        this.emit('preValidationCompleted', {
          operationId,
          validation: envValidation,
          timestamp: new Date().toISOString()
        });
      });

      // Phase 2: Execute installation (Enhanced with Task 3.3 & 3.4)
      const result = await this._executePhase('installation', async () => {
        // Start real-time monitoring
        await this.deploymentMonitor.startDeploymentMonitoring(
          operationId,
          releaseName,
          this.config.namespace,
          {
            enableHealthChecks: true,
            enableEventStreaming: true,
            enableProgressReporting: true
          }
        );

        // Start rollback monitoring
        await this.rollbackAutomation.startRollbackMonitoring(
          operationId,
          releaseName,
          this.config.namespace,
          {
            enableAutoRollback: this.config.enableAutoRollback
          }
        );

        // Execute installation
        const installResult = await this.operations.install.execute(releaseName, values, {
          ...this.config,
          ...options,
          operationId
        });

        return installResult;
      });

      // Phase 3: Post-deployment validation
      await this._executePhase('post-validation', async () => {
        await this.postValidator.validateDeployment(releaseName, this.config.namespace);
        await this.postValidator.validateHealth(releaseName, this.config.namespace);
        await this.postValidator.validatePerformance(releaseName, this.config.namespace);
      });

      this._recordSuccess('install', operationId, result);
      
      this.emit('operationComplete', {
        type: 'install',
        operationId,
        releaseName,
        result,
        timestamp: new Date().toISOString()
      });

      return result;

    } catch (error) {
      // Stop monitoring on error
      await this._cleanupMonitoring(operationId);
      return await this._handleOperationError('install', operationId, error, { releaseName });
    } finally {
      this._clearCurrentOperation();
    }
  }

  /**
   * Upgrade an existing Helm release
   * 
   * @param {string} releaseName - Name of the Helm release to upgrade
   * @param {object} values - Helm values to override
   * @param {object} options - Additional upgrade options
   * @returns {Promise<object>} Upgrade result with status and metadata
   */
  async upgrade(releaseName, values = {}, options = {}) {
    const operationId = this._generateOperationId('upgrade');
    
    try {
      this._setCurrentOperation('upgrade', operationId, { releaseName, values, options });
      
      this.emit('operationStart', {
        type: 'upgrade',
        operationId,
        releaseName,
        timestamp: new Date().toISOString()
      });

      // Get current release info for rollback capability
      const currentRelease = await this.helmCLI.getRelease(releaseName, this.config.namespace);
      
      // Phase 1: Pre-upgrade validation
      await this._executePhase('pre-validation', async () => {
        await this.preValidator.validateUpgrade(releaseName, this.config.namespace);
        await this.preValidator.validateChart(this.config.chartPath);
        await this.preValidator.validateValues(values);
        await this.preValidator.validateCompatibility(currentRelease, values);
      });

      // Phase 2: Execute upgrade with monitoring
      const result = await this._executePhase('upgrade', async () => {
        return await this.operations.upgrade.execute(releaseName, values, {
          ...this.config,
          ...options,
          operationId,
          previousRevision: currentRelease.revision
        });
      });

      // Phase 3: Post-upgrade validation
      await this._executePhase('post-validation', async () => {
        await this.postValidator.validateUpgrade(releaseName, this.config.namespace, currentRelease);
        await this.postValidator.validateHealth(releaseName, this.config.namespace);
        await this.postValidator.validatePerformance(releaseName, this.config.namespace);
      });

      this._recordSuccess('upgrade', operationId, result);
      
      this.emit('operationComplete', {
        type: 'upgrade',
        operationId,
        releaseName,
        result,
        previousRevision: currentRelease.revision,
        timestamp: new Date().toISOString()
      });

      return result;

    } catch (error) {
      return await this._handleOperationError('upgrade', operationId, error, { 
        releaseName,
        enableAutoRollback: this.config.enableAutoRollback
      });
    } finally {
      this._clearCurrentOperation();
    }
  }

  /**
   * Rollback a Helm release to a previous revision
   * 
   * @param {string} releaseName - Name of the Helm release to rollback
   * @param {number} revision - Target revision (optional, defaults to previous)
   * @param {object} options - Additional rollback options
   * @returns {Promise<object>} Rollback result with status and metadata
   */
  async rollback(releaseName, revision = null, options = {}) {
    const operationId = this._generateOperationId('rollback');
    
    try {
      this._setCurrentOperation('rollback', operationId, { releaseName, revision, options });
      
      this.emit('operationStart', {
        type: 'rollback',
        operationId,
        releaseName,
        targetRevision: revision,
        timestamp: new Date().toISOString()
      });

      // Phase 1: Pre-rollback validation
      await this._executePhase('pre-validation', async () => {
        await this.preValidator.validateRollback(releaseName, this.config.namespace, revision);
      });

      // Phase 2: Execute rollback
      const result = await this._executePhase('rollback', async () => {
        return await this.operations.rollback.execute(releaseName, revision, {
          ...this.config,
          ...options,
          operationId
        });
      });

      // Phase 3: Post-rollback validation
      await this._executePhase('post-validation', async () => {
        await this.postValidator.validateRollback(releaseName, this.config.namespace, revision);
        await this.postValidator.validateHealth(releaseName, this.config.namespace);
      });

      this._recordSuccess('rollback', operationId, result);
      
      this.emit('operationComplete', {
        type: 'rollback',
        operationId,
        releaseName,
        result,
        targetRevision: revision,
        timestamp: new Date().toISOString()
      });

      return result;

    } catch (error) {
      return await this._handleOperationError('rollback', operationId, error, { releaseName, revision });
    } finally {
      this._clearCurrentOperation();
    }
  }

  /**
   * Delete a Helm release
   * 
   * @param {string} releaseName - Name of the Helm release to delete
   * @param {object} options - Additional deletion options
   * @returns {Promise<object>} Deletion result with status and metadata
   */
  async delete(releaseName, options = {}) {
    const operationId = this._generateOperationId('delete');
    
    try {
      this._setCurrentOperation('delete', operationId, { releaseName, options });
      
      this.emit('operationStart', {
        type: 'delete',
        operationId,
        releaseName,
        timestamp: new Date().toISOString()
      });

      // Phase 1: Pre-deletion validation
      await this._executePhase('pre-validation', async () => {
        await this.preValidator.validateDeletion(releaseName, this.config.namespace);
      });

      // Phase 2: Execute deletion
      const result = await this._executePhase('deletion', async () => {
        return await this.operations.delete.execute(releaseName, {
          ...this.config,
          ...options,
          operationId
        });
      });

      // Phase 3: Post-deletion validation
      await this._executePhase('post-validation', async () => {
        await this.postValidator.validateDeletion(releaseName, this.config.namespace);
      });

      this._recordSuccess('delete', operationId, result);
      
      this.emit('operationComplete', {
        type: 'delete',
        operationId,
        releaseName,
        result,
        timestamp: new Date().toISOString()
      });

      return result;

    } catch (error) {
      return await this._handleOperationError('delete', operationId, error, { releaseName });
    } finally {
      this._clearCurrentOperation();
    }
  }

  /**
   * Get status of a Helm release
   * 
   * @param {string} releaseName - Name of the Helm release
   * @returns {Promise<object>} Release status information
   */
  async getStatus(releaseName) {
    try {
      return await this.statusTracker.getStatus(releaseName, this.config.namespace);
    } catch (error) {
      throw this.errorHandler.handle(error, {
        operation: 'status',
        releaseName,
        context: 'status-check'
      });
    }
  }

  /**
   * List all Helm releases in namespace
   * 
   * @returns {Promise<Array>} List of releases
   */
  async listReleases() {
    try {
      return await this.helmCLI.listReleases(this.config.namespace);
    } catch (error) {
      throw this.errorHandler.handle(error, {
        operation: 'list',
        context: 'list-releases'
      });
    }
  }

  /**
   * Get deployment history
   * 
   * @returns {Array} Deployment history records
   */
  getDeploymentHistory() {
    return [...this.deploymentHistory];
  }

  /**
   * Stop current operation
   * 
   * @returns {Promise<void>}
   */
  async stopCurrentOperation() {
    if (this.currentOperation) {
      this.emit('operationStopped', {
        operationId: this.currentOperation.operationId,
        type: this.currentOperation.type,
        timestamp: new Date().toISOString()
      });
      
      // Attempt graceful shutdown of current operation
      const operation = this.operations[this.currentOperation.type];
      if (operation && typeof operation.stop === 'function') {
        await operation.stop();
      }
      
      this._clearCurrentOperation();
    }
  }

  // Private Methods

  _setupEventHandlers() {
    // Set up event handling for status tracking and error management
    this.statusTracker.on('statusUpdate', (status) => {
      this.emit('statusUpdate', status);
    });

    this.statusTracker.on('healthCheck', (health) => {
      this.emit('healthCheck', health);
      
      // Auto-rollback on health failure if enabled
      if (this.config.enableAutoRollback && health.status === 'unhealthy' && this.currentOperation) {
        this._triggerAutoRollback(health);
      }
    });

    // Handle operation timeouts
    this.on('operationTimeout', async (operation) => {
      await this._handleTimeout(operation);
    });

    // Task 3.2-3.4: Enhanced event integration
    this._setupEnhancedEventHandlers();
  }

  _setupEnhancedEventHandlers() {
    // Deployment monitoring events
    this.deploymentMonitor.on('statusUpdate', (update) => {
      this.emit('deploymentStatusUpdate', update);
    });

    this.deploymentMonitor.on('progressUpdate', (progress) => {
      this.emit('deploymentProgress', progress);
    });

    this.deploymentMonitor.on('deploymentEvent', (event) => {
      this.emit('deploymentEvent', event);
    });

    this.deploymentMonitor.on('healthCheck', (health) => {
      this.emit('deploymentHealthCheck', health);
      
      // Trigger rollback monitoring if health issues detected
      if (!health.healthStatus.overall.healthy && this.currentOperation) {
        this._handleHealthFailure(health);
      }
    });

    this.deploymentMonitor.on('deploymentFailure', (failure) => {
      this.emit('deploymentFailure', failure);
      
      // Auto-trigger rollback if enabled
      if (this.config.enableAutoRollback) {
        this._handleDeploymentFailure(failure);
      }
    });

    // Rollback automation events
    this.rollbackAutomation.on('rollbackTriggered', (rollback) => {
      this.emit('autoRollbackTriggered', rollback);
    });

    this.rollbackAutomation.on('rollbackCompleted', (result) => {
      this.emit('autoRollbackCompleted', result);
    });

    this.rollbackAutomation.on('rollbackFailed', (failure) => {
      this.emit('autoRollbackFailed', failure);
    });

    this.rollbackAutomation.on('auditLog', (audit) => {
      this.emit('rollbackAuditLog', audit);
    });
  }

  async _executePhase(phaseName, phaseFunction) {
    const startTime = Date.now();
    
    this.emit('phaseStart', {
      phase: phaseName,
      operationId: this.currentOperation?.operationId,
      timestamp: new Date().toISOString()
    });

    try {
      const result = await phaseFunction();
      
      this.emit('phaseComplete', {
        phase: phaseName,
        operationId: this.currentOperation?.operationId,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });

      return result;
    } catch (error) {
      this.emit('phaseError', {
        phase: phaseName,
        operationId: this.currentOperation?.operationId,
        error: error.message,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });

      throw error;
    }
  }

  async _handleOperationError(operationType, operationId, error, context) {
    const handledError = this.errorHandler.handle(error, {
      operation: operationType,
      operationId,
      ...context
    });

    this._recordFailure(operationType, operationId, handledError);

    this.emit('operationError', {
      type: operationType,
      operationId,
      error: handledError,
      context,
      timestamp: new Date().toISOString()
    });

    // Attempt auto-rollback if enabled and operation supports it
    if (this.config.enableAutoRollback && 
        operationType === 'upgrade' && 
        context.enableAutoRollback !== false) {
      
      try {
        const rollbackResult = await this.rollback(context.releaseName);
        
        this.emit('autoRollback', {
          originalOperation: operationType,
          originalOperationId: operationId,
          rollbackResult,
          timestamp: new Date().toISOString()
        });

        return {
          success: false,
          error: handledError,
          autoRollback: rollbackResult
        };
      } catch (rollbackError) {
        this.emit('rollbackFailed', {
          originalError: handledError,
          rollbackError: this.errorHandler.handle(rollbackError, { operation: 'auto-rollback' }),
          timestamp: new Date().toISOString()
        });
      }
    }

    throw handledError;
  }

  async _triggerAutoRollback(healthStatus) {
    if (!this.currentOperation || this.currentOperation.type !== 'upgrade') {
      return;
    }

    const { releaseName } = this.currentOperation.context;
    
    this.emit('autoRollbackTriggered', {
      reason: 'health-check-failure',
      healthStatus,
      operationId: this.currentOperation.operationId,
      timestamp: new Date().toISOString()
    });

    try {
      await this.rollback(releaseName);
    } catch (rollbackError) {
      this.emit('autoRollbackFailed', {
        error: rollbackError.message,
        operationId: this.currentOperation.operationId,
        timestamp: new Date().toISOString()
      });
    }
  }

  async _handleTimeout(operation) {
    this.emit('operationTimeout', {
      type: operation.type,
      operationId: operation.operationId,
      timeout: this.config.timeout,
      timestamp: new Date().toISOString()
    });

    await this.stopCurrentOperation();
  }

  _setCurrentOperation(type, operationId, context) {
    this.currentOperation = {
      type,
      operationId,
      context,
      startTime: Date.now()
    };
  }

  _clearCurrentOperation() {
    this.currentOperation = null;
  }

  _generateOperationId(type) {
    return `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  _recordSuccess(type, operationId, result) {
    this.deploymentHistory.push({
      type,
      operationId,
      status: 'success',
      result,
      timestamp: new Date().toISOString(),
      duration: this.currentOperation ? Date.now() - this.currentOperation.startTime : 0
    });
  }

  _recordFailure(type, operationId, error) {
    this.deploymentHistory.push({
      type,
      operationId,
      status: 'failure',
      error: error.message || error,
      timestamp: new Date().toISOString(),
      duration: this.currentOperation ? Date.now() - this.currentOperation.startTime : 0
    });
  }

  // ============================================================================
  // ENHANCED INTEGRATION METHODS (Task 3.2-3.4)
  // ============================================================================

  /**
   * Get comprehensive deployment status including monitoring and rollback info
   */
  async getEnhancedDeploymentStatus(deploymentId) {
    try {
      const baseStatus = await this.getStatus(deploymentId);
      const monitoringStatus = await this.deploymentMonitor.getDeploymentStatus(deploymentId);
      const rollbackStatus = this.rollbackAutomation.getRollbackStatus(deploymentId);

      return {
        ...baseStatus,
        monitoring: monitoringStatus,
        rollback: rollbackStatus,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Failed to get enhanced deployment status: ${error.message}`);
    }
  }

  /**
   * Get deployment events and monitoring data
   */
  async getDeploymentEvents(deploymentId, since = null) {
    return this.deploymentMonitor.getDeploymentEvents(deploymentId, since);
  }

  /**
   * Force health check for a deployment
   */
  async performHealthCheck(deploymentId) {
    return this.deploymentMonitor.performHealthCheck(deploymentId);
  }

  /**
   * Manually trigger rollback
   */
  async manualRollback(deploymentId, targetRevision = null, reason = 'Manual rollback') {
    return this.rollbackAutomation.triggerManualRollback(deploymentId, targetRevision, reason);
  }

  /**
   * Configure rollback automation settings
   */
  configureRollbackAutomation(settings) {
    this.rollbackAutomation.configureFailureDetection(settings);
    this.emit('rollbackConfigurationUpdated', {
      settings,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get comprehensive metrics from all systems
   */
  getEnhancedMetrics() {
    return {
      deploymentEngine: {
        totalDeployments: this.deploymentHistory.length,
        currentOperations: this.currentOperation ? 1 : 0,
        history: this.deploymentHistory.slice(-10)
      },
      monitoring: this.deploymentMonitor.getDeploymentMetrics(),
      rollback: this.rollbackAutomation.getRollbackMetrics(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Stop all monitoring and automation for a deployment
   */
  async stopEnhancedMonitoring(deploymentId) {
    try {
      await this._cleanupMonitoring(deploymentId);
      
      this.emit('enhancedMonitoringStopped', {
        deploymentId,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.emit('enhancedMonitoringError', {
        deploymentId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Stop all active monitoring and automation
   */
  async stopAllEnhancedMonitoring() {
    try {
      this.deploymentMonitor.stopAllMonitoring();
      this.rollbackAutomation.stopAllMonitoring();
      
      this.emit('allEnhancedMonitoringStopped', {
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.emit('enhancedMonitoringError', {
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Private integration helper methods

  async _cleanupMonitoring(deploymentId) {
    try {
      // Stop deployment monitoring
      if (this.deploymentMonitor.activeMonitors.has(deploymentId)) {
        await this.deploymentMonitor.stopDeploymentMonitoring(deploymentId);
      }

      // Stop rollback monitoring  
      if (this.rollbackAutomation.activeRollbacks.has(deploymentId)) {
        await this.rollbackAutomation.stopRollbackMonitoring(deploymentId);
      }
    } catch (error) {
      // Log cleanup errors but don't throw
      this.emit('monitoringCleanupError', {
        deploymentId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  async _handleHealthFailure(healthEvent) {
    const { deploymentId, healthStatus } = healthEvent;
    
    try {
      // Check if we should trigger automatic rollback
      if (this.config.enableAutoRollback && healthStatus && !healthStatus.overall.healthy) {
        await this.rollbackAutomation.triggerAutoRollback(
          deploymentId,
          'health-check-failure',
          { healthStatus }
        );
      }
    } catch (error) {
      this.emit('healthFailureHandlingError', {
        deploymentId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  async _handleDeploymentFailure(failureEvent) {
    const { deploymentId, type, severity } = failureEvent;
    
    try {
      // Trigger rollback for critical failures
      if (severity === 'critical' || severity === 'high') {
        await this.rollbackAutomation.triggerAutoRollback(
          deploymentId,
          `deployment-failure-${type}`,
          failureEvent
        );
      }
    } catch (error) {
      this.emit('deploymentFailureHandlingError', {
        deploymentId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
}

module.exports = { HelmDeploymentEngine };