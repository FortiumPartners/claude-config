/**
 * Enhanced Tracing Demo Routes
 * Task 4.3: Custom Trace Instrumentation Enhancement (Sprint 4)
 * 
 * Demonstrates advanced business process tracing capabilities:
 * - Business operation instrumentation with context
 * - Multi-step transaction tracing
 * - Authentication flow tracing with security context
 * - Performance analysis with optimization recommendations
 */

import { Router, Request, Response } from 'express';
import * as api from '@opentelemetry/api';
import { 
  businessTraceService, 
  BusinessProcess, 
  CustomerSegment, 
  UserJourneyStage 
} from '../tracing/business-trace.service';
import { intelligentSamplingService } from '../tracing/intelligent-sampling.service';
import EnhancedJwtService from '../auth/jwt.service.instrumented';
import EnhancedMetricsCollectionService from '../services/metrics-collection.service.instrumented';
import { authenticateToken } from '../auth/auth.middleware';
import { enhancedBusinessTraceMiddleware } from '../middleware/enhanced-business-trace.middleware';
import { logger } from '../config/logger';

const router = Router();

// Apply enhanced business tracing to all routes
router.use(enhancedBusinessTraceMiddleware({
  enableAutoDetection: true,
  enableAuditTrail: true,
  enablePerformanceAnalysis: true
}));

/**
 * Demo: User onboarding flow with transaction-level tracing
 */
router.post('/demo/user-onboarding', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { email, name, company, tier = 'basic' } = req.body;
    const userId = req.user?.id!;
    const tenantId = req.tenant?.id!;

    const result = await businessTraceService.instrumentBusinessTransaction(
      'complete_user_onboarding',
      BusinessProcess.USER_ONBOARDING,
      [
        {
          name: 'validate_user_data',
          operation: async (span: api.Span) => {
            span.addEvent('user_data.validation.started', {
              'user.email': email,
              'user.name': name,
              'company.name': company
            });

            // Simulate validation
            await new Promise(resolve => setTimeout(resolve, 50));
            
            if (!email || !name) {
              throw new Error('Missing required user data');
            }

            span.addEvent('user_data.validation.completed', {
              'validation.success': true,
              'validation.fields': ['email', 'name', 'company']
            });

            return { email, name, company };
          },
          context: {
            businessStep: 'data_validation',
            criticalPath: true,
            userExperienceImpact: true
          }
        },
        {
          name: 'create_user_profile',
          operation: async (span: api.Span) => {
            span.addEvent('user_profile.creation.started', {
              'user.email': email,
              'profile.tier': tier
            });

            // Simulate profile creation
            await new Promise(resolve => setTimeout(resolve, 150));

            const profile = {
              id: userId,
              email,
              name,
              company,
              tier,
              created_at: new Date(),
              onboarding_completed: false
            };

            span.addEvent('user_profile.creation.completed', {
              'profile.id': profile.id,
              'profile.tier': profile.tier,
              'creation.success': true
            });

            return profile;
          },
          context: {
            businessStep: 'profile_creation',
            criticalPath: true,
            revenueImpact: tier === 'premium' || tier === 'enterprise'
          }
        },
        {
          name: 'setup_workspace',
          operation: async (span: api.Span) => {
            span.addEvent('workspace.setup.started', {
              'workspace.tenant_id': tenantId,
              'workspace.type': 'default'
            });

            // Simulate workspace setup
            await new Promise(resolve => setTimeout(resolve, 200));

            const workspace = {
              id: `ws_${tenantId}`,
              tenant_id: tenantId,
              name: `${company} Workspace`,
              settings: {
                theme: 'light',
                notifications: true,
                analytics: tier !== 'free'
              }
            };

            span.addEvent('workspace.setup.completed', {
              'workspace.id': workspace.id,
              'workspace.analytics_enabled': workspace.settings.analytics,
              'setup.success': true
            });

            return workspace;
          },
          context: {
            businessStep: 'workspace_setup',
            resourceIntensive: true,
            userExperienceImpact: true
          }
        },
        {
          name: 'send_welcome_email',
          operation: async (span: api.Span) => {
            span.addEvent('welcome_email.sending.started', {
              'email.recipient': email,
              'email.template': 'onboarding_welcome'
            });

            // Simulate email sending via external service
            await businessTraceService.instrumentExternalIntegration(
              'email_service',
              'send_template_email',
              async (emailSpan: api.Span) => {
                emailSpan.setAttributes({
                  'email.service': 'sendgrid',
                  'email.template': 'onboarding_welcome',
                  'email.recipient': email
                });

                // Simulate external API call
                await new Promise(resolve => setTimeout(resolve, 300));

                emailSpan.addEvent('email.sent', {
                  'email.id': `email_${Date.now()}`,
                  'email.delivery_expected': true
                });

                return { message_id: `email_${Date.now()}`, status: 'queued' };
              },
              {
                endpoint: 'https://api.sendgrid.com/v3/mail/send',
                timeout: 5000
              }
            );

            span.addEvent('welcome_email.sending.completed', {
              'email.queued': true,
              'sending.success': true
            });

            return { email_queued: true };
          },
          context: {
            businessStep: 'welcome_email',
            optimizationCandidate: true // Email could be async
          }
        }
      ],
      {
        userId,
        tenantId,
        customerSegment: tier as CustomerSegment,
        userJourneyStage: UserJourneyStage.ONBOARDING,
        businessStep: 'complete_onboarding',
        criticalPath: true,
        userExperienceImpact: true,
        revenueImpact: tier === 'premium' || tier === 'enterprise'
      }
    );

    const [userData, profile, workspace, emailResult] = result;

    res.status(201).json({
      success: true,
      message: 'User onboarding completed successfully',
      data: {
        profile,
        workspace,
        email_sent: emailResult.email_queued
      },
      trace_id: api.trace.getActiveSpan()?.spanContext()?.traceId
    });

  } catch (error) {
    logger.error('User onboarding failed', {
      event: 'user_onboarding.failed',
      error: (error as Error).message,
      user_id: req.user?.id,
      tenant_id: req.tenant?.id
    });

    res.status(500).json({
      success: false,
      message: 'Onboarding failed',
      error: (error as Error).message,
      trace_id: api.trace.getActiveSpan()?.spanContext()?.traceId
    });
  }
});

