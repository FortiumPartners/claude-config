/**
 * OpenTelemetry Feature Flags Configuration
 * Task 2.2: Auto-instrumentation Implementation - Feature Flags
 * 
 * Provides controllable enabling/disabling of instrumentation features
 * for production deployment and debugging purposes.
 */

import { logger } from './logger';

export interface OtelFeatureFlags {
  // Core instrumentation flags
  enableAutoInstrumentation: boolean;
  enableExpressInstrumentation: boolean;
  enableHttpInstrumentation: boolean;
  enableDatabaseInstrumentation: boolean;
  enableRedisInstrumentation: boolean;
  enableLoggingInstrumentation: boolean;
  
  // Performance monitoring flags
  enablePerformanceMonitoring: boolean;
  enablePerformanceMetrics: boolean;
  enableLatencyTracking: boolean;
  enableMemoryTracking: boolean;
  
  // Feature-specific flags
  enableCustomSpans: boolean;
  enableCustomMetrics: boolean;
  enableTraceContext: boolean;
  enableBaggage: boolean;
  
  // Debug and validation flags
  enableValidationEndpoints: boolean;
  enableDebugLogging: boolean;
  enableVerboseSpans: boolean;
  
  // Sampling and filtering flags
  enableSampling: boolean;
  enableRequestFiltering: boolean;
  enableResponseHeaderCapture: boolean;
  enableQueryParameterCapture: boolean;
  
  // Production optimization flags
  enableBatchProcessing: boolean;
  enableCompression: boolean;
  enableRetries: boolean;
  
  // Error handling flags
  enableErrorRecording: boolean;
  enableExceptionTracking: boolean;
  enableStackTraces: boolean;
}

/**
 * Default feature flags configuration
 */
const DEFAULT_FLAGS: OtelFeatureFlags = {
  // Core instrumentation - enabled by default
  enableAutoInstrumentation: true,
  enableExpressInstrumentation: true,
  enableHttpInstrumentation: true,
  enableDatabaseInstrumentation: true,
  enableRedisInstrumentation: true,
  enableLoggingInstrumentation: true,
  
  // Performance monitoring - enabled in development
  enablePerformanceMonitoring: true,
  enablePerformanceMetrics: true,
  enableLatencyTracking: true,
  enableMemoryTracking: false, // Can be resource intensive
  
  // Feature-specific - enabled by default
  enableCustomSpans: true,
  enableCustomMetrics: true,
  enableTraceContext: true,
  enableBaggage: false, // Can add overhead
  
  // Debug and validation - environment dependent
  enableValidationEndpoints: true,
  enableDebugLogging: false,
  enableVerboseSpans: false,
  
  // Sampling and filtering - enabled for production
  enableSampling: true,
  enableRequestFiltering: true,
  enableResponseHeaderCapture: true,
  enableQueryParameterCapture: false, // Security consideration
  
  // Production optimization - enabled by default
  enableBatchProcessing: true,
  enableCompression: true,
  enableRetries: true,
  
  // Error handling - enabled by default
  enableErrorRecording: true,
  enableExceptionTracking: true,
  enableStackTraces: true
};

/**
 * Environment-based feature flag overrides
 */
const ENVIRONMENT_OVERRIDES: Record<string, Partial<OtelFeatureFlags>> = {
  production: {
    enableValidationEndpoints: false,
    enableDebugLogging: false,
    enableVerboseSpans: false,
    enableMemoryTracking: false,
    enableQueryParameterCapture: false,
    enableStackTraces: false // Reduce overhead in production
  },
  
  development: {
    enableValidationEndpoints: true,
    enableDebugLogging: true,
    enableVerboseSpans: true,
    enableMemoryTracking: true,
    enableQueryParameterCapture: true,
    enableStackTraces: true
  },
  
  test: {
    enableValidationEndpoints: true,
    enableDebugLogging: false,
    enableVerboseSpans: false,
    enableMemoryTracking: false,
    enablePerformanceMonitoring: false, // Reduce noise in tests
    enableCustomMetrics: false
  },
  
  staging: {
    enableValidationEndpoints: true,
    enableDebugLogging: false,
    enableVerboseSpans: false,
    enableMemoryTracking: true,
    enableQueryParameterCapture: false,
    enableStackTraces: true
  }
};

/**
 * Parse feature flags from environment variables
 */
