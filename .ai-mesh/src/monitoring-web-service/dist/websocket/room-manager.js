"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomManager = void 0;
class RoomManager {
    db;
    redisManager;
    logger;
    config;
    rooms = new Map();
    roomPermissions = new Map();
    userRooms = new Map();
    cleanupInterval;
    constructor(db, redisManager, logger, config = {}) {
        this.db = db;
        this.redisManager = redisManager;
        this.logger = logger;
        this.config = config;
        this.startCleanupService();
    }
    async getOrganizationRoom(organizationId) {
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
    async getDashboardRoom(organizationId, dashboardId) {
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
    async getMetricsRoom(organizationId, metricType) {
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
    async getCollaborativeRoom(organizationId, sessionId, isPrivate = false) {
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
    async joinRoom(socket, roomId, userId, userRole) {
        try {
            const room = this.rooms.get(roomId);
            if (!room) {
                return { success: false, error: 'Room does not exist' };
            }
            const hasPermission = await this.validateRoomPermission(roomId, userId, userRole);
            if (!hasPermission) {
                return { success: false, error: 'Insufficient permissions' };
            }
            const userRoomCount = this.userRooms.get(userId)?.size || 0;
            const maxRooms = this.config.maxRoomsPerUser || 50;
            if (userRoomCount >= maxRooms) {
                return { success: false, error: 'Room limit exceeded' };
            }
            await socket.join(roomId);
            room.connectionCount++;
            room.lastActivity = new Date();
            if (!this.userRooms.has(userId)) {
                this.userRooms.set(userId, new Set());
            }
            this.userRooms.get(userId).add(roomId);
            await this.cacheRoomState(roomId, room);
            this.logger.debug('User joined room', {
                userId,
                roomId,
                roomType: room.roomType,
                connectionCount: room.connectionCount
            });
            return { success: true, roomInfo: room };
        }
        catch (error) {
            this.logger.error('Failed to join room:', error);
            return { success: false, error: 'Internal error' };
        }
    }
    async leaveRoom(socket, roomId, userId) {
        try {
            const room = this.rooms.get(roomId);
            if (!room)
                return;
            await socket.leave(roomId);
            room.connectionCount = Math.max(0, room.connectionCount - 1);
            room.lastActivity = new Date();
            this.userRooms.get(userId)?.delete(roomId);
            if (this.userRooms.get(userId)?.size === 0) {
                this.userRooms.delete(userId);
            }
            await this.cacheRoomState(roomId, room);
            if (room.connectionCount === 0) {
                setTimeout(() => this.cleanupEmptyRoom(roomId), 30000);
            }
            this.logger.debug('User left room', {
                userId,
                roomId,
                remainingConnections: room.connectionCount
            });
        }
        catch (error) {
            this.logger.error('Failed to leave room:', error);
        }
    }
    getRoomStats() {
        const stats = {
            totalRooms: this.rooms.size,
            roomsByType: {},
            roomsByOrganization: {},
            totalConnections: 0,
            averageConnectionsPerRoom: 0
        };
        for (const room of this.rooms.values()) {
            stats.roomsByType[room.roomType] = (stats.roomsByType[room.roomType] || 0) + 1;
            stats.roomsByOrganization[room.organizationId] =
                (stats.roomsByOrganization[room.organizationId] || 0) + room.connectionCount;
            stats.totalConnections += room.connectionCount;
        }
        stats.averageConnectionsPerRoom = stats.totalRooms > 0
            ? stats.totalConnections / stats.totalRooms
            : 0;
        return stats;
    }
    async getRoomUsers(roomId) {
        try {
            const users = [];
            for (const [userId, userRooms] of this.userRooms.entries()) {
                if (userRooms.has(roomId)) {
                    users.push(userId);
                }
            }
            return users;
        }
        catch {
            return [];
        }
    }
    getUserRooms(userId) {
        return Array.from(this.userRooms.get(userId) || []);
    }
    async grantRoomPermission(roomId, userId, permissions, grantedBy) {
        try {
            if (!this.roomPermissions.has(roomId)) {
                this.roomPermissions.set(roomId, new Map());
            }
            const roomPerms = this.roomPermissions.get(roomId);
            roomPerms.set(userId, {
                roomId,
                userId,
                permissions,
                grantedAt: new Date(),
                grantedBy
            });
            await this.storeRoomPermission(roomId, userId, permissions, grantedBy);
            this.logger.info('Room permission granted', {
                roomId,
                userId,
                permissions,
                grantedBy
            });
            return true;
        }
        catch (error) {
            this.logger.error('Failed to grant room permission:', error);
            return false;
        }
    }
    async revokeRoomPermission(roomId, userId) {
        try {
            this.roomPermissions.get(roomId)?.delete(userId);
            await this.removeRoomPermission(roomId, userId);
            this.logger.info('Room permission revoked', { roomId, userId });
            return true;
        }
        catch (error) {
            this.logger.error('Failed to revoke room permission:', error);
            return false;
        }
    }
    async createRoom(roomInfo) {
        this.rooms.set(roomInfo.roomId, roomInfo);
        await this.cacheRoomState(roomInfo.roomId, roomInfo);
        this.logger.debug('Room created', {
            roomId: roomInfo.roomId,
            type: roomInfo.roomType,
            organizationId: roomInfo.organizationId
        });
    }
    async validateRoomPermission(roomId, userId, userRole) {
        try {
            const room = this.rooms.get(roomId);
            if (!room)
                return false;
            if (userRole === 'admin')
                return true;
            const roomPerms = this.roomPermissions.get(roomId);
            if (roomPerms?.has(userId)) {
                return true;
            }
            switch (room.roomType) {
                case 'organization':
                    return true;
                case 'dashboard':
                    return true;
                case 'metrics':
                    return true;
                case 'collaborative':
                    const allowedRoles = room.metadata.permissions || ['admin', 'manager'];
                    return allowedRoles.includes(userRole);
                default:
                    return false;
            }
        }
        catch {
            return false;
        }
    }
    async cacheRoomState(roomId, room) {
        try {
            const cacheKey = `room:${roomId}:state`;
            await this.redisManager.cacheMetrics(cacheKey, room, 300);
        }
        catch (error) {
            this.logger.warn('Failed to cache room state:', error);
        }
    }
    async storeRoomPermission(roomId, userId, permissions, grantedBy) {
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
        }
        catch (error) {
            this.logger.warn('Failed to store room permission in database:', error);
        }
    }
    async removeRoomPermission(roomId, userId) {
        try {
            const query = 'DELETE FROM room_permissions WHERE room_id = $1 AND user_id = $2';
            await this.db.query(query, [roomId, userId]);
        }
        catch (error) {
            this.logger.warn('Failed to remove room permission from database:', error);
        }
    }
    startCleanupService() {
        this.cleanupInterval = setInterval(() => {
            this.performRoomCleanup();
        }, this.config.cleanupInterval || 60000);
    }
    performRoomCleanup() {
        const now = Date.now();
        const roomTtl = this.config.roomTtl || 300000;
        for (const [roomId, room] of this.rooms.entries()) {
            if (room.connectionCount === 0 &&
                now - room.lastActivity.getTime() > roomTtl) {
                this.cleanupEmptyRoom(roomId);
            }
        }
    }
    async cleanupEmptyRoom(roomId) {
        try {
            const room = this.rooms.get(roomId);
            if (!room || room.connectionCount > 0)
                return;
            this.rooms.delete(roomId);
            this.roomPermissions.delete(roomId);
            const cacheKey = `room:${roomId}:state`;
            await this.redisManager.client.del(cacheKey);
            this.logger.debug('Empty room cleaned up', { roomId, roomType: room.roomType });
        }
        catch (error) {
            this.logger.error('Failed to cleanup room:', error);
        }
    }
    async shutdown() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.rooms.clear();
        this.roomPermissions.clear();
        this.userRooms.clear();
        this.logger.info('Room Manager shutdown complete');
    }
}
exports.RoomManager = RoomManager;
//# sourceMappingURL=room-manager.js.map