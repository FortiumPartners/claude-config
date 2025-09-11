"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PerformanceMonitor = void 0;
const events_1 = __importDefault(require("events"));
class PerformanceMonitor extends events_1.default {
    io;
    redisManager;
    logger;
    config;
    metrics;
    connectionPerformance = new Map();
    latencyHistory = [];
    throughputHistory = [];
    errorHistory = [];
    alerts = [];
    monitoringInterval;
    performanceBaseline = null;
    constructor(io, redisManager, logger, config) {
        super();
        this.io = io;
        this.redisManager = redisManager;
        this.logger = logger;
        this.config = config;
        this.initializeMetrics();
        this.startMonitoring();
    }
    startConnectionTracking(socketId, userId, organizationId) {
        const performance = {
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
    updateConnectionActivity(socketId, activity) {
        const performance = this.connectionPerformance.get(socketId);
        if (!performance)
            return;
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
            const currentAvg = performance.metrics.averageLatency;
            const messageCount = performance.metrics.messagesReceived + performance.metrics.messagesSent;
            performance.metrics.averageLatency = messageCount > 1
                ? (currentAvg * (messageCount - 1) + activity.latency) / messageCount
                : activity.latency;
            performance.quality.responseTime = performance.metrics.averageLatency;
        }
        if (activity.error) {
            performance.metrics.errorCount++;
            const totalMessages = performance.metrics.messagesReceived + performance.metrics.messagesSent;
            const errorRate = totalMessages > 0 ? (performance.metrics.errorCount / totalMessages) * 100 : 0;
            performance.quality.connectionStability = Math.max(0, 100 - errorRate);
        }
        if (performance.metrics.errorCount === 0) {
            performance.quality.dataIntegrity = 100;
        }
        else {
            const totalOperations = performance.metrics.messagesReceived + performance.metrics.messagesSent;
            const integrityRate = totalOperations > 0 ?
                ((totalOperations - performance.metrics.errorCount) / totalOperations) * 100 : 100;
            performance.quality.dataIntegrity = Math.max(0, integrityRate);
        }
    }
    stopConnectionTracking(socketId) {
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
    getCurrentMetrics() {
        return { ...this.metrics };
    }
    getConnectionPerformance(socketId) {
        if (socketId) {
            const performance = this.connectionPerformance.get(socketId);
            return performance ? [performance] : [];
        }
        return Array.from(this.connectionPerformance.values());
    }
    getOrganizationPerformance(organizationId) {
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
        const totalLatency = orgConnections.reduce((sum, conn) => sum + conn.metrics.averageLatency, 0);
        const averageLatency = totalLatency / orgConnections.length;
        const totalMessages = orgConnections.reduce((sum, conn) => sum + conn.metrics.messagesReceived + conn.metrics.messagesSent, 0);
        const totalErrors = orgConnections.reduce((sum, conn) => sum + conn.metrics.errorCount, 0);
        const errorRate = totalMessages > 0 ? (totalErrors / totalMessages) * 100 : 0;
        const totalBytes = orgConnections.reduce((sum, conn) => sum + conn.metrics.bytesReceived + conn.metrics.bytesSent, 0);
        const avgDuration = orgConnections.reduce((sum, conn) => {
            const duration = (Date.now() - conn.metrics.connectedAt.getTime()) / (1000 * 60);
            return sum + Math.max(duration, 1);
        }, 0) / orgConnections.length;
        const totalThroughput = avgDuration > 0 ? totalBytes / avgDuration : 0;
        const avgConnectionStability = orgConnections.reduce((sum, conn) => sum + conn.quality.connectionStability, 0) / orgConnections.length;
        const avgDataIntegrity = orgConnections.reduce((sum, conn) => sum + conn.quality.dataIntegrity, 0) / orgConnections.length;
        const qualityScore = (avgConnectionStability + avgDataIntegrity) / 2;
        return {
            connectionCount: orgConnections.length,
            averageLatency,
            totalThroughput,
            errorRate,
            qualityScore
        };
    }
    getActiveAlerts() {
        const cutoff = Date.now() - 300000;
        return this.alerts.filter(alert => alert.timestamp.getTime() > cutoff);
    }
    getPerformanceTrends() {
        const now = new Date();
        const timestamps = Array.from({ length: this.latencyHistory.length }, (_, i) => new Date(now.getTime() - (this.latencyHistory.length - 1 - i) * this.config.monitoringInterval));
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
    initializeMetrics() {
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
    startMonitoring() {
        this.monitoringInterval = setInterval(() => {
            this.collectMetrics();
            this.analyzePerformance();
            this.checkAlertThresholds();
        }, this.config.monitoringInterval);
        this.logger.info('Performance monitoring started', {
            interval: this.config.monitoringInterval
        });
    }
    collectMetrics() {
        try {
            const now = new Date();
            this.metrics.timestamp = now;
            const connections = Array.from(this.connectionPerformance.values());
            this.metrics.connections.total = connections.length;
            this.metrics.connections.active = connections.filter(c => now.getTime() - c.metrics.lastActivity.getTime() < 30000).length;
            this.metrics.connections.idle = this.metrics.connections.total - this.metrics.connections.active;
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
            const totalMessages = connections.reduce((sum, c) => sum + c.metrics.messagesReceived + c.metrics.messagesSent, 0);
            const totalBytes = connections.reduce((sum, c) => sum + c.metrics.bytesReceived + c.metrics.bytesSent, 0);
            const intervalSeconds = this.config.monitoringInterval / 1000;
            this.metrics.throughput.messagesPerSecond = totalMessages / Math.max(intervalSeconds, 1);
            this.metrics.throughput.bytesPerSecond = totalBytes / Math.max(intervalSeconds, 1);
            const memUsage = process.memoryUsage();
            this.metrics.memory = {
                heapUsed: memUsage.heapUsed,
                heapTotal: memUsage.heapTotal,
                external: memUsage.external,
                rss: memUsage.rss
            };
            const cpuUsage = process.cpuUsage();
            this.metrics.cpu = {
                usage: (cpuUsage.user + cpuUsage.system) / 1000000,
                loadAverage: require('os').loadavg()
            };
            const totalErrors = connections.reduce((sum, c) => sum + c.metrics.errorCount, 0);
            this.metrics.errors.totalErrors = totalErrors;
            const successfulMessages = totalMessages - totalErrors;
            this.metrics.quality.successRate = totalMessages > 0 ?
                (successfulMessages / totalMessages) * 100 : 100;
            this.updateHistory();
            this.emit('metrics:collected', this.metrics);
        }
        catch (error) {
            this.logger.error('Failed to collect performance metrics:', error);
        }
    }
    updateHistory() {
        this.latencyHistory.push(this.metrics.latency.average);
        if (this.latencyHistory.length > this.config.historySize) {
            this.latencyHistory.shift();
        }
        this.throughputHistory.push(this.metrics.throughput.messagesPerSecond);
        if (this.throughputHistory.length > this.config.historySize) {
            this.throughputHistory.shift();
        }
        this.errorHistory.push(this.metrics.errors.totalErrors);
        if (this.errorHistory.length > this.config.historySize) {
            this.errorHistory.shift();
        }
    }
    analyzePerformance() {
        if (!this.performanceBaseline && this.latencyHistory.length >= this.config.baselineCalibrationPeriod) {
            this.establishBaseline();
        }
        if (this.config.enablePredictiveAnalysis) {
            this.performPredictiveAnalysis();
        }
    }
    establishBaseline() {
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
            };
            this.logger.info('Performance baseline established', this.performanceBaseline);
            this.emit('baseline:established', this.performanceBaseline);
        }
    }
    performPredictiveAnalysis() {
        if (this.latencyHistory.length >= 10) {
            const recentTrend = this.calculateTrend(this.latencyHistory.slice(-10));
            if (recentTrend > 0.1) {
                this.emit('prediction:latency_increase', {
                    currentLatency: this.metrics.latency.average,
                    trendSlope: recentTrend,
                    prediction: 'Latency may continue to increase'
                });
            }
        }
    }
    checkAlertThresholds() {
        const alerts = [];
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
        if (this.alerts.length > 100) {
            this.alerts = this.alerts.slice(0, 100);
        }
    }
    calculatePercentile(sortedValues, percentile) {
        if (sortedValues.length === 0)
            return 0;
        const index = (percentile / 100) * (sortedValues.length - 1);
        const lower = Math.floor(index);
        const upper = Math.ceil(index);
        if (lower === upper) {
            return sortedValues[lower];
        }
        const weight = index - lower;
        return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
    }
    calculateTrend(values) {
        if (values.length < 2)
            return 0;
        const n = values.length;
        const sumX = (n * (n + 1)) / 2;
        const sumY = values.reduce((sum, val) => sum + val, 0);
        const sumXY = values.reduce((sum, val, i) => sum + val * (i + 1), 0);
        const sumX2 = (n * (n + 1) * (2 * n + 1)) / 6;
        return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    }
    async shutdown() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }
        this.collectMetrics();
        this.connectionPerformance.clear();
        this.latencyHistory.length = 0;
        this.throughputHistory.length = 0;
        this.errorHistory.length = 0;
        this.alerts.length = 0;
        this.logger.info('Performance Monitor shutdown complete');
    }
}
exports.PerformanceMonitor = PerformanceMonitor;
//# sourceMappingURL=performance-monitor.js.map