#!/usr/bin/env tsx
/**
 * Auto-instrumentation Validation Script
 * Task 2.2: Auto-instrumentation Implementation - Validation and Testing
 * 
 * Comprehensive testing script for validating auto-instrumentation functionality
 * including performance impact measurement and trace propagation validation.
 */

import fetch from 'node-fetch';
import { performance } from 'perf_hooks';

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const OTEL_VALIDATION_ENDPOINT = `${API_BASE_URL}/api/v1/otel`;
const PERFORMANCE_ENDPOINT = `${API_BASE_URL}/otel/performance`;
const HEALTH_ENDPOINT = `${API_BASE_URL}/health`;

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  duration: number;
  message: string;
  details?: any;
  error?: string;
}

interface ValidationSummary {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  overallSuccess: boolean;
  totalDuration: number;
  performanceImpact: string;
}

/**
 * Test runner class for auto-instrumentation validation
 */
class AutoInstrumentationTester {
  private results: TestResult[] = [];
  private startTime: number = 0;

  constructor() {
    this.startTime = performance.now();
  }

  /**
   * Run a test with timing and error handling
   */
  private async runTest(
    name: string,
    testFn: () => Promise<{ success: boolean; message: string; details?: any }>
  ): Promise<TestResult> {
    const testStartTime = performance.now();
    
    try {
      const result = await testFn();
      const duration = performance.now() - testStartTime;
      
      return {
        name,
        status: result.success ? 'PASS' : 'FAIL',
        duration,
        message: result.message,
        details: result.details
      };
    } catch (error) {
      const duration = performance.now() - testStartTime;
      
      return {
        name,
        status: 'FAIL',
        duration,
        message: 'Test execution failed',
        error: (error as Error).message
      };
    }
  }

  /**
   * Test 1: Basic health check and service availability
   */
  private async testServiceHealth(): Promise<{ success: boolean; message: string; details?: any }> {
    const response = await fetch(HEALTH_ENDPOINT, {
      timeout: 5000
    });

    if (!response.ok) {
      return {
        success: false,
        message: `Health check failed with status ${response.status}`
      };
    }

    const healthData = await response.json();
    
    return {
      success: true,
      message: 'Service health check passed',
      details: {
        status: healthData.status,
        environment: healthData.environment,
        uptime: healthData.uptime
      }
    };
  }

  /**
   * Test 2: Basic trace generation
   */
  private async testBasicTrace(): Promise<{ success: boolean; message: string; details?: any }> {
    const response = await fetch(`${OTEL_VALIDATION_ENDPOINT}/trace/basic`, {
      timeout: 10000
    });

    if (!response.ok) {
      return {
        success: false,
        message: `Basic trace test failed with status ${response.status}`
      };
    }

    const data = await response.json();
    
    if (!data.traceId || !data.spanId) {
      return {
        success: false,
        message: 'Trace ID or Span ID not found in response'
      };
    }

    return {
      success: true,
      message: 'Basic trace generation successful',
      details: {
        traceId: data.traceId,
        spanId: data.spanId,
        timestamp: data.timestamp
      }
    };
  }

  /**
   * Test 3: Nested spans and context propagation
   */
  private async testNestedSpans(): Promise<{ success: boolean; message: string; details?: any }> {
    const response = await fetch(`${OTEL_VALIDATION_ENDPOINT}/trace/nested`, {
      timeout: 10000
    });

    if (!response.ok) {
      return {
        success: false,
        message: `Nested spans test failed with status ${response.status}`
      };
    }

    const data = await response.json();
    
    if (!data.spanCount || data.spanCount < 3) {
      return {
        success: false,
        message: 'Expected at least 3 spans in nested test'
      };
    }

    return {
      success: true,
      message: 'Nested spans and context propagation successful',
      details: {
        spanCount: data.spanCount,
        hierarchy: data.hierarchy
      }
    };
  }

  /**
   * Test 4: Database instrumentation
   */
  private async testDatabaseInstrumentation(): Promise<{ success: boolean; message: string; details?: any }> {
    const response = await fetch(`${OTEL_VALIDATION_ENDPOINT}/trace/database`, {
      timeout: 15000
    });

    if (!response.ok) {
      return {
        success: false,
        message: `Database instrumentation test failed with status ${response.status}`
      };
    }

    const data = await response.json();
    
    if (!data.operations || data.operations.length === 0) {
      return {
        success: false,
        message: 'No database operations recorded'
      };
    }

    return {
      success: true,
      message: 'Database instrumentation successful',
      details: {
        operationCount: data.operations.length,
        operations: data.operations
      }
    };
  }

