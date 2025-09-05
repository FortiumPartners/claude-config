import { DatabaseConnection } from '../database/connection';
import * as winston from 'winston';
export interface WebhookSubscription {
    id: string;
    organization_id: string;
    webhook_url: string;
    event_types: string[];
    secret?: string;
    active: boolean;
    retry_settings: {
        max_retries: number;
        retry_delay_ms: number;
        exponential_backoff: boolean;
    };
    created_at: Date;
    updated_at: Date;
}
export interface WebhookEvent {
    id: string;
    organization_id: string;
    subscription_id?: string;
    event_type: string;
    payload: any;
    status: 'pending' | 'delivered' | 'failed' | 'retrying';
    attempts: number;
    last_attempt_at?: Date;
    next_retry_at?: Date;
    response_status?: number;
    response_body?: string;
    created_at: Date;
}
export interface WebhookProcessingResult {
    success: boolean;
    message: string;
    event_id?: string;
    alert_id?: string;
}
export interface WebhookTestResult {
    success: boolean;
    message: string;
    response_time_ms: number;
    status_code?: number;
}
export declare class WebhookService {
    private db;
    private logger;
    private metricsCollectionService;
    constructor(db: DatabaseConnection, logger: winston.Logger);
    processClaudeCodeEvent(payload: any): Promise<WebhookProcessingResult>;
    processAgentEvent(payload: any): Promise<WebhookProcessingResult>;
    processProductivityAlert(organizationId: string, alertData: any): Promise<WebhookProcessingResult>;
    getSubscriptions(organizationId: string): Promise<WebhookSubscription[]>;
    createSubscription(organizationId: string, subscriptionData: any): Promise<WebhookSubscription>;
    updateSubscription(organizationId: string, subscriptionId: string, updates: any): Promise<WebhookSubscription | null>;
    deleteSubscription(organizationId: string, subscriptionId: string): Promise<boolean>;
    testWebhook(webhookUrl: string, testPayload: any): Promise<WebhookTestResult>;
    private storeWebhookEvent;
    private processCommandExecutedEvent;
    private processAgentDelegatedEvent;
    private processSessionStartedEvent;
    private processSessionEndedEvent;
    private processErrorEvent;
    private processAgentPerformanceEvent;
    private processAgentSpecializationEvent;
    private processAgentConflictEvent;
    private triggerWebhookNotifications;
    private sendWebhookNotification;
    private generateWebhookSignature;
    getWebhookEvent(organizationId: string, eventId: string): Promise<WebhookEvent | null>;
    getWebhookEvents(organizationId: string, filters: any): Promise<{
        events: WebhookEvent[];
        total: number;
    }>;
    replayWebhookEvent(organizationId: string, eventId: string): Promise<{
        success: boolean;
        new_event_id?: string;
    }>;
}
//# sourceMappingURL=webhook.service.d.ts.map