/**
 * SkillLoader - Session-based skill loading and caching system
 *
 * Implements lazy loading of framework skills with:
 * - Session-lifetime memory caching
 * - File size validation (100KB SKILL.md, 1MB REFERENCE.md)
 * - Content sanitization (HTML/script removal)
 * - Version compatibility validation
 * - Error handling with user prompts
 *
 * Related: TRD-003, docs/TRD/skills-based-framework-agents-trd.md
 */

const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const { validateSkillCompatibility, validateFrameworkVersion } = require('./version-compatibility');

class SkillLoader {
  /**
   * Create a new SkillLoader instance
   * @param {Object} options - Configuration options
   * @param {string} options.skillsDirectory - Root directory for skills (default: 'skills/')
   * @param {string} options.agentName - Name of the agent loading skills
   * @param {string} options.agentVersion - Version of the agent (for compatibility checks)
   * @param {Function} options.promptUser - Function to prompt user for decisions (optional)
   */
  constructor(options = {}) {
    this.skillsDirectory = options.skillsDirectory || path.join(process.cwd(), 'skills');
    this.agentName = options.agentName || 'unknown-agent';
    this.agentVersion = options.agentVersion || '1.0.0';
    this.promptUser = options.promptUser || this._defaultPrompt;

    // Session cache: skillPath → { content, frontmatter, loadedAt }
    this.cache = new Map();

    // File size limits (bytes)
    this.SKILL_MD_MAX_SIZE = 100 * 1024; // 100KB
    this.REFERENCE_MD_MAX_SIZE = 1024 * 1024; // 1MB
    this.TEMPLATE_MAX_SIZE = 50 * 1024; // 50KB
  }

  /**
   * Load a framework skill
   * @param {string} framework - Framework identifier (e.g., 'nestjs', 'react')
   * @param {string} detailLevel - 'quick' (SKILL.md only) or 'comprehensive' (includes REFERENCE.md)
   * @returns {Promise<Object>} Skill content with frontmatter and body
   */
  async loadSkill(framework, detailLevel = 'quick') {
    const skillPath = this._getSkillPath(framework, 'SKILL.md');

    // Check cache first
    if (this.cache.has(skillPath)) {
      const cached = this.cache.get(skillPath);

      // Load REFERENCE.md if comprehensive detail needed
      if (detailLevel === 'comprehensive') {
        const referencePath = this._getSkillPath(framework, 'REFERENCE.md');
        if (!this.cache.has(referencePath)) {
          await this._loadAndCacheFile(referencePath, this.REFERENCE_MD_MAX_SIZE);
        }
      }

      return cached;
    }

    try {
      // Load and cache SKILL.md
      const skillData = await this._loadAndCacheFile(skillPath, this.SKILL_MD_MAX_SIZE);

      // Validate compatibility
      await this._validateCompatibility(skillData.frontmatter);

      // Load REFERENCE.md if comprehensive detail needed
      if (detailLevel === 'comprehensive') {
        const referencePath = this._getSkillPath(framework, 'REFERENCE.md');
        await this._loadAndCacheFile(referencePath, this.REFERENCE_MD_MAX_SIZE);
      }

      return skillData;
    } catch (error) {
      // Handle errors with user prompt
      return await this._handleSkillLoadError(framework, error);
    }
  }

  /**
   * Load a code generation template
   * @param {string} framework - Framework identifier
   * @param {string} templateName - Template filename (e.g., 'controller.template.ts')
   * @returns {Promise<string>} Template content
   */
  async loadTemplate(framework, templateName) {
    const templatePath = path.join(
      this.skillsDirectory,
      `${framework}-framework`,
      'templates',
      templateName
    );

    // Check cache
    if (this.cache.has(templatePath)) {
      return this.cache.get(templatePath).content;
    }

    try {
      // Validate file size
      const stats = await fs.stat(templatePath);
      if (stats.size > this.TEMPLATE_MAX_SIZE) {
        throw new Error(`Template file exceeds ${this.TEMPLATE_MAX_SIZE} bytes: ${stats.size} bytes`);
      }

      // Load template content
      const content = await fs.readFile(templatePath, 'utf-8');

      // Cache (templates don't need sanitization or frontmatter parsing)
      this.cache.set(templatePath, { content, loadedAt: Date.now() });

      return content;
    } catch (error) {
      throw new Error(`Failed to load template '${templateName}' for ${framework}: ${error.message}`);
    }
  }

