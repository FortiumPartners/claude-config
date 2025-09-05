import express from 'express';
import * as winston from 'winston';
import { DatabaseConnection } from '../database/connection';
import { AuthRequest } from './auth.routes';
export declare function createUserManagementRoutes(db: DatabaseConnection, logger: winston.Logger, authenticateJWT?: (req: AuthRequest, res: express.Response, next: express.NextFunction) => Promise<void>): {
    router: import("express-serve-static-core").Router;
};
//# sourceMappingURL=user-management.routes.d.ts.map