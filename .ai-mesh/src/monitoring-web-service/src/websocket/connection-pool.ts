/**
 * Connection Pool Manager - Sprint 5 Task 5.1
 * Advanced connection pooling and management for WebSocket connections
 * 
 * Features:
 * - Connection pooling with load balancing
 * - Health monitoring and auto-recovery
 * - Performance metrics and optimization
 * - Memory usage optimization
 * - Connection lifecycle management
 */

import { Socket } from 'socket.io';
import { RedisManager } from '../config/redis.config';
import * as winston from 'winston';
import EventEmitter from 'events';

export interface ConnectionPoolConfig {
  maxConnections: number;
  maxConnectionsPerUser: number;
  maxConnectionsPerOrganization: number;
  connectionTimeout: number;
  healthCheckInterval: number;
  performanceMonitorInterval: number;
  memoryThreshold: number; // MB
  cpuThreshold: number; // percentage
}

export interface PooledConnection {
  id: string;
  socket: Socket;
  userId: string;
  organizationId: string;
  userRole: string;
  createdAt: Date;
  lastActivity: Date;
  metadata: {
    ipAddress: string;
    userAgent: string;
    connectionCount: number;
    bytesReceived: number;
    bytesSent: number;
    messagesReceived: number;
    messagesSent: number;
    errorCount: number;
  };
  healthStatus: 'healthy' | 'warning' | 'critical' | 'disconnected';
  poolIndex: number;
}

export interface PoolMetrics {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  poolUtilization: number;
  averageResponseTime: number;
  throughput: {
    messagesPerSecond: number;
    bytesPerSecond: number;
  };
  healthScore: number;
  memoryUsage: number;
  cpuUsage: number;
  errors: {
    connectionErrors: number;
    timeoutErrors: number;
    memoryErrors: number;
  };
}

export class ConnectionPool extends EventEmitter {
  private connections: Map<string, PooledConnection> = new Map();
  private connectionsByUser: Map<string, Set<string>> = new Map();
  private connectionsByOrganization: Map<string, Set<string>> = new Map();
  private pools: PooledConnection[][] = [];
  private currentPoolIndex: number = 0;
  private healthCheckInterval: NodeJS.Timeout;
  private performanceInterval: NodeJS.Timeout;
  private metrics: PoolMetrics;
  
  constructor(
    private redisManager: RedisManager,
    private logger: winston.Logger,
    private config: ConnectionPoolConfig
  ) {
    super();
    
    this.initializePools();
    this.initializeMetrics();
    this.startBackgroundServices();
  }

  /**
   * Add connection to pool with load balancing
   */
  async addConnection(
    socket: Socket,
    userId: string,
    organizationId: string,
    userRole: string
  ): Promise<{ success: boolean; error?: string; poolIndex?: number }> {
    try {
      // Check global connection limit
      if (this.connections.size >= this.config.maxConnections) {
        return { success: false, error: 'Global connection limit reached' };
      }

      // Check per-user connection limit
      const userConnections = this.connectionsByUser.get(userId)?.size || 0;
      if (userConnections >= this.config.maxConnectionsPerUser) {
        return { success: false, error: 'User connection limit reached' };
      }

      // Check per-organization connection limit
      const orgConnections = this.connectionsByOrganization.get(organizationId)?.size || 0;
      if (orgConnections >= this.config.maxConnectionsPerOrganization) {
        return { success: false, error: 'Organization connection limit reached' };
      }

      // Select pool using round-robin load balancing
      const poolIndex = this.selectOptimalPool();
      
      // Create pooled connection
      const pooledConnection: PooledConnection = {
        id: socket.id,
        socket,
        userId,
        organizationId,
        userRole,
        createdAt: new Date(),
        lastActivity: new Date(),
        metadata: {
          ipAddress: socket.handshake.address,
          userAgent: socket.handshake.headers['user-agent'] || 'unknown',
          connectionCount: 1,
          bytesReceived: 0,
          bytesSent: 0,
          messagesReceived: 0,
          messagesSent: 0,
          errorCount: 0
        },
        healthStatus: 'healthy',
        poolIndex
      };

      // Add to data structures
      this.connections.set(socket.id, pooledConnection);
      this.pools[poolIndex].push(pooledConnection);

      // Track by user
      if (!this.connectionsByUser.has(userId)) {
        this.connectionsByUser.set(userId, new Set());
      }
      this.connectionsByUser.get(userId)!.add(socket.id);

      // Track by organization
      if (!this.connectionsByOrganization.has(organizationId)) {
        this.connectionsByOrganization.set(organizationId, new Set());
      }
      this.connectionsByOrganization.get(organizationId)!.add(socket.id);

      // Setup connection monitoring
      this.setupConnectionMonitoring(pooledConnection);

      // Update metrics
      this.metrics.totalConnections++;
      this.metrics.activeConnections++;

      // Cache connection info
      await this.cacheConnectionInfo(pooledConnection);

      this.logger.debug('Connection added to pool', {
        connectionId: socket.id,
        userId,
        organizationId,
        poolIndex,
        totalConnections: this.connections.size
      });

      this.emit('connection:added', pooledConnection);
      return { success: true, poolIndex };

    } catch (error) {
      this.logger.error('Failed to add connection to pool:', error);
      return { success: false, error: 'Internal error' };
    }
  }

