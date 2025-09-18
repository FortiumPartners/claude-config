/**
 * Instrumented WebSocket Service
 * Task 2.3.2: Metrics Collection & Processing - WebSocket Message Handling (Part of 3h)
 * 
 * Comprehensive OpenTelemetry instrumentation for WebSocket operations including:
 * - Real-time metrics streaming via WebSocket connections
 * - Connection lifecycle management
 * - Message processing and subscription handling
 * - Multi-tenant WebSocket isolation
 */

import WebSocket from 'ws';
import { IncomingMessage } from 'http';
import { DatabaseConnection } from '../database/connection';
import { McpServerService } from './mcp-server.service';
import { CompatibilityService } from './compatibility.service';
import * as winston from 'winston';
import * as jwt from 'jsonwebtoken';
import EventEmitter from 'events';
import { 
  BusinessInstrumentation, 
  BusinessContext, 
  BusinessAttributes,
  OperationType,
  InstrumentMethod,
  getBusinessInstrumentation 
} from '../tracing/business-instrumentation';
import * as api from '@opentelemetry/api';

// Re-export interfaces from original service
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

/**
 * Instrumented WebSocket Service with comprehensive OpenTelemetry tracing
 */
export class InstrumentedWebSocketService extends EventEmitter {
  private connections: Map<string, WebSocketConnection> = new Map();
  private subscriptions: Map<string, Set<string>> = new Map(); // event -> connection IDs
  private mcpServerService: McpServerService;
  private compatibilityService: CompatibilityService;
  private heartbeatInterval: NodeJS.Timeout;
  private instrumentation: BusinessInstrumentation;

