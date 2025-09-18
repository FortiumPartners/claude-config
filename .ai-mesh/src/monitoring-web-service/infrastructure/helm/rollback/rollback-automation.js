/**
 * Rollback Automation - Enhanced for Task 3.4
 * 
 * Intelligent rollback automation system:
 * - Automatic failure detection and pattern recognition
 * - Configurable rollback trigger conditions
 * - State preservation and backup management
 * - Rollback validation and verification
 * - Recovery procedures and service restoration
 * - Comprehensive audit logging and decision tracking
 * 
 * Part of: Phase 2 - Week 5 - Sprint 3: Deployment Automation
 * Task: 3.4 Rollback Automation Enhancement
 */

const { EventEmitter } = require('events');
const { KubernetesClient } = require('../utils/kubernetes-client');
const { HelmCLI } = require('../utils/helm-cli');

/**
 * Rollback Automation Class
 * 
 * Provides intelligent automatic rollback capabilities with comprehensive
 * failure detection, state preservation, and recovery procedures
 */
class RollbackAutomation extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Failure detection thresholds
      healthCheckFailureThreshold: config.healthCheckFailureThreshold || 3,
      errorRateThreshold: config.errorRateThreshold || 0.05, // 5%
      responseTimeThreshold: config.responseTimeThreshold || 5000, // 5 seconds
      availabilityThreshold: config.availabilityThreshold || 0.95, // 95%
      
      // Rollback timing configuration
      rollbackCooldownPeriod: config.rollbackCooldownPeriod || 300000, // 5 minutes
      rollbackValidationTimeout: config.rollbackValidationTimeout || 180000, // 3 minutes
      stateBackupRetention: config.stateBackupRetention || 86400000, // 24 hours
      
      // Automation settings
      enableAutoRollback: config.enableAutoRollback !== false,
      enableStatePreservation: config.enableStatePreservation !== false,
      enableRollbackValidation: config.enableRollbackValidation !== false,
      enableAuditLogging: config.enableAuditLogging !== false,
      
      // Advanced configuration
      maxRollbackAttempts: config.maxRollbackAttempts || 2,
      requireManualApproval: config.requireManualApproval || false,
      rollbackStrategy: config.rollbackStrategy || 'immediate', // immediate, gradual, canary
      
      ...config
    };

    this.kubernetesClient = new KubernetesClient(this.config);
    this.helmCLI = new HelmCLI(this.config);
    
    // Active rollback tracking
    this.activeRollbacks = new Map();
    this.rollbackHistory = [];
    this.stateBackups = new Map();
    this.failurePatterns = new Map();
    
    // Metrics and monitoring
    this.rollbackMetrics = {
      totalRollbacks: 0,
      successfulRollbacks: 0,
      failedRollbacks: 0,
      averageRollbackTime: 0,
      lastRollbackTime: null,
      automaticRollbacks: 0,
      manualRollbacks: 0
    };

    // Initialize failure detection patterns
    this._initializeFailurePatterns();
  }

  /**
   * Configure rollback trigger conditions
   */
  configureFailureDetection(conditions) {
    this.config = {
      ...this.config,
      ...conditions
    };

    this.emit('configurationUpdated', {
      conditions,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Start monitoring deployment for rollback conditions
   */
  async startRollbackMonitoring(deploymentId, releaseName, namespace, options = {}) {
    try {
      const monitoringConfig = {
        deploymentId,
        releaseName,
        namespace,
        startTime: Date.now(),
        status: 'monitoring',
        failureCount: 0,
        healthCheckFailures: 0,
        lastHealthCheck: null,
        rollbackTriggers: [],
        options: {
          enableAutoRollback: options.enableAutoRollback !== false,
          rollbackStrategy: options.rollbackStrategy || this.config.rollbackStrategy,
          ...options
        }
      };

      this.activeRollbacks.set(deploymentId, monitoringConfig);

      // Create state backup if enabled
      if (this.config.enableStatePreservation) {
        await this._createStateBackup(deploymentId, releaseName, namespace);
      }

      this.emit('rollbackMonitoringStarted', {
        deploymentId,
        releaseName,
        namespace,
        timestamp: new Date().toISOString()
      });

      // Start continuous monitoring
      this._startContinuousMonitoring(deploymentId);
      
      return monitoringConfig;

    } catch (error) {
      this.emit('rollbackMonitoringError', {
        deploymentId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  /**
   * Stop rollback monitoring
   */
  async stopRollbackMonitoring(deploymentId) {
    const monitor = this.activeRollbacks.get(deploymentId);
    
    if (!monitor) {
      throw new Error(`No active rollback monitor found for deployment ${deploymentId}`);
    }

    try {
      // Stop monitoring processes
      this._stopContinuousMonitoring(deploymentId);

      // Clean up state backup if old enough
      const stateBackup = this.stateBackups.get(deploymentId);
      if (stateBackup && (Date.now() - stateBackup.timestamp) > this.config.stateBackupRetention) {
        await this._cleanupStateBackup(deploymentId);
      }

      this.emit('rollbackMonitoringStopped', {
        deploymentId,
        monitoringDuration: Date.now() - monitor.startTime,
        failureCount: monitor.failureCount,
        timestamp: new Date().toISOString()
      });

      this.activeRollbacks.delete(deploymentId);
      
      return monitor;

    } catch (error) {
      this.emit('rollbackMonitoringError', {
        deploymentId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  /**
   * Trigger automatic rollback based on failure conditions
   */
  async triggerAutoRollback(deploymentId, reason, triggerData = {}) {
    const monitor = this.activeRollbacks.get(deploymentId);
    
    if (!monitor) {
      throw new Error(`No active rollback monitor found for deployment ${deploymentId}`);
    }

    if (!monitor.options.enableAutoRollback) {
      this.emit('rollbackTriggered', {
        deploymentId,
        reason,
        action: 'skipped-disabled',
        timestamp: new Date().toISOString()
      });
      return { skipped: true, reason: 'Auto-rollback disabled' };
    }

    try {
      const rollbackId = `rollback-${deploymentId}-${Date.now()}`;
      
      // Check if we're in cooldown period
      if (this._isInCooldownPeriod(monitor)) {
        this.emit('rollbackTriggered', {
          deploymentId,
          rollbackId,
          reason,
          action: 'skipped-cooldown',
          timestamp: new Date().toISOString()
        });
        return { skipped: true, reason: 'Rollback cooldown period active' };
      }

      // Check rollback attempt limits
      if (monitor.rollbackAttempts >= this.config.maxRollbackAttempts) {
        this.emit('rollbackTriggered', {
          deploymentId,
          rollbackId,
          reason,
          action: 'skipped-max-attempts',
          timestamp: new Date().toISOString()
        });
        return { skipped: true, reason: 'Maximum rollback attempts reached' };
      }

      // Create rollback execution plan
      const rollbackPlan = await this._createRollbackPlan(monitor, reason, triggerData);
      
      this.emit('rollbackTriggered', {
        deploymentId,
        rollbackId,
        reason,
        plan: rollbackPlan,
        action: 'executing',
        timestamp: new Date().toISOString()
      });

      // Execute rollback
      const rollbackResult = await this._executeRollback(rollbackId, rollbackPlan);
      
      // Update metrics
      this._updateRollbackMetrics(rollbackResult);
      
      // Log to audit trail
      if (this.config.enableAuditLogging) {
        await this._auditLogRollback(rollbackId, rollbackPlan, rollbackResult);
      }

      return rollbackResult;

    } catch (error) {
      this.emit('rollbackError', {
        deploymentId,
        reason,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  /**
   * Manually trigger rollback
   */
  async triggerManualRollback(deploymentId, targetRevision = null, reason = 'Manual rollback', options = {}) {
    const monitor = this.activeRollbacks.get(deploymentId);
    
    if (!monitor) {
      throw new Error(`No active rollback monitor found for deployment ${deploymentId}`);
    }

    try {
      const rollbackId = `manual-rollback-${deploymentId}-${Date.now()}`;
      
      // Create manual rollback plan
      const rollbackPlan = await this._createManualRollbackPlan(
        monitor, 
        targetRevision, 
        reason, 
        options
      );
      
      this.emit('manualRollbackTriggered', {
        deploymentId,
        rollbackId,
        targetRevision,
        reason,
        plan: rollbackPlan,
        timestamp: new Date().toISOString()
      });

      // Execute rollback
      const rollbackResult = await this._executeRollback(rollbackId, rollbackPlan);
      
      // Update metrics
      rollbackResult.type = 'manual';
      this._updateRollbackMetrics(rollbackResult);
      
      // Log to audit trail
      if (this.config.enableAuditLogging) {
        await this._auditLogRollback(rollbackId, rollbackPlan, rollbackResult);
      }

      return rollbackResult;

    } catch (error) {
      this.emit('rollbackError', {
        deploymentId,
        reason,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  /**
   * Validate rollback success
   */
  async validateRollback(rollbackId) {
    const rollbackRecord = this.rollbackHistory.find(r => r.rollbackId === rollbackId);
    
    if (!rollbackRecord) {
      throw new Error(`Rollback record not found for ID: ${rollbackId}`);
    }

    try {
      const validationStartTime = Date.now();
      
      this.emit('rollbackValidationStarted', {
        rollbackId,
        deployment: rollbackRecord.plan.deploymentId,
        timestamp: new Date().toISOString()
      });

      // Perform comprehensive validation
      const validationResults = await this._performRollbackValidation(rollbackRecord);
      
      const validationTime = Date.now() - validationStartTime;
      
      this.emit('rollbackValidationCompleted', {
        rollbackId,
        results: validationResults,
        validationTime,
        timestamp: new Date().toISOString()
      });

      // Update rollback record with validation results
      rollbackRecord.validation = {
        ...validationResults,
        validationTime,
        timestamp: new Date().toISOString()
      };

      return validationResults;

    } catch (error) {
      this.emit('rollbackValidationError', {
        rollbackId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  /**
   * Get rollback status and history
   */
  getRollbackStatus(deploymentId = null) {
    if (deploymentId) {
      const monitor = this.activeRollbacks.get(deploymentId);
      return monitor ? {
        deploymentId,
        monitoring: true,
        ...monitor
      } : null;
    }

    return {
      activeMonitors: Array.from(this.activeRollbacks.values()),
      rollbackHistory: this.rollbackHistory.slice(-10), // Last 10 rollbacks
      metrics: this.rollbackMetrics,
      configuration: {
        enableAutoRollback: this.config.enableAutoRollback,
        thresholds: {
          healthCheckFailures: this.config.healthCheckFailureThreshold,
          errorRate: this.config.errorRateThreshold,
          responseTime: this.config.responseTimeThreshold,
          availability: this.config.availabilityThreshold
        }
      }
    };
  }

  // Private implementation methods

  _initializeFailurePatterns() {
    // Define common failure patterns that should trigger rollbacks
    this.failurePatterns.set('pod-crash-loop', {
      pattern: 'CrashLoopBackOff',
      weight: 0.8,
      description: 'Pods are crashing repeatedly'
    });

    this.failurePatterns.set('image-pull-failure', {
      pattern: 'ImagePullBackOff|ErrImagePull',
      weight: 0.9,
      description: 'Cannot pull container images'
    });

    this.failurePatterns.set('resource-exhaustion', {
      pattern: 'Insufficient memory|Insufficient cpu',
      weight: 0.7,
      description: 'Insufficient cluster resources'
    });

    this.failurePatterns.set('readiness-probe-failure', {
      pattern: 'Readiness probe failed',
      weight: 0.6,
      description: 'Readiness probes are failing'
    });

    this.failurePatterns.set('liveness-probe-failure', {
      pattern: 'Liveness probe failed',
      weight: 0.8,
      description: 'Liveness probes are failing'
    });
  }

  _startContinuousMonitoring(deploymentId) {
    const monitor = this.activeRollbacks.get(deploymentId);
    if (!monitor || monitor.monitoringTimer) return;

    monitor.monitoringTimer = setInterval(async () => {
      try {
        await this._performHealthCheck(deploymentId);
      } catch (error) {
        this.emit('healthCheckError', {
          deploymentId,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }, 30000); // Check every 30 seconds
  }

  _stopContinuousMonitoring(deploymentId) {
    const monitor = this.activeRollbacks.get(deploymentId);
    if (monitor && monitor.monitoringTimer) {
      clearInterval(monitor.monitoringTimer);
      delete monitor.monitoringTimer;
    }
  }

  async _performHealthCheck(deploymentId) {
    const monitor = this.activeRollbacks.get(deploymentId);
    if (!monitor) return;

    try {
      // Get current deployment health status
      const healthStatus = await this._getDeploymentHealthStatus(
        monitor.releaseName, 
        monitor.namespace
      );

      monitor.lastHealthCheck = {
        timestamp: Date.now(),
        status: healthStatus,
        healthy: healthStatus.overall.healthy
      };

      // Evaluate failure conditions
      if (!healthStatus.overall.healthy) {
        monitor.healthCheckFailures++;
        
        // Check if we should trigger rollback
        const shouldRollback = await this._evaluateRollbackTriggers(deploymentId, healthStatus);
        
        if (shouldRollback) {
          await this.triggerAutoRollback(
            deploymentId, 
            'health-check-failure', 
            { healthStatus }
          );
        }
      } else {
        // Reset failure count on successful health check
        monitor.healthCheckFailures = Math.max(0, monitor.healthCheckFailures - 1);
      }

    } catch (error) {
      monitor.failureCount++;
      this.emit('healthCheckFailed', {
        deploymentId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  async _getDeploymentHealthStatus(releaseName, namespace) {
    try {
      // Get pods health
      const pods = await this.kubernetesClient.getPodsByLabel(
        namespace,
        `app.kubernetes.io/instance=${releaseName}`
      );

      const podHealth = pods.map(pod => ({
        name: pod.metadata.name,
        healthy: this._isPodHealthy(pod),
        status: pod.status.phase,
        restarts: pod.status.containerStatuses?.reduce(
          (total, container) => total + container.restartCount, 0
        ) || 0
      }));

      // Get service health
      const services = await this.kubernetesClient.getServicesByLabel(
        namespace,
        `app.kubernetes.io/instance=${releaseName}`
      );

      const serviceHealth = [];
      for (const service of services) {
        const endpoints = await this.kubernetesClient.getEndpoints(
          service.metadata.name, 
          namespace
        );
        
        serviceHealth.push({
          name: service.metadata.name,
          healthy: endpoints && endpoints.subsets && endpoints.subsets.length > 0,
          endpointCount: endpoints?.subsets?.length || 0
        });
      }

      // Calculate overall health
      const healthyPods = podHealth.filter(p => p.healthy).length;
      const healthyServices = serviceHealth.filter(s => s.healthy).length;
      const totalPods = podHealth.length;
      const totalServices = serviceHealth.length;

      const overallHealthy = totalPods > 0 && 
        (healthyPods / totalPods) >= this.config.availabilityThreshold &&
        (totalServices === 0 || healthyServices === totalServices);

      return {
        overall: {
          healthy: overallHealthy,
          availability: totalPods > 0 ? (healthyPods / totalPods) : 1
        },
        pods: podHealth,
        services: serviceHealth,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        overall: { healthy: false, error: error.message },
        pods: [],
        services: [],
        timestamp: new Date().toISOString()
      };
    }
  }

  async _evaluateRollbackTriggers(deploymentId, healthStatus) {
    const monitor = this.activeRollbacks.get(deploymentId);
    if (!monitor) return false;

    // Health check failure threshold
    if (monitor.healthCheckFailures >= this.config.healthCheckFailureThreshold) {
      monitor.rollbackTriggers.push({
        type: 'health-check-failure',
        threshold: this.config.healthCheckFailureThreshold,
        actual: monitor.healthCheckFailures,
        timestamp: Date.now()
      });
      return true;
    }

    // Availability threshold
    if (healthStatus.overall.availability < this.config.availabilityThreshold) {
      monitor.rollbackTriggers.push({
        type: 'availability-threshold',
        threshold: this.config.availabilityThreshold,
        actual: healthStatus.overall.availability,
        timestamp: Date.now()
      });
      return true;
    }

    // Check for critical failure patterns
    const criticalFailures = await this._detectFailurePatterns(
      monitor.releaseName, 
      monitor.namespace
    );

    if (criticalFailures.length > 0) {
      monitor.rollbackTriggers.push({
        type: 'failure-pattern',
        patterns: criticalFailures,
        timestamp: Date.now()
      });
      return true;
    }

    return false;
  }

  async _detectFailurePatterns(releaseName, namespace) {
    try {
      const events = await this.kubernetesClient.getEvents(namespace);
      const recentEvents = events.filter(event => 
        new Date(event.firstTimestamp).getTime() > (Date.now() - 300000) // Last 5 minutes
      );

      const detectedPatterns = [];

      for (const [patternName, pattern] of this.failurePatterns.entries()) {
        const matchingEvents = recentEvents.filter(event => 
          new RegExp(pattern.pattern, 'i').test(event.message || event.reason)
        );

        if (matchingEvents.length > 0) {
          detectedPatterns.push({
            name: patternName,
            pattern: pattern.pattern,
            weight: pattern.weight,
            description: pattern.description,
            eventCount: matchingEvents.length,
            events: matchingEvents.slice(0, 3) // Include up to 3 sample events
          });
        }
      }

      return detectedPatterns.filter(pattern => pattern.weight >= 0.7); // Critical patterns only

    } catch (error) {
      return [];
    }
  }

  async _createStateBackup(deploymentId, releaseName, namespace) {
    try {
      // Get current release info
      const releaseInfo = await this.helmCLI.getRelease(releaseName, namespace);
      
      // Get current resource states
      const resources = await this.kubernetesClient.getResourcesByLabel(
        namespace,
        `app.kubernetes.io/instance=${releaseName}`
      );

      const stateBackup = {
        deploymentId,
        releaseName,
        namespace,
        timestamp: Date.now(),
        release: releaseInfo,
        resources: resources.map(resource => ({
          kind: resource.kind,
          name: resource.metadata.name,
          namespace: resource.metadata.namespace,
          spec: resource.spec,
          status: resource.status
        }))
      };

      this.stateBackups.set(deploymentId, stateBackup);

      this.emit('stateBackupCreated', {
        deploymentId,
        resourceCount: resources.length,
        timestamp: new Date().toISOString()
      });

      return stateBackup;

    } catch (error) {
      this.emit('stateBackupError', {
        deploymentId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  async _createRollbackPlan(monitor, reason, triggerData) {
    try {
      // Get current and previous release information
      const currentRelease = await this.helmCLI.getRelease(
        monitor.releaseName, 
        monitor.namespace
      );

      const releaseHistory = await this.helmCLI.getReleaseHistory(
        monitor.releaseName, 
        monitor.namespace
      );

      // Find the last successful revision
      const lastSuccessfulRevision = releaseHistory.find(revision => 
        revision.status === 'deployed' && revision.revision < currentRelease.revision
      );

      if (!lastSuccessfulRevision) {
        throw new Error('No successful revision found for rollback');
      }

      return {
        deploymentId: monitor.deploymentId,
        releaseName: monitor.releaseName,
        namespace: monitor.namespace,
        type: 'automatic',
        reason,
        triggerData,
        source: {
          revision: currentRelease.revision,
          chart: currentRelease.chart,
          status: currentRelease.status
        },
        target: {
          revision: lastSuccessfulRevision.revision,
          chart: lastSuccessfulRevision.chart,
          status: lastSuccessfulRevision.status
        },
        strategy: monitor.options.rollbackStrategy,
        stateBackup: this.stateBackups.get(monitor.deploymentId),
        createdAt: new Date().toISOString()
      };

    } catch (error) {
      throw new Error(`Failed to create rollback plan: ${error.message}`);
    }
  }

  async _createManualRollbackPlan(monitor, targetRevision, reason, options) {
    try {
      const currentRelease = await this.helmCLI.getRelease(
        monitor.releaseName, 
        monitor.namespace
      );

      const releaseHistory = await this.helmCLI.getReleaseHistory(
        monitor.releaseName, 
        monitor.namespace
      );

      let targetRelease;
      if (targetRevision) {
        targetRelease = releaseHistory.find(r => r.revision === targetRevision);
        if (!targetRelease) {
          throw new Error(`Target revision ${targetRevision} not found`);
        }
      } else {
        // Find the last successful revision
        targetRelease = releaseHistory.find(revision => 
          revision.status === 'deployed' && revision.revision < currentRelease.revision
        );
      }

      if (!targetRelease) {
        throw new Error('No valid target revision found for rollback');
      }

      return {
        deploymentId: monitor.deploymentId,
        releaseName: monitor.releaseName,
        namespace: monitor.namespace,
        type: 'manual',
        reason,
        source: {
          revision: currentRelease.revision,
          chart: currentRelease.chart,
          status: currentRelease.status
        },
        target: {
          revision: targetRelease.revision,
          chart: targetRelease.chart,
          status: targetRelease.status
        },
        strategy: options.rollbackStrategy || this.config.rollbackStrategy,
        stateBackup: this.stateBackups.get(monitor.deploymentId),
        options,
        createdAt: new Date().toISOString()
      };

    } catch (error) {
      throw new Error(`Failed to create manual rollback plan: ${error.message}`);
    }
  }

  async _executeRollback(rollbackId, plan) {
    const startTime = Date.now();
    
    try {
      this.emit('rollbackStarted', {
        rollbackId,
        plan,
        timestamp: new Date().toISOString()
      });

      // Execute Helm rollback
      const rollbackResult = await this.helmCLI.rollback(
        plan.releaseName,
        plan.namespace,
        plan.target.revision,
        {
          timeout: this.config.rollbackValidationTimeout,
          wait: true,
          cleanupOnFail: true
        }
      );

      const executionTime = Date.now() - startTime;

      // Validate rollback success
      let validationResult = { passed: true };
      if (this.config.enableRollbackValidation) {
        validationResult = await this._performRollbackValidation({
          rollbackId,
          plan,
          result: rollbackResult
        });
      }

      const finalResult = {
        rollbackId,
        plan,
        result: rollbackResult,
        validation: validationResult,
        executionTime,
        success: rollbackResult.success && validationResult.passed,
        timestamp: new Date().toISOString()
      };

      // Record in history
      this.rollbackHistory.push(finalResult);

      // Update monitor
      const monitor = this.activeRollbacks.get(plan.deploymentId);
      if (monitor) {
        monitor.rollbackAttempts = (monitor.rollbackAttempts || 0) + 1;
        monitor.lastRollback = finalResult;
      }

      this.emit('rollbackCompleted', {
        rollbackId,
        success: finalResult.success,
        executionTime,
        timestamp: new Date().toISOString()
      });

      return finalResult;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      const failureResult = {
        rollbackId,
        plan,
        success: false,
        error: error.message,
        executionTime,
        timestamp: new Date().toISOString()
      };

      this.rollbackHistory.push(failureResult);

      this.emit('rollbackFailed', {
        rollbackId,
        error: error.message,
        executionTime,
        timestamp: new Date().toISOString()
      });

      return failureResult;
    }
  }

  async _performRollbackValidation(rollbackRecord) {
    const { plan } = rollbackRecord;
    
    try {
      const validation = {
        passed: true,
        checks: {},
        issues: [],
        timestamp: new Date().toISOString()
      };

      // Validate release status
      const currentRelease = await this.helmCLI.getRelease(plan.releaseName, plan.namespace);
      validation.checks.releaseStatus = {
        passed: currentRelease.status === 'deployed',
        expected: 'deployed',
        actual: currentRelease.status
      };

      if (!validation.checks.releaseStatus.passed) {
        validation.passed = false;
        validation.issues.push('Release is not in deployed status');
      }

      // Validate revision rollback
      validation.checks.revisionRollback = {
        passed: currentRelease.revision === plan.target.revision,
        expected: plan.target.revision,
        actual: currentRelease.revision
      };

      if (!validation.checks.revisionRollback.passed) {
        validation.passed = false;
        validation.issues.push('Revision was not rolled back to expected version');
      }

      // Validate resource health
      const healthStatus = await this._getDeploymentHealthStatus(
        plan.releaseName, 
        plan.namespace
      );

      validation.checks.resourceHealth = {
        passed: healthStatus.overall.healthy,
        availability: healthStatus.overall.availability,
        podHealth: healthStatus.pods.filter(p => p.healthy).length,
        totalPods: healthStatus.pods.length
      };

      if (!validation.checks.resourceHealth.passed) {
        validation.passed = false;
        validation.issues.push('Resources are not healthy after rollback');
      }

      return validation;

    } catch (error) {
      return {
        passed: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  async _auditLogRollback(rollbackId, plan, result) {
    const auditEntry = {
      rollbackId,
      timestamp: new Date().toISOString(),
      deploymentId: plan.deploymentId,
      releaseName: plan.releaseName,
      namespace: plan.namespace,
      type: plan.type,
      reason: plan.reason,
      source: plan.source,
      target: plan.target,
      success: result.success,
      executionTime: result.executionTime,
      validation: result.validation,
      triggerData: plan.triggerData,
      user: process.env.USER || 'system',
      decision: {
        triggers: plan.triggerData?.triggers || [],
        thresholds: {
          healthCheckFailures: this.config.healthCheckFailureThreshold,
          errorRate: this.config.errorRateThreshold,
          availability: this.config.availabilityThreshold
        },
        automaticTrigger: plan.type === 'automatic'
      }
    };

    // In production, this would write to audit log system
    this.emit('auditLog', auditEntry);
  }

  // Helper methods

  _isInCooldownPeriod(monitor) {
    if (!monitor.lastRollback) return false;
    
    const timeSinceLastRollback = Date.now() - new Date(monitor.lastRollback.timestamp).getTime();
    return timeSinceLastRollback < this.config.rollbackCooldownPeriod;
  }

  _isPodHealthy(pod) {
    return pod.status?.phase === 'Running' &&
           pod.status?.conditions?.some(c => c.type === 'Ready' && c.status === 'True');
  }

  _updateRollbackMetrics(result) {
    this.rollbackMetrics.totalRollbacks++;
    
    if (result.success) {
      this.rollbackMetrics.successfulRollbacks++;
    } else {
      this.rollbackMetrics.failedRollbacks++;
    }

    if (result.type === 'automatic') {
      this.rollbackMetrics.automaticRollbacks++;
    } else {
      this.rollbackMetrics.manualRollbacks++;
    }

    // Update moving average
    const currentAvg = this.rollbackMetrics.averageRollbackTime;
    const count = this.rollbackMetrics.totalRollbacks;
    this.rollbackMetrics.averageRollbackTime = 
      (currentAvg * (count - 1) + result.executionTime) / count;
    
    this.rollbackMetrics.lastRollbackTime = result.executionTime;
  }

  async _cleanupStateBackup(deploymentId) {
    const backup = this.stateBackups.get(deploymentId);
    if (backup) {
      this.stateBackups.delete(deploymentId);
      
      this.emit('stateBackupCleaned', {
        deploymentId,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Stop all rollback monitoring
   */
  stopAllMonitoring() {
    const activeIds = Array.from(this.activeRollbacks.keys());
    
    for (const deploymentId of activeIds) {
      this.stopRollbackMonitoring(deploymentId).catch(error => {
        this.emit('rollbackMonitoringError', {
          deploymentId,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      });
    }
  }

  /**
   * Get rollback metrics
   */
  getRollbackMetrics() {
    return {
      ...this.rollbackMetrics,
      activeMonitors: this.activeRollbacks.size,
      stateBackups: this.stateBackups.size,
      rollbackHistorySize: this.rollbackHistory.length,
      successRate: this.rollbackMetrics.totalRollbacks > 0 ? 
        (this.rollbackMetrics.successfulRollbacks / this.rollbackMetrics.totalRollbacks) * 100 : 0
    };
  }
}

module.exports = { RollbackAutomation };