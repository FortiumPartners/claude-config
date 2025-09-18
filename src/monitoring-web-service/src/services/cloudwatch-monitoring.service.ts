/**
 * CloudWatch Monitoring Service
 * Sprint 8 Task 8.1: CloudWatch integration for system monitoring
 * 
 * Implements:
 * - Custom metrics publishing to CloudWatch
 * - Performance dashboards and alerts
 * - Application health monitoring
 * - Business KPI tracking
 * - Automated alert management
 */

import { CloudWatch, CloudWatchLogs } from 'aws-sdk';
import * as winston from 'winston';
import { EventEmitter } from 'events';

export interface CustomMetric {
  metricName: string;
  namespace: string;
  value: number;
  unit: 'Count' | 'Percent' | 'Seconds' | 'Milliseconds' | 'Bytes';
  dimensions?: Array<{ Name: string; Value: string }>;
  timestamp?: Date;
}

export interface PerformanceDashboard {
  dashboardName: string;
  widgets: DashboardWidget[];
  refreshInterval: number; // seconds
  autoRefresh: boolean;
}

export interface DashboardWidget {
  id: string;
  type: 'metric' | 'log' | 'number' | 'alarm';
  title: string;
  metrics: string[];
  period: number; // seconds
  stat: 'Average' | 'Sum' | 'Maximum' | 'Minimum' | 'SampleCount';
  region: string;
  yAxis?: {
    left?: { min?: number; max?: number };
    right?: { min?: number; max?: number };
  };
}

export interface MetricAlert {
  alertName: string;
  metricName: string;
  namespace: string;
  threshold: number;
  comparisonOperator: 'GreaterThanThreshold' | 'LessThanThreshold' | 'GreaterThanOrEqualToThreshold' | 'LessThanOrEqualToThreshold';
  evaluationPeriods: number;
  period: number; // seconds
  treatMissingData: 'breaching' | 'notBreaching' | 'ignore' | 'missing';
  snsTopicArn?: string;
  enabled: boolean;
}

export class CloudWatchMonitoringService extends EventEmitter {
  private cloudwatch: CloudWatch;
  private cloudwatchLogs: CloudWatchLogs;
  private metricBuffer: CustomMetric[] = [];
  private publishInterval: NodeJS.Timeout;
  private logGroupName: string;
  private logStreamName: string;

  constructor(
    private logger: winston.Logger,
    private config: {
      region: string;
      namespace: string;
      logGroupName: string;
      bufferSize: number;
      publishIntervalMs: number;
      enableMetricBuffering: boolean;
      enableDashboards: boolean;
      enableAlerts: boolean;
    }
  ) {
    super();

    this.cloudwatch = new CloudWatch({ region: this.config.region });
    this.cloudwatchLogs = new CloudWatchLogs({ region: this.config.region });
    
    this.logGroupName = this.config.logGroupName;
    this.logStreamName = `external-metrics-${new Date().toISOString().split('T')[0]}-${Math.random().toString(36).substring(7)}`;

    this.setupLogStream();
    this.startMetricPublishing();
  }

