"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsCollectionService = void 0;
const metrics_model_1 = require("../models/metrics.model");
const metrics_validation_1 = require("../validation/metrics.validation");
class MetricsCollectionService {
    metricsModel;
    rateLimitStore = new Map();
    logger;
    defaultRateLimit = {
        window_ms: 60000,
        max_requests: 1000,
        identifier: 'organization_id'
    };
    performanceStats = {
        total_requests: 0,
        successful_requests: 0,
        failed_requests: 0,
        avg_processing_time_ms: 0,
        last_reset: new Date()
    };
    constructor(db, logger) {
        this.metricsModel = new metrics_model_1.MetricsModel(db);
        this.logger = logger;
        setInterval(() => this.cleanupRateLimitCache(), 5 * 60 * 1000);
        setInterval(() => this.resetPerformanceStats(), 60 * 60 * 1000);
    }
    async collectCommandExecution(organizationId, data, rateLimitConfig) {
        const startTime = Date.now();
        try {
            const rateLimitCheck = this.checkRateLimit(organizationId, rateLimitConfig);
            if (!rateLimitCheck.allowed) {
                this.performanceStats.failed_requests++;
                return {
                    success: false,
                    message: 'Rate limit exceeded',
                    rate_limit: rateLimitCheck.status
                };
            }
            const validatedData = (0, metrics_validation_1.validateCommandExecution)(data);
            validatedData.command_args = (0, metrics_validation_1.sanitizeJsonField)(validatedData.command_args);
            validatedData.context = (0, metrics_validation_1.sanitizeJsonField)(validatedData.context);
            const result = await this.metricsModel.createCommandExecution(organizationId, validatedData);
            const processingTime = Date.now() - startTime;
            this.updatePerformanceStats(processingTime, true);
            this.logger.info('Command execution collected', {
                organization_id: organizationId,
                command_name: validatedData.command_name,
                processing_time_ms: processingTime
            });
            return {
                success: true,
                data: result,
                rate_limit: rateLimitCheck.status,
                performance: { processing_latency_ms: processingTime }
            };
        }
        catch (error) {
            const processingTime = Date.now() - startTime;
            this.updatePerformanceStats(processingTime, false);
            this.logger.error('Failed to collect command execution', {
                organization_id: organizationId,
                error: error instanceof Error ? error.message : 'Unknown error',
                processing_time_ms: processingTime
            });
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Collection failed',
                performance: { processing_latency_ms: processingTime }
            };
        }
    }
    async collectAgentInteraction(organizationId, data, rateLimitConfig) {
        const startTime = Date.now();
        try {
            const rateLimitCheck = this.checkRateLimit(organizationId, rateLimitConfig);
            if (!rateLimitCheck.allowed) {
                this.performanceStats.failed_requests++;
                return {
                    success: false,
                    message: 'Rate limit exceeded',
                    rate_limit: rateLimitCheck.status
                };
            }
            const validatedData = (0, metrics_validation_1.validateAgentInteraction)(data);
            validatedData.metadata = (0, metrics_validation_1.sanitizeJsonField)(validatedData.metadata);
            const result = await this.metricsModel.createAgentInteraction(organizationId, validatedData);
            const processingTime = Date.now() - startTime;
            this.updatePerformanceStats(processingTime, true);
            this.logger.info('Agent interaction collected', {
                organization_id: organizationId,
                agent_name: validatedData.agent_name,
                processing_time_ms: processingTime
            });
            return {
                success: true,
                data: result,
                rate_limit: rateLimitCheck.status,
                performance: { processing_latency_ms: processingTime }
            };
        }
        catch (error) {
            const processingTime = Date.now() - startTime;
            this.updatePerformanceStats(processingTime, false);
            this.logger.error('Failed to collect agent interaction', {
                organization_id: organizationId,
                error: error instanceof Error ? error.message : 'Unknown error',
                processing_time_ms: processingTime
            });
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Collection failed',
                performance: { processing_latency_ms: processingTime }
            };
        }
    }
    async startUserSession(organizationId, data, rateLimitConfig) {
        const startTime = Date.now();
        try {
            const rateLimitCheck = this.checkRateLimit(organizationId, rateLimitConfig);
            if (!rateLimitCheck.allowed) {
                this.performanceStats.failed_requests++;
                return {
                    success: false,
                    message: 'Rate limit exceeded',
                    rate_limit: rateLimitCheck.status
                };
            }
            const validatedData = (0, metrics_validation_1.validateUserSessionCreate)(data);
            validatedData.context = (0, metrics_validation_1.sanitizeJsonField)(validatedData.context);
            const activeSession = await this.metricsModel.getActiveUserSession(organizationId, validatedData.user_id);
            if (activeSession) {
                return {
                    success: true,
                    message: 'User already has an active session',
                    data: activeSession,
                    rate_limit: rateLimitCheck.status
                };
            }
            const result = await this.metricsModel.createUserSession(organizationId, validatedData);
            const processingTime = Date.now() - startTime;
            this.updatePerformanceStats(processingTime, true);
            this.logger.info('User session started', {
                organization_id: organizationId,
                user_id: validatedData.user_id,
                processing_time_ms: processingTime
            });
            return {
                success: true,
                data: result,
                rate_limit: rateLimitCheck.status,
                performance: { processing_latency_ms: processingTime }
            };
        }
        catch (error) {
            const processingTime = Date.now() - startTime;
            this.updatePerformanceStats(processingTime, false);
            this.logger.error('Failed to start user session', {
                organization_id: organizationId,
                error: error instanceof Error ? error.message : 'Unknown error',
                processing_time_ms: processingTime
            });
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Session start failed',
                performance: { processing_latency_ms: processingTime }
            };
        }
    }
    async updateUserSession(organizationId, sessionId, data, rateLimitConfig) {
        const startTime = Date.now();
        try {
            const rateLimitCheck = this.checkRateLimit(organizationId, rateLimitConfig);
            if (!rateLimitCheck.allowed) {
                this.performanceStats.failed_requests++;
                return {
                    success: false,
                    message: 'Rate limit exceeded',
                    rate_limit: rateLimitCheck.status
                };
            }
            const validatedData = (0, metrics_validation_1.validateUserSessionUpdate)(data);
            if (validatedData.context) {
                validatedData.context = (0, metrics_validation_1.sanitizeJsonField)(validatedData.context);
            }
            const result = await this.metricsModel.updateUserSession(organizationId, sessionId, validatedData);
            if (!result) {
                return {
                    success: false,
                    message: 'Session not found',
                    rate_limit: rateLimitCheck.status
                };
            }
            const processingTime = Date.now() - startTime;
            this.updatePerformanceStats(processingTime, true);
            this.logger.info('User session updated', {
                organization_id: organizationId,
                session_id: sessionId,
                processing_time_ms: processingTime
            });
            return {
                success: true,
                data: result,
                rate_limit: rateLimitCheck.status,
                performance: { processing_latency_ms: processingTime }
            };
        }
        catch (error) {
            const processingTime = Date.now() - startTime;
            this.updatePerformanceStats(processingTime, false);
            this.logger.error('Failed to update user session', {
                organization_id: organizationId,
                session_id: sessionId,
                error: error instanceof Error ? error.message : 'Unknown error',
                processing_time_ms: processingTime
            });
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Session update failed',
                performance: { processing_latency_ms: processingTime }
            };
        }
    }
    async collectProductivityMetric(organizationId, data, rateLimitConfig) {
        const startTime = Date.now();
        try {
            const rateLimitCheck = this.checkRateLimit(organizationId, rateLimitConfig);
            if (!rateLimitCheck.allowed) {
                this.performanceStats.failed_requests++;
                return {
                    success: false,
                    message: 'Rate limit exceeded',
                    rate_limit: rateLimitCheck.status
                };
            }
            const validatedData = (0, metrics_validation_1.validateProductivityMetric)(data);
            validatedData.dimensions = (0, metrics_validation_1.sanitizeJsonField)(validatedData.dimensions);
            const result = await this.metricsModel.createProductivityMetric(organizationId, validatedData);
            const processingTime = Date.now() - startTime;
            this.updatePerformanceStats(processingTime, true);
            this.logger.info('Productivity metric collected', {
                organization_id: organizationId,
                metric_type: validatedData.metric_type,
                processing_time_ms: processingTime
            });
            return {
                success: true,
                data: result,
                rate_limit: rateLimitCheck.status,
                performance: { processing_latency_ms: processingTime }
            };
        }
        catch (error) {
            const processingTime = Date.now() - startTime;
            this.updatePerformanceStats(processingTime, false);
            this.logger.error('Failed to collect productivity metric', {
                organization_id: organizationId,
                error: error instanceof Error ? error.message : 'Unknown error',
                processing_time_ms: processingTime
            });
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Collection failed',
                performance: { processing_latency_ms: processingTime }
            };
        }
    }
    async collectBatchMetrics(organizationId, batch, rateLimitConfig) {
        const startTime = Date.now();
        try {
            const batchRateLimit = {
                ...this.defaultRateLimit,
                max_requests: (rateLimitConfig?.max_requests || this.defaultRateLimit.max_requests) * 10,
                ...rateLimitConfig
            };
            const rateLimitCheck = this.checkRateLimit(organizationId, batchRateLimit);
            if (!rateLimitCheck.allowed) {
                this.performanceStats.failed_requests++;
                return {
                    success: false,
                    message: 'Rate limit exceeded for batch operation',
                    rate_limit: rateLimitCheck.status
                };
            }
            const validatedBatch = (0, metrics_validation_1.validateMetricsBatch)(batch);
            validatedBatch.organization_id = organizationId;
            if (validatedBatch.command_executions) {
                validatedBatch.command_executions.forEach(cmd => {
                    cmd.command_args = (0, metrics_validation_1.sanitizeJsonField)(cmd.command_args);
                    cmd.context = (0, metrics_validation_1.sanitizeJsonField)(cmd.context);
                });
            }
            if (validatedBatch.agent_interactions) {
                validatedBatch.agent_interactions.forEach(interaction => {
                    interaction.metadata = (0, metrics_validation_1.sanitizeJsonField)(interaction.metadata);
                });
            }
            if (validatedBatch.user_sessions) {
                validatedBatch.user_sessions.forEach(session => {
                    session.context = (0, metrics_validation_1.sanitizeJsonField)(session.context);
                });
            }
            if (validatedBatch.productivity_metrics) {
                validatedBatch.productivity_metrics.forEach(metric => {
                    metric.dimensions = (0, metrics_validation_1.sanitizeJsonField)(metric.dimensions);
                });
            }
            const result = await this.metricsModel.batchInsertMetrics(validatedBatch);
            const processingTime = Date.now() - startTime;
            this.updatePerformanceStats(processingTime, true);
            const totalItems = Object.values(result).reduce((sum, count) => sum + count, 0);
            this.logger.info('Batch metrics collected', {
                organization_id: organizationId,
                total_items: totalItems,
                processing_time_ms: processingTime,
                ...result
            });
            return {
                success: true,
                data: {
                    ...result,
                    processing_time_ms: processingTime
                },
                rate_limit: rateLimitCheck.status,
                performance: {
                    processing_latency_ms: processingTime,
                    ingestion_rate: totalItems / (processingTime / 1000)
                }
            };
        }
        catch (error) {
            const processingTime = Date.now() - startTime;
            this.updatePerformanceStats(processingTime, false);
            this.logger.error('Failed to collect batch metrics', {
                organization_id: organizationId,
                error: error instanceof Error ? error.message : 'Unknown error',
                processing_time_ms: processingTime
            });
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Batch collection failed',
                performance: { processing_latency_ms: processingTime }
            };
        }
    }
    checkRateLimit(identifier, config) {
        const rateConfig = { ...this.defaultRateLimit, ...config };
        const key = identifier;
        const now = new Date();
        let bucket = this.rateLimitStore.get(key);
        if (!bucket || (now.getTime() - bucket.window_start.getTime()) >= rateConfig.window_ms) {
            bucket = {
                count: 0,
                window_start: now
            };
            this.rateLimitStore.set(key, bucket);
        }
        const windowEnd = new Date(bucket.window_start.getTime() + rateConfig.window_ms);
        const remaining = Math.max(0, rateConfig.max_requests - bucket.count);
        if (bucket.count >= rateConfig.max_requests) {
            return {
                allowed: false,
                status: {
                    limit: rateConfig.max_requests,
                    remaining: 0,
                    reset_time: windowEnd,
                    retry_after: Math.ceil((windowEnd.getTime() - now.getTime()) / 1000)
                }
            };
        }
        bucket.count++;
        return {
            allowed: true,
            status: {
                limit: rateConfig.max_requests,
                remaining: remaining - 1,
                reset_time: windowEnd
            }
        };
    }
    cleanupRateLimitCache() {
        const now = new Date();
        const cutoff = now.getTime() - (this.defaultRateLimit.window_ms * 2);
        for (const [key, bucket] of this.rateLimitStore.entries()) {
            if (bucket.window_start.getTime() < cutoff) {
                this.rateLimitStore.delete(key);
            }
        }
    }
    updatePerformanceStats(processingTimeMs, success) {
        this.performanceStats.total_requests++;
        if (success) {
            this.performanceStats.successful_requests++;
        }
        else {
            this.performanceStats.failed_requests++;
        }
        const totalSuccessfulRequests = this.performanceStats.successful_requests;
        this.performanceStats.avg_processing_time_ms =
            ((this.performanceStats.avg_processing_time_ms * (totalSuccessfulRequests - 1)) + processingTimeMs) / totalSuccessfulRequests;
    }
    resetPerformanceStats() {
        this.performanceStats = {
            total_requests: 0,
            successful_requests: 0,
            failed_requests: 0,
            avg_processing_time_ms: 0,
            last_reset: new Date()
        };
    }
    async getPerformanceMetrics() {
        const dbMetrics = await this.metricsModel.getPerformanceMetrics();
        return {
            ...dbMetrics,
            processing_latency_ms: this.performanceStats.avg_processing_time_ms,
            ingestion_rate: this.performanceStats.successful_requests /
                ((Date.now() - this.performanceStats.last_reset.getTime()) / 1000)
        };
    }
    getCollectionStats() {
        return {
            ...this.performanceStats,
            success_rate: this.performanceStats.total_requests > 0 ?
                this.performanceStats.successful_requests / this.performanceStats.total_requests : 0,
            rate_limit_cache_size: this.rateLimitStore.size
        };
    }
}
exports.MetricsCollectionService = MetricsCollectionService;
//# sourceMappingURL=metrics-collection.service.js.map