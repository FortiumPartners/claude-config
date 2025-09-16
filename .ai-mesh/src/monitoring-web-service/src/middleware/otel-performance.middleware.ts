/**
 * OpenTelemetry Performance Monitoring Middleware
 * Task 2.2: Auto-instrumentation Implementation - Performance Impact Measurement
 * 
 * Monitors the performance impact of OpenTelemetry instrumentation
 * and provides metrics for validation and optimization.
 */

import { Request, Response, NextFunction } from 'express';
import * as api from '@opentelemetry/api';
import { logger } from '../config/logger';

// Performance metrics storage
interface PerformanceMetrics {
  requestCount: number;
  totalLatency: number;
  instrumentationOverhead: number;
  averageLatency: number;
  maxLatency: number;
  minLatency: number;
  p95Latency: number;
  p99Latency: number;
  lastReset: Date;
  latencySamples: number[];
}

const performanceMetrics: PerformanceMetrics = {
  requestCount: 0,
  totalLatency: 0,
  instrumentationOverhead: 0,
  averageLatency: 0,
  maxLatency: 0,
  minLatency: Infinity,
  p95Latency: 0,
  p99Latency: 0,
  lastReset: new Date(),
  latencySamples: []
};

// Maximum samples to keep for percentile calculations
const MAX_SAMPLES = 1000;

/**
 * Performance monitoring middleware
 * Measures request processing time and instrumentation overhead
 */
export function otelPerformanceMiddleware() {
  const meter = api.metrics.getMeter('fortium-monitoring-service-performance', '1.0.0');
  
  // Create metrics instruments
  const requestDurationHistogram = meter.createHistogram('http_request_duration_ms', {
    description: 'HTTP request duration in milliseconds',
    unit: 'ms'
  });

  const instrumentationOverheadHistogram = meter.createHistogram('otel_instrumentation_overhead_ms', {
    description: 'OpenTelemetry instrumentation overhead in milliseconds',
    unit: 'ms'
  });

  const activeSpansGauge = meter.createUpDownCounter('otel_active_spans', {
    description: 'Number of active spans'
  });

  return (req: Request, res: Response, next: NextFunction) => {
    // Skip monitoring for health and metrics endpoints
    if (req.path?.includes('/health') || req.path?.includes('/metrics')) {
      return next();
    }

    const startTime = process.hrtime.bigint();
    const startMemory = process.memoryUsage();
    
    // Get current span to measure instrumentation overhead
    const currentSpan = api.trace.getActiveSpan();
    const instrumentationStartTime = process.hrtime.bigint();
    
    // Track span creation overhead
    let spanCreationOverhead = 0n;
    if (currentSpan) {
      spanCreationOverhead = process.hrtime.bigint() - instrumentationStartTime;
    }

    // Add custom span for performance monitoring
    const tracer = api.trace.getTracer('fortium-performance-monitor', '1.0.0');
    const performanceSpan = tracer.startSpan('performance.monitoring', {
      attributes: {
        'http.method': req.method,
        'http.route': req.route?.path || req.path,
        'fortium.monitoring.type': 'performance'
      }
    });

    // Store start time on request for later calculation
    (req as any).__perf_start_time = startTime;
    (req as any).__perf_start_memory = startMemory;
    (req as any).__perf_span = performanceSpan;

    // Override response.end to capture metrics
    const originalEnd = res.end;
    res.end = function(this: Response, ...args: any[]) {
      const endTime = process.hrtime.bigint();
      const endMemory = process.memoryUsage();
      
      // Calculate total request duration
      const totalDuration = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds
      
      // Calculate memory impact
      const memoryDelta = endMemory.used - startMemory.used;
      
      // Calculate instrumentation overhead (estimate)
      const instrumentationOverhead = Number(spanCreationOverhead) / 1_000_000;
      
      // Update performance metrics
      updatePerformanceMetrics(totalDuration, instrumentationOverhead);
      
      // Record metrics
      const attributes = {
        'http.method': req.method,
        'http.status_code': res.statusCode,
        'http.route': req.route?.path || req.path,
        'fortium.tenant.id': (req as any).tenantId || 'unknown'
      };

      requestDurationHistogram.record(totalDuration, attributes);
      
      if (instrumentationOverhead > 0) {
        instrumentationOverheadHistogram.record(instrumentationOverhead, attributes);
      }

      // Add performance attributes to span
      performanceSpan.setAttributes({
        'performance.request.duration.ms': totalDuration,
        'performance.instrumentation.overhead.ms': instrumentationOverhead,
        'performance.memory.delta.bytes': memoryDelta,
        'performance.memory.used.mb': Math.round(endMemory.used / 1024 / 1024),
        'performance.impact.percentage': totalDuration > 0 ? (instrumentationOverhead / totalDuration) * 100 : 0
      });

      // Log performance warnings if overhead is significant
      if (instrumentationOverhead > 5) { // More than 5ms overhead
        logger.warn('High OpenTelemetry instrumentation overhead detected', {
          route: req.route?.path || req.path,
          method: req.method,
          totalDuration,
          instrumentationOverhead,
          overheadPercentage: (instrumentationOverhead / totalDuration) * 100,
          event: 'otel.performance.warning'
        });
      }

      // Log performance metrics periodically
      if (performanceMetrics.requestCount % 100 === 0) {
        logPerformanceReport();
      }

      performanceSpan.setStatus({ code: api.SpanStatusCode.OK });
      performanceSpan.end();
      
      // Call original end method
      return originalEnd.apply(this, args);
    };

    next();
  };
}

