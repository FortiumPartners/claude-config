# OpenTelemetry Integration Documentation

**Task 2.1: OTEL SDK Basic Configuration (Sprint 2)**

## Overview

This document describes the OpenTelemetry (OTEL) integration implemented for the Fortium Monitoring Web Service. The implementation provides comprehensive observability while maintaining parallel operation with existing Seq logging and preserving backward compatibility.

## Key Features

- **🚀 Zero Breaking Changes**: Existing functionality remains intact
- **🔄 Parallel Operation**: OTEL runs alongside Seq without interference  
- **⚡ Performance Optimized**: <5ms additional latency per request
- **🎛️ Feature Flag Controls**: Gradual rollout capabilities
- **📊 Comprehensive Monitoring**: Traces, metrics, and logs correlation

## Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Express Application                       │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────┐               │
│  │ Correlation     │    │ OTEL           │               │
│  │ Middleware      │◄──►│ Middleware      │               │
│  │ (existing)      │    │ (new)           │               │
│  └─────────────────┘    └─────────────────┘               │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────┐               │
│  │ Seq Transport   │    │ OTEL SDK        │               │
│  │ (existing)      │    │ (new)           │               │
│  │                 │    │                 │               │
│  │ ┌─────────────┐ │    │ ┌─────────────┐ │               │
│  │ │ Winston     │ │    │ │ Traces      │ │               │
│  │ │ Logger      │ │    │ │ Metrics     │ │               │
│  │ └─────────────┘ │    │ │ Auto-Instr. │ │               │
│  └─────────────────┘    │ └─────────────┘ │               │
│                         └─────────────────┘               │
├─────────────────────────────────────────────────────────────┤
│              ┌─────────────────┐                           │
│              │ Configuration   │                           │
│              │ Management      │                           │
│              │ - Environment   │                           │
│              │ - Feature Flags │                           │
│              │ - Performance   │                           │
│              └─────────────────┘                           │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    External Systems                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │ Seq Server  │    │ SignOz      │    │ Prometheus  │     │
│  │ (existing)  │    │ (OTLP)      │    │ (metrics)   │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

## Configuration

### Environment Variables

```bash
# Feature Flag Controls
OTEL_ENABLED=false                    # Master switch for gradual rollout
OTEL_SERVICE_NAME=fortium-monitoring-service
OTEL_SERVICE_VERSION=1.0.0
OTEL_SERVICE_NAMESPACE=fortium

# OTLP Exporter Configuration
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4318/v1/traces
OTEL_EXPORTER_OTLP_METRICS_ENDPOINT=http://localhost:4318/v1/metrics

# Sampling Configuration (environment-specific)
OTEL_TRACE_SAMPLE_RATE=1.0           # Dev: 1.0, Prod: 0.1 (auto-configured)

# Performance Tuning
OTEL_METRIC_EXPORT_INTERVAL=30000    # 30 seconds
OTEL_TRACE_TIMEOUT=10000             # 10 seconds

# Propagation
OTEL_PROPAGATORS=tracecontext,baggage,b3

# Prometheus Integration
OTEL_ENABLE_PROMETHEUS=true
OTEL_PROMETHEUS_PORT=9464
```

### Environment-Specific Configuration

#### Development
```bash
NODE_ENV=development
OTEL_ENABLED=true
OTEL_TRACE_SAMPLE_RATE=1.0           # 100% sampling
OTEL_ENABLE_PROMETHEUS=true
LOG_LEVEL=debug
```

#### Production
```bash
NODE_ENV=production
OTEL_ENABLED=false                   # Start disabled, enable gradually
OTEL_TRACE_SAMPLE_RATE=0.1          # 10% sampling (auto-configured)
OTEL_ENABLE_PROMETHEUS=true
LOG_LEVEL=info
```

## Feature Flags

The implementation uses a comprehensive feature flag system for gradual rollout:

