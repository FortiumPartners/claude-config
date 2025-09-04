import { DatabaseConnection } from './connection';
import { timescaleConfig } from './config';
import winston from 'winston';

export interface PartitionInfo {
  tableName: string;
  chunkName: string;
  rangeStart: Date;
  rangeEnd: Date;
  size: string;
  isCompressed: boolean;
}

export interface PartitionStats {
  tableName: string;
  totalChunks: number;
  compressedChunks: number;
  uncompressedChunks: number;
  totalSize: string;
  oldestChunk: Date;
  newestChunk: Date;
}

export class PartitionManager {
  private logger: winston.Logger;

  constructor(private db: DatabaseConnection) {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
      transports: [
        new winston.transports.Console(),
      ],
    });
  }

  async getPartitionInfo(tableName?: string): Promise<PartitionInfo[]> {
    const whereClause = tableName 
      ? 'WHERE c.hypertable_name = $1'
      : 'WHERE c.hypertable_schema = \'public\'';
    
    const params = tableName ? [tableName] : [];

    const result = await this.db.query<{
      hypertable_name: string;
      chunk_name: string;
      range_start: string;
      range_end: string;
      chunk_size: string;
      compressed: boolean;
    }>(`
      SELECT 
        c.hypertable_name,
        c.chunk_name,
        c.range_start,
        c.range_end,
        pg_size_pretty(pg_total_relation_size(format('%I.%I', c.chunk_schema, c.chunk_name))) as chunk_size,
        COALESCE(comp.compressed, false) as compressed
      FROM timescaledb_information.chunks c
      LEFT JOIN timescaledb_information.compressed_chunk_stats comp 
        ON comp.chunk_name = c.chunk_name
      ${whereClause}
      ORDER BY c.hypertable_name, c.range_start DESC;
    `, params);

    return result.rows.map(row => ({
      tableName: row.hypertable_name,
      chunkName: row.chunk_name,
      rangeStart: new Date(row.range_start),
      rangeEnd: new Date(row.range_end),
      size: row.chunk_size,
      isCompressed: row.compressed,
    }));
  }

  async getPartitionStats(tableName?: string): Promise<PartitionStats[]> {
    const whereClause = tableName 
      ? 'WHERE c.hypertable_name = $1'
      : 'WHERE c.hypertable_schema = \'public\'';
    
    const params = tableName ? [tableName] : [];

    const result = await this.db.query<{
      hypertable_name: string;
      total_chunks: string;
      compressed_chunks: string;
      uncompressed_chunks: string;
      total_size: string;
      oldest_chunk: string;
      newest_chunk: string;
    }>(`
      SELECT 
        c.hypertable_name,
        COUNT(*) as total_chunks,
        COUNT(*) FILTER (WHERE comp.compressed = true) as compressed_chunks,
        COUNT(*) FILTER (WHERE comp.compressed = false OR comp.compressed IS NULL) as uncompressed_chunks,
        pg_size_pretty(SUM(pg_total_relation_size(format('%I.%I', c.chunk_schema, c.chunk_name)))) as total_size,
        MIN(c.range_start) as oldest_chunk,
        MAX(c.range_start) as newest_chunk
      FROM timescaledb_information.chunks c
      LEFT JOIN timescaledb_information.compressed_chunk_stats comp 
        ON comp.chunk_name = c.chunk_name
      ${whereClause}
      GROUP BY c.hypertable_name
      ORDER BY c.hypertable_name;
    `, params);

    return result.rows.map(row => ({
      tableName: row.hypertable_name,
      totalChunks: parseInt(row.total_chunks, 10),
      compressedChunks: parseInt(row.compressed_chunks, 10),
      uncompressedChunks: parseInt(row.uncompressed_chunks, 10),
      totalSize: row.total_size,
      oldestChunk: new Date(row.oldest_chunk),
      newestChunk: new Date(row.newest_chunk),
    }));
  }

  async createPartitionsForTable(
    tableName: string, 
    startDate: Date, 
    endDate: Date,
    intervalHours = 24,
  ): Promise<void> {
    const interval = `${intervalHours} hours`;
    
    this.logger.info('Creating partitions for table', {
      tableName,
      startDate,
      endDate,
      interval,
    });

    await this.db.query(`
      SELECT add_dimension(
        '$1',
        'time',
        time_partitioning_func => $2,
        if_not_exists => true
      );
    `, [tableName, `time_bucket_gapfill(INTERVAL '${interval}', time)`]);

    let currentDate = new Date(startDate);
    while (currentDate < endDate) {
      const nextDate = new Date(currentDate.getTime() + (intervalHours * 60 * 60 * 1000));
      
      try {
        await this.db.query(`
          SELECT create_chunk($1, $2, $3, if_not_exists => true);
        `, [tableName, currentDate.toISOString(), nextDate.toISOString()]);
        
        this.logger.debug('Created chunk', {
          tableName,
          chunkStart: currentDate.toISOString(),
          chunkEnd: nextDate.toISOString(),
        });
      } catch (error) {
        this.logger.warn('Failed to create chunk (may already exist)', {
          tableName,
          chunkStart: currentDate.toISOString(),
          error: error instanceof Error ? error.message : String(error),
        });
      }
      
      currentDate = nextDate;
    }
    
    this.logger.info('Completed partition creation for table', { tableName });
  }

  async compressOldPartitions(tableName?: string, olderThanDays?: number): Promise<number> {
    const compressionAge = olderThanDays ?? timescaleConfig.compressionAfterDays;
    const cutoffDate = new Date(Date.now() - (compressionAge * 24 * 60 * 60 * 1000));
    
    const whereClause = tableName 
      ? 'AND c.hypertable_name = $2'
      : '';
    
    const params = [cutoffDate.toISOString()];
    if (tableName) {
      params.push(tableName);
    }

    const result = await this.db.query<{
      hypertable_name: string;
      chunk_name: string;
      chunk_schema: string;
    }>(`
      SELECT 
        c.hypertable_name,
        c.chunk_name,
        c.chunk_schema
      FROM timescaledb_information.chunks c
      LEFT JOIN timescaledb_information.compressed_chunk_stats comp 
        ON comp.chunk_name = c.chunk_name
      WHERE c.range_end < $1
        AND c.hypertable_schema = 'public'
        AND (comp.compressed IS NULL OR comp.compressed = false)
        ${whereClause}
      ORDER BY c.hypertable_name, c.range_start;
    `, params);

    let compressedCount = 0;

    for (const chunk of result.rows) {
      try {
        await this.db.query(`
          SELECT compress_chunk($1);
        `, [`${chunk.chunk_schema}.${chunk.chunk_name}`]);
        
        compressedCount++;
        
        this.logger.info('Compressed chunk', {
          tableName: chunk.hypertable_name,
          chunkName: chunk.chunk_name,
        });
      } catch (error) {
        this.logger.error('Failed to compress chunk', {
          tableName: chunk.hypertable_name,
          chunkName: chunk.chunk_name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.logger.info('Compression job completed', {
      tableName: tableName || 'all_tables',
      compressedCount,
      cutoffDate: cutoffDate.toISOString(),
    });

    return compressedCount;
  }

  async dropOldPartitions(tableName?: string, olderThanDays?: number): Promise<number> {
    const retentionDays = olderThanDays ?? timescaleConfig.retentionDays;
    const cutoffDate = new Date(Date.now() - (retentionDays * 24 * 60 * 60 * 1000));
    
    const whereClause = tableName 
      ? 'AND c.hypertable_name = $2'
      : '';
    
    const params = [cutoffDate.toISOString()];
    if (tableName) {
      params.push(tableName);
    }

    const result = await this.db.query<{
      hypertable_name: string;
      chunk_name: string;
      chunk_schema: string;
    }>(`
      SELECT 
        c.hypertable_name,
        c.chunk_name,
        c.chunk_schema
      FROM timescaledb_information.chunks c
      WHERE c.range_end < $1
        AND c.hypertable_schema = 'public'
        ${whereClause}
      ORDER BY c.hypertable_name, c.range_start;
    `, params);

    let droppedCount = 0;

    for (const chunk of result.rows) {
      try {
        await this.db.query(`
          SELECT drop_chunks($1, older_than => $2);
        `, [chunk.hypertable_name, cutoffDate]);
        
        droppedCount++;
        
        this.logger.info('Dropped chunk', {
          tableName: chunk.hypertable_name,
          chunkName: chunk.chunk_name,
        });
      } catch (error) {
        this.logger.error('Failed to drop chunk', {
          tableName: chunk.hypertable_name,
          chunkName: chunk.chunk_name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.logger.info('Retention cleanup completed', {
      tableName: tableName || 'all_tables',
      droppedCount,
      cutoffDate: cutoffDate.toISOString(),
    });

    return droppedCount;
  }

  async preCreatePartitions(days = 7): Promise<void> {
    const tables = [
      'command_executions',
      'agent_interactions',
      'user_sessions',
      'productivity_metrics',
    ];

    const startDate = new Date();
    const endDate = new Date(Date.now() + (days * 24 * 60 * 60 * 1000));

    this.logger.info('Pre-creating partitions for upcoming dates', {
      days,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });

    for (const table of tables) {
      try {
        await this.createPartitionsForTable(table, startDate, endDate);
      } catch (error) {
        this.logger.error('Failed to pre-create partitions for table', {
          table,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  async runMaintenanceJob(): Promise<{
    compressedChunks: number;
    droppedChunks: number;
    preCreatedDays: number;
  }> {
    this.logger.info('Starting partition maintenance job');
    
    const startTime = Date.now();
    
    try {
      const compressedChunks = await this.compressOldPartitions();
      const droppedChunks = await this.dropOldPartitions();
      
      await this.preCreatePartitions(7);
      
      const duration = Date.now() - startTime;
      
      this.logger.info('Partition maintenance job completed', {
        compressedChunks,
        droppedChunks,
        preCreatedDays: 7,
        durationMs: duration,
      });
      
      return {
        compressedChunks,
        droppedChunks,
        preCreatedDays: 7,
      };
    } catch (error) {
      this.logger.error('Partition maintenance job failed', {
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      });
      throw error;
    }
  }

  async validatePartitionHealth(): Promise<{
    isHealthy: boolean;
    issues: string[];
    stats: PartitionStats[];
  }> {
    const issues: string[] = [];
    const stats = await this.getPartitionStats();
    
    for (const stat of stats) {
      const daysSinceNewest = Math.ceil(
        (Date.now() - stat.newestChunk.getTime()) / (24 * 60 * 60 * 1000),
      );
      
      if (daysSinceNewest > 2) {
        issues.push(`Table ${stat.tableName} has no recent partitions (newest: ${stat.newestChunk.toISOString()})`);
      }
      
      if (stat.totalChunks > 0 && stat.uncompressedChunks / stat.totalChunks > 0.3) {
        issues.push(`Table ${stat.tableName} has many uncompressed chunks (${stat.uncompressedChunks} uncompressed vs ${stat.compressedChunks} compressed)`);
      }
      
      const daysSinceOldest = Math.ceil(
        (Date.now() - stat.oldestChunk.getTime()) / (24 * 60 * 60 * 1000),
      );
      
      if (daysSinceOldest > timescaleConfig.retentionDays * 1.1) {
        issues.push(`Table ${stat.tableName} has chunks older than retention policy (oldest: ${stat.oldestChunk.toISOString()})`);
      }
    }
    
    return {
      isHealthy: issues.length === 0,
      issues,
      stats,
    };
  }
}