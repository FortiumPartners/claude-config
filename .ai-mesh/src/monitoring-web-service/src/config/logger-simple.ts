/**
 * Simple Enhanced Logger with OTEL Integration
 * Sprint 3: Task 3.2 - Structured Logging Integration (Simplified)
 * 
 * Focused implementation without external transport dependencies for testing
 */

import * as winston from 'winston';
import { config } from './environment';

// OTEL integration (with fallbacks for testing)
let api: any = null;
let SemanticResourceAttributes: any = null;

// OTEL Feature Flags - simplified for logger integration
interface OTELLogFeatureFlags {
  enabled: boolean;
  logs: boolean;
}

// Check OTEL feature flags from environment
function getOTELLogFeatureFlags(): OTELLogFeatureFlags {
  const enabled = process.env.OTEL_ENABLED !== 'false' && !config.isTest;
  return {
    enabled,
    logs: enabled && process.env.OTEL_LOGS_ENABLED !== 'false',
  };
}

const otelLogFeatures = getOTELLogFeatureFlags();

// Initialize OTEL imports if available and enabled
function initializeOTEL() {
  if (otelLogFeatures.enabled) {
    try {
      // Use require for compatibility with test environment
      api = require('@opentelemetry/api');
      const semanticConventions = require('@opentelemetry/semantic-conventions');
      SemanticResourceAttributes = semanticConventions.SemanticResourceAttributes;
    } catch (error) {
      // Silently continue without OTEL in test/development
      otelLogFeatures.enabled = false;
      otelLogFeatures.logs = false;
    }
  }
}

// Initialize OTEL synchronously
initializeOTEL();

// Define custom log levels
const customLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    debug: 'blue',
  },
};

// Add colors to winston
winston.addColors(customLevels.colors);

// OTEL Context Extraction Utilities
interface OTELContext {
  traceId?: string;
  spanId?: string;
  traceFlags?: number;
  baggage?: Record<string, string>;
}

/**
 * Extract OTEL trace context from active span (performance-optimized)
 */
function extractOTELContext(): OTELContext {
  if (!otelLogFeatures.logs || !otelLogFeatures.enabled || !api) {
    return {};
  }

  try {
    const activeSpan = api.trace.getActiveSpan();
    if (!activeSpan) {
      return {};
    }

    const spanContext = activeSpan.spanContext();
    const baggage = api.propagation.getBaggage(api.context.active());
    
    return {
      traceId: spanContext.traceId,
      spanId: spanContext.spanId,
      traceFlags: spanContext.traceFlags,
      baggage: baggage ? Object.fromEntries(baggage.getAllEntries()) : undefined,
    };
  } catch (error) {
    // Silently handle OTEL context extraction errors to prevent logging failures
    return {};
  }
}

/**
 * Create service resource attributes following OTEL semantic conventions
 */
function getServiceResourceAttributes(): Record<string, any> {
  // Extract service info from environment or use defaults
  const serviceName = process.env.OTEL_SERVICE_NAME || 'fortium-metrics-web-service';
  const serviceVersion = process.env.OTEL_SERVICE_VERSION || process.env.npm_package_version || '1.0.0';
  const serviceNamespace = process.env.OTEL_SERVICE_NAMESPACE || 'fortium-platform';
  
  const attributes: Record<string, any> = {
    'service.name': serviceName,
    'service.version': serviceVersion,
    'service.namespace': serviceNamespace,
    'service.instance.id': `${process.pid}-${Date.now()}`,
    'deployment.environment': config.nodeEnv,
    'service.component': 'metrics-collection',
    'service.team': 'fortium-platform',
  };

  // Add OTEL semantic resource attributes if available
  if (SemanticResourceAttributes) {
    attributes[SemanticResourceAttributes.SERVICE_NAME] = serviceName;
    attributes[SemanticResourceAttributes.SERVICE_VERSION] = serviceVersion;
    attributes[SemanticResourceAttributes.SERVICE_NAMESPACE] = serviceNamespace;
    attributes[SemanticResourceAttributes.SERVICE_INSTANCE_ID] = `${process.pid}-${Date.now()}`;
    attributes[SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT] = config.nodeEnv;
  }

  return attributes;
}

