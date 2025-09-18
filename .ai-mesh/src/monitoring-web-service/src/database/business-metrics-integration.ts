/**
 * Database Business Metrics Integration
 * Task 4.1: Business Metrics Integration (Sprint 4)
 * 
 * Integration layer for database operations with business metrics:
 * - Connection pool monitoring
 * - Query performance tracking
 * - Transaction metrics
 * - Tenant-specific database usage
 */

import { PrismaClient } from '@prisma/client';
import { getBusinessMetricsService, DatabaseMetric, DbQueryType } from '../services/business-metrics.service';
import { logger } from '../config/logger';
import * as api from '@opentelemetry/api';

/**
 * Database Connection Pool Stats
 */
export interface ConnectionPoolStats {
  active: number;
  idle: number;
  max: number;
  waiting: number;
  total: number;
}

/**
 * Query Performance Data
 */
export interface QueryPerformanceData {
  query: string;
  duration: number;
  queryType: string;
  table?: string;
  rowsAffected?: number;
  success: boolean;
  tenantId?: string;
  userId?: string;
}

/**
 * Database Metrics Collector
 */
export class DatabaseMetricsCollector {
  private businessMetrics = getBusinessMetricsService();
  private queryStartTimes = new Map<string, number>();
  private connectionPoolStats: ConnectionPoolStats = {
    active: 0,
    idle: 0,
    max: 10, // Default, will be updated from actual config
    waiting: 0,
    total: 0,
  };

  constructor() {
    logger.info('Database Metrics Collector initialized', {
      event: 'db_metrics.collector.initialized',
    });
  }

  /**
   * Monitor Prisma client for metrics collection
   */
  instrumentPrismaClient(prisma: PrismaClient): PrismaClient {
    // Add query event listeners
    prisma.$on('query' as any, (event: any) => {
      this.handleQueryEvent(event);
    });

    // Monitor connection events if available
    if (prisma.$on) {
      try {
        prisma.$on('info' as any, (event: any) => {
          this.handleConnectionEvent(event);
        });

        prisma.$on('warn' as any, (event: any) => {
          this.handleConnectionWarning(event);
        });

        prisma.$on('error' as any, (event: any) => {
          this.handleConnectionError(event);
        });
      } catch (error) {
        logger.debug('Some Prisma event listeners not available', {
          event: 'db_metrics.prisma.listeners.partial',
          error: error.message,
        });
      }
    }

    // Wrap Prisma client methods for enhanced tracking
    this.wrapPrismaClientMethods(prisma);

    return prisma;
  }

  /**
   * Handle Prisma query events
   */
  private handleQueryEvent(event: any): void {
    try {
      const { query, params, duration, target } = event;
      
      const queryType = this.extractQueryType(query);
      const table = this.extractTableName(query);
      
      // Create database metric
      const dbMetric: DatabaseMetric = {
        queryType,
        table,
        duration,
        success: true, // Prisma query events are only fired for successful queries
        timestamp: new Date(),
      };

      // Record the metric
      this.businessMetrics.recordDatabaseMetric(dbMetric);

      // Add OTEL span attributes if active span exists
      const currentSpan = api.trace.getActiveSpan();
      if (currentSpan) {
        currentSpan.setAttributes({
          'db.business.query_type': queryType,
          'db.business.table': table || 'unknown',
          'db.business.duration_ms': duration,
          'db.business.success': true,
        });
      }

      logger.debug('Database query metric recorded', {
        event: 'db_metrics.query.recorded',
        queryType,
        table,
        duration,
      });

    } catch (error) {
      logger.error('Failed to handle database query event', {
        event: 'db_metrics.query.error',
        error: error.message,
      });
    }
  }

  /**
   * Handle connection events
   */
  private handleConnectionEvent(event: any): void {
    try {
      // Update connection pool stats if available in event
      if (event.message?.includes('connection')) {
        this.updateConnectionPoolStats();
      }
    } catch (error) {
      logger.debug('Failed to handle connection event', {
        event: 'db_metrics.connection.error',
        error: error.message,
      });
    }
  }

  /**
   * Handle connection warnings
   */
  private handleConnectionWarning(event: any): void {
    logger.warn('Database connection warning', {
      event: 'db_metrics.connection.warning',
      message: event.message,
      timestamp: event.timestamp,
    });
  }

  /**
   * Handle connection errors
   */
  private handleConnectionError(event: any): void {
    logger.error('Database connection error', {
      event: 'db_metrics.connection.error',
      message: event.message,
      timestamp: event.timestamp,
    });
  }

