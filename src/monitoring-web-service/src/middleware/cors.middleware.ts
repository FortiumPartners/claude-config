/**
 * CORS Middleware Configuration
 * Fortium External Metrics Web Service - Task 1.6: Express.js Server Foundation
 */

import cors from 'cors';
import { config } from '../config/environment';
import { logger } from '../config/logger';

// CORS configuration options
const corsOptions: cors.CorsOptions = {
  // Origin configuration based on environment
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) {
      return callback(null, true);
    }

    // In development, allow all origins
    if (config.isDevelopment) {
      return callback(null, true);
    }

    // In production, use configured origins
    if (typeof config.cors.origin === 'boolean') {
      return callback(null, config.cors.origin);
    }

    if (typeof config.cors.origin === 'string') {
      return callback(null, origin === config.cors.origin);
    }

    if (Array.isArray(config.cors.origin)) {
      if (config.cors.origin.includes(origin)) {
        return callback(null, true);
      } else {
        logger.warn('CORS origin rejected', { 
          origin, 
          allowedOrigins: config.cors.origin 
        });
        return callback(new Error('Not allowed by CORS'));
      }
    }

    return callback(new Error('CORS configuration error'));
  },

  // Allow credentials (cookies, authorization headers)
  credentials: true,

  // Allowed methods
  methods: [
    'GET',
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    'OPTIONS',
    'HEAD',
  ],

  // Allowed headers
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

  // Exposed headers (available to frontend)
  exposedHeaders: [
    'X-Total-Count',
    'X-Page-Count',
    'X-Current-Page',
    'X-Per-Page',
    'X-Request-ID',
    'X-Rate-Limit-Remaining',
    'X-Rate-Limit-Reset',
  ],

  // Preflight request cache time (in seconds)
  maxAge: config.isDevelopment ? 3600 : 86400, // 1 hour dev, 24 hours prod

  // Pass the CORS preflight response to the next handler
  preflightContinue: false,

  // Provide a status code to use for successful OPTIONS requests
  optionsSuccessStatus: 204,
};

// Create CORS middleware
export const corsMiddleware = cors(corsOptions);

// Custom CORS error handler
export const corsErrorHandler = (error: Error, req: any, res: any, next: any) => {
  if (error.message === 'Not allowed by CORS') {
    logger.warn('CORS violation attempt', {
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