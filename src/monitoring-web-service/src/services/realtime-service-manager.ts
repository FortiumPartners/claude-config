/**
 * Real-time Service Manager - Sprint 5 Integration
 * Comprehensive integration of all real-time features and WebSocket components
 * 
 * Features:
 * - Unified real-time service orchestration
 * - Component lifecycle management
 * - Service health monitoring
 * - Performance metrics aggregation
 * - Graceful shutdown handling
 */

import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { RedisManager } from '../config/redis.config';
import { DatabaseConnection } from '../database/connection';
import { RoomManager } from '../websocket/room-manager';
import { ConnectionPool, ConnectionPoolConfig } from '../websocket/connection-pool';
import { WebSocketAuthMiddleware, AuthConfig, AuthenticatedSocket } from '../websocket/auth-middleware';
import { EventPublisher } from '../events/event-publisher';
import { EventSubscriber } from '../events/event-subscriber';
import { MetricsStream } from '../streaming/metrics-stream';
import { ActivityFeed } from '../streaming/activity-feed';
import { PresenceManager } from '../streaming/presence-manager';
import * as winston from 'winston';
import EventEmitter from 'events';

export interface RealTimeServiceConfig {
  server: {
    cors?: any;
    maxConnections?: number;
    heartbeatInterval?: number;
    performanceMonitoringInterval?: number;
  };
  auth: AuthConfig;
  connectionPool: ConnectionPoolConfig;
  events: {
    batchSize: number;
    batchInterval: number;
    maxRetries: number;
    deduplicationWindow: number;
    historyRetention: number;
    deadLetterRetention: number;
    enableAnalytics: boolean;
  };
  streaming: {
    bufferSize: number;
    flushInterval: number;
    compressionEnabled: boolean;
    maxUpdateFrequency: number;
    aggregationWindow: number;
    retentionPeriod: number;
  };
  presence: {
    idleTimeout: number;
    awayTimeout: number;
    offlineTimeout: number;
    heartbeatInterval: number;
    historyRetention: number;
    enableAnalytics: boolean;
  };
  activity: {
    maxFeedSize: number;
    recentActivityWindow: number;
    relevanceThreshold: number;
    insightsPeriod: number;
    enableAnalytics: boolean;
    enablePersonalization: boolean;
  };
}

export interface ServiceHealth {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: Date;
  metrics?: any;
  errors?: string[];
}

export interface RealTimeMetrics {
  connections: {
    total: number;
    active: number;
    byOrganization: Record<string, number>;
  };
  events: {
    published: number;
    delivered: number;
    queued: number;
    failed: number;
  };
  streaming: {
    metricsActive: number;
    bufferUtilization: number;
    updateFrequency: number;
  };
  presence: {
    onlineUsers: number;
    totalUsers: number;
    collaborationReadiness: number;
  };
  performance: {
    memoryUsage: number;
    cpuUsage: number;
    responseTime: number;
    errorRate: number;
  };
}

export class RealTimeServiceManager extends EventEmitter {
  private io: Server;
  private roomManager: RoomManager;
  private connectionPool: ConnectionPool;
  private authMiddleware: WebSocketAuthMiddleware;
  private eventPublisher: EventPublisher;
  private eventSubscriber: EventSubscriber;
  private metricsStream: MetricsStream;
  private activityFeed: ActivityFeed;
  private presenceManager: PresenceManager;
  private healthCheckInterval: NodeJS.Timeout;
  private metricsInterval: NodeJS.Timeout;
  private serviceHealth: Map<string, ServiceHealth> = new Map();
  private isShuttingDown: boolean = false;

  constructor(
    private httpServer: HttpServer,
    private redisManager: RedisManager,
    private db: DatabaseConnection,
    private logger: winston.Logger,
    private config: RealTimeServiceConfig
  ) {
    super();
    
    this.initializeServices();
    this.startHealthMonitoring();
  }