  /**
   * Wrap Prisma client methods for enhanced tracking
   */
  private wrapPrismaClientMethods(prisma: any): void {
    const originalTransaction = prisma.$transaction;
    if (originalTransaction) {
      prisma.$transaction = async (queries: any, options?: any) => {
        const startTime = Date.now();
        let success = false;
        
        try {
          const result = await originalTransaction.call(prisma, queries, options);
          success = true;
          return result;
        } finally {
          const duration = Date.now() - startTime;
          
          // Record transaction metric
          this.businessMetrics.recordDatabaseMetric({
            queryType: DbQueryType.TRANSACTION,
            duration,
            success,
            timestamp: new Date(),
          });

          logger.debug('Database transaction metric recorded', {
            event: 'db_metrics.transaction.recorded',
            duration,
            success,
          });
        }
      };
    }

    // Wrap executeRaw and queryRaw if available
    if (prisma.$executeRaw) {
      const originalExecuteRaw = prisma.$executeRaw;
      prisma.$executeRaw = async (query: any, ...values: any[]) => {
        return this.wrapRawQuery('EXECUTE', originalExecuteRaw, query, values);
      };
    }

    if (prisma.$queryRaw) {
      const originalQueryRaw = prisma.$queryRaw;
      prisma.$queryRaw = async (query: any, ...values: any[]) => {
        return this.wrapRawQuery('SELECT', originalQueryRaw, query, values);
      };
    }
  }

  /**
   * Wrap raw query methods
   */
  private async wrapRawQuery(queryType: string, originalMethod: Function, query: any, values: any[]): Promise<any> {
    const startTime = Date.now();
    let success = false;
    
    try {
      const result = await originalMethod.call(this, query, ...values);
      success = true;
      return result;
    } finally {
      const duration = Date.now() - startTime;
      
      this.businessMetrics.recordDatabaseMetric({
        queryType,
        duration,
        success,
        timestamp: new Date(),
      });

      logger.debug('Raw database query metric recorded', {
        event: 'db_metrics.raw_query.recorded',
        queryType,
        duration,
        success,
      });
    }
  }

  /**
   * Extract query type from SQL query
   */
  private extractQueryType(query: string): string {
    if (!query) return DbQueryType.SELECT;
    
    const upperQuery = query.trim().toUpperCase();
    
    if (upperQuery.startsWith('SELECT')) return DbQueryType.SELECT;
    if (upperQuery.startsWith('INSERT')) return DbQueryType.INSERT;
    if (upperQuery.startsWith('UPDATE')) return DbQueryType.UPDATE;
    if (upperQuery.startsWith('DELETE')) return DbQueryType.DELETE;
    if (upperQuery.startsWith('UPSERT')) return DbQueryType.UPSERT;
    if (upperQuery.startsWith('BEGIN') || upperQuery.startsWith('COMMIT') || upperQuery.startsWith('ROLLBACK')) {
      return DbQueryType.TRANSACTION;
    }
    
    return DbQueryType.SELECT; // Default fallback
  }

