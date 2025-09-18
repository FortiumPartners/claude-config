/**
 * Performance Impact Analysis Service
 * Task 3.3: Parallel Logging Validation Framework - Sub-task 3
 * 
 * Measures performance impact of dual logging (Seq + OTEL), creates benchmarks,
 * implements regression detection, and generates production deployment recommendations.
 */

import { EventEmitter } from 'events';
import { logger } from '../config/logger';
import { performance, PerformanceObserver } from 'perf_hooks';
import * as os from 'os';
import * as fs from 'fs/promises';
import * as path from 'path';

// Performance measurement types
export interface PerformanceMeasurement {
  id: string;
  timestamp: string;
  scenario: string;
  configuration: 'seq_only' | 'otel_only' | 'parallel' | 'baseline';
  metrics: {
    // Latency metrics (milliseconds)
    averageLatency: number;
    p50Latency: number;
    p95Latency: number;
    p99Latency: number;
    maxLatency: number;
    minLatency: number;
    
    // Throughput metrics
    requestsPerSecond: number;
    logsPerSecond: number;
    successRate: number;
    
    // Resource usage
    cpuUsagePercent: number;
    memoryUsageMB: number;
    heapUsedMB: number;
    heapTotalMB: number;
    externalMB: number;
    
    // I/O metrics
    diskWritesMB: number;
    networkBytesSent: number;
    networkBytesReceived: number;
    
    // Error metrics
    errorRate: number;
    timeoutRate: number;
    retryRate: number;
  };
  sampleSize: number;
  duration: number; // seconds
  environment: {
    nodeVersion: string;
    platform: string;
    arch: string;
    cpuModel: string;
    totalMemoryGB: number;
    freeMemoryGB: number;
  };
}

export interface BenchmarkSuite {
  id: string;
  name: string;
  description: string;
  scenarios: BenchmarkScenario[];
  createdAt: string;
  completedAt?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  results: PerformanceMeasurement[];
  summary: BenchmarkSummary;
}

export interface BenchmarkScenario {
  name: string;
  description: string;
  configuration: 'seq_only' | 'otel_only' | 'parallel' | 'baseline';
  parameters: {
    duration: number; // seconds
    concurrency: number;
    requestsPerSecond: number;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    payloadSize: 'small' | 'medium' | 'large';
    errorRate: number; // 0-1
  };
  warmupDuration: number; // seconds
  enabled: boolean;
}

export interface BenchmarkSummary {
  overallWinner: string;
  performanceComparison: {
    baseline: PerformanceMeasurement;
    seqOnly: PerformanceMeasurement;
    otelOnly: PerformanceMeasurement;
    parallel: PerformanceMeasurement;
  };
  impactAnalysis: {
    parallelVsSeqOnly: {
      latencyImpact: number; // percentage increase
      throughputImpact: number; // percentage decrease
      resourceImpact: number; // percentage increase
    };
    parallelVsBaseline: {
      latencyImpact: number;
      throughputImpact: number;
      resourceImpact: number;
    };
  };
  recommendations: string[];
  productionReadiness: {
    approved: boolean;
    concerns: string[];
    conditions: string[];
  };
}

export interface RegressionAlert {
  id: string;
  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  metric: string;
  currentValue: number;
  baselineValue: number;
  changePercent: number;
  threshold: number;
  scenario: string;
  message: string;
}

export interface PerformanceConfig {
  enabled: boolean;
  benchmarkInterval: number; // milliseconds between automatic benchmarks
  regressionThresholds: {
    latency: number; // percentage increase threshold
    throughput: number; // percentage decrease threshold
    memory: number; // percentage increase threshold
    cpu: number; // percentage increase threshold
  };
  benchmarkDefaults: {
    duration: number;
    warmupDuration: number;
    concurrency: number;
    requestsPerSecond: number;
  };
  storage: {
    resultsDirectory: string;
    maxResultFiles: number;
  };
}

/**
 * Performance Impact Analysis Service
 */
export class PerformanceAnalysisService extends EventEmitter {
  private config: PerformanceConfig;
  private activeBenchmarks: Map<string, BenchmarkSuite> = new Map();
  private performanceObserver: PerformanceObserver | null = null;
  private baselineMetrics: PerformanceMeasurement | null = null;
  private continuousMonitoring: boolean = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private metricsBuffer: Array<{
    timestamp: number;
    configuration: string;
    latency: number;
    cpu: number;
    memory: number;
  }> = [];

