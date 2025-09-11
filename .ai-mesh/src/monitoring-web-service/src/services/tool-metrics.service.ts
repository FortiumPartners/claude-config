/**
 * Tool Usage Metrics Service
 * Task 3.2: Tool execution tracking with performance metrics
 * 
 * Provides tool usage tracking, performance metrics collection,
 * error rate calculation, and trend analysis.
 */

import { MetricsModel } from '../models/metrics.model';
import { DatabaseConnection } from '../database/connection';
import {
  CommandExecution,
  CommandExecutionCreate,
  AgentInteraction,
  AgentInteractionCreate,
  PerformanceMetrics
} from '../types/metrics';
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

export class ToolMetricsService {
  private metricsModel: MetricsModel;
  private logger: winston.Logger;
  
  // Real-time tool performance tracking
  private toolPerformanceCache: Map<string, {
    recent_executions: number[];
    recent_errors: number;
    window_start: Date;
  }> = new Map();
  
  // Performance thresholds
  private performanceThresholds = {
    error_rate_warning: 0.1,     // 10% error rate warning
    error_rate_critical: 0.25,   // 25% error rate critical
    slow_execution_warning: 5000,   // 5 second warning
    slow_execution_critical: 10000, // 10 second critical
    usage_spike_multiplier: 3,   // 3x normal usage = spike
  };
  
  // Performance window (5 minutes)
  private readonly PERFORMANCE_WINDOW_MS = 5 * 60 * 1000;

  constructor(db: DatabaseConnection, logger: winston.Logger) {
    this.metricsModel = new MetricsModel(db);
    this.logger = logger;
    
    // Cleanup performance cache every 10 minutes
    setInterval(() => this.cleanupPerformanceCache(), 10 * 60 * 1000);
  }

