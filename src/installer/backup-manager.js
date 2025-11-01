/**
 * BackupManager
 * Handles backup and restore operations for command migration
 */

const fs = require('fs').promises;
const path = require('path');

class BackupManager {
  constructor(installPath, logger) {
    this.installPath = installPath;
    this.logger = logger;
    this.commandsDir = path.join(installPath, 'commands');
  }

  /**
   * Create rolling backup with timestamp
   * @returns {Promise<string>} Path to created backup directory
   */
  async createBackup() {
    const timestamp = new Date().toISOString()
      .replace(/T/, '-')
      .replace(/:/g, '-')
      .replace(/\./g, '-')
      .substring(0, 23); // Include milliseconds for uniqueness

    const backupPath = path.join(this.installPath, `commands-backup-${timestamp}`);

    this.logger.debug(`Creating backup at: ${backupPath}`);

    try {
      // Create backup directory
      await fs.mkdir(backupPath, { recursive: true });

      // Check if commands directory exists
      try {
        await fs.access(this.commandsDir);
      } catch {
        this.logger.warning('Commands directory does not exist, creating empty backup');
        return backupPath;
      }

      // Copy all files from commands directory
      const files = await fs.readdir(this.commandsDir);

      for (const file of files) {
        const sourcePath = path.join(this.commandsDir, file);
        const targetPath = path.join(backupPath, file);

        const stats = await fs.stat(sourcePath);

        if (stats.isFile()) {
          await fs.copyFile(sourcePath, targetPath);
        } else if (stats.isDirectory()) {
          // Copy subdirectories recursively
          await this.copyDirectory(sourcePath, targetPath);
        }
      }

      this.logger.success(`Backup created: ${backupPath}`);
      return backupPath;
    } catch (error) {
      this.logger.error(`Backup creation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Copy directory recursively
   * @param {string} source - Source directory path
   * @param {string} target - Target directory path
   */
  async copyDirectory(source, target) {
    await fs.mkdir(target, { recursive: true });

    const files = await fs.readdir(source);

    for (const file of files) {
      const sourcePath = path.join(source, file);
      const targetPath = path.join(target, file);

      const stats = await fs.stat(sourcePath);

      if (stats.isFile()) {
        await fs.copyFile(sourcePath, targetPath);
      } else if (stats.isDirectory()) {
        await this.copyDirectory(sourcePath, targetPath);
      }
    }
  }

  /**
   * Restore files from backup
   * @param {string} backupPath - Path to backup directory
   */
  async restore(backupPath) {
    this.logger.info(`Restoring from backup: ${backupPath}`);

    try {
      // Validate backup before restoration
      const isValid = await this.validateBackupIntegrity(backupPath);
      if (!isValid) {
        throw new Error('Backup validation failed');
      }

      // Clear commands directory
      try {
        await fs.rm(this.commandsDir, { recursive: true, force: true });
      } catch {
        // Directory might not exist
      }

      // Recreate commands directory
      await fs.mkdir(this.commandsDir, { recursive: true });

      // Copy all files from backup
      const files = await fs.readdir(backupPath);

      for (const file of files) {
        const sourcePath = path.join(backupPath, file);
        const targetPath = path.join(this.commandsDir, file);

        const stats = await fs.stat(sourcePath);

        if (stats.isFile()) {
          await fs.copyFile(sourcePath, targetPath);
        } else if (stats.isDirectory()) {
          await this.copyDirectory(sourcePath, targetPath);
        }
      }

      this.logger.success('Backup restored successfully');
    } catch (error) {
      this.logger.error(`Backup restoration failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validate backup integrity
   * @param {string} backupPath - Path to backup directory
   * @returns {Promise<boolean>} True if backup is valid
   */
  async validateBackupIntegrity(backupPath) {
    try {
      // Check if backup directory exists
      const stats = await fs.stat(backupPath);
      if (!stats.isDirectory()) {
        this.logger.warning(`Backup path is not a directory: ${backupPath}`);
        return false;
      }

      // Get backup file list
      const backupFiles = await this.getFileList(backupPath);

      // Validate all files are .md or .txt (command files)
      const validFiles = backupFiles.filter(file =>
        file.endsWith('.md') || file.endsWith('.txt')
      );

      // If there are non-command files, backup is corrupted
      if (backupFiles.length > 0 && validFiles.length < backupFiles.length) {
        this.logger.warning(
          `Backup contains invalid files: ${backupFiles.length - validFiles.length} non-command files found`
        );
        return false;
      }

      // Get original file count (if commands directory exists)
      let originalFileCount = 0;
      try {
        const originalFiles = await this.getFileList(this.commandsDir);
        originalFileCount = originalFiles.length;
      } catch {
        // Commands directory might not exist yet
        originalFileCount = 0;
      }

      const backupFileCount = backupFiles.length;

      // If original directory exists, counts should match
      if (originalFileCount > 0 && backupFileCount !== originalFileCount) {
        this.logger.warning(
          `Backup file count mismatch: expected ${originalFileCount}, got ${backupFileCount}`
        );
        return false;
      }

      return true;
    } catch (error) {
      this.logger.warning(`Backup validation error: ${error.message}`);
      return false;
    }
  }

  /**
   * Get list of all files in directory (recursive)
   * @param {string} dirPath - Directory path
   * @returns {Promise<string[]>} Array of file paths
   */
  async getFileList(dirPath) {
    const files = [];

    const entries = await fs.readdir(dirPath);

    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry);
      const stats = await fs.stat(entryPath);

      if (stats.isFile()) {
        files.push(entryPath);
      } else if (stats.isDirectory()) {
        const subFiles = await this.getFileList(entryPath);
        files.push(...subFiles);
      }
    }

    return files;
  }

  /**
   * Cleanup backup after successful migration
   * @param {string} backupPath - Path to backup directory
   */
  async cleanup(backupPath) {
    try {
      await fs.rm(backupPath, { recursive: true, force: true });
      this.logger.debug(`Backup cleaned up: ${backupPath}`);
    } catch (error) {
      // Ignore cleanup errors - backup might not exist
      this.logger.debug(`Backup cleanup error (non-critical): ${error.message}`);
    }
  }
}

module.exports = { BackupManager };
