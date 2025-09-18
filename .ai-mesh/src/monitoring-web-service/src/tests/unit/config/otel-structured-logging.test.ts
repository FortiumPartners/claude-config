/**
 * OTEL Structured Logging Integration Tests
 * Sprint 3: Task 3.2 - Structured Logging Integration
 * 
 * Validates OTEL semantic conventions integration, trace correlation,
 * and backward compatibility with existing logging patterns.
 */

import * as api from '@opentelemetry/api';
import { 
  logger,
  loggers,
  createContextualLogger,
  logWithContext,
  extractOTELContext,
  getServiceResourceAttributes,
  createOTELLogEntry,
  LogContext
} from '../../../config/logger';
import { otelFeatureFlags } from '../../../config/otel.config';

// Mock OpenTelemetry API
jest.mock('@opentelemetry/api');
const mockApi = api as jest.Mocked<typeof api>;

// Mock OTEL configuration
jest.mock('../../../config/otel.config', () => ({
  otelFeatureFlags: {
    enabled: true,
    logs: true,
    tracing: true,
  },
}));

// Mock environment config
jest.mock('../../../config/environment', () => ({
  config: {
    nodeEnv: 'test',
    service: {
      name: 'test-service',
      version: '1.0.0',
    },
    database: {
      name: 'test_db',
      user: 'test_user',
    },
  },
}));

