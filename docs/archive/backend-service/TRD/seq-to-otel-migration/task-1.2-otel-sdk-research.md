# Task 1.2: OpenTelemetry SDK Integration Research

**TRD Reference**: Seq to OpenTelemetry + SignOz Migration  
**Duration**: 6 hours  
**Status**: ✅ COMPLETED  
**Completion Date**: 2025-09-11

## Executive Summary

This document provides comprehensive research and analysis for migrating from Seq structured logging to OpenTelemetry (OTEL) with SignOz backend. The analysis covers Node.js SDK options, migration impact assessment, configuration strategies, and implementation approach for zero-downtime deployment.

---

## 1. Node.js SDK Analysis (2h)

### 1.1 OpenTelemetry Node.js SDK Versions and Compatibility

#### Core Packages Analysis

| Package | Latest Version | LTS Status | Node.js Compatibility | Purpose |
|---------|---------------|------------|---------------------|---------|
| `@opentelemetry/api` | 1.7.0+ | ✅ Stable | Node.js ≥14 | Core API abstractions |
| `@opentelemetry/sdk-node` | 0.45.0+ | ✅ Stable | Node.js ≥14 | All-in-one SDK |
| `@opentelemetry/instrumentation` | 0.45.0+ | ✅ Stable | Node.js ≥14 | Auto-instrumentation framework |
| `@opentelemetry/exporter-trace-otlp-http` | 0.45.0+ | ✅ Stable | Node.js ≥14 | OTLP HTTP exporter |

**Recommended SDK Approach**: Use `@opentelemetry/sdk-node` as it provides unified initialization and reduces configuration complexity.

### 1.2 Auto-instrumentation vs Manual Instrumentation

#### Auto-instrumentation (Recommended)

**Advantages**:
- Zero-code changes for basic HTTP/Express instrumentation
- Automatic span creation for HTTP requests, database calls, and external APIs
- Consistent instrumentation across the application
- Reduced maintenance overhead

**Express.js Auto-instrumentation Packages**:
- `@opentelemetry/instrumentation-express` - HTTP request/response spans
- `@opentelemetry/instrumentation-http` - Core HTTP instrumentation
- `@opentelemetry/instrumentation-winston` - Winston log correlation
- `@opentelemetry/instrumentation-pg` - PostgreSQL queries (if using raw pg driver)

**Current System Compatibility**:
- ✅ Express.js 4.18.2 (fully supported)
- ✅ Winston 3.11.0 (supported with instrumentation package)
- ✅ Node.js 18+ (current project requirement)

#### Manual Instrumentation

**Use Cases**:
- Custom business logic spans
- Fine-grained control over span attributes
- Complex correlation scenarios
- Performance-critical paths requiring optimization

**Implementation Pattern**:
```typescript
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('fortium-metrics-service');

export function instrumentOperation<T>(
  name: string,
  operation: (span: Span) => Promise<T>
): Promise<T> {
  return tracer.startActiveSpan(name, async (span) => {
    try {
      const result = await operation(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      throw error;
    } finally {
      span.end();
    }
  });
}
```

---

## 2. Migration Impact Assessment (2h)

### 2.1 Current System Analysis

#### 2.1.1 seq-transport.ts Analysis

**Key Features to Preserve**:
- ✅ Batch processing (100 logs, 5-30s intervals)
- ✅ Circuit breaker pattern (5 failures → 30s timeout)
- ✅ Performance metrics tracking
- ✅ Health check capabilities
- ✅ Retry logic with exponential backoff

**Migration Strategy**:
- **Parallel Logging**: Keep existing Seq transport while adding OTEL spans
- **Feature Mapping**: Circuit breaker → OTEL exporter retry configuration
- **Metrics Mapping**: Performance metrics → OTEL metric instruments

#### 2.1.2 correlation.middleware.ts Analysis

**Current Correlation Fields**:
```typescript
interface LogContext {
  correlationId?: string;    // → OTEL trace.id
  sessionId?: string;        // → span.attributes['session.id']
  userId?: string;           // → span.attributes['user.id']
  tenantId?: string;         // → span.attributes['tenant.id']
  traceId?: string;          // → OTEL trace.id (if different)
  spanId?: string;           // → OTEL span.id
  requestId?: string;        // → span.attributes['request.id']
  operationName?: string;    // → span.name
  parentSpanId?: string;     // → OTEL parent span context
}
```

