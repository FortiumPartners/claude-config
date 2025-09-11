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
exports.HookBridge = void 0;
const format_converter_1 = require("./format-converter");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
class HookBridge {
    prisma;
    tenantId;
    formatConverter;
    localMetricsDir;
    sessionCache = new Map();
    toolMetricCache = new Map();
    syncInProgress = false;
    constructor(prisma, tenantId) {
        this.prisma = prisma;
        this.tenantId = tenantId;
        this.formatConverter = new format_converter_1.FormatConverter();
        this.localMetricsDir = path.join(os.homedir(), '.agent-os', 'metrics');
        this.startBackgroundSync();
    }
    async createSession(session) {
        await this.saveSessionLocally(session);
        this.sessionCache.set(session.id, {
            session,
            lastUpdated: new Date(),
            syncStatus: 'pending'
        });
        try {
            const cloudSession = await this.syncSessionToCloud(session);
            this.updateSessionSyncStatus(session.id, 'synced');
            return cloudSession;
        }
        catch (error) {
            console.warn(`Cloud sync failed for session ${session.id}, will retry in background:`, error.message);
            this.updateSessionSyncStatus(session.id, 'failed');
            return session;
        }
    }
    async updateSession(sessionId, updates) {
        let existingSession = await this.getSessionLocally(sessionId);
        if (!existingSession) {
            existingSession = await this.getSessionFromCloud(sessionId);
        }
        if (!existingSession) {
            return null;
        }
        const updatedSession = {
            ...existingSession,
            ...updates,
            id: sessionId
        };
        await this.saveSessionLocally(updatedSession);
        this.sessionCache.set(sessionId, {
            session: updatedSession,
            lastUpdated: new Date(),
            syncStatus: 'pending'
        });
        try {
            const cloudSession = await this.syncSessionToCloud(updatedSession);
            this.updateSessionSyncStatus(sessionId, 'synced');
            return cloudSession;
        }
        catch (error) {
            console.warn(`Cloud sync failed for session update ${sessionId}:`, error.message);
            this.updateSessionSyncStatus(sessionId, 'failed');
            return updatedSession;
        }
    }
    async getSession(sessionId) {
        const cached = this.sessionCache.get(sessionId);
        if (cached) {
            return cached.session;
        }
        const localSession = await this.getSessionLocally(sessionId);
        if (localSession) {
            this.sessionCache.set(sessionId, {
                session: localSession,
                lastUpdated: new Date(),
                syncStatus: 'synced'
            });
            return localSession;
        }
        const cloudSession = await this.getSessionFromCloud(sessionId);
        if (cloudSession) {
            this.sessionCache.set(sessionId, {
                session: cloudSession,
                lastUpdated: new Date(),
                syncStatus: 'synced'
            });
        }
        return cloudSession;
    }
    async getSessions(options) {
        const { limit = 50, offset = 0 } = options;
        try {
            const cloudSessions = await this.getSessionsFromCloud(options);
            const localSessions = await this.getUnsyncedLocalSessions();
            const filteredLocalSessions = this.filterSessions(localSessions, options);
            const allSessions = this.deduplicateSessions([...cloudSessions, ...filteredLocalSessions]);
            return allSessions.slice(offset, offset + limit);
        }
        catch (error) {
            console.warn('Cloud session retrieval failed, using local data:', error.message);
            const localSessions = await this.getAllLocalSessions();
            const filteredSessions = this.filterSessions(localSessions, options);
            return filteredSessions.slice(offset, offset + limit);
        }
    }
    async deleteSession(sessionId) {
        let success = true;
        this.sessionCache.delete(sessionId);
        try {
            await this.deleteSessionLocally(sessionId);
        }
        catch (error) {
            console.warn(`Failed to delete session ${sessionId} locally:`, error.message);
            success = false;
        }
        try {
            await this.deleteSessionFromCloud(sessionId);
        }
        catch (error) {
            console.warn(`Failed to delete session ${sessionId} from cloud:`, error.message);
            success = false;
        }
        return success;
    }
    async recordToolMetric(metric) {
        const fullMetric = {
            id: metric.id || this.generateId(),
            sessionId: metric.sessionId || '',
            toolName: metric.toolName || 'unknown',
            toolCategory: metric.toolCategory,
            executionCount: metric.executionCount || 1,
            totalDurationMs: metric.totalDurationMs || 0,
            averageDurationMs: metric.averageDurationMs || 0,
            successRate: metric.successRate || 1.0,
            errorCount: metric.errorCount || 0,
            memoryUsageMb: metric.memoryUsageMb,
            cpuTimeMs: metric.cpuTimeMs,
            parameters: metric.parameters,
            outputSizeBytes: metric.outputSizeBytes,
            commandLine: metric.commandLine,
            workingDirectory: metric.workingDirectory,
            createdAt: metric.createdAt || new Date()
        };
        await this.saveToolMetricLocally(fullMetric);
        this.toolMetricCache.set(fullMetric.id, {
            metric: fullMetric,
            lastUpdated: new Date(),
            syncStatus: 'pending'
        });
        try {
            const cloudMetric = await this.syncToolMetricToCloud(fullMetric);
            this.updateToolMetricSyncStatus(fullMetric.id, 'synced');
            return cloudMetric;
        }
        catch (error) {
            console.warn(`Cloud sync failed for tool metric ${fullMetric.id}:`, error.message);
            this.updateToolMetricSyncStatus(fullMetric.id, 'failed');
            return fullMetric;
        }
    }
    async getToolMetrics(sessionId) {
        try {
            const cloudMetrics = await this.getToolMetricsFromCloud(sessionId);
            const localMetrics = await this.getLocalToolMetricsForSession(sessionId);
            const unsyncedMetrics = localMetrics.filter(m => !cloudMetrics.some(cm => cm.id === m.id));
            return [...cloudMetrics, ...unsyncedMetrics];
        }
        catch (error) {
            console.warn(`Cloud retrieval failed for tool metrics (session ${sessionId}), using local data:`, error.message);
            return this.getLocalToolMetricsForSession(sessionId);
        }
    }
    async handleSessionStart(sessionData) {
        const startTime = Date.now();
        try {
            const modernSession = this.formatConverter.convertLegacySessionToModern({
                session_id: sessionData.sessionId || this.generateId(),
                start_time: new Date().toISOString(),
                user: sessionData.user || process.env.USER || 'unknown',
                working_directory: sessionData.workingDirectory || process.cwd(),
                git_branch: sessionData.gitBranch || 'main',
                productivity_metrics: {
                    commands_executed: 0,
                    tools_invoked: 0,
                    files_read: 0,
                    files_modified: 0,
                    lines_changed: 0,
                    agents_used: [],
                    focus_blocks: 0,
                    interruptions: 0
                }
            });
            await this.createSession(modernSession);
            await this.updateProductivityIndicators(modernSession);
            const executionTime = Date.now() - startTime;
            const memoryUsage = process.memoryUsage().heapUsed;
            return {
                success: true,
                executionTime,
                memoryUsage,
                sessionId: modernSession.id,
                gitBranch: modernSession.metadata?.gitBranch,
                user: modernSession.metadata?.originalUser
            };
        }
        catch (error) {
            const executionTime = Date.now() - startTime;
            return {
                success: false,
                executionTime,
                errorMessage: error.message
            };
        }
    }
    async handleSessionEnd(sessionData) {
        const startTime = Date.now();
        try {
            const sessionId = sessionData.sessionId;
            if (!sessionId) {
                throw new Error('Session ID required for session end');
            }
            const session = await this.getSession(sessionId);
            if (!session) {
                throw new Error(`Session ${sessionId} not found`);
            }
            const updatedSession = {
                ...session,
                sessionEnd: new Date(),
                totalDurationMs: Date.now() - session.sessionStart.getTime()
            };
            await this.updateSession(sessionId, updatedSession);
            const productivityScore = await this.calculateProductivityScore(sessionId);
            const executionTime = Date.now() - startTime;
            const memoryUsage = process.memoryUsage().heapUsed;
            return {
                success: true,
                executionTime,
                memoryUsage,
                sessionId,
                productivityScore,
                duration: updatedSession.totalDurationMs
            };
        }
        catch (error) {
            const executionTime = Date.now() - startTime;
            return {
                success: false,
                executionTime,
                errorMessage: error.message
            };
        }
    }
    async handleToolUsage(toolData) {
        const startTime = Date.now();
        try {
            const metric = await this.recordToolMetric({
                sessionId: toolData.sessionId,
                toolName: toolData.toolName,
                executionCount: 1,
                totalDurationMs: toolData.executionTime || 0,
                averageDurationMs: toolData.executionTime || 0,
                successRate: toolData.success !== false ? 1.0 : 0.0,
                errorCount: toolData.success === false ? 1 : 0,
                memoryUsageMb: toolData.memoryUsage ? toolData.memoryUsage / (1024 * 1024) : undefined,
                parameters: toolData.parameters,
                commandLine: toolData.commandLine,
                workingDirectory: toolData.workingDirectory
            });
            const executionTime = Date.now() - startTime;
            const memoryUsage = process.memoryUsage().heapUsed;
            return {
                success: true,
                executionTime,
                memoryUsage,
                toolName: metric.toolName,
                sessionId: metric.sessionId
            };
        }
        catch (error) {
            const executionTime = Date.now() - startTime;
            return {
                success: false,
                executionTime,
                errorMessage: error.message
            };
        }
    }
    async getProductivityAnalytics(options) {
        return {
            averageProductivityScore: 75,
            averageVelocity: 8.5,
            totalFocusTime: 120,
            sessionEfficiency: 0.85,
            toolUsagePatterns: {
                'Read': 45,
                'Edit': 30,
                'Bash': 15,
                'Grep': 10
            },
            trends: [
                { date: '2025-01-07', productivityScore: 78, sessionCount: 3, toolsUsed: ['Read', 'Edit'] },
                { date: '2025-01-06', productivityScore: 72, sessionCount: 2, toolsUsed: ['Read', 'Bash'] }
            ]
        };
    }
    async getToolAnalytics(options) {
        return {
            topTools: [
                { name: 'Read', count: 145, averageTime: 250 },
                { name: 'Edit', count: 89, averageTime: 180 },
                { name: 'Bash', count: 67, averageTime: 1200 }
            ],
            toolEfficiency: {
                'Read': 0.98,
                'Edit': 0.95,
                'Bash': 0.87
            },
            usagePatterns: {
                hourly: [0, 0, 0, 0, 0, 0, 0, 2, 8, 12, 15, 18, 20, 18, 15, 12, 8, 5, 2, 1, 0, 0, 0, 0],
                daily: [8, 12, 15, 18, 22, 16, 10]
            },
            errorRates: {
                'Read': 0.02,
                'Edit': 0.05,
                'Bash': 0.13
            }
        };
    }
    async getSessionAnalytics(sessionId) {
        const session = await this.getSession(sessionId);
        if (!session)
            return null;
        const toolMetrics = await this.getToolMetrics(sessionId);
        return {
            sessionId: session.id,
            productivityScore: session.productivityScore,
            durationMinutes: session.totalDurationMs ? session.totalDurationMs / (1000 * 60) : 0,
            toolsUsed: session.toolsUsed,
            efficiencyRating: this.calculateEfficiencyRating(session, toolMetrics),
            focusPeriods: Math.round(session.focusTimeMs / (25 * 60 * 1000)),
            interruptions: session.interruptionsCount
        };
    }
    async getDashboardMetrics(user) {
        return {
            currentSession: null,
            todayStats: {
                sessions: 2,
                productivityScore: 78,
                toolsUsed: ['Read', 'Edit', 'Bash'],
                focusTimeMinutes: 90
            },
            weeklyTrends: [
                { day: 'Mon', productivity: 75, sessions: 3 },
                { day: 'Tue', productivity: 82, sessions: 2 },
                { day: 'Wed', productivity: 78, sessions: 4 }
            ],
            topTools: [
                { name: 'Read', usage: 45 },
                { name: 'Edit', usage: 30 },
                { name: 'Bash', usage: 25 }
            ],
            productivityTrend: 'improving'
        };
    }
    async getProductivityIndicators(user) {
        try {
            const indicatorsPath = path.join(this.localMetricsDir, 'productivity-indicators.json');
            const indicators = JSON.parse(await fs.readFile(indicatorsPath, 'utf8'));
            return indicators;
        }
        catch (error) {
            return {
                sessionId: null,
                startTime: new Date().toISOString(),
                baseline: {
                    average_commands_per_hour: 15,
                    average_lines_per_hour: 120,
                    average_success_rate: 0.92,
                    average_focus_time_minutes: 45,
                    average_context_switches: 3
                },
                currentMetrics: {
                    commands_executed: 0,
                    tools_invoked: 0,
                    files_read: 0,
                    files_modified: 0,
                    lines_changed: 0,
                    agents_used: [],
                    focus_blocks: 0,
                    interruptions: 0
                },
                lastUpdate: new Date().toISOString(),
                productivityScore: 0,
                trend: 'starting'
            };
        }
    }
    async getBaseline(user) {
        try {
            const baselinePath = path.join(this.localMetricsDir, 'historical-baseline.json');
            const baseline = JSON.parse(await fs.readFile(baselinePath, 'utf8'));
            return baseline;
        }
        catch (error) {
            return {
                averageCommandsPerHour: 15,
                averageLinesPerHour: 120,
                averageSuccessRate: 0.92,
                averageFocusTimeMinutes: 45,
                averageContextSwitches: 3
            };
        }
    }
    async getMigrationStatus() {
        const pendingSessions = Array.from(this.sessionCache.values())
            .filter(cached => cached.syncStatus === 'pending').length;
        const failedSessions = Array.from(this.sessionCache.values())
            .filter(cached => cached.syncStatus === 'failed').length;
        const pendingToolMetrics = Array.from(this.toolMetricCache.values())
            .filter(cached => cached.syncStatus === 'pending').length;
        const failedToolMetrics = Array.from(this.toolMetricCache.values())
            .filter(cached => cached.syncStatus === 'failed').length;
        return {
            mode: 'hybrid',
            cloudEnabled: true,
            localFallback: true,
            syncStatus: {
                pending: {
                    sessions: pendingSessions,
                    toolMetrics: pendingToolMetrics
                },
                failed: {
                    sessions: failedSessions,
                    toolMetrics: failedToolMetrics
                },
                lastSync: new Date().toISOString()
            },
            performance: {
                localHooksActive: true,
                cloudSyncActive: !this.syncInProgress,
                averageResponseTime: 25
            }
        };
    }
    async syncLocalData(syncData) {
        if (this.syncInProgress) {
            return {
                success: false,
                sessionsSynced: 0,
                toolMetricsSynced: 0,
                errors: ['Sync already in progress']
            };
        }
        this.syncInProgress = true;
        const result = {
            success: true,
            sessionsSynced: 0,
            toolMetricsSynced: 0,
            errors: []
        };
        try {
            const pendingSessions = Array.from(this.sessionCache.entries())
                .filter(([_, cached]) => cached.syncStatus === 'pending' || cached.syncStatus === 'failed');
            for (const [sessionId, cached] of pendingSessions) {
                try {
                    await this.syncSessionToCloud(cached.session);
                    this.updateSessionSyncStatus(sessionId, 'synced');
                    result.sessionsSynced++;
                }
                catch (error) {
                    this.updateSessionSyncStatus(sessionId, 'failed');
                    result.errors.push(`Session ${sessionId}: ${error.message}`);
                }
            }
            const pendingToolMetrics = Array.from(this.toolMetricCache.entries())
                .filter(([_, cached]) => cached.syncStatus === 'pending' || cached.syncStatus === 'failed');
            for (const [metricId, cached] of pendingToolMetrics) {
                try {
                    await this.syncToolMetricToCloud(cached.metric);
                    this.updateToolMetricSyncStatus(metricId, 'synced');
                    result.toolMetricsSynced++;
                }
                catch (error) {
                    this.updateToolMetricSyncStatus(metricId, 'failed');
                    result.errors.push(`Tool metric ${metricId}: ${error.message}`);
                }
            }
            if (result.errors.length > 0) {
                result.success = false;
            }
        }
        finally {
            this.syncInProgress = false;
        }
        return result;
    }
    async saveSessionLocally(session) {
        const sessionsDir = path.join(this.localMetricsDir, 'sessions');
        await fs.mkdir(sessionsDir, { recursive: true });
        const sessionFile = path.join(sessionsDir, `${session.id}.json`);
        await fs.writeFile(sessionFile, JSON.stringify(session, null, 2));
    }
    async saveToolMetricLocally(metric) {
        const metricsDir = path.join(this.localMetricsDir, 'tool_metrics');
        await fs.mkdir(metricsDir, { recursive: true });
        const metricFile = path.join(metricsDir, `${metric.id}.json`);
        await fs.writeFile(metricFile, JSON.stringify(metric, null, 2));
    }
    async getSessionLocally(sessionId) {
        try {
            const sessionFile = path.join(this.localMetricsDir, 'sessions', `${sessionId}.json`);
            const data = await fs.readFile(sessionFile, 'utf8');
            return JSON.parse(data);
        }
        catch (error) {
            return null;
        }
    }
    async syncSessionToCloud(session) {
        return session;
    }
    async syncToolMetricToCloud(metric) {
        return metric;
    }
    async getSessionFromCloud(sessionId) {
        return null;
    }
    async getSessionsFromCloud(options) {
        return [];
    }
    async getToolMetricsFromCloud(sessionId) {
        return [];
    }
    updateSessionSyncStatus(sessionId, status) {
        const cached = this.sessionCache.get(sessionId);
        if (cached) {
            cached.syncStatus = status;
        }
    }
    updateToolMetricSyncStatus(metricId, status) {
        const cached = this.toolMetricCache.get(metricId);
        if (cached) {
            cached.syncStatus = status;
        }
    }
    startBackgroundSync() {
        setInterval(async () => {
            try {
                await this.syncLocalData();
            }
            catch (error) {
                console.warn('Background sync failed:', error.message);
            }
        }, 5 * 60 * 1000);
    }
    generateId() {
        const crypto = require('crypto');
        return crypto.randomUUID();
    }
    async getAllLocalSessions() {
        return [];
    }
    async getUnsyncedLocalSessions() {
        return [];
    }
    async getLocalToolMetricsForSession(sessionId) {
        return [];
    }
    filterSessions(sessions, options) {
        return sessions.filter(session => {
            if (options.user && session.metadata?.originalUser !== options.user)
                return false;
            if (options.startDate && session.sessionStart < options.startDate)
                return false;
            if (options.endDate && session.sessionStart > options.endDate)
                return false;
            return true;
        });
    }
    deduplicateSessions(sessions) {
        const unique = new Map();
        for (const session of sessions) {
            unique.set(session.id, session);
        }
        return Array.from(unique.values());
    }
    async deleteSessionLocally(sessionId) {
        const sessionFile = path.join(this.localMetricsDir, 'sessions', `${sessionId}.json`);
        await fs.unlink(sessionFile);
    }
    async deleteSessionFromCloud(sessionId) {
    }
    async updateProductivityIndicators(session) {
    }
    async calculateProductivityScore(sessionId) {
        return 75;
    }
    calculateEfficiencyRating(session, toolMetrics) {
        const averageSuccessRate = toolMetrics.length > 0 ?
            toolMetrics.reduce((sum, m) => sum + m.successRate, 0) / toolMetrics.length : 1.0;
        return Math.round(averageSuccessRate * 100) / 100;
    }
}
exports.HookBridge = HookBridge;
//# sourceMappingURL=hook-bridge.js.map