  /**
   * Initialize all real-time services
   */
  private async initializeServices(): Promise<void> {
    try {
      this.logger.info('Initializing Real-time Service Manager...');

      // Initialize Socket.io server
      this.initializeSocketIO();

      // Initialize core services
      this.roomManager = new RoomManager(
        this.db,
        this.redisManager,
        this.logger,
        {
          cleanupInterval: 60000,
          maxRoomsPerUser: 50,
          roomTtl: 300000
        }
      );

      this.connectionPool = new ConnectionPool(
        this.redisManager,
        this.logger,
        this.config.connectionPool
      );

      this.authMiddleware = new WebSocketAuthMiddleware(
        this.db,
        this.redisManager,
        this.logger,
        this.config.auth
      );

      // Initialize event system
      this.eventPublisher = new EventPublisher(
        this.redisManager,
        this.db,
        this.logger,
        this.config.events
      );

      this.eventSubscriber = new EventSubscriber(
        this.io,
        this.redisManager,
        this.db,
        this.logger,
        {
          maxSubscriptionsPerUser: 100,
          subscriptionTtl: 3600,
          deliveryTimeout: 5000,
          historyRetention: 86400000,
          enableReplay: true,
          replayBufferSize: 100
        }
      );

      // Initialize streaming services
      this.metricsStream = new MetricsStream(
        this.eventPublisher,
        this.redisManager,
        this.db,
        this.logger,
        this.config.streaming
      );

      this.activityFeed = new ActivityFeed(
        this.eventPublisher,
        this.redisManager,
        this.db,
        this.logger,
        this.config.activity
      );

      this.presenceManager = new PresenceManager(
        this.eventPublisher,
        this.redisManager,
        this.db,
        this.logger,
        this.config.presence
      );

      // Setup Socket.io middleware and handlers
      await this.setupSocketIOHandlers();

      this.logger.info('Real-time Service Manager initialized successfully');
      this.emit('services:initialized');

    } catch (error) {
      this.logger.error('Failed to initialize Real-time Service Manager:', error);
      throw error;
    }
  }

