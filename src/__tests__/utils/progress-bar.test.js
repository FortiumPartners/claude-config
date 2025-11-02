/**
 * Progress Bar Component Tests
 * Tests for progress bar functionality and statistics tracking
 */

const { ProgressBar, MultiProgressBar } = require('../../utils/progress-bar');

describe('ProgressBar', () => {
  let progressBar;

  beforeEach(() => {
    progressBar = new ProgressBar();
  });

  afterEach(() => {
    if (progressBar.bar) {
      progressBar.stop();
    }
  });

  describe('initialization', () => {
    test('should create progress bar instance', () => {
      expect(progressBar).toBeInstanceOf(ProgressBar);
      expect(progressBar.total).toBe(0);
      expect(progressBar.current).toBe(0);
      expect(progressBar.errors).toBe(0);
      expect(progressBar.warnings).toBe(0);
    });

    test('should accept custom format options', () => {
      const customBar = new ProgressBar({ format: 'custom format' });
      expect(customBar.options.format).toBe('custom format');
    });
  });

  describe('start()', () => {
    test('should initialize progress bar with total count', () => {
      progressBar.start(10, 'Testing...');
      expect(progressBar.total).toBe(10);
      expect(progressBar.current).toBe(0);
      expect(progressBar.bar).toBeTruthy();
      progressBar.stop();
    });

    test('should reset counters on start', () => {
      progressBar.errors = 5;
      progressBar.warnings = 3;
      progressBar.start(20);
      expect(progressBar.errors).toBe(0);
      expect(progressBar.warnings).toBe(0);
      progressBar.stop();
    });
  });

  describe('update()', () => {
    test('should increment current count', () => {
      progressBar.start(10);
      progressBar.update('Processing file 1');
      expect(progressBar.current).toBe(1);
      progressBar.stop();
    });

    test('should track errors when metadata provided', () => {
      progressBar.start(10);
      progressBar.update('Processing file 1', { error: true });
      expect(progressBar.errors).toBe(1);
      progressBar.stop();
    });

    test('should track warnings when metadata provided', () => {
      progressBar.start(10);
      progressBar.update('Processing file 1', { warning: true });
      expect(progressBar.warnings).toBe(1);
      progressBar.stop();
    });

    test('should warn if bar not initialized', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      progressBar.update('Test');
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('increment()', () => {
    test('should increment progress by one', () => {
      progressBar.start(10);
      progressBar.increment('Step 1');
      expect(progressBar.current).toBe(1);
      progressBar.increment('Step 2');
      expect(progressBar.current).toBe(2);
      progressBar.stop();
    });
  });

  describe('getStats()', () => {
    test('should return accurate statistics', () => {
      progressBar.start(10);
      progressBar.update('File 1');
      progressBar.update('File 2', { error: true });
      progressBar.update('File 3', { warning: true });

      const stats = progressBar.getStats();
      expect(stats.total).toBe(10);
      expect(stats.current).toBe(3);
      expect(stats.remaining).toBe(7);
      expect(stats.errors).toBe(1);
      expect(stats.warnings).toBe(1);
      expect(stats.percentage).toBe(30);
      progressBar.stop();
    });

    test('should calculate percentage correctly at 0%', () => {
      progressBar.start(10);
      const stats = progressBar.getStats();
      expect(stats.percentage).toBe(0);
      progressBar.stop();
    });

    test('should calculate percentage correctly at 100%', () => {
      progressBar.start(5);
      for (let i = 0; i < 5; i++) {
        progressBar.update(`File ${i + 1}`);
      }
      const stats = progressBar.getStats();
      expect(stats.percentage).toBe(100);
      progressBar.stop();
    });
  });

  describe('stop()', () => {
    test('should stop progress bar gracefully', () => {
      progressBar.start(10);
      progressBar.update('File 1');
      progressBar.stop('Done');
      expect(progressBar.bar).toBeTruthy();
    });

    test('should handle stop when bar not initialized', () => {
      expect(() => progressBar.stop()).not.toThrow();
    });
  });

  describe('displaySummary()', () => {
    test('should display summary with all statistics', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      progressBar.start(10);
      progressBar.update('File 1');
      progressBar.update('File 2', { error: true });

      progressBar.displaySummary({
        success: 9,
        yamlUpdated: 5,
        backupPath: '/tmp/backup'
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});

describe('MultiProgressBar', () => {
  let multiBar;

  beforeEach(() => {
    multiBar = new MultiProgressBar();
  });

  afterEach(() => {
    multiBar.stop();
  });

  describe('initialization', () => {
    test('should create multi-bar instance', () => {
      expect(multiBar).toBeInstanceOf(MultiProgressBar);
      expect(multiBar.bars).toBeInstanceOf(Map);
    });
  });

  describe('addTask()', () => {
    test('should add new task bar', () => {
      multiBar.addTask('Migration', 10);
      expect(multiBar.bars.has('Migration')).toBe(true);
      expect(multiBar.bars.get('Migration').total).toBe(10);
    });
  });

  describe('updateTask()', () => {
    test('should update specific task progress', () => {
      multiBar.addTask('Migration', 10);
      multiBar.updateTask('Migration', 5);
      expect(multiBar.bars.get('Migration').current).toBe(5);
    });

    test('should handle non-existent task gracefully', () => {
      expect(() => multiBar.updateTask('NonExistent', 5)).not.toThrow();
    });
  });

  describe('incrementTask()', () => {
    test('should increment specific task by one', () => {
      multiBar.addTask('Migration', 10);
      multiBar.incrementTask('Migration');
      expect(multiBar.bars.get('Migration').current).toBe(1);
      multiBar.incrementTask('Migration');
      expect(multiBar.bars.get('Migration').current).toBe(2);
    });
  });
});
