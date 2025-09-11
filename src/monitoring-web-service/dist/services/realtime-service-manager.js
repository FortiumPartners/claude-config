"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealTimeServiceManager = void 0;
const socket_io_1 = require("socket.io");
const redis_adapter_1 = require("@socket.io/redis-adapter");
const room_manager_1 = require("../websocket/room-manager");
const connection_pool_1 = require("../websocket/connection-pool");
const auth_middleware_1 = require("../websocket/auth-middleware");
const event_publisher_1 = require("../events/event-publisher");
const event_subscriber_1 = require("../events/event-subscriber");
const metrics_stream_1 = require("../streaming/metrics-stream");
const activity_feed_1 = require("../streaming/activity-feed");
const presence_manager_1 = require("../streaming/presence-manager");
const events_1 = __importDefault(require("events"));
class RealTimeServiceManager extends events_1.default {
    httpServer;
    redisManager;
    db;
    logger;
    config;
    io;
    roomManager;
    connectionPool;
    authMiddleware;
    eventPublisher;
    eventSubscriber;
    metricsStream;
    activityFeed;
    presenceManager;
    healthCheckInterval;
    metricsInterval;
    serviceHealth = new Map();
    isShuttingDown = false;
    constructor(httpServer, redisManager, db, logger, config) {
        super();
        this.httpServer = httpServer;
        this.redisManager = redisManager;
        this.db = db;
        this.logger = logger;
        this.config = config;
        this.initializeServices();
        this.startHealthMonitoring();
    }
    async initializeServices() {
        try {
            this.logger.info('Initializing Real-time Service Manager...');
            this.initializeSocketIO();
            this.roomManager = new room_manager_1.RoomManager(this.db, this.redisManager, this.logger, {
                cleanupInterval: 60000,
                maxRoomsPerUser: 50,
                roomTtl: 300000
            });
            this.connectionPool = new connection_pool_1.ConnectionPool(this.redisManager, this.logger, this.config.connectionPool);
            this.authMiddleware = new auth_middleware_1.WebSocketAuthMiddleware(this.db, this.redisManager, this.logger, this.config.auth);
            this.eventPublisher = new event_publisher_1.EventPublisher(this.redisManager, this.db, this.logger, this.config.events);
            this.eventSubscriber = new event_subscriber_1.EventSubscriber(this.io, this.redisManager, this.db, this.logger, {
                maxSubscriptionsPerUser: 100,
                subscriptionTtl: 3600,
                deliveryTimeout: 5000,
                historyRetention: 86400000,
                enableReplay: true,
                replayBufferSize: 100
            });
            this.metricsStream = new metrics_stream_1.MetricsStream(this.eventPublisher, this.redisManager, this.db, this.logger, this.config.streaming);
            this.activityFeed = new activity_feed_1.ActivityFeed(this.eventPublisher, this.redisManager, this.db, this.logger, this.config.activity);
            this.presenceManager = new presence_manager_1.PresenceManager(this.eventPublisher, this.redisManager, this.db, this.logger, this.config.presence);
            await this.setupSocketIOHandlers();
            this.logger.info('Real-time Service Manager initialized successfully');
            this.emit('services:initialized');
        }
        catch (error) {
            this.logger.error('Failed to initialize Real-time Service Manager:', error);
            throw error;
        }
    }
    initializeSocketIO() {
        this.io = new socket_io_1.Server(this.httpServer, {
            cors: this.config.server.cors || {
                origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
                methods: ['GET', 'POST'],
                credentials: true
            },
            transports: ['websocket', 'polling'],
            pingTimeout: 60000,
            pingInterval: 25000,
            upgradeTimeout: 30000,
            maxHttpBufferSize: 1024 * 1024,
            allowEIO3: false
        });
        try {
            const pubClient = this.redisManager.getPublisher();
            const subClient = this.redisManager.getSubscriber();
            this.io.adapter((0, redis_adapter_1.createAdapter)(pubClient, subClient));
            this.logger.info('Socket.io Redis adapter configured');
        }
        catch (error) {
            this.logger.error('Failed to setup Socket.io Redis adapter:', error);
            throw error;
        }
    }
    async setupSocketIOHandlers() {
        this.io.use(this.authMiddleware.authenticate());
        this.io.on('connection', async (socket) => {
            await this.handleNewConnection(socket);
        });
        this.io.on('connect_error', (error) => {
            this.logger.error('Socket.io connection error:', error);
        });
        this.logger.debug('Socket.io handlers configured');
    }
    async handleNewConnection(socket) {
        try {
            const { user } = socket;
            if (!user) {
                socket.disconnect();
                return;
            }
            this.logger.info('New WebSocket connection', {
                userId: user.id,
                organizationId: user.organizationId,
                socketId: socket.id
            });
            const poolResult = await this.connectionPool.addConnection(socket, user.id, user.organizationId, user.role);
            if (!poolResult.success) {
                socket.emit('error', { code: 'CONNECTION_REJECTED', message: poolResult.error });
                socket.disconnect();
                return;
            }
            await this.presenceManager.setUserOnline(user.id, `${user.firstName} ${user.lastName}`, user.organizationId, {
                socketId: socket.id,
                ipAddress: socket.handshake.address,
                userAgent: socket.handshake.headers['user-agent'] || 'unknown'
            });
            const orgRoom = await this.roomManager.getOrganizationRoom(user.organizationId);
            await this.roomManager.joinRoom(socket, orgRoom, user.id, user.role);
            this.setupSocketEventHandlers(socket);
            await this.activityFeed.trackDashboardActivity(user.organizationId, user.id, `${user.firstName} ${user.lastName}`, user.role, 'websocket', 'view', { action: 'connected', socketId: socket.id });
            socket.emit('connected', {
                connectionId: socket.id,
                userId: user.id,
                organizationId: user.organizationId,
                capabilities: {
                    realTimeMetrics: true,
                    collaboration: true,
                    presence: true,
                    activityFeed: true
                },
                timestamp: new Date()
            });
            this.emit('connection:established', socket);
        }
        catch (error) {
            this.logger.error('Failed to handle new connection:', error);
            socket.disconnect();
        }
    }
    setupSocketEventHandlers(socket) {
        const { user } = socket;
        socket.onAny(() => {
            this.presenceManager.updateUserActivity(socket.id);
        });
        socket.on('join_room', async (data) => {
            try {
                const result = await this.roomManager.joinRoom(socket, data.room, user.id, user.role);
                socket.emit('room_join_result', { success: result.success, error: result.error });
            }
            catch (error) {
                socket.emit('room_join_result', { success: false, error: 'Internal error' });
            }
        });
        socket.on('leave_room', async (data) => {
            await this.roomManager.leaveRoom(socket, data.room, user.id);
            socket.emit('room_left', { room: data.room });
        });
        socket.on('subscribe_events', async (data) => {
            const result = await this.eventSubscriber.subscribe(socket, data);
            socket.emit('subscription_result', result);
        });
        socket.on('subscribe_metrics', async (data) => {
            const result = await this.metricsStream.subscribeToMetric(user.organizationId, data.metricName, data.options);
            socket.emit('metrics_subscription_result', result);
        });
        socket.on('set_presence_status', async (data) => {
            const result = await this.presenceManager.setUserStatus(user.id, data.status, data.customMessage);
            socket.emit('presence_status_result', result);
        });
        socket.on('get_activity_feed', async (data) => {
            const feed = await this.activityFeed.getActivityFeed(user.organizationId, user.id, data);
            socket.emit('activity_feed', feed);
        });
        socket.on('collaborate_dashboard', async (data) => {
            await this.eventPublisher.publishCollaborativeEvent(user.organizationId, data.dashboardId, user.id, data.collaborativeData);
        });
        socket.on('publish_metric', async (data) => {
            await this.metricsStream.streamMetric({
                id: `metric_${Date.now()}`,
                type: data.type,
                organizationId: user.organizationId,
                userId: user.id,
                name: data.name,
                value: data.value,
                tags: data.tags || {},
                timestamp: new Date(),
                metadata: {
                    source: 'websocket',
                    collection_method: 'manual',
                    resolution: 1
                }
            });
        });
        socket.on('disconnect', async (reason) => {
            await this.handleDisconnection(socket, reason);
        });
        socket.on('error', (error) => {
            this.logger.error('Socket error:', error, {
                userId: user.id,
                socketId: socket.id
            });
        });
    }
    async handleDisconnection(socket, reason) {
        try {
            const { user } = socket;
            this.logger.info('WebSocket disconnection', {
                userId: user.id,
                socketId: socket.id,
                reason
            });
            await this.connectionPool.removeConnection(socket.id);
            await this.presenceManager.setUserOffline(socket.id, reason);
            await this.eventSubscriber.unsubscribe(socket.id);
            await this.authMiddleware.cleanupSession(socket);
            await this.activityFeed.trackDashboardActivity(user.organizationId, user.id, `${user.firstName} ${user.lastName}`, user.role, 'websocket', 'view', { action: 'disconnected', reason });
            this.emit('connection:closed', socket, reason);
        }
        catch (error) {
            this.logger.error('Error handling disconnection:', error);
        }
    }
    startHealthMonitoring() {
        this.healthCheckInterval = setInterval(() => {
            this.performHealthCheck();
        }, 60000);
        this.metricsInterval = setInterval(() => {
            this.collectMetrics();
        }, 30000);
    }
    async performHealthCheck() {
        const services = [
            { name: 'connection-pool', instance: this.connectionPool },
            { name: 'event-publisher', instance: this.eventPublisher },
            { name: 'event-subscriber', instance: this.eventSubscriber },
            { name: 'metrics-stream', instance: this.metricsStream },
            { name: 'activity-feed', instance: this.activityFeed },
            { name: 'presence-manager', instance: this.presenceManager }
        ];
        for (const service of services) {
            try {
                const health = {
                    service: service.name,
                    status: 'healthy',
                    lastCheck: new Date(),
                    metrics: service.instance.getMetrics?.() || null,
                    errors: []
                };
                this.serviceHealth.set(service.name, health);
            }
            catch (error) {
                const health = {
                    service: service.name,
                    status: 'unhealthy',
                    lastCheck: new Date(),
                    errors: [error instanceof Error ? error.message : 'Unknown error']
                };
                this.serviceHealth.set(service.name, health);
                this.logger.warn(`Service ${service.name} health check failed:`, error);
            }
        }
    }
    collectMetrics() {
        try {
            const connectionStats = this.connectionPool.getMetrics();
            const eventMetrics = this.eventPublisher.getMetrics();
            const streamingStats = this.metricsStream.getMetricStats();
            const metrics = {
                connections: {
                    total: connectionStats.totalConnections,
                    active: connectionStats.activeConnections,
                    byOrganization: Object.fromEntries(connectionStats.connectionsPerOrganization)
                },
                events: {
                    published: eventMetrics.totalPublished,
                    delivered: 0,
                    queued: eventMetrics.queueSize,
                    failed: 0
                },
                streaming: {
                    metricsActive: streamingStats.activeStreams,
                    bufferUtilization: streamingStats.bufferUtilization,
                    updateFrequency: streamingStats.averageUpdateFrequency
                },
                presence: {
                    onlineUsers: 0,
                    totalUsers: 0,
                    collaborationReadiness: 0
                },
                performance: {
                    memoryUsage: connectionStats.memoryUsage,
                    cpuUsage: 0,
                    responseTime: connectionStats.averageResponseTime,
                    errorRate: connectionStats.errorRate
                }
            };
            this.emit('metrics:updated', metrics);
        }
        catch (error) {
            this.logger.error('Failed to collect metrics:', error);
        }
    }
    getServiceHealth() {
        return Object.fromEntries(this.serviceHealth.entries());
    }
    async getOrganizationMetrics(organizationId) {
        const teamPresence = this.presenceManager.getTeamPresence(organizationId);
        const activityInsights = await this.activityFeed.getActivityInsights(organizationId);
        const realtimeMetrics = await this.metricsStream.getRealTimeMetrics(organizationId);
        return {
            presence: teamPresence,
            activity: activityInsights,
            metrics: realtimeMetrics,
            timestamp: new Date()
        };
    }
    async publishSystemAlert(organizationId, alertType, alertData, priority = 'high') {
        await this.eventPublisher.publishSystemAlert(organizationId, alertType, alertData, priority);
    }
    async shutdown() {
        if (this.isShuttingDown)
            return;
        this.isShuttingDown = true;
        this.logger.info('Shutting down Real-time Service Manager...');
        if (this.healthCheckInterval)
            clearInterval(this.healthCheckInterval);
        if (this.metricsInterval)
            clearInterval(this.metricsInterval);
        const shutdownPromises = [
            this.presenceManager?.shutdown(),
            this.activityFeed?.shutdown(),
            this.metricsStream?.shutdown(),
            this.eventSubscriber?.shutdown(),
            this.eventPublisher?.shutdown(),
            this.connectionPool?.shutdown(),
            this.roomManager?.shutdown()
        ].filter(Boolean);
        await Promise.allSettled(shutdownPromises);
        if (this.io) {
            this.io.emit('server_shutdown', {
                message: 'Server shutting down',
                timestamp: new Date()
            });
            await new Promise(resolve => setTimeout(resolve, 1000));
            this.io.close();
        }
        this.serviceHealth.clear();
        this.logger.info('Real-time Service Manager shutdown complete');
    }
}
exports.RealTimeServiceManager = RealTimeServiceManager;
//# sourceMappingURL=realtime-service-manager.js.map