  /**
   * Initialize Socket.io server
   */
  private initializeSocketIO(): void {
    this.io = new Server(this.httpServer, {
      cors: this.config.server.cors || {
        origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
      upgradeTimeout: 30000,
      maxHttpBufferSize: 1024 * 1024, // 1MB
      allowEIO3: false
    });

    // Setup Redis adapter for horizontal scaling
    try {
      const pubClient = this.redisManager.getPublisher();
      const subClient = this.redisManager.getSubscriber();
      this.io.adapter(createAdapter(pubClient, subClient));
      this.logger.info('Socket.io Redis adapter configured');
    } catch (error) {
      this.logger.error('Failed to setup Socket.io Redis adapter:', error);
      throw error;
    }
  }

  /**
   * Setup Socket.io middleware and event handlers
   */
  private async setupSocketIOHandlers(): Promise<void> {
    // Authentication middleware
    this.io.use(this.authMiddleware.authenticate());

    // Connection handling
    this.io.on('connection', async (socket: Socket) => {
      await this.handleNewConnection(socket as AuthenticatedSocket);
    });

    // Error handling
    this.io.on('connect_error', (error) => {
      this.logger.error('Socket.io connection error:', error);
    });

    this.logger.debug('Socket.io handlers configured');
  }

  /**
   * Handle new WebSocket connection
   */
  private async handleNewConnection(socket: AuthenticatedSocket): Promise<void> {
    try {
      const { user } = socket;
      if (!user) {
        socket.disconnect();
        return;
      }

      this.logger.info('New WebSocket connection', {
        userId: user.id,
        organizationId: user.organizationId,
        socketId: socket.id
      });

      // Add to connection pool
      const poolResult = await this.connectionPool.addConnection(
        socket,
        user.id,
        user.organizationId,
        user.role
      );

      if (!poolResult.success) {
        socket.emit('error', { code: 'CONNECTION_REJECTED', message: poolResult.error });
        socket.disconnect();
        return;
      }

      // Set user online in presence manager
      await this.presenceManager.setUserOnline(
        user.id,
        `${user.firstName} ${user.lastName}`,
        user.organizationId,
        {
          socketId: socket.id,
          ipAddress: socket.handshake.address,
          userAgent: socket.handshake.headers['user-agent'] || 'unknown'
        }
      );

      // Join organization room
      const orgRoom = await this.roomManager.getOrganizationRoom(user.organizationId);
      await this.roomManager.joinRoom(socket, orgRoom, user.id, user.role);

      // Setup socket event handlers
      this.setupSocketEventHandlers(socket);

      // Track connection activity
      await this.activityFeed.trackDashboardActivity(
        user.organizationId,
        user.id,
        `${user.firstName} ${user.lastName}`,
        user.role,
        'websocket',
        'view',
        { action: 'connected', socketId: socket.id }
      );

      // Send welcome message
      socket.emit('connected', {
        connectionId: socket.id,
        userId: user.id,
        organizationId: user.organizationId,
        capabilities: {
          realTimeMetrics: true,
          collaboration: true,
          presence: true,
          activityFeed: true
        },
        timestamp: new Date()
      });

      this.emit('connection:established', socket);

    } catch (error) {
      this.logger.error('Failed to handle new connection:', error);
      socket.disconnect();
    }
  }

  /**
   * Setup individual socket event handlers
   */
  private setupSocketEventHandlers(socket: AuthenticatedSocket): void {
    const { user } = socket;

    // Activity tracking
    socket.onAny(() => {
      this.presenceManager.updateUserActivity(socket.id);
    });

    // Room management
    socket.on('join_room', async (data: { room: string; permissions?: string[] }) => {
      try {
        const result = await this.roomManager.joinRoom(socket, data.room, user.id, user.role);
        socket.emit('room_join_result', { success: result.success, error: result.error });
      } catch (error) {
        socket.emit('room_join_result', { success: false, error: 'Internal error' });
      }
    });

    socket.on('leave_room', async (data: { room: string }) => {
      await this.roomManager.leaveRoom(socket, data.room, user.id);
      socket.emit('room_left', { room: data.room });
    });

    // Event subscriptions
    socket.on('subscribe_events', async (data: {
      eventTypes: string[];
      rooms: string[];
      filters?: any;
    }) => {
      const result = await this.eventSubscriber.subscribe(socket, data);
      socket.emit('subscription_result', result);
    });

    // Metrics streaming
    socket.on('subscribe_metrics', async (data: {
      metricName: string;
      options?: any;
    }) => {
      const result = await this.metricsStream.subscribeToMetric(
        user.organizationId,
        data.metricName,
        data.options
      );
      socket.emit('metrics_subscription_result', result);
    });

    // Presence management
    socket.on('set_presence_status', async (data: {
      status: string;
      customMessage?: string;
    }) => {
      const result = await this.presenceManager.setUserStatus(
        user.id,
        data.status as any,
        data.customMessage
      );
      socket.emit('presence_status_result', result);
    });

    // Activity feed
    socket.on('get_activity_feed', async (data: {
      limit?: number;
      offset?: number;
      filters?: any;
    }) => {
      const feed = await this.activityFeed.getActivityFeed(
        user.organizationId,
        user.id,
        data
      );
      socket.emit('activity_feed', feed);
    });

    // Dashboard collaboration
    socket.on('collaborate_dashboard', async (data: {
      dashboardId: string;
      action: string;
      collaborativeData: any;
    }) => {
      await this.eventPublisher.publishCollaborativeEvent(
        user.organizationId,
        data.dashboardId,
        user.id,
        data.collaborativeData
      );
    });

    // Metrics publishing
    socket.on('publish_metric', async (data: {
      name: string;
      value: any;
      type: string;
      tags?: Record<string, string>;
    }) => {
      await this.metricsStream.streamMetric({
        id: `metric_${Date.now()}`,
        type: data.type as any,
        organizationId: user.organizationId,
        userId: user.id,
        name: data.name,
        value: data.value,
        tags: data.tags || {},
        timestamp: new Date(),
        metadata: {
          source: 'websocket',
          collection_method: 'manual',
          resolution: 1
        }
      });
    });

    // Disconnection handling
    socket.on('disconnect', async (reason) => {
      await this.handleDisconnection(socket, reason);
    });

    socket.on('error', (error) => {
      this.logger.error('Socket error:', error, {
        userId: user.id,
        socketId: socket.id
      });
    });
  }

  /**
   * Handle socket disconnection
   */
  private async handleDisconnection(socket: AuthenticatedSocket, reason: string): Promise<void> {
    try {
      const { user } = socket;
      
      this.logger.info('WebSocket disconnection', {
        userId: user.id,
        socketId: socket.id,
        reason
      });

      // Remove from connection pool
      await this.connectionPool.removeConnection(socket.id);

      // Update presence manager
      await this.presenceManager.setUserOffline(socket.id, reason);

      // Unsubscribe from events
      await this.eventSubscriber.unsubscribe(socket.id);

      // Clean up auth session
      await this.authMiddleware.cleanupSession(socket);

      // Track disconnection activity
      await this.activityFeed.trackDashboardActivity(
        user.organizationId,
        user.id,
        `${user.firstName} ${user.lastName}`,
        user.role,
        'websocket',
        'view',
        { action: 'disconnected', reason }
      );

      this.emit('connection:closed', socket, reason);

    } catch (error) {
      this.logger.error('Error handling disconnection:', error);
    }
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 60000); // 1 minute

    this.metricsInterval = setInterval(() => {
      this.collectMetrics();
    }, 30000); // 30 seconds
  }