**Migration Impact**: 
- **Low Risk**: Direct mapping to OTEL semantic conventions
- **Enhancement**: Better span hierarchy through OTEL context propagation
- **Compatibility**: Maintain existing correlation headers for external systems

#### 2.1.3 Winston Integration Points

**Current Usage**:
- Custom Seq transport for structured logging
- Contextual loggers with correlation metadata
- Performance and security event logging
- Structured event types (auth, api, database, security, performance)

**OTEL Integration Strategy**:
- Use `@opentelemetry/instrumentation-winston` for automatic log-trace correlation
- Transform log events to OTEL span events
- Preserve structured logging for non-trace data
- Implement log-to-span attribute mapping

### 2.2 Code Sections Requiring Modification

#### High Priority Changes

1. **src/config/logger.ts** (Major Changes)
   - Add OTEL SDK initialization
   - Configure trace-log correlation
   - Maintain Winston for non-trace logging

2. **src/middleware/correlation.middleware.ts** (Moderate Changes)
   - Replace manual correlation with OTEL context propagation
   - Maintain backward compatibility with headers
   - Add OTEL span creation for request lifecycle

3. **src/app.ts** (Minor Changes)
   - Initialize OTEL SDK before other imports
   - Add OTEL health check endpoints
   - Configure OTLP exporters

#### Medium Priority Changes

4. **Database Operations** (New Implementation)
   - Instrument Prisma operations with manual spans
   - Add database performance tracking
   - Correlate slow query detection

5. **External API Calls** (New Implementation)
   - Auto-instrument HTTP clients
   - Add service dependency mapping
   - Track external service health

#### Low Priority Changes

6. **Performance Tracking** (Enhancement)
   - Replace custom performance decorators
   - Use OTEL metrics for business KPIs
   - Enhance error tracking with span exceptions

---

## 3. Configuration Strategy (1h)

### 3.1 OTEL Configuration Structure

#### Multi-Environment Configuration

```typescript
// src/config/telemetry.config.ts
interface TelemetryConfig {
  enabled: boolean;
  serviceName: string;
  serviceVersion: string;
  environment: string;
  traces: {
    exporters: ExporterConfig[];
    sampling: SamplingConfig;
    processors: ProcessorConfig[];
  };
  logs: {
    enabled: boolean;
    level: string;
    correlation: boolean;
  };
  metrics: {
    enabled: boolean;
    interval: number;
    exporters: ExporterConfig[];
  };
}

const telemetryConfigs = {
  development: {
    enabled: true,
    serviceName: 'fortium-metrics-web-service',
    serviceVersion: '1.0.0',
    environment: 'development',
    traces: {
      exporters: [
        { type: 'console', enabled: true },
        { type: 'otlp-http', endpoint: 'http://localhost:4318/v1/traces', enabled: false }
      ],
      sampling: { type: 'always' },
      processors: [{ type: 'batch', maxExportBatchSize: 100, maxQueueSize: 2048 }]
    }
  },
  production: {
    enabled: true,
    serviceName: 'fortium-metrics-web-service',
    serviceVersion: process.env.SERVICE_VERSION || '1.0.0',
    environment: 'production',
    traces: {
      exporters: [
        { type: 'otlp-http', endpoint: process.env.SIGNOZ_ENDPOINT, headers: { 'signoz-access-token': process.env.SIGNOZ_TOKEN } }
      ],
      sampling: { type: 'parent-based-trace-id-ratio', ratio: 0.1 },
      processors: [{ type: 'batch', maxExportBatchSize: 512, maxQueueSize: 8192 }]
    }
  }
};
```

### 3.2 Resource Attributes and Semantic Conventions

#### Service Identification
```typescript
const resourceAttributes = {
  [SemanticResourceAttributes.SERVICE_NAME]: 'fortium-metrics-web-service',
  [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
  [SemanticResourceAttributes.SERVICE_INSTANCE_ID]: process.env.HOSTNAME || 'local',
  [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV,
  
  // Custom business attributes
  'fortium.tenant.enabled': 'true',
  'fortium.feature.auth': 'jwt',
  'fortium.feature.multiTenant': 'true',
};
```

