"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketManager = void 0;
exports.createWebSocketRoutes = createWebSocketRoutes;
exports.createWebSocketMiddleware = createWebSocketMiddleware;
exports.setupWebSocketIntegration = setupWebSocketIntegration;
const ws_1 = require("ws");
const websocket_service_1 = require("../services/websocket.service");
class WebSocketManager {
    httpServer;
    db;
    logger;
    config;
    wsServer;
    wsService;
    connectionCount = 0;
    constructor(httpServer, db, logger, config) {
        this.httpServer = httpServer;
        this.db = db;
        this.logger = logger;
        this.config = config;
        this.wsService = new websocket_service_1.WebSocketService(db, logger, config.jwtSecret);
        this.initializeWebSocketServer();
        this.setupEventHandlers();
    }
    initializeWebSocketServer() {
        this.wsServer = new ws_1.WebSocketServer({
            server: this.httpServer,
            path: this.config.path || '/ws',
            maxPayload: 1024 * 1024,
            perMessageDeflate: {
                threshold: 1024,
                concurrencyLimit: 10,
                memLevel: 8
            }
        });
        this.logger.info('WebSocket server initialized', {
            path: this.config.path || '/ws',
            max_connections: this.config.maxConnections || 'unlimited'
        });
    }
    setupEventHandlers() {
        this.wsServer.on('connection', async (ws, request) => {
            try {
                if (this.config.maxConnections && this.connectionCount >= this.config.maxConnections) {
                    ws.close(4009, 'Connection limit reached');
                    return;
                }
                this.connectionCount++;
                const clientIp = request.socket.remoteAddress;
                const userAgent = request.headers['user-agent'];
                this.logger.info('New WebSocket connection attempt', {
                    client_ip: clientIp,
                    user_agent: userAgent,
                    current_connections: this.connectionCount
                });
                await this.wsService.handleConnection(ws, request);
                ws.on('close', () => {
                    this.connectionCount--;
                });
            }
            catch (error) {
                this.logger.error('WebSocket connection setup failed:', error);
                ws.close(4000, 'Connection setup failed');
                this.connectionCount--;
            }
        });
        this.wsServer.on('error', (error) => {
            this.logger.error('WebSocket server error:', error);
        });
        this.wsService.on('connection:established', (connection) => {
            this.logger.info('WebSocket connection established', {
                connection_id: connection.id,
                organization_id: connection.organizationId
            });
        });
        this.wsService.on('connection:closed', (connection, code, reason) => {
            this.logger.info('WebSocket connection closed', {
                connection_id: connection.id,
                code,
                reason
            });
        });
    }
    async broadcastMetricsUpdate(organizationId, metricsData) {
        await this.wsService.broadcastEvent('metrics/updated', {
            organization_id: organizationId,
            metrics: metricsData
        });
    }
    async broadcastDashboardUpdate(organizationId, dashboardData) {
        await this.wsService.broadcastEvent('dashboard/updated', {
            organization_id: organizationId,
            dashboard: dashboardData
        }, {
            organizations: [organizationId]
        });
    }
    async broadcastProductivityAlert(organizationId, alertData) {
        await this.wsService.broadcastEvent('productivity/alert', {
            organization_id: organizationId,
            alert: alertData,
            severity: alertData.severity || 'medium'
        }, {
            organizations: [organizationId]
        });
    }
    async broadcastAgentEvent(organizationId, agentData) {
        await this.wsService.broadcastEvent('agent/executed', {
            organization_id: organizationId,
            agent: agentData.agent_name,
            task: agentData.task,
            duration_ms: agentData.execution_time_ms,
            success: agentData.success
        }, {
            organizations: [organizationId]
        });
    }
    getStats() {
        return {
            server_stats: {
                total_connections: this.connectionCount,
                max_connections: this.config.maxConnections || 'unlimited',
                server_path: this.config.path || '/ws'
            },
            connection_stats: this.wsService.getConnectionStats()
        };
    }
    async shutdown() {
        this.logger.info('Shutting down WebSocket server...');
        await this.wsService.shutdown();
        return new Promise((resolve) => {
            this.wsServer.close(() => {
                this.logger.info('WebSocket server shutdown complete');
                resolve();
            });
        });
    }
}
exports.WebSocketManager = WebSocketManager;
function createWebSocketRoutes(wsManager, logger) {
    const { Router } = require('express');
    const router = Router();
    router.get('/stats', (req, res) => {
        try {
            const stats = wsManager.getStats();
            res.json({
                ...stats,
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            logger.error('Error getting WebSocket stats:', error);
            res.status(500).json({
                error: 'Failed to retrieve WebSocket statistics'
            });
        }
    });
    router.post('/broadcast', async (req, res) => {
        try {
            const { event_type, data, organization_id } = req.body;
            if (!event_type || !data) {
                return res.status(400).json({
                    error: 'event_type and data are required'
                });
            }
            await wsManager.wsService.broadcastEvent(event_type, data, {
                organizations: organization_id ? [organization_id] : undefined
            });
            res.json({
                success: true,
                message: `Event ${event_type} broadcasted successfully`,
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            logger.error('Error broadcasting WebSocket message:', error);
            res.status(500).json({
                error: 'Failed to broadcast message'
            });
        }
    });
    router.get('/health', (req, res) => {
        try {
            const stats = wsManager.getStats();
            res.json({
                status: 'healthy',
                service: 'websocket-service',
                connections: stats.server_stats.total_connections,
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            logger.error('WebSocket health check failed:', error);
            res.status(503).json({
                status: 'unhealthy',
                service: 'websocket-service',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });
    return router;
}
function createWebSocketMiddleware(wsManager) {
    return {
        broadcastMetricsMiddleware: (req, res, next) => {
            const originalJson = res.json;
            res.json = function (data) {
                originalJson.call(this, data);
                if (req.path?.includes('/metrics') && req.method === 'POST' && res.statusCode === 200) {
                    wsManager.broadcastMetricsUpdate(req.user?.organization_id, data).catch(err => {
                        console.warn('Failed to broadcast metrics update:', err);
                    });
                }
            };
            next();
        },
        broadcastDashboardMiddleware: (req, res, next) => {
            const originalJson = res.json;
            res.json = function (data) {
                originalJson.call(this, data);
                if (req.path?.includes('/dashboard') && req.method === 'GET' && res.statusCode === 200) {
                    wsManager.broadcastDashboardUpdate(req.user?.organization_id, data).catch(err => {
                        console.warn('Failed to broadcast dashboard update:', err);
                    });
                }
            };
            next();
        }
    };
}
function setupWebSocketIntegration(httpServer, db, logger, config) {
    const wsManager = new WebSocketManager(httpServer, db, logger, config);
    const wsRoutes = createWebSocketRoutes(wsManager, logger);
    const wsMiddleware = createWebSocketMiddleware(wsManager);
    logger.info('WebSocket integration setup complete');
    return {
        wsManager,
        wsRoutes,
        wsMiddleware
    };
}
//# sourceMappingURL=websocket.routes.js.map