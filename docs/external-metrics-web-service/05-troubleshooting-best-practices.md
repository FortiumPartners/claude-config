# External Metrics Web Service - Troubleshooting and Best Practices Guide

> **Version**: 1.0.0  
> **Status**: Production Ready  
> **Last Updated**: September 2025  

## Overview

This comprehensive guide provides troubleshooting procedures, performance optimization techniques, security best practices, and operational guidelines for the External Metrics Web Service. Use this documentation to maintain optimal system performance and resolve common issues.

## Quick Diagnosis Reference

### System Health Check Commands

```bash
# Check overall system health
curl -H "Authorization: Bearer $TOKEN" \
     https://api.fortium-metrics.com/health

# Check MCP server health
curl -H "Authorization: Bearer $TOKEN" \
     https://api.fortium-metrics.com/health/mcp

# Check database connectivity
curl -H "Authorization: Bearer $TOKEN" \
     https://api.fortium-metrics.com/health/database

# Check performance metrics
curl -H "Authorization: Bearer $TOKEN" \
     https://api.fortium-metrics.com/metrics/performance
```

### Performance Benchmarks

**Target Performance Metrics**:
- **API Response Time**: <500ms (95th percentile)
- **MCP Request Latency**: <5ms (95th percentile)
- **Database Query Time**: <100ms average
- **WebSocket Latency**: <100ms for real-time updates
- **Memory Usage**: <32MB per service instance
- **CPU Usage**: <5% under normal load

**Alert Thresholds**:
- 🟡 **Warning**: Response time >300ms, Error rate >0.5%
- 🔴 **Critical**: Response time >1000ms, Error rate >2%
- 🚨 **Emergency**: System unavailable, Error rate >10%

## Common Issues and Solutions

### 1. High API Latency (>500ms)

**Symptoms**:
- Slow dashboard loading times
- Claude Code hook timeouts
- User complaints about responsiveness

**Diagnostic Steps**:
```bash
# Check current performance metrics
curl -H "Authorization: Bearer $TOKEN" \
     "https://api.fortium-metrics.com/metrics/performance" | jq '.latency'

# Identify slow endpoints
curl -H "Authorization: Bearer $TOKEN" \
     "https://api.fortium-metrics.com/admin/slow-queries" | jq '.[]'

# Check database performance
curl -H "Authorization: Bearer $TOKEN" \
     "https://api.fortium-metrics.com/health/database" | jq '.query_performance'
```

**Common Causes & Solutions**:

#### Database Performance Issues
```sql
-- Check for missing indexes
SELECT schemaname, tablename, attname, n_distinct, correlation 
FROM pg_stats 
WHERE schemaname NOT IN ('information_schema', 'pg_catalog')
ORDER BY n_distinct DESC;

-- Identify slow queries
SELECT query, mean_time, calls, total_time
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;

-- Add missing indexes
CREATE INDEX CONCURRENTLY idx_metrics_org_time 
ON command_executions(organization_id, created_at);
```

#### Connection Pool Exhaustion
```typescript
// Monitor connection pool status
const poolStats = await db.pool.totalCount;
const activeConnections = await db.pool.idleCount;

if (poolStats.totalCount >= poolStats.max) {
  logger.warn('Connection pool exhausted', {
    total: poolStats.totalCount,
    max: poolStats.max,
    idle: poolStats.idleCount
  });
  
  // Increase pool size temporarily
  await db.pool.resize({ max: poolStats.max + 5 });
}
```

#### Memory Leaks
```bash
# Monitor Node.js memory usage
node --inspect --max-old-space-size=1024 server.js

# Check for memory leaks
curl -H "Authorization: Bearer $TOKEN" \
     "https://api.fortium-metrics.com/admin/memory" | jq '.heapUsage'

# Enable garbage collection monitoring
NODE_ENV=production node --gc-stats server.js
```

### 2. MCP Integration Issues

**Symptoms**:
- MCP requests failing with timeouts
- Claude Code hooks not sending metrics
- Authentication errors from MCP client

**Diagnostic Steps**:
```bash
# Test MCP connectivity
curl -X POST \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer $TOKEN" \
     -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' \
     https://api.fortium-metrics.com/mcp/v1/request

# Check MCP server logs
kubectl logs -n fortium deployment/metrics-service -c mcp-server

# Test local MCP client
npx @fortium/metrics-mcp-client test-connection
```

