/**
 * Comprehensive Load Testing Framework
 * Task 1.3: Load Testing Framework for Seq to OpenTelemetry Migration
 * 
 * Provides comprehensive load testing scenarios, metrics collection, and 
 * regression detection for the monitoring web service logging infrastructure.
 */

import { spawn, ChildProcess } from 'child_process';
import { performance } from 'perf_hooks';
import { createApp } from '../../app';
import { logger } from '../../config/logger';
import fetch from 'node-fetch';
import { randomUUID } from 'crypto';
import { Express } from 'express';
import { Server } from 'http';
import * as fs from 'fs/promises';
import * as path from 'path';

// Load test configuration
interface LoadTestConfig {
  name: string;
  description: string;
  duration: number; // seconds
  rampUpTime: number; // seconds to reach target load
  targetRPS: number; // requests per second
  maxConcurrency: number; // maximum concurrent connections
  scenarios: LoadTestScenario[];
  endpoints: EndpointConfig[];
}

interface LoadTestScenario {
  name: string;
  weight: number; // percentage of total load (0-1)
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  expectedStatus: number[];
  customValidation?: (response: any) => boolean;
}

interface EndpointConfig {
  path: string;
  method: string;
  loggingIntensive: boolean;
  authRequired: boolean;
  expectedLatency: number; // ms
  maxMemoryImpact: number; // bytes
}

interface LoadTestMetrics {
  overview: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageRPS: number;
    testDuration: number;
    errorRate: number;
  };
  latency: {
    min: number;
    max: number;
    average: number;
    p50: number;
    p90: number;
    p95: number;
    p99: number;
    p999: number;
  };
  errors: {
    byStatusCode: Record<number, number>;
    byEndpoint: Record<string, number>;
    errorMessages: string[];
  };
  resources: {
    peakMemoryMB: number;
    averageMemoryMB: number;
    memoryGrowthMB: number;
    cpuPeakPercent: number;
    cpuAveragePercent: number;
    gcCollections: number;
  };
  logging: {
    logsGenerated: number;
    averageLogLatency: number;
    logErrors: number;
    seqHealthDegradations: number;
    circuitBreakerActivations: number;
  };
  endpoints: Record<string, {
    requests: number;
    averageLatency: number;
    errorRate: number;
    p95Latency: number;
  }>;
}

interface RegressionThresholds {
  latencyIncrease: number; // percentage
  errorRateIncrease: number; // percentage
  memoryIncrease: number; // MB
  throughputDecrease: number; // percentage
  logLatencyIncrease: number; // percentage
}

class LoadTestingFramework {
  private app: Express;
  private server: Server;
  private port: number = 0;
  private metrics: LoadTestMetrics;
  private startTime: number = 0;
  private resourceMonitor: NodeJS.Timeout | null = null;
  private logMetricsMonitor: NodeJS.Timeout | null = null;
  private performanceMarks: Map<string, number> = new Map();