describe('OTEL Structured Logging Integration', () => {
  let mockSpan: jest.Mocked<api.Span>;
  let mockSpanContext: api.SpanContext;
  let mockContext: api.Context;
  let mockBaggage: api.Baggage;
  let loggerSpy: jest.SpyInstance<any, any>;

  beforeEach(() => {
    // Setup mock span context
    mockSpanContext = {
      traceId: '1234567890abcdef1234567890abcdef',
      spanId: 'fedcba0987654321',
      traceFlags: 1,
      isRemote: false,
    };

    // Setup mock span
    mockSpan = {
      spanContext: jest.fn(() => mockSpanContext),
      isRecording: jest.fn(() => true),
      addEvent: jest.fn(),
      setAttributes: jest.fn(),
      recordException: jest.fn(),
      setStatus: jest.fn(),
      end: jest.fn(),
    } as any;

    // Setup mock context and baggage
    mockContext = {} as api.Context;
    mockBaggage = {
      getAllEntries: jest.fn(() => new Map([['session.id', { value: 'test-session' }]])),
    } as any;

    // Mock API functions
    mockApi.trace = {
      getActiveSpan: jest.fn(() => mockSpan),
      getTracer: jest.fn(() => ({
        startSpan: jest.fn(() => mockSpan),
      })),
    } as any;

    mockApi.context = {
      active: jest.fn(() => mockContext),
      with: jest.fn().mockImplementation((ctx, fn) => fn()),
    } as any;

    mockApi.propagation = {
      getBaggage: jest.fn(() => mockBaggage),
      setBaggage: jest.fn(),
      createBaggage: jest.fn(() => mockBaggage),
    } as any;

    // Spy on logger methods
    loggerSpy = jest.spyOn(logger, 'log').mockImplementation(() => logger as any);
    jest.spyOn(logger, 'info').mockImplementation(() => logger as any);
    jest.spyOn(logger, 'warn').mockImplementation(() => logger as any);
    jest.spyOn(logger, 'error').mockImplementation(() => logger as any);
    jest.spyOn(logger, 'debug').mockImplementation(() => logger as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('OTEL Context Extraction', () => {
    it('should extract OTEL context when available', () => {
      const context = extractOTELContext();

      expect(context).toEqual({
        traceId: '1234567890abcdef1234567890abcdef',
        spanId: 'fedcba0987654321',
        traceFlags: 1,
        baggage: { 'session.id': 'test-session' },
      });
      expect(mockApi.trace.getActiveSpan).toHaveBeenCalled();
    });

    it('should return empty context when OTEL is disabled', () => {
      jest.mocked(otelFeatureFlags).logs = false;

      const context = extractOTELContext();

      expect(context).toEqual({});
      expect(mockApi.trace.getActiveSpan).not.toHaveBeenCalled();
    });

    it('should handle OTEL extraction errors gracefully', () => {
      mockApi.trace.getActiveSpan = jest.fn(() => {
        throw new Error('OTEL error');
      });

      const context = extractOTELContext();

      expect(context).toEqual({});
    });
  });

  describe('Service Resource Attributes', () => {
    it('should create service resource attributes with OTEL semantic conventions', () => {
      const attributes = getServiceResourceAttributes();

      expect(attributes).toMatchObject({
        'service.name': 'test-service',
        'service.version': '1.0.0',
        'service.namespace': 'fortium-platform',
        'deployment.environment': 'test',
        'service.component': 'metrics-collection',
        'service.team': 'fortium-platform',
      });

      // Should include dynamic attributes
      expect(attributes['service.instance.id']).toMatch(/^\d+-\d+$/);
    });
  });

  describe('Enhanced Contextual Logger', () => {
    it('should create contextual logger with OTEL correlation', () => {
      const context: LogContext = {
        userId: 'user123',
        tenantId: 'tenant456',
        correlationId: 'corr789',
      };

      const contextualLogger = createContextualLogger(context);

      expect(contextualLogger).toBeDefined();
      // Verify it's a child logger with enhanced context
      expect(logger.child).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user123',
          tenantId: 'tenant456',
          correlationId: 'corr789',
          'trace.trace_id': '1234567890abcdef1234567890abcdef',
          'trace.span_id': 'fedcba0987654321',
          'enduser.id': 'user123',
          'fortium.tenant.id': 'tenant456',
          'fortium.correlation.id': 'corr789',
        })
      );
    });
  });

  describe('Enhanced Structured Logging', () => {
    it('should log with OTEL context and semantic conventions', () => {
      const context: LogContext = {
        userId: 'user123',
        correlationId: 'corr789',
      };

      logWithContext('info', 'Test message', context, { custom: 'data' });

      expect(loggerSpy).toHaveBeenCalledWith('info', 'Test message', 
        expect.objectContaining({
          userId: 'user123',
          correlationId: 'corr789',
          custom: 'data',
          'trace.trace_id': '1234567890abcdef1234567890abcdef',
          'trace.span_id': 'fedcba0987654321',
          'service.name': 'test-service',
          'enduser.id': 'user123',
          'log.level': 'info',
          'log.logger': 'winston',
        })
      );

      // Should add span event
      expect(mockSpan.addEvent).toHaveBeenCalledWith('log.info', {
        'log.message': 'Test message',
        'log.level': 'info',
        'log.timestamp': expect.any(String),
        'log.attributes': JSON.stringify({ custom: 'data' }),
      });
    });
  });

  describe('Authentication Logging', () => {
    it('should log successful login with OTEL semantic conventions', () => {
      loggers.auth.login('user123', 'tenant456', {
        correlationId: 'corr789',
        authMethod: 'password',
        clientIp: '192.168.1.1',
      });

      expect(logger.info).toHaveBeenCalledWith('User login successful',
        expect.objectContaining({
          // Legacy fields preserved
          userId: 'user123',
          tenantId: 'tenant456',
          event: 'auth.login',
          correlationId: 'corr789',
          
          // OTEL semantic conventions
          'enduser.id': 'user123',
          'fortium.tenant.id': 'tenant456',
          'auth.method': 'password',
          'event.domain': 'authentication',
          'event.name': 'login',
          'event.outcome': 'success',
          'client.ip': '192.168.1.1',
          'trace.trace_id': '1234567890abcdef1234567890abcdef',
        })
      );
    });

    it('should log failed login with error conventions', () => {
      loggers.auth.loginFailed('user@example.com', 'Invalid credentials', {
        correlationId: 'corr789',
        attempts: 3,
      });

      expect(logger.warn).toHaveBeenCalledWith('User login failed',
        expect.objectContaining({
          // Legacy fields
          email: 'user@example.com',
          reason: 'Invalid credentials',
          event: 'auth.login_failed',
          
          // OTEL error conventions
          'error.type': 'AuthenticationError',
          'error.message': 'Invalid credentials',
          'event.outcome': 'failure',
          'auth.login.attempts': 3,
        })
      );
    });
  });

  describe('API Request Logging', () => {
    it('should log API requests with HTTP semantic conventions', () => {
      loggers.api.request('GET', '/api/v1/users', 'user123', 'tenant456', {
        url: 'https://api.example.com/api/v1/users',
        userAgent: 'Test-Agent/1.0',
        clientIp: '192.168.1.1',
      });

      expect(logger.info).toHaveBeenCalledWith('API request',
        expect.objectContaining({
          // Legacy fields
          method: 'GET',
          path: '/api/v1/users',
          
          // OTEL HTTP semantic conventions
          'http.method': 'GET',
          'http.route': '/api/v1/users',
          'http.url': 'https://api.example.com/api/v1/users',
          'http.user_agent': 'Test-Agent/1.0',
          'http.client_ip': '192.168.1.1',
          'event.domain': 'http',
          'event.name': 'request',
        })
      );
    });
  });

  describe('Database Logging', () => {
    it('should log database queries with DB semantic conventions', () => {
      const query = 'SELECT * FROM users WHERE id = $1';
      const duration = 150;

      loggers.database.query(query, duration, {
        rowsReturned: 1,
        operation: 'SELECT',
      });

      expect(logger.debug).toHaveBeenCalledWith('Database query',
        expect.objectContaining({
          // Legacy fields
          query,
          duration,
          event: 'database.query',
          
          // OTEL database semantic conventions
          'db.system': 'postgresql',
          'db.statement': query,
          'db.operation': 'SELECT',
          'db.name': 'test_db',
          'performance.duration_ms': 150,
          'performance.category': 'normal',
          'db.query.rows_returned': 1,
        })
      );
    });

    it('should log database errors with exception conventions', () => {
      const error = new Error('Connection timeout');
      const query = 'SELECT * FROM users';

      loggers.database.error(error, query, {
        operation: 'SELECT',
      });

      expect(logger.error).toHaveBeenCalledWith('Database error',
        expect.objectContaining({
          // Legacy fields
          error: 'Connection timeout',
          query,
          
          // OTEL error conventions
          'error.type': 'Error',
          'error.message': 'Connection timeout',
          'exception.type': 'Error',
          'exception.message': 'Connection timeout',
          'db.system': 'postgresql',
          'db.operation': 'SELECT',
          'event.outcome': 'failure',
        })
      );
    });
  });

  describe('Security Logging', () => {
    it('should log suspicious activity with security conventions', () => {
      loggers.security.suspiciousActivity(
        'multiple_failed_logins',
        'user123',
        'tenant456',
        {
          clientIp: '192.168.1.100',
          technique: 'Brute Force',
          severity: 'high',
          riskScore: 85,
        }
      );

      expect(logger.warn).toHaveBeenCalledWith('Suspicious activity detected',
        expect.objectContaining({
          // Legacy fields
          event: 'multiple_failed_logins',
          
          // OTEL security conventions
          'event.domain': 'security',
          'event.name': 'suspicious_activity',
          'event.action': 'multiple_failed_logins',
          'threat.technique.name': 'Brute Force',
          'security.severity': 'high',
          'security.risk_score': 85,
          'client.ip': '192.168.1.100',
        })
      );
    });
  });

  describe('Performance Logging', () => {
    it('should log slow requests with performance conventions', () => {
      loggers.performance.slowRequest('POST', '/api/v1/metrics', 2500, {
        statusCode: 200,
        responseSize: 1024,
      });

      expect(logger.warn).toHaveBeenCalledWith('Slow API request',
        expect.objectContaining({
          // Legacy fields
          method: 'POST',
          path: '/api/v1/metrics',
          duration: 2500,
          
          // OTEL performance conventions
          'http.method': 'POST',
          'http.route': '/api/v1/metrics',
          'performance.duration_ms': 2500,
          'performance.category': 'slow',
          'event.domain': 'performance',
          'event.name': 'slow_request',
          'event.outcome': 'success', // Slow but successful
          'http.status_code': 200,
        })
      );
    });
  });

  describe('OTEL Log Entry Creation', () => {
    it('should create OTEL-aware log entries', () => {
      const entry = createOTELLogEntry('info', 'Test message', {
        custom: 'attribute',
      });

      expect(entry).toMatchObject({
        level: 'info',
        message: 'Test message',
        timestamp: expect.any(String),
        'service.name': 'test-service',
        'trace.trace_id': '1234567890abcdef1234567890abcdef',
        'trace.span_id': 'fedcba0987654321',
        custom: 'attribute',
      });
    });
  });

  describe('Backward Compatibility', () => {
    it('should preserve all existing logging patterns', () => {
      // Test existing logger usage patterns still work
      logger.info('Legacy log message', { correlationId: 'test' });
      
      expect(logger.info).toHaveBeenCalledWith('Legacy log message', {
        correlationId: 'test',
      });
    });

    it('should preserve legacy helper function signatures', () => {
      // All existing helper functions should work without modification
      expect(() => {
        loggers.auth.login('user', 'tenant');
        loggers.api.request('GET', '/test');
        loggers.database.query('SELECT 1', 100);
        loggers.security.rateLimit('127.0.0.1', '/api');
        loggers.performance.slowQuery('SELECT 1', 2000);
      }).not.toThrow();
    });
  });

  describe('Performance Impact', () => {
    it('should have minimal performance impact when OTEL is disabled', () => {
      jest.mocked(otelFeatureFlags).logs = false;
      jest.mocked(otelFeatureFlags).enabled = false;

      const start = Date.now();
      for (let i = 0; i < 1000; i++) {
        logWithContext('info', 'Test message', { test: i });
      }
      const duration = Date.now() - start;

      // Should complete 1000 log operations in reasonable time
      expect(duration).toBeLessThan(1000); // Less than 1ms per log operation
      expect(mockApi.trace.getActiveSpan).not.toHaveBeenCalled();
    });

    it('should handle OTEL context extraction efficiently', () => {
      const start = Date.now();
      for (let i = 0; i < 100; i++) {
        extractOTELContext();
      }
      const duration = Date.now() - start;

      // Context extraction should be fast
      expect(duration).toBeLessThan(50); // Less than 0.5ms per extraction
    });
  });
});