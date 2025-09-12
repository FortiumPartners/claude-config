# Business Logic Instrumentation Guide

## Overview

This guide covers the comprehensive OpenTelemetry instrumentation implementation for business-specific operations in the Fortium Monitoring Web Service. The instrumentation provides meaningful insights into authentication flows, metrics processing, WebSocket communications, database operations, caching, and external integrations.

## Architecture

### Core Components

1. **Business Instrumentation Library** (`src/tracing/business-instrumentation.ts`)
   - Central instrumentation utilities and helpers
   - Custom semantic attributes for business operations
   - Performance categorization and error classification
   - Metrics recording and span management

2. **Instrumented Services**
   - JWT Service (`src/services/jwt.service.instrumented.ts`)
   - Metrics Processing Service (`src/services/metrics-processing.service.instrumented.ts`)
   - WebSocket Service (`src/services/websocket.service.instrumented.ts`)
   - Database Connection (`src/database/connection.instrumented.ts`)
   - Redis Cache Manager (`src/config/redis.config.instrumented.ts`)
   - External API Service (`src/services/external-api.service.instrumented.ts`)

3. **Integration Examples** (`src/examples/business-instrumentation-integration.ts`)
   - Complete authentication flow
   - Real-time metrics processing pipeline
   - External service integration with circuit breaker

## Business Attributes

### Custom Semantic Attributes

```typescript
// User & Tenant Context
USER_ID: 'business.user.id'
TENANT_ID: 'business.tenant.id'
ORGANIZATION_ID: 'business.organization.id'
SESSION_ID: 'business.session.id'

// Authentication & Authorization
AUTH_METHOD: 'business.auth.method'
AUTH_RESULT: 'business.auth.result'
AUTH_DURATION: 'business.auth.duration_ms'
AUTH_ROLE: 'business.auth.role'
AUTH_PERMISSIONS: 'business.auth.permissions'

// Metrics Processing
METRICS_TYPE: 'business.metrics.type'
METRICS_BATCH_SIZE: 'business.metrics.batch_size'
METRICS_PROCESSING_STAGE: 'business.metrics.processing_stage'

// Cache Operations
CACHE_OPERATION: 'business.cache.operation'
CACHE_HIT_RATIO: 'business.cache.hit_ratio'
CACHE_KEY_PATTERN: 'business.cache.key_pattern'

// External APIs
API_EXTERNAL_SERVICE: 'business.api.external_service'
API_RESPONSE_TIME: 'business.api.response_time_ms'
API_CIRCUIT_BREAKER_STATE: 'business.api.circuit_breaker_state'

// WebSocket & Real-time
WEBSOCKET_CONNECTION_ID: 'business.websocket.connection_id'
WEBSOCKET_EVENT_TYPE: 'business.websocket.event_type'
```

## Usage Examples

### 1. Authentication Flow Instrumentation

```typescript
import { InstrumentedJWTService } from './services/jwt.service.instrumented';

// Instrument token generation
const tokenPair = await jwtService.generateTokenPair({
  user_id: 'user123',
  organization_id: 'org456',
  email: 'user@example.com',
  role: 'admin'
});

// Instrument token verification
const payload = await jwtService.verifyAccessToken(token);

// Check permissions with detailed tracing
const hasPermission = jwtService.hasPermission(
  payload, 
  'metrics', 
  'read', 
  { team_ids: ['team1'] }
);
```

### 2. Metrics Processing Pipeline

```typescript
import { InstrumentedMetricsProcessingService } from './services/metrics-processing.service.instrumented';

// Process metrics with full pipeline instrumentation
await metricsProcessor.publishMetricsEvent({
  type: 'command_execution',
  organization_id: 'org123',
  user_id: 'user456',
  timestamp: new Date(),
  data: {
    command_name: 'generate-report',
    execution_time_ms: 1500,
    status: 'success'
  }
});
```

### 3. Database Operations

```typescript
import { InstrumentedDatabaseConnection } from './database/connection.instrumented';

// Query with business context
const result = await dbConnection.query(
  'SELECT * FROM metrics WHERE organization_id = $1',
  [organizationId],
  {
    name: 'get_organization_metrics',
    context: { 
      tenantId: organizationId,
      operationType: 'metrics_query' 
    }
  }
);

// Transaction with instrumentation
await dbConnection.transaction(async (client) => {
  await client.query('INSERT INTO audit_log ...');
  await client.query('UPDATE user_stats ...');
}, {
  isolationLevel: 'REPEATABLE READ',
  context: { tenantId: organizationId }
});
```

### 4. Cache Operations