  constructor(config?: Partial<PerformanceConfig>) {
    super();

    this.config = {
      enabled: true,
      benchmarkInterval: 3600000, // 1 hour
      regressionThresholds: {
        latency: 10, // 10% increase
        throughput: 5, // 5% decrease
        memory: 20, // 20% increase
        cpu: 15, // 15% increase
      },
      benchmarkDefaults: {
        duration: 60, // 60 seconds
        warmupDuration: 10, // 10 seconds
        concurrency: 10,
        requestsPerSecond: 100,
      },
      storage: {
        resultsDirectory: 'performance-results',
        maxResultFiles: 100,
      },
      ...config,
    };

    this.initialize();
  }

  private async initialize(): Promise<void> {
    if (!this.config.enabled) {
      logger.info('Performance Analysis disabled via configuration');
      return;
    }

    // Set up performance observer
    this.setupPerformanceObserver();

    // Ensure results directory exists
    await this.ensureResultsDirectory();

    // Load baseline metrics if available
    await this.loadBaselineMetrics();

    logger.info('Performance Analysis Service initialized', {
      event: 'performance_analysis.initialized',
      config: this.config,
    });
  }

  private setupPerformanceObserver(): void {
    try {
      this.performanceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        for (const entry of entries) {
          this.processPerformanceEntry(entry);
        }
      });

