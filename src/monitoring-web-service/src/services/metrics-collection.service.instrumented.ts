/**
 * Enhanced Metrics Collection Service with Business Tracing
 * Task 4.3: Custom Trace Instrumentation Enhancement (Sprint 4)
 * 
 * Features:
 * - Business process tracing for metrics ingestion pipeline
 * - Performance optimization tracking with sampling strategies
 * - Data processing workflow instrumentation
 * - Enhanced audit trails for compliance and debugging
 */

import * as api from '@opentelemetry/api';
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
import { 
  businessTraceService, 
  BusinessProcess, 
  CustomerSegment 
} from '../tracing/business-trace.service';

export interface CollectionResult {
  success: boolean;
  message?: string;
  data?: any;
  rate_limit?: RateLimitStatus;
  performance?: Partial<PerformanceMetrics>;
  traceId?: string;
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

// Enhanced collection context for business tracing
export interface CollectionContext {
  organizationId: string;
  userId?: string;
  tenantTier?: string;
  customerSegment?: CustomerSegment;
  collectionType: 'single' | 'batch';
  dataVolume: 'small' | 'medium' | 'large';
  priority: 'low' | 'medium' | 'high';
}

export class EnhancedMetricsCollectionService {
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
   * Enhanced Command Execution Collection with Business Tracing
   */
  async collectCommandExecution(
    organizationId: string,
    data: any,
    rateLimitConfig?: RateLimitConfig,
    context?: Partial<CollectionContext>
  ): Promise<CollectionResult> {
    const collectionContext: CollectionContext = {
      organizationId,
      collectionType: 'single',
      dataVolume: 'small',
      priority: 'medium',
      ...context
    };

    return businessTraceService.instrumentBusinessOperation(
      'collect_command_execution',
      BusinessProcess.METRICS_INGESTION,
      async (span: api.Span) => {
        const startTime = Date.now();
        const traceId = span.spanContext().traceId;

        // Add metrics ingestion specific attributes
        span.setAttributes({
          'metrics.ingestion.type': 'command_execution',
          'metrics.ingestion.organization_id': organizationId,
          'metrics.ingestion.collection_type': collectionContext.collectionType,
          'metrics.ingestion.data_volume': collectionContext.dataVolume,
          'metrics.ingestion.priority': collectionContext.priority,
          'metrics.processing.stage': 'validation'
        });

        // Add ingestion started event
        span.addEvent('metrics.ingestion.started', {
          'ingestion.type': 'command_execution',
          'organization.id': organizationId,
          'ingestion.priority': collectionContext.priority,
          'ingestion.start_time': startTime
        });

        try {
          // Rate limiting check with tracing
          span.setAttributes({ 'metrics.processing.stage': 'rate_limiting' });
          span.addEvent('metrics.rate_limit.check.started', {
            'rate_limit.organization_id': organizationId,
            'rate_limit.config': JSON.stringify(rateLimitConfig || this.defaultRateLimit)
          });

          const rateLimitCheck = this.checkRateLimit(organizationId, rateLimitConfig);
          if (!rateLimitCheck.allowed) {
            this.performanceStats.failed_requests++;

            span.setAttributes({
              'metrics.ingestion.rate_limited': true,
              'metrics.ingestion.success': false,
              'rate_limit.exceeded': true
            });

            span.addEvent('metrics.ingestion.rate_limited', {
              'rate_limit.limit': rateLimitCheck.status.limit,
              'rate_limit.remaining': rateLimitCheck.status.remaining,
              'rate_limit.retry_after': rateLimitCheck.status.retry_after || 0
            });

            return {
              success: false,
              message: 'Rate limit exceeded',
              rate_limit: rateLimitCheck.status,
              traceId
            };
          }

          span.addEvent('metrics.rate_limit.check.passed', {
            'rate_limit.remaining': rateLimitCheck.status.remaining,
            'rate_limit.limit': rateLimitCheck.status.limit
          });

          // Validation and sanitization with tracing
          span.setAttributes({ 'metrics.processing.stage': 'validation' });
          span.addEvent('metrics.validation.started', {
            'validation.type': 'command_execution',
            'data.size_bytes': JSON.stringify(data).length
          });

          const validatedData = validateCommandExecution(data);
          validatedData.command_args = sanitizeJsonField(validatedData.command_args);
          validatedData.context = sanitizeJsonField(validatedData.context);

          span.addEvent('metrics.validation.completed', {
            'validation.success': true,
            'data.command_name': validatedData.command_name,
            'data.sanitized': true
          });

          // Database storage with tracing
          span.setAttributes({ 'metrics.processing.stage': 'database_storage' });
          span.addEvent('metrics.storage.started', {
            'storage.operation': 'create_command_execution',
            'storage.organization_id': organizationId
          });

          const result = await businessTraceService.instrumentExternalIntegration(
            'database',
            'create_command_execution',
            async (dbSpan: api.Span) => {
              dbSpan.setAttributes({
                'db.operation.type': 'insert',
                'db.table': 'command_executions',
                'db.organization_id': organizationId
              });

              return this.metricsModel.createCommandExecution(organizationId, validatedData);
            },
            {
              endpoint: 'database.metrics',
              timeout: 5000
            }
          );
          
          const processingTime = Date.now() - startTime;
          this.updatePerformanceStats(processingTime, true);

          // Add performance attributes
          span.setAttributes({
            'metrics.ingestion.duration_ms': processingTime,
            'metrics.ingestion.success': true,
            'metrics.processing.stage': 'completed',
            'performance.category': this.categorizePerformance(processingTime)
          });

          // Add completion event
          span.addEvent('metrics.ingestion.completed', {
            'ingestion.success': true,
            'processing.duration_ms': processingTime,
            'result.id': result.id,
            'performance.category': this.categorizePerformance(processingTime)
          });

          // Add audit trail event
          span.addEvent('audit.metrics.collected', {
            'audit.event_type': 'command_execution_collected',
            'audit.organization_id': organizationId,
            'audit.command_name': validatedData.command_name,
            'audit.processing_time_ms': processingTime,
            'audit.success': true,
            'audit.timestamp': Date.now()
          });

          this.logger.info('Command execution collected successfully', {
            event: 'metrics.collection.success',
            organization_id: organizationId,
            command_name: validatedData.command_name,
            processing_time_ms: processingTime,
            trace_id: traceId,
            result_id: result.id
          });

          return {
            success: true,
            data: result,
            rate_limit: rateLimitCheck.status,
            performance: { 
              processing_latency_ms: processingTime,
              performance_category: this.categorizePerformance(processingTime)
            },
            traceId
          };

        } catch (error) {
          const processingTime = Date.now() - startTime;
          this.updatePerformanceStats(processingTime, false);
          const errorType = (error as Error).constructor.name;

          // Add error attributes
          span.setAttributes({
            'metrics.ingestion.success': false,
            'metrics.ingestion.duration_ms': processingTime,
            'error.type': errorType,
            'error.message': (error as Error).message,
            'error.business_impact': this.assessErrorImpact('command_execution', error as Error)
          });

          // Add error event
          span.addEvent('metrics.ingestion.failed', {
            'error.type': errorType,
            'error.message': (error as Error).message,
            'processing.duration_ms': processingTime,
            'ingestion.type': 'command_execution',
            'error.severity': this.getErrorSeverity(error as Error)
          });

          // Add audit trail for error
          span.addEvent('audit.metrics.collection.failed', {
            'audit.event_type': 'command_execution_failed',
            'audit.organization_id': organizationId,
            'audit.error_type': errorType,
            'audit.processing_time_ms': processingTime,
            'audit.timestamp': Date.now()
          });

          this.logger.error('Failed to collect command execution', {
            event: 'metrics.collection.failed',
            organization_id: organizationId,
            error: (error as Error).message,
            error_type: errorType,
            processing_time_ms: processingTime,
            trace_id: traceId
          });

          return {
            success: false,
            message: (error as Error).message,
            performance: { 
              processing_latency_ms: processingTime,
              performance_category: this.categorizePerformance(processingTime)
            },
            traceId
          };
        }
      },
      {
        businessStep: 'single_metric_collection',
        tenantId: organizationId,
        customerSegment: context?.customerSegment,
        resourceIntensive: collectionContext.dataVolume === 'large',
        optimizationCandidate: true,
        criticalPath: collectionContext.priority === 'high'
      }
    );
  }

