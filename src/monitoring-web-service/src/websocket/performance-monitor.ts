/**
 * Performance Monitor - Sprint 5 Task 5.5
 * WebSocket performance monitoring and optimization
 * 
 * Features:
 * - Real-time performance metrics
 * - Connection performance tracking
 * - Memory usage monitoring
 * - Latency measurement
 * - Throughput analysis
 * - Performance alerts
 */

import { Server } from 'socket.io';
import { RedisManager } from '../config/redis.config';
import * as winston from 'winston';
import EventEmitter from 'events';

export interface PerformanceMetrics {
  timestamp: Date;
  connections: {
    total: number;
    active: number;
    idle: number;
    failed: number;
  };
  latency: {
    average: number;
    p50: number;
    p95: number;
    p99: number;
  };
  throughput: {
    messagesPerSecond: number;
    bytesPerSecond: number;
    eventsPerSecond: number;
  };
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  errors: {
    connectionErrors: number;
    timeoutErrors: number;
    authErrors: number;
    totalErrors: number;
  };
  quality: {
    successRate: number;
    availability: number;
    reliability: number;
  };
}

export interface ConnectionPerformance {
  socketId: string;
  userId: string;
  organizationId: string;
  metrics: {
    connectedAt: Date;
    lastActivity: Date;
    messagesReceived: number;
    messagesSent: number;
    bytesReceived: number;
    bytesSent: number;
    averageLatency: number;
    errorCount: number;
    reconnections: number;
  };
  quality: {
    connectionStability: number;
    responseTime: number;
    dataIntegrity: number;
  };
}

export interface PerformanceAlert {
  id: string;
  type: 'latency' | 'throughput' | 'memory' | 'cpu' | 'errors' | 'availability';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
  organizationId?: string;
  metadata?: Record<string, any>;
}

export class PerformanceMonitor extends EventEmitter {
  private metrics: PerformanceMetrics;
  private connectionPerformance: Map<string, ConnectionPerformance> = new Map();
  private latencyHistory: number[] = [];
  private throughputHistory: number[] = [];
  private errorHistory: number[] = [];
  private alerts: PerformanceAlert[] = [];
  private monitoringInterval: NodeJS.Timeout;
  private performanceBaseline: Partial<PerformanceMetrics> | null = null;

  constructor(
    private io: Server,
    private redisManager: RedisManager,
    private logger: winston.Logger,
    private config: {
      monitoringInterval: number;
      historySize: number;
      alertThresholds: {
        maxLatency: number;
        minThroughput: number;
        maxMemoryUsage: number;
        maxCpuUsage: number;
        maxErrorRate: number;
        minAvailability: number;
      };
      enablePredictiveAnalysis: boolean;
      baselineCalibrationPeriod: number;
    }
  ) {
    super();
    
    this.initializeMetrics();
    this.startMonitoring();
  }

  /**
   * Start connection performance tracking
   */
  startConnectionTracking(
    socketId: string,
    userId: string,
    organizationId: string
  ): void {
    const performance: ConnectionPerformance = {
      socketId,
      userId,
      organizationId,
      metrics: {
        connectedAt: new Date(),
        lastActivity: new Date(),
        messagesReceived: 0,
        messagesSent: 0,
        bytesReceived: 0,
        bytesSent: 0,
        averageLatency: 0,
        errorCount: 0,
        reconnections: 0
      },
      quality: {
        connectionStability: 100,
        responseTime: 0,
        dataIntegrity: 100
      }
    };

    this.connectionPerformance.set(socketId, performance);

    this.logger.debug('Started connection performance tracking', {
      socketId,
      userId,
      organizationId
    });
  }

