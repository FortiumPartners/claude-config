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
exports.HighThroughputBenchmark = void 0;
const metrics_collection_service_1 = require("../../services/metrics-collection.service");
const metrics_query_service_1 = require("../../services/metrics-query.service");
const real_time_processor_service_1 = require("../../services/real-time-processor.service");
const schema_1 = require("../../database/schema");
const winston = __importStar(require("winston"));
const perf_hooks_1 = require("perf_hooks");
class HighThroughputBenchmark {
    db;
    logger;
    collectionService;
    queryService;
    realTimeProcessor;
    testOrgId = 'benchmark-org-123';
    testUserId = 'benchmark-user-123';
    latencyMeasurements = [];
    queryMeasurements = [];
    constructor(dbConfig) {
        this.logger = winston.createLogger({
            level: 'warn',
            transports: [
                new winston.transports.Console({
                    format: winston.format.combine(winston.format.timestamp(), winston.format.printf(({ timestamp, level, message, ...meta }) => `${timestamp} [${level.toUpperCase()}]: ${message} ${Object.keys(meta).length > 0 ? JSON.stringify(meta) : ''}`))
                })
            ]
        });
        this.db = new connection_1.DatabaseConnection(dbConfig, this.logger);
    }
    async initialize() {
        console.log('🚀 Initializing high-throughput benchmark...');
        await this.db.connect();
        const schema = new schema_1.DatabaseSchema(this.db);
        await schema.dropSchema();
        await schema.initializeSchema();
        this.collectionService = new metrics_collection_service_1.MetricsCollectionService(this.db, this.logger);
        this.realTimeProcessor = new real_time_processor_service_1.RealTimeProcessorService(this.db, this.logger, {
            aggregationWindows: ['1m', '5m', '1h'],
            maxMemoryUsageMB: 1024,
            batchSize: 200,
            flushIntervalMs: 10000,
            deadLetterQueueSize: 1000,
            retryAttempts: 1,
            retryDelayMs: 1000
        });
        this.queryService = new metrics_query_service_1.MetricsQueryService(this.db, this.logger, this.realTimeProcessor);
        await this.setupTestData();
        console.log('✅ Benchmark initialization complete');
    }
    async runBenchmark(config) {
        console.log(`🔥 Starting high-throughput benchmark:
    - Target rate: ${config.target_ingestion_rate} events/second
    - Duration: ${config.test_duration_seconds} seconds
    - Batch size: ${config.batch_size}
    - Concurrent connections: ${config.concurrent_connections}
    `);
        const results = {
            ingestion: {
                events_sent: 0,
                events_processed: 0,
                events_failed: 0,
                actual_rate_per_second: 0,
                avg_latency_ms: 0,
                p95_latency_ms: 0,
                p99_latency_ms: 0,
                success_rate: 0
            },
            queries: {
                queries_executed: 0,
                avg_response_time_ms: 0,
                p95_response_time_ms: 0,
                cache_hit_rate: 0,
                slow_queries: 0
            },
            resources: {
                peak_memory_mb: 0,
                cpu_usage_percent: 0,
                db_connections_used: 0
            },
            real_time_processing: {
                events_processed: 0,
                processing_rate_per_second: 0,
                avg_processing_time_ms: 0,
                dead_letter_queue_size: 0,
                memory_usage_mb: 0
            }
        };
        const resourceMonitor = this.startResourceMonitoring(results);
        try {
            const ingestionResults = await this.runIngestionBenchmark(config);
            results.ingestion = ingestionResults;
            await new Promise(resolve => setTimeout(resolve, 2000));
            const queryResults = await this.runQueryBenchmark(config);
            results.queries = queryResults;
            const processorStats = this.realTimeProcessor.getProcessingStats();
            const deadLetterStatus = this.realTimeProcessor.getDeadLetterQueueStatus();
            results.real_time_processing = {
                events_processed: processorStats.events_processed,
                processing_rate_per_second: processorStats.events_processed /
                    Math.max(1, processorStats.uptime_seconds),
                avg_processing_time_ms: processorStats.avg_processing_time_ms,
                dead_letter_queue_size: deadLetterStatus.size,
                memory_usage_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
            };
        }
        finally {
            clearInterval(resourceMonitor);
        }
        return results;
    }
    async runIngestionBenchmark(config) {
        console.log('📈 Running ingestion benchmark...');
        this.latencyMeasurements = [];
        const startTime = perf_hooks_1.performance.now();
        const endTime = startTime + (config.test_duration_seconds * 1000);
        let eventsSent = 0;
        let eventsProcessed = 0;
        let eventsFailed = 0;
        const generateCommandExecution = (index) => ({
            user_id: this.testUserId,
            command_name: `benchmark-cmd-${index % 10}`,
            execution_time_ms: Math.floor(Math.random() * 2000) + 100,
            status: Math.random() > 0.05 ? 'success' : 'error'
        });
        const generateAgentInteraction = (index) => ({
            user_id: this.testUserId,
            agent_name: `benchmark-agent-${index % 5}`,
            interaction_type: 'command_execution',
            execution_time_ms: Math.floor(Math.random() * 3000) + 200,
            status: 'success',
            input_tokens: Math.floor(Math.random() * 1000) + 100,
            output_tokens: Math.floor(Math.random() * 2000) + 200
        });
        const eventsPerBatch = config.batch_size;
        const batchesPerSecond = config.target_ingestion_rate / eventsPerBatch;
        const msPerBatch = 1000 / batchesPerSecond;
        const workers = Array(config.concurrent_connections).fill(null).map(async (_, workerId) => {
            let batchIndex = 0;
            let lastBatchTime = perf_hooks_1.performance.now();
            while (perf_hooks_1.performance.now() < endTime) {
                const batchStartTime = perf_hooks_1.performance.now();
                const batch = {
                    command_executions: Array(Math.floor(eventsPerBatch * 0.7)).fill(null)
                        .map((_, i) => generateCommandExecution(batchIndex * eventsPerBatch + i)),
                    agent_interactions: Array(Math.floor(eventsPerBatch * 0.3)).fill(null)
                        .map((_, i) => generateAgentInteraction(batchIndex * eventsPerBatch + i))
                };
                try {
                    const result = await this.collectionService.collectBatchMetrics(this.testOrgId, batch);
                    const batchLatency = perf_hooks_1.performance.now() - batchStartTime;
                    this.latencyMeasurements.push(batchLatency);
                    if (result.success) {
                        eventsSent += eventsPerBatch;
                        eventsProcessed += (result.data?.command_executions || 0) +
                            (result.data?.agent_interactions || 0);
                    }
                    else {
                        eventsFailed += eventsPerBatch;
                    }
                    for (const cmd of batch.command_executions) {
                        const streamEvent = {
                            type: 'command_execution',
                            organization_id: this.testOrgId,
                            user_id: this.testUserId,
                            data: cmd,
                            timestamp: new Date(),
                            source: `worker-${workerId}`
                        };
                        this.realTimeProcessor.processStreamEvent(streamEvent).catch(() => {
                        });
                    }
                }
                catch (error) {
                    eventsFailed += eventsPerBatch;
                    console.warn(`Batch failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
                const timeToWait = msPerBatch - (perf_hooks_1.performance.now() - lastBatchTime);
                if (timeToWait > 0) {
                    await new Promise(resolve => setTimeout(resolve, timeToWait));
                }
                lastBatchTime = perf_hooks_1.performance.now();
                batchIndex++;
            }
        });
        await Promise.all(workers);
        const actualDuration = (perf_hooks_1.performance.now() - startTime) / 1000;
        const actualRate = eventsSent / actualDuration;
        this.latencyMeasurements.sort((a, b) => a - b);
        const avgLatency = this.latencyMeasurements.reduce((sum, val) => sum + val, 0) / this.latencyMeasurements.length;
        const p95Index = Math.floor(this.latencyMeasurements.length * 0.95);
        const p99Index = Math.floor(this.latencyMeasurements.length * 0.99);
        console.log(`✅ Ingestion benchmark complete:
    - Events sent: ${eventsSent}
    - Events processed: ${eventsProcessed}
    - Events failed: ${eventsFailed}
    - Actual rate: ${actualRate.toFixed(1)} events/second
    - Success rate: ${((eventsProcessed / eventsSent) * 100).toFixed(1)}%
    - Avg latency: ${avgLatency.toFixed(1)}ms
    - P95 latency: ${this.latencyMeasurements[p95Index]?.toFixed(1)}ms
    - P99 latency: ${this.latencyMeasurements[p99Index]?.toFixed(1)}ms
    `);
        return {
            events_sent: eventsSent,
            events_processed: eventsProcessed,
            events_failed: eventsFailed,
            actual_rate_per_second: actualRate,
            avg_latency_ms: avgLatency,
            p95_latency_ms: this.latencyMeasurements[p95Index] || 0,
            p99_latency_ms: this.latencyMeasurements[p99Index] || 0,
            success_rate: eventsProcessed / eventsSent
        };
    }
    async runQueryBenchmark(config) {
        console.log('🔍 Running query benchmark...');
        this.queryMeasurements = [];
        let queriesExecuted = 0;
        let slowQueries = 0;
        let cacheHits = 0;
        const endTime = new Date();
        const startTime = new Date(endTime.getTime() - (5 * 60 * 1000));
        for (let i = 0; i < config.query_test_iterations; i++) {
            const queryStartTime = perf_hooks_1.performance.now();
            try {
                const queryType = i % 4;
                let result;
                switch (queryType) {
                    case 0:
                        result = await this.queryService.getAggregatedMetrics(this.testOrgId, {
                            start_date: startTime,
                            end_date: endTime,
                            user_id: this.testUserId,
                            aggregation_window: '1m',
                            limit: 100
                        });
                        break;
                    case 1:
                        result = await this.queryService.getDashboardMetrics(this.testOrgId, {
                            user_id: this.testUserId,
                            time_range: '1h'
                        });
                        break;
                    case 2:
                        result = await this.queryService.getCommandExecutions(this.testOrgId, {
                            user_id: this.testUserId,
                            start_date: startTime,
                            end_date: endTime,
                            limit: 50
                        });
                        break;
                    case 3:
                        result = this.queryService.getRealTimeMetrics(this.testOrgId, '5m', this.testUserId);
                        break;
                }
                const queryTime = perf_hooks_1.performance.now() - queryStartTime;
                this.queryMeasurements.push(queryTime);
                if (queryTime > 1000) {
                    slowQueries++;
                }
                if (result && typeof result === 'object' && 'query_performance' in result) {
                    if (result.query_performance?.cache_hit) {
                        cacheHits++;
                    }
                }
                queriesExecuted++;
            }
            catch (error) {
                console.warn(`Query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
            if (i % 10 === 0) {
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }
        this.queryMeasurements.sort((a, b) => a - b);
        const avgResponseTime = this.queryMeasurements.reduce((sum, val) => sum + val, 0) / this.queryMeasurements.length;
        const p95Index = Math.floor(this.queryMeasurements.length * 0.95);
        const cacheHitRate = cacheHits / queriesExecuted;
        console.log(`✅ Query benchmark complete:
    - Queries executed: ${queriesExecuted}
    - Avg response time: ${avgResponseTime.toFixed(1)}ms
    - P95 response time: ${this.queryMeasurements[p95Index]?.toFixed(1)}ms
    - Slow queries (>1s): ${slowQueries}
    - Cache hit rate: ${(cacheHitRate * 100).toFixed(1)}%
    `);
        return {
            queries_executed: queriesExecuted,
            avg_response_time_ms: avgResponseTime,
            p95_response_time_ms: this.queryMeasurements[p95Index] || 0,
            cache_hit_rate: cacheHitRate,
            slow_queries: slowQueries
        };
    }
    startResourceMonitoring(results) {
        return setInterval(() => {
            const memoryUsage = process.memoryUsage();
            const memoryMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
            results.resources.peak_memory_mb = Math.max(results.resources.peak_memory_mb, memoryMB);
        }, 1000);
    }
    async setupTestData() {
        await this.db.query(`
      INSERT INTO organizations (id, name, slug, created_at)
      VALUES ($1, 'Benchmark Org', 'benchmark-org', NOW())
      ON CONFLICT (id) DO NOTHING
    `, [this.testOrgId]);
        await this.db.query(`
      INSERT INTO users (id, organization_id, email, full_name, role, created_at)
      VALUES ($1, $2, 'benchmark@example.com', 'Benchmark User', 'developer', NOW())
      ON CONFLICT (id) DO NOTHING
    `, [this.testUserId, this.testOrgId]);
    }
    async cleanup() {
        console.log('🧹 Cleaning up benchmark environment...');
        await this.realTimeProcessor?.shutdown();
        await this.db?.disconnect();
        console.log('✅ Cleanup complete');
    }
    generateReport(results) {
        const report = `
# High-Throughput Performance Benchmark Report

## Summary
- **Target Ingestion Rate**: 1000+ events/second
- **Actual Ingestion Rate**: ${results.ingestion.actual_rate_per_second.toFixed(1)} events/second
- **Success Rate**: ${(results.ingestion.success_rate * 100).toFixed(1)}%
- **Query Performance**: ${results.queries.avg_response_time_ms.toFixed(1)}ms average

## ✅ Requirements Validation

### High-Throughput Ingestion (Target: 1000+ events/second)
- **Status**: ${results.ingestion.actual_rate_per_second >= 1000 ? '✅ PASSED' : '❌ FAILED'}
- **Actual Rate**: ${results.ingestion.actual_rate_per_second.toFixed(1)} events/second
- **Events Processed**: ${results.ingestion.events_processed.toLocaleString()}
- **Success Rate**: ${(results.ingestion.success_rate * 100).toFixed(1)}%

### Sub-Second Query Response (Target: <1000ms)
- **Status**: ${results.queries.avg_response_time_ms < 1000 ? '✅ PASSED' : '❌ FAILED'}
- **Average Response**: ${results.queries.avg_response_time_ms.toFixed(1)}ms
- **P95 Response**: ${results.queries.p95_response_time_ms.toFixed(1)}ms
- **Slow Queries**: ${results.queries.slow_queries}

### Real-Time Processing
- **Events Processed**: ${results.real_time_processing.events_processed.toLocaleString()}
- **Processing Rate**: ${results.real_time_processing.processing_rate_per_second.toFixed(1)} events/second
- **Avg Processing Time**: ${results.real_time_processing.avg_processing_time_ms.toFixed(1)}ms
- **Dead Letter Queue**: ${results.real_time_processing.dead_letter_queue_size} items

## Performance Metrics

### Latency Distribution
- **Average**: ${results.ingestion.avg_latency_ms.toFixed(1)}ms
- **P95**: ${results.ingestion.p95_latency_ms.toFixed(1)}ms
- **P99**: ${results.ingestion.p99_latency_ms.toFixed(1)}ms

### Resource Usage
- **Peak Memory**: ${results.resources.peak_memory_mb}MB
- **Cache Hit Rate**: ${(results.queries.cache_hit_rate * 100).toFixed(1)}%

## Recommendations

${results.ingestion.actual_rate_per_second < 1000 ?
            '- ⚠️ Ingestion rate below target. Consider optimizing batch processing or increasing database connection pool.' :
            '- ✅ Ingestion performance meets requirements.'}

${results.queries.avg_response_time_ms > 1000 ?
            '- ⚠️ Query response time above target. Consider adding more aggressive caching or query optimization.' :
            '- ✅ Query performance meets sub-second requirement.'}

${results.real_time_processing.dead_letter_queue_size > 100 ?
            '- ⚠️ High number of failed real-time processing events. Review error handling and processing capacity.' :
            '- ✅ Real-time processing performing well.'}

## Test Environment
- Database: PostgreSQL with TimescaleDB
- Node.js Version: ${process.version}
- Memory Limit: 1GB (benchmark setting)

---
*Generated on ${new Date().toISOString()}*
`;
        return report;
    }
}
exports.HighThroughputBenchmark = HighThroughputBenchmark;
if (require.main === module) {
    async function runStandaloneBenchmark() {
        const dbConfig = {
            host: process.env.BENCHMARK_DB_HOST || 'localhost',
            port: parseInt(process.env.BENCHMARK_DB_PORT || '5432'),
            database: process.env.BENCHMARK_DB_NAME || 'metrics_benchmark',
            user: process.env.BENCHMARK_DB_USER || 'test',
            password: process.env.BENCHMARK_DB_PASSWORD || 'test'
        };
        const benchmarkConfig = {
            target_ingestion_rate: 1200,
            test_duration_seconds: 30,
            batch_size: 100,
            concurrent_connections: 4,
            query_test_iterations: 200
        };
        const benchmark = new HighThroughputBenchmark(dbConfig);
        try {
            await benchmark.initialize();
            const results = await benchmark.runBenchmark(benchmarkConfig);
            console.log('\n' + benchmark.generateReport(results));
            const success = results.ingestion.actual_rate_per_second >= 1000 &&
                results.queries.avg_response_time_ms < 1000;
            process.exit(success ? 0 : 1);
        }
        catch (error) {
            console.error('Benchmark failed:', error);
            process.exit(1);
        }
        finally {
            await benchmark.cleanup();
        }
    }
    runStandaloneBenchmark().catch(console.error);
}
//# sourceMappingURL=high-throughput.benchmark.js.map