**Solutions**:

#### Authentication Issues
```typescript
// Verify JWT token validity
const jwt = require('jsonwebtoken');

try {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  console.log('Token valid:', decoded);
} catch (error) {
  console.error('Token validation failed:', error.message);
  
  // Refresh token if expired
  if (error.name === 'TokenExpiredError') {
    const newToken = await refreshAccessToken(refreshToken);
    // Update client configuration
  }
}
```

#### Network Connectivity
```bash
# Test network connectivity
ping api.fortium-metrics.com
telnet api.fortium-metrics.com 443

# Check DNS resolution
nslookup api.fortium-metrics.com
dig api.fortium-metrics.com

# Test through proxy if needed
curl --proxy http://proxy:8080 https://api.fortium-metrics.com/health
```

#### Client Configuration Issues
```json
// Verify Claude MCP configuration in ~/.claude/config.json
{
  "mcpServers": {
    "fortium-metrics": {
      "command": "npx",
      "args": ["-y", "@fortium/metrics-mcp-server@latest"],
      "env": {
        "FORTIUM_METRICS_URL": "https://api.fortium-metrics.com",
        "FORTIUM_API_KEY": "your-api-key",
        "FORTIUM_ORG_ID": "your-org-id",
        "FORTIUM_DEBUG": "true"
      }
    }
  }
}
```

### 3. Database Connection Issues

**Symptoms**:
- Database connection timeouts
- Pool exhaustion errors
- Query performance degradation

**Diagnostic Commands**:
```sql
-- Check active connections
SELECT count(*) as active_connections,
       state,
       application_name
FROM pg_stat_activity 
WHERE state IS NOT NULL 
GROUP BY state, application_name;

-- Check lock contention
SELECT blocked_locks.pid AS blocked_pid,
       blocked_activity.usename AS blocked_user,
       blocking_locks.pid AS blocking_pid,
       blocking_activity.usename AS blocking_user,
       blocked_activity.query AS blocked_statement,
       blocking_activity.query AS blocking_statement
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity 
  ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks 
  ON blocking_locks.locktype = blocked_locks.locktype
  AND blocking_locks.relation = blocked_locks.relation
  AND blocking_locks.page = blocked_locks.page
  AND blocking_locks.tuple = blocked_locks.tuple
  AND blocking_locks.virtualxid = blocked_locks.virtualxid
  AND blocking_locks.transactionid = blocked_locks.transactionid
  AND blocking_locks.classid = blocked_locks.classid
  AND blocking_locks.objid = blocked_locks.objid
  AND blocking_locks.objsubid = blocked_locks.objsubid
  AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity 
  ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;
```

**Solutions**:

#### Connection Pool Optimization
```typescript
// Optimize connection pool settings
const poolConfig = {
  max: 20,                     // Maximum connections
  min: 2,                      // Minimum connections  
  acquire: 30000,              // Maximum time to get connection (ms)
  idle: 10000,                 // Maximum idle time (ms)
  evict: 5000,                 // Eviction run interval (ms)
  handleDisconnects: true,     // Automatic reconnection
  validate: true               // Validate connections before use
};

// Monitor pool health
setInterval(() => {
  const stats = db.pool.getPoolSize();
  logger.info('Connection pool stats', {
    total: stats.total,
    used: stats.used,
    waiting: stats.waiting
  });
}, 30000);
```

#### Query Optimization
```sql
-- Add performance indexes
CREATE INDEX CONCURRENTLY idx_command_executions_perf 
ON command_executions(organization_id, created_at DESC, status);

CREATE INDEX CONCURRENTLY idx_agent_interactions_perf
ON agent_interactions(organization_id, agent_name, timestamp DESC);

CREATE INDEX CONCURRENTLY idx_user_sessions_active
ON user_sessions(organization_id, status) WHERE status = 'active';

-- Update table statistics
ANALYZE command_executions;
ANALYZE agent_interactions;
ANALYZE user_sessions;
```

### 4. Rate Limiting Issues

**Symptoms**:
- 429 Too Many Requests responses
- Legitimate requests being blocked
- Uneven request distribution

**Diagnostic Steps**:
```bash
# Check rate limit status
curl -I -H "Authorization: Bearer $TOKEN" \
     https://api.fortium-metrics.com/api/v1/metrics/health

# Check rate limit configuration
curl -H "Authorization: Bearer $TOKEN" \
     https://api.fortium-metrics.com/admin/rate-limits
```

