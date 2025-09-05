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
exports.getApp = void 0;
exports.createAppWithMcp = createAppWithMcp;
exports.createApp = createAppWithMcp;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const compression_1 = __importDefault(require("compression"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const winston = __importStar(require("winston"));
const connection_1 = require("./database/connection");
const auth_routes_1 = require("./routes/auth.routes");
const user_management_routes_1 = require("./routes/user-management.routes");
const team_management_routes_1 = require("./routes/team-management.routes");
const metrics_collection_routes_1 = require("./routes/metrics-collection.routes");
const metrics_query_routes_1 = require("./routes/metrics-query.routes");
const mcp_routes_1 = require("./routes/mcp.routes");
const webhooks_routes_1 = require("./routes/webhooks.routes");
const webhook_signature_middleware_1 = require("./middleware/webhook-signature.middleware");
async function createAppWithMcp() {
    const app = (0, express_1.default)();
    const logger = winston.createLogger({
        level: process.env.LOG_LEVEL || 'info',
        format: winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json()),
        transports: [
            new winston.transports.Console({
                format: winston.format.simple()
            })
        ]
    });
    const db = await (0, connection_1.createDbConnection)();
    app.use((0, helmet_1.default)({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", "data:", "https:"],
                connectSrc: ["'self'", "wss:", "ws:"]
            }
        }
    }));
    app.use((0, cors_1.default)({
        origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'http://localhost:8080'],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Fortium-Signature', 'X-Fortium-Timestamp']
    }));
    const globalLimiter = (0, express_rate_limit_1.default)({
        windowMs: 15 * 60 * 1000,
        max: 1000,
        message: {
            error: 'Too many requests from this IP, please try again later.'
        },
        standardHeaders: true,
        legacyHeaders: false
    });
    app.use('/api/', globalLimiter);
    app.use('/api/webhooks/', webhook_signature_middleware_1.captureRawBody);
    app.use(express_1.default.json({
        limit: '10mb',
        type: ['application/json', 'application/vnd.api+json']
    }));
    app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
    app.use((0, compression_1.default)());
    if (process.env.NODE_ENV !== 'test') {
        app.use((0, morgan_1.default)('combined', {
            stream: {
                write: (message) => logger.info(message.trim())
            }
        }));
    }
    app.get('/health', (req, res) => {
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: process.env.npm_package_version || '1.0.0',
            services: {
                database: 'connected',
                mcp_server: 'active',
                webhook_system: 'active'
            }
        });
    });
    app.get('/health/detailed', async (req, res) => {
        try {
            await db.query('SELECT 1');
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                version: process.env.npm_package_version || '1.0.0',
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                services: {
                    database: {
                        status: 'connected',
                        pool_size: db.pool?.totalCount || 0,
                        active_connections: db.pool?.idleCount || 0
                    },
                    mcp_server: {
                        status: 'active',
                        protocol_version: '2024-11-05',
                        supported_methods: [
                            'initialize',
                            'resources/list',
                            'resources/read',
                            'tools/list',
                            'tools/call'
                        ]
                    },
                    webhook_system: {
                        status: 'active',
                        supported_events: [
                            'command.executed',
                            'agent.delegated',
                            'productivity.alert'
                        ]
                    }
                }
            });
        }
        catch (error) {
            res.status(503).json({
                status: 'unhealthy',
                timestamp: new Date().toISOString(),
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });
    const authRoutes = (0, auth_routes_1.createAuthRoutes)(db, logger);
    const userRoutes = (0, user_management_routes_1.createUserManagementRoutes)(db, logger, authRoutes.authenticateJWT);
    const teamRoutes = (0, team_management_routes_1.createTeamManagementRoutes)(db, logger, authRoutes.authenticateJWT);
    const metricsCollectionRoutes = (0, metrics_collection_routes_1.createMetricsCollectionRoutes)(db, logger);
    const metricsQueryRoutes = (0, metrics_query_routes_1.createMetricsQueryRoutes)(db, logger);
    const mcpRoutes = (0, mcp_routes_1.createMcpRoutes)(db, logger);
    const webhookRoutes = (0, webhooks_routes_1.createWebhookRoutes)(db, logger);
    app.use('/api/auth', authRoutes.router);
    app.use('/api/users', userRoutes.router);
    app.use('/api/teams', teamRoutes.router);
    app.use('/api/metrics', metricsCollectionRoutes.router);
    app.use('/api/analytics', metricsQueryRoutes.router);
    app.use('/api/mcp', mcpRoutes.router);
    app.use('/api/webhooks', webhookRoutes.router);
    app.get('/api/mcp-server-info', (req, res) => {
        res.json({
            name: 'fortium-metrics-server',
            version: '1.0.0',
            description: 'Fortium External Metrics Web Service MCP Server',
            protocol_version: '2024-11-05',
            capabilities: {
                resources: {
                    subscribe: false,
                    listChanged: false
                },
                tools: {
                    listChanged: false
                },
                prompts: {
                    listChanged: false
                },
                experimental: {
                    batch_requests: true,
                    real_time_metrics: true,
                    migration_tools: true,
                    webhook_integration: true
                }
            },
            endpoints: {
                rpc: '/api/mcp/rpc',
                capabilities: '/api/mcp/capabilities',
                health: '/api/mcp/health',
                websocket: '/api/mcp/ws'
            },
            integration: {
                claude_code_compatible: true,
                backward_compatible: true,
                migration_support: true
            }
        });
    });
    app.use('/api/mcp/', (err, req, res, next) => {
        logger.error('MCP error:', err);
        res.status(200).json({
            jsonrpc: '2.0',
            id: req.body?.id || null,
            error: {
                code: -32603,
                message: 'Internal error',
                data: {
                    error: err.message,
                    timestamp: new Date().toISOString()
                }
            }
        });
    });
    app.use('/api/webhooks/', (err, req, res, next) => {
        logger.error('Webhook error:', err);
        res.status(500).json({
            success: false,
            message: 'Webhook processing failed',
            error: process.env.NODE_ENV === 'development' ? err.message : 'Internal error',
            timestamp: new Date().toISOString()
        });
    });
    app.use((err, req, res, next) => {
        logger.error('Global error handler:', err);
        if (err.name === 'ValidationError') {
            return res.status(400).json({
                error: 'Validation failed',
                message: err.message,
                timestamp: new Date().toISOString()
            });
        }
        if (err.name === 'JsonWebTokenError') {
            return res.status(401).json({
                error: 'Invalid token',
                timestamp: new Date().toISOString()
            });
        }
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({
                error: 'Token expired',
                timestamp: new Date().toISOString()
            });
        }
        if (err.message?.includes('ECONNREFUSED') || err.message?.includes('connection')) {
            return res.status(503).json({
                error: 'Service unavailable',
                message: 'Database connection failed',
                timestamp: new Date().toISOString()
            });
        }
        if (err.message?.includes('rate limit')) {
            return res.status(429).json({
                error: 'Rate limit exceeded',
                message: 'Too many requests, please try again later',
                timestamp: new Date().toISOString()
            });
        }
        res.status(500).json({
            error: 'Internal server error',
            message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
            timestamp: new Date().toISOString(),
            request_id: req.headers['x-request-id'] || 'unknown'
        });
    });
    app.use('*', (req, res) => {
        res.status(404).json({
            error: 'Route not found',
            path: req.originalUrl,
            method: req.method,
            timestamp: new Date().toISOString(),
            available_endpoints: [
                '/health',
                '/api/auth',
                '/api/users',
                '/api/teams',
                '/api/metrics',
                '/api/analytics',
                '/api/mcp',
                '/api/webhooks'
            ]
        });
    });
    const gracefulShutdown = (signal) => {
        logger.info(`Received ${signal}. Starting graceful shutdown...`);
        if (db && db.pool) {
            db.pool.end(() => {
                logger.info('Database connections closed');
                process.exit(0);
            });
        }
        else {
            process.exit(0);
        }
    };
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    return app;
}
let appInstance = null;
const getApp = async () => {
    if (!appInstance) {
        appInstance = await createAppWithMcp();
    }
    return appInstance;
};
exports.getApp = getApp;
exports.default = (0, exports.getApp)();
//# sourceMappingURL=app-with-mcp.js.map