  /**
   * Record tool execution with context
   */
  async recordToolExecution(
    organizationId: string,
    context: ToolExecutionContext,
    executionTimeMs: number,
    status: 'success' | 'error' | 'timeout' | 'cancelled',
    errorMessage?: string
  ): Promise<{ success: boolean; alerts?: ToolPerformanceAlert[]; message?: string }> {
    try {
      // Create command execution record
      const commandData: CommandExecutionCreate = {
        user_id: context.user_id,
        team_id: context.team_id,
        project_id: context.project_id,
        command_name: context.tool_name,
        command_args: context.input_parameters,
        execution_time_ms: executionTimeMs,
        status,
        error_message: errorMessage,
        context: {
          tool_version: context.tool_version,
          execution_environment: context.execution_environment,
          output_summary: context.output_summary,
          session_id: context.session_id
        }
      };

      const commandExecution = await this.metricsModel.createCommandExecution(
        organizationId,
        commandData
      );

      // Update real-time performance tracking
      this.updatePerformanceCache(context.tool_name, executionTimeMs, status === 'error');

      // Check for performance alerts
      const alerts = await this.checkPerformanceAlerts(organizationId, context.tool_name);

      this.logger.info('Tool execution recorded', {
        organization_id: organizationId,
        tool_name: context.tool_name,
        execution_time_ms: executionTimeMs,
        status,
        user_id: context.user_id,
        alerts_generated: alerts.length
      });

      return {
        success: true,
        alerts: alerts.length > 0 ? alerts : undefined
      };

    } catch (error) {
      this.logger.error('Failed to record tool execution', {
        organization_id: organizationId,
        tool_name: context.tool_name,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to record execution'
      };
    }
  }

  /**
   * Record agent interaction
   */
  async recordAgentInteraction(
    organizationId: string,
    interactionData: AgentInteractionCreate,
    context?: {
      input_tokens?: number;
      output_tokens?: number;
      model_used?: string;
      cost_cents?: number;
    }
  ): Promise<{ success: boolean; message?: string }> {
    try {
      // Enhance interaction data with context
      const enhancedData: AgentInteractionCreate = {
        ...interactionData,
        metadata: {
          ...(interactionData.metadata || {}),
          ...context,
          recorded_at: new Date().toISOString()
        }
      };

      await this.metricsModel.createAgentInteraction(organizationId, enhancedData);

      // Update performance tracking for agent
      this.updatePerformanceCache(
        interactionData.agent_name,
        interactionData.execution_time_ms,
        interactionData.status === 'error'
      );

      this.logger.info('Agent interaction recorded', {
        organization_id: organizationId,
        agent_name: interactionData.agent_name,
        interaction_type: interactionData.interaction_type,
        execution_time_ms: interactionData.execution_time_ms,
        status: interactionData.status
      });

      return { success: true };

    } catch (error) {
      this.logger.error('Failed to record agent interaction', {
        organization_id: organizationId,
        agent_name: interactionData.agent_name,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to record interaction'
      };
    }
  }

  /**
   * Get tool usage metrics for specific tool
   */
  async getToolMetrics(
    organizationId: string,
    toolName: string,
    timeRange: {
      start: Date;
      end: Date;
    }
  ): Promise<ToolUsageMetrics | null> {
    try {
      const metrics = await this.metricsModel.getToolUsageMetrics(
        organizationId,
        toolName,
        timeRange.start,
        timeRange.end
      );

      if (!metrics) return null;

      // Generate trend data
      const trendData = await this.generateTrendData(organizationId, toolName, timeRange);

      return {
        ...metrics,
        trend_data: trendData
      };

    } catch (error) {
      this.logger.error('Failed to get tool metrics', {
        organization_id: organizationId,
        tool_name: toolName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Get metrics for all tools
   */
  async getAllToolMetrics(
    organizationId: string,
    timeRange: {
      start: Date;
      end: Date;
    },
    limit: number = 50
  ): Promise<ToolUsageMetrics[]> {
    try {
      const allMetrics = await this.metricsModel.getAllToolUsageMetrics(
        organizationId,
        timeRange.start,
        timeRange.end,
        limit
      );

      // Add trend data for each tool
      const metricsWithTrends = await Promise.all(
        allMetrics.map(async (metrics) => {
          const trendData = await this.generateTrendData(
            organizationId,
            metrics.tool_name,
            timeRange
          );
          
          return {
            ...metrics,
            trend_data: trendData
          };
        })
      );

      return metricsWithTrends;

    } catch (error) {
      this.logger.error('Failed to get all tool metrics', {
        organization_id: organizationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  /**
   * Get tool trend analysis
   */
  async getToolTrendAnalysis(
    organizationId: string,
    toolName: string,
    period: 'hourly' | 'daily' | 'weekly' = 'daily',
    points: number = 24
  ): Promise<ToolTrendAnalysis | null> {
    try {
      const trendData = await this.metricsModel.getToolTrendData(
        organizationId,
        toolName,
        period,
        points
      );

      if (!trendData || trendData.length === 0) return null;

      // Analyze trend direction
      const firstHalf = trendData.slice(0, Math.floor(trendData.length / 2));
      const secondHalf = trendData.slice(Math.floor(trendData.length / 2));
      
      const firstAvgUsage = firstHalf.reduce((sum, p) => sum + p.usage_count, 0) / firstHalf.length;
      const secondAvgUsage = secondHalf.reduce((sum, p) => sum + p.usage_count, 0) / secondHalf.length;
      
      let trendDirection: 'up' | 'down' | 'stable';
      const changePercent = Math.abs((secondAvgUsage - firstAvgUsage) / firstAvgUsage);
      
      if (changePercent < 0.1) {
        trendDirection = 'stable';
      } else if (secondAvgUsage > firstAvgUsage) {
        trendDirection = 'up';
      } else {
        trendDirection = 'down';
      }

      // Analyze performance trend
      const firstAvgDuration = firstHalf.reduce((sum, p) => sum + p.average_duration_ms, 0) / firstHalf.length;
      const secondAvgDuration = secondHalf.reduce((sum, p) => sum + p.average_duration_ms, 0) / secondHalf.length;
      
      let performanceTrend: 'improving' | 'stable' | 'degrading';
      const perfChangePercent = Math.abs((secondAvgDuration - firstAvgDuration) / firstAvgDuration);
      
      if (perfChangePercent < 0.1) {
        performanceTrend = 'stable';
      } else if (secondAvgDuration < firstAvgDuration) {
        performanceTrend = 'improving';
      } else {
        performanceTrend = 'degrading';
      }

      // Detect anomalies
      const anomalies = this.detectAnomalies(trendData);

      return {
        tool_name: toolName,
        period,
        data_points: trendData,
        trend_direction: trendDirection,
        performance_trend: performanceTrend,
        anomalies
      };

    } catch (error) {
      this.logger.error('Failed to get tool trend analysis', {
        organization_id: organizationId,
        tool_name: toolName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Get current performance alerts
   */
  async getPerformanceAlerts(
    organizationId: string,
    severity?: 'low' | 'medium' | 'high' | 'critical'
  ): Promise<ToolPerformanceAlert[]> {
    try {
      return await this.metricsModel.getPerformanceAlerts(organizationId, severity);
    } catch (error) {
      this.logger.error('Failed to get performance alerts', {
        organization_id: organizationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  /**
   * Get tool performance summary
   */
  async getToolPerformanceSummary(
    organizationId: string,
    timeRange: {
      start: Date;
      end: Date;
    }
  ): Promise<{
    total_executions: number;
    unique_tools: number;
    average_execution_time_ms: number;
    overall_success_rate: number;
    most_used_tools: { tool_name: string; count: number }[];
    slowest_tools: { tool_name: string; avg_time_ms: number }[];
    most_error_prone_tools: { tool_name: string; error_rate: number }[];
  }> {
    try {
      return await this.metricsModel.getToolPerformanceSummary(
        organizationId,
        timeRange.start,
        timeRange.end
      );
    } catch (error) {
      this.logger.error('Failed to get tool performance summary', {
        organization_id: organizationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return {
        total_executions: 0,
        unique_tools: 0,
        average_execution_time_ms: 0,
        overall_success_rate: 0,
        most_used_tools: [],
        slowest_tools: [],
        most_error_prone_tools: []
      };
    }
  }

  /**
   * Update performance cache for real-time monitoring
   */
  private updatePerformanceCache(toolName: string, executionTimeMs: number, isError: boolean): void {
    const now = new Date();
    let cache = this.toolPerformanceCache.get(toolName);
    
    if (!cache || (now.getTime() - cache.window_start.getTime()) > this.PERFORMANCE_WINDOW_MS) {
      cache = {
        recent_executions: [],
        recent_errors: 0,
        window_start: now
      };
      this.toolPerformanceCache.set(toolName, cache);
    }
    
    cache.recent_executions.push(executionTimeMs);
    if (isError) {
      cache.recent_errors++;
    }
    
    // Keep only last 100 executions in memory
    if (cache.recent_executions.length > 100) {
      cache.recent_executions = cache.recent_executions.slice(-100);
    }
  }

  /**
   * Check for performance alerts
   */
  private async checkPerformanceAlerts(
    organizationId: string,
    toolName: string
  ): Promise<ToolPerformanceAlert[]> {
    const alerts: ToolPerformanceAlert[] = [];
    const cache = this.toolPerformanceCache.get(toolName);
    
    if (!cache || cache.recent_executions.length < 5) return alerts; // Need minimum data

    const executions = cache.recent_executions;
    const errorRate = cache.recent_errors / executions.length;
    const avgExecutionTime = executions.reduce((sum, time) => sum + time, 0) / executions.length;

    // Check error rate alerts
    if (errorRate >= this.performanceThresholds.error_rate_critical) {
      alerts.push({
        tool_name: toolName,
        alert_type: 'high_error_rate',
        severity: 'critical',
        message: `Critical error rate: ${(errorRate * 100).toFixed(1)}%`,
        threshold_value: this.performanceThresholds.error_rate_critical,
        current_value: errorRate,
        first_detected: new Date()
      });
    } else if (errorRate >= this.performanceThresholds.error_rate_warning) {
      alerts.push({
        tool_name: toolName,
        alert_type: 'high_error_rate',
        severity: 'medium',
        message: `High error rate: ${(errorRate * 100).toFixed(1)}%`,
        threshold_value: this.performanceThresholds.error_rate_warning,
        current_value: errorRate,
        first_detected: new Date()
      });
    }

    // Check performance alerts
    if (avgExecutionTime >= this.performanceThresholds.slow_execution_critical) {
      alerts.push({
        tool_name: toolName,
        alert_type: 'slow_performance',
        severity: 'critical',
        message: `Critical slow performance: ${(avgExecutionTime / 1000).toFixed(1)}s average`,
        threshold_value: this.performanceThresholds.slow_execution_critical,
        current_value: avgExecutionTime,
        first_detected: new Date()
      });
    } else if (avgExecutionTime >= this.performanceThresholds.slow_execution_warning) {
      alerts.push({
        tool_name: toolName,
        alert_type: 'slow_performance',
        severity: 'medium',
        message: `Slow performance: ${(avgExecutionTime / 1000).toFixed(1)}s average`,
        threshold_value: this.performanceThresholds.slow_execution_warning,
        current_value: avgExecutionTime,
        first_detected: new Date()
      });
    }

    // Store alerts in database if any
    if (alerts.length > 0) {
      try {
        await this.metricsModel.storePerformanceAlerts(organizationId, alerts);
      } catch (error) {
        this.logger.error('Failed to store performance alerts', {
          tool_name: toolName,
          alerts_count: alerts.length,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return alerts;
  }

  /**
   * Generate trend data for tool
   */
  private async generateTrendData(
    organizationId: string,
    toolName: string,
    timeRange: { start: Date; end: Date }
  ): Promise<{
    hourly_usage: number[];
    daily_usage: number[];
    performance_trend: 'improving' | 'stable' | 'degrading';
  }> {
    try {
      const [hourlyData, dailyData] = await Promise.all([
        this.metricsModel.getToolTrendData(organizationId, toolName, 'hourly', 24),
        this.metricsModel.getToolTrendData(organizationId, toolName, 'daily', 7)
      ]);

      const hourlyUsage = hourlyData.map(d => d.usage_count);
      const dailyUsage = dailyData.map(d => d.usage_count);

      // Determine performance trend
      let performanceTrend: 'improving' | 'stable' | 'degrading' = 'stable';
      
      if (dailyData.length >= 2) {
        const recent = dailyData.slice(-2);
        const avgRecent = recent.reduce((sum, d) => sum + d.average_duration_ms, 0) / recent.length;
        const older = dailyData.slice(0, -2);
        
        if (older.length > 0) {
          const avgOlder = older.reduce((sum, d) => sum + d.average_duration_ms, 0) / older.length;
          const changePercent = (avgRecent - avgOlder) / avgOlder;
          
          if (changePercent > 0.1) {
            performanceTrend = 'degrading';
          } else if (changePercent < -0.1) {
            performanceTrend = 'improving';
          }
        }
      }

      return {
        hourly_usage: hourlyUsage,
        daily_usage: dailyUsage,
        performance_trend: performanceTrend
      };

    } catch (error) {
      this.logger.error('Failed to generate trend data', {
        tool_name: toolName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return {
        hourly_usage: [],
        daily_usage: [],
        performance_trend: 'stable'
      };
    }
  }

  /**
   * Detect anomalies in trend data
   */
  private detectAnomalies(
    trendData: {
      timestamp: Date;
      usage_count: number;
      average_duration_ms: number;
      error_rate: number;
    }[]
  ): {
    timestamp: Date;
    type: 'usage_spike' | 'performance_drop' | 'error_spike';
    severity: number;
  }[] {
    const anomalies: {
      timestamp: Date;
      type: 'usage_spike' | 'performance_drop' | 'error_spike';
      severity: number;
    }[] = [];

    if (trendData.length < 3) return anomalies;

    // Calculate baseline metrics
    const avgUsage = trendData.reduce((sum, d) => sum + d.usage_count, 0) / trendData.length;
    const avgDuration = trendData.reduce((sum, d) => sum + d.average_duration_ms, 0) / trendData.length;
    const avgErrorRate = trendData.reduce((sum, d) => sum + d.error_rate, 0) / trendData.length;

    for (const point of trendData) {
      // Usage spike detection
      if (point.usage_count > avgUsage * 3) {
        anomalies.push({
          timestamp: point.timestamp,
          type: 'usage_spike',
          severity: Math.min(1, point.usage_count / (avgUsage * 3))
        });
      }

      // Performance drop detection
      if (point.average_duration_ms > avgDuration * 2) {
        anomalies.push({
          timestamp: point.timestamp,
          type: 'performance_drop',
          severity: Math.min(1, point.average_duration_ms / (avgDuration * 2))
        });
      }

      // Error spike detection
      if (point.error_rate > Math.max(0.1, avgErrorRate * 2)) {
        anomalies.push({
          timestamp: point.timestamp,
          type: 'error_spike',
          severity: Math.min(1, point.error_rate / Math.max(0.1, avgErrorRate * 2))
        });
      }
    }

    return anomalies;
  }

  /**
   * Cleanup performance cache
   */
  private cleanupPerformanceCache(): void {
    const now = new Date();
    const cutoff = now.getTime() - (this.PERFORMANCE_WINDOW_MS * 2);
    
    for (const [toolName, cache] of this.toolPerformanceCache.entries()) {
      if (cache.window_start.getTime() < cutoff) {
        this.toolPerformanceCache.delete(toolName);
      }
    }
  }
}