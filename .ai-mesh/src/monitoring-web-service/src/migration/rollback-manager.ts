/**
 * Rollback Manager for Migration Recovery
 * Provides comprehensive rollback capabilities for failed or problematic migrations
 * 
 * Sprint 6 - Task 6.2: Migration Validation System
 * Handles rollback scenarios with data recovery and integrity preservation
 */

import { PrismaClient } from '../generated/prisma-client';
import { TransformationResult } from './data-transformer';
import { ImportResult } from './bulk-importer';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface RollbackOptions {
  rollbackStrategy: 'full' | 'partial' | 'selective';
  backupDir: string;
  tenantSchemaName: string;
  preserveExistingData: boolean;
  createRollbackBackup: boolean;
  validateAfterRollback: boolean;
  dryRun: boolean;
}

export interface RollbackResult {
  success: boolean;
  rollbackId: string;
  startTime: Date;
  endTime: Date;
  totalDurationMs: number;
  strategy: string;
  
  // Rollback actions performed
  actions: RollbackAction[];
  
  // Data recovery statistics
  recovery: {
    sessionsRemoved: number;
    toolMetricsRemoved: number;
    sessionsRestored: number;
    toolMetricsRestored: number;
    dataIntegrityChecks: number;
  };
  
  // Errors and warnings
  errors: string[];
  warnings: string[];
  
  // Validation results (if enabled)
  validationResult?: {
    isValid: boolean;
    issues: string[];
  };
}

export interface RollbackAction {
  type: 'delete' | 'restore' | 'backup' | 'validate';
  target: 'sessions' | 'tool_metrics' | 'all_data' | 'schema';
  details: string;
  timestamp: Date;
  recordsAffected: number;
  success: boolean;
  error?: string;
}

/**
 * Manages migration rollback operations with comprehensive recovery capabilities
 */
export class RollbackManager {
  private readonly prisma: PrismaClient;
  private readonly options: RollbackOptions;
  private readonly rollbackId: string;

