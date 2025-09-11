/**
 * withErrorBoundary - Higher-Order Component for Error Boundary Integration
 * Task 2.2: Error Boundary Integration Enhancement
 * 
 * Features:
 * - Simplified HOC pattern for wrapping components
 * - Automatic error boundary configuration based on component type
 * - Route-level and component-level error boundary variants
 * - Integration with existing logging and context systems
 */

import React from 'react';
import { 
  LoggingErrorBoundary, 
  ErrorCategory, 
  RecoveryStrategy,
  withLoggingErrorBoundary,
  withRouteErrorBoundary
} from '../components/LoggingErrorBoundary';

// Re-export the enhanced HOCs for easier usage
export { withLoggingErrorBoundary, withRouteErrorBoundary };

interface ErrorBoundaryConfig {
  boundaryName?: string;
  enableRecovery?: boolean;
  enableNotifications?: boolean;
  enableAnalytics?: boolean;
  maxRetries?: number;
  retryDelays?: number[];
  recoveryStrategy?: RecoveryStrategy;
  enableOfflineQueue?: boolean;
  onError?: (error: Error, errorInfo: React.ErrorInfo, context: any) => void;
  onRecovery?: (errorId: string, recoveryMethod: string) => void;
}

/**
 * Simple HOC for basic error boundary wrapping
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  config?: ErrorBoundaryConfig
) {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component';
  
  const ErrorBoundaryComponent = (props: P) => (
    <LoggingErrorBoundary
      boundaryName={config?.boundaryName || `ErrorBoundary(${displayName})`}
      enableRecovery={config?.enableRecovery ?? true}
      enableNotifications={config?.enableNotifications ?? true}
      enableAnalytics={config?.enableAnalytics ?? true}
      maxRetries={config?.maxRetries ?? 3}
      retryDelays={config?.retryDelays}
      recoveryStrategy={config?.recoveryStrategy ?? 'retry'}
      enableOfflineQueue={config?.enableOfflineQueue ?? true}
      onError={config?.onError}
      onRecovery={config?.onRecovery}
    >
      <WrappedComponent {...props} />
    </LoggingErrorBoundary>
  );

  ErrorBoundaryComponent.displayName = `withErrorBoundary(${displayName})`;
  return ErrorBoundaryComponent;
}

/**
 * HOC for critical components that need special error handling
 */
export function withCriticalErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  config?: ErrorBoundaryConfig
) {
  return withErrorBoundary(WrappedComponent, {
    ...config,
    maxRetries: config?.maxRetries ?? 1,
    recoveryStrategy: config?.recoveryStrategy ?? 'reload',
    enableNotifications: config?.enableNotifications ?? true,
    boundaryName: config?.boundaryName || `CriticalErrorBoundary(${WrappedComponent.name})`,
  });
}

/**
 * HOC for form components with validation error handling
 */
export function withFormErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  config?: ErrorBoundaryConfig
) {
  return withErrorBoundary(WrappedComponent, {
    ...config,
    maxRetries: config?.maxRetries ?? 2,
    recoveryStrategy: config?.recoveryStrategy ?? 'fallback',
    enableNotifications: config?.enableNotifications ?? true,
    boundaryName: config?.boundaryName || `FormErrorBoundary(${WrappedComponent.name})`,
  });
}

/**
 * HOC for data components with network error handling
 */
export function withDataErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  config?: ErrorBoundaryConfig
) {
  return withErrorBoundary(WrappedComponent, {
    ...config,
    maxRetries: config?.maxRetries ?? 3,
    retryDelays: config?.retryDelays ?? [1000, 3000, 5000],
    recoveryStrategy: config?.recoveryStrategy ?? 'retry',
    enableOfflineQueue: config?.enableOfflineQueue ?? true,
    boundaryName: config?.boundaryName || `DataErrorBoundary(${WrappedComponent.name})`,
  });
}

/**
 * HOC for async components with lazy loading error handling
 */
