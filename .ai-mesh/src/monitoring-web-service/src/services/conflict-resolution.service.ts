/**
 * Conflict Resolution Service
 * Task 3.4: Data conflict handling with remote wins strategy
 * 
 * Provides intelligent conflict resolution for data synchronization
 * with configurable strategies and detailed conflict tracking.
 */

import * as winston from 'winston';
import { MetricsModel } from '../models/metrics.model';
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

export class ConflictResolutionService {
  private logger: winston.Logger;
  private metricsModel: MetricsModel;
  
  // Available resolution strategies
  private readonly strategies: ConflictResolutionStrategy[] = [
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
  
  // Default resolution rules
  private readonly defaultRules: ConflictRule[] = [
    // Session data - remote wins for consistency
    {
      entity_type: 'user_session',
      field_name: '*',
      strategy: 'remote_wins',
      priority: 1
    },
    // Command executions - timestamp based for accuracy
    {
      entity_type: 'command_execution',
      field_name: '*',
      strategy: 'timestamp_based',
      priority: 1
    },
    // Agent interactions - remote wins
    {
      entity_type: 'agent_interaction',
      field_name: '*',
      strategy: 'remote_wins',
      priority: 1
    },
    // Productivity metrics - intelligent merge
    {
      entity_type: 'productivity_metric',
      field_name: '*',
      strategy: 'merge_intelligent',
      priority: 1
    },
    // ID fields should never change
    {
      entity_type: '*',
      field_name: 'id',
      strategy: 'remote_wins',
      priority: 0
    },
    // Organization ID should never change
    {
      entity_type: '*',
      field_name: 'organization_id',
      strategy: 'remote_wins',
      priority: 0
    },
    // Created timestamps should not change
    {
      entity_type: '*',
      field_name: 'created_at',
      strategy: 'timestamp_based',
      priority: 0,
      conditions: { local_precedence: true }
    }
  ];
  
  // Conflict tracking
  private conflictHistory: Map<string, ConflictResolutionResult> = new Map();
  private conflictMetrics: ConflictMetrics = {
    total_conflicts: 0,
    resolved_automatically: 0,
    requiring_manual_review: 0,
    by_strategy: {},
    by_entity_type: {},
    average_resolution_time_ms: 0,
    success_rate: 0
  };

  constructor(db: DatabaseConnection, logger: winston.Logger) {
    this.metricsModel = new MetricsModel(db);
    this.logger = logger;
    
    // Initialize strategy counters
    this.strategies.forEach(strategy => {
      this.conflictMetrics.by_strategy[strategy.name] = 0;
    });
  }

  /**
   * Resolve a data conflict using configured strategies
   */
  async resolveConflict(conflict: ConflictData): Promise<ConflictResolutionResult> {
    const startTime = performance.now();
    const conflictId = this.generateConflictId(conflict);
    
    try {
      this.logger.info('Resolving data conflict', {
        conflict_id: conflictId,
        entity_type: conflict.entity_type,
        entity_id: conflict.entity_id,
        conflict_fields: conflict.conflict_fields
      });
      
      // Determine resolution strategy
      const strategy = this.selectResolutionStrategy(conflict);
      
      // Apply resolution strategy
      const result = await this.applyResolutionStrategy(strategy, conflict, conflictId);
      
      // Track resolution
      const resolutionTime = performance.now() - startTime;
      this.trackConflictResolution(result, resolutionTime);
      
      // Store in history
      this.conflictHistory.set(conflictId, result);
      
      this.logger.info('Conflict resolved', {
        conflict_id: conflictId,
        strategy_used: result.strategy_used,
        manual_review_required: result.manual_review_required,
        resolution_time_ms: resolutionTime
      });
      
      return result;
      
    } catch (error) {
      const resolutionTime = performance.now() - startTime;
      
      this.logger.error('Failed to resolve conflict', {
        conflict_id: conflictId,
        error: error instanceof Error ? error.message : 'Unknown error',
        resolution_time_ms: resolutionTime
      });
      
      // Return default resolution (remote wins)
      return this.createDefaultResolution(conflict, conflictId, error);
    }
  }

  /**
   * Detect conflicts between local and remote data
   */
  detectConflicts(
    entityType: ConflictData['entity_type'],
    localData: any,
    remoteData: any
  ): ConflictData | null {
    if (!localData || !remoteData) {
      return null; // No conflict if one version is missing
    }
    
    const conflictFields: string[] = [];
    
    // Compare each field
    this.compareObjects(localData, remoteData, '', conflictFields);
    
    if (conflictFields.length === 0) {
      return null; // No conflicts found
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

  /**
   * Get conflict resolution metrics
   */
  getConflictMetrics(): ConflictMetrics {
    return { ...this.conflictMetrics };
  }

  /**
   * Get conflict history
   */
  getConflictHistory(limit: number = 100): ConflictResolutionResult[] {
    return Array.from(this.conflictHistory.values())
      .sort((a, b) => b.conflict_id.localeCompare(a.conflict_id))
      .slice(0, limit);
  }

  /**
   * Add custom resolution rule
   */
  addResolutionRule(rule: ConflictRule): void {
    this.defaultRules.push(rule);
    this.defaultRules.sort((a, b) => a.priority - b.priority);
    
    this.logger.info('Added custom resolution rule', {
      entity_type: rule.entity_type,
      field_name: rule.field_name,
      strategy: rule.strategy,
      priority: rule.priority
    });
  }

  // Private methods

  private selectResolutionStrategy(conflict: ConflictData): ConflictResolutionStrategy {
    // Find matching rules
    const applicableRules = this.defaultRules.filter(rule => {
      const entityMatches = rule.entity_type === '*' || rule.entity_type === conflict.entity_type;
      const fieldMatches = rule.field_name === '*' || conflict.conflict_fields.some(field => 
        field === rule.field_name || (rule.field_name.includes('*') && this.matchesPattern(field, rule.field_name))
      );
      
      return entityMatches && fieldMatches;
    });
    
    // Use highest priority rule
    const selectedRule = applicableRules.sort((a, b) => a.priority - b.priority)[0];
    
    if (selectedRule) {
      const strategy = this.strategies.find(s => s.name === selectedRule.strategy);
      if (strategy) {
        return strategy;
      }
    }
    
    // Default to remote wins
    return this.strategies.find(s => s.name === 'remote_wins')!;
  }

  private async applyResolutionStrategy(
    strategy: ConflictResolutionStrategy,
    conflict: ConflictData,
    conflictId: string
  ): Promise<ConflictResolutionResult> {
    const fieldResolutions: ConflictResolutionResult['field_resolutions'] = [];
    
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

  private resolveRemoteWins(
    conflict: ConflictData,
    conflictId: string,
    fieldResolutions: ConflictResolutionResult['field_resolutions']
  ): ConflictResolutionResult {
    // Analyze field differences for reporting
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

  private resolveLocalWins(
    conflict: ConflictData,
    conflictId: string,
    fieldResolutions: ConflictResolutionResult['field_resolutions']
  ): ConflictResolutionResult {
    // Analyze field differences for reporting
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

  private resolveTimestampBased(
    conflict: ConflictData,
    conflictId: string,
    fieldResolutions: ConflictResolutionResult['field_resolutions']
  ): ConflictResolutionResult {
    const localIsNewer = conflict.local_timestamp > conflict.remote_timestamp;
    const newerVersion = localIsNewer ? conflict.local_version : conflict.remote_version;
    const reasonPrefix = localIsNewer ? 'Local version is newer' : 'Remote version is newer';
    
    // Analyze field differences for reporting
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

  private resolveMergeIntelligent(
    conflict: ConflictData,
    conflictId: string,
    fieldResolutions: ConflictResolutionResult['field_resolutions']
  ): ConflictResolutionResult {
    const merged = { ...conflict.local_version };
    let manualReviewRequired = false;
    
    for (const field of conflict.conflict_fields) {
      const localValue = this.getNestedValue(conflict.local_version, field);
      const remoteValue = this.getNestedValue(conflict.remote_version, field);
      
      let chosenValue: any;
      let reason: string;
      
      // Apply intelligent merging rules
      if (field.includes('_count') || field.includes('_total')) {
        // For count fields, use the higher value
        chosenValue = Math.max(Number(localValue) || 0, Number(remoteValue) || 0);
        reason = 'Used higher count value';
      } else if (field.includes('_time') || field.includes('timestamp')) {
        // For time fields, use the more recent one
        const localTime = new Date(localValue).getTime() || 0;
        const remoteTime = new Date(remoteValue).getTime() || 0;
        chosenValue = localTime > remoteTime ? localValue : remoteValue;
        reason = 'Used more recent timestamp';
      } else if (Array.isArray(localValue) && Array.isArray(remoteValue)) {
        // For arrays, merge uniquely
        chosenValue = [...new Set([...localValue, ...remoteValue])];
        reason = 'Merged arrays with unique values';
      } else if (typeof localValue === 'object' && typeof remoteValue === 'object') {
        // For objects, merge recursively
        chosenValue = { ...localValue, ...remoteValue };
        reason = 'Merged objects';
      } else {
        // For other types, require manual review
        chosenValue = remoteValue; // Default to remote
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

  private resolveMergeManual(
    conflict: ConflictData,
    conflictId: string,
    fieldResolutions: ConflictResolutionResult['field_resolutions']
  ): ConflictResolutionResult {
    // For manual review, return remote version but mark for review
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

  private compareObjects(obj1: any, obj2: any, path: string, conflicts: string[]): void {
    const keys1 = Object.keys(obj1 || {});
    const keys2 = Object.keys(obj2 || {});
    const allKeys = [...new Set([...keys1, ...keys2])];
    
    for (const key of allKeys) {
      const currentPath = path ? `${path}.${key}` : key;
      const val1 = obj1?.[key];
      const val2 = obj2?.[key];
      
      if (val1 === undefined && val2 !== undefined) {
        conflicts.push(currentPath);
      } else if (val1 !== undefined && val2 === undefined) {
        conflicts.push(currentPath);
      } else if (typeof val1 === 'object' && typeof val2 === 'object') {
        if (val1 === null || val2 === null) {
          if (val1 !== val2) {
            conflicts.push(currentPath);
          }
        } else {
          this.compareObjects(val1, val2, currentPath, conflicts);
        }
      } else if (val1 !== val2) {
        conflicts.push(currentPath);
      }
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      if (!current[key]) current[key] = {};
      return current[key];
    }, obj);
    
    target[lastKey] = value;
  }

  private matchesPattern(value: string, pattern: string): boolean {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return regex.test(value);
  }

  private generateConflictId(conflict: ConflictData): string {
    const timestamp = Date.now();
    const hash = Math.random().toString(36).substr(2, 9);
    return `conflict-${conflict.entity_type}-${timestamp}-${hash}`;
  }

  private trackConflictResolution(result: ConflictResolutionResult, timeMs: number): void {
    this.conflictMetrics.total_conflicts++;
    
    if (!result.manual_review_required) {
      this.conflictMetrics.resolved_automatically++;
    } else {
      this.conflictMetrics.requiring_manual_review++;
    }
    
    this.conflictMetrics.by_strategy[result.strategy_used] = 
      (this.conflictMetrics.by_strategy[result.strategy_used] || 0) + 1;
    
    // Update average resolution time
    const totalTime = this.conflictMetrics.average_resolution_time_ms * (this.conflictMetrics.total_conflicts - 1);
    this.conflictMetrics.average_resolution_time_ms = (totalTime + timeMs) / this.conflictMetrics.total_conflicts;
    
    // Calculate success rate
    this.conflictMetrics.success_rate = 
      this.conflictMetrics.resolved_automatically / this.conflictMetrics.total_conflicts;
  }

  private createDefaultResolution(
    conflict: ConflictData,
    conflictId: string,
    error: any
  ): ConflictResolutionResult {
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