**Solutions**:

#### Adjust Rate Limits
```typescript
// Dynamic rate limit adjustment
const adjustRateLimitForOrg = async (orgId: string, newLimit: number) => {
  await redis.set(`rate_limit:${orgId}`, JSON.stringify({
    window_ms: 60000,
    max_requests: newLimit,
    burst_allowance: Math.floor(newLimit * 0.1)
  }));
  
  logger.info('Rate limit adjusted', { orgId, newLimit });
};

// Smart rate limiting based on user tier
const getOrgRateLimit = async (orgId: string) => {
  const org = await getOrganization(orgId);
  
  const limits = {
    'free': 100,
    'professional': 1000,
    'enterprise': 5000
  };
  
  return limits[org.subscription_tier] || 100;
};
```

#### Implement Retry Logic
```typescript
// Exponential backoff retry
class SmartRetryClient {
  async requestWithRetry(url: string, options: any, maxRetries = 3) {
    let attempt = 1;
    
    while (attempt <= maxRetries) {
      try {
        const response = await fetch(url, options);
        
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const delay = retryAfter 
            ? parseInt(retryAfter) * 1000 
            : Math.min(1000 * Math.pow(2, attempt), 30000);
          
          console.log(`Rate limited, waiting ${delay}ms before retry ${attempt}/${maxRetries}`);
          await new Promise(resolve => setTimeout(resolve, delay));
          attempt++;
          continue;
        }
        
        return response;
        
      } catch (error) {
        if (attempt === maxRetries) throw error;
        
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
        attempt++;
      }
    }
  }
}
```

### 5. WebSocket Connection Issues

**Symptoms**:
- Real-time updates not working
- WebSocket connections dropping
- High memory usage from connection handling

**Diagnostic Steps**:
```bash
# Check WebSocket server status
curl -H "Upgrade: websocket" \
     -H "Connection: Upgrade" \
     -H "Sec-WebSocket-Key: x3JJHMbDL1EzLkh9GBhXDw==" \
     -H "Sec-WebSocket-Version: 13" \
     https://api.fortium-metrics.com/ws

# Monitor active connections
curl -H "Authorization: Bearer $TOKEN" \
     https://api.fortium-metrics.com/admin/websockets/stats
```

**Solutions**:

#### Connection Management
```typescript
class WebSocketManager {
  private connections: Map<string, WebSocket> = new Map();
  private heartbeatInterval: NodeJS.Timeout;
  
  constructor() {
    // Periodic cleanup of dead connections
    this.heartbeatInterval = setInterval(() => {
      this.cleanupDeadConnections();
    }, 30000);
  }
  
  addConnection(userId: string, ws: WebSocket) {
    // Remove existing connection for user
    this.removeConnection(userId);
    
    this.connections.set(userId, ws);
    
    // Set up connection monitoring
    ws.on('close', () => this.removeConnection(userId));
    ws.on('error', () => this.removeConnection(userId));
    
    // Send heartbeat
    this.sendHeartbeat(ws);
  }
  
  private cleanupDeadConnections() {
    for (const [userId, ws] of this.connections.entries()) {
      if (ws.readyState !== WebSocket.OPEN) {
        this.connections.delete(userId);
      }
    }
    
    logger.info('WebSocket cleanup completed', {
      active_connections: this.connections.size
    });
  }
  
  private sendHeartbeat(ws: WebSocket) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping('heartbeat');
      setTimeout(() => this.sendHeartbeat(ws), 30000);
    }
  }
}
```

## Performance Optimization Best Practices

### 1. Database Optimization

#### Index Strategy
```sql
-- Command execution performance indexes
CREATE INDEX CONCURRENTLY idx_cmd_exec_hot_path 
ON command_executions(organization_id, user_id, created_at DESC)
WHERE status = 'success';

CREATE INDEX CONCURRENTLY idx_cmd_exec_errors
ON command_executions(organization_id, created_at DESC)
WHERE status != 'success';

-- Agent interaction indexes
CREATE INDEX CONCURRENTLY idx_agent_int_performance
ON agent_interactions(organization_id, agent_name, timestamp DESC)
INCLUDE (processing_time_ms, success);

-- Partial indexes for active sessions
CREATE INDEX CONCURRENTLY idx_sessions_active_only
ON user_sessions(organization_id, user_id, session_start DESC)
WHERE status = 'active';
```

