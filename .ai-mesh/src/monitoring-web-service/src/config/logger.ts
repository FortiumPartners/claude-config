/**
 * Logging Configuration
 * Fortium External Metrics Web Service - Task 1.6: Express.js Server Foundation
 */

import * as winston from 'winston';
import { config } from './environment';
import { createSeqTransport, seqTransportConfig } from './seq-transport';

// Define custom log levels
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

// Add colors to winston
winston.addColors(customLevels.colors);

// Custom format for development
const developmentFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize(),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...meta } = info;
    let metaString = '';
    
    if (Object.keys(meta).length > 0) {
      metaString = `\n${JSON.stringify(meta, null, 2)}`;
    }
    
    return `${timestamp} [${level}]: ${message}${metaString}`;
  })
);

// Custom format for production
const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf((info) => {
    // Add service metadata
    return JSON.stringify({
      ...info,
      service: 'fortium-metrics-web-service',
      environment: config.nodeEnv,
    });
  })
);

// Create transports array
const transports: winston.transport[] = [
  // Console transport
  new winston.transports.Console({
    handleExceptions: true,
    handleRejections: true,
  }),
];

// Add Seq transport if enabled (development and production)
if (!config.isTest) {
  try {
    const seqConfig = config.isDevelopment 
      ? seqTransportConfig.development 
      : seqTransportConfig.production;
    
    const seqTransport = createSeqTransport({
      ...seqConfig,
      serverUrl: config.seq.serverUrl,
      apiKey: config.seq.apiKey,
      maxBatchingSize: config.seq.batchSize,
      batchingDelay: config.seq.flushInterval,
      requestTimeout: config.seq.requestTimeout,
      onError: (error: Error) => {
        console.error('[Seq Transport Error]:', error.message);
      },
    });
    
    transports.push(seqTransport);
  } catch (error) {
    console.warn('[Logger] Failed to initialize Seq transport:', (error as Error).message);
  }
}

// Create logger instance
export const logger = winston.createLogger({
  level: config.log.level,
  levels: customLevels.levels,
  format: config.isDevelopment ? developmentFormat : productionFormat,
  defaultMeta: {
    service: 'fortium-metrics-web-service',
    environment: config.nodeEnv,
  },
  transports,
  exitOnError: false,
});

// Add file transport for production
if (config.isProduction) {
  // Error log file
  logger.add(new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    maxsize: 10485760, // 10MB
    maxFiles: 5,
    tailable: true,
  }));

  // Combined log file
  logger.add(new winston.transports.File({
    filename: 'logs/combined.log',
    maxsize: 10485760, // 10MB
    maxFiles: 5,
    tailable: true,
  }));
}

// Create stream for Morgan HTTP logging
export const httpLogStream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};

// Seq-specific logging utilities
export interface LogContext {
  correlationId?: string;
  sessionId?: string;
  userId?: string;
  tenantId?: string;
  traceId?: string;
  spanId?: string;
  requestId?: string;
  operationName?: string;
  parentSpanId?: string;
}

/**
 * Create a child logger with correlation context
 */
export function createContextualLogger(context: LogContext): winston.Logger {
  return logger.child(context);
}

/**
 * Log with structured format optimized for Seq
 */
