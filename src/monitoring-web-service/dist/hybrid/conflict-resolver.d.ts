export type ConflictResolutionStrategy = 'local_wins' | 'remote_wins' | 'latest_wins' | 'merge_fields' | 'user_prompt' | 'custom';
export interface ConflictContext {
    conflictId: string;
    entityType: 'session' | 'toolMetric';
    entityId: string;
    localVersion: any;
    remoteVersion: any;
    conflictFields: string[];
    lastSyncTime?: Date;
    resolutionStrategy: ConflictResolutionStrategy;
}
export interface ConflictResolution {
    resolved: boolean;
    resolvedEntity: any;
    strategy: ConflictResolutionStrategy;
    mergedFields: string[];
    discardedFields: string[];
    resolutionReason: string;
    requiresUserReview: boolean;
}
export declare class ConflictResolver {
    private readonly strategy;
    private customResolver?;
    constructor(strategy?: ConflictResolutionStrategy, customResolver?: (context: ConflictContext) => ConflictResolution);
    resolveSessionConflict(localSession: any, remoteSession: any): Promise<any | null>;
    resolveToolMetricConflict(localMetric: any, remoteMetric: any): Promise<any | null>;
    private resolveConflict;
    private resolveLocalWins;
    private resolveRemoteWins;
    private resolveLatestWins;
    private resolveMergeFields;
    private resolveUserPrompt;
    private mergeSessionFields;
    private mergeToolMetricFields;
    private identifyConflictingFields;
    private getEntityTimestamp;
    private generateConflictId;
    setCustomResolver(resolver: (context: ConflictContext) => ConflictResolution): void;
    getConflictStats(): {
        strategy: ConflictResolutionStrategy;
        totalConflicts: number;
    };
}
//# sourceMappingURL=conflict-resolver.d.ts.map