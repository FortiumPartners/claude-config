/**
 * ORM Utility Functions
 * External Metrics Web Service - Database Helper Functions
 */

import { ExtendedPrismaClient, TenantContext, Prisma } from './prisma-client';
import * as winston from 'winston';

// Transaction options
export interface TransactionOptions {
  maxWait?: number;
  timeout?: number;
  isolationLevel?: Prisma.TransactionIsolationLevel;
}

// Batch operation configuration
export interface BatchConfig {
  batchSize?: number;
  maxConcurrency?: number;
  enableProgress?: boolean;
}

// Pagination parameters
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Pagination result
export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Query performance metrics
export interface QueryMetrics {
  queryCount: number;
  totalDuration: number;
  averageDuration: number;
  slowQueries: number;
}

/**
 * ORM Utilities class with transaction helpers and batch operations
 */
export class ORMUtils {
  private logger: winston.Logger;
  private queryMetrics: QueryMetrics = {
    queryCount: 0,
    totalDuration: 0,
    averageDuration: 0,
    slowQueries: 0,
  };

  constructor(logger?: winston.Logger) {
    this.logger = logger || winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [new winston.transports.Console()],
    });
  }

  /**
   * Execute operation within a database transaction
   */
  async withTransaction<T>(
    client: ExtendedPrismaClient,
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
    options: TransactionOptions = {}
  ): Promise<T> {
    const start = Date.now();
    const tenantContext = client.getCurrentTenantContext();

    try {
      const result = await client.$transaction(async (tx) => {
        // Ensure tenant context is maintained within transaction
        if (tenantContext) {
          await tx.$executeRaw`SELECT set_config('app.current_organization_id', ${tenantContext.tenantId}, true)`;
        }
        
        return await operation(tx);
      }, {
        maxWait: options.maxWait || 5000,
        timeout: options.timeout || 10000,
        isolationLevel: options.isolationLevel,
      });

      const duration = Date.now() - start;
      this.updateQueryMetrics(duration);

      this.logger.debug('Transaction completed', {
        duration: `${duration}ms`,
        tenant: tenantContext?.domain || 'no-tenant',
      });

      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.updateQueryMetrics(duration);

      this.logger.error('Transaction failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: `${duration}ms`,
        tenant: tenantContext?.domain || 'no-tenant',
      });

      throw error;
    }
  }

  /**
   * Execute operations in batches with concurrency control
   */
  async batchProcess<T, R>(
    items: T[],
    processor: (batch: T[]) => Promise<R[]>,
    config: BatchConfig = {}
  ): Promise<R[]> {
    const batchSize = config.batchSize || 100;
    const maxConcurrency = config.maxConcurrency || 5;
    const enableProgress = config.enableProgress || false;

    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }

    this.logger.info('Starting batch processing', {
      totalItems: items.length,
      batchSize,
      totalBatches: batches.length,
      maxConcurrency,
    });

    const results: R[] = [];
    let processed = 0;

    // Process batches with concurrency control
    for (let i = 0; i < batches.length; i += maxConcurrency) {
      const concurrentBatches = batches.slice(i, i + maxConcurrency);
      
      const batchPromises = concurrentBatches.map(async (batch, batchIndex) => {
        const start = Date.now();
        try {
          const batchResults = await processor(batch);
          const duration = Date.now() - start;
          
          processed += batch.length;
          
          if (enableProgress) {
            this.logger.info('Batch processed', {
              batchIndex: i + batchIndex,
              batchSize: batch.length,
              processed,
              total: items.length,
              duration: `${duration}ms`,
              progress: `${Math.round((processed / items.length) * 100)}%`,
            });
          }

          return batchResults;
        } catch (error) {
          const duration = Date.now() - start;
          this.logger.error('Batch processing failed', {
            batchIndex: i + batchIndex,
            batchSize: batch.length,
            error: error instanceof Error ? error.message : 'Unknown error',
            duration: `${duration}ms`,
          });
          throw error;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.flat());
    }

    this.logger.info('Batch processing completed', {
      totalItems: items.length,
      totalResults: results.length,
      totalBatches: batches.length,
    });

    return results;
  }

  /**
   * Paginate query results with metadata
   */
  async paginate<T>(
    query: any,
    params: PaginationParams
  ): Promise<PaginatedResult<T>> {
    const { page, limit, sortBy, sortOrder = 'desc' } = params;
    const offset = (page - 1) * limit;

    const start = Date.now();

    try {
      // Build query with pagination and sorting
      const queryOptions: any = {
        skip: offset,
        take: limit,
      };

      if (sortBy) {
        queryOptions.orderBy = {
          [sortBy]: sortOrder,
        };
      }

      // Execute paginated query and count query in parallel
      const [data, total] = await Promise.all([
        query.findMany(queryOptions),
        query.count(),
      ]);

      const duration = Date.now() - start;
      this.updateQueryMetrics(duration);

      const totalPages = Math.ceil(total / limit);
      const hasNext = page < totalPages;
      const hasPrev = page > 1;

      this.logger.debug('Pagination query completed', {
        page,
        limit,
        total,
        totalPages,
        duration: `${duration}ms`,
      });

      return {
        data,
        meta: {
          page,
          limit,
          total,
          totalPages,
          hasNext,
          hasPrev,
        },
      };
    } catch (error) {
      const duration = Date.now() - start;
      this.updateQueryMetrics(duration);

      this.logger.error('Pagination query failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        page,
        limit,
        duration: `${duration}ms`,
      });

      throw error;
    }
  }

  /**
   * Upsert operation with conflict resolution
   */
  async upsert<T>(
    model: any,
    where: any,
    create: any,
    update: any
  ): Promise<T> {
    const start = Date.now();

    try {
      const result = await model.upsert({
        where,
        create: {
          ...create,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        update: {
          ...update,
          updatedAt: new Date(),
        },
      });

      const duration = Date.now() - start;
      this.updateQueryMetrics(duration);

      this.logger.debug('Upsert operation completed', {
        duration: `${duration}ms`,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.updateQueryMetrics(duration);

      this.logger.error('Upsert operation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: `${duration}ms`,
      });

      throw error;
    }
  }

  /**
   * Bulk insert with conflict handling
   */
  async bulkInsert<T>(
    model: any,
    data: any[],
    options: { skipDuplicates?: boolean; updateDuplicates?: boolean } = {}
  ): Promise<number> {
    const start = Date.now();

    try {
      const now = new Date();
      const enrichedData = data.map(item => ({
        ...item,
        createdAt: now,
        updatedAt: now,
      }));

      let result;
      if (options.updateDuplicates) {
        // Use upsert for update on conflict
        result = await this.batchProcess(
          enrichedData,
          async (batch) => {
            return Promise.all(
              batch.map(item =>
                model.upsert({
                  where: { id: item.id },
                  create: item,
                  update: { ...item, updatedAt: now },
                })
              )
            );
          },
          { batchSize: 100 }
        );
        return result.length;
      } else {
        result = await model.createMany({
          data: enrichedData,
          skipDuplicates: options.skipDuplicates || false,
        });
        return result.count;
      }
    } catch (error) {
      const duration = Date.now() - start;
      this.updateQueryMetrics(duration);

      this.logger.error('Bulk insert failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        itemCount: data.length,
        duration: `${duration}ms`,
      });

      throw error;
    }
  }

  /**
   * Soft delete operation
   */
  async softDelete(
    model: any,
    where: any,
    deletedByUserId?: string
  ): Promise<any> {
    const start = Date.now();

    try {
      const result = await model.update({
        where,
        data: {
          isActive: false,
          updatedAt: new Date(),
          ...(deletedByUserId && { deletedBy: deletedByUserId }),
        },
      });

      const duration = Date.now() - start;
      this.updateQueryMetrics(duration);

      this.logger.debug('Soft delete completed', {
        duration: `${duration}ms`,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.updateQueryMetrics(duration);

      this.logger.error('Soft delete failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: `${duration}ms`,
      });

      throw error;
    }
  }

  /**
   * Update query metrics for performance monitoring
   */
  private updateQueryMetrics(duration: number): void {
    this.queryMetrics.queryCount += 1;
    this.queryMetrics.totalDuration += duration;
    this.queryMetrics.averageDuration = this.queryMetrics.totalDuration / this.queryMetrics.queryCount;
    
    if (duration > parseInt(process.env.SLOW_QUERY_THRESHOLD_MS || '1000')) {
      this.queryMetrics.slowQueries += 1;
    }
  }

  /**
   * Get current query performance metrics
   */
  getQueryMetrics(): QueryMetrics {
    return { ...this.queryMetrics };
  }

  /**
   * Reset query metrics
   */
  resetQueryMetrics(): void {
    this.queryMetrics = {
      queryCount: 0,
      totalDuration: 0,
      averageDuration: 0,
      slowQueries: 0,
    };
  }

  /**
   * Generate database health report
   */
  async generateHealthReport(client: ExtendedPrismaClient): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    metrics: QueryMetrics;
    performance: any;
    recommendations: string[];
  }> {
    const healthCheck = await client.healthCheck();
    const performanceMetrics = await client.getPerformanceMetrics();
    const queryMetrics = this.getQueryMetrics();

    const recommendations: string[] = [];
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Analyze performance and provide recommendations
    if (queryMetrics.averageDuration > 500) {
      status = 'degraded';
      recommendations.push('Average query time is high - consider query optimization');
    }

    if (queryMetrics.slowQueries / queryMetrics.queryCount > 0.1) {
      status = 'degraded';
      recommendations.push('High percentage of slow queries detected');
    }

    if (performanceMetrics.activeConnections > 8) {
      recommendations.push('High number of active connections - consider connection pooling optimization');
    }

    if (!healthCheck.details.connection) {
      status = 'unhealthy';
      recommendations.push('Database connection failed - check connectivity');
    }

    return {
      status,
      metrics: queryMetrics,
      performance: performanceMetrics,
      recommendations,
    };
  }
}

// Export utility functions
export const ormUtils = new ORMUtils();

/**
 * Helper function to create date range filters
 */
export function createDateRangeFilter(
  field: string,
  startDate?: Date,
  endDate?: Date
): any {
  const filter: any = {};
  
  if (startDate || endDate) {
    filter[field] = {};
    if (startDate) filter[field].gte = startDate;
    if (endDate) filter[field].lte = endDate;
  }
  
  return filter;
}

/**
 * Helper function to create search filters
 */
export function createSearchFilter(
  fields: string[],
  searchTerm: string
): any {
  if (!searchTerm || searchTerm.trim() === '') {
    return {};
  }

  return {
    OR: fields.map(field => ({
      [field]: {
        contains: searchTerm.trim(),
        mode: 'insensitive',
      },
    })),
  };
}

/**
 * Helper function to validate UUID format
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Helper function to sanitize sort parameters
 */
export function sanitizeSortParams(
  sortBy: string,
  allowedFields: string[]
): { field: string; order: 'asc' | 'desc' } | null {
  const [field, order] = sortBy.split(':');
  
  if (!allowedFields.includes(field)) {
    return null;
  }
  
  return {
    field,
    order: order === 'desc' ? 'desc' : 'asc',
  };
}