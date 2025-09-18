/**
 * WebSocket Authentication Middleware - Sprint 5 Task 5.1
 * Advanced authentication and authorization for WebSocket connections
 * 
 * Features:
 * - JWT token validation with refresh support
 * - Multi-tenant authorization
 * - Rate limiting and connection throttling
 * - Security audit logging
 * - Session management with Redis
 * - Connection fingerprinting
 */

import { Socket } from 'socket.io';
import { ExtendedError } from 'socket.io/dist/namespace';
import { DatabaseConnection } from '../database/connection';
import { RedisManager } from '../config/redis.config';
import * as winston from 'winston';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';

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

export class WebSocketAuthMiddleware {
  private connectionAttempts: Map<string, ConnectionAttempt[]> = new Map();
  private rateLimitCache: Map<string, { count: number; resetTime: Date }> = new Map();
  private bannedIPs: Set<string> = new Set();
  private auditLog: ConnectionAttempt[] = [];

  constructor(
    private db: DatabaseConnection,
    private redisManager: RedisManager,
    private logger: winston.Logger,
    private config: AuthConfig
  ) {
    // Clean up old connection attempts periodically
    setInterval(() => this.cleanupConnectionAttempts(), 300000); // 5 minutes
  }

  /**
   * Main authentication middleware for Socket.io
   */
  authenticate() {
    return async (socket: Socket, next: (err?: ExtendedError) => void) => {
      try {
        const startTime = Date.now();

        // Extract connection info
        const ipAddress = this.getClientIP(socket);
        const userAgent = socket.handshake.headers['user-agent'] || 'unknown';
        const fingerprint = this.generateConnectionFingerprint(socket);

        // Check IP ban status
        if (this.bannedIPs.has(ipAddress)) {
          await this.logConnectionAttempt({
            ipAddress,
            userAgent,
            timestamp: new Date(),
            success: false,
            reason: 'IP_BANNED',
            fingerprint
          });
          
          return next(new Error('Access denied'));
        }

        // Check rate limiting
        if (await this.isRateLimited(ipAddress)) {
          await this.logConnectionAttempt({
            ipAddress,
            userAgent,
            timestamp: new Date(),
            success: false,
            reason: 'RATE_LIMITED',
            fingerprint
          });
          
          return next(new Error('Rate limit exceeded'));
        }

        // Extract and validate token
        const token = this.extractToken(socket);
        if (!token) {
          await this.logConnectionAttempt({
            ipAddress,
            userAgent,
            timestamp: new Date(),
            success: false,
            reason: 'NO_TOKEN',
            fingerprint
          });
          
          return next(new Error('Authentication token required'));
        }

        // Verify JWT token
        const authResult = await this.verifyToken(token);
        if (!authResult.success) {
          await this.logConnectionAttempt({
            ipAddress,
            userAgent,
            timestamp: new Date(),
            success: false,
            reason: authResult.reason || 'INVALID_TOKEN',
            fingerprint
          });
          
          return next(new Error('Invalid authentication token'));
        }

        const { payload } = authResult;

        // Get user details from database
        const userDetails = await this.getUserDetails(payload.user_id);
        if (!userDetails) {
          await this.logConnectionAttempt({
            ipAddress,
            userAgent,
            timestamp: new Date(),
            userId: payload.user_id,
            success: false,
            reason: 'USER_NOT_FOUND',
            fingerprint
          });
          
          return next(new Error('User not found'));
        }

        // Check if user and organization are active
        if (!userDetails.isActive || !userDetails.organizationActive) {
          await this.logConnectionAttempt({
            ipAddress,
            userAgent,
            timestamp: new Date(),
            userId: payload.user_id,
            success: false,
            reason: 'USER_INACTIVE',
            fingerprint
          });
          
          return next(new Error('User account is inactive'));
        }

        // Check user connection limit
        const connectionCount = await this.getUserConnectionCount(userDetails.id);
        if (connectionCount >= this.config.maxConnectionsPerUser) {
          await this.logConnectionAttempt({
            ipAddress,
            userAgent,
            timestamp: new Date(),
            userId: userDetails.id,
            success: false,
            reason: 'CONNECTION_LIMIT',
            fingerprint
          });
          
          return next(new Error('Maximum connections exceeded'));
        }

        // Create or update session
        const sessionId = await this.createOrUpdateSession(userDetails.id, {
          ipAddress,
          userAgent,
          fingerprint,
          socketId: socket.id
        });

        // Attach authenticated user data to socket
        const authenticatedSocket = socket as AuthenticatedSocket;
        authenticatedSocket.user = {
          id: userDetails.id,
          email: userDetails.email,
          firstName: userDetails.firstName,
          lastName: userDetails.lastName,
          role: userDetails.role,
          organizationId: userDetails.organizationId,
          organizationName: userDetails.organizationName,
          permissions: userDetails.permissions,
          sessionId,
          lastActivity: new Date()
        };

        authenticatedSocket.connectionFingerprint = fingerprint;
        authenticatedSocket.rateLimitInfo = {
          requestCount: 0,
          resetTime: new Date(Date.now() + this.config.rateLimitWindow),
          isThrottled: false
        };

        // Log successful connection
        await this.logConnectionAttempt({
          ipAddress,
          userAgent,
          timestamp: new Date(),
          userId: userDetails.id,
          success: true,
          fingerprint
        });

        const authTime = Date.now() - startTime;
        this.logger.info('WebSocket authentication successful', {
          userId: userDetails.id,
          organizationId: userDetails.organizationId,
          sessionId,
          authTime,
          ipAddress,
          fingerprint
        });

        next();

      } catch (error) {
        this.logger.error('WebSocket authentication error:', error);
        next(new Error('Authentication failed'));
      }
    };
  }

