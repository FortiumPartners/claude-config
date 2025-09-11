"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolMetricsService = void 0;
const metrics_model_1 = require("../models/metrics.model");
class ToolMetricsService {
    metricsModel;
    logger;
    toolPerformanceCache = new Map();
    performanceThresholds = {
        error_rate_warning: 0.1,
        error_rate_critical: 0.25,
        slow_execution_warning: 5000,
        slow_execution_critical: 10000,
        usage_spike_multiplier: 3,
    };
    PERFORMANCE_WINDOW_MS = 5 * 60 * 1000;
    constructor(db, logger) {
        this.metricsModel = new metrics_model_1.MetricsModel(db);
        this.logger = logger;
        setInterval(() => this.cleanupPerformanceCache(), 10 * 60 * 1000);
    }
    async recordToolExecution(organizationId, context, executionTimeMs, status, errorMessage) {
        try {
            const commandData = {
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
            const commandExecution = await this.metricsModel.createCommandExecution(organizationId, commandData);
            this.updatePerformanceCache(context.tool_name, executionTimeMs, status === 'error');
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
        }
        catch (error) {
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
    async recordAgentInteraction(organizationId, interactionData, context) {
        try {
            const enhancedData = {
                ...interactionData,
                metadata: {
                    ...(interactionData.metadata || {}),
                    ...context,
                    recorded_at: new Date().toISOString()
                }
            };
            await this.metricsModel.createAgentInteraction(organizationId, enhancedData);
            this.updatePerformanceCache(interactionData.agent_name, interactionData.execution_time_ms, interactionData.status === 'error');
            this.logger.info('Agent interaction recorded', {
                organization_id: organizationId,
                agent_name: interactionData.agent_name,
                interaction_type: interactionData.interaction_type,
                execution_time_ms: interactionData.execution_time_ms,
                status: interactionData.status
            });
            return { success: true };
        }
        catch (error) {
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
    async getToolMetrics(organizationId, toolName, timeRange) {
        try {
            const metrics = await this.metricsModel.getToolUsageMetrics(organizationId, toolName, timeRange.start, timeRange.end);
            if (!metrics)
                return null;
            const trendData = await this.generateTrendData(organizationId, toolName, timeRange);
            return {
                ...metrics,
                trend_data: trendData
            };
        }
        catch (error) {
            this.logger.error('Failed to get tool metrics', {
                organization_id: organizationId,
                tool_name: toolName,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return null;
        }
    }
    async getAllToolMetrics(organizationId, timeRange, limit = 50) {
        try {
            const allMetrics = await this.metricsModel.getAllToolUsageMetrics(organizationId, timeRange.start, timeRange.end, limit);
            const metricsWithTrends = await Promise.all(allMetrics.map(async (metrics) => {
                const trendData = await this.generateTrendData(organizationId, metrics.tool_name, timeRange);
                return {
                    ...metrics,
                    trend_data: trendData
                };
            }));
            return metricsWithTrends;
        }
        catch (error) {
            this.logger.error('Failed to get all tool metrics', {
                organization_id: organizationId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return [];
        }
    }
    async getToolTrendAnalysis(organizationId, toolName, period = 'daily', points = 24) {
        try {
            const trendData = await this.metricsModel.getToolTrendData(organizationId, toolName, period, points);
            if (!trendData || trendData.length === 0)
                return null;
            const firstHalf = trendData.slice(0, Math.floor(trendData.length / 2));
            const secondHalf = trendData.slice(Math.floor(trendData.length / 2));
            const firstAvgUsage = firstHalf.reduce((sum, p) => sum + p.usage_count, 0) / firstHalf.length;
            const secondAvgUsage = secondHalf.reduce((sum, p) => sum + p.usage_count, 0) / secondHalf.length;
            let trendDirection;
            const changePercent = Math.abs((secondAvgUsage - firstAvgUsage) / firstAvgUsage);
            if (changePercent < 0.1) {
                trendDirection = 'stable';
            }
            else if (secondAvgUsage > firstAvgUsage) {
                trendDirection = 'up';
            }
            else {
                trendDirection = 'down';
            }
            const firstAvgDuration = firstHalf.reduce((sum, p) => sum + p.average_duration_ms, 0) / firstHalf.length;
            const secondAvgDuration = secondHalf.reduce((sum, p) => sum + p.average_duration_ms, 0) / secondHalf.length;
            let performanceTrend;
            const perfChangePercent = Math.abs((secondAvgDuration - firstAvgDuration) / firstAvgDuration);
            if (perfChangePercent < 0.1) {
                performanceTrend = 'stable';
            }
            else if (secondAvgDuration < firstAvgDuration) {
                performanceTrend = 'improving';
            }
            else {
                performanceTrend = 'degrading';
            }
            const anomalies = this.detectAnomalies(trendData);
            return {
                tool_name: toolName,
                period,
                data_points: trendData,
                trend_direction: trendDirection,
                performance_trend: performanceTrend,
                anomalies
            };
        }
        catch (error) {
            this.logger.error('Failed to get tool trend analysis', {
                organization_id: organizationId,
                tool_name: toolName,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return null;
        }
    }
    async getPerformanceAlerts(organizationId, severity) {
        try {
            return await this.metricsModel.getPerformanceAlerts(organizationId, severity);
        }
        catch (error) {
            this.logger.error('Failed to get performance alerts', {
                organization_id: organizationId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return [];
        }
    }
    async getToolPerformanceSummary(organizationId, timeRange) {
        try {
            return await this.metricsModel.getToolPerformanceSummary(organizationId, timeRange.start, timeRange.end);
        }
        catch (error) {
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
    updatePerformanceCache(toolName, executionTimeMs, isError) {
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
        if (cache.recent_executions.length > 100) {
            cache.recent_executions = cache.recent_executions.slice(-100);
        }
    }
    async checkPerformanceAlerts(organizationId, toolName) {
        const alerts = [];
        const cache = this.toolPerformanceCache.get(toolName);
        if (!cache || cache.recent_executions.length < 5)
            return alerts;
        const executions = cache.recent_executions;
        const errorRate = cache.recent_errors / executions.length;
        const avgExecutionTime = executions.reduce((sum, time) => sum + time, 0) / executions.length;
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
        }
        else if (errorRate >= this.performanceThresholds.error_rate_warning) {
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
        }
        else if (avgExecutionTime >= this.performanceThresholds.slow_execution_warning) {
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
        if (alerts.length > 0) {
            try {
                await this.metricsModel.storePerformanceAlerts(organizationId, alerts);
            }
            catch (error) {
                this.logger.error('Failed to store performance alerts', {
                    tool_name: toolName,
                    alerts_count: alerts.length,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
        return alerts;
    }
    async generateTrendData(organizationId, toolName, timeRange) {
        try {
            const [hourlyData, dailyData] = await Promise.all([
                this.metricsModel.getToolTrendData(organizationId, toolName, 'hourly', 24),
                this.metricsModel.getToolTrendData(organizationId, toolName, 'daily', 7)
            ]);
            const hourlyUsage = hourlyData.map(d => d.usage_count);
            const dailyUsage = dailyData.map(d => d.usage_count);
            let performanceTrend = 'stable';
            if (dailyData.length >= 2) {
                const recent = dailyData.slice(-2);
                const avgRecent = recent.reduce((sum, d) => sum + d.average_duration_ms, 0) / recent.length;
                const older = dailyData.slice(0, -2);
                if (older.length > 0) {
                    const avgOlder = older.reduce((sum, d) => sum + d.average_duration_ms, 0) / older.length;
                    const changePercent = (avgRecent - avgOlder) / avgOlder;
                    if (changePercent > 0.1) {
                        performanceTrend = 'degrading';
                    }
                    else if (changePercent < -0.1) {
                        performanceTrend = 'improving';
                    }
                }
            }
            return {
                hourly_usage: hourlyUsage,
                daily_usage: dailyUsage,
                performance_trend: performanceTrend
            };
        }
        catch (error) {
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
    detectAnomalies(trendData) {
        const anomalies = [];
        if (trendData.length < 3)
            return anomalies;
        const avgUsage = trendData.reduce((sum, d) => sum + d.usage_count, 0) / trendData.length;
        const avgDuration = trendData.reduce((sum, d) => sum + d.average_duration_ms, 0) / trendData.length;
        const avgErrorRate = trendData.reduce((sum, d) => sum + d.error_rate, 0) / trendData.length;
        for (const point of trendData) {
            if (point.usage_count > avgUsage * 3) {
                anomalies.push({
                    timestamp: point.timestamp,
                    type: 'usage_spike',
                    severity: Math.min(1, point.usage_count / (avgUsage * 3))
                });
            }
            if (point.average_duration_ms > avgDuration * 2) {
                anomalies.push({
                    timestamp: point.timestamp,
                    type: 'performance_drop',
                    severity: Math.min(1, point.average_duration_ms / (avgDuration * 2))
                });
            }
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
    cleanupPerformanceCache() {
        const now = new Date();
        const cutoff = now.getTime() - (this.PERFORMANCE_WINDOW_MS * 2);
        for (const [toolName, cache] of this.toolPerformanceCache.entries()) {
            if (cache.window_start.getTime() < cutoff) {
                this.toolPerformanceCache.delete(toolName);
            }
        }
    }
}
exports.ToolMetricsService = ToolMetricsService;
//# sourceMappingURL=tool-metrics.service.js.map