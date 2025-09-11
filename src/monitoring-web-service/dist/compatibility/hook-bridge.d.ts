import { PrismaClient } from '../generated/prisma-client';
import { ModernSession, ModernToolMetric } from './format-converter';
interface SyncResult {
    success: boolean;
    sessionsSynced: number;
    toolMetricsSynced: number;
    errors: string[];
}
export declare class HookBridge {
    private readonly prisma;
    private readonly tenantId;
    private readonly formatConverter;
    private readonly localMetricsDir;
    private readonly sessionCache;
    private readonly toolMetricCache;
    private syncInProgress;
    constructor(prisma: PrismaClient, tenantId: string);
    createSession(session: ModernSession): Promise<ModernSession>;
    updateSession(sessionId: string, updates: Partial<ModernSession>): Promise<ModernSession | null>;
    getSession(sessionId: string): Promise<ModernSession | null>;
    getSessions(options: {
        user?: string;
        limit?: number;
        offset?: number;
        startDate?: Date;
        endDate?: Date;
    }): Promise<ModernSession[]>;
    deleteSession(sessionId: string): Promise<boolean>;
    recordToolMetric(metric: Partial<ModernToolMetric>): Promise<ModernToolMetric>;
    getToolMetrics(sessionId: string): Promise<ModernToolMetric[]>;
    handleSessionStart(sessionData: any): Promise<any>;
    handleSessionEnd(sessionData: any): Promise<any>;
    handleToolUsage(toolData: any): Promise<any>;
    getProductivityAnalytics(options: {
        user?: string;
        days?: number;
    }): Promise<any>;
    getToolAnalytics(options: {
        user?: string;
        days?: number;
    }): Promise<any>;
    getSessionAnalytics(sessionId: string): Promise<any | null>;
    getDashboardMetrics(user?: string): Promise<any>;
    getProductivityIndicators(user?: string): Promise<any>;
    getBaseline(user?: string): Promise<any>;
    getMigrationStatus(): Promise<any>;
    syncLocalData(syncData?: any): Promise<SyncResult>;
    private saveSessionLocally;
    private saveToolMetricLocally;
    private getSessionLocally;
    private syncSessionToCloud;
    private syncToolMetricToCloud;
    private getSessionFromCloud;
    private getSessionsFromCloud;
    private getToolMetricsFromCloud;
    private updateSessionSyncStatus;
    private updateToolMetricSyncStatus;
    private startBackgroundSync;
    private generateId;
    private getAllLocalSessions;
    private getUnsyncedLocalSessions;
    private getLocalToolMetricsForSession;
    private filterSessions;
    private deduplicateSessions;
    private deleteSessionLocally;
    private deleteSessionFromCloud;
    private updateProductivityIndicators;
    private calculateProductivityScore;
    private calculateEfficiencyRating;
}
export {};
//# sourceMappingURL=hook-bridge.d.ts.map