/**
 * Metrics Collection Service
 * Task 3.2: High-throughput metrics collection with rate limiting and validation
 */

import { MetricsModel } from '../models/metrics.model';
import { DatabaseConnection } from '../database/connection';
import {
  CommandExecution,
  CommandExecutionCreate,
  AgentInteraction,
  AgentInteractionCreate,
  UserSession,
  UserSessionCreate,
  UserSessionUpdate,
  ProductivityMetric,
  ProductivityMetricCreate,
  MetricsBatch,
  RateLimitConfig,
  RateLimitStatus,
  PerformanceMetrics
} from '../types/metrics';
import {
  validateCommandExecution,
  validateAgentInteraction,
  validateUserSessionCreate,
  validateUserSessionUpdate,
  validateProductivityMetric,
  validateMetricsBatch,
  sanitizeJsonField
} from '../validation/metrics.validation';
import * as winston from 'winston';

export interface CollectionResult {
  success: boolean;
  message?: string;
  data?: any;
  rate_limit?: RateLimitStatus;
  performance?: Partial<PerformanceMetrics>;
}

export interface BatchCollectionResult extends CollectionResult {
  data?: {
    command_executions: number;
    agent_interactions: number;
    user_sessions: number;
    productivity_metrics: number;
    processing_time_ms: number;
  };
}

export class MetricsCollectionService {
  private metricsModel: MetricsModel;
  private rateLimitStore: Map<string, { count: number; window_start: Date }> = new Map();
  private logger: winston.Logger;

  // Rate limiting configuration
  private defaultRateLimit: RateLimitConfig = {
    window_ms: 60000, // 1 minute
    max_requests: 1000, // 1000 requests per minute per organization
    identifier: 'organization_id'
  };

  // Performance monitoring
  private performanceStats = {
    total_requests: 0,
    successful_requests: 0,
    failed_requests: 0,
    avg_processing_time_ms: 0,
    last_reset: new Date()
  };

  constructor(db: DatabaseConnection, logger: winston.Logger) {
    this.metricsModel = new MetricsModel(db);
    this.logger = logger;
    
    // Clean up rate limit cache every 5 minutes
    setInterval(() => this.cleanupRateLimitCache(), 5 * 60 * 1000);
    
    // Reset performance stats every hour
    setInterval(() => this.resetPerformanceStats(), 60 * 60 * 1000);
  }

  /**
   * Single Command Execution Collection
   */
  async collectCommandExecution(
    organizationId: string,
    data: any,
    rateLimitConfig?: RateLimitConfig
  ): Promise<CollectionResult> {
    const startTime = Date.now();
    
    try {
      // Rate limiting check
      const rateLimitCheck = this.checkRateLimit(organizationId, rateLimitConfig);
      if (!rateLimitCheck.allowed) {
        this.performanceStats.failed_requests++;
        return {
          success: false,
          message: 'Rate limit exceeded',
          rate_limit: rateLimitCheck.status
        };
      }

      // Validate and sanitize input
      const validatedData = validateCommandExecution(data);
      validatedData.command_args = sanitizeJsonField(validatedData.command_args);
      validatedData.context = sanitizeJsonField(validatedData.context);

      // Store in database
      const result = await this.metricsModel.createCommandExecution(organizationId, validatedData);
      
      const processingTime = Date.now() - startTime;
      this.updatePerformanceStats(processingTime, true);

      this.logger.info('Command execution collected', {
        organization_id: organizationId,
        command_name: validatedData.command_name,
        processing_time_ms: processingTime
      });

      return {
        success: true,
        data: result,
        rate_limit: rateLimitCheck.status,
        performance: { processing_latency_ms: processingTime }
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updatePerformanceStats(processingTime, false);

      this.logger.error('Failed to collect command execution', {
        organization_id: organizationId,
        error: error instanceof Error ? error.message : 'Unknown error',
        processing_time_ms: processingTime
      });

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Collection failed',
        performance: { processing_latency_ms: processingTime }
      };
    }
  }

