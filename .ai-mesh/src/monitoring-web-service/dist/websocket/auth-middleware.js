"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketAuthMiddleware = void 0;
const jwt = __importStar(require("jsonwebtoken"));
const crypto = __importStar(require("crypto"));
class WebSocketAuthMiddleware {
    db;
    redisManager;
    logger;
    config;
    connectionAttempts = new Map();
    rateLimitCache = new Map();
    bannedIPs = new Set();
    auditLog = [];
    constructor(db, redisManager, logger, config) {
        this.db = db;
        this.redisManager = redisManager;
        this.logger = logger;
        this.config = config;
        setInterval(() => this.cleanupConnectionAttempts(), 300000);
    }
    authenticate() {
        return async (socket, next) => {
            try {
                const startTime = Date.now();
                const ipAddress = this.getClientIP(socket);
                const userAgent = socket.handshake.headers['user-agent'] || 'unknown';
                const fingerprint = this.generateConnectionFingerprint(socket);
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
                const sessionId = await this.createOrUpdateSession(userDetails.id, {
                    ipAddress,
                    userAgent,
                    fingerprint,
                    socketId: socket.id
                });
                const authenticatedSocket = socket;
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
            }
            catch (error) {
                this.logger.error('WebSocket authentication error:', error);
                next(new Error('Authentication failed'));
            }
        };
    }
    authorizeRequest(requiredPermissions) {
        return async (socket, data, next) => {
            try {
                if (this.updateRateLimit(socket)) {
                    socket.emit('error', { code: 'RATE_LIMITED', message: 'Request rate limit exceeded' });
                    return;
                }
                socket.user.lastActivity = new Date();
                await this.updateSessionActivity(socket.user.sessionId);
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
            }
            catch (error) {
                this.logger.error('Request authorization error:', error);
                socket.emit('error', { code: 'AUTHORIZATION_ERROR', message: 'Authorization failed' });
            }
        };
    }
    extractToken(socket) {
        const authHeader = socket.handshake.auth?.token;
        if (authHeader) {
            return authHeader;
        }
        const queryToken = socket.handshake.query?.token;
        if (typeof queryToken === 'string') {
            return queryToken;
        }
        const authorization = socket.handshake.headers.authorization;
        if (authorization && authorization.startsWith('Bearer ')) {
            return authorization.slice(7);
        }
        return null;
    }
    async verifyToken(token) {
        try {
            try {
                const payload = jwt.verify(token, this.config.jwtSecret);
                return { success: true, payload };
            }
            catch (primaryError) {
                try {
                    const payload = jwt.verify(token, this.config.jwtRefreshSecret);
                    if (payload.type === 'refresh') {
                        return { success: false, reason: 'REFRESH_TOKEN_NOT_ALLOWED' };
                    }
                    return { success: true, payload };
                }
                catch (refreshError) {
                    return { success: false, reason: 'INVALID_TOKEN' };
                }
            }
        }
        catch (error) {
            return { success: false, reason: 'TOKEN_VERIFICATION_ERROR' };
        }
    }
    async getUserDetails(userId) {
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
        }
        catch (error) {
            this.logger.error('Error fetching user details:', error);
            return null;
        }
    }
    async getUserConnectionCount(userId) {
        try {
            const cacheKey = `user:${userId}:connections`;
            const cached = await this.redisManager.client.get(cacheKey);
            return cached ? parseInt(cached) : 0;
        }
        catch {
            return 0;
        }
    }
    async createOrUpdateSession(userId, connectionInfo) {
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
            await this.redisManager.client.setex(sessionKey, this.config.sessionTtl, JSON.stringify(sessionData));
            await this.redisManager.client.sadd(userSessionsKey, sessionId);
            await this.redisManager.client.expire(userSessionsKey, this.config.sessionTtl);
            const connectionCountKey = `user:${userId}:connections`;
            await this.redisManager.client.incr(connectionCountKey);
            await this.redisManager.client.expire(connectionCountKey, this.config.sessionTtl);
            return sessionId;
        }
        catch (error) {
            this.logger.error('Error creating session:', error);
            throw error;
        }
    }
    async updateSessionActivity(sessionId) {
        try {
            const sessionKey = `session:${sessionId}`;
            const sessionData = await this.redisManager.client.get(sessionKey);
            if (sessionData) {
                const parsed = JSON.parse(sessionData);
                parsed.lastActivity = new Date().toISOString();
                await this.redisManager.client.setex(sessionKey, this.config.sessionTtl, JSON.stringify(parsed));
            }
        }
        catch (error) {
            this.logger.warn('Error updating session activity:', error);
        }
    }
    async isRateLimited(ipAddress) {
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
        }
        catch (error) {
            this.logger.warn('Error checking rate limit:', error);
            return false;
        }
    }
    updateRateLimit(socket) {
        const now = new Date();
        if (now > socket.rateLimitInfo.resetTime) {
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
    checkPermissions(userPermissions, requiredPermissions) {
        if (userPermissions.includes('admin')) {
            return true;
        }
        return requiredPermissions.every(permission => userPermissions.includes(permission));
    }
    generateConnectionFingerprint(socket) {
        const components = [
            socket.handshake.address,
            socket.handshake.headers['user-agent'] || '',
            socket.handshake.headers['accept-language'] || '',
            socket.handshake.headers['accept-encoding'] || '',
            socket.handshake.query.version || ''
        ].join('|');
        return crypto.createHash('sha256').update(components).digest('hex').substring(0, 16);
    }
    getClientIP(socket) {
        return (socket.handshake.headers['x-forwarded-for'] ||
            socket.handshake.headers['x-real-ip'] ||
            socket.handshake.address ||
            'unknown').split(',')[0].trim();
    }
    async logConnectionAttempt(attempt) {
        try {
            if (this.config.enableAuditLogging) {
                this.auditLog.push(attempt);
                if (this.auditLog.length > 1000) {
                    this.auditLog.shift();
                }
                const auditKey = `audit:websocket:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
                await this.redisManager.client.setex(auditKey, 86400, JSON.stringify(attempt));
                if (!attempt.success) {
                    const ipAttempts = this.connectionAttempts.get(attempt.ipAddress) || [];
                    ipAttempts.push(attempt);
                    this.connectionAttempts.set(attempt.ipAddress, ipAttempts);
                    const recentFailures = ipAttempts.filter(a => !a.success && Date.now() - a.timestamp.getTime() < 300000);
                    if (recentFailures.length >= 10) {
                        this.bannedIPs.add(attempt.ipAddress);
                        this.logger.warn('IP banned due to excessive failed attempts', {
                            ipAddress: attempt.ipAddress,
                            failureCount: recentFailures.length
                        });
                        setTimeout(() => {
                            this.bannedIPs.delete(attempt.ipAddress);
                            this.logger.info('IP auto-unbanned', { ipAddress: attempt.ipAddress });
                        }, 3600000);
                    }
                }
            }
            if (attempt.success) {
                this.logger.debug('WebSocket connection attempt', attempt);
            }
            else {
                this.logger.warn('Failed WebSocket connection attempt', attempt);
            }
        }
        catch (error) {
            this.logger.error('Error logging connection attempt:', error);
        }
    }
    cleanupConnectionAttempts() {
        const cutoff = Date.now() - 3600000;
        for (const [ip, attempts] of this.connectionAttempts.entries()) {
            const recentAttempts = attempts.filter(a => a.timestamp.getTime() > cutoff);
            if (recentAttempts.length === 0) {
                this.connectionAttempts.delete(ip);
            }
            else {
                this.connectionAttempts.set(ip, recentAttempts);
            }
        }
    }
    getConnectionStats() {
        const totalAttempts = this.auditLog.length;
        const successfulAttempts = this.auditLog.filter(a => a.success).length;
        const failedAttempts = totalAttempts - successfulAttempts;
        const bannedIPs = this.bannedIPs.size;
        const recentCutoff = Date.now() - 300000;
        const recentFailures = this.auditLog.filter(a => !a.success && a.timestamp.getTime() > recentCutoff).length;
        return {
            totalAttempts,
            successfulAttempts,
            failedAttempts,
            bannedIPs,
            recentFailures
        };
    }
    banIP(ipAddress) {
        this.bannedIPs.add(ipAddress);
        this.logger.info('IP manually banned', { ipAddress });
    }
    unbanIP(ipAddress) {
        this.bannedIPs.delete(ipAddress);
        this.logger.info('IP manually unbanned', { ipAddress });
    }
    async cleanupSession(socket) {
        try {
            if (socket.user?.sessionId) {
                const sessionKey = `session:${socket.user.sessionId}`;
                const userSessionsKey = `user:${socket.user.id}:sessions`;
                const connectionCountKey = `user:${socket.user.id}:connections`;
                await this.redisManager.client.del(sessionKey);
                await this.redisManager.client.srem(userSessionsKey, socket.user.sessionId);
                await this.redisManager.client.decr(connectionCountKey);
                this.logger.debug('Session cleaned up', {
                    userId: socket.user.id,
                    sessionId: socket.user.sessionId
                });
            }
        }
        catch (error) {
            this.logger.error('Error cleaning up session:', error);
        }
    }
}
exports.WebSocketAuthMiddleware = WebSocketAuthMiddleware;
//# sourceMappingURL=auth-middleware.js.map