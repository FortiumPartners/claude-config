const { TransformerFactory } = require('../transformers/transformer-factory');

describe('TransformerFactory', () => {
  let factory;
  let mockLogger;

  beforeEach(() => {
    mockLogger = { debug: jest.fn() };
    factory = new TransformerFactory(mockLogger);
  });

  describe('registerDefaultTransformers', () => {
    it('registers default transformers and aliases', () => {
      expect(factory.getAllNames()).toEqual(expect.arrayContaining(['claude', 'opencode', 'claudecode', 'claude-code']));
    });
  });

  describe('register', () => {
    it('registers a new transformer', () => {
      const mockTransformer = { getToolName: () => 'custom' };
      factory.register('custom', mockTransformer);
      expect(factory.isSupported('custom')).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith('Registered transformer for: custom');
    });
  });

  describe('getTransformer', () => {
    it('returns registered transformer', () => {
      const transformer = factory.getTransformer('claude');
      expect(transformer.getToolName()).toBe('claude');
    });

    it('handles case insensitivity', () => {
      const transformer = factory.getTransformer('CLAUDE');
      expect(transformer.getToolName()).toBe('claude');
    });

    it('throws for unsupported tool', () => {
      expect(() => factory.getTransformer('unknown')).toThrow(/No transformer registered for tool: unknown/);
    });
  });

  describe('isSupported', () => {
    it('returns true for supported tools', () => {
      expect(factory.isSupported('opencode')).toBe(true);
    });

    it('returns false for unsupported tools', () => {
      expect(factory.isSupported('unknown')).toBe(false);
    });
  });

  describe('getSupportedTools', () => {
    it('returns unique supported tools', () => {
      // getSupportedTools() returns unique tool names (excluding aliases)
      // Aliases like 'claudecode' and 'claude-code' are excluded since they point to the same 'claude' transformer
      expect(factory.getSupportedTools()).toEqual(expect.arrayContaining(['claude', 'opencode']));
      // Verify aliases are NOT included in getSupportedTools
      expect(factory.getSupportedTools()).not.toContain('claudecode');
      expect(factory.getSupportedTools()).not.toContain('claude-code');
    });
  });

  describe('getAllNames', () => {
    it('returns all registered names including aliases', () => {
      expect(factory.getAllNames()).toEqual(expect.arrayContaining(['claude', 'claudecode', 'claude-code', 'opencode']));
    });
  });

  describe('edge cases', () => {
    it('handles empty factory', () => {
      const emptyFactory = new TransformerFactory(mockLogger);
      emptyFactory.transformers.clear(); // Simulate empty
      expect(emptyFactory.getSupportedTools()).toEqual([]);
      expect(() => emptyFactory.getTransformer('claude')).toThrow();
    });
  });
});