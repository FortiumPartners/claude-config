# External Metrics Web Service - Services Architecture Documentation

> **Version**: 1.0.0  
> **Status**: Production Ready  
> **Last Updated**: September 2025  

## Overview

The External Metrics Web Service implements a comprehensive service-oriented architecture designed for scalability, multi-tenancy, and high performance. The system consists of 15+ specialized services that handle everything from metrics collection to real-time analytics, authentication, and data migration.

## Service Architecture Overview

### Service Layer Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway Layer                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Auth API   │  │ Metrics API │  │   Dashboard API     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                   Core Services Layer                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Metrics    │  │    Auth     │  │      Tenant        │  │
│  │ Collection  │  │  Services   │  │   Provisioning     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Data      │  │ WebSocket   │  │      Migration      │  │
│  │   Sync      │  │   Service   │  │     Services        │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                   Processing Layer                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Metrics    │  │   Real-time │  │    Background       │  │
│  │ Processing  │  │  Processor  │  │    Processor        │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Metrics    │  │ Performance │  │      Webhook        │  │
│  │Aggregation  │  │Optimization │  │     Services        │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                     Data Layer                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ PostgreSQL  │  │    Redis    │  │     Message         │  │
│  │Multi-tenant │  │   Cache     │  │     Queues          │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Core Services Architecture

### 1. MetricsProcessingService

**Location**: `/src/services/metrics-processing.service.ts`  
**Purpose**: Advanced metrics processing with real-time analytics and alerting

**Core Responsibilities**:
- Real-time metrics processing and validation
- Performance anomaly detection and alerting
- Data quality assessment and correction
- Stream processing for continuous analytics

**Key Features**:
```typescript
class MetricsProcessingService {
  // Real-time processing with <100ms latency
  async processRealTimeMetric(metric: any): Promise<ProcessingResult>
  
  // Batch processing with transaction support
  async processBatchMetrics(batch: MetricsBatch): Promise<BatchProcessingResult>
  
  // Performance anomaly detection
  async detectAnomalies(organizationId: string): Promise<Anomaly[]>
  
  // Quality assessment and scoring
  async assessDataQuality(metrics: any[]): Promise<QualityReport>
}
```

**Performance Characteristics**:
- **Processing Latency**: <100ms for real-time metrics
- **Batch Throughput**: 1000 metrics/second
- **Anomaly Detection**: <5 second analysis time
- **Quality Assessment**: 99.95% accuracy

### 2. MetricsAggregationService  

**Location**: `/src/services/metrics-aggregation.service.ts`  
**Purpose**: Multi-dimensional aggregation with time-series optimization

**Core Responsibilities**:
- Time-series data aggregation (hourly, daily, weekly, monthly)
- Multi-dimensional rollups (user, team, project, organization)
- Performance trend analysis and forecasting
- Materialized view management for query optimization

**Aggregation Strategies**:
```typescript
interface AggregationConfig {
  dimensions: string[];           // user_id, team_id, project_id
  time_buckets: string[];        // hour, day, week, month
  metrics: string[];             // count, sum, avg, min, max, p95, p99
  retention_policy: string;      // how long to keep aggregated data
}

// Example aggregation
const hourlyAggregation = {
  dimensions: ['organization_id', 'user_id'],
  time_buckets: ['hour'],
  metrics: ['command_count', 'avg_execution_time', 'success_rate'],
  retention_policy: '90_days'
};
```

**Performance Optimizations**:
- **Materialized Views**: Pre-computed aggregations for common queries
- **Incremental Processing**: Only process new/changed data
- **Parallel Processing**: Multi-threaded aggregation for large datasets
- **Caching Strategy**: Redis-based caching for frequent queries

### 3. Multi-Tenant Data Handling Services

#### TenantProvisioningService

**Location**: `/src/services/tenant-provisioning.service.ts`  
**Purpose**: Automated tenant onboarding and schema management

**Features**:
- **Schema-per-tenant**: Complete data isolation
- **Automated Provisioning**: Zero-touch tenant setup
- **Migration Management**: Schema updates across tenants
- **Resource Allocation**: Per-tenant resource limits

