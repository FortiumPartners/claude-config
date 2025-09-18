/**
 * Room Manager - Sprint 5 Task 5.1
 * Tenant-based room management for WebSocket connections
 * 
 * Features:
 * - Multi-tenant room isolation
 * - Permission-based room access
 * - Room statistics and monitoring
 * - Auto-cleanup of empty rooms
 */

import { Socket } from 'socket.io';
import { DatabaseConnection } from '../database/connection';
import { RedisManager } from '../config/redis.config';
import * as winston from 'winston';

export interface RoomInfo {
  roomId: string;
  roomType: 'organization' | 'dashboard' | 'metrics' | 'collaborative';
  organizationId: string;
  connectionCount: number;
  createdAt: Date;
  lastActivity: Date;
  metadata: {
    dashboardId?: string;
    metricType?: string;
    permissions?: string[];
    isPrivate?: boolean;
  };
}

export interface RoomPermission {
  roomId: string;
  userId: string;
  permissions: string[];
  grantedAt: Date;
  grantedBy: string;
}

export class RoomManager {
  private rooms: Map<string, RoomInfo> = new Map();
  private roomPermissions: Map<string, Map<string, RoomPermission>> = new Map(); // roomId -> userId -> permission
  private userRooms: Map<string, Set<string>> = new Map(); // userId -> roomIds
  private cleanupInterval: NodeJS.Timeout;

  constructor(
    private db: DatabaseConnection,
    private redisManager: RedisManager,
    private logger: winston.Logger,
    private config: {
      cleanupInterval?: number;
      maxRoomsPerUser?: number;
      roomTtl?: number;
    } = {}
  ) {
    this.startCleanupService();
  }

  /**
   * Create or get organization room
   */
  async getOrganizationRoom(organizationId: string): Promise<string> {
    const roomId = `org:${organizationId}`;
    
    if (!this.rooms.has(roomId)) {
      await this.createRoom({
        roomId,
        roomType: 'organization',
        organizationId,
        connectionCount: 0,
        createdAt: new Date(),
        lastActivity: new Date(),
        metadata: {}
      });
    }

    return roomId;
  }

  /**
   * Create or get dashboard room
   */
  async getDashboardRoom(organizationId: string, dashboardId: string): Promise<string> {
    const roomId = `dashboard:${organizationId}:${dashboardId}`;
    
    if (!this.rooms.has(roomId)) {
      await this.createRoom({
        roomId,
        roomType: 'dashboard',
        organizationId,
        connectionCount: 0,
        createdAt: new Date(),
        lastActivity: new Date(),
        metadata: { dashboardId }
      });
    }

    return roomId;
  }

  /**
   * Create or get metrics room
   */
  async getMetricsRoom(organizationId: string, metricType: string): Promise<string> {
    const roomId = `metrics:${organizationId}:${metricType}`;
    
    if (!this.rooms.has(roomId)) {
      await this.createRoom({
        roomId,
        roomType: 'metrics',
        organizationId,
        connectionCount: 0,
        createdAt: new Date(),
        lastActivity: new Date(),
        metadata: { metricType }
      });
    }

    return roomId;
  }

  /**
   * Create collaborative room for shared sessions
   */
  async getCollaborativeRoom(organizationId: string, sessionId: string, isPrivate: boolean = false): Promise<string> {
    const roomId = `collab:${organizationId}:${sessionId}`;
    
    if (!this.rooms.has(roomId)) {
      await this.createRoom({
        roomId,
        roomType: 'collaborative',
        organizationId,
        connectionCount: 0,
        createdAt: new Date(),
        lastActivity: new Date(),
        metadata: { 
          isPrivate,
          permissions: isPrivate ? ['admin', 'manager'] : ['admin', 'manager', 'user']
        }
      });
    }

    return roomId;
  }

