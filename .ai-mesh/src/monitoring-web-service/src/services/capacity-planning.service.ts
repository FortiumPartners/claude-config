/**
 * Capacity Planning Service
 * Task 4.2: Application Performance Monitoring Setup - Capacity Planning Component
 * 
 * Features:
 * - Growth trend analysis and forecasting
 * - Resource utilization prediction
 * - Capacity threshold monitoring
 * - Queue depth and backlog analysis
 * - Performance baseline comparison
 * - Scale-out recommendations
 */

import * as api from '@opentelemetry/api';
import { logger } from '../config/logger';
import { getBusinessInstrumentation } from '../tracing/business-instrumentation';

// Capacity planning metrics
export interface CapacityMetrics {
  current: {
    requestsPerSecond: number;
    concurrentUsers: number;
    memoryUsage: number;
    cpuUsage: number;
    diskUsage: number;
    networkThroughput: number;
  };
  trends: {
    growth: {
      daily: number;
      weekly: number;
      monthly: number;
    };
    seasonal: {
      pattern: 'none' | 'daily' | 'weekly' | 'monthly';
      peakMultiplier: number;
    };
  };
  forecasts: {
    next30Days: CapacityForecast;
    next90Days: CapacityForecast;
    next365Days: CapacityForecast;
  };
  thresholds: {
    warning: CapacityThresholds;
    critical: CapacityThresholds;
  };
}

// Capacity forecast data
export interface CapacityForecast {
  expectedLoad: {
    requestsPerSecond: number;
    concurrentUsers: number;
    dataVolume: number;
  };
  resourceRequirements: {
    cpu: number;
    memory: number;
    storage: number;
    network: number;
  };
  recommendations: CapacityRecommendation[];
}

// Capacity thresholds
export interface CapacityThresholds {
  cpu: number;
  memory: number;
  storage: number;
  network: number;
  queueDepth: number;
  responseTime: number;
}

// Capacity planning recommendations
export interface CapacityRecommendation {
  type: 'scale_up' | 'scale_out' | 'optimize' | 'alert';
  priority: 'low' | 'medium' | 'high' | 'critical';
  resource: string;
  currentValue: number;
  projectedValue: number;
  threshold: number;
  timeToThreshold: number; // Days
  action: string;
  impact: {
    cost: 'low' | 'medium' | 'high';
    complexity: 'low' | 'medium' | 'high';
    risk: 'low' | 'medium' | 'high';
  };
}

// Queue depth analysis
export interface QueueAnalysis {
  queues: {
    name: string;
    currentDepth: number;
    averageDepth: number;
    maxDepth: number;
    processingRate: number;
    avgProcessingTime: number;
    backlogDuration: number;
  }[];
  summary: {
    totalBacklog: number;
    criticalQueues: number;
    averageWaitTime: number;
    recommendations: string[];
  };
}

// Growth pattern analysis
export interface GrowthPattern {
  metric: string;
  pattern: 'linear' | 'exponential' | 'seasonal' | 'irregular';
  growthRate: number;
  confidence: number;
  r2Score: number;
  predictions: {
    nextWeek: number;
    nextMonth: number;
    nextQuarter: number;
  };
}

// Configuration for capacity planning
export interface CapacityPlanningConfig {
  enabled: boolean;
  analysisInterval: number; // minutes
  forecastHorizon: number; // days
  dataRetention: number; // days
  thresholds: {
    cpu: number;
    memory: number;
    storage: number;
    network: number;
    queueDepth: number;
    responseTime: number;
  };
  alerting: {
    enabled: boolean;
    leadTime: number; // days before threshold
    recipients: string[];
  };
}

/**
 * Capacity Planning Service
 * Analyzes system capacity and provides growth forecasting
 */
export class CapacityPlanningService {
  private meter: api.Meter;
  private tracer: api.Tracer;
  private businessInstrumentation;
  private config: CapacityPlanningConfig;
  
  // Metrics storage
  private capacityGauge: api.Gauge;
  private forecastGauge: api.Gauge;
  private queueDepthGauge: api.Gauge;
  private growthRateGauge: api.Gauge;
  private thresholdCounter: api.Counter;
  
  // Historical data storage
  private metricsHistory = new Map<string, { timestamp: number; value: number }[]>();
  private queueMetrics = new Map<string, { depth: number; processed: number; timestamp: number }[]>();
  private lastAnalysis = Date.now();

