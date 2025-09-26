/**
 * Authentication Routes
 * Fortium External Metrics Web Service - Task 1.8: API Routing Structure
 */

import { Router } from 'express';
import { AuthController } from '../auth/auth.controller';
import { authRateLimit } from '../middleware/security.middleware';
import { authenticateToken, optionalAuth } from '../auth/auth.middleware';
import { validate, authSchemas } from '../utils/validation';
import { responseMiddleware } from '../utils/response';
import { asyncHandler } from '../middleware/error.middleware';

const router = Router();

// Apply response middleware to all auth routes
router.use(responseMiddleware);

/**
 * @route   POST /auth/login
 * @desc    Authenticate user and get tokens
 * @access  Public
 * @rateLimit 5 attempts per 15 minutes
 */
router.post('/login',
  authRateLimit,
  validate(authSchemas.login),
  AuthController.login
);

/**
 * @route   POST /auth/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public
 * @rateLimit Standard rate limit
 */
router.post('/refresh',
  validate(authSchemas.refreshToken),
  AuthController.refreshToken
);

/**
 * @route   POST /auth/logout
 * @desc    Logout user (revoke refresh token)
 * @access  Public (optionally authenticated)
 */
router.post('/logout',
  optionalAuth,
  AuthController.logout
);

/**
 * @route   GET /auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile',
  authenticateToken,
  AuthController.getProfile
);

/**
 * @route   PUT /auth/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile',
  authenticateToken,
  AuthController.updateProfile
);

/**
 * @route   POST /auth/sso/user
 * @desc    Create or update SSO user
 * @access  Public (called by SSO callback)
 */
router.post('/sso/user',
  AuthController.createOrUpdateSSOUser
);

/**
 * @route   PUT /auth/password
 * @desc    Change user password
 * @access  Private
 */
router.put('/password',
  authenticateToken,
  validate(authSchemas.changePassword),
  AuthController.changePassword
);

/**
 * @route   POST /auth/validate-password
 * @desc    Validate password strength
 * @access  Public
 */
router.post('/validate-password',
  validate(authSchemas.validatePassword),
  AuthController.validatePassword
);

/**
 * @route   POST /auth/revoke-all
 * @desc    Revoke all refresh tokens (logout from all devices)
 * @access  Private
 */
router.post('/revoke-all',
  authenticateToken,
  AuthController.revokeAllTokens
);

/**
 * @route   GET /auth/tenant
 * @desc    Get current user's tenant information
 * @access  Private
 */
router.get('/tenant',
  authenticateToken,
  AuthController.getUserTenant
);

/**
 * @route   GET /auth/health
 * @desc    Authentication service health check
 * @access  Public
 */
router.get('/health',
  AuthController.healthCheck
);

export function createAuthRoutes(): Router {
  return router;
}

export default router;