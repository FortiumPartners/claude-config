/**
 * JWT Service
 * Fortium External Metrics Web Service - Task 1.7: Authentication Foundation
 */

import jwt from 'jsonwebtoken';
import { config } from '../config/environment';
import { logger } from '../config/logger';
import { AppError } from '../middleware/error.middleware';

// JWT payload interface
export interface JwtPayload {
  userId: string;
  tenantId: string;
  email: string;
  role: string;
  permissions?: string[];
  iat?: number;
  exp?: number;
}

// Refresh token payload interface
export interface RefreshTokenPayload {
  userId: string;
  tenantId: string;
  tokenId: string;
  iat?: number;
  exp?: number;
}

// Token pair interface
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
}

export class JwtService {
  /**
   * Generate access token
   */
  static generateAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
    try {
      const token = jwt.sign(
        payload,
        config.jwt.secret,
        {
          expiresIn: config.jwt.expiresIn,
          issuer: 'fortium-metrics-service',
          audience: 'fortium-client',
          subject: payload.userId,
        }
      ) as string;

      logger.debug('Access token generated', {
        userId: payload.userId,
        tenantId: payload.tenantId,
        expiresIn: config.jwt.expiresIn,
      });

      return token;
    } catch (error) {
      logger.error('Failed to generate access token', {
        error: error instanceof Error ? error.message : String(error),
        userId: payload.userId,
        tenantId: payload.tenantId,
      });
      throw new AppError('Failed to generate access token', 500, true, 'JWT_GENERATION_ERROR');
    }
  }

  /**
   * Generate refresh token
   */
  static generateRefreshToken(payload: Omit<RefreshTokenPayload, 'iat' | 'exp'>): string {
    try {
      const token = jwt.sign(
        payload,
        config.jwt.refreshSecret,
        {
          expiresIn: config.jwt.refreshExpiresIn,
          issuer: 'fortium-metrics-service',
          audience: 'fortium-client',
          subject: payload.userId,
        }
      ) as string;

      logger.debug('Refresh token generated', {
        userId: payload.userId,
        tenantId: payload.tenantId,
        tokenId: payload.tokenId,
        expiresIn: config.jwt.refreshExpiresIn,
      });

      return token;
    } catch (error) {
      logger.error('Failed to generate refresh token', {
        error: error instanceof Error ? error.message : String(error),
        userId: payload.userId,
        tenantId: payload.tenantId,
      });
      throw new AppError('Failed to generate refresh token', 500, true, 'JWT_GENERATION_ERROR');
    }
  }

  /**
   * Generate token pair (access + refresh)
   */
  static generateTokenPair(
    userId: string,
    tenantId: string,
    email: string,
    role: string,
    permissions?: string[]
  ): TokenPair {
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

    // Calculate expiration times in seconds
    const accessExpiresIn = this.parseExpirationTime(config.jwt.expiresIn);
    const refreshExpiresIn = this.parseExpirationTime(config.jwt.refreshExpiresIn);

    return {
      accessToken,
      refreshToken,
      expiresIn: accessExpiresIn,
      refreshExpiresIn: refreshExpiresIn,
    };
  }

  /**
   * Verify access token
   */
  static verifyAccessToken(token: string): JwtPayload {
    try {
      const decoded = jwt.verify(token, config.jwt.secret, {
        issuer: 'fortium-metrics-service',
        audience: 'fortium-client',
      }) as JwtPayload;

      logger.debug('Access token verified', {
        userId: decoded.userId,
        tenantId: decoded.tenantId,
        exp: decoded.exp,
      });

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AppError('Access token has expired', 401, true, 'TOKEN_EXPIRED');
      }
      
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AppError('Invalid access token', 401, true, 'INVALID_TOKEN');
      }

      if (error instanceof jwt.NotBeforeError) {
        throw new AppError('Access token not active yet', 401, true, 'TOKEN_NOT_ACTIVE');
      }

      logger.error('Access token verification failed', {
        error: error instanceof Error ? error.message : String(error),
        token: this.maskToken(token),
      });

      throw new AppError('Token verification failed', 401, true, 'TOKEN_VERIFICATION_ERROR');
    }
  }

  /**
   * Verify refresh token
   */
  static verifyRefreshToken(token: string): RefreshTokenPayload {
    try {
      const decoded = jwt.verify(token, config.jwt.refreshSecret, {
        issuer: 'fortium-metrics-service',
        audience: 'fortium-client',
      }) as RefreshTokenPayload;

      logger.debug('Refresh token verified', {
        userId: decoded.userId,
        tenantId: decoded.tenantId,
        tokenId: decoded.tokenId,
        exp: decoded.exp,
      });

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AppError('Refresh token has expired', 401, true, 'REFRESH_TOKEN_EXPIRED');
      }
      
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AppError('Invalid refresh token', 401, true, 'INVALID_REFRESH_TOKEN');
      }

      if (error instanceof jwt.NotBeforeError) {
        throw new AppError('Refresh token not active yet', 401, true, 'REFRESH_TOKEN_NOT_ACTIVE');
      }

      logger.error('Refresh token verification failed', {
        error: error instanceof Error ? error.message : String(error),
        token: this.maskToken(token),
      });

      throw new AppError('Refresh token verification failed', 401, true, 'REFRESH_TOKEN_VERIFICATION_ERROR');
    }
  }

  /**
   * Decode token without verification (for debugging)
   */
  static decodeToken(token: string): any {
    try {
      return jwt.decode(token);
    } catch (error) {
      logger.error('Token decode failed', {
        error: error instanceof Error ? error.message : String(error),
        token: this.maskToken(token),
      });
      return null;
    }
  }

  /**
   * Check if token is expired
   */
  static isTokenExpired(token: string): boolean {
    try {
      const decoded = jwt.decode(token) as any;
      if (!decoded || !decoded.exp) {
        return true;
      }

      const now = Math.floor(Date.now() / 1000);
      return decoded.exp < now;
    } catch {
      return true;
    }
  }

  /**
   * Get token expiration date
   */
  static getTokenExpiration(token: string): Date | null {
    try {
      const decoded = jwt.decode(token) as any;
      if (!decoded || !decoded.exp) {
        return null;
      }

      return new Date(decoded.exp * 1000);
    } catch {
      return null;
    }
  }

  /**
   * Extract token from Authorization header
   */
  static extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader) {
      return null;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }

    return parts[1];
  }

  /**
   * Mask token for logging (show only first and last 4 characters)
   */
  private static maskToken(token: string): string {
    if (token.length <= 8) {
      return '***';
    }

    return `${token.substring(0, 4)}...${token.substring(token.length - 4)}`;
  }

  /**
   * Parse expiration time string to seconds
   */
  private static parseExpirationTime(expiresIn: string): number {
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