/**
 * Update performance metrics with new measurement
 */
function updatePerformanceMetrics(duration: number, overhead: number) {
  performanceMetrics.requestCount++;
  performanceMetrics.totalLatency += duration;
  performanceMetrics.instrumentationOverhead += overhead;
  
  // Update min/max
  performanceMetrics.maxLatency = Math.max(performanceMetrics.maxLatency, duration);
  performanceMetrics.minLatency = Math.min(performanceMetrics.minLatency, duration);
  
  // Calculate average
  performanceMetrics.averageLatency = performanceMetrics.totalLatency / performanceMetrics.requestCount;
  
  // Store sample for percentile calculations
  performanceMetrics.latencySamples.push(duration);
  
  // Limit samples array size
  if (performanceMetrics.latencySamples.length > MAX_SAMPLES) {
    performanceMetrics.latencySamples = performanceMetrics.latencySamples.slice(-MAX_SAMPLES);
  }
  
  // Calculate percentiles
  updatePercentiles();
}

/**
 * Update percentile calculations
 */
function updatePercentiles() {
  if (performanceMetrics.latencySamples.length === 0) return;
  
  const sorted = [...performanceMetrics.latencySamples].sort((a, b) => a - b);
  const p95Index = Math.floor(sorted.length * 0.95);
  const p99Index = Math.floor(sorted.length * 0.99);
  
  performanceMetrics.p95Latency = sorted[p95Index] || 0;
  performanceMetrics.p99Latency = sorted[p99Index] || 0;
}

/**
 * Log performance report
 */
function logPerformanceReport() {
  const averageOverhead = performanceMetrics.instrumentationOverhead / performanceMetrics.requestCount;
  const overheadPercentage = (averageOverhead / performanceMetrics.averageLatency) * 100;
  
  logger.info('OpenTelemetry Performance Report', {
    requestCount: performanceMetrics.requestCount,
    averageLatency: Math.round(performanceMetrics.averageLatency * 100) / 100,
    minLatency: Math.round(performanceMetrics.minLatency * 100) / 100,
    maxLatency: Math.round(performanceMetrics.maxLatency * 100) / 100,
    p95Latency: Math.round(performanceMetrics.p95Latency * 100) / 100,
    p99Latency: Math.round(performanceMetrics.p99Latency * 100) / 100,
    averageInstrumentationOverhead: Math.round(averageOverhead * 100) / 100,
    overheadPercentage: Math.round(overheadPercentage * 100) / 100,
    timeSinceLastReset: Date.now() - performanceMetrics.lastReset.getTime(),
    event: 'otel.performance.report'
  });
}

/**
 * Get current performance metrics
 */
