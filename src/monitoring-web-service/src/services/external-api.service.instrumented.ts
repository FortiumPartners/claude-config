/**
 * Instrumented External API Service
 * Task 2.3.4: External Integrations (2h)
 * 
 * Comprehensive OpenTelemetry instrumentation for external integrations including:
 * - External API calls with custom attributes
 * - Webhook processing and event handling
 * - Third-party service integrations and error rates
 * - Circuit breaker pattern instrumentation
 */

import fetch, { RequestInit, Response } from 'node-fetch';
import * as winston from 'winston';
import { 
  BusinessInstrumentation, 
  BusinessContext, 
  BusinessAttributes,
  OperationType,
  InstrumentMethod,
  getBusinessInstrumentation 
} from '../tracing/business-instrumentation';
import * as api from '@opentelemetry/api';
import { SemanticAttributes } from '@opentelemetry/semantic-conventions';

export interface ExternalApiConfig {
  baseUrl: string;
  timeout: number;
  retries: number;
  retryDelay: number;
  circuitBreaker: {
    failureThreshold: number;
    resetTimeout: number;
    monitoringPeriod: number;
  };
  headers?: Record<string, string>;
}

export interface ApiCallOptions {
  timeout?: number;
  retries?: number;
  headers?: Record<string, string>;
  context?: BusinessContext;
  serviceName?: string;
  circuitBreaker?: boolean;
}

export interface WebhookEvent {
  id: string;
  type: string;
  source: string;
  timestamp: Date;
  data: any;
  signature?: string;
  organizationId?: string;
}

export interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  lastFailureTime?: Date;
  nextAttemptTime?: Date;
  successCount: number;
}

export interface ExternalApiMetrics {
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  avg_response_time: number;
  success_rate: number;
  circuit_breaker_trips: number;
  retry_attempts: number;
  timeout_count: number;
}

/**
 * Instrumented External API Service with comprehensive OpenTelemetry tracing
 */
export class InstrumentedExternalApiService {
  private logger: winston.Logger;
  private instrumentation: BusinessInstrumentation;
  private config: ExternalApiConfig;
  private circuitBreakerStates: Map<string, CircuitBreakerState> = new Map();
  private metrics: ExternalApiMetrics;

  constructor(config: ExternalApiConfig, logger: winston.Logger) {
    this.config = config;
    this.logger = logger;
    this.instrumentation = getBusinessInstrumentation();
    
    this.metrics = {
      total_requests: 0,
      successful_requests: 0,
      failed_requests: 0,
      avg_response_time: 0,
      success_rate: 0,
      circuit_breaker_trips: 0,
      retry_attempts: 0,
      timeout_count: 0
    };

    // Start circuit breaker monitoring
    setInterval(() => {
      this.monitorCircuitBreakers();
    }, this.config.circuitBreaker.monitoringPeriod);
  }

  /**
   * Make HTTP GET request with comprehensive instrumentation
   */
  async get<T = any>(
    endpoint: string,
    options?: ApiCallOptions
  ): Promise<T> {
    return this.makeRequest<T>('GET', endpoint, undefined, options);
  }

  /**
   * Make HTTP POST request with comprehensive instrumentation
   */
  async post<T = any>(
    endpoint: string,
    data?: any,
    options?: ApiCallOptions
  ): Promise<T> {
    return this.makeRequest<T>('POST', endpoint, data, options);
  }

  /**
   * Make HTTP PUT request with comprehensive instrumentation
   */
  async put<T = any>(
    endpoint: string,
    data?: any,
    options?: ApiCallOptions
  ): Promise<T> {
    return this.makeRequest<T>('PUT', endpoint, data, options);
  }

  /**
   * Make HTTP DELETE request with comprehensive instrumentation
   */
  async delete<T = any>(
    endpoint: string,
    options?: ApiCallOptions
  ): Promise<T> {
    return this.makeRequest<T>('DELETE', endpoint, undefined, options);
  }

