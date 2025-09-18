/**
 * Event Publisher - Sprint 5 Task 5.2
 * Real-time event publishing system with Redis message queuing
 * 
 * Features:
 * - Multi-tenant event publishing
 * - Priority-based message queuing
 * - Event deduplication and filtering
 * - Batch publishing for performance
 * - Dead letter queue handling
 * - Event tracking and analytics
 */

import { RedisManager } from '../config/redis.config';
import { DatabaseConnection } from '../database/connection';
import * as winston from 'winston';
import EventEmitter from 'events';
import * as crypto from 'crypto';

export interface PublishedEvent {
  id: string;
  type: EventType;
  source: string;
  organizationId: string;
  userId?: string;
  data: any;
  metadata: {
    version: string;
    timestamp: Date;
    correlationId?: string;
    priority: EventPriority;
    ttl?: number;
    retryCount?: number;
    tags?: string[];
  };
  routing: {
    rooms: string[];
    userIds?: string[];
    roles?: string[];
    permissions?: string[];
    excludeUsers?: string[];
  };
}

export type EventType = 
  | 'metrics_updated'
  | 'dashboard_changed'
  | 'user_activity'
  | 'system_alert'
  | 'collaboration_event'
  | 'notification'
  | 'presence_update'
  | 'real_time_data'
  | 'configuration_change'
  | 'security_event';

export type EventPriority = 'low' | 'medium' | 'high' | 'critical';

export interface EventPublishResult {
  success: boolean;
  eventId: string;
  published: boolean;
  queued: boolean;
  recipientCount?: number;
  error?: string;
  processingTime: number;
}

export interface BatchPublishResult {
  totalEvents: number;
  successfulEvents: number;
  failedEvents: number;
  queuedEvents: number;
  processingTime: number;
  errors: Array<{ eventId: string; error: string }>;
}

export interface EventMetrics {
  totalPublished: number;
  publishedByType: Record<EventType, number>;
  publishedByPriority: Record<EventPriority, number>;
  averageProcessingTime: number;
  successRate: number;
  queueSize: number;
  deadLetterQueueSize: number;
}

export class EventPublisher extends EventEmitter {
  private publishQueue: PublishedEvent[] = [];
  private deadLetterQueue: PublishedEvent[] = [];
  private eventHistory: Map<string, PublishedEvent> = new Map();
  private deduplicationCache: Set<string> = new Set();
  private metrics: EventMetrics;
  private batchTimer: NodeJS.Timeout | null = null;
  private isProcessing: boolean = false;

  constructor(
    private redisManager: RedisManager,
    private db: DatabaseConnection,
    private logger: winston.Logger,
    private config: {
      batchSize: number;
      batchInterval: number;
      maxRetries: number;
      deduplicationWindow: number;
      historyRetention: number;
      deadLetterRetention: number;
      enableAnalytics: boolean;
    }
  ) {
    super();
    
    this.initializeMetrics();
    this.startBatchProcessor();
    this.startCleanupService();
  }

