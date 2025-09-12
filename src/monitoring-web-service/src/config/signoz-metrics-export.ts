/**
 * SignOz Metrics Export Configuration
 * Task 4.1: Business Metrics Integration (Sprint 4)
 * 
 * Comprehensive configuration for exporting business metrics to SignOz:
 * - OTLP metrics exporter setup
 * - Metrics aggregation and collection intervals
 * - Batching for performance optimization
 * - Health monitoring and validation
 */

import { Resource } from '@opentelemetry/resources';
import { MeterProvider, PeriodicExportingMetricReader, ConsoleMetricExporter } from '@opentelemetry/sdk-metrics';
import { OTLPMetricExporter } from '@opentelemetry/exporter-otlp-http';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { config } from './environment';
import { logger } from './logger';
import * as api from '@opentelemetry/api';

/**
 * SignOz Export Configuration Interface
 */
export interface SignOzExportConfig {
  enabled: boolean;
  endpoint: string;
  headers?: Record<string, string>;
  timeout: number;
  exportInterval: number;
  maxExportBatchSize: number;
  maxQueueSize: number;
  compression: 'gzip' | 'none';
  temporalityPreference: 'delta' | 'cumulative';
  enableConsoleExport: boolean;
  enablePrometheusExport: boolean;
  prometheusPort: number;
  resourceAttributes: Record<string, string>;
}

/**
 * Metrics Export Health Status
 */
export interface ExportHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastExport: Date | null;
  totalExports: number;
  failedExports: number;
  queueSize: number;
  configuration: {
    endpoint: string;
    interval: number;
    batchSize: number;
    compression: string;
  };
  performance: {
    avgExportDuration: number;
    minExportDuration: number;
    maxExportDuration: number;
    successRate: number;
  };
}

/**
 * Export Performance Metrics Tracker
 */
class ExportPerformanceTracker {
  private exportTimes: number[] = [];
  private exportResults: boolean[] = [];
  private lastExport: Date | null = null;
  private readonly maxHistory = 100;

  recordExport(duration: number, success: boolean): void {
    this.exportTimes.push(duration);
    this.exportResults.push(success);
    this.lastExport = new Date();

    // Keep only recent history
    if (this.exportTimes.length > this.maxHistory) {
      this.exportTimes.shift();
      this.exportResults.shift();
    }
  }

  getMetrics(): ExportHealthStatus['performance'] {
    if (this.exportTimes.length === 0) {
      return {
        avgExportDuration: 0,
        minExportDuration: 0,
        maxExportDuration: 0,
        successRate: 1.0,
      };
    }

    const successfulExports = this.exportResults.filter(result => result).length;
    
    return {
      avgExportDuration: this.exportTimes.reduce((a, b) => a + b, 0) / this.exportTimes.length,
      minExportDuration: Math.min(...this.exportTimes),
      maxExportDuration: Math.max(...this.exportTimes),
      successRate: successfulExports / this.exportResults.length,
    };
  }

  getLastExport(): Date | null {
    return this.lastExport;
  }

  getTotalExports(): number {
    return this.exportResults.length;
  }

  getFailedExports(): number {
    return this.exportResults.filter(result => !result).length;
  }
}

/**
 * SignOz Metrics Export Manager
 */
export class SignOzMetricsExportManager {
  private config: SignOzExportConfig;
  private meterProvider: MeterProvider | null = null;
  private otlpExporter: OTLPMetricExporter | null = null;
  private prometheusExporter: PrometheusExporter | null = null;
  private performanceTracker = new ExportPerformanceTracker();
  private queueSize = 0;
  private isInitialized = false;

  constructor(config?: Partial<SignOzExportConfig>) {
    this.config = this.createConfiguration(config);
    logger.info('SignOz Metrics Export Manager initialized', {
      event: 'signoz_metrics_export.manager.initialized',
      config: {
        enabled: this.config.enabled,
        endpoint: this.config.endpoint,
        exportInterval: this.config.exportInterval,
        batchSize: this.config.maxExportBatchSize,
      },
    });
  }

