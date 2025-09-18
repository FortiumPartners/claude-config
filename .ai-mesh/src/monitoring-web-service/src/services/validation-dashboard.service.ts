/**
 * Real-time Validation Dashboard Service
 * Task 3.3: Parallel Logging Validation Framework - Sub-task 2
 * 
 * Monitoring dashboard for parallel logging health with real-time metrics,
 * alerting, and visual comparison tools for troubleshooting.
 */

import { EventEmitter } from 'events';
import { logger } from '../config/logger';
import { logComparisonService, ComparisonResult, ComparisonMetrics } from './log-comparison.service';
import { WebSocket, WebSocketServer } from 'ws';

// Dashboard metrics and status types
export interface DashboardMetrics {
  timestamp: string;
  logHealth: {
    seqStatus: 'healthy' | 'degraded' | 'unhealthy' | 'disconnected';
    otelStatus: 'healthy' | 'degraded' | 'unhealthy' | 'disconnected';
    parallelLoggingEnabled: boolean;
    lastSeqLog: string | null;
    lastOtelLog: string | null;
  };
  comparisonStats: ComparisonMetrics;
  realTimeStats: {
    logsPerSecond: {
      seq: number;
      otel: number;
      total: number;
    };
    matchRate: number; // percentage of logs successfully matched
    averageLatency: number; // ms between seq and otel log arrival
    alertCount: number;
    pendingComparisons: number;
  };
  performanceImpact: {
    additionalLatencyMs: number;
    memoryUsageMB: number;
    cpuImpactPercent: number;
    diskUsageMB: number;
  };
  alerts: DashboardAlert[];
}

export interface DashboardAlert {
  id: string;
  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: 'mismatch' | 'timeout' | 'performance' | 'system' | 'threshold';
  message: string;
  details: Record<string, any>;
  acknowledged: boolean;
  resolvedAt?: string;
}

export interface AlertRule {
  id: string;
  name: string;
  enabled: boolean;
  condition: {
    metric: string;
    operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
    threshold: number;
    duration?: number; // seconds the condition must persist
  };
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  cooldown?: number; // seconds between repeated alerts
}

export interface DashboardConfig {
  enabled: boolean;
  updateInterval: number; // milliseconds
  metricsRetention: number; // number of data points to keep
  websocketPort?: number;
  alerting: {
    enabled: boolean;
    rules: AlertRule[];
    webhookUrl?: string;
    emailNotifications?: {
      enabled: boolean;
      recipients: string[];
      smtpConfig?: any;
    };
  };
  visualization: {
    chartUpdateInterval: number; // milliseconds
    maxDataPoints: number;
    autoRefresh: boolean;
  };
}

/**
 * Real-time Validation Dashboard Service
 */
export class ValidationDashboardService extends EventEmitter {
  private config: DashboardConfig;
  private metrics: DashboardMetrics[];
  private alerts: DashboardAlert[];
  private alertRuleStates: Map<string, { lastTriggered: number; conditionStartTime?: number }>;
  private metricsUpdateInterval: NodeJS.Timeout | null = null;
  private websocketServer: WebSocketServer | null = null;
  private connectedClients: Set<WebSocket> = new Set();
  private performanceMonitor: {
    startTime: number;
    logCounts: { seq: number; otel: number };
    lastReset: number;
  };

  constructor(config?: Partial<DashboardConfig>) {
    super();

    this.config = {
      enabled: true,
      updateInterval: 1000, // 1 second
      metricsRetention: 3600, // 1 hour of data points
      websocketPort: 8081,
      alerting: {
        enabled: true,
        rules: this.getDefaultAlertRules(),
      },
      visualization: {
        chartUpdateInterval: 1000,
        maxDataPoints: 100,
        autoRefresh: true,
      },
      ...config,
    };

    this.metrics = [];
    this.alerts = [];
    this.alertRuleStates = new Map();
    this.performanceMonitor = {
      startTime: Date.now(),
      logCounts: { seq: 0, otel: 0 },
      lastReset: Date.now(),
    };

    this.initialize();
  }

