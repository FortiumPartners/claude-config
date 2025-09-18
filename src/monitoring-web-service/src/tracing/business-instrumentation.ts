/**
 * Custom Business Logic Instrumentation Library
 * Task 2.3: Custom Instrumentation for Business Logic
 * 
 * This module provides comprehensive OpenTelemetry instrumentation for business-specific
 * operations, focusing on meaningful insights and minimal code intrusion.
 */

import * as api from '@opentelemetry/api';
import { SemanticAttributes } from '@opentelemetry/semantic-conventions';

// Business-specific semantic attributes
export const BusinessAttributes = {
  // User & Tenant Context
  USER_ID: 'business.user.id',
  TENANT_ID: 'business.tenant.id',
  SESSION_ID: 'business.session.id',
  ORGANIZATION_ID: 'business.organization.id',
  
  // Authentication & Authorization
  AUTH_METHOD: 'business.auth.method',
  AUTH_RESULT: 'business.auth.result',
  AUTH_DURATION: 'business.auth.duration_ms',
  AUTH_TOKEN_TYPE: 'business.auth.token_type',
  AUTH_ROLE: 'business.auth.role',
  AUTH_PERMISSIONS: 'business.auth.permissions',
  
  // Metrics Processing
  METRICS_TYPE: 'business.metrics.type',
  METRICS_SOURCE: 'business.metrics.source',
  METRICS_VOLUME: 'business.metrics.volume',
  METRICS_BATCH_SIZE: 'business.metrics.batch_size',
  METRICS_PROCESSING_STAGE: 'business.metrics.processing_stage',
  METRICS_VALIDATION_RESULT: 'business.metrics.validation_result',
  
  // Cache Operations
  CACHE_OPERATION: 'business.cache.operation',
  CACHE_HIT_RATIO: 'business.cache.hit_ratio',
  CACHE_KEY_PATTERN: 'business.cache.key_pattern',
  CACHE_TTL: 'business.cache.ttl_seconds',
  CACHE_SIZE: 'business.cache.size_bytes',
  
  // External API Integrations
  API_EXTERNAL_SERVICE: 'business.api.external_service',
  API_RESPONSE_TIME: 'business.api.response_time_ms',
  API_SUCCESS_RATE: 'business.api.success_rate',
  API_RETRY_COUNT: 'business.api.retry_count',
  API_CIRCUIT_BREAKER_STATE: 'business.api.circuit_breaker_state',
  
  // WebSocket & Real-time
  WEBSOCKET_CONNECTION_ID: 'business.websocket.connection_id',
  WEBSOCKET_EVENT_TYPE: 'business.websocket.event_type',
  WEBSOCKET_SUBSCRIPTION_COUNT: 'business.websocket.subscription_count',
  WEBSOCKET_MESSAGE_SIZE: 'business.websocket.message_size_bytes',
  
  // Business Operations
  OPERATION_TYPE: 'business.operation.type',
  OPERATION_COMPLEXITY: 'business.operation.complexity',
  OPERATION_PRIORITY: 'business.operation.priority',
  OPERATION_OUTCOME: 'business.operation.outcome',
  
  // Performance & Quality
  PERFORMANCE_TIER: 'business.performance.tier',
  ERROR_CATEGORY: 'business.error.category',
  ERROR_SEVERITY: 'business.error.severity',
  ERROR_RECOVERABLE: 'business.error.recoverable',
  
  // Multi-tenant
  TENANT_ISOLATION_CHECK: 'business.tenant.isolation_check',
  TENANT_RESOURCE_QUOTA: 'business.tenant.resource_quota',
  TENANT_FEATURE_FLAGS: 'business.tenant.feature_flags'
} as const;

