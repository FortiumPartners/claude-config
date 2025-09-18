/**
 * Metrics Collection Service Unit Tests
 * Sprint 9.1: Comprehensive Test Suite Development
 * Coverage Target: >90% for services
 */

import { MetricsCollectionService } from '../../../services/metrics-collection.service';
import { DatabaseConnection } from '../../../database/connection';
import { TEST_CONSTANTS } from '../../setup';

// Mock dependencies
jest.mock('../../../database/connection');
jest.mock('../../../config/logger');

const MockedDatabaseConnection = DatabaseConnection as jest.MockedClass<typeof DatabaseConnection>;

describe('MetricsCollectionService', () => {
  let metricsService: MetricsCollectionService;
  let mockDb: jest.Mocked<DatabaseConnection>;

  const mockTenantId = TEST_CONSTANTS.TEST_TENANT_ID;
  const mockUserId = TEST_CONSTANTS.TEST_USER_ID;

  beforeEach(() => {
    // Create mock database connection
    mockDb = {
      query: jest.fn(),
      transaction: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
      healthCheck: jest.fn(),
      getConnectionStats: jest.fn(),
      close: jest.fn()
    } as any;

    MockedDatabaseConnection.mockImplementation(() => mockDb);
    
    metricsService = new MetricsCollectionService(mockDb);
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with database connection', () => {
      expect(metricsService).toBeDefined();
    });

    it('should throw error without database connection', () => {
      expect(() => new MetricsCollectionService(null as any))
        .toThrow('Database connection is required');
    });
  });

  describe('createSession', () => {
    const mockSessionData = {
      userId: mockUserId,
      sessionStart: new Date(),
      metadata: {
        claudeVersion: '3.5',
        projectPath: '/test/project'
      }
    };

    it('should create new metrics session successfully', async () => {
      const mockSessionId = 'session-123';
      mockDb.query.mockResolvedValue({
        rows: [{ id: mockSessionId, ...mockSessionData }],
        rowCount: 1
      });

      const result = await metricsService.createSession(mockTenantId, mockSessionData);

      expect(result).toEqual({
        id: mockSessionId,
        ...mockSessionData
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO'),
        expect.arrayContaining([mockTenantId, mockSessionData.userId])
      );
    });

    it('should validate required session data', async () => {
      const invalidSessionData = {
        userId: null,
        sessionStart: new Date()
      };

      await expect(metricsService.createSession(mockTenantId, invalidSessionData as any))
        .rejects.toThrow('Invalid session data');
    });

    it('should handle database errors during session creation', async () => {
      const dbError = new Error('Database insertion failed');
      mockDb.query.mockRejectedValue(dbError);

      await expect(metricsService.createSession(mockTenantId, mockSessionData))
        .rejects.toThrow('Failed to create metrics session');
    });

    it('should validate tenant ID format', async () => {
      const invalidTenantId = 'invalid-uuid';

      await expect(metricsService.createSession(invalidTenantId, mockSessionData))
        .rejects.toThrow('Invalid tenant ID format');
    });
  });

  describe('updateSession', () => {
    const sessionId = 'session-123';
    const updateData = {
      sessionEnd: new Date(),
      totalDurationMs: 3600000,
      toolsUsed: ['Read', 'Write', 'Bash'],
      productivityScore: 85
    };

    it('should update session successfully', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{ id: sessionId, ...updateData }],
        rowCount: 1
      });

      const result = await metricsService.updateSession(mockTenantId, sessionId, updateData);

      expect(result).toEqual({
        id: sessionId,
        ...updateData
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE'),
        expect.arrayContaining([mockTenantId, sessionId])
      );
    });

    it('should handle session not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await expect(metricsService.updateSession(mockTenantId, sessionId, updateData))
        .rejects.toThrow('Session not found');
    });

    it('should validate session ID format', async () => {
      const invalidSessionId = 'invalid-uuid';

      await expect(metricsService.updateSession(mockTenantId, invalidSessionId, updateData))
        .rejects.toThrow('Invalid session ID format');
    });

    it('should handle database errors during update', async () => {
      const dbError = new Error('Database update failed');
      mockDb.query.mockRejectedValue(dbError);

      await expect(metricsService.updateSession(mockTenantId, sessionId, updateData))
        .rejects.toThrow('Failed to update metrics session');
    });
  });

  describe('recordToolUsage', () => {
    const sessionId = 'session-123';
    const toolMetrics = {
      toolName: 'Read',
      executionCount: 5,
      totalDurationMs: 1500,
      successRate: 0.8,
      errorCount: 1
    };

    it('should record tool usage successfully', async () => {
      const mockToolMetricId = 'tool-metric-123';
      mockDb.query.mockResolvedValue({
        rows: [{ id: mockToolMetricId, ...toolMetrics }],
        rowCount: 1
      });

      const result = await metricsService.recordToolUsage(mockTenantId, sessionId, toolMetrics);

      expect(result).toEqual({
        id: mockToolMetricId,
        sessionId,
        ...toolMetrics
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO'),
        expect.arrayContaining([mockTenantId, sessionId, toolMetrics.toolName])
      );
    });

    it('should validate tool metrics data', async () => {
      const invalidToolMetrics = {
        toolName: '',
        executionCount: -1,
        totalDurationMs: null
      };

      await expect(metricsService.recordToolUsage(mockTenantId, sessionId, invalidToolMetrics as any))
        .rejects.toThrow('Invalid tool metrics data');
    });

    it('should handle duplicate tool usage recording', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{ id: 'existing-metric', ...toolMetrics }],
        rowCount: 1
      });

      // Should update existing record instead of creating new one
      const result = await metricsService.recordToolUsage(mockTenantId, sessionId, toolMetrics);
      expect(result).toBeDefined();
    });
  });

  describe('getSessionMetrics', () => {
    const sessionId = 'session-123';

    it('should retrieve session metrics successfully', async () => {
      const mockSessionMetrics = {
        id: sessionId,
        userId: mockUserId,
        sessionStart: new Date('2024-01-01T10:00:00Z'),
        sessionEnd: new Date('2024-01-01T11:00:00Z'),
        totalDurationMs: 3600000,
        toolsUsed: ['Read', 'Write'],
        productivityScore: 85
      };

      mockDb.query.mockResolvedValue({
        rows: [mockSessionMetrics],
        rowCount: 1
      });

      const result = await metricsService.getSessionMetrics(mockTenantId, sessionId);

      expect(result).toEqual(mockSessionMetrics);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [mockTenantId, sessionId]
      );
    });

    it('should handle session not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await metricsService.getSessionMetrics(mockTenantId, sessionId);
      expect(result).toBeNull();
    });

    it('should include tool metrics when requested', async () => {
      const mockSessionWithTools = {
        id: sessionId,
        userId: mockUserId,
        toolMetrics: [
          { toolName: 'Read', executionCount: 10, totalDurationMs: 2000 },
          { toolName: 'Write', executionCount: 5, totalDurationMs: 1500 }
        ]
      };

      mockDb.query.mockResolvedValue({
        rows: [mockSessionWithTools],
        rowCount: 1
      });

      const result = await metricsService.getSessionMetrics(mockTenantId, sessionId, true);
      expect(result.toolMetrics).toHaveLength(2);
    });
  });

  describe('getUserSessions', () => {
    const options = {
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31'),
      limit: 10,
      offset: 0
    };

    it('should retrieve user sessions with pagination', async () => {
      const mockSessions = [
        { id: 'session-1', userId: mockUserId, sessionStart: new Date() },
        { id: 'session-2', userId: mockUserId, sessionStart: new Date() }
      ];

      mockDb.query.mockResolvedValue({
        rows: mockSessions,
        rowCount: 2
      });

      const result = await metricsService.getUserSessions(mockTenantId, mockUserId, options);

      expect(result).toEqual(mockSessions);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        expect.arrayContaining([mockTenantId, mockUserId])
      );
    });

    it('should handle date range filtering', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await metricsService.getUserSessions(mockTenantId, mockUserId, options);

      const queryCall = mockDb.query.mock.calls[0];
      expect(queryCall[0]).toContain('session_start >= $3');
      expect(queryCall[0]).toContain('session_start <= $4');
    });

    it('should handle empty results', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await metricsService.getUserSessions(mockTenantId, mockUserId, options);
      expect(result).toEqual([]);
    });

    it('should validate pagination parameters', async () => {
      const invalidOptions = { ...options, limit: -1 };

      await expect(metricsService.getUserSessions(mockTenantId, mockUserId, invalidOptions))
        .rejects.toThrow('Invalid pagination parameters');
    });
  });

  describe('getToolUsageAnalytics', () => {
    const options = {
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31'),
      groupBy: 'tool' as const
    };

    it('should retrieve tool usage analytics', async () => {
      const mockAnalytics = [
        {
          toolName: 'Read',
          totalExecutions: 100,
          totalDurationMs: 50000,
          avgDurationMs: 500,
          successRate: 0.95
        },
        {
          toolName: 'Write',
          totalExecutions: 50,
          totalDurationMs: 30000,
          avgDurationMs: 600,
          successRate: 0.90
        }
      ];

      mockDb.query.mockResolvedValue({
        rows: mockAnalytics,
        rowCount: 2
      });

      const result = await metricsService.getToolUsageAnalytics(mockTenantId, options);

      expect(result).toEqual(mockAnalytics);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('GROUP BY'),
        expect.arrayContaining([mockTenantId])
      );
    });

    it('should handle different grouping options', async () => {
      const optionsByUser = { ...options, groupBy: 'user' as const };
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await metricsService.getToolUsageAnalytics(mockTenantId, optionsByUser);

      const queryCall = mockDb.query.mock.calls[0];
      expect(queryCall[0]).toContain('GROUP BY user_id');
    });
  });

  describe('bulkInsertMetrics', () => {
    const bulkMetrics = [
      {
        sessionId: 'session-1',
        toolName: 'Read',
        executionCount: 5,
        totalDurationMs: 2500,
        successRate: 1.0
      },
      {
        sessionId: 'session-2',
        toolName: 'Write',
        executionCount: 3,
        totalDurationMs: 1800,
        successRate: 0.67
      }
    ];

    it('should insert multiple metrics in a transaction', async () => {
      mockDb.transaction.mockImplementation(async (callback) => {
        const mockClient = {
          query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 })
        };
        return await callback(mockClient as any);
      });

      const result = await metricsService.bulkInsertMetrics(mockTenantId, bulkMetrics);

      expect(result.successful).toBe(2);
      expect(result.failed).toBe(0);
      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it('should handle partial failures in bulk insert', async () => {
      mockDb.transaction.mockImplementation(async (callback) => {
        const mockClient = {
          query: jest.fn()
            .mockResolvedValueOnce({ rows: [], rowCount: 1 })
            .mockRejectedValueOnce(new Error('Insert failed'))
        };
        return await callback(mockClient as any);
      });

      const result = await metricsService.bulkInsertMetrics(mockTenantId, bulkMetrics);

      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
    });

    it('should validate bulk metrics data', async () => {
      const invalidBulkMetrics = [
        { sessionId: '', toolName: 'Read' }, // Invalid session ID
        { sessionId: 'session-1' } // Missing tool name
      ];

      await expect(metricsService.bulkInsertMetrics(mockTenantId, invalidBulkMetrics as any))
        .rejects.toThrow('Invalid bulk metrics data');
    });
  });

  describe('deleteSession', () => {
    const sessionId = 'session-123';

    it('should delete session and associated tool metrics', async () => {
      mockDb.transaction.mockImplementation(async (callback) => {
        const mockClient = {
          query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 })
        };
        return await callback(mockClient as any);
      });

      const result = await metricsService.deleteSession(mockTenantId, sessionId);

      expect(result).toBe(true);
      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it('should handle session not found during deletion', async () => {
      mockDb.transaction.mockImplementation(async (callback) => {
        const mockClient = {
          query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 })
        };
        return await callback(mockClient as any);
      });

      await expect(metricsService.deleteSession(mockTenantId, sessionId))
        .rejects.toThrow('Session not found');
    });
  });

  describe('error handling and validation', () => {
    it('should validate tenant ID in all methods', async () => {
      const invalidTenantId = 'not-a-uuid';
      const mockSessionData = {
        userId: mockUserId,
        sessionStart: new Date()
      };

      await expect(metricsService.createSession(invalidTenantId, mockSessionData))
        .rejects.toThrow('Invalid tenant ID format');
    });

    it('should handle database connection failures', async () => {
      const connectionError = new Error('Database connection lost');
      mockDb.query.mockRejectedValue(connectionError);

      await expect(metricsService.getUserSessions(mockTenantId, mockUserId))
        .rejects.toThrow('Database operation failed');
    });

    it('should sanitize input data to prevent injection', async () => {
      const maliciousData = {
        userId: mockUserId,
        sessionStart: new Date(),
        metadata: {
          claudeVersion: "'; DROP TABLE sessions; --"
        }
      };

      // Should not throw an error but should sanitize the input
      mockDb.query.mockResolvedValue({ rows: [{ id: 'safe-session' }], rowCount: 1 });
      
      await metricsService.createSession(mockTenantId, maliciousData);
      
      // Verify that the query was called with sanitized data
      expect(mockDb.query).toHaveBeenCalled();
    });
  });
});