// Enhanced formatter with OTEL context
const enhancedFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  // Inject OTEL context into every log entry
  winston.format((info) => {
    const otelContext = extractOTELContext();
    if (otelContext.traceId) {
      info['trace.trace_id'] = otelContext.traceId;
      info['trace.span_id'] = otelContext.spanId;
      info['trace.trace_flags'] = otelContext.traceFlags;
    }
    
    // Add service resource attributes
    const serviceAttrs = getServiceResourceAttributes();
    Object.assign(info, serviceAttrs);
    
    return info;
  })(),
  winston.format.json()
);

// Create logger instance
export const logger = winston.createLogger({
  level: config.log.level,
  levels: customLevels.levels,
  format: enhancedFormat,
  defaultMeta: {
    'service.name': 'fortium-metrics-web-service',
    'deployment.environment': config.nodeEnv,
  },
  transports: [
    new winston.transports.Console({
      handleExceptions: true,
      handleRejections: true,
    }),
  ],
  exitOnError: false,
});

// Enhanced LogContext with OTEL Semantic Conventions
export interface LogContext {
  // Backward compatibility - existing correlation fields
  correlationId?: string;
  sessionId?: string;
  userId?: string;
  tenantId?: string;
  traceId?: string;
  spanId?: string;
  requestId?: string;
  operationName?: string;
  parentSpanId?: string;
  
  // OTEL semantic conventions - trace context
  'trace.trace_id'?: string;
  'trace.span_id'?: string;
  'trace.trace_flags'?: number;
  
  // OTEL semantic conventions - service attributes
  'service.name'?: string;
  'service.version'?: string;
  'service.namespace'?: string;
  'service.instance.id'?: string;
  
  // OTEL semantic conventions - HTTP attributes
  'http.method'?: string;
  'http.url'?: string;
  'http.route'?: string;
  'http.status_code'?: number;
  'http.user_agent'?: string;
  'http.client_ip'?: string;
  
  // OTEL semantic conventions - database attributes
  'db.system'?: string;
  'db.operation'?: string;
  'db.statement'?: string;
  'db.name'?: string;
  
  // OTEL semantic conventions - authentication attributes
  'enduser.id'?: string;
  'enduser.role'?: string;
  'enduser.scope'?: string;
  
  // OTEL semantic conventions - error attributes
  'error.type'?: string;
  'error.message'?: string;
  'error.stack'?: string;
  
  // Custom Fortium attributes
  'fortium.tenant.id'?: string;
  'fortium.user.id'?: string;
  'fortium.correlation.id'?: string;
  'fortium.request.id'?: string;
  'fortium.operation.name'?: string;
  
  // Performance attributes
  'performance.duration_ms'?: number;
  'performance.category'?: 'fast' | 'normal' | 'slow' | 'very_slow';
  
  // Additional structured attributes
  [key: string]: any;
}

/**
 * Create OTEL-enhanced contextual logger with automatic trace correlation
 */
export function createContextualLogger(context: LogContext): winston.Logger {
  // Merge existing context with OTEL context
  const otelContext = extractOTELContext();
  const serviceAttrs = getServiceResourceAttributes();
  
  const enhancedContext: LogContext = {
    ...context,
    ...serviceAttrs,
    
    // OTEL trace correlation (override any existing values)
    ...(otelContext.traceId && {
      'trace.trace_id': otelContext.traceId,
      'trace.span_id': otelContext.spanId,
      'trace.trace_flags': otelContext.traceFlags,
    }),
    
    // Map legacy fields to OTEL semantic conventions
    ...(context.userId && { 'enduser.id': context.userId }),
    ...(context.tenantId && { 'fortium.tenant.id': context.tenantId }),
    ...(context.correlationId && { 'fortium.correlation.id': context.correlationId }),
    ...(context.requestId && { 'fortium.request.id': context.requestId }),
    ...(context.operationName && { 'fortium.operation.name': context.operationName }),
  };
  
  return logger.child(enhancedContext);
}

/**
 * OTEL-enhanced structured logging with semantic conventions and trace correlation
 */
