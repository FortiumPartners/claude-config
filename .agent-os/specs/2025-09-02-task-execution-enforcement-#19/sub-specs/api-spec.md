# API Specification

This is the API specification for the spec detailed in @.agent-os/specs/2025-09-02-task-execution-enforcement-#19/spec.md

> Created: 2025-09-02
> Version: 1.0.0

## API Overview

The Task Execution Enforcement system provides internal APIs for enforcement management, analytics collection, and dashboard integration. These APIs are designed for local Claude Code integration and do not expose external HTTP endpoints.

## Internal APIs

### Enforcement Engine API

#### `EnforcementEngine.detectViolation()`

**Purpose:** Detect and process file modification violations
**Parameters:** 
- `filePath: string` - Path of modified file
- `operationType: 'create' | 'edit' | 'delete'` - Type of file operation
- `userId: string` - Current user identifier
- `sessionId: string` - Current session identifier

**Response:** 
```typescript
{
  shouldEnforce: boolean;
  enforcementLevel: 1 | 2 | 3;
  suggestedCommand: string;
  message: string;
  allowOverride: boolean;
}
```

**Errors:** 
- `ValidationError` - Invalid parameters provided
- `ConfigurationError` - Enforcement configuration not found

#### `EnforcementEngine.processUserAction()`

**Purpose:** Process user response to enforcement action
**Parameters:**
- `eventId: number` - Enforcement event identifier
- `action: 'complied' | 'overrode' | 'ignored'` - User's chosen action
- `overrideJustification?: string` - Required for override actions

**Response:**
```typescript
{
  success: boolean;
  escalationUpdated: boolean;
  nextEnforcementLevel: 1 | 2 | 3;
}
```

### Analytics Collector API

#### `AnalyticsCollector.recordEvent()`

**Purpose:** Record enforcement event for analytics
**Parameters:**
```typescript
{
  userId: string;
  sessionId: string;
  eventType: 'reminder' | 'warning' | 'blocking' | 'override';
  filePath: string;
  operationType: 'create' | 'edit' | 'delete';
  enforcementLevel: 1 | 2 | 3;
  suggestedCommand?: string;
  userAction?: 'complied' | 'overrode' | 'ignored';
  metadata?: Record<string, any>;
}
```

**Response:**
```typescript
{
  eventId: number;
  recorded: boolean;
}
```

#### `AnalyticsCollector.getComplianceMetrics()`

**Purpose:** Retrieve compliance metrics for dashboard
**Parameters:**
- `userId: string` - User identifier
- `dateRange: { start: Date; end: Date }` - Metrics date range
- `aggregation: 'daily' | 'weekly' | 'monthly'` - Aggregation level

**Response:**
```typescript
{
  metrics: Array<{
    date: string;
    totalOperations: number;
    compliantOperations: number;
    complianceRate: number;
    violationsByLevel: {
      reminder: number;
      warning: number;
      blocking: number;
    };
    overrideUsage: number;
    productivityScore: number;
  }>;
  summary: {
    averageComplianceRate: number;
    totalViolations: number;
    productivityTrend: 'increasing' | 'decreasing' | 'stable';
  };
}
```

### Claude Code Integration API

#### `ClaudeIntegration.hookCommand()`

**Purpose:** Register enforcement hooks with Claude Code commands
**Parameters:**
- `commandPattern: string` - Pattern to match commands requiring enforcement
- `enforcementType: 'suggest' | 'require'` - Type of enforcement to apply

**Response:**
```typescript
{
  hookId: string;
  registered: boolean;
}
```

#### `ClaudeIntegration.shouldSuggestCommand()`

**Purpose:** Determine if a command should be suggested based on user context
**Parameters:**
- `context: string` - User's current context or intent
- `fileOperations: Array<string>` - Files user is trying to modify

**Response:**
```typescript
{
  suggestCommand: boolean;
  commandName: string;
  reason: string;
  confidence: number; // 0-1 confidence score
}
```

## Configuration API

### `ConfigManager.getSettings()`

**Purpose:** Retrieve current enforcement configuration
**Response:**
```typescript
{
  escalationThresholds: {
    reminder: number;
    warning: number;
    blocking: number;
  };
  sessionTimeoutMinutes: number;
  analyticsRetentionDays: number;
  overrideRequiresJustification: boolean;
  enabledFileTypes: Array<string>;
}
```

### `ConfigManager.updateSettings()`

**Purpose:** Update enforcement configuration
**Parameters:** Partial configuration object
**Response:**
```typescript
{
  updated: boolean;
  validationErrors: Array<string>;
}
```

## Dashboard Integration API

### `DashboardAPI.getTeamMetrics()`

**Purpose:** Retrieve team-level compliance metrics for manager dashboard
**Parameters:**
- `teamId?: string` - Team identifier (optional, defaults to all users)
- `dateRange: { start: Date; end: Date }` - Metrics date range

**Response:**
```typescript
{
  teamSummary: {
    totalUsers: number;
    averageComplianceRate: number;
    productivityImprovement: number; // Percentage improvement
    violationTrends: Array<{
      date: string;
      count: number;
      type: 'reminder' | 'warning' | 'blocking';
    }>;
  };
  userBreakdown: Array<{
    userId: string;
    complianceRate: number;
    productivityScore: number;
    recentViolations: number;
    needsTraining: boolean;
  }>;
}
```

### `DashboardAPI.exportAnalytics()`

**Purpose:** Export analytics data for external reporting
**Parameters:**
- `format: 'json' | 'csv'` - Export format
- `dateRange: { start: Date; end: Date }` - Date range to export
- `includeUserDetails: boolean` - Whether to include user-specific data

**Response:**
```typescript
{
  exportId: string;
  filePath: string;
  recordCount: number;
}
```

## Error Handling

### Standard Error Response Format

```typescript
{
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
    timestamp: string;
  };
}
```

### Common Error Codes

- `VALIDATION_ERROR` - Invalid input parameters
- `CONFIGURATION_ERROR` - System configuration issues
- `DATABASE_ERROR` - Database operation failures
- `PERMISSION_ERROR` - Insufficient permissions for operation
- `RATE_LIMIT_ERROR` - Too many requests in time window

## Integration Points

### File System Integration
- Real-time file monitoring via chokidar
- File operation interception and analysis
- Pattern matching for task-related file operations

### Claude Code Hooks
- Command lifecycle hooks for enforcement points
- Session management integration
- User context and state synchronization

### Analytics Storage
- Local SQLite database operations
- Batch processing for performance optimization
- Data retention and cleanup automation

## Security Considerations

### Data Privacy
- All APIs operate on local data only
- No external network requests for user analytics
- User data remains on local machine

### Override Security
- Secure token validation for override requests
- Audit logging for all privileged operations
- Rate limiting to prevent override abuse

### Configuration Security
- Configuration changes require appropriate permissions
- Sensitive settings encrypted at rest
- Secure default configurations provided