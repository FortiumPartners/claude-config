"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloudWatchMonitoringService = void 0;
const aws_sdk_1 = require("aws-sdk");
const events_1 = require("events");
class CloudWatchMonitoringService extends events_1.EventEmitter {
    logger;
    config;
    cloudwatch;
    cloudwatchLogs;
    metricBuffer = [];
    publishInterval;
    logGroupName;
    logStreamName;
    constructor(logger, config) {
        super();
        this.logger = logger;
        this.config = config;
        this.cloudwatch = new aws_sdk_1.CloudWatch({ region: this.config.region });
        this.cloudwatchLogs = new aws_sdk_1.CloudWatchLogs({ region: this.config.region });
        this.logGroupName = this.config.logGroupName;
        this.logStreamName = `external-metrics-${new Date().toISOString().split('T')[0]}-${Math.random().toString(36).substring(7)}`;
        this.setupLogStream();
        this.startMetricPublishing();
    }
    async publishMetric(metric) {
        try {
            if (this.config.enableMetricBuffering) {
                this.metricBuffer.push(metric);
                if (this.metricBuffer.length >= this.config.bufferSize) {
                    await this.flushMetricBuffer();
                }
            }
            else {
                await this.publishSingleMetric(metric);
            }
            this.emit('metric:published', metric);
        }
        catch (error) {
            this.logger.error('Failed to publish metric', {
                metricName: metric.metricName,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
        }
    }
    async publishPerformanceMetrics(metrics) {
        const dimensions = metrics.organizationId
            ? [{ Name: 'OrganizationId', Value: metrics.organizationId }]
            : undefined;
        const metricsToPublish = [
            {
                metricName: 'APIResponseTime',
                namespace: this.config.namespace,
                value: metrics.apiResponseTime,
                unit: 'Milliseconds',
                dimensions,
            },
            {
                metricName: 'DatabaseQueryTime',
                namespace: this.config.namespace,
                value: metrics.databaseQueryTime,
                unit: 'Milliseconds',
                dimensions,
            },
            {
                metricName: 'CacheHitRate',
                namespace: this.config.namespace,
                value: metrics.cacheHitRate,
                unit: 'Percent',
                dimensions,
            },
            {
                metricName: 'ActiveConnections',
                namespace: this.config.namespace,
                value: metrics.activeConnections,
                unit: 'Count',
                dimensions,
            },
            {
                metricName: 'MemoryUsage',
                namespace: this.config.namespace,
                value: metrics.memoryUsage,
                unit: 'Bytes',
                dimensions,
            },
            {
                metricName: 'CPUUsage',
                namespace: this.config.namespace,
                value: metrics.cpuUsage,
                unit: 'Percent',
                dimensions,
            },
        ];
        for (const metric of metricsToPublish) {
            await this.publishMetric(metric);
        }
    }
    async publishBusinessMetrics(metrics) {
        const dimensions = metrics.organizationId
            ? [{ Name: 'OrganizationId', Value: metrics.organizationId }]
            : undefined;
        const metricsToPublish = [
            {
                metricName: 'DailyActiveUsers',
                namespace: `${this.config.namespace}/Business`,
                value: metrics.dailyActiveUsers,
                unit: 'Count',
                dimensions,
            },
            {
                metricName: 'SessionCount',
                namespace: `${this.config.namespace}/Business`,
                value: metrics.sessionCount,
                unit: 'Count',
                dimensions,
            },
            {
                metricName: 'AverageProductivityScore',
                namespace: `${this.config.namespace}/Business`,
                value: metrics.averageProductivityScore,
                unit: 'Count',
                dimensions,
            },
            {
                metricName: 'ToolUsageCount',
                namespace: `${this.config.namespace}/Business`,
                value: metrics.toolUsageCount,
                unit: 'Count',
                dimensions,
            },
        ];
        for (const metric of metricsToPublish) {
            await this.publishMetric(metric);
        }
    }
    async createPerformanceDashboard() {
        if (!this.config.enableDashboards) {
            throw new Error('Dashboard creation is disabled');
        }
        const dashboardBody = {
            widgets: [
                {
                    type: 'metric',
                    x: 0,
                    y: 0,
                    width: 12,
                    height: 6,
                    properties: {
                        metrics: [
                            [this.config.namespace, 'APIResponseTime'],
                            [this.config.namespace, 'DatabaseQueryTime'],
                        ],
                        period: 300,
                        stat: 'Average',
                        region: this.config.region,
                        title: 'Response Times',
                        yAxis: {
                            left: {
                                min: 0,
                            },
                        },
                    },
                },
                {
                    type: 'metric',
                    x: 12,
                    y: 0,
                    width: 12,
                    height: 6,
                    properties: {
                        metrics: [
                            [this.config.namespace, 'CacheHitRate'],
                        ],
                        period: 300,
                        stat: 'Average',
                        region: this.config.region,
                        title: 'Cache Performance',
                        yAxis: {
                            left: {
                                min: 0,
                                max: 100,
                            },
                        },
                    },
                },
                {
                    type: 'metric',
                    x: 0,
                    y: 6,
                    width: 8,
                    height: 6,
                    properties: {
                        metrics: [
                            [this.config.namespace, 'ActiveConnections'],
                        ],
                        period: 300,
                        stat: 'Average',
                        region: this.config.region,
                        title: 'Database Connections',
                    },
                },
                {
                    type: 'metric',
                    x: 8,
                    y: 6,
                    width: 8,
                    height: 6,
                    properties: {
                        metrics: [
                            [this.config.namespace, 'MemoryUsage'],
                        ],
                        period: 300,
                        stat: 'Average',
                        region: this.config.region,
                        title: 'Memory Usage',
                    },
                },
                {
                    type: 'metric',
                    x: 16,
                    y: 6,
                    width: 8,
                    height: 6,
                    properties: {
                        metrics: [
                            [this.config.namespace, 'CPUUsage'],
                        ],
                        period: 300,
                        stat: 'Average',
                        region: this.config.region,
                        title: 'CPU Usage',
                    },
                },
                {
                    type: 'metric',
                    x: 0,
                    y: 12,
                    width: 24,
                    height: 6,
                    properties: {
                        metrics: [
                            [`${this.config.namespace}/Business`, 'DailyActiveUsers'],
                            [`${this.config.namespace}/Business`, 'SessionCount'],
                            [`${this.config.namespace}/Business`, 'ToolUsageCount'],
                        ],
                        period: 3600,
                        stat: 'Sum',
                        region: this.config.region,
                        title: 'Business Metrics',
                    },
                },
            ],
        };
        try {
            const dashboardName = `ExternalMetricsService-Performance-${Date.now()}`;
            const params = {
                DashboardName: dashboardName,
                DashboardBody: JSON.stringify(dashboardBody),
            };
            await this.cloudwatch.putDashboard(params).promise();
            this.logger.info('Performance dashboard created', {
                dashboardName,
                widgetCount: dashboardBody.widgets.length,
            });
            return dashboardName;
        }
        catch (error) {
            this.logger.error('Failed to create performance dashboard', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
        }
    }
    async createMetricAlerts() {
        if (!this.config.enableAlerts) {
            throw new Error('Alert creation is disabled');
        }
        const alerts = [
            {
                alertName: 'HighAPIResponseTime',
                metricName: 'APIResponseTime',
                namespace: this.config.namespace,
                threshold: 1000,
                comparisonOperator: 'GreaterThanThreshold',
                evaluationPeriods: 2,
                period: 300,
                treatMissingData: 'notBreaching',
                enabled: true,
            },
            {
                alertName: 'LowCacheHitRate',
                metricName: 'CacheHitRate',
                namespace: this.config.namespace,
                threshold: 70,
                comparisonOperator: 'LessThanThreshold',
                evaluationPeriods: 3,
                period: 300,
                treatMissingData: 'notBreaching',
                enabled: true,
            },
            {
                alertName: 'HighDatabaseQueryTime',
                metricName: 'DatabaseQueryTime',
                namespace: this.config.namespace,
                threshold: 500,
                comparisonOperator: 'GreaterThanThreshold',
                evaluationPeriods: 2,
                period: 300,
                treatMissingData: 'notBreaching',
                enabled: true,
            },
            {
                alertName: 'HighMemoryUsage',
                metricName: 'MemoryUsage',
                namespace: this.config.namespace,
                threshold: 1073741824,
                comparisonOperator: 'GreaterThanThreshold',
                evaluationPeriods: 3,
                period: 300,
                treatMissingData: 'notBreaching',
                enabled: true,
            },
            {
                alertName: 'HighCPUUsage',
                metricName: 'CPUUsage',
                namespace: this.config.namespace,
                threshold: 80,
                comparisonOperator: 'GreaterThanThreshold',
                evaluationPeriods: 3,
                period: 300,
                treatMissingData: 'notBreaching',
                enabled: true,
            },
        ];
        const createdAlerts = [];
        for (const alert of alerts) {
            if (alert.enabled) {
                try {
                    await this.createSingleAlert(alert);
                    createdAlerts.push(alert.alertName);
                    this.logger.info('Metric alert created', {
                        alertName: alert.alertName,
                        metricName: alert.metricName,
                        threshold: alert.threshold,
                    });
                }
                catch (error) {
                    this.logger.error('Failed to create metric alert', {
                        alertName: alert.alertName,
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                }
            }
        }
        return createdAlerts;
    }
    async logEvent(event) {
        try {
            const logEvent = {
                timestamp: Date.now(),
                message: JSON.stringify({
                    level: event.level,
                    message: event.message,
                    metadata: event.metadata || {},
                    service: 'external-metrics-service',
                }),
            };
            const params = {
                logGroupName: this.logGroupName,
                logStreamName: this.logStreamName,
                logEvents: [logEvent],
            };
            await this.cloudwatchLogs.putLogEvents(params).promise();
        }
        catch (error) {
            this.logger.error('Failed to log event to CloudWatch', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    async getMetricStatistics(params) {
        try {
            const cloudwatchParams = {
                MetricName: params.metricName,
                Namespace: params.namespace,
                StartTime: params.startTime,
                EndTime: params.endTime,
                Period: params.period,
                Statistics: params.statistics,
                Dimensions: params.dimensions || [],
            };
            const result = await this.cloudwatch.getMetricStatistics(cloudwatchParams).promise();
            return result.Datapoints;
        }
        catch (error) {
            this.logger.error('Failed to get metric statistics', {
                metricName: params.metricName,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
        }
    }
    async setupLogStream() {
        try {
            try {
                await this.cloudwatchLogs.createLogGroup({
                    logGroupName: this.logGroupName,
                }).promise();
            }
            catch (error) {
                if (error.code !== 'ResourceAlreadyExistsException') {
                    throw error;
                }
            }
            await this.cloudwatchLogs.createLogStream({
                logGroupName: this.logGroupName,
                logStreamName: this.logStreamName,
            }).promise();
            this.logger.info('CloudWatch log stream setup complete', {
                logGroupName: this.logGroupName,
                logStreamName: this.logStreamName,
            });
        }
        catch (error) {
            this.logger.error('Failed to setup CloudWatch log stream', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    startMetricPublishing() {
        this.publishInterval = setInterval(async () => {
            if (this.metricBuffer.length > 0) {
                await this.flushMetricBuffer();
            }
        }, this.config.publishIntervalMs);
        this.logger.info('Metric publishing started', {
            interval: this.config.publishIntervalMs,
            bufferSize: this.config.bufferSize,
        });
    }
    async flushMetricBuffer() {
        if (this.metricBuffer.length === 0)
            return;
        try {
            const metricsToPublish = [...this.metricBuffer];
            this.metricBuffer = [];
            const metricsByNamespace = new Map();
            for (const metric of metricsToPublish) {
                if (!metricsByNamespace.has(metric.namespace)) {
                    metricsByNamespace.set(metric.namespace, []);
                }
                metricsByNamespace.get(metric.namespace).push(metric);
            }
            for (const [namespace, metrics] of metricsByNamespace) {
                await this.publishMetricBatch(namespace, metrics);
            }
            this.logger.debug('Metric buffer flushed', {
                metricCount: metricsToPublish.length,
                namespaceCount: metricsByNamespace.size,
            });
        }
        catch (error) {
            this.logger.error('Failed to flush metric buffer', {
                bufferSize: this.metricBuffer.length,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    async publishSingleMetric(metric) {
        const params = {
            Namespace: metric.namespace,
            MetricData: [
                {
                    MetricName: metric.metricName,
                    Value: metric.value,
                    Unit: metric.unit,
                    Timestamp: metric.timestamp || new Date(),
                    Dimensions: metric.dimensions || [],
                },
            ],
        };
        await this.cloudwatch.putMetricData(params).promise();
    }
    async publishMetricBatch(namespace, metrics) {
        const params = {
            Namespace: namespace,
            MetricData: metrics.map(metric => ({
                MetricName: metric.metricName,
                Value: metric.value,
                Unit: metric.unit,
                Timestamp: metric.timestamp || new Date(),
                Dimensions: metric.dimensions || [],
            })),
        };
        await this.cloudwatch.putMetricData(params).promise();
    }
    async createSingleAlert(alert) {
        const params = {
            AlarmName: alert.alertName,
            ComparisonOperator: alert.comparisonOperator,
            EvaluationPeriods: alert.evaluationPeriods,
            MetricName: alert.metricName,
            Namespace: alert.namespace,
            Period: alert.period,
            Statistic: 'Average',
            Threshold: alert.threshold,
            ActionsEnabled: true,
            AlarmDescription: `Alert for ${alert.metricName} in ${alert.namespace}`,
            TreatMissingData: alert.treatMissingData,
            Unit: 'None',
        };
        if (alert.snsTopicArn) {
            params.AlarmActions = [alert.snsTopicArn];
            params.OKActions = [alert.snsTopicArn];
        }
        await this.cloudwatch.putMetricAlarm(params).promise();
    }
    async shutdown() {
        if (this.publishInterval) {
            clearInterval(this.publishInterval);
        }
        if (this.metricBuffer.length > 0) {
            await this.flushMetricBuffer();
        }
        this.logger.info('CloudWatch Monitoring Service shutdown complete');
    }
}
exports.CloudWatchMonitoringService = CloudWatchMonitoringService;
//# sourceMappingURL=cloudwatch-monitoring.service.js.map