#### Span Attribute Conventions
```typescript
// HTTP requests
span.setAttributes({
  [SemanticAttributes.HTTP_METHOD]: req.method,
  [SemanticAttributes.HTTP_URL]: req.url,
  [SemanticAttributes.HTTP_STATUS_CODE]: res.statusCode,
  [SemanticAttributes.USER_ID]: req.logContext.userId,
  'fortium.tenant.id': req.logContext.tenantId,
  'fortium.correlation.id': req.logContext.correlationId,
});
```

### 3.3 Trace Sampling Configuration

#### Sampling Strategies

1. **Development**: Always sample (100%)
2. **Staging**: Parent-based with 50% ratio
3. **Production**: Parent-based with 10% ratio + head sampling for errors

```typescript
const samplingConfig = {
  development: new AlwaysOnSampler(),
  staging: new ParentBasedSampler({
    root: new TraceIdRatioBasedSampler(0.5)
  }),
  production: new ParentBasedSampler({
    root: new TraceIdRatioBasedSampler(0.1),
    localParentSampled: new AlwaysOnSampler(), // Keep full traces
    localParentNotSampled: new AlwaysOffSampler(),
  })
};
```

---

## 4. Implementation Approach (1h)

### 4.1 Incremental Migration Strategy

#### Phase 1: Parallel Logging (Week 1)
- ✅ Install and configure OTEL SDK
- ✅ Add basic HTTP instrumentation alongside existing Winston/Seq
- ✅ Implement trace-log correlation without changing current logging
- ✅ Add OTEL health checks and metrics endpoints

**Risk Level**: Low - No changes to existing functionality

#### Phase 2: Enhanced Correlation (Week 2)
- ✅ Replace manual correlation middleware with OTEL context propagation
- ✅ Maintain backward compatibility with correlation headers
- ✅ Add custom spans for business operations
- ✅ Implement database and external API instrumentation

**Risk Level**: Medium - Changes request flow but maintains compatibility

#### Phase 3: Seq Deprecation (Week 3)
- ✅ Gradually reduce Seq logging (feature flag controlled)
- ✅ Migrate structured event logging to OTEL spans/events
- ✅ Performance testing and optimization
- ✅ Complete switch to OTEL with fallback option

**Risk Level**: Medium - Removes existing logging infrastructure

#### Phase 4: Optimization (Week 4)
- ✅ Remove Seq transport and dependencies
- ✅ Optimize OTEL configuration for production
- ✅ Implement advanced features (custom metrics, advanced sampling)
- ✅ Documentation and team training

**Risk Level**: Low - Cleanup and optimization phase

### 4.2 Code Changes Required

#### 4.2.1 OTEL SDK Initialization

```typescript
// src/config/telemetry.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

export function initializeTelemetry(): NodeSDK {
  const traceExporter = new OTLPTraceExporter({
    url: config.telemetry.traces.exporters.otlp.endpoint,
    headers: config.telemetry.traces.exporters.otlp.headers,
  });

  return new NodeSDK({
    serviceName: config.telemetry.serviceName,
    serviceVersion: config.telemetry.serviceVersion,
    traceExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-express': { enabled: true },
        '@opentelemetry/instrumentation-http': { enabled: true },
        '@opentelemetry/instrumentation-winston': { enabled: true },
      })
    ],
  });
}
```

#### 4.2.2 Enhanced Correlation Middleware

```typescript
// src/middleware/otel-correlation.middleware.ts
import { trace, context, propagation } from '@opentelemetry/api';

export function otelCorrelationMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Extract or create trace context
  const activeContext = propagation.extract(context.active(), req.headers);
  
  const span = trace.getActiveSpan() || trace.getTracer('fortium-metrics-service').startSpan(
    `${req.method} ${req.route?.path || req.path}`,
    {
      kind: SpanKind.SERVER,
      attributes: {
        [SemanticAttributes.HTTP_METHOD]: req.method,
        [SemanticAttributes.HTTP_URL]: req.url,
        'fortium.tenant.id': req.headers['x-tenant-id'],
        'fortium.correlation.id': req.headers['x-correlation-id'],
      }
    },
    activeContext
  );

  // Maintain backward compatibility
  req.correlationId = req.headers['x-correlation-id'] || span.spanContext().traceId;
  req.traceId = span.spanContext().traceId;
  req.spanId = span.spanContext().spanId;

  // Continue with existing logic...
}
```

