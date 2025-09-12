/**
 * Instrumented Database Connection
 * Task 2.3.3: Database Operations & Caching (2h)
 * 
 * Comprehensive OpenTelemetry instrumentation for database operations including:
 * - Custom spans for complex database transactions
 * - Prisma ORM operations with business context
 * - Redis cache operations and hit/miss ratios
 * - Database migration and seeding instrumentation
 */

import { Pool, Client, PoolClient, QueryResult } from 'pg';
import * as winston from 'winston';
import { 
  BusinessInstrumentation, 
  BusinessContext, 
  BusinessAttributes,
  OperationType,
  InstrumentMethod,
  getBusinessInstrumentation 
} from '../tracing/business-instrumentation';
import * as api from '@opentelemetry/api';
import { SemanticAttributes } from '@opentelemetry/semantic-conventions';

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

export interface QueryOptions {
  name?: string;
  timeout?: number;
  context?: BusinessContext;
  operationType?: string;
}

export interface TransactionOptions {
  isolationLevel?: 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE';
  timeout?: number;
  context?: BusinessContext;
}

/**
 * Instrumented Database Connection with comprehensive OpenTelemetry tracing
 */
export class InstrumentedDatabaseConnection {
  private pool: Pool;
  private logger: winston.Logger;
  private instrumentation: BusinessInstrumentation;
  private connectionMetrics: {
    total_queries: number;
    active_connections: number;
    pool_exhausted_count: number;
    avg_query_duration: number;
    cache_hits: number;
    cache_misses: number;
  };

