"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncQueueService = void 0;
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
class SyncQueueService {
    logger;
    config;
    queue = [];
    storagePath;
    queueFile;
    metadataFile;
    retryPolicies = {
        'metrics': {
            initial_delay_ms: 1000,
            max_delay_ms: 300000,
            backoff_multiplier: 2,
            max_attempts: 5,
            jitter_factor: 0.1
        },
        'session': {
            initial_delay_ms: 2000,
            max_delay_ms: 600000,
            backoff_multiplier: 2,
            max_attempts: 3,
            jitter_factor: 0.15
        },
        'command': {
            initial_delay_ms: 500,
            max_delay_ms: 60000,
            backoff_multiplier: 1.5,
            max_attempts: 7,
            jitter_factor: 0.2
        },
        'interaction': {
            initial_delay_ms: 1000,
            max_delay_ms: 180000,
            backoff_multiplier: 1.8,
            max_attempts: 4,
            jitter_factor: 0.1
        },
        'batch': {
            initial_delay_ms: 5000,
            max_delay_ms: 1800000,
            backoff_multiplier: 2.5,
            max_attempts: 3,
            jitter_factor: 0.05
        }
    };
    stats = {
        items_added: 0,
        items_processed: 0,
        items_failed: 0,
        items_expired: 0,
        queue_loads: 0,
        queue_saves: 0
    };
    constructor(logger, config) {
        this.logger = logger;
        this.config = {
            storage_path: path.join(os.homedir(), '.agent-os', 'sync-queue'),
            max_queue_size: 10000,
            max_item_age_ms: 7 * 24 * 60 * 60 * 1000,
            cleanup_interval_ms: 60 * 60 * 1000,
            persist_interval_ms: 5 * 60 * 1000,
            compression_enabled: true,
            ...config
        };
        this.storagePath = this.config.storage_path;
        this.queueFile = path.join(this.storagePath, 'queue.json');
        this.metadataFile = path.join(this.storagePath, 'metadata.json');
        this.initializeQueue();
    }
    async initializeQueue() {
        try {
            await fs.ensureDir(this.storagePath);
            await this.loadQueue();
            setInterval(() => this.cleanup(), this.config.cleanup_interval_ms);
            setInterval(() => this.persistQueue(), this.config.persist_interval_ms);
            this.logger.info('Sync queue service initialized', {
                storage_path: this.storagePath,
                queue_size: this.queue.length,
                config: this.config
            });
        }
        catch (error) {
            this.logger.error('Failed to initialize sync queue', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    async enqueue(type, payload, organizationId, priority = 'normal', metadata) {
        try {
            if (this.queue.length >= this.config.max_queue_size) {
                await this.makeSpace();
                if (this.queue.length >= this.config.max_queue_size) {
                    return {
                        success: false,
                        message: 'Queue is full and cannot accommodate new items'
                    };
                }
            }
            const retryPolicy = this.retryPolicies[type] || this.retryPolicies['metrics'];
            const item = {
                id: this.generateItemId(),
                type,
                payload,
                organization_id: organizationId,
                priority,
                created_at: new Date(),
                scheduled_at: new Date(),
                attempts: 0,
                max_attempts: retryPolicy.max_attempts,
                metadata
            };
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
        }
        catch (error) {
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
    async dequeue(limit = 10, types, organizationId) {
        const now = new Date();
        const availableItems = [];
        for (const item of this.queue) {
            if (item.scheduled_at > now) {
                continue;
            }
            if (types && !types.includes(item.type)) {
                continue;
            }
            if (organizationId && item.organization_id !== organizationId) {
                continue;
            }
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
    async markProcessed(itemId) {
        try {
            const index = this.queue.findIndex(item => item.id === itemId);
            if (index === -1) {
                return {
                    success: false,
                    message: 'Item not found in queue'
                };
            }
            const [item] = this.queue.splice(index, 1);
            this.stats.items_processed++;
            this.logger.debug('Item marked as processed', {
                item_id: itemId,
                type: item.type,
                attempts: item.attempts
            });
            return { success: true };
        }
        catch (error) {
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
    async markFailed(itemId, error, scheduleRetry = true) {
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
            }
            else {
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
        }
        catch (err) {
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
    getStats() {
        const byPriority = {};
        const byType = {};
        let oldestAge = 0;
        let totalSize = 0;
        const now = Date.now();
        let pending = 0;
        let retrying = 0;
        let failed = 0;
        for (const item of this.queue) {
            byPriority[item.priority] = (byPriority[item.priority] || 0) + 1;
            byType[item.type] = (byType[item.type] || 0) + 1;
            const age = now - item.created_at.getTime();
            oldestAge = Math.max(oldestAge, age);
            totalSize += JSON.stringify(item).length;
            if (item.attempts >= item.max_attempts) {
                failed++;
            }
            else if (item.attempts > 0) {
                retrying++;
            }
            else {
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
            disk_usage_bytes: 0
        };
    }
    async getItems(status, limit = 50, offset = 0) {
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
    async removeItem(itemId) {
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
        }
        catch (error) {
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Failed to remove item'
            };
        }
    }
    async clearFailed() {
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
        }
        catch (error) {
            this.logger.error('Failed to clear failed items', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return {
                success: false,
                items_removed: 0
            };
        }
    }
    generateItemId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    findInsertPosition(item) {
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
    calculateRetryDelay(attempt, policy) {
        let delay = policy.initial_delay_ms * Math.pow(policy.backoff_multiplier, attempt - 1);
        delay = Math.min(delay, policy.max_delay_ms);
        const jitter = delay * policy.jitter_factor * (Math.random() * 2 - 1);
        delay += jitter;
        return Math.max(0, Math.round(delay));
    }
    async makeSpace() {
        const now = Date.now();
        const maxAge = this.config.max_item_age_ms;
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
        if (this.queue.length >= this.config.max_queue_size) {
            const failedLowPriority = this.queue
                .filter(item => item.attempts >= item.max_attempts && item.priority === 'low')
                .sort((a, b) => a.created_at.getTime() - b.created_at.getTime());
            const toRemove = Math.min(failedLowPriority.length, this.queue.length - this.config.max_queue_size + 100);
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
    async cleanup() {
        const before = this.queue.length;
        await this.makeSpace();
        if (this.queue.length !== before) {
            await this.persistQueue();
        }
        this.logger.debug('Queue cleanup completed', {
            items_before: before,
            items_after: this.queue.length,
            items_removed: before - this.queue.length
        });
    }
    async loadQueue() {
        try {
            if (await fs.pathExists(this.queueFile)) {
                const data = await fs.readJSON(this.queueFile);
                this.queue = data.items.map((item) => ({
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
        }
        catch (error) {
            this.logger.error('Failed to load queue from disk', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            this.queue = [];
        }
    }
    async persistQueue() {
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
        }
        catch (error) {
            this.logger.error('Failed to persist queue to disk', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
}
exports.SyncQueueService = SyncQueueService;
//# sourceMappingURL=sync-queue.service.js.map