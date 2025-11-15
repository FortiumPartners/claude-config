/**
 * CommandMigrator
 * Handles migration of AI Mesh commands to ai-mesh/ subdirectory
 */

const fs = require('fs').promises;
const path = require('path');
const { BackupManager } = require('./backup-manager');

class CommandMigrator {
  constructor(installPath, logger, options = {}) {
    this.installPath = installPath;
    this.logger = logger;
    this.options = options;
    this.commandsDir = path.join(installPath, 'commands');
    this.aiMeshDir = path.join(this.commandsDir, 'ai-mesh');
    this.backupManager = new BackupManager(installPath, logger);

    // Expected command files (12 commands × 2 files each = 24 total)
    this.expectedCommands = [
      'create-prd', 'create-trd', 'implement-trd', 'fold-prompt',
      'manager-dashboard', 'analyze-product', 'refine-prd', 'refine-trd',
      'sprint-status', 'playwright-test', 'generate-api-docs', 'web-metrics-dashboard'
    ];
  }

  /**
   * Detect if file contains @ai-mesh-command metadata
   * @param {string} filePath - Path to command file
   * @returns {Promise<boolean>} True if file is an AI Mesh command
   */
  async detectAiMeshCommand(filePath) {
    try {
      const startTime = Date.now();

      // Read file with encoding handling
      let content;
      try {
        content = await fs.readFile(filePath, 'utf8');
      } catch (error) {
        if (error.code === 'ENOENT') {
          throw error; // File not found - throw
        }
        // Encoding error - return false
        this.logger.debug(`Encoding error reading ${filePath}: ${error.message}`);
        return false;
      }

      // Check first 10 lines only for performance
      // Must be in a comment line (# or <!--) and be the primary content, not just mentioned
      const lines = content.split('\n').slice(0, 10);
      const hasMarker = lines.some(line => {
        const trimmed = line.trim();
        // Match markdown comment: # @ai-mesh-command or ## @ai-mesh-command
        // Must be at start of comment, not mentioned later in text
        if (trimmed.match(/^#+\s*@ai-mesh-command/)) {
          return true;
        }
        // Match HTML comment: <!-- @ai-mesh-command --> or <!-- @ai-mesh-command: ... -->
        // Must be the first meaningful content after <!--, not just mentioned in text
        // Only match if followed by --> or : or nothing (whitespace only before -->)
        if (trimmed.match(/^<!--\s*@ai-mesh-command\s*(?::|-->|$)/)) {
          return true;
        }
        return false;
      });

      const duration = Date.now() - startTime;
      if (duration > 10) {
        this.logger.warning(`Metadata detection took ${duration}ms for ${filePath}`);
      }

      return hasMarker;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Scan existing commands and categorize them
   * @returns {Promise<{aiMeshCommands: string[], thirdPartyCommands: string[]}>}
   */
  async scanExistingCommands() {
    const aiMeshCommands = [];
    const thirdPartyCommands = [];

    try {
      const files = await fs.readdir(this.commandsDir);

      for (const file of files) {
        // Skip directories and non-command files
        if (!file.match(/\.(md|txt)$/)) {
          continue;
        }

        const filePath = path.join(this.commandsDir, file);
        const stats = await fs.stat(filePath);

        if (stats.isFile()) {
          const isAiMesh = await this.detectAiMeshCommand(filePath);

          if (isAiMesh) {
            aiMeshCommands.push(file);
          } else {
            thirdPartyCommands.push(file);
          }
        }
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        // Commands directory doesn't exist yet
        return { aiMeshCommands: [], thirdPartyCommands: [] };
      }
      throw error;
    }

    return { aiMeshCommands, thirdPartyCommands };
  }

  /**
   * Create ai-mesh/ subdirectory
   * @returns {Promise<string>} Path to created directory
   */
  async createAiMeshDirectory() {
    try {
      await fs.mkdir(this.aiMeshDir, { recursive: true, mode: 0o755 });

      const stats = await fs.stat(this.aiMeshDir);
      if (!stats.isDirectory()) {
        throw new Error('Failed to create ai-mesh directory');
      }

      this.logger.debug(`Created ai-mesh directory: ${this.aiMeshDir}`);
      return this.aiMeshDir;
    } catch (error) {
      this.logger.error(`Directory creation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Migrate command files to ai-mesh/ subdirectory
   * @param {string[]} files - Array of file names to migrate
   * @returns {Promise<{successes: string[], errors: Array<{file: string, error: string}>}>}
   */
  async migrateCommandFiles(files) {
    const successes = [];
    const errors = [];

    for (const file of files) {
      try {
        const sourcePath = path.join(this.commandsDir, file);
        const targetPath = path.join(this.aiMeshDir, file);

        // Check if source exists
        try {
          await fs.access(sourcePath);
        } catch {
          errors.push({ file, error: 'Source file not found' });
          this.logger.warning(`Source file not found: ${file}`);
          continue;
        }

        // Move file (rename is atomic on same filesystem)
        await fs.rename(sourcePath, targetPath);

        // Validate moved file
        try {
          await fs.access(targetPath);
          successes.push(file);
          this.logger.debug(`Migrated: ${file}`);
        } catch {
          errors.push({ file, error: 'File not found after move' });
        }
      } catch (error) {
        errors.push({ file, error: error.message });
        this.logger.warning(`Failed to migrate ${file}: ${error.message}`);
      }
    }

    return { successes, errors };
  }

  /**
   * Perform complete migration workflow
   * @returns {Promise<{success: boolean, migratedCount: number, errorCount: number, backupPath: string, dryRun: boolean}>}
   */
  async migrate() {
    const startTime = Date.now();

    try {
      this.logger.info('Starting command migration...');

      // Scan existing commands
      const { aiMeshCommands, thirdPartyCommands } = await this.scanExistingCommands();

      this.logger.info(`Found ${aiMeshCommands.length} AI Mesh commands, ${thirdPartyCommands.length} third-party commands`);

      // Dry-run mode
      if (this.options.dryRun) {
        this.logger.info('DRY RUN MODE - No changes will be made');
        return {
          success: true,
          dryRun: true,
          migratedCount: aiMeshCommands.length,
          errorCount: 0,
          backupPath: null
        };
      }

      // Create backup before migration
      const backupPath = await this.backupManager.createBackup();

      // Create ai-mesh directory
      await this.createAiMeshDirectory();

      // Migrate command files
      const result = await this.migrateCommandFiles(aiMeshCommands);

      const duration = Date.now() - startTime;
      this.logger.info(`Migration completed in ${duration}ms`);

      return {
        success: true,
        migratedCount: result.successes.length,
        errorCount: result.errors.length,
        backupPath,
        dryRun: false,
        duration
      };
    } catch (error) {
      this.logger.error(`Migration failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validate migration results
   * @param {Object} options - Validation options
   * @param {string[]} options.expectedCommands - List of command names to validate (optional)
   * @returns {Promise<{valid: boolean, expectedCount: number, actualCount: number, missing: string[]}>}
   */
  async validateMigration(options = {}) {
    const commandsToValidate = options.expectedCommands || this.expectedCommands;
    const expectedFiles = [];

    // Generate expected file list based on provided commands
    for (const cmd of commandsToValidate) {
      expectedFiles.push(`${cmd}.md`);
      expectedFiles.push(`${cmd}.txt`);
    }

    const missing = [];
    let actualCount = 0;

    for (const file of expectedFiles) {
      const filePath = path.join(this.aiMeshDir, file);

      try {
        await fs.access(filePath);
        actualCount++;
      } catch {
        missing.push(file);
      }
    }

    const valid = missing.length === 0;

    if (!valid) {
      this.logger.warning(`Validation failed: ${missing.length} files missing`);
    }

    return {
      valid,
      expectedCount: expectedFiles.length,
      actualCount,
      missing
    };
  }

  /**
   * Rollback migration using backup
   * @param {string} backupPath - Path to backup directory
   */
  async rollback(backupPath) {
    this.logger.warning('Rolling back migration...');

    try {
      // Validate backup exists
      const isValid = await this.backupManager.validateBackupIntegrity(backupPath);
      if (!isValid) {
        throw new Error('Invalid backup - cannot rollback');
      }

      // Restore from backup
      await this.backupManager.restore(backupPath);

      this.logger.success('Rollback completed successfully');
    } catch (error) {
      this.logger.error(`Rollback failed: ${error.message}`);
      throw error;
    }
  }
}

module.exports = { CommandMigrator };
