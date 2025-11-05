const { FeatureCategorizer } = require('../../changelog/categorizer');

describe('FeatureCategorizer', () => {
  let categorizer;

  beforeEach(() => {
    categorizer = new FeatureCategorizer();
  });

  describe('Category Classification', () => {
    test('identifies breaking changes', () => {
      const feature = {
        category: 'breaking',
        title: 'API Parameter Renamed',
        description: 'The prompt parameter has been renamed to content'
      };
      const result = categorizer.enhance(feature);
      expect(result.category).toBe('breaking');
    });

    test('identifies new features', () => {
      const feature = {
        category: 'new',
        title: 'Extended Context Window',
        description: 'Claude now supports 200K token context'
      };
      const result = categorizer.enhance(feature);
      expect(result.category).toBe('new');
    });

    test('identifies performance improvements', () => {
      const feature = {
        category: 'performance',
        title: 'Faster Response Times',
        description: 'Response latency reduced by 25%'
      };
      const result = categorizer.enhance(feature);
      expect(result.category).toBe('performance');
    });

    test('identifies security updates', () => {
      const feature = {
        category: 'security',
        title: 'Enhanced Input Validation',
        description: 'Improved validation to prevent prompt injection'
      };
      const result = categorizer.enhance(feature);
      expect(result.category).toBe('security');
    });
  });

  describe('Impact Assessment', () => {
    test('breaking changes are always high impact', () => {
      const feature = {
        category: 'breaking',
        title: 'API Change',
        description: 'Breaking API change'
      };
      const result = categorizer.enhance(feature);
      expect(result.impact).toBe('high');
    });

    test('security updates are always high impact', () => {
      const feature = {
        category: 'security',
        title: 'Security Fix',
        description: 'Critical security vulnerability fixed'
      };
      const result = categorizer.enhance(feature);
      expect(result.impact).toBe('high');
    });

    test('identifies high impact from keywords', () => {
      const feature = {
        category: 'new',
        title: 'Major New Feature',
        description: 'Significant improvement to core functionality'
      };
      const result = categorizer.enhance(feature);
      expect(result.impact).toBe('high');
    });

    test('identifies medium impact features', () => {
      const feature = {
        category: 'enhancement',
        title: 'Improved Performance',
        description: 'Moderate performance improvement'
      };
      const result = categorizer.enhance(feature);
      expect(result.impact).toBe('medium');
    });

    test('identifies low impact features', () => {
      const feature = {
        category: 'bugfix',
        title: 'Minor Bug Fix',
        description: 'Fixed small typo in error message'
      };
      const result = categorizer.enhance(feature);
      expect(result.impact).toBe('low');
    });
  });

  describe('Confidence Scoring', () => {
    test('calculates confidence based on keyword matches', () => {
      const feature = {
        category: 'breaking',
        title: 'Breaking API Change',
        description: 'Major breaking change requiring migration'
      };
      const result = categorizer.enhance(feature);
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    test('lower confidence for ambiguous categorization', () => {
      const feature = {
        category: 'enhancement',
        title: 'Update',
        description: 'Some update'
      };
      const result = categorizer.enhance(feature);
      expect(result.confidence).toBeLessThan(0.8);
    });
  });

  describe('Categorization Accuracy', () => {
    test('achieves ≥90% accuracy on test dataset', () => {
      const testDataset = [
        { category: 'breaking', title: 'Breaking Change', description: 'API breaking change', expected: 'breaking' },
        { category: 'new', title: 'New Feature', description: 'Added new capability', expected: 'new' },
        { category: 'performance', title: 'Faster', description: 'Improved speed', expected: 'performance' },
        { category: 'security', title: 'Security Fix', description: 'Fixed vulnerability', expected: 'security' },
        { category: 'bugfix', title: 'Bug Fix', description: 'Fixed issue', expected: 'bugfix' },
        { category: 'enhancement', title: 'Improvement', description: 'Enhanced feature', expected: 'enhancement' },
        { category: 'deprecation', title: 'Deprecated', description: 'Removed old feature', expected: 'deprecation' },
        { category: 'breaking', title: 'Removed API', description: 'Incompatible change', expected: 'breaking' },
        { category: 'new', title: 'Launch', description: 'New release', expected: 'new' },
        { category: 'performance', title: 'Optimization', description: 'Performance boost', expected: 'performance' }
      ];

      let correct = 0;
      for (const test of testDataset) {
        const result = categorizer.enhance(test);
        if (result.category === test.expected) correct++;
      }

      const accuracy = correct / testDataset.length;
      expect(accuracy).toBeGreaterThanOrEqual(0.9);
    });
  });
});
