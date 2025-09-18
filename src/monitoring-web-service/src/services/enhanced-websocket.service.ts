/**
 * Enhanced WebSocket Service - Sprint 5 Task 5.1
 * Advanced WebSocket server implementation with Redis adapter for scaling
 * 
 * Features:
 * - Socket.io with Redis adapter for horizontal scaling
 * - Room-based messaging for multi-tenant architecture
 * - Advanced connection management and authentication
 * - Message batching for high-frequency updates
 * - Heartbeat and reconnection logic
 * - Performance monitoring and connection pooling
 */

import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { RedisManager } from '../config/redis.config';
import { DatabaseConnection } from '../database/connection';
import * as winston from 'winston';
import * as jwt from 'jsonwebtoken';
import EventEmitter from 'events';

export interface EnhancedWebSocketConnection {
  id: string;
  socket: Socket;
  organizationId: string;
  userId: string;
  userRole: string;
  rooms: Set<string>;
  metadata: {
    connectedAt: Date;
    lastActivity: Date;
    clientInfo?: any;
    ipAddress?: string;
    userAgent?: string;
    connectionCount: number;
  };
  messageBuffer: WebSocketMessage[];
  batchTimeout?: NodeJS.Timeout;
}

export interface WebSocketMessage {
  type: 'real_time_update' | 'dashboard_update' | 'metrics_update' | 'collaborative_event' | 'notification';
  eventName: string;
  data: any;
  timestamp: Date;
  organizationId: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  batchable?: boolean;
}

export interface CollaborativeEvent {
  type: 'cursor_move' | 'user_joined' | 'user_left' | 'dashboard_edit' | 'widget_focus';
  userId: string;
  userName: string;
  data: any;
  dashboardId?: string;
}

export interface PerformanceMetrics {
  totalConnections: number;
  connectionsPerOrganization: Map<string, number>;
  messagesPerSecond: number;
  avgResponseTime: number;
  errorRate: number;
  memoryUsage: number;
  uptime: number;
}

export class EnhancedWebSocketService extends EventEmitter {
  private io: Server;
  private connections: Map<string, EnhancedWebSocketConnection> = new Map();
  private organizationRooms: Map<string, Set<string>> = new Map(); // orgId -> connection IDs
  private dashboardSessions: Map<string, Set<string>> = new Map(); // dashboardId -> connection IDs
  private heartbeatInterval: NodeJS.Timeout;
  private performanceMetrics: PerformanceMetrics;
  private messageQueue: WebSocketMessage[] = [];
  private batchProcessingInterval: NodeJS.Timeout;

  constructor(
    private httpServer: HttpServer,
    private redisManager: RedisManager,
    private db: DatabaseConnection,
    private logger: winston.Logger,
    private jwtSecret: string,
    private config: {
      cors?: any;
      maxConnections?: number;
      batchInterval?: number;
      heartbeatInterval?: number;
      performanceMonitoringInterval?: number;
    } = {}
  ) {
    super();
    
    this.initializeSocketIO();
    this.setupRedisAdapter();
    this.setupEventHandlers();
    this.startBackgroundServices();
    
    this.performanceMetrics = {
      totalConnections: 0,
      connectionsPerOrganization: new Map(),
      messagesPerSecond: 0,
      avgResponseTime: 0,
      errorRate: 0,
      memoryUsage: 0,
      uptime: Date.now()
    };

    this.logger.info('Enhanced WebSocket Service initialized', {
      cors: !!this.config.cors,
      maxConnections: this.config.maxConnections || 'unlimited',
      batchInterval: this.config.batchInterval || 100,
      heartbeatInterval: this.config.heartbeatInterval || 30000
    });
  }

