/**
 * Presence Manager - Sprint 5 Task 5.3
 * User online/offline status and presence tracking
 * 
 * Features:
 * - Real-time presence updates
 * - Multi-device presence tracking
 * - Presence history and analytics
 * - Away/idle detection
 * - Team presence overview
 * - Presence-based routing
 */

import { EventPublisher, EventType, EventPriority } from '../events/event-publisher';
import { RedisManager } from '../config/redis.config';
import { DatabaseConnection } from '../database/connection';
import * as winston from 'winston';
import EventEmitter from 'events';

export interface UserPresence {
  userId: string;
  userName: string;
  organizationId: string;
  status: PresenceStatus;
  lastSeen: Date;
  lastActivity: Date;
  connections: Connection[];
  metadata: {
    timezone?: string;
    workingHours?: { start: string; end: string };
    autoAway?: boolean;
    customStatus?: string;
    location?: string;
  };
  capabilities: {
    collaborative: boolean;
    realTimeUpdates: boolean;
    notifications: boolean;
  };
}

export type PresenceStatus = 'online' | 'away' | 'idle' | 'offline' | 'do_not_disturb' | 'in_meeting';

export interface Connection {
  id: string;
  socketId: string;
  device: {
    type: 'desktop' | 'mobile' | 'tablet' | 'unknown';
    os?: string;
    browser?: string;
    version?: string;
  };
  ipAddress: string;
  userAgent: string;
  connectedAt: Date;
  lastActivity: Date;
  isActive: boolean;
}

export interface PresenceUpdate {
  userId: string;
  organizationId: string;
  status: PresenceStatus;
  timestamp: Date;
  source: 'manual' | 'automatic' | 'system';
  metadata?: Record<string, any>;
}

export interface TeamPresence {
  organizationId: string;
  teamId?: string;
  totalUsers: number;
  onlineUsers: number;
  awayUsers: number;
  idleUsers: number;
  offlineUsers: number;
  users: UserPresence[];
  lastUpdated: Date;
}

export interface PresenceAnalytics {
  organizationId: string;
  period: { start: Date; end: Date };
  averageOnlineTime: number;
  peakOnlineHours: Record<string, number>;
  deviceBreakdown: Record<string, number>;
  statusDistribution: Record<PresenceStatus, number>;
  collaborationReadiness: number; // Percentage of users available for collaboration
}

export class PresenceManager extends EventEmitter {
  private userPresences: Map<string, UserPresence> = new Map(); // userId -> presence
  private connectionMapping: Map<string, string> = new Map(); // socketId -> userId
  private organizationPresence: Map<string, Set<string>> = new Map(); // orgId -> userIds
  private presenceHistory: Map<string, PresenceUpdate[]> = new Map(); // userId -> history
  private idleTimers: Map<string, NodeJS.Timeout> = new Map(); // userId -> timer

  constructor(
    private eventPublisher: EventPublisher,
    private redisManager: RedisManager,
    private db: DatabaseConnection,
    private logger: winston.Logger,
    private config: {
      idleTimeout: number; // milliseconds
      awayTimeout: number; // milliseconds
      offlineTimeout: number; // milliseconds
      heartbeatInterval: number;
      historyRetention: number;
      enableAnalytics: boolean;
    }
  ) {
    super();
    
    this.startBackgroundServices();
    this.loadPresenceFromCache();
  }

