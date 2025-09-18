/**
 * OpenTelemetry Integration Middleware
 * Task 2.1: OTEL SDK Basic Configuration - Integration with Existing System
 * 
 * Features:
 * - Parallel operation with existing Seq transport
 * - Integration with existing correlation middleware
 * - Feature flag controls for gradual rollout
 * - Performance monitoring with <5ms target latency impact
 */

import { Request, Response, NextFunction } from 'express';
import * as api from '@opentelemetry/api';
import { otelFeatureFlags, otelConfig } from '../config/otel.config';
import { logger } from '../config/logger';
// import { recordPerformanceMetric, createCustomSpan } from '../tracing/otel-init'; // Temporarily disabled

// Extend Express Request interface for OTEL integration
declare global {
  namespace Express {
    interface Request {
      otelSpan?: api.Span;
      otelStartTime?: number;
    }
  }
}

interface OTelMiddlewareOptions {
  enableTracing: boolean;
  enableMetrics: boolean;
  operationName?: string;
  attributes?: Record<string, string | number | boolean>;
}

/**
 * Main OTEL middleware that enhances existing correlation middleware
 */
export function otelMiddleware(options: Partial<OTelMiddlewareOptions> = {}) {
  const config = {
    enableTracing: otelFeatureFlags.tracing,
    enableMetrics: otelFeatureFlags.metrics,
    operationName: 'http_request',
    ...options,
  };

  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip if OTEL is disabled
    if (!otelFeatureFlags.enabled) {
      return next();
    }

    const startTime = Date.now();
    req.otelStartTime = startTime;

    // Create span if tracing is enabled
    let span: api.Span | undefined;
    
    if (config.enableTracing) {
      const tracer = api.trace.getActiveTracer();
      
      if (tracer) {
        span = tracer.startSpan(`${req.method} ${req.route?.path || req.path}`, {
          kind: api.SpanKind.SERVER,
          attributes: {
            'http.method': req.method,
            'http.url': req.url,
            'http.path': req.path,
            'http.route': req.route?.path || req.path,
            'http.user_agent': req.headers['user-agent'] || '',
            'http.scheme': req.protocol,
            'http.host': req.headers.host || '',
            'http.remote_addr': req.ip || req.socket.remoteAddress || '',
            
            // Integrate with existing correlation context
            'correlation.id': req.correlationId || '',
            'session.id': req.sessionId || '',
            'request.id': req.requestId || '',
            'tenant.id': (req as any).tenant?.id || '',
            'user.id': (req as any).user?.id || '',
            
            // Service attributes
            'service.operation': config.operationName,
            'service.version': otelConfig.resource.attributes['service.version'] as string,
            
            // Custom attributes
            ...config.attributes,
          },
        });

        // Store span on request for manual instrumentation
        req.otelSpan = span;
        
        // Set active span context
        api.context.with(api.trace.setSpan(api.context.active(), span), () => {
          // Continue with the request
        });
      }
    }

    // Enhance response to record metrics and complete span
    const originalEnd = res.end;
    res.end = function(this: Response, chunk?: any, encoding?: any): Response {
      const endTime = Date.now();
      const duration = endTime - startTime;
      const success = res.statusCode < 400;

      // Record performance metrics
      if (config.enableMetrics) {
        recordPerformanceMetric(
          `http.${req.method.toLowerCase()}`,
          duration,
          success,
          {
            method: req.method,
            status_code: res.statusCode.toString(),
            route: req.route?.path || req.path,
            tenant_id: (req as any).tenant?.id || 'unknown',
          }
        );

        // Record additional HTTP metrics
        recordHttpMetrics(req, res, duration, success);
      }

      // Complete span if tracing is enabled
      if (span) {
        span.setAttributes({
          'http.status_code': res.statusCode,
          'http.response.duration_ms': duration,
          'http.response.success': success,
          'http.response.size': res.getHeader('content-length') || 0,
        });

        if (!success) {
          span.setStatus({
            code: api.SpanStatusCode.ERROR,
            message: `HTTP ${res.statusCode}`,
          });
        } else {
          span.setStatus({ code: api.SpanStatusCode.OK });
        }

        // Add performance categorization
        if (duration > otelConfig.performance.slowRequestMs) {
          span.setAttributes({
            'performance.category': 'slow',
            'performance.threshold_exceeded': true,
          });
        }

        span.end();
      }

      // Log performance issues
      if (duration > otelConfig.performance.maxLatencyImpactMs) {
        logger.warn('OTEL middleware added significant latency', {
          event: 'otel.performance.latency_impact',
          duration,
          threshold: otelConfig.performance.maxLatencyImpactMs,
          method: req.method,
          path: req.path,
          correlationId: req.correlationId,
        });
      }

      return originalEnd.call(this, chunk, encoding);
    };

    next();
  };
}

