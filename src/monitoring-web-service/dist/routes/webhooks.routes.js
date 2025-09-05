"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWebhookRoutes = createWebhookRoutes;
const express_1 = require("express");
const webhook_service_1 = require("../services/webhook.service");
const auth_middleware_1 = require("../middleware/auth.middleware");
const validation_middleware_1 = require("../middleware/validation.middleware");
const webhook_signature_middleware_1 = require("../middleware/webhook-signature.middleware");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
function createWebhookRoutes(db, logger) {
    const router = (0, express_1.Router)();
    const webhookService = new webhook_service_1.WebhookService(db, logger);
    const webhookRateLimit = (0, express_rate_limit_1.default)({
        windowMs: 60 * 1000,
        max: 200,
        message: {
            success: false,
            message: 'Webhook rate limit exceeded',
            error: 'too_many_requests',
            retry_after: 60
        },
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => {
            const payload = req.body;
            return `${req.ip}-${payload?.source || 'unknown'}`;
        }
    });
    router.post('/claude-code', webhookRateLimit, webhook_signature_middleware_1.webhookSignatureMiddleware, validation_middleware_1.validationMiddleware, async (req, res) => {
        try {
            const payload = req.body;
            if (!payload.event || !payload.timestamp || !payload.source) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid webhook payload',
                    error: 'missing_required_fields',
                    required_fields: ['event', 'timestamp', 'source']
                });
            }
            const result = await webhookService.processClaudeCodeEvent(payload);
            const response = {
                success: result.success,
                message: result.message,
                event_id: result.event_id,
                processed_at: new Date().toISOString()
            };
            res.status(result.success ? 200 : 400).json(response);
        }
        catch (error) {
            logger.error('Claude Code webhook error:', error);
            const errorResponse = {
                success: false,
                message: 'Webhook processing failed',
                processed_at: new Date().toISOString()
            };
            res.status(500).json(errorResponse);
        }
    });
    router.post('/agent-events', webhookRateLimit, webhook_signature_middleware_1.webhookSignatureMiddleware, validation_middleware_1.validationMiddleware, async (req, res) => {
        try {
            const payload = req.body;
            const result = await webhookService.processAgentEvent(payload);
            res.status(result.success ? 200 : 400).json({
                success: result.success,
                message: result.message,
                event_id: result.event_id,
                processed_at: new Date().toISOString()
            });
        }
        catch (error) {
            logger.error('Agent events webhook error:', error);
            res.status(500).json({
                success: false,
                message: 'Agent event processing failed',
                processed_at: new Date().toISOString()
            });
        }
    });
    router.post('/productivity-alerts', webhookRateLimit, auth_middleware_1.authMiddleware, async (req, res) => {
        try {
            const alertData = req.body;
            const result = await webhookService.processProductivityAlert(req.user.organization_id, alertData);
            res.json({
                success: result.success,
                message: result.message,
                alert_id: result.alert_id,
                processed_at: new Date().toISOString()
            });
        }
        catch (error) {
            logger.error('Productivity alerts webhook error:', error);
            res.status(500).json({
                success: false,
                message: 'Alert processing failed',
                processed_at: new Date().toISOString()
            });
        }
    });
    router.get('/subscriptions', auth_middleware_1.authMiddleware, async (req, res) => {
        try {
            const subscriptions = await webhookService.getSubscriptions(req.user.organization_id);
            res.json({
                subscriptions,
                total: subscriptions.length,
                retrieved_at: new Date().toISOString()
            });
        }
        catch (error) {
            logger.error('Error retrieving webhook subscriptions:', error);
            res.status(500).json({
                error: 'Failed to retrieve subscriptions',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });
    router.post('/subscriptions', auth_middleware_1.authMiddleware, validation_middleware_1.validationMiddleware, async (req, res) => {
        try {
            const subscription = await webhookService.createSubscription(req.user.organization_id, req.body);
            res.status(201).json({
                success: true,
                subscription,
                created_at: new Date().toISOString()
            });
        }
        catch (error) {
            logger.error('Error creating webhook subscription:', error);
            res.status(400).json({
                success: false,
                message: 'Failed to create subscription',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });
    router.put('/subscriptions/:id', auth_middleware_1.authMiddleware, validation_middleware_1.validationMiddleware, async (req, res) => {
        try {
            const subscriptionId = req.params.id;
            const updates = req.body;
            const subscription = await webhookService.updateSubscription(req.user.organization_id, subscriptionId, updates);
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
        }
        catch (error) {
            logger.error('Error updating webhook subscription:', error);
            res.status(400).json({
                success: false,
                message: 'Failed to update subscription',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });
    router.delete('/subscriptions/:id', auth_middleware_1.authMiddleware, async (req, res) => {
        try {
            const subscriptionId = req.params.id;
            const deleted = await webhookService.deleteSubscription(req.user.organization_id, subscriptionId);
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
        }
        catch (error) {
            logger.error('Error deleting webhook subscription:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to delete subscription',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });
    router.post('/test', auth_middleware_1.authMiddleware, async (req, res) => {
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
                    organization_id: req.user.organization_id
                }
            });
            res.json({
                success: result.success,
                message: result.message,
                response_time_ms: result.response_time_ms,
                status_code: result.status_code,
                tested_at: new Date().toISOString()
            });
        }
        catch (error) {
            logger.error('Webhook test error:', error);
            res.status(500).json({
                success: false,
                message: 'Webhook test failed',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });
    router.get('/events/:id', auth_middleware_1.authMiddleware, async (req, res) => {
        try {
            const eventId = req.params.id;
            const event = await webhookService.getWebhookEvent(req.user.organization_id, eventId);
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
        }
        catch (error) {
            logger.error('Error retrieving webhook event:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve webhook event',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });
    router.get('/events', auth_middleware_1.authMiddleware, async (req, res) => {
        try {
            const { event_type, source, status, from_date, to_date, limit = '50', offset = '0' } = req.query;
            const filters = {
                event_type: event_type,
                source: source,
                status: status,
                from_date: from_date,
                to_date: to_date,
                limit: parseInt(limit),
                offset: parseInt(offset)
            };
            const result = await webhookService.getWebhookEvents(req.user.organization_id, filters);
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
        }
        catch (error) {
            logger.error('Error retrieving webhook events:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve webhook events',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });
    router.post('/replay/:id', auth_middleware_1.authMiddleware, async (req, res) => {
        try {
            const eventId = req.params.id;
            const result = await webhookService.replayWebhookEvent(req.user.organization_id, eventId);
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
        }
        catch (error) {
            logger.error('Error replaying webhook event:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to replay webhook event',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });
    return { router };
}
//# sourceMappingURL=webhooks.routes.js.map