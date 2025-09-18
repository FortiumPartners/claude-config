/**
 * Enhanced JWT Service with Business Tracing
 * Task 4.3: Custom Trace Instrumentation Enhancement (Sprint 4)
 * 
 * Features:
 * - Business process tracing for authentication flows
 * - Security context attributes and audit trails
 * - Performance optimization for token operations
 * - Enhanced error tracking with business impact analysis
 */

import jwt from 'jsonwebtoken';
import * as api from '@opentelemetry/api';
import { config } from '../config/environment';
import { logger } from '../config/logger';
import { AppError } from '../middleware/error.middleware';
import { 
  businessTraceService, 
  BusinessProcess, 
  CustomerSegment, 
  UserJourneyStage 
} from '../tracing/business-trace.service';

// Re-export interfaces from original service
export interface JwtPayload {
  userId: string;
  tenantId: string;
  email: string;
  role: string;
  permissions?: string[];
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  userId: string;
  tenantId: string;
  tokenId: string;
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
}

// Enhanced authentication context
export interface AuthenticationContext {
  ipAddress?: string;
  userAgent?: string;
  geoLocation?: string;
  deviceId?: string;
  mfaEnabled?: boolean;
  riskScore?: number;
  customerSegment?: CustomerSegment;
  userJourneyStage?: UserJourneyStage;
}

export class EnhancedJwtService {
  /**
   * Generate access token with enhanced tracing
   */
  static async generateAccessToken(
    payload: Omit<JwtPayload, 'iat' | 'exp'>,
    authContext?: AuthenticationContext
  ): Promise<string> {
    return businessTraceService.instrumentAuthenticationFlow(
      'generate_access_token',
      async (span: api.Span) => {
        // Add token generation specific attributes
        span.setAttributes({
          'auth.token.type': 'access',
          'auth.token.user_id': payload.userId,
          'auth.token.tenant_id': payload.tenantId,
          'auth.token.role': payload.role,
          'auth.token.permissions_count': payload.permissions?.length || 0,
          'auth.token.expires_in': config.jwt.expiresIn
        });

        // Add business milestone event
        span.addEvent('auth.token.generation.started', {
          'token.type': 'access',
          'user.id': payload.userId,
          'tenant.id': payload.tenantId,
          'token.issuer': 'fortium-metrics-service'
        });

        try {
          const startTime = Date.now();
          
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

          const duration = Date.now() - startTime;

          // Add performance metrics
          span.setAttributes({
            'auth.token.generation.duration_ms': duration,
            'auth.token.generation.success': true,
            'auth.token.size_bytes': Buffer.from(token).length
          });

          // Add success milestone event
          span.addEvent('auth.token.generation.completed', {
            'token.generation_duration_ms': duration,
            'token.size_bytes': Buffer.from(token).length,
            'token.success': true
          });

          // Add security audit event
          span.addEvent('security.token.issued', {
            'security.token_type': 'access',
            'security.user_id': payload.userId,
            'security.tenant_id': payload.tenantId,
            'security.ip_address': authContext?.ipAddress || 'unknown',
            'security.user_agent': authContext?.userAgent || 'unknown',
            'security.risk_score': authContext?.riskScore || 0,
            'security.mfa_enabled': authContext?.mfaEnabled || false
          });

          logger.info('Access token generated successfully', {
            event: 'auth.token.generated',
            userId: payload.userId,
            tenantId: payload.tenantId,
            role: payload.role,
            duration_ms: duration,
            token_size: Buffer.from(token).length,
            ip_address: authContext?.ipAddress,
            user_agent: authContext?.userAgent
          });

          return token;

        } catch (error) {
          const errorType = (error as Error).constructor.name;
          
          // Add error attributes
          span.setAttributes({
            'auth.token.generation.success': false,
            'auth.token.error.type': errorType,
            'auth.token.error.message': (error as Error).message
          });

          // Add error milestone event
          span.addEvent('auth.token.generation.failed', {
            'error.type': errorType,
            'error.message': (error as Error).message,
            'user.id': payload.userId,
            'tenant.id': payload.tenantId
          });

          // Add security audit event for failed token generation
          span.addEvent('security.token.generation.failed', {
            'security.failure_type': 'token_generation',
            'security.user_id': payload.userId,
            'security.tenant_id': payload.tenantId,
            'security.error': errorType,
            'security.risk_elevation': true
          });

          logger.error('Failed to generate access token', {
            event: 'auth.token.generation.failed',
            error: (error as Error).message,
            error_type: errorType,
            userId: payload.userId,
            tenantId: payload.tenantId,
            ip_address: authContext?.ipAddress
          });

          throw new AppError(
            'Failed to generate access token', 
            500, 
            true, 
            'JWT_GENERATION_ERROR'
          );
        }
      },
      {
        userId: payload.userId,
        email: payload.email,
        ipAddress: authContext?.ipAddress,
        userAgent: authContext?.userAgent,
        mfaEnabled: authContext?.mfaEnabled,
        riskScore: authContext?.riskScore
      }
    );
  }

