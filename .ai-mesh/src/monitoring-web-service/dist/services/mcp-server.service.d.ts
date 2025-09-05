import { DatabaseConnection } from '../database/connection';
import * as winston from 'winston';
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
export interface McpResource {
    uri: string;
    name: string;
    description: string;
    mimeType?: string;
}
export interface McpTool {
    name: string;
    description: string;
    inputSchema: {
        type: 'object';
        properties: Record<string, any>;
        required?: string[];
    };
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
export interface ServerCapabilities {
    resources?: {
        subscribe?: boolean;
        listChanged?: boolean;
    };
    tools?: {
        listChanged?: boolean;
    };
    prompts?: {
        listChanged?: boolean;
    };
    experimental?: Record<string, any>;
}
export declare class McpServerService {
    private db;
    private logger;
    private metricsCollectionService;
    private metricsQueryService;
    private migrationService;
    constructor(db: DatabaseConnection, logger: winston.Logger);
    handleRequest(request: McpRequest, organizationId: string, userId: string): Promise<McpResponse>;
    handleBatchRequests(requests: McpRequest[], organizationId: string, userId: string): Promise<McpResponse[]>;
    private handleInitialize;
    private handleResourcesList;
    private handleResourcesRead;
    private handleToolsList;
    private handleToolsCall;
    private handleCollectMetrics;
    private handleQueryDashboard;
    private handleMigrateLocalMetrics;
    private handleConfigureIntegration;
    getServerCapabilities(): Promise<ServerCapabilities>;
    getServerHealth(): Promise<any>;
    private handlePromptsList;
    private handlePromptsGet;
    private handleFortiumMigrate;
    private handleFortiumConfigure;
    private getAvailableMethods;
    private formatDashboardAscii;
    private formatDashboardMarkdown;
}
//# sourceMappingURL=mcp-server.service.d.ts.map