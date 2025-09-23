
Object.defineProperty(exports, "__esModule", { value: true });

const {
  PrismaClientKnownRequestError,
  PrismaClientUnknownRequestError,
  PrismaClientRustPanicError,
  PrismaClientInitializationError,
  PrismaClientValidationError,
  NotFoundError,
  getPrismaClient,
  sqltag,
  empty,
  join,
  raw,
  skip,
  Decimal,
  Debug,
  objectEnumValues,
  makeStrictEnum,
  Extensions,
  warnOnce,
  defineDmmfProperty,
  Public,
  getRuntime
} = require('./runtime/edge.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = PrismaClientKnownRequestError;
Prisma.PrismaClientUnknownRequestError = PrismaClientUnknownRequestError
Prisma.PrismaClientRustPanicError = PrismaClientRustPanicError
Prisma.PrismaClientInitializationError = PrismaClientInitializationError
Prisma.PrismaClientValidationError = PrismaClientValidationError
Prisma.NotFoundError = NotFoundError
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = sqltag
Prisma.empty = empty
Prisma.join = join
Prisma.raw = raw
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = Extensions.getExtensionContext
Prisma.defineExtension = Extensions.defineExtension

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}





/**
 * Enums
 */
exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.TenantScalarFieldEnum = {
  id: 'id',
  name: 'name',
  domain: 'domain',
  schemaName: 'schemaName',
  subscriptionPlan: 'subscriptionPlan',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  isActive: 'isActive',
  metadata: 'metadata',
  adminEmail: 'adminEmail',
  billingEmail: 'billingEmail',
  dataRegion: 'dataRegion',
  complianceSettings: 'complianceSettings'
};

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  email: 'email',
  firstName: 'firstName',
  lastName: 'lastName',
  role: 'role',
  password: 'password',
  ssoProvider: 'ssoProvider',
  ssoUserId: 'ssoUserId',
  lastLogin: 'lastLogin',
  loginCount: 'loginCount',
  timezone: 'timezone',
  preferences: 'preferences',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.MetricsSessionScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  sessionStart: 'sessionStart',
  sessionEnd: 'sessionEnd',
  totalDurationMs: 'totalDurationMs',
  toolsUsed: 'toolsUsed',
  productivityScore: 'productivityScore',
  sessionType: 'sessionType',
  projectId: 'projectId',
  tags: 'tags',
  interruptionsCount: 'interruptionsCount',
  focusTimeMs: 'focusTimeMs',
  description: 'description',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ToolMetricScalarFieldEnum = {
  id: 'id',
  sessionId: 'sessionId',
  toolName: 'toolName',
  toolCategory: 'toolCategory',
  executionCount: 'executionCount',
  totalDurationMs: 'totalDurationMs',
  averageDurationMs: 'averageDurationMs',
  successRate: 'successRate',
  errorCount: 'errorCount',
  memoryUsageMb: 'memoryUsageMb',
  cpuTimeMs: 'cpuTimeMs',
  parameters: 'parameters',
  outputSizeBytes: 'outputSizeBytes',
  commandLine: 'commandLine',
  workingDirectory: 'workingDirectory',
  createdAt: 'createdAt'
};

exports.Prisma.DashboardConfigScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  dashboardName: 'dashboardName',
  description: 'description',
  widgetLayout: 'widgetLayout',
  isDefault: 'isDefault',
  isPublic: 'isPublic',
  refreshIntervalSeconds: 'refreshIntervalSeconds',
  sharedWithRoles: 'sharedWithRoles',
  version: 'version',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ActivityDataScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  actionName: 'actionName',
  actionDescription: 'actionDescription',
  targetName: 'targetName',
  targetType: 'targetType',
  status: 'status',
  priority: 'priority',
  isAutomated: 'isAutomated',
  timestamp: 'timestamp',
  duration: 'duration',
  completedAt: 'completedAt',
  metadata: 'metadata',
  tags: 'tags',
  projectId: 'projectId',
  errorMessage: 'errorMessage',
  errorCode: 'errorCode',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.JsonNullValueInput = {
  JsonNull: Prisma.JsonNull
};

exports.Prisma.NullableJsonNullValueInput = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
};

exports.Prisma.JsonNullValueFilter = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull,
  AnyNull: Prisma.AnyNull
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};


