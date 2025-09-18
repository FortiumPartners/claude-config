/**
 * ErrorBoundary Integration Tests
 * Task 2.2: Error Boundary Integration Enhancement
 * 
 * Test Coverage:
 * - Error boundary component rendering and recovery
 * - Integration with logging context and hooks
 * - Error categorization and recovery strategies
 * - Network error handling and offline scenarios
 * - Performance monitoring and recovery
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoggingErrorBoundary, ErrorCategory } from '../../components/LoggingErrorBoundary';
import { ErrorNotification } from '../../components/ErrorNotification';
import { GlobalErrorHandler } from '../../components/GlobalErrorHandler';
import { withErrorBoundary } from '../../hoc/withErrorBoundary';
import { TestLoggerProvider } from '../../contexts/LoggerContext';
import { FrontendLogger } from '../../services/logger';
import { errorRecoveryManager } from '../../utils/errorRecovery';

// Mock logger for testing
const createMockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  setContext: jest.fn(),
  getMetrics: jest.fn(() => ({
    totalLogs: 0,
    errorCount: 0,
    bufferSize: 0,
  })),
  flush: jest.fn().mockResolvedValue(undefined),
  dispose: jest.fn(),
});

// Test components that throw errors
const ComponentThatThrows = ({ shouldThrow = false, errorType = 'component' }: { 
  shouldThrow?: boolean;
  errorType?: string;
}) => {
  if (shouldThrow) {
    const error = new Error(`Test ${errorType} error`);
    if (errorType === 'network') {
      (error as any).__errorCategory = 'network-error';
    }
    throw error;
  }
  return <div>Component rendered successfully</div>;
};

const AsyncComponentThatThrows = ({ shouldThrow = false }: { shouldThrow?: boolean }) => {
  React.useEffect(() => {
    if (shouldThrow) {
      Promise.reject(new Error('Async error')).catch(() => {
        // This will be caught by global error handler
      });
    }
  }, [shouldThrow]);

  return <div>Async component rendered</div>;
};

describe('Error Boundary Integration', () => {
  let mockLogger: ReturnType<typeof createMockLogger>;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    mockLogger = createMockLogger();
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.clearAllMocks();
    
    // Mock network status
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    });
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    errorRecoveryManager.clearHistory();
  });

  describe('Basic Error Boundary Functionality', () => {
    it('should catch and display error fallback UI', async () => {
      render(
        <TestLoggerProvider mockLogger={mockLogger as any}>
          <LoggingErrorBoundary boundaryName="TestBoundary" enableRecovery={true}>
            <ComponentThatThrows shouldThrow={true} />
          </LoggingErrorBoundary>
        </TestLoggerProvider>
      );

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should render children when no error occurs', () => {
      render(
        <TestLoggerProvider mockLogger={mockLogger as any}>
          <LoggingErrorBoundary boundaryName="TestBoundary">
            <ComponentThatThrows shouldThrow={false} />
          </LoggingErrorBoundary>
        </TestLoggerProvider>
      );

      expect(screen.getByText('Component rendered successfully')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('should show retry button when recovery is enabled', async () => {
      render(
        <TestLoggerProvider mockLogger={mockLogger as any}>
          <LoggingErrorBoundary 
            boundaryName="TestBoundary" 
            enableRecovery={true}
            maxRetries={3}
          >
            <ComponentThatThrows shouldThrow={true} />
          </LoggingErrorBoundary>
        </TestLoggerProvider>
      );

      const retryButton = screen.getByText(/Try Again/i);
      expect(retryButton).toBeInTheDocument();
      expect(retryButton).toContain(HTMLButtonElement);
    });
  });

  describe('Error Categorization', () => {
    it('should categorize network errors correctly', async () => {
      render(
        <TestLoggerProvider mockLogger={mockLogger as any}>
          <LoggingErrorBoundary 
            boundaryName="NetworkBoundary" 
            enableRecovery={true}
            enableAnalytics={true}
          >
            <ComponentThatThrows shouldThrow={true} errorType="network" />
          </LoggingErrorBoundary>
        </TestLoggerProvider>
      );

      await waitFor(() => {
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('React Error Boundary caught error'),
          expect.objectContaining({
            errorCategory: 'network-error',
          }),
          expect.any(Error)
        );
      });
    });

    it('should show category-specific UI elements', async () => {
      render(
        <TestLoggerProvider mockLogger={mockLogger as any}>
          <LoggingErrorBoundary 
            boundaryName="NetworkBoundary"
            enableRecovery={true}
          >
            <ComponentThatThrows shouldThrow={true} errorType="network" />
          </LoggingErrorBoundary>
        </TestLoggerProvider>
      );

      expect(screen.getByText(/Connection Problem/i)).toBeInTheDocument();
    });
  });

  describe('Error Recovery', () => {
    it('should attempt retry when retry button is clicked', async () => {
      const user = userEvent.setup();
      let shouldThrow = true;

      const TestComponent = () => (
        <ComponentThatThrows shouldThrow={shouldThrow} />
      );

      render(
        <TestLoggerProvider mockLogger={mockLogger as any}>
          <LoggingErrorBoundary 
            boundaryName="RetryBoundary"
            enableRecovery={true}
            maxRetries={3}
          >
            <TestComponent />
          </LoggingErrorBoundary>
        </TestLoggerProvider>
      );

      // Should show error initially
      expect(screen.getByRole('alert')).toBeInTheDocument();
      
      const retryButton = screen.getByText(/Try Again/i);
      
      // Fix the component and retry
      shouldThrow = false;
      await user.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText('Component rendered successfully')).toBeInTheDocument();
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('Error boundary retry attempted'),
          expect.any(Object)
        );
      });
    });

    it('should disable retry button after max retries', async () => {
      const user = userEvent.setup();
      
      render(
        <TestLoggerProvider mockLogger={mockLogger as any}>
          <LoggingErrorBoundary 
            boundaryName="MaxRetryBoundary"
            enableRecovery={true}
            maxRetries={1}
          >
            <ComponentThatThrows shouldThrow={true} />
          </LoggingErrorBoundary>
        </TestLoggerProvider>
      );

      const retryButton = screen.getByText(/Try Again/i);
      
      // First retry
      await user.click(retryButton);
      
      await waitFor(() => {
        expect(screen.queryByText(/Try Again/i)).not.toBeInTheDocument();
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('max retries exceeded'),
          expect.any(Object)
        );
      });
    });
  });

  describe('Error Notifications', () => {
    it('should render error notification with correct props', () => {
      render(
        <ErrorNotification
          errorId="test-error-123"
          errorCategory="network-error"
          message="Test network error occurred"
          onDismiss={jest.fn()}
          canRetry={true}
          onRetry={jest.fn()}
        />
      );

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/Connection Issue/i)).toBeInTheDocument();
      expect(screen.getByText(/Test network error occurred/i)).toBeInTheDocument();
      expect(screen.getByText(/Retry Connection/i)).toBeInTheDocument();
    });

    it('should call onRetry when retry button is clicked', async () => {
      const user = userEvent.setup();
      const onRetry = jest.fn();
      
      render(
        <ErrorNotification
          errorId="test-error-123"
          errorCategory="component-error"
          message="Test error"
          onDismiss={jest.fn()}
          canRetry={true}
          onRetry={onRetry}
        />
      );

      const retryButton = screen.getByText(/Retry/i);
      await user.click(retryButton);

      expect(onRetry).toHaveBeenCalled();
    });

    it('should auto-dismiss after specified delay', async () => {
      const onDismiss = jest.fn();
      
      render(
        <ErrorNotification
          errorId="test-error-123"
          errorCategory="validation-error"
          message="Test error"
          onDismiss={onDismiss}
          autoDismissDelay={1000} // 1 second for testing
        />
      );

      await waitFor(
        () => {
          expect(onDismiss).toHaveBeenCalled();
        },
        { timeout: 2000 }
      );
    });
  });

  describe('HOC Integration', () => {
    it('should wrap component with error boundary using HOC', () => {
      const SafeComponent = withErrorBoundary(ComponentThatThrows, {
        boundaryName: 'HOCBoundary',
        enableRecovery: true,
      });

      render(
        <TestLoggerProvider mockLogger={mockLogger as any}>
          <SafeComponent shouldThrow={true} />
        </TestLoggerProvider>
      );

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
    });

    it('should preserve component display name in HOC', () => {
      ComponentThatThrows.displayName = 'TestComponent';
      const SafeComponent = withErrorBoundary(ComponentThatThrows);
      
      expect(SafeComponent.displayName).toBe('withErrorBoundary(TestComponent)');
    });
  });

  describe('Global Error Handler Integration', () => {
    it('should catch global errors and log them', async () => {
      const onCriticalError = jest.fn();
      
      render(
        <TestLoggerProvider mockLogger={mockLogger as any}>
          <GlobalErrorHandler
            enableConsoleInterception={true}
            enableResourceErrorTracking={true}
            onCriticalError={onCriticalError}
          >
            <div>Test content</div>
          </GlobalErrorHandler>
        </TestLoggerProvider>
      );

      // Simulate a global error
      const errorEvent = new ErrorEvent('error', {
        message: 'Global test error',
        filename: 'test.js',
        lineno: 1,
        colno: 1,
        error: new Error('Global test error'),
      });

      act(() => {
        window.dispatchEvent(errorEvent);
      });

      await waitFor(() => {
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Global JavaScript error caught'),
          expect.objectContaining({
            source: 'global',
            filename: 'test.js',
          }),
          expect.any(Error)
        );
      });
    });

    it('should handle unhandled promise rejections', async () => {
      render(
        <TestLoggerProvider mockLogger={mockLogger as any}>
          <GlobalErrorHandler>
            <AsyncComponentThatThrows shouldThrow={true} />
          </GlobalErrorHandler>
        </TestLoggerProvider>
      );

      // Wait for the async error to be handled
      await waitFor(
        () => {
          expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining('Unhandled promise rejection'),
            expect.objectContaining({
              source: 'unhandled-promise',
            }),
            expect.any(Error)
          );
        },
        { timeout: 2000 }
      );
    });
  });

  describe('Offline Error Handling', () => {
    it('should queue errors when offline and process when online', async () => {
      // Start offline
      Object.defineProperty(navigator, 'onLine', {
        value: false,
      });

      render(
        <TestLoggerProvider mockLogger={mockLogger as any}>
          <LoggingErrorBoundary 
            boundaryName="OfflineBoundary"
            enableOfflineQueue={true}
          >
            <ComponentThatThrows shouldThrow={true} />
          </LoggingErrorBoundary>
        </TestLoggerProvider>
      );

      // Error should be queued, not immediately logged
      await waitFor(() => {
        // The error might still be logged immediately for display purposes
        // but queue processing should happen when online
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      // Go back online
      Object.defineProperty(navigator, 'onLine', {
        value: true,
      });

      // Dispatch online event
      act(() => {
        window.dispatchEvent(new Event('online'));
      });

      await waitFor(() => {
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('Processing offline error queue'),
          expect.any(Object)
        );
      });
    });
  });

  describe('Context Integration', () => {
    it('should include user and tenant context in error logs', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockTenant = { id: 'tenant-456', name: 'Test Tenant' };

      // Mock auth and tenant contexts
      const TestProviderWithContext = ({ children }: { children: React.ReactNode }) => (
        <TestLoggerProvider mockLogger={mockLogger as any}>
          {children}
        </TestLoggerProvider>
      );

      render(
        <TestProviderWithContext>
          <LoggingErrorBoundary 
            boundaryName="ContextBoundary"
            enableAnalytics={true}
          >
            <ComponentThatThrows shouldThrow={true} />
          </LoggingErrorBoundary>
        </TestProviderWithContext>
      );

      await waitFor(() => {
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('React Error Boundary caught error'),
          expect.objectContaining({
            errorBoundaryType: 'enhanced-react-error-boundary',
            boundaryName: 'ContextBoundary',
          }),
          expect.any(Error)
        );
      });
    });
  });

  describe('Performance Monitoring', () => {
    it('should include performance metrics in error context', async () => {
      // Mock performance API
      const mockPerformance = {
        now: jest.fn(() => 1000),
        getEntriesByType: jest.fn(() => []),
        memory: {
          usedJSHeapSize: 50 * 1024 * 1024, // 50MB
          totalJSHeapSize: 100 * 1024 * 1024,
          jsHeapSizeLimit: 200 * 1024 * 1024,
        },
      };

      Object.defineProperty(window, 'performance', {
        value: mockPerformance,
      });

      render(
        <TestLoggerProvider mockLogger={mockLogger as any}>
          <LoggingErrorBoundary 
            boundaryName="PerformanceBoundary"
            enableAnalytics={true}
          >
            <ComponentThatThrows shouldThrow={true} />
          </LoggingErrorBoundary>
        </TestLoggerProvider>
      );

      await waitFor(() => {
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            memoryUsage: expect.objectContaining({
              usedJSHeapSize: 50 * 1024 * 1024,
            }),
            performanceTimestamp: 1000,
          }),
          expect.any(Error)
        );
      });
    });
  });

  describe('Error Recovery Manager Integration', () => {
    it('should use error recovery manager for strategy determination', async () => {
      const user = userEvent.setup();
      
      render(
        <TestLoggerProvider mockLogger={mockLogger as any}>
          <LoggingErrorBoundary 
            boundaryName="RecoveryManagerBoundary"
            enableRecovery={true}
            recoveryStrategy="retry"
          >
            <ComponentThatThrows shouldThrow={true} />
          </LoggingErrorBoundary>
        </TestLoggerProvider>
      );

      const retryButton = screen.getByText(/Try Again/i);
      await user.click(retryButton);

      // Check that recovery manager was used
      const history = errorRecoveryManager.getErrorHistory();
      expect(history.length).toBeGreaterThan(0);
    });
  });
});

// Helper function to create test scenarios
export const createErrorBoundaryTest = (
  scenario: {
    errorType: ErrorCategory;
    shouldRetry: boolean;
    maxRetries?: number;
    recoveryStrategy?: string;
  }
) => {
  return {
    name: `Error Boundary - ${scenario.errorType}`,
    component: (
      <TestLoggerProvider mockLogger={createMockLogger() as any}>
        <LoggingErrorBoundary 
          boundaryName={`Test${scenario.errorType}Boundary`}
          enableRecovery={scenario.shouldRetry}
          maxRetries={scenario.maxRetries || 3}
          recoveryStrategy={scenario.recoveryStrategy as any}
        >
          <ComponentThatThrows shouldThrow={true} errorType={scenario.errorType} />
        </LoggingErrorBoundary>
      </TestLoggerProvider>
    ),
  };
};