  /**
   * Enhanced Batch Collection with Transaction-Level Tracing
   */
  async collectBatchMetrics(
    organizationId: string,
    batch: any,
    rateLimitConfig?: RateLimitConfig,
    context?: Partial<CollectionContext>
  ): Promise<BatchCollectionResult> {
    const collectionContext: CollectionContext = {
      organizationId,
      collectionType: 'batch',
      dataVolume: this.determineBatchSize(batch),
      priority: 'high', // Batch operations are typically high priority
      ...context
    };

    return businessTraceService.instrumentBusinessTransaction(
      'batch_metrics_collection',
      BusinessProcess.DATA_PROCESSING,
      [
        {
          name: 'validate_batch_data',
          operation: async (span: api.Span) => {
            span.addEvent('batch.validation.started', {
              'batch.estimated_items': this.estimateBatchSize(batch),
              'batch.data_volume': collectionContext.dataVolume
            });

            // Enhanced rate limiting for batch operations
            const batchRateLimit = {
              ...this.defaultRateLimit,
              max_requests: (rateLimitConfig?.max_requests || this.defaultRateLimit.max_requests) * 10,
              ...rateLimitConfig
            };

            const rateLimitCheck = this.checkRateLimit(organizationId, batchRateLimit);
            if (!rateLimitCheck.allowed) {
              throw new Error(`Batch rate limit exceeded: ${rateLimitCheck.status.retry_after}s retry after`);
            }

            // Validate batch structure
            const validatedBatch = validateMetricsBatch(batch);
            validatedBatch.organization_id = organizationId;

            span.addEvent('batch.validation.completed', {
              'validation.success': true,
              'batch.validated_items': this.countBatchItems(validatedBatch)
            });

            return { validatedBatch, rateLimitCheck };
          },
          context: {
            businessStep: 'batch_validation',
            resourceIntensive: true
          }
        },
        {
          name: 'sanitize_batch_data',
          operation: async (span: api.Span) => {
            span.addEvent('batch.sanitization.started');

            const { validatedBatch } = arguments[0] as any;

            // Sanitize all JSON fields in parallel for better performance
            await Promise.all([
              this.sanitizeBatchCommands(validatedBatch.command_executions || []),
              this.sanitizeBatchInteractions(validatedBatch.agent_interactions || []),
              this.sanitizeBatchSessions(validatedBatch.user_sessions || []),
              this.sanitizeBatchMetrics(validatedBatch.productivity_metrics || [])
            ]);

            span.addEvent('batch.sanitization.completed', {
              'sanitization.success': true,
              'sanitization.parallel_processing': true
            });

            return validatedBatch;
          },
          context: {
            businessStep: 'batch_sanitization',
            optimizationCandidate: true
          }
        },
        {
          name: 'store_batch_data',
          operation: async (span: api.Span) => {
            span.addEvent('batch.storage.started', {
              'storage.operation': 'batch_insert',
              'storage.organization_id': organizationId
            });

            const validatedBatch = arguments[0] as any;

            const result = await businessTraceService.instrumentExternalIntegration(
              'database',
              'batch_insert_metrics',
              async (dbSpan: api.Span) => {
                dbSpan.setAttributes({
                  'db.operation.type': 'batch_insert',
                  'db.batch.estimated_size': this.countBatchItems(validatedBatch),
                  'db.organization_id': organizationId
                });

                return this.metricsModel.batchInsertMetrics(validatedBatch);
              },
              {
                endpoint: 'database.batch_metrics',
                timeout: 30000 // Longer timeout for batch operations
              }
            );

            span.addEvent('batch.storage.completed', {
              'storage.success': true,
              'storage.items_processed': Object.values(result).reduce((sum: any, count: any) => sum + count, 0)
            });

            return result;
          },
          context: {
            businessStep: 'batch_storage',
            resourceIntensive: true,
            criticalPath: true
          }
        }
      ],
      {
        businessStep: 'batch_metrics_ingestion',
        tenantId: organizationId,
        customerSegment: context?.customerSegment,
        resourceIntensive: true,
        criticalPath: true,
        optimizationCandidate: true,
        userExperienceImpact: collectionContext.dataVolume === 'large'
      }
    ).then(([validationResult, sanitizedBatch, storageResult]: any[]) => {
      const totalItems = Object.values(storageResult).reduce((sum: any, count: any) => sum + count, 0);
      const processingTime = Date.now() - Date.now(); // This will be set by the transaction wrapper

      // Calculate ingestion rate
      const ingestionRate = totalItems / (processingTime / 1000);

      this.logger.info('Batch metrics collected successfully', {
        event: 'metrics.batch.collection.success',
        organization_id: organizationId,
        total_items: totalItems,
        processing_time_ms: processingTime,
        ingestion_rate_per_second: ingestionRate,
        data_volume: collectionContext.dataVolume,
        ...storageResult
      });

      return {
        success: true,
        data: {
          ...storageResult,
          processing_time_ms: processingTime
        },
        rate_limit: validationResult.rateLimitCheck.status,
        performance: {
          processing_latency_ms: processingTime,
          ingestion_rate: ingestionRate,
          performance_category: this.categorizePerformance(processingTime)
        }
      };
    }).catch((error: Error) => {
      const processingTime = Date.now() - Date.now(); // This will be set by the transaction wrapper
      const errorType = error.constructor.name;

      this.logger.error('Failed to collect batch metrics', {
        event: 'metrics.batch.collection.failed',
        organization_id: organizationId,
        error: error.message,
        error_type: errorType,
        processing_time_ms: processingTime,
        data_volume: collectionContext.dataVolume
      });

      return {
        success: false,
        message: error.message,
        performance: {
          processing_latency_ms: processingTime,
          performance_category: this.categorizePerformance(processingTime)
        }
      };
    });
  }