  constructor(config?: Partial<CapacityPlanningConfig>) {
    this.meter = api.metrics.getMeter('fortium-capacity-planning', '1.0.0');
    this.tracer = api.trace.getTracer('fortium-capacity-planning', '1.0.0');
    this.businessInstrumentation = getBusinessInstrumentation();
    
    this.config = {
      enabled: true,
      analysisInterval: 15, // 15 minutes
      forecastHorizon: 90, // 90 days
      dataRetention: 365, // 1 year
      thresholds: {
        cpu: 80, // 80% CPU usage
        memory: 85, // 85% memory usage
        storage: 90, // 90% storage usage
        network: 80, // 80% network usage
        queueDepth: 1000, // 1000 items in queue
        responseTime: 2000, // 2s response time
      },
      alerting: {
        enabled: true,
        leadTime: 7, // 7 days
        recipients: [],
      },
      ...config,
    };

    this.initializeMetrics();
    this.startCapacityAnalysis();
  }

  /**
   * Initialize OTEL metrics for capacity planning
   */
  private initializeMetrics(): void {
    if (!this.config.enabled) return;

    this.capacityGauge = this.meter.createGauge(
      'capacity_utilization',
      {
        description: 'Current capacity utilization across resources',
      }
    );

    this.forecastGauge = this.meter.createGauge(
      'capacity_forecast',
      {
        description: 'Forecasted capacity requirements',
      }
    );

    this.queueDepthGauge = this.meter.createGauge(
      'queue_depth_analysis',
      {
        description: 'Queue depth and processing metrics',
      }
    );

    this.growthRateGauge = this.meter.createGauge(
      'growth_rate',
      {
        description: 'Growth rate analysis for various metrics',
      }
    );

    this.thresholdCounter = this.meter.createCounter(
      'capacity_threshold_violations',
      {
        description: 'Capacity threshold violations detected',
      }
    );
  }

  /**
   * Start automatic capacity analysis
   */
  private startCapacityAnalysis(): void {
    if (!this.config.enabled) return;

    // Run capacity analysis at configured interval
    setInterval(() => {
      this.runCapacityAnalysis().catch(error => {
        logger.error('Capacity analysis failed', { error: error.message });
      });
    }, this.config.analysisInterval * 60 * 1000);
  }

  /**
   * Record capacity metric
   */
  recordCapacityMetric(
    resource: string,
    value: number,
    maxValue?: number
  ): void {
    const timestamp = Date.now();
    const metricKey = `capacity:${resource}`;
    
    // Store historical data
    if (!this.metricsHistory.has(metricKey)) {
      this.metricsHistory.set(metricKey, []);
    }
    
    const history = this.metricsHistory.get(metricKey)!;
    history.push({ timestamp, value });
    
    // Keep only data within retention period
    const retentionMs = this.config.dataRetention * 24 * 60 * 60 * 1000;
    const cutoff = timestamp - retentionMs;
    this.metricsHistory.set(metricKey, 
      history.filter(h => h.timestamp >= cutoff)
    );
    
    // Record OTEL metric
    const utilization = maxValue ? (value / maxValue) * 100 : value;
    this.capacityGauge.record(utilization, {
      resource,
      metric: 'utilization',
    });
    
    // Check thresholds
    this.checkThresholds(resource, utilization);
  }

  /**
   * Record queue metrics
   */
  recordQueueMetrics(
    queueName: string,
    depth: number,
    processed: number
  ): void {
    const timestamp = Date.now();
    const queueKey = `queue:${queueName}`;
    
    if (!this.queueMetrics.has(queueKey)) {
      this.queueMetrics.set(queueKey, []);
    }
    
    const history = this.queueMetrics.get(queueKey)!;
    history.push({ depth, processed, timestamp });
    
    // Keep only recent data for analysis
    const oneHour = 60 * 60 * 1000;
    const cutoff = timestamp - oneHour;
    this.queueMetrics.set(queueKey,
      history.filter(h => h.timestamp >= cutoff)
    );
    
    // Record OTEL metrics
    this.queueDepthGauge.record(depth, {
      queue: queueName,
      metric: 'depth',
    });
    
    this.queueDepthGauge.record(processed, {
      queue: queueName,
      metric: 'processed',
    });
    
    // Check queue depth threshold
    if (depth > this.config.thresholds.queueDepth) {
      this.thresholdCounter.add(1, {
        resource: 'queue',
        queue: queueName,
        threshold_type: 'queue_depth',
      });
    }
  }

