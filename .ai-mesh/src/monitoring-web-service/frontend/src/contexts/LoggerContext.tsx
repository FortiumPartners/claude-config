/**
 * LoggerContext - React Context for logger configuration and instance sharing
 * Task 2.1: Frontend Logger Client Implementation
 * 
 * Features:
 * - Centralized logger configuration
 * - Context-aware logging
 * - Performance optimization through instance sharing
 * - Integration with existing auth and tenant contexts
 */

import React, { createContext, useContext, useEffect, useMemo, ReactNode } from 'react';
import { FrontendLogger } from '../services/logger';
import { LoggerConfig, LoggerPreset, LoggerPresets } from '../types/logging.types';
import { useAuth } from '../hooks/useAuth';
import { useTenant } from '../hooks/useTenant';

interface LoggerContextValue {
  logger: FrontendLogger;
  config: LoggerConfig;
  isInitialized: boolean;
  errorHandlingEnabled: boolean;
  recoveryEnabled: boolean;
  performanceMonitoringEnabled: boolean;
}

interface LoggerProviderProps {
  children: ReactNode;
  preset?: LoggerPreset;
  customConfig?: Partial<LoggerConfig>;
  enableGlobalErrorHandling?: boolean;
  enableErrorRecovery?: boolean;
  enablePerformanceMonitoring?: boolean;
}

// Create the context
export const LoggerContext = createContext<LoggerContextValue | null>(null);

/**
 * Logger Provider Component
 */
export function LoggerProvider({
  children,
  preset = 'production',
  customConfig = {},
  enableGlobalErrorHandling = true,
  enableErrorRecovery = true,
  enablePerformanceMonitoring = false,
}: LoggerProviderProps): JSX.Element {
  const auth = useAuth();
  const tenant = useTenant();

  // Create logger configuration based on preset and custom config
  const config = useMemo((): LoggerConfig => {
    const baseConfig = {
      endpoint: '/api/v1/logs',
      bufferSize: 100,
      flushInterval: 30000, // 30 seconds
      maxRetries: 3,
      retryDelay: 1000,
      offlineStorage: true,
      enableDebugLogs: import.meta.env.DEV,
      batchSize: 50,
      requestTimeout: 10000,
      rateLimitPerMinute: 500,
      maxStorageSize: 1024 * 1024, // 1MB
    };

    const presetConfig = LoggerPresets[preset];
    return { ...baseConfig, ...presetConfig, ...customConfig };
  }, [preset, customConfig]);

  // Create logger instance (memoized to prevent recreation)
  const logger = useMemo(() => {
    const instance = new FrontendLogger(config);
    
    // Set up global error handling if enabled
    if (enableGlobalErrorHandling) {
      setupGlobalErrorHandlers(instance);
    }

    return instance;
  }, [config, enableGlobalErrorHandling]);

  // Update logger context when auth or tenant changes
  useEffect(() => {
    if (auth.user && tenant.currentTenant) {
      logger.setContext({
        userId: auth.user.id,
        tenantId: tenant.currentTenant.id,
      });
    }
  }, [logger, auth.user, tenant.currentTenant]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      logger.dispose();
    };
  }, [logger]);

  const value = useMemo(
    (): LoggerContextValue => ({
      logger,
      config,
      isInitialized: true,
      errorHandlingEnabled: enableGlobalErrorHandling,
      recoveryEnabled: enableErrorRecovery,
      performanceMonitoringEnabled: enablePerformanceMonitoring,
    }),
    [logger, config, enableGlobalErrorHandling, enableErrorRecovery, enablePerformanceMonitoring]
  );

  return (
    <LoggerContext.Provider value={value}>
      {children}
    </LoggerContext.Provider>
  );
}

/**
 * Hook to use the logger context
 */
export function useLoggerContext(): LoggerContextValue {
  const context = useContext(LoggerContext);
  
  if (!context) {
    throw new Error('useLoggerContext must be used within a LoggerProvider');
  }
  
  return context;
}

/**
 * Hook to check if logger is available
 */
export function useLoggerAvailability(): {
  isLoggerAvailable: boolean;
  isLoggerInitialized: boolean;
  loggerMetrics: ReturnType<FrontendLogger['getMetrics']> | null;
} {
  const context = useContext(LoggerContext);
  
  return {
    isLoggerAvailable: !!context,
    isLoggerInitialized: context?.isInitialized ?? false,
    loggerMetrics: context?.logger.getMetrics() ?? null,
  };
}

/**
 * Setup global error handlers
 */
function setupGlobalErrorHandlers(logger: FrontendLogger): void {
  // Global error handler
  const handleGlobalError = (event: ErrorEvent) => {
    logger.error('Global error caught', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      source: 'global-error-handler',
    }, event.error);
  };

  // Unhandled promise rejection handler
  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const error = reason instanceof Error ? reason : new Error(String(reason));
    
    logger.error('Unhandled promise rejection', {
      reason: String(reason),
      source: 'unhandled-rejection-handler',
    }, error);
  };

  // Console error interceptor (optional - captures console.error calls)
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    // Call original console.error
    originalConsoleError.apply(console, args);
    
    // Log to our system
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
    
    logger.warn('Console error intercepted', {
      message,
      args: args.length,
      source: 'console-error-interceptor',
    });
  };

  // Add event listeners
  window.addEventListener('error', handleGlobalError);
  window.addEventListener('unhandledrejection', handleUnhandledRejection);

  // Store cleanup function on the logger instance for later cleanup
  (logger as any)._globalErrorCleanup = () => {
    window.removeEventListener('error', handleGlobalError);
    window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    console.error = originalConsoleError;
  };
}

/**
 * Higher-order component to wrap components with logging context
 */
export function withLogger<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  loggerProps?: Omit<LoggerProviderProps, 'children'>
) {
  return function LoggerWrappedComponent(props: P) {
    return (
      <LoggerProvider {...loggerProps}>
        <WrappedComponent {...props} />
      </LoggerProvider>
    );
  };
}

/**
 * Development-only logger provider with debug settings
 */
export function DevLoggerProvider({ children }: { children: ReactNode }): JSX.Element {
  return (
    <LoggerProvider
      preset="development"
      customConfig={{
        enableDebugLogs: true,
        flushInterval: 5000, // 5 seconds for faster feedback
        bufferSize: 20,      // Smaller buffer for development
      }}
      enableGlobalErrorHandling={true}
    >
      {children}
    </LoggerProvider>
  );
}

/**
 * Testing-only logger provider with test-optimized settings
 */
export function TestLoggerProvider({ 
  children, 
  mockLogger 
}: { 
  children: ReactNode;
  mockLogger?: FrontendLogger;
}): JSX.Element {
  if (mockLogger) {
    const value: LoggerContextValue = {
      logger: mockLogger,
      config: {} as LoggerConfig, // Mock config
      isInitialized: true,
    };

    return (
      <LoggerContext.Provider value={value}>
        {children}
      </LoggerContext.Provider>
    );
  }

  return (
    <LoggerProvider
      preset="testing"
      customConfig={{
        enableDebugLogs: true,
        offlineStorage: false, // Disable for tests
        flushInterval: 1000,   // Fast flush for tests
      }}
      enableGlobalErrorHandling={false} // Disable for tests
    >
      {children}
    </LoggerProvider>
  );
}