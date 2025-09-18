/**
 * Sync Manager for Hybrid Local + Remote Data Synchronization
 * Manages bidirectional synchronization between local hooks and cloud database
 * 
 * Sprint 6 - Task 6.4: Hybrid Mode Implementation
 * Ensures data consistency across local and cloud storage
 */

import { PrismaClient } from '../generated/prisma-client';
import { FormatConverter, ModernSession, ModernToolMetric } from '../compatibility/format-converter';
import { ConflictResolver, ConflictResolutionStrategy } from './conflict-resolver';
import { FailoverHandler } from './failover-handler';
import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export interface SyncConfiguration {
  syncStrategy: 'local_first' | 'remote_first' | 'bidirectional';
  syncInterval: number; // milliseconds
  batchSize: number;
  retryAttempts: number;
  retryDelay: number;
  conflictResolution: ConflictResolutionStrategy;
  enableRealTimeSync: boolean;
  enableOfflineMode: boolean;
  maxLocalCacheSize: number; // MB
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

/**
 * Manages hybrid synchronization between local and remote data stores
 */
export class SyncManager extends EventEmitter {
  private readonly prisma: PrismaClient;
  private readonly config: SyncConfiguration;
  private readonly formatConverter: FormatConverter;
  private readonly conflictResolver: ConflictResolver;
  private readonly failoverHandler: FailoverHandler;
  private readonly localMetricsDir: string;
  
  private syncQueue: SyncQueueItem[] = [];
  private syncInProgress = false;
  private syncInterval: NodeJS.Timeout | null = null;
  private startTime = Date.now();
  private syncStats = {
    totalSynced: 0,
    totalConflicts: 0,
    totalErrors: 0
  };

  constructor(prisma: PrismaClient, config: SyncConfiguration) {
    super();
    this.prisma = prisma;
    this.config = config;
    this.formatConverter = new FormatConverter();
    this.conflictResolver = new ConflictResolver(config.conflictResolution);
    this.failoverHandler = new FailoverHandler(prisma, config.tenantSchemaName);
    this.localMetricsDir = path.join(os.homedir(), '.agent-os', 'metrics');
    
    this.initialize();
  }

  /**
   * Initialize sync manager and start periodic sync
   */
  private initialize(): void {
    console.log('🔄 Initializing Hybrid Sync Manager...');
    
    // Setup periodic sync
    if (this.config.syncInterval > 0) {
      this.startPeriodicSync();
    }
    
    // Setup real-time sync listeners
    if (this.config.enableRealTimeSync) {
      this.setupRealTimeSyncListeners();
    }
    
    // Setup offline mode handling
    if (this.config.enableOfflineMode) {
      this.setupOfflineModeHandling();
    }
    
    console.log('✅ Sync Manager initialized');
    this.emit('initialized');
  }

  /**
   * Start periodic synchronization
   */
  private startPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    
    this.syncInterval = setInterval(async () => {
      try {
        await this.performSync();
      } catch (error) {
        console.error('Periodic sync failed:', error);
        this.emit('syncError', error);
      }
    }, this.config.syncInterval);
    
    console.log(`📅 Periodic sync started (interval: ${this.config.syncInterval}ms)`);
  }

  /**
   * Perform comprehensive synchronization
   */
  async performSync(): Promise<SyncResult> {
    if (this.syncInProgress) {
      throw new Error('Sync already in progress');
    }
    
    this.syncInProgress = true;
    const syncId = this.generateSyncId();
    const startTime = new Date();
    
    console.log(`🔄 Starting sync ${syncId} (${this.config.syncStrategy})`);
    
    const result: SyncResult = {
      success: false,
      syncId,
      startTime,
      endTime: new Date(),
      direction: this.mapSyncStrategyToDirection(),
      localChanges: {
        sessionsProcessed: 0,
        toolMetricsProcessed: 0,
        sessionsUploaded: 0,
        toolMetricsUploaded: 0,
        uploadErrors: []
      },
      remoteChanges: {
        sessionsProcessed: 0,
        toolMetricsProcessed: 0,
        sessionsDownloaded: 0,
        toolMetricsDownloaded: 0,
        downloadErrors: []
      },
      conflicts: {
        sessionsConflicted: 0,
        toolMetricsConflicted: 0,
        resolutionStrategy: this.config.conflictResolution,
        resolvedConflicts: 0,
        unresolvedConflicts: 0
      },
      performance: {
        totalDurationMs: 0,
        throughputRecordsPerSecond: 0,
        networkLatencyMs: 0,
        localIOTimeMs: 0,
        remoteIOTimeMs: 0
      }
    };

    try {
      // Check connectivity
      const connectionStatus = await this.checkConnectionStatus();
      
      if (connectionStatus === 'offline' && !this.config.enableOfflineMode) {
        throw new Error('Remote server unavailable and offline mode disabled');
      }
      
      // Perform sync based on strategy
      switch (this.config.syncStrategy) {
        case 'local_first':
          await this.syncLocalToRemote(result);
          break;
        case 'remote_first':
          await this.syncRemoteToLocal(result);
          break;
        case 'bidirectional':
          await this.syncBidirectional(result);
          break;
      }
      
      // Process sync queue
      await this.processSyncQueue(result);
      
      result.success = true;
      result.endTime = new Date();
      result.performance.totalDurationMs = result.endTime.getTime() - result.startTime.getTime();
      
      const totalRecords = result.localChanges.sessionsProcessed + 
                          result.localChanges.toolMetricsProcessed + 
                          result.remoteChanges.sessionsProcessed + 
                          result.remoteChanges.toolMetricsProcessed;
      
      result.performance.throughputRecordsPerSecond = totalRecords > 0 ? 
        Math.round((totalRecords / result.performance.totalDurationMs) * 1000) : 0;
      
      // Update stats
      this.syncStats.totalSynced += totalRecords;
      this.syncStats.totalConflicts += result.conflicts.sessionsConflicted + result.conflicts.toolMetricsConflicted;
      
      console.log(`✅ Sync ${syncId} completed successfully in ${result.performance.totalDurationMs}ms`);
      console.log(`📊 Processed: ${totalRecords} records, Conflicts: ${result.conflicts.resolvedConflicts}/${result.conflicts.unresolvedConflicts}`);
      
      this.emit('syncComplete', result);
      return result;
      
    } catch (error) {
      result.success = false;
      result.endTime = new Date();
      result.performance.totalDurationMs = result.endTime.getTime() - result.startTime.getTime();
      
      this.syncStats.totalErrors++;
      
      console.error(`❌ Sync ${syncId} failed:`, error);
      this.emit('syncError', { syncId, error, result });
      
      // Trigger failover if needed
      if (error.message.includes('connection') || error.message.includes('network')) {
        await this.failoverHandler.handleConnectionFailure();
      }
      
      return result;
      
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Sync local data to remote (upload)
   */
  private async syncLocalToRemote(result: SyncResult): Promise<void> {
    console.log('📤 Syncing local data to remote...');
    const localIOStart = Date.now();
    
    // Get local sessions that need sync
    const localSessions = await this.getUnsyncedLocalSessions();
    result.localChanges.sessionsProcessed = localSessions.length;
    
    // Get local tool metrics that need sync  
    const localToolMetrics = await this.getUnsyncedLocalToolMetrics();
    result.localChanges.toolMetricsProcessed = localToolMetrics.length;
    
    result.performance.localIOTimeMs = Date.now() - localIOStart;
    
    if (localSessions.length === 0 && localToolMetrics.length === 0) {
      console.log('📤 No local data to sync');
      return;
    }
    
    const remoteIOStart = Date.now();
    
    // Sync sessions in batches
    for (const sessionBatch of this.createBatches(localSessions, this.config.batchSize)) {
      try {
        for (const session of sessionBatch) {
          // Check for conflicts
          const remoteSession = await this.getRemoteSession(session.id);
          if (remoteSession && remoteSession.updatedAt > session.updatedAt) {
            // Conflict detected
            result.conflicts.sessionsConflicted++;
            const resolved = await this.conflictResolver.resolveSessionConflict(session, remoteSession);
            if (resolved) {
              await this.uploadSession(resolved);
              result.conflicts.resolvedConflicts++;
              result.localChanges.sessionsUploaded++;
            } else {
              result.conflicts.unresolvedConflicts++;
            }
          } else {
            // No conflict, upload normally
            await this.uploadSession(session);
            result.localChanges.sessionsUploaded++;
          }
        }
      } catch (error) {
        result.localChanges.uploadErrors.push(`Session batch upload failed: ${error.message}`);
      }
    }
    
    // Sync tool metrics in batches
    for (const metricBatch of this.createBatches(localToolMetrics, this.config.batchSize)) {
      try {
        for (const metric of metricBatch) {
          // Check for conflicts
          const remoteMetric = await this.getRemoteToolMetric(metric.id);
          if (remoteMetric && remoteMetric.updatedAt > metric.updatedAt) {
            // Conflict detected
            result.conflicts.toolMetricsConflicted++;
            const resolved = await this.conflictResolver.resolveToolMetricConflict(metric, remoteMetric);
            if (resolved) {
              await this.uploadToolMetric(resolved);
              result.conflicts.resolvedConflicts++;
              result.localChanges.toolMetricsUploaded++;
            } else {
              result.conflicts.unresolvedConflicts++;
            }
          } else {
            // No conflict, upload normally
            await this.uploadToolMetric(metric);
            result.localChanges.toolMetricsUploaded++;
          }
        }
      } catch (error) {
        result.localChanges.uploadErrors.push(`Tool metric batch upload failed: ${error.message}`);
      }
    }
    
    result.performance.remoteIOTimeMs = Date.now() - remoteIOStart;
    
    console.log(`📤 Uploaded ${result.localChanges.sessionsUploaded} sessions, ${result.localChanges.toolMetricsUploaded} tool metrics`);
  }

  /**
   * Sync remote data to local (download)
   */
  private async syncRemoteToLocal(result: SyncResult): Promise<void> {
    console.log('📥 Syncing remote data to local...');
    const remoteIOStart = Date.now();
    
    // Get remote changes since last sync
    const lastSyncTime = await this.getLastSyncTime();
    const remoteSessions = await this.getRemoteSessionsSince(lastSyncTime);
    result.remoteChanges.sessionsProcessed = remoteSessions.length;
    
    const remoteToolMetrics = await this.getRemoteToolMetricsSince(lastSyncTime);
    result.remoteChanges.toolMetricsProcessed = remoteToolMetrics.length;
    
    result.performance.remoteIOTimeMs = Date.now() - remoteIOStart;
    
    if (remoteSessions.length === 0 && remoteToolMetrics.length === 0) {
      console.log('📥 No remote data to sync');
      return;
    }
    
    const localIOStart = Date.now();
    
    // Sync remote sessions to local
    for (const session of remoteSessions) {
      try {
        // Check for conflicts
        const localSession = await this.getLocalSession(session.id);
        if (localSession && localSession.updatedAt > session.updatedAt) {
          // Conflict detected
          result.conflicts.sessionsConflicted++;
          const resolved = await this.conflictResolver.resolveSessionConflict(localSession, session);
          if (resolved) {
            await this.saveLocalSession(resolved);
            result.conflicts.resolvedConflicts++;
            result.remoteChanges.sessionsDownloaded++;
          } else {
            result.conflicts.unresolvedConflicts++;
          }
        } else {
          // No conflict, download normally
          await this.saveLocalSession(session);
          result.remoteChanges.sessionsDownloaded++;
        }
      } catch (error) {
        result.remoteChanges.downloadErrors.push(`Session ${session.id} download failed: ${error.message}`);
      }
    }
    
    // Sync remote tool metrics to local
    for (const metric of remoteToolMetrics) {
      try {
        // Check for conflicts
        const localMetric = await this.getLocalToolMetric(metric.id);
        if (localMetric && localMetric.updatedAt > metric.updatedAt) {
          // Conflict detected
          result.conflicts.toolMetricsConflicted++;
          const resolved = await this.conflictResolver.resolveToolMetricConflict(localMetric, metric);
          if (resolved) {
            await this.saveLocalToolMetric(resolved);
            result.conflicts.resolvedConflicts++;
            result.remoteChanges.toolMetricsDownloaded++;
          } else {
            result.conflicts.unresolvedConflicts++;
          }
        } else {
          // No conflict, download normally
          await this.saveLocalToolMetric(metric);
          result.remoteChanges.toolMetricsDownloaded++;
        }
      } catch (error) {
        result.remoteChanges.downloadErrors.push(`Tool metric ${metric.id} download failed: ${error.message}`);
      }
    }
    
    result.performance.localIOTimeMs += Date.now() - localIOStart;
    
    console.log(`📥 Downloaded ${result.remoteChanges.sessionsDownloaded} sessions, ${result.remoteChanges.toolMetricsDownloaded} tool metrics`);
  }

  /**
   * Bidirectional synchronization
   */
  private async syncBidirectional(result: SyncResult): Promise<void> {
    console.log('🔄 Performing bidirectional sync...');
    
    // First sync local to remote
    await this.syncLocalToRemote(result);
    
    // Then sync remote to local  
    await this.syncRemoteToLocal(result);
    
    result.direction = 'bidirectional';
  }

  /**
   * Process items in sync queue
   */
  private async processSyncQueue(result: SyncResult): Promise<void> {
    if (this.syncQueue.length === 0) return;
    
    console.log(`📋 Processing ${this.syncQueue.length} queued items...`);
    
    // Sort by priority and timestamp
    this.syncQueue.sort((a, b) => {
      const priorityOrder = { 'high': 0, 'normal': 1, 'low': 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return a.timestamp.getTime() - b.timestamp.getTime();
    });
    
    const processedItems: string[] = [];
    
    for (const item of this.syncQueue) {
      try {
        await this.processSyncQueueItem(item);
        processedItems.push(item.id);
      } catch (error) {
        item.retryCount++;
        if (item.retryCount >= this.config.retryAttempts) {
          console.warn(`Queue item ${item.id} exceeded retry limit, removing from queue`);
          processedItems.push(item.id);
        }
      }
    }
    
    // Remove processed items
    this.syncQueue = this.syncQueue.filter(item => !processedItems.includes(item.id));
    
    console.log(`📋 Processed ${processedItems.length} queue items`);
  }

  /**
   * Add item to sync queue
   */
  addToSyncQueue(type: 'session' | 'toolMetric', operation: 'create' | 'update' | 'delete', data: any, priority: 'high' | 'normal' | 'low' = 'normal'): void {
    const item: SyncQueueItem = {
      id: this.generateId(),
      type,
      operation,
      data,
      timestamp: new Date(),
      retryCount: 0,
      priority
    };
    
    this.syncQueue.push(item);
    
    // Trigger immediate sync for high priority items
    if (priority === 'high' && this.config.enableRealTimeSync && !this.syncInProgress) {
      setImmediate(() => this.performSync().catch(error => console.error('Real-time sync failed:', error)));
    }
  }

  /**
   * Get current sync status
   */
  getSyncStatus(): SyncStatus {
    const pendingLocal = this.syncQueue.filter(item => 
      ['create', 'update'].includes(item.operation) && this.isLocalItem(item)
    ).length;
    
    const pendingRemote = this.syncQueue.filter(item => 
      ['create', 'update'].includes(item.operation) && !this.isLocalItem(item)
    ).length;
    
    return {
      lastSync: new Date(), // Would track actual last sync time
      syncInProgress: this.syncInProgress,
      pendingLocal,
      pendingRemote,
      conflicts: this.syncStats.totalConflicts,
      failedAttempts: this.syncStats.totalErrors,
      totalSynced: this.syncStats.totalSynced,
      uptime: Date.now() - this.startTime,
      connectionStatus: 'online' // Would check actual connection status
    };
  }

  /**
   * Force immediate sync
   */
  async forcSync(): Promise<SyncResult> {
    return this.performSync();
  }

  /**
   * Stop sync manager
   */
  stop(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    console.log('🛑 Sync Manager stopped');
    this.emit('stopped');
  }

  // Private helper methods

  private setupRealTimeSyncListeners(): void {
    // Listen for file system changes in local metrics directory
    // Implementation would use fs.watch or chokidar for file watching
    console.log('👁  Real-time sync listeners setup');
  }

  private setupOfflineModeHandling(): void {
    // Setup network connectivity monitoring
    console.log('📡 Offline mode handling setup');
  }

  private async checkConnectionStatus(): Promise<'online' | 'offline' | 'degraded'> {
    try {
      // Test database connectivity
      await this.prisma.$queryRaw`SELECT 1`;
      return 'online';
    } catch (error) {
      return 'offline';
    }
  }

  private mapSyncStrategyToDirection(): 'local_to_remote' | 'remote_to_local' | 'bidirectional' {
    switch (this.config.syncStrategy) {
      case 'local_first': return 'local_to_remote';
      case 'remote_first': return 'remote_to_local';
      case 'bidirectional': return 'bidirectional';
    }
  }

  private generateSyncId(): string {
    return `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateId(): string {
    const crypto = require('crypto');
    return crypto.randomUUID();
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private isLocalItem(item: SyncQueueItem): boolean {
    // Implementation would determine if item originated locally
    return true; // Simplified for now
  }

  // Placeholder methods for actual implementation
  private async getUnsyncedLocalSessions(): Promise<any[]> { return []; }
  private async getUnsyncedLocalToolMetrics(): Promise<any[]> { return []; }
  private async getRemoteSession(id: string): Promise<any> { return null; }
  private async getRemoteToolMetric(id: string): Promise<any> { return null; }
  private async uploadSession(session: any): Promise<void> { }
  private async uploadToolMetric(metric: any): Promise<void> { }
  private async getLastSyncTime(): Promise<Date> { return new Date(Date.now() - 24 * 60 * 60 * 1000); }
  private async getRemoteSessionsSince(since: Date): Promise<any[]> { return []; }
  private async getRemoteToolMetricsSince(since: Date): Promise<any[]> { return []; }
  private async getLocalSession(id: string): Promise<any> { return null; }
  private async getLocalToolMetric(id: string): Promise<any> { return null; }
  private async saveLocalSession(session: any): Promise<void> { }
  private async saveLocalToolMetric(metric: any): Promise<void> { }
  private async processSyncQueueItem(item: SyncQueueItem): Promise<void> { }
}

/**
 * Create sync manager with default configuration
 */
export function createSyncManager(
  prisma: PrismaClient, 
  tenantSchemaName: string,
  overrides: Partial<SyncConfiguration> = {}
): SyncManager {
  const defaultConfig: SyncConfiguration = {
    syncStrategy: 'bidirectional',
    syncInterval: 5 * 60 * 1000, // 5 minutes
    batchSize: 50,
    retryAttempts: 3,
    retryDelay: 1000,
    conflictResolution: 'remote_wins',
    enableRealTimeSync: true,
    enableOfflineMode: true,
    maxLocalCacheSize: 100, // 100MB
    tenantSchemaName,
    ...overrides
  };

  return new SyncManager(prisma, defaultConfig);
}