#### Query Optimization
```typescript
// Use prepared statements for frequent queries
class OptimizedMetricsModel {
  private preparedStatements = new Map();
  
  async getCommandExecutionStats(orgId: string, timeRange: string) {
    const stmtKey = 'cmd_exec_stats';
    
    if (!this.preparedStatements.has(stmtKey)) {
      const stmt = await this.db.prepare(`
        SELECT 
          command_name,
          COUNT(*) as execution_count,
          AVG(execution_time_ms) as avg_time,
          PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY execution_time_ms) as p95_time,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END)::FLOAT / COUNT(*) as success_rate
        FROM command_executions 
        WHERE organization_id = $1 
          AND created_at >= NOW() - INTERVAL $2
        GROUP BY command_name
        ORDER BY execution_count DESC
      `);
      
      this.preparedStatements.set(stmtKey, stmt);
    }
    
    return await this.preparedStatements.get(stmtKey).all(orgId, timeRange);
  }
}
```

### 2. Caching Strategy

#### Multi-Level Caching
```typescript
class CacheManager {
  private l1Cache = new Map(); // In-memory cache
  private redis: Redis;         // L2 Redis cache
  
  async get(key: string) {
    // L1 cache check
    if (this.l1Cache.has(key)) {
      const entry = this.l1Cache.get(key);
      if (Date.now() - entry.timestamp < 5000) { // 5 second TTL
        return entry.data;
      }
      this.l1Cache.delete(key);
    }
    
    // L2 cache check
    const cached = await this.redis.get(key);
    if (cached) {
      const data = JSON.parse(cached);
      // Populate L1 cache
      this.l1Cache.set(key, { data, timestamp: Date.now() });
      return data;
    }
    
    return null;
  }
  
  async set(key: string, data: any, ttl = 300) {
    // Set in both caches
    this.l1Cache.set(key, { data, timestamp: Date.now() });
    await this.redis.setex(key, ttl, JSON.stringify(data));
  }
}
```

#### Cache Warming
```typescript
class CacheWarmer {
  async warmFrequentQueries() {
    const orgs = await this.getActiveOrganizations();
    
    for (const org of orgs) {
      // Warm dashboard queries
      await this.warmDashboardCache(org.id);
      
      // Warm metrics queries
      await this.warmMetricsCache(org.id);
      
      // Add delay to avoid overwhelming the system
      await this.sleep(100);
    }
  }
  
  private async warmDashboardCache(orgId: string) {
    const timeframes = ['1h', '24h', '7d'];
    
    for (const timeframe of timeframes) {
      const cacheKey = `dashboard:${orgId}:${timeframe}`;
      
      if (!(await this.cache.get(cacheKey))) {
        const data = await this.getDashboardData(orgId, timeframe);
        await this.cache.set(cacheKey, data, 300); // 5 minute TTL
      }
    }
  }
}
```

### 3. Memory Management

#### Memory Monitoring
```typescript
class MemoryMonitor {
  private memoryThreshold = 512 * 1024 * 1024; // 512MB
  
  startMonitoring() {
    setInterval(() => {
      const usage = process.memoryUsage();
      
      logger.info('Memory usage', {
        rss_mb: Math.round(usage.rss / 1024 / 1024),
        heap_used_mb: Math.round(usage.heapUsed / 1024 / 1024),
        heap_total_mb: Math.round(usage.heapTotal / 1024 / 1024),
        external_mb: Math.round(usage.external / 1024 / 1024)
      });
      
      if (usage.heapUsed > this.memoryThreshold) {
        logger.warn('Memory usage high, triggering cleanup', {
          heap_used_mb: Math.round(usage.heapUsed / 1024 / 1024),
          threshold_mb: Math.round(this.memoryThreshold / 1024 / 1024)
        });
        
        this.triggerMemoryCleanup();
      }
    }, 30000);
  }
  
  private triggerMemoryCleanup() {
    // Clear caches
    this.clearOldCacheEntries();
    
    // Force garbage collection
    if (global.gc) {
      global.gc();
    }
    
    // Clear request cache
    this.clearRequestCache();
  }
}
```

## Security Best Practices

