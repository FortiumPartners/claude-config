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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
exports.createAppWithMcp = createApp;
const express_1 = __importDefault(require("express"));
const environment_1 = require("./config/environment");
const logger_1 = require("./config/logger");
const cors_middleware_1 = require("./middleware/cors.middleware");
const security_middleware_1 = require("./middleware/security.middleware");
const compression_middleware_1 = require("./middleware/compression.middleware");
const logging_middleware_1 = require("./middleware/logging.middleware");
const error_middleware_1 = require("./middleware/error.middleware");
const multi_tenant_middleware_1 = require("./middleware/multi-tenant.middleware");
async function createApp() {
    const app = (0, express_1.default)();
    (0, security_middleware_1.configureTrustProxy)(app);
    app.use(security_middleware_1.requestIdMiddleware);
    app.use(security_middleware_1.securityHeadersMiddleware);
    app.use(security_middleware_1.ipFilterMiddleware);
    app.use(security_middleware_1.helmetMiddleware);
    app.use(cors_middleware_1.corsMiddleware);
    app.use(cors_middleware_1.corsErrorHandler);
    app.use(logging_middleware_1.responseTimeMiddleware);
    app.use(logging_middleware_1.httpLoggingMiddleware);
    app.use(logging_middleware_1.requestLoggingMiddleware);
    app.use(express_1.default.json({
        limit: environment_1.config.bodyParser.limit,
        strict: true,
    }));
    app.use(express_1.default.urlencoded({
        extended: true,
        limit: environment_1.config.bodyParser.limit,
    }));
    app.use(compression_middleware_1.compressionMiddleware);
    const rateLimitMiddleware = (0, security_middleware_1.createRateLimitMiddleware)();
    app.use(rateLimitMiddleware);
    app.get(environment_1.config.healthCheck.path, (req, res) => {
        res.status(200).json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: environment_1.config.nodeEnv,
            version: '1.0.0',
            services: {
                database: 'connected',
                redis: environment_1.config.redis.url ? 'connected' : 'not_configured',
            },
        });
    });
    app.get('/api', (req, res) => {
        res.json({
            name: 'Fortium External Metrics Web Service',
            version: '1.0.0',
            description: 'AI-Augmented Development Analytics Platform',
            environment: environment_1.config.nodeEnv,
            endpoints: {
                health: environment_1.config.healthCheck.path,
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
    app.use('/api/v1', (0, multi_tenant_middleware_1.minimalMultiTenantChain)());
    const routes = await Promise.resolve().then(() => __importStar(require('./routes')));
    app.use('/api/v1', routes.default);
    app.use(error_middleware_1.notFoundMiddleware);
    app.use(error_middleware_1.errorMiddleware);
    logger_1.logger.info('Express application configured successfully', {
        environment: environment_1.config.nodeEnv,
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
//# sourceMappingURL=app.js.map