  /**
   * Remove connection from pool
   */
  async removeConnection(connectionId: string): Promise<void> {
    try {
      const connection = this.connections.get(connectionId);
      if (!connection) return;

      // Remove from connections map
      this.connections.delete(connectionId);

      // Remove from pool
      const pool = this.pools[connection.poolIndex];
      const index = pool.findIndex(conn => conn.id === connectionId);
      if (index !== -1) {
        pool.splice(index, 1);
      }

      // Remove from user tracking
      this.connectionsByUser.get(connection.userId)?.delete(connectionId);
      if (this.connectionsByUser.get(connection.userId)?.size === 0) {
        this.connectionsByUser.delete(connection.userId);
      }

      // Remove from organization tracking
      this.connectionsByOrganization.get(connection.organizationId)?.delete(connectionId);
      if (this.connectionsByOrganization.get(connection.organizationId)?.size === 0) {
        this.connectionsByOrganization.delete(connection.organizationId);
      }

      // Update metrics
      this.metrics.totalConnections--;
      this.metrics.activeConnections--;

      // Remove from cache
      await this.removeCachedConnectionInfo(connectionId);

      this.logger.debug('Connection removed from pool', {
        connectionId,
        userId: connection.userId,
        organizationId: connection.organizationId,
        poolIndex: connection.poolIndex,
        connectionDuration: Date.now() - connection.createdAt.getTime()
      });

      this.emit('connection:removed', connection);

    } catch (error) {
      this.logger.error('Failed to remove connection from pool:', error);
    }
  }

  /**
   * Get connection by ID
   */
  getConnection(connectionId: string): PooledConnection | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * Get all connections for user
   */
  getUserConnections(userId: string): PooledConnection[] {
    const connectionIds = this.connectionsByUser.get(userId) || new Set();
    return Array.from(connectionIds)
      .map(id => this.connections.get(id))
      .filter((conn): conn is PooledConnection => conn !== undefined);
  }

  /**
   * Get all connections for organization
   */
  getOrganizationConnections(organizationId: string): PooledConnection[] {
    const connectionIds = this.connectionsByOrganization.get(organizationId) || new Set();
    return Array.from(connectionIds)
      .map(id => this.connections.get(id))
      .filter((conn): conn is PooledConnection => conn !== undefined);
  }

  /**
   * Get pool with least connections (load balancing)
   */
  private selectOptimalPool(): number {
    let minConnectionsCount = Number.MAX_SAFE_INTEGER;
    let optimalPoolIndex = 0;

    for (let i = 0; i < this.pools.length; i++) {
      const healthyConnections = this.pools[i].filter(
        conn => conn.healthStatus === 'healthy' || conn.healthStatus === 'warning'
      ).length;

      if (healthyConnections < minConnectionsCount) {
        minConnectionsCount = healthyConnections;
        optimalPoolIndex = i;
      }
    }

    return optimalPoolIndex;
  }

