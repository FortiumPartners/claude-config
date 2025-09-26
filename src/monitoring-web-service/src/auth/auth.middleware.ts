/**
 * Authentication Middleware
 * Fortium External Metrics Web Service - Task 2.4: Role-Based Access Control
 */

import { Request, Response, NextFunction } from 'express';
import { JwtService, JwtPayload } from './jwt.service';
import { logger, loggers } from '../config/logger';
import { AppError, AuthenticationError, AuthorizationError } from '../middleware/error.middleware';
import { config } from '../config/environment';

// Extend Request interface to include user and tenant
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      tenant?: {
        id: string;
      };
      requestId?: string;
    }
  }
}

/**
 * Authentication middleware - verifies JWT token
 */
export const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    const token = JwtService.extractTokenFromHeader(authHeader);

    if (!token) {
      throw new AuthenticationError('Access token required');
    }

    // Verify token
    const payload = JwtService.verifyAccessToken(token);
    
    // Add user info to request
    req.user = payload;
    req.tenant = { id: payload.tenantId };

    loggers.auth.login(payload.userId, payload.tenantId, {
      requestId: req.requestId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      endpoint: req.originalUrl,
    });

    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      loggers.auth.loginFailed('unknown', 'Token verification failed', {
        requestId: req.requestId,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        endpoint: req.originalUrl,
      });
      
      next(new AuthenticationError('Invalid or expired token'));
    }
  }
};

/**
 * Optional authentication middleware - doesn't fail if no token
 */
export const optionalAuth = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    const token = JwtService.extractTokenFromHeader(authHeader);

    if (token) {
      try {
        const payload = JwtService.verifyAccessToken(token);
        req.user = payload;
        req.tenant = { id: payload.tenantId };
      } catch {
        // Token is invalid, but we continue without authentication
        logger.debug('Invalid token in optional auth middleware', {
          requestId: req.requestId,
          endpoint: req.originalUrl,
        });
      }
    }

    next();
  } catch (error) {
    // Continue without authentication on any error
    next();
  }
};

/**
 * Multi-tenant middleware - extracts tenant from header or token
 */
export const extractTenant = (req: Request, res: Response, next: NextFunction): void => {
  try {
    let tenantId: string | undefined;

    // First, try to get tenant from token (if authenticated)
    if (req.user?.tenantId) {
      tenantId = req.user.tenantId;
    }

    // If not in token, check header
    if (!tenantId) {
      const tenantHeader = req.headers[config.multiTenant.header.toLowerCase()] as string;
      if (tenantHeader) {
        tenantId = tenantHeader;
      }
    }

    if (!tenantId) {
      throw new AppError('Tenant ID required', 400, true, 'TENANT_ID_REQUIRED');
    }

    // Validate tenant ID format (UUID v4)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(tenantId)) {
      throw new AppError('Invalid tenant ID format', 400, true, 'INVALID_TENANT_ID');
    }

    req.tenant = { id: tenantId };

    logger.debug('Tenant extracted', {
      tenantId,
      requestId: req.requestId,
      userId: req.user?.userId,
    });

    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError('Failed to extract tenant information', 500));
    }
  }
};

/**
 * Role-based authorization middleware
 */
export const requireRole = (allowedRoles: string | string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const userRole = req.user.role;
      const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

      // Super admin has access to everything
      if (userRole === 'super_admin') {
        return next();
      }

      // Check if user has required role
      if (!roles.includes(userRole)) {
        loggers.auth.authorizationFailed(
          req.user.userId,
          req.user.tenantId,
          'Insufficient role',
          {
            requiredRoles: roles,
            userRole,
            endpoint: req.originalUrl,
            method: req.method,
          }
        );
        
        throw new AuthorizationError(
          `Access denied. Required role(s): ${roles.join(', ')}. Your role: ${userRole}`
        );
      }

      next();
    } catch (error) {
      if (error instanceof AppError) {
        next(error);
      } else {
        next(new AppError('Authorization check failed', 500));
      }
    }
  };
};

/**
 * Permission-based authorization middleware
 */
