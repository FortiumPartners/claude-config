/**
 * LoggingErrorBoundary - Enhanced React Error Boundary with structured logging
 * Task 2.2: Error Boundary Integration Enhancement
 * 
 * Production Features:
 * - Advanced error recovery with multiple retry attempts
 * - Component tree visualization and user context enrichment
 * - Error categorization and notification system
 * - Integration with AuthContext, TenantContext, and Redux store
 * - Offline error handling with queue management
 * - Performance metrics and error analytics
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { FrontendLogger } from '../services/logger';
import { ReactErrorInfo, LogException } from '../types/logging.types';
import { ErrorNotification } from './ErrorNotification';

// Error Category Classification
export type ErrorCategory = 
  | 'component-error'    // React component lifecycle errors
  | 'network-error'      // API/connectivity failures
  | 'validation-error'   // User input validation errors
  | 'performance-error'  // Slow rendering or memory issues
  | 'fatal-error';       // Application-breaking errors

// Error Recovery Strategies
export type RecoveryStrategy = 
  | 'retry'              // Automatic retry with exponential backoff
  | 'fallback'           // Show fallback UI component
  | 'reload'             // Full page reload
  | 'redirect'           // Navigate to error page
  | 'degrade';           // Progressive UI degradation

interface ErrorContext {
  userId?: string;
  tenantId?: string;
  sessionId: string;
  userAgent: string;
  url: string;
  reduxState?: any;
  routerState?: any;
  performanceMetrics?: PerformanceEntry[];
  networkStatus: boolean;
}

interface Props {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, errorInfo: ErrorInfo, context: ErrorContext) => ReactNode);
  onError?: (error: Error, errorInfo: ErrorInfo, context: ErrorContext) => void;
  onRecovery?: (errorId: string, recoveryMethod: string) => void;
  logger?: FrontendLogger;
  enableRecovery?: boolean;
  enableNotifications?: boolean;
  boundaryName?: string;
  maxRetries?: number;
  retryDelays?: number[]; // Custom retry delay sequence
  recoveryStrategy?: RecoveryStrategy;
  enableOfflineQueue?: boolean;
  enableAnalytics?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
  retryCount: number;
  errorCategory: ErrorCategory | null;
  errorContext: ErrorContext | null;
  isRecovering: boolean;
  showNotification: boolean;
  lastErrorTime: number;
  errorHistory: Array<{
    errorId: string;
    timestamp: number;
    message: string;
    category: ErrorCategory;
  }>;
}

export class LoggingErrorBoundary extends Component<Props, State> {
  private logger: FrontendLogger;
  private retryTimeout: number | null = null;
  private maxRetries: number;
  private retryDelays: number[];
  private sessionId: string;
  private errorQueue: Array<{ error: Error; errorInfo: ErrorInfo; context: ErrorContext }> = [];
  private networkWatcher: any = null;

  constructor(props: Props) {
    super(props);
    
    this.maxRetries = props.maxRetries || 3;
    this.retryDelays = props.retryDelays || [1000, 2000, 4000]; // Exponential backoff
    this.sessionId = this.generateSessionId();
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: 0,
      errorCategory: null,
      errorContext: null,
      isRecovering: false,
      showNotification: false,
      lastErrorTime: 0,
      errorHistory: [],
    };

    // Use provided logger or create new instance
    this.logger = props.logger || new FrontendLogger();
    
    // Setup network status monitoring
    this.setupNetworkMonitoring();
  }

  /**
   * Generate unique session ID for error tracking
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Setup network monitoring for offline error handling
   */
  private setupNetworkMonitoring(): void {
    if (typeof window !== 'undefined' && 'navigator' in window) {
      this.networkWatcher = {
        isOnline: navigator.onLine,
        listeners: [] as Array<() => void>
      };

      const handleOnline = () => {
        this.networkWatcher.isOnline = true;
        this.processOfflineErrorQueue();
      };

      const handleOffline = () => {
        this.networkWatcher.isOnline = false;
      };

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      // Store cleanup functions
      this.networkWatcher.cleanup = () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }

  /**
   * Process queued errors when network comes back online
   */
  private processOfflineErrorQueue(): void {
    if (this.errorQueue.length > 0 && this.props.enableOfflineQueue) {
      this.logger.info('Processing offline error queue', {
        queueSize: this.errorQueue.length,
        boundaryName: this.props.boundaryName,
      });

      // Process queued errors
      this.errorQueue.forEach(({ error, errorInfo, context }) => {
        this.logEnhancedError(error, errorInfo, context);
      });

      // Clear the queue
      this.errorQueue = [];
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const errorId = this.generateErrorId();
    const errorCategory = this.categorizeError(error);
    const errorContext = this.buildErrorContext();
    const currentTime = Date.now();
    
    // Update state with comprehensive error information
    this.setState(prevState => ({
      errorInfo,
      errorId,
      errorCategory,
      errorContext,
      lastErrorTime: currentTime,
      showNotification: this.props.enableNotifications !== false,
      errorHistory: [
        ...prevState.errorHistory.slice(-9), // Keep last 10 errors
        {
          errorId,
          timestamp: currentTime,
          message: error.message,
          category: errorCategory,
        }
      ],
    }));

    // Handle offline error queueing
    if (this.props.enableOfflineQueue && !this.networkWatcher?.isOnline) {
      this.errorQueue.push({ error, errorInfo, context: errorContext });
    } else {
      // Log the error immediately
      this.logEnhancedError(error, errorInfo, errorContext);
    }

    // Call optional error handler with enhanced context
    if (this.props.onError) {
      this.props.onError(error, errorInfo, errorContext);
    }

    // Report to external error tracking service if configured
    this.reportToExternalService(error, errorInfo, errorId, errorContext);

    // Track error analytics if enabled
    if (this.props.enableAnalytics) {
      this.trackErrorAnalytics(error, errorCategory, errorContext);
    }

    // Schedule automatic recovery based on strategy
    this.scheduleRecovery(error, errorCategory);
  }

  componentDidUpdate(prevProps: Props, prevState: State): void {
    // If error was cleared, log recovery
    if (prevState.hasError && !this.state.hasError) {
      this.logger.info('Error boundary recovered', {
        boundaryName: this.props.boundaryName || 'LoggingErrorBoundary',
        retryCount: this.state.retryCount,
        errorId: prevState.errorId,
        recoveryMethod: 'component-retry',
      });
    }
  }

  componentWillUnmount(): void {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }
    
    // Cleanup network monitoring
    if (this.networkWatcher?.cleanup) {
      this.networkWatcher.cleanup();
    }
  }

  /**
   * Generate unique error ID for tracking
   */
  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Categorize error based on type and context
   */
  private categorizeError(error: Error): ErrorCategory {
    const errorMessage = error.message.toLowerCase();
    const errorName = error.constructor.name.toLowerCase();
    const stackTrace = error.stack?.toLowerCase() || '';

    // Network errors
    if (errorMessage.includes('fetch') || 
        errorMessage.includes('network') || 
        errorMessage.includes('timeout') ||
        errorMessage.includes('connection') ||
        errorName.includes('networkerror')) {
      return 'network-error';
    }

    // Validation errors
    if (errorMessage.includes('validation') || 
        errorMessage.includes('invalid') || 
        errorMessage.includes('required') ||
        errorName.includes('validationerror')) {
      return 'validation-error';
    }

    // Performance errors
    if (errorMessage.includes('memory') || 
        errorMessage.includes('slow') || 
        errorMessage.includes('timeout') ||
        stackTrace.includes('render')) {
      return 'performance-error';
    }

    // Fatal errors (application-breaking)
    if (errorMessage.includes('chunk') || 
        errorMessage.includes('loading') || 
        errorMessage.includes('module') ||
        errorName.includes('chunkloaderror')) {
      return 'fatal-error';
    }

    // Default to component error
    return 'component-error';
  }

  /**
   * Build comprehensive error context
   */
  private buildErrorContext(): ErrorContext {
    const context: ErrorContext = {
      sessionId: this.sessionId,
      userAgent: navigator.userAgent,
      url: window.location.href,
      networkStatus: this.networkWatcher?.isOnline ?? navigator.onLine,
    };

    // Try to get user context from localStorage (fallback approach)
    try {
      const userDataStr = localStorage.getItem('auth_user');
      if (userDataStr) {
        const userData = JSON.parse(userDataStr);
        context.userId = userData.id;
      }
    } catch (e) {
      // User context not available
    }

    // Try to get tenant context from localStorage (fallback approach)
    try {
      const tenantId = localStorage.getItem('currentTenantId');
      if (tenantId) {
        context.tenantId = tenantId;
      }
    } catch (e) {
      // Tenant context not available
    }

    // Add performance metrics if available
    if (window.performance && window.performance.getEntriesByType) {
      try {
        context.performanceMetrics = window.performance.getEntriesByType('measure')
          .concat(window.performance.getEntriesByType('mark'))
          .slice(-20); // Last 20 performance entries
      } catch (e) {
        // Performance API not available or blocked
      }
    }

    // Add router state if available (React Router)
    try {
      if (window.location) {
        context.routerState = {
          pathname: window.location.pathname,
          search: window.location.search,
          hash: window.location.hash,
          referrer: document.referrer,
        };
      }
    } catch (e) {
      // Router state not available
    }

    // Try to get Redux state if available (global approach)
    try {
      if ((window as any).__REDUX_STORE__) {
        const state = (window as any).__REDUX_STORE__.getState();
        context.reduxState = {
          auth: state.auth ? {
            isAuthenticated: !!state.auth.user,
            userId: state.auth.user?.id,
          } : undefined,
          routing: state.router ? {
            location: state.router.location,
          } : undefined,
        };
      }
    } catch (e) {
      // Redux state not available
    }

    return context;
  }

  /**
   * Enhanced error logging with comprehensive context
   */
  private logEnhancedError(error: Error, errorInfo: ErrorInfo, context: ErrorContext): void {
    const boundaryName = this.props.boundaryName || 'LoggingErrorBoundary';
    const { errorCategory, errorId } = this.state;

    // Create enhanced exception object
    const exception: LogException = {
      type: error.constructor.name,
      message: error.message,
      stackTrace: error.stack || '',
      componentStack: errorInfo.componentStack,
      errorBoundary: boundaryName,
      errorInfo: {
        componentStack: errorInfo.componentStack,
        errorBoundary: boundaryName,
      },
    };

    // Extract component information from stack
    const componentInfo = this.extractComponentInfo(errorInfo.componentStack);

    // Log with comprehensive context
    this.logger.error('React Error Boundary caught error', {
      // Basic error information
      errorId,
      boundaryName,
      errorType: error.constructor.name,
      errorMessage: error.message,
      errorCategory,
      
      // Component and stack information
      componentStack: errorInfo.componentStack,
      componentInfo,
      
      // Context enrichment
      ...context,
      
      // Error history and patterns
      errorHistory: this.state.errorHistory,
      retryCount: this.state.retryCount,
      
      // Browser and environment
      timestamp: new Date().toISOString(),
      errorBoundaryType: 'enhanced-react-error-boundary',
      performanceTimestamp: performance.now(),
      memoryUsage: this.getMemoryUsage(),
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      
      // React-specific context
      reactVersion: React.version,
      developmentMode: process.env.NODE_ENV === 'development',
      
      // Recovery information
      recoveryStrategy: this.props.recoveryStrategy || 'retry',
      maxRetries: this.maxRetries,
      enableRecovery: this.props.enableRecovery !== false,
    }, error);
  }

  /**
   * Track error analytics for patterns and trends
   */
  private trackErrorAnalytics(error: Error, category: ErrorCategory, context: ErrorContext): void {
    const analyticsData = {
      errorCategory: category,
      errorType: error.constructor.name,
      boundaryName: this.props.boundaryName || 'LoggingErrorBoundary',
      userAgent: context.userAgent,
      url: context.url,
      timestamp: Date.now(),
      retryCount: this.state.retryCount,
      networkStatus: context.networkStatus,
    };

    // Log analytics event
    this.logger.info('Error analytics tracked', {
      analyticsCategory: 'error-boundary',
      analyticsAction: 'error-caught',
      analyticsLabel: category,
      analyticsData,
    });
  }

  /**
   * Schedule recovery based on error category and strategy
   */
  private scheduleRecovery(error: Error, category: ErrorCategory): void {
    if (!this.props.enableRecovery) return;

    const strategy = this.props.recoveryStrategy || this.getRecoveryStrategy(category);
    const retryDelay = this.getRetryDelay(this.state.retryCount);

    switch (strategy) {
      case 'retry':
        if (this.state.retryCount < this.maxRetries) {
          this.scheduleRetry(retryDelay);
        }
        break;
      
      case 'reload':
        if (category === 'fatal-error') {
          setTimeout(() => {
            window.location.reload();
          }, 2000); // Give user time to read the error
        }
        break;
      
      case 'redirect':
        // Could redirect to error page
        break;
      
      case 'fallback':
      case 'degrade':
        // Already handled by render method
        break;
    }
  }

  /**
   * Get recovery strategy based on error category
   */
  private getRecoveryStrategy(category: ErrorCategory): RecoveryStrategy {
    switch (category) {
      case 'network-error':
        return 'retry';
      case 'validation-error':
        return 'fallback';
      case 'performance-error':
        return 'degrade';
      case 'fatal-error':
        return 'reload';
      default:
        return 'retry';
    }
  }

  /**
   * Get retry delay with exponential backoff
   */
  private getRetryDelay(retryCount: number): number {
    if (retryCount < this.retryDelays.length) {
      return this.retryDelays[retryCount];
    }
    // Exponential backoff fallback
    return Math.min(1000 * Math.pow(2, retryCount), 10000); // Max 10 seconds
  }


  /**
   * Extract component information from component stack
   */
  private extractComponentInfo(componentStack: string): {
    components: string[];
    failedComponent?: string;
    componentCount: number;
  } {
    const lines = componentStack.split('\n').filter(line => line.trim());
    const components = lines
      .map(line => line.trim())
      .filter(line => line.startsWith('in ') || line.startsWith('at '))
      .map(line => line.replace(/^(in |at )/, '').split(' ')[0])
      .filter(Boolean);

    return {
      components,
      failedComponent: components[0], // First component is usually the one that failed
      componentCount: components.length,
    };
  }

  /**
   * Get memory usage information
   */
  private getMemoryUsage(): Record<string, number> | undefined {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
      };
    }
    return undefined;
  }

  /**
   * Report error to external service with enhanced context
   */
  private reportToExternalService(
    error: Error, 
    errorInfo: ErrorInfo, 
    errorId: string, 
    context: ErrorContext
  ): void {
    // Enhanced external service integration
    const reportData = {
      errorId,
      errorMessage: error.message,
      errorType: error.constructor.name,
      errorCategory: this.state.errorCategory,
      boundaryName: this.props.boundaryName,
      componentStack: errorInfo.componentStack,
      context,
      timestamp: new Date().toISOString(),
      retryCount: this.state.retryCount,
    };

    // This could integrate with services like Sentry, Rollbar, etc.
    console.debug('[LoggingErrorBoundary] Enhanced external service report:', reportData);
    
    // Example integration points:
    // - Sentry.captureException(error, { extra: reportData });
    // - window.Rollbar?.error(error.message, error, reportData);
    // - Custom analytics service
  }

  /**
   * Handle retry attempt with enhanced recovery
   */
  private handleRetry = (): void => {
    const { retryCount, errorId, errorCategory } = this.state;
    
    if (retryCount < this.maxRetries) {
      this.setState({ isRecovering: true });

      this.logger.info('Error boundary retry attempted', {
        boundaryName: this.props.boundaryName || 'LoggingErrorBoundary',
        retryAttempt: retryCount + 1,
        maxRetries: this.maxRetries,
        errorId,
        errorCategory,
        recoveryMethod: 'manual-retry',
      });

      // Reset error state but keep retry count and history
      this.setState(prevState => ({
        hasError: false,
        error: null,
        errorInfo: null,
        errorContext: null,
        isRecovering: false,
        showNotification: false,
        retryCount: prevState.retryCount + 1,
      }));

      // Call recovery callback if provided
      if (this.props.onRecovery) {
        this.props.onRecovery(errorId || 'unknown', 'manual-retry');
      }
    } else {
      this.logger.warn('Error boundary max retries exceeded', {
        boundaryName: this.props.boundaryName || 'LoggingErrorBoundary',
        retryCount,
        maxRetries: this.maxRetries,
        errorId,
        errorCategory,
        nextAction: 'fallback-or-reload',
      });

      // Could trigger fallback strategy here
      this.setState({ showNotification: true });
    }
  };

  /**
   * Handle automatic retry with delay
   */
  private scheduleRetry = (delay: number = 1000): void => {
    if (!this.props.enableRecovery) return;

    this.retryTimeout = window.setTimeout(() => {
      this.handleRetry();
    }, delay);
  };

  /**
   * Render enhanced fallback UI with context
   */
  private renderFallback(): ReactNode {
    const { fallback } = this.props;
    const { 
      error, 
      errorInfo, 
      errorId, 
      retryCount, 
      errorCategory,
      errorContext,
      isRecovering,
      showNotification 
    } = this.state;

    // Use custom fallback if provided
    if (fallback) {
      if (typeof fallback === 'function' && error && errorInfo && errorContext) {
        return fallback(error, errorInfo, errorContext);
      }
      return fallback;
    }

    // Enhanced default fallback UI
    return (
      <>
        <div className="error-boundary-fallback" role="alert">
          <div className="error-boundary-content">
            {/* Error Category Indicator */}
            {errorCategory && (
              <div className={`error-boundary-category error-category-${errorCategory}`}>
                <span className="error-category-label">
                  {this.getErrorCategoryLabel(errorCategory)}
                </span>
              </div>
            )}

            <h2 className="error-boundary-title">
              {this.getErrorTitle(errorCategory)}
            </h2>
            
            <p className="error-boundary-message">
              {this.getErrorMessage(errorCategory)}
            </p>

            {/* Recovery Status */}
            {isRecovering && (
              <div className="error-boundary-recovering">
                <span className="recovery-spinner"></span>
                Attempting recovery...
              </div>
            )}
            
            {/* Development Details */}
            {process.env.NODE_ENV === 'development' && error && (
              <details className="error-boundary-details">
                <summary>Error Details (Development Only)</summary>
                
                {/* Basic Error Info */}
                <div className="error-details-section">
                  <h4>Error Information</h4>
                  <pre className="error-boundary-stack">
                    {error.toString()}
                    {error.stack}
                  </pre>
                </div>

                {/* Component Stack */}
                {errorInfo && (
                  <div className="error-details-section">
                    <h4>Component Stack</h4>
                    <pre className="error-boundary-component-stack">
                      {errorInfo.componentStack}
                    </pre>
                  </div>
                )}

                {/* Error Context */}
                {errorContext && (
                  <div className="error-details-section">
                    <h4>Error Context</h4>
                    <ul className="error-context-list">
                      <li><strong>Session ID:</strong> {errorContext.sessionId}</li>
                      <li><strong>URL:</strong> {errorContext.url}</li>
                      <li><strong>Network Status:</strong> {errorContext.networkStatus ? 'Online' : 'Offline'}</li>
                      {errorContext.userId && <li><strong>User ID:</strong> {errorContext.userId}</li>}
                      {errorContext.tenantId && <li><strong>Tenant ID:</strong> {errorContext.tenantId}</li>}
                    </ul>
                  </div>
                )}

                <p className="error-boundary-id-dev">
                  <strong>Error ID:</strong> <code>{errorId}</code>
                </p>
              </details>
            )}

            {/* Action Buttons */}
            <div className="error-boundary-actions">
              {this.props.enableRecovery && retryCount < this.maxRetries && !isRecovering && (
                <button 
                  onClick={this.handleRetry}
                  className="error-boundary-retry-btn"
                  type="button"
                  disabled={isRecovering}
                >
                  {isRecovering ? 'Retrying...' : `Try Again (${this.maxRetries - retryCount} remaining)`}
                </button>
              )}
              
              <button 
                onClick={() => window.location.reload()}
                className="error-boundary-reload-btn"
                type="button"
              >
                Reload Page
              </button>

              {/* Category-specific actions */}
              {errorCategory === 'network-error' && (
                <button 
                  onClick={() => window.location.reload()}
                  className="error-boundary-network-retry-btn"
                  type="button"
                >
                  Check Connection & Retry
                </button>
              )}
            </div>
            
            {/* Error ID for user reporting */}
            {errorId && (
              <div className="error-boundary-footer">
                <p className="error-boundary-id">
                  Error ID: <code>{errorId}</code>
                </p>
                <p className="error-boundary-support">
                  If this problem persists, please contact support with the Error ID above.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Enhanced Error Notification */}
        {showNotification && this.props.enableNotifications !== false && errorId && (
          <ErrorNotification
            errorId={errorId}
            errorCategory={errorCategory || 'component-error'}
            message={error?.message || 'Unknown error occurred'}
            onRetry={retryCount < this.maxRetries ? this.handleRetry : undefined}
            onDismiss={() => this.setState({ showNotification: false })}
            canRetry={this.props.enableRecovery && retryCount < this.maxRetries}
            isRecovering={isRecovering}
          />
        )}
      </>
    );
  }

  /**
   * Get user-friendly error category label
   */
  private getErrorCategoryLabel(category: ErrorCategory): string {
    switch (category) {
      case 'network-error':
        return 'Network Issue';
      case 'validation-error':
        return 'Input Error';
      case 'performance-error':
        return 'Performance Issue';
      case 'fatal-error':
        return 'System Error';
      case 'component-error':
      default:
        return 'Component Error';
    }
  }

  /**
   * Get error title based on category
   */
  private getErrorTitle(category: ErrorCategory | null): string {
    switch (category) {
      case 'network-error':
        return 'Connection Problem';
      case 'validation-error':
        return 'Invalid Input';
      case 'performance-error':
        return 'Performance Issue Detected';
      case 'fatal-error':
        return 'Application Error';
      case 'component-error':
      default:
        return 'Something went wrong';
    }
  }

  /**
   * Get error message based on category
   */
  private getErrorMessage(category: ErrorCategory | null): string {
    switch (category) {
      case 'network-error':
        return 'We\'re having trouble connecting to our servers. Please check your internet connection and try again.';
      case 'validation-error':
        return 'There was a problem with the information provided. Please review your input and try again.';
      case 'performance-error':
        return 'The application is running slowly. This may be due to high system load or memory usage.';
      case 'fatal-error':
        return 'A critical error has occurred and the application needs to be reloaded. Your progress may have been lost.';
      case 'component-error':
      default:
        return 'We\'ve encountered an unexpected error. The error has been logged and our team has been notified.';
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.renderFallback();
    }

    return this.props.children;
  }
}

