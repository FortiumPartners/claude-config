/**
 * =====================================================
 * Database Types and Interfaces
 * External Metrics Web Service
 * =====================================================
 * 
 * Type definitions for all database entities in the
 * multi-tenant SaaS platform. Provides:
 * 
 * - Complete TypeScript interfaces for all tables
 * - Input/output type variations for API operations
 * - Validation enums and constants
 * - Utility types for common operations
 * - Type guards for runtime validation
 * 
 * Features:
 * - Full type safety for database operations
 * - Consistent naming conventions
 * - Flexible input types for API endpoints
 * - Comprehensive JSDoc documentation
 * =====================================================
 */

/**
 * Subscription plan options for tenants
 */
export type SubscriptionPlan = 'basic' | 'professional' | 'enterprise' | 'custom';

/**
 * User roles within a tenant organization
 */
export type UserRole = 'admin' | 'manager' | 'developer' | 'viewer';

/**
 * Session types for categorizing work sessions
 */
export type SessionType = 'development' | 'meeting' | 'research' | 'review' | 'planning' | 'other';

/**
 * Tool categories for grouping related tools
 */
export type ToolCategory = 'file-ops' | 'execution' | 'search' | 'analysis' | 'communication' | 'other';

/**
 * Data regions for compliance and performance
 */
export type DataRegion = 'us-east-1' | 'us-west-2' | 'eu-west-1' | 'ap-southeast-1' | 'other';

// =====================================================
// Master Tenant Registry Types
// =====================================================

/**
 * Complete tenant entity as stored in database
 */
export interface Tenant {
  /** Unique identifier for the tenant */
  id: string;
  /** Human-readable organization name */
  name: string;
  /** Unique domain identifier for tenant resolution */
  domain: string;
  /** PostgreSQL schema name for tenant data */
  schemaName: string;
  /** Current subscription plan */
  subscriptionPlan: SubscriptionPlan;
  /** Tenant creation timestamp */
  createdAt: Date;
  /** Last modification timestamp */
  updatedAt: Date;
  /** Soft delete flag - inactive tenants retain data but block access */
  isActive: boolean;
  /** Flexible JSON storage for tenant-specific configuration */
  metadata: Record<string, any>;
  /** Primary administrator email */
  adminEmail?: string;
  /** Billing contact email */
  billingEmail?: string;
  /** Data residency region */
  dataRegion: DataRegion;
  /** Compliance and regulatory settings */
  complianceSettings: Record<string, any>;
}

/**
 * Input data for creating new tenant
 */
export interface CreateTenantInput {
  /** Organization name (required) */
  name: string;
  /** Unique domain identifier (required) */
  domain: string;
  /** Subscription plan (defaults to 'basic') */
  subscriptionPlan?: SubscriptionPlan;
  /** Administrator email */
  adminEmail?: string;
  /** Billing contact email */
  billingEmail?: string;
  /** Data residency region (defaults to 'us-east-1') */
  dataRegion?: DataRegion;
  /** Initial metadata configuration */
  metadata?: Record<string, any>;
  /** Compliance settings */
  complianceSettings?: Record<string, any>;
}

/**
 * Partial update data for existing tenant
 */
export interface UpdateTenantInput {
  /** Updated organization name */
  name?: string;
  /** Updated subscription plan */
  subscriptionPlan?: SubscriptionPlan;
  /** Updated administrator email */
  adminEmail?: string;
  /** Updated billing email */
  billingEmail?: string;
  /** Updated metadata */
  metadata?: Record<string, any>;
  /** Updated compliance settings */
  complianceSettings?: Record<string, any>;
}

/**
 * Tenant summary for list views
 */
export interface TenantSummary {
  id: string;
  name: string;
  domain: string;
  subscriptionPlan: SubscriptionPlan;
  isActive: boolean;
  createdAt: Date;
  userCount?: number;
  lastActivityAt?: Date;
}

// =====================================================
// User Management Types
// =====================================================

/**
 * Complete user entity within tenant
 */
