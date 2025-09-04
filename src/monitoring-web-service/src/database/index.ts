import { DatabaseConnection, db } from './connection';
import { DatabaseSchema } from './schema';
import { DatabasePolicies } from './policies';
import { TimescaleFeatures } from './timeseries';
import { PartitionManager } from './partitions';
import { MigrationManager } from './migrations';
import { databaseConfig, timescaleConfig, securityConfig } from './config';

export class Database {
  private connection: DatabaseConnection;
  private schema: DatabaseSchema;
  private policies: DatabasePolicies;
  private timescale: TimescaleFeatures;
  private partitions: PartitionManager;
  private migrations: MigrationManager;

  constructor() {
    this.connection = db;
    this.schema = new DatabaseSchema(this.connection);
    this.policies = new DatabasePolicies(this.connection);
    this.timescale = new TimescaleFeatures(this.connection);
    this.partitions = new PartitionManager(this.connection);
    this.migrations = new MigrationManager(this.connection);
  }

  async initialize(): Promise<void> {
    console.log('Initializing database with configuration:', {
      host: databaseConfig.host,
      database: databaseConfig.database,
      enableRLS: securityConfig.enableRLS,
      compressionEnabled: timescaleConfig.compressionEnabled,
      retentionDays: timescaleConfig.retentionDays,
    });

    try {
      // Initialize schema first
      await this.schema.initializeSchema();
      
      // Set up security policies
      await this.policies.initializePolicies();
      
      // Configure TimescaleDB features
      await this.timescale.initializeTimescaleFeatures();
      
      // Pre-create partitions for the next week
      await this.partitions.preCreatePartitions(7);
      
      console.log('Database initialization completed successfully');
    } catch (error) {
      console.error('Database initialization failed:', error);
      throw error;
    }
  }

  async reset(): Promise<void> {
    console.warn('Resetting database - this will drop all tables and data');
    
    try {
      await this.policies.dropPolicies();
      await this.schema.dropSchema();
      await this.initialize();
      
      console.log('Database reset completed successfully');
    } catch (error) {
      console.error('Database reset failed:', error);
      throw error;
    }
  }

  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    details: {
      connection: any;
      hypertables?: any[];
      compression?: any[];
      chunks?: any[];
      partitionHealth?: any;
    };
  }> {
    try {
      const connectionHealth = await this.connection.healthCheck();
      
      if (connectionHealth.status === 'unhealthy') {
        return {
          status: 'unhealthy',
          details: {
            connection: connectionHealth,
          },
        };
      }

      const [hypertables, compression, chunks, partitionHealth] = await Promise.all([
        this.timescale.getHypertableInfo(),
        this.timescale.getCompressionStats(),
        this.timescale.getChunkInfo(),
        this.partitions.validatePartitionHealth(),
      ]);

      return {
        status: partitionHealth.isHealthy ? 'healthy' : 'unhealthy',
        details: {
          connection: connectionHealth,
          hypertables,
          compression,
          chunks,
          partitionHealth,
        },
      };
    } catch (error) {
      console.error('Database health check failed:', error);
      return {
        status: 'unhealthy',
        details: {
          connection: {
            status: 'unhealthy',
            error: error instanceof Error ? error.message : String(error),
          },
        },
      };
    }
  }

  async close(): Promise<void> {
    await this.connection.close();
  }

  // Expose connection for direct queries when needed
  get conn(): DatabaseConnection {
    return this.connection;
  }

  // Expose components for advanced usage
  get schemaManager(): DatabaseSchema {
    return this.schema;
  }

  get policyManager(): DatabasePolicies {
    return this.policies;
  }

  get timescaleManager(): TimescaleFeatures {
    return this.timescale;
  }

  get partitionManager(): PartitionManager {
    return this.partitions;
  }

  get migrationManager(): MigrationManager {
    return this.migrations;
  }
}

// Export singleton instance
export const database = new Database();

// Export all components
export { DatabaseConnection, db } from './connection';
export { DatabaseSchema } from './schema';
export { DatabasePolicies } from './policies';
export { TimescaleFeatures } from './timeseries';
export { PartitionManager, PartitionInfo, PartitionStats } from './partitions';
export { MigrationManager, Migration, MigrationRecord } from './migrations';
export { 
  databaseConfig, 
  timescaleConfig, 
  securityConfig,
  DatabaseConfig,
  TimescaleConfig,
  SecurityConfig,
} from './config';

// Export types for use in other modules
export type { QueryResult, PoolClient } from 'pg';