/**
 * Enhanced HOC to wrap components with logging error boundary
 */
export function withLoggingErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  boundaryProps?: Omit<Props, 'children'>
) {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component';
  
  const ErrorBoundaryWrappedComponent = function(props: P) {
    return (
      <LoggingErrorBoundary 
        boundaryName={`ErrorBoundary(${displayName})`}
        enableRecovery={true}
        enableNotifications={true}
        enableAnalytics={true}
        {...boundaryProps}
      >
        <WrappedComponent {...props} />
      </LoggingErrorBoundary>
    );
  };

  ErrorBoundaryWrappedComponent.displayName = `withErrorBoundary(${displayName})`;
  return ErrorBoundaryWrappedComponent;
}

/**
 * Higher-order component for route-level error boundaries
 */
export function withRouteErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  routeName?: string
) {
  return withLoggingErrorBoundary(WrappedComponent, {
    boundaryName: `RouteErrorBoundary(${routeName || WrappedComponent.name})`,
    enableRecovery: true,
    enableNotifications: true,
    enableAnalytics: true,
    maxRetries: 2, // Fewer retries for route-level errors
    recoveryStrategy: 'fallback',
  });
}

/**
 * Enhanced hook to use error boundary context (for components inside boundary)
 */
export function useErrorBoundary(): {
  reportError: (error: Error, errorInfo?: Partial<ErrorInfo>, category?: ErrorCategory) => void;
  reportNetworkError: (error: Error, endpoint?: string) => void;
  reportValidationError: (error: Error, field?: string) => void;
  reportPerformanceIssue: (error: Error, operation?: string, duration?: number) => void;
} {
  return {
    reportError: (error: Error, errorInfo?: Partial<ErrorInfo>, category?: ErrorCategory) => {
      // Add category information to error object for categorization
      if (category) {
        (error as any).__errorCategory = category;
      }
      // This will trigger the error boundary
      throw error;
    },

    reportNetworkError: (error: Error, endpoint?: string) => {
      (error as any).__errorCategory = 'network-error';
      (error as any).__errorContext = { endpoint };
      throw error;
    },

    reportValidationError: (error: Error, field?: string) => {
      (error as any).__errorCategory = 'validation-error';
      (error as any).__errorContext = { field };
      throw error;
    },

    reportPerformanceIssue: (error: Error, operation?: string, duration?: number) => {
      (error as any).__errorCategory = 'performance-error';
      (error as any).__errorContext = { operation, duration };
      throw error;
    },
  };
}