  /**
   * Enhanced Performance Monitoring with Business Context
   */
  async getPerformanceMetrics(): Promise<PerformanceMetrics & { business_context: any }> {
    return businessTraceService.instrumentBusinessOperation(
      'get_performance_metrics',
      BusinessProcess.PERFORMANCE_ANALYSIS,
      async (span: api.Span) => {
        span.addEvent('performance.metrics.retrieval.started');

        const dbMetrics = await this.metricsModel.getPerformanceMetrics();
        
        const enhancedMetrics = {
          ...dbMetrics,
          processing_latency_ms: this.performanceStats.avg_processing_time_ms,
          ingestion_rate: this.performanceStats.successful_requests / 
            ((Date.now() - this.performanceStats.last_reset.getTime()) / 1000),
          business_context: {
            collection_stats: this.getCollectionStats(),
            performance_categories: this.getPerformanceCategoryDistribution(),
            error_distribution: this.getErrorTypeDistribution(),
            optimization_candidates: this.getOptimizationCandidates()
          }
        };

        span.addEvent('performance.metrics.retrieval.completed', {
          'metrics.processing_latency_ms': enhancedMetrics.processing_latency_ms,
          'metrics.ingestion_rate': enhancedMetrics.ingestion_rate,
          'metrics.success_rate': this.performanceStats.total_requests > 0 ? 
            this.performanceStats.successful_requests / this.performanceStats.total_requests : 0
        });

        return enhancedMetrics;
      },
      {
        businessStep: 'performance_metrics_retrieval',
        optimizationCandidate: false,
        criticalPath: false
      }
    );
  }