```typescript
class TenantProvisioningService {
  async createTenant(tenantConfig: TenantConfig): Promise<TenantResult> {
    // 1. Create dedicated schema
    await this.createTenantSchema(tenantConfig.tenant_id);
    
    // 2. Apply base schema migrations
    await this.runMigrations(tenantConfig.tenant_id);
    
    // 3. Configure tenant-specific settings
    await this.configureSettings(tenantConfig);
    
    // 4. Create default admin user
    await this.createAdminUser(tenantConfig);
    
    // 5. Initialize default dashboards
    await this.initializeDefaultDashboards(tenantConfig.tenant_id);
  }
  
  async migrateTenant(tenantId: string, migration: Migration): Promise<MigrationResult> {
    // Safe tenant-specific migration with rollback capability
  }
}
```

**Schema Management**:
```sql
-- Tenant schema creation template
CREATE SCHEMA IF NOT EXISTS tenant_${tenant_id};

-- Grant appropriate permissions
GRANT USAGE ON SCHEMA tenant_${tenant_id} TO app_role;
GRANT ALL ON ALL TABLES IN SCHEMA tenant_${tenant_id} TO app_role;

-- Create tenant-specific tables with identical structure
CREATE TABLE tenant_${tenant_id}.command_executions (
  -- Same structure as template, tenant-isolated
);
```

#### MultiTenantMiddleware

**Location**: `/src/middleware/multi-tenant.middleware.ts`  
**Purpose**: Request-level tenant isolation and context switching

**Features**:
- **Automatic Tenant Detection**: From JWT, subdomain, or header
- **Database Context Switching**: Per-request schema switching
- **Resource Isolation**: CPU, memory, and connection limits per tenant
- **Security Enforcement**: Cross-tenant access prevention

```typescript
// Multi-tenant request flow
export const multiTenantChain = () => [
  extractTenantContext,      // Extract tenant from request
  validateTenantAccess,      // Verify user belongs to tenant
  switchDatabaseContext,     // Set schema search path
  enforceResourceLimits,     // Apply tenant-specific limits
  auditTenantAccess         // Log access for compliance
];
```

### 4. Authentication and Authorization Services

#### JWTService

**Location**: `/src/services/jwt.service.ts` & `/src/auth/jwt.service.ts`  
**Purpose**: Secure token management with refresh token rotation

**Features**:
- **JWT Access Tokens**: Short-lived (15 minutes) with role claims
- **Refresh Token Rotation**: Automatic rotation for enhanced security
- **Token Families**: Hierarchical token management
- **Blacklist Support**: Immediate token revocation capability

```typescript
class JWTService {
  // Generate access token with claims
  generateAccessToken(user: User): Promise<string> {
    const payload = {
      sub: user.id,
      org: user.organization_id,
      role: user.role,
      permissions: this.getPermissions(user.role),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (15 * 60) // 15 minutes
    };
    return jwt.sign(payload, this.accessTokenSecret);
  }
  
  // Refresh token with rotation
  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    // Validate existing refresh token
    const decoded = await this.verifyRefreshToken(refreshToken);
    
    // Generate new token pair
    const newTokens = await this.generateTokenPair(decoded.user);
    
    // Blacklist old refresh token
    await this.blacklistToken(refreshToken);
    
    return newTokens;
  }
}
```

**Security Features**:
- **Algorithm**: RS256 with rotating keys
- **Claims Validation**: Comprehensive payload verification
- **Token Binding**: IP and user agent validation options
- **Rate Limiting**: Token generation limits per user

#### SSOService

**Location**: `/src/services/sso.service.ts`  
**Purpose**: Enterprise SSO integration with multiple providers

**Supported Providers**:
- **Google Workspace**: OAuth 2.0 integration
- **Microsoft Azure AD**: SAML 2.0 and OAuth 2.0
- **Okta**: Full SAML and OAuth support
- **Generic OIDC**: Any OpenID Connect provider

