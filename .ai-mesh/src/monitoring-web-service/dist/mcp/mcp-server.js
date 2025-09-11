"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.McpServer = void 0;
const metrics_model_1 = require("../models/metrics.model");
class McpServer {
    metricsModel;
    sessionService;
    toolMetricsService;
    logger;
    requestCache = new Map();
    CACHE_TTL_MS = 1000;
    performanceStats = {
        total_requests: 0,
        cached_responses: 0,
        avg_response_time_ms: 0,
        requests_under_5ms: 0
    };
    constructor(db, sessionService, toolMetricsService, logger) {
        this.metricsModel = new metrics_model_1.MetricsModel(db);
        this.sessionService = sessionService;
        this.toolMetricsService = toolMetricsService;
        this.logger = logger;
        setInterval(() => this.clearExpiredCache(), 30000);
    }
    async handleRequest(request, organizationId, userId) {
        const startTime = performance.now();
        this.performanceStats.total_requests++;
        try {
            const cacheKey = this.getCacheKey(request, organizationId, userId);
            if (this.isReadOnlyRequest(request.method)) {
                const cached = this.requestCache.get(cacheKey);
                if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL_MS) {
                    this.performanceStats.cached_responses++;
                    const responseTime = performance.now() - startTime;
                    this.updatePerformanceStats(responseTime);
                    return {
                        jsonrpc: '2.0',
                        id: request.id,
                        result: cached.response
                    };
                }
            }
            let result;
            switch (request.method) {
                case 'initialize':
                    result = await this.handleInitialize(request.params);
                    break;
                case 'tools/list':
                    result = await this.handleToolsList();
                    break;
                case 'tools/call':
                    result = await this.handleToolCall(request.params, organizationId, userId);
                    break;
                case 'resources/list':
                    result = await this.handleResourcesList(organizationId);
                    break;
                case 'resources/read':
                    result = await this.handleResourceRead(request.params, organizationId);
                    break;
                case 'prompts/list':
                    result = await this.handlePromptsList();
                    break;
                case 'prompts/get':
                    result = await this.handlePromptGet(request.params);
                    break;
                case 'logging/setLevel':
                    result = await this.handleSetLogLevel(request.params);
                    break;
                case 'metrics/session/start':
                    result = await this.handleSessionStart(request.params, organizationId, userId);
                    break;
                case 'metrics/session/end':
                    result = await this.handleSessionEnd(request.params, organizationId, userId);
                    break;
                case 'metrics/session/activity':
                    result = await this.handleSessionActivity(request.params, organizationId, userId);
                    break;
                case 'metrics/tool/usage':
                    result = await this.handleToolUsage(request.params, organizationId, userId);
                    break;
                case 'metrics/batch':
                    result = await this.handleMetricsBatch(request.params, organizationId);
                    break;
                case 'metrics/query':
                    result = await this.handleMetricsQuery(request.params, organizationId);
                    break;
                default:
                    throw new Error(`Method not found: ${request.method}`);
            }
            if (this.isReadOnlyRequest(request.method) && result) {
                this.requestCache.set(cacheKey, {
                    response: result,
                    timestamp: Date.now()
                });
            }
            const responseTime = performance.now() - startTime;
            this.updatePerformanceStats(responseTime);
            return {
                jsonrpc: '2.0',
                id: request.id,
                result
            };
        }
        catch (error) {
            const responseTime = performance.now() - startTime;
            this.updatePerformanceStats(responseTime);
            this.logger.error('MCP request error', {
                method: request.method,
                organization_id: organizationId,
                user_id: userId,
                error: error instanceof Error ? error.message : 'Unknown error',
                response_time_ms: responseTime
            });
            return {
                jsonrpc: '2.0',
                id: request.id,
                error: {
                    code: -32603,
                    message: 'Internal error',
                    data: {
                        method: request.method,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    }
                }
            };
        }
    }
    async handleBatchRequests(requests, organizationId, userId) {
        const maxBatchSize = 20;
        if (requests.length > maxBatchSize) {
            throw new Error(`Batch size exceeded. Maximum ${maxBatchSize} requests allowed.`);
        }
        const concurrencyLimit = 5;
        const responses = [];
        for (let i = 0; i < requests.length; i += concurrencyLimit) {
            const batch = requests.slice(i, i + concurrencyLimit);
            const batchResponses = await Promise.all(batch.map(req => this.handleRequest(req, organizationId, userId)));
            responses.push(...batchResponses);
        }
        return responses;
    }
    async getServerCapabilities() {
        return {
            server_info: {
                name: 'fortium-metrics-server',
                version: '1.0.0',
                description: 'Fortium External Metrics Web Service MCP Server',
                author: 'Fortium Partners',
                license: 'PROPRIETARY',
                homepage: 'https://github.com/FortiumPartners/claude-config'
            },
            capabilities: {
                tools: { listChanged: true },
                resources: { subscribe: true, listChanged: true },
                prompts: { listChanged: true },
                logging: {}
            },
            tools: await this.getAvailableTools(),
            resources: await this.getAvailableResources(),
            prompts: await this.getAvailablePrompts()
        };
    }
    async getServerHealth() {
        try {
            const dbStart = performance.now();
            await this.metricsModel.healthCheck();
            const dbLatency = performance.now() - dbStart;
            const cacheHitRate = this.performanceStats.total_requests > 0
                ? this.performanceStats.cached_responses / this.performanceStats.total_requests
                : 0;
            const under5msPercent = this.performanceStats.total_requests > 0
                ? this.performanceStats.requests_under_5ms / this.performanceStats.total_requests
                : 0;
            let status = 'healthy';
            if (this.performanceStats.avg_response_time_ms > 10 || dbLatency > 50) {
                status = 'degraded';
            }
            if (this.performanceStats.avg_response_time_ms > 20 || dbLatency > 100) {
                status = 'unhealthy';
            }
            return {
                status,
                performance: {
                    avg_response_time_ms: this.performanceStats.avg_response_time_ms,
                    requests_under_5ms_percent: under5msPercent * 100,
                    cache_hit_rate: cacheHitRate * 100,
                    total_requests: this.performanceStats.total_requests
                },
                database: {
                    connected: true,
                    latency_ms: dbLatency
                },
                timestamp: new Date().toISOString()
            };
        }
        catch (error) {
            return {
                status: 'unhealthy',
                performance: {
                    avg_response_time_ms: this.performanceStats.avg_response_time_ms,
                    requests_under_5ms_percent: 0,
                    cache_hit_rate: 0,
                    total_requests: this.performanceStats.total_requests
                },
                database: {
                    connected: false
                },
                timestamp: new Date().toISOString()
            };
        }
    }
    async handleInitialize(params) {
        return {
            protocolVersion: '2024-11-05',
            capabilities: {
                tools: { listChanged: true },
                resources: { subscribe: true, listChanged: true },
                prompts: { listChanged: true },
                logging: {}
            },
            serverInfo: {
                name: 'fortium-metrics-server',
                version: '1.0.0'
            }
        };
    }
    async handleToolsList() {
        return {
            tools: await this.getAvailableTools()
        };
    }
    async handleToolCall(params, organizationId, userId) {
        const startTime = performance.now();
        try {
            switch (params.name) {
                case 'record-session-start':
                    return await this.toolRecordSessionStart(params.arguments, organizationId, userId);
                case 'record-session-end':
                    return await this.toolRecordSessionEnd(params.arguments, organizationId, userId);
                case 'record-tool-usage':
                    return await this.toolRecordToolUsage(params.arguments, organizationId, userId);
                case 'get-session-metrics':
                    return await this.toolGetSessionMetrics(params.arguments, organizationId);
                case 'get-tool-metrics':
                    return await this.toolGetToolMetrics(params.arguments, organizationId);
                default:
                    throw new Error(`Tool not found: ${params.name}`);
            }
        }
        finally {
            const executionTime = performance.now() - startTime;
            await this.toolMetricsService.recordToolExecution(organizationId, {
                user_id: userId,
                tool_name: params.name,
                input_parameters: params.arguments,
                output_summary: { success: true }
            }, executionTime, 'success').catch(error => {
                this.logger.error('Failed to record tool execution', { error });
            });
        }
    }
    async handleResourcesList(organizationId) {
        return {
            resources: [
                {
                    uri: `fortium://metrics/sessions/${organizationId}`,
                    name: 'User Sessions',
                    description: 'List of user sessions for the organization',
                    mimeType: 'application/json'
                },
                {
                    uri: `fortium://metrics/tools/${organizationId}`,
                    name: 'Tool Usage',
                    description: 'Tool usage metrics for the organization',
                    mimeType: 'application/json'
                },
                {
                    uri: `fortium://metrics/performance/${organizationId}`,
                    name: 'Performance Metrics',
                    description: 'Performance and productivity metrics',
                    mimeType: 'application/json'
                }
            ]
        };
    }
    async handleResourceRead(params, organizationId) {
        const uri = params.uri;
        if (uri === `fortium://metrics/sessions/${organizationId}`) {
            const sessions = this.sessionService.getActiveSessions(organizationId);
            return {
                contents: [{
                        uri,
                        mimeType: 'application/json',
                        text: JSON.stringify(sessions, null, 2)
                    }]
            };
        }
        throw new Error(`Resource not found: ${uri}`);
    }
    async handlePromptsList() {
        return {
            prompts: await this.getAvailablePrompts()
        };
    }
    async handlePromptGet(params) {
        throw new Error(`Prompt not found: ${params.name}`);
    }
    async handleSetLogLevel(params) {
        this.logger.level = params.level;
        return { success: true };
    }
    async handleSessionStart(params, organizationId, userId) {
        const result = await this.sessionService.startSession(organizationId, userId, params.metadata);
        return {
            success: result.success,
            session_id: result.session?.id,
            message: result.message
        };
    }
    async handleSessionEnd(params, organizationId, userId) {
        const result = await this.sessionService.endSession(organizationId, params.session_id, params.end_metadata);
        return {
            success: result.success,
            summary: result.summary,
            message: result.message
        };
    }
    async handleSessionActivity(params, organizationId, userId) {
        const result = await this.sessionService.updateSessionActivity(organizationId, params.session_id, params.activity);
        return {
            success: result.success,
            message: result.message
        };
    }
    async handleToolUsage(params, organizationId, userId) {
        const result = await this.toolMetricsService.recordToolExecution(organizationId, {
            user_id: userId,
            tool_name: params.tool_name,
            ...params.context
        }, params.execution_time_ms, params.status);
        return {
            success: result.success,
            alerts: result.alerts,
            message: result.message
        };
    }
    async handleMetricsBatch(params, organizationId) {
        throw new Error('Batch metrics not yet implemented');
    }
    async handleMetricsQuery(params, organizationId) {
        throw new Error('Metrics query not yet implemented');
    }
    async toolRecordSessionStart(args, organizationId, userId) {
        return await this.handleSessionStart(args, organizationId, userId);
    }
    async toolRecordSessionEnd(args, organizationId, userId) {
        return await this.handleSessionEnd(args, organizationId, userId);
    }
    async toolRecordToolUsage(args, organizationId, userId) {
        return await this.handleToolUsage(args, organizationId, userId);
    }
    async toolGetSessionMetrics(args, organizationId) {
        return await this.sessionService.getSessionMetrics();
    }
    async toolGetToolMetrics(args, organizationId) {
        const days = args.days || 7;
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));
        if (args.tool_name) {
            return await this.toolMetricsService.getToolMetrics(organizationId, args.tool_name, {
                start: startDate,
                end: endDate
            });
        }
        else {
            return await this.toolMetricsService.getAllToolMetrics(organizationId, {
                start: startDate,
                end: endDate
            });
        }
    }
    async getAvailableTools() {
        return [
            {
                name: 'record-session-start',
                description: 'Start a new user session with metadata',
                inputSchema: {
                    type: 'object',
                    properties: {
                        metadata: { type: 'object' }
                    }
                }
            },
            {
                name: 'record-session-end',
                description: 'End a user session with completion metadata',
                inputSchema: {
                    type: 'object',
                    properties: {
                        session_id: { type: 'string' },
                        end_metadata: { type: 'object' }
                    },
                    required: ['session_id']
                }
            },
            {
                name: 'record-tool-usage',
                description: 'Record tool execution with performance metrics',
                inputSchema: {
                    type: 'object',
                    properties: {
                        tool_name: { type: 'string' },
                        execution_time_ms: { type: 'number' },
                        status: { type: 'string', enum: ['success', 'error', 'timeout', 'cancelled'] },
                        context: { type: 'object' }
                    },
                    required: ['tool_name', 'execution_time_ms', 'status']
                }
            },
            {
                name: 'get-session-metrics',
                description: 'Get current session metrics and statistics',
                inputSchema: {
                    type: 'object',
                    properties: {}
                }
            },
            {
                name: 'get-tool-metrics',
                description: 'Get tool usage metrics and performance data',
                inputSchema: {
                    type: 'object',
                    properties: {
                        tool_name: { type: 'string' },
                        days: { type: 'number', minimum: 1, maximum: 90 }
                    }
                }
            }
        ];
    }
    async getAvailableResources() {
        return [
            {
                uri: 'fortium://metrics/sessions',
                name: 'User Sessions',
                description: 'Active and recent user sessions'
            },
            {
                uri: 'fortium://metrics/tools',
                name: 'Tool Usage',
                description: 'Tool execution metrics and trends'
            }
        ];
    }
    async getAvailablePrompts() {
        return [
            {
                name: 'analyze-productivity',
                description: 'Analyze user productivity metrics and provide insights',
                arguments: [
                    { name: 'user_id', description: 'User to analyze', required: true },
                    { name: 'days', description: 'Number of days to analyze', required: false }
                ]
            }
        ];
    }
    getCacheKey(request, organizationId, userId) {
        return `${request.method}:${organizationId}:${JSON.stringify(request.params)}`;
    }
    isReadOnlyRequest(method) {
        const readOnlyMethods = [
            'tools/list',
            'resources/list',
            'resources/read',
            'prompts/list',
            'prompts/get',
            'metrics/query'
        ];
        return readOnlyMethods.includes(method);
    }
    updatePerformanceStats(responseTimeMs) {
        const current = this.performanceStats.avg_response_time_ms;
        const count = this.performanceStats.total_requests;
        this.performanceStats.avg_response_time_ms =
            ((current * (count - 1)) + responseTimeMs) / count;
        if (responseTimeMs < 5) {
            this.performanceStats.requests_under_5ms++;
        }
    }
    clearExpiredCache() {
        const now = Date.now();
        for (const [key, cached] of this.requestCache.entries()) {
            if ((now - cached.timestamp) > this.CACHE_TTL_MS) {
                this.requestCache.delete(key);
            }
        }
    }
}
exports.McpServer = McpServer;
//# sourceMappingURL=mcp-server.js.map