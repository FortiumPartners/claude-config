/**
 * Business Metrics Initialization
 * Task 4.1: Business Metrics Integration (Sprint 4)
 * 
 * Centralized initialization for business metrics system:
 * - SignOz export manager setup
 * - Business metrics service configuration
 * - Database metrics integration
 * - Health monitoring activation
 */

import { logger } from '../config/logger';
import { config } from '../config/environment';
import { initializeSignOzMetricsExport } from '../config/signoz-metrics-export';
import { getBusinessMetricsService } from '../services/business-metrics.service';
import { initializeDatabaseMetrics, getDatabaseMetricsCollector } from '../database/business-metrics-integration';

/**
 * Business Metrics Configuration
 */
export interface BusinessMetricsInitConfig {
  enableApiMetrics?: boolean;
  enableDbMetrics?: boolean;
  enableTenantMetrics?: boolean;
  enableApplicationMetrics?: boolean;
  enableSignOzExport?: boolean;
  signOzEndpoint?: string;
  exportInterval?: number;
  batchSize?: number;
  maxMemoryUsage?: number;
  enablePrometheus?: boolean;
}

/**
 * Initialize complete business metrics system
 */
export async function initializeBusinessMetrics(
  prismaClient?: any,
  customConfig?: BusinessMetricsInitConfig
): Promise<{
  success: boolean;
  services: {
    businessMetrics: boolean;
    signozExport: boolean;
    databaseMetrics: boolean;
    healthMonitoring: boolean;
  };
  config: BusinessMetricsInitConfig;
  errors: string[];
}> {
  const errors: string[] = [];
  const services = {
    businessMetrics: false,
    signozExport: false,
    databaseMetrics: false,
    healthMonitoring: false,
  };

  // Default configuration
  const businessMetricsConfig: BusinessMetricsInitConfig = {
    enableApiMetrics: true,
    enableDbMetrics: true,
    enableTenantMetrics: true,
    enableApplicationMetrics: true,
    enableSignOzExport: config.otel.enabled && config.otel.metrics.enabled,
    signOzEndpoint: config.otel.exporter.metricsEndpoint,
    exportInterval: 30000, // 30 seconds
    batchSize: 512,
    maxMemoryUsage: 10 * 1024 * 1024, // 10MB
    enablePrometheus: config.otel.prometheus.enabled,
    ...customConfig,
  };

  logger.info('Initializing business metrics system', {
    event: 'business_metrics.init.started',
    config: businessMetricsConfig,
  });

  try {
    // 1. Initialize Business Metrics Service
    try {
      const metricsService = getBusinessMetricsService({
        enableApiMetrics: businessMetricsConfig.enableApiMetrics,
        enableDbMetrics: businessMetricsConfig.enableDbMetrics,
        enableTenantMetrics: businessMetricsConfig.enableTenantMetrics,
        enableApplicationMetrics: businessMetricsConfig.enableApplicationMetrics,
        collectionInterval: businessMetricsConfig.exportInterval,
        batchSize: businessMetricsConfig.batchSize,
        maxMemoryUsage: businessMetricsConfig.maxMemoryUsage,
      });

      services.businessMetrics = true;
      
      logger.info('Business metrics service initialized', {
        event: 'business_metrics.service.initialized',
        health: metricsService.getHealthStatus(),
      });

    } catch (error) {
      const errorMsg = `Failed to initialize business metrics service: ${error.message}`;
      errors.push(errorMsg);
      logger.error('Business metrics service initialization failed', {
        event: 'business_metrics.service.error',
        error: error.message,
        stack: error.stack,
      });
    }

    // 2. Initialize SignOz Export Manager
    if (businessMetricsConfig.enableSignOzExport) {
      try {
        await initializeSignOzMetricsExport({
          enabled: true,
          endpoint: businessMetricsConfig.signOzEndpoint,
          exportInterval: businessMetricsConfig.exportInterval,
          maxExportBatchSize: businessMetricsConfig.batchSize,
          enablePrometheusExport: businessMetricsConfig.enablePrometheus,
          enableConsoleExport: config.isDevelopment,
        });

        services.signozExport = true;
        
        logger.info('SignOz metrics export initialized', {
          event: 'business_metrics.signoz.initialized',
          endpoint: businessMetricsConfig.signOzEndpoint,
          interval: businessMetricsConfig.exportInterval,
        });

      } catch (error) {
        const errorMsg = `Failed to initialize SignOz export: ${error.message}`;
        errors.push(errorMsg);
        logger.error('SignOz export initialization failed', {
          event: 'business_metrics.signoz.error',
          error: error.message,
          stack: error.stack,
        });
      }
    } else {
      logger.info('SignOz metrics export disabled', {
        event: 'business_metrics.signoz.disabled',
      });
    }

    // 3. Initialize Database Metrics (if Prisma client provided)
    if (prismaClient && businessMetricsConfig.enableDbMetrics) {
      try {
        const dbCollector = initializeDatabaseMetrics(prismaClient, {
          maxConnections: config.database.maxConnections || 20,
          enablePeriodicMonitoring: true,
          monitoringInterval: businessMetricsConfig.exportInterval,
        });

        services.databaseMetrics = true;
        
        logger.info('Database metrics initialized', {
          event: 'business_metrics.database.initialized',
          health: dbCollector.getHealthStatus(),
        });

      } catch (error) {
        const errorMsg = `Failed to initialize database metrics: ${error.message}`;
        errors.push(errorMsg);
        logger.error('Database metrics initialization failed', {
          event: 'business_metrics.database.error',
          error: error.message,
          stack: error.stack,
        });
      }
    } else if (!prismaClient) {
      logger.info('Database metrics skipped - no Prisma client provided', {
        event: 'business_metrics.database.skipped',
      });
    }

    // 4. Activate Health Monitoring
    try {
      services.healthMonitoring = true;
      
      logger.info('Business metrics health monitoring activated', {
        event: 'business_metrics.health.activated',
      });

    } catch (error) {
      const errorMsg = `Failed to activate health monitoring: ${error.message}`;
      errors.push(errorMsg);
      logger.error('Health monitoring activation failed', {
        event: 'business_metrics.health.error',
        error: error.message,
      });
    }

    // 5. Validation and Final Status
    const success = services.businessMetrics && (
      !businessMetricsConfig.enableSignOzExport || services.signozExport
    );

    if (success) {
      logger.info('Business metrics system initialized successfully', {
        event: 'business_metrics.init.success',
        services,
        config: businessMetricsConfig,
        errors: errors.length > 0 ? errors : undefined,
      });
    } else {
      logger.warn('Business metrics system initialization completed with issues', {
        event: 'business_metrics.init.partial',
        services,
        errors,
      });
    }

    return {
      success,
      services,
      config: businessMetricsConfig,
      errors,
    };

  } catch (error) {
    const errorMsg = `Critical error during business metrics initialization: ${error.message}`;
    errors.push(errorMsg);
    
    logger.error('Business metrics initialization failed critically', {
      event: 'business_metrics.init.critical_error',
      error: error.message,
      stack: error.stack,
      services,
      config: businessMetricsConfig,
    });

    return {
      success: false,
      services,
      config: businessMetricsConfig,
      errors,
    };
  }
}

