import { Request, Response, NextFunction } from 'express';
import { TenantContext } from '../database/prisma-client';
declare global {
    namespace Express {
        interface Request {
            tenantContext?: TenantContext;
            tenantId?: string;
            tenantDomain?: string;
            tenant?: {
                id: string;
                name: string;
                domain: string;
                schemaName: string;
                isActive: boolean;
                subscriptionPlan: string;
            };
        }
    }
}
export declare class MultiTenantMiddleware {
    private static prisma;
    static extractTenantId: (req: Request, res: Response, next: NextFunction) => void;
    static resolveTenant: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    static enforceTenantIsolation: (req: Request, res: Response, next: NextFunction) => void;
    static setDatabaseContext: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    static validateTenantAccess: (req: Request, res: Response, next: NextFunction) => void;
    static clearTenantCache: (tenantId?: string) => void;
    static getCacheStats: () => {
        size: number;
        keys: string[];
        hitRate: number;
    };
    static requireTenant: (req: Request, res: Response, next: NextFunction) => void;
    static fullChain: () => ((req: Request, res: Response, next: NextFunction) => void)[];
    static minimalChain: () => ((req: Request, res: Response, next: NextFunction) => void)[];
}
export declare const extractTenantId: (req: Request, res: Response, next: NextFunction) => void, resolveTenant: (req: Request, res: Response, next: NextFunction) => Promise<void>, enforceTenantIsolation: (req: Request, res: Response, next: NextFunction) => void, setDatabaseContext: (req: Request, res: Response, next: NextFunction) => Promise<void>, validateTenantAccess: (req: Request, res: Response, next: NextFunction) => void, requireTenant: (req: Request, res: Response, next: NextFunction) => void, multiTenantChain: () => ((req: Request, res: Response, next: NextFunction) => void)[], minimalMultiTenantChain: () => ((req: Request, res: Response, next: NextFunction) => void)[];
//# sourceMappingURL=multi-tenant.middleware.d.ts.map