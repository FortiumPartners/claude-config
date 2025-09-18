/**
 * Correlation ID Middleware
 * Fortium Monitoring Web Service - Seq Integration Sprint 1
 * Task 1.3: Correlation ID Generation and Propagation
 */

import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { createContextualLogger, LogContext } from '../config/logger';
import winston from 'winston';

// Extend Express Request to include correlation context
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
    }
  }
}

interface CorrelationOptions {
  correlationHeaderName: string;
  sessionHeaderName: string;
  traceHeaderName: string;
  spanHeaderName: string;
  generateNewCorrelationId: boolean;
  includeInResponse: boolean;
  logRequests: boolean;
}

const defaultOptions: CorrelationOptions = {
  correlationHeaderName: 'x-correlation-id',
  sessionHeaderName: 'x-session-id', 
  traceHeaderName: 'x-trace-id',
  spanHeaderName: 'x-span-id',
  generateNewCorrelationId: true,
  includeInResponse: true,
  logRequests: true,
};

/**
 * Correlation ID Middleware Factory
 * 
 * Features:
 * - Generates or extracts correlation IDs from headers
 * - Propagates correlation context through request lifecycle
 * - Creates contextual logger with correlation metadata
 * - Tracks request/response timing for performance monitoring
 */
export function correlationMiddleware(options: Partial<CorrelationOptions> = {}): (req: Request, res: Response, next: NextFunction) => void {
  const config = { ...defaultOptions, ...options };
  
  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();
    
    // Extract or generate correlation ID
    let correlationId = req.headers[config.correlationHeaderName] as string;
    if (!correlationId && config.generateNewCorrelationId) {
      correlationId = randomUUID();
    }
    
    // Extract other correlation headers
    const sessionId = req.headers[config.sessionHeaderName] as string;
    const traceId = req.headers[config.traceHeaderName] as string;
    const spanId = req.headers[config.spanHeaderName] as string;
    
    // Generate unique request ID
    const requestId = randomUUID();
    
    // Create log context
    const logContext: LogContext = {
      correlationId,
      sessionId,
      traceId,
      spanId,
      requestId,
      userId: (req as any).user?.id,
      tenantId: (req as any).tenant?.id,
    };
    
    // Attach context to request
    req.correlationId = correlationId;
    req.sessionId = sessionId;
    req.traceId = traceId;
    req.spanId = spanId;
    req.requestId = requestId;
    req.logContext = logContext;
    
    // Create contextual logger
    req.logger = createContextualLogger(logContext);
    
    // Add correlation headers to response
    if (config.includeInResponse) {
      if (correlationId) res.setHeader(config.correlationHeaderName, correlationId);
      if (sessionId) res.setHeader(config.sessionHeaderName, sessionId);
      if (traceId) res.setHeader(config.traceHeaderName, traceId);
      if (spanId) res.setHeader(config.spanHeaderName, spanId);
      res.setHeader('x-request-id', requestId);
    }
    
    // Log request start
    if (config.logRequests) {
      req.logger.info('HTTP request started', {
        method: req.method,
        url: req.url,
        path: req.path,
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        headers: sanitizeHeaders(req.headers),
        startTime: new Date(startTime).toISOString(),
        event: 'http.request.start',
      });
    }
    
    // Override res.end to log response
    const originalEnd = res.end;
    res.end = function(this: Response, chunk?: any, encoding?: any): Response {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      if (config.logRequests) {
        req.logger.info('HTTP request completed', {
          method: req.method,
          url: req.url,
          path: req.path,
          statusCode: res.statusCode,
          duration,
          endTime: new Date(endTime).toISOString(),
          event: 'http.request.end',
          performance: categorizePerformance(duration),
        });
      }
      
      // Restore original end function
      return originalEnd.call(this, chunk, encoding);
    };
    
    // Handle errors with correlation context
    const originalNext = next;
    const contextualNext = (err?: any): void => {
      if (err) {
        req.logger.error('Request error occurred', {
          method: req.method,
          url: req.url,
          path: req.path,
          error: err.message,
          stack: err.stack,
          statusCode: err.statusCode || 500,
          event: 'http.request.error',
        });
      }
      originalNext(err);
    };
    
    contextualNext();
  };
}

/**
 * Extract correlation ID from request
 */
export function getCorrelationId(req: Request): string | undefined {
  return req.correlationId;
}

/**
 * Extract full correlation context from request
 */
export function getLogContext(req: Request): LogContext {
  return req.logContext || {};
}

/**
 * Create a new child span with correlation context
 */
export function createSpan(req: Request, operationName: string): LogContext {
  const parentSpanId = req.spanId || req.correlationId;
  const newSpanId = randomUUID();
  
  return {
    ...req.logContext,
    spanId: newSpanId,
    parentSpanId: parentSpanId,
    operationName,
    traceId: req.traceId || req.correlationId,
  };
}

