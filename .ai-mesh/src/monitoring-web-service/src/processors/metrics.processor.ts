/**
 * Metrics Processor
 * Task 3.6: Data processing and quality checks with anomaly detection
 * 
 * Provides data quality validation, anomaly detection, aggregation
 * calculations, and metrics enrichment for incoming metrics data.
 */

import * as winston from 'winston';
import {
  CommandExecutionCreate,
  AgentInteractionCreate,
  UserSessionCreate,
  ProductivityMetricCreate,
  MetricsBatch
} from '../types/metrics';

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
  expected_range?: { min: number; max: number };
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
    invalid_values: Array<{ field: string; value: any; reason: string }>;
    inconsistencies: Array<{ field: string; issue: string }>;
    timeliness_issues: Array<{ field: string; issue: string }>;
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

export class MetricsProcessor {
  private logger: winston.Logger;
  private processingStats: ProcessingStatistics;
  
  // Quality thresholds
  private qualityThresholds = {
    completeness_threshold: 0.8,    // 80% completeness required
    accuracy_threshold: 0.9,        // 90% accuracy required
    consistency_threshold: 0.85,    // 85% consistency required
    timeliness_threshold: 0.9,      // 90% timeliness required
    overall_threshold: 0.8          // 80% overall quality required
  };
  
  // Anomaly detection parameters
  private anomalyThresholds = {
    execution_time_max: 300000,     // 5 minutes max execution time
    execution_time_outlier_factor: 3, // 3x standard deviation
    token_count_max: 100000,        // 100k tokens max
    session_duration_max: 1440,     // 24 hours max session
    productivity_score_range: { min: 0, max: 100 },
    error_rate_threshold: 0.5       // 50% error rate threshold
  };
  
  // Enrichment rules
  private enrichmentRules: EnrichmentRule[] = [
    {
      name: 'add_execution_category',
      condition: (data) => data.execution_time_ms !== undefined,
      enrichment: (data) => ({
        ...data,
        execution_category: this.categorizeExecutionTime(data.execution_time_ms)
      }),
      description: 'Categorize execution time as fast/normal/slow/very_slow'
    },
    {
      name: 'add_productivity_tier',
      condition: (data) => data.productivity_score !== undefined,
      enrichment: (data) => ({
        ...data,
        productivity_tier: this.categorizeProductivityScore(data.productivity_score)
      }),
      description: 'Categorize productivity score as low/medium/high/excellent'
    },
    {
      name: 'add_session_context',
      condition: (data) => data.session_start && data.session_end,
      enrichment: (data) => ({
        ...data,
        session_insights: this.generateSessionInsights(data)
      }),
      description: 'Add session context and insights'
    },
    {
      name: 'add_agent_efficiency',
      condition: (data) => data.agent_name && data.execution_time_ms && data.output_tokens,
      enrichment: (data) => ({
        ...data,
        agent_efficiency: this.calculateAgentEfficiency(data)
      }),
      description: 'Calculate agent efficiency metrics'
    },
    {
      name: 'normalize_timestamps',
      condition: (data) => true,
      enrichment: (data) => ({
        ...data,
        normalized_timestamps: this.normalizeTimestamps(data)
      }),
      description: 'Ensure all timestamps are properly formatted and timezone-aware'
    }
  ];

  constructor(logger: winston.Logger) {
    this.logger = logger;
    this.processingStats = {
      total_processed: 0,
      quality_distribution: {},
      anomalies_by_type: {},
      processing_times: [],
      error_rate: 0,
      enrichment_success_rate: 0
    };
  }

