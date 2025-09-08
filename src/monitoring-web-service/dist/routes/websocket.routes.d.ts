import { Server } from 'http';
import { DatabaseConnection } from '../database/connection';
import * as winston from 'winston';
export interface WebSocketServerConfig {
    port?: number;
    path?: string;
    maxConnections?: number;
    heartbeatInterval?: number;
    jwtSecret: string;
}
export declare class WebSocketManager {
    private httpServer;
    private db;
    private logger;
    private config;
    private wsServer;
    private wsService;
    private connectionCount;
    constructor(httpServer: Server, db: DatabaseConnection, logger: winston.Logger, config: WebSocketServerConfig);
    private initializeWebSocketServer;
    private setupEventHandlers;
    broadcastMetricsUpdate(organizationId: string, metricsData: any): Promise<void>;
    broadcastDashboardUpdate(organizationId: string, dashboardData: any): Promise<void>;
    broadcastProductivityAlert(organizationId: string, alertData: any): Promise<void>;
    broadcastAgentEvent(organizationId: string, agentData: any): Promise<void>;
    getStats(): any;
    shutdown(): Promise<void>;
}
export declare function createWebSocketRoutes(wsManager: WebSocketManager, logger: winston.Logger): any;
export declare function createWebSocketMiddleware(wsManager: WebSocketManager): {
    broadcastMetricsMiddleware: (req: any, res: any, next: any) => void;
    broadcastDashboardMiddleware: (req: any, res: any, next: any) => void;
};
export declare function setupWebSocketIntegration(httpServer: Server, db: DatabaseConnection, logger: winston.Logger, config: WebSocketServerConfig): {
    wsManager: WebSocketManager;
    wsRoutes: any;
    wsMiddleware: any;
};
//# sourceMappingURL=websocket.routes.d.ts.map