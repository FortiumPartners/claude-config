import { PartitionManager, PartitionStats } from '../../database/partitions';
import { DatabaseConnection } from '../../database/connection';

describe('PartitionManager Unit Tests', () => {
  let partitionManager: PartitionManager;
  let mockDb: jest.Mocked<DatabaseConnection>;

  beforeEach(() => {
    mockDb = {
      query: jest.fn(),
      queryWithRetry: jest.fn(),
      withTransaction: jest.fn(),
      setOrganizationContext: jest.fn(),
      clearContext: jest.fn(),
      getPoolStats: jest.fn(),
      healthCheck: jest.fn(),
      close: jest.fn(),
    } as any;

    partitionManager = new PartitionManager(mockDb);
  });

  describe('getPartitionInfo', () => {
    test('should format partition information correctly', async () => {
      const mockRows = [
        {
          hypertable_name: 'command_executions',
          chunk_name: '_hyper_1_1_chunk',
          range_start: '2023-01-01T00:00:00.000Z',
          range_end: '2023-01-02T00:00:00.000Z',
          chunk_size: '128 kB',
          compressed: false,
        },
      ];

      mockDb.query.mockResolvedValueOnce({ rows: mockRows } as any);

      const result = await partitionManager.getPartitionInfo('command_executions');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        tableName: 'command_executions',
        chunkName: '_hyper_1_1_chunk',
        rangeStart: new Date('2023-01-01T00:00:00.000Z'),
        rangeEnd: new Date('2023-01-02T00:00:00.000Z'),
        size: '128 kB',
        isCompressed: false,
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM timescaledb_information.chunks'),
        ['command_executions'],
      );
    });

    test('should handle no table name (all tables)', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);

      await partitionManager.getPartitionInfo();

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE c.hypertable_schema = \'public\''),
        [],
      );
    });
  });

  describe('getPartitionStats', () => {
    test('should format partition statistics correctly', async () => {
      const mockRows = [
        {
          hypertable_name: 'command_executions',
          total_chunks: '5',
          compressed_chunks: '3',
          uncompressed_chunks: '2',
          total_size: '1024 kB',
          oldest_chunk: '2023-01-01T00:00:00.000Z',
          newest_chunk: '2023-01-05T00:00:00.000Z',
        },
      ];

      mockDb.query.mockResolvedValueOnce({ rows: mockRows } as any);

      const result = await partitionManager.getPartitionStats('command_executions');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        tableName: 'command_executions',
        totalChunks: 5,
        compressedChunks: 3,
        uncompressedChunks: 2,
        totalSize: '1024 kB',
        oldestChunk: new Date('2023-01-01T00:00:00.000Z'),
        newestChunk: new Date('2023-01-05T00:00:00.000Z'),
      });
    });
  });

  describe('compressOldPartitions', () => {
    test('should compress chunks and return count', async () => {
      const mockChunks = [
        {
          hypertable_name: 'command_executions',
          chunk_name: '_hyper_1_1_chunk',
          chunk_schema: '_timescaledb_internal',
        },
        {
          hypertable_name: 'command_executions',
          chunk_name: '_hyper_1_2_chunk',
          chunk_schema: '_timescaledb_internal',
        },
      ];

      mockDb.query.mockResolvedValueOnce({ rows: mockChunks } as any);
      mockDb.query.mockResolvedValue({ rows: [] } as any); // For compression queries

      const result = await partitionManager.compressOldPartitions('command_executions', 7);

      expect(result).toBe(2);
      expect(mockDb.query).toHaveBeenCalledTimes(3); // 1 select + 2 compress
    });

    test('should handle compression errors gracefully', async () => {
      const mockChunks = [
        {
          hypertable_name: 'command_executions',
          chunk_name: '_hyper_1_1_chunk',
          chunk_schema: '_timescaledb_internal',
        },
      ];

      mockDb.query.mockResolvedValueOnce({ rows: mockChunks } as any);
      mockDb.query.mockRejectedValueOnce(new Error('Compression failed'));

      const result = await partitionManager.compressOldPartitions('command_executions', 7);

      expect(result).toBe(0); // Should return 0 due to error
    });
  });

  describe('dropOldPartitions', () => {
    test('should drop old chunks and return count', async () => {
      const mockChunks = [
        {
          hypertable_name: 'command_executions',
          chunk_name: '_hyper_1_1_chunk',
          chunk_schema: '_timescaledb_internal',
        },
      ];

      mockDb.query.mockResolvedValueOnce({ rows: mockChunks } as any);
      mockDb.query.mockResolvedValue({ rows: [] } as any); // For drop queries

      const result = await partitionManager.dropOldPartitions('command_executions', 365);

      expect(result).toBe(1);
      expect(mockDb.query).toHaveBeenCalledTimes(2); // 1 select + 1 drop
    });
  });

  describe('validatePartitionHealth', () => {
    test('should identify healthy partitions', async () => {
      const mockStats: PartitionStats[] = [
        {
          tableName: 'command_executions',
          totalChunks: 10,
          compressedChunks: 8,
          uncompressedChunks: 2,
          totalSize: '2048 kB',
          oldestChunk: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
          newestChunk: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
        },
      ];

      jest.spyOn(partitionManager, 'getPartitionStats').mockResolvedValueOnce(mockStats);

      const result = await partitionManager.validatePartitionHealth();

      expect(result.isHealthy).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.stats).toEqual(mockStats);
    });

    test('should identify issues with old partitions', async () => {
      const mockStats: PartitionStats[] = [
        {
          tableName: 'command_executions',
          totalChunks: 10,
          compressedChunks: 2,
          uncompressedChunks: 8, // Too many uncompressed
          totalSize: '2048 kB',
          oldestChunk: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
          newestChunk: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago (too old)
        },
      ];

      jest.spyOn(partitionManager, 'getPartitionStats').mockResolvedValueOnce(mockStats);

      const result = await partitionManager.validatePartitionHealth();

      expect(result.isHealthy).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues.some(issue => issue.includes('no recent partitions'))).toBe(true);
      expect(result.issues.some(issue => issue.includes('uncompressed chunks'))).toBe(true);
    });
  });

  describe('runMaintenanceJob', () => {
    test('should run all maintenance tasks', async () => {
      const compressSpy = jest.spyOn(partitionManager, 'compressOldPartitions').mockResolvedValueOnce(5);
      const dropSpy = jest.spyOn(partitionManager, 'dropOldPartitions').mockResolvedValueOnce(2);
      const preCreateSpy = jest.spyOn(partitionManager, 'preCreatePartitions').mockResolvedValueOnce();

      const result = await partitionManager.runMaintenanceJob();

      expect(result).toEqual({
        compressedChunks: 5,
        droppedChunks: 2,
        preCreatedDays: 7,
      });

      expect(compressSpy).toHaveBeenCalledWith();
      expect(dropSpy).toHaveBeenCalledWith();
      expect(preCreateSpy).toHaveBeenCalledWith(7);
    });

    test('should handle maintenance errors', async () => {
      jest.spyOn(partitionManager, 'compressOldPartitions').mockRejectedValueOnce(new Error('Compression failed'));

      await expect(partitionManager.runMaintenanceJob()).rejects.toThrow('Compression failed');
    });
  });
});