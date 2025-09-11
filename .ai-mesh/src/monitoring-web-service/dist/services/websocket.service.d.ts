import WebSocket from 'ws';
import { IncomingMessage } from 'http';
import { DatabaseConnection } from '../database/connection';
import * as winston from 'winston';
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
export declare class WebSocketService extends EventEmitter {
    private db;
    private logger;
    private jwtSecret;
    private connections;
    private subscriptions;
    private mcpServerService;
    private compatibilityService;
    private heartbeatInterval;
    constructor(db: DatabaseConnection, logger: winston.Logger, jwtSecret: string);
    handleConnection(ws: WebSocket, request: IncomingMessage): Promise<void>;
    private setupWebSocketHandlers;
    private handleWebSocketMessage;
    private handleMcpRequest;
    private handleSubscription;
    private handleSubscribe;
    private handleUnsubscribe;
    private handleListSubscriptions;
    broadcastEvent(eventType: string, data: any, filters?: SubscriptionFilter): Promise<void>;
    private sendMessage;
    private sendError;
    private handleConnectionClose;
    private authenticateConnection;
    private validateSubscriptionPermissions;
    private isAdminUser;
    private isSystemUser;
    private matchesFilter;
    private isLegacyRequest;
    private generateConnectionId;
    private cleanupStaleConnections;
    getConnectionStats(): any;
    shutdown(): Promise<void>;
}
//# sourceMappingURL=websocket.service.d.ts.map