  /**
   * Join user to room with permission validation
   */
  async joinRoom(socket: Socket, roomId: string, userId: string, userRole: string): Promise<{
    success: boolean;
    error?: string;
    roomInfo?: RoomInfo;
  }> {
    try {
      const room = this.rooms.get(roomId);
      if (!room) {
        return { success: false, error: 'Room does not exist' };
      }

      // Validate permissions
      const hasPermission = await this.validateRoomPermission(roomId, userId, userRole);
      if (!hasPermission) {
        return { success: false, error: 'Insufficient permissions' };
      }

      // Check user room limits
      const userRoomCount = this.userRooms.get(userId)?.size || 0;
      const maxRooms = this.config.maxRoomsPerUser || 50;
      
      if (userRoomCount >= maxRooms) {
        return { success: false, error: 'Room limit exceeded' };
      }

      // Join socket to room
      await socket.join(roomId);

      // Update room info
      room.connectionCount++;
      room.lastActivity = new Date();

      // Track user rooms
      if (!this.userRooms.has(userId)) {
        this.userRooms.set(userId, new Set());
      }
      this.userRooms.get(userId)!.add(roomId);

      // Cache room state in Redis
      await this.cacheRoomState(roomId, room);

      this.logger.debug('User joined room', {
        userId,
        roomId,
        roomType: room.roomType,
        connectionCount: room.connectionCount
      });

      return { success: true, roomInfo: room };

    } catch (error) {
      this.logger.error('Failed to join room:', error);
      return { success: false, error: 'Internal error' };
    }
  }

  /**
   * Leave room
   */
  async leaveRoom(socket: Socket, roomId: string, userId: string): Promise<void> {
    try {
      const room = this.rooms.get(roomId);
      if (!room) return;

      // Leave socket room
      await socket.leave(roomId);

      // Update room info
      room.connectionCount = Math.max(0, room.connectionCount - 1);
      room.lastActivity = new Date();

      // Remove from user rooms tracking
      this.userRooms.get(userId)?.delete(roomId);
      if (this.userRooms.get(userId)?.size === 0) {
        this.userRooms.delete(userId);
      }

      // Cache updated state
      await this.cacheRoomState(roomId, room);

      // Schedule cleanup if room is empty
      if (room.connectionCount === 0) {
        setTimeout(() => this.cleanupEmptyRoom(roomId), 30000); // 30 second grace period
      }

      this.logger.debug('User left room', {
        userId,
        roomId,
        remainingConnections: room.connectionCount
      });

    } catch (error) {
      this.logger.error('Failed to leave room:', error);
    }
  }

  /**
   * Get room statistics
   */
  getRoomStats(): {
    totalRooms: number;
    roomsByType: Record<string, number>;
    roomsByOrganization: Record<string, number>;
    totalConnections: number;
    averageConnectionsPerRoom: number;
  } {
    const stats = {
      totalRooms: this.rooms.size,
      roomsByType: {} as Record<string, number>,
      roomsByOrganization: {} as Record<string, number>,
      totalConnections: 0,
      averageConnectionsPerRoom: 0
    };

    for (const room of this.rooms.values()) {
      // Count by type
      stats.roomsByType[room.roomType] = (stats.roomsByType[room.roomType] || 0) + 1;
      
      // Count by organization
      stats.roomsByOrganization[room.organizationId] = 
        (stats.roomsByOrganization[room.organizationId] || 0) + room.connectionCount;
      
      // Total connections
      stats.totalConnections += room.connectionCount;
    }

    stats.averageConnectionsPerRoom = stats.totalRooms > 0 
      ? stats.totalConnections / stats.totalRooms 
      : 0;

    return stats;
  }

  /**
   * Get active users in room
   */
  async getRoomUsers(roomId: string): Promise<string[]> {
    try {
      const users: string[] = [];
      for (const [userId, userRooms] of this.userRooms.entries()) {
        if (userRooms.has(roomId)) {
          users.push(userId);
        }
      }
      return users;
    } catch {
      return [];
    }
  }

  /**
   * Get user's active rooms
   */
  getUserRooms(userId: string): string[] {
    return Array.from(this.userRooms.get(userId) || []);
  }

  /**
   * Grant room permission to user
   */
  async grantRoomPermission(
    roomId: string, 
    userId: string, 
    permissions: string[], 
    grantedBy: string
  ): Promise<boolean> {
    try {
      if (!this.roomPermissions.has(roomId)) {
        this.roomPermissions.set(roomId, new Map());
      }

      const roomPerms = this.roomPermissions.get(roomId)!;
      roomPerms.set(userId, {
        roomId,
        userId,
        permissions,
        grantedAt: new Date(),
        grantedBy
      });

      // Store in database
      await this.storeRoomPermission(roomId, userId, permissions, grantedBy);

      this.logger.info('Room permission granted', {
        roomId,
        userId,
        permissions,
        grantedBy
      });

      return true;
    } catch (error) {
      this.logger.error('Failed to grant room permission:', error);
      return false;
    }
  }