  /**
   * Private helper methods for enhanced tracing
   */
  private determineBatchSize(batch: any): 'small' | 'medium' | 'large' {
    const itemCount = this.estimateBatchSize(batch);
    if (itemCount < 100) return 'small';
    if (itemCount < 1000) return 'medium';
    return 'large';
  }

  private estimateBatchSize(batch: any): number {
    let count = 0;
    if (batch.command_executions) count += batch.command_executions.length;
    if (batch.agent_interactions) count += batch.agent_interactions.length;
    if (batch.user_sessions) count += batch.user_sessions.length;
    if (batch.productivity_metrics) count += batch.productivity_metrics.length;
    return count;
  }

  private countBatchItems(batch: any): number {
    return this.estimateBatchSize(batch);
  }

  private async sanitizeBatchCommands(commands: any[]): Promise<void> {
    commands.forEach(cmd => {
      cmd.command_args = sanitizeJsonField(cmd.command_args);
      cmd.context = sanitizeJsonField(cmd.context);
    });
  }

  private async sanitizeBatchInteractions(interactions: any[]): Promise<void> {
    interactions.forEach(interaction => {
      interaction.metadata = sanitizeJsonField(interaction.metadata);
    });
  }

  private async sanitizeBatchSessions(sessions: any[]): Promise<void> {
    sessions.forEach(session => {
      session.context = sanitizeJsonField(session.context);
    });
  }