export interface User {
  /** Unique user identifier */
  id: string;
  /** User email address (unique within tenant) */
  email: string;
  /** User's first name */
  firstName: string;
  /** User's last name */
  lastName: string;
  /** User role determining permissions */
  role: UserRole;
  /** SSO provider name (if using SSO) */
  ssoProvider?: string;
  /** External SSO user identifier */
  ssoUserId?: string;
  /** Last successful login timestamp */
  lastLogin?: Date;
  /** Total number of logins */
  loginCount: number;
  /** User's timezone preference */
  timezone: string;
  /** User-specific preferences and settings */
  preferences: Record<string, any>;
  /** Account active status */
  isActive: boolean;
  /** Account creation timestamp */
  createdAt: Date;
  /** Last account modification timestamp */
  updatedAt: Date;
}

/**
 * Input data for creating new user
 */
export interface CreateUserInput {
  /** User email (required, unique within tenant) */
  email: string;
  /** First name (required) */
  firstName: string;
  /** Last name (required) */
  lastName: string;
  /** User role (defaults to 'developer') */
  role?: UserRole;
  /** SSO provider name */
  ssoProvider?: string;
  /** SSO user identifier */
  ssoUserId?: string;
  /** User timezone (defaults to 'UTC') */
  timezone?: string;
  /** Initial user preferences */
  preferences?: Record<string, any>;
}

/**
 * User profile update data
 */
export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  role?: UserRole;
  timezone?: string;
  preferences?: Record<string, any>;
  isActive?: boolean;
}

/**
 * User authentication context
 */
export interface UserAuth {
  userId: string;
  email: string;
  role: UserRole;
  tenantId: string;
  permissions: string[];
}

// =====================================================
// Metrics Session Types
// =====================================================

/**
 * Complete productivity session entity
 */
export interface MetricsSession {
  /** Unique session identifier */
  id: string;
  /** User who owns this session */
  userId: string;
  /** Session start timestamp */
  sessionStart: Date;
  /** Session end timestamp (null for active sessions) */
  sessionEnd?: Date;
  /** Total session duration in milliseconds */
  totalDurationMs?: number;
  /** JSON array of tools used in this session */
  toolsUsed?: Record<string, any>;
  /** Calculated productivity score (0-100) */
  productivityScore?: number;
  /** Session categorization */
  sessionType: SessionType;
  /** Optional project identifier */
  projectId?: string;
  /** User-defined tags for session */
  tags: string[];
  /** Number of interruptions during session */
  interruptionsCount: number;
  /** Time spent in focused work state */
  focusTimeMs: number;
  /** Optional session description */
  description?: string;
  /** Session creation timestamp */
  createdAt: Date;
  /** Last session update timestamp */
  updatedAt: Date;
}

/**
 * Input data for creating new session
 */
export interface CreateSessionInput {
  /** User ID (required) */
  userId: string;
  /** Session start time (required) */
  sessionStart: Date;
  /** Session type (defaults to 'development') */
  sessionType?: SessionType;
  /** Project identifier */
  projectId?: string;
  /** Initial tags */
  tags?: string[];
  /** Session description */
  description?: string;
}

/**
 * Session update data
 */
export interface UpdateSessionInput {
  /** Session end time */
  sessionEnd?: Date;
  /** Total duration in milliseconds */
  totalDurationMs?: number;
  /** Tools used during session */
  toolsUsed?: Record<string, any>;
  /** Calculated productivity score */
  productivityScore?: number;
  /** Updated tags */
  tags?: string[];
  /** Interruptions count */
  interruptionsCount?: number;
  /** Focus time in milliseconds */
  focusTimeMs?: number;
  /** Updated description */
  description?: string;
}

/**
 * Session summary for dashboard views
 */
export interface SessionSummary {
  id: string;
  sessionStart: Date;
  sessionEnd?: Date;
  totalDurationMs?: number;
  productivityScore?: number;
  sessionType: SessionType;
  toolCount: number;
  focusPercentage?: number;
}

// =====================================================
// Tool Metrics Types
// =====================================================

/**
 * Complete tool usage metrics entity
 */
