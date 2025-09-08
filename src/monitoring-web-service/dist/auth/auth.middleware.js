"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.developmentAuth = exports.authenticateApiKey = exports.ensureTenantIsolation = exports.requireAny = exports.requireOwnership = exports.requirePermission = exports.requireRole = exports.extractTenant = exports.optionalAuth = exports.authenticateToken = void 0;
const jwt_service_1 = require("./jwt.service");
const logger_1 = require("../config/logger");
const error_middleware_1 = require("../middleware/error.middleware");
const environment_1 = require("../config/environment");
const authenticateToken = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = jwt_service_1.JwtService.extractTokenFromHeader(authHeader);
        if (!token) {
            throw new error_middleware_1.AuthenticationError('Access token required');
        }
        const payload = jwt_service_1.JwtService.verifyAccessToken(token);
        req.user = payload;
        req.tenant = { id: payload.tenantId };
        logger_1.loggers.auth.login(payload.userId, payload.tenantId, {
            requestId: req.requestId,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            endpoint: req.originalUrl,
        });
        next();
    }
    catch (error) {
        if (error instanceof error_middleware_1.AppError) {
            next(error);
        }
        else {
            logger_1.loggers.auth.loginFailed('unknown', 'Token verification failed', {
                requestId: req.requestId,
                ip: req.ip,
                userAgent: req.headers['user-agent'],
                endpoint: req.originalUrl,
            });
            next(new error_middleware_1.AuthenticationError('Invalid or expired token'));
        }
    }
};
exports.authenticateToken = authenticateToken;
const optionalAuth = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = jwt_service_1.JwtService.extractTokenFromHeader(authHeader);
        if (token) {
            try {
                const payload = jwt_service_1.JwtService.verifyAccessToken(token);
                req.user = payload;
                req.tenant = { id: payload.tenantId };
            }
            catch {
                logger_1.logger.debug('Invalid token in optional auth middleware', {
                    requestId: req.requestId,
                    endpoint: req.originalUrl,
                });
            }
        }
        next();
    }
    catch (error) {
        next();
    }
};
exports.optionalAuth = optionalAuth;
const extractTenant = (req, res, next) => {
    try {
        let tenantId;
        if (req.user?.tenantId) {
            tenantId = req.user.tenantId;
        }
        if (!tenantId) {
            const tenantHeader = req.headers[environment_1.config.multiTenant.header.toLowerCase()];
            if (tenantHeader) {
                tenantId = tenantHeader;
            }
        }
        if (!tenantId) {
            throw new error_middleware_1.AppError('Tenant ID required', 400, true, 'TENANT_ID_REQUIRED');
        }
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(tenantId)) {
            throw new error_middleware_1.AppError('Invalid tenant ID format', 400, true, 'INVALID_TENANT_ID');
        }
        req.tenant = { id: tenantId };
        logger_1.logger.debug('Tenant extracted', {
            tenantId,
            requestId: req.requestId,
            userId: req.user?.userId,
        });
        next();
    }
    catch (error) {
        if (error instanceof error_middleware_1.AppError) {
            next(error);
        }
        else {
            next(new error_middleware_1.AppError('Failed to extract tenant information', 500));
        }
    }
};
exports.extractTenant = extractTenant;
const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        try {
            if (!req.user) {
                throw new error_middleware_1.AuthenticationError('Authentication required');
            }
            const userRole = req.user.role;
            const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
            if (userRole === 'super_admin') {
                return next();
            }
            if (!roles.includes(userRole)) {
                logger_1.loggers.auth.authorizationFailed(req.user.userId, req.user.tenantId, 'Insufficient role', {
                    requiredRoles: roles,
                    userRole,
                    endpoint: req.originalUrl,
                    method: req.method,
                });
                throw new error_middleware_1.AuthorizationError(`Access denied. Required role(s): ${roles.join(', ')}. Your role: ${userRole}`);
            }
            next();
        }
        catch (error) {
            if (error instanceof error_middleware_1.AppError) {
                next(error);
            }
            else {
                next(new error_middleware_1.AppError('Authorization check failed', 500));
            }
        }
    };
};
exports.requireRole = requireRole;
const requirePermission = (permission) => {
    return (req, res, next) => {
        try {
            if (!req.user) {
                throw new error_middleware_1.AuthenticationError('Authentication required');
            }
            const userPermissions = req.user.permissions || [];
            const userRole = req.user.role;
            if (userPermissions.includes('*')) {
                return next();
            }
            if (!userPermissions.includes(permission)) {
                logger_1.loggers.auth.authorizationFailed(req.user.userId, req.user.tenantId, 'Insufficient permissions', {
                    requiredPermission: permission,
                    userPermissions,
                    userRole,
                    endpoint: req.originalUrl,
                    method: req.method,
                });
                throw new error_middleware_1.AuthorizationError(`Access denied. Required permission: ${permission}`);
            }
            next();
        }
        catch (error) {
            if (error instanceof error_middleware_1.AppError) {
                next(error);
            }
            else {
                next(new error_middleware_1.AppError('Permission check failed', 500));
            }
        }
    };
};
exports.requirePermission = requirePermission;
const requireOwnership = (resourceIdParam = 'id') => {
    return (req, res, next) => {
        try {
            if (!req.user) {
                throw new error_middleware_1.AuthenticationError('Authentication required');
            }
            const userRole = req.user.role;
            if (['super_admin', 'tenant_admin'].includes(userRole)) {
                return next();
            }
            const resourceId = req.params[resourceIdParam];
            const userId = req.user.userId;
            if (resourceId !== userId) {
                logger_1.loggers.auth.authorizationFailed(req.user.userId, req.user.tenantId, 'Resource ownership violation', {
                    resourceId,
                    userId,
                    resourceIdParam,
                    endpoint: req.originalUrl,
                });
                throw new error_middleware_1.AuthorizationError('You can only access your own resources');
            }
            next();
        }
        catch (error) {
            if (error instanceof error_middleware_1.AppError) {
                next(error);
            }
            else {
                next(new error_middleware_1.AppError('Ownership check failed', 500));
            }
        }
    };
};
exports.requireOwnership = requireOwnership;
const requireAny = (...middlewares) => {
    return async (req, res, next) => {
        const errors = [];
        for (const middleware of middlewares) {
            try {
                await new Promise((resolve, reject) => {
                    middleware(req, res, (err) => {
                        if (err)
                            reject(err);
                        else
                            resolve();
                    });
                });
                return next();
            }
            catch (error) {
                errors.push(error);
            }
        }
        logger_1.loggers.auth.authorizationFailed(req.user?.userId || 'unknown', req.user?.tenantId || 'unknown', 'All authorization checks failed', {
            endpoint: req.originalUrl,
            errorCount: errors.length,
        });
        next(new error_middleware_1.AuthorizationError('Access denied - insufficient permissions'));
    };
};
exports.requireAny = requireAny;
const ensureTenantIsolation = (req, res, next) => {
    try {
        if (!req.user) {
            throw new error_middleware_1.AuthenticationError('Authentication required');
        }
        if (!req.tenant) {
            throw new error_middleware_1.AppError('Tenant context required', 400);
        }
        if (req.user.tenantId !== req.tenant.id) {
            logger_1.loggers.auth.authorizationFailed(req.user.userId, req.user.tenantId, 'Cross-tenant access attempt', {
                requestedTenantId: req.tenant.id,
                userTenantId: req.user.tenantId,
                endpoint: req.originalUrl,
            });
            throw new error_middleware_1.AuthorizationError('Access denied: tenant mismatch');
        }
        logger_1.logger.debug('Tenant isolation verified', {
            userId: req.user.userId,
            tenantId: req.user.tenantId,
            requestId: req.requestId,
        });
        next();
    }
    catch (error) {
        if (error instanceof error_middleware_1.AppError) {
            next(error);
        }
        else {
            next(new error_middleware_1.AppError('Tenant isolation check failed', 500));
        }
    }
};
exports.ensureTenantIsolation = ensureTenantIsolation;
const authenticateApiKey = (req, res, next) => {
    try {
        const apiKey = req.headers['x-api-key'];
        if (!apiKey) {
            throw new error_middleware_1.AuthenticationError('API key required');
        }
        throw new error_middleware_1.AppError('API key authentication not yet implemented', 501);
    }
    catch (error) {
        if (error instanceof error_middleware_1.AppError) {
            next(error);
        }
        else {
            next(new error_middleware_1.AuthenticationError('API key validation failed'));
        }
    }
};
exports.authenticateApiKey = authenticateApiKey;
const developmentAuth = (req, res, next) => {
    if (!environment_1.config.isDevelopment) {
        throw new error_middleware_1.AppError('Development auth only available in development mode', 403);
    }
    req.user = {
        userId: 'dev-user-123',
        tenantId: 'dev-tenant-123',
        email: 'dev@fortium.com',
        role: 'admin',
        permissions: ['read', 'write', 'admin'],
    };
    req.tenant = { id: 'dev-tenant-123' };
    logger_1.logger.warn('Development authentication used', {
        requestId: req.requestId,
        endpoint: req.originalUrl,
    });
    next();
};
exports.developmentAuth = developmentAuth;
//# sourceMappingURL=auth.middleware.js.map