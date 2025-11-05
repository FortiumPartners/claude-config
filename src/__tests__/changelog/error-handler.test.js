/**
 * @fileoverview Tests for ErrorHandler class
 * @module tests/changelog/error-handler
 */

const { ErrorHandler } = require('../../changelog/error-handler');

describe('ErrorHandler', () => {
  let errorHandler;

  beforeEach(() => {
    errorHandler = new ErrorHandler();
  });

  describe('Constructor', () => {
    test('should initialize with default options', () => {
      expect(errorHandler).toBeInstanceOf(ErrorHandler);
    });
  });

  describe('handleNetworkError()', () => {
    test('should handle connection refused error', () => {
      const error = new Error('Connection refused');
      error.code = 'ECONNREFUSED';

      const result = errorHandler.handleNetworkError(error);

      expect(result.message).toContain('Unable to connect');
      expect(result.suggestion).toContain('network connection');
      expect(result.fallbackAvailable).toBe(true);
    });

    test('should handle timeout error', () => {
      const error = new Error('Timeout');
      error.code = 'ETIMEDOUT';

      const result = errorHandler.handleNetworkError(error);

      expect(result.message).toContain('timeout');
      expect(result.suggestion).toContain('Try again');
      expect(result.fallbackAvailable).toBe(true);
    });

    test('should handle DNS error', () => {
      const error = new Error('DNS lookup failed');
      error.code = 'ENOTFOUND';

      const result = errorHandler.handleNetworkError(error);

      expect(result.message).toContain('DNS');
      expect(result.suggestion).toContain('URL');
    });

    test('should handle HTTP 404 error', () => {
      const error = new Error('HTTP 404');
      error.statusCode = 404;

      const result = errorHandler.handleNetworkError(error);

      expect(result.message).toContain('404');
      expect(result.suggestion).toContain('version');
    });

    test('should handle HTTP 500 error', () => {
      const error = new Error('HTTP 500');
      error.statusCode = 500;

      const result = errorHandler.handleNetworkError(error);

      expect(result.message).toContain('server error');
      expect(result.suggestion).toContain('Try again later');
      expect(result.fallbackAvailable).toBe(true);
    });

    test('should handle generic network error', () => {
      const error = new Error('Unknown network error');

      const result = errorHandler.handleNetworkError(error);

      expect(result.message).toBeDefined();
      expect(result.suggestion).toBeDefined();
    });
  });

  describe('handleParsingError()', () => {
    test('should handle missing version error', () => {
      const error = new Error('Missing version');

      const result = errorHandler.handleParsingError(error, null);

      expect(result.message).toContain('parse');
      expect(result.suggestion).toContain('refresh');
      expect(result.partialResults).toBe(false);
    });

    test('should handle parsing error with partial results', () => {
      const error = new Error('Incomplete parsing');
      const partialData = {
        version: '3.5.0',
        features: [{ id: 'f1', title: 'Feature 1' }]
      };

      const result = errorHandler.handleParsingError(error, partialData);

      expect(result.message).toContain('partial');
      expect(result.partialResults).toBe(true);
      expect(result.data).toEqual(partialData);
    });

    test('should suggest cache fallback for parsing errors', () => {
      const error = new Error('Parse failed');

      const result = errorHandler.handleParsingError(error, null);

      expect(result.suggestion).toContain('cache');
    });
  });

  describe('handleValidationError()', () => {
    test('should handle version validation error', () => {
      const errors = ['Invalid version format. Expected format: X.Y.Z'];

      const result = errorHandler.handleValidationError(errors);

      expect(result.message).toMatch(/validation/i);
      expect(result.suggestion).toContain('3.5.0');
    });

    test('should handle date validation error', () => {
      const errors = ['Invalid since format'];

      const result = errorHandler.handleValidationError(errors);

      expect(result.message).toMatch(/validation/i);
      expect(result.suggestion).toContain('7d');
    });

    test('should handle multiple validation errors', () => {
      const errors = [
        'Invalid version format',
        'Invalid date format',
        'Invalid category'
      ];

      const result = errorHandler.handleValidationError(errors);

      expect(result.message).toContain('3 errors');
      expect(result.suggestion).toContain('--help');
    });
  });

  describe('handleCacheError()', () => {
    test('should handle cache read error', () => {
      const error = new Error('Permission denied');
      error.code = 'EACCES';

      const result = errorHandler.handleCacheError(error, 'read');

      expect(result.message).toMatch(/cache/i);
      expect(result.message).toContain('Permission denied');
      expect(result.suggestion).toContain('permissions');
    });

    test('should handle cache write error', () => {
      const error = new Error('No space left');
      error.code = 'ENOSPC';

      const result = errorHandler.handleCacheError(error, 'write');

      expect(result.message).toMatch(/cache/i);
      expect(result.suggestion).toContain('disk space');
    });

    test('should not fail workflow on cache errors', () => {
      const error = new Error('Cache error');

      const result = errorHandler.handleCacheError(error, 'read');

      expect(result.critical).toBe(false);
    });
  });

  describe('formatErrorMessage()', () => {
    test('should format error with message and suggestion', () => {
      const errorInfo = {
        message: 'Network connection failed',
        suggestion: 'Check your internet connection'
      };

      const formatted = errorHandler.formatErrorMessage(errorInfo);

      expect(formatted).toContain('ERROR:');
      expect(formatted).toContain('Network connection failed');
      expect(formatted).toContain('SUGGESTION:');
      expect(formatted).toContain('Check your internet connection');
    });

    test('should format error with partial results', () => {
      const errorInfo = {
        message: 'Parsing incomplete',
        suggestion: 'Using partial results',
        partialResults: true,
        data: { version: '3.5.0' }
      };

      const formatted = errorHandler.formatErrorMessage(errorInfo);

      expect(formatted).toContain('WARNING:');
      expect(formatted).toContain('partial results');
    });

    test('should format error with fallback available', () => {
      const errorInfo = {
        message: 'Network failed',
        suggestion: 'Using cache',
        fallbackAvailable: true
      };

      const formatted = errorHandler.formatErrorMessage(errorInfo);

      expect(formatted).toContain('Cache fallback available');
    });
  });

  describe('shouldUseFallback()', () => {
    test('should recommend fallback for network errors', () => {
      const error = new Error('Connection failed');
      error.code = 'ECONNREFUSED';

      const result = errorHandler.shouldUseFallback(error);

      expect(result).toBe(true);
    });

    test('should recommend fallback for timeout', () => {
      const error = new Error('Timeout');
      error.code = 'ETIMEDOUT';

      const result = errorHandler.shouldUseFallback(error);

      expect(result).toBe(true);
    });

    test('should not recommend fallback for validation errors', () => {
      const error = new Error('Invalid version');

      const result = errorHandler.shouldUseFallback(error);

      expect(result).toBe(false);
    });
  });

  describe('getRecoveryActions()', () => {
    test('should provide recovery actions for network error', () => {
      const error = new Error('Network failed');
      error.code = 'ECONNREFUSED';

      const actions = errorHandler.getRecoveryActions(error);

      expect(actions).toBeInstanceOf(Array);
      expect(actions.length).toBeGreaterThan(0);
      expect(actions).toContain('Check network connection');
    });

    test('should provide recovery actions for parsing error', () => {
      const error = new Error('Parse failed');

      const actions = errorHandler.getRecoveryActions(error);

      expect(actions).toContain('Try --refresh to fetch fresh data');
    });

    test('should provide recovery actions for timeout', () => {
      const error = new Error('Timeout');
      error.code = 'ETIMEDOUT';

      const actions = errorHandler.getRecoveryActions(error);

      expect(actions).toContain('Retry the command');
      expect(actions).toContain('Check if cached version is available');
    });
  });

  describe('Edge Cases', () => {
    test('should handle null error', () => {
      const result = errorHandler.handleNetworkError(null);

      expect(result.message).toBeDefined();
    });

    test('should handle error without code', () => {
      const error = new Error('Generic error');

      const result = errorHandler.handleNetworkError(error);

      expect(result.message).toBeDefined();
      expect(result.suggestion).toBeDefined();
    });

    test('should handle empty validation errors', () => {
      const result = errorHandler.handleValidationError([]);

      expect(result.message).toBeDefined();
    });
  });
});
