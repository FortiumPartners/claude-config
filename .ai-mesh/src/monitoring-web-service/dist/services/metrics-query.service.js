"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsQueryService = void 0;
const metrics_model_1 = require("../models/metrics.model");
const metrics_validation_1 = require("../validation/metrics.validation");
class MetricsQueryService {
    metricsModel;
    realTimeProcessor;
    logger;
    queryCache = new Map();
    cacheConfig = {
        default_ttl_seconds: 300,
        max_cache_size: 10000,
        dashboard_ttl_seconds: 60,
        aggregation_ttl_seconds: 600,
    };
    performanceStats = {
        total_queries: 0,
        cache_hits: 0,
        avg_response_time_ms: 0,
        slow_queries: 0,
        last_reset: new Date()
    };
    constructor(db, logger, realTimeProcessor) {
        this.metricsModel = new metrics_model_1.MetricsModel(db);
        this.realTimeProcessor = realTimeProcessor;
        this.logger = logger;
        setInterval(() => this.cleanExpiredCache(), 10 * 60 * 1000);
        setInterval(() => this.resetPerformanceStats(), 60 * 60 * 1000);
    }
    async getAggregatedMetrics(organizationId, params, hints = {}) {
        const startTime = Date.now();
        let cacheHit = false;
        try {
            const validatedParams = this.validateAndDefaultParams(organizationId, params);
            const queryHints = {
                use_real_time_cache: true,
                prefer_aggregated_data: true,
                max_scan_limit: 100000,
                timeout_ms: 5000,
                ...hints
            };
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
            let realTimeData = [];
            if (queryHints.use_real_time_cache && this.realTimeProcessor) {
                const now = new Date();
                const recentThreshold = new Date(now.getTime() - (60 * 60 * 1000));
                if (validatedParams.end_date >= recentThreshold) {
                    realTimeData = this.realTimeProcessor.getCurrentAggregations(organizationId, validatedParams.aggregation_window, validatedParams.user_id);
                }
            }
            const dbData = await this.metricsModel.getAggregatedMetrics(validatedParams);
            const allData = this.mergeRealTimeAndHistoricalData(realTimeData, dbData);
            const page = Math.floor((validatedParams.offset || 0) / (validatedParams.limit || 1000)) + 1;
            const perPage = validatedParams.limit || 1000;
            const totalCount = allData.length;
            const totalPages = Math.ceil(totalCount / perPage);
            const startIndex = (page - 1) * perPage;
            const endIndex = Math.min(startIndex + perPage, totalCount);
            const paginatedData = allData.slice(startIndex, endIndex);
            const result = {
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
            this.setCachedResult(cacheKey, result, this.cacheConfig.aggregation_ttl_seconds);
            const responseTime = Date.now() - startTime;
            this.updatePerformanceStats(responseTime, cacheHit);
            if (responseTime > 1000) {
                this.logger.warn('Slow aggregated metrics query', {
                    organization_id: organizationId,
                    response_time_ms: responseTime,
                    records_scanned: dbData.length,
                    params: validatedParams
                });
            }
            return result;
        }
        catch (error) {
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
    async getDashboardMetrics(organizationId, params) {
        const startTime = Date.now();
        let cacheHit = false;
        try {
            const cacheKey = this.generateCacheKey('dashboard_metrics', { organizationId, ...params });
            const cachedResult = this.getCachedResult(cacheKey);
            if (cachedResult) {
                cacheHit = true;
                this.updatePerformanceStats(Date.now() - startTime, true);
                return cachedResult;
            }
            const dateRange = this.getDateRangeFromTimeRange(params.time_range);
            const aggregationWindow = this.getOptimalAggregationWindow(params.time_range);
            const [aggregatedMetrics, commandStats, agentStats, userActivity] = await Promise.all([
                this.getAggregatedMetrics(organizationId, {
                    user_id: params.user_id,
                    team_id: params.team_id,
                    project_id: params.project_id,
                    start_date: dateRange.start,
                    end_date: dateRange.end,
                    aggregation_window: aggregationWindow,
                    limit: 100
                }),
                this.getTopCommands(organizationId, dateRange, params),
                this.getTopAgents(organizationId, dateRange, params),
                this.getUserActivity(organizationId, dateRange, params)
            ]);
            const overview = this.calculateOverviewMetrics(aggregatedMetrics.data);
            const dashboardMetrics = {
                overview,
                trends: aggregatedMetrics.data,
                top_commands: commandStats,
                top_agents: agentStats,
                user_activity: userActivity
            };
            this.setCachedResult(cacheKey, dashboardMetrics, this.cacheConfig.dashboard_ttl_seconds);
            const responseTime = Date.now() - startTime;
            this.updatePerformanceStats(responseTime, false);
            this.logger.info('Dashboard metrics generated', {
                organization_id: organizationId,
                response_time_ms: responseTime,
                time_range: params.time_range
            });
            return dashboardMetrics;
        }
        catch (error) {
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
    async getCommandExecutions(organizationId, params) {
        const startTime = Date.now();
        try {
            (0, metrics_validation_1.validateDateRange)(params.start_date, params.end_date);
            const limit = Math.min(params.limit || 1000, 10000);
            const offset = params.offset || 0;
            let whereConditions = ['organization_id = $1'];
            let queryParams = [organizationId, params.start_date, params.end_date];
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
            const countQuery = `
        SELECT COUNT(*) as total_count
        FROM command_executions 
        WHERE ${whereConditions.join(' AND ')}
          AND executed_at >= $2 
          AND executed_at <= $3
      `;
            const countResult = await this.metricsModel['db'].query(countQuery, queryParams);
            const totalCount = parseInt(countResult.rows[0].total_count);
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
            const page = Math.floor(offset / limit) + 1;
            const totalPages = Math.ceil(totalCount / limit);
            const result = {
                data: dataResult.rows.map((row) => this.metricsModel['mapCommandExecution'](row)),
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
        }
        catch (error) {
            this.logger.error('Failed to get command executions', {
                organization_id: organizationId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    getRealTimeMetrics(organizationId, window = '5m', userId) {
        if (!this.realTimeProcessor) {
            throw new Error('Real-time processor not available');
        }
        return this.realTimeProcessor.getCurrentAggregations(organizationId, window, userId);
    }
    async getQueryPerformanceMetrics() {
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
    validateAndDefaultParams(organizationId, params) {
        const defaultParams = {
            organization_id: organizationId,
            start_date: new Date(Date.now() - 24 * 60 * 60 * 1000),
            end_date: new Date(),
            limit: 1000,
            offset: 0,
            aggregation_window: '1h',
            ...params
        };
        return (0, metrics_validation_1.validateMetricsQuery)(defaultParams);
    }
    generateCacheKey(type, params) {
        const sortedParams = Object.keys(params)
            .sort()
            .reduce((sorted, key) => {
            sorted[key] = params[key];
            return sorted;
        }, {});
        return `${type}:${JSON.stringify(sortedParams)}`;
    }
    getCachedResult(cacheKey) {
        const entry = this.queryCache.get(cacheKey);
        if (!entry)
            return null;
        const now = new Date();
        if (now.getTime() - entry.timestamp.getTime() > entry.ttl_seconds * 1000) {
            this.queryCache.delete(cacheKey);
            return null;
        }
        return entry.data;
    }
    setCachedResult(cacheKey, data, ttlSeconds) {
        if (this.queryCache.size >= this.cacheConfig.max_cache_size) {
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
    cleanExpiredCache() {
        const now = new Date();
        for (const [key, entry] of this.queryCache) {
            if (now.getTime() - entry.timestamp.getTime() > entry.ttl_seconds * 1000) {
                this.queryCache.delete(key);
            }
        }
    }
    mergeRealTimeAndHistoricalData(realTimeData, historicalData) {
        const dataMap = new Map();
        historicalData.forEach(item => {
            dataMap.set(item.time_bucket.toISOString(), item);
        });
        realTimeData.forEach(item => {
            dataMap.set(item.time_bucket.toISOString(), item);
        });
        return Array.from(dataMap.values())
            .sort((a, b) => b.time_bucket.getTime() - a.time_bucket.getTime());
    }
    getDateRangeFromTimeRange(timeRange) {
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
    getOptimalAggregationWindow(timeRange) {
        switch (timeRange) {
            case '1h': return '1m';
            case '1d': return '15m';
            case '7d': return '1h';
            case '30d': return '1d';
            default: return '1h';
        }
    }
    calculateOverviewMetrics(aggregatedData) {
        if (aggregatedData.length === 0) {
            return {
                total_commands: 0,
                total_agents_used: 0,
                avg_execution_time: 0,
                error_rate: 0
            };
        }
        const totalCommands = aggregatedData.reduce((sum, item) => sum + item.command_count, 0);
        const agentSet = new Set();
        let totalExecutionTime = 0;
        let totalErrors = 0;
        let productivityScores = [];
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
    async getTopCommands(organizationId, dateRange, params) {
        return [];
    }
    async getTopAgents(organizationId, dateRange, params) {
        return [];
    }
    async getUserActivity(organizationId, dateRange, params) {
        return [];
    }
    updatePerformanceStats(responseTimeMs, cacheHit, success = true) {
        if (success) {
            this.performanceStats.total_queries++;
            if (cacheHit) {
                this.performanceStats.cache_hits++;
            }
            if (responseTimeMs > 1000) {
                this.performanceStats.slow_queries++;
            }
            const totalQueries = this.performanceStats.total_queries;
            this.performanceStats.avg_response_time_ms =
                ((this.performanceStats.avg_response_time_ms * (totalQueries - 1)) + responseTimeMs) / totalQueries;
        }
    }
    resetPerformanceStats() {
        this.performanceStats = {
            total_queries: 0,
            cache_hits: 0,
            avg_response_time_ms: 0,
            slow_queries: 0,
            last_reset: new Date()
        };
    }
}
exports.MetricsQueryService = MetricsQueryService;
//# sourceMappingURL=metrics-query.service.js.map