### 1. Authentication and Authorization

#### JWT Security
```typescript
class SecureJWTService {
  private readonly algorithm = 'RS256';
  private readonly issuer = 'fortium-metrics';
  
  generateToken(user: User): string {
    const payload = {
      sub: user.id,
      iss: this.issuer,
      aud: 'fortium-metrics-api',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (15 * 60), // 15 minutes
      org: user.organization_id,
      role: user.role,
      permissions: this.getPermissions(user.role),
      // Security claims
      jti: this.generateTokenId(), // Unique token ID
      azp: user.client_id          // Authorized party
    };
    
    return jwt.sign(payload, this.privateKey, { algorithm: this.algorithm });
  }
  
  async verifyToken(token: string): Promise<JWTPayload> {
    const options = {
      issuer: this.issuer,
      audience: 'fortium-metrics-api',
      algorithms: [this.algorithm]
    };
    
    try {
      const decoded = jwt.verify(token, this.publicKey, options);
      
      // Check token blacklist
      if (await this.isTokenBlacklisted(decoded.jti)) {
        throw new Error('Token has been revoked');
      }
      
      return decoded;
      
    } catch (error) {
      logger.warn('Token verification failed', { error: error.message });
      throw new UnauthorizedError('Invalid token');
    }
  }
}
```

#### API Key Management
```typescript
class APIKeyManager {
  async rotateAPIKey(organizationId: string): Promise<string> {
    const oldKey = await this.getCurrentAPIKey(organizationId);
    const newKey = this.generateSecureAPIKey();
    
    // Store new key with rotation metadata
    await this.storeAPIKey(organizationId, {
      key: newKey,
      created_at: new Date(),
      previous_key: oldKey,
      rotation_reason: 'scheduled_rotation'
    });
    
    // Keep old key valid for grace period
    await this.scheduleKeyExpiry(oldKey, 24 * 60 * 60 * 1000); // 24 hours
    
    logger.info('API key rotated', { organizationId });
    return newKey;
  }
  
  private generateSecureAPIKey(): string {
    const crypto = require('crypto');
    return 'ftm_' + crypto.randomBytes(32).toString('base64url');
  }
}
```

### 2. Input Validation and Sanitization

#### Comprehensive Validation
```typescript
class SecurityValidator {
  validateMetricsInput(data: any): ValidatedMetrics {
    const schema = {
      type: 'object',
      required: ['command_name', 'execution_time_ms', 'status'],
      properties: {
        command_name: {
          type: 'string',
          minLength: 1,
          maxLength: 100,
          pattern: '^[a-zA-Z0-9_-]+$' // Alphanumeric, underscore, hyphen only
        },
        execution_time_ms: {
          type: 'number',
          minimum: 0,
          maximum: 300000 // 5 minutes max
        },
        status: {
          type: 'string',
          enum: ['success', 'error', 'timeout', 'cancelled']
        },
        context: {
          type: 'object',
          maxProperties: 50,
          additionalProperties: {
            anyOf: [
              { type: 'string', maxLength: 1000 },
              { type: 'number' },
              { type: 'boolean' }
            ]
          }
        }
      },
      additionalProperties: false
    };
    
    const valid = this.ajv.validate(schema, data);
    if (!valid) {
      throw new ValidationError('Invalid metrics data', this.ajv.errors);
    }
    
    // Sanitize strings
    const sanitized = {
      ...data,
      command_name: this.sanitizeString(data.command_name),
      context: this.sanitizeObject(data.context)
    };
    
    return sanitized;
  }
  
  private sanitizeString(str: string): string {
    // Remove potential script tags and SQL injection attempts
    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/[';\"\\]/g, '') // Remove SQL injection characters
      .trim();
  }
  
  private sanitizeObject(obj: any): any {
    if (typeof obj !== 'object' || obj === null) return obj;
    
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        sanitized[key] = this.sanitizeString(value);
      } else if (typeof value === 'object') {
        sanitized[key] = this.sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }
}
```

### 3. Rate Limiting and DDoS Protection

