/**
 * Response Standardization Utilities
 * Fortium External Metrics Web Service - Task 1.8: API Routing Structure
 */

import { Response } from 'express';

// Standard response interface
export interface StandardResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  errors?: any[];
  meta?: ResponseMeta;
  timestamp: string;
  requestId?: string;
}

// Response metadata for pagination, etc.
export interface ResponseMeta {
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
  query?: {
    filters?: Record<string, any>;
    sort?: {
      field: string;
      order: 'asc' | 'desc';
    };
    aggregation?: string;
  };
  performance?: {
    processingTime: number;
    queryTime?: number;
  };
}

// Pagination helper
export interface PaginationParams {
  page: number;
  limit: number;
  total: number;
}

export class ResponseHelper {
  /**
   * Send success response
   */
  static success<T>(
    res: Response,
    data?: T,
    message?: string,
    statusCode: number = 200,
    meta?: ResponseMeta
  ): Response {
    const response: StandardResponse<T> = {
      success: true,
      message,
      data,
      meta,
      timestamp: new Date().toISOString(),
      requestId: (res.req as any)?.requestId,
    };

    return res.status(statusCode).json(response);
  }

  /**
   * Send error response
   */
  static error(
    res: Response,
    message: string,
    statusCode: number = 400,
    error?: string,
    errors?: any[]
  ): Response {
    const response: StandardResponse = {
      success: false,
      message,
      error,
      errors,
      timestamp: new Date().toISOString(),
      requestId: (res.req as any)?.requestId,
    };

    return res.status(statusCode).json(response);
  }

  /**
   * Send paginated response
   */
  static paginated<T>(
    res: Response,
    data: T[],
    pagination: PaginationParams,
    message?: string,
    statusCode: number = 200,
    additionalMeta?: Partial<ResponseMeta>
  ): Response {
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

    const meta: ResponseMeta = {
      pagination: paginationMeta,
      ...additionalMeta,
    };

    return this.success(res, data, message, statusCode, meta);
  }

  /**
   * Send created response (201)
   */
  static created<T>(
    res: Response,
    data?: T,
    message: string = 'Resource created successfully'
  ): Response {
    return this.success(res, data, message, 201);
  }

  /**
   * Send updated response (200)
   */
  static updated<T>(
    res: Response,
    data?: T,
    message: string = 'Resource updated successfully'
  ): Response {
    return this.success(res, data, message, 200);
  }

  /**
   * Send deleted response (200)
   */
  static deleted(
    res: Response,
    message: string = 'Resource deleted successfully'
  ): Response {
    return this.success(res, undefined, message, 200);
  }

  /**
   * Send no content response (204)
   */
  static noContent(res: Response): Response {
    return res.status(204).send();
  }

  /**
   * Send not found response (404)
   */
  static notFound(
    res: Response,
    message: string = 'Resource not found'
  ): Response {
    return this.error(res, message, 404, 'NOT_FOUND');
  }

  /**
   * Send unauthorized response (401)
   */
  static unauthorized(
    res: Response,
    message: string = 'Authentication required'
  ): Response {
    return this.error(res, message, 401, 'UNAUTHORIZED');
  }

  /**
   * Send forbidden response (403)
   */
  static forbidden(
    res: Response,
    message: string = 'Access denied'
  ): Response {
    return this.error(res, message, 403, 'FORBIDDEN');
  }

  /**
   * Send validation error response (400)
   */
  static validationError(
    res: Response,
    errors: any[],
    message: string = 'Validation failed'
  ): Response {
    return this.error(res, message, 400, 'VALIDATION_ERROR', errors);
  }

  /**
   * Send conflict response (409)
   */
  static conflict(
    res: Response,
    message: string = 'Resource already exists'
  ): Response {
    return this.error(res, message, 409, 'CONFLICT');
  }

  /**
   * Send server error response (500)
   */
  static serverError(
    res: Response,
    message: string = 'Internal server error'
  ): Response {
    return this.error(res, message, 500, 'INTERNAL_SERVER_ERROR');
  }

  /**
   * Send rate limit exceeded response (429)
   */
  static rateLimitExceeded(
    res: Response,
    message: string = 'Rate limit exceeded'
  ): Response {
    return this.error(res, message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}

/**
 * Response middleware to add helper methods to response object
 */
export const responseMiddleware = (req: any, res: Response, next: any) => {
  // Add helper methods to response object
  res.success = (data?: any, message?: string, statusCode?: number, meta?: ResponseMeta) =>
    ResponseHelper.success(res, data, message, statusCode, meta);

  res.error = (message: string, statusCode?: number, error?: string, errors?: any[]) =>
    ResponseHelper.error(res, message, statusCode, error, errors);

  res.paginated = (data: any[], pagination: PaginationParams, message?: string, statusCode?: number, additionalMeta?: Partial<ResponseMeta>) =>
    ResponseHelper.paginated(res, data, pagination, message, statusCode, additionalMeta);

  res.created = (data?: any, message?: string) =>
    ResponseHelper.created(res, data, message);

  res.updated = (data?: any, message?: string) =>
    ResponseHelper.updated(res, data, message);

  res.deleted = (message?: string) =>
    ResponseHelper.deleted(res, message);

  res.notFound = (message?: string) =>
    ResponseHelper.notFound(res, message);

  res.unauthorized = (message?: string) =>
    ResponseHelper.unauthorized(res, message);

  res.forbidden = (message?: string) =>
    ResponseHelper.forbidden(res, message);

  res.validationError = (errors: any[], message?: string) =>
    ResponseHelper.validationError(res, errors, message);

  res.conflict = (message?: string) =>
    ResponseHelper.conflict(res, message);

  res.serverError = (message?: string) =>
    ResponseHelper.serverError(res, message);

  res.rateLimitExceeded = (message?: string) =>
    ResponseHelper.rateLimitExceeded(res, message);

  next();
};

// Extend Express Response interface
declare global {
  namespace Express {
    interface Response {
      success: (data?: any, message?: string, statusCode?: number, meta?: ResponseMeta) => Response;
      error: (message: string, statusCode?: number, error?: string, errors?: any[]) => Response;
      paginated: (data: any[], pagination: PaginationParams, message?: string, statusCode?: number, additionalMeta?: Partial<ResponseMeta>) => Response;
      created: (data?: any, message?: string) => Response;
      updated: (data?: any, message?: string) => Response;
      deleted: (message?: string) => Response;
      notFound: (message?: string) => Response;
      unauthorized: (message?: string) => Response;
      forbidden: (message?: string) => Response;
      validationError: (errors: any[], message?: string) => Response;
      conflict: (message?: string) => Response;
      serverError: (message?: string) => Response;
      rateLimitExceeded: (message?: string) => Response;
    }
  }
}

/**
 * Calculate pagination metadata
 */
export const calculatePagination = (
  page: number,
  limit: number,
  total: number
): ResponseMeta['pagination'] => {
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

/**
 * Format query metadata
 */
export const formatQueryMeta = (
  filters?: Record<string, any>,
  sort?: { field: string; order: 'asc' | 'desc' },
  aggregation?: string
): ResponseMeta['query'] => {
  return {
    filters,
    sort,
    aggregation,
  };
};

/**
 * Format performance metadata
 */
export const formatPerformanceMeta = (
  processingTime: number,
  queryTime?: number
): ResponseMeta['performance'] => {
  return {
    processingTime,
    queryTime,
  };
};