/**
 * Metrics Query and Aggregation Service
 * Task 3.4: Efficient query service with pagination and caching
 */

import { MetricsModel } from '../models/metrics.model';
import { DatabaseConnection } from '../database/connection';
import { RealTimeProcessorService } from './real-time-processor.service';
import {
  MetricsQueryParams,
  AggregatedMetrics,
  CommandExecution,
  AgentInteraction,
  UserSession,
  ProductivityMetric,
  ProductivityMetricType,
  PerformanceMetrics
} from '../types/metrics';
import { validateMetricsQuery, validateDateRange } from '../validation/metrics.validation';
import * as winston from 'winston';

// Query result with pagination info
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

// Cache entry structure
interface CacheEntry {
  data: any;
  timestamp: Date;
  ttl_seconds: number;
  query_hash: string;
}

// Query optimization hints
interface QueryHints {
  use_real_time_cache: boolean;
  prefer_aggregated_data: boolean;
  max_scan_limit: number;
  timeout_ms: number;
}

// Dashboard-specific query results
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

export class MetricsQueryService {
  private metricsModel: MetricsModel;
  private realTimeProcessor?: RealTimeProcessorService;
  private logger: winston.Logger;
  
  // In-memory cache for frequently accessed queries
  private queryCache: Map<string, CacheEntry> = new Map();
  
  // Cache configuration
  private cacheConfig = {
    default_ttl_seconds: 300, // 5 minutes
    max_cache_size: 10000,
    dashboard_ttl_seconds: 60, // 1 minute for dashboards
    aggregation_ttl_seconds: 600, // 10 minutes for aggregations
  };

  // Query performance tracking
  private performanceStats = {
    total_queries: 0,
    cache_hits: 0,
    avg_response_time_ms: 0,
    slow_queries: 0, // Queries > 1000ms
    last_reset: new Date()
  };

  constructor(
    db: DatabaseConnection,
    logger: winston.Logger,
    realTimeProcessor?: RealTimeProcessorService
  ) {
    this.metricsModel = new MetricsModel(db);
    this.realTimeProcessor = realTimeProcessor;
    this.logger = logger;

    // Clean cache every 10 minutes
    setInterval(() => this.cleanExpiredCache(), 10 * 60 * 1000);
    
    // Reset performance stats every hour
    setInterval(() => this.resetPerformanceStats(), 60 * 60 * 1000);
  }

