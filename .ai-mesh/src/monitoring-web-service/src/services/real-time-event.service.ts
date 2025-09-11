/**
 * Real-time Event System - Sprint 5 Task 5.2
 * Event publishing and subscription with Redis message queuing
 * 
 * Features:
 * - Redis pub/sub for distributed event messaging
 * - Event filtering by user permissions and organization
 * - Message queuing for reliable delivery
 * - Event replay for new connections
 * - Priority-based event processing
 * - Event aggregation and batching
 */

import { RedisManager } from '../config/redis.config';
import { DatabaseConnection } from '../database/connection';
import * as winston from 'winston';
import EventEmitter from 'events';

export interface RealtimeEvent {
  id: string;
  type: 'metrics_update' | 'dashboard_change' | 'user_activity' | 'system_alert' | 'collaborative_action';
  subtype?: string;
  organizationId: string;
  userId?: string;
  data: any;
  metadata: {
    timestamp: Date;
    priority: 'low' | 'medium' | 'high' | 'critical';
    ttl?: number; // Time to live in seconds
    replay?: boolean; // Should this event be replayed to new connections
    batchable?: boolean; // Can this event be batched with others
    requiresAck?: boolean; // Requires acknowledgment from recipients
  };
  permissions?: {
    roles?: string[];
    users?: string[];
    minRole?: 'viewer' | 'developer' | 'manager' | 'admin';
  };
}

export interface EventFilter {
  organizationId?: string;
  userId?: string;
  eventTypes?: string[];
  eventSubtypes?: string[];
  priority?: ('low' | 'medium' | 'high' | 'critical')[];
  timeRange?: {
    start: Date;
    end: Date;
  };
}

export interface EventSubscription {
  id: string;
  connectionId: string;
  organizationId: string;
  userId: string;
  userRole: string;
  filters: EventFilter;
  channels: string[];
  subscribedAt: Date;
  lastActivity: Date;
  acknowledged: Set<string>; // Event IDs that were acknowledged
}

export interface EventQueue {
  name: string;
  organizationId: string;
  events: RealtimeEvent[];
  maxSize: number;
  retentionTime: number; // in seconds
  processingOrder: 'fifo' | 'priority';
}

export interface EventMetrics {
  eventsPublished: number;
  eventsDelivered: number;
  eventsFailed: number;
  averageDeliveryTime: number;
  queueBacklog: number;
  activeSubscriptions: number;
  replayRequests: number;
}

export class RealtimeEventService extends EventEmitter {
  private subscriptions: Map<string, EventSubscription> = new Map();
  private eventQueues: Map<string, EventQueue> = new Map();
  private eventHistory: Map<string, RealtimeEvent[]> = new Map(); // orgId -> events
  private metrics: EventMetrics;
  private processingInterval: NodeJS.Timeout;
  private cleanupInterval: NodeJS.Timeout;
  private batchProcessor: Map<string, { events: RealtimeEvent[], timeout: NodeJS.Timeout }> = new Map();

  constructor(
    private redisManager: RedisManager,
    private db: DatabaseConnection,
    private logger: winston.Logger,
    private config: {
      maxEventHistory?: number;
      batchInterval?: number;
      cleanupInterval?: number;
      defaultTTL?: number;
      maxQueueSize?: number;
    } = {}
  ) {
    super();

    this.metrics = {
      eventsPublished: 0,
      eventsDelivered: 0,
      eventsFailed: 0,
      averageDeliveryTime: 0,
      queueBacklog: 0,
      activeSubscriptions: 0,
      replayRequests: 0
    };

    this.initializeRedisChannels();
    this.startBackgroundProcessing();

    this.logger.info('Real-time Event Service initialized', {
      maxEventHistory: this.config.maxEventHistory || 1000,
      batchInterval: this.config.batchInterval || 200,
      cleanupInterval: this.config.cleanupInterval || 300000,
      defaultTTL: this.config.defaultTTL || 3600
    });
  }