  // Production-like load test configurations
  private readonly loadTestConfigs: LoadTestConfig[] = [
    {
      name: 'normal_operations',
      description: 'Typical production load - steady state operations',
      duration: 300, // 5 minutes
      rampUpTime: 60, // 1 minute ramp-up
      targetRPS: 100,
      maxConcurrency: 20,
      scenarios: [
        {
          name: 'dashboard_requests',
          weight: 0.4,
          endpoint: '/api/v1/dashboard/metrics',
          method: 'GET',
          headers: { 'Authorization': 'Bearer test-token' },
          expectedStatus: [200],
        },
        {
          name: 'metrics_ingestion',
          weight: 0.3,
          endpoint: '/api/v1/metrics/collect',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: this.generateMetricsPayload,
          expectedStatus: [200, 201],
        },
        {
          name: 'user_auth',
          weight: 0.2,
          endpoint: '/api/v1/auth/login',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: { username: 'test', password: 'test' },
          expectedStatus: [200, 401],
        },
        {
          name: 'health_checks',
          weight: 0.1,
          endpoint: '/health',
          method: 'GET',
          expectedStatus: [200],
        }
      ],
      endpoints: []
    },
    {
      name: 'peak_load',
      description: 'Peak traffic simulation - high concurrent users',
      duration: 600, // 10 minutes
      rampUpTime: 120, // 2 minute ramp-up
      targetRPS: 500,
      maxConcurrency: 100,
      scenarios: [
        {
          name: 'high_volume_dashboard',
          weight: 0.5,
          endpoint: '/api/v1/dashboard/metrics',
          method: 'GET',
          headers: { 'Authorization': 'Bearer test-token' },
          expectedStatus: [200],
        },
        {
          name: 'bulk_metrics_ingestion',
          weight: 0.35,
          endpoint: '/api/v1/metrics/batch',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: this.generateBatchMetricsPayload,
          expectedStatus: [200, 201],
        },
        {
          name: 'concurrent_auth',
          weight: 0.15,
          endpoint: '/api/v1/auth/token/refresh',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: { refresh_token: 'test-refresh' },
          expectedStatus: [200, 401],
        }
      ],
      endpoints: []
    },
    {
      name: 'burst_traffic',
      description: 'Sudden traffic spike simulation',
      duration: 180, // 3 minutes
      rampUpTime: 10, // Quick ramp-up to simulate burst
      targetRPS: 1000,
      maxConcurrency: 200,
      scenarios: [
        {
          name: 'burst_dashboard',
          weight: 0.6,
          endpoint: '/api/v1/dashboard/metrics',
          method: 'GET',
          headers: { 'Authorization': 'Bearer test-token' },
          expectedStatus: [200, 429], // Allow rate limiting
        },
        {
          name: 'burst_metrics',
          weight: 0.4,
          endpoint: '/api/v1/metrics/collect',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: this.generateMetricsPayload,
          expectedStatus: [200, 201, 429], // Allow rate limiting
        }
      ],
      endpoints: []
    },
    {
      name: 'logging_stress',
      description: 'High logging volume stress test',
      duration: 240, // 4 minutes
      rampUpTime: 30,
      targetRPS: 200,
      maxConcurrency: 40,
      scenarios: [
        {
          name: 'debug_intensive',
          weight: 0.4,
          endpoint: '/test/debug-intensive',
          method: 'GET',
          expectedStatus: [200],
        },
        {
          name: 'error_simulation',
          weight: 0.3,
          endpoint: '/test/error-scenario',
          method: 'GET',
          expectedStatus: [400, 500, 502],
        },
        {
          name: 'auth_logging_heavy',
          weight: 0.3,
          endpoint: '/test/auth-intensive',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: { username: 'test' },
          expectedStatus: [200],
        }
      ],
      endpoints: []
    },
    {
      name: 'endurance_test',
      description: 'Long-running stability test',
      duration: 1800, // 30 minutes
      rampUpTime: 300, // 5 minute ramp-up
      targetRPS: 150,
      maxConcurrency: 30,
      scenarios: [
        {
          name: 'steady_dashboard',
          weight: 0.5,
          endpoint: '/api/v1/dashboard/metrics',
          method: 'GET',
          headers: { 'Authorization': 'Bearer test-token' },
          expectedStatus: [200],
        },
        {
          name: 'steady_metrics',
          weight: 0.5,
          endpoint: '/api/v1/metrics/collect',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: this.generateMetricsPayload,
          expectedStatus: [200, 201],
        }
      ],
      endpoints: []
    }
  ];

  private readonly regressionThresholds: RegressionThresholds = {
    latencyIncrease: 15, // 15% increase allowed
    errorRateIncrease: 50, // 50% increase in error rate allowed
    memoryIncrease: 100, // 100MB memory increase allowed
    throughputDecrease: 10, // 10% throughput decrease allowed
    logLatencyIncrease: 20, // 20% log latency increase allowed
  };

  constructor() {
    this.initializeMetrics();
  }

