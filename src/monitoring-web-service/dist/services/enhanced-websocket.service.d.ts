import { Server as HttpServer } from 'http';
import { Socket } from 'socket.io';
import { RedisManager } from '../config/redis.config';
import { DatabaseConnection } from '../database/connection';
import * as winston from 'winston';
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
export declare class EnhancedWebSocketService extends EventEmitter {
    private httpServer;
    private redisManager;
    private db;
    private logger;
    private jwtSecret;
    private config;
    private io;
    private connections;
    private organizationRooms;
    private dashboardSessions;
    private heartbeatInterval;
    private performanceMetrics;
    private messageQueue;
    private batchProcessingInterval;
    constructor(httpServer: HttpServer, redisManager: RedisManager, db: DatabaseConnection, logger: winston.Logger, jwtSecret: string, config?: {
        cors?: any;
        maxConnections?: number;
        batchInterval?: number;
        heartbeatInterval?: number;
        performanceMonitoringInterval?: number;
    });
    private initializeSocketIO;
    private setupRedisAdapter;
    private setupEventHandlers;
    private handleNewConnection;
    private setupSocketHandlers;
    private handleJoinRoom;
    private handleLeaveRoom;
    private handleDashboardSubscription;
    private handleDashboardUnsubscription;
    private handleCollaborativeEvent;
    private handleMetricsSubscription;
    broadcastToOrganization(organizationId: string, eventName: string, data: any): Promise<void>;
    broadcastDashboardUpdate(dashboardId: string, updateData: any, options?: {
        batchable?: boolean;
        priority?: 'low' | 'medium' | 'high' | 'critical';
    }): Promise<void>;
    broadcastMetricsUpdate(organizationId: string, metricType: string, metricsData: any): Promise<void>;
    private joinOrganizationRoom;
    private handleDisconnection;
    private startBackgroundServices;
    private performHeartbeat;
    private processBatchedMessages;
    private updatePerformanceMetrics;
    private authenticateSocket;
    private validateRoomAccess;
    private validateDashboardAccess;
    private validateMetricsAccess;
    private updateOrganizationConnections;
    private getRoomActiveUsers;
    private getDashboardCurrentState;
    private storeCollaborativeEvent;
    private logBroadcastEvent;
    getPerformanceMetrics(): PerformanceMetrics;
    getConnectionStats(): any;
    shutdown(): Promise<void>;
}
//# sourceMappingURL=enhanced-websocket.service.d.ts.map