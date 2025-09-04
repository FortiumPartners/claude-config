import { database } from '../database';
import winston from 'winston';

export interface SchedulerConfig {
  maintenanceIntervalMinutes: number;
  healthCheckIntervalMinutes: number;
  enabled: boolean;
}

export class PartitionScheduler {
  private logger: winston.Logger;
  private maintenanceInterval: ReturnType<typeof setInterval> | null = null;
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;

  constructor(private config: SchedulerConfig) {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
      transports: [
        new winston.transports.Console(),
      ],
    });
  }

  start(): void {
    if (this.isRunning || !this.config.enabled) {
      this.logger.warn('Partition scheduler already running or disabled');
      return;
    }

    this.logger.info('Starting partition scheduler', {
      maintenanceInterval: this.config.maintenanceIntervalMinutes,
      healthCheckInterval: this.config.healthCheckIntervalMinutes,
    });

    this.isRunning = true;

    // Schedule maintenance job
    this.maintenanceInterval = setInterval(
      () => this.runMaintenanceJob(),
      this.config.maintenanceIntervalMinutes * 60 * 1000,
    );

    // Schedule health check
    this.healthCheckInterval = setInterval(
      () => this.runHealthCheck(),
      this.config.healthCheckIntervalMinutes * 60 * 1000,
    );

    // Run initial jobs
    this.runHealthCheck();
    
    // Run maintenance after a delay to avoid startup conflicts
    setTimeout(() => {
      if (this.isRunning) {
        this.runMaintenanceJob();
      }
    }, 5 * 60 * 1000); // 5 minutes delay
  }

  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.logger.info('Stopping partition scheduler');
    this.isRunning = false;

    if (this.maintenanceInterval) {
      clearInterval(this.maintenanceInterval);
      this.maintenanceInterval = null;
    }

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  private async runMaintenanceJob(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.logger.info('Running scheduled partition maintenance');
    const startTime = Date.now();

    try {
      const result = await database.partitionManager.runMaintenanceJob();
      
      const duration = Date.now() - startTime;
      
      this.logger.info('Scheduled partition maintenance completed', {
        ...result,
        durationMs: duration,
      });
    } catch (error) {
      this.logger.error('Scheduled partition maintenance failed', {
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
      });
    }
  }

  private async runHealthCheck(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      const health = await database.partitionManager.validatePartitionHealth();
      
      if (!health.isHealthy) {
        this.logger.warn('Partition health check found issues', {
          issues: health.issues,
          stats: health.stats.map(s => ({
            tableName: s.tableName,
            totalChunks: s.totalChunks,
            compressedChunks: s.compressedChunks,
          })),
        });
      } else {
        this.logger.debug('Partition health check passed', {
          tableCount: health.stats.length,
          totalChunks: health.stats.reduce((sum, s) => sum + s.totalChunks, 0),
        });
      }
    } catch (error) {
      this.logger.error('Partition health check failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  get status(): {
    isRunning: boolean;
    config: SchedulerConfig;
    nextMaintenance?: Date;
    nextHealthCheck?: Date;
  } {
    const now = Date.now();
    
    return {
      isRunning: this.isRunning,
      config: this.config,
      nextMaintenance: this.maintenanceInterval 
        ? new Date(now + this.config.maintenanceIntervalMinutes * 60 * 1000)
        : undefined,
      nextHealthCheck: this.healthCheckInterval
        ? new Date(now + this.config.healthCheckIntervalMinutes * 60 * 1000)
        : undefined,
    };
  }
}

// Create default scheduler instance
export const defaultSchedulerConfig: SchedulerConfig = {
  maintenanceIntervalMinutes: parseInt(process.env.PARTITION_MAINTENANCE_INTERVAL_MINUTES || '360', 10), // 6 hours
  healthCheckIntervalMinutes: parseInt(process.env.PARTITION_HEALTH_CHECK_INTERVAL_MINUTES || '60', 10), // 1 hour
  enabled: process.env.PARTITION_SCHEDULER_ENABLED !== 'false', // Enabled by default
};

export const partitionScheduler = new PartitionScheduler(defaultSchedulerConfig);