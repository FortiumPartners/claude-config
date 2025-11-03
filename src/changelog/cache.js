/**
 * Changelog Cache Manager - Manages local file-based caching of changelog data with TTL support.
 * Implements stale-while-revalidate pattern for graceful degradation.
 * @module changelog/cache
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');

/**
 * Manages local file-based caching of changelog data with TTL support.
 * Implements stale-while-revalidate pattern for graceful degradation.
 */
class CacheManager {
  /**
   * @param {Object} options - Configuration options
   * @param {string} [options.cacheDir] - Cache directory path (default: ~/.ai-mesh/cache/changelog)
   * @param {number} [options.ttl=86400000] - Time to live in milliseconds (default: 24 hours)
   */
  constructor(options = {}) {
    this.cacheDir = path.resolve(
      options.cacheDir || path.join(os.homedir(), '.ai-mesh/cache/changelog')
    );
    this.ttl = options.ttl || 24 * 60 * 60 * 1000; // 24 hours
  }

  /**
   * Retrieve cached changelog data
   * @param {string} [version='latest'] - Version identifier
   * @returns {Promise<Object|null>} - Cached data with _stale flag if expired, or null if not found
   */
  async get(version = 'latest') {
    const cacheFile = this.getCacheFilePath(version);

    try {
      const content = await fs.readFile(cacheFile, 'utf8');
      const data = JSON.parse(content);

      // Calculate age and check staleness
      const age = this.calculateAge(data.cachedAt);

      if (age > this.ttl) {
        // Stale-while-revalidate: return stale data with metadata
        data._stale = true;
        data._age = age;
      }

      return data;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null; // Cache miss
      }
      throw error; // Unexpected error
    }
  }

  /**
   * Store changelog data in cache
   * @param {string} version - Version identifier
   * @param {Object} changelogData - Changelog data to cache
   * @returns {Promise<void>}
   */
  async set(version, changelogData) {
    await this.ensureCacheDirectoryExists();

    const cacheFile = this.getCacheFilePath(version);
    const cacheData = {
      ...changelogData,
      cachedAt: new Date().toISOString(),
      ttl: this.ttl
    };

    await fs.writeFile(
      cacheFile,
      JSON.stringify(cacheData, null, 2),
      'utf8'
    );
  }

  /**
   * Invalidate cached data
   * @param {string} [version] - Specific version to invalidate, or all if omitted
   * @returns {Promise<void>}
   */
  async invalidate(version = null) {
    if (version) {
      await this.invalidateVersion(version);
    } else {
      await this.invalidateAll();
    }
  }

  /**
   * Get cache file path for version
   * @private
   */
  getCacheFilePath(version) {
    return path.join(this.cacheDir, `${version}.json`);
  }

  /**
   * Calculate age of cached data in milliseconds
   * @private
   */
  calculateAge(cachedAt) {
    return Date.now() - new Date(cachedAt).getTime();
  }

  /**
   * Ensure cache directory exists
   * @private
   */
  async ensureCacheDirectoryExists() {
    await fs.mkdir(this.cacheDir, { recursive: true });
  }

  /**
   * Invalidate specific version
   * @private
   */
  async invalidateVersion(version) {
    const cacheFile = this.getCacheFilePath(version);
    try {
      await fs.unlink(cacheFile);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  /**
   * Invalidate all cached data
   * @private
   */
  async invalidateAll() {
    try {
      await fs.rm(this.cacheDir, { recursive: true, force: true });
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
}

module.exports = { CacheManager };