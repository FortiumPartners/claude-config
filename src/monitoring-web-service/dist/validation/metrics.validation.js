"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeJsonField = exports.validateDateRange = exports.validateStreamEvent = exports.validateMetricsQuery = exports.validateMetricsBatch = exports.validateProductivityMetric = exports.validateUserSessionUpdate = exports.validateUserSessionCreate = exports.validateAgentInteraction = exports.validateCommandExecution = exports.rateLimitConfigSchema = exports.streamEventSchema = exports.metricsQuerySchema = exports.metricsBatchSchema = exports.productivityMetricSchema = exports.userSessionUpdateSchema = exports.userSessionCreateSchema = exports.agentInteractionSchema = exports.commandExecutionSchema = void 0;
const joi_1 = __importDefault(require("joi"));
const uuidSchema = joi_1.default.string().uuid().required();
const optionalUuidSchema = joi_1.default.string().uuid().optional();
const timestampSchema = joi_1.default.date().iso().optional();
exports.commandExecutionSchema = joi_1.default.object({
    user_id: uuidSchema,
    team_id: optionalUuidSchema,
    project_id: optionalUuidSchema,
    command_name: joi_1.default.string().min(1).max(255).required(),
    command_args: joi_1.default.object().optional(),
    execution_time_ms: joi_1.default.number().integer().min(0).max(3600000).required(),
    status: joi_1.default.string().valid('success', 'error', 'timeout', 'cancelled').required(),
    error_message: joi_1.default.string().max(10000).optional().allow(null),
    context: joi_1.default.object().optional()
});
exports.agentInteractionSchema = joi_1.default.object({
    user_id: uuidSchema,
    team_id: optionalUuidSchema,
    project_id: optionalUuidSchema,
    command_execution_id: optionalUuidSchema,
    agent_name: joi_1.default.string().min(1).max(255).required(),
    interaction_type: joi_1.default.string().min(1).max(100).required(),
    input_tokens: joi_1.default.number().integer().min(0).max(1000000).optional(),
    output_tokens: joi_1.default.number().integer().min(0).max(1000000).optional(),
    execution_time_ms: joi_1.default.number().integer().min(0).max(3600000).required(),
    status: joi_1.default.string().valid('success', 'error', 'timeout', 'cancelled').required(),
    error_message: joi_1.default.string().max(10000).optional().allow(null),
    metadata: joi_1.default.object().optional()
});
exports.userSessionCreateSchema = joi_1.default.object({
    user_id: uuidSchema,
    context: joi_1.default.object().optional()
});
exports.userSessionUpdateSchema = joi_1.default.object({
    session_end: timestampSchema,
    duration_minutes: joi_1.default.number().integer().min(0).max(1440).optional(),
    commands_executed: joi_1.default.number().integer().min(0).optional(),
    agents_used: joi_1.default.array().items(joi_1.default.string().min(1).max(255)).optional(),
    productivity_score: joi_1.default.number().min(0).max(100).optional(),
    context: joi_1.default.object().optional()
});
exports.productivityMetricSchema = joi_1.default.object({
    user_id: optionalUuidSchema,
    team_id: optionalUuidSchema,
    project_id: optionalUuidSchema,
    metric_type: joi_1.default.string().valid('commands_per_hour', 'error_rate', 'session_duration', 'productivity_score', 'code_quality_score', 'response_time', 'task_completion_time', 'agent_usage_frequency').required(),
    metric_value: joi_1.default.number().required(),
    metric_unit: joi_1.default.string().max(50).optional(),
    dimensions: joi_1.default.object().optional()
});
exports.metricsBatchSchema = joi_1.default.object({
    command_executions: joi_1.default.array().items(exports.commandExecutionSchema).max(1000).optional(),
    agent_interactions: joi_1.default.array().items(exports.agentInteractionSchema).max(1000).optional(),
    user_sessions: joi_1.default.array().items(exports.userSessionCreateSchema).max(100).optional(),
    productivity_metrics: joi_1.default.array().items(exports.productivityMetricSchema).max(1000).optional(),
    timestamp: timestampSchema,
    batch_id: joi_1.default.string().max(255).optional()
}).min(1);
exports.metricsQuerySchema = joi_1.default.object({
    user_id: optionalUuidSchema,
    team_id: optionalUuidSchema,
    project_id: optionalUuidSchema,
    start_date: joi_1.default.date().iso().required(),
    end_date: joi_1.default.date().iso().min(joi_1.default.ref('start_date')).required(),
    metric_types: joi_1.default.array().items(joi_1.default.string().valid('commands_per_hour', 'error_rate', 'session_duration', 'productivity_score', 'code_quality_score', 'response_time', 'task_completion_time', 'agent_usage_frequency')).optional(),
    limit: joi_1.default.number().integer().min(1).max(10000).default(1000),
    offset: joi_1.default.number().integer().min(0).default(0),
    aggregation_window: joi_1.default.string().valid('1m', '5m', '15m', '1h', '1d', '1w').default('1h')
});
exports.streamEventSchema = joi_1.default.object({
    type: joi_1.default.string().valid('command_execution', 'agent_interaction', 'user_session', 'productivity_metric').required(),
    user_id: uuidSchema,
    data: joi_1.default.alternatives().try(exports.commandExecutionSchema, exports.agentInteractionSchema, exports.userSessionCreateSchema, exports.productivityMetricSchema).required(),
    timestamp: timestampSchema,
    source: joi_1.default.string().min(1).max(255).required()
});
exports.rateLimitConfigSchema = joi_1.default.object({
    window_ms: joi_1.default.number().integer().min(1000).max(3600000).default(60000),
    max_requests: joi_1.default.number().integer().min(1).max(100000).default(1000),
    identifier: joi_1.default.string().valid('organization_id', 'user_id', 'ip_address').default('organization_id')
});
const validateCommandExecution = (data) => {
    const { error, value } = exports.commandExecutionSchema.validate(data, {
        stripUnknown: true,
        abortEarly: false
    });
    if (error) {
        throw new Error(`Command execution validation failed: ${error.details.map(d => d.message).join(', ')}`);
    }
    return value;
};
exports.validateCommandExecution = validateCommandExecution;
const validateAgentInteraction = (data) => {
    const { error, value } = exports.agentInteractionSchema.validate(data, {
        stripUnknown: true,
        abortEarly: false
    });
    if (error) {
        throw new Error(`Agent interaction validation failed: ${error.details.map(d => d.message).join(', ')}`);
    }
    return value;
};
exports.validateAgentInteraction = validateAgentInteraction;
const validateUserSessionCreate = (data) => {
    const { error, value } = exports.userSessionCreateSchema.validate(data, {
        stripUnknown: true,
        abortEarly: false
    });
    if (error) {
        throw new Error(`User session create validation failed: ${error.details.map(d => d.message).join(', ')}`);
    }
    return value;
};
exports.validateUserSessionCreate = validateUserSessionCreate;
const validateUserSessionUpdate = (data) => {
    const { error, value } = exports.userSessionUpdateSchema.validate(data, {
        stripUnknown: true,
        abortEarly: false
    });
    if (error) {
        throw new Error(`User session update validation failed: ${error.details.map(d => d.message).join(', ')}`);
    }
    return value;
};
exports.validateUserSessionUpdate = validateUserSessionUpdate;
const validateProductivityMetric = (data) => {
    const { error, value } = exports.productivityMetricSchema.validate(data, {
        stripUnknown: true,
        abortEarly: false
    });
    if (error) {
        throw new Error(`Productivity metric validation failed: ${error.details.map(d => d.message).join(', ')}`);
    }
    return value;
};
exports.validateProductivityMetric = validateProductivityMetric;
const validateMetricsBatch = (data) => {
    const { error, value } = exports.metricsBatchSchema.validate(data, {
        stripUnknown: true,
        abortEarly: false
    });
    if (error) {
        throw new Error(`Metrics batch validation failed: ${error.details.map(d => d.message).join(', ')}`);
    }
    return value;
};
exports.validateMetricsBatch = validateMetricsBatch;
const validateMetricsQuery = (data) => {
    const { error, value } = exports.metricsQuerySchema.validate(data, {
        stripUnknown: true,
        abortEarly: false
    });
    if (error) {
        throw new Error(`Metrics query validation failed: ${error.details.map(d => d.message).join(', ')}`);
    }
    return value;
};
exports.validateMetricsQuery = validateMetricsQuery;
const validateStreamEvent = (data) => {
    const { error, value } = exports.streamEventSchema.validate(data, {
        stripUnknown: true,
        abortEarly: false
    });
    if (error) {
        throw new Error(`Stream event validation failed: ${error.details.map(d => d.message).join(', ')}`);
    }
    return value;
};
exports.validateStreamEvent = validateStreamEvent;
const validateDateRange = (startDate, endDate, maxDaysRange = 90) => {
    if (startDate >= endDate) {
        throw new Error('Start date must be before end date');
    }
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > maxDaysRange) {
        throw new Error(`Date range cannot exceed ${maxDaysRange} days`);
    }
    const now = new Date();
    if (endDate > now) {
        throw new Error('End date cannot be in the future');
    }
};
exports.validateDateRange = validateDateRange;
const sanitizeJsonField = (data) => {
    if (data === null || data === undefined)
        return {};
    if (typeof data === 'string') {
        try {
            return JSON.parse(data);
        }
        catch {
            return {};
        }
    }
    if (typeof data === 'object') {
        const dangerous = ['__proto__', 'constructor', 'prototype'];
        const sanitized = { ...data };
        dangerous.forEach(key => delete sanitized[key]);
        return sanitized;
    }
    return {};
};
exports.sanitizeJsonField = sanitizeJsonField;
//# sourceMappingURL=metrics.validation.js.map