  /**
   * Core request method with comprehensive instrumentation
   */
  private async makeRequest<T = any>(
    method: string,
    endpoint: string,
    data?: any,
    options?: ApiCallOptions
  ): Promise<T> {
    const serviceName = options?.serviceName || 'unknown';
    const fullUrl = `${this.config.baseUrl}${endpoint}`;
    
    const context: BusinessContext = {
      ...options?.context
    };

    return this.instrumentation.instrumentExternalAPI(
      serviceName,
      fullUrl,
      async (span: api.Span) => {
        // Check circuit breaker
        if (options?.circuitBreaker !== false) {
          const circuitBreakerKey = `${serviceName}:${this.config.baseUrl}`;
          if (this.isCircuitBreakerOpen(circuitBreakerKey)) {
            span.setAttributes({
              [BusinessAttributes.API_CIRCUIT_BREAKER_STATE]: 'open',
              'api.request_blocked': true
            });
            
            throw new Error(`Circuit breaker is open for ${serviceName}`);
          }
        }

        const requestStart = Date.now();
        let attempt = 0;
        const maxRetries = options?.retries ?? this.config.retries;
        
        span.setAttributes({
          [SemanticAttributes.HTTP_METHOD]: method,
          [SemanticAttributes.HTTP_URL]: fullUrl,
          [BusinessAttributes.API_EXTERNAL_SERVICE]: serviceName,
          'http.request.endpoint': endpoint,
          'http.request.max_retries': maxRetries,
          'http.request.timeout_ms': options?.timeout || this.config.timeout,
          'http.request.has_body': !!data
        });

        if (data) {
          const bodySize = JSON.stringify(data).length;
          span.setAttributes({
            'http.request.body_size_bytes': bodySize
          });
        }

        while (attempt <= maxRetries) {
          try {
            const requestOptions: RequestInit = {
              method,
              headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Fortium-Monitoring-Service/1.0',
                ...this.config.headers,
                ...options?.headers
              },
              timeout: options?.timeout || this.config.timeout,
            };

            if (data) {
              requestOptions.body = JSON.stringify(data);
            }

            span.setAttributes({
              'http.request.attempt': attempt + 1
            });

            const response = await fetch(fullUrl, requestOptions);
            const responseTime = Date.now() - requestStart;
            
            // Update metrics
            this.updateApiMetrics(responseTime, response.ok, attempt);
            
            span.setAttributes({
              [SemanticAttributes.HTTP_STATUS_CODE]: response.status,
              [BusinessAttributes.API_RESPONSE_TIME]: responseTime,
              [BusinessAttributes.API_RETRY_COUNT]: attempt,
              'http.response.status_text': response.statusText,
              'http.response.headers.content_length': response.headers.get('content-length') || 0
            });

            if (!response.ok) {
              const errorText = await response.text();
              
              span.setAttributes({
                'http.response.error_body': errorText.substring(0, 500), // Limit error body size
                'http.response.error': true
              });

              // Handle circuit breaker on failure
              if (options?.circuitBreaker !== false) {
                const circuitBreakerKey = `${serviceName}:${this.config.baseUrl}`;
                this.recordCircuitBreakerFailure(circuitBreakerKey);
              }

              if (attempt < maxRetries && this.isRetryableStatus(response.status)) {
                attempt++;
                this.metrics.retry_attempts++;
                
                const delay = this.calculateRetryDelay(attempt);
                span.setAttributes({
                  'http.retry.delay_ms': delay,
                  'http.retry.reason': 'http_error'
                });
                
                await this.sleep(delay);
                continue;
              }

              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // Parse response
            const contentType = response.headers.get('content-type') || '';
            let responseData: T;
            
            if (contentType.includes('application/json')) {
              responseData = await response.json() as T;
            } else {
              responseData = await response.text() as unknown as T;
            }

            span.setAttributes({
              'http.response.content_type': contentType,
              'http.response.parsed': true,
              [BusinessAttributes.API_SUCCESS_RATE]: 1.0
            });

            // Record circuit breaker success
            if (options?.circuitBreaker !== false) {
              const circuitBreakerKey = `${serviceName}:${this.config.baseUrl}`;
              this.recordCircuitBreakerSuccess(circuitBreakerKey);
            }

            this.logger.debug('External API call successful', {
              service: serviceName,
              method,
              endpoint,
              status: response.status,
              response_time_ms: responseTime,
              attempts: attempt + 1,
              tenant_id: context.tenantId
            });

            return responseData;

          } catch (error) {
            const responseTime = Date.now() - requestStart;
            const isTimeout = error instanceof Error && error.message.includes('timeout');
            
            if (isTimeout) {
              this.metrics.timeout_count++;
            }

            span.setAttributes({
              'http.request.error': error instanceof Error ? error.message : 'Unknown error',
              'http.request.error_type': this.categorizeApiError(error),
              'http.request.is_timeout': isTimeout
            });

            // Handle circuit breaker on error
            if (options?.circuitBreaker !== false) {
              const circuitBreakerKey = `${serviceName}:${this.config.baseUrl}`;
              this.recordCircuitBreakerFailure(circuitBreakerKey);
            }

            if (attempt < maxRetries && this.isRetryableError(error)) {
              attempt++;
              this.metrics.retry_attempts++;
              
              const delay = this.calculateRetryDelay(attempt);
              span.setAttributes({
                'http.retry.delay_ms': delay,
                'http.retry.reason': 'network_error'
              });
              
              await this.sleep(delay);
              continue;
            }

            // Update metrics for final failure
            this.updateApiMetrics(responseTime, false, attempt);

            this.logger.error('External API call failed', {
              service: serviceName,
              method,
              endpoint,
              error: error instanceof Error ? error.message : 'Unknown error',
              attempts: attempt + 1,
              tenant_id: context.tenantId
            });

            throw error;
          }
        }

        throw new Error(`Maximum retries (${maxRetries}) exceeded`);
      },
      context
    );
  }

