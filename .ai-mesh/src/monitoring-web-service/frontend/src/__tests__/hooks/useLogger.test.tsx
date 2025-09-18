/**
 * useLogger Hook Tests
 * Task 2.1: Frontend Logger Client Implementation
 * 
 * Comprehensive tests for React logging hooks
 * Target: ≥80% test coverage
 */

import { describe, it, expect, vi, beforeEach, afterEach, MockedFunction } from 'vitest';
import { renderHook, act, render, screen } from '@testing-library/react';
import React from 'react';
import {
  useLogger,
  usePerformanceLogger,
  useErrorLogger,
  useInteractionLogger,
  useGlobalErrorLogger,
} from '../../hooks/useLogger';
import { LoggerProvider, TestLoggerProvider } from '../../contexts/LoggerContext';
import { FrontendLogger } from '../../services/logger';

// Mock the FrontendLogger
vi.mock('../../services/logger');
const MockedFrontendLogger = vi.mocked(FrontendLogger);

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid-test'),
}));

// Mock auth and tenant hooks
vi.mock('../../hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'user123' },
  })),
}));

vi.mock('../../hooks/useTenant', () => ({
  useTenant: vi.fn(() => ({
    currentTenant: { id: 'tenant456' },
  })),
}));

describe('useLogger Hook', () => {
  let mockLogger: {
    debug: MockedFunction<any>;
    info: MockedFunction<any>;
    warn: MockedFunction<any>;
    error: MockedFunction<any>;
    setContext: MockedFunction<any>;
    getMetrics: MockedFunction<any>;
    flush: MockedFunction<any>;
    dispose: MockedFunction<any>;
  };

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      setContext: vi.fn(),
      getMetrics: vi.fn(() => ({
        bufferSize: 0,
        isOnline: true,
        correlationId: 'test-correlation',
        sessionId: 'test-session',
        totalEntries: 0,
        failedEntries: 0,
        rateLimitHits: 0,
        storageUsage: 0,
        avgFlushTime: 0,
      })),
      flush: vi.fn().mockResolvedValue(undefined),
      dispose: vi.fn(),
    };

    MockedFrontendLogger.mockImplementation(() => mockLogger as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Logging', () => {
    it('should provide logging functions', () => {
      const { result } = renderHook(() => useLogger({ component: 'TestComponent' }), {
        wrapper: ({ children }) => (
          <TestLoggerProvider mockLogger={mockLogger as any}>
            {children}
          </TestLoggerProvider>
        ),
      });

      expect(result.current).toHaveProperty('debug');
      expect(result.current).toHaveProperty('info');
      expect(result.current).toHaveProperty('warn');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('setContext');
      expect(result.current).toHaveProperty('getMetrics');
      expect(result.current).toHaveProperty('flush');
    });

    it('should call logger methods with component context', () => {
      const { result } = renderHook(() => useLogger({ component: 'TestComponent' }), {
        wrapper: ({ children }) => (
          <TestLoggerProvider mockLogger={mockLogger as any}>
            {children}
          </TestLoggerProvider>
        ),
      });

      act(() => {
        result.current.info('Test message', { key: 'value' });
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Test message',
        expect.objectContaining({
          componentName: 'TestComponent',
          key: 'value',
        })
      );
    });

    it('should track render count when enabled', () => {
      const { result, rerender } = renderHook(
        () => useLogger({ component: 'TestComponent', trackRenderCount: true }),
        {
          wrapper: ({ children }) => (
            <TestLoggerProvider mockLogger={mockLogger as any}>
              {children}
            </TestLoggerProvider>
          ),
        }
      );

      // Initial render
      act(() => {
        result.current.info('Initial render');
      });

      // Force re-render
      rerender();
      
      act(() => {
        result.current.info('After rerender');
      });

      expect(mockLogger.info).toHaveBeenCalledTimes(2);
      // Check that render count is included in context
      expect(mockLogger.info).toHaveBeenLastCalledWith(
        'After rerender',
        expect.objectContaining({
          componentName: 'TestComponent',
          renderCount: expect.any(Number),
        })
      );
    });

    it('should auto-flush on unmount when enabled', () => {
      const { unmount } = renderHook(
        () => useLogger({ component: 'TestComponent', autoFlushOnUnmount: true }),
        {
          wrapper: ({ children }) => (
            <TestLoggerProvider mockLogger={mockLogger as any}>
              {children}
            </TestLoggerProvider>
          ),
        }
      );

      unmount();

      expect(mockLogger.flush).toHaveBeenCalled();
    });

    it('should not auto-flush on unmount when disabled', () => {
      const { unmount } = renderHook(
        () => useLogger({ component: 'TestComponent', autoFlushOnUnmount: false }),
        {
          wrapper: ({ children }) => (
            <TestLoggerProvider mockLogger={mockLogger as any}>
              {children}
            </TestLoggerProvider>
          ),
        }
      );

      unmount();

      expect(mockLogger.flush).not.toHaveBeenCalled();
    });

    it('should handle flush errors gracefully on unmount', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockLogger.flush.mockRejectedValue(new Error('Flush failed'));

      const { unmount } = renderHook(
        () => useLogger({ component: 'TestComponent', autoFlushOnUnmount: true }),
        {
          wrapper: ({ children }) => (
            <TestLoggerProvider mockLogger={mockLogger as any}>
              {children}
            </TestLoggerProvider>
          ),
        }
      );

      unmount();

      // Allow async operation to complete
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(consoleWarnSpy).toHaveBeenCalledWith(
            '[useLogger] Failed to flush on unmount:',
            expect.any(Error)
          );
          consoleWarnSpy.mockRestore();
          resolve();
        }, 0);
      });
    });

    it('should create fallback logger when no context provided', () => {
      // Render without LoggerProvider
      const { result } = renderHook(() => useLogger({ component: 'TestComponent' }));

      // Should still work with fallback logger
      expect(result.current).toHaveProperty('debug');
      expect(result.current).toHaveProperty('info');
      expect(result.current).toHaveProperty('warn');
      expect(result.current).toHaveProperty('error');
    });
  });

  describe('Performance Logger Hook', () => {
    it('should provide performance logging functions', () => {
      const { result } = renderHook(() => usePerformanceLogger('TestComponent'), {
        wrapper: ({ children }) => (
          <TestLoggerProvider mockLogger={mockLogger as any}>
            {children}
          </TestLoggerProvider>
        ),
      });

      expect(result.current).toHaveProperty('logRender');
      expect(result.current).toHaveProperty('logOperation');
      expect(result.current).toHaveProperty('startTiming');
    });

    it('should log render events', () => {
      const { result } = renderHook(() => usePerformanceLogger('TestComponent'), {
        wrapper: ({ children }) => (
          <TestLoggerProvider mockLogger={mockLogger as any}>
            {children}
          </TestLoggerProvider>
        ),
      });

      act(() => {
        result.current.logRender('mount');
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Component mount',
        expect.objectContaining({
          renderType: 'mount',
          performanceCategory: 'render',
        })
      );
    });

    it('should log operations with duration', () => {
      const { result } = renderHook(() => usePerformanceLogger('TestComponent'), {
        wrapper: ({ children }) => (
          <TestLoggerProvider mockLogger={mockLogger as any}>
            {children}
          </TestLoggerProvider>
        ),
      });

      act(() => {
        result.current.logOperation('data-fetch', 150, { endpoint: '/api/data' });
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Operation completed: data-fetch',
        expect.objectContaining({
          operation: 'data-fetch',
          duration: 150,
          performanceCategory: 'operation',
          endpoint: '/api/data',
        })
      );
    });

    it('should provide timing functionality', () => {
      const { result } = renderHook(() => usePerformanceLogger('TestComponent'), {
        wrapper: ({ children }) => (
          <TestLoggerProvider mockLogger={mockLogger as any}>
            {children}
          </TestLoggerProvider>
        ),
      });

      act(() => {
        const stopTiming = result.current.startTiming('test-operation');
        // Simulate some work
        setTimeout(() => stopTiming(), 10);
      });

      // Allow timing to complete
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(mockLogger.info).toHaveBeenCalledWith(
            'Operation completed: test-operation',
            expect.objectContaining({
              operation: 'test-operation',
              duration: expect.any(Number),
              performanceCategory: 'operation',
            })
          );
          resolve();
        }, 20);
      });
    });
  });

  describe('Error Logger Hook', () => {
    it('should provide error logging functions', () => {
      const { result } = renderHook(() => useErrorLogger('TestComponent'), {
        wrapper: ({ children }) => (
          <TestLoggerProvider mockLogger={mockLogger as any}>
            {children}
          </TestLoggerProvider>
        ),
      });

      expect(result.current).toHaveProperty('logError');
      expect(result.current).toHaveProperty('logErrorBoundary');
      expect(result.current).toHaveProperty('logUnhandledError');
      expect(result.current).toHaveProperty('logUnhandledRejection');
    });

    it('should log errors with context', () => {
      const { result } = renderHook(() => useErrorLogger('TestComponent'), {
        wrapper: ({ children }) => (
          <TestLoggerProvider mockLogger={mockLogger as any}>
            {children}
          </TestLoggerProvider>
        ),
      });

      const error = new Error('Test error');
      error.stack = 'Error stack trace';

      act(() => {
        result.current.logError(error, { context: 'additional' });
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error in TestComponent',
        expect.objectContaining({
          errorType: 'Error',
          errorMessage: 'Test error',
          errorStack: 'Error stack trace',
          context: 'additional',
        }),
        error
      );
    });

    it('should log error boundary catches', () => {
      const { result } = renderHook(() => useErrorLogger('TestComponent'), {
        wrapper: ({ children }) => (
          <TestLoggerProvider mockLogger={mockLogger as any}>
            {children}
          </TestLoggerProvider>
        ),
      });

      const error = new Error('Boundary error');
      const errorInfo = { componentStack: 'Component stack trace' };

      act(() => {
        result.current.logErrorBoundary(error, errorInfo);
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error boundary caught error in TestComponent',
        expect.objectContaining({
          errorType: 'Error',
          componentStack: 'Component stack trace',
          errorBoundary: 'TestComponent',
          boundaryType: 'react-error-boundary',
        }),
        error
      );
    });

    it('should log unhandled errors', () => {
      const { result } = renderHook(() => useErrorLogger('TestComponent'), {
        wrapper: ({ children }) => (
          <TestLoggerProvider mockLogger={mockLogger as any}>
            {children}
          </TestLoggerProvider>
        ),
      });

      const errorEvent = {
        error: new Error('Unhandled error'),
        message: 'Unhandled error',
        filename: 'test.js',
        lineno: 10,
        colno: 5,
      } as ErrorEvent;

      act(() => {
        result.current.logUnhandledError(errorEvent);
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Unhandled error',
        expect.objectContaining({
          errorType: 'UnhandledError',
          errorMessage: 'Unhandled error',
          filename: 'test.js',
          lineno: 10,
          colno: 5,
        }),
        expect.any(Error)
      );
    });

    it('should log unhandled promise rejections', () => {
      const { result } = renderHook(() => useErrorLogger('TestComponent'), {
        wrapper: ({ children }) => (
          <TestLoggerProvider mockLogger={mockLogger as any}>
            {children}
          </TestLoggerProvider>
        ),
      });

      const rejectionEvent = {
        reason: new Error('Promise rejection'),
      } as PromiseRejectionEvent;

      act(() => {
        result.current.logUnhandledRejection(rejectionEvent);
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Unhandled promise rejection',
        expect.objectContaining({
          errorType: 'UnhandledPromiseRejection',
          reason: 'Error: Promise rejection',
        }),
        expect.any(Error)
      );
    });

    it('should handle non-error promise rejections', () => {
      const { result } = renderHook(() => useErrorLogger('TestComponent'), {
        wrapper: ({ children }) => (
          <TestLoggerProvider mockLogger={mockLogger as any}>
            {children}
          </TestLoggerProvider>
        ),
      });

      const rejectionEvent = {
        reason: 'String rejection reason',
      } as PromiseRejectionEvent;

      act(() => {
        result.current.logUnhandledRejection(rejectionEvent);
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Unhandled promise rejection',
        expect.objectContaining({
          errorType: 'UnhandledPromiseRejection',
          reason: 'String rejection reason',
        }),
        expect.any(Error)
      );
    });
  });

  describe('Interaction Logger Hook', () => {
    it('should provide interaction logging functions', () => {
      const { result } = renderHook(() => useInteractionLogger('TestComponent'), {
        wrapper: ({ children }) => (
          <TestLoggerProvider mockLogger={mockLogger as any}>
            {children}
          </TestLoggerProvider>
        ),
      });

      expect(result.current).toHaveProperty('logClick');
      expect(result.current).toHaveProperty('logNavigation');
      expect(result.current).toHaveProperty('logFormSubmission');
      expect(result.current).toHaveProperty('logApiCall');
    });

    it('should log click interactions', () => {
      const { result } = renderHook(() => useInteractionLogger('TestComponent'), {
        wrapper: ({ children }) => (
          <TestLoggerProvider mockLogger={mockLogger as any}>
            {children}
          </TestLoggerProvider>
        ),
      });

      act(() => {
        result.current.logClick('submit-button', { form: 'login-form' });
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'User clicked: submit-button',
        expect.objectContaining({
          interactionType: 'click',
          element: 'submit-button',
          form: 'login-form',
        })
      );
    });

    it('should log navigation', () => {
      const { result } = renderHook(() => useInteractionLogger('TestComponent'), {
        wrapper: ({ children }) => (
          <TestLoggerProvider mockLogger={mockLogger as any}>
            {children}
          </TestLoggerProvider>
        ),
      });

      act(() => {
        result.current.logNavigation('/home', '/dashboard');
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Navigation',
        expect.objectContaining({
          interactionType: 'navigation',
          from: '/home',
          to: '/dashboard',
        })
      );
    });

    it('should log successful form submissions', () => {
      const { result } = renderHook(() => useInteractionLogger('TestComponent'), {
        wrapper: ({ children }) => (
          <TestLoggerProvider mockLogger={mockLogger as any}>
            {children}
          </TestLoggerProvider>
        ),
      });

      act(() => {
        result.current.logFormSubmission('login-form', true);
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Form submission: login-form',
        expect.objectContaining({
          interactionType: 'form-submit',
          formId: 'login-form',
          success: true,
          errorCount: 0,
        })
      );
    });

    it('should log failed form submissions', () => {
      const { result } = renderHook(() => useInteractionLogger('TestComponent'), {
        wrapper: ({ children }) => (
          <TestLoggerProvider mockLogger={mockLogger as any}>
            {children}
          </TestLoggerProvider>
        ),
      });

      act(() => {
        result.current.logFormSubmission('login-form', false, ['Invalid password']);
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Form submission: login-form',
        expect.objectContaining({
          interactionType: 'form-submit',
          formId: 'login-form',
          success: false,
          errors: ['Invalid password'],
          errorCount: 1,
        })
      );
    });

    it('should log successful API calls', () => {
      const { result } = renderHook(() => useInteractionLogger('TestComponent'), {
        wrapper: ({ children }) => (
          <TestLoggerProvider mockLogger={mockLogger as any}>
            {children}
          </TestLoggerProvider>
        ),
      });

      act(() => {
        result.current.logApiCall('/api/users', 'GET', 200, 150);
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'API call: GET /api/users',
        expect.objectContaining({
          interactionType: 'api-call',
          endpoint: '/api/users',
          method: 'GET',
          status: 200,
          duration: 150,
          success: true,
        })
      );
    });

    it('should log failed API calls', () => {
      const { result } = renderHook(() => useInteractionLogger('TestComponent'), {
        wrapper: ({ children }) => (
          <TestLoggerProvider mockLogger={mockLogger as any}>
            {children}
          </TestLoggerProvider>
        ),
      });

      act(() => {
        result.current.logApiCall('/api/users', 'POST', 400, 200);
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'API call: POST /api/users',
        expect.objectContaining({
          interactionType: 'api-call',
          endpoint: '/api/users',
          method: 'POST',
          status: 400,
          duration: 200,
          success: false,
        })
      );
    });
  });

  describe('Global Error Logger Hook', () => {
    let mockAddEventListener: MockedFunction<any>;
    let mockRemoveEventListener: MockedFunction<any>;

    beforeEach(() => {
      mockAddEventListener = vi.fn();
      mockRemoveEventListener = vi.fn();
      
      Object.defineProperty(window, 'addEventListener', {
        value: mockAddEventListener,
        writable: true,
      });
      
      Object.defineProperty(window, 'removeEventListener', {
        value: mockRemoveEventListener,
        writable: true,
      });
    });

    it('should set up global error handlers', () => {
      renderHook(() => useGlobalErrorLogger(), {
        wrapper: ({ children }) => (
          <TestLoggerProvider mockLogger={mockLogger as any}>
            {children}
          </TestLoggerProvider>
        ),
      });

      expect(mockAddEventListener).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockAddEventListener).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
    });

    it('should clean up event listeners on unmount', () => {
      const { unmount } = renderHook(() => useGlobalErrorLogger(), {
        wrapper: ({ children }) => (
          <TestLoggerProvider mockLogger={mockLogger as any}>
            {children}
          </TestLoggerProvider>
        ),
      });

      unmount();

      expect(mockRemoveEventListener).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockRemoveEventListener).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
    });
  });

  describe('Memoization and Performance', () => {
    it('should memoize logging functions to prevent unnecessary re-renders', () => {
      const TestComponent = ({ renderCount }: { renderCount: number }) => {
        const { info } = useLogger({ component: 'TestComponent' });
        
        React.useEffect(() => {
          info(`Render ${renderCount}`);
        }, [info, renderCount]);
        
        return <div>Test Component</div>;
      };

      const { rerender } = render(
        <TestLoggerProvider mockLogger={mockLogger as any}>
          <TestComponent renderCount={1} />
        </TestLoggerProvider>
      );

      rerender(
        <TestLoggerProvider mockLogger={mockLogger as any}>
          <TestComponent renderCount={2} />
        </TestLoggerProvider>
      );

      // Should be called twice (once for each render count)
      expect(mockLogger.info).toHaveBeenCalledTimes(2);
    });

    it('should handle component context changes efficiently', () => {
      const { result, rerender } = renderHook(
        (props) => useLogger(props),
        {
          initialProps: { component: 'TestComponent' },
          wrapper: ({ children }) => (
            <TestLoggerProvider mockLogger={mockLogger as any}>
              {children}
            </TestLoggerProvider>
          ),
        }
      );

      const firstInfoFn = result.current.info;

      rerender({ component: 'TestComponent' }); // Same component name

      const secondInfoFn = result.current.info;

      // Function should be memoized and remain the same
      expect(firstInfoFn).toBe(secondInfoFn);
    });
  });
});