  private initialize(): void {
    if (!this.config.enabled) {
      logger.info('Validation Dashboard disabled via configuration');
      return;
    }

    // Set up log comparison service event listeners
    this.setupComparisonListeners();

    // Start metrics collection
    this.startMetricsCollection();

    // Initialize WebSocket server
    if (this.config.websocketPort) {
      this.initializeWebSocketServer();
    }

    // Initialize alert rule states
    for (const rule of this.config.alerting.rules) {
      this.alertRuleStates.set(rule.id, { lastTriggered: 0 });
    }

    logger.info('Validation Dashboard initialized', {
      event: 'validation_dashboard.initialized',
      config: {
        updateInterval: this.config.updateInterval,
        websocketPort: this.config.websocketPort,
        alertRulesCount: this.config.alerting.rules.length,
      },
    });
  }

  private setupComparisonListeners(): void {
    // Listen to comparison events
    logComparisonService.on('comparison_complete', (result: ComparisonResult) => {
      this.handleComparisonComplete(result);
    });

    logComparisonService.on('comparison_mismatch', (result: ComparisonResult) => {
      this.handleComparisonMismatch(result);
    });

    logComparisonService.on('log_timeout', (data: any) => {
      this.handleLogTimeout(data);
    });

    logComparisonService.on('comparison_alert', (result: ComparisonResult) => {
      this.handleComparisonAlert(result);
    });
  }

  private startMetricsCollection(): void {
    if (this.metricsUpdateInterval) {
      clearInterval(this.metricsUpdateInterval);
    }

    this.metricsUpdateInterval = setInterval(() => {
      this.collectMetrics();
    }, this.config.updateInterval);

    // Initial collection
    this.collectMetrics();
  }

  private async collectMetrics(): Promise<void> {
    try {
      const now = new Date().toISOString();
      const comparisonStats = logComparisonService.getMetrics();
      const pendingCounts = logComparisonService.getPendingCounts();
      
      // Calculate real-time statistics
      const currentTime = Date.now();
      const timeDelta = (currentTime - this.performanceMonitor.lastReset) / 1000; // seconds
      
      const logsPerSecond = {
        seq: timeDelta > 0 ? this.performanceMonitor.logCounts.seq / timeDelta : 0,
        otel: timeDelta > 0 ? this.performanceMonitor.logCounts.otel / timeDelta : 0,
        total: timeDelta > 0 ? (this.performanceMonitor.logCounts.seq + this.performanceMonitor.logCounts.otel) / timeDelta : 0,
      };

      const matchRate = comparisonStats.totalComparisons > 0 
        ? (comparisonStats.successfulMatches / comparisonStats.totalComparisons) * 100 
        : 100;

      // Get health status from various sources
      const logHealth = await this.getLogHealth();
      const performanceImpact = await this.getPerformanceImpact();

      const dashboardMetrics: DashboardMetrics = {
        timestamp: now,
        logHealth,
        comparisonStats,
        realTimeStats: {
          logsPerSecond,
          matchRate,
          averageLatency: comparisonStats.performanceMetrics.averageComparisonTimeMs,
          alertCount: this.alerts.filter(a => !a.acknowledged).length,
          pendingComparisons: pendingCounts.seq + pendingCounts.otel,
        },
        performanceImpact,
        alerts: this.alerts.slice(-20), // Most recent 20 alerts
      };

      // Store metrics
      this.metrics.push(dashboardMetrics);
      
      // Maintain retention limit
      if (this.metrics.length > this.config.metricsRetention) {
        this.metrics.shift();
      }

      // Reset counters for next interval
      this.performanceMonitor.logCounts = { seq: 0, otel: 0 };
      this.performanceMonitor.lastReset = currentTime;

      // Check alert rules
      if (this.config.alerting.enabled) {
        await this.checkAlertRules(dashboardMetrics);
      }

      // Broadcast to WebSocket clients
      this.broadcastMetrics(dashboardMetrics);

      // Emit event for external consumers
      this.emit('metrics_updated', dashboardMetrics);

    } catch (error) {
      logger.error('Error collecting dashboard metrics', {
        event: 'validation_dashboard.metrics_error',
        error: (error as Error).message,
      });
    }
  }

  private async getLogHealth(): Promise<DashboardMetrics['logHealth']> {
    // In a real implementation, these would check actual transport health
    return {
      seqStatus: 'healthy', // TODO: Implement actual Seq health check
      otelStatus: 'healthy', // TODO: Implement actual OTEL health check
      parallelLoggingEnabled: true,
      lastSeqLog: new Date().toISOString(),
      lastOtelLog: new Date().toISOString(),
    };
  }