  /**
   * Publish a single event
   */
  async publishEvent(eventData: {
    type: EventType;
    source: string;
    organizationId: string;
    userId?: string;
    data: any;
    routing: PublishedEvent['routing'];
    priority?: EventPriority;
    correlationId?: string;
    ttl?: number;
    tags?: string[];
  }): Promise<EventPublishResult> {
    const startTime = Date.now();
    
    try {
      // Create event object
      const event: PublishedEvent = {
        id: this.generateEventId(),
        type: eventData.type,
        source: eventData.source,
        organizationId: eventData.organizationId,
        userId: eventData.userId,
        data: eventData.data,
        metadata: {
          version: '1.0',
          timestamp: new Date(),
          correlationId: eventData.correlationId,
          priority: eventData.priority || 'medium',
          ttl: eventData.ttl,
          retryCount: 0,
          tags: eventData.tags
        },
        routing: eventData.routing
      };

      // Check for duplicates
      const deduplicationKey = this.generateDeduplicationKey(event);
      if (this.deduplicationCache.has(deduplicationKey)) {
        return {
          success: true,
          eventId: event.id,
          published: false,
          queued: false,
          processingTime: Date.now() - startTime
        };
      }

      // Add to deduplication cache
      this.deduplicationCache.add(deduplicationKey);
      setTimeout(() => {
        this.deduplicationCache.delete(deduplicationKey);
      }, this.config.deduplicationWindow);

      // Store event in history
      this.eventHistory.set(event.id, event);

      // Determine publishing strategy based on priority
      if (event.metadata.priority === 'critical') {
        // Publish immediately
        const result = await this.publishEventImmediately(event);
        this.updateMetrics(event, result.success);
        
        return {
          success: result.success,
          eventId: event.id,
          published: result.success,
          queued: false,
          recipientCount: result.recipientCount,
          error: result.error,
          processingTime: Date.now() - startTime
        };
      } else {
        // Add to batch queue
        this.publishQueue.push(event);
        
        // If queue is full, process immediately
        if (this.publishQueue.length >= this.config.batchSize) {
          this.processBatch();
        }

        return {
          success: true,
          eventId: event.id,
          published: false,
          queued: true,
          processingTime: Date.now() - startTime
        };
      }

    } catch (error) {
      this.logger.error('Failed to publish event:', error);
      return {
        success: false,
        eventId: '',
        published: false,
        queued: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Publish multiple events as a batch
   */
  async publishBatch(events: Parameters<typeof this.publishEvent>[0][]): Promise<BatchPublishResult> {
    const startTime = Date.now();
    
    try {
      const results = await Promise.allSettled(
        events.map(eventData => this.publishEvent(eventData))
      );

      const batchResult: BatchPublishResult = {
        totalEvents: events.length,
        successfulEvents: 0,
        failedEvents: 0,
        queuedEvents: 0,
        processingTime: Date.now() - startTime,
        errors: []
      };

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          if (result.value.success) {
            if (result.value.published) {
              batchResult.successfulEvents++;
            } else if (result.value.queued) {
              batchResult.queuedEvents++;
            }
          } else {
            batchResult.failedEvents++;
            if (result.value.error) {
              batchResult.errors.push({
                eventId: result.value.eventId || `event_${index}`,
                error: result.value.error
              });
            }
          }
        } else {
          batchResult.failedEvents++;
          batchResult.errors.push({
            eventId: `event_${index}`,
            error: result.reason?.message || 'Unknown error'
          });
        }
      });

      return batchResult;

    } catch (error) {
      this.logger.error('Failed to publish event batch:', error);
      return {
        totalEvents: events.length,
        successfulEvents: 0,
        failedEvents: events.length,
        queuedEvents: 0,
        processingTime: Date.now() - startTime,
        errors: [{ eventId: 'batch', error: error instanceof Error ? error.message : 'Unknown error' }]
      };
    }
  }

  /**
   * Publish dashboard metrics update
   */
  async publishDashboardUpdate(
    organizationId: string,
    dashboardId: string,
    updateData: any,
    userId?: string,
    priority: EventPriority = 'medium'
  ): Promise<EventPublishResult> {
    return this.publishEvent({
      type: 'dashboard_changed',
      source: 'dashboard-service',
      organizationId,
      userId,
      data: {
        dashboardId,
        updateType: 'metrics_refresh',
        updates: updateData,
        timestamp: new Date()
      },
      routing: {
        rooms: [`dashboard:${organizationId}:${dashboardId}`],
        userIds: userId ? [userId] : undefined
      },
      priority,
      tags: ['dashboard', 'metrics', 'real-time']
    });
  }

  /**
   * Publish real-time metrics update
   */
  async publishMetricsUpdate(
    organizationId: string,
    metricType: string,
    metricsData: any,
    priority: EventPriority = 'high'
  ): Promise<EventPublishResult> {
    return this.publishEvent({
      type: 'metrics_updated',
      source: 'metrics-collector',
      organizationId,
      data: {
        metricType,
        metrics: metricsData,
        timestamp: new Date()
      },
      routing: {
        rooms: [`metrics:${organizationId}:${metricType}`]
      },
      priority,
      tags: ['metrics', 'real-time', metricType]
    });
  }

  /**
   * Publish user activity event
   */
  async publishUserActivity(
    organizationId: string,
    userId: string,
    activityType: string,
    activityData: any,
    priority: EventPriority = 'low'
  ): Promise<EventPublishResult> {
    return this.publishEvent({
      type: 'user_activity',
      source: 'activity-tracker',
      organizationId,
      userId,
      data: {
        activityType,
        activity: activityData,
        timestamp: new Date()
      },
      routing: {
        rooms: [`org:${organizationId}`],
        userIds: [userId]
      },
      priority,
      tags: ['activity', 'user', activityType]
    });
  }

