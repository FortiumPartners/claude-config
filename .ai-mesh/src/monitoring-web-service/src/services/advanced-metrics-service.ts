/**
 * Advanced Metrics Collection and Aggregation Service
 * Sprint 6 - Task 6.1: Comprehensive metrics collection with custom metrics, federation, and cardinality management
 *
 * Performance Targets:
 * - >100,000 metrics/second ingestion rate
 * - <1 second latency for metrics queries
 * - Intelligent cardinality management
 * - Multi-dimensional metrics with Federation support
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as client from 'prom-client';
import axios from 'axios';
import * as NodeCache from 'node-cache';
import { MetricsModel } from '../models/metrics.model';

// Custom Metric Types
interface CustomMetric {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  help: string;
  labels: string[];
  buckets?: number[];
}

interface MetricAggregation {
  window: string;
  retention: string;
  functions: string[];
}

interface CardinalityConfig {
  enabled: boolean;
  maxSeriesPerMetric: number;
  maxTotalSeries: number;
  highCardinalityThreshold: number;
  dropLabels: string[];
  aggregateLabels: Record<string, string>;
}

interface FederationConfig {
  enabled: boolean;
  prometheusUrl: string;
  syncInterval: number;
  matchPatterns: string[];
}

@Injectable()
export class AdvancedMetricsService {
  private readonly logger = new Logger(AdvancedMetricsService.name);
  private readonly metricsRegistry = new client.Registry();
  private readonly customMetrics = new Map<string, any>();
  private readonly aggregationCache = new NodeCache({ stdTTL: 300 });
  private readonly federationCache = new NodeCache({ stdTTL: 60 });

  // Performance metrics
  private metricsIngestionRate: client.Counter;
  private metricsProcessingDuration: client.Histogram;
  private activeSeriesCount: client.Gauge;
  private cardinalityViolations: client.Counter;
  private federationSyncLatency: client.Histogram;

  // Helm Chart Specialist specific metrics
  private helmChartGenerationDuration: client.Histogram;
  private helmChartGenerationTotal: client.Counter;
  private helmDeploymentDuration: client.Histogram;
  private helmDeploymentTotal: client.Counter;
  private helmChartValidationDuration: client.Histogram;
  private helmChartOptimizationScore: client.Gauge;
  private helmSecurityScanDuration: client.Histogram;
  private helmVulnerabilitiesDetected: client.Counter;
  private helmPolicyViolations: client.Counter;

  // Application performance metrics
  private appHttpRequestsTotal: client.Counter;
  private appHttpRequestDuration: client.Histogram;
  private appDatabaseQueryDuration: client.Histogram;
  private appCacheOperationsTotal: client.Counter;
  private appCacheHitRatio: client.Gauge;

  // Business metrics
  private businessChartDeploymentSuccessRate: client.Gauge;
  private businessDeploymentFrequency: client.Gauge;
  private businessMTTR: client.Gauge;
  private businessUserSatisfactionScore: client.Gauge;

  constructor(
    @InjectRepository(MetricsModel)
    private metricsRepository: Repository<MetricsModel>,
    private configService: ConfigService,
  ) {
    this.initializeMetrics();
    this.setupCustomMetrics();
    this.setupAggregationRules();
    this.startFederationSync();
  }

  /**
   * Initialize core performance and monitoring metrics
   */
  private initializeMetrics(): void {
    // Performance tracking metrics
    this.metricsIngestionRate = new client.Counter({
      name: 'metrics_ingestion_total',
      help: 'Total metrics ingested',
      labelNames: ['source', 'type'],
      registers: [this.metricsRegistry]
    });

    this.metricsProcessingDuration = new client.Histogram({
      name: 'metrics_processing_duration_seconds',
      help: 'Time taken to process metrics batch',
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0],
      labelNames: ['operation', 'batch_size'],
      registers: [this.metricsRegistry]
    });

    this.activeSeriesCount = new client.Gauge({
      name: 'active_metrics_series_count',
      help: 'Number of active metrics series',
      labelNames: ['metric_type'],
      registers: [this.metricsRegistry]
    });

    this.cardinalityViolations = new client.Counter({
      name: 'cardinality_violations_total',
      help: 'Number of cardinality limit violations',
      labelNames: ['metric_name', 'violation_type'],
      registers: [this.metricsRegistry]
    });

    this.federationSyncLatency = new client.Histogram({
      name: 'federation_sync_duration_seconds',
      help: 'Time taken for federation sync',
      buckets: [0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0],
      labelNames: ['source', 'status'],
      registers: [this.metricsRegistry]
    });

    this.logger.log('Core metrics initialized successfully');
  }

  /**
   * Setup Helm Chart Specialist specific custom metrics
   */
  private setupCustomMetrics(): void {
    // Helm Chart Operations Metrics
    this.helmChartGenerationDuration = new client.Histogram({
      name: 'helm_chart_generation_duration_seconds',
      help: 'Time taken to generate a Helm chart',
      buckets: [0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0],
      labelNames: ['chart_type', 'application_type', 'complexity'],
      registers: [this.metricsRegistry]
    });

    this.helmChartGenerationTotal = new client.Counter({
      name: 'helm_chart_generation_total',
      help: 'Total number of Helm charts generated',
      labelNames: ['chart_type', 'status', 'application_type'],
      registers: [this.metricsRegistry]
    });

    this.helmDeploymentDuration = new client.Histogram({
      name: 'helm_deployment_duration_seconds',
      help: 'Time taken for Helm deployment operations',
      buckets: [1.0, 5.0, 10.0, 30.0, 60.0, 120.0, 300.0],
      labelNames: ['operation', 'environment', 'chart_name', 'namespace'],
      registers: [this.metricsRegistry]
    });

    this.helmDeploymentTotal = new client.Counter({
      name: 'helm_deployment_total',
      help: 'Total number of Helm deployment operations',
      labelNames: ['operation', 'status', 'environment', 'chart_name'],
      registers: [this.metricsRegistry]
    });

    this.helmChartValidationDuration = new client.Histogram({
      name: 'helm_chart_validation_duration_seconds',
      help: 'Time taken for chart validation and testing',
      buckets: [0.5, 1.0, 2.0, 5.0, 10.0, 30.0, 120.0],
      labelNames: ['validation_type', 'chart_name'],
      registers: [this.metricsRegistry]
    });

    this.helmChartOptimizationScore = new client.Gauge({
      name: 'helm_chart_optimization_score',
      help: 'Chart optimization quality score (0-100)',
      labelNames: ['chart_name', 'optimization_type'],
      registers: [this.metricsRegistry]
    });

    // Security and Compliance Metrics
    this.helmSecurityScanDuration = new client.Histogram({
      name: 'helm_security_scan_duration_seconds',
      help: 'Time taken for security scanning',
      buckets: [5.0, 10.0, 30.0, 60.0, 120.0, 180.0],
      labelNames: ['scanner_type', 'chart_name'],
      registers: [this.metricsRegistry]
    });

    this.helmVulnerabilitiesDetected = new client.Counter({
      name: 'helm_vulnerabilities_detected_total',
      help: 'Total vulnerabilities detected in charts',
      labelNames: ['severity', 'scanner_type', 'chart_name'],
      registers: [this.metricsRegistry]
    });

    this.helmPolicyViolations = new client.Counter({
      name: 'helm_policy_violations_total',
      help: 'Total policy violations detected',
      labelNames: ['policy_type', 'severity', 'chart_name'],
      registers: [this.metricsRegistry]
    });

    // Application Performance Metrics
    this.appHttpRequestsTotal = new client.Counter({
      name: 'app_http_requests_total',
      help: 'Total HTTP requests by status code and method',
      labelNames: ['method', 'status_code', 'endpoint', 'service'],
      registers: [this.metricsRegistry]
    });

    this.appHttpRequestDuration = new client.Histogram({
      name: 'app_http_request_duration_seconds',
      help: 'HTTP request latency',
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
      labelNames: ['method', 'endpoint', 'service'],
      registers: [this.metricsRegistry]
    });

    this.appDatabaseQueryDuration = new client.Histogram({
      name: 'app_database_query_duration_seconds',
      help: 'Database query execution time',
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.0],
      labelNames: ['query_type', 'table', 'operation'],
      registers: [this.metricsRegistry]
    });

    this.appCacheOperationsTotal = new client.Counter({
      name: 'app_cache_operations_total',
      help: 'Total cache operations',
      labelNames: ['operation', 'cache_name', 'status'],
      registers: [this.metricsRegistry]
    });

    this.appCacheHitRatio = new client.Gauge({
      name: 'app_cache_hit_ratio',
      help: 'Cache hit ratio',
      labelNames: ['cache_name'],
      registers: [this.metricsRegistry]
    });

    // Business Metrics
    this.businessChartDeploymentSuccessRate = new client.Gauge({
      name: 'business_chart_deployment_success_rate',
      help: 'Chart deployment success rate percentage',
      labelNames: ['environment', 'team', 'application_type'],
      registers: [this.metricsRegistry]
    });

    this.businessDeploymentFrequency = new client.Gauge({
      name: 'business_deployment_frequency',
      help: 'Deployment frequency per day',
      labelNames: ['environment', 'team'],
      registers: [this.metricsRegistry]
    });

    this.businessMTTR = new client.Gauge({
      name: 'business_mean_time_to_deployment',
      help: 'Mean time to deployment in minutes',
      labelNames: ['environment', 'complexity'],
      registers: [this.metricsRegistry]
    });

    this.businessUserSatisfactionScore = new client.Gauge({
      name: 'business_user_satisfaction_score',
      help: 'User satisfaction score (1-10)',
      labelNames: ['feature', 'user_type'],
      registers: [this.metricsRegistry]
    });

    this.logger.log('Custom Helm Chart Specialist metrics initialized');
  }

  /**
   * Setup aggregation rules for efficient time-series processing
   */
  private setupAggregationRules(): void {
    const aggregations: MetricAggregation[] = [
      { window: '1m', retention: '24h', functions: ['rate', 'avg'] },
      { window: '5m', retention: '7d', functions: ['rate', 'avg', 'max'] },
      { window: '15m', retention: '30d', functions: ['rate', 'avg', 'max', 'min'] },
      { window: '1h', retention: '90d', functions: ['rate', 'avg', 'max', 'min', 'stddev'] },
      { window: '6h', retention: '1y', functions: ['avg', 'max', 'min'] },
      { window: '1d', retention: '5y', functions: ['avg', 'max', 'min'] }
    ];

    // Store aggregation configuration
    this.aggregationCache.set('rules', aggregations);
    this.logger.log(`Setup ${aggregations.length} aggregation rules`);
  }

  /**
   * Record Helm chart generation metrics
   */
  async recordChartGeneration(
    chartType: string,
    applicationType: string,
    complexity: string,
    duration: number,
    status: 'success' | 'error'
  ): Promise<void> {
    const timer = this.metricsProcessingDuration.startTimer({ operation: 'chart_generation', batch_size: '1' });

    try {
      // Record generation duration
      this.helmChartGenerationDuration
        .labels(chartType, applicationType, complexity)
        .observe(duration);

      // Record generation count
      this.helmChartGenerationTotal
        .labels(chartType, status, applicationType)
        .inc();

      // Update ingestion rate
      this.metricsIngestionRate.labels('helm_specialist', 'chart_generation').inc();

      // Store in database for long-term analysis
      await this.storeMetricPoint('helm_chart_generation', {
        chart_type: chartType,
        application_type: applicationType,
        complexity,
        duration,
        status,
        timestamp: new Date()
      });

      this.logger.log(`Recorded chart generation: ${chartType}/${applicationType} in ${duration}s`);
    } catch (error) {
      this.logger.error('Error recording chart generation metrics', error);
    } finally {
      timer();
    }
  }

  /**
   * Record Helm deployment operation metrics
   */
  async recordDeploymentOperation(
    operation: 'install' | 'upgrade' | 'rollback' | 'delete',
    environment: string,
    chartName: string,
    namespace: string,
    duration: number,
    status: 'success' | 'error'
  ): Promise<void> {
    const timer = this.metricsProcessingDuration.startTimer({ operation: 'deployment', batch_size: '1' });

    try {
      // Record deployment duration
      this.helmDeploymentDuration
        .labels(operation, environment, chartName, namespace)
        .observe(duration);

      // Record deployment count
      this.helmDeploymentTotal
        .labels(operation, status, environment, chartName)
        .inc();

      // Update ingestion rate
      this.metricsIngestionRate.labels('helm_specialist', 'deployment').inc();

      // Store in database
      await this.storeMetricPoint('helm_deployment', {
        operation,
        environment,
        chart_name: chartName,
        namespace,
        duration,
        status,
        timestamp: new Date()
      });

      this.logger.log(`Recorded deployment: ${operation}/${chartName} in ${environment} (${duration}s)`);
    } catch (error) {
      this.logger.error('Error recording deployment metrics', error);
    } finally {
      timer();
    }
  }

  /**
   * Record security scan results
   */
  async recordSecurityScan(
    scannerType: string,
    chartName: string,
    duration: number,
    vulnerabilities: Array<{severity: string, count: number}>
  ): Promise<void> {
    const timer = this.metricsProcessingDuration.startTimer({ operation: 'security_scan', batch_size: '1' });

    try {
      // Record scan duration
      this.helmSecurityScanDuration
        .labels(scannerType, chartName)
        .observe(duration);

      // Record vulnerabilities by severity
      vulnerabilities.forEach(vuln => {
        this.helmVulnerabilitiesDetected
          .labels(vuln.severity, scannerType, chartName)
          .inc(vuln.count);
      });

      // Update ingestion rate
      this.metricsIngestionRate.labels('helm_specialist', 'security_scan').inc();

      // Store in database
      await this.storeMetricPoint('helm_security_scan', {
        scanner_type: scannerType,
        chart_name: chartName,
        duration,
        vulnerabilities,
        timestamp: new Date()
      });

      this.logger.log(`Recorded security scan: ${chartName} with ${scannerType} (${duration}s)`);
    } catch (error) {
      this.logger.error('Error recording security scan metrics', error);
    } finally {
      timer();
    }
  }

  /**
   * Record HTTP request metrics
   */
  recordHttpRequest(
    method: string,
    statusCode: string,
    endpoint: string,
    service: string,
    duration: number
  ): void {
    this.appHttpRequestsTotal
      .labels(method, statusCode, endpoint, service)
      .inc();

    this.appHttpRequestDuration
      .labels(method, endpoint, service)
      .observe(duration);

    this.metricsIngestionRate.labels('application', 'http_request').inc();
  }

  /**
   * Record database query metrics
   */
  recordDatabaseQuery(
    queryType: string,
    table: string,
    operation: string,
    duration: number
  ): void {
    this.appDatabaseQueryDuration
      .labels(queryType, table, operation)
      .observe(duration);

    this.metricsIngestionRate.labels('application', 'database_query').inc();
  }

  /**
   * Update business metrics
   */
  async updateBusinessMetrics(): Promise<void> {
    const timer = this.metricsProcessingDuration.startTimer({ operation: 'business_metrics', batch_size: 'bulk' });

    try {
      // Calculate deployment success rate
      const successRate = await this.calculateDeploymentSuccessRate();
      this.businessChartDeploymentSuccessRate.set(successRate);

      // Calculate deployment frequency
      const deploymentFreq = await this.calculateDeploymentFrequency();
      this.businessDeploymentFrequency.set(deploymentFreq);

      // Calculate MTTR
      const mttr = await this.calculateMTTR();
      this.businessMTTR.set(mttr);

      this.logger.log(`Updated business metrics: Success Rate: ${successRate}%, Frequency: ${deploymentFreq}/day, MTTR: ${mttr}min`);
    } catch (error) {
      this.logger.error('Error updating business metrics', error);
    } finally {
      timer();
    }
  }

  /**
   * Federation sync with external Prometheus instances
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  private async syncFederation(): Promise<void> {
    const federationConfig: FederationConfig = {
      enabled: this.configService.get<boolean>('ENABLE_FEDERATION', true),
      prometheusUrl: this.configService.get<string>('PROMETHEUS_URL', 'http://prometheus:9090'),
      syncInterval: this.configService.get<number>('FEDERATION_SYNC_INTERVAL', 30),
      matchPatterns: ['{job=~"helm.*"}', '{job=~"monitoring.*"}', '{__name__=~"business_.*"}']
    };

    if (!federationConfig.enabled) {
      return;
    }

    const timer = this.federationSyncLatency.startTimer({ source: 'prometheus', status: 'unknown' });

    try {
      const federateUrl = `${federationConfig.prometheusUrl}/federate`;
      const params = {
        'match[]': federationConfig.matchPatterns
      };

      const response = await axios.get(federateUrl, {
        params,
        timeout: 10000,
        headers: {
          'Accept': 'text/plain'
        }
      });

      if (response.status === 200) {
        const metricsData = response.data;
        await this.processFederatedMetrics(metricsData);

        timer({ source: 'prometheus', status: 'success' });
        this.logger.debug('Federation sync completed successfully');
      } else {
        timer({ source: 'prometheus', status: 'error' });
        this.logger.warn(`Federation sync failed with status: ${response.status}`);
      }
    } catch (error) {
      timer({ source: 'prometheus', status: 'error' });
      this.logger.error('Federation sync error', error);
    }
  }

  /**
   * Cardinality management to prevent memory exhaustion
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  private async manageCardinality(): Promise<void> {
    const config: CardinalityConfig = {
      enabled: this.configService.get<boolean>('CARDINALITY_MANAGEMENT_ENABLED', true),
      maxSeriesPerMetric: this.configService.get<number>('MAX_SERIES_PER_METRIC', 10000),
      maxTotalSeries: this.configService.get<number>('MAX_TOTAL_SERIES', 1000000),
      highCardinalityThreshold: this.configService.get<number>('HIGH_CARDINALITY_THRESHOLD', 100000),
      dropLabels: ['instance_id', 'request_id', 'trace_id'],
      aggregateLabels: { pod: 'deployment', container: 'service' }
    };

    if (!config.enabled) {
      return;
    }

    try {
      const metrics = await this.metricsRegistry.getMetricsAsJSON();
      let totalSeries = 0;

      for (const metric of metrics) {
        const seriesCount = Array.isArray(metric.values) ? metric.values.length : 1;
        totalSeries += seriesCount;

        // Update active series count
        this.activeSeriesCount.labels(metric.type).set(seriesCount);

        // Check for high cardinality violations
        if (seriesCount > config.maxSeriesPerMetric) {
          this.cardinalityViolations.labels(metric.name, 'per_metric').inc();
          this.logger.warn(`High cardinality detected for metric: ${metric.name} (${seriesCount} series)`);
        }
      }

      // Check total series limit
      if (totalSeries > config.maxTotalSeries) {
        this.cardinalityViolations.labels('global', 'total_series').inc();
        this.logger.warn(`Total series limit exceeded: ${totalSeries} > ${config.maxTotalSeries}`);
      }

      this.logger.debug(`Cardinality check completed. Total series: ${totalSeries}`);
    } catch (error) {
      this.logger.error('Cardinality management error', error);
    }
  }

  /**
   * Aggregation processing for time-series data
   */
  @Cron(CronExpression.EVERY_MINUTE)
  private async processAggregations(): Promise<void> {
    const rules = this.aggregationCache.get('rules') as MetricAggregation[];
    if (!rules) return;

    const timer = this.metricsProcessingDuration.startTimer({ operation: 'aggregation', batch_size: 'bulk' });

    try {
      for (const rule of rules) {
        await this.processAggregationRule(rule);
      }
      this.logger.debug('Aggregation processing completed');
    } catch (error) {
      this.logger.error('Aggregation processing error', error);
    } finally {
      timer();
    }
  }

  /**
   * Get current metrics as Prometheus format
   */
  async getMetrics(): Promise<string> {
    return this.metricsRegistry.metrics();
  }

  /**
   * Get metrics for specific time range
   */
  async getMetricsRange(
    metricName: string,
    start: Date,
    end: Date,
    labels?: Record<string, string>
  ): Promise<any[]> {
    try {
      const query = this.metricsRepository
        .createQueryBuilder('metrics')
        .where('metrics.name = :name', { name: metricName })
        .andWhere('metrics.timestamp >= :start', { start })
        .andWhere('metrics.timestamp <= :end', { end });

      if (labels) {
        Object.entries(labels).forEach(([key, value]) => {
          query.andWhere(`metrics.labels->>'${key}' = :${key}`, { [key]: value });
        });
      }

      return await query.getMany();
    } catch (error) {
      this.logger.error('Error querying metrics range', error);
      throw error;
    }
  }

  /**
   * Get aggregated metrics for dashboard
   */
  async getAggregatedMetrics(timeWindow: string = '1h'): Promise<any> {
    const cacheKey = `aggregated_${timeWindow}`;
    const cached = this.aggregationCache.get(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      const now = new Date();
      const start = new Date(now.getTime() - this.parseTimeWindow(timeWindow));

      const results = await Promise.all([
        this.calculateChartGenerationRate(start, now),
        this.calculateDeploymentSuccessRate(start, now),
        this.calculateAverageResponseTime(start, now),
        this.calculateErrorRate(start, now)
      ]);

      const aggregated = {
        chart_generation_rate: results[0],
        deployment_success_rate: results[1],
        average_response_time: results[2],
        error_rate: results[3],
        timestamp: now
      };

      this.aggregationCache.set(cacheKey, aggregated, 60);
      return aggregated;
    } catch (error) {
      this.logger.error('Error getting aggregated metrics', error);
      throw error;
    }
  }

  // Private helper methods

  private async storeMetricPoint(name: string, data: any): Promise<void> {
    try {
      const metric = this.metricsRepository.create({
        name,
        value: data.duration || data.count || 1,
        labels: data,
        timestamp: data.timestamp || new Date()
      });

      await this.metricsRepository.save(metric);
    } catch (error) {
      this.logger.error('Error storing metric point', error);
    }
  }

  private async processFederatedMetrics(metricsData: string): Promise<void> {
    // Parse Prometheus format metrics and store
    const lines = metricsData.split('\n');
    let processedCount = 0;

    for (const line of lines) {
      if (line.startsWith('#') || !line.trim()) continue;

      try {
        const parsed = this.parsePrometheusMetric(line);
        if (parsed) {
          await this.storeMetricPoint(parsed.name, parsed);
          processedCount++;
        }
      } catch (error) {
        this.logger.debug('Error parsing federated metric line', error);
      }
    }

    this.metricsIngestionRate.labels('federation', 'prometheus').inc(processedCount);
    this.logger.debug(`Processed ${processedCount} federated metrics`);
  }

  private parsePrometheusMetric(line: string): any | null {
    // Basic Prometheus format parsing
    const match = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*){.*?}\s+([\d.]+)(\s+\d+)?$/);
    if (!match) return null;

    const [, name, value, timestamp] = match;
    return {
      name,
      value: parseFloat(value),
      timestamp: timestamp ? new Date(parseInt(timestamp) * 1000) : new Date()
    };
  }

  private async processAggregationRule(rule: MetricAggregation): Promise<void> {
    // Implementation of time-series aggregation logic
    const cacheKey = `agg_${rule.window}`;

    try {
      // Aggregate data according to rule
      const aggregated = await this.aggregateMetricsForWindow(rule.window, rule.functions);
      this.aggregationCache.set(cacheKey, aggregated, this.parseTimeWindow(rule.retention) / 1000);
    } catch (error) {
      this.logger.error(`Error processing aggregation rule for ${rule.window}`, error);
    }
  }

  private async aggregateMetricsForWindow(window: string, functions: string[]): Promise<any> {
    // Simplified aggregation logic
    return {
      window,
      functions,
      processed_at: new Date()
    };
  }

  private parseTimeWindow(window: string): number {
    const match = window.match(/^(\d+)([smhd])$/);
    if (!match) return 3600000; // Default 1 hour

    const [, amount, unit] = match;
    const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    return parseInt(amount) * multipliers[unit as keyof typeof multipliers];
  }

  private async calculateChartGenerationRate(start: Date, end: Date): Promise<number> {
    const count = await this.metricsRepository.count({
      where: {
        name: 'helm_chart_generation',
        timestamp: { gte: start, lte: end } as any
      }
    });

    const hours = (end.getTime() - start.getTime()) / 3600000;
    return count / hours;
  }

  private async calculateDeploymentSuccessRate(start?: Date, end?: Date): Promise<number> {
    if (!start || !end) {
      start = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      end = new Date();
    }

    const [total, successful] = await Promise.all([
      this.metricsRepository.count({
        where: {
          name: 'helm_deployment',
          timestamp: { gte: start, lte: end } as any
        }
      }),
      this.metricsRepository.count({
        where: {
          name: 'helm_deployment',
          timestamp: { gte: start, lte: end } as any,
          labels: { status: 'success' } as any
        }
      })
    ]);

    return total > 0 ? (successful / total) * 100 : 100;
  }

  private async calculateDeploymentFrequency(): Promise<number> {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const count = await this.metricsRepository.count({
      where: {
        name: 'helm_deployment',
        timestamp: { gte: yesterday } as any
      }
    });

    return count;
  }

  private async calculateMTTR(): Promise<number> {
    // Calculate mean time to recovery in minutes
    const rollbacks = await this.metricsRepository.find({
      where: {
        name: 'helm_deployment',
        labels: { operation: 'rollback' } as any
      },
      order: { timestamp: 'DESC' },
      take: 100
    });

    if (rollbacks.length === 0) return 0;

    const totalTime = rollbacks.reduce((sum, rollback) => sum + (rollback.value || 0), 0);
    return (totalTime / rollbacks.length) / 60; // Convert to minutes
  }

  private async calculateAverageResponseTime(start: Date, end: Date): Promise<number> {
    const responses = await this.metricsRepository.find({
      where: {
        name: 'app_http_request',
        timestamp: { gte: start, lte: end } as any
      }
    });

    if (responses.length === 0) return 0;

    const totalTime = responses.reduce((sum, response) => sum + (response.value || 0), 0);
    return totalTime / responses.length;
  }

  private async calculateErrorRate(start: Date, end: Date): Promise<number> {
    const [total, errors] = await Promise.all([
      this.metricsRepository.count({
        where: {
          name: 'app_http_request',
          timestamp: { gte: start, lte: end } as any
        }
      }),
      this.metricsRepository.count({
        where: {
          name: 'app_http_request',
          timestamp: { gte: start, lte: end } as any,
          labels: { status_code: '5%' } as any // Simplified pattern matching
        }
      })
    ]);

    return total > 0 ? (errors / total) * 100 : 0;
  }

  private startFederationSync(): void {
    this.logger.log('Started federation sync service');
  }
}