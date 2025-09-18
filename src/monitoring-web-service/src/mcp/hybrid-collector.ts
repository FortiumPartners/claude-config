/**
 * Hybrid Metrics Collector
 * Task 3.3: Local + Remote metrics collection with graceful degradation
 * 
 * Provides seamless integration between existing local hooks system
 * and remote metrics service with <100ms fallback activation.
 */

import { MetricsSessionService } from '../services/metrics-session.service';
import { ToolMetricsService } from '../services/tool-metrics.service';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import * as winston from 'winston';
import fetch from 'node-fetch';

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

export class HybridMetricsCollector {
  private sessionService?: MetricsSessionService;
  private toolMetricsService?: ToolMetricsService;
  private logger: winston.Logger;
  private config: HybridConfig;
  
  // Local storage paths
  private localMetricsDir: string;
  private queueFile: string;
  private statusFile: string;
  
  // Sync queue for offline/failed operations
  private syncQueue: QueuedMetrics[] = [];
  private syncInProgress = false;
  
  // Remote endpoint health tracking
  private remoteHealth = {
    available: false,
    last_check: new Date(0),
    consecutive_failures: 0,
    avg_response_time_ms: 0
  };
  
  // Performance tracking
  private performanceStats = {
    local_operations: { count: 0, total_time_ms: 0 },
    remote_operations: { count: 0, total_time_ms: 0 },
    sync_operations: { success: 0, failure: 0 }
  };

  constructor(config: HybridConfig, logger: winston.Logger) {
    this.config = {
      mode: 'hybrid',
      sync_interval_ms: 5 * 60 * 1000, // 5 minutes
      retry_attempts: 3,
      timeout_ms: 5000, // 5 seconds
      fallback_threshold_ms: 100, // 100ms fallback threshold
      local_hooks_path: path.join(os.homedir(), '.agent-os', 'metrics'),
      ...config
    };
    
    this.logger = logger;
    
    // Setup local storage
    this.localMetricsDir = this.config.local_hooks_path!;
    this.queueFile = path.join(this.localMetricsDir, 'sync_queue.json');
    this.statusFile = path.join(this.localMetricsDir, 'collector_status.json');
    
    this.initializeCollector();
  }

