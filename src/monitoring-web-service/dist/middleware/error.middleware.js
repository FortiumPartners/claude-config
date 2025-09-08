"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createError = exports.asyncHandler = exports.errorMiddleware = exports.notFoundMiddleware = exports.RateLimitError = exports.ConflictError = exports.NotFoundError = exports.AuthorizationError = exports.AuthenticationError = exports.ValidationError = exports.AppError = void 0;
const logger_1 = require("../config/logger");
const environment_1 = require("../config/environment");
class AppError extends Error {
    statusCode;
    isOperational;
    code;
    details;
    constructor(message, statusCode = 500, isOperational = true, code, details) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.code = code;
        this.details = details;
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, AppError);
        }
        Object.setPrototypeOf(this, AppError.prototype);
    }
}
exports.AppError = AppError;
class ValidationError extends AppError {
    constructor(message, details) {
        super(message, 400, true, 'VALIDATION_ERROR', details);
    }
}
exports.ValidationError = ValidationError;
class AuthenticationError extends AppError {
    constructor(message = 'Authentication failed') {
        super(message, 401, true, 'AUTHENTICATION_ERROR');
    }
}
exports.AuthenticationError = AuthenticationError;
class AuthorizationError extends AppError {
    constructor(message = 'Insufficient permissions') {
        super(message, 403, true, 'AUTHORIZATION_ERROR');
    }
}
exports.AuthorizationError = AuthorizationError;
class NotFoundError extends AppError {
    constructor(resource = 'Resource') {
        super(`${resource} not found`, 404, true, 'NOT_FOUND_ERROR');
    }
}
exports.NotFoundError = NotFoundError;
class ConflictError extends AppError {
    constructor(message) {
        super(message, 409, true, 'CONFLICT_ERROR');
    }
}
exports.ConflictError = ConflictError;
class RateLimitError extends AppError {
    constructor(message = 'Too many requests') {
        super(message, 429, true, 'RATE_LIMIT_ERROR');
    }
}
exports.RateLimitError = RateLimitError;
const handleDatabaseError = (error) => {
    if (error.code === 'P2002') {
        return new ConflictError('A record with this data already exists');
    }
    if (error.code === 'P2025') {
        return new NotFoundError('Record');
    }
    if (error.code === 'P2003') {
        return new ValidationError('Foreign key constraint failed');
    }
    if (error.code === '23505') {
        return new ConflictError('Duplicate entry');
    }
    if (error.code === '23503') {
        return new ValidationError('Foreign key constraint violation');
    }
    return new AppError('Database operation failed', 500, true, 'DATABASE_ERROR');
};
const handleJWTError = (error) => {
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
const handleValidationError = (error) => {
    const details = error.details?.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value,
    }));
    return new ValidationError('Validation failed', details);
};
const notFoundMiddleware = (req, res, next) => {
    const error = new NotFoundError(`Route ${req.originalUrl}`);
    next(error);
};
exports.notFoundMiddleware = notFoundMiddleware;
const errorMiddleware = (error, req, res, next) => {
    let appError;
    if (error instanceof AppError) {
        appError = error;
    }
    else if (error.isJoi || error.name === 'ValidationError') {
        appError = handleValidationError(error);
    }
    else if (error.name && ['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name)) {
        appError = handleJWTError(error);
    }
    else if (error.code && (error.code.startsWith('P') || error.code.startsWith('2'))) {
        appError = handleDatabaseError(error);
    }
    else {
        appError = new AppError(environment_1.config.isProduction ? 'Something went wrong' : error.message, error.statusCode || 500, false, 'INTERNAL_ERROR');
    }
    const userId = req.user?.id;
    const tenantId = req.tenant?.id;
    const requestId = req.requestId;
    logger_1.loggers.api.error(req.method, req.originalUrl, error, userId, tenantId, {
        requestId,
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        statusCode: appError.statusCode,
        errorCode: appError.code,
    });
    const errorResponse = {
        error: appError.code || 'UNKNOWN_ERROR',
        message: appError.message,
        statusCode: appError.statusCode,
        timestamp: new Date().toISOString(),
    };
    if (requestId) {
        errorResponse.requestId = requestId;
    }
    if (environment_1.config.isDevelopment && appError.details) {
        errorResponse.details = appError.details;
    }
    if (environment_1.config.isDevelopment && !appError.isOperational) {
        errorResponse.stack = error.stack;
    }
    res.status(appError.statusCode).json(errorResponse);
};
exports.errorMiddleware = errorMiddleware;
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
exports.asyncHandler = asyncHandler;
exports.createError = {
    validation: (message, details) => new ValidationError(message, details),
    authentication: (message) => new AuthenticationError(message),
    authorization: (message) => new AuthorizationError(message),
    notFound: (resource) => new NotFoundError(resource),
    conflict: (message) => new ConflictError(message),
    rateLimit: (message) => new RateLimitError(message),
    internal: (message) => new AppError(message, 500, false, 'INTERNAL_ERROR'),
};
//# sourceMappingURL=error.middleware.js.map