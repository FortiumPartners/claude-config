/**
 * OpenTelemetry Correlation Performance Benchmarks
 * Fortium Monitoring Web Service - Sprint 2: OpenTelemetry Migration
 * Task 2.4: Correlation Middleware Replacement with OTEL Context
 * 
 * Performance comparison between legacy and OTEL correlation middleware
 */

import { Request, Response, NextFunction } from 'express';
import { performance } from 'perf_hooks';
import * as api from '@opentelemetry/api';

// Import middleware implementations
import { correlationMiddleware as legacyCorrelationMiddleware } from '../../middleware/correlation.middleware';
import { otelCorrelationMiddleware } from '../../middleware/otel-correlation.middleware';
import { createMigrationMiddleware } from '../../utils/otel-migration';

// Mock OTEL for consistent testing
const createMockOTEL = () => {
  const mockSpan = {
    spanContext: () => ({
      traceId: 'benchmark-trace-id-123456789',
      spanId: 'benchmark-span-id-987654321',
      traceFlags: 1,
    }),
    setAttributes: jest.fn(),
    setStatus: jest.fn(),
    addEvent: jest.fn(),
    recordException: jest.fn(),
    end: jest.fn(),
    isRecording: () => true,
  };

  const mockTracer = {
    startSpan: jest.fn(() => mockSpan),
    startActiveSpan: jest.fn((name, options, callback) => callback(mockSpan)),
  };

  (api.trace.getActiveSpan as jest.Mock) = jest.fn(() => mockSpan);
  (api.trace.getTracer as jest.Mock) = jest.fn(() => mockTracer);
  (api.context.active as jest.Mock) = jest.fn(() => ({}));
  (api.context.with as jest.Mock) = jest.fn((ctx, callback) => callback());

  return { mockSpan, mockTracer };
};

// Mock logger to reduce I/O overhead in benchmarks
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  log: jest.fn(),
  child: jest.fn(() => mockLogger),
};

jest.mock('../../config/logger', () => ({
  createContextualLogger: jest.fn(() => mockLogger),
  logger: mockLogger,
}));

interface BenchmarkResult {
  name: string;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  totalDuration: number;
  operations: number;
  opsPerSecond: number;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
}

class MiddlewareBenchmark {
  private results: BenchmarkResult[] = [];

  async runBenchmark(
    name: string,
    middleware: (req: Request, res: Response, next: NextFunction) => void,
    iterations: number = 10000
  ): Promise<BenchmarkResult> {
    console.log(`\n🚀 Running benchmark: ${name} (${iterations} iterations)`);
    
    // Warm up
    await this.runIterations(middleware, Math.min(100, iterations / 10));
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    const initialMemory = process.memoryUsage();
    const durations: number[] = [];
    
    const startTime = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      const iterationStart = performance.now();
      await this.runSingleIteration(middleware);
      const iterationEnd = performance.now();
      durations.push(iterationEnd - iterationStart);
      
      // Periodic progress update
      if (i > 0 && i % 1000 === 0) {
        process.stdout.write(`\r  Progress: ${i}/${iterations} (${((i / iterations) * 100).toFixed(1)}%)`);
      }
    }
    
    const endTime = performance.now();
    const totalDuration = endTime - startTime;
    
    process.stdout.write(`\r  Completed: ${iterations}/${iterations} (100.0%)\n`);
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    const finalMemory = process.memoryUsage();
    
    const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const minDuration = Math.min(...durations);
    const maxDuration = Math.max(...durations);
    
    const result: BenchmarkResult = {
      name,
      avgDuration,
      minDuration,
      maxDuration,
      totalDuration,
      operations: iterations,
      opsPerSecond: (iterations / totalDuration) * 1000,
      memoryUsage: {
        heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
        heapTotal: finalMemory.heapTotal - initialMemory.heapTotal,
        external: finalMemory.external - initialMemory.external,
      },
    };
    
    this.results.push(result);
    this.logResult(result);
    
