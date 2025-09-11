"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JwtService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const environment_1 = require("../config/environment");
const logger_1 = require("../config/logger");
const error_middleware_1 = require("../middleware/error.middleware");
class JwtService {
    static generateAccessToken(payload) {
        try {
            const token = jsonwebtoken_1.default.sign(payload, environment_1.config.jwt.secret, {
                expiresIn: environment_1.config.jwt.expiresIn,
                issuer: 'fortium-metrics-service',
                audience: 'fortium-client',
                subject: payload.userId,
            });
            logger_1.logger.debug('Access token generated', {
                userId: payload.userId,
                tenantId: payload.tenantId,
                expiresIn: environment_1.config.jwt.expiresIn,
            });
            return token;
        }
        catch (error) {
            logger_1.logger.error('Failed to generate access token', {
                error: error instanceof Error ? error.message : String(error),
                userId: payload.userId,
                tenantId: payload.tenantId,
            });
            throw new error_middleware_1.AppError('Failed to generate access token', 500, true, 'JWT_GENERATION_ERROR');
        }
    }
    static generateRefreshToken(payload) {
        try {
            const token = jsonwebtoken_1.default.sign(payload, environment_1.config.jwt.refreshSecret, {
                expiresIn: environment_1.config.jwt.refreshExpiresIn,
                issuer: 'fortium-metrics-service',
                audience: 'fortium-client',
                subject: payload.userId,
            });
            logger_1.logger.debug('Refresh token generated', {
                userId: payload.userId,
                tenantId: payload.tenantId,
                tokenId: payload.tokenId,
                expiresIn: environment_1.config.jwt.refreshExpiresIn,
            });
            return token;
        }
        catch (error) {
            logger_1.logger.error('Failed to generate refresh token', {
                error: error instanceof Error ? error.message : String(error),
                userId: payload.userId,
                tenantId: payload.tenantId,
            });
            throw new error_middleware_1.AppError('Failed to generate refresh token', 500, true, 'JWT_GENERATION_ERROR');
        }
    }
    static generateTokenPair(userId, tenantId, email, role, permissions) {
        const tokenId = `rt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const accessToken = this.generateAccessToken({
            userId,
            tenantId,
            email,
            role,
            permissions,
        });
        const refreshToken = this.generateRefreshToken({
            userId,
            tenantId,
            tokenId,
        });
        const accessExpiresIn = this.parseExpirationTime(environment_1.config.jwt.expiresIn);
        const refreshExpiresIn = this.parseExpirationTime(environment_1.config.jwt.refreshExpiresIn);
        return {
            accessToken,
            refreshToken,
            expiresIn: accessExpiresIn,
            refreshExpiresIn: refreshExpiresIn,
        };
    }
    static verifyAccessToken(token) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, environment_1.config.jwt.secret, {
                issuer: 'fortium-metrics-service',
                audience: 'fortium-client',
            });
            logger_1.logger.debug('Access token verified', {
                userId: decoded.userId,
                tenantId: decoded.tenantId,
                exp: decoded.exp,
            });
            return decoded;
        }
        catch (error) {
            if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
                throw new error_middleware_1.AppError('Access token has expired', 401, true, 'TOKEN_EXPIRED');
            }
            if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
                throw new error_middleware_1.AppError('Invalid access token', 401, true, 'INVALID_TOKEN');
            }
            if (error instanceof jsonwebtoken_1.default.NotBeforeError) {
                throw new error_middleware_1.AppError('Access token not active yet', 401, true, 'TOKEN_NOT_ACTIVE');
            }
            logger_1.logger.error('Access token verification failed', {
                error: error instanceof Error ? error.message : String(error),
                token: this.maskToken(token),
            });
            throw new error_middleware_1.AppError('Token verification failed', 401, true, 'TOKEN_VERIFICATION_ERROR');
        }
    }
    static verifyRefreshToken(token) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, environment_1.config.jwt.refreshSecret, {
                issuer: 'fortium-metrics-service',
                audience: 'fortium-client',
            });
            logger_1.logger.debug('Refresh token verified', {
                userId: decoded.userId,
                tenantId: decoded.tenantId,
                tokenId: decoded.tokenId,
                exp: decoded.exp,
            });
            return decoded;
        }
        catch (error) {
            if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
                throw new error_middleware_1.AppError('Refresh token has expired', 401, true, 'REFRESH_TOKEN_EXPIRED');
            }
            if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
                throw new error_middleware_1.AppError('Invalid refresh token', 401, true, 'INVALID_REFRESH_TOKEN');
            }
            if (error instanceof jsonwebtoken_1.default.NotBeforeError) {
                throw new error_middleware_1.AppError('Refresh token not active yet', 401, true, 'REFRESH_TOKEN_NOT_ACTIVE');
            }
            logger_1.logger.error('Refresh token verification failed', {
                error: error instanceof Error ? error.message : String(error),
                token: this.maskToken(token),
            });
            throw new error_middleware_1.AppError('Refresh token verification failed', 401, true, 'REFRESH_TOKEN_VERIFICATION_ERROR');
        }
    }
    static decodeToken(token) {
        try {
            return jsonwebtoken_1.default.decode(token);
        }
        catch (error) {
            logger_1.logger.error('Token decode failed', {
                error: error instanceof Error ? error.message : String(error),
                token: this.maskToken(token),
            });
            return null;
        }
    }
    static isTokenExpired(token) {
        try {
            const decoded = jsonwebtoken_1.default.decode(token);
            if (!decoded || !decoded.exp) {
                return true;
            }
            const now = Math.floor(Date.now() / 1000);
            return decoded.exp < now;
        }
        catch {
            return true;
        }
    }
    static getTokenExpiration(token) {
        try {
            const decoded = jsonwebtoken_1.default.decode(token);
            if (!decoded || !decoded.exp) {
                return null;
            }
            return new Date(decoded.exp * 1000);
        }
        catch {
            return null;
        }
    }
    static extractTokenFromHeader(authHeader) {
        if (!authHeader) {
            return null;
        }
        const parts = authHeader.split(' ');
        if (parts.length !== 2 || parts[0] !== 'Bearer') {
            return null;
        }
        return parts[1];
    }
    static maskToken(token) {
        if (token.length <= 8) {
            return '***';
        }
        return `${token.substring(0, 4)}...${token.substring(token.length - 4)}`;
    }
    static parseExpirationTime(expiresIn) {
        const match = expiresIn.match(/^(\d+)([smhd])$/);
        if (!match) {
            throw new Error(`Invalid expiration time format: ${expiresIn}`);
        }
        const value = parseInt(match[1], 10);
        const unit = match[2];
        switch (unit) {
            case 's':
                return value;
            case 'm':
                return value * 60;
            case 'h':
                return value * 60 * 60;
            case 'd':
                return value * 24 * 60 * 60;
            default:
                throw new Error(`Unknown time unit: ${unit}`);
        }
    }
}
exports.JwtService = JwtService;
//# sourceMappingURL=jwt.service.js.map