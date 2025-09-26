/**
 * OpenTelemetry Logging Feature Flags Configuration
 * Task 3.1: OTEL Logging Transport Implementation - Feature Flag System
 * 
 * Provides granular control over OTEL logging transport features
 * for gradual rollout and A/B testing with Seq logging system.
 */

import { config } from './environment';

export interface OTelLoggingFeatureFlags {
  // Core logging transport flags
  enableOTELLogging: boolean;
  enableParallelLogging: boolean; // Both Seq and OTEL simultaneously
  enableOTELOnly: boolean; // Disable Seq, OTEL only
  
  // Transport configuration flags
  enableBatchProcessing: boolean;
  enableCircuitBreaker: boolean;
  enableCorrelation: boolean;
  enableTraceContext: boolean;
  
  // Performance and reliability flags
  enablePerformanceMonitoring: boolean;
  enableHealthChecks: boolean;
  enableMetricsCollection: boolean;
  enableRetryLogic: boolean;
  
  // Development and debugging flags
  enableValidationLogging: boolean;
  enableDebugMode: boolean;
  enableVerboseAttributes: boolean;
  enableConsoleLogging: boolean;
  
  // Migration and compatibility flags
  enableSeqCompatibility: boolean;
  enableGradualMigration: boolean;
  enableFallbackToSeq: boolean;
  
  // Security and filtering flags
  enableAttributeFiltering: boolean;
  enableSensitiveDataMasking: boolean;
  enablePIIFiltering: boolean;
  
  // Export and format flags
  enableOTLPExport: boolean;
  enableJSONFormat: boolean;
  enableCompression: boolean;
}

/**
 * Default feature flags configuration
 */
const DEFAULT_LOGGING_FLAGS: OTelLoggingFeatureFlags = {
  // Core logging transport - OTEL-only mode enabled
  enableOTELLogging: true, // Enable OTEL logging
  enableParallelLogging: false, // Disable parallel operation
  enableOTELOnly: true, // Use OTEL-only mode
  
  // Transport configuration - enabled for full functionality
  enableBatchProcessing: true,
  enableCircuitBreaker: true,
  enableCorrelation: true,
  enableTraceContext: true,
  
  // Performance and reliability - enabled for monitoring
  enablePerformanceMonitoring: true,
  enableHealthChecks: true,
  enableMetricsCollection: true,
  enableRetryLogic: true,
  
  // Development and debugging - environment dependent
  enableValidationLogging: false,
  enableDebugMode: false,
  enableVerboseAttributes: false,
  enableConsoleLogging: true, // Enable console logging alongside OTEL
  
  // Migration and compatibility - enabled for smooth transition
  enableSeqCompatibility: true,
  enableGradualMigration: true,
  enableFallbackToSeq: true,
  
  // Security and filtering - enabled for production safety
  enableAttributeFiltering: true,
  enableSensitiveDataMasking: true,
  enablePIIFiltering: true,
  
  // Export and format - optimized defaults
  enableOTLPExport: true,
  enableJSONFormat: true,
  enableCompression: true,
};

/**
 * Environment-based feature flag overrides
 */
const ENVIRONMENT_OVERRIDES: Record<string, Partial<OTelLoggingFeatureFlags>> = {
  development: {
    enableOTELLogging: true, // Enable OTEL logging
    enableOTELOnly: true, // OTEL-only mode
    enableParallelLogging: false, // Disable parallel logging
    enableDebugMode: true,
    enableVerboseAttributes: true,
    enableValidationLogging: true,
    enablePIIFiltering: false, // Allow full data in development
    enableConsoleLogging: true, // Enable console logging alongside OTEL
  },

  test: {
    enableOTELLogging: true, // Enable OTEL for tests
    enableOTELOnly: true, // OTEL-only mode
    enableParallelLogging: false,
    enableDebugMode: false,
    enableConsoleLogging: true, // Enable console logging for tests
    enablePerformanceMonitoring: false,
    enableHealthChecks: false,
  },

  staging: {
    enableOTELLogging: true, // Enable OTEL logging
    enableOTELOnly: true, // OTEL-only mode
    enableParallelLogging: false, // Disable parallel logging
    enableDebugMode: false,
    enableValidationLogging: true,
    enablePIIFiltering: true,
    enableConsoleLogging: true, // Enable console logging alongside OTEL
    enableFallbackToSeq: false, // No fallback in OTEL-only mode
  },

  production: {
    enableOTELLogging: true, // Enable OTEL logging
    enableOTELOnly: true, // OTEL-only mode
    enableParallelLogging: false, // Disable parallel logging
    enableDebugMode: false,
    enableVerboseAttributes: false,
    enableValidationLogging: false,
    enablePIIFiltering: true,
    enableSensitiveDataMasking: true,
    enableConsoleLogging: true, // Enable console logging alongside OTEL
    enableFallbackToSeq: false, // No fallback in OTEL-only mode
  },
};

