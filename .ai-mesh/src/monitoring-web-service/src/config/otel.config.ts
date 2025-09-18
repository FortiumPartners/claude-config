/**
 * OpenTelemetry Configuration Module
 * Task 2.1: OTEL SDK Basic Configuration (Sprint 2)
 * 
 * Features:
 * - Environment-specific configuration management
 * - Parallel operation with existing Seq transport
 * - Feature flag controls for gradual rollout
 * - Performance targets: <5ms additional latency per request
 */

import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { config } from './environment';
import { logger } from './logger';
import * as os from 'os';

// OTEL Feature Flags for controlled rollout
export interface OTelFeatureFlags {
  enabled: boolean;
  tracing: boolean;
  metrics: boolean;
  logs: boolean;
  autoInstrumentation: boolean;
  manualInstrumentation: boolean;
  prometheus: boolean;
  sampling: boolean;
}

// Environment-specific feature flags
function getFeatureFlags(): OTelFeatureFlags {
  const baseFlags: OTelFeatureFlags = {
    enabled: config.otel.enabled,
    tracing: config.otel.enabled,
    metrics: config.otel.enabled,
    logs: config.otel.enabled && !config.isTest, // Keep Seq primary in test
    autoInstrumentation: config.otel.enabled,
    manualInstrumentation: config.otel.enabled,
    prometheus: config.otel.prometheus.enabled,
    sampling: true,
  };

  // Environment-specific overrides
  if (config.isTest) {
    // Minimal OTEL in test environment to avoid interference
    return {
      ...baseFlags,
      enabled: false,
      tracing: false,
      metrics: false,
      logs: false,
    };
  }

  if (config.isDevelopment) {
    // Full features in development
    return {
      ...baseFlags,
      enabled: true, // Always enabled in dev for testing
    };
  }

  if (config.isProduction) {
    // Conservative rollout in production
    return {
      ...baseFlags,
      enabled: baseFlags.enabled, // Respect environment variable
      logs: false, // Keep Seq primary in production initially
    };
  }

  return baseFlags;
}

export const otelFeatureFlags = getFeatureFlags();

// Service Resource Configuration
export function createServiceResource(): Resource {
  const serviceAttributes: Record<string, string | number> = {
    [SemanticResourceAttributes.SERVICE_NAME]: config.otel.service.name,
    [SemanticResourceAttributes.SERVICE_VERSION]: config.otel.service.version,
    [SemanticResourceAttributes.SERVICE_NAMESPACE]: config.otel.service.namespace,
    [SemanticResourceAttributes.SERVICE_INSTANCE_ID]: `${config.otel.service.name}-${process.pid}-${Date.now()}`,
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: config.nodeEnv,
    
    // Process information
    [SemanticResourceAttributes.PROCESS_PID]: process.pid,
    [SemanticResourceAttributes.PROCESS_COMMAND]: process.argv[1] || 'unknown',
    [SemanticResourceAttributes.PROCESS_RUNTIME_NAME]: 'nodejs',
    [SemanticResourceAttributes.PROCESS_RUNTIME_VERSION]: process.version,
    [SemanticResourceAttributes.PROCESS_RUNTIME_DESCRIPTION]: 'Node.js',
    
    // Host information
    [SemanticResourceAttributes.HOST_NAME]: os.hostname(),
    [SemanticResourceAttributes.HOST_ARCH]: os.arch(),
    [SemanticResourceAttributes.OS_TYPE]: os.type(),
    [SemanticResourceAttributes.OS_VERSION]: os.release(),
    
    // Custom attributes
    'service.team': 'fortium-platform',
    'service.repository': 'claude-config/monitoring-web-service',
    'service.component': 'metrics-collection',
    'deployment.type': config.isDevelopment ? 'local' : 'container',
    'telemetry.integration.seq': 'enabled',
    'telemetry.integration.signoz': 'enabled',
  };

  // Add custom resource attributes from environment
  if (config.otel.resourceAttributes) {
    const customAttrs = config.otel.resourceAttributes.split(',');
    for (const attr of customAttrs) {
      const [key, value] = attr.split('=');
      if (key && value) {
        serviceAttributes[key.trim()] = value.trim();
      }
    }
  }

  return Resource.default().merge(new Resource(serviceAttributes));
}

// Sampling Configuration
export function getSamplingConfig() {
  return {
    // Environment-specific sampling rates
    traceIdRatio: config.otel.sampling.traceRatio,
    
    // Sampling rules
    rules: [
      {
        // Always sample health checks in development
        service: config.otel.service.name,
        operation: 'GET /health',
        sampleRate: config.isDevelopment ? 1.0 : 0.01,
      },
      {
        // Sample authentication requests
        service: config.otel.service.name,
        operation: 'POST /api/v1/auth/*',
        sampleRate: 0.5,
      },
      {
        // Sample high-volume metric ingestion
        service: config.otel.service.name,
        operation: 'POST /api/v1/metrics/batch',
        sampleRate: 0.1,
      },
    ],
  };
}

