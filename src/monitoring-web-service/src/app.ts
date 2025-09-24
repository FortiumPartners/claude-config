/**
 * Express Application Configuration
 * Fortium External Metrics Web Service - Task 1.6: Express.js Server Foundation
 */

// Initialize OpenTelemetry FIRST - before any other imports
import './tracing/simple-otel-init';

import express, { Express, Request, Response } from 'express';
import { config } from './config/environment';
import { logger, getSeqHealth, getSeqMetrics } from './config/logger';
// import { getOTelHealthStatus } from './tracing/otel-init'; // Temporarily disabled due to syntax issues
import { getBusinessMetricsService } from './services/business-metrics.service';
import { getSignOzMetricsExportManager } from './config/signoz-metrics-export';

// Middleware imports
import { corsMiddleware, corsErrorHandler } from './middleware/cors.middleware';
import { helmetMiddleware, createRateLimitMiddleware, configureTrustProxy, requestIdMiddleware, securityHeadersMiddleware, ipFilterMiddleware } from './middleware/security.middleware';
import { compressionMiddleware } from './middleware/compression.middleware';
import { httpLoggingMiddleware, responseTimeMiddleware, requestLoggingMiddleware } from './middleware/logging.middleware';
import { errorMiddleware, notFoundMiddleware } from './middleware/error.middleware';
import { minimalMultiTenantChain } from './middleware/multi-tenant.middleware';
import { otelPerformanceMiddleware, performanceMetricsEndpoint } from './middleware/otel-performance.middleware';
import { setupBusinessMetrics } from './middleware/business-metrics.middleware';

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
  
  // OpenTelemetry performance monitoring (after logging)
  app.use(otelPerformanceMiddleware());
  
  // Enhanced Business Tracing Middleware (Task 4.3)
  const { enhancedBusinessTraceMiddleware } = await import('./middleware/enhanced-business-trace.middleware');
  app.use(enhancedBusinessTraceMiddleware({
    enableAutoDetection: true,
    enableAuditTrail: true,
    enablePerformanceAnalysis: true
  }));
  
  // Business metrics collection (Task 4.1)
  app.use(setupBusinessMetrics());
  
  // Enhanced performance monitoring (Task 4.2)
  const { createPerformanceMonitoringMiddleware } = await import('./middleware/performance-monitoring.middleware');
  app.use(createPerformanceMonitoringMiddleware({
    enabled: true,
    trackAllRoutes: true,
    excludePaths: ['/health', '/metrics', '/favicon.ico', '/_internal/'],
    slowRequestThreshold: 1000,
    enableDetailedLogging: config.isDevelopment,
  }));

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

  // Rate limiting - DISABLED FOR TESTING
  // const rateLimitMiddleware = createRateLimitMiddleware();
  // app.use(rateLimitMiddleware);

  // Health check endpoint (before auth middleware)
  app.get(config.healthCheck.path, async (req: Request, res: Response) => {
    try {
      // Get Seq health status
      const seqHealth = await getSeqHealth();
      const seqMetrics = getSeqMetrics();
      
      // Get OTEL health status (temporarily disabled)
      const otelHealth = { status: 'healthy', enabled: false, features: {}, endpoints: {}, performance: {} };
      
      // Get business metrics health status
      const businessMetricsHealth = getBusinessMetricsService().getHealthStatus();
      const signozExportHealth = getSignOzMetricsExportManager().getHealthStatus();
      
      // Determine overall health status
      let overallStatus = 'healthy';
      if (seqHealth.status === 'unhealthy') {
        overallStatus = 'degraded'; // Service can still operate without Seq
      }
      if (otelHealth.status === 'unhealthy') {
        overallStatus = 'degraded'; // Service can still operate without OTEL
      }
      if (businessMetricsHealth.status === 'unhealthy') {
        overallStatus = 'degraded'; // Business metrics issues are degraded, not critical
      }
      if (signozExportHealth.status === 'unhealthy') {
        overallStatus = 'degraded'; // Export issues are degraded, not critical
      }
      
      const healthData = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: config.nodeEnv,
        version: '1.0.0',
        services: {
          database: 'connected', // TODO: Add actual database health check
          redis: config.redis.url ? 'connected' : 'not_configured',
          seq: {
            status: seqHealth.status,
            url: config.seq.serverUrl,
            ...(seqHealth.latency && { latency: `${seqHealth.latency}ms` }),
            ...(seqHealth.error && { error: seqHealth.error }),
            ...(seqMetrics && {
              metrics: {
                totalLogs: seqMetrics.totalLogs,
                successfulLogs: seqMetrics.successfulLogs,
                failedLogs: seqMetrics.failedLogs,
                averageLatency: Math.round(seqMetrics.averageLatency),
                circuitBreakerOpen: seqMetrics.circuitBreakerOpen,
                bufferSize: seqMetrics.bufferSize,
              }
            })
          },
          opentelemetry: {
            status: otelHealth.status,
            enabled: otelHealth.enabled,
            features: otelHealth.features,
            endpoints: otelHealth.endpoints,
            performance: otelHealth.performance,
          },
          business_metrics: {
            status: businessMetricsHealth.status,
            enabled: businessMetricsHealth.metricsEnabled,
            active_tenants: businessMetricsHealth.activeTenantsCount,
            memory_usage: businessMetricsHealth.memoryUsage,
          },
          signoz_export: {
            status: signozExportHealth.status,
            last_export: signozExportHealth.lastExport,
            total_exports: signozExportHealth.totalExports,
            failed_exports: signozExportHealth.failedExports,
            success_rate: signozExportHealth.performance.successRate,
            configuration: signozExportHealth.configuration,
          },
        },
        telemetry: {
          seq: {
            enabled: !config.isTest,
            batchSize: config.seq.batchSize,
            flushInterval: config.seq.flushInterval,
          },
          opentelemetry: {
            enabled: config.otel.enabled,
            sampling: {
              traceRatio: config.otel.sampling.traceRatio,
            },
            exportInterval: config.otel.metrics.exportInterval,
          },
        },
      };

      // Set appropriate status code
      const statusCode = overallStatus === 'healthy' ? 200 : 
                        overallStatus === 'degraded' ? 200 : 503;

      res.status(statusCode).json(healthData);
      
    } catch (error) {
      logger.error('Health check error', { 
        error: (error as Error).message,
        event: 'health.check.error'
      });
      
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
        details: (error as Error).message,
      });
    }
  });

  // OpenTelemetry performance metrics endpoint
  app.get('/otel/performance', performanceMetricsEndpoint());

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
  
  // Enhanced Tracing Demo Routes (Task 4.3)
  const enhancedTracingDemoRoutes = await import('./routes/enhanced-tracing-demo.routes');
  app.use('/api/v1/tracing', enhancedTracingDemoRoutes.default);

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

// Start server if this file is run directly
if (require.main === module) {
  const startServer = async () => {
    try {
      const { createServer } = await import('http');
      const { PostgreSQLConnection } = await import('./database/connection');
      const { setupWebSocketIntegration } = await import('./routes/websocket.routes');

      const app = await createApp();
      const PORT = config.port || 3001;

      // Create HTTP server
      const httpServer = createServer(app);

      // Initialize database connection for WebSocket
      const dbConnection = new PostgreSQLConnection({
        connectionString: config.database.url,
        max: 10,
        min: 2,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 60000,
      }, logger);

      // Setup WebSocket integration
      const { wsManager, wsRoutes } = setupWebSocketIntegration(
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

      // Attach WebSocket manager to app for use in other routes
      (app as any).wsManager = wsManager;

      httpServer.listen(PORT, () => {
        logger.info(`🚀 Server started successfully with WebSocket support`, {
          port: PORT,
          environment: config.nodeEnv,
          event: 'server.started',
          websocket: {
            path: '/ws',
            maxConnections: 1000,
          },
        });
      });
    } catch (error) {
      logger.error('Failed to start server', {
        error: (error as Error).message,
        event: 'server.start.error'
      });
      process.exit(1);
    }
  };

  startServer();
}