```typescript
interface OTelFeatureFlags {
  enabled: boolean;              // Master switch
  tracing: boolean;              // Distributed tracing
  metrics: boolean;              // Metrics collection
  logs: boolean;                 // Log correlation
  autoInstrumentation: boolean;  // Auto-instrumentation
  manualInstrumentation: boolean; // Manual span creation
  prometheus: boolean;           // Prometheus metrics
  sampling: boolean;             // Trace sampling
}
```

### Environment-Specific Defaults

- **Test Environment**: All features disabled to avoid interference
- **Development**: All features enabled for testing
- **Production**: Conservative rollout with logs disabled initially

## Integration Points

### 1. Correlation Middleware Integration

OTEL integrates seamlessly with existing correlation middleware:

```typescript
// Existing correlation context is preserved and enhanced
const logContext: LogContext = {
  correlationId,           // From existing middleware
  sessionId,              // From existing middleware  
  traceId,                // Enhanced with OTEL trace ID
  spanId,                 // Enhanced with OTEL span ID
  // ... other existing fields
};
```

### 2. Winston Logger Enhancement

Existing Winston logs are enhanced with OTEL trace context:

```typescript
// Automatic trace correlation in logs
{
  "message": "User login successful",
  "correlationId": "abc123",           // Existing
  "otel.trace_id": "def456",          // New OTEL field
  "otel.span_id": "ghi789",           // New OTEL field
  "event": "auth.login"               // Existing
}
```

### 3. Health Check Enhancement

The existing health check endpoint now includes OTEL status:

```json
{
  "status": "healthy",
  "services": {
    "seq": {
      "status": "healthy",
      "url": "http://localhost:5341"
    },
    "opentelemetry": {
      "status": "healthy",
      "enabled": true,
      "features": {
        "tracing": true,
        "metrics": true,
        "logs": false
      },
      "endpoints": {
        "traces": "http://localhost:4318/v1/traces",
        "metrics": "http://localhost:4318/v1/metrics"
      }
    }
  }
}
```

## Performance Optimization

### Target: <5ms Additional Latency

The implementation is optimized to meet the TRD requirement of <5ms additional latency per request:

1. **Selective Instrumentation**: Only essential operations are traced
2. **Efficient Sampling**: Environment-specific sampling rates
3. **Async Exports**: Non-blocking metric and trace exports
4. **Connection Pooling**: Reused HTTP connections for exports
5. **Batch Processing**: Metrics exported in batches

### Performance Monitoring

```typescript
// Built-in performance tracking
export function recordPerformanceMetric(
  operation: string,
  duration: number,
  success: boolean,
  attributes?: Record<string, string | number | boolean>
) {
  // Automatic performance categorization
  if (duration > otelConfig.performance.slowRequestMs) {
    logger.warn(`Slow operation detected: ${operation}`, {
      event: 'otel.performance.slow_operation',
      operation,
      duration,
    });
  }
}
```

## Usage Examples

### Basic HTTP Request Tracing

```typescript
// Automatic via middleware - no code changes required
app.get('/api/v1/metrics', async (req, res) => {
  // Correlation and OTEL context automatically available
  req.logger.info('Processing metrics request', {
    correlationId: req.correlationId,
    // OTEL trace context automatically added
  });
  
  const result = await getMetrics();
  res.json(result);
});
```

### Manual Span Creation

```typescript
import { createCustomSpan } from '../tracing/otel-init';

// Manual instrumentation for critical operations
const result = await createCustomSpan(
  'database.complex_query',
  async () => {
    return await complexDatabaseQuery();
  },
  {
    'query.type': 'aggregation',
    'tenant.id': req.tenant?.id,
  }
);
```

### Database Operation Instrumentation

```typescript
import { instrumentDatabaseOperation } from '../middleware/otel.middleware';

// Automatic database operation tracing
const users = await instrumentDatabaseOperation(
  req,
  'select_users',
  () => userRepository.findMany()
);
```

### External API Call Tracing

```typescript
import { instrumentApiCall } from '../middleware/otel.middleware';

// Automatic external API call tracing
const response = await instrumentApiCall(
  req,
  'auth-service',
  'validate_token',
  () => authService.validateToken(token)
);
```

## Metrics Collection

### Automatic HTTP Metrics