  /**
   * Get aggregated metrics with efficient pagination
   */
  async getAggregatedMetrics(
    organizationId: string,
    params: Partial<MetricsQueryParams>,
    hints: Partial<QueryHints> = {}
  ): Promise<QueryResult<AggregatedMetrics>> {
    const startTime = Date.now();
    let cacheHit = false;
    
    try {
      // Validate and set defaults
      const validatedParams = this.validateAndDefaultParams(organizationId, params);
      const queryHints = { 
        use_real_time_cache: true,
        prefer_aggregated_data: true,
        max_scan_limit: 100000,
        timeout_ms: 5000,
        ...hints 
      };

      // Check cache first
      const cacheKey = this.generateCacheKey('aggregated_metrics', validatedParams);
      const cachedResult = this.getCachedResult(cacheKey);
      
      if (cachedResult) {
        cacheHit = true;
        const responseTime = Date.now() - startTime;
        this.updatePerformanceStats(responseTime, true);
        
        return {
          ...cachedResult,
          query_performance: {
            response_time_ms: responseTime,
            cache_hit: true,
            records_scanned: 0,
            records_returned: cachedResult.data.length
          }
        };
      }

      // Check if we can use real-time cache for recent data
      let realTimeData: AggregatedMetrics[] = [];
      if (queryHints.use_real_time_cache && this.realTimeProcessor) {
        const now = new Date();
        const recentThreshold = new Date(now.getTime() - (60 * 60 * 1000)); // Last hour
        
        if (validatedParams.end_date >= recentThreshold) {
          realTimeData = this.realTimeProcessor.getCurrentAggregations(
            organizationId,
            validatedParams.aggregation_window,
            validatedParams.user_id
          );
        }
      }

      // Query database for historical data
      const dbData = await this.metricsModel.getAggregatedMetrics(validatedParams);
      
      // Merge real-time and historical data
      const allData = this.mergeRealTimeAndHistoricalData(realTimeData, dbData);
      
      // Apply pagination
      const page = Math.floor((validatedParams.offset || 0) / (validatedParams.limit || 1000)) + 1;
      const perPage = validatedParams.limit || 1000;
      const totalCount = allData.length;
      const totalPages = Math.ceil(totalCount / perPage);
      
      const startIndex = (page - 1) * perPage;
      const endIndex = Math.min(startIndex + perPage, totalCount);
      const paginatedData = allData.slice(startIndex, endIndex);

      const result: QueryResult<AggregatedMetrics> = {
        data: paginatedData,
        pagination: {
          total_count: totalCount,
          page,
          per_page: perPage,
          total_pages: totalPages,
          has_next: page < totalPages,
          has_previous: page > 1
        },
        query_performance: {
          response_time_ms: Date.now() - startTime,
          cache_hit: false,
          records_scanned: dbData.length,
          records_returned: paginatedData.length
        }
      };

      // Cache the result
      this.setCachedResult(cacheKey, result, this.cacheConfig.aggregation_ttl_seconds);
      
      const responseTime = Date.now() - startTime;
      this.updatePerformanceStats(responseTime, cacheHit);

      // Log slow queries
      if (responseTime > 1000) {
        this.logger.warn('Slow aggregated metrics query', {
          organization_id: organizationId,
          response_time_ms: responseTime,
          records_scanned: dbData.length,
          params: validatedParams
        });
      }

      return result;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updatePerformanceStats(responseTime, cacheHit, false);

      this.logger.error('Failed to get aggregated metrics', {
        organization_id: organizationId,
        error: error instanceof Error ? error.message : 'Unknown error',
        response_time_ms: responseTime
      });

      throw error;
    }
  }

  /**
   * Get dashboard metrics optimized for real-time updates
   */
  async getDashboardMetrics(
    organizationId: string,
    params: {
      user_id?: string;
      team_id?: string;
      project_id?: string;
      time_range: '1h' | '1d' | '7d' | '30d';
    }
  ): Promise<DashboardMetrics> {
    const startTime = Date.now();
    let cacheHit = false;

    try {
      // Check cache first
      const cacheKey = this.generateCacheKey('dashboard_metrics', { organizationId, ...params });
      const cachedResult = this.getCachedResult(cacheKey);
      
      if (cachedResult) {
        cacheHit = true;
        this.updatePerformanceStats(Date.now() - startTime, true);
        return cachedResult;
      }

      // Calculate date range
      const dateRange = this.getDateRangeFromTimeRange(params.time_range);
      const aggregationWindow = this.getOptimalAggregationWindow(params.time_range);

      // Build parallel queries for dashboard components
      const [
        aggregatedMetrics,
        commandStats,
        agentStats,
        userActivity
      ] = await Promise.all([
        // Get trend data
        this.getAggregatedMetrics(organizationId, {
          user_id: params.user_id,
          team_id: params.team_id,
          project_id: params.project_id,
          start_date: dateRange.start,
          end_date: dateRange.end,
          aggregation_window: aggregationWindow,
          limit: 100
        }),

        // Get top commands
        this.getTopCommands(organizationId, dateRange, params),

        // Get top agents
        this.getTopAgents(organizationId, dateRange, params),

        // Get user activity
        this.getUserActivity(organizationId, dateRange, params)
      ]);

      // Calculate overview metrics
      const overview = this.calculateOverviewMetrics(aggregatedMetrics.data);

      const dashboardMetrics: DashboardMetrics = {
        overview,
        trends: aggregatedMetrics.data,
        top_commands: commandStats,
        top_agents: agentStats,
        user_activity: userActivity
      };

      // Cache the result with shorter TTL for dashboards
      this.setCachedResult(cacheKey, dashboardMetrics, this.cacheConfig.dashboard_ttl_seconds);
      
      const responseTime = Date.now() - startTime;
      this.updatePerformanceStats(responseTime, false);

      this.logger.info('Dashboard metrics generated', {
        organization_id: organizationId,
        response_time_ms: responseTime,
        time_range: params.time_range
      });

      return dashboardMetrics;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updatePerformanceStats(responseTime, cacheHit, false);

      this.logger.error('Failed to get dashboard metrics', {
        organization_id: organizationId,
        error: error instanceof Error ? error.message : 'Unknown error',
        response_time_ms: responseTime
      });

      throw error;
    }
  }

