/**
 * Advanced Business Process Tracing Service
 * Task 4.3: Custom Trace Instrumentation Enhancement (Sprint 4)
 * 
 * Features:
 * - Critical business operation spans with transaction-level tracing
 * - Enhanced business context attributes with operational metadata
 * - Span events for application milestones and audit trails
 * - Intelligent sampling strategies with cost optimization
 * - Integration with existing OTEL foundation and business metrics
 */

import * as api from '@opentelemetry/api';
import { Request, Response } from 'express';
import { tracer, meter } from './otel-init';
import { otelFeatureFlags, otelConfig } from '../config/otel.config';
import { config } from '../config/environment';
import { logger } from '../config/logger';

// Business process types for tracing
export enum BusinessProcess {
  USER_ONBOARDING = 'user_onboarding',
  DATA_PROCESSING = 'data_processing_pipeline',
  AUTHENTICATION_FLOW = 'authentication_flow',
  METRICS_INGESTION = 'metrics_ingestion',
  TENANT_PROVISIONING = 'tenant_provisioning',
  EXTERNAL_INTEGRATION = 'external_integration',
  PERFORMANCE_ANALYSIS = 'performance_analysis',
  SECURITY_AUDIT = 'security_audit'
}

// User journey stages for context
export enum UserJourneyStage {
  REGISTRATION = 'registration',
  VERIFICATION = 'verification',
  ACTIVATION = 'activation',
  ONBOARDING = 'onboarding',
  FEATURE_DISCOVERY = 'feature_discovery',
  REGULAR_USAGE = 'regular_usage',
  ADVANCED_USAGE = 'advanced_usage',
  RETENTION = 'retention'
}

// Customer segments for business intelligence
export enum CustomerSegment {
  STARTUP = 'startup',
  SMB = 'smb',
  ENTERPRISE = 'enterprise',
  FREE_TIER = 'free_tier',
  TRIAL = 'trial',
  PREMIUM = 'premium'
}

// Business context attributes interface
export interface BusinessTraceAttributes {
  // Business process context
  businessProcess?: BusinessProcess;
  businessStep?: string;
  customerSegment?: CustomerSegment;
  userJourneyStage?: UserJourneyStage;
  
  // Tenant context
  tenantId?: string;
  tenantTier?: string;
  tenantRegion?: string;
  
  // User context
  userId?: string;
  userRole?: string;
  userExperience?: string; // new, experienced, expert
  
  // Feature context
  featureFlags?: Record<string, boolean>;
  experimentGroup?: string;
  
  // Performance context
  criticalPath?: boolean;
  optimizationCandidate?: boolean;
  resourceIntensive?: boolean;
  cacheDependent?: boolean;
  
  // Business metrics correlation
  revenueImpact?: boolean;
  userExperienceImpact?: boolean;
  securitySensitive?: boolean;
}

// Enhanced span event types
export interface SpanEvent {
  name: string;
  attributes: Record<string, any>;
  timestamp?: number;
}

// Sampling strategy configuration
export interface SamplingConfig {
  businessCritical: number; // 100% for critical operations
  errorScenarios: number;   // 100% for error tracking
  performanceIssues: number; // 90% for optimization
  standardOperations: number; // 10% for normal operations
  backgroundProcesses: number; // 5% for background tasks
}

// Enhanced trace context for business operations
export interface BusinessTraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  businessProcess: BusinessProcess;
  userId?: string;
  tenantId?: string;
  operationName: string;
  startTime: number;
  attributes: BusinessTraceAttributes;
  events: SpanEvent[];
}

export class BusinessTraceService {
  private samplingConfig: SamplingConfig = {
    businessCritical: 1.0,    // 100%
    errorScenarios: 1.0,      // 100%
    performanceIssues: 0.9,   // 90%
    standardOperations: 0.1,  // 10%
    backgroundProcesses: 0.05  // 5%
  };

  private performanceThresholds = {
    slowOperation: 1000,      // 1 second
    verySlowOperation: 5000,  // 5 seconds
    memoryIntensive: 100,     // 100MB
    cpuIntensive: 80          // 80% CPU usage
  };

  constructor() {
    this.initializeMetrics();
  }

