/**
 * Auto-Instrumentation Configuration for OpenTelemetry
 * Task 2.2: Auto-instrumentation Implementation
 * 
 * Comprehensive auto-instrumentation setup for Express.js, HTTP clients,
 * database operations, and other Node.js modules with production-ready configuration.
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { RedisInstrumentation as RedisInstrumentationV4 } from '@opentelemetry/instrumentation-redis-4';
import { WinstonInstrumentation } from '@opentelemetry/instrumentation-winston';
import * as api from '@opentelemetry/api';
import { otelFeatureFlags, isFeatureEnabled } from '../config/otel-feature-flags';

/**
 * Express.js Auto-instrumentation Configuration
 * Handles route tracing, request/response monitoring, and parameter capture
 */
export function configureExpressInstrumentation(): ExpressInstrumentation | null {
  if (!isFeatureEnabled('enableExpressInstrumentation')) {
    return null;
  }

  const expressInstrumentation = new ExpressInstrumentation({
    // Ignore health check and metrics endpoints
    ignoreIncomingRequestHook: (req) => {
      const ignorePaths = [
        '/health',
        '/metrics', 
        '/favicon.ico',
        '/robots.txt',
        '/.well-known'
      ];
      
      const path = req.url || req.originalUrl || '';
      return ignorePaths.some(ignorePath => path.includes(ignorePath));
    },

    // Request hook to capture route parameters and query strings
    requestHook: (span, info) => {
      const req = info.request;
      
      // Capture route parameters (sanitized)
      if (req.params && Object.keys(req.params).length > 0) {
        const sanitizedParams = sanitizeRouteParams(req.params);
        span.setAttributes({
          'express.route.params': JSON.stringify(sanitizedParams)
        });
      }

      // Capture query parameters (filtered) - only if enabled
      if (isFeatureEnabled('enableQueryParameterCapture') && req.query && Object.keys(req.query).length > 0) {
        const filteredQuery = filterQueryParams(req.query);
        if (Object.keys(filteredQuery).length > 0) {
          span.setAttributes({
            'express.query.params': JSON.stringify(filteredQuery)
          });
        }
      }

      // Capture request headers (selective)
      const importantHeaders = captureImportantHeaders(req.headers);
      Object.entries(importantHeaders).forEach(([key, value]) => {
        span.setAttributes({
          [`http.request.header.${key}`]: value
        });
      });

      // Capture route info
      if (req.route) {
        span.setAttributes({
          'express.route.path': req.route.path,
          'express.route.method': req.method?.toLowerCase()
        });
      }

      // Multi-tenant context
      if (req.tenantId) {
        span.setAttributes({
          'fortium.tenant.id': req.tenantId
        });
      }

      // User context (if available)
      if (req.user?.id) {
        span.setAttributes({
          'fortium.user.id': req.user.id
        });
      }
    },

    // Response hook to capture response information
    responseHook: (span, info) => {
      const res = info.response;
      
      // Response headers - only if enabled
      if (isFeatureEnabled('enableResponseHeaderCapture')) {
        const responseHeaders = captureImportantResponseHeaders(res.getHeaders());
        Object.entries(responseHeaders).forEach(([key, value]) => {
          span.setAttributes({
            [`http.response.header.${key}`]: value
          });
        });
      }

      // Response timing
      if (res.get('x-response-time')) {
        span.setAttributes({
          'http.response.time.ms': parseFloat(res.get('x-response-time') || '0')
        });
      }
    }
  });

  return expressInstrumentation;
}

/**
 * HTTP Client Auto-instrumentation Configuration
 * Handles outbound HTTP requests with URL filtering and data redaction
 */
