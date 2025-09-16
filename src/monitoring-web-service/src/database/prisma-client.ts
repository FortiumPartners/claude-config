/**
 * Extended Prisma Client with Multi-tenant Support
 * External Metrics Web Service - Database ORM Layer
 */

import { PrismaClient as BasePrismaClient, Prisma } from '../generated/prisma-client';
import * as winston from 'winston';

// Multi-tenant context interface
export interface TenantContext {
  tenantId: string;
  schemaName: string;
  domain: string;
}

// Extended Prisma client configuration
export interface PrismaClientConfig {
  logger?: winston.Logger;
  enableQueryLogging?: boolean;
  enablePerformanceMonitoring?: boolean;
  slowQueryThresholdMs?: number;
  connectionPoolSettings?: {
    min: number;
    max: number;
    timeoutMs: number;
  };
}

// Custom Prisma client with multi-tenant capabilities
export class ExtendedPrismaClient extends BasePrismaClient {
  private logger: winston.Logger;
  private currentTenant: TenantContext | null = null;
  private enableQueryLogging: boolean;
  private enablePerformanceMonitoring: boolean;
  private slowQueryThresholdMs: number;

  constructor(config: PrismaClientConfig = {}) {
    const connectionPoolSettings = config.connectionPoolSettings || {
      min: parseInt(process.env.DATABASE_POOL_MIN || '2'),
      max: parseInt(process.env.DATABASE_POOL_MAX || '10'),
      timeoutMs: parseInt(process.env.DATABASE_POOL_TIMEOUT_MS || '5000'),
    };

    super({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
      log: config.enableQueryLogging !== false ? [
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'event' },
        { level: 'info', emit: 'event' },
        { level: 'warn', emit: 'event' },
      ] : [],
    });

    this.logger = config.logger || this.createDefaultLogger();
    this.enableQueryLogging = config.enableQueryLogging !== false;
    this.enablePerformanceMonitoring = config.enablePerformanceMonitoring !== false;
    this.slowQueryThresholdMs = config.slowQueryThresholdMs || 
      parseInt(process.env.SLOW_QUERY_THRESHOLD_MS || '1000');