  /**
   * Extract table name from SQL query
   */
  private extractTableName(query: string): string | undefined {
    if (!query) return undefined;

    try {
      const upperQuery = query.trim().toUpperCase();
      
      // Basic table extraction for common patterns
      const fromMatch = upperQuery.match(/FROM\s+["`]?([a-zA-Z_][a-zA-Z0-9_]*)["`]?/);
      if (fromMatch) return fromMatch[1].toLowerCase();
      
      const intoMatch = upperQuery.match(/INTO\s+["`]?([a-zA-Z_][a-zA-Z0-9_]*)["`]?/);
      if (intoMatch) return intoMatch[1].toLowerCase();
      
      const updateMatch = upperQuery.match(/UPDATE\s+["`]?([a-zA-Z_][a-zA-Z0-9_]*)["`]?/);
      if (updateMatch) return updateMatch[1].toLowerCase();
      
      return undefined;
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Update connection pool statistics
   */
  private updateConnectionPoolStats(): void {
    try {
      // In a real implementation, this would query the actual connection pool
      // For now, we'll simulate with basic process information
      
      // This is a simplified implementation - in production, you'd want to
      // integrate with the actual database driver's connection pool stats
      const memUsage = process.memoryUsage();
      const estimatedConnections = Math.floor(memUsage.heapUsed / (50 * 1024 * 1024)); // Rough estimate

      this.connectionPoolStats = {
        active: Math.min(estimatedConnections, this.connectionPoolStats.max),
        idle: Math.max(0, this.connectionPoolStats.max - estimatedConnections),
        max: this.connectionPoolStats.max,
        waiting: 0,
        total: this.connectionPoolStats.max,
      };

      // Update business metrics service
      this.businessMetrics.updateConnectionPoolStats(
        this.connectionPoolStats.active,
        this.connectionPoolStats.idle,
        this.connectionPoolStats.max
      );

      logger.debug('Connection pool stats updated', {
        event: 'db_metrics.connection_pool.updated',
        stats: this.connectionPoolStats,
      });

    } catch (error) {
      logger.error('Failed to update connection pool stats', {
        event: 'db_metrics.connection_pool.error',
        error: error.message,
      });
    }
  }

  /**
   * Set connection pool configuration
   */
  setConnectionPoolConfig(maxConnections: number): void {
    this.connectionPoolStats.max = maxConnections;
    this.connectionPoolStats.total = maxConnections;
    
    logger.info('Connection pool configuration updated', {
      event: 'db_metrics.connection_pool.configured',
      maxConnections,
    });
  }

  /**
   * Get current connection pool stats
   */
  getConnectionPoolStats(): ConnectionPoolStats {
    return { ...this.connectionPoolStats };
  }

  /**
   * Record manual database metric
   */
  recordDatabaseOperation(data: QueryPerformanceData): void {
    const dbMetric: DatabaseMetric = {
      queryType: data.queryType,
      table: data.table,
      duration: data.duration,
      rowsAffected: data.rowsAffected,
      success: data.success,
      tenantId: data.tenantId,
      timestamp: new Date(),
    };

    this.businessMetrics.recordDatabaseMetric(dbMetric);

    logger.debug('Manual database metric recorded', {
      event: 'db_metrics.manual.recorded',
      queryType: data.queryType,
      table: data.table,
      duration: data.duration,
      success: data.success,
    });
  }

  /**
   * Start periodic connection pool monitoring
   */
  startPeriodicMonitoring(intervalMs: number = 30000): void {
    setInterval(() => {
      this.updateConnectionPoolStats();
    }, intervalMs);

    logger.info('Periodic database monitoring started', {
      event: 'db_metrics.periodic.started',
      intervalMs,
    });
  }

  /**
   * Get database metrics health status
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    connectionPool: ConnectionPoolStats;
    metrics: {
      enabled: boolean;
      lastUpdate: Date;
    };
  } {
    const poolUtilization = this.connectionPoolStats.active / this.connectionPoolStats.max;
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (poolUtilization > 0.9) {
      status = 'degraded';
    }
    if (poolUtilization > 0.95) {
      status = 'unhealthy';
    }

    return {
      status,
      connectionPool: this.connectionPoolStats,
      metrics: {
        enabled: true,
        lastUpdate: new Date(),
      },
    };
  }
}

/**
 * Database Query Builder with Metrics Integration
 */
export class MetricsAwareQueryBuilder {
  private collector: DatabaseMetricsCollector;
  private tenantId?: string;
  private userId?: string;

  constructor(collector: DatabaseMetricsCollector, tenantId?: string, userId?: string) {
    this.collector = collector;
    this.tenantId = tenantId;
    this.userId = userId;
  }

  /**
   * Execute query with automatic metrics collection
   */
  async executeQuery<T>(
    queryFn: () => Promise<T>,
    queryType: string,
    table?: string
  ): Promise<T> {
    const startTime = Date.now();
    let success = false;
    let result: T;

    try {
      result = await queryFn();
      success = true;
      return result;
    } finally {
      const duration = Date.now() - startTime;

      this.collector.recordDatabaseOperation({
        query: `${queryType} ${table || 'unknown'}`,
        duration,
        queryType,
        table,
        success,
        tenantId: this.tenantId,
        userId: this.userId,
      });
    }
  }

  /**
   * Create a new query builder with context
   */
  withContext(tenantId?: string, userId?: string): MetricsAwareQueryBuilder {
    return new MetricsAwareQueryBuilder(this.collector, tenantId, userId);
  }
}

// Global instance
let globalDatabaseCollector: DatabaseMetricsCollector | null = null;

/**
 * Get or create global database metrics collector
 */
export function getDatabaseMetricsCollector(): DatabaseMetricsCollector {
  if (!globalDatabaseCollector) {
    globalDatabaseCollector = new DatabaseMetricsCollector();
  }
  return globalDatabaseCollector;
}

/**
 * Initialize database metrics collection
 */
export function initializeDatabaseMetrics(prisma: PrismaClient, options: {
  maxConnections?: number;
  enablePeriodicMonitoring?: boolean;
  monitoringInterval?: number;
} = {}): DatabaseMetricsCollector {
  const collector = getDatabaseMetricsCollector();
  
  // Configure connection pool
  if (options.maxConnections) {
    collector.setConnectionPoolConfig(options.maxConnections);
  }

  // Instrument Prisma client
  collector.instrumentPrismaClient(prisma);

  // Start periodic monitoring if enabled
  if (options.enablePeriodicMonitoring !== false) {
    collector.startPeriodicMonitoring(options.monitoringInterval);
  }

  logger.info('Database metrics initialized', {
    event: 'db_metrics.initialized',
    options,
  });

  return collector;
}