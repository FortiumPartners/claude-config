"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LegacyApiController = void 0;
exports.createLegacyApiController = createLegacyApiController;
const express_1 = require("express");
const format_converter_1 = require("./format-converter");
const hook_bridge_1 = require("./hook-bridge");
const joi_1 = __importDefault(require("joi"));
class LegacyApiController {
    prisma;
    formatConverter;
    hookBridge;
    router;
    tenantId;
    constructor(prisma, tenantId) {
        this.prisma = prisma;
        this.tenantId = tenantId;
        this.formatConverter = new format_converter_1.FormatConverter();
        this.hookBridge = new hook_bridge_1.HookBridge(prisma, tenantId);
        this.router = (0, express_1.Router)();
        this.setupRoutes();
    }
    getRouter() {
        return this.router;
    }
    setupRoutes() {
        this.router.post('/api/v1/sessions', this.validateSession, this.createSession.bind(this));
        this.router.put('/api/v1/sessions/:sessionId', this.validateSession, this.updateSession.bind(this));
        this.router.get('/api/v1/sessions/:sessionId', this.getSession.bind(this));
        this.router.get('/api/v1/sessions', this.getSessions.bind(this));
        this.router.delete('/api/v1/sessions/:sessionId', this.deleteSession.bind(this));
        this.router.post('/api/v1/tool-metrics', this.validateToolMetric, this.recordToolMetric.bind(this));
        this.router.post('/api/v1/tool-metrics/batch', this.validateToolMetricBatch, this.recordToolMetricsBatch.bind(this));
        this.router.get('/api/v1/tool-metrics/:sessionId', this.getToolMetrics.bind(this));
        this.router.get('/api/v1/analytics/productivity', this.getProductivityAnalytics.bind(this));
        this.router.get('/api/v1/analytics/tools', this.getToolAnalytics.bind(this));
        this.router.get('/api/v1/analytics/sessions/:sessionId', this.getSessionAnalytics.bind(this));
        this.router.get('/api/v1/dashboard/metrics', this.getDashboardMetrics.bind(this));
        this.router.get('/api/v1/dashboard/indicators', this.getProductivityIndicators.bind(this));
        this.router.get('/api/v1/dashboard/baseline', this.getBaseline.bind(this));
        this.router.post('/api/v1/hooks/session-start', this.handleSessionStart.bind(this));
        this.router.post('/api/v1/hooks/session-end', this.handleSessionEnd.bind(this));
        this.router.post('/api/v1/hooks/tool-usage', this.handleToolUsage.bind(this));
        this.router.get('/api/v1/health', this.healthCheck.bind(this));
        this.router.get('/api/v1/version', this.getVersion.bind(this));
        this.router.get('/api/v1/migration/status', this.getMigrationStatus.bind(this));
        this.router.post('/api/v1/migration/sync', this.syncLocalData.bind(this));
    }
    async createSession(req, res) {
        try {
            const legacySession = req.body;
            const modernSession = this.formatConverter.convertLegacySessionToModern(legacySession);
            const result = await this.hookBridge.createSession(modernSession);
            const legacyResponse = this.formatConverter.convertModernSessionToLegacy(result);
            this.sendLegacyResponse(res, 201, legacyResponse, 'Session created successfully');
        }
        catch (error) {
            this.sendLegacyError(res, 400, error.message);
        }
    }
    async updateSession(req, res) {
        try {
            const sessionId = req.params.sessionId;
            const legacySession = req.body;
            const modernSession = this.formatConverter.convertLegacySessionToModern({
                session_id: sessionId,
                ...legacySession
            });
            const result = await this.hookBridge.updateSession(sessionId, modernSession);
            if (!result) {
                this.sendLegacyError(res, 404, 'Session not found');
                return;
            }
            const legacyResponse = this.formatConverter.convertModernSessionToLegacy(result);
            this.sendLegacyResponse(res, 200, legacyResponse, 'Session updated successfully');
        }
        catch (error) {
            this.sendLegacyError(res, 400, error.message);
        }
    }
    async getSession(req, res) {
        try {
            const sessionId = req.params.sessionId;
            const session = await this.hookBridge.getSession(sessionId);
            if (!session) {
                this.sendLegacyError(res, 404, 'Session not found');
                return;
            }
            const legacyResponse = this.formatConverter.convertModernSessionToLegacy(session);
            this.sendLegacyResponse(res, 200, legacyResponse);
        }
        catch (error) {
            this.sendLegacyError(res, 500, error.message);
        }
    }
    async getSessions(req, res) {
        try {
            const { user, limit = '50', offset = '0', start_date, end_date } = req.query;
            const sessions = await this.hookBridge.getSessions({
                user: user,
                limit: parseInt(limit),
                offset: parseInt(offset),
                startDate: start_date ? new Date(start_date) : undefined,
                endDate: end_date ? new Date(end_date) : undefined
            });
            const legacySessions = sessions.map(session => this.formatConverter.convertModernSessionToLegacy(session));
            this.sendLegacyResponse(res, 200, legacySessions);
        }
        catch (error) {
            this.sendLegacyError(res, 500, error.message);
        }
    }
    async deleteSession(req, res) {
        try {
            const sessionId = req.params.sessionId;
            const deleted = await this.hookBridge.deleteSession(sessionId);
            if (!deleted) {
                this.sendLegacyError(res, 404, 'Session not found');
                return;
            }
            this.sendLegacyResponse(res, 200, { deleted: true }, 'Session deleted successfully');
        }
        catch (error) {
            this.sendLegacyError(res, 500, error.message);
        }
    }
    async recordToolMetric(req, res) {
        try {
            const legacyMetric = req.body;
            const modernMetric = this.formatConverter.convertLegacyToolMetricToModern(legacyMetric);
            const result = await this.hookBridge.recordToolMetric(modernMetric);
            const legacyResponse = this.formatConverter.convertModernToolMetricToLegacy(result);
            this.sendLegacyResponse(res, 201, legacyResponse, 'Tool metric recorded successfully');
        }
        catch (error) {
            this.sendLegacyError(res, 400, error.message);
        }
    }
    async recordToolMetricsBatch(req, res) {
        try {
            const legacyMetrics = req.body.metrics || req.body;
            if (!Array.isArray(legacyMetrics)) {
                this.sendLegacyError(res, 400, 'Expected array of tool metrics');
                return;
            }
            const results = [];
            for (const legacyMetric of legacyMetrics) {
                try {
                    const modernMetric = this.formatConverter.convertLegacyToolMetricToModern(legacyMetric);
                    const result = await this.hookBridge.recordToolMetric(modernMetric);
                    results.push(this.formatConverter.convertModernToolMetricToLegacy(result));
                }
                catch (error) {
                    results.push({ error: error.message, originalData: legacyMetric });
                }
            }
            this.sendLegacyResponse(res, 201, {
                results,
                processed: legacyMetrics.length,
                successful: results.filter(r => !r.error).length
            }, 'Batch tool metrics processed');
        }
        catch (error) {
            this.sendLegacyError(res, 400, error.message);
        }
    }
    async getToolMetrics(req, res) {
        try {
            const sessionId = req.params.sessionId;
            const toolMetrics = await this.hookBridge.getToolMetrics(sessionId);
            const legacyMetrics = toolMetrics.map(metric => this.formatConverter.convertModernToolMetricToLegacy(metric));
            this.sendLegacyResponse(res, 200, legacyMetrics);
        }
        catch (error) {
            this.sendLegacyError(res, 500, error.message);
        }
    }
    async getProductivityAnalytics(req, res) {
        try {
            const { user, days = '7' } = req.query;
            const analytics = await this.hookBridge.getProductivityAnalytics({
                user: user,
                days: parseInt(days)
            });
            const legacyAnalytics = {
                productivity_score: analytics.averageProductivityScore,
                velocity: analytics.averageVelocity,
                focus_time: analytics.totalFocusTime,
                session_efficiency: analytics.sessionEfficiency,
                tool_usage_patterns: analytics.toolUsagePatterns,
                productivity_trends: analytics.trends.map(trend => ({
                    date: trend.date,
                    score: trend.productivityScore,
                    sessions: trend.sessionCount,
                    tools_used: trend.toolsUsed
                }))
            };
            this.sendLegacyResponse(res, 200, legacyAnalytics);
        }
        catch (error) {
            this.sendLegacyError(res, 500, error.message);
        }
    }
    async getToolAnalytics(req, res) {
        try {
            const { user, days = '7' } = req.query;
            const toolAnalytics = await this.hookBridge.getToolAnalytics({
                user: user,
                days: parseInt(days)
            });
            const legacyToolAnalytics = {
                top_tools: toolAnalytics.topTools,
                tool_efficiency: toolAnalytics.toolEfficiency,
                usage_patterns: toolAnalytics.usagePatterns,
                error_rates: toolAnalytics.errorRates
            };
            this.sendLegacyResponse(res, 200, legacyToolAnalytics);
        }
        catch (error) {
            this.sendLegacyError(res, 500, error.message);
        }
    }
    async getSessionAnalytics(req, res) {
        try {
            const sessionId = req.params.sessionId;
            const sessionAnalytics = await this.hookBridge.getSessionAnalytics(sessionId);
            if (!sessionAnalytics) {
                this.sendLegacyError(res, 404, 'Session not found');
                return;
            }
            const legacySessionAnalytics = {
                session_id: sessionAnalytics.sessionId,
                productivity_score: sessionAnalytics.productivityScore,
                duration_minutes: sessionAnalytics.durationMinutes,
                tools_used: sessionAnalytics.toolsUsed,
                efficiency_rating: sessionAnalytics.efficiencyRating,
                focus_periods: sessionAnalytics.focusPeriods,
                interruptions: sessionAnalytics.interruptions
            };
            this.sendLegacyResponse(res, 200, legacySessionAnalytics);
        }
        catch (error) {
            this.sendLegacyError(res, 500, error.message);
        }
    }
    async getDashboardMetrics(req, res) {
        try {
            const { user } = req.query;
            const dashboardMetrics = await this.hookBridge.getDashboardMetrics(user);
            const legacyMetrics = {
                current_session: dashboardMetrics.currentSession,
                today_stats: {
                    sessions: dashboardMetrics.todayStats.sessions,
                    productivity_score: dashboardMetrics.todayStats.productivityScore,
                    tools_used: dashboardMetrics.todayStats.toolsUsed,
                    focus_time_minutes: dashboardMetrics.todayStats.focusTimeMinutes
                },
                weekly_trends: dashboardMetrics.weeklyTrends,
                top_tools: dashboardMetrics.topTools,
                productivity_trend: dashboardMetrics.productivityTrend
            };
            this.sendLegacyResponse(res, 200, legacyMetrics);
        }
        catch (error) {
            this.sendLegacyError(res, 500, error.message);
        }
    }
    async getProductivityIndicators(req, res) {
        try {
            const { user } = req.query;
            const indicators = await this.hookBridge.getProductivityIndicators(user);
            const legacyIndicators = {
                session_id: indicators.sessionId,
                start_time: indicators.startTime,
                baseline: indicators.baseline,
                current_metrics: indicators.currentMetrics,
                last_update: indicators.lastUpdate,
                productivity_score: indicators.productivityScore,
                trend: indicators.trend
            };
            this.sendLegacyResponse(res, 200, legacyIndicators);
        }
        catch (error) {
            this.sendLegacyError(res, 500, error.message);
        }
    }
    async getBaseline(req, res) {
        try {
            const { user } = req.query;
            const baseline = await this.hookBridge.getBaseline(user);
            const legacyBaseline = {
                average_commands_per_hour: baseline.averageCommandsPerHour,
                average_lines_per_hour: baseline.averageLinesPerHour,
                average_success_rate: baseline.averageSuccessRate,
                average_focus_time_minutes: baseline.averageFocusTimeMinutes,
                average_context_switches: baseline.averageContextSwitches
            };
            this.sendLegacyResponse(res, 200, legacyBaseline);
        }
        catch (error) {
            this.sendLegacyError(res, 500, error.message);
        }
    }
    async handleSessionStart(req, res) {
        try {
            const sessionData = req.body;
            const result = await this.hookBridge.handleSessionStart(sessionData);
            const legacyResponse = {
                success: true,
                executionTime: result.executionTime || 0,
                memoryUsage: result.memoryUsage || 0,
                metrics: {
                    sessionId: result.sessionId,
                    gitBranch: result.gitBranch,
                    user: result.user
                }
            };
            this.sendLegacyResponse(res, 200, legacyResponse);
        }
        catch (error) {
            this.sendLegacyError(res, 500, error.message);
        }
    }
    async handleSessionEnd(req, res) {
        try {
            const sessionData = req.body;
            const result = await this.hookBridge.handleSessionEnd(sessionData);
            const legacyResponse = {
                success: true,
                executionTime: result.executionTime || 0,
                memoryUsage: result.memoryUsage || 0,
                metrics: {
                    sessionId: result.sessionId,
                    productivityScore: result.productivityScore,
                    duration: result.duration
                }
            };
            this.sendLegacyResponse(res, 200, legacyResponse);
        }
        catch (error) {
            this.sendLegacyError(res, 500, error.message);
        }
    }
    async handleToolUsage(req, res) {
        try {
            const toolData = req.body;
            const result = await this.hookBridge.handleToolUsage(toolData);
            const legacyResponse = {
                success: true,
                executionTime: result.executionTime || 0,
                memoryUsage: result.memoryUsage || 0,
                metrics: {
                    toolName: result.toolName,
                    sessionId: result.sessionId,
                    recorded: true
                }
            };
            this.sendLegacyResponse(res, 200, legacyResponse);
        }
        catch (error) {
            this.sendLegacyError(res, 500, error.message);
        }
    }
    async healthCheck(req, res) {
        try {
            await this.prisma.$queryRaw `SELECT 1`;
            const healthStatus = {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                version: '1.0.0',
                compatibility_mode: 'legacy',
                database_status: 'connected',
                hooks_bridge_status: 'active'
            };
            this.sendLegacyResponse(res, 200, healthStatus);
        }
        catch (error) {
            this.sendLegacyError(res, 503, `Health check failed: ${error.message}`);
        }
    }
    async getVersion(req, res) {
        const versionInfo = {
            api_version: '1.0.0',
            compatibility_version: '1.0.0',
            service: 'External Metrics Web Service',
            mode: 'hybrid',
            local_hooks_compatible: true,
            migration_support: true
        };
        this.sendLegacyResponse(res, 200, versionInfo);
    }
    async getMigrationStatus(req, res) {
        try {
            const migrationStatus = await this.hookBridge.getMigrationStatus();
            this.sendLegacyResponse(res, 200, migrationStatus);
        }
        catch (error) {
            this.sendLegacyError(res, 500, error.message);
        }
    }
    async syncLocalData(req, res) {
        try {
            const syncData = req.body;
            const result = await this.hookBridge.syncLocalData(syncData);
            this.sendLegacyResponse(res, 200, result, 'Local data synced successfully');
        }
        catch (error) {
            this.sendLegacyError(res, 500, error.message);
        }
    }
    validateSession(req, res, next) {
        const schema = joi_1.default.object({
            session_id: joi_1.default.string().required(),
            start_time: joi_1.default.string().isoDate().required(),
            end_time: joi_1.default.string().isoDate().optional(),
            user: joi_1.default.string().required(),
            working_directory: joi_1.default.string().optional(),
            git_branch: joi_1.default.string().optional(),
            productivity_metrics: joi_1.default.object().optional(),
            quality_metrics: joi_1.default.object().optional(),
            workflow_metrics: joi_1.default.object().optional()
        });
        const { error } = schema.validate(req.body);
        if (error) {
            this.sendLegacyError(res, 400, `Validation error: ${error.details[0].message}`);
            return;
        }
        next();
    }
    validateToolMetric(req, res, next) {
        const schema = joi_1.default.object({
            event: joi_1.default.string().required(),
            timestamp: joi_1.default.string().isoDate().required(),
            session_id: joi_1.default.string().optional(),
            tool_name: joi_1.default.string().optional(),
            execution_time: joi_1.default.number().optional(),
            memory_usage: joi_1.default.number().optional(),
            success: joi_1.default.boolean().optional(),
            error_message: joi_1.default.string().optional(),
            parameters: joi_1.default.any().optional(),
            output_size: joi_1.default.number().optional()
        });
        const { error } = schema.validate(req.body);
        if (error) {
            this.sendLegacyError(res, 400, `Validation error: ${error.details[0].message}`);
            return;
        }
        next();
    }
    validateToolMetricBatch(req, res, next) {
        const data = req.body.metrics || req.body;
        if (!Array.isArray(data)) {
            this.sendLegacyError(res, 400, 'Expected array of tool metrics');
            return;
        }
        if (data.length > 100) {
            this.sendLegacyError(res, 400, 'Batch size cannot exceed 100 metrics');
            return;
        }
        next();
    }
    sendLegacyResponse(res, statusCode, data, message) {
        const response = {
            success: statusCode < 400,
            data,
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        };
        if (message) {
            response.data = { ...response.data, message };
        }
        res.status(statusCode).json(response);
    }
    sendLegacyError(res, statusCode, error) {
        const response = {
            success: false,
            error,
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        };
        res.status(statusCode).json(response);
    }
}
exports.LegacyApiController = LegacyApiController;
function createLegacyApiController(prisma, tenantId) {
    const controller = new LegacyApiController(prisma, tenantId);
    return controller.getRouter();
}
//# sourceMappingURL=legacy-api.js.map