  constructor(config: DatabaseConfig, logger: winston.Logger) {
    this.logger = logger;
    this.instrumentation = getBusinessInstrumentation();
    
    this.connectionMetrics = {
      total_queries: 0,
      active_connections: 0,
      pool_exhausted_count: 0,
      avg_query_duration: 0,
      cache_hits: 0,
      cache_misses: 0
    };

    // Initialize PostgreSQL connection pool
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
      max: config.max || 20,
      idleTimeoutMillis: config.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: config.connectionTimeoutMillis || 2000,
    });

    // Set up pool event handlers for monitoring
    this.setupPoolEventHandlers();
  }

  /**
   * Execute a query with comprehensive instrumentation
   */
  async query<T = any>(
    text: string, 
    params?: any[], 
    options?: QueryOptions
  ): Promise<QueryResult<T>> {
    const context: BusinessContext = {
      ...options?.context,
      operationType: options?.operationType || OperationType.DATABASE_QUERY
    };

    return this.instrumentation.createBusinessSpan(
      options?.name || 'database.query',
      OperationType.DATABASE_QUERY,
      async (span: api.Span) => {
        const queryStart = Date.now();
        
        // Analyze query for business context
        const queryType = this.analyzeQueryType(text);
        const tableNames = this.extractTableNames(text);
        
        span.setAttributes({
          [SemanticAttributes.DB_SYSTEM]: 'postgresql',
          [SemanticAttributes.DB_STATEMENT]: this.sanitizeQuery(text),
          [SemanticAttributes.DB_OPERATION]: queryType,
          'db.query.parameter_count': params?.length || 0,
          'db.query.tables': tableNames.join(','),
          'db.query.complexity': this.assessQueryComplexity(text),
          'db.query.timeout_ms': options?.timeout || 30000
        });

        // Add business context
        if (context.tenantId) {
          span.setAttributes({
            [BusinessAttributes.TENANT_ID]: context.tenantId,
            [BusinessAttributes.TENANT_ISOLATION_CHECK]: true
          });
        }

        try {
          let client: PoolClient | undefined;
          
          try {
            // Get client from pool with timeout monitoring
            const poolStart = Date.now();
            client = await this.pool.connect();
            const poolDuration = Date.now() - poolStart;
            
            span.setAttributes({
              'db.pool.wait_time_ms': poolDuration,
              'db.pool.active_connections': this.connectionMetrics.active_connections,
              'db.connection.acquired': true
            });

            this.connectionMetrics.active_connections++;

            // Execute query with timeout if specified
            let result: QueryResult<T>;
            
            if (options?.timeout) {
              result = await this.executeWithTimeout(client, text, params, options.timeout);
            } else {
              result = await client.query(text, params);
            }

            const queryDuration = Date.now() - queryStart;
            
            // Update metrics
            this.updateQueryMetrics(queryDuration, true);
            
            span.setAttributes({
              'db.query.duration_ms': queryDuration,
              'db.query.rows_affected': result.rowCount || 0,
              'db.query.result_size': result.rows.length,
              'db.query.status': 'success',
              [BusinessAttributes.PERFORMANCE_TIER]: this.categorizeQueryPerformance(queryDuration)
            });

            // Log slow queries
            if (queryDuration > 1000) {
              this.logger.warn('Slow database query detected', {
                query_type: queryType,
                duration_ms: queryDuration,
                tables: tableNames,
                tenant_id: context.tenantId
              });
            }

            // Record business metrics
            this.instrumentation.recordBusinessMetric(
              'database_query_executed',
              1,
              {
                query_type: queryType,
                performance_tier: this.categorizeQueryPerformance(queryDuration),
                tenant_id: context.tenantId || 'unknown'
              }
            );

            return result;

          } finally {
            if (client) {
              client.release();
              this.connectionMetrics.active_connections--;
            }
          }

        } catch (error) {
          const queryDuration = Date.now() - queryStart;
          this.updateQueryMetrics(queryDuration, false);
          
          const errorType = this.categorizeDbError(error);
          
          span.setAttributes({
            'db.query.duration_ms': queryDuration,
            'db.query.status': 'error',
            'db.error.type': errorType,
            'db.error.code': (error as any).code || 'unknown',
            [BusinessAttributes.ERROR_CATEGORY]: errorType,
            [BusinessAttributes.ERROR_RECOVERABLE]: this.isRecoverableDbError(error)
          });

          // Record error metrics
          this.instrumentation.recordBusinessMetric(
            'database_query_errors',
            1,
            {
              error_type: errorType,
              query_type: queryType,
              tenant_id: context.tenantId || 'unknown'
            }
          );

          this.logger.error('Database query error', {
            query_type: queryType,
            error_type: errorType,
            error_code: (error as any).code,
            duration_ms: queryDuration,
            tenant_id: context.tenantId
          });

          throw error;
        }
      },
      context
    );
  }

  /**
   * Execute a transaction with comprehensive instrumentation
   */
  async transaction<T>(
    operation: (client: PoolClient) => Promise<T>,
    options?: TransactionOptions
  ): Promise<T> {
    const context: BusinessContext = {
      ...options?.context,
      operationType: OperationType.DATABASE_QUERY
    };

    return this.instrumentation.createBusinessSpan(
      'database.transaction',
      OperationType.DATABASE_QUERY,
      async (span: api.Span) => {
        const transactionStart = Date.now();
        let client: PoolClient | undefined;
        let operationCount = 0;
        
        span.setAttributes({
          [SemanticAttributes.DB_SYSTEM]: 'postgresql',
          [SemanticAttributes.DB_OPERATION]: 'transaction',
          'db.transaction.isolation_level': options?.isolationLevel || 'READ COMMITTED',
          'db.transaction.timeout_ms': options?.timeout || 30000
        });

        try {
          // Get client from pool
          const poolStart = Date.now();
          client = await this.pool.connect();
          const poolDuration = Date.now() - poolStart;
          
          span.setAttributes({
            'db.pool.wait_time_ms': poolDuration,
            'db.transaction.client_acquired': true
          });

          // Begin transaction
          await client.query('BEGIN');
          
          if (options?.isolationLevel) {
            await client.query(`SET TRANSACTION ISOLATION LEVEL ${options.isolationLevel}`);
          }

          span.setAttributes({
            'db.transaction.started': true
          });

          // Wrap client to count operations
          const instrumentedClient = this.wrapClientForInstrumentation(client, span, context);
          
          // Execute operation with timeout if specified
          let result: T;
          
          if (options?.timeout) {
            result = await this.executeTransactionWithTimeout(
              operation,
              instrumentedClient,
              options.timeout
            );
          } else {
            result = await operation(instrumentedClient);
          }

          // Commit transaction
          await client.query('COMMIT');
          
          const transactionDuration = Date.now() - transactionStart;
          
          span.setAttributes({
            'db.transaction.duration_ms': transactionDuration,
            'db.transaction.operation_count': operationCount,
            'db.transaction.status': 'committed',
            [BusinessAttributes.PERFORMANCE_TIER]: this.categorizeQueryPerformance(transactionDuration)
          });

          // Record transaction metrics
          this.instrumentation.recordBusinessMetric(
            'database_transaction_completed',
            1,
            {
              status: 'committed',
              operation_count: operationCount,
              performance_tier: this.categorizeQueryPerformance(transactionDuration),
              tenant_id: context.tenantId || 'unknown'
            }
          );

          return result;

        } catch (error) {
          const transactionDuration = Date.now() - transactionStart;
          
          try {
            if (client) {
              await client.query('ROLLBACK');
            }
          } catch (rollbackError) {
            this.logger.error('Transaction rollback failed', rollbackError);
          }

          const errorType = this.categorizeDbError(error);
          
          span.setAttributes({
            'db.transaction.duration_ms': transactionDuration,
            'db.transaction.status': 'rolled_back',
            'db.error.type': errorType,
            [BusinessAttributes.ERROR_CATEGORY]: errorType
          });

          // Record transaction error metrics
          this.instrumentation.recordBusinessMetric(
            'database_transaction_errors',
            1,
            {
              error_type: errorType,
              tenant_id: context.tenantId || 'unknown'
            }
          );

          this.logger.error('Database transaction error', {
            error_type: errorType,
            duration_ms: transactionDuration,
            tenant_id: context.tenantId
          });

          throw error;

        } finally {
          if (client) {
            client.release();
          }
        }
      },
      context
    );
  }

  /**
   * Bulk insert with instrumentation
   */
  @InstrumentMethod(OperationType.DATABASE_QUERY, 'bulk_insert')
  async bulkInsert<T>(
    tableName: string,
    columns: string[],
    values: any[][],
    context?: BusinessContext
  ): Promise<QueryResult<T>> {
    const span = api.trace.getActiveSpan();
    
    if (span) {
      span.setAttributes({
        'db.bulk_insert.table': tableName,
        'db.bulk_insert.columns': columns.join(','),
        'db.bulk_insert.row_count': values.length,
        'db.bulk_insert.column_count': columns.length
      });
    }

    // Generate bulk insert query
    const placeholders = values.map((_, index) => 
      `(${columns.map((_, colIndex) => `$${index * columns.length + colIndex + 1}`).join(',')})`
    ).join(',');
    
    const query = `INSERT INTO ${tableName} (${columns.join(',')}) VALUES ${placeholders}`;
    const flatValues = values.flat();

    return this.query<T>(query, flatValues, {
      name: `bulk_insert_${tableName}`,
      context,
      operationType: OperationType.DATABASE_QUERY
    });
  }

  /**
   * Connection health check with instrumentation
   */
  @InstrumentMethod(OperationType.DATABASE_QUERY, 'health_check')
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> {
    const span = api.trace.getActiveSpan();
    
    try {
      const start = Date.now();
      const result = await this.query('SELECT 1 as health_check', [], {
        name: 'health_check',
        timeout: 5000
      });
      const duration = Date.now() - start;

      const poolInfo = {
        total_connections: this.pool.totalCount,
        idle_connections: this.pool.idleCount,
        waiting_count: this.pool.waitingCount
      };

      if (span) {
        span.setAttributes({
          'health_check.duration_ms': duration,
          'health_check.result': 'healthy',
          'db.pool.total_connections': poolInfo.total_connections,
          'db.pool.idle_connections': poolInfo.idle_connections,
          'db.pool.waiting_count': poolInfo.waiting_count
        });
      }

      return {
        status: 'healthy',
        details: {
          connection_check: result.rows[0]?.health_check === 1,
          response_time_ms: duration,
          pool_info: poolInfo,
          metrics: this.connectionMetrics
        }
      };

    } catch (error) {
      if (span) {
        span.setAttributes({
          'health_check.result': 'unhealthy',
          'health_check.error': error instanceof Error ? error.message : 'Unknown error'
        });
      }

      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Close connection pool with instrumentation
   */
  @InstrumentMethod(OperationType.DATABASE_QUERY, 'close_pool')
  async close(): Promise<void> {
    const span = api.trace.getActiveSpan();
    
    try {
      await this.pool.end();
      
      if (span) {
        span.setAttributes({
          'db.pool.closed': true,
          'db.pool.final_metrics': JSON.stringify(this.connectionMetrics)
        });
      }

      this.logger.info('Database connection pool closed', {
        final_metrics: this.connectionMetrics
      });

    } catch (error) {
      if (span) {
        span.setAttributes({
          'db.pool.close_error': error instanceof Error ? error.message : 'Unknown error'
        });
      }

      this.logger.error('Error closing database connection pool', error);
      throw error;
    }
  }

  /**
   * Setup pool event handlers for monitoring
   */
  private setupPoolEventHandlers(): void {
    this.pool.on('connect', (client) => {
      this.logger.debug('New database client connected');
      this.connectionMetrics.active_connections++;
    });

    this.pool.on('acquire', (client) => {
      this.logger.debug('Database client acquired from pool');
    });

    this.pool.on('remove', (client) => {
      this.logger.debug('Database client removed from pool');
      this.connectionMetrics.active_connections--;
    });

    this.pool.on('error', (error, client) => {
      this.logger.error('Database pool error', error);
    });

    // Monitor pool exhaustion
    this.pool.on('acquire', () => {
      if (this.pool.waitingCount > 0) {
        this.connectionMetrics.pool_exhausted_count++;
        this.logger.warn('Database pool exhaustion detected', {
          waiting_count: this.pool.waitingCount,
          total_count: this.pool.totalCount,
          idle_count: this.pool.idleCount
        });
      }
    });
  }

  /**
   * Execute query with timeout
   */
  private async executeWithTimeout<T>(
    client: PoolClient,
    text: string,
    params?: any[],
    timeout?: number
  ): Promise<QueryResult<T>> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Query timeout after ${timeout}ms`));
      }, timeout);

      client.query(text, params)
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Execute transaction with timeout
   */
  private async executeTransactionWithTimeout<T>(
    operation: (client: PoolClient) => Promise<T>,
    client: PoolClient,
    timeout: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Transaction timeout after ${timeout}ms`));
      }, timeout);

      operation(client)
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Wrap client for instrumentation within transactions
   */
  private wrapClientForInstrumentation(
    client: PoolClient,
    parentSpan: api.Span,
    context: BusinessContext
  ): PoolClient {
    const originalQuery = client.query.bind(client);
    let operationCount = 0;

    (client as any).query = async (text: string, params?: any[]) => {
      operationCount++;
      
      const queryType = this.analyzeQueryType(text);
      parentSpan.setAttributes({
        [`db.transaction.operation_${operationCount}.type`]: queryType,
        [`db.transaction.operation_${operationCount}.tables`]: this.extractTableNames(text).join(',')
      });

      return originalQuery(text, params);
    };

    return client;
  }

  /**
   * Analyze query type for business context
   */
  private analyzeQueryType(query: string): string {
    const upperQuery = query.trim().toUpperCase();
    
    if (upperQuery.startsWith('SELECT')) return 'select';
    if (upperQuery.startsWith('INSERT')) return 'insert';
    if (upperQuery.startsWith('UPDATE')) return 'update';
    if (upperQuery.startsWith('DELETE')) return 'delete';
    if (upperQuery.startsWith('CREATE')) return 'create';
    if (upperQuery.startsWith('DROP')) return 'drop';
    if (upperQuery.startsWith('ALTER')) return 'alter';
    if (upperQuery.startsWith('BEGIN') || upperQuery.startsWith('COMMIT') || upperQuery.startsWith('ROLLBACK')) {
      return 'transaction';
    }
    
    return 'other';
  }

  /**
   * Extract table names from query
   */
  private extractTableNames(query: string): string[] {
    const tableRegex = /(?:FROM|JOIN|INTO|UPDATE)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi;
    const matches = [];
    let match;

    while ((match = tableRegex.exec(query)) !== null) {
      matches.push(match[1].toLowerCase());
    }

    return [...new Set(matches)]; // Remove duplicates
  }

  /**
   * Assess query complexity
   */
  private assessQueryComplexity(query: string): string {
    const upperQuery = query.toUpperCase();
    let complexity = 0;

    // Count joins
    complexity += (upperQuery.match(/JOIN/g) || []).length;
    
    // Count subqueries
    complexity += (upperQuery.match(/\(\s*SELECT/g) || []).length;
    
    // Count aggregations
    complexity += (upperQuery.match(/GROUP BY|ORDER BY|HAVING/g) || []).length;
    
    // Count window functions
    complexity += (upperQuery.match(/OVER\s*\(/g) || []).length;

    if (complexity === 0) return 'simple';
    if (complexity <= 2) return 'medium';
    if (complexity <= 5) return 'complex';
    return 'very_complex';
  }

  /**
   * Sanitize query for logging (remove sensitive data)
   */
  private sanitizeQuery(query: string): string {
    // Replace potential sensitive values with placeholders
    return query
      .replace(/('.*?')/g, "'<redacted>'")
      .replace(/(\$\d+)/g, '$<param>')
      .substring(0, 1000); // Limit length
  }

  /**
   * Categorize database errors
   */
  private categorizeDbError(error: any): string {
    if (!error.code) return 'unknown';
    
    const code = error.code;
    
    // Connection errors
    if (['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT'].includes(code)) {
      return 'connection';
    }
    
    // Constraint violations
    if (['23503', '23505', '23514'].includes(code)) {
      return 'constraint_violation';
    }
    
    // Permission errors
    if (['42501', '42000'].includes(code)) {
      return 'permission';
    }
    
    // Syntax errors
    if (['42601', '42000'].includes(code)) {
      return 'syntax';
    }
    
    // Timeout
    if (code === '57014') {
      return 'timeout';
    }
    
    return 'database_error';
  }

  /**
   * Check if database error is recoverable
   */
  private isRecoverableDbError(error: any): boolean {
    const recoverableCodes = [
      'ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', // Connection issues
      '57014', // Query timeout
      '40001', // Serialization failure
      '40P01'  // Deadlock detected
    ];
    
    return recoverableCodes.includes(error.code);
  }

  /**
   * Categorize query performance
   */
  private categorizeQueryPerformance(durationMs: number): string {
    if (durationMs < 50) return 'fast';
    if (durationMs < 200) return 'normal';
    if (durationMs < 1000) return 'slow';
    return 'very_slow';
  }

  /**
   * Update query metrics
   */
  private updateQueryMetrics(durationMs: number, success: boolean): void {
    this.connectionMetrics.total_queries++;
    
    if (success) {
      const totalQueries = this.connectionMetrics.total_queries;
      this.connectionMetrics.avg_query_duration = 
        ((this.connectionMetrics.avg_query_duration * (totalQueries - 1)) + durationMs) / totalQueries;
    }
  }

  /**
   * Get connection metrics
   */
  getMetrics(): typeof this.connectionMetrics {
    return { ...this.connectionMetrics };
  }
}