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
exports.startSimpleServer = startSimpleServer;
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const dotenv = __importStar(require("dotenv"));
dotenv.config();
async function startSimpleServer() {
    try {
        const app = (0, express_1.default)();
        app.use((0, cors_1.default)({
            origin: ['http://localhost:3000', 'http://localhost:3001'],
            credentials: true
        }));
        app.use(express_1.default.json());
        app.get('/health', (req, res) => {
            res.status(200).json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                environment: 'development',
                version: '1.0.0'
            });
        });
        app.get('/api', (req, res) => {
            res.json({
                name: 'Fortium External Metrics Web Service (Simple)',
                version: '1.0.0',
                description: 'AI-Augmented Development Analytics Platform',
                environment: 'development',
                endpoints: {
                    health: '/health',
                    api: '/api/v1',
                    websocket: 'ws://localhost:3002'
                }
            });
        });
        app.post('/api/v1/auth/login', (req, res) => {
            res.json({
                success: true,
                user: {
                    id: 'demo-user',
                    email: 'demo@example.com',
                    name: 'Demo User'
                },
                token: 'demo-token',
                refreshToken: 'demo-refresh-token'
            });
        });
        app.get('/api/v1/metrics/dashboard', (req, res) => {
            res.json({
                activeUsers: Math.floor(Math.random() * 100),
                commandsExecuted: Math.floor(Math.random() * 1000),
                avgResponseTime: Math.random() * 500,
                timestamp: new Date().toISOString()
            });
        });
        const httpServer = (0, http_1.createServer)(app);
        const io = new socket_io_1.Server(httpServer, {
            cors: {
                origin: ['http://localhost:3000', 'http://localhost:3001'],
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
        const PORT = process.env.PORT || 3002;
        httpServer.listen(PORT, () => {
            console.log(`🚀 Simple External Metrics Web Service (WebSocket Enabled) running on http://localhost:${PORT}`);
            console.log(`📊 Health check: http://localhost:${PORT}/health`);
            console.log(`📈 API endpoint: http://localhost:${PORT}/api/v1`);
            console.log(`🔌 WebSocket endpoint: ws://localhost:${PORT}`);
        });
        return { app, io, httpServer };
    }
    catch (error) {
        console.error('Failed to start simple server:', error);
        process.exit(1);
    }
}
if (require.main === module) {
    startSimpleServer();
}
//# sourceMappingURL=server-websocket-simple.js.map