  /**
   * Update connection activity metrics
   */
  updateConnectionActivity(
    socketId: string,
    activity: {
      messageReceived?: boolean;
      messageSent?: boolean;
      bytesReceived?: number;
      bytesSent?: number;
      latency?: number;
      error?: boolean;
    }
  ): void {
    const performance = this.connectionPerformance.get(socketId);
    if (!performance) return;

    const now = new Date();
    performance.metrics.lastActivity = now;

    if (activity.messageReceived) {
      performance.metrics.messagesReceived++;
    }

    if (activity.messageSent) {
      performance.metrics.messagesSent++;
    }

    if (activity.bytesReceived) {
      performance.metrics.bytesReceived += activity.bytesReceived;
    }

    if (activity.bytesSent) {
      performance.metrics.bytesSent += activity.bytesSent;
    }

    if (activity.latency) {
      // Update rolling average latency
      const currentAvg = performance.metrics.averageLatency;
      const messageCount = performance.metrics.messagesReceived + performance.metrics.messagesSent;
      performance.metrics.averageLatency = messageCount > 1
        ? (currentAvg * (messageCount - 1) + activity.latency) / messageCount
        : activity.latency;
      
      performance.quality.responseTime = performance.metrics.averageLatency;
    }

    if (activity.error) {
      performance.metrics.errorCount++;
      
      // Update connection stability
      const totalMessages = performance.metrics.messagesReceived + performance.metrics.messagesSent;
      const errorRate = totalMessages > 0 ? (performance.metrics.errorCount / totalMessages) * 100 : 0;
      performance.quality.connectionStability = Math.max(0, 100 - errorRate);
    }

    // Update data integrity score (placeholder - would be based on actual data validation)
    if (performance.metrics.errorCount === 0) {
      performance.quality.dataIntegrity = 100;
    } else {
      const totalOperations = performance.metrics.messagesReceived + performance.metrics.messagesSent;
      const integrityRate = totalOperations > 0 ? 
        ((totalOperations - performance.metrics.errorCount) / totalOperations) * 100 : 100;
      performance.quality.dataIntegrity = Math.max(0, integrityRate);
    }
  }

  /**
   * Stop connection tracking
   */
  stopConnectionTracking(socketId: string): ConnectionPerformance | null {
    const performance = this.connectionPerformance.get(socketId);
    if (performance) {
      this.connectionPerformance.delete(socketId);
      
      this.logger.debug('Stopped connection performance tracking', {
        socketId,
        duration: Date.now() - performance.metrics.connectedAt.getTime(),
        messagesTotal: performance.metrics.messagesReceived + performance.metrics.messagesSent,
        averageLatency: performance.metrics.averageLatency,
        errorCount: performance.metrics.errorCount
      });
      
      return performance;
    }
    
    return null;
  }

  /**
   * Get current performance metrics
   */
  getCurrentMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get connection performance details
   */
  getConnectionPerformance(socketId?: string): ConnectionPerformance[] {
    if (socketId) {
      const performance = this.connectionPerformance.get(socketId);
      return performance ? [performance] : [];
    }
    
    return Array.from(this.connectionPerformance.values());
  }