  /**
   * Initialize Redis pub/sub channels
   */
  private initializeRedisChannels(): void {
    const subscriber = this.redisManager.getSubscriber();

    // Subscribe to organization-specific channels
    subscriber.psubscribe('fortium:events:*', (err, count) => {
      if (err) {
        this.logger.error('Failed to subscribe to event channels:', err);
        return;
      }
      this.logger.info(`Subscribed to ${count} event channels`);
    });

    // Handle incoming events from Redis
    subscriber.on('pmessage', async (pattern, channel, message) => {
      try {
        const event: RealtimeEvent = JSON.parse(message);
        await this.handleIncomingEvent(event, channel);
      } catch (error) {
        this.logger.error('Failed to process incoming event:', error);
        this.metrics.eventsFailed++;
      }
    });

    subscriber.on('error', (error) => {
      this.logger.error('Redis subscriber error:', error);
    });
  }

  /**
   * Publish event to the real-time system
   */
  async publishEvent(event: Omit<RealtimeEvent, 'id' | 'metadata'> & { metadata?: Partial<RealtimeEvent['metadata']> }): Promise<string> {
    try {
      const fullEvent: RealtimeEvent = {
        id: this.generateEventId(),
        ...event,
        metadata: {
          timestamp: new Date(),
          priority: 'medium',
          ttl: this.config.defaultTTL || 3600,
          replay: true,
          batchable: true,
          requiresAck: false,
          ...event.metadata
        }
      };

      // Store event in history for replay
      if (fullEvent.metadata.replay) {
        await this.storeEventInHistory(fullEvent);
      }

      // Determine Redis channel
      const channel = this.getChannelForEvent(fullEvent);

      // Publish to Redis for distribution
      const publisher = this.redisManager.getPublisher();
      await publisher.publish(channel, JSON.stringify(fullEvent));

      // Update metrics
      this.metrics.eventsPublished++;

      // Queue for processing if needed
      await this.queueEventForProcessing(fullEvent);

      this.logger.debug('Event published', {
        eventId: fullEvent.id,
        type: fullEvent.type,
        organizationId: fullEvent.organizationId,
        priority: fullEvent.metadata.priority,
        channel
      });

      this.emit('event:published', fullEvent);

      return fullEvent.id;

    } catch (error) {
      this.logger.error('Failed to publish event:', error);
      this.metrics.eventsFailed++;
      throw error;
    }
  }

  /**
   * Subscribe to real-time events
   */
  async subscribe(subscription: Omit<EventSubscription, 'id' | 'subscribedAt' | 'lastActivity' | 'acknowledged'>): Promise<string> {
    try {
      const subscriptionId = this.generateSubscriptionId();
      
      const fullSubscription: EventSubscription = {
        id: subscriptionId,
        subscribedAt: new Date(),
        lastActivity: new Date(),
        acknowledged: new Set(),
        ...subscription
      };

      // Validate subscription permissions
      const isValid = await this.validateSubscription(fullSubscription);
      if (!isValid) {
        throw new Error('Invalid subscription permissions');
      }

      // Store subscription
      this.subscriptions.set(subscriptionId, fullSubscription);
      this.metrics.activeSubscriptions++;

      // Determine channels to subscribe to
      const channels = this.getChannelsForSubscription(fullSubscription);
      fullSubscription.channels = channels;

      // Send recent events if replay is requested
      if (fullSubscription.filters.timeRange || fullSubscription.userId) {
        await this.replayEventsForSubscription(fullSubscription);
      }

      this.logger.info('Event subscription created', {
        subscriptionId,
        organizationId: subscription.organizationId,
        userId: subscription.userId,
        channels: channels.length,
        filters: fullSubscription.filters
      });

      this.emit('subscription:created', fullSubscription);

      return subscriptionId;

    } catch (error) {
      this.logger.error('Failed to create subscription:', error);
      throw error;
    }
  }

  /**
   * Unsubscribe from events
   */
  async unsubscribe(subscriptionId: string): Promise<void> {
    try {
      const subscription = this.subscriptions.get(subscriptionId);
      if (!subscription) {
        this.logger.warn('Attempted to unsubscribe from non-existent subscription', { subscriptionId });
        return;
      }

      // Remove subscription
      this.subscriptions.delete(subscriptionId);
      this.metrics.activeSubscriptions--;

      this.logger.info('Event subscription removed', {
        subscriptionId,
        organizationId: subscription.organizationId,
        userId: subscription.userId,
        duration: Date.now() - subscription.subscribedAt.getTime()
      });

      this.emit('subscription:removed', subscription);

    } catch (error) {
      this.logger.error('Failed to remove subscription:', error);
      throw error;
    }
  }

