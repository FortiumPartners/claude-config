import { DatabaseConnection } from '../database/connection';
import { MetricsSessionService } from '../services/metrics-session.service';
import { ToolMetricsService } from '../services/tool-metrics.service';
import * as winston from 'winston';
export interface McpTool {
    name: string;
    description: string;
    inputSchema: {
        type: 'object';
        properties: Record<string, any>;
        required?: string[];
    };
}
export interface McpResource {
    uri: string;
    name: string;
    description?: string;
    mimeType?: string;
}
export interface McpPrompt {
    name: string;
    description: string;
    arguments?: {
        name: string;
        description: string;
        required?: boolean;
    }[];
}
export interface McpCapabilities {
    tools?: {
        listChanged?: boolean;
    };
    resources?: {
        subscribe?: boolean;
        listChanged?: boolean;
    };
    prompts?: {
        listChanged?: boolean;
    };
    logging?: {};
}
export interface McpServerInfo {
    name: string;
    version: string;
    description?: string;
    author?: string;
    license?: string;
    homepage?: string;
}
export interface McpRequest {
    jsonrpc: '2.0';
    id?: number | string;
    method: string;
    params?: any;
}
export interface McpResponse {
    jsonrpc: '2.0';
    id?: number | string;
    result?: any;
    error?: {
        code: number;
        message: string;
        data?: any;
    };
}
export interface McpNotification {
    jsonrpc: '2.0';
    method: string;
    params?: any;
}
export declare class McpServer {
    private metricsModel;
    private sessionService;
    private toolMetricsService;
    private logger;
    private requestCache;
    private readonly CACHE_TTL_MS;
    private performanceStats;
    constructor(db: DatabaseConnection, sessionService: MetricsSessionService, toolMetricsService: ToolMetricsService, logger: winston.Logger);
    handleRequest(request: McpRequest, organizationId: string, userId: string): Promise<McpResponse>;
    handleBatchRequests(requests: McpRequest[], organizationId: string, userId: string): Promise<McpResponse[]>;
    getServerCapabilities(): Promise<{
        server_info: McpServerInfo;
        capabilities: McpCapabilities;
        tools: McpTool[];
        resources: McpResource[];
        prompts: McpPrompt[];
    }>;
    getServerHealth(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        performance: {
            avg_response_time_ms: number;
            requests_under_5ms_percent: number;
            cache_hit_rate: number;
            total_requests: number;
        };
        database: {
            connected: boolean;
            latency_ms?: number;
        };
        timestamp: string;
    }>;
    private handleInitialize;
    private handleToolsList;
    private handleToolCall;
    private handleResourcesList;
    private handleResourceRead;
    private handlePromptsList;
    private handlePromptGet;
    private handleSetLogLevel;
    private handleSessionStart;
    private handleSessionEnd;
    private handleSessionActivity;
    private handleToolUsage;
    private handleMetricsBatch;
    private handleMetricsQuery;
    private toolRecordSessionStart;
    private toolRecordSessionEnd;
    private toolRecordToolUsage;
    private toolGetSessionMetrics;
    private toolGetToolMetrics;
    private getAvailableTools;
    private getAvailableResources;
    private getAvailablePrompts;
    private getCacheKey;
    private isReadOnlyRequest;
    private updatePerformanceStats;
    private clearExpiredCache;
}
//# sourceMappingURL=mcp-server.d.ts.map