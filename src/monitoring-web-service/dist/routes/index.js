"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const response_1 = require("../utils/response");
const logger_1 = require("../config/logger");
const environment_1 = require("../config/environment");
const auth_routes_1 = __importDefault(require("./auth.routes"));
const metrics_routes_1 = __importDefault(require("./metrics.routes"));
const dashboard_routes_1 = __importDefault(require("./dashboard.routes"));
const tenant_provisioning_routes_1 = __importDefault(require("./tenant-provisioning.routes"));
const router = (0, express_1.Router)();
router.use(response_1.responseMiddleware);
router.get('/', (req, res) => {
    res.success({
        service: 'Fortium External Metrics Web Service',
        version: '1.0.0',
        description: 'AI-Augmented Development Analytics Platform',
        environment: environment_1.config.nodeEnv,
        timestamp: new Date().toISOString(),
        endpoints: {
            authentication: '/api/v1/auth',
            metrics: '/api/v1/metrics',
            dashboards: '/api/v1/dashboards',
            tenants: '/api/v1/admin/tenants',
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
            openapi: '/api/v1/docs',
            postman: '/api/v1/postman',
        },
    }, 'Fortium Metrics Web Service API v1');
});
router.use('/auth', auth_routes_1.default);
router.use('/metrics', metrics_routes_1.default);
router.use('/dashboards', dashboard_routes_1.default);
router.use('/admin/tenants', tenant_provisioning_routes_1.default);
router.get('/health', (req, res) => {
    res.success({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        uptime: process.uptime(),
        environment: environment_1.config.nodeEnv,
        features: {
            authentication: true,
            metrics: true,
            dashboards: true,
            database: true,
            cache: environment_1.config.redis.url ? true : false,
        },
        endpoints: {
            total: router.stack.length,
            routes: [
                { path: '/auth', methods: ['POST', 'GET', 'PUT'] },
                { path: '/metrics', methods: ['GET', 'POST', 'DELETE'] },
                { path: '/dashboards', methods: ['GET', 'POST', 'PUT', 'DELETE'] },
            ],
        },
    }, 'API is healthy and operational');
});
router.get('/docs', (req, res) => {
    res.success({
        message: 'API documentation',
        openapi: '3.0.0',
        info: {
            title: 'Fortium External Metrics Web Service',
            version: '1.0.0',
            description: 'AI-Augmented Development Analytics Platform API',
        },
        documentation: 'OpenAPI documentation will be available here',
        alternatives: {
            postman: '/api/v1/postman',
            insomnia: '/api/v1/insomnia',
        },
    }, 'API documentation endpoint');
});
router.get('/postman', (req, res) => {
    res.success({
        collection: 'Fortium Metrics API Collection',
        version: '1.0.0',
        description: 'Postman collection for testing the Fortium Metrics API',
        downloadUrl: '/api/v1/postman/download',
    }, 'Postman collection information');
});
router.use('*', (req, res) => {
    logger_1.logger.warn('API route not found', {
        method: req.method,
        originalUrl: req.originalUrl,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
    });
    res.notFound(`API route ${req.method} ${req.originalUrl} not found`);
});
exports.default = router;
//# sourceMappingURL=index.js.map