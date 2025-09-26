/**
 * Main Routes Index
 * Fortium External Metrics Web Service - Task 1.8: API Routing Structure
 */

import { Router } from 'express';
import { responseMiddleware } from '../utils/response';
import { logger } from '../config/logger';
import { config } from '../config/environment';

// Import route modules
import authRoutes from './auth.routes';
import metricsRoutes from './metrics.routes';
import dashboardRoutes from './dashboard.routes';
import tenantProvisioningRoutes from './tenant-provisioning.routes';
import hooksRoutes from './hooks.routes';
// import createAnalyticsRouter from './analytics.routes'; // Temporarily disabled due to service dependencies
import activitiesRoutes from './activities.routes';
import logsRoutes from './logs.routes';
import otelValidationRoutes from './otel-validation.routes';
import parallelLoggingValidationRoutes from './parallel-logging-validation.routes';
import performanceMonitoringRoutes from './performance-monitoring.routes';

const router = Router();

// Apply response middleware to all API routes
router.use(responseMiddleware);

// API version and info
router.get('/', (req, res) => {
  res.success({
    service: 'Fortium External Metrics Web Service',
    version: '1.0.0',
    description: 'AI-Augmented Development Analytics Platform',
    environment: config.nodeEnv,
    timestamp: new Date().toISOString(),
    endpoints: {
      authentication: '/api/v1/auth',
      metrics: '/api/v1/metrics',
      analytics: '/api/v1/analytics',
      dashboards: '/api/v1/dashboards',
      tenants: '/api/v1/admin/tenants',
      hooks: '/api/v1/hooks',
      logs: '/api/v1/logs',
      otelValidation: '/api/v1/otel',
      validation: '/api/v1/validation',
      performance: '/api/v1/performance',
      health: '/health',
    },
    features: {
      authentication: 'JWT with refresh tokens',
      multiTenant: true,
      rateLimit: true,
      cors: true,
      compression: true,
      security: 'Helmet.js',
      validation: 'Joi schemas',
    },
    documentation: {
      openapi: '/api/v1/docs', // TODO: Add OpenAPI/Swagger docs
      postman: '/api/v1/postman', // TODO: Add Postman collection
    },
  }, 'Fortium Metrics Web Service API v1');
});

// Mount route modules
router.use('/auth', authRoutes);
router.use('/metrics', metricsRoutes);
router.use('/dashboards', dashboardRoutes);
router.use('/admin/tenants', tenantProvisioningRoutes);
router.use('/hooks', hooksRoutes);
// Temporary mock analytics endpoint for productivity trends
router.get('/analytics/productivity-trends', (req, res) => {
    const { start_date, end_date, comparison_period } = req.query;

    // Generate mock productivity trends data
    const mockData = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));

      return {
        date: date.toISOString().split('T')[0],
        productivity_score: Math.floor(Math.random() * 20) + 70, // 70-90
        total_activities: Math.floor(Math.random() * 50) + 20,
        success_rate: Math.floor(Math.random() * 20) + 80,
        avg_duration: Math.floor(Math.random() * 300) + 100
      };
    });

    res.success({
      data: mockData,
      meta: {
        start_date: start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        end_date: end_date || new Date().toISOString(),
        total_days: 30,
        average_score: Math.floor(mockData.reduce((sum, item) => sum + item.productivity_score, 0) / mockData.length),
        note: 'Mock data for development'
      }
    }, 'Productivity trends retrieved successfully (mock data)');
});
router.use('/activities', activitiesRoutes);
router.use('/logs', logsRoutes);
router.use('/otel', otelValidationRoutes);
router.use('/validation', parallelLoggingValidationRoutes);
router.use('/performance', performanceMonitoringRoutes);

// API health endpoint (specific to API routes)
router.get('/health', (req, res) => {
  res.success({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: process.uptime(),
    environment: config.nodeEnv,
    features: {
      authentication: true,
      metrics: true,
      dashboards: true,
      logs: true,
      database: true, // TODO: Add actual database health check
      cache: config.redis.url ? true : false,
    },
    endpoints: {
      total: router.stack.length,
      routes: [
        { path: '/auth', methods: ['POST', 'GET', 'PUT'] },
        { path: '/metrics', methods: ['GET', 'POST', 'DELETE'] },
        { path: '/dashboards', methods: ['GET', 'POST', 'PUT', 'DELETE'] },
        { path: '/logs', methods: ['POST', 'GET', 'DELETE'] },
      ],
    },
  }, 'API is healthy and operational');
});

// API documentation endpoints (placeholders)
router.get('/docs', (req, res) => {
  res.success({
    message: 'API documentation',
    openapi: '3.0.0',
    info: {
      title: 'Fortium External Metrics Web Service',
      version: '1.0.0',
      description: 'AI-Augmented Development Analytics Platform API',
    },
    // TODO: Add actual OpenAPI specification
    documentation: 'OpenAPI documentation will be available here',
    alternatives: {
      postman: '/api/v1/postman',
      insomnia: '/api/v1/insomnia',
    },
  }, 'API documentation endpoint');
});

router.get('/postman', (req, res) => {
  // TODO: Generate Postman collection
  res.success({
    collection: 'Fortium Metrics API Collection',
    version: '1.0.0',
    description: 'Postman collection for testing the Fortium Metrics API',
    // TODO: Add actual Postman collection JSON
    downloadUrl: '/api/v1/postman/download',
  }, 'Postman collection information');
});

// Route not found within API
router.use('*', (req, res) => {
  logger.warn('API route not found', {
    method: req.method,
    originalUrl: req.originalUrl,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.notFound(`API route ${req.method} ${req.originalUrl} not found`);
});


export default router;