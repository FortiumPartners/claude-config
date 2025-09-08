/**
 * Express Server Entry Point
 * Fortium External Metrics Web Service - Task 1.6: Express.js Server Foundation
 */

import express from 'express';
import { createApp } from './app';
import { logger } from './config/logger';
import { config } from './config/environment';

/**
 * Start the Express server with proper error handling and graceful shutdown
 */
async function startServer(): Promise<void> {
  try {
    // Create Express application
    const app = await createApp();
    
    // Start server
    const server = app.listen(config.port, () => {
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
        },
      });
    });

    // Set server timeout
    server.timeout = config.server.timeout;
    server.keepAliveTimeout = config.server.keepAliveTimeout;

    // Graceful shutdown handler
    const gracefulShutdown = (signal: string): void => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`, {
        signal,
        timestamp: new Date().toISOString(),
      });

      server.close((err) => {
        if (err) {
          logger.error('Error during server shutdown:', err);
          process.exit(1);
        }

        logger.info('HTTP server closed successfully');
        
        // Close database connections
        // Note: Prisma client will be closed in the shutdown handler
        
        process.exit(0);
      });

      // Force close after timeout
      setTimeout(() => {
        logger.error('Forced shutdown due to timeout');
        process.exit(1);
      }, config.server.shutdownTimeout);
    };

    // Register shutdown handlers
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught Exception - shutting down:', {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      });
      
      gracefulShutdown('uncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
      logger.error('Unhandled Rejection - shutting down:', {
        reason: String(reason),
        promise: promise.toString(),
        timestamp: new Date().toISOString(),
      });
      
      gracefulShutdown('unhandledRejection');
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