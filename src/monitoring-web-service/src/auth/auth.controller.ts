/**
 * Authentication Controller
 * Fortium External Metrics Web Service - Task 2.3: User Registration & Profile Management
 */

import { Request, Response } from 'express';
import { JwtService, TokenPair } from './jwt.service';
import { PasswordService } from './password.service';
import { logger, loggers } from '../config/logger';
import { asyncHandler, AppError, ValidationError, AuthenticationError } from '../middleware/error.middleware';
import { config } from '../config/environment';
import { getPrismaClient, TenantContext, Prisma } from '../database/prisma-client';
import Joi from 'joi';

// User interface from database
interface DatabaseUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  password?: string | null; // Include password field for authentication
  ssoProvider: string | null;
  ssoUserId: string | null;
  lastLogin: Date | null;
  loginCount: number;
  timezone: string;
  preferences: any;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Session store (will be moved to Redis in production)
const refreshTokenStore = new Map<string, {
  userId: string;
  tenantId: string;
  tokenId: string;
  expiresAt: Date;
  isRevoked: boolean;
}>();

// Profile update validation schema
const updateProfileSchema = Joi.object({
  firstName: Joi.string().min(1).max(100).optional(),
  lastName: Joi.string().min(1).max(100).optional(),
  timezone: Joi.string().max(50).optional(),
  preferences: Joi.object().optional(),
});

// SSO user creation schema
const ssoUserSchema = Joi.object({
  email: Joi.string().email().required().max(255),
  firstName: Joi.string().min(1).max(100).required(),
  lastName: Joi.string().min(1).max(100).required(),
  ssoProvider: Joi.string().valid('google', 'azure', 'okta', 'generic').required(),
  ssoUserId: Joi.string().max(255).required(),
  role: Joi.string().valid('super_admin', 'tenant_admin', 'manager', 'developer', 'viewer').default('developer'),
});

export class AuthController {
  
  /**
   * Get Prisma client instance
   */
  private static getPrisma() {
    return getPrismaClient();
  }

  /**
   * Get user permissions based on role
   */
  private static getUserPermissions(role: string): string[] {
    const permissions: Record<string, string[]> = {
      'super_admin': ['*'],
      'tenant_admin': ['user.manage', 'dashboard.manage', 'metrics.view_all'],
      'manager': ['metrics.view_team', 'dashboard.view', 'reports.export'],
      'developer': ['metrics.view_own', 'dashboard.personal', 'profile.edit'],
      'viewer': ['dashboard.view', 'reports.view']
    };
    
    return permissions[role] || permissions['viewer'];
  }