export function withAsyncErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  config?: ErrorBoundaryConfig
) {
  return withErrorBoundary(WrappedComponent, {
    ...config,
    maxRetries: config?.maxRetries ?? 2,
    recoveryStrategy: config?.recoveryStrategy ?? 'reload',
    enableNotifications: config?.enableNotifications ?? true,
    boundaryName: config?.boundaryName || `AsyncErrorBoundary(${WrappedComponent.name})`,
  });
}

/**
 * Utility function to create custom error boundary configurations
 */
export function createErrorBoundaryConfig(
  category: ErrorCategory,
  customConfig?: Partial<ErrorBoundaryConfig>
): ErrorBoundaryConfig {
  const baseConfigs: Record<ErrorCategory, ErrorBoundaryConfig> = {
    'network-error': {
      maxRetries: 3,
      retryDelays: [1000, 2000, 4000],
      recoveryStrategy: 'retry',
      enableOfflineQueue: true,
    },
    'validation-error': {
      maxRetries: 2,
      recoveryStrategy: 'fallback',
      enableNotifications: true,
    },
    'performance-error': {
      maxRetries: 1,
      recoveryStrategy: 'degrade',
      enableNotifications: true,
    },
    'fatal-error': {
      maxRetries: 0,
      recoveryStrategy: 'reload',
      enableNotifications: true,
    },
    'component-error': {
      maxRetries: 3,
      recoveryStrategy: 'retry',
      enableNotifications: true,
    },
  };

  return {
    ...baseConfigs[category],
    ...customConfig,
  };
}

/**
 * Provider component for setting default error boundary configuration
 */
interface ErrorBoundaryConfigContextValue {
  defaultConfig: ErrorBoundaryConfig;
}

const ErrorBoundaryConfigContext = React.createContext<ErrorBoundaryConfigContextValue>({
  defaultConfig: {},
});

interface ErrorBoundaryConfigProviderProps {
  children: React.ReactNode;
  defaultConfig: ErrorBoundaryConfig;
}

export const ErrorBoundaryConfigProvider: React.FC<ErrorBoundaryConfigProviderProps> = ({
  children,
  defaultConfig,
}) => {
  const value = React.useMemo(() => ({ defaultConfig }), [defaultConfig]);
  
  return (
    <ErrorBoundaryConfigContext.Provider value={value}>
      {children}
    </ErrorBoundaryConfigContext.Provider>
  );
};

/**
 * Hook to access error boundary configuration
 */
export function useErrorBoundaryConfig(): ErrorBoundaryConfigContextValue {
  return React.useContext(ErrorBoundaryConfigContext);
}

/**
 * Component decorator for class-based components
 */
export function ErrorBoundaryDecorator(config?: ErrorBoundaryConfig) {
  return function<T extends React.ComponentType<any>>(target: T): T {
    const WrappedComponent = withErrorBoundary(target, config);
    return WrappedComponent as any;
  };
}

// Export types for external usage
export type { ErrorBoundaryConfig };

// Usage examples:
/*
// Basic usage
const SafeComponent = withErrorBoundary(MyComponent);

// With custom configuration
const SafeFormComponent = withErrorBoundary(FormComponent, {
  boundaryName: 'CustomForm',
  maxRetries: 2,
  recoveryStrategy: 'fallback'
});

// Using specialized HOCs
const SafeDataComponent = withDataErrorBoundary(DataComponent);
const SafeCriticalComponent = withCriticalErrorBoundary(CriticalComponent);
const SafeFormComponent = withFormErrorBoundary(FormComponent);
const SafeAsyncComponent = withAsyncErrorBoundary(LazyComponent);

// Using decorator pattern (TypeScript)
@ErrorBoundaryDecorator({ maxRetries: 1, recoveryStrategy: 'reload' })
class MyClassComponent extends React.Component {
  // component implementation
}

// With configuration provider
<ErrorBoundaryConfigProvider defaultConfig={{ enableAnalytics: true }}>
  <App />
</ErrorBoundaryConfigProvider>
*/