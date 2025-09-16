/**
 * Application Performance Monitoring Service
 * Task 4.2: Application Performance Monitoring Setup (Sprint 4)
 * 
 * Features:
 * - Response time analysis with percentile tracking
 * - Performance categorization and regression detection
 * - Error rate tracking and correlation analysis
 * - Resource utilization monitoring
 * - Throughput and concurrency analysis
 * - Automated alerting and optimization recommendations
 */

import * as api from '@opentelemetry/api';
import { logger } from '../config/logger';
import { getBusinessInstrumentation } from '../tracing/business-instrumentation';
import { config } from '../config/environment';
import * as os from 'os';
import * as process from 'process';

// Performance categories based on response times
export enum PerformanceCategory {
  FAST = 'fast',         // < 100ms
  NORMAL = 'normal',     // 100ms - 500ms
  SLOW = 'slow',         // 500ms - 2s
  CRITICAL = 'critical'  // > 2s
}

// Performance thresholds configuration
export interface PerformanceThresholds {
  fast: number;
  normal: number;
  slow: number;
  critical: number;
}

// Performance metrics data structure
export interface PerformanceMetrics {
  responseTime: {
    p50: number;
    p95: number;
    p99: number;
    avg: number;
    max: number;
    count: number;
  };
  errorRate: {
    total: number;
    rate: number;
    byType: Record<string, number>;
    byEndpoint: Record<string, number>;
  };
  throughput: {
    requestsPerSecond: number;
    transactionsPerMinute: number;
    concurrentRequests: number;
    queueDepth: number;
  };
  resources: {
    memoryUsage: {
      rss: number;
      heapUsed: number;
      heapTotal: number;
      external: number;
    };
    cpuUsage: {
      user: number;
      system: number;
      percentage: number;
    };
    gcStats: {
      totalCollections: number;
      totalDuration: number;
      avgDuration: number;
    };
  };
}

// Performance analysis result
export interface PerformanceAnalysis {
  status: 'healthy' | 'warning' | 'critical';
  metrics: PerformanceMetrics;
  recommendations: string[];
  regressions: PerformanceRegression[];
  alerts: PerformanceAlert[];
  trends: PerformanceTrend[];
}

// Performance regression detection
export interface PerformanceRegression {
  metric: string;
  endpoint: string;
  previousValue: number;
  currentValue: number;
  changePercent: number;
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  detectedAt: Date;
}

// Performance alert
export interface PerformanceAlert {
  type: 'error_spike' | 'latency_increase' | 'resource_exhaustion' | 'throughput_drop';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  metric: string;
  value: number;
  threshold: number;
  timestamp: Date;
}

// Performance trend analysis
export interface PerformanceTrend {
  metric: string;
  direction: 'improving' | 'degrading' | 'stable';
  changeRate: number;
  confidence: number;
  timeWindow: string;
}

// Configuration for performance monitoring
export interface ApplicationPerformanceConfig {
  enabled: boolean;
  thresholds: PerformanceThresholds;
  regressionDetection: {
    enabled: boolean;
    thresholdPercent: number;
    windowSizeMinutes: number;
  };
  alerting: {
    enabled: boolean;
    errorRateThreshold: number;
    latencyThreshold: number;
    resourceThreshold: number;
  };
  sampling: {
    rate: number;
    minSamples: number;
  };
}

/**
 * Application Performance Monitoring Service
 * Provides comprehensive performance monitoring with OTEL integration
 */
export class ApplicationPerformanceService {
  private meter: api.Meter;
  private tracer: api.Tracer;
  private businessInstrumentation;
  private config: ApplicationPerformanceConfig;
  
  // Performance metrics
  private responseTimeHistogram: api.Histogram;
  private performanceCategoryCounter: api.Counter;
  private errorRateCounter: api.Counter;
  private errorCorrelationGauge: api.Gauge;
  private resourceUsageGauge: api.Gauge;
  private throughputGauge: api.Gauge;
  private concurrencyGauge: api.Gauge;
  private queueDepthGauge: api.Gauge;
  private regressionCounter: api.Counter;
  
