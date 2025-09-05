/**
 * Metrics Aggregation Service for Dashboard Queries
 * Task 3.4: Optimized aggregation service for sub-second dashboard responses
 */

import { RedisManager } from '../config/redis.config';
import { MetricsModel } from '../models/metrics.model';
import { DatabaseConnection } from '../database/connection';
import {
  MetricsQueryParams,
  AggregatedMetrics,
  ProductivityMetricType,
  PerformanceMetrics
} from '../types/metrics';
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

export class MetricsAggregationService {
  private redisManager: RedisManager;
  private metricsModel: MetricsModel;
  private logger: winston.Logger;
  private config: AggregationConfig;

  // Cache keys for different query types
  private readonly cacheKeys = {
    PRODUCTIVITY_TRENDS: 'productivity_trends',
    TEAM_COMPARISON: 'team_comparison',
    AGENT_USAGE: 'agent_usage',
    REAL_TIME_ACTIVITY: 'real_time_activity',
    CODE_QUALITY: 'code_quality',
    TASK_METRICS: 'task_metrics'
  };

  constructor(
    redisManager: RedisManager,
    db: DatabaseConnection,
    logger: winston.Logger,
    config?: Partial<AggregationConfig>
  ) {
    this.redisManager = redisManager;
    this.metricsModel = new MetricsModel(db);
    this.logger = logger;

    this.config = {
      cacheTimeoutMs: 300000, // 5 minutes default cache
      maxAggregationWindow: '90d',
      defaultPageSize: 50,
      maxPageSize: 1000,
      enableSmartCaching: true,
      ...config
    };
  }

