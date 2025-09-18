/**
 * Enhanced Business Tracing Integration Tests
 * Task 4.3: Custom Trace Instrumentation Enhancement (Sprint 4)
 * 
 * Tests:
 * - Business process tracing end-to-end
 * - Span events and milestone tracking
 * - Intelligent sampling decisions
 * - Performance categorization and optimization detection
 * - Audit trail generation
 */

import { describe, it, beforeAll, afterAll, beforeEach, expect, jest } from '@jest/globals';
import request from 'supertest';
import { Express } from 'express';
import * as api from '@opentelemetry/api';
import { 
  businessTraceService, 
  BusinessProcess, 
  CustomerSegment, 
  UserJourneyStage 
} from '../../tracing/business-trace.service';
import { intelligentSamplingService } from '../../tracing/intelligent-sampling.service';
import EnhancedJwtService from '../../auth/jwt.service.instrumented';
import { logger } from '../../config/logger';

// Mock app setup
let app: Express;
let server: any;
let mockSpan: any;
let mockTracer: any;

// Mock OTEL components
const mockSpanContext = {
  traceId: '12345678901234567890123456789012',
  spanId: '1234567890123456',
  traceFlags: 1
};

beforeAll(async () => {
  // Setup mock OTEL tracer and span
  mockSpan = {
    spanContext: jest.fn(() => mockSpanContext),
    setAttributes: jest.fn(),
    addEvent: jest.fn(),
    recordException: jest.fn(),
    setStatus: jest.fn(),
    end: jest.fn()
  };

  mockTracer = {
    startSpan: jest.fn(() => mockSpan),
    startActiveSpan: jest.fn((name, options, fn) => {
      if (typeof fn === 'function') {
        return fn(mockSpan);
      }
      return mockSpan;
    })
  };

  // Mock the OTEL API
  jest.spyOn(api.trace, 'getActiveTracer').mockReturnValue(mockTracer as any);
  jest.spyOn(api.trace, 'getActiveSpan').mockReturnValue(mockSpan as any);

  // Setup test app (simplified)
  const express = require('express');
  app = express();
  app.use(express.json());

  // Mock database connection
  app.locals.db = {
    query: jest.fn().mockResolvedValue({ rows: [] }),
    end: jest.fn()
  };

  // Start server
  server = app.listen(0);
});

