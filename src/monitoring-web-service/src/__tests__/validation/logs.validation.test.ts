/**
 * Log Validation Unit Tests
 * Fortium External Metrics Web Service - Task 2.3: Backend Log API Implementation
 */

import {
  logSchemas,
  LogEntry,
  LogIngestionRequest,
  validateLogEntry,
  sanitizeLogProperties,
  LOG_LIMITS,
} from '../../validation/logs.validation';

describe('Log Validation Schemas', () => {
  describe('logIngestionRequestSchema', () => {
    it('should validate valid log ingestion request', () => {
      const validRequest: LogIngestionRequest = {
        entries: [
          {
            timestamp: '2023-12-01T10:00:00.000Z',
            level: 'Information',
            message: 'User login successful',
            messageTemplate: 'User {UserId} login successful from {IpAddress}',
            properties: {
              userId: 'user-123',
              ipAddress: '192.168.1.1',
              correlationId: '550e8400-e29b-41d4-a716-446655440000',
            },
          },
        ],
      };

      const { error, value } = logSchemas.ingestion.validate(validRequest);

      expect(error).toBeUndefined();
      expect(value).toEqual(validRequest);
    });

    it('should reject request without entries', () => {
      const invalidRequest = {};

      const { error } = logSchemas.ingestion.validate(invalidRequest);

      expect(error).toBeDefined();
      expect(error!.details[0].path).toEqual(['entries']);
    });

    it('should reject empty entries array', () => {
      const invalidRequest = { entries: [] };

      const { error } = logSchemas.ingestion.validate(invalidRequest);

      expect(error).toBeDefined();
      expect(error!.details[0].message).toContain('at least 1 items');
    });

    it('should reject entries array exceeding limit', () => {
      const invalidRequest = {
        entries: Array.from({ length: 101 }, (_, i) => ({
          timestamp: '2023-12-01T10:00:00.000Z',
          level: 'Information',
          message: `Message ${i}`,
          properties: {},
        })),
      };

      const { error } = logSchemas.ingestion.validate(invalidRequest);

      expect(error).toBeDefined();
      expect(error!.details[0].message).toContain('less than or equal to 100 items');
    });

    it('should reject unknown properties', () => {
      const invalidRequest = {
        entries: [{
          timestamp: '2023-12-01T10:00:00.000Z',
          level: 'Information',
          message: 'Test message',
          properties: {},
        }],
        unknownField: 'should be removed',
      };

      const { error, value } = logSchemas.ingestion.validate(invalidRequest);

      expect(error).toBeUndefined();
      expect(value).not.toHaveProperty('unknownField');
    });
  });

  describe('logEntrySchema (via ingestion)', () => {
    it('should validate complete log entry with all fields', () => {
      const validEntry: LogEntry = {
        timestamp: '2023-12-01T10:00:00.000Z',
        level: 'Warning',
        message: 'Slow database query detected',
        messageTemplate: 'Slow query in {Component} took {Duration}ms',
        properties: {
          component: 'UserService',
          duration: 2500,
          correlationId: '550e8400-e29b-41d4-a716-446655440000',
          sessionId: '660e8400-e29b-41d4-a716-446655440001',
          userId: '770e8400-e29b-41d4-a716-446655440002',
          tenantId: '880e8400-e29b-41d4-a716-446655440003',
          traceId: 'trace-12345',
          spanId: 'span-67890',
          operation: 'getUserProfile',
          version: '1.2.3',
          environment: 'production',
          responseTime: 2500,
          userAgent: 'Mozilla/5.0...',
          ipAddress: '192.168.1.100',
          errorCode: 'SLOW_QUERY',
          errorCategory: 'performance',
        },
        exception: {
          type: 'QueryTimeoutException',
          message: 'Query execution exceeded timeout limit',
          stackTrace: 'QueryTimeoutException: Query execution exceeded timeout limit\n    at QueryExecutor.execute',
          source: 'DatabaseQuery',
          innerException: {
            type: 'ConnectionException',
            message: 'Database connection slow',
          },
        },
      };

      const { error } = logSchemas.ingestion.validate({ entries: [validEntry] });

      expect(error).toBeUndefined();
    });

    it('should require timestamp field', () => {
      const invalidEntry = {
        level: 'Information',
        message: 'Test message',
        properties: {},
      };

      const { error } = logSchemas.ingestion.validate({ entries: [invalidEntry] });

      expect(error).toBeDefined();
      expect(error!.details.some(detail => detail.path.includes('timestamp'))).toBe(true);
    });

    it('should require level field', () => {
      const invalidEntry = {
        timestamp: '2023-12-01T10:00:00.000Z',
        message: 'Test message',
        properties: {},
      };

      const { error } = logSchemas.ingestion.validate({ entries: [invalidEntry] });

      expect(error).toBeDefined();
      expect(error!.details.some(detail => detail.path.includes('level'))).toBe(true);
    });

    it('should require message field', () => {
      const invalidEntry = {
        timestamp: '2023-12-01T10:00:00.000Z',
        level: 'Information',
        properties: {},
      };

      const { error } = logSchemas.ingestion.validate({ entries: [invalidEntry] });

      expect(error).toBeDefined();
      expect(error!.details.some(detail => detail.path.includes('message'))).toBe(true);
    });

    it('should validate log levels', () => {
      const validLevels = ['Information', 'Warning', 'Error', 'Fatal'];
      
      for (const level of validLevels) {
        const entry = {
          timestamp: '2023-12-01T10:00:00.000Z',
          level,
          message: 'Test message',
          properties: {},
        };

        const { error } = logSchemas.ingestion.validate({ entries: [entry] });
        expect(error).toBeUndefined();
      }

      const invalidLevel = {
        timestamp: '2023-12-01T10:00:00.000Z',
        level: 'InvalidLevel',
        message: 'Test message',
        properties: {},
      };

      const { error } = logSchemas.ingestion.validate({ entries: [invalidLevel] });
      expect(error).toBeDefined();
    });

    it('should validate ISO 8601 timestamps', () => {
      const validTimestamps = [
        '2023-12-01T10:00:00.000Z',
        '2023-12-01T10:00:00Z',
        '2023-12-01T10:00:00.123Z',
        '2023-12-01T10:00:00+00:00',
      ];

      for (const timestamp of validTimestamps) {
        const entry = {
          timestamp,
          level: 'Information',
          message: 'Test message',
          properties: {},
        };

        const { error } = logSchemas.ingestion.validate({ entries: [entry] });
        expect(error).toBeUndefined();
      }

      const invalidTimestamp = {
        timestamp: 'not-a-date',
        level: 'Information',
        message: 'Test message',
        properties: {},
      };

      const { error } = logSchemas.ingestion.validate({ entries: [invalidTimestamp] });
      expect(error).toBeDefined();
    });

    it('should enforce message length limits', () => {
      const validEntry = {
        timestamp: '2023-12-01T10:00:00.000Z',
        level: 'Information',
        message: 'A'.repeat(2000), // Exactly at limit
        properties: {},
      };

      const { error } = logSchemas.ingestion.validate({ entries: [validEntry] });
      expect(error).toBeUndefined();

      const invalidEntry = {
        timestamp: '2023-12-01T10:00:00.000Z',
        level: 'Information',
        message: 'A'.repeat(2001), // Over limit
        properties: {},
      };

      const { error: error2 } = logSchemas.ingestion.validate({ entries: [invalidEntry] });
      expect(error2).toBeDefined();
    });
  });

  describe('logPropertiesSchema', () => {
    it('should validate common structured properties', () => {
      const validProperties = {
        correlationId: '550e8400-e29b-41d4-a716-446655440000',
        sessionId: '660e8400-e29b-41d4-a716-446655440001',
        userId: '770e8400-e29b-41d4-a716-446655440002',
        tenantId: '880e8400-e29b-41d4-a716-446655440003',
        traceId: 'trace-12345',
        spanId: 'span-67890',
        component: 'UserService',
        operation: 'getUserProfile',
        version: '1.2.3',
        environment: 'production',
        duration: 150.5,
        responseTime: 200,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ipAddress: '192.168.1.1',
        errorCode: 'USER_NOT_FOUND',
        errorCategory: 'validation',
      };

      const entry = {
        timestamp: '2023-12-01T10:00:00.000Z',
        level: 'Information',
        message: 'Test message',
        properties: validProperties,
      };

      const { error } = logSchemas.ingestion.validate({ entries: [entry] });
      expect(error).toBeUndefined();
    });

    it('should validate flexible properties within limits', () => {
      const properties: Record<string, any> = {};
      
      // Add maximum allowed properties (50)
      for (let i = 0; i < 50; i++) {
        properties[`prop${i}`] = `value${i}`;
      }

      const entry = {
        timestamp: '2023-12-01T10:00:00.000Z',
        level: 'Information',
        message: 'Test message',
        properties,
      };

      const { error } = logSchemas.ingestion.validate({ entries: [entry] });
      expect(error).toBeUndefined();
    });

    it('should reject properties exceeding limits', () => {
      const properties: Record<string, any> = {};
      
      // Add more than maximum allowed properties (51)
      for (let i = 0; i < 51; i++) {
        properties[`prop${i}`] = `value${i}`;
      }

      const entry = {
        timestamp: '2023-12-01T10:00:00.000Z',
        level: 'Information',
        message: 'Test message',
        properties,
      };

      const { error } = logSchemas.ingestion.validate({ entries: [entry] });
      expect(error).toBeDefined();
    });

    it('should validate property value types', () => {
      const validProperties = {
        stringProp: 'string value',
        numberProp: 42,
        booleanProp: true,
        dateProp: '2023-12-01T10:00:00.000Z',
        arrayProp: ['item1', 'item2', 'item3'],
      };

      const entry = {
        timestamp: '2023-12-01T10:00:00.000Z',
        level: 'Information',
        message: 'Test message',
        properties: validProperties,
      };

      const { error } = logSchemas.ingestion.validate({ entries: [entry] });
      expect(error).toBeUndefined();
    });

    it('should validate UUID format for correlation IDs', () => {
      const validUUIDs = [
        '550e8400-e29b-41d4-a716-446655440000',
        '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      ];

      for (const uuid of validUUIDs) {
        const entry = {
          timestamp: '2023-12-01T10:00:00.000Z',
          level: 'Information',
          message: 'Test message',
          properties: { correlationId: uuid },
        };

        const { error } = logSchemas.ingestion.validate({ entries: [entry] });
        expect(error).toBeUndefined();
      }

      const invalidUUID = {
        timestamp: '2023-12-01T10:00:00.000Z',
        level: 'Information',
        message: 'Test message',
        properties: { correlationId: 'not-a-uuid' },
      };

      const { error } = logSchemas.ingestion.validate({ entries: [invalidUUID] });
      expect(error).toBeDefined();
    });
  });

  describe('logExceptionSchema', () => {
    it('should validate complete exception details', () => {
      const validException = {
        type: 'ApplicationError',
        message: 'Database connection failed',
        stackTrace: 'ApplicationError: Database connection failed\n    at Database.connect (db.js:45:10)',
        source: 'DatabaseService',
        innerException: {
          type: 'NetworkError',
          message: 'Connection timeout',
        },
      };

      const entry = {
        timestamp: '2023-12-01T10:00:00.000Z',
        level: 'Error',
        message: 'Application error',
        properties: {},
        exception: validException,
      };

      const { error } = logSchemas.ingestion.validate({ entries: [entry] });
      expect(error).toBeUndefined();
    });

    it('should require exception type and message', () => {
      const incompleteException = {
        type: 'ApplicationError',
        // Missing required message field
        stackTrace: 'Stack trace here...',
      };

      const entry = {
        timestamp: '2023-12-01T10:00:00.000Z',
        level: 'Error',
        message: 'Application error',
        properties: {},
        exception: incompleteException,
      };

      const { error } = logSchemas.ingestion.validate({ entries: [entry] });
      expect(error).toBeDefined();
    });

    it('should enforce exception field length limits', () => {
      const longException = {
        type: 'A'.repeat(201), // Over 200 char limit
        message: 'B'.repeat(2001), // Over 2000 char limit
      };

      const entry = {
        timestamp: '2023-12-01T10:00:00.000Z',
        level: 'Error',
        message: 'Application error',
        properties: {},
        exception: longException,
      };

      const { error } = logSchemas.ingestion.validate({ entries: [entry] });
      expect(error).toBeDefined();
    });
  });
});

describe('validateLogEntry helper', () => {
  it('should validate correct log entry', () => {
    const validEntry: LogEntry = {
      timestamp: '2023-12-01T10:00:00.000Z',
      level: 'Information',
      message: 'Test message',
      properties: {},
    };

    const result = validateLogEntry(validEntry);

    expect(result.error).toBeUndefined();
    expect(result.value).toEqual(validEntry);
  });

  it('should return error for invalid log entry', () => {
    const invalidEntry = {
      timestamp: 'invalid-date',
      level: 'InvalidLevel',
      // Missing required message field
      properties: {},
    };

    const result = validateLogEntry(invalidEntry);

    expect(result.error).toBeDefined();
    expect(result.value).toBeUndefined();
    expect(result.error).toContain('timestamp');
  });

  it('should handle non-object input', () => {
    const result = validateLogEntry('not an object');

    expect(result.error).toBeDefined();
    expect(result.value).toBeUndefined();
  });
});

describe('sanitizeLogProperties', () => {
  it('should sanitize valid properties', () => {
    const properties = {
      userId: 'user-123',
      component: 'TestComponent',
      responseTime: 150,
      isActive: true,
      timestamp: new Date('2023-12-01'),
      tags: ['tag1', 'tag2'],
    };

    const sanitized = sanitizeLogProperties(properties);

    expect(sanitized).toEqual({
      userId: 'user-123',
      component: 'TestComponent',
      responseTime: 150,
      isActive: true,
      timestamp: expect.any(Date),
      tags: ['tag1', 'tag2'],
    });
  });

  it('should sanitize harmful characters from strings', () => {
    const properties = {
      userInput: '<script>alert("xss")</script>',
      message: 'Data with "quotes" and <tags>',
      dangerous: '"><script>evil()</script>',
    };

    const sanitized = sanitizeLogProperties(properties);

    expect(sanitized.userInput).not.toContain('<script>');
    expect(sanitized.userInput).not.toContain('</script>');
    expect(sanitized.message).not.toContain('"');
    expect(sanitized.message).not.toContain('<');
    expect(sanitized.message).not.toContain('>');
  });

  it('should enforce string length limits', () => {
    const properties = {
      longString: 'A'.repeat(2000), // Over 1000 char limit
      normalString: 'Normal length string',
    };

    const sanitized = sanitizeLogProperties(properties);

    expect(sanitized.longString).toHaveLength(1000);
    expect(sanitized.normalString).toBe('Normal length string');
  });

  it('should limit property count', () => {
    const properties: Record<string, any> = {};
    
    // Add more than maximum allowed properties (60 > 50)
    for (let i = 0; i < 60; i++) {
      properties[`prop${i}`] = `value${i}`;
    }

    const sanitized = sanitizeLogProperties(properties);

    expect(Object.keys(sanitized)).toHaveLength(50);
  });

  it('should limit array lengths', () => {
    const properties = {
      longArray: Array.from({ length: 20 }, (_, i) => `item${i}`),
      normalArray: ['item1', 'item2'],
    };

    const sanitized = sanitizeLogProperties(properties);

    expect(sanitized.longArray).toHaveLength(10); // Limited to 10 items
    expect(sanitized.normalArray).toEqual(['item1', 'item2']);
  });

  it('should filter out invalid property names', () => {
    const properties = {
      '': 'empty key should be filtered',
      '<script>': 'dangerous key',
      'validKey': 'valid value',
      [`${'A'.repeat(200)}`]: 'key too long', // Over 100 char limit
    };

    const sanitized = sanitizeLogProperties(properties);

    expect(sanitized).toHaveProperty('validKey');
    expect(sanitized).not.toHaveProperty('');
    expect(sanitized).not.toHaveProperty('<script>');
    expect(Object.keys(sanitized).some(key => key.length > 100)).toBe(false);
  });

  it('should filter out invalid value types', () => {
    const properties = {
      validString: 'string value',
      validNumber: 42,
      validBoolean: true,
      validDate: new Date(),
      invalidFunction: () => 'function',
      invalidObject: { nested: 'object' },
      invalidUndefined: undefined,
      invalidNull: null,
      infinityNumber: Infinity,
      nanNumber: NaN,
    };

    const sanitized = sanitizeLogProperties(properties);

    expect(sanitized).toHaveProperty('validString');
    expect(sanitized).toHaveProperty('validNumber');
    expect(sanitized).toHaveProperty('validBoolean');
    expect(sanitized).toHaveProperty('validDate');
    expect(sanitized).not.toHaveProperty('invalidFunction');
    expect(sanitized).not.toHaveProperty('invalidObject');
    expect(sanitized).not.toHaveProperty('invalidUndefined');
    expect(sanitized).not.toHaveProperty('invalidNull');
    expect(sanitized).not.toHaveProperty('infinityNumber');
    expect(sanitized).not.toHaveProperty('nanNumber');
  });

  it('should handle null or undefined input', () => {
    expect(sanitizeLogProperties(null)).toEqual({});
    expect(sanitizeLogProperties(undefined)).toEqual({});
    expect(sanitizeLogProperties('not an object' as any)).toEqual({});
  });
});

describe('LOG_LIMITS constants', () => {
  it('should define reasonable limits', () => {
    expect(LOG_LIMITS.MAX_ENTRIES_PER_BATCH).toBe(100);
    expect(LOG_LIMITS.MAX_ENTRY_SIZE_KB).toBe(64);
    expect(LOG_LIMITS.MAX_BATCH_SIZE_MB).toBe(5);
    expect(LOG_LIMITS.MAX_MESSAGE_LENGTH).toBe(2000);
    expect(LOG_LIMITS.MAX_PROPERTIES_COUNT).toBe(50);
    expect(LOG_LIMITS.MAX_PROPERTY_NAME_LENGTH).toBe(100);
    expect(LOG_LIMITS.MAX_PROPERTY_VALUE_LENGTH).toBe(1000);
  });

  it('should have consistent limit values', () => {
    expect(LOG_LIMITS.MAX_BATCH_SIZE_MB * 1024).toBeGreaterThan(
      LOG_LIMITS.MAX_ENTRIES_PER_BATCH * LOG_LIMITS.MAX_ENTRY_SIZE_KB
    );
    
    expect(LOG_LIMITS.MAX_PROPERTY_VALUE_LENGTH).toBeLessThan(
      LOG_LIMITS.MAX_MESSAGE_LENGTH
    );
  });
});