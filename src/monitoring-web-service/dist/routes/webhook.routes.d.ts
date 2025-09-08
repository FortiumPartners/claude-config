import { Router } from 'express';
import { DatabaseConnection } from '../database/connection';
import * as winston from 'winston';
export interface WebhookRoutes {
    router: Router;
}
export declare function createWebhookRoutes(db: DatabaseConnection, logger: winston.Logger): WebhookRoutes;
//# sourceMappingURL=webhook.routes.d.ts.map