import { EventPublisher } from '../events/event-publisher';
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
        workingHours?: {
            start: string;
            end: string;
        };
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
    period: {
        start: Date;
        end: Date;
    };
    averageOnlineTime: number;
    peakOnlineHours: Record<string, number>;
    deviceBreakdown: Record<string, number>;
    statusDistribution: Record<PresenceStatus, number>;
    collaborationReadiness: number;
}
export declare class PresenceManager extends EventEmitter {
    private eventPublisher;
    private redisManager;
    private db;
    private logger;
    private config;
    private userPresences;
    private connectionMapping;
    private organizationPresence;
    private presenceHistory;
    private idleTimers;
    constructor(eventPublisher: EventPublisher, redisManager: RedisManager, db: DatabaseConnection, logger: winston.Logger, config: {
        idleTimeout: number;
        awayTimeout: number;
        offlineTimeout: number;
        heartbeatInterval: number;
        historyRetention: number;
        enableAnalytics: boolean;
    });
    setUserOnline(userId: string, userName: string, organizationId: string, connectionInfo: {
        socketId: string;
        ipAddress: string;
        userAgent: string;
        device?: Partial<Connection['device']>;
    }): Promise<{
        success: boolean;
        presence?: UserPresence;
    }>;
    updateUserActivity(socketId: string): Promise<void>;
    setUserOffline(socketId: string, reason?: string): Promise<void>;
    setUserStatus(userId: string, status: PresenceStatus, customMessage?: string): Promise<{
        success: boolean;
        presence?: UserPresence;
    }>;
    getUserPresence(userId: string): UserPresence | null;
    getTeamPresence(organizationId: string, teamId?: string): TeamPresence;
    getAvailableUsers(organizationId: string): UserPresence[];
    getPresenceAnalytics(organizationId: string, period?: {
        start: Date;
        end: Date;
    }): Promise<PresenceAnalytics | null>;
    private setIdleTimer;
    private clearIdleTimer;
    private handleUserIdle;
    private handleUserAway;
    private handleUserAutoOffline;
    private publishPresenceUpdate;
    private recordPresenceUpdate;
    private cachePresence;
    private loadPresenceFromCache;
    private detectDeviceType;
    private detectOS;
    private detectBrowser;
    private generateConnectionId;
    private calculateAnalytics;
    private calculateDeviceBreakdown;
    private startBackgroundServices;
    private cleanupStaleConnections;
    private syncPresenceCache;
    shutdown(): Promise<void>;
}
//# sourceMappingURL=presence-manager.d.ts.map