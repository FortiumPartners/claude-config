"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMetricsQueryRoutes = createMetricsQueryRoutes;
const express_1 = require("express");
const metrics_query_service_1 = require("../services/metrics-query.service");
const auth_middleware_1 = require("../middleware/auth.middleware");
const validation_middleware_1 = require("../middleware/validation.middleware");
const metrics_validation_1 = require("../validation/metrics.validation");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
function createMetricsQueryRoutes(db, logger, realTimeProcessor) {
    const router = (0, express_1.Router)();
    const queryService = new metrics_query_service_1.MetricsQueryService(db, logger, realTimeProcessor);
    const queryRateLimit = (0, express_rate_limit_1.default)({
        windowMs: 60 * 1000,
        max: 500,
        message: {
            error: 'Too many query requests',
            message: 'Query rate limit exceeded. Please try again later.',
            retry_after: 60
        },
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => {
            return req.user?.organization_id || req.ip;
        }
    });
    const dashboardRateLimit = (0, express_rate_limit_1.default)({
        windowMs: 60 * 1000,
        max: 100,
        message: {
            error: 'Too many dashboard requests',
            message: 'Dashboard rate limit exceeded. Please try again later.',
            retry_after: 60
        },
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => {
            return req.user?.organization_id || req.ip;
        }
    });
    router.get('/aggregated', queryRateLimit, auth_middleware_1.authMiddleware, validation_middleware_1.validationMiddleware, async (req, res) => {
        try {
            if (!req.user?.organization_id) {
                return res.status(401).json({
                    error: 'Unauthorized',
                    message: 'Organization context required'
                });
            }
            const params = {
                user_id: req.query.user_id,
                team_id: req.query.team_id,
                project_id: req.query.project_id,
                start_date: req.query.start_date ? new Date(req.query.start_date) : undefined,
                end_date: req.query.end_date ? new Date(req.query.end_date) : undefined,
                metric_types: req.query.metric_types ? req.query.metric_types.split(',') : undefined,
                limit: req.query.limit ? parseInt(req.query.limit) : undefined,
                offset: req.query.offset ? parseInt(req.query.offset) : undefined,
                aggregation_window: req.query.aggregation_window
            };
            const hints = {
                use_real_time_cache: req.headers['x-use-real-time-cache'] !== 'false',
                prefer_aggregated_data: req.headers['x-prefer-aggregated-data'] !== 'false',
                max_scan_limit: req.headers['x-max-scan-limit'] ?
                    parseInt(req.headers['x-max-scan-limit']) : undefined,
                timeout_ms: req.headers['x-timeout-ms'] ?
                    parseInt(req.headers['x-timeout-ms']) : undefined
            };
            const result = await queryService.getAggregatedMetrics(req.user.organization_id, params, hints);
            res.set({
                'X-Query-Time': result.query_performance.response_time_ms.toString(),
                'X-Cache-Hit': result.query_performance.cache_hit.toString(),
                'X-Records-Scanned': result.query_performance.records_scanned.toString(),
                'X-Records-Returned': result.query_performance.records_returned.toString()
            });
            res.set({
                'X-Total-Count': result.pagination.total_count.toString(),
                'X-Page': result.pagination.page.toString(),
                'X-Per-Page': result.pagination.per_page.toString(),
                'X-Total-Pages': result.pagination.total_pages.toString()
            });
            if (result.pagination.has_next) {
                const nextOffset = result.pagination.page * result.pagination.per_page;
                const nextUrl = new URL(req.originalUrl, `${req.protocol}://${req.get('host')}`);
                nextUrl.searchParams.set('offset', nextOffset.toString());
                res.set('Link', `<${nextUrl.toString()}>; rel="next"`);
            }
            res.status(200).json({
                success: true,
                data: result.data,
                pagination: result.pagination,
                query_performance: result.query_performance
            });
        }
        catch (error) {
            logger.error('Aggregated metrics query endpoint error', {
                organization_id: req.user?.organization_id,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            res.status(500).json({
                error: 'Internal server error',
                message: 'Failed to get aggregated metrics'
            });
        }
    });
    router.get('/dashboard', dashboardRateLimit, auth_middleware_1.authMiddleware, validation_middleware_1.validationMiddleware, async (req, res) => {
        try {
            if (!req.user?.organization_id) {
                return res.status(401).json({
                    error: 'Unauthorized',
                    message: 'Organization context required'
                });
            }
            const params = {
                user_id: req.query.user_id,
                team_id: req.query.team_id,
                project_id: req.query.project_id,
                time_range: req.query.time_range || '1d'
            };
            if (!['1h', '1d', '7d', '30d'].includes(params.time_range)) {
                return res.status(400).json({
                    error: 'Bad request',
                    message: 'Invalid time_range. Must be one of: 1h, 1d, 7d, 30d'
                });
            }
            const startTime = Date.now();
            const result = await queryService.getDashboardMetrics(req.user.organization_id, params);
            const responseTime = Date.now() - startTime;
            res.set('X-Response-Time', responseTime.toString());
            res.status(200).json({
                success: true,
                data: result,
                generated_at: new Date().toISOString(),
                response_time_ms: responseTime
            });
        }
        catch (error) {
            logger.error('Dashboard metrics endpoint error', {
                organization_id: req.user?.organization_id,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            res.status(500).json({
                error: 'Internal server error',
                message: 'Failed to get dashboard metrics'
            });
        }
    });
    router.get('/commands', queryRateLimit, auth_middleware_1.authMiddleware, validation_middleware_1.validationMiddleware, async (req, res) => {
        try {
            if (!req.user?.organization_id) {
                return res.status(401).json({
                    error: 'Unauthorized',
                    message: 'Organization context required'
                });
            }
            if (!req.query.start_date || !req.query.end_date) {
                return res.status(400).json({
                    error: 'Bad request',
                    message: 'start_date and end_date are required'
                });
            }
            const params = {
                user_id: req.query.user_id,
                team_id: req.query.team_id,
                project_id: req.query.project_id,
                command_name: req.query.command_name,
                status: req.query.status,
                start_date: new Date(req.query.start_date),
                end_date: new Date(req.query.end_date),
                limit: req.query.limit ? parseInt(req.query.limit) : 1000,
                offset: req.query.offset ? parseInt(req.query.offset) : 0
            };
            if (isNaN(params.start_date.getTime()) || isNaN(params.end_date.getTime())) {
                return res.status(400).json({
                    error: 'Bad request',
                    message: 'Invalid date format. Use ISO 8601 format.'
                });
            }
            const result = await queryService.getCommandExecutions(req.user.organization_id, params);
            res.set({
                'X-Query-Time': result.query_performance.response_time_ms.toString(),
                'X-Records-Scanned': result.query_performance.records_scanned.toString(),
                'X-Records-Returned': result.query_performance.records_returned.toString(),
                'X-Total-Count': result.pagination.total_count.toString(),
                'X-Page': result.pagination.page.toString(),
                'X-Per-Page': result.pagination.per_page.toString(),
                'X-Total-Pages': result.pagination.total_pages.toString()
            });
            res.status(200).json({
                success: true,
                data: result.data,
                pagination: result.pagination,
                query_performance: result.query_performance
            });
        }
        catch (error) {
            logger.error('Command executions query endpoint error', {
                organization_id: req.user?.organization_id,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            res.status(500).json({
                error: 'Internal server error',
                message: 'Failed to get command executions'
            });
        }
    });
    router.get('/real-time/:window', queryRateLimit, auth_middleware_1.authMiddleware, validation_middleware_1.validationMiddleware, async (req, res) => {
        try {
            if (!req.user?.organization_id) {
                return res.status(401).json({
                    error: 'Unauthorized',
                    message: 'Organization context required'
                });
            }
            if (!realTimeProcessor) {
                return res.status(503).json({
                    error: 'Service unavailable',
                    message: 'Real-time processing not available'
                });
            }
            const window = req.params.window;
            if (!['1m', '5m', '15m', '1h'].includes(window)) {
                return res.status(400).json({
                    error: 'Bad request',
                    message: 'Invalid window. Must be one of: 1m, 5m, 15m, 1h'
                });
            }
            const userId = req.query.user_id;
            const startTime = Date.now();
            const result = queryService.getRealTimeMetrics(req.user.organization_id, window, userId);
            const responseTime = Date.now() - startTime;
            res.set({
                'X-Response-Time': responseTime.toString(),
                'X-Real-Time': 'true',
                'Cache-Control': 'no-cache, must-revalidate',
                'Expires': '0'
            });
            res.status(200).json({
                success: true,
                data: result,
                window,
                generated_at: new Date().toISOString(),
                response_time_ms: responseTime
            });
        }
        catch (error) {
            logger.error('Real-time metrics endpoint error', {
                organization_id: req.user?.organization_id,
                window: req.params.window,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            res.status(500).json({
                error: 'Internal server error',
                message: 'Failed to get real-time metrics'
            });
        }
    });
    router.get('/performance', auth_middleware_1.authMiddleware, async (req, res) => {
        try {
            if (req.user?.role !== 'admin') {
                return res.status(403).json({
                    error: 'Forbidden',
                    message: 'Admin access required'
                });
            }
            const performanceMetrics = await queryService.getQueryPerformanceMetrics();
            const queryStats = queryService.getQueryStats();
            res.status(200).json({
                success: true,
                data: {
                    performance_metrics: performanceMetrics,
                    query_stats: queryStats,
                    timestamp: new Date().toISOString()
                }
            });
        }
        catch (error) {
            logger.error('Performance metrics endpoint error', {
                organization_id: req.user?.organization_id,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            res.status(500).json({
                error: 'Internal server error',
                message: 'Failed to get performance metrics'
            });
        }
    });
    router.post('/query', queryRateLimit, auth_middleware_1.authMiddleware, validation_middleware_1.validationMiddleware, async (req, res) => {
        try {
            if (!req.user?.organization_id) {
                return res.status(401).json({
                    error: 'Unauthorized',
                    message: 'Organization context required'
                });
            }
            const queryParams = {
                ...req.body,
                organization_id: req.user.organization_id
            };
            const validatedParams = (0, metrics_validation_1.validateMetricsQuery)(queryParams);
            const hints = {
                use_real_time_cache: req.body.use_real_time_cache !== false,
                prefer_aggregated_data: req.body.prefer_aggregated_data !== false,
                max_scan_limit: req.body.max_scan_limit || 100000,
                timeout_ms: req.body.timeout_ms || 5000
            };
            const result = await queryService.getAggregatedMetrics(req.user.organization_id, validatedParams, hints);
            res.set({
                'X-Query-Time': result.query_performance.response_time_ms.toString(),
                'X-Cache-Hit': result.query_performance.cache_hit.toString(),
                'X-Records-Scanned': result.query_performance.records_scanned.toString(),
                'X-Records-Returned': result.query_performance.records_returned.toString()
            });
            res.status(200).json({
                success: true,
                data: result.data,
                pagination: result.pagination,
                query_performance: result.query_performance
            });
        }
        catch (error) {
            logger.error('Advanced query endpoint error', {
                organization_id: req.user?.organization_id,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            const statusCode = error instanceof Error && error.message.includes('validation') ? 400 : 500;
            res.status(statusCode).json({
                error: statusCode === 400 ? 'Bad request' : 'Internal server error',
                message: error instanceof Error ? error.message : 'Failed to execute query'
            });
        }
    });
    router.get('/export/:format', queryRateLimit, auth_middleware_1.authMiddleware, validation_middleware_1.validationMiddleware, async (req, res) => {
        try {
            if (!req.user?.organization_id) {
                return res.status(401).json({
                    error: 'Unauthorized',
                    message: 'Organization context required'
                });
            }
            const format = req.params.format;
            if (!['csv', 'json', 'xlsx'].includes(format)) {
                return res.status(400).json({
                    error: 'Bad request',
                    message: 'Invalid format. Supported formats: csv, json, xlsx'
                });
            }
            const params = {
                user_id: req.query.user_id,
                team_id: req.query.team_id,
                project_id: req.query.project_id,
                start_date: req.query.start_date ? new Date(req.query.start_date) : undefined,
                end_date: req.query.end_date ? new Date(req.query.end_date) : undefined,
                aggregation_window: req.query.aggregation_window,
                limit: 10000
            };
            const result = await queryService.getAggregatedMetrics(req.user.organization_id, params);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            let contentType;
            let filename;
            switch (format) {
                case 'csv':
                    contentType = 'text/csv';
                    filename = `metrics-export-${timestamp}.csv`;
                    break;
                case 'json':
                    contentType = 'application/json';
                    filename = `metrics-export-${timestamp}.json`;
                    break;
                case 'xlsx':
                    contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                    filename = `metrics-export-${timestamp}.xlsx`;
                    break;
                default:
                    throw new Error('Unsupported format');
            }
            res.set({
                'Content-Type': contentType,
                'Content-Disposition': `attachment; filename="${filename}"`,
                'X-Export-Count': result.data.length.toString(),
                'X-Export-Format': format
            });
            if (format === 'json') {
                res.status(200).json({
                    export_info: {
                        format,
                        generated_at: new Date().toISOString(),
                        total_records: result.data.length,
                        query_performance: result.query_performance
                    },
                    data: result.data
                });
            }
            else {
                res.status(501).json({
                    error: 'Not implemented',
                    message: `Export format '${format}' is not yet implemented`
                });
            }
        }
        catch (error) {
            logger.error('Export endpoint error', {
                organization_id: req.user?.organization_id,
                format: req.params.format,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            res.status(500).json({
                error: 'Internal server error',
                message: 'Failed to export metrics'
            });
        }
    });
    return { router };
}
//# sourceMappingURL=metrics-query.routes.js.map