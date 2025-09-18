/**
 * Event Subscriber - Sprint 5 Task 5.2
 * Real-time event subscription management with Redis
 * 
 * Features:
 * - Multi-tenant event subscriptions
 * - Permission-based event filtering
 * - Subscription persistence and recovery
 * - Event replay and history
 * - Subscription analytics and monitoring
 * - Auto-scaling subscription handling
 */

import { Server, Socket } from 'socket.io';
import { RedisManager } from '../config/redis.config';
import { DatabaseConnection } from '../database/connection';
import * as winston from 'winston';
import EventEmitter from 'events';
import { EventType, EventPriority, PublishedEvent } from './event-publisher';

export interface EventSubscription {
  id: string;
  socketId: string;
  userId: string;
  organizationId: string;
  userRole: string;
  eventTypes: EventType[];
  rooms: string[];
  filters: SubscriptionFilter;
  permissions: string[];
  createdAt: Date;
  lastActivity: Date;
  metadata: {
    subscriptionCount: number;
    eventsReceived: number;
    eventsFiltered: number;
    averageLatency: number;
  };
}

export interface SubscriptionFilter {
  priority?: EventPriority[];
  tags?: string[];
  sources?: string[];
  userIds?: string[];
  excludeUsers?: string[];
  timeRange?: {
    start: Date;
    end: Date;
  };
  dataFilters?: Record<string, any>;
}

export interface SubscriptionMetrics {
  totalSubscriptions: number;
  subscriptionsByType: Record<EventType, number>;
  subscriptionsByRoom: Record<string, number>;
  eventsDelivered: number;
  eventsFiltered: number;
  averageDeliveryLatency: number;
  subscriptionHealth: number;
}

export interface EventDelivery {
  subscriptionId: string;
  eventId: string;
  deliveredAt: Date;
  latency: number;
  success: boolean;
  error?: string;
}

export class EventSubscriber extends EventEmitter {
  private subscriptions: Map<string, EventSubscription> = new Map();
  private socketSubscriptions: Map<string, Set<string>> = new Map(); // socketId -> subscription IDs
  private roomSubscriptions: Map<string, Set<string>> = new Map(); // room -> subscription IDs
  private redisSubscriptions: Map<string, any> = new Map(); // channel -> redis subscription
  private metrics: SubscriptionMetrics;
  private deliveryHistory: EventDelivery[] = [];

  constructor(
    private io: Server,
    private redisManager: RedisManager,
    private db: DatabaseConnection,
    private logger: winston.Logger,
    private config: {
      maxSubscriptionsPerUser: number;
      subscriptionTtl: number;
      deliveryTimeout: number;
      historyRetention: number;
      enableReplay: boolean;
      replayBufferSize: number;
    }
  ) {
    super();
    
    this.initializeMetrics();
    this.setupRedisSubscriptionHandling();
    this.startBackgroundServices();
  }