  /**
   * Get command executions with efficient pagination
   */
  async getCommandExecutions(
    organizationId: string,
    params: {
      user_id?: string;
      team_id?: string;
      project_id?: string;
      command_name?: string;
      status?: string;
      start_date: Date;
      end_date: Date;
      limit?: number;
      offset?: number;
    }
  ): Promise<QueryResult<CommandExecution>> {
    const startTime = Date.now();
    
    try {
      // Validate date range
      validateDateRange(params.start_date, params.end_date);
      
      const limit = Math.min(params.limit || 1000, 10000); // Max 10k records
      const offset = params.offset || 0;

      // Build optimized query
      let whereConditions = ['organization_id = $1'];
      let queryParams: any[] = [organizationId, params.start_date, params.end_date];
      let paramIndex = 4;

      if (params.user_id) {
        whereConditions.push(`user_id = $${paramIndex++}`);
        queryParams.push(params.user_id);
      }

      if (params.team_id) {
        whereConditions.push(`team_id = $${paramIndex++}`);
        queryParams.push(params.team_id);
      }

      if (params.project_id) {
        whereConditions.push(`project_id = $${paramIndex++}`);
        queryParams.push(params.project_id);
      }

      if (params.command_name) {
        whereConditions.push(`command_name = $${paramIndex++}`);
        queryParams.push(params.command_name);
      }

      if (params.status) {
        whereConditions.push(`status = $${paramIndex++}`);
        queryParams.push(params.status);
      }

      // Get total count for pagination
      const countQuery = `
        SELECT COUNT(*) as total_count
        FROM command_executions 
        WHERE ${whereConditions.join(' AND ')}
          AND executed_at >= $2 
          AND executed_at <= $3
      `;

      const countResult = await this.metricsModel['db'].query(countQuery, queryParams);
      const totalCount = parseInt(countResult.rows[0].total_count);

      // Get paginated data
      const dataQuery = `
        SELECT *
        FROM command_executions 
        WHERE ${whereConditions.join(' AND ')}
          AND executed_at >= $2 
          AND executed_at <= $3
        ORDER BY executed_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      queryParams.push(limit, offset);
      const dataResult = await this.metricsModel['db'].query(dataQuery, queryParams);

      // Calculate pagination info
      const page = Math.floor(offset / limit) + 1;
      const totalPages = Math.ceil(totalCount / limit);

      const result: QueryResult<CommandExecution> = {
        data: dataResult.rows.map((row: any) => this.metricsModel['mapCommandExecution'](row)),
        pagination: {
          total_count: totalCount,
          page,
          per_page: limit,
          total_pages: totalPages,
          has_next: page < totalPages,
          has_previous: page > 1
        },
        query_performance: {
          response_time_ms: Date.now() - startTime,
          cache_hit: false,
          records_scanned: totalCount,
          records_returned: dataResult.rows.length
        }
      };

      const responseTime = Date.now() - startTime;
      this.updatePerformanceStats(responseTime, false);

      return result;

    } catch (error) {
      this.logger.error('Failed to get command executions', {
        organization_id: organizationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get real-time metrics for live dashboards
   */
  getRealTimeMetrics(
    organizationId: string,
    window: '1m' | '5m' | '15m' | '1h' = '5m',
    userId?: string
  ): AggregatedMetrics[] {
    if (!this.realTimeProcessor) {
      throw new Error('Real-time processor not available');
    }

    return this.realTimeProcessor.getCurrentAggregations(organizationId, window, userId);
  }

  /**
   * Performance monitoring and health checks
   */
  async getQueryPerformanceMetrics(): Promise<PerformanceMetrics> {
    const dbMetrics = await this.metricsModel.getPerformanceMetrics();
    
    return {
      ...dbMetrics,
      query_response_time_ms: this.performanceStats.avg_response_time_ms,
      memory_usage_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
    };
  }

  getQueryStats() {
    const cacheHitRate = this.performanceStats.total_queries > 0 ? 
      this.performanceStats.cache_hits / this.performanceStats.total_queries : 0;

    return {
      ...this.performanceStats,
      cache_hit_rate: cacheHitRate,
      cache_size: this.queryCache.size,
      slow_query_rate: this.performanceStats.total_queries > 0 ?
        this.performanceStats.slow_queries / this.performanceStats.total_queries : 0
    };
  }

  /**
   * Private helper methods
   */
  private validateAndDefaultParams(
    organizationId: string,
    params: Partial<MetricsQueryParams>
  ): MetricsQueryParams {
    // Set defaults if not provided
    const defaultParams = {
      organization_id: organizationId,
      start_date: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
      end_date: new Date(),
      limit: 1000,
      offset: 0,
      aggregation_window: '1h' as const,
      ...params
    };

    return validateMetricsQuery(defaultParams);
  }

  private generateCacheKey(type: string, params: any): string {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((sorted: any, key) => {
        sorted[key] = params[key];
        return sorted;
      }, {});
    
    return `${type}:${JSON.stringify(sortedParams)}`;
  }

  private getCachedResult(cacheKey: string): any {
    const entry = this.queryCache.get(cacheKey);
    
    if (!entry) return null;
    
    const now = new Date();
    if (now.getTime() - entry.timestamp.getTime() > entry.ttl_seconds * 1000) {
      this.queryCache.delete(cacheKey);
      return null;
    }
    
    return entry.data;
  }

  private setCachedResult(cacheKey: string, data: any, ttlSeconds: number): void {
    if (this.queryCache.size >= this.cacheConfig.max_cache_size) {
      // Remove oldest entries
      const entries = Array.from(this.queryCache.entries());
      entries
        .sort((a, b) => a[1].timestamp.getTime() - b[1].timestamp.getTime())
        .slice(0, Math.floor(this.cacheConfig.max_cache_size * 0.1))
        .forEach(([key]) => this.queryCache.delete(key));
    }

    this.queryCache.set(cacheKey, {
      data,
      timestamp: new Date(),
      ttl_seconds: ttlSeconds,
      query_hash: cacheKey
    });
  }

  private cleanExpiredCache(): void {
    const now = new Date();
    
    for (const [key, entry] of this.queryCache) {
      if (now.getTime() - entry.timestamp.getTime() > entry.ttl_seconds * 1000) {
        this.queryCache.delete(key);
      }
    }
  }

  private mergeRealTimeAndHistoricalData(
    realTimeData: AggregatedMetrics[],
    historicalData: AggregatedMetrics[]
  ): AggregatedMetrics[] {
    // Create a map by time bucket to avoid duplicates
    const dataMap = new Map<string, AggregatedMetrics>();
    
    // Add historical data first
    historicalData.forEach(item => {
      dataMap.set(item.time_bucket.toISOString(), item);
    });
    
    // Overlay real-time data (more recent)
    realTimeData.forEach(item => {
      dataMap.set(item.time_bucket.toISOString(), item);
    });
    
    // Return sorted by time (newest first)
    return Array.from(dataMap.values())
      .sort((a, b) => b.time_bucket.getTime() - a.time_bucket.getTime());
  }

  private getDateRangeFromTimeRange(timeRange: '1h' | '1d' | '7d' | '30d'): { start: Date; end: Date } {
    const end = new Date();
    const start = new Date();

    switch (timeRange) {
      case '1h':
        start.setHours(start.getHours() - 1);
        break;
      case '1d':
        start.setDate(start.getDate() - 1);
        break;
      case '7d':
        start.setDate(start.getDate() - 7);
        break;
      case '30d':
        start.setDate(start.getDate() - 30);
        break;
    }

    return { start, end };
  }

  private getOptimalAggregationWindow(timeRange: '1h' | '1d' | '7d' | '30d'): '1m' | '5m' | '15m' | '1h' | '1d' {
    switch (timeRange) {
      case '1h': return '1m';
      case '1d': return '15m';
      case '7d': return '1h';
      case '30d': return '1d';
      default: return '1h';
    }
  }

  private calculateOverviewMetrics(aggregatedData: AggregatedMetrics[]) {
    if (aggregatedData.length === 0) {
      return {
        total_commands: 0,
        total_agents_used: 0,
        avg_execution_time: 0,
        error_rate: 0
      };
    }

    const totalCommands = aggregatedData.reduce((sum, item) => sum + item.command_count, 0);
    const agentSet = new Set<string>();
    let totalExecutionTime = 0;
    let totalErrors = 0;
    let productivityScores: number[] = [];

    aggregatedData.forEach(item => {
      totalExecutionTime += item.avg_execution_time * item.command_count;
      totalErrors += item.error_rate * item.command_count;
      
      Object.keys(item.agent_usage_count).forEach(agent => agentSet.add(agent));
      
      if (item.productivity_score !== undefined) {
        productivityScores.push(item.productivity_score);
      }
    });

    return {
      total_commands: totalCommands,
      total_agents_used: agentSet.size,
      avg_execution_time: totalCommands > 0 ? totalExecutionTime / totalCommands : 0,
      error_rate: totalCommands > 0 ? totalErrors / totalCommands : 0,
      productivity_score: productivityScores.length > 0 ?
        productivityScores.reduce((a, b) => a + b, 0) / productivityScores.length : undefined
    };
  }

  private async getTopCommands(organizationId: string, dateRange: { start: Date; end: Date }, params: any) {
    // Implementation would query command_executions table and aggregate by command_name
    // This is a simplified version
    return [];
  }

  private async getTopAgents(organizationId: string, dateRange: { start: Date; end: Date }, params: any) {
    // Implementation would query agent_interactions table and aggregate by agent_name  
    // This is a simplified version
    return [];
  }

  private async getUserActivity(organizationId: string, dateRange: { start: Date; end: Date }, params: any) {
    // Implementation would aggregate user activity metrics
    // This is a simplified version
    return [];
  }

  private updatePerformanceStats(responseTimeMs: number, cacheHit: boolean, success: boolean = true): void {
    if (success) {
      this.performanceStats.total_queries++;
      
      if (cacheHit) {
        this.performanceStats.cache_hits++;
      }
      
      if (responseTimeMs > 1000) {
        this.performanceStats.slow_queries++;
      }
      
      // Update running average
      const totalQueries = this.performanceStats.total_queries;
      this.performanceStats.avg_response_time_ms = 
        ((this.performanceStats.avg_response_time_ms * (totalQueries - 1)) + responseTimeMs) / totalQueries;
    }
  }

  private resetPerformanceStats(): void {
    this.performanceStats = {
      total_queries: 0,
      cache_hits: 0,
      avg_response_time_ms: 0,
      slow_queries: 0,
      last_reset: new Date()
    };
  }
}