  /**
   * Test 5: HTTP client instrumentation
   */
  private async testHttpClientInstrumentation(): Promise<{ success: boolean; message: string; details?: any }> {
    const response = await fetch(`${OTEL_VALIDATION_ENDPOINT}/trace/http-client`, {
      timeout: 15000
    });

    if (!response.ok) {
      return {
        success: false,
        message: `HTTP client instrumentation test failed with status ${response.status}`
      };
    }

    const data = await response.json();
    
    if (!data.externalCalls || data.externalCalls.length === 0) {
      return {
        success: false,
        message: 'No external HTTP calls recorded'
      };
    }

    const successfulCalls = data.externalCalls.filter((call: any) => call.success);
    
    return {
      success: successfulCalls.length > 0,
      message: `HTTP client instrumentation ${successfulCalls.length > 0 ? 'successful' : 'failed'}`,
      details: {
        totalCalls: data.externalCalls.length,
        successfulCalls: successfulCalls.length,
        calls: data.externalCalls
      }
    };
  }

  /**
   * Test 6: Error handling and exception recording
   */
  private async testErrorHandling(): Promise<{ success: boolean; message: string; details?: any }> {
    const errorTypes = ['generic', 'timeout', 'validation', 'database'];
    const results = [];

    for (const errorType of errorTypes) {
      const response = await fetch(`${OTEL_VALIDATION_ENDPOINT}/trace/error?type=${errorType}`, {
        timeout: 10000
      });

      if (response.ok) {
        const data = await response.json();
        results.push({
          errorType,
          success: true,
          traceId: data.traceId
        });
      } else {
        results.push({
          errorType,
          success: false,
          status: response.status
        });
      }
    }

    const successfulTests = results.filter(r => r.success).length;
    
    return {
      success: successfulTests === errorTypes.length,
      message: `Error handling test: ${successfulTests}/${errorTypes.length} error types handled`,
      details: results
    };
  }

  /**
   * Test 7: Performance impact measurement
   */
  private async testPerformanceImpact(): Promise<{ success: boolean; message: string; details?: any }> {
    // Reset performance metrics first
    await fetch(`${OTEL_VALIDATION_ENDPOINT}/performance/reset`, {
      method: 'POST',
      timeout: 5000
    });

    // Run performance test
    const response = await fetch(`${OTEL_VALIDATION_ENDPOINT}/trace/performance?iterations=50&delay=10`, {
      timeout: 30000
    });

    if (!response.ok) {
      return {
        success: false,
        message: `Performance test failed with status ${response.status}`
      };
    }

    // Get performance metrics
    const metricsResponse = await fetch(`${PERFORMANCE_ENDPOINT}`, {
      timeout: 5000
    });

    if (!metricsResponse.ok) {
      return {
        success: false,
        message: 'Failed to retrieve performance metrics'
      };
    }

    const metrics = await metricsResponse.json();
    const overheadPercentage = parseFloat(metrics.performance.instrumentation.impactPercentage.replace('%', ''));
    
    // Performance is considered good if overhead is less than 5%
    const performanceGood = overheadPercentage < 5.0;
    
    return {
      success: performanceGood,
      message: `Performance impact: ${metrics.performance.instrumentation.impactPercentage} (${performanceGood ? 'GOOD' : 'HIGH'})`,
      details: {
        overheadPercentage,
        averageLatency: metrics.performance.latency.average,
        instrumentationOverhead: metrics.performance.instrumentation.averageOverhead,
        classification: metrics.performance.summary.performanceImpact,
        totalRequests: metrics.performance.summary.totalRequests
      }
    };
  }

  /**
   * Test 8: Comprehensive validation
   */
  private async testComprehensiveValidation(): Promise<{ success: boolean; message: string; details?: any }> {
    const response = await fetch(`${OTEL_VALIDATION_ENDPOINT}/validate/comprehensive`, {
      timeout: 20000
    });

    if (!response.ok) {
      return {
        success: false,
        message: `Comprehensive validation failed with status ${response.status}`
      };
    }

    const data = await response.json();
    
    return {
      success: data.summary.overallSuccess,
      message: `Comprehensive validation: ${data.summary.successRate} success rate`,
      details: {
        totalTests: data.summary.totalTests,
        passedTests: data.summary.passedTests,
        successRate: data.summary.successRate,
        results: data.results
      }
    };
  }

