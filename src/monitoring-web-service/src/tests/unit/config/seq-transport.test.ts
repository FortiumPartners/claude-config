/**
 * Unit Tests for SeqTransport
 * Fortium Monitoring Web Service - Seq Integration Sprint 1
 * Task 1.1: SeqTransport Test Suite
 */

import { SeqTransport, createSeqTransport, seqTransportConfig } from '../../../config/seq-transport';
import { Logger } from 'seq-logging';

// Mock seq-logging
jest.mock('seq-logging');

describe('SeqTransport', () => {
  let transport: SeqTransport;
  let mockSeqLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Mock Logger constructor
    mockSeqLogger = {
      emit: jest.fn(),
    } as any;
    
    (Logger as jest.MockedClass<typeof Logger>).mockImplementation(() => mockSeqLogger);
    
    // Create transport instance
    transport = new SeqTransport({
      serverUrl: 'http://test-seq:5341',
      maxBatchingSize: 10,
      batchingDelay: 1000,
      requestTimeout: 5000,
    });
  });

  afterEach(() => {
    if (transport) {
      transport.close();
    }
  });

  describe('Construction and Configuration', () => {
    it('should create SeqTransport with default options', () => {
      const defaultTransport = new SeqTransport();
      expect(defaultTransport).toBeInstanceOf(SeqTransport);
      
      const metrics = defaultTransport.getMetrics();
      expect(metrics.totalLogs).toBe(0);
      expect(metrics.circuitBreakerOpen).toBe(false);
      
      defaultTransport.close();
    });

    it('should create SeqTransport with custom options', () => {
      const customTransport = new SeqTransport({
        serverUrl: 'https://custom-seq.com',
        apiKey: 'test-api-key',
        maxBatchingSize: 50,
        batchingDelay: 2000,
      });

      expect(customTransport).toBeInstanceOf(SeqTransport);
      
      // Verify Logger was called with correct options
      expect(Logger).toHaveBeenCalledWith({
        serverUrl: 'https://custom-seq.com',
        apiKey: 'test-api-key',
        maxBatchingSize: 50,
        batchingDelay: 2000,
        requestTimeout: 10000,
        onError: expect.any(Function),
      });
      
      customTransport.close();
    });

    it('should use factory function to create transport', () => {
      const factoryTransport = createSeqTransport({
        serverUrl: 'http://factory-seq:5341',
      });
      
      expect(factoryTransport).toBeInstanceOf(SeqTransport);
      factoryTransport.close();
    });
  });

  describe('Log Processing', () => {
    it('should process log entries correctly', (done) => {
      const logInfo = {
        level: 'info',
        message: 'Test log message',
        timestamp: '2025-09-10T15:30:00.000Z',
        userId: 'user123',
        tenantId: 'tenant456',
      };

      transport.log(logInfo, () => {
        const metrics = transport.getMetrics();
        expect(metrics.totalLogs).toBe(1);
        done();
      });
    });

    it('should convert Winston format to Seq format correctly', (done) => {
      const logInfo = {
        level: 'error',
        message: 'Error occurred in user action {Action}',
        timestamp: '2025-09-10T15:30:00.000Z',
        userId: 'user123',
        Action: 'login',
        service: 'auth-service', // Should be filtered out
      };

      // Mock flush to capture converted entry
      const originalFlush = (transport as any).flush.bind(transport);
      (transport as any).flush = jest.fn().mockImplementation(async () => {
        const buffer = (transport as any).logBuffer;
        expect(buffer).toHaveLength(1);
        
        const seqEntry = buffer[0].entry;
        expect(seqEntry).toEqual({
          '@t': '2025-09-10T15:30:00.000Z',
          '@l': 'Error',
          '@m': 'Error occurred in user action {Action}',
          '@mt': 'Error occurred in user action {Action}',
          userId: 'user123',
          Action: 'login',
        });
        
        // Restore original flush
        (transport as any).flush = originalFlush;
        done();
      });

      transport.log(logInfo, () => {
        // Trigger flush
        (transport as any).flush();
      });
    });

    it('should map log levels correctly', () => {
      const testCases = [
        { winston: 'error', seq: 'Error' },
        { winston: 'warn', seq: 'Warning' },
        { winston: 'info', seq: 'Information' },
        { winston: 'debug', seq: 'Debug' },
        { winston: 'unknown', seq: 'Information' },
      ];

      testCases.forEach(({ winston, seq }) => {
        const result = (transport as any).mapLogLevel(winston);
        expect(result).toBe(seq);
      });
    });
  });

  describe('Batch Processing', () => {
    it('should buffer logs until batch size reached', async () => {
      const batchSize = 3;
      const smallTransport = new SeqTransport({
        maxBatchingSize: batchSize,
        batchingDelay: 5000, // Long delay to test batch size trigger
      });

      const flushSpy = jest.spyOn(smallTransport as any, 'flush').mockImplementation(() => Promise.resolve());

      // Add logs one by one
      for (let i = 0; i < batchSize - 1; i++) {
        smallTransport.log({ level: 'info', message: `Log ${i}` }, () => {});
      }

      // Flush should not have been called yet
      expect(flushSpy).not.toHaveBeenCalled();

      // Add one more log to trigger flush
      smallTransport.log({ level: 'info', message: `Log ${batchSize - 1}` }, () => {});

      // Flush should now be called
      expect(flushSpy).toHaveBeenCalled();
      
      smallTransport.close();
    });

    it('should flush logs after delay interval', (done) => {
      const quickTransport = new SeqTransport({
        maxBatchingSize: 100, // Large batch size
        batchingDelay: 100, // Quick flush
      });

      const flushSpy = jest.spyOn(quickTransport as any, 'flush').mockImplementation(() => Promise.resolve());

      quickTransport.log({ level: 'info', message: 'Test log' }, () => {});

      // Wait for flush interval
      setTimeout(() => {
        expect(flushSpy).toHaveBeenCalled();
        quickTransport.close();
        done();
      }, 150);
    });
  });

  describe('Circuit Breaker', () => {
    it('should open circuit breaker after repeated failures', async () => {
      const failingTransport = new SeqTransport({
        maxBatchingSize: 1,
        batchingDelay: 100,
        onError: jest.fn(),
      });

      // Mock Seq logger to fail
      const mockEmit = jest.fn().mockRejectedValue(new Error('Seq server down'));
      (failingTransport as any).seqLogger.emit = mockEmit;

      // Trigger failures
      for (let i = 0; i < 5; i++) {
        (failingTransport as any).handleSeqError(new Error('Test failure'));
      }

      const metrics = failingTransport.getMetrics();
      expect(metrics.circuitBreakerOpen).toBe(true);
      
      failingTransport.close();
    });

    it('should handle logs via fallback when circuit breaker is open', (done) => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      // Open circuit breaker manually
      (transport as any).circuitBreaker.isOpen = true;

      transport.log({ level: 'info', message: 'Test with circuit open' }, () => {
        expect(consoleSpy).toHaveBeenCalledWith(
          '[SeqTransport] Circuit breaker open, falling back to console:',
          'Test with circuit open'
        );
        
        const metrics = transport.getMetrics();
        expect(metrics.failedLogs).toBe(1);
        
        consoleSpy.mockRestore();
        done();
      });
    });

    it('should close circuit breaker after successful operations', () => {
      // Open circuit breaker
      (transport as any).circuitBreaker.isOpen = true;
      (transport as any).circuitBreaker.failureCount = 5;

      // Simulate successful operations
      for (let i = 0; i < 3; i++) {
        (transport as any).handleCircuitBreakerSuccess();
      }

      const isOpen = (transport as any).isCircuitBreakerOpen();
      expect(isOpen).toBe(false);
    });
  });

  describe('Performance Metrics', () => {
    it('should track performance metrics correctly', () => {
      const initialMetrics = transport.getMetrics();
      expect(initialMetrics.totalLogs).toBe(0);
      expect(initialMetrics.successfulLogs).toBe(0);
      expect(initialMetrics.failedLogs).toBe(0);

      // Add some logs
      transport.log({ level: 'info', message: 'Log 1' }, () => {});
      transport.log({ level: 'error', message: 'Log 2' }, () => {});

      const updatedMetrics = transport.getMetrics();
      expect(updatedMetrics.totalLogs).toBe(2);
      expect(updatedMetrics.bufferSize).toBe(2);
    });

    it('should update average latency correctly', () => {
      // Test latency calculation
      (transport as any).updatePerformanceMetrics(1, 100, true);
      expect(transport.getMetrics().averageLatency).toBe(20); // 0 * 0.8 + 100 * 0.2

      (transport as any).updatePerformanceMetrics(1, 200, true);
      expect(transport.getMetrics().averageLatency).toBe(56); // 20 * 0.8 + 200 * 0.2
    });
  });

  describe('Health Check', () => {
    it('should return unhealthy when circuit breaker is open', async () => {
      // Open circuit breaker
      (transport as any).circuitBreaker.isOpen = true;

      const health = await transport.healthCheck();
      expect(health.status).toBe('unhealthy');
      expect(health.error).toBe('Circuit breaker open');
    });

    it('should return healthy for fast responses', async () => {
      // Mock successful quick response
      const mockSendToSeq = jest.spyOn(transport as any, 'sendToSeq')
        .mockResolvedValue(undefined);

      const health = await transport.healthCheck();
      expect(health.status).toBe('healthy');
      expect(health.latency).toBeDefined();
      expect(health.latency).toBeLessThan(100);

      mockSendToSeq.mockRestore();
    });

    it('should return degraded for slow responses', async () => {
      // Mock slow response
      const mockSendToSeq = jest.spyOn(transport as any, 'sendToSeq')
        .mockImplementation(() => new Promise(resolve => setTimeout(resolve, 150)));

      const health = await transport.healthCheck();
      expect(health.status).toBe('degraded');
      expect(health.latency).toBeGreaterThan(100);

      mockSendToSeq.mockRestore();
    });

    it('should return unhealthy on error', async () => {
      // Mock error response
      const mockSendToSeq = jest.spyOn(transport as any, 'sendToSeq')
        .mockRejectedValue(new Error('Connection failed'));

      const health = await transport.healthCheck();
      expect(health.status).toBe('unhealthy');
      expect(health.error).toBe('Connection failed');

      mockSendToSeq.mockRestore();
    });
  });

  describe('Configuration Presets', () => {
    it('should provide development configuration', () => {
      const devConfig = seqTransportConfig.development;
      expect(devConfig.serverUrl).toBe('http://localhost:5341');
      expect(devConfig.maxBatchingSize).toBe(50);
      expect(devConfig.batchingDelay).toBe(5000);
      expect(devConfig.compact).toBe(false);
    });

    it('should provide production configuration', () => {
      const prodConfig = seqTransportConfig.production;
      expect(prodConfig.maxBatchingSize).toBe(100);
      expect(prodConfig.batchingDelay).toBe(30000);
      expect(prodConfig.compact).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle log processing errors gracefully', (done) => {
      const errorTransport = new SeqTransport({
        onError: jest.fn(),
      });

      // Force an error in convertToSeqFormat by passing invalid input
      const originalConvert = (errorTransport as any).convertToSeqFormat;
      (errorTransport as any).convertToSeqFormat = jest.fn().mockImplementation(() => {
        throw new Error('Conversion error');
      });

      errorTransport.log({ level: 'info', message: 'Test' }, () => {
        const metrics = errorTransport.getMetrics();
        expect(metrics.failedLogs).toBe(1);
        
        // Restore original method
        (errorTransport as any).convertToSeqFormat = originalConvert;
        errorTransport.close();
        done();
      });
    });

    it('should use default error handler when none provided', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const defaultTransport = new SeqTransport();
      const defaultHandler = (defaultTransport as any).options.onError;
      
      defaultHandler(new Error('Test error'));
      expect(consoleErrorSpy).toHaveBeenCalledWith('[SeqTransport] Error:', 'Test error');
      
      consoleErrorSpy.mockRestore();
      defaultTransport.close();
    });
  });

  describe('Cleanup', () => {
    it('should clean up resources on close', () => {
      const flushSpy = jest.spyOn(transport as any, 'flush').mockImplementation(() => Promise.resolve());
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      transport.close();

      expect(flushSpy).toHaveBeenCalled();
      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it('should flush on process exit', () => {
      const flushSpy = jest.spyOn(transport as any, 'flush').mockImplementation(() => Promise.resolve());
      
      // Simulate process beforeExit event
      process.emit('beforeExit', 0);

      expect(flushSpy).toHaveBeenCalled();
    });
  });
});

