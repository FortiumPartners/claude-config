/**
 * SAML Authentication Routes
 * Express routes for SAML 2.0 authentication endpoints
 */

import { Router } from 'express';
import { body, param, query } from 'express-validator';
import * as winston from 'winston';
import { DatabaseConnection } from '../database/connection';
import { SAMLAuthController } from '../auth/saml/saml-auth.controller';

// Validation middleware for request validation
const validateRequest = (req: any, res: any, next: any) => {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array(),
    });
  }
  next();
};

// Rate limiting middleware for SAML endpoints
const rateLimitMiddleware = (req: any, res: any, next: any) => {
  // Implement rate limiting logic here
  // For now, just pass through
  next();
};

// CORS middleware for SAML endpoints
const corsMiddleware = (req: any, res: any, next: any) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
};

export function createSAMLRoutes(db: DatabaseConnection, logger: winston.Logger): Router {
  const router = Router();
  const controller = new SAMLAuthController(db, logger);

  // Apply middleware to all SAML routes
  router.use(corsMiddleware);
  router.use(rateLimitMiddleware);

  /**
   * GET /auth/saml/metadata/:org
   * Service Provider metadata endpoint
   */
  router.get(
    '/metadata/:org',
    [
      param('org')
        .isLength({ min: 1, max: 50 })
        .matches(/^[a-zA-Z0-9_-]+$/)
        .withMessage('Organization slug must be alphanumeric with hyphens/underscores'),
    ],
    validateRequest,
    async (req, res) => {
      await controller.getMetadata(req, res);
    }
  );

  /**
   * POST /auth/saml/sso/:provider
   * Initiate SAML SSO flow
   */
  router.post(
    '/sso/:provider',
    [
      param('provider')
        .isIn(['okta-saml', 'azure-saml', 'generic-saml'])
        .withMessage('Invalid SAML provider'),
      body('org')
        .isLength({ min: 1, max: 50 })
        .matches(/^[a-zA-Z0-9_-]+$/)
        .withMessage('Organization slug is required'),
      body('redirect_uri')
        .optional()
        .isURL({ require_protocol: true })
        .withMessage('Redirect URI must be a valid URL'),
    ],
    validateRequest,
    async (req, res) => {
      await controller.initiateSSOFlow(req, res);
    }
  );

  /**
   * POST /auth/saml/acs/:provider
   * Assertion Consumer Service - handles SAML Response
   */
  router.post(
    '/acs/:provider',
    [
      param('provider')
        .isIn(['okta-saml', 'azure-saml', 'generic-saml'])
        .withMessage('Invalid SAML provider'),
      body('SAMLResponse')
        .isLength({ min: 1 })
        .withMessage('SAMLResponse is required'),
      body('RelayState')
        .optional()
        .isLength({ max: 500 })
        .withMessage('RelayState too long'),
    ],
    validateRequest,
    async (req, res) => {
      await controller.handleAssertionConsumer(req, res);
    }
  );

  /**
   * GET /auth/saml/acs/:provider
   * Alternative ACS endpoint for HTTP-Redirect binding
   */
  router.get(
    '/acs/:provider',
    [
      param('provider')
        .isIn(['okta-saml', 'azure-saml', 'generic-saml'])
        .withMessage('Invalid SAML provider'),
      query('SAMLResponse')
        .isLength({ min: 1 })
        .withMessage('SAMLResponse is required'),
      query('RelayState')
        .optional()
        .isLength({ max: 500 })
        .withMessage('RelayState too long'),
    ],
    validateRequest,
    async (req, res) => {
      // Convert query parameters to body format for controller
      req.body = {
        SAMLResponse: req.query.SAMLResponse,
        RelayState: req.query.RelayState,
      };
      await controller.handleAssertionConsumer(req, res);
    }
  );

  /**
   * GET /auth/saml/slo/:provider
   * Single Logout Service (HTTP-Redirect binding)
   */
  router.get(
    '/slo/:provider',
    [
      param('provider')
        .isIn(['okta-saml', 'azure-saml', 'generic-saml'])
        .withMessage('Invalid SAML provider'),
      query('SAMLRequest')
        .optional()
        .isLength({ min: 1 })
        .withMessage('Invalid SAMLRequest'),
      query('RelayState')
        .optional()
        .isLength({ max: 500 })
        .withMessage('RelayState too long'),
    ],
    validateRequest,
    async (req, res) => {
      await controller.handleSingleLogout(req, res);
    }
  );

  /**
   * POST /auth/saml/slo/:provider
   * Single Logout Service (HTTP-POST binding)
   */
  router.post(
    '/slo/:provider',
    [
      param('provider')
        .isIn(['okta-saml', 'azure-saml', 'generic-saml'])
        .withMessage('Invalid SAML provider'),
      body('SAMLRequest')
        .optional()
        .isLength({ min: 1 })
        .withMessage('Invalid SAMLRequest'),
      body('RelayState')
        .optional()
        .isLength({ max: 500 })
        .withMessage('RelayState too long'),
    ],
    validateRequest,
    async (req, res) => {
      await controller.handleSingleLogout(req, res);
    }
  );

  return router;
}

