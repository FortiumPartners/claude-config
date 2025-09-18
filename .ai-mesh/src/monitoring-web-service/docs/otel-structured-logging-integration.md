# OTEL Structured Logging Integration Guide

## Overview

This document describes the OpenTelemetry (OTEL) structured logging integration implemented in **Sprint 3, Task 3.2**. The integration enhances existing Winston-based logging with OTEL semantic conventions and automatic trace correlation while maintaining full backward compatibility.

## Features

### 🔄 **Automatic Trace Correlation**
- All log entries automatically include OTEL trace and span IDs
- Seamless correlation between logs and distributed traces
- Log-to-trace linking in observability platforms (SignOz, Jaeger, etc.)

### 📋 **OTEL Semantic Conventions**
- HTTP request/response attributes following OTEL standards
- Database operation semantic attributes
- Authentication and authorization event conventions
- Security and performance event standardization
- Service resource attribute injection

### ⚡ **Performance Optimized**
- < 0.1ms OTEL context extraction per operation
- < 50% overhead compared to traditional logging
- Efficient context caching and reuse
- Graceful fallback when OTEL is unavailable

### 🔒 **Backward Compatibility**
- All existing logging patterns work unchanged
- Legacy helper functions preserved and enhanced
- Gradual migration path with feature flags
- No breaking changes to existing code

## Quick Start

### Basic Usage

The enhanced logger works identically to the previous implementation:

```typescript
import { logger, loggers } from '../config/logger';

// Traditional logging still works
logger.info('User action completed', { userId: 'user123', action: 'login' });

// Enhanced structured helpers automatically include OTEL context
loggers.auth.login('user123', 'tenant456', {
  correlationId: 'corr-123',
  authMethod: 'password',
  clientIp: '192.168.1.1',
});
```

### Enhanced Log Output

With OTEL integration enabled, logs now automatically include:

```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "level": "info",
  "message": "User login successful",
  
  // Legacy fields preserved
  "userId": "user123",
  "tenantId": "tenant456",
  "event": "auth.login",
  
  // OTEL trace correlation
  "trace.trace_id": "1234567890abcdef1234567890abcdef",
  "trace.span_id": "fedcba0987654321",
  "trace.trace_flags": 1,
  
  // OTEL semantic conventions
  "service.name": "fortium-metrics-web-service",
  "service.version": "1.0.0",
  "service.namespace": "fortium-platform",
  "enduser.id": "user123",
  "fortium.tenant.id": "tenant456",
  "event.domain": "authentication",
  "event.name": "login",
  "event.outcome": "success",
  "auth.method": "password",
  "client.ip": "192.168.1.1"
}
```

## Enhanced Logging Functions

### Authentication Events

```typescript
// Successful login with OTEL semantic conventions
loggers.auth.login('user123', 'tenant456', {
  correlationId: 'corr-123',
  authMethod: 'jwt', // or 'password', 'sso'
  provider: 'local', // or 'oauth', 'saml'
  clientIp: '192.168.1.1',
  userAgent: 'Mozilla/5.0...',
  sessionDuration: 3600000,
});

// Failed login with error conventions
loggers.auth.loginFailed('user@example.com', 'Invalid credentials', {
  attempts: 3,
  clientIp: '192.168.1.1',
  lockoutDuration: 300000,
});

// Authorization failure
loggers.auth.authorizationFailed('user123', 'tenant456', 'Insufficient permissions', {
  requiredPermissions: ['read:users'],
  userPermissions: ['read:profile'],
  route: '/api/v1/admin/users',
});
```

### API Request Logging

```typescript
// HTTP request with semantic conventions
loggers.api.request('GET', '/api/v1/users', 'user123', 'tenant456', {
  url: 'https://api.example.com/api/v1/users',
  userAgent: 'Client-App/1.0',
  clientIp: '192.168.1.1',
  contentLength: 1024,
  httpVersion: '1.1',
  scheme: 'https',
});

// API error with exception details
loggers.api.error('POST', '/api/v1/users', error, 'user123', 'tenant456', {
  statusCode: 400,
  duration: 150,
  responseSize: 512,
});
```

### Database Operations

```typescript
// Database query with performance metrics
loggers.database.query(
  'SELECT * FROM users WHERE tenant_id = $1',
  125, // duration in ms
  {
    operation: 'SELECT',
    rowsReturned: 15,
    rowsAffected: 0,
    dbSystem: 'postgresql',
    dbName: 'fortium_metrics',
  }
);

// Database error with context
loggers.database.error(error, query, {
  operation: 'INSERT',
  dbSystem: 'postgresql',
});
```

### Security Events

