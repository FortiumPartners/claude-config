/**
 * Real-Time Metrics Processing Pipeline
 * Task 3.3: Kafka-based streaming metrics processing and aggregation
 */

import { Producer, Consumer, EachMessagePayload } from 'kafkajs';
import { KafkaManager } from '../config/kafka.config';
import { RedisManager } from '../config/redis.config';
import { MetricsModel } from '../models/metrics.model';
import { DatabaseConnection } from '../database/connection';
import {
  MetricsStreamEvent,
  CommandExecution,
  AgentInteraction,
  UserSession,
  ProductivityMetric,
  AggregatedMetrics
} from '../types/metrics';
import * as winston from 'winston';

export interface ProcessingPipelineConfig {
  batchSize: number;
  batchTimeoutMs: number;
  maxRetries: number;
  parallelism: number;
  aggregationWindowMs: number;
}

export interface ProcessingStats {
  messages_processed: number;
  messages_failed: number;
  processing_rate: number;
  avg_processing_time_ms: number;
  last_processed_at: Date;
  active_consumers: number;
  queue_depth: number;
}

export class MetricsProcessingService {
  private kafkaManager: KafkaManager;
  private redisManager: RedisManager;
  private metricsModel: MetricsModel;
  private producer: Producer;
  private consumers: Consumer[] = [];
  private logger: winston.Logger;
  private config: ProcessingPipelineConfig;
  private isRunning = false;

  // Processing statistics
  private stats: ProcessingStats = {
    messages_processed: 0,
    messages_failed: 0,
    processing_rate: 0,
    avg_processing_time_ms: 0,
    last_processed_at: new Date(),
    active_consumers: 0,
    queue_depth: 0
  };

  // In-memory aggregation buffers
  private aggregationBuffer = new Map<string, AggregatedMetrics>();
  private lastAggregation = Date.now();