afterAll(async () => {
  if (server) {
    server.close();
  }
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Business Trace Service', () => {
  describe('instrumentBusinessOperation', () => {
    it('should create enhanced business operation span with comprehensive context', async () => {
      const operation = jest.fn().mockResolvedValue({ result: 'success' });
      
      const result = await businessTraceService.instrumentBusinessOperation(
        'test_operation',
        BusinessProcess.USER_ONBOARDING,
        operation,
        {
          userId: 'user123',
          tenantId: 'tenant456',
          customerSegment: CustomerSegment.SMB,
          userJourneyStage: UserJourneyStage.ONBOARDING,
          criticalPath: true,
          securitySensitive: true,
          revenueImpact: true
        }
      );

      expect(result).toEqual({ result: 'success' });
      expect(mockTracer.startActiveSpan).toHaveBeenCalledWith(
        'business.user_onboarding.test_operation',
        expect.objectContaining({
          kind: api.SpanKind.INTERNAL,
          attributes: expect.objectContaining({
            'business.process': BusinessProcess.USER_ONBOARDING,
            'business.operation': 'test_operation',
            'business.customer_segment': CustomerSegment.SMB,
            'business.user_journey_stage': UserJourneyStage.ONBOARDING,
            'performance.critical_path': true,
            'business.security_sensitive': true,
            'business.revenue_impact': true
          })
        }),
        expect.any(Function)
      );

      expect(operation).toHaveBeenCalledWith(mockSpan);
    });

    it('should add business milestone events during operation execution', async () => {
      const operation = jest.fn().mockResolvedValue({ result: 'success' });
      
      await businessTraceService.instrumentBusinessOperation(
        'milestone_test',
        BusinessProcess.AUTHENTICATION_FLOW,
        operation,
        {
          businessStep: 'token_generation'
        }
      );

      // Verify milestone events were added
      expect(mockSpan.addEvent).toHaveBeenCalledWith(
        'business.operation.started',
        expect.objectContaining({
          'operation.name': 'milestone_test',
          'business.process': BusinessProcess.AUTHENTICATION_FLOW
        })
      );

      expect(mockSpan.addEvent).toHaveBeenCalledWith(
        'business.operation.completed',
        expect.objectContaining({
          'operation.success': true,
          'performance.category': expect.any(String)
        })
      );
    });

    it('should handle errors with enhanced error context and audit trails', async () => {
      const testError = new Error('Test business operation error');
      const operation = jest.fn().mockRejectedValue(testError);
      
      await expect(
        businessTraceService.instrumentBusinessOperation(
          'error_test',
          BusinessProcess.METRICS_INGESTION,
          operation,
          {
            businessStep: 'data_processing'
          }
        )
      ).rejects.toThrow('Test business operation error');

      // Verify error handling
      expect(mockSpan.setAttributes).toHaveBeenCalledWith(
        expect.objectContaining({
          'operation.success': false,
          'error.type': 'Error',
          'error.business_impact': expect.any(String)
        })
      );

      expect(mockSpan.addEvent).toHaveBeenCalledWith(
        'business.operation.failed',
        expect.objectContaining({
          'error.message': 'Test business operation error',
          'error.type': 'Error',
          'business.error_severity': expect.any(String)
        })
      );

      expect(mockSpan.recordException).toHaveBeenCalledWith(
        testError,
        expect.objectContaining({
          'business.process': BusinessProcess.METRICS_INGESTION,
          'business.error_category': expect.any(String)
        })
      );
    });

    it('should categorize performance and provide optimization insights', async () => {
      const slowOperation = jest.fn().mockImplementation(async () => {
        // Simulate slow operation
        await new Promise(resolve => setTimeout(resolve, 100));
        return { result: 'slow_success' };
      });

      await businessTraceService.instrumentBusinessOperation(
        'performance_test',
        BusinessProcess.DATA_PROCESSING,
        slowOperation,
        {
          optimizationCandidate: true,
          resourceIntensive: true
        }
      );

      // Verify performance categorization
      expect(mockSpan.setAttributes).toHaveBeenCalledWith(
        expect.objectContaining({
          'operation.duration_ms': expect.any(Number),
          'operation.success': true
        })
      );

      // Should include performance analysis in completion event
      expect(mockSpan.addEvent).toHaveBeenCalledWith(
        'business.operation.completed',
        expect.objectContaining({
          'performance.category': expect.any(String)
        })
      );
    });
  });

  describe('instrumentBusinessTransaction', () => {
    it('should trace multi-step business transactions with correlation', async () => {
      const step1 = jest.fn().mockResolvedValue('step1_result');
      const step2 = jest.fn().mockResolvedValue('step2_result');
      const step3 = jest.fn().mockResolvedValue('step3_result');

      const result = await businessTraceService.instrumentBusinessTransaction(
        'multi_step_test',
        BusinessProcess.USER_ONBOARDING,
        [
          { name: 'step1', operation: step1 },
          { name: 'step2', operation: step2 },
          { name: 'step3', operation: step3 }
        ],
        {
          userId: 'user123',
          businessStep: 'complete_onboarding'
        }
      );

      expect(result).toEqual(['step1_result', 'step2_result', 'step3_result']);

      // Verify transaction started event
      expect(mockSpan.addEvent).toHaveBeenCalledWith(
        'business.transaction.started',
        expect.objectContaining({
          'transaction.steps': 3,
          'transaction.name': 'multi_step_test'
        })
      );

      // Verify transaction completed event
      expect(mockSpan.addEvent).toHaveBeenCalledWith(
        'business.transaction.completed',
        expect.objectContaining({
          'transaction.steps_completed': 3,
          'transaction.success': true
        })
      );

      // Verify all steps were called
      expect(step1).toHaveBeenCalled();
      expect(step2).toHaveBeenCalled();
      expect(step3).toHaveBeenCalled();
    });

    it('should fail entire transaction when step fails', async () => {
      const step1 = jest.fn().mockResolvedValue('step1_result');
      const step2 = jest.fn().mockRejectedValue(new Error('Step 2 failed'));
      const step3 = jest.fn().mockResolvedValue('step3_result');

      await expect(
        businessTraceService.instrumentBusinessTransaction(
          'failing_transaction',
          BusinessProcess.TENANT_PROVISIONING,
          [
            { name: 'step1', operation: step1 },
            { name: 'step2', operation: step2 },
            { name: 'step3', operation: step3 }
          ],
          {
            criticalPath: true
          }
        )
      ).rejects.toThrow('Step 2 failed');

      // Verify step failure event
      expect(mockSpan.addEvent).toHaveBeenCalledWith(
        'business.transaction.step.failed',
        expect.objectContaining({
          'step.number': 2,
          'step.name': 'step2',
          'error.message': 'Step 2 failed'
        })
      );

      // Step 3 should not be called
      expect(step1).toHaveBeenCalled();
      expect(step2).toHaveBeenCalled();
      expect(step3).not.toHaveBeenCalled();
    });
  });

  describe('instrumentAuthenticationFlow', () => {
    it('should trace authentication with security context', async () => {
      const authOperation = jest.fn().mockResolvedValue({
        user: { id: 'user123', email: 'test@example.com' },
        token: 'jwt_token'
      });

      const result = await businessTraceService.instrumentAuthenticationFlow(
        'password_login',
        authOperation,
        {
          userId: 'user123',
          email: 'test@example.com',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0...',
          mfaEnabled: true,
          riskScore: 25
        }
      );

      expect(result).toEqual({
        user: { id: 'user123', email: 'test@example.com' },
        token: 'jwt_token'
      });

      // Verify security attributes were set
      expect(mockSpan.setAttributes).toHaveBeenCalledWith(
        expect.objectContaining({
          'auth.method': 'password_login',
          'auth.ip_address': '192.168.1.1',
          'auth.mfa_enabled': true,
          'auth.risk_score': 25,
          'security.sensitive': true
        })
      );

      // Verify authentication events
      expect(mockSpan.addEvent).toHaveBeenCalledWith(
        'auth.attempt.started',
        expect.objectContaining({
          'auth.method': 'password_login',
          'auth.user_id': 'user123',
          'auth.ip_address': '192.168.1.1'
        })
      );

      expect(mockSpan.addEvent).toHaveBeenCalledWith(
        'auth.attempt.succeeded',
        expect.objectContaining({
          'auth.method': 'password_login',
          'auth.user_id': 'user123'
        })
      );
    });
  });

  describe('instrumentExternalIntegration', () => {
    it('should trace external service calls with dependency context', async () => {
      const externalOperation = jest.fn().mockResolvedValue({
        response: 'external_success',
        status: 200
      });

      const result = await businessTraceService.instrumentExternalIntegration(
        'email_service',
        'send_email',
        externalOperation,
        {
          endpoint: 'https://api.sendgrid.com/v3/mail/send',
          timeout: 5000,
          retryCount: 0,
          circuitBreakerState: 'closed'
        }
      );

      expect(result).toEqual({
        response: 'external_success',
        status: 200
      });

      // Verify external service attributes
      expect(mockSpan.setAttributes).toHaveBeenCalledWith(
        expect.objectContaining({
          'external.service.name': 'email_service',
          'external.service.operation': 'send_email',
          'external.service.endpoint': 'https://api.sendgrid.com/v3/mail/send',
          'external.service.timeout_ms': 5000,
          'external.service.circuit_breaker': 'closed'
        })
      );

      // Verify external call events
      expect(mockSpan.addEvent).toHaveBeenCalledWith(
        'external.call.started',
        expect.objectContaining({
          'external.service': 'email_service',
          'external.operation': 'send_email'
        })
      );

      expect(mockSpan.addEvent).toHaveBeenCalledWith(
        'external.call.completed',
        expect.objectContaining({
          'external.service': 'email_service',
          'external.success': true
        })
      );
    });
  });
});

