"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorRequestLogging = exports.skipLoggingMiddleware = exports.requestLoggingMiddleware = exports.responseTimeMiddleware = exports.httpLoggingMiddleware = void 0;
const morgan_1 = __importDefault(require("morgan"));
const logger_1 = require("../config/logger");
const environment_1 = require("../config/environment");
morgan_1.default.token('requestId', (req) => {
    return req.requestId || 'unknown';
});
morgan_1.default.token('userId', (req) => {
    return req.user?.id || 'anonymous';
});
morgan_1.default.token('tenantId', (req) => {
    return req.tenant?.id || 'unknown';
});
morgan_1.default.token('responseTimeMs', (req, res) => {
    const responseTime = res.getHeader('X-Response-Time');
    return responseTime ? `${responseTime}ms` : '0ms';
});
const developmentFormat = [
    ':method',
    ':url',
    ':status',
    ':res[content-length]',
    '-',
    ':response-time ms',
    '[:requestId]',
    '[:userId]',
    '[:tenantId]'
].join(' ');
const productionFormat = JSON.stringify({
    method: ':method',
    url: ':url',
    status: ':status',
    contentLength: ':res[content-length]',
    responseTime: ':response-time',
    requestId: ':requestId',
    userId: ':userId',
    tenantId: ':tenantId',
    userAgent: ':user-agent',
    ip: ':remote-addr',
    timestamp: ':date[iso]'
});
exports.httpLoggingMiddleware = (0, morgan_1.default)(environment_1.config.isDevelopment ? developmentFormat : productionFormat, {
    stream: {
        write: (message) => {
            const cleanMessage = message.trim();
            try {
                const logData = JSON.parse(cleanMessage);
                const status = parseInt(logData.status);
                if (status >= 500) {
                    logger_1.logger.error('HTTP Request', logData);
                }
                else if (status >= 400) {
                    logger_1.logger.warn('HTTP Request', logData);
                }
                else {
                    logger_1.logger.info('HTTP Request', logData);
                }
            }
            catch {
                logger_1.logger.info(cleanMessage);
            }
        },
    },
    skip: (req, res) => {
        if (environment_1.config.isProduction && req.originalUrl === environment_1.config.healthCheck.path) {
            return true;
        }
        if (environment_1.config.isDevelopment && req.originalUrl.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg)$/)) {
            return true;
        }
        return false;
    },
});
const responseTimeMiddleware = (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        res.setHeader('X-Response-Time', duration);
        if (duration > 1000) {
            logger_1.loggers.performance.slowRequest(req.method, req.originalUrl, duration, {
                requestId: req.requestId,
                userId: req.user?.id,
                tenantId: req.tenant?.id,
            });
        }
    });
    next();
};
exports.responseTimeMiddleware = responseTimeMiddleware;
const requestLoggingMiddleware = (req, res, next) => {
    const userId = req.user?.id;
    const tenantId = req.tenant?.id;
    const requestId = req.requestId;
    logger_1.loggers.api.request(req.method, req.originalUrl, userId, tenantId, {
        requestId,
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        contentType: req.headers['content-type'],
        contentLength: req.headers['content-length'],
    });
    next();
};
exports.requestLoggingMiddleware = requestLoggingMiddleware;
const skipLoggingMiddleware = (req, res, next) => {
    req.skipLogging = true;
    next();
};
exports.skipLoggingMiddleware = skipLoggingMiddleware;
const errorRequestLogging = (error, req, res, next) => {
    const userId = req.user?.id;
    const tenantId = req.tenant?.id;
    const requestId = req.requestId;
    logger_1.loggers.api.error(req.method, req.originalUrl, error, userId, tenantId, {
        requestId,
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        body: environment_1.config.isDevelopment ? req.body : undefined,
    });
    next(error);
};
exports.errorRequestLogging = errorRequestLogging;
//# sourceMappingURL=logging.middleware.js.map