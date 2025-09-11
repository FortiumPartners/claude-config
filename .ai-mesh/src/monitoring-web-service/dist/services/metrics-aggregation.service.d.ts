import { RedisManager } from '../config/redis.config';
import { DatabaseConnection } from '../database/connection';
import { ProductivityMetricType, PerformanceMetrics } from '../types/metrics';
import * as winston from 'winston';
export interface AggregationConfig {
    cacheTimeoutMs: number;
    maxAggregationWindow: string;
    defaultPageSize: number;
    maxPageSize: number;
    enableSmartCaching: boolean;
}
export interface ProductivityTrendData {
    time_series: Array<{
        timestamp: Date;
        value: number;
        change_percentage?: number;
    }>;
    summary: {
        current_value: number;
        previous_value: number;
        trend: 'up' | 'down' | 'stable';
        change_percentage: number;
    };
    metadata: {
        data_points: number;
        time_range: string;
        aggregation_window: string;
    };
}
export interface TeamComparisonData {
    teams: Array<{
        team_id: string;
        team_name: string;
        metrics: Record<string, number>;
        rank: number;
        percentile: number;
    }>;
    organization_summary: {
        total_teams: number;
        avg_productivity: number;
        top_performer: string;
        bottom_performer: string;
    };
}
export interface AgentUsageData {
    agent_stats: Array<{
        agent_name: string;
        usage_count: number;
        avg_execution_time: number;
        success_rate: number;
        popularity_rank: number;
        efficiency_score: number;
    }>;
    trends: {
        most_used: string;
        fastest: string;
        most_reliable: string;
        trending_up: string[];
        trending_down: string[];
    };
}
export interface RealTimeActivityData {
    live_metrics: {
        active_users: number;
        commands_per_minute: number;
        avg_response_time: number;
        error_rate: number;
        last_updated: Date;
    };
    recent_activity: Array<{
        user_id: string;
        action: string;
        timestamp: Date;
        duration_ms?: number;
        status: 'success' | 'error';
    }>;
    performance_indicators: {
        system_health: 'excellent' | 'good' | 'fair' | 'poor';
        throughput_status: 'high' | 'normal' | 'low';
        response_time_status: 'fast' | 'normal' | 'slow';
    };
}
export declare class MetricsAggregationService {
    private redisManager;
    private metricsModel;
    private logger;
    private config;
    private readonly cacheKeys;
    constructor(redisManager: RedisManager, db: DatabaseConnection, logger: winston.Logger, config?: Partial<AggregationConfig>);
    getProductivityTrends(organizationId: string, params: {
        team_id?: string;
        user_id?: string;
        start_date: Date;
        end_date: Date;
        metric_type?: ProductivityMetricType;
        aggregation_window?: '1h' | '1d' | '1w' | '1m';
        comparison_period?: boolean;
    }): Promise<ProductivityTrendData>;
    getTeamComparison(organizationId: string, params: {
        team_ids?: string[];
        metric_types: ProductivityMetricType[];
        start_date: Date;
        end_date: Date;
        aggregation_window?: '1d' | '1w' | '1m';
    }): Promise<TeamComparisonData>;
    getAgentUsage(organizationId: string, params: {
        agent_names?: string[];
        team_id?: string;
        user_id?: string;
        start_date: Date;
        end_date: Date;
        include_trends?: boolean;
    }): Promise<AgentUsageData>;
    getRealTimeActivity(organizationId: string): Promise<RealTimeActivityData>;
    getCodeQualityMetrics(organizationId: string, params: {
        team_id?: string;
        user_id?: string;
        project_id?: string;
        start_date: Date;
        end_date: Date;
    }): Promise<any>;
    getTaskMetrics(organizationId: string, params: {
        team_id?: string;
        project_id?: string;
        sprint_id?: string;
        start_date: Date;
        end_date: Date;
    }): Promise<any>;
    private processProductivityTrends;
    private processTeamComparison;
    private processAgentUsage;
    private calculatePerformanceIndicators;
    private processCodeQualityMetrics;
    private processTaskMetrics;
    private generateCacheKey;
    private calculateCacheTimeout;
    private calculateEfficiencyScore;
    getServicePerformance(): Promise<PerformanceMetrics>;
    healthCheck(): Promise<{
        status: 'healthy' | 'unhealthy';
        details: any;
    }>;
}
//# sourceMappingURL=metrics-aggregation.service.d.ts.map