  constructor(
    private db: DatabaseConnection,
    private logger: winston.Logger,
    private jwtSecret: string
  ) {
    super();
    
    this.mcpServerService = new McpServerService(db, logger);
    this.compatibilityService = new CompatibilityService(db, logger);
    this.instrumentation = getBusinessInstrumentation();
    
    // Start heartbeat to clean up stale connections
    this.heartbeatInterval = setInterval(() => {
      this.instrumentedCleanupStaleConnections().catch(error => {
        this.logger.error('Failed to cleanup stale connections', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      });
    }, 30000); // Every 30 seconds
  }

  /**
   * Handle new WebSocket connection with comprehensive instrumentation
   */
  async handleConnection(ws: WebSocket, request: IncomingMessage): Promise<void> {
    const context: BusinessContext = {
      requestId: this.generateConnectionId()
    };

    return this.instrumentation.instrumentWebSocketOperation(
      'new',
      'connection_establishment',
      async (span: api.Span) => {
        span.setAttributes({
          'websocket.connection_attempt': true,
          'websocket.client_ip': request.socket.remoteAddress || 'unknown',
          'websocket.user_agent': request.headers['user-agent'] || 'unknown'
        });

        try {
          // Authenticate the connection
          const authStart = Date.now();
          const authResult = await this.authenticateConnection(request);
          const authDuration = Date.now() - authStart;
          
          span.setAttributes({
            'websocket.auth_duration_ms': authDuration,
            'websocket.auth_result': authResult.success ? 'success' : 'failure'
          });

          if (!authResult.success) {
            span.setAttributes({
              'websocket.close_reason': 'authentication_failed'
            });
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

          // Update span with connection details
          span.setAttributes({
            [BusinessAttributes.WEBSOCKET_CONNECTION_ID]: connectionId,
            [BusinessAttributes.USER_ID]: connection.userId,
            [BusinessAttributes.ORGANIZATION_ID]: connection.organizationId,
            'websocket.connection_established': true
          });

          // Set up WebSocket event handlers
          this.setupInstrumentedWebSocketHandlers(connection);

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
          span.setAttributes({
            'websocket.setup_error': error instanceof Error ? error.message : 'Unknown error'
          });
          
          this.logger.error('WebSocket connection error:', error);
          ws.close(4000, 'Connection setup failed');
        }
      },
      context
    );
  }

  /**
   * Set up WebSocket event handlers with instrumentation
   */
  private setupInstrumentedWebSocketHandlers(connection: WebSocketConnection): void {
    const { ws } = connection;

    ws.on('message', async (data: Buffer) => {
      const context: BusinessContext = {
        userId: connection.userId,
        organizationId: connection.organizationId,
        tenantId: connection.organizationId
      };

      return this.instrumentation.instrumentWebSocketOperation(
        connection.id,
        'message_received',
        async (span: api.Span) => {
          span.setAttributes({
            [BusinessAttributes.WEBSOCKET_MESSAGE_SIZE]: data.length,
            'websocket.message_encoding': 'utf8'
          });

          try {
            connection.metadata.lastActivity = new Date();
            
            const messageStart = Date.now();
            const message = JSON.parse(data.toString()) as WebSocketMessage;
            const parseTime = Date.now() - messageStart;
            
            span.setAttributes({
              'websocket.message_type': message.type,
              'websocket.message_method': message.method || 'unknown',
              'websocket.message_parse_time_ms': parseTime,
              'websocket.message_has_id': !!message.id
            });

            await this.handleWebSocketMessage(connection, message);
            
          } catch (error) {
            span.setAttributes({
              'websocket.message_error': error instanceof Error ? error.message : 'Unknown error'
            });
            
            this.logger.error('WebSocket message handling error:', error);
            this.sendError(connection, 'Invalid message format', 4002);
          }
        },
        context
      );
    });

    ws.on('close', (code: number, reason: string) => {
      this.instrumentedHandleConnectionClose(connection, code, reason);
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
   * Handle WebSocket messages with detailed instrumentation
   */
  private async handleWebSocketMessage(
    connection: WebSocketConnection,
    message: WebSocketMessage
  ): Promise<void> {
    const context: BusinessContext = {
      userId: connection.userId,
      organizationId: connection.organizationId,
      tenantId: connection.organizationId
    };

    return this.instrumentation.instrumentWebSocketOperation(
      connection.id,
      'message_processing',
      async (span: api.Span) => {
        span.setAttributes({
          'websocket.message_type': message.type,
          'websocket.message_method': message.method || 'unknown'
        });

        try {
          switch (message.type) {
            case 'request':
              await this.instrumentedHandleMcpRequest(connection, message, span);
              break;
              
            case 'subscription':
              await this.instrumentedHandleSubscription(connection, message, span);
              break;
              
            default:
              span.setAttributes({
                'websocket.error_type': 'unknown_message_type'
              });
              this.sendError(connection, `Unknown message type: ${message.type}`, 4003);
          }
          
        } catch (error) {
          span.setAttributes({
            'websocket.processing_error': error instanceof Error ? error.message : 'Unknown error'
          });
          
          this.logger.error('Message handling error:', error);
          this.sendError(connection, 'Message processing failed', 4004);
        }
      },
      context
    );
  }

  /**
   * Handle MCP requests via WebSocket with instrumentation
   */
  private async instrumentedHandleMcpRequest(
    connection: WebSocketConnection,
    message: WebSocketMessage,
    parentSpan: api.Span
  ): Promise<void> {
    if (!message.method) {
      parentSpan.setAttributes({
        'mcp.error': 'missing_method'
      });
      this.sendError(connection, 'Missing method in request', 4005);
      return;
    }

    try {
      parentSpan.setAttributes({
        'mcp.method': message.method,
        'mcp.has_params': !!message.params,
        'mcp.request_id': message.id || 'unknown'
      });

      // Create MCP request
      const mcpRequest = {
        jsonrpc: '2.0' as const,
        id: message.id,
        method: message.method,
        params: message.params
      };

      // Check if this is a legacy request
      const isLegacy = this.isLegacyRequest(mcpRequest);
      parentSpan.setAttributes({
        'mcp.is_legacy': isLegacy
      });
      
      let response;
      const requestStart = Date.now();
      
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

      const requestDuration = Date.now() - requestStart;
      parentSpan.setAttributes({
        'mcp.request_duration_ms': requestDuration,
        'mcp.response_has_result': !!response.result,
        'mcp.response_has_error': !!response.error
      });

      // Send response back via WebSocket
      this.sendMessage(connection, {
        type: 'response',
        id: message.id,
        result: response.result,
        error: response.error
      });

    } catch (error) {
      parentSpan.setAttributes({
        'mcp.request_error': error instanceof Error ? error.message : 'Unknown error'
      });

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
   * Handle subscription requests with instrumentation
   */
  private async instrumentedHandleSubscription(
    connection: WebSocketConnection,
    message: WebSocketMessage,
    parentSpan: api.Span
  ): Promise<void> {
    const { method, params } = message;

    parentSpan.setAttributes({
      'subscription.method': method || 'unknown',
      'subscription.has_params': !!params
    });

    switch (method) {
      case 'subscribe':
        await this.instrumentedHandleSubscribe(connection, message, params, parentSpan);
        break;
        
      case 'unsubscribe':
        await this.instrumentedHandleUnsubscribe(connection, message, params, parentSpan);
        break;
        
      case 'list_subscriptions':
        await this.handleListSubscriptions(connection, message);
        break;
        
      default:
        parentSpan.setAttributes({
          'subscription.error': 'unknown_method'
        });
        this.sendError(connection, `Unknown subscription method: ${method}`, 4006);
    }
  }

  /**
   * Handle subscribe request with detailed instrumentation
   */
  private async instrumentedHandleSubscribe(
    connection: WebSocketConnection,
    message: WebSocketMessage,
    params: any,
    parentSpan: api.Span
  ): Promise<void> {
    const { event_types, filters } = params;

    if (!event_types || !Array.isArray(event_types)) {
      parentSpan.setAttributes({
        'subscription.error': 'invalid_event_types'
      });
      this.sendError(connection, 'event_types must be an array', 4007);
      return;
    }

    parentSpan.setAttributes({
      'subscription.event_types_count': event_types.length,
      'subscription.event_types': event_types.join(','),
      'subscription.has_filters': !!filters
    });

    // Validate subscription permissions
    const permissionStart = Date.now();
    const hasPermission = await this.validateSubscriptionPermissions(
      connection,
      event_types,
      filters
    );
    const permissionDuration = Date.now() - permissionStart;

    parentSpan.setAttributes({
      'subscription.permission_check_duration_ms': permissionDuration,
      'subscription.permission_granted': hasPermission
    });

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

    parentSpan.setAttributes({
      [BusinessAttributes.WEBSOCKET_SUBSCRIPTION_COUNT]: connection.subscriptions.size
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
   * Handle unsubscribe request with instrumentation
   */
  private async instrumentedHandleUnsubscribe(
    connection: WebSocketConnection,
    message: WebSocketMessage,
    params: any,
    parentSpan: api.Span
  ): Promise<void> {
    const { event_types } = params;

    if (!event_types || !Array.isArray(event_types)) {
      parentSpan.setAttributes({
        'subscription.error': 'invalid_event_types'
      });
      this.sendError(connection, 'event_types must be an array', 4007);
      return;
    }

    parentSpan.setAttributes({
      'subscription.unsubscribe_count': event_types.length,
      'subscription.event_types': event_types.join(',')
    });

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

    parentSpan.setAttributes({
      [BusinessAttributes.WEBSOCKET_SUBSCRIPTION_COUNT]: connection.subscriptions.size
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
   * Broadcast event to subscribed connections with comprehensive instrumentation
   */
  async broadcastEvent(eventType: string, data: any, filters?: SubscriptionFilter): Promise<void> {
    return this.instrumentation.instrumentWebSocketOperation(
      'broadcast',
      'event_broadcast',
      async (span: api.Span) => {
        const connectionIds = this.subscriptions.get(eventType);
        
        span.setAttributes({
          [BusinessAttributes.WEBSOCKET_EVENT_TYPE]: eventType,
          'broadcast.total_subscribers': connectionIds?.size || 0,
          'broadcast.has_filters': !!filters,
          'broadcast.data_size_bytes': JSON.stringify(data).length
        });

        if (!connectionIds || connectionIds.size === 0) {
          span.setAttributes({
            'broadcast.connections_notified': 0,
            'broadcast.result': 'no_subscribers'
          });
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
        let filterCount = 0;

        for (const connectionId of connectionIds) {
          const connection = this.connections.get(connectionId);
          if (!connection) {
            // Clean up stale connection ID
            connectionIds.delete(connectionId);
            continue;
          }

          // Apply filters
          if (filters && !this.matchesFilter(connection, filters)) {
            filterCount++;
            continue;
          }

          this.sendMessage(connection, message);
          broadcastCount++;
        }

        span.setAttributes({
          'broadcast.connections_notified': broadcastCount,
          'broadcast.connections_filtered': filterCount,
          'broadcast.result': 'success'
        });

        this.logger.debug('Event broadcasted', {
          event_type: eventType,
          connections_notified: broadcastCount,
          total_subscribers: connectionIds.size,
          connections_filtered: filterCount
        });
      }
    );
  }

  /**
   * Send message to specific connection
   */
  private sendMessage(connection: WebSocketConnection, message: WebSocketMessage): void {
    if (connection.ws.readyState === WebSocket.OPEN) {
      try {
        const messageStr = JSON.stringify(message);
        connection.ws.send(messageStr);
        
        // Record message size metric
        this.instrumentation.recordBusinessMetric(
          'websocket_message_sent',
          messageStr.length,
          {
            connection_id: connection.id,
            organization_id: connection.organizationId,
            message_type: message.type
          }
        );
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
   * Handle connection close with instrumentation
   */
  private instrumentedHandleConnectionClose(connection: WebSocketConnection, code: number, reason: string): void {
    const context: BusinessContext = {
      userId: connection.userId,
      organizationId: connection.organizationId,
      tenantId: connection.organizationId
    };

    this.instrumentation.instrumentWebSocketOperation(
      connection.id,
      'connection_close',
      async (span: api.Span) => {
        const connectionDuration = Date.now() - connection.metadata.connectedAt.getTime();
        
        span.setAttributes({
          'websocket.close_code': code,
          'websocket.close_reason': reason,
          'websocket.connection_duration_ms': connectionDuration,
          'websocket.subscriptions_count': connection.subscriptions.size
        });

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
          duration_ms: connectionDuration
        });

        this.emit('connection:closed', connection, code, reason);
      },
      context
    ).catch(error => {
      this.logger.error('Error instrumenting connection close:', error);
    });
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
    return !request.jsonrpc || request.jsonrpc !== '2.0';
  }

  /**
   * Generate unique connection ID
   */
  private generateConnectionId(): string {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clean up stale connections with instrumentation
   */
  @InstrumentMethod(OperationType.WEBSOCKET_MESSAGE, 'cleanup_stale_connections')
  private async instrumentedCleanupStaleConnections(): Promise<void> {
    const span = api.trace.getActiveSpan();
    const now = Date.now();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes
    let staleCount = 0;
    let pingCount = 0;

    for (const [connectionId, connection] of this.connections) {
      const lastActivity = connection.metadata.lastActivity.getTime();
      
      if (now - lastActivity > staleThreshold) {
        // Send ping to check if connection is still alive
        if (connection.ws.readyState === WebSocket.OPEN) {
          connection.ws.ping();
          pingCount++;
          
          // If no pong received in 30 seconds, connection is stale
          setTimeout(() => {
            if (now - connection.metadata.lastActivity.getTime() > staleThreshold) {
              connection.ws.terminate();
              staleCount++;
            }
          }, 30000);
        } else {
          // Connection is already closed, clean up
          this.instrumentedHandleConnectionClose(connection, 1006, 'Connection stale');
          staleCount++;
        }
      }
    }

    if (span) {
      span.setAttributes({
        'cleanup.connections_checked': this.connections.size,
        'cleanup.stale_connections': staleCount,
        'cleanup.pings_sent': pingCount
      });
    }
  }

  /**
   * Get connection statistics with instrumentation
   */
  @InstrumentMethod(OperationType.WEBSOCKET_MESSAGE, 'get_connection_stats')
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
   * Close all connections and cleanup with instrumentation
   */
  @InstrumentMethod(OperationType.WEBSOCKET_MESSAGE, 'shutdown')
  async shutdown(): Promise<void> {
    const span = api.trace.getActiveSpan();
    
    clearInterval(this.heartbeatInterval);

    // Close all connections
    for (const connection of this.connections.values()) {
      connection.ws.close(1001, 'Server shutdown');
    }

    // Clear all data structures
    this.connections.clear();
    this.subscriptions.clear();

    if (span) {
      span.setAttributes({
        'shutdown.result': 'success'
      });
    }

    this.logger.info('WebSocket service shutdown complete');
  }
}