  /**
   * Publish system alert
   */
  async publishSystemAlert(
    organizationId: string,
    alertType: string,
    alertData: any,
    priority: EventPriority = 'critical'
  ): Promise<EventPublishResult> {
    return this.publishEvent({
      type: 'system_alert',
      source: 'monitoring-system',
      organizationId,
      data: {
        alertType,
        alert: alertData,
        severity: priority,
        timestamp: new Date()
      },
      routing: {
        rooms: [`org:${organizationId}`],
        roles: ['admin', 'manager']
      },
      priority,
      tags: ['alert', 'system', alertType]
    });
  }

  /**
   * Publish collaborative event
   */
  async publishCollaborativeEvent(
    organizationId: string,
    dashboardId: string,
    userId: string,
    collaborativeData: any,
    priority: EventPriority = 'high'
  ): Promise<EventPublishResult> {
    return this.publishEvent({
      type: 'collaboration_event',
      source: 'collaboration-service',
      organizationId,
      userId,
      data: {
        dashboardId,
        collaboration: collaborativeData,
        timestamp: new Date()
      },
      routing: {
        rooms: [`dashboard:${organizationId}:${dashboardId}`],
        excludeUsers: [userId] // Don't send back to originating user
      },
      priority,
      tags: ['collaboration', 'real-time']
    });
  }

