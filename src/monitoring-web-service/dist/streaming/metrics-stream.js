"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsStream = void 0;
const events_1 = __importDefault(require("events"));
class MetricsStream extends events_1.default {
    eventPublisher;
    redisManager;
    db;
    logger;
    config;
    metricsBuffer = new Map();
    activeStreams = new Map();
    flushTimers = new Map();
    metricsCache = new Map();
    updateFrequencyTracking = new Map();
    constructor(eventPublisher, redisManager, db, logger, config) {
        super();
        this.eventPublisher = eventPublisher;
        this.redisManager = redisManager;
        this.db = db;
        this.logger = logger;
        this.config = config;
        this.startBackgroundProcessing();
    }
    async streamMetric(metric) {
        try {
            const metricKey = this.generateMetricKey(metric);
            const startTime = Date.now();
            await this.updateActiveStream(metricKey, metric);
            const stream = this.activeStreams.get(metricKey);
            if (!stream) {
                return { success: false, buffered: false, streamed: false };
            }
            const shouldStreamImmediately = this.shouldStreamImmediately(metric, stream);
            if (shouldStreamImmediately) {
                const streamResult = await this.streamMetricImmediately(metric, stream);
                this.addToBuffer(metric);
                return {
                    success: true,
                    buffered: true,
                    streamed: true,
                    subscribers: streamResult.subscribers
                };
            }
            else {
                this.addToBuffer(metric);
                return {
                    success: true,
                    buffered: true,
                    streamed: false
                };
            }
        }
        catch (error) {
            this.logger.error('Failed to stream metric:', error);
            return { success: false, buffered: false, streamed: false };
        }
    }
    async streamMetricsBatch(metrics) {
        try {
            let processedCount = 0;
            let streamedCount = 0;
            let bufferedCount = 0;
            const metricsByOrg = this.groupMetricsByOrganization(metrics);
            for (const [organizationId, orgMetrics] of metricsByOrg.entries()) {
                for (const metric of orgMetrics) {
                    const result = await this.streamMetric(metric);
                    if (result.success) {
                        processedCount++;
                        if (result.streamed)
                            streamedCount++;
                        if (result.buffered)
                            bufferedCount++;
                    }
                }
                if (orgMetrics.length > this.config.bufferSize / 2) {
                    await this.flushBuffer(organizationId);
                }
            }
            this.logger.debug('Metrics batch processed', {
                totalMetrics: metrics.length,
                processed: processedCount,
                streamed: streamedCount,
                buffered: bufferedCount
            });
            return {
                success: true,
                processedCount,
                streamedCount,
                bufferedCount
            };
        }
        catch (error) {
            this.logger.error('Failed to process metrics batch:', error);
            return {
                success: false,
                processedCount: 0,
                streamedCount: 0,
                bufferedCount: 0
            };
        }
    }
    async getRealTimeMetrics(organizationId, metricNames, timeRange) {
        try {
            const orgStreams = Array.from(this.activeStreams.values()).filter(stream => stream.organizationId === organizationId);
            const filteredStreams = metricNames
                ? orgStreams.filter(stream => metricNames.includes(stream.name))
                : orgStreams;
            const chartData = await this.getTimeSeriesData(organizationId, metricNames, timeRange);
            const avgUpdateFreq = filteredStreams.reduce((sum, stream) => sum + stream.updateFrequency, 0) / filteredStreams.length || 0;
            const lastUpdated = filteredStreams.reduce((latest, stream) => stream.lastUpdated > latest ? stream.lastUpdated : latest, new Date(0));
            return {
                metrics: filteredStreams,
                chartData,
                updateFrequency: avgUpdateFreq,
                lastUpdated
            };
        }
        catch (error) {
            this.logger.error('Failed to get real-time metrics:', error);
            return {
                metrics: [],
                chartData: [],
                updateFrequency: 0,
                lastUpdated: new Date()
            };
        }
    }
    async subscribeToMetric(organizationId, metricName, options = {}) {
        try {
            const metricKey = `${organizationId}:${metricName}`;
            const stream = this.activeStreams.get(metricKey);
            if (stream) {
                if (options.updateFrequency) {
                    stream.updateFrequency = Math.min(options.updateFrequency, this.config.maxUpdateFrequency);
                }
            }
            else {
                this.activeStreams.set(metricKey, {
                    name: metricName,
                    organizationId,
                    type: 'gauge',
                    currentValue: null,
                    updateFrequency: options.updateFrequency || 1,
                    lastUpdated: new Date(),
                    subscribers: 1
                });
            }
            const subscriptionId = await this.setupMetricSubscription(organizationId, metricName, options);
            return {
                success: true,
                subscriptionId,
                currentValue: stream?.currentValue
            };
        }
        catch (error) {
            this.logger.error('Failed to subscribe to metric:', error);
            return { success: false };
        }
    }
    getMetricStats() {
        const totalBuffered = Array.from(this.metricsBuffer.values()).reduce((sum, buffer) => sum + buffer.size, 0);
        const avgUpdateFreq = Array.from(this.activeStreams.values()).reduce((sum, stream) => sum + stream.updateFrequency, 0) / this.activeStreams.size || 0;
        const bufferCapacity = this.config.bufferSize * this.metricsBuffer.size;
        const bufferUtilization = bufferCapacity > 0 ? (totalBuffered / bufferCapacity) * 100 : 0;
        const topMetrics = Array.from(this.activeStreams.values())
            .sort((a, b) => b.updateFrequency - a.updateFrequency)
            .slice(0, 10)
            .map(stream => ({
            name: stream.name,
            updateFreq: stream.updateFrequency,
            subscribers: stream.subscribers
        }));
        return {
            activeStreams: this.activeStreams.size,
            totalMetricsBuffered: totalBuffered,
            bufferUtilization,
            averageUpdateFrequency: avgUpdateFreq,
            topMetrics
        };
    }
    async streamMetricImmediately(metric, stream) {
        try {
            const streamData = {
                metric: {
                    name: metric.name,
                    type: metric.type,
                    value: metric.value,
                    unit: metric.unit,
                    tags: metric.tags,
                    timestamp: metric.timestamp
                },
                stream: {
                    currentValue: stream.currentValue,
                    previousValue: stream.previousValue,
                    trend: stream.trend,
                    changePercent: stream.changePercent
                },
                metadata: metric.metadata
            };
            const result = await this.eventPublisher.publishMetricsUpdate(metric.organizationId, metric.type, streamData);
            this.logger.debug('Metric streamed immediately', {
                metricName: metric.name,
                organizationId: metric.organizationId,
                value: metric.value,
                success: result.success
            });
            return {
                success: result.success,
                subscribers: result.recipientCount || 0
            };
        }
        catch (error) {
            this.logger.error('Failed to stream metric immediately:', error);
            return { success: false, subscribers: 0 };
        }
    }
    shouldStreamImmediately(metric, stream) {
        if (stream.updateFrequency > 1)
            return true;
        if (metric.type === 'timer' || metric.type === 'counter')
            return true;
        if (stream.subscribers > 5)
            return true;
        if (typeof metric.value === 'number' && typeof stream.currentValue === 'number') {
            const changePercent = Math.abs((metric.value - stream.currentValue) / stream.currentValue) * 100;
            if (changePercent > 10)
                return true;
        }
        return false;
    }
    addToBuffer(metric) {
        const orgId = metric.organizationId;
        if (!this.metricsBuffer.has(orgId)) {
            this.metricsBuffer.set(orgId, {
                metrics: [],
                size: 0,
                startTime: new Date(),
                endTime: new Date()
            });
        }
        const buffer = this.metricsBuffer.get(orgId);
        buffer.metrics.push(metric);
        buffer.size++;
        buffer.endTime = metric.timestamp;
        if (!this.flushTimers.has(orgId)) {
            const timer = setTimeout(() => {
                this.flushBuffer(orgId);
            }, this.config.flushInterval);
            this.flushTimers.set(orgId, timer);
        }
        if (buffer.size >= this.config.bufferSize) {
            this.flushBuffer(orgId);
        }
    }
    async flushBuffer(organizationId) {
        try {
            const buffer = this.metricsBuffer.get(organizationId);
            if (!buffer || buffer.size === 0)
                return;
            const timer = this.flushTimers.get(organizationId);
            if (timer) {
                clearTimeout(timer);
                this.flushTimers.delete(organizationId);
            }
            if (this.config.compressionEnabled) {
                await this.compressBuffer(buffer);
            }
            const batchData = {
                organizationId,
                metrics: buffer.metrics,
                timeRange: {
                    start: buffer.startTime,
                    end: buffer.endTime
                },
                compressed: this.config.compressionEnabled,
                compressionRatio: buffer.compressionRatio
            };
            await this.eventPublisher.publishEvent({
                type: 'metrics_updated',
                source: 'metrics-stream',
                organizationId,
                data: batchData,
                routing: {
                    rooms: [`org:${organizationId}`, `metrics:${organizationId}:batch`]
                },
                priority: 'medium',
                tags: ['metrics', 'batch', 'streaming']
            });
            await this.updateTimeSeriesCache(organizationId, buffer.metrics);
            this.metricsBuffer.set(organizationId, {
                metrics: [],
                size: 0,
                startTime: new Date(),
                endTime: new Date()
            });
            this.logger.debug('Metrics buffer flushed', {
                organizationId,
                metricCount: buffer.size,
                timeSpan: buffer.endTime.getTime() - buffer.startTime.getTime()
            });
        }
        catch (error) {
            this.logger.error('Failed to flush metrics buffer:', error);
        }
    }
    async updateActiveStream(metricKey, metric) {
        let stream = this.activeStreams.get(metricKey);
        if (!stream) {
            stream = {
                name: metric.name,
                organizationId: metric.organizationId,
                type: metric.type,
                currentValue: metric.value,
                updateFrequency: 1,
                lastUpdated: metric.timestamp,
                subscribers: 0
            };
        }
        else {
            stream.previousValue = stream.currentValue;
            stream.currentValue = metric.value;
            stream.lastUpdated = metric.timestamp;
            if (typeof metric.value === 'number' && typeof stream.previousValue === 'number') {
                const change = metric.value - stream.previousValue;
                stream.trend = change > 0 ? 'up' : change < 0 ? 'down' : 'stable';
                stream.changePercent = stream.previousValue !== 0
                    ? (change / stream.previousValue) * 100
                    : 0;
            }
            this.updateFrequencyTracking(metricKey, metric.timestamp);
        }
        this.activeStreams.set(metricKey, stream);
    }
    updateFrequencyTracking(metricKey, timestamp) {
        if (!this.updateFrequencyTracking.has(metricKey)) {
            this.updateFrequencyTracking.set(metricKey, []);
        }
        const timestamps = this.updateFrequencyTracking.get(metricKey);
        timestamps.push(timestamp.getTime());
        const cutoff = Date.now() - 60000;
        const recentTimestamps = timestamps.filter(ts => ts > cutoff);
        this.updateFrequencyTracking.set(metricKey, recentTimestamps);
        const stream = this.activeStreams.get(metricKey);
        if (stream && recentTimestamps.length > 1) {
            stream.updateFrequency = recentTimestamps.length / 60;
        }
    }
    generateMetricKey(metric) {
        const tags = Object.entries(metric.tags)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}=${v}`)
            .join(',');
        return `${metric.organizationId}:${metric.name}:${tags}`;
    }
    groupMetricsByOrganization(metrics) {
        const grouped = new Map();
        for (const metric of metrics) {
            if (!grouped.has(metric.organizationId)) {
                grouped.set(metric.organizationId, []);
            }
            grouped.get(metric.organizationId).push(metric);
        }
        return grouped;
    }
    async compressBuffer(buffer) {
        const originalSize = buffer.metrics.length;
        const compressed = [];
        for (let i = 0; i < buffer.metrics.length; i++) {
            const current = buffer.metrics[i];
            const next = buffer.metrics[i + 1];
            if (i === 0 ||
                i === buffer.metrics.length - 1 ||
                !next ||
                current.value !== next.value) {
                compressed.push(current);
            }
        }
        buffer.metrics = compressed;
        buffer.size = compressed.length;
        buffer.compressionRatio = buffer.size / originalSize;
    }
    async updateTimeSeriesCache(organizationId, metrics) {
        try {
            const cacheKey = `timeseries:${organizationId}`;
            if (!this.metricsCache.has(cacheKey)) {
                this.metricsCache.set(cacheKey, []);
            }
            const cached = this.metricsCache.get(cacheKey);
            cached.push(...metrics);
            const cutoff = Date.now() - this.config.retentionPeriod;
            const recent = cached.filter(m => m.timestamp.getTime() > cutoff);
            this.metricsCache.set(cacheKey, recent);
            const redisKey = `metrics:timeseries:${organizationId}`;
            const pipeline = this.redisManager.client.pipeline();
            for (const metric of metrics) {
                pipeline.zadd(redisKey, metric.timestamp.getTime(), JSON.stringify(metric));
            }
            pipeline.expire(redisKey, this.config.retentionPeriod / 1000);
            await pipeline.exec();
        }
        catch (error) {
            this.logger.warn('Failed to update time-series cache:', error);
        }
    }
    async getTimeSeriesData(organizationId, metricNames, timeRange) {
        try {
            const redisKey = `metrics:timeseries:${organizationId}`;
            const start = timeRange?.start?.getTime() || (Date.now() - 3600000);
            const end = timeRange?.end?.getTime() || Date.now();
            const rawData = await this.redisManager.client.zrangebyscore(redisKey, start, end);
            const metrics = rawData
                .map(data => {
                try {
                    return JSON.parse(data);
                }
                catch {
                    return null;
                }
            })
                .filter((metric) => metric !== null &&
                (!metricNames || metricNames.includes(metric.name)));
            const chartData = this.groupMetricsForChart(metrics);
            return chartData;
        }
        catch (error) {
            this.logger.error('Failed to get time-series data:', error);
            return [];
        }
    }
    groupMetricsForChart(metrics) {
        const grouped = new Map();
        for (const metric of metrics) {
            const key = `${metric.name}_${metric.type}`;
            if (!grouped.has(key)) {
                grouped.set(key, []);
            }
            grouped.get(key).push({
                x: metric.timestamp,
                y: metric.value,
                tags: metric.tags,
                unit: metric.unit
            });
        }
        return Array.from(grouped.entries()).map(([name, data]) => ({
            name,
            data: data.sort((a, b) => a.x.getTime() - b.x.getTime())
        }));
    }
    async setupMetricSubscription(organizationId, metricName, options) {
        return `sub_${organizationId}_${metricName}_${Date.now()}`;
    }
    startBackgroundProcessing() {
        setInterval(() => {
            for (const organizationId of this.metricsBuffer.keys()) {
                const buffer = this.metricsBuffer.get(organizationId);
                if (buffer && buffer.size > 0) {
                    const idleTime = Date.now() - buffer.endTime.getTime();
                    if (idleTime > this.config.flushInterval) {
                        this.flushBuffer(organizationId);
                    }
                }
            }
        }, this.config.flushInterval / 2);
        setInterval(() => {
            this.performCleanup();
        }, 300000);
    }
    performCleanup() {
        const now = Date.now();
        const inactivityThreshold = 300000;
        for (const [key, stream] of this.activeStreams.entries()) {
            if (now - stream.lastUpdated.getTime() > inactivityThreshold) {
                this.activeStreams.delete(key);
                this.updateFrequencyTracking.delete(key);
            }
        }
        for (const [key, metrics] of this.metricsCache.entries()) {
            const cutoff = now - this.config.retentionPeriod;
            const recent = metrics.filter(m => m.timestamp.getTime() > cutoff);
            this.metricsCache.set(key, recent);
        }
    }
    async shutdown() {
        this.logger.info('Shutting down Metrics Stream...');
        const flushPromises = Array.from(this.metricsBuffer.keys()).map(orgId => this.flushBuffer(orgId));
        await Promise.allSettled(flushPromises);
        for (const timer of this.flushTimers.values()) {
            clearTimeout(timer);
        }
        this.metricsBuffer.clear();
        this.activeStreams.clear();
        this.flushTimers.clear();
        this.metricsCache.clear();
        this.updateFrequencyTracking.clear();
        this.logger.info('Metrics Stream shutdown complete');
    }
}
exports.MetricsStream = MetricsStream;
//# sourceMappingURL=metrics-stream.js.map