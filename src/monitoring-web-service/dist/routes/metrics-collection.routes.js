"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMetricsCollectionRoutes = createMetricsCollectionRoutes;
const express_1 = require("express");
const metrics_collection_service_1 = require("../services/metrics-collection.service");
const auth_middleware_1 = require("../middleware/auth.middleware");
const validation_middleware_1 = require("../middleware/validation.middleware");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
function createMetricsCollectionRoutes(db, logger) {
    const router = (0, express_1.Router)();
    const metricsService = new metrics_collection_service_1.MetricsCollectionService(db, logger);
    const standardRateLimit = (0, express_rate_limit_1.default)({
        windowMs: 60 * 1000,
        max: 1000,
        message: {
            error: 'Too many requests',
            message: 'Rate limit exceeded. Please try again later.',
            retry_after: 60
        },
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => {
            return req.user?.organization_id || req.ip;
        }
    });
    const batchRateLimit = (0, express_rate_limit_1.default)({
        windowMs: 60 * 1000,
        max: 100,
        message: {
            error: 'Too many batch requests',
            message: 'Batch rate limit exceeded. Please try again later.',
            retry_after: 60
        },
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => {
            return req.user?.organization_id || req.ip;
        }
    });
    router.post('/commands', standardRateLimit, auth_middleware_1.authMiddleware, validation_middleware_1.validationMiddleware, async (req, res) => {
        try {
            if (!req.user?.organization_id) {
                return res.status(401).json({
                    error: 'Unauthorized',
                    message: 'Organization context required'
                });
            }
            const result = await metricsService.collectCommandExecution(req.user.organization_id, req.body);
            if (result.rate_limit) {
                res.set({
                    'X-RateLimit-Limit': result.rate_limit.limit.toString(),
                    'X-RateLimit-Remaining': result.rate_limit.remaining.toString(),
                    'X-RateLimit-Reset': result.rate_limit.reset_time.toISOString()
                });
                if (result.rate_limit.retry_after) {
                    res.set('Retry-After', result.rate_limit.retry_after.toString());
                }
            }
            if (result.performance) {
                res.set('X-Processing-Time', result.performance.processing_latency_ms?.toString() || '0');
            }
            if (!result.success) {
                return res.status(result.message === 'Rate limit exceeded' ? 429 : 400).json({
                    error: 'Collection failed',
                    message: result.message
                });
            }
            res.status(201).json({
                success: true,
                data: result.data,
                message: 'Command execution collected successfully'
            });
        }
        catch (error) {
            logger.error('Command execution collection endpoint error', {
                organization_id: req.user?.organization_id,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            res.status(500).json({
                error: 'Internal server error',
                message: 'Failed to collect command execution'
            });
        }
    });
    router.post('/agents', standardRateLimit, auth_middleware_1.authMiddleware, validation_middleware_1.validationMiddleware, async (req, res) => {
        try {
            if (!req.user?.organization_id) {
                return res.status(401).json({
                    error: 'Unauthorized',
                    message: 'Organization context required'
                });
            }
            const result = await metricsService.collectAgentInteraction(req.user.organization_id, req.body);
            if (result.rate_limit) {
                res.set({
                    'X-RateLimit-Limit': result.rate_limit.limit.toString(),
                    'X-RateLimit-Remaining': result.rate_limit.remaining.toString(),
                    'X-RateLimit-Reset': result.rate_limit.reset_time.toISOString()
                });
                if (result.rate_limit.retry_after) {
                    res.set('Retry-After', result.rate_limit.retry_after.toString());
                }
            }
            if (result.performance) {
                res.set('X-Processing-Time', result.performance.processing_latency_ms?.toString() || '0');
            }
            if (!result.success) {
                return res.status(result.message === 'Rate limit exceeded' ? 429 : 400).json({
                    error: 'Collection failed',
                    message: result.message
                });
            }
            res.status(201).json({
                success: true,
                data: result.data,
                message: 'Agent interaction collected successfully'
            });
        }
        catch (error) {
            logger.error('Agent interaction collection endpoint error', {
                organization_id: req.user?.organization_id,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            res.status(500).json({
                error: 'Internal server error',
                message: 'Failed to collect agent interaction'
            });
        }
    });
    router.post('/sessions/start', standardRateLimit, auth_middleware_1.authMiddleware, validation_middleware_1.validationMiddleware, async (req, res) => {
        try {
            if (!req.user?.organization_id) {
                return res.status(401).json({
                    error: 'Unauthorized',
                    message: 'Organization context required'
                });
            }
            if (!req.body.user_id) {
                req.body.user_id = req.user.id;
            }
            const result = await metricsService.startUserSession(req.user.organization_id, req.body);
            if (result.rate_limit) {
                res.set({
                    'X-RateLimit-Limit': result.rate_limit.limit.toString(),
                    'X-RateLimit-Remaining': result.rate_limit.remaining.toString(),
                    'X-RateLimit-Reset': result.rate_limit.reset_time.toISOString()
                });
                if (result.rate_limit.retry_after) {
                    res.set('Retry-After', result.rate_limit.retry_after.toString());
                }
            }
            if (result.performance) {
                res.set('X-Processing-Time', result.performance.processing_latency_ms?.toString() || '0');
            }
            if (!result.success) {
                return res.status(result.message === 'Rate limit exceeded' ? 429 : 400).json({
                    error: 'Session start failed',
                    message: result.message
                });
            }
            const statusCode = result.message === 'User already has an active session' ? 200 : 201;
            res.status(statusCode).json({
                success: true,
                data: result.data,
                message: result.message || 'User session started successfully'
            });
        }
        catch (error) {
            logger.error('Session start endpoint error', {
                organization_id: req.user?.organization_id,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            res.status(500).json({
                error: 'Internal server error',
                message: 'Failed to start user session'
            });
        }
    });
    router.put('/sessions/:sessionId', standardRateLimit, auth_middleware_1.authMiddleware, validation_middleware_1.validationMiddleware, async (req, res) => {
        try {
            if (!req.user?.organization_id) {
                return res.status(401).json({
                    error: 'Unauthorized',
                    message: 'Organization context required'
                });
            }
            const sessionId = req.params.sessionId;
            if (!sessionId) {
                return res.status(400).json({
                    error: 'Bad request',
                    message: 'Session ID is required'
                });
            }
            const result = await metricsService.updateUserSession(req.user.organization_id, sessionId, req.body);
            if (result.rate_limit) {
                res.set({
                    'X-RateLimit-Limit': result.rate_limit.limit.toString(),
                    'X-RateLimit-Remaining': result.rate_limit.remaining.toString(),
                    'X-RateLimit-Reset': result.rate_limit.reset_time.toISOString()
                });
                if (result.rate_limit.retry_after) {
                    res.set('Retry-After', result.rate_limit.retry_after.toString());
                }
            }
            if (result.performance) {
                res.set('X-Processing-Time', result.performance.processing_latency_ms?.toString() || '0');
            }
            if (!result.success) {
                const statusCode = result.message === 'Session not found' ? 404 :
                    result.message === 'Rate limit exceeded' ? 429 : 400;
                return res.status(statusCode).json({
                    error: 'Session update failed',
                    message: result.message
                });
            }
            res.status(200).json({
                success: true,
                data: result.data,
                message: 'User session updated successfully'
            });
        }
        catch (error) {
            logger.error('Session update endpoint error', {
                organization_id: req.user?.organization_id,
                session_id: req.params.sessionId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            res.status(500).json({
                error: 'Internal server error',
                message: 'Failed to update user session'
            });
        }
    });
    router.post('/productivity', standardRateLimit, auth_middleware_1.authMiddleware, validation_middleware_1.validationMiddleware, async (req, res) => {
        try {
            if (!req.user?.organization_id) {
                return res.status(401).json({
                    error: 'Unauthorized',
                    message: 'Organization context required'
                });
            }
            const result = await metricsService.collectProductivityMetric(req.user.organization_id, req.body);
            if (result.rate_limit) {
                res.set({
                    'X-RateLimit-Limit': result.rate_limit.limit.toString(),
                    'X-RateLimit-Remaining': result.rate_limit.remaining.toString(),
                    'X-RateLimit-Reset': result.rate_limit.reset_time.toISOString()
                });
                if (result.rate_limit.retry_after) {
                    res.set('Retry-After', result.rate_limit.retry_after.toString());
                }
            }
            if (result.performance) {
                res.set('X-Processing-Time', result.performance.processing_latency_ms?.toString() || '0');
            }
            if (!result.success) {
                return res.status(result.message === 'Rate limit exceeded' ? 429 : 400).json({
                    error: 'Collection failed',
                    message: result.message
                });
            }
            res.status(201).json({
                success: true,
                data: result.data,
                message: 'Productivity metric collected successfully'
            });
        }
        catch (error) {
            logger.error('Productivity metric collection endpoint error', {
                organization_id: req.user?.organization_id,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            res.status(500).json({
                error: 'Internal server error',
                message: 'Failed to collect productivity metric'
            });
        }
    });
    router.post('/batch', batchRateLimit, auth_middleware_1.authMiddleware, validation_middleware_1.validationMiddleware, async (req, res) => {
        try {
            if (!req.user?.organization_id) {
                return res.status(401).json({
                    error: 'Unauthorized',
                    message: 'Organization context required'
                });
            }
            const result = await metricsService.collectBatchMetrics(req.user.organization_id, req.body);
            if (result.rate_limit) {
                res.set({
                    'X-RateLimit-Limit': result.rate_limit.limit.toString(),
                    'X-RateLimit-Remaining': result.rate_limit.remaining.toString(),
                    'X-RateLimit-Reset': result.rate_limit.reset_time.toISOString()
                });
                if (result.rate_limit.retry_after) {
                    res.set('Retry-After', result.rate_limit.retry_after.toString());
                }
            }
            if (result.performance) {
                res.set('X-Processing-Time', result.performance.processing_latency_ms?.toString() || '0');
                res.set('X-Ingestion-Rate', result.performance.ingestion_rate?.toString() || '0');
            }
            if (!result.success) {
                return res.status(result.message === 'Rate limit exceeded for batch operation' ? 429 : 400).json({
                    error: 'Batch collection failed',
                    message: result.message
                });
            }
            res.status(201).json({
                success: true,
                data: result.data,
                message: 'Batch metrics collected successfully'
            });
        }
        catch (error) {
            logger.error('Batch collection endpoint error', {
                organization_id: req.user?.organization_id,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            res.status(500).json({
                error: 'Internal server error',
                message: 'Failed to collect batch metrics'
            });
        }
    });
    router.get('/health', auth_middleware_1.authMiddleware, async (req, res) => {
        try {
            const performanceMetrics = await metricsService.getPerformanceMetrics();
            const collectionStats = metricsService.getCollectionStats();
            res.status(200).json({
                status: 'healthy',
                performance: performanceMetrics,
                collection_stats: collectionStats,
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            logger.error('Health endpoint error', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            res.status(500).json({
                status: 'unhealthy',
                error: 'Failed to get health status',
                timestamp: new Date().toISOString()
            });
        }
    });
    router.get('/stats', auth_middleware_1.authMiddleware, async (req, res) => {
        try {
            if (req.user?.role !== 'admin') {
                return res.status(403).json({
                    error: 'Forbidden',
                    message: 'Admin access required'
                });
            }
            const collectionStats = metricsService.getCollectionStats();
            const performanceMetrics = await metricsService.getPerformanceMetrics();
            res.status(200).json({
                collection_stats: collectionStats,
                performance_metrics: performanceMetrics,
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            logger.error('Stats endpoint error', {
                organization_id: req.user?.organization_id,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            res.status(500).json({
                error: 'Internal server error',
                message: 'Failed to get collection statistics'
            });
        }
    });
    return { router };
}
//# sourceMappingURL=metrics-collection.routes.js.map