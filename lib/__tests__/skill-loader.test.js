/**
 * Unit tests for SkillLoader class
 * Target: 80% code coverage
 *
 * Related: TRD-008, docs/TRD/skills-based-framework-agents-trd.md
 */

const fs = require('fs').promises;
const path = require('path');
const SkillLoader = require('../skill-loader');

// Mock fs module
jest.mock('fs', () => ({
  promises: {
    stat: jest.fn(),
    readFile: jest.fn()
  }
}));

describe('SkillLoader', () => {
  let loader;
  let mockPromptUser;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Setup mock prompt function
    mockPromptUser = jest.fn().mockResolvedValue(0);

    // Create loader instance
    loader = new SkillLoader({
      skillsDirectory: '/test/skills',
      agentName: 'backend-developer',
      agentVersion: '3.1.0',
      promptUser: mockPromptUser
    });
  });

  afterEach(() => {
    // Clear cache after each test
    loader.clearCache();
  });

  describe('Constructor', () => {
    test('should initialize with default options', () => {
      const defaultLoader = new SkillLoader();
      expect(defaultLoader.agentName).toBe('unknown-agent');
      expect(defaultLoader.agentVersion).toBe('1.0.0');
      expect(defaultLoader.cache).toBeInstanceOf(Map);
    });

    test('should initialize with custom options', () => {
      expect(loader.skillsDirectory).toBe('/test/skills');
      expect(loader.agentName).toBe('backend-developer');
      expect(loader.agentVersion).toBe('3.1.0');
      expect(loader.promptUser).toBe(mockPromptUser);
    });

    test('should set correct file size limits', () => {
      expect(loader.SKILL_MD_MAX_SIZE).toBe(100 * 1024);
      expect(loader.REFERENCE_MD_MAX_SIZE).toBe(1024 * 1024);
      expect(loader.TEMPLATE_MAX_SIZE).toBe(50 * 1024);
    });
  });

  describe('loadSkill()', () => {
    const mockSkillContent = `---
name: NestJS Framework
version: 1.0.0
framework_versions:
  min: 10.0.0
  max: 11.x
  recommended: 11.4.0
compatible_agents:
  backend-developer: ">=3.0.0"
description: Node.js/TypeScript backend framework
frameworks:
  - nestjs
languages:
  - typescript
---

# NestJS Framework Skill

Quick reference content here.`;

    beforeEach(() => {
      fs.stat.mockResolvedValue({ size: 2048 });
      fs.readFile.mockResolvedValue(mockSkillContent);
    });

    test('should load skill successfully', async () => {
      const result = await loader.loadSkill('nestjs', 'quick');

      expect(result.content).toContain('Quick reference content here');
      expect(result.frontmatter.name).toBe('NestJS Framework');
      expect(result.frontmatter.version).toBe('1.0.0');
      expect(fs.stat).toHaveBeenCalledWith('/test/skills/nestjs-framework/SKILL.md');
      expect(fs.readFile).toHaveBeenCalledWith('/test/skills/nestjs-framework/SKILL.md', 'utf-8');
    });

    test('should cache loaded skill', async () => {
      await loader.loadSkill('nestjs', 'quick');
      await loader.loadSkill('nestjs', 'quick');

      // Should only read from file system once
      expect(fs.readFile).toHaveBeenCalledTimes(1);
      expect(loader.isSkillCached('nestjs')).toBe(true);
    });

    test('should load REFERENCE.md when detail level is comprehensive', async () => {
      const mockReferenceContent = `---
name: NestJS Framework
version: 1.0.0
---

# Comprehensive Reference

Detailed content here.`;

      fs.readFile
        .mockResolvedValueOnce(mockSkillContent)
        .mockResolvedValueOnce(mockReferenceContent);

      await loader.loadSkill('nestjs', 'comprehensive');

      expect(fs.readFile).toHaveBeenCalledWith('/test/skills/nestjs-framework/SKILL.md', 'utf-8');
      expect(fs.readFile).toHaveBeenCalledWith('/test/skills/nestjs-framework/REFERENCE.md', 'utf-8');
    });

    test('should handle file size limit with user prompt', async () => {
      fs.stat.mockResolvedValue({ size: 200 * 1024 }); // 200KB > 100KB limit
      mockPromptUser.mockResolvedValue(0); // Continue with generic patterns

      const result = await loader.loadSkill('nestjs', 'quick');

      expect(result.fallback).toBe(true);
      expect(mockPromptUser).toHaveBeenCalled();
    });

    test('should handle version compatibility failure with user prompt', async () => {
      const incompatibleLoader = new SkillLoader({
        agentName: 'backend-developer',
        agentVersion: '2.0.0', // Too old
        promptUser: mockPromptUser
      });

      mockPromptUser.mockResolvedValue(0); // Continue with generic patterns

      const result = await incompatibleLoader.loadSkill('nestjs', 'quick');

      expect(result.fallback).toBe(true);
      expect(mockPromptUser).toHaveBeenCalled();
    });

    test('should handle skill load error with user prompt', async () => {
      fs.stat.mockRejectedValue(new Error('File not found'));
      mockPromptUser.mockResolvedValue(0); // Continue with generic patterns

      const result = await loader.loadSkill('nestjs', 'quick');

      expect(result.fallback).toBe(true);
      expect(mockPromptUser).toHaveBeenCalled();
    });

    test('should abort on user choice', async () => {
      fs.stat.mockRejectedValue(new Error('File not found'));
      mockPromptUser.mockResolvedValue(1); // Abort task

      await expect(loader.loadSkill('nestjs', 'quick')).rejects.toThrow('aborted by user');
    });

    test('should load alternative framework on user choice', async () => {
      fs.stat
        .mockRejectedValueOnce(new Error('File not found'))
        .mockResolvedValueOnce({ size: 2048 });

      mockPromptUser
        .mockResolvedValueOnce(2) // Specify alternative
        .mockResolvedValueOnce('react');

      fs.readFile.mockResolvedValue(mockSkillContent.replace('NestJS', 'React'));

      const result = await loader.loadSkill('nestjs', 'quick');

      expect(result.frontmatter.name).toContain('React');
    });
  });

  describe('loadTemplate()', () => {
    const mockTemplateContent = `export class {{ClassName}}Controller {
  // Controller implementation
}`;

    beforeEach(() => {
      fs.stat.mockResolvedValue({ size: 512 });
      fs.readFile.mockResolvedValue(mockTemplateContent);
    });

    test('should load template successfully', async () => {
      const result = await loader.loadTemplate('nestjs', 'controller.template.ts');

      expect(result).toContain('Controller implementation');
      expect(fs.stat).toHaveBeenCalledWith('/test/skills/nestjs-framework/templates/controller.template.ts');
      expect(fs.readFile).toHaveBeenCalledWith('/test/skills/nestjs-framework/templates/controller.template.ts', 'utf-8');
    });

    test('should cache loaded template', async () => {
      await loader.loadTemplate('nestjs', 'controller.template.ts');
      await loader.loadTemplate('nestjs', 'controller.template.ts');

      expect(fs.readFile).toHaveBeenCalledTimes(1);
    });

    test('should reject if template exceeds size limit', async () => {
      fs.stat.mockResolvedValue({ size: 100 * 1024 }); // 100KB > 50KB limit

      await expect(loader.loadTemplate('nestjs', 'controller.template.ts')).rejects.toThrow('exceeds');
    });

    test('should throw error if template not found', async () => {
      fs.stat.mockRejectedValue(new Error('ENOENT'));

      await expect(loader.loadTemplate('nestjs', 'missing.template.ts')).rejects.toThrow('Failed to load template');
    });
  });

  describe('isSkillCached()', () => {
    test('should return false for uncached skill', () => {
      expect(loader.isSkillCached('nestjs')).toBe(false);
    });

    test('should return true for cached skill', async () => {
      fs.stat.mockResolvedValue({ size: 2048 });
      fs.readFile.mockResolvedValue('---\nname: Test\n---\nContent');

      await loader.loadSkill('nestjs', 'quick');

      expect(loader.isSkillCached('nestjs')).toBe(true);
    });
  });

  describe('clearCache()', () => {
    test('should clear all cached entries', async () => {
      fs.stat.mockResolvedValue({ size: 2048 });
      fs.readFile.mockResolvedValue('---\nname: Test\n---\nContent');

      await loader.loadSkill('nestjs', 'quick');
      expect(loader.isSkillCached('nestjs')).toBe(true);

      loader.clearCache();

      expect(loader.isSkillCached('nestjs')).toBe(false);
      expect(loader.cache.size).toBe(0);
    });
  });

  describe('getCacheStats()', () => {
    test('should return empty stats for empty cache', () => {
      const stats = loader.getCacheStats();

      expect(stats.totalEntries).toBe(0);
      expect(stats.totalSize).toBe(0);
      expect(stats.entries).toEqual([]);
    });

    test('should return cache statistics', async () => {
      fs.stat.mockResolvedValue({ size: 2048 });
      fs.readFile.mockResolvedValue('---\nname: Test\n---\nContent');

      await loader.loadSkill('nestjs', 'quick');

      const stats = loader.getCacheStats();

      expect(stats.totalEntries).toBe(1);
      expect(stats.totalSize).toBeGreaterThan(0);
      expect(stats.entries).toHaveLength(1);
      expect(stats.entries[0]).toHaveProperty('path');
      expect(stats.entries[0]).toHaveProperty('size');
      expect(stats.entries[0]).toHaveProperty('loadedAt');
    });
  });

  describe('_sanitizeContent()', () => {
    test('should remove script tags', () => {
      const content = '<script>alert("xss")</script>Content here';
      const sanitized = loader._sanitizeContent(content);

      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toContain('Content here');
    });

    test('should remove HTML tags', () => {
      const content = '<div>Content</div><span>here</span>';
      const sanitized = loader._sanitizeContent(content);

      expect(sanitized).not.toContain('<div>');
      expect(sanitized).not.toContain('<span>');
      expect(sanitized).toContain('Content');
      expect(sanitized).toContain('here');
    });

    test('should preserve markdown', () => {
      const content = '# Heading\n\n**Bold** and *italic*';
      const sanitized = loader._sanitizeContent(content);

      expect(sanitized).toContain('# Heading');
      expect(sanitized).toContain('**Bold**');
      expect(sanitized).toContain('*italic*');
    });

    test('should log warning when sanitization occurs', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const content = '<script>alert("xss")</script>Content';

      loader._sanitizeContent(content);

      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('sanitization applied'));
      consoleWarnSpy.mockRestore();
    });
  });

  describe('_parseFrontmatter()', () => {
    test('should parse valid frontmatter', () => {
      const content = `---
name: Test
version: 1.0.0
---

Body content`;

      const result = loader._parseFrontmatter(content);

      expect(result.frontmatter.name).toBe('Test');
      expect(result.frontmatter.version).toBe('1.0.0');
      expect(result.body).toContain('Body content');
    });

    test('should handle content without frontmatter', () => {
      const content = 'Just plain content';

      const result = loader._parseFrontmatter(content);

      expect(result.frontmatter).toEqual({});
      expect(result.body).toBe('Just plain content');
    });

    test('should throw error for invalid YAML', () => {
      const content = `---
invalid: yaml: structure:
---

Body`;

      expect(() => loader._parseFrontmatter(content)).toThrow('Failed to parse YAML frontmatter');
    });
  });

  describe('_validateCompatibility()', () => {
    test('should pass for compatible version', async () => {
      const frontmatter = {
        compatible_agents: {
          'backend-developer': '>=3.0.0'
        }
      };

      await expect(loader._validateCompatibility(frontmatter)).resolves.not.toThrow();
    });

    test('should throw for incompatible version', async () => {
      const incompatibleLoader = new SkillLoader({
        agentName: 'backend-developer',
        agentVersion: '2.0.0'
      });

      const frontmatter = {
        compatible_agents: {
          'backend-developer': '>=3.0.0'
        }
      };

      await expect(incompatibleLoader._validateCompatibility(frontmatter)).rejects.toThrow();
    });

    test('should pass when no compatibility requirements', async () => {
      await expect(loader._validateCompatibility({})).resolves.not.toThrow();
    });

    test('should pass when agent not in requirements', async () => {
      const frontmatter = {
        compatible_agents: {
          'other-agent': '>=1.0.0'
        }
      };

      await expect(loader._validateCompatibility(frontmatter)).resolves.not.toThrow();
    });
  });

  describe('_getSkillPath()', () => {
    test('should construct correct skill path', () => {
      const skillPath = loader._getSkillPath('nestjs', 'SKILL.md');

      expect(skillPath).toBe('/test/skills/nestjs-framework/SKILL.md');
    });

    test('should work with different filenames', () => {
      const referencePath = loader._getSkillPath('react', 'REFERENCE.md');

      expect(referencePath).toBe('/test/skills/react-framework/REFERENCE.md');
    });
  });

  describe('Integration: Full workflow', () => {
    test('should complete full skill loading workflow', async () => {
      const mockSkillContent = `---
name: NestJS Framework
version: 1.0.0
framework_versions:
  min: 10.0.0
  recommended: 11.4.0
compatible_agents:
  backend-developer: ">=3.0.0"
description: Test description
frameworks: [nestjs]
languages: [typescript]
---

# NestJS Skill

Quick reference content.`;

      fs.stat.mockResolvedValue({ size: 2048 });
      fs.readFile.mockResolvedValue(mockSkillContent);

      // Load skill
      const skill = await loader.loadSkill('nestjs', 'quick');

      // Verify result
      expect(skill.content).toContain('Quick reference content');
      expect(skill.frontmatter.name).toBe('NestJS Framework');

      // Verify caching
      expect(loader.isSkillCached('nestjs')).toBe(true);

      // Verify stats
      const stats = loader.getCacheStats();
      expect(stats.totalEntries).toBe(1);

      // Load again (should use cache)
      await loader.loadSkill('nestjs', 'quick');
      expect(fs.readFile).toHaveBeenCalledTimes(1);
    });
  });
});