#### Adaptive Rate Limiting
```typescript
class AdaptiveRateLimit {
  private rateLimits = new Map<string, RateLimitState>();
  
  async checkRateLimit(identifier: string, endpoint: string): Promise<RateLimitResult> {
    const key = `${identifier}:${endpoint}`;
    const now = Date.now();
    
    let state = this.rateLimits.get(key);
    if (!state) {
      state = {
        requests: 0,
        windowStart: now,
        violations: 0,
        lastViolation: 0
      };
    }
    
    // Reset window if needed
    if (now - state.windowStart >= 60000) { // 1 minute window
      state.requests = 0;
      state.windowStart = now;
    }
    
    // Calculate dynamic limit based on violations
    const baseLimit = this.getBaseLimit(endpoint);
    const adjustedLimit = this.calculateAdjustedLimit(baseLimit, state.violations);
    
    if (state.requests >= adjustedLimit) {
      state.violations++;
      state.lastViolation = now;
      
      // Implement exponential backoff
      const backoffTime = Math.min(300000, 1000 * Math.pow(2, state.violations));
      
      return {
        allowed: false,
        retryAfter: backoffTime / 1000,
        limit: adjustedLimit,
        remaining: 0
      };
    }
    
    state.requests++;
    this.rateLimits.set(key, state);
    
    return {
      allowed: true,
      limit: adjustedLimit,
      remaining: adjustedLimit - state.requests
    };
  }
  
  private calculateAdjustedLimit(baseLimit: number, violations: number): number {
    if (violations === 0) return baseLimit;
    
    // Reduce limit by 20% for each violation, minimum 10% of base
    const reduction = Math.min(0.9, violations * 0.2);
    return Math.max(Math.floor(baseLimit * 0.1), Math.floor(baseLimit * (1 - reduction)));
  }
}
```

## Monitoring and Alerting

### 1. Comprehensive Monitoring Setup

#### Application Metrics
```typescript
class MetricsCollector {
  private prometheus = require('prom-client');
  
  constructor() {
    // Request duration histogram
    this.requestDuration = new this.prometheus.Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
    });
    
    // Database query duration
    this.dbQueryDuration = new this.prometheus.Histogram({
      name: 'db_query_duration_seconds',
      help: 'Duration of database queries in seconds',
      labelNames: ['query_type', 'table'],
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1]
    });
    
    // Active connections gauge
    this.activeConnections = new this.prometheus.Gauge({
      name: 'db_connections_active',
      help: 'Number of active database connections'
    });
    
    // Memory usage gauge
    this.memoryUsage = new this.prometheus.Gauge({
      name: 'nodejs_memory_usage_bytes',
      help: 'Process memory usage in bytes',
      labelNames: ['type']
    });
    
    // Start collecting metrics
    this.startCollection();
  }
  
  private startCollection() {
    setInterval(() => {
      const memUsage = process.memoryUsage();
      this.memoryUsage.set({ type: 'rss' }, memUsage.rss);
      this.memoryUsage.set({ type: 'heapUsed' }, memUsage.heapUsed);
      this.memoryUsage.set({ type: 'heapTotal' }, memUsage.heapTotal);
      this.memoryUsage.set({ type: 'external' }, memUsage.external);
    }, 5000);
  }
}
```

#### Alert Configuration
```yaml
# Prometheus Alert Rules (alerting.yml)
groups:
  - name: fortium-metrics-alerts
    rules:
      - alert: HighResponseTime
        expr: histogram_quantile(0.95, http_request_duration_seconds) > 0.5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High response time detected"
          description: "95th percentile response time is {{ $value }}s"
      
      - alert: HighErrorRate
        expr: rate(http_requests_total{status_code=~"5.."}[5m]) > 0.01
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} errors/second"
      
      - alert: DatabaseConnectionsHigh
        expr: db_connections_active > 18
        for: 3m
        labels:
          severity: warning
        annotations:
          summary: "Database connections running high"
          description: "{{ $value }} active connections out of 20 max"
      
      - alert: MemoryUsageHigh
        expr: nodejs_memory_usage_bytes{type="heapUsed"} / 1024 / 1024 > 256
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage"
          description: "Memory usage is {{ $value }}MB"
```

### 2. Health Check Implementation