  /**
   * Create enhanced business operation span with comprehensive context
   */
  public async instrumentBusinessOperation<T>(
    operationName: string,
    businessProcess: BusinessProcess,
    operation: (span: api.Span) => Promise<T>,
    context: Partial<BusinessTraceAttributes> = {}
  ): Promise<T> {
    if (!otelFeatureFlags.manualInstrumentation || !tracer) {
      return operation(api.trace.getActiveSpan() || api.trace.getNoopTracer().startSpan('noop'));
    }

    // Determine sampling based on business criticality
    const shouldSample = this.shouldSampleOperation(businessProcess, context);
    if (!shouldSample) {
      return operation(api.trace.getActiveSpan() || api.trace.getNoopTracer().startSpan('noop'));
    }

    const startTime = Date.now();
    const spanName = `business.${businessProcess}.${operationName}`;

    return tracer.startActiveSpan(spanName, {
      kind: api.SpanKind.INTERNAL,
      attributes: this.buildEnhancedAttributes(businessProcess, operationName, context, startTime)
    }, async (span: api.Span) => {
      try {
        // Add initial business milestone event
        this.addSpanEvent(span, 'business.operation.started', {
          'operation.name': operationName,
          'business.process': businessProcess,
          'operation.start_time': startTime
        });

        // Execute operation with span context
        const result = await operation(span);
        const endTime = Date.now();
        const duration = endTime - startTime;

        // Add performance and success attributes
        span.setAttributes({
          'operation.duration_ms': duration,
          'operation.success': true,
          'operation.end_time': endTime
        });

        // Add performance categorization
        this.categorizePerformance(span, duration, businessProcess);

        // Add completion milestone event
        this.addSpanEvent(span, 'business.operation.completed', {
          'operation.duration_ms': duration,
          'operation.success': true,
          'performance.category': this.getPerformanceCategory(duration)
        });

        // Record business metrics correlation
        this.recordBusinessMetrics(businessProcess, operationName, duration, true, context);

        span.setStatus({ code: api.SpanStatusCode.OK });
        return result;

      } catch (error) {
        const endTime = Date.now();
        const duration = endTime - startTime;

        // Enhanced error handling with business context
        span.setAttributes({
          'operation.duration_ms': duration,
          'operation.success': false,
          'error.type': (error as Error).constructor.name,
          'error.business_impact': this.assessBusinessImpact(businessProcess, error as Error),
          'operation.end_time': endTime
        });

        // Add error milestone event with audit trail
        this.addSpanEvent(span, 'business.operation.failed', {
          'error.message': (error as Error).message,
          'error.type': (error as Error).constructor.name,
          'error.stack_trace': (error as Error).stack?.substring(0, 1000), // Truncated for performance
          'operation.duration_ms': duration,
          'business.error_severity': this.getErrorSeverity(businessProcess, error as Error)
        });

        // Record exception with business context
        span.recordException(error as Error, {
          'business.process': businessProcess,
          'business.error_category': this.categorizeBusinessError(businessProcess, error as Error)
        });

        // Record failed business metrics
        this.recordBusinessMetrics(businessProcess, operationName, duration, false, context);

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

  /**
   * Instrument multi-step business transaction with correlation
   */
  public async instrumentBusinessTransaction<T>(
    transactionName: string,
    businessProcess: BusinessProcess,
    steps: Array<{
      name: string;
      operation: (span: api.Span) => Promise<any>;
      context?: Partial<BusinessTraceAttributes>;
    }>,
    context: Partial<BusinessTraceAttributes> = {}
  ): Promise<T[]> {
    const transactionSpanName = `transaction.${businessProcess}.${transactionName}`;
    
    return this.instrumentBusinessOperation(
      transactionName,
      businessProcess,
      async (parentSpan: api.Span) => {
        const results: T[] = [];
        const transactionId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Add transaction started event
        this.addSpanEvent(parentSpan, 'business.transaction.started', {
          'transaction.id': transactionId,
          'transaction.steps': steps.length,
          'transaction.name': transactionName
        });

        for (let i = 0; i < steps.length; i++) {
          const step = steps[i];
          const stepSpanName = `step.${i + 1}.${step.name}`;

          try {
            const stepResult = await tracer.startActiveSpan(stepSpanName, {
              parent: parentSpan,
              kind: api.SpanKind.INTERNAL,
              attributes: {
                'transaction.id': transactionId,
                'transaction.step': i + 1,
                'transaction.step_name': step.name,
                'transaction.total_steps': steps.length,
                ...this.buildEnhancedAttributes(businessProcess, step.name, step.context || {})
              }
            }, async (stepSpan: api.Span) => {
              // Add step milestone event
              this.addSpanEvent(stepSpan, 'business.transaction.step.started', {
                'step.number': i + 1,
                'step.name': step.name,
                'transaction.id': transactionId
              });

              const result = await step.operation(stepSpan);

              // Add step completion event
              this.addSpanEvent(stepSpan, 'business.transaction.step.completed', {
                'step.number': i + 1,
                'step.success': true,
                'transaction.id': transactionId
              });

              stepSpan.setStatus({ code: api.SpanStatusCode.OK });
              return result;
            });

            results.push(stepResult);

          } catch (error) {
            // Add transaction failure event
            this.addSpanEvent(parentSpan, 'business.transaction.step.failed', {
              'step.number': i + 1,
              'step.name': step.name,
              'error.message': (error as Error).message,
              'transaction.id': transactionId
            });

            throw error; // Re-throw to fail the entire transaction
          }
        }

        // Add transaction completed event
        this.addSpanEvent(parentSpan, 'business.transaction.completed', {
          'transaction.id': transactionId,
          'transaction.steps_completed': steps.length,
          'transaction.success': true
        });

        return results;
      },
      {
        ...context,
        criticalPath: true // Transactions are always critical path
      }
    );
  }

  /**
   * Instrument user authentication flow with security context
   */
  public async instrumentAuthenticationFlow<T>(
    authMethod: string,
    operation: (span: api.Span) => Promise<T>,
    securityContext: {
      userId?: string;
      email?: string;
      ipAddress?: string;
      userAgent?: string;
      mfaEnabled?: boolean;
      riskScore?: number;
    } = {}
  ): Promise<T> {
    return this.instrumentBusinessOperation(
      authMethod,
      BusinessProcess.AUTHENTICATION_FLOW,
      async (span: api.Span) => {
        // Add security-specific attributes
        span.setAttributes({
          'auth.method': authMethod,
          'auth.ip_address': securityContext.ipAddress || 'unknown',
          'auth.user_agent': securityContext.userAgent || 'unknown',
          'auth.mfa_enabled': securityContext.mfaEnabled || false,
          'auth.risk_score': securityContext.riskScore || 0,
          'security.sensitive': true
        });

        // Add authentication started event
        this.addSpanEvent(span, 'auth.attempt.started', {
          'auth.method': authMethod,
          'auth.user_id': securityContext.userId || 'unknown',
          'auth.ip_address': securityContext.ipAddress || 'unknown'
        });

        const result = await operation(span);

        // Add successful authentication event
        this.addSpanEvent(span, 'auth.attempt.succeeded', {
          'auth.method': authMethod,
          'auth.user_id': securityContext.userId || 'unknown'
        });

        return result;
      },
      {
        securitySensitive: true,
        criticalPath: true,
        userId: securityContext.userId,
        businessStep: 'authentication'
      }
    );
  }

  /**
   * Instrument external service integration with dependency tracking
   */
  public async instrumentExternalIntegration<T>(
    serviceName: string,
    operation: string,
    fn: (span: api.Span) => Promise<T>,
    integrationContext: {
      endpoint?: string;
      timeout?: number;
      retryCount?: number;
      circuitBreakerState?: string;
    } = {}
  ): Promise<T> {
    return this.instrumentBusinessOperation(
      operation,
      BusinessProcess.EXTERNAL_INTEGRATION,
      async (span: api.Span) => {
        // Add external service attributes
        span.setAttributes({
          'external.service.name': serviceName,
          'external.service.operation': operation,
          'external.service.endpoint': integrationContext.endpoint || 'unknown',
          'external.service.timeout_ms': integrationContext.timeout || 0,
          'external.service.retry_count': integrationContext.retryCount || 0,
          'external.service.circuit_breaker': integrationContext.circuitBreakerState || 'closed'
        });

        // Add external call started event
        this.addSpanEvent(span, 'external.call.started', {
          'external.service': serviceName,
          'external.operation': operation,
          'external.endpoint': integrationContext.endpoint || 'unknown'
        });

        const startTime = Date.now();
        const result = await fn(span);
        const duration = Date.now() - startTime;

        // Add external call completed event
        this.addSpanEvent(span, 'external.call.completed', {
          'external.service': serviceName,
          'external.duration_ms': duration,
          'external.success': true
        });

        // Performance analysis for external calls
        if (duration > this.performanceThresholds.slowOperation) {
          span.setAttributes({
            'external.performance.category': 'slow',
            'external.performance.threshold_exceeded': true
          });
        }

        return result;
      },
      {
        businessStep: `${serviceName}_integration`,
        criticalPath: false,
        optimizationCandidate: true
      }
    );
  }

  /**
   * Add structured span event with timestamp and business context
   */
  private addSpanEvent(
    span: api.Span,
    eventName: string,
    attributes: Record<string, any>,
    timestamp?: number
  ): void {
    const eventAttributes = {
      ...attributes,
      'event.timestamp': timestamp || Date.now(),
      'event.source': 'business_trace_service',
      'service.version': config.otel.service.version,
      'environment': config.nodeEnv
    };

    span.addEvent(eventName, eventAttributes);
  }

  /**
   * Build comprehensive business attributes for spans
   */
  private buildEnhancedAttributes(
    businessProcess: BusinessProcess,
    operationName: string,
    context: Partial<BusinessTraceAttributes>,
    timestamp?: number
  ): Record<string, any> {
    const baseAttributes = {
      // Business context
      'business.process': businessProcess,
      'business.operation': operationName,
      'business.step': context.businessStep || operationName,
      'business.customer_segment': context.customerSegment || 'unknown',
      'business.user_journey_stage': context.userJourneyStage || 'unknown',

      // Operational context
      'deployment.version': process.env.APP_VERSION || config.otel.service.version,
      'deployment.environment': config.nodeEnv,
      'deployment.region': process.env.DEPLOYMENT_REGION || 'unknown',
      'infrastructure.instance_id': process.env.INSTANCE_ID || process.pid.toString(),

      // Performance context
      'performance.critical_path': context.criticalPath || false,
      'performance.optimization_candidate': context.optimizationCandidate || false,
      'performance.resource_intensive': context.resourceIntensive || false,
      'performance.cache_dependent': context.cacheDependent || false,

      // Business intelligence context
      'business.revenue_impact': context.revenueImpact || false,
      'business.user_experience_impact': context.userExperienceImpact || false,
      'business.security_sensitive': context.securitySensitive || false,

      // Timestamp
      'operation.start_timestamp': timestamp || Date.now()
    };

    // Add tenant context if available
    if (context.tenantId) {
      baseAttributes['tenant.id'] = context.tenantId;
      baseAttributes['tenant.tier'] = context.tenantTier || 'unknown';
      baseAttributes['tenant.region'] = context.tenantRegion || 'unknown';
    }

    // Add user context if available
    if (context.userId) {
      baseAttributes['user.id'] = context.userId;
      baseAttributes['user.role'] = context.userRole || 'unknown';
      baseAttributes['user.experience'] = context.userExperience || 'unknown';
    }

    // Add feature flag context
    if (context.featureFlags && Object.keys(context.featureFlags).length > 0) {
      baseAttributes['feature_flags'] = JSON.stringify(context.featureFlags);
      baseAttributes['feature_flags.count'] = Object.keys(context.featureFlags).length;
      baseAttributes['feature_flags.enabled_count'] = Object.values(context.featureFlags).filter(Boolean).length;
    }

    return baseAttributes;
  }

  /**
   * Intelligent sampling based on business criticality and context
   */
  private shouldSampleOperation(
    businessProcess: BusinessProcess,
    context: Partial<BusinessTraceAttributes>
  ): boolean {
    // Always sample business critical operations
    if (this.isBusinessCritical(businessProcess, context)) {
      return true;
    }

    // Always sample error scenarios (handled elsewhere)
    if (context.securitySensitive) {
      return Math.random() < this.samplingConfig.businessCritical;
    }

    // Sample based on performance issues
    if (context.optimizationCandidate) {
      return Math.random() < this.samplingConfig.performanceIssues;
    }

    // Background processes - low sampling
    if (businessProcess === BusinessProcess.DATA_PROCESSING) {
      return Math.random() < this.samplingConfig.backgroundProcesses;
    }

    // Standard operations
    return Math.random() < this.samplingConfig.standardOperations;
  }

  /**
   * Determine if operation is business critical
   */
  private isBusinessCritical(
    businessProcess: BusinessProcess,
    context: Partial<BusinessTraceAttributes>
  ): boolean {
    const criticalProcesses = [
      BusinessProcess.AUTHENTICATION_FLOW,
      BusinessProcess.USER_ONBOARDING,
      BusinessProcess.TENANT_PROVISIONING
    ];

    return criticalProcesses.includes(businessProcess) || 
           context.criticalPath === true ||
           context.revenueImpact === true ||
           context.securitySensitive === true;
  }

  /**
   * Categorize operation performance for optimization
   */
  private categorizePerformance(
    span: api.Span,
    duration: number,
    businessProcess: BusinessProcess
  ): void {
    let category = 'normal';
    let optimizationScore = 100; // Perfect score

    if (duration > this.performanceThresholds.verySlowOperation) {
      category = 'very_slow';
      optimizationScore = 20;
    } else if (duration > this.performanceThresholds.slowOperation) {
      category = 'slow';
      optimizationScore = 60;
    }

    span.setAttributes({
      'performance.category': category,
      'performance.optimization_score': optimizationScore,
      'performance.threshold.slow': this.performanceThresholds.slowOperation,
      'performance.threshold.very_slow': this.performanceThresholds.verySlowOperation
    });

    // Log slow operations for optimization
    if (category !== 'normal') {
      logger.warn('Slow business operation detected', {
        event: 'business_trace.performance.slow_operation',
        businessProcess,
        duration,
        category,
        optimizationScore
      });
    }
  }

  /**
   * Get performance category string
   */
  private getPerformanceCategory(duration: number): string {
    if (duration > this.performanceThresholds.verySlowOperation) return 'very_slow';
    if (duration > this.performanceThresholds.slowOperation) return 'slow';
    return 'normal';
  }

  /**
   * Assess business impact of errors
   */
  private assessBusinessImpact(businessProcess: BusinessProcess, error: Error): string {
    const criticalProcesses = [
      BusinessProcess.AUTHENTICATION_FLOW,
      BusinessProcess.USER_ONBOARDING,
      BusinessProcess.TENANT_PROVISIONING
    ];

    if (criticalProcesses.includes(businessProcess)) {
      return 'high';
    }

    if (businessProcess === BusinessProcess.METRICS_INGESTION) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Get error severity based on business context
   */
  private getErrorSeverity(businessProcess: BusinessProcess, error: Error): string {
    const businessImpact = this.assessBusinessImpact(businessProcess, error);
    
    if (error.name === 'SecurityError' || error.name === 'AuthenticationError') {
      return 'critical';
    }

    if (businessImpact === 'high') {
      return 'high';
    }

    return 'medium';
  }

  /**
   * Categorize business errors for analysis
   */
  private categorizeBusinessError(businessProcess: BusinessProcess, error: Error): string {
    if (error.name.includes('Auth') || error.name.includes('Security')) {
      return 'security';
    }

    if (error.name.includes('Validation') || error.name.includes('Input')) {
      return 'validation';
    }

    if (error.name.includes('Database') || error.name.includes('Connection')) {
      return 'infrastructure';
    }

    if (error.name.includes('Timeout') || error.name.includes('Network')) {
      return 'external_dependency';
    }

    return 'business_logic';
  }

  /**
   * Record business metrics correlated with trace data
   */
  private recordBusinessMetrics(
    businessProcess: BusinessProcess,
    operationName: string,
    duration: number,
    success: boolean,
    context: Partial<BusinessTraceAttributes>
  ): void {
    if (!otelFeatureFlags.metrics || !meter) {
      return;
    }

    const operationCounter = meter.createCounter('fortium_business_operations_total', {
      description: 'Total number of business operations'
    });

    const durationHistogram = meter.createHistogram('fortium_business_operation_duration', {
      description: 'Business operation duration in milliseconds',
      unit: 'ms'
    });

    const attributes = {
      business_process: businessProcess,
      operation: operationName,
      success: success.toString(),
      customer_segment: context.customerSegment || 'unknown',
      user_journey_stage: context.userJourneyStage || 'unknown',
      environment: config.nodeEnv
    };

    operationCounter.add(1, attributes);
    durationHistogram.record(duration, attributes);
  }

  /**
   * Initialize business-specific metrics
   */
  private initializeMetrics(): void {
    if (!otelFeatureFlags.metrics || !meter) {
      return;
    }

    // Initialize counters and histograms for business metrics
    meter.createCounter('fortium_business_errors_total', {
      description: 'Total number of business operation errors'
    });

    meter.createHistogram('fortium_business_optimization_score', {
      description: 'Business operation optimization scores',
      unit: 'score'
    });

    meter.createCounter('fortium_business_milestones_total', {
      description: 'Total number of business milestones reached'
    });
  }

  /**
   * Get current sampling configuration for debugging
   */
  public getSamplingConfig(): SamplingConfig {
    return { ...this.samplingConfig };
  }

  /**
   * Update sampling configuration at runtime
   */
  public updateSamplingConfig(newConfig: Partial<SamplingConfig>): void {
    this.samplingConfig = { ...this.samplingConfig, ...newConfig };
    
    logger.info('Business trace sampling configuration updated', {
      event: 'business_trace.sampling.config_updated',
      samplingConfig: this.samplingConfig
    });
  }
}

// Export singleton instance
export const businessTraceService = new BusinessTraceService();