"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.corsErrorHandler = exports.corsMiddleware = void 0;
const cors_1 = __importDefault(require("cors"));
const environment_1 = require("../config/environment");
const logger_1 = require("../config/logger");
const corsOptions = {
    origin: (origin, callback) => {
        if (!origin) {
            return callback(null, true);
        }
        if (environment_1.config.isDevelopment) {
            return callback(null, true);
        }
        if (typeof environment_1.config.cors.origin === 'boolean') {
            return callback(null, environment_1.config.cors.origin);
        }
        if (typeof environment_1.config.cors.origin === 'string') {
            return callback(null, origin === environment_1.config.cors.origin);
        }
        if (Array.isArray(environment_1.config.cors.origin)) {
            if (environment_1.config.cors.origin.includes(origin)) {
                return callback(null, true);
            }
            else {
                logger_1.logger.warn('CORS origin rejected', {
                    origin,
                    allowedOrigins: environment_1.config.cors.origin
                });
                return callback(new Error('Not allowed by CORS'));
            }
        }
        return callback(new Error('CORS configuration error'));
    },
    credentials: true,
    methods: [
        'GET',
        'POST',
        'PUT',
        'PATCH',
        'DELETE',
        'OPTIONS',
        'HEAD',
    ],
    allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'Cache-Control',
        'X-Tenant-ID',
        'X-Request-ID',
        'X-API-Version',
    ],
    exposedHeaders: [
        'X-Total-Count',
        'X-Page-Count',
        'X-Current-Page',
        'X-Per-Page',
        'X-Request-ID',
        'X-Rate-Limit-Remaining',
        'X-Rate-Limit-Reset',
    ],
    maxAge: environment_1.config.isDevelopment ? 3600 : 86400,
    preflightContinue: false,
    optionsSuccessStatus: 204,
};
exports.corsMiddleware = (0, cors_1.default)(corsOptions);
const corsErrorHandler = (error, req, res, next) => {
    if (error.message === 'Not allowed by CORS') {
        logger_1.logger.warn('CORS violation attempt', {
            origin: req.headers.origin,
            userAgent: req.headers['user-agent'],
            ip: req.ip,
            method: req.method,
            path: req.path,
        });
        return res.status(403).json({
            error: 'CORS_ERROR',
            message: 'Cross-Origin Request Blocked',
            statusCode: 403,
            timestamp: new Date().toISOString(),
        });
    }
    next(error);
};
exports.corsErrorHandler = corsErrorHandler;
//# sourceMappingURL=cors.middleware.js.map