exports.Prisma.ModelName = {
  Tenant: 'Tenant',
  User: 'User',
  MetricsSession: 'MetricsSession',
  ToolMetric: 'ToolMetric',
  DashboardConfig: 'DashboardConfig',
  ActivityData: 'ActivityData'
};
/**
 * Create the Client
 */
const config = {
  "generator": {
    "name": "client",
    "provider": {
      "fromEnvVar": null,
      "value": "prisma-client-js"
    },
    "output": {
      "value": "/Users/ldangelo/Development/fortium/claude-config/src/monitoring-web-service/src/generated/prisma-client",
      "fromEnvVar": null
    },
    "config": {
      "engineType": "library"
    },
    "binaryTargets": [
      {
        "fromEnvVar": null,
        "value": "darwin-arm64",
        "native": true
      }
    ],
    "previewFeatures": [
      "multiSchema"
    ],
    "sourceFilePath": "/Users/ldangelo/Development/fortium/claude-config/src/monitoring-web-service/prisma/schema.prisma",
    "isCustomOutput": true
  },
  "relativeEnvPaths": {
    "rootEnvPath": null,
    "schemaEnvPath": "../../../.env"
  },
  "relativePath": "../../../prisma",
  "clientVersion": "5.22.0",
  "engineVersion": "605197351a3c8bdd595af2d2a9bc3025bca48ea2",
  "datasourceNames": [
    "db"
  ],
  "activeProvider": "postgresql",
  "postinstall": false,
  "inlineDatasources": {
    "db": {
      "url": {
        "fromEnvVar": "DATABASE_URL",
        "value": null
      }
    }
  },
  "inlineSchema": "// =====================================================\n// Prisma Schema for External Metrics Web Service\n// Multi-tenant PostgreSQL database with row-level security\n// =====================================================\n\ngenerator client {\n  provider        = \"prisma-client-js\"\n  previewFeatures = [\"multiSchema\"]\n  output          = \"../src/generated/prisma-client\"\n}\n\ndatasource db {\n  provider          = \"postgresql\"\n  url               = env(\"DATABASE_URL\")\n  shadowDatabaseUrl = env(\"SHADOW_DATABASE_URL\")\n  schemas           = [\"public\", \"tenant_template\"]\n}\n\n// =====================================================\n// Master Tenant Registry (public schema)\n// =====================================================\n\nmodel Tenant {\n  // Primary identifier for the tenant\n  id String @id @default(dbgenerated(\"gen_random_uuid()\")) @db.Uuid\n\n  // Human-readable organization name (required)\n  name   String @db.VarChar(255)\n  domain String @unique @db.VarChar(255)\n\n  // PostgreSQL schema name for this tenant's data\n  schemaName String @unique @map(\"schema_name\") @db.VarChar(63)\n\n  // Subscription plan tier\n  subscriptionPlan String @default(\"basic\") @map(\"subscription_plan\") @db.VarChar(50)\n\n  // Timestamps\n  createdAt DateTime @default(now()) @map(\"created_at\") @db.Timestamptz(6)\n  updatedAt DateTime @default(now()) @updatedAt @map(\"updated_at\") @db.Timestamptz(6)\n\n  // Soft delete flag\n  isActive Boolean @default(true) @map(\"is_active\")\n\n  // Additional tenant metadata (JSON)\n  metadata Json @default(\"{}\") @db.JsonB\n\n  // Contact information\n  adminEmail   String? @map(\"admin_email\") @db.VarChar(255)\n  billingEmail String? @map(\"billing_email\") @db.VarChar(255)\n\n  // Data residency and compliance settings\n  dataRegion         String @default(\"us-east-1\") @map(\"data_region\") @db.VarChar(50)\n  complianceSettings Json   @default(\"{}\") @map(\"compliance_settings\") @db.JsonB\n\n  @@map(\"tenants\")\n  @@schema(\"public\")\n}\n\n// =====================================================\n// Per-Tenant Schema Models (tenant_template schema)\n// =====================================================\n\nmodel User {\n  // Primary identifier for the user\n  id String @id @default(dbgenerated(\"gen_random_uuid()\")) @db.Uuid\n\n  // User authentication and contact info\n  email     String @unique @db.VarChar(255)\n  firstName String @map(\"first_name\") @db.VarChar(100)\n  lastName  String @map(\"last_name\") @db.VarChar(100)\n\n  // Role-based access control\n  role String @default(\"developer\") @db.VarChar(50)\n\n  // Password-based authentication (optional, for non-SSO users)\n  password String? @db.VarChar(255)\n\n  // Single Sign-On integration\n  ssoProvider String? @map(\"sso_provider\") @db.VarChar(50)\n  ssoUserId   String? @map(\"sso_user_id\") @db.VarChar(255)\n\n  // User activity tracking\n  lastLogin  DateTime? @map(\"last_login\") @db.Timestamptz(6)\n  loginCount Int       @default(0) @map(\"login_count\")\n\n  // User preferences and settings\n  timezone    String @default(\"UTC\") @db.VarChar(50)\n  preferences Json   @default(\"{}\") @db.JsonB\n\n  // Account status and metadata\n  isActive  Boolean  @default(true) @map(\"is_active\")\n  createdAt DateTime @default(now()) @map(\"created_at\") @db.Timestamptz(6)\n  updatedAt DateTime @default(now()) @updatedAt @map(\"updated_at\") @db.Timestamptz(6)\n\n  // Relations\n  metricsSessions  MetricsSession[]\n  dashboardConfigs DashboardConfig[]\n  activities       ActivityData[]\n\n  @@map(\"users\")\n  @@schema(\"tenant_template\")\n}\n\nmodel MetricsSession {\n  // Primary identifier for the session\n  id String @id @default(dbgenerated(\"gen_random_uuid()\")) @db.Uuid\n\n  // User who owns this session\n  userId String @map(\"user_id\") @db.Uuid\n  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)\n\n  // Session timing information\n  sessionStart    DateTime  @map(\"session_start\") @db.Timestamptz(6)\n  sessionEnd      DateTime? @map(\"session_end\") @db.Timestamptz(6)\n  totalDurationMs BigInt?   @map(\"total_duration_ms\")\n\n  // Session metadata and analysis\n  toolsUsed         Json? @map(\"tools_used\") @db.JsonB\n  productivityScore Int?  @map(\"productivity_score\")\n\n  // Session categorization and context\n  sessionType String  @default(\"development\") @map(\"session_type\") @db.VarChar(50)\n  projectId   String? @map(\"project_id\") @db.VarChar(100)\n  tags        Json    @default(\"[]\") @map(\"tags\") @db.JsonB\n\n  // Quality metrics\n  interruptionsCount Int    @default(0) @map(\"interruptions_count\")\n  focusTimeMs        BigInt @default(0) @map(\"focus_time_ms\")\n\n  // Session notes and description\n  description String?\n\n  // Timestamps\n  createdAt DateTime @default(now()) @map(\"created_at\") @db.Timestamptz(6)\n  updatedAt DateTime @default(now()) @updatedAt @map(\"updated_at\") @db.Timestamptz(6)\n\n  // Relations\n  toolMetrics ToolMetric[]\n\n  @@map(\"metrics_sessions\")\n  @@schema(\"tenant_template\")\n}\n\nmodel ToolMetric {\n  // Primary identifier for the tool usage record\n  id String @id @default(dbgenerated(\"gen_random_uuid()\")) @db.Uuid\n\n  // Session this tool usage belongs to\n  sessionId String         @map(\"session_id\") @db.Uuid\n  session   MetricsSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)\n\n  // Tool identification\n  toolName     String  @map(\"tool_name\") @db.VarChar(100)\n  toolCategory String? @map(\"tool_category\") @db.VarChar(50)\n\n  // Usage statistics\n  executionCount    Int    @default(1) @map(\"execution_count\")\n  totalDurationMs   BigInt @map(\"total_duration_ms\")\n  averageDurationMs BigInt @map(\"average_duration_ms\")\n\n  // Quality and reliability metrics\n  successRate Decimal @map(\"success_rate\") @db.Decimal(5, 4)\n  errorCount  Int     @default(0) @map(\"error_count\")\n\n  // Performance metrics\n  memoryUsageMb Int?    @map(\"memory_usage_mb\")\n  cpuTimeMs     BigInt? @map(\"cpu_time_ms\")\n\n  // Tool-specific metadata\n  parameters      Json?   @db.JsonB\n  outputSizeBytes BigInt? @map(\"output_size_bytes\")\n\n  // Context and categorization\n  commandLine      String? @db.Text\n  workingDirectory String? @map(\"working_directory\") @db.VarChar(500)\n\n  // Timestamps\n  createdAt DateTime @default(now()) @map(\"created_at\") @db.Timestamptz(6)\n\n  @@map(\"tool_metrics\")\n  @@schema(\"tenant_template\")\n}\n\nmodel DashboardConfig {\n  // Primary identifier for the dashboard configuration\n  id String @id @default(dbgenerated(\"gen_random_uuid()\")) @db.Uuid\n\n  // User who owns this dashboard configuration\n  userId String @map(\"user_id\") @db.Uuid\n  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)\n\n  // Dashboard identification and metadata\n  dashboardName String  @map(\"dashboard_name\") @db.VarChar(100)\n  description   String?\n\n  // Widget layout and configuration\n  widgetLayout Json @map(\"widget_layout\") @db.JsonB\n\n  // Dashboard settings\n  isDefault              Boolean @default(false) @map(\"is_default\")\n  isPublic               Boolean @default(false) @map(\"is_public\")\n  refreshIntervalSeconds Int     @default(30) @map(\"refresh_interval_seconds\")\n\n  // Access and sharing\n  sharedWithRoles Json @default(\"[]\") @map(\"shared_with_roles\") @db.JsonB\n\n  // Version control for dashboard evolution\n  version Int @default(1)\n\n  // Timestamps\n  createdAt DateTime @default(now()) @map(\"created_at\") @db.Timestamptz(6)\n  updatedAt DateTime @default(now()) @updatedAt @map(\"updated_at\") @db.Timestamptz(6)\n\n  @@unique([userId, isDefault], name: \"unique_default_dashboard\")\n  @@map(\"dashboard_configs\")\n  @@schema(\"tenant_template\")\n}\n\nmodel ActivityData {\n  // Primary identifier for the activity\n  id String @id @default(dbgenerated(\"gen_random_uuid()\")) @db.Uuid\n\n  // User who performed the activity\n  userId String @map(\"user_id\") @db.Uuid\n  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)\n\n  // Activity action details\n  actionName        String @map(\"action_name\") @db.VarChar(100)\n  actionDescription String @map(\"action_description\") @db.Text\n\n  // Activity target/context\n  targetName String @map(\"target_name\") @db.VarChar(200)\n  targetType String @default(\"unknown\") @map(\"target_type\") @db.VarChar(50)\n\n  // Activity status and metadata\n  status      String  @default(\"success\") @db.VarChar(20)\n  priority    Int     @default(0)\n  isAutomated Boolean @default(false) @map(\"is_automated\")\n\n  // Activity timing\n  timestamp   DateTime  @default(now()) @db.Timestamptz(6)\n  duration    Int? // Duration in milliseconds\n  completedAt DateTime? @map(\"completed_at\") @db.Timestamptz(6)\n\n  // Additional context and metadata\n  metadata  Json?   @db.JsonB\n  tags      Json    @default(\"[]\") @db.JsonB\n  projectId String? @map(\"project_id\") @db.VarChar(100)\n\n  // Error information (if status is error)\n  errorMessage String? @map(\"error_message\") @db.Text\n  errorCode    String? @map(\"error_code\") @db.VarChar(50)\n\n  // Timestamps\n  createdAt DateTime @default(now()) @map(\"created_at\") @db.Timestamptz(6)\n  updatedAt DateTime @default(now()) @updatedAt @map(\"updated_at\") @db.Timestamptz(6)\n\n  @@map(\"activity_data\")\n  @@schema(\"tenant_template\")\n}\n",
  "inlineSchemaHash": "0800a188b7d44f676b700b4db6ad865fbcd1edd06c46a72224c77cd34445ee43",
  "copyEngine": true
}
config.dirname = '/'

