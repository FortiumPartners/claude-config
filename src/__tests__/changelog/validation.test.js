const { validateChangelog, enrichChangelog } = require('../../changelog/parser');

describe('Changelog Validation', () => {
  test('validates required fields present', () => {
    const changelog = {
      version: '3.5.0',
      releaseDate: '2025-10-15',
      features: []
    };
    expect(() => validateChangelog(changelog)).not.toThrow();
  });

  test('throws error when version missing', () => {
    const changelog = {
      releaseDate: '2025-10-15',
      features: []
    };
    expect(() => validateChangelog(changelog)).toThrow('Missing version');
  });

  test('throws error when date missing', () => {
    const changelog = {
      version: '3.5.0',
      features: []
    };
    expect(() => validateChangelog(changelog)).toThrow('Missing releaseDate');
  });

  test('validates semver format', () => {
    const changelog = {
      version: 'invalid',
      releaseDate: '2025-10-15',
      features: []
    };
    expect(() => validateChangelog(changelog)).toThrow('Invalid semver');
  });

  test('validates date format', () => {
    const changelog = {
      version: '3.5.0',
      releaseDate: 'invalid-date',
      features: []
    };
    expect(() => validateChangelog(changelog)).toThrow('Invalid date format');
  });
});

describe('Changelog Enrichment', () => {
  test('enriches with metadata', () => {
    const changelog = {
      version: '3.5.0',
      releaseDate: '2025-10-15',
      features: []
    };
    const enriched = enrichChangelog(changelog);

    expect(enriched.metadata.source).toBeDefined();
    expect(enriched.version).toBe('3.5.0');
  });

  test('preserves existing metadata', () => {
    const changelog = {
      version: '3.5.0',
      releaseDate: '2025-10-15',
      features: [],
      metadata: {
        parsingConfidence: 0.9
      }
    };
    const enriched = enrichChangelog(changelog);

    expect(enriched.metadata.parsingConfidence).toBe(0.9);
    expect(enriched.metadata.source).toBeDefined();
  });
});
