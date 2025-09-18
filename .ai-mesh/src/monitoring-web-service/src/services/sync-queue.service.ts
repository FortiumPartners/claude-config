/**
 * Sync Queue Service
 * Task 3.4: Offline queue management with persistent storage
 * 
 * Provides persistent queue management for offline operations,
 * retry logic with exponential backoff, and queue optimization.
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
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

export class SyncQueueService {
  private logger: winston.Logger;
  private config: QueueConfig;
  private queue: QueueItem[] = [];
  private storagePath: string;
  private queueFile: string;
  private metadataFile: string;
  
  // Retry policies by item type
  private retryPolicies: Record<string, RetryPolicy> = {
    'metrics': {
      initial_delay_ms: 1000,
      max_delay_ms: 300000, // 5 minutes
      backoff_multiplier: 2,
      max_attempts: 5,
      jitter_factor: 0.1
    },
    'session': {
      initial_delay_ms: 2000,
      max_delay_ms: 600000, // 10 minutes
      backoff_multiplier: 2,
      max_attempts: 3,
      jitter_factor: 0.15
    },
    'command': {
      initial_delay_ms: 500,
      max_delay_ms: 60000, // 1 minute
      backoff_multiplier: 1.5,
      max_attempts: 7,
      jitter_factor: 0.2
    },
    'interaction': {
      initial_delay_ms: 1000,
      max_delay_ms: 180000, // 3 minutes
      backoff_multiplier: 1.8,
      max_attempts: 4,
      jitter_factor: 0.1
    },
    'batch': {
      initial_delay_ms: 5000,
      max_delay_ms: 1800000, // 30 minutes
      backoff_multiplier: 2.5,
      max_attempts: 3,
      jitter_factor: 0.05
    }
  };
  
  // Performance tracking
  private stats = {
    items_added: 0,
    items_processed: 0,
    items_failed: 0,
    items_expired: 0,
    queue_loads: 0,
    queue_saves: 0
  };

  constructor(logger: winston.Logger, config: QueueConfig) {
    this.logger = logger;
    this.config = {
      storage_path: path.join(os.homedir(), '.agent-os', 'sync-queue'),
      max_queue_size: 10000,
      max_item_age_ms: 7 * 24 * 60 * 60 * 1000, // 7 days
      cleanup_interval_ms: 60 * 60 * 1000, // 1 hour
      persist_interval_ms: 5 * 60 * 1000, // 5 minutes
      compression_enabled: true,
      ...config
    };
    
    this.storagePath = this.config.storage_path!;
    this.queueFile = path.join(this.storagePath, 'queue.json');
    this.metadataFile = path.join(this.storagePath, 'metadata.json');
    
    this.initializeQueue();
  }

  /**
   * Initialize queue service
   */
  private async initializeQueue(): Promise<void> {
    try {
      // Ensure storage directory exists
      await fs.ensureDir(this.storagePath);
      
      // Load existing queue from disk
      await this.loadQueue();
      
      // Start cleanup timer
      setInterval(() => this.cleanup(), this.config.cleanup_interval_ms);
      
      // Start persistence timer
      setInterval(() => this.persistQueue(), this.config.persist_interval_ms);
      
      this.logger.info('Sync queue service initialized', {
        storage_path: this.storagePath,
        queue_size: this.queue.length,
        config: this.config
      });
      
    } catch (error) {
      this.logger.error('Failed to initialize sync queue', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Add item to queue
   */
  async enqueue(
    type: QueueItem['type'],
    payload: any,
    organizationId: string,
    priority: QueueItem['priority'] = 'normal',
    metadata?: Record<string, any>
  ): Promise<{ success: boolean; item_id?: string; message?: string }> {
    try {
      // Check queue size limit
      if (this.queue.length >= this.config.max_queue_size) {
        // Try to make space by removing old low-priority items
        await this.makeSpace();
        
        if (this.queue.length >= this.config.max_queue_size) {
          return {
            success: false,
            message: 'Queue is full and cannot accommodate new items'
          };
        }
      }
      
      const retryPolicy = this.retryPolicies[type] || this.retryPolicies['metrics'];
      
      const item: QueueItem = {
        id: this.generateItemId(),
        type,
        payload,
        organization_id: organizationId,
        priority,
        created_at: new Date(),
        scheduled_at: new Date(), // Available immediately
        attempts: 0,
        max_attempts: retryPolicy.max_attempts,
        metadata
      };
      
      // Insert based on priority
      const insertIndex = this.findInsertPosition(item);
      this.queue.splice(insertIndex, 0, item);
      
      this.stats.items_added++;
      
      this.logger.debug('Item enqueued', {
        item_id: item.id,
        type: item.type,
        priority: item.priority,
        organization_id: organizationId,
        queue_position: insertIndex + 1
      });
      
      return {
        success: true,
        item_id: item.id
      };
      
    } catch (error) {
      this.logger.error('Failed to enqueue item', {
        type,
        organization_id: organizationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to enqueue item'
      };
    }
  }

  /**
   * Get next available items for processing
   */
  async dequeue(
    limit: number = 10,
    types?: QueueItem['type'][],
    organizationId?: string
  ): Promise<QueueItem[]> {
    const now = new Date();
    const availableItems: QueueItem[] = [];
    
    for (const item of this.queue) {
      // Skip if not scheduled yet
      if (item.scheduled_at > now) {
        continue;
      }
      
      // Filter by types if specified
      if (types && !types.includes(item.type)) {
        continue;
      }
      
      // Filter by organization if specified
      if (organizationId && item.organization_id !== organizationId) {
        continue;
      }
      
      // Skip items that have exceeded max attempts
      if (item.attempts >= item.max_attempts) {
        continue;
      }
      
      availableItems.push(item);
      
      if (availableItems.length >= limit) {
        break;
      }
    }
    
    return availableItems;
  }

  /**
   * Mark item as processed successfully
   */
  async markProcessed(itemId: string): Promise<{ success: boolean; message?: string }> {
    try {
      const index = this.queue.findIndex(item => item.id === itemId);
      
      if (index === -1) {
        return {
          success: false,
          message: 'Item not found in queue'
        };
      }
      
      // Remove from queue
      const [item] = this.queue.splice(index, 1);
      this.stats.items_processed++;
      
      this.logger.debug('Item marked as processed', {
        item_id: itemId,
        type: item.type,
        attempts: item.attempts
      });
      
      return { success: true };
      
    } catch (error) {
      this.logger.error('Failed to mark item as processed', {
        item_id: itemId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to mark as processed'
      };
    }
  }

  /**
   * Mark item as failed and schedule retry
   */
  async markFailed(
    itemId: string,
    error: string,
    scheduleRetry: boolean = true
  ): Promise<{ success: boolean; retry_scheduled?: boolean; message?: string }> {
    try {
      const item = this.queue.find(item => item.id === itemId);
      
      if (!item) {
        return {
          success: false,
          message: 'Item not found in queue'
        };
      }
      
      item.attempts++;
      item.last_error = error;
      
      let retryScheduled = false;
      
      if (scheduleRetry && item.attempts < item.max_attempts) {
        // Calculate retry delay with exponential backoff and jitter
        const retryPolicy = this.retryPolicies[item.type] || this.retryPolicies['metrics'];
        const delay = this.calculateRetryDelay(item.attempts, retryPolicy);
        
        item.retry_after = new Date(Date.now() + delay);
        item.scheduled_at = item.retry_after;
        retryScheduled = true;
        
        this.logger.debug('Item scheduled for retry', {
          item_id: itemId,
          attempts: item.attempts,
          retry_after: item.retry_after,
          delay_ms: delay
        });
        
      } else {
        // Max attempts reached or retry not requested
        this.stats.items_failed++;
        
        this.logger.warn('Item failed permanently', {
          item_id: itemId,
          type: item.type,
          attempts: item.attempts,
          error: error
        });
      }
      
      return {
        success: true,
        retry_scheduled: retryScheduled
      };
      
    } catch (err) {
      this.logger.error('Failed to mark item as failed', {
        item_id: itemId,
        error: err instanceof Error ? err.message : 'Unknown error'
      });
      
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Failed to mark as failed'
      };
    }
  }

  /**
   * Get queue statistics
   */
  getStats(): QueueStats {
    const byPriority: Record<string, number> = {};
    const byType: Record<string, number> = {};
    let oldestAge = 0;
    let totalSize = 0;
    
    const now = Date.now();
    let pending = 0;
    let retrying = 0;
    let failed = 0;
    
    for (const item of this.queue) {
      // Count by priority
      byPriority[item.priority] = (byPriority[item.priority] || 0) + 1;
      
      // Count by type
      byType[item.type] = (byType[item.type] || 0) + 1;
      
      // Calculate age
      const age = now - item.created_at.getTime();
      oldestAge = Math.max(oldestAge, age);
      
      // Estimate size (rough calculation)
      totalSize += JSON.stringify(item).length;
      
      // Count by status
      if (item.attempts >= item.max_attempts) {
        failed++;
      } else if (item.attempts > 0) {
        retrying++;
      } else {
        pending++;
      }
    }
    
    return {
      total_items: this.queue.length,
      by_priority: byPriority,
      by_type: byType,
      by_status: { pending, retrying, failed },
      oldest_item_age_ms: oldestAge,
      queue_size_bytes: totalSize,
      disk_usage_bytes: 0 // Would be calculated from actual file sizes
    };
  }

  /**
   * Get items by status
   */
  async getItems(
    status?: 'pending' | 'retrying' | 'failed',
    limit: number = 50,
    offset: number = 0
  ): Promise<QueueItem[]> {
    let filteredItems = [...this.queue];
    
    if (status) {
      const now = new Date();
      filteredItems = this.queue.filter(item => {
        switch (status) {
          case 'pending':
            return item.attempts === 0 && item.scheduled_at <= now;
          case 'retrying':
            return item.attempts > 0 && item.attempts < item.max_attempts;
          case 'failed':
            return item.attempts >= item.max_attempts;
          default:
            return true;
        }
      });
    }
    
    return filteredItems.slice(offset, offset + limit);
  }

  /**
   * Remove specific item from queue
   */
  async removeItem(itemId: string): Promise<{ success: boolean; message?: string }> {
    try {
      const index = this.queue.findIndex(item => item.id === itemId);
      
      if (index === -1) {
        return {
          success: false,
          message: 'Item not found in queue'
        };
      }
      
      const [item] = this.queue.splice(index, 1);
      
      this.logger.debug('Item removed from queue', {
        item_id: itemId,
        type: item.type
      });
      
      return { success: true };
      
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to remove item'
      };
    }
  }

  /**
   * Clear all failed items
   */
  async clearFailed(): Promise<{ success: boolean; items_removed: number }> {
    try {
      const initialLength = this.queue.length;
      
      this.queue = this.queue.filter(item => item.attempts < item.max_attempts);
      
      const itemsRemoved = initialLength - this.queue.length;
      
      this.logger.info('Failed items cleared', {
        items_removed: itemsRemoved
      });
      
      return {
        success: true,
        items_removed: itemsRemoved
      };
      
    } catch (error) {
      this.logger.error('Failed to clear failed items', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return {
        success: false,
        items_removed: 0
      };
    }
  }

  // Private helper methods

  private generateItemId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private findInsertPosition(item: QueueItem): number {
    const priorities = { 'critical': 0, 'high': 1, 'normal': 2, 'low': 3 };
    const itemPriority = priorities[item.priority];
    
    for (let i = 0; i < this.queue.length; i++) {
      const queuedPriority = priorities[this.queue[i].priority];
      if (itemPriority < queuedPriority) {
        return i;
      }
    }
    
    return this.queue.length;
  }

  private calculateRetryDelay(attempt: number, policy: RetryPolicy): number {
    // Base delay with exponential backoff
    let delay = policy.initial_delay_ms * Math.pow(policy.backoff_multiplier, attempt - 1);
    
    // Cap at maximum delay
    delay = Math.min(delay, policy.max_delay_ms);
    
    // Add jitter to prevent thundering herd
    const jitter = delay * policy.jitter_factor * (Math.random() * 2 - 1);
    delay += jitter;
    
    return Math.max(0, Math.round(delay));
  }

  private async makeSpace(): Promise<void> {
    const now = Date.now();
    const maxAge = this.config.max_item_age_ms;
    
    // Remove expired items first
    const initialLength = this.queue.length;
    this.queue = this.queue.filter(item => {
      const age = now - item.created_at.getTime();
      const expired = age > maxAge;
      
      if (expired) {
        this.stats.items_expired++;
      }
      
      return !expired;
    });
    
    let spaceMade = initialLength - this.queue.length;
    
    // If still need space, remove oldest low-priority failed items
    if (this.queue.length >= this.config.max_queue_size) {
      const failedLowPriority = this.queue
        .filter(item => item.attempts >= item.max_attempts && item.priority === 'low')
        .sort((a, b) => a.created_at.getTime() - b.created_at.getTime());
      
      const toRemove = Math.min(
        failedLowPriority.length,
        this.queue.length - this.config.max_queue_size + 100 // Make some extra space
      );
      
      for (let i = 0; i < toRemove; i++) {
        const item = failedLowPriority[i];
        const index = this.queue.indexOf(item);
        if (index >= 0) {
          this.queue.splice(index, 1);
          spaceMade++;
        }
      }
    }
    
    if (spaceMade > 0) {
      this.logger.info('Made space in queue', {
        items_removed: spaceMade,
        new_queue_size: this.queue.length
      });
    }
  }

  private async cleanup(): Promise<void> {
    const before = this.queue.length;
    
    // Remove expired items
    await this.makeSpace();
    
    // Persist queue if changed
    if (this.queue.length !== before) {
      await this.persistQueue();
    }
    
    this.logger.debug('Queue cleanup completed', {
      items_before: before,
      items_after: this.queue.length,
      items_removed: before - this.queue.length
    });
  }

  private async loadQueue(): Promise<void> {
    try {
      if (await fs.pathExists(this.queueFile)) {
        const data = await fs.readJSON(this.queueFile);
        
        // Convert date strings back to Date objects
        this.queue = data.items.map((item: any) => ({
          ...item,
          created_at: new Date(item.created_at),
          scheduled_at: new Date(item.scheduled_at),
          retry_after: item.retry_after ? new Date(item.retry_after) : undefined
        }));
        
        this.stats.queue_loads++;
        
        this.logger.info('Queue loaded from disk', {
          items_loaded: this.queue.length
        });
      }
    } catch (error) {
      this.logger.error('Failed to load queue from disk', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      // Start with empty queue on load failure
      this.queue = [];
    }
  }

  private async persistQueue(): Promise<void> {
    try {
      const data = {
        items: this.queue,
        metadata: {
          persisted_at: new Date().toISOString(),
          version: '1.0.0',
          stats: this.stats
        }
      };
      
      await fs.writeJSON(this.queueFile, data, { spaces: 2 });
      this.stats.queue_saves++;
      
      this.logger.debug('Queue persisted to disk', {
        items: this.queue.length,
        file: this.queueFile
      });
      
    } catch (error) {
      this.logger.error('Failed to persist queue to disk', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}