describe('Intelligent Sampling Service', () => {
  describe('shouldSample', () => {
    it('should always sample business critical operations', () => {
      const context = api.ROOT_CONTEXT;
      const attributes = {
        'business.process': BusinessProcess.AUTHENTICATION_FLOW,
        'business.security_sensitive': true,
        'business.critical_path': true
      };

      const result = intelligentSamplingService.shouldSample(
        context,
        mockSpanContext.traceId,
        'critical_auth_operation',
        api.SpanKind.SERVER,
        attributes,
        []
      );

      expect(result.decision).toBe(api.SamplingDecision.RECORD_AND_SAMPLED);
      expect(result.attributes!['sampling.strategy']).toBe('always');
      expect(result.attributes!['sampling.reason']).toBe('business_critical');
    });

    it('should use error-based sampling for error scenarios', () => {
      const context = api.ROOT_CONTEXT;
      const attributes = {
        'business.process': BusinessProcess.METRICS_INGESTION,
        'http.status_code': 500,
        'error.occurred': true
      };

      const result = intelligentSamplingService.shouldSample(
        context,
        mockSpanContext.traceId,
        'error_operation',
        api.SpanKind.SERVER,
        attributes,
        []
      );

      expect(result.attributes!['sampling.strategy']).toBe('error_based');
      expect(result.attributes!['sampling.reason']).toBe('error_scenario');
    });

    it('should use performance-based sampling for slow operations', () => {
      const context = api.ROOT_CONTEXT;
      const attributes = {
        'business.process': BusinessProcess.DATA_PROCESSING,
        'operation.duration_ms': 2500,
        'performance.resource_intensive': true
      };

      const result = intelligentSamplingService.shouldSample(
        context,
        mockSpanContext.traceId,
        'slow_operation',
        api.SpanKind.INTERNAL,
        attributes,
        []
      );

      expect(result.attributes!['sampling.strategy']).toBe('performance_based');
      expect(result.attributes!['sampling.reason']).toBe('performance_analysis');
    });

    it('should apply tenant-based sampling based on tier', () => {
      const context = api.ROOT_CONTEXT;
      const attributes = {
        'business.process': BusinessProcess.METRICS_INGESTION,
        'tenant.id': 'tenant123',
        'tenant.tier': 'enterprise'
      };

      // Configure tenant
      intelligentSamplingService.updateTenantConfig('tenant123', {
        tenantId: 'tenant123',
        tier: 'enterprise',
        baseRate: 0.5,
        priorityMultiplier: 1.5,
        budgetLimit: 50000,
        currentUsage: 1000,
        resetTime: new Date(Date.now() + 3600000)
      });

      const result = intelligentSamplingService.shouldSample(
        context,
        mockSpanContext.traceId,
        'tenant_operation',
        api.SpanKind.SERVER,
        attributes,
        []
      );

      expect(result.attributes!['sampling.strategy']).toBe('tenant_based');
      expect(result.attributes!['sampling.reason']).toBe('tenant_policy');
    });

    it('should include sampling rate and decision metadata', () => {
      const context = api.ROOT_CONTEXT;
      const attributes = {
        'business.process': BusinessProcess.USER_ONBOARDING
      };

      const result = intelligentSamplingService.shouldSample(
        context,
        mockSpanContext.traceId,
        'test_operation',
        api.SpanKind.SERVER,
        attributes,
        []
      );

      expect(result.attributes!['sampling.rate']).toBeGreaterThanOrEqual(0);
      expect(result.attributes!['sampling.rate']).toBeLessThanOrEqual(1);
      expect(result.attributes!['sampling.intelligent']).toBe(true);
      expect(result.attributes!['sampling.decision_time']).toBeDefined();
      expect(result.traceState?.get('sampling_rate')).toBeDefined();
    });
  });

  describe('getSamplingStats', () => {
    it('should return comprehensive sampling statistics', () => {
      const stats = intelligentSamplingService.getSamplingStats();

      expect(stats).toHaveProperty('system_metrics');
      expect(stats).toHaveProperty('business_process_configs');
      expect(stats).toHaveProperty('tenant_configs');
      expect(stats).toHaveProperty('sampling_history_size');
      expect(stats).toHaveProperty('last_config_update');

      expect(Array.isArray(stats.business_process_configs)).toBe(true);
      expect(typeof stats.tenant_configs).toBe('number');
      expect(typeof stats.sampling_history_size).toBe('number');
    });
  });
});

