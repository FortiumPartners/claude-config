/**
 * Logger Integration Example
 * Task 2.1: Frontend Logger Client Implementation
 * 
 * Demonstrates how to integrate the frontend logger with existing React components
 * and patterns in the monitoring web service frontend.
 */

import React, { useEffect, useState } from 'react';
import { useLogger, usePerformanceLogger, useInteractionLogger } from '../hooks/useLogger';
import { LoggingErrorBoundary } from '../components/LoggingErrorBoundary';
import { LoggerProvider } from '../contexts/LoggerContext';

/**
 * Example Dashboard Component with Logging Integration
 */
function DashboardWithLogging() {
  const { info, warn, error, setContext } = useLogger({ 
    component: 'Dashboard',
    trackRenderCount: true,
    trackPerformance: true,
  });
  
  const { logRender, startTiming } = usePerformanceLogger('Dashboard');
  const { logClick, logApiCall } = useInteractionLogger('Dashboard');

  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(false);

  // Log component lifecycle
  useEffect(() => {
    logRender('mount');
    info('Dashboard component mounted', {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
    });

    return () => {
      logRender('unmount');
      info('Dashboard component unmounted');
    };
  }, [logRender, info]);

  // Example API call with logging
  const fetchMetrics = async () => {
    const stopTiming = startTiming('fetch-metrics');
    setLoading(true);
    
    try {
      info('Fetching metrics data', { action: 'api-request' });
      
      const response = await fetch('/api/v1/metrics');
      const duration = performance.now();
      
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
        
        logApiCall('/api/v1/metrics', 'GET', response.status, duration);
        info('Metrics loaded successfully', { 
          recordCount: data.length,
          action: 'api-success',
        });
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      
      error('Failed to fetch metrics', {
        action: 'api-error',
        endpoint: '/api/v1/metrics',
      }, err instanceof Error ? err : new Error(errorMessage));
      
      logApiCall('/api/v1/metrics', 'GET', 500, performance.now());
    } finally {
      setLoading(false);
      stopTiming();
    }
  };

  // Example user interaction logging
  const handleRefreshClick = () => {
    logClick('refresh-button', {
      section: 'dashboard',
      timestamp: new Date().toISOString(),
    });
    
    fetchMetrics();
  };

  // Example context update (when user/tenant changes)
  useEffect(() => {
    setContext({
      userId: 'user123', // This would come from auth context
      tenantId: 'tenant456', // This would come from tenant context
      component: 'Dashboard',
      action: 'view',
    });
  }, [setContext]);

  return (
    <div className="dashboard">
      <h1>Dashboard</h1>
      
      <button 
        onClick={handleRefreshClick}
        disabled={loading}
        className="refresh-btn"
      >
        {loading ? 'Loading...' : 'Refresh Metrics'}
      </button>

      {metrics && (
        <div className="metrics-display">
          <h2>Metrics</h2>
          <pre>{JSON.stringify(metrics, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

/**
 * Example Error Component for testing error boundary
 */
function ErrorComponent({ shouldError }: { shouldError: boolean }) {
  const { error: logError } = useLogger({ component: 'ErrorComponent' });

  useEffect(() => {
    if (shouldError) {
      logError('Intentional error for testing', {
        testCase: 'error-boundary-test',
        timestamp: new Date().toISOString(),
      });
      
      throw new Error('This is an intentional error for testing the error boundary');
    }
  }, [shouldError, logError]);

  return <div>This component will error if shouldError is true</div>;
}

/**
 * Example Widget Component with Performance Tracking
 */
function PerformanceTrackedWidget() {
  const { info } = useLogger({ 
    component: 'PerformanceWidget',
    trackPerformance: true,
  });
  
  const { logOperation, startTiming } = usePerformanceLogger('PerformanceWidget');

  const [data, setData] = useState<number[]>([]);

  // Simulate expensive computation with performance tracking
  const performExpensiveOperation = () => {
    const stopTiming = startTiming('expensive-computation');
    
    info('Starting expensive computation', {
      operation: 'data-processing',
      dataSize: 10000,
    });

    // Simulate work
    const result: number[] = [];
    for (let i = 0; i < 10000; i++) {
      result.push(Math.random() * 100);
    }
    
    setData(result.slice(0, 100)); // Only display first 100 items
    
    logOperation('expensive-computation', performance.now(), {
      resultSize: result.length,
      displaySize: 100,
    });
    
    info('Expensive computation completed', {
      operation: 'data-processing',
      resultCount: result.length,
    });

    stopTiming();
  };

  return (
    <div className="performance-widget">
      <h3>Performance Tracked Widget</h3>
      <button onClick={performExpensiveOperation}>
        Run Expensive Operation
      </button>
      
      {data.length > 0 && (
        <div>
          <p>Generated {data.length} data points</p>
          <div className="data-preview">
            {data.slice(0, 10).map((value, index) => (
              <span key={index}>{value.toFixed(2)} </span>
            ))}
            ...
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Main Application Example with Complete Logger Integration
 */
export function LoggerIntegrationExample() {
  const [showError, setShowError] = useState(false);

  return (
    <LoggerProvider
      preset="development"
      enableGlobalErrorHandling={true}
      customConfig={{
        flushInterval: 5000, // 5 seconds for demo
        enableDebugLogs: true,
        rateLimitPerMinute: 1000,
      }}
    >
      <LoggingErrorBoundary
        boundaryName="MainApplication"
        enableRecovery={true}
        fallback={(error, errorInfo) => (
          <div className="error-fallback">
            <h2>Something went wrong in the main application</h2>
            <details>
              <summary>Error Details</summary>
              <pre>{error.toString()}</pre>
              <pre>{errorInfo.componentStack}</pre>
            </details>
            <button onClick={() => window.location.reload()}>
              Reload Application
            </button>
          </div>
        )}
      >
        <div className="app">
          <h1>Logger Integration Example</h1>
          
          {/* Main Dashboard with logging */}
          <LoggingErrorBoundary boundaryName="Dashboard" enableRecovery={true}>
            <DashboardWithLogging />
          </LoggingErrorBoundary>

          {/* Performance tracking example */}
          <LoggingErrorBoundary boundaryName="PerformanceWidget" enableRecovery={true}>
            <PerformanceTrackedWidget />
          </LoggingErrorBoundary>

          {/* Error boundary testing */}
          <div className="error-testing">
            <h3>Error Boundary Testing</h3>
            <button onClick={() => setShowError(!showError)}>
              {showError ? 'Hide' : 'Show'} Error Component
            </button>
            
            {showError && (
              <LoggingErrorBoundary 
                boundaryName="ErrorTest" 
                enableRecovery={true}
                onError={(error, errorInfo) => {
                  console.log('Error boundary caught:', error.message);
                }}
              >
                <ErrorComponent shouldError={showError} />
              </LoggingErrorBoundary>
            )}
          </div>

          {/* Logger metrics display */}
          <LoggerMetricsDisplay />
        </div>
      </LoggingErrorBoundary>
    </LoggerProvider>
  );
}

/**
 * Component to display logger metrics for debugging
 */
function LoggerMetricsDisplay() {
  const { getMetrics } = useLogger({ component: 'LoggerMetricsDisplay' });
  const [metrics, setMetrics] = useState(getMetrics());

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(getMetrics());
    }, 2000);

    return () => clearInterval(interval);
  }, [getMetrics]);

  return (
    <div className="logger-metrics" style={{ 
      marginTop: '2rem', 
      padding: '1rem', 
      border: '1px solid #ccc',
      borderRadius: '4px',
      backgroundColor: '#f9f9f9' 
    }}>
      <h3>Logger Metrics</h3>
      <div style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>
        <div>Buffer Size: {metrics.bufferSize}</div>
        <div>Online: {metrics.isOnline ? 'Yes' : 'No'}</div>
        <div>Correlation ID: {metrics.correlationId}</div>
        <div>Session ID: {metrics.sessionId}</div>
        <div>Rate Limit Hits: {metrics.rateLimitHits}</div>
        <div>Storage Usage: {metrics.storageUsage} bytes</div>
        <div>Last Flush: {metrics.lastFlushTime ? new Date(metrics.lastFlushTime).toLocaleTimeString() : 'Never'}</div>
      </div>
    </div>
  );
}

// CSS styles for the example (would normally be in a separate CSS file)
export const exampleStyles = `
  .dashboard {
    padding: 1rem;
    border: 1px solid #ddd;
    border-radius: 8px;
    margin: 1rem 0;
    background: #f8f9fa;
  }

  .refresh-btn {
    padding: 0.5rem 1rem;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    margin: 0.5rem 0;
  }

  .refresh-btn:hover {
    background: #0056b3;
  }

  .refresh-btn:disabled {
    background: #6c757d;
    cursor: not-allowed;
  }

  .performance-widget {
    padding: 1rem;
    border: 1px solid #28a745;
    border-radius: 8px;
    margin: 1rem 0;
    background: #f8fff9;
  }

  .data-preview {
    margin: 0.5rem 0;
    font-family: monospace;
    background: #e9ecef;
    padding: 0.5rem;
    border-radius: 4px;
  }

  .error-testing {
    padding: 1rem;
    border: 1px solid #dc3545;
    border-radius: 8px;
    margin: 1rem 0;
    background: #fff5f5;
  }

  .error-fallback {
    padding: 2rem;
    border: 2px solid #dc3545;
    border-radius: 8px;
    background: #f8d7da;
    color: #721c24;
  }

  .error-fallback details {
    margin: 1rem 0;
    background: white;
    padding: 1rem;
    border-radius: 4px;
  }

  .error-fallback pre {
    white-space: pre-wrap;
    font-size: 0.8rem;
  }
`;

export default LoggerIntegrationExample;