  private async getPerformanceImpact(): Promise<DashboardMetrics['performanceImpact']> {
    // Calculate performance impact of parallel logging
    const memUsage = process.memoryUsage();
    
    return {
      additionalLatencyMs: 2.5, // TODO: Calculate actual additional latency
      memoryUsageMB: memUsage.heapUsed / 1024 / 1024,
      cpuImpactPercent: 5, // TODO: Calculate actual CPU impact
      diskUsageMB: 0, // TODO: Calculate disk usage if applicable
    };
  }

  private async checkAlertRules(metrics: DashboardMetrics): Promise<void> {
    const now = Date.now();

    for (const rule of this.config.alerting.rules) {
      if (!rule.enabled) continue;

      const ruleState = this.alertRuleStates.get(rule.id);
      if (!ruleState) continue;

      // Check cooldown period
      if (rule.cooldown && (now - ruleState.lastTriggered) < (rule.cooldown * 1000)) {
        continue;
      }

      const conditionMet = this.evaluateAlertCondition(rule, metrics);

      if (conditionMet) {
        // Handle duration requirement
        if (rule.condition.duration) {
          if (!ruleState.conditionStartTime) {
            ruleState.conditionStartTime = now;
            continue;
          }

          const conditionDuration = (now - ruleState.conditionStartTime) / 1000;
          if (conditionDuration < rule.condition.duration) {
            continue;
          }
        }

        // Trigger alert
        await this.triggerAlert(rule, metrics);
        ruleState.lastTriggered = now;
        ruleState.conditionStartTime = undefined;

      } else {
        // Reset condition start time if condition is not met
        ruleState.conditionStartTime = undefined;
      }
    }
  }

  private evaluateAlertCondition(rule: AlertRule, metrics: DashboardMetrics): boolean {
    const value = this.getMetricValue(rule.condition.metric, metrics);
    if (value === undefined) return false;

    switch (rule.condition.operator) {
      case '>':
        return value > rule.condition.threshold;
      case '<':
        return value < rule.condition.threshold;
      case '>=':
        return value >= rule.condition.threshold;
      case '<=':
        return value <= rule.condition.threshold;
      case '==':
        return value === rule.condition.threshold;
      case '!=':
        return value !== rule.condition.threshold;
      default:
        return false;
    }
  }

  private getMetricValue(metricPath: string, metrics: DashboardMetrics): number | undefined {
    // Navigate nested object using dot notation
    const path = metricPath.split('.');
    let value: any = metrics;

    for (const key of path) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }

    return typeof value === 'number' ? value : undefined;
  }

  private async triggerAlert(rule: AlertRule, metrics: DashboardMetrics): Promise<void> {
    const alert: DashboardAlert = {
      id: `${rule.id}_${Date.now()}`,
      timestamp: new Date().toISOString(),
      severity: rule.severity,
      type: 'threshold',
      message: rule.message,
      details: {
        ruleName: rule.name,
        ruleId: rule.id,
        condition: rule.condition,
        currentMetrics: this.getRelevantMetrics(rule.condition.metric, metrics),
      },
      acknowledged: false,
    };

    this.alerts.push(alert);

    // Maintain alerts limit
    if (this.alerts.length > 1000) {
      this.alerts.shift();
    }

    // Log the alert
    logger.warn('Dashboard alert triggered', {
      event: 'validation_dashboard.alert_triggered',
      alert,
    });

    // Send notifications
    await this.sendAlertNotification(alert);

    // Emit event
    this.emit('alert_triggered', alert);

    // Broadcast to WebSocket clients
    this.broadcastAlert(alert);
  }

  private getRelevantMetrics(metricPath: string, metrics: DashboardMetrics): any {
    // Extract relevant portion of metrics for the alert
    const pathParts = metricPath.split('.');
    const topLevel = pathParts[0];
    
    return (metrics as any)[topLevel];
  }

  private async sendAlertNotification(alert: DashboardAlert): Promise<void> {
    try {
      // Webhook notification
      if (this.config.alerting.webhookUrl) {
        // TODO: Implement webhook notification
      }

      // Email notification
      if (this.config.alerting.emailNotifications?.enabled) {
        // TODO: Implement email notification
      }

    } catch (error) {
      logger.error('Failed to send alert notification', {
        event: 'validation_dashboard.notification_error',
        alertId: alert.id,
        error: (error as Error).message,
      });
    }
  }

  private initializeWebSocketServer(): void {
    try {
      this.websocketServer = new WebSocketServer({
        port: this.config.websocketPort,
      });

      this.websocketServer.on('connection', (ws: WebSocket) => {
        this.connectedClients.add(ws);
        
        // Send current metrics immediately
        const latestMetrics = this.getLatestMetrics();
        if (latestMetrics) {
          ws.send(JSON.stringify({
            type: 'metrics_update',
            data: latestMetrics,
          }));
        }

        ws.on('close', () => {
          this.connectedClients.delete(ws);
        });

        ws.on('error', (error) => {
          logger.error('WebSocket error', {
            event: 'validation_dashboard.websocket_error',
            error: error.message,
          });
          this.connectedClients.delete(ws);
        });

        logger.debug('WebSocket client connected', {
          event: 'validation_dashboard.client_connected',
          totalClients: this.connectedClients.size,
        });
      });

      logger.info('WebSocket server started', {
        event: 'validation_dashboard.websocket_started',
        port: this.config.websocketPort,
      });

    } catch (error) {
      logger.error('Failed to start WebSocket server', {
        event: 'validation_dashboard.websocket_start_error',
        port: this.config.websocketPort,
        error: (error as Error).message,
      });
    }
  }

  private broadcastMetrics(metrics: DashboardMetrics): void {
    if (this.connectedClients.size === 0) return;

    const message = JSON.stringify({
      type: 'metrics_update',
      data: metrics,
    });

    for (const client of this.connectedClients) {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
        } catch (error) {
          logger.debug('Failed to send metrics to WebSocket client', {
            error: (error as Error).message,
          });
          this.connectedClients.delete(client);
        }
      }
    }
  }

  private broadcastAlert(alert: DashboardAlert): void {
    if (this.connectedClients.size === 0) return;

    const message = JSON.stringify({
      type: 'alert',
      data: alert,
    });

    for (const client of this.connectedClients) {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
        } catch (error) {
          this.connectedClients.delete(client);
        }
      }
    }
  }

  // Event handlers for comparison service events
  private handleComparisonComplete(result: ComparisonResult): void {
    // Update performance counters
    this.performanceMonitor.logCounts.seq++;
    this.performanceMonitor.logCounts.otel++;
  }

  private handleComparisonMismatch(result: ComparisonResult): void {
    // Create alert for significant mismatches
    if (result.score < 50 || result.differences.filter(d => d.severity === 'critical').length > 0) {
      const alert: DashboardAlert = {
        id: `mismatch_${result.id}`,
        timestamp: new Date().toISOString(),
        severity: result.score < 25 ? 'critical' : 'high',
        type: 'mismatch',
        message: `Log comparison mismatch detected with score ${result.score}%`,
        details: {
          comparisonId: result.id,
          correlationId: result.correlationId,
          score: result.score,
          differences: result.differences.length,
          criticalDifferences: result.differences.filter(d => d.severity === 'critical').length,
        },
        acknowledged: false,
      };

      this.alerts.push(alert);
      this.emit('alert_triggered', alert);
      this.broadcastAlert(alert);
    }
  }

  private handleLogTimeout(data: any): void {
    const alert: DashboardAlert = {
      id: `timeout_${data.correlationId}_${Date.now()}`,
      timestamp: new Date().toISOString(),
      severity: 'medium',
      type: 'timeout',
      message: `Log timeout: No matching ${data.source === 'seq' ? 'OTEL' : 'Seq'} log found`,
      details: data,
      acknowledged: false,
    };

    this.alerts.push(alert);
    this.emit('alert_triggered', alert);
    this.broadcastAlert(alert);
  }

  private handleComparisonAlert(result: ComparisonResult): void {
    const alert: DashboardAlert = {
      id: `comparison_alert_${result.id}`,
      timestamp: new Date().toISOString(),
      severity: 'high',
      type: 'threshold',
      message: 'Automatic comparison alert triggered',
      details: {
        comparisonId: result.id,
        correlationId: result.correlationId,
        score: result.score,
        reason: result.score < 50 ? 'Low similarity score' : 'Critical differences detected',
      },
      acknowledged: false,
    };

    this.alerts.push(alert);
    this.emit('alert_triggered', alert);
    this.broadcastAlert(alert);
  }

  // Public API methods
  getLatestMetrics(): DashboardMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
  }

  getMetricsHistory(limit?: number): DashboardMetrics[] {
    const history = [...this.metrics];
    return limit ? history.slice(-limit) : history;
  }

  getAlerts(limit?: number, unacknowledgedOnly: boolean = false): DashboardAlert[] {
    let alerts = [...this.alerts];
    
    if (unacknowledgedOnly) {
      alerts = alerts.filter(a => !a.acknowledged);
    }
    
    return limit ? alerts.slice(-limit) : alerts;
  }

  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.acknowledged) {
      alert.acknowledged = true;
      
      logger.info('Alert acknowledged', {
        event: 'validation_dashboard.alert_acknowledged',
        alertId,
      });
      
      this.emit('alert_acknowledged', alert);
      return true;
    }
    return false;
  }

  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.resolvedAt) {
      alert.resolvedAt = new Date().toISOString();
      alert.acknowledged = true;
      
      logger.info('Alert resolved', {
        event: 'validation_dashboard.alert_resolved',
        alertId,
      });
      
      this.emit('alert_resolved', alert);
      return true;
    }
    return false;
  }

  updateConfig(newConfig: Partial<DashboardConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };

    // Restart metrics collection if interval changed
    if (oldConfig.updateInterval !== this.config.updateInterval) {
      this.startMetricsCollection();
    }

    logger.info('Dashboard configuration updated', {
      event: 'validation_dashboard.config_updated',
      changes: {
        updateInterval: {
          old: oldConfig.updateInterval,
          new: this.config.updateInterval,
        },
      },
    });
  }

  getStatus(): {
    enabled: boolean;
    connectedClients: number;
    metricsCount: number;
    alertsCount: number;
    unacknowledgedAlerts: number;
  } {
    return {
      enabled: this.config.enabled,
      connectedClients: this.connectedClients.size,
      metricsCount: this.metrics.length,
      alertsCount: this.alerts.length,
      unacknowledgedAlerts: this.alerts.filter(a => !a.acknowledged).length,
    };
  }

  private getDefaultAlertRules(): AlertRule[] {
    return [
      {
        id: 'low_match_rate',
        name: 'Low Log Match Rate',
        enabled: true,
        condition: {
          metric: 'realTimeStats.matchRate',
          operator: '<',
          threshold: 80,
          duration: 30,
        },
        severity: 'high',
        message: 'Log match rate has dropped below 80% for 30 seconds',
        cooldown: 300,
      },
      {
        id: 'high_pending_comparisons',
        name: 'High Pending Comparisons',
        enabled: true,
        condition: {
          metric: 'realTimeStats.pendingComparisons',
          operator: '>',
          threshold: 100,
          duration: 60,
        },
        severity: 'medium',
        message: 'Number of pending comparisons is high',
        cooldown: 180,
      },
      {
        id: 'performance_degradation',
        name: 'Performance Degradation',
        enabled: true,
        condition: {
          metric: 'performanceImpact.additionalLatencyMs',
          operator: '>',
          threshold: 10,
          duration: 120,
        },
        severity: 'medium',
        message: 'Parallel logging is causing significant performance impact',
        cooldown: 600,
      },
      {
        id: 'high_alert_count',
        name: 'High Alert Count',
        enabled: true,
        condition: {
          metric: 'realTimeStats.alertCount',
          operator: '>',
          threshold: 10,
        },
        severity: 'low',
        message: 'High number of unacknowledged alerts',
        cooldown: 900,
      },
    ];
  }

  destroy(): void {
    // Stop metrics collection
    if (this.metricsUpdateInterval) {
      clearInterval(this.metricsUpdateInterval);
      this.metricsUpdateInterval = null;
    }

    // Close WebSocket server
    if (this.websocketServer) {
      this.websocketServer.close();
      this.websocketServer = null;
    }

    // Close all WebSocket connections
    for (const client of this.connectedClients) {
      client.close();
    }
    this.connectedClients.clear();

    // Clear all listeners
    this.removeAllListeners();

    logger.info('Validation Dashboard Service destroyed', {
      event: 'validation_dashboard.destroyed',
    });
  }
}

// Export singleton instance
export const validationDashboardService = new ValidationDashboardService();

export default ValidationDashboardService;