  /**
   * Middleware for ongoing request authorization
   */
  authorizeRequest(requiredPermissions?: string[]) {
    return async (socket: AuthenticatedSocket, data: any, next: Function) => {
      try {
        // Update rate limiting
        if (this.updateRateLimit(socket)) {
          socket.emit('error', { code: 'RATE_LIMITED', message: 'Request rate limit exceeded' });
          return;
        }

        // Update last activity
        socket.user.lastActivity = new Date();
        await this.updateSessionActivity(socket.user.sessionId);

        // Check permissions if specified
        if (requiredPermissions && requiredPermissions.length > 0) {
          const hasPermission = this.checkPermissions(socket.user.permissions, requiredPermissions);
          if (!hasPermission) {
            socket.emit('error', { code: 'INSUFFICIENT_PERMISSIONS', message: 'Insufficient permissions' });
            
            this.logger.warn('Permission denied', {
              userId: socket.user.id,
              requiredPermissions,
              userPermissions: socket.user.permissions
            });
            return;
          }
        }

        next();

      } catch (error) {
        this.logger.error('Request authorization error:', error);
        socket.emit('error', { code: 'AUTHORIZATION_ERROR', message: 'Authorization failed' });
      }
    };
  }

  /**
   * Extract authentication token from socket handshake
   */
  private extractToken(socket: Socket): string | null {
    // Try auth header first
    const authHeader = socket.handshake.auth?.token;
    if (authHeader) {
      return authHeader;
    }

    // Try query parameter
    const queryToken = socket.handshake.query?.token;
    if (typeof queryToken === 'string') {
      return queryToken;
    }

    // Try authorization header
    const authorization = socket.handshake.headers.authorization;
    if (authorization && authorization.startsWith('Bearer ')) {
      return authorization.slice(7);
    }

    return null;
  }

  /**
   * Verify JWT token and return payload
   */
  private async verifyToken(token: string): Promise<{
    success: boolean;
    payload?: any;
    reason?: string;
  }> {
    try {
      // First try with regular JWT secret
      try {
        const payload = jwt.verify(token, this.config.jwtSecret);
        return { success: true, payload };
      } catch (primaryError) {
        // If primary verification fails, try refresh token secret
        try {
          const payload = jwt.verify(token, this.config.jwtRefreshSecret);
          
          // Refresh tokens should only be used for token refresh, not WebSocket auth
          if ((payload as any).type === 'refresh') {
            return { success: false, reason: 'REFRESH_TOKEN_NOT_ALLOWED' };
          }
          
          return { success: true, payload };
        } catch (refreshError) {
          return { success: false, reason: 'INVALID_TOKEN' };
        }
      }
    } catch (error) {
      return { success: false, reason: 'TOKEN_VERIFICATION_ERROR' };
    }
  }

