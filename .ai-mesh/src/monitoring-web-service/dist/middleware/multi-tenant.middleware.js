"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.minimalMultiTenantChain = exports.multiTenantChain = exports.requireTenant = exports.validateTenantAccess = exports.setDatabaseContext = exports.enforceTenantIsolation = exports.resolveTenant = exports.extractTenantId = exports.MultiTenantMiddleware = void 0;
const prisma_client_1 = require("../database/prisma-client");
const logger_1 = require("../config/logger");
const error_middleware_1 = require("./error.middleware");
const tenantCache = new Map();
const TENANT_CACHE_TTL = 300000;
class MultiTenantMiddleware {
    static prisma = (0, prisma_client_1.getPrismaClient)();
    static extractTenantId = (req, res, next) => {
        try {
            let tenantId;
            let tenantDomain;
            if (req.user?.tenantId) {
                tenantId = req.user.tenantId;
                logger_1.logger.debug('Tenant ID extracted from JWT token', { tenantId });
            }
            if (!tenantId) {
                const tenantHeader = req.headers['x-tenant-id'];
                if (tenantHeader) {
                    tenantId = tenantHeader;
                    logger_1.logger.debug('Tenant ID extracted from header', { tenantId });
                }
            }
            if (!tenantId) {
                const host = req.headers.host;
                if (host) {
                    const subdomain = host.split('.')[0];
                    if (subdomain && subdomain !== 'www' && subdomain !== 'api') {
                        tenantDomain = subdomain;
                        logger_1.logger.debug('Tenant domain extracted from subdomain', { tenantDomain });
                    }
                }
            }
            if (tenantId) {
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
                if (!uuidRegex.test(tenantId)) {
                    throw new error_middleware_1.AppError('Invalid tenant ID format', 400, true, 'INVALID_TENANT_ID');
                }
            }
            req.tenantId = tenantId;
            req.tenantDomain = tenantDomain;
            next();
        }
        catch (error) {
            logger_1.logger.error('Tenant ID extraction failed', { error, url: req.originalUrl });
            next(error instanceof error_middleware_1.AppError ? error : new error_middleware_1.AppError('Failed to extract tenant information', 500));
        }
    };
    static resolveTenant = async (req, res, next) => {
        try {
            const tenantId = req.tenantId;
            const tenantDomain = req.tenantDomain;
            if (!tenantId && !tenantDomain) {
                return next();
            }
            let tenant = null;
            const cacheKey = tenantId || tenantDomain || '';
            const cached = tenantCache.get(cacheKey);
            if (cached && cached.expiresAt > Date.now()) {
                tenant = cached.data;
                logger_1.logger.debug('Tenant data retrieved from cache', {
                    tenantId: tenant.id,
                    domain: tenant.domain
                });
            }
            else {
                if (tenantId) {
                    tenant = await this.prisma.tenant.findUnique({
                        where: {
                            id: tenantId,
                            isActive: true
                        }
                    });
                }
                else if (tenantDomain) {
                    tenant = await this.prisma.tenant.findUnique({
                        where: {
                            domain: tenantDomain,
                            isActive: true
                        }
                    });
                }
                if (tenant) {
                    tenantCache.set(cacheKey, {
                        data: tenant,
                        expiresAt: Date.now() + TENANT_CACHE_TTL
                    });
                    logger_1.logger.debug('Tenant data retrieved from database', {
                        tenantId: tenant.id,
                        domain: tenant.domain
                    });
                }
            }
            if (!tenant) {
                const identifier = tenantId || tenantDomain;
                logger_1.logger.warn('Tenant not found or inactive', {
                    identifier,
                    type: tenantId ? 'id' : 'domain'
                });
                throw new error_middleware_1.AppError('Tenant not found or inactive', 404, true, 'TENANT_NOT_FOUND');
            }
            req.tenant = {
                id: tenant.id,
                name: tenant.name,
                domain: tenant.domain,
                schemaName: tenant.schemaName,
                isActive: tenant.isActive,
                subscriptionPlan: tenant.subscriptionPlan,
            };
            req.tenantContext = {
                tenantId: tenant.id,
                schemaName: tenant.schemaName,
                domain: tenant.domain,
            };
            next();
        }
        catch (error) {
            logger_1.logger.error('Tenant resolution failed', {
                error,
                tenantId: req.tenantId,
                tenantDomain: req.tenantDomain,
            });
            next(error instanceof error_middleware_1.AppError ? error : new error_middleware_1.AppError('Failed to resolve tenant', 500));
        }
    };
    static enforceTenantIsolation = (req, res, next) => {
        try {
            if (!req.user) {
                return next();
            }
            if (!req.tenant) {
                return next();
            }
            if (req.user.tenantId !== req.tenant.id) {
                logger_1.logger.warn('Tenant isolation violation detected', {
                    userId: req.user.userId,
                    userTenantId: req.user.tenantId,
                    resolvedTenantId: req.tenant.id,
                    endpoint: req.originalUrl,
                    method: req.method,
                });
                throw new error_middleware_1.AuthorizationError('Access denied: You do not have access to this tenant\'s data');
            }
            logger_1.logger.debug('Tenant isolation verified', {
                userId: req.user.userId,
                tenantId: req.tenant.id,
                endpoint: req.originalUrl,
            });
            next();
        }
        catch (error) {
            next(error instanceof error_middleware_1.AppError ? error : new error_middleware_1.AppError('Tenant isolation check failed', 500));
        }
    };
    static setDatabaseContext = async (req, res, next) => {
        try {
            if (!req.tenantContext) {
                return next();
            }
            await this.prisma.setTenantContext(req.tenantContext);
            logger_1.logger.debug('Database context set for tenant', {
                tenantId: req.tenantContext.tenantId,
                schemaName: req.tenantContext.schemaName,
            });
            res.on('finish', async () => {
                try {
                    await this.prisma.clearTenantContext();
                }
                catch (error) {
                    logger_1.logger.error('Failed to clear tenant context', { error });
                }
            });
            next();
        }
        catch (error) {
            logger_1.logger.error('Failed to set database context', {
                error,
                tenantContext: req.tenantContext,
            });
            next(new error_middleware_1.AppError('Failed to set database context', 500));
        }
    };
    static validateTenantAccess = (req, res, next) => {
        try {
            if (!req.tenant) {
                return next();
            }
            const { subscriptionPlan } = req.tenant;
            const endpoint = req.originalUrl;
            const method = req.method;
            const featureMatrix = {
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
                'enterprise': ['*'],
            };
            const allowedFeatures = featureMatrix[subscriptionPlan] || featureMatrix['basic'];
            const currentFeature = `${method}:${endpoint}`;
            const hasAccess = allowedFeatures.includes('*') ||
                allowedFeatures.some(feature => feature === currentFeature ||
                    endpoint.startsWith(feature.split(':')[1]));
            if (!hasAccess) {
                logger_1.logger.warn('Feature access denied due to subscription', {
                    tenantId: req.tenant.id,
                    subscriptionPlan,
                    endpoint,
                    method,
                });
                throw new error_middleware_1.AuthorizationError(`Feature not available on ${subscriptionPlan} plan. Upgrade required.`);
            }
            next();
        }
        catch (error) {
            next(error instanceof error_middleware_1.AppError ? error : new error_middleware_1.AppError('Feature access validation failed', 500));
        }
    };
    static clearTenantCache = (tenantId) => {
        if (tenantId) {
            tenantCache.delete(tenantId);
            logger_1.logger.info('Tenant cache cleared for specific tenant', { tenantId });
        }
        else {
            tenantCache.clear();
            logger_1.logger.info('All tenant cache cleared');
        }
    };
    static getCacheStats = () => {
        return {
            size: tenantCache.size,
            keys: Array.from(tenantCache.keys()),
            hitRate: 0,
        };
    };
    static requireTenant = (req, res, next) => {
        if (!req.tenant) {
            throw new error_middleware_1.AppError('Tenant context required for this operation', 400, true, 'TENANT_CONTEXT_REQUIRED');
        }
        next();
    };
    static fullChain = () => [
        this.extractTenantId,
        this.resolveTenant,
        this.enforceTenantIsolation,
        this.setDatabaseContext,
        this.validateTenantAccess,
    ];
    static minimalChain = () => [
        this.extractTenantId,
        this.resolveTenant,
    ];
}
exports.MultiTenantMiddleware = MultiTenantMiddleware;
exports.extractTenantId = MultiTenantMiddleware.extractTenantId, exports.resolveTenant = MultiTenantMiddleware.resolveTenant, exports.enforceTenantIsolation = MultiTenantMiddleware.enforceTenantIsolation, exports.setDatabaseContext = MultiTenantMiddleware.setDatabaseContext, exports.validateTenantAccess = MultiTenantMiddleware.validateTenantAccess, exports.requireTenant = MultiTenantMiddleware.requireTenant, exports.multiTenantChain = MultiTenantMiddleware.fullChain, exports.minimalMultiTenantChain = MultiTenantMiddleware.minimalChain;
//# sourceMappingURL=multi-tenant.middleware.js.map