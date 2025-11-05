/**
 * @fileoverview ErrorHandler class for comprehensive error handling
 * @module changelog/error-handler
 */

/**
 * Comprehensive error handler for changelog command
 */
class ErrorHandler {
  constructor() {
    // Network error codes that support fallback
    this.fallbackErrorCodes = [
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'EHOSTUNREACH',
      'ENETUNREACH'
    ];

    // HTTP status codes that support fallback
    this.fallbackStatusCodes = [500, 502, 503, 504];
  }

  /**
   * Handle network errors with intelligent fallback suggestions
   * @param {Error} error - Network error
   * @returns {Object} Error information with suggestions
   */
  handleNetworkError(error) {
    if (!error) {
      return {
        message: 'Unknown network error occurred',
        suggestion: 'Try the command again',
        fallbackAvailable: false
      };
    }

    const result = {
      message: '',
      suggestion: '',
      fallbackAvailable: false
    };

    // Handle specific error codes
    if (error.code === 'ECONNREFUSED') {
      result.message = 'Unable to connect to Anthropic documentation server';
      result.suggestion = 'Check your network connection or try again later';
      result.fallbackAvailable = true;
    } else if (error.code === 'ETIMEDOUT') {
      result.message = 'Request timeout - server took too long to respond';
      result.suggestion = 'Try again or use cached version';
      result.fallbackAvailable = true;
    } else if (error.code === 'ENOTFOUND') {
      result.message = 'DNS lookup failed - could not resolve hostname';
      result.suggestion = 'Check the URL or your DNS settings';
      result.fallbackAvailable = true;
    } else if (error.statusCode === 404) {
      result.message = 'Changelog not found (HTTP 404)';
      result.suggestion = 'The requested version may not exist. Try without --version flag';
      result.fallbackAvailable = false;
    } else if (error.statusCode === 403) {
      result.message = 'Access forbidden (HTTP 403)';
      result.suggestion = 'You may not have permission to access this resource';
      result.fallbackAvailable = false;
    } else if (this.fallbackStatusCodes.includes(error.statusCode)) {
      result.message = `Anthropic server error (HTTP ${error.statusCode})`;
      result.suggestion = 'Try again later or use cached version';
      result.fallbackAvailable = true;
    } else {
      result.message = `Network error: ${error.message}`;
      result.suggestion = 'Check your connection and try again';
      result.fallbackAvailable = true;
    }

    return result;
  }

  /**
   * Handle parsing errors with partial result support
   * @param {Error} error - Parsing error
   * @param {Object|null} partialData - Partially parsed data
   * @returns {Object} Error information
   */
  handleParsingError(error, partialData) {
    const result = {
      message: '',
      suggestion: '',
      partialResults: false,
      data: null
    };

    if (partialData && partialData.version) {
      result.message = `Parsing partially succeeded for version ${partialData.version}`;
      result.suggestion = 'Displaying partial results. Use --refresh to try fetching again';
      result.partialResults = true;
      result.data = partialData;
    } else {
      result.message = `Failed to parse changelog: ${error.message}`;
      result.suggestion = 'Try --refresh to fetch fresh data or check cache';
      result.partialResults = false;
    }

    return result;
  }

  /**
   * Handle validation errors with helpful suggestions
   * @param {string[]} errors - Array of validation errors
   * @returns {Object} Error information
   */
  handleValidationError(errors) {
    if (!errors || errors.length === 0) {
      return {
        message: 'Validation failed',
        suggestion: 'Use --help for usage information'
      };
    }

    const result = {
      message: '',
      suggestion: ''
    };

    // Single error
    if (errors.length === 1) {
      result.message = `Validation error: ${errors[0]}`;

      // Provide specific suggestions based on error type
      if (errors[0].includes('version')) {
        result.suggestion = 'Use format X.Y.Z (e.g., 3.5.0) or "latest"';
      } else if (errors[0].includes('since') || errors[0].includes('date')) {
        result.suggestion = 'Use YYYY-MM-DD format (e.g., 2025-10-01) or relative time (e.g., 7d, 2w, 1m)';
      } else if (errors[0].includes('category')) {
        result.suggestion = 'Valid categories: breaking, new, enhancement, performance, security, deprecation, bugfix';
      } else if (errors[0].includes('format')) {
        result.suggestion = 'Valid formats: console, json, markdown';
      } else {
        result.suggestion = 'Use --help for more information';
      }
    } else {
      // Multiple errors
      result.message = `Validation failed with ${errors.length} errors:\n${errors.map((e, i) => `  ${i + 1}. ${e}`).join('\n')}`;
      result.suggestion = 'Use --help for detailed usage information';
    }

    return result;
  }

