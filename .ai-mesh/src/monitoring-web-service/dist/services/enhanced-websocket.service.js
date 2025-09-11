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
exports.EnhancedWebSocketService = void 0;
const socket_io_1 = require("socket.io");
const redis_adapter_1 = require("@socket.io/redis-adapter");
const jwt = __importStar(require("jsonwebtoken"));
const events_1 = __importDefault(require("events"));
class EnhancedWebSocketService extends events_1.default {
    httpServer;
    redisManager;
    db;
    logger;
    jwtSecret;
    config;
    io;
    connections = new Map();
    organizationRooms = new Map();
    dashboardSessions = new Map();
    heartbeatInterval;
    performanceMetrics;
    messageQueue = [];
    batchProcessingInterval;
    constructor(httpServer, redisManager, db, logger, jwtSecret, config = {}) {
        super();
        this.httpServer = httpServer;
        this.redisManager = redisManager;
        this.db = db;
        this.logger = logger;
        this.jwtSecret = jwtSecret;
        this.config = config;
        this.initializeSocketIO();
        this.setupRedisAdapter();
        this.setupEventHandlers();
        this.startBackgroundServices();
        this.performanceMetrics = {
            totalConnections: 0,
            connectionsPerOrganization: new Map(),
            messagesPerSecond: 0,
            avgResponseTime: 0,
            errorRate: 0,
            memoryUsage: 0,
            uptime: Date.now()
        };
        this.logger.info('Enhanced WebSocket Service initialized', {
            cors: !!this.config.cors,
            maxConnections: this.config.maxConnections || 'unlimited',
            batchInterval: this.config.batchInterval || 100,
            heartbeatInterval: this.config.heartbeatInterval || 30000
        });
    }
    initializeSocketIO() {
        this.io = new socket_io_1.Server(this.httpServer, {
            cors: this.config.cors || {
                origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
                methods: ['GET', 'POST'],
                credentials: true
            },
            transports: ['websocket', 'polling'],
            pingTimeout: 60000,
            pingInterval: 25000,
            upgradeTimeout: 30000,
            maxHttpBufferSize: 1024 * 1024,
            allowEIO3: false,
            cookie: {
                name: 'fortium-socket',
                httpOnly: true,
                sameSite: 'strict'
            }
        });
    }
    setupRedisAdapter() {
        try {
            const pubClient = this.redisManager.getPublisher();
            const subClient = this.redisManager.getSubscriber();
            this.io.adapter((0, redis_adapter_1.createAdapter)(pubClient, subClient));
            this.logger.info('Redis adapter configured for WebSocket scaling');
        }
        catch (error) {
            this.logger.error('Failed to setup Redis adapter:', error);
            throw new Error('Redis adapter configuration failed');
        }
    }
    setupEventHandlers() {
        this.io.use(async (socket, next) => {
            try {
                const auth = await this.authenticateSocket(socket);
                if (!auth.success) {
                    return next(new Error('Authentication failed'));
                }
                socket.data = {
                    organizationId: auth.organizationId,
                    userId: auth.userId,
                    userRole: auth.userRole,
                    userName: auth.userName
                };
                next();
            }
            catch (error) {
                next(new Error('Authentication error'));
            }
        });
        this.io.on('connection', async (socket) => {
            await this.handleNewConnection(socket);
        });
        this.io.on('connect_error', (error) => {
            this.logger.error('Socket.io connection error:', error);
            this.performanceMetrics.errorRate++;
        });
    }
    async handleNewConnection(socket) {
        try {
            if (this.config.maxConnections && this.connections.size >= this.config.maxConnections) {
                socket.emit('error', { code: 'CONNECTION_LIMIT', message: 'Maximum connections reached' });
                socket.disconnect();
                return;
            }
            const { organizationId, userId, userRole, userName } = socket.data;
            const connection = {
                id: socket.id,
                socket,
                organizationId,
                userId,
                userRole,
                rooms: new Set(),
                metadata: {
                    connectedAt: new Date(),
                    lastActivity: new Date(),
                    clientInfo: socket.handshake.auth,
                    ipAddress: socket.handshake.address,
                    userAgent: socket.handshake.headers['user-agent'],
                    connectionCount: 1
                },
                messageBuffer: [],
                batchTimeout: undefined
            };
            this.connections.set(socket.id, connection);
            this.updateOrganizationConnections(organizationId, 1);
            this.performanceMetrics.totalConnections++;
            await this.joinOrganizationRoom(connection);
            this.setupSocketHandlers(connection);
            socket.emit('connected', {
                connectionId: socket.id,
                organizationId,
                userId,
                serverCapabilities: {
                    realTimeUpdates: true,
                    collaborativeFeatures: true,
                    messageBatching: true,
                    dashboardSync: true
                },
                connectedAt: connection.metadata.connectedAt
            });
            this.broadcastToOrganization(organizationId, 'user_joined', {
                userId,
                userName,
                joinedAt: new Date(),
                connectionId: socket.id
            });
            this.logger.info('Enhanced WebSocket connection established', {
                connectionId: socket.id,
                organizationId,
                userId,
                totalConnections: this.connections.size
            });
            this.emit('connection:established', connection);
        }
        catch (error) {
            this.logger.error('Failed to handle new WebSocket connection:', error);
            socket.disconnect();
        }
    }
    setupSocketHandlers(connection) {
        const { socket } = connection;
        socket.on('join_room', async (data) => {
            await this.handleJoinRoom(connection, data);
        });
        socket.on('leave_room', async (data) => {
            await this.handleLeaveRoom(connection, data);
        });
        socket.on('subscribe_dashboard', async (data) => {
            await this.handleDashboardSubscription(connection, data);
        });
        socket.on('unsubscribe_dashboard', async (data) => {
            await this.handleDashboardUnsubscription(connection, data);
        });
        socket.on('collaborative_event', async (data) => {
            await this.handleCollaborativeEvent(connection, data);
        });
        socket.on('subscribe_metrics', async (data) => {
            await this.handleMetricsSubscription(connection, data);
        });
        socket.on('ping', () => {
            connection.metadata.lastActivity = new Date();
            socket.emit('pong', { timestamp: Date.now() });
        });
        socket.on('disconnect', (reason) => {
            this.handleDisconnection(connection, reason);
        });
        socket.on('error', (error) => {
            this.logger.error('Socket error:', error, {
                connectionId: connection.id,
                organizationId: connection.organizationId
            });
        });
    }
    async handleJoinRoom(connection, data) {
        try {
            const { room, permissions } = data;
            const hasAccess = await this.validateRoomAccess(connection, room, permissions);
            if (!hasAccess) {
                connection.socket.emit('room_error', {
                    room,
                    error: 'Access denied',
                    code: 'PERMISSION_DENIED'
                });
                return;
            }
            await connection.socket.join(room);
            connection.rooms.add(room);
            if (room.startsWith('dashboard:')) {
                const dashboardId = room.split(':')[1];
                if (!this.dashboardSessions.has(dashboardId)) {
                    this.dashboardSessions.set(dashboardId, new Set());
                }
                this.dashboardSessions.get(dashboardId).add(connection.id);
            }
            connection.socket.emit('room_joined', {
                room,
                joinedAt: new Date(),
                activeUsers: await this.getRoomActiveUsers(room)
            });
            this.logger.debug('User joined room', {
                connectionId: connection.id,
                room,
                totalRooms: connection.rooms.size
            });
        }
        catch (error) {
            this.logger.error('Failed to handle room join:', error);
            connection.socket.emit('room_error', {
                room: data.room,
                error: 'Failed to join room',
                code: 'JOIN_FAILED'
            });
        }
    }
    async handleLeaveRoom(connection, data) {
        try {
            const { room } = data;
            await connection.socket.leave(room);
            connection.rooms.delete(room);
            if (room.startsWith('dashboard:')) {
                const dashboardId = room.split(':')[1];
                this.dashboardSessions.get(dashboardId)?.delete(connection.id);
                if (this.dashboardSessions.get(dashboardId)?.size === 0) {
                    this.dashboardSessions.delete(dashboardId);
                }
            }
            connection.socket.emit('room_left', {
                room,
                leftAt: new Date()
            });
        }
        catch (error) {
            this.logger.error('Failed to handle room leave:', error);
        }
    }
    async handleDashboardSubscription(connection, data) {
        try {
            const { dashboardId } = data;
            const roomName = `dashboard:${dashboardId}`;
            const hasAccess = await this.validateDashboardAccess(connection, dashboardId);
            if (!hasAccess) {
                connection.socket.emit('subscription_error', {
                    dashboardId,
                    error: 'Dashboard access denied',
                    code: 'DASHBOARD_ACCESS_DENIED'
                });
                return;
            }
            await connection.socket.join(roomName);
            connection.rooms.add(roomName);
            if (!this.dashboardSessions.has(dashboardId)) {
                this.dashboardSessions.set(dashboardId, new Set());
            }
            this.dashboardSessions.get(dashboardId).add(connection.id);
            const currentState = await this.getDashboardCurrentState(dashboardId);
            connection.socket.emit('dashboard_subscribed', {
                dashboardId,
                currentState,
                subscribedAt: new Date(),
                activeViewers: this.dashboardSessions.get(dashboardId).size
            });
            connection.socket.to(roomName).emit('viewer_joined', {
                userId: connection.userId,
                joinedAt: new Date()
            });
        }
        catch (error) {
            this.logger.error('Failed to handle dashboard subscription:', error);
        }
    }
    async handleDashboardUnsubscription(connection, data) {
        try {
            const { dashboardId } = data;
            const roomName = `dashboard:${dashboardId}`;
            await connection.socket.leave(roomName);
            connection.rooms.delete(roomName);
            this.dashboardSessions.get(dashboardId)?.delete(connection.id);
            if (this.dashboardSessions.get(dashboardId)?.size === 0) {
                this.dashboardSessions.delete(dashboardId);
            }
            connection.socket.to(roomName).emit('viewer_left', {
                userId: connection.userId,
                leftAt: new Date()
            });
            connection.socket.emit('dashboard_unsubscribed', {
                dashboardId,
                unsubscribedAt: new Date()
            });
        }
        catch (error) {
            this.logger.error('Failed to handle dashboard unsubscription:', error);
        }
    }
    async handleCollaborativeEvent(connection, event) {
        try {
            if (connection.userRole !== 'admin' && connection.userRole !== 'manager') {
                connection.socket.emit('collaborative_error', {
                    error: 'Insufficient permissions for collaborative features',
                    code: 'COLLABORATIVE_ACCESS_DENIED'
                });
                return;
            }
            const enrichedEvent = {
                ...event,
                userId: connection.userId,
                userName: connection.socket.data.userName,
                organizationId: connection.organizationId,
                timestamp: new Date()
            };
            if (event.dashboardId) {
                const roomName = `dashboard:${event.dashboardId}`;
                connection.socket.to(roomName).emit('collaborative_event', enrichedEvent);
            }
            else {
                const orgRoom = `org:${connection.organizationId}`;
                connection.socket.to(orgRoom).emit('collaborative_event', enrichedEvent);
            }
            await this.storeCollaborativeEvent(enrichedEvent);
        }
        catch (error) {
            this.logger.error('Failed to handle collaborative event:', error);
        }
    }
    async handleMetricsSubscription(connection, data) {
        try {
            const { types, filters } = data;
            const hasAccess = await this.validateMetricsAccess(connection, types);
            if (!hasAccess) {
                connection.socket.emit('subscription_error', {
                    error: 'Metrics access denied',
                    code: 'METRICS_ACCESS_DENIED'
                });
                return;
            }
            for (const metricType of types) {
                const roomName = `metrics:${connection.organizationId}:${metricType}`;
                await connection.socket.join(roomName);
                connection.rooms.add(roomName);
            }
            connection.socket.emit('metrics_subscribed', {
                types,
                filters,
                subscribedAt: new Date()
            });
        }
        catch (error) {
            this.logger.error('Failed to handle metrics subscription:', error);
        }
    }
    async broadcastToOrganization(organizationId, eventName, data) {
        try {
            const roomName = `org:${organizationId}`;
            const message = {
                type: 'real_time_update',
                eventName,
                data: {
                    ...data,
                    organizationId,
                    timestamp: new Date()
                },
                timestamp: new Date(),
                organizationId,
                priority: 'medium',
                batchable: true
            };
            this.io.to(roomName).emit(eventName, message.data);
            await this.logBroadcastEvent(message);
        }
        catch (error) {
            this.logger.error('Failed to broadcast to organization:', error);
        }
    }
    async broadcastDashboardUpdate(dashboardId, updateData, options) {
        try {
            const roomName = `dashboard:${dashboardId}`;
            const message = {
                type: 'dashboard_update',
                eventName: 'dashboard_update',
                data: {
                    dashboardId,
                    update: updateData,
                    timestamp: new Date()
                },
                timestamp: new Date(),
                organizationId: '',
                priority: options?.priority || 'medium',
                batchable: options?.batchable !== false
            };
            if (message.batchable && message.priority !== 'critical') {
                this.messageQueue.push(message);
            }
            else {
                this.io.to(roomName).emit('dashboard_update', message.data);
            }
        }
        catch (error) {
            this.logger.error('Failed to broadcast dashboard update:', error);
        }
    }
    async broadcastMetricsUpdate(organizationId, metricType, metricsData) {
        try {
            const roomName = `metrics:${organizationId}:${metricType}`;
            const message = {
                type: 'metrics_update',
                metricType,
                data: metricsData,
                organizationId,
                timestamp: new Date()
            };
            this.io.to(roomName).emit('metrics_update', message);
            this.performanceMetrics.messagesPerSecond++;
        }
        catch (error) {
            this.logger.error('Failed to broadcast metrics update:', error);
        }
    }
    async joinOrganizationRoom(connection) {
        const orgRoom = `org:${connection.organizationId}`;
        await connection.socket.join(orgRoom);
        connection.rooms.add(orgRoom);
        if (!this.organizationRooms.has(connection.organizationId)) {
            this.organizationRooms.set(connection.organizationId, new Set());
        }
        this.organizationRooms.get(connection.organizationId).add(connection.id);
    }
    handleDisconnection(connection, reason) {
        try {
            this.connections.delete(connection.id);
            this.updateOrganizationConnections(connection.organizationId, -1);
            this.performanceMetrics.totalConnections--;
            this.organizationRooms.get(connection.organizationId)?.delete(connection.id);
            for (const [dashboardId, connectionIds] of this.dashboardSessions.entries()) {
                if (connectionIds.has(connection.id)) {
                    connectionIds.delete(connection.id);
                    connection.socket.to(`dashboard:${dashboardId}`).emit('viewer_left', {
                        userId: connection.userId,
                        leftAt: new Date()
                    });
                    if (connectionIds.size === 0) {
                        this.dashboardSessions.delete(dashboardId);
                    }
                }
            }
            if (connection.batchTimeout) {
                clearTimeout(connection.batchTimeout);
            }
            this.broadcastToOrganization(connection.organizationId, 'user_left', {
                userId: connection.userId,
                leftAt: new Date(),
                connectionDuration: Date.now() - connection.metadata.connectedAt.getTime(),
                reason
            });
            this.logger.info('Enhanced WebSocket connection closed', {
                connectionId: connection.id,
                organizationId: connection.organizationId,
                userId: connection.userId,
                reason,
                connectionDuration: Date.now() - connection.metadata.connectedAt.getTime(),
                totalConnections: this.connections.size
            });
            this.emit('connection:closed', connection, reason);
        }
        catch (error) {
            this.logger.error('Error handling disconnection:', error);
        }
    }
    startBackgroundServices() {
        this.heartbeatInterval = setInterval(() => {
            this.performHeartbeat();
        }, this.config.heartbeatInterval || 30000);
        this.batchProcessingInterval = setInterval(() => {
            this.processBatchedMessages();
        }, this.config.batchInterval || 100);
        setInterval(() => {
            this.updatePerformanceMetrics();
        }, this.config.performanceMonitoringInterval || 60000);
    }
    performHeartbeat() {
        const now = Date.now();
        const staleThreshold = 5 * 60 * 1000;
        for (const [connectionId, connection] of this.connections) {
            const lastActivity = connection.metadata.lastActivity.getTime();
            if (now - lastActivity > staleThreshold) {
                this.logger.warn('Stale connection detected, sending ping', {
                    connectionId,
                    lastActivity: connection.metadata.lastActivity
                });
                connection.socket.emit('ping', { timestamp: now });
                setTimeout(() => {
                    const currentLastActivity = connection.metadata.lastActivity.getTime();
                    if (currentLastActivity === lastActivity) {
                        connection.socket.disconnect(true);
                    }
                }, 30000);
            }
        }
    }
    processBatchedMessages() {
        if (this.messageQueue.length === 0)
            return;
        const messagesByRoom = new Map();
        const messagesToProcess = this.messageQueue.splice(0);
        for (const message of messagesToProcess) {
            let roomName = '';
            if (message.type === 'dashboard_update' && message.data.dashboardId) {
                roomName = `dashboard:${message.data.dashboardId}`;
            }
            else if (message.organizationId) {
                roomName = `org:${message.organizationId}`;
            }
            if (roomName) {
                if (!messagesByRoom.has(roomName)) {
                    messagesByRoom.set(roomName, []);
                }
                messagesByRoom.get(roomName).push(message);
            }
        }
        for (const [roomName, messages] of messagesByRoom) {
            if (messages.length === 1) {
                const msg = messages[0];
                this.io.to(roomName).emit(msg.eventName, msg.data);
            }
            else {
                this.io.to(roomName).emit('batch_update', {
                    messages: messages.map(m => ({ event: m.eventName, data: m.data })),
                    batchSize: messages.length,
                    timestamp: new Date()
                });
            }
        }
    }
    updatePerformanceMetrics() {
        this.performanceMetrics.memoryUsage = process.memoryUsage().heapUsed;
        this.performanceMetrics.connectionsPerOrganization.clear();
        for (const connection of this.connections.values()) {
            const count = this.performanceMetrics.connectionsPerOrganization.get(connection.organizationId) || 0;
            this.performanceMetrics.connectionsPerOrganization.set(connection.organizationId, count + 1);
        }
        this.performanceMetrics.messagesPerSecond = 0;
        this.performanceMetrics.errorRate = 0;
    }
    async authenticateSocket(socket) {
        try {
            const token = socket.handshake.auth.token || socket.handshake.query.token;
            if (!token) {
                return { success: false };
            }
            const decoded = jwt.verify(token, this.jwtSecret);
            const userQuery = `
        SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.is_active,
               t.id as org_id, t.name as org_name
        FROM users u
        JOIN tenants t ON u.organization_id = t.id
        WHERE u.id = $1 AND u.is_active = true AND t.is_active = true
      `;
            const result = await this.db.query(userQuery, [decoded.user_id]);
            if (result.rows.length === 0) {
                return { success: false };
            }
            const user = result.rows[0];
            return {
                success: true,
                organizationId: user.org_id,
                userId: user.id,
                userRole: user.role,
                userName: `${user.first_name} ${user.last_name}`
            };
        }
        catch (error) {
            this.logger.warn('Socket authentication failed:', error);
            return { success: false };
        }
    }
    async validateRoomAccess(connection, room, permissions) {
        if (room.startsWith('org:')) {
            const orgId = room.split(':')[1];
            return orgId === connection.organizationId;
        }
        if (room.startsWith('dashboard:')) {
            const dashboardId = room.split(':')[1];
            return await this.validateDashboardAccess(connection, dashboardId);
        }
        return true;
    }
    async validateDashboardAccess(connection, dashboardId) {
        return true;
    }
    async validateMetricsAccess(connection, types) {
        if (connection.userRole === 'admin')
            return true;
        return true;
    }
    updateOrganizationConnections(organizationId, delta) {
        const current = this.performanceMetrics.connectionsPerOrganization.get(organizationId) || 0;
        this.performanceMetrics.connectionsPerOrganization.set(organizationId, Math.max(0, current + delta));
    }
    async getRoomActiveUsers(room) {
        try {
            const sockets = await this.io.in(room).fetchSockets();
            return sockets.map(s => s.data.userId).filter(Boolean);
        }
        catch {
            return [];
        }
    }
    async getDashboardCurrentState(dashboardId) {
        try {
            return await this.redisManager.getCachedMetrics(`dashboard:${dashboardId}:state`);
        }
        catch {
            return null;
        }
    }
    async storeCollaborativeEvent(event) {
        try {
            const key = `collaborative:${event.organizationId}:${event.dashboardId || 'global'}`;
            await this.redisManager.cacheMetrics(key, event, 300);
        }
        catch (error) {
            this.logger.error('Failed to store collaborative event:', error);
        }
    }
    async logBroadcastEvent(message) {
        this.logger.debug('Message broadcasted', {
            type: message.type,
            eventName: message.eventName,
            organizationId: message.organizationId,
            priority: message.priority,
            timestamp: message.timestamp
        });
    }
    getPerformanceMetrics() {
        return {
            ...this.performanceMetrics,
            uptime: Date.now() - this.performanceMetrics.uptime
        };
    }
    getConnectionStats() {
        return {
            totalConnections: this.connections.size,
            connectionsByOrganization: Object.fromEntries(this.performanceMetrics.connectionsPerOrganization),
            activeDashboardSessions: this.dashboardSessions.size,
            totalRooms: this.io.sockets.adapter.rooms.size,
            messageQueueSize: this.messageQueue.length
        };
    }
    async shutdown() {
        this.logger.info('Shutting down Enhanced WebSocket Service...');
        if (this.heartbeatInterval)
            clearInterval(this.heartbeatInterval);
        if (this.batchProcessingInterval)
            clearInterval(this.batchProcessingInterval);
        this.processBatchedMessages();
        this.io.emit('server_shutdown', { message: 'Server shutting down', timestamp: new Date() });
        await new Promise(resolve => setTimeout(resolve, 1000));
        this.io.close();
        this.connections.clear();
        this.organizationRooms.clear();
        this.dashboardSessions.clear();
        this.messageQueue.length = 0;
        this.logger.info('Enhanced WebSocket Service shutdown complete');
    }
}
exports.EnhancedWebSocketService = EnhancedWebSocketService;
//# sourceMappingURL=enhanced-websocket.service.js.map