/**
 * Enhanced Business Trace Middleware
 * Task 4.3: Custom Trace Instrumentation Enhancement (Sprint 4)
 * 
 * Features:
 * - Automatic business process detection from request context
 * - Enhanced request/response correlation with business metrics
 * - Tenant and user context enrichment
 * - Performance optimization tracking
 * - Audit trail generation for compliance
 */

import { Request, Response, NextFunction } from 'express';
import * as api from '@opentelemetry/api';
import { 
  businessTraceService, 
  BusinessProcess, 
  CustomerSegment, 
  UserJourneyStage,
  BusinessTraceAttributes 
} from '../tracing/business-trace.service';
import { otelFeatureFlags } from '../config/otel.config';
import { logger } from '../config/logger';

// Extend Express Request interface for enhanced business context
declare global {
  namespace Express {
    interface Request {
      businessTrace?: {
        process: BusinessProcess;
        attributes: BusinessTraceAttributes;
        startTime: number;
        traceId: string;
        operationName: string;
      };
      tenant?: {
        id: string;
        tier: string;
        region?: string;
        subscriptionType?: string;
      };
      user?: {
        id: string;
        email?: string;
        role: string;
        experience?: string;
        segment?: CustomerSegment;
        journeyStage?: UserJourneyStage;
      };
      featureFlags?: Record<string, boolean>;
    }
  }
}

interface BusinessTraceMiddlewareOptions {
  enableAutoDetection: boolean;
  enableAuditTrail: boolean;
  enablePerformanceAnalysis: boolean;
  customBusinessProcessDetector?: (req: Request) => BusinessProcess | null;
  customAttributeEnricher?: (req: Request, attributes: BusinessTraceAttributes) => BusinessTraceAttributes;
}

/**
 * Enhanced business trace middleware with automatic process detection
 */
export function enhancedBusinessTraceMiddleware(options: Partial<BusinessTraceMiddlewareOptions> = {}) {
  const config = {
    enableAutoDetection: true,
    enableAuditTrail: true,
    enablePerformanceAnalysis: true,
    ...options
  };

  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip if OTEL is disabled
    if (!otelFeatureFlags.enabled || !otelFeatureFlags.manualInstrumentation) {
      return next();
    }

    const startTime = Date.now();
    const traceId = api.trace.getActiveSpan()?.spanContext()?.traceId || 'unknown';

    try {
      // Auto-detect business process from request
      const businessProcess = config.enableAutoDetection ? 
        detectBusinessProcess(req, config.customBusinessProcessDetector) : null;

      if (!businessProcess) {
        return next(); // Skip business tracing for non-business requests
      }

      // Build business attributes from request context
      const businessAttributes = buildBusinessAttributes(req, config.customAttributeEnricher);

      // Store business trace context on request
      req.businessTrace = {
        process: businessProcess,
        attributes: businessAttributes,
        startTime,
        traceId,
        operationName: `${req.method} ${req.route?.path || req.path}`
      };

      // Add business context to current span if exists
      const currentSpan = api.trace.getActiveSpan();
      if (currentSpan) {
        enhanceSpanWithBusinessContext(currentSpan, businessProcess, businessAttributes, req);
      }

      // Enhanced response handling with business context
      const originalEnd = res.end;
      res.end = function(this: Response, chunk?: any, encoding?: any): Response {
        const endTime = Date.now();
        const duration = endTime - startTime;
        const success = res.statusCode < 400;

        // Record business operation metrics
        recordBusinessOperationMetrics(req, res, duration, success);

        // Add audit trail events if enabled
        if (config.enableAuditTrail) {
          addAuditTrailEvents(req, res, duration, success);
        }

        // Performance analysis if enabled
        if (config.enablePerformanceAnalysis) {
          analyzeOperationPerformance(req, res, duration, businessProcess);
        }

        // Update span with final business context
        if (currentSpan) {
          updateSpanWithResponseContext(currentSpan, req, res, duration, success);
        }

        return originalEnd.call(this, chunk, encoding);
      };

      next();

    } catch (error) {
      logger.error('Enhanced business trace middleware error', {
        error: (error as Error).message,
        path: req.path,
        method: req.method,
        correlationId: req.correlationId
      });
      next(); // Continue without business tracing
    }
  };
}

/**
 * Detect business process from request characteristics
 */
