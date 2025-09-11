import { Router } from 'express';
import { PrismaClient } from '../generated/prisma-client';
export interface LegacySessionRequest {
    session_id: string;
    start_time: string;
    end_time?: string;
    user: string;
    working_directory: string;
    git_branch: string;
    productivity_metrics?: {
        commands_executed: number;
        tools_invoked: number;
        files_read: number;
        files_modified: number;
        lines_changed: number;
        agents_used: string[];
        focus_blocks: number;
        interruptions: number;
    };
    quality_metrics?: {
        tests_run: number;
        tests_passed: number;
        builds_attempted: number;
        builds_successful: number;
        reviews_requested: number;
    };
    workflow_metrics?: {
        git_commits: number;
        prs_created: number;
        context_switches: number;
    };
}
export interface LegacyToolMetricRequest {
    event: string;
    timestamp: string;
    session_id?: string;
    tool_name?: string;
    execution_time?: number;
    memory_usage?: number;
    success?: boolean;
    error_message?: string;
    parameters?: any;
    output_size?: number;
    command_line?: string;
    working_directory?: string;
}
export interface LegacyResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    timestamp: string;
    version: string;
}
export declare class LegacyApiController {
    private readonly prisma;
    private readonly formatConverter;
    private readonly hookBridge;
    private readonly router;
    private readonly tenantId;
    constructor(prisma: PrismaClient, tenantId: string);
    getRouter(): Router;
    private setupRoutes;
    private createSession;
    private updateSession;
    private getSession;
    private getSessions;
    private deleteSession;
    private recordToolMetric;
    private recordToolMetricsBatch;
    private getToolMetrics;
    private getProductivityAnalytics;
    private getToolAnalytics;
    private getSessionAnalytics;
    private getDashboardMetrics;
    private getProductivityIndicators;
    private getBaseline;
    private handleSessionStart;
    private handleSessionEnd;
    private handleToolUsage;
    private healthCheck;
    private getVersion;
    private getMigrationStatus;
    private syncLocalData;
    private validateSession;
    private validateToolMetric;
    private validateToolMetricBatch;
    private sendLegacyResponse;
    private sendLegacyError;
}
export declare function createLegacyApiController(prisma: PrismaClient, tenantId: string): Router;
//# sourceMappingURL=legacy-api.d.ts.map