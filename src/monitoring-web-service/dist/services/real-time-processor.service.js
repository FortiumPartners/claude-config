"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealTimeProcessorService = void 0;
const events_1 = require("events");
const metrics_model_1 = require("../models/metrics.model");
class RealTimeProcessorService extends events_1.EventEmitter {
    metricsModel;
    logger;
    config;
    aggregationBuckets = new Map();
    deadLetterQueue = [];
    stats = {
        events_processed: 0,
        events_failed: 0,
        aggregations_created: 0,
        memory_usage_mb: 0,
        avg_processing_time_ms: 0,
        last_flush: new Date(),
        uptime_seconds: 0
    };
    startTime = new Date();
    flushInterval;
    memoryMonitorInterval;
    constructor(db, logger, config = {}) {
        super();
        this.metricsModel = new metrics_model_1.MetricsModel(db);
        this.logger = logger;
        this.config = {
            aggregationWindows: ['1m', '5m', '15m', '1h'],
            maxMemoryUsageMB: 512,
            batchSize: 100,
            flushIntervalMs: 30000,
            deadLetterQueueSize: 10000,
            retryAttempts: 3,
            retryDelayMs: 5000,
            ...config
        };
        this.config.aggregationWindows.forEach(window => {
            this.aggregationBuckets.set(window, new Map());
        });
        this.startProcessing();
    }
    startProcessing() {
        this.flushInterval = setInterval(() => {
            this.flushAggregations().catch(error => {
                this.logger.error('Failed to flush aggregations', { error: error.message });
            });
        }, this.config.flushIntervalMs);
        this.memoryMonitorInterval = setInterval(() => {
            this.monitorMemoryUsage();
        }, 10000);
        setInterval(() => {
            this.processDeadLetterQueue().catch(error => {
                this.logger.error('Failed to process dead letter queue', { error: error.message });
            });
        }, this.config.retryDelayMs);
        this.logger.info('Real-time processor started', {
            aggregation_windows: this.config.aggregationWindows,
            flush_interval_ms: this.config.flushIntervalMs,
            max_memory_mb: this.config.maxMemoryUsageMB
        });
    }
    async processStreamEvent(event) {
        const startTime = Date.now();
        try {
            this.validateStreamEvent(event);
            switch (event.type) {
                case 'command_execution':
                    await this.processCommandExecution(event);
                    break;
                case 'agent_interaction':
                    await this.processAgentInteraction(event);
                    break;
                case 'user_session':
                    await this.processUserSession(event);
                    break;
                case 'productivity_metric':
                    await this.processProductivityMetric(event);
                    break;
                default:
                    throw new Error(`Unknown event type: ${event.type}`);
            }
            const processingTime = Date.now() - startTime;
            this.updateProcessingStats(processingTime, true);
            this.emit('event_processed', { event, processing_time: processingTime });
        }
        catch (error) {
            const processingTime = Date.now() - startTime;
            this.updateProcessingStats(processingTime, false);
            this.logger.error('Failed to process stream event', {
                event_type: event.type,
                organization_id: event.organization_id,
                error: error instanceof Error ? error.message : 'Unknown error',
                processing_time_ms: processingTime
            });
            this.addToDeadLetterQueue(event, error instanceof Error ? error.message : 'Unknown error');
            this.emit('event_failed', { event, error, processing_time: processingTime });
        }
    }
    async processBatchEvents(events) {
        const startTime = Date.now();
        let processed = 0;
        let failed = 0;
        const chunkSize = Math.min(this.config.batchSize, events.length);
        for (let i = 0; i < events.length; i += chunkSize) {
            const chunk = events.slice(i, i + chunkSize);
            await Promise.allSettled(chunk.map(async (event) => {
                try {
                    await this.processStreamEvent(event);
                    processed++;
                }
                catch (error) {
                    failed++;
                }
            }));
            if (this.stats.memory_usage_mb > this.config.maxMemoryUsageMB * 0.8) {
                this.logger.warn('High memory usage detected, triggering early flush', {
                    memory_usage_mb: this.stats.memory_usage_mb,
                    max_memory_mb: this.config.maxMemoryUsageMB
                });
                await this.flushAggregations();
            }
        }
        const processingTime = Date.now() - startTime;
        this.logger.info('Batch processing completed', {
            total_events: events.length,
            processed,
            failed,
            processing_time_ms: processingTime
        });
        return { processed, failed, processing_time_ms: processingTime };
    }
    async processCommandExecution(event) {
        const data = event.data;
        for (const window of this.config.aggregationWindows) {
            const bucketKey = this.generateBucketKey(event.timestamp, window, event.organization_id, event.user_id);
            const bucket = this.getOrCreateBucket(window, bucketKey, event.timestamp, event.organization_id, event.user_id);
            bucket.command_count++;
            bucket.total_execution_time += data.execution_time_ms || 0;
            if (data.status === 'error') {
                bucket.error_count++;
            }
            bucket.last_updated = new Date();
        }
        this.emit('command_execution_processed', {
            organization_id: event.organization_id,
            user_id: event.user_id,
            command_name: data.command_name,
            execution_time_ms: data.execution_time_ms,
            status: data.status,
            timestamp: event.timestamp
        });
    }
    async processAgentInteraction(event) {
        const data = event.data;
        for (const window of this.config.aggregationWindows) {
            const bucketKey = this.generateBucketKey(event.timestamp, window, event.organization_id, event.user_id);
            const bucket = this.getOrCreateBucket(window, bucketKey, event.timestamp, event.organization_id, event.user_id);
            bucket.agent_interactions++;
            bucket.total_execution_time += data.execution_time_ms || 0;
            if (data.status === 'error') {
                bucket.error_count++;
            }
            const currentUsage = bucket.agent_usage.get(data.agent_name) || 0;
            bucket.agent_usage.set(data.agent_name, currentUsage + 1);
            bucket.last_updated = new Date();
        }
        this.emit('agent_interaction_processed', {
            organization_id: event.organization_id,
            user_id: event.user_id,
            agent_name: data.agent_name,
            interaction_type: data.interaction_type,
            execution_time_ms: data.execution_time_ms,
            status: data.status,
            timestamp: event.timestamp
        });
    }
    async processUserSession(event) {
        const data = event.data;
        this.emit('user_session_processed', {
            organization_id: event.organization_id,
            user_id: event.user_id,
            timestamp: event.timestamp
        });
    }
    async processProductivityMetric(event) {
        const data = event.data;
        if (data.metric_type === 'productivity_score') {
            for (const window of this.config.aggregationWindows) {
                const bucketKey = this.generateBucketKey(event.timestamp, window, event.organization_id, event.user_id);
                const bucket = this.getOrCreateBucket(window, bucketKey, event.timestamp, event.organization_id, event.user_id);
                bucket.productivity_scores.push(data.metric_value);
                bucket.last_updated = new Date();
            }
        }
        this.emit('productivity_metric_processed', {
            organization_id: event.organization_id,
            user_id: event.user_id,
            metric_type: data.metric_type,
            metric_value: data.metric_value,
            timestamp: event.timestamp
        });
    }
    getCurrentAggregations(organizationId, window = '1h', userId) {
        const windowBuckets = this.aggregationBuckets.get(window);
        if (!windowBuckets)
            return [];
        const aggregations = [];
        for (const [bucketKey, bucket] of windowBuckets) {
            if (bucket.organization_id === organizationId &&
                (!userId || bucket.user_id === userId)) {
                const agentUsageObj = {};
                bucket.agent_usage.forEach((count, agentName) => {
                    agentUsageObj[agentName] = count;
                });
                aggregations.push({
                    time_bucket: bucket.window_start,
                    organization_id: bucket.organization_id,
                    user_id: bucket.user_id,
                    team_id: bucket.team_id,
                    project_id: bucket.project_id,
                    command_count: bucket.command_count,
                    avg_execution_time: bucket.command_count > 0 ?
                        bucket.total_execution_time / bucket.command_count : 0,
                    error_rate: bucket.command_count > 0 ?
                        bucket.error_count / bucket.command_count : 0,
                    agent_usage_count: agentUsageObj,
                    productivity_score: bucket.productivity_scores.length > 0 ?
                        bucket.productivity_scores.reduce((a, b) => a + b, 0) / bucket.productivity_scores.length : undefined
                });
            }
        }
        return aggregations.sort((a, b) => b.time_bucket.getTime() - a.time_bucket.getTime());
    }
    async flushAggregations() {
        const startTime = Date.now();
        let totalFlushed = 0;
        try {
            for (const [window, buckets] of this.aggregationBuckets) {
                const windowEndThreshold = this.getWindowEndThreshold(window);
                const bucketsToFlush = [];
                const keysToDelete = [];
                for (const [bucketKey, bucket] of buckets) {
                    if (bucket.window_end <= windowEndThreshold) {
                        bucketsToFlush.push(bucket);
                        keysToDelete.push(bucketKey);
                    }
                }
                if (bucketsToFlush.length > 0) {
                    await this.persistAggregations(bucketsToFlush, window);
                    totalFlushed += bucketsToFlush.length;
                    keysToDelete.forEach(key => buckets.delete(key));
                }
            }
            const flushTime = Date.now() - startTime;
            this.stats.last_flush = new Date();
            this.stats.aggregations_created += totalFlushed;
            if (totalFlushed > 0) {
                this.logger.info('Aggregations flushed to database', {
                    aggregations_flushed: totalFlushed,
                    flush_time_ms: flushTime
                });
            }
            this.emit('aggregations_flushed', { count: totalFlushed, flush_time_ms: flushTime });
        }
        catch (error) {
            this.logger.error('Failed to flush aggregations', {
                error: error instanceof Error ? error.message : 'Unknown error',
                aggregations_pending: totalFlushed
            });
            throw error;
        }
    }
    validateStreamEvent(event) {
        if (!event.organization_id || !event.user_id || !event.type || !event.data) {
            throw new Error('Invalid stream event: missing required fields');
        }
        if (!event.timestamp) {
            event.timestamp = new Date();
        }
    }
    generateBucketKey(timestamp, window, organizationId, userId) {
        const windowStart = this.getWindowStart(timestamp, window);
        return `${organizationId}:${userId}:${windowStart.toISOString()}`;
    }
    getOrCreateBucket(window, bucketKey, timestamp, organizationId, userId) {
        const windowBuckets = this.aggregationBuckets.get(window);
        let bucket = windowBuckets.get(bucketKey);
        if (!bucket) {
            const windowStart = this.getWindowStart(timestamp, window);
            const windowEnd = this.getWindowEnd(windowStart, window);
            bucket = {
                window_start: windowStart,
                window_end: windowEnd,
                organization_id: organizationId,
                user_id: userId,
                command_count: 0,
                agent_interactions: 0,
                total_execution_time: 0,
                error_count: 0,
                agent_usage: new Map(),
                productivity_scores: [],
                last_updated: new Date()
            };
            windowBuckets.set(bucketKey, bucket);
        }
        return bucket;
    }
    getWindowStart(timestamp, window) {
        const date = new Date(timestamp);
        switch (window) {
            case '1m':
                date.setSeconds(0, 0);
                break;
            case '5m':
                date.setMinutes(Math.floor(date.getMinutes() / 5) * 5, 0, 0);
                break;
            case '15m':
                date.setMinutes(Math.floor(date.getMinutes() / 15) * 15, 0, 0);
                break;
            case '1h':
                date.setMinutes(0, 0, 0);
                break;
            case '1d':
                date.setHours(0, 0, 0, 0);
                break;
        }
        return date;
    }
    getWindowEnd(windowStart, window) {
        const date = new Date(windowStart);
        switch (window) {
            case '1m':
                date.setMinutes(date.getMinutes() + 1);
                break;
            case '5m':
                date.setMinutes(date.getMinutes() + 5);
                break;
            case '15m':
                date.setMinutes(date.getMinutes() + 15);
                break;
            case '1h':
                date.setHours(date.getHours() + 1);
                break;
            case '1d':
                date.setDate(date.getDate() + 1);
                break;
        }
        return date;
    }
    getWindowEndThreshold(window) {
        const now = new Date();
        now.setMinutes(now.getMinutes() - 1);
        return now;
    }
    async persistAggregations(buckets, window) {
        const metrics = [];
        for (const bucket of buckets) {
            if (bucket.command_count > 0) {
                const commandsPerHour = this.calculateRate(bucket.command_count, window);
                metrics.push({
                    organization_id: bucket.organization_id,
                    user_id: bucket.user_id,
                    metric_type: 'commands_per_hour',
                    metric_value: commandsPerHour,
                    metric_unit: 'commands/hour',
                    dimensions: { window, aggregation: true },
                    recorded_at: bucket.window_start
                });
            }
            if (bucket.command_count > 0) {
                metrics.push({
                    organization_id: bucket.organization_id,
                    user_id: bucket.user_id,
                    metric_type: 'error_rate',
                    metric_value: bucket.error_count / bucket.command_count,
                    metric_unit: 'percentage',
                    dimensions: { window, aggregation: true },
                    recorded_at: bucket.window_start
                });
            }
            if (bucket.command_count > 0) {
                metrics.push({
                    organization_id: bucket.organization_id,
                    user_id: bucket.user_id,
                    metric_type: 'response_time',
                    metric_value: bucket.total_execution_time / bucket.command_count,
                    metric_unit: 'milliseconds',
                    dimensions: { window, aggregation: true },
                    recorded_at: bucket.window_start
                });
            }
            if (bucket.productivity_scores.length > 0) {
                const avgScore = bucket.productivity_scores.reduce((a, b) => a + b, 0) / bucket.productivity_scores.length;
                metrics.push({
                    organization_id: bucket.organization_id,
                    user_id: bucket.user_id,
                    metric_type: 'productivity_score',
                    metric_value: avgScore,
                    metric_unit: 'score',
                    dimensions: { window, aggregation: true },
                    recorded_at: bucket.window_start
                });
            }
        }
        if (metrics.length > 0) {
            for (const metric of metrics) {
                await this.metricsModel.createProductivityMetric(metric.organization_id, metric);
            }
        }
    }
    calculateRate(count, window) {
        const windowMinutes = this.getWindowMinutes(window);
        return (count / windowMinutes) * 60;
    }
    getWindowMinutes(window) {
        switch (window) {
            case '1m': return 1;
            case '5m': return 5;
            case '15m': return 15;
            case '1h': return 60;
            case '1d': return 1440;
            default: return 60;
        }
    }
    addToDeadLetterQueue(event, error) {
        if (this.deadLetterQueue.length >= this.config.deadLetterQueueSize) {
            this.deadLetterQueue.shift();
        }
        this.deadLetterQueue.push({
            event,
            error,
            timestamp: new Date(),
            retries: 0
        });
    }
    async processDeadLetterQueue() {
        const now = new Date();
        const retryDelay = this.config.retryDelayMs;
        for (let i = this.deadLetterQueue.length - 1; i >= 0; i--) {
            const entry = this.deadLetterQueue[i];
            if (now.getTime() - entry.timestamp.getTime() >= retryDelay) {
                if (entry.retries < this.config.retryAttempts) {
                    try {
                        await this.processStreamEvent(entry.event);
                        this.deadLetterQueue.splice(i, 1);
                        this.logger.info('Dead letter queue entry processed successfully', {
                            event_type: entry.event.type,
                            retries: entry.retries + 1
                        });
                    }
                    catch (error) {
                        entry.retries++;
                        entry.timestamp = now;
                        if (entry.retries >= this.config.retryAttempts) {
                            this.deadLetterQueue.splice(i, 1);
                            this.logger.error('Dead letter queue entry exceeded max retries', {
                                event_type: entry.event.type,
                                retries: entry.retries,
                                error: error instanceof Error ? error.message : 'Unknown error'
                            });
                        }
                    }
                }
                else {
                    this.deadLetterQueue.splice(i, 1);
                }
            }
        }
    }
    updateProcessingStats(processingTimeMs, success) {
        if (success) {
            this.stats.events_processed++;
            const totalProcessed = this.stats.events_processed;
            this.stats.avg_processing_time_ms =
                ((this.stats.avg_processing_time_ms * (totalProcessed - 1)) + processingTimeMs) / totalProcessed;
        }
        else {
            this.stats.events_failed++;
        }
        this.stats.uptime_seconds = Math.floor((Date.now() - this.startTime.getTime()) / 1000);
    }
    monitorMemoryUsage() {
        const memoryUsage = process.memoryUsage();
        this.stats.memory_usage_mb = Math.round(memoryUsage.heapUsed / 1024 / 1024);
        if (this.stats.memory_usage_mb > this.config.maxMemoryUsageMB * 0.9) {
            this.emit('high_memory_usage', {
                current_mb: this.stats.memory_usage_mb,
                max_mb: this.config.maxMemoryUsageMB
            });
        }
    }
    getProcessingStats() {
        return { ...this.stats };
    }
    getDeadLetterQueueStatus() {
        return {
            size: this.deadLetterQueue.length,
            max_size: this.config.deadLetterQueueSize,
            oldest_entry: this.deadLetterQueue.length > 0 ? this.deadLetterQueue[0].timestamp : null
        };
    }
    getBucketStats() {
        const stats = {};
        for (const [window, buckets] of this.aggregationBuckets) {
            stats[`${window}_buckets`] = buckets.size;
        }
        return stats;
    }
    async shutdown() {
        this.logger.info('Shutting down real-time processor');
        clearInterval(this.flushInterval);
        clearInterval(this.memoryMonitorInterval);
        await this.flushAggregations();
        this.emit('shutdown');
    }
}
exports.RealTimeProcessorService = RealTimeProcessorService;
//# sourceMappingURL=real-time-processor.service.js.map