  // Performance tracking data
  private performanceData = new Map<string, number[]>();
  private errorData = new Map<string, { count: number; timestamp: number }[]>();
  private regressionBaselines = new Map<string, number>();
  private gcStats = { collections: 0, duration: 0 };
  private activeRequests = 0;
  private lastMetricsCollection = Date.now();

  constructor(config?: Partial<ApplicationPerformanceConfig>) {
    this.meter = api.metrics.getMeter('fortium-performance-monitoring', '1.0.0');
    this.tracer = api.trace.getTracer('fortium-performance-monitoring', '1.0.0');
    this.businessInstrumentation = getBusinessInstrumentation();
    
    this.config = {
      enabled: true,
      thresholds: {
        fast: 100,
        normal: 500,
        slow: 2000,
        critical: 5000,
      },
      regressionDetection: {
        enabled: true,
        thresholdPercent: 20, // 20% degradation triggers alert
        windowSizeMinutes: 15,
      },
      alerting: {
        enabled: true,
        errorRateThreshold: 0.05, // 5% error rate
        latencyThreshold: 2000,   // 2s latency
        resourceThreshold: 0.85,  // 85% resource usage
      },
      sampling: {
        rate: 1.0,
        minSamples: 10,
      },
      ...config,
    };

    this.initializeMetrics();
    this.startPerformanceCollection();
  }

  /**
   * Initialize OTEL metrics for performance monitoring
   */
  private initializeMetrics(): void {
    if (!this.config.enabled) return;

    // Response time histogram with percentile boundaries
    this.responseTimeHistogram = this.meter.createHistogram(
      'http_request_duration_histogram',
      {
        description: 'HTTP request duration in milliseconds with percentile analysis',
        boundaries: [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000],
      }
    );

    // Performance category counter
    this.performanceCategoryCounter = this.meter.createCounter(
      'performance_category_total',
      {
        description: 'Total requests by performance category (fast/normal/slow/critical)',
      }
    );

    // Error rate tracking
    this.errorRateCounter = this.meter.createCounter(
      'error_rate_by_type',
      {
        description: 'Error rate by error type and endpoint',
      }
    );

    // Error correlation metrics
    this.errorCorrelationGauge = this.meter.createGauge(
      'error_performance_correlation',
      {
        description: 'Correlation between error types and performance degradation',
      }
    );

    // Resource utilization gauges
    this.resourceUsageGauge = this.meter.createGauge(
      'nodejs_resource_usage',
      {
        description: 'Node.js resource usage (memory, CPU, GC)',
      }
    );

    // Throughput gauges
    this.throughputGauge = this.meter.createGauge(
      'application_throughput',
      {
        description: 'Application throughput (RPS, TPM)',
      }
    );

    // Concurrency gauges
    this.concurrencyGauge = this.meter.createGauge(
      'application_concurrency',
      {
        description: 'Application concurrency metrics (active connections, concurrent requests)',
      }
    );

    // Queue depth gauge
    this.queueDepthGauge = this.meter.createGauge(
      'application_queue_depth',
      {
        description: 'Application queue depths and processing backlogs',
      }
    );

    // Regression detection counter
    this.regressionCounter = this.meter.createCounter(
      'performance_regression_detected',
      {
        description: 'Performance regressions detected by metric type',
      }
    );
  }

  /**
   * Start automatic performance data collection
   */
  private startPerformanceCollection(): void {
    if (!this.config.enabled) return;

    // Collect resource metrics every 10 seconds
    setInterval(() => {
      this.collectResourceMetrics();
    }, 10000);

    // Collect garbage collection metrics
    if (process.versions && process.versions.node) {
      this.collectGCMetrics();
    }

    // Analyze performance every minute
    setInterval(() => {
      this.analyzePerformance().catch(error => {
        logger.error('Performance analysis failed', { error: error.message });
      });
    }, 60000);
  }

