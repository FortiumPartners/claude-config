"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMetricsCollectionRoutes = createMetricsCollectionRoutes;
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const metrics_controller_1 = require("../controllers/metrics.controller");
const metrics_session_service_1 = require("../services/metrics-session.service");
const tool_metrics_service_1 = require("../services/tool-metrics.service");
const metrics_collection_service_1 = require("../services/metrics-collection.service");
const data_sync_service_1 = require("../services/data-sync.service");
const metrics_processor_1 = require("../processors/metrics.processor");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
function createMetricsCollectionRoutes(db, logger) {
    const router = (0, express_1.Router)();
    const sessionService = new metrics_session_service_1.MetricsSessionService(db, logger);
    const toolMetricsService = new tool_metrics_service_1.ToolMetricsService(db, logger);
    const collectionService = new metrics_collection_service_1.MetricsCollectionService(db, logger);
    const metricsProcessor = new metrics_processor_1.MetricsProcessor(logger);
    const syncService = new data_sync_service_1.DataSyncService(db, logger, {
        url: process.env.REMOTE_METRICS_ENDPOINT || 'http://localhost:3000',
        api_key: process.env.REMOTE_METRICS_API_KEY || 'default-key',
        timeout_ms: parseInt(process.env.SYNC_TIMEOUT_MS || '5000'),
        retry_attempts: parseInt(process.env.SYNC_RETRY_ATTEMPTS || '3'),
        health_check_interval_ms: parseInt(process.env.HEALTH_CHECK_INTERVAL_MS || '60000')
    });
    const controller = new metrics_controller_1.MetricsController({
        sessionService,
        toolMetricsService,
        collectionService,
        syncService,
        logger
    });
    const standardRateLimit = (0, express_rate_limit_1.default)({
        windowMs: 15 * 60 * 1000,
        max: 1000,
        message: {
            error: 'Rate limit exceeded for standard operations',
            retry_after: 15 * 60,
            limit_type: 'standard'
        },
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => req.user?.organization_id || req.ip,
        handler: (req, res) => {
            logger.warn('Rate limit exceeded', {
                organization_id: req.user?.organization_id,
                ip: req.ip,
                endpoint: req.path
            });
            res.status(429).json({
                success: false,
                error: 'Rate limit exceeded for standard operations',
                retry_after: 15 * 60,
                limit_type: 'standard'
            });
        }
    });
    const bulkRateLimit = (0, express_rate_limit_1.default)({
        windowMs: 15 * 60 * 1000,
        max: 10,
        message: {
            error: 'Bulk import rate limit exceeded',
            retry_after: 15 * 60,
            limit_type: 'bulk'
        },
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => req.user?.organization_id || req.ip,
        handler: (req, res) => {
            logger.warn('Bulk rate limit exceeded', {
                organization_id: req.user?.organization_id,
                ip: req.ip
            });
            res.status(429).json({
                success: false,
                error: 'Bulk import rate limit exceeded',
                retry_after: 15 * 60,
                limit_type: 'bulk'
            });
        }
    });
    const queryRateLimit = (0, express_rate_limit_1.default)({
        windowMs: 1 * 60 * 1000,
        max: 50,
        message: {
            error: 'Query rate limit exceeded',
            retry_after: 60,
            limit_type: 'query'
        },
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => req.user?.organization_id || req.ip
    });
    const criticalRateLimit = (0, express_rate_limit_1.default)({
        windowMs: 5 * 60 * 1000,
        max: 2000,
        message: {
            error: 'Critical endpoint rate limit exceeded',
            retry_after: 5 * 60,
            limit_type: 'critical'
        },
        keyGenerator: (req) => req.user?.organization_id || req.ip
    });
    router.get('/health', controller.getHealth.bind(controller));
    router.use(auth_middleware_1.authMiddleware);
    router.post('/sessions', standardRateLimit, controller.createSession.bind(controller));
    router.put('/sessions/:id', criticalRateLimit, controller.updateSession.bind(controller));
    router.get('/sessions', standardRateLimit, controller.listSessions.bind(controller));
    router.get('/sessions/:id', standardRateLimit, controller.getSession.bind(controller));
    router.delete('/sessions/:id', standardRateLimit, controller.endSession.bind(controller));
    router.post('/tools', criticalRateLimit, controller.recordToolUsage.bind(controller));
    router.get('/tools', standardRateLimit, controller.getToolAnalytics.bind(controller));
    router.get('/tools/:name/trends', queryRateLimit, controller.getToolTrends.bind(controller));
    router.post('/commands', criticalRateLimit, controller.recordCommandExecution.bind(controller));
    router.post('/interactions', criticalRateLimit, controller.recordAgentInteraction.bind(controller));
    router.post('/productivity', standardRateLimit, controller.recordProductivityMetric.bind(controller));
    router.post('/bulk', bulkRateLimit, controller.bulkImport.bind(controller));
    router.get('/bulk/:batchId', standardRateLimit, controller.getBatchProgress.bind(controller));
    router.get('/performance', queryRateLimit, controller.getPerformanceSummary.bind(controller));
    router.get('/alerts', standardRateLimit, controller.getPerformanceAlerts.bind(controller));
    router.post('/query', queryRateLimit, controller.queryMetrics.bind(controller));
    router.get('/processing/stats', standardRateLimit, async (req, res) => {
        try {
            const stats = metricsProcessor.getProcessingStatistics();
            res.json({
                success: true,
                data: stats,
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            logger.error('Failed to get processing stats', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve processing statistics'
            });
        }
    });
    router.post('/processing/reset', standardRateLimit, async (req, res) => {
        try {
            metricsProcessor.resetStatistics();
            res.json({
                success: true,
                message: 'Processing statistics reset successfully',
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            logger.error('Failed to reset processing stats', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            res.status(500).json({
                success: false,
                error: 'Failed to reset processing statistics'
            });
        }
    });
    router.get('/sync/status', standardRateLimit, async (req, res) => {
        try {
            const syncStatus = syncService.getSyncStatus();
            res.json({
                success: true,
                data: syncStatus,
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            logger.error('Failed to get sync status', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve sync status'
            });
        }
    });
    router.post('/sync/trigger', standardRateLimit, async (req, res) => {
        try {
            const result = await syncService.processSync();
            res.json({
                success: true,
                data: result,
                message: 'Sync process triggered successfully'
            });
        }
        catch (error) {
            logger.error('Failed to trigger sync', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            res.status(500).json({
                success: false,
                error: 'Failed to trigger sync process'
            });
        }
    });
    router.use((error, req, res, next) => {
        logger.error('Metrics API error', {
            error: error.message,
            stack: error.stack,
            endpoint: req.path,
            method: req.method,
            organization_id: req.user?.organization_id,
            user_id: req.user?.id
        });
        if (error.name === 'ValidationError') {
            res.status(400).json({
                success: false,
                error: 'Invalid request data',
                details: error.message
            });
        }
        else if (error.name === 'UnauthorizedError') {
            res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }
        else if (error.name === 'ForbiddenError') {
            res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    });
    return { router };
}
exports.default = createMetricsCollectionRoutes;
//# sourceMappingURL=sprint3-metrics.routes.js.map