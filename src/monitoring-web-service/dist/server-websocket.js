"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startServer = startServer;
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const app_1 = require("./app");
const environment_1 = require("./config/environment");
const logger_1 = require("./config/logger");
async function startServer() {
    try {
        const app = await (0, app_1.createApp)();
        const httpServer = (0, http_1.createServer)(app);
        const io = new socket_io_1.Server(httpServer, {
            cors: {
                origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
                methods: ['GET', 'POST'],
                credentials: true
            },
            transports: ['websocket', 'polling']
        });
        io.on('connection', (socket) => {
            console.log('🔌 WebSocket client connected:', socket.id);
            const { token, user_id, organization_id } = socket.handshake.auth || {};
            console.log('Auth info:', { user_id, organization_id });
            if (organization_id) {
                socket.join(`org:${organization_id}`);
                console.log(`Socket ${socket.id} joined room: org:${organization_id}`);
            }
            socket.on('subscribe', (data) => {
                console.log('Subscribe request:', data);
                const { rooms = [] } = data;
                rooms.forEach((room) => {
                    socket.join(room);
                    console.log(`Socket ${socket.id} joined room: ${room}`);
                });
                socket.emit('subscribed', { rooms, timestamp: new Date() });
            });
            socket.on('unsubscribe', (data) => {
                console.log('Unsubscribe request:', data);
                const { rooms = [] } = data;
                rooms.forEach((room) => {
                    socket.leave(room);
                    console.log(`Socket ${socket.id} left room: ${room}`);
                });
            });
            const updateInterval = setInterval(() => {
                socket.emit('dashboard_update', {
                    type: 'metrics',
                    data: {
                        activeUsers: Math.floor(Math.random() * 100),
                        commandsExecuted: Math.floor(Math.random() * 1000),
                        avgResponseTime: Math.random() * 500,
                        timestamp: new Date()
                    }
                });
                socket.emit('metric_ingested', {
                    metric_type: 'command_execution',
                    value: Math.random() * 100,
                    timestamp: new Date()
                });
            }, 5000);
            socket.on('disconnect', () => {
                console.log('🔌 WebSocket client disconnected:', socket.id);
                clearInterval(updateInterval);
            });
        });
        const PORT = process.env.PORT || environment_1.config.port || 3000;
        httpServer.listen(PORT, () => {
            logger_1.logger.info(`🚀 External Metrics Web Service (WebSocket Enabled) running on http://localhost:${PORT}`);
            logger_1.logger.info(`📊 Health check: http://localhost:${PORT}${environment_1.config.healthCheck?.path || '/health'}`);
            logger_1.logger.info(`📈 API endpoint: http://localhost:${PORT}/api/v1`);
            logger_1.logger.info(`🔌 WebSocket endpoint: ws://localhost:${PORT}`);
            logger_1.logger.info(`🎯 Dashboard: http://localhost:${PORT}/api/v1/dashboard`);
            console.log(`🚀 External Metrics Web Service (WebSocket Enabled) running on http://localhost:${PORT}`);
            console.log(`📊 Health check: http://localhost:${PORT}${environment_1.config.healthCheck?.path || '/health'}`);
            console.log(`📈 API endpoint: http://localhost:${PORT}/api/v1`);
            console.log(`🔌 WebSocket endpoint: ws://localhost:${PORT}`);
            console.log(`🎯 Dashboard: http://localhost:${PORT}/api/v1/dashboard`);
        });
        return { app, io, httpServer };
    }
    catch (error) {
        logger_1.logger.error('Failed to start server:', error);
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}
if (require.main === module) {
    startServer();
}
//# sourceMappingURL=server-websocket.js.map