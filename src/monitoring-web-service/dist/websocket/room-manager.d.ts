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
export declare class RoomManager {
    private db;
    private redisManager;
    private logger;
    private config;
    private rooms;
    private roomPermissions;
    private userRooms;
    private cleanupInterval;
    constructor(db: DatabaseConnection, redisManager: RedisManager, logger: winston.Logger, config?: {
        cleanupInterval?: number;
        maxRoomsPerUser?: number;
        roomTtl?: number;
    });
    getOrganizationRoom(organizationId: string): Promise<string>;
    getDashboardRoom(organizationId: string, dashboardId: string): Promise<string>;
    getMetricsRoom(organizationId: string, metricType: string): Promise<string>;
    getCollaborativeRoom(organizationId: string, sessionId: string, isPrivate?: boolean): Promise<string>;
    joinRoom(socket: Socket, roomId: string, userId: string, userRole: string): Promise<{
        success: boolean;
        error?: string;
        roomInfo?: RoomInfo;
    }>;
    leaveRoom(socket: Socket, roomId: string, userId: string): Promise<void>;
    getRoomStats(): {
        totalRooms: number;
        roomsByType: Record<string, number>;
        roomsByOrganization: Record<string, number>;
        totalConnections: number;
        averageConnectionsPerRoom: number;
    };
    getRoomUsers(roomId: string): Promise<string[]>;
    getUserRooms(userId: string): string[];
    grantRoomPermission(roomId: string, userId: string, permissions: string[], grantedBy: string): Promise<boolean>;
    revokeRoomPermission(roomId: string, userId: string): Promise<boolean>;
    private createRoom;
    private validateRoomPermission;
    private cacheRoomState;
    private storeRoomPermission;
    private removeRoomPermission;
    private startCleanupService;
    private performRoomCleanup;
    private cleanupEmptyRoom;
    shutdown(): Promise<void>;
}
//# sourceMappingURL=room-manager.d.ts.map