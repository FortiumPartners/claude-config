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
exports.FailoverHandler = void 0;
const events_1 = require("events");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
class FailoverHandler extends events_1.EventEmitter {
    prisma;
    tenantSchemaName;
    config;
    localMetricsDir;
    currentMode = 'hybrid';
    lastFailover = null;
    failoverReason = null;
    connectionAttempts = 0;
    successfulConnections = 0;
    failedConnections = 0;
    isRecovering = false;
    startTime = Date.now();
    healthCheckInterval = null;
    failoverHistory = [];
    constructor(prisma, tenantSchemaName, config = {}) {
        super();
        this.prisma = prisma;
        this.tenantSchemaName = tenantSchemaName;
        this.localMetricsDir = path.join(os.homedir(), '.agent-os', 'metrics');
        this.config = {
            maxRetryAttempts: 3,
            retryInterval: 5000,
            healthCheckInterval: 30000,
            connectionTimeout: 10000,
            degradedModeThreshold: 50,
            autoRecoveryEnabled: true,
            fallbackToLocalOnly: true,
            persistFailoverState: true,
            ...config
        };
        this.initialize();
    }
    async initialize() {
        console.log('🛡️  Initializing Failover Handler...');
        if (this.config.persistFailoverState) {
            await this.loadFailoverState();
        }
        this.startHealthChecks();
        this.setupProcessHandlers();
        console.log(`✅ Failover Handler initialized (mode: ${this.currentMode})`);
        this.emit('initialized', { mode: this.currentMode });
    }
    async handleConnectionFailure(error) {
        this.failedConnections++;
        const errorRate = this.calculateErrorRate();
        console.warn(`🔥 Connection failure detected (error rate: ${errorRate}%):`, error?.message);
        if (errorRate >= this.config.degradedModeThreshold && this.currentMode === 'hybrid') {
            await this.initiateFailover('degraded', `High error rate: ${errorRate}%`);
        }
        else if (this.currentMode === 'hybrid' || this.currentMode === 'degraded') {
            await this.initiateFailover('local_only', error?.message || 'Connection failure');
        }
    }
    async handleServiceDegradation(reason) {
        if (this.currentMode === 'hybrid') {
            await this.initiateFailover('degraded', reason);
        }
    }
    async attemptRecovery() {
        if (this.isRecovering || this.currentMode === 'hybrid') {
            return false;
        }
        this.isRecovering = true;
        console.log('🔄 Attempting failover recovery...');
        try {
            const isHealthy = await this.performHealthCheck();
            if (isHealthy) {
                const previousMode = this.currentMode;
                await this.initiateRecovery(previousMode);
                console.log('✅ Failover recovery successful');
                this.emit('recovery', {
                    fromMode: previousMode,
                    toMode: this.currentMode,
                    duration: Date.now() - (this.lastFailover?.getTime() || Date.now())
                });
                return true;
            }
            else {
                console.log('⚠️  Recovery attempt failed - connection still unhealthy');
                return false;
            }
        }
        catch (error) {
            console.error('❌ Recovery attempt failed:', error);
            return false;
        }
        finally {
            this.isRecovering = false;
        }
    }
    getFailoverStatus() {
        return {
            currentMode: this.currentMode,
            lastFailover: this.lastFailover,
            failoverReason: this.failoverReason,
            connectionAttempts: this.connectionAttempts,
            successfulConnections: this.successfulConnections,
            failedConnections: this.failedConnections,
            errorRate: this.calculateErrorRate(),
            isRecovering: this.isRecovering,
            uptime: Date.now() - this.startTime
        };
    }
    getFailoverHistory() {
        return [...this.failoverHistory];
    }
    async forceFailover(mode, reason = 'Manual failover') {
        await this.initiateFailover(mode, reason);
    }
    isInFailoverMode() {
        return this.currentMode !== 'hybrid';
    }
    stop() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
        console.log('🛑 Failover Handler stopped');
        this.emit('stopped');
    }
    async initiateFailover(targetMode, reason) {
        const previousMode = this.currentMode;
        if (previousMode === targetMode) {
            return;
        }
        console.log(`🔄 Initiating failover: ${previousMode} → ${targetMode} (${reason})`);
        const failoverStart = Date.now();
        try {
            await this.executeFailoverActions(previousMode, targetMode);
            this.currentMode = targetMode;
            this.lastFailover = new Date();
            this.failoverReason = reason;
            const failoverEvent = {
                type: 'failover',
                timestamp: new Date(),
                fromMode: previousMode,
                toMode: targetMode,
                reason,
                duration: Date.now() - failoverStart
            };
            this.failoverHistory.push(failoverEvent);
            if (this.config.persistFailoverState) {
                await this.saveFailoverState();
            }
            console.log(`✅ Failover completed: ${previousMode} → ${targetMode} in ${failoverEvent.duration}ms`);
            this.emit('failover', failoverEvent);
            if (this.config.autoRecoveryEnabled && targetMode !== 'hybrid') {
                this.scheduleRecoveryAttempt();
            }
        }
        catch (error) {
            console.error(`❌ Failover failed: ${previousMode} → ${targetMode}:`, error);
            this.emit('failoverError', { previousMode, targetMode, reason, error });
        }
    }
    async executeFailoverActions(fromMode, toMode) {
        switch (toMode) {
            case 'local_only':
                await this.switchToLocalOnly();
                break;
            case 'remote_only':
                await this.switchToRemoteOnly();
                break;
            case 'degraded':
                await this.switchToDegradedMode();
                break;
            case 'hybrid':
                await this.switchToHybridMode();
                break;
        }
    }
    async switchToLocalOnly() {
        console.log('📱 Switching to local-only mode...');
        await this.ensureLocalStorageAvailable();
        await this.queuePendingRemoteOperations();
        console.log('✅ Local-only mode activated');
    }
    async switchToRemoteOnly() {
        console.log('☁️  Switching to remote-only mode...');
        const isRemoteHealthy = await this.performHealthCheck();
        if (!isRemoteHealthy) {
            throw new Error('Cannot switch to remote-only mode: remote service unhealthy');
        }
        await this.syncLocalChangesToRemote();
        console.log('✅ Remote-only mode activated');
    }
    async switchToDegradedMode() {
        console.log('⚡ Switching to degraded mode...');
        await this.ensureLocalStorageAvailable();
        await this.configureDegradedRemoteOperations();
        console.log('✅ Degraded mode activated');
    }
    async switchToHybridMode() {
        console.log('🔄 Switching to hybrid mode...');
        await this.ensureLocalStorageAvailable();
        const isRemoteHealthy = await this.performHealthCheck();
        if (!isRemoteHealthy) {
            throw new Error('Cannot switch to hybrid mode: remote service unhealthy');
        }
        await this.syncLocalChangesToRemote();
        console.log('✅ Hybrid mode activated');
    }
    async initiateRecovery(fromMode) {
        console.log(`🔄 Initiating recovery from ${fromMode} to hybrid mode...`);
        await this.executeFailoverActions(fromMode, 'hybrid');
        this.currentMode = 'hybrid';
        this.lastFailover = null;
        this.failoverReason = null;
        this.failedConnections = 0;
        this.successfulConnections++;
    }
    startHealthChecks() {
        this.healthCheckInterval = setInterval(async () => {
            try {
                const isHealthy = await this.performHealthCheck();
                if (isHealthy) {
                    this.successfulConnections++;
                    if (this.config.autoRecoveryEnabled && this.currentMode !== 'hybrid') {
                        await this.attemptRecovery();
                    }
                }
                else {
                    this.failedConnections++;
                    const errorRate = this.calculateErrorRate();
                    if (errorRate >= this.config.degradedModeThreshold && this.currentMode === 'hybrid') {
                        await this.handleServiceDegradation(`Health check failed, error rate: ${errorRate}%`);
                    }
                }
                this.emit('healthCheck', {
                    healthy: isHealthy,
                    mode: this.currentMode,
                    errorRate: this.calculateErrorRate()
                });
            }
            catch (error) {
                console.warn('Health check failed:', error.message);
                this.failedConnections++;
            }
        }, this.config.healthCheckInterval);
    }
    async performHealthCheck() {
        try {
            this.connectionAttempts++;
            const healthCheckPromise = this.prisma.$queryRaw `SELECT 1 as health_check`;
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Health check timeout')), this.config.connectionTimeout);
            });
            await Promise.race([healthCheckPromise, timeoutPromise]);
            await this.prisma.$queryRawUnsafe(`SELECT 1 FROM "${this.tenantSchemaName}".metrics_sessions LIMIT 1`);
            return true;
        }
        catch (error) {
            console.warn('Health check failed:', error.message);
            return false;
        }
    }
    calculateErrorRate() {
        const totalConnections = this.successfulConnections + this.failedConnections;
        return totalConnections > 0 ? Math.round((this.failedConnections / totalConnections) * 100) : 0;
    }
    scheduleRecoveryAttempt() {
        setTimeout(async () => {
            if (this.currentMode !== 'hybrid' && !this.isRecovering) {
                await this.attemptRecovery();
            }
        }, this.config.retryInterval);
    }
    async ensureLocalStorageAvailable() {
        try {
            await fs.mkdir(this.localMetricsDir, { recursive: true });
            const testFile = path.join(this.localMetricsDir, '.failover-test');
            await fs.writeFile(testFile, 'test');
            await fs.unlink(testFile);
        }
        catch (error) {
            throw new Error(`Local storage unavailable: ${error.message}`);
        }
    }
    async queuePendingRemoteOperations() {
        console.log('📋 Queuing pending remote operations...');
    }
    async syncLocalChangesToRemote() {
        console.log('🔄 Syncing local changes to remote...');
    }
    async configureDegradedRemoteOperations() {
        console.log('⚡ Configuring degraded remote operations...');
    }
    async saveFailoverState() {
        try {
            const stateFile = path.join(this.localMetricsDir, '.failover-state.json');
            const state = {
                currentMode: this.currentMode,
                lastFailover: this.lastFailover,
                failoverReason: this.failoverReason,
                connectionStats: {
                    attempts: this.connectionAttempts,
                    successful: this.successfulConnections,
                    failed: this.failedConnections
                },
                failoverHistory: this.failoverHistory.slice(-10)
            };
            await fs.writeFile(stateFile, JSON.stringify(state, null, 2));
        }
        catch (error) {
            console.warn('Failed to save failover state:', error.message);
        }
    }
    async loadFailoverState() {
        try {
            const stateFile = path.join(this.localMetricsDir, '.failover-state.json');
            const data = await fs.readFile(stateFile, 'utf8');
            const state = JSON.parse(data);
            this.currentMode = state.currentMode || 'hybrid';
            this.lastFailover = state.lastFailover ? new Date(state.lastFailover) : null;
            this.failoverReason = state.failoverReason;
            if (state.connectionStats) {
                this.connectionAttempts = state.connectionStats.attempts || 0;
                this.successfulConnections = state.connectionStats.successful || 0;
                this.failedConnections = state.connectionStats.failed || 0;
            }
            if (state.failoverHistory) {
                this.failoverHistory = state.failoverHistory.map((event) => ({
                    ...event,
                    timestamp: new Date(event.timestamp)
                }));
            }
            console.log(`📂 Loaded failover state: ${this.currentMode}`);
        }
        catch (error) {
            console.log('📂 No existing failover state found, starting fresh');
        }
    }
    setupProcessHandlers() {
        process.on('SIGINT', () => {
            console.log('🛑 Graceful shutdown initiated...');
            this.stop();
            process.exit(0);
        });
        process.on('SIGTERM', () => {
            console.log('🛑 Graceful shutdown initiated...');
            this.stop();
            process.exit(0);
        });
    }
}
exports.FailoverHandler = FailoverHandler;
//# sourceMappingURL=failover-handler.js.map