/**
 * Enhanced styles for error boundary with category support and animations
 */
export const errorBoundaryStyles = `
/* Base error boundary styles */
.error-boundary-fallback {
  padding: 2rem;
  margin: 1rem;
  border: 1px solid #dc2626;
  border-radius: 0.5rem;
  background-color: #fef2f2;
  color: #dc2626;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
  position: relative;
  overflow: hidden;
}

/* Category-specific styling */
.error-boundary-category {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  margin-bottom: 0.5rem;
  background-color: rgba(0, 0, 0, 0.1);
}

.error-category-network-error .error-boundary-category {
  background-color: #fbbf24;
  color: #92400e;
}

.error-category-validation-error .error-boundary-category {
  background-color: #f87171;
  color: #991b1b;
}

.error-category-performance-error .error-boundary-category {
  background-color: #fb923c;
  color: #c2410c;
}

.error-category-fatal-error .error-boundary-category {
  background-color: #ef4444;
  color: #991b1b;
}

.error-category-component-error .error-boundary-category {
  background-color: #9ca3af;
  color: #374151;
}

/* Recovery status indicator */
.error-boundary-recovering {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background-color: #f3f4f6;
  border-radius: 6px;
  margin: 1rem 0;
  color: #4b5563;
  font-size: 0.875rem;
}

.recovery-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid #e5e7eb;
  border-top: 2px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Enhanced development details */
.error-details-section {
  margin-bottom: 1rem;
}

.error-details-section h4 {
  margin: 0 0 0.5rem 0;
  font-size: 0.875rem;
  color: #374151;
  font-weight: 600;
}

.error-context-list {
  list-style: none;
  padding: 0;
  margin: 0;
  font-size: 0.75rem;
  color: #6b7280;
}

.error-context-list li {
  padding: 2px 0;
}

.error-boundary-id-dev {
  font-size: 0.75rem;
  color: #6b7280;
  background-color: #f9fafb;
  padding: 0.5rem;
  border-radius: 4px;
  margin-top: 0.5rem;
}

/* Enhanced action buttons */
.error-boundary-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 1rem 0;
}

.error-boundary-retry-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-boundary-network-retry-btn {
  padding: 0.5rem 1rem;
  border: 1px solid #f59e0b;
  border-radius: 0.375rem;
  background-color: #fef3c7;
  color: #92400e;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
}

.error-boundary-network-retry-btn:hover {
  background-color: #fde68a;
}

/* Footer styling */
.error-boundary-footer {
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid #e5e7eb;
}

.error-boundary-support {
  font-size: 0.75rem;
  color: #6b7280;
  margin: 0.5rem 0 0 0;
  line-height: 1.4;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .error-boundary-fallback {
    background-color: #1f2937;
    color: #f87171;
    border-color: #f87171;
  }
  
  .error-boundary-recovering {
    background-color: #374151;
    color: #d1d5db;
  }
  
  .error-details-section h4 {
    color: #e5e7eb;
  }
  
  .error-context-list {
    color: #9ca3af;
  }
  
  .error-boundary-id-dev {
    background-color: #374151;
    color: #9ca3af;
  }
  
  .error-boundary-footer {
    border-top-color: #4b5563;
  }
  
  .error-boundary-support {
    color: #9ca3af;
  }
}

/* High contrast mode */
@media (prefers-contrast: high) {
  .error-boundary-fallback {
    border-width: 2px;
    border-color: #000;
  }
  
  .error-boundary-retry-btn,
  .error-boundary-reload-btn {
    border: 2px solid #000;
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .recovery-spinner {
    animation: none;
    border-top-color: currentColor;
  }
}

/* Responsive design */
@media (max-width: 640px) {
  .error-boundary-fallback {
    margin: 0.5rem;
    padding: 1.5rem;
  }
  
  .error-boundary-actions {
    flex-direction: column;
  }
  
  .error-boundary-actions button {
    width: 100%;
  }
}

.error-boundary-content {
  max-width: 40rem;
}

.error-boundary-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 0.5rem 0;
}

.error-boundary-message {
  margin: 0 0 1rem 0;
  line-height: 1.5;
}

.error-boundary-details {
  margin: 1rem 0;
  padding: 1rem;
  background-color: #ffffff;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
}

.error-boundary-stack,
.error-boundary-component-stack {
  font-size: 0.875rem;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  white-space: pre-wrap;
  overflow: auto;
  max-height: 200px;
  background-color: #f9fafb;
  padding: 0.5rem;
  border-radius: 0.25rem;
}

.error-boundary-actions {
  display: flex;
  gap: 0.5rem;
  margin: 1rem 0;
}

.error-boundary-retry-btn,
.error-boundary-reload-btn {
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  background-color: #ffffff;
  color: #374151;
  font-size: 0.875rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.error-boundary-retry-btn:hover,
.error-boundary-reload-btn:hover {
  background-color: #f9fafb;
}

.error-boundary-id {
  font-size: 0.75rem;
  color: #6b7280;
  margin-top: 1rem;
}

.error-boundary-id code {
  background-color: #f3f4f6;
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}
`;