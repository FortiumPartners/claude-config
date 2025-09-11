"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketService = void 0;
const ws_1 = __importDefault(require("ws"));
const mcp_server_service_1 = require("./mcp-server.service");
const compatibility_service_1 = require("./compatibility.service");
const jwt = __importStar(require("jsonwebtoken"));
const events_1 = __importDefault(require("events"));
class WebSocketService extends events_1.default {
    db;
    logger;
    jwtSecret;
    connections = new Map();
    subscriptions = new Map();
    mcpServerService;
    compatibilityService;
    heartbeatInterval;
    constructor(db, logger, jwtSecret) {
        super();
        this.db = db;
        this.logger = logger;
        this.jwtSecret = jwtSecret;
        this.mcpServerService = new mcp_server_service_1.McpServerService(db, logger);
        this.compatibilityService = new compatibility_service_1.CompatibilityService(db, logger);
        this.heartbeatInterval = setInterval(() => {
            this.cleanupStaleConnections();
        }, 30000);
    }
    async handleConnection(ws, request) {
        try {
            const authResult = await this.authenticateConnection(request);
            if (!authResult.success) {
                ws.close(4001, 'Authentication failed');
                return;
            }
            const connectionId = this.generateConnectionId();
            const connection = {
                id: connectionId,
                ws,
                organizationId: authResult.organizationId,
                userId: authResult.userId,
                subscriptions: new Set(),
                metadata: {
                    connectedAt: new Date(),
                    lastActivity: new Date(),
                    clientInfo: authResult.clientInfo,
                    ipAddress: request.socket.remoteAddress
                }
            };
            this.connections.set(connectionId, connection);
            this.setupWebSocketHandlers(connection);
            this.sendMessage(connection, {
                type: 'notification',
                method: 'connection/established',
                params: {
                    connection_id: connectionId,
                    server_info: {
                        name: 'fortium-metrics-websocket',
                        version: '1.0.0',
                        protocol: 'mcp-websocket'
                    }
                }
            });
            this.logger.info('WebSocket connection established', {
                connection_id: connectionId,
                organization_id: connection.organizationId,
                user_id: connection.userId
            });
            this.emit('connection:established', connection);
        }
        catch (error) {
            this.logger.error('WebSocket connection error:', error);
            ws.close(4000, 'Connection setup failed');
        }
    }
    setupWebSocketHandlers(connection) {
        const { ws } = connection;
        ws.on('message', async (data) => {
            try {
                connection.metadata.lastActivity = new Date();
                const message = JSON.parse(data.toString());
                await this.handleWebSocketMessage(connection, message);
            }
            catch (error) {
                this.logger.error('WebSocket message handling error:', error);
                this.sendError(connection, 'Invalid message format', 4002);
            }
        });
        ws.on('close', (code, reason) => {
            this.handleConnectionClose(connection, code, reason);
        });
        ws.on('error', (error) => {
            this.logger.error('WebSocket error:', error, {
                connection_id: connection.id,
                organization_id: connection.organizationId
            });
        });
        ws.on('pong', () => {
            connection.metadata.lastActivity = new Date();
        });
    }
    async handleWebSocketMessage(connection, message) {
        try {
            switch (message.type) {
                case 'request':
                    await this.handleMcpRequest(connection, message);
                    break;
                case 'subscription':
                    await this.handleSubscription(connection, message);
                    break;
                default:
                    this.sendError(connection, `Unknown message type: ${message.type}`, 4003);
            }
        }
        catch (error) {
            this.logger.error('Message handling error:', error);
            this.sendError(connection, 'Message processing failed', 4004);
        }
    }
    async handleMcpRequest(connection, message) {
        if (!message.method) {
            this.sendError(connection, 'Missing method in request', 4005);
            return;
        }
        try {
            const mcpRequest = {
                jsonrpc: '2.0',
                id: message.id,
                method: message.method,
                params: message.params
            };
            const isLegacy = this.isLegacyRequest(mcpRequest);
            let response;
            if (isLegacy) {
                response = await this.compatibilityService.handleLegacyRequest(mcpRequest, connection.organizationId, connection.userId);
            }
            else {
                response = await this.mcpServerService.handleRequest(mcpRequest, connection.organizationId, connection.userId);
            }
            this.sendMessage(connection, {
                type: 'response',
                id: message.id,
                result: response.result,
                error: response.error
            });
        }
        catch (error) {
            this.sendMessage(connection, {
                type: 'response',
                id: message.id,
                error: {
                    code: -32603,
                    message: 'Internal error',
                    data: { error: error instanceof Error ? error.message : 'Unknown error' }
                }
            });
        }
    }
    async handleSubscription(connection, message) {
        const { method, params } = message;
        switch (method) {
            case 'subscribe':
                await this.handleSubscribe(connection, message, params);
                break;
            case 'unsubscribe':
                await this.handleUnsubscribe(connection, message, params);
                break;
            case 'list_subscriptions':
                await this.handleListSubscriptions(connection, message);
                break;
            default:
                this.sendError(connection, `Unknown subscription method: ${method}`, 4006);
        }
    }
    async handleSubscribe(connection, message, params) {
        const { event_types, filters } = params;
        if (!event_types || !Array.isArray(event_types)) {
            this.sendError(connection, 'event_types must be an array', 4007);
            return;
        }
        const hasPermission = await this.validateSubscriptionPermissions(connection, event_types, filters);
        if (!hasPermission) {
            this.sendError(connection, 'Insufficient permissions for subscription', 4008);
            return;
        }
        event_types.forEach((eventType) => {
            connection.subscriptions.add(eventType);
            if (!this.subscriptions.has(eventType)) {
                this.subscriptions.set(eventType, new Set());
            }
            this.subscriptions.get(eventType).add(connection.id);
        });
        this.sendMessage(connection, {
            type: 'response',
            id: message.id,
            result: {
                subscribed: event_types,
                filters: filters || {},
                timestamp: new Date().toISOString()
            }
        });
        this.logger.info('WebSocket subscriptions added', {
            connection_id: connection.id,
            event_types,
            total_subscriptions: connection.subscriptions.size
        });
    }
    async handleUnsubscribe(connection, message, params) {
        const { event_types } = params;
        if (!event_types || !Array.isArray(event_types)) {
            this.sendError(connection, 'event_types must be an array', 4007);
            return;
        }
        event_types.forEach((eventType) => {
            connection.subscriptions.delete(eventType);
            if (this.subscriptions.has(eventType)) {
                this.subscriptions.get(eventType).delete(connection.id);
                if (this.subscriptions.get(eventType).size === 0) {
                    this.subscriptions.delete(eventType);
                }
            }
        });
        this.sendMessage(connection, {
            type: 'response',
            id: message.id,
            result: {
                unsubscribed: event_types,
                remaining_subscriptions: Array.from(connection.subscriptions),
                timestamp: new Date().toISOString()
            }
        });
    }
    async handleListSubscriptions(connection, message) {
        this.sendMessage(connection, {
            type: 'response',
            id: message.id,
            result: {
                subscriptions: Array.from(connection.subscriptions),
                connection_id: connection.id,
                connected_at: connection.metadata.connectedAt,
                last_activity: connection.metadata.lastActivity
            }
        });
    }
    async broadcastEvent(eventType, data, filters) {
        const connectionIds = this.subscriptions.get(eventType);
        if (!connectionIds || connectionIds.size === 0) {
            return;
        }
        const message = {
            type: 'notification',
            method: eventType,
            params: {
                ...data,
                timestamp: new Date().toISOString(),
                event_type: eventType
            }
        };
        let broadcastCount = 0;
        for (const connectionId of connectionIds) {
            const connection = this.connections.get(connectionId);
            if (!connection) {
                connectionIds.delete(connectionId);
                continue;
            }
            if (filters && !this.matchesFilter(connection, filters)) {
                continue;
            }
            this.sendMessage(connection, message);
            broadcastCount++;
        }
        this.logger.debug('Event broadcasted', {
            event_type: eventType,
            connections_notified: broadcastCount,
            total_subscribers: connectionIds.size
        });
    }
    sendMessage(connection, message) {
        if (connection.ws.readyState === ws_1.default.OPEN) {
            try {
                connection.ws.send(JSON.stringify(message));
            }
            catch (error) {
                this.logger.error('Failed to send WebSocket message:', error);
            }
        }
    }
    sendError(connection, message, code) {
        this.sendMessage(connection, {
            type: 'response',
            error: {
                code,
                message
            }
        });
    }
    handleConnectionClose(connection, code, reason) {
        this.connections.delete(connection.id);
        connection.subscriptions.forEach(eventType => {
            const connectionIds = this.subscriptions.get(eventType);
            if (connectionIds) {
                connectionIds.delete(connection.id);
                if (connectionIds.size === 0) {
                    this.subscriptions.delete(eventType);
                }
            }
        });
        this.logger.info('WebSocket connection closed', {
            connection_id: connection.id,
            code,
            reason,
            duration_ms: Date.now() - connection.metadata.connectedAt.getTime()
        });
        this.emit('connection:closed', connection, code, reason);
    }
    async authenticateConnection(request) {
        try {
            const url = new URL(request.url, `http://${request.headers.host}`);
            const token = url.searchParams.get('token') ||
                request.headers.authorization?.replace('Bearer ', '');
            if (!token) {
                return { success: false };
            }
            const decoded = jwt.verify(token, this.jwtSecret);
            return {
                success: true,
                organizationId: decoded.organization_id,
                userId: decoded.user_id,
                clientInfo: decoded.client_info
            };
        }
        catch (error) {
            this.logger.warn('WebSocket authentication failed:', error);
            return { success: false };
        }
    }
    async validateSubscriptionPermissions(connection, eventTypes, filters) {
        for (const eventType of eventTypes) {
            if (eventType.startsWith('admin/') && !await this.isAdminUser(connection.userId)) {
                return false;
            }
            if (eventType.startsWith('system/') && !await this.isSystemUser(connection.userId)) {
                return false;
            }
        }
        return true;
    }
    async isAdminUser(userId) {
        try {
            const query = 'SELECT role FROM users WHERE id = $1';
            const result = await this.db.query(query, [userId]);
            return result.rows[0]?.role === 'admin';
        }
        catch {
            return false;
        }
    }
    async isSystemUser(userId) {
        try {
            const query = 'SELECT role FROM users WHERE id = $1';
            const result = await this.db.query(query, [userId]);
            return ['admin', 'system'].includes(result.rows[0]?.role);
        }
        catch {
            return false;
        }
    }
    matchesFilter(connection, filter) {
        if (filter.organizations && !filter.organizations.includes(connection.organizationId)) {
            return false;
        }
        if (filter.users && !filter.users.includes(connection.userId)) {
            return false;
        }
        return true;
    }
    isLegacyRequest(request) {
        return !request.jsonrpc || request.jsonrpc !== '2.0';
    }
    generateConnectionId() {
        return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    cleanupStaleConnections() {
        const now = Date.now();
        const staleThreshold = 5 * 60 * 1000;
        for (const [connectionId, connection] of this.connections) {
            const lastActivity = connection.metadata.lastActivity.getTime();
            if (now - lastActivity > staleThreshold) {
                if (connection.ws.readyState === ws_1.default.OPEN) {
                    connection.ws.ping();
                    setTimeout(() => {
                        if (now - connection.metadata.lastActivity.getTime() > staleThreshold) {
                            connection.ws.terminate();
                        }
                    }, 30000);
                }
                else {
                    this.handleConnectionClose(connection, 1006, 'Connection stale');
                }
            }
        }
    }
    getConnectionStats() {
        const stats = {
            total_connections: this.connections.size,
            total_subscriptions: this.subscriptions.size,
            connections_by_organization: new Map(),
            subscription_stats: new Map()
        };
        for (const connection of this.connections.values()) {
            const orgCount = stats.connections_by_organization.get(connection.organizationId) || 0;
            stats.connections_by_organization.set(connection.organizationId, orgCount + 1);
        }
        for (const [eventType, connectionIds] of this.subscriptions) {
            stats.subscription_stats.set(eventType, connectionIds.size);
        }
        return {
            ...stats,
            connections_by_organization: Object.fromEntries(stats.connections_by_organization),
            subscription_stats: Object.fromEntries(stats.subscription_stats)
        };
    }
    async shutdown() {
        clearInterval(this.heartbeatInterval);
        for (const connection of this.connections.values()) {
            connection.ws.close(1001, 'Server shutdown');
        }
        this.connections.clear();
        this.subscriptions.clear();
        this.logger.info('WebSocket service shutdown complete');
    }
}
exports.WebSocketService = WebSocketService;
//# sourceMappingURL=websocket.service.js.map