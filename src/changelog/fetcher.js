/**
 * Changelog Fetcher - Fetches changelog data from Anthropic docs with retry logic and timeout handling.
 * Implements exponential backoff for transient failures.
 * @module changelog/fetcher
 */

const https = require('https');
const { URL } = require('url');

/**
 * Fetches changelog data from remote sources with retry logic and timeout handling.
 */
class ChangelogFetcher {
  /**
   * @param {Object} options - Configuration options
   * @param {number} [options.timeout=5000] - Request timeout in milliseconds
   * @param {number} [options.maxRetries=2] - Maximum retry attempts
   */
  constructor(options = {}) {
    this.timeout = options.timeout || 5000;
    this.maxRetries = options.maxRetries || 2;
  }

  /**
   * Fetch content from URL with retry logic
   * @param {string} url - URL to fetch
   * @param {number} [attempt=0] - Current attempt number (for internal use)
   * @returns {Promise<string>} - Response body as text
   * @throws {Error} - Network error, timeout, or HTTP error after retries exhausted
   */
  async fetch(url, attempt = 0) {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);

      const requestOptions = this.buildRequestOptions(parsedUrl);
      const req = https.request(requestOptions, (res) =>
        this.handleResponse(res, url, attempt, resolve, reject)
      );

      req.on('error', (error) =>
        this.handleError(error, url, attempt, resolve, reject)
      );

      req.on('timeout', () =>
        this.handleTimeout(req, url, attempt, resolve, reject)
      );

      req.end();
    });
  }

  /**
   * Build HTTPS request options
   * @private
   */
  buildRequestOptions(parsedUrl) {
    return {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Claude-Changelog/1.0',
        'Accept': 'text/html,application/xhtml+xml'
      },
      timeout: this.timeout
    };
  }

  /**
   * Handle HTTP response
   * @private
   */
  handleResponse(res, url, attempt, resolve, reject) {
    let data = '';

    // Always consume response body to prevent connection leaks
    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      // Check status code after response is fully received
      if (res.statusCode !== 200) {
        const error = new Error(`HTTP ${res.statusCode}`);
        error.statusCode = res.statusCode;

        this.retryOrReject(error, url, attempt, resolve, reject);
        return;
      }

      resolve(data);
    });
  }

  /**
   * Handle request error
   * @private
   */
  handleError(error, url, attempt, resolve, reject) {
    this.retryOrReject(error, url, attempt, resolve, reject);
  }

  /**
   * Handle request timeout
   * @private
   */
  handleTimeout(req, url, attempt, resolve, reject) {
    req.destroy();
    const error = new Error('Request timeout');
    error.code = 'ETIMEDOUT';

    this.retryOrReject(error, url, attempt, resolve, reject);
  }

  /**
   * Determine if error is transient and worth retrying
   * @private
   */
  isRetryableError(error) {
    // Network errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return true;
    }

    // 5xx server errors
    if (error.statusCode && error.statusCode >= 500 && error.statusCode < 600) {
      return true;
    }

    return false;
  }

  /**
   * Retry request or reject with error
   * @private
   */
  retryOrReject(error, url, attempt, resolve, reject) {
    if (attempt < this.maxRetries && this.isRetryableError(error)) {
      const delay = this.calculateBackoff(attempt);
      this.sleep(delay).then(() =>
        this.fetch(url, attempt + 1).then(resolve).catch(reject)
      );
    } else {
      reject(error);
    }
  }

  /**
   * Calculate exponential backoff delay
   * @private
   */
  calculateBackoff(attempt) {
    return Math.pow(2, attempt) * 1000; // 1s, 2s, 4s...
  }

  /**
   * Sleep helper for retry delays
   * @private
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = { ChangelogFetcher };