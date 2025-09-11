import { Request, Response, NextFunction } from 'express';
export declare class AppError extends Error {
    readonly statusCode: number;
    readonly isOperational: boolean;
    readonly code?: string;
    readonly details?: any;
    constructor(message: string, statusCode?: number, isOperational?: boolean, code?: string, details?: any);
}
export declare class ValidationError extends AppError {
    constructor(message: string, details?: any);
}
export declare class AuthenticationError extends AppError {
    constructor(message?: string);
}
export declare class AuthorizationError extends AppError {
    constructor(message?: string);
}
export declare class NotFoundError extends AppError {
    constructor(resource?: string);
}
export declare class ConflictError extends AppError {
    constructor(message: string);
}
export declare class RateLimitError extends AppError {
    constructor(message?: string);
}
export declare const notFoundMiddleware: (req: Request, res: Response, next: NextFunction) => void;
export declare const errorMiddleware: (error: any, req: Request, res: Response, next: NextFunction) => void;
export declare const asyncHandler: (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => (req: Request, res: Response, next: NextFunction) => void;
export declare const createError: {
    validation: (message: string, details?: any) => ValidationError;
    authentication: (message?: string) => AuthenticationError;
    authorization: (message?: string) => AuthorizationError;
    notFound: (resource?: string) => NotFoundError;
    conflict: (message: string) => ConflictError;
    rateLimit: (message?: string) => RateLimitError;
    internal: (message: string) => AppError;
};
//# sourceMappingURL=error.middleware.d.ts.map