  /**
   * Setup connection monitoring and metrics tracking
   */
  private setupConnectionMonitoring(connection: PooledConnection): void {
    const { socket } = connection;

    // Track activity
    socket.onAny(() => {
      connection.lastActivity = new Date();
      connection.metadata.messagesReceived++;
    });

    // Track outgoing messages
    const originalEmit = socket.emit.bind(socket);
    socket.emit = (...args: any[]) => {
      connection.metadata.messagesSent++;
      connection.metadata.bytesSent += JSON.stringify(args).length;
      return originalEmit(...args);
    };

    // Track errors
    socket.on('error', () => {
      connection.metadata.errorCount++;
      connection.healthStatus = connection.metadata.errorCount > 5 ? 'critical' : 'warning';
    });

    // Track disconnection
    socket.on('disconnect', () => {
      connection.healthStatus = 'disconnected';
      this.removeConnection(connection.id);
    });
  }

  /**
   * Perform health check on all connections
   */
  private async performHealthCheck(): Promise<void> {
    const now = Date.now();
    const healthyConnections = [];
    const warningConnections = [];
    const criticalConnections = [];

    for (const connection of this.connections.values()) {
      // Check connection age
      const age = now - connection.createdAt.getTime();
      const lastActivity = now - connection.lastActivity.getTime();

      // Health scoring
      let healthScore = 100;

      // Deduct points for inactivity
      if (lastActivity > 300000) { // 5 minutes
        healthScore -= 30;
      }

      // Deduct points for errors
      healthScore -= Math.min(connection.metadata.errorCount * 10, 50);

      // Deduct points for socket state
      if (connection.socket.readyState !== 'open') {
        healthScore -= 50;
      }

      // Categorize health
      if (healthScore >= 80) {
        connection.healthStatus = 'healthy';
        healthyConnections.push(connection);
      } else if (healthScore >= 60) {
        connection.healthStatus = 'warning';
        warningConnections.push(connection);
      } else {
        connection.healthStatus = 'critical';
        criticalConnections.push(connection);
      }
    }

    // Calculate overall health score
    const totalConnections = this.connections.size;
    if (totalConnections > 0) {
      this.metrics.healthScore = (
        (healthyConnections.length * 100 + 
         warningConnections.length * 60 + 
         criticalConnections.length * 30) / totalConnections
      );
    }

    // Log health status
    if (warningConnections.length > 0 || criticalConnections.length > 0) {
      this.logger.warn('Connection health check completed', {
        healthy: healthyConnections.length,
        warning: warningConnections.length,
        critical: criticalConnections.length,
        overallHealthScore: this.metrics.healthScore
      });
    }

    // Auto-disconnect critical connections
    for (const connection of criticalConnections) {
      if (connection.healthStatus === 'critical' && 
          connection.metadata.errorCount > 10) {
        try {
          connection.socket.disconnect(true);
        } catch (error) {
          this.logger.error('Failed to disconnect critical connection:', error);
        }
      }
    }
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(): void {
    const now = Date.now();
    
    // Calculate pool utilization
    const totalCapacity = this.config.maxConnections;
    this.metrics.poolUtilization = (this.connections.size / totalCapacity) * 100;

    // Calculate throughput
    let totalMessages = 0;
    let totalBytes = 0;
    
    for (const connection of this.connections.values()) {
      totalMessages += connection.metadata.messagesReceived + connection.metadata.messagesSent;
      totalBytes += connection.metadata.bytesReceived + connection.metadata.bytesSent;
    }

    this.metrics.throughput = {
      messagesPerSecond: totalMessages / 60, // Average over last minute
      bytesPerSecond: totalBytes / 60
    };

    // System metrics
    const memUsage = process.memoryUsage();
    this.metrics.memoryUsage = memUsage.heapUsed / (1024 * 1024); // MB

    // Emit performance event
    this.emit('metrics:updated', this.metrics);

    // Check thresholds and emit warnings
    if (this.metrics.memoryUsage > this.config.memoryThreshold) {
      this.emit('threshold:memory', this.metrics.memoryUsage);
      this.logger.warn('Memory threshold exceeded', {
        current: this.metrics.memoryUsage,
        threshold: this.config.memoryThreshold
      });
    }

    if (this.metrics.poolUtilization > 85) {
      this.emit('threshold:capacity', this.metrics.poolUtilization);
      this.logger.warn('Pool utilization high', {
        utilization: this.metrics.poolUtilization
      });
    }
  }

  /**
   * Cache connection information in Redis
   */
  private async cacheConnectionInfo(connection: PooledConnection): Promise<void> {
    try {
      const cacheKey = `connection:${connection.id}:info`;
      const connectionInfo = {
        id: connection.id,
        userId: connection.userId,
        organizationId: connection.organizationId,
        createdAt: connection.createdAt,
        poolIndex: connection.poolIndex,
        healthStatus: connection.healthStatus
      };
      
      await this.redisManager.cacheMetrics(cacheKey, connectionInfo, 600); // 10 minute TTL
    } catch (error) {
      this.logger.warn('Failed to cache connection info:', error);
    }
  }

  /**
   * Remove cached connection information
   */
  private async removeCachedConnectionInfo(connectionId: string): Promise<void> {
    try {
      const cacheKey = `connection:${connectionId}:info`;
      await this.redisManager.client.del(cacheKey);
    } catch (error) {
      this.logger.warn('Failed to remove cached connection info:', error);
    }
  }

  /**
   * Initialize connection pools
   */
  private initializePools(): void {
    const poolCount = Math.ceil(this.config.maxConnections / 100); // ~100 connections per pool
    this.pools = Array.from({ length: Math.max(poolCount, 4) }, () => []);
    
    this.logger.info('Connection pools initialized', {
      poolCount: this.pools.length,
      maxConnections: this.config.maxConnections
    });
  }

  /**
   * Initialize metrics
   */
  private initializeMetrics(): void {
    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      poolUtilization: 0,
      averageResponseTime: 0,
      throughput: {
        messagesPerSecond: 0,
        bytesPerSecond: 0
      },
      healthScore: 100,
      memoryUsage: 0,
      cpuUsage: 0,
      errors: {
        connectionErrors: 0,
        timeoutErrors: 0,
        memoryErrors: 0
      }
    };
  }