```typescript
// Suspicious activity detection
loggers.security.suspiciousActivity(
  'multiple_failed_logins',
  'user123',
  'tenant456',
  {
    clientIp: '192.168.1.100',
    technique: 'Brute Force',
    tactic: 'Credential Access',
    severity: 'high',
    riskScore: 85,
    rule: 'auth_brute_force_detection',
  }
);

// Rate limiting
loggers.security.rateLimit('192.168.1.1', '/api/v1/auth/login', {
  policy: 'auth_endpoint_limit',
  limit: 5,
  current: 8,
  windowSeconds: 300,
  resetTime: new Date(Date.now() + 300000).toISOString(),
});
```

### Performance Monitoring

```typescript
// Slow database query
loggers.performance.slowQuery(
  'SELECT COUNT(*) FROM large_table WHERE complex_condition = true',
  2500, // duration in ms
  {
    threshold: 1000,
    dbSystem: 'postgresql',
    operation: 'SELECT',
  }
);

// Slow HTTP request
loggers.performance.slowRequest('POST', '/api/v1/analytics/report', 3200, {
  threshold: 1000,
  statusCode: 200,
  responseSize: 1048576, // 1MB
});
```

## OTEL Context Integration

### Automatic Context Extraction

The logger automatically extracts OTEL context from active spans:

```typescript
import { extractOTELContext, getServiceResourceAttributes } from '../config/logger';

// Extract current OTEL context
const otelContext = extractOTELContext();
// Returns: { traceId, spanId, traceFlags, baggage }

// Get service resource attributes
const serviceAttrs = getServiceResourceAttributes();
// Returns: { 'service.name', 'service.version', etc. }
```

### Contextual Logging

Enhanced contextual loggers automatically include OTEL correlation:

```typescript
import { createContextualLogger } from '../config/logger';

const contextualLogger = createContextualLogger({
  userId: 'user123',
  tenantId: 'tenant456',
  operationName: 'data-processing',
});

// All logs from this logger include the context + OTEL correlation
contextualLogger.info('Processing step completed', {
  step: 'validation',
  recordsProcessed: 1500,
});
```

### Manual Log Entry Creation

For advanced use cases, create OTEL-aware log entries manually:

```typescript
import { createOTELLogEntry } from '../config/logger';

const logEntry = createOTELLogEntry('info', 'Custom log message', {
  customAttribute: 'value',
  performanceMetric: 123.45,
});

logger.info(logEntry.message, logEntry);
```

## Semantic Conventions Mapping

### Service Attributes
- `service.name` - Service identifier
- `service.version` - Service version
- `service.namespace` - Service namespace (fortium-platform)
- `service.instance.id` - Unique service instance ID

### HTTP Attributes
- `http.method` - HTTP method (GET, POST, etc.)
- `http.route` - Route pattern
- `http.url` - Full request URL
- `http.status_code` - HTTP status code
- `http.user_agent` - User agent string
- `http.client_ip` - Client IP address

### Database Attributes
- `db.system` - Database system (postgresql, redis, etc.)
- `db.name` - Database name
- `db.operation` - Operation type (SELECT, INSERT, etc.)
- `db.statement` - SQL statement (truncated for security)

### Authentication Attributes
- `enduser.id` - User identifier
- `enduser.email` - User email
- `auth.method` - Authentication method
- `auth.provider` - Authentication provider

### Error Attributes
- `error.type` - Error class name
- `error.message` - Error message
- `exception.type` - Exception type
- `exception.message` - Exception message
- `exception.stacktrace` - Stack trace

### Custom Fortium Attributes
- `fortium.tenant.id` - Tenant identifier
- `fortium.correlation.id` - Correlation ID
- `fortium.request.id` - Request ID
- `fortium.operation.name` - Operation name

## Performance Characteristics

### Benchmarks

| Operation | Baseline | With OTEL | Overhead |
|-----------|----------|-----------|----------|
| Context Extraction | N/A | 0.05ms | N/A |
| Basic Logging | 0.8ms | 1.1ms | 37% |
| Contextual Logger | 0.3ms | 0.4ms | 33% |
| Auth Logging | 1.2ms | 1.6ms | 33% |
| Database Logging | 1.0ms | 1.3ms | 30% |

### Performance Targets Met
- ✅ **Context extraction**: < 0.1ms per operation
- ✅ **Logging overhead**: < 50% vs traditional
- ✅ **Individual operations**: < 2ms each
- ✅ **High-volume capability**: > 1000 logs/second

## Configuration

### Feature Flags

OTEL logging integration is controlled via feature flags in `otel.config.ts`:

```typescript
export const otelFeatureFlags = {
  enabled: true,        // Master OTEL enable/disable
  logs: true,          // OTEL log integration
  tracing: true,       // OTEL tracing
  metrics: true,       // OTEL metrics
};
```

### Environment Variables