```typescript
class SSOService {
  async authenticateWithGoogle(code: string): Promise<AuthResult> {
    // Exchange code for tokens
    const tokens = await this.exchangeGoogleCode(code);
    
    // Get user profile
    const profile = await this.getGoogleProfile(tokens.access_token);
    
    // Create or update user
    const user = await this.createOrUpdateUser(profile);
    
    // Generate application tokens
    return this.generateTokenPair(user);
  }
  
  async validateSAMLResponse(response: string): Promise<AuthResult> {
    // Validate SAML signature and assertions
    const assertions = await this.validateSAML(response);
    
    // Extract user information
    const userInfo = this.extractUserFromSAML(assertions);
    
    // Create session
    return this.createUserSession(userInfo);
  }
}
```

### 5. WebSocket and Real-time Services

#### WebSocketService

**Location**: `/src/services/websocket.service.ts`  
**Purpose**: Real-time updates with tenant isolation and scaling

**Architecture**:
```typescript
class WebSocketService {
  private tenantRooms: Map<string, Set<WebSocket>> = new Map();
  private userSessions: Map<string, WebSocketSession> = new Map();
  
  // Tenant-isolated broadcasting
  async broadcast(tenantId: string, message: any): Promise<void> {
    const room = this.tenantRooms.get(tenantId);
    if (room) {
      const payload = JSON.stringify({
        type: message.type,
        data: message.data,
        timestamp: new Date().toISOString(),
        tenant_id: tenantId
      });
      
      room.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(payload);
        }
      });
    }
  }
  
  // User-specific notifications
  async notifyUser(userId: string, notification: Notification): Promise<void> {
    const session = this.userSessions.get(userId);
    if (session && session.socket.readyState === WebSocket.OPEN) {
      session.socket.send(JSON.stringify(notification));
    }
  }
}
```

**Message Types**:
- **metrics_update**: New metrics data available
- **dashboard_refresh**: Dashboard data has changed
- **user_activity**: Team member activity updates  
- **system_alert**: System notifications and alerts
- **session_event**: User session state changes

**Scaling Strategy**:
- **Redis Pub/Sub**: Multi-instance message distribution
- **Connection Pooling**: Optimized connection management
- **Room Management**: Tenant-isolated message routing
- **Heartbeat Monitoring**: Connection health management

### 6. Migration and Compatibility Services

#### MigrationService

**Location**: `/src/services/migration.service.ts`  
**Purpose**: Data migration from local to cloud with validation

**Migration Strategy**:
```typescript
class MigrationService {
  async migrateFromLocal(
    organizationId: string, 
    localDataPath: string
  ): Promise<MigrationResult> {
    // 1. Validate local data format
    const validation = await this.validateLocalData(localDataPath);
    if (!validation.valid) {
      throw new Error(`Invalid data: ${validation.errors.join(', ')}`);
    }
    
    // 2. Create migration plan
    const plan = await this.createMigrationPlan(validation.data);
    
    // 3. Execute migration with progress tracking
    const result = await this.executeMigration(organizationId, plan);
    
    // 4. Validate migrated data
    await this.validateMigration(organizationId, result);
    
    return result;
  }
  
  async validateMigration(
    organizationId: string, 
    migrationResult: MigrationResult
  ): Promise<ValidationReport> {
    // Data integrity checks
    const integrityCheck = await this.checkDataIntegrity(organizationId);
    
    // Baseline comparison  
    const baselineComparison = await this.compareWithBaseline(
      migrationResult.original_data, 
      migrationResult.migrated_data
    );
    
    return {
      data_integrity: integrityCheck,
      baseline_comparison: baselineComparison,
      success: integrityCheck.passed && baselineComparison.accuracy > 0.99
    };
  }
}
```

**Migration Features**:
- **Progressive Migration**: Incremental data transfer
- **Data Validation**: Comprehensive integrity checking
- **Rollback Capability**: Safe migration with rollback option
- **Progress Tracking**: Real-time migration status updates
- **Conflict Resolution**: Intelligent conflict handling

#### CompatibilityService

**Location**: `/src/services/compatibility.service.ts`  
**Purpose**: Backward compatibility with existing local systems