  /**
   * Get comprehensive capacity analysis
   */
  async getCapacityAnalysis(): Promise<CapacityMetrics> {
    return this.businessInstrumentation.createBusinessSpan(
      'capacity.get_analysis',
      'capacity_planning',
      async (span: api.Span) => {
        const currentMetrics = this.getCurrentCapacityMetrics();
        const trends = this.analyzeTrends();
        const forecasts = this.generateForecasts(trends);
        
        span.setAttributes({
          'capacity.analysis.current_cpu': currentMetrics.cpuUsage,
          'capacity.analysis.current_memory': currentMetrics.memoryUsage,
          'capacity.analysis.growth_rate': trends.growth.daily,
        });
        
        return {
          current: currentMetrics,
          trends,
          forecasts,
          thresholds: {
            warning: {
              cpu: this.config.thresholds.cpu * 0.8,
              memory: this.config.thresholds.memory * 0.8,
              storage: this.config.thresholds.storage * 0.8,
              network: this.config.thresholds.network * 0.8,
              queueDepth: this.config.thresholds.queueDepth * 0.8,
              responseTime: this.config.thresholds.responseTime * 0.8,
            },
            critical: this.config.thresholds,
          },
        };
      }
    );
  }

  /**
   * Analyze queue depths and backlogs
   */
  async analyzeQueues(): Promise<QueueAnalysis> {
    return this.businessInstrumentation.createBusinessSpan(
      'capacity.analyze_queues',
      'capacity_planning',
      async (span: api.Span) => {
        const queues = [];
        let totalBacklog = 0;
        let criticalQueues = 0;
        let totalWaitTime = 0;
        
        for (const [queueKey, history] of this.queueMetrics.entries()) {
          const queueName = queueKey.replace('queue:', '');
          const recentData = history.slice(-10); // Last 10 data points
          
          if (recentData.length === 0) continue;
          
          const currentDepth = recentData[recentData.length - 1].depth;
          const averageDepth = recentData.reduce((sum, d) => sum + d.depth, 0) / recentData.length;
          const maxDepth = Math.max(...recentData.map(d => d.depth));
          const totalProcessed = recentData.reduce((sum, d) => sum + d.processed, 0);
          const processingRate = totalProcessed / recentData.length;
          const avgProcessingTime = processingRate > 0 ? currentDepth / processingRate : 0;
          const backlogDuration = avgProcessingTime * 60; // Convert to minutes
          
          queues.push({
            name: queueName,
            currentDepth,
            averageDepth,
            maxDepth,
            processingRate,
            avgProcessingTime,
            backlogDuration,
          });
          
          totalBacklog += currentDepth;
          totalWaitTime += backlogDuration;
          
          if (currentDepth > this.config.thresholds.queueDepth) {
            criticalQueues++;
          }
        }
        
        const averageWaitTime = queues.length > 0 ? totalWaitTime / queues.length : 0;
        
        const recommendations = this.generateQueueRecommendations(queues);
        
        span.setAttributes({
          'capacity.queues.total_count': queues.length,
          'capacity.queues.critical_count': criticalQueues,
          'capacity.queues.total_backlog': totalBacklog,
          'capacity.queues.avg_wait_time': averageWaitTime,
        });
        
        return {
          queues,
          summary: {
            totalBacklog,
            criticalQueues,
            averageWaitTime,
            recommendations,
          },
        };
      }
    );
  }

  /**
   * Analyze growth patterns for specific metric
   */
  async analyzeGrowthPattern(metric: string): Promise<GrowthPattern> {
    return this.businessInstrumentation.createBusinessSpan(
      'capacity.analyze_growth_pattern',
      'capacity_planning',
      async (span: api.Span) => {
        const history = this.metricsHistory.get(`capacity:${metric}`) || [];
        
        if (history.length < 10) {
          return {
            metric,
            pattern: 'irregular',
            growthRate: 0,
            confidence: 0,
            r2Score: 0,
            predictions: {
              nextWeek: 0,
              nextMonth: 0,
              nextQuarter: 0,
            },
          };
        }
        
        // Simple linear regression for growth rate
        const values = history.map(h => h.value);
        const timestamps = history.map(h => h.timestamp);
        
        const { slope, r2 } = this.linearRegression(timestamps, values);
        const growthRate = slope; // Growth per millisecond
        const dailyGrowthRate = growthRate * 24 * 60 * 60 * 1000; // Per day
        
        // Determine pattern type
        const pattern = this.determinePattern(values);
        const confidence = Math.min(r2 * 100, 100);
        
        // Generate predictions
        const lastValue = values[values.length - 1];
        const lastTimestamp = timestamps[timestamps.length - 1];
        
        const oneWeek = 7 * 24 * 60 * 60 * 1000;
        const oneMonth = 30 * 24 * 60 * 60 * 1000;
        const oneQuarter = 90 * 24 * 60 * 60 * 1000;
        
        const predictions = {
          nextWeek: Math.max(0, lastValue + (slope * oneWeek)),
          nextMonth: Math.max(0, lastValue + (slope * oneMonth)),
          nextQuarter: Math.max(0, lastValue + (slope * oneQuarter)),
        };
        
        span.setAttributes({
          'capacity.growth.metric': metric,
          'capacity.growth.pattern': pattern,
          'capacity.growth.rate_daily': dailyGrowthRate,
          'capacity.growth.confidence': confidence,
        });
        
        return {
          metric,
          pattern,
          growthRate: dailyGrowthRate,
          confidence,
          r2Score: r2,
          predictions,
        };
      }
    );
  }

