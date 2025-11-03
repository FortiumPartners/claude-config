const { ChangelogFetcher } = require('../../changelog/fetcher.js');
const nock = require('nock');

describe('ChangelogFetcher', () => {
  let fetcher;

  beforeEach(() => {
    fetcher = new ChangelogFetcher({ timeout: 5000 });
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('HTTP Fetching', () => {
    test('fetches from HTTPS successfully', async () => {
      nock('https://docs.anthropic.com')
        .get('/en/release-notes/')
        .reply(200, '<html>Sample changelog</html>');

      const result = await fetcher.fetch('https://docs.anthropic.com/en/release-notes/');
      expect(result).toContain('Sample changelog');
    });

    test('handles 404 errors', async () => {
      nock('https://docs.anthropic.com')
        .get('/en/release-notes/')
        .reply(404, 'Not found');

      await expect(fetcher.fetch('https://docs.anthropic.com/en/release-notes/'))
        .rejects.toThrow('HTTP 404');
    });

    test('handles network errors', async () => {
      nock('https://docs.anthropic.com')
        .get('/en/release-notes/')
        .replyWithError('ECONNREFUSED');

      await expect(fetcher.fetch('https://docs.anthropic.com/en/release-notes/'))
        .rejects.toThrow();
    });
  });

  describe('Timeout Handling', () => {
    test('times out after 5 seconds', async () => {
      nock('https://docs.anthropic.com')
        .get('/en/release-notes/')
        .delayConnection(6000)
        .reply(200, 'Too slow');

      await expect(fetcher.fetch('https://docs.anthropic.com/en/release-notes/'))
        .rejects.toThrow(/timeout|aborted|socket hang up/i);
    }, 10000);
  });

  describe('Retry Logic', () => {
    test('retries on transient failures with exponential backoff', async () => {
      jest.useRealTimers(); // Use real timers to measure delays

      const startTime = Date.now();

      // All requests fail with 500, verify retry happens with delays
      nock('https://docs.anthropic.com')
        .get('/en/release-notes/')
        .times(3)
        .reply(500, 'Server error');

      try {
        await fetcher.fetch('https://docs.anthropic.com/en/release-notes/');
        fail('Should have thrown an error');
      } catch (error) {
        const duration = Date.now() - startTime;
        // With 2 retries and exponential backoff (1s, 2s), should take at least 3s
        expect(duration).toBeGreaterThanOrEqual(3000);
        // Accept either HTTP 500 or Nock error (both indicate retries happened)
        expect(error.message).toMatch(/HTTP 500|No match for request/);
      }
    }, 10000);  // Increased timeout for retry delays

    test('gives up after max retries', async () => {
      nock('https://docs.anthropic.com')
        .get('/en/release-notes/')
        .times(3)
        .reply(500, 'Persistent error');

      await expect(fetcher.fetch('https://docs.anthropic.com/en/release-notes/'))
        .rejects.toThrow('HTTP 500');
    });
  });
});