export interface ToolMetrics {
  /** Unique tool metrics identifier */
  id: string;
  /** Session this tool usage belongs to */
  sessionId: string;
  /** Name of the tool used */
  toolName: string;
  /** Tool category grouping */
  toolCategory?: ToolCategory;
  /** Number of times tool was executed */
  executionCount: number;
  /** Total execution time in milliseconds */
  totalDurationMs: number;
  /** Average execution time per invocation (computed) */
  averageDurationMs: number;
  /** Success rate (0.0 to 1.0) */
  successRate: number;
  /** Number of errors encountered */
  errorCount: number;
  /** Memory usage in megabytes */
  memoryUsageMb?: number;
  /** CPU time in milliseconds */
  cpuTimeMs?: number;
  /** Tool parameters and configuration */
  parameters?: Record<string, any>;
  /** Size of tool output in bytes */
  outputSizeBytes?: number;
  /** Command line executed (if applicable) */
  commandLine?: string;
  /** Working directory when tool was executed */
  workingDirectory?: string;
  /** Metrics creation timestamp */
  createdAt: Date;
}

/**
 * Input data for recording tool usage
 */
export interface CreateToolMetricsInput {
  /** Session ID (required) */
  sessionId: string;
  /** Tool name (required) */
  toolName: string;
  /** Tool category */
  toolCategory?: ToolCategory;
  /** Number of executions (defaults to 1) */
  executionCount?: number;
  /** Total duration in milliseconds (required) */
  totalDurationMs: number;
  /** Success rate (required) */
  successRate: number;
  /** Error count (defaults to 0) */
  errorCount?: number;
  /** Memory usage in MB */
  memoryUsageMb?: number;
  /** CPU time in milliseconds */
  cpuTimeMs?: number;
  /** Tool parameters */
  parameters?: Record<string, any>;
  /** Output size in bytes */
  outputSizeBytes?: number;
  /** Command line used */
  commandLine?: string;
  /** Working directory */
  workingDirectory?: string;
}

/**
 * Tool usage aggregation for analytics
 */
export interface ToolUsageAggregation {
  toolName: string;
  toolCategory?: ToolCategory;
  totalExecutions: number;
  totalDurationMs: number;
  averageDurationMs: number;
  totalSessions: number;
  successRate: number;
  errorRate: number;
  firstUsed: Date;
  lastUsed: Date;
}

// =====================================================
// Dashboard Configuration Types
// =====================================================

/**
 * Dashboard widget configuration
 */
export interface WidgetConfig {
  /** Widget unique identifier */
  id: string;
  /** Widget type (chart, table, metric, etc.) */
  type: string;
  /** Widget title */
  title: string;
  /** Widget position and size */
  layout: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Widget-specific configuration */
  config: Record<string, any>;
  /** Data source configuration */
  dataSource?: {
    query: string;
    refreshInterval?: number;
    filters?: Record<string, any>;
  };
}

/**
 * Complete dashboard configuration entity
 */
export interface DashboardConfig {
  /** Unique dashboard identifier */
  id: string;
  /** User who owns this dashboard */
  userId: string;
  /** Dashboard display name */
  dashboardName: string;
  /** Dashboard description */
  description?: string;
  /** Complete widget layout specification */
  widgetLayout: {
    widgets: WidgetConfig[];
    layout: {
      columns: number;
      rowHeight: number;
    };
  };
  /** Whether this is the user's default dashboard */
  isDefault: boolean;
  /** Whether other users can view this dashboard */
  isPublic: boolean;
  /** Refresh interval in seconds */
  refreshIntervalSeconds: number;
  /** Roles that can access this dashboard */
  sharedWithRoles: UserRole[];
  /** Dashboard version for change tracking */
  version: number;
  /** Dashboard creation timestamp */
  createdAt: Date;
  /** Last dashboard update timestamp */
  updatedAt: Date;
}

/**
 * Input data for creating dashboard configuration
 */