  /**
   * Process webhook with comprehensive instrumentation
   */
  async processWebhook(
    event: WebhookEvent,
    context?: BusinessContext
  ): Promise<void> {
    const businessContext: BusinessContext = {
      ...context,
      organizationId: event.organizationId
    };

    return this.instrumentation.createBusinessSpan(
      'webhook.process',
      OperationType.WEBHOOK_PROCESSING,
      async (span: api.Span) => {
        span.setAttributes({
          'webhook.id': event.id,
          'webhook.type': event.type,
          'webhook.source': event.source,
          'webhook.timestamp': event.timestamp.toISOString(),
          'webhook.has_signature': !!event.signature,
          'webhook.data_size_bytes': JSON.stringify(event.data).length,
          [BusinessAttributes.ORGANIZATION_ID]: event.organizationId || 'unknown'
        });

        try {
          // Validate webhook signature if present
          if (event.signature) {
            const signatureValid = await this.validateWebhookSignature(event);
            span.setAttributes({
              'webhook.signature_valid': signatureValid
            });

            if (!signatureValid) {
              throw new Error('Invalid webhook signature');
            }
          }

          // Process webhook based on type
          await this.processWebhookByType(event, span);

          span.setAttributes({
            'webhook.processing_result': 'success'
          });

          this.logger.info('Webhook processed successfully', {
            webhook_id: event.id,
            webhook_type: event.type,
            source: event.source,
            organization_id: event.organizationId
          });

        } catch (error) {
          span.setAttributes({
            'webhook.processing_result': 'error',
            'webhook.error': error instanceof Error ? error.message : 'Unknown error'
          });

          this.logger.error('Webhook processing failed', {
            webhook_id: event.id,
            webhook_type: event.type,
            error: error instanceof Error ? error.message : 'Unknown error'
          });

          throw error;
        }
      },
      businessContext
    );
  }

  /**
   * Validate webhook signature
   */
  @InstrumentMethod(OperationType.WEBHOOK_PROCESSING, 'validate_webhook_signature')
  private async validateWebhookSignature(event: WebhookEvent): Promise<boolean> {
    const span = api.trace.getActiveSpan();
    
    try {
      // Implementation would depend on the specific webhook signature algorithm
      // This is a placeholder for HMAC-SHA256 validation
      
      if (span) {
        span.setAttributes({
          'webhook.signature_algorithm': 'hmac-sha256',
          'webhook.signature_provided': !!event.signature
        });
      }

      // Placeholder validation - implement actual signature verification
      return event.signature !== undefined;

    } catch (error) {
      if (span) {
        span.setAttributes({
          'webhook.signature_validation_error': error instanceof Error ? error.message : 'Unknown error'
        });
      }

      return false;
    }
  }