function detectBusinessProcess(
  req: Request, 
  customDetector?: (req: Request) => BusinessProcess | null
): BusinessProcess | null {
  // Use custom detector if provided
  if (customDetector) {
    const customResult = customDetector(req);
    if (customResult) return customResult;
  }

  const path = req.path.toLowerCase();
  const method = req.method.toUpperCase();

  // Authentication flows
  if (path.includes('/auth/') || path.includes('/login') || path.includes('/register')) {
    return BusinessProcess.AUTHENTICATION_FLOW;
  }

  // User onboarding
  if (path.includes('/onboarding') || path.includes('/setup') || path.includes('/welcome')) {
    return BusinessProcess.USER_ONBOARDING;
  }

  // Metrics ingestion
  if (path.includes('/metrics') && (method === 'POST' || method === 'PUT')) {
    return BusinessProcess.METRICS_INGESTION;
  }

  // Data processing
  if (path.includes('/process') || path.includes('/analyze') || path.includes('/aggregate')) {
    return BusinessProcess.DATA_PROCESSING;
  }

  // Tenant management
  if (path.includes('/tenant') || path.includes('/organization')) {
    return BusinessProcess.TENANT_PROVISIONING;
  }

  // Performance analysis
  if (path.includes('/analytics') || path.includes('/dashboard') || path.includes('/reports')) {
    return BusinessProcess.PERFORMANCE_ANALYSIS;
  }

  // External integrations
  if (path.includes('/webhook') || path.includes('/integration') || path.includes('/external')) {
    return BusinessProcess.EXTERNAL_INTEGRATION;
  }

  // Security operations
  if (path.includes('/security') || path.includes('/audit')) {
    return BusinessProcess.SECURITY_AUDIT;
  }

  return null; // No business process detected
}

/**
 * Build comprehensive business attributes from request context
 */
function buildBusinessAttributes(
  req: Request,
  customEnricher?: (req: Request, attributes: BusinessTraceAttributes) => BusinessTraceAttributes
): BusinessTraceAttributes {
  const baseAttributes: BusinessTraceAttributes = {
    // Request context
    businessStep: determineBusinessStep(req),
    
    // User context
    userId: req.user?.id,
    userRole: req.user?.role,
    userExperience: req.user?.experience,
    customerSegment: req.user?.segment,
    userJourneyStage: req.user?.journeyStage,
    
    // Tenant context
    tenantId: req.tenant?.id,
    tenantTier: req.tenant?.tier,
    tenantRegion: req.tenant?.region,
    
    // Feature context
    featureFlags: req.featureFlags,
    
    // Performance context
    criticalPath: isCriticalPath(req),
    optimizationCandidate: isOptimizationCandidate(req),
    resourceIntensive: isResourceIntensive(req),
    cacheDependent: isCacheDependent(req),
    
    // Business impact
    revenueImpact: hasRevenueImpact(req),
    userExperienceImpact: hasUserExperienceImpact(req),
    securitySensitive: isSecuritySensitive(req)
  };

  // Apply custom enrichment if provided
  if (customEnricher) {
    return customEnricher(req, baseAttributes);
  }

  return baseAttributes;
}

/**
 * Determine specific business step from request
 */
function determineBusinessStep(req: Request): string {
  const path = req.path.toLowerCase();
  const method = req.method.toUpperCase();
  
  // Authentication steps
  if (path.includes('/login')) return 'user_login';
  if (path.includes('/register')) return 'user_registration';
  if (path.includes('/verify')) return 'user_verification';
  if (path.includes('/reset')) return 'password_reset';
  
  // Metrics steps
  if (path.includes('/batch') && method === 'POST') return 'batch_ingestion';
  if (path.includes('/metrics') && method === 'POST') return 'single_metric_ingestion';
  if (path.includes('/metrics') && method === 'GET') return 'metrics_query';
  
  // Data processing steps
  if (path.includes('/aggregate')) return 'data_aggregation';
  if (path.includes('/analyze')) return 'data_analysis';
  if (path.includes('/export')) return 'data_export';
  
  // Default step
  return `${method.toLowerCase()}_${path.split('/').pop() || 'unknown'}`;
}

/**
 * Determine if request is on critical path
 */
function isCriticalPath(req: Request): boolean {
  const criticalPaths = [
    '/auth/',
    '/login',
    '/register',
    '/onboarding',
    '/health',
    '/metrics/batch'
  ];
  
  return criticalPaths.some(path => req.path.toLowerCase().includes(path));
}

