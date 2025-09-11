/**
 * Metrics Validation Schemas
 * Task 3.2: Input validation and sanitization
 */

import Joi from 'joi';

// Common schemas
const uuidSchema = Joi.string().uuid().required();
const optionalUuidSchema = Joi.string().uuid().optional();
const timestampSchema = Joi.date().iso().optional();

// Command Execution Validation
export const commandExecutionSchema = Joi.object({
  user_id: uuidSchema,
  team_id: optionalUuidSchema,
  project_id: optionalUuidSchema,
  command_name: Joi.string().min(1).max(255).required(),
  command_args: Joi.object().optional(),
  execution_time_ms: Joi.number().integer().min(0).max(3600000).required(), // Max 1 hour
  status: Joi.string().valid('success', 'error', 'timeout', 'cancelled').required(),
  error_message: Joi.string().max(10000).optional().allow(null),
  context: Joi.object().optional()
});

// Agent Interaction Validation
export const agentInteractionSchema = Joi.object({
  user_id: uuidSchema,
  team_id: optionalUuidSchema,
  project_id: optionalUuidSchema,
  command_execution_id: optionalUuidSchema,
  agent_name: Joi.string().min(1).max(255).required(),
  interaction_type: Joi.string().min(1).max(100).required(),
  input_tokens: Joi.number().integer().min(0).max(1000000).optional(),
  output_tokens: Joi.number().integer().min(0).max(1000000).optional(),
  execution_time_ms: Joi.number().integer().min(0).max(3600000).required(),
  status: Joi.string().valid('success', 'error', 'timeout', 'cancelled').required(),
  error_message: Joi.string().max(10000).optional().allow(null),
  metadata: Joi.object().optional()
});

// User Session Validation
export const userSessionCreateSchema = Joi.object({
  user_id: uuidSchema,
  context: Joi.object().optional()
});

export const userSessionUpdateSchema = Joi.object({
  session_end: timestampSchema,
  duration_minutes: Joi.number().integer().min(0).max(1440).optional(), // Max 24 hours
  commands_executed: Joi.number().integer().min(0).optional(),
  agents_used: Joi.array().items(Joi.string().min(1).max(255)).optional(),
  productivity_score: Joi.number().min(0).max(100).optional(),
  context: Joi.object().optional()
});

// Productivity Metric Validation
export const productivityMetricSchema = Joi.object({
  user_id: optionalUuidSchema,
  team_id: optionalUuidSchema,
  project_id: optionalUuidSchema,
  metric_type: Joi.string().valid(
    'commands_per_hour',
    'error_rate',
    'session_duration',
    'productivity_score',
    'code_quality_score',
    'response_time',
    'task_completion_time',
    'agent_usage_frequency'
  ).required(),
  metric_value: Joi.number().required(),
  metric_unit: Joi.string().max(50).optional(),
  dimensions: Joi.object().optional()
});

// Batch Metrics Validation
export const metricsBatchSchema = Joi.object({
  command_executions: Joi.array().items(commandExecutionSchema).max(1000).optional(),
  agent_interactions: Joi.array().items(agentInteractionSchema).max(1000).optional(),
  user_sessions: Joi.array().items(userSessionCreateSchema).max(100).optional(),
  productivity_metrics: Joi.array().items(productivityMetricSchema).max(1000).optional(),
  timestamp: timestampSchema,
  batch_id: Joi.string().max(255).optional()
}).min(1); // At least one metrics array must be provided

// Query Parameters Validation
export const metricsQuerySchema = Joi.object({
  user_id: optionalUuidSchema,
  team_id: optionalUuidSchema,
  project_id: optionalUuidSchema,
  start_date: Joi.date().iso().required(),
  end_date: Joi.date().iso().min(Joi.ref('start_date')).required(),
  metric_types: Joi.array().items(Joi.string().valid(
    'commands_per_hour',
    'error_rate', 
    'session_duration',
    'productivity_score',
    'code_quality_score',
    'response_time',
    'task_completion_time',
    'agent_usage_frequency'
  )).optional(),
  limit: Joi.number().integer().min(1).max(10000).default(1000),
  offset: Joi.number().integer().min(0).default(0),
  aggregation_window: Joi.string().valid('1m', '5m', '15m', '1h', '1d', '1w').default('1h')
});

