import * as winston from 'winston';
import { HybridMetricsCollector, LocalMetricsData } from './hybrid-collector';
export interface HookExecutionContext {
    hook_name: string;
    user_id: string;
    session_id?: string;
    working_directory: string;
    git_branch?: string;
    claude_version?: string;
    environment_variables: Record<string, string>;
    execution_args?: string[];
}
export interface HookExecutionResult {
    success: boolean;
    exit_code: number;
    stdout: string;
    stderr: string;
    execution_time_ms: number;
    output_files?: string[];
    metrics_generated?: LocalMetricsData[];
}
export interface CompatibilityStatus {
    hooks_directory: string;
    hooks_found: string[];
    hooks_executable: string[];
    node_version: string;
    dependencies_available: boolean;
    performance_improvements: {
        python_eliminated: boolean;
        native_nodejs: boolean;
        performance_gain_percent: number;
    };
    migration_status: {
        completed: boolean;
        hooks_migrated: number;
        hooks_remaining: number;
    };
}
export interface LegacyHookData {
    session_id: string;
    timestamp: string;
    user: string;
    working_directory: string;
    git_branch?: string;
    productivity_metrics?: {
        commands_executed: number;
        tools_invoked: number;
        files_read: number;
        files_modified: number;
        lines_changed: number;
        agents_used: string[];
    };
    quality_metrics?: {
        tests_run: number;
        tests_passed: number;
        builds_attempted: number;
        builds_successful: number;
    };
    tool_metrics?: Array<{
        tool_name: string;
        execution_time_ms: number;
        status: string;
        input_size?: number;
        output_size?: number;
        error_message?: string;
    }>;
}
export declare class LocalCompatibilityBridge {
    private hybridCollector;
    private logger;
    private hooksDirectory;
    private metricsDirectory;
    private knownHooks;
    private fileWatchers;
    private executionCache;
    private readonly CACHE_TTL_MS;
    constructor(hybridCollector: HybridMetricsCollector, logger: winston.Logger, hooksPath?: string);
    private initializeBridge;
    executeHook(hookName: string, context: HookExecutionContext, args?: string[]): Promise<HookExecutionResult>;
    private setupFileWatchers;
    private processFileChange;
    private parseHookOutput;
    private parseSessionStartOutput;
    private parseSessionEndOutput;
    private parseToolMetricsOutput;
    private parseAnalyticsOutput;
    private parseGenericOutput;
    getCompatibilityStatus(): Promise<CompatibilityStatus>;
    private findAvailableHooks;
    private getExecutableHooks;
    private checkDependencies;
    private getMigrationStatus;
    private findGeneratedFiles;
    private readNewLogEntries;
    private convertLegacyToMetrics;
    private cleanupCache;
    destroy(): void;
}
//# sourceMappingURL=local-compatibility.d.ts.map