export interface CreateDashboardInput {
  /** User ID (required) */
  userId: string;
  /** Dashboard name (required) */
  dashboardName: string;
  /** Dashboard description */
  description?: string;
  /** Widget layout configuration (required) */
  widgetLayout: DashboardConfig['widgetLayout'];
  /** Whether this should be the default dashboard */
  isDefault?: boolean;
  /** Whether the dashboard is public */
  isPublic?: boolean;
  /** Refresh interval in seconds (defaults to 30) */
  refreshIntervalSeconds?: number;
  /** Roles that can access dashboard */
  sharedWithRoles?: UserRole[];
}

/**
 * Dashboard update data
 */
export interface UpdateDashboardInput {
  /** Updated dashboard name */
  dashboardName?: string;
  /** Updated description */
  description?: string;
  /** Updated widget layout */
  widgetLayout?: DashboardConfig['widgetLayout'];
  /** Updated default status */
  isDefault?: boolean;
  /** Updated public status */
  isPublic?: boolean;
  /** Updated refresh interval */
  refreshIntervalSeconds?: number;
  /** Updated shared roles */
  sharedWithRoles?: UserRole[];
}

// =====================================================
// Analytics and Reporting Types
// =====================================================

/**
 * Time period for analytics queries
 */
export interface TimePeriod {
  /** Start date (inclusive) */
  startDate: Date;
  /** End date (inclusive) */
  endDate: Date;
  /** Time zone for date calculations */
  timezone?: string;
}

/**
 * Productivity analytics summary
 */
export interface ProductivitySummary {
  /** Time period for this summary */
  period: TimePeriod;
  /** User ID (if user-specific) */
  userId?: string;
  /** Total active time in milliseconds */
  totalActiveTime: number;
  /** Total focused time in milliseconds */
  totalFocusTime: number;
  /** Average productivity score */
  averageProductivityScore: number;
  /** Total number of sessions */
  sessionCount: number;
  /** Most used tools */
  topTools: ToolUsageAggregation[];
  /** Productivity trend (positive/negative change) */
  trend?: {
    direction: 'up' | 'down' | 'stable';
    percentage: number;
  };
}

// =====================================================
// Utility Types and Type Guards
// =====================================================

/**
 * Database entity with common fields
 */
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Paginated result wrapper
 */
export interface PaginatedResult<T> {
  /** Array of results */
  data: T[];
  /** Total number of items available */
  total: number;
  /** Current page number (0-based) */
  page: number;
  /** Number of items per page */
  limit: number;
  /** Whether there are more pages available */
  hasMore: boolean;
}

/**
 * Type guard to check if value is a valid SubscriptionPlan
 */
export function isValidSubscriptionPlan(value: any): value is SubscriptionPlan {
  return typeof value === 'string' && 
    ['basic', 'professional', 'enterprise', 'custom'].includes(value);
}

/**
 * Type guard to check if value is a valid UserRole
 */
export function isValidUserRole(value: any): value is UserRole {
  return typeof value === 'string' && 
    ['admin', 'manager', 'developer', 'viewer'].includes(value);
}

/**
 * Type guard to check if value is a valid SessionType
 */
export function isValidSessionType(value: any): value is SessionType {
  return typeof value === 'string' && 
    ['development', 'meeting', 'research', 'review', 'planning', 'other'].includes(value);
}

/**
 * Type guard to check if value is a valid ToolCategory
 */
export function isValidToolCategory(value: any): value is ToolCategory {
  return typeof value === 'string' && 
    ['file-ops', 'execution', 'search', 'analysis', 'communication', 'other'].includes(value);
}

/**
 * Constants for validation and defaults
 */
export const DATABASE_CONSTANTS = {
  /** Maximum length for PostgreSQL identifiers */
  MAX_IDENTIFIER_LENGTH: 63,
  /** Default pagination limit */
  DEFAULT_PAGE_LIMIT: 50,
  /** Maximum pagination limit */
  MAX_PAGE_LIMIT: 1000,
  /** Default refresh interval for dashboards (seconds) */
  DEFAULT_REFRESH_INTERVAL: 30,
  /** Maximum refresh interval for dashboards (seconds) */
  MAX_REFRESH_INTERVAL: 3600,
  /** Default timezone */
  DEFAULT_TIMEZONE: 'UTC',
  /** Default data region */
  DEFAULT_DATA_REGION: 'us-east-1' as DataRegion
} as const;