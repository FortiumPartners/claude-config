/**
 * WebSocket Service
 * Task 4.5: Real-time metrics streaming via WebSocket connections
 * 
 * Handles WebSocket connections for real-time dashboard updates and notifications
 */

import WebSocket from 'ws';
import { IncomingMessage } from 'http';
import { DatabaseConnection } from '../database/connection';
import { McpServerService } from './mcp-server.service';
import { CompatibilityService } from './compatibility.service';
import * as winston from 'winston';
import * as jwt from 'jsonwebtoken';
import EventEmitter from 'events';

export interface WebSocketConnection {
  id: string;
  ws: WebSocket;
  organizationId: string;
  userId: string;
  subscriptions: Set<string>;
  metadata: {
    connectedAt: Date;
    lastActivity: Date;
    clientInfo?: any;
    ipAddress?: string;
  };
}

export interface WebSocketMessage {
  type: 'request' | 'response' | 'notification' | 'subscription';
  id?: string;
  method?: string;
  params?: any;
  result?: any;
  error?: any;
}

export interface SubscriptionFilter {
  event_types?: string[];
  organizations?: string[];
  users?: string[];
  timeframe?: string;
  frequency?: number;
}

export class WebSocketService extends EventEmitter {
  private connections: Map<string, WebSocketConnection> = new Map();
  private subscriptions: Map<string, Set<string>> = new Map(); // event -> connection IDs
  private mcpServerService: McpServerService;
  private compatibilityService: CompatibilityService;
  private heartbeatInterval: NodeJS.Timeout;

  constructor(
    private db: DatabaseConnection,
    private logger: winston.Logger,
    private jwtSecret: string
  ) {
    super();
    
    this.mcpServerService = new McpServerService(db, logger);
    this.compatibilityService = new CompatibilityService(db, logger);
    
    // Start heartbeat to clean up stale connections
    this.heartbeatInterval = setInterval(() => {
      this.cleanupStaleConnections();
    }, 30000); // Every 30 seconds
  }

  /**
   * Handle new WebSocket connection
   */
  async handleConnection(ws: WebSocket, request: IncomingMessage): Promise<void> {
    try {
      // Authenticate the connection
      const authResult = await this.authenticateConnection(request);
      if (!authResult.success) {
        ws.close(4001, 'Authentication failed');
        return;
      }

      const connectionId = this.generateConnectionId();
      const connection: WebSocketConnection = {
        id: connectionId,
        ws,
        organizationId: authResult.organizationId!,
        userId: authResult.userId!,
        subscriptions: new Set(),
        metadata: {
          connectedAt: new Date(),
          lastActivity: new Date(),
          clientInfo: authResult.clientInfo,
          ipAddress: request.socket.remoteAddress
        }
      };

      // Store connection
      this.connections.set(connectionId, connection);

      // Set up WebSocket event handlers
      this.setupWebSocketHandlers(connection);

      // Send welcome message
      this.sendMessage(connection, {
        type: 'notification',
        method: 'connection/established',
        params: {
          connection_id: connectionId,
          server_info: {
            name: 'fortium-metrics-websocket',
            version: '1.0.0',
            protocol: 'mcp-websocket'
          }
        }
      });

      this.logger.info('WebSocket connection established', {
        connection_id: connectionId,
        organization_id: connection.organizationId,
        user_id: connection.userId
      });

      this.emit('connection:established', connection);

    } catch (error) {
      this.logger.error('WebSocket connection error:', error);
      ws.close(4000, 'Connection setup failed');
    }
  }

  /**
   * Set up WebSocket event handlers
   */
  private setupWebSocketHandlers(connection: WebSocketConnection): void {
    const { ws } = connection;

    ws.on('message', async (data: Buffer) => {
      try {
        connection.metadata.lastActivity = new Date();
        
        const message = JSON.parse(data.toString()) as WebSocketMessage;
        await this.handleWebSocketMessage(connection, message);
        
      } catch (error) {
        this.logger.error('WebSocket message handling error:', error);
        this.sendError(connection, 'Invalid message format', 4002);
      }
    });

    ws.on('close', (code: number, reason: string) => {
      this.handleConnectionClose(connection, code, reason);
    });

    ws.on('error', (error: Error) => {
      this.logger.error('WebSocket error:', error, {
        connection_id: connection.id,
        organization_id: connection.organizationId
      });
    });

    ws.on('pong', () => {
      connection.metadata.lastActivity = new Date();
    });
  }

