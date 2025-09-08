"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompatibilityService = void 0;
const mcp_server_service_1 = require("./mcp-server.service");
class CompatibilityService {
    db;
    logger;
    mcpServerService;
    compatibilityRules = new Map();
    constructor(db, logger) {
        this.db = db;
        this.logger = logger;
        this.mcpServerService = new mcp_server_service_1.McpServerService(db, logger);
        this.initializeCompatibilityRules();
    }
    async handleLegacyRequest(request, organizationId, userId) {
        try {
            const protocolVersion = this.detectProtocolVersion(request);
            const modernRequest = await this.transformLegacyRequest(request, protocolVersion);
            const modernResponse = await this.mcpServerService.handleRequest(modernRequest, organizationId, userId);
            const legacyResponse = await this.transformModernResponse(modernResponse, request, protocolVersion);
            await this.logCompatibilityUsage(organizationId, protocolVersion, request.method, modernRequest.method);
            return legacyResponse;
        }
        catch (error) {
            this.logger.error('Legacy request handling error:', error);
            return {
                id: request.id,
                error: {
                    code: -32603,
                    message: 'Internal error',
                    data: {
                        error: error instanceof Error ? error.message : 'Unknown error',
                        compatibility_layer: true
                    }
                }
            };
        }
    }
    detectProtocolVersion(request) {
        if (request.version) {
            return request.version;
        }
        if (request.method?.startsWith('dashboard/')) {
            return 'legacy-dashboard';
        }
        if (request.method?.startsWith('metrics/')) {
            return 'legacy-metrics';
        }
        if (request.method === 'get_capabilities') {
            return 'mcp-2023';
        }
        if (!request.method?.includes('/')) {
            return 'pre-mcp';
        }
        return '2024-11-05';
    }
    async transformLegacyRequest(legacyRequest, version) {
        const rule = this.compatibilityRules.get(legacyRequest.method);
        if (rule) {
            if (rule.deprecationWarning) {
                this.logger.warn(`Deprecated method used: ${legacyRequest.method} - ${rule.deprecationWarning}`);
            }
            const modernRequest = {
                jsonrpc: '2.0',
                id: legacyRequest.id,
                method: rule.modernMethod,
                params: rule.paramTransformer
                    ? rule.paramTransformer(legacyRequest.params)
                    : legacyRequest.params
            };
            return modernRequest;
        }
        switch (version) {
            case 'legacy-dashboard':
                return this.transformLegacyDashboardRequest(legacyRequest);
            case 'legacy-metrics':
                return this.transformLegacyMetricsRequest(legacyRequest);
            case 'mcp-2023':
                return this.transformMcp2023Request(legacyRequest);
            case 'pre-mcp':
                return this.transformPreMcpRequest(legacyRequest);
            default:
                return {
                    jsonrpc: '2.0',
                    id: legacyRequest.id,
                    method: legacyRequest.method,
                    params: legacyRequest.params
                };
        }
    }
    transformLegacyDashboardRequest(request) {
        switch (request.method) {
            case 'dashboard/get':
                return {
                    jsonrpc: '2.0',
                    id: request.id,
                    method: 'tools/call',
                    params: {
                        name: 'query_dashboard',
                        arguments: {
                            timeframe: request.params?.timeframe || '24h',
                            format: request.params?.format || 'json',
                            ...request.params
                        }
                    }
                };
            case 'dashboard/metrics':
                return {
                    jsonrpc: '2.0',
                    id: request.id,
                    method: 'resources/read',
                    params: {
                        uri: 'metrics://dashboard/current'
                    }
                };
            default:
                throw new Error(`Unknown legacy dashboard method: ${request.method}`);
        }
    }
    transformLegacyMetricsRequest(request) {
        switch (request.method) {
            case 'metrics/send':
            case 'metrics/collect':
                return {
                    jsonrpc: '2.0',
                    id: request.id,
                    method: 'tools/call',
                    params: {
                        name: 'collect_metrics',
                        arguments: this.transformLegacyMetricsParams(request.params)
                    }
                };
            case 'metrics/query':
                return {
                    jsonrpc: '2.0',
                    id: request.id,
                    method: 'tools/call',
                    params: {
                        name: 'query_dashboard',
                        arguments: {
                            timeframe: request.params?.timeframe || '24h',
                            metrics: request.params?.metrics,
                            format: 'json'
                        }
                    }
                };
            default:
                throw new Error(`Unknown legacy metrics method: ${request.method}`);
        }
    }
    transformMcp2023Request(request) {
        switch (request.method) {
            case 'get_capabilities':
                return {
                    jsonrpc: '2.0',
                    id: request.id,
                    method: 'initialize',
                    params: {
                        protocolVersion: '2024-11-05',
                        capabilities: {},
                        clientInfo: {
                            name: 'legacy-client',
                            version: '2023'
                        }
                    }
                };
            case 'list_tools':
                return {
                    jsonrpc: '2.0',
                    id: request.id,
                    method: 'tools/list',
                    params: request.params
                };
            case 'call_tool':
                return {
                    jsonrpc: '2.0',
                    id: request.id,
                    method: 'tools/call',
                    params: {
                        name: request.params?.tool_name || request.params?.name,
                        arguments: request.params?.arguments || request.params?.args
                    }
                };
            default:
                return {
                    jsonrpc: '2.0',
                    id: request.id,
                    method: request.method,
                    params: request.params
                };
        }
    }
    transformPreMcpRequest(request) {
        const commandMappings = {
            'send_metrics': 'collect_metrics',
            'get_dashboard': 'query_dashboard',
            'migrate_data': 'migrate_local_metrics',
            'health_check': 'server_health'
        };
        const toolName = commandMappings[request.method] || request.method;
        return {
            jsonrpc: '2.0',
            id: request.id,
            method: 'tools/call',
            params: {
                name: toolName,
                arguments: request.params || {}
            }
        };
    }
    async transformModernResponse(modernResponse, originalRequest, version) {
        const rule = this.compatibilityRules.get(originalRequest.method);
        if (rule?.responseTransformer) {
            return {
                id: modernResponse.id,
                result: rule.responseTransformer(modernResponse.result),
                error: modernResponse.error
            };
        }
        switch (version) {
            case 'legacy-dashboard':
                return this.transformLegacyDashboardResponse(modernResponse, originalRequest);
            case 'legacy-metrics':
                return this.transformLegacyMetricsResponse(modernResponse, originalRequest);
            case 'mcp-2023':
                return this.transformMcp2023Response(modernResponse, originalRequest);
            case 'pre-mcp':
                return this.transformPreMcpResponse(modernResponse, originalRequest);
            default:
                const { jsonrpc, ...legacyResponse } = modernResponse;
                return legacyResponse;
        }
    }
    transformLegacyDashboardResponse(response, originalRequest) {
        if (response.error) {
            return { id: response.id, error: response.error };
        }
        switch (originalRequest.method) {
            case 'dashboard/get':
                if (response.result?.content?.[0]?.text) {
                    try {
                        const dashboardData = JSON.parse(response.result.content[0].text);
                        return {
                            id: response.id,
                            result: {
                                dashboard: dashboardData,
                                timestamp: new Date().toISOString()
                            }
                        };
                    }
                    catch {
                        return {
                            id: response.id,
                            result: { raw_content: response.result.content[0].text }
                        };
                    }
                }
                break;
            case 'dashboard/metrics':
                if (response.result?.contents?.[0]?.text) {
                    try {
                        const metricsData = JSON.parse(response.result.contents[0].text);
                        return {
                            id: response.id,
                            result: { metrics: metricsData }
                        };
                    }
                    catch {
                        return {
                            id: response.id,
                            result: { raw_data: response.result.contents[0].text }
                        };
                    }
                }
                break;
        }
        return { id: response.id, result: response.result };
    }
    transformLegacyMetricsResponse(response, originalRequest) {
        if (response.error) {
            return { id: response.id, error: response.error };
        }
        switch (originalRequest.method) {
            case 'metrics/send':
            case 'metrics/collect':
                return {
                    id: response.id,
                    result: {
                        success: true,
                        message: 'Metrics collected successfully',
                        ...response.result
                    }
                };
            case 'metrics/query':
                if (response.result?.content?.[0]?.text) {
                    try {
                        const data = JSON.parse(response.result.content[0].text);
                        return {
                            id: response.id,
                            result: {
                                metrics: data,
                                count: Array.isArray(data) ? data.length : 1,
                                timestamp: new Date().toISOString()
                            }
                        };
                    }
                    catch {
                        return {
                            id: response.id,
                            result: { raw_data: response.result.content[0].text }
                        };
                    }
                }
                break;
        }
        return { id: response.id, result: response.result };
    }
    transformMcp2023Response(response, originalRequest) {
        if (response.error) {
            return { id: response.id, error: response.error };
        }
        switch (originalRequest.method) {
            case 'get_capabilities':
                return {
                    id: response.id,
                    result: {
                        capabilities: response.result?.capabilities || {},
                        server_info: response.result?.serverInfo || {},
                        protocol_version: '2023'
                    }
                };
            case 'list_tools':
                return {
                    id: response.id,
                    result: {
                        tools: response.result?.tools || []
                    }
                };
            case 'call_tool':
                return {
                    id: response.id,
                    result: {
                        tool_result: response.result,
                        success: !response.error
                    }
                };
            default:
                const { jsonrpc, ...legacyResponse } = response;
                return legacyResponse;
        }
    }
    transformPreMcpResponse(response, originalRequest) {
        if (response.error) {
            return {
                id: response.id,
                error: {
                    code: response.error.code,
                    message: response.error.message
                }
            };
        }
        if (response.result?.content?.[0]?.text) {
            return {
                id: response.id,
                result: {
                    success: true,
                    data: response.result.content[0].text,
                    message: 'Operation completed successfully'
                }
            };
        }
        return {
            id: response.id,
            result: response.result || { success: true }
        };
    }
    transformLegacyMetricsParams(params) {
        if (!params)
            return {};
        const transformed = {};
        const fieldMappings = {
            'command': 'command_name',
            'duration': 'execution_time_ms',
            'time': 'execution_time_ms',
            'duration_ms': 'execution_time_ms',
            'succeeded': 'success',
            'status': 'success',
            'agent': 'context.agent_used',
            'session': 'context.claude_session',
            'metadata': 'context'
        };
        Object.entries(params).forEach(([key, value]) => {
            const mappedKey = fieldMappings[key];
            if (mappedKey) {
                if (mappedKey.includes('.')) {
                    const [parent, child] = mappedKey.split('.');
                    if (!transformed[parent])
                        transformed[parent] = {};
                    transformed[parent][child] = value;
                }
                else {
                    transformed[mappedKey] = value;
                }
            }
            else {
                transformed[key] = value;
            }
        });
        if (!transformed.command_name) {
            transformed.command_name = params.name || params.action || 'unknown_command';
        }
        if (transformed.execution_time_ms === undefined) {
            transformed.execution_time_ms = 0;
        }
        if (transformed.success === undefined) {
            transformed.success = params.status !== 'failed' && params.status !== false;
        }
        return transformed;
    }
    initializeCompatibilityRules() {
        const rules = [
            {
                legacyMethod: 'dashboard_get',
                modernMethod: 'tools/call',
                paramTransformer: (params) => ({
                    name: 'query_dashboard',
                    arguments: params
                }),
                deprecationWarning: 'dashboard_get is deprecated, use tools/call with query_dashboard'
            },
            {
                legacyMethod: 'send_metric',
                modernMethod: 'tools/call',
                paramTransformer: (params) => ({
                    name: 'collect_metrics',
                    arguments: this.transformLegacyMetricsParams(params)
                }),
                deprecationWarning: 'send_metric is deprecated, use tools/call with collect_metrics'
            },
            {
                legacyMethod: 'get_tools',
                modernMethod: 'tools/list',
                deprecationWarning: 'get_tools is deprecated, use tools/list'
            },
            {
                legacyMethod: 'execute_tool',
                modernMethod: 'tools/call',
                paramTransformer: (params) => ({
                    name: params.tool_name || params.name,
                    arguments: params.args || params.arguments
                }),
                deprecationWarning: 'execute_tool is deprecated, use tools/call'
            }
        ];
        rules.forEach(rule => {
            this.compatibilityRules.set(rule.legacyMethod, rule);
        });
    }
    async logCompatibilityUsage(organizationId, protocolVersion, legacyMethod, modernMethod) {
        try {
            const query = `
        INSERT INTO compatibility_usage_log (
          organization_id, protocol_version, legacy_method, modern_method, 
          usage_count, last_used, created_at
        ) 
        VALUES ($1, $2, $3, $4, 1, NOW(), NOW())
        ON CONFLICT (organization_id, protocol_version, legacy_method, modern_method)
        DO UPDATE SET 
          usage_count = compatibility_usage_log.usage_count + 1,
          last_used = NOW()
      `;
            await this.db.query(query, [
                organizationId,
                protocolVersion,
                legacyMethod,
                modernMethod
            ]);
        }
        catch (error) {
            this.logger.warn('Failed to log compatibility usage:', error);
        }
    }
    async getCompatibilityStats(organizationId) {
        const query = `
      SELECT 
        protocol_version, 
        legacy_method, 
        modern_method,
        usage_count, 
        last_used
      FROM compatibility_usage_log 
      WHERE organization_id = $1 
      ORDER BY usage_count DESC, last_used DESC
    `;
        const result = await this.db.query(query, [organizationId]);
        return result.rows;
    }
}
exports.CompatibilityService = CompatibilityService;
//# sourceMappingURL=compatibility.service.js.map