  /**
   * Private methods
   */
  private async publishEventImmediately(event: PublishedEvent): Promise<{
    success: boolean;
    recipientCount?: number;
    error?: string;
  }> {
    try {
      // Publish to Redis channels for each room
      let totalRecipients = 0;
      
      for (const room of event.routing.rooms) {
        const channel = `events:${room}`;
        const message = JSON.stringify({
          eventId: event.id,
          type: event.type,
          data: event.data,
          metadata: event.metadata,
          routing: event.routing
        });

        await this.redisManager.client.publish(channel, message);
        
        // Get subscriber count for this channel
        const subscribers = await this.redisManager.client.pubsub('NUMSUB', channel);
        if (subscribers && Array.isArray(subscribers) && subscribers.length > 1) {
          totalRecipients += parseInt(subscribers[1] as string) || 0;
        }
      }

      // Store event for analytics
      if (this.config.enableAnalytics) {
        await this.storeEventAnalytics(event);
      }

      this.logger.debug('Event published immediately', {
        eventId: event.id,
        type: event.type,
        organizationId: event.organizationId,
        recipientCount: totalRecipients,
        rooms: event.routing.rooms
      });

      return { success: true, recipientCount: totalRecipients };

    } catch (error) {
      this.logger.error('Failed to publish event immediately:', error);
      
      // Add to dead letter queue for retry
      event.metadata.retryCount = (event.metadata.retryCount || 0) + 1;
      if (event.metadata.retryCount <= this.config.maxRetries) {
        this.deadLetterQueue.push(event);
      }

      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  private startBatchProcessor(): void {
    this.batchTimer = setInterval(() => {
      if (this.publishQueue.length > 0 && !this.isProcessing) {
        this.processBatch();
      }
    }, this.config.batchInterval);
  }

  private async processBatch(): Promise<void> {
    if (this.isProcessing || this.publishQueue.length === 0) return;

    this.isProcessing = true;
    const batch = this.publishQueue.splice(0, this.config.batchSize);

    try {
      // Group events by room for efficient publishing
      const eventsByRoom = new Map<string, PublishedEvent[]>();
      
      for (const event of batch) {
        for (const room of event.routing.rooms) {
          if (!eventsByRoom.has(room)) {
            eventsByRoom.set(room, []);
          }
          eventsByRoom.get(room)!.push(event);
        }
      }

      // Publish to each room
      const publishPromises = Array.from(eventsByRoom.entries()).map(
        async ([room, events]) => {
          const channel = `events:${room}`;
          const batchMessage = JSON.stringify({
            type: 'batch_events',
            events: events.map(event => ({
              eventId: event.id,
              type: event.type,
              data: event.data,
              metadata: event.metadata,
              routing: event.routing
            })),
            timestamp: new Date()
          });

          await this.redisManager.client.publish(channel, batchMessage);
        }
      );

      await Promise.allSettled(publishPromises);

      // Update metrics
      batch.forEach(event => this.updateMetrics(event, true));

      // Store analytics
      if (this.config.enableAnalytics) {
        await Promise.all(batch.map(event => this.storeEventAnalytics(event)));
      }

      this.logger.debug('Event batch processed', {
        batchSize: batch.length,
        roomCount: eventsByRoom.size
      });

    } catch (error) {
      this.logger.error('Failed to process event batch:', error);
      
      // Move failed events to dead letter queue
      batch.forEach(event => {
        event.metadata.retryCount = (event.metadata.retryCount || 0) + 1;
        if (event.metadata.retryCount <= this.config.maxRetries) {
          this.deadLetterQueue.push(event);
        }
      });
    } finally {
      this.isProcessing = false;
    }
  }

  private async storeEventAnalytics(event: PublishedEvent): Promise<void> {
    try {
      const analyticsKey = `analytics:events:${event.organizationId}:${event.type}:${new Date().toISOString().slice(0, 10)}`;
      
      await this.redisManager.client.hincrby(analyticsKey, 'count', 1);
      await this.redisManager.client.hincrby(analyticsKey, `priority_${event.metadata.priority}`, 1);
      await this.redisManager.client.expire(analyticsKey, 86400 * 30); // 30 days retention
      
    } catch (error) {
      this.logger.warn('Failed to store event analytics:', error);
    }
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  private generateDeduplicationKey(event: PublishedEvent): string {
    const key = JSON.stringify({
      type: event.type,
      source: event.source,
      organizationId: event.organizationId,
      data: event.data,
      correlationId: event.metadata.correlationId
    });
    
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  private initializeMetrics(): void {
    this.metrics = {
      totalPublished: 0,
      publishedByType: {} as Record<EventType, number>,
      publishedByPriority: {} as Record<EventPriority, number>,
      averageProcessingTime: 0,
      successRate: 0,
      queueSize: 0,
      deadLetterQueueSize: 0
    };
  }

  private updateMetrics(event: PublishedEvent, success: boolean): void {
    this.metrics.totalPublished++;
    
    if (!this.metrics.publishedByType[event.type]) {
      this.metrics.publishedByType[event.type] = 0;
    }
    this.metrics.publishedByType[event.type]++;
    
    if (!this.metrics.publishedByPriority[event.metadata.priority]) {
      this.metrics.publishedByPriority[event.metadata.priority] = 0;
    }
    this.metrics.publishedByPriority[event.metadata.priority]++;

    this.metrics.queueSize = this.publishQueue.length;
    this.metrics.deadLetterQueueSize = this.deadLetterQueue.length;
  }

  private startCleanupService(): void {
    setInterval(() => {
      // Clean up old event history
      const cutoffTime = Date.now() - this.config.historyRetention;
      for (const [eventId, event] of this.eventHistory.entries()) {
        if (event.metadata.timestamp.getTime() < cutoffTime) {
          this.eventHistory.delete(eventId);
        }
      }

      // Clean up dead letter queue
      const dlqCutoff = Date.now() - this.config.deadLetterRetention;
      this.deadLetterQueue = this.deadLetterQueue.filter(
        event => event.metadata.timestamp.getTime() > dlqCutoff
      );
    }, 300000); // 5 minutes
  }

  /**
   * Public API methods
   */
  getMetrics(): EventMetrics {
    return { ...this.metrics };
  }

  getQueueStatus(): {
    publishQueue: number;
    deadLetterQueue: number;
    isProcessing: boolean;
  } {
    return {
      publishQueue: this.publishQueue.length,
      deadLetterQueue: this.deadLetterQueue.length,
      isProcessing: this.isProcessing
    };
  }

  getEventHistory(organizationId: string, limit: number = 100): PublishedEvent[] {
    return Array.from(this.eventHistory.values())
      .filter(event => event.organizationId === organizationId)
      .sort((a, b) => b.metadata.timestamp.getTime() - a.metadata.timestamp.getTime())
      .slice(0, limit);
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Event Publisher...');

    // Clear batch timer
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
    }

    // Process remaining events
    if (this.publishQueue.length > 0) {
      await this.processBatch();
    }

    // Clear data structures
    this.publishQueue.length = 0;
    this.deadLetterQueue.length = 0;
    this.eventHistory.clear();
    this.deduplicationCache.clear();

    this.logger.info('Event Publisher shutdown complete');
  }
}