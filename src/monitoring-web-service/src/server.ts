/**
 * Express Server Entry Point
 * Fortium External Metrics Web Service - Task 1.6: Express.js Server Foundation
 */

// Initialize OpenTelemetry FIRST - before any other imports
import './tracing/simple-otel-init';

// Initialize console override for OTEL-only mode
import './config/console-override';

import express from 'express';
import { createServer } from 'http';
import { createApp } from './app';
import { logger } from './config/logger';
import { config } from './config/environment';
import { PostgreSQLConnection } from './database/connection';
import { setupWebSocketIntegration } from './routes/websocket.routes';

/**
 * Start the Express server with proper error handling and graceful shutdown
 */
async function startServer(): Promise<void> {
  try {
    // Create Express application
    const app = await createApp();

    // Create HTTP server
    const httpServer = createServer(app);

    // Initialize database connection
    const dbConnection = new PostgreSQLConnection({
      connectionString: config.database.url,
      max: 10,
      min: 2,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 60000,
    }, logger);

    // Setup WebSocket integration
    const { wsManager, wsRoutes, wsMiddleware } = setupWebSocketIntegration(
      httpServer,
      dbConnection,
      logger,
      {
        path: '/ws',
        maxConnections: 1000,
        jwtSecret: config.jwt.secret,
      }
    );

    // Add WebSocket routes to Express app
    app.use('/api/v1/websocket', wsRoutes);

    // Start server
    const server = httpServer.listen(config.port, () => {
      logger.info('Fortium Metrics Web Service started successfully', {
        port: config.port,
        environment: config.nodeEnv,
        timestamp: new Date().toISOString(),
        features: {
          authentication: 'JWT with refresh tokens',
          database: 'PostgreSQL with Prisma ORM',
          multiTenant: true,
          cors: true,
          compression: true,
          helmet: true,
          rateLimit: true,
          websockets: true, // Added WebSocket support
        },
        websocket: {
          path: '/ws',
          maxConnections: 1000,
        },
      });
    });

    // Set server timeout
    server.timeout = config.server.timeout;
    server.keepAliveTimeout = config.server.keepAliveTimeout;

    // Graceful shutdown handler
    const gracefulShutdown = async (signal: string): Promise<void> => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`, {
        signal,
        timestamp: new Date().toISOString(),
      });

      try {
        // Close WebSocket server first
        await wsManager.shutdown();
        logger.info('WebSocket server closed successfully');

        // Close HTTP server
        await new Promise<void>((resolve, reject) => {
          server.close((err) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
        });

        logger.info('HTTP server closed successfully');

        // Close database connections
        // Note: Prisma client will be closed in the shutdown handler

        process.exit(0);
      } catch (err) {
        logger.error('Error during server shutdown:', err);
        process.exit(1);
      }
    };

    // Async shutdown wrapper
    const asyncShutdown = (signal: string) => {
      gracefulShutdown(signal).catch((err) => {
        logger.error('Shutdown error:', err);
        process.exit(1);
      });

      // Force close after timeout
      setTimeout(() => {
        logger.error('Forced shutdown due to timeout');
        process.exit(1);
      }, config.server.shutdownTimeout);
    };

    // Register shutdown handlers
    process.on('SIGTERM', () => asyncShutdown('SIGTERM'));
    process.on('SIGINT', () => asyncShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught Exception - shutting down:', {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      });

      asyncShutdown('uncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
      logger.error('Unhandled Rejection - shutting down:', {
        reason: String(reason),
        promise: promise.toString(),
        timestamp: new Date().toISOString(),
      });

      asyncShutdown('unhandledRejection');
    });

  } catch (error) {
    logger.error('Failed to start server:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    
    process.exit(1);
  }
}

// Start server if this file is executed directly
if (require.main === module) {
  startServer().catch((error) => {
    logger.error('Server startup failed:', error);
    process.exit(1);
  });
}

export { startServer };