```typescript
class HealthChecker {
  async getSystemHealth(): Promise<HealthStatus> {
    const checks = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkWebSocket(),
      this.checkMCPServer(),
      this.checkExternalAPIs()
    ]);
    
    const results = checks.map((check, index) => ({
      name: ['database', 'redis', 'websocket', 'mcp', 'external'][index],
      status: check.status === 'fulfilled' ? check.value : 'unhealthy',
      error: check.status === 'rejected' ? check.reason.message : null
    }));
    
    const overallHealth = results.every(r => r.status === 'healthy') 
      ? 'healthy' 
      : results.some(r => r.status === 'healthy') 
      ? 'degraded' 
      : 'unhealthy';
    
    return {
      status: overallHealth,
      timestamp: new Date().toISOString(),
      checks: results,
      uptime: process.uptime(),
      version: process.env.APP_VERSION || '1.0.0'
    };
  }
  
  private async checkDatabase(): Promise<string> {
    const start = Date.now();
    try {
      await db.query('SELECT 1');
      const duration = Date.now() - start;
      
      if (duration > 100) return 'degraded';
      return 'healthy';
    } catch (error) {
      return 'unhealthy';
    }
  }
  
  private async checkRedis(): Promise<string> {
    try {
      const result = await redis.ping();
      return result === 'PONG' ? 'healthy' : 'unhealthy';
    } catch (error) {
      return 'unhealthy';
    }
  }
}
```

## Operational Guidelines

### 1. Deployment Best Practices

#### Zero-Downtime Deployment
```yaml
# Kubernetes Deployment with Rolling Updates
apiVersion: apps/v1
kind: Deployment
metadata:
  name: metrics-service
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
      maxSurge: 1
  template:
    spec:
      containers:
      - name: metrics-service
        image: fortium/metrics-service:latest
        resources:
          limits:
            memory: "512Mi"
            cpu: "500m"
          requests:
            memory: "256Mi"
            cpu: "250m"
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 10
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 30
```

#### Database Migration Strategy
```typescript
class MigrationManager {
  async runMigrations() {
    const pendingMigrations = await this.getPendingMigrations();
    
    for (const migration of pendingMigrations) {
      logger.info('Running migration', { migration: migration.name });
      
      const transaction = await db.beginTransaction();
      try {
        // Run migration in transaction
        await migration.up(transaction);
        
        // Record migration
        await this.recordMigration(migration.name, transaction);
        
        await transaction.commit();
        logger.info('Migration completed', { migration: migration.name });
        
      } catch (error) {
        await transaction.rollback();
        logger.error('Migration failed', { 
          migration: migration.name, 
          error: error.message 
        });
        throw error;
      }
    }
  }
  
  async rollbackMigration(migrationName: string) {
    const migration = await this.getMigration(migrationName);
    
    const transaction = await db.beginTransaction();
    try {
      await migration.down(transaction);
      await this.removeMigrationRecord(migrationName, transaction);
      await transaction.commit();
      
      logger.info('Migration rolled back', { migration: migrationName });
      
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}
```

### 2. Backup and Recovery

#### Automated Backup Strategy
```bash
#!/bin/bash
# backup-metrics-db.sh

set -e

DB_HOST=${DB_HOST:-localhost}
DB_NAME=${DB_NAME:-fortium_metrics}
DB_USER=${DB_USER:-postgres}
BACKUP_PATH=${BACKUP_PATH:-/backups}
RETENTION_DAYS=${RETENTION_DAYS:-30}

# Create timestamped backup
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_PATH/metrics_backup_$TIMESTAMP.sql.gz"

echo "Starting database backup..."

# Create backup with compression
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME \
  --verbose --clean --no-owner --no-privileges \
  | gzip > $BACKUP_FILE

# Verify backup
if [ -s $BACKUP_FILE ]; then
    echo "Backup completed successfully: $BACKUP_FILE"
    
    # Upload to S3 if configured
    if [ ! -z "$AWS_S3_BUCKET" ]; then
        aws s3 cp $BACKUP_FILE s3://$AWS_S3_BUCKET/database-backups/
        echo "Backup uploaded to S3"
    fi
else
    echo "Backup failed - file is empty or doesn't exist"
    exit 1
fi

# Cleanup old backups
find $BACKUP_PATH -name "metrics_backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete
echo "Old backups cleaned up"

# Test backup integrity
echo "Testing backup integrity..."
zcat $BACKUP_FILE | head -20 > /dev/null
echo "Backup integrity check passed"
```

This comprehensive troubleshooting and best practices guide provides the foundation for maintaining a robust, secure, and high-performance External Metrics Web Service deployment. Regular review and application of these practices will ensure optimal system operation and user experience.