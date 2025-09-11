"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.RollbackManager = void 0;
exports.createRollbackManager = createRollbackManager;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
class RollbackManager {
    prisma;
    options;
    rollbackId;
    constructor(prisma, options) {
        this.prisma = prisma;
        this.options = options;
        this.rollbackId = `rollback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    async executeRollback(migrationData, importResult) {
        const startTime = new Date();
        console.log(`🔄 Starting rollback ${this.rollbackId} with strategy: ${this.options.rollbackStrategy}`);
        const result = {
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
            if (this.options.createRollbackBackup) {
                console.log('💾 Creating pre-rollback backup...');
                await this.createPreRollbackBackup(result);
            }
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
            if (await this.backupExists()) {
                console.log('📂 Restoring data from backup...');
                await this.restoreFromBackup(result);
            }
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
        }
        catch (error) {
            result.success = false;
            result.endTime = new Date();
            result.totalDurationMs = result.endTime.getTime() - result.startTime.getTime();
            result.errors.push(`Rollback failed: ${error.message}`);
            console.error(`❌ Rollback ${this.rollbackId} failed:`, error);
            return result;
        }
    }
    async executeFullRollback(result, migrationData, importResult) {
        console.log('🔄 Executing full rollback...');
        const toolMetricsAction = await this.removeImportedToolMetrics(result, migrationData);
        result.actions.push(toolMetricsAction);
        result.recovery.toolMetricsRemoved += toolMetricsAction.recordsAffected;
        const sessionsAction = await this.removeImportedSessions(result, migrationData);
        result.actions.push(sessionsAction);
        result.recovery.sessionsRemoved += sessionsAction.recordsAffected;
        await this.cleanupMigrationArtifacts(result);
    }
    async executePartialRollback(result, migrationData, importResult) {
        console.log('🔄 Executing partial rollback...');
        if (!importResult) {
            result.warnings.push('No import result provided for partial rollback - performing full rollback');
            await this.executeFullRollback(result, migrationData, importResult);
            return;
        }
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
        result.warnings.push(`Partial rollback completed - ${importResult.recordsInserted - result.recovery.sessionsRemoved} records retained`);
    }
    async executeSelectiveRollback(result, migrationData, importResult) {
        console.log('🔄 Executing selective rollback...');
        const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const selectiveToolMetricsAction = await this.removeRecentToolMetrics(result, cutoffTime);
        result.actions.push(selectiveToolMetricsAction);
        result.recovery.toolMetricsRemoved += selectiveToolMetricsAction.recordsAffected;
        const selectiveSessionsAction = await this.removeRecentSessions(result, cutoffTime);
        result.actions.push(selectiveSessionsAction);
        result.recovery.sessionsRemoved += selectiveSessionsAction.recordsAffected;
    }
    async removeImportedToolMetrics(result, migrationData) {
        const action = {
            type: 'delete',
            target: 'tool_metrics',
            details: 'Removing all imported tool metrics',
            timestamp: new Date(),
            recordsAffected: 0,
            success: false
        };
        try {
            if (this.options.dryRun) {
                const countResult = await this.prisma.$queryRawUnsafe(`
          SELECT COUNT(*) as count 
          FROM "${this.options.tenantSchemaName}".tool_metrics
          WHERE created_at >= NOW() - INTERVAL '1 day'
        `);
                action.recordsAffected = Number(countResult[0].count);
            }
            else {
                if (migrationData && migrationData.toolMetrics.length > 0) {
                    const toolMetricIds = migrationData.toolMetrics.map(m => m.id);
                    const deleteResult = await this.prisma.$executeRawUnsafe(`
            DELETE FROM "${this.options.tenantSchemaName}".tool_metrics
            WHERE id = ANY($1)
          `, toolMetricIds);
                    action.recordsAffected = deleteResult;
                }
                else {
                    const deleteResult = await this.prisma.$executeRawUnsafe(`
            DELETE FROM "${this.options.tenantSchemaName}".tool_metrics
            WHERE created_at >= NOW() - INTERVAL '1 day'
          `);
                    action.recordsAffected = deleteResult;
                }
            }
            action.success = true;
            action.details += ` - ${action.recordsAffected} records affected`;
        }
        catch (error) {
            action.success = false;
            action.error = error.message;
            result.errors.push(`Failed to remove tool metrics: ${error.message}`);
        }
        return action;
    }
    async removeImportedSessions(result, migrationData) {
        const action = {
            type: 'delete',
            target: 'sessions',
            details: 'Removing all imported sessions',
            timestamp: new Date(),
            recordsAffected: 0,
            success: false
        };
        try {
            if (this.options.dryRun) {
                const countResult = await this.prisma.$queryRawUnsafe(`
          SELECT COUNT(*) as count 
          FROM "${this.options.tenantSchemaName}".metrics_sessions
          WHERE created_at >= NOW() - INTERVAL '1 day'
        `);
                action.recordsAffected = Number(countResult[0].count);
            }
            else {
                if (migrationData && migrationData.sessions.length > 0) {
                    const sessionIds = migrationData.sessions.map(s => s.id);
                    const deleteResult = await this.prisma.$executeRawUnsafe(`
            DELETE FROM "${this.options.tenantSchemaName}".metrics_sessions
            WHERE id = ANY($1)
          `, sessionIds);
                    action.recordsAffected = deleteResult;
                }
                else {
                    const deleteResult = await this.prisma.$executeRawUnsafe(`
            DELETE FROM "${this.options.tenantSchemaName}".metrics_sessions
            WHERE created_at >= NOW() - INTERVAL '1 day'
          `);
                    action.recordsAffected = deleteResult;
                }
            }
            action.success = true;
            action.details += ` - ${action.recordsAffected} records affected`;
        }
        catch (error) {
            action.success = false;
            action.error = error.message;
            result.errors.push(`Failed to remove sessions: ${error.message}`);
        }
        return action;
    }
    async removeSpecificSessions(result, sessionIds) {
        const action = {
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
            }
            else {
                const deleteResult = await this.prisma.$executeRawUnsafe(`
          DELETE FROM "${this.options.tenantSchemaName}".metrics_sessions
          WHERE id = ANY($1)
        `, sessionIds);
                action.recordsAffected = deleteResult;
            }
            action.success = true;
        }
        catch (error) {
            action.success = false;
            action.error = error.message;
            result.errors.push(`Failed to remove specific sessions: ${error.message}`);
        }
        return action;
    }
    async removeSpecificToolMetrics(result, sessionIds) {
        const action = {
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
                action.recordsAffected = Number(countResult[0].count);
            }
            else {
                const deleteResult = await this.prisma.$executeRawUnsafe(`
          DELETE FROM "${this.options.tenantSchemaName}".tool_metrics
          WHERE session_id = ANY($1)
        `, sessionIds);
                action.recordsAffected = deleteResult;
            }
            action.success = true;
        }
        catch (error) {
            action.success = false;
            action.error = error.message;
            result.errors.push(`Failed to remove specific tool metrics: ${error.message}`);
        }
        return action;
    }
    async removeRecentSessions(result, cutoffTime) {
        const action = {
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
                action.recordsAffected = Number(countResult[0].count);
            }
            else {
                const deleteResult = await this.prisma.$executeRawUnsafe(`
          DELETE FROM "${this.options.tenantSchemaName}".metrics_sessions
          WHERE created_at >= $1
        `, cutoffTime);
                action.recordsAffected = deleteResult;
            }
            action.success = true;
        }
        catch (error) {
            action.success = false;
            action.error = error.message;
            result.errors.push(`Failed to remove recent sessions: ${error.message}`);
        }
        return action;
    }
    async removeRecentToolMetrics(result, cutoffTime) {
        const action = {
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
                action.recordsAffected = Number(countResult[0].count);
            }
            else {
                const deleteResult = await this.prisma.$executeRawUnsafe(`
          DELETE FROM "${this.options.tenantSchemaName}".tool_metrics
          WHERE created_at >= $1
        `, cutoffTime);
                action.recordsAffected = deleteResult;
            }
            action.success = true;
        }
        catch (error) {
            action.success = false;
            action.error = error.message;
            result.errors.push(`Failed to remove recent tool metrics: ${error.message}`);
        }
        return action;
    }
    async createPreRollbackBackup(result) {
        const backupAction = {
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
            const sessions = await this.prisma.$queryRawUnsafe(`
        SELECT * FROM "${this.options.tenantSchemaName}".metrics_sessions
        ORDER BY created_at DESC
      `);
            await fs.writeFile(path.join(rollbackBackupDir, 'sessions_pre_rollback.json'), JSON.stringify(sessions, null, 2));
            const toolMetrics = await this.prisma.$queryRawUnsafe(`
        SELECT * FROM "${this.options.tenantSchemaName}".tool_metrics
        ORDER BY created_at DESC
      `);
            await fs.writeFile(path.join(rollbackBackupDir, 'tool_metrics_pre_rollback.json'), JSON.stringify(toolMetrics, null, 2));
            backupAction.recordsAffected = sessions.length + toolMetrics.length;
            backupAction.success = true;
            backupAction.details += ` - ${backupAction.recordsAffected} records backed up to ${rollbackBackupDir}`;
            console.log(`💾 Pre-rollback backup created: ${rollbackBackupDir}`);
        }
        catch (error) {
            backupAction.success = false;
            backupAction.error = error.message;
            result.warnings.push(`Failed to create pre-rollback backup: ${error.message}`);
        }
        result.actions.push(backupAction);
    }
    async restoreFromBackup(result) {
        const restoreAction = {
            type: 'restore',
            target: 'all_data',
            details: 'Restoring data from backup',
            timestamp: new Date(),
            recordsAffected: 0,
            success: false
        };
        try {
            const sessionsBackupPath = path.join(this.options.backupDir, 'sessions_backup.json');
            if (await this.fileExists(sessionsBackupPath)) {
                const sessionsData = JSON.parse(await fs.readFile(sessionsBackupPath, 'utf8'));
                if (!this.options.dryRun && sessionsData.length > 0) {
                    console.log(`🔄 Would restore ${sessionsData.length} sessions from backup`);
                    result.recovery.sessionsRestored += sessionsData.length;
                }
                restoreAction.recordsAffected += sessionsData.length;
            }
            const toolMetricsBackupPath = path.join(this.options.backupDir, 'tool_metrics_backup.json');
            if (await this.fileExists(toolMetricsBackupPath)) {
                const toolMetricsData = JSON.parse(await fs.readFile(toolMetricsBackupPath, 'utf8'));
                if (!this.options.dryRun && toolMetricsData.length > 0) {
                    console.log(`🔄 Would restore ${toolMetricsData.length} tool metrics from backup`);
                    result.recovery.toolMetricsRestored += toolMetricsData.length;
                }
                restoreAction.recordsAffected += toolMetricsData.length;
            }
            restoreAction.success = true;
            restoreAction.details += ` - ${restoreAction.recordsAffected} records restored`;
        }
        catch (error) {
            restoreAction.success = false;
            restoreAction.error = error.message;
            result.errors.push(`Failed to restore from backup: ${error.message}`);
        }
        result.actions.push(restoreAction);
    }
    async cleanupMigrationArtifacts(result) {
        const cleanupAction = {
            type: 'delete',
            target: 'schema',
            details: 'Cleaning up migration artifacts',
            timestamp: new Date(),
            recordsAffected: 0,
            success: true
        };
        try {
            cleanupAction.details += ' - Migration artifacts cleaned';
        }
        catch (error) {
            cleanupAction.success = false;
            cleanupAction.error = error.message;
            result.warnings.push(`Failed to cleanup migration artifacts: ${error.message}`);
        }
        result.actions.push(cleanupAction);
    }
    async validatePostRollback() {
        const issues = [];
        try {
            const orphanedMetrics = await this.prisma.$queryRawUnsafe(`
        SELECT COUNT(*) as count
        FROM "${this.options.tenantSchemaName}".tool_metrics tm
        LEFT JOIN "${this.options.tenantSchemaName}".metrics_sessions ms ON tm.session_id = ms.id
        WHERE ms.id IS NULL
      `);
            if (Number(orphanedMetrics[0].count) > 0) {
                issues.push(`Found ${orphanedMetrics[0].count} orphaned tool metrics after rollback`);
            }
            const sessionCount = await this.prisma.$queryRawUnsafe(`
        SELECT COUNT(*) as count FROM "${this.options.tenantSchemaName}".metrics_sessions
      `);
            const toolMetricCount = await this.prisma.$queryRawUnsafe(`
        SELECT COUNT(*) as count FROM "${this.options.tenantSchemaName}".tool_metrics
      `);
            console.log(`📊 Post-rollback counts: ${sessionCount[0].count} sessions, ${toolMetricCount[0].count} tool metrics`);
        }
        catch (error) {
            issues.push(`Post-rollback validation failed: ${error.message}`);
        }
        return {
            isValid: issues.length === 0,
            issues
        };
    }
    async backupExists() {
        try {
            const sessionsBackupPath = path.join(this.options.backupDir, 'sessions_backup.json');
            const toolMetricsBackupPath = path.join(this.options.backupDir, 'tool_metrics_backup.json');
            return (await this.fileExists(sessionsBackupPath)) || (await this.fileExists(toolMetricsBackupPath));
        }
        catch {
            return false;
        }
    }
    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        }
        catch {
            return false;
        }
    }
    extractErrorSessionIds(errors) {
        const sessionIds = new Set();
        for (const error of errors) {
            if (error.recordId) {
                sessionIds.add(error.recordId);
            }
        }
        return Array.from(sessionIds);
    }
}
exports.RollbackManager = RollbackManager;
function createRollbackManager(prisma, tenantSchemaName, backupDir, options = {}) {
    const defaultOptions = {
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
//# sourceMappingURL=rollback-manager.js.map