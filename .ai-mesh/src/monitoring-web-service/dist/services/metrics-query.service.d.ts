import { DatabaseConnection } from '../database/connection';
import { RealTimeProcessorService } from './real-time-processor.service';
import { MetricsQueryParams, AggregatedMetrics, CommandExecution, PerformanceMetrics } from '../types/metrics';
import * as winston from 'winston';
export interface QueryResult<T> {
    data: T[];
    pagination: {
        total_count: number;
        page: number;
        per_page: number;
        total_pages: number;
        has_next: boolean;
        has_previous: boolean;
    };
    query_performance: {
        response_time_ms: number;
        cache_hit: boolean;
        records_scanned: number;
        records_returned: number;
    };
}
interface QueryHints {
    use_real_time_cache: boolean;
    prefer_aggregated_data: boolean;
    max_scan_limit: number;
    timeout_ms: number;
}
export interface DashboardMetrics {
    overview: {
        total_commands: number;
        total_agents_used: number;
        avg_execution_time: number;
        error_rate: number;
        productivity_score?: number;
    };
    trends: AggregatedMetrics[];
    top_commands: Array<{
        command_name: string;
        count: number;
        avg_execution_time: number;
        error_rate: number;
    }>;
    top_agents: Array<{
        agent_name: string;
        usage_count: number;
        avg_execution_time: number;
        success_rate: number;
    }>;
    user_activity: Array<{
        user_id: string;
        command_count: number;
        agent_interactions: number;
        productivity_score?: number;
    }>;
}
export declare class MetricsQueryService {
    private metricsModel;
    private realTimeProcessor?;
    private logger;
    private queryCache;
    private cacheConfig;
    private performanceStats;
    constructor(db: DatabaseConnection, logger: winston.Logger, realTimeProcessor?: RealTimeProcessorService);
    getAggregatedMetrics(organizationId: string, params: Partial<MetricsQueryParams>, hints?: Partial<QueryHints>): Promise<QueryResult<AggregatedMetrics>>;
    getDashboardMetrics(organizationId: string, params: {
        user_id?: string;
        team_id?: string;
        project_id?: string;
        time_range: '1h' | '1d' | '7d' | '30d';
    }): Promise<DashboardMetrics>;
    getCommandExecutions(organizationId: string, params: {
        user_id?: string;
        team_id?: string;
        project_id?: string;
        command_name?: string;
        status?: string;
        start_date: Date;
        end_date: Date;
        limit?: number;
        offset?: number;
    }): Promise<QueryResult<CommandExecution>>;
    getRealTimeMetrics(organizationId: string, window?: '1m' | '5m' | '15m' | '1h', userId?: string): AggregatedMetrics[];
    getQueryPerformanceMetrics(): Promise<PerformanceMetrics>;
    getQueryStats(): {
        cache_hit_rate: number;
        cache_size: number;
        slow_query_rate: number;
        total_queries: number;
        cache_hits: number;
        avg_response_time_ms: number;
        slow_queries: number;
        last_reset: Date;
    };
    private validateAndDefaultParams;
    private generateCacheKey;
    private getCachedResult;
    private setCachedResult;
    private cleanExpiredCache;
    private mergeRealTimeAndHistoricalData;
    private getDateRangeFromTimeRange;
    private getOptimalAggregationWindow;
    private calculateOverviewMetrics;
    private getTopCommands;
    private getTopAgents;
    private getUserActivity;
    private updatePerformanceStats;
    private resetPerformanceStats;
}
export {};
//# sourceMappingURL=metrics-query.service.d.ts.map