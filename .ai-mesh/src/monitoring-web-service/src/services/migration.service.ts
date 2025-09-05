/**
 * Migration Service
 * Task 4.4: Data migration tools for existing local metrics systems
 * 
 * Handles migration from local file-based metrics to web service with backward compatibility
 */

import { DatabaseConnection } from '../database/connection';
import { MetricsCollectionService } from './metrics-collection.service';
import * as winston from 'winston';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

export interface LocalMetric {
  timestamp: number;
  command: string;
  duration: number;
  success: boolean;
  agent?: string;
  context?: any;
}

export interface LocalConfig {
  teams?: any;
  goals?: any;
  current_sprint?: any;
  alerts?: any;
  integrations?: any;
}

export interface MigrationResult {
  success: boolean;
  metrics_migrated: number;
  config_migrated: boolean;
  errors: string[];
  warnings: string[];
  backup_location?: string;
}

export interface MigrationOptions {
  local_config_path?: string;
  legacy_format?: any;
  preserve_local?: boolean;
  dry_run?: boolean;
  batch_size?: number;
}

export class MigrationService {
  private metricsCollectionService: MetricsCollectionService;

  constructor(
    private db: DatabaseConnection,
    private logger: winston.Logger
  ) {
    this.metricsCollectionService = new MetricsCollectionService(db, logger);
  }

