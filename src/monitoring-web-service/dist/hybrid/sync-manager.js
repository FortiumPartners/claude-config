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
exports.SyncManager = void 0;
exports.createSyncManager = createSyncManager;
const format_converter_1 = require("../compatibility/format-converter");
const conflict_resolver_1 = require("./conflict-resolver");
const failover_handler_1 = require("./failover-handler");
const events_1 = require("events");
const path = __importStar(require("path"));
const os = __importStar(require("os"));
class SyncManager extends events_1.EventEmitter {
    prisma;
    config;
    formatConverter;
    conflictResolver;
    failoverHandler;
    localMetricsDir;
    syncQueue = [];
    syncInProgress = false;
    syncInterval = null;
    startTime = Date.now();
    syncStats = {
        totalSynced: 0,
        totalConflicts: 0,
        totalErrors: 0
    };
    constructor(prisma, config) {
        super();
        this.prisma = prisma;
        this.config = config;
        this.formatConverter = new format_converter_1.FormatConverter();
        this.conflictResolver = new conflict_resolver_1.ConflictResolver(config.conflictResolution);
        this.failoverHandler = new failover_handler_1.FailoverHandler(prisma, config.tenantSchemaName);
        this.localMetricsDir = path.join(os.homedir(), '.agent-os', 'metrics');
        this.initialize();
    }
    initialize() {
        console.log('🔄 Initializing Hybrid Sync Manager...');
        if (this.config.syncInterval > 0) {
            this.startPeriodicSync();
        }
        if (this.config.enableRealTimeSync) {
            this.setupRealTimeSyncListeners();
        }
        if (this.config.enableOfflineMode) {
            this.setupOfflineModeHandling();
        }
        console.log('✅ Sync Manager initialized');
        this.emit('initialized');
    }
    startPeriodicSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
        this.syncInterval = setInterval(async () => {
            try {
                await this.performSync();
            }
            catch (error) {
                console.error('Periodic sync failed:', error);
                this.emit('syncError', error);
            }
        }, this.config.syncInterval);
        console.log(`📅 Periodic sync started (interval: ${this.config.syncInterval}ms)`);
    }
    async performSync() {
        if (this.syncInProgress) {
            throw new Error('Sync already in progress');
        }
        this.syncInProgress = true;
        const syncId = this.generateSyncId();
        const startTime = new Date();
        console.log(`🔄 Starting sync ${syncId} (${this.config.syncStrategy})`);
        const result = {
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
            const connectionStatus = await this.checkConnectionStatus();
            if (connectionStatus === 'offline' && !this.config.enableOfflineMode) {
                throw new Error('Remote server unavailable and offline mode disabled');
            }
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
            this.syncStats.totalSynced += totalRecords;
            this.syncStats.totalConflicts += result.conflicts.sessionsConflicted + result.conflicts.toolMetricsConflicted;
            console.log(`✅ Sync ${syncId} completed successfully in ${result.performance.totalDurationMs}ms`);
            console.log(`📊 Processed: ${totalRecords} records, Conflicts: ${result.conflicts.resolvedConflicts}/${result.conflicts.unresolvedConflicts}`);
            this.emit('syncComplete', result);
            return result;
        }
        catch (error) {
            result.success = false;
            result.endTime = new Date();
            result.performance.totalDurationMs = result.endTime.getTime() - result.startTime.getTime();
            this.syncStats.totalErrors++;
            console.error(`❌ Sync ${syncId} failed:`, error);
            this.emit('syncError', { syncId, error, result });
            if (error.message.includes('connection') || error.message.includes('network')) {
                await this.failoverHandler.handleConnectionFailure();
            }
            return result;
        }
        finally {
            this.syncInProgress = false;
        }
    }
    async syncLocalToRemote(result) {
        console.log('📤 Syncing local data to remote...');
        const localIOStart = Date.now();
        const localSessions = await this.getUnsyncedLocalSessions();
        result.localChanges.sessionsProcessed = localSessions.length;
        const localToolMetrics = await this.getUnsyncedLocalToolMetrics();
        result.localChanges.toolMetricsProcessed = localToolMetrics.length;
        result.performance.localIOTimeMs = Date.now() - localIOStart;
        if (localSessions.length === 0 && localToolMetrics.length === 0) {
            console.log('📤 No local data to sync');
            return;
        }
        const remoteIOStart = Date.now();
        for (const sessionBatch of this.createBatches(localSessions, this.config.batchSize)) {
            try {
                for (const session of sessionBatch) {
                    const remoteSession = await this.getRemoteSession(session.id);
                    if (remoteSession && remoteSession.updatedAt > session.updatedAt) {
                        result.conflicts.sessionsConflicted++;
                        const resolved = await this.conflictResolver.resolveSessionConflict(session, remoteSession);
                        if (resolved) {
                            await this.uploadSession(resolved);
                            result.conflicts.resolvedConflicts++;
                            result.localChanges.sessionsUploaded++;
                        }
                        else {
                            result.conflicts.unresolvedConflicts++;
                        }
                    }
                    else {
                        await this.uploadSession(session);
                        result.localChanges.sessionsUploaded++;
                    }
                }
            }
            catch (error) {
                result.localChanges.uploadErrors.push(`Session batch upload failed: ${error.message}`);
            }
        }
        for (const metricBatch of this.createBatches(localToolMetrics, this.config.batchSize)) {
            try {
                for (const metric of metricBatch) {
                    const remoteMetric = await this.getRemoteToolMetric(metric.id);
                    if (remoteMetric && remoteMetric.updatedAt > metric.updatedAt) {
                        result.conflicts.toolMetricsConflicted++;
                        const resolved = await this.conflictResolver.resolveToolMetricConflict(metric, remoteMetric);
                        if (resolved) {
                            await this.uploadToolMetric(resolved);
                            result.conflicts.resolvedConflicts++;
                            result.localChanges.toolMetricsUploaded++;
                        }
                        else {
                            result.conflicts.unresolvedConflicts++;
                        }
                    }
                    else {
                        await this.uploadToolMetric(metric);
                        result.localChanges.toolMetricsUploaded++;
                    }
                }
            }
            catch (error) {
                result.localChanges.uploadErrors.push(`Tool metric batch upload failed: ${error.message}`);
            }
        }
        result.performance.remoteIOTimeMs = Date.now() - remoteIOStart;
        console.log(`📤 Uploaded ${result.localChanges.sessionsUploaded} sessions, ${result.localChanges.toolMetricsUploaded} tool metrics`);
    }
    async syncRemoteToLocal(result) {
        console.log('📥 Syncing remote data to local...');
        const remoteIOStart = Date.now();
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
        for (const session of remoteSessions) {
            try {
                const localSession = await this.getLocalSession(session.id);
                if (localSession && localSession.updatedAt > session.updatedAt) {
                    result.conflicts.sessionsConflicted++;
                    const resolved = await this.conflictResolver.resolveSessionConflict(localSession, session);
                    if (resolved) {
                        await this.saveLocalSession(resolved);
                        result.conflicts.resolvedConflicts++;
                        result.remoteChanges.sessionsDownloaded++;
                    }
                    else {
                        result.conflicts.unresolvedConflicts++;
                    }
                }
                else {
                    await this.saveLocalSession(session);
                    result.remoteChanges.sessionsDownloaded++;
                }
            }
            catch (error) {
                result.remoteChanges.downloadErrors.push(`Session ${session.id} download failed: ${error.message}`);
            }
        }
        for (const metric of remoteToolMetrics) {
            try {
                const localMetric = await this.getLocalToolMetric(metric.id);
                if (localMetric && localMetric.updatedAt > metric.updatedAt) {
                    result.conflicts.toolMetricsConflicted++;
                    const resolved = await this.conflictResolver.resolveToolMetricConflict(localMetric, metric);
                    if (resolved) {
                        await this.saveLocalToolMetric(resolved);
                        result.conflicts.resolvedConflicts++;
                        result.remoteChanges.toolMetricsDownloaded++;
                    }
                    else {
                        result.conflicts.unresolvedConflicts++;
                    }
                }
                else {
                    await this.saveLocalToolMetric(metric);
                    result.remoteChanges.toolMetricsDownloaded++;
                }
            }
            catch (error) {
                result.remoteChanges.downloadErrors.push(`Tool metric ${metric.id} download failed: ${error.message}`);
            }
        }
        result.performance.localIOTimeMs += Date.now() - localIOStart;
        console.log(`📥 Downloaded ${result.remoteChanges.sessionsDownloaded} sessions, ${result.remoteChanges.toolMetricsDownloaded} tool metrics`);
    }
    async syncBidirectional(result) {
        console.log('🔄 Performing bidirectional sync...');
        await this.syncLocalToRemote(result);
        await this.syncRemoteToLocal(result);
        result.direction = 'bidirectional';
    }
    async processSyncQueue(result) {
        if (this.syncQueue.length === 0)
            return;
        console.log(`📋 Processing ${this.syncQueue.length} queued items...`);
        this.syncQueue.sort((a, b) => {
            const priorityOrder = { 'high': 0, 'normal': 1, 'low': 2 };
            if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
                return priorityOrder[a.priority] - priorityOrder[b.priority];
            }
            return a.timestamp.getTime() - b.timestamp.getTime();
        });
        const processedItems = [];
        for (const item of this.syncQueue) {
            try {
                await this.processSyncQueueItem(item);
                processedItems.push(item.id);
            }
            catch (error) {
                item.retryCount++;
                if (item.retryCount >= this.config.retryAttempts) {
                    console.warn(`Queue item ${item.id} exceeded retry limit, removing from queue`);
                    processedItems.push(item.id);
                }
            }
        }
        this.syncQueue = this.syncQueue.filter(item => !processedItems.includes(item.id));
        console.log(`📋 Processed ${processedItems.length} queue items`);
    }
    addToSyncQueue(type, operation, data, priority = 'normal') {
        const item = {
            id: this.generateId(),
            type,
            operation,
            data,
            timestamp: new Date(),
            retryCount: 0,
            priority
        };
        this.syncQueue.push(item);
        if (priority === 'high' && this.config.enableRealTimeSync && !this.syncInProgress) {
            setImmediate(() => this.performSync().catch(error => console.error('Real-time sync failed:', error)));
        }
    }
    getSyncStatus() {
        const pendingLocal = this.syncQueue.filter(item => ['create', 'update'].includes(item.operation) && this.isLocalItem(item)).length;
        const pendingRemote = this.syncQueue.filter(item => ['create', 'update'].includes(item.operation) && !this.isLocalItem(item)).length;
        return {
            lastSync: new Date(),
            syncInProgress: this.syncInProgress,
            pendingLocal,
            pendingRemote,
            conflicts: this.syncStats.totalConflicts,
            failedAttempts: this.syncStats.totalErrors,
            totalSynced: this.syncStats.totalSynced,
            uptime: Date.now() - this.startTime,
            connectionStatus: 'online'
        };
    }
    async forcSync() {
        return this.performSync();
    }
    stop() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
        console.log('🛑 Sync Manager stopped');
        this.emit('stopped');
    }
    setupRealTimeSyncListeners() {
        console.log('👁  Real-time sync listeners setup');
    }
    setupOfflineModeHandling() {
        console.log('📡 Offline mode handling setup');
    }
    async checkConnectionStatus() {
        try {
            await this.prisma.$queryRaw `SELECT 1`;
            return 'online';
        }
        catch (error) {
            return 'offline';
        }
    }
    mapSyncStrategyToDirection() {
        switch (this.config.syncStrategy) {
            case 'local_first': return 'local_to_remote';
            case 'remote_first': return 'remote_to_local';
            case 'bidirectional': return 'bidirectional';
        }
    }
    generateSyncId() {
        return `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    generateId() {
        const crypto = require('crypto');
        return crypto.randomUUID();
    }
    createBatches(items, batchSize) {
        const batches = [];
        for (let i = 0; i < items.length; i += batchSize) {
            batches.push(items.slice(i, i + batchSize));
        }
        return batches;
    }
    isLocalItem(item) {
        return true;
    }
    async getUnsyncedLocalSessions() { return []; }
    async getUnsyncedLocalToolMetrics() { return []; }
    async getRemoteSession(id) { return null; }
    async getRemoteToolMetric(id) { return null; }
    async uploadSession(session) { }
    async uploadToolMetric(metric) { }
    async getLastSyncTime() { return new Date(Date.now() - 24 * 60 * 60 * 1000); }
    async getRemoteSessionsSince(since) { return []; }
    async getRemoteToolMetricsSince(since) { return []; }
    async getLocalSession(id) { return null; }
    async getLocalToolMetric(id) { return null; }
    async saveLocalSession(session) { }
    async saveLocalToolMetric(metric) { }
    async processSyncQueueItem(item) { }
}
exports.SyncManager = SyncManager;
function createSyncManager(prisma, tenantSchemaName, overrides = {}) {
    const defaultConfig = {
        syncStrategy: 'bidirectional',
        syncInterval: 5 * 60 * 1000,
        batchSize: 50,
        retryAttempts: 3,
        retryDelay: 1000,
        conflictResolution: 'remote_wins',
        enableRealTimeSync: true,
        enableOfflineMode: true,
        maxLocalCacheSize: 100,
        tenantSchemaName,
        ...overrides
    };
    return new SyncManager(prisma, defaultConfig);
}
//# sourceMappingURL=sync-manager.js.map