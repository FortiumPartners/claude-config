"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConflictResolutionService = void 0;
const metrics_model_1 = require("../models/metrics.model");
class ConflictResolutionService {
    logger;
    metricsModel;
    strategies = [
        {
            name: 'remote_wins',
            description: 'Always use remote version (default for external metrics service)',
            automatic: true,
            priority: 1
        },
        {
            name: 'local_wins',
            description: 'Always use local version',
            automatic: true,
            priority: 2
        },
        {
            name: 'timestamp_based',
            description: 'Use version with latest timestamp',
            automatic: true,
            priority: 3
        },
        {
            name: 'merge_intelligent',
            description: 'Automatically merge non-conflicting fields',
            automatic: true,
            priority: 4
        },
        {
            name: 'merge_manual',
            description: 'Requires manual review and resolution',
            automatic: false,
            priority: 5
        }
    ];
    defaultRules = [
        {
            entity_type: 'user_session',
            field_name: '*',
            strategy: 'remote_wins',
            priority: 1
        },
        {
            entity_type: 'command_execution',
            field_name: '*',
            strategy: 'timestamp_based',
            priority: 1
        },
        {
            entity_type: 'agent_interaction',
            field_name: '*',
            strategy: 'remote_wins',
            priority: 1
        },
        {
            entity_type: 'productivity_metric',
            field_name: '*',
            strategy: 'merge_intelligent',
            priority: 1
        },
        {
            entity_type: '*',
            field_name: 'id',
            strategy: 'remote_wins',
            priority: 0
        },
        {
            entity_type: '*',
            field_name: 'organization_id',
            strategy: 'remote_wins',
            priority: 0
        },
        {
            entity_type: '*',
            field_name: 'created_at',
            strategy: 'timestamp_based',
            priority: 0,
            conditions: { local_precedence: true }
        }
    ];
    conflictHistory = new Map();
    conflictMetrics = {
        total_conflicts: 0,
        resolved_automatically: 0,
        requiring_manual_review: 0,
        by_strategy: {},
        by_entity_type: {},
        average_resolution_time_ms: 0,
        success_rate: 0
    };
    constructor(db, logger) {
        this.metricsModel = new metrics_model_1.MetricsModel(db);
        this.logger = logger;
        this.strategies.forEach(strategy => {
            this.conflictMetrics.by_strategy[strategy.name] = 0;
        });
    }
    async resolveConflict(conflict) {
        const startTime = performance.now();
        const conflictId = this.generateConflictId(conflict);
        try {
            this.logger.info('Resolving data conflict', {
                conflict_id: conflictId,
                entity_type: conflict.entity_type,
                entity_id: conflict.entity_id,
                conflict_fields: conflict.conflict_fields
            });
            const strategy = this.selectResolutionStrategy(conflict);
            const result = await this.applyResolutionStrategy(strategy, conflict, conflictId);
            const resolutionTime = performance.now() - startTime;
            this.trackConflictResolution(result, resolutionTime);
            this.conflictHistory.set(conflictId, result);
            this.logger.info('Conflict resolved', {
                conflict_id: conflictId,
                strategy_used: result.strategy_used,
                manual_review_required: result.manual_review_required,
                resolution_time_ms: resolutionTime
            });
            return result;
        }
        catch (error) {
            const resolutionTime = performance.now() - startTime;
            this.logger.error('Failed to resolve conflict', {
                conflict_id: conflictId,
                error: error instanceof Error ? error.message : 'Unknown error',
                resolution_time_ms: resolutionTime
            });
            return this.createDefaultResolution(conflict, conflictId, error);
        }
    }
    detectConflicts(entityType, localData, remoteData) {
        if (!localData || !remoteData) {
            return null;
        }
        const conflictFields = [];
        this.compareObjects(localData, remoteData, '', conflictFields);
        if (conflictFields.length === 0) {
            return null;
        }
        return {
            entity_type: entityType,
            entity_id: localData.id || remoteData.id || 'unknown',
            organization_id: localData.organization_id || remoteData.organization_id,
            local_version: localData,
            remote_version: remoteData,
            local_timestamp: new Date(localData.updated_at || localData.created_at || Date.now()),
            remote_timestamp: new Date(remoteData.updated_at || remoteData.created_at || Date.now()),
            conflict_fields: conflictFields
        };
    }
    getConflictMetrics() {
        return { ...this.conflictMetrics };
    }
    getConflictHistory(limit = 100) {
        return Array.from(this.conflictHistory.values())
            .sort((a, b) => b.conflict_id.localeCompare(a.conflict_id))
            .slice(0, limit);
    }
    addResolutionRule(rule) {
        this.defaultRules.push(rule);
        this.defaultRules.sort((a, b) => a.priority - b.priority);
        this.logger.info('Added custom resolution rule', {
            entity_type: rule.entity_type,
            field_name: rule.field_name,
            strategy: rule.strategy,
            priority: rule.priority
        });
    }
    selectResolutionStrategy(conflict) {
        const applicableRules = this.defaultRules.filter(rule => {
            const entityMatches = rule.entity_type === '*' || rule.entity_type === conflict.entity_type;
            const fieldMatches = rule.field_name === '*' || conflict.conflict_fields.some(field => field === rule.field_name || (rule.field_name.includes('*') && this.matchesPattern(field, rule.field_name)));
            return entityMatches && fieldMatches;
        });
        const selectedRule = applicableRules.sort((a, b) => a.priority - b.priority)[0];
        if (selectedRule) {
            const strategy = this.strategies.find(s => s.name === selectedRule.strategy);
            if (strategy) {
                return strategy;
            }
        }
        return this.strategies.find(s => s.name === 'remote_wins');
    }
    async applyResolutionStrategy(strategy, conflict, conflictId) {
        const fieldResolutions = [];
        switch (strategy.name) {
            case 'remote_wins':
                return this.resolveRemoteWins(conflict, conflictId, fieldResolutions);
            case 'local_wins':
                return this.resolveLocalWins(conflict, conflictId, fieldResolutions);
            case 'timestamp_based':
                return this.resolveTimestampBased(conflict, conflictId, fieldResolutions);
            case 'merge_intelligent':
                return this.resolveMergeIntelligent(conflict, conflictId, fieldResolutions);
            case 'merge_manual':
                return this.resolveMergeManual(conflict, conflictId, fieldResolutions);
            default:
                throw new Error(`Unknown resolution strategy: ${strategy.name}`);
        }
    }
    resolveRemoteWins(conflict, conflictId, fieldResolutions) {
        for (const field of conflict.conflict_fields) {
            const localValue = this.getNestedValue(conflict.local_version, field);
            const remoteValue = this.getNestedValue(conflict.remote_version, field);
            fieldResolutions.push({
                field,
                local_value: localValue,
                remote_value: remoteValue,
                chosen_value: remoteValue,
                reason: 'Remote wins strategy - using remote value'
            });
        }
        return {
            strategy_used: 'remote_wins',
            resolved_data: { ...conflict.remote_version },
            conflict_id: conflictId,
            resolution_reason: 'Applied remote wins strategy - remote data takes precedence',
            manual_review_required: false,
            field_resolutions: fieldResolutions
        };
    }
    resolveLocalWins(conflict, conflictId, fieldResolutions) {
        for (const field of conflict.conflict_fields) {
            const localValue = this.getNestedValue(conflict.local_version, field);
            const remoteValue = this.getNestedValue(conflict.remote_version, field);
            fieldResolutions.push({
                field,
                local_value: localValue,
                remote_value: remoteValue,
                chosen_value: localValue,
                reason: 'Local wins strategy - using local value'
            });
        }
        return {
            strategy_used: 'local_wins',
            resolved_data: { ...conflict.local_version },
            conflict_id: conflictId,
            resolution_reason: 'Applied local wins strategy - local data takes precedence',
            manual_review_required: false,
            field_resolutions: fieldResolutions
        };
    }
    resolveTimestampBased(conflict, conflictId, fieldResolutions) {
        const localIsNewer = conflict.local_timestamp > conflict.remote_timestamp;
        const newerVersion = localIsNewer ? conflict.local_version : conflict.remote_version;
        const reasonPrefix = localIsNewer ? 'Local version is newer' : 'Remote version is newer';
        for (const field of conflict.conflict_fields) {
            const localValue = this.getNestedValue(conflict.local_version, field);
            const remoteValue = this.getNestedValue(conflict.remote_version, field);
            const chosenValue = this.getNestedValue(newerVersion, field);
            fieldResolutions.push({
                field,
                local_value: localValue,
                remote_value: remoteValue,
                chosen_value: chosenValue,
                reason: `${reasonPrefix} - using ${localIsNewer ? 'local' : 'remote'} value`
            });
        }
        return {
            strategy_used: 'timestamp_based',
            resolved_data: { ...newerVersion },
            conflict_id: conflictId,
            resolution_reason: `${reasonPrefix} (${localIsNewer ? conflict.local_timestamp : conflict.remote_timestamp})`,
            manual_review_required: false,
            field_resolutions: fieldResolutions
        };
    }
    resolveMergeIntelligent(conflict, conflictId, fieldResolutions) {
        const merged = { ...conflict.local_version };
        let manualReviewRequired = false;
        for (const field of conflict.conflict_fields) {
            const localValue = this.getNestedValue(conflict.local_version, field);
            const remoteValue = this.getNestedValue(conflict.remote_version, field);
            let chosenValue;
            let reason;
            if (field.includes('_count') || field.includes('_total')) {
                chosenValue = Math.max(Number(localValue) || 0, Number(remoteValue) || 0);
                reason = 'Used higher count value';
            }
            else if (field.includes('_time') || field.includes('timestamp')) {
                const localTime = new Date(localValue).getTime() || 0;
                const remoteTime = new Date(remoteValue).getTime() || 0;
                chosenValue = localTime > remoteTime ? localValue : remoteValue;
                reason = 'Used more recent timestamp';
            }
            else if (Array.isArray(localValue) && Array.isArray(remoteValue)) {
                chosenValue = [...new Set([...localValue, ...remoteValue])];
                reason = 'Merged arrays with unique values';
            }
            else if (typeof localValue === 'object' && typeof remoteValue === 'object') {
                chosenValue = { ...localValue, ...remoteValue };
                reason = 'Merged objects';
            }
            else {
                chosenValue = remoteValue;
                reason = 'Complex conflict - defaulted to remote, manual review recommended';
                manualReviewRequired = true;
            }
            this.setNestedValue(merged, field, chosenValue);
            fieldResolutions.push({
                field,
                local_value: localValue,
                remote_value: remoteValue,
                chosen_value: chosenValue,
                reason
            });
        }
        return {
            strategy_used: 'merge_intelligent',
            resolved_data: merged,
            conflict_id: conflictId,
            resolution_reason: 'Applied intelligent merge with field-specific rules',
            manual_review_required: manualReviewRequired,
            field_resolutions: fieldResolutions
        };
    }
    resolveMergeManual(conflict, conflictId, fieldResolutions) {
        for (const field of conflict.conflict_fields) {
            const localValue = this.getNestedValue(conflict.local_version, field);
            const remoteValue = this.getNestedValue(conflict.remote_version, field);
            fieldResolutions.push({
                field,
                local_value: localValue,
                remote_value: remoteValue,
                chosen_value: remoteValue,
                reason: 'Manual review required - temporarily using remote value'
            });
        }
        return {
            strategy_used: 'merge_manual',
            resolved_data: { ...conflict.remote_version },
            conflict_id: conflictId,
            resolution_reason: 'Complex conflict requiring manual review - using remote data temporarily',
            manual_review_required: true,
            field_resolutions: fieldResolutions
        };
    }
    compareObjects(obj1, obj2, path, conflicts) {
        const keys1 = Object.keys(obj1 || {});
        const keys2 = Object.keys(obj2 || {});
        const allKeys = [...new Set([...keys1, ...keys2])];
        for (const key of allKeys) {
            const currentPath = path ? `${path}.${key}` : key;
            const val1 = obj1?.[key];
            const val2 = obj2?.[key];
            if (val1 === undefined && val2 !== undefined) {
                conflicts.push(currentPath);
            }
            else if (val1 !== undefined && val2 === undefined) {
                conflicts.push(currentPath);
            }
            else if (typeof val1 === 'object' && typeof val2 === 'object') {
                if (val1 === null || val2 === null) {
                    if (val1 !== val2) {
                        conflicts.push(currentPath);
                    }
                }
                else {
                    this.compareObjects(val1, val2, currentPath, conflicts);
                }
            }
            else if (val1 !== val2) {
                conflicts.push(currentPath);
            }
        }
    }
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }
    setNestedValue(obj, path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((current, key) => {
            if (!current[key])
                current[key] = {};
            return current[key];
        }, obj);
        target[lastKey] = value;
    }
    matchesPattern(value, pattern) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return regex.test(value);
    }
    generateConflictId(conflict) {
        const timestamp = Date.now();
        const hash = Math.random().toString(36).substr(2, 9);
        return `conflict-${conflict.entity_type}-${timestamp}-${hash}`;
    }
    trackConflictResolution(result, timeMs) {
        this.conflictMetrics.total_conflicts++;
        if (!result.manual_review_required) {
            this.conflictMetrics.resolved_automatically++;
        }
        else {
            this.conflictMetrics.requiring_manual_review++;
        }
        this.conflictMetrics.by_strategy[result.strategy_used] =
            (this.conflictMetrics.by_strategy[result.strategy_used] || 0) + 1;
        const totalTime = this.conflictMetrics.average_resolution_time_ms * (this.conflictMetrics.total_conflicts - 1);
        this.conflictMetrics.average_resolution_time_ms = (totalTime + timeMs) / this.conflictMetrics.total_conflicts;
        this.conflictMetrics.success_rate =
            this.conflictMetrics.resolved_automatically / this.conflictMetrics.total_conflicts;
    }
    createDefaultResolution(conflict, conflictId, error) {
        return {
            strategy_used: 'remote_wins',
            resolved_data: { ...conflict.remote_version },
            conflict_id: conflictId,
            resolution_reason: `Error occurred during resolution, defaulted to remote wins: ${error instanceof Error ? error.message : 'Unknown error'}`,
            manual_review_required: true,
            field_resolutions: []
        };
    }
}
exports.ConflictResolutionService = ConflictResolutionService;
//# sourceMappingURL=conflict-resolution.service.js.map