  /**
   * Migrate local metrics to web service
   */
  async migrateLocalMetrics(
    organizationId: string,
    userId: string,
    options: MigrationOptions = {}
  ): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: false,
      metrics_migrated: 0,
      config_migrated: false,
      errors: [],
      warnings: []
    };

    try {
      // Handle different migration sources
      if (options.legacy_format) {
        // Direct legacy format migration
        return await this.migrateLegacyFormat(organizationId, userId, options.legacy_format, result);
      }

      if (options.local_config_path) {
        // File-based migration
        return await this.migrateFromLocalFiles(organizationId, userId, options, result);
      }

      // Auto-discover local metrics
      return await this.autoDiscoverAndMigrate(organizationId, userId, options, result);

    } catch (error) {
      this.logger.error('Migration error:', error);
      result.errors.push(error instanceof Error ? error.message : 'Unknown migration error');
      return result;
    }
  }

  /**
   * Migrate from legacy format data
   */
  private async migrateLegacyFormat(
    organizationId: string,
    userId: string,
    legacyData: any,
    result: MigrationResult
  ): Promise<MigrationResult> {
    try {
      // Convert legacy format to current format
      const convertedMetric = this.convertLegacyMetric(legacyData);

      // Store the metric
      const collectionResult = await this.metricsCollectionService.collectCommandExecution(
        organizationId,
        convertedMetric
      );

      if (collectionResult.success) {
        result.metrics_migrated = 1;
        result.success = true;
      } else {
        result.errors.push(`Failed to store migrated metric: ${collectionResult.message}`);
      }

    } catch (error) {
      result.errors.push(`Legacy format conversion error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Migrate from local files
   */
  private async migrateFromLocalFiles(
    organizationId: string,
    userId: string,
    options: MigrationOptions,
    result: MigrationResult
  ): Promise<MigrationResult> {
    const configPath = options.local_config_path!;
    
    try {
      // Check if path exists
      if (!fs.existsSync(configPath)) {
        result.errors.push(`Configuration path does not exist: ${configPath}`);
        return result;
      }

      // Create backup if preserving local files
      if (options.preserve_local) {
        result.backup_location = await this.createBackup(configPath);
      }

      // Migrate dashboard settings
      const dashboardSettingsPath = path.join(path.dirname(configPath), 'dashboard-settings.yml');
      if (fs.existsSync(dashboardSettingsPath)) {
        const configMigrated = await this.migrateDashboardConfig(
          organizationId,
          dashboardSettingsPath,
          options.dry_run || false
        );
        result.config_migrated = configMigrated;
      }

      // Discover and migrate metrics files
      const metricsFiles = await this.discoverMetricsFiles(path.dirname(configPath));
      result.metrics_migrated = await this.migrateMetricsFiles(
        organizationId,
        metricsFiles,
        options
      );

      result.success = result.metrics_migrated > 0 || result.config_migrated;

      if (result.metrics_migrated === 0 && !result.config_migrated) {
        result.warnings.push('No metrics or configuration found to migrate');
      }

    } catch (error) {
      result.errors.push(`File migration error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Auto-discover and migrate local metrics
   */
  private async autoDiscoverAndMigrate(
    organizationId: string,
    userId: string,
    options: MigrationOptions,
    result: MigrationResult
  ): Promise<MigrationResult> {
    const commonPaths = [
      path.join(process.env.HOME || '~', '.agent-os'),
      path.join(process.env.HOME || '~', '.claude'),
      path.join(process.cwd(), '.agent-os'),
      path.join(process.cwd(), '.claude')
    ];

    for (const basePath of commonPaths) {
      if (fs.existsSync(basePath)) {
        this.logger.info(`Checking for metrics in: ${basePath}`);
        
        const pathResult = await this.migrateFromLocalFiles(
          organizationId,
          userId,
          { ...options, local_config_path: basePath },
          { ...result }
        );

        // Accumulate results
        result.metrics_migrated += pathResult.metrics_migrated;
        result.config_migrated = result.config_migrated || pathResult.config_migrated;
        result.errors.push(...pathResult.errors);
        result.warnings.push(...pathResult.warnings);
        
        if (pathResult.backup_location) {
          result.backup_location = pathResult.backup_location;
        }
      }
    }

    result.success = result.metrics_migrated > 0 || result.config_migrated;
    return result;
  }

  /**
   * Convert legacy metric format to current format
   */
  private convertLegacyMetric(legacy: any): any {
    // Handle various legacy formats
    if (legacy.timestamp && legacy.command && legacy.duration) {
      // Old format with timestamp, command, duration
      return {
        command_name: legacy.command,
        execution_time_ms: legacy.duration,
        success: legacy.success !== false,
        context: {
          migrated_from: 'legacy_format',
          original_timestamp: legacy.timestamp,
          agent_used: legacy.agent || 'unknown'
        }
      };
    }

    if (legacy.name && legacy.time) {
      // Alternative legacy format
      return {
        command_name: legacy.name,
        execution_time_ms: legacy.time,
        success: legacy.status !== 'failed',
        context: {
          migrated_from: 'legacy_format_alt',
          original_data: legacy
        }
      };
    }

    // Try to extract what we can
    return {
      command_name: legacy.command_name || legacy.name || 'unknown_command',
      execution_time_ms: legacy.execution_time_ms || legacy.duration || legacy.time || 0,
      success: legacy.success !== false && legacy.status !== 'failed',
      context: {
        migrated_from: 'legacy_format_generic',
        original_data: legacy
      }
    };
  }

  /**
   * Create backup of local files
   */
  private async createBackup(sourcePath: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(path.dirname(sourcePath), `backup-${timestamp}`);
    
    // Create backup directory
    fs.mkdirSync(backupDir, { recursive: true });

    // Copy files
    if (fs.statSync(sourcePath).isDirectory()) {
      await this.copyDirectory(sourcePath, backupDir);
    } else {
      fs.copyFileSync(sourcePath, path.join(backupDir, path.basename(sourcePath)));
    }

    this.logger.info(`Created backup at: ${backupDir}`);
    return backupDir;
  }

  /**
   * Copy directory recursively
   */
  private async copyDirectory(source: string, destination: string): Promise<void> {
    if (!fs.existsSync(destination)) {
      fs.mkdirSync(destination, { recursive: true });
    }

    const files = fs.readdirSync(source);
    
    for (const file of files) {
      const sourcePath = path.join(source, file);
      const destPath = path.join(destination, file);
      
      if (fs.statSync(sourcePath).isDirectory()) {
        await this.copyDirectory(sourcePath, destPath);
      } else {
        fs.copyFileSync(sourcePath, destPath);
      }
    }
  }

  /**
   * Migrate dashboard configuration
   */
  private async migrateDashboardConfig(
    organizationId: string,
    configPath: string,
    dryRun: boolean
  ): Promise<boolean> {
    try {
      const configContent = fs.readFileSync(configPath, 'utf8');
      const config = yaml.load(configContent) as LocalConfig;

      if (dryRun) {
        this.logger.info('Dry run: Would migrate dashboard configuration', config);
        return true;
      }

      // Store configuration in database
      const query = `
        INSERT INTO organization_settings (organization_id, settings_data, settings_type, created_at, updated_at)
        VALUES ($1, $2, 'dashboard_migration', NOW(), NOW())
        ON CONFLICT (organization_id, settings_type) 
        DO UPDATE SET settings_data = $2, updated_at = NOW()
      `;

      await this.db.query(query, [organizationId, JSON.stringify(config)]);
      
      this.logger.info('Successfully migrated dashboard configuration');
      return true;

    } catch (error) {
      this.logger.error('Failed to migrate dashboard config:', error);
      return false;
    }
  }

  /**
   * Discover metrics files in a directory
   */
  private async discoverMetricsFiles(basePath: string): Promise<string[]> {
    const metricsFiles: string[] = [];
    
    if (!fs.existsSync(basePath)) {
      return metricsFiles;
    }

    const commonMetricsPatterns = [
      'metrics*.json',
      'dashboard*.json',
      'command-history*.json',
      'agent-usage*.json',
      'productivity*.json'
    ];

    const files = fs.readdirSync(basePath, { withFileTypes: true });
    
    for (const file of files) {
      if (file.isFile()) {
        const fileName = file.name.toLowerCase();
        
        // Check against patterns
        for (const pattern of commonMetricsPatterns) {
          const regex = new RegExp(pattern.replace('*', '.*'));
          if (regex.test(fileName)) {
            metricsFiles.push(path.join(basePath, file.name));
          }
        }
      } else if (file.isDirectory() && file.name !== 'backup' && !file.name.startsWith('.')) {
        // Recursively search subdirectories
        const subFiles = await this.discoverMetricsFiles(path.join(basePath, file.name));
        metricsFiles.push(...subFiles);
      }
    }

    return metricsFiles;
  }

  /**
   * Migrate metrics from discovered files
   */
  private async migrateMetricsFiles(
    organizationId: string,
    metricsFiles: string[],
    options: MigrationOptions
  ): Promise<number> {
    let totalMigrated = 0;
    const batchSize = options.batch_size || 100;

    for (const filePath of metricsFiles) {
      try {
        this.logger.info(`Processing metrics file: ${filePath}`);
        
        const content = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(content);

        // Handle different file formats
        let metrics: LocalMetric[] = [];

        if (Array.isArray(data)) {
          metrics = data;
        } else if (data.metrics && Array.isArray(data.metrics)) {
          metrics = data.metrics;
        } else if (data.commands && Array.isArray(data.commands)) {
          metrics = data.commands;
        } else {
          // Try to treat as single metric
          metrics = [data];
        }

        // Process in batches
        for (let i = 0; i < metrics.length; i += batchSize) {
          const batch = metrics.slice(i, i + batchSize);
          const batchMigrated = await this.migrateBatch(organizationId, batch, options.dry_run || false);
          totalMigrated += batchMigrated;
        }

      } catch (error) {
        this.logger.error(`Error processing file ${filePath}:`, error);
        // Continue with next file
      }
    }

    return totalMigrated;
  }

  /**
   * Migrate a batch of metrics
   */
  private async migrateBatch(
    organizationId: string,
    metrics: LocalMetric[],
    dryRun: boolean
  ): Promise<number> {
    if (dryRun) {
      this.logger.info(`Dry run: Would migrate ${metrics.length} metrics`);
      return metrics.length;
    }

    let migrated = 0;

    for (const metric of metrics) {
      try {
        const convertedMetric = this.convertLegacyMetric(metric);
        const result = await this.metricsCollectionService.collectCommandExecution(
          organizationId,
          convertedMetric
        );

        if (result.success) {
          migrated++;
        }
      } catch (error) {
        this.logger.warn('Failed to migrate individual metric:', error);
        // Continue with next metric
      }
    }

    return migrated;
  }

  /**
   * Validate migration prerequisites
   */
  async validateMigrationPrerequisites(organizationId: string): Promise<{
    valid: boolean;
    issues: string[];
    suggestions: string[];
  }> {
    const issues: string[] = [];
    const suggestions: string[] = [];

    try {
      // Check organization exists and has proper settings
      const orgQuery = 'SELECT * FROM organizations WHERE id = $1';
      const orgResult = await this.db.query(orgQuery, [organizationId]);
      
      if (orgResult.rows.length === 0) {
        issues.push('Organization not found');
      }

      // Check database tables exist
      const tablesQuery = `
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('command_executions', 'agent_metrics', 'organization_settings')
      `;
      const tablesResult = await this.db.query(tablesQuery);
      
      if (tablesResult.rows.length < 3) {
        issues.push('Required database tables missing');
        suggestions.push('Run database migrations before attempting migration');
      }

      // Check for existing metrics (warn about duplicates)
      const existingMetricsQuery = `
        SELECT COUNT(*) as count FROM command_executions 
        WHERE organization_id = $1 
        AND created_at > NOW() - INTERVAL '24 hours'
      `;
      const existingMetricsResult = await this.db.query(existingMetricsQuery, [organizationId]);
      const existingCount = parseInt(existingMetricsResult.rows[0].count);

      if (existingCount > 0) {
        suggestions.push(`${existingCount} recent metrics found. Migration will add to existing data.`);
      }

    } catch (error) {
      issues.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      valid: issues.length === 0,
      issues,
      suggestions
    };
  }
}