  /**
   * Process command execution data
   */
  async processCommandExecution(data: CommandExecutionCreate): Promise<ProcessingResult> {
    const startTime = performance.now();
    
    try {
      // Quality assessment
      const qualityMetrics = this.assessDataQuality(data, 'command_execution');
      
      // Anomaly detection
      const anomalies = this.detectAnomalies(data, 'command_execution');
      
      // Data enrichment
      const { enrichedData, enrichmentApplied } = this.enrichData(data);
      
      // Additional processing for command executions
      const processedData = {
        ...enrichedData,
        processing_metadata: {
          processed_at: new Date().toISOString(),
          processor_version: '1.0.0',
          quality_score: qualityMetrics.overall_score,
          anomaly_count: anomalies.length
        }
      };
      
      const processingTime = performance.now() - startTime;
      this.updateProcessingStats(processingTime, qualityMetrics.overall_score, anomalies);
      
      return {
        success: true,
        processed_data: processedData,
        quality_score: qualityMetrics.overall_score,
        anomalies_detected: anomalies,
        enrichment_applied: enrichmentApplied,
        validation_errors: [],
        processing_time_ms: processingTime
      };
      
    } catch (error) {
      const processingTime = performance.now() - startTime;
      
      this.logger.error('Failed to process command execution', {
        error: error instanceof Error ? error.message : 'Unknown error',
        processing_time_ms: processingTime
      });
      
      return {
        success: false,
        processed_data: data,
        quality_score: 0,
        anomalies_detected: [],
        enrichment_applied: [],
        validation_errors: [error instanceof Error ? error.message : 'Unknown error'],
        processing_time_ms: processingTime
      };
    }
  }

  /**
   * Process agent interaction data
   */
  async processAgentInteraction(data: AgentInteractionCreate): Promise<ProcessingResult> {
    const startTime = performance.now();
    
    try {
      // Quality assessment
      const qualityMetrics = this.assessDataQuality(data, 'agent_interaction');
      
      // Anomaly detection specific to agent interactions
      const anomalies = this.detectAnomalies(data, 'agent_interaction');
      
      // Check for token usage patterns
      if (data.input_tokens && data.output_tokens) {
        const tokenAnomaly = this.detectTokenAnomalies(data.input_tokens, data.output_tokens);
        if (tokenAnomaly) {
          anomalies.push(tokenAnomaly);
        }
      }
      
      // Data enrichment
      const { enrichedData, enrichmentApplied } = this.enrichData(data);
      
      const processedData = {
        ...enrichedData,
        processing_metadata: {
          processed_at: new Date().toISOString(),
          quality_score: qualityMetrics.overall_score,
          anomaly_count: anomalies.length,
          token_efficiency: data.input_tokens && data.output_tokens 
            ? data.output_tokens / (data.input_tokens + data.output_tokens)
            : undefined
        }
      };
      
      const processingTime = performance.now() - startTime;
      this.updateProcessingStats(processingTime, qualityMetrics.overall_score, anomalies);
      
      return {
        success: true,
        processed_data: processedData,
        quality_score: qualityMetrics.overall_score,
        anomalies_detected: anomalies,
        enrichment_applied: enrichmentApplied,
        validation_errors: [],
        processing_time_ms: processingTime
      };
      
    } catch (error) {
      const processingTime = performance.now() - startTime;
      
      return {
        success: false,
        processed_data: data,
        quality_score: 0,
        anomalies_detected: [],
        enrichment_applied: [],
        validation_errors: [error instanceof Error ? error.message : 'Unknown error'],
        processing_time_ms: processingTime
      };
    }
  }

