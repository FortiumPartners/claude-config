/**
 * Basic Enhanced Logger Tests
 * Sprint 3: Task 3.2 - Basic Functionality Validation
 * 
 * Tests basic functionality without complex OTEL mocking
 */

import { 
  logger,
  loggers,
  createContextualLogger,
  logWithContext,
  LogContext,
  createOTELLogEntry
} from '../../../config/logger-simple';

describe('Enhanced Logger Basic Functionality', () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    // Spy on logger methods
    logSpy = jest.spyOn(logger, 'log').mockImplementation(() => logger as any);
    jest.spyOn(logger, 'info').mockImplementation(() => logger as any);
    jest.spyOn(logger, 'warn').mockImplementation(() => logger as any);
    jest.spyOn(logger, 'error').mockImplementation(() => logger as any);
    jest.spyOn(logger, 'debug').mockImplementation(() => logger as any);
    jest.spyOn(logger, 'child').mockImplementation(() => logger as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Logging Functions', () => {
    it('should log basic messages', () => {
      logger.info('Test message');
      expect(logger.info).toHaveBeenCalledWith('Test message');
    });

    it('should log with metadata', () => {
      logger.info('Test message', { key: 'value' });
      expect(logger.info).toHaveBeenCalledWith('Test message', { key: 'value' });
    });

    it('should use logWithContext function', () => {
      logWithContext('info', 'Test message', { userId: 'user123' }, { extra: 'data' });
      
      expect(logSpy).toHaveBeenCalledWith('info', 'Test message', 
        expect.objectContaining({
          userId: 'user123',
          extra: 'data',
          'log.level': 'info',
          'log.logger': 'winston',
          'enduser.id': 'user123',
        })
      );
    });
  });

  describe('Structured Logger Helpers', () => {
    it('should log authentication events', () => {
      loggers.auth.login('user123', 'tenant456', {
        correlationId: 'corr123',
        authMethod: 'password',
      });

      expect(logger.info).toHaveBeenCalledWith('User login successful',
        expect.objectContaining({
          userId: 'user123',
          tenantId: 'tenant456',
          event: 'auth.login',
          correlationId: 'corr123',
          'enduser.id': 'user123',
          'fortium.tenant.id': 'tenant456',
          'auth.method': 'password',
          'event.domain': 'authentication',
          'event.name': 'login',
          'event.outcome': 'success',
        })
      );
    });

    it('should log API requests', () => {
      loggers.api.request('GET', '/api/users', 'user123', 'tenant456', {
        userAgent: 'Test-Agent/1.0',
        clientIp: '192.168.1.1',
      });

      expect(logger.info).toHaveBeenCalledWith('API request',
        expect.objectContaining({
          method: 'GET',
          path: '/api/users',
          userId: 'user123',
          tenantId: 'tenant456',
          'http.method': 'GET',
          'http.route': '/api/users',
          'http.user_agent': 'Test-Agent/1.0',
          'http.client_ip': '192.168.1.1',
          'event.domain': 'http',
          'event.name': 'request',
        })
      );
    });

    it('should log database operations', () => {
      loggers.database.query('SELECT * FROM users', 150, {
        operation: 'SELECT',
        rowsReturned: 5,
      });

      expect(logger.debug).toHaveBeenCalledWith('Database query',
        expect.objectContaining({
          query: 'SELECT * FROM users',
          duration: 150,
          'db.system': 'postgresql',
          'db.statement': 'SELECT * FROM users',
          'db.operation': 'SELECT',
          'performance.duration_ms': 150,
          'event.domain': 'database',
          'event.name': 'query',
        })
      );
    });

    it('should log security events', () => {
      loggers.security.suspiciousActivity(
        'multiple_failed_logins',
        'user123',
        'tenant456',
        {
          clientIp: '192.168.1.100',
          severity: 'high',
        }
      );

      expect(logger.warn).toHaveBeenCalledWith('Suspicious activity detected',
        expect.objectContaining({
          event: 'multiple_failed_logins',
          userId: 'user123',
          tenantId: 'tenant456',
          'event.domain': 'security',
          'event.name': 'suspicious_activity',
          'client.ip': '192.168.1.100',
          'security.severity': 'high',
        })
      );
    });

    it('should log performance events', () => {
      loggers.performance.slowRequest('POST', '/api/data', 2500, {
        statusCode: 200,
        threshold: 1000,
      });

      expect(logger.warn).toHaveBeenCalledWith('Slow API request',
        expect.objectContaining({
          method: 'POST',
          path: '/api/data',
          duration: 2500,
          'http.method': 'POST',
          'http.route': '/api/data',
          'performance.duration_ms': 2500,
          'performance.category': 'slow',
          'performance.threshold_ms': 1000,
        })
      );
    });
  });

  describe('Contextual Logger', () => {
    it('should create contextual logger', () => {
      const context: LogContext = {
        userId: 'user123',
        tenantId: 'tenant456',
        operationName: 'test-operation',
      };

      createContextualLogger(context);

      expect(logger.child).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user123',
          tenantId: 'tenant456',
          operationName: 'test-operation',
          'enduser.id': 'user123',
          'fortium.tenant.id': 'tenant456',
          'fortium.operation.name': 'test-operation',
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
        custom: 'attribute',
        'service.name': expect.any(String),
        'service.version': expect.any(String),
        'deployment.environment': expect.any(String),
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', () => {
      const error = new Error('Test error');
      loggers.api.error('GET', '/api/test', error, 'user123', 'tenant456', {
        statusCode: 500,
        duration: 250,
      });

      expect(logger.error).toHaveBeenCalledWith('API error',
        expect.objectContaining({
          method: 'GET',
          path: '/api/test',
          error: 'Test error',
          'error.type': 'Error',
          'error.message': 'Test error',
          'http.status_code': 500,
          'event.outcome': 'failure',
        })
      );
    });

    it('should handle database errors gracefully', () => {
      const error = new Error('Connection failed');
      loggers.database.error(error, 'SELECT * FROM users', {
        operation: 'SELECT',
      });

      expect(logger.error).toHaveBeenCalledWith('Database error',
        expect.objectContaining({
          error: 'Connection failed',
          query: 'SELECT * FROM users',
          'error.type': 'Error',
          'error.message': 'Connection failed',
          'db.operation': 'SELECT',
          'event.outcome': 'failure',
        })
      );
    });
  });

  describe('Utility Functions', () => {
    it('should extract database operation correctly', () => {
      // Test through the database logger which uses extractDbOperation internally
      loggers.database.query('INSERT INTO users VALUES (1)', 100);
      
      expect(logger.debug).toHaveBeenCalledWith('Database query',
        expect.objectContaining({
          'db.operation': 'INSERT',
        })
      );
    });

    it('should categorize performance correctly', () => {
      // Fast query
      loggers.database.query('SELECT 1', 25);
      expect(logger.debug).toHaveBeenCalledWith('Database query',
        expect.objectContaining({
          'performance.category': 'fast',
        })
      );

      // Slow query
      loggers.database.query('SELECT * FROM large_table', 1500);
      expect(logger.debug).toHaveBeenCalledWith('Database query',
        expect.objectContaining({
          'performance.category': 'very_slow',
        })
      );
    });
  });

  describe('Backward Compatibility', () => {
    it('should preserve all existing logging patterns', () => {
      // Traditional logging should work unchanged
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

    it('should handle authentication failed events', () => {
      loggers.auth.loginFailed('user@example.com', 'Invalid credentials', {
        attempts: 3,
      });

      expect(logger.warn).toHaveBeenCalledWith('User login failed',
        expect.objectContaining({
          email: 'user@example.com',
          reason: 'Invalid credentials',
          'auth.login.attempts': 3,
          'event.outcome': 'failure',
        })
      );
    });
  });

  describe('Service Resource Attributes', () => {
    it('should include service attributes in logs', () => {
      logWithContext('info', 'Test message');
      
      expect(logSpy).toHaveBeenCalledWith('info', 'Test message',
        expect.objectContaining({
          'service.name': expect.any(String),
          'service.version': expect.any(String),
          'service.namespace': expect.any(String),
          'deployment.environment': expect.any(String),
        })
      );
    });
  });
});