/**
 * Task 3.6: Add configuration for Claude Code integration settings
 * 
 * Centralized configuration management for the enforcement integration system
 */
export interface ClaudeIntegrationConfig {
  // Core settings
  enabled: boolean;
  enabledCommands: string[];
  disabledCommands: string[];
  
  // Session management
  sessionTtl: number; // milliseconds
  maxSessions: number;
  autoCleanupSessions: boolean;
  
  // Enforcement settings
  enforcementMode: 'strict' | 'moderate' | 'lenient';
  allowOverrides: boolean;
  requireJustification: boolean;
  
  // Validation settings
  validateGitState: boolean;
  requireCleanWorking: boolean;
  validateCommandSequence: boolean;
  validateTaskDependencies: boolean;
  
  // Task completion detection
  taskCompletionDetection: {
    enabled: boolean;
    monitorFileChanges: boolean;
    analyzeOutputPatterns: boolean;
    analyzeGitCommits: boolean;
    confidenceThreshold: number; // 0.0 to 1.0
  };
  
  // Performance settings
  rateLimiting: {
    enabled: boolean;
    maxCommandsPerMinute: number;
    maxCommandsPerHour: number;
    cooldownPeriod: number; // milliseconds
  };
  
  // Fallback settings
  fallback: {
    enableGracefulDegradation: boolean;
    timeoutMs: number;
    maxRetries: number;
    fallbackToWarningsOnly: boolean;
  };
  
  // Logging and monitoring
  logging: {
    enabled: boolean;
    logLevel: 'error' | 'warn' | 'info' | 'debug';
    logToFile: boolean;
    logFilePath?: string;
    includeSessionData: boolean;
  };
  
  // Integration paths
  paths: {
    agentOsSpecsDir: string;
    projectRoot?: string;
    configFile?: string;
    cacheDir?: string;
  };
}

export class IntegrationConfigManager {
  private config: ClaudeIntegrationConfig;
  private configPath: string;
  private watchers: ((config: ClaudeIntegrationConfig) => void)[] = [];

  constructor(configPath?: string) {
    this.configPath = configPath || this.getDefaultConfigPath();
    this.config = this.getDefaultConfig();
    this.loadConfig();
  }

  public getConfig(): ClaudeIntegrationConfig {
    return { ...this.config };
  }

  public updateConfig(updates: Partial<ClaudeIntegrationConfig>): void {
    this.config = { ...this.config, ...updates };
    this.saveConfig();
    this.notifyWatchers();
  }

  public isCommandEnabled(command: string): boolean {
    if (!this.config.enabled) return false;
    if (this.config.disabledCommands.includes(command)) return false;
    if (this.config.enabledCommands.length > 0) {
      return this.config.enabledCommands.includes(command);
    }
    return true;
  }

  public getEnforcementLevel(): 'strict' | 'moderate' | 'lenient' {
    return this.config.enforcementMode;
  }

  public shouldValidateGitState(): boolean {
    return this.config.validateGitState;
  }

  public shouldValidateSequence(): boolean {
    return this.config.validateCommandSequence;
  }

  public shouldValidateDependencies(): boolean {
    return this.config.validateTaskDependencies;
  }

  public getTaskCompletionSettings() {
    return this.config.taskCompletionDetection;
  }

  public getRateLimitSettings() {
    return this.config.rateLimiting;
  }

  public getFallbackSettings() {
    return this.config.fallback;
  }

  public getLoggingSettings() {
    return this.config.logging;
  }

  public getPaths() {
    return this.config.paths;
  }

  public onConfigChange(callback: (config: ClaudeIntegrationConfig) => void): void {
    this.watchers.push(callback);
  }

  public removeConfigWatcher(callback: (config: ClaudeIntegrationConfig) => void): void {
    const index = this.watchers.indexOf(callback);
    if (index >= 0) {
      this.watchers.splice(index, 1);
    }
  }

  private getDefaultConfig(): ClaudeIntegrationConfig {
    return {
      enabled: true,
      enabledCommands: ['/execute-tasks', '/plan-product', '/analyze-product', '/fold-prompt'],
      disabledCommands: [],
      
      sessionTtl: 24 * 60 * 60 * 1000, // 24 hours
      maxSessions: 100,
      autoCleanupSessions: true,
      
      enforcementMode: 'moderate',
      allowOverrides: true,
      requireJustification: false,
      
      validateGitState: true,
      requireCleanWorking: false,
      validateCommandSequence: true,
      validateTaskDependencies: true,
      
      taskCompletionDetection: {
        enabled: true,
        monitorFileChanges: true,
        analyzeOutputPatterns: true,
        analyzeGitCommits: false,
        confidenceThreshold: 0.7
      },
      
      rateLimiting: {
        enabled: false,
        maxCommandsPerMinute: 10,
        maxCommandsPerHour: 100,
        cooldownPeriod: 1000
      },
      
      fallback: {
        enableGracefulDegradation: true,
        timeoutMs: 5000,
        maxRetries: 3,
        fallbackToWarningsOnly: true
      },
      
      logging: {
        enabled: true,
        logLevel: 'info',
        logToFile: false,
        includeSessionData: false
      },
      
      paths: {
        agentOsSpecsDir: '.agent-os/specs'
      }
    };
  }

  private getDefaultConfigPath(): string {
    return process.env.CLAUDE_INTEGRATION_CONFIG || '.claude/integration-config.json';
  }

  private loadConfig(): void {
    try {
      const fs = require('fs');
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf-8');
        const loadedConfig = JSON.parse(configData);
        this.config = { ...this.config, ...loadedConfig };
      }
    } catch (error) {
      console.warn(`Failed to load integration config from ${this.configPath}:`, error);
    }
  }

  private saveConfig(): void {
    try {
      const fs = require('fs');
      const path = require('path');
      
      // Ensure directory exists
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.warn(`Failed to save integration config to ${this.configPath}:`, error);
    }
  }

  private notifyWatchers(): void {
    this.watchers.forEach(callback => {
      try {
        callback(this.config);
      } catch (error) {
        console.warn('Error in config change callback:', error);
      }
    });
  }
}

// Configuration presets for different environments
export const ConfigPresets = {
  development: {
    enforcementMode: 'lenient' as const,
    requireCleanWorking: false,
    fallback: {
      enableGracefulDegradation: true,
      fallbackToWarningsOnly: true,
      timeoutMs: 10000,
      maxRetries: 1
    },
    logging: {
      enabled: true,
      logLevel: 'debug' as const,
      includeSessionData: true
    }
  },
  
  production: {
    enforcementMode: 'strict' as const,
    requireCleanWorking: true,
    validateGitState: true,
    rateLimiting: {
      enabled: true,
      maxCommandsPerMinute: 5,
      maxCommandsPerHour: 50
    },
    fallback: {
      enableGracefulDegradation: false,
      fallbackToWarningsOnly: false,
      timeoutMs: 3000,
      maxRetries: 2
    },
    logging: {
      enabled: true,
      logLevel: 'warn' as const,
      logToFile: true,
      includeSessionData: false
    }
  },
  
  testing: {
    enforcementMode: 'strict' as const,
    sessionTtl: 60 * 1000, // 1 minute for tests
    maxSessions: 10,
    fallback: {
      enableGracefulDegradation: false,
      fallbackToWarningsOnly: false,
      timeoutMs: 1000,
      maxRetries: 0
    },
    taskCompletionDetection: {
      enabled: false,
      monitorFileChanges: false,
      analyzeOutputPatterns: true,
      confidenceThreshold: 1.0
    }
  }
};

// Singleton instance
export const integrationConfig = new IntegrationConfigManager();