function parseEnvironmentFlags(): Partial<OtelFeatureFlags> {
  const envFlags: Partial<OtelFeatureFlags> = {};
  
  // Helper function to parse boolean environment variables
  const parseBool = (value: string | undefined, defaultValue: boolean): boolean => {
    if (value === undefined) return defaultValue;
    return value.toLowerCase() === 'true' || value === '1';
  };
  
  // Core instrumentation flags
  if (process.env.OTEL_ENABLE_AUTO_INSTRUMENTATION !== undefined) {
    envFlags.enableAutoInstrumentation = parseBool(process.env.OTEL_ENABLE_AUTO_INSTRUMENTATION, true);
  }
  
  if (process.env.OTEL_ENABLE_EXPRESS !== undefined) {
    envFlags.enableExpressInstrumentation = parseBool(process.env.OTEL_ENABLE_EXPRESS, true);
  }
  
  if (process.env.OTEL_ENABLE_HTTP !== undefined) {
    envFlags.enableHttpInstrumentation = parseBool(process.env.OTEL_ENABLE_HTTP, true);
  }
  
  if (process.env.OTEL_ENABLE_DATABASE !== undefined) {
    envFlags.enableDatabaseInstrumentation = parseBool(process.env.OTEL_ENABLE_DATABASE, true);
  }
  
  if (process.env.OTEL_ENABLE_REDIS !== undefined) {
    envFlags.enableRedisInstrumentation = parseBool(process.env.OTEL_ENABLE_REDIS, true);
  }
  
  if (process.env.OTEL_ENABLE_LOGGING !== undefined) {
    envFlags.enableLoggingInstrumentation = parseBool(process.env.OTEL_ENABLE_LOGGING, true);
  }
  
  // Performance monitoring flags
  if (process.env.OTEL_ENABLE_PERFORMANCE_MONITORING !== undefined) {
    envFlags.enablePerformanceMonitoring = parseBool(process.env.OTEL_ENABLE_PERFORMANCE_MONITORING, true);
  }
  
  if (process.env.OTEL_ENABLE_PERFORMANCE_METRICS !== undefined) {
    envFlags.enablePerformanceMetrics = parseBool(process.env.OTEL_ENABLE_PERFORMANCE_METRICS, true);
  }
  
  if (process.env.OTEL_ENABLE_LATENCY_TRACKING !== undefined) {
    envFlags.enableLatencyTracking = parseBool(process.env.OTEL_ENABLE_LATENCY_TRACKING, true);
  }
  
  if (process.env.OTEL_ENABLE_MEMORY_TRACKING !== undefined) {
    envFlags.enableMemoryTracking = parseBool(process.env.OTEL_ENABLE_MEMORY_TRACKING, false);
  }
  
  // Feature-specific flags
  if (process.env.OTEL_ENABLE_CUSTOM_SPANS !== undefined) {
    envFlags.enableCustomSpans = parseBool(process.env.OTEL_ENABLE_CUSTOM_SPANS, true);
  }
  
  if (process.env.OTEL_ENABLE_CUSTOM_METRICS !== undefined) {
    envFlags.enableCustomMetrics = parseBool(process.env.OTEL_ENABLE_CUSTOM_METRICS, true);
  }
  
  // Debug flags
  if (process.env.OTEL_ENABLE_VALIDATION_ENDPOINTS !== undefined) {
    envFlags.enableValidationEndpoints = parseBool(process.env.OTEL_ENABLE_VALIDATION_ENDPOINTS, true);
  }
  
  if (process.env.OTEL_ENABLE_DEBUG_LOGGING !== undefined) {
    envFlags.enableDebugLogging = parseBool(process.env.OTEL_ENABLE_DEBUG_LOGGING, false);
  }
  
  if (process.env.OTEL_ENABLE_VERBOSE_SPANS !== undefined) {
    envFlags.enableVerboseSpans = parseBool(process.env.OTEL_ENABLE_VERBOSE_SPANS, false);
  }
  
  // Security and filtering flags
  if (process.env.OTEL_ENABLE_QUERY_PARAMS !== undefined) {
    envFlags.enableQueryParameterCapture = parseBool(process.env.OTEL_ENABLE_QUERY_PARAMS, false);
  }
  
  if (process.env.OTEL_ENABLE_RESPONSE_HEADERS !== undefined) {
    envFlags.enableResponseHeaderCapture = parseBool(process.env.OTEL_ENABLE_RESPONSE_HEADERS, true);
  }
  
  return envFlags;
}

/**
 * Create final feature flags configuration
 */
