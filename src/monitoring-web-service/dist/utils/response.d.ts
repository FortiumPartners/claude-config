import { Response } from 'express';
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
export interface PaginationParams {
    page: number;
    limit: number;
    total: number;
}
export declare class ResponseHelper {
    static success<T>(res: Response, data?: T, message?: string, statusCode?: number, meta?: ResponseMeta): Response;
    static error(res: Response, message: string, statusCode?: number, error?: string, errors?: any[]): Response;
    static paginated<T>(res: Response, data: T[], pagination: PaginationParams, message?: string, statusCode?: number, additionalMeta?: Partial<ResponseMeta>): Response;
    static created<T>(res: Response, data?: T, message?: string): Response;
    static updated<T>(res: Response, data?: T, message?: string): Response;
    static deleted(res: Response, message?: string): Response;
    static noContent(res: Response): Response;
    static notFound(res: Response, message?: string): Response;
    static unauthorized(res: Response, message?: string): Response;
    static forbidden(res: Response, message?: string): Response;
    static validationError(res: Response, errors: any[], message?: string): Response;
    static conflict(res: Response, message?: string): Response;
    static serverError(res: Response, message?: string): Response;
    static rateLimitExceeded(res: Response, message?: string): Response;
}
export declare const responseMiddleware: (req: any, res: Response, next: any) => void;
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
export declare const calculatePagination: (page: number, limit: number, total: number) => ResponseMeta["pagination"];
export declare const formatQueryMeta: (filters?: Record<string, any>, sort?: {
    field: string;
    order: "asc" | "desc";
}, aggregation?: string) => ResponseMeta["query"];
export declare const formatPerformanceMeta: (processingTime: number, queryTime?: number) => ResponseMeta["performance"];
//# sourceMappingURL=response.d.ts.map