  /**
   * Initialize the metrics export system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('SignOz Metrics Export Manager already initialized');
      return;
    }

    if (!this.config.enabled) {
      logger.info('SignOz metrics export is disabled');
      return;
    }

    try {
      // Create resource with proper attributes
      const resource = this.createResource();
      
      // Create metrics exporters
      const metricReaders = await this.createMetricReaders();
      
      // Create meter provider with all readers
      this.meterProvider = new MeterProvider({
        resource,
        readers: metricReaders,
      });

      // Register as global meter provider
      api.metrics.setGlobalMeterProvider(this.meterProvider);

      this.isInitialized = true;

      logger.info('SignOz Metrics Export initialized successfully', {
        event: 'signoz_metrics_export.initialized',
        readersCount: metricReaders.length,
        resource: resource.attributes,
      });

    } catch (error) {
      logger.error('Failed to initialize SignOz metrics export', {
        event: 'signoz_metrics_export.initialization.failed',
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Create metric readers for different export targets
   */
  private async createMetricReaders(): Promise<any[]> {
    const readers: any[] = [];

    // OTLP Exporter for SignOz
    if (this.config.enabled) {
      this.otlpExporter = new OTLPMetricExporter({
        url: this.config.endpoint,
        headers: this.config.headers,
        timeoutMillis: this.config.timeout,
        compression: this.config.compression,
        temporalityPreference: this.config.temporalityPreference,
      });

      // Wrap exporter to track performance
      const wrappedExporter = this.wrapExporterWithTracking(this.otlpExporter);

      const periodicReader = new PeriodicExportingMetricReader({
        exporter: wrappedExporter,
        exportIntervalMillis: this.config.exportInterval,
        exportTimeoutMillis: this.config.timeout,
      });

      readers.push(periodicReader);

      logger.info('OTLP metrics exporter configured', {
        event: 'signoz_metrics_export.otlp.configured',
        endpoint: this.config.endpoint,
        interval: this.config.exportInterval,
      });
    }

    // Console exporter for debugging
    if (this.config.enableConsoleExport && (config.isDevelopment || config.isTest)) {
      const consoleReader = new PeriodicExportingMetricReader({
        exporter: new ConsoleMetricExporter(),
        exportIntervalMillis: this.config.exportInterval * 2, // Less frequent console output
        exportTimeoutMillis: 5000,
      });

      readers.push(consoleReader);

      logger.debug('Console metrics exporter configured', {
        event: 'signoz_metrics_export.console.configured',
      });
    }

    // Prometheus exporter for additional monitoring
    if (this.config.enablePrometheusExport) {
      try {
        this.prometheusExporter = new PrometheusExporter({
          port: this.config.prometheusPort,
          endpoint: '/metrics',
        });

        // Prometheus exporter doesn't use periodic reader
        // It serves metrics on HTTP endpoint
        logger.info('Prometheus metrics exporter configured', {
          event: 'signoz_metrics_export.prometheus.configured',
          port: this.config.prometheusPort,
          endpoint: '/metrics',
        });
      } catch (error) {
        logger.warn('Failed to configure Prometheus exporter', {
          event: 'signoz_metrics_export.prometheus.failed',
          error: error.message,
          port: this.config.prometheusPort,
        });
      }
    }

    return readers;
  }

  /**
   * Wrap exporter to track performance metrics
   */
  private wrapExporterWithTracking(exporter: any): any {
    const originalExport = exporter.export.bind(exporter);
    const self = this;

    exporter.export = function(metrics: any, resultCallback: any) {
      const startTime = Date.now();
      self.queueSize = metrics.length;

      originalExport(metrics, (result: any) => {
        const duration = Date.now() - startTime;
        const success = result.code === 0; // ExportResultCode.SUCCESS

        self.performanceTracker.recordExport(duration, success);
        self.queueSize = 0;

        if (!success) {
          logger.error('SignOz metrics export failed', {
            event: 'signoz_metrics_export.failed',
            error: result.error,
            duration,
            metricsCount: metrics.length,
          });
        } else {
          logger.debug('SignOz metrics exported successfully', {
            event: 'signoz_metrics_export.success',
            duration,
            metricsCount: metrics.length,
          });
        }

        resultCallback(result);
      });
    };

    return exporter;
  }

  /**
   * Create resource with comprehensive attributes
   */
  private createResource(): Resource {
    const resourceAttributes = {
      [SemanticResourceAttributes.SERVICE_NAME]: config.otel.service.name || 'fortium-monitoring-service',
      [SemanticResourceAttributes.SERVICE_VERSION]: config.otel.service.version || '1.0.0',
      [SemanticResourceAttributes.SERVICE_NAMESPACE]: config.otel.service.namespace || 'fortium',
      [SemanticResourceAttributes.SERVICE_INSTANCE_ID]: `${process.pid}-${Date.now()}`,
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: config.nodeEnv,
      
      // Custom business attributes
      'business.metrics.version': '4.1.0',
      'business.metrics.source': 'business-metrics-service',
      'business.export.target': 'signoz',
      'business.export.interval': this.config.exportInterval.toString(),
      'business.export.batch_size': this.config.maxExportBatchSize.toString(),
      
      // Additional resource attributes
      ...this.config.resourceAttributes,
    };

    return new Resource(resourceAttributes);
  }

