/**
 * Log Ingestion API Validation Schemas
 * Fortium External Metrics Web Service - Task 2.3: Backend Log API Implementation
 */

import joi from 'joi';
import { commonSchemas } from '../utils/validation';

// Log level enum matching Seq standards and frontend interfaces
const logLevels = ['Information', 'Warning', 'Error', 'Fatal'] as const;

// Log properties validation - flexible object with typed common properties
const logPropertiesSchema = joi.object({
  // Standard structured logging properties
  correlationId: joi.string().uuid({ version: 'uuidv4' }).optional(),
  sessionId: joi.string().uuid({ version: 'uuidv4' }).optional(),
  userId: joi.string().uuid({ version: 'uuidv4' }).optional(),
  tenantId: joi.string().uuid({ version: 'uuidv4' }).optional(),
  traceId: joi.string().optional(),
  spanId: joi.string().optional(),
  
  // Application context
  component: joi.string().max(100).optional(),
  operation: joi.string().max(100).optional(),
  version: joi.string().max(20).optional(),
  environment: joi.string().valid('development', 'staging', 'production').optional(),
  
  // Performance tracking
  duration: joi.number().min(0).optional(),
  responseTime: joi.number().min(0).optional(),
  
  // User context
  userAgent: joi.string().max(500).optional(),
  ipAddress: joi.string().ip().optional(),
  
  // Error context (when level is Error or Fatal)
  errorCode: joi.string().max(50).optional(),
  errorCategory: joi.string().max(50).optional(),
  
  // Additional flexible properties (sanitized)
}).pattern(
  joi.string().max(100), // Property name limit
  joi.alternatives().try(
    joi.string().max(1000),
    joi.number(),
    joi.boolean(),
    joi.date().iso(),
    joi.array().items(joi.string().max(100)).max(10)
  )
).max(50); // Maximum number of properties to prevent DoS

// Log exception/error details validation
const logExceptionSchema = joi.object({
  type: joi.string().max(200).required(),
  message: joi.string().max(2000).required(),
  stackTrace: joi.string().max(8000).optional(),
  source: joi.string().max(500).optional(),
  innerException: joi.object({
    type: joi.string().max(200).optional(),
    message: joi.string().max(1000).optional(),
  }).optional(),
}).strict();

// Individual log entry validation matching frontend interfaces
const logEntrySchema = joi.object({
  timestamp: joi.date().iso().required(),
  level: joi.string().valid(...logLevels).required(),
  message: joi.string().max(2000).required(),
  messageTemplate: joi.string().max(2000).optional(),
  properties: logPropertiesSchema.default({}),
  exception: logExceptionSchema.optional(),
}).strict();

// Log ingestion request schema
export const logIngestionRequestSchema = joi.object({
  entries: joi.array()
    .items(logEntrySchema)
    .min(1)
    .max(100) // Batch limit to prevent memory issues
    .required(),
}).strict();

// Query parameters for log retrieval (for future extension)
export const logQuerySchema = joi.object({
  // Pagination
  page: joi.number().integer().min(1).default(1),
  limit: joi.number().integer().min(1).max(1000).default(100),
  
  // Filtering
  level: joi.string().valid(...logLevels).optional(),
  startDate: joi.date().iso().optional(),
  endDate: joi.date().iso().min(joi.ref('startDate')).optional(),
  correlationId: joi.string().uuid({ version: 'uuidv4' }).optional(),
  sessionId: joi.string().uuid({ version: 'uuidv4' }).optional(),
  userId: joi.string().uuid({ version: 'uuidv4' }).optional(),
  tenantId: joi.string().uuid({ version: 'uuidv4' }).optional(),
  component: joi.string().max(100).optional(),
  operation: joi.string().max(100).optional(),
  
  // Search
  search: joi.string().max(200).optional(),
  
  // Sorting
  sortBy: joi.string().valid('timestamp', 'level', 'component').default('timestamp'),
  sortOrder: joi.string().valid('asc', 'desc').default('desc'),
}).strict();

// Health check response schema
export const logHealthSchema = joi.object({
  status: joi.string().valid('healthy', 'degraded', 'unhealthy').required(),
  checks: joi.object({
    winston: joi.boolean().required(),
    seq: joi.object({
      status: joi.string().valid('healthy', 'degraded', 'unhealthy', 'disabled').required(),
      latency: joi.number().optional(),
      error: joi.string().optional(),
    }).required(),
    rateLimit: joi.object({
      enabled: joi.boolean().required(),
      limit: joi.number().required(),
      window: joi.number().required(),
    }).required(),
  }).required(),
  metrics: joi.object({
    entriesProcessed: joi.number().min(0).required(),
    entriesFailed: joi.number().min(0).required(),
    averageProcessingTime: joi.number().min(0).optional(),
  }).optional(),
}).strict();

