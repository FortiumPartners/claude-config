/**
 * Metrics Stream - Sprint 5 Task 5.3
 * Real-time metrics data streaming with intelligent buffering
 * 
 * Features:
 * - High-frequency metrics streaming
 * - Smart buffering and batching
 * - Data compression and optimization
 * - Time-series data handling
 * - Real-time chart updates
 * - Performance monitoring
 */

import { EventPublisher, EventType, EventPriority } from '../events/event-publisher';
import { RedisManager } from '../config/redis.config';
import { DatabaseConnection } from '../database/connection';
import * as winston from 'winston';
import EventEmitter from 'events';

export interface MetricData {
  id: string;
  type: MetricType;
  organizationId: string;
  userId?: string;
  name: string;
  value: number | string | boolean;
  unit?: string;
  tags: Record<string, string>;
  timestamp: Date;
  metadata: {
    source: string;
    collection_method: string;
    aggregation?: string;
    resolution: number; // seconds
    quality_score?: number;
  };
}

export type MetricType = 
  | 'counter'
  | 'gauge'
  | 'histogram'
  | 'timer'
  | 'rate'
  | 'percentage'
  | 'bytes'
  | 'custom';

export interface StreamingMetrics {
  name: string;
  organizationId: string;
  type: MetricType;
  currentValue: number | string | boolean;
  previousValue?: number | string | boolean;
  trend?: 'up' | 'down' | 'stable';
  changePercent?: number;
  updateFrequency: number; // Hz
  lastUpdated: Date;
  subscribers: number;
}

export interface MetricsBuffer {
  metrics: MetricData[];
  size: number;
  startTime: Date;
  endTime: Date;
  compressionRatio?: number;
}

export interface StreamingConfig {
  bufferSize: number;
  flushInterval: number;
  compressionEnabled: boolean;
  maxUpdateFrequency: number;
  aggregationWindow: number;
  retentionPeriod: number;
}

export class MetricsStream extends EventEmitter {
  private metricsBuffer: Map<string, MetricsBuffer> = new Map(); // organizationId -> buffer
  private activeStreams: Map<string, StreamingMetrics> = new Map(); // metricKey -> stream
  private flushTimers: Map<string, NodeJS.Timeout> = new Map();
  private metricsCache: Map<string, MetricData[]> = new Map(); // Time-series cache
  private updateFrequencyTracking: Map<string, number[]> = new Map(); // Track update times

  constructor(
    private eventPublisher: EventPublisher,
    private redisManager: RedisManager,
    private db: DatabaseConnection,
    private logger: winston.Logger,
    private config: StreamingConfig
  ) {
    super();
    
    this.startBackgroundProcessing();
  }

  /**
   * Stream metric data to subscribers
   */
  async streamMetric(metric: MetricData): Promise<{
    success: boolean;
    buffered: boolean;
    streamed: boolean;
    subscribers?: number;
  }> {
    try {
      const metricKey = this.generateMetricKey(metric);
      const startTime = Date.now();

      // Update active stream
      await this.updateActiveStream(metricKey, metric);

      // Get current stream info
      const stream = this.activeStreams.get(metricKey);
      if (!stream) {
        return { success: false, buffered: false, streamed: false };
      }

      // Check if we should stream immediately or buffer
      const shouldStreamImmediately = this.shouldStreamImmediately(metric, stream);

      if (shouldStreamImmediately) {
        // Stream immediately for high-priority or frequently updated metrics
        const streamResult = await this.streamMetricImmediately(metric, stream);
        
        // Also add to buffer for batch processing
        this.addToBuffer(metric);
        
        return {
          success: true,
          buffered: true,
          streamed: true,
          subscribers: streamResult.subscribers
        };
      } else {
        // Add to buffer for batch processing
        this.addToBuffer(metric);
        
        return {
          success: true,
          buffered: true,
          streamed: false
        };
      }

    } catch (error) {
      this.logger.error('Failed to stream metric:', error);
      return { success: false, buffered: false, streamed: false };
    }
  }

