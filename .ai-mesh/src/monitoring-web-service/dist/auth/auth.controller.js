"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const jwt_service_1 = require("./jwt.service");
const password_service_1 = require("./password.service");
const logger_1 = require("../config/logger");
const error_middleware_1 = require("../middleware/error.middleware");
const prisma_client_1 = require("../database/prisma-client");
const joi_1 = __importDefault(require("joi"));
const refreshTokenStore = new Map();
const updateProfileSchema = joi_1.default.object({
    firstName: joi_1.default.string().min(1).max(100).optional(),
    lastName: joi_1.default.string().min(1).max(100).optional(),
    timezone: joi_1.default.string().max(50).optional(),
    preferences: joi_1.default.object().optional(),
});
const ssoUserSchema = joi_1.default.object({
    email: joi_1.default.string().email().required().max(255),
    firstName: joi_1.default.string().min(1).max(100).required(),
    lastName: joi_1.default.string().min(1).max(100).required(),
    ssoProvider: joi_1.default.string().valid('google', 'azure', 'okta', 'generic').required(),
    ssoUserId: joi_1.default.string().max(255).required(),
    role: joi_1.default.string().valid('super_admin', 'tenant_admin', 'manager', 'developer', 'viewer').default('developer'),
});
class AuthController {
    static getPrisma() {
        return (0, prisma_client_1.getPrismaClient)();
    }
    static getUserPermissions(role) {
        const permissions = {
            'super_admin': ['*'],
            'tenant_admin': ['user.manage', 'dashboard.manage', 'metrics.view_all'],
            'manager': ['metrics.view_team', 'dashboard.view', 'reports.export'],
            'developer': ['metrics.view_own', 'dashboard.personal', 'profile.edit'],
            'viewer': ['dashboard.view', 'reports.view']
        };
        return permissions[role] || permissions['viewer'];
    }
    static async findUserByEmailAndTenant(email, tenantId) {
        const prisma = this.getPrisma();
        try {
            const tenant = await prisma.tenant.findUnique({
                where: { id: tenantId, isActive: true }
            });
            if (!tenant) {
                return null;
            }
            const tenantContext = {
                tenantId: tenant.id,
                schemaName: tenant.schemaName,
                domain: tenant.domain
            };
            return await prisma.withTenantContext(tenantContext, async (client) => {
                const user = await client.user.findUnique({
                    where: {
                        email: email.toLowerCase(),
                        isActive: true
                    }
                });
                return user ? {
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    role: user.role,
                    ssoProvider: user.ssoProvider,
                    ssoUserId: user.ssoUserId,
                    lastLogin: user.lastLogin,
                    loginCount: user.loginCount,
                    timezone: user.timezone,
                    preferences: user.preferences,
                    isActive: user.isActive,
                    createdAt: user.createdAt,
                    updatedAt: user.updatedAt
                } : null;
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to find user', { email, tenantId, error });
            return null;
        }
    }
    static createOrUpdateSSOUser = (0, error_middleware_1.asyncHandler)(async (req, res) => {
        const { error, value } = ssoUserSchema.validate(req.body);
        if (error) {
            throw new error_middleware_1.ValidationError(error.details.map(d => d.message).join(', '));
        }
        const { email, firstName, lastName, ssoProvider, ssoUserId, role, tenantId } = value;
        const prisma = this.getPrisma();
        try {
            const tenant = await prisma.tenant.findUnique({
                where: { id: tenantId, isActive: true }
            });
            if (!tenant) {
                throw new error_middleware_1.ValidationError('Invalid tenant ID');
            }
            const tenantContext = {
                tenantId: tenant.id,
                schemaName: tenant.schemaName,
                domain: tenant.domain
            };
            const user = await prisma.withTenantContext(tenantContext, async (client) => {
                let existingUser = await client.user.findFirst({
                    where: {
                        OR: [
                            { email: email.toLowerCase() },
                            { ssoProvider, ssoUserId }
                        ]
                    }
                });
                if (existingUser) {
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
                }
                else {
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
            logger_1.logger.info('SSO user created/updated', {
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
        }
        catch (error) {
            logger_1.logger.error('SSO user creation failed', { email, ssoProvider, tenantId, error });
            throw new error_middleware_1.AppError('Failed to create/update SSO user', 500);
        }
    });
    static login = (0, error_middleware_1.asyncHandler)(async (req, res) => {
        const { email, password, tenantId } = req.body;
        if (!email || !password) {
            throw new error_middleware_1.ValidationError('Email and password are required');
        }
        if (!tenantId) {
            throw new error_middleware_1.ValidationError('Tenant ID is required');
        }
        const user = await this.findUserByEmailAndTenant(email, tenantId);
        if (!user) {
            logger_1.loggers.auth.loginFailed(email, 'User not found', {
                tenantId,
                requestId: req.requestId,
                ip: req.ip,
            });
            throw new error_middleware_1.AuthenticationError('Invalid credentials');
        }
        if (!user.isActive) {
            logger_1.loggers.auth.loginFailed(email, 'Account disabled', {
                userId: user.id,
                tenantId,
                requestId: req.requestId,
                ip: req.ip,
            });
            throw new error_middleware_1.AuthenticationError('Account is disabled');
        }
        if (user.ssoProvider && !password) {
            throw new error_middleware_1.AuthenticationError('Please use SSO login for this account');
        }
        if (password) {
            logger_1.logger.warn('Password authentication not yet implemented for database users');
        }
        const prisma = this.getPrisma();
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId }
        });
        if (tenant) {
            const tenantContext = {
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
        const userPermissions = this.getUserPermissions(user.role);
        const tokenPair = jwt_service_1.JwtService.generateTokenPair(user.id, tenantId, user.email, user.role, userPermissions);
        const refreshPayload = jwt_service_1.JwtService.verifyRefreshToken(tokenPair.refreshToken);
        refreshTokenStore.set(refreshPayload.tokenId, {
            userId: user.id,
            tenantId: tenantId,
            tokenId: refreshPayload.tokenId,
            expiresAt: new Date(Date.now() + (tokenPair.refreshExpiresIn * 1000)),
            isRevoked: false,
        });
        logger_1.loggers.auth.login(user.id, tenantId, {
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
    static refreshToken = (0, error_middleware_1.asyncHandler)(async (req, res) => {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            throw new error_middleware_1.ValidationError('Refresh token is required');
        }
        const payload = jwt_service_1.JwtService.verifyRefreshToken(refreshToken);
        const storedToken = refreshTokenStore.get(payload.tokenId);
        if (!storedToken || storedToken.isRevoked) {
            throw new error_middleware_1.AuthenticationError('Invalid or revoked refresh token');
        }
        if (storedToken.expiresAt < new Date()) {
            refreshTokenStore.delete(payload.tokenId);
            throw new error_middleware_1.AuthenticationError('Refresh token has expired');
        }
        const prisma = this.getPrisma();
        const user = await prisma.user.findUnique({
            where: { id: payload.userId, isActive: true }
        });
        if (!user) {
            refreshTokenStore.delete(payload.tokenId);
            throw new error_middleware_1.AuthenticationError('User not found or inactive');
        }
        const userData = {
            id: user.id,
            tenantId: payload.tenantId,
            email: user.email,
            role: user.role,
            permissions: this.getUserPermissions(user.role)
        };
        const newTokenPair = jwt_service_1.JwtService.generateTokenPair(userData.id, userData.tenantId, userData.email, userData.role, userData.permissions);
        refreshTokenStore.delete(payload.tokenId);
        const newRefreshPayload = jwt_service_1.JwtService.verifyRefreshToken(newTokenPair.refreshToken);
        refreshTokenStore.set(newRefreshPayload.tokenId, {
            userId: userData.id,
            tenantId: userData.tenantId,
            tokenId: newRefreshPayload.tokenId,
            expiresAt: new Date(Date.now() + (newTokenPair.refreshExpiresIn * 1000)),
            isRevoked: false,
        });
        logger_1.loggers.auth.tokenRefresh(userData.id, userData.tenantId, {
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
    static logout = (0, error_middleware_1.asyncHandler)(async (req, res) => {
        const { refreshToken } = req.body;
        const user = req.user;
        if (refreshToken) {
            try {
                const payload = jwt_service_1.JwtService.verifyRefreshToken(refreshToken);
                refreshTokenStore.delete(payload.tokenId);
            }
            catch {
            }
        }
        if (user) {
            logger_1.loggers.auth.logout(user.userId, user.tenantId, {
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
    static getProfile = (0, error_middleware_1.asyncHandler)(async (req, res) => {
        const user = req.user;
        if (!user) {
            throw new error_middleware_1.AuthenticationError('User not authenticated');
        }
        const fullUser = await this.findUserByEmailAndTenant(user.email, user.tenantId);
        if (!fullUser) {
            throw new error_middleware_1.AuthenticationError('User not found');
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
    static updateProfile = (0, error_middleware_1.asyncHandler)(async (req, res) => {
        const user = req.user;
        if (!user) {
            throw new error_middleware_1.AuthenticationError('User not authenticated');
        }
        const { error, value } = updateProfileSchema.validate(req.body);
        if (error) {
            throw new error_middleware_1.ValidationError(error.details.map(d => d.message).join(', '));
        }
        const { firstName, lastName, timezone, preferences } = value;
        try {
            const prisma = this.getPrisma();
            const tenant = await prisma.tenant.findUnique({
                where: { id: user.tenantId, isActive: true }
            });
            if (!tenant) {
                throw new error_middleware_1.ValidationError('Invalid tenant');
            }
            const tenantContext = {
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
            logger_1.logger.info('User profile updated', {
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
        }
        catch (error) {
            logger_1.logger.error('Profile update failed', {
                userId: user.userId,
                tenantId: user.tenantId,
                error
            });
            throw new error_middleware_1.AppError('Failed to update profile', 500);
        }
    });
    static changePassword = (0, error_middleware_1.asyncHandler)(async (req, res) => {
        const { currentPassword, newPassword } = req.body;
        const user = req.user;
        if (!user) {
            throw new error_middleware_1.AuthenticationError('User not authenticated');
        }
        if (!currentPassword || !newPassword) {
            throw new error_middleware_1.ValidationError('Current password and new password are required');
        }
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
                password: true,
                preferences: true,
                timezone: true,
                createdAt: true,
                updatedAt: true
            }
        });
        if (!fullUser) {
            throw new error_middleware_1.AuthenticationError('User not found');
        }
        const isCurrentPasswordValid = await password_service_1.PasswordService.verifyPassword(currentPassword, fullUser.password);
        if (!isCurrentPasswordValid) {
            throw new error_middleware_1.ValidationError('Current password is incorrect');
        }
        const hashedNewPassword = await password_service_1.PasswordService.hashPassword(newPassword);
        await prisma.user.update({
            where: { id: user.userId },
            data: { password: hashedNewPassword }
        });
        logger_1.logger.info('Password changed successfully', {
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
    static validatePassword = (0, error_middleware_1.asyncHandler)(async (req, res) => {
        const { password } = req.body;
        if (!password) {
            throw new error_middleware_1.ValidationError('Password is required');
        }
        const validation = password_service_1.PasswordService.validatePassword(password);
        res.json({
            success: true,
            data: validation,
            timestamp: new Date().toISOString(),
        });
    });
    static revokeAllTokens = (0, error_middleware_1.asyncHandler)(async (req, res) => {
        const user = req.user;
        if (!user) {
            throw new error_middleware_1.AuthenticationError('User not authenticated');
        }
        let revokedCount = 0;
        for (const [tokenId, tokenData] of refreshTokenStore.entries()) {
            if (tokenData.userId === user.userId) {
                refreshTokenStore.delete(tokenId);
                revokedCount++;
            }
        }
        logger_1.logger.info('All tokens revoked for user', {
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
    static healthCheck = (0, error_middleware_1.asyncHandler)(async (req, res) => {
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
exports.AuthController = AuthController;
//# sourceMappingURL=auth.controller.js.map