  /**
   * Process webhook by type
   */
  private async processWebhookByType(event: WebhookEvent, parentSpan: api.Span): Promise<void> {
    switch (event.type) {
      case 'metrics.created':
        await this.processMetricsWebhook(event, parentSpan);
        break;
      
      case 'user.activity':
        await this.processUserActivityWebhook(event, parentSpan);
        break;
      
      case 'system.alert':
        await this.processSystemAlertWebhook(event, parentSpan);
        break;
      
      default:
        parentSpan.setAttributes({
          'webhook.type_handler': 'unknown',
          'webhook.processed': false
        });
        
        this.logger.warn('Unknown webhook type', {
          webhook_type: event.type,
          webhook_id: event.id
        });
    }
  }

  /**
   * Process metrics webhook
   */
  private async processMetricsWebhook(event: WebhookEvent, parentSpan: api.Span): Promise<void> {
    parentSpan.setAttributes({
      'webhook.type_handler': 'metrics',
      'webhook.metrics_count': event.data.metrics?.length || 0
    });

    // Process metrics data
    // Implementation would handle the specific metrics processing logic
    
    this.logger.debug('Processed metrics webhook', {
      webhook_id: event.id,
      metrics_count: event.data.metrics?.length || 0
    });
  }

  /**
   * Process user activity webhook
   */
  private async processUserActivityWebhook(event: WebhookEvent, parentSpan: api.Span): Promise<void> {
    parentSpan.setAttributes({
      'webhook.type_handler': 'user_activity',
      'webhook.user_id': event.data.user_id,
      'webhook.activity_type': event.data.activity_type
    });

    // Process user activity data
    // Implementation would handle the specific user activity processing logic
    
    this.logger.debug('Processed user activity webhook', {
      webhook_id: event.id,
      user_id: event.data.user_id,
      activity_type: event.data.activity_type
    });
  }

  /**
   * Process system alert webhook
   */
  private async processSystemAlertWebhook(event: WebhookEvent, parentSpan: api.Span): Promise<void> {
    parentSpan.setAttributes({
      'webhook.type_handler': 'system_alert',
      'webhook.alert_severity': event.data.severity,
      'webhook.alert_component': event.data.component
    });

    // Process system alert
    // Implementation would handle the specific alert processing logic
    
    this.logger.info('Processed system alert webhook', {
      webhook_id: event.id,
      severity: event.data.severity,
      component: event.data.component
    });
  }

  /**
   * Check if circuit breaker is open
   */
  private isCircuitBreakerOpen(key: string): boolean {
    const state = this.circuitBreakerStates.get(key);
    if (!state) return false;

    if (state.state === 'open') {
      if (state.nextAttemptTime && Date.now() >= state.nextAttemptTime.getTime()) {
        // Transition to half-open
        state.state = 'half-open';
        state.successCount = 0;
        return false;
      }
      return true;
    }

    return false;
  }

  /**
   * Record circuit breaker failure
   */
  private recordCircuitBreakerFailure(key: string): void {
    let state = this.circuitBreakerStates.get(key);
    if (!state) {
      state = {
        state: 'closed',
        failureCount: 0,
        successCount: 0
      };
      this.circuitBreakerStates.set(key, state);
    }

    state.failureCount++;
    state.lastFailureTime = new Date();

    if (state.state === 'half-open') {
      // Failure in half-open state, go back to open
      state.state = 'open';
      state.nextAttemptTime = new Date(Date.now() + this.config.circuitBreaker.resetTimeout);
      this.metrics.circuit_breaker_trips++;
    } else if (state.failureCount >= this.config.circuitBreaker.failureThreshold) {
      // Too many failures, open the circuit
      state.state = 'open';
      state.nextAttemptTime = new Date(Date.now() + this.config.circuitBreaker.resetTimeout);
      this.metrics.circuit_breaker_trips++;
    }

    this.logger.warn('Circuit breaker failure recorded', {
      key,
      failure_count: state.failureCount,
      state: state.state
    });
  }

  /**
   * Record circuit breaker success
   */
  private recordCircuitBreakerSuccess(key: string): void {
    let state = this.circuitBreakerStates.get(key);
    if (!state) {
      state = {
        state: 'closed',
        failureCount: 0,
        successCount: 0
      };
      this.circuitBreakerStates.set(key, state);
    }

    state.successCount++;

    if (state.state === 'half-open') {
      // Success in half-open state, close the circuit
      state.state = 'closed';
      state.failureCount = 0;
    }
  }

