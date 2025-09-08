/**
 * Security Middleware Configuration
 * Fortium External Metrics Web Service - Task 1.6: Express.js Server Foundation
 */

import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from '../config/environment';
import { logger, loggers } from '../config/logger';
import { Request, Response } from 'express';

// Helmet security headers configuration
export const helmetMiddleware = helmet({
  // Content Security Policy
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
    reportOnly: config.isDevelopment,
  },

  // Cross-Origin Embedder Policy
  crossOriginEmbedderPolicy: false, // Disabled to allow API usage

  // DNS Prefetch Control
  dnsPrefetchControl: { allow: false },

  // Frame Options
  frameguard: { action: 'deny' },

  // Hide Powered-By header
  hidePoweredBy: true,

  // HSTS (only in production)
  hsts: config.isProduction ? {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  } : false,

  // IE No Open
  ieNoOpen: true,

  // No Sniff
  noSniff: true,

  // Origin Agent Cluster
  originAgentCluster: true,

  // Permitted Cross-Domain Policies
  permittedCrossDomainPolicies: false,

  // Referrer Policy
  referrerPolicy: { policy: 'same-origin' },

  // X-XSS-Protection
  xssFilter: true,
});

// Rate limiting configuration
export const createRateLimitMiddleware = () => {
  return rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    
    // Custom message
    message: {
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP, please try again later',
      statusCode: 429,
      timestamp: new Date().toISOString(),
    },

    // Standard headers
    standardHeaders: true,
    legacyHeaders: false,

    // Skip successful requests in count (optional)
    skipSuccessfulRequests: false,

    // Skip failed requests in count (optional)
    skipFailedRequests: false,

    // Custom key generator (IP + User ID if available)
    keyGenerator: (req: Request) => {
      const userId = (req as any).user?.id;
      const tenantId = (req as any).tenant?.id;
      
      if (userId && tenantId) {
        return `${req.ip}-${tenantId}-${userId}`;
      }
      
      return req.ip;
    },

    // Custom handler for rate limit exceeded
    handler: (req: Request, res: Response) => {
      const userId = (req as any).user?.id;
      const tenantId = (req as any).tenant?.id;

      loggers.security.rateLimit(req.ip, req.originalUrl, {
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
        retryAfter: Math.round(config.rateLimit.windowMs / 1000),
      });
    },

    // On limit reached callback
    onLimitReached: (req: Request) => {
      logger.warn('Rate limit threshold reached', {
        ip: req.ip,
        endpoint: req.originalUrl,
        method: req.method,
        userAgent: req.headers['user-agent'],
      });
    },
  });
};

// Specific rate limits for auth endpoints
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    error: 'AUTH_RATE_LIMIT_EXCEEDED',
    message: 'Too many authentication attempts, please try again later',
    statusCode: 429,
    timestamp: new Date().toISOString(),
  },
  skipSuccessfulRequests: true, // Don't count successful logins
  keyGenerator: (req: Request) => `auth-${req.ip}`,
});

// Trust proxy configuration
export const configureTrustProxy = (app: any) => {
  if (config.server.trustProxy) {
    app.set('trust proxy', true);
    logger.info('Trust proxy enabled');
  }
};

// Request ID middleware
export const requestIdMiddleware = (req: Request, res: Response, next: any) => {
  const requestId = req.headers['x-request-id'] as string || 
                   `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Add to request object
  (req as any).requestId = requestId;
  
  // Add to response headers
  res.setHeader('X-Request-ID', requestId);
  
  next();
};

// Security headers middleware
export const securityHeadersMiddleware = (req: Request, res: Response, next: any) => {
  // Remove fingerprinting headers
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');
  
  // Add custom security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Add API version header
  res.setHeader('X-API-Version', '1.0.0');
  
  next();
};

// IP filtering middleware (for development/testing)
export const ipFilterMiddleware = (req: Request, res: Response, next: any) => {
  // In production, you might want to implement IP whitelisting
  // For now, we just log the IP for monitoring
  
  const clientIp = req.ip;
  const forwardedFor = req.headers['x-forwarded-for'];
  
  // Log IP information for security monitoring
  if (config.isDevelopment) {
    logger.debug('Request IP info', {
      clientIp,
      forwardedFor,
      userAgent: req.headers['user-agent'],
      endpoint: req.originalUrl,
    });
  }
  
  next();
};