/**
 * Determine if request is optimization candidate
 */
function isOptimizationCandidate(req: Request): boolean {
  const optimizationCandidates = [
    '/analytics',
    '/dashboard',
    '/reports',
    '/export',
    '/aggregate'
  ];
  
  return optimizationCandidates.some(path => req.path.toLowerCase().includes(path));
}

/**
 * Determine if request is resource intensive
 */
function isResourceIntensive(req: Request): boolean {
  const resourceIntensivePaths = [
    '/batch',
    '/aggregate',
    '/export',
    '/analyze',
    '/process'
  ];
  
  return resourceIntensivePaths.some(path => req.path.toLowerCase().includes(path)) ||
         req.method === 'POST' && req.headers['content-length'] && 
         parseInt(req.headers['content-length'], 10) > 1024 * 1024; // >1MB
}

/**
 * Determine if request is cache dependent
 */
function isCacheDependent(req: Request): boolean {
  const cacheDependentPaths = [
    '/dashboard',
    '/analytics',
    '/reports',
    '/metrics'
  ];
  
  return req.method === 'GET' && 
         cacheDependentPaths.some(path => req.path.toLowerCase().includes(path));
}

/**
 * Determine if request has revenue impact
 */
function hasRevenueImpact(req: Request): boolean {
  const revenueImpactPaths = [
    '/billing',
    '/subscription',
    '/payment',
    '/upgrade',
    '/downgrade'
  ];
  
  return revenueImpactPaths.some(path => req.path.toLowerCase().includes(path)) ||
         req.tenant?.tier === 'premium';
}

/**
 * Determine if request has user experience impact
 */
function hasUserExperienceImpact(req: Request): boolean {
  const uxImpactPaths = [
    '/dashboard',
    '/onboarding',
    '/setup',
    '/profile'
  ];
  
  return uxImpactPaths.some(path => req.path.toLowerCase().includes(path));
}

/**
 * Determine if request is security sensitive
 */
function isSecuritySensitive(req: Request): boolean {
  const securitySensitivePaths = [
    '/auth/',
    '/login',
    '/register',
    '/security',
    '/audit',
    '/admin'
  ];
  
  return securitySensitivePaths.some(path => req.path.toLowerCase().includes(path)) ||
         req.user?.role === 'admin';
}

/**
 * Enhance current span with business context
 */
function enhanceSpanWithBusinessContext(
  span: api.Span,
  businessProcess: BusinessProcess,
  attributes: BusinessTraceAttributes,
  req: Request
): void {
  // Add business process attributes
  span.setAttributes({
    'business.process': businessProcess,
    'business.step': attributes.businessStep || 'unknown',
    'business.customer_segment': attributes.customerSegment || 'unknown',
    'business.user_journey_stage': attributes.userJourneyStage || 'unknown'
  });

  // Add enhanced request context
  span.setAttributes({
    'http.request.business_critical': attributes.criticalPath || false,
    'http.request.optimization_candidate': attributes.optimizationCandidate || false,
    'http.request.resource_intensive': attributes.resourceIntensive || false,
    'http.request.security_sensitive': attributes.securitySensitive || false
  });

  // Add tenant context
  if (attributes.tenantId) {
    span.setAttributes({
      'tenant.id': attributes.tenantId,
      'tenant.tier': attributes.tenantTier || 'unknown',
      'tenant.region': attributes.tenantRegion || 'unknown'
    });
  }

  // Add user context
  if (attributes.userId) {
    span.setAttributes({
      'user.id': attributes.userId,
      'user.role': attributes.userRole || 'unknown',
      'user.experience': attributes.userExperience || 'unknown'
    });
  }

  // Add feature flags context
  if (attributes.featureFlags && Object.keys(attributes.featureFlags).length > 0) {
    span.setAttributes({
      'feature_flags.enabled': JSON.stringify(attributes.featureFlags),
      'feature_flags.count': Object.keys(attributes.featureFlags).length
    });
  }
}

/**
 * Record business operation metrics
 */
function recordBusinessOperationMetrics(
  req: Request,
  res: Response,
  duration: number,
  success: boolean
): void {
  if (!req.businessTrace) return;

  const { process: businessProcess, attributes } = req.businessTrace;

  // Log business operation
  logger.info('Business operation completed', {
    event: 'business_operation.completed',
    business_process: businessProcess,
    business_step: attributes.businessStep,
    operation: req.businessTrace.operationName,
    duration_ms: duration,
    success,
    status_code: res.statusCode,
    customer_segment: attributes.customerSegment,
    user_journey_stage: attributes.userJourneyStage,
    tenant_id: attributes.tenantId,
    user_id: attributes.userId,
    critical_path: attributes.criticalPath,
    correlation_id: req.correlationId
  });
}

