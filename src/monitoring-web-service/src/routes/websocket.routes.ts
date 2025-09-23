/**
 * WebSocket Routes and Server Integration
 * Task 4.5: WebSocket endpoint setup and real-time streaming
 * 
 * Integrates WebSocket service with Express server for real-time metrics streaming
 */

import { Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { DatabaseConnection } from '../database/connection';
import { WebSocketService } from '../services/websocket.service';
import * as winston from 'winston';
import { parse as parseUrl } from 'url';

export interface WebSocketServerConfig {
  port?: number;
  path?: string;
  maxConnections?: number;
  heartbeatInterval?: number;
  jwtSecret: string;
}

export class WebSocketManager {
  private wsServer: WebSocketServer;
  private wsService: WebSocketService;
  private connectionCount: number = 0;

  constructor(
    private httpServer: Server,
    private db: DatabaseConnection,
    private logger: winston.Logger,
    private config: WebSocketServerConfig
  ) {
    this.wsService = new WebSocketService(db, logger, config.jwtSecret);
    this.initializeWebSocketServer();
    this.setupEventHandlers();
  }

  /**
   * Initialize WebSocket server
   */
  private initializeWebSocketServer(): void {
    this.wsServer = new WebSocketServer({
      server: this.httpServer,
      path: this.config.path || '/ws',
      maxPayload: 1024 * 1024, // 1MB max payload
      perMessageDeflate: {
        // Enable compression
        threshold: 1024,
        concurrencyLimit: 10,
        memLevel: 8
      }
    });

    this.logger.info('WebSocket server initialized', {
      path: this.config.path || '/ws',
      max_connections: this.config.maxConnections || 'unlimited'
    });
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupEventHandlers(): void {
    this.wsServer.on('connection', async (ws: WebSocket, request) => {
      try {
        // Check connection limits
        if (this.config.maxConnections && this.connectionCount >= this.config.maxConnections) {
          ws.close(4009, 'Connection limit reached');
          return;
        }

        this.connectionCount++;

        // Log connection attempt
        const clientIp = request.socket.remoteAddress;
        const userAgent = request.headers['user-agent'];
        
        this.logger.info('New WebSocket connection attempt', {
          client_ip: clientIp,
          user_agent: userAgent,
          current_connections: this.connectionCount
        });

        // Handle the connection through WebSocket service
        await this.wsService.handleConnection(ws, request);

        // Setup cleanup on close
        ws.on('close', () => {
          this.connectionCount--;
        });

      } catch (error) {
        this.logger.error('WebSocket connection setup failed:', error);
        ws.close(4000, 'Connection setup failed');
        this.connectionCount--;
      }
    });

    this.wsServer.on('error', (error) => {
      this.logger.error('WebSocket server error:', error);
    });

    // Setup service event forwarding
    this.wsService.on('connection:established', (connection) => {
      this.logger.info('WebSocket connection established', {
        connection_id: connection.id,
        organization_id: connection.organizationId
      });
    });

    this.wsService.on('connection:closed', (connection, code, reason) => {
      this.logger.info('WebSocket connection closed', {
        connection_id: connection.id,
        code,
        reason
      });
    });
  }

  /**
   * Broadcast metrics update to all subscribers
   */
  async broadcastMetricsUpdate(organizationId: string, metricsData: any): Promise<void> {
    await this.wsService.broadcastEvent('metrics/updated', {
      organization_id: organizationId,
      metrics: metricsData
    });
  }

  /**
   * Broadcast dashboard update
   */
  async broadcastDashboardUpdate(organizationId: string, dashboardData: any): Promise<void> {
    await this.wsService.broadcastEvent('dashboard/updated', {
      organization_id: organizationId,
      dashboard: dashboardData
    }, {
      organizations: [organizationId]
    });
  }

  /**
   * Broadcast productivity alert
   */
  async broadcastProductivityAlert(organizationId: string, alertData: any): Promise<void> {
    await this.wsService.broadcastEvent('productivity/alert', {
      organization_id: organizationId,
      alert: alertData,
      severity: alertData.severity || 'medium'
    }, {
      organizations: [organizationId]
    });
  }

  /**
   * Broadcast agent execution event
   */
  async broadcastAgentEvent(organizationId: string, agentData: any): Promise<void> {
    await this.wsService.broadcastEvent('agent/executed', {
      organization_id: organizationId,
      agent: agentData.agent_name,
      task: agentData.task,
      duration_ms: agentData.execution_time_ms,
      success: agentData.success
    }, {
      organizations: [organizationId]
    });
  }

  /**
   * Broadcast activity event for real-time activity feed
   */
  async broadcastActivityEvent(organizationId: string, activityData: any): Promise<void> {
    await this.wsService.broadcastEvent('activity/created', {
      organization_id: organizationId,
      ...activityData
    }, {
      organizations: [organizationId]
    });
  }

  /**
   * Get WebSocket connection statistics
   */
  getStats(): any {
    return {
      server_stats: {
        total_connections: this.connectionCount,
        max_connections: this.config.maxConnections || 'unlimited',
        server_path: this.config.path || '/ws'
      },
      connection_stats: this.wsService.getConnectionStats()
    };
  }

  /**
   * Shutdown WebSocket server
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down WebSocket server...');

    // Close WebSocket service
    await this.wsService.shutdown();

    // Close WebSocket server
    return new Promise((resolve) => {
      this.wsServer.close(() => {
        this.logger.info('WebSocket server shutdown complete');
        resolve();
      });
    });
  }
}

/**
 * WebSocket Routes for REST API integration
 */
export function createWebSocketRoutes(
  wsManager: WebSocketManager,
  logger: winston.Logger
) {
  const { Router } = require('express');
  const router = Router();

  /**
   * GET /api/websocket/stats
   * Get WebSocket connection statistics
   */
  router.get('/stats', (req: any, res: any) => {
    try {
      const stats = wsManager.getStats();
      res.json({
        ...stats,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error getting WebSocket stats:', error);
      res.status(500).json({
        error: 'Failed to retrieve WebSocket statistics'
      });
    }
  });

  /**
   * POST /api/websocket/broadcast
   * Broadcast message to WebSocket connections (admin only)
   */
  router.post('/broadcast', async (req: any, res: any) => {
    try {
      const { event_type, data, organization_id } = req.body;

      if (!event_type || !data) {
        return res.status(400).json({
          error: 'event_type and data are required'
        });
      }

      // Broadcast the event
      await wsManager['wsService'].broadcastEvent(event_type, data, {
        organizations: organization_id ? [organization_id] : undefined
      });

      res.json({
        success: true,
        message: `Event ${event_type} broadcasted successfully`,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error broadcasting WebSocket message:', error);
      res.status(500).json({
        error: 'Failed to broadcast message'
      });
    }
  });

  /**
   * GET /api/websocket/health
   * WebSocket service health check
   */
  router.get('/health', (req: any, res: any) => {
    try {
      const stats = wsManager.getStats();
      
      res.json({
        status: 'healthy',
        service: 'websocket-service',
        connections: stats.server_stats.total_connections,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('WebSocket health check failed:', error);
      res.status(503).json({
        status: 'unhealthy',
        service: 'websocket-service',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return router;
}

/**
 * Middleware to integrate WebSocket events with HTTP endpoints
 */
export function createWebSocketMiddleware(wsManager: WebSocketManager) {
  return {
    /**
     * Middleware to broadcast metrics updates after collection
     */
    broadcastMetricsMiddleware: (req: any, res: any, next: any) => {
      const originalJson = res.json;
      
      res.json = function(data: any) {
        // Call original json method
        originalJson.call(this, data);
        
        // Broadcast if this was a successful metrics collection
        if (req.path?.includes('/metrics') && req.method === 'POST' && res.statusCode === 200) {
          wsManager.broadcastMetricsUpdate(req.user?.organization_id, data).catch(err => {
            // Don't fail the request if broadcast fails
            console.warn('Failed to broadcast metrics update:', err);
          });
        }
      };
      
      next();
    },

    /**
     * Middleware to broadcast dashboard updates
     */
    broadcastDashboardMiddleware: (req: any, res: any, next: any) => {
      const originalJson = res.json;
      
      res.json = function(data: any) {
        originalJson.call(this, data);
        
        if (req.path?.includes('/dashboard') && req.method === 'GET' && res.statusCode === 200) {
          wsManager.broadcastDashboardUpdate(req.user?.organization_id, data).catch(err => {
            console.warn('Failed to broadcast dashboard update:', err);
          });
        }
      };
      
      next();
    }
  };
}

/**
 * Setup WebSocket integration with HTTP server
 */
export function setupWebSocketIntegration(
  httpServer: Server,
  db: DatabaseConnection,
  logger: winston.Logger,
  config: WebSocketServerConfig
): {
  wsManager: WebSocketManager;
  wsRoutes: any;
  wsMiddleware: any;
} {
  // Create WebSocket manager
  const wsManager = new WebSocketManager(httpServer, db, logger, config);
  
  // Create routes
  const wsRoutes = createWebSocketRoutes(wsManager, logger);
  
  // Create middleware
  const wsMiddleware = createWebSocketMiddleware(wsManager);

  logger.info('WebSocket integration setup complete');

  return {
    wsManager,
    wsRoutes,
    wsMiddleware
  };
}