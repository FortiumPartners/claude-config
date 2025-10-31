/**
 * Colored Output System Tests
 * Tests for semantic colored console output functionality
 */

const { ColoredOutput, coloredOutput, themes, symbols } = require('../../utils/colored-output');

describe('ColoredOutput', () => {
  let output;
  let consoleSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    output = new ColoredOutput({ color: true });
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('initialization', () => {
    test('should create colored output instance', () => {
      expect(output).toBeInstanceOf(ColoredOutput);
    });

    test('should respect color enable/disable option', () => {
      const disabledOutput = new ColoredOutput({ color: false });
      expect(disabledOutput.enabled).toBe(false);
    });

    test('should respect debug mode', () => {
      const debugOutput = new ColoredOutput({ debug: true });
      expect(debugOutput.debugMode).toBe(true);
    });
  });

  describe('basic output methods', () => {
    test('success() should print success message', () => {
      output.success('Operation completed');
      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[0][0]).toContain('Operation completed');
    });

    test('error() should print error message', () => {
      output.error('Operation failed');
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleErrorSpy.mock.calls[0][0]).toContain('Operation failed');
    });

    test('warning() should print warning message', () => {
      output.warning('Proceed with caution');
      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[0][0]).toContain('Proceed with caution');
    });

    test('info() should print info message', () => {
      output.info('Information message');
      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[0][0]).toContain('Information message');
    });

    test('progress() should print progress message', () => {
      output.progress('Processing...');
      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[0][0]).toContain('Processing...');
    });

    test('debug() should print debug message when debug enabled', () => {
      const debugOutput = new ColoredOutput({ debug: true });
      const spy = jest.spyOn(console, 'log').mockImplementation();

      debugOutput.debug('Debug information');
      expect(spy).toHaveBeenCalled();

      spy.mockRestore();
    });

    test('debug() should not print when debug disabled', () => {
      output.debug('Debug information');
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('symbol options', () => {
    test('should omit symbol when noSymbol option is true', () => {
      output.success('Message', { noSymbol: true });
      const logOutput = consoleSpy.mock.calls[0][0];
      expect(logOutput).not.toContain(symbols.success);
      expect(logOutput).toContain('Message');
    });

    test('should include symbol by default', () => {
      output.success('Message');
      const logOutput = consoleSpy.mock.calls[0][0];
      expect(logOutput).toContain(symbols.success);
    });
  });

  describe('text formatting', () => {
    test('bold() should return bold text', () => {
      const result = output.bold('Bold text');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    test('dim() should return dimmed text', () => {
      const result = output.dim('Dimmed text');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });
  });

  describe('structural elements', () => {
    test('header() should print header with separators', () => {
      output.header('Test Header');
      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls.length).toBeGreaterThan(2); // blank, top line, title, bottom line, blank
    });

    test('subheader() should print subheader', () => {
      output.subheader('Test Subheader');
      expect(consoleSpy).toHaveBeenCalled();
    });

    test('separator() should print separator line', () => {
      output.separator();
      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[0][0]).toContain('─');
    });

    test('separator() should accept custom options', () => {
      output.separator({ width: 40, char: '=', color: 'info' });
      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[0][0]).toContain('=');
    });
  });

  describe('key-value pairs', () => {
    test('keyValue() should print formatted key-value pair', () => {
      output.keyValue('Name', 'Value');
      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[0][0]).toContain('Name:');
      expect(consoleSpy.mock.calls[0][0]).toContain('Value');
    });

    test('keyValue() should respect indent option', () => {
      output.keyValue('Name', 'Value', { indent: 4 });
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('list items', () => {
    test('bullet() should print bullet list item', () => {
      output.bullet('List item');
      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[0][0]).toContain('List item');
    });

    test('bullet() should accept custom symbol', () => {
      output.bullet('List item', { symbol: '→' });
      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[0][0]).toContain('→');
    });

    test('numbered() should print numbered list item', () => {
      output.numbered(1, 'First item');
      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[0][0]).toContain('1.');
      expect(consoleSpy.mock.calls[0][0]).toContain('First item');
    });
  });

  describe('box formatting', () => {
    test('box() should print content in a box', () => {
      output.box('Boxed content');
      expect(consoleSpy).toHaveBeenCalled();
      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls.some(call => call.includes('Boxed content'))).toBe(true);
    });

    test('box() should support title option', () => {
      output.box('Content', { title: 'Title' });
      expect(consoleSpy).toHaveBeenCalled();
      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls.some(call => call.includes('Title'))).toBe(true);
    });
  });

  describe('table formatting', () => {
    test('table() should print formatted table', () => {
      const headers = ['Name', 'Age', 'City'];
      const rows = [
        ['Alice', '30', 'New York'],
        ['Bob', '25', 'San Francisco']
      ];

      output.table(headers, rows);
      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls.length).toBeGreaterThan(0);
    });
  });

  describe('step indicators', () => {
    test('step() should print step with progress', () => {
      output.step(1, 5, 'First step');
      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[0][0]).toContain('[1/5]');
      expect(consoleSpy.mock.calls[0][0]).toContain('First step');
    });
  });

  describe('dynamic output', () => {
    test('newLine() should print blank line', () => {
      output.newLine();
      expect(consoleSpy).toHaveBeenCalledWith('');
    });

    test('clearLine() should attempt to clear line', () => {
      // Mock the stdout methods if they exist
      if (process.stdout.clearLine && process.stdout.cursorTo) {
        const clearLineSpy = jest.spyOn(process.stdout, 'clearLine').mockImplementation();
        const cursorToSpy = jest.spyOn(process.stdout, 'cursorTo').mockImplementation();

        output.clearLine();

        expect(clearLineSpy).toHaveBeenCalledWith(0);
        expect(cursorToSpy).toHaveBeenCalledWith(0);

        clearLineSpy.mockRestore();
        cursorToSpy.mockRestore();
      } else {
        // Just test that the method exists and can be called
        expect(() => output.clearLine()).not.toThrow();
      }
    });

    test('write() should write without newline', () => {
      const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation();

      output.write('Test');

      expect(writeSpy).toHaveBeenCalledWith('Test');

      writeSpy.mockRestore();
    });
  });
});

describe('module exports', () => {
  test('should export ColoredOutput class', () => {
    expect(ColoredOutput).toBeDefined();
    expect(typeof ColoredOutput).toBe('function');
  });

  test('should export singleton instance', () => {
    expect(coloredOutput).toBeDefined();
    expect(coloredOutput).toBeInstanceOf(ColoredOutput);
  });

  test('should export themes', () => {
    expect(themes).toBeDefined();
    expect(themes.success).toBeDefined();
    expect(themes.error).toBeDefined();
    expect(themes.warning).toBeDefined();
    expect(themes.info).toBeDefined();
  });

  test('should export symbols', () => {
    expect(symbols).toBeDefined();
    expect(symbols.success).toBeDefined();
    expect(symbols.error).toBeDefined();
    expect(symbols.warning).toBeDefined();
    expect(symbols.info).toBeDefined();
  });
});
