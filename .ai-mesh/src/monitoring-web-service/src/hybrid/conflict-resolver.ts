/**
 * Conflict Resolver for Hybrid Data Synchronization
 * Handles data conflicts between local and remote versions with configurable strategies
 * 
 * Sprint 6 - Task 6.4: Hybrid Mode Implementation
 * Ensures data integrity during synchronization conflicts
 */

export type ConflictResolutionStrategy = 
  | 'local_wins'      // Local version takes precedence
  | 'remote_wins'     // Remote version takes precedence (default for cloud-first)
  | 'latest_wins'     // Most recent modification wins
  | 'merge_fields'    // Intelligent field-level merging
  | 'user_prompt'     // Require user intervention (not implemented in this version)
  | 'custom';         // Custom resolution logic

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

/**
 * Resolves data conflicts during hybrid synchronization
 */
export class ConflictResolver {
  private readonly strategy: ConflictResolutionStrategy;
  private customResolver?: (context: ConflictContext) => ConflictResolution;

  constructor(
    strategy: ConflictResolutionStrategy = 'remote_wins',
    customResolver?: (context: ConflictContext) => ConflictResolution
  ) {
    this.strategy = strategy;
    this.customResolver = customResolver;
  }

  /**
   * Resolve session conflict between local and remote versions
   */
  async resolveSessionConflict(localSession: any, remoteSession: any): Promise<any | null> {
    const context: ConflictContext = {
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
    } else {
      console.warn(`⚠️  Session conflict unresolved (${context.conflictId}): ${resolution.resolutionReason}`);
      return null;
    }
  }

  /**
   * Resolve tool metric conflict between local and remote versions
   */
  async resolveToolMetricConflict(localMetric: any, remoteMetric: any): Promise<any | null> {
    const context: ConflictContext = {
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
    } else {
      console.warn(`⚠️  Tool metric conflict unresolved (${context.conflictId}): ${resolution.resolutionReason}`);
      return null;
    }
  }