  /**
   * Perform health check on all services
   */
  private async performHealthCheck(): Promise<void> {
    const services = [
      { name: 'connection-pool', instance: this.connectionPool },
      { name: 'event-publisher', instance: this.eventPublisher },
      { name: 'event-subscriber', instance: this.eventSubscriber },
      { name: 'metrics-stream', instance: this.metricsStream },
      { name: 'activity-feed', instance: this.activityFeed },
      { name: 'presence-manager', instance: this.presenceManager }
    ];

    for (const service of services) {
      try {
        const health: ServiceHealth = {
          service: service.name,
          status: 'healthy',
          lastCheck: new Date(),
          metrics: service.instance.getMetrics?.() || null,
          errors: []
        };

        this.serviceHealth.set(service.name, health);

      } catch (error) {
        const health: ServiceHealth = {
          service: service.name,
          status: 'unhealthy',
          lastCheck: new Date(),
          errors: [error instanceof Error ? error.message : 'Unknown error']
        };

        this.serviceHealth.set(service.name, health);
        this.logger.warn(`Service ${service.name} health check failed:`, error);
      }
    }
  }

  /**
   * Collect aggregated metrics
   */
  private collectMetrics(): void {
    try {
      const connectionStats = this.connectionPool.getMetrics();
      const eventMetrics = this.eventPublisher.getMetrics();
      const streamingStats = this.metricsStream.getMetricStats();
      
      const metrics: RealTimeMetrics = {
        connections: {
          total: connectionStats.totalConnections,
          active: connectionStats.activeConnections,
          byOrganization: Object.fromEntries(connectionStats.connectionsPerOrganization)
        },
        events: {
          published: eventMetrics.totalPublished,
          delivered: 0, // Would come from subscriber
          queued: eventMetrics.queueSize,
          failed: 0 // Would be tracked separately
        },
        streaming: {
          metricsActive: streamingStats.activeStreams,
          bufferUtilization: streamingStats.bufferUtilization,
          updateFrequency: streamingStats.averageUpdateFrequency
        },
        presence: {
          onlineUsers: 0, // Would come from presence manager
          totalUsers: 0,
          collaborationReadiness: 0
        },
        performance: {
          memoryUsage: connectionStats.memoryUsage,
          cpuUsage: 0,
          responseTime: connectionStats.averageResponseTime,
          errorRate: connectionStats.errorRate
        }
      };

      this.emit('metrics:updated', metrics);

    } catch (error) {
      this.logger.error('Failed to collect metrics:', error);
    }
  }

  /**
   * Public API methods
   */
  getServiceHealth(): Record<string, ServiceHealth> {
    return Object.fromEntries(this.serviceHealth.entries());
  }

  async getOrganizationMetrics(organizationId: string): Promise<any> {
    const teamPresence = this.presenceManager.getTeamPresence(organizationId);
    const activityInsights = await this.activityFeed.getActivityInsights(organizationId);
    const realtimeMetrics = await this.metricsStream.getRealTimeMetrics(organizationId);

    return {
      presence: teamPresence,
      activity: activityInsights,
      metrics: realtimeMetrics,
      timestamp: new Date()
    };
  }

  async publishSystemAlert(
    organizationId: string,
    alertType: string,
    alertData: any,
    priority: 'low' | 'medium' | 'high' | 'critical' = 'high'
  ): Promise<void> {
    await this.eventPublisher.publishSystemAlert(
      organizationId,
      alertType,
      alertData,
      priority
    );
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    this.logger.info('Shutting down Real-time Service Manager...');

    // Clear intervals
    if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);
    if (this.metricsInterval) clearInterval(this.metricsInterval);

    // Shutdown services in order
    const shutdownPromises = [
      this.presenceManager?.shutdown(),
      this.activityFeed?.shutdown(),
      this.metricsStream?.shutdown(),
      this.eventSubscriber?.shutdown(),
      this.eventPublisher?.shutdown(),
      this.connectionPool?.shutdown(),
      this.roomManager?.shutdown()
    ].filter(Boolean);

    await Promise.allSettled(shutdownPromises);

    // Close Socket.io server
    if (this.io) {
      this.io.emit('server_shutdown', { 
        message: 'Server shutting down', 
        timestamp: new Date() 
      });
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      this.io.close();
    }

    // Clear data structures
    this.serviceHealth.clear();

    this.logger.info('Real-time Service Manager shutdown complete');
  }
}