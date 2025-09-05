/**
 * Webhook Routes
 * Task 4.3: Webhook endpoints for Claude Code integration and notifications
 * 
 * Handles webhook subscription management and event processing
 */

import { Router, Request, Response } from 'express';
import { WebhookService } from '../services/webhook.service';
import { DatabaseConnection } from '../database/connection';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.middleware';
import rateLimit from 'express-rate-limit';
import * as winston from 'winston';
import crypto from 'crypto';

export interface WebhookRoutes {
  router: Router;
}

export function createWebhookRoutes(
  db: DatabaseConnection,
  logger: winston.Logger
): WebhookRoutes {
  const router = Router();
  const webhookService = new WebhookService(db, logger);

  // Rate limiting for webhook endpoints
  const webhookRateLimit = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute per IP
    message: {
      error: 'Too many webhook requests',
      retry_after: 60
    },
    standardHeaders: true,
    legacyHeaders: false
  });

  // Rate limiting for incoming webhooks (more permissive)
  const incomingWebhookRateLimit = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 1000, // 1000 incoming webhooks per minute per IP
    message: {
      error: 'Too many incoming webhook requests',
      retry_after: 60
    },
    standardHeaders: true,
    legacyHeaders: false
  });

  /**
   * GET /api/webhooks/subscriptions
   * Get all webhook subscriptions for organization
   */
  router.get('/subscriptions',
    webhookRateLimit,
    authMiddleware,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const subscriptions = await webhookService.getSubscriptions(req.user!.organization_id);
        
        // Remove sensitive data (secrets) from response
        const sanitizedSubscriptions = subscriptions.map(sub => ({
          ...sub,
          secret: sub.secret ? '***hidden***' : undefined
        }));

        res.json({
          subscriptions: sanitizedSubscriptions,
          total: subscriptions.length
        });

      } catch (error) {
        logger.error('Error getting webhook subscriptions:', error);
        res.status(500).json({
          error: 'Failed to retrieve webhook subscriptions',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  /**
   * POST /api/webhooks/subscriptions
   * Create new webhook subscription
   */
  router.post('/subscriptions',
    webhookRateLimit,
    authMiddleware,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { webhook_url, event_types, retry_settings } = req.body;

        if (!webhook_url || !Array.isArray(event_types)) {
          return res.status(400).json({
            error: 'Invalid request',
            message: 'webhook_url and event_types are required'
          });
        }

        // Validate URL format
        try {
          new URL(webhook_url);
        } catch {
          return res.status(400).json({
            error: 'Invalid webhook_url',
            message: 'webhook_url must be a valid HTTP/HTTPS URL'
          });
        }

        // Test webhook endpoint before creating subscription
        const testResult = await webhookService.testWebhook(webhook_url, {
          event: 'webhook.test',
          timestamp: Date.now(),
          data: { message: 'This is a test webhook' }
        });

        if (!testResult.success) {
          return res.status(400).json({
            error: 'Webhook endpoint test failed',
            message: testResult.message,
            response_time_ms: testResult.response_time_ms
          });
        }

        const subscription = await webhookService.createSubscription(
          req.user!.organization_id,
          {
            webhook_url,
            event_types,
            retry_settings: retry_settings || {
              max_retries: 3,
              retry_delay_ms: 5000,
              exponential_backoff: true
            }
          }
        );

        // Remove secret from response
        const response = {
          ...subscription,
          secret: '***hidden***'
        };

        res.status(201).json({
          subscription: response,
          test_result: testResult
        });

      } catch (error) {
        logger.error('Error creating webhook subscription:', error);
        res.status(500).json({
          error: 'Failed to create webhook subscription',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  /**
   * PUT /api/webhooks/subscriptions/:id
   * Update webhook subscription
   */
  router.put('/subscriptions/:id',
    webhookRateLimit,
    authMiddleware,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { id } = req.params;
        const updates = req.body;

        // Validate webhook_url if provided
        if (updates.webhook_url) {
          try {
            new URL(updates.webhook_url);
          } catch {
            return res.status(400).json({
              error: 'Invalid webhook_url',
              message: 'webhook_url must be a valid HTTP/HTTPS URL'
            });
          }
        }

        const subscription = await webhookService.updateSubscription(
          req.user!.organization_id,
          id,
          updates
        );

        if (!subscription) {
          return res.status(404).json({
            error: 'Webhook subscription not found'
          });
        }

        // Remove secret from response
        const response = {
          ...subscription,
          secret: '***hidden***'
        };

        res.json({ subscription: response });

      } catch (error) {
        logger.error('Error updating webhook subscription:', error);
        res.status(500).json({
          error: 'Failed to update webhook subscription',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  /**
   * DELETE /api/webhooks/subscriptions/:id
   * Delete webhook subscription
   */
  router.delete('/subscriptions/:id',
    webhookRateLimit,
    authMiddleware,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { id } = req.params;

        const deleted = await webhookService.deleteSubscription(
          req.user!.organization_id,
          id
        );

        if (!deleted) {
          return res.status(404).json({
            error: 'Webhook subscription not found'
          });
        }

        res.status(204).send();

      } catch (error) {
        logger.error('Error deleting webhook subscription:', error);
        res.status(500).json({
          error: 'Failed to delete webhook subscription',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  /**
   * POST /api/webhooks/subscriptions/:id/test
   * Test webhook subscription
   */
  router.post('/subscriptions/:id/test',
    webhookRateLimit,
    authMiddleware,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { id } = req.params;
        
        const subscriptions = await webhookService.getSubscriptions(req.user!.organization_id);
        const subscription = subscriptions.find(s => s.id === id);

        if (!subscription) {
          return res.status(404).json({
            error: 'Webhook subscription not found'
          });
        }

        const testPayload = {
          event: 'webhook.test',
          timestamp: Date.now(),
          organization_id: req.user!.organization_id,
          data: {
            message: 'This is a test webhook from Fortium Metrics Server',
            subscription_id: id,
            test_timestamp: new Date().toISOString()
          }
        };

        const testResult = await webhookService.testWebhook(
          subscription.webhook_url,
          testPayload
        );

        res.json(testResult);

      } catch (error) {
        logger.error('Error testing webhook subscription:', error);
        res.status(500).json({
          error: 'Failed to test webhook subscription',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  /**
   * POST /api/webhooks/claude-code
   * Receive webhook from Claude Code instances
   */
  router.post('/claude-code',
    incomingWebhookRateLimit,
    async (req: Request, res: Response) => {
      try {
        // Validate webhook signature if provided
        const signature = req.headers['x-claude-signature'] as string;
        const timestamp = req.headers['x-claude-timestamp'] as string;
        const payload = req.body;

        if (!payload || !payload.event || !payload.metadata?.organization_id) {
          return res.status(400).json({
            error: 'Invalid webhook payload',
            message: 'Missing required fields: event, metadata.organization_id'
          });
        }

        // Process the Claude Code event
        const result = await webhookService.processClaudeCodeEvent(payload);

        if (!result.success) {
          logger.warn('Failed to process Claude Code webhook', {
            payload,
            result
          });
          
          return res.status(422).json({
            error: 'Failed to process webhook',
            message: result.message
          });
        }

        res.json({
          success: true,
          message: result.message,
          event_id: result.event_id
        });

      } catch (error) {
        logger.error('Error processing Claude Code webhook:', error);
        res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to process webhook'
        });
      }
    }
  );

  /**
   * POST /api/webhooks/agent
   * Receive webhook from AI agents
   */
  router.post('/agent',
    incomingWebhookRateLimit,
    async (req: Request, res: Response) => {
      try {
        const payload = req.body;

        if (!payload || !payload.event || !payload.metadata?.organization_id) {
          return res.status(400).json({
            error: 'Invalid webhook payload',
            message: 'Missing required fields: event, metadata.organization_id'
          });
        }

        const result = await webhookService.processAgentEvent(payload);

        if (!result.success) {
          return res.status(422).json({
            error: 'Failed to process webhook',
            message: result.message
          });
        }

        res.json({
          success: true,
          message: result.message,
          event_id: result.event_id
        });

      } catch (error) {
        logger.error('Error processing agent webhook:', error);
        res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to process webhook'
        });
      }
    }
  );

  /**
   * GET /api/webhooks/events
   * Get webhook events for organization
   */
  router.get('/events',
    webhookRateLimit,
    authMiddleware,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const {
          event_type,
          status,
          from_date,
          to_date,
          limit = 100,
          offset = 0
        } = req.query;

        const filters = {
          event_type: event_type as string,
          status: status as string,
          from_date: from_date ? new Date(from_date as string) : undefined,
          to_date: to_date ? new Date(to_date as string) : undefined,
          limit: Math.min(parseInt(limit as string) || 100, 1000), // Max 1000
          offset: parseInt(offset as string) || 0
        };

        const result = await webhookService.getWebhookEvents(
          req.user!.organization_id,
          filters
        );

        res.json({
          events: result.events,
          total: result.total,
          limit: filters.limit,
          offset: filters.offset
        });

      } catch (error) {
        logger.error('Error getting webhook events:', error);
        res.status(500).json({
          error: 'Failed to retrieve webhook events',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  /**
   * POST /api/webhooks/events/:id/replay
   * Replay a webhook event
   */
  router.post('/events/:id/replay',
    webhookRateLimit,
    authMiddleware,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { id } = req.params;

        const result = await webhookService.replayWebhookEvent(
          req.user!.organization_id,
          id
        );

        if (!result.success) {
          return res.status(404).json({
            error: 'Webhook event not found or cannot be replayed'
          });
        }

        res.json({
          success: true,
          message: 'Webhook event replayed successfully',
          new_event_id: result.new_event_id
        });

      } catch (error) {
        logger.error('Error replaying webhook event:', error);
        res.status(500).json({
          error: 'Failed to replay webhook event',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  /**
   * POST /api/webhooks/productivity-alert
   * Trigger productivity alert webhook
   */
  router.post('/productivity-alert',
    incomingWebhookRateLimit,
    authMiddleware,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const alertData = req.body;

        if (!alertData.type || !alertData.threshold || !alertData.current_value) {
          return res.status(400).json({
            error: 'Invalid alert data',
            message: 'type, threshold, and current_value are required'
          });
        }

        const result = await webhookService.processProductivityAlert(
          req.user!.organization_id,
          alertData
        );

        res.json({
          success: result.success,
          message: result.message,
          alert_id: result.alert_id
        });

      } catch (error) {
        logger.error('Error processing productivity alert:', error);
        res.status(500).json({
          error: 'Failed to process productivity alert',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  /**
   * GET /api/webhooks/health
   * Webhook service health check
   */
  router.get('/health', async (req: Request, res: Response) => {
    try {
      // Basic health check
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'webhook-service',
        version: '1.0.0'
      };

      res.json(health);

    } catch (error) {
      logger.error('Webhook service health check failed:', error);
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return { router };
}