  /**
   * Get user details from database
   */
  private async getUserDetails(userId: string): Promise<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    organizationId: string;
    organizationName: string;
    permissions: string[];
    isActive: boolean;
    organizationActive: boolean;
  } | null> {
    try {
      const query = `
        SELECT 
          u.id,
          u.email,
          u.first_name as "firstName",
          u.last_name as "lastName",
          u.role,
          u.is_active as "isActive",
          u.permissions,
          t.id as "organizationId",
          t.name as "organizationName",
          t.is_active as "organizationActive"
        FROM users u
        JOIN tenants t ON u.organization_id = t.id
        WHERE u.id = $1
      `;
      
      const result = await this.db.query(query, [userId]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const user = result.rows[0];
      return {
        ...user,
        permissions: user.permissions || []
      };

    } catch (error) {
      this.logger.error('Error fetching user details:', error);
      return null;
    }
  }

  /**
   * Get current connection count for user
   */
  private async getUserConnectionCount(userId: string): Promise<number> {
    try {
      const cacheKey = `user:${userId}:connections`;
      const cached = await this.redisManager.client.get(cacheKey);
      return cached ? parseInt(cached) : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Create or update user session
   */
  private async createOrUpdateSession(userId: string, connectionInfo: {
    ipAddress: string;
    userAgent: string;
    fingerprint: string;
    socketId: string;
  }): Promise<string> {
    try {
      const sessionId = crypto.randomUUID();
      const sessionKey = `session:${sessionId}`;
      const userSessionsKey = `user:${userId}:sessions`;

      const sessionData = {
        userId,
        sessionId,
        ...connectionInfo,
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString()
      };

      // Store session data
      await this.redisManager.client.setex(sessionKey, this.config.sessionTtl, JSON.stringify(sessionData));

      // Add to user sessions list
      await this.redisManager.client.sadd(userSessionsKey, sessionId);
      await this.redisManager.client.expire(userSessionsKey, this.config.sessionTtl);

      // Update connection count
      const connectionCountKey = `user:${userId}:connections`;
      await this.redisManager.client.incr(connectionCountKey);
      await this.redisManager.client.expire(connectionCountKey, this.config.sessionTtl);

      return sessionId;

    } catch (error) {
      this.logger.error('Error creating session:', error);
      throw error;
    }
  }

  /**
   * Update session activity timestamp
   */
  private async updateSessionActivity(sessionId: string): Promise<void> {
    try {
      const sessionKey = `session:${sessionId}`;
      const sessionData = await this.redisManager.client.get(sessionKey);
      
      if (sessionData) {
        const parsed = JSON.parse(sessionData);
        parsed.lastActivity = new Date().toISOString();
        
        await this.redisManager.client.setex(sessionKey, this.config.sessionTtl, JSON.stringify(parsed));
      }
    } catch (error) {
      this.logger.warn('Error updating session activity:', error);
    }
  }

  /**
   * Check if IP is rate limited
   */
  private async isRateLimited(ipAddress: string): Promise<boolean> {
    try {
      const key = `rate_limit:${ipAddress}`;
      const current = await this.redisManager.client.get(key);
      
      if (!current) {
        await this.redisManager.client.setex(key, this.config.rateLimitWindow, '1');
        return false;
      }

      const count = parseInt(current);
      if (count >= this.config.rateLimitMaxRequests) {
        return true;
      }

      await this.redisManager.client.incr(key);
      return false;

    } catch (error) {
      this.logger.warn('Error checking rate limit:', error);
      return false; // Allow on error
    }
  }

  /**
   * Update rate limit for authenticated socket
   */
  private updateRateLimit(socket: AuthenticatedSocket): boolean {
    const now = new Date();
    
    if (now > socket.rateLimitInfo.resetTime) {
      // Reset rate limit window
      socket.rateLimitInfo.requestCount = 1;
      socket.rateLimitInfo.resetTime = new Date(now.getTime() + this.config.rateLimitWindow);
      socket.rateLimitInfo.isThrottled = false;
      return false;
    }

    socket.rateLimitInfo.requestCount++;
    
    if (socket.rateLimitInfo.requestCount > this.config.rateLimitMaxRequests) {
      socket.rateLimitInfo.isThrottled = true;
      return true;
    }

    return false;
  }

  /**
   * Check if user has required permissions
   */
  private checkPermissions(userPermissions: string[], requiredPermissions: string[]): boolean {
    // Admin users have all permissions
    if (userPermissions.includes('admin')) {
      return true;
    }

    // Check if user has all required permissions
    return requiredPermissions.every(permission => userPermissions.includes(permission));
  }

  /**
   * Generate connection fingerprint for security
   */
  private generateConnectionFingerprint(socket: Socket): string {
    const components = [
      socket.handshake.address,
      socket.handshake.headers['user-agent'] || '',
      socket.handshake.headers['accept-language'] || '',
      socket.handshake.headers['accept-encoding'] || '',
      socket.handshake.query.version || ''
    ].join('|');

    return crypto.createHash('sha256').update(components).digest('hex').substring(0, 16);
  }

  /**
   * Get client IP address with proxy support
   */
  private getClientIP(socket: Socket): string {
    return (
      socket.handshake.headers['x-forwarded-for'] as string ||
      socket.handshake.headers['x-real-ip'] as string ||
      socket.handshake.address ||
      'unknown'
    ).split(',')[0].trim();
  }

  /**
   * Log connection attempt for audit
   */
  private async logConnectionAttempt(attempt: ConnectionAttempt): Promise<void> {
    try {
      if (this.config.enableAuditLogging) {
        // Store in memory for quick access
        this.auditLog.push(attempt);
        
        // Limit memory usage
        if (this.auditLog.length > 1000) {
          this.auditLog.shift();
        }

        // Store in Redis for persistence
        const auditKey = `audit:websocket:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
        await this.redisManager.client.setex(auditKey, 86400, JSON.stringify(attempt)); // 24 hour TTL

        // Track failed attempts by IP
        if (!attempt.success) {
          const ipAttempts = this.connectionAttempts.get(attempt.ipAddress) || [];
          ipAttempts.push(attempt);
          this.connectionAttempts.set(attempt.ipAddress, ipAttempts);

          // Auto-ban IPs with too many failed attempts
          const recentFailures = ipAttempts.filter(
            a => !a.success && Date.now() - a.timestamp.getTime() < 300000 // 5 minutes
          );

          if (recentFailures.length >= 10) {
            this.bannedIPs.add(attempt.ipAddress);
            this.logger.warn('IP banned due to excessive failed attempts', {
              ipAddress: attempt.ipAddress,
              failureCount: recentFailures.length
            });

            // Auto-unban after 1 hour
            setTimeout(() => {
              this.bannedIPs.delete(attempt.ipAddress);
              this.logger.info('IP auto-unbanned', { ipAddress: attempt.ipAddress });
            }, 3600000);
          }
        }
      }

      // Log based on success/failure
      if (attempt.success) {
        this.logger.debug('WebSocket connection attempt', attempt);
      } else {
        this.logger.warn('Failed WebSocket connection attempt', attempt);
      }

    } catch (error) {
      this.logger.error('Error logging connection attempt:', error);
    }
  }

  /**
   * Clean up old connection attempts
   */
  private cleanupConnectionAttempts(): void {
    const cutoff = Date.now() - 3600000; // 1 hour ago
    
    for (const [ip, attempts] of this.connectionAttempts.entries()) {
      const recentAttempts = attempts.filter(a => a.timestamp.getTime() > cutoff);
      
      if (recentAttempts.length === 0) {
        this.connectionAttempts.delete(ip);
      } else {
        this.connectionAttempts.set(ip, recentAttempts);
      }
    }
  }

  /**
   * Get connection statistics for monitoring
   */
  getConnectionStats(): {
    totalAttempts: number;
    successfulAttempts: number;
    failedAttempts: number;
    bannedIPs: number;
    recentFailures: number;
  } {
    const totalAttempts = this.auditLog.length;
    const successfulAttempts = this.auditLog.filter(a => a.success).length;
    const failedAttempts = totalAttempts - successfulAttempts;
    const bannedIPs = this.bannedIPs.size;
    
    const recentCutoff = Date.now() - 300000; // 5 minutes
    const recentFailures = this.auditLog.filter(
      a => !a.success && a.timestamp.getTime() > recentCutoff
    ).length;

    return {
      totalAttempts,
      successfulAttempts,
      failedAttempts,
      bannedIPs,
      recentFailures
    };
  }

  /**
   * Manually ban/unban IP address
   */
  banIP(ipAddress: string): void {
    this.bannedIPs.add(ipAddress);
    this.logger.info('IP manually banned', { ipAddress });
  }

  unbanIP(ipAddress: string): void {
    this.bannedIPs.delete(ipAddress);
    this.logger.info('IP manually unbanned', { ipAddress });
  }

  /**
   * Clean session on socket disconnect
   */
  async cleanupSession(socket: AuthenticatedSocket): Promise<void> {
    try {
      if (socket.user?.sessionId) {
        const sessionKey = `session:${socket.user.sessionId}`;
        const userSessionsKey = `user:${socket.user.id}:sessions`;
        const connectionCountKey = `user:${socket.user.id}:connections`;

        // Remove session
        await this.redisManager.client.del(sessionKey);
        await this.redisManager.client.srem(userSessionsKey, socket.user.sessionId);
        await this.redisManager.client.decr(connectionCountKey);

        this.logger.debug('Session cleaned up', {
          userId: socket.user.id,
          sessionId: socket.user.sessionId
        });
      }
    } catch (error) {
      this.logger.error('Error cleaning up session:', error);
    }
  }
}