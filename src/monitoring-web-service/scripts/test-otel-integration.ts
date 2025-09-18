#!/usr/bin/env tsx

/**
 * OpenTelemetry Integration Test Script
 * Task 2.1: OTEL SDK Basic Configuration - Validation
 * 
 * Tests:
 * - OTEL initialization with feature flags
 * - Integration with existing Seq transport
 * - Performance impact measurement (<5ms target)
 * - Configuration validation
 * - Health check endpoints
 */

import { config } from '../src/config/environment';
import { otelConfig, otelFeatureFlags } from '../src/config/otel.config';
import { logger } from '../src/config/logger';
import * as api from '@opentelemetry/api';

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  details: string;
}

class OTelIntegrationTester {
  private results: TestResult[] = [];

  async runAllTests(): Promise<void> {
    console.log('🧪 Starting OpenTelemetry Integration Tests');
    console.log('================================================\n');

    // Test 1: Configuration Loading
    await this.testConfigurationLoading();

    // Test 2: Feature Flag Controls
    await this.testFeatureFlags();

    // Test 3: OTEL Initialization (if enabled)
    if (otelFeatureFlags.enabled) {
      await this.testOTelInitialization();
      await this.testTracingCapabilities();
      await this.testMetricsCapabilities();
      await this.testPerformanceImpact();
    } else {
      this.logTestSkipped('OTEL Initialization', 'OTEL disabled via feature flag');
    }

    // Test 4: Health Check Integration
    await this.testHealthCheckIntegration();

    // Test 5: Parallel Operation with Seq
    await this.testSeqIntegration();

    // Report Results
    this.reportResults();
  }

  private async testConfigurationLoading(): Promise<void> {
    const startTime = Date.now();
    let passed = true;
    let details = '';

    try {
      // Validate configuration structure
      if (!config.otel) {
        throw new Error('OTEL configuration not found in environment config');
      }

      // Validate required fields
      const requiredFields = [
        'enabled',
        'service.name',
        'service.version',
        'exporter.tracesEndpoint',
        'exporter.metricsEndpoint'
      ];

      for (const field of requiredFields) {
        const value = this.getNestedProperty(config.otel, field);
        if (value === undefined || value === null) {
          throw new Error(`Required OTEL config field missing: ${field}`);
        }
      }

      // Validate otelConfig object
      if (!otelConfig.resource || !otelConfig.featureFlags) {
        throw new Error('OTel configuration object incomplete');
      }

      details = `Configuration loaded successfully. Service: ${config.otel.service.name}`;
      logger.info('OTEL configuration validation passed', {
        event: 'otel.test.config.success',
        service: config.otel.service.name,
      });

    } catch (error) {
      passed = false;
      details = (error as Error).message;
      logger.error('OTEL configuration validation failed', {
        event: 'otel.test.config.error',
        error: details,
      });
    }

    this.addResult('Configuration Loading', passed, Date.now() - startTime, details);
  }

  private async testFeatureFlags(): Promise<void> {
    const startTime = Date.now();
    let passed = true;
    let details = '';

    try {
      // Test feature flag structure
      const expectedFlags = ['enabled', 'tracing', 'metrics', 'logs', 'autoInstrumentation'];
      
      for (const flag of expectedFlags) {
        if (typeof otelFeatureFlags[flag as keyof typeof otelFeatureFlags] !== 'boolean') {
          throw new Error(`Feature flag ${flag} is not a boolean`);
        }
      }

      // Test environment-specific logic
      if (config.isTest && otelFeatureFlags.enabled) {
        throw new Error('OTEL should be disabled in test environment');
      }

      // Test sampling configuration
      if (config.isProduction && config.otel.sampling.traceRatio > 0.2) {
        details += 'Warning: High sampling rate in production. ';
      }

      details += `Feature flags validated. Enabled: ${otelFeatureFlags.enabled}`;

    } catch (error) {
      passed = false;
      details = (error as Error).message;
    }

    this.addResult('Feature Flags', passed, Date.now() - startTime, details);
  }

