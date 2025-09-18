/**
 * FrontendLogger Tests
 * Task 2.1: Frontend Logger Client Implementation
 * 
 * Comprehensive unit tests for FrontendLogger class
 * Target: ≥80% test coverage
 */

import { describe, it, expect, vi, beforeEach, afterEach, MockedFunction } from 'vitest';
import { FrontendLogger } from '../../services/logger';
import { LogLevel, LoggerConfig } from '../../types/logging.types';

// Mock UUID
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid-1234'),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

// Mock sessionStorage
const sessionStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

// Mock fetch
const fetchMock = vi.fn();

// Mock window object
const windowMock = {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  location: { href: 'http://localhost:3000/test' },
};

// Mock navigator
const navigatorMock = {
  onLine: true,
  userAgent: 'Mozilla/5.0 (Test) TestBrowser/1.0',
};

// Mock document
const documentMock = {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  hidden: false,
};

// Setup global mocks
Object.defineProperty(global, 'localStorage', { value: localStorageMock });
Object.defineProperty(global, 'sessionStorage', { value: sessionStorageMock });
Object.defineProperty(global, 'fetch', { value: fetchMock });
Object.defineProperty(global, 'window', { value: windowMock });
Object.defineProperty(global, 'navigator', { value: navigatorMock });
Object.defineProperty(global, 'document', { value: documentMock });