  /**
   * Check if a skill is cached
   * @param {string} framework - Framework identifier
   * @returns {boolean} True if skill is in cache
   */
  isSkillCached(framework) {
    const skillPath = this._getSkillPath(framework, 'SKILL.md');
    return this.cache.has(skillPath);
  }

  /**
   * Clear the entire skill cache (useful for testing or forced refresh)
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    const entries = Array.from(this.cache.entries());
    return {
      totalEntries: entries.length,
      totalSize: entries.reduce((sum, [, data]) => sum + (data.content?.length || 0), 0),
      entries: entries.map(([path, data]) => ({
        path,
        size: data.content?.length || 0,
        loadedAt: data.loadedAt
      }))
    };
  }

  /**
   * Internal: Load file, validate size, sanitize content, parse frontmatter, and cache
   * @private
   */
  async _loadAndCacheFile(filePath, maxSize) {
    // Validate file exists and size
    const stats = await fs.stat(filePath);
    if (stats.size > maxSize) {
      throw new Error(`File exceeds size limit: ${stats.size} bytes (max: ${maxSize} bytes)`);
    }

    // Read file content
    let content = await fs.readFile(filePath, 'utf-8');

    // Sanitize content (remove HTML/script tags)
    content = this._sanitizeContent(content);

    // Parse frontmatter if present
    const { frontmatter, body } = this._parseFrontmatter(content);

    // Cache result
    const cacheData = {
      content: body,
      frontmatter,
      loadedAt: Date.now()
    };
    this.cache.set(filePath, cacheData);

    return cacheData;
  }

  /**
   * Internal: Sanitize markdown content (remove HTML/script tags)
   * @private
   */
  _sanitizeContent(content) {
    // Remove script tags and their content
    content = content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

    // Remove all HTML tags (but preserve markdown)
    content = content.replace(/<[^>]+>/g, '');

    // Log sanitization action (for security audit)
    if (content !== arguments[0]) {
      console.warn('[SkillLoader] Content sanitization applied: HTML/script tags removed');
    }

    return content;
  }

  /**
   * Internal: Parse YAML frontmatter from markdown content
   * @private
   */
  _parseFrontmatter(content) {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);

    if (!match) {
      // No frontmatter found
      return { frontmatter: {}, body: content };
    }

    try {
      const frontmatter = yaml.load(match[1]);
      const body = match[2];
      return { frontmatter, body };
    } catch (error) {
      throw new Error(`Failed to parse YAML frontmatter: ${error.message}`);
    }
  }

  /**
   * Internal: Validate skill version compatibility with agent
   * @private
   */
  async _validateCompatibility(frontmatter) {
    const result = validateSkillCompatibility(frontmatter, this.agentName, this.agentVersion);

    if (!result.compatible) {
      throw new Error(result.reason);
    }

    // Log compatibility info for debugging
    if (result.reason) {
      console.log(`[SkillLoader] ${result.reason}`);
    }
  }


  /**
   * Internal: Handle skill load errors with user prompts
   * @private
   */
  async _handleSkillLoadError(framework, error) {
    const message = `Failed to load skill '${framework}-framework': ${error.message}

Options:
1. Continue with generic patterns (may have reduced framework specificity)
2. Abort task and resolve skill issue first
3. Manually specify alternative skill or framework`;

    const userChoice = await this.promptUser(message, [
      'Continue with generic patterns',
      'Abort task',
      'Specify alternative'
    ]);

    switch (userChoice) {
      case 0: // Continue with generic patterns
        console.warn(`[SkillLoader] Continuing without ${framework} skill - using generic patterns`);
        return {
          content: '',
          frontmatter: {},
          fallback: true
        };

      case 1: // Abort task
        throw new Error(`Skill loading aborted by user: ${error.message}`);

      case 2: // Specify alternative
        const alternative = await this.promptUser(
          'Enter alternative framework name (e.g., nestjs, react):',
          [] // Free-form input
        );
        return await this.loadSkill(alternative);

      default:
        throw error;
    }
  }

  /**
   * Internal: Default prompt implementation (for testing/fallback)
   * @private
   */
  async _defaultPrompt(message, options) {
    console.log(`[SkillLoader Prompt] ${message}`);
    if (options.length > 0) {
      options.forEach((opt, idx) => console.log(`  ${idx + 1}. ${opt}`));
    }
    // Default to option 0 (continue with generic patterns)
    return 0;
  }

  /**
   * Internal: Construct skill file path
   * @private
   */
  _getSkillPath(framework, filename) {
    return path.join(this.skillsDirectory, `${framework}-framework`, filename);
  }
}

module.exports = SkillLoader;
