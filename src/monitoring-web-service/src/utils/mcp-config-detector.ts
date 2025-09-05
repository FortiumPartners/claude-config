/**
 * MCP Configuration Auto-Detection and Setup Utilities
 * Task 4.6: Automated detection and configuration of Claude Code MCP integration
 * 
 * Automatically detects existing Claude configurations and sets up MCP integration
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as winston from 'winston';

const execAsync = promisify(exec);

export interface ClaudeConfigLocation {
  type: 'global' | 'local' | 'project';
  path: string;
  configFile: string;
  exists: boolean;
  readable: boolean;
  writable: boolean;
}

export interface McpServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface DetectedConfiguration {
  claude_installations: ClaudeInstallation[];
  config_locations: ClaudeConfigLocation[];
  existing_mcp_servers: McpServerConfig[];
  fortium_agents: FortiumAgent[];
  recommendations: ConfigurationRecommendation[];
}

export interface ClaudeInstallation {
  type: 'cli' | 'desktop' | 'vscode';
  version?: string;
  path: string;
  configured: boolean;
}

export interface FortiumAgent {
  name: string;
  path: string;
  type: 'markdown' | 'yaml' | 'json';
  valid: boolean;
  last_modified: Date;
}

export interface ConfigurationRecommendation {
  type: 'warning' | 'suggestion' | 'error';
  message: string;
  action?: string;
  priority: 'low' | 'medium' | 'high';
}

export interface McpIntegrationConfig {
  server_url: string;
  api_key?: string;
  organization_id?: string;
  auto_connect: boolean;
  fallback_local: boolean;
}

export class McpConfigurationDetector {
  constructor(private logger: winston.Logger) {}

  /**
   * Detect all Claude Code configurations and integrations
   */
  async detectConfiguration(): Promise<DetectedConfiguration> {
    this.logger.info('Starting Claude Code configuration detection...');

    const [
      claudeInstallations,
      configLocations,
      existingMcpServers,
      fortiumAgents
    ] = await Promise.all([
      this.detectClaudeInstallations(),
      this.detectConfigLocations(),
      this.detectExistingMcpServers(),
      this.detectFortiumAgents()
    ]);

    const recommendations = this.generateRecommendations(
      claudeInstallations,
      configLocations,
      existingMcpServers,
      fortiumAgents
    );

    return {
      claude_installations: claudeInstallations,
      config_locations: configLocations,
      existing_mcp_servers: existingMcpServers,
      fortium_agents: fortiumAgents,
      recommendations
    };
  }

  /**
   * Detect Claude Code installations
   */
  private async detectClaudeInstallations(): Promise<ClaudeInstallation[]> {
    const installations: ClaudeInstallation[] = [];

    // Check for Claude CLI
    try {
      const { stdout } = await execAsync('claude --version');
      const version = stdout.trim();
      installations.push({
        type: 'cli',
        version,
        path: await this.findCommandPath('claude'),
        configured: await this.isClaudeCliConfigured()
      });
    } catch (error) {
      // Claude CLI not found
    }

    // Check for Claude Desktop (macOS)
    if (process.platform === 'darwin') {
      const desktopPath = '/Applications/Claude.app';
      if (fs.existsSync(desktopPath)) {
        installations.push({
          type: 'desktop',
          path: desktopPath,
          configured: await this.isClaudeDesktopConfigured()
        });
      }
    }

    // Check for Claude VS Code extension
    const vscodeExtensionsPath = path.join(os.homedir(), '.vscode', 'extensions');
    if (fs.existsSync(vscodeExtensionsPath)) {
      const claudeExtensions = fs.readdirSync(vscodeExtensionsPath)
        .filter(dir => dir.includes('claude') || dir.includes('anthropic'));
      
      if (claudeExtensions.length > 0) {
        installations.push({
          type: 'vscode',
          path: path.join(vscodeExtensionsPath, claudeExtensions[0]),
          configured: false // VS Code extension doesn't use MCP directly
        });
      }
    }

    return installations;
  }

  /**
   * Detect configuration file locations
   */
  private async detectConfigLocations(): Promise<ClaudeConfigLocation[]> {
    const locations: ClaudeConfigLocation[] = [];

    // Global Claude config
    const globalConfigPath = path.join(os.homedir(), '.claude');
    locations.push(await this.checkConfigLocation(
      'global',
      globalConfigPath,
      'claude_desktop_config.json'
    ));

    // Local project configs
    const currentDir = process.cwd();
    const localPaths = [
      path.join(currentDir, '.claude'),
      path.join(currentDir, '.agent-os'),
      path.join(currentDir, '.config', 'claude')
    ];

    for (const localPath of localPaths) {
      locations.push(await this.checkConfigLocation(
        'local',
        localPath,
        'config.json'
      ));
    }

    // System-wide configs (Linux/macOS)
    if (process.platform !== 'win32') {
      const systemPaths = [
        '/etc/claude',
        '/opt/claude/config'
      ];

      for (const systemPath of systemPaths) {
        locations.push(await this.checkConfigLocation(
          'global',
          systemPath,
          'claude.conf'
        ));
      }
    }

    return locations;
  }

  /**
   * Check a specific configuration location
   */
  private async checkConfigLocation(
    type: 'global' | 'local' | 'project',
    basePath: string,
    configFile: string
  ): Promise<ClaudeConfigLocation> {
    const exists = fs.existsSync(basePath);
    const configPath = path.join(basePath, configFile);
    
    let readable = false;
    let writable = false;

    if (exists) {
      try {
        fs.accessSync(basePath, fs.constants.R_OK);
        readable = true;
      } catch {}

      try {
        fs.accessSync(basePath, fs.constants.W_OK);
        writable = true;
      } catch {}
    }

    return {
      type,
      path: basePath,
      configFile,
      exists,
      readable,
      writable
    };
  }

  /**
   * Detect existing MCP servers
   */
  private async detectExistingMcpServers(): Promise<McpServerConfig[]> {
    const servers: McpServerConfig[] = [];
    
    // Check Claude desktop config for existing MCP servers
    const globalConfigPath = path.join(os.homedir(), '.claude', 'claude_desktop_config.json');
    
    if (fs.existsSync(globalConfigPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(globalConfigPath, 'utf8'));
        
        if (config.mcpServers) {
          Object.entries(config.mcpServers).forEach(([name, serverConfig]: [string, any]) => {
            servers.push({
              name,
              command: serverConfig.command,
              args: serverConfig.args,
              env: serverConfig.env
            });
          });
        }
      } catch (error) {
        this.logger.warn('Failed to parse Claude desktop config:', error);
      }
    }

    // Check for package.json with MCP servers
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        
        if (packageJson.dependencies) {
          Object.keys(packageJson.dependencies).forEach(dep => {
            if (dep.includes('mcp') || dep.includes('context7') || dep.includes('playwright')) {
              servers.push({
                name: dep,
                command: `npx ${dep}`,
                args: []
              });
            }
          });
        }
      } catch (error) {
        this.logger.warn('Failed to parse package.json:', error);
      }
    }

    return servers;
  }

  /**
   * Detect Fortium agents
   */
  private async detectFortiumAgents(): Promise<FortiumAgent[]> {
    const agents: FortiumAgent[] = [];
    
    const searchPaths = [
      path.join(os.homedir(), '.claude', 'agents'),
      path.join(os.homedir(), '.agent-os', 'agents'),
      path.join(process.cwd(), '.claude', 'agents'),
      path.join(process.cwd(), '.agent-os', 'agents'),
      path.join(process.cwd(), 'agents')
    ];

    for (const searchPath of searchPaths) {
      if (fs.existsSync(searchPath)) {
        const files = fs.readdirSync(searchPath, { recursive: true });
        
        for (const file of files) {
          const filePath = path.join(searchPath, file.toString());
          const ext = path.extname(filePath).toLowerCase();
          
          if (['.md', '.yaml', '.yml', '.json'].includes(ext)) {
            try {
              const stats = fs.statSync(filePath);
              const isValid = await this.validateAgentFile(filePath);
              
              agents.push({
                name: path.basename(filePath, ext),
                path: filePath,
                type: ext === '.md' ? 'markdown' : ext === '.json' ? 'json' : 'yaml',
                valid: isValid,
                last_modified: stats.mtime
              });
            } catch (error) {
              // Skip files that can't be read
            }
          }
        }
      }
    }

    return agents;
  }

  /**
   * Validate agent file format
   */
  private async validateAgentFile(filePath: string): Promise<boolean> {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const ext = path.extname(filePath).toLowerCase();
      
      if (ext === '.md') {
        // Check for YAML frontmatter
        return content.includes('---\nname:') && content.includes('description:');
      } else if (ext === '.json') {
        const parsed = JSON.parse(content);
        return parsed.name && parsed.description;
      } else {
        const yaml = require('js-yaml');
        const parsed = yaml.load(content);
        return parsed && parsed.name && parsed.description;
      }
    } catch {
      return false;
    }
  }

  /**
   * Generate configuration recommendations
   */
  private generateRecommendations(
    installations: ClaudeInstallation[],
    locations: ClaudeConfigLocation[],
    servers: McpServerConfig[],
    agents: FortiumAgent[]
  ): ConfigurationRecommendation[] {
    const recommendations: ConfigurationRecommendation[] = [];

    // Check Claude installation
    if (installations.length === 0) {
      recommendations.push({
        type: 'error',
        message: 'No Claude Code installations detected',
        action: 'Install Claude Code CLI or Desktop application',
        priority: 'high'
      });
    }

    // Check for Fortium metrics server in MCP config
    const hasFortiumServer = servers.some(s => 
      s.name.includes('fortium') || 
      s.command.includes('fortium') ||
      s.command.includes('metrics')
    );

    if (!hasFortiumServer) {
      recommendations.push({
        type: 'suggestion',
        message: 'Fortium Metrics Server not configured in MCP',
        action: 'Add Fortium Metrics Server to MCP configuration',
        priority: 'high'
      });
    }

    // Check configuration permissions
    const writableConfigs = locations.filter(loc => loc.writable && loc.exists);
    if (writableConfigs.length === 0) {
      recommendations.push({
        type: 'warning',
        message: 'No writable configuration directories found',
        action: 'Check file permissions for Claude configuration directories',
        priority: 'medium'
      });
    }

    // Check agent validity
    const invalidAgents = agents.filter(agent => !agent.valid);
    if (invalidAgents.length > 0) {
      recommendations.push({
        type: 'warning',
        message: `${invalidAgents.length} invalid agent files found`,
        action: 'Review and fix agent file formats',
        priority: 'low'
      });
    }

    // Check for outdated agents
    const oldAgents = agents.filter(agent => {
      const ageMs = Date.now() - agent.last_modified.getTime();
      return ageMs > 30 * 24 * 60 * 60 * 1000; // 30 days
    });

    if (oldAgents.length > 0) {
      recommendations.push({
        type: 'suggestion',
        message: `${oldAgents.length} agents haven't been updated in 30+ days`,
        action: 'Review and update agent configurations',
        priority: 'low'
      });
    }

    return recommendations;
  }

  /**
   * Auto-configure MCP integration
   */
  async autoConfigureMcp(config: McpIntegrationConfig): Promise<{
    success: boolean;
    message: string;
    configPath?: string;
    backup_path?: string;
  }> {
    try {
      const detection = await this.detectConfiguration();
      
      // Find the best configuration location
      const configLocation = this.selectBestConfigLocation(detection.config_locations);
      
      if (!configLocation) {
        return {
          success: false,
          message: 'No writable configuration location found'
        };
      }

      // Create backup of existing config
      const backupPath = await this.createConfigBackup(configLocation);

      // Generate MCP server configuration
      const mcpConfig = this.generateMcpConfig(config);

      // Write configuration
      const configPath = path.join(configLocation.path, configLocation.configFile);
      await this.writeMcpConfig(configPath, mcpConfig);

      this.logger.info('MCP configuration updated successfully', {
        config_path: configPath,
        backup_path: backupPath
      });

      return {
        success: true,
        message: 'MCP integration configured successfully',
        configPath,
        backup_path: backupPath
      };

    } catch (error) {
      this.logger.error('MCP auto-configuration failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Configuration failed'
      };
    }
  }

  /**
   * Select the best configuration location
   */
  private selectBestConfigLocation(locations: ClaudeConfigLocation[]): ClaudeConfigLocation | null {
    // Prefer global configs over local, and existing over non-existing
    const priorities = [
      locations.find(loc => loc.type === 'global' && loc.exists && loc.writable),
      locations.find(loc => loc.type === 'local' && loc.exists && loc.writable),
      locations.find(loc => loc.type === 'global' && loc.writable),
      locations.find(loc => loc.type === 'local' && loc.writable)
    ];

    return priorities.find(loc => loc !== undefined) || null;
  }

  /**
   * Create backup of existing configuration
   */
  private async createConfigBackup(location: ClaudeConfigLocation): Promise<string | undefined> {
    const configPath = path.join(location.path, location.configFile);
    
    if (!fs.existsSync(configPath)) {
      return undefined;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${configPath}.backup.${timestamp}`;
    
    fs.copyFileSync(configPath, backupPath);
    return backupPath;
  }

  /**
   * Generate MCP server configuration
   */
  private generateMcpConfig(integrationConfig: McpIntegrationConfig): any {
    return {
      mcpServers: {
        "fortium-metrics": {
          command: "npx",
          args: ["@fortium/mcp-client"],
          env: {
            FORTIUM_SERVER_URL: integrationConfig.server_url,
            FORTIUM_API_KEY: integrationConfig.api_key || '',
            FORTIUM_ORG_ID: integrationConfig.organization_id || '',
            FORTIUM_AUTO_CONNECT: integrationConfig.auto_connect ? 'true' : 'false',
            FORTIUM_FALLBACK_LOCAL: integrationConfig.fallback_local ? 'true' : 'false'
          }
        }
      }
    };
  }

  /**
   * Write MCP configuration to file
   */
  private async writeMcpConfig(configPath: string, config: any): Promise<void> {
    // Ensure directory exists
    const configDir = path.dirname(configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    // Read existing config if it exists
    let existingConfig = {};
    if (fs.existsSync(configPath)) {
      try {
        existingConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      } catch {
        // Ignore parse errors, will overwrite
      }
    }

    // Merge configurations
    const mergedConfig = {
      ...existingConfig,
      ...config,
      mcpServers: {
        ...(existingConfig as any).mcpServers,
        ...config.mcpServers
      }
    };

    // Write configuration
    fs.writeFileSync(configPath, JSON.stringify(mergedConfig, null, 2));
  }

  /**
   * Helper methods
   */
  private async findCommandPath(command: string): Promise<string> {
    try {
      const { stdout } = await execAsync(`which ${command}`);
      return stdout.trim();
    } catch {
      return '';
    }
  }

  private async isClaudeCliConfigured(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('claude mcp list');
      return stdout.length > 0;
    } catch {
      return false;
    }
  }

  private async isClaudeDesktopConfigured(): Promise<boolean> {
    const configPath = path.join(os.homedir(), '.claude', 'claude_desktop_config.json');
    return fs.existsSync(configPath);
  }
}