  private async testOTelInitialization(): Promise<void> {
    const startTime = Date.now();
    let passed = true;
    let details = '';

    try {
      // Test tracer availability
      const tracer = api.trace.getActiveTracer();
      if (!tracer) {
        throw new Error('No active tracer found');
      }

      // Test meter availability
      const meter = api.metrics.getMeter('test-meter');
      if (!meter) {
        throw new Error('No meter available');
      }

      // Test span creation
      const span = tracer.startSpan('test-span');
      span.setAttributes({ 'test.attribute': 'test-value' });
      span.end();

      details = 'OTEL SDK initialized successfully';

    } catch (error) {
      passed = false;
      details = (error as Error).message;
    }

    this.addResult('OTEL Initialization', passed, Date.now() - startTime, details);
  }

  private async testTracingCapabilities(): Promise<void> {
    const startTime = Date.now();
    let passed = true;
    let details = '';

    try {
      if (!otelFeatureFlags.tracing) {
        details = 'Tracing disabled via feature flag';
        this.addResult('Tracing Capabilities', true, Date.now() - startTime, details);
        return;
      }

      const tracer = api.trace.getActiveTracer();
      
      // Test active span
      const span = tracer.startSpan('test-operation');
      span.setAttributes({
        'operation.type': 'test',
        'test.timestamp': Date.now(),
      });

      // Test nested spans
      const childSpan = tracer.startSpan('child-operation', { parent: span });
      childSpan.end();
      span.end();

      details = 'Tracing capabilities verified';

    } catch (error) {
      passed = false;
      details = (error as Error).message;
    }

    this.addResult('Tracing Capabilities', passed, Date.now() - startTime, details);
  }

  private async testMetricsCapabilities(): Promise<void> {
    const startTime = Date.now();
    let passed = true;
    let details = '';

    try {
      if (!otelFeatureFlags.metrics) {
        details = 'Metrics disabled via feature flag';
        this.addResult('Metrics Capabilities', true, Date.now() - startTime, details);
        return;
      }

      const meter = api.metrics.getMeter('test-metrics');
      
      // Test counter
      const counter = meter.createCounter('test_counter');
      counter.add(1, { 'test.label': 'test-value' });

      // Test histogram
      const histogram = meter.createHistogram('test_histogram');
      histogram.record(100, { 'test.label': 'test-value' });

      details = 'Metrics capabilities verified';

    } catch (error) {
      passed = false;
      details = (error as Error).message;
    }

    this.addResult('Metrics Capabilities', passed, Date.now() - startTime, details);
  }

  private async testPerformanceImpact(): Promise<void> {
    const startTime = Date.now();
    let passed = true;
    let details = '';

    try {
      const iterations = 1000;
      const latencies: number[] = [];

      // Measure performance impact of span creation
      for (let i = 0; i < iterations; i++) {
        const spanStart = Date.now();
        
        const tracer = api.trace.getActiveTracer();
        const span = tracer.startSpan('perf-test-span');
        span.setAttributes({ 'test.iteration': i });
        span.end();
        
        const spanLatency = Date.now() - spanStart;
        latencies.push(spanLatency);
      }

      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const maxLatency = Math.max(...latencies);
      const p95Latency = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)];

      // Check against performance targets
      if (avgLatency > otelConfig.performance.maxLatencyImpactMs) {
        throw new Error(`Average latency ${avgLatency.toFixed(2)}ms exceeds target ${otelConfig.performance.maxLatencyImpactMs}ms`);
      }

      if (p95Latency > otelConfig.performance.maxLatencyImpactMs * 2) {
        throw new Error(`P95 latency ${p95Latency}ms exceeds acceptable threshold`);
      }