  /**
   * Single Agent Interaction Collection
   */
  async collectAgentInteraction(
    organizationId: string,
    data: any,
    rateLimitConfig?: RateLimitConfig
  ): Promise<CollectionResult> {
    const startTime = Date.now();
    
    try {
      // Rate limiting check
      const rateLimitCheck = this.checkRateLimit(organizationId, rateLimitConfig);
      if (!rateLimitCheck.allowed) {
        this.performanceStats.failed_requests++;
        return {
          success: false,
          message: 'Rate limit exceeded',
          rate_limit: rateLimitCheck.status
        };
      }

      // Validate and sanitize input
      const validatedData = validateAgentInteraction(data);
      validatedData.metadata = sanitizeJsonField(validatedData.metadata);

      // Store in database
      const result = await this.metricsModel.createAgentInteraction(organizationId, validatedData);
      
      const processingTime = Date.now() - startTime;
      this.updatePerformanceStats(processingTime, true);

      this.logger.info('Agent interaction collected', {
        organization_id: organizationId,
        agent_name: validatedData.agent_name,
        processing_time_ms: processingTime
      });

      return {
        success: true,
        data: result,
        rate_limit: rateLimitCheck.status,
        performance: { processing_latency_ms: processingTime }
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updatePerformanceStats(processingTime, false);

      this.logger.error('Failed to collect agent interaction', {
        organization_id: organizationId,
        error: error instanceof Error ? error.message : 'Unknown error',
        processing_time_ms: processingTime
      });

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Collection failed',
        performance: { processing_latency_ms: processingTime }
      };
    }
  }

  /**
   * User Session Management
   */
  async startUserSession(
    organizationId: string,
    data: any,
    rateLimitConfig?: RateLimitConfig
  ): Promise<CollectionResult> {
    const startTime = Date.now();
    
    try {
      // Rate limiting check
      const rateLimitCheck = this.checkRateLimit(organizationId, rateLimitConfig);
      if (!rateLimitCheck.allowed) {
        this.performanceStats.failed_requests++;
        return {
          success: false,
          message: 'Rate limit exceeded',
          rate_limit: rateLimitCheck.status
        };
      }

      // Validate and sanitize input
      const validatedData = validateUserSessionCreate(data);
      validatedData.context = sanitizeJsonField(validatedData.context);

      // Check if user already has an active session
      const activeSession = await this.metricsModel.getActiveUserSession(organizationId, validatedData.user_id);
      if (activeSession) {
        return {
          success: true,
          message: 'User already has an active session',
          data: activeSession,
          rate_limit: rateLimitCheck.status
        };
      }

      // Create new session
      const result = await this.metricsModel.createUserSession(organizationId, validatedData);
      
      const processingTime = Date.now() - startTime;
      this.updatePerformanceStats(processingTime, true);

      this.logger.info('User session started', {
        organization_id: organizationId,
        user_id: validatedData.user_id,
        processing_time_ms: processingTime
      });

      return {
        success: true,
        data: result,
        rate_limit: rateLimitCheck.status,
        performance: { processing_latency_ms: processingTime }
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updatePerformanceStats(processingTime, false);

      this.logger.error('Failed to start user session', {
        organization_id: organizationId,
        error: error instanceof Error ? error.message : 'Unknown error',
        processing_time_ms: processingTime
      });

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Session start failed',
        performance: { processing_latency_ms: processingTime }
      };
    }
  }

  async updateUserSession(
    organizationId: string,
    sessionId: string,
    data: any,
    rateLimitConfig?: RateLimitConfig
  ): Promise<CollectionResult> {
    const startTime = Date.now();
    
    try {
      // Rate limiting check
      const rateLimitCheck = this.checkRateLimit(organizationId, rateLimitConfig);
      if (!rateLimitCheck.allowed) {
        this.performanceStats.failed_requests++;
        return {
          success: false,
          message: 'Rate limit exceeded',
          rate_limit: rateLimitCheck.status
        };
      }

      // Validate and sanitize input
      const validatedData = validateUserSessionUpdate(data);
      if (validatedData.context) {
        validatedData.context = sanitizeJsonField(validatedData.context);
      }

      // Update session
      const result = await this.metricsModel.updateUserSession(organizationId, sessionId, validatedData);
      
      if (!result) {
        return {
          success: false,
          message: 'Session not found',
          rate_limit: rateLimitCheck.status
        };
      }

      const processingTime = Date.now() - startTime;
      this.updatePerformanceStats(processingTime, true);

      this.logger.info('User session updated', {
        organization_id: organizationId,
        session_id: sessionId,
        processing_time_ms: processingTime
      });

      return {
        success: true,
        data: result,
        rate_limit: rateLimitCheck.status,
        performance: { processing_latency_ms: processingTime }
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updatePerformanceStats(processingTime, false);

      this.logger.error('Failed to update user session', {
        organization_id: organizationId,
        session_id: sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
        processing_time_ms: processingTime
      });

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Session update failed',
        performance: { processing_latency_ms: processingTime }
      };
    }
  }