  /**
   * Process batch metrics
   */
  async processBatch(batch: MetricsBatch): Promise<{
    success: boolean;
    processed_batch: MetricsBatch;
    quality_summary: {
      overall_quality: number;
      item_quality_scores: number[];
      total_anomalies: number;
      processing_errors: number;
    };
    processing_time_ms: number;
  }> {
    const startTime = performance.now();
    
    try {
      const processedBatch: MetricsBatch = { ...batch };
      const qualityScores: number[] = [];
      let totalAnomalies = 0;
      let processingErrors = 0;
      
      // Process command executions
      if (batch.command_executions) {
        const results = await Promise.all(
          batch.command_executions.map(item => this.processCommandExecution(item))
        );
        
        processedBatch.command_executions = results.map(result => result.processed_data);
        qualityScores.push(...results.map(r => r.quality_score));
        totalAnomalies += results.reduce((sum, r) => sum + r.anomalies_detected.length, 0);
        processingErrors += results.filter(r => !r.success).length;
      }
      
      // Process agent interactions
      if (batch.agent_interactions) {
        const results = await Promise.all(
          batch.agent_interactions.map(item => this.processAgentInteraction(item))
        );
        
        processedBatch.agent_interactions = results.map(result => result.processed_data);
        qualityScores.push(...results.map(r => r.quality_score));
        totalAnomalies += results.reduce((sum, r) => sum + r.anomalies_detected.length, 0);
        processingErrors += results.filter(r => !r.success).length;
      }
      
      // Process user sessions
      if (batch.user_sessions) {
        // For user sessions, apply basic quality checks and enrichment
        processedBatch.user_sessions = batch.user_sessions.map(session => ({
          ...session,
          processing_metadata: {
            processed_at: new Date().toISOString(),
            quality_score: this.assessDataQuality(session, 'user_session').overall_score
          }
        }));
      }
      
      // Process productivity metrics
      if (batch.productivity_metrics) {
        processedBatch.productivity_metrics = batch.productivity_metrics.map(metric => ({
          ...metric,
          processing_metadata: {
            processed_at: new Date().toISOString(),
            quality_score: this.assessDataQuality(metric, 'productivity_metric').overall_score
          }
        }));
      }
      
      const overallQuality = qualityScores.length > 0 
        ? qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length 
        : 1.0;
      
      const processingTime = performance.now() - startTime;
      
      this.logger.info('Batch processing completed', {
        items_processed: qualityScores.length,
        overall_quality: overallQuality,
        total_anomalies: totalAnomalies,
        processing_errors: processingErrors,
        processing_time_ms: processingTime
      });
      
      return {
        success: processingErrors === 0,
        processed_batch: processedBatch,
        quality_summary: {
          overall_quality: overallQuality,
          item_quality_scores: qualityScores,
          total_anomalies: totalAnomalies,
          processing_errors: processingErrors
        },
        processing_time_ms: processingTime
      };
      
    } catch (error) {
      const processingTime = performance.now() - startTime;
      
      this.logger.error('Batch processing failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        processing_time_ms: processingTime
      });
      
      return {
        success: false,
        processed_batch: batch,
        quality_summary: {
          overall_quality: 0,
          item_quality_scores: [],
          total_anomalies: 0,
          processing_errors: 1
        },
        processing_time_ms: processingTime
      };
    }
  }

  /**
   * Assess data quality across multiple dimensions
   */
  private assessDataQuality(data: any, dataType: string): QualityMetrics {
    const issues = {
      missing_fields: [] as string[],
      invalid_values: [] as Array<{ field: string; value: any; reason: string }>,
      inconsistencies: [] as Array<{ field: string; issue: string }>,
      timeliness_issues: [] as Array<{ field: string; issue: string }>
    };
    
    // Define required fields by data type
    const requiredFields: Record<string, string[]> = {
      'command_execution': ['user_id', 'command_name', 'execution_time_ms', 'status'],
      'agent_interaction': ['user_id', 'agent_name', 'interaction_type', 'execution_time_ms', 'status'],
      'user_session': ['user_id'],
      'productivity_metric': ['metric_type', 'metric_value']
    };
    
    // Check completeness
    const required = requiredFields[dataType] || [];
    const missingFields = required.filter(field => 
      data[field] === undefined || data[field] === null || data[field] === ''
    );
    issues.missing_fields = missingFields;
    
    const completenessScore = 1 - (missingFields.length / required.length);
    
    // Check accuracy (value ranges and formats)
    let accuracyIssues = 0;
    const totalFieldsToCheck = Object.keys(data).length;
    
    // Execution time checks
    if (data.execution_time_ms !== undefined) {
      if (data.execution_time_ms < 0 || data.execution_time_ms > this.anomalyThresholds.execution_time_max) {
        issues.invalid_values.push({
          field: 'execution_time_ms',
          value: data.execution_time_ms,
          reason: 'Execution time outside valid range'
        });
        accuracyIssues++;
      }
    }
    
    // Token count checks
    if (data.input_tokens !== undefined && data.input_tokens < 0) {
      issues.invalid_values.push({
        field: 'input_tokens',
        value: data.input_tokens,
        reason: 'Token count cannot be negative'
      });
      accuracyIssues++;
    }
    
    // Productivity score checks
    if (data.productivity_score !== undefined) {
      const range = this.anomalyThresholds.productivity_score_range;
      if (data.productivity_score < range.min || data.productivity_score > range.max) {
        issues.invalid_values.push({
          field: 'productivity_score',
          value: data.productivity_score,
          reason: `Score outside valid range ${range.min}-${range.max}`
        });
        accuracyIssues++;
      }
    }
    
    const accuracyScore = 1 - (accuracyIssues / totalFieldsToCheck);
    
    // Check consistency
    let consistencyIssues = 0;
    
    // Status consistency checks
    if (data.status === 'error' && !data.error_message) {
      issues.inconsistencies.push({
        field: 'error_message',
        issue: 'Status is error but no error message provided'
      });
      consistencyIssues++;
    }
    
    if (data.status === 'success' && data.error_message) {
      issues.inconsistencies.push({
        field: 'error_message',
        issue: 'Status is success but error message is present'
      });
      consistencyIssues++;
    }
    
    const consistencyScore = consistencyIssues > 0 ? 0.5 : 1.0;
    
    // Check timeliness
    let timelinessScore = 1.0;
    const now = new Date();
    
    if (data.timestamp) {
      const dataTime = new Date(data.timestamp);
      const ageHours = (now.getTime() - dataTime.getTime()) / (1000 * 60 * 60);
      
      if (ageHours > 24) {
        issues.timeliness_issues.push({
          field: 'timestamp',
          issue: 'Data is more than 24 hours old'
        });
        timelinessScore = 0.7;
      } else if (ageHours > 1) {
        timelinessScore = 0.9;
      }
    }
    
    // Calculate overall score
    const weights = { completeness: 0.3, accuracy: 0.4, consistency: 0.2, timeliness: 0.1 };
    const overallScore = 
      (completenessScore * weights.completeness) +
      (accuracyScore * weights.accuracy) +
      (consistencyScore * weights.consistency) +
      (timelinessScore * weights.timeliness);
    
    return {
      completeness_score: completenessScore,
      accuracy_score: accuracyScore,
      consistency_score: consistencyScore,
      timeliness_score: timelinessScore,
      overall_score: overallScore,
      issues
    };
  }

  /**
   * Detect anomalies in data
   */
  private detectAnomalies(data: any, dataType: string): Anomaly[] {
    const anomalies: Anomaly[] = [];
    
    // Execution time anomalies
    if (data.execution_time_ms !== undefined) {
      if (data.execution_time_ms > this.anomalyThresholds.execution_time_max) {
        anomalies.push({
          type: 'outlier',
          severity: 'high',
          field: 'execution_time_ms',
          value: data.execution_time_ms,
          confidence: 0.95,
          description: `Execution time ${data.execution_time_ms}ms is unusually high`,
          suggestion: 'Investigate performance issues or consider timeout configuration'
        });
      }
      
      if (data.execution_time_ms === 0) {
        anomalies.push({
          type: 'suspicious_pattern',
          severity: 'medium',
          field: 'execution_time_ms',
          value: data.execution_time_ms,
          confidence: 0.8,
          description: 'Execution time of 0ms is suspicious',
          suggestion: 'Verify timing measurement accuracy'
        });
      }
    }
    
    // Token usage anomalies
    if (data.input_tokens && data.output_tokens) {
      const totalTokens = data.input_tokens + data.output_tokens;
      if (totalTokens > this.anomalyThresholds.token_count_max) {
        anomalies.push({
          type: 'outlier',
          severity: 'medium',
          field: 'token_usage',
          value: totalTokens,
          confidence: 0.9,
          description: `Total token usage ${totalTokens} is very high`,
          suggestion: 'Consider breaking down large requests or optimizing prompts'
        });
      }
      
      const ratio = data.output_tokens / data.input_tokens;
      if (ratio > 10) {
        anomalies.push({
          type: 'suspicious_pattern',
          severity: 'low',
          field: 'token_ratio',
          value: ratio,
          confidence: 0.7,
          description: `Output to input token ratio ${ratio.toFixed(2)} is unusually high`,
          suggestion: 'Review prompt efficiency and response generation'
        });
      }
    }
    
    // Session duration anomalies
    if (data.duration_minutes !== undefined) {
      if (data.duration_minutes > this.anomalyThresholds.session_duration_max) {
        anomalies.push({
          type: 'outlier',
          severity: 'medium',
          field: 'duration_minutes',
          value: data.duration_minutes,
          confidence: 0.85,
          description: `Session duration ${data.duration_minutes} minutes is very long`,
          suggestion: 'Check for session timeout issues or user activity patterns'
        });
      }
    }
    
    // Error rate anomalies
    if (data.status === 'error' && dataType === 'command_execution') {
      // This would require historical context to determine if error rate is unusual
      // For now, we'll flag frequent errors from the same user/command
      anomalies.push({
        type: 'data_drift',
        severity: 'low',
        field: 'status',
        value: 'error',
        confidence: 0.6,
        description: 'Error status detected - monitor for patterns',
        suggestion: 'Track error frequency for this user/command combination'
      });
    }
    
    return anomalies;
  }

  /**
   * Detect token usage anomalies
   */
  private detectTokenAnomalies(inputTokens: number, outputTokens: number): Anomaly | null {
    const totalTokens = inputTokens + outputTokens;
    const ratio = outputTokens / inputTokens;
    
    if (totalTokens > this.anomalyThresholds.token_count_max) {
      return {
        type: 'outlier',
        severity: 'high',
        field: 'total_tokens',
        value: totalTokens,
        confidence: 0.9,
        description: `Extremely high token usage: ${totalTokens} tokens`,
        suggestion: 'Investigate potential token waste or model efficiency issues'
      };
    }
    
    if (ratio > 20) {
      return {
        type: 'suspicious_pattern',
        severity: 'medium',
        field: 'token_efficiency',
        value: ratio,
        confidence: 0.8,
        description: `Very high output/input ratio: ${ratio.toFixed(2)}`,
        suggestion: 'Review prompt design for efficiency'
      };
    }
    
    return null;
  }

  /**
   * Enrich data with additional insights
   */
  private enrichData(data: any): { enrichedData: any; enrichmentApplied: string[] } {
    let enrichedData = { ...data };
    const enrichmentApplied: string[] = [];
    
    for (const rule of this.enrichmentRules) {
      try {
        if (rule.condition(enrichedData)) {
          enrichedData = rule.enrichment(enrichedData);
          enrichmentApplied.push(rule.name);
        }
      } catch (error) {
        this.logger.warn(`Enrichment rule ${rule.name} failed`, {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    return { enrichedData, enrichmentApplied };
  }

  /**
   * Helper methods for enrichment
   */
  private categorizeExecutionTime(timeMs: number): string {
    if (timeMs < 100) return 'very_fast';
    if (timeMs < 1000) return 'fast';
    if (timeMs < 5000) return 'normal';
    if (timeMs < 30000) return 'slow';
    return 'very_slow';
  }

  private categorizeProductivityScore(score: number): string {
    if (score >= 90) return 'excellent';
    if (score >= 70) return 'high';
    if (score >= 50) return 'medium';
    return 'low';
  }

  private generateSessionInsights(data: any): any {
    const startTime = new Date(data.session_start);
    const endTime = new Date(data.session_end);
    const durationMs = endTime.getTime() - startTime.getTime();
    
    return {
      session_length_category: this.categorizeExecutionTime(durationMs),
      time_of_day: startTime.getHours(),
      day_of_week: startTime.getDay(),
      productivity_period: this.getProductivityPeriod(startTime.getHours())
    };
  }

  private calculateAgentEfficiency(data: any): any {
    const tokensPerMs = data.output_tokens / data.execution_time_ms;
    const responseQuality = data.status === 'success' ? 1.0 : 0.0;
    
    return {
      tokens_per_second: (tokensPerMs * 1000).toFixed(2),
      efficiency_score: (tokensPerMs * 1000 * responseQuality).toFixed(2),
      response_quality: responseQuality
    };
  }

  private normalizeTimestamps(data: any): any {
    const timestamps: any = {};
    
    for (const [key, value] of Object.entries(data)) {
      if (key.includes('_at') || key.includes('timestamp') || key.includes('time')) {
        try {
          timestamps[key] = new Date(value as string).toISOString();
        } catch {
          // Keep original value if not parseable
          timestamps[key] = value;
        }
      }
    }
    
    return timestamps;
  }

  private getProductivityPeriod(hour: number): string {
    if (hour >= 9 && hour < 12) return 'morning_peak';
    if (hour >= 12 && hour < 14) return 'lunch_period';
    if (hour >= 14 && hour < 17) return 'afternoon_peak';
    if (hour >= 17 && hour < 19) return 'evening';
    return 'off_hours';
  }

  private updateProcessingStats(
    processingTime: number,
    qualityScore: number,
    anomalies: Anomaly[]
  ): void {
    this.processingStats.total_processed++;
    this.processingStats.processing_times.push(processingTime);
    
    // Update quality distribution
    const qualityBucket = Math.floor(qualityScore * 10) * 10;
    const bucketKey = `${qualityBucket}-${qualityBucket + 9}%`;
    this.processingStats.quality_distribution[bucketKey] = 
      (this.processingStats.quality_distribution[bucketKey] || 0) + 1;
    
    // Update anomaly counts by type
    for (const anomaly of anomalies) {
      this.processingStats.anomalies_by_type[anomaly.type] = 
        (this.processingStats.anomalies_by_type[anomaly.type] || 0) + 1;
    }
    
    // Keep last 1000 processing times for performance analysis
    if (this.processingStats.processing_times.length > 1000) {
      this.processingStats.processing_times = 
        this.processingStats.processing_times.slice(-1000);
    }
  }

  /**
   * Get processing statistics
   */
  getProcessingStatistics(): ProcessingStatistics & {
    average_processing_time_ms: number;
    quality_score_avg: number;
    anomaly_rate: number;
  } {
    const avgProcessingTime = this.processingStats.processing_times.length > 0
      ? this.processingStats.processing_times.reduce((sum, time) => sum + time, 0) / 
        this.processingStats.processing_times.length
      : 0;
    
    const totalAnomalies = Object.values(this.processingStats.anomalies_by_type)
      .reduce((sum, count) => sum + count, 0);
    
    const anomalyRate = this.processingStats.total_processed > 0
      ? totalAnomalies / this.processingStats.total_processed
      : 0;
    
    // Calculate average quality score from distribution
    let totalQualityPoints = 0;
    let totalItems = 0;
    
    for (const [range, count] of Object.entries(this.processingStats.quality_distribution)) {
      const midpoint = parseInt(range.split('-')[0]) + 5; // Middle of range
      totalQualityPoints += midpoint * count;
      totalItems += count;
    }
    
    const avgQualityScore = totalItems > 0 ? totalQualityPoints / totalItems : 0;
    
    return {
      ...this.processingStats,
      average_processing_time_ms: avgProcessingTime,
      quality_score_avg: avgQualityScore,
      anomaly_rate: anomalyRate
    };
  }

  /**
   * Reset processing statistics
   */
  resetStatistics(): void {
    this.processingStats = {
      total_processed: 0,
      quality_distribution: {},
      anomalies_by_type: {},
      processing_times: [],
      error_rate: 0,
      enrichment_success_rate: 0
    };
  }
}