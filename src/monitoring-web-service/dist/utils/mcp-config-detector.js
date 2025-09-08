"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.McpConfigurationDetector = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class McpConfigurationDetector {
    logger;
    constructor(logger) {
        this.logger = logger;
    }
    async detectConfiguration() {
        this.logger.info('Starting Claude Code configuration detection...');
        const [claudeInstallations, configLocations, existingMcpServers, fortiumAgents] = await Promise.all([
            this.detectClaudeInstallations(),
            this.detectConfigLocations(),
            this.detectExistingMcpServers(),
            this.detectFortiumAgents()
        ]);
        const recommendations = this.generateRecommendations(claudeInstallations, configLocations, existingMcpServers, fortiumAgents);
        return {
            claude_installations: claudeInstallations,
            config_locations: configLocations,
            existing_mcp_servers: existingMcpServers,
            fortium_agents: fortiumAgents,
            recommendations
        };
    }
    async detectClaudeInstallations() {
        const installations = [];
        try {
            const { stdout } = await execAsync('claude --version');
            const version = stdout.trim();
            installations.push({
                type: 'cli',
                version,
                path: await this.findCommandPath('claude'),
                configured: await this.isClaudeCliConfigured()
            });
        }
        catch (error) {
        }
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
        const vscodeExtensionsPath = path.join(os.homedir(), '.vscode', 'extensions');
        if (fs.existsSync(vscodeExtensionsPath)) {
            const claudeExtensions = fs.readdirSync(vscodeExtensionsPath)
                .filter(dir => dir.includes('claude') || dir.includes('anthropic'));
            if (claudeExtensions.length > 0) {
                installations.push({
                    type: 'vscode',
                    path: path.join(vscodeExtensionsPath, claudeExtensions[0]),
                    configured: false
                });
            }
        }
        return installations;
    }
    async detectConfigLocations() {
        const locations = [];
        const globalConfigPath = path.join(os.homedir(), '.claude');
        locations.push(await this.checkConfigLocation('global', globalConfigPath, 'claude_desktop_config.json'));
        const currentDir = process.cwd();
        const localPaths = [
            path.join(currentDir, '.claude'),
            path.join(currentDir, '.agent-os'),
            path.join(currentDir, '.config', 'claude')
        ];
        for (const localPath of localPaths) {
            locations.push(await this.checkConfigLocation('local', localPath, 'config.json'));
        }
        if (process.platform !== 'win32') {
            const systemPaths = [
                '/etc/claude',
                '/opt/claude/config'
            ];
            for (const systemPath of systemPaths) {
                locations.push(await this.checkConfigLocation('global', systemPath, 'claude.conf'));
            }
        }
        return locations;
    }
    async checkConfigLocation(type, basePath, configFile) {
        const exists = fs.existsSync(basePath);
        const configPath = path.join(basePath, configFile);
        let readable = false;
        let writable = false;
        if (exists) {
            try {
                fs.accessSync(basePath, fs.constants.R_OK);
                readable = true;
            }
            catch { }
            try {
                fs.accessSync(basePath, fs.constants.W_OK);
                writable = true;
            }
            catch { }
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
    async detectExistingMcpServers() {
        const servers = [];
        const globalConfigPath = path.join(os.homedir(), '.claude', 'claude_desktop_config.json');
        if (fs.existsSync(globalConfigPath)) {
            try {
                const config = JSON.parse(fs.readFileSync(globalConfigPath, 'utf8'));
                if (config.mcpServers) {
                    Object.entries(config.mcpServers).forEach(([name, serverConfig]) => {
                        servers.push({
                            name,
                            command: serverConfig.command,
                            args: serverConfig.args,
                            env: serverConfig.env
                        });
                    });
                }
            }
            catch (error) {
                this.logger.warn('Failed to parse Claude desktop config:', error);
            }
        }
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
            }
            catch (error) {
                this.logger.warn('Failed to parse package.json:', error);
            }
        }
        return servers;
    }
    async detectFortiumAgents() {
        const agents = [];
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
                        }
                        catch (error) {
                        }
                    }
                }
            }
        }
        return agents;
    }
    async validateAgentFile(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const ext = path.extname(filePath).toLowerCase();
            if (ext === '.md') {
                return content.includes('---\nname:') && content.includes('description:');
            }
            else if (ext === '.json') {
                const parsed = JSON.parse(content);
                return parsed.name && parsed.description;
            }
            else {
                const yaml = require('js-yaml');
                const parsed = yaml.load(content);
                return parsed && parsed.name && parsed.description;
            }
        }
        catch {
            return false;
        }
    }
    generateRecommendations(installations, locations, servers, agents) {
        const recommendations = [];
        if (installations.length === 0) {
            recommendations.push({
                type: 'error',
                message: 'No Claude Code installations detected',
                action: 'Install Claude Code CLI or Desktop application',
                priority: 'high'
            });
        }
        const hasFortiumServer = servers.some(s => s.name.includes('fortium') ||
            s.command.includes('fortium') ||
            s.command.includes('metrics'));
        if (!hasFortiumServer) {
            recommendations.push({
                type: 'suggestion',
                message: 'Fortium Metrics Server not configured in MCP',
                action: 'Add Fortium Metrics Server to MCP configuration',
                priority: 'high'
            });
        }
        const writableConfigs = locations.filter(loc => loc.writable && loc.exists);
        if (writableConfigs.length === 0) {
            recommendations.push({
                type: 'warning',
                message: 'No writable configuration directories found',
                action: 'Check file permissions for Claude configuration directories',
                priority: 'medium'
            });
        }
        const invalidAgents = agents.filter(agent => !agent.valid);
        if (invalidAgents.length > 0) {
            recommendations.push({
                type: 'warning',
                message: `${invalidAgents.length} invalid agent files found`,
                action: 'Review and fix agent file formats',
                priority: 'low'
            });
        }
        const oldAgents = agents.filter(agent => {
            const ageMs = Date.now() - agent.last_modified.getTime();
            return ageMs > 30 * 24 * 60 * 60 * 1000;
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
    async autoConfigureMcp(config) {
        try {
            const detection = await this.detectConfiguration();
            const configLocation = this.selectBestConfigLocation(detection.config_locations);
            if (!configLocation) {
                return {
                    success: false,
                    message: 'No writable configuration location found'
                };
            }
            const backupPath = await this.createConfigBackup(configLocation);
            const mcpConfig = this.generateMcpConfig(config);
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
        }
        catch (error) {
            this.logger.error('MCP auto-configuration failed:', error);
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Configuration failed'
            };
        }
    }
    selectBestConfigLocation(locations) {
        const priorities = [
            locations.find(loc => loc.type === 'global' && loc.exists && loc.writable),
            locations.find(loc => loc.type === 'local' && loc.exists && loc.writable),
            locations.find(loc => loc.type === 'global' && loc.writable),
            locations.find(loc => loc.type === 'local' && loc.writable)
        ];
        return priorities.find(loc => loc !== undefined) || null;
    }
    async createConfigBackup(location) {
        const configPath = path.join(location.path, location.configFile);
        if (!fs.existsSync(configPath)) {
            return undefined;
        }
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = `${configPath}.backup.${timestamp}`;
        fs.copyFileSync(configPath, backupPath);
        return backupPath;
    }
    generateMcpConfig(integrationConfig) {
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
    async writeMcpConfig(configPath, config) {
        const configDir = path.dirname(configPath);
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        let existingConfig = {};
        if (fs.existsSync(configPath)) {
            try {
                existingConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            }
            catch {
            }
        }
        const mergedConfig = {
            ...existingConfig,
            ...config,
            mcpServers: {
                ...existingConfig.mcpServers,
                ...config.mcpServers
            }
        };
        fs.writeFileSync(configPath, JSON.stringify(mergedConfig, null, 2));
    }
    async findCommandPath(command) {
        try {
            const { stdout } = await execAsync(`which ${command}`);
            return stdout.trim();
        }
        catch {
            return '';
        }
    }
    async isClaudeCliConfigured() {
        try {
            const { stdout } = await execAsync('claude mcp list');
            return stdout.length > 0;
        }
        catch {
            return false;
        }
    }
    async isClaudeDesktopConfigured() {
        const configPath = path.join(os.homedir(), '.claude', 'claude_desktop_config.json');
        return fs.existsSync(configPath);
    }
}
exports.McpConfigurationDetector = McpConfigurationDetector;
//# sourceMappingURL=mcp-config-detector.js.map