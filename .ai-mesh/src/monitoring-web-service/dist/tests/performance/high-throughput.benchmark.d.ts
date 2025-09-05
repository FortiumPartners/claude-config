interface BenchmarkConfig {
    target_ingestion_rate: number;
    test_duration_seconds: number;
    batch_size: number;
    concurrent_connections: number;
    query_test_iterations: number;
}
interface BenchmarkResults {
    ingestion: {
        events_sent: number;
        events_processed: number;
        events_failed: number;
        actual_rate_per_second: number;
        avg_latency_ms: number;
        p95_latency_ms: number;
        p99_latency_ms: number;
        success_rate: number;
    };
    queries: {
        queries_executed: number;
        avg_response_time_ms: number;
        p95_response_time_ms: number;
        cache_hit_rate: number;
        slow_queries: number;
    };
    resources: {
        peak_memory_mb: number;
        cpu_usage_percent: number;
        db_connections_used: number;
    };
    real_time_processing: {
        events_processed: number;
        processing_rate_per_second: number;
        avg_processing_time_ms: number;
        dead_letter_queue_size: number;
        memory_usage_mb: number;
    };
}
declare class HighThroughputBenchmark {
    private db;
    private logger;
    private collectionService;
    private queryService;
    private realTimeProcessor;
    private testOrgId;
    private testUserId;
    private latencyMeasurements;
    private queryMeasurements;
    constructor(dbConfig: any);
    initialize(): Promise<void>;
    runBenchmark(config: BenchmarkConfig): Promise<BenchmarkResults>;
    private runIngestionBenchmark;
    private runQueryBenchmark;
    private startResourceMonitoring;
    private setupTestData;
    cleanup(): Promise<void>;
    generateReport(results: BenchmarkResults): string;
}
export { HighThroughputBenchmark, BenchmarkConfig, BenchmarkResults };
//# sourceMappingURL=high-throughput.benchmark.d.ts.map