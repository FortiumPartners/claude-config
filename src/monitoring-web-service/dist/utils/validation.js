"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.customValidations = exports.validateMultiple = exports.validate = exports.dashboardSchemas = exports.metricsSchemas = exports.userSchemas = exports.authSchemas = exports.commonSchemas = void 0;
const joi = __importStar(require("joi"));
const error_middleware_1 = require("../middleware/error.middleware");
exports.commonSchemas = {
    uuid: joi.string().uuid({ version: 'uuidv4' }),
    email: joi.string().email().lowercase().trim(),
    password: joi.string()
        .min(8)
        .max(128)
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/)
        .message('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
    tenantId: joi.string().uuid({ version: 'uuidv4' }),
    pagination: joi.object({
        page: joi.number().integer().min(1).default(1),
        limit: joi.number().integer().min(1).max(100).default(20),
        sortBy: joi.string().optional(),
        sortOrder: joi.string().valid('asc', 'desc').default('asc'),
    }),
    dateRange: joi.object({
        startDate: joi.date().iso(),
        endDate: joi.date().iso().min(joi.ref('startDate')),
    }),
    timestamp: joi.date().iso(),
    apiVersion: joi.string().valid('v1').default('v1'),
};
exports.authSchemas = {
    login: joi.object({
        email: exports.commonSchemas.email.required(),
        password: joi.string().required().min(1),
        tenantId: exports.commonSchemas.tenantId.required(),
        rememberMe: joi.boolean().default(false),
    }),
    refreshToken: joi.object({
        refreshToken: joi.string().required(),
    }),
    changePassword: joi.object({
        currentPassword: joi.string().required(),
        newPassword: exports.commonSchemas.password.required(),
    }),
    validatePassword: joi.object({
        password: joi.string().required(),
    }),
};
exports.userSchemas = {
    createUser: joi.object({
        email: exports.commonSchemas.email.required(),
        password: exports.commonSchemas.password.required(),
        role: joi.string().valid('admin', 'user', 'viewer').required(),
        firstName: joi.string().trim().max(50).optional(),
        lastName: joi.string().trim().max(50).optional(),
        isActive: joi.boolean().default(true),
    }),
    updateUser: joi.object({
        email: exports.commonSchemas.email.optional(),
        role: joi.string().valid('admin', 'user', 'viewer').optional(),
        firstName: joi.string().trim().max(50).optional(),
        lastName: joi.string().trim().max(50).optional(),
        isActive: joi.boolean().optional(),
    }),
    queryUsers: joi.object({
        ...exports.commonSchemas.pagination,
        role: joi.string().valid('admin', 'user', 'viewer').optional(),
        isActive: joi.boolean().optional(),
        search: joi.string().trim().max(100).optional(),
    }),
};
exports.metricsSchemas = {
    submitMetrics: joi.object({
        sessionId: exports.commonSchemas.uuid.required(),
        metrics: joi.array().items(joi.object({
            name: joi.string().required().max(100),
            value: joi.alternatives().try(joi.number(), joi.string().max(500), joi.boolean()).required(),
            unit: joi.string().max(20).optional(),
            timestamp: exports.commonSchemas.timestamp.default(() => new Date()),
            tags: joi.object().pattern(joi.string(), joi.string()).optional(),
        })).required().min(1).max(100),
        userId: exports.commonSchemas.uuid.optional(),
        projectId: exports.commonSchemas.uuid.optional(),
        environment: joi.string().valid('development', 'staging', 'production').optional(),
    }),
    queryMetrics: joi.object({
        ...exports.commonSchemas.pagination,
        ...exports.commonSchemas.dateRange,
        sessionId: exports.commonSchemas.uuid.optional(),
        userId: exports.commonSchemas.uuid.optional(),
        projectId: exports.commonSchemas.uuid.optional(),
        metricNames: joi.array().items(joi.string()).optional(),
        environment: joi.string().valid('development', 'staging', 'production').optional(),
        aggregation: joi.string().valid('sum', 'avg', 'min', 'max', 'count').optional(),
        groupBy: joi.string().valid('hour', 'day', 'week', 'month').optional(),
    }),
    aggregateMetrics: joi.object({
        ...exports.commonSchemas.dateRange,
        metricNames: joi.array().items(joi.string()).required(),
        aggregation: joi.string().valid('sum', 'avg', 'min', 'max', 'count').required(),
        groupBy: joi.string().valid('hour', 'day', 'week', 'month').required(),
        filters: joi.object().pattern(joi.string(), joi.string()).optional(),
    }),
};
exports.dashboardSchemas = {
    createDashboard: joi.object({
        name: joi.string().required().max(100),
        description: joi.string().max(500).optional(),
        config: joi.object({
            widgets: joi.array().items(joi.object({
                id: joi.string().required(),
                type: joi.string().valid('chart', 'metric', 'table', 'gauge').required(),
                title: joi.string().required().max(100),
                config: joi.object().required(),
                position: joi.object({
                    x: joi.number().integer().min(0).required(),
                    y: joi.number().integer().min(0).required(),
                    width: joi.number().integer().min(1).required(),
                    height: joi.number().integer().min(1).required(),
                }).required(),
            })).required(),
            layout: joi.object().optional(),
        }).required(),
        isPublic: joi.boolean().default(false),
        tags: joi.array().items(joi.string()).optional(),
    }),
    updateDashboard: joi.object({
        name: joi.string().max(100).optional(),
        description: joi.string().max(500).optional(),
        config: joi.object().optional(),
        isPublic: joi.boolean().optional(),
        tags: joi.array().items(joi.string()).optional(),
    }),
    queryDashboards: joi.object({
        ...exports.commonSchemas.pagination,
        isPublic: joi.boolean().optional(),
        search: joi.string().trim().max(100).optional(),
        tags: joi.array().items(joi.string()).optional(),
    }),
};
const validate = (schema, location = 'body') => {
    return (req, res, next) => {
        let dataToValidate;
        switch (location) {
            case 'body':
                dataToValidate = req.body;
                break;
            case 'query':
                dataToValidate = req.query;
                break;
            case 'params':
                dataToValidate = req.params;
                break;
            case 'headers':
                dataToValidate = req.headers;
                break;
            default:
                dataToValidate = req.body;
        }
        const { error, value } = schema.validate(dataToValidate, {
            abortEarly: false,
            stripUnknown: true,
            convert: true,
        });
        if (error) {
            const validationErrors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message,
                value: detail.context?.value,
            }));
            throw new error_middleware_1.ValidationError('Validation failed', validationErrors);
        }
        switch (location) {
            case 'body':
                req.body = value;
                break;
            case 'query':
                req.query = value;
                break;
            case 'params':
                req.params = value;
                break;
        }
        next();
    };
};
exports.validate = validate;
const validateMultiple = (validations) => {
    return (req, res, next) => {
        const errors = [];
        for (const validation of validations) {
            let dataToValidate;
            switch (validation.location) {
                case 'body':
                    dataToValidate = req.body;
                    break;
                case 'query':
                    dataToValidate = req.query;
                    break;
                case 'params':
                    dataToValidate = req.params;
                    break;
                case 'headers':
                    dataToValidate = req.headers;
                    break;
            }
            const { error, value } = validation.schema.validate(dataToValidate, {
                abortEarly: false,
                stripUnknown: true,
                convert: true,
            });
            if (error) {
                errors.push(...error.details.map(detail => ({
                    location: validation.location,
                    field: detail.path.join('.'),
                    message: detail.message,
                    value: detail.context?.value,
                })));
            }
            else {
                switch (validation.location) {
                    case 'body':
                        req.body = value;
                        break;
                    case 'query':
                        req.query = value;
                        break;
                    case 'params':
                        req.params = value;
                        break;
                }
            }
        }
        if (errors.length > 0) {
            throw new error_middleware_1.ValidationError('Validation failed', errors);
        }
        next();
    };
};
exports.validateMultiple = validateMultiple;
exports.customValidations = {
    uuidParam: (paramName) => (0, exports.validate)(joi.object({ [paramName]: exports.commonSchemas.uuid.required() }), 'params'),
    paginationQuery: () => (0, exports.validate)(exports.commonSchemas.pagination, 'query'),
    dateRangeQuery: () => (0, exports.validate)(exports.commonSchemas.dateRange, 'query'),
    tenantHeader: () => (0, exports.validate)(joi.object({
        'x-tenant-id': exports.commonSchemas.tenantId.required(),
    }), 'headers'),
};
//# sourceMappingURL=validation.js.map