  /**
   * Generate capacity recommendations
   */
  async generateRecommendations(): Promise<CapacityRecommendation[]> {
    const recommendations: CapacityRecommendation[] = [];
    const analysis = await this.getCapacityAnalysis();
    
    // CPU recommendations
    if (analysis.current.cpuUsage > this.config.thresholds.cpu * 0.8) {
      const timeToThreshold = this.calculateTimeToThreshold('cpu', analysis.current.cpuUsage);
      recommendations.push({
        type: 'scale_up',
        priority: analysis.current.cpuUsage > this.config.thresholds.cpu ? 'high' : 'medium',
        resource: 'CPU',
        currentValue: analysis.current.cpuUsage,
        projectedValue: analysis.forecasts.next30Days.resourceRequirements.cpu,
        threshold: this.config.thresholds.cpu,
        timeToThreshold,
        action: 'Consider upgrading CPU or adding more instances',
        impact: {
          cost: 'medium',
          complexity: 'low',
          risk: 'low',
        },
      });
    }
    
    // Memory recommendations
    if (analysis.current.memoryUsage > this.config.thresholds.memory * 0.8) {
      const timeToThreshold = this.calculateTimeToThreshold('memory', analysis.current.memoryUsage);
      recommendations.push({
        type: 'scale_up',
        priority: analysis.current.memoryUsage > this.config.thresholds.memory ? 'high' : 'medium',
        resource: 'Memory',
        currentValue: analysis.current.memoryUsage,
        projectedValue: analysis.forecasts.next30Days.resourceRequirements.memory,
        threshold: this.config.thresholds.memory,
        timeToThreshold,
        action: 'Consider increasing memory allocation or optimizing memory usage',
        impact: {
          cost: 'low',
          complexity: 'low',
          risk: 'low',
        },
      });
    }
    
    return recommendations;
  }