  /**
   * Publish custom metric to CloudWatch
   */
  async publishMetric(metric: CustomMetric): Promise<void> {
    try {
      if (this.config.enableMetricBuffering) {
        this.metricBuffer.push(metric);
        
        if (this.metricBuffer.length >= this.config.bufferSize) {
          await this.flushMetricBuffer();
        }
      } else {
        await this.publishSingleMetric(metric);
      }

      this.emit('metric:published', metric);

    } catch (error) {
      this.logger.error('Failed to publish metric', {
        metricName: metric.metricName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Publish multiple performance metrics
   */
  async publishPerformanceMetrics(metrics: {
    apiResponseTime: number;
    databaseQueryTime: number;
    cacheHitRate: number;
    activeConnections: number;
    memoryUsage: number;
    cpuUsage: number;
    organizationId?: string;
  }): Promise<void> {
    const dimensions = metrics.organizationId 
      ? [{ Name: 'OrganizationId', Value: metrics.organizationId }]
      : undefined;

    const metricsToPublish: CustomMetric[] = [
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

  /**
   * Publish business KPI metrics
   */
  async publishBusinessMetrics(metrics: {
    dailyActiveUsers: number;
    sessionCount: number;
    averageProductivityScore: number;
    toolUsageCount: number;
    organizationId?: string;
  }): Promise<void> {
    const dimensions = metrics.organizationId 
      ? [{ Name: 'OrganizationId', Value: metrics.organizationId }]
      : undefined;

    const metricsToPublish: CustomMetric[] = [
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

  /**
   * Create performance dashboard
   */
  async createPerformanceDashboard(): Promise<string> {
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

    } catch (error) {
      this.logger.error('Failed to create performance dashboard', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Create metric alerts
   */
  async createMetricAlerts(): Promise<string[]> {
    if (!this.config.enableAlerts) {
      throw new Error('Alert creation is disabled');
    }

    const alerts: MetricAlert[] = [
      {
        alertName: 'HighAPIResponseTime',
        metricName: 'APIResponseTime',
        namespace: this.config.namespace,
        threshold: 1000, // 1 second
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
        threshold: 70, // 70%
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
        threshold: 500, // 500ms
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
        threshold: 1073741824, // 1GB
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
        threshold: 80, // 80%
        comparisonOperator: 'GreaterThanThreshold',
        evaluationPeriods: 3,
        period: 300,
        treatMissingData: 'notBreaching',
        enabled: true,
      },
    ];

    const createdAlerts: string[] = [];

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

        } catch (error) {
          this.logger.error('Failed to create metric alert', {
            alertName: alert.alertName,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    return createdAlerts;
  }

  /**
   * Log structured application events
   */
  async logEvent(event: {
    level: 'INFO' | 'WARN' | 'ERROR';
    message: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
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

    } catch (error) {
      this.logger.error('Failed to log event to CloudWatch', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get metric statistics
   */
  async getMetricStatistics(params: {
    metricName: string;
    namespace: string;
    startTime: Date;
    endTime: Date;
    period: number;
    statistics: string[];
    dimensions?: Array<{ Name: string; Value: string }>;
  }): Promise<any> {
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

    } catch (error) {
      this.logger.error('Failed to get metric statistics', {
        metricName: params.metricName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Private methods
   */
  private async setupLogStream(): Promise<void> {
    try {
      // Create log group if it doesn't exist
      try {
        await this.cloudwatchLogs.createLogGroup({
          logGroupName: this.logGroupName,
        }).promise();
      } catch (error: any) {
        if (error.code !== 'ResourceAlreadyExistsException') {
          throw error;
        }
      }

      // Create log stream
      await this.cloudwatchLogs.createLogStream({
        logGroupName: this.logGroupName,
        logStreamName: this.logStreamName,
      }).promise();

      this.logger.info('CloudWatch log stream setup complete', {
        logGroupName: this.logGroupName,
        logStreamName: this.logStreamName,
      });

    } catch (error) {
      this.logger.error('Failed to setup CloudWatch log stream', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private startMetricPublishing(): void {
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

  private async flushMetricBuffer(): Promise<void> {
    if (this.metricBuffer.length === 0) return;

    try {
      const metricsToPublish = [...this.metricBuffer];
      this.metricBuffer = [];

      // Group metrics by namespace for batch publishing
      const metricsByNamespace = new Map<string, CustomMetric[]>();
      
      for (const metric of metricsToPublish) {
        if (!metricsByNamespace.has(metric.namespace)) {
          metricsByNamespace.set(metric.namespace, []);
        }
        metricsByNamespace.get(metric.namespace)!.push(metric);
      }

      // Publish metrics by namespace
      for (const [namespace, metrics] of metricsByNamespace) {
        await this.publishMetricBatch(namespace, metrics);
      }

      this.logger.debug('Metric buffer flushed', {
        metricCount: metricsToPublish.length,
        namespaceCount: metricsByNamespace.size,
      });

    } catch (error) {
      this.logger.error('Failed to flush metric buffer', {
        bufferSize: this.metricBuffer.length,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async publishSingleMetric(metric: CustomMetric): Promise<void> {
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

  private async publishMetricBatch(namespace: string, metrics: CustomMetric[]): Promise<void> {
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

  private async createSingleAlert(alert: MetricAlert): Promise<void> {
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
      (params as any).AlarmActions = [alert.snsTopicArn];
      (params as any).OKActions = [alert.snsTopicArn];
    }

    await this.cloudwatch.putMetricAlarm(params).promise();
  }

  /**
   * Shutdown monitoring service
   */
  async shutdown(): Promise<void> {
    if (this.publishInterval) {
      clearInterval(this.publishInterval);
    }

    // Flush remaining metrics
    if (this.metricBuffer.length > 0) {
      await this.flushMetricBuffer();
    }

    this.logger.info('CloudWatch Monitoring Service shutdown complete');
  }
}