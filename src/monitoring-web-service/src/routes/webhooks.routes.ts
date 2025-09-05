/**
 * Webhooks Routes
 * Task 4.3: Webhook system for Claude Code integration and notifications
 * 
 * Provides webhook endpoints for real-time Claude Code integration and event notifications
 */

import { Router, Request, Response } from 'express';
import { WebhookService } from '../services/webhook.service';
import { DatabaseConnection } from '../database/connection';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.middleware';
import { validationMiddleware } from '../middleware/validation.middleware';
import { webhookSignatureMiddleware } from '../middleware/webhook-signature.middleware';
import rateLimit from 'express-rate-limit';
import * as winston from 'winston';

export interface WebhookRoutes {
  router: Router;
}

export interface WebhookPayload {
  event: string;
  timestamp: number;
  source: string;
  data: any;
  metadata?: {
    claude_session?: string;
    organization_id?: string;
    user_id?: string;
  };
}

export interface WebhookResponse {
  success: boolean;
  message: string;
  event_id?: string;
  processed_at: string;
}

export function createWebhookRoutes(
  db: DatabaseConnection,
  logger: winston.Logger
): WebhookRoutes {
  const router = Router();
  const webhookService = new WebhookService(db, logger);

  // Webhook-specific rate limiting
  const webhookRateLimit = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 200, // 200 webhook calls per minute per source
    message: {
      success: false,
      message: 'Webhook rate limit exceeded',
      error: 'too_many_requests',
      retry_after: 60
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      // Use source IP + webhook source for rate limiting
      const payload = req.body as WebhookPayload;
      return `${req.ip}-${payload?.source || 'unknown'}`;
    }
  });

  /**
   * POST /api/webhooks/claude-code
   * Main webhook endpoint for Claude Code events
   */
  router.post('/claude-code',
    webhookRateLimit,
    webhookSignatureMiddleware,
    validationMiddleware,
    async (req: Request, res: Response) => {
      try {
        const payload = req.body as WebhookPayload;
        
        // Validate webhook payload
        if (!payload.event || !payload.timestamp || !payload.source) {
          return res.status(400).json({
            success: false,
            message: 'Invalid webhook payload',
            error: 'missing_required_fields',
            required_fields: ['event', 'timestamp', 'source']
          });
        }

        // Process webhook event
        const result = await webhookService.processClaudeCodeEvent(payload);

        const response: WebhookResponse = {
          success: result.success,
          message: result.message,
          event_id: result.event_id,
          processed_at: new Date().toISOString()
        };

        res.status(result.success ? 200 : 400).json(response);

      } catch (error) {
        logger.error('Claude Code webhook error:', error);
        
        const errorResponse: WebhookResponse = {
          success: false,
          message: 'Webhook processing failed',
          processed_at: new Date().toISOString()
        };
        
        res.status(500).json(errorResponse);
      }
    }
  );

  /**
   * POST /api/webhooks/agent-events
   * Webhook endpoint for agent-specific events
   */
  router.post('/agent-events',
    webhookRateLimit,
    webhookSignatureMiddleware,
    validationMiddleware,
    async (req: Request, res: Response) => {
      try {
        const payload = req.body as WebhookPayload;

        const result = await webhookService.processAgentEvent(payload);

        res.status(result.success ? 200 : 400).json({
          success: result.success,
          message: result.message,
          event_id: result.event_id,
          processed_at: new Date().toISOString()
        });

      } catch (error) {
        logger.error('Agent events webhook error:', error);
        res.status(500).json({
          success: false,
          message: 'Agent event processing failed',
          processed_at: new Date().toISOString()
        });
      }
    }
  );

  /**
   * POST /api/webhooks/productivity-alerts
   * Webhook endpoint for productivity threshold alerts
   */
  router.post('/productivity-alerts',
    webhookRateLimit,
    authMiddleware,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const alertData = req.body;
        
        const result = await webhookService.processProductivityAlert(
          req.user!.organization_id,
          alertData
        );

        res.json({
          success: result.success,
          message: result.message,
          alert_id: result.alert_id,
          processed_at: new Date().toISOString()
        });

      } catch (error) {
        logger.error('Productivity alerts webhook error:', error);
        res.status(500).json({
          success: false,
          message: 'Alert processing failed',
          processed_at: new Date().toISOString()
        });
      }
    }
  );

  /**
   * GET /api/webhooks/subscriptions
   * List active webhook subscriptions for organization
   */
  router.get('/subscriptions',
    authMiddleware,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const subscriptions = await webhookService.getSubscriptions(req.user!.organization_id);
        res.json({
          subscriptions,
          total: subscriptions.length,
          retrieved_at: new Date().toISOString()
        });
      } catch (error) {
        logger.error('Error retrieving webhook subscriptions:', error);
        res.status(500).json({
          error: 'Failed to retrieve subscriptions',
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
    authMiddleware,
    validationMiddleware,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const subscription = await webhookService.createSubscription(
          req.user!.organization_id,
          req.body
        );

        res.status(201).json({
          success: true,
          subscription,
          created_at: new Date().toISOString()
        });

      } catch (error) {
        logger.error('Error creating webhook subscription:', error);
        res.status(400).json({
          success: false,
          message: 'Failed to create subscription',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  /**
   * PUT /api/webhooks/subscriptions/:id
   * Update webhook subscription
   */
  router.put('/subscriptions/:id',
    authMiddleware,
    validationMiddleware,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const subscriptionId = req.params.id;
        const updates = req.body;

        const subscription = await webhookService.updateSubscription(
          req.user!.organization_id,
          subscriptionId,
          updates
        );

        if (!subscription) {
          return res.status(404).json({
            success: false,
            message: 'Subscription not found'
          });
        }

        res.json({
          success: true,
          subscription,
          updated_at: new Date().toISOString()
        });

      } catch (error) {
        logger.error('Error updating webhook subscription:', error);
        res.status(400).json({
          success: false,
          message: 'Failed to update subscription',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  /**
   * DELETE /api/webhooks/subscriptions/:id
   * Delete webhook subscription
   */
  router.delete('/subscriptions/:id',
    authMiddleware,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const subscriptionId = req.params.id;

        const deleted = await webhookService.deleteSubscription(
          req.user!.organization_id,
          subscriptionId
        );

        if (!deleted) {
          return res.status(404).json({
            success: false,
            message: 'Subscription not found'
          });
        }

        res.json({
          success: true,
          message: 'Subscription deleted successfully',
          deleted_at: new Date().toISOString()
        });

      } catch (error) {
        logger.error('Error deleting webhook subscription:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to delete subscription',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  /**
   * POST /api/webhooks/test
   * Test webhook endpoint connectivity
   */
  router.post('/test',
    authMiddleware,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { webhook_url, event_type = 'test' } = req.body;

        if (!webhook_url) {
          return res.status(400).json({
            success: false,
            message: 'webhook_url is required'
          });
        }

        const result = await webhookService.testWebhook(webhook_url, {
          event: event_type,
          timestamp: Date.now(),
          source: 'fortium-metrics-test',
          data: {
            test: true,
            organization_id: req.user!.organization_id
          }
        });

        res.json({
          success: result.success,
          message: result.message,
          response_time_ms: result.response_time_ms,
          status_code: result.status_code,
          tested_at: new Date().toISOString()
        });

      } catch (error) {
        logger.error('Webhook test error:', error);
        res.status(500).json({
          success: false,
          message: 'Webhook test failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  /**
   * GET /api/webhooks/events/:id
   * Get webhook event details by ID
   */
  router.get('/events/:id',
    authMiddleware,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const eventId = req.params.id;

        const event = await webhookService.getWebhookEvent(
          req.user!.organization_id,
          eventId
        );

        if (!event) {
          return res.status(404).json({
            success: false,
            message: 'Webhook event not found'
          });
        }

        res.json({
          success: true,
          event,
          retrieved_at: new Date().toISOString()
        });

      } catch (error) {
        logger.error('Error retrieving webhook event:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to retrieve webhook event',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  /**
   * GET /api/webhooks/events
   * List webhook events for organization with filtering
   */
  router.get('/events',
    authMiddleware,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const {
          event_type,
          source,
          status,
          from_date,
          to_date,
          limit = '50',
          offset = '0'
        } = req.query;

        const filters = {
          event_type: event_type as string,
          source: source as string,
          status: status as string,
          from_date: from_date as string,
          to_date: to_date as string,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string)
        };

        const result = await webhookService.getWebhookEvents(
          req.user!.organization_id,
          filters
        );

        res.json({
          success: true,
          events: result.events,
          total: result.total,
          pagination: {
            limit: filters.limit,
            offset: filters.offset,
            has_more: result.total > (filters.offset + filters.limit)
          },
          retrieved_at: new Date().toISOString()
        });

      } catch (error) {
        logger.error('Error retrieving webhook events:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to retrieve webhook events',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  /**
   * POST /api/webhooks/replay/:id
   * Replay a webhook event
   */
  router.post('/replay/:id',
    authMiddleware,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const eventId = req.params.id;

        const result = await webhookService.replayWebhookEvent(
          req.user!.organization_id,
          eventId
        );

        if (!result.success) {
          return res.status(400).json(result);
        }

        res.json({
          success: true,
          message: 'Webhook event replayed successfully',
          original_event_id: eventId,
          new_event_id: result.new_event_id,
          replayed_at: new Date().toISOString()
        });

      } catch (error) {
        logger.error('Error replaying webhook event:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to replay webhook event',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  return { router };
}