export function configureHttpInstrumentation(): HttpInstrumentation | null {
  if (!isFeatureEnabled('enableHttpInstrumentation')) {
    return null;
  }
  const httpInstrumentation = new HttpInstrumentation({
    // Ignore internal monitoring and health check requests
    ignoreOutgoingRequestHook: (options) => {
      const url = typeof options === 'string' ? options : 
                  (options.protocol || 'http:') + '//' + (options.hostname || options.host || 'localhost') + 
                  (options.port ? ':' + options.port : '') + (options.path || '/');
      
      const ignorePatterns = [
        'localhost:4318',  // OTEL collector
        'localhost:9464',  // Prometheus
        'localhost:3301',  // SignOz
        'signoz',          // SignOz services
        'otel-collector',  // OTEL collector service
        'clickhouse',      // ClickHouse
        '/health',         // Health checks
        '/metrics'         // Metrics endpoints
      ];

      return ignorePatterns.some(pattern => url.includes(pattern));
    },

    // Request hook for outgoing requests
    requestHook: (span, request) => {
      const url = request.url || 'unknown';
      
      // Classify request type
      const requestType = classifyHttpRequest(url);
      span.setAttributes({
        'http.client.request.type': requestType
      });

      // Capture timeout configuration
      if (request.timeout) {
        span.setAttributes({
          'http.client.timeout.ms': request.timeout
        });
      }

      // Capture important request headers (sanitized)
      const headers = request.getHeaders();
      const importantHeaders = captureImportantHeaders(headers);
      Object.entries(importantHeaders).forEach(([key, value]) => {
        span.setAttributes({
          [`http.request.header.${key}`]: value
        });
      });
    },

    // Response hook for outgoing requests
    responseHook: (span, response) => {
      // Response size
      const contentLength = response.headers['content-length'];
      if (contentLength) {
        span.setAttributes({
          'http.response.body.size': parseInt(contentLength, 10)
        });
      }

      // Response type
      const contentType = response.headers['content-type'];
      if (contentType) {
        span.setAttributes({
          'http.response.content.type': contentType.split(';')[0] // Remove charset info
        });
      }

      // Cache headers
      const cacheControl = response.headers['cache-control'];
      if (cacheControl) {
        span.setAttributes({
          'http.response.cache.control': cacheControl
        });
      }
    },

    // Error handling
    applyCustomAttributesOnSpan: (span, request, response) => {
      // Add performance classification
      const duration = span.duration;
      if (duration) {
        let performanceClass = 'fast';
        if (duration > 5000) performanceClass = 'very_slow';
        else if (duration > 2000) performanceClass = 'slow';
        else if (duration > 1000) performanceClass = 'moderate';
        
        span.setAttributes({
          'http.performance.class': performanceClass
        });
      }
    }
  });

  return httpInstrumentation;
}

/**
 * Database Auto-instrumentation Configuration
 * Handles PostgreSQL operations with query performance monitoring
 */
export function configureDatabaseInstrumentation(): PgInstrumentation | null {
  if (!isFeatureEnabled('enableDatabaseInstrumentation')) {
    return null;
  }
  const pgInstrumentation = new PgInstrumentation({
    enhancedDatabaseReporting: true,
    
    // Request hook for database operations
    requestHook: (span, queryConfig) => {
      // Capture query type
      const queryType = extractQueryType(queryConfig.text);
      span.setAttributes({
        'db.operation.type': queryType
      });

      // Capture table information (if extractable)
      const tables = extractTableNames(queryConfig.text);
      if (tables.length > 0) {
        span.setAttributes({
          'db.operation.tables': tables.join(',')
        });
      }

      // Capture parameter count (not values for security)
      if (queryConfig.values) {
        span.setAttributes({
          'db.statement.parameter.count': queryConfig.values.length
        });
      }

      // Capture query complexity indicators
      const complexity = analyzeQueryComplexity(queryConfig.text);
      span.setAttributes({
        'db.query.complexity': complexity.level,
        'db.query.has_joins': complexity.hasJoins,
        'db.query.has_subqueries': complexity.hasSubqueries
      });
    },

    // Response hook for database operations
    responseHook: (span, result) => {
      // Capture result metrics
      if (result.rowCount !== undefined) {
        span.setAttributes({
          'db.result.row_count': result.rowCount
        });
      }

      if (result.rows) {
        span.setAttributes({
          'db.result.rows_returned': result.rows.length
        });
      }

      // Add performance classification
      const duration = span.duration;
      if (duration) {
        let performanceClass = 'fast';
        if (duration > 10000) performanceClass = 'very_slow';
        else if (duration > 5000) performanceClass = 'slow';
        else if (duration > 1000) performanceClass = 'moderate';
        
        span.setAttributes({
          'db.performance.class': performanceClass
        });
      }
    }
  });

  return pgInstrumentation;
}

/**
 * Redis Auto-instrumentation Configuration
 * Handles Redis operations with command monitoring
 */
