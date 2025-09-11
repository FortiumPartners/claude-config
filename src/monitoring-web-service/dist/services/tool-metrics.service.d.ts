import { DatabaseConnection } from '../database/connection';
import { AgentInteractionCreate } from '../types/metrics';
import * as winston from 'winston';
export interface ToolUsageMetrics {
    tool_name: string;
    execution_count: number;
    total_execution_time_ms: number;
    average_execution_time_ms: number;
    min_execution_time_ms: number;
    max_execution_time_ms: number;
    success_count: number;
    error_count: number;
    success_rate: number;
    error_rate: number;
    last_used: Date;
    trend_data: {
        hourly_usage: number[];
        daily_usage: number[];
        performance_trend: 'improving' | 'stable' | 'degrading';
    };
}
export interface ToolPerformanceAlert {
    tool_name: string;
    alert_type: 'high_error_rate' | 'slow_performance' | 'usage_spike' | 'unusual_pattern';
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    threshold_value?: number;
    current_value: number;
    first_detected: Date;
    context?: Record<string, any>;
}
export interface ToolExecutionContext {
    session_id?: string;
    command_execution_id?: string;
    user_id: string;
    team_id?: string;
    project_id?: string;
    tool_name: string;
    tool_version?: string;
    execution_environment?: {
        os: string;
        node_version: string;
        memory_usage_mb: number;
        cpu_usage_percent: number;
    };
    input_parameters?: Record<string, any>;
    output_summary?: {
        success: boolean;
        lines_processed?: number;
        files_affected?: number;
        data_size_bytes?: number;
    };
}
export interface ToolTrendAnalysis {
    tool_name: string;
    period: 'hourly' | 'daily' | 'weekly';
    data_points: {
        timestamp: Date;
        usage_count: number;
        average_duration_ms: number;
        error_rate: number;
    }[];
    trend_direction: 'up' | 'down' | 'stable';
    performance_trend: 'improving' | 'stable' | 'degrading';
    anomalies: {
        timestamp: Date;
        type: 'usage_spike' | 'performance_drop' | 'error_spike';
        severity: number;
    }[];
}
export declare class ToolMetricsService {
    private metricsModel;
    private logger;
    private toolPerformanceCache;
    private performanceThresholds;
    private readonly PERFORMANCE_WINDOW_MS;
    constructor(db: DatabaseConnection, logger: winston.Logger);
    recordToolExecution(organizationId: string, context: ToolExecutionContext, executionTimeMs: number, status: 'success' | 'error' | 'timeout' | 'cancelled', errorMessage?: string): Promise<{
        success: boolean;
        alerts?: ToolPerformanceAlert[];
        message?: string;
    }>;
    recordAgentInteraction(organizationId: string, interactionData: AgentInteractionCreate, context?: {
        input_tokens?: number;
        output_tokens?: number;
        model_used?: string;
        cost_cents?: number;
    }): Promise<{
        success: boolean;
        message?: string;
    }>;
    getToolMetrics(organizationId: string, toolName: string, timeRange: {
        start: Date;
        end: Date;
    }): Promise<ToolUsageMetrics | null>;
    getAllToolMetrics(organizationId: string, timeRange: {
        start: Date;
        end: Date;
    }, limit?: number): Promise<ToolUsageMetrics[]>;
    getToolTrendAnalysis(organizationId: string, toolName: string, period?: 'hourly' | 'daily' | 'weekly', points?: number): Promise<ToolTrendAnalysis | null>;
    getPerformanceAlerts(organizationId: string, severity?: 'low' | 'medium' | 'high' | 'critical'): Promise<ToolPerformanceAlert[]>;
    getToolPerformanceSummary(organizationId: string, timeRange: {
        start: Date;
        end: Date;
    }): Promise<{
        total_executions: number;
        unique_tools: number;
        average_execution_time_ms: number;
        overall_success_rate: number;
        most_used_tools: {
            tool_name: string;
            count: number;
        }[];
        slowest_tools: {
            tool_name: string;
            avg_time_ms: number;
        }[];
        most_error_prone_tools: {
            tool_name: string;
            error_rate: number;
        }[];
    }>;
    private updatePerformanceCache;
    private checkPerformanceAlerts;
    private generateTrendData;
    private detectAnomalies;
    private cleanupPerformanceCache;
}
//# sourceMappingURL=tool-metrics.service.d.ts.map