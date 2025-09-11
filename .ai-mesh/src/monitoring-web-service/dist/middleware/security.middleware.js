"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ipFilterMiddleware = exports.securityHeadersMiddleware = exports.requestIdMiddleware = exports.configureTrustProxy = exports.authRateLimit = exports.createRateLimitMiddleware = exports.helmetMiddleware = void 0;
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const environment_1 = require("../config/environment");
const logger_1 = require("../config/logger");
exports.helmetMiddleware = (0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
        reportOnly: environment_1.config.isDevelopment,
    },
    crossOriginEmbedderPolicy: false,
    dnsPrefetchControl: { allow: false },
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: environment_1.config.isProduction ? {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
    } : false,
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: false,
    referrerPolicy: { policy: 'same-origin' },
    xssFilter: true,
});
const createRateLimitMiddleware = () => {
    return (0, express_rate_limit_1.default)({
        windowMs: environment_1.config.rateLimit.windowMs,
        max: environment_1.config.rateLimit.maxRequests,
        message: {
            error: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests from this IP, please try again later',
            statusCode: 429,
            timestamp: new Date().toISOString(),
        },
        standardHeaders: true,
        legacyHeaders: false,
        skipSuccessfulRequests: false,
        skipFailedRequests: false,
        keyGenerator: (req) => {
            const userId = req.user?.id;
            const tenantId = req.tenant?.id;
            if (userId && tenantId) {
                return `${req.ip}-${tenantId}-${userId}`;
            }
            return req.ip;
        },
        handler: (req, res) => {
            const userId = req.user?.id;
            const tenantId = req.tenant?.id;
            logger_1.loggers.security.rateLimit(req.ip, req.originalUrl, {
                userId,
                tenantId,
                userAgent: req.headers['user-agent'],
                method: req.method,
            });
            res.status(429).json({
                error: 'RATE_LIMIT_EXCEEDED',
                message: 'Too many requests from this IP, please try again later',
                statusCode: 429,
                timestamp: new Date().toISOString(),
                retryAfter: Math.round(environment_1.config.rateLimit.windowMs / 1000),
            });
        },
    });
};
exports.createRateLimitMiddleware = createRateLimitMiddleware;
exports.authRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: {
        error: 'AUTH_RATE_LIMIT_EXCEEDED',
        message: 'Too many authentication attempts, please try again later',
        statusCode: 429,
        timestamp: new Date().toISOString(),
    },
    skipSuccessfulRequests: true,
    keyGenerator: (req) => `auth-${req.ip}`,
});
const configureTrustProxy = (app) => {
    if (environment_1.config.server.trustProxy) {
        app.set('trust proxy', true);
        logger_1.logger.info('Trust proxy enabled');
    }
};
exports.configureTrustProxy = configureTrustProxy;
const requestIdMiddleware = (req, res, next) => {
    const requestId = req.headers['x-request-id'] ||
        `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    req.requestId = requestId;
    res.setHeader('X-Request-ID', requestId);
    next();
};
exports.requestIdMiddleware = requestIdMiddleware;
const securityHeadersMiddleware = (req, res, next) => {
    res.removeHeader('X-Powered-By');
    res.removeHeader('Server');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('X-API-Version', '1.0.0');
    next();
};
exports.securityHeadersMiddleware = securityHeadersMiddleware;
const ipFilterMiddleware = (req, res, next) => {
    const clientIp = req.ip;
    const forwardedFor = req.headers['x-forwarded-for'];
    if (environment_1.config.isDevelopment) {
        logger_1.logger.debug('Request IP info', {
            clientIp,
            forwardedFor,
            userAgent: req.headers['user-agent'],
            endpoint: req.originalUrl,
        });
    }
    next();
};
exports.ipFilterMiddleware = ipFilterMiddleware;
//# sourceMappingURL=security.middleware.js.map