/**
 * Main Application Entry Point
 * Fortium External Metrics Web Service - Phase 2: Authentication and User Management
 */

import { createAppWithMcp } from './app-with-mcp';
import * as winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    }),
  ],
});

async function startServer() {
  try {
    const app = await createAppWithMcp();
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

    // Handle graceful shutdown
    const gracefulShutdown = (signal: string) => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);
      
      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  startServer();
}

export { createAppWithMcp };

// Export app for testing
export { createAppWithMcp as app };