### 4.3 Testing Approach

#### 4.3.1 Unit Testing Strategy

```typescript
// Test OTEL instrumentation without external dependencies
describe('OTEL Integration', () => {
  let memoryExporter: InMemorySpanExporter;
  
  beforeEach(() => {
    memoryExporter = new InMemorySpanExporter();
    // Initialize test SDK with memory exporter
  });

  test('should create spans for HTTP requests', async () => {
    const response = await request(app).get('/api/v1/health');
    
    const spans = memoryExporter.getFinishedSpans();
    expect(spans).toHaveLength(1);
    expect(spans[0].name).toBe('GET /api/v1/health');
    expect(spans[0].attributes['http.method']).toBe('GET');
  });
});
```

#### 4.3.2 Integration Testing

```typescript
// Test end-to-end trace propagation
describe('Trace Propagation', () => {
  test('should propagate trace context across service boundaries', async () => {
    const traceId = '12345678901234567890123456789012';
    const spanId = '1234567890123456';
    
    const response = await request(app)
      .get('/api/v1/metrics')
      .set('traceparent', `00-${traceId}-${spanId}-01`);
    
    // Verify trace continuation in logs/spans
    expect(response.headers['x-trace-id']).toBe(traceId);
  });
});
```

### 4.4 Rollback Procedures

#### 4.4.1 Feature Flag Configuration

```typescript
// Environment variable controls
const MIGRATION_CONFIG = {
  OTEL_ENABLED: process.env.OTEL_ENABLED === 'true',
  SEQ_ENABLED: process.env.SEQ_ENABLED !== 'false', // Default to true
  DUAL_LOGGING: process.env.DUAL_LOGGING === 'true',
  OTEL_SAMPLING_RATIO: parseFloat(process.env.OTEL_SAMPLING_RATIO || '0.1'),
};

// Conditional initialization
if (MIGRATION_CONFIG.OTEL_ENABLED) {
  const sdk = initializeTelemetry();
  sdk.start();
}

if (MIGRATION_CONFIG.SEQ_ENABLED) {
  logger.add(createSeqTransport(seqConfig));
}
```

#### 4.4.2 Rollback Steps

1. **Immediate Rollback**: Set `OTEL_ENABLED=false` and restart services
2. **Partial Rollback**: Set `DUAL_LOGGING=true` to maintain both systems
3. **Configuration Rollback**: Revert to previous Docker images/K8s configs
4. **Data Recovery**: OTEL data preserved in SignOz, Seq data preserved in existing infrastructure

---

## 5. Risk Assessment and Mitigation

### 5.1 Technical Risks

| Risk | Probability | Impact | Mitigation Strategy |
|------|-------------|--------|-------------------|
| Performance degradation | Medium | High | Parallel deployment, performance testing, sampling optimization |
| Data loss during transition | Low | High | Dual logging approach, incremental migration |
| SignOz connectivity issues | Medium | Medium | Circuit breaker pattern, fallback to console logging |
| Correlation ID compatibility | Low | Medium | Backward compatibility layer, header propagation |

### 5.2 Business Risks

| Risk | Probability | Impact | Mitigation Strategy |
|------|-------------|--------|-------------------|
| Increased operational complexity | High | Medium | Comprehensive documentation, team training |
| Vendor lock-in to SignOz | Low | Medium | OTLP standard ensures portability |
| Additional infrastructure costs | Medium | Low | Cost analysis, resource optimization |

---

## 6. Success Criteria

### 6.1 Technical Metrics

- ✅ Zero data loss during migration
- ✅ Response time increase <5% (baseline: ~100-500ms)
- ✅ Memory usage increase <20% (baseline: ~100MB)
- ✅ 99.9% trace delivery success rate
- ✅ Full correlation ID backward compatibility