  /**
   * Start background monitoring services
   */
  private startBackgroundServices(): void {
    // Health check interval
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckInterval);

    // Performance monitoring interval
    this.performanceInterval = setInterval(() => {
      this.updatePerformanceMetrics();
    }, this.config.performanceMonitorInterval);
  }

  /**
   * Get current metrics
   */
  getMetrics(): PoolMetrics {
    return { ...this.metrics };
  }

  /**
   * Get pool statistics
   */
  getPoolStats(): {
    pools: Array<{ index: number; connectionCount: number; healthyCount: number }>;
    totalConnections: number;
    distribution: Record<number, number>;
  } {
    const poolStats = this.pools.map((pool, index) => ({
      index,
      connectionCount: pool.length,
      healthyCount: pool.filter(conn => conn.healthStatus === 'healthy').length
    }));

    const distribution: Record<number, number> = {};
    poolStats.forEach(pool => {
      distribution[pool.index] = pool.connectionCount;
    });

    return {
      pools: poolStats,
      totalConnections: this.connections.size,
      distribution
    };
  }

  /**
   * Shutdown the connection pool
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down connection pool...');

    // Clear intervals
    if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);
    if (this.performanceInterval) clearInterval(this.performanceInterval);

    // Disconnect all connections gracefully
    const disconnectPromises = Array.from(this.connections.values()).map(async (connection) => {
      try {
        connection.socket.emit('server_shutdown', { 
          message: 'Server shutting down',
          timestamp: new Date()
        });
        
        // Give a moment for the message to be sent
        await new Promise(resolve => setTimeout(resolve, 100));
        
        connection.socket.disconnect(true);
      } catch (error) {
        this.logger.error('Error disconnecting socket:', error);
      }
    });

    await Promise.allSettled(disconnectPromises);

    // Clear data structures
    this.connections.clear();
    this.connectionsByUser.clear();
    this.connectionsByOrganization.clear();
    this.pools.forEach(pool => pool.length = 0);

    this.logger.info('Connection pool shutdown complete');
  }
}