const { ClaudeTransformer } = require('../transformers/claude-transformer');
const { BaseTransformer } = require('../transformers/base-transformer');

jest.mock('../transformers/base-transformer');

describe('ClaudeTransformer', () => {
  let transformer;
  let mockLogger;

  beforeEach(() => {
    mockLogger = { debug: jest.fn() };
    BaseTransformer.mockImplementation(() => ({
      formatYamlFrontmatter: jest.fn((meta) => `---\n${JSON.stringify(meta)}\n---`),
      formatSection: jest.fn((title, content) => `## ${title}\n${content}`),
      formatCodeBlock: jest.fn((code, lang) => `\`\`\`${lang}\n${code}\n\`\`\``),
      sanitize: jest.fn((text) => text),
      formatPriorityBadge: jest.fn((priority) => `[${priority}]`),
    }));
    transformer = new ClaudeTransformer(mockLogger);
  });

  describe('getToolName', () => {
    it('returns claude', () => {
      expect(transformer.getToolName()).toBe('claude');
    });
  });

  describe('getFileExtension', () => {
    it('returns .md', () => {
      expect(transformer.getFileExtension()).toBe('.md');
    });
  });

  describe('transformAgent', () => {
    it('transforms full agent data successfully', async () => {
      const agentData = {
        metadata: { name: 'Test', description: 'Desc', tools: ['tool1'], version: '1.0', category: 'cat' },
        mission: { summary: 'Mission summary', boundaries: { handles: 'Handles', doesNotHandle: 'No', collaboratesOn: 'Collab' }, expertise: [{ name: 'Exp1', description: 'Desc1' }] },
        responsibilities: [{ title: 'Resp1', description: 'Desc1', priority: 'high' }],
        examples: [{ title: 'Ex1', category: 'cat', antiPattern: { code: 'bad', language: 'js', issues: ['issue1'] }, bestPractice: { code: 'good', language: 'js', benefits: ['benefit1'] } }],
        qualityStandards: { codeQuality: [{ name: 'Std1', description: 'Desc1', enforcement: 'required' }], testing: { unit: { minimum: 80 } }, performance: [{ name: 'Perf1', target: 100, unit: 'ms' }] },
        integrationProtocols: { handoffFrom: [{ agent: 'Agent1', context: 'Ctx1', acceptanceCriteria: ['Crit1'] }], handoffTo: [{ agent: 'Agent2', deliverables: 'Deliv1', qualityGates: ['Gate1'] }] },
        delegationCriteria: { whenToUse: ['Use1'], whenToDelegate: [{ agent: 'DelAgent', triggers: ['Trig1'] }] },
      };

      const result = await transformer.transformAgent(agentData);
      expect(result).toContain('## Mission');
      expect(result).toContain('## Core Responsibilities');
      expect(result).toContain('## Code Examples and Best Practices');
      expect(result).toContain('## Quality Standards');
      expect(result).toContain('## Integration Protocols');
      expect(result).toContain('## Delegation Criteria');
    });

    it('handles minimal agent data', async () => {
      const minimalData = {
        metadata: { name: 'Minimal', description: 'Desc', tools: [], version: '1.0', category: 'cat' },
        mission: { summary: 'Summary' },
        responsibilities: [],
      };
      const result = await transformer.transformAgent(minimalData);
      expect(result).toContain('## Mission');
      expect(result).toContain('## Core Responsibilities');
    });

    it('handles missing optional sections', async () => {
      const data = {
        metadata: { name: 'Test', description: 'Desc', tools: [], version: '1.0', category: 'cat' },
        mission: { summary: 'Summary' },
        responsibilities: [],
      };
      const result = await transformer.transformAgent(data);
      expect(result).not.toContain('## Code Examples');
      expect(result).not.toContain('## Quality Standards');
    });

    it('handles error: invalid data structure', async () => {
      await expect(transformer.transformAgent({})).rejects.toThrow(); // Base class throws, but in practice, validation happens earlier
    });
  });

  describe('transformCommand', () => {
    it('transforms full command data successfully', async () => {
      const commandData = {
        metadata: { name: 'TestCmd', description: 'Desc', version: '1.0', category: 'cat' },
        mission: { summary: 'Mission' },
        workflow: { phases: [{ order: 1, name: 'Phase1', steps: [{ order: 1, title: 'Step1', description: 'Desc1', delegation: { agent: 'Agent1' } }] }] },
        expectedInput: { format: 'JSON', sections: [{ name: 'Sec1', required: true, description: 'Desc1' }] },
        expectedOutput: { format: 'Markdown', structure: [{ name: 'Out1', description: 'Desc1' }] },
      };

      const result = await transformer.transformCommand(commandData);
      expect(result).toContain('## Mission');
      expect(result).toContain('## Workflow');
      expect(result).toContain('## Expected Input');
      expect(result).toContain('## Expected Output');
    });

    it('handles minimal command data', async () => {
      const minimalData = {
        metadata: { name: 'MinimalCmd', description: 'Desc' },
        mission: { summary: 'Summary' },
      };
      const result = await transformer.transformCommand(minimalData);
      expect(result).toContain('## Mission');
    });

    it('handles missing optional sections', async () => {
      const data = {
        metadata: { name: 'Test', description: 'Desc' },
        mission: { summary: 'Summary' },
      };
      const result = await transformer.transformCommand(data);
      expect(result).not.toContain('## Workflow');
      expect(result).not.toContain('## Expected Input');
    });
  });
});