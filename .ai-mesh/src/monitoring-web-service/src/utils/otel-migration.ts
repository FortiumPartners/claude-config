/**
 * OpenTelemetry Migration Utilities
 * Fortium Monitoring Web Service - Sprint 2: OpenTelemetry Migration
 * Task 2.4: Correlation Middleware Replacement with OTEL Context
 * 
 * Utilities to facilitate gradual migration from custom correlation to OTEL
 */

import { Request, Response, NextFunction } from 'express';
import { correlationMiddleware as legacyCorrelationMiddleware } from '../middleware/correlation.middleware';
import { otelCorrelationMiddleware } from '../middleware/otel-correlation.middleware';
import { config } from '../config/environment';
import { logger } from '../config/logger';

interface MigrationConfig {
  enableOTEL: boolean;
  rolloutPercentage: number;
  enableFeatureFlag: boolean;
  enableComparison: boolean;
  enableMetrics: boolean;
}

const defaultMigrationConfig: MigrationConfig = {
  enableOTEL: process.env.ENABLE_OTEL_CORRELATION === 'true',
  rolloutPercentage: parseInt(process.env.OTEL_ROLLOUT_PERCENTAGE || '0', 10),
  enableFeatureFlag: process.env.ENABLE_OTEL_FEATURE_FLAG === 'true',
  enableComparison: process.env.ENABLE_OTEL_COMPARISON === 'true',
  enableMetrics: process.env.ENABLE_OTEL_MIGRATION_METRICS === 'true',
};

/**
 * Migration Statistics Collector
 */
class MigrationStats {
  private stats = {
    totalRequests: 0,
    otelRequests: 0,
    legacyRequests: 0,
    otelErrors: 0,
    legacyErrors: 0,
    comparisonRuns: 0,
    comparisonMismatches: 0,
    performanceComparison: {
      otelAvgMs: 0,
      legacyAvgMs: 0,
      otelTotalMs: 0,
      legacyTotalMs: 0,
    },
  };

  recordRequest(useOTEL: boolean, duration: number, error?: boolean): void {
    this.stats.totalRequests++;
    
    if (useOTEL) {
      this.stats.otelRequests++;
      if (error) this.stats.otelErrors++;
      this.stats.performanceComparison.otelTotalMs += duration;
      this.stats.performanceComparison.otelAvgMs = 
        this.stats.performanceComparison.otelTotalMs / this.stats.otelRequests;
    } else {
      this.stats.legacyRequests++;
      if (error) this.stats.legacyErrors++;
      this.stats.performanceComparison.legacyTotalMs += duration;
      this.stats.performanceComparison.legacyAvgMs = 
        this.stats.performanceComparison.legacyTotalMs / this.stats.legacyRequests;
    }
  }

  recordComparison(mismatch: boolean = false): void {
    this.stats.comparisonRuns++;
    if (mismatch) this.stats.comparisonMismatches++;
  }

  getStats() {
    return {
      ...this.stats,
      otelSuccessRate: this.stats.otelRequests > 0 
        ? ((this.stats.otelRequests - this.stats.otelErrors) / this.stats.otelRequests) * 100 
        : 0,
      legacySuccessRate: this.stats.legacyRequests > 0 
        ? ((this.stats.legacyRequests - this.stats.legacyErrors) / this.stats.legacyRequests) * 100 
        : 0,
      otelAdoptionRate: this.stats.totalRequests > 0 
        ? (this.stats.otelRequests / this.stats.totalRequests) * 100 
        : 0,
      comparisonMismatchRate: this.stats.comparisonRuns > 0 
        ? (this.stats.comparisonMismatches / this.stats.comparisonRuns) * 100 
        : 0,
    };
  }

  reset(): void {
    this.stats = {
      totalRequests: 0,
      otelRequests: 0,
      legacyRequests: 0,
      otelErrors: 0,
      legacyErrors: 0,
      comparisonRuns: 0,
      comparisonMismatches: 0,
      performanceComparison: {
        otelAvgMs: 0,
        legacyAvgMs: 0,
        otelTotalMs: 0,
        legacyTotalMs: 0,
      },
    };
  }
}

const migrationStats = new MigrationStats();

/**
 * Feature Flag Evaluator
 */