  /**
   * Track HTTP request performance
   */
  async trackRequestPerformance(
    endpoint: string,
    method: string,
    duration: number,
    statusCode: number,
    tenantId?: string
  ): Promise<void> {
    return this.businessInstrumentation.createBusinessSpan(
      'performance.track_request',
      'performance_monitoring',
      async (span: api.Span) => {
        const category = this.categorizePerformance(duration);
        const isError = statusCode >= 400;
        
        const labels = {
          endpoint,
          method,
          tenant_id: tenantId || 'unknown',
          category,
        };

        // Record response time histogram
        this.responseTimeHistogram.record(duration, labels);

        // Record performance category
        this.performanceCategoryCounter.add(1, labels);

        // Track error rates
        if (isError) {
          const errorType = this.categorizeError(statusCode);
          this.errorRateCounter.add(1, {
            ...labels,
            error_type: errorType,
          });

          // Store error data for correlation analysis
          const errorKey = `${endpoint}:${errorType}`;
          if (!this.errorData.has(errorKey)) {
            this.errorData.set(errorKey, []);
          }
          this.errorData.get(errorKey)!.push({
            count: 1,
            timestamp: Date.now(),
          });
        }

        // Store performance data for trend analysis
        const perfKey = `${endpoint}:response_time`;
        if (!this.performanceData.has(perfKey)) {
          this.performanceData.set(perfKey, []);
        }
        this.performanceData.get(perfKey)!.push(duration);

        // Detect regression in real-time
        if (this.config.regressionDetection.enabled) {
          await this.detectRegression(endpoint, duration);
        }

        span.setAttributes({
          'performance.category': category,
          'performance.duration_ms': duration,
          'performance.error': isError,
          'performance.endpoint': endpoint,
        });
      },
      { tenantId }
    );
  }

  /**
   * Track concurrent request count
   */
  incrementActiveRequests(): void {
    this.activeRequests++;
    this.concurrencyGauge.record(this.activeRequests, {
      metric: 'active_requests',
    });
  }