      this.performanceObserver.observe({ entryTypes: ['measure', 'mark', 'function'] });
    } catch (error) {
      logger.warn('Failed to setup performance observer', {
        event: 'performance_analysis.observer_setup_failed',
        error: (error as Error).message,
      });
    }
  }

  private processPerformanceEntry(entry: PerformanceEntry): void {
    // Process performance entries for continuous monitoring
    if (entry.name.startsWith('log_')) {
      this.recordLogPerformanceMetric(entry);
    }
  }

  private recordLogPerformanceMetric(entry: PerformanceEntry): void {
    // Extract configuration from entry name (e.g., 'log_seq', 'log_otel', 'log_parallel')
    const parts = entry.name.split('_');
    const configuration = parts[1] || 'unknown';
    
    // Get current system metrics
    const cpuUsage = this.getCurrentCpuUsage();
    const memoryUsage = process.memoryUsage();

    this.metricsBuffer.push({
      timestamp: Date.now(),
      configuration,
      latency: entry.duration,
      cpu: cpuUsage,
      memory: memoryUsage.heapUsed / 1024 / 1024, // MB
    });

    // Maintain buffer size
    if (this.metricsBuffer.length > 10000) {
      this.metricsBuffer.splice(0, 1000); // Remove oldest 1000 entries
    }

    // Check for regressions if baseline exists
    if (this.baselineMetrics) {
      this.checkForRegressions(entry, configuration);
    }
  }

  private checkForRegressions(entry: PerformanceEntry, configuration: string): void {
    if (!this.baselineMetrics) return;

    const currentLatency = entry.duration;
    const baselineLatency = this.baselineMetrics.metrics.averageLatency;
    
    const latencyIncrease = ((currentLatency - baselineLatency) / baselineLatency) * 100;

    if (latencyIncrease > this.config.regressionThresholds.latency) {
      const alert: RegressionAlert = {
        id: `regression_${Date.now()}`,
        timestamp: new Date().toISOString(),
        severity: latencyIncrease > 50 ? 'critical' : latencyIncrease > 25 ? 'high' : 'medium',
        metric: 'latency',
        currentValue: currentLatency,
        baselineValue: baselineLatency,
        changePercent: latencyIncrease,
        threshold: this.config.regressionThresholds.latency,
        scenario: configuration,
        message: `Latency regression detected: ${latencyIncrease.toFixed(1)}% increase`,
      };

      this.emit('regression_detected', alert);
      logger.warn('Performance regression detected', {
        event: 'performance_analysis.regression_detected',
        alert,
      });
    }
  }

  /**
   * Create and run a comprehensive benchmark suite
   */
  async createBenchmarkSuite(
    name: string,
    description: string,
    customScenarios?: BenchmarkScenario[]
  ): Promise<string> {
    const suiteId = `benchmark_${Date.now()}`;
    
    const scenarios = customScenarios || this.getDefaultScenarios();
    
    const suite: BenchmarkSuite = {
      id: suiteId,
      name,
      description,
      scenarios,
      createdAt: new Date().toISOString(),
      status: 'pending',
      results: [],
      summary: {} as BenchmarkSummary,
    };

    this.activeBenchmarks.set(suiteId, suite);

    logger.info('Benchmark suite created', {
      event: 'performance_analysis.suite_created',
      suiteId,
      name,
      scenarioCount: scenarios.length,
    });

    // Start benchmark execution asynchronously
    setImmediate(() => this.executeBenchmarkSuite(suiteId));

    return suiteId;
  }

  private async executeBenchmarkSuite(suiteId: string): Promise<void> {
    const suite = this.activeBenchmarks.get(suiteId);
    if (!suite) return;

    try {
      suite.status = 'running';
      this.emit('benchmark_started', suite);

      logger.info('Starting benchmark suite execution', {
        event: 'performance_analysis.suite_started',
        suiteId,
        scenarioCount: suite.scenarios.length,
      });

      for (const scenario of suite.scenarios) {
        if (!scenario.enabled) {
          logger.debug('Skipping disabled scenario', {
            event: 'performance_analysis.scenario_skipped',
            scenarioName: scenario.name,
          });
          continue;
        }

        logger.info('Executing benchmark scenario', {
          event: 'performance_analysis.scenario_started',
          suiteId,
          scenarioName: scenario.name,
          configuration: scenario.configuration,
        });

        const measurement = await this.executeBenchmarkScenario(scenario);
        suite.results.push(measurement);

        this.emit('scenario_completed', { suiteId, scenario, measurement });

        // Wait between scenarios to allow system to stabilize
        await this.sleep(5000);
      }

      // Generate summary and analysis
      suite.summary = await this.generateBenchmarkSummary(suite.results);
      suite.status = 'completed';
      suite.completedAt = new Date().toISOString();

      // Save results to disk
      await this.saveBenchmarkResults(suite);

      // Update baseline if this is a baseline measurement
      const baselineMeasurement = suite.results.find(r => r.configuration === 'baseline');
      if (baselineMeasurement) {
        this.baselineMetrics = baselineMeasurement;
        await this.saveBaselineMetrics();
      }

      this.emit('benchmark_completed', suite);

      logger.info('Benchmark suite completed', {
        event: 'performance_analysis.suite_completed',
        suiteId,
        duration: Date.now() - new Date(suite.createdAt).getTime(),
        resultCount: suite.results.length,
      });

    } catch (error) {
      suite.status = 'failed';
      this.emit('benchmark_failed', { suiteId, error });

      logger.error('Benchmark suite failed', {
        event: 'performance_analysis.suite_failed',
        suiteId,
        error: (error as Error).message,
      });
    }
  }

  private async executeBenchmarkScenario(scenario: BenchmarkScenario): Promise<PerformanceMeasurement> {
    const measurementId = `measurement_${Date.now()}`;
    const startTime = Date.now();

    // Warmup phase
    if (scenario.warmupDuration > 0) {
      await this.executeLoadTest({
        ...scenario.parameters,
        duration: scenario.warmupDuration,
      }, scenario.configuration, true);
    }

    // Measurement phase
    const loadTestResults = await this.executeLoadTest(
      scenario.parameters,
      scenario.configuration,
      false
    );

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000; // seconds

    const measurement: PerformanceMeasurement = {
      id: measurementId,
      timestamp: new Date().toISOString(),
      scenario: scenario.name,
      configuration: scenario.configuration,
      metrics: loadTestResults,
      sampleSize: scenario.parameters.requestsPerSecond * scenario.parameters.duration,
      duration,
      environment: this.getCurrentEnvironmentInfo(),
    };

    return measurement;
  }

  private async executeLoadTest(
    parameters: BenchmarkScenario['parameters'],
    configuration: string,
    isWarmup: boolean
  ): Promise<PerformanceMeasurement['metrics']> {
    const latencies: number[] = [];
    const errors: number[] = [];
    const startTime = Date.now();
    const endTime = startTime + (parameters.duration * 1000);
    
    let requestCount = 0;
    let errorCount = 0;
    let timeoutCount = 0;
    let retryCount = 0;

    // Start system monitoring
    const memoryStart = process.memoryUsage();
    const cpuStart = process.cpuUsage();

    // Simulate load based on configuration
    const promises: Promise<void>[] = [];
    const concurrency = Math.min(parameters.concurrency, parameters.requestsPerSecond);
    
    for (let i = 0; i < concurrency; i++) {
      promises.push(this.runWorker(parameters, configuration, endTime, {
        onRequest: () => requestCount++,
        onLatency: (latency) => latencies.push(latency),
        onError: () => errorCount++,
        onTimeout: () => timeoutCount++,
        onRetry: () => retryCount++,
      }));
    }

    await Promise.all(promises);

    // Calculate final metrics
    const memoryEnd = process.memoryUsage();
    const cpuEnd = process.cpuUsage(cpuStart);
    const actualDuration = (Date.now() - startTime) / 1000;

    // Sort latencies for percentile calculations
    latencies.sort((a, b) => a - b);
    
    const metrics: PerformanceMeasurement['metrics'] = {
      averageLatency: latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
      p50Latency: this.getPercentile(latencies, 50),
      p95Latency: this.getPercentile(latencies, 95),
      p99Latency: this.getPercentile(latencies, 99),
      maxLatency: latencies.length > 0 ? Math.max(...latencies) : 0,
      minLatency: latencies.length > 0 ? Math.min(...latencies) : 0,
      
      requestsPerSecond: requestCount / actualDuration,
      logsPerSecond: requestCount / actualDuration, // Assuming 1 log per request
      successRate: requestCount > 0 ? ((requestCount - errorCount) / requestCount) * 100 : 0,
      
      cpuUsagePercent: ((cpuEnd.user + cpuEnd.system) / (actualDuration * 1000)) * 100,
      memoryUsageMB: memoryEnd.heapUsed / 1024 / 1024,
      heapUsedMB: memoryEnd.heapUsed / 1024 / 1024,
      heapTotalMB: memoryEnd.heapTotal / 1024 / 1024,
      externalMB: memoryEnd.external / 1024 / 1024,
      
      diskWritesMB: 0, // Would need actual disk monitoring
      networkBytesSent: 0, // Would need actual network monitoring
      networkBytesReceived: 0,
      
      errorRate: requestCount > 0 ? (errorCount / requestCount) * 100 : 0,
      timeoutRate: requestCount > 0 ? (timeoutCount / requestCount) * 100 : 0,
      retryRate: requestCount > 0 ? (retryCount / requestCount) * 100 : 0,
    };

    if (!isWarmup) {
      logger.debug('Load test completed', {
        event: 'performance_analysis.load_test_completed',
        configuration,
        duration: actualDuration,
        requestCount,
        errorCount,
        averageLatency: metrics.averageLatency,
      });
    }

    return metrics;
  }

  private async runWorker(
    parameters: BenchmarkScenario['parameters'],
    configuration: string,
    endTime: number,
    callbacks: {
      onRequest: () => void;
      onLatency: (latency: number) => void;
      onError: () => void;
      onTimeout: () => void;
      onRetry: () => void;
    }
  ): Promise<void> {
    const requestInterval = 1000 / (parameters.requestsPerSecond / parameters.concurrency);
    
    while (Date.now() < endTime) {
      const requestStart = performance.now();
      
      try {
        callbacks.onRequest();
        
        // Simulate different types of logging operations
        await this.simulateLoggingOperation(configuration, parameters);
        
        const requestEnd = performance.now();
        const latency = requestEnd - requestStart;
        
        callbacks.onLatency(latency);
        
        // Simulate random errors
        if (Math.random() < parameters.errorRate) {
          callbacks.onError();
        }
        
      } catch (error) {
        callbacks.onError();
        
        if ((error as Error).message.includes('timeout')) {
          callbacks.onTimeout();
        }
      }
      
      // Wait for next request
      await this.sleep(requestInterval);
    }
  }

  private async simulateLoggingOperation(
    configuration: string,
    parameters: BenchmarkScenario['parameters']
  ): Promise<void> {
    // Simulate different logging configurations
    const logMessage = this.generateLogMessage(parameters.payloadSize);
    const logLevel = parameters.logLevel;
    
    const startMark = `log_${configuration}_start`;
    const endMark = `log_${configuration}_end`;
    const measureName = `log_${configuration}`;
    
    performance.mark(startMark);
    
    try {
      switch (configuration) {
        case 'baseline':
          // No logging
          await this.sleep(0.1); // Minimal processing delay
          break;
          
        case 'seq_only':
          // Simulate Seq logging only
          logger.log(logLevel, logMessage, {
            event: 'performance_test.seq_only',
            configuration,
            payloadSize: parameters.payloadSize,
          });
          break;
          
        case 'otel_only':
          // Simulate OTEL logging only
          logger.log(logLevel, logMessage, {
            event: 'performance_test.otel_only',
            configuration,
            payloadSize: parameters.payloadSize,
            'otel.enabled': true,
          });
          break;
          
        case 'parallel':
          // Simulate parallel logging to both Seq and OTEL
          logger.log(logLevel, logMessage, {
            event: 'performance_test.parallel',
            configuration,
            payloadSize: parameters.payloadSize,
            'seq.enabled': true,
            'otel.enabled': true,
          });
          break;
      }
    } finally {
      performance.mark(endMark);
      performance.measure(measureName, startMark, endMark);
      
      // Clean up performance marks
      performance.clearMarks(startMark);
      performance.clearMarks(endMark);
    }
  }

  private generateLogMessage(payloadSize: 'small' | 'medium' | 'large'): string {
    const baseMessage = 'Performance test log message';
    
    switch (payloadSize) {
      case 'small':
        return baseMessage;
      case 'medium':
        return baseMessage + ' '.repeat(100) + 'with additional medium payload data';
      case 'large':
        return baseMessage + ' '.repeat(500) + 'with large payload data containing detailed information about the current operation and system state';
      default:
        return baseMessage;
    }
  }

  private getPercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)];
  }

  private getCurrentCpuUsage(): number {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;
    
    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += (cpu.times as any)[type];
      }
      totalIdle += cpu.times.idle;
    }
    
    return 100 - (totalIdle / totalTick) * 100;
  }

  private getCurrentEnvironmentInfo() {
    return {
      nodeVersion: process.version,
      platform: os.platform(),
      arch: os.arch(),
      cpuModel: os.cpus()[0]?.model || 'unknown',
      totalMemoryGB: os.totalmem() / 1024 / 1024 / 1024,
      freeMemoryGB: os.freemem() / 1024 / 1024 / 1024,
    };
  }

  private getDefaultScenarios(): BenchmarkScenario[] {
    const baseParams = {
      duration: this.config.benchmarkDefaults.duration,
      concurrency: this.config.benchmarkDefaults.concurrency,
      requestsPerSecond: this.config.benchmarkDefaults.requestsPerSecond,
      logLevel: 'info' as const,
      payloadSize: 'medium' as const,
      errorRate: 0.01, // 1% error rate
    };

    return [
      {
        name: 'Baseline (No Logging)',
        description: 'Baseline performance measurement without any logging',
        configuration: 'baseline',
        parameters: baseParams,
        warmupDuration: this.config.benchmarkDefaults.warmupDuration,
        enabled: true,
      },
      {
        name: 'Seq Only Logging',
        description: 'Performance measurement with Seq logging only',
        configuration: 'seq_only',
        parameters: baseParams,
        warmupDuration: this.config.benchmarkDefaults.warmupDuration,
        enabled: true,
      },
      {
        name: 'OTEL Only Logging',
        description: 'Performance measurement with OTEL logging only',
        configuration: 'otel_only',
        parameters: baseParams,
        warmupDuration: this.config.benchmarkDefaults.warmupDuration,
        enabled: true,
      },
      {
        name: 'Parallel Logging',
        description: 'Performance measurement with both Seq and OTEL logging',
        configuration: 'parallel',
        parameters: baseParams,
        warmupDuration: this.config.benchmarkDefaults.warmupDuration,
        enabled: true,
      },
    ];
  }

  private async generateBenchmarkSummary(results: PerformanceMeasurement[]): Promise<BenchmarkSummary> {
    const baseline = results.find(r => r.configuration === 'baseline');
    const seqOnly = results.find(r => r.configuration === 'seq_only');
    const otelOnly = results.find(r => r.configuration === 'otel_only');
    const parallel = results.find(r => r.configuration === 'parallel');

    if (!baseline || !seqOnly || !otelOnly || !parallel) {
      throw new Error('Incomplete benchmark results - missing required configurations');
    }

    // Calculate impact analysis
    const parallelVsSeqOnly = {
      latencyImpact: ((parallel.metrics.averageLatency - seqOnly.metrics.averageLatency) / seqOnly.metrics.averageLatency) * 100,
      throughputImpact: ((seqOnly.metrics.requestsPerSecond - parallel.metrics.requestsPerSecond) / seqOnly.metrics.requestsPerSecond) * 100,
      resourceImpact: ((parallel.metrics.memoryUsageMB - seqOnly.metrics.memoryUsageMB) / seqOnly.metrics.memoryUsageMB) * 100,
    };

    const parallelVsBaseline = {
      latencyImpact: ((parallel.metrics.averageLatency - baseline.metrics.averageLatency) / baseline.metrics.averageLatency) * 100,
      throughputImpact: ((baseline.metrics.requestsPerSecond - parallel.metrics.requestsPerSecond) / baseline.metrics.requestsPerSecond) * 100,
      resourceImpact: ((parallel.metrics.memoryUsageMB - baseline.metrics.memoryUsageMB) / baseline.metrics.memoryUsageMB) * 100,
    };

    // Generate recommendations
    const recommendations = this.generatePerformanceRecommendations({
      baseline,
      seqOnly,
      otelOnly,
      parallel,
    }, { parallelVsSeqOnly, parallelVsBaseline });

    // Determine production readiness
    const productionReadiness = this.assessProductionReadiness({
      baseline,
      seqOnly,
      otelOnly,
      parallel,
    }, { parallelVsSeqOnly, parallelVsBaseline });

    // Determine overall winner (best balance of performance and features)
    const overallWinner = this.determineOverallWinner(results);

    return {
      overallWinner,
      performanceComparison: {
        baseline,
        seqOnly,
        otelOnly,
        parallel,
      },
      impactAnalysis: {
        parallelVsSeqOnly,
        parallelVsBaseline,
      },
      recommendations,
      productionReadiness,
    };
  }

  private generatePerformanceRecommendations(
    measurements: Record<string, PerformanceMeasurement>,
    impactAnalysis: any
  ): string[] {
    const recommendations: string[] = [];
    const { parallelVsSeqOnly, parallelVsBaseline } = impactAnalysis;

    // Latency analysis
    if (parallelVsSeqOnly.latencyImpact > 10) {
      recommendations.push(`Parallel logging increases latency by ${parallelVsSeqOnly.latencyImpact.toFixed(1)}% compared to Seq-only - consider optimization`);
    } else if (parallelVsSeqOnly.latencyImpact < 5) {
      recommendations.push('Parallel logging has minimal latency impact - acceptable for production');
    }

    // Throughput analysis
    if (parallelVsSeqOnly.throughputImpact > 5) {
      recommendations.push(`Parallel logging reduces throughput by ${parallelVsSeqOnly.throughputImpact.toFixed(1)}% - consider load balancing`);
    }

    // Resource usage analysis
    if (parallelVsSeqOnly.resourceImpact > 20) {
      recommendations.push(`Parallel logging increases memory usage by ${parallelVsSeqOnly.resourceImpact.toFixed(1)}% - monitor resource allocation`);
    }

    // Configuration-specific recommendations
    if (measurements.otelOnly.metrics.averageLatency < measurements.seqOnly.metrics.averageLatency) {
      recommendations.push('OTEL-only configuration shows better performance than Seq-only');
    }

    if (measurements.parallel.metrics.successRate < 99) {
      recommendations.push(`Parallel logging success rate is ${measurements.parallel.metrics.successRate.toFixed(1)}% - investigate error sources`);
    }

    // Performance target compliance
    const targetLatencyMs = 5; // From TRD requirement
    if (parallelVsSeqOnly.latencyImpact > targetLatencyMs) {
      recommendations.push(`Parallel logging exceeds target latency impact of ${targetLatencyMs}ms - requires optimization`);
    } else {
      recommendations.push('Parallel logging meets TRD latency requirements');
    }

    return recommendations;
  }

  private assessProductionReadiness(
    measurements: Record<string, PerformanceMeasurement>,
    impactAnalysis: any
  ): BenchmarkSummary['productionReadiness'] {
    const concerns: string[] = [];
    const conditions: string[] = [];
    const { parallelVsSeqOnly, parallelVsBaseline } = impactAnalysis;

    // Check against TRD requirements
    if (parallelVsSeqOnly.latencyImpact > 5) { // TRD: <5ms additional latency
      concerns.push('Latency impact exceeds TRD requirement of <5ms additional overhead');
    }

    if (measurements.parallel.metrics.successRate < 99.9) {
      concerns.push('Success rate below 99.9% threshold');
    }

    if (parallelVsSeqOnly.resourceImpact > 25) {
      concerns.push('Memory usage increase exceeds 25% threshold');
    }

    // Conditions for approval
    if (measurements.parallel.metrics.successRate >= 99) {
      conditions.push('Maintain success rate above 99%');
    }

    if (parallelVsSeqOnly.latencyImpact <= 10) {
      conditions.push('Monitor latency impact stays below 10%');
    }

    conditions.push('Implement gradual rollout with monitoring');
    conditions.push('Set up alerting for performance regressions');

    const approved = concerns.length === 0;

    return {
      approved,
      concerns,
      conditions,
    };
  }

  private determineOverallWinner(results: PerformanceMeasurement[]): string {
    // Score each configuration based on multiple factors
    const scores = new Map<string, number>();

    for (const result of results) {
      let score = 0;

      // Latency score (lower is better)
      const normalizedLatency = 100 / (1 + result.metrics.averageLatency);
      score += normalizedLatency * 0.3;

      // Throughput score (higher is better)
      score += (result.metrics.requestsPerSecond / 1000) * 0.3;

      // Resource efficiency score (lower memory usage is better)
      const resourceScore = 100 / (1 + result.metrics.memoryUsageMB / 100);
      score += resourceScore * 0.2;

      // Reliability score
      score += result.metrics.successRate * 0.2;

      scores.set(result.configuration, score);
    }

    // Find configuration with highest score
    let winner = 'unknown';
    let highestScore = 0;

    for (const [config, score] of scores) {
      if (score > highestScore) {
        highestScore = score;
        winner = config;
      }
    }

    return winner;
  }

  private async ensureResultsDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.config.storage.resultsDirectory, { recursive: true });
    } catch (error) {
      logger.warn('Failed to create results directory', {
        event: 'performance_analysis.directory_creation_failed',
        directory: this.config.storage.resultsDirectory,
        error: (error as Error).message,
      });
    }
  }

  private async saveBenchmarkResults(suite: BenchmarkSuite): Promise<void> {
    try {
      const filename = `benchmark_${suite.id}_${Date.now()}.json`;
      const filepath = path.join(this.config.storage.resultsDirectory, filename);
      
      await fs.writeFile(filepath, JSON.stringify(suite, null, 2));
      
      logger.info('Benchmark results saved', {
        event: 'performance_analysis.results_saved',
        suiteId: suite.id,
        filepath,
      });

      // Cleanup old result files
      await this.cleanupOldResults();

    } catch (error) {
      logger.error('Failed to save benchmark results', {
        event: 'performance_analysis.save_failed',
        suiteId: suite.id,
        error: (error as Error).message,
      });
    }
  }

  private async cleanupOldResults(): Promise<void> {
    try {
      const files = await fs.readdir(this.config.storage.resultsDirectory);
      const benchmarkFiles = files
        .filter(file => file.startsWith('benchmark_') && file.endsWith('.json'))
        .map(file => ({
          name: file,
          path: path.join(this.config.storage.resultsDirectory, file),
        }));

      if (benchmarkFiles.length > this.config.storage.maxResultFiles) {
        // Sort by filename (which contains timestamp) and remove oldest
        benchmarkFiles.sort((a, b) => a.name.localeCompare(b.name));
        const toDelete = benchmarkFiles.slice(0, benchmarkFiles.length - this.config.storage.maxResultFiles);

        for (const file of toDelete) {
          await fs.unlink(file.path);
        }

        logger.info('Cleaned up old benchmark results', {
          event: 'performance_analysis.cleanup_completed',
          deletedCount: toDelete.length,
        });
      }
    } catch (error) {
      logger.warn('Failed to cleanup old results', {
        event: 'performance_analysis.cleanup_failed',
        error: (error as Error).message,
      });
    }
  }

  private async loadBaselineMetrics(): Promise<void> {
    try {
      const baselinePath = path.join(this.config.storage.resultsDirectory, 'baseline.json');
      const baselineData = await fs.readFile(baselinePath, 'utf-8');
      this.baselineMetrics = JSON.parse(baselineData);

      logger.info('Baseline metrics loaded', {
        event: 'performance_analysis.baseline_loaded',
        timestamp: this.baselineMetrics.timestamp,
      });
    } catch (error) {
      logger.debug('No baseline metrics found', {
        event: 'performance_analysis.baseline_not_found',
      });
    }
  }

  private async saveBaselineMetrics(): Promise<void> {
    if (!this.baselineMetrics) return;

    try {
      const baselinePath = path.join(this.config.storage.resultsDirectory, 'baseline.json');
      await fs.writeFile(baselinePath, JSON.stringify(this.baselineMetrics, null, 2));

      logger.info('Baseline metrics saved', {
        event: 'performance_analysis.baseline_saved',
        timestamp: this.baselineMetrics.timestamp,
      });
    } catch (error) {
      logger.error('Failed to save baseline metrics', {
        event: 'performance_analysis.baseline_save_failed',
        error: (error as Error).message,
      });
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public API methods
  async runQuickPerformanceCheck(): Promise<{
    latencyImpact: number;
    resourceImpact: number;
    recommendation: string;
  }> {
    const suiteId = await this.createBenchmarkSuite(
      'Quick Performance Check',
      'Fast performance check for immediate feedback',
      [
        {
          name: 'Quick Seq Only',
          description: 'Quick Seq-only test',
          configuration: 'seq_only',
          parameters: {
            duration: 10,
            concurrency: 5,
            requestsPerSecond: 50,
            logLevel: 'info',
            payloadSize: 'medium',
            errorRate: 0,
          },
          warmupDuration: 2,
          enabled: true,
        },
        {
          name: 'Quick Parallel',
          description: 'Quick parallel logging test',
          configuration: 'parallel',
          parameters: {
            duration: 10,
            concurrency: 5,
            requestsPerSecond: 50,
            logLevel: 'info',
            payloadSize: 'medium',
            errorRate: 0,
          },
          warmupDuration: 2,
          enabled: true,
        },
      ]
    );

    // Wait for completion
    return new Promise((resolve) => {
      this.once('benchmark_completed', (suite: BenchmarkSuite) => {
        if (suite.id === suiteId) {
          const { parallelVsSeqOnly } = suite.summary.impactAnalysis;
          const recommendation = suite.summary.productionReadiness.approved
            ? 'Approved for production deployment'
            : 'Requires optimization before production';

          resolve({
            latencyImpact: parallelVsSeqOnly.latencyImpact,
            resourceImpact: parallelVsSeqOnly.resourceImpact,
            recommendation,
          });
        }
      });
    });
  }

  getBenchmarkSuite(suiteId: string): BenchmarkSuite | undefined {
    return this.activeBenchmarks.get(suiteId);
  }

  getActiveBenchmarks(): BenchmarkSuite[] {
    return Array.from(this.activeBenchmarks.values());
  }

  getBaselineMetrics(): PerformanceMeasurement | null {
    return this.baselineMetrics;
  }

  startContinuousMonitoring(): void {
    if (this.continuousMonitoring) return;

    this.continuousMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.analyzeRecentPerformance();
    }, 60000); // Check every minute

    logger.info('Continuous performance monitoring started', {
      event: 'performance_analysis.monitoring_started',
    });
  }

  stopContinuousMonitoring(): void {
    if (!this.continuousMonitoring) return;

    this.continuousMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    logger.info('Continuous performance monitoring stopped', {
      event: 'performance_analysis.monitoring_stopped',
    });
  }

  private analyzeRecentPerformance(): void {
    if (this.metricsBuffer.length < 100) return; // Need sufficient data

    const recentMetrics = this.metricsBuffer.slice(-100);
    const avgLatency = recentMetrics.reduce((sum, m) => sum + m.latency, 0) / recentMetrics.length;
    const avgCpu = recentMetrics.reduce((sum, m) => sum + m.cpu, 0) / recentMetrics.length;
    const avgMemory = recentMetrics.reduce((sum, m) => sum + m.memory, 0) / recentMetrics.length;

    // Emit continuous monitoring update
    this.emit('monitoring_update', {
      timestamp: new Date().toISOString(),
      avgLatency,
      avgCpu,
      avgMemory,
      sampleSize: recentMetrics.length,
    });

    // Check for performance degradation
    if (this.baselineMetrics) {
      const latencyIncrease = ((avgLatency - this.baselineMetrics.metrics.averageLatency) / this.baselineMetrics.metrics.averageLatency) * 100;
      
      if (latencyIncrease > this.config.regressionThresholds.latency) {
        this.emit('performance_degradation', {
          metric: 'latency',
          currentValue: avgLatency,
          baselineValue: this.baselineMetrics.metrics.averageLatency,
          increasePercent: latencyIncrease,
        });
      }
    }
  }

  updateConfig(newConfig: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...newConfig };

    logger.info('Performance analysis configuration updated', {
      event: 'performance_analysis.config_updated',
      config: this.config,
    });
  }

  destroy(): void {
    this.stopContinuousMonitoring();

    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
      this.performanceObserver = null;
    }

    this.removeAllListeners();
    this.activeBenchmarks.clear();
    this.metricsBuffer.length = 0;

    logger.info('Performance Analysis Service destroyed', {
      event: 'performance_analysis.destroyed',
    });
  }
}

// Export singleton instance
export const performanceAnalysisService = new PerformanceAnalysisService();

export default PerformanceAnalysisService;