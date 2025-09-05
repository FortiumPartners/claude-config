import { Router } from 'express';
import { DatabaseConnection } from '../database/connection';
import * as winston from 'winston';
export interface WebhookRoutes {
    router: Router;
}
export interface WebhookPayload {
    event: string;
    timestamp: number;
    source: string;
    data: any;
    metadata?: {
        claude_session?: string;
        organization_id?: string;
        user_id?: string;
    };
}
export interface WebhookResponse {
    success: boolean;
    message: string;
    event_id?: string;
    processed_at: string;
}
export declare function createWebhookRoutes(db: DatabaseConnection, logger: winston.Logger): WebhookRoutes;
//# sourceMappingURL=webhooks.routes.d.ts.map