/**
 * Parse logging feature flags from environment variables
 */
function parseLoggingEnvironmentFlags(): Partial<OTelLoggingFeatureFlags> {
  const envFlags: Partial<OTelLoggingFeatureFlags> = {};
  
  // Helper function to parse boolean environment variables
  const parseBool = (value: string | undefined, defaultValue: boolean): boolean => {
    if (value === undefined) return defaultValue;
    return value.toLowerCase() === 'true' || value === '1';
  };
  
  // Core logging flags
  if (process.env.OTEL_ENABLE_LOGGING !== undefined) {
    envFlags.enableOTELLogging = parseBool(process.env.OTEL_ENABLE_LOGGING, false);
  }
  
  if (process.env.OTEL_ENABLE_PARALLEL_LOGGING !== undefined) {
    envFlags.enableParallelLogging = parseBool(process.env.OTEL_ENABLE_PARALLEL_LOGGING, true);
  }
  
  if (process.env.OTEL_LOGGING_ONLY !== undefined) {
    envFlags.enableOTELOnly = parseBool(process.env.OTEL_LOGGING_ONLY, false);
  }
  
  // Transport configuration flags
  if (process.env.OTEL_ENABLE_BATCH_LOGGING !== undefined) {
    envFlags.enableBatchProcessing = parseBool(process.env.OTEL_ENABLE_BATCH_LOGGING, true);
  }
  
  if (process.env.OTEL_ENABLE_CIRCUIT_BREAKER !== undefined) {
    envFlags.enableCircuitBreaker = parseBool(process.env.OTEL_ENABLE_CIRCUIT_BREAKER, true);
  }
  
  if (process.env.OTEL_ENABLE_LOG_CORRELATION !== undefined) {
    envFlags.enableCorrelation = parseBool(process.env.OTEL_ENABLE_LOG_CORRELATION, true);
  }
  
  if (process.env.OTEL_ENABLE_TRACE_CONTEXT !== undefined) {
    envFlags.enableTraceContext = parseBool(process.env.OTEL_ENABLE_TRACE_CONTEXT, true);
  }
  
  // Performance monitoring flags
  if (process.env.OTEL_ENABLE_LOGGING_PERFORMANCE !== undefined) {
    envFlags.enablePerformanceMonitoring = parseBool(process.env.OTEL_ENABLE_LOGGING_PERFORMANCE, true);
  }
  
  if (process.env.OTEL_ENABLE_LOGGING_HEALTH_CHECKS !== undefined) {
    envFlags.enableHealthChecks = parseBool(process.env.OTEL_ENABLE_LOGGING_HEALTH_CHECKS, true);
  }
  
  // Debug flags
  if (process.env.OTEL_ENABLE_DEBUG_LOGGING !== undefined) {
    envFlags.enableDebugMode = parseBool(process.env.OTEL_ENABLE_DEBUG_LOGGING, false);
  }

  if (process.env.OTEL_ENABLE_VERBOSE_LOGGING !== undefined) {
    envFlags.enableVerboseAttributes = parseBool(process.env.OTEL_ENABLE_VERBOSE_LOGGING, false);
  }

  // Console logging flag
  if (process.env.OTEL_ENABLE_CONSOLE_LOGGING !== undefined) {
    envFlags.enableConsoleLogging = parseBool(process.env.OTEL_ENABLE_CONSOLE_LOGGING, false);
  }
  
  // Migration flags
  if (process.env.OTEL_ENABLE_SEQ_FALLBACK !== undefined) {
    envFlags.enableFallbackToSeq = parseBool(process.env.OTEL_ENABLE_SEQ_FALLBACK, true);
  }
  
  if (process.env.OTEL_ENABLE_GRADUAL_MIGRATION !== undefined) {
    envFlags.enableGradualMigration = parseBool(process.env.OTEL_ENABLE_GRADUAL_MIGRATION, true);
  }
  
  // Security flags
  if (process.env.OTEL_ENABLE_PII_FILTERING !== undefined) {
    envFlags.enablePIIFiltering = parseBool(process.env.OTEL_ENABLE_PII_FILTERING, true);
  }
  
  if (process.env.OTEL_ENABLE_DATA_MASKING !== undefined) {
    envFlags.enableSensitiveDataMasking = parseBool(process.env.OTEL_ENABLE_DATA_MASKING, true);
  }
  
  return envFlags;
}

