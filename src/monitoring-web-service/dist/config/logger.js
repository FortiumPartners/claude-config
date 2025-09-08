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
Object.defineProperty(exports, "__esModule", { value: true });
exports.loggers = exports.httpLogStream = exports.logger = void 0;
const winston = __importStar(require("winston"));
const environment_1 = require("./environment");
const customLevels = {
    levels: {
        error: 0,
        warn: 1,
        info: 2,
        debug: 3,
    },
    colors: {
        error: 'red',
        warn: 'yellow',
        info: 'green',
        debug: 'blue',
    },
};
winston.addColors(customLevels.colors);
const developmentFormat = winston.format.combine(winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston.format.errors({ stack: true }), winston.format.colorize(), winston.format.printf((info) => {
    const { timestamp, level, message, ...meta } = info;
    let metaString = '';
    if (Object.keys(meta).length > 0) {
        metaString = `\n${JSON.stringify(meta, null, 2)}`;
    }
    return `${timestamp} [${level}]: ${message}${metaString}`;
}));
const productionFormat = winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json(), winston.format.printf((info) => {
    return JSON.stringify({
        ...info,
        service: 'fortium-metrics-web-service',
        environment: environment_1.config.nodeEnv,
    });
}));
exports.logger = winston.createLogger({
    level: environment_1.config.log.level,
    levels: customLevels.levels,
    format: environment_1.config.isDevelopment ? developmentFormat : productionFormat,
    defaultMeta: {
        service: 'fortium-metrics-web-service',
        environment: environment_1.config.nodeEnv,
    },
    transports: [
        new winston.transports.Console({
            handleExceptions: true,
            handleRejections: true,
        }),
    ],
    exitOnError: false,
});
if (environment_1.config.isProduction) {
    exports.logger.add(new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        maxsize: 10485760,
        maxFiles: 5,
        tailable: true,
    }));
    exports.logger.add(new winston.transports.File({
        filename: 'logs/combined.log',
        maxsize: 10485760,
        maxFiles: 5,
        tailable: true,
    }));
}
exports.httpLogStream = {
    write: (message) => {
        exports.logger.info(message.trim());
    },
};
exports.loggers = {
    auth: {
        login: (userId, tenantId, metadata) => {
            exports.logger.info('User login successful', {
                userId,
                tenantId,
                event: 'auth.login',
                ...metadata,
            });
        },
        loginFailed: (email, reason, metadata) => {
            exports.logger.warn('User login failed', {
                email,
                reason,
                event: 'auth.login_failed',
                ...metadata,
            });
        },
        logout: (userId, tenantId, metadata) => {
            exports.logger.info('User logout', {
                userId,
                tenantId,
                event: 'auth.logout',
                ...metadata,
            });
        },
        tokenRefresh: (userId, tenantId, metadata) => {
            exports.logger.info('Token refresh', {
                userId,
                tenantId,
                event: 'auth.token_refresh',
                ...metadata,
            });
        },
    },
    api: {
        request: (method, path, userId, tenantId, metadata) => {
            exports.logger.info('API request', {
                method,
                path,
                userId,
                tenantId,
                event: 'api.request',
                ...metadata,
            });
        },
        error: (method, path, error, userId, tenantId, metadata) => {
            exports.logger.error('API error', {
                method,
                path,
                error: error.message,
                stack: error.stack,
                userId,
                tenantId,
                event: 'api.error',
                ...metadata,
            });
        },
    },
    database: {
        query: (query, duration, metadata) => {
            exports.logger.debug('Database query', {
                query,
                duration,
                event: 'database.query',
                ...metadata,
            });
        },
        error: (error, query, metadata) => {
            exports.logger.error('Database error', {
                error: error.message,
                stack: error.stack,
                query,
                event: 'database.error',
                ...metadata,
            });
        },
    },
    security: {
        suspiciousActivity: (event, userId, tenantId, metadata) => {
            exports.logger.warn('Suspicious activity detected', {
                event,
                userId,
                tenantId,
                eventType: 'security.suspicious_activity',
                ...metadata,
            });
        },
        rateLimit: (ip, endpoint, metadata) => {
            exports.logger.warn('Rate limit exceeded', {
                ip,
                endpoint,
                event: 'security.rate_limit_exceeded',
                ...metadata,
            });
        },
    },
    performance: {
        slowQuery: (query, duration, metadata) => {
            exports.logger.warn('Slow database query', {
                query,
                duration,
                event: 'performance.slow_query',
                ...metadata,
            });
        },
        slowRequest: (method, path, duration, metadata) => {
            exports.logger.warn('Slow API request', {
                method,
                path,
                duration,
                event: 'performance.slow_request',
                ...metadata,
            });
        },
    },
};
//# sourceMappingURL=logger.js.map