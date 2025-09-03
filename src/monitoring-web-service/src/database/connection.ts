import { Pool, PoolClient, PoolConfig, QueryResult, QueryResultRow } from 'pg';
import { databaseConfig } from './config';
import winston from 'winston';

interface OrganizationContext {
  organizationId: string;
  userId?: string;
  teamId?: string;
}

export class DatabaseConnection {
  private pool: Pool;
  private logger: winston.Logger;

  constructor() {
    const poolConfig: PoolConfig = {
      host: databaseConfig.host,
      port: databaseConfig.port,
      database: databaseConfig.database,
      user: databaseConfig.username,
      password: databaseConfig.password,
      ssl: databaseConfig.ssl,
      max: databaseConfig.maxConnections,
      idleTimeoutMillis: databaseConfig.idleTimeoutMillis,
      connectionTimeoutMillis: databaseConfig.connectionTimeoutMillis,
      statement_timeout: databaseConfig.statementTimeout,
      query_timeout: databaseConfig.queryTimeout,
    };

    this.pool = new Pool(poolConfig);
    this.logger = winston.createLogger({
      level: databaseConfig.enableLogging ? 'debug' : 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
      transports: [
        new winston.transports.Console(),
      ],
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.pool.on('connect', () => {
      this.logger.debug('Database client connected', { 
        totalCount: this.pool.totalCount,
        idleCount: this.pool.idleCount,
        waitingCount: this.pool.waitingCount,
      });
    });

    this.pool.on('acquire', () => {
      this.logger.debug('Database client acquired from pool');
    });

    this.pool.on('error', (err: Error) => {
      this.logger.error('Database pool error', {
        error: err.message,
        stack: err.stack,
      });
    });

    this.pool.on('remove', () => {
      this.logger.debug('Database client removed from pool');
    });
  }

  async query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    const start = Date.now();
    try {
      const result = await this.pool.query<T>(text, params);
      const duration = Date.now() - start;
      
      if (databaseConfig.enableLogging) {
        this.logger.debug('Database query executed', {
          query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
          duration,
          rowCount: result.rowCount,
        });
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.logger.error('Database query failed', {
        query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        duration,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async queryWithRetry<T extends QueryResultRow = any>(
    text: string, 
    params?: any[], 
    maxRetries = databaseConfig.maxRetries,
  ): Promise<QueryResult<T>> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.query<T>(text, params);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt === maxRetries) {
          this.logger.error('Database query failed after all retries', {
            query: text.substring(0, 100),
            attempt,
            maxRetries,
            error: lastError.message,
          });
          break;
        }
        
        const delay = databaseConfig.retryDelayMs * attempt;
        this.logger.warn('Database query failed, retrying', {
          query: text.substring(0, 100),
          attempt,
          maxRetries,
          retryDelay: delay,
          error: lastError.message,
        });
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
  }

  async withTransaction<T>(
    callback: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Transaction rolled back', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      client.release();
    }
  }

  async setOrganizationContext(
    organizationId: string,
    userId?: string,
    teamId?: string,
  ): Promise<void> {
    const context: OrganizationContext = {
      organizationId,
      userId,
      teamId,
    };

    await this.query(
      'SELECT set_config($1, $2, true)',
      ['app.current_organization_id', organizationId],
    );

    if (userId) {
      await this.query(
        'SELECT set_config($1, $2, true)',
        ['app.current_user_id', userId],
      );
    }

    if (teamId) {
      await this.query(
        'SELECT set_config($1, $2, true)',
        ['app.current_team_id', teamId],
      );
    }

    this.logger.debug('Organization context set', context);
  }

  async clearContext(): Promise<void> {
    await this.query('SELECT set_config($1, $2, true)', ['app.current_organization_id', '']);
    await this.query('SELECT set_config($1, $2, true)', ['app.current_user_id', '']);
    await this.query('SELECT set_config($1, $2, true)', ['app.current_team_id', '']);
  }

  async getPoolStats(): Promise<{
    totalCount: number;
    idleCount: number;
    waitingCount: number;
  }> {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
    };
  }

  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    responseTime: number;
    poolStats: {
      totalCount: number;
      idleCount: number;
      waitingCount: number;
    };
  }> {
    const start = Date.now();
    
    try {
      await this.query('SELECT 1');
      const responseTime = Date.now() - start;
      const poolStats = await this.getPoolStats();
      
      return {
        status: 'healthy',
        responseTime,
        poolStats,
      };
    } catch (error) {
      const responseTime = Date.now() - start;
      const poolStats = await this.getPoolStats();
      
      this.logger.error('Database health check failed', {
        error: error instanceof Error ? error.message : String(error),
        responseTime,
      });
      
      return {
        status: 'unhealthy',
        responseTime,
        poolStats,
      };
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
    this.logger.info('Database connection pool closed');
  }
}

export const db = new DatabaseConnection();
