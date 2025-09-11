import { Request, Response, NextFunction } from 'express';
import { JwtPayload } from './jwt.service';
declare global {
    namespace Express {
        interface Request {
            user?: JwtPayload;
            tenant?: {
                id: string;
            };
            requestId?: string;
        }
    }
}
export declare const authenticateToken: (req: Request, res: Response, next: NextFunction) => void;
export declare const optionalAuth: (req: Request, res: Response, next: NextFunction) => void;
export declare const extractTenant: (req: Request, res: Response, next: NextFunction) => void;
export declare const requireRole: (allowedRoles: string | string[]) => (req: Request, res: Response, next: NextFunction) => void;
export declare const requirePermission: (permission: string) => (req: Request, res: Response, next: NextFunction) => void;
export declare const requireOwnership: (resourceIdParam?: string) => (req: Request, res: Response, next: NextFunction) => void;
export declare const requireAny: (...middlewares: Array<(req: Request, res: Response, next: NextFunction) => void>) => (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const ensureTenantIsolation: (req: Request, res: Response, next: NextFunction) => void;
export declare const authenticateApiKey: (req: Request, res: Response, next: NextFunction) => void;
export declare const developmentAuth: (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=auth.middleware.d.ts.map