  /**
   * Acknowledge event receipt
   */
  async acknowledgeEvent(subscriptionId: string, eventId: string): Promise<void> {
    try {
      const subscription = this.subscriptions.get(subscriptionId);
      if (!subscription) {
        this.logger.warn('Acknowledgment for non-existent subscription', { subscriptionId, eventId });
        return;
      }

      subscription.acknowledged.add(eventId);
      subscription.lastActivity = new Date();

      this.logger.debug('Event acknowledged', { subscriptionId, eventId });

    } catch (error) {
      this.logger.error('Failed to acknowledge event:', error);
    }
  }

  /**
   * Get events from history with filtering
   */
  async getEventHistory(organizationId: string, filter: EventFilter, limit: number = 100): Promise<RealtimeEvent[]> {
    try {
      // Try to get from Redis cache first
      const cacheKey = `event_history:${organizationId}:${JSON.stringify(filter)}:${limit}`;
      const cached = await this.redisManager.getCachedMetrics(cacheKey);
      
      if (cached) {
        return cached;
      }

      // Get from memory history
      const orgHistory = this.eventHistory.get(organizationId) || [];
      let filteredEvents = this.applyEventFilter(orgHistory, filter);

      // Sort by timestamp (newest first) and limit
      filteredEvents = filteredEvents
        .sort((a, b) => b.metadata.timestamp.getTime() - a.metadata.timestamp.getTime())
        .slice(0, limit);

      // Cache result
      await this.redisManager.cacheMetrics(cacheKey, filteredEvents, 300); // 5 minutes

      this.metrics.replayRequests++;

      return filteredEvents;

    } catch (error) {
      this.logger.error('Failed to get event history:', error);
      return [];
    }
  }

  /**
   * Publish batch of events efficiently
   */
  async publishEventBatch(events: (Omit<RealtimeEvent, 'id' | 'metadata'> & { metadata?: Partial<RealtimeEvent['metadata']> })[]): Promise<string[]> {
    try {
      const eventIds: string[] = [];
      const publishPromises: Promise<void>[] = [];
      const channelBatches = new Map<string, RealtimeEvent[]>();

      // Process each event and group by channel
      for (const eventData of events) {
        const fullEvent: RealtimeEvent = {
          id: this.generateEventId(),
          ...eventData,
          metadata: {
            timestamp: new Date(),
            priority: 'medium',
            ttl: this.config.defaultTTL || 3600,
            replay: true,
            batchable: true,
            requiresAck: false,
            ...eventData.metadata
          }
        };

        eventIds.push(fullEvent.id);

        // Store in history if needed
        if (fullEvent.metadata.replay) {
          await this.storeEventInHistory(fullEvent);
        }

        // Group by channel for batching
        const channel = this.getChannelForEvent(fullEvent);
        if (!channelBatches.has(channel)) {
          channelBatches.set(channel, []);
        }
        channelBatches.get(channel)!.push(fullEvent);
      }

      // Publish batches to Redis
      const publisher = this.redisManager.getPublisher();
      
      for (const [channel, channelEvents] of channelBatches) {
        const batchMessage = {
          type: 'event_batch',
          events: channelEvents,
          batchSize: channelEvents.length,
          timestamp: new Date()
        };

        publishPromises.push(
          publisher.publish(channel, JSON.stringify(batchMessage))
        );
      }

      // Wait for all publishes to complete
      await Promise.all(publishPromises);

      // Update metrics
      this.metrics.eventsPublished += events.length;

      this.logger.debug('Event batch published', {
        batchSize: events.length,
        channels: channelBatches.size,
        eventIds
      });

      return eventIds;

    } catch (error) {
      this.logger.error('Failed to publish event batch:', error);
      this.metrics.eventsFailed += events.length;
      throw error;
    }
  }

  /**
   * Handle incoming events from Redis
   */
  private async handleIncomingEvent(eventOrBatch: any, channel: string): Promise<void> {
    try {
      if (eventOrBatch.type === 'event_batch') {
        // Handle batch of events
        for (const event of eventOrBatch.events) {
          await this.processEvent(event);
        }
        this.metrics.eventsDelivered += eventOrBatch.events.length;
      } else {
        // Handle single event
        await this.processEvent(eventOrBatch);
        this.metrics.eventsDelivered++;
      }

    } catch (error) {
      this.logger.error('Failed to handle incoming event:', error);
      this.metrics.eventsFailed++;
    }
  }

