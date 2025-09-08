import cors from 'cors';
export declare const corsMiddleware: (req: cors.CorsRequest, res: {
    statusCode?: number | undefined;
    setHeader(key: string, value: string): any;
    end(): any;
}, next: (err?: any) => any) => void;
export declare const corsErrorHandler: (error: Error, req: any, res: any, next: any) => any;
//# sourceMappingURL=cors.middleware.d.ts.map