  /**
   * Generate refresh token with enhanced tracing
   */
  static async generateRefreshToken(
    payload: Omit<RefreshTokenPayload, 'iat' | 'exp'>,
    authContext?: AuthenticationContext
  ): Promise<string> {
    return businessTraceService.instrumentAuthenticationFlow(
      'generate_refresh_token',
      async (span: api.Span) => {
        // Add refresh token specific attributes
        span.setAttributes({
          'auth.token.type': 'refresh',
          'auth.token.user_id': payload.userId,
          'auth.token.tenant_id': payload.tenantId,
          'auth.token.token_id': payload.tokenId,
          'auth.token.expires_in': config.jwt.refreshExpiresIn
        });

        // Add business milestone event
        span.addEvent('auth.refresh_token.generation.started', {
          'token.type': 'refresh',
          'user.id': payload.userId,
          'tenant.id': payload.tenantId,
          'token.id': payload.tokenId
        });

        try {
          const startTime = Date.now();

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

          const duration = Date.now() - startTime;

          // Add performance metrics
          span.setAttributes({
            'auth.refresh_token.generation.duration_ms': duration,
            'auth.refresh_token.generation.success': true,
            'auth.refresh_token.size_bytes': Buffer.from(token).length
          });

          // Add success milestone event
          span.addEvent('auth.refresh_token.generation.completed', {
            'token.generation_duration_ms': duration,
            'token.size_bytes': Buffer.from(token).length,
            'token.id': payload.tokenId
          });

          // Add security audit event
          span.addEvent('security.refresh_token.issued', {
            'security.token_type': 'refresh',
            'security.user_id': payload.userId,
            'security.tenant_id': payload.tenantId,
            'security.token_id': payload.tokenId,
            'security.ip_address': authContext?.ipAddress || 'unknown'
          });

          logger.info('Refresh token generated successfully', {
            event: 'auth.refresh_token.generated',
            userId: payload.userId,
            tenantId: payload.tenantId,
            tokenId: payload.tokenId,
            duration_ms: duration,
            token_size: Buffer.from(token).length
          });

          return token;

        } catch (error) {
          const errorType = (error as Error).constructor.name;
          
          span.setAttributes({
            'auth.refresh_token.generation.success': false,
            'auth.refresh_token.error.type': errorType
          });

          // Add error milestone event
          span.addEvent('auth.refresh_token.generation.failed', {
            'error.type': errorType,
            'error.message': (error as Error).message,
            'token.id': payload.tokenId
          });

          logger.error('Failed to generate refresh token', {
            event: 'auth.refresh_token.generation.failed',
            error: (error as Error).message,
            userId: payload.userId,
            tenantId: payload.tenantId,
            tokenId: payload.tokenId
          });

          throw new AppError(
            'Failed to generate refresh token', 
            500, 
            true, 
            'JWT_GENERATION_ERROR'
          );
        }
      },
      {
        userId: payload.userId,
        ipAddress: authContext?.ipAddress,
        userAgent: authContext?.userAgent,
        riskScore: authContext?.riskScore
      }
    );
  }