    return result;
  }

  private async runIterations(
    middleware: (req: Request, res: Response, next: NextFunction) => void,
    count: number
  ): Promise<void> {
    for (let i = 0; i < count; i++) {
      await this.runSingleIteration(middleware);
    }
  }

  private async runSingleIteration(
    middleware: (req: Request, res: Response, next: NextFunction) => void
  ): Promise<void> {
    return new Promise((resolve) => {
      const req = this.createMockRequest();
      const res = this.createMockResponse();
      const next = (err?: any) => {
        if (err) {
          console.error('Middleware error:', err);
        }
        resolve();
      };

      middleware(req, res, next);
      
      // Simulate response end
      setImmediate(() => {
        if (res.end) {
          (res.end as any)();
        }
      });
    });
  }

  private createMockRequest(): Request {
    return {
      method: 'GET',
      url: '/api/test',
      path: '/api/test',
      route: { path: '/api/test' },
      headers: {
        'user-agent': 'benchmark-test',
        'content-type': 'application/json',
        'x-session-id': 'session-12345',
      },
      ip: '127.0.0.1',
      body: { test: 'data' },
      query: { param: 'value' },
      params: {},
    } as any;
  }

  private createMockResponse(): Response {
    const headers: Record<string, any> = {};
    
    return {
      setHeader: jest.fn((name: string, value: any) => {
        headers[name] = value;
      }),
      getHeader: jest.fn((name: string) => headers[name]),
      end: jest.fn(function(this: Response) {
        return this;
      }),
      statusCode: 200,
    } as any;
  }

  private logResult(result: BenchmarkResult): void {
    console.log(`
📊 Benchmark Results: ${result.name}
   ⏱️  Average Duration: ${result.avgDuration.toFixed(3)}ms
   ⚡ Min/Max Duration: ${result.minDuration.toFixed(3)}ms / ${result.maxDuration.toFixed(3)}ms
   🔄 Operations/Second: ${result.opsPerSecond.toFixed(0)} ops/s
   📈 Total Time: ${result.totalDuration.toFixed(2)}ms
   💾 Memory Delta: ${(result.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB heap
`);
  }

  getResults(): BenchmarkResult[] {
    return this.results;
  }

  generateComparison(): void {
    if (this.results.length < 2) {
      console.log('❌ Need at least 2 benchmark results for comparison');
      return;
    }

    console.log('\n📊 PERFORMANCE COMPARISON SUMMARY');
    console.log('=' .repeat(80));

    // Sort by average duration (faster first)
    const sortedResults = [...this.results].sort((a, b) => a.avgDuration - b.avgDuration);
    const fastest = sortedResults[0];
    
    console.log(`🏆 Fastest: ${fastest.name} (${fastest.avgDuration.toFixed(3)}ms avg)`);
    console.log('');

    sortedResults.forEach((result, index) => {
      const percentSlower = index === 0 ? 0 : ((result.avgDuration - fastest.avgDuration) / fastest.avgDuration) * 100;
      const memoryMB = result.memoryUsage.heapUsed / 1024 / 1024;
      
      console.log(`${index + 1}. ${result.name}`);
      console.log(`   ⏱️  Duration: ${result.avgDuration.toFixed(3)}ms avg (${percentSlower.toFixed(1)}% slower)`);
      console.log(`   ⚡ Throughput: ${result.opsPerSecond.toFixed(0)} ops/s`);
      console.log(`   💾 Memory: ${memoryMB.toFixed(2)}MB`);
      console.log('');
    });

    // Performance recommendations
    this.generateRecommendations(sortedResults);
  }

  private generateRecommendations(results: BenchmarkResult[]): void {
    console.log('💡 RECOMMENDATIONS');
    console.log('-'.repeat(40));

    const fastest = results[0];
    const slowest = results[results.length - 1];
    
    const performanceDiff = ((slowest.avgDuration - fastest.avgDuration) / fastest.avgDuration) * 100;
    const memoryDiff = (slowest.memoryUsage.heapUsed - fastest.memoryUsage.heapUsed) / 1024 / 1024;

    if (performanceDiff > 20) {
      console.log(`⚠️  Significant performance difference: ${performanceDiff.toFixed(1)}%`);
      console.log(`   Consider optimizing ${slowest.name} implementation`);
    } else if (performanceDiff < 5) {
      console.log(`✅ Performance difference is minimal: ${performanceDiff.toFixed(1)}%`);
      console.log('   Both implementations have similar performance characteristics');
    }

    if (Math.abs(memoryDiff) > 5) {
      console.log(`📈 Memory usage difference: ${memoryDiff.toFixed(2)}MB`);
      if (memoryDiff > 0) {
        console.log(`   ${slowest.name} uses more memory - check for memory leaks`);
      } else {
        console.log(`   ${fastest.name} uses more memory - verify this is expected`);
      }
    } else {
      console.log('✅ Memory usage is comparable between implementations');
    }

    // Throughput analysis
    const throughputDiff = ((fastest.opsPerSecond - slowest.opsPerSecond) / slowest.opsPerSecond) * 100;
    
    if (throughputDiff > 15) {
      console.log(`🚀 Throughput improvement: ${throughputDiff.toFixed(1)}% higher with ${fastest.name}`);
    }

    console.log('\n📋 Migration Readiness Assessment:');
    
    if (performanceDiff < 10 && Math.abs(memoryDiff) < 10) {
      console.log('✅ READY FOR MIGRATION - Performance impact is acceptable');
    } else if (performanceDiff < 25) {
      console.log('⚠️  PROCEED WITH CAUTION - Monitor performance in production');
    } else {
      console.log('❌ OPTIMIZATION NEEDED - Address performance issues before migration');
    }
  }
}

