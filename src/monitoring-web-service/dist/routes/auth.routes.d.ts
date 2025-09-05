import express from 'express';
import * as winston from 'winston';
import { DatabaseConnection } from '../database/connection';
import { JWTService, UserRole } from '../services/jwt.service';
import { SSOService } from '../services/sso.service';
export interface AuthRequest extends express.Request {
    user?: {
        id: string;
        organization_id: string;
        email: string;
        role: UserRole;
    };
}
export declare function createAuthRoutes(db: DatabaseConnection, logger: winston.Logger): {
    router: import("express-serve-static-core").Router;
    jwtService: JWTService;
    ssoService: SSOService;
    authenticateJWT: (req: AuthRequest, res: express.Response, next: express.NextFunction) => Promise<void>;
};
//# sourceMappingURL=auth.routes.d.ts.map