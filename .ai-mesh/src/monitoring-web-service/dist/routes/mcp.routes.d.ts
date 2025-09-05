import { Router } from 'express';
import { DatabaseConnection } from '../database/connection';
import * as winston from 'winston';
export interface McpRoutes {
    router: Router;
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
export declare function createMcpRoutes(db: DatabaseConnection, logger: winston.Logger): McpRoutes;
export declare const MCP_ERROR_CODES: {
    readonly PARSE_ERROR: -32700;
    readonly INVALID_REQUEST: -32600;
    readonly METHOD_NOT_FOUND: -32601;
    readonly INVALID_PARAMS: -32602;
    readonly INTERNAL_ERROR: -32603;
    readonly SERVER_ERROR: -32000;
    readonly RESOURCE_NOT_FOUND: -32001;
    readonly TOOL_NOT_FOUND: -32002;
    readonly AUTHENTICATION_ERROR: -32003;
    readonly AUTHORIZATION_ERROR: -32004;
    readonly RATE_LIMIT_ERROR: -32005;
    readonly VALIDATION_ERROR: -32006;
    readonly ORGANIZATION_ERROR: -33000;
    readonly MIGRATION_ERROR: -33001;
    readonly COMPATIBILITY_ERROR: -33002;
};
//# sourceMappingURL=mcp.routes.d.ts.map