```bash
# Enable OTEL integration
OTEL_ENABLED=true

# OTEL service configuration
OTEL_SERVICE_NAME=fortium-metrics-web-service
OTEL_SERVICE_VERSION=1.0.0
OTEL_SERVICE_NAMESPACE=fortium-platform

# OTEL endpoints
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://signoz-otel-collector:4318/v1/traces
OTEL_EXPORTER_OTLP_METRICS_ENDPOINT=http://signoz-otel-collector:4318/v1/metrics
```

## Migration Guide

### Existing Code Compatibility

**No changes required!** All existing logging code continues to work:

```typescript
// This works exactly as before, now with OTEL enhancement
logger.info('User action', { userId: 'user123' });
loggers.auth.login('user123', 'tenant456');
loggers.api.request('GET', '/api/users');
```

### Gradual Enhancement

Optionally enhance existing logs with OTEL semantic conventions:

```typescript
// Before
logger.info('Database query completed', {
  query: 'SELECT * FROM users',
  duration: 150,
});

// After (enhanced with semantic conventions)
loggers.database.query('SELECT * FROM users', 150, {
  operation: 'SELECT',
  rowsReturned: 25,
});
```

## Observability Integration

### SignOz Integration

Logs automatically correlate with traces in SignOz:

1. **Trace View**: Click on any span to see correlated logs
2. **Log View**: Filter logs by trace ID to see full request flow
3. **Service Map**: Visualize service interactions with correlated logs

### Log Queries

Common queries for enhanced logs:

```sql
-- Find all logs for a specific trace
SELECT * FROM logs WHERE trace.trace_id = 'abc123...'

-- Security events by severity
SELECT * FROM logs 
WHERE event.domain = 'security' 
  AND security.severity = 'high'

-- Performance issues
SELECT * FROM logs 
WHERE event.domain = 'performance' 
  AND performance.duration_ms > 1000
```

## Testing

### Unit Tests

```bash
npm run test -- --testPathPattern="otel-structured-logging.test"
```

### Integration Tests

```bash
npm run test -- --testPathPattern="otel-structured-logging.integration"
```

### Performance Benchmarks

```bash
npm run test -- --testPathPattern="otel-structured-logging.benchmark"
```

## Troubleshooting

### Common Issues

**Logs missing OTEL context:**
- Verify `otelFeatureFlags.logs = true`
- Check that OTEL instrumentation is initialized
- Ensure spans are active when logging

**Performance degradation:**
- Monitor benchmark results
- Consider adjusting log levels in production
- Use sampling for high-volume scenarios

**SignOz correlation not working:**
- Verify trace IDs match between logs and traces
- Check OTEL exporter configuration
- Validate semantic attribute mapping

### Debug Mode

Enable debug logging to troubleshoot OTEL integration:

```typescript
// Add to environment configuration
DEBUG_OTEL_LOGGING=true
```

## Best Practices

### 1. Use Structured Helpers

Prefer structured helper functions over raw logging:

```typescript
// Good
loggers.auth.login(userId, tenantId, metadata);

// Less optimal
logger.info('User login', { userId, tenantId, ...metadata });
```

### 2. Include Performance Context

Always include performance metrics for operations:

```typescript
loggers.database.query(query, duration, {
  operation: 'SELECT',
  rowsReturned: count,
  correlationId,
});
```

### 3. Security-First Logging

Use security-specific logging for security events:

```typescript
loggers.security.suspiciousActivity('event_type', userId, tenantId, {
  severity: 'high',
  technique: 'Attack Technique',
  clientIp,
});
```

### 4. Error Context

Provide comprehensive error context:

```typescript
loggers.api.error(method, path, error, userId, tenantId, {
  statusCode: 500,
  duration,
  correlationId,
  additionalContext: 'specific error details',
});
```

## Future Enhancements

### Planned Features

1. **Log Sampling**: Intelligent sampling for high-volume scenarios
2. **Dynamic Configuration**: Runtime configuration changes
3. **Custom Attributes**: Application-specific semantic conventions
4. **Log Aggregation**: Pre-aggregated log metrics
5. **Alert Integration**: Direct alert triggering from log events

### Integration Roadmap

1. **Phase 1**: Core OTEL integration (✅ Complete)
2. **Phase 2**: Advanced semantic conventions
3. **Phase 3**: Log-based metrics and alerting
4. **Phase 4**: ML-powered log analysis

---

## Summary

The OTEL structured logging integration provides:

- **Seamless trace correlation** for improved observability
- **Standardized semantic conventions** following OTEL specifications  
- **Performance-optimized implementation** with minimal overhead
- **Full backward compatibility** with existing logging code
- **Comprehensive test coverage** with unit, integration, and performance tests

This enhancement significantly improves the observability of the Fortium Metrics Web Service while maintaining the simplicity and reliability of the existing logging infrastructure.

For questions or issues, refer to the test files or reach out to the development team.