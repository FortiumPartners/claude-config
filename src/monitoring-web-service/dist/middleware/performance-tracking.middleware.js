"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPerformanceTrackingMiddleware = createPerformanceTrackingMiddleware;
exports.createPerformanceSummaryMiddleware = createPerformanceSummaryMiddleware;
exports.createOptimizationEndpointMiddleware = createOptimizationEndpointMiddleware;
function createPerformanceTrackingMiddleware(optimizationService, cloudwatchService, redisManager, logger, config) {
    return (req, res, next) => {
        if (config.excludePaths.some(path => req.path.startsWith(path))) {
            return next();
        }
        if (Math.random() > config.sampleRate) {
            return next();
        }
        req.performance = {
            startTime: Date.now(),
            startCpuUsage: process.cpuUsage(),
            startMemory: process.memoryUsage(),
            databaseQueries: [],
            cacheOperations: [],
        };
        if (config.enableQueryTracking) {
            setupDatabaseQueryTracking(req, logger);
        }
        setupCacheTracking(req, redisManager, logger);
        res.on('finish', async () => {
            try {
                await trackRequestCompletion(req, res, optimizationService, cloudwatchService, logger, config);
            }
            catch (error) {
                logger.error('Failed to track request performance', {
                    requestId: req.headers['x-request-id'],
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        });
        next();
    };
}
function setupDatabaseQueryTracking(req, logger) {
    const originalQuery = req.app.locals.dbConnection?.query;
    if (originalQuery) {
        req.app.locals.dbConnection.query = async function (sql, params) {
            const queryStart = Date.now();
            try {
                const result = await originalQuery.call(this, sql, params);
                const queryDuration = Date.now() - queryStart;
                req.performance.databaseQueries.push({
                    duration: queryDuration,
                    query: sql.substring(0, 100),
                });
                return result;
            }
            catch (error) {
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
function setupCacheTracking(req, redisManager, logger) {
    const originalGet = redisManager.getCachedMetrics.bind(redisManager);
    const originalSet = redisManager.cacheMetrics.bind(redisManager);
    redisManager.getCachedMetrics = async function (key) {
        const result = await originalGet(key);
        req.performance.cacheOperations.push({
            hit: result !== null,
            key: key.substring(0, 50),
            operation: 'get',
        });
        return result;
    };
    redisManager.cacheMetrics = async function (key, data, ttl) {
        const result = await originalSet(key, data, ttl);
        req.performance.cacheOperations.push({
            hit: false,
            key: key.substring(0, 50),
            operation: 'set',
        });
        return result;
    };
}
async function trackRequestCompletion(req, res, optimizationService, cloudwatchService, logger, config) {
    const endTime = Date.now();
    const endCpuUsage = process.cpuUsage(req.performance.startCpuUsage);
    const endMemory = process.memoryUsage();
    const responseTime = endTime - req.performance.startTime;
    const cpuUsagePercent = ((endCpuUsage.user + endCpuUsage.system) / 1000000) * 100;
    const memoryUsageMB = endMemory.heapUsed / (1024 * 1024);
    const totalDatabaseTime = req.performance.databaseQueries.reduce((sum, query) => sum + query.duration, 0);
    const averageQueryTime = req.performance.databaseQueries.length > 0
        ? totalDatabaseTime / req.performance.databaseQueries.length
        : 0;
    const cacheHits = req.performance.cacheOperations.filter(op => op.hit).length;
    const totalCacheOps = req.performance.cacheOperations.filter(op => op.operation === 'get').length;
    const cacheHitRate = totalCacheOps > 0 ? (cacheHits / totalCacheOps) * 100 : 0;
    const organizationId = req.headers['x-tenant-id'] ||
        req.user?.organizationId;
    const userId = req.user?.id;
    const requestId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random()}`;
    const metrics = {
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
    logger.debug('Request performance tracked', {
        ...metrics,
        databaseQueries: req.performance.databaseQueries.length,
        cacheOperations: req.performance.cacheOperations.length,
    });
    if (req.performance.databaseQueries.length > 0) {
        await optimizationService.trackQueryPerformance(`${req.method}_${req.path}`, getQueryType(req.method), averageQueryTime, req.performance.databaseQueries.length, organizationId);
    }
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
        }
        catch (error) {
            logger.warn('Failed to publish CloudWatch metrics', {
                requestId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    if (responseTime > config.slowRequestThresholdMs) {
        logger.warn('Slow request detected', {
            requestId,
            method: req.method,
            path: req.path,
            responseTime,
            threshold: config.slowRequestThresholdMs,
            organizationId,
        });
        optimizationService.emit('request:slow', {
            ...metrics,
            threshold: config.slowRequestThresholdMs,
        });
    }
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
function getQueryType(method) {
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
function createPerformanceSummaryMiddleware(optimizationService, logger) {
    return async (req, res, next) => {
        if (req.path === '/api/v1/performance/summary') {
            try {
                const insights = await optimizationService.getDatabaseInsights();
                const recommendations = await optimizationService.getOptimizationRecommendations();
                res.json({
                    status: 'success',
                    data: {
                        performance: insights,
                        recommendations: recommendations.slice(0, 5),
                    },
                    meta: {
                        timestamp: new Date().toISOString(),
                        version: '1.0.0',
                    },
                });
            }
            catch (error) {
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
        }
        else {
            next();
        }
    };
}
function createOptimizationEndpointMiddleware(optimizationService, logger) {
    return async (req, res, next) => {
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
            }
            catch (error) {
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
        }
        else {
            next();
        }
    };
}
//# sourceMappingURL=performance-tracking.middleware.js.map