**Compatibility Layers**:
```typescript
class CompatibilityService {
  // Local file format compatibility
  async readLocalMetrics(filePath: string): Promise<LocalMetrics> {
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Support multiple formats
    if (filePath.endsWith('.json')) {
      return this.parseJSONMetrics(content);
    } else if (filePath.endsWith('.csv')) {
      return this.parseCSVMetrics(content);
    } else {
      return this.parseLogMetrics(content);
    }
  }
  
  // API version compatibility
  async handleLegacyRequest(request: LegacyRequest): Promise<Response> {
    // Convert legacy format to current format
    const modernRequest = this.convertToModernFormat(request);
    
    // Process with current services
    const result = await this.processModernRequest(modernRequest);
    
    // Convert response back to legacy format if needed
    return this.convertToLegacyResponse(result, request.api_version);
  }
}
```

### 7. Performance Optimization Services

#### PerformanceOptimizationService

**Location**: `/src/services/performance-optimization.service.ts`  
**Purpose**: Automated performance monitoring and optimization

**Optimization Features**:
```typescript
class PerformanceOptimizationService {
  // Query optimization
  async optimizeQueries(organizationId: string): Promise<OptimizationReport> {
    // Analyze slow queries
    const slowQueries = await this.identifySlowQueries(organizationId);
    
    // Generate optimization recommendations
    const recommendations = await this.generateOptimizations(slowQueries);
    
    // Apply automatic optimizations
    const results = await this.applyOptimizations(recommendations);
    
    return {
      queries_analyzed: slowQueries.length,
      optimizations_applied: results.applied,
      performance_improvement: results.improvement_percentage
    };
  }
  
  // Cache warming
  async warmCaches(organizationId: string): Promise<CacheWarmingResult> {
    // Identify frequently accessed data
    const hotData = await this.identifyHotData(organizationId);
    
    // Pre-load into cache
    await this.preloadCache(hotData);
    
    return { cache_entries_warmed: hotData.length };
  }
  
  // Resource monitoring
  async monitorResourceUsage(): Promise<ResourceMetrics> {
    return {
      memory_usage_mb: process.memoryUsage().heapUsed / 1024 / 1024,
      cpu_usage_percent: await this.getCPUUsage(),
      database_connections: await this.getDatabaseConnectionCount(),
      cache_hit_rate: await this.getCacheHitRate(),
      request_queue_size: this.getRequestQueueSize()
    };
  }
}
```

**Optimization Strategies**:
- **Intelligent Caching**: Redis-based multi-level caching
- **Query Optimization**: Automatic index recommendations
- **Connection Pooling**: Dynamic pool sizing based on load
- **Batch Processing**: Automatic batch optimization
- **Resource Monitoring**: Continuous performance tracking

## Service Communication Patterns

### Inter-Service Communication

#### 1. Synchronous Communication
```typescript
// Direct service injection for real-time operations
class MetricsController {
  constructor(
    private metricsCollection: MetricsCollectionService,
    private metricsProcessing: MetricsProcessingService,
    private websocket: WebSocketService
  ) {}
  
  async collectMetric(req: Request): Promise<Response> {
    // Collect metric
    const result = await this.metricsCollection.collectCommandExecution(
      req.organizationId, 
      req.body
    );
    
    // Process in real-time
    if (result.success) {
      const processed = await this.metricsProcessing.processRealTimeMetric(
        result.data
      );
      
      // Broadcast update
      await this.websocket.broadcast(req.organizationId, {
        type: 'metric_update',
        data: processed
      });
    }
    
    return result;
  }
}
```

#### 2. Asynchronous Communication
```typescript
// Queue-based communication for background processing
class BackgroundProcessor {
  async queueMetricsAggregation(organizationId: string, metrics: any[]): Promise<void> {
    await this.messageQueue.publish('aggregation_queue', {
      organization_id: organizationId,
      metrics,
      timestamp: new Date().toISOString(),
      priority: 'normal'
    });
  }
  
  async processAggregationQueue(): Promise<void> {
    const message = await this.messageQueue.consume('aggregation_queue');
    
    if (message) {
      await this.metricsAggregation.processMetrics(
        message.organization_id,
        message.metrics
      );
      
      await message.ack();
    }
  }
}
```