export function logWithContext(
  level: 'error' | 'warn' | 'info' | 'debug',
  message: string,
  context?: LogContext,
  properties?: Record<string, any>
): void {
  // Create enhanced context with OTEL integration
  const otelContext = extractOTELContext();
  const serviceAttrs = getServiceResourceAttributes();
  
  const enhancedProperties = {
    ...context,
    ...properties,
    ...serviceAttrs,
    
    // OTEL trace correlation
    ...(otelContext.traceId && {
      'trace.trace_id': otelContext.traceId,
      'trace.span_id': otelContext.spanId,
      'trace.trace_flags': otelContext.traceFlags,
    }),
    
    // Standard log attributes following OTEL conventions
    timestamp: new Date().toISOString(),
    'log.level': level,
    'log.logger': 'winston',
    
    // Map legacy context to OTEL semantic conventions
    ...(context?.userId && { 'enduser.id': context.userId }),
    ...(context?.tenantId && { 'fortium.tenant.id': context.tenantId }),
    ...(context?.correlationId && { 'fortium.correlation.id': context.correlationId }),
    ...(context?.requestId && { 'fortium.request.id': context.requestId }),
  };
  
  logger.log(level, message, enhancedProperties);
  
  // Add span event if OTEL is enabled and span is active
  if (otelLogFeatures.logs && otelContext.traceId && api) {
    try {
      const activeSpan = api.trace.getActiveSpan();
      if (activeSpan && activeSpan.isRecording()) {
        activeSpan.addEvent(`log.${level}`, {
          'log.message': message,
          'log.level': level,
          'log.timestamp': new Date().toISOString(),
          ...(properties && Object.keys(properties).length > 0 && { 
            'log.attributes': JSON.stringify(properties) 
          }),
        });
      }
    } catch (error) {
      // Silently ignore OTEL span event errors to prevent logging disruption
    }
  }
}

