/**
 * Business Instrumentation Integration Example
 * Task 2.3: Custom Instrumentation for Business Logic - Complete Integration
 * 
 * This example demonstrates how to integrate all the custom instrumentation
 * components together to provide comprehensive business observability.
 */

import { DatabaseConnection } from '../database/connection';
import { InstrumentedDatabaseConnection } from '../database/connection.instrumented';
import { InstrumentedJWTService } from '../services/jwt.service.instrumented';
import { InstrumentedMetricsProcessingService } from '../services/metrics-processing.service.instrumented';
import { InstrumentedWebSocketService } from '../services/websocket.service.instrumented';
import { InstrumentedRedisManager } from '../config/redis.config.instrumented';
import { InstrumentedExternalApiService } from '../services/external-api.service.instrumented';
import { 
  BusinessInstrumentation, 
  BusinessContext, 
  BusinessAttributes,
  OperationType,
  getBusinessInstrumentation 
} from '../tracing/business-instrumentation';
import * as winston from 'winston';
import * as api from '@opentelemetry/api';

/**
 * Example: Complete User Authentication Flow with Business Instrumentation
 */
export class AuthenticationFlowExample {
  private jwtService: InstrumentedJWTService;
  private dbConnection: InstrumentedDatabaseConnection;
  private redisManager: InstrumentedRedisManager;
  private instrumentation: BusinessInstrumentation;
  private logger: winston.Logger;

  constructor(
    dbConnection: InstrumentedDatabaseConnection,
    jwtService: InstrumentedJWTService,
    redisManager: InstrumentedRedisManager,
    logger: winston.Logger
  ) {
    this.dbConnection = dbConnection;
    this.jwtService = jwtService;
    this.redisManager = redisManager;
    this.instrumentation = getBusinessInstrumentation();
    this.logger = logger;
  }