// Instrumentation Configuration
export function getInstrumentationConfig() {
  return {
    http: {
      enabled: otelFeatureFlags.autoInstrumentation,
      ignoreIncomingRequestHook: (req: any) => {
        const ignorePaths = [
          '/health',
          '/metrics',
          '/favicon.ico',
          // Ignore internal monitoring requests to avoid loops
          '/_internal/',
        ];
        return ignorePaths.some(path => req.url?.includes(path));
      },
      ignoreOutgoingRequestHook: (options: any) => {
        const ignoreHosts = [
          'localhost:4318', // OTEL collector
          'signoz-otel-collector',
          'prometheus',
        ];
        const hostname = typeof options === 'string' ? options : 
                        options.hostname || options.host;
        return ignoreHosts.some(host => hostname?.includes(host));
      },
      requestHook: (span: any, request: any) => {
        // Add correlation ID from existing middleware
        if (request.correlationId) {
          span.setAttributes({
            'http.request.correlation_id': request.correlationId,
            'http.request.session_id': request.sessionId || '',
            'http.request.tenant_id': request.tenant?.id || '',
            'http.request.user_id': request.user?.id || '',
          });
        }
      },
      responseHook: (span: any, response: any) => {
        span.setAttributes({
          'http.response.body.size': response.getHeader?.('content-length') || 0,
        });
      },
    },
    
    express: {
      enabled: otelFeatureFlags.autoInstrumentation,
      ignoreIncomingRequestHook: (req: any) => {
        const ignorePaths = ['/health', '/metrics'];
        return ignorePaths.some(path => req.path?.includes(path));
      },
    },
    
    pg: {
      enabled: otelFeatureFlags.autoInstrumentation,
      enhancedDatabaseReporting: true,
      // Limit SQL statement length to avoid excessive data
      maxStatementLength: 1000,
    },
    
    redis: {
      enabled: otelFeatureFlags.autoInstrumentation && !!config.redis.url,
      dbStatementSerializer: (cmdName: string, cmdArgs: any[]) => {
        // Sanitize Redis commands to avoid logging sensitive data
        const safeArgs = cmdArgs.slice(0, 2).map(arg => 
          typeof arg === 'string' && arg.length > 50 ? 
            arg.substring(0, 50) + '...' : arg
        );
        return `${cmdName} ${safeArgs.join(' ')}`;
      },
    },
    
    winston: {
      enabled: otelFeatureFlags.logs,
      // Hook to add trace context to Winston logs
      logHook: (span: any, record: any) => {
        if (span && span.spanContext) {
          const spanContext = span.spanContext();
          record['otel.trace_id'] = spanContext.traceId;
          record['otel.span_id'] = spanContext.spanId;
          record['otel.trace_flags'] = spanContext.traceFlags;
        }
      },
    },
  };
}

// Exporter Configuration
export function getExporterConfig() {
  return {
    otlp: {
      traces: {
        url: config.otel.exporter.tracesEndpoint,
        headers: {
          'Content-Type': 'application/json',
        },
        compression: 'gzip' as const,
        timeoutMillis: config.otel.traces.timeout,
        concurrencyLimit: 10,
      },
      metrics: {
        url: config.otel.exporter.metricsEndpoint,
        headers: {
          'Content-Type': 'application/json',
        },
        compression: 'gzip' as const,
        timeoutMillis: 5000,
        temporalityPreference: 'delta' as const,
      },
    },
    
    prometheus: {
      enabled: otelFeatureFlags.prometheus,
      port: config.otel.prometheus.port,
      endpoint: '/metrics',
      prefix: 'fortium_',
    },
  };
}

// Performance Monitoring Configuration
export interface PerformanceThresholds {
  slowRequestMs: number;
  slowDbQueryMs: number;
  slowExternalCallMs: number;
  highMemoryUsageMB: number;
  maxLatencyImpactMs: number;
}

export const performanceThresholds: PerformanceThresholds = {
  slowRequestMs: 1000,
  slowDbQueryMs: 500,
  slowExternalCallMs: 2000,
  highMemoryUsageMB: 512,
  maxLatencyImpactMs: 5, // TRD requirement: <5ms additional latency
};

// Health Check Integration
export function getOTelHealthStatus(): {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'disabled';
  enabled: boolean;
  features: OTelFeatureFlags;
  endpoints: Record<string, string>;
  performance: Record<string, any>;
} {
  if (!otelFeatureFlags.enabled) {
    return {
      status: 'disabled',
      enabled: false,
      features: otelFeatureFlags,
      endpoints: {},
      performance: {},
    };
  }

  return {
    status: 'healthy', // TODO: Add actual health checks
    enabled: true,
    features: otelFeatureFlags,
    endpoints: {
      traces: config.otel.exporter.tracesEndpoint,
      metrics: config.otel.exporter.metricsEndpoint,
      prometheus: otelFeatureFlags.prometheus ? 
        `http://localhost:${config.otel.prometheus.port}/metrics` : 'disabled',
    },
    performance: {
      maxLatencyImpact: `${performanceThresholds.maxLatencyImpactMs}ms`,
      sampling: {
        traces: config.otel.sampling.traceRatio,
      },
      export: {
        metricsInterval: `${config.otel.metrics.exportInterval}ms`,
        tracesTimeout: `${config.otel.traces.timeout}ms`,
      },
    },
  };
}

// Logging integration
export function logOTelStatus() {
  const status = getOTelHealthStatus();
  
  if (!status.enabled) {
    logger.info('OpenTelemetry is disabled via feature flag', {
      event: 'otel.status.disabled',
      environment: config.nodeEnv,
    });
    return;
  }
  
  logger.info('OpenTelemetry configuration loaded', {
    event: 'otel.config.loaded',
    environment: config.nodeEnv,
    service: config.otel.service.name,
    version: config.otel.service.version,
    features: status.features,
    sampling: {
      traceRatio: config.otel.sampling.traceRatio,
    },
    endpoints: status.endpoints,
  });
}

// Export main configuration object
export const otelConfig = {
  featureFlags: otelFeatureFlags,
  resource: createServiceResource(),
  sampling: getSamplingConfig(),
  instrumentation: getInstrumentationConfig(),
  exporters: getExporterConfig(),
  performance: performanceThresholds,
  healthStatus: getOTelHealthStatus,
  logStatus: logOTelStatus,
};