  /**
   * Get productivity trends with time-series data
   */
  async getProductivityTrends(
    organizationId: string,
    params: {
      team_id?: string;
      user_id?: string;
      start_date: Date;
      end_date: Date;
      metric_type?: ProductivityMetricType;
      aggregation_window?: '1h' | '1d' | '1w' | '1m';
      comparison_period?: boolean;
    }
  ): Promise<ProductivityTrendData> {
    const startTime = Date.now();
    
    try {
      // Generate cache key
      const cacheKey = this.generateCacheKey(this.cacheKeys.PRODUCTIVITY_TRENDS, {
        organizationId,
        ...params
      });

      // Try cache first
      if (this.config.enableSmartCaching) {
        const cached = await this.redisManager.getCachedAggregatedMetrics(cacheKey);
        if (cached) {
          this.logger.debug('Retrieved productivity trends from cache', {
            organization_id: organizationId,
            cache_hit: true
          });
          return cached;
        }
      }

      // Query database for time-series data
      const queryParams: MetricsQueryParams = {
        organization_id: organizationId,
        team_id: params.team_id,
        user_id: params.user_id,
        start_date: params.start_date,
        end_date: params.end_date,
        metric_types: params.metric_type ? [params.metric_type] : undefined,
        aggregation_window: params.aggregation_window || '1d'
      };

      const timeSeriesData = await this.metricsModel.getTimeSeriesMetrics(queryParams);
      
      // Calculate comparison period data if requested
      let comparisonData: any[] = [];
      if (params.comparison_period) {
        const duration = params.end_date.getTime() - params.start_date.getTime();
        const comparisonStart = new Date(params.start_date.getTime() - duration);
        const comparisonEnd = new Date(params.start_date.getTime());

        const comparisonParams = {
          ...queryParams,
          start_date: comparisonStart,
          end_date: comparisonEnd
        };

        comparisonData = await this.metricsModel.getTimeSeriesMetrics(comparisonParams);
      }

      // Process and calculate trends
      const result = this.processProductivityTrends(timeSeriesData, comparisonData, params);

      // Cache the result
      if (this.config.enableSmartCaching) {
        const cacheTimeout = this.calculateCacheTimeout(params.start_date, params.end_date);
        await this.redisManager.cacheAggregatedMetrics(cacheKey, result, cacheTimeout);
      }

      const processingTime = Date.now() - startTime;
      this.logger.info('Generated productivity trends', {
        organization_id: organizationId,
        processing_time_ms: processingTime,
        data_points: result.time_series.length,
        cache_hit: false
      });

      return result;

    } catch (error) {
      this.logger.error('Failed to get productivity trends', {
        organization_id: organizationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get team performance comparison data
   */
  async getTeamComparison(
    organizationId: string,
    params: {
      team_ids?: string[];
      metric_types: ProductivityMetricType[];
      start_date: Date;
      end_date: Date;
      aggregation_window?: '1d' | '1w' | '1m';
    }
  ): Promise<TeamComparisonData> {
    const startTime = Date.now();
    
    try {
      const cacheKey = this.generateCacheKey(this.cacheKeys.TEAM_COMPARISON, {
        organizationId,
        ...params
      });

      // Try cache first
      if (this.config.enableSmartCaching) {
        const cached = await this.redisManager.getCachedAggregatedMetrics(cacheKey);
        if (cached) {
          return cached;
        }
      }

      // Get team metrics
      const teamMetrics = await this.metricsModel.getTeamMetrics({
        organization_id: organizationId,
        team_ids: params.team_ids,
        start_date: params.start_date,
        end_date: params.end_date,
        metric_types: params.metric_types,
        aggregation_window: params.aggregation_window || '1d'
      });

      // Get team metadata
      const teamInfo = await this.metricsModel.getTeamInfo(organizationId, params.team_ids);

      // Process comparison data
      const result = this.processTeamComparison(teamMetrics, teamInfo, params.metric_types);

      // Cache the result
      if (this.config.enableSmartCaching) {
        const cacheTimeout = this.calculateCacheTimeout(params.start_date, params.end_date);
        await this.redisManager.cacheAggregatedMetrics(cacheKey, result, cacheTimeout);
      }

      const processingTime = Date.now() - startTime;
      this.logger.info('Generated team comparison', {
        organization_id: organizationId,
        processing_time_ms: processingTime,
        team_count: result.teams.length,
        cache_hit: false
      });

      return result;

    } catch (error) {
      this.logger.error('Failed to get team comparison', {
        organization_id: organizationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get agent usage statistics and trends
   */
  async getAgentUsage(
    organizationId: string,
    params: {
      agent_names?: string[];
      team_id?: string;
      user_id?: string;
      start_date: Date;
      end_date: Date;
      include_trends?: boolean;
    }
  ): Promise<AgentUsageData> {
    const startTime = Date.now();
    
    try {
      const cacheKey = this.generateCacheKey(this.cacheKeys.AGENT_USAGE, {
        organizationId,
        ...params
      });

      // Try cache first
      if (this.config.enableSmartCaching) {
        const cached = await this.redisManager.getCachedAggregatedMetrics(cacheKey);
        if (cached) {
          return cached;
        }
      }

      // Get agent usage data
      const agentMetrics = await this.metricsModel.getAgentUsageMetrics({
        organization_id: organizationId,
        agent_names: params.agent_names,
        team_id: params.team_id,
        user_id: params.user_id,
        start_date: params.start_date,
        end_date: params.end_date
      });

      // Get trend data if requested
      let trendData: any[] = [];
      if (params.include_trends) {
        const duration = params.end_date.getTime() - params.start_date.getTime();
        const trendStart = new Date(params.start_date.getTime() - duration);
        
        trendData = await this.metricsModel.getAgentUsageMetrics({
          organization_id: organizationId,
          agent_names: params.agent_names,
          start_date: trendStart,
          end_date: params.start_date
        });
      }

      // Process agent usage data
      const result = this.processAgentUsage(agentMetrics, trendData);

      // Cache the result
      if (this.config.enableSmartCaching) {
        const cacheTimeout = this.calculateCacheTimeout(params.start_date, params.end_date);
        await this.redisManager.cacheAggregatedMetrics(cacheKey, result, cacheTimeout);
      }

      const processingTime = Date.now() - startTime;
      this.logger.info('Generated agent usage stats', {
        organization_id: organizationId,
        processing_time_ms: processingTime,
        agent_count: result.agent_stats.length,
        cache_hit: false
      });

      return result;

    } catch (error) {
      this.logger.error('Failed to get agent usage', {
        organization_id: organizationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get real-time activity data for live dashboards
   */
  async getRealTimeActivity(organizationId: string): Promise<RealTimeActivityData> {
    const startTime = Date.now();
    
    try {
      // For real-time data, use shorter cache with frequent updates
      const cacheKey = `${this.cacheKeys.REAL_TIME_ACTIVITY}:${organizationId}`;
      
      const cached = await this.redisManager.getCachedMetrics(cacheKey);
      if (cached && (Date.now() - new Date(cached.last_updated).getTime() < 30000)) { // 30 second cache
        return cached;
      }

      // Get current live metrics
      const liveMetrics = await this.metricsModel.getLiveMetrics(organizationId);
      
      // Get recent activity (last 1 hour)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentActivity = await this.metricsModel.getRecentActivity(organizationId, oneHourAgo);

      // Calculate performance indicators
      const performanceIndicators = this.calculatePerformanceIndicators(liveMetrics);

      const result: RealTimeActivityData = {
        live_metrics: {
          active_users: liveMetrics.active_users,
          commands_per_minute: liveMetrics.commands_per_minute,
          avg_response_time: liveMetrics.avg_response_time,
          error_rate: liveMetrics.error_rate,
          last_updated: new Date()
        },
        recent_activity: recentActivity.slice(0, 50), // Limit to 50 recent activities
        performance_indicators: performanceIndicators
      };

      // Cache with short TTL for real-time data
      await this.redisManager.cacheMetrics(cacheKey, result, 30); // 30 seconds

      const processingTime = Date.now() - startTime;
      this.logger.debug('Generated real-time activity data', {
        organization_id: organizationId,
        processing_time_ms: processingTime,
        active_users: result.live_metrics.active_users
      });

      return result;

    } catch (error) {
      this.logger.error('Failed to get real-time activity', {
        organization_id: organizationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get code quality metrics and trends
   */
  async getCodeQualityMetrics(
    organizationId: string,
    params: {
      team_id?: string;
      user_id?: string;
      project_id?: string;
      start_date: Date;
      end_date: Date;
    }
  ): Promise<any> {
    const startTime = Date.now();
    
    try {
      const cacheKey = this.generateCacheKey(this.cacheKeys.CODE_QUALITY, {
        organizationId,
        ...params
      });

      if (this.config.enableSmartCaching) {
        const cached = await this.redisManager.getCachedAggregatedMetrics(cacheKey);
        if (cached) {
          return cached;
        }
      }

      // Get code quality metrics
      const qualityMetrics = await this.metricsModel.getCodeQualityMetrics({
        organization_id: organizationId,
        team_id: params.team_id,
        user_id: params.user_id,
        project_id: params.project_id,
        start_date: params.start_date,
        end_date: params.end_date
      });

      const result = this.processCodeQualityMetrics(qualityMetrics);

      if (this.config.enableSmartCaching) {
        const cacheTimeout = this.calculateCacheTimeout(params.start_date, params.end_date);
        await this.redisManager.cacheAggregatedMetrics(cacheKey, result, cacheTimeout);
      }

      const processingTime = Date.now() - startTime;
      this.logger.info('Generated code quality metrics', {
        organization_id: organizationId,
        processing_time_ms: processingTime
      });

      return result;

    } catch (error) {
      this.logger.error('Failed to get code quality metrics', {
        organization_id: organizationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get task and sprint progress metrics
   */
  async getTaskMetrics(
    organizationId: string,
    params: {
      team_id?: string;
      project_id?: string;
      sprint_id?: string;
      start_date: Date;
      end_date: Date;
    }
  ): Promise<any> {
    const startTime = Date.now();
    
    try {
      const cacheKey = this.generateCacheKey(this.cacheKeys.TASK_METRICS, {
        organizationId,
        ...params
      });

      if (this.config.enableSmartCaching) {
        const cached = await this.redisManager.getCachedAggregatedMetrics(cacheKey);
        if (cached) {
          return cached;
        }
      }

      // Get task completion metrics
      const taskMetrics = await this.metricsModel.getTaskMetrics({
        organization_id: organizationId,
        team_id: params.team_id,
        project_id: params.project_id,
        sprint_id: params.sprint_id,
        start_date: params.start_date,
        end_date: params.end_date
      });

      const result = this.processTaskMetrics(taskMetrics);

      if (this.config.enableSmartCaching) {
        const cacheTimeout = this.calculateCacheTimeout(params.start_date, params.end_date);
        await this.redisManager.cacheAggregatedMetrics(cacheKey, result, cacheTimeout);
      }

      const processingTime = Date.now() - startTime;
      this.logger.info('Generated task metrics', {
        organization_id: organizationId,
        processing_time_ms: processingTime
      });

      return result;

    } catch (error) {
      this.logger.error('Failed to get task metrics', {
        organization_id: organizationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Process productivity trends data
   */
  private processProductivityTrends(
    timeSeriesData: any[],
    comparisonData: any[],
    params: any
  ): ProductivityTrendData {
    // Calculate time series with change percentages
    const timeSeries = timeSeriesData.map((point, index) => {
      let changePercentage: number | undefined;
      
      if (index > 0) {
        const prevValue = timeSeriesData[index - 1].value;
        if (prevValue > 0) {
          changePercentage = ((point.value - prevValue) / prevValue) * 100;
        }
      }

      return {
        timestamp: new Date(point.timestamp),
        value: point.value,
        change_percentage: changePercentage
      };
    });

    // Calculate summary
    const currentValue = timeSeries.length > 0 ? timeSeries[timeSeries.length - 1].value : 0;
    let previousValue = 0;
    let trend: 'up' | 'down' | 'stable' = 'stable';
    let changePercentage = 0;

    if (comparisonData.length > 0) {
      previousValue = comparisonData[comparisonData.length - 1]?.value || 0;
      if (previousValue > 0) {
        changePercentage = ((currentValue - previousValue) / previousValue) * 100;
        trend = changePercentage > 2 ? 'up' : changePercentage < -2 ? 'down' : 'stable';
      }
    } else if (timeSeries.length > 1) {
      previousValue = timeSeries[0].value;
      if (previousValue > 0) {
        changePercentage = ((currentValue - previousValue) / previousValue) * 100;
        trend = changePercentage > 2 ? 'up' : changePercentage < -2 ? 'down' : 'stable';
      }
    }

    return {
      time_series: timeSeries,
      summary: {
        current_value: currentValue,
        previous_value: previousValue,
        trend,
        change_percentage: Math.round(changePercentage * 100) / 100
      },
      metadata: {
        data_points: timeSeries.length,
        time_range: `${params.start_date.toISOString().split('T')[0]} to ${params.end_date.toISOString().split('T')[0]}`,
        aggregation_window: params.aggregation_window || '1d'
      }
    };
  }

  /**
   * Process team comparison data
   */
  private processTeamComparison(
    teamMetrics: any[],
    teamInfo: any[],
    metricTypes: ProductivityMetricType[]
  ): TeamComparisonData {
    // Calculate team rankings
    const teams = teamMetrics.map(team => {
      const metrics: Record<string, number> = {};
      
      metricTypes.forEach(metricType => {
        metrics[metricType] = team.metrics[metricType] || 0;
      });

      return {
        team_id: team.team_id,
        team_name: teamInfo.find(info => info.team_id === team.team_id)?.name || 'Unknown Team',
        metrics,
        rank: 0, // Will be calculated below
        percentile: 0 // Will be calculated below
      };
    });

    // Calculate rankings for each metric and overall
    const primaryMetric = metricTypes[0];
    teams.sort((a, b) => (b.metrics[primaryMetric] || 0) - (a.metrics[primaryMetric] || 0));
    
    teams.forEach((team, index) => {
      team.rank = index + 1;
      team.percentile = Math.round(((teams.length - index) / teams.length) * 100);
    });

    // Calculate organization summary
    const totalProductivity = teams.reduce((sum, team) => sum + (team.metrics[primaryMetric] || 0), 0);
    const avgProductivity = teams.length > 0 ? totalProductivity / teams.length : 0;

    return {
      teams,
      organization_summary: {
        total_teams: teams.length,
        avg_productivity: Math.round(avgProductivity * 100) / 100,
        top_performer: teams.length > 0 ? teams[0].team_name : 'N/A',
        bottom_performer: teams.length > 0 ? teams[teams.length - 1].team_name : 'N/A'
      }
    };
  }

  /**
   * Process agent usage data
   */
  private processAgentUsage(agentMetrics: any[], trendData: any[]): AgentUsageData {
    // Process current period stats
    const agentStats = agentMetrics.map((agent, index) => ({
      agent_name: agent.agent_name,
      usage_count: agent.usage_count,
      avg_execution_time: agent.avg_execution_time,
      success_rate: agent.success_rate,
      popularity_rank: index + 1,
      efficiency_score: this.calculateEfficiencyScore(agent)
    }));

    // Sort by different criteria for trends
    const mostUsed = [...agentStats].sort((a, b) => b.usage_count - a.usage_count)[0]?.agent_name || 'N/A';
    const fastest = [...agentStats].sort((a, b) => a.avg_execution_time - b.avg_execution_time)[0]?.agent_name || 'N/A';
    const mostReliable = [...agentStats].sort((a, b) => b.success_rate - a.success_rate)[0]?.agent_name || 'N/A';

    // Calculate trending agents if trend data available
    const trendingUp: string[] = [];
    const trendingDown: string[] = [];

    if (trendData.length > 0) {
      agentMetrics.forEach(currentAgent => {
        const previousAgent = trendData.find(t => t.agent_name === currentAgent.agent_name);
        if (previousAgent && previousAgent.usage_count > 0) {
          const growthRate = (currentAgent.usage_count - previousAgent.usage_count) / previousAgent.usage_count;
          if (growthRate > 0.2) { // 20% growth
            trendingUp.push(currentAgent.agent_name);
          } else if (growthRate < -0.2) { // 20% decline
            trendingDown.push(currentAgent.agent_name);
          }
        }
      });
    }

    return {
      agent_stats: agentStats,
      trends: {
        most_used: mostUsed,
        fastest: fastest,
        most_reliable: mostReliable,
        trending_up: trendingUp,
        trending_down: trendingDown
      }
    };
  }

  /**
   * Calculate performance indicators from live metrics
   */
  private calculatePerformanceIndicators(liveMetrics: any): any {
    const systemHealth = liveMetrics.error_rate < 0.05 && liveMetrics.avg_response_time < 2000 ? 
      'excellent' : liveMetrics.error_rate < 0.1 && liveMetrics.avg_response_time < 5000 ? 
      'good' : liveMetrics.error_rate < 0.2 ? 'fair' : 'poor';

    const throughputStatus = liveMetrics.commands_per_minute > 100 ? 'high' : 
                           liveMetrics.commands_per_minute > 50 ? 'normal' : 'low';

    const responseTimeStatus = liveMetrics.avg_response_time < 1000 ? 'fast' : 
                              liveMetrics.avg_response_time < 3000 ? 'normal' : 'slow';

    return {
      system_health: systemHealth,
      throughput_status: throughputStatus,
      response_time_status: responseTimeStatus
    };
  }

  /**
   * Process code quality metrics
   */
  private processCodeQualityMetrics(qualityMetrics: any): any {
    // Implementation depends on specific code quality metrics collected
    return {
      overall_score: qualityMetrics.overall_score || 0,
      trends: qualityMetrics.trends || [],
      breakdown: qualityMetrics.breakdown || {}
    };
  }

  /**
   * Process task metrics
   */
  private processTaskMetrics(taskMetrics: any): any {
    // Implementation depends on specific task metrics collected
    return {
      completion_rate: taskMetrics.completion_rate || 0,
      velocity: taskMetrics.velocity || 0,
      cycle_time: taskMetrics.cycle_time || 0,
      burndown: taskMetrics.burndown || []
    };
  }

  /**
   * Helper methods
   */
  private generateCacheKey(baseKey: string, params: any): string {
    const paramString = Object.keys(params)
      .sort()
      .map(key => `${key}:${params[key]}`)
      .join('|');
    
    return `${baseKey}:${Buffer.from(paramString).toString('base64')}`;
  }

  private calculateCacheTimeout(startDate: Date, endDate: Date): number {
    const now = new Date();
    const isHistoricalData = endDate < new Date(now.getTime() - 24 * 60 * 60 * 1000); // Older than 1 day
    
    if (isHistoricalData) {
      return 3600; // 1 hour for historical data
    } else {
      return 300; // 5 minutes for recent data
    }
  }

  private calculateEfficiencyScore(agent: any): number {
    // Combine success rate and execution time into efficiency score
    const successWeight = 0.6;
    const speedWeight = 0.4;
    
    const successScore = agent.success_rate * 100;
    const speedScore = Math.max(0, 100 - (agent.avg_execution_time / 1000) * 10); // Penalize slow execution
    
    return Math.round((successScore * successWeight + speedScore * speedWeight) * 100) / 100;
  }

  /**
   * Get service performance metrics
   */
  async getServicePerformance(): Promise<PerformanceMetrics> {
    try {
      const redisHealth = await this.redisManager.healthCheck();
      const dbHealth = await this.metricsModel.getPerformanceMetrics();
      
      return {
        ...dbHealth,
        query_response_time_ms: 0, // Would be calculated from actual query times
        memory_usage_mb: 0, // Would get from process.memoryUsage()
        cpu_usage_percent: 0, // Would get from system metrics
        active_connections: redisHealth.status === 'healthy' ? 1 : 0,
        processing_latency_ms: 0, // Average query processing time
        ingestion_rate: 0 // Not applicable for aggregation service
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Health check for aggregation service
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> {
    try {
      const redisHealth = await this.redisManager.healthCheck();
      const dbHealth = await this.metricsModel.healthCheck();
      
      const isHealthy = redisHealth.status === 'healthy' && dbHealth.status === 'healthy';
      
      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        details: {
          redis: redisHealth,
          database: dbHealth,
          cache_enabled: this.config.enableSmartCaching,
          cache_timeout_ms: this.config.cacheTimeoutMs
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }
}