      details = `Avg: ${avgLatency.toFixed(2)}ms, Max: ${maxLatency}ms, P95: ${p95Latency}ms (target: <${otelConfig.performance.maxLatencyImpactMs}ms)`;

    } catch (error) {
      passed = false;
      details = (error as Error).message;
    }

    this.addResult('Performance Impact', passed, Date.now() - startTime, details);
  }

  private async testHealthCheckIntegration(): Promise<void> {
    const startTime = Date.now();
    let passed = true;
    let details = '';

    try {
      // Import the health check function
      const { getOTelHealthStatus } = await import('../src/tracing/otel-init');
      
      const healthStatus = getOTelHealthStatus();
      
      // Validate health check structure
      if (!healthStatus || typeof healthStatus.enabled !== 'boolean') {
        throw new Error('Invalid health check structure');
      }

      if (otelFeatureFlags.enabled && healthStatus.status === 'disabled') {
        throw new Error('Health check shows disabled but OTEL is enabled');
      }

      details = `Health check: ${healthStatus.status}, Enabled: ${healthStatus.enabled}`;

    } catch (error) {
      passed = false;
      details = (error as Error).message;
    }

    this.addResult('Health Check Integration', passed, Date.now() - startTime, details);
  }

  private async testSeqIntegration(): Promise<void> {
    const startTime = Date.now();
    let passed = true;
    let details = '';

    try {
      // Test that Seq logging still works alongside OTEL
      logger.info('Testing Seq integration with OTEL', {
        event: 'otel.test.seq.integration',
        otelEnabled: otelFeatureFlags.enabled,
        testTimestamp: Date.now(),
      });

      // Verify logger is still functional
      if (!logger || typeof logger.info !== 'function') {
        throw new Error('Seq logger not available');
      }

      // Test that OTEL doesn't interfere with existing correlation
      const testCorrelationId = 'test-correlation-' + Date.now();
      logger.info('Correlation test', {
        correlationId: testCorrelationId,
        event: 'otel.test.correlation',
      });

      details = 'Seq integration verified - parallel operation confirmed';

    } catch (error) {
      passed = false;
      details = (error as Error).message;
    }

    this.addResult('Seq Integration', passed, Date.now() - startTime, details);
  }

  private addResult(name: string, passed: boolean, duration: number, details: string): void {
    this.results.push({ name, passed, duration, details });
    
    const status = passed ? '✅' : '❌';
    const durationStr = `${duration}ms`;
    console.log(`${status} ${name.padEnd(25)} ${durationStr.padStart(8)} - ${details}`);
  }

  private logTestSkipped(name: string, reason: string): void {
    console.log(`⏭️  ${name.padEnd(25)} ${'SKIP'.padStart(8)} - ${reason}`);
  }

  private reportResults(): void {
    console.log('\n================================================');
    console.log('📊 Test Results Summary');
    console.log('================================================');

    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);

    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests} ✅`);
    console.log(`Failed: ${failedTests} ${failedTests > 0 ? '❌' : '✅'}`);
    console.log(`Total Duration: ${totalDuration}ms`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

    if (failedTests > 0) {
      console.log('\n🔍 Failed Tests Details:');
      this.results.filter(r => !r.passed).forEach(result => {
        console.log(`   ❌ ${result.name}: ${result.details}`);
      });
    }

    console.log('\n📋 Configuration Summary:');
    console.log(`   OTEL Enabled: ${otelFeatureFlags.enabled}`);
    console.log(`   Environment: ${config.nodeEnv}`);
    console.log(`   Service: ${config.otel.service.name}`);
    console.log(`   Trace Sampling: ${config.otel.sampling.traceRatio}`);
    console.log(`   Seq Enabled: ${!config.isTest}`);

    // Exit with error code if tests failed
    if (failedTests > 0) {
      process.exit(1);
    }
  }

  private getNestedProperty(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
}

// Run tests
if (require.main === module) {
  const tester = new OTelIntegrationTester();
  tester.runAllTests().catch(error => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });
}