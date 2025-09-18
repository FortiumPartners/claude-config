/**
 * Data Synchronization Service
 * Task 3.4: Real-time sync with conflict resolution and offline capability
 * 
 * Provides real-time sync with conflict resolution (remote wins),
 * batch upload for bulk data with progress tracking, and offline
 * capability with local queue (5-minute sync intervals).
 */

import { MetricsModel } from '../models/metrics.model';
import { DatabaseConnection } from '../database/connection';
import {
  CommandExecution,
  CommandExecutionCreate,
  AgentInteraction,
  AgentInteractionCreate,
  UserSession,
  UserSessionCreate,
  UserSessionUpdate,
  ProductivityMetric,
  ProductivityMetricCreate,
  MetricsBatch
} from '../types/metrics';
import * as winston from 'winston';
import fetch from 'node-fetch';

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

export class DataSyncService {
  private metricsModel: MetricsModel;
  private logger: winston.Logger;
  private remoteEndpoint: RemoteEndpoint;
  
  // Sync queue management
  private syncQueue: SyncQueueItem[] = [];
  private syncInProgress = false;
  private readonly SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_QUEUE_SIZE = 10000;
  private readonly MAX_BATCH_SIZE = 100;
  private readonly MAX_RETRY_ATTEMPTS = 3;
  
  // Conflict resolution strategies
  private conflictStrategies = {
    'remote_wins': this.resolveRemoteWins.bind(this),
    'merge': this.resolveMerge.bind(this),
    'skip': this.resolveSkip.bind(this)
  };
  
  // Sync statistics
  private syncStats = {
    total_synced: 0,
    total_failed: 0,
    conflicts_resolved: 0,
    total_sync_time_ms: 0,
    sync_count: 0
  };
  
  // Remote endpoint health
  private remoteHealth = {
    available: true,
    last_check: new Date(0),
    consecutive_failures: 0,
    response_time_ms: 0
  };
  
  // Batch processing tracking
  private activeBatches: Map<string, BatchProgress> = new Map();

  constructor(
    db: DatabaseConnection,
    logger: winston.Logger,
    remoteEndpoint: RemoteEndpoint
  ) {
    this.metricsModel = new MetricsModel(db);
    this.logger = logger;
    this.remoteEndpoint = remoteEndpoint;
    
    this.initializeSyncService();
  }

