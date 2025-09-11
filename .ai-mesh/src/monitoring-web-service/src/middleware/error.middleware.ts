/**
 * Error Handling Middleware
 * Fortium External Metrics Web Service - Task 1.6: Express.js Server Foundation
 */

import { Request, Response, NextFunction } from 'express';
import { logger, loggers } from '../config/logger';
import { config } from '../config/environment';

// Custom error class
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code?: string;
  public readonly details?: any;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    code?: string,
    details?: any
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;
    this.details = details;

    // Maintain proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }

    Object.setPrototypeOf(this, AppError.prototype);
  }
}

// Validation error class
export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, true, 'VALIDATION_ERROR', details);
  }
}

// Authentication error class
export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401, true, 'AUTHENTICATION_ERROR');
  }
}

// Authorization error class
export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, true, 'AUTHORIZATION_ERROR');
  }
}

// Not found error class
export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, true, 'NOT_FOUND_ERROR');
  }
}

// Conflict error class
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, true, 'CONFLICT_ERROR');
  }
}

// Rate limit error class
export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(message, 429, true, 'RATE_LIMIT_ERROR');
  }
}

// Database error handler
const handleDatabaseError = (error: any): AppError => {
  // Prisma errors
  if (error.code === 'P2002') {
    return new ConflictError('A record with this data already exists');
  }
  
  if (error.code === 'P2025') {
    return new NotFoundError('Record');
  }
  
  if (error.code === 'P2003') {
    return new ValidationError('Foreign key constraint failed');
  }

  // PostgreSQL errors
  if (error.code === '23505') {
    return new ConflictError('Duplicate entry');
  }
  
  if (error.code === '23503') {
    return new ValidationError('Foreign key constraint violation');
  }

  // Generic database error
  return new AppError('Database operation failed', 500, true, 'DATABASE_ERROR');
};

// JWT error handler
const handleJWTError = (error: any): AppError => {
  if (error.name === 'TokenExpiredError') {
    return new AuthenticationError('Token has expired');
  }
  
  if (error.name === 'JsonWebTokenError') {
    return new AuthenticationError('Invalid token');
  }
  
  if (error.name === 'NotBeforeError') {
    return new AuthenticationError('Token not active');
  }

  return new AuthenticationError('Token verification failed');
};

// Validation error handler (Joi)
const handleValidationError = (error: any): AppError => {
  const details = error.details?.map((detail: any) => ({
    field: detail.path.join('.'),
    message: detail.message,
    value: detail.context?.value,
  }));

  return new ValidationError('Validation failed', details);
};

// Not found middleware (404)
export const notFoundMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const error = new NotFoundError(`Route ${req.originalUrl}`);
  next(error);
};

// Global error handling middleware
export const errorMiddleware = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let appError: AppError;

  // Handle different types of errors
  if (error instanceof AppError) {
    appError = error;
  } else if (error.isJoi || error.name === 'ValidationError') {
    appError = handleValidationError(error);
  } else if (error.name && ['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name)) {
    appError = handleJWTError(error);
  } else if (error.code && (error.code.startsWith('P') || error.code.startsWith('2'))) {
    appError = handleDatabaseError(error);
  } else {
    // Unknown error
    appError = new AppError(
      config.isProduction ? 'Something went wrong' : error.message,
      error.statusCode || 500,
      false,
      'INTERNAL_ERROR'
    );
  }

  // Log the error
  const userId = (req as any).user?.id;
  const tenantId = (req as any).tenant?.id;
  const requestId = (req as any).requestId;

  loggers.api.error(req.method, req.originalUrl, error, userId, tenantId, {
    requestId,
    userAgent: req.headers['user-agent'],
    ip: req.ip,
    statusCode: appError.statusCode,
    errorCode: appError.code,
  });

  // Send error response
  const errorResponse: any = {
    error: appError.code || 'UNKNOWN_ERROR',
    message: appError.message,
    statusCode: appError.statusCode,
    timestamp: new Date().toISOString(),
  };

  // Add request ID to response
  if (requestId) {
    errorResponse.requestId = requestId;
  }

  // Add error details in development
  if (config.isDevelopment && appError.details) {
    errorResponse.details = appError.details;
  }

  // Add stack trace in development for non-operational errors
  if (config.isDevelopment && !appError.isOperational) {
    errorResponse.stack = error.stack;
  }

  res.status(appError.statusCode).json(errorResponse);
};

// Async error wrapper
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Error factory functions
export const createError = {
  validation: (message: string, details?: any) => new ValidationError(message, details),
  authentication: (message?: string) => new AuthenticationError(message),
  authorization: (message?: string) => new AuthorizationError(message),
  notFound: (resource?: string) => new NotFoundError(resource),
  conflict: (message: string) => new ConflictError(message),
  rateLimit: (message?: string) => new RateLimitError(message),
  internal: (message: string) => new AppError(message, 500, false, 'INTERNAL_ERROR'),
};