```typescript
// Automatically collected HTTP metrics
fortium_http_request_duration       // Request duration histogram
fortium_http_requests_total         // Request counter
fortium_http_request_size_bytes     // Request size histogram

// Labels: method, status, route, success, tenant_id
```

### Custom Business Metrics

```typescript
import { recordMetric } from '../tracing/otel-init';

// Custom business metrics
recordMetric('user_login_attempts', 1, {
  'tenant.id': tenantId,
  'auth.method': 'jwt',
  'success': 'true',
});
```

## Troubleshooting

### Common Issues

#### 1. OTEL Not Initializing

**Symptom**: No traces or metrics appearing in SignOz
**Solution**: Check feature flags and environment configuration

```bash
# Check configuration
npm run otel:test

# Verify health endpoint
curl http://localhost:3000/health
```

#### 2. High Performance Impact

**Symptom**: Requests taking longer than expected
**Solution**: Check sampling rates and disable unnecessary features

```bash
# Reduce sampling in production
OTEL_TRACE_SAMPLE_RATE=0.01  # 1% sampling

# Disable tracing, keep metrics only
OTEL_ENABLED=true
# Modify otelConfig.featureFlags programmatically
```

#### 3. Missing Correlation Context

**Symptom**: OTEL traces not correlating with existing logs
**Solution**: Ensure correlation middleware runs before OTEL middleware

```typescript
// Correct order in app.ts
app.use(correlationMiddleware);  // First
app.use(otelMiddleware);         // Second
```

### Debugging Commands

```bash
# Run integration tests
npm run otel:test

# Check OTEL configuration
tsx scripts/test-otel-integration.ts

# Monitor performance impact
curl http://localhost:3000/health | jq '.services.opentelemetry.performance'

# Validate SignOz connectivity
curl -X POST http://localhost:4318/v1/traces \
  -H "Content-Type: application/json" \
  -d '{"resourceSpans": []}'
```

## Migration Guide

### Phase 1: Development Environment (Week 1)
```bash
# Enable OTEL in development
OTEL_ENABLED=true
OTEL_TRACE_SAMPLE_RATE=1.0

# Test full functionality
npm run otel:test
npm run test:integration
```

### Phase 2: Staging Environment (Week 2)
```bash
# Enable with reduced sampling
OTEL_ENABLED=true
OTEL_TRACE_SAMPLE_RATE=0.5

# Monitor performance impact
# Validate metrics collection
```

### Phase 3: Production Rollout (Week 3-4)
```bash
# Start with metrics only
OTEL_ENABLED=true
# otelConfig.featureFlags.tracing = false (programmatic)

# Gradually enable tracing with low sampling
OTEL_TRACE_SAMPLE_RATE=0.1
```

## Monitoring Dashboard

### Key Metrics to Track

1. **Performance Impact**
   - Average request latency increase
   - P95 latency impact
   - Memory usage increase

2. **OTEL Health**
   - Export success rate
   - Connection failures
   - Batch processing latency

3. **Business Metrics**
   - Request volume by endpoint
   - Error rates by service
   - User activity patterns

### SignOz Dashboard Setup

1. **Service Overview Dashboard**
   - Service map visualization
   - Request rate, error rate, latency (RED metrics)
   - Resource utilization

2. **Custom Metrics Dashboard**
   - Business KPIs
   - Performance trends
   - Error analysis

## Security Considerations

1. **Data Sanitization**: Sensitive data automatically redacted from traces
2. **Authentication**: OTLP endpoints secured in production
3. **Rate Limiting**: Export rate limiting to prevent resource exhaustion
4. **Network Security**: TLS encryption for OTLP exports

## Future Enhancements

1. **Enhanced Sampling**: Intelligent sampling based on error rates
2. **Log Integration**: Direct log export to OTEL (currently via Winston)
3. **Advanced Metrics**: Custom dashboards and alerting
4. **Multi-Region**: Distributed tracing across regions

## Support

For issues or questions:
1. Check the health endpoint: `GET /health`
2. Run diagnostics: `npm run otel:test`
3. Review logs for OTEL-related events
4. Consult the troubleshooting section above