describe('Performance Benchmarks', () => {
  it('should meet performance target of <5ms per log entry', async () => {
    const performanceTransport = new SeqTransport({
      maxBatchingSize: 1, // Force immediate processing
      batchingDelay: 1,
    });

    const iterations = 100;
    const startTime = Date.now();

    // Process multiple log entries
    const promises: Promise<void>[] = [];
    for (let i = 0; i < iterations; i++) {
      promises.push(new Promise<void>((resolve) => {
        performanceTransport.log({
          level: 'info',
          message: `Performance test log ${i}`,
          userId: `user${i}`,
          timestamp: new Date().toISOString(),
        }, resolve);
      }));
    }

    await Promise.all(promises);
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    const averageTime = totalTime / iterations;

    expect(averageTime).toBeLessThan(5); // Should be less than 5ms per log entry

    performanceTransport.close();
  });

  it('should handle high-throughput logging', async () => {
    const throughputTransport = new SeqTransport({
      maxBatchingSize: 100,
      batchingDelay: 1000,
    });

    const logCount = 1000;
    const startTime = Date.now();

    // Generate high volume of logs
    const promises: Promise<void>[] = [];
    for (let i = 0; i < logCount; i++) {
      promises.push(new Promise<void>((resolve) => {
        throughputTransport.log({
          level: 'info',
          message: `High throughput test log ${i}`,
          batchId: Math.floor(i / 100),
        }, resolve);
      }));
    }

    await Promise.all(promises);

    const endTime = Date.now();
    const totalTime = endTime - startTime;
    const logsPerSecond = (logCount / totalTime) * 1000;

    // Should handle at least 1000 logs per second
    expect(logsPerSecond).toBeGreaterThan(1000);

    const metrics = throughputTransport.getMetrics();
    expect(metrics.totalLogs).toBe(logCount);

    throughputTransport.close();
  });
});