  /**
   * Set user online when they connect
   */
  async setUserOnline(
    userId: string,
    userName: string,
    organizationId: string,
    connectionInfo: {
      socketId: string;
      ipAddress: string;
      userAgent: string;
      device?: Partial<Connection['device']>;
    }
  ): Promise<{ success: boolean; presence?: UserPresence }> {
    try {
      // Get or create user presence
      let presence = this.userPresences.get(userId);
      const now = new Date();

      if (!presence) {
        presence = {
          userId,
          userName,
          organizationId,
          status: 'online',
          lastSeen: now,
          lastActivity: now,
          connections: [],
          metadata: {},
          capabilities: {
            collaborative: true,
            realTimeUpdates: true,
            notifications: true
          }
        };
      } else {
        presence.status = 'online';
        presence.lastSeen = now;
        presence.lastActivity = now;
      }

      // Add connection
      const connection: Connection = {
        id: this.generateConnectionId(),
        socketId: connectionInfo.socketId,
        device: {
          type: this.detectDeviceType(connectionInfo.userAgent),
          os: this.detectOS(connectionInfo.userAgent),
          browser: this.detectBrowser(connectionInfo.userAgent),
          ...connectionInfo.device
        },
        ipAddress: connectionInfo.ipAddress,
        userAgent: connectionInfo.userAgent,
        connectedAt: now,
        lastActivity: now,
        isActive: true
      };

      presence.connections.push(connection);
      this.userPresences.set(userId, presence);

      // Update connection mapping
      this.connectionMapping.set(connectionInfo.socketId, userId);

      // Add to organization presence
      if (!this.organizationPresence.has(organizationId)) {
        this.organizationPresence.set(organizationId, new Set());
      }
      this.organizationPresence.get(organizationId)!.add(userId);

      // Clear any idle timers
      this.clearIdleTimer(userId);

      // Cache presence
      await this.cachePresence(presence);

      // Record presence update
      await this.recordPresenceUpdate({
        userId,
        organizationId,
        status: 'online',
        timestamp: now,
        source: 'automatic',
        metadata: { connectionId: connection.id, device: connection.device }
      });

      // Publish presence update
      await this.publishPresenceUpdate(presence, 'online');

      this.logger.debug('User set online', {
        userId,
        organizationId,
        connectionCount: presence.connections.length,
        deviceType: connection.device.type
      });

      this.emit('presence:online', presence);
      return { success: true, presence };

    } catch (error) {
      this.logger.error('Failed to set user online:', error);
      return { success: false };
    }
  }

  /**
   * Update user activity (reset idle timer)
   */
  async updateUserActivity(socketId: string): Promise<void> {
    try {
      const userId = this.connectionMapping.get(socketId);
      if (!userId) return;

      const presence = this.userPresences.get(userId);
      if (!presence) return;

      const now = new Date();
      presence.lastActivity = now;

      // Update connection activity
      const connection = presence.connections.find(c => c.socketId === socketId);
      if (connection) {
        connection.lastActivity = now;
        connection.isActive = true;
      }

      // Reset status to online if user was idle/away
      if (presence.status === 'idle' || presence.status === 'away') {
        presence.status = 'online';
        await this.publishPresenceUpdate(presence, 'online');
      }

      // Reset idle timer
      this.setIdleTimer(userId);

      // Cache updated presence
      await this.cachePresence(presence);

    } catch (error) {
      this.logger.error('Failed to update user activity:', error);
    }
  }

  /**
   * Set user offline when they disconnect
   */
  async setUserOffline(socketId: string, reason?: string): Promise<void> {
    try {
      const userId = this.connectionMapping.get(socketId);
      if (!userId) return;

      const presence = this.userPresences.get(userId);
      if (!presence) return;

      // Remove connection
      presence.connections = presence.connections.filter(c => c.socketId !== socketId);
      this.connectionMapping.delete(socketId);

      const now = new Date();
      presence.lastSeen = now;

      // If no more connections, set user offline
      if (presence.connections.length === 0) {
        presence.status = 'offline';

        // Clear idle timer
        this.clearIdleTimer(userId);

        // Record presence update
        await this.recordPresenceUpdate({
          userId,
          organizationId: presence.organizationId,
          status: 'offline',
          timestamp: now,
          source: 'automatic',
          metadata: { reason, disconnectionType: 'normal' }
        });

        // Publish presence update
        await this.publishPresenceUpdate(presence, 'offline');

        this.emit('presence:offline', presence);
      } else {
        // Still has other connections, just update
        await this.cachePresence(presence);
      }

      this.logger.debug('User connection removed', {
        userId,
        remainingConnections: presence.connections.length,
        reason
      });

    } catch (error) {
      this.logger.error('Failed to set user offline:', error);
    }
  }

