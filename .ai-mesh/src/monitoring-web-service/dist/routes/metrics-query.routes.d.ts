import { Router } from 'express';
import { DatabaseConnection } from '../database/connection';
import { RealTimeProcessorService } from '../services/real-time-processor.service';
import * as winston from 'winston';
export interface MetricsQueryRoutes {
    router: Router;
}
export declare function createMetricsQueryRoutes(db: DatabaseConnection, logger: winston.Logger, realTimeProcessor?: RealTimeProcessorService): MetricsQueryRoutes;
//# sourceMappingURL=metrics-query.routes.d.ts.map