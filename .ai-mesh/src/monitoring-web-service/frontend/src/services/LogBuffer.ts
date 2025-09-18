/**
 * LogBuffer - Advanced log buffer management with offline persistence
 * Task 2.1: Frontend Logger Client Implementation
 * 
 * Features:
 * - Circular buffer with configurable size limits
 * - LocalStorage persistence for offline scenarios
 * - Storage quota management with cleanup
 * - Compression for efficient storage
 * - Priority-based queuing
 */

import {
  QueuedLogEntry,
  LogEntry,
  LogBufferConfig,
  LogBufferStats,
  StorageQuota,
} from '../types/logging.types';

export class LogBuffer {
  private buffer: QueuedLogEntry[] = [];
  private config: LogBufferConfig;
  private storageQuota: StorageQuota = {
    used: 0,
    available: 0,
    percentage: 0,
    nearLimit: false,
  };

  private static readonly DEFAULT_CONFIG: LogBufferConfig = {
    maxSize: 100,
    flushThreshold: 50,
    timeThreshold: 30000, // 30 seconds
    storageKey: 'fortium_log_buffer',
    maxStorageSize: 1024 * 1024, // 1MB
    enableCompression: false, // Disabled for now, can be enabled later
  };

  constructor(config: Partial<LogBufferConfig> = {}) {
    this.config = { ...LogBuffer.DEFAULT_CONFIG, ...config };
    this.initializeStorage();
    this.loadFromStorage();
  }

  /**
   * Add log entry to buffer with priority handling
   */
  public add(entry: LogEntry, priority: 'low' | 'normal' | 'high' | 'critical' = 'normal'): void {
    const queuedEntry: QueuedLogEntry = {
      entry,
      retries: 0,
      timestamp: Date.now(),
      priority,
    };

    // Insert based on priority
    if (priority === 'critical') {
      this.buffer.unshift(queuedEntry);
    } else if (priority === 'high') {
      // Insert after critical but before normal/low
      const criticalCount = this.buffer.filter(e => e.priority === 'critical').length;
      this.buffer.splice(criticalCount, 0, queuedEntry);
    } else {
      this.buffer.push(queuedEntry);
    }

    // Maintain buffer size limit (circular buffer behavior)
    if (this.buffer.length > this.config.maxSize) {
      // Remove oldest low-priority entries first
      const removedEntry = this.removeOldestLowPriority() || this.buffer.shift();
      if (removedEntry) {
        console.debug('[LogBuffer] Removed oldest entry due to size limit');
      }
    }

    this.persistToStorage();
  }