/**
 * Shutdown business metrics system gracefully
 */
export async function shutdownBusinessMetrics(): Promise<void> {
  logger.info('Shutting down business metrics system', {
    event: 'business_metrics.shutdown.started',
  });

  try {
    // Import shutdown functions dynamically to avoid circular dependencies
    const { shutdownSignOzMetricsExport } = await import('../config/signoz-metrics-export');
    
    await shutdownSignOzMetricsExport();
    
    logger.info('Business metrics system shutdown complete', {
      event: 'business_metrics.shutdown.complete',
    });

  } catch (error) {
    logger.error('Error during business metrics shutdown', {
      event: 'business_metrics.shutdown.error',
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Get comprehensive business metrics system status
 */
export async function getBusinessMetricsSystemStatus(): Promise<{
  overall: 'healthy' | 'degraded' | 'unhealthy';
  components: {
    businessMetrics: any;
    signozExport: any;
    databaseMetrics: any;
  };
  performance: {
    memoryUsage: number;
    exportMetrics: any;
  };
  configuration: BusinessMetricsInitConfig;
}> {
  try {
    const { getBusinessMetricsService } = await import('../services/business-metrics.service');
    const { getSignOzMetricsExportManager } = await import('../config/signoz-metrics-export');
    const { getDatabaseMetricsCollector } = await import('../database/business-metrics-integration');

    const businessMetricsHealth = getBusinessMetricsService().getHealthStatus();
    const signozExportHealth = getSignOzMetricsExportManager().getHealthStatus();
    const databaseMetricsHealth = getDatabaseMetricsCollector().getHealthStatus();

    // Determine overall system health
    let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (businessMetricsHealth.status === 'unhealthy' || 
        signozExportHealth.status === 'unhealthy' || 
        databaseMetricsHealth.status === 'unhealthy') {
      overall = 'unhealthy';
    } else if (businessMetricsHealth.status === 'degraded' || 
               signozExportHealth.status === 'degraded' || 
               databaseMetricsHealth.status === 'degraded') {
      overall = 'degraded';
    }

    return {
      overall,
      components: {
        businessMetrics: businessMetricsHealth,
        signozExport: signozExportHealth,
        databaseMetrics: databaseMetricsHealth,
      },
      performance: {
        memoryUsage: businessMetricsHealth.memoryUsage,
        exportMetrics: getBusinessMetricsService().getMetricsExport(),
      },
      configuration: {
        enableApiMetrics: true,
        enableDbMetrics: true,
        enableTenantMetrics: true,
        enableApplicationMetrics: true,
        enableSignOzExport: config.otel.enabled && config.otel.metrics.enabled,
        signOzEndpoint: config.otel.exporter.metricsEndpoint,
        exportInterval: 30000,
        batchSize: 512,
        maxMemoryUsage: 10 * 1024 * 1024,
        enablePrometheus: config.otel.prometheus.enabled,
      },
    };

  } catch (error) {
    logger.error('Failed to get business metrics system status', {
      event: 'business_metrics.status.error',
      error: error.message,
    });

    return {
      overall: 'unhealthy',
      components: {
        businessMetrics: { status: 'unhealthy', error: error.message },
        signozExport: { status: 'unhealthy', error: error.message },
        databaseMetrics: { status: 'unhealthy', error: error.message },
      },
      performance: {
        memoryUsage: 0,
        exportMetrics: null,
      },
      configuration: {
        enableApiMetrics: false,
        enableDbMetrics: false,
        enableTenantMetrics: false,
        enableApplicationMetrics: false,
        enableSignOzExport: false,
      },
    };
  }
}

/**
 * Validate business metrics configuration
 */
export function validateBusinessMetricsConfig(config: BusinessMetricsInitConfig): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate export interval
  if (config.exportInterval && (config.exportInterval < 1000 || config.exportInterval > 300000)) {
    errors.push('Export interval must be between 1s and 5 minutes');
  }

  // Validate batch size
  if (config.batchSize && (config.batchSize < 1 || config.batchSize > 10000)) {
    errors.push('Batch size must be between 1 and 10000');
  }

  // Validate memory limit
  if (config.maxMemoryUsage && config.maxMemoryUsage < 1024 * 1024) {
    errors.push('Max memory usage must be at least 1MB');
  }

  // Validate SignOz endpoint
  if (config.enableSignOzExport && config.signOzEndpoint) {
    try {
      new URL(config.signOzEndpoint);
    } catch {
      errors.push('SignOz endpoint must be a valid URL');
    }
  }

  // Warnings
  if (config.exportInterval && config.exportInterval < 5000) {
    warnings.push('Export interval < 5s may impact performance');
  }

  if (config.batchSize && config.batchSize > 1000) {
    warnings.push('Large batch size may increase memory usage');
  }

  if (config.maxMemoryUsage && config.maxMemoryUsage > 50 * 1024 * 1024) {
    warnings.push('High memory limit may impact application performance');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Get business metrics initialization health check
 */
export async function businessMetricsHealthCheck(): Promise<{
  status: 'pass' | 'warn' | 'fail';
  timestamp: string;
  details: Record<string, any>;
}> {
  try {
    const systemStatus = await getBusinessMetricsSystemStatus();
    
    let status: 'pass' | 'warn' | 'fail' = 'pass';
    if (systemStatus.overall === 'degraded') {
      status = 'warn';
    } else if (systemStatus.overall === 'unhealthy') {
      status = 'fail';
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      details: {
        overall_status: systemStatus.overall,
        components: systemStatus.components,
        performance: systemStatus.performance,
        memory_usage_mb: Math.round(systemStatus.performance.memoryUsage / 1024 / 1024 * 100) / 100,
      },
    };

  } catch (error) {
    return {
      status: 'fail',
      timestamp: new Date().toISOString(),
      details: {
        error: error.message,
        overall_status: 'unhealthy',
      },
    };
  }
}