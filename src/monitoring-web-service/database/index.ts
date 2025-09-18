/**
 * =====================================================
 * Database Module - Multi-tenant Database Management
 * External Metrics Web Service
 * =====================================================
 * 
 * Centralized exports for all database components and utilities.
 * Provides a clean, organized interface for database operations
 * in the multi-tenant SaaS platform.
 * 
 * Features:
 * - Complete tenant lifecycle management
 * - Schema creation and management utilities
 * - Connection pooling and health monitoring
 * - Type-safe database operations
 * - Performance monitoring and optimization
 * =====================================================
 */

// Core database connection and management
export {
  DatabaseConnection,
  createDatabaseConnection,
  getDatabase,
  closeDatabaseConnection,
  type DatabaseConfig,
  type ConnectionHealth,
  type TenantContext,
  type QueryMetrics
} from './connection';

// Tenant management
export {
  TenantManager,
  createTenantManager,
  type Tenant,
  type CreateTenantInput,
  type ListTenantsOptions,
  type ListTenantsResult
} from './tenant-manager';

// Schema creation and management
export {
  SchemaCreator,
  createSchemaCreator,
  type SchemaCreationOptions,
  type SchemaInfo
} from './schema-creator';

// Type definitions and interfaces
export {
  // Tenant types
  type SubscriptionPlan,
  type UpdateTenantInput,
  type TenantSummary,
  type DataRegion,
  
  // User types
  type User,
  type UserRole,
  type CreateUserInput,
  type UpdateUserInput,
  type UserAuth,
  
  // Session types
  type MetricsSession,
  type SessionType,
  type CreateSessionInput,
  type UpdateSessionInput,
  type SessionSummary,
  
  // Tool metrics types
  type ToolMetrics,
  type ToolCategory,
  type CreateToolMetricsInput,
  type ToolUsageAggregation,
  
  // Dashboard types
  type DashboardConfig,
  type WidgetConfig,
  type CreateDashboardInput,
  type UpdateDashboardInput,
  
  // Analytics types
  type TimePeriod,
  type ProductivitySummary,
  
  // Utility types
  type BaseEntity,
  type PaginatedResult,
  
  // Type guards
  isValidSubscriptionPlan,
  isValidUserRole,
  isValidSessionType,
  isValidToolCategory,
  
  // Constants
  DATABASE_CONSTANTS
} from './types';

/**
 * Complete database setup for the External Metrics Web Service
 * 
 * This function initializes all database components and returns
 * a comprehensive database interface for the application.
 * 
 * @param config - Optional database configuration
 * @returns Database interface with all managers and utilities
 */
export function setupDatabase(config?: Partial<DatabaseConfig>) {
  const connection = createDatabaseConnection(config);
  const tenantManager = createTenantManager(connection.getPool());
  const schemaCreator = createSchemaCreator(connection.getPool());

  return {
    connection,
    tenantManager,
    schemaCreator,
    
    // Convenience methods
    async close() {
      await connection.close();
    },
    
    async healthCheck() {
      return await connection.checkHealth();
    },
    
    getMetrics() {
      return connection.getPerformanceStats();
    }
  };
}

/**
 * Database interface type for the complete setup
 */
export type DatabaseInterface = ReturnType<typeof setupDatabase>;