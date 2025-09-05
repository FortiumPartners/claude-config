/**
 * Webhook Service
 * Task 4.3: Core webhook functionality for Claude Code integration
 * 
 * Handles webhook processing, subscriptions, and real-time event notifications
 */

import { DatabaseConnection } from '../database/connection';
import { MetricsCollectionService } from './metrics-collection.service';
import * as winston from 'winston';
import * as crypto from 'crypto';
import fetch from 'node-fetch';

export interface WebhookSubscription {
  id: string;
  organization_id: string;
  webhook_url: string;
  event_types: string[];
  secret?: string;
  active: boolean;
  retry_settings: {
    max_retries: number;
    retry_delay_ms: number;
    exponential_backoff: boolean;
  };
  created_at: Date;
  updated_at: Date;
}

export interface WebhookEvent {
  id: string;
  organization_id: string;
  subscription_id?: string;
  event_type: string;
  payload: any;
  status: 'pending' | 'delivered' | 'failed' | 'retrying';
  attempts: number;
  last_attempt_at?: Date;
  next_retry_at?: Date;
  response_status?: number;
  response_body?: string;
  created_at: Date;
}

export interface WebhookProcessingResult {
  success: boolean;
  message: string;
  event_id?: string;
  alert_id?: string;
}

export interface WebhookTestResult {
  success: boolean;
  message: string;
  response_time_ms: number;
  status_code?: number;
}

export class WebhookService {
  private metricsCollectionService: MetricsCollectionService;

  constructor(
    private db: DatabaseConnection,
    private logger: winston.Logger
  ) {
    this.metricsCollectionService = new MetricsCollectionService(db, logger);
  }

  /**
   * Process Claude Code webhook event
   */
  async processClaudeCodeEvent(payload: any): Promise<WebhookProcessingResult> {
    try {
      const eventId = crypto.randomUUID();
      
      // Store the event
      await this.storeWebhookEvent({
        id: eventId,
        organization_id: payload.metadata?.organization_id || 'unknown',
        event_type: payload.event,
        payload,
        status: 'pending',
        attempts: 0,
        created_at: new Date()
      });

      // Process based on event type
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

    } catch (error) {
      this.logger.error('Error processing Claude Code event:', error);
      return {
        success: false,
        message: 'Failed to process Claude Code event',
      };
    }
  }

