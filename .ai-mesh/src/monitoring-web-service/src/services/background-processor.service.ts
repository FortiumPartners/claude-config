/**
 * Background Processing Jobs Service
 * Task 3.5: Data retention, batch aggregation, and system health monitoring
 */

import { EventEmitter } from 'events';
import { MetricsModel } from '../models/metrics.model';
import { DatabaseConnection } from '../database/connection';
import { RealTimeProcessorService } from './real-time-processor.service';
import { MetricsQueryService } from './metrics-query.service';
import {
  PerformanceMetrics,
  AggregatedMetrics
} from '../types/metrics';
import * as winston from 'winston';
import * as cron from 'node-cron';

// Job configuration
export interface JobConfig {
  enabled: boolean;
  schedule: string; // Cron expression
  timeout_ms: number;
  retry_attempts: number;
  retry_delay_ms: number;
}

// System health thresholds
export interface HealthThresholds {
  max_memory_usage_mb: number;
  max_cpu_usage_percent: number;
  min_available_connections: number;
  max_query_response_time_ms: number;
  max_error_rate_percent: number;
}

// Job execution result
interface JobResult {
  success: boolean;
  duration_ms: number;
  records_processed?: number;
  error?: string;
  details?: Record<string, any>;
}

// Job execution history
interface JobExecution {
  job_name: string;
  started_at: Date;
  completed_at?: Date;
  result?: JobResult;
  attempt: number;
}

// Data retention policies
interface RetentionPolicy {
  table_name: string;
  retention_days: number;
  partition_column: string;
  batch_size: number;
  enabled: boolean;
}

// System alert
interface SystemAlert {
  level: 'warning' | 'error' | 'critical';
  component: string;
  message: string;
  timestamp: Date;
  details?: Record<string, any>;
}

export class BackgroundProcessorService extends EventEmitter {
  private metricsModel: MetricsModel;
  private realTimeProcessor?: RealTimeProcessorService;
  private queryService?: MetricsQueryService;
  private logger: winston.Logger;
  private db: DatabaseConnection;

  // Job configurations
  private jobConfigs: Record<string, JobConfig> = {
    data_retention: {
      enabled: true,
      schedule: '0 2 * * *', // Daily at 2 AM
      timeout_ms: 60 * 60 * 1000, // 1 hour
      retry_attempts: 3,
      retry_delay_ms: 10 * 60 * 1000 // 10 minutes
    },
    batch_aggregation: {
      enabled: true,
      schedule: '0 */6 * * *', // Every 6 hours
      timeout_ms: 30 * 60 * 1000, // 30 minutes
      retry_attempts: 2,
      retry_delay_ms: 5 * 60 * 1000 // 5 minutes
    },
    system_health_check: {
      enabled: true,
      schedule: '*/5 * * * *', // Every 5 minutes
      timeout_ms: 30 * 1000, // 30 seconds
      retry_attempts: 1,
      retry_delay_ms: 1000
    },
    performance_analysis: {
      enabled: true,
      schedule: '0 */1 * * *', // Hourly
      timeout_ms: 5 * 60 * 1000, // 5 minutes
      retry_attempts: 2,
      retry_delay_ms: 2 * 60 * 1000 // 2 minutes
    },
    partition_maintenance: {
      enabled: true,
      schedule: '0 1 * * 0', // Weekly on Sunday at 1 AM
      timeout_ms: 2 * 60 * 60 * 1000, // 2 hours
      retry_attempts: 2,
      retry_delay_ms: 30 * 60 * 1000 // 30 minutes
    }
  };

  // Retention policies
  private retentionPolicies: RetentionPolicy[] = [
    {
      table_name: 'command_executions',
      retention_days: 90,
      partition_column: 'executed_at',
      batch_size: 10000,
      enabled: true
    },
    {
      table_name: 'agent_interactions',
      retention_days: 90,
      partition_column: 'occurred_at',
      batch_size: 10000,
      enabled: true
    },
    {
      table_name: 'user_sessions',
      retention_days: 180,
      partition_column: 'session_start',
      batch_size: 5000,
      enabled: true
    },
    {
      table_name: 'productivity_metrics',
      retention_days: 365,
      partition_column: 'recorded_at',
      batch_size: 10000,
      enabled: true
    }
  ];

