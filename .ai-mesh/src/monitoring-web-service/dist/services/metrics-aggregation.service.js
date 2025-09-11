"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsAggregationService = void 0;
const metrics_model_1 = require("../models/metrics.model");
class MetricsAggregationService {
    redisManager;
    metricsModel;
    logger;
    config;
    cacheKeys = {
        PRODUCTIVITY_TRENDS: 'productivity_trends',
        TEAM_COMPARISON: 'team_comparison',
        AGENT_USAGE: 'agent_usage',
        REAL_TIME_ACTIVITY: 'real_time_activity',
        CODE_QUALITY: 'code_quality',
        TASK_METRICS: 'task_metrics'
    };
    constructor(redisManager, db, logger, config) {
        this.redisManager = redisManager;
        this.metricsModel = new metrics_model_1.MetricsModel(db);
        this.logger = logger;
        this.config = {
            cacheTimeoutMs: 300000,
            maxAggregationWindow: '90d',
            defaultPageSize: 50,
            maxPageSize: 1000,
            enableSmartCaching: true,
            ...config
        };
    }
    async getProductivityTrends(organizationId, params) {
        const startTime = Date.now();
        try {
            const cacheKey = this.generateCacheKey(this.cacheKeys.PRODUCTIVITY_TRENDS, {
                organizationId,
                ...params
            });
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
            const queryParams = {
                organization_id: organizationId,
                team_id: params.team_id,
                user_id: params.user_id,
                start_date: params.start_date,
                end_date: params.end_date,
                metric_types: params.metric_type ? [params.metric_type] : undefined,
                aggregation_window: params.aggregation_window || '1d'
            };
            const timeSeriesData = await this.metricsModel.getTimeSeriesMetrics(queryParams);
            let comparisonData = [];
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
            const result = this.processProductivityTrends(timeSeriesData, comparisonData, params);
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
        }
        catch (error) {
            this.logger.error('Failed to get productivity trends', {
                organization_id: organizationId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async getTeamComparison(organizationId, params) {
        const startTime = Date.now();
        try {
            const cacheKey = this.generateCacheKey(this.cacheKeys.TEAM_COMPARISON, {
                organizationId,
                ...params
            });
            if (this.config.enableSmartCaching) {
                const cached = await this.redisManager.getCachedAggregatedMetrics(cacheKey);
                if (cached) {
                    return cached;
                }
            }
            const teamMetrics = await this.metricsModel.getTeamMetrics({
                organization_id: organizationId,
                team_ids: params.team_ids,
                start_date: params.start_date,
                end_date: params.end_date,
                metric_types: params.metric_types,
                aggregation_window: params.aggregation_window || '1d'
            });
            const teamInfo = await this.metricsModel.getTeamInfo(organizationId, params.team_ids);
            const result = this.processTeamComparison(teamMetrics, teamInfo, params.metric_types);
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
        }
        catch (error) {
            this.logger.error('Failed to get team comparison', {
                organization_id: organizationId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async getAgentUsage(organizationId, params) {
        const startTime = Date.now();
        try {
            const cacheKey = this.generateCacheKey(this.cacheKeys.AGENT_USAGE, {
                organizationId,
                ...params
            });
            if (this.config.enableSmartCaching) {
                const cached = await this.redisManager.getCachedAggregatedMetrics(cacheKey);
                if (cached) {
                    return cached;
                }
            }
            const agentMetrics = await this.metricsModel.getAgentUsageMetrics({
                organization_id: organizationId,
                agent_names: params.agent_names,
                team_id: params.team_id,
                user_id: params.user_id,
                start_date: params.start_date,
                end_date: params.end_date
            });
            let trendData = [];
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
            const result = this.processAgentUsage(agentMetrics, trendData);
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
        }
        catch (error) {
            this.logger.error('Failed to get agent usage', {
                organization_id: organizationId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async getRealTimeActivity(organizationId) {
        const startTime = Date.now();
        try {
            const cacheKey = `${this.cacheKeys.REAL_TIME_ACTIVITY}:${organizationId}`;
            const cached = await this.redisManager.getCachedMetrics(cacheKey);
            if (cached && (Date.now() - new Date(cached.last_updated).getTime() < 30000)) {
                return cached;
            }
            const liveMetrics = await this.metricsModel.getLiveMetrics(organizationId);
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
            const recentActivity = await this.metricsModel.getRecentActivity(organizationId, oneHourAgo);
            const performanceIndicators = this.calculatePerformanceIndicators(liveMetrics);
            const result = {
                live_metrics: {
                    active_users: liveMetrics.active_users,
                    commands_per_minute: liveMetrics.commands_per_minute,
                    avg_response_time: liveMetrics.avg_response_time,
                    error_rate: liveMetrics.error_rate,
                    last_updated: new Date()
                },
                recent_activity: recentActivity.slice(0, 50),
                performance_indicators: performanceIndicators
            };
            await this.redisManager.cacheMetrics(cacheKey, result, 30);
            const processingTime = Date.now() - startTime;
            this.logger.debug('Generated real-time activity data', {
                organization_id: organizationId,
                processing_time_ms: processingTime,
                active_users: result.live_metrics.active_users
            });
            return result;
        }
        catch (error) {
            this.logger.error('Failed to get real-time activity', {
                organization_id: organizationId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async getCodeQualityMetrics(organizationId, params) {
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
        }
        catch (error) {
            this.logger.error('Failed to get code quality metrics', {
                organization_id: organizationId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async getTaskMetrics(organizationId, params) {
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
        }
        catch (error) {
            this.logger.error('Failed to get task metrics', {
                organization_id: organizationId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    processProductivityTrends(timeSeriesData, comparisonData, params) {
        const timeSeries = timeSeriesData.map((point, index) => {
            let changePercentage;
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
        const currentValue = timeSeries.length > 0 ? timeSeries[timeSeries.length - 1].value : 0;
        let previousValue = 0;
        let trend = 'stable';
        let changePercentage = 0;
        if (comparisonData.length > 0) {
            previousValue = comparisonData[comparisonData.length - 1]?.value || 0;
            if (previousValue > 0) {
                changePercentage = ((currentValue - previousValue) / previousValue) * 100;
                trend = changePercentage > 2 ? 'up' : changePercentage < -2 ? 'down' : 'stable';
            }
        }
        else if (timeSeries.length > 1) {
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
    processTeamComparison(teamMetrics, teamInfo, metricTypes) {
        const teams = teamMetrics.map(team => {
            const metrics = {};
            metricTypes.forEach(metricType => {
                metrics[metricType] = team.metrics[metricType] || 0;
            });
            return {
                team_id: team.team_id,
                team_name: teamInfo.find(info => info.team_id === team.team_id)?.name || 'Unknown Team',
                metrics,
                rank: 0,
                percentile: 0
            };
        });
        const primaryMetric = metricTypes[0];
        teams.sort((a, b) => (b.metrics[primaryMetric] || 0) - (a.metrics[primaryMetric] || 0));
        teams.forEach((team, index) => {
            team.rank = index + 1;
            team.percentile = Math.round(((teams.length - index) / teams.length) * 100);
        });
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
    processAgentUsage(agentMetrics, trendData) {
        const agentStats = agentMetrics.map((agent, index) => ({
            agent_name: agent.agent_name,
            usage_count: agent.usage_count,
            avg_execution_time: agent.avg_execution_time,
            success_rate: agent.success_rate,
            popularity_rank: index + 1,
            efficiency_score: this.calculateEfficiencyScore(agent)
        }));
        const mostUsed = [...agentStats].sort((a, b) => b.usage_count - a.usage_count)[0]?.agent_name || 'N/A';
        const fastest = [...agentStats].sort((a, b) => a.avg_execution_time - b.avg_execution_time)[0]?.agent_name || 'N/A';
        const mostReliable = [...agentStats].sort((a, b) => b.success_rate - a.success_rate)[0]?.agent_name || 'N/A';
        const trendingUp = [];
        const trendingDown = [];
        if (trendData.length > 0) {
            agentMetrics.forEach(currentAgent => {
                const previousAgent = trendData.find(t => t.agent_name === currentAgent.agent_name);
                if (previousAgent && previousAgent.usage_count > 0) {
                    const growthRate = (currentAgent.usage_count - previousAgent.usage_count) / previousAgent.usage_count;
                    if (growthRate > 0.2) {
                        trendingUp.push(currentAgent.agent_name);
                    }
                    else if (growthRate < -0.2) {
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
    calculatePerformanceIndicators(liveMetrics) {
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
    processCodeQualityMetrics(qualityMetrics) {
        return {
            overall_score: qualityMetrics.overall_score || 0,
            trends: qualityMetrics.trends || [],
            breakdown: qualityMetrics.breakdown || {}
        };
    }
    processTaskMetrics(taskMetrics) {
        return {
            completion_rate: taskMetrics.completion_rate || 0,
            velocity: taskMetrics.velocity || 0,
            cycle_time: taskMetrics.cycle_time || 0,
            burndown: taskMetrics.burndown || []
        };
    }
    generateCacheKey(baseKey, params) {
        const paramString = Object.keys(params)
            .sort()
            .map(key => `${key}:${params[key]}`)
            .join('|');
        return `${baseKey}:${Buffer.from(paramString).toString('base64')}`;
    }
    calculateCacheTimeout(startDate, endDate) {
        const now = new Date();
        const isHistoricalData = endDate < new Date(now.getTime() - 24 * 60 * 60 * 1000);
        if (isHistoricalData) {
            return 3600;
        }
        else {
            return 300;
        }
    }
    calculateEfficiencyScore(agent) {
        const successWeight = 0.6;
        const speedWeight = 0.4;
        const successScore = agent.success_rate * 100;
        const speedScore = Math.max(0, 100 - (agent.avg_execution_time / 1000) * 10);
        return Math.round((successScore * successWeight + speedScore * speedWeight) * 100) / 100;
    }
    async getServicePerformance() {
        try {
            const redisHealth = await this.redisManager.healthCheck();
            const dbHealth = await this.metricsModel.getPerformanceMetrics();
            return {
                ...dbHealth,
                query_response_time_ms: 0,
                memory_usage_mb: 0,
                cpu_usage_percent: 0,
                active_connections: redisHealth.status === 'healthy' ? 1 : 0,
                processing_latency_ms: 0,
                ingestion_rate: 0
            };
        }
        catch (error) {
            throw error;
        }
    }
    async healthCheck() {
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
        }
        catch (error) {
            return {
                status: 'unhealthy',
                details: {
                    error: error instanceof Error ? error.message : 'Unknown error'
                }
            };
        }
    }
}
exports.MetricsAggregationService = MetricsAggregationService;
//# sourceMappingURL=metrics-aggregation.service.js.map