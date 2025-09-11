import { MetricsSessionService } from '../services/metrics-session.service';
import { ToolMetricsService } from '../services/tool-metrics.service';
import * as winston from 'winston';
export interface HybridConfig {
    mode: 'local' | 'hybrid' | 'remote';
    remote_endpoint?: string;
    remote_api_key?: string;
    organization_id?: string;
    local_hooks_path?: string;
    sync_interval_ms?: number;
    retry_attempts?: number;
    timeout_ms?: number;
    fallback_threshold_ms?: number;
}
export interface LocalMetricsData {
    session_id?: string;
    user_id: string;
    tool_name?: string;
    agent_name?: string;
    execution_time_ms?: number;
    status?: 'success' | 'error' | 'timeout' | 'cancelled';
    error_message?: string;
    metadata?: Record<string, any>;
    timestamp: Date;
    source: 'local_hook' | 'mcp_call' | 'batch_sync';
}
export interface RemoteAPIResponse {
    success: boolean;
    data?: any;
    error?: string;
    rate_limit?: {
        remaining: number;
        reset_time: string;
    };
}
export interface SyncStatus {
    mode: 'local' | 'hybrid' | 'remote';
    remote_available: boolean;
    last_sync: Date | null;
    pending_items: number;
    sync_errors: number;
    fallback_active: boolean;
    performance: {
        avg_local_time_ms: number;
        avg_remote_time_ms: number;
        sync_success_rate: number;
    };
}
export interface QueuedMetrics {
    id: string;
    data: LocalMetricsData;
    attempts: number;
    last_attempt: Date;
    created: Date;
}
export declare class HybridMetricsCollector {
    private sessionService?;
    private toolMetricsService?;
    private logger;
    private config;
    private localMetricsDir;
    private queueFile;
    private statusFile;
    private syncQueue;
    private syncInProgress;
    private remoteHealth;
    private performanceStats;
    constructor(config: HybridConfig, logger: winston.Logger);
    private initializeCollector;
    setRemoteServices(sessionService: MetricsSessionService, toolMetricsService: ToolMetricsService): void;
    collectMetrics(data: LocalMetricsData): Promise<{
        success: boolean;
        local_saved: boolean;
        remote_synced: boolean;
        fallback_activated: boolean;
        response_time_ms: number;
        message?: string;
    }>;
    private saveLocalMetrics;
    private syncToRemote;
    private syncWithLocalServices;
    private syncWithHttpAPI;
    private queueForRetry;
    private processSyncQueue;
    private processQueueItem;
    private checkRemoteHealth;
    private activateFallbackMode;
    getSyncStatus(): SyncStatus;
    private shouldAttemptRemoteSync;
    private loadSyncQueue;
    private saveSyncQueue;
    private updateLocalPerformanceStats;
    private updateRemotePerformanceStats;
}
//# sourceMappingURL=hybrid-collector.d.ts.map