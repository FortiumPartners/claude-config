/**
 * Environment Configuration Management
 * Fortium External Metrics Web Service - Task 1.6: Express.js Server Foundation
 */

import joi from 'joi';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Environment validation schema
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
    
  // Database
  DATABASE_URL: joi.string()
    .pattern(/^(postgresql:\/\/|file:)/)
    .required(),
    
  // JWT Configuration
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
    
  // Redis Configuration (optional)
  REDIS_URL: joi.string()
    .uri({ scheme: ['redis', 'rediss'] })
    .allow('')
    .optional(),
    
  // CORS Configuration
  CORS_ORIGIN: joi.alternatives()
    .try(
      joi.string(),
      joi.array().items(joi.string()),
      joi.boolean()
    )
    .default(true),
    
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: joi.number()
    .integer()
    .min(1000)
    .default(15 * 60 * 1000), // 15 minutes
    
  RATE_LIMIT_MAX_REQUESTS: joi.number()
    .integer()
    .min(1)
    .default(100),
    
  // Server Configuration
  SERVER_TIMEOUT: joi.number()
    .integer()
    .min(1000)
    .default(30000), // 30 seconds
    
  SERVER_KEEP_ALIVE_TIMEOUT: joi.number()
    .integer()
    .min(1000)
    .default(5000), // 5 seconds
    
  SERVER_SHUTDOWN_TIMEOUT: joi.number()
    .integer()
    .min(1000)
    .default(10000), // 10 seconds

  // Security Headers
  TRUST_PROXY: joi.boolean()
    .default(false),
    
  // Compression
  COMPRESSION_LEVEL: joi.number()
    .integer()
    .min(-1)
    .max(9)
    .default(6),
    
  // Body Parser Limits
  BODY_LIMIT: joi.string()
    .default('10mb'),
    
  // Multi-tenant Configuration
  TENANT_HEADER: joi.string()
    .default('x-tenant-id'),
    
  // Health Check
  HEALTH_CHECK_PATH: joi.string()
    .default('/health'),
    
  // Seq Logging Configuration
  SEQ_SERVER_URL: joi.string()
    .uri()
    .default('http://localhost:5341'),
    
  SEQ_API_KEY: joi.string()
    .optional()
    .allow(''),
    
  SEQ_BATCH_SIZE: joi.number()
    .integer()
    .min(1)
    .max(1000)
    .default(100),
    
  SEQ_FLUSH_INTERVAL: joi.number()
    .integer()
    .min(1000)
    .default(30000), // 30 seconds
    
  SEQ_REQUEST_TIMEOUT: joi.number()
    .integer()
    .min(1000)
    .default(10000), // 10 seconds
    
  SEQ_ENABLE_TLS: joi.boolean()
    .default(false),

  // Log Ingestion API Configuration
  LOG_INGESTION_RATE_LIMIT_WINDOW: joi.number()
    .integer()
    .min(1000)
    .default(60 * 1000), // 1 minute
    
  LOG_INGESTION_RATE_LIMIT_MAX: joi.number()
    .integer()
    .min(1)
    .default(1000), // 1000 requests per minute
    
  LOG_MAX_ENTRIES_PER_BATCH: joi.number()
    .integer()
    .min(1)
    .max(1000)
    .default(100),
    
  LOG_MAX_BATCH_SIZE_MB: joi.number()
    .integer()
    .min(1)
    .max(50)
    .default(5),
});

// Validate environment variables
const { error, value: envVars } = envSchema.validate(process.env, {
  allowUnknown: true,
  stripUnknown: true,
});

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

// Export configuration object
export const config = {
  nodeEnv: envVars.NODE_ENV as 'development' | 'production' | 'test' | 'staging',
  port: envVars.PORT as number,
  
  // Logging
  log: {
    level: envVars.LOG_LEVEL as 'error' | 'warn' | 'info' | 'debug',
  },
  
  // Database
  database: {
    url: envVars.DATABASE_URL as string,
  },
  
  // JWT
  jwt: {
    secret: envVars.JWT_SECRET as string,
    refreshSecret: envVars.JWT_REFRESH_SECRET as string,
    expiresIn: envVars.JWT_EXPIRES_IN as string,
    refreshExpiresIn: envVars.JWT_REFRESH_EXPIRES_IN as string,
  },
  
  // Redis
  redis: {
    url: envVars.REDIS_URL as string | undefined,
  },
  
  // CORS
  cors: {
    origin: typeof envVars.CORS_ORIGIN === 'string' && envVars.CORS_ORIGIN.includes(',')
      ? envVars.CORS_ORIGIN.split(',').map(s => s.trim())
      : envVars.CORS_ORIGIN,
  },
  
  // Rate Limiting
  rateLimit: {
    windowMs: envVars.RATE_LIMIT_WINDOW_MS as number,
    maxRequests: envVars.RATE_LIMIT_MAX_REQUESTS as number,
  },
  
  // Server
  server: {
    timeout: envVars.SERVER_TIMEOUT as number,
    keepAliveTimeout: envVars.SERVER_KEEP_ALIVE_TIMEOUT as number,
    shutdownTimeout: envVars.SERVER_SHUTDOWN_TIMEOUT as number,
    trustProxy: envVars.TRUST_PROXY as boolean,
  },
  
  // Compression
  compression: {
    level: envVars.COMPRESSION_LEVEL as number,
  },
  
  // Body Parser
  bodyParser: {
    limit: envVars.BODY_LIMIT as string,
  },
  
  // Multi-tenant
  multiTenant: {
    header: envVars.TENANT_HEADER as string,
  },
  
  // Health Check
  healthCheck: {
    path: envVars.HEALTH_CHECK_PATH as string,
  },
  
  // Seq Logging
  seq: {
    serverUrl: envVars.SEQ_SERVER_URL as string,
    apiKey: envVars.SEQ_API_KEY as string | undefined,
    batchSize: envVars.SEQ_BATCH_SIZE as number,
    flushInterval: envVars.SEQ_FLUSH_INTERVAL as number,
    requestTimeout: envVars.SEQ_REQUEST_TIMEOUT as number,
    enableTls: envVars.SEQ_ENABLE_TLS as boolean,
  },
  
  // Log Ingestion API
  logIngestion: {
    rateLimit: {
      windowMs: envVars.LOG_INGESTION_RATE_LIMIT_WINDOW as number,
      maxRequests: envVars.LOG_INGESTION_RATE_LIMIT_MAX as number,
    },
    limits: {
      maxEntriesPerBatch: envVars.LOG_MAX_ENTRIES_PER_BATCH as number,
      maxBatchSizeMB: envVars.LOG_MAX_BATCH_SIZE_MB as number,
    },
  },
  
  // Environment helpers
  isDevelopment: envVars.NODE_ENV === 'development',
  isProduction: envVars.NODE_ENV === 'production',
  isTest: envVars.NODE_ENV === 'test',
  isStaging: envVars.NODE_ENV === 'staging',
} as const;

// Type for configuration
export type Config = typeof config;