  /**
   * Manually set user presence status
   */
  async setUserStatus(
    userId: string,
    status: PresenceStatus,
    customMessage?: string
  ): Promise<{ success: boolean; presence?: UserPresence }> {
    try {
      const presence = this.userPresences.get(userId);
      if (!presence) {
        return { success: false };
      }

      const previousStatus = presence.status;
      presence.status = status;
      presence.lastActivity = new Date();

      if (customMessage) {
        presence.metadata.customStatus = customMessage;
      }

      // Handle special statuses
      if (status === 'do_not_disturb') {
        presence.capabilities.notifications = false;
      } else {
        presence.capabilities.notifications = true;
      }

      if (status === 'in_meeting') {
        presence.capabilities.collaborative = false;
      } else {
        presence.capabilities.collaborative = true;
      }

      // Cache presence
      await this.cachePresence(presence);

      // Record presence update
      await this.recordPresenceUpdate({
        userId,
        organizationId: presence.organizationId,
        status,
        timestamp: new Date(),
        source: 'manual',
        metadata: { previousStatus, customMessage }
      });

      // Publish presence update
      await this.publishPresenceUpdate(presence, status);

      this.logger.info('User status updated', {
        userId,
        previousStatus,
        newStatus: status,
        customMessage
      });

      this.emit('presence:status_changed', presence, previousStatus);
      return { success: true, presence };

    } catch (error) {
      this.logger.error('Failed to set user status:', error);
      return { success: false };
    }
  }

  /**
   * Get user presence
   */
  getUserPresence(userId: string): UserPresence | null {
    return this.userPresences.get(userId) || null;
  }

