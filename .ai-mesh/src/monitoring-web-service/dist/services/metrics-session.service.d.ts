import { DatabaseConnection } from '../database/connection';
import { UserSession, CommandExecution, AgentInteraction } from '../types/metrics';
import * as winston from 'winston';
export interface SessionMetadata {
    user_agent?: string;
    timezone?: string;
    project_context?: string;
    claude_version?: string;
    system_info?: {
        os: string;
        node_version: string;
        memory_usage: number;
    };
    workspace_info?: {
        working_directory: string;
        git_branch?: string;
        git_commit?: string;
        project_type?: string;
    };
}
export interface SessionAnalytics {
    commands_executed: number;
    agents_used: string[];
    total_execution_time_ms: number;
    average_command_time_ms: number;
    error_count: number;
    error_rate: number;
    productivity_score?: number;
    focus_time_minutes?: number;
    interruption_count?: number;
}
export interface SessionSummary {
    session: UserSession;
    analytics: SessionAnalytics;
    commands: CommandExecution[];
    interactions: AgentInteraction[];
}
export interface ActiveSessionInfo {
    session_id: string;
    user_id: string;
    organization_id: string;
    start_time: Date;
    duration_minutes: number;
    commands_executed: number;
    agents_used: string[];
    last_activity: Date;
    is_active: boolean;
}
export declare class MetricsSessionService {
    private metricsModel;
    private logger;
    private activeSessions;
    private readonly SESSION_TIMEOUT_MS;
    private readonly CLEANUP_INTERVAL_MS;
    constructor(db: DatabaseConnection, logger: winston.Logger);
    startSession(organizationId: string, userId: string, metadata?: SessionMetadata): Promise<{
        success: boolean;
        session?: UserSession;
        message?: string;
    }>;
    updateSessionActivity(organizationId: string, sessionId: string, activity: {
        command_name?: string;
        agent_name?: string;
        execution_time_ms?: number;
        status?: 'success' | 'error';
    }): Promise<{
        success: boolean;
        message?: string;
    }>;
    endSession(organizationId: string, sessionId: string, endMetadata?: {
        productivity_score?: number;
        focus_time_minutes?: number;
        interruption_count?: number;
        completion_reason?: 'user_ended' | 'timeout' | 'error';
    }): Promise<{
        success: boolean;
        summary?: SessionSummary;
        message?: string;
    }>;
    getActiveSession(organizationId: string, userId: string): Promise<UserSession | null>;
    getSessionSummary(organizationId: string, sessionId: string): Promise<SessionSummary | null>;
    getActiveSessions(organizationId: string): ActiveSessionInfo[];
    private calculateSessionAnalytics;
    private syncSessionToDatabase;
    private cleanupInactiveSessions;
    getSessionMetrics(): Promise<{
        active_sessions: number;
        total_sessions_today: number;
        average_session_duration_minutes: number;
        average_commands_per_session: number;
        average_productivity_score: number;
    }>;
}
//# sourceMappingURL=metrics-session.service.d.ts.map