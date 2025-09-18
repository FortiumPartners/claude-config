/**
 * Performance Tracking Middleware
 * Sprint 8 Task 8.1: Automatic performance monitoring for all API requests
 * 
 * Features:
 * - Request/response time tracking
 * - Database query time monitoring
 * - Cache hit rate measurement
 * - Memory and CPU usage tracking
 * - Automatic CloudWatch metric publishing
 */

import { Request, Response, NextFunction } from 'express';
import { PerformanceOptimizationService } from '../services/performance-optimization.service';
import { CloudWatchMonitoringService } from '../services/cloudwatch-monitoring.service';
import { RedisManager } from '../config/redis.config';
import * as winston from 'winston';

export interface PerformanceMetrics {
  requestId: string;
  method: string;
  path: string;
  statusCode: number;
  responseTime: number;
  databaseQueryTime: number;
  cacheHitRate: number;
  memoryUsage: number;
  cpuUsage: number;
  organizationId?: string;
  userId?: string;
  timestamp: Date;
}

export interface RequestPerformanceContext {
  startTime: number;
  startCpuUsage: NodeJS.CpuUsage;
  startMemory: NodeJS.MemoryUsage;
  databaseQueries: Array<{ duration: number; query: string }>;
  cacheOperations: Array<{ hit: boolean; key: string; operation: 'get' | 'set' }>;
}

/**
 * Performance tracking middleware factory
 */