  /**
   * Process agent-specific event
   */
  async processAgentEvent(payload: any): Promise<WebhookProcessingResult> {
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

      // Process agent-specific events
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

    } catch (error) {
      this.logger.error('Error processing agent event:', error);
      return {
        success: false,
        message: 'Failed to process agent event'
      };
    }
  }

  /**
   * Process productivity alert
   */
  async processProductivityAlert(organizationId: string, alertData: any): Promise<WebhookProcessingResult> {
    try {
      const alertId = crypto.randomUUID();

      // Store the alert
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

      // Trigger webhook notifications to subscribed endpoints
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

    } catch (error) {
      this.logger.error('Error processing productivity alert:', error);
      return {
        success: false,
        message: 'Failed to process productivity alert'
      };
    }
  }

  /**
   * Get webhook subscriptions for organization
   */
  async getSubscriptions(organizationId: string): Promise<WebhookSubscription[]> {
    const query = `
      SELECT * FROM webhook_subscriptions 
      WHERE organization_id = $1 
      ORDER BY created_at DESC
    `;

    const result = await this.db.query(query, [organizationId]);
    return result.rows;
  }

  /**
   * Create webhook subscription
   */
  async createSubscription(organizationId: string, subscriptionData: any): Promise<WebhookSubscription> {
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

  /**
   * Update webhook subscription
   */
  async updateSubscription(
    organizationId: string, 
    subscriptionId: string, 
    updates: any
  ): Promise<WebhookSubscription | null> {
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

  /**
   * Delete webhook subscription
   */
  async deleteSubscription(organizationId: string, subscriptionId: string): Promise<boolean> {
    const query = `
      DELETE FROM webhook_subscriptions 
      WHERE organization_id = $1 AND id = $2
    `;

    const result = await this.db.query(query, [organizationId, subscriptionId]);
    return result.rowCount > 0;
  }

  /**
   * Test webhook endpoint
   */
  async testWebhook(webhookUrl: string, testPayload: any): Promise<WebhookTestResult> {
    const startTime = Date.now();

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Fortium-Metrics-Server/1.0'
        },
        body: JSON.stringify(testPayload),
        timeout: 10000 // 10 second timeout
      });

      const responseTime = Date.now() - startTime;

      return {
        success: response.ok,
        message: response.ok ? 'Webhook test successful' : `HTTP ${response.status}: ${response.statusText}`,
        response_time_ms: responseTime,
        status_code: response.status
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        success: false,
        message: `Webhook test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        response_time_ms: responseTime
      };
    }
  }

  /**
   * Store webhook event in database
   */
  private async storeWebhookEvent(event: Omit<WebhookEvent, 'updated_at'>): Promise<void> {
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

  /**
   * Process command executed event
   */
  private async processCommandExecutedEvent(payload: any, eventId: string): Promise<WebhookProcessingResult> {
    // Convert webhook payload to metrics collection format
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

    const result = await this.metricsCollectionService.collectCommandExecution(
      payload.metadata.organization_id,
      metricsData
    );

    return {
      success: result.success,
      message: result.success ? 'Command execution metrics collected' : result.message,
      event_id: eventId
    };
  }

  /**
   * Process agent delegated event
   */
  private async processAgentDelegatedEvent(payload: any, eventId: string): Promise<WebhookProcessingResult> {
    // Store agent delegation metrics
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

    const result = await this.metricsCollectionService.collectCommandExecution(
      payload.metadata.organization_id,
      delegationData
    );

    return {
      success: result.success,
      message: 'Agent delegation metrics collected',
      event_id: eventId
    };
  }

  /**
   * Process session events
   */
  private async processSessionStartedEvent(payload: any, eventId: string): Promise<WebhookProcessingResult> {
    // Log session start for analytics
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

  private async processSessionEndedEvent(payload: any, eventId: string): Promise<WebhookProcessingResult> {
    // Log session end and calculate session metrics
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

  /**
   * Process error event
   */
  private async processErrorEvent(payload: any, eventId: string): Promise<WebhookProcessingResult> {
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

  /**
   * Process agent performance event
   */
  private async processAgentPerformanceEvent(payload: any, eventId: string): Promise<WebhookProcessingResult> {
    // Store agent performance metrics
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

    const result = await this.metricsCollectionService.collectCommandExecution(
      payload.metadata.organization_id,
      performanceData
    );

    return {
      success: result.success,
      message: 'Agent performance metrics collected',
      event_id: eventId
    };
  }

  /**
   * Process agent specialization event
   */
  private async processAgentSpecializationEvent(payload: any, eventId: string): Promise<WebhookProcessingResult> {
    // Log specialization usage for analytics
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

  /**
   * Process agent conflict event
   */
  private async processAgentConflictEvent(payload: any, eventId: string): Promise<WebhookProcessingResult> {
    // Log conflict resolution for optimization
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

  /**
   * Trigger webhook notifications to subscribed endpoints
   */
  private async triggerWebhookNotifications(organizationId: string, eventPayload: any): Promise<void> {
    const subscriptions = await this.getSubscriptions(organizationId);

    for (const subscription of subscriptions) {
      if (!subscription.active) continue;

      const eventTypes = JSON.parse(subscription.event_types as any);
      if (eventTypes.length > 0 && !eventTypes.includes(eventPayload.event)) {
        continue; // Skip if event type not subscribed
      }

      // Send webhook notification (async, don't wait)
      this.sendWebhookNotification(subscription, eventPayload).catch(error => {
        this.logger.error(`Failed to send webhook to ${subscription.webhook_url}:`, error);
      });
    }
  }

  /**
   * Send webhook notification to endpoint
   */
  private async sendWebhookNotification(subscription: WebhookSubscription, payload: any): Promise<void> {
    try {
      const signature = this.generateWebhookSignature(payload, subscription.secret || '');

      const response = await fetch(subscription.webhook_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Fortium-Metrics-Server/1.0',
          'X-Fortium-Signature': signature,
          'X-Fortium-Event': payload.event
        },
        body: JSON.stringify(payload),
        timeout: 30000 // 30 second timeout
      });

      if (response.ok) {
        this.logger.debug(`Webhook delivered successfully to ${subscription.webhook_url}`);
      } else {
        this.logger.warn(`Webhook delivery failed to ${subscription.webhook_url}: ${response.status}`);
      }

    } catch (error) {
      this.logger.error(`Webhook delivery error to ${subscription.webhook_url}:`, error);
    }
  }

  /**
   * Generate webhook signature for security
   */
  private generateWebhookSignature(payload: any, secret: string): string {
    const payloadString = JSON.stringify(payload);
    return crypto
      .createHmac('sha256', secret)
      .update(payloadString)
      .digest('hex');
  }

  /**
   * Get webhook event by ID
   */
  async getWebhookEvent(organizationId: string, eventId: string): Promise<WebhookEvent | null> {
    const query = `
      SELECT * FROM webhook_events 
      WHERE organization_id = $1 AND id = $2
    `;

    const result = await this.db.query(query, [organizationId, eventId]);
    return result.rows[0] || null;
  }

  /**
   * Get webhook events with filtering
   */
  async getWebhookEvents(organizationId: string, filters: any): Promise<{ events: WebhookEvent[]; total: number }> {
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

    // Count total
    const countResult = await this.db.query(
      query.replace('SELECT *', 'SELECT COUNT(*)'),
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Add ordering and pagination
    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(filters.limit, filters.offset);

    const eventsResult = await this.db.query(query, params);

    return {
      events: eventsResult.rows,
      total
    };
  }

  /**
   * Replay webhook event
   */
  async replayWebhookEvent(organizationId: string, eventId: string): Promise<{ success: boolean; new_event_id?: string }> {
    const originalEvent = await this.getWebhookEvent(organizationId, eventId);
    
    if (!originalEvent) {
      return { success: false };
    }

    // Create new event for replay
    const newEventId = crypto.randomUUID();
    const replayEvent = {
      ...originalEvent,
      id: newEventId,
      status: 'pending' as const,
      attempts: 0,
      created_at: new Date()
    };

    await this.storeWebhookEvent(replayEvent);

    // Process the replayed event
    await this.processClaudeCodeEvent(originalEvent.payload);

    return {
      success: true,
      new_event_id: newEventId
    };
  }
}