  /**
   * Stream multiple metrics as a batch
   */
  async streamMetricsBatch(metrics: MetricData[]): Promise<{
    success: boolean;
    processedCount: number;
    streamedCount: number;
    bufferedCount: number;
  }> {
    try {
      let processedCount = 0;
      let streamedCount = 0;
      let bufferedCount = 0;

      // Group metrics by organization for efficient processing
      const metricsByOrg = this.groupMetricsByOrganization(metrics);

      for (const [organizationId, orgMetrics] of metricsByOrg.entries()) {
        // Process each organization's metrics
        for (const metric of orgMetrics) {
          const result = await this.streamMetric(metric);
          if (result.success) {
            processedCount++;
            if (result.streamed) streamedCount++;
            if (result.buffered) bufferedCount++;
          }
        }

        // Trigger immediate flush if batch is large
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

    } catch (error) {
      this.logger.error('Failed to process metrics batch:', error);
      return {
        success: false,
        processedCount: 0,
        streamedCount: 0,
        bufferedCount: 0
      };
    }
  }

  /**
   * Get real-time metrics for dashboard
   */
  async getRealTimeMetrics(
    organizationId: string,
    metricNames?: string[],
    timeRange?: { start: Date; end: Date }
  ): Promise<{
    metrics: StreamingMetrics[];
    chartData: any[];
    updateFrequency: number;
    lastUpdated: Date;
  }> {
    try {
      // Get active streams for organization
      const orgStreams = Array.from(this.activeStreams.values()).filter(
        stream => stream.organizationId === organizationId
      );

      // Filter by metric names if specified
      const filteredStreams = metricNames 
        ? orgStreams.filter(stream => metricNames.includes(stream.name))
        : orgStreams;

      // Get time-series data for charts
      const chartData = await this.getTimeSeriesData(
        organizationId,
        metricNames,
        timeRange
      );

      // Calculate average update frequency
      const avgUpdateFreq = filteredStreams.reduce(
        (sum, stream) => sum + stream.updateFrequency, 0
      ) / filteredStreams.length || 0;

      // Find most recent update
      const lastUpdated = filteredStreams.reduce(
        (latest, stream) => stream.lastUpdated > latest ? stream.lastUpdated : latest,
        new Date(0)
      );

      return {
        metrics: filteredStreams,
        chartData,
        updateFrequency: avgUpdateFreq,
        lastUpdated
      };

    } catch (error) {
      this.logger.error('Failed to get real-time metrics:', error);
      return {
        metrics: [],
        chartData: [],
        updateFrequency: 0,
        lastUpdated: new Date()
      };
    }
  }

  /**
   * Subscribe to specific metric updates
   */
  async subscribeToMetric(
    organizationId: string,
    metricName: string,
    options: {
      updateFrequency?: number;
      aggregation?: 'avg' | 'sum' | 'min' | 'max' | 'count';
      resolution?: number; // seconds
    } = {}
  ): Promise<{
    success: boolean;
    subscriptionId?: string;
    currentValue?: any;
  }> {
    try {
      const metricKey = `${organizationId}:${metricName}`;
      const stream = this.activeStreams.get(metricKey);

      // Create or update stream configuration
      if (stream) {
        // Update existing stream
        if (options.updateFrequency) {
          stream.updateFrequency = Math.min(
            options.updateFrequency,
            this.config.maxUpdateFrequency
          );
        }
      } else {
        // Create new stream placeholder
        this.activeStreams.set(metricKey, {
          name: metricName,
          organizationId,
          type: 'gauge', // Default type
          currentValue: null,
          updateFrequency: options.updateFrequency || 1,
          lastUpdated: new Date(),
          subscribers: 1
        });
      }

      // Set up subscription for real-time updates
      const subscriptionId = await this.setupMetricSubscription(
        organizationId,
        metricName,
        options
      );

      return {
        success: true,
        subscriptionId,
        currentValue: stream?.currentValue
      };

    } catch (error) {
      this.logger.error('Failed to subscribe to metric:', error);
      return { success: false };
    }
  }

  /**
   * Get metric statistics and performance info
   */
  getMetricStats(): {
    activeStreams: number;
    totalMetricsBuffered: number;
    bufferUtilization: number;
    averageUpdateFrequency: number;
    topMetrics: Array<{ name: string; updateFreq: number; subscribers: number }>;
  } {
    const totalBuffered = Array.from(this.metricsBuffer.values()).reduce(
      (sum, buffer) => sum + buffer.size, 0
    );

    const avgUpdateFreq = Array.from(this.activeStreams.values()).reduce(
      (sum, stream) => sum + stream.updateFrequency, 0
    ) / this.activeStreams.size || 0;

    const bufferCapacity = this.config.bufferSize * this.metricsBuffer.size;
    const bufferUtilization = bufferCapacity > 0 ? (totalBuffered / bufferCapacity) * 100 : 0;

    // Get top metrics by activity
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

  /**
   * Private helper methods
   */
  private async streamMetricImmediately(
    metric: MetricData,
    stream: StreamingMetrics
  ): Promise<{ success: boolean; subscribers: number }> {
    try {
      // Prepare streaming data
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

      // Publish via event system
      const result = await this.eventPublisher.publishMetricsUpdate(
        metric.organizationId,
        metric.type,
        streamData
      );

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

    } catch (error) {
      this.logger.error('Failed to stream metric immediately:', error);
      return { success: false, subscribers: 0 };
    }
  }

  private shouldStreamImmediately(metric: MetricData, stream: StreamingMetrics): boolean {
    // Stream immediately if:
    // 1. High-frequency metric (> 1 Hz)
    // 2. Critical metric type
    // 3. Significant value change
    // 4. Has many subscribers

    if (stream.updateFrequency > 1) return true;
    if (metric.type === 'timer' || metric.type === 'counter') return true;
    if (stream.subscribers > 5) return true;

    // Check for significant value change
    if (typeof metric.value === 'number' && typeof stream.currentValue === 'number') {
      const changePercent = Math.abs((metric.value - stream.currentValue) / stream.currentValue) * 100;
      if (changePercent > 10) return true; // 10% change threshold
    }

    return false;
  }

  private addToBuffer(metric: MetricData): void {
    const orgId = metric.organizationId;
    
    if (!this.metricsBuffer.has(orgId)) {
      this.metricsBuffer.set(orgId, {
        metrics: [],
        size: 0,
        startTime: new Date(),
        endTime: new Date()
      });
    }

    const buffer = this.metricsBuffer.get(orgId)!;
    buffer.metrics.push(metric);
    buffer.size++;
    buffer.endTime = metric.timestamp;

    // Set up flush timer if not exists
    if (!this.flushTimers.has(orgId)) {
      const timer = setTimeout(() => {
        this.flushBuffer(orgId);
      }, this.config.flushInterval);
      
      this.flushTimers.set(orgId, timer);
    }

    // Flush if buffer is full
    if (buffer.size >= this.config.bufferSize) {
      this.flushBuffer(orgId);
    }
  }

  private async flushBuffer(organizationId: string): Promise<void> {
    try {
      const buffer = this.metricsBuffer.get(organizationId);
      if (!buffer || buffer.size === 0) return;

      // Clear flush timer
      const timer = this.flushTimers.get(organizationId);
      if (timer) {
        clearTimeout(timer);
        this.flushTimers.delete(organizationId);
      }

      // Compress buffer if enabled
      if (this.config.compressionEnabled) {
        await this.compressBuffer(buffer);
      }

      // Publish buffer contents
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
        type: 'metrics_updated' as EventType,
        source: 'metrics-stream',
        organizationId,
        data: batchData,
        routing: {
          rooms: [`org:${organizationId}`, `metrics:${organizationId}:batch`]
        },
        priority: 'medium' as EventPriority,
        tags: ['metrics', 'batch', 'streaming']
      });

      // Store in time-series cache
      await this.updateTimeSeriesCache(organizationId, buffer.metrics);

      // Clear buffer
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

    } catch (error) {
      this.logger.error('Failed to flush metrics buffer:', error);
    }
  }

