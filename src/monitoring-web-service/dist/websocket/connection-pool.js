"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectionPool = void 0;
const events_1 = __importDefault(require("events"));
class ConnectionPool extends events_1.default {
    redisManager;
    logger;
    config;
    connections = new Map();
    connectionsByUser = new Map();
    connectionsByOrganization = new Map();
    pools = [];
    currentPoolIndex = 0;
    healthCheckInterval;
    performanceInterval;
    metrics;
    constructor(redisManager, logger, config) {
        super();
        this.redisManager = redisManager;
        this.logger = logger;
        this.config = config;
        this.initializePools();
        this.initializeMetrics();
        this.startBackgroundServices();
    }
    async addConnection(socket, userId, organizationId, userRole) {
        try {
            if (this.connections.size >= this.config.maxConnections) {
                return { success: false, error: 'Global connection limit reached' };
            }
            const userConnections = this.connectionsByUser.get(userId)?.size || 0;
            if (userConnections >= this.config.maxConnectionsPerUser) {
                return { success: false, error: 'User connection limit reached' };
            }
            const orgConnections = this.connectionsByOrganization.get(organizationId)?.size || 0;
            if (orgConnections >= this.config.maxConnectionsPerOrganization) {
                return { success: false, error: 'Organization connection limit reached' };
            }
            const poolIndex = this.selectOptimalPool();
            const pooledConnection = {
                id: socket.id,
                socket,
                userId,
                organizationId,
                userRole,
                createdAt: new Date(),
                lastActivity: new Date(),
                metadata: {
                    ipAddress: socket.handshake.address,
                    userAgent: socket.handshake.headers['user-agent'] || 'unknown',
                    connectionCount: 1,
                    bytesReceived: 0,
                    bytesSent: 0,
                    messagesReceived: 0,
                    messagesSent: 0,
                    errorCount: 0
                },
                healthStatus: 'healthy',
                poolIndex
            };
            this.connections.set(socket.id, pooledConnection);
            this.pools[poolIndex].push(pooledConnection);
            if (!this.connectionsByUser.has(userId)) {
                this.connectionsByUser.set(userId, new Set());
            }
            this.connectionsByUser.get(userId).add(socket.id);
            if (!this.connectionsByOrganization.has(organizationId)) {
                this.connectionsByOrganization.set(organizationId, new Set());
            }
            this.connectionsByOrganization.get(organizationId).add(socket.id);
            this.setupConnectionMonitoring(pooledConnection);
            this.metrics.totalConnections++;
            this.metrics.activeConnections++;
            await this.cacheConnectionInfo(pooledConnection);
            this.logger.debug('Connection added to pool', {
                connectionId: socket.id,
                userId,
                organizationId,
                poolIndex,
                totalConnections: this.connections.size
            });
            this.emit('connection:added', pooledConnection);
            return { success: true, poolIndex };
        }
        catch (error) {
            this.logger.error('Failed to add connection to pool:', error);
            return { success: false, error: 'Internal error' };
        }
    }
    async removeConnection(connectionId) {
        try {
            const connection = this.connections.get(connectionId);
            if (!connection)
                return;
            this.connections.delete(connectionId);
            const pool = this.pools[connection.poolIndex];
            const index = pool.findIndex(conn => conn.id === connectionId);
            if (index !== -1) {
                pool.splice(index, 1);
            }
            this.connectionsByUser.get(connection.userId)?.delete(connectionId);
            if (this.connectionsByUser.get(connection.userId)?.size === 0) {
                this.connectionsByUser.delete(connection.userId);
            }
            this.connectionsByOrganization.get(connection.organizationId)?.delete(connectionId);
            if (this.connectionsByOrganization.get(connection.organizationId)?.size === 0) {
                this.connectionsByOrganization.delete(connection.organizationId);
            }
            this.metrics.totalConnections--;
            this.metrics.activeConnections--;
            await this.removeCachedConnectionInfo(connectionId);
            this.logger.debug('Connection removed from pool', {
                connectionId,
                userId: connection.userId,
                organizationId: connection.organizationId,
                poolIndex: connection.poolIndex,
                connectionDuration: Date.now() - connection.createdAt.getTime()
            });
            this.emit('connection:removed', connection);
        }
        catch (error) {
            this.logger.error('Failed to remove connection from pool:', error);
        }
    }
    getConnection(connectionId) {
        return this.connections.get(connectionId);
    }
    getUserConnections(userId) {
        const connectionIds = this.connectionsByUser.get(userId) || new Set();
        return Array.from(connectionIds)
            .map(id => this.connections.get(id))
            .filter((conn) => conn !== undefined);
    }
    getOrganizationConnections(organizationId) {
        const connectionIds = this.connectionsByOrganization.get(organizationId) || new Set();
        return Array.from(connectionIds)
            .map(id => this.connections.get(id))
            .filter((conn) => conn !== undefined);
    }
    selectOptimalPool() {
        let minConnectionsCount = Number.MAX_SAFE_INTEGER;
        let optimalPoolIndex = 0;
        for (let i = 0; i < this.pools.length; i++) {
            const healthyConnections = this.pools[i].filter(conn => conn.healthStatus === 'healthy' || conn.healthStatus === 'warning').length;
            if (healthyConnections < minConnectionsCount) {
                minConnectionsCount = healthyConnections;
                optimalPoolIndex = i;
            }
        }
        return optimalPoolIndex;
    }
    setupConnectionMonitoring(connection) {
        const { socket } = connection;
        socket.onAny(() => {
            connection.lastActivity = new Date();
            connection.metadata.messagesReceived++;
        });
        const originalEmit = socket.emit.bind(socket);
        socket.emit = (...args) => {
            connection.metadata.messagesSent++;
            connection.metadata.bytesSent += JSON.stringify(args).length;
            return originalEmit(...args);
        };
        socket.on('error', () => {
            connection.metadata.errorCount++;
            connection.healthStatus = connection.metadata.errorCount > 5 ? 'critical' : 'warning';
        });
        socket.on('disconnect', () => {
            connection.healthStatus = 'disconnected';
            this.removeConnection(connection.id);
        });
    }
    async performHealthCheck() {
        const now = Date.now();
        const healthyConnections = [];
        const warningConnections = [];
        const criticalConnections = [];
        for (const connection of this.connections.values()) {
            const age = now - connection.createdAt.getTime();
            const lastActivity = now - connection.lastActivity.getTime();
            let healthScore = 100;
            if (lastActivity > 300000) {
                healthScore -= 30;
            }
            healthScore -= Math.min(connection.metadata.errorCount * 10, 50);
            if (connection.socket.readyState !== 'open') {
                healthScore -= 50;
            }
            if (healthScore >= 80) {
                connection.healthStatus = 'healthy';
                healthyConnections.push(connection);
            }
            else if (healthScore >= 60) {
                connection.healthStatus = 'warning';
                warningConnections.push(connection);
            }
            else {
                connection.healthStatus = 'critical';
                criticalConnections.push(connection);
            }
        }
        const totalConnections = this.connections.size;
        if (totalConnections > 0) {
            this.metrics.healthScore = ((healthyConnections.length * 100 +
                warningConnections.length * 60 +
                criticalConnections.length * 30) / totalConnections);
        }
        if (warningConnections.length > 0 || criticalConnections.length > 0) {
            this.logger.warn('Connection health check completed', {
                healthy: healthyConnections.length,
                warning: warningConnections.length,
                critical: criticalConnections.length,
                overallHealthScore: this.metrics.healthScore
            });
        }
        for (const connection of criticalConnections) {
            if (connection.healthStatus === 'critical' &&
                connection.metadata.errorCount > 10) {
                try {
                    connection.socket.disconnect(true);
                }
                catch (error) {
                    this.logger.error('Failed to disconnect critical connection:', error);
                }
            }
        }
    }
    updatePerformanceMetrics() {
        const now = Date.now();
        const totalCapacity = this.config.maxConnections;
        this.metrics.poolUtilization = (this.connections.size / totalCapacity) * 100;
        let totalMessages = 0;
        let totalBytes = 0;
        for (const connection of this.connections.values()) {
            totalMessages += connection.metadata.messagesReceived + connection.metadata.messagesSent;
            totalBytes += connection.metadata.bytesReceived + connection.metadata.bytesSent;
        }
        this.metrics.throughput = {
            messagesPerSecond: totalMessages / 60,
            bytesPerSecond: totalBytes / 60
        };
        const memUsage = process.memoryUsage();
        this.metrics.memoryUsage = memUsage.heapUsed / (1024 * 1024);
        this.emit('metrics:updated', this.metrics);
        if (this.metrics.memoryUsage > this.config.memoryThreshold) {
            this.emit('threshold:memory', this.metrics.memoryUsage);
            this.logger.warn('Memory threshold exceeded', {
                current: this.metrics.memoryUsage,
                threshold: this.config.memoryThreshold
            });
        }
        if (this.metrics.poolUtilization > 85) {
            this.emit('threshold:capacity', this.metrics.poolUtilization);
            this.logger.warn('Pool utilization high', {
                utilization: this.metrics.poolUtilization
            });
        }
    }
    async cacheConnectionInfo(connection) {
        try {
            const cacheKey = `connection:${connection.id}:info`;
            const connectionInfo = {
                id: connection.id,
                userId: connection.userId,
                organizationId: connection.organizationId,
                createdAt: connection.createdAt,
                poolIndex: connection.poolIndex,
                healthStatus: connection.healthStatus
            };
            await this.redisManager.cacheMetrics(cacheKey, connectionInfo, 600);
        }
        catch (error) {
            this.logger.warn('Failed to cache connection info:', error);
        }
    }
    async removeCachedConnectionInfo(connectionId) {
        try {
            const cacheKey = `connection:${connectionId}:info`;
            await this.redisManager.client.del(cacheKey);
        }
        catch (error) {
            this.logger.warn('Failed to remove cached connection info:', error);
        }
    }
    initializePools() {
        const poolCount = Math.ceil(this.config.maxConnections / 100);
        this.pools = Array.from({ length: Math.max(poolCount, 4) }, () => []);
        this.logger.info('Connection pools initialized', {
            poolCount: this.pools.length,
            maxConnections: this.config.maxConnections
        });
    }
    initializeMetrics() {
        this.metrics = {
            totalConnections: 0,
            activeConnections: 0,
            idleConnections: 0,
            poolUtilization: 0,
            averageResponseTime: 0,
            throughput: {
                messagesPerSecond: 0,
                bytesPerSecond: 0
            },
            healthScore: 100,
            memoryUsage: 0,
            cpuUsage: 0,
            errors: {
                connectionErrors: 0,
                timeoutErrors: 0,
                memoryErrors: 0
            }
        };
    }
    startBackgroundServices() {
        this.healthCheckInterval = setInterval(() => {
            this.performHealthCheck();
        }, this.config.healthCheckInterval);
        this.performanceInterval = setInterval(() => {
            this.updatePerformanceMetrics();
        }, this.config.performanceMonitorInterval);
    }
    getMetrics() {
        return { ...this.metrics };
    }
    getPoolStats() {
        const poolStats = this.pools.map((pool, index) => ({
            index,
            connectionCount: pool.length,
            healthyCount: pool.filter(conn => conn.healthStatus === 'healthy').length
        }));
        const distribution = {};
        poolStats.forEach(pool => {
            distribution[pool.index] = pool.connectionCount;
        });
        return {
            pools: poolStats,
            totalConnections: this.connections.size,
            distribution
        };
    }
    async shutdown() {
        this.logger.info('Shutting down connection pool...');
        if (this.healthCheckInterval)
            clearInterval(this.healthCheckInterval);
        if (this.performanceInterval)
            clearInterval(this.performanceInterval);
        const disconnectPromises = Array.from(this.connections.values()).map(async (connection) => {
            try {
                connection.socket.emit('server_shutdown', {
                    message: 'Server shutting down',
                    timestamp: new Date()
                });
                await new Promise(resolve => setTimeout(resolve, 100));
                connection.socket.disconnect(true);
            }
            catch (error) {
                this.logger.error('Error disconnecting socket:', error);
            }
        });
        await Promise.allSettled(disconnectPromises);
        this.connections.clear();
        this.connectionsByUser.clear();
        this.connectionsByOrganization.clear();
        this.pools.forEach(pool => pool.length = 0);
        this.logger.info('Connection pool shutdown complete');
    }
}
exports.ConnectionPool = ConnectionPool;
//# sourceMappingURL=connection-pool.js.map