export function configureRedisInstrumentation(): RedisInstrumentationV4 | null {
  if (!isFeatureEnabled('enableRedisInstrumentation')) {
    return null;
  }
  const redisInstrumentation = new RedisInstrumentationV4({
    // Database statement serializer to avoid logging sensitive data
    dbStatementSerializer: (cmdName, cmdArgs) => {
      // Only log the command and first argument (usually the key)
      const safeArgs = cmdArgs.slice(0, 1);
      if (cmdArgs.length > 1) {
        safeArgs.push(`[${cmdArgs.length - 1} more args]`);
      }
      return `${cmdName} ${safeArgs.join(' ')}`;
    },

    // Request hook for Redis operations
    requestHook: (span, cmdName, cmdArgs) => {
      // Classify Redis operation type
      const operationType = classifyRedisOperation(cmdName);
      span.setAttributes({
        'redis.operation.type': operationType,
        'redis.command.args.count': cmdArgs.length
      });

      // Capture key patterns for monitoring
      if (cmdArgs[0]) {
        const keyPattern = extractKeyPattern(cmdArgs[0]);
        span.setAttributes({
          'redis.key.pattern': keyPattern
        });
      }
    },

    // Response hook for Redis operations
    responseHook: (span, cmdName, cmdArgs, result) => {
      // Capture result size for relevant commands
      if (Array.isArray(result)) {
        span.setAttributes({
          'redis.result.array_length': result.length
        });
      } else if (typeof result === 'string') {
        span.setAttributes({
          'redis.result.string_length': result.length
        });
      }
    }
  });

  return redisInstrumentation;
}

/**
 * Winston Logging Auto-instrumentation Configuration
 * Correlates logs with traces
 */
export function configureWinstonInstrumentation(): WinstonInstrumentation | null {
  if (!isFeatureEnabled('enableLoggingInstrumentation')) {
    return null;
  }
  const winstonInstrumentation = new WinstonInstrumentation({
    // Log hook to inject trace correlation
    logHook: (span, record) => {
      const spanContext = span.spanContext();
      record['trace_id'] = spanContext.traceId;
      record['span_id'] = spanContext.spanId;
      record['trace_flags'] = spanContext.traceFlags;
      
      // Add service context
      record['service.name'] = 'fortium-monitoring-service';
      record['service.version'] = '1.0.0';
    }
  });

  return winstonInstrumentation;
}

/**
 * Get complete auto-instrumentations configuration
 */
export function getAutoInstrumentations() {
  if (!isFeatureEnabled('enableAutoInstrumentation')) {
    return [];
  }

  const instrumentationConfig: any = {
    // Disable noisy instrumentations
    '@opentelemetry/instrumentation-fs': {
      enabled: false
    },
    '@opentelemetry/instrumentation-dns': {
      enabled: false
    },
    '@opentelemetry/instrumentation-net': {
      enabled: false
    }
  };

  // Configure specific instrumentations only if they return valid instances
  const httpInstrumentation = configureHttpInstrumentation();
  if (httpInstrumentation) {
    instrumentationConfig['@opentelemetry/instrumentation-http'] = httpInstrumentation;
  } else {
    instrumentationConfig['@opentelemetry/instrumentation-http'] = { enabled: false };
  }

  const expressInstrumentation = configureExpressInstrumentation();
  if (expressInstrumentation) {
    instrumentationConfig['@opentelemetry/instrumentation-express'] = expressInstrumentation;
  } else {
    instrumentationConfig['@opentelemetry/instrumentation-express'] = { enabled: false };
  }

  const databaseInstrumentation = configureDatabaseInstrumentation();
  if (databaseInstrumentation) {
    instrumentationConfig['@opentelemetry/instrumentation-pg'] = databaseInstrumentation;
  } else {
    instrumentationConfig['@opentelemetry/instrumentation-pg'] = { enabled: false };
  }

  const redisInstrumentation = configureRedisInstrumentation();
  if (redisInstrumentation) {
    instrumentationConfig['@opentelemetry/instrumentation-redis-4'] = redisInstrumentation;
  } else {
    instrumentationConfig['@opentelemetry/instrumentation-redis-4'] = { enabled: false };
  }

  const winstonInstrumentation = configureWinstonInstrumentation();
  if (winstonInstrumentation) {
    instrumentationConfig['@opentelemetry/instrumentation-winston'] = winstonInstrumentation;
  } else {
    instrumentationConfig['@opentelemetry/instrumentation-winston'] = { enabled: false };
  }

  return getNodeAutoInstrumentations(instrumentationConfig);
}

// Utility functions

function sanitizeRouteParams(params: any): any {
  const sanitized: any = {};
  Object.keys(params).forEach(key => {
    const value = params[key];
    // Sanitize sensitive parameter names
    if (key.toLowerCase().includes('password') || 
        key.toLowerCase().includes('token') || 
        key.toLowerCase().includes('secret')) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  });
  return sanitized;
}