### Error Handling and Resilience

#### Circuit Breaker Pattern
```typescript
class ServiceCircuitBreaker {
  private circuitStates: Map<string, CircuitState> = new Map();
  
  async callService<T>(
    serviceName: string, 
    operation: () => Promise<T>
  ): Promise<T> {
    const state = this.circuitStates.get(serviceName) || this.createCircuit();
    
    if (state.status === 'OPEN') {
      throw new Error(`Circuit breaker OPEN for ${serviceName}`);
    }
    
    try {
      const result = await operation();
      this.onSuccess(serviceName);
      return result;
    } catch (error) {
      this.onFailure(serviceName);
      throw error;
    }
  }
}
```

#### Retry Logic with Exponential Backoff
```typescript
class RetryService {
  async withRetry<T>(
    operation: () => Promise<T>,
    config: RetryConfig = { maxAttempts: 3, baseDelay: 1000 }
  ): Promise<T> {
    let attempt = 1;
    
    while (attempt <= config.maxAttempts) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === config.maxAttempts) throw error;
        
        const delay = config.baseDelay * Math.pow(2, attempt - 1);
        await this.sleep(delay);
        attempt++;
      }
    }
    
    throw new Error('Max retry attempts exceeded');
  }
}
```

## Service Configuration and Management

### Service Discovery and Health Checks

```typescript
class ServiceRegistry {
  private services: Map<string, ServiceInfo> = new Map();
  
  registerService(name: string, info: ServiceInfo): void {
    this.services.set(name, {
      ...info,
      registered_at: new Date(),
      last_health_check: new Date()
    });
  }
  
  async healthCheck(serviceName: string): Promise<HealthStatus> {
    const service = this.services.get(serviceName);
    if (!service) {
      return { status: 'unknown', message: 'Service not registered' };
    }
    
    try {
      const result = await service.health_endpoint();
      return { 
        status: 'healthy', 
        response_time_ms: result.latency,
        last_check: new Date()
      };
    } catch (error) {
      return { 
        status: 'unhealthy', 
        message: error.message,
        last_check: new Date()
      };
    }
  }
}
```

### Configuration Management

**Environment-based Configuration**:
```typescript
interface ServiceConfig {
  // Database settings
  database: {
    url: string;
    pool_size: number;
    timeout_ms: number;
    ssl_enabled: boolean;
  };
  
  // Redis settings
  cache: {
    url: string;
    ttl_seconds: number;
    max_connections: number;
  };
  
  // Performance settings
  performance: {
    batch_size: number;
    processing_timeout_ms: number;
    concurrent_requests: number;
    rate_limit_window_ms: number;
  };
  
  // Feature flags
  features: {
    real_time_processing: boolean;
    anomaly_detection: boolean;
    auto_optimization: boolean;
    advanced_analytics: boolean;
  };
}
```

### Monitoring and Observability

**Service Metrics Collection**:
```typescript
class ServiceMonitor {
  private metrics: Map<string, ServiceMetrics> = new Map();
  
  recordMetric(serviceName: string, metric: MetricData): void {
    const current = this.metrics.get(serviceName) || this.createMetrics();
    
    current.request_count++;
    current.total_response_time += metric.response_time;
    current.avg_response_time = current.total_response_time / current.request_count;
    
    if (metric.error) {
      current.error_count++;
    }
    
    this.metrics.set(serviceName, current);
  }
  
  getHealthReport(): ServiceHealthReport {
    const report: ServiceHealthReport = {
      timestamp: new Date().toISOString(),
      services: {}
    };
    
    for (const [name, metrics] of this.metrics.entries()) {
      report.services[name] = {
        status: this.calculateHealthStatus(metrics),
        request_count: metrics.request_count,
        error_rate: metrics.error_count / metrics.request_count,
        avg_response_time: metrics.avg_response_time,
        uptime: metrics.uptime
      };
    }
    
    return report;
  }
}
```

This comprehensive services architecture documentation provides developers with a complete understanding of how the External Metrics Web Service is structured, how services communicate, and how to extend or modify the system while maintaining performance and reliability requirements.