/**
 * Runtime Setup
 * Handles creation and setup of runtime directories for AI Mesh
 */

const fs = require('fs').promises;
const path = require('path');

class RuntimeSetup {
  constructor(installPath, logger) {
    this.installPath = installPath;
    this.logger = logger;
    this.sourceDir = path.join(__dirname, '../../src/monitoring');
  }

  async initialize() {
    this.logger.info('🏗️  Setting up runtime environment...');

    try {
      // Create AI Mesh runtime directories
      await this.createRuntimeDirectories();

      // Deploy monitoring service
      await this.deployMonitoringService();

      // Initialize analytics database if needed
      await this.initializeAnalytics();

      this.logger.success('✅ Runtime environment ready');
      return { success: true };

    } catch (error) {
      this.logger.error(`Failed to setup runtime environment: ${error.message}`);
      throw error;
    }
  }

  async createRuntimeDirectories() {
    const directories = [
      'config',
      'data',
      'logs',
      'state',
      'src'
    ];

    for (const dir of directories) {
      const dirPath = path.join(this.installPath.mesh, dir);
      await fs.mkdir(dirPath, { recursive: true });
      this.logger.debug(`  ✓ Created: ${dir}/`);
    }

    // Create analytics directory with proper permissions
    const analyticsPath = path.join(this.installPath.mesh, '.analytics');
    await fs.mkdir(analyticsPath, { recursive: true });
    this.logger.debug('  ✓ Created: .analytics/');
  }

  async deployMonitoringService() {
    this.logger.info('📊 Deploying monitoring service...');

    const targetSrcDir = path.join(this.installPath.mesh, 'src');

    try {
      // Get monitoring service files
      const files = await fs.readdir(this.sourceDir);

      for (const file of files) {
        if (file.endsWith('.js')) {
          const sourcePath = path.join(this.sourceDir, file);
          const targetPath = path.join(targetSrcDir, file);

          const content = await fs.readFile(sourcePath, 'utf8');
          await fs.writeFile(targetPath, content, 'utf8');

          this.logger.debug(`  ✓ Deployed: ${file}`);
        }
      }

      // Create package.json for monitoring service
      await this.createMonitoringPackageJson(targetSrcDir);

    } catch (error) {
      this.logger.warning(`Could not deploy monitoring service: ${error.message}`);
    }
  }

  async createMonitoringPackageJson(targetDir) {
    const packageJson = {
      name: 'claude-monitoring-service',
      version: '1.0.0',
      description: 'Claude Code monitoring service runtime',
      main: 'file-monitoring-service.js',
      scripts: {
        start: 'node file-monitoring-service.js',
        dev: 'node file-monitoring-service.js --dev'
      },
      dependencies: {
        chokidar: '^3.5.3'
      },
      engines: {
        node: '>=18.0.0'
      }
    };

    const packagePath = path.join(targetDir, 'package.json');
    await fs.writeFile(packagePath, JSON.stringify(packageJson, null, 2));
    this.logger.debug('  ✓ Created: package.json');
  }

  async initializeAnalytics() {
    const analyticsPath = path.join(this.installPath.mesh, '.analytics');

    // Check if analytics database already exists
    const dbPath = path.join(analyticsPath, 'enforcement.db');
    const exists = await this.fileExists(dbPath);

    if (!exists) {
      this.logger.info('📈 Initializing analytics database...');

      try {
        // Create empty database file
        await fs.writeFile(dbPath, '');
        this.logger.debug('  ✓ Created: enforcement.db');
      } catch (error) {
        this.logger.warning(`Could not initialize analytics database: ${error.message}`);
      }
    } else {
      this.logger.debug('  ✓ Analytics database already exists');
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
    const results = {
      directories: {},
      monitoringService: false,
      analytics: false
    };

    // Check runtime directories
    const directories = ['config', 'data', 'logs', 'state', 'src', '.analytics'];
    for (const dir of directories) {
      const dirPath = path.join(this.installPath.mesh, dir);
      results.directories[dir] = await this.fileExists(dirPath);
    }

    // Check monitoring service
    const monitoringPath = path.join(this.installPath.mesh, 'src', 'file-monitoring-service.js');
    results.monitoringService = await this.fileExists(monitoringPath);

    // Check analytics
    const analyticsPath = path.join(this.installPath.aiMesh, '.analytics', 'enforcement.db');
    results.analytics = await this.fileExists(analyticsPath);

    return results;
  }
}

module.exports = { RuntimeSetup };