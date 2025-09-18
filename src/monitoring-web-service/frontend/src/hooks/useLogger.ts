/**
 * useLogger - React hooks for frontend logging integration
 * Task 2.1: Frontend Logger Client Implementation
 * 
 * Features:
 * - Performance-optimized logging (no re-renders)
 * - Component-specific context tracking
 * - TypeScript integration
 * - Automatic correlation ID management
 * - Error boundary integration support
 */

import { useCallback, useContext, useEffect, useRef } from 'react';
import { FrontendLogger } from '../services/logger';
import { 
  LogLevel, 
  ComponentLogContext, 
  LoggerMetrics,
  LogContext 
} from '../types/logging.types';

// Logger context for configuration and instance sharing
import { LoggerContext } from '../contexts/LoggerContext';

interface UseLoggerReturn {
  debug: (message: string, properties?: Record<string, any>) => void;
  info: (message: string, properties?: Record<string, any>) => void;
  warn: (message: string, properties?: Record<string, any>, error?: Error) => void;
  error: (message: string, properties?: Record<string, any>, error?: Error) => void;
  setContext: (context: Partial<LogContext>) => void;
  getMetrics: () => LoggerMetrics;
  flush: () => Promise<void>;
}

interface UseLoggerOptions {
  component?: string;
  trackRenderCount?: boolean;
  trackPerformance?: boolean;
  autoFlushOnUnmount?: boolean;
}

/**
 * Main logger hook for React components
 */
export function useLogger(options: UseLoggerOptions = {}): UseLoggerReturn {
  const loggerContext = useContext(LoggerContext);
  const logger = loggerContext?.logger || new FrontendLogger();
  
  const renderCount = useRef(0);
  const mountTime = useRef(Date.now());
  const lastRenderTime = useRef(Date.now());
  
  const {
    component = 'Unknown',
    trackRenderCount = false,
    trackPerformance = false,
    autoFlushOnUnmount = true,
  } = options;

  // Track render count and performance if enabled
  useEffect(() => {
    if (trackRenderCount) {
      renderCount.current += 1;
      lastRenderTime.current = Date.now();
    }
  });

  // Auto-flush on component unmount
  useEffect(() => {
    return () => {
      if (autoFlushOnUnmount && logger) {
        logger.flush().catch(error => {
          console.warn('[useLogger] Failed to flush on unmount:', error);
        });
      }
    };
  }, [autoFlushOnUnmount, logger]);

  // Create component-specific context
  const createComponentContext = useCallback(
    (additionalProperties: Record<string, any> = {}): Record<string, any> => {
      const baseContext: ComponentLogContext = {
        componentName: component,
        renderCount: trackRenderCount ? renderCount.current : undefined,
        mountTime: mountTime.current,
        lastRenderTime: trackRenderCount ? lastRenderTime.current : undefined,
      };

      return {
        ...baseContext,
        ...additionalProperties,
      };
    },
    [component, trackRenderCount]
  );

  // Memoized logging functions to prevent re-renders
  const debug = useCallback(
    (message: string, properties: Record<string, any> = {}) => {
      logger.debug(message, createComponentContext(properties));
    },
    [logger, createComponentContext]
  );

  const info = useCallback(
    (message: string, properties: Record<string, any> = {}) => {
      logger.info(message, createComponentContext(properties));
    },
    [logger, createComponentContext]
  );

  const warn = useCallback(
    (message: string, properties: Record<string, any> = {}, error?: Error) => {
      logger.warn(message, createComponentContext(properties), error);
    },
    [logger, createComponentContext]
  );

  const error = useCallback(
    (message: string, properties: Record<string, any> = {}, error?: Error) => {
      logger.error(message, createComponentContext(properties), error);
    },
    [logger, createComponentContext]
  );

  const setContext = useCallback(
    (context: Partial<LogContext>) => {
      logger.setContext(context);
    },
    [logger]
  );

  const getMetrics = useCallback(() => {
    return logger.getMetrics();
  }, [logger]);

  const flush = useCallback(() => {
    return logger.flush();
  }, [logger]);

  return {
    debug,
    info,
    warn,
    error,
    setContext,
    getMetrics,
    flush,
  };
}

/**
 * Hook for performance logging
 */
