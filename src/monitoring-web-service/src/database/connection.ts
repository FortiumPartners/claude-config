/**
 * Database Connection Layer
 * Multi-tenant PostgreSQL connection with row-level security support
 */

import { Pool, PoolClient, PoolConfig } from 'pg';
import * as winston from 'winston';

export interface DatabaseConnection {
  query: (text: string, params?: any[]) => Promise<any>;
  getClient: () => Promise<PoolClient>;
  pool?: Pool;
  setOrganizationContext: (organizationId: string) => Promise<void>;
  clearOrganizationContext: () => Promise<void>;
}

export class PostgreSQLConnection implements DatabaseConnection {
  private _pool: Pool;
  private logger: winston.Logger;
  private currentOrgContext: string | null = null;

  constructor(config: PoolConfig, logger: winston.Logger) {
    this._pool = new Pool({
      ...config,
      max: config.max || 20,
      idleTimeoutMillis: config.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: config.connectionTimeoutMillis || 2000,
    });

    this.logger = logger;

    // Handle pool errors
    this._pool.on('error', (err) => {
      this.logger.error('Database pool error:', err);
    });

    // Log connection events
    this._pool.on('connect', () => {
      this.logger.debug('Database connection established');
    });

    this._pool.on('remove', () => {
      this.logger.debug('Database connection removed from pool');
    });
  }

  get pool(): Pool {
    return this._pool;
  }

  async query(text: string, params?: any[]): Promise<any> {
    const start = Date.now();
    
    try {
      const client = await this._pool.connect();
      
      try {
        // Set organization context if available
        if (this.currentOrgContext) {
          await client.query(
            'SELECT set_config($1, $2, true)',
            ['app.current_organization_id', this.currentOrgContext]
          );
        }

        const result = await client.query(text, params);
        const duration = Date.now() - start;
        
        this.logger.debug('Database query executed', {
          duration,
          rows: result.rowCount,
          organization_id: this.currentOrgContext
        });

        return result;
      } finally {
        client.release();
      }
    } catch (error) {
      const duration = Date.now() - start;
      this.logger.error('Database query failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
        query: text.substring(0, 100),
        organization_id: this.currentOrgContext
      });
      throw error;
    }
  }

  async getClient(): Promise<PoolClient> {
    const client = await this._pool.connect();
    
    // Set organization context if available
    if (this.currentOrgContext) {
      await client.query(
        'SELECT set_config($1, $2, true)',
        ['app.current_organization_id', this.currentOrgContext]
      );
    }

    return client;
  }

  async setOrganizationContext(organizationId: string): Promise<void> {
    this.currentOrgContext = organizationId;
    this.logger.debug('Organization context set', { organization_id: organizationId });
  }

  async clearOrganizationContext(): Promise<void> {
    this.currentOrgContext = null;
    this.logger.debug('Organization context cleared');
  }

  async end(): Promise<void> {
    await this._pool.end();
    this.logger.info('Database connection pool closed');
  }

  async testConnection(): Promise<boolean> {
    try {
      const result = await this.query('SELECT NOW() as server_time, version() as version');
      this.logger.info('Database connection test successful', {
        server_time: result.rows[0]?.server_time,
        version: result.rows[0]?.version?.split(' ')[0]
      });
      return true;
    } catch (error) {
      this.logger.error('Database connection test failed', { error });
      return false;
    }
  }
}

export async function createDbConnection(logger?: winston.Logger): Promise<DatabaseConnection> {
  const defaultLogger = logger || winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    transports: [new winston.transports.Console()]
  });

  const config: PoolConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'metrics_production',
    user: process.env.DB_USER || 'metrics_user',
    password: process.env.DB_PASSWORD,
    max: parseInt(process.env.DB_POOL_SIZE || '20'),
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  };

  defaultLogger.info('Creating database connection', {
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    pool_size: config.max,
    ssl: !!config.ssl
  });

  const connection = new PostgreSQLConnection(config, defaultLogger);
  
  // Test the connection
  const isConnected = await connection.testConnection();
  if (!isConnected) {
    throw new Error('Failed to establish database connection');
  }

  return connection;
}