  /**
   * Handle cache errors (non-critical)
   * @param {Error} error - Cache error
   * @param {string} operation - Operation type ('read' or 'write')
   * @returns {Object} Error information
   */
  handleCacheError(error, operation) {
    const result = {
      message: '',
      suggestion: '',
      critical: false
    };

    if (error.code === 'EACCES') {
      result.message = `Cache ${operation} failed: Permission denied`;
      result.suggestion = 'Check cache directory permissions (~/.ai-mesh/cache/changelog/)';
    } else if (error.code === 'ENOSPC') {
      result.message = `Cache ${operation} failed: No space left on device`;
      result.suggestion = 'Free up disk space or clear old cache files';
    } else if (error.code === 'ENOENT' && operation === 'read') {
      result.message = 'Cache not found - will fetch from network';
      result.suggestion = 'First run or cache expired - this is normal';
    } else {
      result.message = `Cache ${operation} error: ${error.message}`;
      result.suggestion = 'Cache unavailable - will continue without caching';
    }

    return result;
  }

  /**
   * Format error information into user-friendly message
   * @param {Object} errorInfo - Error information object
   * @returns {string} Formatted error message
   */
  formatErrorMessage(errorInfo) {
    const lines = [];

    // Determine severity
    if (errorInfo.partialResults) {
      lines.push('⚠️  WARNING:');
    } else if (errorInfo.critical === false) {
      lines.push('ℹ️  INFO:');
    } else {
      lines.push('❌ ERROR:');
    }

    lines.push('');
    lines.push(errorInfo.message);
    lines.push('');

    // Add suggestion
    if (errorInfo.suggestion) {
      lines.push('💡 SUGGESTION:');
      lines.push(errorInfo.suggestion);
      lines.push('');
    }

    // Add fallback info
    if (errorInfo.fallbackAvailable) {
      lines.push('📦 Cache fallback available - command will attempt to use cached data');
      lines.push('');
    }

    // Add partial results info
    if (errorInfo.partialResults) {
      lines.push('⚠️  Displaying partial results - some data may be incomplete');
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Determine if fallback should be used
   * @param {Error} error - Error object
   * @returns {boolean} True if fallback recommended
   */
  shouldUseFallback(error) {
    if (!error) return false;

    // Check error codes
    if (this.fallbackErrorCodes.includes(error.code)) {
      return true;
    }

    // Check status codes
    if (this.fallbackStatusCodes.includes(error.statusCode)) {
      return true;
    }

    return false;
  }

  /**
   * Get recovery actions for error
   * @param {Error} error - Error object
   * @returns {string[]} Array of recovery actions
   */
  getRecoveryActions(error) {
    const actions = [];

    if (!error) {
      return ['Retry the command'];
    }

    // Network errors
    if (this.fallbackErrorCodes.includes(error.code) || this.fallbackStatusCodes.includes(error.statusCode)) {
      actions.push('Check network connection');
      actions.push('Retry the command');
      actions.push('Check if cached version is available');
    }

    // Timeout
    if (error.code === 'ETIMEDOUT') {
      actions.push('Retry the command');
      actions.push('Check if cached version is available');
    }

    // Parsing errors
    if (error.message && error.message.toLowerCase().includes('parse')) {
      actions.push('Try --refresh to fetch fresh data');
      actions.push('Check if changelog format has changed');
    }

    // Cache errors
    if (error.code === 'EACCES') {
      actions.push('Check directory permissions');
      actions.push('Run command with appropriate permissions');
    }

    // Generic fallback
    if (actions.length === 0) {
      actions.push('Retry the command');
      actions.push('Use --help for usage information');
    }

    return actions;
  }
}

module.exports = { ErrorHandler };
