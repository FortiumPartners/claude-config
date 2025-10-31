/**
 * Jest Setup File
 * Global configuration and utilities for tests
 */

// Extend Jest matchers with custom assertions
expect.extend({
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },

  toBeWithinPercentage(received, expected, percentage) {
    const lowerBound = expected * (1 - percentage / 100);
    const upperBound = expected * (1 + percentage / 100);
    const pass = received >= lowerBound && received <= upperBound;

    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within ${percentage}% of ${expected}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be within ${percentage}% of ${expected} (${lowerBound} - ${upperBound})`,
        pass: false,
      };
    }
  },
});

// Performance testing utilities
global.measurePerformance = async (fn, label = 'Operation') => {
  const { performance } = require('perf_hooks');
  const startMemory = process.memoryUsage().heapUsed;
  const startTime = performance.now();

  const result = await fn();

  const endTime = performance.now();
  const endMemory = process.memoryUsage().heapUsed;

  return {
    result,
    duration: endTime - startTime,
    memoryUsed: (endMemory - startMemory) / 1024 / 1024, // MB
    label
  };
};

// Console output capture for testing
global.captureConsole = () => {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  const logs = [];
  const errors = [];
  const warnings = [];

  console.log = (...args) => {
    logs.push(args.join(' '));
  };

  console.error = (...args) => {
    errors.push(args.join(' '));
  };

  console.warn = (...args) => {
    warnings.push(args.join(' '));
  };

  return {
    getLogs: () => logs,
    getErrors: () => errors,
    getWarnings: () => warnings,
    restore: () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
    }
  };
};

// Suppress console output during tests (except when DEBUG=true)
if (!process.env.DEBUG) {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    // Keep error for actual issues
  };
}

// Global test timeout warning
const originalTimeout = setTimeout;
global.setTimeout = (callback, delay, ...args) => {
  if (delay > 5000 && !process.env.CI) {
    console.warn(`Warning: setTimeout with delay > 5s: ${delay}ms`);
  }
  return originalTimeout(callback, delay, ...args);
};

// Cleanup after each test
afterEach(() => {
  // Clear all timers
  jest.clearAllTimers();

  // Force garbage collection if available (run tests with --expose-gc)
  if (global.gc) {
    global.gc();
  }
});
