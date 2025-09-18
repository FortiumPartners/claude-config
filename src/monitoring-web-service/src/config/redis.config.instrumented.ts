/**
 * Instrumented Redis Cache Manager
 * Task 2.3.3: Database Operations & Caching - Redis Cache Operations (Part of 2h)
 * 
 * Comprehensive OpenTelemetry instrumentation for Redis cache operations including:
 * - Cache hit/miss ratio tracking
 * - Redis command execution timing
 * - Cache key pattern analysis
 * - TTL and memory usage monitoring
 */

import Redis, { RedisOptions, Cluster } from 'ioredis';
import * as winston from 'winston';
import { 
  BusinessInstrumentation, 
  BusinessContext, 
  BusinessAttributes,
  OperationType,
  InstrumentMethod,
  getBusinessInstrumentation 
} from '../tracing/business-instrumentation';
import * as api from '@opentelemetry/api';
import { SemanticAttributes } from '@opentelemetry/semantic-conventions';

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  retryDelayOnFailover?: number;
  maxRetriesPerRequest?: number;
  lazyConnect?: boolean;
  family?: 4 | 6;
  cluster?: boolean;
  nodes?: Array<{ host: string; port: number }>;
}

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  context?: BusinessContext;
  keyPattern?: string;
  compress?: boolean;
  serialize?: boolean;
}

export interface CacheMetrics {
  total_operations: number;
  cache_hits: number;
  cache_misses: number;
  hit_ratio: number;
  avg_response_time: number;
  memory_usage_bytes: number;
  key_count: number;
  expired_keys: number;
  evicted_keys: number;
}

/**
 * Instrumented Redis Manager with comprehensive OpenTelemetry tracing
 */
export class InstrumentedRedisManager {
  private client: Redis | Cluster;
  private logger: winston.Logger;
  private instrumentation: BusinessInstrumentation;
  private config: RedisConfig;
  private metrics: CacheMetrics;

  constructor(config: RedisConfig, logger: winston.Logger) {
    this.config = config;
    this.logger = logger;
    this.instrumentation = getBusinessInstrumentation();
    
    this.metrics = {
      total_operations: 0,
      cache_hits: 0,
      cache_misses: 0,
      hit_ratio: 0,
      avg_response_time: 0,
      memory_usage_bytes: 0,
      key_count: 0,
      expired_keys: 0,
      evicted_keys: 0
    };

    this.initializeRedisClient();
    this.setupEventHandlers();
    
    // Start metrics collection interval
    setInterval(() => {
      this.collectRedisInfo().catch(error => {
        this.logger.error('Failed to collect Redis info', error);
      });
    }, 30000); // Every 30 seconds
  }

  /**
   * Initialize Redis client (single instance or cluster)
   */
  private initializeRedisClient(): void {
    const redisOptions: RedisOptions = {
      host: this.config.host,
      port: this.config.port,
      password: this.config.password,
      db: this.config.db || 0,
      keyPrefix: this.config.keyPrefix,
      retryDelayOnFailover: this.config.retryDelayOnFailover || 100,
      maxRetriesPerRequest: this.config.maxRetriesPerRequest || 3,
      lazyConnect: this.config.lazyConnect || true,
      family: this.config.family || 4,
    };

    if (this.config.cluster && this.config.nodes) {
      this.client = new Redis.Cluster(this.config.nodes, {
        redisOptions,
        enableOfflineQueue: false,
      });
    } else {
      this.client = new Redis(redisOptions);
    }
  }

