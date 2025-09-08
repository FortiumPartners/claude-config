/**
 * Multi-Tenant Middleware
 * Fortium External Metrics Web Service - Task 2.6: Multi-tenancy Middleware
 */

import { Request, Response, NextFunction } from 'express';
import { getPrismaClient, TenantContext } from '../database/prisma-client';
import { logger } from '../config/logger';
import { AppError, AuthenticationError, AuthorizationError } from './error.middleware';
import { config } from '../config/environment';

// Extend Request interface for multi-tenant context
declare global {
  namespace Express {
    interface Request {
      tenantContext?: TenantContext;
      tenantId?: string;
      tenantDomain?: string;
      tenant?: {
        id: string;
        name: string;
        domain: string;
        schemaName: string;
        isActive: boolean;
        subscriptionPlan: string;
      };
    }
  }
}

// Cache for tenant data to reduce database hits
const tenantCache = new Map<string, {
  data: any;
  expiresAt: number;
}>();

const TENANT_CACHE_TTL = 300000; // 5 minutes in milliseconds

export class MultiTenantMiddleware {
  private static prisma = getPrismaClient();

  /**
   * Extract tenant identifier from request
   * Priority: JWT token > X-Tenant-ID header > subdomain
   */
  static extractTenantId = (req: Request, res: Response, next: NextFunction): void => {
    try {
      let tenantId: string | undefined;
      let tenantDomain: string | undefined;

      // Method 1: From authenticated user's JWT token (highest priority)
      if (req.user?.tenantId) {
        tenantId = req.user.tenantId;
        logger.debug('Tenant ID extracted from JWT token', { tenantId });
      }

      // Method 2: From X-Tenant-ID header
      if (!tenantId) {
        const tenantHeader = req.headers['x-tenant-id'] as string;
        if (tenantHeader) {
          tenantId = tenantHeader;
          logger.debug('Tenant ID extracted from header', { tenantId });
        }
      }

      // Method 3: From subdomain (e.g., acme.metrics.com)
      if (!tenantId) {
        const host = req.headers.host;
        if (host) {
          const subdomain = host.split('.')[0];
          if (subdomain && subdomain !== 'www' && subdomain !== 'api') {
            tenantDomain = subdomain;
            logger.debug('Tenant domain extracted from subdomain', { tenantDomain });
          }
        }
      }

      // Validate extracted tenant identifier
      if (tenantId) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(tenantId)) {
          throw new AppError('Invalid tenant ID format', 400, true, 'INVALID_TENANT_ID');
        }
      }

      // Store in request for next middleware
      req.tenantId = tenantId;
      req.tenantDomain = tenantDomain;

