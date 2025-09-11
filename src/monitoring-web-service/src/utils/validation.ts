/**
 * Validation Utilities
 * Fortium External Metrics Web Service - Task 1.8: API Routing Structure
 */

import joi from 'joi';
import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../middleware/error.middleware';

// Common validation schemas
export const commonSchemas = {
  // UUID validation
  uuid: joi.string().uuid({ version: 'uuidv4' }),
  
  // Email validation
  email: joi.string().email().lowercase().trim(),
  
  // Password validation (matches password service requirements)
  password: joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/)
    .message('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  
  // Tenant ID (UUID in header)
  tenantId: joi.string().uuid({ version: 'uuidv4' }),
  
  // Pagination
  pagination: joi.object({
    page: joi.number().integer().min(1).default(1),
    limit: joi.number().integer().min(1).max(100).default(20),
    sortBy: joi.string().optional(),
    sortOrder: joi.string().valid('asc', 'desc').default('asc'),
  }),
  
  // Date range
  dateRange: joi.object({
    startDate: joi.date().iso(),
    endDate: joi.date().iso().min(joi.ref('startDate')),
  }),
  
  // Timestamps
  timestamp: joi.date().iso(),
  
  // API version
  apiVersion: joi.string().valid('v1').default('v1'),
};

// Authentication schemas
export const authSchemas = {
  // Login request
  login: joi.object({
    email: commonSchemas.email.required(),
    password: joi.string().required().min(1),
    rememberMe: joi.boolean().default(false),
  }),
  
  // Refresh token request
  refreshToken: joi.object({
    refreshToken: joi.string().required(),
  }),
  
  // Change password request
  changePassword: joi.object({
    currentPassword: joi.string().required(),
    newPassword: commonSchemas.password.required(),
  }),
  
  // Password validation request
  validatePassword: joi.object({
    password: joi.string().required(),
  }),
};

// User schemas
export const userSchemas = {
  // Create user
  createUser: joi.object({
    email: commonSchemas.email.required(),
    password: commonSchemas.password.required(),
    role: joi.string().valid('admin', 'user', 'viewer').required(),
    firstName: joi.string().trim().max(50).optional(),
    lastName: joi.string().trim().max(50).optional(),
    isActive: joi.boolean().default(true),
  }),
  
  // Update user
  updateUser: joi.object({
    email: commonSchemas.email.optional(),
    role: joi.string().valid('admin', 'user', 'viewer').optional(),
    firstName: joi.string().trim().max(50).optional(),
    lastName: joi.string().trim().max(50).optional(),
    isActive: joi.boolean().optional(),
  }),
  
  // User query
  queryUsers: joi.object({
    page: joi.number().integer().min(1).default(1),
    limit: joi.number().integer().min(1).max(100).default(20),
    sortBy: joi.string().optional(),
    sortOrder: joi.string().valid('asc', 'desc').default('asc'),
    role: joi.string().valid('admin', 'user', 'viewer').optional(),
    isActive: joi.boolean().optional(),
    search: joi.string().trim().max(100).optional(),
  }),
};