/**
 * Create SAML Admin Routes
 * Administrative endpoints for SAML configuration
 */
export function createSAMLAdminRoutes(db: DatabaseConnection, logger: winston.Logger): Router {
  const router = Router();
  const controller = new SAMLAuthController(db, logger);

  // Apply authentication middleware (assumes you have this)
  // router.use(authenticateJWT);
  // router.use(requireRole(['admin']));

  /**
   * POST /api/auth/saml/config
   * Configure SAML for tenant
   */
  router.post(
    '/config',
    [
      body('provider')
        .isIn(['okta-saml', 'azure-saml', 'generic-saml'])
        .withMessage('Invalid SAML provider'),
      body('entity_id')
        .isLength({ min: 1, max: 500 })
        .matches(/^https?:\/\/.+/)
        .withMessage('Entity ID must be a valid URL'),
      body('sso_url')
        .isURL({ require_protocol: true, protocols: ['https'] })
        .withMessage('SSO URL must be a valid HTTPS URL'),
      body('slo_url')
        .optional()
        .isURL({ require_protocol: true, protocols: ['https'] })
        .withMessage('SLO URL must be a valid HTTPS URL'),
      body('certificate')
        .isLength({ min: 1 })
        .matches(/^-----BEGIN CERTIFICATE-----[\s\S]*-----END CERTIFICATE-----$/)
        .withMessage('Certificate must be in valid PEM format'),
      body('name_id_format')
        .optional()
        .isIn([
          'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
          'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent',
          'urn:oasis:names:tc:SAML:2.0:nameid-format:transient',
        ])
        .withMessage('Invalid NameID format'),
      body('attribute_mapping')
        .optional()
        .isObject()
        .withMessage('Attribute mapping must be an object'),
      body('attribute_mapping.email')
        .if(body('attribute_mapping').exists())
        .isLength({ min: 1 })
        .withMessage('Email attribute mapping is required'),
    ],
    validateRequest,
    async (req, res) => {
      await controller.configureSAML(req, res);
    }
  );

  /**
   * GET /api/auth/saml/providers
   * Get supported SAML providers
   */
  router.get('/providers', async (req, res) => {
    try {
      const { SAMLConfigService } = require('../auth/saml/saml-config.service');
      const configService = new SAMLConfigService(db, logger);
      
      const providers = configService.getSupportedProviders();
      
      res.json({
        success: true,
        providers,
      });
    } catch (error) {
      logger.error('Failed to get SAML providers', { error: error.message });
      res.status(500).json({ error: 'Failed to get providers' });
    }
  });

  /**
   * GET /api/auth/saml/config
   * Get current SAML configurations for organization
   */
  router.get('/config', async (req: any, res) => {
    try {
      if (!req.user || !req.user.organization_id) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { SAMLConfigService } = require('../auth/saml/saml-config.service');
      const configService = new SAMLConfigService(db, logger);

      const configs = await configService.getOrganizationSAMLConfigs(req.user.organization_id);

      // Remove sensitive data
      const publicConfigs = configs.map(config => ({
        id: config.id,
        provider: config.provider,
        entity_id: config.entity_id,
        sso_url: config.sso_url,
        name_id_format: config.name_id_format,
        is_active: config.is_active,
        created_at: config.created_at,
        updated_at: config.updated_at,
      }));

      res.json({
        success: true,
        configs: publicConfigs,
      });
    } catch (error) {
      logger.error('Failed to get SAML configurations', { error: error.message });
      res.status(500).json({ error: 'Failed to get configurations' });
    }
  });

  /**
   * DELETE /api/auth/saml/config/:provider
   * Delete SAML configuration
   */
  router.delete(
    '/config/:provider',
    [
      param('provider')
        .isIn(['okta-saml', 'azure-saml', 'generic-saml'])
        .withMessage('Invalid SAML provider'),
    ],
    validateRequest,
    async (req: any, res) => {
      try {
        if (!req.user || req.user.role !== 'admin') {
          res.status(403).json({ error: 'Admin permissions required' });
          return;
        }

        const { provider } = req.params;
        const { SAMLConfigService } = require('../auth/saml/saml-config.service');
        const configService = new SAMLConfigService(db, logger);

        const deleted = await configService.deleteSAMLConfig(req.user.organization_id, provider);

        if (deleted) {
          res.json({ success: true, message: 'Configuration deleted' });
        } else {
          res.status(404).json({ error: 'Configuration not found' });
        }
      } catch (error) {
        logger.error('Failed to delete SAML configuration', { error: error.message });
        res.status(500).json({ error: 'Failed to delete configuration' });
      }
    }
  );

  return router;
}

/**
 * Create complete SAML route module
 */
export function createSAMLRouteModule(db: DatabaseConnection, logger: winston.Logger) {
  const authRoutes = createSAMLRoutes(db, logger);
  const adminRoutes = createSAMLAdminRoutes(db, logger);

  return {
    authRoutes,
    adminRoutes,
  };
}