  constructor(
    kafkaManager: KafkaManager,
    redisManager: RedisManager,
    db: DatabaseConnection,
    logger: winston.Logger,
    config?: Partial<ProcessingPipelineConfig>
  ) {
    this.kafkaManager = kafkaManager;
    this.redisManager = redisManager;
    this.metricsModel = new MetricsModel(db);
    this.logger = logger;

    this.config = {
      batchSize: 100,
      batchTimeoutMs: 5000,
      maxRetries: 3,
      parallelism: 4,
      aggregationWindowMs: 60000, // 1 minute
      ...config
    };

    this.producer = this.kafkaManager.createProducer({
      maxInFlightRequests: 1,
      idempotent: true,
      transactionTimeout: 30000
    });

    // Setup aggregation interval
    setInterval(() => {
      this.flushAggregationBuffer().catch(error => {
        this.logger.error('Failed to flush aggregation buffer', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      });
    }, this.config.aggregationWindowMs);
  }

  /**
   * Start the metrics processing pipeline
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Metrics processing pipeline is already running');
      return;
    }

    try {
      // Connect producer
      await this.producer.connect();
      this.logger.info('Kafka producer connected for metrics processing');

      // Start consumers for different processing stages
      await this.startRawMetricsProcessor();
      await this.startMetricsAggregator();
      await this.startAlertProcessor();

      this.isRunning = true;
      this.logger.info('Metrics processing pipeline started successfully');

    } catch (error) {
      this.logger.error('Failed to start metrics processing pipeline', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Stop the metrics processing pipeline
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      // Flush any remaining aggregated data
      await this.flushAggregationBuffer();

      // Disconnect all consumers
      await Promise.all(this.consumers.map(consumer => consumer.disconnect()));
      
      // Disconnect producer
      await this.producer.disconnect();

      this.isRunning = false;
      this.consumers = [];
      
      this.logger.info('Metrics processing pipeline stopped successfully');

    } catch (error) {
      this.logger.error('Failed to stop metrics processing pipeline', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Publish metrics event to the processing pipeline
   */
  async publishMetricsEvent(event: MetricsStreamEvent): Promise<void> {
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

    } catch (error) {
      this.logger.error('Failed to publish metrics event', {
        event_type: event.type,
        organization_id: event.organization_id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Start raw metrics processor consumer
   */
  private async startRawMetricsProcessor(): Promise<void> {
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

  /**
   * Process individual raw metrics message
   */
  private async processRawMetricsMessage(payload: EachMessagePayload): Promise<void> {
    const startTime = Date.now();
    
    try {
      const event: MetricsStreamEvent = JSON.parse(payload.message.value?.toString() || '');
      
      // Validate event structure
      if (!this.validateMetricsEvent(event)) {
        throw new Error('Invalid metrics event structure');
      }

      // Process based on event type
      let processedData: any;
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

      // Send processed data to next stage
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

      // Update real-time cache
      await this.updateRealTimeCache(event, processedData);

      // Update aggregation buffer
      this.updateAggregationBuffer(event, processedData);

      // Update statistics
      const processingTime = Date.now() - startTime;
      this.updateProcessingStats(processingTime, true);

      this.logger.debug('Processed raw metrics message', {
        type: event.type,
        organization_id: event.organization_id,
        processing_time_ms: processingTime
      });

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateProcessingStats(processingTime, false);

      this.logger.error('Failed to process raw metrics message', {
        partition: payload.partition,
        offset: payload.message.offset,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Send to dead letter queue for manual inspection
      await this.sendToDeadLetterQueue(payload, error as Error);
    }
  }

  /**
   * Process command execution event
   */
  private async processCommandExecution(event: MetricsStreamEvent): Promise<CommandExecution> {
    const data = event.data as any;
    
    // Add processing timestamps and derive metrics
    const processedData = {
      ...data,
      executed_at: new Date(event.timestamp),
      // Calculate derived metrics
      success_rate: data.status === 'success' ? 1 : 0,
      error_category: data.status === 'error' ? this.categorizeError(data.error_message) : null,
      performance_tier: this.categorizePerformance(data.execution_time_ms),
      organization_id: event.organization_id
    };

    return processedData;
  }

  /**
   * Process agent interaction event
   */
  private async processAgentInteraction(event: MetricsStreamEvent): Promise<AgentInteraction> {
    const data = event.data as any;
    
    const processedData = {
      ...data,
      occurred_at: new Date(event.timestamp),
      // Calculate token efficiency
      token_efficiency: data.input_tokens && data.output_tokens ? 
        data.output_tokens / (data.input_tokens + data.output_tokens) : null,
      // Categorize interaction complexity
      complexity_level: this.categorizeInteractionComplexity(data),
      organization_id: event.organization_id
    };

    return processedData;
  }

  /**
   * Process user session event
   */
  private async processUserSession(event: MetricsStreamEvent): Promise<UserSession> {
    const data = event.data as any;
    
    const processedData = {
      ...data,
      // Calculate session metrics
      productivity_index: this.calculateProductivityIndex(data),
      session_quality: this.assessSessionQuality(data),
      organization_id: event.organization_id
    };

    return processedData;
  }

  /**
   * Process productivity metric event
   */
  private async processProductivityMetric(event: MetricsStreamEvent): Promise<ProductivityMetric> {
    const data = event.data as any;
    
    const processedData = {
      ...data,
      recorded_at: new Date(event.timestamp),
      // Normalize metric value for comparison
      normalized_value: this.normalizeMetricValue(data.metric_type, data.metric_value),
      // Calculate percentile ranking
      percentile_rank: await this.calculatePercentileRank(event.organization_id, data),
      organization_id: event.organization_id
    };

    return processedData;
  }

  /**
   * Update real-time cache for dashboard consumption
   */
  private async updateRealTimeCache(event: MetricsStreamEvent, processedData: any): Promise<void> {
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
    } catch (error) {
      this.logger.error('Failed to update real-time cache', {
        organization_id: event.organization_id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Update in-memory aggregation buffer
   */
  private updateAggregationBuffer(event: MetricsStreamEvent, processedData: any): void {
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

    const bucket = this.aggregationBuffer.get(bucketKey)!;
    
    // Update aggregated metrics based on event type
    switch (event.type) {
      case 'command_execution':
        bucket.command_count++;
        bucket.avg_execution_time = this.updateAverage(
          bucket.avg_execution_time, 
          processedData.execution_time_ms,
          bucket.command_count
        );
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

  /**
   * Flush aggregation buffer to database and cache
   */
  private async flushAggregationBuffer(): Promise<void> {
    if (this.aggregationBuffer.size === 0) {
      return;
    }

    try {
      const aggregatedData = Array.from(this.aggregationBuffer.values());
      
      // Store in database
      await this.metricsModel.batchInsertAggregatedMetrics(aggregatedData);
      
      // Cache for dashboard queries
      for (const data of aggregatedData) {
        const cacheKey = `${data.organization_id}:${data.time_bucket.toISOString()}`;
        await this.redisManager.cacheAggregatedMetrics(cacheKey, data);
      }

      // Send to aggregated metrics topic for further processing
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

      // Clear buffer
      this.aggregationBuffer.clear();
      this.lastAggregation = Date.now();

      this.logger.info('Flushed aggregation buffer', {
        records_processed: aggregatedData.length
      });

    } catch (error) {
      this.logger.error('Failed to flush aggregation buffer', {
        buffer_size: this.aggregationBuffer.size,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Start metrics aggregation consumer
   */
  private async startMetricsAggregator(): Promise<void> {
    const consumer = this.kafkaManager.createConsumer('fortium-metrics-aggregator');
    
    await consumer.connect();
    await consumer.subscribe({ topic: this.kafkaManager.topics.METRICS_PROCESSED, fromBeginning: false });

    await consumer.run({
      partitionsConsumedConcurrently: 2,
      eachMessage: async (payload: EachMessagePayload) => {
        // This consumer handles additional aggregation logic
        // that doesn't fit in the real-time buffer approach
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

  /**
   * Start alert processing consumer
   */
  private async startAlertProcessor(): Promise<void> {
    const consumer = this.kafkaManager.createConsumer('fortium-metrics-alerts');
    
    await consumer.connect();
    await consumer.subscribe({ topic: this.kafkaManager.topics.METRICS_AGGREGATED, fromBeginning: false });

    await consumer.run({
      partitionsConsumedConcurrently: 1,
      eachMessage: async (payload: EachMessagePayload) => {
        // Process aggregated metrics for alert conditions
        const data = JSON.parse(payload.message.value?.toString() || '');
        await this.checkAlertConditions(data);
      }
    });

    this.consumers.push(consumer);
    this.stats.active_consumers++;
    
    this.logger.info('Alert processor started');
  }

  /**
   * Check for alert conditions and trigger alerts
   */
  private async checkAlertConditions(aggregatedData: AggregatedMetrics): Promise<void> {
    // Example alert conditions
    const alerts = [];

    // High error rate alert
    if (aggregatedData.error_rate > 0.1) { // > 10%
      alerts.push({
        type: 'high_error_rate',
        severity: 'high',
        organization_id: aggregatedData.organization_id,
        metric_value: aggregatedData.error_rate,
        threshold: 0.1,
        message: `Error rate of ${(aggregatedData.error_rate * 100).toFixed(1)}% exceeds threshold`
      });
    }

    // Low productivity alert
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

    // Send alerts if any triggered
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

  /**
   * Send failed message to dead letter queue
   */
  private async sendToDeadLetterQueue(payload: EachMessagePayload, error: Error): Promise<void> {
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
    } catch (dlqError) {
      this.logger.error('Failed to send message to DLQ', {
        original_error: error.message,
        dlq_error: dlqError instanceof Error ? dlqError.message : 'Unknown error'
      });
    }
  }

  /**
   * Helper methods
   */
  private validateMetricsEvent(event: any): event is MetricsStreamEvent {
    return event &&
           typeof event.type === 'string' &&
           typeof event.organization_id === 'string' &&
           typeof event.user_id === 'string' &&
           event.data &&
           event.timestamp;
  }

  private getPartitionForOrganization(organizationId: string): number {
    // Simple hash-based partitioning
    let hash = 0;
    for (let i = 0; i < organizationId.length; i++) {
      hash = ((hash << 5) - hash + organizationId.charCodeAt(i)) & 0xffffffff;
    }
    return Math.abs(hash) % 12; // 12 partitions for raw metrics topic
  }

  private getAggregationBucketKey(event: MetricsStreamEvent): string {
    const timeBucket = this.getTimeBucket(event.timestamp);
    return `${event.organization_id}:${event.user_id}:${timeBucket.toISOString()}`;
  }

  private getTimeBucket(timestamp: Date): Date {
    // Round down to the nearest minute
    const bucket = new Date(timestamp);
    bucket.setSeconds(0, 0);
    return bucket;
  }

  private updateAverage(currentAvg: number, newValue: number, count: number): number {
    return ((currentAvg * (count - 1)) + newValue) / count;
  }

  private updateErrorRate(bucket: AggregatedMetrics, isError: boolean): number {
    const totalCommands = bucket.command_count;
    const currentErrors = bucket.error_rate * (totalCommands - 1);
    const newErrors = currentErrors + (isError ? 1 : 0);
    return newErrors / totalCommands;
  }

  private categorizeError(errorMessage?: string): string {
    if (!errorMessage) return 'unknown';
    
    if (errorMessage.includes('timeout')) return 'timeout';
    if (errorMessage.includes('network')) return 'network';
    if (errorMessage.includes('validation')) return 'validation';
    if (errorMessage.includes('auth')) return 'authentication';
    
    return 'other';
  }

  private categorizePerformance(executionTimeMs: number): string {
    if (executionTimeMs < 1000) return 'fast';
    if (executionTimeMs < 5000) return 'medium';
    if (executionTimeMs < 15000) return 'slow';
    return 'very_slow';
  }

  private categorizeInteractionComplexity(data: any): string {
    const tokens = (data.input_tokens || 0) + (data.output_tokens || 0);
    
    if (tokens < 100) return 'simple';
    if (tokens < 500) return 'medium';
    if (tokens < 2000) return 'complex';
    return 'very_complex';
  }

  private calculateProductivityIndex(data: any): number {
    // Simple productivity calculation based on session metrics
    const baseScore = 50;
    const commandsBonus = Math.min(data.commands_executed * 2, 30);
    const durationPenalty = Math.max(0, (data.duration_minutes - 60) * 0.1);
    
    return Math.max(0, Math.min(100, baseScore + commandsBonus - durationPenalty));
  }

  private assessSessionQuality(data: any): string {
    const productivityIndex = this.calculateProductivityIndex(data);
    
    if (productivityIndex >= 80) return 'excellent';
    if (productivityIndex >= 60) return 'good';
    if (productivityIndex >= 40) return 'fair';
    return 'poor';
  }

  private normalizeMetricValue(metricType: string, value: number): number {
    // Normalize different metric types to 0-100 scale
    switch (metricType) {
      case 'productivity_score':
        return Math.min(100, Math.max(0, value));
      case 'error_rate':
        return (1 - Math.min(1, Math.max(0, value))) * 100;
      case 'commands_per_hour':
        return Math.min(100, value / 10); // Assuming 10 commands/hour = 10%
      default:
        return value;
    }
  }

  private async calculatePercentileRank(organizationId: string, data: any): Promise<number> {
    // Simplified percentile calculation - in production would query historical data
    return Math.floor(Math.random() * 100); // Placeholder
  }

  private async getActiveUserCount(organizationId: string): Promise<number> {
    // Query active users in last hour - placeholder implementation
    return Math.floor(Math.random() * 20) + 1;
  }

  private async getPerformanceSummary(organizationId: string): Promise<any> {
    // Get performance summary for organization - placeholder implementation
    return {
      avg_response_time: Math.floor(Math.random() * 1000) + 500,
      success_rate: 0.95 + (Math.random() * 0.05),
      active_agents: Math.floor(Math.random() * 10) + 1
    };
  }

  private updateProcessingStats(processingTimeMs: number, success: boolean): void {
    this.stats.last_processed_at = new Date();
    
    if (success) {
      this.stats.messages_processed++;
    } else {
      this.stats.messages_failed++;
    }

    // Update average processing time
    const totalMessages = this.stats.messages_processed + this.stats.messages_failed;
    this.stats.avg_processing_time_ms = 
      ((this.stats.avg_processing_time_ms * (totalMessages - 1)) + processingTimeMs) / totalMessages;
    
    // Calculate processing rate (messages per second over last minute)
    this.stats.processing_rate = this.stats.messages_processed / 60; // Simplified calculation
  }

  /**
   * Get processing pipeline statistics
   */
  getProcessingStats(): ProcessingStats {
    return { ...this.stats };
  }

  /**
   * Health check for the processing pipeline
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> {
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
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }
}