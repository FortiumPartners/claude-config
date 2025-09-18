/**
 * Helm Status Tracker
 * 
 * Provides real-time status tracking and monitoring for Helm operations:
 * - Real-time release status monitoring
 * - Health check automation and reporting
 * - Performance metrics collection and analysis
 * - Event streaming and notifications
 * 
 * Part of: Task 3.1 - Helm Deployment Engine Implementation
 */

const { EventEmitter } = require('events');
const { HelmCLI } = require('./utils/helm-cli');
const { ErrorHandler } = require('./utils/error-handler');

/**
 * Status Tracker Class
 * 
 * Manages comprehensive status tracking:
 * - Real-time status polling and updates
 * - Health monitoring with configurable checks
 * - Performance metrics and trend analysis
 * - Event aggregation and notification routing
 */
class StatusTracker extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      pollingInterval: config.pollingInterval || 5000, // 5 seconds
      healthCheckInterval: config.healthCheckInterval || 30000, // 30 seconds
      enableRealTimeMonitoring: config.enableRealTimeMonitoring !== false,
      enableHealthChecks: config.enableHealthChecks !== false,
      enableMetrics: config.enableMetrics !== false,
      maxStatusHistory: config.maxStatusHistory || 100,
      healthCheckRetries: config.healthCheckRetries || 3,
      unhealthyThreshold: config.unhealthyThreshold || 2, // failures before unhealthy
      performanceMetrics: config.performanceMetrics !== false,
      eventBufferSize: config.eventBufferSize || 1000,
      ...config
    };

    this.helmCLI = new HelmCLI(this.config);
    this.errorHandler = new ErrorHandler(this.config);
    
    this.activeMonitors = new Map(); // releaseName -> monitor data
    this.statusHistory = new Map(); // releaseName -> status history
    this.healthStatus = new Map(); // releaseName -> health status
    this.performanceData = new Map(); // releaseName -> performance metrics
    this.eventBuffer = [];
    
    this.pollingIntervals = new Map(); // releaseName -> interval ID
    this.healthCheckIntervals = new Map(); // releaseName -> interval ID
    
    this.isInitialized = false;
  }

  /**
   * Initialize the status tracker
   * 
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      await this.helmCLI.initialize();
      
      this.emit('trackerInitialized', {
        timestamp: new Date().toISOString(),
        config: {
          pollingInterval: this.config.pollingInterval,
          healthCheckInterval: this.config.healthCheckInterval,
          realTimeMonitoring: this.config.enableRealTimeMonitoring,
          healthChecks: this.config.enableHealthChecks
        }
      });
      
      this.isInitialized = true;
    } catch (error) {
      throw this.errorHandler.handle(error, {
        operation: 'initialize',
        context: 'status-tracker'
      });
    }
  }

  /**
   * Start monitoring a release
   * 
   * @param {string} releaseName - Name of the release to monitor
   * @param {string} namespace - Namespace (optional)
   * @param {object} options - Monitoring options
   * @returns {Promise<void>}
   */
  async startMonitoring(releaseName, namespace = null, options = {}) {
    await this.initialize();
    
    const monitorNamespace = namespace || this.config.namespace;
    const monitorKey = `${releaseName}:${monitorNamespace}`;
    
    if (this.activeMonitors.has(monitorKey)) {
      this.emit('alreadyMonitoring', { releaseName, namespace: monitorNamespace });
      return;
    }

    const monitorData = {
      releaseName,
      namespace: monitorNamespace,
      startTime: Date.now(),
      options: {
        customHealthChecks: options.customHealthChecks || [],
        alertThresholds: options.alertThresholds || {},
        ...options
      }
    };

    this.activeMonitors.set(monitorKey, monitorData);
    this.statusHistory.set(monitorKey, []);
    this.healthStatus.set(monitorKey, { status: 'unknown', lastCheck: null });
    this.performanceData.set(monitorKey, { metrics: [], trends: {} });

    // Start real-time monitoring if enabled
    if (this.config.enableRealTimeMonitoring) {
      await this._startStatusPolling(releaseName, monitorNamespace);
    }

    // Start health checks if enabled
    if (this.config.enableHealthChecks) {
      await this._startHealthChecks(releaseName, monitorNamespace);
    }

    this.emit('monitoringStarted', {
      releaseName,
      namespace: monitorNamespace,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Stop monitoring a release
   * 
   * @param {string} releaseName - Name of the release
   * @param {string} namespace - Namespace (optional)
   * @returns {Promise<void>}
   */
  async stopMonitoring(releaseName, namespace = null) {
    const monitorNamespace = namespace || this.config.namespace;
    const monitorKey = `${releaseName}:${monitorNamespace}`;
    
    if (!this.activeMonitors.has(monitorKey)) {
      return;
    }

    // Stop polling
    const pollingInterval = this.pollingIntervals.get(monitorKey);
    if (pollingInterval) {
      clearInterval(pollingInterval);
      this.pollingIntervals.delete(monitorKey);
    }

    // Stop health checks
    const healthInterval = this.healthCheckIntervals.get(monitorKey);
    if (healthInterval) {
      clearInterval(healthInterval);
      this.healthCheckIntervals.delete(monitorKey);
    }

    // Clean up data
    this.activeMonitors.delete(monitorKey);
    
    this.emit('monitoringStopped', {
      releaseName,
      namespace: monitorNamespace,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get current status of a release
   * 
   * @param {string} releaseName - Name of the release
   * @param {string} namespace - Namespace (optional)
   * @returns {Promise<object>} Current status information
   */
  async getStatus(releaseName, namespace = null) {
    await this.initialize();
    
    const monitorNamespace = namespace || this.config.namespace;
    const monitorKey = `${releaseName}:${monitorNamespace}`;
    
    try {
      // Get current status from Helm
      const helmStatus = await this.helmCLI.getStatus(releaseName, monitorNamespace);
      
      if (!helmStatus) {
        return {
          found: false,
          releaseName,
          namespace: monitorNamespace,
          timestamp: new Date().toISOString()
        };
      }

      // Get additional information
      const release = await this.helmCLI.getRelease(releaseName, monitorNamespace);
      const history = await this.helmCLI.getHistory(releaseName, monitorNamespace);
      
      // Combine with monitoring data if available
      const monitoringData = this.activeMonitors.get(monitorKey);
      const healthData = this.healthStatus.get(monitorKey);
      const performanceData = this.performanceData.get(monitorKey);
      
      const status = {
        found: true,
        releaseName,
        namespace: monitorNamespace,
        revision: helmStatus.revision,
        status: helmStatus.status,
        chart: helmStatus.chart,
        chartVersion: helmStatus.chartVersion,
        appVersion: helmStatus.appVersion,
        lastDeployed: helmStatus.lastDeployed,
        notes: helmStatus.notes,
        values: release?.values || {},
        historyCount: history?.length || 0,
        monitoring: {
          isBeingMonitored: !!monitoringData,
          monitoringSince: monitoringData?.startTime ? new Date(monitoringData.startTime).toISOString() : null,
          health: healthData || { status: 'unknown' },
          performance: performanceData?.trends || {}
        },
        timestamp: new Date().toISOString()
      };

      // Record status in history
      this._recordStatusUpdate(monitorKey, status);
      
      return status;
    } catch (error) {
      throw this.errorHandler.handle(error, {
        operation: 'getStatus',
        releaseName,
        namespace: monitorNamespace
      });
    }
  }

  /**
   * Get comprehensive release information
   * 
   * @param {string} releaseName - Name of the release
   * @param {string} namespace - Namespace (optional)
   * @returns {Promise<object>} Comprehensive release information
   */
  async getReleaseInfo(releaseName, namespace = null) {
    const status = await this.getStatus(releaseName, namespace);
    
    if (!status.found) {
      return status;
    }

    const monitorNamespace = namespace || this.config.namespace;
    const monitorKey = `${releaseName}:${monitorNamespace}`;
    
    try {
      // Get additional details
      const release = await this.helmCLI.getRelease(releaseName, monitorNamespace);
      const history = await this.helmCLI.getHistory(releaseName, monitorNamespace);
      
      return {
        ...status,
        manifest: release.manifest,
        hooks: release.hooks || [],
        history: history || [],
        statusHistory: this.statusHistory.get(monitorKey) || [],
        healthHistory: this._getHealthHistory(monitorKey),
        performanceMetrics: this.performanceData.get(monitorKey) || { metrics: [], trends: {} }
      };
    } catch (error) {
      throw this.errorHandler.handle(error, {
        operation: 'getReleaseInfo',
        releaseName,
        namespace: monitorNamespace
      });
    }
  }

  /**
   * Get monitoring metrics for all releases
   * 
   * @returns {object} Aggregated monitoring metrics
   */
  getMetrics() {
    const metrics = {
      activeMonitors: this.activeMonitors.size,
      totalReleases: 0,
      healthySummary: { healthy: 0, unhealthy: 0, unknown: 0 },
      statusSummary: {},
      averageResponseTime: 0,
      trends: {},
      timestamp: new Date().toISOString()
    };

    // Aggregate health status
    for (const [key, health] of this.healthStatus.entries()) {
      metrics.healthySummary[health.status] = (metrics.healthySummary[health.status] || 0) + 1;
    }

    // Aggregate status summary
    for (const [key, history] of this.statusHistory.entries()) {
      if (history.length > 0) {
        const latestStatus = history[history.length - 1].status;
        metrics.statusSummary[latestStatus] = (metrics.statusSummary[latestStatus] || 0) + 1;
        metrics.totalReleases++;
      }
    }

    // Calculate average response time
    let totalResponseTime = 0;
    let responseCount = 0;
    
    for (const [key, perfData] of this.performanceData.entries()) {
      if (perfData.metrics.length > 0) {
        const avgResponseTime = perfData.metrics.reduce((sum, metric) => sum + (metric.responseTime || 0), 0) / perfData.metrics.length;
        totalResponseTime += avgResponseTime;
        responseCount++;
      }
    }
    
    metrics.averageResponseTime = responseCount > 0 ? totalResponseTime / responseCount : 0;

    return metrics;
  }

  /**
   * Stop all monitoring
   * 
   * @returns {Promise<void>}
   */
  async stopAllMonitoring() {
    const activeKeys = Array.from(this.activeMonitors.keys());
    
    for (const key of activeKeys) {
      const [releaseName, namespace] = key.split(':');
      await this.stopMonitoring(releaseName, namespace);
    }

    this.emit('allMonitoringStopped', {
      stoppedCount: activeKeys.length,
      timestamp: new Date().toISOString()
    });
  }

  // Private Methods

  async _startStatusPolling(releaseName, namespace) {
    const monitorKey = `${releaseName}:${namespace}`;
    
    const pollingFunction = async () => {
      try {
        const startTime = Date.now();
        const status = await this.getStatus(releaseName, namespace);
        const responseTime = Date.now() - startTime;
        
        // Record performance metrics
        this._recordPerformanceMetric(monitorKey, {
          type: 'status-poll',
          responseTime,
          timestamp: new Date().toISOString()
        });

        this.emit('statusUpdate', {
          releaseName,
          namespace,
          status: status.status,
          revision: status.revision,
          responseTime,
          timestamp: status.timestamp
        });
      } catch (error) {
        this.emit('statusError', {
          releaseName,
          namespace,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    };

    // Initial poll
    await pollingFunction();
    
    // Set up interval
    const intervalId = setInterval(pollingFunction, this.config.pollingInterval);
    this.pollingIntervals.set(monitorKey, intervalId);
  }

  async _startHealthChecks(releaseName, namespace) {
    const monitorKey = `${releaseName}:${namespace}`;
    
    const healthCheckFunction = async () => {
      try {
        const healthStatus = await this._performHealthCheck(releaseName, namespace);
        
        // Update health status
        this.healthStatus.set(monitorKey, healthStatus);
        
        this.emit('healthCheck', {
          releaseName,
          namespace,
          status: healthStatus.status,
          checks: healthStatus.checks,
          timestamp: healthStatus.timestamp
        });

        // Emit alerts for unhealthy status
        if (healthStatus.status === 'unhealthy') {
          this.emit('healthAlert', {
            releaseName,
            namespace,
            issues: healthStatus.issues,
            severity: 'high',
            timestamp: healthStatus.timestamp
          });
        }
      } catch (error) {
        this.emit('healthCheckError', {
          releaseName,
          namespace,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    };

    // Initial health check
    await healthCheckFunction();
    
    // Set up interval
    const intervalId = setInterval(healthCheckFunction, this.config.healthCheckInterval);
    this.healthCheckIntervals.set(monitorKey, intervalId);
  }

  async _performHealthCheck(releaseName, namespace) {
    const startTime = Date.now();
    
    try {
      const status = await this.helmCLI.getStatus(releaseName, namespace);
      
      if (!status) {
        return {
          status: 'unhealthy',
          issues: ['Release not found'],
          checks: { releaseExists: false },
          lastCheck: new Date().toISOString(),
          responseTime: Date.now() - startTime,
          timestamp: new Date().toISOString()
        };
      }

      const checks = {
        releaseExists: true,
        statusDeployed: status.status === 'deployed',
        hasRevision: !!status.revision,
        hasChart: !!status.chart,
        hasNotes: !!status.notes
      };

      const issues = [];
      if (!checks.statusDeployed) {
        issues.push(`Release status is '${status.status}', expected 'deployed'`);
      }

      const healthStatus = {
        status: issues.length === 0 ? 'healthy' : 'unhealthy',
        issues,
        checks,
        lastCheck: new Date().toISOString(),
        responseTime: Date.now() - startTime,
        revision: status.revision,
        releaseStatus: status.status,
        timestamp: new Date().toISOString()
      };

      return healthStatus;
    } catch (error) {
      return {
        status: 'unhealthy',
        issues: [`Health check failed: ${error.message}`],
        checks: { healthCheckSuccessful: false },
        lastCheck: new Date().toISOString(),
        responseTime: Date.now() - startTime,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  _recordStatusUpdate(monitorKey, status) {
    if (!this.statusHistory.has(monitorKey)) {
      this.statusHistory.set(monitorKey, []);
    }

    const history = this.statusHistory.get(monitorKey);
    history.push({
      status: status.status,
      revision: status.revision,
      timestamp: status.timestamp
    });

    // Keep only recent history
    if (history.length > this.config.maxStatusHistory) {
      history.shift();
    }

    this.statusHistory.set(monitorKey, history);
  }

  _recordPerformanceMetric(monitorKey, metric) {
    if (!this.config.performanceMetrics) {
      return;
    }

    if (!this.performanceData.has(monitorKey)) {
      this.performanceData.set(monitorKey, { metrics: [], trends: {} });
    }

    const perfData = this.performanceData.get(monitorKey);
    perfData.metrics.push(metric);

    // Keep only recent metrics
    if (perfData.metrics.length > 100) {
      perfData.metrics.shift();
    }

    // Calculate trends
    perfData.trends = this._calculatePerformanceTrends(perfData.metrics);
    
    this.performanceData.set(monitorKey, perfData);
  }

  _calculatePerformanceTrends(metrics) {
    if (metrics.length === 0) {
      return {};
    }

    const responseTimes = metrics.map(m => m.responseTime || 0);
    
    return {
      averageResponseTime: responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length,
      minResponseTime: Math.min(...responseTimes),
      maxResponseTime: Math.max(...responseTimes),
      lastResponseTime: responseTimes[responseTimes.length - 1],
      trendDirection: this._calculateTrendDirection(responseTimes),
      sampleCount: metrics.length
    };
  }

  _calculateTrendDirection(values) {
    if (values.length < 5) {
      return 'insufficient-data';
    }

    const recent = values.slice(-5);
    const older = values.slice(-10, -5);
    
    if (older.length === 0) {
      return 'insufficient-data';
    }

    const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
    const olderAvg = older.reduce((sum, val) => sum + val, 0) / older.length;
    
    const threshold = olderAvg * 0.1; // 10% threshold
    
    if (recentAvg > olderAvg + threshold) {
      return 'increasing';
    } else if (recentAvg < olderAvg - threshold) {
      return 'decreasing';
    } else {
      return 'stable';
    }
  }

  _getHealthHistory(monitorKey) {
    // This would return a history of health check results
    // For now, return the current health status
    const currentHealth = this.healthStatus.get(monitorKey);
    return currentHealth ? [currentHealth] : [];
  }
}

module.exports = { StatusTracker };