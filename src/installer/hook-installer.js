/**
 * Hook Installer
 * Handles installation of Claude hook files and dependencies
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

class HookInstaller {
  constructor(installPath, logger) {
    this.installPath = installPath;
    this.logger = logger;
    this.sourceDir = path.join(__dirname, '../../hooks');
    this.targetDir = path.join(installPath.claude, 'hooks');
  }

  async install() {
    this.logger.info('🪝 Installing hooks...');

    try {
      // Ensure target directory exists
      await fs.mkdir(this.targetDir, { recursive: true });

      // Get list of hook files
      const hookFiles = await this.getHookFiles();

      if (hookFiles.length === 0) {
        this.logger.warning('No hook files found to install');
        return { installed: 0, skipped: 0 };
      }

      let installed = 0;
      let skipped = 0;

      // Install each hook file
      for (const hookFile of hookFiles) {
        const sourcePath = path.join(this.sourceDir, hookFile);
        const targetPath = path.join(this.targetDir, hookFile);

        try {
          // Read source file
          const content = await fs.readFile(sourcePath, 'utf8');

          // Check if target exists
          const exists = await this.fileExists(targetPath);
          if (exists) {
            this.logger.debug(`Overwriting existing hook: ${hookFile}`);
          }

          // Write to target
          await fs.writeFile(targetPath, content, 'utf8');

          // Make executable if it's a script
          if (hookFile.endsWith('.js') || hookFile.endsWith('.sh')) {
            try {
              await fs.chmod(targetPath, 0o755);
            } catch (chmodError) {
              this.logger.debug(`Could not set executable permissions on ${hookFile}`);
            }
          }

          this.logger.debug(`  ✓ Installed: ${hookFile}`);
          installed++;

        } catch (error) {
          this.logger.warning(`  ⚠ Failed to install ${hookFile}: ${error.message}`);
          skipped++;
        }
      }

      // Install hook dependencies if package.json exists
      await this.installDependencies();

      this.logger.success(`✅ Hooks: ${installed} installed, ${skipped} skipped`);
      return { installed, skipped };

    } catch (error) {
      this.logger.error(`Failed to install hooks: ${error.message}`);
      throw error;
    }
  }

  async installDependencies() {
    const packageJsonPath = path.join(this.sourceDir, 'package.json');
    const targetPackageJsonPath = path.join(this.targetDir, 'package.json');

    try {
      // Check if source package.json exists
      await fs.access(packageJsonPath);

      // Copy package.json to target
      const packageContent = await fs.readFile(packageJsonPath, 'utf8');
      await fs.writeFile(targetPackageJsonPath, packageContent, 'utf8');

      // Install dependencies
      this.logger.info('📦 Installing hook dependencies...');

      try {
        execSync('npm install --production --silent', {
          cwd: this.targetDir,
          stdio: 'pipe'
        });
        this.logger.success('✅ Hook dependencies installed');
      } catch (npmError) {
        this.logger.warning('⚠ Failed to install hook dependencies - hooks may not work properly');
        this.logger.debug(`NPM error: ${npmError.message}`);
      }

    } catch (error) {
      // package.json doesn't exist, that's okay
      this.logger.debug('No package.json found for hooks');
    }
  }

  async getHookFiles() {
    try {
      const files = await fs.readdir(this.sourceDir);
      return files.filter(file =>
        (file.endsWith('.js') || file.endsWith('.sh') || file.endsWith('.json')) &&
        file !== 'package.json' &&
        file !== 'package-lock.json' &&
        !file.includes('-test')
      );
    } catch (error) {
      this.logger.warning(`Could not read hooks directory: ${error.message}`);
      return [];
    }
  }

  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async validate() {
    const hookFiles = await this.getHookFiles();
    const results = {
      total: hookFiles.length,
      installed: 0,
      missing: [],
      dependenciesInstalled: false
    };

    for (const hookFile of hookFiles) {
      const targetPath = path.join(this.targetDir, hookFile);
      const exists = await this.fileExists(targetPath);

      if (exists) {
        results.installed++;
      } else {
        results.missing.push(hookFile);
      }
    }

    // Check if dependencies are installed
    const nodeModulesPath = path.join(this.targetDir, 'node_modules');
    results.dependenciesInstalled = await this.fileExists(nodeModulesPath);

    return results;
  }
}

module.exports = { HookInstaller };