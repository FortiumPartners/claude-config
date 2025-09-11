import { DatabaseConnection } from '../database/connection';
import { MetricsBatch } from '../types/metrics';
import * as winston from 'winston';
export interface SyncQueueItem {
    id: string;
    type: 'command_execution' | 'agent_interaction' | 'user_session' | 'productivity_metric' | 'batch';
    data: any;
    organization_id: string;
    created_at: Date;
    attempts: number;
    last_attempt?: Date;
    next_retry?: Date;
    priority: 'low' | 'normal' | 'high' | 'critical';
    source: 'local' | 'mcp' | 'batch_import';
}
export interface SyncResult {
    success: boolean;
    synced_items: number;
    failed_items: number;
    conflicts_resolved: number;
    processing_time_ms: number;
    errors?: string[];
}
export interface ConflictResolutionResult {
    resolved: boolean;
    strategy_used: 'remote_wins' | 'merge' | 'skip';
    local_data: any;
    remote_data: any;
    final_data: any;
    reason?: string;
}
export interface SyncStatus {
    queue_size: number;
    sync_in_progress: boolean;
    last_sync: Date | null;
    last_successful_sync: Date | null;
    sync_interval_ms: number;
    offline_mode: boolean;
    remote_available: boolean;
    sync_statistics: {
        total_synced: number;
        total_failed: number;
        conflicts_resolved: number;
        average_sync_time_ms: number;
        success_rate: number;
    };
}
export interface BatchProgress {
    batch_id: string;
    total_items: number;
    processed_items: number;
    successful_items: number;
    failed_items: number;
    conflicts_resolved: number;
    start_time: Date;
    estimated_completion?: Date;
    current_phase: 'validation' | 'processing' | 'conflict_resolution' | 'finalization' | 'complete';
    errors: string[];
}
export interface RemoteEndpoint {
    url: string;
    api_key: string;
    timeout_ms: number;
    retry_attempts: number;
    health_check_interval_ms: number;
}
export declare class DataSyncService {
    private metricsModel;
    private logger;
    private remoteEndpoint;
    private syncQueue;
    private syncInProgress;
    private readonly SYNC_INTERVAL_MS;
    private readonly MAX_QUEUE_SIZE;
    private readonly MAX_BATCH_SIZE;
    private readonly MAX_RETRY_ATTEMPTS;
    private conflictStrategies;
    private syncStats;
    private remoteHealth;
    private activeBatches;
    constructor(db: DatabaseConnection, logger: winston.Logger, remoteEndpoint: RemoteEndpoint);
    private initializeSyncService;
    queueForSync(type: SyncQueueItem['type'], data: any, organizationId: string, priority?: SyncQueueItem['priority'], source?: SyncQueueItem['source']): Promise<{
        success: boolean;
        queue_position?: number;
        message?: string;
    }>;
    processSync(): Promise<SyncResult>;
    private syncItem;
    private syncToRemote;
    private detectConflict;
    private resolveConflict;
    private resolveRemoteWins;
    private resolveMerge;
    private resolveSkip;
    uploadBatch(batch: MetricsBatch, progressCallback?: (progress: BatchProgress) => void): Promise<{
        success: boolean;
        batch_id: string;
        progress: BatchProgress;
    }>;
    getSyncStatus(): SyncStatus;
    getBatchProgress(batchId: string): BatchProgress | null;
    private processBatchItems;
    private validateBatch;
    private findInsertPosition;
    private cleanupQueue;
    private getEndpointForType;
    private getQueryEndpointForType;
    private buildQueryParams;
    private dataConflicts;
    private updateSyncStats;
    private checkRemoteHealth;
    private loadSyncQueue;
    private persistSyncQueue;
}
//# sourceMappingURL=data-sync.service.d.ts.map