import { Router } from 'express';
import { DatabaseConnection } from '../database/connection';
import * as winston from 'winston';
export interface MetricsCollectionRoutes {
    router: Router;
}
export declare function createMetricsCollectionRoutes(db: DatabaseConnection, logger: winston.Logger): MetricsCollectionRoutes;
export default createMetricsCollectionRoutes;
//# sourceMappingURL=sprint3-metrics.routes.d.ts.map