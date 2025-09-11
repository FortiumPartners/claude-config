/**
 * HTTP Logging Middleware
 * Fortium External Metrics Web Service - Task 1.6: Express.js Server Foundation
 */

import morgan from 'morgan';
import { Request, Response } from 'express';
import { logger, loggers } from '../config/logger';
import { config } from '../config/environment';

// Custom token for request ID
morgan.token('requestId', (req: Request) => {
  return (req as any).requestId || 'unknown';
});

// Custom token for user ID
morgan.token('userId', (req: Request) => {
  return (req as any).user?.id || 'anonymous';
});

// Custom token for tenant ID
morgan.token('tenantId', (req: Request) => {
  return (req as any).tenant?.id || 'unknown';
});

// Custom token for response time in milliseconds
morgan.token('responseTimeMs', (req: Request, res: Response) => {
  const responseTime = res.getHeader('X-Response-Time');
  return responseTime ? `${responseTime}ms` : '0ms';
});

// Development format - more verbose
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

// Production format - structured for log parsing
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

// Create HTTP logging middleware
export const httpLoggingMiddleware = morgan(
  config.isDevelopment ? developmentFormat : productionFormat,
  {
    stream: {
      write: (message: string) => {
        // Remove trailing newline
        const cleanMessage = message.trim();
        
        try {
          // Try to parse as JSON (production format)
          const logData = JSON.parse(cleanMessage);
          
          // Extract status code for log level determination
          const status = parseInt(logData.status);
          
          if (status >= 500) {
            logger.error('HTTP Request', logData);
          } else if (status >= 400) {
            logger.warn('HTTP Request', logData);
          } else {
            logger.info('HTTP Request', logData);
          }
        } catch {
          // Fallback for development format
          logger.info(cleanMessage);
        }
      },
    },
    
    // Skip logging for certain conditions
    skip: (req: Request, res: Response) => {
      // Skip health check requests in production
      if (config.isProduction && req.originalUrl === config.healthCheck.path) {
        return true;
      }
      
      // Skip static assets in development
      if (config.isDevelopment && req.originalUrl.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg)$/)) {
        return true;
      }
      
      return false;
    },
  }
);

// Response time middleware
export const responseTimeMiddleware = (req: Request, res: Response, next: any) => {
  const start = Date.now();
  
  // Set response time header before processing
  res.on('close', () => {
    const duration = Date.now() - start;
    
    // Log slow requests (don't try to set headers after response is sent)
    if (duration > 1000) { // More than 1 second
      loggers.performance.slowRequest(req.method, req.originalUrl, duration, {
        requestId: (req as any).requestId,
        userId: (req as any).user?.id,
        tenantId: (req as any).tenant?.id,
      });
    }
  });
  
  next();
};

// Request logging middleware for structured application logs
export const requestLoggingMiddleware = (req: Request, res: Response, next: any) => {
  const userId = (req as any).user?.id;
  const tenantId = (req as any).tenant?.id;
  const requestId = (req as any).requestId;

  // Log API request
  loggers.api.request(req.method, req.originalUrl, userId, tenantId, {
    requestId,
    userAgent: req.headers['user-agent'],
    ip: req.ip,
    contentType: req.headers['content-type'],
    contentLength: req.headers['content-length'],
  });

  next();
};

// Skip logging middleware for specific routes
export const skipLoggingMiddleware = (req: Request, res: Response, next: any) => {
  // Mark request to skip logging
  (req as any).skipLogging = true;
  next();
};

// Error request logging
export const errorRequestLogging = (error: any, req: Request, res: Response, next: any) => {
  const userId = (req as any).user?.id;
  const tenantId = (req as any).tenant?.id;
  const requestId = (req as any).requestId;

  loggers.api.error(req.method, req.originalUrl, error, userId, tenantId, {
    requestId,
    userAgent: req.headers['user-agent'],
    ip: req.ip,
    body: config.isDevelopment ? req.body : undefined,
  });

  next(error);
};