  /**
   * Get entries ready for flushing (respects priority)
   */
  public getFlushableEntries(count: number): QueuedLogEntry[] {
    // Sort by priority and timestamp
    const sorted = [...this.buffer].sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.timestamp - b.timestamp;
    });

    return sorted.slice(0, count);
  }

  /**
   * Remove entries from buffer after successful flush
   */
  public removeEntries(entries: QueuedLogEntry[]): void {
    entries.forEach(entry => {
      const index = this.buffer.findIndex(
        item => item.timestamp === entry.timestamp && 
                item.entry.message === entry.entry.message
      );
      if (index > -1) {
        this.buffer.splice(index, 1);
      }
    });
    this.persistToStorage();
  }

  /**
   * Increment retry count for failed entries
   */
  public incrementRetries(entries: QueuedLogEntry[]): void {
    entries.forEach(entry => {
      const bufferEntry = this.buffer.find(
        item => item.timestamp === entry.timestamp && 
                item.entry.message === entry.entry.message
      );
      if (bufferEntry) {
        bufferEntry.retries++;
      }
    });
    this.persistToStorage();
  }

  /**
   * Remove entries that exceeded max retries
   */
  public removeFailedEntries(maxRetries: number): QueuedLogEntry[] {
    const failedEntries = this.buffer.filter(entry => entry.retries >= maxRetries);
    this.buffer = this.buffer.filter(entry => entry.retries < maxRetries);
    this.persistToStorage();
    return failedEntries;
  }

  /**
   * Check if buffer should be flushed based on size or time thresholds
   */
  public shouldFlush(): boolean {
    if (this.buffer.length === 0) return false;
    
    // Size threshold
    if (this.buffer.length >= this.config.flushThreshold) return true;
    
    // Time threshold - check oldest entry
    const oldestEntry = this.buffer.reduce((oldest, current) => 
      current.timestamp < oldest.timestamp ? current : oldest
    );
    
    return (Date.now() - oldestEntry.timestamp) >= this.config.timeThreshold;
  }

  /**
   * Get buffer statistics
   */
  public getStats(): LogBufferStats {
    if (this.buffer.length === 0) {
      return {
        size: 0,
        storageSize: this.storageQuota.used,
      };
    }

    const timestamps = this.buffer.map(entry => entry.timestamp);
    return {
      size: this.buffer.length,
      oldestEntry: Math.min(...timestamps),
      newestEntry: Math.max(...timestamps),
      storageSize: this.storageQuota.used,
      compressionRatio: this.config.enableCompression ? this.calculateCompressionRatio() : undefined,
    };
  }

  /**
   * Clear all entries from buffer
   */
  public clear(): void {
    this.buffer = [];
    this.clearStorage();
  }

  /**
   * Get current buffer size
   */
  public size(): number {
    return this.buffer.length;
  }

  /**
   * Check if buffer is empty
   */
  public isEmpty(): boolean {
    return this.buffer.length === 0;
  }

  /**
   * Get storage quota information
   */
  public getStorageQuota(): StorageQuota {
    return { ...this.storageQuota };
  }

  /**
   * Initialize storage and check quota
   */
  private initializeStorage(): void {
    this.updateStorageQuota();
  }

  /**
   * Load buffer from localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.config.storageKey);
      if (stored) {
        const data = this.config.enableCompression ? this.decompress(stored) : stored;
        const parsed = JSON.parse(data) as QueuedLogEntry[];
        
        // Validate and filter valid entries
        this.buffer = parsed.filter(this.isValidQueuedEntry);
        console.debug(`[LogBuffer] Loaded ${this.buffer.length} entries from storage`);
      }
    } catch (error) {
      console.warn('[LogBuffer] Failed to load from storage:', error);
      this.clearStorage();
    }
  }

  /**
   * Persist buffer to localStorage with quota management
   */
  private persistToStorage(): void {
    try {
      const data = JSON.stringify(this.buffer);
      const finalData = this.config.enableCompression ? this.compress(data) : data;
      
      // Check if data exceeds storage limit
      if (finalData.length > this.config.maxStorageSize) {
        this.manageStorageQuota();
        return;
      }

      localStorage.setItem(this.config.storageKey, finalData);
      this.updateStorageQuota();
    } catch (error) {
      if (error.name === 'QuotaExceededError') {
        this.handleStorageQuotaExceeded();
      } else {
        console.warn('[LogBuffer] Failed to persist to storage:', error instanceof Error ? error.message : String(error));
      }
    }
  }

  /**
   * Manage storage quota by removing oldest low-priority entries
   */
  private manageStorageQuota(): void {
    console.warn('[LogBuffer] Storage quota management triggered');
    
    let attempts = 0;
    const maxAttempts = 10;
    
    while (this.buffer.length > 0 && attempts < maxAttempts) {
      const removed = this.removeOldestLowPriority();
      if (!removed) {
        // If no low priority entries, remove oldest entry
        this.buffer.shift();
      }
      
      const data = JSON.stringify(this.buffer);
      const finalData = this.config.enableCompression ? this.compress(data) : data;
      
      if (finalData.length <= this.config.maxStorageSize) {
        try {
          localStorage.setItem(this.config.storageKey, finalData);
          this.updateStorageQuota();
          console.debug(`[LogBuffer] Storage quota managed, ${this.buffer.length} entries remaining`);
          return;
        } catch (error) {
          // Continue trying to free up space
        }
      }
      
      attempts++;
    }
    
    console.error('[LogBuffer] Unable to manage storage quota effectively');
  }

  /**
   * Handle storage quota exceeded error
   */
  private handleStorageQuotaExceeded(): void {
    console.warn('[LogBuffer] Storage quota exceeded, attempting cleanup');
    
    // Try to free up space by removing old entries
    const initialSize = this.buffer.length;
    this.buffer = this.buffer.slice(-Math.floor(this.config.maxSize * 0.7)); // Keep 70% of max size
    
    try {
      const data = JSON.stringify(this.buffer);
      const finalData = this.config.enableCompression ? this.compress(data) : data;
      localStorage.setItem(this.config.storageKey, finalData);
      console.debug(`[LogBuffer] Quota cleanup: removed ${initialSize - this.buffer.length} entries`);
    } catch (error) {
      console.error('[LogBuffer] Failed to recover from quota exceeded:', error);
      this.clearStorage();
    }
  }

  /**
   * Remove oldest low-priority entry
   */
  private removeOldestLowPriority(): QueuedLogEntry | null {
    let oldestIndex = -1;
    let oldestTimestamp = Infinity;
    
    for (let i = 0; i < this.buffer.length; i++) {
      const entry = this.buffer[i];
      if ((entry.priority === 'low' || entry.priority === 'normal') && 
          entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestIndex = i;
      }
    }
    
    if (oldestIndex > -1) {
      return this.buffer.splice(oldestIndex, 1)[0];
    }
    
    return null;
  }

  /**
   * Update storage quota information
   */
  private updateStorageQuota(): void {
    try {
      const usage = this.calculateStorageUsage();
      const available = this.config.maxStorageSize - usage;
      const percentage = (usage / this.config.maxStorageSize) * 100;
      
      this.storageQuota = {
        used: usage,
        available,
        percentage,
        nearLimit: percentage > 80, // Consider 80% as near limit
      };
    } catch (error) {
      console.warn('[LogBuffer] Failed to update storage quota:', error);
    }
  }

  /**
   * Calculate current storage usage for this buffer
   */
  private calculateStorageUsage(): number {
    try {
      const stored = localStorage.getItem(this.config.storageKey);
      return stored ? stored.length : 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Calculate compression ratio (if compression is enabled)
   */
  private calculateCompressionRatio(): number {
    if (!this.config.enableCompression) return 1;
    
    const original = JSON.stringify(this.buffer);
    const compressed = this.compress(original);
    
    return compressed.length / original.length;
  }

  /**
   * Compress data (simple implementation, can be enhanced with actual compression)
   */
  private compress(data: string): string {
    // Simple compression placeholder - in a real implementation,
    // you might use libraries like pako for gzip compression
    return data;
  }

  /**
   * Decompress data
   */
  private decompress(data: string): string {
    // Simple decompression placeholder
    return data;
  }

  /**
   * Validate queued entry structure
   */
  private isValidQueuedEntry(entry: any): entry is QueuedLogEntry {
    return (
      entry &&
      typeof entry === 'object' &&
      entry.entry &&
      typeof entry.retries === 'number' &&
      typeof entry.timestamp === 'number' &&
      entry.priority &&
      ['low', 'normal', 'high', 'critical'].includes(entry.priority)
    );
  }

  /**
   * Clear storage
   */
  private clearStorage(): void {
    try {
      localStorage.removeItem(this.config.storageKey);
      this.updateStorageQuota();
    } catch (error) {
      console.warn('[LogBuffer] Failed to clear storage:', error);
    }
  }
}