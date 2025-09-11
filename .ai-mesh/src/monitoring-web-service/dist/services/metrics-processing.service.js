"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsProcessingService = void 0;
const metrics_model_1 = require("../models/metrics.model");
class MetricsProcessingService {
    kafkaManager;
    redisManager;
    metricsModel;
    producer;
    consumers = [];
    logger;
    config;
    isRunning = false;
    stats = {
        messages_processed: 0,
        messages_failed: 0,
        processing_rate: 0,
        avg_processing_time_ms: 0,
        last_processed_at: new Date(),
        active_consumers: 0,
        queue_depth: 0
    };
    aggregationBuffer = new Map();
    lastAggregation = Date.now();
    constructor(kafkaManager, redisManager, db, logger, config) {
        this.kafkaManager = kafkaManager;
        this.redisManager = redisManager;
        this.metricsModel = new metrics_model_1.MetricsModel(db);
        this.logger = logger;
        this.config = {
            batchSize: 100,
            batchTimeoutMs: 5000,
            maxRetries: 3,
            parallelism: 4,
            aggregationWindowMs: 60000,
            ...config
        };
        this.producer = this.kafkaManager.createProducer({
            maxInFlightRequests: 1,
            idempotent: true,
            transactionTimeout: 30000
        });
        setInterval(() => {
            this.flushAggregationBuffer().catch(error => {
                this.logger.error('Failed to flush aggregation buffer', {
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            });
        }, this.config.aggregationWindowMs);
    }
    async start() {
        if (this.isRunning) {
            this.logger.warn('Metrics processing pipeline is already running');
            return;
        }
        try {
            await this.producer.connect();
            this.logger.info('Kafka producer connected for metrics processing');
            await this.startRawMetricsProcessor();
            await this.startMetricsAggregator();
            await this.startAlertProcessor();
            this.isRunning = true;
            this.logger.info('Metrics processing pipeline started successfully');
        }
        catch (error) {
            this.logger.error('Failed to start metrics processing pipeline', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async stop() {
        if (!this.isRunning) {
            return;
        }
        try {
            await this.flushAggregationBuffer();
            await Promise.all(this.consumers.map(consumer => consumer.disconnect()));
            await this.producer.disconnect();
            this.isRunning = false;
            this.consumers = [];
            this.logger.info('Metrics processing pipeline stopped successfully');
        }
        catch (error) {
            this.logger.error('Failed to stop metrics processing pipeline', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async publishMetricsEvent(event) {
        try {
            await this.producer.send({
                topic: this.kafkaManager.topics.METRICS_RAW,
                messages: [{
                        key: `${event.organization_id}:${event.user_id}`,
                        value: JSON.stringify(event),
                        timestamp: event.timestamp.toISOString(),
                        partition: this.getPartitionForOrganization(event.organization_id),
                        headers: {
                            'event-type': event.type,
                            'organization-id': event.organization_id,
                            'user-id': event.user_id
                        }
                    }]
            });
            this.logger.debug('Published metrics event to pipeline', {
                type: event.type,
                organization_id: event.organization_id,
                user_id: event.user_id
            });
        }
        catch (error) {
            this.logger.error('Failed to publish metrics event', {
                event_type: event.type,
                organization_id: event.organization_id,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async startRawMetricsProcessor() {
        const consumer = this.kafkaManager.createConsumer('fortium-metrics-raw-processor');
        await consumer.connect();
        await consumer.subscribe({ topic: this.kafkaManager.topics.METRICS_RAW, fromBeginning: false });
        await consumer.run({
            partitionsConsumedConcurrently: this.config.parallelism,
            eachMessage: this.processRawMetricsMessage.bind(this)
        });
        this.consumers.push(consumer);
        this.stats.active_consumers++;
        this.logger.info('Raw metrics processor started');
    }
    async processRawMetricsMessage(payload) {
        const startTime = Date.now();
        try {
            const event = JSON.parse(payload.message.value?.toString() || '');
            if (!this.validateMetricsEvent(event)) {
                throw new Error('Invalid metrics event structure');
            }
            let processedData;
            switch (event.type) {
                case 'command_execution':
                    processedData = await this.processCommandExecution(event);
                    break;
                case 'agent_interaction':
                    processedData = await this.processAgentInteraction(event);
                    break;
                case 'user_session':
                    processedData = await this.processUserSession(event);
                    break;
                case 'productivity_metric':
                    processedData = await this.processProductivityMetric(event);
                    break;
                default:
                    throw new Error(`Unknown event type: ${event.type}`);
            }
            await this.producer.send({
                topic: this.kafkaManager.topics.METRICS_PROCESSED,
                messages: [{
                        key: payload.message.key,
                        value: JSON.stringify({
                            ...event,
                            processed_data: processedData,
                            processed_at: new Date().toISOString()
                        }),
                        headers: payload.message.headers
                    }]
            });
            await this.updateRealTimeCache(event, processedData);
            this.updateAggregationBuffer(event, processedData);
            const processingTime = Date.now() - startTime;
            this.updateProcessingStats(processingTime, true);
            this.logger.debug('Processed raw metrics message', {
                type: event.type,
                organization_id: event.organization_id,
                processing_time_ms: processingTime
            });
        }
        catch (error) {
            const processingTime = Date.now() - startTime;
            this.updateProcessingStats(processingTime, false);
            this.logger.error('Failed to process raw metrics message', {
                partition: payload.partition,
                offset: payload.message.offset,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            await this.sendToDeadLetterQueue(payload, error);
        }
    }
    async processCommandExecution(event) {
        const data = event.data;
        const processedData = {
            ...data,
            executed_at: new Date(event.timestamp),
            success_rate: data.status === 'success' ? 1 : 0,
            error_category: data.status === 'error' ? this.categorizeError(data.error_message) : null,
            performance_tier: this.categorizePerformance(data.execution_time_ms),
            organization_id: event.organization_id
        };
        return processedData;
    }
    async processAgentInteraction(event) {
        const data = event.data;
        const processedData = {
            ...data,
            occurred_at: new Date(event.timestamp),
            token_efficiency: data.input_tokens && data.output_tokens ?
                data.output_tokens / (data.input_tokens + data.output_tokens) : null,
            complexity_level: this.categorizeInteractionComplexity(data),
            organization_id: event.organization_id
        };
        return processedData;
    }
    async processUserSession(event) {
        const data = event.data;
        const processedData = {
            ...data,
            productivity_index: this.calculateProductivityIndex(data),
            session_quality: this.assessSessionQuality(data),
            organization_id: event.organization_id
        };
        return processedData;
    }
    async processProductivityMetric(event) {
        const data = event.data;
        const processedData = {
            ...data,
            recorded_at: new Date(event.timestamp),
            normalized_value: this.normalizeMetricValue(data.metric_type, data.metric_value),
            percentile_rank: await this.calculatePercentileRank(event.organization_id, data),
            organization_id: event.organization_id
        };
        return processedData;
    }
    async updateRealTimeCache(event, processedData) {
        try {
            const cacheKey = `${event.organization_id}:latest`;
            const realTimeData = {
                last_activity: new Date().toISOString(),
                recent_commands: event.type === 'command_execution' ? [processedData] : [],
                recent_interactions: event.type === 'agent_interaction' ? [processedData] : [],
                active_users: await this.getActiveUserCount(event.organization_id),
                performance_summary: await this.getPerformanceSummary(event.organization_id)
            };
            await this.redisManager.storeRealTimeData(event.organization_id, realTimeData);
        }
        catch (error) {
            this.logger.error('Failed to update real-time cache', {
                organization_id: event.organization_id,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    updateAggregationBuffer(event, processedData) {
        const bucketKey = this.getAggregationBucketKey(event);
        if (!this.aggregationBuffer.has(bucketKey)) {
            this.aggregationBuffer.set(bucketKey, {
                time_bucket: this.getTimeBucket(event.timestamp),
                organization_id: event.organization_id,
                user_id: event.user_id,
                command_count: 0,
                avg_execution_time: 0,
                error_rate: 0,
                agent_usage_count: {},
                productivity_score: undefined
            });
        }
        const bucket = this.aggregationBuffer.get(bucketKey);
        switch (event.type) {
            case 'command_execution':
                bucket.command_count++;
                bucket.avg_execution_time = this.updateAverage(bucket.avg_execution_time, processedData.execution_time_ms, bucket.command_count);
                bucket.error_rate = this.updateErrorRate(bucket, processedData.status === 'error');
                break;
            case 'agent_interaction':
                if (!bucket.agent_usage_count[processedData.agent_name]) {
                    bucket.agent_usage_count[processedData.agent_name] = 0;
                }
                bucket.agent_usage_count[processedData.agent_name]++;
                break;
            case 'productivity_metric':
                if (processedData.metric_type === 'productivity_score') {
                    bucket.productivity_score = processedData.metric_value;
                }
                break;
        }
    }
    async flushAggregationBuffer() {
        if (this.aggregationBuffer.size === 0) {
            return;
        }
        try {
            const aggregatedData = Array.from(this.aggregationBuffer.values());
            await this.metricsModel.batchInsertAggregatedMetrics(aggregatedData);
            for (const data of aggregatedData) {
                const cacheKey = `${data.organization_id}:${data.time_bucket.toISOString()}`;
                await this.redisManager.cacheAggregatedMetrics(cacheKey, data);
            }
            const messages = aggregatedData.map(data => ({
                key: `${data.organization_id}:${data.time_bucket.toISOString()}`,
                value: JSON.stringify(data),
                headers: {
                    'organization-id': data.organization_id,
                    'time-bucket': data.time_bucket.toISOString()
                }
            }));
            await this.producer.send({
                topic: this.kafkaManager.topics.METRICS_AGGREGATED,
                messages
            });
            this.aggregationBuffer.clear();
            this.lastAggregation = Date.now();
            this.logger.info('Flushed aggregation buffer', {
                records_processed: aggregatedData.length
            });
        }
        catch (error) {
            this.logger.error('Failed to flush aggregation buffer', {
                buffer_size: this.aggregationBuffer.size,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    async startMetricsAggregator() {
        const consumer = this.kafkaManager.createConsumer('fortium-metrics-aggregator');
        await consumer.connect();
        await consumer.subscribe({ topic: this.kafkaManager.topics.METRICS_PROCESSED, fromBeginning: false });
        await consumer.run({
            partitionsConsumedConcurrently: 2,
            eachMessage: async (payload) => {
                this.logger.debug('Processing aggregation message', {
                    partition: payload.partition,
                    offset: payload.message.offset
                });
            }
        });
        this.consumers.push(consumer);
        this.stats.active_consumers++;
        this.logger.info('Metrics aggregator started');
    }
    async startAlertProcessor() {
        const consumer = this.kafkaManager.createConsumer('fortium-metrics-alerts');
        await consumer.connect();
        await consumer.subscribe({ topic: this.kafkaManager.topics.METRICS_AGGREGATED, fromBeginning: false });
        await consumer.run({
            partitionsConsumedConcurrently: 1,
            eachMessage: async (payload) => {
                const data = JSON.parse(payload.message.value?.toString() || '');
                await this.checkAlertConditions(data);
            }
        });
        this.consumers.push(consumer);
        this.stats.active_consumers++;
        this.logger.info('Alert processor started');
    }
    async checkAlertConditions(aggregatedData) {
        const alerts = [];
        if (aggregatedData.error_rate > 0.1) {
            alerts.push({
                type: 'high_error_rate',
                severity: 'high',
                organization_id: aggregatedData.organization_id,
                metric_value: aggregatedData.error_rate,
                threshold: 0.1,
                message: `Error rate of ${(aggregatedData.error_rate * 100).toFixed(1)}% exceeds threshold`
            });
        }
        if (aggregatedData.productivity_score && aggregatedData.productivity_score < 50) {
            alerts.push({
                type: 'low_productivity',
                severity: 'medium',
                organization_id: aggregatedData.organization_id,
                metric_value: aggregatedData.productivity_score,
                threshold: 50,
                message: `Productivity score of ${aggregatedData.productivity_score} below threshold`
            });
        }
        if (alerts.length > 0) {
            for (const alert of alerts) {
                await this.producer.send({
                    topic: this.kafkaManager.topics.METRICS_ALERTS,
                    messages: [{
                            key: `${alert.organization_id}:${alert.type}`,
                            value: JSON.stringify({
                                ...alert,
                                triggered_at: new Date().toISOString(),
                                time_bucket: aggregatedData.time_bucket
                            })
                        }]
                });
            }
            this.logger.info('Triggered alerts', {
                organization_id: aggregatedData.organization_id,
                alert_count: alerts.length,
                alert_types: alerts.map(a => a.type)
            });
        }
    }
    async sendToDeadLetterQueue(payload, error) {
        try {
            await this.producer.send({
                topic: this.kafkaManager.topics.METRICS_DLQ,
                messages: [{
                        key: payload.message.key,
                        value: payload.message.value,
                        headers: {
                            ...payload.message.headers,
                            'error-message': error.message,
                            'failed-at': new Date().toISOString(),
                            'original-topic': this.kafkaManager.topics.METRICS_RAW,
                            'original-partition': payload.partition.toString(),
                            'original-offset': payload.message.offset
                        }
                    }]
            });
        }
        catch (dlqError) {
            this.logger.error('Failed to send message to DLQ', {
                original_error: error.message,
                dlq_error: dlqError instanceof Error ? dlqError.message : 'Unknown error'
            });
        }
    }
    validateMetricsEvent(event) {
        return event &&
            typeof event.type === 'string' &&
            typeof event.organization_id === 'string' &&
            typeof event.user_id === 'string' &&
            event.data &&
            event.timestamp;
    }
    getPartitionForOrganization(organizationId) {
        let hash = 0;
        for (let i = 0; i < organizationId.length; i++) {
            hash = ((hash << 5) - hash + organizationId.charCodeAt(i)) & 0xffffffff;
        }
        return Math.abs(hash) % 12;
    }
    getAggregationBucketKey(event) {
        const timeBucket = this.getTimeBucket(event.timestamp);
        return `${event.organization_id}:${event.user_id}:${timeBucket.toISOString()}`;
    }
    getTimeBucket(timestamp) {
        const bucket = new Date(timestamp);
        bucket.setSeconds(0, 0);
        return bucket;
    }
    updateAverage(currentAvg, newValue, count) {
        return ((currentAvg * (count - 1)) + newValue) / count;
    }
    updateErrorRate(bucket, isError) {
        const totalCommands = bucket.command_count;
        const currentErrors = bucket.error_rate * (totalCommands - 1);
        const newErrors = currentErrors + (isError ? 1 : 0);
        return newErrors / totalCommands;
    }
    categorizeError(errorMessage) {
        if (!errorMessage)
            return 'unknown';
        if (errorMessage.includes('timeout'))
            return 'timeout';
        if (errorMessage.includes('network'))
            return 'network';
        if (errorMessage.includes('validation'))
            return 'validation';
        if (errorMessage.includes('auth'))
            return 'authentication';
        return 'other';
    }
    categorizePerformance(executionTimeMs) {
        if (executionTimeMs < 1000)
            return 'fast';
        if (executionTimeMs < 5000)
            return 'medium';
        if (executionTimeMs < 15000)
            return 'slow';
        return 'very_slow';
    }
    categorizeInteractionComplexity(data) {
        const tokens = (data.input_tokens || 0) + (data.output_tokens || 0);
        if (tokens < 100)
            return 'simple';
        if (tokens < 500)
            return 'medium';
        if (tokens < 2000)
            return 'complex';
        return 'very_complex';
    }
    calculateProductivityIndex(data) {
        const baseScore = 50;
        const commandsBonus = Math.min(data.commands_executed * 2, 30);
        const durationPenalty = Math.max(0, (data.duration_minutes - 60) * 0.1);
        return Math.max(0, Math.min(100, baseScore + commandsBonus - durationPenalty));
    }
    assessSessionQuality(data) {
        const productivityIndex = this.calculateProductivityIndex(data);
        if (productivityIndex >= 80)
            return 'excellent';
        if (productivityIndex >= 60)
            return 'good';
        if (productivityIndex >= 40)
            return 'fair';
        return 'poor';
    }
    normalizeMetricValue(metricType, value) {
        switch (metricType) {
            case 'productivity_score':
                return Math.min(100, Math.max(0, value));
            case 'error_rate':
                return (1 - Math.min(1, Math.max(0, value))) * 100;
            case 'commands_per_hour':
                return Math.min(100, value / 10);
            default:
                return value;
        }
    }
    async calculatePercentileRank(organizationId, data) {
        return Math.floor(Math.random() * 100);
    }
    async getActiveUserCount(organizationId) {
        return Math.floor(Math.random() * 20) + 1;
    }
    async getPerformanceSummary(organizationId) {
        return {
            avg_response_time: Math.floor(Math.random() * 1000) + 500,
            success_rate: 0.95 + (Math.random() * 0.05),
            active_agents: Math.floor(Math.random() * 10) + 1
        };
    }
    updateProcessingStats(processingTimeMs, success) {
        this.stats.last_processed_at = new Date();
        if (success) {
            this.stats.messages_processed++;
        }
        else {
            this.stats.messages_failed++;
        }
        const totalMessages = this.stats.messages_processed + this.stats.messages_failed;
        this.stats.avg_processing_time_ms =
            ((this.stats.avg_processing_time_ms * (totalMessages - 1)) + processingTimeMs) / totalMessages;
        this.stats.processing_rate = this.stats.messages_processed / 60;
    }
    getProcessingStats() {
        return { ...this.stats };
    }
    async healthCheck() {
        try {
            const kafkaHealth = await this.kafkaManager.healthCheck();
            const redisHealth = await this.redisManager.healthCheck();
            const isHealthy = kafkaHealth.status === 'healthy' &&
                redisHealth.status === 'healthy' &&
                this.isRunning;
            return {
                status: isHealthy ? 'healthy' : 'unhealthy',
                details: {
                    pipeline_running: this.isRunning,
                    kafka: kafkaHealth,
                    redis: redisHealth,
                    processing_stats: this.stats,
                    aggregation_buffer_size: this.aggregationBuffer.size,
                    last_aggregation: new Date(this.lastAggregation).toISOString()
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
exports.MetricsProcessingService = MetricsProcessingService;
//# sourceMappingURL=metrics-processing.service.js.map