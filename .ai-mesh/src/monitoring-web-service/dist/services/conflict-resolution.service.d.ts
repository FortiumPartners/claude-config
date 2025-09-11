import * as winston from 'winston';
import { DatabaseConnection } from '../database/connection';
export interface ConflictData {
    entity_type: 'command_execution' | 'agent_interaction' | 'user_session' | 'productivity_metric';
    entity_id: string;
    organization_id: string;
    local_version: any;
    remote_version: any;
    local_timestamp: Date;
    remote_timestamp: Date;
    conflict_fields: string[];
}
export interface ConflictResolutionStrategy {
    name: 'remote_wins' | 'local_wins' | 'merge_intelligent' | 'merge_manual' | 'timestamp_based';
    description: string;
    automatic: boolean;
    priority: number;
}
export interface ConflictResolutionResult {
    strategy_used: ConflictResolutionStrategy['name'];
    resolved_data: any;
    conflict_id: string;
    resolution_reason: string;
    manual_review_required: boolean;
    field_resolutions: {
        field: string;
        local_value: any;
        remote_value: any;
        chosen_value: any;
        reason: string;
    }[];
}
export interface ConflictMetrics {
    total_conflicts: number;
    resolved_automatically: number;
    requiring_manual_review: number;
    by_strategy: Record<string, number>;
    by_entity_type: Record<string, number>;
    average_resolution_time_ms: number;
    success_rate: number;
}
export interface ConflictRule {
    entity_type: string;
    field_name: string;
    strategy: ConflictResolutionStrategy['name'];
    priority: number;
    conditions?: {
        field_pattern?: string;
        value_type?: 'string' | 'number' | 'boolean' | 'object' | 'array';
        local_precedence?: boolean;
        remote_precedence?: boolean;
    };
}
export declare class ConflictResolutionService {
    private logger;
    private metricsModel;
    private readonly strategies;
    private readonly defaultRules;
    private conflictHistory;
    private conflictMetrics;
    constructor(db: DatabaseConnection, logger: winston.Logger);
    resolveConflict(conflict: ConflictData): Promise<ConflictResolutionResult>;
    detectConflicts(entityType: ConflictData['entity_type'], localData: any, remoteData: any): ConflictData | null;
    getConflictMetrics(): ConflictMetrics;
    getConflictHistory(limit?: number): ConflictResolutionResult[];
    addResolutionRule(rule: ConflictRule): void;
    private selectResolutionStrategy;
    private applyResolutionStrategy;
    private resolveRemoteWins;
    private resolveLocalWins;
    private resolveTimestampBased;
    private resolveMergeIntelligent;
    private resolveMergeManual;
    private compareObjects;
    private getNestedValue;
    private setNestedValue;
    private matchesPattern;
    private generateConflictId;
    private trackConflictResolution;
    private createDefaultResolution;
}
//# sourceMappingURL=conflict-resolution.service.d.ts.map