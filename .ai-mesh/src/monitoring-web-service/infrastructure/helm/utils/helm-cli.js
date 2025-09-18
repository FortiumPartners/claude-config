/**
 * Helm CLI Wrapper
 * 
 * Provides a comprehensive wrapper around Helm CLI commands with:
 * - Error handling and validation
 * - Command execution monitoring
 * - Output parsing and formatting
 * - Security and safety checks
 * 
 * Part of: Task 3.1 - Helm Deployment Engine Implementation
 */

const { spawn, exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');

const execAsync = promisify(exec);

/**
 * Helm CLI Wrapper Class
 * 
 * Handles all interactions with the Helm CLI binary, providing:
 * - Safe command execution with timeout and error handling
 * - Output parsing and structured data returns
 * - Version compatibility checking
 * - Command validation and sanitization
 */
class HelmCLI {
  constructor(config = {}) {
    this.config = {
      helmBinary: config.helmBinary || 'helm',
      timeout: config.timeout || 300000, // 5 minutes
      maxBuffer: config.maxBuffer || 1024 * 1024 * 10, // 10MB
      kubeconfig: config.kubeconfig || process.env.KUBECONFIG,
      namespace: config.namespace || 'default',
      debug: config.debug || false,
      ...config
    };

    this.supportedVersions = ['v3.8', 'v3.9', 'v3.10', 'v3.11', 'v3.12', 'v3.13', 'v3.14'];
    this.helmVersion = null;
  }

  /**
   * Initialize Helm CLI and verify installation
   * 
   * @returns {Promise<object>} Helm version and capability information
   */
  async initialize() {
    try {
      // Check Helm installation and version
      const versionInfo = await this._executeCommand(['version', '--short']);
      this.helmVersion = this._parseVersion(versionInfo);
      
      // Validate Helm version compatibility
      if (!this._isVersionSupported(this.helmVersion)) {
        throw new Error(`Unsupported Helm version: ${this.helmVersion}. Supported versions: ${this.supportedVersions.join(', ')}`);
      }

      // Verify Kubernetes connectivity
      const clusterInfo = await this._executeCommand(['version', '--short', '--client=false']);
      
      return {
        helmVersion: this.helmVersion,
        clusterConnected: clusterInfo.includes('Server'),
        kubeconfig: this.config.kubeconfig,
        capabilities: await this._getHelmCapabilities()
      };
    } catch (error) {
      throw new Error(`Failed to initialize Helm CLI: ${error.message}`);
    }
  }

  /**
   * Install a Helm chart
   * 
   * @param {string} releaseName - Name for the release
   * @param {string} chartPath - Path to the chart
   * @param {object} values - Values to override
   * @param {object} options - Additional options
   * @returns {Promise<object>} Installation result
   */
  async install(releaseName, chartPath, values = {}, options = {}) {
    const args = ['install', releaseName, chartPath];
    
    // Add namespace
    if (this.config.namespace) {
      args.push('--namespace', this.config.namespace);
      args.push('--create-namespace');
    }

    // Add values
    if (Object.keys(values).length > 0) {
      const valuesFile = await this._createTempValuesFile(values);
      args.push('--values', valuesFile);
    }

    // Add options
    this._addCommonOptions(args, options);

    try {
      const output = await this._executeCommand(args);
      const result = this._parseInstallOutput(output);
      
      return {
        success: true,
        releaseName,
        revision: result.revision,
        status: result.status,
        namespace: this.config.namespace,
        output,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Helm install failed: ${error.message}`);
    }
  }

  /**
   * Upgrade a Helm release
   * 
   * @param {string} releaseName - Name of the release to upgrade
   * @param {string} chartPath - Path to the chart
   * @param {object} values - Values to override
   * @param {object} options - Additional options
   * @returns {Promise<object>} Upgrade result
   */
  async upgrade(releaseName, chartPath, values = {}, options = {}) {
    const args = ['upgrade', releaseName, chartPath];
    
    // Add namespace
    if (this.config.namespace) {
      args.push('--namespace', this.config.namespace);
    }

    // Add values
    if (Object.keys(values).length > 0) {
      const valuesFile = await this._createTempValuesFile(values);
      args.push('--values', valuesFile);
    }

    // Add options
    this._addCommonOptions(args, options);

    try {
      const output = await this._executeCommand(args);
      const result = this._parseUpgradeOutput(output);
      
      return {
        success: true,
        releaseName,
        revision: result.revision,
        status: result.status,
        namespace: this.config.namespace,
        output,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Helm upgrade failed: ${error.message}`);
    }
  }

  /**
   * Rollback a Helm release
   * 
   * @param {string} releaseName - Name of the release to rollback
   * @param {string} namespace - Target namespace
   * @param {number} revision - Target revision (optional)
   * @param {object} options - Additional options
   * @returns {Promise<object>} Rollback result
   */
  async rollback(releaseName, namespace = null, revision = null, options = {}) {
    const args = ['rollback', releaseName];
    
    if (revision) {
      args.push(revision.toString());
    }

    // Add namespace
    if (namespace || this.config.namespace) {
      args.push('--namespace', namespace || this.config.namespace);
    }

    // Add options
    this._addCommonOptions(args, options);
    
    // Add rollback-specific options
    if (options.cleanupOnFail) {
      args.push('--cleanup-on-fail');
    }

    try {
      const output = await this._executeCommand(args);
      const result = this._parseRollbackOutput(output);
      
      return {
        success: true,
        releaseName,
        targetRevision: revision,
        currentRevision: result.revision,
        namespace: namespace || this.config.namespace,
        output,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        releaseName,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Delete a Helm release
   * 
   * @param {string} releaseName - Name of the release to delete
   * @param {object} options - Additional options
   * @returns {Promise<object>} Deletion result
   */
  async delete(releaseName, options = {}) {
    const args = ['delete', releaseName];
    
    // Add namespace
    if (this.config.namespace) {
      args.push('--namespace', this.config.namespace);
    }

    // Add options
    if (options.keepHistory) {
      args.push('--keep-history');
    }
    if (options.cascade !== false) {
      args.push('--cascade=foreground');
    }

    try {
      const output = await this._executeCommand(args);
      
      return {
        success: true,
        releaseName,
        namespace: this.config.namespace,
        keepHistory: !!options.keepHistory,
        output,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Helm delete failed: ${error.message}`);
    }
  }

  /**
   * Get status of a Helm release
   * 
   * @param {string} releaseName - Name of the release
   * @param {string} namespace - Namespace (optional)
   * @returns {Promise<object>} Release status
   */
  async getStatus(releaseName, namespace = null) {
    const args = ['status', releaseName, '--output', 'json'];
    
    if (namespace || this.config.namespace) {
      args.push('--namespace', namespace || this.config.namespace);
    }

    try {
      const output = await this._executeCommand(args);
      const status = JSON.parse(output);
      
      return {
        name: status.name,
        namespace: status.namespace,
        revision: status.version,
        status: status.info.status,
        lastDeployed: status.info.last_deployed,
        notes: status.info.notes,
        chart: status.chart.metadata.name,
        chartVersion: status.chart.metadata.version,
        appVersion: status.chart.metadata.appVersion
      };
    } catch (error) {
      if (error.message.includes('not found')) {
        return null;
      }
      throw new Error(`Failed to get release status: ${error.message}`);
    }
  }

  /**
   * Get release information
   * 
   * @param {string} releaseName - Name of the release
   * @param {string} namespace - Namespace (optional)
   * @returns {Promise<object>} Release information
   */
  async getRelease(releaseName, namespace = null) {
    const args = ['get', 'all', releaseName, '--output', 'json'];
    
    if (namespace || this.config.namespace) {
      args.push('--namespace', namespace || this.config.namespace);
    }

    try {
      const output = await this._executeCommand(args);
      const release = JSON.parse(output);
      
      return {
        name: release.name,
        namespace: release.namespace,
        revision: release.version,
        status: release.info.status,
        chart: release.chart.metadata.name,
        chartVersion: release.chart.metadata.version,
        values: release.config,
        manifest: release.manifest,
        hooks: release.hooks || []
      };
    } catch (error) {
      throw new Error(`Failed to get release: ${error.message}`);
    }
  }

  /**
   * List all releases
   * 
   * @param {string} namespace - Namespace (optional)
   * @param {object} options - Additional options
   * @returns {Promise<Array>} List of releases
   */
  async listReleases(namespace = null, options = {}) {
    const args = ['list', '--output', 'json'];
    
    if (namespace || this.config.namespace) {
      args.push('--namespace', namespace || this.config.namespace);
    }

    if (options.allNamespaces) {
      args.push('--all-namespaces');
    }

    if (options.includeUninstalled) {
      args.push('--uninstalled');
    }

    try {
      const output = await this._executeCommand(args);
      const releases = JSON.parse(output) || [];
      
      return releases.map(release => ({
        name: release.name,
        namespace: release.namespace,
        revision: release.revision,
        status: release.status,
        chart: release.chart,
        appVersion: release.app_version,
        updated: release.updated
      }));
    } catch (error) {
      throw new Error(`Failed to list releases: ${error.message}`);
    }
  }

  /**
   * Get release history
   * 
   * @param {string} releaseName - Name of the release
   * @param {string} namespace - Namespace (optional)
   * @returns {Promise<Array>} Release history
   */
  async getHistory(releaseName, namespace = null) {
    const args = ['history', releaseName, '--output', 'json'];
    
    if (namespace || this.config.namespace) {
      args.push('--namespace', namespace || this.config.namespace);
    }

    try {
      const output = await this._executeCommand(args);
      const history = JSON.parse(output) || [];
      
      return history.map(entry => ({
        revision: entry.revision,
        updated: entry.updated,
        status: entry.status,
        chart: entry.chart,
        appVersion: entry.app_version,
        description: entry.description
      }));
    } catch (error) {
      throw new Error(`Failed to get release history: ${error.message}`);
    }
  }

  /**
   * Get release history (alias for compatibility with rollback automation)
   * 
   * @param {string} releaseName - Name of the release
   * @param {string} namespace - Namespace (optional)
   * @returns {Promise<Array>} Release history
   */
  async getReleaseHistory(releaseName, namespace = null) {
    return this.getHistory(releaseName, namespace);
  }

  /**
   * Validate a chart
   * 
   * @param {string} chartPath - Path to the chart
   * @returns {Promise<object>} Validation result
   */
  async validateChart(chartPath) {
    const args = ['lint', chartPath];

    try {
      const output = await this._executeCommand(args);
      
      return {
        valid: !output.includes('ERROR'),
        warnings: this._extractWarnings(output),
        errors: this._extractErrors(output),
        output
      };
    } catch (error) {
      return {
        valid: false,
        errors: [error.message],
        warnings: [],
        output: error.message
      };
    }
  }

  /**
   * Perform dry run of an operation
   * 
   * @param {string} operation - Operation type (install/upgrade)
   * @param {string} releaseName - Release name
   * @param {string} chartPath - Chart path
   * @param {object} values - Values
   * @param {object} options - Options
   * @returns {Promise<object>} Dry run result
   */
  async dryRun(operation, releaseName, chartPath, values = {}, options = {}) {
    const args = [operation, releaseName, chartPath, '--dry-run'];
    
    if (this.config.namespace) {
      args.push('--namespace', this.config.namespace);
    }

    if (Object.keys(values).length > 0) {
      const valuesFile = await this._createTempValuesFile(values);
      args.push('--values', valuesFile);
    }

    try {
      const output = await this._executeCommand(args);
      
      return {
        success: true,
        manifest: output,
        resources: this._parseManifestResources(output)
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Private Methods

  async _executeCommand(args, options = {}) {
    const command = `${this.config.helmBinary} ${args.join(' ')}`;
    
    if (this.config.debug) {
      console.log(`Executing Helm command: ${command}`);
    }

    const execOptions = {
      timeout: this.config.timeout,
      maxBuffer: this.config.maxBuffer,
      env: {
        ...process.env,
        ...(this.config.kubeconfig && { KUBECONFIG: this.config.kubeconfig })
      },
      ...options
    };

    try {
      const { stdout, stderr } = await execAsync(command, execOptions);
      
      if (stderr && !stderr.includes('WARNING')) {
        throw new Error(stderr);
      }
      
      return stdout;
    } catch (error) {
      throw new Error(this._sanitizeErrorMessage(error.message || error.stderr || error.stdout));
    }
  }

  async _createTempValuesFile(values) {
    const tempDir = '/tmp';
    const filename = `helm-values-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.yaml`;
    const filePath = path.join(tempDir, filename);
    
    try {
      const yamlContent = yaml.dump(values);
      await fs.writeFile(filePath, yamlContent, 'utf8');
      
      // Clean up after 1 hour
      setTimeout(async () => {
        try {
          await fs.unlink(filePath);
        } catch (error) {
          // Ignore cleanup errors
        }
      }, 3600000);
      
      return filePath;
    } catch (error) {
      throw new Error(`Failed to create values file: ${error.message}`);
    }
  }

  _addCommonOptions(args, options) {
    if (options.timeout) {
      args.push('--timeout', `${options.timeout}s`);
    } else if (this.config.timeout) {
      args.push('--timeout', `${Math.floor(this.config.timeout / 1000)}s`);
    }

    if (options.wait !== false) {
      args.push('--wait');
    }

    if (options.waitForJobs) {
      args.push('--wait-for-jobs');
    }

    if (options.atomic) {
      args.push('--atomic');
    }

    if (options.force) {
      args.push('--force');
    }

    if (options.dryRun) {
      args.push('--dry-run');
    }

    if (this.config.debug || options.debug) {
      args.push('--debug');
    }
  }

  _parseVersion(versionOutput) {
    const match = versionOutput.match(/v(\d+\.\d+)/);
    return match ? `v${match[1]}` : 'unknown';
  }

  _isVersionSupported(version) {
    return this.supportedVersions.some(supported => version.startsWith(supported));
  }

  async _getHelmCapabilities() {
    try {
      const capOutput = await this._executeCommand(['env']);
      return {
        version: this.helmVersion,
        environment: this._parseEnvironment(capOutput)
      };
    } catch (error) {
      return {
        version: this.helmVersion,
        environment: {}
      };
    }
  }

  _parseInstallOutput(output) {
    const revisionMatch = output.match(/REVISION: (\d+)/);
    const statusMatch = output.match(/STATUS: (\w+)/);
    
    return {
      revision: revisionMatch ? parseInt(revisionMatch[1]) : 1,
      status: statusMatch ? statusMatch[1] : 'unknown'
    };
  }

  _parseUpgradeOutput(output) {
    const revisionMatch = output.match(/REVISION: (\d+)/);
    const statusMatch = output.match(/STATUS: (\w+)/);
    
    return {
      revision: revisionMatch ? parseInt(revisionMatch[1]) : null,
      status: statusMatch ? statusMatch[1] : 'unknown'
    };
  }

  _parseRollbackOutput(output) {
    const revisionMatch = output.match(/REVISION: (\d+)/);
    
    return {
      revision: revisionMatch ? parseInt(revisionMatch[1]) : null
    };
  }

  _parseEnvironment(envOutput) {
    const env = {};
    const lines = envOutput.split('\n');
    
    lines.forEach(line => {
      const match = line.match(/^(\w+)="?([^"]*)"?$/);
      if (match) {
        env[match[1]] = match[2];
      }
    });
    
    return env;
  }

  _parseManifestResources(manifest) {
    const resources = [];
    const docs = manifest.split('---').filter(doc => doc.trim());
    
    docs.forEach(doc => {
      try {
        const resource = yaml.load(doc);
        if (resource && resource.kind) {
          resources.push({
            apiVersion: resource.apiVersion,
            kind: resource.kind,
            name: resource.metadata?.name,
            namespace: resource.metadata?.namespace
          });
        }
      } catch (error) {
        // Ignore parsing errors for individual resources
      }
    });
    
    return resources;
  }

  _extractWarnings(output) {
    const warnings = [];
    const lines = output.split('\n');
    
    lines.forEach(line => {
      if (line.includes('[WARNING]')) {
        warnings.push(line.replace(/.*\[WARNING\]\s*/, ''));
      }
    });
    
    return warnings;
  }

  _extractErrors(output) {
    const errors = [];
    const lines = output.split('\n');
    
    lines.forEach(line => {
      if (line.includes('[ERROR]')) {
        errors.push(line.replace(/.*\[ERROR\]\s*/, ''));
      }
    });
    
    return errors;
  }

  _sanitizeErrorMessage(message) {
    // Remove sensitive information from error messages
    return message
      .replace(/--kubeconfig\s+\S+/g, '--kubeconfig [REDACTED]')
      .replace(/KUBECONFIG=\S+/g, 'KUBECONFIG=[REDACTED]')
      .replace(/password[:=]\S+/gi, 'password=[REDACTED]')
      .replace(/token[:=]\S+/gi, 'token=[REDACTED]');
  }
}

module.exports = { HelmCLI };