/**
 * Create final logging feature flags configuration
 */
function createLoggingFeatureFlags(): OTelLoggingFeatureFlags {
  const nodeEnv = config.nodeEnv;
  
  // Start with defaults
  let flags = { ...DEFAULT_LOGGING_FLAGS };
  
  // Apply environment-specific overrides
  const envOverrides = ENVIRONMENT_OVERRIDES[nodeEnv];
  if (envOverrides) {
    flags = { ...flags, ...envOverrides };
  }
  
  // Apply explicit environment variable overrides
  const envFlags = parseLoggingEnvironmentFlags();
  flags = { ...flags, ...envFlags };
  
  // Validate flag combinations
  validateLoggingFlags(flags);
  
  return flags;
}

/**
 * Validate logging flag combinations and dependencies
 */
function validateLoggingFlags(flags: OTelLoggingFeatureFlags): void {
  const warnings: string[] = [];
  const errors: string[] = [];
  
  // Logical consistency checks
  if (flags.enableOTELOnly && !flags.enableOTELLogging) {
    errors.push('Cannot enable OTEL-only mode without enabling OTEL logging');
  }
  
  if (flags.enableParallelLogging && flags.enableOTELOnly) {
    warnings.push('Parallel logging enabled with OTEL-only mode - parallel logging will be ignored');
  }
  
  if (flags.enableOTELLogging && !flags.enableOTLPExport) {
    warnings.push('OTEL logging enabled but OTLP export disabled - logs may not be exported');
  }
  
  // Performance impact warnings
  if (flags.enableVerboseAttributes && config.isProduction) {
    warnings.push('Verbose attributes enabled in production - may impact performance');
  }
  
  if (flags.enableDebugMode && config.isProduction) {
    warnings.push('Debug mode enabled in production - may impact performance');
  }
  
  // Security warnings
  if (!flags.enablePIIFiltering && config.isProduction) {
    warnings.push('PII filtering disabled in production - potential security risk');
  }
  
  if (!flags.enableSensitiveDataMasking && config.isProduction) {
    warnings.push('Sensitive data masking disabled in production - potential security risk');
  }
  
  // Dependency warnings
  if (flags.enableCorrelation && !flags.enableTraceContext) {
    warnings.push('Correlation enabled but trace context disabled - correlation may be limited');
  }
  
  if (flags.enablePerformanceMonitoring && !flags.enableMetricsCollection) {
    warnings.push('Performance monitoring enabled but metrics collection disabled');
  }
  
  // Migration warnings
  if (flags.enableOTELOnly && !flags.enableFallbackToSeq) {
    warnings.push('OTEL-only mode without Seq fallback - no backup logging if OTEL fails');
  }
  
  // Log errors and warnings
  if (errors.length > 0) {
    logger.error('OpenTelemetry logging feature flag errors detected', {
      errors,
      environment: nodeEnv,
      event: 'otel.logging.flags.errors'
    });
    throw new Error(`Invalid OTEL logging configuration: ${errors.join(', ')}`);
  }
  
  if (warnings.length > 0) {
    logger.warn('OpenTelemetry logging feature flag warnings detected', {
      warnings,
      environment: nodeEnv,
      event: 'otel.logging.flags.warnings'
    });
  }
}

