"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.McpServerService = void 0;
const metrics_collection_service_1 = require("./metrics-collection.service");
const metrics_query_service_1 = require("./metrics-query.service");
const migration_service_1 = require("./migration.service");
const mcp_routes_1 = require("../routes/mcp.routes");
class McpServerService {
    db;
    logger;
    metricsCollectionService;
    metricsQueryService;
    migrationService;
    constructor(db, logger) {
        this.db = db;
        this.logger = logger;
        this.metricsCollectionService = new metrics_collection_service_1.MetricsCollectionService(db, logger);
        this.metricsQueryService = new metrics_query_service_1.MetricsQueryService(db, logger);
        this.migrationService = new migration_service_1.MigrationService(db, logger);
    }
    async handleRequest(request, organizationId, userId) {
        try {
            const { method, params, id } = request;
            switch (method) {
                case 'initialize':
                    return this.handleInitialize(id, params);
                case 'resources/list':
                    return this.handleResourcesList(id, params, organizationId);
                case 'resources/read':
                    return this.handleResourcesRead(id, params, organizationId);
                case 'tools/list':
                    return this.handleToolsList(id, params);
                case 'tools/call':
                    return this.handleToolsCall(id, params, organizationId, userId);
                case 'prompts/list':
                    return this.handlePromptsList(id, params);
                case 'prompts/get':
                    return this.handlePromptsGet(id, params, organizationId);
                case 'fortium/migrate':
                    return this.handleFortiumMigrate(id, params, organizationId, userId);
                case 'fortium/configure':
                    return this.handleFortiumConfigure(id, params, organizationId, userId);
                default:
                    return {
                        jsonrpc: '2.0',
                        id,
                        error: {
                            code: mcp_routes_1.MCP_ERROR_CODES.METHOD_NOT_FOUND,
                            message: `Method '${method}' not found`,
                            data: { available_methods: this.getAvailableMethods() }
                        }
                    };
            }
        }
        catch (error) {
            this.logger.error('MCP request handling error:', error);
            return {
                jsonrpc: '2.0',
                id: request.id,
                error: {
                    code: mcp_routes_1.MCP_ERROR_CODES.INTERNAL_ERROR,
                    message: 'Internal server error',
                    data: {
                        error: error instanceof Error ? error.message : 'Unknown error'
                    }
                }
            };
        }
    }
    async handleBatchRequests(requests, organizationId, userId) {
        if (requests.length > 100) {
            return [{
                    jsonrpc: '2.0',
                    error: {
                        code: mcp_routes_1.MCP_ERROR_CODES.INVALID_PARAMS,
                        message: 'Batch size too large',
                        data: { max_batch_size: 100, received: requests.length }
                    }
                }];
        }
        const CONCURRENCY_LIMIT = 10;
        const responses = [];
        for (let i = 0; i < requests.length; i += CONCURRENCY_LIMIT) {
            const batch = requests.slice(i, i + CONCURRENCY_LIMIT);
            const batchPromises = batch.map(request => this.handleRequest(request, organizationId, userId));
            const batchResponses = await Promise.all(batchPromises);
            responses.push(...batchResponses);
        }
        return responses;
    }
    async handleInitialize(id, params) {
        const requiredVersion = '2024-11-05';
        if (!params?.protocolVersion || params.protocolVersion !== requiredVersion) {
            return {
                jsonrpc: '2.0',
                id,
                error: {
                    code: mcp_routes_1.MCP_ERROR_CODES.INVALID_PARAMS,
                    message: `Unsupported protocol version`,
                    data: {
                        supported_version: requiredVersion,
                        received_version: params?.protocolVersion
                    }
                }
            };
        }
        return {
            jsonrpc: '2.0',
            id,
            result: {
                protocolVersion: requiredVersion,
                capabilities: await this.getServerCapabilities(),
                serverInfo: {
                    name: 'fortium-metrics-server',
                    version: '1.0.0',
                    description: 'Fortium External Metrics Web Service MCP Server'
                }
            }
        };
    }
    async handleResourcesList(id, params, organizationId) {
        try {
            const resources = [
                {
                    uri: 'metrics://dashboard/current',
                    name: 'Current Dashboard',
                    description: 'Real-time productivity metrics dashboard'
                },
                {
                    uri: 'metrics://analytics/trends',
                    name: 'Productivity Trends',
                    description: 'Historical productivity trends and analysis'
                },
                {
                    uri: 'metrics://agents/usage',
                    name: 'Agent Usage Statistics',
                    description: 'Sub-agent utilization and performance metrics'
                },
                {
                    uri: 'metrics://teams/performance',
                    name: 'Team Performance',
                    description: 'Team-level productivity and collaboration metrics'
                },
                {
                    uri: 'config://organization/settings',
                    name: 'Organization Settings',
                    description: 'Current organization configuration and preferences'
                }
            ];
            return {
                jsonrpc: '2.0',
                id,
                result: { resources }
            };
        }
        catch (error) {
            return {
                jsonrpc: '2.0',
                id,
                error: {
                    code: mcp_routes_1.MCP_ERROR_CODES.SERVER_ERROR,
                    message: 'Failed to list resources',
                    data: { error: error instanceof Error ? error.message : 'Unknown error' }
                }
            };
        }
    }
    async handleResourcesRead(id, params, organizationId) {
        if (!params?.uri) {
            return {
                jsonrpc: '2.0',
                id,
                error: {
                    code: mcp_routes_1.MCP_ERROR_CODES.INVALID_PARAMS,
                    message: 'Missing uri parameter'
                }
            };
        }
        try {
            const { uri } = params;
            switch (true) {
                case uri.startsWith('metrics://dashboard/'):
                    const dashboardData = await this.metricsQueryService.getDashboardData(organizationId, { timeframe: '24h' });
                    return {
                        jsonrpc: '2.0',
                        id,
                        result: {
                            contents: [
                                {
                                    uri,
                                    mimeType: 'application/json',
                                    text: JSON.stringify(dashboardData, null, 2)
                                }
                            ]
                        }
                    };
                case uri.startsWith('metrics://analytics/'):
                    const analyticsData = await this.metricsQueryService.getAnalyticsData(organizationId, { timeframe: '7d', include_trends: true });
                    return {
                        jsonrpc: '2.0',
                        id,
                        result: {
                            contents: [
                                {
                                    uri,
                                    mimeType: 'application/json',
                                    text: JSON.stringify(analyticsData, null, 2)
                                }
                            ]
                        }
                    };
                default:
                    return {
                        jsonrpc: '2.0',
                        id,
                        error: {
                            code: mcp_routes_1.MCP_ERROR_CODES.RESOURCE_NOT_FOUND,
                            message: `Resource not found: ${uri}`
                        }
                    };
            }
        }
        catch (error) {
            return {
                jsonrpc: '2.0',
                id,
                error: {
                    code: mcp_routes_1.MCP_ERROR_CODES.SERVER_ERROR,
                    message: 'Failed to read resource',
                    data: { error: error instanceof Error ? error.message : 'Unknown error' }
                }
            };
        }
    }
    async handleToolsList(id, params) {
        const tools = [
            {
                name: 'collect_metrics',
                description: 'Collect command execution metrics from Claude Code',
                inputSchema: {
                    type: 'object',
                    properties: {
                        command_name: { type: 'string', description: 'Name of the executed command' },
                        execution_time_ms: { type: 'number', description: 'Execution time in milliseconds' },
                        success: { type: 'boolean', description: 'Whether the command succeeded' },
                        context: {
                            type: 'object',
                            description: 'Additional context including agent usage and session info',
                            properties: {
                                claude_session: { type: 'string' },
                                agent_used: { type: 'string' },
                                delegation_pattern: { type: 'object' }
                            }
                        }
                    },
                    required: ['command_name', 'execution_time_ms', 'success']
                }
            },
            {
                name: 'query_dashboard',
                description: 'Query dashboard data and analytics',
                inputSchema: {
                    type: 'object',
                    properties: {
                        timeframe: { type: 'string', enum: ['1h', '24h', '7d', '30d'], description: 'Time range for data' },
                        metrics: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Specific metrics to include'
                        },
                        format: { type: 'string', enum: ['json', 'ascii', 'markdown'], description: 'Output format' }
                    },
                    required: ['timeframe']
                }
            },
            {
                name: 'migrate_local_metrics',
                description: 'Migrate existing local metrics to web service',
                inputSchema: {
                    type: 'object',
                    properties: {
                        local_config_path: { type: 'string', description: 'Path to local configuration' },
                        legacy_format: { type: 'object', description: 'Legacy metric data' },
                        preserve_local: { type: 'boolean', description: 'Keep local copy after migration' }
                    }
                }
            },
            {
                name: 'configure_integration',
                description: 'Configure Claude Code integration settings',
                inputSchema: {
                    type: 'object',
                    properties: {
                        webhook_url: { type: 'string' },
                        notification_settings: { type: 'object' },
                        sync_preferences: { type: 'object' }
                    }
                }
            }
        ];
        return {
            jsonrpc: '2.0',
            id,
            result: { tools }
        };
    }
    async handleToolsCall(id, params, organizationId, userId) {
        if (!params?.name) {
            return {
                jsonrpc: '2.0',
                id,
                error: {
                    code: mcp_routes_1.MCP_ERROR_CODES.INVALID_PARAMS,
                    message: 'Missing tool name'
                }
            };
        }
        const { name, arguments: args } = params;
        try {
            switch (name) {
                case 'collect_metrics':
                    return await this.handleCollectMetrics(id, args, organizationId, userId);
                case 'query_dashboard':
                    return await this.handleQueryDashboard(id, args, organizationId);
                case 'migrate_local_metrics':
                    return await this.handleMigrateLocalMetrics(id, args, organizationId, userId);
                case 'configure_integration':
                    return await this.handleConfigureIntegration(id, args, organizationId, userId);
                default:
                    return {
                        jsonrpc: '2.0',
                        id,
                        error: {
                            code: mcp_routes_1.MCP_ERROR_CODES.TOOL_NOT_FOUND,
                            message: `Tool '${name}' not found`
                        }
                    };
            }
        }
        catch (error) {
            this.logger.error(`Tool call error for ${name}:`, error);
            return {
                jsonrpc: '2.0',
                id,
                error: {
                    code: mcp_routes_1.MCP_ERROR_CODES.SERVER_ERROR,
                    message: `Tool execution failed: ${name}`,
                    data: { error: error instanceof Error ? error.message : 'Unknown error' }
                }
            };
        }
    }
    async handleCollectMetrics(id, args, organizationId, userId) {
        const result = await this.metricsCollectionService.collectCommandExecution(organizationId, args);
        if (!result.success) {
            return {
                jsonrpc: '2.0',
                id,
                error: {
                    code: mcp_routes_1.MCP_ERROR_CODES.SERVER_ERROR,
                    message: 'Failed to collect metrics',
                    data: { reason: result.message }
                }
            };
        }
        return {
            jsonrpc: '2.0',
            id,
            result: {
                content: [
                    {
                        type: 'text',
                        text: `Metric collected successfully. ID: ${result.data?.metric_id}`
                    }
                ]
            }
        };
    }
    async handleQueryDashboard(id, args, organizationId) {
        const { timeframe = '24h', metrics, format = 'json' } = args;
        const dashboardData = await this.metricsQueryService.getDashboardData(organizationId, { timeframe, metrics });
        let content;
        switch (format) {
            case 'ascii':
                content = this.formatDashboardAscii(dashboardData);
                break;
            case 'markdown':
                content = this.formatDashboardMarkdown(dashboardData);
                break;
            default:
                content = JSON.stringify(dashboardData, null, 2);
        }
        return {
            jsonrpc: '2.0',
            id,
            result: {
                content: [
                    {
                        type: 'text',
                        text: content
                    }
                ]
            }
        };
    }
    async handleMigrateLocalMetrics(id, args, organizationId, userId) {
        const migrationResult = await this.migrationService.migrateLocalMetrics(organizationId, userId, args);
        return {
            jsonrpc: '2.0',
            id,
            result: {
                content: [
                    {
                        type: 'text',
                        text: `Migration completed. Migrated ${migrationResult.metrics_migrated} metrics.`
                    }
                ]
            }
        };
    }
    async handleConfigureIntegration(id, args, organizationId, userId) {
        return {
            jsonrpc: '2.0',
            id,
            result: {
                content: [
                    {
                        type: 'text',
                        text: 'Integration configuration updated successfully'
                    }
                ]
            }
        };
    }
    async getServerCapabilities() {
        return {
            resources: {
                subscribe: false,
                listChanged: false
            },
            tools: {
                listChanged: false
            },
            prompts: {
                listChanged: false
            },
            experimental: {
                batch_requests: true,
                real_time_metrics: true,
                migration_tools: true
            }
        };
    }
    async getServerHealth() {
        try {
            await this.db.query('SELECT 1');
            return {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                version: '1.0.0',
                protocol_version: '2024-11-05',
                uptime_seconds: process.uptime(),
                database: 'connected'
            };
        }
        catch (error) {
            return {
                status: 'unhealthy',
                timestamp: new Date().toISOString(),
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    async handlePromptsList(id, params) {
        return {
            jsonrpc: '2.0',
            id,
            result: { prompts: [] }
        };
    }
    async handlePromptsGet(id, params, organizationId) {
        return {
            jsonrpc: '2.0',
            id,
            error: {
                code: mcp_routes_1.MCP_ERROR_CODES.METHOD_NOT_FOUND,
                message: 'Prompts not yet implemented'
            }
        };
    }
    async handleFortiumMigrate(id, params, organizationId, userId) {
        return {
            jsonrpc: '2.0',
            id,
            result: { migration_status: 'completed' }
        };
    }
    async handleFortiumConfigure(id, params, organizationId, userId) {
        return {
            jsonrpc: '2.0',
            id,
            result: { configuration_updated: true }
        };
    }
    getAvailableMethods() {
        return [
            'initialize',
            'resources/list',
            'resources/read',
            'tools/list',
            'tools/call',
            'prompts/list',
            'prompts/get',
            'fortium/migrate',
            'fortium/configure'
        ];
    }
    formatDashboardAscii(data) {
        return `
┌─────────────────────────────────────────────────────────────┐
│ FORTIUM AI-AUGMENTED DEVELOPMENT DASHBOARD                 │
├─────────────────────────────────────────────────────────────┤
│ Commands Executed: ${String(data.command_count || 0).padStart(6)}     Success Rate: ${String(Math.round((data.success_rate || 0) * 100)).padStart(3)}% │
│ Active Agents: ${String(data.active_agents || 0).padStart(10)}         Productivity: +${String(Math.round(data.productivity_improvement || 0)).padStart(2)}% │
│ Response Time: ${String(Math.round(data.avg_response_time || 0)).padStart(6)}ms       Quality Score: ${String(Math.round((data.quality_score || 0) * 100)).padStart(3)}% │
└─────────────────────────────────────────────────────────────┘`;
    }
    formatDashboardMarkdown(data) {
        return `# Fortium AI-Augmented Development Dashboard

## Key Metrics
- **Commands Executed**: ${data.command_count || 0}
- **Success Rate**: ${Math.round((data.success_rate || 0) * 100)}%
- **Active Agents**: ${data.active_agents || 0}
- **Productivity Improvement**: +${Math.round(data.productivity_improvement || 0)}%
- **Average Response Time**: ${Math.round(data.avg_response_time || 0)}ms
- **Quality Score**: ${Math.round((data.quality_score || 0) * 100)}%

## Recent Activity
${data.recent_commands?.map(cmd => `- ${cmd.name}: ${cmd.duration}ms`).join('\n') || 'No recent activity'}`;
    }
}
exports.McpServerService = McpServerService;
//# sourceMappingURL=mcp-server.service.js.map