    this.setupEventHandlers();
  }

  /**
   * Create default logger if none provided
   */
  private createDefaultLogger(): winston.Logger {
    return winston.createLogger({
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
   * Setup event handlers for query logging and performance monitoring
   */
  private setupEventHandlers(): void {
    if (this.enableQueryLogging) {
      this.$on('query', (e) => {
        const duration = parseFloat(e.duration);
        const isSlowQuery = duration > this.slowQueryThresholdMs;

        const logData = {
          query: e.query,
          params: e.params,
          duration: `${duration}ms`,
          timestamp: e.timestamp,
          tenant: this.currentTenant?.domain || 'no-tenant',
          slow_query: isSlowQuery,
        };

        if (isSlowQuery) {
          this.logger.warn('Slow query detected', logData);
        } else {
          this.logger.debug('Database query executed', logData);
        }
      });

      this.$on('error', (e) => {
        this.logger.error('Database error', {
          error: e.message,
          tenant: this.currentTenant?.domain || 'no-tenant',
          timestamp: e.timestamp,
        });
      });

      this.$on('info', (e) => {
        this.logger.info('Database info', {
          message: e.message,
          tenant: this.currentTenant?.domain || 'no-tenant',
          timestamp: e.timestamp,
        });
      });

      this.$on('warn', (e) => {
        this.logger.warn('Database warning', {
          message: e.message,
          tenant: this.currentTenant?.domain || 'no-tenant',
          timestamp: e.timestamp,
        });
      });
    }
  }

  /**
   * Set the current tenant context for multi-tenant operations
   */
  async setTenantContext(context: TenantContext): Promise<void> {
    this.currentTenant = context;
    
    // Set PostgreSQL search path to tenant schema first, then public
    // This is the key fix - without this, Prisma queries the wrong schema
    await this.$executeRaw`SET search_path TO ${Prisma.raw(`"${context.schemaName}", public`)};`;
    
    // Execute raw SQL to set the current schema context for audit logging
    // This ensures row-level security and proper data isolation
    await this.$executeRaw`SELECT set_config('app.current_organization_id', ${context.tenantId}, true)`;
    
    this.logger.debug('Tenant context set', {
      tenant_id: context.tenantId,
      schema_name: context.schemaName,
      domain: context.domain,
      search_path_set: true,
    });
  }

  /**
   * Clear the current tenant context
   */
  async clearTenantContext(): Promise<void> {
    if (this.currentTenant) {
      // Reset search path to default (public schema)
      await this.$executeRaw`SET search_path TO public;`;
      
      // Clear audit logging context
      await this.$executeRaw`SELECT set_config('app.current_organization_id', '', true)`;
      
      this.logger.debug('Tenant context cleared', {
        previous_tenant: this.currentTenant.domain,
        search_path_reset: true,
      });
      
      this.currentTenant = null;
    }
  }

  /**
   * Get the current tenant context
   */
  getCurrentTenantContext(): TenantContext | null {
    return this.currentTenant;
  }

  /**
   * Execute a function within a specific tenant context
   */
  async withTenantContext<T>(
    context: TenantContext,
    operation: (client: ExtendedPrismaClient) => Promise<T>
  ): Promise<T> {
    const previousContext = this.currentTenant;
    
    try {
      await this.setTenantContext(context);
      return await operation(this);
    } finally {
      if (previousContext) {
        await this.setTenantContext(previousContext);
      } else {
        await this.clearTenantContext();
      }
    }
  }

  /**
   * Get tenant by domain with caching
   */
  async getTenantByDomain(domain: string): Promise<any | null> {
    const start = Date.now();
    
    try {
      const tenant = await this.tenant.findUnique({
        where: { 
          domain,
          isActive: true,
        },
      });

      const duration = Date.now() - start;
      this.logger.debug('Tenant lookup by domain', {
        domain,
        found: !!tenant,
        duration: `${duration}ms`,
      });

      return tenant;
    } catch (error) {
      const duration = Date.now() - start;
      this.logger.error('Tenant lookup failed', {
        domain,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: `${duration}ms`,
      });
      throw error;
    }
  }

  /**
   * Health check for database connectivity
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    details: {
      connection: boolean;
      responseTime: number;
      timestamp: string;
    };
  }> {
    const start = Date.now();
    
    try {
      await this.$queryRaw`SELECT 1`;
      const responseTime = Date.now() - start;
      
      return {
        status: 'healthy',
        details: {
          connection: true,
          responseTime,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      const responseTime = Date.now() - start;
      
      this.logger.error('Database health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime,
      });
      
      return {
        status: 'unhealthy',
        details: {
          connection: false,
          responseTime,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Get database performance metrics
   */
  async getPerformanceMetrics(): Promise<{
    activeConnections: number;
    totalQueries: number;
    averageQueryTime: number;
    slowQueries: number;
  }> {
    if (!this.enablePerformanceMonitoring) {
      return {
        activeConnections: 0,
        totalQueries: 0,
        averageQueryTime: 0,
        slowQueries: 0,
      };
    }

    // This would typically integrate with PostgreSQL's pg_stat_activity
    // and other performance monitoring tables
    try {
      const stats = await this.$queryRaw<Array<any>>`
        SELECT 
          count(*) as active_connections
        FROM pg_stat_activity 
        WHERE state = 'active'
      `;

      return {
        activeConnections: stats[0]?.active_connections || 0,
        totalQueries: 0, // Would track this in application metrics
        averageQueryTime: 0, // Would calculate from query logs
        slowQueries: 0, // Would track slow queries
      };
    } catch (error) {
      this.logger.error('Failed to get performance metrics', { error });
      return {
        activeConnections: 0,
        totalQueries: 0,
        averageQueryTime: 0,
        slowQueries: 0,
      };
    }
  }

  /**
   * Graceful shutdown with connection cleanup
   */
  async shutdown(): Promise<void> {
    try {
      await this.clearTenantContext();
      await this.$disconnect();
      this.logger.info('Database connections closed successfully');
    } catch (error) {
      this.logger.error('Error during database shutdown', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}

// Factory function to create configured Prisma client
export function createPrismaClient(config?: PrismaClientConfig): ExtendedPrismaClient {
  return new ExtendedPrismaClient(config);
}

// Default client instance (singleton pattern)
let defaultClient: ExtendedPrismaClient | null = null;

export function getPrismaClient(config?: PrismaClientConfig): ExtendedPrismaClient {
  if (!defaultClient) {
    defaultClient = createPrismaClient(config);
  }
  return defaultClient;
}

// Export types for use throughout the application
export type { TenantContext, PrismaClientConfig };
export { Prisma } from '../generated/prisma-client';