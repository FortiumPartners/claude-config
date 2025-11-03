const { CacheManager } = require('../../changelog/cache.js');
const tmp = require('tmp');
const fs = require('fs').promises;
const path = require('path');

describe('CacheManager', () => {
  let cacheManager;
  let tmpDir;

  beforeEach(() => {
    tmpDir = tmp.dirSync({ unsafeCleanup: true });
    cacheManager = new CacheManager({
      cacheDir: tmpDir.name,
      ttl: 24 * 60 * 60 * 1000 // 24 hours
    });
  });

  afterEach(() => {
    tmpDir.removeCallback();
  });

  describe('Cache Operations', () => {
    test('stores and retrieves data', async () => {
      const data = {
        version: '3.5.0',
        features: [{ title: 'Test Feature' }]
      };

      await cacheManager.set('latest', data);
      const retrieved = await cacheManager.get('latest');

      expect(retrieved.version).toBe('3.5.0');
      expect(retrieved.features).toEqual([{ title: 'Test Feature' }]);
    });

    test('returns null for cache miss', async () => {
      const result = await cacheManager.get('nonexistent');
      expect(result).toBeNull();
    });

    test('adds metadata on set', async () => {
      const data = { version: '3.5.0' };
      await cacheManager.set('latest', data);
      const retrieved = await cacheManager.get('latest');

      expect(retrieved.cachedAt).toBeDefined();
      expect(retrieved.ttl).toBe(24 * 60 * 60 * 1000);
    });
  });

  describe('TTL Handling', () => {
    test('marks expired cache as stale', async () => {
      const shortTTL = new CacheManager({
        cacheDir: tmpDir.name,
        ttl: 100 // 100ms
      });

      await shortTTL.set('latest', { version: '3.5.0' });
      await new Promise(resolve => setTimeout(resolve, 150));

      const result = await shortTTL.get('latest');
      expect(result._stale).toBe(true);
      expect(result._age).toBeGreaterThan(100);
    });

    test('fresh cache has no stale flag', async () => {
      await cacheManager.set('latest', { version: '3.5.0' });
      const result = await cacheManager.get('latest');

      expect(result._stale).toBeUndefined();
      expect(result._age).toBeUndefined();
    });
  });

  describe('Cache Invalidation', () => {
    test('invalidates specific version', async () => {
      await cacheManager.set('3.5.0', { version: '3.5.0' });
      await cacheManager.set('3.4.0', { version: '3.4.0' });

      await cacheManager.invalidate('3.5.0');

      expect(await cacheManager.get('3.5.0')).toBeNull();
      expect(await cacheManager.get('3.4.0')).not.toBeNull();
    });

    test('invalidates all cache when no version specified', async () => {
      await cacheManager.set('3.5.0', { version: '3.5.0' });
      await cacheManager.set('3.4.0', { version: '3.4.0' });

      await cacheManager.invalidate();

      expect(await cacheManager.get('3.5.0')).toBeNull();
      expect(await cacheManager.get('3.4.0')).toBeNull();

      // Recreate directory for cleanup
      await fs.mkdir(tmpDir.name, { recursive: true });
    });
  });

  describe('File System Operations', () => {
    test('creates cache directory if not exists', async () => {
      const newDir = path.join(tmpDir.name, 'nested', 'cache');
      const newCache = new CacheManager({ cacheDir: newDir });

      await newCache.set('latest', { version: '3.5.0' });

      const stats = await fs.stat(newDir);
      expect(stats.isDirectory()).toBe(true);
    });

    test('handles concurrent writes', async () => {
      const writes = Array.from({ length: 10 }, (_, i) =>
        cacheManager.set(`version-${i}`, { version: `3.${i}.0` })
      );

      await Promise.all(writes);

      for (let i = 0; i < 10; i++) {
        const result = await cacheManager.get(`version-${i}`);
        expect(result.version).toBe(`3.${i}.0`);
      }
    });
  });
});