export function logWithContext(
  level: 'error' | 'warn' | 'info' | 'debug',
  message: string,
  context?: LogContext,
  properties?: Record<string, any>
): void {
  logger.log(level, message, {
    ...context,
    ...properties,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Get Seq transport health status
 */
export async function getSeqHealth(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy' | 'disabled';
  latency?: number;
  error?: string;
}> {
  const seqTransport = transports.find(t => t.constructor.name === 'SeqTransport');
  
  if (!seqTransport) {
    return { status: 'disabled' };
  }
  
  if (typeof (seqTransport as any).healthCheck === 'function') {
    return await (seqTransport as any).healthCheck();
  }
  
  return { status: 'healthy' };
}

/**
 * Get Seq transport metrics
 */
export function getSeqMetrics(): any {
  const seqTransport = transports.find(t => t.constructor.name === 'SeqTransport');
  
  if (!seqTransport || typeof (seqTransport as any).getMetrics !== 'function') {
    return null;
  }
  
  return (seqTransport as any).getMetrics();
}

// Helper functions for structured logging with correlation ID support
export const loggers = {
  // Authentication events
  auth: {
    login: (userId: string, tenantId: string, metadata?: Record<string, any>) => {
      logger.info('User login successful', {
        userId,
        tenantId,
        event: 'auth.login',
        correlationId: metadata?.correlationId,
        ...metadata,
      });
    },
    loginFailed: (email: string, reason: string, metadata?: Record<string, any>) => {
      logger.warn('User login failed', {
        email,
        reason,
        event: 'auth.login_failed',
        correlationId: metadata?.correlationId,
        ...metadata,
      });
    },
    logout: (userId: string, tenantId: string, metadata?: Record<string, any>) => {
      logger.info('User logout', {
        userId,
        tenantId,
        event: 'auth.logout',
        correlationId: metadata?.correlationId,
        ...metadata,
      });
    },
    tokenRefresh: (userId: string, tenantId: string, metadata?: Record<string, any>) => {
      logger.info('Token refresh', {
        userId,
        tenantId,
        event: 'auth.token_refresh',
        correlationId: metadata?.correlationId,
        ...metadata,
      });
    },
    authorizationFailed: (userId: string, tenantId: string, reason: string, metadata?: Record<string, any>) => {
      logger.warn('Authorization failed', {
        userId,
        tenantId,
        reason,
        event: 'auth.authorization_failed',
        correlationId: metadata?.correlationId,
        ...metadata,
      });
    },
  },

  // API request events  
  api: {
    request: (method: string, path: string, userId?: string, tenantId?: string, metadata?: Record<string, any>) => {
      logger.info('API request', {
        method,
        path,
        userId,
        tenantId,
        event: 'api.request',
        correlationId: metadata?.correlationId,
        ...metadata,
      });
    },
    error: (method: string, path: string, error: Error, userId?: string, tenantId?: string, metadata?: Record<string, any>) => {
      logger.error('API error', {
        method,
        path,
        error: error.message,
        stack: error.stack,
        userId,
        tenantId,
        event: 'api.error',
        correlationId: metadata?.correlationId,
        ...metadata,
      });
    },
  },

  // Database events
  database: {
    query: (query: string, duration: number, metadata?: Record<string, any>) => {
      logger.debug('Database query', {
        query,
        duration,
        event: 'database.query',
        ...metadata,
      });
    },
    error: (error: Error, query?: string, metadata?: Record<string, any>) => {
      logger.error('Database error', {
        error: error.message,
        stack: error.stack,
        query,
        event: 'database.error',
        ...metadata,
      });
    },
  },

  // Security events
  security: {
    suspiciousActivity: (event: string, userId?: string, tenantId?: string, metadata?: Record<string, any>) => {
      logger.warn('Suspicious activity detected', {
        event,
        userId,
        tenantId,
        eventType: 'security.suspicious_activity',
        ...metadata,
      });
    },
    rateLimit: (ip: string, endpoint: string, metadata?: Record<string, any>) => {
      logger.warn('Rate limit exceeded', {
        ip,
        endpoint,
        event: 'security.rate_limit_exceeded',
        ...metadata,
      });
    },
  },

  // Performance events
  performance: {
    slowQuery: (query: string, duration: number, metadata?: Record<string, any>) => {
      logger.warn('Slow database query', {
        query,
        duration,
        event: 'performance.slow_query',
        ...metadata,
      });
    },
    slowRequest: (method: string, path: string, duration: number, metadata?: Record<string, any>) => {
      logger.warn('Slow API request', {
        method,
        path,
        duration,
        event: 'performance.slow_request',
        ...metadata,
      });
    },
  },
};