  /**
   * Get organization performance summary
   */
  getOrganizationPerformance(organizationId: string): {
    connectionCount: number;
    averageLatency: number;
    totalThroughput: number;
    errorRate: number;
    qualityScore: number;
  } {
    const orgConnections = Array.from(this.connectionPerformance.values())
      .filter(perf => perf.organizationId === organizationId);

    if (orgConnections.length === 0) {
      return {
        connectionCount: 0,
        averageLatency: 0,
        totalThroughput: 0,
        errorRate: 0,
        qualityScore: 100
      };
    }

    const totalLatency = orgConnections.reduce((sum, conn) => 
      sum + conn.metrics.averageLatency, 0);
    const averageLatency = totalLatency / orgConnections.length;

    const totalMessages = orgConnections.reduce((sum, conn) => 
      sum + conn.metrics.messagesReceived + conn.metrics.messagesSent, 0);
    
    const totalErrors = orgConnections.reduce((sum, conn) => 
      sum + conn.metrics.errorCount, 0);
    const errorRate = totalMessages > 0 ? (totalErrors / totalMessages) * 100 : 0;

    const totalBytes = orgConnections.reduce((sum, conn) => 
      sum + conn.metrics.bytesReceived + conn.metrics.bytesSent, 0);
    
    // Calculate throughput (bytes per minute based on connection duration)
    const avgDuration = orgConnections.reduce((sum, conn) => {
      const duration = (Date.now() - conn.metrics.connectedAt.getTime()) / (1000 * 60); // minutes
      return sum + Math.max(duration, 1);
    }, 0) / orgConnections.length;
    
    const totalThroughput = avgDuration > 0 ? totalBytes / avgDuration : 0;

    // Calculate overall quality score
    const avgConnectionStability = orgConnections.reduce((sum, conn) => 
      sum + conn.quality.connectionStability, 0) / orgConnections.length;
    const avgDataIntegrity = orgConnections.reduce((sum, conn) => 
      sum + conn.quality.dataIntegrity, 0) / orgConnections.length;
    
    const qualityScore = (avgConnectionStability + avgDataIntegrity) / 2;

    return {
      connectionCount: orgConnections.length,
      averageLatency,
      totalThroughput,
      errorRate,
      qualityScore
    };
  }

  /**
   * Get performance alerts
   */
  getActiveAlerts(): PerformanceAlert[] {
    const cutoff = Date.now() - 300000; // 5 minutes
    return this.alerts.filter(alert => alert.timestamp.getTime() > cutoff);
  }

  /**
   * Get performance trends
   */
  getPerformanceTrends(): {
    latency: { timestamps: Date[]; values: number[] };
    throughput: { timestamps: Date[]; values: number[] };
    errors: { timestamps: Date[]; values: number[] };
  } {
    const now = new Date();
    const timestamps = Array.from({ length: this.latencyHistory.length }, (_, i) => 
      new Date(now.getTime() - (this.latencyHistory.length - 1 - i) * this.config.monitoringInterval)
    );

    return {
      latency: {
        timestamps,
        values: [...this.latencyHistory]
      },
      throughput: {
        timestamps,
        values: [...this.throughputHistory]
      },
      errors: {
        timestamps,
        values: [...this.errorHistory]
      }
    };
  }

