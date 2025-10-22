/**
 * Skill Installer
 * Handles installation of Claude Code Skills directories
 *
 * Skills are directory-based with SKILL.md, scripts, templates, and optional REFERENCE.md
 * They are installed to .claude/skills/ (local) or ~/.claude/skills/ (global)
 */

const fs = require('fs').promises;
const path = require('path');

class SkillInstaller {
  constructor(installPath, logger, options) {
    this.installPath = installPath;
    this.logger = logger;
    this.options = options || {};
    this.sourceDir = path.join(__dirname, '../../skills');
  }

  /**
   * Install skills to the target directory
   * Skills are copied as-is (directory structure maintained)
   * @param {string} tool - The tool name (e.g., 'claude-code')
   * @returns {Promise<{installed: number, skipped: number}>}
   */
  async install(tool) {
    this.logger.info('🎯 Installing skills...');

    const targetDir = path.join(this.installPath[tool], 'skills');

    // Create skills directory if it doesn't exist
    await fs.mkdir(targetDir, { recursive: true });

    // Check if source skills directory exists
    const sourceExists = await this.directoryExists(this.sourceDir);
    if (!sourceExists) {
      this.logger.warning(`Skills directory not found at ${this.sourceDir}`);
      this.logger.info('Skipping skills installation (no skills to install)');
      return { installed: 0, skipped: 0 };
    }

    // Get all skill directories
    const skillDirs = await this.getSkillDirectories();
    let installed = 0;
    let skipped = 0;

    for (const skillDir of skillDirs) {
      const sourcePath = path.join(this.sourceDir, skillDir);
      const targetPath = path.join(targetDir, skillDir);

      // Validate skill has SKILL.md
      const hasSkillMd = await this.fileExists(path.join(sourcePath, 'SKILL.md'));
      if (!hasSkillMd) {
        this.logger.warning(`⚠️  Skipping ${skillDir}: Missing SKILL.md`);
        skipped++;
        continue;
      }

      // Check if skill already exists and force flag
      const targetExists = await this.directoryExists(targetPath);
      if (targetExists && !this.options.force) {
        this.logger.debug(`Skipping ${skillDir}: Already exists (use --force to overwrite)`);
        skipped++;
        continue;
      }

      // Copy skill directory recursively
      await this.copyDirectory(sourcePath, targetPath);
      this.logger.debug(`✓ Installed skill: ${skillDir}`);
      installed++;
    }

    this.logger.success(`✅ Skills: ${installed} installed, ${skipped} skipped`);
    return { installed, skipped };
  }

  /**
   * Get all skill directories (directories containing SKILL.md)
   * @returns {Promise<string[]>} Array of skill directory names
   */
  async getSkillDirectories() {
    try {
      const entries = await fs.readdir(this.sourceDir, { withFileTypes: true });
      const skillDirs = [];

      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          // Check if directory contains SKILL.md
          const skillMdPath = path.join(this.sourceDir, entry.name, 'SKILL.md');
          if (await this.fileExists(skillMdPath)) {
            skillDirs.push(entry.name);
          }
        }
      }

      return skillDirs;
    } catch (error) {
      this.logger.warning(`Could not read skills directory: ${error.message}`);
      return [];
    }
  }

  /**
   * Validate a skill directory structure
   * @param {string} skillPath - Path to skill directory
   * @returns {Promise<{valid: boolean, errors: string[]}>}
   */
  async validateSkill(skillPath) {
    const errors = [];

    // Required: SKILL.md
    const skillMdPath = path.join(skillPath, 'SKILL.md');
    if (!(await this.fileExists(skillMdPath))) {
      errors.push('Missing required SKILL.md file');
    } else {
      // Validate SKILL.md has YAML frontmatter
      const content = await fs.readFile(skillMdPath, 'utf-8');
      if (!content.startsWith('---')) {
        errors.push('SKILL.md missing YAML frontmatter');
      }

      // Check for required metadata fields
      if (!content.includes('name:') || !content.includes('description:')) {
        errors.push('SKILL.md missing required metadata (name, description)');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Copy directory recursively
   * @param {string} src - Source directory
   * @param {string} dest - Destination directory
   */
  async copyDirectory(src, dest) {
    // Create destination directory
    await fs.mkdir(dest, { recursive: true });

    // Read source directory
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        // Recursively copy subdirectories
        await this.copyDirectory(srcPath, destPath);
      } else {
        // Copy file
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  /**
   * Check if file exists
   * @param {string} filePath - Path to file
   * @returns {Promise<boolean>}
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if directory exists
   * @param {string} dirPath - Path to directory
   * @returns {Promise<boolean>}
   */
  async directoryExists(dirPath) {
    try {
      const stats = await fs.stat(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Get skill information
   * @param {string} skillName - Name of the skill
   * @returns {Promise<Object|null>} Skill metadata or null
   */
  async getSkillInfo(skillName) {
    const skillPath = path.join(this.sourceDir, skillName);
    const skillMdPath = path.join(skillPath, 'SKILL.md');

    if (!(await this.fileExists(skillMdPath))) {
      return null;
    }

    try {
      const content = await fs.readFile(skillMdPath, 'utf-8');
      const yamlMatch = content.match(/^---\n([\s\S]*?)\n---/);

      if (!yamlMatch) {
        return null;
      }

      // Simple YAML parsing for name and description
      const yaml = yamlMatch[1];
      const nameMatch = yaml.match(/name:\s*(.+)/);
      const descMatch = yaml.match(/description:\s*(.+)/);

      return {
        name: nameMatch ? nameMatch[1].trim() : skillName,
        description: descMatch ? descMatch[1].trim() : 'No description',
        path: skillPath
      };
    } catch (error) {
      this.logger.warning(`Could not read skill info for ${skillName}: ${error.message}`);
      return null;
    }
  }
}

module.exports = { SkillInstaller };
