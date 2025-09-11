import { ParseResult } from './data-parser';
export interface TransformedSession {
    id: string;
    userId: string;
    sessionStart: Date;
    sessionEnd?: Date;
    totalDurationMs?: bigint;
    toolsUsed?: any;
    productivityScore?: number;
    sessionType: string;
    projectId?: string;
    tags: any;
    interruptionsCount: number;
    focusTimeMs: bigint;
    description?: string;
}
export interface TransformedToolMetric {
    id: string;
    sessionId: string;
    toolName: string;
    toolCategory?: string;
    executionCount: number;
    totalDurationMs: bigint;
    averageDurationMs: bigint;
    successRate: number;
    errorCount: number;
    memoryUsageMb?: number;
    cpuTimeMs?: bigint;
    parameters?: any;
    outputSizeBytes?: bigint;
    commandLine?: string;
    workingDirectory?: string;
}
export interface UserMapping {
    localUser: string;
    cloudUserId: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
}
export interface TransformationResult {
    sessions: TransformedSession[];
    toolMetrics: TransformedToolMetric[];
    userMappings: UserMapping[];
    errors: TransformationError[];
    statistics: {
        originalSessions: number;
        transformedSessions: number;
        originalToolMetrics: number;
        transformedToolMetrics: number;
        duplicatesRemoved: number;
        invalidRecordsSkipped: number;
        usersIdentified: number;
    };
}
export interface TransformationError {
    type: 'session' | 'toolMetric' | 'user';
    recordId: string;
    error: string;
    originalData?: any;
}
export interface TransformationOptions {
    tenantId: string;
    defaultUserId?: string;
    userMappingStrategy: 'create' | 'map' | 'default';
    deduplicationStrategy: 'strict' | 'loose' | 'none';
    timeZone: string;
    validateConstraints: boolean;
    maxSessionDurationHours: number;
    minSessionDurationMs: number;
}
export declare class DataTransformer {
    private readonly options;
    private readonly userCache;
    private readonly sessionCache;
    constructor(options: TransformationOptions);
    transform(parseResult: ParseResult): Promise<TransformationResult>;
    private processUsers;
    private transformSessions;
    private transformToolMetrics;
    private deduplicateData;
    private validateTransformedData;
    private validateSession;
    private validateToolMetric;
    private createCloudUser;
    private mapExistingUser;
    private inferEmailFromUser;
    private inferFirstName;
    private inferLastName;
    private normalizeProductivityScore;
    private sanitizeProjectId;
    private sanitizeDescription;
    private sanitizeToolName;
    private sanitizeCommandLine;
    private sanitizeWorkingDirectory;
    private generateId;
    private deduplicateSessionsByTimeWindow;
}
export declare function createDefaultTransformer(tenantId: string, options?: Partial<TransformationOptions>): DataTransformer;
//# sourceMappingURL=data-transformer.d.ts.map