  /**
   * Revoke room permission
   */
  async revokeRoomPermission(roomId: string, userId: string): Promise<boolean> {
    try {
      this.roomPermissions.get(roomId)?.delete(userId);

      // Remove from database
      await this.removeRoomPermission(roomId, userId);

      this.logger.info('Room permission revoked', { roomId, userId });
      return true;
    } catch (error) {
      this.logger.error('Failed to revoke room permission:', error);
      return false;
    }
  }

  /**
   * Private helper methods
   */
  private async createRoom(roomInfo: RoomInfo): Promise<void> {
    this.rooms.set(roomInfo.roomId, roomInfo);
    await this.cacheRoomState(roomInfo.roomId, roomInfo);

    this.logger.debug('Room created', {
      roomId: roomInfo.roomId,
      type: roomInfo.roomType,
      organizationId: roomInfo.organizationId
    });
  }

  private async validateRoomPermission(roomId: string, userId: string, userRole: string): Promise<boolean> {
    try {
      const room = this.rooms.get(roomId);
      if (!room) return false;

      // Admin users always have access
      if (userRole === 'admin') return true;

      // Check explicit room permissions
      const roomPerms = this.roomPermissions.get(roomId);
      if (roomPerms?.has(userId)) {
        return true;
      }

      // Check room type permissions
      switch (room.roomType) {
        case 'organization':
          // All users in org can join org rooms
          return true;
          
        case 'dashboard':
          // Users can join dashboard rooms (will be validated at dashboard level)
          return true;
          
        case 'metrics':
          // Users can join metrics rooms for their org
          return true;
          
        case 'collaborative':
          // Check if user role is in allowed permissions
          const allowedRoles = room.metadata.permissions || ['admin', 'manager'];
          return allowedRoles.includes(userRole);
          
        default:
          return false;
      }
    } catch {
      return false;
    }
  }

  private async cacheRoomState(roomId: string, room: RoomInfo): Promise<void> {
    try {
      const cacheKey = `room:${roomId}:state`;
      await this.redisManager.cacheMetrics(cacheKey, room, 300); // 5 minute TTL
    } catch (error) {
      this.logger.warn('Failed to cache room state:', error);
    }
  }

  private async storeRoomPermission(
    roomId: string, 
    userId: string, 
    permissions: string[], 
    grantedBy: string
  ): Promise<void> {
    try {
      const query = `
        INSERT INTO room_permissions (room_id, user_id, permissions, granted_by, granted_at)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (room_id, user_id) 
        DO UPDATE SET permissions = $3, granted_by = $4, granted_at = $5
      `;
      
      await this.db.query(query, [
        roomId, 
        userId, 
        JSON.stringify(permissions), 
        grantedBy, 
        new Date()
      ]);
    } catch (error) {
      this.logger.warn('Failed to store room permission in database:', error);
      // Don't throw - we can continue with in-memory permissions
    }
  }

  private async removeRoomPermission(roomId: string, userId: string): Promise<void> {
    try {
      const query = 'DELETE FROM room_permissions WHERE room_id = $1 AND user_id = $2';
      await this.db.query(query, [roomId, userId]);
    } catch (error) {
      this.logger.warn('Failed to remove room permission from database:', error);
    }
  }

  private startCleanupService(): void {
    this.cleanupInterval = setInterval(() => {
      this.performRoomCleanup();
    }, this.config.cleanupInterval || 60000); // Default 1 minute
  }

  private performRoomCleanup(): void {
    const now = Date.now();
    const roomTtl = this.config.roomTtl || 300000; // Default 5 minutes

    for (const [roomId, room] of this.rooms.entries()) {
      // Clean up empty rooms that have been inactive
      if (room.connectionCount === 0 && 
          now - room.lastActivity.getTime() > roomTtl) {
        this.cleanupEmptyRoom(roomId);
      }
    }
  }

  private async cleanupEmptyRoom(roomId: string): Promise<void> {
    try {
      const room = this.rooms.get(roomId);
      if (!room || room.connectionCount > 0) return;

      // Remove room
      this.rooms.delete(roomId);
      this.roomPermissions.delete(roomId);

      // Remove from Redis
      const cacheKey = `room:${roomId}:state`;
      await this.redisManager.client.del(cacheKey);

      this.logger.debug('Empty room cleaned up', { roomId, roomType: room.roomType });

    } catch (error) {
      this.logger.error('Failed to cleanup room:', error);
    }
  }

  /**
   * Shutdown cleanup
   */
  async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Clear all rooms
    this.rooms.clear();
    this.roomPermissions.clear();
    this.userRooms.clear();

    this.logger.info('Room Manager shutdown complete');
  }
}