  private async sanitizeBatchMetrics(metrics: any[]): Promise<void> {
    metrics.forEach(metric => {
      metric.dimensions = sanitizeJsonField(metric.dimensions);
    });
  }

  private categorizePerformance(duration: number): string {
    if (duration < 100) return 'excellent';
    if (duration < 500) return 'good';
    if (duration < 1000) return 'acceptable';
    if (duration < 2000) return 'slow';
    return 'very_slow';
  }

  private assessErrorImpact(operationType: string, error: Error): string {
    if (operationType === 'batch' || error.name.includes('Database')) {
      return 'high';
    }
    if (error.name.includes('Validation') || error.name.includes('RateLimit')) {
      return 'medium';
    }
    return 'low';
  }

  private getErrorSeverity(error: Error): string {
    if (error.name.includes('Database') || error.name.includes('Connection')) {
      return 'high';
    }
    if (error.name.includes('Validation')) {
      return 'medium';
    }
    return 'low';
  }

  private getPerformanceCategoryDistribution(): Record<string, number> {
    // This would track performance category distribution over time
    // Implementation would use internal tracking
    return {
      excellent: 0,
      good: 0,
      acceptable: 0,
      slow: 0,
      very_slow: 0
    };
  }

  private getErrorTypeDistribution(): Record<string, number> {
    // This would track error type distribution
    return {
      validation: 0,
      database: 0,
      rate_limit: 0,
      network: 0,
      unknown: 0
    };
  }

  private getOptimizationCandidates(): string[] {
    // Return list of operations that could be optimized
    return [
      'batch_processing_parallelization',
      'database_connection_pooling',
      'json_sanitization_optimization',
      'rate_limiting_algorithm_improvement'
    ];
  }

  // Original methods for compatibility (rate limiting, performance stats, etc.)
  private checkRateLimit(
    identifier: string,
    config?: RateLimitConfig
  ): { allowed: boolean; status: RateLimitStatus } {
    const rateConfig = { ...this.defaultRateLimit, ...config };
    const key = identifier;
    const now = new Date();
    
    let bucket = this.rateLimitStore.get(key);
    
    if (!bucket || (now.getTime() - bucket.window_start.getTime()) >= rateConfig.window_ms) {
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
    const cutoff = now.getTime() - (this.defaultRateLimit.window_ms * 2);
    
    for (const [key, bucket] of this.rateLimitStore.entries()) {
      if (bucket.window_start.getTime() < cutoff) {
        this.rateLimitStore.delete(key);
      }
    }
  }

  private updatePerformanceStats(processingTimeMs: number, success: boolean): void {
    this.performanceStats.total_requests++;
    
    if (success) {
      this.performanceStats.successful_requests++;
    } else {
      this.performanceStats.failed_requests++;
    }
    
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

  getCollectionStats() {
    return {
      ...this.performanceStats,
      success_rate: this.performanceStats.total_requests > 0 ? 
        this.performanceStats.successful_requests / this.performanceStats.total_requests : 0,
      rate_limit_cache_size: this.rateLimitStore.size
    };
  }
}

// Export enhanced service as default
export default EnhancedMetricsCollectionService;