/**
 * Demo: Authentication flow with enhanced security tracing
 */
router.post('/demo/enhanced-auth', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    // Calculate risk score based on request characteristics
    const riskScore = calculateRiskScore(ipAddress, userAgent, email);

    const authResult = await businessTraceService.instrumentAuthenticationFlow(
      'password_authentication',
      async (span: api.Span) => {
        // Add authentication context
        span.setAttributes({
          'auth.email': email,
          'auth.ip_address': ipAddress,
          'auth.user_agent': userAgent,
          'auth.risk_score': riskScore,
          'auth.mfa_required': riskScore > 70
        });

        // Simulate user lookup
        span.addEvent('auth.user.lookup.started', {
          'lookup.email': email,
          'lookup.method': 'database'
        });

        await new Promise(resolve => setTimeout(resolve, 50));

        // Mock user data
        const user = {
          id: 'user_123',
          email,
          tenantId: 'tenant_456',
          role: 'user',
          permissions: ['read', 'write'],
          mfaEnabled: riskScore > 70
        };

        span.addEvent('auth.user.lookup.completed', {
          'user.found': true,
          'user.id': user.id,
          'user.mfa_enabled': user.mfaEnabled
        });

        // Simulate password verification
        span.addEvent('auth.password.verification.started');
        await new Promise(resolve => setTimeout(resolve, 100)); // Simulate bcrypt

        span.addEvent('auth.password.verification.completed', {
          'password.valid': true,
          'verification.method': 'bcrypt'
        });

        // Generate tokens with enhanced context
        const tokens = await EnhancedJwtService.generateTokenPair(
          user.id,
          user.tenantId,
          user.email,
          user.role,
          user.permissions,
          {
            ipAddress,
            userAgent,
            mfaEnabled: user.mfaEnabled,
            riskScore,
            customerSegment: CustomerSegment.SMB,
            userJourneyStage: UserJourneyStage.REGULAR_USAGE
          }
        );

        return { user, tokens };
      },
      {
        userId: 'user_123',
        email,
        ipAddress,
        userAgent,
        mfaEnabled: riskScore > 70,
        riskScore
      }
    );

    res.json({
      success: true,
      message: 'Authentication successful',
      data: {
        user: {
          id: authResult.user.id,
          email: authResult.user.email,
          role: authResult.user.role,
          mfa_enabled: authResult.user.mfaEnabled
        },
        tokens: authResult.tokens,
        security: {
          risk_score: riskScore,
          mfa_required: riskScore > 70,
          session_id: `session_${Date.now()}`
        }
      },
      trace_id: api.trace.getActiveSpan()?.spanContext()?.traceId
    });

  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Authentication failed',
      error: (error as Error).message,
      trace_id: api.trace.getActiveSpan()?.spanContext()?.traceId
    });
  }
});