// Business operation types
export const OperationType = {
  AUTHENTICATION: 'authentication',
  AUTHORIZATION: 'authorization',
  METRICS_INGESTION: 'metrics_ingestion',
  METRICS_PROCESSING: 'metrics_processing',
  METRICS_AGGREGATION: 'metrics_aggregation',
  REAL_TIME_STREAMING: 'real_time_streaming',
  DATABASE_QUERY: 'database_query',
  CACHE_ACCESS: 'cache_access',
  EXTERNAL_API_CALL: 'external_api_call',
  WEBHOOK_PROCESSING: 'webhook_processing',
  WEBSOCKET_MESSAGE: 'websocket_message',
  TENANT_OPERATION: 'tenant_operation'
} as const;

// Performance tiers
export const PerformanceTier = {
  FAST: 'fast',        // < 100ms
  NORMAL: 'normal',    // 100ms - 1s
  SLOW: 'slow',        // 1s - 5s
  VERY_SLOW: 'very_slow' // > 5s
} as const;

// Error categories
export const ErrorCategory = {
  AUTHENTICATION: 'authentication',
  AUTHORIZATION: 'authorization',
  VALIDATION: 'validation',
  BUSINESS_LOGIC: 'business_logic',
  EXTERNAL_SERVICE: 'external_service',
  INFRASTRUCTURE: 'infrastructure',
  RATE_LIMIT: 'rate_limit',
  TIMEOUT: 'timeout',
  NETWORK: 'network',
  UNKNOWN: 'unknown'
} as const;

/**
 * Business Instrumentation Context
 * Carries business-specific context throughout the request lifecycle
 */
export interface BusinessContext {
  userId?: string;
  tenantId?: string;
  organizationId?: string;
  sessionId?: string;
  operationType?: string;
  requestId?: string;
  correlationId?: string;
}

/**
 * Instrumentation Configuration
 */
export interface InstrumentationConfig {
  enableDebugLogs?: boolean;
  enableMetrics?: boolean;
  enableTraces?: boolean;
  samplingRate?: number;
  maxSpanAttributeLength?: number;
}

/**
 * Main Business Instrumentation Class
 */
export class BusinessInstrumentation {
  private tracer: api.Tracer;
  private meter: api.Meter;
  private config: InstrumentationConfig;
  
  // Metrics
  private operationCounter: api.Counter;
  private operationDuration: api.Histogram;
  private errorCounter: api.Counter;
  private cacheHitCounter: api.Counter;
  private authCounter: api.Counter;

  constructor(config: InstrumentationConfig = {}) {
    this.tracer = api.trace.getTracer('fortium-business-instrumentation', '1.0.0');
    this.meter = api.metrics.getMeter('fortium-business-instrumentation', '1.0.0');
    
    this.config = {
      enableDebugLogs: true,
      enableMetrics: true,
      enableTraces: true,
      samplingRate: 1.0,
      maxSpanAttributeLength: 1000,
      ...config
    };

    this.initializeMetrics();
  }

  /**
   * Initialize OpenTelemetry metrics
   */
  private initializeMetrics(): void {
    if (!this.config.enableMetrics) return;

    this.operationCounter = this.meter.createCounter('business_operations_total', {
      description: 'Total number of business operations'
    });

    this.operationDuration = this.meter.createHistogram('business_operation_duration_ms', {
      description: 'Duration of business operations in milliseconds',
      boundaries: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]
    });

    this.errorCounter = this.meter.createCounter('business_errors_total', {
      description: 'Total number of business errors'
    });

    this.cacheHitCounter = this.meter.createCounter('business_cache_operations_total', {
      description: 'Total number of cache operations'
    });