export const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const userPermissions = req.user.permissions || [];
      const userRole = req.user.role;

      // Super admin has all permissions
      if (userPermissions.includes('*')) {
        return next();
      }

      // Check if user has specific permission
      if (!userPermissions.includes(permission)) {
        loggers.auth.authorizationFailed(
          req.user.userId,
          req.user.tenantId,
          'Insufficient permissions',
          {
            requiredPermission: permission,
            userPermissions,
            userRole,
            endpoint: req.originalUrl,
            method: req.method,
          }
        );
        
        throw new AuthorizationError(
          `Access denied. Required permission: ${permission}`
        );
      }

      next();
    } catch (error) {
      if (error instanceof AppError) {
        next(error);
      } else {
        next(new AppError('Permission check failed', 500));
      }
    }
  };
};

/**
 * Resource ownership authorization - user can access only their own data
 */
export const requireOwnership = (resourceIdParam: string = 'id') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const userRole = req.user.role;
      
      // Admins can access any resource
      if (['super_admin', 'tenant_admin'].includes(userRole)) {
        return next();
      }

      // For regular users, check ownership
      const resourceId = req.params[resourceIdParam];
      const userId = req.user.userId;

      if (resourceId !== userId) {
        loggers.auth.authorizationFailed(
          req.user.userId,
          req.user.tenantId,
          'Resource ownership violation',
          {
            resourceId,
            userId,
            resourceIdParam,
            endpoint: req.originalUrl,
          }
        );
        
        throw new AuthorizationError('You can only access your own resources');
      }

      next();
    } catch (error) {
      if (error instanceof AppError) {
        next(error);
      } else {
        next(new AppError('Ownership check failed', 500));
      }
    }
  };
};

/**
 * Combined authorization middleware for complex scenarios
 */
export const requireAny = (...middlewares: Array<(req: Request, res: Response, next: NextFunction) => void>) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const errors: Error[] = [];
    
    for (const middleware of middlewares) {
      try {
        await new Promise<void>((resolve, reject) => {
          middleware(req, res, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        
        // If any middleware succeeds, allow access
        return next();
      } catch (error) {
        errors.push(error as Error);
      }
    }

    // All middlewares failed
    loggers.auth.authorizationFailed(
      req.user?.userId || 'unknown',
      req.user?.tenantId || 'unknown',
      'All authorization checks failed',
      {
        endpoint: req.originalUrl,
        errorCount: errors.length,
      }
    );

    next(new AuthorizationError('Access denied - insufficient permissions'));
  };
};

/**
 * Tenant isolation middleware - ensures users only access their tenant's data
 */
export const ensureTenantIsolation = (req: Request, res: Response, next: NextFunction): void => {
  try {
    if (!req.user) {
      throw new AuthenticationError('Authentication required');
    }

    if (!req.tenant) {
      throw new AppError('Tenant context required', 400);
    }

    // Verify user belongs to the requested tenant
    if (req.user.tenantId !== req.tenant.id) {
      loggers.auth.authorizationFailed(
        req.user.userId,
        req.user.tenantId,
        'Cross-tenant access attempt',
        {
          requestedTenantId: req.tenant.id,
          userTenantId: req.user.tenantId,
          endpoint: req.originalUrl,
        }
      );

      throw new AuthorizationError('Access denied: tenant mismatch');
    }

    logger.debug('Tenant isolation verified', {
      userId: req.user.userId,
      tenantId: req.user.tenantId,
      requestId: req.requestId,
    });

    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError('Tenant isolation check failed', 500));
    }
  }
};

/**
 * API Key authentication middleware (alternative to JWT)
 */
export const authenticateApiKey = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    
    if (!apiKey) {
      throw new AuthenticationError('API key required');
    }

    // TODO: Implement API key validation with database lookup
    // For now, this is a placeholder
    throw new AppError('API key authentication not yet implemented', 501);

  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AuthenticationError('API key validation failed'));
    }
  }
};

/**
 * Development only middleware - bypasses authentication
 */
export const developmentAuth = (req: Request, res: Response, next: NextFunction): void => {
  if (!config.isDevelopment) {
    throw new AppError('Development auth only available in development mode', 403);
  }

  // Create mock user for development using demo@fortium.com
  // Using a valid UUID for tenant ID to pass validation
  req.user = {
    userId: '8985da03-bd7f-4316-9316-afd59d319c13',
    tenantId: 'a1b2c3d4-e5f6-4789-a012-345678901234',
    email: 'demo@fortium.com',
    role: 'admin',
    permissions: ['read', 'write', 'admin'],
  };

  req.tenant = { id: 'a1b2c3d4-e5f6-4789-a012-345678901234' };

  logger.warn('Development authentication used', {
    requestId: req.requestId,
    endpoint: req.originalUrl,
  });

  next();
};