"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatPerformanceMeta = exports.formatQueryMeta = exports.calculatePagination = exports.responseMiddleware = exports.ResponseHelper = void 0;
class ResponseHelper {
    static success(res, data, message, statusCode = 200, meta) {
        const response = {
            success: true,
            message,
            data,
            meta,
            timestamp: new Date().toISOString(),
            requestId: res.req?.requestId,
        };
        return res.status(statusCode).json(response);
    }
    static error(res, message, statusCode = 400, error, errors) {
        const response = {
            success: false,
            message,
            error,
            errors,
            timestamp: new Date().toISOString(),
            requestId: res.req?.requestId,
        };
        return res.status(statusCode).json(response);
    }
    static paginated(res, data, pagination, message, statusCode = 200, additionalMeta) {
        const { page, limit, total } = pagination;
        const totalPages = Math.ceil(total / limit);
        const paginationMeta = {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrevious: page > 1,
        };
        const meta = {
            pagination: paginationMeta,
            ...additionalMeta,
        };
        return this.success(res, data, message, statusCode, meta);
    }
    static created(res, data, message = 'Resource created successfully') {
        return this.success(res, data, message, 201);
    }
    static updated(res, data, message = 'Resource updated successfully') {
        return this.success(res, data, message, 200);
    }
    static deleted(res, message = 'Resource deleted successfully') {
        return this.success(res, undefined, message, 200);
    }
    static noContent(res) {
        return res.status(204).send();
    }
    static notFound(res, message = 'Resource not found') {
        return this.error(res, message, 404, 'NOT_FOUND');
    }
    static unauthorized(res, message = 'Authentication required') {
        return this.error(res, message, 401, 'UNAUTHORIZED');
    }
    static forbidden(res, message = 'Access denied') {
        return this.error(res, message, 403, 'FORBIDDEN');
    }
    static validationError(res, errors, message = 'Validation failed') {
        return this.error(res, message, 400, 'VALIDATION_ERROR', errors);
    }
    static conflict(res, message = 'Resource already exists') {
        return this.error(res, message, 409, 'CONFLICT');
    }
    static serverError(res, message = 'Internal server error') {
        return this.error(res, message, 500, 'INTERNAL_SERVER_ERROR');
    }
    static rateLimitExceeded(res, message = 'Rate limit exceeded') {
        return this.error(res, message, 429, 'RATE_LIMIT_EXCEEDED');
    }
}
exports.ResponseHelper = ResponseHelper;
const responseMiddleware = (req, res, next) => {
    res.success = (data, message, statusCode, meta) => ResponseHelper.success(res, data, message, statusCode, meta);
    res.error = (message, statusCode, error, errors) => ResponseHelper.error(res, message, statusCode, error, errors);
    res.paginated = (data, pagination, message, statusCode, additionalMeta) => ResponseHelper.paginated(res, data, pagination, message, statusCode, additionalMeta);
    res.created = (data, message) => ResponseHelper.created(res, data, message);
    res.updated = (data, message) => ResponseHelper.updated(res, data, message);
    res.deleted = (message) => ResponseHelper.deleted(res, message);
    res.notFound = (message) => ResponseHelper.notFound(res, message);
    res.unauthorized = (message) => ResponseHelper.unauthorized(res, message);
    res.forbidden = (message) => ResponseHelper.forbidden(res, message);
    res.validationError = (errors, message) => ResponseHelper.validationError(res, errors, message);
    res.conflict = (message) => ResponseHelper.conflict(res, message);
    res.serverError = (message) => ResponseHelper.serverError(res, message);
    res.rateLimitExceeded = (message) => ResponseHelper.rateLimitExceeded(res, message);
    next();
};
exports.responseMiddleware = responseMiddleware;
const calculatePagination = (page, limit, total) => {
    const totalPages = Math.ceil(total / limit);
    return {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
    };
};
exports.calculatePagination = calculatePagination;
const formatQueryMeta = (filters, sort, aggregation) => {
    return {
        filters,
        sort,
        aggregation,
    };
};
exports.formatQueryMeta = formatQueryMeta;
const formatPerformanceMeta = (processingTime, queryTime) => {
    return {
        processingTime,
        queryTime,
    };
};
exports.formatPerformanceMeta = formatPerformanceMeta;
//# sourceMappingURL=response.js.map