  /**
   * Generate token pair with business process tracing
   */
  static async generateTokenPair(
    userId: string,
    tenantId: string,
    email: string,
    role: string,
    permissions?: string[],
    authContext?: AuthenticationContext
  ): Promise<TokenPair> {
    return businessTraceService.instrumentBusinessTransaction(
      'generate_token_pair',
      BusinessProcess.AUTHENTICATION_FLOW,
      [
        {
          name: 'generate_access_token',
          operation: async (span: api.Span) => {
            return this.generateAccessToken(
              { userId, tenantId, email, role, permissions },
              authContext
            );
          },
          context: {
            businessStep: 'access_token_generation',
            securitySensitive: true,
            criticalPath: true
          }
        },
        {
          name: 'generate_refresh_token',
          operation: async (span: api.Span) => {
            const tokenId = `rt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            return this.generateRefreshToken(
              { userId, tenantId, tokenId },
              authContext
            );
          },
          context: {
            businessStep: 'refresh_token_generation',
            securitySensitive: true,
            criticalPath: true
          }
        }
      ],
      {
        userId,
        tenantId,
        businessStep: 'token_pair_generation',
        customerSegment: authContext?.customerSegment,
        userJourneyStage: authContext?.userJourneyStage,
        securitySensitive: true,
        criticalPath: true,
        revenueImpact: true, // Authentication affects user retention
        userExperienceImpact: true
      }
    ).then(([accessToken, refreshToken]) => {
      // Calculate expiration times
      const accessExpiresIn = this.parseExpirationTime(config.jwt.expiresIn);
      const refreshExpiresIn = this.parseExpirationTime(config.jwt.refreshExpiresIn);

      return {
        accessToken,
        refreshToken,
        expiresIn: accessExpiresIn,
        refreshExpiresIn: refreshExpiresIn,
      };
    });
  }

  /**
   * Verify access token with enhanced security tracing
   */
  static async verifyAccessToken(
    token: string,
    authContext?: AuthenticationContext
  ): Promise<JwtPayload> {
    return businessTraceService.instrumentAuthenticationFlow(
      'verify_access_token',
      async (span: api.Span) => {
        // Add token verification attributes
        span.setAttributes({
          'auth.token.type': 'access',
          'auth.token.verification': true,
          'auth.token.masked': this.maskToken(token),
          'auth.verification.ip_address': authContext?.ipAddress || 'unknown',
          'auth.verification.user_agent': authContext?.userAgent || 'unknown'
        });

        // Add verification started event
        span.addEvent('auth.token.verification.started', {
          'token.type': 'access',
          'verification.method': 'jwt_verify',
          'verification.ip_address': authContext?.ipAddress || 'unknown'
        });

        try {
          const startTime = Date.now();

          const decoded = jwt.verify(token, config.jwt.secret, {
            issuer: 'fortium-metrics-service',
            audience: 'fortium-client',
          }) as JwtPayload;

          const duration = Date.now() - startTime;

          // Add verification success attributes
          span.setAttributes({
            'auth.token.verification.duration_ms': duration,
            'auth.token.verification.success': true,
            'auth.token.user_id': decoded.userId,
            'auth.token.tenant_id': decoded.tenantId,
            'auth.token.role': decoded.role,
            'auth.token.expires_at': decoded.exp ? new Date(decoded.exp * 1000).toISOString() : 'unknown'
          });

          // Add verification success event
          span.addEvent('auth.token.verification.completed', {
            'verification.duration_ms': duration,
            'verification.success': true,
            'user.id': decoded.userId,
            'tenant.id': decoded.tenantId,
            'user.role': decoded.role
          });

          // Add security audit event for successful verification
          span.addEvent('security.token.verified', {
            'security.token_type': 'access',
            'security.user_id': decoded.userId,
            'security.tenant_id': decoded.tenantId,
            'security.verification_success': true,
            'security.ip_address': authContext?.ipAddress || 'unknown'
          });

          logger.debug('Access token verified successfully', {
            event: 'auth.token.verified',
            userId: decoded.userId,
            tenantId: decoded.tenantId,
            role: decoded.role,
            exp: decoded.exp,
            duration_ms: duration,
            ip_address: authContext?.ipAddress
          });

          return decoded;

        } catch (error) {
          const duration = Date.now() - Date.now(); // Will be very small
          const errorType = (error as Error).constructor.name;

          // Add verification failure attributes
          span.setAttributes({
            'auth.token.verification.duration_ms': duration,
            'auth.token.verification.success': false,
            'auth.token.error.type': errorType,
            'auth.token.error.message': (error as Error).message
          });

          // Add verification failure event
          span.addEvent('auth.token.verification.failed', {
            'verification.duration_ms': duration,
            'verification.success': false,
            'error.type': errorType,
            'error.message': (error as Error).message
          });

          // Add security audit event for failed verification
          span.addEvent('security.token.verification.failed', {
            'security.token_type': 'access',
            'security.verification_failure': true,
            'security.error_type': errorType,
            'security.ip_address': authContext?.ipAddress || 'unknown',
            'security.risk_elevation': true,
            'security.potential_attack': this.isPotentialAttack(error as Error)
          });

          // Handle specific JWT errors with appropriate business context
          if (error instanceof jwt.TokenExpiredError) {
            logger.warn('Access token expired', {
              event: 'auth.token.expired',
              error_type: 'TOKEN_EXPIRED',
              ip_address: authContext?.ipAddress,
              user_agent: authContext?.userAgent
            });
            throw new AppError('Access token has expired', 401, true, 'TOKEN_EXPIRED');
          }
          
          if (error instanceof jwt.JsonWebTokenError) {
            logger.warn('Invalid access token', {
              event: 'auth.token.invalid',
              error_type: 'INVALID_TOKEN',
              error_message: (error as Error).message,
              ip_address: authContext?.ipAddress,
              potential_attack: true
            });
            throw new AppError('Invalid access token', 401, true, 'INVALID_TOKEN');
          }

          if (error instanceof jwt.NotBeforeError) {
            logger.warn('Access token not active yet', {
              event: 'auth.token.not_active',
              error_type: 'TOKEN_NOT_ACTIVE',
              ip_address: authContext?.ipAddress
            });
            throw new AppError('Access token not active yet', 401, true, 'TOKEN_NOT_ACTIVE');
          }

          logger.error('Access token verification failed', {
            event: 'auth.token.verification.failed',
            error: (error as Error).message,
            error_type: errorType,
            token: this.maskToken(token),
            ip_address: authContext?.ipAddress,
            duration_ms: duration
          });

          throw new AppError(
            'Token verification failed', 
            401, 
            true, 
            'TOKEN_VERIFICATION_ERROR'
          );
        }
      },
      {
        ipAddress: authContext?.ipAddress,
        userAgent: authContext?.userAgent,
        riskScore: authContext?.riskScore
      }
    );
  }

  /**
   * Verify refresh token with enhanced security tracing
   */
  static async verifyRefreshToken(
    token: string,
    authContext?: AuthenticationContext
  ): Promise<RefreshTokenPayload> {
    return businessTraceService.instrumentAuthenticationFlow(
      'verify_refresh_token',
      async (span: api.Span) => {
        // Add refresh token verification attributes
        span.setAttributes({
          'auth.token.type': 'refresh',
          'auth.token.verification': true,
          'auth.token.masked': this.maskToken(token)
        });

        try {
          const startTime = Date.now();

          const decoded = jwt.verify(token, config.jwt.refreshSecret, {
            issuer: 'fortium-metrics-service',
            audience: 'fortium-client',
          }) as RefreshTokenPayload;

          const duration = Date.now() - startTime;

          span.setAttributes({
            'auth.refresh_token.verification.duration_ms': duration,
            'auth.refresh_token.verification.success': true,
            'auth.refresh_token.user_id': decoded.userId,
            'auth.refresh_token.tenant_id': decoded.tenantId,
            'auth.refresh_token.token_id': decoded.tokenId
          });

          // Add security audit event
          span.addEvent('security.refresh_token.verified', {
            'security.token_type': 'refresh',
            'security.user_id': decoded.userId,
            'security.tenant_id': decoded.tenantId,
            'security.token_id': decoded.tokenId,
            'security.verification_success': true
          });

          logger.debug('Refresh token verified successfully', {
            event: 'auth.refresh_token.verified',
            userId: decoded.userId,
            tenantId: decoded.tenantId,
            tokenId: decoded.tokenId,
            duration_ms: duration
          });

          return decoded;

        } catch (error) {
          const errorType = (error as Error).constructor.name;

          span.setAttributes({
            'auth.refresh_token.verification.success': false,
            'auth.refresh_token.error.type': errorType
          });

          // Add security audit event for refresh token failure
          span.addEvent('security.refresh_token.verification.failed', {
            'security.token_type': 'refresh',
            'security.verification_failure': true,
            'security.error_type': errorType,
            'security.risk_elevation': true
          });

          // Handle specific refresh token errors
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
            event: 'auth.refresh_token.verification.failed',
            error: (error as Error).message,
            error_type: errorType,
            token: this.maskToken(token)
          });

          throw new AppError(
            'Refresh token verification failed', 
            401, 
            true, 
            'REFRESH_TOKEN_VERIFICATION_ERROR'
          );
        }
      },
      authContext
    );
  }

  /**
   * Utility methods (enhanced with security context)
   */
  static decodeToken(token: string): any {
    try {
      return jwt.decode(token);
    } catch (error) {
      logger.error('Token decode failed', {
        event: 'auth.token.decode.failed',
        error: (error as Error).message,
        token: this.maskToken(token)
      });
      return null;
    }
  }

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

  private static maskToken(token: string): string {
    if (token.length <= 8) {
      return '***';
    }

    return `${token.substring(0, 4)}...${token.substring(token.length - 4)}`;
  }

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

  /**
   * Determine if error indicates potential security attack
   */
  private static isPotentialAttack(error: Error): boolean {
    const suspiciousPatterns = [
      'malformed',
      'invalid signature',
      'unexpected token',
      'algorithm mismatch'
    ];

    const errorMessage = error.message.toLowerCase();
    return suspiciousPatterns.some(pattern => errorMessage.includes(pattern));
  }
}

// Export enhanced service as default
export default EnhancedJwtService;