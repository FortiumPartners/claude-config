import { Request, Response, NextFunction } from 'express';
import { DatabaseConnection } from '../database/connection';
import * as winston from 'winston';
export interface WebhookSignatureRequest extends Request {
    rawBody?: Buffer;
    webhookSource?: string;
    webhookSecret?: string;
}
export declare function captureRawBody(req: WebhookSignatureRequest, res: Response, next: NextFunction): void;
export declare function createWebhookSignatureMiddleware(db: DatabaseConnection, logger: winston.Logger, options?: {
    required?: boolean;
    allowedSources?: string[];
    secretHeader?: string;
    signatureHeader?: string;
    timestampHeader?: string;
    timestampTolerance?: number;
}): (req: WebhookSignatureRequest, res: Response, next: NextFunction) => Promise<void>;
export declare function createClaudeCodeWebhookMiddleware(db: DatabaseConnection, logger: winston.Logger): (req: WebhookSignatureRequest, res: Response, next: NextFunction) => Promise<void>;
export declare function createAgentEventWebhookMiddleware(db: DatabaseConnection, logger: winston.Logger): (req: WebhookSignatureRequest, res: Response, next: NextFunction) => Promise<void>;
export declare function webhookSignatureMiddleware(req: WebhookSignatureRequest, res: Response, next: NextFunction): void;
//# sourceMappingURL=webhook-signature.middleware.d.ts.map