/**
 * Record detailed HTTP metrics
 */
function recordHttpMetrics(
  req: Request,
  res: Response,
  duration: number,
  success: boolean
) {
  const meter = api.metrics.getMeter('fortium-http-metrics', '1.0.0');
  
  if (!meter) return;

  // HTTP request duration histogram
  const httpDuration = meter.createHistogram('fortium_http_request_duration', {
    description: 'HTTP request duration in milliseconds',
    unit: 'ms',
  });

  // HTTP request counter
  const httpRequests = meter.createCounter('fortium_http_requests_total', {
    description: 'Total number of HTTP requests',
  });

  // HTTP request size histogram
  const httpRequestSize = meter.createHistogram('fortium_http_request_size_bytes', {
    description: 'HTTP request size in bytes',
    unit: 'byte',
  });

  const baseLabels = {
    method: req.method,
    status: res.statusCode.toString(),
    route: req.route?.path || req.path,
    success: success.toString(),
  };

  httpDuration.record(duration, baseLabels);
  httpRequests.add(1, baseLabels);
  
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  if (contentLength > 0) {
    httpRequestSize.record(contentLength, baseLabels);
  }
}

/**
 * Manual span creation utility for specific operations
 */
export function createOperationSpan(
  req: Request,
  operationName: string,
  attributes?: Record<string, string | number | boolean>
) {
  if (!otelFeatureFlags.tracing) {
    return undefined;
  }

  const tracer = api.trace.getActiveTracer();
  if (!tracer) return undefined;

  return tracer.startSpan(operationName, {
    parent: req.otelSpan,
    attributes: {
      'operation.name': operationName,
      'correlation.id': req.correlationId || '',
      'session.id': req.sessionId || '',
      'tenant.id': (req as any).tenant?.id || '',
      'user.id': (req as any).user?.id || '',
      ...attributes,
    },
  });
}

/**
 * Database operation instrumentation
 */
export function instrumentDatabaseOperation<T>(
  req: Request,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  if (!otelFeatureFlags.tracing) {
    return fn();
  }

  return createCustomSpan(
    `db.${operation}`,
    fn,
    {
      'db.operation': operation,
      'correlation.id': req.correlationId || '',
      'component': 'database',
    }
  );
}

/**
 * External API call instrumentation
 */
export function instrumentApiCall<T>(
  req: Request,
  service: string,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  if (!otelFeatureFlags.tracing) {
    return fn();
  }

  return createCustomSpan(
    `external.${service}.${operation}`,
    fn,
    {
      'external.service': service,
      'external.operation': operation,
      'correlation.id': req.correlationId || '',
      'component': 'external_api',
    }
  );
}

/**
 * Lightweight OTEL middleware for high-traffic endpoints
 */
export const lightOtelMiddleware = otelMiddleware({
  enableTracing: false, // Only metrics for performance
  enableMetrics: true,
});

/**
 * Full OTEL middleware for detailed monitoring
 */
export const fullOtelMiddleware = otelMiddleware({
  enableTracing: true,
  enableMetrics: true,
});

/**
 * Feature flag check utility
 */
export function isOtelEnabled(): boolean {
  return otelFeatureFlags.enabled;
}

/**
 * Get current OTEL configuration
 */
export function getOtelStatus() {
  return {
    enabled: otelFeatureFlags.enabled,
    features: otelFeatureFlags,
    performance: otelConfig.performance,
    endpoints: {
      traces: otelConfig.exporters.otlp.traces.url,
      metrics: otelConfig.exporters.otlp.metrics.url,
    },
  };
}

export default otelMiddleware;