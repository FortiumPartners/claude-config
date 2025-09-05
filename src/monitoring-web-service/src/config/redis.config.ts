/**
 * Redis Configuration for Caching and Real-Time Data
 * Task 3.3: Redis configuration for metrics caching and pub/sub
 */

import Redis, { RedisOptions } from 'ioredis';
import * as winston from 'winston';

export interface MetricsRedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  connectionTimeout?: number;
  commandTimeout?: number;
  retryDelayOnFailover?: number;
  enableReadyCheck?: boolean;
  maxRetriesPerRequest?: number;
  lazyConnect?: boolean;
  keepAlive?: number;
  family?: number;
  cluster?: {
    hosts: Array<{ host: string; port: number }>;
  };
}

export class RedisManager {
  private redis: Redis;
  private pubRedis: Redis;
  private subRedis: Redis;
  private logger: winston.Logger;
  private config: MetricsRedisConfig;

  // Cache key prefixes for different data types
  public readonly keyPrefixes = {
    METRICS_CACHE: 'metrics:cache:',
    AGGREGATION_CACHE: 'aggregation:cache:',
    REAL_TIME_DATA: 'realtime:data:',
    RATE_LIMIT: 'rate_limit:',
    SESSION: 'session:',
    ALERT_STATE: 'alert:state:',
    PROCESSING_LOCK: 'processing:lock:'
  };

  // TTL values in seconds
  public readonly ttl = {
    METRICS_CACHE: 3600, // 1 hour
    AGGREGATION_CACHE: 7200, // 2 hours
    REAL_TIME_DATA: 300, // 5 minutes
    RATE_LIMIT: 60, // 1 minute
    SESSION: 86400, // 24 hours
    ALERT_STATE: 1800, // 30 minutes
    PROCESSING_LOCK: 300 // 5 minutes
  };

  constructor(config: MetricsRedisConfig, logger: winston.Logger) {
    this.config = config;
    this.logger = logger;

    const redisOptions = this.buildRedisOptions(config);

    // Main Redis connection for general operations
    this.redis = new Redis(redisOptions);

    // Separate connections for pub/sub to avoid blocking
    this.pubRedis = new Redis(redisOptions);
    this.subRedis = new Redis(redisOptions);

    this.setupEventHandlers();
  }

  private buildRedisOptions(config: MetricsRedisConfig): RedisOptions {
    const options: RedisOptions = {
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db || 0,
      keyPrefix: config.keyPrefix || 'fortium:metrics:',
      connectionTimeout: config.connectionTimeout || 10000,
      commandTimeout: config.commandTimeout || 5000,
      retryDelayOnFailover: config.retryDelayOnFailover || 100,
      enableReadyCheck: config.enableReadyCheck !== false,
      maxRetriesPerRequest: config.maxRetriesPerRequest || 3,
      lazyConnect: config.lazyConnect || true,
      keepAlive: config.keepAlive || 30000,
      family: config.family || 4,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      reconnectOnError: (err) => {
        const targetErrors = ['READONLY', 'ECONNRESET', 'EPIPE'];
        return targetErrors.some(targetError => err.message.includes(targetError));
      }
    };

    // Add cluster configuration if provided
    if (config.cluster) {
      return {
        ...options,
        enableOfflineQueue: false,
        // Cluster-specific options would go here
      };
    }

    return options;
  }

  private setupEventHandlers(): void {
    // Main Redis connection events
    this.redis.on('connect', () => {
      this.logger.info('Redis main connection established');
    });

    this.redis.on('ready', () => {
      this.logger.info('Redis main connection ready');
    });

    this.redis.on('error', (error) => {
      this.logger.error('Redis main connection error', {
        error: error.message,
        code: (error as any).code
      });
    });

    this.redis.on('close', () => {
      this.logger.warn('Redis main connection closed');
    });

    this.redis.on('reconnecting', () => {
      this.logger.info('Redis main connection reconnecting');
    });

    // Pub Redis connection events
    this.pubRedis.on('connect', () => {
      this.logger.info('Redis pub connection established');
    });

    this.pubRedis.on('error', (error) => {
      this.logger.error('Redis pub connection error', {
        error: error.message
      });
    });

    // Sub Redis connection events
    this.subRedis.on('connect', () => {
      this.logger.info('Redis sub connection established');
    });

    this.subRedis.on('error', (error) => {
      this.logger.error('Redis sub connection error', {
        error: error.message
      });
    });
  }

  /**
   * Get main Redis instance
   */
  getRedis(): Redis {
    return this.redis;
  }

  /**
   * Get publisher Redis instance
   */
  getPublisher(): Redis {
    return this.pubRedis;
  }

  /**
   * Get subscriber Redis instance
   */
  getSubscriber(): Redis {
    return this.subRedis;
  }

