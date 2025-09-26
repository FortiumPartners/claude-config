
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


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

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

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
  ssoProvider: 'ssoProvider',
  ssoUserId: 'ssoUserId',
  lastLogin: 'lastLogin',
  loginCount: 'loginCount',
  timezone: 'timezone',
  preferences: 'preferences',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  password: 'password'
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
  workingDirectory: 'workingDirectory',
  createdAt: 'createdAt',
  commandLine: 'commandLine'
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

exports.Prisma.Auth_audit_logScalarFieldEnum = {
  id: 'id',
  organization_id: 'organization_id',
  user_id: 'user_id',
  event_type: 'event_type',
  event_details: 'event_details',
  ip_address: 'ip_address',
  user_agent: 'user_agent',
  success: 'success',
  error_message: 'error_message',
  timestamp: 'timestamp'
};

exports.Prisma.OrganizationsScalarFieldEnum = {
  id: 'id',
  name: 'name',
  slug: 'slug',
  settings: 'settings',
  data_retention_days: 'data_retention_days',
  max_users: 'max_users',
  max_teams: 'max_teams',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.ProjectsScalarFieldEnum = {
  id: 'id',
  organization_id: 'organization_id',
  team_id: 'team_id',
  name: 'name',
  description: 'description',
  repository_url: 'repository_url',
  settings: 'settings',
  status: 'status',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.Refresh_tokensScalarFieldEnum = {
  id: 'id',
  jti: 'jti',
  user_id: 'user_id',
  organization_id: 'organization_id',
  token_family: 'token_family',
  expires_at: 'expires_at',
  created_at: 'created_at'
};

exports.Prisma.Sso_providersScalarFieldEnum = {
  id: 'id',
  organization_id: 'organization_id',
  provider_name: 'provider_name',
  provider_type: 'provider_type',
  client_id: 'client_id',
  client_secret_encrypted: 'client_secret_encrypted',
  discovery_url: 'discovery_url',
  redirect_uri: 'redirect_uri',
  scopes: 'scopes',
  additional_config: 'additional_config',
  is_active: 'is_active',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.Team_membershipsScalarFieldEnum = {
  id: 'id',
  organization_id: 'organization_id',
  team_id: 'team_id',
  user_id: 'user_id',
  role: 'role',
  joined_at: 'joined_at'
};

exports.Prisma.TeamsScalarFieldEnum = {
  id: 'id',
  organization_id: 'organization_id',
  name: 'name',
  description: 'description',
  settings: 'settings',
  is_active: 'is_active',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.Token_blacklistScalarFieldEnum = {
  id: 'id',
  jti: 'jti',
  blacklisted_at: 'blacklisted_at',
  expires_at: 'expires_at'
};

exports.Prisma.User_sessionsScalarFieldEnum = {
  id: 'id',
  user_id: 'user_id',
  organization_id: 'organization_id',
  session_token: 'session_token',
  ip_address: 'ip_address',
  user_agent: 'user_agent',
  last_activity: 'last_activity',
  expires_at: 'expires_at',
  created_at: 'created_at'
};

exports.Prisma.UsersScalarFieldEnum = {
  id: 'id',
  organization_id: 'organization_id',
  email: 'email',
  name: 'name',
  password_hash: 'password_hash',
  role: 'role',
  external_id: 'external_id',
  external_provider: 'external_provider',
  settings: 'settings',
  is_active: 'is_active',
  email_verified: 'email_verified',
  last_login_at: 'last_login_at',
  created_at: 'created_at',
  updated_at: 'updated_at'
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
  ActivityData: 'ActivityData',
  auth_audit_log: 'auth_audit_log',
  organizations: 'organizations',
  projects: 'projects',
  refresh_tokens: 'refresh_tokens',
  sso_providers: 'sso_providers',
  team_memberships: 'team_memberships',
  teams: 'teams',
  token_blacklist: 'token_blacklist',
  user_sessions: 'user_sessions',
  users: 'users'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