  /**
   * Decrement concurrent request count
   */
  decrementActiveRequests(): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
    this.concurrencyGauge.record(this.activeRequests, {
      metric: 'active_requests',
    });
  }

  /**
   * Track database connection pool metrics
   */
  trackDatabasePerformance(
    poolName: string,
    activeConnections: number,
    idleConnections: number,
    waitingRequests: number
  ): void {
    this.concurrencyGauge.record(activeConnections, {
      metric: 'db_connections_active',
      pool: poolName,
    });

    this.concurrencyGauge.record(idleConnections, {
      metric: 'db_connections_idle',
      pool: poolName,
    });

    this.queueDepthGauge.record(waitingRequests, {
      metric: 'db_connection_queue',
      pool: poolName,
    });
  }

  /**
   * Track cache performance metrics
   */
  trackCachePerformance(
    cacheType: string,
    hitRatio: number,
    totalOperations: number,
    avgResponseTime: number
  ): void {
    this.resourceUsageGauge.record(hitRatio, {
      metric: 'cache_hit_ratio',
      cache_type: cacheType,
    });

    this.throughputGauge.record(totalOperations, {
      metric: 'cache_operations_total',
      cache_type: cacheType,
    });

    this.responseTimeHistogram.record(avgResponseTime, {
      operation: 'cache_access',
      cache_type: cacheType,
    });
  }

  /**
   * Get comprehensive performance analysis
   */
  async getPerformanceAnalysis(): Promise<PerformanceAnalysis> {
    return this.businessInstrumentation.createBusinessSpan(
      'performance.get_analysis',
      'performance_monitoring',
      async (span: api.Span) => {
        const metrics = await this.collectCurrentMetrics();
        const regressions = await this.detectAllRegressions();
        const alerts = await this.generateAlerts(metrics);
        const trends = await this.analyzeTrends();
        const recommendations = this.generateRecommendations(metrics, regressions);

        const status = this.determineOverallStatus(metrics, regressions, alerts);

        span.setAttributes({
          'analysis.status': status,
          'analysis.regressions_count': regressions.length,
          'analysis.alerts_count': alerts.length,
          'analysis.recommendations_count': recommendations.length,
        });

        return {
          status,
          metrics,
          regressions,
          alerts,
          trends,
          recommendations,
        };
      }
    );
  }

  /**
   * Categorize performance based on response time
   */
  private categorizePerformance(duration: number): PerformanceCategory {
    if (duration < this.config.thresholds.fast) return PerformanceCategory.FAST;
    if (duration < this.config.thresholds.normal) return PerformanceCategory.NORMAL;
    if (duration < this.config.thresholds.slow) return PerformanceCategory.SLOW;
    return PerformanceCategory.CRITICAL;
  }

  /**
   * Categorize error based on status code
   */
  private categorizeError(statusCode: number): string {
    if (statusCode >= 500) return '5xx_server_errors';
    if (statusCode >= 400) return '4xx_client_errors';
    return 'unknown_errors';
  }

  /**
   * Collect current resource metrics
   */
  private collectResourceMetrics(): void {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const loadAvg = os.loadavg();

    // Memory metrics
    this.resourceUsageGauge.record(memUsage.rss, {
      metric: 'memory_rss_bytes',
    });
    this.resourceUsageGauge.record(memUsage.heapUsed, {
      metric: 'memory_heap_used_bytes',
    });
    this.resourceUsageGauge.record(memUsage.heapTotal, {
      metric: 'memory_heap_total_bytes',
    });
    this.resourceUsageGauge.record(memUsage.external, {
      metric: 'memory_external_bytes',
    });

    // CPU metrics
    this.resourceUsageGauge.record(cpuUsage.user / 1000000, {
      metric: 'cpu_user_seconds',
    });
    this.resourceUsageGauge.record(cpuUsage.system / 1000000, {
      metric: 'cpu_system_seconds',
    });

    // Load average
    this.resourceUsageGauge.record(loadAvg[0], {
      metric: 'load_average_1m',
    });
  }

  /**
   * Collect garbage collection metrics
   */
  private collectGCMetrics(): void {
    if (typeof (global as any).gc === 'function') {
      const gcBefore = process.hrtime.bigint();
      (global as any).gc();
      const gcAfter = process.hrtime.bigint();
      
      const duration = Number(gcAfter - gcBefore) / 1000000; // Convert to milliseconds
      this.gcStats.collections++;
      this.gcStats.duration += duration;

      this.resourceUsageGauge.record(this.gcStats.collections, {
        metric: 'gc_collections_total',
      });
      this.resourceUsageGauge.record(duration, {
        metric: 'gc_duration_ms',
      });
    }
  }

  /**
   * Detect performance regression for a specific endpoint
   */
  private async detectRegression(endpoint: string, currentValue: number): Promise<void> {
    const baselineKey = `${endpoint}:baseline`;
    const baseline = this.regressionBaselines.get(baselineKey);

    if (baseline) {
      const changePercent = ((currentValue - baseline) / baseline) * 100;
      
      if (changePercent > this.config.regressionDetection.thresholdPercent) {
        const regression: PerformanceRegression = {
          metric: 'response_time',
          endpoint,
          previousValue: baseline,
          currentValue,
          changePercent,
          threshold: this.config.regressionDetection.thresholdPercent,
          severity: this.calculateRegressionSeverity(changePercent),
          detectedAt: new Date(),
        };

        // Record regression metric
        this.regressionCounter.add(1, {
          endpoint,
          metric: 'response_time',
          severity: regression.severity,
        });

        logger.warn('Performance regression detected', {
          event: 'performance.regression.detected',
          regression,
        });
      }
    } else {
      // Set initial baseline
      this.regressionBaselines.set(baselineKey, currentValue);
    }
  }

  /**
   * Calculate regression severity
   */
  private calculateRegressionSeverity(changePercent: number): 'low' | 'medium' | 'high' | 'critical' {
    if (changePercent > 100) return 'critical';
    if (changePercent > 50) return 'high';
    if (changePercent > 25) return 'medium';
    return 'low';
  }

  /**
   * Collect current performance metrics
   */
  private async collectCurrentMetrics(): Promise<PerformanceMetrics> {
    const now = Date.now();
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // Calculate response time percentiles
    const allResponseTimes = Array.from(this.performanceData.values()).flat();
    const responseTime = this.calculatePercentiles(allResponseTimes);

    // Calculate error rates
    const errorRate = this.calculateErrorRates();

    // Calculate throughput
    const throughput = this.calculateThroughput();

    return {
      responseTime,
      errorRate,
      throughput,
      resources: {
        memoryUsage: {
          rss: memUsage.rss,
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal,
          external: memUsage.external,
        },
        cpuUsage: {
          user: cpuUsage.user,
          system: cpuUsage.system,
          percentage: 0, // TODO: Calculate actual CPU percentage
        },
        gcStats: {
          totalCollections: this.gcStats.collections,
          totalDuration: this.gcStats.duration,
          avgDuration: this.gcStats.collections > 0 ? 
            this.gcStats.duration / this.gcStats.collections : 0,
        },
      },
    };
  }

  /**
   * Calculate percentiles from array of values
   */
  private calculatePercentiles(values: number[]) {
    if (values.length === 0) {
      return { p50: 0, p95: 0, p99: 0, avg: 0, max: 0, count: 0 };
    }

    const sorted = values.sort((a, b) => a - b);
    const count = sorted.length;
    
    return {
      p50: sorted[Math.floor(count * 0.5)] || 0,
      p95: sorted[Math.floor(count * 0.95)] || 0,
      p99: sorted[Math.floor(count * 0.99)] || 0,
      avg: values.reduce((sum, val) => sum + val, 0) / count,
      max: Math.max(...values),
      count,
    };
  }

  /**
   * Calculate error rates
   */
  private calculateErrorRates() {
    const now = Date.now();
    const windowMs = 5 * 60 * 1000; // 5 minute window
    
    let totalErrors = 0;
    const byType: Record<string, number> = {};
    const byEndpoint: Record<string, number> = {};

    for (const [key, errors] of this.errorData.entries()) {
      const recentErrors = errors.filter(e => now - e.timestamp < windowMs);
      const errorCount = recentErrors.reduce((sum, e) => sum + e.count, 0);
      
      totalErrors += errorCount;
      
      const [endpoint, errorType] = key.split(':');
      byType[errorType] = (byType[errorType] || 0) + errorCount;
      byEndpoint[endpoint] = (byEndpoint[endpoint] || 0) + errorCount;
    }

    const totalRequests = Array.from(this.performanceData.values())
      .reduce((sum, data) => sum + data.length, 0);
    
    return {
      total: totalErrors,
      rate: totalRequests > 0 ? totalErrors / totalRequests : 0,
      byType,
      byEndpoint,
    };
  }

  /**
   * Calculate throughput metrics
   */
  private calculateThroughput() {
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window
    
    const recentRequests = Array.from(this.performanceData.values())
      .flat()
      .filter(time => now - time < windowMs)
      .length;

    return {
      requestsPerSecond: recentRequests / 60,
      transactionsPerMinute: recentRequests,
      concurrentRequests: this.activeRequests,
      queueDepth: 0, // TODO: Implement queue depth tracking
    };
  }

  /**
   * Detect all performance regressions
   */
  private async detectAllRegressions(): Promise<PerformanceRegression[]> {
    const regressions: PerformanceRegression[] = [];
    // TODO: Implement comprehensive regression detection
    return regressions;
  }

  /**
   * Generate performance alerts
   */
  private async generateAlerts(metrics: PerformanceMetrics): Promise<PerformanceAlert[]> {
    const alerts: PerformanceAlert[] = [];
    
    // Error rate alert
    if (metrics.errorRate.rate > this.config.alerting.errorRateThreshold) {
      alerts.push({
        type: 'error_spike',
        severity: 'high',
        message: `Error rate ${(metrics.errorRate.rate * 100).toFixed(2)}% exceeds threshold`,
        metric: 'error_rate',
        value: metrics.errorRate.rate,
        threshold: this.config.alerting.errorRateThreshold,
        timestamp: new Date(),
      });
    }

    // Latency alert
    if (metrics.responseTime.p95 > this.config.alerting.latencyThreshold) {
      alerts.push({
        type: 'latency_increase',
        severity: 'medium',
        message: `P95 latency ${metrics.responseTime.p95}ms exceeds threshold`,
        metric: 'latency_p95',
        value: metrics.responseTime.p95,
        threshold: this.config.alerting.latencyThreshold,
        timestamp: new Date(),
      });
    }

    return alerts;
  }

  /**
   * Analyze performance trends
   */
  private async analyzeTrends(): Promise<PerformanceTrend[]> {
    const trends: PerformanceTrend[] = [];
    // TODO: Implement trend analysis
    return trends;
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(
    metrics: PerformanceMetrics,
    regressions: PerformanceRegression[]
  ): string[] {
    const recommendations: string[] = [];

    if (metrics.errorRate.rate > 0.01) {
      recommendations.push('High error rate detected - investigate error patterns and root causes');
    }

    if (metrics.responseTime.p95 > this.config.thresholds.slow) {
      recommendations.push('High P95 latency detected - consider performance optimization');
    }

    if (metrics.resources.memoryUsage.heapUsed / metrics.resources.memoryUsage.heapTotal > 0.8) {
      recommendations.push('High memory usage detected - monitor for memory leaks');
    }

    if (regressions.length > 0) {
      recommendations.push(`${regressions.length} performance regression(s) detected - review recent deployments`);
    }

    return recommendations;
  }

  /**
   * Determine overall performance status
   */
  private determineOverallStatus(
    metrics: PerformanceMetrics,
    regressions: PerformanceRegression[],
    alerts: PerformanceAlert[]
  ): 'healthy' | 'warning' | 'critical' {
    const criticalAlerts = alerts.filter(a => a.severity === 'critical');
    const criticalRegressions = regressions.filter(r => r.severity === 'critical');

    if (criticalAlerts.length > 0 || criticalRegressions.length > 0) {
      return 'critical';
    }

    if (alerts.length > 0 || regressions.length > 0 || 
        metrics.errorRate.rate > this.config.alerting.errorRateThreshold * 0.5) {
      return 'warning';
    }

    return 'healthy';
  }

  /**
   * Run complete performance analysis
   */
  private async analyzePerformance(): Promise<void> {
    try {
      const analysis = await this.getPerformanceAnalysis();
      
      logger.info('Performance analysis completed', {
        event: 'performance.analysis.completed',
        status: analysis.status,
        metricsCount: analysis.metrics.responseTime.count,
        alertsCount: analysis.alerts.length,
        regressionsCount: analysis.regressions.length,
      });

      // Log critical issues
      if (analysis.status === 'critical') {
        logger.error('Critical performance issues detected', {
          event: 'performance.analysis.critical',
          analysis: {
            alerts: analysis.alerts.filter(a => a.severity === 'critical'),
            regressions: analysis.regressions.filter(r => r.severity === 'critical'),
          },
        });
      }
    } catch (error) {
      logger.error('Performance analysis failed', {
        event: 'performance.analysis.failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

// Global service instance
let globalPerformanceService: ApplicationPerformanceService | null = null;

/**
 * Get global application performance service instance
 */
export function getApplicationPerformanceService(
  config?: Partial<ApplicationPerformanceConfig>
): ApplicationPerformanceService {
  if (!globalPerformanceService) {
    globalPerformanceService = new ApplicationPerformanceService(config);
  }
  return globalPerformanceService;
}

/**
 * Express middleware to track request performance
 */
export function performanceTrackingMiddleware() {
  const perfService = getApplicationPerformanceService();
  
  return (req: any, res: any, next: any) => {
    const startTime = Date.now();
    
    // Track active request
    perfService.incrementActiveRequests();
    
    // Override end method to capture metrics
    const originalEnd = res.end;
    res.end = function (...args: any[]) {
      const duration = Date.now() - startTime;
      const endpoint = req.route?.path || req.path || 'unknown';
      const method = req.method || 'unknown';
      const statusCode = res.statusCode || 500;
      const tenantId = req.tenant?.id;
      
      // Track performance metrics
      perfService.trackRequestPerformance(
        endpoint,
        method,
        duration,
        statusCode,
        tenantId
      ).catch(error => {
        logger.warn('Failed to track request performance', { error: error.message });
      });
      
      // Decrement active requests
      perfService.decrementActiveRequests();
      
      // Call original end method
      originalEnd.apply(res, args);
    };
    
    next();
  };
}