  /**
   * Process individual event for delivery to subscribers
   */
  private async processEvent(event: RealtimeEvent): Promise<void> {
    const startTime = Date.now();

    try {
      // Find matching subscriptions
      const matchingSubscriptions = this.findMatchingSubscriptions(event);

      if (matchingSubscriptions.length === 0) {
        return;
      }

      // Check if event should be batched
      if (event.metadata.batchable && event.metadata.priority !== 'critical') {
        await this.addToBatch(event, matchingSubscriptions);
      } else {
        // Deliver immediately for critical events
        await this.deliverEventToSubscriptions(event, matchingSubscriptions);
      }

      // Update delivery metrics
      const deliveryTime = Date.now() - startTime;
      this.metrics.averageDeliveryTime = (this.metrics.averageDeliveryTime + deliveryTime) / 2;

    } catch (error) {
      this.logger.error('Failed to process event:', error, { eventId: event.id });
    }
  }

  /**
   * Add event to batch for efficient delivery
   */
  private async addToBatch(event: RealtimeEvent, subscriptions: EventSubscription[]): Promise<void> {
    for (const subscription of subscriptions) {
      const batchKey = subscription.connectionId;
      
      if (!this.batchProcessor.has(batchKey)) {
        this.batchProcessor.set(batchKey, {
          events: [],
          timeout: setTimeout(() => this.processBatch(batchKey), this.config.batchInterval || 200)
        });
      }

      const batch = this.batchProcessor.get(batchKey)!;
      batch.events.push(event);

      // Process batch immediately if it gets too large
      if (batch.events.length >= 10) {
        clearTimeout(batch.timeout);
        await this.processBatch(batchKey);
      }
    }
  }

  /**
   * Process batched events
   */
  private async processBatch(batchKey: string): Promise<void> {
    try {
      const batch = this.batchProcessor.get(batchKey);
      if (!batch || batch.events.length === 0) {
        return;
      }

      // Find subscription
      const subscription = Array.from(this.subscriptions.values())
        .find(s => s.connectionId === batchKey);
      
      if (!subscription) {
        this.batchProcessor.delete(batchKey);
        return;
      }

      // Deliver batched events
      const batchEvent: RealtimeEvent = {
        id: this.generateEventId(),
        type: 'system_alert',
        subtype: 'event_batch',
        organizationId: subscription.organizationId,
        data: {
          events: batch.events.map(e => ({
            id: e.id,
            type: e.type,
            subtype: e.subtype,
            data: e.data,
            timestamp: e.metadata.timestamp
          })),
          batchSize: batch.events.length
        },
        metadata: {
          timestamp: new Date(),
          priority: 'medium',
          batchable: false,
          requiresAck: true
        }
      };

      await this.deliverEventToSubscriptions(batchEvent, [subscription]);

      // Clean up batch
      this.batchProcessor.delete(batchKey);

    } catch (error) {
      this.logger.error('Failed to process batch:', error, { batchKey });
    }
  }

  /**
   * Deliver event to matching subscriptions
   */
  private async deliverEventToSubscriptions(event: RealtimeEvent, subscriptions: EventSubscription[]): Promise<void> {
    const deliveryPromises = subscriptions.map(async (subscription) => {
      try {
        // Check permissions
        if (!this.checkEventPermissions(event, subscription)) {
          return;
        }

        // Update subscription activity
        subscription.lastActivity = new Date();

        // Emit to connection handler
        this.emit('event:deliver', {
          event,
          subscription,
          deliveryTime: new Date()
        });

      } catch (error) {
        this.logger.error('Failed to deliver event to subscription:', error, {
          eventId: event.id,
          subscriptionId: subscription.id
        });
      }
    });

    await Promise.all(deliveryPromises);
  }

  /**
   * Find subscriptions that match the event
   */
  private findMatchingSubscriptions(event: RealtimeEvent): EventSubscription[] {
    const matching: EventSubscription[] = [];

    for (const subscription of this.subscriptions.values()) {
      // Organization match
      if (subscription.organizationId !== event.organizationId) {
        continue;
      }

      // Apply filters
      if (!this.eventMatchesFilter(event, subscription.filters)) {
        continue;
      }

      matching.push(subscription);
    }

    return matching;
  }

