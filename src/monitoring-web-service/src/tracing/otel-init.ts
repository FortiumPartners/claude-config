/**
 * OpenTelemetry Initialization for Fortium Monitoring Web Service
 * Task 2.1: OTEL SDK Basic Configuration (Sprint 2)
 * 
 * Enhanced OTEL initialization with:
 * - Environment-specific configuration management
 * - Integration with existing Seq logging transport  
 * - Feature flag controls for gradual rollout
 * - Performance targets: <5ms additional latency per request
 * - Parallel operation with existing correlation middleware
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PeriodicExportingMetricReader, MeterProvider } from '@opentelemetry/sdk-metrics';
import { OTLPTraceExporter } from '@opentelemetry/exporter-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-otlp-http';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { B3Propagator } from '@opentelemetry/propagator-b3';
import { JaegerPropagator } from '@opentelemetry/propagator-jaeger';
import { CompositePropagator } from '@opentelemetry/core';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { W3CBaggagePropagator } from '@opentelemetry/core';
import { TraceIdRatioBasedSampler } from '@opentelemetry/sdk-trace-node';
import * as api from '@opentelemetry/api';
import { otelConfig, otelFeatureFlags } from '../config/otel.config';
import { config } from '../config/environment';
import { logger } from '../config/logger';
import { intelligentSamplingService } from './intelligent-sampling.service';

// Early exit if OpenTelemetry is disabled
if (!otelFeatureFlags.enabled) {
  logger.info('OpenTelemetry initialization skipped - disabled via feature flag', {
    event: 'otel.init.skipped',
    environment: config.nodeEnv,
  });
  
  // Export no-op implementations to maintain compatibility
  export const sdk = null;
  export const tracer = api.trace.getNoopTracer();
  export const meter = api.metrics.getMeter('noop');
  
  export function createCustomSpan(name: string, operation: () => any) {
    return operation();
  }
  
  export function recordMetric() {
    // No-op
  }
  
  export function shutdown() {
    return Promise.resolve();
  }
  
  // Exit early - don't initialize anything
} else {

// Initialize with configuration from otel.config.ts
const resource = otelConfig.resource;
const instrumentationConfig = otelConfig.instrumentation;
const exporterConfig = otelConfig.exporters;

// Configure OTLP trace exporter
const traceExporter = otelFeatureFlags.tracing ? new OTLPTraceExporter(exporterConfig.otlp.traces) : undefined;

// Configure OTLP metrics exporter
const otlpMetricExporter = otelFeatureFlags.metrics ? new OTLPMetricExporter(exporterConfig.otlp.metrics) : undefined;

// Configure Prometheus metrics exporter (optional)
const prometheusExporter = exporterConfig.prometheus.enabled 
  ? new PrometheusExporter({
      port: exporterConfig.prometheus.port,
      endpoint: exporterConfig.prometheus.endpoint,
      prefix: exporterConfig.prometheus.prefix,
    }, () => {
      logger.info(`Prometheus metrics available at http://localhost:${exporterConfig.prometheus.port}${exporterConfig.prometheus.endpoint}`, {
        event: 'otel.prometheus.ready',
        port: exporterConfig.prometheus.port,
      });
    })
  : undefined;

// Configure metric readers
const metricReaders: PeriodicExportingMetricReader[] = [];

if (otlpMetricExporter) {
  metricReaders.push(new PeriodicExportingMetricReader({
    exporter: otlpMetricExporter,
    exportIntervalMillis: config.otel.metrics.exportInterval,
    exportTimeoutMillis: 5000,
  }));
}

if (prometheusExporter) {
  metricReaders.push(new PeriodicExportingMetricReader({
    exporter: prometheusExporter,
    exportIntervalMillis: 15000, // More frequent for Prometheus scraping
  }));
}

// Configure propagators for distributed tracing
const propagatorMap: Record<string, any> = {
  'tracecontext': W3CTraceContextPropagator,
  'baggage': W3CBaggagePropagator,
  'b3': B3Propagator,
  'jaeger': JaegerPropagator,
};

const enabledPropagators = config.otel.propagators
  .filter(name => propagatorMap[name])
  .map(name => new propagatorMap[name]());

const propagator = new CompositePropagator({
  propagators: enabledPropagators.length > 0 ? enabledPropagators : [
    new W3CTraceContextPropagator(),
    new W3CBaggagePropagator(),
  ]
});

// Configure auto-instrumentations with enhanced integration
const instrumentations = otelFeatureFlags.autoInstrumentation 
  ? getNodeAutoInstrumentations({
      // Disable noisy instrumentations
      '@opentelemetry/instrumentation-fs': {
        enabled: false
      },
      '@opentelemetry/instrumentation-dns': {
        enabled: false
      },
      
      // Configure HTTP instrumentation with correlation integration
      '@opentelemetry/instrumentation-http': instrumentationConfig.http,
      
      // Configure Express instrumentation
      '@opentelemetry/instrumentation-express': instrumentationConfig.express,
      
      // Configure database instrumentations
      '@opentelemetry/instrumentation-pg': instrumentationConfig.pg,
      '@opentelemetry/instrumentation-redis-4': instrumentationConfig.redis,
      
      // Configure logging instrumentation
      '@opentelemetry/instrumentation-winston': instrumentationConfig.winston,
    })
  : [];

// Initialize the Node SDK with intelligent sampling and performance optimizations
const sampler = otelFeatureFlags.sampling && config.otel.intelligent_sampling?.enabled !== false ?
  intelligentSamplingService : 
  new TraceIdRatioBasedSampler(otelConfig.sampling.traceIdRatio);

const sdk = new NodeSDK({
  resource: resource,
  textMapPropagator: propagator,
  traceExporter: traceExporter,
  metricReader: metricReaders.length > 0 ? metricReaders : undefined,
  instrumentations: instrumentations,
  sampler: sampler,
});

// Graceful shutdown handlers
const shutdown = async (signal: string) => {
  logger.info(`OpenTelemetry shutdown initiated (${signal})`, {
    event: 'otel.shutdown.start',
    signal,
  });
  
  try {
    await sdk.shutdown();
    logger.info('OpenTelemetry shutdown completed successfully', {
      event: 'otel.shutdown.success',
    });
  } catch (error) {
    logger.error('Error during OpenTelemetry shutdown', {
      event: 'otel.shutdown.error',
      error: (error as Error).message,
    });
  } finally {
    process.exit(0);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Initialize the SDK
let tracer: api.Tracer;
let meter: api.Meter;

try {
  sdk.start();
  
  // Create instrumentation instances
  tracer = api.trace.getTracer(config.otel.service.name, config.otel.service.version);
  meter = api.metrics.getMeter(config.otel.service.name, config.otel.service.version);
  
  // Export for global access (backward compatibility)
  (global as any).__OTEL_TRACER__ = tracer;
  (global as any).__OTEL_METER__ = meter;
  
  // Log startup with existing logger integration
  logger.info('OpenTelemetry initialized successfully', {
    event: 'otel.init.success',
    service: config.otel.service.name,
    version: config.otel.service.version,
    environment: config.nodeEnv,
    features: {
      tracing: otelFeatureFlags.tracing,
      metrics: otelFeatureFlags.metrics,
      logs: otelFeatureFlags.logs,
      prometheus: exporterConfig.prometheus.enabled,
    },
    endpoints: {
      traces: config.otel.exporter.tracesEndpoint,
      metrics: config.otel.exporter.metricsEndpoint,
    },
    sampling: {
      traceRatio: otelConfig.sampling.traceIdRatio,
    },
    resourceAttributes: Object.keys(resource.attributes).length,
  });
  
  // Log configuration status
  otelConfig.logStatus();
  
} catch (error) {
  logger.error('Failed to initialize OpenTelemetry', {
    event: 'otel.init.error',
    error: (error as Error).message,
    stack: (error as Error).stack,
  });
  
  // Don't exit process - allow application to continue without OTEL
  tracer = api.trace.getNoopTracer();
  meter = api.metrics.getMeter('noop');
}

// Enhanced utility functions with performance monitoring
export function createCustomSpan(
  name: string, 
  operation: () => Promise<any> | any,
  attributes?: Record<string, string | number | boolean>
) {
  if (!otelFeatureFlags.manualInstrumentation || !tracer) {
    return operation();
  }
  
  const startTime = Date.now();
  
  return tracer.startActiveSpan(name, { attributes }, async (span: api.Span) => {
    try {
      const result = await operation();
      const duration = Date.now() - startTime;
      
      span.setAttributes({
        'operation.duration_ms': duration,
        'operation.success': true,
      });
      
      // Performance categorization
      if (duration > otelConfig.performance.slowRequestMs) {
        span.setAttributes({
          'operation.performance.category': 'slow',
        });
      }
      
      span.setStatus({ code: api.SpanStatusCode.OK });
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      span.setAttributes({
        'operation.duration_ms': duration,
        'operation.success': false,
        'error.type': (error as Error).constructor.name,
      });
      
      span.recordException(error as Error);
      span.setStatus({ 
        code: api.SpanStatusCode.ERROR, 
        message: (error as Error).message 
      });
      throw error;
    } finally {
      span.end();
    }
  });
}

// Enhanced metrics recording with performance tracking
export function recordMetric(
  name: string,
  value: number,
  attributes?: Record<string, string | number | boolean>
) {
  if (!otelFeatureFlags.metrics || !meter) {
    return;
  }
  
  const counter = meter.createCounter(`fortium_${name}`, {
    description: `Custom metric: ${name}`,
  });
  
  counter.add(value, {
    ...attributes,
    service: config.otel.service.name,
    environment: config.nodeEnv,
  });
}

// Performance monitoring utilities
export function recordPerformanceMetric(
  operation: string,
  duration: number,
  success: boolean,
  attributes?: Record<string, string | number | boolean>
) {
  if (!otelFeatureFlags.metrics || !meter) {
    return;
  }
  
  const durationHistogram = meter.createHistogram('fortium_operation_duration', {
    description: 'Operation duration in milliseconds',
    unit: 'ms',
  });
  
  const operationCounter = meter.createCounter('fortium_operation_total', {
    description: 'Total number of operations',
  });
  
  const baseAttributes = {
    operation,
    success: success.toString(),
    environment: config.nodeEnv,
    ...attributes,
  };
  
  durationHistogram.record(duration, baseAttributes);
  operationCounter.add(1, baseAttributes);
  
  // Log slow operations
  if (duration > otelConfig.performance.slowRequestMs) {
    logger.warn(`Slow operation detected: ${operation}`, {
      event: 'otel.performance.slow_operation',
      operation,
      duration,
      success,
      ...attributes,
    });
  }
}

// Shutdown utility
export async function shutdown(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
  }
}

// Export instances for manual instrumentation
export { tracer, meter, sdk };

} // Close the conditional block

// Always export health status function (outside the conditional)
export function getOTelHealthStatus() {
  return otelConfig.healthStatus();
}