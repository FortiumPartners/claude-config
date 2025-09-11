import { Socket } from 'socket.io';
import { ExtendedError } from 'socket.io/dist/namespace';
import { DatabaseConnection } from '../database/connection';
import { RedisManager } from '../config/redis.config';
import * as winston from 'winston';
export interface AuthenticatedSocket extends Socket {
    user: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        role: string;
        organizationId: string;
        organizationName: string;
        permissions: string[];
        sessionId: string;
        lastActivity: Date;
    };
    connectionFingerprint: string;
    rateLimitInfo: {
        requestCount: number;
        resetTime: Date;
        isThrottled: boolean;
    };
}
export interface AuthConfig {
    jwtSecret: string;
    jwtRefreshSecret: string;
    sessionTtl: number;
    rateLimitWindow: number;
    rateLimitMaxRequests: number;
    connectionTimeout: number;
    maxConnectionsPerUser: number;
    enableConnectionFingerprinting: boolean;
    enableAuditLogging: boolean;
}
export interface ConnectionAttempt {
    ipAddress: string;
    userAgent: string;
    timestamp: Date;
    userId?: string;
    success: boolean;
    reason?: string;
    fingerprint: string;
}
export declare class WebSocketAuthMiddleware {
    private db;
    private redisManager;
    private logger;
    private config;
    private connectionAttempts;
    private rateLimitCache;
    private bannedIPs;
    private auditLog;
    constructor(db: DatabaseConnection, redisManager: RedisManager, logger: winston.Logger, config: AuthConfig);
    authenticate(): (socket: Socket, next: (err?: ExtendedError) => void) => Promise<void>;
    authorizeRequest(requiredPermissions?: string[]): (socket: AuthenticatedSocket, data: any, next: Function) => Promise<void>;
    private extractToken;
    private verifyToken;
    private getUserDetails;
    private getUserConnectionCount;
    private createOrUpdateSession;
    private updateSessionActivity;
    private isRateLimited;
    private updateRateLimit;
    private checkPermissions;
    private generateConnectionFingerprint;
    private getClientIP;
    private logConnectionAttempt;
    private cleanupConnectionAttempts;
    getConnectionStats(): {
        totalAttempts: number;
        successfulAttempts: number;
        failedAttempts: number;
        bannedIPs: number;
        recentFailures: number;
    };
    banIP(ipAddress: string): void;
    unbanIP(ipAddress: string): void;
    cleanupSession(socket: AuthenticatedSocket): Promise<void>;
}
//# sourceMappingURL=auth-middleware.d.ts.map