  /**
   * Complete authentication flow with business instrumentation
   */
  async authenticateUser(email: string, password: string, organizationId: string): Promise<any> {
    const context: BusinessContext = {
      organizationId,
      tenantId: organizationId,
      operationType: OperationType.AUTHENTICATION
    };

    return this.instrumentation.createBusinessSpan(
      'auth_flow.complete_authentication',
      OperationType.AUTHENTICATION,
      async (span: api.Span) => {
        span.setAttributes({
          [BusinessAttributes.ORGANIZATION_ID]: organizationId,
          [BusinessAttributes.AUTH_METHOD]: 'email_password',
          'auth.email': email.split('@')[1], // Domain only for privacy
          'auth.flow_type': 'login'
        });

        try {
          // Step 1: Check rate limiting in cache
          const rateLimitKey = `rate_limit:auth:${email}`;
          const rateLimitData = await this.redisManager.get(rateLimitKey, {
            context,
            keyPattern: 'rate_limit:auth:*'
          });

          if (rateLimitData && rateLimitData.attempts >= 5) {
            span.setAttributes({
              [BusinessAttributes.AUTH_RESULT]: 'rate_limited',
              'auth.rate_limit_attempts': rateLimitData.attempts
            });
            throw new Error('Too many authentication attempts');
          }

          // Step 2: Look up user in database
          const user = await this.dbConnection.query(
            'SELECT id, email, password_hash, role, organization_id, is_active FROM users WHERE email = $1 AND organization_id = $2',
            [email, organizationId],
            {
              name: 'lookup_user_for_auth',
              context,
              operationType: OperationType.AUTHENTICATION
            }
          );

          if (!user.rows.length) {
            span.setAttributes({
              [BusinessAttributes.AUTH_RESULT]: 'user_not_found'
            });
            
            // Update rate limiting
            await this.updateRateLimit(rateLimitKey, context);
            throw new Error('Invalid credentials');
          }

          const userData = user.rows[0];
          
          span.setAttributes({
            [BusinessAttributes.USER_ID]: userData.id,
            [BusinessAttributes.AUTH_ROLE]: userData.role,
            'auth.user_active': userData.is_active
          });

          if (!userData.is_active) {
            span.setAttributes({
              [BusinessAttributes.AUTH_RESULT]: 'user_inactive'
            });
            throw new Error('User account is inactive');
          }

          // Step 3: Verify password (instrumented password verification)
          const passwordValid = await this.instrumentation.createBusinessSpan(
            'auth.verify_password',
            OperationType.AUTHENTICATION,
            async (passwordSpan: api.Span) => {
              passwordSpan.setAttributes({
                'auth.password_verification': true
              });
              
              // Simulate password verification with bcrypt
              const bcrypt = require('bcrypt');
              const isValid = await bcrypt.compare(password, userData.password_hash);
              
              passwordSpan.setAttributes({
                'auth.password_valid': isValid
              });
              
              return isValid;
            },
            context
          );

          if (!passwordValid) {
            span.setAttributes({
              [BusinessAttributes.AUTH_RESULT]: 'invalid_password'
            });
            
            // Update rate limiting
            await this.updateRateLimit(rateLimitKey, context);
            throw new Error('Invalid credentials');
          }

          // Step 4: Get user team memberships
          const teamMemberships = await this.dbConnection.query(
            'SELECT team_id, role FROM team_memberships WHERE user_id = $1',
            [userData.id],
            {
              name: 'get_user_team_memberships',
              context,
              operationType: OperationType.AUTHENTICATION
            }
          );

          // Step 5: Generate JWT token pair
          const tokenPair = await this.jwtService.generateTokenPair({
            user_id: userData.id,
            organization_id: userData.organization_id,
            email: userData.email,
            role: userData.role,
            team_memberships: teamMemberships.rows
          });

          // Step 6: Cache user session data
          const sessionData = {
            user_id: userData.id,
            organization_id: userData.organization_id,
            role: userData.role,
            last_login: new Date().toISOString(),
            login_count: (rateLimitData?.login_count || 0) + 1
          };

          await this.redisManager.set(
            `session:${userData.id}`,
            sessionData,
            {
              ttl: 3600, // 1 hour
              context,
              keyPattern: 'session:*'
            }
          );

          // Step 7: Clear rate limiting on successful auth
          await this.redisManager.delete(`rate_limit:auth:${email}`, context);

          // Step 8: Log successful authentication
          await this.dbConnection.query(
            'INSERT INTO auth_logs (user_id, organization_id, action, ip_address, user_agent, created_at) VALUES ($1, $2, $3, $4, $5, NOW())',
            [userData.id, userData.organization_id, 'login_success', 'unknown', 'instrumented_example'],
            {
              name: 'log_successful_auth',
              context,
              operationType: OperationType.AUTHENTICATION
            }
          );

          span.setAttributes({
            [BusinessAttributes.AUTH_RESULT]: 'success',
            'auth.token_expires_in': tokenPair.expires_in,
            'auth.session_created': true
          });

          this.logger.info('User authentication successful', {
            user_id: userData.id,
            organization_id: userData.organization_id,
            role: userData.role,
            team_count: teamMemberships.rows.length
          });

          return {
            user: {
              id: userData.id,
              email: userData.email,
              role: userData.role,
              organization_id: userData.organization_id
            },
            tokens: tokenPair,
            session: sessionData
          };

        } catch (error) {
          span.setAttributes({
            [BusinessAttributes.AUTH_RESULT]: 'error',
            'auth.error_type': error instanceof Error ? error.message : 'Unknown error'
          });

          // Log failed authentication
          await this.dbConnection.query(
            'INSERT INTO auth_logs (user_id, organization_id, action, ip_address, user_agent, error_message, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW())',
            [null, organizationId, 'login_failed', 'unknown', 'instrumented_example', error instanceof Error ? error.message : 'Unknown error'],
            {
              name: 'log_failed_auth',
              context,
              operationType: OperationType.AUTHENTICATION
            }
          ).catch(() => {
            // Don't fail the auth flow if logging fails
          });

          throw error;
        }
      },
      context
    );
  }

  /**
   * Update rate limiting with instrumentation
   */
  private async updateRateLimit(rateLimitKey: string, context: BusinessContext): Promise<void> {
    const currentData = await this.redisManager.get(rateLimitKey, { context });
    const newData = {
      attempts: (currentData?.attempts || 0) + 1,
      last_attempt: new Date().toISOString(),
      login_count: currentData?.login_count || 0
    };

    await this.redisManager.set(rateLimitKey, newData, {
      ttl: 900, // 15 minutes
      context,
      keyPattern: 'rate_limit:auth:*'
    });
  }
}

/**
 * Example: Metrics Processing Pipeline with Business Instrumentation
 */
export class MetricsProcessingExample {
  private metricsProcessor: InstrumentedMetricsProcessingService;
  private dbConnection: InstrumentedDatabaseConnection;
  private redisManager: InstrumentedRedisManager;
  private wsService: InstrumentedWebSocketService;
  private instrumentation: BusinessInstrumentation;
  private logger: winston.Logger;