  private async updateActiveStream(metricKey: string, metric: MetricData): Promise<void> {
    let stream = this.activeStreams.get(metricKey);
    
    if (!stream) {
      // Create new stream
      stream = {
        name: metric.name,
        organizationId: metric.organizationId,
        type: metric.type,
        currentValue: metric.value,
        updateFrequency: 1,
        lastUpdated: metric.timestamp,
        subscribers: 0
      };
    } else {
      // Update existing stream
      stream.previousValue = stream.currentValue;
      stream.currentValue = metric.value;
      stream.lastUpdated = metric.timestamp;

      // Calculate trend and change percentage
      if (typeof metric.value === 'number' && typeof stream.previousValue === 'number') {
        const change = metric.value - stream.previousValue;
        stream.trend = change > 0 ? 'up' : change < 0 ? 'down' : 'stable';
        stream.changePercent = stream.previousValue !== 0 
          ? (change / stream.previousValue) * 100 
          : 0;
      }

      // Update frequency tracking
      this.updateFrequencyTracking(metricKey, metric.timestamp);
    }

    this.activeStreams.set(metricKey, stream);
  }

  private updateFrequencyTracking(metricKey: string, timestamp: Date): void {
    if (!this.updateFrequencyTracking.has(metricKey)) {
      this.updateFrequencyTracking.set(metricKey, []);
    }

    const timestamps = this.updateFrequencyTracking.get(metricKey)!;
    timestamps.push(timestamp.getTime());

    // Keep only last 60 seconds of timestamps
    const cutoff = Date.now() - 60000;
    const recentTimestamps = timestamps.filter(ts => ts > cutoff);
    this.updateFrequencyTracking.set(metricKey, recentTimestamps);

    // Update frequency in stream
    const stream = this.activeStreams.get(metricKey);
    if (stream && recentTimestamps.length > 1) {
      stream.updateFrequency = recentTimestamps.length / 60; // Hz over last minute
    }
  }