  /**
   * Monitor circuit breakers and reset as needed
   */
  @InstrumentMethod(OperationType.EXTERNAL_API_CALL, 'monitor_circuit_breakers')
  private monitorCircuitBreakers(): void {
    const span = api.trace.getActiveSpan();
    let monitored = 0;
    let open = 0;
    let halfOpen = 0;

    for (const [key, state] of this.circuitBreakerStates.entries()) {
      monitored++;
      
      if (state.state === 'open') {
        open++;
      } else if (state.state === 'half-open') {
        halfOpen++;
      }

      // Reset failure count periodically for closed circuits
      if (state.state === 'closed' && state.lastFailureTime) {
        const timeSinceLastFailure = Date.now() - state.lastFailureTime.getTime();
        if (timeSinceLastFailure > this.config.circuitBreaker.monitoringPeriod) {
          state.failureCount = Math.max(0, state.failureCount - 1);
        }
      }
    }

    if (span) {
      span.setAttributes({
        'circuit_breaker.monitored_count': monitored,
        'circuit_breaker.open_count': open,
        'circuit_breaker.half_open_count': halfOpen
      });
    }
  }

  /**
   * Check if HTTP status is retryable
   */
  private isRetryableStatus(status: number): boolean {
    return [408, 429, 500, 502, 503, 504].includes(status);
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    if (!error.message) return false;
    
    const message = error.message.toLowerCase();
    return message.includes('timeout') ||
           message.includes('network') ||
           message.includes('connection') ||
           message.includes('econnreset') ||
           message.includes('enotfound');
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attempt: number): number {
    return Math.min(
      this.config.retryDelay * Math.pow(2, attempt - 1),
      30000 // Max 30 seconds
    );
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Categorize API errors
   */
  private categorizeApiError(error: any): string {
    if (!error.message) return 'unknown';
    
    const message = error.message.toLowerCase();
    
    if (message.includes('timeout')) return 'timeout';
    if (message.includes('network')) return 'network';
    if (message.includes('connection')) return 'connection';
    if (message.includes('dns')) return 'dns';
    if (message.includes('certificate')) return 'certificate';
    if (message.includes('unauthorized')) return 'authorization';
    
    return 'api_error';
  }

  /**
   * Update API metrics
   */
  private updateApiMetrics(responseTime: number, success: boolean, attempts: number): void {
    this.metrics.total_requests++;
    
    if (success) {
      this.metrics.successful_requests++;
    } else {
      this.metrics.failed_requests++;
    }

    // Update average response time
    this.metrics.avg_response_time = 
      ((this.metrics.avg_response_time * (this.metrics.total_requests - 1)) + responseTime) / 
      this.metrics.total_requests;

    // Update success rate
    this.metrics.success_rate = this.metrics.successful_requests / this.metrics.total_requests;

    // Record retry attempts (subtract 1 because first attempt is not a retry)
    this.metrics.retry_attempts += Math.max(0, attempts);
  }

  /**
   * Get API metrics
   */
  getMetrics(): ExternalApiMetrics {
    return { ...this.metrics };
  }

  /**
   * Get circuit breaker states
   */
  getCircuitBreakerStates(): Map<string, CircuitBreakerState> {
    return new Map(this.circuitBreakerStates);
  }

  /**
   * Health check for external API service
   */
  @InstrumentMethod(OperationType.EXTERNAL_API_CALL, 'health_check')
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> {
    const span = api.trace.getActiveSpan();
    
    try {
      // Check if any circuit breakers are open
      const openCircuits = Array.from(this.circuitBreakerStates.entries())
        .filter(([_, state]) => state.state === 'open');

      const isHealthy = openCircuits.length === 0 && this.metrics.success_rate > 0.8;

      if (span) {
        span.setAttributes({
          'health_check.result': isHealthy ? 'healthy' : 'unhealthy',
          'health_check.open_circuits': openCircuits.length,
          'health_check.success_rate': this.metrics.success_rate
        });
      }

      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        details: {
          metrics: this.metrics,
          open_circuits: openCircuits.length,
          circuit_breaker_states: Object.fromEntries(this.circuitBreakerStates)
        }
      };

    } catch (error) {
      if (span) {
        span.setAttributes({
          'health_check.result': 'unhealthy',
          'health_check.error': error instanceof Error ? error.message : 'Unknown error'
        });
      }

      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }
}