  /**
   * Productivity Metric Collection
   */
  async collectProductivityMetric(
    organizationId: string,
    data: any,
    rateLimitConfig?: RateLimitConfig
  ): Promise<CollectionResult> {
    const startTime = Date.now();
    
    try {
      // Rate limiting check
      const rateLimitCheck = this.checkRateLimit(organizationId, rateLimitConfig);
      if (!rateLimitCheck.allowed) {
        this.performanceStats.failed_requests++;
        return {
          success: false,
          message: 'Rate limit exceeded',
          rate_limit: rateLimitCheck.status
        };
      }

      // Validate and sanitize input
      const validatedData = validateProductivityMetric(data);
      validatedData.dimensions = sanitizeJsonField(validatedData.dimensions);

      // Store in database
      const result = await this.metricsModel.createProductivityMetric(organizationId, validatedData);
      
      const processingTime = Date.now() - startTime;
      this.updatePerformanceStats(processingTime, true);

      this.logger.info('Productivity metric collected', {
        organization_id: organizationId,
        metric_type: validatedData.metric_type,
        processing_time_ms: processingTime
      });

      return {
        success: true,
        data: result,
        rate_limit: rateLimitCheck.status,
        performance: { processing_latency_ms: processingTime }
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updatePerformanceStats(processingTime, false);

      this.logger.error('Failed to collect productivity metric', {
        organization_id: organizationId,
        error: error instanceof Error ? error.message : 'Unknown error',
        processing_time_ms: processingTime
      });

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Collection failed',
        performance: { processing_latency_ms: processingTime }
      };
    }
  }

  /**
   * Batch Collection for High-Throughput Scenarios
   */
  async collectBatchMetrics(
    organizationId: string,
    batch: any,
    rateLimitConfig?: RateLimitConfig
  ): Promise<BatchCollectionResult> {
    const startTime = Date.now();
    
    try {
      // Enhanced rate limiting for batch operations
      const batchRateLimit = {
        ...this.defaultRateLimit,
        max_requests: (rateLimitConfig?.max_requests || this.defaultRateLimit.max_requests) * 10, // 10x for batches
        ...rateLimitConfig
      };

      const rateLimitCheck = this.checkRateLimit(organizationId, batchRateLimit);
      if (!rateLimitCheck.allowed) {
        this.performanceStats.failed_requests++;
        return {
          success: false,
          message: 'Rate limit exceeded for batch operation',
          rate_limit: rateLimitCheck.status
        };
      }

      // Validate batch
      const validatedBatch = validateMetricsBatch(batch);
      validatedBatch.organization_id = organizationId;

      // Sanitize all JSON fields
      if (validatedBatch.command_executions) {
        validatedBatch.command_executions.forEach(cmd => {
          cmd.command_args = sanitizeJsonField(cmd.command_args);
          cmd.context = sanitizeJsonField(cmd.context);
        });
      }

      if (validatedBatch.agent_interactions) {
        validatedBatch.agent_interactions.forEach(interaction => {
          interaction.metadata = sanitizeJsonField(interaction.metadata);
        });
      }

      if (validatedBatch.user_sessions) {
        validatedBatch.user_sessions.forEach(session => {
          session.context = sanitizeJsonField(session.context);
        });
      }

      if (validatedBatch.productivity_metrics) {
        validatedBatch.productivity_metrics.forEach(metric => {
          metric.dimensions = sanitizeJsonField(metric.dimensions);
        });
      }

      // Process batch
      const result = await this.metricsModel.batchInsertMetrics(validatedBatch);
      
      const processingTime = Date.now() - startTime;
      this.updatePerformanceStats(processingTime, true);

      const totalItems = Object.values(result).reduce((sum, count) => sum + count, 0);

      this.logger.info('Batch metrics collected', {
        organization_id: organizationId,
        total_items: totalItems,
        processing_time_ms: processingTime,
        ...result
      });

      return {
        success: true,
        data: {
          ...result,
          processing_time_ms: processingTime
        },
        rate_limit: rateLimitCheck.status,
        performance: { 
          processing_latency_ms: processingTime,
          ingestion_rate: totalItems / (processingTime / 1000) // items per second
        }
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updatePerformanceStats(processingTime, false);

      this.logger.error('Failed to collect batch metrics', {
        organization_id: organizationId,
        error: error instanceof Error ? error.message : 'Unknown error',
        processing_time_ms: processingTime
      });

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Batch collection failed',
        performance: { processing_latency_ms: processingTime }
      };
    }
  }