  private generateMetricKey(metric: MetricData): string {
    const tags = Object.entries(metric.tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    
    return `${metric.organizationId}:${metric.name}:${tags}`;
  }

  private groupMetricsByOrganization(metrics: MetricData[]): Map<string, MetricData[]> {
    const grouped = new Map<string, MetricData[]>();
    
    for (const metric of metrics) {
      if (!grouped.has(metric.organizationId)) {
        grouped.set(metric.organizationId, []);
      }
      grouped.get(metric.organizationId)!.push(metric);
    }
    
    return grouped;
  }

  private async compressBuffer(buffer: MetricsBuffer): Promise<void> {
    // Simple compression by removing duplicate consecutive values
    const originalSize = buffer.metrics.length;
    const compressed: MetricData[] = [];
    
    for (let i = 0; i < buffer.metrics.length; i++) {
      const current = buffer.metrics[i];
      const next = buffer.metrics[i + 1];
      
      // Keep metric if:
      // 1. It's the first metric
      // 2. It's the last metric
      // 3. Value changed from previous
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

  private async updateTimeSeriesCache(
    organizationId: string,
    metrics: MetricData[]
  ): Promise<void> {
    try {
      const cacheKey = `timeseries:${organizationId}`;
      
      if (!this.metricsCache.has(cacheKey)) {
        this.metricsCache.set(cacheKey, []);
      }
      
      const cached = this.metricsCache.get(cacheKey)!;
      cached.push(...metrics);
      
      // Keep only recent data (based on retention period)
      const cutoff = Date.now() - this.config.retentionPeriod;
      const recent = cached.filter(m => m.timestamp.getTime() > cutoff);
      this.metricsCache.set(cacheKey, recent);
      
      // Also store in Redis for persistence
      const redisKey = `metrics:timeseries:${organizationId}`;
      const pipeline = this.redisManager.client.pipeline();
      
      for (const metric of metrics) {
        pipeline.zadd(redisKey, metric.timestamp.getTime(), JSON.stringify(metric));
      }
      
      // Set expiration
      pipeline.expire(redisKey, this.config.retentionPeriod / 1000);
      
      await pipeline.exec();
      
    } catch (error) {
      this.logger.warn('Failed to update time-series cache:', error);
    }
  }

  private async getTimeSeriesData(
    organizationId: string,
    metricNames?: string[],
    timeRange?: { start: Date; end: Date }
  ): Promise<any[]> {
    try {
      const redisKey = `metrics:timeseries:${organizationId}`;
      
      // Default to last hour if no time range specified
      const start = timeRange?.start?.getTime() || (Date.now() - 3600000);
      const end = timeRange?.end?.getTime() || Date.now();
      
      // Get data from Redis
      const rawData = await this.redisManager.client.zrangebyscore(
        redisKey,
        start,
        end
      );
      
      // Parse and filter data
      const metrics = rawData
        .map(data => {
          try {
            return JSON.parse(data) as MetricData;
          } catch {
            return null;
          }
        })
        .filter((metric): metric is MetricData => 
          metric !== null && 
          (!metricNames || metricNames.includes(metric.name))
        );
      
      // Group by metric name for chart data
      const chartData = this.groupMetricsForChart(metrics);
      
      return chartData;
      
    } catch (error) {
      this.logger.error('Failed to get time-series data:', error);
      return [];
    }
  }

  private groupMetricsForChart(metrics: MetricData[]): any[] {
    const grouped = new Map<string, any[]>();
    
    for (const metric of metrics) {
      const key = `${metric.name}_${metric.type}`;
      
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      
      grouped.get(key)!.push({
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

  private async setupMetricSubscription(
    organizationId: string,
    metricName: string,
    options: any
  ): Promise<string> {
    // This would integrate with the EventSubscriber to set up real-time subscriptions
    // For now, return a mock subscription ID
    return `sub_${organizationId}_${metricName}_${Date.now()}`;
  }

  private startBackgroundProcessing(): void {
    // Periodic flush of all buffers
    setInterval(() => {
      for (const organizationId of this.metricsBuffer.keys()) {
        const buffer = this.metricsBuffer.get(organizationId);
        if (buffer && buffer.size > 0) {
          // Check if buffer has been idle
          const idleTime = Date.now() - buffer.endTime.getTime();
          if (idleTime > this.config.flushInterval) {
            this.flushBuffer(organizationId);
          }
        }
      }
    }, this.config.flushInterval / 2);

    // Cleanup old data
    setInterval(() => {
      this.performCleanup();
    }, 300000); // 5 minutes
  }

  private performCleanup(): void {
    // Clean up inactive streams
    const now = Date.now();
    const inactivityThreshold = 300000; // 5 minutes

    for (const [key, stream] of this.activeStreams.entries()) {
      if (now - stream.lastUpdated.getTime() > inactivityThreshold) {
        this.activeStreams.delete(key);
        this.updateFrequencyTracking.delete(key);
      }
    }

    // Clean up cache
    for (const [key, metrics] of this.metricsCache.entries()) {
      const cutoff = now - this.config.retentionPeriod;
      const recent = metrics.filter(m => m.timestamp.getTime() > cutoff);
      this.metricsCache.set(key, recent);
    }
  }

  /**
   * Public API for shutdown
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Metrics Stream...');

    // Flush all remaining buffers
    const flushPromises = Array.from(this.metricsBuffer.keys()).map(
      orgId => this.flushBuffer(orgId)
    );
    await Promise.allSettled(flushPromises);

    // Clear all timers
    for (const timer of this.flushTimers.values()) {
      clearTimeout(timer);
    }

    // Clear data structures
    this.metricsBuffer.clear();
    this.activeStreams.clear();
    this.flushTimers.clear();
    this.metricsCache.clear();
    this.updateFrequencyTracking.clear();

    this.logger.info('Metrics Stream shutdown complete');
  }
}