describe('Enhanced JWT Service', () => {
  describe('generateTokenPair', () => {
    it('should generate tokens with business tracing context', async () => {
      // Mock the internal methods
      jest.spyOn(EnhancedJwtService, 'generateAccessToken').mockResolvedValue('access_token');
      jest.spyOn(EnhancedJwtService, 'generateRefreshToken').mockResolvedValue('refresh_token');
      
      const result = await EnhancedJwtService.generateTokenPair(
        'user123',
        'tenant456',
        'test@example.com',
        'user',
        ['read', 'write'],
        {
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0...',
          customerSegment: CustomerSegment.ENTERPRISE,
          userJourneyStage: UserJourneyStage.REGULAR_USAGE
        }
      );

      expect(result).toHaveProperty('accessToken', 'access_token');
      expect(result).toHaveProperty('refreshToken', 'refresh_token');
      expect(result).toHaveProperty('expiresIn');
      expect(result).toHaveProperty('refreshExpiresIn');

      // Verify business tracing was used
      expect(mockTracer.startActiveSpan).toHaveBeenCalledWith(
        expect.stringMatching(/transaction\.authentication_flow\./),
        expect.any(Object),
        expect.any(Function)
      );
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify tokens with security audit trail', async () => {
      // Mock jwt.verify
      const jwt = require('jsonwebtoken');
      jest.spyOn(jwt, 'verify').mockReturnValue({
        userId: 'user123',
        tenantId: 'tenant456',
        email: 'test@example.com',
        role: 'user',
        exp: Math.floor(Date.now() / 1000) + 3600
      });

      const result = await EnhancedJwtService.verifyAccessToken(
        'valid_token',
        {
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0...'
        }
      );

      expect(result).toHaveProperty('userId', 'user123');
      expect(result).toHaveProperty('tenantId', 'tenant456');

      // Verify security audit events
      expect(mockSpan.addEvent).toHaveBeenCalledWith(
        'security.token.verified',
        expect.objectContaining({
          'security.token_type': 'access',
          'security.user_id': 'user123',
          'security.verification_success': true
        })
      );
    });
  });
});