  /**
   * Get current capacity metrics
   */
  private getCurrentCapacityMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      requestsPerSecond: 0, // TODO: Calculate from request metrics
      concurrentUsers: 0, // TODO: Calculate from session metrics
      memoryUsage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
      cpuUsage: 0, // TODO: Calculate actual CPU percentage
      diskUsage: 0, // TODO: Implement disk usage monitoring
      networkThroughput: 0, // TODO: Implement network monitoring
    };
  }

  /**
   * Analyze capacity trends
   */
  private analyzeTrends() {
    return {
      growth: {
        daily: 1.5, // TODO: Calculate from historical data
        weekly: 10.5,
        monthly: 45.0,
      },
      seasonal: {
        pattern: 'daily' as const,
        peakMultiplier: 1.8,
      },
    };
  }

  /**
   * Generate capacity forecasts
   */
  private generateForecasts(trends: any): {
    next30Days: CapacityForecast;
    next90Days: CapacityForecast;
    next365Days: CapacityForecast;
  } {
    const current = this.getCurrentCapacityMetrics();
    
    const next30Days: CapacityForecast = {
      expectedLoad: {
        requestsPerSecond: current.requestsPerSecond * (1 + trends.growth.daily * 30 / 100),
        concurrentUsers: current.concurrentUsers * (1 + trends.growth.daily * 30 / 100),
        dataVolume: 0, // TODO: Calculate data volume growth
      },
      resourceRequirements: {
        cpu: current.cpuUsage * (1 + trends.growth.daily * 30 / 100),
        memory: current.memoryUsage * (1 + trends.growth.daily * 30 / 100),
        storage: current.diskUsage * (1 + trends.growth.daily * 30 / 100),
        network: current.networkThroughput * (1 + trends.growth.daily * 30 / 100),
      },
      recommendations: [],
    };
    
    return {
      next30Days,
      next90Days: next30Days, // TODO: Calculate separate 90-day forecast
      next365Days: next30Days, // TODO: Calculate separate 365-day forecast
    };
  }

  /**
   * Check capacity thresholds
   */
  private checkThresholds(resource: string, value: number): void {
    const threshold = (this.config.thresholds as any)[resource];
    if (threshold && value > threshold) {
      this.thresholdCounter.add(1, {
        resource,
        threshold_type: 'utilization',
        severity: 'critical',
      });
      
      logger.warn('Capacity threshold exceeded', {
        event: 'capacity.threshold.exceeded',
        resource,
        currentValue: value,
        threshold,
      });
    }
  }

  /**
   * Generate queue recommendations
   */
  private generateQueueRecommendations(queues: any[]): string[] {
    const recommendations: string[] = [];
    
    const criticalQueues = queues.filter(q => q.currentDepth > this.config.thresholds.queueDepth);
    if (criticalQueues.length > 0) {
      recommendations.push(`${criticalQueues.length} queue(s) have excessive depth - consider increasing processing capacity`);
    }
    
    const slowQueues = queues.filter(q => q.backlogDuration > 30); // 30 minutes
    if (slowQueues.length > 0) {
      recommendations.push(`${slowQueues.length} queue(s) have long processing times - optimize queue processing logic`);
    }
    
    return recommendations;
  }

  /**
   * Linear regression calculation
   */
  private linearRegression(x: number[], y: number[]): { slope: number; r2: number } {
    const n = x.length;
    if (n < 2) return { slope: 0, r2: 0 };
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumYY = y.reduce((sum, yi) => sum + yi * yi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Calculate R-squared
    const yMean = sumY / n;
    const ssTotal = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
    const ssRes = y.reduce((sum, yi, i) => {
      const yPred = slope * x[i] + intercept;
      return sum + Math.pow(yi - yPred, 2);
    }, 0);
    
    const r2 = ssTotal > 0 ? 1 - (ssRes / ssTotal) : 0;
    
    return { slope, r2 };
  }

  /**
   * Determine pattern type from values
   */
  private determinePattern(values: number[]): 'linear' | 'exponential' | 'seasonal' | 'irregular' {
    if (values.length < 10) return 'irregular';
    
    // Simple heuristic - in production, use more sophisticated analysis
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    const growthRatio = secondAvg / firstAvg;
    
    if (growthRatio > 1.5) return 'exponential';
    if (growthRatio > 1.1) return 'linear';
    
    return 'seasonal';
  }

  /**
   * Calculate time to threshold in days
   */
  private calculateTimeToThreshold(resource: string, currentValue: number): number {
    const threshold = (this.config.thresholds as any)[resource];
    if (!threshold || currentValue >= threshold) return 0;
    
    // Simple calculation - in production, use trend analysis
    const growthRate = 1.5; // 1.5% daily growth
    const dailyIncrease = currentValue * (growthRate / 100);
    const remainingCapacity = threshold - currentValue;
    
    return Math.ceil(remainingCapacity / dailyIncrease);
  }

  /**
   * Run complete capacity analysis
   */
  private async runCapacityAnalysis(): Promise<void> {
    try {
      const analysis = await this.getCapacityAnalysis();
      const queueAnalysis = await this.analyzeQueues();
      const recommendations = await this.generateRecommendations();
      
      logger.info('Capacity analysis completed', {
        event: 'capacity.analysis.completed',
        cpuUsage: analysis.current.cpuUsage,
        memoryUsage: analysis.current.memoryUsage,
        recommendationsCount: recommendations.length,
        criticalQueues: queueAnalysis.summary.criticalQueues,
      });
      
      this.lastAnalysis = Date.now();
    } catch (error) {
      logger.error('Capacity analysis failed', {
        event: 'capacity.analysis.failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

// Global service instance
let globalCapacityPlanningService: CapacityPlanningService | null = null;

/**
 * Get global capacity planning service instance
 */
export function getCapacityPlanningService(
  config?: Partial<CapacityPlanningConfig>
): CapacityPlanningService {
  if (!globalCapacityPlanningService) {
    globalCapacityPlanningService = new CapacityPlanningService(config);
  }
  return globalCapacityPlanningService;
}