export function createPerformanceTrackingMiddleware(
  optimizationService: PerformanceOptimizationService,
  cloudwatchService: CloudWatchMonitoringService,
  redisManager: RedisManager,
  logger: winston.Logger,
  config: {
    enableCloudWatchMetrics: boolean;
    enableQueryTracking: boolean;
    sampleRate: number; // 0.0 to 1.0
    slowRequestThresholdMs: number;
    excludePaths: string[];
  }
) {
  return (req: Request & { performance?: RequestPerformanceContext }, res: Response, next: NextFunction) => {
    // Skip excluded paths
    if (config.excludePaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    // Sample requests based on sample rate
    if (Math.random() > config.sampleRate) {
      return next();
    }

    // Initialize performance context
    req.performance = {
      startTime: Date.now(),
      startCpuUsage: process.cpuUsage(),
      startMemory: process.memoryUsage(),
      databaseQueries: [],
      cacheOperations: [],
    };

    // Hook into database queries if enabled
    if (config.enableQueryTracking) {
      setupDatabaseQueryTracking(req, logger);
    }

    // Hook into cache operations
    setupCacheTracking(req, redisManager, logger);

    // Track response completion
    res.on('finish', async () => {
      try {
        await trackRequestCompletion(
          req as Request & { performance: RequestPerformanceContext },
          res,
          optimizationService,
          cloudwatchService,
          logger,
          config
        );
      } catch (error) {
        logger.error('Failed to track request performance', {
          requestId: req.headers['x-request-id'],
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    next();
  };
}

/**
 * Setup database query tracking
 */
function setupDatabaseQueryTracking(
  req: Request & { performance: RequestPerformanceContext },
  logger: winston.Logger
): void {
  // This would typically involve monkey-patching or hooking into the database client
  // For demonstration, we'll simulate query tracking
  const originalQuery = req.app.locals.dbConnection?.query;
  
  if (originalQuery) {
    req.app.locals.dbConnection.query = async function(sql: string, params?: any[]) {
      const queryStart = Date.now();
      
      try {
        const result = await originalQuery.call(this, sql, params);
        const queryDuration = Date.now() - queryStart;
        
        req.performance.databaseQueries.push({
          duration: queryDuration,
          query: sql.substring(0, 100), // Truncate for privacy
        });

        return result;
      } catch (error) {
        const queryDuration = Date.now() - queryStart;
        req.performance.databaseQueries.push({
          duration: queryDuration,
          query: sql.substring(0, 100),
        });
        throw error;
      }
    };
  }
}

/**
 * Setup cache operation tracking
 */
function setupCacheTracking(
  req: Request & { performance: RequestPerformanceContext },
  redisManager: RedisManager,
  logger: winston.Logger
): void {
  // Track cache operations by wrapping Redis methods
  const originalGet = redisManager.getCachedMetrics.bind(redisManager);
  const originalSet = redisManager.cacheMetrics.bind(redisManager);

  // Wrap get operations
  (redisManager as any).getCachedMetrics = async function(key: string) {
    const result = await originalGet(key);
    
    req.performance.cacheOperations.push({
      hit: result !== null,
      key: key.substring(0, 50), // Truncate for privacy
      operation: 'get',
    });

    return result;
  };

  // Wrap set operations
  (redisManager as any).cacheMetrics = async function(key: string, data: any, ttl?: number) {
    const result = await originalSet(key, data, ttl);
    
    req.performance.cacheOperations.push({
      hit: false, // Set operations are always cache misses from tracking perspective
      key: key.substring(0, 50),
      operation: 'set',
    });

    return result;
  };
}

/**
 * Track request completion and publish metrics
 */
async function trackRequestCompletion(
  req: Request & { performance: RequestPerformanceContext },
  res: Response,
  optimizationService: PerformanceOptimizationService,
  cloudwatchService: CloudWatchMonitoringService,
  logger: winston.Logger,
  config: {
    enableCloudWatchMetrics: boolean;
    enableQueryTracking: boolean;
    slowRequestThresholdMs: number;
  }
): Promise<void> {
  const endTime = Date.now();
  const endCpuUsage = process.cpuUsage(req.performance.startCpuUsage);
  const endMemory = process.memoryUsage();

  // Calculate metrics
  const responseTime = endTime - req.performance.startTime;
  const cpuUsagePercent = ((endCpuUsage.user + endCpuUsage.system) / 1000000) * 100; // Convert to percentage
  const memoryUsageMB = endMemory.heapUsed / (1024 * 1024); // Convert to MB

  // Calculate database performance
  const totalDatabaseTime = req.performance.databaseQueries.reduce(
    (sum, query) => sum + query.duration, 0
  );
  const averageQueryTime = req.performance.databaseQueries.length > 0
    ? totalDatabaseTime / req.performance.databaseQueries.length
    : 0;

  // Calculate cache hit rate
  const cacheHits = req.performance.cacheOperations.filter(op => op.hit).length;
  const totalCacheOps = req.performance.cacheOperations.filter(op => op.operation === 'get').length;
  const cacheHitRate = totalCacheOps > 0 ? (cacheHits / totalCacheOps) * 100 : 0;

  // Extract context information
  const organizationId = req.headers['x-tenant-id'] as string || 
                        (req as any).user?.organizationId;
  const userId = (req as any).user?.id;
  const requestId = req.headers['x-request-id'] as string || `req_${Date.now()}_${Math.random()}`;

  // Create performance metrics object
  const metrics: PerformanceMetrics = {
    requestId,
    method: req.method,
    path: req.path,
    statusCode: res.statusCode,
    responseTime,
    databaseQueryTime: averageQueryTime,
    cacheHitRate,
    memoryUsage: memoryUsageMB,
    cpuUsage: cpuUsagePercent,
    organizationId,
    userId,
    timestamp: new Date(),
  };

  // Log performance metrics
  logger.debug('Request performance tracked', {
    ...metrics,
    databaseQueries: req.performance.databaseQueries.length,
    cacheOperations: req.performance.cacheOperations.length,
  });

  // Track with optimization service for analysis
  if (req.performance.databaseQueries.length > 0) {
    await optimizationService.trackQueryPerformance(
      `${req.method}_${req.path}`,
      getQueryType(req.method),
      averageQueryTime,
      req.performance.databaseQueries.length,
      organizationId
    );
  }

  // Publish to CloudWatch if enabled
  if (config.enableCloudWatchMetrics) {
    try {
      await cloudwatchService.publishPerformanceMetrics({
        apiResponseTime: responseTime,
        databaseQueryTime: averageQueryTime,
        cacheHitRate,
        activeConnections: req.performance.databaseQueries.length,
        memoryUsage: endMemory.heapUsed,
        cpuUsage: cpuUsagePercent,
        organizationId,
      });
    } catch (error) {
      logger.warn('Failed to publish CloudWatch metrics', {
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Check for performance issues
  if (responseTime > config.slowRequestThresholdMs) {
    logger.warn('Slow request detected', {
      requestId,
      method: req.method,
      path: req.path,
      responseTime,
      threshold: config.slowRequestThresholdMs,
      organizationId,
    });

    // Emit slow request event for immediate attention
    optimizationService.emit('request:slow', {
      ...metrics,
      threshold: config.slowRequestThresholdMs,
    });
  }

  // Check for low cache hit rate
  if (totalCacheOps > 0 && cacheHitRate < 50) {
    logger.warn('Low cache hit rate detected', {
      requestId,
      cacheHitRate,
      cacheOperations: totalCacheOps,
      organizationId,
    });

    optimizationService.emit('cache:low_hit_rate', {
      requestId,
      cacheHitRate,
      path: req.path,
      organizationId,
    });
  }

  // Check for excessive database queries
  if (req.performance.databaseQueries.length > 10) {
    logger.warn('Excessive database queries detected', {
      requestId,
      queryCount: req.performance.databaseQueries.length,
      totalTime: totalDatabaseTime,
      organizationId,
    });

    optimizationService.emit('database:excessive_queries', {
      requestId,
      queryCount: req.performance.databaseQueries.length,
      totalTime: totalDatabaseTime,
      path: req.path,
      organizationId,
    });
  }
}

/**
 * Helper function to determine query type from HTTP method
 */
function getQueryType(method: string): 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'AGGREGATE' {
  switch (method.toLowerCase()) {
    case 'get':
      return 'SELECT';
    case 'post':
      return 'INSERT';
    case 'put':
    case 'patch':
      return 'UPDATE';
    case 'delete':
      return 'DELETE';
    default:
      return 'SELECT';
  }
}

/**
 * Performance summary middleware for health checks
 */
export function createPerformanceSummaryMiddleware(
  optimizationService: PerformanceOptimizationService,
  logger: winston.Logger
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/api/v1/performance/summary') {
      try {
        const insights = await optimizationService.getDatabaseInsights();
        const recommendations = await optimizationService.getOptimizationRecommendations();

        res.json({
          status: 'success',
          data: {
            performance: insights,
            recommendations: recommendations.slice(0, 5), // Top 5 recommendations
          },
          meta: {
            timestamp: new Date().toISOString(),
            version: '1.0.0',
          },
        });
      } catch (error) {
        logger.error('Failed to get performance summary', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        res.status(500).json({
          status: 'error',
          error: 'Failed to retrieve performance summary',
          meta: {
            timestamp: new Date().toISOString(),
          },
        });
      }
    } else {
      next();
    }
  };
}

/**
 * Performance optimization endpoint middleware
 */
export function createOptimizationEndpointMiddleware(
  optimizationService: PerformanceOptimizationService,
  logger: winston.Logger
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/api/v1/performance/optimize' && req.method === 'POST') {
      try {
        const { optimizationId } = req.body;

        if (!optimizationId) {
          return res.status(400).json({
            status: 'error',
            error: 'optimizationId is required',
          });
        }

        const success = await optimizationService.implementOptimization(optimizationId);

        res.json({
          status: 'success',
          data: {
            optimizationId,
            implemented: success,
          },
          meta: {
            timestamp: new Date().toISOString(),
          },
        });

      } catch (error) {
        logger.error('Failed to implement optimization', {
          optimizationId: req.body.optimizationId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        res.status(500).json({
          status: 'error',
          error: 'Failed to implement optimization',
          meta: {
            timestamp: new Date().toISOString(),
          },
        });
      }
    } else {
      next();
    }
  };
}