  /**
   * Check if event matches subscription filters
   */
  private eventMatchesFilter(event: RealtimeEvent, filter: EventFilter): boolean {
    // Event types filter
    if (filter.eventTypes && !filter.eventTypes.includes(event.type)) {
      return false;
    }

    // Event subtypes filter
    if (filter.eventSubtypes && event.subtype && !filter.eventSubtypes.includes(event.subtype)) {
      return false;
    }

    // Priority filter
    if (filter.priority && !filter.priority.includes(event.metadata.priority)) {
      return false;
    }

    // Time range filter
    if (filter.timeRange) {
      const eventTime = event.metadata.timestamp.getTime();
      if (eventTime < filter.timeRange.start.getTime() || eventTime > filter.timeRange.end.getTime()) {
        return false;
      }
    }

    // User filter
    if (filter.userId && event.userId !== filter.userId) {
      return false;
    }

    return true;
  }

  /**
   * Check event permissions against subscription
   */
  private checkEventPermissions(event: RealtimeEvent, subscription: EventSubscription): boolean {
    if (!event.permissions) {
      return true; // No restrictions
    }

    // Role-based access
    if (event.permissions.minRole) {
      const roleHierarchy = ['viewer', 'developer', 'manager', 'admin'];
      const userRoleIndex = roleHierarchy.indexOf(subscription.userRole);
      const minRoleIndex = roleHierarchy.indexOf(event.permissions.minRole);
      
      if (userRoleIndex < minRoleIndex) {
        return false;
      }
    }

    // Specific roles
    if (event.permissions.roles && !event.permissions.roles.includes(subscription.userRole)) {
      return false;
    }

    // Specific users
    if (event.permissions.users && !event.permissions.users.includes(subscription.userId)) {
      return false;
    }

    return true;
  }

  /**
   * Store event in history for replay
   */
  private async storeEventInHistory(event: RealtimeEvent): Promise<void> {
    try {
      // Store in memory
      if (!this.eventHistory.has(event.organizationId)) {
        this.eventHistory.set(event.organizationId, []);
      }

      const orgHistory = this.eventHistory.get(event.organizationId)!;
      orgHistory.push(event);

      // Maintain history size limit
      const maxHistory = this.config.maxEventHistory || 1000;
      if (orgHistory.length > maxHistory) {
        orgHistory.splice(0, orgHistory.length - maxHistory);
      }

      // Store in Redis with TTL
      const historyKey = `event_history:${event.organizationId}:recent`;
      await this.redisManager.cacheMetrics(historyKey, orgHistory.slice(-100), event.metadata.ttl || 3600);

    } catch (error) {
      this.logger.error('Failed to store event in history:', error);
    }
  }

  /**
   * Replay events for new subscription
   */
  private async replayEventsForSubscription(subscription: EventSubscription): Promise<void> {
    try {
      let filter = subscription.filters;
      
      // If no time range specified, get last hour of events
      if (!filter.timeRange) {
        filter = {
          ...filter,
          timeRange: {
            start: new Date(Date.now() - 3600000), // 1 hour ago
            end: new Date()
          }
        };
      }

      const events = await this.getEventHistory(subscription.organizationId, filter, 50);
      
      if (events.length > 0) {
        // Send replay batch
        const replayEvent: RealtimeEvent = {
          id: this.generateEventId(),
          type: 'system_alert',
          subtype: 'event_replay',
          organizationId: subscription.organizationId,
          data: {
            events: events.map(e => ({
              id: e.id,
              type: e.type,
              subtype: e.subtype,
              data: e.data,
              timestamp: e.metadata.timestamp
            })),
            replaySize: events.length,
            subscriptionId: subscription.id
          },
          metadata: {
            timestamp: new Date(),
            priority: 'medium',
            batchable: false,
            replay: false
          }
        };

        await this.deliverEventToSubscriptions(replayEvent, [subscription]);

        this.logger.info('Event replay completed', {
          subscriptionId: subscription.id,
          eventsReplayed: events.length
        });
      }

    } catch (error) {
      this.logger.error('Failed to replay events for subscription:', error);
    }
  }

