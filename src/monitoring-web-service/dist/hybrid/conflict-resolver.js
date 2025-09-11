"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConflictResolver = void 0;
class ConflictResolver {
    strategy;
    customResolver;
    constructor(strategy = 'remote_wins', customResolver) {
        this.strategy = strategy;
        this.customResolver = customResolver;
    }
    async resolveSessionConflict(localSession, remoteSession) {
        const context = {
            conflictId: this.generateConflictId(),
            entityType: 'session',
            entityId: localSession.id,
            localVersion: localSession,
            remoteVersion: remoteSession,
            conflictFields: this.identifyConflictingFields(localSession, remoteSession),
            resolutionStrategy: this.strategy
        };
        const resolution = await this.resolveConflict(context);
        if (resolution.resolved) {
            console.log(`🔀 Session conflict resolved (${context.conflictId}): ${resolution.resolutionReason}`);
            return resolution.resolvedEntity;
        }
        else {
            console.warn(`⚠️  Session conflict unresolved (${context.conflictId}): ${resolution.resolutionReason}`);
            return null;
        }
    }
    async resolveToolMetricConflict(localMetric, remoteMetric) {
        const context = {
            conflictId: this.generateConflictId(),
            entityType: 'toolMetric',
            entityId: localMetric.id,
            localVersion: localMetric,
            remoteVersion: remoteMetric,
            conflictFields: this.identifyConflictingFields(localMetric, remoteMetric),
            resolutionStrategy: this.strategy
        };
        const resolution = await this.resolveConflict(context);
        if (resolution.resolved) {
            console.log(`🔀 Tool metric conflict resolved (${context.conflictId}): ${resolution.resolutionReason}`);
            return resolution.resolvedEntity;
        }
        else {
            console.warn(`⚠️  Tool metric conflict unresolved (${context.conflictId}): ${resolution.resolutionReason}`);
            return null;
        }
    }
    async resolveConflict(context) {
        if (this.strategy === 'custom' && this.customResolver) {
            return this.customResolver(context);
        }
        switch (this.strategy) {
            case 'local_wins':
                return this.resolveLocalWins(context);
            case 'remote_wins':
                return this.resolveRemoteWins(context);
            case 'latest_wins':
                return this.resolveLatestWins(context);
            case 'merge_fields':
                return this.resolveMergeFields(context);
            case 'user_prompt':
                return this.resolveUserPrompt(context);
            default:
                return {
                    resolved: false,
                    resolvedEntity: null,
                    strategy: this.strategy,
                    mergedFields: [],
                    discardedFields: context.conflictFields,
                    resolutionReason: `Unknown resolution strategy: ${this.strategy}`,
                    requiresUserReview: true
                };
        }
    }
    resolveLocalWins(context) {
        return {
            resolved: true,
            resolvedEntity: context.localVersion,
            strategy: 'local_wins',
            mergedFields: Object.keys(context.localVersion),
            discardedFields: context.conflictFields,
            resolutionReason: 'Local version selected as per strategy',
            requiresUserReview: false
        };
    }
    resolveRemoteWins(context) {
        return {
            resolved: true,
            resolvedEntity: context.remoteVersion,
            strategy: 'remote_wins',
            mergedFields: Object.keys(context.remoteVersion),
            discardedFields: context.conflictFields,
            resolutionReason: 'Remote version selected as per strategy',
            requiresUserReview: false
        };
    }
    resolveLatestWins(context) {
        const localTimestamp = this.getEntityTimestamp(context.localVersion);
        const remoteTimestamp = this.getEntityTimestamp(context.remoteVersion);
        if (localTimestamp && remoteTimestamp) {
            const localIsLatest = localTimestamp > remoteTimestamp;
            return {
                resolved: true,
                resolvedEntity: localIsLatest ? context.localVersion : context.remoteVersion,
                strategy: 'latest_wins',
                mergedFields: localIsLatest ? Object.keys(context.localVersion) : Object.keys(context.remoteVersion),
                discardedFields: context.conflictFields,
                resolutionReason: `${localIsLatest ? 'Local' : 'Remote'} version is more recent (${localIsLatest ? localTimestamp : remoteTimestamp})`,
                requiresUserReview: false
            };
        }
        else {
            return this.resolveRemoteWins(context);
        }
    }
    resolveMergeFields(context) {
        const mergedEntity = { ...context.remoteVersion };
        const mergedFields = [];
        const discardedFields = [];
        if (context.entityType === 'session') {
            const merged = this.mergeSessionFields(context.localVersion, context.remoteVersion);
            Object.assign(mergedEntity, merged.entity);
            mergedFields.push(...merged.mergedFields);
            discardedFields.push(...merged.discardedFields);
        }
        else if (context.entityType === 'toolMetric') {
            const merged = this.mergeToolMetricFields(context.localVersion, context.remoteVersion);
            Object.assign(mergedEntity, merged.entity);
            mergedFields.push(...merged.mergedFields);
            discardedFields.push(...merged.discardedFields);
        }
        return {
            resolved: true,
            resolvedEntity: mergedEntity,
            strategy: 'merge_fields',
            mergedFields,
            discardedFields,
            resolutionReason: `Intelligent field merge: ${mergedFields.length} merged, ${discardedFields.length} discarded`,
            requiresUserReview: discardedFields.length > 0
        };
    }
    resolveUserPrompt(context) {
        return {
            resolved: false,
            resolvedEntity: null,
            strategy: 'user_prompt',
            mergedFields: [],
            discardedFields: context.conflictFields,
            resolutionReason: 'User intervention required (not implemented)',
            requiresUserReview: true
        };
    }
    mergeSessionFields(local, remote) {
        const merged = { ...remote };
        const mergedFields = [];
        const discardedFields = [];
        if (local.sessionEnd && (!remote.sessionEnd || local.sessionEnd > remote.sessionEnd)) {
            merged.sessionEnd = local.sessionEnd;
            merged.totalDurationMs = local.totalDurationMs;
            mergedFields.push('sessionEnd', 'totalDurationMs');
        }
        if (local.toolsUsed && remote.toolsUsed) {
            const combinedTools = [...new Set([...local.toolsUsed, ...remote.toolsUsed])];
            if (combinedTools.length > remote.toolsUsed.length) {
                merged.toolsUsed = combinedTools;
                mergedFields.push('toolsUsed');
            }
        }
        else if (local.toolsUsed && !remote.toolsUsed) {
            merged.toolsUsed = local.toolsUsed;
            mergedFields.push('toolsUsed');
        }
        if (local.productivityScore && remote.productivityScore) {
            if (local.productivityScore > remote.productivityScore) {
                merged.productivityScore = local.productivityScore;
                mergedFields.push('productivityScore');
            }
        }
        else if (local.productivityScore && !remote.productivityScore) {
            merged.productivityScore = local.productivityScore;
            mergedFields.push('productivityScore');
        }
        if (local.tags && remote.tags) {
            const combinedTags = [...new Set([...local.tags, ...remote.tags])];
            if (combinedTags.length > remote.tags.length) {
                merged.tags = combinedTags;
                mergedFields.push('tags');
            }
        }
        else if (local.tags && !remote.tags) {
            merged.tags = local.tags;
            mergedFields.push('tags');
        }
        if (local.interruptionsCount > remote.interruptionsCount) {
            merged.interruptionsCount = local.interruptionsCount;
            mergedFields.push('interruptionsCount');
        }
        if (local.focusTimeMs > remote.focusTimeMs) {
            merged.focusTimeMs = local.focusTimeMs;
            mergedFields.push('focusTimeMs');
        }
        if (local.metadata && remote.metadata) {
            merged.metadata = {
                ...remote.metadata,
                ...local.metadata,
            };
            mergedFields.push('metadata');
        }
        else if (local.metadata && !remote.metadata) {
            merged.metadata = local.metadata;
            mergedFields.push('metadata');
        }
        return { entity: merged, mergedFields, discardedFields };
    }
    mergeToolMetricFields(local, remote) {
        const merged = { ...remote };
        const mergedFields = [];
        const discardedFields = [];
        if (local.executionCount && remote.executionCount) {
            merged.executionCount = local.executionCount + remote.executionCount;
            mergedFields.push('executionCount');
        }
        if (local.totalDurationMs && remote.totalDurationMs) {
            merged.totalDurationMs = local.totalDurationMs + remote.totalDurationMs;
            merged.averageDurationMs = merged.totalDurationMs / merged.executionCount;
            mergedFields.push('totalDurationMs', 'averageDurationMs');
        }
        if (local.successRate !== undefined && remote.successRate !== undefined &&
            local.executionCount && remote.executionCount) {
            const totalExecutions = local.executionCount + remote.executionCount;
            const weightedSuccessRate = ((local.successRate * local.executionCount) +
                (remote.successRate * remote.executionCount)) / totalExecutions;
            merged.successRate = Math.round(weightedSuccessRate * 10000) / 10000;
            mergedFields.push('successRate');
        }
        if (local.errorCount && remote.errorCount) {
            merged.errorCount = local.errorCount + remote.errorCount;
            mergedFields.push('errorCount');
        }
        if (local.memoryUsageMb && remote.memoryUsageMb) {
            merged.memoryUsageMb = Math.round((local.memoryUsageMb + remote.memoryUsageMb) / 2);
            mergedFields.push('memoryUsageMb');
        }
        else if (local.memoryUsageMb && !remote.memoryUsageMb) {
            merged.memoryUsageMb = local.memoryUsageMb;
            mergedFields.push('memoryUsageMb');
        }
        if (local.cpuTimeMs && remote.cpuTimeMs) {
            merged.cpuTimeMs = local.cpuTimeMs + remote.cpuTimeMs;
            mergedFields.push('cpuTimeMs');
        }
        else if (local.cpuTimeMs && !remote.cpuTimeMs) {
            merged.cpuTimeMs = local.cpuTimeMs;
            mergedFields.push('cpuTimeMs');
        }
        if (local.outputSizeBytes && remote.outputSizeBytes) {
            merged.outputSizeBytes = local.outputSizeBytes + remote.outputSizeBytes;
            mergedFields.push('outputSizeBytes');
        }
        else if (local.outputSizeBytes && !remote.outputSizeBytes) {
            merged.outputSizeBytes = local.outputSizeBytes;
            mergedFields.push('outputSizeBytes');
        }
        if (local.parameters && (!remote.parameters || JSON.stringify(local.parameters) !== JSON.stringify(remote.parameters))) {
            merged.parameters = local.parameters;
            mergedFields.push('parameters');
        }
        return { entity: merged, mergedFields, discardedFields };
    }
    identifyConflictingFields(local, remote) {
        const conflictingFields = [];
        const allFields = new Set([...Object.keys(local), ...Object.keys(remote)]);
        for (const field of allFields) {
            if (local[field] !== remote[field]) {
                if (typeof local[field] === 'object' && typeof remote[field] === 'object') {
                    if (JSON.stringify(local[field]) !== JSON.stringify(remote[field])) {
                        conflictingFields.push(field);
                    }
                }
                else {
                    conflictingFields.push(field);
                }
            }
        }
        return conflictingFields;
    }
    getEntityTimestamp(entity) {
        const timestampFields = ['updatedAt', 'lastModified', 'modifiedAt', 'createdAt', 'sessionEnd'];
        for (const field of timestampFields) {
            if (entity[field]) {
                const timestamp = entity[field] instanceof Date ? entity[field] : new Date(entity[field]);
                if (!isNaN(timestamp.getTime())) {
                    return timestamp;
                }
            }
        }
        return null;
    }
    generateConflictId() {
        return `conflict-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    setCustomResolver(resolver) {
        this.customResolver = resolver;
    }
    getConflictStats() {
        return {
            strategy: this.strategy,
            totalConflicts: 0
        };
    }
}
exports.ConflictResolver = ConflictResolver;
//# sourceMappingURL=conflict-resolver.js.map