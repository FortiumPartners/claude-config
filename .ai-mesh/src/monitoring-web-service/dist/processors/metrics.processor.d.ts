import * as winston from 'winston';
import { CommandExecutionCreate, AgentInteractionCreate, MetricsBatch } from '../types/metrics';
export interface ProcessingResult {
    success: boolean;
    processed_data: any;
    quality_score: number;
    anomalies_detected: Anomaly[];
    enrichment_applied: string[];
    validation_errors: string[];
    processing_time_ms: number;
}
export interface Anomaly {
    type: 'outlier' | 'missing_field' | 'invalid_range' | 'suspicious_pattern' | 'data_drift';
    severity: 'low' | 'medium' | 'high' | 'critical';
    field: string;
    value: any;
    expected_range?: {
        min: number;
        max: number;
    };
    confidence: number;
    description: string;
    suggestion?: string;
}
export interface QualityMetrics {
    completeness_score: number;
    accuracy_score: number;
    consistency_score: number;
    timeliness_score: number;
    overall_score: number;
    issues: {
        missing_fields: string[];
        invalid_values: Array<{
            field: string;
            value: any;
            reason: string;
        }>;
        inconsistencies: Array<{
            field: string;
            issue: string;
        }>;
        timeliness_issues: Array<{
            field: string;
            issue: string;
        }>;
    };
}
export interface EnrichmentRule {
    name: string;
    condition: (data: any) => boolean;
    enrichment: (data: any) => any;
    description: string;
}
export interface ProcessingStatistics {
    total_processed: number;
    quality_distribution: Record<string, number>;
    anomalies_by_type: Record<string, number>;
    processing_times: number[];
    error_rate: number;
    enrichment_success_rate: number;
}
export declare class MetricsProcessor {
    private logger;
    private processingStats;
    private qualityThresholds;
    private anomalyThresholds;
    private enrichmentRules;
    constructor(logger: winston.Logger);
    processCommandExecution(data: CommandExecutionCreate): Promise<ProcessingResult>;
    processAgentInteraction(data: AgentInteractionCreate): Promise<ProcessingResult>;
    processBatch(batch: MetricsBatch): Promise<{
        success: boolean;
        processed_batch: MetricsBatch;
        quality_summary: {
            overall_quality: number;
            item_quality_scores: number[];
            total_anomalies: number;
            processing_errors: number;
        };
        processing_time_ms: number;
    }>;
    private assessDataQuality;
    private detectAnomalies;
    private detectTokenAnomalies;
    private enrichData;
    private categorizeExecutionTime;
    private categorizeProductivityScore;
    private generateSessionInsights;
    private calculateAgentEfficiency;
    private normalizeTimestamps;
    private getProductivityPeriod;
    private updateProcessingStats;
    getProcessingStatistics(): ProcessingStatistics & {
        average_processing_time_ms: number;
        quality_score_avg: number;
        anomaly_rate: number;
    };
    resetStatistics(): void;
}
//# sourceMappingURL=metrics.processor.d.ts.map