  constructor(
    metricsProcessor: InstrumentedMetricsProcessingService,
    dbConnection: InstrumentedDatabaseConnection,
    redisManager: InstrumentedRedisManager,
    wsService: InstrumentedWebSocketService,
    logger: winston.Logger
  ) {
    this.metricsProcessor = metricsProcessor;
    this.dbConnection = dbConnection;
    this.redisManager = redisManager;
    this.wsService = wsService;
    this.instrumentation = getBusinessInstrumentation();
    this.logger = logger;
  }

  /**
   * Process metrics with real-time updates and caching
   */
  async processMetricsWithRealTimeUpdates(
    organizationId: string,
    userId: string,
    metricsData: any[]
  ): Promise<void> {
    const context: BusinessContext = {
      organizationId,
      userId,
      tenantId: organizationId,
      operationType: OperationType.METRICS_PROCESSING
    };

    return this.instrumentation.createBusinessSpan(
      'metrics_flow.process_with_realtime',
      OperationType.METRICS_PROCESSING,
      async (span: api.Span) => {
        span.setAttributes({
          [BusinessAttributes.ORGANIZATION_ID]: organizationId,
          [BusinessAttributes.USER_ID]: userId,
          [BusinessAttributes.METRICS_BATCH_SIZE]: metricsData.length,
          'metrics.processing_type': 'realtime_enabled'
        });

        try {
          // Step 1: Validate and enrich metrics data
          const enrichedMetrics = await this.enrichMetricsData(metricsData, context);

          // Step 2: Store raw metrics in database
          await this.dbConnection.bulkInsert(
            'raw_metrics',
            ['organization_id', 'user_id', 'metric_type', 'metric_value', 'metadata', 'created_at'],
            enrichedMetrics.map(metric => [
              organizationId,
              userId,
              metric.type,
              metric.value,
              JSON.stringify(metric.metadata),
              new Date()
            ]),
            context
          );

          // Step 3: Process metrics through pipeline
          for (const metric of enrichedMetrics) {
            await this.metricsProcessor.publishMetricsEvent({
              type: metric.type,
              organization_id: organizationId,
              user_id: userId,
              timestamp: new Date(),
              data: metric
            });
          }

          // Step 4: Update real-time cache
          const realTimeData = {
            last_update: new Date().toISOString(),
            metrics_processed: enrichedMetrics.length,
            latest_metrics: enrichedMetrics.slice(-5), // Last 5 metrics
            user_activity: {
              user_id: userId,
              session_active: true,
              last_metric_time: new Date().toISOString()
            }
          };

          await this.redisManager.storeRealTimeData(organizationId, realTimeData);

          // Step 5: Broadcast to WebSocket subscribers
          await this.wsService.broadcastEvent(
            'metrics/processed',
            {
              organization_id: organizationId,
              user_id: userId,
              metrics_count: enrichedMetrics.length,
              processing_time: Date.now(),
              sample_metrics: enrichedMetrics.slice(0, 3) // First 3 metrics for preview
            },
            {
              organizations: [organizationId]
            }
          );

          span.setAttributes({
            'metrics.enriched_count': enrichedMetrics.length,
            'metrics.realtime_broadcast': true,
            'metrics.cache_updated': true
          });

          this.logger.info('Metrics processed with real-time updates', {
            organization_id: organizationId,
            user_id: userId,
            metrics_count: enrichedMetrics.length
          });

        } catch (error) {
          span.setAttributes({
            'metrics.processing_error': error instanceof Error ? error.message : 'Unknown error'
          });

          // Broadcast error to subscribers
          await this.wsService.broadcastEvent(
            'metrics/processing_error',
            {
              organization_id: organizationId,
              user_id: userId,
              error: error instanceof Error ? error.message : 'Unknown error',
              timestamp: new Date().toISOString()
            },
            {
              organizations: [organizationId]
            }
          );

          throw error;
        }
      },
      context
    );
  }

