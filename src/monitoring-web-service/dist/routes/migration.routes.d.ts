import { Router } from 'express';
import { DatabaseConnection } from '../database/connection';
import * as winston from 'winston';
export interface MigrationRoutes {
    router: Router;
}
export declare function createMigrationRoutes(db: DatabaseConnection, logger: winston.Logger): MigrationRoutes;
//# sourceMappingURL=migration.routes.d.ts.map