  /**
   * Handle WebSocket messages
   */
  private async handleWebSocketMessage(
    connection: WebSocketConnection,
    message: WebSocketMessage
  ): Promise<void> {
    try {
      switch (message.type) {
        case 'request':
          await this.handleMcpRequest(connection, message);
          break;
          
        case 'subscription':
          await this.handleSubscription(connection, message);
          break;
          
        default:
          this.sendError(connection, `Unknown message type: ${message.type}`, 4003);
      }
      
    } catch (error) {
      this.logger.error('Message handling error:', error);
      this.sendError(connection, 'Message processing failed', 4004);
    }
  }

  /**
   * Handle MCP requests via WebSocket
   */
  private async handleMcpRequest(
    connection: WebSocketConnection,
    message: WebSocketMessage
  ): Promise<void> {
    if (!message.method) {
      this.sendError(connection, 'Missing method in request', 4005);
      return;
    }

    try {
      // Create MCP request
      const mcpRequest = {
        jsonrpc: '2.0' as const,
        id: message.id,
        method: message.method,
        params: message.params
      };

      // Check if this is a legacy request
      const isLegacy = this.isLegacyRequest(mcpRequest);
      
      let response;
      if (isLegacy) {
        // Handle with compatibility layer
        response = await this.compatibilityService.handleLegacyRequest(
          mcpRequest,
          connection.organizationId,
          connection.userId
        );
      } else {
        // Handle with modern MCP server
        response = await this.mcpServerService.handleRequest(
          mcpRequest,
          connection.organizationId,
          connection.userId
        );
      }

      // Send response back via WebSocket
      this.sendMessage(connection, {
        type: 'response',
        id: message.id,
        result: response.result,
        error: response.error
      });

    } catch (error) {
      this.sendMessage(connection, {
        type: 'response',
        id: message.id,
        error: {
          code: -32603,
          message: 'Internal error',
          data: { error: error instanceof Error ? error.message : 'Unknown error' }
        }
      });
    }
  }

  /**
   * Handle subscription requests
   */
  private async handleSubscription(
    connection: WebSocketConnection,
    message: WebSocketMessage
  ): Promise<void> {
    const { method, params } = message;

    switch (method) {
      case 'subscribe':
        await this.handleSubscribe(connection, message, params);
        break;
        
      case 'unsubscribe':
        await this.handleUnsubscribe(connection, message, params);
        break;
        
      case 'list_subscriptions':
        await this.handleListSubscriptions(connection, message);
        break;
        
      default:
        this.sendError(connection, `Unknown subscription method: ${method}`, 4006);
    }
  }

  /**
   * Handle subscribe request
   */
  private async handleSubscribe(
    connection: WebSocketConnection,
    message: WebSocketMessage,
    params: any
  ): Promise<void> {
    const { event_types, filters } = params;

    if (!event_types || !Array.isArray(event_types)) {
      this.sendError(connection, 'event_types must be an array', 4007);
      return;
    }

    // Validate subscription permissions
    const hasPermission = await this.validateSubscriptionPermissions(
      connection,
      event_types,
      filters
    );

    if (!hasPermission) {
      this.sendError(connection, 'Insufficient permissions for subscription', 4008);
      return;
    }

    // Add subscriptions
    event_types.forEach((eventType: string) => {
      connection.subscriptions.add(eventType);
      
      if (!this.subscriptions.has(eventType)) {
        this.subscriptions.set(eventType, new Set());
      }
      this.subscriptions.get(eventType)!.add(connection.id);
    });

    // Send confirmation
    this.sendMessage(connection, {
      type: 'response',
      id: message.id,
      result: {
        subscribed: event_types,
        filters: filters || {},
        timestamp: new Date().toISOString()
      }
    });

    this.logger.info('WebSocket subscriptions added', {
      connection_id: connection.id,
      event_types,
      total_subscriptions: connection.subscriptions.size
    });
  }