/**
 * Demo: High-throughput metrics collection with performance analysis
 */
router.post('/demo/batch-metrics', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { batch_size = 100, include_errors = false } = req.body;
    const organizationId = req.tenant?.id!;

    // Generate mock batch data
    const batchData = generateMockBatchData(batch_size, include_errors);

    // Use enhanced metrics collection service
    const metricsService = new EnhancedMetricsCollectionService(
      req.app.locals.db,
      logger
    );

    const result = await metricsService.collectBatchMetrics(
      organizationId,
      batchData,
      {
        window_ms: 60000,
        max_requests: 10000, // Higher limit for batch
        identifier: 'organization_id'
      },
      {
        customerSegment: req.tenant?.tier as CustomerSegment,
        dataVolume: batch_size > 1000 ? 'large' : batch_size > 100 ? 'medium' : 'small',
        priority: batch_size > 500 ? 'high' : 'medium'
      }
    );

    res.json({
      success: result.success,
      message: 'Batch metrics processed',
      data: result.data,
      performance: result.performance,
      rate_limit: result.rate_limit,
      trace_id: api.trace.getActiveSpan()?.spanContext()?.traceId
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Batch processing failed',
      error: (error as Error).message,
      trace_id: api.trace.getActiveSpan()?.spanContext()?.traceId
    });
  }
});

/**
 * Demo: Performance analysis with optimization recommendations
 */
router.get('/demo/performance-analysis', authenticateToken, async (req: Request, res: Response) => {
  try {
    const analysis = await businessTraceService.instrumentBusinessOperation(
      'performance_analysis',
      BusinessProcess.PERFORMANCE_ANALYSIS,
      async (span: api.Span) => {
        span.addEvent('performance.analysis.started', {
          'analysis.type': 'system_wide',
          'analysis.scope': 'last_24h'
        });

        // Simulate various performance analysis tasks
        const [
          systemMetrics,
          slowOperations,
          errorAnalysis,
          optimizationRecommendations
        ] = await Promise.all([
          analyzeSystemMetrics(span),
          identifySlowOperations(span),
          analyzeErrorPatterns(span),
          generateOptimizationRecommendations(span)
        ]);

        span.addEvent('performance.analysis.completed', {
          'analysis.metrics_count': systemMetrics.length,
          'analysis.slow_operations': slowOperations.length,
          'analysis.error_patterns': errorAnalysis.length,
          'analysis.recommendations': optimizationRecommendations.length
        });

        return {
          system_metrics: systemMetrics,
          slow_operations: slowOperations,
          error_analysis: errorAnalysis,
          optimization_recommendations: optimizationRecommendations,
          analysis_timestamp: new Date()
        };
      },
      {
        businessStep: 'system_performance_analysis',
        tenantId: req.tenant?.id,
        optimizationCandidate: false, // This IS the optimization analysis
        resourceIntensive: true,
        criticalPath: false
      }
    );

    res.json({
      success: true,
      message: 'Performance analysis completed',
      data: analysis,
      trace_id: api.trace.getActiveSpan()?.spanContext()?.traceId
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Performance analysis failed',
      error: (error as Error).message,
      trace_id: api.trace.getActiveSpan()?.spanContext()?.traceId
    });
  }
});

/**
 * Get current sampling configuration and stats
 */
router.get('/demo/sampling-stats', authenticateToken, async (req: Request, res: Response) => {
  try {
    const stats = intelligentSamplingService.getSamplingStats();
    
    res.json({
      success: true,
      message: 'Sampling statistics retrieved',
      data: {
        sampling_stats: stats,
        current_time: new Date(),
        sampling_service: 'intelligent'
      },
      trace_id: api.trace.getActiveSpan()?.spanContext()?.traceId
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve sampling stats',
      error: (error as Error).message,
      trace_id: api.trace.getActiveSpan()?.spanContext()?.traceId
    });
  }
});

/**
 * Update sampling configuration (for testing)
 */
router.put('/demo/sampling-config', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { business_process, tenant_id, config_updates } = req.body;

    if (business_process && config_updates) {
      intelligentSamplingService.updateBusinessProcessConfig(
        business_process as BusinessProcess,
        config_updates
      );
    }

    if (tenant_id && config_updates) {
      intelligentSamplingService.updateTenantConfig(tenant_id, config_updates);
    }

    res.json({
      success: true,
      message: 'Sampling configuration updated',
      data: {
        business_process,
        tenant_id,
        updates_applied: config_updates
      },
      trace_id: api.trace.getActiveSpan()?.spanContext()?.traceId
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update sampling configuration',
      error: (error as Error).message,
      trace_id: api.trace.getActiveSpan()?.spanContext()?.traceId
    });
  }
});

