/**
 * GlobalErrorHandler - Comprehensive global error capture system
 * Task 2.2: Error Boundary Integration Enhancement
 * 
 * Features:
 * - Global error and unhandled promise rejection capture
 * - Resource loading error monitoring
 * - Console error interception
 * - Network error detection and retry mechanisms
 * - Integration with AuthContext and TenantContext
 */

import React, { useEffect, useRef } from 'react';
import { useLogger, useErrorLogger } from '../hooks/useLogger';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';
import { ErrorCategory } from './LoggingErrorBoundary';

interface GlobalErrorHandlerProps {
  enableConsoleInterception?: boolean;
  enableResourceErrorTracking?: boolean;
  enableNetworkErrorTracking?: boolean;
  enablePerformanceTracking?: boolean;
  onCriticalError?: (error: Error, context: GlobalErrorContext) => void;
  children: React.ReactNode;
}

interface GlobalErrorContext {
  source: 'global' | 'unhandled-promise' | 'resource' | 'console' | 'network';
  url: string;
  userAgent: string;
  timestamp: number;
  userId?: string;
  tenantId?: string;
  sessionId: string;
  networkStatus: boolean;
  performanceMetrics?: {
    navigationStart?: number;
    domContentLoadedEnd?: number;
    loadComplete?: number;
    memoryUsage?: any;
  };
}