  /**
   * Enrich metrics data with business context
   */
  private async enrichMetricsData(metricsData: any[], context: BusinessContext): Promise<any[]> {
    return this.instrumentation.createBusinessSpan(
      'metrics.enrich_data',
      OperationType.METRICS_PROCESSING,
      async (span: api.Span) => {
        span.setAttributes({
          'metrics.enrichment.input_count': metricsData.length
        });

        // Get user context from cache or database
        const userContext = await this.redisManager.get(
          `user_context:${context.userId}`,
          { context, keyPattern: 'user_context:*' }
        );

        let userRole = 'unknown';
        if (!userContext) {
          // Fallback to database lookup
          const user = await this.dbConnection.query(
            'SELECT role FROM users WHERE id = $1',
            [context.userId],
            { name: 'get_user_role', context }
          );
          userRole = user.rows[0]?.role || 'unknown';
        } else {
          userRole = userContext.role;
        }

        const enriched = metricsData.map(metric => ({
          ...metric,
          metadata: {
            ...metric.metadata,
            user_role: userRole,
            organization_id: context.organizationId,
            enriched_at: new Date().toISOString(),
            source: 'instrumented_pipeline'
          }
        }));

        span.setAttributes({
          'metrics.enrichment.output_count': enriched.length,
          'metrics.enrichment.user_role': userRole
        });

        return enriched;
      },
      context
    );
  }
}

/**
 * Example: External API Integration with Circuit Breaker
 */
export class ExternalIntegrationExample {
  private externalApiService: InstrumentedExternalApiService;
  private redisManager: InstrumentedRedisManager;
  private instrumentation: BusinessInstrumentation;
  private logger: winston.Logger;

  constructor(
    externalApiService: InstrumentedExternalApiService,
    redisManager: InstrumentedRedisManager,
    logger: winston.Logger
  ) {
    this.externalApiService = externalApiService;
    this.redisManager = redisManager;
    this.instrumentation = getBusinessInstrumentation();
    this.logger = logger;
  }

  /**
   * Sync user data with external service with caching and circuit breaker
   */
  async syncUserDataWithExternalService(
    userId: string,
    organizationId: string
  ): Promise<any> {
    const context: BusinessContext = {
      userId,
      organizationId,
      tenantId: organizationId,
      operationType: OperationType.EXTERNAL_API_CALL
    };

    return this.instrumentation.createBusinessSpan(
      'external_sync.user_data',
      OperationType.EXTERNAL_API_CALL,
      async (span: api.Span) => {
        span.setAttributes({
          [BusinessAttributes.USER_ID]: userId,
          [BusinessAttributes.ORGANIZATION_ID]: organizationId,
          [BusinessAttributes.API_EXTERNAL_SERVICE]: 'user_sync_service'
        });

        try {
          // Step 1: Check cache first
          const cacheKey = `external_user_data:${userId}`;
          const cachedData = await this.redisManager.get(cacheKey, {
            context,
            keyPattern: 'external_user_data:*'
          });

          if (cachedData) {
            span.setAttributes({
              'external_sync.cache_hit': true,
              'external_sync.data_source': 'cache'
            });

            this.logger.debug('Using cached external user data', {
              user_id: userId,
              cache_age_minutes: Math.floor((Date.now() - new Date(cachedData.cached_at).getTime()) / 60000)
            });

            return cachedData.data;
          }

          // Step 2: Fetch from external service with circuit breaker
          const externalData = await this.externalApiService.get(
            `/users/${userId}/profile`,
            {
              serviceName: 'user_sync_service',
              timeout: 5000,
              retries: 2,
              context,
              circuitBreaker: true
            }
          );

          // Step 3: Cache the response
          await this.redisManager.set(
            cacheKey,
            {
              data: externalData,
              cached_at: new Date().toISOString(),
              source: 'external_api'
            },
            {
              ttl: 1800, // 30 minutes
              context,
              keyPattern: 'external_user_data:*'
            }
          );

          span.setAttributes({
            'external_sync.cache_hit': false,
            'external_sync.data_source': 'external_api',
            'external_sync.data_cached': true
          });

          this.logger.info('Fetched and cached external user data', {
            user_id: userId,
            organization_id: organizationId,
            data_size: JSON.stringify(externalData).length
          });

          return externalData;

        } catch (error) {
          span.setAttributes({
            'external_sync.error': error instanceof Error ? error.message : 'Unknown error',
            'external_sync.fallback_attempted': true
          });

          // Step 4: Fallback to stale cache data if available
          const staleData = await this.redisManager.get(
            `external_user_data:${userId}:stale`,
            { context }
          );

          if (staleData) {
            span.setAttributes({
              'external_sync.fallback_source': 'stale_cache'
            });

            this.logger.warn('Using stale cache data due to external service error', {
              user_id: userId,
              error: error instanceof Error ? error.message : 'Unknown error'
            });

            return staleData.data;
          }

          throw error;
        }
      },
      context
    );
  }
}

/**
 * Export all examples for use in application
 */
export {
  AuthenticationFlowExample,
  MetricsProcessingExample,
  ExternalIntegrationExample
};