/**
 * Helper functions
 */
function calculateRiskScore(ipAddress: string, userAgent: string, email: string): number {
  let score = 0;

  // IP-based risk factors
  if (ipAddress.includes('unknown')) score += 20;
  if (ipAddress.startsWith('10.') || ipAddress.startsWith('192.168.')) score += 10; // Internal IPs

  // User agent risk factors
  if (userAgent.includes('curl') || userAgent.includes('wget')) score += 30;
  if (userAgent.length < 20) score += 15;

  // Email-based risk factors
  if (!email.includes('@')) score += 50;
  if (email.includes('test') || email.includes('example')) score += 25;

  return Math.min(score, 100);
}

function generateMockBatchData(size: number, includeErrors: boolean) {
  const batch: any = {
    command_executions: [],
    agent_interactions: [],
    user_sessions: [],
    productivity_metrics: []
  };

  for (let i = 0; i < size; i++) {
    // Add command executions
    batch.command_executions.push({
      command_name: `command_${i % 10}`,
      execution_time: Date.now(),
      success: includeErrors ? Math.random() > 0.1 : true,
      duration_ms: Math.floor(Math.random() * 1000),
      command_args: { arg1: 'value1', arg2: 'value2' },
      context: { session_id: `session_${i}` }
    });

    // Add agent interactions occasionally
    if (i % 5 === 0) {
      batch.agent_interactions.push({
        agent_name: `agent_${i % 3}`,
        interaction_type: 'delegation',
        start_time: Date.now() - 1000,
        end_time: Date.now(),
        success: includeErrors ? Math.random() > 0.05 : true,
        metadata: { task: `task_${i}` }
      });
    }

    // Add productivity metrics occasionally
    if (i % 8 === 0) {
      batch.productivity_metrics.push({
        metric_type: 'completion_time',
        value: Math.floor(Math.random() * 100),
        timestamp: Date.now(),
        dimensions: { category: 'development' }
      });
    }
  }

  return batch;
}

async function analyzeSystemMetrics(span: api.Span): Promise<any[]> {
  span.addEvent('system_metrics.analysis.started');
  await new Promise(resolve => setTimeout(resolve, 100));
  
  return [
    { metric: 'cpu_usage', value: 65, status: 'normal' },
    { metric: 'memory_usage', value: 78, status: 'elevated' },
    { metric: 'disk_usage', value: 45, status: 'normal' },
    { metric: 'network_latency', value: 125, status: 'normal' }
  ];
}

async function identifySlowOperations(span: api.Span): Promise<any[]> {
  span.addEvent('slow_operations.identification.started');
  await new Promise(resolve => setTimeout(resolve, 150));
  
  return [
    { operation: 'batch_metrics_processing', avg_duration: 2500, threshold: 1000, severity: 'high' },
    { operation: 'user_authentication', avg_duration: 800, threshold: 500, severity: 'medium' },
    { operation: 'database_query', avg_duration: 300, threshold: 200, severity: 'low' }
  ];
}

async function analyzeErrorPatterns(span: api.Span): Promise<any[]> {
  span.addEvent('error_patterns.analysis.started');
  await new Promise(resolve => setTimeout(resolve, 80));
  
  return [
    { pattern: 'database_connection_timeout', frequency: 15, trend: 'increasing' },
    { pattern: 'validation_error', frequency: 8, trend: 'stable' },
    { pattern: 'rate_limit_exceeded', frequency: 3, trend: 'decreasing' }
  ];
}

async function generateOptimizationRecommendations(span: api.Span): Promise<any[]> {
  span.addEvent('optimization_recommendations.generation.started');
  await new Promise(resolve => setTimeout(resolve, 120));
  
  return [
    {
      recommendation: 'Implement connection pooling for database operations',
      priority: 'high',
      estimated_improvement: '40% reduction in connection overhead',
      effort: 'medium'
    },
    {
      recommendation: 'Add caching layer for frequently accessed data',
      priority: 'medium',
      estimated_improvement: '25% reduction in query response time',
      effort: 'low'
    },
    {
      recommendation: 'Optimize batch processing with parallel execution',
      priority: 'high',
      estimated_improvement: '60% improvement in batch throughput',
      effort: 'high'
    }
  ];
}

export default router;