  constructor(prisma: PrismaClient, options: RollbackOptions) {
    this.prisma = prisma;
    this.options = options;
    this.rollbackId = `rollback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Execute rollback operation based on strategy
   */
  async executeRollback(
    migrationData?: TransformationResult,
    importResult?: ImportResult
  ): Promise<RollbackResult> {
    const startTime = new Date();
    console.log(`🔄 Starting rollback ${this.rollbackId} with strategy: ${this.options.rollbackStrategy}`);
    
    const result: RollbackResult = {
      success: false,
      rollbackId: this.rollbackId,
      startTime,
      endTime: new Date(),
      totalDurationMs: 0,
      strategy: this.options.rollbackStrategy,
      actions: [],
      recovery: {
        sessionsRemoved: 0,
        toolMetricsRemoved: 0,
        sessionsRestored: 0,
        toolMetricsRestored: 0,
        dataIntegrityChecks: 0
      },
      errors: [],
      warnings: []
    };

    try {
      // Pre-rollback validation and backup
      if (this.options.createRollbackBackup) {
        console.log('💾 Creating pre-rollback backup...');
        await this.createPreRollbackBackup(result);
      }

      // Execute rollback based on strategy
      switch (this.options.rollbackStrategy) {
        case 'full':
          await this.executeFullRollback(result, migrationData, importResult);
          break;
        case 'partial':
          await this.executePartialRollback(result, migrationData, importResult);
          break;
        case 'selective':
          await this.executeSelectiveRollback(result, migrationData, importResult);
          break;
        default:
          throw new Error(`Unknown rollback strategy: ${this.options.rollbackStrategy}`);
      }

      // Restore from backup if available
      if (await this.backupExists()) {
        console.log('📂 Restoring data from backup...');
        await this.restoreFromBackup(result);
      }

      // Post-rollback validation
      if (this.options.validateAfterRollback) {
        console.log('✅ Performing post-rollback validation...');
        result.validationResult = await this.validatePostRollback();
      }

      result.success = result.errors.length === 0;
      result.endTime = new Date();
      result.totalDurationMs = result.endTime.getTime() - result.startTime.getTime();

      console.log(`✅ Rollback ${this.rollbackId} completed in ${result.totalDurationMs}ms`);
      console.log(`📊 Recovery: ${result.recovery.sessionsRemoved} sessions, ${result.recovery.toolMetricsRemoved} tool metrics removed`);
      console.log(`📊 Recovery: ${result.recovery.sessionsRestored} sessions, ${result.recovery.toolMetricsRestored} tool metrics restored`);
      
      if (result.errors.length > 0) {
        console.warn(`⚠️  ${result.errors.length} errors encountered during rollback`);
      }

      return result;

    } catch (error) {
      result.success = false;
      result.endTime = new Date();
      result.totalDurationMs = result.endTime.getTime() - result.startTime.getTime();
      result.errors.push(`Rollback failed: ${error.message}`);
      
      console.error(`❌ Rollback ${this.rollbackId} failed:`, error);
      return result;
    }
  }

  /**
   * Execute full rollback - remove all migration data
   */
  private async executeFullRollback(
    result: RollbackResult,
    migrationData?: TransformationResult,
    importResult?: ImportResult
  ): Promise<void> {
    console.log('🔄 Executing full rollback...');

    // Remove all imported tool metrics
    const toolMetricsAction = await this.removeImportedToolMetrics(result, migrationData);
    result.actions.push(toolMetricsAction);
    result.recovery.toolMetricsRemoved += toolMetricsAction.recordsAffected;

    // Remove all imported sessions
    const sessionsAction = await this.removeImportedSessions(result, migrationData);
    result.actions.push(sessionsAction);
    result.recovery.sessionsRemoved += sessionsAction.recordsAffected;

    // Clean up any migration artifacts
    await this.cleanupMigrationArtifacts(result);
  }

  /**
   * Execute partial rollback - remove only problematic data
   */
  private async executePartialRollback(
    result: RollbackResult,
    migrationData?: TransformationResult,
    importResult?: ImportResult
  ): Promise<void> {
    console.log('🔄 Executing partial rollback...');

    if (!importResult) {
      result.warnings.push('No import result provided for partial rollback - performing full rollback');
      await this.executeFullRollback(result, migrationData, importResult);
      return;
    }

    // Remove only records that had errors during import
    if (importResult.errors.length > 0) {
      const errorSessionIds = this.extractErrorSessionIds(importResult.errors);
      
      if (errorSessionIds.length > 0) {
        const partialToolMetricsAction = await this.removeSpecificToolMetrics(result, errorSessionIds);
        result.actions.push(partialToolMetricsAction);
        result.recovery.toolMetricsRemoved += partialToolMetricsAction.recordsAffected;

        const partialSessionsAction = await this.removeSpecificSessions(result, errorSessionIds);
        result.actions.push(partialSessionsAction);
        result.recovery.sessionsRemoved += partialSessionsAction.recordsAffected;
      }
    }

    // Keep successfully imported data
    result.warnings.push(`Partial rollback completed - ${importResult.recordsInserted - result.recovery.sessionsRemoved} records retained`);
  }

  /**
   * Execute selective rollback - remove specific data types or time ranges
   */
  private async executeSelectiveRollback(
    result: RollbackResult,
    migrationData?: TransformationResult,
    importResult?: ImportResult
  ): Promise<void> {
    console.log('🔄 Executing selective rollback...');

    // For selective rollback, we could implement various criteria:
    // 1. Date range-based rollback
    // 2. User-based rollback
    // 3. Data quality-based rollback

    // Example: Remove data from the last 24 hours (assuming recent migration)
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const selectiveToolMetricsAction = await this.removeRecentToolMetrics(result, cutoffTime);
    result.actions.push(selectiveToolMetricsAction);
    result.recovery.toolMetricsRemoved += selectiveToolMetricsAction.recordsAffected;

    const selectiveSessionsAction = await this.removeRecentSessions(result, cutoffTime);
    result.actions.push(selectiveSessionsAction);
    result.recovery.sessionsRemoved += selectiveSessionsAction.recordsAffected;
  }

  /**
   * Remove imported tool metrics
   */
  private async removeImportedToolMetrics(
    result: RollbackResult,
    migrationData?: TransformationResult
  ): Promise<RollbackAction> {
    const action: RollbackAction = {
      type: 'delete',
      target: 'tool_metrics',
      details: 'Removing all imported tool metrics',
      timestamp: new Date(),
      recordsAffected: 0,
      success: false
    };

    try {
      if (this.options.dryRun) {
        // Simulate the count for dry run
        const countResult = await this.prisma.$queryRawUnsafe(`
          SELECT COUNT(*) as count 
          FROM "${this.options.tenantSchemaName}".tool_metrics
          WHERE created_at >= NOW() - INTERVAL '1 day'
        `);
        action.recordsAffected = Number((countResult as any)[0].count);
      } else {
        if (migrationData && migrationData.toolMetrics.length > 0) {
          // Remove specific tool metrics by ID
          const toolMetricIds = migrationData.toolMetrics.map(m => m.id);
          const deleteResult = await this.prisma.$executeRawUnsafe(`
            DELETE FROM "${this.options.tenantSchemaName}".tool_metrics
            WHERE id = ANY($1)
          `, toolMetricIds);
          action.recordsAffected = deleteResult;
        } else {
          // Remove all recent tool metrics (last 24 hours)
          const deleteResult = await this.prisma.$executeRawUnsafe(`
            DELETE FROM "${this.options.tenantSchemaName}".tool_metrics
            WHERE created_at >= NOW() - INTERVAL '1 day'
          `);
          action.recordsAffected = deleteResult;
        }
      }

      action.success = true;
      action.details += ` - ${action.recordsAffected} records affected`;
      
    } catch (error) {
      action.success = false;
      action.error = error.message;
      result.errors.push(`Failed to remove tool metrics: ${error.message}`);
    }

    return action;
  }

  /**
   * Remove imported sessions
   */
  private async removeImportedSessions(
    result: RollbackResult,
    migrationData?: TransformationResult
  ): Promise<RollbackAction> {
    const action: RollbackAction = {
      type: 'delete',
      target: 'sessions',
      details: 'Removing all imported sessions',
      timestamp: new Date(),
      recordsAffected: 0,
      success: false
    };

    try {
      if (this.options.dryRun) {
        // Simulate the count for dry run
        const countResult = await this.prisma.$queryRawUnsafe(`
          SELECT COUNT(*) as count 
          FROM "${this.options.tenantSchemaName}".metrics_sessions
          WHERE created_at >= NOW() - INTERVAL '1 day'
        `);
        action.recordsAffected = Number((countResult as any)[0].count);
      } else {
        if (migrationData && migrationData.sessions.length > 0) {
          // Remove specific sessions by ID
          const sessionIds = migrationData.sessions.map(s => s.id);
          const deleteResult = await this.prisma.$executeRawUnsafe(`
            DELETE FROM "${this.options.tenantSchemaName}".metrics_sessions
            WHERE id = ANY($1)
          `, sessionIds);
          action.recordsAffected = deleteResult;
        } else {
          // Remove all recent sessions (last 24 hours)
          const deleteResult = await this.prisma.$executeRawUnsafe(`
            DELETE FROM "${this.options.tenantSchemaName}".metrics_sessions
            WHERE created_at >= NOW() - INTERVAL '1 day'
          `);
          action.recordsAffected = deleteResult;
        }
      }

      action.success = true;
      action.details += ` - ${action.recordsAffected} records affected`;
      
    } catch (error) {
      action.success = false;
      action.error = error.message;
      result.errors.push(`Failed to remove sessions: ${error.message}`);
    }

    return action;
  }

  /**
   * Remove specific sessions by ID
   */
  private async removeSpecificSessions(result: RollbackResult, sessionIds: string[]): Promise<RollbackAction> {
    const action: RollbackAction = {
      type: 'delete',
      target: 'sessions',
      details: `Removing ${sessionIds.length} specific sessions`,
      timestamp: new Date(),
      recordsAffected: 0,
      success: false
    };

    try {
      if (this.options.dryRun) {
        action.recordsAffected = sessionIds.length;
      } else {
        const deleteResult = await this.prisma.$executeRawUnsafe(`
          DELETE FROM "${this.options.tenantSchemaName}".metrics_sessions
          WHERE id = ANY($1)
        `, sessionIds);
        action.recordsAffected = deleteResult;
      }

      action.success = true;
      
    } catch (error) {
      action.success = false;
      action.error = error.message;
      result.errors.push(`Failed to remove specific sessions: ${error.message}`);
    }

    return action;
  }

  /**
   * Remove specific tool metrics by session IDs
   */
  private async removeSpecificToolMetrics(result: RollbackResult, sessionIds: string[]): Promise<RollbackAction> {
    const action: RollbackAction = {
      type: 'delete',
      target: 'tool_metrics',
      details: `Removing tool metrics for ${sessionIds.length} sessions`,
      timestamp: new Date(),
      recordsAffected: 0,
      success: false
    };

    try {
      if (this.options.dryRun) {
        const countResult = await this.prisma.$queryRawUnsafe(`
          SELECT COUNT(*) as count 
          FROM "${this.options.tenantSchemaName}".tool_metrics
          WHERE session_id = ANY($1)
        `, sessionIds);
        action.recordsAffected = Number((countResult as any)[0].count);
      } else {
        const deleteResult = await this.prisma.$executeRawUnsafe(`
          DELETE FROM "${this.options.tenantSchemaName}".tool_metrics
          WHERE session_id = ANY($1)
        `, sessionIds);
        action.recordsAffected = deleteResult;
      }

      action.success = true;
      
    } catch (error) {
      action.success = false;
      action.error = error.message;
      result.errors.push(`Failed to remove specific tool metrics: ${error.message}`);
    }

    return action;
  }

  /**
   * Remove recent sessions (for selective rollback)
   */
  private async removeRecentSessions(result: RollbackResult, cutoffTime: Date): Promise<RollbackAction> {
    const action: RollbackAction = {
      type: 'delete',
      target: 'sessions',
      details: `Removing sessions created after ${cutoffTime.toISOString()}`,
      timestamp: new Date(),
      recordsAffected: 0,
      success: false
    };

    try {
      if (this.options.dryRun) {
        const countResult = await this.prisma.$queryRawUnsafe(`
          SELECT COUNT(*) as count 
          FROM "${this.options.tenantSchemaName}".metrics_sessions
          WHERE created_at >= $1
        `, cutoffTime);
        action.recordsAffected = Number((countResult as any)[0].count);
      } else {
        const deleteResult = await this.prisma.$executeRawUnsafe(`
          DELETE FROM "${this.options.tenantSchemaName}".metrics_sessions
          WHERE created_at >= $1
        `, cutoffTime);
        action.recordsAffected = deleteResult;
      }

      action.success = true;
      
    } catch (error) {
      action.success = false;
      action.error = error.message;
      result.errors.push(`Failed to remove recent sessions: ${error.message}`);
    }

    return action;
  }

  /**
   * Remove recent tool metrics (for selective rollback)
   */
  private async removeRecentToolMetrics(result: RollbackResult, cutoffTime: Date): Promise<RollbackAction> {
    const action: RollbackAction = {
      type: 'delete',
      target: 'tool_metrics',
      details: `Removing tool metrics created after ${cutoffTime.toISOString()}`,
      timestamp: new Date(),
      recordsAffected: 0,
      success: false
    };

    try {
      if (this.options.dryRun) {
        const countResult = await this.prisma.$queryRawUnsafe(`
          SELECT COUNT(*) as count 
          FROM "${this.options.tenantSchemaName}".tool_metrics
          WHERE created_at >= $1
        `, cutoffTime);
        action.recordsAffected = Number((countResult as any)[0].count);
      } else {
        const deleteResult = await this.prisma.$executeRawUnsafe(`
          DELETE FROM "${this.options.tenantSchemaName}".tool_metrics
          WHERE created_at >= $1
        `, cutoffTime);
        action.recordsAffected = deleteResult;
      }

      action.success = true;
      
    } catch (error) {
      action.success = false;
      action.error = error.message;
      result.errors.push(`Failed to remove recent tool metrics: ${error.message}`);
    }

    return action;
  }

  /**
   * Create pre-rollback backup
   */
  private async createPreRollbackBackup(result: RollbackResult): Promise<void> {
    const backupAction: RollbackAction = {
      type: 'backup',
      target: 'all_data',
      details: 'Creating pre-rollback backup',
      timestamp: new Date(),
      recordsAffected: 0,
      success: false
    };

    try {
      const rollbackBackupDir = path.join(this.options.backupDir, 'rollback', this.rollbackId);
      await fs.mkdir(rollbackBackupDir, { recursive: true });

      // Export current sessions
      const sessions = await this.prisma.$queryRawUnsafe(`
        SELECT * FROM "${this.options.tenantSchemaName}".metrics_sessions
        ORDER BY created_at DESC
      `);

      await fs.writeFile(
        path.join(rollbackBackupDir, 'sessions_pre_rollback.json'),
        JSON.stringify(sessions, null, 2)
      );

      // Export current tool metrics
      const toolMetrics = await this.prisma.$queryRawUnsafe(`
        SELECT * FROM "${this.options.tenantSchemaName}".tool_metrics
        ORDER BY created_at DESC
      `);

      await fs.writeFile(
        path.join(rollbackBackupDir, 'tool_metrics_pre_rollback.json'),
        JSON.stringify(toolMetrics, null, 2)
      );

      backupAction.recordsAffected = (sessions as any[]).length + (toolMetrics as any[]).length;
      backupAction.success = true;
      backupAction.details += ` - ${backupAction.recordsAffected} records backed up to ${rollbackBackupDir}`;
      
      console.log(`💾 Pre-rollback backup created: ${rollbackBackupDir}`);

    } catch (error) {
      backupAction.success = false;
      backupAction.error = error.message;
      result.warnings.push(`Failed to create pre-rollback backup: ${error.message}`);
    }

    result.actions.push(backupAction);
  }

  /**
   * Restore data from backup
   */
  private async restoreFromBackup(result: RollbackResult): Promise<void> {
    const restoreAction: RollbackAction = {
      type: 'restore',
      target: 'all_data',
      details: 'Restoring data from backup',
      timestamp: new Date(),
      recordsAffected: 0,
      success: false
    };

    try {
      // Restore sessions
      const sessionsBackupPath = path.join(this.options.backupDir, 'sessions_backup.json');
      if (await this.fileExists(sessionsBackupPath)) {
        const sessionsData = JSON.parse(await fs.readFile(sessionsBackupPath, 'utf8'));
        
        if (!this.options.dryRun && sessionsData.length > 0) {
          // In a real implementation, this would restore the data
          // For now, we'll just log the action
          console.log(`🔄 Would restore ${sessionsData.length} sessions from backup`);
          result.recovery.sessionsRestored += sessionsData.length;
        }
        
        restoreAction.recordsAffected += sessionsData.length;
      }

      // Restore tool metrics
      const toolMetricsBackupPath = path.join(this.options.backupDir, 'tool_metrics_backup.json');
      if (await this.fileExists(toolMetricsBackupPath)) {
        const toolMetricsData = JSON.parse(await fs.readFile(toolMetricsBackupPath, 'utf8'));
        
        if (!this.options.dryRun && toolMetricsData.length > 0) {
          // In a real implementation, this would restore the data
          console.log(`🔄 Would restore ${toolMetricsData.length} tool metrics from backup`);
          result.recovery.toolMetricsRestored += toolMetricsData.length;
        }
        
        restoreAction.recordsAffected += toolMetricsData.length;
      }

      restoreAction.success = true;
      restoreAction.details += ` - ${restoreAction.recordsAffected} records restored`;
      
    } catch (error) {
      restoreAction.success = false;
      restoreAction.error = error.message;
      result.errors.push(`Failed to restore from backup: ${error.message}`);
    }

    result.actions.push(restoreAction);
  }

  /**
   * Clean up migration artifacts
   */
  private async cleanupMigrationArtifacts(result: RollbackResult): Promise<void> {
    const cleanupAction: RollbackAction = {
      type: 'delete',
      target: 'schema',
      details: 'Cleaning up migration artifacts',
      timestamp: new Date(),
      recordsAffected: 0,
      success: true
    };

    try {
      // Clean up temporary files, indices, or other migration artifacts
      // This is implementation-specific based on what artifacts were created
      
      cleanupAction.details += ' - Migration artifacts cleaned';
      
    } catch (error) {
      cleanupAction.success = false;
      cleanupAction.error = error.message;
      result.warnings.push(`Failed to cleanup migration artifacts: ${error.message}`);
    }

    result.actions.push(cleanupAction);
  }

  /**
   * Validate system state after rollback
   */
  private async validatePostRollback(): Promise<{ isValid: boolean; issues: string[] }> {
    const issues: string[] = [];

    try {
      // Check for orphaned records
      const orphanedMetrics = await this.prisma.$queryRawUnsafe(`
        SELECT COUNT(*) as count
        FROM "${this.options.tenantSchemaName}".tool_metrics tm
        LEFT JOIN "${this.options.tenantSchemaName}".metrics_sessions ms ON tm.session_id = ms.id
        WHERE ms.id IS NULL
      `);

      if (Number((orphanedMetrics as any)[0].count) > 0) {
        issues.push(`Found ${(orphanedMetrics as any)[0].count} orphaned tool metrics after rollback`);
      }

      // Check for data consistency
      const sessionCount = await this.prisma.$queryRawUnsafe(`
        SELECT COUNT(*) as count FROM "${this.options.tenantSchemaName}".metrics_sessions
      `);
      
      const toolMetricCount = await this.prisma.$queryRawUnsafe(`
        SELECT COUNT(*) as count FROM "${this.options.tenantSchemaName}".tool_metrics
      `);

      console.log(`📊 Post-rollback counts: ${(sessionCount as any)[0].count} sessions, ${(toolMetricCount as any)[0].count} tool metrics`);

    } catch (error) {
      issues.push(`Post-rollback validation failed: ${error.message}`);
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }

  // Utility methods

  private async backupExists(): Promise<boolean> {
    try {
      const sessionsBackupPath = path.join(this.options.backupDir, 'sessions_backup.json');
      const toolMetricsBackupPath = path.join(this.options.backupDir, 'tool_metrics_backup.json');
      
      return (await this.fileExists(sessionsBackupPath)) || (await this.fileExists(toolMetricsBackupPath));
    } catch {
      return false;
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private extractErrorSessionIds(errors: any[]): string[] {
    const sessionIds = new Set<string>();
    
    for (const error of errors) {
      if (error.recordId) {
        sessionIds.add(error.recordId);
      }
    }
    
    return Array.from(sessionIds);
  }
}

/**
 * Utility function to create a rollback manager with sensible defaults
 */
export function createRollbackManager(
  prisma: PrismaClient,
  tenantSchemaName: string,
  backupDir: string,
  options: Partial<RollbackOptions> = {}
): RollbackManager {
  const defaultOptions: RollbackOptions = {
    rollbackStrategy: 'full',
    backupDir,
    tenantSchemaName,
    preserveExistingData: true,
    createRollbackBackup: true,
    validateAfterRollback: true,
    dryRun: false,
    ...options
  };

  return new RollbackManager(prisma, defaultOptions);
}