  /**
   * Initialize hybrid collector
   */
  private async initializeCollector(): Promise<void> {
    try {
      // Ensure local directories exist
      await fs.ensureDir(this.localMetricsDir);
      
      // Load sync queue from disk
      await this.loadSyncQueue();
      
      // Start sync timer if in hybrid/remote mode
      if (this.config.mode !== 'local') {
        setInterval(() => this.processSyncQueue(), this.config.sync_interval_ms!);
        
        // Initial health check
        this.checkRemoteHealth();
      }
      
      this.logger.info('Hybrid metrics collector initialized', {
        mode: this.config.mode,
        local_path: this.localMetricsDir,
        remote_endpoint: this.config.remote_endpoint,
        sync_interval_ms: this.config.sync_interval_ms
      });
      
    } catch (error) {
      this.logger.error('Failed to initialize hybrid collector', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Set remote services (injected after construction)
   */
  setRemoteServices(
    sessionService: MetricsSessionService,
    toolMetricsService: ToolMetricsService
  ): void {
    this.sessionService = sessionService;
    this.toolMetricsService = toolMetricsService;
  }

  /**
   * Collect metrics with hybrid approach
   * Always saves locally first, then attempts remote sync
   */
  async collectMetrics(data: LocalMetricsData): Promise<{
    success: boolean;
    local_saved: boolean;
    remote_synced: boolean;
    fallback_activated: boolean;
    response_time_ms: number;
    message?: string;
  }> {
    const startTime = performance.now();
    
    try {
      // Always save locally first for reliability
      const localResult = await this.saveLocalMetrics(data);
      
      let remoteSynced = false;
      let fallbackActivated = false;
      
      // Attempt remote sync if enabled and available
      if (this.config.mode !== 'local' && this.shouldAttemptRemoteSync()) {
        const remoteStartTime = performance.now();
        
        try {
          await this.syncToRemote(data);
          remoteSynced = true;
          
          const remoteTime = performance.now() - remoteStartTime;
          this.updateRemotePerformanceStats(remoteTime, true);
          
          // Update remote health status
          this.remoteHealth.available = true;
          this.remoteHealth.consecutive_failures = 0;
          
        } catch (error) {
          const remoteTime = performance.now() - remoteStartTime;
          this.updateRemotePerformanceStats(remoteTime, false);
          
          // Check if fallback threshold exceeded
          if (remoteTime > this.config.fallback_threshold_ms!) {
            fallbackActivated = true;
            this.activateFallbackMode();
          }
          
          // Queue for retry
          await this.queueForRetry(data);
          
          this.logger.warn('Remote sync failed, queued for retry', {
            tool_name: data.tool_name,
            agent_name: data.agent_name,
            error: error instanceof Error ? error.message : 'Unknown error',
            response_time_ms: remoteTime
          });
        }
      }
      
      const totalTime = performance.now() - startTime;
      this.updateLocalPerformanceStats(totalTime, true);
      
      return {
        success: true,
        local_saved: localResult,
        remote_synced: remoteSynced,
        fallback_activated: fallbackActivated,
        response_time_ms: totalTime
      };
      
    } catch (error) {
      const totalTime = performance.now() - startTime;
      this.updateLocalPerformanceStats(totalTime, false);
      
      this.logger.error('Failed to collect metrics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        response_time_ms: totalTime
      });
      
      return {
        success: false,
        local_saved: false,
        remote_synced: false,
        fallback_activated: false,
        response_time_ms: totalTime,
        message: error instanceof Error ? error.message : 'Collection failed'
      };
    }
  }

  /**
   * Save metrics to local storage (compatible with existing hooks)
   */
  private async saveLocalMetrics(data: LocalMetricsData): Promise<boolean> {
    try {
      // Use existing JSONL format for compatibility
      const metricsLog = path.join(this.localMetricsDir, 'tool-metrics.jsonl');
      const sessionLog = path.join(this.localMetricsDir, 'session-metrics.jsonl');
      
      const logEntry = {
        timestamp: data.timestamp.toISOString(),
        user_id: data.user_id,
        session_id: data.session_id,
        tool_name: data.tool_name,
        agent_name: data.agent_name,
        execution_time_ms: data.execution_time_ms,
        status: data.status,
        error_message: data.error_message,
        metadata: data.metadata,
        source: data.source
      };
      
      // Append to appropriate log file
      if (data.tool_name) {
        await fs.appendFile(metricsLog, JSON.stringify(logEntry) + '\n');
      }
      
      if (data.session_id) {
        await fs.appendFile(sessionLog, JSON.stringify(logEntry) + '\n');
      }
      
      // Update real-time activity log for dashboard compatibility
      const realtimeDir = path.join(this.localMetricsDir, 'realtime');
      await fs.ensureDir(realtimeDir);
      
      const activityFile = path.join(realtimeDir, 'activity.log');
      const activityEntry = `${data.timestamp.toISOString()}|${data.tool_name ? 'tool_complete' : 'session_activity'}|${data.tool_name || data.agent_name || 'unknown'}|${data.status || 'unknown'}\n`;
      
      await fs.appendFile(activityFile, activityEntry);
      
      return true;
      
    } catch (error) {
      this.logger.error('Failed to save local metrics', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Sync metrics to remote service
   */
  private async syncToRemote(data: LocalMetricsData): Promise<void> {
    if (!this.config.remote_endpoint) {
      throw new Error('Remote endpoint not configured');
    }
    
    const timeout = new AbortController();
    const timeoutId = setTimeout(() => timeout.abort(), this.config.timeout_ms!);
    
    try {
      // Use local services if available
      if (this.sessionService && this.toolMetricsService) {
        await this.syncWithLocalServices(data);
      } else {
        // Fallback to HTTP API
        await this.syncWithHttpAPI(data, timeout.signal);
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Sync using local service instances
   */
  private async syncWithLocalServices(data: LocalMetricsData): Promise<void> {
    if (!this.sessionService || !this.toolMetricsService) {
      throw new Error('Local services not available');
    }
    
    const organizationId = this.config.organization_id!;
    
    if (data.tool_name) {
      await this.toolMetricsService.recordToolExecution(
        organizationId,
        {
          user_id: data.user_id,
          tool_name: data.tool_name,
          execution_environment: data.metadata?.execution_environment,
          input_parameters: data.metadata?.input_parameters,
          output_summary: data.metadata?.output_summary
        },
        data.execution_time_ms || 0,
        data.status || 'success',
        data.error_message
      );
    }
    
    if (data.session_id && data.agent_name) {
      await this.sessionService.updateSessionActivity(
        organizationId,
        data.session_id,
        {
          agent_name: data.agent_name,
          execution_time_ms: data.execution_time_ms,
          status: data.status
        }
      );
    }
  }

  /**
   * Sync using HTTP API
   */
  private async syncWithHttpAPI(data: LocalMetricsData, signal: AbortSignal): Promise<void> {
    const endpoint = `${this.config.remote_endpoint}/api/v1/metrics/hybrid-sync`;
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.remote_api_key}`,
        'X-Organization-ID': this.config.organization_id!
      },
      body: JSON.stringify({
        metrics: [data],
        source: 'hybrid_collector',
        timestamp: new Date().toISOString()
      }),
      signal
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const result: RemoteAPIResponse = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Remote API error');
    }
  }

  /**
   * Queue metrics for retry on failure
   */
  private async queueForRetry(data: LocalMetricsData): Promise<void> {
    const queueItem: QueuedMetrics = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      data,
      attempts: 0,
      last_attempt: new Date(0),
      created: new Date()
    };
    
    this.syncQueue.push(queueItem);
    
    // Limit queue size
    if (this.syncQueue.length > 1000) {
      this.syncQueue = this.syncQueue.slice(-900); // Keep most recent 900
    }
    
    await this.saveSyncQueue();
  }

  /**
   * Process sync queue
   */
  private async processSyncQueue(): Promise<void> {
    if (this.syncInProgress || this.syncQueue.length === 0) {
      return;
    }
    
    if (!this.remoteHealth.available) {
      await this.checkRemoteHealth();
      if (!this.remoteHealth.available) {
        return; // Skip processing if remote is down
      }
    }
    
    this.syncInProgress = true;
    
    try {
      const itemsToProcess = this.syncQueue.splice(0, 10); // Process in batches of 10
      const results = await Promise.allSettled(
        itemsToProcess.map(item => this.processQueueItem(item))
      );
      
      // Re-queue failed items
      results.forEach((result, index) => {
        const item = itemsToProcess[index];
        
        if (result.status === 'rejected') {
          item.attempts++;
          item.last_attempt = new Date();
          
          if (item.attempts < this.config.retry_attempts!) {
            this.syncQueue.push(item); // Re-queue for retry
          } else {
            this.logger.warn('Max retry attempts reached, dropping metrics', {
              item_id: item.id,
              attempts: item.attempts,
              age_minutes: (Date.now() - item.created.getTime()) / (60 * 1000)
            });
          }
          
          this.performanceStats.sync_operations.failure++;
        } else {
          this.performanceStats.sync_operations.success++;
        }
      });
      
      await this.saveSyncQueue();
      
      this.logger.debug('Sync queue processed', {
        processed: itemsToProcess.length,
        remaining: this.syncQueue.length,
        success_rate: this.performanceStats.sync_operations.success / 
          (this.performanceStats.sync_operations.success + this.performanceStats.sync_operations.failure)
      });
      
    } catch (error) {
      this.logger.error('Error processing sync queue', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Process individual queue item
   */
  private async processQueueItem(item: QueuedMetrics): Promise<void> {
    await this.syncToRemote(item.data);
  }

  /**
   * Check remote endpoint health
   */
  private async checkRemoteHealth(): Promise<void> {
    const now = new Date();
    
    // Rate limit health checks (max once per minute)
    if ((now.getTime() - this.remoteHealth.last_check.getTime()) < 60000) {
      return;
    }
    
    this.remoteHealth.last_check = now;
    
    if (!this.config.remote_endpoint) {
      this.remoteHealth.available = false;
      return;
    }
    
    try {
      const startTime = performance.now();
      const timeout = new AbortController();
      const timeoutId = setTimeout(() => timeout.abort(), 5000); // 5 second timeout
      
      const response = await fetch(`${this.config.remote_endpoint}/api/mcp/health`, {
        method: 'GET',
        signal: timeout.signal
      });
      
      clearTimeout(timeoutId);
      const responseTime = performance.now() - startTime;
      
      if (response.ok) {
        this.remoteHealth.available = true;
        this.remoteHealth.consecutive_failures = 0;
        this.remoteHealth.avg_response_time_ms = 
          (this.remoteHealth.avg_response_time_ms + responseTime) / 2;
        
        this.logger.debug('Remote health check passed', {
          response_time_ms: responseTime,
          endpoint: this.config.remote_endpoint
        });
      } else {
        throw new Error(`Health check failed: ${response.status}`);
      }
      
    } catch (error) {
      this.remoteHealth.available = false;
      this.remoteHealth.consecutive_failures++;
      
      this.logger.warn('Remote health check failed', {
        endpoint: this.config.remote_endpoint,
        consecutive_failures: this.remoteHealth.consecutive_failures,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Activate fallback mode
   */
  private activateFallbackMode(): void {
    this.logger.warn('Activating fallback mode due to remote performance issues', {
      threshold_ms: this.config.fallback_threshold_ms,
      consecutive_failures: this.remoteHealth.consecutive_failures
    });
    
    this.remoteHealth.available = false;
  }

  /**
   * Get sync status
   */
  getSyncStatus(): SyncStatus {
    const localStats = this.performanceStats.local_operations;
    const remoteStats = this.performanceStats.remote_operations;
    const syncStats = this.performanceStats.sync_operations;
    
    return {
      mode: this.config.mode!,
      remote_available: this.remoteHealth.available,
      last_sync: this.remoteHealth.last_check,
      pending_items: this.syncQueue.length,
      sync_errors: this.remoteHealth.consecutive_failures,
      fallback_active: !this.remoteHealth.available && this.config.mode !== 'local',
      performance: {
        avg_local_time_ms: localStats.count > 0 ? localStats.total_time_ms / localStats.count : 0,
        avg_remote_time_ms: remoteStats.count > 0 ? remoteStats.total_time_ms / remoteStats.count : 0,
        sync_success_rate: (syncStats.success + syncStats.failure) > 0 
          ? syncStats.success / (syncStats.success + syncStats.failure) 
          : 0
      }
    };
  }

  // Helper methods

  private shouldAttemptRemoteSync(): boolean {
    return this.remoteHealth.available || 
           (this.remoteHealth.consecutive_failures < 5); // Give up after 5 consecutive failures
  }

  private async loadSyncQueue(): Promise<void> {
    try {
      if (await fs.pathExists(this.queueFile)) {
        const data = await fs.readJSON(this.queueFile);
        this.syncQueue = data.queue || [];
        
        this.logger.info('Sync queue loaded', {
          items: this.syncQueue.length
        });
      }
    } catch (error) {
      this.logger.error('Failed to load sync queue', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async saveSyncQueue(): Promise<void> {
    try {
      await fs.writeJSON(this.queueFile, {
        queue: this.syncQueue,
        last_updated: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error('Failed to save sync queue', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private updateLocalPerformanceStats(timeMs: number, success: boolean): void {
    this.performanceStats.local_operations.count++;
    this.performanceStats.local_operations.total_time_ms += timeMs;
  }

  private updateRemotePerformanceStats(timeMs: number, success: boolean): void {
    this.performanceStats.remote_operations.count++;
    this.performanceStats.remote_operations.total_time_ms += timeMs;
  }
}