// OTEL-Enhanced Helper Functions with Semantic Conventions
export const loggers = {
  // Authentication events with OTEL semantic conventions
  auth: {
    login: (userId: string, tenantId: string, metadata?: Record<string, any>) => {
      const otelContext = extractOTELContext();
      
      logger.info('User login successful', {
        // Legacy fields for backward compatibility
        userId,
        tenantId,
        event: 'auth.login',
        correlationId: metadata?.correlationId,
        
        // OTEL semantic conventions
        'enduser.id': userId,
        'fortium.tenant.id': tenantId,
        'auth.method': metadata?.authMethod || 'jwt',
        'auth.provider': metadata?.provider || 'local',
        'event.domain': 'authentication',
        'event.name': 'login',
        'event.outcome': 'success',
        
        // OTEL trace correlation
        ...(otelContext.traceId && {
          'trace.trace_id': otelContext.traceId,
          'trace.span_id': otelContext.spanId,
        }),
        
        // Performance and security attributes
        'auth.session.duration_ms': metadata?.sessionDuration,
        'auth.login.attempts': metadata?.attempts || 1,
        'client.ip': metadata?.clientIp,
        'user_agent.original': metadata?.userAgent,
        
        ...metadata,
      });
    },
    
    loginFailed: (email: string, reason: string, metadata?: Record<string, any>) => {
      const otelContext = extractOTELContext();
      
      logger.warn('User login failed', {
        // Legacy fields
        email,
        reason,
        event: 'auth.login_failed',
        correlationId: metadata?.correlationId,
        
        // OTEL semantic conventions
        'enduser.email': email,
        'auth.failure.reason': reason,
        'event.domain': 'authentication',
        'event.name': 'login',
        'event.outcome': 'failure',
        'error.type': 'AuthenticationError',
        'error.message': reason,
        
        // OTEL trace correlation
        ...(otelContext.traceId && {
          'trace.trace_id': otelContext.traceId,
          'trace.span_id': otelContext.spanId,
        }),
        
        // Security attributes
        'auth.login.attempts': metadata?.attempts || 1,
        'client.ip': metadata?.clientIp,
        'user_agent.original': metadata?.userAgent,
        
        ...metadata,
      });
    },
    
    logout: (userId: string, tenantId: string, metadata?: Record<string, any>) => {
      const otelContext = extractOTELContext();
      
      logger.info('User logout', {
        // Legacy fields
        userId,
        tenantId,
        event: 'auth.logout',
        correlationId: metadata?.correlationId,
        
        // OTEL semantic conventions
        'enduser.id': userId,
        'fortium.tenant.id': tenantId,
        'event.domain': 'authentication',
        'event.name': 'logout',
        'event.outcome': 'success',
        'auth.session.end_time': new Date().toISOString(),
        
        // OTEL trace correlation
        ...(otelContext.traceId && {
          'trace.trace_id': otelContext.traceId,
          'trace.span_id': otelContext.spanId,
        }),
        
        ...metadata,
      });
    },
    
    tokenRefresh: (userId: string, tenantId: string, metadata?: Record<string, any>) => {
      const otelContext = extractOTELContext();
      
      logger.info('Token refresh', {
        // Legacy fields
        userId,
        tenantId,
        event: 'auth.token_refresh',
        correlationId: metadata?.correlationId,
        
        // OTEL semantic conventions
        'enduser.id': userId,
        'fortium.tenant.id': tenantId,
        'event.domain': 'authentication',
        'event.name': 'token_refresh',
        'event.outcome': 'success',
        'auth.token.type': 'jwt',
        'auth.token.expiry_time': metadata?.expiryTime,
        
        // OTEL trace correlation
        ...(otelContext.traceId && {
          'trace.trace_id': otelContext.traceId,
          'trace.span_id': otelContext.spanId,
        }),
        
        ...metadata,
      });
    },
    
    authorizationFailed: (userId: string, tenantId: string, reason: string, metadata?: Record<string, any>) => {
      const otelContext = extractOTELContext();
      
      logger.warn('Authorization failed', {
        // Legacy fields
        userId,
        tenantId,
        reason,
        event: 'auth.authorization_failed',
        correlationId: metadata?.correlationId,
        
        // OTEL semantic conventions
        'enduser.id': userId,
        'fortium.tenant.id': tenantId,
        'event.domain': 'authorization',
        'event.name': 'access_denied',
        'event.outcome': 'failure',
        'error.type': 'AuthorizationError',
        'error.message': reason,
        'auth.failure.reason': reason,
        
        // OTEL trace correlation
        ...(otelContext.traceId && {
          'trace.trace_id': otelContext.traceId,
          'trace.span_id': otelContext.spanId,
        }),
        
        // Authorization context
        'auth.required_permissions': metadata?.requiredPermissions,
        'auth.user_permissions': metadata?.userPermissions,
        'http.route': metadata?.route,
        
        ...metadata,
      });
    },
  },

  // API request events with OTEL HTTP semantic conventions
  api: {
    request: (method: string, path: string, userId?: string, tenantId?: string, metadata?: Record<string, any>) => {
      const otelContext = extractOTELContext();
      
      logger.info('API request', {
        // Legacy fields
        method,
        path,
        userId,
        tenantId,
        event: 'api.request',
        correlationId: metadata?.correlationId,
        
        // OTEL HTTP semantic conventions
        'http.method': method,
        'http.route': path,
        'http.url': metadata?.url,
        'http.scheme': metadata?.scheme || 'https',
        'http.user_agent': metadata?.userAgent,
        'http.client_ip': metadata?.clientIp,
        'http.request_content_length': metadata?.contentLength,
        'http.flavor': metadata?.httpVersion || '1.1',
        
        // OTEL general conventions
        'event.domain': 'http',
        'event.name': 'request',
        'enduser.id': userId,
        'fortium.tenant.id': tenantId,
        
        // OTEL trace correlation
        ...(otelContext.traceId && {
          'trace.trace_id': otelContext.traceId,
          'trace.span_id': otelContext.spanId,
        }),
        
        // Performance tracking
        'performance.start_time': new Date().toISOString(),
        
        ...metadata,
      });
    },
    
    error: (method: string, path: string, error: Error, userId?: string, tenantId?: string, metadata?: Record<string, any>) => {
      const otelContext = extractOTELContext();
      
      logger.error('API error', {
        // Legacy fields
        method,
        path,
        error: error.message,
        stack: error.stack,
        userId,
        tenantId,
        event: 'api.error',
        correlationId: metadata?.correlationId,
        
        // OTEL HTTP semantic conventions
        'http.method': method,
        'http.route': path,
        'http.status_code': metadata?.statusCode || 500,
        'http.response_content_length': metadata?.responseSize,
        
        // OTEL error conventions
        'error.type': error.constructor.name,
        'error.message': error.message,
        'error.stack': error.stack,
        'exception.type': error.constructor.name,
        'exception.message': error.message,
        'exception.stacktrace': error.stack,
        
        // OTEL general conventions
        'event.domain': 'http',
        'event.name': 'error',
        'event.outcome': 'failure',
        'enduser.id': userId,
        'fortium.tenant.id': tenantId,
        
        // OTEL trace correlation
        ...(otelContext.traceId && {
          'trace.trace_id': otelContext.traceId,
          'trace.span_id': otelContext.spanId,
        }),
        
        // Performance and context
        'performance.duration_ms': metadata?.duration,
        'performance.end_time': new Date().toISOString(),
        
        ...metadata,
      });
    },
  },

  // Database events with OTEL database semantic conventions
  database: {
    query: (query: string, duration: number, metadata?: Record<string, any>) => {
      const otelContext = extractOTELContext();
      
      logger.debug('Database query', {
        // Legacy fields
        query,
        duration,
        event: 'database.query',
        
        // OTEL database semantic conventions
        'db.system': metadata?.dbSystem || 'postgresql',
        'db.name': metadata?.dbName || 'fortium_metrics',
        'db.statement': query.length > 1000 ? query.substring(0, 1000) + '...' : query,
        'db.operation': metadata?.operation || extractDbOperation(query),
        'db.connection_string': '[REDACTED]', // Never log connection strings
        
        // OTEL general conventions
        'event.domain': 'database',
        'event.name': 'query',
        'event.outcome': 'success',
        
        // OTEL trace correlation
        ...(otelContext.traceId && {
          'trace.trace_id': otelContext.traceId,
          'trace.span_id': otelContext.spanId,
        }),
        
        // Performance tracking
        'performance.duration_ms': duration,
        'performance.category': categorizeDbPerformance(duration),
        'db.query.execution_time': duration,
        'db.query.rows_affected': metadata?.rowsAffected,
        'db.query.rows_returned': metadata?.rowsReturned,
        
        ...metadata,
      });
    },
    
    error: (error: Error, query?: string, metadata?: Record<string, any>) => {
      const otelContext = extractOTELContext();
      
      logger.error('Database error', {
        // Legacy fields
        error: error.message,
        stack: error.stack,
        query,
        event: 'database.error',
        
        // OTEL database semantic conventions
        'db.system': metadata?.dbSystem || 'postgresql',
        'db.name': metadata?.dbName || 'fortium_metrics',
        'db.statement': query && query.length > 1000 ? query.substring(0, 1000) + '...' : query,
        'db.operation': metadata?.operation || (query ? extractDbOperation(query) : 'unknown'),
        
        // OTEL error conventions
        'error.type': error.constructor.name,
        'error.message': error.message,
        'error.stack': error.stack,
        'exception.type': error.constructor.name,
        'exception.message': error.message,
        'exception.stacktrace': error.stack,
        
        // OTEL general conventions
        'event.domain': 'database',
        'event.name': 'error',
        'event.outcome': 'failure',
        
        // OTEL trace correlation
        ...(otelContext.traceId && {
          'trace.trace_id': otelContext.traceId,
          'trace.span_id': otelContext.spanId,
        }),
        
        // Database error context
        'db.error.code': (error as any).code,
        'db.error.severity': (error as any).severity,
        'db.error.constraint': (error as any).constraint,
        
        ...metadata,
      });
    },
  },

  // Security events with OTEL security semantic conventions
  security: {
    suspiciousActivity: (event: string, userId?: string, tenantId?: string, metadata?: Record<string, any>) => {
      const otelContext = extractOTELContext();
      
      logger.warn('Suspicious activity detected', {
        // Legacy fields
        event,
        userId,
        tenantId,
        eventType: 'security.suspicious_activity',
        
        // OTEL security conventions
        'event.domain': 'security',
        'event.name': 'suspicious_activity',
        'event.outcome': 'failure',
        'event.action': event,
        'threat.technique.name': metadata?.technique,
        'threat.tactic.name': metadata?.tactic,
        
        // User context
        'enduser.id': userId,
        'fortium.tenant.id': tenantId,
        'client.ip': metadata?.clientIp,
        'user_agent.original': metadata?.userAgent,
        
        // OTEL trace correlation
        ...(otelContext.traceId && {
          'trace.trace_id': otelContext.traceId,
          'trace.span_id': otelContext.spanId,
        }),
        
        // Security context
        'security.detection.rule': metadata?.rule,
        'security.risk_score': metadata?.riskScore,
        'security.severity': metadata?.severity || 'medium',
        
        ...metadata,
      });
    },
    
    rateLimit: (ip: string, endpoint: string, metadata?: Record<string, any>) => {
      const otelContext = extractOTELContext();
      
      logger.warn('Rate limit exceeded', {
        // Legacy fields
        ip,
        endpoint,
        event: 'security.rate_limit_exceeded',
        
        // OTEL security conventions
        'event.domain': 'security',
        'event.name': 'rate_limit_exceeded',
        'event.outcome': 'failure',
        'client.ip': ip,
        'http.route': endpoint,
        
        // OTEL trace correlation
        ...(otelContext.traceId && {
          'trace.trace_id': otelContext.traceId,
          'trace.span_id': otelContext.spanId,
        }),
        
        // Rate limiting context
        'rate_limit.policy': metadata?.policy,
        'rate_limit.limit': metadata?.limit,
        'rate_limit.current': metadata?.current,
        'rate_limit.window_seconds': metadata?.windowSeconds,
        'rate_limit.reset_time': metadata?.resetTime,
        
        ...metadata,
      });
    },
  },

  // Performance events with OTEL performance semantic conventions
  performance: {
    slowQuery: (query: string, duration: number, metadata?: Record<string, any>) => {
      const otelContext = extractOTELContext();
      
      logger.warn('Slow database query', {
        // Legacy fields
        query,
        duration,
        event: 'performance.slow_query',
        
        // OTEL database and performance conventions
        'db.system': metadata?.dbSystem || 'postgresql',
        'db.statement': query.length > 500 ? query.substring(0, 500) + '...' : query,
        'db.operation': extractDbOperation(query),
        'performance.duration_ms': duration,
        'performance.category': 'slow',
        'performance.threshold_ms': metadata?.threshold || 1000,
        
        // OTEL general conventions
        'event.domain': 'performance',
        'event.name': 'slow_query',
        'event.outcome': 'success', // Query succeeded but was slow
        
        // OTEL trace correlation
        ...(otelContext.traceId && {
          'trace.trace_id': otelContext.traceId,
          'trace.span_id': otelContext.spanId,
        }),
        
        ...metadata,
      });
    },
    
    slowRequest: (method: string, path: string, duration: number, metadata?: Record<string, any>) => {
      const otelContext = extractOTELContext();
      
      logger.warn('Slow API request', {
        // Legacy fields
        method,
        path,
        duration,
        event: 'performance.slow_request',
        
        // OTEL HTTP and performance conventions
        'http.method': method,
        'http.route': path,
        'performance.duration_ms': duration,
        'performance.category': 'slow',
        'performance.threshold_ms': metadata?.threshold || 1000,
        
        // OTEL general conventions
        'event.domain': 'performance',
        'event.name': 'slow_request',
        'event.outcome': 'success', // Request succeeded but was slow
        
        // OTEL trace correlation
        ...(otelContext.traceId && {
          'trace.trace_id': otelContext.traceId,
          'trace.span_id': otelContext.spanId,
        }),
        
        // Additional performance context
        'http.status_code': metadata?.statusCode,
        'http.response_size_bytes': metadata?.responseSize,
        
        ...metadata,
      });
    },
  },
};

