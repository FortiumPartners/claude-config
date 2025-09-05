"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookService = void 0;
const metrics_collection_service_1 = require("./metrics-collection.service");
const crypto = __importStar(require("crypto"));
const node_fetch_1 = __importDefault(require("node-fetch"));
class WebhookService {
    db;
    logger;
    metricsCollectionService;
    constructor(db, logger) {
        this.db = db;
        this.logger = logger;
        this.metricsCollectionService = new metrics_collection_service_1.MetricsCollectionService(db, logger);
    }
    async processClaudeCodeEvent(payload) {
        try {
            const eventId = crypto.randomUUID();
            await this.storeWebhookEvent({
                id: eventId,
                organization_id: payload.metadata?.organization_id || 'unknown',
                event_type: payload.event,
                payload,
                status: 'pending',
                attempts: 0,
                created_at: new Date()
            });
            switch (payload.event) {
                case 'command.executed':
                    return await this.processCommandExecutedEvent(payload, eventId);
                case 'agent.delegated':
                    return await this.processAgentDelegatedEvent(payload, eventId);
                case 'session.started':
                    return await this.processSessionStartedEvent(payload, eventId);
                case 'session.ended':
                    return await this.processSessionEndedEvent(payload, eventId);
                case 'error.occurred':
                    return await this.processErrorEvent(payload, eventId);
                default:
                    this.logger.warn(`Unknown Claude Code event type: ${payload.event}`);
                    return {
                        success: true,
                        message: `Event logged but not processed: ${payload.event}`,
                        event_id: eventId
                    };
            }
        }
        catch (error) {
            this.logger.error('Error processing Claude Code event:', error);
            return {
                success: false,
                message: 'Failed to process Claude Code event',
            };
        }
    }
    async processAgentEvent(payload) {
        try {
            const eventId = crypto.randomUUID();
            await this.storeWebhookEvent({
                id: eventId,
                organization_id: payload.metadata?.organization_id || 'unknown',
                event_type: `agent.${payload.event}`,
                payload,
                status: 'pending',
                attempts: 0,
                created_at: new Date()
            });
            switch (payload.event) {
                case 'performance.metric':
                    return await this.processAgentPerformanceEvent(payload, eventId);
                case 'specialization.used':
                    return await this.processAgentSpecializationEvent(payload, eventId);
                case 'conflict.resolved':
                    return await this.processAgentConflictEvent(payload, eventId);
                default:
                    return {
                        success: true,
                        message: `Agent event logged: ${payload.event}`,
                        event_id: eventId
                    };
            }
        }
        catch (error) {
            this.logger.error('Error processing agent event:', error);
            return {
                success: false,
                message: 'Failed to process agent event'
            };
        }
    }
    async processProductivityAlert(organizationId, alertData) {
        try {
            const alertId = crypto.randomUUID();
            const query = `
        INSERT INTO productivity_alerts (id, organization_id, alert_type, threshold_value, current_value, 
                                       severity, description, metadata, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      `;
            await this.db.query(query, [
                alertId,
                organizationId,
                alertData.type,
                alertData.threshold,
                alertData.current_value,
                alertData.severity,
                alertData.description,
                JSON.stringify(alertData.metadata || {})
            ]);
            await this.triggerWebhookNotifications(organizationId, {
                event: 'productivity.alert',
                timestamp: Date.now(),
                source: 'fortium-metrics-server',
                data: {
                    alert_id: alertId,
                    ...alertData
                }
            });
            return {
                success: true,
                message: 'Productivity alert processed successfully',
                alert_id: alertId
            };
        }
        catch (error) {
            this.logger.error('Error processing productivity alert:', error);
            return {
                success: false,
                message: 'Failed to process productivity alert'
            };
        }
    }
    async getSubscriptions(organizationId) {
        const query = `
      SELECT * FROM webhook_subscriptions 
      WHERE organization_id = $1 
      ORDER BY created_at DESC
    `;
        const result = await this.db.query(query, [organizationId]);
        return result.rows;
    }
    async createSubscription(organizationId, subscriptionData) {
        const subscriptionId = crypto.randomUUID();
        const secret = crypto.randomBytes(32).toString('hex');
        const query = `
      INSERT INTO webhook_subscriptions (id, organization_id, webhook_url, event_types, 
                                       secret, active, retry_settings, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING *
    `;
        const retrySettings = subscriptionData.retry_settings || {
            max_retries: 3,
            retry_delay_ms: 5000,
            exponential_backoff: true
        };
        const result = await this.db.query(query, [
            subscriptionId,
            organizationId,
            subscriptionData.webhook_url,
            JSON.stringify(subscriptionData.event_types || []),
            secret,
            subscriptionData.active !== false,
            JSON.stringify(retrySettings)
        ]);
        return result.rows[0];
    }
    async updateSubscription(organizationId, subscriptionId, updates) {
        const setClause = [];
        const values = [organizationId, subscriptionId];
        let paramIndex = 3;
        if (updates.webhook_url) {
            setClause.push(`webhook_url = $${paramIndex}`);
            values.push(updates.webhook_url);
            paramIndex++;
        }
        if (updates.event_types) {
            setClause.push(`event_types = $${paramIndex}`);
            values.push(JSON.stringify(updates.event_types));
            paramIndex++;
        }
        if (updates.active !== undefined) {
            setClause.push(`active = $${paramIndex}`);
            values.push(updates.active);
            paramIndex++;
        }
        if (updates.retry_settings) {
            setClause.push(`retry_settings = $${paramIndex}`);
            values.push(JSON.stringify(updates.retry_settings));
            paramIndex++;
        }
        if (setClause.length === 0) {
            return null;
        }
        const query = `
      UPDATE webhook_subscriptions 
      SET ${setClause.join(', ')}, updated_at = NOW()
      WHERE organization_id = $1 AND id = $2
      RETURNING *
    `;
        const result = await this.db.query(query, values);
        return result.rows[0] || null;
    }
    async deleteSubscription(organizationId, subscriptionId) {
        const query = `
      DELETE FROM webhook_subscriptions 
      WHERE organization_id = $1 AND id = $2
    `;
        const result = await this.db.query(query, [organizationId, subscriptionId]);
        return result.rowCount > 0;
    }
    async testWebhook(webhookUrl, testPayload) {
        const startTime = Date.now();
        try {
            const response = await (0, node_fetch_1.default)(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Fortium-Metrics-Server/1.0'
                },
                body: JSON.stringify(testPayload),
                timeout: 10000
            });
            const responseTime = Date.now() - startTime;
            return {
                success: response.ok,
                message: response.ok ? 'Webhook test successful' : `HTTP ${response.status}: ${response.statusText}`,
                response_time_ms: responseTime,
                status_code: response.status
            };
        }
        catch (error) {
            const responseTime = Date.now() - startTime;
            return {
                success: false,
                message: `Webhook test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                response_time_ms: responseTime
            };
        }
    }
    async storeWebhookEvent(event) {
        const query = `
      INSERT INTO webhook_events (id, organization_id, subscription_id, event_type, payload, 
                                status, attempts, last_attempt_at, next_retry_at, 
                                response_status, response_body, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `;
        await this.db.query(query, [
            event.id,
            event.organization_id,
            event.subscription_id || null,
            event.event_type,
            JSON.stringify(event.payload),
            event.status,
            event.attempts,
            event.last_attempt_at || null,
            event.next_retry_at || null,
            event.response_status || null,
            event.response_body || null,
            event.created_at
        ]);
    }
    async processCommandExecutedEvent(payload, eventId) {
        const metricsData = {
            command_name: payload.data.command,
            execution_time_ms: payload.data.duration_ms,
            success: payload.data.success,
            context: {
                claude_session: payload.data.session_id,
                agent_used: payload.data.agent,
                webhook_event_id: eventId,
                ...payload.data.context
            }
        };
        const result = await this.metricsCollectionService.collectCommandExecution(payload.metadata.organization_id, metricsData);
        return {
            success: result.success,
            message: result.success ? 'Command execution metrics collected' : result.message,
            event_id: eventId
        };
    }
    async processAgentDelegatedEvent(payload, eventId) {
        const delegationData = {
            command_name: `delegation-${payload.data.task_type}`,
            execution_time_ms: payload.data.delegation_time_ms || 0,
            success: payload.data.success,
            context: {
                agent_used: 'ai-mesh-orchestrator',
                delegation_pattern: payload.data.delegation_pattern,
                webhook_event_id: eventId
            }
        };
        const result = await this.metricsCollectionService.collectCommandExecution(payload.metadata.organization_id, delegationData);
        return {
            success: result.success,
            message: 'Agent delegation metrics collected',
            event_id: eventId
        };
    }
    async processSessionStartedEvent(payload, eventId) {
        this.logger.info('Claude session started', {
            session_id: payload.data.session_id,
            organization_id: payload.metadata.organization_id,
            event_id: eventId
        });
        return {
            success: true,
            message: 'Session start logged',
            event_id: eventId
        };
    }
    async processSessionEndedEvent(payload, eventId) {
        this.logger.info('Claude session ended', {
            session_id: payload.data.session_id,
            duration_ms: payload.data.duration_ms,
            commands_executed: payload.data.commands_executed,
            organization_id: payload.metadata.organization_id,
            event_id: eventId
        });
        return {
            success: true,
            message: 'Session end logged',
            event_id: eventId
        };
    }
    async processErrorEvent(payload, eventId) {
        this.logger.error('Claude Code error event received', {
            error: payload.data.error,
            context: payload.data.context,
            event_id: eventId
        });
        return {
            success: true,
            message: 'Error event logged',
            event_id: eventId
        };
    }
    async processAgentPerformanceEvent(payload, eventId) {
        const performanceData = {
            command_name: `agent-performance-${payload.data.agent_name}`,
            execution_time_ms: payload.data.execution_time_ms,
            success: payload.data.success_rate > 0.8,
            context: {
                agent_used: payload.data.agent_name,
                performance_metrics: payload.data.metrics,
                webhook_event_id: eventId
            }
        };
        const result = await this.metricsCollectionService.collectCommandExecution(payload.metadata.organization_id, performanceData);
        return {
            success: result.success,
            message: 'Agent performance metrics collected',
            event_id: eventId
        };
    }
    async processAgentSpecializationEvent(payload, eventId) {
        this.logger.info('Agent specialization used', {
            agent: payload.data.agent_name,
            specialization: payload.data.specialization_type,
            effectiveness: payload.data.effectiveness_score,
            event_id: eventId
        });
        return {
            success: true,
            message: 'Agent specialization logged',
            event_id: eventId
        };
    }
    async processAgentConflictEvent(payload, eventId) {
        this.logger.info('Agent conflict resolved', {
            conflict_type: payload.data.conflict_type,
            agents_involved: payload.data.agents,
            resolution_strategy: payload.data.resolution,
            event_id: eventId
        });
        return {
            success: true,
            message: 'Agent conflict resolution logged',
            event_id: eventId
        };
    }
    async triggerWebhookNotifications(organizationId, eventPayload) {
        const subscriptions = await this.getSubscriptions(organizationId);
        for (const subscription of subscriptions) {
            if (!subscription.active)
                continue;
            const eventTypes = JSON.parse(subscription.event_types);
            if (eventTypes.length > 0 && !eventTypes.includes(eventPayload.event)) {
                continue;
            }
            this.sendWebhookNotification(subscription, eventPayload).catch(error => {
                this.logger.error(`Failed to send webhook to ${subscription.webhook_url}:`, error);
            });
        }
    }
    async sendWebhookNotification(subscription, payload) {
        try {
            const signature = this.generateWebhookSignature(payload, subscription.secret || '');
            const response = await (0, node_fetch_1.default)(subscription.webhook_url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Fortium-Metrics-Server/1.0',
                    'X-Fortium-Signature': signature,
                    'X-Fortium-Event': payload.event
                },
                body: JSON.stringify(payload),
                timeout: 30000
            });
            if (response.ok) {
                this.logger.debug(`Webhook delivered successfully to ${subscription.webhook_url}`);
            }
            else {
                this.logger.warn(`Webhook delivery failed to ${subscription.webhook_url}: ${response.status}`);
            }
        }
        catch (error) {
            this.logger.error(`Webhook delivery error to ${subscription.webhook_url}:`, error);
        }
    }
    generateWebhookSignature(payload, secret) {
        const payloadString = JSON.stringify(payload);
        return crypto
            .createHmac('sha256', secret)
            .update(payloadString)
            .digest('hex');
    }
    async getWebhookEvent(organizationId, eventId) {
        const query = `
      SELECT * FROM webhook_events 
      WHERE organization_id = $1 AND id = $2
    `;
        const result = await this.db.query(query, [organizationId, eventId]);
        return result.rows[0] || null;
    }
    async getWebhookEvents(organizationId, filters) {
        let query = `
      SELECT * FROM webhook_events 
      WHERE organization_id = $1
    `;
        const params = [organizationId];
        let paramIndex = 2;
        if (filters.event_type) {
            query += ` AND event_type = $${paramIndex}`;
            params.push(filters.event_type);
            paramIndex++;
        }
        if (filters.status) {
            query += ` AND status = $${paramIndex}`;
            params.push(filters.status);
            paramIndex++;
        }
        if (filters.from_date) {
            query += ` AND created_at >= $${paramIndex}`;
            params.push(filters.from_date);
            paramIndex++;
        }
        if (filters.to_date) {
            query += ` AND created_at <= $${paramIndex}`;
            params.push(filters.to_date);
            paramIndex++;
        }
        const countResult = await this.db.query(query.replace('SELECT *', 'SELECT COUNT(*)'), params);
        const total = parseInt(countResult.rows[0].count);
        query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(filters.limit, filters.offset);
        const eventsResult = await this.db.query(query, params);
        return {
            events: eventsResult.rows,
            total
        };
    }
    async replayWebhookEvent(organizationId, eventId) {
        const originalEvent = await this.getWebhookEvent(organizationId, eventId);
        if (!originalEvent) {
            return { success: false };
        }
        const newEventId = crypto.randomUUID();
        const replayEvent = {
            ...originalEvent,
            id: newEventId,
            status: 'pending',
            attempts: 0,
            created_at: new Date()
        };
        await this.storeWebhookEvent(replayEvent);
        await this.processClaudeCodeEvent(originalEvent.payload);
        return {
            success: true,
            new_event_id: newEventId
        };
    }
}
exports.WebhookService = WebhookService;
//# sourceMappingURL=webhook.service.js.map