  /**
   * Setup Redis event handlers for monitoring
   */
  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      this.logger.info('Redis client connected');
    });

    this.client.on('ready', () => {
      this.logger.info('Redis client ready');
    });

    this.client.on('error', (error) => {
      this.logger.error('Redis client error', error);
    });

    this.client.on('close', () => {
      this.logger.info('Redis client connection closed');
    });

    this.client.on('reconnecting', () => {
      this.logger.warn('Redis client reconnecting');
    });
  }

  /**
   * Get value from cache with comprehensive instrumentation
   */
  async get<T = any>(key: string, options?: CacheOptions): Promise<T | null> {
    const context: BusinessContext = {
      ...options?.context
    };

    return this.instrumentation.instrumentCacheOperation(
      'get',
      options?.keyPattern || this.extractKeyPattern(key),
      async (span: api.Span) => {
        const cacheStart = Date.now();
        
        span.setAttributes({
          [SemanticAttributes.DB_SYSTEM]: 'redis',
          [SemanticAttributes.DB_OPERATION]: 'get',
          [BusinessAttributes.CACHE_OPERATION]: 'get',
          [BusinessAttributes.CACHE_KEY_PATTERN]: options?.keyPattern || this.extractKeyPattern(key),
          'cache.key': key,
          'cache.key_length': key.length
        });

        try {
          const rawValue = await this.client.get(key);
          const cacheDuration = Date.now() - cacheStart;
          
          // Update metrics
          this.updateCacheMetrics(cacheDuration, rawValue !== null);
          
          if (rawValue === null) {
            span.setAttributes({
              'cache.result': 'miss',
              'cache.duration_ms': cacheDuration
            });
            
            this.logger.debug('Cache miss', {
              key,
              key_pattern: options?.keyPattern || this.extractKeyPattern(key),
              tenant_id: context.tenantId
            });
            
            return null;
          }

          // Parse value if it was serialized
          let parsedValue: T;
          try {
            parsedValue = options?.serialize !== false ? JSON.parse(rawValue) : rawValue as T;
          } catch (parseError) {
            // If parsing fails, return raw value
            parsedValue = rawValue as T;
          }

          span.setAttributes({
            'cache.result': 'hit',
            'cache.duration_ms': cacheDuration,
            'cache.value_size_bytes': rawValue.length,
            'cache.value_type': typeof parsedValue
          });

          this.logger.debug('Cache hit', {
            key,
            key_pattern: options?.keyPattern || this.extractKeyPattern(key),
            value_size: rawValue.length,
            tenant_id: context.tenantId
          });

          return parsedValue;

        } catch (error) {
          const cacheDuration = Date.now() - cacheStart;
          this.updateCacheMetrics(cacheDuration, false);
          
          span.setAttributes({
            'cache.result': 'error',
            'cache.duration_ms': cacheDuration,
            'cache.error': error instanceof Error ? error.message : 'Unknown error'
          });

          this.logger.error('Cache get error', {
            key,
            error: error instanceof Error ? error.message : 'Unknown error',
            tenant_id: context.tenantId
          });

          throw error;
        }
      },
      context
    );
  }

  /**
   * Set value in cache with comprehensive instrumentation
   */
  async set<T = any>(
    key: string, 
    value: T, 
    options?: CacheOptions
  ): Promise<void> {
    const context: BusinessContext = {
      ...options?.context
    };

    return this.instrumentation.instrumentCacheOperation(
      'set',
      options?.keyPattern || this.extractKeyPattern(key),
      async (span: api.Span) => {
        const cacheStart = Date.now();
        
        // Serialize value if needed
        const serializedValue = options?.serialize !== false ? 
          JSON.stringify(value) : 
          value as string;

        span.setAttributes({
          [SemanticAttributes.DB_SYSTEM]: 'redis',
          [SemanticAttributes.DB_OPERATION]: 'set',
          [BusinessAttributes.CACHE_OPERATION]: 'set',
          [BusinessAttributes.CACHE_KEY_PATTERN]: options?.keyPattern || this.extractKeyPattern(key),
          [BusinessAttributes.CACHE_TTL]: options?.ttl || 0,
          'cache.key': key,
          'cache.key_length': key.length,
          'cache.value_size_bytes': serializedValue.length,
          'cache.has_ttl': !!options?.ttl
        });

        try {
          if (options?.ttl) {
            await this.client.setex(key, options.ttl, serializedValue);
          } else {
            await this.client.set(key, serializedValue);
          }

          const cacheDuration = Date.now() - cacheStart;
          this.updateCacheMetrics(cacheDuration, true);

          span.setAttributes({
            'cache.result': 'success',
            'cache.duration_ms': cacheDuration
          });

          this.logger.debug('Cache set', {
            key,
            key_pattern: options?.keyPattern || this.extractKeyPattern(key),
            value_size: serializedValue.length,
            ttl: options?.ttl,
            tenant_id: context.tenantId
          });

        } catch (error) {
          const cacheDuration = Date.now() - cacheStart;
          this.updateCacheMetrics(cacheDuration, false);
          
          span.setAttributes({
            'cache.result': 'error',
            'cache.duration_ms': cacheDuration,
            'cache.error': error instanceof Error ? error.message : 'Unknown error'
          });

          this.logger.error('Cache set error', {
            key,
            error: error instanceof Error ? error.message : 'Unknown error',
            tenant_id: context.tenantId
          });

          throw error;
        }
      },
      context
    );
  }

  /**
   * Delete key from cache with instrumentation
   */
  @InstrumentMethod(OperationType.CACHE_ACCESS, 'cache_delete')
  async delete(key: string, context?: BusinessContext): Promise<boolean> {
    const span = api.trace.getActiveSpan();
    
    if (span) {
      span.setAttributes({
        [SemanticAttributes.DB_SYSTEM]: 'redis',
        [SemanticAttributes.DB_OPERATION]: 'del',
        [BusinessAttributes.CACHE_OPERATION]: 'delete',
        [BusinessAttributes.CACHE_KEY_PATTERN]: this.extractKeyPattern(key),
        'cache.key': key
      });
    }

    try {
      const result = await this.client.del(key);
      const deleted = result > 0;

      if (span) {
        span.setAttributes({
          'cache.result': deleted ? 'deleted' : 'not_found',
          'cache.keys_deleted': result
        });
      }

      return deleted;

    } catch (error) {
      if (span) {
        span.setAttributes({
          'cache.result': 'error',
          'cache.error': error instanceof Error ? error.message : 'Unknown error'
        });
      }

      throw error;
    }
  }

  /**
   * Check if key exists with instrumentation
   */
  @InstrumentMethod(OperationType.CACHE_ACCESS, 'cache_exists')
  async exists(key: string, context?: BusinessContext): Promise<boolean> {
    const span = api.trace.getActiveSpan();
    
    if (span) {
      span.setAttributes({
        [SemanticAttributes.DB_SYSTEM]: 'redis',
        [SemanticAttributes.DB_OPERATION]: 'exists',
        [BusinessAttributes.CACHE_OPERATION]: 'exists',
        'cache.key': key
      });
    }

    try {
      const result = await this.client.exists(key);
      const exists = result === 1;

      if (span) {
        span.setAttributes({
          'cache.result': exists ? 'exists' : 'not_exists'
        });
      }

      return exists;

    } catch (error) {
      if (span) {
        span.setAttributes({
          'cache.result': 'error',
          'cache.error': error instanceof Error ? error.message : 'Unknown error'
        });
      }

      throw error;
    }
  }

  /**
   * Get multiple keys with instrumentation
   */
  @InstrumentMethod(OperationType.CACHE_ACCESS, 'cache_mget')
  async mget<T = any>(keys: string[], options?: CacheOptions): Promise<(T | null)[]> {
    const span = api.trace.getActiveSpan();
    
    if (span) {
      span.setAttributes({
        [SemanticAttributes.DB_SYSTEM]: 'redis',
        [SemanticAttributes.DB_OPERATION]: 'mget',
        [BusinessAttributes.CACHE_OPERATION]: 'mget',
        'cache.keys_count': keys.length,
        'cache.keys': keys.join(',')
      });
    }

    try {
      const values = await this.client.mget(...keys);
      
      const parsedValues = values.map(value => {
        if (value === null) return null;
        
        try {
          return options?.serialize !== false ? JSON.parse(value) : value as T;
        } catch {
          return value as T;
        }
      });

      const hitCount = parsedValues.filter(v => v !== null).length;
      const missCount = parsedValues.length - hitCount;

      // Update metrics for batch operation
      this.metrics.cache_hits += hitCount;
      this.metrics.cache_misses += missCount;
      this.metrics.total_operations += parsedValues.length;
      this.updateHitRatio();

      if (span) {
        span.setAttributes({
          'cache.result': 'success',
          'cache.hits': hitCount,
          'cache.misses': missCount,
          'cache.hit_ratio': hitCount / parsedValues.length
        });
      }

      return parsedValues;

    } catch (error) {
      if (span) {
        span.setAttributes({
          'cache.result': 'error',
          'cache.error': error instanceof Error ? error.message : 'Unknown error'
        });
      }

      throw error;
    }
  }

  /**
   * Set multiple keys with instrumentation
   */
  @InstrumentMethod(OperationType.CACHE_ACCESS, 'cache_mset')
  async mset(keyValuePairs: Record<string, any>, options?: CacheOptions): Promise<void> {
    const span = api.trace.getActiveSpan();
    const keys = Object.keys(keyValuePairs);
    
    if (span) {
      span.setAttributes({
        [SemanticAttributes.DB_SYSTEM]: 'redis',
        [SemanticAttributes.DB_OPERATION]: 'mset',
        [BusinessAttributes.CACHE_OPERATION]: 'mset',
        'cache.keys_count': keys.length,
        'cache.has_ttl': !!options?.ttl
      });
    }

    try {
      if (options?.ttl) {
        // Use pipeline for TTL operations
        const pipeline = this.client.pipeline();
        
        for (const [key, value] of Object.entries(keyValuePairs)) {
          const serializedValue = options?.serialize !== false ? 
            JSON.stringify(value) : 
            value as string;
          
          pipeline.setex(key, options.ttl, serializedValue);
        }
        
        await pipeline.exec();
      } else {
        // Serialize all values
        const serializedPairs: Record<string, string> = {};
        for (const [key, value] of Object.entries(keyValuePairs)) {
          serializedPairs[key] = options?.serialize !== false ? 
            JSON.stringify(value) : 
            value as string;
        }
        
        await this.client.mset(serializedPairs);
      }

      if (span) {
        span.setAttributes({
          'cache.result': 'success'
        });
      }

    } catch (error) {
      if (span) {
        span.setAttributes({
          'cache.result': 'error',
          'cache.error': error instanceof Error ? error.message : 'Unknown error'
        });
      }

      throw error;
    }
  }

  /**
   * Store real-time data with instrumentation (specific to monitoring service)
   */
  async storeRealTimeData(organizationId: string, data: any): Promise<void> {
    const context: BusinessContext = {
      organizationId,
      tenantId: organizationId
    };

    const key = `realtime:${organizationId}`;
    await this.set(key, data, {
      ttl: 300, // 5 minutes TTL for real-time data
      context,
      keyPattern: 'realtime:*'
    });
  }

  /**
   * Cache aggregated metrics with instrumentation (specific to monitoring service)
   */
  async cacheAggregatedMetrics(cacheKey: string, data: any): Promise<void> {
    const context: BusinessContext = {
      organizationId: this.extractOrganizationFromKey(cacheKey)
    };

    await this.set(cacheKey, data, {
      ttl: 3600, // 1 hour TTL for aggregated metrics
      context,
      keyPattern: 'aggregated:*'
    });
  }

  /**
   * Collect Redis info metrics
   */
  @InstrumentMethod(OperationType.CACHE_ACCESS, 'collect_redis_info')
  private async collectRedisInfo(): Promise<void> {
    try {
      const info = await this.client.info('memory');
      const keyspace = await this.client.info('keyspace');
      
      // Parse memory info
      const memoryMatch = info.match(/used_memory:(\d+)/);
      if (memoryMatch) {
        this.metrics.memory_usage_bytes = parseInt(memoryMatch[1]);
      }

      // Parse keyspace info
      const keyspaceMatch = keyspace.match(/keys=(\d+),expires=(\d+)/);
      if (keyspaceMatch) {
        this.metrics.key_count = parseInt(keyspaceMatch[1]);
      }

      // Record metrics as business metrics
      this.instrumentation.recordBusinessMetric(
        'redis_memory_usage_bytes',
        this.metrics.memory_usage_bytes
      );

      this.instrumentation.recordBusinessMetric(
        'redis_key_count',
        this.metrics.key_count
      );

      this.instrumentation.recordBusinessMetric(
        'redis_hit_ratio',
        this.metrics.hit_ratio
      );

    } catch (error) {
      this.logger.error('Failed to collect Redis info', error);
    }
  }

  /**
   * Health check with instrumentation
   */
  @InstrumentMethod(OperationType.CACHE_ACCESS, 'health_check')
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> {
    const span = api.trace.getActiveSpan();
    
    try {
      const start = Date.now();
      const pong = await this.client.ping();
      const duration = Date.now() - start;

      const isHealthy = pong === 'PONG';

      if (span) {
        span.setAttributes({
          'health_check.duration_ms': duration,
          'health_check.result': isHealthy ? 'healthy' : 'unhealthy',
          'health_check.response': pong
        });
      }

      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        details: {
          ping_response: pong,
          response_time_ms: duration,
          metrics: this.metrics
        }
      };

    } catch (error) {
      if (span) {
        span.setAttributes({
          'health_check.result': 'unhealthy',
          'health_check.error': error instanceof Error ? error.message : 'Unknown error'
        });
      }

      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Close Redis connection with instrumentation
   */
  @InstrumentMethod(OperationType.CACHE_ACCESS, 'close_connection')
  async close(): Promise<void> {
    const span = api.trace.getActiveSpan();
    
    try {
      await this.client.quit();
      
      if (span) {
        span.setAttributes({
          'redis.connection.closed': true,
          'redis.final_metrics': JSON.stringify(this.metrics)
        });
      }

      this.logger.info('Redis connection closed', {
        final_metrics: this.metrics
      });

    } catch (error) {
      if (span) {
        span.setAttributes({
          'redis.close_error': error instanceof Error ? error.message : 'Unknown error'
        });
      }

      this.logger.error('Error closing Redis connection', error);
      throw error;
    }
  }

  /**
   * Extract key pattern for categorization
   */
  private extractKeyPattern(key: string): string {
    // Replace UUIDs and numbers with placeholders for pattern recognition
    return key
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '{uuid}')
      .replace(/\d+/g, '{number}')
      .replace(/[a-zA-Z0-9]{20,}/g, '{token}');
  }

  /**
   * Extract organization ID from cache key
   */
  private extractOrganizationFromKey(key: string): string | undefined {
    const match = key.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
    return match ? match[1] : undefined;
  }

  /**
   * Update cache metrics
   */
  private updateCacheMetrics(durationMs: number, hit: boolean): void {
    this.metrics.total_operations++;
    
    if (hit) {
      this.metrics.cache_hits++;
    } else {
      this.metrics.cache_misses++;
    }

    // Update average response time
    this.metrics.avg_response_time = 
      ((this.metrics.avg_response_time * (this.metrics.total_operations - 1)) + durationMs) / 
      this.metrics.total_operations;

    this.updateHitRatio();
  }

  /**
   * Update hit ratio
   */
  private updateHitRatio(): void {
    if (this.metrics.total_operations > 0) {
      this.metrics.hit_ratio = this.metrics.cache_hits / this.metrics.total_operations;
    }
  }

  /**
   * Get cache metrics
   */
  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }
}