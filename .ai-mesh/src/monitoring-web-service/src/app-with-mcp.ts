/**
 * Enhanced App with MCP Integration
 * Task 4: Complete application setup with MCP and webhook routes
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import * as winston from 'winston';

// Database and core services
import { DatabaseConnection } from './database/connection';
import { createDbConnection } from './database/connection';

// Route imports
import { createAuthRoutes } from './routes/auth.routes';
import { createUserManagementRoutes } from './routes/user-management.routes';
import { createTeamManagementRoutes } from './routes/team-management.routes';
import { createMetricsCollectionRoutes } from './routes/metrics-collection.routes';
import { createMetricsQueryRoutes } from './routes/metrics-query.routes';
import { createMcpRoutes } from './routes/mcp.routes';
import { createWebhookRoutes } from './routes/webhooks.routes';

// Middleware
import { captureRawBody } from './middleware/webhook-signature.middleware';

export async function createAppWithMcp(): Promise<express.Application> {
  const app = express();

  // Setup logger
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
      })
    ]
  });

  // Database connection
  const db = await createDbConnection();
  
  // Security middleware
  app.use(helmet({
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

  app.use(cors({
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'http://localhost:8080'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Fortium-Signature', 'X-Fortium-Timestamp']
  }));

  // Global rate limiting
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Increased for MCP usage
    message: {
      error: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
  });
  app.use('/api/', globalLimiter);

  // Raw body capture for webhook signature verification (before JSON parsing)
  app.use('/api/webhooks/', captureRawBody);

  // Body parsing and compression
  app.use(express.json({ 
    limit: '10mb',
    type: ['application/json', 'application/vnd.api+json']
  }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(compression());

  // Logging
  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('combined', {
      stream: {
        write: (message) => logger.info(message.trim())
      }
    }));
  }

  // Health check endpoints
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
      // Test database connection
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
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // API routes
  const authRoutes = createAuthRoutes(db, logger);
  const userRoutes = createUserManagementRoutes(db, logger, authRoutes.authenticateJWT);
  const teamRoutes = createTeamManagementRoutes(db, logger, authRoutes.authenticateJWT);
  const metricsCollectionRoutes = createMetricsCollectionRoutes(db, logger);
  const metricsQueryRoutes = createMetricsQueryRoutes(db, logger);
  const mcpRoutes = createMcpRoutes(db, logger);
  const webhookRoutes = createWebhookRoutes(db, logger);

  // Mount routes
  app.use('/api/auth', authRoutes.router);
  app.use('/api/users', userRoutes.router);
  app.use('/api/teams', teamRoutes.router);
  app.use('/api/metrics', metricsCollectionRoutes.router);
  app.use('/api/analytics', metricsQueryRoutes.router);
  app.use('/api/mcp', mcpRoutes.router);
  app.use('/api/webhooks', webhookRoutes.router);

  // MCP Server Info endpoint (for Claude Code discovery)
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
        websocket: '/api/mcp/ws' // Future enhancement
      },
      integration: {
        claude_code_compatible: true,
        backward_compatible: true,
        migration_support: true
      }
    });
  });

  // Error handling middleware
  
  // MCP-specific error handler
  app.use('/api/mcp/', (err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error('MCP error:', err);
    
    // Return MCP-compliant error format
    res.status(200).json({
      jsonrpc: '2.0',
      id: (req.body as any)?.id || null,
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

  // Webhook-specific error handler
  app.use('/api/webhooks/', (err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error('Webhook error:', err);
    
    res.status(500).json({
      success: false,
      message: 'Webhook processing failed',
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal error',
      timestamp: new Date().toISOString()
    });
  });

  // Global error handler
  app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error('Global error handler:', err);

    // Handle different error types
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

    // Database connection errors
    if (err.message?.includes('ECONNREFUSED') || err.message?.includes('connection')) {
      return res.status(503).json({
        error: 'Service unavailable',
        message: 'Database connection failed',
        timestamp: new Date().toISOString()
      });
    }

    // Rate limiting errors
    if (err.message?.includes('rate limit')) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many requests, please try again later',
        timestamp: new Date().toISOString()
      });
    }

    // Default error response
    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
      timestamp: new Date().toISOString(),
      request_id: req.headers['x-request-id'] || 'unknown'
    });
  });

  // 404 handler for unmatched routes
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

  // Graceful shutdown handling
  const gracefulShutdown = (signal: string) => {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);
    
    // Close database connections
    if (db && db.pool) {
      db.pool.end(() => {
        logger.info('Database connections closed');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  return app;
}

// Export for testing and direct use
export { createAppWithMcp as createApp };

// Create app instance (for backwards compatibility)
let appInstance: express.Application | null = null;

export const getApp = async (): Promise<express.Application> => {
  if (!appInstance) {
    appInstance = await createAppWithMcp();
  }
  return appInstance;
};

// For direct import compatibility
export default getApp();