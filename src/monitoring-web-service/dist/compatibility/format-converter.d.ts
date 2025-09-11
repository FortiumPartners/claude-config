import { LegacySessionRequest, LegacyToolMetricRequest } from './legacy-api';
export interface ModernSession {
    id: string;
    userId: string;
    sessionStart: Date;
    sessionEnd?: Date;
    totalDurationMs?: number;
    toolsUsed?: string[];
    productivityScore?: number;
    sessionType: string;
    projectId?: string;
    tags: string[];
    interruptionsCount: number;
    focusTimeMs: number;
    description?: string;
    metadata?: any;
}
export interface ModernToolMetric {
    id: string;
    sessionId: string;
    toolName: string;
    toolCategory?: string;
    executionCount: number;
    totalDurationMs: number;
    averageDurationMs: number;
    successRate: number;
    errorCount: number;
    memoryUsageMb?: number;
    cpuTimeMs?: number;
    parameters?: any;
    outputSizeBytes?: number;
    commandLine?: string;
    workingDirectory?: string;
    createdAt?: Date;
}
export declare class FormatConverter {
    convertLegacySessionToModern(legacy: LegacySessionRequest): ModernSession;
    convertModernSessionToLegacy(modern: ModernSession): LegacySessionRequest;
    convertLegacyToolMetricToModern(legacy: LegacyToolMetricRequest): Partial<ModernToolMetric>;
    convertModernToolMetricToLegacy(modern: ModernToolMetric): LegacyToolMetricRequest;
    aggregateLegacyToolMetrics(legacyMetrics: LegacyToolMetricRequest[]): ModernToolMetric[];
    convertAnalyticsToLegacyFormat(analytics: any): any;
    convertDashboardToLegacyFormat(dashboard: any): any;
    convertLegacySessionsBatch(legacySessions: LegacySessionRequest[]): ModernSession[];
    convertModernSessionsBatch(modernSessions: ModernSession[]): LegacySessionRequest[];
    private calculateProductivityScore;
    private reconstructProductivityMetrics;
    private mapUserToUserId;
    private mapUserIdToUser;
    private extractProjectId;
    private generateSessionDescription;
    private categorizeToolName;
    private generateId;
    validateLegacySession(session: any): {
        isValid: boolean;
        errors: string[];
    };
    validateLegacyToolMetric(metric: any): {
        isValid: boolean;
        errors: string[];
    };
    wrapResponseInLegacyFormat<T>(data: T, success?: boolean, error?: string): any;
}
//# sourceMappingURL=format-converter.d.ts.map