import { Request, Response } from 'express';
export declare const helmetMiddleware: (req: import("http").IncomingMessage, res: import("http").ServerResponse, next: (err?: unknown) => void) => void;
export declare const createRateLimitMiddleware: () => import("express-rate-limit").RateLimitRequestHandler;
export declare const authRateLimit: import("express-rate-limit").RateLimitRequestHandler;
export declare const configureTrustProxy: (app: any) => void;
export declare const requestIdMiddleware: (req: Request, res: Response, next: any) => void;
export declare const securityHeadersMiddleware: (req: Request, res: Response, next: any) => void;
export declare const ipFilterMiddleware: (req: Request, res: Response, next: any) => void;
//# sourceMappingURL=security.middleware.d.ts.map