  /**
   * Main conflict resolution logic
   */
  private async resolveConflict(context: ConflictContext): Promise<ConflictResolution> {
    // Use custom resolver if provided and strategy is 'custom'
    if (this.strategy === 'custom' && this.customResolver) {
      return this.customResolver(context);
    }

    // Apply built-in resolution strategies
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

  /**
   * Local version wins resolution strategy
   */
  private resolveLocalWins(context: ConflictContext): ConflictResolution {
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

  /**
   * Remote version wins resolution strategy
   */
  private resolveRemoteWins(context: ConflictContext): ConflictResolution {
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

  /**
   * Latest timestamp wins resolution strategy
   */
  private resolveLatestWins(context: ConflictContext): ConflictResolution {
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
    } else {
      // Fallback to remote wins if timestamps are unavailable
      return this.resolveRemoteWins(context);
    }
  }

  /**
   * Intelligent field-level merging strategy
   */
  private resolveMergeFields(context: ConflictContext): ConflictResolution {
    const mergedEntity = { ...context.remoteVersion }; // Start with remote as base
    const mergedFields: string[] = [];
    const discardedFields: string[] = [];

    // Apply entity-specific merge logic
    if (context.entityType === 'session') {
      const merged = this.mergeSessionFields(context.localVersion, context.remoteVersion);
      Object.assign(mergedEntity, merged.entity);
      mergedFields.push(...merged.mergedFields);
      discardedFields.push(...merged.discardedFields);
    } else if (context.entityType === 'toolMetric') {
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

  /**
   * User prompt strategy (placeholder for future implementation)
   */
  private resolveUserPrompt(context: ConflictContext): ConflictResolution {
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

  /**
   * Merge session fields intelligently
   */
  private mergeSessionFields(local: any, remote: any): { entity: any; mergedFields: string[]; discardedFields: string[] } {
    const merged = { ...remote };
    const mergedFields: string[] = [];
    const discardedFields: string[] = [];

    // Prefer local timestamps if more recent
    if (local.sessionEnd && (!remote.sessionEnd || local.sessionEnd > remote.sessionEnd)) {
      merged.sessionEnd = local.sessionEnd;
      merged.totalDurationMs = local.totalDurationMs;
      mergedFields.push('sessionEnd', 'totalDurationMs');
    }

    // Merge tool usage (union of both sets)
    if (local.toolsUsed && remote.toolsUsed) {
      const combinedTools = [...new Set([...local.toolsUsed, ...remote.toolsUsed])];
      if (combinedTools.length > remote.toolsUsed.length) {
        merged.toolsUsed = combinedTools;
        mergedFields.push('toolsUsed');
      }
    } else if (local.toolsUsed && !remote.toolsUsed) {
      merged.toolsUsed = local.toolsUsed;
      mergedFields.push('toolsUsed');
    }

    // Prefer higher productivity score (assuming it's more accurate)
    if (local.productivityScore && remote.productivityScore) {
      if (local.productivityScore > remote.productivityScore) {
        merged.productivityScore = local.productivityScore;
        mergedFields.push('productivityScore');
      }
    } else if (local.productivityScore && !remote.productivityScore) {
      merged.productivityScore = local.productivityScore;
      mergedFields.push('productivityScore');
    }

    // Merge tags (union)
    if (local.tags && remote.tags) {
      const combinedTags = [...new Set([...local.tags, ...remote.tags])];
      if (combinedTags.length > remote.tags.length) {
        merged.tags = combinedTags;
        mergedFields.push('tags');
      }
    } else if (local.tags && !remote.tags) {
      merged.tags = local.tags;
      mergedFields.push('tags');
    }

    // Take maximum interruptions count (more complete data)
    if (local.interruptionsCount > remote.interruptionsCount) {
      merged.interruptionsCount = local.interruptionsCount;
      mergedFields.push('interruptionsCount');
    }

    // Take maximum focus time (more complete data)
    if (local.focusTimeMs > remote.focusTimeMs) {
      merged.focusTimeMs = local.focusTimeMs;
      mergedFields.push('focusTimeMs');
    }

    // Merge metadata (prefer local for some fields, remote for others)
    if (local.metadata && remote.metadata) {
      merged.metadata = {
        ...remote.metadata,
        ...local.metadata, // Local metadata takes precedence
      };
      mergedFields.push('metadata');
    } else if (local.metadata && !remote.metadata) {
      merged.metadata = local.metadata;
      mergedFields.push('metadata');
    }

    return { entity: merged, mergedFields, discardedFields };
  }

  /**
   * Merge tool metric fields intelligently
   */
  private mergeToolMetricFields(local: any, remote: any): { entity: any; mergedFields: string[]; discardedFields: string[] } {
    const merged = { ...remote };
    const mergedFields: string[] = [];
    const discardedFields: string[] = [];

    // Aggregate execution counts
    if (local.executionCount && remote.executionCount) {
      merged.executionCount = local.executionCount + remote.executionCount;
      mergedFields.push('executionCount');
    }

    // Aggregate total duration
    if (local.totalDurationMs && remote.totalDurationMs) {
      merged.totalDurationMs = local.totalDurationMs + remote.totalDurationMs;
      merged.averageDurationMs = merged.totalDurationMs / merged.executionCount;
      mergedFields.push('totalDurationMs', 'averageDurationMs');
    }

    // Calculate weighted success rate
    if (local.successRate !== undefined && remote.successRate !== undefined &&
        local.executionCount && remote.executionCount) {
      const totalExecutions = local.executionCount + remote.executionCount;
      const weightedSuccessRate = (
        (local.successRate * local.executionCount) + 
        (remote.successRate * remote.executionCount)
      ) / totalExecutions;
      
      merged.successRate = Math.round(weightedSuccessRate * 10000) / 10000; // 4 decimal places
      mergedFields.push('successRate');
    }

    // Aggregate error counts
    if (local.errorCount && remote.errorCount) {
      merged.errorCount = local.errorCount + remote.errorCount;
      mergedFields.push('errorCount');
    }

    // Use average memory usage
    if (local.memoryUsageMb && remote.memoryUsageMb) {
      merged.memoryUsageMb = Math.round((local.memoryUsageMb + remote.memoryUsageMb) / 2);
      mergedFields.push('memoryUsageMb');
    } else if (local.memoryUsageMb && !remote.memoryUsageMb) {
      merged.memoryUsageMb = local.memoryUsageMb;
      mergedFields.push('memoryUsageMb');
    }

    // Aggregate CPU time
    if (local.cpuTimeMs && remote.cpuTimeMs) {
      merged.cpuTimeMs = local.cpuTimeMs + remote.cpuTimeMs;
      mergedFields.push('cpuTimeMs');
    } else if (local.cpuTimeMs && !remote.cpuTimeMs) {
      merged.cpuTimeMs = local.cpuTimeMs;
      mergedFields.push('cpuTimeMs');
    }

    // Aggregate output size
    if (local.outputSizeBytes && remote.outputSizeBytes) {
      merged.outputSizeBytes = local.outputSizeBytes + remote.outputSizeBytes;
      mergedFields.push('outputSizeBytes');
    } else if (local.outputSizeBytes && !remote.outputSizeBytes) {
      merged.outputSizeBytes = local.outputSizeBytes;
      mergedFields.push('outputSizeBytes');
    }

    // Prefer local parameters and metadata (more likely to be accurate)
    if (local.parameters && (!remote.parameters || JSON.stringify(local.parameters) !== JSON.stringify(remote.parameters))) {
      merged.parameters = local.parameters;
      mergedFields.push('parameters');
    }

    return { entity: merged, mergedFields, discardedFields };
  }

  /**
   * Identify fields that differ between local and remote versions
   */
  private identifyConflictingFields(local: any, remote: any): string[] {
    const conflictingFields: string[] = [];
    const allFields = new Set([...Object.keys(local), ...Object.keys(remote)]);

    for (const field of allFields) {
      if (local[field] !== remote[field]) {
        // Special handling for complex objects
        if (typeof local[field] === 'object' && typeof remote[field] === 'object') {
          if (JSON.stringify(local[field]) !== JSON.stringify(remote[field])) {
            conflictingFields.push(field);
          }
        } else {
          conflictingFields.push(field);
        }
      }
    }

    return conflictingFields;
  }

  /**
   * Extract timestamp from entity for latest_wins strategy
   */
  private getEntityTimestamp(entity: any): Date | null {
    // Try different timestamp fields
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

  /**
   * Generate unique conflict ID for tracking
   */
  private generateConflictId(): string {
    return `conflict-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Set custom resolver function for 'custom' strategy
   */
  setCustomResolver(resolver: (context: ConflictContext) => ConflictResolution): void {
    this.customResolver = resolver;
  }

  /**
   * Get conflict statistics
   */
  getConflictStats(): { strategy: ConflictResolutionStrategy; totalConflicts: number } {
    return {
      strategy: this.strategy,
      totalConflicts: 0 // Would track actual conflicts in production
    };
  }
}