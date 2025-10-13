const { BaseTransformer } = require('../transformers/base-transformer');

describe('BaseTransformer', () => {
  let transformer;
  let mockLogger;

  beforeEach(() => {
    mockLogger = { debug: jest.fn() };
    transformer = new BaseTransformer(mockLogger);
  });

  describe('transform methods', () => {
    it('throws error for unimplemented transformAgent', async () => {
      await expect(transformer.transformAgent({})).rejects.toThrow('transformAgent() must be implemented by subclass');
    });

    it('throws error for unimplemented transformCommand', async () => {
      await expect(transformer.transformCommand({})).rejects.toThrow('transformCommand() must be implemented by subclass');
    });
  });

  describe('getFileExtension', () => {
    it('returns default extension', () => {
      expect(transformer.getFileExtension()).toBe('.md');
    });
  });

  describe('getToolName', () => {
    it('returns default tool name', () => {
      expect(transformer.getToolName()).toBe('base');
    });
  });

  describe('formatList', () => {
    it('formats array as bulleted list', () => {
      expect(transformer.formatList(['item1', 'item2'])).toBe('- item1\n- item2');
    });

    it('returns empty string for empty array', () => {
      expect(transformer.formatList([])).toBe('');
    });
  });

  describe('formatSection', () => {
    it('formats section with header', () => {
      expect(transformer.formatSection('Title', 'Content')).toBe('## Title\n\nContent\n');
    });

    it('returns empty for empty content', () => {
      expect(transformer.formatSection('Title', '')).toBe('');
    });
  });

  describe('formatCodeBlock', () => {
    it('formats code block', () => {
      expect(transformer.formatCodeBlock('code', 'js')).toBe('```js\ncode\n```');
    });

    it('returns empty for empty code', () => {
      expect(transformer.formatCodeBlock('')).toBe('');
    });
  });

  describe('formatCheckboxList', () => {
    it('formats unchecked checkbox list', () => {
      expect(transformer.formatCheckboxList(['item1', 'item2'])).toBe('- [ ] item1\n- [ ] item2');
    });

    it('formats checked checkbox list', () => {
      expect(transformer.formatCheckboxList(['item1'], true)).toBe('- [x] item1');
    });

    it('returns empty for empty array', () => {
      expect(transformer.formatCheckboxList([])).toBe('');
    });
  });

  describe('sanitize', () => {
    it('sanitizes and trims text', () => {
      expect(transformer.sanitize(' text ')).toBe('text');
    });

    it('returns empty for empty input', () => {
      expect(transformer.sanitize('')).toBe('');
    });
  });

  describe('formatYamlFrontmatter', () => {
    it('formats simple metadata', () => {
      const metadata = { name: 'Test', version: 1 };
      expect(transformer.formatYamlFrontmatter(metadata)).toBe('---\nname: Test\nversion: 1\n---');
    });

    it('formats array metadata', () => {
      const metadata = { tools: ['tool1', 'tool2'] };
      expect(transformer.formatYamlFrontmatter(metadata)).toBe('---\ntools:\n  - tool1\n  - tool2\n---');
    });

    it('formats single array item', () => {
      const metadata = { tools: ['tool1'] };
      expect(transformer.formatYamlFrontmatter(metadata)).toBe('---\ntools: tool1\n---');
    });

    it('formats object metadata', () => {
      const metadata = { config: { key: 'value' } };
      expect(transformer.formatYamlFrontmatter(metadata)).toBe('---\nconfig: {"key":"value"}\n---');
    });

    it('skips empty arrays', () => {
      const metadata = { tools: [] };
      expect(transformer.formatYamlFrontmatter(metadata)).toBe('---\n---');
    });
  });

  describe('formatTable', () => {
    it('formats table', () => {
      const headers = ['Col1', 'Col2'];
      const rows = [['val1', 'val2']];
      expect(transformer.formatTable(headers, rows)).toBe('| Col1 | Col2 |\n| --- | --- |\n| val1 | val2 |');
    });

    it('returns empty for empty headers or rows', () => {
      expect(transformer.formatTable([], [['val']])).toBe('');
      expect(transformer.formatTable(['Col'], [])).toBe('');
    });
  });

  describe('formatPriorityBadge', () => {
    it('returns badge for known priorities', () => {
      expect(transformer.formatPriorityBadge('high')).toBe('🔴');
      expect(transformer.formatPriorityBadge('medium')).toBe('🟡');
      expect(transformer.formatPriorityBadge('low')).toBe('🟢');
    });

    it('returns empty for unknown priority', () => {
      expect(transformer.formatPriorityBadge('unknown')).toBe('');
    });
  });
});