  // Health thresholds
  private healthThresholds: HealthThresholds = {
    max_memory_usage_mb: 2048,
    max_cpu_usage_percent: 80,
    min_available_connections: 10,
    max_query_response_time_ms: 5000,
    max_error_rate_percent: 5
  };

  // Job execution history
  private jobHistory: JobExecution[] = [];
  private readonly maxHistorySize = 1000;

  // Scheduled jobs
  private scheduledJobs: Map<string, cron.ScheduledTask> = new Map();

  // System alerts
  private activeAlerts: Map<string, SystemAlert> = new Map();

  constructor(
    db: DatabaseConnection,
    logger: winston.Logger,
    realTimeProcessor?: RealTimeProcessorService,
    queryService?: MetricsQueryService
  ) {
    super();
    
    this.db = db;
    this.metricsModel = new MetricsModel(db);
    this.realTimeProcessor = realTimeProcessor;
    this.queryService = queryService;
    this.logger = logger;

    this.initializeJobs();
  }

  /**
   * Initialize and start all background jobs
   */
  private initializeJobs(): void {
    // Schedule data retention job
    if (this.jobConfigs.data_retention.enabled) {
      const task = cron.schedule(this.jobConfigs.data_retention.schedule, () => {
        this.executeJob('data_retention', () => this.runDataRetention());
      }, { scheduled: false });
      
      this.scheduledJobs.set('data_retention', task);
      task.start();
    }

    // Schedule batch aggregation job
    if (this.jobConfigs.batch_aggregation.enabled) {
      const task = cron.schedule(this.jobConfigs.batch_aggregation.schedule, () => {
        this.executeJob('batch_aggregation', () => this.runBatchAggregation());
      }, { scheduled: false });
      
      this.scheduledJobs.set('batch_aggregation', task);
      task.start();
    }

    // Schedule system health check
    if (this.jobConfigs.system_health_check.enabled) {
      const task = cron.schedule(this.jobConfigs.system_health_check.schedule, () => {
        this.executeJob('system_health_check', () => this.runSystemHealthCheck());
      }, { scheduled: false });
      
      this.scheduledJobs.set('system_health_check', task);
      task.start();
    }

    // Schedule performance analysis
    if (this.jobConfigs.performance_analysis.enabled) {
      const task = cron.schedule(this.jobConfigs.performance_analysis.schedule, () => {
        this.executeJob('performance_analysis', () => this.runPerformanceAnalysis());
      }, { scheduled: false });
      
      this.scheduledJobs.set('performance_analysis', task);
      task.start();
    }

    // Schedule partition maintenance
    if (this.jobConfigs.partition_maintenance.enabled) {
      const task = cron.schedule(this.jobConfigs.partition_maintenance.schedule, () => {
        this.executeJob('partition_maintenance', () => this.runPartitionMaintenance());
      }, { scheduled: false });
      
      this.scheduledJobs.set('partition_maintenance', task);
      task.start();
    }

    this.logger.info('Background processor initialized', {
      enabled_jobs: Object.entries(this.jobConfigs)
        .filter(([_, config]) => config.enabled)
        .map(([name]) => name)
    });
  }

  /**
   * Execute a job with retry logic and monitoring
   */
  private async executeJob(jobName: string, jobFunction: () => Promise<JobResult>): Promise<void> {
    const config = this.jobConfigs[jobName];
    if (!config || !config.enabled) return;

    const execution: JobExecution = {
      job_name: jobName,
      started_at: new Date(),
      attempt: 1
    };

    this.jobHistory.push(execution);
    this.trimJobHistory();

    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= config.retry_attempts; attempt++) {
      execution.attempt = attempt;

      try {
        this.logger.info(`Starting job: ${jobName}`, { attempt });

        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Job timeout')), config.timeout_ms);
        });

        const result = await Promise.race([
          jobFunction(),
          timeoutPromise
        ]);

        execution.completed_at = new Date();
        execution.result = result;

        this.logger.info(`Job completed successfully: ${jobName}`, {
          attempt,
          duration_ms: result.duration_ms,
          records_processed: result.records_processed
        });

        this.emit('job_completed', { job_name: jobName, result });
        return;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        execution.completed_at = new Date();
        execution.result = {
          success: false,
          duration_ms: execution.completed_at.getTime() - execution.started_at.getTime(),
          error: lastError.message
        };

        this.logger.error(`Job failed: ${jobName}`, {
          attempt,
          error: lastError.message,
          will_retry: attempt < config.retry_attempts
        });