```typescript
import { InstrumentedRedisManager } from './config/redis.config.instrumented';

// Cache with pattern tracking
await redisManager.set(
  `user_session:${userId}`,
  sessionData,
  {
    ttl: 3600,
    context: { tenantId: organizationId },
    keyPattern: 'user_session:*'
  }
);

// Get with hit/miss tracking
const userData = await redisManager.get(
  `user_data:${userId}`,
  {
    context: { tenantId: organizationId },
    keyPattern: 'user_data:*'
  }
);
```

### 5. WebSocket Communications

```typescript
import { InstrumentedWebSocketService } from './services/websocket.service.instrumented';

// Broadcast with event tracking
await wsService.broadcastEvent(
  'metrics/updated',
  {
    organization_id: organizationId,
    metrics_count: 50,
    update_type: 'real_time'
  },
  {
    organizations: [organizationId]
  }
);
```

### 6. External API Calls

```typescript
import { InstrumentedExternalApiService } from './services/external-api.service.instrumented';

// API call with circuit breaker and retry logic
const userData = await externalApiService.get(
  '/users/profile',
  {
    serviceName: 'user_service',
    timeout: 5000,
    retries: 3,
    context: { tenantId: organizationId },
    circuitBreaker: true
  }
);

// Process webhook with signature validation
await externalApiService.processWebhook({
  id: 'webhook123',
  type: 'user.updated',
  source: 'external_system',
  timestamp: new Date(),
  data: webhookData,
  signature: 'sha256=...',
  organizationId: organizationId
});
```

## Custom Instrumentation Patterns

### 1. Method Decoration

```typescript
import { InstrumentMethod, OperationType } from '../tracing/business-instrumentation';

class MetricsService {
  @InstrumentMethod(OperationType.METRICS_PROCESSING, 'process_batch')
  async processBatch(metrics: any[]): Promise<void> {
    // Method automatically instrumented
    // Span created with operation type and method name
  }
}
```

### 2. Manual Span Creation

```typescript
import { getBusinessInstrumentation, BusinessContext } from '../tracing/business-instrumentation';

const instrumentation = getBusinessInstrumentation();

const result = await instrumentation.createBusinessSpan(
  'custom_operation',
  OperationType.BUSINESS_LOGIC,
  async (span) => {
    span.setAttributes({
      'custom.attribute': 'value',
      'operation.complexity': 'high'
    });
    
    // Your business logic here
    return await processData();
  },
  context
);
```

### 3. Authentication-Specific Instrumentation

```typescript
const result = await instrumentation.instrumentAuthentication(
  'oauth_login',
  async (span) => {
    span.setAttributes({
      'auth.provider': 'google',
      'auth.scope': 'profile email'
    });
    
    return await processOAuthLogin();
  },
  context
);
```

### 4. Cache-Specific Instrumentation

```typescript
const data = await instrumentation.instrumentCacheOperation(
  'get',
  'user_preferences:*',
  async (span) => {
    const result = await cache.get(key);
    
    span.setAttributes({
      'cache.size_bytes': result ? JSON.stringify(result).length : 0
    });
    
    return result;
  },
  context
);
```

## Metrics Collection

### Built-in Metrics

The instrumentation automatically collects these business metrics:

- `business_operations_total` - Counter of all business operations
- `business_operation_duration_ms` - Histogram of operation durations
- `business_errors_total` - Counter of business errors by category
- `business_cache_operations_total` - Counter of cache operations
- `business_auth_operations_total` - Counter of authentication operations

### Custom Metrics

```typescript
// Record custom business metric
instrumentation.recordBusinessMetric(
  'user_signup_completed',
  1,
  {
    registration_method: 'email',
    tenant_id: organizationId,
    user_role: 'developer'
  }
);
```

## Performance Categorization

Operations are automatically categorized by performance:

- **Fast**: < 100ms
- **Normal**: 100ms - 1s  
- **Slow**: 1s - 5s
- **Very Slow**: > 5s

## Error Classification

Errors are automatically categorized:

- **Authentication**: Auth failures, token issues
- **Authorization**: Permission denials, RBAC violations
- **Validation**: Input validation failures
- **Business Logic**: Application-specific errors
- **External Service**: Third-party API failures
- **Infrastructure**: Database, cache, network issues
- **Rate Limit**: Throttling and quota exceeded
- **Timeout**: Operation timeouts
- **Network**: Connectivity issues

## Circuit Breaker Integration

### Configuration

```typescript
const externalApiService = new InstrumentedExternalApiService({
  baseUrl: 'https://api.external-service.com',
  timeout: 5000,
  retries: 3,
  retryDelay: 1000,
  circuitBreaker: {
    failureThreshold: 5,      // Open after 5 failures
    resetTimeout: 30000,      // Try again after 30 seconds
    monitoringPeriod: 60000   // Reset failure count every minute
  }
});
```

### States

- **Closed**: Normal operation, requests flow through
- **Open**: Circuit breaker activated, requests fail fast
- **Half-Open**: Testing if service recovered, limited requests allowed

## Multi-Tenant Context

