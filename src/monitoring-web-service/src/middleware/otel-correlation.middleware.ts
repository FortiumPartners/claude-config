/**
 * OpenTelemetry-Native Correlation Middleware
 * Fortium Monitoring Web Service - Sprint 2: OpenTelemetry Migration
 * Task 2.4: Correlation Middleware Replacement with OTEL Context
 * 
 * Replaces custom correlation middleware with OpenTelemetry-native context propagation
 * while maintaining backward compatibility and all existing functionality.
 */

import { Request, Response, NextFunction } from 'express';
import * as api from '@opentelemetry/api';
import { SemanticAttributes } from '@opentelemetry/semantic-conventions';
import { createContextualLogger, LogContext } from '../config/logger';
import winston from 'winston';

// Extend Express Request to include OTEL correlation context
declare global {
  namespace Express {
    interface Request {
      correlationId: string;
      sessionId?: string;
      traceId?: string;
      spanId?: string;
      requestId: string;
      logger: winston.Logger;
      logContext: LogContext;
      otelSpan?: api.Span;
      otelContext?: api.Context;
    }
  }
}

interface OTELCorrelationOptions {
  correlationHeaderName: string;
  sessionHeaderName: string;
  traceHeaderName: string;
  spanHeaderName: string;
  generateNewCorrelationId: boolean;
  includeInResponse: boolean;
  logRequests: boolean;
  enableOTEL: boolean;
  backwardCompatible: boolean;
  propagateCustomHeaders: boolean;
}

const defaultOptions: OTELCorrelationOptions = {
  correlationHeaderName: 'x-correlation-id',
  sessionHeaderName: 'x-session-id', 
  traceHeaderName: 'x-trace-id',
  spanHeaderName: 'x-span-id',
  generateNewCorrelationId: true,
  includeInResponse: true,
  logRequests: true,
  enableOTEL: true,
  backwardCompatible: true,
  propagateCustomHeaders: true,
};

/**
 * OTEL-Native Correlation Middleware Factory
 * 
 * Features:
 * - Native OpenTelemetry context propagation
 * - Backward compatibility with existing correlation headers
 * - Automatic trace/span ID generation using OTEL
 * - Feature flag controlled migration path
 * - Enhanced request/response tracking with OTEL attributes
 * - Seamless integration with existing logging infrastructure
 */
