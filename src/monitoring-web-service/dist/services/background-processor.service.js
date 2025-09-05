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
exports.BackgroundProcessorService = void 0;
const events_1 = require("events");
const metrics_model_1 = require("../models/metrics.model");
const cron = __importStar(require("node-cron"));
class BackgroundProcessorService extends events_1.EventEmitter {
    metricsModel;
    realTimeProcessor;
    queryService;
    logger;
    db;
    jobConfigs = {
        data_retention: {
            enabled: true,
            schedule: '0 2 * * *',
            timeout_ms: 60 * 60 * 1000,
            retry_attempts: 3,
            retry_delay_ms: 10 * 60 * 1000
        },
        batch_aggregation: {
            enabled: true,
            schedule: '0 */6 * * *',
            timeout_ms: 30 * 60 * 1000,
            retry_attempts: 2,
            retry_delay_ms: 5 * 60 * 1000
        },
        system_health_check: {
            enabled: true,
            schedule: '*/5 * * * *',
            timeout_ms: 30 * 1000,
            retry_attempts: 1,
            retry_delay_ms: 1000
        },
        performance_analysis: {
            enabled: true,
            schedule: '0 */1 * * *',
            timeout_ms: 5 * 60 * 1000,
            retry_attempts: 2,
            retry_delay_ms: 2 * 60 * 1000
        },
        partition_maintenance: {
            enabled: true,
            schedule: '0 1 * * 0',
            timeout_ms: 2 * 60 * 60 * 1000,
            retry_attempts: 2,
            retry_delay_ms: 30 * 60 * 1000
        }
    };
    retentionPolicies = [
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
    healthThresholds = {
        max_memory_usage_mb: 2048,
        max_cpu_usage_percent: 80,
        min_available_connections: 10,
        max_query_response_time_ms: 5000,
        max_error_rate_percent: 5
    };
    jobHistory = [];
    maxHistorySize = 1000;
    scheduledJobs = new Map();
    activeAlerts = new Map();
    constructor(db, logger, realTimeProcessor, queryService) {
        super();
        this.db = db;
        this.metricsModel = new metrics_model_1.MetricsModel(db);
        this.realTimeProcessor = realTimeProcessor;
        this.queryService = queryService;
        this.logger = logger;
        this.initializeJobs();
    }
    initializeJobs() {
        if (this.jobConfigs.data_retention.enabled) {
            const task = cron.schedule(this.jobConfigs.data_retention.schedule, () => {
                this.executeJob('data_retention', () => this.runDataRetention());
            }, { scheduled: false });
            this.scheduledJobs.set('data_retention', task);
            task.start();
        }
        if (this.jobConfigs.batch_aggregation.enabled) {
            const task = cron.schedule(this.jobConfigs.batch_aggregation.schedule, () => {
                this.executeJob('batch_aggregation', () => this.runBatchAggregation());
            }, { scheduled: false });
            this.scheduledJobs.set('batch_aggregation', task);
            task.start();
        }
        if (this.jobConfigs.system_health_check.enabled) {
            const task = cron.schedule(this.jobConfigs.system_health_check.schedule, () => {
                this.executeJob('system_health_check', () => this.runSystemHealthCheck());
            }, { scheduled: false });
            this.scheduledJobs.set('system_health_check', task);
            task.start();
        }
        if (this.jobConfigs.performance_analysis.enabled) {
            const task = cron.schedule(this.jobConfigs.performance_analysis.schedule, () => {
                this.executeJob('performance_analysis', () => this.runPerformanceAnalysis());
            }, { scheduled: false });
            this.scheduledJobs.set('performance_analysis', task);
            task.start();
        }
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
    async executeJob(jobName, jobFunction) {
        const config = this.jobConfigs[jobName];
        if (!config || !config.enabled)
            return;
        const execution = {
            job_name: jobName,
            started_at: new Date(),
            attempt: 1
        };
        this.jobHistory.push(execution);
        this.trimJobHistory();
        let lastError;
        for (let attempt = 1; attempt <= config.retry_attempts; attempt++) {
            execution.attempt = attempt;
            try {
                this.logger.info(`Starting job: ${jobName}`, { attempt });
                const timeoutPromise = new Promise((_, reject) => {
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
            }
            catch (error) {
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
        this.logger.error(`Job permanently failed: ${jobName}`, {
            attempts: config.retry_attempts,
            error: lastError?.message
        });
        this.emit('job_failed', {
            job_name: jobName,
            error: lastError?.message,
            attempts: config.retry_attempts
        });
        this.createAlert('critical', 'background_processor', `Job ${jobName} failed after ${config.retry_attempts} attempts`, {
            job_name: jobName,
            error: lastError?.message
        });
    }
    async runDataRetention() {
        const startTime = Date.now();
        let totalDeleted = 0;
        try {
            for (const policy of this.retentionPolicies) {
                if (!policy.enabled)
                    continue;
                this.logger.info(`Running retention for table: ${policy.table_name}`, {
                    retention_days: policy.retention_days
                });
                const result = await this.metricsModel.cleanupOldData(policy.retention_days);
                totalDeleted += result.deleted_rows;
                this.logger.info(`Retention completed for table: ${policy.table_name}`, {
                    deleted_rows: result.deleted_rows
                });
            }
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
        }
        catch (error) {
            throw new Error(`Data retention failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async runBatchAggregation() {
        const startTime = Date.now();
        let totalAggregations = 0;
        try {
            const lastAggregation = await this.getLastAggregationTimestamp();
            const now = new Date();
            const endTime = new Date(now.getTime() - 60 * 60 * 1000);
            if (lastAggregation >= endTime) {
                return {
                    success: true,
                    duration_ms: Date.now() - startTime,
                    records_processed: 0,
                    details: { message: 'No data to aggregate' }
                };
            }
            const chunkSize = 24 * 60 * 60 * 1000;
            let currentTime = lastAggregation;
            while (currentTime < endTime) {
                const chunkEnd = new Date(Math.min(currentTime.getTime() + chunkSize, endTime.getTime()));
                const aggregations = await this.createBatchAggregations(currentTime, chunkEnd);
                totalAggregations += aggregations;
                currentTime = chunkEnd;
            }
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
        }
        catch (error) {
            throw new Error(`Batch aggregation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async runSystemHealthCheck() {
        const startTime = Date.now();
        const healthIssues = [];
        try {
            const dbMetrics = await this.metricsModel.getPerformanceMetrics();
            if (dbMetrics.active_connections < this.healthThresholds.min_available_connections) {
                const alert = 'Low database connection pool';
                healthIssues.push(alert);
                this.createAlert('warning', 'database', alert, { active_connections: dbMetrics.active_connections });
            }
            const memoryUsage = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
            if (memoryUsage > this.healthThresholds.max_memory_usage_mb) {
                const alert = 'High memory usage detected';
                healthIssues.push(alert);
                this.createAlert('warning', 'system', alert, { memory_usage_mb: memoryUsage });
            }
            if (this.queryService) {
                const queryStats = this.queryService.getQueryStats();
                if (queryStats.avg_response_time_ms > this.healthThresholds.max_query_response_time_ms) {
                    const alert = 'Slow query performance detected';
                    healthIssues.push(alert);
                    this.createAlert('warning', 'query_service', alert, queryStats);
                }
            }
            if (this.realTimeProcessor) {
                const processorStats = this.realTimeProcessor.getProcessingStats();
                const errorRate = processorStats.events_failed / (processorStats.events_processed + processorStats.events_failed) * 100;
                if (errorRate > this.healthThresholds.max_error_rate_percent) {
                    const alert = 'High error rate in real-time processor';
                    healthIssues.push(alert);
                    this.createAlert('error', 'real_time_processor', alert, { error_rate_percent: errorRate });
                }
            }
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
        }
        catch (error) {
            throw new Error(`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async runPerformanceAnalysis() {
        const startTime = Date.now();
        try {
            const performanceMetrics = await this.analyzePerformanceTrends();
            const report = this.generatePerformanceReport(performanceMetrics);
            await this.storePerformanceMetrics(performanceMetrics);
            return {
                success: true,
                duration_ms: Date.now() - startTime,
                details: {
                    performance_report: report,
                    metrics_count: performanceMetrics.length
                }
            };
        }
        catch (error) {
            throw new Error(`Performance analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async runPartitionMaintenance() {
        const startTime = Date.now();
        let maintenanceActions = 0;
        try {
            await this.createUpcomingPartitions();
            maintenanceActions++;
            const droppedPartitions = await this.dropOldPartitions();
            maintenanceActions += droppedPartitions;
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
        }
        catch (error) {
            throw new Error(`Partition maintenance failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    trimJobHistory() {
        if (this.jobHistory.length > this.maxHistorySize) {
            this.jobHistory = this.jobHistory
                .sort((a, b) => b.started_at.getTime() - a.started_at.getTime())
                .slice(0, this.maxHistorySize);
        }
    }
    createAlert(level, component, message, details) {
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
    clearResolvedAlerts(currentIssues) {
        const resolvedAlerts = [];
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
    async vacuumTables() {
        const tables = ['command_executions', 'agent_interactions', 'user_sessions', 'productivity_metrics'];
        for (const table of tables) {
            await this.db.query(`VACUUM ANALYZE ${table}`);
        }
    }
    async getLastAggregationTimestamp() {
        const result = await this.db.query(`
      SELECT MAX(recorded_at) as last_aggregation
      FROM productivity_metrics
      WHERE dimensions->>'aggregation' = 'true'
    `);
        return result.rows[0]?.last_aggregation || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    }
    async updateLastAggregationTimestamp(timestamp) {
        await this.db.query(`
      INSERT INTO system_metadata (key, value, updated_at)
      VALUES ('last_aggregation_timestamp', $1, NOW())
      ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()
    `, [timestamp.toISOString()]);
    }
    async createBatchAggregations(startTime, endTime) {
        return 0;
    }
    async analyzePerformanceTrends() {
        return [];
    }
    generatePerformanceReport(metrics) {
        return {};
    }
    async storePerformanceMetrics(metrics) {
    }
    async createUpcomingPartitions() {
    }
    async dropOldPartitions() {
        return 0;
    }
    async analyzePartitionStats() {
    }
    getJobHistory(jobName) {
        if (jobName) {
            return this.jobHistory.filter(exec => exec.job_name === jobName);
        }
        return [...this.jobHistory];
    }
    getActiveAlerts() {
        return Array.from(this.activeAlerts.values());
    }
    getJobStatuses() {
        const statuses = {};
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
    async manualJobExecution(jobName) {
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
    updateJobConfig(jobName, config) {
        if (!this.jobConfigs[jobName]) {
            throw new Error(`Unknown job: ${jobName}`);
        }
        this.jobConfigs[jobName] = { ...this.jobConfigs[jobName], ...config };
        const existingTask = this.scheduledJobs.get(jobName);
        if (existingTask) {
            existingTask.stop();
            this.scheduledJobs.delete(jobName);
        }
        if (this.jobConfigs[jobName].enabled) {
            this.initializeJobs();
        }
        this.logger.info(`Job configuration updated: ${jobName}`, config);
    }
    async shutdown() {
        this.logger.info('Shutting down background processor');
        for (const [jobName, task] of this.scheduledJobs) {
            task.stop();
            this.logger.info(`Stopped job: ${jobName}`);
        }
        this.scheduledJobs.clear();
        this.emit('shutdown');
    }
}
exports.BackgroundProcessorService = BackgroundProcessorService;
//# sourceMappingURL=background-processor.service.js.map