  private initializeMetrics(): void {
    this.metrics = {
      overview: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageRPS: 0,
        testDuration: 0,
        errorRate: 0
      },
      latency: {
        min: Infinity,
        max: 0,
        average: 0,
        p50: 0,
        p90: 0,
        p95: 0,
        p99: 0,
        p999: 0
      },
      errors: {
        byStatusCode: {},
        byEndpoint: {},
        errorMessages: []
      },
      resources: {
        peakMemoryMB: 0,
        averageMemoryMB: 0,
        memoryGrowthMB: 0,
        cpuPeakPercent: 0,
        cpuAveragePercent: 0,
        gcCollections: 0
      },
      logging: {
        logsGenerated: 0,
        averageLogLatency: 0,
        logErrors: 0,
        seqHealthDegradations: 0,
        circuitBreakerActivations: 0
      },
      endpoints: {}
    };
  }

  async initialize(): Promise<void> {
    console.log('🚀 Initializing Load Testing Framework...');

    // Create Express app
    this.app = await createApp();

    // Add test endpoints for logging stress tests
    this.setupTestEndpoints();

    // Start server
    this.server = this.app.listen(0, () => {
      const address = this.server.address();
      this.port = typeof address === 'object' && address ? address.port : 3000;
      console.log(`✅ Test server running on port ${this.port}`);
    });

    console.log('✅ Load Testing Framework initialized');
  }

  private setupTestEndpoints(): void {
    // Debug intensive endpoint
    this.app.get('/test/debug-intensive', (req: any, res: any) => {
      const startTime = performance.now();
      
      // Generate extensive debug logging
      for (let i = 0; i < 10; i++) {
        req.logger.debug(`Debug operation ${i}`, {
          iteration: i,
          timestamp: Date.now(),
          operation: 'stress_test',
          data: this.generateLargeLogData(),
          event: 'debug.intensive'
        });
      }

      req.logger.info('Debug intensive operation completed', {
        operationsCount: 10,
        duration: performance.now() - startTime,
        event: 'debug.completed'
      });

      res.json({ status: 'success', operations: 10 });
    });

    // Error scenario endpoint (already exists in baseline)
    if (!this.app._router.stack.find((layer: any) => 
      layer.route && layer.route.path === '/test/error-scenario')) {
      
      this.app.get('/test/error-scenario', (req: any, res: any) => {
        const errorTypes = ['database', 'external_api', 'validation'];
        const errorType = errorTypes[Math.floor(Math.random() * errorTypes.length)];
        
        req.logger.error(`Simulated ${errorType} error`, {
          errorType,
          severity: 'high',
          event: 'error.simulation'
        });
        
        const statusCode = errorType === 'database' ? 500 : 
                          errorType === 'external_api' ? 502 : 400;
        
        res.status(statusCode).json({ 
          error: `${errorType} error`, 
          type: errorType 
        });
      });
    }

    // Auth intensive endpoint (already exists in baseline)
    if (!this.app._router.stack.find((layer: any) => 
      layer.route && layer.route.path === '/test/auth-intensive')) {
      
      this.app.post('/test/auth-intensive', (req: any, res: any) => {
        // Extensive auth logging
        req.logger.info('Authentication started', { event: 'auth.start' });
        req.logger.debug('Token validation', { event: 'auth.token_check' });
        req.logger.debug('User lookup', { event: 'auth.user_lookup' });
        req.logger.info('Session created', { event: 'auth.session_create' });
        req.logger.info('Auth completed', { event: 'auth.complete' });

        res.json({ success: true, userId: randomUUID() });
      });
    }
  }

  async runLoadTest(configName: string): Promise<LoadTestMetrics> {
    const config = this.loadTestConfigs.find(c => c.name === configName);
    if (!config) {
      throw new Error(`Load test configuration '${configName}' not found`);
    }

    console.log(`🔥 Starting load test: ${config.name}`);
    console.log(`  Duration: ${config.duration}s, Target RPS: ${config.targetRPS}, Max Concurrency: ${config.maxConcurrency}`);

    this.initializeMetrics();
    this.startTime = performance.now();

    // Start monitoring
    this.startResourceMonitoring();
    this.startLoggingMonitoring();

    try {
      // Run the load test
      await this.executeLoadTest(config);
      
      // Calculate final metrics
      this.calculateFinalMetrics();
      
      return this.metrics;
    } finally {
      this.stopMonitoring();
    }
  }

  private async executeLoadTest(config: LoadTestConfig): Promise<void> {
    const baseUrl = `http://localhost:${this.port}`;
    const endTime = this.startTime + (config.duration * 1000);
    const rampUpEndTime = this.startTime + (config.rampUpTime * 1000);
    
    const latencies: number[] = [];
    const endpointMetrics: Record<string, { latencies: number[], requests: number, errors: number }> = {};
    
    // Initialize endpoint metrics
    config.scenarios.forEach(scenario => {
      endpointMetrics[scenario.endpoint] = { latencies: [], requests: 0, errors: 0 };
    });

    // Create worker pool
    const workers = Array(config.maxConcurrency).fill(null).map(async (_, workerId) => {
      let requestCount = 0;
      let lastRequestTime = performance.now();
      
      while (performance.now() < endTime) {
        const now = performance.now();
        
        // Calculate current target RPS based on ramp-up
        let currentRPS = config.targetRPS;
        if (now < rampUpEndTime) {
          const rampUpProgress = (now - this.startTime) / (config.rampUpTime * 1000);
          currentRPS = config.targetRPS * rampUpProgress;
        }
        
        // Calculate delay between requests for this worker
        const targetDelayMs = (1000 / currentRPS) * config.maxConcurrency;
        const timeSinceLastRequest = now - lastRequestTime;
        
        if (timeSinceLastRequest < targetDelayMs) {
          await new Promise(resolve => setTimeout(resolve, targetDelayMs - timeSinceLastRequest));
        }
        
        // Select scenario based on weights
        const scenario = this.selectScenario(config.scenarios);
        
        // Execute request
        const requestStart = performance.now();
        
        try {
          const body = typeof scenario.body === 'function' ? 
            scenario.body() : scenario.body;
          
          const response = await fetch(`${baseUrl}${scenario.endpoint}`, {
            method: scenario.method,
            headers: {
              ...scenario.headers,
              'User-Agent': `load-test-worker-${workerId}`,
              'X-Load-Test': 'true'
            },
            body: body ? JSON.stringify(body) : undefined,
            timeout: 30000 // 30 second timeout
          });

          const requestEnd = performance.now();
          const latency = requestEnd - requestStart;
          
          latencies.push(latency);
          endpointMetrics[scenario.endpoint].latencies.push(latency);
          endpointMetrics[scenario.endpoint].requests++;
          
          this.metrics.overview.totalRequests++;
          
          if (scenario.expectedStatus.includes(response.status)) {
            this.metrics.overview.successfulRequests++;
          } else {
            this.metrics.overview.failedRequests++;
            endpointMetrics[scenario.endpoint].errors++;
            
            this.metrics.errors.byStatusCode[response.status] = 
              (this.metrics.errors.byStatusCode[response.status] || 0) + 1;
            this.metrics.errors.byEndpoint[scenario.endpoint] = 
              (this.metrics.errors.byEndpoint[scenario.endpoint] || 0) + 1;
          }
          
          // Custom validation
          if (scenario.customValidation) {
            try {
              const responseData = await response.json();
              if (!scenario.customValidation(responseData)) {
                this.metrics.errors.errorMessages.push(
                  `Custom validation failed for ${scenario.endpoint}`
                );
              }
            } catch (e) {
              // Ignore JSON parsing errors for non-JSON responses
            }
          }
          
        } catch (error) {
          this.metrics.overview.failedRequests++;
          this.metrics.overview.totalRequests++;
          endpointMetrics[scenario.endpoint].errors++;
          
          this.metrics.errors.errorMessages.push(
            `Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
        
        lastRequestTime = performance.now();
        requestCount++;
      }
    });

    await Promise.all(workers);

    // Process latency data
    latencies.sort((a, b) => a - b);
    
    if (latencies.length > 0) {
      this.metrics.latency = {
        min: latencies[0],
        max: latencies[latencies.length - 1],
        average: latencies.reduce((sum, val) => sum + val, 0) / latencies.length,
        p50: latencies[Math.floor(latencies.length * 0.50)],
        p90: latencies[Math.floor(latencies.length * 0.90)],
        p95: latencies[Math.floor(latencies.length * 0.95)],
        p99: latencies[Math.floor(latencies.length * 0.99)],
        p999: latencies[Math.floor(latencies.length * 0.999)]
      };
    }

    // Process endpoint metrics
    Object.entries(endpointMetrics).forEach(([endpoint, data]) => {
      if (data.latencies.length > 0) {
        data.latencies.sort((a, b) => a - b);
        this.metrics.endpoints[endpoint] = {
          requests: data.requests,
          averageLatency: data.latencies.reduce((sum, val) => sum + val, 0) / data.latencies.length,
          errorRate: data.errors / data.requests,
          p95Latency: data.latencies[Math.floor(data.latencies.length * 0.95)]
        };
      }
    });
  }

  private selectScenario(scenarios: LoadTestScenario[]): LoadTestScenario {
    const random = Math.random();
    let cumulativeWeight = 0;
    
    for (const scenario of scenarios) {
      cumulativeWeight += scenario.weight;
      if (random <= cumulativeWeight) {
        return scenario;
      }
    }
    
    return scenarios[scenarios.length - 1];
  }

  private generateMetricsPayload(): any {
    return {
      timestamp: new Date().toISOString(),
      user_id: randomUUID(),
      session_id: randomUUID(),
      command_executions: Array(Math.floor(Math.random() * 5) + 1).fill(null).map(() => ({
        command_name: `cmd-${Math.floor(Math.random() * 20)}`,
        execution_time_ms: Math.floor(Math.random() * 2000) + 100,
        status: Math.random() > 0.05 ? 'success' : 'error',
        parameters: `param-${randomUUID().substring(0, 8)}`
      })),
      agent_interactions: Array(Math.floor(Math.random() * 3) + 1).fill(null).map(() => ({
        agent_name: `agent-${Math.floor(Math.random() * 10)}`,
        interaction_type: 'command_execution',
        input_tokens: Math.floor(Math.random() * 500) + 100,
        output_tokens: Math.floor(Math.random() * 800) + 200,
        cost_estimate: Math.random() * 0.01
      }))
    };
  }

  private generateBatchMetricsPayload(): any {
    return {
      batch_id: randomUUID(),
      items: Array(Math.floor(Math.random() * 20) + 10).fill(null).map(() => this.generateMetricsPayload())
    };
  }

  private generateLargeLogData(): any {
    return {
      traceData: 'x'.repeat(500), // Large trace data
      context: {
        nested: {
          data: Array(10).fill(null).map((_, i) => ({
            index: i,
            value: randomUUID(),
            metadata: 'meta'.repeat(20)
          }))
        }
      },
      stackTrace: Array(15).fill(null).map((_, i) => `frame_${i}_${randomUUID()}`)
    };
  }

  private startResourceMonitoring(): void {
    let memoryMeasurements: number[] = [];
    let gcCount = 0;
    
    // Monitor GC events
    const gcObserver = new (require('perf_hooks')).PerformanceObserver((list: any) => {
      gcCount += list.getEntries().length;
    });
    
    try {
      gcObserver.observe({ entryTypes: ['gc'] });
    } catch (e) {
      // GC monitoring not available
    }

    this.resourceMonitor = setInterval(() => {
      const memUsage = process.memoryUsage();
      const memMB = memUsage.heapUsed / 1024 / 1024;
      
      memoryMeasurements.push(memMB);
      this.metrics.resources.peakMemoryMB = Math.max(this.metrics.resources.peakMemoryMB, memMB);
      this.metrics.resources.averageMemoryMB = memoryMeasurements.reduce((sum, val) => sum + val, 0) / memoryMeasurements.length;
      this.metrics.resources.gcCollections = gcCount;
    }, 1000);
  }

  private startLoggingMonitoring(): void {
    this.logMetricsMonitor = setInterval(async () => {
      // This would monitor logging-specific metrics
      // For now, we'll track basic metrics that are available
      
      try {
        // Monitor Seq health if available
        const { getSeqHealth, getSeqMetrics } = await import('../../config/logger');
        
        const seqHealth = await getSeqHealth();
        const seqMetrics = getSeqMetrics();
        
        if (seqHealth.status === 'degraded' || seqHealth.status === 'unhealthy') {
          this.metrics.logging.seqHealthDegradations++;
        }
        
        if (seqMetrics) {
          this.metrics.logging.logsGenerated += seqMetrics.totalLogs || 0;
          this.metrics.logging.logErrors += seqMetrics.failedLogs || 0;
          
          if (seqMetrics.circuitBreakerOpen) {
            this.metrics.logging.circuitBreakerActivations++;
          }
        }
        
      } catch (error) {
        // Logging metrics not available
      }
    }, 5000);
  }

  private stopMonitoring(): void {
    if (this.resourceMonitor) {
      clearInterval(this.resourceMonitor);
      this.resourceMonitor = null;
    }
    
    if (this.logMetricsMonitor) {
      clearInterval(this.logMetricsMonitor);
      this.logMetricsMonitor = null;
    }
  }

  private calculateFinalMetrics(): void {
    const duration = (performance.now() - this.startTime) / 1000;
    this.metrics.overview.testDuration = duration;
    this.metrics.overview.averageRPS = this.metrics.overview.totalRequests / duration;
    this.metrics.overview.errorRate = this.metrics.overview.failedRequests / this.metrics.overview.totalRequests;
  }

  async runAllLoadTests(): Promise<Record<string, LoadTestMetrics>> {
    const results: Record<string, LoadTestMetrics> = {};
    
    console.log('🔥 Running comprehensive load test suite...');
    
    for (const config of this.loadTestConfigs) {
      console.log(`\n📊 Starting ${config.name}...`);
      
      try {
        const metrics = await this.runLoadTest(config.name);
        results[config.name] = metrics;
        
        console.log(`✅ ${config.name} completed:`);
        console.log(`  - Requests: ${metrics.overview.totalRequests}`);
        console.log(`  - RPS: ${metrics.overview.averageRPS.toFixed(1)}`);
        console.log(`  - Error Rate: ${(metrics.overview.errorRate * 100).toFixed(2)}%`);
        console.log(`  - P95 Latency: ${metrics.latency.p95.toFixed(2)}ms`);
        
        // Recovery time between tests
        console.log('  ⏳ Recovery period...');
        await new Promise(resolve => setTimeout(resolve, 30000)); // 30 second recovery
        
      } catch (error) {
        console.error(`❌ ${config.name} failed:`, error);
        results[config.name] = this.metrics; // Save partial results
      }
    }
    
    return results;
  }

  detectRegressions(baseline: LoadTestMetrics, current: LoadTestMetrics): {
    hasRegressions: boolean;
    regressions: string[];
    improvements: string[];
  } {
    const regressions: string[] = [];
    const improvements: string[] = [];

    // Check latency regression
    const latencyIncrease = ((current.latency.p95 - baseline.latency.p95) / baseline.latency.p95) * 100;
    if (latencyIncrease > this.regressionThresholds.latencyIncrease) {
      regressions.push(`P95 latency increased by ${latencyIncrease.toFixed(1)}% (threshold: ${this.regressionThresholds.latencyIncrease}%)`);
    } else if (latencyIncrease < -5) {
      improvements.push(`P95 latency improved by ${Math.abs(latencyIncrease).toFixed(1)}%`);
    }

    // Check error rate regression
    const errorRateIncrease = ((current.overview.errorRate - baseline.overview.errorRate) / baseline.overview.errorRate) * 100;
    if (errorRateIncrease > this.regressionThresholds.errorRateIncrease) {
      regressions.push(`Error rate increased by ${errorRateIncrease.toFixed(1)}% (threshold: ${this.regressionThresholds.errorRateIncrease}%)`);
    }

    // Check memory regression
    const memoryIncrease = current.resources.peakMemoryMB - baseline.resources.peakMemoryMB;
    if (memoryIncrease > this.regressionThresholds.memoryIncrease) {
      regressions.push(`Memory usage increased by ${memoryIncrease.toFixed(1)}MB (threshold: ${this.regressionThresholds.memoryIncrease}MB)`);
    }

    // Check throughput regression
    const throughputDecrease = ((baseline.overview.averageRPS - current.overview.averageRPS) / baseline.overview.averageRPS) * 100;
    if (throughputDecrease > this.regressionThresholds.throughputDecrease) {
      regressions.push(`Throughput decreased by ${throughputDecrease.toFixed(1)}% (threshold: ${this.regressionThresholds.throughputDecrease}%)`);
    }

    return {
      hasRegressions: regressions.length > 0,
      regressions,
      improvements
    };
  }

  generateLoadTestReport(results: Record<string, LoadTestMetrics>): string {
    const report = Object.entries(results).map(([testName, metrics]) => {
      return `
## ${testName.replace(/_/g, ' ').toUpperCase()}

### Overview
- **Total Requests**: ${metrics.overview.totalRequests.toLocaleString()}
- **Success Rate**: ${((1 - metrics.overview.errorRate) * 100).toFixed(2)}%
- **Average RPS**: ${metrics.overview.averageRPS.toFixed(1)}
- **Test Duration**: ${metrics.overview.testDuration.toFixed(1)}s

### Latency Distribution
- **Average**: ${metrics.latency.average.toFixed(2)}ms
- **P95**: ${metrics.latency.p95.toFixed(2)}ms
- **P99**: ${metrics.latency.p99.toFixed(2)}ms
- **Max**: ${metrics.latency.max.toFixed(2)}ms

### Resource Usage
- **Peak Memory**: ${metrics.resources.peakMemoryMB.toFixed(1)}MB
- **Memory Growth**: ${metrics.resources.memoryGrowthMB.toFixed(1)}MB
- **GC Collections**: ${metrics.resources.gcCollections}

### Logging Performance
- **Logs Generated**: ${metrics.logging.logsGenerated.toLocaleString()}
- **Log Errors**: ${metrics.logging.logErrors}
- **Seq Health Issues**: ${metrics.logging.seqHealthDegradations}
- **Circuit Breaker Activations**: ${metrics.logging.circuitBreakerActivations}

### Endpoint Performance
${Object.entries(metrics.endpoints).map(([endpoint, data]) => `
- **${endpoint}**:
  - Requests: ${data.requests.toLocaleString()}
  - Avg Latency: ${data.averageLatency.toFixed(2)}ms
  - P95 Latency: ${data.p95Latency.toFixed(2)}ms
  - Error Rate: ${(data.errorRate * 100).toFixed(2)}%`).join('')}

---
`;
    }).join('\n');

    return `# Load Test Results Report

Generated on ${new Date().toISOString()}
Node.js Version: ${process.version}
Platform: ${process.platform} ${process.arch}

${report}

## Summary

This comprehensive load testing suite validates the performance characteristics of the monitoring web service under various load conditions. The results establish performance baselines for regression testing during the Seq to OpenTelemetry migration.

### Key Performance Indicators

${Object.entries(results).map(([testName, metrics]) => `
**${testName}**:
- RPS: ${metrics.overview.averageRPS.toFixed(1)}
- P95 Latency: ${metrics.latency.p95.toFixed(1)}ms
- Error Rate: ${(metrics.overview.errorRate * 100).toFixed(2)}%
- Memory: ${metrics.resources.peakMemoryMB.toFixed(1)}MB`).join('')}

## Regression Detection

Use the \`detectRegressions\` method to compare these baseline results with post-migration performance to identify any performance regressions.
`;
  }

  async saveResults(results: Record<string, LoadTestMetrics>, outputPath: string): Promise<void> {
    const data = {
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      results,
      thresholds: this.regressionThresholds
    };

    await fs.writeFile(outputPath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`📁 Results saved to ${outputPath}`);
  }

  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up load testing framework...');
    
    this.stopMonitoring();
    
    if (this.server) {
      this.server.close();
    }
    
    console.log('✅ Cleanup complete');
  }
}

export { LoadTestingFramework, LoadTestMetrics, LoadTestConfig, RegressionThresholds };

// Standalone execution
if (require.main === module) {
  async function runLoadTestSuite() {
    const framework = new LoadTestingFramework();
    
    try {
      await framework.initialize();
      
      // Run all load tests
      const results = await framework.runAllLoadTests();
      
      // Generate report
      const report = framework.generateLoadTestReport(results);
      console.log('\n' + report);
      
      // Save results
      const outputPath = path.join(__dirname, '../../..', 'test-results', `load-test-results-${Date.now()}.json`);
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await framework.saveResults(results, outputPath);
      
      // Determine overall success
      const hasFailures = Object.values(results).some(metrics => 
        metrics.overview.errorRate > 0.05 || // 5% error rate threshold
        metrics.latency.p95 > 5000 // 5 second P95 threshold
      );
      
      process.exit(hasFailures ? 1 : 0);
      
    } catch (error) {
      console.error('❌ Load test suite failed:', error);
      process.exit(1);
    } finally {
      await framework.cleanup();
    }
  }

  runLoadTestSuite().catch(console.error);
}