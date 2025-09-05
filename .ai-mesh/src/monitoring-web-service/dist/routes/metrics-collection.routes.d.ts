import { Router } from 'express';
import { DatabaseConnection } from '../database/connection';
import * as winston from 'winston';
export interface MetricsCollectionRoutes {
    router: Router;
}
export declare function createMetricsCollectionRoutes(db: DatabaseConnection, logger: winston.Logger): MetricsCollectionRoutes;
//# sourceMappingURL=metrics-collection.routes.d.ts.map