  /**
   * Initialize sync service
   */
  private async initializeSyncService(): Promise<void> {
    try {
      // Load persisted sync queue
      await this.loadSyncQueue();
      
      // Start sync timer
      setInterval(() => this.processSync(), this.SYNC_INTERVAL_MS);
      
      // Start health check timer
      setInterval(
        () => this.checkRemoteHealth(),
        this.remoteEndpoint.health_check_interval_ms
      );
      
      // Initial health check
      await this.checkRemoteHealth();
      
      this.logger.info('Data sync service initialized', {
        sync_interval_ms: this.SYNC_INTERVAL_MS,
        queue_size: this.syncQueue.length,
        remote_endpoint: this.remoteEndpoint.url
      });
      
    } catch (error) {
      this.logger.error('Failed to initialize sync service', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Queue item for synchronization
   */
  async queueForSync(
    type: SyncQueueItem['type'],
    data: any,
    organizationId: string,
    priority: SyncQueueItem['priority'] = 'normal',
    source: SyncQueueItem['source'] = 'local'
  ): Promise<{ success: boolean; queue_position?: number; message?: string }> {
    try {
      // Check queue size limit
      if (this.syncQueue.length >= this.MAX_QUEUE_SIZE) {
        // Remove oldest low-priority items to make space
        this.cleanupQueue();
        
        if (this.syncQueue.length >= this.MAX_QUEUE_SIZE) {
          return {
            success: false,
            message: 'Sync queue is full. Cannot queue new items.'
          };
        }
      }
      
      const queueItem: SyncQueueItem = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type,
        data,
        organization_id: organizationId,
        created_at: new Date(),
        attempts: 0,
        priority,
        source
      };
      
      // Insert based on priority
      const insertIndex = this.findInsertPosition(queueItem);
      this.syncQueue.splice(insertIndex, 0, queueItem);
      
      // Persist queue
      await this.persistSyncQueue();
      
      // Trigger immediate sync for critical items
      if (priority === 'critical' && this.remoteHealth.available) {
        setImmediate(() => this.processSync());
      }
      
      return {
        success: true,
        queue_position: insertIndex + 1
      };
      
    } catch (error) {
      this.logger.error('Failed to queue item for sync', {
        type,
        organization_id: organizationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to queue item'
      };
    }
  }

  /**
   * Process sync queue
   */
  async processSync(): Promise<SyncResult> {
    if (this.syncInProgress || this.syncQueue.length === 0) {
      return {
        success: true,
        synced_items: 0,
        failed_items: 0,
        conflicts_resolved: 0,
        processing_time_ms: 0
      };
    }
    
    if (!this.remoteHealth.available) {
      await this.checkRemoteHealth();
      if (!this.remoteHealth.available) {
        this.logger.debug('Skipping sync - remote endpoint unavailable');
        return {
          success: false,
          synced_items: 0,
          failed_items: 0,
          conflicts_resolved: 0,
          processing_time_ms: 0,
          errors: ['Remote endpoint unavailable']
        };
      }
    }
    
    this.syncInProgress = true;
    const startTime = performance.now();
    
    try {
      // Process items in batches
      const batch = this.syncQueue.splice(0, this.MAX_BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(item => this.syncItem(item))
      );
      
      let syncedItems = 0;
      let failedItems = 0;
      let conflictsResolved = 0;
      const errors: string[] = [];
      
      results.forEach((result, index) => {
        const item = batch[index];
        
        if (result.status === 'fulfilled' && result.value.success) {
          syncedItems++;
          if (result.value.conflict_resolved) {
            conflictsResolved++;
          }
        } else {
          failedItems++;
          item.attempts++;
          item.last_attempt = new Date();
          
          // Calculate next retry time with exponential backoff
          const backoffMs = Math.min(
            1000 * Math.pow(2, item.attempts - 1),
            60000 // Max 1 minute
          );
          item.next_retry = new Date(Date.now() + backoffMs);
          
          // Re-queue if under retry limit
          if (item.attempts < this.MAX_RETRY_ATTEMPTS) {
            this.syncQueue.push(item);
          } else {
            const error = result.status === 'rejected' 
              ? result.reason instanceof Error ? result.reason.message : 'Unknown error'
              : 'Max retry attempts exceeded';
            errors.push(`Item ${item.id}: ${error}`);
          }
        }
      });
      
      const processingTime = performance.now() - startTime;
      
      // Update statistics
      this.updateSyncStats(syncedItems, failedItems, conflictsResolved, processingTime);
      
      // Persist updated queue
      await this.persistSyncQueue();
      
      this.logger.info('Sync batch processed', {
        synced_items: syncedItems,
        failed_items: failedItems,
        conflicts_resolved: conflictsResolved,
        processing_time_ms: processingTime,
        queue_remaining: this.syncQueue.length
      });
      
      return {
        success: true,
        synced_items: syncedItems,
        failed_items: failedItems,
        conflicts_resolved: conflictsResolved,
        processing_time_ms: processingTime,
        errors: errors.length > 0 ? errors : undefined
      };
      
    } catch (error) {
      const processingTime = performance.now() - startTime;
      
      this.logger.error('Sync processing failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        processing_time_ms: processingTime
      });
      
      return {
        success: false,
        synced_items: 0,
        failed_items: this.syncQueue.length,
        conflicts_resolved: 0,
        processing_time_ms: processingTime,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
      
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Sync individual item
   */
  private async syncItem(item: SyncQueueItem): Promise<{
    success: boolean;
    conflict_resolved: boolean;
    error?: string;
  }> {
    try {
      // Check for conflicts
      const conflict = await this.detectConflict(item);
      let conflictResolved = false;
      
      if (conflict) {
        const resolution = await this.resolveConflict(conflict, item);
        if (!resolution.resolved) {
          throw new Error(`Conflict resolution failed: ${resolution.reason}`);
        }
        
        // Update item data with resolved data
        item.data = resolution.final_data;
        conflictResolved = true;
      }
      
      // Sync to remote
      await this.syncToRemote(item);
      
      return {
        success: true,
        conflict_resolved: conflictResolved
      };
      
    } catch (error) {
      return {
        success: false,
        conflict_resolved: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Sync item to remote endpoint
   */
  private async syncToRemote(item: SyncQueueItem): Promise<void> {
    const endpoint = this.getEndpointForType(item.type);
    const timeout = new AbortController();
    const timeoutId = setTimeout(() => timeout.abort(), this.remoteEndpoint.timeout_ms);
    
    try {
      const response = await fetch(`${this.remoteEndpoint.url}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.remoteEndpoint.api_key}`,
          'X-Organization-ID': item.organization_id,
          'X-Sync-Source': item.source,
          'X-Item-Priority': item.priority
        },
        body: JSON.stringify({
          type: item.type,
          data: item.data,
          metadata: {
            queue_id: item.id,
            created_at: item.created_at.toISOString(),
            attempts: item.attempts,
            source: item.source
          }
        }),
        signal: timeout.signal
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Remote sync failed');
      }
      
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Detect conflicts between local and remote data
   */
  private async detectConflict(item: SyncQueueItem): Promise<any | null> {
    try {
      // Query remote for existing data
      const endpoint = this.getQueryEndpointForType(item.type);
      const queryParams = this.buildQueryParams(item);
      
      const response = await fetch(
        `${this.remoteEndpoint.url}${endpoint}?${queryParams}`,
        {
          headers: {
            'Authorization': `Bearer ${this.remoteEndpoint.api_key}`,
            'X-Organization-ID': item.organization_id
          }
        }
      );
      
      if (!response.ok) {
        if (response.status === 404) {
          return null; // No conflict - item doesn't exist remotely
        }
        throw new Error(`Conflict detection failed: ${response.status}`);
      }
      
      const remoteData = await response.json();
      
      // Check if data differs
      if (this.dataConflicts(item.data, remoteData.data)) {
        return remoteData.data;
      }
      
      return null;
      
    } catch (error) {
      this.logger.warn('Failed to detect conflict', {
        item_id: item.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null; // Assume no conflict on error
    }
  }

  /**
   * Resolve data conflict using configured strategy
   */
  private async resolveConflict(
    remoteData: any,
    item: SyncQueueItem
  ): Promise<ConflictResolutionResult> {
    try {
      // Default strategy is 'remote_wins' as per requirements
      const strategy = 'remote_wins';
      const resolver = this.conflictStrategies[strategy];
      
      return await resolver(item.data, remoteData, item);
      
    } catch (error) {
      return {
        resolved: false,
        strategy_used: 'remote_wins',
        local_data: item.data,
        remote_data: remoteData,
        final_data: item.data,
        reason: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Remote wins conflict resolution strategy
   */
  private async resolveRemoteWins(
    localData: any,
    remoteData: any,
    item: SyncQueueItem
  ): Promise<ConflictResolutionResult> {
    return {
      resolved: true,
      strategy_used: 'remote_wins',
      local_data: localData,
      remote_data: remoteData,
      final_data: remoteData // Remote data wins
    };
  }

  /**
   * Merge conflict resolution strategy
   */
  private async resolveMerge(
    localData: any,
    remoteData: any,
    item: SyncQueueItem
  ): Promise<ConflictResolutionResult> {
    try {
      // Simple merge strategy - combine non-conflicting fields
      const merged = {
        ...localData,
        ...remoteData,
        // Keep latest timestamp
        updated_at: new Date(
          Math.max(
            new Date(localData.updated_at || 0).getTime(),
            new Date(remoteData.updated_at || 0).getTime()
          )
        ).toISOString(),
        // Track conflict resolution
        _conflict_resolution: {
          strategy: 'merge',
          resolved_at: new Date().toISOString(),
          local_version: localData,
          remote_version: remoteData
        }
      };
      
      return {
        resolved: true,
        strategy_used: 'merge',
        local_data: localData,
        remote_data: remoteData,
        final_data: merged
      };
      
    } catch (error) {
      return {
        resolved: false,
        strategy_used: 'merge',
        local_data: localData,
        remote_data: remoteData,
        final_data: localData,
        reason: error instanceof Error ? error.message : 'Merge failed'
      };
    }
  }

  /**
   * Skip conflict resolution strategy
   */
  private async resolveSkip(
    localData: any,
    remoteData: any,
    item: SyncQueueItem
  ): Promise<ConflictResolutionResult> {
    return {
      resolved: true,
      strategy_used: 'skip',
      local_data: localData,
      remote_data: remoteData,
      final_data: localData // Keep local data unchanged
    };
  }

  /**
   * Batch upload with progress tracking
   */
  async uploadBatch(
    batch: MetricsBatch,
    progressCallback?: (progress: BatchProgress) => void
  ): Promise<{ success: boolean; batch_id: string; progress: BatchProgress }> {
    const batchId = `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Calculate total items
    const totalItems = 
      (batch.command_executions?.length || 0) +
      (batch.agent_interactions?.length || 0) +
      (batch.user_sessions?.length || 0) +
      (batch.productivity_metrics?.length || 0);
    
    const progress: BatchProgress = {
      batch_id: batchId,
      total_items: totalItems,
      processed_items: 0,
      successful_items: 0,
      failed_items: 0,
      conflicts_resolved: 0,
      start_time: new Date(),
      current_phase: 'validation',
      errors: []
    };
    
    this.activeBatches.set(batchId, progress);
    
    try {
      // Phase 1: Validation
      progress.current_phase = 'validation';
      progressCallback?.(progress);
      
      await this.validateBatch(batch);
      
      // Phase 2: Processing
      progress.current_phase = 'processing';
      progressCallback?.(progress);
      
      // Process each type of metrics
      if (batch.command_executions) {
        await this.processBatchItems(
          'command_execution',
          batch.command_executions,
          batch.organization_id,
          progress,
          progressCallback
        );
      }
      
      if (batch.agent_interactions) {
        await this.processBatchItems(
          'agent_interaction',
          batch.agent_interactions,
          batch.organization_id,
          progress,
          progressCallback
        );
      }
      
      if (batch.user_sessions) {
        await this.processBatchItems(
          'user_session',
          batch.user_sessions,
          batch.organization_id,
          progress,
          progressCallback
        );
      }
      
      if (batch.productivity_metrics) {
        await this.processBatchItems(
          'productivity_metric',
          batch.productivity_metrics,
          batch.organization_id,
          progress,
          progressCallback
        );
      }
      
      // Phase 3: Finalization
      progress.current_phase = 'finalization';
      progress.estimated_completion = new Date();
      progressCallback?.(progress);
      
      // Phase 4: Complete
      progress.current_phase = 'complete';
      progressCallback?.(progress);
      
      this.logger.info('Batch upload completed', {
        batch_id: batchId,
        total_items: totalItems,
        successful_items: progress.successful_items,
        failed_items: progress.failed_items,
        conflicts_resolved: progress.conflicts_resolved
      });
      
      return {
        success: true,
        batch_id: batchId,
        progress
      };
      
    } catch (error) {
      progress.current_phase = 'complete';
      progress.errors.push(error instanceof Error ? error.message : 'Unknown error');
      progressCallback?.(progress);
      
      this.logger.error('Batch upload failed', {
        batch_id: batchId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return {
        success: false,
        batch_id: batchId,
        progress
      };
      
    } finally {
      // Clean up after 1 hour
      setTimeout(() => {
        this.activeBatches.delete(batchId);
      }, 60 * 60 * 1000);
    }
  }

  /**
   * Get sync status
   */
  getSyncStatus(): SyncStatus {
    const successRate = (this.syncStats.total_synced + this.syncStats.total_failed) > 0
      ? this.syncStats.total_synced / (this.syncStats.total_synced + this.syncStats.total_failed)
      : 0;
      
    const avgSyncTime = this.syncStats.sync_count > 0
      ? this.syncStats.total_sync_time_ms / this.syncStats.sync_count
      : 0;
    
    return {
      queue_size: this.syncQueue.length,
      sync_in_progress: this.syncInProgress,
      last_sync: this.syncStats.sync_count > 0 ? new Date() : null,
      last_successful_sync: this.syncStats.total_synced > 0 ? new Date() : null,
      sync_interval_ms: this.SYNC_INTERVAL_MS,
      offline_mode: !this.remoteHealth.available,
      remote_available: this.remoteHealth.available,
      sync_statistics: {
        total_synced: this.syncStats.total_synced,
        total_failed: this.syncStats.total_failed,
        conflicts_resolved: this.syncStats.conflicts_resolved,
        average_sync_time_ms: avgSyncTime,
        success_rate: successRate
      }
    };
  }

  /**
   * Get batch progress
   */
  getBatchProgress(batchId: string): BatchProgress | null {
    return this.activeBatches.get(batchId) || null;
  }

  // Helper methods

  private async processBatchItems(
    type: SyncQueueItem['type'],
    items: any[],
    organizationId: string,
    progress: BatchProgress,
    progressCallback?: (progress: BatchProgress) => void
  ): Promise<void> {
    for (const item of items) {
      try {
        await this.queueForSync(type, item, organizationId, 'normal', 'batch_import');
        progress.successful_items++;
      } catch (error) {
        progress.failed_items++;
        progress.errors.push(`${type}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      progress.processed_items++;
      
      // Estimate completion time
      if (progress.processed_items > 0) {
        const elapsedMs = Date.now() - progress.start_time.getTime();
        const itemsPerMs = progress.processed_items / elapsedMs;
        const remainingItems = progress.total_items - progress.processed_items;
        const estimatedRemainingMs = remainingItems / itemsPerMs;
        
        progress.estimated_completion = new Date(Date.now() + estimatedRemainingMs);
      }
      
      progressCallback?.(progress);
    }
  }

  private async validateBatch(batch: MetricsBatch): Promise<void> {
    if (!batch.organization_id) {
      throw new Error('Missing organization_id in batch');
    }
    
    // Additional validation logic here
  }

  private findInsertPosition(item: SyncQueueItem): number {
    const priorities = { 'critical': 0, 'high': 1, 'normal': 2, 'low': 3 };
    const itemPriority = priorities[item.priority];
    
    for (let i = 0; i < this.syncQueue.length; i++) {
      const queuedPriority = priorities[this.syncQueue[i].priority];
      if (itemPriority < queuedPriority) {
        return i;
      }
    }
    
    return this.syncQueue.length;
  }

  private cleanupQueue(): void {
    // Remove old low-priority items
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    
    this.syncQueue = this.syncQueue.filter(item => {
      return !(item.priority === 'low' && item.created_at.getTime() < cutoffTime);
    });
  }

  private getEndpointForType(type: SyncQueueItem['type']): string {
    const endpoints = {
      'command_execution': '/api/v1/metrics/commands',
      'agent_interaction': '/api/v1/metrics/interactions',
      'user_session': '/api/v1/metrics/sessions',
      'productivity_metric': '/api/v1/metrics/productivity',
      'batch': '/api/v1/metrics/batch'
    };
    
    return endpoints[type] || '/api/v1/metrics/generic';
  }

  private getQueryEndpointForType(type: SyncQueueItem['type']): string {
    return this.getEndpointForType(type);
  }

  private buildQueryParams(item: SyncQueueItem): string {
    const params = new URLSearchParams();
    
    // Add common query parameters based on item type
    if (item.data.id) {
      params.set('id', item.data.id);
    }
    
    if (item.data.user_id) {
      params.set('user_id', item.data.user_id);
    }
    
    return params.toString();
  }

  private dataConflicts(localData: any, remoteData: any): boolean {
    // Simple conflict detection - compare timestamps
    const localTimestamp = new Date(localData.updated_at || localData.created_at || 0);
    const remoteTimestamp = new Date(remoteData.updated_at || remoteData.created_at || 0);
    
    return Math.abs(localTimestamp.getTime() - remoteTimestamp.getTime()) > 1000; // 1 second tolerance
  }

  private updateSyncStats(
    synced: number,
    failed: number,
    conflicts: number,
    timeMs: number
  ): void {
    this.syncStats.total_synced += synced;
    this.syncStats.total_failed += failed;
    this.syncStats.conflicts_resolved += conflicts;
    this.syncStats.total_sync_time_ms += timeMs;
    this.syncStats.sync_count++;
  }

  private async checkRemoteHealth(): Promise<void> {
    try {
      const startTime = performance.now();
      const response = await fetch(`${this.remoteEndpoint.url}/health`, {
        method: 'GET',
        timeout: 5000
      });
      
      const responseTime = performance.now() - startTime;
      
      if (response.ok) {
        this.remoteHealth.available = true;
        this.remoteHealth.consecutive_failures = 0;
        this.remoteHealth.response_time_ms = responseTime;
      } else {
        throw new Error(`Health check failed: ${response.status}`);
      }
      
    } catch (error) {
      this.remoteHealth.available = false;
      this.remoteHealth.consecutive_failures++;
      
      this.logger.warn('Remote health check failed', {
        consecutive_failures: this.remoteHealth.consecutive_failures,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
    
    this.remoteHealth.last_check = new Date();
  }

  private async loadSyncQueue(): Promise<void> {
    // Implementation would load queue from persistent storage
    // For now, start with empty queue
    this.syncQueue = [];
  }

  private async persistSyncQueue(): Promise<void> {
    // Implementation would persist queue to storage
    // For now, this is a no-op
  }
}