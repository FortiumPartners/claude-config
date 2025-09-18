/**
 * Deployment Monitor - Enhanced for Task 3.3
 * 
 * Real-time deployment monitoring system:
 * - Live deployment progress tracking
 * - Resource health monitoring and status updates
 * - Event stream processing and aggregation
 * - Progress reporting with percentage completion
 * - Failure detection and alert generation
 * - Metrics collection and performance tracking
 * 
 * Part of: Phase 2 - Week 5 - Sprint 3: Deployment Automation
 * Task: 3.3 Deployment Monitoring Enhancement
 */

const { EventEmitter } = require('events');
const { KubernetesClient } = require('../utils/kubernetes-client');

/**
 * Deployment Monitor Class
 * 
 * Provides comprehensive real-time monitoring for Helm deployments
 * with live status updates, health checks, and failure detection
 */
class DeploymentMonitor extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      pollingInterval: config.pollingInterval || 2000, // 2 seconds
      healthCheckInterval: config.healthCheckInterval || 5000, // 5 seconds
      eventStreamTimeout: config.eventStreamTimeout || 300000, // 5 minutes
      progressUpdateInterval: config.progressUpdateInterval || 1000, // 1 second
      failureDetectionThreshold: config.failureDetectionThreshold || 0.05, // 5% error rate
      maxRetryAttempts: config.maxRetryAttempts || 3,
      enableMetricsCollection: config.enableMetricsCollection !== false,
      enableEventStreaming: config.enableEventStreaming !== false,
      enableProgressReporting: config.enableProgressReporting !== false,
      ...config
    };

    this.kubernetesClient = new KubernetesClient(this.config);
    this.activeMonitors = new Map();
    this.metrics = {
      totalDeployments: 0,
      successfulDeployments: 0,
      failedDeployments: 0,
      averageDeploymentTime: 0,
      lastDeploymentTime: null
    };
    
    this.eventStreamBuffer = [];
    this.healthCheckResults = new Map();
    this.progressTrackers = new Map();
  }

  /**
   * Start monitoring a deployment
   */
  async startDeploymentMonitoring(deploymentId, releaseName, namespace, options = {}) {
    try {
      const monitor = {
        deploymentId,
        releaseName,
        namespace,
        startTime: Date.now(),
        status: 'starting',
        progress: 0,
        phase: 'initialization',
        resources: [],
        events: [],
        healthChecks: [],
        metrics: {
          startTime: Date.now(),
          lastUpdate: Date.now(),
          progressUpdates: 0,
          healthChecks: 0,
          eventsProcessed: 0
        },
        options: {
          enableHealthChecks: options.enableHealthChecks !== false,
          enableEventStreaming: options.enableEventStreaming !== false,
          enableProgressReporting: options.enableProgressReporting !== false,
          ...options
        }
      };

      this.activeMonitors.set(deploymentId, monitor);
      
      this.emit('monitoringStarted', {
        deploymentId,
        releaseName,
        namespace,
        timestamp: new Date().toISOString()
      });

      // Start monitoring processes
      await this._initializeMonitoring(monitor);
      
      if (this.config.enableProgressReporting) {
        this._startProgressReporting(deploymentId);
      }
      
      if (this.config.enableEventStreaming) {
        this._startEventStreaming(deploymentId);
      }
      
      return monitor;

    } catch (error) {
      this.emit('monitoringError', {
        deploymentId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  /**
   * Stop monitoring a deployment
   */
  async stopDeploymentMonitoring(deploymentId) {
    const monitor = this.activeMonitors.get(deploymentId);
    
    if (!monitor) {
      throw new Error(`No active monitor found for deployment ${deploymentId}`);
    }

    try {
      // Stop all monitoring processes
      this._stopProgressReporting(deploymentId);
      this._stopEventStreaming(deploymentId);
      this._stopHealthChecking(deploymentId);

      // Calculate final metrics
      const totalTime = Date.now() - monitor.startTime;
      monitor.metrics.totalTime = totalTime;
      monitor.status = 'stopped';

      // Update global metrics
      this._updateGlobalMetrics(monitor);

      this.emit('monitoringStopped', {
        deploymentId,
        totalTime,
        finalStatus: monitor.status,
        timestamp: new Date().toISOString()
      });

      // Remove from active monitors
      this.activeMonitors.delete(deploymentId);
      
      return monitor;

    } catch (error) {
      this.emit('monitoringError', {
        deploymentId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  /**
   * Get real-time deployment status
   */
  async getDeploymentStatus(deploymentId) {
    const monitor = this.activeMonitors.get(deploymentId);
    
    if (!monitor) {
      throw new Error(`No active monitor found for deployment ${deploymentId}`);
    }

    try {
      // Get fresh status from Kubernetes
      const releaseStatus = await this._getHelmReleaseStatus(monitor.releaseName, monitor.namespace);
      const resourceStatus = await this._getResourceStatus(monitor.releaseName, monitor.namespace);
      const healthStatus = await this._performHealthChecks(monitor.releaseName, monitor.namespace);

      // Update monitor with latest information
      monitor.status = releaseStatus.status;
      monitor.progress = this._calculateProgress(releaseStatus, resourceStatus);
      monitor.phase = this._determineDeploymentPhase(releaseStatus, resourceStatus);
      monitor.resources = resourceStatus;
      monitor.healthChecks = healthStatus;
      monitor.metrics.lastUpdate = Date.now();

      this.emit('statusUpdate', {
        deploymentId,
        status: monitor.status,
        progress: monitor.progress,
        phase: monitor.phase,
        timestamp: new Date().toISOString()
      });

      return {
        deploymentId,
        releaseName: monitor.releaseName,
        namespace: monitor.namespace,
        status: monitor.status,
        progress: monitor.progress,
        phase: monitor.phase,
        resources: monitor.resources,
        healthChecks: monitor.healthChecks,
        metrics: monitor.metrics,
        uptime: Date.now() - monitor.startTime
      };

    } catch (error) {
      this.emit('statusError', {
        deploymentId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  /**
   * Get deployment metrics and performance data
   */
  getDeploymentMetrics(deploymentId) {
    if (deploymentId) {
      const monitor = this.activeMonitors.get(deploymentId);
      return monitor ? monitor.metrics : null;
    }

    // Return global metrics
    return {
      ...this.metrics,
      activeDeployments: this.activeMonitors.size,
      totalEventsSteamed: this.eventStreamBuffer.length,
      healthCheckResults: this.healthCheckResults.size,
      averageSuccessRate: this.metrics.totalDeployments > 0 ? 
        (this.metrics.successfulDeployments / this.metrics.totalDeployments) * 100 : 0
    };
  }

  /**
   * Get deployment events stream
   */
  getDeploymentEvents(deploymentId, since = null) {
    const monitor = this.activeMonitors.get(deploymentId);
    
    if (!monitor) {
      throw new Error(`No active monitor found for deployment ${deploymentId}`);
    }

    let events = monitor.events;
    
    if (since) {
      const sinceTime = new Date(since).getTime();
      events = events.filter(event => new Date(event.timestamp).getTime() > sinceTime);
    }

    return {
      deploymentId,
      events,
      totalEvents: monitor.events.length,
      lastEventTime: monitor.events.length > 0 ? 
        monitor.events[monitor.events.length - 1].timestamp : null
    };
  }

  /**
   * Force health check for deployment
   */
  async performHealthCheck(deploymentId) {
    const monitor = this.activeMonitors.get(deploymentId);
    
    if (!monitor) {
      throw new Error(`No active monitor found for deployment ${deploymentId}`);
    }

    try {
      const healthStatus = await this._performHealthChecks(monitor.releaseName, monitor.namespace);
      monitor.healthChecks = healthStatus;
      monitor.metrics.healthChecks++;
      monitor.metrics.lastUpdate = Date.now();

      this.emit('healthCheck', {
        deploymentId,
        healthStatus,
        timestamp: new Date().toISOString()
      });

      // Check for failures
      const unhealthyResources = healthStatus.filter(check => !check.healthy);
      if (unhealthyResources.length > 0) {
        this._handleHealthCheckFailures(deploymentId, unhealthyResources);
      }

      return healthStatus;

    } catch (error) {
      this.emit('healthCheckError', {
        deploymentId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  // Private monitoring methods

  async _initializeMonitoring(monitor) {
    try {
      // Get initial deployment state
      const releaseStatus = await this._getHelmReleaseStatus(monitor.releaseName, monitor.namespace);
      const resourceStatus = await this._getResourceStatus(monitor.releaseName, monitor.namespace);

      monitor.status = releaseStatus.status;
      monitor.resources = resourceStatus;
      monitor.progress = this._calculateProgress(releaseStatus, resourceStatus);
      monitor.phase = this._determineDeploymentPhase(releaseStatus, resourceStatus);

      this.emit('monitoringInitialized', {
        deploymentId: monitor.deploymentId,
        initialStatus: monitor.status,
        resourceCount: resourceStatus.length,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      monitor.status = 'initialization-failed';
      throw new Error(`Failed to initialize monitoring: ${error.message}`);
    }
  }

  _startProgressReporting(deploymentId) {
    const monitor = this.activeMonitors.get(deploymentId);
    if (!monitor || monitor.progressTimer) return;

    monitor.progressTimer = setInterval(async () => {
      try {
        await this._updateProgress(deploymentId);
      } catch (error) {
        this.emit('progressError', {
          deploymentId,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }, this.config.progressUpdateInterval);
  }

  _stopProgressReporting(deploymentId) {
    const monitor = this.activeMonitors.get(deploymentId);
    if (monitor && monitor.progressTimer) {
      clearInterval(monitor.progressTimer);
      delete monitor.progressTimer;
    }
  }

  async _updateProgress(deploymentId) {
    const monitor = this.activeMonitors.get(deploymentId);
    if (!monitor) return;

    try {
      const releaseStatus = await this._getHelmReleaseStatus(monitor.releaseName, monitor.namespace);
      const resourceStatus = await this._getResourceStatus(monitor.releaseName, monitor.namespace);

      const previousProgress = monitor.progress;
      monitor.progress = this._calculateProgress(releaseStatus, resourceStatus);
      monitor.phase = this._determineDeploymentPhase(releaseStatus, resourceStatus);
      monitor.status = releaseStatus.status;
      monitor.metrics.progressUpdates++;
      monitor.metrics.lastUpdate = Date.now();

      // Emit progress update if changed
      if (monitor.progress !== previousProgress) {
        this.emit('progressUpdate', {
          deploymentId,
          progress: monitor.progress,
          phase: monitor.phase,
          status: monitor.status,
          estimatedTimeRemaining: this._estimateTimeRemaining(monitor),
          timestamp: new Date().toISOString()
        });
      }

      // Check for completion
      if (monitor.progress >= 100 || releaseStatus.status === 'deployed') {
        this._handleDeploymentCompletion(deploymentId);
      }

    } catch (error) {
      this.emit('progressError', {
        deploymentId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  _startEventStreaming(deploymentId) {
    const monitor = this.activeMonitors.get(deploymentId);
    if (!monitor || monitor.eventTimer) return;

    monitor.eventTimer = setInterval(async () => {
      try {
        await this._processEvents(deploymentId);
      } catch (error) {
        this.emit('eventStreamError', {
          deploymentId,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }, this.config.pollingInterval);
  }

  _stopEventStreaming(deploymentId) {
    const monitor = this.activeMonitors.get(deploymentId);
    if (monitor && monitor.eventTimer) {
      clearInterval(monitor.eventTimer);
      delete monitor.eventTimer;
    }
  }

  async _processEvents(deploymentId) {
    const monitor = this.activeMonitors.get(deploymentId);
    if (!monitor) return;

    try {
      // Get Kubernetes events for the release
      const events = await this._getKubernetesEvents(monitor.releaseName, monitor.namespace);
      
      // Filter new events
      const lastEventTime = monitor.events.length > 0 ? 
        new Date(monitor.events[monitor.events.length - 1].timestamp).getTime() : 
        monitor.startTime;

      const newEvents = events.filter(event => 
        new Date(event.timestamp).getTime() > lastEventTime
      );

      // Process and emit new events
      for (const event of newEvents) {
        const processedEvent = this._processEvent(event);
        monitor.events.push(processedEvent);
        monitor.metrics.eventsProcessed++;

        this.emit('deploymentEvent', {
          deploymentId,
          event: processedEvent,
          timestamp: new Date().toISOString()
        });

        // Check for failure patterns
        if (this._isFailureEvent(processedEvent)) {
          this._handleEventFailure(deploymentId, processedEvent);
        }
      }

    } catch (error) {
      this.emit('eventProcessingError', {
        deploymentId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  _stopHealthChecking(deploymentId) {
    const monitor = this.activeMonitors.get(deploymentId);
    if (monitor && monitor.healthTimer) {
      clearInterval(monitor.healthTimer);
      delete monitor.healthTimer;
    }
  }

  // Kubernetes interaction methods

  async _getHelmReleaseStatus(releaseName, namespace) {
    try {
      // Mock Helm release status - would use actual Helm CLI
      return {
        name: releaseName,
        namespace,
        status: 'deployed', // pending-install, pending-upgrade, deployed, failed
        revision: 1,
        updated: new Date().toISOString(),
        chart: 'monitoring-web-service-1.0.0',
        appVersion: '1.0.0'
      };
    } catch (error) {
      throw new Error(`Failed to get Helm release status: ${error.message}`);
    }
  }

  async _getResourceStatus(releaseName, namespace) {
    try {
      // Get all resources for the release
      const resources = await this.kubernetesClient.getResourcesByLabel(
        namespace,
        `app.kubernetes.io/instance=${releaseName}`
      );

      return resources.map(resource => ({
        kind: resource.kind,
        name: resource.metadata.name,
        namespace: resource.metadata.namespace,
        status: this._getResourceStatus(resource),
        ready: this._isResourceReady(resource),
        conditions: resource.status?.conditions || [],
        creationTimestamp: resource.metadata.creationTimestamp
      }));

    } catch (error) {
      // Return empty array if resources not found
      return [];
    }
  }

  async _performHealthChecks(releaseName, namespace) {
    try {
      const healthChecks = [];
      
      // Check pods health
      const pods = await this.kubernetesClient.getPodsByLabel(
        namespace,
        `app.kubernetes.io/instance=${releaseName}`
      );

      for (const pod of pods) {
        healthChecks.push({
          type: 'pod',
          name: pod.metadata.name,
          healthy: this._isPodHealthy(pod),
          status: pod.status.phase,
          conditions: pod.status.conditions || [],
          containers: pod.status.containerStatuses?.map(container => ({
            name: container.name,
            ready: container.ready,
            restartCount: container.restartCount,
            image: container.image
          })) || []
        });
      }

      // Check services health
      const services = await this.kubernetesClient.getServicesByLabel(
        namespace,
        `app.kubernetes.io/instance=${releaseName}`
      );

      for (const service of services) {
        const endpoints = await this.kubernetesClient.getEndpoints(service.metadata.name, namespace);
        healthChecks.push({
          type: 'service',
          name: service.metadata.name,
          healthy: endpoints && endpoints.subsets && endpoints.subsets.length > 0,
          endpoints: endpoints?.subsets?.length || 0,
          ports: service.spec.ports || []
        });
      }

      return healthChecks;

    } catch (error) {
      throw new Error(`Health check failed: ${error.message}`);
    }
  }

  async _getKubernetesEvents(releaseName, namespace) {
    try {
      // Get events related to the deployment
      const events = await this.kubernetesClient.getEvents(namespace);
      
      // Filter events related to our release
      return events.filter(event => 
        event.involvedObject && (
          event.involvedObject.name?.includes(releaseName) ||
          event.reason?.includes('Scheduled') ||
          event.reason?.includes('Pulled') ||
          event.reason?.includes('Created') ||
          event.reason?.includes('Started')
        )
      );

    } catch (error) {
      return [];
    }
  }

  // Progress and status calculation methods

  _calculateProgress(releaseStatus, resourceStatus) {
    if (releaseStatus.status === 'failed') {
      return 0;
    }

    if (releaseStatus.status === 'deployed' && resourceStatus.length > 0) {
      const readyResources = resourceStatus.filter(r => r.ready);
      return Math.round((readyResources.length / resourceStatus.length) * 100);
    }

    // Calculate based on deployment phases
    const phases = [
      'initialization', 'chart-validation', 'resource-creation', 
      'pod-scheduling', 'container-startup', 'readiness-checks', 'completion'
    ];

    const currentPhaseIndex = phases.indexOf(releaseStatus.phase || 'initialization');
    const baseProgress = (currentPhaseIndex / phases.length) * 100;

    return Math.round(Math.min(baseProgress + 10, 100));
  }

  _determineDeploymentPhase(releaseStatus, resourceStatus) {
    if (releaseStatus.status === 'failed') {
      return 'failed';
    }

    if (releaseStatus.status === 'deployed') {
      const allReady = resourceStatus.every(r => r.ready);
      return allReady ? 'completed' : 'stabilizing';
    }

    if (releaseStatus.status === 'pending-install') {
      return 'installing';
    }

    if (releaseStatus.status === 'pending-upgrade') {
      return 'upgrading';
    }

    return 'in-progress';
  }

  _estimateTimeRemaining(monitor) {
    const elapsed = Date.now() - monitor.startTime;
    const progressPercent = monitor.progress / 100;
    
    if (progressPercent <= 0) {
      return null;
    }

    const estimatedTotal = elapsed / progressPercent;
    const remaining = estimatedTotal - elapsed;
    
    return Math.max(0, Math.round(remaining / 1000)); // Return in seconds
  }

  // Resource status helpers

  _getResourceStatus(resource) {
    switch (resource.kind) {
      case 'Pod':
        return resource.status?.phase || 'Unknown';
      case 'Deployment':
        return resource.status?.conditions?.find(c => c.type === 'Available')?.status === 'True' ? 
          'Available' : 'Unavailable';
      case 'Service':
        return 'Active';
      case 'ConfigMap':
      case 'Secret':
        return 'Active';
      default:
        return 'Unknown';
    }
  }

  _isResourceReady(resource) {
    switch (resource.kind) {
      case 'Pod':
        return resource.status?.phase === 'Running' && 
               resource.status?.conditions?.some(c => c.type === 'Ready' && c.status === 'True');
      case 'Deployment':
        return resource.status?.readyReplicas === resource.status?.replicas;
      case 'Service':
        return true; // Services are ready when created
      case 'ConfigMap':
      case 'Secret':
        return true; // ConfigMaps and Secrets are ready when created
      default:
        return false;
    }
  }

  _isPodHealthy(pod) {
    return pod.status?.phase === 'Running' &&
           pod.status?.conditions?.some(c => c.type === 'Ready' && c.status === 'True') &&
           !pod.status?.containerStatuses?.some(c => c.restartCount > 5);
  }

  // Event processing methods

  _processEvent(event) {
    return {
      type: event.type,
      reason: event.reason,
      message: event.message,
      source: event.source?.component || 'kubernetes',
      object: {
        kind: event.involvedObject?.kind,
        name: event.involvedObject?.name,
        namespace: event.involvedObject?.namespace
      },
      timestamp: event.firstTimestamp || event.eventTime || new Date().toISOString(),
      count: event.count || 1
    };
  }

  _isFailureEvent(event) {
    const failureReasons = [
      'Failed', 'FailedScheduling', 'FailedMount', 'FailedAttachVolume',
      'FailedCreate', 'FailedDelete', 'ImagePullBackOff', 'ErrImagePull',
      'CrashLoopBackOff', 'Error', 'Warning'
    ];

    return failureReasons.some(reason => 
      event.reason?.includes(reason) || event.type === 'Warning'
    );
  }

  // Failure handling methods

  _handleEventFailure(deploymentId, event) {
    this.emit('deploymentFailure', {
      deploymentId,
      type: 'event-failure',
      event,
      severity: this._assessFailureSeverity(event),
      timestamp: new Date().toISOString()
    });
  }

  _handleHealthCheckFailures(deploymentId, unhealthyResources) {
    const monitor = this.activeMonitors.get(deploymentId);
    if (!monitor) return;

    const criticalFailures = unhealthyResources.filter(resource => 
      resource.type === 'pod' && !resource.healthy
    );

    if (criticalFailures.length > 0) {
      this.emit('deploymentFailure', {
        deploymentId,
        type: 'health-check-failure',
        unhealthyResources: criticalFailures,
        severity: 'high',
        timestamp: new Date().toISOString()
      });
    }
  }

  _handleDeploymentCompletion(deploymentId) {
    const monitor = this.activeMonitors.get(deploymentId);
    if (!monitor) return;

    this.emit('deploymentCompleted', {
      deploymentId,
      releaseName: monitor.releaseName,
      namespace: monitor.namespace,
      totalTime: Date.now() - monitor.startTime,
      finalProgress: monitor.progress,
      resourceCount: monitor.resources.length,
      eventCount: monitor.events.length,
      timestamp: new Date().toISOString()
    });

    // Stop monitoring
    this.stopDeploymentMonitoring(deploymentId).catch(error => {
      this.emit('monitoringError', {
        deploymentId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    });
  }

  _assessFailureSeverity(event) {
    const criticalReasons = ['CrashLoopBackOff', 'ImagePullBackOff', 'FailedScheduling'];
    const highReasons = ['Failed', 'Error'];
    
    if (criticalReasons.some(reason => event.reason?.includes(reason))) {
      return 'critical';
    }
    
    if (highReasons.some(reason => event.reason?.includes(reason))) {
      return 'high';
    }
    
    return 'medium';
  }

  // Metrics and performance tracking

  _updateGlobalMetrics(monitor) {
    this.metrics.totalDeployments++;
    
    if (monitor.status === 'deployed' || monitor.progress >= 100) {
      this.metrics.successfulDeployments++;
    } else {
      this.metrics.failedDeployments++;
    }

    const deploymentTime = monitor.metrics.totalTime || (Date.now() - monitor.startTime);
    
    // Update moving average
    const currentAvg = this.metrics.averageDeploymentTime;
    const count = this.metrics.totalDeployments;
    this.metrics.averageDeploymentTime = 
      (currentAvg * (count - 1) + deploymentTime) / count;
    
    this.metrics.lastDeploymentTime = deploymentTime;
  }

  // Cleanup and management methods

  /**
   * Stop all active monitoring
   */
  stopAllMonitoring() {
    const activeIds = Array.from(this.activeMonitors.keys());
    
    for (const deploymentId of activeIds) {
      this.stopDeploymentMonitoring(deploymentId).catch(error => {
        this.emit('monitoringError', {
          deploymentId,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      });
    }
  }

  /**
   * Get all active monitors
   */
  getActiveMonitors() {
    return Array.from(this.activeMonitors.values()).map(monitor => ({
      deploymentId: monitor.deploymentId,
      releaseName: monitor.releaseName,
      namespace: monitor.namespace,
      status: monitor.status,
      progress: monitor.progress,
      phase: monitor.phase,
      uptime: Date.now() - monitor.startTime
    }));
  }

  /**
   * Clear event stream buffer
   */
  clearEventBuffer() {
    this.eventStreamBuffer = [];
  }

  /**
   * Clear health check results
   */
  clearHealthCheckResults() {
    this.healthCheckResults.clear();
  }
}

module.exports = { DeploymentMonitor };