  /**
   * Create default configuration
   */
  private createConfiguration(overrides?: Partial<SignOzExportConfig>): SignOzExportConfig {
    const defaultConfig: SignOzExportConfig = {
      enabled: config.otel.enabled && config.otel.metrics.enabled,
      endpoint: config.otel.exporter.metricsEndpoint || 'http://localhost:4318/v1/metrics',
      headers: {},
      timeout: 10000, // 10 seconds
      exportInterval: 30000, // 30 seconds
      maxExportBatchSize: 512,
      maxQueueSize: 2048,
      compression: 'gzip',
      temporalityPreference: 'delta',
      enableConsoleExport: config.isDevelopment,
      enablePrometheusExport: config.otel.prometheus.enabled || false,
      prometheusPort: config.otel.prometheus.port || 9464,
      resourceAttributes: {},
    };

    // Apply environment variable overrides
    if (process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT) {
      defaultConfig.endpoint = process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT;
    }
    if (process.env.OTEL_METRIC_EXPORT_INTERVAL) {
      defaultConfig.exportInterval = parseInt(process.env.OTEL_METRIC_EXPORT_INTERVAL, 10);
    }
    if (process.env.OTEL_METRIC_EXPORT_TIMEOUT) {
      defaultConfig.timeout = parseInt(process.env.OTEL_METRIC_EXPORT_TIMEOUT, 10);
    }
    if (process.env.ENABLE_PROMETHEUS === 'true') {
      defaultConfig.enablePrometheusExport = true;
    }
    if (process.env.PROMETHEUS_METRICS_PORT) {
      defaultConfig.prometheusPort = parseInt(process.env.PROMETHEUS_METRICS_PORT, 10);
    }

    return { ...defaultConfig, ...overrides };
  }

  /**
   * Get current export health status
   */
  getHealthStatus(): ExportHealthStatus {
    const performance = this.performanceTracker.getMetrics();
    const lastExport = this.performanceTracker.getLastExport();
    const totalExports = this.performanceTracker.getTotalExports();
    const failedExports = this.performanceTracker.getFailedExports();

    // Determine health status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (!this.config.enabled || !this.isInitialized) {
      status = 'unhealthy';
    } else if (performance.successRate < 0.9 || performance.avgExportDuration > 5000) {
      status = 'degraded';
    } else if (performance.successRate < 0.5 || performance.avgExportDuration > 10000) {
      status = 'unhealthy';
    }

    return {
      status,
      lastExport,
      totalExports,
      failedExports,
      queueSize: this.queueSize,
      configuration: {
        endpoint: this.config.endpoint,
        interval: this.config.exportInterval,
        batchSize: this.config.maxExportBatchSize,
        compression: this.config.compression,
      },
      performance,
    };
  }

  /**
   * Force immediate export (for testing/debugging)
   */
  async forceExport(): Promise<void> {
    if (!this.meterProvider) {
      throw new Error('Metrics export not initialized');
    }

    try {
      // Force flush all metric readers
      await this.meterProvider.forceFlush();
      
      logger.info('Forced metrics export completed', {
        event: 'signoz_metrics_export.force_export.completed',
      });
    } catch (error) {
      logger.error('Force export failed', {
        event: 'signoz_metrics_export.force_export.failed',
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Shutdown the export manager
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      if (this.meterProvider) {
        await this.meterProvider.shutdown();
      }

      if (this.prometheusExporter) {
        this.prometheusExporter.shutdown();
      }

      this.isInitialized = false;

      logger.info('SignOz Metrics Export Manager shutdown completed', {
        event: 'signoz_metrics_export.shutdown.completed',
      });
    } catch (error) {
      logger.error('Error during SignOz metrics export shutdown', {
        event: 'signoz_metrics_export.shutdown.error',
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update configuration at runtime
   */
  updateConfiguration(updates: Partial<SignOzExportConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...updates };

    logger.info('SignOz metrics export configuration updated', {
      event: 'signoz_metrics_export.config.updated',
      changes: {
        old: oldConfig,
        new: updates,
      },
    });

    // Note: Some configuration changes require reinitialization
    // This could be implemented if needed for production scenarios
  }

  /**
   * Get current configuration
   */
  getConfiguration(): SignOzExportConfig {
    return { ...this.config };
  }

  /**
   * Check connectivity to SignOz endpoint
   */
  async validateConnectivity(): Promise<{
    success: boolean;
    responseTime: number;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      const response = await fetch(this.config.endpoint, {
        method: 'HEAD',
        timeout: this.config.timeout,
      });

      const responseTime = Date.now() - startTime;

      return {
        success: response.ok,
        responseTime,
        error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        success: false,
        responseTime,
        error: error.message,
      };
    }
  }
}

// Global export manager instance
let globalExportManager: SignOzMetricsExportManager | null = null;

/**
 * Get or create global SignOz metrics export manager
 */
export function getSignOzMetricsExportManager(config?: Partial<SignOzExportConfig>): SignOzMetricsExportManager {
  if (!globalExportManager) {
    globalExportManager = new SignOzMetricsExportManager(config);
  }
  return globalExportManager;
}

/**
 * Initialize SignOz metrics export with error handling
 */
export async function initializeSignOzMetricsExport(config?: Partial<SignOzExportConfig>): Promise<SignOzMetricsExportManager> {
  try {
    const manager = getSignOzMetricsExportManager(config);
    await manager.initialize();
    return manager;
  } catch (error) {
    logger.error('Failed to initialize SignOz metrics export', {
      event: 'signoz_metrics_export.init.failed',
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Shutdown SignOz metrics export
 */
export async function shutdownSignOzMetricsExport(): Promise<void> {
  if (globalExportManager) {
    await globalExportManager.shutdown();
    globalExportManager = null;
  }
}