export function getPerformanceMetrics(): PerformanceMetrics & { 
  averageOverhead: number; 
  overheadPercentage: number;
  performanceImpact: string;
} {
  const averageOverhead = performanceMetrics.requestCount > 0 
    ? performanceMetrics.instrumentationOverhead / performanceMetrics.requestCount 
    : 0;
  
  const overheadPercentage = performanceMetrics.averageLatency > 0 
    ? (averageOverhead / performanceMetrics.averageLatency) * 100 
    : 0;

  let performanceImpact = 'minimal';
  if (overheadPercentage > 10) performanceImpact = 'high';
  else if (overheadPercentage > 5) performanceImpact = 'moderate';
  else if (overheadPercentage > 2) performanceImpact = 'low';

  return {
    ...performanceMetrics,
    averageOverhead,
    overheadPercentage,
    performanceImpact
  };
}

/**
 * Reset performance metrics
 */
export function resetPerformanceMetrics() {
  performanceMetrics.requestCount = 0;
  performanceMetrics.totalLatency = 0;
  performanceMetrics.instrumentationOverhead = 0;
  performanceMetrics.averageLatency = 0;
  performanceMetrics.maxLatency = 0;
  performanceMetrics.minLatency = Infinity;
  performanceMetrics.p95Latency = 0;
  performanceMetrics.p99Latency = 0;
  performanceMetrics.lastReset = new Date();
  performanceMetrics.latencySamples = [];
  
  logger.info('Performance metrics reset', {
    event: 'otel.performance.reset'
  });
}

/**
 * Middleware to expose performance metrics endpoint
 */
export function performanceMetricsEndpoint() {
  return (req: Request, res: Response) => {
    const metrics = getPerformanceMetrics();
    
    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      performance: {
        summary: {
          totalRequests: metrics.requestCount,
          averageLatency: `${Math.round(metrics.averageLatency * 100) / 100}ms`,
          performanceImpact: metrics.performanceImpact,
          overheadPercentage: `${Math.round(metrics.overheadPercentage * 100) / 100}%`
        },
        latency: {
          min: `${Math.round(metrics.minLatency * 100) / 100}ms`,
          max: `${Math.round(metrics.maxLatency * 100) / 100}ms`,
          average: `${Math.round(metrics.averageLatency * 100) / 100}ms`,
          p95: `${Math.round(metrics.p95Latency * 100) / 100}ms`,
          p99: `${Math.round(metrics.p99Latency * 100) / 100}ms`
        },
        instrumentation: {
          averageOverhead: `${Math.round(metrics.averageOverhead * 100) / 100}ms`,
          totalOverhead: `${Math.round(metrics.instrumentationOverhead * 100) / 100}ms`,
          impactPercentage: `${Math.round(metrics.overheadPercentage * 100) / 100}%`,
          classification: metrics.performanceImpact
        },
        monitoring: {
          samplesCollected: metrics.latencySamples.length,
          monitoringSince: metrics.lastReset.toISOString(),
          uptimeSeconds: Math.floor((Date.now() - metrics.lastReset.getTime()) / 1000)
        }
      },
      recommendations: generatePerformanceRecommendations(metrics)
    });
  };
}

/**
 * Generate performance recommendations based on metrics
 */
function generatePerformanceRecommendations(metrics: ReturnType<typeof getPerformanceMetrics>): string[] {
  const recommendations: string[] = [];
  
  if (metrics.overheadPercentage > 10) {
    recommendations.push('High instrumentation overhead detected. Consider disabling some instrumentations or increasing sampling rate.');
  }
  
  if (metrics.averageLatency > 1000) {
    recommendations.push('High average latency detected. Review application performance and database queries.');
  }
  
  if (metrics.p99Latency > metrics.averageLatency * 5) {
    recommendations.push('High P99 latency variance detected. Check for performance outliers and optimize slow requests.');
  }
  
  if (metrics.requestCount < 100) {
    recommendations.push('Low request count. Performance metrics may not be representative. Continue monitoring.');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('Performance metrics look healthy. Continue monitoring for trends.');
  }
  
  return recommendations;
}