function filterQueryParams(query: any): any {
  const filtered: any = {};
  const sensitiveKeys = ['password', 'token', 'secret', 'key', 'auth'];
  
  Object.keys(query).forEach(key => {
    const lowerKey = key.toLowerCase();
    if (!sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
      filtered[key] = query[key];
    }
  });
  return filtered;
}

function captureImportantHeaders(headers: any): any {
  const important: any = {};
  const importantHeaderNames = [
    'content-type',
    'content-length',
    'user-agent',
    'accept',
    'accept-encoding',
    'cache-control',
    'x-forwarded-for',
    'x-tenant-id',
    'x-request-id'
  ];

  importantHeaderNames.forEach(name => {
    if (headers[name]) {
      important[name] = headers[name];
    }
  });

  return important;
}

function captureImportantResponseHeaders(headers: any): any {
  const important: any = {};
  const importantHeaderNames = [
    'content-type',
    'content-length',
    'cache-control',
    'etag',
    'last-modified',
    'x-response-time'
  ];

  importantHeaderNames.forEach(name => {
    if (headers[name]) {
      important[name] = headers[name];
    }
  });

  return important;
}

function classifyHttpRequest(url: string): string {
  if (url.includes('/api/')) return 'api';
  if (url.includes('/auth')) return 'authentication';
  if (url.includes('/metrics')) return 'metrics';
  if (url.includes('/health')) return 'health_check';
  if (url.includes('/webhook')) return 'webhook';
  return 'other';
}

function extractQueryType(sql: string): string {
  const upperSql = sql.trim().toUpperCase();
  if (upperSql.startsWith('SELECT')) return 'SELECT';
  if (upperSql.startsWith('INSERT')) return 'INSERT';
  if (upperSql.startsWith('UPDATE')) return 'UPDATE';
  if (upperSql.startsWith('DELETE')) return 'DELETE';
  if (upperSql.startsWith('CREATE')) return 'CREATE';
  if (upperSql.startsWith('DROP')) return 'DROP';
  if (upperSql.startsWith('ALTER')) return 'ALTER';
  return 'OTHER';
}

function extractTableNames(sql: string): string[] {
  const tables: string[] = [];
  const patterns = [
    /FROM\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
    /JOIN\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
    /UPDATE\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
    /INSERT\s+INTO\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi
  ];

  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(sql)) !== null) {
      if (match[1] && !tables.includes(match[1])) {
        tables.push(match[1]);
      }
    }
  });

  return tables;
}

function analyzeQueryComplexity(sql: string): { level: string; hasJoins: boolean; hasSubqueries: boolean } {
  const upperSql = sql.toUpperCase();
  const hasJoins = /\s+JOIN\s+/.test(upperSql);
  const hasSubqueries = /\(\s*SELECT\s+/.test(upperSql);
  const hasAggregations = /(COUNT|SUM|AVG|MAX|MIN|GROUP BY|HAVING)/.test(upperSql);
  const hasComplexConditions = /(EXISTS|IN\s*\(|CASE\s+WHEN)/.test(upperSql);

  let complexity = 0;
  if (hasJoins) complexity += 2;
  if (hasSubqueries) complexity += 3;
  if (hasAggregations) complexity += 1;
  if (hasComplexConditions) complexity += 1;

  let level = 'simple';
  if (complexity >= 4) level = 'complex';
  else if (complexity >= 2) level = 'moderate';

  return { level, hasJoins, hasSubqueries };
}

function classifyRedisOperation(cmdName: string): string {
  const cmd = cmdName.toUpperCase();
  
  if (['GET', 'MGET', 'HGET', 'HGETALL', 'LRANGE', 'SMEMBERS', 'ZRANGE'].includes(cmd)) {
    return 'read';
  }
  if (['SET', 'MSET', 'HSET', 'LPUSH', 'RPUSH', 'SADD', 'ZADD'].includes(cmd)) {
    return 'write';
  }
  if (['DEL', 'HDEL', 'LPOP', 'RPOP', 'SREM', 'ZREM'].includes(cmd)) {
    return 'delete';
  }
  if (['EXPIRE', 'TTL', 'EXISTS', 'TYPE'].includes(cmd)) {
    return 'metadata';
  }
  
  return 'other';
}

function extractKeyPattern(key: string): string {
  // Replace UUIDs, IDs, and other variable parts with placeholders
  return key
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '{uuid}')
    .replace(/\d+/g, '{id}')
    .replace(/[a-f0-9]{24}/gi, '{objectid}');
}