  /**
   * Subscribe socket to events
   */
  async subscribe(
    socket: Socket,
    subscriptionRequest: {
      eventTypes: EventType[];
      rooms: string[];
      filters?: SubscriptionFilter;
      replayHistory?: boolean;
      replayCount?: number;
    }
  ): Promise<{
    success: boolean;
    subscriptionId?: string;
    error?: string;
    eventsReplayed?: number;
  }> {
    try {
      const { user } = socket.data;
      
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      // Check subscription limits
      const existingSubscriptions = this.getUserSubscriptions(user.id);
      if (existingSubscriptions.length >= this.config.maxSubscriptionsPerUser) {
        return { success: false, error: 'Subscription limit exceeded' };
      }

      // Validate event type permissions
      const permissionValidation = await this.validateEventPermissions(
        user.role,
        user.permissions,
        subscriptionRequest.eventTypes
      );
      
      if (!permissionValidation.valid) {
        return { success: false, error: permissionValidation.error };
      }

      // Validate room access
      const roomValidation = await this.validateRoomAccess(
        user.organizationId,
        user.role,
        subscriptionRequest.rooms
      );
      
      if (!roomValidation.valid) {
        return { success: false, error: roomValidation.error };
      }

      // Create subscription
      const subscription: EventSubscription = {
        id: this.generateSubscriptionId(),
        socketId: socket.id,
        userId: user.id,
        organizationId: user.organizationId,
        userRole: user.role,
        eventTypes: subscriptionRequest.eventTypes,
        rooms: subscriptionRequest.rooms,
        filters: subscriptionRequest.filters || {},
        permissions: user.permissions,
        createdAt: new Date(),
        lastActivity: new Date(),
        metadata: {
          subscriptionCount: 1,
          eventsReceived: 0,
          eventsFiltered: 0,
          averageLatency: 0
        }
      };

      // Store subscription
      this.subscriptions.set(subscription.id, subscription);

      // Track by socket
      if (!this.socketSubscriptions.has(socket.id)) {
        this.socketSubscriptions.set(socket.id, new Set());
      }
      this.socketSubscriptions.get(socket.id)!.add(subscription.id);

      // Track by rooms
      for (const room of subscription.rooms) {
        if (!this.roomSubscriptions.has(room)) {
          this.roomSubscriptions.set(room, new Set());
        }
        this.roomSubscriptions.get(room)!.add(subscription.id);
      }

      // Subscribe to Redis channels for each room
      await this.subscribeToRedisChannels(subscription);

      // Persist subscription for recovery
      await this.persistSubscription(subscription);

      // Replay events if requested
      let eventsReplayed = 0;
      if (subscriptionRequest.replayHistory && this.config.enableReplay) {
        eventsReplayed = await this.replayEvents(
          subscription,
          subscriptionRequest.replayCount || this.config.replayBufferSize
        );
      }

      // Update metrics
      this.updateSubscriptionMetrics(subscription, true);

      // Send confirmation to client
      socket.emit('subscription_confirmed', {
        subscriptionId: subscription.id,
        eventTypes: subscription.eventTypes,
        rooms: subscription.rooms,
        filters: subscription.filters,
        eventsReplayed,
        timestamp: new Date()
      });

      this.logger.info('Event subscription created', {
        subscriptionId: subscription.id,
        userId: user.id,
        organizationId: user.organizationId,
        eventTypes: subscription.eventTypes,
        rooms: subscription.rooms,
        eventsReplayed
      });

      this.emit('subscription:created', subscription);

      return { 
        success: true, 
        subscriptionId: subscription.id,
        eventsReplayed
      };

    } catch (error) {
      this.logger.error('Failed to create subscription:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Unsubscribe from events
   */
  async unsubscribe(socketId: string, subscriptionId?: string): Promise<{
    success: boolean;
    unsubscribedCount: number;
  }> {
    try {
      let unsubscribedCount = 0;

      if (subscriptionId) {
        // Unsubscribe specific subscription
        const success = await this.removeSubscription(subscriptionId);
        unsubscribedCount = success ? 1 : 0;
      } else {
        // Unsubscribe all subscriptions for socket
        const subscriptionIds = this.socketSubscriptions.get(socketId) || new Set();
        
        for (const subId of subscriptionIds) {
          const success = await this.removeSubscription(subId);
          if (success) unsubscribedCount++;
        }
      }

      return { success: true, unsubscribedCount };

    } catch (error) {
      this.logger.error('Failed to unsubscribe:', error);
      return { success: false, unsubscribedCount: 0 };
    }
  }

  /**
   * Update subscription filters
   */
  async updateSubscriptionFilters(
    subscriptionId: string,
    newFilters: SubscriptionFilter
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const subscription = this.subscriptions.get(subscriptionId);
      if (!subscription) {
        return { success: false, error: 'Subscription not found' };
      }

      // Update filters
      subscription.filters = { ...subscription.filters, ...newFilters };
      subscription.lastActivity = new Date();

      // Persist updated subscription
      await this.persistSubscription(subscription);

      this.logger.debug('Subscription filters updated', {
        subscriptionId,
        newFilters
      });

      return { success: true };

    } catch (error) {
      this.logger.error('Failed to update subscription filters:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Handle incoming events from Redis
   */
  private async handleRedisEvent(channel: string, message: string): Promise<void> {
    try {
      const eventData = JSON.parse(message);
      
      // Handle batch events
      if (eventData.type === 'batch_events') {
        for (const event of eventData.events) {
          await this.deliverEventToSubscribers(channel, event);
        }
      } else {
        // Handle single event
        await this.deliverEventToSubscribers(channel, eventData);
      }

    } catch (error) {
      this.logger.error('Failed to handle Redis event:', error);
    }
  }

  /**
   * Deliver event to matching subscriptions
   */
  private async deliverEventToSubscribers(channel: string, event: any): Promise<void> {
    const startTime = Date.now();
    const room = channel.replace('events:', '');
    const subscriptionIds = this.roomSubscriptions.get(room) || new Set();

    let deliveredCount = 0;
    let filteredCount = 0;

    for (const subscriptionId of subscriptionIds) {
      const subscription = this.subscriptions.get(subscriptionId);
      if (!subscription) continue;

      try {
        // Check if event matches subscription
        if (!this.eventMatchesSubscription(event, subscription)) {
          filteredCount++;
          continue;
        }

        // Get socket
        const socket = this.io.sockets.sockets.get(subscription.socketId);
        if (!socket) {
          // Socket disconnected, remove subscription
          await this.removeSubscription(subscriptionId);
          continue;
        }

        // Deliver event with timeout
        const deliveryPromise = new Promise<void>((resolve, reject) => {
          socket.emit('event', event, (ack: any) => {
            if (ack?.error) {
              reject(new Error(ack.error));
            } else {
              resolve();
            }
          });

          // Timeout if no acknowledgment
          setTimeout(() => {
            reject(new Error('Delivery timeout'));
          }, this.config.deliveryTimeout);
        });

        await deliveryPromise;

        // Update subscription metrics
        subscription.metadata.eventsReceived++;
        subscription.lastActivity = new Date();
        
        const latency = Date.now() - startTime;
        subscription.metadata.averageLatency = 
          (subscription.metadata.averageLatency + latency) / 2;

        // Record delivery
        this.recordEventDelivery({
          subscriptionId,
          eventId: event.eventId,
          deliveredAt: new Date(),
          latency,
          success: true
        });

        deliveredCount++;

      } catch (error) {
        // Record failed delivery
        this.recordEventDelivery({
          subscriptionId,
          eventId: event.eventId,
          deliveredAt: new Date(),
          latency: Date.now() - startTime,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        this.logger.warn('Event delivery failed', {
          subscriptionId,
          eventId: event.eventId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Update global metrics
    this.metrics.eventsDelivered += deliveredCount;
    this.metrics.eventsFiltered += filteredCount;

    this.logger.debug('Event delivered to subscribers', {
      eventId: event.eventId,
      room,
      delivered: deliveredCount,
      filtered: filteredCount,
      totalSubscribers: subscriptionIds.size
    });
  }

  /**
   * Check if event matches subscription criteria
   */
  private eventMatchesSubscription(event: any, subscription: EventSubscription): boolean {
    // Check event type
    if (!subscription.eventTypes.includes(event.type)) {
      return false;
    }

    const filters = subscription.filters;

    // Check priority filter
    if (filters.priority && !filters.priority.includes(event.metadata?.priority)) {
      return false;
    }

    // Check tags filter
    if (filters.tags && filters.tags.length > 0) {
      const eventTags = event.metadata?.tags || [];
      if (!filters.tags.some(tag => eventTags.includes(tag))) {
        return false;
      }
    }

    // Check source filter
    if (filters.sources && !filters.sources.includes(event.source)) {
      return false;
    }

    // Check user ID filter
    if (filters.userIds && event.userId && !filters.userIds.includes(event.userId)) {
      return false;
    }

    // Check exclude users filter
    if (filters.excludeUsers && event.userId && filters.excludeUsers.includes(event.userId)) {
      return false;
    }

    // Check time range filter
    if (filters.timeRange) {
      const eventTime = new Date(event.metadata?.timestamp);
      if (eventTime < filters.timeRange.start || eventTime > filters.timeRange.end) {
        return false;
      }
    }

    // Check organization isolation
    if (event.organizationId && event.organizationId !== subscription.organizationId) {
      return false;
    }

    // Check data filters (custom field matching)
    if (filters.dataFilters) {
      for (const [field, expectedValue] of Object.entries(filters.dataFilters)) {
        const eventValue = this.getNestedProperty(event.data, field);
        if (eventValue !== expectedValue) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Subscribe to Redis channels for subscription
   */
  private async subscribeToRedisChannels(subscription: EventSubscription): Promise<void> {
    for (const room of subscription.rooms) {
      const channel = `events:${room}`;
      
      if (!this.redisSubscriptions.has(channel)) {
        // Create new Redis subscription
        const subscriber = this.redisManager.createSubscriber();
        
        subscriber.on('message', (receivedChannel: string, message: string) => {
          if (receivedChannel === channel) {
            this.handleRedisEvent(channel, message);
          }
        });

        await subscriber.subscribe(channel);
        this.redisSubscriptions.set(channel, subscriber);

        this.logger.debug('Subscribed to Redis channel', { channel });
      }
    }
  }

  /**
   * Replay recent events for subscription
   */
  private async replayEvents(subscription: EventSubscription, count: number): Promise<number> {
    try {
      let totalReplayed = 0;

      for (const room of subscription.rooms) {
        const historyKey = `event_history:${room}`;
        const recentEvents = await this.redisManager.client.lrange(historyKey, 0, count - 1);
        
        for (const eventJson of recentEvents) {
          try {
            const event = JSON.parse(eventJson);
            
            if (this.eventMatchesSubscription(event, subscription)) {
              const socket = this.io.sockets.sockets.get(subscription.socketId);
              if (socket) {
                socket.emit('event_replay', event);
                totalReplayed++;
              }
            }
          } catch (parseError) {
            this.logger.warn('Failed to parse replay event:', parseError);
          }
        }
      }

      return totalReplayed;

    } catch (error) {
      this.logger.error('Failed to replay events:', error);
      return 0;
    }
  }

  /**
   * Helper methods
   */
  private async validateEventPermissions(
    userRole: string,
    userPermissions: string[],
    eventTypes: EventType[]
  ): Promise<{ valid: boolean; error?: string }> {
    // Admin users can subscribe to all events
    if (userRole === 'admin' || userPermissions.includes('admin')) {
      return { valid: true };
    }

    // Check each event type
    for (const eventType of eventTypes) {
      switch (eventType) {
        case 'system_alert':
        case 'configuration_change':
        case 'security_event':
          if (!['admin', 'manager'].includes(userRole)) {
            return { valid: false, error: `Insufficient permissions for ${eventType} events` };
          }
          break;
        
        case 'metrics_updated':
        case 'dashboard_changed':
        case 'user_activity':
        case 'collaboration_event':
        case 'notification':
        case 'presence_update':
        case 'real_time_data':
          // These are available to all authenticated users
          break;
          
        default:
          return { valid: false, error: `Unknown event type: ${eventType}` };
      }
    }

    return { valid: true };
  }

  private async validateRoomAccess(
    organizationId: string,
    userRole: string,
    rooms: string[]
  ): Promise<{ valid: boolean; error?: string }> {
    for (const room of rooms) {
      // Organization rooms - user must belong to the org
      if (room.startsWith('org:')) {
        const roomOrgId = room.split(':')[1];
        if (roomOrgId !== organizationId) {
          return { valid: false, error: 'Access denied to organization room' };
        }
      }
      
      // Dashboard rooms - check dashboard access
      else if (room.startsWith('dashboard:')) {
        const [, roomOrgId, dashboardId] = room.split(':');
        if (roomOrgId !== organizationId) {
          return { valid: false, error: 'Access denied to dashboard room' };
        }
        // Additional dashboard access validation could be added here
      }
      
      // Metrics rooms - check metrics access
      else if (room.startsWith('metrics:')) {
        const [, roomOrgId, metricType] = room.split(':');
        if (roomOrgId !== organizationId) {
          return { valid: false, error: 'Access denied to metrics room' };
        }
      }
      
      // Collaborative rooms - check permissions
      else if (room.startsWith('collab:')) {
        if (!['admin', 'manager'].includes(userRole)) {
          return { valid: false, error: 'Insufficient permissions for collaborative rooms' };
        }
      }
    }

    return { valid: true };
  }

  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getNestedProperty(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private async persistSubscription(subscription: EventSubscription): Promise<void> {
    try {
      const key = `subscription:${subscription.id}`;
      await this.redisManager.client.setex(
        key, 
        this.config.subscriptionTtl, 
        JSON.stringify(subscription)
      );
    } catch (error) {
      this.logger.warn('Failed to persist subscription:', error);
    }
  }

  private async removeSubscription(subscriptionId: string): Promise<boolean> {
    try {
      const subscription = this.subscriptions.get(subscriptionId);
      if (!subscription) return false;

      // Remove from maps
      this.subscriptions.delete(subscriptionId);
      this.socketSubscriptions.get(subscription.socketId)?.delete(subscriptionId);

      // Remove from room subscriptions
      for (const room of subscription.rooms) {
        this.roomSubscriptions.get(room)?.delete(subscriptionId);
        
        // Clean up empty room subscriptions
        if (this.roomSubscriptions.get(room)?.size === 0) {
          this.roomSubscriptions.delete(room);
          
          // Unsubscribe from Redis channel if no more subscribers
          const channel = `events:${room}`;
          const redisSubscription = this.redisSubscriptions.get(channel);
          if (redisSubscription) {
            await redisSubscription.unsubscribe(channel);
            this.redisSubscriptions.delete(channel);
          }
        }
      }

      // Remove from Redis
      await this.redisManager.client.del(`subscription:${subscriptionId}`);

      // Update metrics
      this.updateSubscriptionMetrics(subscription, false);

      this.logger.debug('Subscription removed', { subscriptionId });
      this.emit('subscription:removed', subscription);

      return true;

    } catch (error) {
      this.logger.error('Failed to remove subscription:', error);
      return false;
    }
  }

  private recordEventDelivery(delivery: EventDelivery): void {
    this.deliveryHistory.push(delivery);
    
    // Limit history size
    if (this.deliveryHistory.length > 10000) {
      this.deliveryHistory.shift();
    }

    // Update metrics
    if (delivery.success) {
      this.metrics.averageDeliveryLatency = 
        (this.metrics.averageDeliveryLatency + delivery.latency) / 2;
    }
  }

  private initializeMetrics(): void {
    this.metrics = {
      totalSubscriptions: 0,
      subscriptionsByType: {} as Record<EventType, number>,
      subscriptionsByRoom: {} as Record<string, number>,
      eventsDelivered: 0,
      eventsFiltered: 0,
      averageDeliveryLatency: 0,
      subscriptionHealth: 100
    };
  }

  private updateSubscriptionMetrics(subscription: EventSubscription, isAdd: boolean): void {
    const delta = isAdd ? 1 : -1;
    
    this.metrics.totalSubscriptions += delta;
    
    for (const eventType of subscription.eventTypes) {
      this.metrics.subscriptionsByType[eventType] = 
        (this.metrics.subscriptionsByType[eventType] || 0) + delta;
    }
    
    for (const room of subscription.rooms) {
      this.metrics.subscriptionsByRoom[room] = 
        (this.metrics.subscriptionsByRoom[room] || 0) + delta;
    }
  }

  private startBackgroundServices(): void {
    // Clean up old deliveries
    setInterval(() => {
      const cutoff = Date.now() - this.config.historyRetention;
      this.deliveryHistory = this.deliveryHistory.filter(
        delivery => delivery.deliveredAt.getTime() > cutoff
      );
    }, 300000); // 5 minutes

    // Health check subscriptions
    setInterval(() => {
      this.performSubscriptionHealthCheck();
    }, 60000); // 1 minute
  }

  private performSubscriptionHealthCheck(): void {
    let healthyCount = 0;
    
    for (const subscription of this.subscriptions.values()) {
      const socket = this.io.sockets.sockets.get(subscription.socketId);
      if (socket && socket.connected) {
        healthyCount++;
      } else {
        // Remove stale subscription
        this.removeSubscription(subscription.id);
      }
    }

    this.metrics.subscriptionHealth = this.subscriptions.size > 0 
      ? (healthyCount / this.subscriptions.size) * 100
      : 100;
  }

  private setupRedisSubscriptionHandling(): void {
    // Handle Redis connection events
    this.redisManager.getSubscriber().on('error', (error) => {
      this.logger.error('Redis subscriber error:', error);
    });

    this.redisManager.getSubscriber().on('connect', () => {
      this.logger.info('Redis subscriber connected');
    });
  }

  /**
   * Public API methods
   */
  getUserSubscriptions(userId: string): EventSubscription[] {
    return Array.from(this.subscriptions.values()).filter(
      subscription => subscription.userId === userId
    );
  }

  getSubscriptionMetrics(): SubscriptionMetrics {
    return { ...this.metrics };
  }

  getSubscriptionById(subscriptionId: string): EventSubscription | undefined {
    return this.subscriptions.get(subscriptionId);
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Event Subscriber...');

    // Unsubscribe from all Redis channels
    for (const [channel, subscriber] of this.redisSubscriptions.entries()) {
      try {
        await subscriber.unsubscribe(channel);
        await subscriber.quit();
      } catch (error) {
        this.logger.error(`Error unsubscribing from channel ${channel}:`, error);
      }
    }

    // Clear all subscriptions
    this.subscriptions.clear();
    this.socketSubscriptions.clear();
    this.roomSubscriptions.clear();
    this.redisSubscriptions.clear();
    this.deliveryHistory.length = 0;

    this.logger.info('Event Subscriber shutdown complete');
  }
}