describe('Performance and Optimization', () => {
  it('should provide performance insights for business operations', async () => {
    let capturedDuration: number = 0;
    
    const slowOperation = jest.fn().mockImplementation(async (span) => {
      await new Promise(resolve => setTimeout(resolve, 150));
      return { result: 'completed' };
    });

    // Capture span attributes to verify performance categorization
    mockSpan.setAttributes.mockImplementation((attributes: any) => {
      if (attributes['operation.duration_ms']) {
        capturedDuration = attributes['operation.duration_ms'];
      }
    });

    await businessTraceService.instrumentBusinessOperation(
      'slow_test_operation',
      BusinessProcess.DATA_PROCESSING,
      slowOperation,
      {
        optimizationCandidate: true,
        resourceIntensive: true
      }
    );

    expect(capturedDuration).toBeGreaterThan(100);
    
    // Verify performance categorization was applied
    expect(mockSpan.setAttributes).toHaveBeenCalledWith(
      expect.objectContaining({
        'performance.category': expect.any(String),
        'performance.optimization_score': expect.any(Number)
      })
    );
  });

  it('should generate audit trails for compliance', async () => {
    const auditOperation = jest.fn().mockResolvedValue({ audit: 'success' });

    await businessTraceService.instrumentBusinessOperation(
      'audit_test',
      BusinessProcess.SECURITY_AUDIT,
      auditOperation,
      {
        securitySensitive: true,
        userId: 'user123',
        tenantId: 'tenant456'
      }
    );

    // Verify audit trail events include necessary compliance information
    expect(mockSpan.addEvent).toHaveBeenCalledWith(
      'business.operation.started',
      expect.objectContaining({
        'operation.name': 'audit_test',
        'business.process': BusinessProcess.SECURITY_AUDIT
      })
    );

    expect(mockSpan.addEvent).toHaveBeenCalledWith(
      'business.operation.completed',
      expect.objectContaining({
        'operation.success': true
      })
    );
  });
});