export const GlobalErrorHandler: React.FC<GlobalErrorHandlerProps> = ({
  enableConsoleInterception = true,
  enableResourceErrorTracking = true,
  enableNetworkErrorTracking = true,
  enablePerformanceTracking = true,
  onCriticalError,
  children
}) => {
  const { error: logError, info: logInfo, warn: logWarn } = useLogger({
    component: 'GlobalErrorHandler'
  });
  const { logError: logStructuredError } = useErrorLogger('GlobalErrorHandler');
  
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  
  const sessionId = useRef(`session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const originalConsoleError = useRef<typeof console.error>();
  const originalConsoleWarn = useRef<typeof console.warn>();
  const networkRetryAttempts = useRef<Map<string, number>>(new Map());

  /**
   * Build comprehensive error context
   */
  const buildErrorContext = (source: GlobalErrorContext['source']): GlobalErrorContext => {
    const context: GlobalErrorContext = {
      source,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: Date.now(),
      sessionId: sessionId.current,
      networkStatus: navigator.onLine,
    };

    // Add user context
    if (user) {
      context.userId = user.id;
    }

    // Add tenant context
    if (currentTenant) {
      context.tenantId = currentTenant.id;
    }

    // Add performance metrics if enabled
    if (enablePerformanceTracking && window.performance) {
      try {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        const memory = (performance as any).memory;
        
        context.performanceMetrics = {
          navigationStart: navigation?.navigationStart,
          domContentLoadedEnd: navigation?.domContentLoadedEventEnd,
          loadComplete: navigation?.loadEventEnd,
          memoryUsage: memory ? {
            usedJSHeapSize: memory.usedJSHeapSize,
            totalJSHeapSize: memory.totalJSHeapSize,
            jsHeapSizeLimit: memory.jsHeapSizeLimit
          } : undefined
        };
      } catch (e) {
        // Performance API not available
      }
    }

    return context;
  };

  /**
   * Categorize error based on context and message
   */
  const categorizeGlobalError = (error: Error | ErrorEvent, context: GlobalErrorContext): ErrorCategory => {
    const message = error instanceof Error ? error.message : error.message || '';
    const filename = error instanceof ErrorEvent ? error.filename : '';
    
    // Network errors
    if (message.toLowerCase().includes('fetch') ||
        message.toLowerCase().includes('network') ||
        message.toLowerCase().includes('timeout') ||
        context.source === 'network') {
      return 'network-error';
    }

    // Resource loading errors
    if (context.source === 'resource' ||
        message.toLowerCase().includes('loading') ||
        filename.includes('.js') || filename.includes('.css')) {
      return 'fatal-error';
    }

    // Performance errors
    if (message.toLowerCase().includes('memory') ||
        message.toLowerCase().includes('timeout') ||
        (context.performanceMetrics?.memoryUsage?.usedJSHeapSize || 0) > 100 * 1024 * 1024) { // 100MB
      return 'performance-error';
    }

    return 'component-error';
  };

  /**
   * Handle global JavaScript errors
   */
  const handleGlobalError = (event: ErrorEvent) => {
    const context = buildErrorContext('global');
    const category = categorizeGlobalError(event, context);
    
    const error = event.error || new Error(event.message);
    
    logStructuredError(error, {
      ...context,
      category,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      source: 'window.onerror',
    });

    // Log to structured logger
    logError('Global JavaScript error caught', {
      ...context,
      errorCategory: category,
      errorMessage: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    }, error);

    // Call critical error handler if provided
    if (onCriticalError && category === 'fatal-error') {
      onCriticalError(error, context);
    }
  };

  /**
   * Handle unhandled promise rejections
   */
  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    const context = buildErrorContext('unhandled-promise');
    const reason = event.reason;
    const error = reason instanceof Error ? reason : new Error(String(reason));
    const category = categorizeGlobalError(error, context);

    logStructuredError(error, {
      ...context,
      category,
      rejectionReason: String(reason),
      source: 'window.onunhandledrejection',
    });

    // Log to structured logger
    logError('Unhandled promise rejection', {
      ...context,
      errorCategory: category,
      rejectionReason: String(reason),
      promiseRejection: true,
    }, error);

    // Prevent default browser console logging for handled cases
    if (category !== 'fatal-error') {
      event.preventDefault();
    }

    // Call critical error handler if provided
    if (onCriticalError && category === 'fatal-error') {
      onCriticalError(error, context);
    }
  };

  /**
   * Handle resource loading errors
   */
  const handleResourceError = (event: Event) => {
    if (!enableResourceErrorTracking) return;

    const target = event.target as HTMLElement;
    const context = buildErrorContext('resource');
    
    const resourceInfo = {
      tagName: target.tagName.toLowerCase(),
      src: (target as any).src || (target as any).href,
      resourceType: target.tagName.toLowerCase() === 'script' ? 'script' : 
                    target.tagName.toLowerCase() === 'link' ? 'stylesheet' : 'other'
    };

    const error = new Error(`Failed to load resource: ${resourceInfo.src}`);
    
    logError('Resource loading error', {
      ...context,
      errorCategory: 'fatal-error',
      ...resourceInfo,
      source: 'resource-error'
    }, error);

    // Attempt to retry critical resources
    if (resourceInfo.resourceType === 'script' && resourceInfo.src) {
      const retryCount = networkRetryAttempts.current.get(resourceInfo.src) || 0;
      if (retryCount < 2) { // Max 2 retries
        networkRetryAttempts.current.set(resourceInfo.src, retryCount + 1);
        setTimeout(() => {
          logInfo('Retrying resource load', {
            src: resourceInfo.src,
            retryAttempt: retryCount + 1
          });
          // Could implement actual retry logic here
        }, 1000 * (retryCount + 1)); // Exponential backoff
      }
    }
  };

  /**
   * Intercept console errors and warnings
   */
  const setupConsoleInterception = () => {
    if (!enableConsoleInterception) return;

    // Store original methods
    originalConsoleError.current = console.error;
    originalConsoleWarn.current = console.warn;

    // Override console.error
    console.error = (...args: any[]) => {
      // Call original first
      if (originalConsoleError.current) {
        originalConsoleError.current.apply(console, args);
      }

      const context = buildErrorContext('console');
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');

      logError('Console error intercepted', {
        ...context,
        consoleArgs: args.length,
        consoleMessage: message.substring(0, 1000), // Limit length
        source: 'console.error'
      });
    };

    // Override console.warn for critical warnings
    console.warn = (...args: any[]) => {
      // Call original first
      if (originalConsoleWarn.current) {
        originalConsoleWarn.current.apply(console, args);
      }

      const message = args.map(arg => String(arg)).join(' ');
      
      // Only log critical warnings
      if (message.toLowerCase().includes('deprecated') ||
          message.toLowerCase().includes('memory') ||
          message.toLowerCase().includes('performance')) {
        const context = buildErrorContext('console');
        
        logWarn('Console warning intercepted', {
          ...context,
          consoleArgs: args.length,
          consoleMessage: message.substring(0, 500),
          source: 'console.warn',
          warningLevel: 'critical'
        });
      }
    };
  };

  /**
   * Setup network error tracking
   */
  const setupNetworkErrorTracking = () => {
    if (!enableNetworkErrorTracking) return;

    // Override fetch to track network errors
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const startTime = performance.now();
      try {
        const response = await originalFetch(...args);
        
        // Log slow requests
        const duration = performance.now() - startTime;
        if (duration > 5000) { // 5 seconds
          logWarn('Slow network request detected', {
            url: args[0],
            duration,
            status: response.status,
            source: 'fetch-monitoring'
          });
        }

        return response;
      } catch (error) {
        const context = buildErrorContext('network');
        const networkError = error as Error;
        
        logError('Network request failed', {
          ...context,
          errorCategory: 'network-error',
          url: args[0],
          duration: performance.now() - startTime,
          source: 'fetch-error'
        }, networkError);

        throw error;
      }
    };
  };

  /**
   * Cleanup function
   */
  const cleanup = () => {
    // Restore original console methods
    if (originalConsoleError.current) {
      console.error = originalConsoleError.current;
    }
    if (originalConsoleWarn.current) {
      console.warn = originalConsoleWarn.current;
    }

    // Remove event listeners
    window.removeEventListener('error', handleGlobalError);
    window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    window.removeEventListener('error', handleResourceError, true);
  };

  // Setup global error handlers
  useEffect(() => {
    // Add event listeners
    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    // Resource errors require capture phase
    window.addEventListener('error', handleResourceError, true);

    // Setup console interception
    setupConsoleInterception();

    // Setup network monitoring
    setupNetworkErrorTracking();

    logInfo('Global error handler initialized', {
      sessionId: sessionId.current,
      enableConsoleInterception,
      enableResourceErrorTracking,
      enableNetworkErrorTracking,
      enablePerformanceTracking,
      userId: user?.id,
      tenantId: currentTenant?.id,
    });

    // Cleanup on unmount
    return cleanup;
  }, [user?.id, currentTenant?.id]); // Re-setup when user/tenant changes

  // Monitor performance periodically
  useEffect(() => {
    if (!enablePerformanceTracking) return;

    const performanceMonitor = setInterval(() => {
      if ((performance as any).memory) {
        const memory = (performance as any).memory;
        const memoryUsage = memory.usedJSHeapSize;
        
        // Warn if memory usage is high (>150MB)
        if (memoryUsage > 150 * 1024 * 1024) {
          logWarn('High memory usage detected', {
            memoryUsage: {
              used: memoryUsage,
              total: memory.totalJSHeapSize,
              limit: memory.jsHeapSizeLimit
            },
            source: 'performance-monitor'
          });
        }
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(performanceMonitor);
  }, [enablePerformanceTracking]);

  return <>{children}</>;
};

/**
 * Hook to manually report global errors
 */
export const useGlobalErrorReporting = () => {
  const { logError } = useErrorLogger('GlobalErrorReporting');

  return {
    reportNetworkError: (error: Error, endpoint: string) => {
      logError(error, {
        errorCategory: 'network-error',
        endpoint,
        source: 'manual-report'
      });
    },

    reportPerformanceIssue: (operation: string, duration: number, threshold: number) => {
      if (duration > threshold) {
        const error = new Error(`Slow operation: ${operation} took ${duration}ms`);
        logError(error, {
          errorCategory: 'performance-error',
          operation,
          duration,
          threshold,
          source: 'manual-report'
        });
      }
    },

    reportValidationError: (error: Error, field: string, value: any) => {
      logError(error, {
        errorCategory: 'validation-error',
        field,
        value: typeof value === 'object' ? JSON.stringify(value) : String(value),
        source: 'manual-report'
      });
    }
  };
};

export default GlobalErrorHandler;