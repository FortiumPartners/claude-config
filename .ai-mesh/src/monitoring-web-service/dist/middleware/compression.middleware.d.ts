import { Request, Response } from 'express';
export declare const compressionMiddleware: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
export declare const highCompressionMiddleware: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
export declare const noCompressionMiddleware: (req: Request, res: Response, next: any) => void;
//# sourceMappingURL=compression.middleware.d.ts.map