export function otelCorrelationMiddleware(options: Partial<OTELCorrelationOptions> = {}): (req: Request, res: Response, next: NextFunction) => void {
  const config = { ...defaultOptions, ...options };
  
  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();
    
    // Get active OTEL span and context
    const activeSpan = api.trace.getActiveSpan();
    const activeContext = api.context.active();
    
    let correlationId: string;
    let traceId: string;
    let spanId: string;
    
    if (config.enableOTEL && activeSpan) {
      // Use OTEL trace and span IDs
      const spanContext = activeSpan.spanContext();
      traceId = spanContext.traceId;
      spanId = spanContext.spanId;
      correlationId = traceId; // Use trace ID as correlation ID
      
      // Set OTEL attributes for the request
      activeSpan.setAttributes({
        [SemanticAttributes.HTTP_METHOD]: req.method,
        [SemanticAttributes.HTTP_URL]: req.url,
        [SemanticAttributes.HTTP_ROUTE]: req.route?.path || req.path,
        [SemanticAttributes.HTTP_USER_AGENT]: req.headers['user-agent'] || '',
        [SemanticAttributes.HTTP_CLIENT_IP]: req.ip || '',
        'http.request.id': `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        'fortium.service.name': 'monitoring-web-service',
        'fortium.request.start_time': new Date(startTime).toISOString(),
      });
      
      // Add custom headers as baggage if enabled
      if (config.propagateCustomHeaders) {
        const sessionId = req.headers[config.sessionHeaderName] as string;
        if (sessionId) {
          api.propagation.setBaggage(activeContext, api.propagation.getBaggage(activeContext) || api.propagation.createBaggage(), 'session.id', sessionId);
        }
      }
    } else {
      // Fallback to custom correlation ID generation (backward compatibility)
      correlationId = req.headers[config.correlationHeaderName] as string;
      if (!correlationId && config.generateNewCorrelationId) {
        correlationId = `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }
      
      // Extract other correlation headers for backward compatibility
      traceId = req.headers[config.traceHeaderName] as string || correlationId;
      spanId = req.headers[config.spanHeaderName] as string || `span_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // Extract session ID (always from headers for backward compatibility)
    const sessionId = req.headers[config.sessionHeaderName] as string;
    
    // Generate unique request ID (always generated)
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create enhanced log context with OTEL integration
    const logContext: LogContext = {
      correlationId,
      sessionId,
      traceId,
      spanId,
      requestId,
      userId: (req as any).user?.id,
      tenantId: (req as any).tenant?.id,
      // OTEL-specific context
      ...(activeSpan && {
        'otel.trace_id': activeSpan.spanContext().traceId,
        'otel.span_id': activeSpan.spanContext().spanId,
        'otel.trace_flags': activeSpan.spanContext().traceFlags,
      }),
    };
    
    // Attach context to request
    req.correlationId = correlationId;
    req.sessionId = sessionId;
    req.traceId = traceId;
    req.spanId = spanId;
    req.requestId = requestId;
    req.logContext = logContext;
    req.otelSpan = activeSpan;
    req.otelContext = activeContext;
    
    // Create OTEL-enhanced contextual logger
    req.logger = createOTELContextualLogger(logContext, activeSpan);
    
    // Add correlation headers to response (backward compatibility)
    if (config.includeInResponse) {
      if (correlationId) res.setHeader(config.correlationHeaderName, correlationId);
      if (sessionId) res.setHeader(config.sessionHeaderName, sessionId);
      if (traceId) res.setHeader(config.traceHeaderName, traceId);
      if (spanId) res.setHeader(config.spanHeaderName, spanId);
      res.setHeader('x-request-id', requestId);
      
      // Add OTEL headers if enabled
      if (config.enableOTEL && activeSpan) {
        res.setHeader('x-otel-trace-id', activeSpan.spanContext().traceId);
        res.setHeader('x-otel-span-id', activeSpan.spanContext().spanId);
      }
    }
    
    // Log request start with OTEL attributes
    if (config.logRequests) {
      const requestAttributes = {
        method: req.method,
        url: req.url,
        path: req.path,
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        headers: sanitizeHeaders(req.headers),
        startTime: new Date(startTime).toISOString(),
        event: 'http.request.start',
        'otel.enabled': config.enableOTEL,
        'otel.span.active': !!activeSpan,
      };
      
      req.logger.info('HTTP request started', requestAttributes);
      
      // Add OTEL span events
      if (config.enableOTEL && activeSpan) {
        activeSpan.addEvent('http.request.start', {
          'http.method': req.method,
          'http.url': req.url,
          'http.user_agent': req.headers['user-agent'] || '',
        });
      }
    }
    
    // Enhanced response end handling with OTEL integration
    const originalEnd = res.end;
    res.end = function(this: Response, chunk?: any, encoding?: any): Response {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Set OTEL span attributes for response
      if (config.enableOTEL && activeSpan) {
        activeSpan.setAttributes({
          [SemanticAttributes.HTTP_STATUS_CODE]: res.statusCode,
          [SemanticAttributes.HTTP_RESPONSE_SIZE]: res.getHeader('content-length') || 0,
          'http.response.duration_ms': duration,
          'http.response.end_time': new Date(endTime).toISOString(),
        });
        
        // Set span status based on HTTP status code
        if (res.statusCode >= 400) {
          activeSpan.setStatus({
            code: api.SpanStatusCode.ERROR,
            message: `HTTP ${res.statusCode}`,
          });
        } else {
          activeSpan.setStatus({
            code: api.SpanStatusCode.OK,
          });
        }
        
        // Add response event
        activeSpan.addEvent('http.request.end', {
          'http.status_code': res.statusCode,
          'http.response.duration_ms': duration,
        });
      }
      
      if (config.logRequests) {
        const responseAttributes = {
          method: req.method,
          url: req.url,
          path: req.path,
          statusCode: res.statusCode,
          duration,
          endTime: new Date(endTime).toISOString(),
          event: 'http.request.end',
          performance: categorizePerformance(duration),
          'otel.enabled': config.enableOTEL,
          'otel.span.active': !!activeSpan,
        };
        
        req.logger.info('HTTP request completed', responseAttributes);
      }
      
      // End OTEL span if we created it
      if (config.enableOTEL && activeSpan && activeSpan.isRecording()) {
        activeSpan.end();
      }
      
      // Restore original end function
      return originalEnd.call(this, chunk, encoding);
    };
    
    // Enhanced error handling with OTEL integration
    const originalNext = next;
    const contextualNext = (err?: any): void => {
      if (err) {
        // Record exception in OTEL span
        if (config.enableOTEL && activeSpan) {
          activeSpan.recordException(err);
          activeSpan.setStatus({
            code: api.SpanStatusCode.ERROR,
            message: err.message || 'Request error',
          });
          
          activeSpan.addEvent('http.request.error', {
            'error.type': err.constructor.name,
            'error.message': err.message,
            'error.stack': err.stack,
          });
        }
        
        const errorAttributes = {
          method: req.method,
          url: req.url,
          path: req.path,
          error: err.message,
          stack: err.stack,
          statusCode: err.statusCode || 500,
          event: 'http.request.error',
          'otel.enabled': config.enableOTEL,
          'otel.span.active': !!activeSpan,
        };
        
        req.logger.error('Request error occurred', errorAttributes);
      }
      originalNext(err);
    };
    
    contextualNext();
  };
}

/**
 * Create OTEL-enhanced contextual logger
 */
function createOTELContextualLogger(context: LogContext, span?: api.Span): winston.Logger {
  const baseLogger = createContextualLogger(context);
  
  if (!span) {
    return baseLogger;
  }
  
  // Enhanced logger with OTEL span correlation
  const enhancedLogger = baseLogger.child({
    'otel.trace_id': span.spanContext().traceId,
    'otel.span_id': span.spanContext().spanId,
    'otel.trace_flags': span.spanContext().traceFlags,
  });
  
  // Override log methods to add span events
  const originalLog = enhancedLogger.log;
  enhancedLogger.log = function(level: any, message: any, meta?: any): any {
    // Add span event for error and warn levels
    if (span.isRecording() && (level === 'error' || level === 'warn')) {
      span.addEvent(`log.${level}`, {
        'log.message': typeof message === 'string' ? message : JSON.stringify(message),
        'log.level': level,
        ...(meta && { 'log.meta': JSON.stringify(meta) }),
      });
    }
    
    return originalLog.call(this, level, message, meta);
  };
  
  return enhancedLogger;
}

/**
 * OTEL-native span creation utilities
 */
export function createOTELSpan(req: Request, operationName: string, attributes?: Record<string, any>): api.Span {
  const tracer = api.trace.getTracer('fortium-monitoring-service', '1.0.0');
  
  const spanAttributes = {
    'operation.name': operationName,
    'service.name': 'fortium-monitoring-service',
    'request.id': req.requestId,
    'correlation.id': req.correlationId,
    ...attributes,
  };
  
  return tracer.startSpan(operationName, {
    attributes: spanAttributes,
    parent: req.otelContext,
  });
}

/**
 * OTEL context propagation utilities
 */
export function withOTELContext<T>(req: Request, operation: () => Promise<T> | T): Promise<T> {
  if (!req.otelContext) {
    return Promise.resolve(operation());
  }
  
  return api.context.with(req.otelContext, async () => {
    return await operation();
  });
}

/**
 * Enhanced database operation correlation with OTEL
 */
export function correlateDbOperationWithOTEL<T>(
  req: Request,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const span = createOTELSpan(req, `db.${operation}`, {
    'db.operation': operation,
    'db.system': 'postgresql', // Adjust based on your database
  });
  
  const startTime = Date.now();
  
  req.logger.debug('Database operation started', {
    operation,
    event: 'db.operation.start',
    'otel.trace_id': span.spanContext().traceId,
    'otel.span_id': span.spanContext().spanId,
  });
  
  return withOTELContext(req, async () => {
    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      
      span.setAttributes({
        'db.operation.duration_ms': duration,
        'db.operation.status': 'success',
      });
      
      span.addEvent('db.operation.success', {
        'db.operation.duration_ms': duration,
      });
      
      req.logger.debug('Database operation completed', {
        operation,
        duration,
        event: 'db.operation.success',
        'otel.trace_id': span.spanContext().traceId,
        'otel.span_id': span.spanContext().spanId,
      });
      
      // Log slow queries
      if (duration > 1000) {
        span.addEvent('db.operation.slow', {
          'db.operation.duration_ms': duration,
          'db.operation.threshold_ms': 1000,
        });
        
        req.logger.warn('Slow database operation detected', {
          operation,
          duration,
          event: 'db.operation.slow',
          'otel.trace_id': span.spanContext().traceId,
          'otel.span_id': span.spanContext().spanId,
        });
      }
      
      span.setStatus({ code: api.SpanStatusCode.OK });
      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      span.recordException(error);
      span.setAttributes({
        'db.operation.duration_ms': duration,
        'db.operation.status': 'error',
        'db.operation.error': error.message,
      });
      
      span.setStatus({
        code: api.SpanStatusCode.ERROR,
        message: error.message,
      });
      
      req.logger.error('Database operation failed', {
        operation,
        duration,
        error: error.message,
        stack: error.stack,
        event: 'db.operation.error',
        'otel.trace_id': span.spanContext().traceId,
        'otel.span_id': span.spanContext().spanId,
      });
      
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Enhanced API call correlation with OTEL
 */
export function correlateApiCallWithOTEL<T>(
  req: Request,
  service: string,
  endpoint: string,
  fn: () => Promise<T>
): Promise<T> {
  const span = createOTELSpan(req, `api.${service}`, {
    'http.client.service': service,
    'http.client.endpoint': endpoint,
    'http.client.method': 'unknown', // Should be provided by caller
  });
  
  const startTime = Date.now();
  
  req.logger.info('External API call started', {
    service,
    endpoint,
    event: 'api.call.start',
    'otel.trace_id': span.spanContext().traceId,
    'otel.span_id': span.spanContext().spanId,
  });
  
  return withOTELContext(req, async () => {
    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      
      span.setAttributes({
        'http.client.duration_ms': duration,
        'http.client.status': 'success',
      });
      
      span.addEvent('api.call.success', {
        'http.client.duration_ms': duration,
      });
      
      req.logger.info('External API call completed', {
        service,
        endpoint,
        duration,
        event: 'api.call.success',
        'otel.trace_id': span.spanContext().traceId,
        'otel.span_id': span.spanContext().spanId,
      });
      
      span.setStatus({ code: api.SpanStatusCode.OK });
      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      span.recordException(error);
      span.setAttributes({
        'http.client.duration_ms': duration,
        'http.client.status': 'error',
        'http.client.error': error.message,
      });
      
      span.setStatus({
        code: api.SpanStatusCode.ERROR,
        message: error.message,
      });
      
      req.logger.error('External API call failed', {
        service,
        endpoint,
        duration,
        error: error.message,
        event: 'api.call.error',
        'otel.trace_id': span.spanContext().traceId,
        'otel.span_id': span.spanContext().spanId,
      });
      
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Enhanced performance tracking decorator with OTEL
 */
export function trackPerformanceWithOTEL(target: any, propertyName: string, descriptor: PropertyDescriptor): void {
  const method = descriptor.value;
  
  descriptor.value = function(...args: any[]): any {
    const req = args.find((arg: any) => arg && arg.correlationId) as Request;
    
    if (!req) {
      return method.apply(this, args);
    }
    
    const span = createOTELSpan(req, `${target.constructor.name}.${propertyName}`, {
      'code.function': propertyName,
      'code.namespace': target.constructor.name,
    });
    
    const startTime = Date.now();
    
    req.logger.debug('Method execution started', {
      className: target.constructor.name,
      methodName: propertyName,
      event: 'method.start',
      'otel.trace_id': span.spanContext().traceId,
      'otel.span_id': span.spanContext().spanId,
    });
    
    try {
      const result = method.apply(this, args);
      
      if (result && typeof result.then === 'function') {
        return result.then((value: any) => {
          const duration = Date.now() - startTime;
          
          span.setAttributes({
            'method.duration_ms': duration,
            'method.status': 'success',
            'method.async': true,
          });
          
          span.addEvent('method.success', {
            'method.duration_ms': duration,
          });
          
          req.logger.debug('Async method execution completed', {
            className: target.constructor.name,
            methodName: propertyName,
            duration,
            event: 'method.success',
            'otel.trace_id': span.spanContext().traceId,
            'otel.span_id': span.spanContext().spanId,
          });
          
          span.setStatus({ code: api.SpanStatusCode.OK });
          span.end();
          return value;
        }).catch((error: any) => {
          const duration = Date.now() - startTime;
          
          span.recordException(error);
          span.setAttributes({
            'method.duration_ms': duration,
            'method.status': 'error',
            'method.error': error.message,
            'method.async': true,
          });
          
          span.setStatus({
            code: api.SpanStatusCode.ERROR,
            message: error.message,
          });
          
          req.logger.error('Async method execution failed', {
            className: target.constructor.name,
            methodName: propertyName,
            duration,
            error: error.message,
            event: 'method.error',
            'otel.trace_id': span.spanContext().traceId,
            'otel.span_id': span.spanContext().spanId,
          });
          
          span.end();
          throw error;
        });
      } else {
        const duration = Date.now() - startTime;
        
        span.setAttributes({
          'method.duration_ms': duration,
          'method.status': 'success',
          'method.async': false,
        });
        
        req.logger.debug('Method execution completed', {
          className: target.constructor.name,
          methodName: propertyName,
          duration,
          event: 'method.success',
          'otel.trace_id': span.spanContext().traceId,
          'otel.span_id': span.spanContext().spanId,
        });
        
        span.setStatus({ code: api.SpanStatusCode.OK });
        span.end();
        return result;
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      span.recordException(error);
      span.setAttributes({
        'method.duration_ms': duration,
        'method.status': 'error',
        'method.error': error.message,
        'method.async': false,
      });
      
      span.setStatus({
        code: api.SpanStatusCode.ERROR,
        message: error.message,
      });
      
      req.logger.error('Method execution failed', {
        className: target.constructor.name,
        methodName: propertyName,
        duration,
        error: error.message,
        event: 'method.error',
        'otel.trace_id': span.spanContext().traceId,
        'otel.span_id': span.spanContext().spanId,
      });
      
      span.end();
      throw error;
    }
  };
}

/**
 * Migration utilities for gradual rollout
 */
export function createMigrationMiddleware(enableOTEL: boolean = false) {
  return otelCorrelationMiddleware({
    enableOTEL,
    backwardCompatible: true,
    propagateCustomHeaders: true,
  });
}

/**
 * Backward compatible exports
 */
export const defaultOTELCorrelationMiddleware = otelCorrelationMiddleware({
  enableOTEL: true,
  backwardCompatible: true,
});

export const lightOTELCorrelationMiddleware = otelCorrelationMiddleware({
  enableOTEL: true,
  backwardCompatible: true,
  logRequests: false,
});

/**
 * Legacy compatibility functions
 */
export function getCorrelationId(req: Request): string | undefined {
  return req.correlationId;
}

export function getLogContext(req: Request): LogContext {
  return req.logContext || {};
}

export function createSpan(req: Request, operationName: string): LogContext {
  // For backward compatibility, return enhanced context with OTEL data
  const otelSpan = req.otelSpan;
  const parentSpanId = req.spanId || req.correlationId;
  const newSpanId = otelSpan ? otelSpan.spanContext().spanId : `span_${Math.random().toString(36).substr(2, 9)}`;
  
  return {
    ...req.logContext,
    spanId: newSpanId,
    parentSpanId: parentSpanId,
    operationName,
    traceId: req.traceId || req.correlationId,
    ...(otelSpan && {
      'otel.trace_id': otelSpan.spanContext().traceId,
      'otel.span_id': otelSpan.spanContext().spanId,
    }),
  };
}

export function logOperation(
  req: Request,
  level: 'info' | 'warn' | 'error',
  message: string,
  properties?: Record<string, any>
): void {
  req.logger.log(level, message, {
    ...properties,
    event: properties?.event || 'operation',
    timestamp: new Date().toISOString(),
    ...(req.otelSpan && {
      'otel.trace_id': req.otelSpan.spanContext().traceId,
      'otel.span_id': req.otelSpan.spanContext().spanId,
    }),
  });
}

/**
 * Sanitize headers for logging (remove sensitive data)
 */
function sanitizeHeaders(headers: Record<string, any>): Record<string, any> {
  const sensitiveHeaders = [
    'authorization',
    'cookie',
    'x-api-key',
    'x-auth-token',
    'x-access-token',
  ];
  
  const sanitized: Record<string, any> = {};
  
  Object.keys(headers).forEach(key => {
    const lowerKey = key.toLowerCase();
    if (sensitiveHeaders.includes(lowerKey)) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = headers[key];
    }
  });
  
  return sanitized;
}

/**
 * Categorize request performance
 */
function categorizePerformance(duration: number): string {
  if (duration < 100) return 'fast';
  if (duration < 500) return 'normal';
  if (duration < 2000) return 'slow';
  return 'very_slow';
}

export default otelCorrelationMiddleware;