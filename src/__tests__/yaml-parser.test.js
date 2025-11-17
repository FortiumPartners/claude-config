const yaml = require('js-yaml');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

// Mock modules BEFORE requiring the parser
// Note: yaml-parser.js uses require('fs').promises, not require('fs/promises')
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
  },
}));

jest.mock('js-yaml');
jest.mock('ajv');
jest.mock('ajv-formats');

const fs = require('fs').promises;
const { YamlParser } = require('../parsers/yaml-parser');

describe('YamlParser', () => {
  let parser;
  let mockLogger;
  let mockAjvInstance;

  beforeEach(() => {
    // Reset mocks first
    jest.clearAllMocks();

    mockLogger = {
      debug: jest.fn(),
      warning: jest.fn(),
      error: jest.fn(),
    };

    mockAjvInstance = {
      compile: jest.fn(() => jest.fn((data) => true)),
      errors: [],
    };
    Ajv.mockImplementation(() => mockAjvInstance);
    addFormats.mockImplementation(() => {});

    // Create parser AFTER setting up mocks
    parser = new YamlParser(mockLogger);
  });

  describe('parse', () => {
    it('successfully parses and validates a valid YAML file', async () => {
      const yamlPath = '/agents/test.yaml';
      const yamlContent = 'name: Test Agent';
      const parsedData = { name: 'Test Agent' };

      fs.readFile.mockResolvedValue(yamlContent);
      yaml.load.mockReturnValue(parsedData);
      parser.schemas.set('agent', {});

      const result = await parser.parse(yamlPath);
      expect(result).toEqual(parsedData);
      expect(mockLogger.debug).toHaveBeenCalledWith(`Successfully parsed and validated: test.yaml`);
    });

    it('handles YAML parsing errors', async () => {
      fs.readFile.mockResolvedValue('invalid yaml');
      const yamlError = new Error('Parse error');
      yamlError.name = 'YAMLException';
      Object.setPrototypeOf(yamlError, yaml.YAMLException.prototype);
      yaml.load.mockImplementation(() => {
        throw yamlError;
      });

      await expect(parser.parse('/test.yaml')).rejects.toThrow('YAML parsing error in /test.yaml: Parse error');
    });

    it('throws error for non-object YAML', async () => {
      fs.readFile.mockResolvedValue('scalar');
      yaml.load.mockReturnValue('scalar');

      await expect(parser.parse('/test.yaml')).rejects.toThrow('Invalid YAML');
    });

    it('validates against schema and throws on failure', async () => {
      fs.readFile.mockResolvedValue('name: Test');
      yaml.load.mockReturnValue({ name: 'Test' });
      parser.schemas.set('agent', {});
      const mockValidator = jest.fn(() => false);
      mockValidator.errors = [{ instancePath: '/name', message: 'invalid' }];
      mockAjvInstance.compile.mockReturnValue(mockValidator);

      await expect(parser.parse('/agents/test.yaml')).rejects.toThrow('agent validation failed in /agents/test.yaml:\n  • /name: invalid');
    });

    it('handles edge case: minimal valid YAML', async () => {
      const minimalYaml = 'name: Minimal';
      fs.readFile.mockResolvedValue(minimalYaml);
      yaml.load.mockReturnValue({ name: 'Minimal' });
      parser.schemas.set('agent', {});

      const result = await parser.parse('/agents/minimal.yaml');
      expect(result).toEqual({ name: 'Minimal' });
    });

    it('handles edge case: empty file', async () => {
      fs.readFile.mockResolvedValue('');
      yaml.load.mockReturnValue(null);

      await expect(parser.parse('/agents/empty.yaml')).rejects.toThrow('Invalid YAML');
    });
  });

  describe('detectType', () => {
    it('detects agent type from path', () => {
      expect(parser.detectType('/agents/test.yaml')).toBe('agent');
      expect(parser.detectType('/Users/project/agents/test.yaml')).toBe('agent');
    });

    it('detects command type from path', () => {
      expect(parser.detectType('/commands/yaml/test.yaml')).toBe('command');
      expect(parser.detectType('/Users/project/commands/test.yaml')).toBe('command');
    });

    it('defaults to agent if unclear', () => {
      expect(parser.detectType('/some/random/path.yaml')).toBe('agent');
    });
  });

  describe('loadSchema', () => {
    it('loads schema successfully', async () => {
      fs.readFile.mockResolvedValue('{"type": "object"}');
      await parser.loadSchema('agent');
      expect(parser.schemas.get('agent')).toEqual({ type: 'object' });
    });

    it('throws on schema load failure', async () => {
      fs.readFile.mockRejectedValue(new Error('File not found'));
      await expect(parser.loadSchema('agent')).rejects.toThrow('Failed to load agent schema: File not found');
    });
  });

  describe('parseMany', () => {
    it('parses multiple files with some successes and errors', async () => {
      fs.readFile.mockResolvedValueOnce('valid').mockRejectedValueOnce(new Error('Invalid'));
      yaml.load.mockReturnValueOnce({ name: 'Test' });
      parser.schemas.set('agent', {});

      const result = await parser.parseMany(['/agents/valid.yaml', '/agents/invalid.yaml']);
      expect(result.successCount).toBe(1);
      expect(result.errorCount).toBe(1);
    });
  });

  describe('validateContent', () => {
    it('validates content successfully', async () => {
      yaml.load.mockReturnValue({ name: 'Test' });
      parser.schemas.set('agent', {});

      const result = await parser.validateContent('name: Test', 'agent');
      expect(result).toEqual({ name: 'Test' });
    });

    it('throws on invalid content', async () => {
      yaml.load.mockReturnValue({ name: 'Test' });
      parser.schemas.set('agent', {});
      const mockValidator = jest.fn(() => false);
      mockValidator.errors = [{ instancePath: '', message: 'invalid' }];
      mockAjvInstance.compile.mockReturnValue(mockValidator);

      await expect(parser.validateContent('name: Test', 'agent')).rejects.toThrow('agent validation failed');
    });
  });
});
