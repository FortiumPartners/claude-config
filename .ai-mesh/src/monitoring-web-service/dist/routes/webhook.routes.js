"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWebhookRoutes = createWebhookRoutes;
const express_1 = require("express");
const webhook_service_1 = require("../services/webhook.service");
const auth_middleware_1 = require("../middleware/auth.middleware");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
function createWebhookRoutes(db, logger) {
    const router = (0, express_1.Router)();
    const webhookService = new webhook_service_1.WebhookService(db, logger);
    const webhookRateLimit = (0, express_rate_limit_1.default)({
        windowMs: 60 * 1000,
        max: 100,
        message: {
            error: 'Too many webhook requests',
            retry_after: 60
        },
        standardHeaders: true,
        legacyHeaders: false
    });
    const incomingWebhookRateLimit = (0, express_rate_limit_1.default)({
        windowMs: 60 * 1000,
        max: 1000,
        message: {
            error: 'Too many incoming webhook requests',
            retry_after: 60
        },
        standardHeaders: true,
        legacyHeaders: false
    });
    router.get('/subscriptions', webhookRateLimit, auth_middleware_1.authMiddleware, async (req, res) => {
        try {
            const subscriptions = await webhookService.getSubscriptions(req.user.organization_id);
            const sanitizedSubscriptions = subscriptions.map(sub => ({
                ...sub,
                secret: sub.secret ? '***hidden***' : undefined
            }));
            res.json({
                subscriptions: sanitizedSubscriptions,
                total: subscriptions.length
            });
        }
        catch (error) {
            logger.error('Error getting webhook subscriptions:', error);
            res.status(500).json({
                error: 'Failed to retrieve webhook subscriptions',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });
    router.post('/subscriptions', webhookRateLimit, auth_middleware_1.authMiddleware, async (req, res) => {
        try {
            const { webhook_url, event_types, retry_settings } = req.body;
            if (!webhook_url || !Array.isArray(event_types)) {
                return res.status(400).json({
                    error: 'Invalid request',
                    message: 'webhook_url and event_types are required'
                });
            }
            try {
                new URL(webhook_url);
            }
            catch {
                return res.status(400).json({
                    error: 'Invalid webhook_url',
                    message: 'webhook_url must be a valid HTTP/HTTPS URL'
                });
            }
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
            const subscription = await webhookService.createSubscription(req.user.organization_id, {
                webhook_url,
                event_types,
                retry_settings: retry_settings || {
                    max_retries: 3,
                    retry_delay_ms: 5000,
                    exponential_backoff: true
                }
            });
            const response = {
                ...subscription,
                secret: '***hidden***'
            };
            res.status(201).json({
                subscription: response,
                test_result: testResult
            });
        }
        catch (error) {
            logger.error('Error creating webhook subscription:', error);
            res.status(500).json({
                error: 'Failed to create webhook subscription',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });
    router.put('/subscriptions/:id', webhookRateLimit, auth_middleware_1.authMiddleware, async (req, res) => {
        try {
            const { id } = req.params;
            const updates = req.body;
            if (updates.webhook_url) {
                try {
                    new URL(updates.webhook_url);
                }
                catch {
                    return res.status(400).json({
                        error: 'Invalid webhook_url',
                        message: 'webhook_url must be a valid HTTP/HTTPS URL'
                    });
                }
            }
            const subscription = await webhookService.updateSubscription(req.user.organization_id, id, updates);
            if (!subscription) {
                return res.status(404).json({
                    error: 'Webhook subscription not found'
                });
            }
            const response = {
                ...subscription,
                secret: '***hidden***'
            };
            res.json({ subscription: response });
        }
        catch (error) {
            logger.error('Error updating webhook subscription:', error);
            res.status(500).json({
                error: 'Failed to update webhook subscription',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });
    router.delete('/subscriptions/:id', webhookRateLimit, auth_middleware_1.authMiddleware, async (req, res) => {
        try {
            const { id } = req.params;
            const deleted = await webhookService.deleteSubscription(req.user.organization_id, id);
            if (!deleted) {
                return res.status(404).json({
                    error: 'Webhook subscription not found'
                });
            }
            res.status(204).send();
        }
        catch (error) {
            logger.error('Error deleting webhook subscription:', error);
            res.status(500).json({
                error: 'Failed to delete webhook subscription',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });
    router.post('/subscriptions/:id/test', webhookRateLimit, auth_middleware_1.authMiddleware, async (req, res) => {
        try {
            const { id } = req.params;
            const subscriptions = await webhookService.getSubscriptions(req.user.organization_id);
            const subscription = subscriptions.find(s => s.id === id);
            if (!subscription) {
                return res.status(404).json({
                    error: 'Webhook subscription not found'
                });
            }
            const testPayload = {
                event: 'webhook.test',
                timestamp: Date.now(),
                organization_id: req.user.organization_id,
                data: {
                    message: 'This is a test webhook from Fortium Metrics Server',
                    subscription_id: id,
                    test_timestamp: new Date().toISOString()
                }
            };
            const testResult = await webhookService.testWebhook(subscription.webhook_url, testPayload);
            res.json(testResult);
        }
        catch (error) {
            logger.error('Error testing webhook subscription:', error);
            res.status(500).json({
                error: 'Failed to test webhook subscription',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });
    router.post('/claude-code', incomingWebhookRateLimit, async (req, res) => {
        try {
            const signature = req.headers['x-claude-signature'];
            const timestamp = req.headers['x-claude-timestamp'];
            const payload = req.body;
            if (!payload || !payload.event || !payload.metadata?.organization_id) {
                return res.status(400).json({
                    error: 'Invalid webhook payload',
                    message: 'Missing required fields: event, metadata.organization_id'
                });
            }
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
        }
        catch (error) {
            logger.error('Error processing Claude Code webhook:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: 'Failed to process webhook'
            });
        }
    });
    router.post('/agent', incomingWebhookRateLimit, async (req, res) => {
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
        }
        catch (error) {
            logger.error('Error processing agent webhook:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: 'Failed to process webhook'
            });
        }
    });
    router.get('/events', webhookRateLimit, auth_middleware_1.authMiddleware, async (req, res) => {
        try {
            const { event_type, status, from_date, to_date, limit = 100, offset = 0 } = req.query;
            const filters = {
                event_type: event_type,
                status: status,
                from_date: from_date ? new Date(from_date) : undefined,
                to_date: to_date ? new Date(to_date) : undefined,
                limit: Math.min(parseInt(limit) || 100, 1000),
                offset: parseInt(offset) || 0
            };
            const result = await webhookService.getWebhookEvents(req.user.organization_id, filters);
            res.json({
                events: result.events,
                total: result.total,
                limit: filters.limit,
                offset: filters.offset
            });
        }
        catch (error) {
            logger.error('Error getting webhook events:', error);
            res.status(500).json({
                error: 'Failed to retrieve webhook events',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });
    router.post('/events/:id/replay', webhookRateLimit, auth_middleware_1.authMiddleware, async (req, res) => {
        try {
            const { id } = req.params;
            const result = await webhookService.replayWebhookEvent(req.user.organization_id, id);
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
        }
        catch (error) {
            logger.error('Error replaying webhook event:', error);
            res.status(500).json({
                error: 'Failed to replay webhook event',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });
    router.post('/productivity-alert', incomingWebhookRateLimit, auth_middleware_1.authMiddleware, async (req, res) => {
        try {
            const alertData = req.body;
            if (!alertData.type || !alertData.threshold || !alertData.current_value) {
                return res.status(400).json({
                    error: 'Invalid alert data',
                    message: 'type, threshold, and current_value are required'
                });
            }
            const result = await webhookService.processProductivityAlert(req.user.organization_id, alertData);
            res.json({
                success: result.success,
                message: result.message,
                alert_id: result.alert_id
            });
        }
        catch (error) {
            logger.error('Error processing productivity alert:', error);
            res.status(500).json({
                error: 'Failed to process productivity alert',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });
    router.get('/health', async (req, res) => {
        try {
            const health = {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                service: 'webhook-service',
                version: '1.0.0'
            };
            res.json(health);
        }
        catch (error) {
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
//# sourceMappingURL=webhook.routes.js.map