config.runtimeDataModel = JSON.parse("{\"models\":{\"Tenant\":{\"dbName\":\"tenants\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"dbgenerated\",\"args\":[\"gen_random_uuid()\"]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"name\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"domain\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":true,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"schemaName\",\"dbName\":\"schema_name\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":true,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"subscriptionPlan\",\"dbName\":\"subscription_plan\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":\"basic\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"createdAt\",\"dbName\":\"created_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"updatedAt\",\"dbName\":\"updated_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":true},{\"name\":\"isActive\",\"dbName\":\"is_active\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"Boolean\",\"default\":true,\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"metadata\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"Json\",\"default\":\"{}\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"adminEmail\",\"dbName\":\"admin_email\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"billingEmail\",\"dbName\":\"billing_email\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"dataRegion\",\"dbName\":\"data_region\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":\"us-east-1\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"complianceSettings\",\"dbName\":\"compliance_settings\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"Json\",\"default\":\"{}\",\"isGenerated\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false},\"User\":{\"dbName\":\"users\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"dbgenerated\",\"args\":[\"gen_random_uuid()\"]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"email\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":true,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"firstName\",\"dbName\":\"first_name\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"lastName\",\"dbName\":\"last_name\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"role\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":\"developer\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"password\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"ssoProvider\",\"dbName\":\"sso_provider\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"ssoUserId\",\"dbName\":\"sso_user_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"lastLogin\",\"dbName\":\"last_login\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"loginCount\",\"dbName\":\"login_count\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"Int\",\"default\":0,\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"timezone\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":\"UTC\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"preferences\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"Json\",\"default\":\"{}\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"isActive\",\"dbName\":\"is_active\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"Boolean\",\"default\":true,\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"createdAt\",\"dbName\":\"created_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"updatedAt\",\"dbName\":\"updated_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":true},{\"name\":\"metricsSessions\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"MetricsSession\",\"relationName\":\"MetricsSessionToUser\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"dashboardConfigs\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DashboardConfig\",\"relationName\":\"DashboardConfigToUser\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"activities\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"ActivityData\",\"relationName\":\"ActivityDataToUser\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false},\"MetricsSession\":{\"dbName\":\"metrics_sessions\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"dbgenerated\",\"args\":[\"gen_random_uuid()\"]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"userId\",\"dbName\":\"user_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"user\",\"kind\":\"object\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"User\",\"relationName\":\"MetricsSessionToUser\",\"relationFromFields\":[\"userId\"],\"relationToFields\":[\"id\"],\"relationOnDelete\":\"Cascade\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"sessionStart\",\"dbName\":\"session_start\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"sessionEnd\",\"dbName\":\"session_end\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"totalDurationMs\",\"dbName\":\"total_duration_ms\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"BigInt\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"toolsUsed\",\"dbName\":\"tools_used\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Json\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"productivityScore\",\"dbName\":\"productivity_score\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Int\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"sessionType\",\"dbName\":\"session_type\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":\"development\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"projectId\",\"dbName\":\"project_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"tags\",\"dbName\":\"tags\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"Json\",\"default\":\"[]\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"interruptionsCount\",\"dbName\":\"interruptions_count\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"Int\",\"default\":0,\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"focusTimeMs\",\"dbName\":\"focus_time_ms\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"BigInt\",\"default\":\"0\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"description\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"createdAt\",\"dbName\":\"created_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"updatedAt\",\"dbName\":\"updated_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":true},{\"name\":\"toolMetrics\",\"kind\":\"object\",\"isList\":true,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"ToolMetric\",\"relationName\":\"MetricsSessionToToolMetric\",\"relationFromFields\":[],\"relationToFields\":[],\"isGenerated\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false},\"ToolMetric\":{\"dbName\":\"tool_metrics\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"dbgenerated\",\"args\":[\"gen_random_uuid()\"]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"sessionId\",\"dbName\":\"session_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"session\",\"kind\":\"object\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"MetricsSession\",\"relationName\":\"MetricsSessionToToolMetric\",\"relationFromFields\":[\"sessionId\"],\"relationToFields\":[\"id\"],\"relationOnDelete\":\"Cascade\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"toolName\",\"dbName\":\"tool_name\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"toolCategory\",\"dbName\":\"tool_category\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"executionCount\",\"dbName\":\"execution_count\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"Int\",\"default\":1,\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"totalDurationMs\",\"dbName\":\"total_duration_ms\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"BigInt\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"averageDurationMs\",\"dbName\":\"average_duration_ms\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"BigInt\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"successRate\",\"dbName\":\"success_rate\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Decimal\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"errorCount\",\"dbName\":\"error_count\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"Int\",\"default\":0,\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"memoryUsageMb\",\"dbName\":\"memory_usage_mb\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Int\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"cpuTimeMs\",\"dbName\":\"cpu_time_ms\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"BigInt\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"parameters\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Json\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"outputSizeBytes\",\"dbName\":\"output_size_bytes\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"BigInt\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"commandLine\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"workingDirectory\",\"dbName\":\"working_directory\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"createdAt\",\"dbName\":\"created_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false},\"DashboardConfig\":{\"dbName\":\"dashboard_configs\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"dbgenerated\",\"args\":[\"gen_random_uuid()\"]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"userId\",\"dbName\":\"user_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"user\",\"kind\":\"object\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"User\",\"relationName\":\"DashboardConfigToUser\",\"relationFromFields\":[\"userId\"],\"relationToFields\":[\"id\"],\"relationOnDelete\":\"Cascade\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"dashboardName\",\"dbName\":\"dashboard_name\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"description\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"widgetLayout\",\"dbName\":\"widget_layout\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Json\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"isDefault\",\"dbName\":\"is_default\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"Boolean\",\"default\":false,\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"isPublic\",\"dbName\":\"is_public\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"Boolean\",\"default\":false,\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"refreshIntervalSeconds\",\"dbName\":\"refresh_interval_seconds\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"Int\",\"default\":30,\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"sharedWithRoles\",\"dbName\":\"shared_with_roles\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"Json\",\"default\":\"[]\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"version\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"Int\",\"default\":1,\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"createdAt\",\"dbName\":\"created_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"updatedAt\",\"dbName\":\"updated_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":true}],\"primaryKey\":null,\"uniqueFields\":[[\"userId\",\"isDefault\"]],\"uniqueIndexes\":[{\"name\":\"unique_default_dashboard\",\"fields\":[\"userId\",\"isDefault\"]}],\"isGenerated\":false},\"ActivityData\":{\"dbName\":\"activity_data\",\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":true,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":{\"name\":\"dbgenerated\",\"args\":[\"gen_random_uuid()\"]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"userId\",\"dbName\":\"user_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":true,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"user\",\"kind\":\"object\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"User\",\"relationName\":\"ActivityDataToUser\",\"relationFromFields\":[\"userId\"],\"relationToFields\":[\"id\"],\"relationOnDelete\":\"Cascade\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"actionName\",\"dbName\":\"action_name\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"actionDescription\",\"dbName\":\"action_description\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"targetName\",\"dbName\":\"target_name\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"targetType\",\"dbName\":\"target_type\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":\"unknown\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"status\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"String\",\"default\":\"success\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"priority\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"Int\",\"default\":0,\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"isAutomated\",\"dbName\":\"is_automated\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"Boolean\",\"default\":false,\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"timestamp\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"duration\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Int\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"completedAt\",\"dbName\":\"completed_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"DateTime\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"metadata\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"Json\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"tags\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"Json\",\"default\":\"[]\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"projectId\",\"dbName\":\"project_id\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"errorMessage\",\"dbName\":\"error_message\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"errorCode\",\"dbName\":\"error_code\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":false,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":false,\"type\":\"String\",\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"createdAt\",\"dbName\":\"created_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":false},{\"name\":\"updatedAt\",\"dbName\":\"updated_at\",\"kind\":\"scalar\",\"isList\":false,\"isRequired\":true,\"isUnique\":false,\"isId\":false,\"isReadOnly\":false,\"hasDefaultValue\":true,\"type\":\"DateTime\",\"default\":{\"name\":\"now\",\"args\":[]},\"isGenerated\":false,\"isUpdatedAt\":true}],\"primaryKey\":null,\"uniqueFields\":[],\"uniqueIndexes\":[],\"isGenerated\":false}},\"enums\":{},\"types\":{}}")
defineDmmfProperty(exports.Prisma, config.runtimeDataModel)
config.engineWasm = undefined

config.injectableEdgeEnv = () => ({
  parsed: {
    DATABASE_URL: typeof globalThis !== 'undefined' && globalThis['DATABASE_URL'] || typeof process !== 'undefined' && process.env && process.env.DATABASE_URL || undefined
  }
})

if (typeof globalThis !== 'undefined' && globalThis['DEBUG'] || typeof process !== 'undefined' && process.env && process.env.DEBUG || undefined) {
  Debug.enable(typeof globalThis !== 'undefined' && globalThis['DEBUG'] || typeof process !== 'undefined' && process.env && process.env.DEBUG || undefined)
}

const PrismaClient = getPrismaClient(config)
exports.PrismaClient = PrismaClient
Object.assign(exports, Prisma)

