import * as winston from 'winston';
export declare const logger: winston.Logger;
export declare const httpLogStream: {
    write: (message: string) => void;
};
export declare const loggers: {
    auth: {
        login: (userId: string, tenantId: string, metadata?: Record<string, any>) => void;
        loginFailed: (email: string, reason: string, metadata?: Record<string, any>) => void;
        logout: (userId: string, tenantId: string, metadata?: Record<string, any>) => void;
        tokenRefresh: (userId: string, tenantId: string, metadata?: Record<string, any>) => void;
        authorizationFailed: (userId: string, tenantId: string, reason: string, metadata?: Record<string, any>) => void;
    };
    api: {
        request: (method: string, path: string, userId?: string, tenantId?: string, metadata?: Record<string, any>) => void;
        error: (method: string, path: string, error: Error, userId?: string, tenantId?: string, metadata?: Record<string, any>) => void;
    };
    database: {
        query: (query: string, duration: number, metadata?: Record<string, any>) => void;
        error: (error: Error, query?: string, metadata?: Record<string, any>) => void;
    };
    security: {
        suspiciousActivity: (event: string, userId?: string, tenantId?: string, metadata?: Record<string, any>) => void;
        rateLimit: (ip: string, endpoint: string, metadata?: Record<string, any>) => void;
    };
    performance: {
        slowQuery: (query: string, duration: number, metadata?: Record<string, any>) => void;
        slowRequest: (method: string, path: string, duration: number, metadata?: Record<string, any>) => void;
    };
};
//# sourceMappingURL=logger.d.ts.map