function createFeatureFlags(): OtelFeatureFlags {
  const nodeEnv = process.env.NODE_ENV || 'development';
  
  // Start with defaults
  let flags = { ...DEFAULT_FLAGS };
  
  // Apply environment-specific overrides
  const envOverrides = ENVIRONMENT_OVERRIDES[nodeEnv];
  if (envOverrides) {
    flags = { ...flags, ...envOverrides };
  }
  
  // Apply explicit environment variable overrides
  const envFlags = parseEnvironmentFlags();
  flags = { ...flags, ...envFlags };
  
  // Validate flag combinations
  validateFlags(flags);
  
  return flags;
}

/**
 * Validate flag combinations and dependencies
 */
function validateFlags(flags: OtelFeatureFlags): void {
  const warnings: string[] = [];
  
  // Auto-instrumentation dependencies
  if (!flags.enableAutoInstrumentation) {
    if (flags.enableExpressInstrumentation || 
        flags.enableHttpInstrumentation || 
        flags.enableDatabaseInstrumentation) {
      warnings.push('Individual instrumentations enabled but auto-instrumentation disabled');
    }
  }
  
  // Performance monitoring dependencies
  if (flags.enablePerformanceMetrics && !flags.enablePerformanceMonitoring) {
    warnings.push('Performance metrics enabled but performance monitoring disabled');
  }
  
  // Custom spans/metrics dependencies
  if (flags.enableCustomMetrics && !flags.enableCustomSpans) {
    warnings.push('Custom metrics enabled but custom spans disabled - may limit functionality');
  }
  
  // Production warnings
  if (process.env.NODE_ENV === 'production') {
    if (flags.enableDebugLogging) {
      warnings.push('Debug logging enabled in production - may impact performance');
    }
    
    if (flags.enableVerboseSpans) {
      warnings.push('Verbose spans enabled in production - may impact performance');
    }
    
    if (flags.enableMemoryTracking) {
      warnings.push('Memory tracking enabled in production - may impact performance');
    }
  }
  
  // Log warnings
  if (warnings.length > 0) {
    logger.warn('OpenTelemetry feature flag warnings detected', {
      warnings,
      environment: process.env.NODE_ENV,
      event: 'otel.feature_flags.warnings'
    });
  }
}

// Create and export the feature flags
export const otelFeatureFlags = createFeatureFlags();

/**
 * Log current feature flags configuration
 */
export function logFeatureFlags(): void {
  const enabledFlags = Object.entries(otelFeatureFlags)
    .filter(([, value]) => value === true)
    .map(([key]) => key);
    
  const disabledFlags = Object.entries(otelFeatureFlags)
    .filter(([, value]) => value === false)
    .map(([key]) => key);

  logger.info('OpenTelemetry feature flags configuration', {
    environment: process.env.NODE_ENV,
    enabledFeatures: enabledFlags.length,
    disabledFeatures: disabledFlags.length,
    enabled: enabledFlags,
    disabled: disabledFlags,
    event: 'otel.feature_flags.configuration'
  });
}

/**
 * Check if a specific feature is enabled
 */
export function isFeatureEnabled(feature: keyof OtelFeatureFlags): boolean {
  return otelFeatureFlags[feature];
}

/**
 * Get all enabled features
 */
export function getEnabledFeatures(): string[] {
  return Object.entries(otelFeatureFlags)
    .filter(([, value]) => value === true)
    .map(([key]) => key);
}

/**
 * Get feature flags summary for health checks
 */
export function getFeatureFlagsSummary(): {
  totalFlags: number;
  enabledFlags: number;
  disabledFlags: number;
  coreInstrumentationEnabled: boolean;
  performanceMonitoringEnabled: boolean;
  debugFeaturesEnabled: boolean;
} {
  const totalFlags = Object.keys(otelFeatureFlags).length;
  const enabledFlags = Object.values(otelFeatureFlags).filter(Boolean).length;
  const disabledFlags = totalFlags - enabledFlags;
  
  const coreInstrumentationEnabled = 
    otelFeatureFlags.enableAutoInstrumentation &&
    otelFeatureFlags.enableExpressInstrumentation &&
    otelFeatureFlags.enableHttpInstrumentation;
    
  const performanceMonitoringEnabled = 
    otelFeatureFlags.enablePerformanceMonitoring &&
    otelFeatureFlags.enablePerformanceMetrics;
    
  const debugFeaturesEnabled = 
    otelFeatureFlags.enableDebugLogging ||
    otelFeatureFlags.enableVerboseSpans ||
    otelFeatureFlags.enableValidationEndpoints;
  
  return {
    totalFlags,
    enabledFlags,
    disabledFlags,
    coreInstrumentationEnabled,
    performanceMonitoringEnabled,
    debugFeaturesEnabled
  };
}

// Log the configuration on module load
logFeatureFlags();