  /**
   * Private methods
   */
  private initializeMetrics(): void {
    this.metrics = {
      timestamp: new Date(),
      connections: {
        total: 0,
        active: 0,
        idle: 0,
        failed: 0
      },
      latency: {
        average: 0,
        p50: 0,
        p95: 0,
        p99: 0
      },
      throughput: {
        messagesPerSecond: 0,
        bytesPerSecond: 0,
        eventsPerSecond: 0
      },
      memory: {
        heapUsed: 0,
        heapTotal: 0,
        external: 0,
        rss: 0
      },
      cpu: {
        usage: 0,
        loadAverage: [0, 0, 0]
      },
      errors: {
        connectionErrors: 0,
        timeoutErrors: 0,
        authErrors: 0,
        totalErrors: 0
      },
      quality: {
        successRate: 100,
        availability: 100,
        reliability: 100
      }
    };
  }

  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
      this.analyzePerformance();
      this.checkAlertThresholds();
    }, this.config.monitoringInterval);

    this.logger.info('Performance monitoring started', {
      interval: this.config.monitoringInterval
    });
  }

  private collectMetrics(): void {
    try {
      const now = new Date();
      this.metrics.timestamp = now;

      // Collect connection metrics
      const connections = Array.from(this.connectionPerformance.values());
      this.metrics.connections.total = connections.length;
      this.metrics.connections.active = connections.filter(c => 
        now.getTime() - c.metrics.lastActivity.getTime() < 30000 // Active in last 30s
      ).length;
      this.metrics.connections.idle = this.metrics.connections.total - this.metrics.connections.active;

      // Collect latency metrics
      if (connections.length > 0) {
        const latencies = connections
          .map(c => c.metrics.averageLatency)
          .filter(l => l > 0)
          .sort((a, b) => a - b);

        if (latencies.length > 0) {
          this.metrics.latency.average = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
          this.metrics.latency.p50 = this.calculatePercentile(latencies, 50);
          this.metrics.latency.p95 = this.calculatePercentile(latencies, 95);
          this.metrics.latency.p99 = this.calculatePercentile(latencies, 99);
        }
      }

      // Collect throughput metrics (messages per second)
      const totalMessages = connections.reduce((sum, c) => 
        sum + c.metrics.messagesReceived + c.metrics.messagesSent, 0);
      const totalBytes = connections.reduce((sum, c) => 
        sum + c.metrics.bytesReceived + c.metrics.bytesSent, 0);
      
      // Calculate rates based on monitoring interval
      const intervalSeconds = this.config.monitoringInterval / 1000;
      this.metrics.throughput.messagesPerSecond = totalMessages / Math.max(intervalSeconds, 1);
      this.metrics.throughput.bytesPerSecond = totalBytes / Math.max(intervalSeconds, 1);

      // Collect memory metrics
      const memUsage = process.memoryUsage();
      this.metrics.memory = {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss
      };

      // Collect CPU metrics
      const cpuUsage = process.cpuUsage();
      this.metrics.cpu = {
        usage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to seconds
        loadAverage: require('os').loadavg()
      };

      // Collect error metrics
      const totalErrors = connections.reduce((sum, c) => sum + c.metrics.errorCount, 0);
      this.metrics.errors.totalErrors = totalErrors;
      
      // Calculate quality metrics
      const successfulMessages = totalMessages - totalErrors;
      this.metrics.quality.successRate = totalMessages > 0 ? 
        (successfulMessages / totalMessages) * 100 : 100;

      // Update history
      this.updateHistory();

      this.emit('metrics:collected', this.metrics);

    } catch (error) {
      this.logger.error('Failed to collect performance metrics:', error);
    }
  }

  private updateHistory(): void {
    // Update latency history
    this.latencyHistory.push(this.metrics.latency.average);
    if (this.latencyHistory.length > this.config.historySize) {
      this.latencyHistory.shift();
    }

    // Update throughput history
    this.throughputHistory.push(this.metrics.throughput.messagesPerSecond);
    if (this.throughputHistory.length > this.config.historySize) {
      this.throughputHistory.shift();
    }

    // Update error history
    this.errorHistory.push(this.metrics.errors.totalErrors);
    if (this.errorHistory.length > this.config.historySize) {
      this.errorHistory.shift();
    }
  }

  private analyzePerformance(): void {
    // Establish baseline if needed
    if (!this.performanceBaseline && this.latencyHistory.length >= this.config.baselineCalibrationPeriod) {
      this.establishBaseline();
    }

    // Predictive analysis (placeholder for ML-based predictions)
    if (this.config.enablePredictiveAnalysis) {
      this.performPredictiveAnalysis();
    }
  }

  private establishBaseline(): void {
    const historyLength = this.config.baselineCalibrationPeriod;
    
    if (this.latencyHistory.length >= historyLength) {
      const recentLatencies = this.latencyHistory.slice(-historyLength);
      const recentThroughput = this.throughputHistory.slice(-historyLength);
      
      this.performanceBaseline = {
        latency: {
          average: recentLatencies.reduce((sum, l) => sum + l, 0) / recentLatencies.length,
          p95: this.calculatePercentile([...recentLatencies].sort((a, b) => a - b), 95)
        },
        throughput: {
          messagesPerSecond: recentThroughput.reduce((sum, t) => sum + t, 0) / recentThroughput.length
        }
      } as Partial<PerformanceMetrics>;

      this.logger.info('Performance baseline established', this.performanceBaseline);
      this.emit('baseline:established', this.performanceBaseline);
    }
  }

  private performPredictiveAnalysis(): void {
    // Placeholder for ML-based predictive analysis
    // This would analyze trends and predict potential performance issues
    
    if (this.latencyHistory.length >= 10) {
      const recentTrend = this.calculateTrend(this.latencyHistory.slice(-10));
      
      if (recentTrend > 0.1) { // Increasing latency trend
        this.emit('prediction:latency_increase', {
          currentLatency: this.metrics.latency.average,
          trendSlope: recentTrend,
          prediction: 'Latency may continue to increase'
        });
      }
    }
  }

  private checkAlertThresholds(): void {
    const alerts: PerformanceAlert[] = [];

    // Latency alert
    if (this.metrics.latency.average > this.config.alertThresholds.maxLatency) {
      alerts.push({
        id: `alert_${Date.now()}_latency`,
        type: 'latency',
        severity: this.metrics.latency.average > this.config.alertThresholds.maxLatency * 2 ? 'critical' : 'high',
        message: `High latency detected: ${this.metrics.latency.average.toFixed(2)}ms`,
        value: this.metrics.latency.average,
        threshold: this.config.alertThresholds.maxLatency,
        timestamp: new Date()
      });
    }

    // Throughput alert
    if (this.metrics.throughput.messagesPerSecond < this.config.alertThresholds.minThroughput) {
      alerts.push({
        id: `alert_${Date.now()}_throughput`,
        type: 'throughput',
        severity: 'medium',
        message: `Low throughput detected: ${this.metrics.throughput.messagesPerSecond.toFixed(2)} msg/s`,
        value: this.metrics.throughput.messagesPerSecond,
        threshold: this.config.alertThresholds.minThroughput,
        timestamp: new Date()
      });
    }

    // Memory alert
    const memoryUsagePercent = (this.metrics.memory.heapUsed / this.metrics.memory.heapTotal) * 100;
    if (memoryUsagePercent > this.config.alertThresholds.maxMemoryUsage) {
      alerts.push({
        id: `alert_${Date.now()}_memory`,
        type: 'memory',
        severity: memoryUsagePercent > 90 ? 'critical' : 'high',
        message: `High memory usage: ${memoryUsagePercent.toFixed(1)}%`,
        value: memoryUsagePercent,
        threshold: this.config.alertThresholds.maxMemoryUsage,
        timestamp: new Date()
      });
    }

    // Error rate alert
    const errorRate = this.metrics.quality.successRate < 100 ? 100 - this.metrics.quality.successRate : 0;
    if (errorRate > this.config.alertThresholds.maxErrorRate) {
      alerts.push({
        id: `alert_${Date.now()}_errors`,
        type: 'errors',
        severity: errorRate > 10 ? 'critical' : 'high',
        message: `High error rate: ${errorRate.toFixed(1)}%`,
        value: errorRate,
        threshold: this.config.alertThresholds.maxErrorRate,
        timestamp: new Date()
      });
    }

    // Add new alerts
    for (const alert of alerts) {
      this.alerts.unshift(alert);
      this.emit('alert:triggered', alert);
      
      this.logger.warn('Performance alert triggered', {
        type: alert.type,
        severity: alert.severity,
        message: alert.message,
        value: alert.value,
        threshold: alert.threshold
      });
    }

    // Trim old alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(0, 100);
    }
  }

  private calculatePercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;
    
    const index = (percentile / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sortedValues[lower];
    }
    
    const weight = index - lower;
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;
    
    // Simple linear regression slope calculation
    const n = values.length;
    const sumX = (n * (n + 1)) / 2; // Sum of indices
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, i) => sum + val * (i + 1), 0);
    const sumX2 = (n * (n + 1) * (2 * n + 1)) / 6; // Sum of squared indices
    
    return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  }

  /**
   * Shutdown performance monitoring
   */
  async shutdown(): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    // Final metrics collection
    this.collectMetrics();

    // Clear data
    this.connectionPerformance.clear();
    this.latencyHistory.length = 0;
    this.throughputHistory.length = 0;
    this.errorHistory.length = 0;
    this.alerts.length = 0;

    this.logger.info('Performance Monitor shutdown complete');
  }
}