/**
 * Log operation with correlation context
 */
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

/**
 * Middleware for database operations with correlation
 */
export function correlateDbOperation<T>(
  req: Request,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const span = createSpan(req, `db.${operation}`);
  const startTime = Date.now();
  
  req.logger.debug('Database operation started', {
    operation,
    event: 'db.operation.start',
    ...span,
  });
  
  return fn()
    .then(result => {
      const duration = Date.now() - startTime;
      
      req.logger.debug('Database operation completed', {
        operation,
        duration,
        event: 'db.operation.success',
        ...span,
      });
      
      // Log slow queries
      if (duration > 1000) {
        req.logger.warn('Slow database operation detected', {
          operation,
          duration,
          event: 'db.operation.slow',
          ...span,
        });
      }
      
      return result;
    })
    .catch(error => {
      const duration = Date.now() - startTime;
      
      req.logger.error('Database operation failed', {
        operation,
        duration,
        error: error.message,
        stack: error.stack,
        event: 'db.operation.error',
        ...span,
      });
      
      throw error;
    });
}

/**
 * Middleware for external API calls with correlation
 */
export function correlateApiCall<T>(
  req: Request,
  service: string,
  endpoint: string,
  fn: () => Promise<T>
): Promise<T> {
  const span = createSpan(req, `api.${service}`);
  const startTime = Date.now();
  
  req.logger.info('External API call started', {
    service,
    endpoint,
    event: 'api.call.start',
    ...span,
  });
  
  return fn()
    .then(result => {
      const duration = Date.now() - startTime;
      
      req.logger.info('External API call completed', {
        service,
        endpoint,
        duration,
        event: 'api.call.success',
        ...span,
      });
      
      return result;
    })
    .catch(error => {
      const duration = Date.now() - startTime;
      
      req.logger.error('External API call failed', {
        service,
        endpoint,
        duration,
        error: error.message,
        event: 'api.call.error',
        ...span,
      });
      
      throw error;
    });
}

/**
 * Performance tracking decorator
 */
export function trackPerformance(target: any, propertyName: string, descriptor: PropertyDescriptor): void {
  const method = descriptor.value;
  
  descriptor.value = function(...args: any[]): any {
    const req = args.find((arg: any) => arg && arg.correlationId) as Request;
    
    if (!req) {
      return method.apply(this, args);
    }
    
    const startTime = Date.now();
    const span = createSpan(req, `${target.constructor.name}.${propertyName}`);
    
    req.logger.debug('Method execution started', {
      className: target.constructor.name,
      methodName: propertyName,
      event: 'method.start',
      ...span,
    });
    
    try {
      const result = method.apply(this, args);
      
      if (result && typeof result.then === 'function') {
        return result.then((value: any) => {
          const duration = Date.now() - startTime;
          req.logger.debug('Async method execution completed', {
            className: target.constructor.name,
            methodName: propertyName,
            duration,
            event: 'method.success',
            ...span,
          });
          return value;
        }).catch((error: any) => {
          const duration = Date.now() - startTime;
          req.logger.error('Async method execution failed', {
            className: target.constructor.name,
            methodName: propertyName,
            duration,
            error: error.message,
            event: 'method.error',
            ...span,
          });
          throw error;
        });
      } else {
        const duration = Date.now() - startTime;
        req.logger.debug('Method execution completed', {
          className: target.constructor.name,
          methodName: propertyName,
          duration,
          event: 'method.success',
          ...span,
        });
        return result;
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;
      req.logger.error('Method execution failed', {
        className: target.constructor.name,
        methodName: propertyName,
        duration,
        error: error.message,
        event: 'method.error',
        ...span,
      });
      throw error;
    }
  };
}

/**
 * Default correlation middleware with standard configuration
 */
export const defaultCorrelationMiddleware = correlationMiddleware({
  correlationHeaderName: 'x-correlation-id',
  sessionHeaderName: 'x-session-id',
  traceHeaderName: 'x-trace-id',
  spanHeaderName: 'x-span-id',
  generateNewCorrelationId: true,
  includeInResponse: true,
  logRequests: true,
});

/**
 * Lightweight correlation middleware for high-traffic endpoints
 */
export const lightCorrelationMiddleware = correlationMiddleware({
  correlationHeaderName: 'x-correlation-id',
  sessionHeaderName: 'x-session-id',
  traceHeaderName: 'x-trace-id',
  spanHeaderName: 'x-span-id',
  generateNewCorrelationId: true,
  includeInResponse: true,
  logRequests: false, // Disable request logging for performance
});

export default correlationMiddleware;