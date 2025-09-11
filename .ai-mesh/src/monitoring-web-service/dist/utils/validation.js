"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.customValidations = exports.validateMultiple = exports.validate = exports.dashboardSchemas = exports.metricsSchemas = exports.userSchemas = exports.authSchemas = exports.commonSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const error_middleware_1 = require("../middleware/error.middleware");
exports.commonSchemas = {
    uuid: joi_1.default.string().uuid({ version: 'uuidv4' }),
    email: joi_1.default.string().email().lowercase().trim(),
    password: joi_1.default.string()
        .min(8)
        .max(128)
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/)
        .message('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
    tenantId: joi_1.default.string().uuid({ version: 'uuidv4' }),
    pagination: joi_1.default.object({
        page: joi_1.default.number().integer().min(1).default(1),
        limit: joi_1.default.number().integer().min(1).max(100).default(20),
        sortBy: joi_1.default.string().optional(),
        sortOrder: joi_1.default.string().valid('asc', 'desc').default('asc'),
    }),
    dateRange: joi_1.default.object({
        startDate: joi_1.default.date().iso(),
        endDate: joi_1.default.date().iso().min(joi_1.default.ref('startDate')),
    }),
    timestamp: joi_1.default.date().iso(),
    apiVersion: joi_1.default.string().valid('v1').default('v1'),
};
exports.authSchemas = {
    login: joi_1.default.object({
        email: exports.commonSchemas.email.required(),
        password: joi_1.default.string().required().min(1),
        tenantId: exports.commonSchemas.tenantId.required(),
        rememberMe: joi_1.default.boolean().default(false),
    }),
    refreshToken: joi_1.default.object({
        refreshToken: joi_1.default.string().required(),
    }),
    changePassword: joi_1.default.object({
        currentPassword: joi_1.default.string().required(),
        newPassword: exports.commonSchemas.password.required(),
    }),
    validatePassword: joi_1.default.object({
        password: joi_1.default.string().required(),
    }),
};
exports.userSchemas = {
    createUser: joi_1.default.object({
        email: exports.commonSchemas.email.required(),
        password: exports.commonSchemas.password.required(),
        role: joi_1.default.string().valid('admin', 'user', 'viewer').required(),
        firstName: joi_1.default.string().trim().max(50).optional(),
        lastName: joi_1.default.string().trim().max(50).optional(),
        isActive: joi_1.default.boolean().default(true),
    }),
    updateUser: joi_1.default.object({
        email: exports.commonSchemas.email.optional(),
        role: joi_1.default.string().valid('admin', 'user', 'viewer').optional(),
        firstName: joi_1.default.string().trim().max(50).optional(),
        lastName: joi_1.default.string().trim().max(50).optional(),
        isActive: joi_1.default.boolean().optional(),
    }),
    queryUsers: joi_1.default.object({
        page: joi_1.default.number().integer().min(1).default(1),
        limit: joi_1.default.number().integer().min(1).max(100).default(20),
        sortBy: joi_1.default.string().optional(),
        sortOrder: joi_1.default.string().valid('asc', 'desc').default('asc'),
        role: joi_1.default.string().valid('admin', 'user', 'viewer').optional(),
        isActive: joi_1.default.boolean().optional(),
        search: joi_1.default.string().trim().max(100).optional(),
    }),
};
exports.metricsSchemas = {
    submitMetrics: joi_1.default.object({
        sessionId: exports.commonSchemas.uuid.required(),
        metrics: joi_1.default.array().items(joi_1.default.object({
            name: joi_1.default.string().required().max(100),
            value: joi_1.default.alternatives().try(joi_1.default.number(), joi_1.default.string().max(500), joi_1.default.boolean()).required(),
            unit: joi_1.default.string().max(20).optional(),
            timestamp: exports.commonSchemas.timestamp,
            tags: joi_1.default.object().pattern(joi_1.default.string(), joi_1.default.string()).optional(),
        })).required().min(1).max(100),
        userId: exports.commonSchemas.uuid.optional(),
        projectId: exports.commonSchemas.uuid.optional(),
        environment: joi_1.default.string().valid('development', 'staging', 'production').optional(),
    }),
    queryMetrics: joi_1.default.object({
        ...exports.commonSchemas.pagination,
        ...exports.commonSchemas.dateRange,
        sessionId: exports.commonSchemas.uuid.optional(),
        userId: exports.commonSchemas.uuid.optional(),
        projectId: exports.commonSchemas.uuid.optional(),
        metricNames: joi_1.default.array().items(joi_1.default.string()).optional(),
        environment: joi_1.default.string().valid('development', 'staging', 'production').optional(),
        aggregation: joi_1.default.string().valid('sum', 'avg', 'min', 'max', 'count').optional(),
        groupBy: joi_1.default.string().valid('hour', 'day', 'week', 'month').optional(),
    }),
    aggregateMetrics: joi_1.default.object({
        ...exports.commonSchemas.dateRange,
        metricNames: joi_1.default.array().items(joi_1.default.string()).required(),
        aggregation: joi_1.default.string().valid('sum', 'avg', 'min', 'max', 'count').required(),
        groupBy: joi_1.default.string().valid('hour', 'day', 'week', 'month').required(),
        filters: joi_1.default.object().pattern(joi_1.default.string(), joi_1.default.string()).optional(),
    }),
};
exports.dashboardSchemas = {
    createDashboard: joi_1.default.object({
        name: joi_1.default.string().required().max(100),
        description: joi_1.default.string().max(500).optional(),
        config: joi_1.default.object({
            widgets: joi_1.default.array().items(joi_1.default.object({
                id: joi_1.default.string().required(),
                type: joi_1.default.string().valid('chart', 'metric', 'table', 'gauge').required(),
                title: joi_1.default.string().required().max(100),
                config: joi_1.default.object().required(),
                position: joi_1.default.object({
                    x: joi_1.default.number().integer().min(0).required(),
                    y: joi_1.default.number().integer().min(0).required(),
                    width: joi_1.default.number().integer().min(1).required(),
                    height: joi_1.default.number().integer().min(1).required(),
                }).required(),
            })).required(),
            layout: joi_1.default.object().optional(),
        }).required(),
        isPublic: joi_1.default.boolean().default(false),
        tags: joi_1.default.array().items(joi_1.default.string()).optional(),
    }),
    updateDashboard: joi_1.default.object({
        name: joi_1.default.string().max(100).optional(),
        description: joi_1.default.string().max(500).optional(),
        config: joi_1.default.object().optional(),
        isPublic: joi_1.default.boolean().optional(),
        tags: joi_1.default.array().items(joi_1.default.string()).optional(),
    }),
    queryDashboards: joi_1.default.object({
        ...exports.commonSchemas.pagination,
        isPublic: joi_1.default.boolean().optional(),
        search: joi_1.default.string().trim().max(100).optional(),
        tags: joi_1.default.array().items(joi_1.default.string()).optional(),
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
    uuidParam: (paramName) => (0, exports.validate)(joi_1.default.object({ [paramName]: exports.commonSchemas.uuid.required() }), 'params'),
    paginationQuery: () => (0, exports.validate)(exports.commonSchemas.pagination, 'query'),
    dateRangeQuery: () => (0, exports.validate)(exports.commonSchemas.dateRange, 'query'),
    tenantHeader: () => (0, exports.validate)(joi_1.default.object({
        'x-tenant-id': exports.commonSchemas.tenantId.required(),
    }), 'headers'),
};
//# sourceMappingURL=validation.js.map