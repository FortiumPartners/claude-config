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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HybridMetricsCollector = void 0;
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const node_fetch_1 = __importDefault(require("node-fetch"));
class HybridMetricsCollector {
    sessionService;
    toolMetricsService;
    logger;
    config;
    localMetricsDir;
    queueFile;
    statusFile;
    syncQueue = [];
    syncInProgress = false;
    remoteHealth = {
        available: false,
        last_check: new Date(0),
        consecutive_failures: 0,
        avg_response_time_ms: 0
    };
    performanceStats = {
        local_operations: { count: 0, total_time_ms: 0 },
        remote_operations: { count: 0, total_time_ms: 0 },
        sync_operations: { success: 0, failure: 0 }
    };
    constructor(config, logger) {
        this.config = {
            mode: 'hybrid',
            sync_interval_ms: 5 * 60 * 1000,
            retry_attempts: 3,
            timeout_ms: 5000,
            fallback_threshold_ms: 100,
            local_hooks_path: path.join(os.homedir(), '.agent-os', 'metrics'),
            ...config
        };
        this.logger = logger;
        this.localMetricsDir = this.config.local_hooks_path;
        this.queueFile = path.join(this.localMetricsDir, 'sync_queue.json');
        this.statusFile = path.join(this.localMetricsDir, 'collector_status.json');
        this.initializeCollector();
    }
    async initializeCollector() {
        try {
            await fs.ensureDir(this.localMetricsDir);
            await this.loadSyncQueue();
            if (this.config.mode !== 'local') {
                setInterval(() => this.processSyncQueue(), this.config.sync_interval_ms);
                this.checkRemoteHealth();
            }
            this.logger.info('Hybrid metrics collector initialized', {
                mode: this.config.mode,
                local_path: this.localMetricsDir,
                remote_endpoint: this.config.remote_endpoint,
                sync_interval_ms: this.config.sync_interval_ms
            });
        }
        catch (error) {
            this.logger.error('Failed to initialize hybrid collector', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    setRemoteServices(sessionService, toolMetricsService) {
        this.sessionService = sessionService;
        this.toolMetricsService = toolMetricsService;
    }
    async collectMetrics(data) {
        const startTime = performance.now();
        try {
            const localResult = await this.saveLocalMetrics(data);
            let remoteSynced = false;
            let fallbackActivated = false;
            if (this.config.mode !== 'local' && this.shouldAttemptRemoteSync()) {
                const remoteStartTime = performance.now();
                try {
                    await this.syncToRemote(data);
                    remoteSynced = true;
                    const remoteTime = performance.now() - remoteStartTime;
                    this.updateRemotePerformanceStats(remoteTime, true);
                    this.remoteHealth.available = true;
                    this.remoteHealth.consecutive_failures = 0;
                }
                catch (error) {
                    const remoteTime = performance.now() - remoteStartTime;
                    this.updateRemotePerformanceStats(remoteTime, false);
                    if (remoteTime > this.config.fallback_threshold_ms) {
                        fallbackActivated = true;
                        this.activateFallbackMode();
                    }
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
        }
        catch (error) {
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
    async saveLocalMetrics(data) {
        try {
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
            if (data.tool_name) {
                await fs.appendFile(metricsLog, JSON.stringify(logEntry) + '\n');
            }
            if (data.session_id) {
                await fs.appendFile(sessionLog, JSON.stringify(logEntry) + '\n');
            }
            const realtimeDir = path.join(this.localMetricsDir, 'realtime');
            await fs.ensureDir(realtimeDir);
            const activityFile = path.join(realtimeDir, 'activity.log');
            const activityEntry = `${data.timestamp.toISOString()}|${data.tool_name ? 'tool_complete' : 'session_activity'}|${data.tool_name || data.agent_name || 'unknown'}|${data.status || 'unknown'}\n`;
            await fs.appendFile(activityFile, activityEntry);
            return true;
        }
        catch (error) {
            this.logger.error('Failed to save local metrics', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return false;
        }
    }
    async syncToRemote(data) {
        if (!this.config.remote_endpoint) {
            throw new Error('Remote endpoint not configured');
        }
        const timeout = new AbortController();
        const timeoutId = setTimeout(() => timeout.abort(), this.config.timeout_ms);
        try {
            if (this.sessionService && this.toolMetricsService) {
                await this.syncWithLocalServices(data);
            }
            else {
                await this.syncWithHttpAPI(data, timeout.signal);
            }
        }
        finally {
            clearTimeout(timeoutId);
        }
    }
    async syncWithLocalServices(data) {
        if (!this.sessionService || !this.toolMetricsService) {
            throw new Error('Local services not available');
        }
        const organizationId = this.config.organization_id;
        if (data.tool_name) {
            await this.toolMetricsService.recordToolExecution(organizationId, {
                user_id: data.user_id,
                tool_name: data.tool_name,
                execution_environment: data.metadata?.execution_environment,
                input_parameters: data.metadata?.input_parameters,
                output_summary: data.metadata?.output_summary
            }, data.execution_time_ms || 0, data.status || 'success', data.error_message);
        }
        if (data.session_id && data.agent_name) {
            await this.sessionService.updateSessionActivity(organizationId, data.session_id, {
                agent_name: data.agent_name,
                execution_time_ms: data.execution_time_ms,
                status: data.status
            });
        }
    }
    async syncWithHttpAPI(data, signal) {
        const endpoint = `${this.config.remote_endpoint}/api/v1/metrics/hybrid-sync`;
        const response = await (0, node_fetch_1.default)(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config.remote_api_key}`,
                'X-Organization-ID': this.config.organization_id
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
        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || 'Remote API error');
        }
    }
    async queueForRetry(data) {
        const queueItem = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            data,
            attempts: 0,
            last_attempt: new Date(0),
            created: new Date()
        };
        this.syncQueue.push(queueItem);
        if (this.syncQueue.length > 1000) {
            this.syncQueue = this.syncQueue.slice(-900);
        }
        await this.saveSyncQueue();
    }
    async processSyncQueue() {
        if (this.syncInProgress || this.syncQueue.length === 0) {
            return;
        }
        if (!this.remoteHealth.available) {
            await this.checkRemoteHealth();
            if (!this.remoteHealth.available) {
                return;
            }
        }
        this.syncInProgress = true;
        try {
            const itemsToProcess = this.syncQueue.splice(0, 10);
            const results = await Promise.allSettled(itemsToProcess.map(item => this.processQueueItem(item)));
            results.forEach((result, index) => {
                const item = itemsToProcess[index];
                if (result.status === 'rejected') {
                    item.attempts++;
                    item.last_attempt = new Date();
                    if (item.attempts < this.config.retry_attempts) {
                        this.syncQueue.push(item);
                    }
                    else {
                        this.logger.warn('Max retry attempts reached, dropping metrics', {
                            item_id: item.id,
                            attempts: item.attempts,
                            age_minutes: (Date.now() - item.created.getTime()) / (60 * 1000)
                        });
                    }
                    this.performanceStats.sync_operations.failure++;
                }
                else {
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
        }
        catch (error) {
            this.logger.error('Error processing sync queue', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
        finally {
            this.syncInProgress = false;
        }
    }
    async processQueueItem(item) {
        await this.syncToRemote(item.data);
    }
    async checkRemoteHealth() {
        const now = new Date();
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
            const timeoutId = setTimeout(() => timeout.abort(), 5000);
            const response = await (0, node_fetch_1.default)(`${this.config.remote_endpoint}/api/mcp/health`, {
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
            }
            else {
                throw new Error(`Health check failed: ${response.status}`);
            }
        }
        catch (error) {
            this.remoteHealth.available = false;
            this.remoteHealth.consecutive_failures++;
            this.logger.warn('Remote health check failed', {
                endpoint: this.config.remote_endpoint,
                consecutive_failures: this.remoteHealth.consecutive_failures,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    activateFallbackMode() {
        this.logger.warn('Activating fallback mode due to remote performance issues', {
            threshold_ms: this.config.fallback_threshold_ms,
            consecutive_failures: this.remoteHealth.consecutive_failures
        });
        this.remoteHealth.available = false;
    }
    getSyncStatus() {
        const localStats = this.performanceStats.local_operations;
        const remoteStats = this.performanceStats.remote_operations;
        const syncStats = this.performanceStats.sync_operations;
        return {
            mode: this.config.mode,
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
    shouldAttemptRemoteSync() {
        return this.remoteHealth.available ||
            (this.remoteHealth.consecutive_failures < 5);
    }
    async loadSyncQueue() {
        try {
            if (await fs.pathExists(this.queueFile)) {
                const data = await fs.readJSON(this.queueFile);
                this.syncQueue = data.queue || [];
                this.logger.info('Sync queue loaded', {
                    items: this.syncQueue.length
                });
            }
        }
        catch (error) {
            this.logger.error('Failed to load sync queue', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    async saveSyncQueue() {
        try {
            await fs.writeJSON(this.queueFile, {
                queue: this.syncQueue,
                last_updated: new Date().toISOString()
            });
        }
        catch (error) {
            this.logger.error('Failed to save sync queue', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    updateLocalPerformanceStats(timeMs, success) {
        this.performanceStats.local_operations.count++;
        this.performanceStats.local_operations.total_time_ms += timeMs;
    }
    updateRemotePerformanceStats(timeMs, success) {
        this.performanceStats.remote_operations.count++;
        this.performanceStats.remote_operations.total_time_ms += timeMs;
    }
}
exports.HybridMetricsCollector = HybridMetricsCollector;
//# sourceMappingURL=hybrid-collector.js.map