All instrumentation includes multi-tenant context:

```typescript
const context: BusinessContext = {
  userId: 'user123',
  tenantId: 'tenant456', 
  organizationId: 'org789',
  sessionId: 'session_abc'
};
```

This ensures proper data isolation and tenant-specific metrics.

## Health Checks

All instrumented services provide health check endpoints:

```typescript
// Database health
const dbHealth = await dbConnection.healthCheck();

// Cache health  
const cacheHealth = await redisManager.healthCheck();

// External API health
const apiHealth = await externalApiService.healthCheck();

// Metrics processing health
const processingHealth = await metricsProcessor.healthCheck();
```

## Best Practices

### 1. Context Propagation

Always pass business context through the call chain:

```typescript
async function processUserRequest(userId: string, organizationId: string) {
  const context: BusinessContext = {
    userId,
    organizationId,
    tenantId: organizationId,
    sessionId: generateSessionId()
  };
  
  // Pass context to all instrumented operations
  await authenticateUser(context);
  await processMetrics(context);
  await updateCache(context);
}
```

### 2. Meaningful Span Names

Use descriptive, hierarchical span names:

```typescript
// Good
'auth.verify_token'
'metrics.process_batch'
'cache.update_user_session'
'external_api.sync_user_data'

// Avoid
'operation'
'process'
'call'
```

### 3. Balanced Attribute Granularity

Include relevant business context without over-instrumenting:

```typescript
// Good - business relevant
span.setAttributes({
  'user.role': 'admin',
  'metrics.batch_size': 100,
  'cache.hit_ratio': 0.85,
  'api.circuit_breaker_state': 'closed'
});

// Avoid - too granular or sensitive
span.setAttributes({
  'user.password_hash': '...', // Sensitive
  'sql.query_parameters': '...', // Too detailed
  'cache.redis_internal_stats': '...' // Implementation detail
});
```

### 4. Error Handling

Ensure errors are properly categorized and recoverable status is indicated:

```typescript
try {
  await operation();
} catch (error) {
  span.setAttributes({
    'error.category': categorizeError(error),
    'error.recoverable': isRecoverableError(error),
    'error.retry_after_ms': getRetryDelay(error)
  });
  
  throw error;
}
```

### 5. Performance Monitoring

Set performance budgets and alert on violations:

```typescript
// Set performance expectations
span.setAttributes({
  'performance.budget_ms': 200,
  'performance.critical_path': true
});

// Log slow operations
if (duration > 1000) {
  logger.warn('Slow operation detected', {
    operation: spanName,
    duration_ms: duration,
    performance_tier: 'slow'
  });
}
```

## Troubleshooting

### Common Issues

1. **Missing Context**: Ensure business context is passed through all layers
2. **Span Not Created**: Check that instrumentation is properly initialized
3. **Attributes Not Appearing**: Verify attribute names match semantic conventions
4. **High Cardinality**: Avoid dynamic attribute values that create too many unique combinations
5. **Performance Impact**: Monitor instrumentation overhead, aim for <5% impact

### Debug Mode

Enable debug logging to troubleshoot instrumentation:

```typescript
const instrumentation = new BusinessInstrumentation({
  enableDebugLogs: true,
  enableMetrics: true,
  enableTraces: true
});
```

### Validation

Use the health check endpoints to validate instrumentation is working:

```typescript
// Check all instrumented services
const health = {
  database: await dbConnection.healthCheck(),
  cache: await redisManager.healthCheck(),
  external_apis: await externalApiService.healthCheck(),
  metrics_processing: await metricsProcessor.healthCheck()
};

console.log('Instrumentation Health:', health);
```

## Integration with Observability Stack

### SignOz Dashboard

Create custom dashboards using the business attributes:

- **Authentication Dashboard**: Track login success rates, token validation times
- **Metrics Processing Dashboard**: Monitor pipeline throughput, processing latency
- **Cache Performance Dashboard**: Hit ratios, response times by key pattern
- **External Service Dashboard**: API response times, circuit breaker status
- **Business Operations Dashboard**: Operation counts, error rates by category

### Alerting Rules

Set up alerts based on business metrics:

```yaml
# High authentication failure rate
- alert: HighAuthFailureRate
  expr: rate(business_auth_operations_total{result="failure"}[5m]) > 0.1
  
# Low cache hit ratio  
- alert: LowCacheHitRatio
  expr: business_cache_hit_ratio < 0.7

# Circuit breaker open
- alert: CircuitBreakerOpen
  expr: business_api_circuit_breaker_state{state="open"} > 0

# Slow metrics processing
- alert: SlowMetricsProcessing
  expr: histogram_quantile(0.95, business_operation_duration_ms{operation_type="metrics_processing"}) > 5000
```

This instrumentation provides comprehensive visibility into business operations while maintaining performance and following OpenTelemetry best practices.