export function usePerformanceLogger(
  component: string
): {
  logRender: (renderType: 'mount' | 'update' | 'unmount') => void;
  logOperation: (operation: string, duration: number, metadata?: Record<string, any>) => void;
  startTiming: (operation: string) => () => void;
} {
  const { info } = useLogger({ component, trackPerformance: true });

  const logRender = useCallback(
    (renderType: 'mount' | 'update' | 'unmount') => {
      info(`Component ${renderType}`, {
        renderType,
        performanceCategory: 'render',
      });
    },
    [info]
  );

  const logOperation = useCallback(
    (operation: string, duration: number, metadata: Record<string, any> = {}) => {
      info(`Operation completed: ${operation}`, {
        operation,
        duration,
        performanceCategory: 'operation',
        ...metadata,
      });
    },
    [info]
  );

  const startTiming = useCallback(
    (operation: string) => {
      const startTime = performance.now();
      return () => {
        const duration = performance.now() - startTime;
        logOperation(operation, duration);
      };
    },
    [logOperation]
  );

  return {
    logRender,
    logOperation,
    startTiming,
  };
}

/**
 * Hook for error logging with enhanced context
 */
export function useErrorLogger(
  component: string
): {
  logError: (error: Error, context?: Record<string, any>) => void;
  logErrorBoundary: (error: Error, errorInfo: any) => void;
  logUnhandledError: (event: ErrorEvent) => void;
  logUnhandledRejection: (event: PromiseRejectionEvent) => void;
} {
  const { error } = useLogger({ component });

  const logError = useCallback(
    (err: Error, context: Record<string, any> = {}) => {
      error(`Error in ${component}`, {
        errorType: err.constructor.name,
        errorMessage: err.message,
        errorStack: err.stack,
        ...context,
      }, err);
    },
    [error, component]
  );

  const logErrorBoundary = useCallback(
    (err: Error, errorInfo: any) => {
      error(`Error boundary caught error in ${component}`, {
        errorType: err.constructor.name,
        errorMessage: err.message,
        errorStack: err.stack,
        componentStack: errorInfo.componentStack,
        errorBoundary: component,
        boundaryType: 'react-error-boundary',
      }, err);
    },
    [error, component]
  );

  const logUnhandledError = useCallback(
    (event: ErrorEvent) => {
      const err = event.error || new Error(event.message);
      error('Unhandled error', {
        errorType: 'UnhandledError',
        errorMessage: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        errorStack: err.stack,
      }, err);
    },
    [error]
  );

  const logUnhandledRejection = useCallback(
    (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const err = reason instanceof Error ? reason : new Error(String(reason));
      
      error('Unhandled promise rejection', {
        errorType: 'UnhandledPromiseRejection',
        errorMessage: err.message,
        reason: String(reason),
        errorStack: err.stack,
      }, err);
    },
    [error]
  );

  return {
    logError,
    logErrorBoundary,
    logUnhandledError,
    logUnhandledRejection,
  };
}

/**
 * Hook for user interaction logging
 */
export function useInteractionLogger(
  component: string
): {
  logClick: (element: string, metadata?: Record<string, any>) => void;
  logNavigation: (from: string, to: string) => void;
  logFormSubmission: (formId: string, success: boolean, errors?: string[]) => void;
  logApiCall: (endpoint: string, method: string, status: number, duration: number) => void;
} {
  const { info, warn } = useLogger({ component });

  const logClick = useCallback(
    (element: string, metadata: Record<string, any> = {}) => {
      info(`User clicked: ${element}`, {
        interactionType: 'click',
        element,
        ...metadata,
      });
    },
    [info]
  );

  const logNavigation = useCallback(
    (from: string, to: string) => {
      info('Navigation', {
        interactionType: 'navigation',
        from,
        to,
      });
    },
    [info]
  );

  const logFormSubmission = useCallback(
    (formId: string, success: boolean, errors?: string[]) => {
      const logFn = success ? info : warn;
      logFn(`Form submission: ${formId}`, {
        interactionType: 'form-submit',
        formId,
        success,
        errors,
        errorCount: errors?.length || 0,
      });
    },
    [info, warn]
  );

  const logApiCall = useCallback(
    (endpoint: string, method: string, status: number, duration: number) => {
      const logFn = status >= 400 ? warn : info;
      logFn(`API call: ${method} ${endpoint}`, {
        interactionType: 'api-call',
        endpoint,
        method,
        status,
        duration,
        success: status < 400,
      });
    },
    [info, warn]
  );

  return {
    logClick,
    logNavigation,
    logFormSubmission,
    logApiCall,
  };
}

/**
 * Hook to setup global error handlers
 */
export function useGlobalErrorLogger(): void {
  const { logUnhandledError, logUnhandledRejection } = useErrorLogger('GlobalErrorHandler');

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      logUnhandledError(event);
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      logUnhandledRejection(event);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, [logUnhandledError, logUnhandledRejection]);
}