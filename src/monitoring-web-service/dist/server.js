"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startServer = startServer;
const app_1 = require("./app");
const logger_1 = require("./config/logger");
const environment_1 = require("./config/environment");
async function startServer() {
    try {
        const app = await (0, app_1.createApp)();
        const server = app.listen(environment_1.config.port, () => {
            logger_1.logger.info('Fortium Metrics Web Service started successfully', {
                port: environment_1.config.port,
                environment: environment_1.config.nodeEnv,
                timestamp: new Date().toISOString(),
                features: {
                    authentication: 'JWT with refresh tokens',
                    database: 'PostgreSQL with Prisma ORM',
                    multiTenant: true,
                    cors: true,
                    compression: true,
                    helmet: true,
                    rateLimit: true,
                },
            });
        });
        server.timeout = environment_1.config.server.timeout;
        server.keepAliveTimeout = environment_1.config.server.keepAliveTimeout;
        const gracefulShutdown = (signal) => {
            logger_1.logger.info(`Received ${signal}. Starting graceful shutdown...`, {
                signal,
                timestamp: new Date().toISOString(),
            });
            server.close((err) => {
                if (err) {
                    logger_1.logger.error('Error during server shutdown:', err);
                    process.exit(1);
                }
                logger_1.logger.info('HTTP server closed successfully');
                process.exit(0);
            });
            setTimeout(() => {
                logger_1.logger.error('Forced shutdown due to timeout');
                process.exit(1);
            }, environment_1.config.server.shutdownTimeout);
        };
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        process.on('uncaughtException', (error) => {
            logger_1.logger.error('Uncaught Exception - shutting down:', {
                error: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString(),
            });
            gracefulShutdown('uncaughtException');
        });
        process.on('unhandledRejection', (reason, promise) => {
            logger_1.logger.error('Unhandled Rejection - shutting down:', {
                reason: String(reason),
                promise: promise.toString(),
                timestamp: new Date().toISOString(),
            });
            gracefulShutdown('unhandledRejection');
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to start server:', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            timestamp: new Date().toISOString(),
        });
        process.exit(1);
    }
}
if (require.main === module) {
    startServer().catch((error) => {
        logger_1.logger.error('Server startup failed:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=server.js.map