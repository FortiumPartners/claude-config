/**
 * Database Connection Unit Tests
 * Sprint 9.1: Comprehensive Test Suite Development
 * Coverage Target: >95% for database operations
 */

import { DatabaseConnection } from '../../../database/connection';
import { DatabaseConfig } from '../../../database/types';
import { TEST_CONSTANTS } from '../../setup';
import { Pool, Client } from 'pg';

// Mock pg
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    query: jest.fn(),
    end: jest.fn(),
    on: jest.fn(),
    removeAllListeners: jest.fn(),
    totalCount: 0,
    idleCount: 0,
    waitingCount: 0
  })),
  Client: jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    query: jest.fn(),
    end: jest.fn(),
    on: jest.fn()
  }))
}));

const MockedPool = Pool as jest.MockedClass<typeof Pool>;
const MockedClient = Client as jest.MockedClass<typeof Client>;

describe('DatabaseConnection', () => {
  let dbConnection: DatabaseConnection;
  let mockPool: jest.Mocked<Pool>;
  let mockClient: jest.Mocked<Client>;
  
  const testConfig: DatabaseConfig = {
    host: 'localhost',
    port: 5432,
    database: 'test_db',
    username: 'test_user',
    password: 'test_password',
    ssl: false,
    maxConnections: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000
  };

  beforeEach(() => {
    // Create mock instances
    mockPool = {
      connect: jest.fn(),
      query: jest.fn(),
      end: jest.fn(),
      on: jest.fn(),
      removeAllListeners: jest.fn(),
      totalCount: 0,
      idleCount: 0,
      waitingCount: 0
    } as any;

    mockClient = {
      connect: jest.fn(),
      query: jest.fn(),
      end: jest.fn(),
      on: jest.fn()
    } as any;

    MockedPool.mockImplementation(() => mockPool);
    MockedClient.mockImplementation(() => mockClient);

    dbConnection = new DatabaseConnection(testConfig);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with valid configuration', () => {
      expect(dbConnection).toBeDefined();
      expect(MockedPool).toHaveBeenCalledWith({
        host: testConfig.host,
        port: testConfig.port,
        database: testConfig.database,
        user: testConfig.username,
        password: testConfig.password,
        ssl: testConfig.ssl,
        max: testConfig.maxConnections,
        idleTimeoutMillis: testConfig.idleTimeoutMillis,
        connectionTimeoutMillis: testConfig.connectionTimeoutMillis
      });
    });

    it('should use default values for optional config', () => {
      const minimalConfig: DatabaseConfig = {
        host: 'localhost',
        port: 5432,
        database: 'test_db',
        username: 'test_user',
        password: 'test_password'
      };

      const dbWithDefaults = new DatabaseConnection(minimalConfig);
      expect(dbWithDefaults).toBeDefined();
    });

    it('should throw error for invalid configuration', () => {
      const invalidConfigs = [
        { ...testConfig, host: '' },
        { ...testConfig, port: -1 },
        { ...testConfig, database: '' },
        { ...testConfig, username: '' },
        { ...testConfig, password: '' }
      ];

      invalidConfigs.forEach(config => {
        expect(() => new DatabaseConnection(config as DatabaseConfig))
          .toThrow('Invalid database configuration');
      });
    });

    it('should setup pool event handlers', () => {
      expect(mockPool.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockPool.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockPool.on).toHaveBeenCalledWith('remove', expect.any(Function));
    });
  });

  describe('connect', () => {
    it('should establish connection successfully', async () => {
      const mockPoolClient = { release: jest.fn() };
      mockPool.connect.mockResolvedValue(mockPoolClient as any);

      await dbConnection.connect();

      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockPoolClient.release).toHaveBeenCalled();
    });

    it('should handle connection errors', async () => {
      const connectionError = new Error('Connection failed');
      mockPool.connect.mockRejectedValue(connectionError);

      await expect(dbConnection.connect()).rejects.toThrow('Database connection failed');
    });

    it('should not connect if already connected', async () => {
      const mockPoolClient = { release: jest.fn() };
      mockPool.connect.mockResolvedValue(mockPoolClient as any);

      // Connect first time
      await dbConnection.connect();
      mockPool.connect.mockClear();

      // Try to connect again
      await dbConnection.connect();

      expect(mockPool.connect).not.toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    it('should disconnect successfully', async () => {
      mockPool.end.mockResolvedValue();

      await dbConnection.disconnect();

      expect(mockPool.end).toHaveBeenCalled();
      expect(mockPool.removeAllListeners).toHaveBeenCalled();
    });

    it('should handle disconnect errors', async () => {
      const disconnectError = new Error('Disconnect failed');
      mockPool.end.mockRejectedValue(disconnectError);

      await expect(dbConnection.disconnect()).rejects.toThrow('Database disconnect failed');
    });

    it('should not disconnect if not connected', async () => {
      // Already in initial state (not connected)
      await dbConnection.disconnect();

      expect(mockPool.end).not.toHaveBeenCalled();
    });
  });

  describe('query', () => {
    const testQuery = 'SELECT * FROM users WHERE id = $1';
    const testParams = [TEST_CONSTANTS.TEST_USER_ID];
    const mockResult = {
      rows: [{ id: TEST_CONSTANTS.TEST_USER_ID, email: TEST_CONSTANTS.VALID_EMAIL }],
      rowCount: 1
    };

    beforeEach(async () => {
      // Ensure connection is established
      const mockPoolClient = { release: jest.fn() };
      mockPool.connect.mockResolvedValue(mockPoolClient as any);
      await dbConnection.connect();
    });

    it('should execute query successfully', async () => {
      mockPool.query.mockResolvedValue(mockResult);

      const result = await dbConnection.query(testQuery, testParams);

      expect(result).toEqual(mockResult);
      expect(mockPool.query).toHaveBeenCalledWith(testQuery, testParams);
    });

    it('should execute query without parameters', async () => {
      const simpleQuery = 'SELECT NOW()';
      mockPool.query.mockResolvedValue(mockResult);

      const result = await dbConnection.query(simpleQuery);

      expect(result).toEqual(mockResult);
      expect(mockPool.query).toHaveBeenCalledWith(simpleQuery, undefined);
    });

    it('should handle query errors', async () => {
      const queryError = new Error('Query failed');
      mockPool.query.mockRejectedValue(queryError);

      await expect(dbConnection.query(testQuery, testParams))
        .rejects.toThrow('Database query failed');
    });

    it('should throw error if not connected', async () => {
      // Create new instance without connecting
      const unconnectedDb = new DatabaseConnection(testConfig);

      await expect(unconnectedDb.query(testQuery, testParams))
        .rejects.toThrow('Database not connected');
    });

    it('should handle SQL injection attempts', async () => {
      const maliciousQuery = "SELECT * FROM users; DROP TABLE users; --";
      
      await expect(dbConnection.query(maliciousQuery))
        .rejects.toThrow('Invalid query format');
    });
  });

  describe('transaction', () => {
    const mockTransactionCallback = jest.fn();
    let mockPoolClient: any;

    beforeEach(async () => {
      mockPoolClient = {
        query: jest.fn(),
        release: jest.fn()
      };
      mockPool.connect.mockResolvedValue(mockPoolClient);
      
      // Ensure connection is established
      const connectClient = { release: jest.fn() };
      mockPool.connect.mockResolvedValueOnce(connectClient);
      await dbConnection.connect();
    });

    it('should execute transaction successfully', async () => {
      mockTransactionCallback.mockResolvedValue('transaction result');
      mockPoolClient.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await dbConnection.transaction(mockTransactionCallback);

      expect(result).toBe('transaction result');
      expect(mockPoolClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockTransactionCallback).toHaveBeenCalledWith(mockPoolClient);
      expect(mockPoolClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockPoolClient.release).toHaveBeenCalled();
    });

    it('should rollback transaction on error', async () => {
      const transactionError = new Error('Transaction failed');
      mockTransactionCallback.mockRejectedValue(transactionError);
      mockPoolClient.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await expect(dbConnection.transaction(mockTransactionCallback))
        .rejects.toThrow('Transaction failed');

      expect(mockPoolClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockPoolClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockPoolClient.release).toHaveBeenCalled();
    });

    it('should handle BEGIN statement errors', async () => {
      const beginError = new Error('BEGIN failed');
      mockPoolClient.query.mockRejectedValueOnce(beginError);

      await expect(dbConnection.transaction(mockTransactionCallback))
        .rejects.toThrow('Transaction begin failed');

      expect(mockPoolClient.release).toHaveBeenCalled();
    });

    it('should handle COMMIT statement errors', async () => {
      mockTransactionCallback.mockResolvedValue('success');
      mockPoolClient.query
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // BEGIN
        .mockRejectedValueOnce(new Error('COMMIT failed')); // COMMIT

      await expect(dbConnection.transaction(mockTransactionCallback))
        .rejects.toThrow('Transaction commit failed');
    });
  });

  describe('getConnectionStats', () => {
    it('should return connection statistics', () => {
      mockPool.totalCount = 10;
      mockPool.idleCount = 5;
      mockPool.waitingCount = 2;

      const stats = dbConnection.getConnectionStats();

      expect(stats).toEqual({
        totalConnections: 10,
        idleConnections: 5,
        waitingConnections: 2,
        activeConnections: 5
      });
    });

    it('should calculate active connections correctly', () => {
      mockPool.totalCount = 15;
      mockPool.idleCount = 3;
      mockPool.waitingCount = 1;

      const stats = dbConnection.getConnectionStats();

      expect(stats.activeConnections).toBe(12); // 15 - 3 = 12
    });
  });

  describe('healthCheck', () => {
    beforeEach(async () => {
      const mockPoolClient = { release: jest.fn() };
      mockPool.connect.mockResolvedValue(mockPoolClient as any);
      await dbConnection.connect();
    });

    it('should pass health check when database is responsive', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ now: new Date() }], rowCount: 1 });

      const isHealthy = await dbConnection.healthCheck();

      expect(isHealthy).toBe(true);
      expect(mockPool.query).toHaveBeenCalledWith('SELECT NOW()');
    });

    it('should fail health check when database is unresponsive', async () => {
      const healthCheckError = new Error('Database unresponsive');
      mockPool.query.mockRejectedValue(healthCheckError);

      const isHealthy = await dbConnection.healthCheck();

      expect(isHealthy).toBe(false);
    });

    it('should fail health check when not connected', async () => {
      const unconnectedDb = new DatabaseConnection(testConfig);

      const isHealthy = await unconnectedDb.healthCheck();

      expect(isHealthy).toBe(false);
    });
  });

  describe('close', () => {
    it('should be alias for disconnect', async () => {
      mockPool.end.mockResolvedValue();

      await dbConnection.close();

      expect(mockPool.end).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle pool error events', () => {
      const errorHandler = mockPool.on.mock.calls.find(call => call[0] === 'error')[1];
      const poolError = new Error('Pool error');

      // Should not throw when error handler is called
      expect(() => errorHandler(poolError)).not.toThrow();
    });

    it('should handle pool connect events', () => {
      const connectHandler = mockPool.on.mock.calls.find(call => call[0] === 'connect')[1];
      
      // Should not throw when connect handler is called
      expect(() => connectHandler(mockClient)).not.toThrow();
    });

    it('should handle pool remove events', () => {
      const removeHandler = mockPool.on.mock.calls.find(call => call[0] === 'remove')[1];
      
      // Should not throw when remove handler is called
      expect(() => removeHandler(mockClient)).not.toThrow();
    });
  });
});