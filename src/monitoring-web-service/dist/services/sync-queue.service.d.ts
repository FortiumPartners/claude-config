import * as winston from 'winston';
export interface QueueItem {
    id: string;
    type: 'metrics' | 'session' | 'command' | 'interaction' | 'batch';
    payload: any;
    organization_id: string;
    priority: 'low' | 'normal' | 'high' | 'critical';
    created_at: Date;
    scheduled_at: Date;
    attempts: number;
    max_attempts: number;
    last_error?: string;
    retry_after?: Date;
    metadata?: Record<string, any>;
}
export interface QueueStats {
    total_items: number;
    by_priority: Record<string, number>;
    by_type: Record<string, number>;
    by_status: {
        pending: number;
        retrying: number;
        failed: number;
    };
    oldest_item_age_ms: number;
    queue_size_bytes: number;
    disk_usage_bytes: number;
}
export interface RetryPolicy {
    initial_delay_ms: number;
    max_delay_ms: number;
    backoff_multiplier: number;
    max_attempts: number;
    jitter_factor: number;
}
export interface QueueConfig {
    storage_path?: string;
    max_queue_size: number;
    max_item_age_ms: number;
    cleanup_interval_ms: number;
    persist_interval_ms: number;
    compression_enabled: boolean;
    encryption_key?: string;
}
export declare class SyncQueueService {
    private logger;
    private config;
    private queue;
    private storagePath;
    private queueFile;
    private metadataFile;
    private retryPolicies;
    private stats;
    constructor(logger: winston.Logger, config: QueueConfig);
    private initializeQueue;
    enqueue(type: QueueItem['type'], payload: any, organizationId: string, priority?: QueueItem['priority'], metadata?: Record<string, any>): Promise<{
        success: boolean;
        item_id?: string;
        message?: string;
    }>;
    dequeue(limit?: number, types?: QueueItem['type'][], organizationId?: string): Promise<QueueItem[]>;
    markProcessed(itemId: string): Promise<{
        success: boolean;
        message?: string;
    }>;
    markFailed(itemId: string, error: string, scheduleRetry?: boolean): Promise<{
        success: boolean;
        retry_scheduled?: boolean;
        message?: string;
    }>;
    getStats(): QueueStats;
    getItems(status?: 'pending' | 'retrying' | 'failed', limit?: number, offset?: number): Promise<QueueItem[]>;
    removeItem(itemId: string): Promise<{
        success: boolean;
        message?: string;
    }>;
    clearFailed(): Promise<{
        success: boolean;
        items_removed: number;
    }>;
    private generateItemId;
    private findInsertPosition;
    private calculateRetryDelay;
    private makeSpace;
    private cleanup;
    private loadQueue;
    private persistQueue;
}
//# sourceMappingURL=sync-queue.service.d.ts.map