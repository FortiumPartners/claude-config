import { Request, Response } from 'express';
export declare const httpLoggingMiddleware: (req: Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>, res: Response<any, Record<string, any>>, callback: (err?: Error) => void) => void;
export declare const responseTimeMiddleware: (req: Request, res: Response, next: any) => void;
export declare const requestLoggingMiddleware: (req: Request, res: Response, next: any) => void;
export declare const skipLoggingMiddleware: (req: Request, res: Response, next: any) => void;
export declare const errorRequestLogging: (error: any, req: Request, res: Response, next: any) => void;
//# sourceMappingURL=logging.middleware.d.ts.map