  /**
   * Run all validation tests
   */
  public async runAllTests(): Promise<ValidationSummary> {
    console.log('\n🧪 Starting Auto-instrumentation Validation Tests\n');
    console.log('='.repeat(60));

    // Define test suite
    const tests = [
      { name: 'Service Health Check', fn: () => this.testServiceHealth() },
      { name: 'Basic Trace Generation', fn: () => this.testBasicTrace() },
      { name: 'Nested Spans & Context Propagation', fn: () => this.testNestedSpans() },
      { name: 'Database Instrumentation', fn: () => this.testDatabaseInstrumentation() },
      { name: 'HTTP Client Instrumentation', fn: () => this.testHttpClientInstrumentation() },
      { name: 'Error Handling & Exception Recording', fn: () => this.testErrorHandling() },
      { name: 'Performance Impact Measurement', fn: () => this.testPerformanceImpact() },
      { name: 'Comprehensive Validation', fn: () => this.testComprehensiveValidation() }
    ];

    // Run tests
    for (const test of tests) {
      console.log(`\n🧪 Running: ${test.name}`);
      const result = await this.runTest(test.name, test.fn);
      this.results.push(result);
      
      const statusEmoji = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
      console.log(`${statusEmoji} ${result.status}: ${result.message} (${Math.round(result.duration)}ms)`);
      
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      
      if (result.details && result.status === 'PASS') {
        console.log(`   Details: ${JSON.stringify(result.details, null, 2).slice(0, 200)}...`);
      }
    }

    // Calculate summary
    const totalDuration = performance.now() - this.startTime;
    const passedTests = this.results.filter(r => r.status === 'PASS').length;
    const failedTests = this.results.filter(r => r.status === 'FAIL').length;
    const skippedTests = this.results.filter(r => r.status === 'SKIP').length;
    const overallSuccess = failedTests === 0;

    // Get performance impact classification
    const performanceResult = this.results.find(r => r.name === 'Performance Impact Measurement');
    const performanceImpact = performanceResult?.details?.classification || 'unknown';

    const summary: ValidationSummary = {
      totalTests: this.results.length,
      passedTests,
      failedTests,
      skippedTests,
      overallSuccess,
      totalDuration,
      performanceImpact
    };

    this.printSummary(summary);
    return summary;
  }

  /**
   * Print test summary
   */
  private printSummary(summary: ValidationSummary): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 AUTO-INSTRUMENTATION VALIDATION SUMMARY');
    console.log('='.repeat(60));
    
    console.log(`\n📋 Test Results:`);
    console.log(`   Total Tests: ${summary.totalTests}`);
    console.log(`   ✅ Passed: ${summary.passedTests}`);
    console.log(`   ❌ Failed: ${summary.failedTests}`);
    console.log(`   ⏭️  Skipped: ${summary.skippedTests}`);
    
    const successRate = (summary.passedTests / summary.totalTests) * 100;
    console.log(`   📈 Success Rate: ${Math.round(successRate)}%`);
    
    console.log(`\n⏱️  Performance:`);
    console.log(`   Total Duration: ${Math.round(summary.totalDuration)}ms`);
    console.log(`   Performance Impact: ${summary.performanceImpact}`);
    
    console.log(`\n🎯 Overall Status: ${summary.overallSuccess ? '✅ SUCCESS' : '❌ FAILURE'}`);
    
    if (!summary.overallSuccess) {
      console.log('\n❌ Failed Tests:');
      this.results
        .filter(r => r.status === 'FAIL')
        .forEach(result => {
          console.log(`   - ${result.name}: ${result.message}`);
          if (result.error) {
            console.log(`     Error: ${result.error}`);
          }
        });
    }

    console.log('\n💡 Recommendations:');
    if (summary.overallSuccess) {
      console.log('   - Auto-instrumentation is working correctly');
      console.log('   - Performance impact is within acceptable limits');
      console.log('   - Ready for production deployment');
    } else {
      console.log('   - Review failed tests and fix issues');
      console.log('   - Check OpenTelemetry configuration');
      console.log('   - Verify SignOz collector connectivity');
    }

    if (summary.performanceImpact === 'high') {
      console.log('   - Consider disabling some instrumentations');
      console.log('   - Review feature flags configuration');
      console.log('   - Optimize sampling rates');
    }
    
    console.log('\n' + '='.repeat(60));
  }
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  try {
    const tester = new AutoInstrumentationTester();
    const summary = await tester.runAllTests();
    
    // Exit with appropriate code
    process.exit(summary.overallSuccess ? 0 : 1);
    
  } catch (error) {
    console.error('\n❌ Validation script failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { AutoInstrumentationTester, ValidationSummary, TestResult };