function shouldUseOTEL(req: Request, migrationConfig: MigrationConfig): boolean {
  // Feature flag override
  if (migrationConfig.enableFeatureFlag) {
    const otelHeader = req.headers['x-enable-otel'] as string;
    if (otelHeader === 'true') return true;
    if (otelHeader === 'false') return false;
  }

  // Global OTEL enable flag
  if (!migrationConfig.enableOTEL) return false;

  // Rollout percentage based on request ID hash
  if (migrationConfig.rolloutPercentage > 0 && migrationConfig.rolloutPercentage < 100) {
    const requestId = req.headers['x-request-id'] as string || 
                     req.ip || 
                     `${Date.now()}_${Math.random()}`;
    
    const hash = simpleHash(requestId);
    const percentage = hash % 100;
    return percentage < migrationConfig.rolloutPercentage;
  }

  // Full rollout
  return migrationConfig.rolloutPercentage >= 100;
}

/**
 * Simple hash function for consistent rollout decisions
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Middleware Factory for Migration
 */
export function createMigrationMiddleware(customConfig?: Partial<MigrationConfig>) {
  const migrationConfig = { ...defaultMigrationConfig, ...customConfig };
  
  const legacyMiddleware = legacyCorrelationMiddleware();
  const otelMiddleware = otelCorrelationMiddleware({
    enableOTEL: true,
    backwardCompatible: true,
  });

  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();
    const useOTEL = shouldUseOTEL(req, migrationConfig);
    
    // Add migration metadata to request
    (req as any).migrationMetadata = {
      useOTEL,
      migrationConfig,
      startTime,
    };

    // Select appropriate middleware
    const selectedMiddleware = useOTEL ? otelMiddleware : legacyMiddleware;
    
    // Wrap response to collect metrics
    if (migrationConfig.enableMetrics) {
      const originalEnd = res.end;
      res.end = function(this: Response, chunk?: any, encoding?: any): Response {
        const duration = Date.now() - startTime;
        const hadError = res.statusCode >= 400;
        
        migrationStats.recordRequest(useOTEL, duration, hadError);
        
        // Log migration metrics periodically
        if (migrationStats.getStats().totalRequests % 100 === 0) {
          logger.info('OTEL Migration Statistics', {
            event: 'otel.migration.stats',
            stats: migrationStats.getStats(),
          });
        }
        
        return originalEnd.call(this, chunk, encoding);
      };
    }

    // Execute selected middleware
    try {
      selectedMiddleware(req, res, next);
    } catch (error) {
      logger.error('Migration middleware error', {
        event: 'otel.migration.error',
        useOTEL,
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
      next(error);
    }
  };
}

/**
 * Comparison Middleware for Testing Both Approaches
 */
export function createComparisonMiddleware() {
  const legacyMiddleware = legacyCorrelationMiddleware();
  const otelMiddleware = otelCorrelationMiddleware({
    enableOTEL: true,
    backwardCompatible: true,
  });

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!defaultMigrationConfig.enableComparison) {
      // Fallback to migration middleware
      return createMigrationMiddleware()(req, res, next);
    }

    const startTime = Date.now();
    
    // Create mock request/response for legacy middleware testing
    const mockReq = { ...req } as Request;
    const mockRes = { 
      ...res,
      setHeader: () => {},
      end: function() { return this; },
    } as Response;
    
    let legacyError: Error | null = null;
    let otelError: Error | null = null;
    
    // Test legacy middleware
    try {
      legacyMiddleware(mockReq, mockRes, (err?: any) => {
        if (err) legacyError = err;
      });
    } catch (error) {
      legacyError = error as Error;
    }
    
    // Execute OTEL middleware for real
    try {
      otelMiddleware(req, res, (err?: any) => {
        if (err) otelError = err;
        
        // Compare results
        const comparisonResult = compareMiddlewareResults(
          mockReq, req,
          legacyError, otelError
        );
        
        migrationStats.recordComparison(!comparisonResult.match);
        
        if (!comparisonResult.match) {
          logger.warn('OTEL Migration Comparison Mismatch', {
            event: 'otel.migration.comparison.mismatch',
            differences: comparisonResult.differences,
            legacyData: {
              correlationId: mockReq.correlationId,
              traceId: mockReq.traceId,
              spanId: mockReq.spanId,
              error: legacyError?.message,
            },
            otelData: {
              correlationId: req.correlationId,
              traceId: req.traceId,
              spanId: req.spanId,
              error: otelError?.message,
            },
          });
        }
        
        // Continue with OTEL middleware result
        next(otelError);
      });
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Compare middleware results
 */
function compareMiddlewareResults(
  legacyReq: Request,
  otelReq: Request,
  legacyError: Error | null,
  otelError: Error | null
): { match: boolean; differences: string[] } {
  const differences: string[] = [];
  
  // Compare error states
  if ((legacyError === null) !== (otelError === null)) {
    differences.push('error_state_mismatch');
  }
  
  // Compare correlation IDs (should be present in both)
  if (!legacyReq.correlationId && !otelReq.correlationId) {
    // Both missing is OK
  } else if (!legacyReq.correlationId || !otelReq.correlationId) {
    differences.push('correlation_id_presence');
  }
  
  // Compare request IDs (should be present in both)
  if (!legacyReq.requestId !== !otelReq.requestId) {
    differences.push('request_id_presence');
  }
  
  // Compare logger presence
  if (!legacyReq.logger !== !otelReq.logger) {
    differences.push('logger_presence');
  }
  
  // Compare log context
  if (!legacyReq.logContext !== !otelReq.logContext) {
    differences.push('log_context_presence');
  }
  
  return {
    match: differences.length === 0,
    differences,
  };
}

/**
 * Health Check for Migration Status
 */
export function getMigrationHealth(): {
  status: 'healthy' | 'degraded' | 'unhealthy';
  details: any;
} {
  const stats = migrationStats.getStats();
  
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  
  // Check for high error rates
  if (stats.otelSuccessRate < 95 && stats.otelRequests > 10) {
    status = 'degraded';
  }
  
  // Check for high mismatch rates in comparison mode
  if (stats.comparisonMismatchRate > 5 && stats.comparisonRuns > 10) {
    status = 'degraded';
  }
  
  // Check for system health
  if (stats.otelSuccessRate < 90 || stats.comparisonMismatchRate > 10) {
    status = 'unhealthy';
  }
  
  return {
    status,
    details: {
      migrationConfig: defaultMigrationConfig,
      statistics: stats,
      recommendations: generateRecommendations(stats),
    },
  };
}

/**
 * Generate recommendations based on migration statistics
 */
function generateRecommendations(stats: any): string[] {
  const recommendations: string[] = [];
  
  if (stats.otelAdoptionRate < 50 && defaultMigrationConfig.rolloutPercentage < 100) {
    recommendations.push('Consider increasing rollout percentage for broader OTEL adoption');
  }
  
  if (stats.otelSuccessRate < stats.legacySuccessRate && stats.otelRequests > 10) {
    recommendations.push('OTEL implementation has lower success rate - investigate issues');
  }
  
  if (stats.comparisonMismatchRate > 5) {
    recommendations.push('High comparison mismatch rate - review OTEL implementation compatibility');
  }
  
  if (stats.performanceComparison.otelAvgMs > stats.performanceComparison.legacyAvgMs * 1.2) {
    recommendations.push('OTEL middleware has significantly higher latency - optimize implementation');
  }
  
  if (stats.otelAdoptionRate > 95 && stats.otelSuccessRate > 99) {
    recommendations.push('Migration appears successful - consider removing legacy middleware');
  }
  
  return recommendations;
}

/**
 * Reset migration statistics
 */
export function resetMigrationStats(): void {
  migrationStats.reset();
  logger.info('Migration statistics reset', {
    event: 'otel.migration.stats.reset',
  });
}

/**
 * Get current migration statistics
 */
export function getMigrationStats() {
  return migrationStats.getStats();
}

/**
 * Environment-based configuration helpers
 */
export const migrationPresets = {
  // Development: Enable comparison mode
  development: {
    enableOTEL: true,
    rolloutPercentage: 50,
    enableFeatureFlag: true,
    enableComparison: true,
    enableMetrics: true,
  },
  
  // Staging: Gradual rollout
  staging: {
    enableOTEL: true,
    rolloutPercentage: 25,
    enableFeatureFlag: true,
    enableComparison: false,
    enableMetrics: true,
  },
  
  // Production: Conservative rollout
  production: {
    enableOTEL: true,
    rolloutPercentage: 10,
    enableFeatureFlag: false,
    enableComparison: false,
    enableMetrics: true,
  },
  
  // Testing: Full OTEL
  testing: {
    enableOTEL: true,
    rolloutPercentage: 100,
    enableFeatureFlag: false,
    enableComparison: false,
    enableMetrics: false,
  },
};

/**
 * Create environment-specific migration middleware
 */
export function createEnvironmentMigrationMiddleware(environment?: string) {
  const env = environment || config.nodeEnv || 'development';
  const preset = migrationPresets[env as keyof typeof migrationPresets] || migrationPresets.development;
  
  return createMigrationMiddleware(preset);
}

export default {
  createMigrationMiddleware,
  createComparisonMiddleware,
  createEnvironmentMigrationMiddleware,
  getMigrationHealth,
  getMigrationStats,
  resetMigrationStats,
  migrationPresets,
};