/**
 * Command Installer
 * Handles installation of Claude command files
 */

const fs = require('fs').promises;
const path = require('path');
const { YamlParser } = require('../parsers/yaml-parser');
const { TransformerFactory } = require('../transformers/transformer-factory');

class CommandInstaller {
  constructor(installPath, logger, options) {
    this.installPath = installPath;
    this.logger = logger;
    this.options = options || {};
    this.sourceDir = path.join(__dirname, '../../commands');
  }

  async install(tool) {
    this.logger.info('⚡ Installing commands...');

    const yamlDir = path.join(__dirname, '../../commands/yaml');
    const targetDir = path.join(this.installPath[tool], 'commands');

    await fs.mkdir(targetDir, { recursive: true });

    const yamlFiles = await fs.readdir(yamlDir);
    let installed = 0;
    let skipped = 0;

    const parser = new YamlParser(this.logger);
    const factory = new TransformerFactory(this.logger);
    const transformer = factory.getTransformer(tool);

    for (const yamlFile of yamlFiles) {
      if (yamlFile.endsWith('.yaml')) {
        const yamlPath = path.join(yamlDir, yamlFile);
        const targetFile = yamlFile.replace('.yaml', transformer.getFileExtension());
        const targetPath = path.join(targetDir, targetFile);

        if (this.options.force || !(await this.fileExists(targetPath))) {
          const data = await parser.parse(yamlPath);
          const transformed = await transformer.transformCommand(data);
          await fs.writeFile(targetPath, transformed);
          installed++;
        } else {
          skipped++;
        }
      }
    }

    this.logger.success(`✅ Commands: ${installed} installed, ${skipped} skipped for ${tool}`);
    return { installed, skipped };
  }

  async getCommandFiles() {
    try {
      const files = await fs.readdir(this.sourceDir);
      return files.filter(file =>
        file.endsWith('.md') &&
        !file.includes('-test')
      );
    } catch (error) {
      this.logger.warning(`Could not read commands directory: ${error.message}`);
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
    const commandFiles = await this.getCommandFiles();
    const results = {
      total: commandFiles.length,
      installed: 0,
      missing: []
    };

    for (const commandFile of commandFiles) {
      const targetPath = path.join(this.targetDir, commandFile);
      const exists = await this.fileExists(targetPath);

      if (exists) {
        results.installed++;
      } else {
        results.missing.push(commandFile);
      }
    }

    return results;
  }
}

module.exports = { CommandInstaller };