// Real-time Stream Event Validation
export const streamEventSchema = Joi.object({
  type: Joi.string().valid('command_execution', 'agent_interaction', 'user_session', 'productivity_metric').required(),
  user_id: uuidSchema,
  data: Joi.alternatives().try(
    commandExecutionSchema,
    agentInteractionSchema,
    userSessionCreateSchema,
    productivityMetricSchema
  ).required(),
  timestamp: timestampSchema,
  source: Joi.string().min(1).max(255).required()
});

// Rate Limiting Configuration Validation
export const rateLimitConfigSchema = Joi.object({
  window_ms: Joi.number().integer().min(1000).max(3600000).default(60000), // 1 second to 1 hour
  max_requests: Joi.number().integer().min(1).max(100000).default(1000),
  identifier: Joi.string().valid('organization_id', 'user_id', 'ip_address').default('organization_id')
});

// Validation helper functions
export const validateCommandExecution = (data: any) => {
  const { error, value } = commandExecutionSchema.validate(data, {
    stripUnknown: true,
    abortEarly: false
  });
  if (error) {
    throw new Error(`Command execution validation failed: ${error.details.map(d => d.message).join(', ')}`);
  }
  return value;
};

export const validateAgentInteraction = (data: any) => {
  const { error, value } = agentInteractionSchema.validate(data, {
    stripUnknown: true,
    abortEarly: false
  });
  if (error) {
    throw new Error(`Agent interaction validation failed: ${error.details.map(d => d.message).join(', ')}`);
  }
  return value;
};

export const validateUserSessionCreate = (data: any) => {
  const { error, value } = userSessionCreateSchema.validate(data, {
    stripUnknown: true,
    abortEarly: false
  });
  if (error) {
    throw new Error(`User session create validation failed: ${error.details.map(d => d.message).join(', ')}`);
  }
  return value;
};

export const validateUserSessionUpdate = (data: any) => {
  const { error, value } = userSessionUpdateSchema.validate(data, {
    stripUnknown: true,
    abortEarly: false
  });
  if (error) {
    throw new Error(`User session update validation failed: ${error.details.map(d => d.message).join(', ')}`);
  }
  return value;
};

export const validateProductivityMetric = (data: any) => {
  const { error, value } = productivityMetricSchema.validate(data, {
    stripUnknown: true,
    abortEarly: false
  });
  if (error) {
    throw new Error(`Productivity metric validation failed: ${error.details.map(d => d.message).join(', ')}`);
  }
  return value;
};

export const validateMetricsBatch = (data: any) => {
  const { error, value } = metricsBatchSchema.validate(data, {
    stripUnknown: true,
    abortEarly: false
  });
  if (error) {
    throw new Error(`Metrics batch validation failed: ${error.details.map(d => d.message).join(', ')}`);
  }
  return value;
};

export const validateMetricsQuery = (data: any) => {
  const { error, value } = metricsQuerySchema.validate(data, {
    stripUnknown: true,
    abortEarly: false
  });
  if (error) {
    throw new Error(`Metrics query validation failed: ${error.details.map(d => d.message).join(', ')}`);
  }
  return value;
};

export const validateStreamEvent = (data: any) => {
  const { error, value } = streamEventSchema.validate(data, {
    stripUnknown: true,
    abortEarly: false
  });
  if (error) {
    throw new Error(`Stream event validation failed: ${error.details.map(d => d.message).join(', ')}`);
  }
  return value;
};

// Custom validation for date ranges
export const validateDateRange = (startDate: Date, endDate: Date, maxDaysRange = 90) => {
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

// Sanitization helpers
export const sanitizeJsonField = (data: any): any => {
  if (data === null || data === undefined) return {};
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch {
      return {};
    }
  }
  if (typeof data === 'object') {
    // Remove any potentially dangerous keys
    const dangerous = ['__proto__', 'constructor', 'prototype'];
    const sanitized = { ...data };
    dangerous.forEach(key => delete sanitized[key]);
    return sanitized;
  }
  return {};
};