      next();
    } catch (error) {
      logger.error('Tenant ID extraction failed', { error, url: req.originalUrl });
      next(error instanceof AppError ? error : new AppError('Failed to extract tenant information', 500));
    }
  };

  /**
   * Resolve tenant data from ID or domain
   */
  static resolveTenant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      const tenantDomain = req.tenantDomain;

      if (!tenantId && !tenantDomain) {
        // For public endpoints, this might be okay
        return next();
      }

      let tenant: any = null;

      // Try to get from cache first
      const cacheKey = tenantId || tenantDomain || '';
      const cached = tenantCache.get(cacheKey);
      
      if (cached && cached.expiresAt > Date.now()) {
        tenant = cached.data;
        logger.debug('Tenant data retrieved from cache', { 
          tenantId: tenant.id, 
          domain: tenant.domain 
        });
      } else {
        // Query database
        if (tenantId) {
          tenant = await this.prisma.tenant.findUnique({
            where: { 
              id: tenantId,
              isActive: true 
            }
          });
        } else if (tenantDomain) {
          tenant = await this.prisma.tenant.findUnique({
            where: { 
              domain: tenantDomain,
              isActive: true 
            }
          });
        }

        if (tenant) {
          // Cache the result
          tenantCache.set(cacheKey, {
            data: tenant,
            expiresAt: Date.now() + TENANT_CACHE_TTL
          });
          
          logger.debug('Tenant data retrieved from database', { 
            tenantId: tenant.id, 
            domain: tenant.domain 
          });
        }
      }

      if (!tenant) {
        const identifier = tenantId || tenantDomain;
        logger.warn('Tenant not found or inactive', { 
          identifier,
          type: tenantId ? 'id' : 'domain'
        });
        throw new AppError('Tenant not found or inactive', 404, true, 'TENANT_NOT_FOUND');
      }

      // Add tenant data to request
      req.tenant = {
        id: tenant.id,
        name: tenant.name,
        domain: tenant.domain,
        schemaName: tenant.schemaName,
        isActive: tenant.isActive,
        subscriptionPlan: tenant.subscriptionPlan,
      };

      // Create tenant context for database operations
      req.tenantContext = {
        tenantId: tenant.id,
        schemaName: tenant.schemaName,
        domain: tenant.domain,
      };

      next();
    } catch (error) {
      logger.error('Tenant resolution failed', { 
        error,
        tenantId: req.tenantId,
        tenantDomain: req.tenantDomain,
      });
      next(error instanceof AppError ? error : new AppError('Failed to resolve tenant', 500));
    }
  };

  /**
   * Enforce tenant isolation - ensures user belongs to the resolved tenant
   */
  static enforceTenantIsolation = (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Skip isolation check for unauthenticated requests or public endpoints
      if (!req.user) {
        return next();
      }

      // Skip isolation check if no tenant context is available
      if (!req.tenant) {
        return next();
      }

      // Verify user belongs to the resolved tenant
      if (req.user.tenantId !== req.tenant.id) {
        logger.warn('Tenant isolation violation detected', {
          userId: req.user.userId,
          userTenantId: req.user.tenantId,
          resolvedTenantId: req.tenant.id,
          endpoint: req.originalUrl,
          method: req.method,
        });

        throw new AuthorizationError(
          'Access denied: You do not have access to this tenant\'s data'
        );
      }

      logger.debug('Tenant isolation verified', {
        userId: req.user.userId,
        tenantId: req.tenant.id,
        endpoint: req.originalUrl,
      });

      next();
    } catch (error) {
      next(error instanceof AppError ? error : new AppError('Tenant isolation check failed', 500));
    }
  };

  /**
   * Set database context for tenant-specific queries
   */
  static setDatabaseContext = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.tenantContext) {
        // No tenant context available, continue without setting
        return next();
      }

      // Set the tenant context in Prisma client
      await this.prisma.setTenantContext(req.tenantContext);

      logger.debug('Database context set for tenant', {
        tenantId: req.tenantContext.tenantId,
        schemaName: req.tenantContext.schemaName,
      });

      // Ensure context is cleared after request
      res.on('finish', async () => {
        try {
          await this.prisma.clearTenantContext();
        } catch (error) {
          logger.error('Failed to clear tenant context', { error });
        }
      });

      next();
    } catch (error) {
      logger.error('Failed to set database context', { 
        error,
        tenantContext: req.tenantContext,
      });
      next(new AppError('Failed to set database context', 500));
    }
  };

  /**
   * Validate tenant subscription and feature access
   */
  static validateTenantAccess = (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.tenant) {
        return next();
      }

      const { subscriptionPlan } = req.tenant;
      const endpoint = req.originalUrl;
      const method = req.method;

      // Define feature access matrix
      const featureMatrix: Record<string, string[]> = {
        'basic': [
          'GET:/api/v1/auth',
          'GET:/api/v1/metrics',
          'GET:/api/v1/dashboards',
        ],
        'pro': [
          'GET:/api/v1/auth',
          'GET:/api/v1/metrics',
          'POST:/api/v1/metrics',
          'GET:/api/v1/dashboards',
          'POST:/api/v1/dashboards',
          'PUT:/api/v1/dashboards',
        ],
        'enterprise': ['*'], // All features
      };

      const allowedFeatures = featureMatrix[subscriptionPlan] || featureMatrix['basic'];
      const currentFeature = `${method}:${endpoint}`;

      // Check if feature is allowed
      const hasAccess = allowedFeatures.includes('*') || 
                       allowedFeatures.some(feature => 
                         feature === currentFeature || 
                         endpoint.startsWith(feature.split(':')[1])
                       );

      if (!hasAccess) {
        logger.warn('Feature access denied due to subscription', {
          tenantId: req.tenant.id,
          subscriptionPlan,
          endpoint,
          method,
        });

        throw new AuthorizationError(
          `Feature not available on ${subscriptionPlan} plan. Upgrade required.`
        );
      }

      next();
    } catch (error) {
      next(error instanceof AppError ? error : new AppError('Feature access validation failed', 500));
    }
  };

  /**
   * Clear tenant cache (for admin operations)
   */
  static clearTenantCache = (tenantId?: string): void => {
    if (tenantId) {
      tenantCache.delete(tenantId);
      logger.info('Tenant cache cleared for specific tenant', { tenantId });
    } else {
      tenantCache.clear();
      logger.info('All tenant cache cleared');
    }
  };

  /**
   * Get tenant cache statistics
   */
  static getCacheStats = (): {
    size: number;
    keys: string[];
    hitRate: number;
  } => {
    return {
      size: tenantCache.size,
      keys: Array.from(tenantCache.keys()),
      hitRate: 0, // TODO: Implement hit rate tracking
    };
  };

  /**
   * Middleware to require tenant context
   */
  static requireTenant = (req: Request, res: Response, next: NextFunction): void => {
    if (!req.tenant) {
      throw new AppError(
        'Tenant context required for this operation', 
        400, 
        true, 
        'TENANT_CONTEXT_REQUIRED'
      );
    }
    next();
  };

  /**
   * Complete multi-tenancy middleware chain
   */
  static fullChain = () => [
    this.extractTenantId,
    this.resolveTenant,
    this.enforceTenantIsolation,
    this.setDatabaseContext,
    this.validateTenantAccess,
  ];

  /**
   * Minimal multi-tenancy middleware chain (for public endpoints)
   */
  static minimalChain = () => [
    this.extractTenantId,
    this.resolveTenant,
  ];
}

// Export individual middleware functions for flexibility
export const {
  extractTenantId,
  resolveTenant,
  enforceTenantIsolation,
  setDatabaseContext,
  validateTenantAccess,
  requireTenant,
  fullChain: multiTenantChain,
  minimalChain: minimalMultiTenantChain,
} = MultiTenantMiddleware;

// Export the class for advanced usage
export { MultiTenantMiddleware };