  /**
   * Start background processing services
   */
  private startBackgroundProcessing(): void {
    // Process queued events
    this.processingInterval = setInterval(() => {
      this.processQueuedEvents();
    }, 1000);

    // Cleanup expired events and subscriptions
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval || 300000); // 5 minutes
  }

  /**
   * Process queued events
   */
  private async processQueuedEvents(): Promise<void> {
    // Implementation for processing queued events
    // This would handle retry logic, failed deliveries, etc.
  }

  /**
   * Cleanup expired data
   */
  private cleanup(): void {
    const now = Date.now();
    const maxAge = 24 * 3600 * 1000; // 24 hours

    // Clean up old events from history
    for (const [orgId, events] of this.eventHistory.entries()) {
      const validEvents = events.filter(event => {
        const age = now - event.metadata.timestamp.getTime();
        const ttl = (event.metadata.ttl || 3600) * 1000;
        return age < Math.min(maxAge, ttl);
      });
      
      this.eventHistory.set(orgId, validEvents);
    }

    // Clean up inactive subscriptions
    const inactiveThreshold = 30 * 60 * 1000; // 30 minutes
    
    for (const [subscriptionId, subscription] of this.subscriptions.entries()) {
      const inactiveDuration = now - subscription.lastActivity.getTime();
      
      if (inactiveDuration > inactiveThreshold) {
        this.subscriptions.delete(subscriptionId);
        this.metrics.activeSubscriptions--;
        
        this.logger.info('Removed inactive subscription', {
          subscriptionId,
          inactiveDuration,
          organizationId: subscription.organizationId
        });
      }
    }
  }

  /**
   * Utility methods
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getChannelForEvent(event: RealtimeEvent): string {
    return `fortium:events:${event.organizationId}:${event.type}`;
  }

  private getChannelsForSubscription(subscription: EventSubscription): string[] {
    const channels: string[] = [];
    
    // Organization-wide channel
    channels.push(`fortium:events:${subscription.organizationId}:*`);
    
    // Type-specific channels
    if (subscription.filters.eventTypes) {
      for (const eventType of subscription.filters.eventTypes) {
        channels.push(`fortium:events:${subscription.organizationId}:${eventType}`);
      }
    }
    
    return channels;
  }

  private async validateSubscription(subscription: EventSubscription): Promise<boolean> {
    // Validate user exists and has access to organization
    try {
      const query = `
        SELECT u.id, u.role, t.id as org_id
        FROM users u
        JOIN tenants t ON u.organization_id = t.id
        WHERE u.id = $1 AND t.id = $2 AND u.is_active = true AND t.is_active = true
      `;
      
      const result = await this.db.query(query, [subscription.userId, subscription.organizationId]);
      return result.rows.length > 0;
    } catch {
      return false;
    }
  }

  private async queueEventForProcessing(event: RealtimeEvent): Promise<void> {
    // Implementation for queuing events for processing
    // This would handle retry logic, persistence, etc.
  }

  private applyEventFilter(events: RealtimeEvent[], filter: EventFilter): RealtimeEvent[] {
    return events.filter(event => this.eventMatchesFilter(event, filter));
  }

  /**
   * Public API methods
   */
  getMetrics(): EventMetrics {
    this.metrics.queueBacklog = this.messageQueue?.length || 0;
    this.metrics.activeSubscriptions = this.subscriptions.size;
    
    return { ...this.metrics };
  }

  getSubscriptionStats(): any {
    const stats = {
      totalSubscriptions: this.subscriptions.size,
      subscriptionsByOrganization: new Map<string, number>(),
      subscriptionsByType: new Map<string, number>()
    };

    for (const subscription of this.subscriptions.values()) {
      // By organization
      const orgCount = stats.subscriptionsByOrganization.get(subscription.organizationId) || 0;
      stats.subscriptionsByOrganization.set(subscription.organizationId, orgCount + 1);

      // By event types
      if (subscription.filters.eventTypes) {
        for (const eventType of subscription.filters.eventTypes) {
          const typeCount = stats.subscriptionsByType.get(eventType) || 0;
          stats.subscriptionsByType.set(eventType, typeCount + 1);
        }
      }
    }

    return {
      ...stats,
      subscriptionsByOrganization: Object.fromEntries(stats.subscriptionsByOrganization),
      subscriptionsByType: Object.fromEntries(stats.subscriptionsByType)
    };
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Real-time Event Service...');

    // Clear intervals
    if (this.processingInterval) clearInterval(this.processingInterval);
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);

    // Process any remaining batches
    for (const [batchKey] of this.batchProcessor.entries()) {
      await this.processBatch(batchKey);
    }

    // Clear data structures
    this.subscriptions.clear();
    this.eventQueues.clear();
    this.eventHistory.clear();
    this.batchProcessor.clear();

    this.logger.info('Real-time Event Service shutdown complete');
  }
}