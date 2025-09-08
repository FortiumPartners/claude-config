/**
 * Express Application Configuration
 * Fortium External Metrics Web Service - Task 1.6: Express.js Server Foundation
 */

import express, { Express, Request, Response } from 'express';
import { config } from './config/environment';
import { logger } from './config/logger';

// Middleware imports
import { corsMiddleware, corsErrorHandler } from './middleware/cors.middleware';
import { helmetMiddleware, createRateLimitMiddleware, configureTrustProxy, requestIdMiddleware, securityHeadersMiddleware, ipFilterMiddleware } from './middleware/security.middleware';
import { compressionMiddleware } from './middleware/compression.middleware';
import { httpLoggingMiddleware, responseTimeMiddleware, requestLoggingMiddleware } from './middleware/logging.middleware';
import { errorMiddleware, notFoundMiddleware } from './middleware/error.middleware';
import { minimalMultiTenantChain } from './middleware/multi-tenant.middleware';

/**
 * Create and configure Express application
 */
export async function createApp(): Promise<Express> {
  const app = express();

  // Trust proxy configuration (must be first)
  configureTrustProxy(app);

  // Security middleware - early in the chain
  app.use(requestIdMiddleware);
  app.use(securityHeadersMiddleware);
  app.use(ipFilterMiddleware);
  app.use(helmetMiddleware);

  // CORS configuration
  app.use(corsMiddleware);
  app.use(corsErrorHandler);

  // HTTP logging and performance
  app.use(responseTimeMiddleware);
  app.use(httpLoggingMiddleware);
  app.use(requestLoggingMiddleware);

  // Body parsing middleware
  app.use(express.json({ 
    limit: config.bodyParser.limit,
    strict: true,
  }));
  app.use(express.urlencoded({ 
    extended: true, 
    limit: config.bodyParser.limit,
  }));

  // Compression middleware (after body parsing)
  app.use(compressionMiddleware);

  // Rate limiting
  const rateLimitMiddleware = createRateLimitMiddleware();
  app.use(rateLimitMiddleware);

  // Health check endpoint (before auth middleware)
  app.get(config.healthCheck.path, (req: Request, res: Response) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.nodeEnv,
      version: '1.0.0',
      services: {
        database: 'connected', // TODO: Add actual database health check
        redis: config.redis.url ? 'connected' : 'not_configured',
      },
    });
  });

  // API information endpoint
  app.get('/api', (req: Request, res: Response) => {
    res.json({
      name: 'Fortium External Metrics Web Service',
      version: '1.0.0',
      description: 'AI-Augmented Development Analytics Platform',
      environment: config.nodeEnv,
      endpoints: {
        health: config.healthCheck.path,
        auth: '/api/v1/auth',
        metrics: '/api/v1/metrics',
        dashboard: '/api/v1/dashboard',
      },
      features: {
        authentication: 'JWT with refresh tokens',
        multiTenant: true,
        rateLimit: true,
        cors: true,
        compression: true,
        security: 'Helmet.js',
      },
    });
  });

  // Multi-tenancy middleware (applied to API routes)
  app.use('/api/v1', minimalMultiTenantChain());

  // API routes (Task 1.8)
  const routes = await import('./routes');
  app.use('/api/v1', routes.default);

  // 404 handler (must be after all routes)
  app.use(notFoundMiddleware);

  // Global error handler (must be last)
  app.use(errorMiddleware);

  logger.info('Express application configured successfully', {
    environment: config.nodeEnv,
    features: {
      cors: true,
      helmet: true,
      compression: true,
      rateLimit: true,
      logging: true,
      errorHandling: true,
    },
  });

  return app;
}

// Legacy export for backward compatibility
export { createApp as createAppWithMcp };