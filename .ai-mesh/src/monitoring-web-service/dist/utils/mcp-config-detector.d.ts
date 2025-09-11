import * as winston from 'winston';
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
export declare class McpConfigurationDetector {
    private logger;
    constructor(logger: winston.Logger);
    detectConfiguration(): Promise<DetectedConfiguration>;
    private detectClaudeInstallations;
    private detectConfigLocations;
    private checkConfigLocation;
    private detectExistingMcpServers;
    private detectFortiumAgents;
    private validateAgentFile;
    private generateRecommendations;
    autoConfigureMcp(config: McpIntegrationConfig): Promise<{
        success: boolean;
        message: string;
        configPath?: string;
        backup_path?: string;
    }>;
    private selectBestConfigLocation;
    private createConfigBackup;
    private generateMcpConfig;
    private writeMcpConfig;
    private findCommandPath;
    private isClaudeCliConfigured;
    private isClaudeDesktopConfigured;
}
//# sourceMappingURL=mcp-config-detector.d.ts.map