        if (attempt < config.retry_attempts) {
          await new Promise(resolve => setTimeout(resolve, config.retry_delay_ms));
        }
      }
    }

    // All attempts failed
    this.logger.error(`Job permanently failed: ${jobName}`, {
      attempts: config.retry_attempts,
      error: lastError?.message
    });

    this.emit('job_failed', { 
      job_name: jobName, 
      error: lastError?.message,
      attempts: config.retry_attempts
    });

    // Create critical alert for job failures
    this.createAlert('critical', 'background_processor', 
      `Job ${jobName} failed after ${config.retry_attempts} attempts`, {
        job_name: jobName,
        error: lastError?.message
      });
  }

  /**
   * Data retention job implementation
   */
  private async runDataRetention(): Promise<JobResult> {
    const startTime = Date.now();
    let totalDeleted = 0;

    try {
      for (const policy of this.retentionPolicies) {
        if (!policy.enabled) continue;

        this.logger.info(`Running retention for table: ${policy.table_name}`, {
          retention_days: policy.retention_days
        });

        const result = await this.metricsModel.cleanupOldData(policy.retention_days);
        totalDeleted += result.deleted_rows;

        this.logger.info(`Retention completed for table: ${policy.table_name}`, {
          deleted_rows: result.deleted_rows
        });
      }

      // Vacuum and analyze tables for better performance
      await this.vacuumTables();

      return {
        success: true,
        duration_ms: Date.now() - startTime,
        records_processed: totalDeleted,
        details: {
          tables_processed: this.retentionPolicies.filter(p => p.enabled).length,
          total_deleted: totalDeleted
        }
      };

    } catch (error) {
      throw new Error(`Data retention failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Batch aggregation job implementation
   */
  private async runBatchAggregation(): Promise<JobResult> {
    const startTime = Date.now();
    let totalAggregations = 0;

    try {
      // Get the last aggregation timestamp
      const lastAggregation = await this.getLastAggregationTimestamp();
      const now = new Date();
      
      // Don't aggregate data from the last hour (let real-time processor handle it)
      const endTime = new Date(now.getTime() - 60 * 60 * 1000);

      if (lastAggregation >= endTime) {
        return {
          success: true,
          duration_ms: Date.now() - startTime,
          records_processed: 0,
          details: { message: 'No data to aggregate' }
        };
      }

      // Process in chunks to avoid memory issues
      const chunkSize = 24 * 60 * 60 * 1000; // 1 day chunks
      let currentTime = lastAggregation;

      while (currentTime < endTime) {
        const chunkEnd = new Date(Math.min(currentTime.getTime() + chunkSize, endTime.getTime()));
        
        // Create aggregations for this time chunk
        const aggregations = await this.createBatchAggregations(currentTime, chunkEnd);
        totalAggregations += aggregations;

        currentTime = chunkEnd;
      }

      // Update last aggregation timestamp
      await this.updateLastAggregationTimestamp(endTime);

      return {
        success: true,
        duration_ms: Date.now() - startTime,
        records_processed: totalAggregations,
        details: {
          aggregation_period: {
            start: lastAggregation.toISOString(),
            end: endTime.toISOString()
          }
        }
      };

    } catch (error) {
      throw new Error(`Batch aggregation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * System health check job implementation
   */
  private async runSystemHealthCheck(): Promise<JobResult> {
    const startTime = Date.now();
    const healthIssues: string[] = [];

    try {
      // Check database performance
      const dbMetrics = await this.metricsModel.getPerformanceMetrics();
      
      if (dbMetrics.active_connections < this.healthThresholds.min_available_connections) {
        const alert = 'Low database connection pool';
        healthIssues.push(alert);
        this.createAlert('warning', 'database', alert, { active_connections: dbMetrics.active_connections });
      }

      // Check memory usage
      const memoryUsage = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
      if (memoryUsage > this.healthThresholds.max_memory_usage_mb) {
        const alert = 'High memory usage detected';
        healthIssues.push(alert);
        this.createAlert('warning', 'system', alert, { memory_usage_mb: memoryUsage });
      }

      // Check query performance
      if (this.queryService) {
        const queryStats = this.queryService.getQueryStats();
        if (queryStats.avg_response_time_ms > this.healthThresholds.max_query_response_time_ms) {
          const alert = 'Slow query performance detected';
          healthIssues.push(alert);
          this.createAlert('warning', 'query_service', alert, queryStats);
        }
      }

      // Check real-time processor health
      if (this.realTimeProcessor) {
        const processorStats = this.realTimeProcessor.getProcessingStats();
        const errorRate = processorStats.events_failed / (processorStats.events_processed + processorStats.events_failed) * 100;
        
        if (errorRate > this.healthThresholds.max_error_rate_percent) {
          const alert = 'High error rate in real-time processor';
          healthIssues.push(alert);
          this.createAlert('error', 'real_time_processor', alert, { error_rate_percent: errorRate });
        }
      }

      // Clear resolved alerts
      this.clearResolvedAlerts(healthIssues);

      return {
        success: true,
        duration_ms: Date.now() - startTime,
        details: {
          health_issues: healthIssues,
          memory_usage_mb: memoryUsage,
          db_metrics: dbMetrics,
          active_alerts: this.activeAlerts.size
        }
      };

    } catch (error) {
      throw new Error(`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Performance analysis job implementation
   */
  private async runPerformanceAnalysis(): Promise<JobResult> {
    const startTime = Date.now();

    try {
      // Analyze query performance trends
      const performanceMetrics = await this.analyzePerformanceTrends();
      
      // Generate performance report
      const report = this.generatePerformanceReport(performanceMetrics);
      
      // Store performance metrics
      await this.storePerformanceMetrics(performanceMetrics);

      return {
        success: true,
        duration_ms: Date.now() - startTime,
        details: {
          performance_report: report,
          metrics_count: performanceMetrics.length
        }
      };

    } catch (error) {
      throw new Error(`Performance analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Partition maintenance job implementation
   */
  private async runPartitionMaintenance(): Promise<JobResult> {
    const startTime = Date.now();
    let maintenanceActions = 0;

    try {
      // Create new partitions for upcoming periods
      await this.createUpcomingPartitions();
      maintenanceActions++;

      // Drop old partitions based on retention policies
      const droppedPartitions = await this.dropOldPartitions();
      maintenanceActions += droppedPartitions;

      // Analyze partition statistics
      await this.analyzePartitionStats();
      maintenanceActions++;

      return {
        success: true,
        duration_ms: Date.now() - startTime,
        records_processed: maintenanceActions,
        details: {
          dropped_partitions: droppedPartitions,
          maintenance_actions: maintenanceActions
        }
      };

    } catch (error) {
      throw new Error(`Partition maintenance failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Helper methods
   */
  private trimJobHistory(): void {
    if (this.jobHistory.length > this.maxHistorySize) {
      this.jobHistory = this.jobHistory
        .sort((a, b) => b.started_at.getTime() - a.started_at.getTime())
        .slice(0, this.maxHistorySize);
    }
  }

  private createAlert(level: SystemAlert['level'], component: string, message: string, details?: Record<string, any>): void {
    const alertKey = `${component}:${message}`;
    
    this.activeAlerts.set(alertKey, {
      level,
      component,
      message,
      timestamp: new Date(),
      details
    });

    this.emit('system_alert', this.activeAlerts.get(alertKey));
    
    this.logger[level]('System alert created', {
      level,
      component,
      message,
      details
    });
  }

  private clearResolvedAlerts(currentIssues: string[]): void {
    const resolvedAlerts: string[] = [];
    
    for (const [alertKey] of this.activeAlerts) {
      const isResolved = !currentIssues.some(issue => alertKey.includes(issue));
      if (isResolved) {
        resolvedAlerts.push(alertKey);
        this.activeAlerts.delete(alertKey);
      }
    }

    if (resolvedAlerts.length > 0) {
      this.logger.info('System alerts resolved', { resolved_alerts: resolvedAlerts });
    }
  }

  private async vacuumTables(): Promise<void> {
    const tables = ['command_executions', 'agent_interactions', 'user_sessions', 'productivity_metrics'];
    
    for (const table of tables) {
      await this.db.query(`VACUUM ANALYZE ${table}`);
    }
  }

  private async getLastAggregationTimestamp(): Promise<Date> {
    // Get the latest aggregated data timestamp from productivity_metrics table
    const result = await this.db.query(`
      SELECT MAX(recorded_at) as last_aggregation
      FROM productivity_metrics
      WHERE dimensions->>'aggregation' = 'true'
    `);
    
    return result.rows[0]?.last_aggregation || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Default to 7 days ago
  }

  private async updateLastAggregationTimestamp(timestamp: Date): Promise<void> {
    // Store the timestamp in a metadata table or configuration
    await this.db.query(`
      INSERT INTO system_metadata (key, value, updated_at)
      VALUES ('last_aggregation_timestamp', $1, NOW())
      ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()
    `, [timestamp.toISOString()]);
  }

  private async createBatchAggregations(startTime: Date, endTime: Date): Promise<number> {
    // Implementation would create pre-computed aggregations for the time period
    // This is a simplified placeholder
    return 0;
  }

  private async analyzePerformanceTrends(): Promise<any[]> {
    // Implementation would analyze performance trends
    // This is a simplified placeholder
    return [];
  }

  private generatePerformanceReport(metrics: any[]): any {
    // Implementation would generate a performance report
    // This is a simplified placeholder
    return {};
  }

  private async storePerformanceMetrics(metrics: any[]): Promise<void> {
    // Implementation would store performance metrics
    // This is a simplified placeholder
  }

  private async createUpcomingPartitions(): Promise<void> {
    // Implementation would create new partitions for upcoming time periods
    // This is a simplified placeholder
  }

  private async dropOldPartitions(): Promise<number> {
    // Implementation would drop old partitions based on retention policies
    // This is a simplified placeholder
    return 0;
  }

  private async analyzePartitionStats(): Promise<void> {
    // Implementation would analyze partition statistics
    // This is a simplified placeholder
  }

  /**
   * Public API methods
   */
  getJobHistory(jobName?: string): JobExecution[] {
    if (jobName) {
      return this.jobHistory.filter(exec => exec.job_name === jobName);
    }
    return [...this.jobHistory];
  }

  getActiveAlerts(): SystemAlert[] {
    return Array.from(this.activeAlerts.values());
  }

  getJobStatuses(): Record<string, any> {
    const statuses: Record<string, any> = {};
    
    for (const [jobName, config] of Object.entries(this.jobConfigs)) {
      const recentExecutions = this.jobHistory
        .filter(exec => exec.job_name === jobName)
        .sort((a, b) => b.started_at.getTime() - a.started_at.getTime())
        .slice(0, 5);

      statuses[jobName] = {
        enabled: config.enabled,
        schedule: config.schedule,
        last_execution: recentExecutions[0] || null,
        success_rate: recentExecutions.length > 0 ? 
          recentExecutions.filter(exec => exec.result?.success).length / recentExecutions.length : 0,
        recent_executions: recentExecutions
      };
    }

    return statuses;
  }

  async manualJobExecution(jobName: string): Promise<JobResult> {
    if (!this.jobConfigs[jobName]) {
      throw new Error(`Unknown job: ${jobName}`);
    }

    this.logger.info(`Manual execution requested for job: ${jobName}`);

    switch (jobName) {
      case 'data_retention':
        return await this.runDataRetention();
      case 'batch_aggregation':
        return await this.runBatchAggregation();
      case 'system_health_check':
        return await this.runSystemHealthCheck();
      case 'performance_analysis':
        return await this.runPerformanceAnalysis();
      case 'partition_maintenance':
        return await this.runPartitionMaintenance();
      default:
        throw new Error(`Job execution not implemented: ${jobName}`);
    }
  }

  updateJobConfig(jobName: string, config: Partial<JobConfig>): void {
    if (!this.jobConfigs[jobName]) {
      throw new Error(`Unknown job: ${jobName}`);
    }

    this.jobConfigs[jobName] = { ...this.jobConfigs[jobName], ...config };

    // Restart the job with new configuration
    const existingTask = this.scheduledJobs.get(jobName);
    if (existingTask) {
      existingTask.stop();
      this.scheduledJobs.delete(jobName);
    }

    if (this.jobConfigs[jobName].enabled) {
      // Re-initialize the job with new config
      this.initializeJobs();
    }

    this.logger.info(`Job configuration updated: ${jobName}`, config);
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down background processor');
    
    // Stop all scheduled jobs
    for (const [jobName, task] of this.scheduledJobs) {
      task.stop();
      this.logger.info(`Stopped job: ${jobName}`);
    }
    
    this.scheduledJobs.clear();
    this.emit('shutdown');
  }
}