  /**
   * Find user by email and tenant
   */
  private static async findUserByEmailAndTenant(email: string, tenantId: string): Promise<DatabaseUser | null> {
    const prisma = this.getPrisma();
    
    try {
      // Get tenant context first
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId, isActive: true }
      });
      
      if (!tenant) {
        return null;
      }

      // Set tenant context for multi-tenant queries
      const tenantContext: TenantContext = {
        tenantId: tenant.id,
        schemaName: tenant.schemaName,
        domain: tenant.domain
      };

      // Use raw SQL to query the tenant schema directly
      // This bypasses Prisma's connection pooling issues with schema switching
      logger.info('Looking for user in tenant context', {
        email: email.toLowerCase(),
        tenantId,
        tenantSchema: tenantContext.schemaName,
      });

      const users = await prisma.$queryRaw<Array<{
        id: string;
        email: string;
        first_name: string;
        last_name: string;
        role: string;
        password?: string;
        sso_provider?: string;
        sso_user_id?: string;
        last_login?: Date;
        login_count: number;
        timezone: string;
        preferences: any;
        is_active: boolean;
        created_at: Date;
        updated_at: Date;
      }>>`
        SELECT * FROM "${Prisma.raw(tenantContext.schemaName)}".users 
        WHERE email = ${email.toLowerCase()} AND is_active = true
        LIMIT 1
      `;
      
      const user = users.length > 0 ? {
        id: users[0].id,
        email: users[0].email,
        firstName: users[0].first_name,
        lastName: users[0].last_name,
        role: users[0].role,
        password: users[0].password,
        ssoProvider: users[0].sso_provider,
        ssoUserId: users[0].sso_user_id,
        lastLogin: users[0].last_login,
        loginCount: users[0].login_count,
        timezone: users[0].timezone,
        preferences: users[0].preferences,
        isActive: users[0].is_active,
        createdAt: users[0].created_at,
        updatedAt: users[0].updated_at,
      } : null;

      logger.info('User query result', {
        email: email.toLowerCase(),
        tenantId,
        tenantSchema: tenantContext.schemaName,
        userFound: !!user,
        userId: user?.id || 'none',
      });

      return user;
    } catch (error) {
      logger.error('Failed to find user', { email, tenantId, error });
      return null;
    }
  }

  /**
   * Create or update SSO user
   */
  static createOrUpdateSSOUser = asyncHandler(async (req: Request, res: Response) => {
    const { error, value } = ssoUserSchema.validate(req.body);
    if (error) {
      throw new ValidationError(error.details.map(d => d.message).join(', '));
    }

    const { email, firstName, lastName, ssoProvider, ssoUserId, role, tenantId } = value;
    const prisma = this.getPrisma();

    try {
      // Get tenant context
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId, isActive: true }
      });
      
      if (!tenant) {
        throw new ValidationError('Invalid tenant ID');
      }

      const tenantContext: TenantContext = {
        tenantId: tenant.id,
        schemaName: tenant.schemaName,
        domain: tenant.domain
      };

      const user = await prisma.withTenantContext(tenantContext, async (client) => {
        // Check if user already exists by email or SSO ID
        let existingUser = await client.user.findFirst({
          where: {
            OR: [
              { email: email.toLowerCase() },
              { ssoProvider, ssoUserId }
            ]
          }
        });

        if (existingUser) {
          // Update existing user
          existingUser = await client.user.update({
            where: { id: existingUser.id },
            data: {
              firstName,
              lastName,
              ssoProvider,
              ssoUserId,
              lastLogin: new Date(),
              loginCount: { increment: 1 },
            }
          });
        } else {
          // Create new user
          existingUser = await client.user.create({
            data: {
              email: email.toLowerCase(),
              firstName,
              lastName,
              role,
              ssoProvider,
              ssoUserId,
              lastLogin: new Date(),
              loginCount: 1,
              timezone: 'UTC',
              preferences: {},
              isActive: true
            }
          });
        }

        return existingUser;
      });

      logger.info('SSO user created/updated', {
        userId: user.id,
        email: user.email,
        ssoProvider,
        tenantId,
      });

      res.status(201).json({
        success: true,
        message: 'User created/updated successfully',
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            ssoProvider: user.ssoProvider,
            isActive: user.isActive,
          }
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('SSO user creation failed', { email, ssoProvider, tenantId, error });
      throw new AppError('Failed to create/update SSO user', 500);
    }
  });

  /**
   * Login with email and password
   */
  static login = asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      throw new ValidationError('Email and password are required');
    }

    // Get tenant ID from multi-tenant middleware
    if (!req.tenant) {
      throw new ValidationError('Tenant context is required');
    }

    const tenantId = req.tenant.id;

    // Find user in database
    const user = await this.findUserByEmailAndTenant(email, tenantId);

    if (!user) {
      loggers.auth.loginFailed(email, 'User not found', {
        tenantId,
        requestId: req.requestId,
        ip: req.ip,
      });
      throw new AuthenticationError('Invalid credentials');
    }

    // Check if user is active
    if (!user.isActive) {
      loggers.auth.loginFailed(email, 'Account disabled', {
        userId: user.id,
        tenantId,
        requestId: req.requestId,
        ip: req.ip,
      });
      throw new AuthenticationError('Account is disabled');
    }

    // SSO users don't have passwords - they should use SSO flow
    if (user.ssoProvider && !password) {
      throw new AuthenticationError('Please use SSO login for this account');
    }

    // For local accounts with passwords, verify password
    if (password) {
      // Note: In demo mode, password is stored as plaintext for simplicity
      // In production, this should use proper password hashing (bcrypt, etc.)
      if (user.password && user.password !== password) {
        loggers.auth.loginFailed(email, 'Invalid password', {
          tenantId,
          requestId: req.requestId,
          ip: req.ip,
        });
        throw new AuthenticationError('Invalid credentials');
      }
      
      // For users without a stored password, assume SSO authentication
      if (!user.password && password) {
        loggers.auth.loginFailed(email, 'Password not supported for SSO users', {
          tenantId,
          requestId: req.requestId,
          ip: req.ip,
        });
        throw new AuthenticationError('Invalid credentials');
      }
    }

    // Update last login
    const prisma = this.getPrisma();
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });

    if (tenant) {
      const tenantContext: TenantContext = {
        tenantId: tenant.id,
        schemaName: tenant.schemaName,
        domain: tenant.domain
      };

      await prisma.withTenantContext(tenantContext, async (client) => {
        await client.user.update({
          where: { id: user.id },
          data: {
            lastLogin: new Date(),
            loginCount: { increment: 1 }
          }
        });
      });
    }

    // Generate token pair
    const userPermissions = this.getUserPermissions(user.role);
    const tokenPair = JwtService.generateTokenPair(
      user.id,
      tenantId,
      user.email,
      user.role,
      userPermissions
    );

    // Store refresh token
    const refreshPayload = JwtService.verifyRefreshToken(tokenPair.refreshToken);
    refreshTokenStore.set(refreshPayload.tokenId, {
      userId: user.id,
      tenantId: tenantId,
      tokenId: refreshPayload.tokenId,
      expiresAt: new Date(Date.now() + (tokenPair.refreshExpiresIn * 1000)),
      isRevoked: false,
    });

    loggers.auth.login(user.id, tenantId, {
      requestId: req.requestId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          tenantId: tenantId,
          permissions: userPermissions,
          ssoProvider: user.ssoProvider,
          timezone: user.timezone,
          lastLogin: user.lastLogin,
        },
        tokens: tokenPair,
      },
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Refresh access token using refresh token
   */
  static refreshToken = asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new ValidationError('Refresh token is required');
    }

    // Verify refresh token
    const payload = JwtService.verifyRefreshToken(refreshToken);

    // Check if token exists in store and is not revoked
    const storedToken = refreshTokenStore.get(payload.tokenId);
    if (!storedToken || storedToken.isRevoked) {
      throw new AuthenticationError('Invalid or revoked refresh token');
    }

    // Check if token has expired
    if (storedToken.expiresAt < new Date()) {
      refreshTokenStore.delete(payload.tokenId);
      throw new AuthenticationError('Refresh token has expired');
    }

    // Find user
    const prisma = this.getPrisma();
    const user = await prisma.user.findUnique({
      where: { id: payload.userId, isActive: true }
    });
    if (!user) {
      refreshTokenStore.delete(payload.tokenId);
      throw new AuthenticationError('User not found or inactive');
    }
    
    // Prepare user data for token generation (using payload.tenantId from JWT)
    const userData = {
      id: user.id,
      tenantId: payload.tenantId,
      email: user.email,
      role: user.role,
      permissions: this.getUserPermissions(user.role)
    };

    // Generate new token pair
    const newTokenPair = JwtService.generateTokenPair(
      userData.id,
      userData.tenantId,
      userData.email,
      userData.role,
      userData.permissions
    );

    // Revoke old refresh token
    refreshTokenStore.delete(payload.tokenId);

    // Store new refresh token
    const newRefreshPayload = JwtService.verifyRefreshToken(newTokenPair.refreshToken);
    refreshTokenStore.set(newRefreshPayload.tokenId, {
      userId: userData.id,
      tenantId: userData.tenantId,
      tokenId: newRefreshPayload.tokenId,
      expiresAt: new Date(Date.now() + (newTokenPair.refreshExpiresIn * 1000)),
      isRevoked: false,
    });

    loggers.auth.tokenRefresh(userData.id, userData.tenantId, {
      requestId: req.requestId,
      ip: req.ip,
    });

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        tokens: newTokenPair,
      },
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Logout (revoke refresh token)
   */
  static logout = asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;
    const user = req.user;

    if (refreshToken) {
      try {
        const payload = JwtService.verifyRefreshToken(refreshToken);
        refreshTokenStore.delete(payload.tokenId);
      } catch {
        // Token is already invalid, which is fine for logout
      }
    }

    if (user) {
      loggers.auth.logout(user.userId, user.tenantId, {
        requestId: req.requestId,
        ip: req.ip,
      });
    }

    res.json({
      success: true,
      message: 'Logout successful',
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Get current user profile
   */
  static getProfile = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user;

    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }

    // Find full user data from database
    const fullUser = await this.findUserByEmailAndTenant(user.email, user.tenantId);
    if (!fullUser) {
      throw new AuthenticationError('User not found');
    }

    const userPermissions = this.getUserPermissions(fullUser.role);

    res.json({
      success: true,
      data: {
        id: fullUser.id,
        email: fullUser.email,
        firstName: fullUser.firstName,
        lastName: fullUser.lastName,
        role: fullUser.role,
        tenantId: user.tenantId,
        permissions: userPermissions,
        ssoProvider: fullUser.ssoProvider,
        timezone: fullUser.timezone,
        preferences: fullUser.preferences,
        lastLogin: fullUser.lastLogin,
        loginCount: fullUser.loginCount,
        isActive: fullUser.isActive,
        createdAt: fullUser.createdAt,
        updatedAt: fullUser.updatedAt,
      },
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Update user profile
   */
  static updateProfile = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user;
    
    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }

    // Validate input
    const { error, value } = updateProfileSchema.validate(req.body);
    if (error) {
      throw new ValidationError(error.details.map(d => d.message).join(', '));
    }

    const { firstName, lastName, timezone, preferences } = value;
    
    try {
      const prisma = this.getPrisma();
      
      // Get tenant context
      const tenant = await prisma.tenant.findUnique({
        where: { id: user.tenantId, isActive: true }
      });
      
      if (!tenant) {
        throw new ValidationError('Invalid tenant');
      }

      const tenantContext: TenantContext = {
        tenantId: tenant.id,
        schemaName: tenant.schemaName,
        domain: tenant.domain
      };

      const updatedUser = await prisma.withTenantContext(tenantContext, async (client) => {
        return await client.user.update({
          where: { 
            email: user.email,
            isActive: true 
          },
          data: {
            ...(firstName && { firstName }),
            ...(lastName && { lastName }),
            ...(timezone && { timezone }),
            ...(preferences && { preferences }),
            updatedAt: new Date(),
          }
        });
      });

      logger.info('User profile updated', {
        userId: user.userId,
        tenantId: user.tenantId,
        updates: Object.keys(value),
      });

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          id: updatedUser.id,
          email: updatedUser.email,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          role: updatedUser.role,
          ssoProvider: updatedUser.ssoProvider,
          timezone: updatedUser.timezone,
          preferences: updatedUser.preferences,
          updatedAt: updatedUser.updatedAt,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Profile update failed', { 
        userId: user.userId, 
        tenantId: user.tenantId, 
        error 
      });
      throw new AppError('Failed to update profile', 500);
    }
  });

  /**
   * Change password
   */
  static changePassword = asyncHandler(async (req: Request, res: Response) => {
    const { currentPassword, newPassword } = req.body;
    const user = req.user;

    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }

    if (!currentPassword || !newPassword) {
      throw new ValidationError('Current password and new password are required');
    }

    // Find user with password field
    const prisma = this.getPrisma();
    const fullUser = await prisma.user.findUnique({
      where: { id: user.userId, isActive: true },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        password: true, // Include password for verification
        preferences: true,
        timezone: true,
        createdAt: true,
        updatedAt: true
      }
    });
    if (!fullUser) {
      throw new AuthenticationError('User not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await PasswordService.verifyPassword(
      currentPassword,
      fullUser.password
    );
    if (!isCurrentPasswordValid) {
      throw new ValidationError('Current password is incorrect');
    }

    // Hash new password
    const hashedNewPassword = await PasswordService.hashPassword(newPassword);

    // Update password in database
    await prisma.user.update({
      where: { id: user.userId },
      data: { password: hashedNewPassword }
    });

    logger.info('Password changed successfully', {
      userId: user.userId,
      tenantId: user.tenantId,
      requestId: req.requestId,
    });

    res.json({
      success: true,
      message: 'Password changed successfully',
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Validate password strength
   */
  static validatePassword = asyncHandler(async (req: Request, res: Response) => {
    const { password } = req.body;

    if (!password) {
      throw new ValidationError('Password is required');
    }

    const validation = PasswordService.validatePassword(password);

    res.json({
      success: true,
      data: validation,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Revoke all refresh tokens for user (logout from all devices)
   */
  static revokeAllTokens = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user;

    if (!user) {
      throw new AuthenticationError('User not authenticated');
    }

    // Revoke all refresh tokens for this user
    let revokedCount = 0;
    for (const [tokenId, tokenData] of refreshTokenStore.entries()) {
      if (tokenData.userId === user.userId) {
        refreshTokenStore.delete(tokenId);
        revokedCount++;
      }
    }

    logger.info('All tokens revoked for user', {
      userId: user.userId,
      tenantId: user.tenantId,
      revokedCount,
      requestId: req.requestId,
    });

    res.json({
      success: true,
      message: `Revoked ${revokedCount} tokens`,
      data: {
        revokedCount,
      },
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Health check for auth service
   */
  static healthCheck = asyncHandler(async (req: Request, res: Response) => {
    res.json({
      success: true,
      service: 'Authentication Service',
      status: 'healthy',
      features: {
        jwt: true,
        passwordHashing: true,
        refreshTokens: true,
        multiTenant: true,
      },
      stats: {
        activeRefreshTokens: refreshTokenStore.size,
      },
      timestamp: new Date().toISOString(),
    });
  });
}