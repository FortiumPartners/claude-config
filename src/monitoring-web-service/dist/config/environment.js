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
exports.config = void 0;
const joi = __importStar(require("joi"));
const envSchema = joi.object({
    NODE_ENV: joi.string()
        .valid('development', 'production', 'test', 'staging')
        .default('development'),
    PORT: joi.number()
        .integer()
        .min(1000)
        .max(65535)
        .default(3000),
    LOG_LEVEL: joi.string()
        .valid('error', 'warn', 'info', 'debug')
        .default('info'),
    DATABASE_URL: joi.string()
        .uri({ scheme: 'postgresql' })
        .required(),
    JWT_SECRET: joi.string()
        .min(32)
        .required(),
    JWT_REFRESH_SECRET: joi.string()
        .min(32)
        .required(),
    JWT_EXPIRES_IN: joi.string()
        .default('15m'),
    JWT_REFRESH_EXPIRES_IN: joi.string()
        .default('7d'),
    REDIS_URL: joi.string()
        .uri({ scheme: ['redis', 'rediss'] })
        .optional(),
    CORS_ORIGIN: joi.alternatives()
        .try(joi.string().uri(), joi.array().items(joi.string().uri()), joi.boolean())
        .default(true),
    RATE_LIMIT_WINDOW_MS: joi.number()
        .integer()
        .min(1000)
        .default(15 * 60 * 1000),
    RATE_LIMIT_MAX_REQUESTS: joi.number()
        .integer()
        .min(1)
        .default(100),
    SERVER_TIMEOUT: joi.number()
        .integer()
        .min(1000)
        .default(30000),
    SERVER_KEEP_ALIVE_TIMEOUT: joi.number()
        .integer()
        .min(1000)
        .default(5000),
    SERVER_SHUTDOWN_TIMEOUT: joi.number()
        .integer()
        .min(1000)
        .default(10000),
    TRUST_PROXY: joi.boolean()
        .default(false),
    COMPRESSION_LEVEL: joi.number()
        .integer()
        .min(-1)
        .max(9)
        .default(6),
    BODY_LIMIT: joi.string()
        .default('10mb'),
    TENANT_HEADER: joi.string()
        .default('x-tenant-id'),
    HEALTH_CHECK_PATH: joi.string()
        .default('/health'),
});
const { error, value: envVars } = envSchema.validate(process.env, {
    allowUnknown: true,
    stripUnknown: true,
});
if (error) {
    throw new Error(`Config validation error: ${error.message}`);
}
exports.config = {
    nodeEnv: envVars.NODE_ENV,
    port: envVars.PORT,
    log: {
        level: envVars.LOG_LEVEL,
    },
    database: {
        url: envVars.DATABASE_URL,
    },
    jwt: {
        secret: envVars.JWT_SECRET,
        refreshSecret: envVars.JWT_REFRESH_SECRET,
        expiresIn: envVars.JWT_EXPIRES_IN,
        refreshExpiresIn: envVars.JWT_REFRESH_EXPIRES_IN,
    },
    redis: {
        url: envVars.REDIS_URL,
    },
    cors: {
        origin: envVars.CORS_ORIGIN,
    },
    rateLimit: {
        windowMs: envVars.RATE_LIMIT_WINDOW_MS,
        maxRequests: envVars.RATE_LIMIT_MAX_REQUESTS,
    },
    server: {
        timeout: envVars.SERVER_TIMEOUT,
        keepAliveTimeout: envVars.SERVER_KEEP_ALIVE_TIMEOUT,
        shutdownTimeout: envVars.SERVER_SHUTDOWN_TIMEOUT,
        trustProxy: envVars.TRUST_PROXY,
    },
    compression: {
        level: envVars.COMPRESSION_LEVEL,
    },
    bodyParser: {
        limit: envVars.BODY_LIMIT,
    },
    multiTenant: {
        header: envVars.TENANT_HEADER,
    },
    healthCheck: {
        path: envVars.HEALTH_CHECK_PATH,
    },
    isDevelopment: envVars.NODE_ENV === 'development',
    isProduction: envVars.NODE_ENV === 'production',
    isTest: envVars.NODE_ENV === 'test',
    isStaging: envVars.NODE_ENV === 'staging',
};
//# sourceMappingURL=environment.js.map