  /**
   * Handle unsubscribe request
   */
  private async handleUnsubscribe(
    connection: WebSocketConnection,
    message: WebSocketMessage,
    params: any
  ): Promise<void> {
    const { event_types } = params;

    if (!event_types || !Array.isArray(event_types)) {
      this.sendError(connection, 'event_types must be an array', 4007);
      return;
    }

    // Remove subscriptions
    event_types.forEach((eventType: string) => {
      connection.subscriptions.delete(eventType);
      
      if (this.subscriptions.has(eventType)) {
        this.subscriptions.get(eventType)!.delete(connection.id);
        
        // Clean up empty subscription sets
        if (this.subscriptions.get(eventType)!.size === 0) {
          this.subscriptions.delete(eventType);
        }
      }
    });

    // Send confirmation
    this.sendMessage(connection, {
      type: 'response',
      id: message.id,
      result: {
        unsubscribed: event_types,
        remaining_subscriptions: Array.from(connection.subscriptions),
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Handle list subscriptions request
   */
  private async handleListSubscriptions(
    connection: WebSocketConnection,
    message: WebSocketMessage
  ): Promise<void> {
    this.sendMessage(connection, {
      type: 'response',
      id: message.id,
      result: {
        subscriptions: Array.from(connection.subscriptions),
        connection_id: connection.id,
        connected_at: connection.metadata.connectedAt,
        last_activity: connection.metadata.lastActivity
      }
    });
  }

  /**
   * Broadcast event to subscribed connections
   */
  async broadcastEvent(eventType: string, data: any, filters?: SubscriptionFilter): Promise<void> {
    const connectionIds = this.subscriptions.get(eventType);
    if (!connectionIds || connectionIds.size === 0) {
      return;
    }

    const message: WebSocketMessage = {
      type: 'notification',
      method: eventType,
      params: {
        ...data,
        timestamp: new Date().toISOString(),
        event_type: eventType
      }
    };

    let broadcastCount = 0;

    for (const connectionId of connectionIds) {
      const connection = this.connections.get(connectionId);
      if (!connection) {
        // Clean up stale connection ID
        connectionIds.delete(connectionId);
        continue;
      }

      // Apply filters
      if (filters && !this.matchesFilter(connection, filters)) {
        continue;
      }

      this.sendMessage(connection, message);
      broadcastCount++;
    }

    this.logger.debug('Event broadcasted', {
      event_type: eventType,
      connections_notified: broadcastCount,
      total_subscribers: connectionIds.size
    });
  }

  /**
   * Send message to specific connection
   */
  private sendMessage(connection: WebSocketConnection, message: WebSocketMessage): void {
    if (connection.ws.readyState === WebSocket.OPEN) {
      try {
        connection.ws.send(JSON.stringify(message));
      } catch (error) {
        this.logger.error('Failed to send WebSocket message:', error);
      }
    }
  }

  /**
   * Send error to specific connection
   */
  private sendError(connection: WebSocketConnection, message: string, code: number): void {
    this.sendMessage(connection, {
      type: 'response',
      error: {
        code,
        message
      }
    });
  }

  /**
   * Handle connection close
   */
  private handleConnectionClose(connection: WebSocketConnection, code: number, reason: string): void {
    // Remove from connections map
    this.connections.delete(connection.id);

    // Remove from all subscriptions
    connection.subscriptions.forEach(eventType => {
      const connectionIds = this.subscriptions.get(eventType);
      if (connectionIds) {
        connectionIds.delete(connection.id);
        
        if (connectionIds.size === 0) {
          this.subscriptions.delete(eventType);
        }
      }
    });

    this.logger.info('WebSocket connection closed', {
      connection_id: connection.id,
      code,
      reason,
      duration_ms: Date.now() - connection.metadata.connectedAt.getTime()
    });

    this.emit('connection:closed', connection, code, reason);
  }

  /**
   * Authenticate WebSocket connection
   */
  private async authenticateConnection(request: IncomingMessage): Promise<{
    success: boolean;
    organizationId?: string;
    userId?: string;
    clientInfo?: any;
  }> {
    try {
      // Get token from query params or headers
      const url = new URL(request.url!, `http://${request.headers.host}`);
      const token = url.searchParams.get('token') || 
                   request.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return { success: false };
      }

      // Verify JWT token
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      
      return {
        success: true,
        organizationId: decoded.organization_id,
        userId: decoded.user_id,
        clientInfo: decoded.client_info
      };

    } catch (error) {
      this.logger.warn('WebSocket authentication failed:', error);
      return { success: false };
    }
  }

  /**
   * Validate subscription permissions
   */
  private async validateSubscriptionPermissions(
    connection: WebSocketConnection,
    eventTypes: string[],
    filters: any
  ): Promise<boolean> {
    // Basic validation - in production, implement proper RBAC
    
    // Check if user can subscribe to organization events
    for (const eventType of eventTypes) {
      if (eventType.startsWith('admin/') && !await this.isAdminUser(connection.userId)) {
        return false;
      }
      
      if (eventType.startsWith('system/') && !await this.isSystemUser(connection.userId)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if user is admin
   */
  private async isAdminUser(userId: string): Promise<boolean> {
    try {
      const query = 'SELECT role FROM users WHERE id = $1';
      const result = await this.db.query(query, [userId]);
      return result.rows[0]?.role === 'admin';
    } catch {
      return false;
    }
  }

  /**
   * Check if user is system user
   */
  private async isSystemUser(userId: string): Promise<boolean> {
    try {
      const query = 'SELECT role FROM users WHERE id = $1';
      const result = await this.db.query(query, [userId]);
      return ['admin', 'system'].includes(result.rows[0]?.role);
    } catch {
      return false;
    }
  }

  /**
   * Check if connection matches filter
   */
  private matchesFilter(connection: WebSocketConnection, filter: SubscriptionFilter): boolean {
    if (filter.organizations && !filter.organizations.includes(connection.organizationId)) {
      return false;
    }
    
    if (filter.users && !filter.users.includes(connection.userId)) {
      return false;
    }

    return true;
  }

  /**
   * Check if request is legacy format
   */
  private isLegacyRequest(request: any): boolean {
    // Simple heuristic - in production, implement more sophisticated detection
    return !request.jsonrpc || request.jsonrpc !== '2.0';
  }

  /**
   * Generate unique connection ID
   */
  private generateConnectionId(): string {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clean up stale connections
   */
  private cleanupStaleConnections(): void {
    const now = Date.now();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes

    for (const [connectionId, connection] of this.connections) {
      const lastActivity = connection.metadata.lastActivity.getTime();
      
      if (now - lastActivity > staleThreshold) {
        // Send ping to check if connection is still alive
        if (connection.ws.readyState === WebSocket.OPEN) {
          connection.ws.ping();
          
          // If no pong received in 30 seconds, connection is stale
          setTimeout(() => {
            if (now - connection.metadata.lastActivity.getTime() > staleThreshold) {
              connection.ws.terminate();
            }
          }, 30000);
        } else {
          // Connection is already closed, clean up
          this.handleConnectionClose(connection, 1006, 'Connection stale');
        }
      }
    }
  }

  /**
   * Get connection statistics
   */
  getConnectionStats(): any {
    const stats = {
      total_connections: this.connections.size,
      total_subscriptions: this.subscriptions.size,
      connections_by_organization: new Map<string, number>(),
      subscription_stats: new Map<string, number>()
    };

    // Count connections by organization
    for (const connection of this.connections.values()) {
      const orgCount = stats.connections_by_organization.get(connection.organizationId) || 0;
      stats.connections_by_organization.set(connection.organizationId, orgCount + 1);
    }

    // Count subscriptions by event type
    for (const [eventType, connectionIds] of this.subscriptions) {
      stats.subscription_stats.set(eventType, connectionIds.size);
    }

    return {
      ...stats,
      connections_by_organization: Object.fromEntries(stats.connections_by_organization),
      subscription_stats: Object.fromEntries(stats.subscription_stats)
    };
  }

  /**
   * Close all connections and cleanup
   */
  async shutdown(): Promise<void> {
    clearInterval(this.heartbeatInterval);

    // Close all connections
    for (const connection of this.connections.values()) {
      connection.ws.close(1001, 'Server shutdown');
    }

    // Clear all data structures
    this.connections.clear();
    this.subscriptions.clear();

    this.logger.info('WebSocket service shutdown complete');
  }
}