  /**
   * Cache metrics data with appropriate TTL
   */
  async cacheMetrics(key: string, data: any, ttl: number = this.ttl.METRICS_CACHE): Promise<void> {
    try {
      const cacheKey = this.keyPrefixes.METRICS_CACHE + key;
      await this.redis.setex(cacheKey, ttl, JSON.stringify(data));
    } catch (error) {
      this.logger.error('Failed to cache metrics data', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get cached metrics data
   */
  async getCachedMetrics(key: string): Promise<any | null> {
    try {
      const cacheKey = this.keyPrefixes.METRICS_CACHE + key;
      const cached = await this.redis.get(cacheKey);
      
      if (!cached) {
        return null;
      }

      return JSON.parse(cached);
    } catch (error) {
      this.logger.error('Failed to get cached metrics data', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Cache aggregated metrics data
   */
  async cacheAggregatedMetrics(key: string, data: any, ttl: number = this.ttl.AGGREGATION_CACHE): Promise<void> {
    try {
      const cacheKey = this.keyPrefixes.AGGREGATION_CACHE + key;
      await this.redis.setex(cacheKey, ttl, JSON.stringify(data));
    } catch (error) {
      this.logger.error('Failed to cache aggregated metrics', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get cached aggregated metrics
   */
  async getCachedAggregatedMetrics(key: string): Promise<any | null> {
    try {
      const cacheKey = this.keyPrefixes.AGGREGATION_CACHE + key;
      const cached = await this.redis.get(cacheKey);
      
      if (!cached) {
        return null;
      }

      return JSON.parse(cached);
    } catch (error) {
      this.logger.error('Failed to get cached aggregated metrics', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Store real-time data for dashboard updates
   */
  async storeRealTimeData(organizationId: string, data: any): Promise<void> {
    try {
      const key = this.keyPrefixes.REAL_TIME_DATA + organizationId;
      await this.redis.setex(key, this.ttl.REAL_TIME_DATA, JSON.stringify(data));
      
      // Also publish to subscribers for immediate updates
      await this.pubRedis.publish(`realtime:${organizationId}`, JSON.stringify(data));
    } catch (error) {
      this.logger.error('Failed to store real-time data', {
        organizationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Subscribe to real-time updates for an organization
   */
  async subscribeToRealTimeUpdates(organizationId: string, callback: (data: any) => void): Promise<void> {
    try {
      const channel = `realtime:${organizationId}`;
      
      this.subRedis.subscribe(channel, (err) => {
        if (err) {
          this.logger.error('Failed to subscribe to real-time updates', {
            organizationId,
            error: err.message
          });
          return;
        }
        
        this.logger.info('Subscribed to real-time updates', { organizationId });
      });

      this.subRedis.on('message', (receivedChannel, message) => {
        if (receivedChannel === channel) {
          try {
            const data = JSON.parse(message);
            callback(data);
          } catch (error) {
            this.logger.error('Failed to parse real-time update message', {
              organizationId,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }
      });
    } catch (error) {
      this.logger.error('Failed to setup real-time subscription', {
        organizationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Implement distributed locking for processing operations
   */
  async acquireProcessingLock(key: string, ttl: number = this.ttl.PROCESSING_LOCK): Promise<boolean> {
    try {
      const lockKey = this.keyPrefixes.PROCESSING_LOCK + key;
      const result = await this.redis.set(lockKey, Date.now().toString(), 'EX', ttl, 'NX');
      return result === 'OK';
    } catch (error) {
      this.logger.error('Failed to acquire processing lock', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Release distributed processing lock
   */
  async releaseProcessingLock(key: string): Promise<void> {
    try {
      const lockKey = this.keyPrefixes.PROCESSING_LOCK + key;
      await this.redis.del(lockKey);
    } catch (error) {
      this.logger.error('Failed to release processing lock', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Store rate limit information
   */
  async setRateLimit(identifier: string, count: number, windowMs: number): Promise<void> {
    try {
      const key = this.keyPrefixes.RATE_LIMIT + identifier;
      await this.redis.setex(key, Math.ceil(windowMs / 1000), count.toString());
    } catch (error) {
      this.logger.error('Failed to set rate limit', {
        identifier,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get rate limit information
   */
  async getRateLimit(identifier: string): Promise<number | null> {
    try {
      const key = this.keyPrefixes.RATE_LIMIT + identifier;
      const result = await this.redis.get(key);
      return result ? parseInt(result, 10) : null;
    } catch (error) {
      this.logger.error('Failed to get rate limit', {
        identifier,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Health check for Redis connectivity
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> {
    try {
      // Test main connection
      const pingResult = await this.redis.ping();
      
      if (pingResult !== 'PONG') {
        return {
          status: 'unhealthy',
          details: { error: 'Redis ping failed', result: pingResult }
        };
      }

      // Get Redis info
      const info = await this.redis.info('memory');
      const memoryInfo = this.parseRedisInfo(info);

      return {
        status: 'healthy',
        details: {
          ping: pingResult,
          host: this.config.host,
          port: this.config.port,
          db: this.config.db || 0,
          memory: memoryInfo
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          host: this.config.host,
          port: this.config.port
        }
      };
    }
  }

  /**
   * Parse Redis INFO command output
   */
  private parseRedisInfo(info: string): Record<string, string> {
    const result: Record<string, string> = {};
    
    info.split('\r\n').forEach(line => {
      if (line && !line.startsWith('#')) {
        const [key, value] = line.split(':');
        if (key && value) {
          result[key] = value;
        }
      }
    });

    return result;
  }

  /**
   * Close all Redis connections
   */
  async close(): Promise<void> {
    await Promise.all([
      this.redis.disconnect(),
      this.pubRedis.disconnect(),
      this.subRedis.disconnect()
    ]);

    this.logger.info('All Redis connections closed');
  }
}

/**
 * Default Redis configuration based on environment
 */
export function getDefaultRedisConfig(): MetricsRedisConfig {
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0', 10),
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'fortium:metrics:',
    connectionTimeout: 10000,
    commandTimeout: 5000,
    retryDelayOnFailover: 100,
    enableReadyCheck: true,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    keepAlive: 30000,
    family: 4
  };
}