  /**
   * Get team presence overview
   */
  getTeamPresence(organizationId: string, teamId?: string): TeamPresence {
    const userIds = this.organizationPresence.get(organizationId) || new Set();
    const users: UserPresence[] = [];
    
    let onlineUsers = 0;
    let awayUsers = 0;
    let idleUsers = 0;
    let offlineUsers = 0;

    for (const userId of userIds) {
      const presence = this.userPresences.get(userId);
      if (presence) {
        // Filter by team if specified
        if (teamId) {
          // This would require team membership data
          // For now, include all users
        }

        users.push(presence);

        switch (presence.status) {
          case 'online':
            onlineUsers++;
            break;
          case 'away':
            awayUsers++;
            break;
          case 'idle':
            idleUsers++;
            break;
          default:
            offlineUsers++;
        }
      }
    }

    return {
      organizationId,
      teamId,
      totalUsers: users.length,
      onlineUsers,
      awayUsers,
      idleUsers,
      offlineUsers,
      users: users.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime()),
      lastUpdated: new Date()
    };
  }

  /**
   * Get users available for collaboration
   */
  getAvailableUsers(organizationId: string): UserPresence[] {
    const teamPresence = this.getTeamPresence(organizationId);
    
    return teamPresence.users.filter(user => 
      user.status === 'online' && 
      user.capabilities.collaborative &&
      user.status !== 'do_not_disturb' &&
      user.status !== 'in_meeting'
    );
  }

  /**
   * Get presence analytics
   */
  async getPresenceAnalytics(
    organizationId: string,
    period?: { start: Date; end: Date }
  ): Promise<PresenceAnalytics | null> {
    try {
      if (!this.config.enableAnalytics) {
        return null;
      }

      const actualPeriod = period || {
        start: new Date(Date.now() - 86400000 * 7), // Last 7 days
        end: new Date()
      };

      // Get presence history for the period
      const analytics = await this.calculateAnalytics(organizationId, actualPeriod);
      
      return analytics;

    } catch (error) {
      this.logger.error('Failed to get presence analytics:', error);
      return null;
    }
  }

  /**
   * Private helper methods
   */
  private setIdleTimer(userId: string): void {
    this.clearIdleTimer(userId);

    const idleTimer = setTimeout(() => {
      this.handleUserIdle(userId);
    }, this.config.idleTimeout);

    this.idleTimers.set(userId, idleTimer);
  }

  private clearIdleTimer(userId: string): void {
    const timer = this.idleTimers.get(userId);
    if (timer) {
      clearTimeout(timer);
      this.idleTimers.delete(userId);
    }
  }

  private async handleUserIdle(userId: string): Promise<void> {
    const presence = this.userPresences.get(userId);
    if (!presence || presence.status === 'offline') return;

    // Set to idle first
    presence.status = 'idle';
    await this.cachePresence(presence);
    await this.publishPresenceUpdate(presence, 'idle');

    // Set timer for away status
    setTimeout(() => {
      this.handleUserAway(userId);
    }, this.config.awayTimeout - this.config.idleTimeout);

    this.logger.debug('User set to idle', { userId });
    this.emit('presence:idle', presence);
  }

  private async handleUserAway(userId: string): Promise<void> {
    const presence = this.userPresences.get(userId);
    if (!presence || presence.status !== 'idle') return;

    presence.status = 'away';
    await this.cachePresence(presence);
    await this.publishPresenceUpdate(presence, 'away');

    // Set timer for offline status
    setTimeout(() => {
      this.handleUserAutoOffline(userId);
    }, this.config.offlineTimeout - this.config.awayTimeout);

    this.logger.debug('User set to away', { userId });
    this.emit('presence:away', presence);
  }

  private async handleUserAutoOffline(userId: string): Promise<void> {
    const presence = this.userPresences.get(userId);
    if (!presence || presence.status !== 'away') return;

    // Only set to offline if user has no active connections
    const hasActiveConnections = presence.connections.some(c => c.isActive);
    if (!hasActiveConnections) {
      presence.status = 'offline';
      await this.cachePresence(presence);
      await this.publishPresenceUpdate(presence, 'offline');

      this.logger.debug('User auto-set to offline', { userId });
      this.emit('presence:offline', presence);
    }
  }

  private async publishPresenceUpdate(presence: UserPresence, status: PresenceStatus): Promise<void> {
    try {
      await this.eventPublisher.publishEvent({
        type: 'presence_update' as EventType,
        source: 'presence-manager',
        organizationId: presence.organizationId,
        userId: presence.userId,
        data: {
          userId: presence.userId,
          userName: presence.userName,
          status,
          lastSeen: presence.lastSeen,
          lastActivity: presence.lastActivity,
          connectionCount: presence.connections.length,
          capabilities: presence.capabilities,
          customStatus: presence.metadata.customStatus
        },
        routing: {
          rooms: [`org:${presence.organizationId}`, `presence:${presence.organizationId}`]
        },
        priority: 'medium' as EventPriority,
        tags: ['presence', status]
      });

    } catch (error) {
      this.logger.warn('Failed to publish presence update:', error);
    }
  }

  private async recordPresenceUpdate(update: PresenceUpdate): Promise<void> {
    try {
      // Add to history
      if (!this.presenceHistory.has(update.userId)) {
        this.presenceHistory.set(update.userId, []);
      }

      const history = this.presenceHistory.get(update.userId)!;
      history.unshift(update);

      // Keep only recent history
      const cutoff = Date.now() - this.config.historyRetention;
      const filtered = history.filter(h => h.timestamp.getTime() > cutoff);
      this.presenceHistory.set(update.userId, filtered.slice(0, 1000)); // Max 1000 entries

      // Store in Redis for analytics
      if (this.config.enableAnalytics) {
        const key = `presence_history:${update.organizationId}:${update.userId}`;
        await this.redisManager.client.lpush(key, JSON.stringify(update));
        await this.redisManager.client.ltrim(key, 0, 999); // Keep last 1000
        await this.redisManager.client.expire(key, this.config.historyRetention / 1000);
      }

    } catch (error) {
      this.logger.warn('Failed to record presence update:', error);
    }
  }

  private async cachePresence(presence: UserPresence): Promise<void> {
    try {
      const key = `presence:${presence.userId}`;
      await this.redisManager.client.setex(key, 3600, JSON.stringify(presence)); // 1 hour TTL
    } catch (error) {
      this.logger.warn('Failed to cache presence:', error);
    }
  }

  private async loadPresenceFromCache(): Promise<void> {
    try {
      // This would load existing presence data from Redis on startup
      this.logger.info('Loading presence data from cache...');
      
      // Implementation would scan Redis keys and restore presence state
      // For now, this is a placeholder
      
    } catch (error) {
      this.logger.warn('Failed to load presence from cache:', error);
    }
  }

  private detectDeviceType(userAgent: string): Connection['device']['type'] {
    const ua = userAgent.toLowerCase();
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      return 'mobile';
    } else if (ua.includes('tablet') || ua.includes('ipad')) {
      return 'tablet';
    } else if (ua.includes('desktop') || ua.includes('windows') || ua.includes('mac')) {
      return 'desktop';
    }
    return 'unknown';
  }

  private detectOS(userAgent: string): string {
    const ua = userAgent.toLowerCase();
    if (ua.includes('windows')) return 'Windows';
    if (ua.includes('mac')) return 'macOS';
    if (ua.includes('linux')) return 'Linux';
    if (ua.includes('android')) return 'Android';
    if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) return 'iOS';
    return 'Unknown';
  }

  private detectBrowser(userAgent: string): string {
    const ua = userAgent.toLowerCase();
    if (ua.includes('chrome')) return 'Chrome';
    if (ua.includes('firefox')) return 'Firefox';
    if (ua.includes('safari') && !ua.includes('chrome')) return 'Safari';
    if (ua.includes('edge')) return 'Edge';
    return 'Unknown';
  }

  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }

  private async calculateAnalytics(
    organizationId: string,
    period: { start: Date; end: Date }
  ): Promise<PresenceAnalytics> {
    // This would calculate detailed analytics from presence history
    // For now, return basic analytics based on current state
    
    const teamPresence = this.getTeamPresence(organizationId);
    const totalUsers = teamPresence.totalUsers;
    
    return {
      organizationId,
      period,
      averageOnlineTime: 0, // Would be calculated from history
      peakOnlineHours: {}, // Would be calculated from history
      deviceBreakdown: this.calculateDeviceBreakdown(teamPresence.users),
      statusDistribution: {
        online: teamPresence.onlineUsers,
        away: teamPresence.awayUsers,
        idle: teamPresence.idleUsers,
        offline: teamPresence.offlineUsers,
        do_not_disturb: 0,
        in_meeting: 0
      },
      collaborationReadiness: totalUsers > 0 
        ? (this.getAvailableUsers(organizationId).length / totalUsers) * 100 
        : 0
    };
  }

  private calculateDeviceBreakdown(users: UserPresence[]): Record<string, number> {
    const breakdown: Record<string, number> = {
      desktop: 0,
      mobile: 0,
      tablet: 0,
      unknown: 0
    };

    for (const user of users) {
      for (const connection of user.connections) {
        breakdown[connection.device.type]++;
      }
    }

    return breakdown;
  }

  private startBackgroundServices(): void {
    // Periodic cleanup of stale connections
    setInterval(() => {
      this.cleanupStaleConnections();
    }, this.config.heartbeatInterval);

    // Periodic presence cache sync
    setInterval(() => {
      this.syncPresenceCache();
    }, 60000); // 1 minute
  }

  private cleanupStaleConnections(): void {
    const now = Date.now();
    const staleThreshold = this.config.offlineTimeout;

    for (const [userId, presence] of this.userPresences.entries()) {
      // Check for stale connections
      const activeConnections = presence.connections.filter(connection => {
        const lastActivity = connection.lastActivity.getTime();
        const isStale = now - lastActivity > staleThreshold;
        
        if (isStale) {
          this.connectionMapping.delete(connection.socketId);
        }
        
        return !isStale;
      });

      if (activeConnections.length !== presence.connections.length) {
        presence.connections = activeConnections;

        // If no active connections, set offline
        if (activeConnections.length === 0 && presence.status !== 'offline') {
          presence.status = 'offline';
          presence.lastSeen = new Date();
          this.publishPresenceUpdate(presence, 'offline');
        }
      }
    }
  }

  private async syncPresenceCache(): Promise<void> {
    try {
      const syncPromises = Array.from(this.userPresences.values()).map(
        presence => this.cachePresence(presence)
      );
      
      await Promise.allSettled(syncPromises);
      
    } catch (error) {
      this.logger.warn('Failed to sync presence cache:', error);
    }
  }

  /**
   * Public API for shutdown
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Presence Manager...');

    // Clear all timers
    for (const timer of this.idleTimers.values()) {
      clearTimeout(timer);
    }

    // Set all users offline
    for (const presence of this.userPresences.values()) {
      if (presence.status !== 'offline') {
        presence.status = 'offline';
        presence.lastSeen = new Date();
        await this.publishPresenceUpdate(presence, 'offline');
      }
    }

    // Clear data structures
    this.userPresences.clear();
    this.connectionMapping.clear();
    this.organizationPresence.clear();
    this.presenceHistory.clear();
    this.idleTimers.clear();

    this.logger.info('Presence Manager shutdown complete');
  }
}