  /**
   * Rate Limiting Implementation
   */
  private checkRateLimit(
    identifier: string,
    config?: RateLimitConfig
  ): { allowed: boolean; status: RateLimitStatus } {
    const rateConfig = { ...this.defaultRateLimit, ...config };
    const key = identifier;
    const now = new Date();
    
    let bucket = this.rateLimitStore.get(key);
    
    if (!bucket || (now.getTime() - bucket.window_start.getTime()) >= rateConfig.window_ms) {
      // Create new bucket
      bucket = {
        count: 0,
        window_start: now
      };
      this.rateLimitStore.set(key, bucket);
    }
    
    const windowEnd = new Date(bucket.window_start.getTime() + rateConfig.window_ms);
    const remaining = Math.max(0, rateConfig.max_requests - bucket.count);
    
    if (bucket.count >= rateConfig.max_requests) {
      return {
        allowed: false,
        status: {
          limit: rateConfig.max_requests,
          remaining: 0,
          reset_time: windowEnd,
          retry_after: Math.ceil((windowEnd.getTime() - now.getTime()) / 1000)
        }
      };
    }
    
    bucket.count++;
    
    return {
      allowed: true,
      status: {
        limit: rateConfig.max_requests,
        remaining: remaining - 1,
        reset_time: windowEnd
      }
    };
  }

  private cleanupRateLimitCache(): void {
    const now = new Date();
    const cutoff = now.getTime() - (this.defaultRateLimit.window_ms * 2); // Clean entries older than 2x window
    
    for (const [key, bucket] of this.rateLimitStore.entries()) {
      if (bucket.window_start.getTime() < cutoff) {
        this.rateLimitStore.delete(key);
      }
    }
  }

  /**
   * Performance Monitoring
   */
  private updatePerformanceStats(processingTimeMs: number, success: boolean): void {
    this.performanceStats.total_requests++;
    
    if (success) {
      this.performanceStats.successful_requests++;
    } else {
      this.performanceStats.failed_requests++;
    }
    
    // Update running average processing time
    const totalSuccessfulRequests = this.performanceStats.successful_requests;
    this.performanceStats.avg_processing_time_ms = 
      ((this.performanceStats.avg_processing_time_ms * (totalSuccessfulRequests - 1)) + processingTimeMs) / totalSuccessfulRequests;
  }

  private resetPerformanceStats(): void {
    this.performanceStats = {
      total_requests: 0,
      successful_requests: 0,
      failed_requests: 0,
      avg_processing_time_ms: 0,
      last_reset: new Date()
    };
  }

  /**
   * Health and Performance Reporting
   */
  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    const dbMetrics = await this.metricsModel.getPerformanceMetrics();
    
    return {
      ...dbMetrics,
      processing_latency_ms: this.performanceStats.avg_processing_time_ms,
      ingestion_rate: this.performanceStats.successful_requests / 
        ((Date.now() - this.performanceStats.last_reset.getTime()) / 1000)
    };
  }

  getCollectionStats() {
    return {
      ...this.performanceStats,
      success_rate: this.performanceStats.total_requests > 0 ? 
        this.performanceStats.successful_requests / this.performanceStats.total_requests : 0,
      rate_limit_cache_size: this.rateLimitStore.size
    };
  }
}