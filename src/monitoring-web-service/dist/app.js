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
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAppWithMcp = void 0;
const app_with_mcp_1 = require("./app-with-mcp");
Object.defineProperty(exports, "createAppWithMcp", { enumerable: true, get: function () { return app_with_mcp_1.createAppWithMcp; } });
const winston = __importStar(require("winston"));
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json()),
    transports: [
        new winston.transports.Console({
            format: winston.format.simple()
        }),
    ],
});
async function startServer() {
    try {
        const app = await (0, app_with_mcp_1.createAppWithMcp)();
        const port = process.env.PORT || 3000;
        const server = app.listen(port, () => {
            logger.info(`Fortium Metrics Web Service started`, {
                port,
                environment: process.env.NODE_ENV || 'development',
                timestamp: new Date().toISOString(),
                features: {
                    authentication: 'JWT + SSO',
                    database: 'PostgreSQL with RLS',
                    multi_tenant: true,
                    real_time: true,
                    mcp_integration: true,
                },
            });
        });
        const gracefulShutdown = (signal) => {
            logger.info(`Received ${signal}. Starting graceful shutdown...`);
            server.close(() => {
                logger.info('HTTP server closed');
                process.exit(0);
            });
        };
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        process.on('uncaughtException', (error) => {
            logger.error('Uncaught Exception:', error);
            process.exit(1);
        });
        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
            process.exit(1);
        });
    }
    catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
}
if (require.main === module) {
    startServer();
}
//# sourceMappingURL=app.js.map