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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JWTService = exports.ROLE_PERMISSIONS = void 0;
const jwt = __importStar(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
exports.ROLE_PERMISSIONS = {
    owner: [
        { resource: '*', action: '*' },
    ],
    admin: [
        { resource: 'users', action: '*' },
        { resource: 'teams', action: '*' },
        { resource: 'metrics', action: '*' },
        { resource: 'organizations', action: 'read' },
        { resource: 'organizations', action: 'update' },
    ],
    manager: [
        { resource: 'teams', action: 'read' },
        { resource: 'teams', action: 'update', condition: 'team_lead' },
        { resource: 'metrics', action: 'read' },
        { resource: 'users', action: 'read', condition: 'same_team' },
        { resource: 'users', action: 'invite', condition: 'team_lead' },
    ],
    developer: [
        { resource: 'metrics', action: 'read', condition: 'own_or_team' },
        { resource: 'metrics', action: 'create', condition: 'own' },
        { resource: 'users', action: 'read', condition: 'own' },
        { resource: 'users', action: 'update', condition: 'own' },
    ],
    viewer: [
        { resource: 'metrics', action: 'read', condition: 'assigned_only' },
        { resource: 'users', action: 'read', condition: 'own' },
    ],
};
class JWTService {
    accessTokenSecret;
    refreshTokenSecret;
    accessTokenExpiry;
    refreshTokenExpiry;
    issuer;
    db;
    logger;
    constructor(db, logger) {
        this.accessTokenSecret = process.env.JWT_ACCESS_SECRET || this.generateSecret();
        this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET || this.generateSecret();
        this.accessTokenExpiry = process.env.JWT_ACCESS_EXPIRY || '15m';
        this.refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRY || '7d';
        this.issuer = process.env.JWT_ISSUER || 'fortium-metrics-service';
        this.db = db;
        this.logger = logger;
        if (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET) {
            this.logger.warn('Using default JWT secrets - this is not secure for production');
        }
    }
    generateSecret() {
        return crypto_1.default.randomBytes(64).toString('hex');
    }
    async generateTokenPair(payload) {
        const tokenFamily = crypto_1.default.randomUUID();
        const jti = crypto_1.default.randomUUID();
        const permissions = this.calculatePermissions(payload.role, payload.team_memberships);
        const accessPayload = {
            ...payload,
            permissions,
            jti,
        };
        const refreshPayload = {
            user_id: payload.user_id,
            organization_id: payload.organization_id,
            token_family: tokenFamily,
            jti,
        };
        const access_token = jwt.sign(accessPayload, this.accessTokenSecret, {
            expiresIn: this.accessTokenExpiry,
            issuer: this.issuer,
            audience: 'fortium-metrics-api',
        });
        const refresh_token = jwt.sign(refreshPayload, this.refreshTokenSecret, {
            expiresIn: this.refreshTokenExpiry,
            issuer: this.issuer,
            audience: 'fortium-metrics-refresh',
        });
        await this.storeRefreshToken({
            jti,
            user_id: payload.user_id,
            organization_id: payload.organization_id,
            token_family: tokenFamily,
            expires_at: new Date(Date.now() + this.parseExpiry(this.refreshTokenExpiry)),
        });
        const decoded = jwt.decode(access_token);
        const expires_in = decoded.exp - Math.floor(Date.now() / 1000);
        this.logger.info('Token pair generated', {
            user_id: payload.user_id,
            organization_id: payload.organization_id,
            role: payload.role,
            expires_in,
            jti
        });
        return {
            access_token,
            refresh_token,
            expires_in,
            token_type: 'Bearer',
        };
    }
    async verifyAccessToken(token) {
        try {
            const payload = jwt.verify(token, this.accessTokenSecret, {
                issuer: this.issuer,
                audience: 'fortium-metrics-api',
            });
            const isBlacklisted = await this.isTokenBlacklisted(payload.jti);
            if (isBlacklisted) {
                throw new Error('Token has been revoked');
            }
            return payload;
        }
        catch (error) {
            this.logger.warn('Access token verification failed', { error: error instanceof Error ? error.message : 'Unknown error' });
            throw new Error('Invalid or expired access token');
        }
    }
    async verifyRefreshToken(token) {
        try {
            const payload = jwt.verify(token, this.refreshTokenSecret, {
                issuer: this.issuer,
                audience: 'fortium-metrics-refresh',
            });
            const tokenRecord = await this.getRefreshToken(payload.jti);
            if (!tokenRecord) {
                throw new Error('Refresh token not found or expired');
            }
            return payload;
        }
        catch (error) {
            this.logger.warn('Refresh token verification failed', { error: error instanceof Error ? error.message : 'Unknown error' });
            throw new Error('Invalid or expired refresh token');
        }
    }
    async refreshAccessToken(refreshToken) {
        const refreshPayload = await this.verifyRefreshToken(refreshToken);
        const userQuery = `
      SELECT u.id, u.organization_id, u.email, u.role,
             COALESCE(
               json_agg(
                 json_build_object(
                   'team_id', tm.team_id,
                   'team_role', tm.role
                 )
               ) FILTER (WHERE tm.team_id IS NOT NULL),
               '[]'::json
             ) as team_memberships
      FROM users u
      LEFT JOIN team_memberships tm ON u.id = tm.user_id
      WHERE u.id = $1 AND u.organization_id = $2
      GROUP BY u.id, u.organization_id, u.email, u.role
    `;
        const result = await this.db.query(userQuery, [refreshPayload.user_id, refreshPayload.organization_id]);
        if (result.rows.length === 0) {
            throw new Error('User not found');
        }
        const user = result.rows[0];
        await this.revokeRefreshToken(refreshPayload.jti);
        return this.generateTokenPair({
            user_id: user.id,
            organization_id: user.organization_id,
            email: user.email,
            role: user.role,
            team_memberships: user.team_memberships,
        });
    }
    async revokeAccessToken(jti) {
        const expiryQuery = `
      INSERT INTO token_blacklist (jti, blacklisted_at, expires_at)
      VALUES ($1, NOW(), NOW() + INTERVAL '1 day')
      ON CONFLICT (jti) DO NOTHING
    `;
        await this.db.query(expiryQuery, [jti]);
        this.logger.info('Access token revoked', { jti });
    }
    async revokeRefreshToken(jti) {
        await this.db.query('DELETE FROM refresh_tokens WHERE jti = $1', [jti]);
        this.logger.info('Refresh token revoked', { jti });
    }
    async revokeAllUserTokens(userId) {
        await this.db.query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
        this.logger.info('All user tokens revoked', { user_id: userId });
    }
    hasPermission(userPayload, resource, action, context) {
        const permissions = userPayload.permissions || [];
        if (permissions.some(p => p.resource === '*' && p.action === '*')) {
            return true;
        }
        for (const permission of permissions) {
            if (permission.resource === resource && (permission.action === action || permission.action === '*')) {
                if (permission.condition) {
                    return this.evaluatePermissionCondition(permission.condition, userPayload, context);
                }
                return true;
            }
        }
        return false;
    }
    calculatePermissions(role, teamMemberships) {
        const basePermissions = exports.ROLE_PERMISSIONS[role] || [];
        const teamLeadPermissions = [];
        if (teamMemberships) {
            const teamLeadships = teamMemberships.filter(tm => tm.team_role === 'lead');
            if (teamLeadships.length > 0) {
                teamLeadPermissions.push({ resource: 'teams', action: 'update', condition: 'team_lead' }, { resource: 'users', action: 'invite', condition: 'team_lead' });
            }
        }
        return [...basePermissions, ...teamLeadPermissions];
    }
    evaluatePermissionCondition(condition, userPayload, context) {
        switch (condition) {
            case 'own':
                return context?.user_id === userPayload.user_id;
            case 'own_or_team':
                return context?.user_id === userPayload.user_id ||
                    (userPayload.team_memberships || []).some(tm => tm.team_id === context?.team_id);
            case 'same_team':
                return (userPayload.team_memberships || []).some(tm => context?.team_ids?.includes(tm.team_id));
            case 'team_lead':
                return (userPayload.team_memberships || []).some(tm => tm.team_role === 'lead' && context?.team_ids?.includes(tm.team_id));
            case 'assigned_only':
                return context?.assigned_user_ids?.includes(userPayload.user_id);
            default:
                this.logger.warn('Unknown permission condition', { condition });
                return false;
        }
    }
    async storeRefreshToken(tokenData) {
        const query = `
      INSERT INTO refresh_tokens (jti, user_id, organization_id, token_family, expires_at, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
    `;
        await this.db.query(query, [
            tokenData.jti,
            tokenData.user_id,
            tokenData.organization_id,
            tokenData.token_family,
            tokenData.expires_at,
        ]);
    }
    async getRefreshToken(jti) {
        const result = await this.db.query('SELECT * FROM refresh_tokens WHERE jti = $1 AND expires_at > NOW()', [jti]);
        return result.rows[0] || null;
    }
    async isTokenBlacklisted(jti) {
        const result = await this.db.query('SELECT 1 FROM token_blacklist WHERE jti = $1 AND expires_at > NOW()', [jti]);
        return result.rows.length > 0;
    }
    parseExpiry(expiry) {
        const match = expiry.match(/^(\d+)([smhd])$/);
        if (!match) {
            throw new Error(`Invalid expiry format: ${expiry}`);
        }
        const value = parseInt(match[1] || '15');
        const unit = match[2] || 'm';
        switch (unit) {
            case 's': return value * 1000;
            case 'm': return value * 60 * 1000;
            case 'h': return value * 60 * 60 * 1000;
            case 'd': return value * 24 * 60 * 60 * 1000;
            default: throw new Error(`Invalid expiry unit: ${unit}`);
        }
    }
    async cleanupExpiredTokens() {
        const refreshResult = await this.db.query('DELETE FROM refresh_tokens WHERE expires_at <= NOW()');
        const blacklistResult = await this.db.query('DELETE FROM token_blacklist WHERE expires_at <= NOW()');
        this.logger.info('Token cleanup completed', {
            expired_refresh_tokens: refreshResult.rowCount,
            expired_blacklist_entries: blacklistResult.rowCount,
        });
    }
}
exports.JWTService = JWTService;
//# sourceMappingURL=jwt.service.js.map