// Metrics schemas
export const metricsSchemas = {
  // Submit metrics
  submitMetrics: joi.object({
    sessionId: commonSchemas.uuid.required(),
    metrics: joi.array().items(
      joi.object({
        name: joi.string().required().max(100),
        value: joi.alternatives().try(
          joi.number(),
          joi.string().max(500),
          joi.boolean()
        ).required(),
        unit: joi.string().max(20).optional(),
        timestamp: commonSchemas.timestamp,
        tags: joi.object().pattern(joi.string(), joi.string()).optional(),
      })
    ).required().min(1).max(100),
    userId: commonSchemas.uuid.optional(),
    projectId: commonSchemas.uuid.optional(),
    environment: joi.string().valid('development', 'staging', 'production').optional(),
  }),
  
  // Query metrics
  queryMetrics: joi.object({
    // Pagination fields
    page: joi.number().integer().min(1).default(1),
    limit: joi.number().integer().min(1).max(100).default(20),
    sortBy: joi.string().optional(),
    sortOrder: joi.string().valid('asc', 'desc').default('asc'),
    // Date range fields
    startDate: joi.date().iso().optional(),
    endDate: joi.date().iso().min(joi.ref('startDate')).optional(),
    // Metrics specific fields
    sessionId: commonSchemas.uuid.optional(),
    userId: commonSchemas.uuid.optional(),
    projectId: commonSchemas.uuid.optional(),
    metricNames: joi.array().items(joi.string()).optional(),
    environment: joi.string().valid('development', 'staging', 'production').optional(),
    aggregation: joi.string().valid('sum', 'avg', 'min', 'max', 'count').optional(),
    groupBy: joi.string().valid('hour', 'day', 'week', 'month').optional(),
  }),
  
  // Metrics aggregation
  aggregateMetrics: joi.object({
    // Date range fields
    startDate: joi.date().iso().required(),
    endDate: joi.date().iso().min(joi.ref('startDate')).required(),
    // Aggregation fields
    metricNames: joi.array().items(joi.string()).required(),
    aggregation: joi.string().valid('sum', 'avg', 'min', 'max', 'count').required(),
    groupBy: joi.string().valid('hour', 'day', 'week', 'month').required(),
    filters: joi.object().pattern(joi.string(), joi.string()).optional(),
  }),
};

// Dashboard schemas
export const dashboardSchemas = {
  // Create dashboard
  createDashboard: joi.object({
    name: joi.string().required().max(100),
    description: joi.string().max(500).optional(),
    config: joi.object({
      widgets: joi.array().items(
        joi.object({
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
        })
      ).required(),
      layout: joi.object().optional(),
    }).required(),
    isPublic: joi.boolean().default(false),
    tags: joi.array().items(joi.string()).optional(),
  }),
  
  // Update dashboard
  updateDashboard: joi.object({
    name: joi.string().max(100).optional(),
    description: joi.string().max(500).optional(),
    config: joi.object().optional(),
    isPublic: joi.boolean().optional(),
    tags: joi.array().items(joi.string()).optional(),
  }),
  
  // Query dashboards
  queryDashboards: joi.object({
    // Pagination fields
    page: joi.number().integer().min(1).default(1),
    limit: joi.number().integer().min(1).max(100).default(20),
    sortBy: joi.string().optional(),
    sortOrder: joi.string().valid('asc', 'desc').default('asc'),
    // Dashboard specific fields
    isPublic: joi.boolean().optional(),
    search: joi.string().trim().max(100).optional(),
    tags: joi.array().items(joi.string()).optional(),
  }),
};

/**
 * Validation middleware factory
 */
export const validate = (schema: joi.ObjectSchema, location: 'body' | 'query' | 'params' | 'headers' = 'body') => {
  return (req: Request, res: Response, next: NextFunction) => {
    let dataToValidate: any;
    
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
      abortEarly: false, // Include all errors
      stripUnknown: true, // Remove unknown fields
      convert: true, // Convert types when possible
    });

    if (error) {
      const validationErrors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value,
      }));

      throw new ValidationError('Validation failed', validationErrors);
    }

    // Replace the original data with validated/converted data
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

/**
 * Multiple validation middleware (for validating multiple locations)
 */
export const validateMultiple = (validations: Array<{
  schema: joi.ObjectSchema;
  location: 'body' | 'query' | 'params' | 'headers';
}>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: any[] = [];
    
    for (const validation of validations) {
      let dataToValidate: any;
      
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
      } else {
        // Update request with validated data
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
      throw new ValidationError('Validation failed', errors);
    }

    next();
  };
};

/**
 * Custom validation functions
 */
export const customValidations = {
  // Validate UUID parameter
  uuidParam: (paramName: string) => validate(
    joi.object({ [paramName]: commonSchemas.uuid.required() }),
    'params'
  ),
  
  // Validate pagination query
  paginationQuery: () => validate(commonSchemas.pagination, 'query'),
  
  // Validate date range query
  dateRangeQuery: () => validate(commonSchemas.dateRange, 'query'),
  
  // Validate tenant header
  tenantHeader: () => validate(
    joi.object({
      'x-tenant-id': commonSchemas.tenantId.required(),
    }),
    'headers'
  ),
};

// Re-export log validation schemas for route integration
export { logSchemas } from '../validation/logs.validation';