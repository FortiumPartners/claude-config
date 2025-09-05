"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCP_ERROR_CODES = void 0;
exports.createMcpRoutes = createMcpRoutes;
const express_1 = require("express");
const mcp_server_service_1 = require("../services/mcp-server.service");
const auth_middleware_1 = require("../middleware/auth.middleware");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
function createMcpRoutes(db, logger) {
    const router = (0, express_1.Router)();
    const mcpService = new mcp_server_service_1.McpServerService(db, logger);
    const mcpRateLimit = (0, express_rate_limit_1.default)({
        windowMs: 60 * 1000,
        max: 500,
        message: {
            jsonrpc: '2.0',
            error: {
                code: -32000,
                message: 'Rate limit exceeded',
                data: {
                    retry_after: 60,
                    limit_type: 'mcp_requests'
                }
            }
        },
        standardHeaders: false,
        legacyHeaders: false,
        keyGenerator: (req) => {
            return req.user?.organization_id || req.ip;
        },
        handler: (req, res) => {
            const rateLimitResponse = {
                jsonrpc: '2.0',
                id: req.body?.id,
                error: {
                    code: -32000,
                    message: 'Rate limit exceeded',
                    data: {
                        retry_after: 60,
                        limit_type: 'mcp_requests'
                    }
                }
            };
            res.status(200).json(rateLimitResponse);
        }
    });
    router.post('/rpc', mcpRateLimit, auth_middleware_1.authMiddleware, async (req, res) => {
        try {
            const mcpRequest = req.body;
            if (!mcpRequest.jsonrpc || mcpRequest.jsonrpc !== '2.0') {
                const errorResponse = {
                    jsonrpc: '2.0',
                    id: mcpRequest.id,
                    error: {
                        code: -32600,
                        message: 'Invalid Request',
                        data: { reason: 'Missing or invalid jsonrpc field' }
                    }
                };
                return res.status(200).json(errorResponse);
            }
            if (!mcpRequest.method || typeof mcpRequest.method !== 'string') {
                const errorResponse = {
                    jsonrpc: '2.0',
                    id: mcpRequest.id,
                    error: {
                        code: -32600,
                        message: 'Invalid Request',
                        data: { reason: 'Missing or invalid method field' }
                    }
                };
                return res.status(200).json(errorResponse);
            }
            const response = await mcpService.handleRequest(mcpRequest, req.user.organization_id, req.user.id);
            res.status(200).json(response);
        }
        catch (error) {
            logger.error('MCP request error:', error);
            const errorResponse = {
                jsonrpc: '2.0',
                id: req.body?.id,
                error: {
                    code: -32603,
                    message: 'Internal error',
                    data: {
                        error: error instanceof Error ? error.message : 'Unknown error'
                    }
                }
            };
            res.status(200).json(errorResponse);
        }
    });
    router.get('/ws', async (req, res) => {
        res.status(501).json({
            error: 'WebSocket notifications not yet implemented',
            message: 'Use HTTP JSON-RPC for now. WebSocket support coming soon.'
        });
    });
    router.get('/capabilities', auth_middleware_1.authMiddleware, async (req, res) => {
        try {
            const capabilities = await mcpService.getServerCapabilities();
            res.json({
                server_info: {
                    name: 'fortium-metrics-server',
                    version: '1.0.0',
                    description: 'Fortium External Metrics Web Service MCP Server'
                },
                protocol_version: '2024-11-05',
                capabilities,
                endpoints: {
                    rpc: '/api/mcp/rpc',
                    websocket: '/api/mcp/ws'
                }
            });
        }
        catch (error) {
            logger.error('Error getting MCP capabilities:', error);
            res.status(500).json({
                error: 'Internal Server Error',
                message: 'Unable to retrieve server capabilities'
            });
        }
    });
    router.get('/health', async (req, res) => {
        try {
            const health = await mcpService.getServerHealth();
            res.json(health);
        }
        catch (error) {
            logger.error('MCP health check error:', error);
            res.status(503).json({
                status: 'unhealthy',
                error: 'Health check failed',
                timestamp: new Date().toISOString()
            });
        }
    });
    router.post('/batch', mcpRateLimit, auth_middleware_1.authMiddleware, async (req, res) => {
        try {
            const requests = req.body;
            if (!Array.isArray(requests)) {
                const errorResponse = {
                    jsonrpc: '2.0',
                    error: {
                        code: -32600,
                        message: 'Invalid Request',
                        data: { reason: 'Batch request must be an array' }
                    }
                };
                return res.status(200).json(errorResponse);
            }
            const responses = await mcpService.handleBatchRequests(requests, req.user.organization_id, req.user.id);
            res.status(200).json(responses);
        }
        catch (error) {
            logger.error('MCP batch request error:', error);
            const errorResponse = {
                jsonrpc: '2.0',
                error: {
                    code: -32603,
                    message: 'Internal error',
                    data: {
                        error: error instanceof Error ? error.message : 'Unknown error'
                    }
                }
            };
            res.status(200).json(errorResponse);
        }
    });
    return { router };
}
exports.MCP_ERROR_CODES = {
    PARSE_ERROR: -32700,
    INVALID_REQUEST: -32600,
    METHOD_NOT_FOUND: -32601,
    INVALID_PARAMS: -32602,
    INTERNAL_ERROR: -32603,
    SERVER_ERROR: -32000,
    RESOURCE_NOT_FOUND: -32001,
    TOOL_NOT_FOUND: -32002,
    AUTHENTICATION_ERROR: -32003,
    AUTHORIZATION_ERROR: -32004,
    RATE_LIMIT_ERROR: -32005,
    VALIDATION_ERROR: -32006,
    ORGANIZATION_ERROR: -33000,
    MIGRATION_ERROR: -33001,
    COMPATIBILITY_ERROR: -33002
};
//# sourceMappingURL=mcp.routes.js.map