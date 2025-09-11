import { PrismaClient } from '../generated/prisma-client';
import { ConflictResolutionStrategy } from './conflict-resolver';
import { EventEmitter } from 'events';
export interface SyncConfiguration {
    syncStrategy: 'local_first' | 'remote_first' | 'bidirectional';
    syncInterval: number;
    batchSize: number;
    retryAttempts: number;
    retryDelay: number;
    conflictResolution: ConflictResolutionStrategy;
    enableRealTimeSync: boolean;
    enableOfflineMode: boolean;
    maxLocalCacheSize: number;
    tenantSchemaName: string;
}
export interface SyncStatus {
    lastSync: Date;
    syncInProgress: boolean;
    pendingLocal: number;
    pendingRemote: number;
    conflicts: number;
    failedAttempts: number;
    totalSynced: number;
    uptime: number;
    connectionStatus: 'online' | 'offline' | 'degraded';
}
export interface SyncResult {
    success: boolean;
    syncId: string;
    startTime: Date;
    endTime: Date;
    direction: 'local_to_remote' | 'remote_to_local' | 'bidirectional';
    localChanges: {
        sessionsProcessed: number;
        toolMetricsProcessed: number;
        sessionsUploaded: number;
        toolMetricsUploaded: number;
        uploadErrors: string[];
    };
    remoteChanges: {
        sessionsProcessed: number;
        toolMetricsProcessed: number;
        sessionsDownloaded: number;
        toolMetricsDownloaded: number;
        downloadErrors: string[];
    };
    conflicts: {
        sessionsConflicted: number;
        toolMetricsConflicted: number;
        resolutionStrategy: string;
        resolvedConflicts: number;
        unresolvedConflicts: number;
    };
    performance: {
        totalDurationMs: number;
        throughputRecordsPerSecond: number;
        networkLatencyMs: number;
        localIOTimeMs: number;
        remoteIOTimeMs: number;
    };
}
export interface SyncQueueItem {
    id: string;
    type: 'session' | 'toolMetric';
    operation: 'create' | 'update' | 'delete';
    data: any;
    timestamp: Date;
    retryCount: number;
    priority: 'high' | 'normal' | 'low';
}
export declare class SyncManager extends EventEmitter {
    private readonly prisma;
    private readonly config;
    private readonly formatConverter;
    private readonly conflictResolver;
    private readonly failoverHandler;
    private readonly localMetricsDir;
    private syncQueue;
    private syncInProgress;
    private syncInterval;
    private startTime;
    private syncStats;
    constructor(prisma: PrismaClient, config: SyncConfiguration);
    private initialize;
    private startPeriodicSync;
    performSync(): Promise<SyncResult>;
    private syncLocalToRemote;
    private syncRemoteToLocal;
    private syncBidirectional;
    private processSyncQueue;
    addToSyncQueue(type: 'session' | 'toolMetric', operation: 'create' | 'update' | 'delete', data: any, priority?: 'high' | 'normal' | 'low'): void;
    getSyncStatus(): SyncStatus;
    forcSync(): Promise<SyncResult>;
    stop(): void;
    private setupRealTimeSyncListeners;
    private setupOfflineModeHandling;
    private checkConnectionStatus;
    private mapSyncStrategyToDirection;
    private generateSyncId;
    private generateId;
    private createBatches;
    private isLocalItem;
    private getUnsyncedLocalSessions;
    private getUnsyncedLocalToolMetrics;
    private getRemoteSession;
    private getRemoteToolMetric;
    private uploadSession;
    private uploadToolMetric;
    private getLastSyncTime;
    private getRemoteSessionsSince;
    private getRemoteToolMetricsSince;
    private getLocalSession;
    private getLocalToolMetric;
    private saveLocalSession;
    private saveLocalToolMetric;
    private processSyncQueueItem;
}
export declare function createSyncManager(prisma: PrismaClient, tenantSchemaName: string, overrides?: Partial<SyncConfiguration>): SyncManager;
//# sourceMappingURL=sync-manager.d.ts.map