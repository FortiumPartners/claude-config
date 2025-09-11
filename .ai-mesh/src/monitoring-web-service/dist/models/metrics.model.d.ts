import { DatabaseConnection } from '../database/connection';
import { CommandExecution, CommandExecutionCreate, AgentInteraction, AgentInteractionCreate, UserSession, UserSessionCreate, UserSessionUpdate, ProductivityMetric, ProductivityMetricCreate, MetricsBatch, MetricsQueryParams, AggregatedMetrics, PerformanceMetrics } from '../types/metrics';
export declare class MetricsModel {
    private db;
    constructor(db: DatabaseConnection);
    getTimeSeriesMetrics(params: MetricsQueryParams): Promise<any[]>;
    getTeamMetrics(params: {
        organization_id: string;
        team_ids?: string[];
        start_date: Date;
        end_date: Date;
        metric_types: string[];
        aggregation_window?: string;
    }): Promise<any[]>;
    getTeamInfo(organizationId: string, teamIds?: string[]): Promise<any[]>;
    getAgentUsageMetrics(params: {
        organization_id: string;
        agent_names?: string[];
        team_id?: string;
        user_id?: string;
        start_date: Date;
        end_date: Date;
    }): Promise<any[]>;
    getLiveMetrics(organizationId: string): Promise<any>;
    getRecentActivity(organizationId: string, since: Date): Promise<any[]>;
    getCodeQualityMetrics(params: {
        organization_id: string;
        team_id?: string;
        user_id?: string;
        project_id?: string;
        start_date: Date;
        end_date: Date;
    }): Promise<any>;
    getTaskMetrics(params: {
        organization_id: string;
        team_id?: string;
        project_id?: string;
        sprint_id?: string;
        start_date: Date;
        end_date: Date;
    }): Promise<any>;
    batchInsertAggregatedMetrics(metrics: AggregatedMetrics[]): Promise<void>;
    healthCheck(): Promise<{
        status: 'healthy' | 'unhealthy';
        details?: any;
    }>;
    createCommandExecution(organizationId: string, data: CommandExecutionCreate): Promise<CommandExecution>;
    batchCreateCommandExecutions(organizationId: string, executions: CommandExecutionCreate[]): Promise<CommandExecution[]>;
    createAgentInteraction(organizationId: string, data: AgentInteractionCreate): Promise<AgentInteraction>;
    createUserSession(organizationId: string, data: UserSessionCreate): Promise<UserSession>;
    updateUserSession(organizationId: string, sessionId: string, data: UserSessionUpdate): Promise<UserSession | null>;
    getActiveUserSession(organizationId: string, userId: string): Promise<UserSession | null>;
    createProductivityMetric(organizationId: string, data: ProductivityMetricCreate): Promise<ProductivityMetric>;
    batchInsertMetrics(batch: MetricsBatch): Promise<{
        command_executions: number;
        agent_interactions: number;
        user_sessions: number;
        productivity_metrics: number;
    }>;
    getAggregatedMetrics(params: MetricsQueryParams): Promise<AggregatedMetrics[]>;
    getPerformanceMetrics(): Promise<PerformanceMetrics>;
    cleanupOldData(retentionDays: number): Promise<{
        deleted_rows: number;
    }>;
    private getWindowInterval;
    private mapCommandExecution;
    private mapAgentInteraction;
    private mapUserSession;
    private mapProductivityMetric;
    private mapAggregatedMetrics;
}
//# sourceMappingURL=metrics.model.d.ts.map