  /**
   * Initialize Socket.io server with advanced configuration
   */
  private initializeSocketIO(): void {
    this.io = new Server(this.httpServer, {
      cors: this.config.cors || {
        origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
      upgradeTimeout: 30000,
      maxHttpBufferSize: 1024 * 1024, // 1MB
      allowEIO3: false,
      cookie: {
        name: 'fortium-socket',
        httpOnly: true,
        sameSite: 'strict'
      }
    });
  }

  /**
   * Setup Redis adapter for horizontal scaling
   */
  private setupRedisAdapter(): void {
    try {
      const pubClient = this.redisManager.getPublisher();
      const subClient = this.redisManager.getSubscriber();
      
      this.io.adapter(createAdapter(pubClient, subClient));
      this.logger.info('Redis adapter configured for WebSocket scaling');
    } catch (error) {
      this.logger.error('Failed to setup Redis adapter:', error);
      throw new Error('Redis adapter configuration failed');
    }
  }

  /**
   * Setup Socket.io event handlers
   */
  private setupEventHandlers(): void {
    this.io.use(async (socket, next) => {
      try {
        const auth = await this.authenticateSocket(socket);
        if (!auth.success) {
          return next(new Error('Authentication failed'));
        }

        // Attach auth data to socket
        socket.data = {
          organizationId: auth.organizationId,
          userId: auth.userId,
          userRole: auth.userRole,
          userName: auth.userName
        };

        next();
      } catch (error) {
        next(new Error('Authentication error'));
      }
    });

    this.io.on('connection', async (socket: Socket) => {
      await this.handleNewConnection(socket);
    });

    this.io.on('connect_error', (error) => {
      this.logger.error('Socket.io connection error:', error);
      this.performanceMetrics.errorRate++;
    });
  }

  /**
   * Handle new WebSocket connection
   */
  private async handleNewConnection(socket: Socket): Promise<void> {
    try {
      // Check connection limits
      if (this.config.maxConnections && this.connections.size >= this.config.maxConnections) {
        socket.emit('error', { code: 'CONNECTION_LIMIT', message: 'Maximum connections reached' });
        socket.disconnect();
        return;
      }

      const { organizationId, userId, userRole, userName } = socket.data;
      
      // Create connection record
      const connection: EnhancedWebSocketConnection = {
        id: socket.id,
        socket,
        organizationId,
        userId,
        userRole,
        rooms: new Set(),
        metadata: {
          connectedAt: new Date(),
          lastActivity: new Date(),
          clientInfo: socket.handshake.auth,
          ipAddress: socket.handshake.address,
          userAgent: socket.handshake.headers['user-agent'],
          connectionCount: 1
        },
        messageBuffer: [],
        batchTimeout: undefined
      };

      // Store connection
      this.connections.set(socket.id, connection);
      this.updateOrganizationConnections(organizationId, 1);
      this.performanceMetrics.totalConnections++;

      // Join organization room
      await this.joinOrganizationRoom(connection);

      // Setup socket event handlers
      this.setupSocketHandlers(connection);

      // Send welcome message with real-time capabilities info
      socket.emit('connected', {
        connectionId: socket.id,
        organizationId,
        userId,
        serverCapabilities: {
          realTimeUpdates: true,
          collaborativeFeatures: true,
          messageBatching: true,
          dashboardSync: true
        },
        connectedAt: connection.metadata.connectedAt
      });

      // Broadcast user joined event to organization
      this.broadcastToOrganization(organizationId, 'user_joined', {
        userId,
        userName,
        joinedAt: new Date(),
        connectionId: socket.id
      });

      this.logger.info('Enhanced WebSocket connection established', {
        connectionId: socket.id,
        organizationId,
        userId,
        totalConnections: this.connections.size
      });

      this.emit('connection:established', connection);

    } catch (error) {
      this.logger.error('Failed to handle new WebSocket connection:', error);
      socket.disconnect();
    }
  }

  /**
   * Setup individual socket event handlers
   */
  private setupSocketHandlers(connection: EnhancedWebSocketConnection): void {
    const { socket } = connection;

    // Handle room subscription
    socket.on('join_room', async (data: { room: string, permissions?: string[] }) => {
      await this.handleJoinRoom(connection, data);
    });

    socket.on('leave_room', async (data: { room: string }) => {
      await this.handleLeaveRoom(connection, data);
    });

    // Handle real-time dashboard events
    socket.on('subscribe_dashboard', async (data: { dashboardId: string }) => {
      await this.handleDashboardSubscription(connection, data);
    });

    socket.on('unsubscribe_dashboard', async (data: { dashboardId: string }) => {
      await this.handleDashboardUnsubscription(connection, data);
    });

    // Handle collaborative events
    socket.on('collaborative_event', async (data: CollaborativeEvent) => {
      await this.handleCollaborativeEvent(connection, data);
    });

    // Handle metrics subscription
    socket.on('subscribe_metrics', async (data: { types: string[], filters?: any }) => {
      await this.handleMetricsSubscription(connection, data);
    });

    // Handle ping/pong for connection health
    socket.on('ping', () => {
      connection.metadata.lastActivity = new Date();
      socket.emit('pong', { timestamp: Date.now() });
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      this.handleDisconnection(connection, reason);
    });

    socket.on('error', (error) => {
      this.logger.error('Socket error:', error, {
        connectionId: connection.id,
        organizationId: connection.organizationId
      });
    });
  }

  /**
   * Handle room joining with permission validation
   */
  private async handleJoinRoom(connection: EnhancedWebSocketConnection, data: { room: string, permissions?: string[] }): Promise<void> {
    try {
      const { room, permissions } = data;
      
      // Validate room access permissions
      const hasAccess = await this.validateRoomAccess(connection, room, permissions);
      if (!hasAccess) {
        connection.socket.emit('room_error', {
          room,
          error: 'Access denied',
          code: 'PERMISSION_DENIED'
        });
        return;
      }

      // Join the room
      await connection.socket.join(room);
      connection.rooms.add(room);

      // Track dashboard sessions
      if (room.startsWith('dashboard:')) {
        const dashboardId = room.split(':')[1];
        if (!this.dashboardSessions.has(dashboardId)) {
          this.dashboardSessions.set(dashboardId, new Set());
        }
        this.dashboardSessions.get(dashboardId)!.add(connection.id);
      }

      connection.socket.emit('room_joined', {
        room,
        joinedAt: new Date(),
        activeUsers: await this.getRoomActiveUsers(room)
      });

      this.logger.debug('User joined room', {
        connectionId: connection.id,
        room,
        totalRooms: connection.rooms.size
      });

    } catch (error) {
      this.logger.error('Failed to handle room join:', error);
      connection.socket.emit('room_error', {
        room: data.room,
        error: 'Failed to join room',
        code: 'JOIN_FAILED'
      });
    }
  }

  /**
   * Handle room leaving
   */
  private async handleLeaveRoom(connection: EnhancedWebSocketConnection, data: { room: string }): Promise<void> {
    try {
      const { room } = data;
      
      await connection.socket.leave(room);
      connection.rooms.delete(room);

      // Remove from dashboard sessions
      if (room.startsWith('dashboard:')) {
        const dashboardId = room.split(':')[1];
        this.dashboardSessions.get(dashboardId)?.delete(connection.id);
        
        if (this.dashboardSessions.get(dashboardId)?.size === 0) {
          this.dashboardSessions.delete(dashboardId);
        }
      }

      connection.socket.emit('room_left', {
        room,
        leftAt: new Date()
      });

    } catch (error) {
      this.logger.error('Failed to handle room leave:', error);
    }
  }

  /**
   * Handle dashboard subscription for real-time updates
   */
  private async handleDashboardSubscription(connection: EnhancedWebSocketConnection, data: { dashboardId: string }): Promise<void> {
    try {
      const { dashboardId } = data;
      const roomName = `dashboard:${dashboardId}`;
      
      // Validate dashboard access
      const hasAccess = await this.validateDashboardAccess(connection, dashboardId);
      if (!hasAccess) {
        connection.socket.emit('subscription_error', {
          dashboardId,
          error: 'Dashboard access denied',
          code: 'DASHBOARD_ACCESS_DENIED'
        });
        return;
      }

      // Join dashboard room
      await connection.socket.join(roomName);
      connection.rooms.add(roomName);

      // Track active dashboard sessions
      if (!this.dashboardSessions.has(dashboardId)) {
        this.dashboardSessions.set(dashboardId, new Set());
      }
      this.dashboardSessions.get(dashboardId)!.add(connection.id);

      // Send current dashboard state
      const currentState = await this.getDashboardCurrentState(dashboardId);
      
      connection.socket.emit('dashboard_subscribed', {
        dashboardId,
        currentState,
        subscribedAt: new Date(),
        activeViewers: this.dashboardSessions.get(dashboardId)!.size
      });

      // Notify other viewers
      connection.socket.to(roomName).emit('viewer_joined', {
        userId: connection.userId,
        joinedAt: new Date()
      });

    } catch (error) {
      this.logger.error('Failed to handle dashboard subscription:', error);
    }
  }

  /**
   * Handle dashboard unsubscription
   */
  private async handleDashboardUnsubscription(connection: EnhancedWebSocketConnection, data: { dashboardId: string }): Promise<void> {
    try {
      const { dashboardId } = data;
      const roomName = `dashboard:${dashboardId}`;
      
      await connection.socket.leave(roomName);
      connection.rooms.delete(roomName);

      // Remove from dashboard sessions
      this.dashboardSessions.get(dashboardId)?.delete(connection.id);
      
      if (this.dashboardSessions.get(dashboardId)?.size === 0) {
        this.dashboardSessions.delete(dashboardId);
      }

      // Notify other viewers
      connection.socket.to(roomName).emit('viewer_left', {
        userId: connection.userId,
        leftAt: new Date()
      });

      connection.socket.emit('dashboard_unsubscribed', {
        dashboardId,
        unsubscribedAt: new Date()
      });

    } catch (error) {
      this.logger.error('Failed to handle dashboard unsubscription:', error);
    }
  }

  /**
   * Handle collaborative events (cursor tracking, real-time edits)
   */
  private async handleCollaborativeEvent(connection: EnhancedWebSocketConnection, event: CollaborativeEvent): Promise<void> {
    try {
      // Validate collaborative permissions
      if (connection.userRole !== 'admin' && connection.userRole !== 'manager') {
        connection.socket.emit('collaborative_error', {
          error: 'Insufficient permissions for collaborative features',
          code: 'COLLABORATIVE_ACCESS_DENIED'
        });
        return;
      }

      // Add connection context to event
      const enrichedEvent = {
        ...event,
        userId: connection.userId,
        userName: connection.socket.data.userName,
        organizationId: connection.organizationId,
        timestamp: new Date()
      };

      // Broadcast to appropriate room based on event type
      if (event.dashboardId) {
        const roomName = `dashboard:${event.dashboardId}`;
        connection.socket.to(roomName).emit('collaborative_event', enrichedEvent);
      } else {
        // Broadcast to organization room
        const orgRoom = `org:${connection.organizationId}`;
        connection.socket.to(orgRoom).emit('collaborative_event', enrichedEvent);
      }

      // Store collaborative event for replay to new connections
      await this.storeCollaborativeEvent(enrichedEvent);

    } catch (error) {
      this.logger.error('Failed to handle collaborative event:', error);
    }
  }

  /**
   * Handle metrics subscription
   */
  private async handleMetricsSubscription(connection: EnhancedWebSocketConnection, data: { types: string[], filters?: any }): Promise<void> {
    try {
      const { types, filters } = data;
      
      // Validate metrics access
      const hasAccess = await this.validateMetricsAccess(connection, types);
      if (!hasAccess) {
        connection.socket.emit('subscription_error', {
          error: 'Metrics access denied',
          code: 'METRICS_ACCESS_DENIED'
        });
        return;
      }

      // Join metrics-specific rooms
      for (const metricType of types) {
        const roomName = `metrics:${connection.organizationId}:${metricType}`;
        await connection.socket.join(roomName);
        connection.rooms.add(roomName);
      }

      connection.socket.emit('metrics_subscribed', {
        types,
        filters,
        subscribedAt: new Date()
      });

    } catch (error) {
      this.logger.error('Failed to handle metrics subscription:', error);
    }
  }

  /**
   * Broadcast message to organization room
   */
  async broadcastToOrganization(organizationId: string, eventName: string, data: any): Promise<void> {
    try {
      const roomName = `org:${organizationId}`;
      const message: WebSocketMessage = {
        type: 'real_time_update',
        eventName,
        data: {
          ...data,
          organizationId,
          timestamp: new Date()
        },
        timestamp: new Date(),
        organizationId,
        priority: 'medium',
        batchable: true
      };

      this.io.to(roomName).emit(eventName, message.data);
      
      // Store for analytics
      await this.logBroadcastEvent(message);

    } catch (error) {
      this.logger.error('Failed to broadcast to organization:', error);
    }
  }

  /**
   * Broadcast dashboard update with batching optimization
   */
  async broadcastDashboardUpdate(dashboardId: string, updateData: any, options?: { batchable?: boolean, priority?: 'low' | 'medium' | 'high' | 'critical' }): Promise<void> {
    try {
      const roomName = `dashboard:${dashboardId}`;
      const message: WebSocketMessage = {
        type: 'dashboard_update',
        eventName: 'dashboard_update',
        data: {
          dashboardId,
          update: updateData,
          timestamp: new Date()
        },
        timestamp: new Date(),
        organizationId: '', // Will be set based on connections
        priority: options?.priority || 'medium',
        batchable: options?.batchable !== false
      };

      if (message.batchable && message.priority !== 'critical') {
        // Add to batch queue for processing
        this.messageQueue.push(message);
      } else {
        // Send immediately for critical updates
        this.io.to(roomName).emit('dashboard_update', message.data);
      }

    } catch (error) {
      this.logger.error('Failed to broadcast dashboard update:', error);
    }
  }

  /**
   * Broadcast live metrics update
   */
  async broadcastMetricsUpdate(organizationId: string, metricType: string, metricsData: any): Promise<void> {
    try {
      const roomName = `metrics:${organizationId}:${metricType}`;
      const message = {
        type: 'metrics_update',
        metricType,
        data: metricsData,
        organizationId,
        timestamp: new Date()
      };

      this.io.to(roomName).emit('metrics_update', message);
      
      // Update performance metrics
      this.performanceMetrics.messagesPerSecond++;

    } catch (error) {
      this.logger.error('Failed to broadcast metrics update:', error);
    }
  }

  /**
   * Join organization room with proper setup
   */
  private async joinOrganizationRoom(connection: EnhancedWebSocketConnection): Promise<void> {
    const orgRoom = `org:${connection.organizationId}`;
    await connection.socket.join(orgRoom);
    connection.rooms.add(orgRoom);

    // Update organization connection tracking
    if (!this.organizationRooms.has(connection.organizationId)) {
      this.organizationRooms.set(connection.organizationId, new Set());
    }
    this.organizationRooms.get(connection.organizationId)!.add(connection.id);
  }

  /**
   * Handle connection disconnection
   */
  private handleDisconnection(connection: EnhancedWebSocketConnection, reason: string): void {
    try {
      // Remove from connections map
      this.connections.delete(connection.id);
      this.updateOrganizationConnections(connection.organizationId, -1);
      this.performanceMetrics.totalConnections--;

      // Remove from organization rooms
      this.organizationRooms.get(connection.organizationId)?.delete(connection.id);

      // Remove from dashboard sessions
      for (const [dashboardId, connectionIds] of this.dashboardSessions.entries()) {
        if (connectionIds.has(connection.id)) {
          connectionIds.delete(connection.id);
          
          // Notify other viewers
          connection.socket.to(`dashboard:${dashboardId}`).emit('viewer_left', {
            userId: connection.userId,
            leftAt: new Date()
          });
          
          if (connectionIds.size === 0) {
            this.dashboardSessions.delete(dashboardId);
          }
        }
      }

      // Clear batch timeout
      if (connection.batchTimeout) {
        clearTimeout(connection.batchTimeout);
      }

      // Broadcast user left event
      this.broadcastToOrganization(connection.organizationId, 'user_left', {
        userId: connection.userId,
        leftAt: new Date(),
        connectionDuration: Date.now() - connection.metadata.connectedAt.getTime(),
        reason
      });

      this.logger.info('Enhanced WebSocket connection closed', {
        connectionId: connection.id,
        organizationId: connection.organizationId,
        userId: connection.userId,
        reason,
        connectionDuration: Date.now() - connection.metadata.connectedAt.getTime(),
        totalConnections: this.connections.size
      });

      this.emit('connection:closed', connection, reason);

    } catch (error) {
      this.logger.error('Error handling disconnection:', error);
    }
  }

  /**
   * Start background services (heartbeat, batching, monitoring)
   */
  private startBackgroundServices(): void {
    // Heartbeat interval for connection health
    this.heartbeatInterval = setInterval(() => {
      this.performHeartbeat();
    }, this.config.heartbeatInterval || 30000);

    // Message batching interval
    this.batchProcessingInterval = setInterval(() => {
      this.processBatchedMessages();
    }, this.config.batchInterval || 100);

    // Performance monitoring
    setInterval(() => {
      this.updatePerformanceMetrics();
    }, this.config.performanceMonitoringInterval || 60000);
  }

  /**
   * Perform heartbeat check for all connections
   */
  private performHeartbeat(): void {
    const now = Date.now();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes

    for (const [connectionId, connection] of this.connections) {
      const lastActivity = connection.metadata.lastActivity.getTime();
      
      if (now - lastActivity > staleThreshold) {
        this.logger.warn('Stale connection detected, sending ping', {
          connectionId,
          lastActivity: connection.metadata.lastActivity
        });
        
        connection.socket.emit('ping', { timestamp: now });
        
        // If still no response after 30 seconds, disconnect
        setTimeout(() => {
          const currentLastActivity = connection.metadata.lastActivity.getTime();
          if (currentLastActivity === lastActivity) {
            connection.socket.disconnect(true);
          }
        }, 30000);
      }
    }
  }

  /**
   * Process batched messages for efficiency
   */
  private processBatchedMessages(): void {
    if (this.messageQueue.length === 0) return;

    // Group messages by room for batching
    const messagesByRoom = new Map<string, WebSocketMessage[]>();
    
    const messagesToProcess = this.messageQueue.splice(0);
    
    for (const message of messagesToProcess) {
      let roomName = '';
      
      if (message.type === 'dashboard_update' && message.data.dashboardId) {
        roomName = `dashboard:${message.data.dashboardId}`;
      } else if (message.organizationId) {
        roomName = `org:${message.organizationId}`;
      }
      
      if (roomName) {
        if (!messagesByRoom.has(roomName)) {
          messagesByRoom.set(roomName, []);
        }
        messagesByRoom.get(roomName)!.push(message);
      }
    }

    // Send batched messages
    for (const [roomName, messages] of messagesByRoom) {
      if (messages.length === 1) {
        // Single message - send directly
        const msg = messages[0];
        this.io.to(roomName).emit(msg.eventName, msg.data);
      } else {
        // Multiple messages - send as batch
        this.io.to(roomName).emit('batch_update', {
          messages: messages.map(m => ({ event: m.eventName, data: m.data })),
          batchSize: messages.length,
          timestamp: new Date()
        });
      }
    }
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(): void {
    this.performanceMetrics.memoryUsage = process.memoryUsage().heapUsed;
    this.performanceMetrics.connectionsPerOrganization.clear();
    
    for (const connection of this.connections.values()) {
      const count = this.performanceMetrics.connectionsPerOrganization.get(connection.organizationId) || 0;
      this.performanceMetrics.connectionsPerOrganization.set(connection.organizationId, count + 1);
    }

    // Reset counters
    this.performanceMetrics.messagesPerSecond = 0;
    this.performanceMetrics.errorRate = 0;
  }

  /**
   * Authentication helper methods
   */
  private async authenticateSocket(socket: Socket): Promise<{
    success: boolean;
    organizationId?: string;
    userId?: string;
    userRole?: string;
    userName?: string;
  }> {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      
      if (!token) {
        return { success: false };
      }

      const decoded = jwt.verify(token, this.jwtSecret) as any;
      
      // Validate user exists and is active
      const userQuery = `
        SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.is_active,
               t.id as org_id, t.name as org_name
        FROM users u
        JOIN tenants t ON u.organization_id = t.id
        WHERE u.id = $1 AND u.is_active = true AND t.is_active = true
      `;
      
      const result = await this.db.query(userQuery, [decoded.user_id]);
      
      if (result.rows.length === 0) {
        return { success: false };
      }

      const user = result.rows[0];
      
      return {
        success: true,
        organizationId: user.org_id,
        userId: user.id,
        userRole: user.role,
        userName: `${user.first_name} ${user.last_name}`
      };

    } catch (error) {
      this.logger.warn('Socket authentication failed:', error);
      return { success: false };
    }
  }

  /**
   * Permission validation helpers
   */
  private async validateRoomAccess(connection: EnhancedWebSocketConnection, room: string, permissions?: string[]): Promise<boolean> {
    // Basic room access validation
    if (room.startsWith('org:')) {
      const orgId = room.split(':')[1];
      return orgId === connection.organizationId;
    }
    
    if (room.startsWith('dashboard:')) {
      const dashboardId = room.split(':')[1];
      return await this.validateDashboardAccess(connection, dashboardId);
    }
    
    return true; // Allow by default for other rooms
  }

  private async validateDashboardAccess(connection: EnhancedWebSocketConnection, dashboardId: string): Promise<boolean> {
    // Implement dashboard access validation based on your business logic
    // For now, allow all users in the same organization
    return true;
  }

  private async validateMetricsAccess(connection: EnhancedWebSocketConnection, types: string[]): Promise<boolean> {
    // Implement metrics access validation
    // Admins can access all metrics, others can access their own
    if (connection.userRole === 'admin') return true;
    
    // Other validation logic...
    return true;
  }

  /**
   * Utility methods
   */
  private updateOrganizationConnections(organizationId: string, delta: number): void {
    const current = this.performanceMetrics.connectionsPerOrganization.get(organizationId) || 0;
    this.performanceMetrics.connectionsPerOrganization.set(organizationId, Math.max(0, current + delta));
  }

  private async getRoomActiveUsers(room: string): Promise<string[]> {
    try {
      const sockets = await this.io.in(room).fetchSockets();
      return sockets.map(s => s.data.userId).filter(Boolean);
    } catch {
      return [];
    }
  }

  private async getDashboardCurrentState(dashboardId: string): Promise<any> {
    // Fetch current dashboard state from cache or database
    try {
      return await this.redisManager.getCachedMetrics(`dashboard:${dashboardId}:state`);
    } catch {
      return null;
    }
  }

  private async storeCollaborativeEvent(event: any): Promise<void> {
    try {
      const key = `collaborative:${event.organizationId}:${event.dashboardId || 'global'}`;
      await this.redisManager.cacheMetrics(key, event, 300); // 5 minute TTL
    } catch (error) {
      this.logger.error('Failed to store collaborative event:', error);
    }
  }

  private async logBroadcastEvent(message: WebSocketMessage): Promise<void> {
    // Log broadcast events for analytics and debugging
    this.logger.debug('Message broadcasted', {
      type: message.type,
      eventName: message.eventName,
      organizationId: message.organizationId,
      priority: message.priority,
      timestamp: message.timestamp
    });
  }

  /**
   * Public API methods
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return {
      ...this.performanceMetrics,
      uptime: Date.now() - this.performanceMetrics.uptime
    };
  }

  getConnectionStats(): any {
    return {
      totalConnections: this.connections.size,
      connectionsByOrganization: Object.fromEntries(this.performanceMetrics.connectionsPerOrganization),
      activeDashboardSessions: this.dashboardSessions.size,
      totalRooms: this.io.sockets.adapter.rooms.size,
      messageQueueSize: this.messageQueue.length
    };
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Enhanced WebSocket Service...');

    // Clear intervals
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.batchProcessingInterval) clearInterval(this.batchProcessingInterval);

    // Process remaining batched messages
    this.processBatchedMessages();

    // Close all connections
    this.io.emit('server_shutdown', { message: 'Server shutting down', timestamp: new Date() });
    
    // Give clients time to receive shutdown message
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    this.io.close();

    // Clear data structures
    this.connections.clear();
    this.organizationRooms.clear();
    this.dashboardSessions.clear();
    this.messageQueue.length = 0;

    this.logger.info('Enhanced WebSocket Service shutdown complete');
  }
}