    this.authCounter = this.meter.createCounter('business_auth_operations_total', {
      description: 'Total number of authentication operations'
    });
  }

  /**
   * Create a business operation span with automatic context propagation
   */
  createBusinessSpan<T>(
    name: string,
    operationType: string,
    operation: (span: api.Span) => Promise<T> | T,
    context?: BusinessContext,
    attributes?: Record<string, string | number | boolean>
  ): Promise<T> {
    return this.tracer.startActiveSpan(name, {
      kind: api.SpanKind.INTERNAL,
      attributes: {
        [BusinessAttributes.OPERATION_TYPE]: operationType,
        ...this.buildContextAttributes(context),
        ...attributes
      }
    }, async (span: api.Span) => {
      const startTime = Date.now();
      
      try {
        const result = await operation(span);
        
        const duration = Date.now() - startTime;
        span.setAttributes({
          [BusinessAttributes.OPERATION_OUTCOME]: 'success',
          [BusinessAttributes.PERFORMANCE_TIER]: this.categorizePerformance(duration)
        });
        
        // Record metrics
        this.recordOperationMetrics(operationType, duration, 'success', context);
        
        span.setStatus({ code: api.SpanStatusCode.OK });
        return result;
        
      } catch (error) {
        const duration = Date.now() - startTime;
        const errorCategory = this.categorizeError(error);
        
        span.setAttributes({
          [BusinessAttributes.OPERATION_OUTCOME]: 'error',
          [BusinessAttributes.ERROR_CATEGORY]: errorCategory,
          [BusinessAttributes.ERROR_SEVERITY]: this.getErrorSeverity(error),
          [BusinessAttributes.ERROR_RECOVERABLE]: this.isRecoverableError(error)
        });
        
        span.recordException(error as Error);
        span.setStatus({
          code: api.SpanStatusCode.ERROR,
          message: (error as Error).message
        });
        
        // Record error metrics
        this.recordOperationMetrics(operationType, duration, 'error', context);
        this.recordErrorMetrics(errorCategory, context);
        
        throw error;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Instrument authentication operations
   */
  instrumentAuthentication<T>(
    method: string,
    operation: (span: api.Span) => Promise<T> | T,
    context?: BusinessContext
  ): Promise<T> {
    return this.createBusinessSpan(
      `auth.${method}`,
      OperationType.AUTHENTICATION,
      async (span: api.Span) => {
        span.setAttributes({
          [BusinessAttributes.AUTH_METHOD]: method
        });
        
        const startTime = Date.now();
        try {
          const result = await operation(span);
          const duration = Date.now() - startTime;
          
          span.setAttributes({
            [BusinessAttributes.AUTH_RESULT]: 'success',
            [BusinessAttributes.AUTH_DURATION]: duration
          });
          
          // Record auth metrics
          this.authCounter.add(1, {
            method,
            result: 'success',
            tenant_id: context?.tenantId || 'unknown'
          });
          
          return result;
        } catch (error) {
          const duration = Date.now() - startTime;
          
          span.setAttributes({
            [BusinessAttributes.AUTH_RESULT]: 'failure',
            [BusinessAttributes.AUTH_DURATION]: duration
          });
          
          this.authCounter.add(1, {
            method,
            result: 'failure',
            tenant_id: context?.tenantId || 'unknown'
          });
          
          throw error;
        }
      },
      context
    );
  }

  /**
   * Instrument cache operations
   */
  instrumentCacheOperation<T>(
    operation: string,
    keyPattern: string,
    cacheOperation: (span: api.Span) => Promise<T> | T,
    context?: BusinessContext
  ): Promise<T> {
    return this.createBusinessSpan(
      `cache.${operation}`,
      OperationType.CACHE_ACCESS,
      async (span: api.Span) => {
        span.setAttributes({
          [BusinessAttributes.CACHE_OPERATION]: operation,
          [BusinessAttributes.CACHE_KEY_PATTERN]: keyPattern
        });
        
        try {
          const result = await cacheOperation(span);
          
          // Record cache hit/miss
          const hit = result !== null && result !== undefined;
          this.cacheHitCounter.add(1, {
            operation,
            result: hit ? 'hit' : 'miss',
            key_pattern: keyPattern,
            tenant_id: context?.tenantId || 'unknown'
          });
          
          span.setAttributes({
            [BusinessAttributes.CACHE_OPERATION]: hit ? 'hit' : 'miss'
          });
          
          return result;
        } catch (error) {
          this.cacheHitCounter.add(1, {
            operation,
            result: 'error',
            key_pattern: keyPattern,
            tenant_id: context?.tenantId || 'unknown'
          });
          
          throw error;
        }
      },
      context
    );
  }

  /**
   * Instrument metrics processing operations
   */
  instrumentMetricsProcessing<T>(
    stage: string,
    metricsType: string,
    batchSize: number,
    operation: (span: api.Span) => Promise<T> | T,
    context?: BusinessContext
  ): Promise<T> {
    return this.createBusinessSpan(
      `metrics.${stage}`,
      OperationType.METRICS_PROCESSING,
      async (span: api.Span) => {
        span.setAttributes({
          [BusinessAttributes.METRICS_PROCESSING_STAGE]: stage,
          [BusinessAttributes.METRICS_TYPE]: metricsType,
          [BusinessAttributes.METRICS_BATCH_SIZE]: batchSize
        });
        
        return await operation(span);
      },
      context
    );
  }

  /**
   * Instrument external API calls
   */
  instrumentExternalAPI<T>(
    serviceName: string,
    endpoint: string,
    operation: (span: api.Span) => Promise<T> | T,
    context?: BusinessContext
  ): Promise<T> {
    return this.createBusinessSpan(
      `external_api.${serviceName}`,
      OperationType.EXTERNAL_API_CALL,
      async (span: api.Span) => {
        span.setAttributes({
          [BusinessAttributes.API_EXTERNAL_SERVICE]: serviceName,
          [SemanticAttributes.HTTP_URL]: endpoint
        });
        
        const startTime = Date.now();
        try {
          const result = await operation(span);
          const responseTime = Date.now() - startTime;
          
          span.setAttributes({
            [BusinessAttributes.API_RESPONSE_TIME]: responseTime,
            [BusinessAttributes.API_SUCCESS_RATE]: 1.0
          });
          
          return result;
        } catch (error) {
          const responseTime = Date.now() - startTime;
          span.setAttributes({
            [BusinessAttributes.API_RESPONSE_TIME]: responseTime,
            [BusinessAttributes.API_SUCCESS_RATE]: 0.0
          });
          
          throw error;
        }
      },
      context
    );
  }

  /**
   * Instrument WebSocket operations
   */
  instrumentWebSocketOperation<T>(
    connectionId: string,
    eventType: string,
    operation: (span: api.Span) => Promise<T> | T,
    context?: BusinessContext
  ): Promise<T> {
    return this.createBusinessSpan(
      `websocket.${eventType}`,
      OperationType.WEBSOCKET_MESSAGE,
      async (span: api.Span) => {
        span.setAttributes({
          [BusinessAttributes.WEBSOCKET_CONNECTION_ID]: connectionId,
          [BusinessAttributes.WEBSOCKET_EVENT_TYPE]: eventType
        });
        
        return await operation(span);
      },
      context
    );
  }

  /**
   * Add business context to current span
   */
  addBusinessContext(context: BusinessContext): void {
    const currentSpan = api.trace.getActiveSpan();
    if (currentSpan) {
      currentSpan.setAttributes(this.buildContextAttributes(context));
    }
  }

  /**
   * Record custom business metric
   */
  recordBusinessMetric(
    name: string,
    value: number,
    attributes?: Record<string, string | number | boolean>
  ): void {
    if (!this.config.enableMetrics) return;
    
    const counter = this.meter.createCounter(`business_${name}_total`);
    counter.add(value, attributes);
  }

  /**
   * Helper method to build context attributes
   */
  private buildContextAttributes(context?: BusinessContext): Record<string, string> {
    if (!context) return {};
    
    const attributes: Record<string, string> = {};
    
    if (context.userId) attributes[BusinessAttributes.USER_ID] = context.userId;
    if (context.tenantId) attributes[BusinessAttributes.TENANT_ID] = context.tenantId;
    if (context.organizationId) attributes[BusinessAttributes.ORGANIZATION_ID] = context.organizationId;
    if (context.sessionId) attributes[BusinessAttributes.SESSION_ID] = context.sessionId;
    if (context.requestId) attributes['request.id'] = context.requestId;
    if (context.correlationId) attributes['correlation.id'] = context.correlationId;
    
    return attributes;
  }

  /**
   * Categorize operation performance
   */
  private categorizePerformance(durationMs: number): string {
    if (durationMs < 100) return PerformanceTier.FAST;
    if (durationMs < 1000) return PerformanceTier.NORMAL;
    if (durationMs < 5000) return PerformanceTier.SLOW;
    return PerformanceTier.VERY_SLOW;
  }

  /**
   * Categorize error type
   */
  private categorizeError(error: any): string {
    if (!error) return ErrorCategory.UNKNOWN;
    
    const message = error.message?.toLowerCase() || '';
    
    if (message.includes('authentication') || message.includes('login')) {
      return ErrorCategory.AUTHENTICATION;
    }
    if (message.includes('authorization') || message.includes('permission')) {
      return ErrorCategory.AUTHORIZATION;
    }
    if (message.includes('validation') || message.includes('invalid')) {
      return ErrorCategory.VALIDATION;
    }
    if (message.includes('timeout')) {
      return ErrorCategory.TIMEOUT;
    }
    if (message.includes('network') || message.includes('connection')) {
      return ErrorCategory.NETWORK;
    }
    if (message.includes('rate limit')) {
      return ErrorCategory.RATE_LIMIT;
    }
    
    return ErrorCategory.BUSINESS_LOGIC;
  }

  /**
   * Get error severity
   */
  private getErrorSeverity(error: any): string {
    // Simple heuristic - in production, implement more sophisticated logic
    if (error.code >= 500) return 'high';
    if (error.code >= 400) return 'medium';
    return 'low';
  }

  /**
   * Check if error is recoverable
   */
  private isRecoverableError(error: any): boolean {
    // Timeout, rate limit, and network errors are typically recoverable
    const message = error.message?.toLowerCase() || '';
    return message.includes('timeout') || 
           message.includes('rate limit') || 
           message.includes('network') ||
           error.code === 429 || 
           error.code === 503;
  }

  /**
   * Record operation metrics
   */
  private recordOperationMetrics(
    operationType: string,
    duration: number,
    outcome: string,
    context?: BusinessContext
  ): void {
    if (!this.config.enableMetrics) return;
    
    const attributes = {
      operation_type: operationType,
      outcome,
      tenant_id: context?.tenantId || 'unknown',
      performance_tier: this.categorizePerformance(duration)
    };
    
    this.operationCounter.add(1, attributes);
    this.operationDuration.record(duration, attributes);
  }

  /**
   * Record error metrics
   */
  private recordErrorMetrics(errorCategory: string, context?: BusinessContext): void {
    if (!this.config.enableMetrics) return;
    
    this.errorCounter.add(1, {
      error_category: errorCategory,
      tenant_id: context?.tenantId || 'unknown'
    });
  }
}

// Global instance for convenience
let globalInstrumentation: BusinessInstrumentation | null = null;

/**
 * Get or create global business instrumentation instance
 */
export function getBusinessInstrumentation(config?: InstrumentationConfig): BusinessInstrumentation {
  if (!globalInstrumentation) {
    globalInstrumentation = new BusinessInstrumentation(config);
  }
  return globalInstrumentation;
}

/**
 * Convenience function for creating business spans
 */
export function instrumentBusinessOperation<T>(
  name: string,
  operationType: string,
  operation: (span: api.Span) => Promise<T> | T,
  context?: BusinessContext,
  attributes?: Record<string, string | number | boolean>
): Promise<T> {
  return getBusinessInstrumentation().createBusinessSpan(
    name,
    operationType,
    operation,
    context,
    attributes
  );
}

/**
 * Decorator for instrumenting class methods
 */
export function InstrumentMethod(
  operationType: string,
  name?: string
) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const spanName = name || `${target.constructor.name}.${propertyKey}`;
    
    descriptor.value = async function (...args: any[]) {
      const instrumentation = getBusinessInstrumentation();
      
      return instrumentation.createBusinessSpan(
        spanName,
        operationType,
        async (span: api.Span) => {
          // Add method context
          span.setAttributes({
            'code.function': propertyKey,
            'code.namespace': target.constructor.name
          });
          
          return originalMethod.apply(this, args);
        }
      );
    };
    
    return descriptor;
  };
}