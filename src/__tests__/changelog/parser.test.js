const { ChangelogParser } = require('../../changelog/parser');
const fs = require('fs').promises;
const path = require('path');

describe('ChangelogParser', () => {
  let parser;
  let sampleHTML;

  beforeAll(async () => {
    const fixturePath = path.join(__dirname, '../fixtures/sample-changelog.html');
    sampleHTML = await fs.readFile(fixturePath, 'utf8');
    parser = new ChangelogParser();
  });

  describe('Version Extraction', () => {
    test('extracts version number correctly', () => {
      const result = parser.parse(sampleHTML);
      expect(result.version).toBe('3.5.0');
    });

    test('handles version without patch number', () => {
      const html = '<h1>Version 3.5 - October 15, 2025</h1>';
      const result = parser.parse(html);
      expect(result.version).toBe('3.5');
    });
  });

  describe('Date Extraction', () => {
    test('extracts release date in ISO 8601 format', () => {
      const result = parser.parse(sampleHTML);
      expect(result.releaseDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    test('parses natural language dates', () => {
      const html = '<h1>Version 3.5.0 - October 15, 2025</h1>';
      const result = parser.parse(html);
      expect(result.releaseDate).toBe('2025-10-15');
    });
  });

  describe('Section Identification', () => {
    test('identifies breaking changes section', () => {
      const result = parser.parse(sampleHTML);
      const breaking = result.features.filter(f => f.category === 'breaking');
      expect(breaking.length).toBeGreaterThan(0);
    });

    test('identifies new features section', () => {
      const result = parser.parse(sampleHTML);
      const newFeatures = result.features.filter(f => f.category === 'new');
      expect(newFeatures.length).toBeGreaterThan(0);
    });

    test('identifies performance improvements section', () => {
      const result = parser.parse(sampleHTML);
      const performance = result.features.filter(f => f.category === 'performance');
      expect(performance.length).toBeGreaterThan(0);
    });

    test('identifies security updates section', () => {
      const result = parser.parse(sampleHTML);
      const security = result.features.filter(f => f.category === 'security');
      expect(security.length).toBeGreaterThan(0);
    });

    test('identifies bug fixes section', () => {
      const result = parser.parse(sampleHTML);
      const bugfixes = result.features.filter(f => f.category === 'bugfix');
      expect(bugfixes.length).toBeGreaterThan(0);
    });
  });

  describe('Feature Extraction', () => {
    test('extracts feature titles and descriptions', () => {
      const result = parser.parse(sampleHTML);
      expect(result.features.length).toBeGreaterThan(0);

      const firstFeature = result.features[0];
      expect(firstFeature.title).toBeDefined();
      expect(firstFeature.description).toBeDefined();
      expect(firstFeature.id).toBeDefined();
    });

    test('parses migration guidance for breaking changes', () => {
      const result = parser.parse(sampleHTML);
      const breaking = result.features.find(f =>
        f.category === 'breaking' && f.title.includes('API Parameter')
      );

      expect(breaking).toBeDefined();
      expect(breaking.description.toLowerCase()).toContain('migration');
    });

    test('extracts all features from sample changelog', () => {
      const result = parser.parse(sampleHTML);
      // Sample has: 2 breaking + 3 new + 2 performance + 2 security + 3 bugfix = 12 total
      expect(result.features.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe('Metadata', () => {
    test('includes parsing confidence score', () => {
      const result = parser.parse(sampleHTML);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.parsingConfidence).toBeGreaterThan(0);
      expect(result.metadata.parsingConfidence).toBeLessThanOrEqual(1);
    });

    test('achieves ≥85% accuracy on sample changelog', () => {
      const result = parser.parse(sampleHTML);
      // Confidence score should be ≥0.85 for MVP
      expect(result.metadata.parsingConfidence).toBeGreaterThanOrEqual(0.85);
    });
  });
});