async function runBenchmarkSuite(): Promise<void> {
  console.log('🔬 OpenTelemetry Correlation Middleware Performance Benchmarks');
  console.log('='.repeat(80));
  
  // Initialize mock OTEL
  createMockOTEL();
  
  const benchmark = new MiddlewareBenchmark();
  const iterations = parseInt(process.env.BENCHMARK_ITERATIONS || '5000', 10);
  
  console.log(`📋 Test Configuration:`);
  console.log(`   Iterations per test: ${iterations}`);
  console.log(`   Node.js version: ${process.version}`);
  console.log(`   Platform: ${process.platform} ${process.arch}`);
  console.log(`   Memory: ${(process.memoryUsage().heapTotal / 1024 / 1024).toFixed(0)}MB heap`);

  try {
    // Benchmark 1: Legacy Correlation Middleware
    await benchmark.runBenchmark(
      'Legacy Correlation Middleware',
      legacyCorrelationMiddleware(),
      iterations
    );

    // Benchmark 2: OTEL Correlation Middleware (OTEL Disabled)
    await benchmark.runBenchmark(
      'OTEL Middleware (OTEL Disabled)',
      otelCorrelationMiddleware({ enableOTEL: false }),
      iterations
    );

    // Benchmark 3: OTEL Correlation Middleware (OTEL Enabled)
    await benchmark.runBenchmark(
      'OTEL Middleware (OTEL Enabled)',
      otelCorrelationMiddleware({ enableOTEL: true }),
      iterations
    );

    // Benchmark 4: OTEL Middleware (OTEL Enabled, No Logging)
    await benchmark.runBenchmark(
      'OTEL Middleware (OTEL Enabled, No Logging)',
      otelCorrelationMiddleware({ enableOTEL: true, logRequests: false }),
      iterations
    );

    // Benchmark 5: Migration Middleware (Legacy Mode)
    await benchmark.runBenchmark(
      'Migration Middleware (Legacy Mode)',
      createMigrationMiddleware({ enableOTEL: false, enableMetrics: false }),
      iterations
    );

    // Benchmark 6: Migration Middleware (OTEL Mode)
    await benchmark.runBenchmark(
      'Migration Middleware (OTEL Mode)',
      createMigrationMiddleware({ enableOTEL: true, enableMetrics: false }),
      iterations
    );

    // Benchmark 7: Migration Middleware (OTEL Mode with Metrics)
    await benchmark.runBenchmark(
      'Migration Middleware (OTEL + Metrics)',
      createMigrationMiddleware({ enableOTEL: true, enableMetrics: true }),
      iterations
    );

    // Generate comparison and recommendations
    benchmark.generateComparison();

    // Export results for CI/CD
    const results = benchmark.getResults();
    const summary = {
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      platform: `${process.platform}-${process.arch}`,
      iterations,
      results: results.map(r => ({
        name: r.name,
        avgDurationMs: r.avgDuration,
        opsPerSecond: r.opsPerSecond,
        memoryUsageMB: r.memoryUsage.heapUsed / 1024 / 1024,
      })),
      fastest: results.reduce((min, r) => r.avgDuration < min.avgDuration ? r : min),
      recommendations: generateBenchmarkRecommendations(results),
    };

    // Save results to file for CI/CD pipeline
    const fs = require('fs');
    const path = require('path');
    const resultsPath = path.join(__dirname, '../../../benchmark-results-otel-correlation.json');
    
    fs.writeFileSync(resultsPath, JSON.stringify(summary, null, 2));
    console.log(`\n💾 Results saved to: ${resultsPath}`);

  } catch (error) {
    console.error('❌ Benchmark failed:', error);
    process.exit(1);
  }
}

function generateBenchmarkRecommendations(results: BenchmarkResult[]): string[] {
  const recommendations: string[] = [];
  const sorted = [...results].sort((a, b) => a.avgDuration - b.avgDuration);
  const fastest = sorted[0];
  const slowest = sorted[sorted.length - 1];
  
  const performanceDiff = ((slowest.avgDuration - fastest.avgDuration) / fastest.avgDuration) * 100;
  
  if (performanceDiff < 10) {
    recommendations.push('Performance impact is minimal - safe to migrate');
  } else if (performanceDiff < 25) {
    recommendations.push('Moderate performance impact - monitor in production');
  } else {
    recommendations.push('Significant performance impact - optimization needed');
  }
  
  // Find OTEL vs Legacy comparison
  const otelResult = results.find(r => r.name.includes('OTEL Enabled'));
  const legacyResult = results.find(r => r.name.includes('Legacy'));
  
  if (otelResult && legacyResult) {
    const otelDiff = ((otelResult.avgDuration - legacyResult.avgDuration) / legacyResult.avgDuration) * 100;
    
    if (otelDiff < 5) {
      recommendations.push('OTEL middleware has negligible overhead');
    } else if (otelDiff < 15) {
      recommendations.push('OTEL middleware has acceptable overhead for observability benefits');
    } else {
      recommendations.push('OTEL middleware overhead is significant - consider optimization');
    }
  }
  
  return recommendations;
}

// Export for programmatic use
export {
  MiddlewareBenchmark,
  runBenchmarkSuite,
  BenchmarkResult,
};

// Run benchmarks if this file is executed directly
if (require.main === module) {
  runBenchmarkSuite().then(() => {
    console.log('\n✅ Benchmark suite completed successfully');
    process.exit(0);
  }).catch((error) => {
    console.error('\n❌ Benchmark suite failed:', error);
    process.exit(1);
  });
}