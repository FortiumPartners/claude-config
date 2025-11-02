/**
 * Status Message Formatting Tests
 * Tests for status message formatting utilities
 */

const { StatusFormatter, statusFormatter } = require('../../utils/status-formatter');

describe('StatusFormatter', () => {
  let formatter;

  beforeEach(() => {
    formatter = new StatusFormatter();
  });

  describe('initialization', () => {
    test('should create status formatter instance', () => {
      expect(formatter).toBeInstanceOf(StatusFormatter);
      expect(formatter.templates).toBeDefined();
    });

    test('should have predefined templates', () => {
      expect(formatter.templates.scanning).toBe('Scanning existing commands...');
      expect(formatter.templates.migrating).toBe('Migrating command files...');
      expect(formatter.templates.done).toBe('Migration complete!');
    });
  });

  describe('fileOperation()', () => {
    test('should format basic file operation', () => {
      const result = formatter.fileOperation('move', 'command.yaml');
      expect(result).toContain('Moving');
      expect(result).toContain('command.yaml');
    });

    test('should include destination when provided', () => {
      const result = formatter.fileOperation('move', 'command.yaml', {
        destination: 'ai-mesh/command.yaml'
      });
      expect(result).toContain('command.yaml');
      expect(result).toContain('→');
      expect(result).toContain('ai-mesh/command.yaml');
    });

    test('should handle different operation types', () => {
      expect(formatter.fileOperation('copy', 'test.yaml')).toContain('Copying');
      expect(formatter.fileOperation('delete', 'test.yaml')).toContain('Deleting');
      expect(formatter.fileOperation('update', 'test.yaml')).toContain('Updating');
      expect(formatter.fileOperation('create', 'test.yaml')).toContain('Creating');
    });
  });

  describe('migrationProgress()', () => {
    test('should format migration progress message', () => {
      const result = formatter.migrationProgress(5, 20, 'command.yaml');
      expect(result).toContain('[5/20]');
      expect(result).toContain('command.yaml');
    });
  });

  describe('error()', () => {
    test('should format basic error message', () => {
      const result = formatter.error('Failed to migrate file');
      expect(result).toContain('Error:');
      expect(result).toContain('Failed to migrate file');
    });

    test('should include file context when provided', () => {
      const result = formatter.error('Failed to migrate', { file: 'test.yaml' });
      expect(result).toContain('File: test.yaml');
    });

    test('should include reason when provided', () => {
      const result = formatter.error('Failed to migrate', {
        reason: 'Permission denied'
      });
      expect(result).toContain('Reason: Permission denied');
    });

    test('should include suggestion when provided', () => {
      const result = formatter.error('Failed to migrate', {
        suggestion: 'Check file permissions'
      });
      expect(result).toContain('Suggestion: Check file permissions');
    });
  });

  describe('warning()', () => {
    test('should format basic warning message', () => {
      const result = formatter.warning('File will be overwritten');
      expect(result).toContain('Warning:');
      expect(result).toContain('File will be overwritten');
    });

    test('should include file and impact', () => {
      const result = formatter.warning('Deprecated syntax detected', {
        file: 'old-command.yaml',
        impact: 'May not work in future versions'
      });
      expect(result).toContain('File: old-command.yaml');
      expect(result).toContain('Impact: May not work in future versions');
    });
  });

  describe('success()', () => {
    test('should format success message', () => {
      const result = formatter.success('Migration completed');
      expect(result).toContain('Migration completed');
    });
  });

  describe('info()', () => {
    test('should format info message', () => {
      const result = formatter.info('Starting migration process');
      expect(result).toContain('Starting migration process');
    });
  });

  describe('migrationSummary()', () => {
    test('should format complete migration summary', () => {
      const stats = {
        totalFiles: 12,
        successfulMigrations: 11,
        failedMigrations: 1,
        warnings: 2,
        yamlFilesUpdated: 12,
        backupPath: '/tmp/backup',
        duration: 1500
      };

      const lines = formatter.migrationSummary(stats);
      expect(lines).toBeInstanceOf(Array);
      expect(lines.length).toBeGreaterThan(0);
      expect(lines.some(line => line.includes('12'))).toBe(true); // total files
      expect(lines.some(line => line.includes('11'))).toBe(true); // successful
    });

    test('should handle minimal stats', () => {
      const stats = {
        totalFiles: 5,
        successfulMigrations: 5
      };

      const lines = formatter.migrationSummary(stats);
      expect(lines).toBeInstanceOf(Array);
      expect(lines.length).toBeGreaterThan(0);
    });
  });

  describe('validationResult()', () => {
    test('should format validation with all results', () => {
      const result = {
        passed: 10,
        failed: 2,
        warnings: 3,
        details: ['Check 1 failed', 'Warning in check 2']
      };

      const formatted = formatter.validationResult(result);
      expect(formatted).toContain('10');
      expect(formatted).toContain('2');
      expect(formatted).toContain('3');
    });

    test('should handle passing validation', () => {
      const result = {
        passed: 15,
        failed: 0,
        warnings: 0
      };

      const formatted = formatter.validationResult(result);
      expect(formatted).toContain('15');
      expect(formatted).toContain('passed');
    });
  });

  describe('formatDuration()', () => {
    test('should format milliseconds', () => {
      expect(formatter.formatDuration(500)).toBe('500ms');
    });

    test('should format seconds', () => {
      expect(formatter.formatDuration(5000)).toBe('5s');
    });

    test('should format minutes and seconds', () => {
      const result = formatter.formatDuration(125000);
      expect(result).toContain('m');
      expect(result).toContain('s');
    });
  });

  describe('formatFileSize()', () => {
    test('should format bytes', () => {
      expect(formatter.formatFileSize(500)).toBe('500 B');
    });

    test('should format kilobytes', () => {
      const result = formatter.formatFileSize(2048);
      expect(result).toContain('KB');
    });

    test('should format megabytes', () => {
      const result = formatter.formatFileSize(2097152);
      expect(result).toContain('MB');
    });
  });

  describe('backupInfo()', () => {
    test('should format backup information', () => {
      const result = formatter.backupInfo('/tmp/backup', 12);
      expect(result).toContain('Backup created');
      expect(result).toContain('12');
      expect(result).toContain('/tmp/backup');
    });
  });

  describe('rollbackInfo()', () => {
    test('should format rollback information', () => {
      const result = formatter.rollbackInfo('/tmp/backup');
      expect(result).toContain('Rolling back');
      expect(result).toContain('/tmp/backup');
    });
  });

  describe('dryRun()', () => {
    test('should format dry-run indicator', () => {
      const result = formatter.dryRun('Moving files');
      expect(result).toContain('DRY RUN');
      expect(result).toContain('Moving files');
    });
  });

  describe('commandResolutionTest()', () => {
    test('should format passed test', () => {
      const result = formatter.commandResolutionTest(true, 'create-trd');
      expect(result).toContain('create-trd');
      expect(result).toContain('resolved successfully');
    });

    test('should format failed test', () => {
      const result = formatter.commandResolutionTest(false, 'create-trd');
      expect(result).toContain('create-trd');
      expect(result).toContain('failed to resolve');
    });
  });

  describe('getTemplate()', () => {
    test('should return template by key', () => {
      expect(formatter.getTemplate('scanning')).toBe('Scanning existing commands...');
    });

    test('should return key if template not found', () => {
      expect(formatter.getTemplate('unknown')).toBe('unknown');
    });
  });

  describe('logEntry()', () => {
    test('should create structured log entry', () => {
      const entry = formatter.logEntry('info', 'Starting migration', {
        files: 12
      });

      expect(entry).toHaveProperty('timestamp');
      expect(entry).toHaveProperty('level', 'info');
      expect(entry).toHaveProperty('operation', 'Starting migration');
      expect(entry).toHaveProperty('details');
      expect(entry.details.files).toBe(12);
    });
  });
});

describe('module exports', () => {
  test('should export StatusFormatter class', () => {
    expect(StatusFormatter).toBeDefined();
    expect(typeof StatusFormatter).toBe('function');
  });

  test('should export singleton instance', () => {
    expect(statusFormatter).toBeDefined();
    expect(statusFormatter).toBeInstanceOf(StatusFormatter);
  });
});