/**
 * Add audit trail events for compliance
 */
function addAuditTrailEvents(
  req: Request,
  res: Response,
  duration: number,
  success: boolean
): void {
  if (!req.businessTrace) return;

  const currentSpan = api.trace.getActiveSpan();
  if (!currentSpan) return;

  const { process: businessProcess, attributes } = req.businessTrace;

  // Add audit trail event
  currentSpan.addEvent('audit.business_operation', {
    'audit.event_type': 'business_operation_completed',
    'audit.business_process': businessProcess,
    'audit.operation': req.businessTrace.operationName,
    'audit.user_id': attributes.userId || 'anonymous',
    'audit.tenant_id': attributes.tenantId || 'unknown',
    'audit.ip_address': req.ip || req.socket.remoteAddress || 'unknown',
    'audit.user_agent': req.headers['user-agent'] || 'unknown',
    'audit.success': success,
    'audit.duration_ms': duration,
    'audit.status_code': res.statusCode,
    'audit.timestamp': Date.now(),
    'audit.correlation_id': req.correlationId || 'unknown'
  });

  // Add security audit event for sensitive operations
  if (attributes.securitySensitive) {
    currentSpan.addEvent('security.audit.operation', {
      'security.operation_type': businessProcess,
      'security.user_id': attributes.userId || 'anonymous',
      'security.success': success,
      'security.risk_level': success ? 'low' : 'medium',
      'security.timestamp': Date.now()
    });
  }
}

/**
 * Analyze operation performance for optimization
 */
function analyzeOperationPerformance(
  req: Request,
  res: Response,
  duration: number,
  businessProcess: BusinessProcess
): void {
  if (!req.businessTrace) return;

  const currentSpan = api.trace.getActiveSpan();
  if (!currentSpan) return;

  const { attributes } = req.businessTrace;

  // Performance thresholds by business process
  const thresholds = {
    [BusinessProcess.AUTHENTICATION_FLOW]: 500,   // 500ms
    [BusinessProcess.METRICS_INGESTION]: 200,     // 200ms
    [BusinessProcess.USER_ONBOARDING]: 1000,      // 1s
    [BusinessProcess.DATA_PROCESSING]: 5000,      // 5s
    [BusinessProcess.EXTERNAL_INTEGRATION]: 3000, // 3s
    default: 1000
  };

  const threshold = thresholds[businessProcess] || thresholds.default;
  const performanceCategory = duration > threshold * 2 ? 'very_slow' : 
                            duration > threshold ? 'slow' : 'normal';

  // Add performance analysis event
  currentSpan.addEvent('performance.analysis.completed', {
    'performance.duration_ms': duration,
    'performance.threshold_ms': threshold,
    'performance.category': performanceCategory,
    'performance.optimization_needed': duration > threshold,
    'performance.business_impact': attributes.userExperienceImpact ? 'high' : 'medium',
    'performance.critical_path': attributes.criticalPath || false
  });

  // Log slow operations for optimization
  if (performanceCategory !== 'normal') {
    logger.warn('Slow business operation detected', {
      event: 'business_operation.performance.slow',
      business_process: businessProcess,
      operation: req.businessTrace.operationName,
      duration_ms: duration,
      threshold_ms: threshold,
      category: performanceCategory,
      tenant_id: attributes.tenantId,
      user_id: attributes.userId
    });
  }
}

/**
 * Update span with response context
 */
function updateSpanWithResponseContext(
  span: api.Span,
  req: Request,
  res: Response,
  duration: number,
  success: boolean
): void {
  if (!req.businessTrace) return;

  // Add final business operation attributes
  span.setAttributes({
    'business.operation.duration_ms': duration,
    'business.operation.success': success,
    'business.operation.completion_time': Date.now(),
    'http.response.business_success': success && res.statusCode < 400
  });

  // Add response size if available
  const contentLength = res.getHeader('content-length');
  if (contentLength) {
    span.setAttributes({
      'http.response.content_length': parseInt(contentLength.toString(), 10)
    });
  }
}

export default enhancedBusinessTraceMiddleware;