### 6.2 Operational Metrics

- ✅ Complete migration within 4 weeks
- ✅ Zero production incidents related to migration
- ✅ Team proficiency with OTEL within 2 weeks
- ✅ SignOz dashboard parity with existing Seq queries

---

## 7. Recommendations

### 7.1 Immediate Actions (This Sprint)

1. **Install Dependencies**: Add OTEL packages to package.json
2. **Basic Integration**: Implement minimal OTEL SDK initialization
3. **Parallel Logging**: Deploy with both Seq and OTEL enabled
4. **Testing**: Create test suite for trace generation and validation

### 7.2 Next Sprint Actions

1. **Enhanced Correlation**: Replace correlation middleware
2. **Custom Instrumentation**: Add business logic spans
3. **Performance Testing**: Load test with OTEL enabled
4. **SignOz Configuration**: Set up production SignOz instance

### 7.3 Technical Debt Considerations

- **Seq Transport Removal**: Plan for clean removal after 4 weeks
- **Winston Optimization**: Consider replacing with OTEL logging
- **Custom Metrics**: Migrate performance metrics to OTEL metrics API
- **Documentation**: Update all logging/monitoring documentation

---

## 8. Package Dependencies

### 8.1 Required OTEL Packages

```json
{
  "dependencies": {
    "@opentelemetry/api": "^1.7.0",
    "@opentelemetry/sdk-node": "^0.45.0",
    "@opentelemetry/exporter-trace-otlp-http": "^0.45.0",
    "@opentelemetry/instrumentation-express": "^0.34.0",
    "@opentelemetry/instrumentation-http": "^0.45.0",
    "@opentelemetry/instrumentation-winston": "^0.34.0",
    "@opentelemetry/semantic-conventions": "^1.17.0"
  },
  "devDependencies": {
    "@opentelemetry/sdk-memory-exporter": "^0.45.0"
  }
}
```

### 8.2 Optional Enhancement Packages

```json
{
  "dependencies": {
    "@opentelemetry/instrumentation-pg": "^0.37.0",
    "@opentelemetry/instrumentation-redis-4": "^0.35.0",
    "@opentelemetry/metrics": "^1.17.0",
    "@opentelemetry/exporter-metrics-otlp-http": "^0.45.0"
  }
}
```

---

## 9. Timeline and Deliverables

### 9.1 Week 1: Foundation
- [ ] OTEL SDK research and package selection
- [ ] Basic SDK integration with auto-instrumentation
- [ ] Parallel logging implementation
- [ ] Initial performance benchmarks

### 9.2 Week 2: Enhancement
- [ ] Enhanced correlation middleware
- [ ] Custom business logic instrumentation
- [ ] Database and external API spans
- [ ] SignOz dashboard creation

### 9.3 Week 3: Migration
- [ ] Gradual Seq deprecation with feature flags
- [ ] Production deployment with monitoring
- [ ] Performance optimization and tuning
- [ ] Incident response procedures

### 9.4 Week 4: Completion
- [ ] Complete Seq removal
- [ ] Final optimization and cleanup
- [ ] Documentation and training
- [ ] Post-migration analysis

---

## 10. Conclusion

The migration from Seq to OpenTelemetry + SignOz is technically feasible with low risk when following an incremental approach. The existing Winston-based structured logging system provides a solid foundation for OTEL integration, with most correlation and performance tracking features mapping directly to OTEL concepts.

**Key Success Factors**:
1. **Parallel Deployment**: Maintain existing functionality while adding OTEL
2. **Incremental Migration**: Phase-based approach reduces risk and complexity
3. **Backward Compatibility**: Preserve existing correlation headers and APIs
4. **Performance Monitoring**: Continuous monitoring during migration phases

**Next Steps**:
1. Approve this research and implementation plan
2. Begin Phase 1 implementation with basic OTEL SDK integration
3. Set up development SignOz instance for testing
4. Create detailed implementation timeline with team capacity planning

---

**Document Status**: ✅ COMPLETED  
**Review Date**: 2025-09-11  
**Approved By**: [Pending Review]  
**Implementation Start**: [Pending Approval]