// Create and export the logging feature flags
export const otelLoggingFlags = createLoggingFeatureFlags();

/**
 * Log current logging feature flags configuration
 */
export function logLoggingFeatureFlags(): void {
  const enabledFlags = Object.entries(otelLoggingFlags)
    .filter(([, value]) => value === true)
    .map(([key]) => key);
    
  const disabledFlags = Object.entries(otelLoggingFlags)
    .filter(([, value]) => value === false)
    .map(([key]) => key);

  // Only log if console logging is enabled
  if (otelLoggingFlags.enableConsoleLogging) {
    console.log('OpenTelemetry logging feature flags configuration:', {
      environment: config.nodeEnv,
      totalFlags: Object.keys(otelLoggingFlags).length,
      enabledFeatures: enabledFlags.length,
      disabledFeatures: disabledFlags.length,
      enabled: enabledFlags,
      disabled: disabledFlags,
      loggingMode: getLoggingMode(),
      event: 'otel.logging.flags.configuration'
    });
  }
}

/**
 * Determine current logging mode
 */
export function getLoggingMode(): 'seq_only' | 'otel_only' | 'parallel' | 'disabled' {
  if (!otelLoggingFlags.enableOTELLogging) {
    return 'seq_only';
  }
  
  if (otelLoggingFlags.enableOTELOnly) {
    return 'otel_only';
  }
  
  if (otelLoggingFlags.enableParallelLogging) {
    return 'parallel';
  }
  
  return 'disabled';
}

/**
 * Check if a specific logging feature is enabled
 */
export function isLoggingFeatureEnabled(feature: keyof OTelLoggingFeatureFlags): boolean {
  return otelLoggingFlags[feature];
}

/**
 * Get logging features summary for health checks
 */
export function getLoggingFeaturesSummary(): {
  mode: string;
  totalFlags: number;
  enabledFlags: number;
  disabledFlags: number;
  coreLoggingEnabled: boolean;
  parallelLoggingEnabled: boolean;
  debugFeaturesEnabled: boolean;
  securityFeaturesEnabled: boolean;
  migrationFeaturesEnabled: boolean;
} {
  const totalFlags = Object.keys(otelLoggingFlags).length;
  const enabledFlags = Object.values(otelLoggingFlags).filter(Boolean).length;
  const disabledFlags = totalFlags - enabledFlags;
  
  const coreLoggingEnabled = 
    otelLoggingFlags.enableOTELLogging &&
    otelLoggingFlags.enableOTLPExport;
    
  const parallelLoggingEnabled = 
    otelLoggingFlags.enableOTELLogging &&
    otelLoggingFlags.enableParallelLogging &&
    !otelLoggingFlags.enableOTELOnly;
    
  const debugFeaturesEnabled = 
    otelLoggingFlags.enableDebugMode ||
    otelLoggingFlags.enableVerboseAttributes ||
    otelLoggingFlags.enableValidationLogging;
    
  const securityFeaturesEnabled = 
    otelLoggingFlags.enablePIIFiltering &&
    otelLoggingFlags.enableSensitiveDataMasking &&
    otelLoggingFlags.enableAttributeFiltering;
    
  const migrationFeaturesEnabled = 
    otelLoggingFlags.enableSeqCompatibility &&
    otelLoggingFlags.enableGradualMigration &&
    otelLoggingFlags.enableFallbackToSeq;
  
  return {
    mode: getLoggingMode(),
    totalFlags,
    enabledFlags,
    disabledFlags,
    coreLoggingEnabled,
    parallelLoggingEnabled,
    debugFeaturesEnabled,
    securityFeaturesEnabled,
    migrationFeaturesEnabled,
  };
}

// Log the configuration on module load
logLoggingFeatureFlags();