// OTEL Integration Utility Functions

/**
 * Extract database operation from SQL query
 */
function extractDbOperation(query: string): string {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.startsWith('select')) return 'SELECT';
  if (normalizedQuery.startsWith('insert')) return 'INSERT';
  if (normalizedQuery.startsWith('update')) return 'UPDATE';
  if (normalizedQuery.startsWith('delete')) return 'DELETE';
  if (normalizedQuery.startsWith('create')) return 'CREATE';
  if (normalizedQuery.startsWith('drop')) return 'DROP';
  if (normalizedQuery.startsWith('alter')) return 'ALTER';
  return 'UNKNOWN';
}

/**
 * Categorize database performance
 */
function categorizeDbPerformance(duration: number): 'fast' | 'normal' | 'slow' | 'very_slow' {
  if (duration < 50) return 'fast';
  if (duration < 200) return 'normal';
  if (duration < 1000) return 'slow';
  return 'very_slow';
}

// Enhanced exports for OTEL integration
export {
  extractOTELContext,
  getServiceResourceAttributes,
};

/**
 * Create OTEL-aware structured log entry
 */
export function createOTELLogEntry(
  level: string,
  message: string,
  attributes: Record<string, any> = {}
): Record<string, any> {
  const otelContext = extractOTELContext();
  const serviceAttrs = getServiceResourceAttributes();
  
  return {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...serviceAttrs,
    ...(otelContext.traceId && {
      'trace.trace_id': otelContext.traceId,
      'trace.span_id': otelContext.spanId,
      'trace.trace_flags': otelContext.traceFlags,
    }),
    ...attributes,
  };
}

// HTTP log stream for compatibility
export const httpLogStream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};