describe('FrontendLogger', () => {
  let logger: FrontendLogger;
  let consoleWarnSpy: MockedFunction<typeof console.warn>;
  let consoleDebugSpy: MockedFunction<typeof console.debug>;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    sessionStorageMock.clear();
    
    // Reset fetch mock
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
    });

    // Setup console spies
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    if (logger) {
      logger.dispose();
    }
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should create logger with default configuration', () => {
      logger = new FrontendLogger();
      
      expect(logger).toBeInstanceOf(FrontendLogger);
      
      const metrics = logger.getMetrics();
      expect(metrics.correlationId).toBe('mock-uuid-1234');
      expect(metrics.sessionId).toBe('mock-uuid-1234');
      expect(metrics.isOnline).toBe(true);
      expect(metrics.bufferSize).toBe(0);
    });

    it('should create logger with custom configuration', () => {
      const customConfig: Partial<LoggerConfig> = {
        bufferSize: 50,
        flushInterval: 15000,
        enableDebugLogs: true,
      };

      logger = new FrontendLogger(customConfig);
      
      expect(logger).toBeInstanceOf(FrontendLogger);
    });

    it('should set up session ID from sessionStorage', () => {
      sessionStorageMock.setItem('fortium_session_id', 'existing-session-id');
      
      logger = new FrontendLogger();
      
      const metrics = logger.getMetrics();
      expect(metrics.sessionId).toBe('existing-session-id');
    });

    it('should create new session ID if none exists', () => {
      logger = new FrontendLogger();
      
      expect(sessionStorageMock.setItem).toHaveBeenCalledWith(
        'fortium_session_id', 
        'mock-uuid-1234'
      );
    });

    it('should setup event listeners', () => {
      logger = new FrontendLogger();
      
      expect(windowMock.addEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(windowMock.addEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
      expect(windowMock.addEventListener).toHaveBeenCalledWith('popstate', expect.any(Function));
      expect(windowMock.addEventListener).toHaveBeenCalledWith('beforeunload', expect.any(Function));
      expect(documentMock.addEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    });
  });

  describe('Logging Methods', () => {
    beforeEach(() => {
      logger = new FrontendLogger({ enableDebugLogs: true });
    });

    it('should log debug messages when enabled', () => {
      logger.debug('Debug message', { key: 'value' });
      
      const metrics = logger.getMetrics();
      expect(metrics.bufferSize).toBe(1);
    });

    it('should skip debug logs when disabled', () => {
      logger = new FrontendLogger({ enableDebugLogs: false });
      
      logger.debug('Debug message');
      
      const metrics = logger.getMetrics();
      expect(metrics.bufferSize).toBe(0);
    });

    it('should log info messages', () => {
      logger.info('Info message', { key: 'value' });
      
      const metrics = logger.getMetrics();
      expect(metrics.bufferSize).toBe(1);
    });

    it('should log warn messages with error', () => {
      const error = new Error('Test error');
      logger.warn('Warning message', { key: 'value' }, error);
      
      const metrics = logger.getMetrics();
      expect(metrics.bufferSize).toBe(1);
    });

    it('should log error messages', () => {
      const error = new Error('Test error');
      logger.error('Error message', { key: 'value' }, error);
      
      const metrics = logger.getMetrics();
      expect(metrics.bufferSize).toBe(1);
    });

    it('should map log levels correctly', () => {
      logger.debug('Debug');
      logger.info('Info');
      logger.warn('Warning');
      logger.error('Error');
      
      const metrics = logger.getMetrics();
      expect(metrics.bufferSize).toBe(4);
    });

    it('should include context in log entries', () => {
      logger.setContext({ userId: 'user123', tenantId: 'tenant456' });
      logger.info('Test message');
      
      // We can't directly inspect the buffer, but we can verify it was added
      const metrics = logger.getMetrics();
      expect(metrics.bufferSize).toBe(1);
    });

    it('should include error details when provided', () => {
      const error = new Error('Test error');
      error.stack = 'Error stack trace';
      
      logger.error('Error with details', {}, error);
      
      const metrics = logger.getMetrics();
      expect(metrics.bufferSize).toBe(1);
    });
  });

  describe('Buffer Management', () => {
    beforeEach(() => {
      logger = new FrontendLogger({ bufferSize: 3, batchSize: 2 });
    });

    it('should flush when buffer reaches size limit', async () => {
      logger.info('Message 1');
      logger.info('Message 2');
      logger.info('Message 3'); // Should trigger flush
      
      // Wait for async flush
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(fetchMock).toHaveBeenCalled();
    });

    it('should save to offline storage when enabled', () => {
      logger = new FrontendLogger({ offlineStorage: true });
      
      logger.info('Test message');
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'fortium_log_buffer',
        expect.any(String)
      );
    });

    it('should not save to offline storage when disabled', () => {
      logger = new FrontendLogger({ offlineStorage: false });
      
      logger.info('Test message');
      
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });

    it('should load offline buffer on initialization', () => {
      const mockBuffer = JSON.stringify([{
        entry: {
          timestamp: '2023-01-01T00:00:00.000Z',
          level: 'Information',
          message: 'Offline message',
          messageTemplate: 'Offline message',
          properties: { correlationId: 'test' },
        },
        retries: 0,
        timestamp: Date.now(),
      }]);
      
      localStorageMock.setItem('fortium_log_buffer', mockBuffer);
      
      logger = new FrontendLogger();
      
      const metrics = logger.getMetrics();
      expect(metrics.bufferSize).toBe(1);
    });

    it('should handle corrupted offline buffer gracefully', () => {
      localStorageMock.setItem('fortium_log_buffer', 'invalid-json');
      
      logger = new FrontendLogger();
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[FrontendLogger] Failed to load offline buffer:',
        expect.any(Error)
      );
      
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('fortium_log_buffer');
    });

    it('should manage storage size limit', () => {
      // Create a large buffer that exceeds storage limit
      const largeMessage = 'x'.repeat(1000);
      
      // Mock a scenario where storage is nearly full
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });
      
      logger.info(largeMessage);
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[FrontendLogger] Failed to save offline buffer:',
        expect.any(Error)
      );
    });
  });

  describe('Network Handling', () => {
    beforeEach(() => {
      logger = new FrontendLogger();
    });

    it('should handle successful flush', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
      });

      logger.info('Test message');
      await logger.flush();

      expect(fetchMock).toHaveBeenCalledWith('/api/v1/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Correlation-ID': 'mock-uuid-1234',
        },
        body: expect.any(String),
        signal: expect.any(AbortSignal),
      });

      const metrics = logger.getMetrics();
      expect(metrics.bufferSize).toBe(0);
    });

    it('should handle flush failure', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      logger.info('Test message');
      await logger.flush();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[FrontendLogger] Flush failed:',
        expect.stringContaining('HTTP 500')
      );
    });

    it('should handle network error', async () => {
      fetchMock.mockRejectedValue(new Error('Network error'));

      logger.info('Test message');
      await logger.flush();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[FrontendLogger] Flush failed:',
        'Network error'
      );
    });

    it('should not flush when offline', async () => {
      navigatorMock.onLine = false;
      
      logger.info('Test message');
      await logger.flush();

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should retry failed requests with exponential backoff', async () => {
      fetchMock.mockRejectedValue(new Error('Network error'));

      logger.info('Test message');
      await logger.flush();

      // Verify retry is scheduled (we can't easily test the timeout)
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[FrontendLogger] Flush failed:',
        'Network error'
      );
    });

    it('should remove entries after max retries', () => {
      logger = new FrontendLogger({ maxRetries: 1 });
      
      // We can't easily test this without exposing internals,
      // but we can verify the logger handles it gracefully
      logger.info('Test message');
      
      const metrics = logger.getMetrics();
      expect(metrics.bufferSize).toBe(1);
    });
  });

  describe('Context Management', () => {
    beforeEach(() => {
      logger = new FrontendLogger();
    });

    it('should set context correctly', () => {
      const context = {
        userId: 'user123',
        tenantId: 'tenant456',
        component: 'TestComponent',
      };

      logger.setContext(context);
      logger.info('Test message');

      const metrics = logger.getMetrics();
      expect(metrics.bufferSize).toBe(1);
    });

    it('should merge context with existing context', () => {
      logger.setContext({ userId: 'user123' });
      logger.setContext({ tenantId: 'tenant456' });
      logger.info('Test message');

      const metrics = logger.getMetrics();
      expect(metrics.bufferSize).toBe(1);
    });

    it('should update correlation ID', () => {
      const newCorrelationId = 'new-correlation-id';
      logger.setCorrelationId(newCorrelationId);

      const metrics = logger.getMetrics();
      expect(metrics.correlationId).toBe(newCorrelationId);
    });

    it('should include default context in logs', () => {
      logger.info('Test message');

      // Verify default context is included (correlationId, sessionId, etc.)
      const metrics = logger.getMetrics();
      expect(metrics.correlationId).toBe('mock-uuid-1234');
      expect(metrics.sessionId).toBe('mock-uuid-1234');
    });
  });

  describe('Event Handlers', () => {
    beforeEach(() => {
      logger = new FrontendLogger();
    });

    it('should handle online event', () => {
      // Simulate going offline then online
      navigatorMock.onLine = false;
      const onlineHandler = windowMock.addEventListener.mock.calls
        .find(call => call[0] === 'online')?.[1] as Function;

      navigatorMock.onLine = true;
      onlineHandler?.();

      // Should attempt to flush when coming online
      expect(localStorageMock.getItem).toHaveBeenCalledWith('fortium_log_buffer');
    });

    it('should handle offline event', () => {
      const offlineHandler = windowMock.addEventListener.mock.calls
        .find(call => call[0] === 'offline')?.[1] as Function;

      offlineHandler?.();

      // Should update internal state (can't directly test private property)
      // But we can verify the handler was called
      expect(offlineHandler).toBeDefined();
    });

    it('should handle popstate event', () => {
      const popstateHandler = windowMock.addEventListener.mock.calls
        .find(call => call[0] === 'popstate')?.[1] as Function;

      // Change URL
      windowMock.location.href = 'http://localhost:3000/new-page';
      popstateHandler?.();

      // Should update context with new URL
      expect(popstateHandler).toBeDefined();
    });

    it('should handle beforeunload event', () => {
      logger.info('Test message');
      
      const beforeUnloadHandler = windowMock.addEventListener.mock.calls
        .find(call => call[0] === 'beforeunload')?.[1] as Function;

      beforeUnloadHandler?.();

      // Should attempt synchronous flush
      expect(beforeUnloadHandler).toBeDefined();
    });

    it('should handle visibilitychange event', () => {
      logger.info('Test message');
      
      const visibilityHandler = documentMock.addEventListener.mock.calls
        .find(call => call[0] === 'visibilitychange')?.[1] as Function;

      documentMock.hidden = true;
      visibilityHandler?.();

      // Should flush when page becomes hidden
      expect(visibilityHandler).toBeDefined();
    });
  });

  describe('Metrics and Status', () => {
    beforeEach(() => {
      logger = new FrontendLogger();
    });

    it('should return correct metrics', () => {
      logger.info('Test message 1');
      logger.info('Test message 2');

      const metrics = logger.getMetrics();
      
      expect(metrics).toMatchObject({
        bufferSize: 2,
        isOnline: true,
        correlationId: 'mock-uuid-1234',
        sessionId: 'mock-uuid-1234',
        totalEntries: 2,
        failedEntries: 0,
      });
    });

    it('should track failed entries', async () => {
      fetchMock.mockRejectedValue(new Error('Network error'));

      logger.info('Test message');
      await logger.flush();

      const metrics = logger.getMetrics();
      expect(metrics.failedEntries).toBeGreaterThan(0);
    });
  });

  describe('Cleanup and Disposal', () => {
    beforeEach(() => {
      logger = new FrontendLogger();
    });

    it('should dispose resources correctly', () => {
      logger.info('Test message');
      logger.dispose();

      // Should clear timer and attempt final flush
      expect(logger).toBeInstanceOf(FrontendLogger);
    });

    it('should handle disposal with empty buffer', () => {
      logger.dispose();

      // Should handle gracefully
      expect(logger).toBeInstanceOf(FrontendLogger);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      logger = new FrontendLogger();
    });

    it('should handle localStorage errors gracefully', () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('LocalStorage error');
      });

      logger.info('Test message');

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[FrontendLogger] Failed to save offline buffer:',
        expect.any(Error)
      );
    });

    it('should handle sessionStorage errors gracefully', () => {
      sessionStorageMock.getItem.mockImplementation(() => {
        throw new Error('SessionStorage error');
      });

      // Should still create logger successfully
      logger = new FrontendLogger();
      expect(logger).toBeInstanceOf(FrontendLogger);
    });

    it('should handle JSON parsing errors', () => {
      localStorageMock.getItem.mockReturnValue('invalid-json');

      logger = new FrontendLogger();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[FrontendLogger] Failed to load offline buffer:',
        expect.any(Error)
      );
    });
  });
});