// Export schemas for use in routes
export const logSchemas = {
  ingestion: logIngestionRequestSchema,
  query: logQuerySchema,
  health: logHealthSchema,
};

// Type definitions for TypeScript integration
export interface LogEntry {
  timestamp: string;
  level: 'Information' | 'Warning' | 'Error' | 'Fatal';
  message: string;
  messageTemplate?: string;
  properties: LogProperties;
  exception?: LogException;
}

export interface LogProperties {
  correlationId?: string;
  sessionId?: string;
  userId?: string;
  tenantId?: string;
  traceId?: string;
  spanId?: string;
  component?: string;
  operation?: string;
  version?: string;
  environment?: 'development' | 'staging' | 'production';
  duration?: number;
  responseTime?: number;
  userAgent?: string;
  ipAddress?: string;
  errorCode?: string;
  errorCategory?: string;
  [key: string]: any;
}

export interface LogException {
  type: string;
  message: string;
  stackTrace?: string;
  source?: string;
  innerException?: {
    type?: string;
    message?: string;
  };
}

export interface LogIngestionRequest {
  entries: LogEntry[];
}

export interface LogIngestionResponse {
  success: boolean;
  processed: number;
  failed: number;
  errors: string[];
  correlationId: string;
}

export interface LogQueryRequest {
  page?: number;
  limit?: number;
  level?: 'Information' | 'Warning' | 'Error' | 'Fatal';
  startDate?: string;
  endDate?: string;
  correlationId?: string;
  sessionId?: string;
  userId?: string;
  tenantId?: string;
  component?: string;
  operation?: string;
  search?: string;
  sortBy?: 'timestamp' | 'level' | 'component';
  sortOrder?: 'asc' | 'desc';
}

// Validation helper functions
export const validateLogEntry = (entry: unknown): { error?: string; value?: LogEntry } => {
  const { error, value } = logEntrySchema.validate(entry, {
    abortEarly: false,
    stripUnknown: true,
    convert: true,
  });

  if (error) {
    return { 
      error: error.details.map(detail => 
        `${detail.path.join('.')}: ${detail.message}`
      ).join(', ')
    };
  }

  return { value: value as LogEntry };
};

export const sanitizeLogProperties = (properties: any): LogProperties => {
  if (!properties || typeof properties !== 'object') {
    return {};
  }

  const sanitized: LogProperties = {};
  const maxStringLength = 1000;
  const maxPropertiesCount = 50;
  
  let propertyCount = 0;
  
  for (const [key, value] of Object.entries(properties)) {
    if (propertyCount >= maxPropertiesCount) {
      break;
    }
    
    // Sanitize key
    const sanitizedKey = String(key).slice(0, 100).replace(/[<>\"'&]/g, '');
    if (!sanitizedKey) continue;
    
    // Sanitize value based on type
    if (typeof value === 'string') {
      sanitized[sanitizedKey] = value.slice(0, maxStringLength).replace(/[<>\"'&]/g, '');
    } else if (typeof value === 'number' && isFinite(value)) {
      sanitized[sanitizedKey] = value;
    } else if (typeof value === 'boolean') {
      sanitized[sanitizedKey] = value;
    } else if (value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)))) {
      sanitized[sanitizedKey] = value;
    } else if (Array.isArray(value)) {
      sanitized[sanitizedKey] = value.slice(0, 10).map(item => 
        typeof item === 'string' ? item.slice(0, 100) : String(item).slice(0, 100)
      );
    }
    
    propertyCount++;
  }
  
  return sanitized;
};

// Size limits for log ingestion protection
export const LOG_LIMITS = {
  MAX_ENTRIES_PER_BATCH: 100,
  MAX_ENTRY_SIZE_KB: 64,
  MAX_BATCH_SIZE_MB: 5,
  MAX_MESSAGE_LENGTH: 2000,
  MAX_PROPERTIES_COUNT: 50,
  MAX_PROPERTY_NAME_LENGTH: 100,
  MAX_PROPERTY_VALUE_LENGTH: 1000,
} as const;