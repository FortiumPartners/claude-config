"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsController = void 0;
const metrics_validation_1 = require("../validation/metrics.validation");
const response_1 = require("../utils/response");
class MetricsController {
    sessionService;
    toolMetricsService;
    collectionService;
    syncService;
    logger;
    constructor(dependencies) {
        this.sessionService = dependencies.sessionService;
        this.toolMetricsService = dependencies.toolMetricsService;
        this.collectionService = dependencies.collectionService;
        this.syncService = dependencies.syncService;
        this.logger = dependencies.logger;
    }
    async createSession(req, res) {
        try {
            const validatedData = (0, metrics_validation_1.validateUserSessionCreate)(req.body);
            const result = await this.sessionService.startSession(req.user.organization_id, validatedData.user_id || req.user.id, validatedData.context);
            if (result.success) {
                res.status(201).json((0, response_1.createSuccessResponse)({
                    session: result.session,
                    message: result.message
                }));
                this.logger.info('Session created via API', {
                    organization_id: req.user.organization_id,
                    user_id: validatedData.user_id || req.user.id,
                    session_id: result.session?.id
                });
            }
            else {
                res.status(400).json((0, response_1.createErrorResponse)(result.message || 'Failed to create session'));
            }
        }
        catch (error) {
            this.logger.error('Failed to create session', {
                organization_id: req.user.organization_id,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            res.status(400).json((0, response_1.createErrorResponse)(error instanceof Error ? error.message : 'Invalid session data'));
        }
    }
    async updateSession(req, res) {
        try {
            const sessionId = req.params.id;
            const validatedData = (0, metrics_validation_1.validateUserSessionUpdate)(req.body);
            const result = await this.sessionService.updateSessionActivity(req.user.organization_id, sessionId, validatedData);
            if (result.success) {
                res.json((0, response_1.createSuccessResponse)({
                    message: result.message
                }));
            }
            else {
                res.status(404).json((0, response_1.createErrorResponse)(result.message || 'Session not found'));
            }
        }
        catch (error) {
            this.logger.error('Failed to update session', {
                organization_id: req.user.organization_id,
                session_id: req.params.id,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            res.status(400).json((0, response_1.createErrorResponse)(error instanceof Error ? error.message : 'Invalid session update data'));
        }
    }
    async listSessions(req, res) {
        try {
            const userId = req.query.user_id;
            const limit = parseInt(req.query.limit) || 50;
            const offset = parseInt(req.query.offset) || 0;
            const status = req.query.status;
            let sessions = [];
            if (status === 'active') {
                sessions = this.sessionService.getActiveSessions(req.user.organization_id);
                if (userId) {
                    sessions = sessions.filter(session => session.user_id === userId);
                }
                sessions = sessions.slice(offset, offset + limit);
            }
            else {
                sessions = this.sessionService.getActiveSessions(req.user.organization_id);
            }
            res.json((0, response_1.createSuccessResponse)({
                sessions,
                pagination: {
                    limit,
                    offset,
                    total: sessions.length,
                    has_more: false
                }
            }));
        }
        catch (error) {
            this.logger.error('Failed to list sessions', {
                organization_id: req.user.organization_id,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            res.status(500).json((0, response_1.createErrorResponse)('Failed to retrieve sessions'));
        }
    }
    async getSession(req, res) {
        try {
            const sessionId = req.params.id;
            const summary = await this.sessionService.getSessionSummary(req.user.organization_id, sessionId);
            if (summary) {
                res.json((0, response_1.createSuccessResponse)(summary));
            }
            else {
                res.status(404).json((0, response_1.createErrorResponse)('Session not found'));
            }
        }
        catch (error) {
            this.logger.error('Failed to get session', {
                organization_id: req.user.organization_id,
                session_id: req.params.id,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            res.status(500).json((0, response_1.createErrorResponse)('Failed to retrieve session'));
        }
    }
    async endSession(req, res) {
        try {
            const sessionId = req.params.id;
            const endMetadata = req.body.end_metadata;
            const result = await this.sessionService.endSession(req.user.organization_id, sessionId, endMetadata);
            if (result.success) {
                res.json((0, response_1.createSuccessResponse)({
                    summary: result.summary,
                    message: result.message
                }));
            }
            else {
                res.status(404).json((0, response_1.createErrorResponse)(result.message || 'Session not found'));
            }
        }
        catch (error) {
            this.logger.error('Failed to end session', {
                organization_id: req.user.organization_id,
                session_id: req.params.id,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            res.status(500).json((0, response_1.createErrorResponse)('Failed to end session'));
        }
    }
    async recordToolUsage(req, res) {
        try {
            const toolData = req.body;
            const result = await this.toolMetricsService.recordToolExecution(req.user.organization_id, {
                user_id: toolData.user_id || req.user.id,
                tool_name: toolData.tool_name,
                execution_environment: toolData.execution_environment,
                input_parameters: toolData.input_parameters,
                output_summary: toolData.output_summary
            }, toolData.execution_time_ms, toolData.status, toolData.error_message);
            if (result.success) {
                res.status(201).json((0, response_1.createSuccessResponse)({
                    alerts: result.alerts,
                    message: 'Tool usage recorded successfully'
                }));
            }
            else {
                res.status(400).json((0, response_1.createErrorResponse)(result.message || 'Failed to record tool usage'));
            }
        }
        catch (error) {
            this.logger.error('Failed to record tool usage', {
                organization_id: req.user.organization_id,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            res.status(400).json((0, response_1.createErrorResponse)(error instanceof Error ? error.message : 'Invalid tool usage data'));
        }
    }
    async getToolAnalytics(req, res) {
        try {
            const toolName = req.query.tool_name;
            const days = parseInt(req.query.days) || 7;
            const limit = parseInt(req.query.limit) || 50;
            const endDate = new Date();
            const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));
            if (toolName) {
                const metrics = await this.toolMetricsService.getToolMetrics(req.user.organization_id, toolName, { start: startDate, end: endDate });
                if (metrics) {
                    res.json((0, response_1.createSuccessResponse)({ tool_metrics: metrics }));
                }
                else {
                    res.status(404).json((0, response_1.createErrorResponse)('Tool metrics not found'));
                }
            }
            else {
                const allMetrics = await this.toolMetricsService.getAllToolMetrics(req.user.organization_id, { start: startDate, end: endDate }, limit);
                res.json((0, response_1.createSuccessResponse)({ tools: allMetrics }));
            }
        }
        catch (error) {
            this.logger.error('Failed to get tool analytics', {
                organization_id: req.user.organization_id,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            res.status(500).json((0, response_1.createErrorResponse)('Failed to retrieve tool analytics'));
        }
    }
    async getToolTrends(req, res) {
        try {
            const toolName = req.params.name;
            const period = req.query.period || 'daily';
            const points = parseInt(req.query.points) || 24;
            const trends = await this.toolMetricsService.getToolTrendAnalysis(req.user.organization_id, toolName, period, points);
            if (trends) {
                res.json((0, response_1.createSuccessResponse)({ trends }));
            }
            else {
                res.status(404).json((0, response_1.createErrorResponse)('Tool trends not found'));
            }
        }
        catch (error) {
            this.logger.error('Failed to get tool trends', {
                organization_id: req.user.organization_id,
                tool_name: req.params.name,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            res.status(500).json((0, response_1.createErrorResponse)('Failed to retrieve tool trends'));
        }
    }
    async recordCommandExecution(req, res) {
        try {
            const validatedData = (0, metrics_validation_1.validateCommandExecution)(req.body);
            const result = await this.collectionService.collectCommandExecution(req.user.organization_id, {
                ...validatedData,
                user_id: validatedData.user_id || req.user.id
            });
            if (result.success) {
                res.status(201).json((0, response_1.createSuccessResponse)({
                    data: result.data,
                    rate_limit: result.rate_limit,
                    performance: result.performance
                }));
            }
            else {
                if (result.rate_limit) {
                    res.status(429).json((0, response_1.createErrorResponse)(result.message || 'Rate limit exceeded', {
                        rate_limit: result.rate_limit
                    }));
                }
                else {
                    res.status(400).json((0, response_1.createErrorResponse)(result.message || 'Failed to record command'));
                }
            }
        }
        catch (error) {
            res.status(400).json((0, response_1.createErrorResponse)(error instanceof Error ? error.message : 'Invalid command execution data'));
        }
    }
    async recordAgentInteraction(req, res) {
        try {
            const validatedData = (0, metrics_validation_1.validateAgentInteraction)(req.body);
            const result = await this.collectionService.collectAgentInteraction(req.user.organization_id, {
                ...validatedData,
                user_id: validatedData.user_id || req.user.id
            });
            if (result.success) {
                res.status(201).json((0, response_1.createSuccessResponse)({
                    data: result.data,
                    rate_limit: result.rate_limit,
                    performance: result.performance
                }));
            }
            else {
                if (result.rate_limit) {
                    res.status(429).json((0, response_1.createErrorResponse)(result.message || 'Rate limit exceeded', {
                        rate_limit: result.rate_limit
                    }));
                }
                else {
                    res.status(400).json((0, response_1.createErrorResponse)(result.message || 'Failed to record interaction'));
                }
            }
        }
        catch (error) {
            res.status(400).json((0, response_1.createErrorResponse)(error instanceof Error ? error.message : 'Invalid agent interaction data'));
        }
    }
    async recordProductivityMetric(req, res) {
        try {
            const validatedData = (0, metrics_validation_1.validateProductivityMetric)(req.body);
            const result = await this.collectionService.collectProductivityMetric(req.user.organization_id, {
                ...validatedData,
                user_id: validatedData.user_id || req.user.id
            });
            if (result.success) {
                res.status(201).json((0, response_1.createSuccessResponse)({
                    data: result.data,
                    rate_limit: result.rate_limit,
                    performance: result.performance
                }));
            }
            else {
                if (result.rate_limit) {
                    res.status(429).json((0, response_1.createErrorResponse)(result.message || 'Rate limit exceeded', {
                        rate_limit: result.rate_limit
                    }));
                }
                else {
                    res.status(400).json((0, response_1.createErrorResponse)(result.message || 'Failed to record metric'));
                }
            }
        }
        catch (error) {
            res.status(400).json((0, response_1.createErrorResponse)(error instanceof Error ? error.message : 'Invalid productivity metric data'));
        }
    }
    async bulkImport(req, res) {
        try {
            const validatedBatch = (0, metrics_validation_1.validateMetricsBatch)(req.body);
            validatedBatch.organization_id = req.user.organization_id;
            const progressCallback = req.query.progress === 'true'
                ? (progress) => {
                    this.logger.debug('Batch progress', {
                        batch_id: progress.batch_id,
                        progress: `${progress.processed_items}/${progress.total_items}`
                    });
                }
                : undefined;
            const result = await this.syncService.uploadBatch(validatedBatch, progressCallback);
            if (result.success) {
                res.status(201).json((0, response_1.createSuccessResponse)({
                    batch_id: result.batch_id,
                    progress: result.progress
                }));
            }
            else {
                res.status(400).json((0, response_1.createErrorResponse)('Batch upload failed', {
                    batch_id: result.batch_id,
                    progress: result.progress
                }));
            }
        }
        catch (error) {
            this.logger.error('Failed to process bulk import', {
                organization_id: req.user.organization_id,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            res.status(400).json((0, response_1.createErrorResponse)(error instanceof Error ? error.message : 'Invalid batch data'));
        }
    }
    async getBatchProgress(req, res) {
        try {
            const batchId = req.params.batchId;
            const progress = this.syncService.getBatchProgress(batchId);
            if (progress) {
                res.json((0, response_1.createSuccessResponse)({ progress }));
            }
            else {
                res.status(404).json((0, response_1.createErrorResponse)('Batch not found'));
            }
        }
        catch (error) {
            res.status(500).json((0, response_1.createErrorResponse)('Failed to retrieve batch progress'));
        }
    }
    async getPerformanceSummary(req, res) {
        try {
            const days = parseInt(req.query.days) || 7;
            const endDate = new Date();
            const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));
            const [toolSummary, sessionMetrics, collectionStats, syncStatus] = await Promise.all([
                this.toolMetricsService.getToolPerformanceSummary(req.user.organization_id, { start: startDate, end: endDate }),
                this.sessionService.getSessionMetrics(),
                this.collectionService.getCollectionStats(),
                this.syncService.getSyncStatus()
            ]);
            res.json((0, response_1.createSuccessResponse)({
                tool_performance: toolSummary,
                session_metrics: sessionMetrics,
                collection_stats: collectionStats,
                sync_status: syncStatus,
                time_range: {
                    start: startDate.toISOString(),
                    end: endDate.toISOString(),
                    days
                }
            }));
        }
        catch (error) {
            this.logger.error('Failed to get performance summary', {
                organization_id: req.user.organization_id,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            res.status(500).json((0, response_1.createErrorResponse)('Failed to retrieve performance summary'));
        }
    }
    async getPerformanceAlerts(req, res) {
        try {
            const severity = req.query.severity;
            const alerts = await this.toolMetricsService.getPerformanceAlerts(req.user.organization_id, severity);
            res.json((0, response_1.createSuccessResponse)({ alerts }));
        }
        catch (error) {
            this.logger.error('Failed to get performance alerts', {
                organization_id: req.user.organization_id,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            res.status(500).json((0, response_1.createErrorResponse)('Failed to retrieve performance alerts'));
        }
    }
    async queryMetrics(req, res) {
        try {
            const queryParams = (0, metrics_validation_1.validateMetricsQuery)(req.body);
            queryParams.organization_id = req.user.organization_id;
            res.json((0, response_1.createSuccessResponse)({
                query: queryParams,
                results: [],
                message: 'Metrics query endpoint - implementation pending'
            }));
        }
        catch (error) {
            res.status(400).json((0, response_1.createErrorResponse)(error instanceof Error ? error.message : 'Invalid query parameters'));
        }
    }
    async getHealth(req, res) {
        try {
            const [collectionStats, syncStatus] = await Promise.all([
                this.collectionService.getCollectionStats(),
                this.syncService.getSyncStatus()
            ]);
            const isHealthy = collectionStats.success_rate > 0.95 &&
                syncStatus.sync_statistics.success_rate > 0.9 &&
                !syncStatus.offline_mode;
            const status = isHealthy ? 'healthy' : 'degraded';
            res.status(isHealthy ? 200 : 503).json({
                status,
                timestamp: new Date().toISOString(),
                collection: collectionStats,
                sync: syncStatus,
                checks: {
                    collection_success_rate: collectionStats.success_rate > 0.95,
                    sync_success_rate: syncStatus.sync_statistics.success_rate > 0.9,
                    remote_available: syncStatus.remote_available
                }
            });
        }
        catch (error) {
            res.status(503).json({
                status: 'unhealthy',
                timestamp: new Date().toISOString(),
                error: error instanceof Error ? error.message : 'Health check failed'
            });
        }
    }
}
exports.MetricsController = MetricsController;
//# sourceMappingURL=metrics.controller.js.map